// ============================================================
// Fixotech Inno Structures LLP — DATA MANAGER  (go-live safety net)
//  • Auto-save is already ON (every change writes to localStorage + cloud sync).
//    This app makes that trustworthy and visible, and adds:
//  • Full Backup  — one JSON file with ALL Inno data (invoices, sales orders,
//    quotations, customers, inventory, purchase bills, payments). Download anytime.
//  • Restore      — load a backup file back (replace), with a safety backup first.
//  • Activity log — every change to any Inno store is tracked (what, when, +/-).
//  • Start fresh  — clear old/sample data cleanly before loading the final data,
//    always taking a backup first. For the "fresh and new" go-live.
// Loads AFTER sync.js so its change-logger sits on the outside of the sync hook.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => (window.FIXO_DOC && FIXO_DOC.money) ? FIXO_DOC.money(n) : Number(n || 0).toLocaleString('en-IN');
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
  const count = (v) => Array.isArray(v) ? v.length : (v && typeof v === 'object' ? Object.keys(v).length : (v == null ? 0 : 1));
  const ACT = 'fixo_inno_activity';
  const rawSet = localStorage.setItem.bind(localStorage);   // whatever is current (sync's wrapper if loaded first)

  // All Inno data stores + their friendly names. Order = backup order.
  const STORES = [
    { k: 'fixo_inno_invoices', name: 'Invoices', txn: true },
    { k: 'fixo_inno_sorders', name: 'Sales Orders', txn: true },
    { k: 'fixo_inno_quotes', name: 'Quotations', txn: true },
    { k: 'fixo_inno_purchase_bills', name: 'Purchase Bills', txn: true },
    { k: 'fixo_inno_payments', name: 'Payments & Receipts', txn: true },
    { k: 'fixo_inno_customers', name: 'Customers', master: true },
    { k: 'fixo_inno_inventory', name: 'Inventory', master: true },
    { k: 'fixo_chatiq_chats', name: 'Smart IQ chats' }
  ];
  const NAME = {}; STORES.forEach(s => NAME[s.k] = s.name);
  const SEQ_KEYS = ['fixo_inno_inv_seq'];   // shared numbering counters (if present)

  // ---------- change logger (tracks every write to an Inno store) ----------
  function pushActivity(entry) {
    try { const log = read(ACT) || []; log.unshift(entry); rawSet(ACT, JSON.stringify(log.slice(0, 800))); } catch (e) {}
  }
  // Wrap the current setItem so EVERY save to an Inno store is recorded.
  (function hookSaves() {
    const prev = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      if (NAME[k]) {
        try {
          const before = count(read(k));
          const after = (() => { try { return count(JSON.parse(v)); } catch (e) { return before; } })();
          const delta = after - before;
          const action = delta > 0 ? 'added' : delta < 0 ? 'removed' : 'edited';
          pushActivity({ t: new Date().toISOString(), k, name: NAME[k], before, after, delta, action });
        } catch (e) {}
      }
      return prev(k, v);
    };
  })();

  // ---------- backup / restore ----------
  function snapshot() {
    const out = { app: 'fixo-inno-full', version: 1, exportedAt: new Date().toISOString(), company: 'FIXOTECH INNO STRUCTURES LLP', stores: {}, seq: {} };
    STORES.forEach(s => { const v = read(s.k); if (v != null) out.stores[s.k] = v; });
    SEQ_KEYS.forEach(k => { const v = localStorage.getItem(k); if (v != null) out.seq[k] = v; });
    return out;
  }
  function download(obj, fname) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 3000);
  }
  function stamp() { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + '_' + p(d.getHours()) + p(d.getMinutes()); }
  function doBackup(tag) {
    const snap = snapshot(); download(snap, 'inno-backup_' + (tag ? tag + '_' : '') + stamp() + '.json');
    try { localStorage.setItem('fixo_inno_last_backup', new Date().toISOString()); } catch (e) {}
    return snap;
  }
  function restore(obj, replace) {
    if (!obj || !obj.stores) throw new Error('Not a Fixotech Inno backup file');
    let n = 0;
    STORES.forEach(s => {
      if (!(s.k in obj.stores)) return;
      const incoming = obj.stores[s.k];
      if (replace || read(s.k) == null) { localStorage.setItem(s.k, JSON.stringify(incoming)); n += count(incoming); }
      else {
        // merge arrays by id (keep local, add/overwrite incoming)
        const cur = read(s.k) || [];
        if (Array.isArray(cur) && Array.isArray(incoming)) {
          const map = {}; cur.forEach(o => { if (o && o.id) map[o.id] = o; }); incoming.forEach(o => { if (o && o.id) map[o.id] = o; });
          const merged = Object.values(map); localStorage.setItem(s.k, JSON.stringify(merged)); n += incoming.length;
        } else { localStorage.setItem(s.k, JSON.stringify(incoming)); n += count(incoming); }
      }
    });
    if (obj.seq) Object.keys(obj.seq).forEach(k => localStorage.setItem(k, obj.seq[k]));
    return n;
  }

  // ---------- UI ----------
  let view = 'backup';
  function render() {
    const host = document.getElementById('inno-data-app'); if (!host) return;
    const CO = (window.FIXO_DOC && FIXO_DOC.CO) || { name: 'FIXOTECH INNO STRUCTURES LLP', logo: '' };
    const backend = (window.FixoDB && FixoDB.mode && FixoDB.mode() === 'supabase') ? 'Cloud (Supabase) + this device' : 'This device only';
    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">INNO <span class="inv-h-bold">DATA MANAGER</span></div><div class="inv-h-sub">Backup · Tracking · Fresh start</div></div></div>
          <div class="inv-header-right"><div class="inv-h-co">${esc(CO.name)}</div></div>
        </div>
        <div class="dm-save"><span class="dm-dot"></span> <b>Auto-save is ON.</b> Every change is saved automatically to: ${esc(backend)}.
          <span class="dm-last" id="dm-last"></span>
          <button class="cp-btn small" id="dm-now">💾 Save &amp; sync now</button></div>
        <div class="inv-topbtns pm-tabs">
          <button class="cp-btn small ${view === 'backup' ? 'cp-btn-go' : ''}" data-v="backup">💾 Backup &amp; Restore</button>
          <button class="cp-btn small ${view === 'activity' ? 'cp-btn-go' : ''}" data-v="activity">🧾 Activity log</button>
          <button class="cp-btn small ${view === 'fresh' ? 'cp-btn-go' : ''}" data-v="fresh">🆕 Start fresh</button>
        </div>
        <div id="dm-body"></div>
      </div>`;
    host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    const last = localStorage.getItem('fixo_inno_last_backup');
    host.querySelector('#dm-last').textContent = last ? 'Last manual backup: ' + new Date(last).toLocaleString('en-GB') : 'No manual backup taken yet.';
    host.querySelector('#dm-now').onclick = () => { try { if (window.FIXO_SYNC && FIXO_SYNC.flush) FIXO_SYNC.flush(); } catch (e) {} toast('Saved & sync flushed ✓'); };
    if (view === 'activity') renderActivity(); else if (view === 'fresh') renderFresh(); else renderBackup();
  }

  function counts() { return STORES.map(s => ({ s, n: count(read(s.k)) })); }

  function renderBackup() {
    const body = document.getElementById('dm-body');
    const rows = counts().map(({ s, n }) => `<tr><td><b>${esc(s.name)}</b></td><td class="r">${n}</td><td class="c">${s.txn ? '<span class="inv-chip st-sent">transaction</span>' : s.master ? '<span class="inv-chip st-ok">master</span>' : ''}</td></tr>`).join('');
    const total = counts().reduce((a, b) => a + b.n, 0);
    body.innerHTML = `
      <div class="inv-card"><div class="inv-card-h">What's in a backup (${total} records)</div>
        <div class="inv-items-wrap"><table class="inv-tbl pm-tbl"><thead><tr><th>Data</th><th class="r">Records</th><th class="c">Kind</th></tr></thead><tbody>${rows}</tbody></table></div></div>
      <div class="dm-grid">
        <div class="inv-card dm-act"><div class="inv-card-h">⬇ Download full backup</div>
          <p class="dm-p">Saves <b>one JSON file</b> with all the data above. Keep it safe — you can restore everything from it. Do this before go-live and at the end of each day.</p>
          <button class="cp-btn cp-btn-go" id="dm-dl">⬇ Download backup now</button></div>
        <div class="inv-card dm-act"><div class="inv-card-h">⬆ Restore from a backup</div>
          <p class="dm-p">Load a previously downloaded backup file. A safety backup of the current data is taken first, automatically.</p>
          <label class="dm-chk"><input type="checkbox" id="dm-replace" checked> Replace current data (uncheck to merge by id)</label>
          <input type="file" id="dm-file" accept="application/json,.json" hidden>
          <button class="cp-btn" id="dm-restore">⬆ Choose backup file…</button></div>
      </div>`;
    body.querySelector('#dm-dl').onclick = () => { doBackup('manual'); toast('Backup downloaded ✓'); render(); };
    const fi = body.querySelector('#dm-file');
    body.querySelector('#dm-restore').onclick = () => fi.click();
    fi.onchange = () => { const f = fi.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => {
      let obj; try { obj = JSON.parse(rd.result); } catch (e) { alert('Could not read file: ' + e.message); return; }
      if (!obj.stores) { alert('This is not a full Inno backup file.'); return; }
      const when = obj.exportedAt ? new Date(obj.exportedAt).toLocaleString('en-GB') : 'unknown date';
      const tot = Object.values(obj.stores).reduce((a, v) => a + count(v), 0);
      if (!confirm('Restore backup from ' + when + ' (' + tot + ' records)?\n\nA safety backup of your current data will download first.')) return;
      doBackup('before-restore');
      const replace = body.querySelector('#dm-replace').checked;
      try { const n = restore(obj, replace); refreshApps(); toast('Restored ' + n + ' records ✓'); render(); } catch (e) { alert('Restore failed: ' + e.message); }
    }; rd.readAsText(f); fi.value = ''; };
  }

  function renderActivity() {
    const body = document.getElementById('dm-body');
    const draw = () => {
      const log = read(ACT) || [];
      const rows = log.slice(0, 300).map(e => {
        const cls = e.action === 'added' ? 'st-ok' : e.action === 'removed' ? 'st-no' : 'st-sent';
        const d = e.delta > 0 ? '+' + e.delta : (e.delta < 0 ? e.delta : '±0');
        return `<tr><td class="c">${esc(new Date(e.t).toLocaleString('en-GB'))}</td><td><b>${esc(e.name || e.k)}</b></td><td class="c"><span class="inv-chip ${cls}">${esc(e.action)}</span></td><td class="r">${d}</td><td class="r">${e.after}</td></tr>`;
      }).join('');
      body.innerHTML = `
        <div class="inv-topbtns"><span class="dm-p" style="margin:0">Every change to Inno data is recorded here — most recent first (${log.length} entries).</span>
          <button class="cp-btn small" id="dm-actdl">⬇ Export log (CSV)</button>
          <button class="cp-btn small" id="dm-actclr">Clear log</button></div>
        <div class="inv-card"><div class="inv-card-h">Change history</div>
          <div class="inv-items-wrap"><table class="inv-tbl pm-tbl"><thead><tr><th>When</th><th>Data</th><th class="c">Action</th><th class="r">Change</th><th class="r">Now</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="5" class="c dm-p">No changes recorded yet. Edits made from tomorrow will appear here.</td></tr>'}</tbody></table></div></div>`;
      body.querySelector('#dm-actclr').onclick = () => { if (confirm('Clear the activity log? (your data is NOT affected)')) { rawSet(ACT, '[]'); draw(); } };
      body.querySelector('#dm-actdl').onclick = () => {
        const log2 = read(ACT) || []; const csv = ['When,Data,Action,Change,Total'].concat(log2.map(e => [new Date(e.t).toLocaleString('en-GB'), e.name || e.k, e.action, e.delta, e.after].map(x => '"' + String(x).replace(/"/g, '""') + '"').join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inno-activity_' + stamp() + '.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 3000);
      };
    };
    draw();
  }

  function renderFresh() {
    const body = document.getElementById('dm-body');
    body.innerHTML = `
      <div class="inv-card dm-warn"><div class="inv-card-h">🆕 Start fresh for go-live</div>
        <p class="dm-p">This clears the <b>old / sample data</b> so you can load the final records cleanly. Pick what to clear. A full backup downloads automatically first, so nothing is truly lost.</p>
        <div class="dm-fresh-opts">
          ${STORES.filter(s => s.txn).map(s => `<label class="dm-chk"><input type="checkbox" class="dm-clr" data-k="${s.k}" checked> ${esc(s.name)} <span class="dm-cnt">(${count(read(s.k))})</span></label>`).join('')}
          <label class="dm-chk"><input type="checkbox" class="dm-clr" data-k="fixo_inno_customers"> Customers <span class="dm-cnt">(${count(read('fixo_inno_customers'))})</span></label>
          <label class="dm-chk"><input type="checkbox" class="dm-clr" data-k="fixo_inno_inventory"> Inventory <span class="dm-cnt">(${count(read('fixo_inno_inventory'))})</span></label>
        </div>
        <label class="dm-chk dm-seed"><input type="checkbox" id="dm-noseed" checked> Don't re-load the sample seed data (recommended — you're loading real data)</label>
        <div class="dm-confirm"><label>Type <b>FRESH</b> to confirm<input class="inv-in" id="dm-type" placeholder="FRESH" style="max-width:160px"></label>
          <button class="cp-btn cp-btn-danger" id="dm-go">Backup &amp; clear selected</button></div>
      </div>`;
    body.querySelector('#dm-go').onclick = () => {
      if ((body.querySelector('#dm-type').value || '').trim().toUpperCase() !== 'FRESH') { toast('Type FRESH to confirm'); return; }
      const keys = [...body.querySelectorAll('.dm-clr:checked')].map(c => c.dataset.k);
      if (!keys.length) { toast('Nothing selected'); return; }
      doBackup('before-fresh');
      keys.forEach(k => { localStorage.setItem(k, '[]'); try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(k); } catch (e) {} });
      if (body.querySelector('#dm-noseed').checked) { try { localStorage.setItem('fixo_inno_seed_v1', '1'); } catch (e) {} }
      refreshApps(); toast('Cleared ' + keys.length + ' data set(s) — backup saved ✓'); render();
    };
  }

  function refreshApps() {
    try { window.FIXO_PAYMENTS && FIXO_PAYMENTS.render && document.getElementById('inno-pay-app') && FIXO_PAYMENTS.render(); } catch (e) {}
    try { window.FIXO_INNO_INV && FIXO_INNO_INV.render && document.getElementById('inno-inv-app') && FIXO_INNO_INV.render(); } catch (e) {}
    try { window.dispatchEvent(new CustomEvent('fixo:sync', { detail: { keys: STORES.map(s => s.k) } })); } catch (e) {}
  }
  function toast(m) { return (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m)); }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-inno-data"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-inno-data') render();
  });
  window.FIXO_INNO_DATA = { render, snapshot, doBackup, restore };
})();
