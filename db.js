// ============================================================
// Fixotech data layer
// One local cache + pluggable backend:
//   - MongoDB backend  (Node/Express API)  ... cfg.apiUrl
//   - Supabase (Postgres REST)             ... cfg.url + cfg.key
//   - On-device only   (localStorage)      ... neither configured
// The UI always reads/writes through DB.* ; the active backend is
// chosen from config. localStorage is kept as an offline cache/fallback.
// ============================================================
(function (global) {
  const LS = { clients: 'fixo_clients', orders: 'fixo_orders', cfg: 'fixo_backend_cfg' };

  const readLS = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch (e) { return []; } };
  const writeLS = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  function getCfg() { try { return JSON.parse(localStorage.getItem(LS.cfg) || '{}') || {}; } catch (e) { return {}; } }
  function setCfg(c) { localStorage.setItem(LS.cfg, JSON.stringify(c || {})); }
  // A deployed Netlify site can reach its function at its own origin. This
  // avoids making every team member enter the same site URL in Settings.
  function sameOriginNetlify() {
    try { return window.location.hostname.endsWith('.netlify.app'); } catch (e) { return false; }
  }
  function mode() { const c = getCfg(); if (c.apiUrl || sameOriginNetlify()) return 'api'; if (c.url && c.key) return 'supabase'; return 'local'; }
  function backendLabel() { return mode() === 'api' ? 'MongoDB' : mode() === 'supabase' ? 'Supabase' : 'Local'; }

  // ---- MongoDB backend (Express API) ----
  async function api(pathAndQuery, opts) {
    const base = (getCfg().apiUrl || (sameOriginNetlify() ? window.location.origin : '')).replace(/\/$/, '');
    const res = await fetch(base + '/api' + pathAndQuery, Object.assign(
      { headers: { 'Content-Type': 'application/json' } }, opts || {}));
    if (!res.ok) throw new Error('API ' + res.status + ': ' + (await res.text()));
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  // ---- Supabase REST ----
  async function sb(pathAndQuery, opts) {
    const c = getCfg();
    const url = c.url.replace(/\/$/, '') + '/rest/v1/' + pathAndQuery;
    const headers = Object.assign({
      apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json'
    }, (opts && opts.headers) || {});
    const res = await fetch(url, Object.assign({}, opts, { headers }));
    if (!res.ok) throw new Error('Cloud error ' + res.status + ': ' + (await res.text()));
    const t = await res.text();
    return t ? JSON.parse(t) : null;
  }

  const DB = {
    getCfg, setCfg, mode, backendLabel,
    cloudEnabled() { return mode() !== 'local'; },

    async test() {
      if (mode() === 'api') { const h = await api('/health', { method: 'GET' }); if (!h || !h.ok) throw new Error('backend not healthy'); return true; }
      if (mode() === 'supabase') { await sb('clients?select=id&limit=1', { method: 'GET' }); return true; }
      return true;
    },

    // ---------------- Clients ----------------
    async listClients() {
      try {
        if (mode() === 'api') { const rows = await api('/clients', { method: 'GET' }); writeLS(LS.clients, rows || []); return rows || []; }
        if (mode() === 'supabase') { const rows = await sb('clients?select=*&order=company_name.asc', { method: 'GET' }); writeLS(LS.clients, rows || []); return rows || []; }
      } catch (e) { console.warn('listClients backend failed, using local cache', e); }
      return readLS(LS.clients);
    },

    searchClients(q, clients) {
      q = (q || '').trim().toLowerCase();
      if (!q) return clients.slice(0, 25);
      return clients.filter(c =>
        (c.client_name || '').toLowerCase().includes(q) ||
        (c.company_name || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      ).slice(0, 25);
    },

    async addClient(data) {
      let rec = Object.assign({ id: uid(), created_at: new Date().toISOString() }, data);
      try {
        if (mode() === 'api') { rec = (await api('/clients', { method: 'POST', body: JSON.stringify(data) })) || rec; }
        else if (mode() === 'supabase') { const out = await sb('clients', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }); if (out && out[0]) rec = out[0]; }
      } catch (e) { console.warn('addClient backend failed (saved locally)', e); }
      const list = readLS(LS.clients); list.push(rec); writeLS(LS.clients, list);
      return rec;
    },

    async updateClient(id, data) {
      let updated = null;
      try {
        if (mode() === 'api') { updated = await api('/clients/' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }); }
        else if (mode() === 'supabase') { await sb('clients?id=eq.' + encodeURIComponent(id), { method: 'PATCH', body: JSON.stringify(data) }); }
      } catch (e) { console.warn('updateClient backend failed (saved locally)', e); }
      const list = readLS(LS.clients);
      const i = list.findIndex(c => c.id === id);
      if (i >= 0) { list[i] = updated || Object.assign({}, list[i], data); writeLS(LS.clients, list); return list[i]; }
      return updated;
    },

    async removeClient(id) {
      try {
        if (mode() === 'api') { await api('/clients/' + encodeURIComponent(id), { method: 'DELETE' }); }
        else if (mode() === 'supabase') { await sb('orders?client_id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); await sb('clients?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
      } catch (e) { console.warn('removeClient backend failed (removed locally)', e); }
      writeLS(LS.clients, readLS(LS.clients).filter(c => c.id !== id));
      writeLS(LS.orders, readLS(LS.orders).filter(o => o.client_id !== id));
    },

    async importClients(rows) {
      let n = 0;
      for (const r of rows) { if (!r) continue; await DB.addClient(r); n++; }
      return n;
    },

    // ---------------- Orders ----------------
    async listOrders(clientId) {
      try {
        if (mode() === 'api') {
          const rows = await api('/orders?clientId=' + encodeURIComponent(clientId), { method: 'GET' });
          const others = readLS(LS.orders).filter(o => o.client_id !== clientId);
          writeLS(LS.orders, others.concat(rows || [])); return rows || [];
        }
        if (mode() === 'supabase') {
          const rows = await sb('orders?client_id=eq.' + encodeURIComponent(clientId) + '&select=*&order=order_date.desc', { method: 'GET' });
          const others = readLS(LS.orders).filter(o => o.client_id !== clientId);
          writeLS(LS.orders, others.concat(rows || [])); return rows || [];
        }
      } catch (e) { console.warn('listOrders backend failed, using local cache', e); }
      return readLS(LS.orders).filter(o => o.client_id === clientId)
        .sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
    },

    async addOrder(order) {
      let rec = Object.assign({ id: uid(), created_at: new Date().toISOString() }, order);
      try {
        if (mode() === 'api') { rec = (await api('/orders', { method: 'POST', body: JSON.stringify(order) })) || rec; }
        else if (mode() === 'supabase') { const out = await sb('orders', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(rec) }); if (out && out[0]) rec = out[0]; }
      } catch (e) { console.warn('addOrder backend failed (saved locally)', e); }
      const list = readLS(LS.orders); list.push(rec); writeLS(LS.orders, list);
      return rec;
    },

    async removeOrder(id) {
      try {
        if (mode() === 'api') { await api('/orders/' + encodeURIComponent(id), { method: 'DELETE' }); }
        else if (mode() === 'supabase') { await sb('orders?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); }
      } catch (e) { console.warn('removeOrder backend failed (removed locally)', e); }
      writeLS(LS.orders, readLS(LS.orders).filter(o => o.id !== id));
    }
  };

  global.FixoDB = DB;
})(window);
