// ============================================================
// Fixotech FACTORY SIDE
// ------------------------------------------------------------
// One store of indent line-items; three tabs (Indents / Product-wise /
// Customer-wise) are VIEWS of the same items, so every update stays in sync.
// Layout: left options-bar + right content. Product & Customer tabs show a
// Kanban board that moves cards through the production stages. Built for the
// floor: big buttons, photo-gated steps (camera or upload).
// ============================================================
(function () {
  const LS = 'fixo_factory_indents';
  const NOTIF = 'fixo_office_notifications';
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();

  let indents = [];
  try { indents = JSON.parse(localStorage.getItem(LS) || '[]') || []; } catch (e) { indents = []; }
  let activeTab = 'indent';
  let fYear = 'all', fMonthNum = 'all', fClient = 'all';
  let selProduct = null, selCustomer = null;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let viewMode = 'kanban';   // kanban | list

  function save() { try { localStorage.setItem(LS, JSON.stringify(indents)); } catch (e) { console.warn('Factory store full'); } }

  // Production pipeline (6 stages). First 4 confirmed by the factory; "Finishing"
  // is a placeholder for stage 5 (pending clarity); last is dispatch-ready.
  // Canonical order (used to lay out Kanban columns) and labels.
  const ALL_STAGES = ['cutting', 'slotting', 'perforation', 'punching', 'bending', 'ready'];
  const STAGES = { cutting: 'Cutting', slotting: 'Slotting', perforation: 'Perforation', punching: 'Punching', bending: 'Bending', ready: 'Ready to Dispatch' };
  // Each PRODUCT has its OWN stage route (from the floor's process sheet):
  //  Raceway → Cutting·Punching·Bending ; Perforated → Cutting·Perforation·Punching·Bending
  //  Ladder → Cutting·Punching·Bending  ; Slotted channel/rail → Cutting·Slotting·Bending
  function stagesFor(desc) {
    const t = norm(desc);
    if (/raceway|race way/.test(t)) return ['cutting', 'punching', 'bending', 'ready'];
    if (/perforat/.test(t)) return ['cutting', 'perforation', 'punching', 'bending', 'ready'];
    if (/ladder/.test(t)) return ['cutting', 'punching', 'bending', 'ready'];
    if (/slotted|channel|\brail\b|slotted rail/.test(t)) return ['cutting', 'slotting', 'bending', 'ready'];
    return ['cutting', 'punching', 'bending', 'ready'];
  }
  function nextStage(s, desc) { const seq = stagesFor(desc); const i = seq.indexOf(s); return i >= 0 && i < seq.length - 1 ? seq[i + 1] : null; }
  function stageOrderFor(desc) { return stagesFor(desc); }

  function categoryOf(desc) { const s = (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.slugFor) ? FIXO_PRODUCT_IMG.slugFor(desc) : ''; return s || 'other'; }
  function prettyCat(slug) {
    if (!slug || slug === 'other') return 'Other';
    return slug.replace('custom-', '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  }
  function finishOf(desc) {
    const t = String(desc || '').toLowerCase();
    if (/hot\s*dip|hdg|\bhd\b/.test(t)) return 'Hot Dip';
    if (/powder/.test(t)) return 'Powder Coated';
    if (/pre\s*galv|\bgi\b|120\s*gsm/.test(t)) return 'GI / Pre-Galv';
    return '';
  }

  // ---- Alert (sound + vibration) for urgent/priority indents ----
  function playAlert() {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) { const c = new AC(); const o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.type = 'square'; o.frequency.value = 880; g.gain.value = 0.08; o.start(); o.frequency.setValueAtTime(660, c.currentTime + 0.15); setTimeout(() => { o.stop(); c.close(); }, 320); }
    } catch (e) {}
    try { if (navigator.vibrate) navigator.vibrate([120, 60, 120]); } catch (e) {}
  }

  // ---- Receive from office ----
  function receiveIndent(rec) {
    const month = (rec.sentAt || new Date().toISOString()).slice(0, 7);
    indents.unshift({
      id: rec.id || 'ind-' + Date.now(),
      refNo: rec.refNo || '', indentNo: rec.indentNo || '001',
      indentDate: rec.indentDate || '', sentAt: rec.sentAt || new Date().toISOString(), month,
      customer: rec.indentCustomer || rec.customer || 'Unnamed',
      indentCustomer: rec.indentCustomer || rec.customer || '', indentNotes: rec.indentNotes || '',
      priority: !!rec.priority,
      customerAddr: rec.customerAddr || '', factoryApproved: false,
      items: (rec.items || []).map((it, i) => ({
        id: it.id || 'it-' + Date.now() + '-' + i,
        sl: it.sl, desc: it.desc || '', qty: it.qty, unit: it.unit || '',
        dealtBy: it.dealtBy || '', deliveryDate: it.deliveryDate || '',
        category: categoryOf(it.desc), finish: finishOf(it.desc),
        status: 'cutting', qtyTotal: num(it.qty), qtyDone: 0,
        photos: {}, weight: '', readyToDispatch: false, seen: false, ts: Date.now()
      }))
    });
    save();
    if (rec.priority) { playAlert(); toast('🚩 URGENT order received — ' + (rec.indentCustomer || rec.customer || '') + ' (top priority)'); }
    else toast('New indent received — ' + (rec.indentCustomer || rec.customer || ''));
    if (document.body.dataset.screen === 'screen-factory') render();
    bumpLauncherBadge();
  }

  // ---- Item helpers (single source of truth) ----
  function allItems() { const o = []; indents.forEach(ind => ind.items.forEach(it => o.push({ it, ind }))); return o; }
  function findItem(id) { return allItems().find(x => x.it.id === id); }
  function updateItem(id, patch) {
    const f = findItem(id); if (!f) return;
    Object.assign(f.it, patch);
    save(); render();
  }
  function matchesPeriod(ind) {
    const y = (ind.month || '').slice(0, 4), mo = (ind.month || '').slice(5, 7);
    return (fYear === 'all' || y === fYear) && (fMonthNum === 'all' || mo === fMonthNum);
  }
  function applyFilters(list) {
    return list.filter(({ ind }) => matchesPeriod(ind) && (fClient === 'all' || ind.customer === fClient));
  }
  function yearsAvailable() { const ys = [...new Set(indents.map(i => (i.month || '').slice(0, 4)).filter(Boolean))]; const cy = String(new Date().getFullYear()); if (!ys.includes(cy)) ys.push(cy); return ys.sort().reverse(); }
  function clientsAvailable() { return [...new Set(indents.map(i => i.customer))].sort(); }
  function monthLabel(m) { if (!m || m === 'all') return 'All months'; const [y, mo] = m.split('-'); return new Date(y, mo - 1, 1).toLocaleString('en-IN', { month: 'short', year: 'numeric' }); }
  function filterLabel() { const y = fYear === 'all' ? 'All years' : fYear; const m = fMonthNum === 'all' ? 'All months' : MONTHS[parseInt(fMonthNum) - 1]; return m + ' · ' + y; }
  function unseen(list) { return list.filter(x => !x.it.seen).length; }

  // Full product catalogue (so every product name is listed, highlighted when it has orders)
  function catalogSlugs() {
    const base = (window.FIXO_PRODUCT_IMG_DATA) ? Object.keys(window.FIXO_PRODUCT_IMG_DATA) : [];
    // Every product the company offers (from the Smart Calculator catalogue).
    let offered = [];
    try { if (typeof PRODUCTS_DB !== 'undefined') offered = Object.values(PRODUCTS_DB).map(p => categoryOf(p.name)); } catch (e) {}
    const inUse = [...new Set(allItems().map(x => x.it.category))];
    return [...new Set([...base, ...offered, ...inUse])].filter(s => s && s !== 'other');
  }

  // ---- Root render: header + tabs + (sidebar | content) ----
  function render() {
    const host = document.getElementById('factory-app'); if (!host) return;
    // Phase 1 testing: the indent reaches here for viewing & printing only —
    // lock the board to the Indents tab (production tabs are Phase 2).
    const testingScope = !!(window.FIXO_TESTING && FIXO_TESTING.isOn());
    if (testingScope) activeTab = 'indent';
    const items = applyFilters(allItems());
    const nc = unseen(items);
    const stat = (n, l, cls) => `<div class="fx-stat ${cls || ''}"><b>${n}</b><span>${l}</span></div>`;
    const logo = (typeof LOGO_IMG !== 'undefined' && LOGO_IMG) ? LOGO_IMG : 'https://fplogoimages.withfloats.com/actual/4787f692897d42598da86c9d05413fc6jpeg';
    const dot = nc ? `<span class="fx-dot" title="${nc} new">${nc}</span>` : '';
    host.innerHTML = `
      <div class="fx-hero">
        <div class="fx-hero-title"><span class="fx-hero-ic">🏭</span><div><h2>Factory Floor</h2><p>Production tracking · ${esc(filterLabel())}</p></div></div>
        <div class="fx-hero-right">
          <div class="fx-stats">
            ${stat(items.length, 'Line items')}
            ${stat(items.filter(x => x.it.status === 'in_production' || x.it.status === 'partial').length, 'In progress', 'amber')}
            ${stat(items.filter(x => x.it.status === 'ready').length, 'Ready', 'green')}
            ${stat(nc, 'New', nc ? 'red' : '')}
          </div>
          <div class="fx-logo-chip"><img src="${logo}" alt="Fixotech" onerror="this.style.display='none'"></div>
        </div>
      </div>
      <div class="fx-tabs">
        <button class="fx-tab ${activeTab === 'indent' ? 'active' : ''}" data-tab="indent">📋 Indents</button>
        ${testingScope ? '' : `<button class="fx-tab ${activeTab === 'product' ? 'active' : ''}" data-tab="product">📦 Product-wise ${dot}</button>
        <button class="fx-tab ${activeTab === 'customer' ? 'active' : ''}" data-tab="customer">👤 Customer-wise ${dot}</button>
        <button class="fx-tab ${activeTab === 'inventory' ? 'active' : ''}" data-tab="inventory">📦 Inventory</button>
        <button class="fx-sheet-btn" id="fx-upload-sheet" title="Can't use the app? Photograph the floor work-sheet">📄 Upload floor sheet</button>`}
      </div>
      <div class="fx-layout" id="fx-layout"></div>`;
    host.querySelectorAll('.fx-tab').forEach(t => t.onclick = () => { activeTab = t.dataset.tab; render(); });
    const sheetBtn = host.querySelector('#fx-upload-sheet');
    if (sheetBtn) sheetBtn.onclick = uploadFloorSheet;
    const layout = document.getElementById('fx-layout');
    if (activeTab === 'indent') renderIndentTab(layout, items);
    else if (activeTab === 'product') renderProductTab(layout, items);
    else if (activeTab === 'inventory') renderInventoryTab(layout);
    else renderCustomerTab(layout, items);
  }

  function filterControls() {
    return `<div class="fx-period">
        <div class="fx-side-sec"><label class="fx-side-lab">Year</label>
          <select id="fx-year"><option value="all">All years</option>${yearsAvailable().map(y => `<option value="${y}" ${y === fYear ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
        <div class="fx-side-sec"><label class="fx-side-lab">Month</label>
          <select id="fx-monthnum"><option value="all">All months</option>${MONTHS.map((nm, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}" ${v === fMonthNum ? 'selected' : ''}>${nm}</option>`; }).join('')}</select></div>
      </div>
      <div class="fx-side-sec"><label class="fx-side-lab">Customer</label>
        <select id="fx-client"><option value="all">All customers</option>${clientsAvailable().map(c => `<option value="${esc(c)}" ${c === fClient ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>`;
  }
  function wireFilters(root) {
    const y = root.querySelector('#fx-year'); if (y) y.onchange = e => { fYear = e.target.value; render(); };
    const mo = root.querySelector('#fx-monthnum'); if (mo) mo.onchange = e => { fMonthNum = e.target.value; render(); };
    const cl = root.querySelector('#fx-client'); if (cl) cl.onchange = e => { fClient = e.target.value; render(); };
  }

  // ============ INDENT TAB ============
  function renderIndentTab(layout, items) {
    const inds = applyFilters(allItems()).reduce((a, x) => { (a[x.ind.id] = a[x.ind.id] || { ind: x.ind, items: [] }).items.push(x.it); return a; }, {});
    const list = Object.values(inds).sort((a, b) => (b.ind.priority ? 1 : 0) - (a.ind.priority ? 1 : 0));  // urgent first
    layout.innerHTML = `
      <aside class="fx-sidebar"><div class="fx-side-title">Filters</div>${filterControls()}
        <div class="fx-side-hint">The <b>white copy</b> stays here (office). The <b>yellow copy</b> prints for the factory. Approve to notify the office.</div>
      </aside>
      <section class="fx-main">${list.length ? `<div class="fx-cards">${list.map(indentCard).join('')}</div>` : emptyState('No indents yet', 'Approved indents from the office land here.')}</section>`;
    wireFilters(layout);
    layout.querySelectorAll('[data-print]').forEach(b => b.onclick = () => printIndent(b.dataset.print, b.dataset.copy));
    layout.querySelectorAll('[data-approve]').forEach(b => b.onclick = () => approveIndent(b.dataset.approve));
    layout.querySelectorAll('[data-disp]').forEach(ch => ch.onchange = () => {
      const f = findItem(ch.dataset.disp); if (!f) return;
      if (!ch.checked && f.it.readyToDispatch) { undoDispatch(ch.dataset.disp); return; }   // undo needs a reason
      updateItem(ch.dataset.disp, { readyToDispatch: ch.checked, status: ch.checked ? 'ready' : f.it.status, qtyDone: ch.checked ? (f.it.qtyDone || f.it.qtyTotal) : f.it.qtyDone });
    });
    layout.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => openDetail(b.dataset.detail));
    layout.querySelectorAll('[data-wt]').forEach(inp => inp.onchange = () => updateItem(inp.dataset.wt, { weight: inp.value }));
    layout.querySelectorAll('[data-prio]').forEach(b => b.onclick = () => togglePriority(b.dataset.prio));
    layout.querySelectorAll('[data-plan]').forEach(b => b.onclick = () => openProductionPlan(b.dataset.plan));
  }
  function togglePriority(indId) {
    const ind = indents.find(i => i.id === indId); if (!ind) return;
    ind.priority = !ind.priority; save();
    if (ind.priority) { playAlert(); notifyOffice({ type: 'priority_set', indentNo: ind.indentNo, customer: ind.customer, reason: 'Marked URGENT on the floor', at: new Date().toISOString() }); toast('Marked URGENT — pinned to top'); }
    else toast('Priority cleared');
    render();
  }
  // ---- Production Plan (editable + printable, with operator names) ----
  function openProductionPlan(indId) {
    const ind = indents.find(i => i.id === indId); if (!ind) return;
    const seqRows = ind.items.map((it, i) => {
      const stages = stagesFor(it.desc);
      return stages.filter(s => s !== 'ready').map(s => `<tr><td>${esc(it.desc.split('\n')[0]).slice(0, 30)}</td><td>${STAGES[s]}</td><td class="c">${esc(it.qty)} ${esc(it.unit)}</td><td class="c"></td><td><input class="pp-op" placeholder="Operator"></td></tr>`).join('');
    }).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Production Plan</title><style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact}@page{size:A4;margin:10mm}html,body{background:#fff}
      body{font-family:Arial,sans-serif;color:#000;font-size:12px;padding:6mm}
      .wrap{border:2px solid #000;padding:10px}.hd{text-align:center;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
      .hd b{font-size:18px}.top{display:flex;justify-content:space-between;font-weight:bold;margin:6px 0}
      table{width:100%;border-collapse:collapse}th,td{border:1px solid #000;padding:5px 6px;font-size:11px}.c{text-align:center}
      th{background:#eee}.pp-op{width:100%;border:none;font-size:11px}</style></head>
      <body><div class="wrap layer" contenteditable="true">
        <div class="hd"><b>FIXOTECH — PRODUCTION PLAN</b><div>PROD/R/03</div></div>
        <div class="top"><span>Customer: ${esc(ind.customer)}</span><span>Indent No: ${esc(ind.indentNo)}</span><span>Date: ${esc(ind.indentDate || new Date().toLocaleDateString('en-IN'))}</span></div>
        <table><thead><tr><th>Part / Description</th><th>Process</th><th class="c">Planned Qty</th><th class="c">Achieved</th><th>Operator Name</th></tr></thead>
        <tbody>${seqRows}</tbody></table>
        <div class="top" style="margin-top:24px"><span>Prepared by</span><span>Checked by</span><span>Approved by</span></div>
      </div></body></html>`;
    openPrintEditor(html, 'Production Plan — ' + ind.customer);
  }
  function indentCard(g) {
    const appr = g.ind.factoryApproved, pr = g.ind.priority;
    return `<div class="fx-card ${pr ? 'fx-priority' : ''}">
      <div class="fx-card-top">
        <div><b class="fx-cust">${pr ? '<span class="fx-prio-tag">🚩 URGENT</span> ' : ''}${esc(g.ind.customer)}</b><span class="fx-meta">No. ${esc(g.ind.indentNo)} · ${esc(g.ind.indentDate || monthLabel(g.ind.month))} · ${g.items.length} line(s)</span></div>
        <div class="fx-card-btns">
          <button class="fx-btn ${pr ? 'fx-btn-undo' : ''}" data-prio="${g.ind.id}" title="Mark/clear urgent">${pr ? '🚩 Urgent' : '⚐ Mark urgent'}</button>
          ${appr ? `<span class="fx-approved">✓ Approved · office notified</span>` : `<button class="fx-btn fx-btn-go" data-approve="${g.ind.id}">✓ Approve &amp; notify office</button>`}
          <button class="fx-btn fx-print" data-print="${g.ind.id}" data-copy="yellow">🖨 Yellow copy</button>
          <button class="fx-btn" data-print="${g.ind.id}" data-copy="white">🖨 White copy</button>
          <button class="fx-btn" data-plan="${g.ind.id}">🗒 Production plan</button>
        </div>
      </div>
      <table class="fx-tbl">
        <thead><tr><th>Sl</th><th>Description</th><th>Qty</th><th>UOM</th><th>Status</th><th>✓ Dispatch</th><th>Weight (kg)</th></tr></thead>
        <tbody>${g.items.map(indentRow).join('')}</tbody>
      </table>
    </div>`;
  }
  function indentRow(it) {
    const rem = it.qtyTotal - it.qtyDone;
    return `<tr>
      <td class="c">${esc(it.sl != null ? it.sl : '')}</td>
      <td><span class="fx-link" data-detail="${it.id}">${esc(shortName(it.desc))}</span>${it.finish ? `<span class="fx-fin">${esc(it.finish)}</span>` : ''}</td>
      <td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td>
      <td class="c"><span class="fx-status ${'fx-st-' + it.status}">${STAGES[it.status]}</span>${it.qtyDone && rem > 0 ? `<span class="fx-rem">${rem} left</span>` : ''}</td>
      <td class="c"><input type="checkbox" class="fx-disp" data-disp="${it.id}" ${it.readyToDispatch ? 'checked' : ''}></td>
      <td class="c"><input class="fx-wt" data-wt="${it.id}" value="${esc(it.weight)}" placeholder="—"></td>
    </tr>`;
  }

  // ============ PRODUCT-WISE TAB ============
  function renderProductTab(layout, items) {
    const byCat = {}; items.forEach(x => { (byCat[x.it.category] = byCat[x.it.category] || []).push(x); });
    let slugs = catalogSlugs();
    // sort: products with unseen first, then with any order, then the rest — alphabetical within
    slugs.sort((a, b) => {
      const ua = unseen(byCat[a] || []), ub = unseen(byCat[b] || []);
      const oa = (byCat[a] || []).length, ob = (byCat[b] || []).length;
      if (!!ub - !!ua) return !!ub - !!ua;
      if (!!ob - !!oa) return !!ob - !!oa;
      return prettyCat(a).localeCompare(prettyCat(b));
    });
    if (!selProduct || !slugs.includes(selProduct)) selProduct = slugs.find(s => (byCat[s] || []).length) || slugs[0] || null;
    const sideItems = slugs.map(s => {
      const g = byCat[s] || []; const nu = unseen(g);
      return `<button class="fx-side-item ${s === selProduct ? 'active' : ''} ${g.length ? 'has' : 'empty'} ${nu ? 'new' : ''}" data-prod="${esc(s)}">
        ${imgTag(g[0] ? g[0].it.desc : s)}<span class="fx-side-name">${esc(prettyCat(s))}</span>
        ${g.length ? `<span class="fx-count">${g.length}</span>` : ''}${nu ? `<span class="fx-side-new" title="${nu} new order(s)">${nu}</span>` : ''}</button>`;
    }).join('');
    layout.innerHTML = `
      <aside class="fx-sidebar">
        <div class="fx-side-title">Filters</div>${filterControls()}
        <div class="fx-side-title">Products</div>
        <div class="fx-side-list">${sideItems}</div>
      </aside>
      <section class="fx-main">${mainForGroup(byCat[selProduct] || [], prettyCat(selProduct), 'product')}</section>`;
    wireFilters(layout);
    layout.querySelectorAll('[data-prod]').forEach(b => b.onclick = () => { selProduct = b.dataset.prod; render(); });
    wireMain(layout, byCat[selProduct] || []);
  }

  // ============ CUSTOMER-WISE TAB ============
  function renderCustomerTab(layout, items) {
    const byCust = {}; items.forEach(x => { (byCust[x.ind.customer] = byCust[x.ind.customer] || []).push(x); });
    let custs = Object.keys(byCust).sort((a, b) => { const d = !!unseen(byCust[b]) - !!unseen(byCust[a]); return d || a.localeCompare(b); });
    if (!selCustomer || !custs.includes(selCustomer)) selCustomer = custs[0] || null;
    const sideItems = custs.map(c => {
      const g = byCust[c]; const nu = unseen(g);
      return `<button class="fx-side-item ${c === selCustomer ? 'active' : ''} has ${nu ? 'new' : ''}" data-cust="${esc(c)}">
        <span class="fx-side-ic">👤</span><span class="fx-side-name">${esc(c)}</span>
        <span class="fx-count">${g.length}</span>${nu ? `<span class="fx-side-new" title="${nu} new order(s)">${nu}</span>` : ''}</button>`;
    }).join('');
    layout.innerHTML = `
      <aside class="fx-sidebar">
        <div class="fx-side-title">Filters</div>${filterControls()}
        <div class="fx-side-title">Customers</div>
        <div class="fx-side-list">${sideItems || '<div class="fx-side-empty">No customers yet</div>'}</div>
      </aside>
      <section class="fx-main">${selCustomer ? mainForGroup(byCust[selCustomer] || [], selCustomer, 'customer') : emptyState('No customers yet', 'Received indents will list customers here.')}</section>`;
    wireFilters(layout);
    layout.querySelectorAll('[data-cust]').forEach(b => b.onclick = () => { selCustomer = b.dataset.cust; render(); });
    wireMain(layout, byCust[selCustomer] || []);
  }

  // ============ INVENTORY TAB (live view of the Inventory Management app) ============
  // Reads the same factory stock register (Receipt/Issue/Balance) shown in the
  // full Inventory app, so the floor sees current balances without leaving here.
  let invTabType = 'accessory', invTabQ = '';
  function renderInventoryTab(layout) {
    const INV = window.FIXO_INVENTORY;
    if (!INV || !INV.loadStock) { layout.innerHTML = `<section class="fx-main">${emptyState('Inventory not loaded', 'Open the Inventory app from the Factory home.')}</section>`; return; }
    const all = INV.loadStock();
    const acc = all.filter(i => i.type === 'accessory'), prod = all.filter(i => i.type === 'production');
    const shown = invTabType === 'production' ? prod : invTabType === 'all' ? all : acc;
    const ql = invTabQ.trim().toLowerCase();
    const list = (ql ? shown.filter(i => i.name.toLowerCase().includes(ql)) : shown).slice().sort((a, b) => a.name.localeCompare(b.name));
    const rows = list.length ? list.map(it => {
      const bal = INV.balanceOf(it), st = INV.statusOf(it);
      const badge = st === 'short' ? '<span class="fx-prio-tag">⚠ OUT</span>' : st === 'low' ? '<span class="inv-low">LOW</span>' : '<span class="fx-fi-ok">✓ OK</span>';
      return `<tr><td><b>${esc(it.name)}</b></td><td class="c">${esc(it.unit)}</td><td class="c"><b class="${bal <= 0 ? 'inv-neg' : 'inv-ok'}">${bal}</b></td><td class="c">${badge}</td></tr>`;
    }).join('') : `<tr><td colspan="4" class="c fx-meta" style="padding:20px">${ql ? 'No match.' : 'No materials.'}</td></tr>`;
    layout.innerHTML = `
      <aside class="fx-sidebar"><div class="fx-side-title">Stock register</div>
        <div class="fx-side-hint">Live balances from the factory <b>Stock Register</b> (Receipt / Issue / Balance). Accessories = extras placed with orders; Production = materials & consumables used in fabrication.</div>
        <button class="fx-btn fx-btn-go" id="fx-inv-open" style="margin-top:10px;width:100%">📦 Open Inventory app</button>
      </aside>
      <section class="fx-main">
        <div class="fx-main-head"><h3 class="fx-main-title">Inventory — stock balances</h3>
          <div class="fx-head-actions">
            <button class="fx-btn fx-sheet-btn2" id="fx-inv-print" title="Print this stock summary">🖨 Print</button>
            <div class="fx-view-toggle">
              <button class="fx-vt ${invTabType === 'accessory' ? 'active' : ''}" data-invt="accessory">Accessories</button>
              <button class="fx-vt ${invTabType === 'production' ? 'active' : ''}" data-invt="production">Production</button>
              <button class="fx-vt ${invTabType === 'all' ? 'active' : ''}" data-invt="all">All</button>
            </div>
          </div>
        </div>
        <input class="fx-in" id="fx-inv-search" placeholder="🔎 Search material…" value="${esc(invTabQ)}" style="margin-bottom:10px;max-width:320px">
        <div class="fx-card"><table class="fx-tbl"><thead><tr><th>Material</th><th>Unit</th><th>Balance</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      </section>`;
    layout.querySelectorAll('[data-invt]').forEach(b => b.onclick = () => { invTabType = b.dataset.invt; render(); });
    const se = layout.querySelector('#fx-inv-search');
    if (se) se.oninput = () => { invTabQ = se.value; renderInventoryTab(layout); const n = layout.querySelector('#fx-inv-search'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
    const open = layout.querySelector('#fx-inv-open');
    if (open) open.onclick = () => { showScreen('screen-inventory'); INV.render(); };
    const pr = layout.querySelector('#fx-inv-print');
    if (pr && INV.printSummary) pr.onclick = () => INV.printSummary(list, invTabType === 'accessory' ? 'Accessories' : invTabType === 'production' ? 'Production Materials' : 'All Materials');
  }

  // ---- Main panel: header + List/Kanban toggle + body ----
  function mainForGroup(group, title, kind) {
    if (!group.length) return emptyState('Nothing here yet', 'Select an item on the left, or wait for new orders.');
    markSeenSoon(group);
    return `<div class="fx-main-head">
        <div><h3 class="fx-main-title">${esc(title)}</h3><span class="fx-meta">${group.length} line(s) · ${totalQty(group)}</span></div>
        <div class="fx-head-actions">
          <button class="fx-btn fx-sheet-btn2" data-sheet="${esc(kind)}" data-title="${esc(title)}" title="Photograph the planning / inspection sheet — data is read into the board">📷 Upload sheet</button>
          <div class="fx-view-toggle"><button class="fx-vt ${viewMode === 'kanban' ? 'active' : ''}" data-view="kanban">▦ Kanban</button><button class="fx-vt ${viewMode === 'list' ? 'active' : ''}" data-view="list">☰ List</button></div>
        </div>
      </div>
      ${viewMode === 'kanban' ? kanban(group, kind) : listView(group, kind)}`;
  }
  function wireMain(layout, group) {
    layout.querySelectorAll('[data-sheet]').forEach(b => b.onclick = (e) => { e.stopPropagation(); uploadGroupSheet(b.dataset.sheet, b.dataset.title, group); });
    layout.querySelectorAll('[data-view]').forEach(b => b.onclick = (e) => { e.stopPropagation(); viewMode = b.dataset.view; render(); });
    layout.querySelectorAll('[data-advance]').forEach(b => b.onclick = (e) => { e.stopPropagation(); advance(b.dataset.advance); });
    layout.querySelectorAll('[data-photos]').forEach(b => b.onclick = (e) => { e.stopPropagation(); viewPhotos(b.dataset.photos); });
    layout.querySelectorAll('[data-undo]').forEach(b => b.onclick = (e) => { e.stopPropagation(); undoDispatch(b.dataset.undo); });
    layout.querySelectorAll('[data-back]').forEach(b => b.onclick = (e) => { e.stopPropagation(); stepBack(b.dataset.back); });
    // Whole widget opens details (buttons above stop propagation).
    layout.querySelectorAll('[data-detail]').forEach(b => b.onclick = () => openDetail(b.dataset.detail));
    // Drag-and-drop between Kanban columns (drop triggers the verification photo).
    let dragId = null;
    layout.querySelectorAll('.fx-kcard[data-item]').forEach(c => {
      c.addEventListener('dragstart', e => { dragId = c.dataset.item; e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch (er) {} c.classList.add('fx-dragging'); });
      c.addEventListener('dragend', () => { dragId = null; c.classList.remove('fx-dragging'); });
    });
    layout.querySelectorAll('.fx-kcol[data-stage]').forEach(col => {
      col.addEventListener('dragover', e => { e.preventDefault(); col.classList.add('fx-drop'); });
      col.addEventListener('dragleave', () => col.classList.remove('fx-drop'));
      col.addEventListener('drop', e => { e.preventDefault(); col.classList.remove('fx-drop'); const id = dragId || (e.dataTransfer && e.dataTransfer.getData('text/plain')); if (id) moveToStage(id, col.dataset.stage); });
    });
  }

  // ---- Floor in-charge: photograph the paper work-sheet (for staff who can't
  // use the app). Stored now; auto-mapping (reading the sheet) comes once the
  // sheet format image is provided. ----
  // Pick which sheet, then photograph/upload it. Handles BOTH floor sheets:
  // the Production Plan and the Setup & In-process Inspection Report.
  function uploadFloorSheet() {
    const m = modal(`<h3>Upload floor sheet</h3>
      <div class="fx-modal-body"><p class="fx-note">Which sheet are you uploading? Photograph it or pick from gallery — it's saved and sent to the office.</p>
        <div class="fx-sheet-pick">
          <button class="fx-btn fx-btn-go" data-kind="Production Plan">🗒 Production Plan</button>
          <button class="fx-btn fx-btn-go" data-kind="Setup & Inspection Report">📋 Setup &amp; Inspection Report</button>
          <button class="fx-btn" data-kind="Other work-sheet">📄 Other work-sheet</button>
        </div></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-sheet-cancel">Cancel</button></div>`);
    m.querySelector('#fx-sheet-cancel').onclick = () => closeModal(m);
    m.querySelectorAll('[data-kind]').forEach(b => b.onclick = () => { const kind = b.dataset.kind; closeModal(m); captureSheet(kind); });
  }
  function captureSheet(kind) {
    capturePhoto('Photograph the ' + kind, (dataUrl) => {
      let sheets = []; try { sheets = JSON.parse(localStorage.getItem('fixo_floor_sheets') || '[]'); } catch (e) {}
      sheets.unshift({ id: 's' + Date.now(), kind, at: new Date().toISOString(), img: dataUrl });
      try { localStorage.setItem('fixo_floor_sheets', JSON.stringify(sheets.slice(0, 80))); } catch (e) {}
      notifyOffice({ type: 'floor_sheet', reason: kind + ' uploaded from the floor', customer: '', indentNo: '', at: new Date().toISOString() });
      modal(`<h3>${esc(kind)} uploaded ✓</h3>
        <div class="fx-modal-body"><img src="${dataUrl}" style="max-width:100%;border-radius:10px;border:1px solid #e2e8f0">
        <p class="fx-note">Saved to the floor log and the office is notified. Once the standard sheet format is finalised, the system will <b>auto-read</b> the quantities & products from the photo and update the board automatically.</p></div>
        <div class="fx-modal-actions"><button class="fx-btn fx-btn-go" onclick="this.closest('.fx-modal-overlay').remove()">Done</button></div>`);
      toast(kind + ' saved & sent to office');
    });
  }

  // ---- Photograph a planning/inspection sheet FOR A SPECIFIC customer/product
  // group, then read its numbers straight into the board. The floor confirms the
  // metres/quantity per line against the photo (human-verified extraction). If an
  // OCR engine (window.Tesseract) is present it pre-reads the sheet to pre-fill. ----
  function uploadGroupSheet(kind, title, group) {
    if (!group || !group.length) { toast('Nothing here to update'); return; }
    capturePhoto('Photograph the ' + (kind === 'customer' ? 'customer' : 'product') + ' work-sheet — ' + title, (dataUrl) => {
      // Save to the floor log (with the customer/product it belongs to).
      let sheets = []; try { sheets = JSON.parse(localStorage.getItem('fixo_floor_sheets') || '[]'); } catch (e) {}
      sheets.unshift({ id: 's' + Date.now(), kind: (kind === 'customer' ? 'Customer sheet' : 'Product sheet') + ' — ' + title, at: new Date().toISOString(), img: dataUrl });
      try { localStorage.setItem('fixo_floor_sheets', JSON.stringify(sheets.slice(0, 80))); } catch (e) {}
      notifyOffice({ type: 'floor_sheet', reason: (kind === 'customer' ? 'Customer' : 'Product') + ' sheet uploaded — ' + title, customer: kind === 'customer' ? title : '', indentNo: '', at: new Date().toISOString() });
      tryOcr(dataUrl, (text) => showExtractReview(dataUrl, title, group, text));
    });
  }

  // Best-effort OCR: use Tesseract.js if it's been bundled; otherwise skip
  // straight to manual-confirm (works fully offline either way).
  function tryOcr(dataUrl, cb) {
    if (!window.Tesseract || !Tesseract.recognize) { cb(''); return; }
    const m = modal(`<h3>Reading the sheet…</h3><div class="fx-modal-body"><p class="fx-note">Extracting text from the photo — one moment.</p><div class="fx-prog-bar"><div class="fx-prog-fill" id="fx-ocr-bar" style="width:8%"></div></div></div>`);
    Tesseract.recognize(dataUrl, 'eng', { logger: p => { const b = document.getElementById('fx-ocr-bar'); if (b && p.progress) b.style.width = Math.round(p.progress * 100) + '%'; } })
      .then(r => { closeModal(m); cb((r && r.data && r.data.text) || ''); })
      .catch(() => { closeModal(m); cb(''); });
  }

  // Pull the biggest metre number that appears near a product name in OCR text.
  function guessMetres(ocrText, desc) {
    if (!ocrText) return '';
    const key = shortName(desc).split(/\s+/).filter(w => w.length > 3)[0];
    if (!key) return '';
    const lines = ocrText.split(/\n+/);
    for (const ln of lines) {
      if (norm(ln).includes(norm(key))) {
        const nums = (ln.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(n => n > 0 && n < 100000);
        if (nums.length) return Math.max.apply(null, nums);
      }
    }
    return '';
  }

  function showExtractReview(dataUrl, title, group, ocrText) {
    const rows = group.map(x => {
      const it = x.it, isLin = /mtr|meter/i.test(it.unit) || /tray|raceway|channel|ladder|rod/i.test(it.desc);
      const pre = isLin ? guessMetres(ocrText, it.desc) : '';
      return `<tr data-row="${it.id}">
        <td>${esc(shortName(it.desc))}${it.finish ? `<span class="fx-fin">${esc(it.finish)}</span>` : ''}<div class="fx-meta">Ordered ${esc(it.qtyTotal)} ${esc(it.unit)}</div></td>
        <td class="c">${isLin ? `<input class="fx-wt fx-ex-mtr" data-id="${it.id}" data-unit="${esc(it.unit)}" type="number" min="0" step="0.5" value="${esc(pre)}" placeholder="m">` : '<span class="fx-meta">—</span>'}</td>
        <td class="c"><input class="fx-wt fx-ex-nos" data-id="${it.id}" type="number" min="0" value="${esc(it.qtyDone || '')}" placeholder="Nos"></td>
        <td class="c fx-ex-out" data-out="${it.id}"></td>
      </tr>`;
    }).join('');
    const m = modal(`<h3>Read sheet into the board — ${esc(title)}</h3>
      <div class="fx-extract">
        <div class="fx-extract-img"><img src="${dataUrl}"><p class="fx-note">${ocrText ? 'Text was auto-read and pre-filled below — check it against the photo.' : 'Enter what the sheet shows for each line. Metres auto-convert to quantity (1 pc = 2.5 m).'}</p></div>
        <div class="fx-extract-tbl"><table class="fx-tbl"><thead><tr><th>Product</th><th>Metres done</th><th>Qty (Nos)</th><th>→ result</th></tr></thead><tbody>${rows}</tbody></table></div>
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-ex-cancel">Cancel</button><button class="fx-btn fx-btn-go" id="fx-ex-apply">✓ Apply to board</button></div>`, 'fx-extract-modal');
    const recalc = (id) => {
      const mtr = m.querySelector(`.fx-ex-mtr[data-id="${id}"]`), nos = m.querySelector(`.fx-ex-nos[data-id="${id}"]`), out = m.querySelector(`[data-out="${id}"]`);
      const f = findItem(id); if (!f) return; const unit = f.it.unit;
      if (mtr && mtr.value !== '') { const mv = num(mtr.value); const n = /mtr|meter/i.test(unit) ? mv : Math.round(mv / 2.5 * 100) / 100; if (nos) nos.value = Math.min(f.it.qtyTotal, n); }
      if (out) { const done = nos ? num(nos.value) : 0; const left = f.it.qtyTotal - done; out.innerHTML = done ? `<b>${done}</b>/${f.it.qtyTotal}${left > 0 ? ` <span class="fx-rem">(${left} left)</span>` : ' ✓'}` : ''; }
    };
    m.querySelectorAll('.fx-ex-mtr').forEach(i => i.oninput = () => recalc(i.dataset.id));
    m.querySelectorAll('.fx-ex-nos').forEach(i => i.oninput = () => recalc(i.dataset.id));
    group.forEach(x => recalc(x.it.id));
    m.querySelector('#fx-ex-cancel').onclick = () => closeModal(m);
    m.querySelector('#fx-ex-apply').onclick = () => {
      let changed = 0;
      group.forEach(x => {
        const id = x.it.id, nosEl = m.querySelector(`.fx-ex-nos[data-id="${id}"]`), mtrEl = m.querySelector(`.fx-ex-mtr[data-id="${id}"]`);
        if (!nosEl || nosEl.value === '') return;
        const f = findItem(id); if (!f) return;
        const done = Math.max(0, Math.min(f.it.qtyTotal, num(nosEl.value)));
        const patch = { qtyDone: done, metersDone: mtrEl ? num(mtrEl.value) : f.it.metersDone };
        patch.status = done >= f.it.qtyTotal ? 'ready' : done > 0 ? 'partial' : f.it.status;
        if (done >= f.it.qtyTotal) patch.readyToDispatch = true;
        f.it.photos['Sheet — ' + new Date().toLocaleDateString('en-IN')] = dataUrl;
        Object.assign(f.it, patch); changed++;
      });
      save(); closeModal(m); render();
      toast(changed ? ('Sheet applied — ' + changed + ' line(s) updated') : 'Nothing to apply');
    };
  }

  // ---- Inventory link inside the order detail (pull material from stock) ----
  function renderInvSection(m, ind, it) {
    const sec = m.querySelector('#fx-inv-sec'); if (!sec) return;
    const INV = window.FIXO_INVENTORY;
    if (!INV) { sec.innerHTML = '<p class="fx-note">Inventory app not loaded.</p>'; return; }
    const used = INV.usageForOrder(ind.indentNo, it.desc);
    const rows = used.length ? `<table class="fx-tbl" style="margin:6px 0"><tbody>${used.map(u => {
      const stock = INV.loadStock().find(s => s.id === u.itemId); const left = stock ? INV.availableOf(stock) : '—';
      return `<tr><td><b>${esc(u.itemName)}</b></td><td class="c">${u.qty} ${esc(u.unit || '')} used</td><td class="c fx-meta">${stock ? left + ' left in stock' : ''}</td></tr>`;
    }).join('')}</tbody></table>` : '<p class="fx-note">No material pulled from inventory for this line yet.</p>';
    sec.innerHTML = rows + `<button class="fx-btn fx-btn-go" id="fx-inv-link" style="margin-top:4px">🔗 Use from inventory</button>`;
    sec.querySelector('#fx-inv-link').onclick = () => INV.openLink(
      { indentNo: ind.indentNo, customer: ind.customer, desc: it.desc, suggestQty: it.qtyTotal },
      () => renderInvSection(m, ind, it)   // refresh after the link modal closes
    );
  }

  // ---- Order detail popup (specs + finish + photos + product picture) ----
  function detRow(l, v) { return `<div class="fx-det-row"><span>${l}</span><b>${v}</b></div>`; }
  function openDetail(id) {
    const f = findItem(id); if (!f) return; const it = f.it, ind = f.ind;
    const catImg = (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.guessUrl) ? FIXO_PRODUCT_IMG.guessUrl(it.desc) : '';
    const specs = specDims(it.desc), rem = it.qtyTotal - it.qtyDone, photos = Object.keys(it.photos);
    const m = modal(`
      <div class="fx-det-head">
        ${catImg ? `<img class="fx-det-img" src="${catImg}" onerror="this.style.display='none'">` : ''}
        <div><h3 style="margin:0 0 4px">${esc(shortName(it.desc))}</h3>
          <div class="fx-det-cust">👤 ${esc(ind.customer)} · Indent No. ${esc(ind.indentNo)}${ind.indentDate ? ' · ' + esc(ind.indentDate) : ''}</div>
          <span class="fx-status fx-st-${it.status}">${STAGES[it.status]}</span></div>
      </div>
      <div class="fx-det-grid">
        ${it.finish ? detRow('Finish', esc(it.finish)) : ''}
        ${detRow('Route', stagesFor(it.desc).map(s => STAGES[s]).slice(0, -1).join(' → '))}
        ${specs.map(s => detRow(s[0], esc(s[1]))).join('')}
        ${detRow('Quantity', esc(it.qty) + ' ' + esc(it.unit))}
        ${/mtr|meter/i.test(it.unit) ? detRow('Development qty', '<b>' + (Math.round((num(it.qty) / 2.5) * 100) / 100) + ' Nos</b> <span class="ciq-dim">(mtr ÷ 2.5)</span>') : ''}
        ${it.qtyDone ? detRow('Completed', it.qtyDone + ' / ' + it.qtyTotal + (rem > 0 ? ' <span class="fx-rem">(' + rem + ' left)</span>' : '')) : ''}
        ${it.weight ? detRow('Weight', esc(it.weight) + ' kg') : ''}
        ${it.dealtBy ? detRow('Dealt by', esc(it.dealtBy)) : ''}
        ${it.deliveryDate ? detRow('Delivery date', esc(it.deliveryDate)) : ''}
        ${detRow('Ready to dispatch', it.readyToDispatch ? '✓ Yes' : 'No')}
      </div>
      <div class="fx-det-label">Production progress — this product</div>
      <div class="fx-prog">
        <div class="fx-prog-top"><span>Ordered <b>${esc(it.qtyTotal)} ${esc(it.unit)}</b></span><span id="fx-prog-summary"></span></div>
        <div class="fx-prog-bar"><div class="fx-prog-fill" id="fx-prog-fill"></div></div>
        ${(/mtr|meter/i.test(it.unit) || /tray|raceway|channel|ladder|rod/i.test(it.desc)) ? `
        <label class="fx-lab">📏 Metres completed <span class="ciq-dim">(type metres — it becomes quantity: 1 pc = 2.5 m)</span></label>
        <input class="fx-in fx-in-mtr" id="fx-prog-mtr" type="number" min="0" step="0.5" inputmode="decimal" placeholder="e.g. 100 metres" value="${esc(it.metersDone || '')}">
        <div class="fx-mtr-conv" id="fx-mtr-conv"></div>` : ''}
        <label class="fx-lab">Completed so far (${esc(it.unit)})</label>
        <input class="fx-in" id="fx-prog-done" type="number" min="0" max="${esc(it.qtyTotal)}" value="${esc(it.qtyDone || 0)}">
        <label class="fx-lab">Material used — verify${it.finish ? ' (ordered: ' + esc(it.finish) + ')' : ''}</label>
        <input class="fx-in" id="fx-prog-mat" value="${esc(it.materialUsed || it.finish || '')}" placeholder="e.g. MS Hot Dip">
        <p class="fx-note" id="fx-prog-note"></p>
      </div>
      ${String(it.desc).indexOf('\n') >= 0 ? `<div class="fx-det-label">Full description</div><div class="fx-det-full">${esc(it.desc).replace(/\n/g, '<br>')}</div>` : ''}
      ${photos.length ? `<div class="fx-det-label">Progress photos</div><div class="fx-photo-grid">${photos.map(k => `<figure><img src="${it.photos[k]}"><figcaption>${esc(k)}</figcaption></figure>`).join('')}</div>` : ''}
      ${/powder/i.test(it.finish || '') ? `<div class="fx-det-label">Powder coating</div><div class="fx-prog"><p class="fx-note">Colour not specified? Ask the office to confirm before coating.</p><button class="fx-btn" id="fx-pc-ask" style="margin-top:6px">📩 Ask office — powder-coat colour</button></div>` : ''}
      <div class="fx-det-label">Inventory / material used</div>
      <div class="fx-prog" id="fx-inv-sec"></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-det-close">Close</button><button class="fx-btn fx-btn-go" id="fx-det-save">Save progress</button></div>`, 'fx-det-modal');
    renderInvSection(m, ind, it);
    const pcAsk = m.querySelector('#fx-pc-ask');
    if (pcAsk) pcAsk.onclick = () => { notifyOffice({ type: 'powdercoat_query', indentNo: ind.indentNo, customer: ind.customer, desc: it.desc, reason: 'Factory asks: what powder-coat colour for this item?', at: new Date().toISOString() }); toast('Sent to office — awaiting colour'); closeModal(m); };
    const doneInp = m.querySelector('#fx-prog-done'), matInp = m.querySelector('#fx-prog-mat');
    const mtrInp = m.querySelector('#fx-prog-mtr'), mtrConv = m.querySelector('#fx-mtr-conv');
    const isMtrUnit = /mtr|meter/i.test(it.unit);
    // Engineer enters metres → convert to the ordered quantity (1 piece = 2.5 m).
    if (mtrInp) {
      const fromMtr = () => {
        const mtr = Math.max(0, num(mtrInp.value));
        const nos = mtr / 2.5;                    // pieces this many metres make
        const done = isMtrUnit ? mtr : Math.round(nos * 100) / 100;
        doneInp.value = Math.min(it.qtyTotal, done);
        if (mtrConv) mtrConv.innerHTML = mtr
          ? `= <b>${Math.round(nos * 100) / 100} Nos</b> <span class="ciq-dim">(${mtr} m ÷ 2.5)</span>${isMtrUnit ? '' : ` → counted as quantity done`}`
          : '';
        upd();
      };
      mtrInp.oninput = fromMtr;
    }
    const upd = () => {
      const done = Math.max(0, Math.min(it.qtyTotal, num(doneInp.value)));
      const left = it.qtyTotal - done, inprog = left; // remaining = still to make at/after current stage
      const pct = it.qtyTotal ? Math.round(done / it.qtyTotal * 100) : 0;
      m.querySelector('#fx-prog-fill').style.width = pct + '%';
      m.querySelector('#fx-prog-summary').innerHTML = `<b class="fx-prog-done">${done} done</b> · <b class="fx-prog-left">${left} remaining</b> (${pct}%)`;
      const matWarn = matInp.value && it.finish && norm(matInp.value) !== norm(it.finish);
      m.querySelector('#fx-prog-note').innerHTML =
        (left > 0 ? `⚠ <b>${left} ${esc(it.unit)}</b> still to complete for this product. ` : '✓ Full quantity complete. ') +
        (matWarn ? `<br>⛔ <b>Material mismatch</b>: used “${esc(matInp.value)}” but ordered “${esc(it.finish)}” — check before proceeding.` : '');
      m.querySelector('#fx-prog-note').className = 'fx-note' + (matWarn ? ' fx-note-warn' : '');
    };
    doneInp.oninput = upd; matInp.oninput = upd; upd();
    if (mtrInp && mtrInp.value) mtrInp.oninput();
    m.querySelector('#fx-det-close').onclick = () => closeModal(m);
    m.querySelector('#fx-det-save').onclick = () => {
      const done = Math.max(0, Math.min(it.qtyTotal, num(doneInp.value)));
      closeModal(m);
      updateItem(id, { qtyDone: done, materialUsed: matInp.value, metersDone: mtrInp ? num(mtrInp.value) : it.metersDone });
      toast('Progress saved — ' + done + '/' + it.qtyTotal + ' ' + it.unit);
    };
  }

  // ---- Undo "Ready to Dispatch" (needs a reason; office is told) ----
  function undoDispatch(id) {
    const f = findItem(id); if (!f) return; const it = f.it;
    const m = modal(`<h3>Undo “Ready to Dispatch”</h3>
      <div class="fx-modal-body">
        <p class="fx-note">This moves the item back into production. The office is notified with your reason so nothing dispatches by mistake.</p>
        <label class="fx-lab">Reason</label>
        <select class="fx-in" id="fx-undo-reason">
          <option>Ticked by mistake</option>
          <option>Marked in urgency by error</option>
          <option>Quantity / quality issue found</option>
          <option>Other</option>
        </select>
        <input class="fx-in" id="fx-undo-note" placeholder="Add a note (optional)" style="margin-top:8px">
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-undo-cancel">Keep as ready</button><button class="fx-btn fx-btn-undo" id="fx-undo-ok">Confirm undo</button></div>`);
    m.querySelector('#fx-undo-cancel').onclick = () => { closeModal(m); render(); };
    m.querySelector('#fx-undo-ok').onclick = () => {
      const reason = m.querySelector('#fx-undo-reason').value, note = m.querySelector('#fx-undo-note').value;
      it.readyToDispatch = false; it.qtyDone = 0; it.status = 'bending';
      notifyOffice({ type: 'dispatch_undone', indentNo: f.ind.indentNo, customer: f.ind.customer, desc: it.desc, reason: reason + (note ? ' — ' + note : ''), at: new Date().toISOString() });
      save(); closeModal(m); render(); toast('Undone — office notified');
    };
  }
  function notifyOffice(rec) {
    let n = []; try { n = JSON.parse(localStorage.getItem(NOTIF) || '[]'); } catch (e) {}
    n.unshift(Object.assign({ seen: false }, rec));
    try { localStorage.setItem(NOTIF, JSON.stringify(n)); } catch (e) {}
    if (window.FIXO_OFFICE && FIXO_OFFICE.refreshBell) FIXO_OFFICE.refreshBell();
  }

  // ---- Kanban board ----
  function kanban(group, kind) {
    // Columns = only the stages the products in THIS view actually use
    // (Raceway/Ladder skip Perforation; Channel uses Slotting; etc.).
    const used = {}; group.forEach(x => stagesFor(x.it.desc).forEach(s => used[s] = true));
    const stages = ALL_STAGES.filter(s => used[s]);
    const cols = stages.map(st => {
      const inCol = group.filter(x => x.it.status === st);
      return `<div class="fx-kcol fx-kcol-${st}" data-stage="${st}">
        <div class="fx-kcol-head"><span class="fx-kdot fx-st-${st}"></span>${STAGES[st]}<span class="fx-kcount">${inCol.length}</span></div>
        <div class="fx-kcards">${inCol.map(x => kcard(x, kind)).join('') || '<div class="fx-kempty">—</div>'}</div>
      </div>`;
    }).join('');
    return `<div class="fx-kanban" style="grid-template-columns:repeat(${stages.length},1fr)">${cols}</div>`;
  }
  // Pull the make-critical specs out of the description so the floor sees
  // exactly WHAT to make: thickness / width / height + finish.
  function specDims(desc) {
    const t = String(desc || ''); const out = [];
    const mt = t.match(/T[:\s]*([\d.]+)/i), mw = t.match(/W[:\s]*([\d.]+)/i), mh = t.match(/H[:\s]*([\d.]+)/i);
    if (mt) out.push(['Thick', mt[1] + 'mm']);
    if (mw) out.push(['Width', mw[1] + 'mm']);
    if (mh) out.push(['Height', mh[1] + 'mm']);
    if (!out.length) { const m = t.match(/([\d.]+)\s*[xX*]\s*([\d.]+)(?:\s*[xX*]\s*([\d.]+))?/); if (m) { out.push(['Thick', m[1]]); out.push(['Width', m[2]]); if (m[3]) out.push(['Height', m[3]]); } }
    return out;
  }
  function specChips(it, extra) {
    const chips = specDims(it.desc).map(s => `<span class="fx-spec"><em>${s[0]}</em>${esc(s[1])}</span>`);
    if (it.finish) chips.unshift(`<span class="fx-spec fx-spec-fin">${esc(it.finish)}</span>`);
    if (extra) chips.unshift(`<span class="fx-spec fx-spec-cust">${extra}</span>`);
    return chips.length ? `<div class="fx-specs">${chips.join('')}</div>` : '';
  }
  // Product name without the trailing dimension string (dimensions shown as chips)
  function shortName(desc) { return String(desc || '').split('\n')[0].replace(/\s*[-–—]?\s*(T[:\s]|[\d.]+\s*[xX*]).*$/, '').trim() || String(desc || ''); }

  function kcard(x, kind) {
    const it = x.it, rem = it.qtyTotal - it.qtyDone;
    const custChip = kind === 'product' ? '👤 ' + esc(x.ind.customer) : '📦 ' + esc(prettyCat(it.category));
    const done = it.status === 'ready';
    const nx = nextStage(it.status, it.desc);
    const label = done ? '✓ Ready' : '▶ Move to ' + STAGES[nx];
    const pic = imgTag(it.desc);
    return `<div class="fx-kcard fx-st-${it.status}" data-detail="${it.id}" data-item="${it.id}" draggable="true">
      <div class="fx-kcard-head">${pic}<div class="fx-kcard-desc">${esc(shortName(it.desc))}</div></div>
      ${specChips(it, custChip)}
      <div class="fx-kcard-sub">📅 ${esc(x.ind.indentDate || monthLabel(x.ind.month))} · Indent ${esc(x.ind.indentNo)}</div>
      <div class="fx-kcard-qty">Qty: <b>${esc(it.qty)} ${esc(it.unit)}</b> · Done <b>${it.qtyDone || 0}</b>/${it.qtyTotal}${rem > 0 ? ` · <span class="fx-kcard-rem">${rem} left</span>` : ''}${it.weight ? ` · ⚖ ${esc(it.weight)} kg` : ''}</div>
      <div class="fx-kcard-foot">
        ${Object.keys(it.photos).length ? `<button class="fx-photo-view" data-photos="${it.id}">📷 ${Object.keys(it.photos).length}</button>` : '<span class="fx-tap-hint">tap for details</span>'}
        <span class="fx-foot-btns">
        ${it.status !== 'cutting' && !done ? `<button class="fx-btn fx-btn-undo fx-btn-sm" data-back="${it.id}" title="Undo one stage">↩</button>` : ''}
        ${done ? `<button class="fx-btn fx-btn-undo fx-btn-sm" data-undo="${it.id}">↩ Undo</button>` : `<button class="fx-btn fx-btn-go fx-btn-sm" data-advance="${it.id}">${label}</button>`}
        </span>
      </div>
    </div>`;
  }

  // ---- List view ----
  function listView(group, kind) {
    return `<div class="fx-list">${group.map(x => {
      const it = x.it, rem = it.qtyTotal - it.qtyDone;
      const done = it.status === 'ready';
      const nx = nextStage(it.status);
      const label = done ? '✓ Ready' : '▶ Move to ' + STAGES[nx];
      return `<div class="fx-track fx-st-${it.status}" data-detail="${it.id}">
        ${imgTag(it.desc)}
        <div class="fx-track-info"><div class="fx-track-desc"><b>${esc(shortName(it.desc))}</b></div>
          ${specChips(it, (kind === 'product' ? '👤 ' + esc(x.ind.customer) : '📦 ' + esc(prettyCat(it.category))))}
          <div class="fx-track-sub">Qty ${esc(it.qty)} ${esc(it.unit)}${it.qtyDone && rem > 0 ? ` · <span class="fx-rem">${rem} left</span>` : ''}${it.weight ? ` · ⚖ ${esc(it.weight)} kg` : ''}</div></div>
        <div class="fx-track-actions">
          ${Object.keys(it.photos).length ? `<button class="fx-photo-view" data-photos="${it.id}">📷 ${Object.keys(it.photos).length}</button>` : ''}
          <span class="fx-status fx-st-${it.status}">${STAGES[it.status]}</span>
          ${it.status !== 'cutting' && !done ? `<button class="fx-btn fx-btn-undo" data-back="${it.id}" title="Undo one stage">↩</button>` : ''}
          ${done ? `<button class="fx-btn fx-btn-undo" data-undo="${it.id}">↩ Undo</button>` : `<button class="fx-btn fx-btn-go" data-advance="${it.id}">${label}</button>`}
        </div></div>`;
    }).join('')}</div>`;
  }

  function totalQty(g) { const by = {}; g.forEach(x => { const u = x.it.unit || ''; by[u] = (by[u] || 0) + num(x.it.qty); }); return Object.keys(by).map(u => `${by[u]} ${u}`).join(', '); }
  function imgTag(desc) { const u = (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.guessUrl) ? FIXO_PRODUCT_IMG.guessUrl(desc) : ''; return u ? `<img class="fx-side-thumb" src="${u}" onerror="this.style.display='none'">` : '<span class="fx-side-ic">📦</span>'; }

  // ---- Advance (photo-gated) ----
  // Move a card to a target column — only after a verification photo. Moving
  // backward is blocked here (use ↩ Undo, which asks for a reason).
  function moveToStage(id, target) {
    const f = findItem(id); if (!f) return; const it = f.it;
    if (it.status === target) return;
    const seq = stagesFor(it.desc);
    const ci = seq.indexOf(it.status), ti = seq.indexOf(target);
    if (ti < 0) { toast('That stage does not apply to this product'); return; }
    if (ti < ci) { toast('To move a card back, use ↩ Undo'); return; }
    capturePhoto('Move to “' + STAGES[target] + '” — take or upload a photo to verify', d => {
      it.photos[STAGES[it.status] + ' → ' + STAGES[target]] = d;
      it.seen = true;
      if (target === 'ready') {
        askDispatchDetails(it, () => { it.status = 'ready'; updateItem(id, it); toast('Moved to Ready to Dispatch'); });
      } else {
        it.status = target; updateItem(id, it); toast('Moved to ' + STAGES[target]);
      }
    });
  }
  function advance(id) { const f = findItem(id); if (!f) return; const n = nextStage(f.it.status, f.it.desc); if (n) moveToStage(id, n); }
  function prevStage(s, desc) { const seq = stagesFor(desc); const i = seq.indexOf(s); return i > 0 ? seq[i - 1] : null; }
  // Undo one stage (for accidental moves at any stage). Quick + reversible.
  function stepBack(id) {
    const f = findItem(id); if (!f) return; const it = f.it;
    const p = prevStage(it.status, it.desc); if (!p) return;
    const m = modal(`<h3>Undo — back to “${esc(STAGES[p])}”</h3>
      <div class="fx-modal-body">
        <p class="fx-note">Moved by mistake? Give a reason — it's recorded and the office is notified.</p>
        <label class="fx-lab">Reason</label>
        <select class="fx-in" id="fx-back-reason">
          <option>Moved by mistake</option>
          <option>Wrong item updated</option>
          <option>Rework needed at this stage</option>
          <option>Quality issue found</option>
          <option>Other</option>
        </select>
        <input class="fx-in" id="fx-back-note" placeholder="Add a note (optional)" style="margin-top:8px">
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-back-cancel">Cancel</button><button class="fx-btn fx-btn-undo" id="fx-back-ok">↩ Move back</button></div>`);
    m.querySelector('#fx-back-cancel').onclick = () => closeModal(m);
    m.querySelector('#fx-back-ok').onclick = () => {
      const reason = m.querySelector('#fx-back-reason').value, note = m.querySelector('#fx-back-note').value;
      delete it.photos[STAGES[p] + ' → ' + STAGES[it.status]];
      const from = STAGES[it.status]; it.status = p;
      notifyOffice({ type: 'stage_undone', indentNo: f.ind.indentNo, customer: f.ind.customer, desc: it.desc, reason: `${from} → ${STAGES[p]}: ${reason}${note ? ' — ' + note : ''}`, at: new Date().toISOString() });
      closeModal(m); updateItem(id, it); toast('Moved back to ' + STAGES[p] + ' — office notified');
    };
  }
  function askDispatchDetails(it, done) {
    const m = modal(`<h3>Ready to Dispatch — ${esc(it.desc)}</h3>
      <div class="fx-modal-body">
        <label class="fx-lab">Quantity finished (ordered ${esc(it.qtyTotal)} ${esc(it.unit)})</label>
        <input class="fx-in" id="fx-done" type="number" min="0" value="${it.qtyDone || it.qtyTotal}">
        <label class="fx-lab">Total weight (kg)</label>
        <input class="fx-in" id="fx-wt2" value="${esc(it.weight)}" placeholder="e.g. 480">
        <p class="fx-note" id="fx-remnote"></p>
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-cancel">Cancel</button><button class="fx-btn fx-btn-go" id="fx-ok">Confirm</button></div>`);
    const d = m.querySelector('#fx-done'), w = m.querySelector('#fx-wt2'), r = m.querySelector('#fx-remnote');
    const upd = () => { const left = it.qtyTotal - num(d.value); r.innerHTML = left > 0 ? `⚠ <b>${left} ${esc(it.unit)}</b> still remaining — stays "Partly Ready" until complete.` : '✓ Full quantity complete.'; };
    d.oninput = upd; upd();
    m.querySelector('#fx-cancel').onclick = () => closeModal(m);
    m.querySelector('#fx-ok').onclick = () => { it.qtyDone = num(d.value); it.weight = w.value; it.readyToDispatch = it.qtyDone >= it.qtyTotal; it.status = it.readyToDispatch ? 'ready' : 'partial'; closeModal(m); done(); };
  }

  // ---- Photo capture ----
  function capturePhoto(title, onDone) {
    const m = modal(`<h3>${esc(title)}</h3>
      <div class="fx-cam-wrap"><video id="fx-video" autoplay playsinline></video><div class="fx-cam-fallback" id="fx-camfb" hidden>Camera unavailable — please upload a photo.</div></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-cam-cancel">Cancel</button>
        <label class="fx-btn" style="cursor:pointer">📁 Upload<input type="file" accept="image/*" capture="environment" id="fx-cam-file" hidden></label>
        <button class="fx-btn fx-btn-go" id="fx-cam-snap">📸 Capture</button></div>`);
    const v = m.querySelector('#fx-video'); let stream = null;
    (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
      ? navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false }).then(s => { stream = s; v.srcObject = s; }).catch(() => { v.hidden = true; m.querySelector('#fx-camfb').hidden = false; })
      : (v.hidden = true, m.querySelector('#fx-camfb').hidden = false);
    const stop = () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
    const fin = d => { stop(); closeModal(m); onDone(d); };
    m.querySelector('#fx-cam-cancel').onclick = () => { stop(); closeModal(m); };
    m.querySelector('#fx-cam-snap').onclick = () => {
      if (v.hidden || !v.videoWidth) { toast('No camera — use Upload'); return; }
      const cv = document.createElement('canvas'), s = Math.min(1, 900 / v.videoWidth);
      cv.width = v.videoWidth * s; cv.height = v.videoHeight * s; cv.getContext('2d').drawImage(v, 0, 0, cv.width, cv.height);
      fin(cv.toDataURL('image/jpeg', 0.7));
    };
    m.querySelector('#fx-cam-file').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => downscale(r.result, 900, fin); r.readAsDataURL(f); };
  }
  function downscale(dataUrl, max, cb) { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const cv = document.createElement('canvas'); cv.width = img.width * s; cv.height = img.height * s; cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); cb(cv.toDataURL('image/jpeg', 0.7)); }; img.onerror = () => cb(dataUrl); img.src = dataUrl; }
  function viewPhotos(id) { const f = findItem(id); if (!f) return; const ph = f.it.photos; modal(`<h3>Photos — ${esc(f.it.desc)}</h3><div class="fx-photo-grid">${Object.keys(ph).map(k => `<figure><img src="${ph[k]}"><figcaption>${esc(k)}</figcaption></figure>`).join('') || '<p>No photos.</p>'}</div><div class="fx-modal-actions"><button class="fx-btn fx-btn-go" onclick="this.closest('.fx-modal-overlay').remove()">Close</button></div>`); }

  // ---- Approval → office notification ----
  function approveIndent(id) {
    const ind = indents.find(i => i.id === id); if (!ind) return;
    ind.factoryApproved = true; ind.factoryApprovedAt = new Date().toISOString(); save();
    notifyOffice({ type: 'factory_approved', indentNo: ind.indentNo, customer: ind.customer, at: ind.factoryApprovedAt });
    toast('Approved — office notified'); render();
  }

  // ---- Print (yellow = factory copy, white = office copy) via PDF editor ----
  function printIndent(indId, copy) {
    const ind = indents.find(i => i.id === indId); if (!ind) return;
    if (!(window.FIXO_PF && FIXO_PF.buildIndentHtml)) { toast('Printer not ready'); return; }
    const yellow = copy !== 'white';
    const model = { indentNo: ind.indentNo, indentDate: ind.indentDate, customer: ind.customer, indentCustomer: ind.indentCustomer, indentNotes: ind.indentNotes,
      items: ind.items.map(it => ({ sl: it.sl, desc: it.desc, qty: it.qty, unit: it.unit, dealtBy: it.dealtBy, deliveryDate: it.deliveryDate, readyToDispatch: it.readyToDispatch, weight: it.weight })) };
    openPrintEditor(FIXO_PF.buildIndentHtml(model, { editable: true, size: 'auto', yellow, dispatchCols: true }), yellow ? 'Yellow copy (Factory)' : 'White copy (Office)');
  }
  // Reusable WYSIWYG editor for the factory indent (click-to-edit, then print)
  function openPrintEditor(html, title) {
    const m = modal(`<div class="fx-ed-head"><h3>Verify &amp; Print — ${esc(title)}</h3><span class="fx-ed-hint">✎ Click any cell to edit, then Print.</span></div>
      <div class="fx-ed-body"><iframe id="fx-ed-frame"></iframe></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="fx-ed-cancel">Cancel</button><button class="fx-btn fx-btn-go" id="fx-ed-print">🖨 Proceed to Print</button></div>`, 'fx-ed-modal');
    const fr = m.querySelector('#fx-ed-frame'); const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(html); d.close();
    m.querySelector('#fx-ed-cancel').onclick = () => closeModal(m);
    m.querySelector('#fx-ed-print').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }

  // ---- Misc ----
  function markSeenSoon(group) { setTimeout(() => { let ch = false; group.forEach(x => { if (!x.it.seen) { x.it.seen = true; ch = true; } }); if (ch) { save(); bumpLauncherBadge(); } }, 600); }
  function emptyState(t, s) { return `<div class="fx-empty"><div class="fx-empty-ic">🏭</div><h3>${esc(t)}</h3><p>${esc(s)}</p></div>`; }
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = `<div class="fx-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) closeModal(el); }); return el; }
  function closeModal(m) { const o = m.classList.contains('fx-modal-overlay') ? m : m.closest('.fx-modal-overlay'); if (o) o.remove(); }
  function bumpLauncherBadge() { const n = allItems().filter(x => !x.it.seen).length; const b = document.getElementById('btn-factory'); if (b) { let bd = b.querySelector('.fx-launch-badge'); if (n) { if (!bd) { bd = document.createElement('span'); bd.className = 'fx-launch-badge'; b.appendChild(bd); } bd.textContent = n; } else if (bd) bd.remove(); } }

  document.addEventListener('DOMContentLoaded', () => {
    bumpLauncherBadge();
    // Reload safety: if the saved screen is the factory, render it (else the page shows blank).
    if (document.body.dataset.screen === 'screen-factory' || (function () { try { return localStorage.getItem('fixo_screen') === 'screen-factory'; } catch (e) { return false; } })()) {
      render();
    }
  });
  // ---- Shared with the Dispatch app (same store = interconnected) ----
  function getReadyGroups() {
    const g = {};
    allItems().forEach(x => {
      if (x.it.status === 'ready' && !x.it.dispatched) {
        const k = x.ind.customer;
        (g[k] = g[k] || { customer: k, indentNo: x.ind.indentNo, indentDate: x.ind.indentDate, month: x.ind.month, items: [] }).items.push(x.it);
      }
    });
    return Object.values(g);
  }
  function markDispatched(ids) {
    const custs = new Set();
    ids.forEach(id => { const f = findItem(id); if (f) { f.it.dispatched = true; f.it.dispatchedAt = new Date().toISOString(); custs.add(f.ind.customer); } });
    save();
    notifyOffice({ type: 'dispatched', indentNo: '', customer: [...custs].join(', '), reason: ids.length + ' item(s) dispatched', at: new Date().toISOString() });
    if (document.body.dataset.screen === 'screen-factory') render();
  }
  // All items grouped by customer (for the dispatch "inbound / comparison" view).
  function getAllGroups() {
    const g = {};
    allItems().forEach(x => { const k = x.ind.customer; (g[k] = g[k] || { customer: k, indentNo: x.ind.indentNo, indentDate: x.ind.indentDate, items: [] }).items.push(x.it); });
    return Object.values(g);
  }
  function getDispatched() { const o = []; allItems().forEach(x => { if (x.it.dispatched) o.push({ it: x.it, ind: x.ind }); }); return o; }
  // Raw indents (each a true indent, carrying priority/notes) — used by the
  // Dispatch app to list + print the exact indent that arrived.
  function getIndents() {
    return indents.map(i => ({
      id: i.id, indentNo: i.indentNo, indentDate: i.indentDate, customer: i.customer,
      priority: !!i.priority, factoryApproved: !!i.factoryApproved,
      items: i.items.map(it => ({ sl: it.sl, desc: it.desc, qty: it.qty, unit: it.unit, finish: it.finish, status: it.status, qtyDone: it.qtyDone, qtyTotal: it.qtyTotal }))
    }));
  }
  window.FIXO_FACTORY = { receiveIndent, render, getReadyGroups, getAllGroups, getIndents, getDispatched, markDispatched, printIndent, specDims, shortName, prettyCat, STAGES, LOGO: () => (typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : '') };
})();
