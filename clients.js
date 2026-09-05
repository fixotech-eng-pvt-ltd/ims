// ============================================================
// Fixotech — Client Database & Order History UI
// Live search on the client field, add/edit/remove customers,
// per-client order history with one-click re-quote, and a cloud
// (Supabase) settings panel. Works offline; syncs when configured.
// ============================================================
(function () {
  const DB = window.FixoDB;
  const FIXO = () => window.FIXO || {};

  const FIELDS = [
    { k: 'company_name', label: 'Company / Business Name', ph: 'M/s ...' },
    { k: 'client_name', label: 'Contact Person', ph: 'Name' },
    { k: 'phone', label: 'Phone', ph: '+91 ...' },
    { k: 'email', label: 'Email', ph: 'name@company.com' },
    { k: 'gstin', label: 'GSTIN', ph: '29ABCDE1234F1Z5' },
    { k: 'site_address', label: 'Business / Billing Address', ph: 'City, State' },
    { k: 'delivery_address', label: 'Delivery Address', ph: 'Site / consignee address' },
    { k: 'state', label: 'State', ph: 'e.g. Karnataka' },
    { k: 'notes', label: 'Notes', ph: 'Any notes', wide: true }
  ];

  let clientsCache = [];
  let current = null; // selected client record

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    if (!DB) { console.error('FixoDB not loaded'); return; }
    buildUI();
    try { clientsCache = await DB.listClients(); } catch (e) { clientsCache = []; }
    await seedCustomers();
    refreshCloudBadge();
    if (window.FIXO) window.FIXO.onExport = onQuoteExported;
  }

  // Ensure the full customer database (from BILL DETAILS) is present — the
  // customer master AND their complete order history. Merges by company name so
  // it always loads what's missing, without duplicating.
  async function seedCustomers() {
    try {
      const seed = window.FIXO_CUSTOMER_SEED;
      if (!Array.isArray(seed) || !seed.length) return;
      const norm = s => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');

      // Fields refreshed from the seed onto existing records (customer master).
      const SEED_FIELDS = ['client_name', 'phone', 'email', 'gstin', 'site_address', 'billing_address', 'delivery_address', 'state', 'notes'];
      const REFRESH_FLAG = 'fixo_customers_refreshed_v3';   // bump to re-refresh master data

      // 1) Merge customers (add any missing)
      let byName = new Map(clientsCache.map(c => [norm(c.company_name), c]));
      const missing = seed.filter(s => s.company_name && !byName.has(norm(s.company_name)));
      for (const s of missing) {
        const client = {}; for (const k in s) if (k !== 'orders') client[k] = s[k];
        const added = await DB.addClient(client);
        byName.set(norm(s.company_name), added);
      }
      if (missing.length) {
        clientsCache = await DB.listClients();
        byName = new Map(clientsCache.map(c => [norm(c.company_name), c]));
        toast('Loaded ' + missing.length + ' customers');
      }

      // 1b) Refresh master data on EXISTING customers (corrected GST/rates from the
      // header-mapped re-parse, contact person, addresses). Runs once per version.
      if (localStorage.getItem(REFRESH_FLAG) !== '1') {
        let upd = 0;
        for (const s of seed) {
          const client = byName.get(norm(s.company_name));
          if (!client) continue;
          const patch = {};
          SEED_FIELDS.forEach(k => { if (s[k] != null && s[k] !== '' && s[k] !== client[k]) patch[k] = s[k]; });
          if (Object.keys(patch).length) { const u = await DB.updateClient(client.id, patch); if (u) Object.assign(client, u); upd++; }
        }
        localStorage.setItem(REFRESH_FLAG, '1');
        if (upd) toast('Refreshed details for ' + upd + ' customers');
        clientsCache = await DB.listClients();
        byName = new Map(clientsCache.map(c => [norm(c.company_name), c]));
      }

      // 2) Import order history. Bumped to v3 for the header-mapped re-parse
      // (corrected May/June columns). Purge any prior history orders first so the
      // corrected records don't duplicate.
      if (localStorage.getItem('fixo_orders_seed_v3') !== '1') {
        if (localStorage.getItem('fixo_orders_seed_v1') === '1' || localStorage.getItem('fixo_orders_seed_v2') === '1') {
          try {
            for (const c of clientsCache) {
              const existing = await DB.listOrders(c.id);
              for (const o of existing) if (o.source === 'history') await DB.removeOrder(o.id);
            }
          } catch (e) { console.warn('history purge failed', e); }
          localStorage.removeItem('fixo_orders_seed_v1');
          localStorage.removeItem('fixo_orders_seed_v2');
        }
        let n = 0;
        const slug = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        for (const s of seed) {
          if (!Array.isArray(s.orders) || !s.orders.length) continue;
          const client = byName.get(norm(s.company_name));
          if (!client) continue;
          for (let oi = 0; oi < s.orders.length; oi++) {
            const o = s.orders[oi];
            // Stable id from the voucher (unique per invoice) so re-seeding or a
            // second device UPSERTS the same row instead of creating duplicates.
            const stableId = 'histord-' + (o.voucher_no ? slug(o.voucher_no) : slug(s.company_name) + '-' + oi);
            await DB.addOrder({
              id: stableId,
              client_id: client.id,
              order_date: o.order_date || '',
              quote_no: o.voucher_no || '',
              items: (o.items || []).map(it => ({ desc: it.desc, qty: it.qty, rate: it.rate, unit: it.unit, amount: it.amount })),
              total_cost: o.total_cost || 0,
              status: 'billed', source: 'history', ledger: o.ledger || '', po_ref: o.po_ref || '',
              narration: o.narration || ''
            });
            n++;
          }
        }
        localStorage.setItem('fixo_orders_seed_v3', '1');
        if (n) toast('Loaded ' + n + ' past orders into customer history');
      }
    } catch (e) { console.warn('customer seed failed', e); }
  }

  const exportedThisSession = new Set();
  async function onQuoteExported(meta) {
    if (!current || !meta || !meta.snapshot) return;      // only store against a selected client
    const key = current.id + '|' + meta.qtnNo;
    if (exportedThisSession.has(key)) return;              // avoid double-saving (PDF + CSV of same quote)
    exportedThisSession.add(key);
    const snap = meta.snapshot;
    await DB.addOrder({
      client_id: current.id,
      order_date: new Date().toISOString().slice(0, 10),
      quote_no: meta.qtnNo,
      items: snap.items,
      total_cost: Math.round(snap.totalCost),
      total_weight: +snap.totalWeight.toFixed(3),
      status: 'quoted',
      source: meta.kind || 'export'
    });
    if (!document.getElementById('cp-orders-panel').hidden) loadOrders();
    toast('Saved ' + meta.qtnNo + ' to ' + (current.company_name || current.client_name));
  }

  // -------------------------------------------------- UI scaffolding
  function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; }

  function buildUI() {
    const clientBox = document.querySelector('.client-box');
    if (clientBox) {
      clientBox.style.position = 'relative';
      const dd = el('<div class="client-search-dd" id="client-search-dd" hidden></div>');
      clientBox.appendChild(dd);
      const input = document.getElementById('client-name');
      input.setAttribute('placeholder', 'Search or type client / company…');
      input.addEventListener('input', onSearchInput);
      input.addEventListener('focus', onSearchInput);
      document.addEventListener('click', (e) => { if (!clientBox.contains(e.target)) dd.hidden = true; });
    }

    const panel = el(`
      <section class="client-panel" id="client-panel">
        <div class="cp-head">
          <span class="cp-title">CUSTOMER DETAILS</span>
          <span class="cp-cloud" id="cp-cloud" title="Storage mode">◌ Local</span>
          <div class="cp-actions">
            <button class="cp-btn" id="cp-new">+ New</button>
            <button class="cp-btn primary" id="cp-save">Save Client</button>
            <button class="cp-btn danger" id="cp-del">Delete</button>
            <button class="cp-btn" id="cp-orders-toggle">Order History</button>
            <button class="cp-btn" id="cp-settings" title="Cloud & data settings">⚙</button>
          </div>
        </div>
        <div class="cp-grid" id="cp-grid"></div>
        <div class="cp-orders" id="cp-orders-panel" hidden>
          <div class="cpo-head">
            <span>ORDER HISTORY <em id="cpo-for"></em></span>
            <div class="cpo-head-btns">
              <button class="cp-btn" id="cp-upload-btn" title="Upload previous quotes/orders (PDF or CSV) to compare">⬆ Upload PDF/CSV</button>
              <input type="file" id="cp-upload" accept=".csv,.pdf" multiple hidden>
              <button class="cp-btn primary" id="cp-save-order">Save current quote as order</button>
            </div>
          </div>
          <span id="cpo-upload-status" class="cloud-status"></span>
          <div class="cpo-list" id="cpo-list"></div>
        </div>
      </section>`);

    const grid = panel.querySelector('#cp-grid');
    FIELDS.forEach(f => {
      grid.appendChild(el(`
        <div class="cf-field${f.wide ? ' wide' : ''}">
          <label>${f.label}</label>
          <input type="text" id="cf-${f.k}" placeholder="${f.ph}" autocomplete="off">
        </div>`));
    });

    const controls = document.querySelector('.controls-row');
    if (controls && controls.parentNode) controls.parentNode.insertBefore(panel, controls.nextSibling);

    // wire buttons
    panel.querySelector('#cp-new').addEventListener('click', newClient);
    panel.querySelector('#cp-save').addEventListener('click', saveClient);
    panel.querySelector('#cp-del').addEventListener('click', deleteClient);
    panel.querySelector('#cp-orders-toggle').addEventListener('click', toggleOrders);
    panel.querySelector('#cp-settings').addEventListener('click', openSettings);
    panel.querySelector('#cp-save-order').addEventListener('click', saveCurrentOrder);
    panel.querySelector('#cp-upload-btn').addEventListener('click', () => panel.querySelector('#cp-upload').click());
    panel.querySelector('#cp-upload').addEventListener('change', handleUploads);

    buildSettingsModal();
    buildCompareModal();
  }

  // -------------------------------------------------- search
  async function onSearchInput() {
    const input = document.getElementById('client-name');
    const dd = document.getElementById('client-search-dd');
    const q = input.value;
    const matches = DB.searchClients(q, clientsCache);
    let html = '';
    matches.forEach(c => {
      html += `<div class="csd-item" data-id="${c.id}">
        <span class="csd-co">${esc(c.company_name || c.client_name || '(unnamed)')}</span>
        <span class="csd-sub">${esc([c.client_name, c.phone].filter(Boolean).join(' · '))}</span>
      </div>`;
    });
    const typed = (q || '').trim();
    if (typed) html += `<div class="csd-add" data-add="1">+ Add “${esc(typed)}” as new client</div>`;
    if (!html) html = `<div class="csd-empty">No clients yet — type a name and Save Client</div>`;
    dd.innerHTML = html;
    dd.hidden = false;
    dd.querySelectorAll('.csd-item').forEach(itEl =>
      itEl.addEventListener('click', () => selectClient(itEl.dataset.id)));
    const addEl = dd.querySelector('.csd-add');
    if (addEl) addEl.addEventListener('click', () => { dd.hidden = true; newClientFromTyped(typed); });
  }

  function selectClient(id) {
    current = clientsCache.find(c => c.id === id) || null;
    document.getElementById('client-search-dd').hidden = true;
    if (!current) return;
    FIXO().setClientName && FIXO().setClientName(current.company_name || current.client_name || '');
    FIELDS.forEach(f => { const i = document.getElementById('cf-' + f.k); if (i) i.value = current[f.k] || ''; });
    setDeleteEnabled(true);
    loadOrders();
    toast('Loaded ' + (current.company_name || current.client_name));
  }

  function newClientFromTyped(typed) {
    newClient();
    // guess: put typed value into company name + the quote field
    document.getElementById('cf-company_name').value = typed;
    FIXO().setClientName && FIXO().setClientName(typed);
    document.getElementById('cf-client_name').focus();
  }

  // -------------------------------------------------- CRUD
  function readForm() {
    const data = {};
    FIELDS.forEach(f => { data[f.k] = document.getElementById('cf-' + f.k).value.trim(); });
    return data;
  }

  function newClient() {
    current = null;
    FIELDS.forEach(f => { document.getElementById('cf-' + f.k).value = ''; });
    setDeleteEnabled(false);
    renderOrders([]);
    document.getElementById('cpo-for').textContent = '';
    document.getElementById('cf-company_name').focus();
  }

  async function saveClient() {
    const data = readForm();
    if (!data.company_name && !data.client_name) { toast('Enter a company or contact name'); return; }
    if (current) {
      const upd = await DB.updateClient(current.id, data);
      if (upd) Object.assign(current, upd);
      const idx = clientsCache.findIndex(c => c.id === current.id);
      if (idx >= 0) clientsCache[idx] = current;
      toast('Client updated');
    } else {
      current = await DB.addClient(data);
      clientsCache.push(current);
      setDeleteEnabled(true);
      toast('Client added');
    }
    FIXO().setClientName && FIXO().setClientName(current.company_name || current.client_name || '');
  }

  async function deleteClient() {
    if (!current) return;
    if (!confirm('Remove ' + (current.company_name || current.client_name) + ' and their order history?')) return;
    await DB.removeClient(current.id);
    clientsCache = clientsCache.filter(c => c.id !== current.id);
    toast('Client removed');
    newClient();
  }

  function setDeleteEnabled(on) {
    const b = document.getElementById('cp-del');
    if (b) b.disabled = !on;
  }

  // -------------------------------------------------- orders
  function toggleOrders() {
    const p = document.getElementById('cp-orders-panel');
    p.hidden = !p.hidden;
    if (!p.hidden) loadOrders();
  }

  async function loadOrders() {
    const forEl = document.getElementById('cpo-for');
    if (!current) { renderOrders([]); if (forEl) forEl.textContent = '— select a client'; return; }
    if (forEl) forEl.textContent = '— ' + (current.company_name || current.client_name);
    let orders = [];
    try { orders = await DB.listOrders(current.id); } catch (e) { orders = []; }
    renderOrders(orders);
  }

  let lastOrders = [];
  const itemName = (it) => it.name || it.desc || it.productKey || 'item';
  const itemAmount = (it) => Number(it.totalCost != null ? it.totalCost : it.amount) || 0;
  const itemRate = (it) => Number(it.quoteRate != null ? it.quoteRate : it.rate) || 0;
  // Items that can be re-loaded into the calculator (must carry a productKey)
  const loadable = (o) => (o.items || []).filter(it => it && it.productKey && (window.PRODUCTS_DB ? PRODUCTS_DB[it.productKey] : true));

  function renderOrders(orders) {
    lastOrders = orders || [];
    const list = document.getElementById('cpo-list');
    if (!orders.length) { list.innerHTML = `<div class="cpo-empty">No past orders. Build a quote and click “Save current quote as order”, or upload previous PDFs/CSVs above.</div>`; return; }
    list.innerHTML = '';
    orders.forEach(o => {
      const items = o.items || [];
      const isUpload = o.source === 'upload';
      const canLoad = loadable(o).length > 0;
      const summary = items.length
        ? items.slice(0, 3).map(it => itemName(it) + ' ×' + (it.qty || '')).join(', ') + (items.length > 3 ? ` +${items.length - 3} more` : '')
        : (o.raw_text ? '(text-only — see details)' : '(no items)');
      const tag = isUpload ? `<span class="cpo-tag">UPLOAD</span>` : (o.quote_no ? `<span class="cpo-tag q">${esc(o.quote_no)}</span>` : '');

      // full item detail table
      let detail = '';
      if (items.length) {
        detail = `<table class="cpo-detail-tbl"><tr><th>#</th><th>Item</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>` +
          items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(itemName(it))}</td><td>${esc(it.unit || (it.type === 'linear' ? 'Mtr' : it.type === 'piece' ? 'Nos' : ''))}</td><td>${esc(it.qty || '')}</td><td>₹${itemRate(it).toLocaleString('en-IN')}</td><td>₹${itemAmount(it).toLocaleString('en-IN')}</td></tr>`).join('') +
          `<tr class="cpo-detail-tot"><td colspan="5">TOTAL</td><td>₹${Number(o.total_cost || 0).toLocaleString('en-IN')}</td></tr></table>`;
      }
      if (o.raw_text) detail += `<details class="cpo-raw"><summary>Extracted text from ${esc(o.filename || 'file')}</summary><pre>${esc(o.raw_text)}</pre></details>`;
      if (!detail) detail = `<div class="cpo-empty">No line-item details captured.</div>`;

      const row = el(`
        <div class="cpo-item"${canLoad ? ' draggable="true"' : ''}>
          <div class="cpo-top">
            <span class="cpo-date">${canLoad ? '<span class="cpo-drag" title="Drag into the workspace to re-quote">⠿</span> ' : ''}${esc(o.order_date || (o.created_at || '').slice(0, 10))} ${tag}</span>
            <span class="cpo-total">₹${Number(o.total_cost || 0).toLocaleString('en-IN')}</span>
          </div>
          <div class="cpo-sum">${esc(summary)}</div>
          <div class="cpo-btns">
            <button class="cp-btn small" data-details="${o.id}">▾ Details</button>
            <button class="cp-btn small primary" data-cmp="${o.id}">⇄ Compare</button>
            ${canLoad ? `<button class="cp-btn small" data-reuse="${o.id}">Re-quote</button>` : ''}
            <button class="cp-btn small danger" data-delo="${o.id}">Delete</button>
          </div>
          <div class="cpo-detail" hidden>${detail}</div>
        </div>`);

      if (canLoad) {
        row.addEventListener('dragstart', (ev) => {
          ev.dataTransfer.setData('application/fixo-order-items', JSON.stringify(loadable(o)));
          ev.dataTransfer.effectAllowed = 'move';
          row.classList.add('dragging');
        });
        row.addEventListener('dragend', () => row.classList.remove('dragging'));
      }
      row.querySelector('[data-details]').addEventListener('click', () => {
        const d = row.querySelector('.cpo-detail'); d.hidden = !d.hidden;
      });
      const rb = row.querySelector('[data-reuse]');
      if (rb) rb.addEventListener('click', () => reuseOrder(o));
      row.querySelector('[data-cmp]').addEventListener('click', () => openCompare(o));
      row.querySelector('[data-delo]').addEventListener('click', () => delOrder(o.id));
      list.appendChild(row);
    });
  }

  function reuseOrder(o) {
    const n = FIXO().loadOrderItems ? FIXO().loadOrderItems(o.items || []) : 0;
    toast(n ? (n + ' item(s) loaded into workspace') : 'Nothing to load');
  }

  async function delOrder(id) {
    if (!confirm('Delete this order from history?')) return;
    await DB.removeOrder(id);
    loadOrders();
    toast('Order deleted');
  }

  async function saveCurrentOrder() {
    if (!current) { toast('Select or save a client first'); return; }
    if (!FIXO().hasQuoteItems || !FIXO().hasQuoteItems()) { toast('Add items to the quote first'); return; }
    const snap = FIXO().getQuoteSnapshot();
    const order = {
      client_id: current.id,
      order_date: new Date().toISOString().slice(0, 10),
      quote_no: (typeof getQtnNo === 'function' ? getQtnNo() : ''),
      items: snap.items,
      total_cost: Math.round(snap.totalCost),
      total_weight: +snap.totalWeight.toFixed(3),
      status: 'quoted'
    };
    await DB.addOrder(order);
    document.getElementById('cp-orders-panel').hidden = false;
    loadOrders();
    toast('Order saved to history');
  }

  // -------------------------------------------------- uploads (previous PDFs/CSVs)
  async function handleUploads(e) {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (!files.length) return;
    if (!current) { toast('Select or save a client first, then upload'); return; }
    setStatus('cpo-upload-status', 'Reading ' + files.length + ' file(s)…', null);
    let ok = 0;
    for (const file of files) {
      try {
        const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
        const parsed = isPdf ? await parsePdfOrder(file) : parseCsvOrder(await file.text());
        await DB.addOrder({
          client_id: current.id,
          order_date: parsed.date || new Date().toISOString().slice(0, 10),
          quote_no: '(uploaded) ' + file.name,
          items: parsed.items,
          total_cost: Math.round(parsed.total || 0),
          total_weight: parsed.weight || 0,
          status: 'archived',
          source: 'upload',
          filename: file.name,
          raw_text: parsed.rawText || ''
        });
        ok++;
      } catch (err) { console.warn('upload parse failed', file.name, err); }
    }
    setStatus('cpo-upload-status', '✓ Imported ' + ok + '/' + files.length + ' file(s)', ok > 0);
    document.getElementById('cp-orders-panel').hidden = false;
    loadOrders();
  }

  // Parse an order out of CSV text (this app's export + generic tables, tolerant)
  function parseCsvOrder(text) {
    const rows = parseCsv(text);
    const num = (v) => parseFloat(String(v || '').replace(/[^0-9.\-]/g, '')) || 0;
    const isNum = (v) => v != null && String(v).trim() !== '' && /^[\s₹rs.,\-]*[0-9][0-9.,]*\s*$/i.test(String(v).trim());
    const skipRx = /freight|gst|hsn|terms|yours truly|authorised|note|validity|make :- fixotech|quotation|qtn no|enquiry|source|amended|dated/i;

    let headerIdx = -1, col = {};
    for (let i = 0; i < rows.length; i++) {
      const low = rows[i].map(c => (c || '').toLowerCase());
      if (low.some(c => c.includes('description') || c.includes('particular') || c.includes('item')) &&
          low.some(c => c.includes('amount') || c.includes('rate') || c.includes('value') || c.includes('price'))) {
        headerIdx = i;
        col.desc = low.findIndex(c => c.includes('description') || c.includes('particular') || (c.includes('item') && !c.includes('sl')));
        col.unit = low.findIndex(c => c.includes('unit') || c.includes('uom'));
        col.qty = low.findIndex(c => c.includes('qty') || c.includes('quantity') || c.includes('nos'));
        col.rate = low.findIndex(c => c.includes('rate') || c.includes('price'));
        col.amt = low.findIndex(c => c.includes('amount') || c.includes('value') || (c.includes('total') && !c.includes('sub')));
        break;
      }
    }

    const items = []; let total = 0;
    const pushItem = (desc, unit, qty, rate, amt) => {
      desc = (desc || '').trim();
      if (!desc || desc.length < 2 || skipRx.test(desc)) return;
      if (!amt && qty && rate) amt = qty * rate;
      if (!rate && qty && amt) rate = amt / qty;
      items.push({ desc, unit: (unit || '').trim(), qty: num(qty), rate: num(rate), amount: num(amt) });
    };

    const start = headerIdx >= 0 ? headerIdx + 1 : 0;
    for (let i = start; i < rows.length; i++) {
      const r = rows[i]; if (!r) continue;
      const joined = r.join(' ').trim().toLowerCase();
      if (!joined) continue;
      if (/\btotal\b/.test(joined) && !/sub ?total/.test(joined)) {
        const t = num(col.amt >= 0 ? r[col.amt] : '') || num([...r].reverse().find(isNum));
        if (t) total = t;
        continue;
      }
      if (skipRx.test(joined)) continue;
      if (headerIdx >= 0) {
        const desc = col.desc >= 0 ? r[col.desc] : (r.find(c => c && !isNum(c) && c.trim().length > 2) || '');
        const amt = col.amt >= 0 ? r[col.amt] : [...r].reverse().find(isNum);
        pushItem(desc, col.unit >= 0 ? r[col.unit] : '', col.qty >= 0 ? r[col.qty] : '', col.rate >= 0 ? r[col.rate] : '', amt);
      } else {
        // no header: heuristic — a text cell + trailing numeric cells
        const nums = r.filter(isNum);
        const desc = r.find(c => c && !isNum(c) && c.trim().length > 2);
        if (desc && nums.length) {
          const amt = nums[nums.length - 1];
          const rate = nums.length >= 2 ? nums[nums.length - 2] : '';
          const qty = nums.length >= 3 ? nums[nums.length - 3] : (rate && amt ? num(amt) / num(rate) : '');
          pushItem(desc, '', qty, rate, amt);
        }
      }
    }
    if (!total) total = items.reduce((s, it) => s + (it.amount || 0), 0);
    const meta = extractMeta(text);
    return { items, total, rawText: text.slice(0, 4000), customer: meta.customer, gst: meta.gst };
  }

  // Extract an order from a PDF using pdf.js — position-based (groups text into
  // rows by Y and columns by X). Reliably pulls descriptions (incl. multi-line)
  // + qty/rate/amount, and the customer/GST. Falls back to a text regex.
  async function parsePdfOrder(file) {
    const lib = window.pdfjsLib;
    if (!lib) return { items: [], total: 0, rawText: '(pdf.js unavailable)' };
    if (lib.GlobalWorkerOptions && !lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = 'vendor/pdf.worker.min.js';
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;

    const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
    const isNumStr = (s) => s != null && /^[\s₹rs.,\-]*\d[\d,]*(\.\d+)?\s*$/i.test(String(s).trim());
    const skipRx = /freight|gst|hsn|terms|yours|authoris|^note|validity|make\s*:-|quotation|proforma|order acceptance|qtn no|ref no|enquiry|source|amended|dated|transportation|amount in words|bank|ifsc|account|branch|tin no|delivery|basic|round off|total value/i;

    // Collect text with positions, grouped into rows (by Y, top→bottom)
    let rows = [], rawText = '';
    for (let p = 1; p <= pdf.numPages; p++) {
      const tc = await (await pdf.getPage(p)).getTextContent();
      rawText += tc.items.map(i => i.str).join(' ') + '\n';
      const cells = tc.items.filter(it => it.str && it.str.trim() !== '')
        .map(it => ({ s: it.str.trim(), x: it.transform[4], y: Math.round(it.transform[5]) }));
      const map = [];
      cells.forEach(c => { let r = map.find(m => Math.abs(m.y - c.y) <= 3); if (!r) { r = { y: c.y, cells: [] }; map.push(r); } r.cells.push(c); });
      map.sort((a, b) => b.y - a.y);
      map.forEach(r => { r.cells.sort((a, b) => a.x - b.x); rows.push(r.cells); });
    }

    // Find the table header row + column x-positions
    let colX = null, headerIdx = -1;
    for (let i = 0; i < rows.length; i++) {
      const t = rows[i].map(c => c.s).join(' ').toLowerCase();
      if ((t.includes('description') || t.includes('particular')) && (t.includes('amount') || t.includes('rate') || t.includes('value'))) {
        headerIdx = i; colX = {};
        rows[i].forEach(c => {
          const s = c.s.toLowerCase();
          if (/sl\.?\s*no|^sr|^#/.test(s)) colX.sl = c.x;
          else if (/desc|particular|^item/.test(s)) colX.desc = c.x;
          else if (/unit|uom/.test(s)) colX.unit = c.x;
          else if (/qty|quant/.test(s)) colX.qty = c.x;
          else if (/rate|price/.test(s)) colX.rate = c.x;
          else if (/amount|value/.test(s)) colX.amt = c.x;
        });
        break;
      }
    }

    const items = [];
    let total = 0;
    if (headerIdx >= 0 && colX && colX.desc != null && colX.amt != null) {
      const rightStart = Math.min.apply(null, [colX.unit, colX.qty, colX.rate, colX.amt].filter(v => v != null));
      const nearest = (x) => { let best = null, bd = 1e9; ['qty', 'rate', 'amt'].forEach(k => { if (colX[k] != null) { const d = Math.abs(colX[k] - x); if (d < bd) { bd = d; best = k; } } }); return best; };

      // Bound the item region: header → the first totals/terms row.
      let endIdx = rows.length;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const jl = rows[i].map(c => c.s).join(' ').toLowerCase();
        if (/\btotal\b|\bbasic\b|hsn code|freight|\bgst\b|terms\s*&|amount in words|round off/.test(jl)) {
          if (/\btotal\b/.test(jl)) { const a = rows[i].filter(c => isNumStr(c.s)).pop(); if (a) { const t = num(a.s); if (t) total = t; } }
          endIdx = i; break;
        }
      }

      // Anchors = rows containing an AMOUNT number (one per line item).
      const anchors = [];
      for (let i = headerIdx + 1; i < endIdx; i++) {
        const cells = rows[i];
        const jl = cells.map(c => c.s).join(' ').toLowerCase();
        if (/make\s*:-/.test(jl)) continue;
        let amt = 0, rate = 0, qty = 0, unit = '';
        cells.forEach(c => {
          if (colX.unit != null && Math.abs(c.x - colX.unit) < 12 && /^[A-Za-z.]{2,6}$/.test(c.s)) unit = c.s;
          if (!isNumStr(c.s) || c.x < rightStart - 4) return;
          const k = nearest(c.x); const v = num(c.s);
          if (k === 'amt') amt = v; else if (k === 'rate') rate = v; else if (k === 'qty') qty = v;
        });
        if (amt) anchors.push({ y: cells[0].y, amt, rate, qty, unit, frags: [] });
      }

      // Description fragments (desc-column text) → nearest anchor by Y.
      if (anchors.length) {
        for (let i = headerIdx + 1; i < endIdx; i++) {
          const jl = rows[i].map(c => c.s).join(' ').toLowerCase();
          if (/make\s*:-/.test(jl)) continue;
          rows[i].forEach(c => {
            if (c.x >= rightStart - 4 || isNumStr(c.s) || /^\d+$/.test(c.s) || !c.s.trim()) return;
            let best = null, bd = 1e9;
            anchors.forEach(a => { const d = Math.abs(a.y - c.y); if (d < bd) { bd = d; best = a; } });
            if (best) best.frags.push(c);
          });
        }
        anchors.forEach(a => {
          const desc = a.frags.sort((p, q) => (q.y - p.y) || (p.x - q.x)).map(f => f.s).join(' ').replace(/\s+/g, ' ').trim();
          items.push({ desc, unit: a.unit, qty: a.qty || (a.rate ? +(a.amt / a.rate).toFixed(2) : 0), rate: a.rate || (a.qty ? +(a.amt / a.qty).toFixed(2) : 0), amount: a.amt });
        });
      }
    }

    // Fallback: flat-text regex if positional found nothing
    if (!items.length) {
      const rx = /([A-Za-z][^\n]{3,70}?)\s+(?:Mtr|Nos|Pcs|Mts|Kgs?|mtr|nos|pcs)\s+(\d+(?:\.\d+)?)\s+([\d,]+\.?\d*)\s+([\d,]+\.\d{2})/g;
      let m; while ((m = rx.exec(rawText))) items.push({ desc: m[1].trim().replace(/\s+/g, ' '), unit: '', qty: num(m[2]), rate: num(m[3]), amount: num(m[4]) });
    }
    if (!total) { const tm = rawText.match(/TOTAL[^\d]*([\d,]+\.\d{2})/i); if (tm) total = num(tm[1]); }
    if (!total) total = items.reduce((s, it) => s + (it.amount || 0), 0);

    const meta = extractMeta(rawText);
    return { items, total, rawText: rawText.slice(0, 4000), customer: meta.customer, gst: meta.gst };
  }

  // Pull customer name (M/s ...) and GST number from raw quotation text.
  function extractMeta(text) {
    text = String(text || '');
    let customer = '';
    const cm = text.match(/M\/s\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9 .,&()\/\-]{2,55}?)(?:\s{2,}|,?\s*(?:SOURCE|ENQUIRY|GST|PO No|Delivery|Date|$))/i);
    if (cm) customer = cm[1].replace(/\s+/g, ' ').trim();
    const gm = text.match(/\b(\d{2}[A-Z]{5}\d{4}[A-Z]\d[A-Z\d]Z[A-Z\d])\b/);
    return { customer, gst: gm ? gm[1] : '' };
  }

  // -------------------------------------------------- comparison
  function buildCompareModal() {
    const modal = el(`
      <div class="modal-overlay" id="compare-modal">
        <div class="modal-dialog compare-modal">
          <div class="modal-header">
            <div class="modal-title-group"><h3>⇄ Compare Orders</h3></div>
            <button class="modal-close-btn" id="cmp-x">&times;</button>
          </div>
          <div class="modal-body" id="cmp-body"></div>
        </div>
      </div>`);
    document.body.appendChild(modal);
    modal.querySelector('#cmp-x').addEventListener('click', () => modal.classList.remove('show'));
  }

  function orderToItems(o) {
    return (o.items || []).map(it => ({
      desc: it.name || it.desc || it.productKey || 'item',
      qty: +it.qty || 0,
      rate: +(it.quoteRate != null ? it.quoteRate : it.rate) || 0,
      amount: +(it.totalCost != null ? it.totalCost : it.amount) || 0
    }));
  }

  function currentQuoteAsOrder() {
    const snap = (FIXO().getQuoteSnapshot && FIXO().getQuoteSnapshot()) || { items: [], totalCost: 0 };
    return { label: 'CURRENT QUOTE', total_cost: snap.totalCost, items: snap.items };
  }

  function openCompare(order) {
    const A = order;
    const B = currentQuoteAsOrder();
    const ai = orderToItems(A), bi = orderToItems(B);
    const at = Number(A.total_cost || 0), bt = Number(B.total_cost || 0);
    const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
    const side = (o, items, label, tot) => `
      <div class="cmp-col">
        <div class="cmp-col-head">${esc(label)}<span>${esc(o.quote_no || o.filename || '')}</span></div>
        <div class="cmp-col-date">${esc(o.order_date || '')}</div>
        <table class="cmp-tbl"><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr>
          ${items.length ? items.map(it => `<tr><td>${esc(it.desc)}</td><td>${it.qty}</td><td>${money(it.rate)}</td><td>${money(it.amount)}</td></tr>`).join('')
            : `<tr><td colspan="4" class="cmp-empty">${o.raw_text ? 'Line items not auto-detected (text-only upload)' : 'No items'}</td></tr>`}
          <tr class="cmp-tot"><td colspan="3">TOTAL</td><td>${money(tot)}</td></tr>
        </table>
      </div>`;
    const diff = bt - at;
    const diffPct = at ? ((diff / at) * 100) : 0;
    const body = document.getElementById('cmp-body');
    body.innerHTML = `
      <div class="cmp-wrap">
        ${side(A, ai, 'PREVIOUS', at)}
        ${side(B, bi, 'CURRENT QUOTE', bt)}
      </div>
      <div class="cmp-delta ${diff > 0 ? 'up' : diff < 0 ? 'down' : ''}">
        Difference (Current − Previous): <b>${diff >= 0 ? '+' : ''}${money(diff)}</b>
        ${at ? `<span>(${diff >= 0 ? '+' : ''}${diffPct.toFixed(1)}%)</span>` : ''}
      </div>
      ${A.raw_text ? `<details class="cmp-raw"><summary>Extracted text from “${esc(A.filename || 'PDF')}”</summary><pre>${esc(A.raw_text)}</pre></details>` : ''}`;
    document.getElementById('compare-modal').classList.add('show');
  }

  // -------------------------------------------------- settings / cloud
  function buildSettingsModal() {
    const cfg = DB.getCfg() || {};
    const sql = `-- Run this once in Supabase (SQL editor):
create table if not exists clients (
  id text primary key,
  company_name text, client_name text, phone text, email text,
  gstin text, site_address text, notes text,
  created_at timestamptz default now()
);
create table if not exists orders (
  id text primary key,
  client_id text references clients(id) on delete cascade,
  order_date date, quote_no text, items jsonb,
  total_cost numeric, total_weight numeric, status text,
  created_at timestamptz default now()
);
-- Demo/dev access (tighten later with real auth):
alter table clients enable row level security;
alter table orders  enable row level security;
create policy "anon all clients" on clients for all using (true) with check (true);
create policy "anon all orders"  on orders  for all using (true) with check (true);`;

    const modal = el(`
      <div class="modal-overlay" id="cloud-modal">
        <div class="modal-dialog cloud-modal">
          <div class="modal-header">
            <div class="modal-title-group"><h3>☁ Cloud &amp; Data Settings</h3></div>
            <button class="modal-close-btn" id="cloud-x">&times;</button>
          </div>
          <div class="modal-body">
            <p class="cloud-note"><b>Supabase</b> is the cloud database — clients, orders and all platform data are shared across every device that logs in, and it works offline &amp; syncs when back online. It's pre-configured; you normally don't need to change this. Leave both blank to keep data on this device only.</p>

            <label class="cf-lbl">Supabase Project URL</label>
            <input type="text" id="cloud-url" placeholder="https://xxxx.supabase.co" value="${esc(cfg.url || '')}">
            <label class="cf-lbl">Supabase publishable (anon) key</label>
            <input type="text" id="cloud-key" placeholder="sb_publishable_..." value="${esc(cfg.key || '')}">

            <details class="cloud-sql">
              <summary>One-time Supabase setup (SQL) — already applied to this project</summary>
              <textarea readonly rows="8">${esc(sql)}</textarea>
            </details>

            <div class="cloud-row">
              <button class="cp-btn" id="cloud-test">Test connection</button>
              <button class="cp-btn primary" id="cloud-save">Save</button>
              <button class="cp-btn danger" id="cloud-clear">Use device only</button>
              <span id="cloud-status" class="cloud-status"></span>
            </div>

            <hr>
            <label class="cf-lbl">Import clients from CSV (columns: Company, Contact, Phone, Email, GSTIN, Address)</label>
            <input type="file" id="cloud-import" accept=".csv,text/csv">
            <span id="import-status" class="cloud-status"></span>
          </div>
        </div>
      </div>`);
    document.body.appendChild(modal);

    const collectCfg = () => ({
      url: document.getElementById('cloud-url').value.trim(),
      key: document.getElementById('cloud-key').value.trim()
    });

    modal.querySelector('#cloud-x').addEventListener('click', () => modal.classList.remove('show'));
    modal.querySelector('#cloud-save').addEventListener('click', async () => {
      DB.setCfg(collectCfg());
      refreshCloudBadge();
      setStatus('cloud-status', 'Saved — using ' + DB.backendLabel(), DB.cloudEnabled());
      await init(); // reload clients from the newly-selected backend
    });
    modal.querySelector('#cloud-clear').addEventListener('click', () => {
      DB.setCfg({}); refreshCloudBadge(); setStatus('cloud-status', 'Using this device only', false);
      document.getElementById('cloud-url').value = '';
      document.getElementById('cloud-key').value = '';
    });
    modal.querySelector('#cloud-test').addEventListener('click', async () => {
      DB.setCfg(collectCfg());
      setStatus('cloud-status', 'Testing ' + DB.backendLabel() + '…', null);
      try { await DB.test(); setStatus('cloud-status', '✓ ' + DB.backendLabel() + ' connected', true); }
      catch (e) { setStatus('cloud-status', '✕ ' + e.message, false); }
    });
    modal.querySelector('#cloud-import').addEventListener('change', onImportCsv);
  }

  function openSettings() { document.getElementById('cloud-modal').classList.add('show'); }

  function setStatus(id, msg, ok) {
    const s = document.getElementById(id);
    if (!s) return;
    s.textContent = msg;
    s.style.color = ok === true ? '#16a34a' : ok === false ? '#dc2626' : '#64748b';
  }

  function refreshCloudBadge() {
    const b = document.getElementById('cp-cloud');
    if (!b) return;
    const label = DB.backendLabel();
    if (DB.cloudEnabled()) { b.textContent = '☁ ' + label; b.classList.add('on'); }
    else { b.textContent = '◌ Local'; b.classList.remove('on'); }
  }

  async function onImportCsv(e) {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    const rows = parseCsv(text);
    if (!rows.length) { setStatus('import-status', 'No rows found', false); return; }
    const header = rows[0].map(h => h.toLowerCase());
    const find = (...names) => header.findIndex(h => names.some(n => h.includes(n)));
    const map = {
      company_name: find('company', 'business', 'firm', 'm/s'),
      client_name: find('contact', 'client name', 'person', 'name'),
      phone: find('phone', 'mobile', 'contact no', 'number'),
      email: find('email', 'mail'),
      gstin: find('gst'),
      site_address: find('address', 'site', 'city', 'location')
    };
    const recs = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]; if (!r || !r.join('').trim()) continue;
      const rec = {};
      Object.keys(map).forEach(k => { rec[k] = map[k] >= 0 ? (r[map[k]] || '').trim() : ''; });
      if (rec.company_name || rec.client_name) recs.push(rec);
    }
    setStatus('import-status', 'Importing ' + recs.length + '…', null);
    const n = await DB.importClients(recs);
    clientsCache = await DB.listClients();
    setStatus('import-status', '✓ Imported ' + n + ' clients', true);
  }

  // Minimal CSV parser (handles quoted fields & commas)
  function parseCsv(text) {
    const rows = []; let row = [], cur = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; }
        else if (c === '"') q = false;
        else cur += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(cur); cur = ''; }
        else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
        else if (c === '\r') { /* skip */ }
        else cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(r => r.length);
  }

  // Expose the quote extractors so other apps (Proforma Invoice) can reuse them.
  window.FixoParse = { csv: parseCsvOrder, pdf: parsePdfOrder };

  // -------------------------------------------------- utils
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(m) { (FIXO().toast || console.log)(m); }
})();
