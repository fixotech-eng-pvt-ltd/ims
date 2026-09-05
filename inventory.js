// ============================================================
// Fixotech — INVENTORY MANAGEMENT SYSTEM (factory-side app)
// Implements the factory's own stock books:
//   • Stock Register 2026-27.xlsx  -> a per-material ledger card
//        (Date · Particulars · Bill No · Receipt · Issue · Balance · Remarks)
//   • Stock Accessories.xlsx       -> the summary = each material's running balance
// Two kinds of inventory: ACCESSORIES (connectors, end caps, spring nuts, rods,
// channels — the extras placed with orders) and PRODUCTION materials/consumables
// (bolts, nuts, washers, sheets, paint, wheels, gloves, welding…).
// Each ISSUE is a slip; issues raised from an order carry the order reference,
// so the Factory Floor shows the material consumed per order and the deficit.
//
// Store: fixo_inv_items = [{id,name,sheet,unit,type,opening,minQty,txns:[
//        {id,date,particulars,bill,receipt,issue,remarks,orderIndent,orderDesc,orderCustomer}]}]
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const uid = () => 'iv' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const LOGO = () => (window.FIXO_FACTORY && FIXO_FACTORY.LOGO ? FIXO_FACTORY.LOGO() : '');
  const today = () => new Date().toLocaleDateString('en-GB').split('/').reverse().join('-'); // yyyy-mm-dd

  const IK = 'fixo_inv_items';
  const load = () => { try { return JSON.parse(localStorage.getItem(IK) || '[]'); } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(IK, JSON.stringify(a)); } catch (e) {} };

  // Seed from the factory's stock books (once).
  function seedOnce() {
    if (localStorage.getItem('fixo_inv_seed_v2') === '1') return;
    const seed = window.FIXO_INVENTORY_SEED;
    if (Array.isArray(seed) && seed.length && !load().length) {
      save(seed.map(s => ({
        // Stable id from the material name → same id on every device, so the
        // seeded catalogue de-duplicates when synced through Supabase.
        id: 'inv-' + String(s.sheet || s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        name: s.name, sheet: s.sheet || s.name, unit: s.unit || 'Nos',
        type: s.type || 'production', opening: num(s.opening), minQty: 0,
        txns: (s.txns || []).map((t, ti) => ({
          id: 'invx-' + String(s.sheet || s.name).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + ti, date: t.date || '', particulars: t.particulars || '', bill: t.bill || '',
          receipt: t.receipt != null ? num(t.receipt) : null, issue: t.issue != null ? num(t.issue) : null,
          remarks: t.remarks || ''
        }))
      })));
    }
    localStorage.setItem('fixo_inv_seed_v2', '1');
  }

  // ---- derived ----
  const balanceOf = (it) => num(it.opening) + (it.txns || []).reduce((s, t) => s + num(t.receipt) - num(t.issue), 0);
  const statusOf = (it) => { const b = balanceOf(it); if (b <= 0) return 'short'; if (num(it.minQty) > 0 && b <= num(it.minQty)) return 'low'; return 'ok'; };
  const findItem = (id) => load().find(x => x.id === id);

  let type = 'accessory', q = '';

  // ---- render ----
  function render() {
    seedOnce();
    const host = document.getElementById('inventory-app'); if (!host) return;
    const all = load();
    const acc = all.filter(i => i.type === 'accessory'), prod = all.filter(i => i.type === 'production');
    const shownAll = type === 'all' ? all : type === 'production' ? prod : acc;
    const low = shownAll.filter(i => statusOf(i) === 'low').length, short = shownAll.filter(i => statusOf(i) === 'short').length;
    const logo = LOGO();
    host.innerHTML = `
      <div class="fx-hero" style="background:linear-gradient(120deg,#065f46,#059669 60%,#10b981)">
        <div class="fx-hero-title"><span class="fx-hero-ic">📦</span><div><h2>Inventory Management</h2><p>Factory stock register · Receipt / Issue / Balance · linked to production</p></div></div>
        <div class="fx-hero-right"><div class="fx-stats">
          <div class="fx-stat"><b>${all.length}</b><span>Materials</span></div>
          <div class="fx-stat amber"><b>${low}</b><span>Low</span></div>
          <div class="fx-stat red"><b>${short}</b><span>Out</span></div>
        </div>${logo ? `<div class="fx-logo-chip"><img src="${logo}" alt="Fixotech" onerror="this.style.display='none'"></div>` : ''}</div>
      </div>
      <div class="fx-tabs">
        <button class="fx-tab ${type === 'accessory' ? 'active' : ''}" data-t="accessory">🔩 Accessories <span class="fx-badge">${acc.length}</span></button>
        <button class="fx-tab ${type === 'production' ? 'active' : ''}" data-t="production">🏭 Production materials <span class="fx-badge">${prod.length}</span></button>
        <button class="fx-tab ${type === 'all' ? 'active' : ''}" data-t="all">📋 All</button>
      </div>
      <div id="inv-body"></div>`;
    host.querySelectorAll('.fx-tab').forEach(b => b.onclick = () => { type = b.dataset.t; render(); });
    renderTable(host.querySelector('#inv-body'), shownAll);
    refreshBadge();
  }

  function statusBadge(it) {
    const st = statusOf(it);
    return st === 'short' ? '<span class="fx-prio-tag">⚠ OUT</span>' : st === 'low' ? '<span class="inv-low">LOW</span>' : '<span class="fx-fi-ok">✓ OK</span>';
  }

  function renderTable(body, listIn) {
    const ql = q.trim().toLowerCase();
    const list = (ql ? listIn.filter(i => i.name.toLowerCase().includes(ql)) : listIn).slice().sort((a, b) => a.name.localeCompare(b.name));
    const rows = list.length ? list.map(it => {
      const bal = balanceOf(it), slips = (it.txns || []).filter(t => num(t.issue) > 0).length;
      return `<tr>
        <td><b class="inv-name" data-ledger="${it.id}">${esc(it.name)}</b></td>
        <td class="c">${esc(it.unit)}</td>
        <td class="c"><b class="${bal <= 0 ? 'inv-neg' : num(it.minQty) > 0 && bal <= num(it.minQty) ? 'inv-lowtx' : 'inv-ok'}">${bal}</b></td>
        <td class="c">${slips || 0}</td>
        <td class="c">${statusBadge(it)}</td>
        <td class="c inv-actions">
          <button class="fx-btn fx-btn-sm" data-ledger="${it.id}" title="Stock card / ledger">📋 Ledger</button>
          <button class="fx-btn fx-btn-sm" data-recv="${it.id}" title="Receipt (stock in)">➕ Receipt</button>
          <button class="fx-btn fx-btn-sm" data-issue="${it.id}" title="Issue (slip out)">➖ Issue</button>
        </td></tr>`;
    }).join('') : `<tr><td colspan="6" class="c fx-meta" style="padding:22px">${ql ? 'No material matches “' + esc(q) + '”.' : 'No materials here yet.'}</td></tr>`;
    body.innerHTML = `
      <div class="inv-toolbar">
        <input class="fx-in inv-search" id="inv-search" placeholder="🔎 Search material…" value="${esc(q)}">
        <button class="fx-btn" id="inv-print-btn" title="Print this stock summary">🖨 Print summary</button>
        <button class="fx-btn fx-btn-go" id="inv-add-btn">➕ Add material</button>
      </div>
      <div class="fx-card"><table class="fx-tbl inv-tbl"><thead><tr>
        <th>Material</th><th>Unit</th><th>Balance</th><th>Slips</th><th>Status</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table></div>
      <p class="fx-side-hint" style="margin-top:12px"><b>How it links:</b> on the Factory Floor, open any order line → <b>🔗 Use from inventory</b> raises an <b>Issue</b> slip here against that order and updates the balance.</p>`;
    const s = body.querySelector('#inv-search');
    s.oninput = () => { q = s.value; const b = document.getElementById('inv-body'); if (b) { renderTable(b, listIn); const ns = document.getElementById('inv-search'); if (ns) { ns.focus(); ns.setSelectionRange(ns.value.length, ns.value.length); } } };
    body.querySelector('#inv-add-btn').onclick = () => editItem(null);
    const title = type === 'accessory' ? 'Accessories' : type === 'production' ? 'Production Materials' : 'All Materials';
    body.querySelector('#inv-print-btn').onclick = () => printSummary(list, title + (ql ? ' — “' + q + '”' : ''));
    body.querySelectorAll('[data-ledger]').forEach(b => b.onclick = () => openLedger(b.dataset.ledger));
    body.querySelectorAll('[data-recv]').forEach(b => b.onclick = () => addTxn(b.dataset.recv, 'receipt'));
    body.querySelectorAll('[data-issue]').forEach(b => b.onclick = () => addTxn(b.dataset.issue, 'issue'));
  }

  // ---- Stock card / ledger (matches the Excel layout, with running balance) ----
  function openLedger(id) {
    const it = findItem(id); if (!it) return;
    let run = num(it.opening);
    const bodyRows = [`<tr class="inv-open"><td>—</td><td><i>Opening balance</i></td><td></td><td class="c"></td><td class="c"></td><td class="c"><b>${run}</b></td><td></td></tr>`];
    (it.txns || []).forEach(t => {
      run += num(t.receipt) - num(t.issue);
      bodyRows.push(`<tr>
        <td>${esc(t.date || '')}</td><td>${esc(t.particulars || '')}${t.orderIndent ? ` <span class="fx-fin">${esc(t.orderIndent)}</span>` : ''}</td>
        <td>${esc(t.bill || '')}</td>
        <td class="c">${t.receipt != null && t.receipt !== '' ? num(t.receipt) : ''}</td>
        <td class="c">${t.issue != null && t.issue !== '' ? num(t.issue) : ''}</td>
        <td class="c"><b>${run}</b></td>
        <td>${esc(t.remarks || '')}${num(t.issue) > 0 ? ` <button class="fx-btn fx-btn-sm" data-slip="${t.id}" title="Print issue slip">🖨</button>` : ''}</td></tr>`);
    });
    const m = modal(`
      <div class="fx-ed-head"><h3>Stock card — ${esc(it.name)}</h3><span class="fx-ed-hint">${esc(it.type === 'accessory' ? 'Accessory' : 'Production material')} · Unit ${esc(it.unit)} · Balance <b>${balanceOf(it)}</b></span></div>
      <div class="inv-ledger-wrap"><table class="fx-tbl inv-ledger"><thead><tr>
        <th>Date</th><th>Particulars</th><th>Bill No.</th><th>Receipt</th><th>Issue</th><th>Balance</th><th>Remarks</th></tr></thead>
        <tbody>${bodyRows.join('')}</tbody></table></div>
      <div class="fx-modal-actions">
        <button class="fx-btn" id="inv-l-close">Close</button>
        <button class="fx-btn" id="inv-l-print">🖨 Print card</button>
        <button class="fx-btn" id="inv-l-recv">➕ Receipt</button>
        <button class="fx-btn fx-btn-go" id="inv-l-issue">➖ Issue (slip)</button>
      </div>`, 'fx-ed-modal inv-ledger-modal');
    m.querySelector('#inv-l-close').onclick = () => closeModal(m);
    m.querySelector('#inv-l-print').onclick = () => printLedger(findItem(id));
    m.querySelector('#inv-l-recv').onclick = () => { closeModal(m); addTxn(id, 'receipt'); };
    m.querySelector('#inv-l-issue').onclick = () => { closeModal(m); addTxn(id, 'issue'); };
    m.querySelectorAll('[data-slip]').forEach(b => b.onclick = () => printSlip(it, (it.txns || []).find(t => t.id === b.dataset.slip)));
  }

  // ---- Add a Receipt (stock in) or Issue (slip out) ----
  function addTxn(id, kind, ctx) {
    const it = findItem(id); if (!it) return;
    ctx = ctx || {};
    const isRecv = kind === 'receipt';
    const m = modal(`<h3>${isRecv ? '➕ Receipt — stock in' : '➖ Issue — material out (slip)'} · ${esc(it.name)}</h3>
      <div class="fx-modal-body inv-form">
        <p class="fx-note">Current balance: <b>${balanceOf(it)} ${esc(it.unit)}</b></p>
        <div class="inv-form-row">
          <div><label class="fx-lab">Date</label><input class="fx-in" id="tx-date" type="date" value="${today()}"></div>
          <div><label class="fx-lab">Quantity (${esc(it.unit)})</label><input class="fx-in" id="tx-qty" type="number" min="0" value="${ctx.qty ? num(ctx.qty) : ''}" placeholder="0"></div>
          <div><label class="fx-lab">${isRecv ? 'Bill No.' : 'Ref / Indent'}</label><input class="fx-in" id="tx-bill" value="${esc(ctx.ref || '')}" placeholder="${isRecv ? 'Supplier bill' : 'Indent no.'}"></div>
        </div>
        <label class="fx-lab">${isRecv ? 'Supplier / Particulars' : 'Issued to / Particulars (customer / job)'}</label>
        <input class="fx-in" id="tx-part" value="${esc(ctx.particulars || '')}" placeholder="${isRecv ? 'Supplier name' : 'Customer / production job'}">
        <label class="fx-lab">Remarks</label><input class="fx-in" id="tx-rem" placeholder="Optional">
        <p class="fx-note" id="tx-warn"></p>
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="tx-x">Cancel</button><button class="fx-btn fx-btn-go" id="tx-ok">${isRecv ? 'Add receipt' : 'Issue & make slip'}</button></div>`);
    const qi = m.querySelector('#tx-qty'), warn = m.querySelector('#tx-warn');
    if (!isRecv) qi.oninput = () => { const after = balanceOf(it) - num(qi.value); warn.innerHTML = after < 0 ? `⚠ Only <b>${balanceOf(it)}</b> in stock — this leaves a shortage of <b>${Math.abs(after)}</b>.` : (num(qi.value) ? `✓ ${after} ${esc(it.unit)} will remain.` : ''); warn.className = 'fx-note' + (after < 0 ? ' fx-note-warn' : ''); };
    m.querySelector('#tx-x').onclick = () => closeModal(m);
    m.querySelector('#tx-ok').onclick = () => {
      const qty = num(qi.value); if (qty <= 0) { toast('Enter a quantity'); return; }
      const list = load(); const t = list.find(x => x.id === id);
      const rec = { id: uid(), date: m.querySelector('#tx-date').value || today(), particulars: m.querySelector('#tx-part').value.trim(), bill: m.querySelector('#tx-bill').value.trim(), remarks: m.querySelector('#tx-rem').value.trim() };
      if (isRecv) rec.receipt = qty; else { rec.issue = qty; if (ctx.indentNo) { rec.orderIndent = ctx.indentNo; rec.orderDesc = ctx.desc || ''; rec.orderCustomer = ctx.customer || ''; } }
      t.txns.push(rec); save(list); closeModal(m); render();
      toast(isRecv ? ('Received ' + qty + ' ' + it.unit) : ('Issued ' + qty + ' ' + it.unit + ' — ' + balanceOf(t) + ' left'));
      if (ctx.onDone) ctx.onDone(rec);
      if (!isRecv) printSlip(t, rec, true);
    };
  }

  // ---- Shared print helpers (professional A4 layout, logo header) ----
  function openPrint(html) { const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350); }
  function printShell(title, subtitle, inner, opts) {
    opts = opts || {};
    const logo = LOGO();
    const dstr = new Date().toLocaleDateString('en-GB');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
      @page{size:A4 ${opts.landscape ? 'landscape' : 'portrait'};margin:10mm}
      html,body{background:#fff}
      body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;margin:0;padding:6mm}
      .wrap{border:2px solid #000;padding:12px}
      .hd{display:flex;align-items:center;gap:14px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:10px}
      .hd img{height:52px}
      .hd .co{flex:1;text-align:center}
      .hd .co b{font-size:20px;letter-spacing:1px}
      .hd .co span{display:block;font-size:11px;color:#333}
      .title{text-align:center;font-size:16px;font-weight:bold;letter-spacing:1px;text-decoration:underline;margin:2px 0 4px}
      .sub{text-align:center;font-size:12px;margin-bottom:12px}
      .meta{display:flex;justify-content:space-between;font-size:12px;font-weight:bold;margin-bottom:8px}
      table{width:100%;border-collapse:collapse}
      th,td{border:1px solid #000;padding:5px 7px;font-size:11.5px}
      th{background:#e8f5ee}
      .c{text-align:center}.r{text-align:right}
      tr.tot td{background:#f1f5f9;font-weight:bold}
      .st-out{color:#b91c1c;font-weight:bold}.st-low{color:#b45309;font-weight:bold}.st-ok{color:#047857}
      .sign{display:flex;justify-content:space-between;margin-top:26px;font-weight:bold}
      @media print{body{padding:0}}
    </style></head><body><div class="wrap">
      <div class="hd">${logo ? `<img src="${logo}">` : ''}<div class="co"><b>FIXOTECH ENGINEERING</b><span>Inventory / Stock Register 2026-27</span></div>${logo ? '<span style="width:52px"></span>' : ''}</div>
      <div class="title">${esc(title)}</div>${subtitle ? `<div class="sub">${esc(subtitle)}</div>` : ''}
      <div class="meta"><span>${esc(opts.left || '')}</span><span>As on : ${dstr}</span></div>
      ${inner}
      <div class="sign"><span>${esc(opts.sign1 || 'Prepared by')}</span><span>${esc(opts.sign2 || 'Checked by')}</span></div>
    </div></body></html>`;
  }

  // Print the whole stock summary (like the Stock Accessories sheet), for the
  // list currently shown (Accessories / Production / All).
  function printSummary(list, title) {
    if (!list || !list.length) { toast('Nothing to print'); return; }
    const sorted = list.slice().sort((a, b) => a.name.localeCompare(b.name));
    let tOut = 0, tLow = 0;
    const rows = sorted.map((it, i) => {
      const bal = balanceOf(it), st = statusOf(it);
      if (st === 'short') tOut++; else if (st === 'low') tLow++;
      const lbl = st === 'short' ? '<span class="st-out">OUT</span>' : st === 'low' ? '<span class="st-low">LOW</span>' : '<span class="st-ok">OK</span>';
      return `<tr><td class="c">${i + 1}</td><td>${esc(it.name)}</td><td class="c">${bal}</td><td class="c">${esc(it.unit)}</td><td class="c">${esc(it.type === 'accessory' ? 'Accessory' : 'Production')}</td><td class="c">${lbl}</td></tr>`;
    }).join('');
    const inner = `<table><thead><tr><th style="width:8%">Sl.No.</th><th>Item</th><th style="width:14%">Balance Qty</th><th style="width:10%">Unit</th><th style="width:16%">Category</th><th style="width:12%">Status</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="tot"><td colspan="2">Total items: ${sorted.length}</td><td colspan="4">Low: ${tLow} &nbsp;·&nbsp; Out of stock: ${tOut}</td></tr></tfoot></table>`;
    openPrint(printShell('STOCK SUMMARY', title || '', inner, { left: 'Items: ' + sorted.length }));
  }

  // Print one material's full stock card (ledger with running balance).
  function printLedger(it) {
    if (!it) return;
    let run = num(it.opening);
    const rows = [`<tr><td class="c">—</td><td><i>Opening balance</i></td><td></td><td class="c"></td><td class="c"></td><td class="c"><b>${run}</b></td><td></td></tr>`];
    (it.txns || []).forEach(t => {
      run += num(t.receipt) - num(t.issue);
      rows.push(`<tr><td class="c">${esc(t.date || '')}</td><td>${esc(t.particulars || '')}${t.orderIndent ? ' (' + esc(t.orderIndent) + ')' : ''}</td><td>${esc(t.bill || '')}</td><td class="c">${t.receipt != null && t.receipt !== '' ? num(t.receipt) : ''}</td><td class="c">${t.issue != null && t.issue !== '' ? num(t.issue) : ''}</td><td class="c"><b>${run}</b></td><td>${esc(t.remarks || '')}</td></tr>`);
    });
    const inner = `<table><thead><tr><th style="width:12%">Date</th><th>Particulars</th><th style="width:12%">Bill No.</th><th style="width:11%">Receipt</th><th style="width:11%">Issue</th><th style="width:12%">Balance</th><th style="width:16%">Remarks</th></tr></thead>
      <tbody>${rows.join('')}</tbody>
      <tfoot><tr class="tot"><td colspan="5">Closing balance</td><td class="c">${balanceOf(it)}</td><td>${esc(it.unit)}</td></tr></tfoot></table>`;
    openPrint(printShell('STOCK CARD — ' + it.name, (it.type === 'accessory' ? 'Accessory' : 'Production material') + ' · Unit: ' + it.unit, inner, { left: 'Material: ' + it.name, landscape: true }));
  }

  // ---- Material issue slip (printable) ----
  function printSlip(it, t, ask) {
    if (!t) return;
    if (ask && !confirm('Print a material issue slip for ' + num(t.issue) + ' ' + it.unit + ' of ' + it.name + '?')) return;
    const logo = LOGO();
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Material Issue Slip</title><style>
      *{box-sizing:border-box;-webkit-print-color-adjust:exact}@page{size:A5 landscape;margin:8mm}body{font-family:Arial,sans-serif;color:#000;font-size:13px;padding:6mm}
      .wrap{border:2px solid #000;padding:12px}.hd{display:flex;align-items:center;justify-content:center;gap:10px;border-bottom:2px solid #000;padding-bottom:6px;margin-bottom:8px}
      .hd img{height:40px}.title{text-align:center;font-size:16px;font-weight:bold;letter-spacing:1px;margin:4px 0 12px;text-decoration:underline}
      table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:6px 8px}.lab{background:#eee;font-weight:bold;width:32%}
      .sign{display:flex;justify-content:space-between;margin-top:26px;font-weight:bold}</style></head>
      <body><div class="wrap"><div class="hd">${logo ? `<img src="${logo}">` : '<b style="font-size:18px">FIXOTECH</b>'}</div>
      <div class="title">MATERIAL ISSUE SLIP</div>
      <table>
        <tr><td class="lab">Date</td><td>${esc(t.date || '')}</td><td class="lab">Ref / Indent</td><td>${esc(t.orderIndent || t.bill || '')}</td></tr>
        <tr><td class="lab">Material</td><td>${esc(it.name)}</td><td class="lab">Type</td><td>${esc(it.type === 'accessory' ? 'Accessory' : 'Production material')}</td></tr>
        <tr><td class="lab">Quantity issued</td><td><b>${num(t.issue)} ${esc(it.unit)}</b></td><td class="lab">Balance after</td><td>${balanceOf(it)} ${esc(it.unit)}</td></tr>
        <tr><td class="lab">Issued to</td><td colspan="3">${esc(t.orderCustomer || t.particulars || '')}</td></tr>
        <tr><td class="lab">Remarks</td><td colspan="3">${esc(t.remarks || '')}</td></tr>
      </table>
      <div class="sign"><span>Issued by</span><span>Received by</span></div></div></body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
  }

  // ---- Add / edit a material ----
  function editItem(id) {
    const it = id ? findItem(id) : null;
    const m = modal(`<h3>${it ? 'Edit material' : 'Add material'}</h3>
      <div class="fx-modal-body inv-form">
        <label class="fx-lab">Material name</label><input class="fx-in" id="if-name" value="${it ? esc(it.name) : ''}" placeholder="e.g. M08 Anchor Fastener">
        <div class="inv-form-row">
          <div><label class="fx-lab">Type</label><select class="fx-in" id="if-type">
            <option value="accessory" ${it && it.type === 'accessory' ? 'selected' : ''}>Accessory (extras)</option>
            <option value="production" ${!it || it.type === 'production' ? 'selected' : ''}>Production material</option></select></div>
          <div><label class="fx-lab">Unit</label><select class="fx-in" id="if-unit">${['Nos', 'Sets', 'Kgs', 'Mtrs', 'Ltr', 'Sheets', 'Pcs'].map(u => `<option ${it && it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></div>
        </div>
        <div class="inv-form-row">
          <div><label class="fx-lab">${it ? 'Opening balance' : 'Opening stock'}</label><input class="fx-in" id="if-open" type="number" value="${it ? num(it.opening) : ''}" placeholder="0" ${it ? 'disabled title="Adjust via Receipt/Issue"' : ''}></div>
          <div><label class="fx-lab">Reorder level</label><input class="fx-in" id="if-min" type="number" min="0" value="${it ? num(it.minQty) : ''}" placeholder="0"></div>
        </div>
      </div>
      <div class="fx-modal-actions">${it ? '<button class="fx-btn so-del" id="if-del">Delete</button>' : ''}<button class="fx-btn" id="if-x">Cancel</button><button class="fx-btn fx-btn-go" id="if-ok">${it ? 'Save' : 'Add material'}</button></div>`);
    m.querySelector('#if-x').onclick = () => closeModal(m);
    if (it) m.querySelector('#if-del').onclick = () => { if (confirm('Delete “' + it.name + '” and its ledger?')) { save(load().filter(x => x.id !== id)); closeModal(m); render(); } };
    m.querySelector('#if-ok').onclick = () => {
      const name = m.querySelector('#if-name').value.trim(); if (!name) { toast('Enter a name'); return; }
      const list = load();
      if (it) { const t = list.find(x => x.id === id); t.name = name; t.type = m.querySelector('#if-type').value; t.unit = m.querySelector('#if-unit').value; t.minQty = num(m.querySelector('#if-min').value); }
      else list.push({ id: uid(), name, sheet: name, type: m.querySelector('#if-type').value, unit: m.querySelector('#if-unit').value, opening: num(m.querySelector('#if-open').value), minQty: num(m.querySelector('#if-min').value), txns: [] });
      save(list); closeModal(m); render(); toast(it ? 'Saved' : 'Material added');
    };
  }

  // ---- LINK FROM AN ORDER (Factory Floor) — raises an Issue slip ----
  function openLink(ctx, onDone) {
    ctx = ctx || {};
    const draw = () => {
      const items = load().slice().sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === 'accessory' ? -1 : 1));
      const mine = load().flatMap(it => (it.txns || []).filter(t => t.orderIndent === ctx.indentNo && (!ctx.desc || t.orderDesc === ctx.desc) && num(t.issue) > 0).map(t => ({ it, t })));
      const opts = items.map(s => `<option value="${s.id}">${s.type === 'accessory' ? '🔩 ' : '🏭 '}${esc(s.name)} — ${balanceOf(s)} ${esc(s.unit)} in stock</option>`).join('');
      const linked = mine.length ? `<div class="fx-det-label">Already issued for this order</div>
        <table class="fx-tbl"><tbody>${mine.map(x => `<tr><td><b>${esc(x.it.name)}</b></td><td class="c">${num(x.t.issue)} ${esc(x.it.unit)} issued</td><td class="c fx-meta">${balanceOf(x.it)} left</td><td class="c"><button class="fx-btn fx-btn-sm" data-unissue="${x.it.id}|${x.t.id}">↩</button></td></tr>`).join('')}</tbody></table>` : '';
      return `<h3>🔗 Use from inventory</h3>
        <div class="fx-modal-body">
          ${ctx.desc ? `<p class="fx-note">For <b>${esc(String(ctx.desc).split('\n')[0])}</b>${ctx.indentNo ? ' · Indent ' + esc(ctx.indentNo) : ''}${ctx.customer ? ' · ' + esc(ctx.customer) : ''}</p>` : ''}
          ${items.length ? `<label class="fx-lab">Material</label><select class="fx-in" id="il-item">${opts}</select>
          <div class="inv-link-avail" id="il-avail"></div>
          <label class="fx-lab">Quantity to issue</label><input class="fx-in" id="il-qty" type="number" min="0" value="${ctx.suggestQty ? num(ctx.suggestQty) : ''}" placeholder="0">
          <p class="fx-note" id="il-warn"></p>` : '<p class="fx-note">No materials yet.</p>'}
          ${linked}
        </div>
        <div class="fx-modal-actions"><button class="fx-btn" id="il-x">Close</button>${items.length ? '<button class="fx-btn fx-btn-go" id="il-ok">✓ Issue / deduct</button>' : ''}</div>`;
    };
    const m = modal(draw());
    const rebind = () => { m.querySelector('.fx-modal').innerHTML = draw(); wire(); };
    function wire() {
      const sel = m.querySelector('#il-item'), qty = m.querySelector('#il-qty'), av = m.querySelector('#il-avail'), warn = m.querySelector('#il-warn');
      const upd = () => {
        if (!sel) return; const it = findItem(sel.value); if (!it) return;
        const b = balanceOf(it); av.innerHTML = `In stock: <b>${b} ${esc(it.unit)}</b>`;
        const want = num(qty.value);
        warn.innerHTML = want > b ? `⚠ Only <b>${b}</b> available — shortage of <b>${want - b}</b>.` : want > 0 ? `✓ ${b - want} ${esc(it.unit)} will remain.` : '';
        warn.className = 'fx-note' + (want > b ? ' fx-note-warn' : '');
      };
      if (sel) { sel.onchange = upd; qty.oninput = upd; upd(); }
      const x = m.querySelector('#il-x'); if (x) x.onclick = () => { closeModal(m); if (onDone) onDone(); };
      const ok = m.querySelector('#il-ok');
      if (ok) ok.onclick = () => {
        const it = findItem(sel.value), want = num(qty.value);
        if (!it || want <= 0) { toast('Pick a material and quantity'); return; }
        const list = load(), t = list.find(x => x.id === it.id);
        const rec = { id: uid(), date: today(), particulars: ctx.customer || '', bill: ctx.indentNo || '', issue: want, remarks: 'Issued to production', orderIndent: ctx.indentNo || '', orderDesc: ctx.desc || '', orderCustomer: ctx.customer || '' };
        t.txns.push(rec); save(list);
        toast('Issued ' + want + ' ' + it.unit + ' of ' + it.name + ' — ' + balanceOf(t) + ' left');
        rebind();
      };
      m.querySelectorAll('[data-unissue]').forEach(b => b.onclick = () => {
        const [iid, tid] = b.dataset.unissue.split('|'); const list = load(); const it = list.find(x => x.id === iid);
        if (it) { it.txns = it.txns.filter(t => t.id !== tid); save(list); toast('Returned to stock'); rebind(); }
      });
    }
    wire();
  }

  // Issues raised for a given order line (Factory Floor detail view).
  function usageForOrder(indentNo, desc) {
    const out = [];
    load().forEach(it => (it.txns || []).forEach(t => {
      if (num(t.issue) > 0 && t.orderIndent === indentNo && (!desc || t.orderDesc === desc))
        out.push({ itemId: it.id, itemName: it.name, unit: it.unit, qty: num(t.issue) });
    }));
    return out;
  }

  function refreshBadge() {
    const b = document.getElementById('fh-inv-badge'); if (!b) return;
    const n = load().filter(s => statusOf(s) !== 'ok').length;
    if (n) { b.hidden = false; b.textContent = n; } else b.hidden = true;
  }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = `<div class="fx-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }
  function closeModal(m) { const o = m.classList && m.classList.contains('fx-modal-overlay') ? m : m.closest('.fx-modal-overlay'); if (o) o.remove(); }

  document.addEventListener('DOMContentLoaded', () => {
    seedOnce(); refreshBadge();
    if (localStorage.getItem('fixo_screen') === 'screen-inventory') render();
  });

  // Public API (names kept stable for the Factory Floor integration)
  window.FIXO_INVENTORY = {
    render, openLink, usageForOrder, refreshBadge,
    availableOf: balanceOf, loadStock: load, balanceOf, statusOf,
    printSummary, printLedger
  };
})();
