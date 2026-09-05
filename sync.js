// ============================================================
// Fixotech — offline-first sync layer (Phase 3)
// Mirrors the app's localStorage stores <-> Supabase WITHOUT rewriting the
// modules. It intercepts writes to registered keys and pushes them (debounced),
// pulls remote changes on load / reconnect / interval, and merges by id. When
// offline everything keeps working from localStorage and flushes when back.
// ============================================================
(function () {
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const rawSet = localStorage.setItem.bind(localStorage);
  const write = (k, v) => rawSet(k, JSON.stringify(v));
  const supa = () => { try { const c = window.FixoDB && FixoDB.getCfg(); return (c && c.url && c.key) ? c : null; } catch (e) { return null; } };
  const hdr = (c, extra) => Object.assign({ apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' }, extra || {});
  async function rq(path, opts) { const c = supa(); if (!c) throw new Error('no backend'); const r = await fetch(c.url.replace(/\/$/, '') + '/rest/v1/' + path, Object.assign({}, opts, { headers: hdr(c, (opts || {}).headers) })); if (!r.ok) throw new Error('sync ' + r.status + ' ' + (await r.text())); const t = await r.text(); return t ? JSON.parse(t) : null; }

  const blob = (key, table, index) => ({ key, table, type: 'array', toRow: (o) => Object.assign({ id: o.id, data: o }, index ? index(o) : {}), fromRow: (r) => Object.assign({}, r.data || {}, { id: r.id }) });

  const STORES = [
    blob('fixo_factory_indents', 'factory_indents', o => ({ indent_no: o.indentNo, customer: o.customer, priority: !!o.priority, factory_approved: !!o.factoryApproved })),
    { key: 'fixo_inv_items', table: 'inventory_items', type: 'array',
      toRow: o => ({ id: o.id, name: o.name, sheet: o.sheet, type: o.type, unit: o.unit, opening: o.opening, min_qty: o.minQty, txns: o.txns || [] }),
      fromRow: r => ({ id: r.id, name: r.name, sheet: r.sheet, type: r.type, unit: r.unit, opening: r.opening, minQty: r.min_qty, txns: r.txns || [] }) },
    blob('fixo_dispatch_log', 'dispatch_log', o => ({ customer: o.customer, indent_no: o.indentNo || '' })),
    blob('fixo_office_notifications', 'notifications', o => ({ type: o.type, customer: o.customer || '', indent_no: o.indentNo || '', seen: !!o.seen })),
    blob('fixo_floor_sheets', 'floor_sheets', o => ({ kind: o.kind, customer: o.customer || '', indent_no: o.indentNo || '', img: o.img })),
    blob('fixo_chatiq_chats', 'chatiq_chats', o => ({ title: o.title || '' })),
    blob('fixo_saved_orders', 'saved_orders', o => ({ quote_no: o.quoteNo || o.qtnNo || '', client_name: o.client || '', total: o.total || 0 })),
    blob('fixo_saved_proformas', 'saved_proformas', o => ({ pi_no: o.piNo || '', client_name: o.client || '', total: o.total || 0 })),
    { key: 'fixo_dispatch_approvals', table: 'dispatch_approvals', type: 'map', pk: 'indent_no' },
    { key: 'fixo_chatiq_kb', table: 'chatiq_kb', type: 'kv', pk: 'key', vf: 'value' }
  ];
  const byKey = {}; STORES.forEach(s => byKey[s.key] = s);

  // app_settings scalar keys (global): testing mode + shared sequence counters.
  const SETTINGS = [
    { ls: 'fixo_testing_mode', skey: 'testing_mode', to: v => v === '1' || v === true, from: v => v ? '1' : '0', onPull: () => { try { window.FIXO_TESTING && FIXO_TESTING.apply(); } catch (e) {} } },
    { ls: 'fixo_qtn_seq', skey: 'qtn_seq', to: v => +v || 0, from: v => v },
    { ls: 'fixo_pi_seq', skey: 'pi_seq', to: v => +v || 0, from: v => v },
    { ls: 'fixo_dispatch_seq', skey: 'dispatch_seq', to: v => +v || 0, from: v => v }
  ];

  let suppress = false;                 // don't re-trigger push during our own writes
  const dirty = new Set();
  const timers = {};

  // ---- PUSH one store (upsert all local rows, delete remote rows gone locally) ----
  async function pushStore(cfg) {
    if (!supa()) return;
    if (cfg.type === 'array') {
      let arr = read(cfg.key) || []; let changed = false;
      arr.forEach(o => { if (o && !o.id) { o.id = uid(); changed = true; } });   // ensure ids (e.g. notifications)
      if (changed) { suppress = true; write(cfg.key, arr); suppress = false; }
      const rows = arr.filter(o => o && o.id).map(cfg.toRow);
      if (rows.length) await rq(cfg.table, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
      const ids = new Set(rows.map(r => r.id));
      const remote = await rq(cfg.table + '?select=id');
      const gone = (remote || []).map(r => r.id).filter(id => !ids.has(id));
      for (const id of gone) await rq(cfg.table + '?id=eq.' + encodeURIComponent(id), { method: 'DELETE' });
    } else if (cfg.type === 'map') {
      const obj = read(cfg.key) || {};
      const rows = Object.keys(obj).map(k => { const r = { data: obj[k] }; r[cfg.pk] = k; return r; });
      if (rows.length) await rq(cfg.table, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
    } else if (cfg.type === 'kv') {
      const obj = read(cfg.key) || {};
      const rows = Object.keys(obj).map(k => { const r = {}; r[cfg.pk] = k; r[cfg.vf] = obj[k]; return r; });
      if (rows.length) await rq(cfg.table, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify(rows) });
    }
  }

  // ---- PULL one store (merge remote into local; keep local-only, then push them) ----
  async function pullStore(cfg) {
    if (!supa()) return;
    if (cfg.type === 'array') {
      const remote = await rq(cfg.table + '?select=*');
      const remObjs = (remote || []).map(cfg.fromRow);
      const remIds = new Set(remObjs.map(o => o.id));
      const local = read(cfg.key) || [];
      const localOnly = local.filter(o => o && o.id && !remIds.has(o.id));
      const merged = remObjs.concat(localOnly);
      suppress = true; write(cfg.key, merged); suppress = false;
      if (localOnly.length) await pushStore(cfg);
    } else if (cfg.type === 'map') {
      const remote = await rq(cfg.table + '?select=*');
      const local = read(cfg.key) || {}; const out = {};
      (remote || []).forEach(r => { out[r[cfg.pk]] = r.data; });
      Object.keys(local).forEach(k => { if (!(k in out)) out[k] = local[k]; });
      suppress = true; write(cfg.key, out); suppress = false;
    } else if (cfg.type === 'kv') {
      const remote = await rq(cfg.table + '?select=*');
      const local = read(cfg.key) || {}; const out = {};
      (remote || []).forEach(r => { out[r[cfg.pk]] = r[cfg.vf]; });
      Object.keys(local).forEach(k => { if (!(k in out)) out[k] = local[k]; });
      suppress = true; write(cfg.key, out); suppress = false;
    }
  }

  // ---- Settings (global scalars) ----
  async function pullSettings() {
    if (!supa()) return;
    const rows = await rq('app_settings?select=key,value');
    const map = {}; (rows || []).forEach(r => map[r.key] = r.value);
    SETTINGS.forEach(s => {
      if (s.skey in map) {
        const cur = localStorage.getItem(s.ls);
        const val = s.from(map[s.skey]);
        if (String(cur) !== String(val)) { suppress = true; rawSet(s.ls, val); suppress = false; if (s.onPull) s.onPull(); }
      }
    });
  }
  async function pushSetting(ls) {
    const s = SETTINGS.find(x => x.ls === ls); if (!s || !supa()) return;
    await rq('app_settings', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify([{ key: s.skey, value: s.to(localStorage.getItem(ls)) }]) });
  }

  // ---- Full pull + flush ----
  async function pullAll() { for (const s of STORES) { try { await pullStore(s); } catch (e) {} } try { await pullSettings(); } catch (e) {} }
  async function flush() { for (const s of STORES) { if (dirty.has(s.key)) { try { await pushStore(s); dirty.delete(s.key); } catch (e) {} } } }

  function schedulePush(key) {
    dirty.add(key);
    clearTimeout(timers[key]);
    timers[key] = setTimeout(() => { pushStore(byKey[key]).then(() => dirty.delete(key)).catch(() => {}); }, 1200);
  }

  // ---- Intercept writes to registered keys ----
  localStorage.setItem = function (k, v) {
    rawSet(k, v);
    if (suppress) return;
    if (byKey[k]) schedulePush(k);
    else { const s = SETTINGS.find(x => x.ls === k); if (s) { clearTimeout(timers[k]); timers[k] = setTimeout(() => pushSetting(k).catch(() => {}), 800); } }
  };

  // ---- Lifecycle: pull on load, flush on reconnect, periodic ----
  let started = false;
  async function start() { if (started) return; started = true; await pullAll(); }
  document.addEventListener('DOMContentLoaded', () => { setTimeout(start, 1500); });   // after seeds settle
  window.addEventListener('online', () => { pullAll(); flush(); });
  setInterval(() => { if (supa()) { pullAll(); flush(); } }, 30000);

  window.FIXO_SYNC = { pullAll, flush, pushStore: (k) => pushStore(byKey[k]), pullStore: (k) => pullStore(byKey[k]), pushSetting, pullSettings, STORES };
})();
