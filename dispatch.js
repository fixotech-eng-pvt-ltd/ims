// ============================================================
// Fixotech DISPATCH  (factory-side app #2)
// ------------------------------------------------------------
// Same factory store (interconnected). Three tabs:
//   Ready — items marked Ready to Dispatch → dispatch note + mark dispatched
//   Inbound / Comparison — every order line with ordered vs done vs remaining
//   Dispatched — log of what's gone out
// The dispatch note auto-adds joint plates & bolts:
//   metres ÷ 2.5 = Nos ; Nos × 2 = joint plates ; plates × 4 = bolts.
// "Dispatched" flows back to the office (bell + saved log).
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const F = () => window.FIXO_FACTORY || {};
  let tab = 'ready';

  function notifyOffice(type, indentNo, extra) {
    try { const n = JSON.parse(localStorage.getItem('fixo_office_notifications') || '[]'); n.unshift(Object.assign({ type, indentNo: indentNo || '', at: new Date().toISOString(), seen: false }, extra || {})); localStorage.setItem('fixo_office_notifications', JSON.stringify(n)); } catch (e) {}
    if (window.FIXO_OFFICE && FIXO_OFFICE.refreshBell) FIXO_OFFICE.refreshBell();
  }
  function sendNoteToOffice(g) {
    try {
      const log = JSON.parse(localStorage.getItem('fixo_dispatch_log') || '[]');
      log.unshift({ id: 'dp-' + Date.now(), customer: g.customer, indentNo: g.indentNo || '', at: new Date().toISOString(), count: g.items.length, items: g.items.map(it => ({ desc: it.desc, qty: it.qty, unit: it.unit, weight: it.weight, finish: it.finish })) });
      localStorage.setItem('fixo_dispatch_log', JSON.stringify(log.slice(0, 200)));
    } catch (e) {}
    notifyOffice('dispatch_note_sent', g.indentNo || '', { customer: g.customer, reason: g.items.length + ' item(s) — dispatch note sent' });
    if (window.FIXO_DISPATCH_RECORDS && FIXO_DISPATCH_RECORDS.refreshBadge) FIXO_DISPATCH_RECORDS.refreshBadge();
    toast('📤 Dispatch note sent to Office — saved in Dispatch Records');
  }
  function todayNo() { return '00' + (22 + (JSON.parse(localStorage.getItem('fixo_dispatch_seq') || '0'))); }
  function ready() { return (F().getReadyGroups ? F().getReadyGroups() : []); }
  function allG() { return (F().getAllGroups ? F().getAllGroups() : []); }
  function dispatched() { return (F().getDispatched ? F().getDispatched() : []); }
  const isMtr = (u) => /mtr|meter/i.test(u || '');
  // Accessories from a tray's running metres.
  function accessories(mtrs) { const nos = Math.round(mtrs / 2.5); const plates = nos * 2; const bolts = plates * 4; return { nos, plates, bolts }; }

  function render() {
    const host = document.getElementById('dispatch-app'); if (!host) return;
    // Phase 1 testing: the indent reaches Dispatch for viewing & printing only —
    // lock to the Indents tab (dispatch actions are Phase 2).
    const testingScope = !!(window.FIXO_TESTING && FIXO_TESTING.isOn());
    if (testingScope) tab = 'indent';
    const rg = ready(), today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const logo = F().LOGO ? F().LOGO() : '';
    const rc = rg.reduce((n, g) => n + g.items.length, 0);
    host.innerHTML = `
      <div class="fx-hero dp-hero">
        <div class="fx-hero-title"><span class="fx-hero-ic">🚚</span><div><h2>Dispatch</h2><p>Today's dispatch · ${esc(today)}</p></div></div>
        <div class="fx-hero-right"><div class="fx-stats">
          <div class="fx-stat"><b>${rg.length}</b><span>Customers</span></div>
          <div class="fx-stat green"><b>${rc}</b><span>Ready</span></div>
          <div class="fx-stat"><b>${dispatched().length}</b><span>Dispatched</span></div>
        </div>${logo ? `<div class="fx-logo-chip"><img src="${logo}" onerror="this.style.display='none'"></div>` : ''}</div>
      </div>
      <div class="fx-tabs">
        <button class="fx-tab ${tab === 'indent' ? 'active' : ''}" data-t="indent">📋 Indents ${allG().length ? `<span class="fx-badge">${allG().length}</span>` : ''}</button>
        ${testingScope ? '' : `<button class="fx-tab ${tab === 'ready' ? 'active' : ''}" data-t="ready">📦 Ready ${rc ? `<span class="fx-badge">${rc}</span>` : ''}</button>
        <button class="fx-tab ${tab === 'compare' ? 'active' : ''}" data-t="compare">⚖ Comparison</button>
        <button class="fx-tab ${tab === 'log' ? 'active' : ''}" data-t="log">✅ Dispatched</button>`}
      </div>
      <div id="dp-body"></div>`;
    host.querySelectorAll('.fx-tab').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    const body = document.getElementById('dp-body');
    if (tab === 'indent') renderIndentTab(body);
    else if (tab === 'ready') renderReady(body, rg);
    else if (tab === 'compare') renderCompare(body, allG());
    else renderLog(body, dispatched());
  }

  // ---- INDENT tab (all indents arrive here too; dispatch-dept approval) ----
  function loadAppr() { try { return JSON.parse(localStorage.getItem('fixo_dispatch_approvals') || '{}'); } catch (e) { return {}; } }
  function saveAppr(o) { try { localStorage.setItem('fixo_dispatch_approvals', JSON.stringify(o)); } catch (e) {} }
  function renderIndentTab(body) {
    // Use the raw per-indent list so we can show URGENT and print the exact
    // indent that arrived (dispatch has its own printer).
    const inds = (F().getIndents ? F().getIndents() : []).slice()
      .sort((a, b) => (b.priority ? 1 : 0) - (a.priority ? 1 : 0));   // urgent first
    if (!inds.length) { body.innerHTML = emptyState('No indents yet', 'Every indent sent to the factory also lands here for the dispatch department — ready to print.'); return; }
    const appr = loadAppr();
    body.innerHTML = inds.map(g => {
      const a = appr[g.indentNo], pr = g.priority;
      return `<div class="fx-card ${pr ? 'fx-priority' : ''}">
        <div class="fx-card-top">
          <div><b class="fx-cust">${pr ? '<span class="fx-prio-tag">🚩 URGENT</span> ' : ''}${esc(g.customer)}</b><span class="fx-meta">Indent No. ${esc(g.indentNo)} · ${esc(g.indentDate || '')} · ${g.items.length} line(s)</span></div>
          <div class="fx-card-btns">
            <button class="fx-btn fx-print" data-print="${esc(g.id)}" data-copy="white" title="Print the indent on your printer">🖨 Print indent</button>
            ${a ? `<span class="fx-approved">✓ Dispatch approved</span>` : `<button class="fx-btn fx-btn-go" data-dappr="${esc(g.indentNo)}">✓ Approve (dispatch dept)</button>`}
          </div>
        </div>
        <table class="fx-tbl"><thead><tr><th>Sl</th><th>Description</th><th>Qty</th><th>UOM</th></tr></thead>
          <tbody>${g.items.map(it => `<tr><td class="c">${esc(it.sl != null ? it.sl : '')}</td><td>${esc((F().shortName ? F().shortName(it.desc) : it.desc))}${it.finish ? `<span class="fx-fin">${esc(it.finish)}</span>` : ''}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td></tr>`).join('')}</tbody>
        </table></div>`;
    }).join('');
    body.querySelectorAll('[data-print]').forEach(b => b.onclick = () => { if (F().printIndent) F().printIndent(b.dataset.print, b.dataset.copy || 'white'); });
    body.querySelectorAll('[data-dappr]').forEach(b => b.onclick = () => { const o = loadAppr(); o[b.dataset.dappr] = { at: new Date().toISOString() }; saveAppr(o); notifyOffice('dispatch_approved', b.dataset.dappr); toast('Dispatch dept approved — office notified'); render(); });
  }

  // ---- COMPARISON tab (indent vs dispatch note, side by side) ----
  function renderCompare(body, gs) {
    if (!gs.length) { body.innerHTML = emptyState('Nothing to compare', 'Indents and their dispatch notes appear here side by side.'); return; }
    const readyG = ready();
    body.innerHTML = gs.map(g => {
      const ready4 = (readyG.find(r => r.indentNo === g.indentNo) || { items: [] }).items;
      const indentRows = g.items.map(it => `<tr><td>${esc((F().shortName ? F().shortName(it.desc) : it.desc))}</td><td class="c">${esc(it.qty)} ${esc(it.unit)}</td></tr>`).join('');
      const noteRows = ready4.length ? ready4.map(it => { const a = isMtr(it.unit) ? accessories(num(it.qty)) : null; return `<tr><td>${esc((F().shortName ? F().shortName(it.desc) : it.desc))}${a ? `<div class="dp-size">+ ${a.plates} plates, ${a.bolts} bolts</div>` : ''}</td><td class="c">${esc(it.qty)} ${esc(it.unit)}</td></tr>`; }).join('') : '<tr><td colspan="2" class="c fx-meta">No items ready yet</td></tr>';
      return `<div class="fx-card"><div class="fx-card-top"><div><b class="fx-cust">${esc(g.customer)}</b><span class="fx-meta">Indent No. ${esc(g.indentNo)} · ${esc(g.indentDate || '')}</span></div></div>
        <div class="dp-compare">
          <div class="dp-comp-col"><div class="dp-comp-h">📋 INDENT (ordered)</div><table class="fx-tbl"><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${indentRows}</tbody></table></div>
          <div class="dp-comp-col"><div class="dp-comp-h">🚚 DISPATCH NOTE (ready)</div><table class="fx-tbl"><thead><tr><th>Item</th><th>Qty</th></tr></thead><tbody>${noteRows}</tbody></table></div>
        </div></div>`;
    }).join('');
  }

  // ---- READY tab ----
  function renderReady(body, gs) {
    if (!gs.length) { body.innerHTML = emptyState('Nothing ready to dispatch', 'Items reach here once the Factory Floor marks them <b>Ready to Dispatch</b>.'); return; }
    body.innerHTML = `<div class="dp-bar">
        <button class="fx-btn fx-print" id="dp-print-all">🖨 Generate Today's Dispatch (all)</button>
        <button class="fx-btn fx-btn-go" id="dp-all-done">✓ Completely Dispatched (all)</button>
      </div>${gs.map(dpCard).join('')}`;
    body.querySelectorAll('[data-note]').forEach(b => b.onclick = () => printNote([gs[+b.dataset.note]]));
    body.querySelectorAll('[data-send]').forEach(b => b.onclick = () => sendNoteToOffice(gs[+b.dataset.send]));
    body.querySelectorAll('[data-dispatch]').forEach(b => b.onclick = () => doDispatch(gs[+b.dataset.dispatch]));
    const all = document.getElementById('dp-print-all'); if (all) all.onclick = () => printNote(gs);
    const ad = document.getElementById('dp-all-done'); if (ad) ad.onclick = () => doDispatch({ customer: 'all customers', items: gs.reduce((a, g) => a.concat(g.items), []) }, true);
  }
  function dpCard(g, i) {
    return `<div class="fx-card dp-card">
      <div class="fx-card-top">
        <div><b class="fx-cust">${esc(g.customer)}</b><span class="fx-meta">Indent No. ${esc(g.indentNo)} · ${g.items.length} item(s) ready</span></div>
        <div class="fx-card-btns">
          <button class="fx-btn fx-print" data-note="${i}">🖨 Dispatch note</button>
          <button class="fx-btn" data-send="${i}">📤 Send to Office</button>
          <button class="fx-btn fx-btn-go" data-dispatch="${i}">✓ Mark dispatched</button>
        </div>
      </div>
      <table class="fx-tbl"><thead><tr><th>Description</th><th>Qty</th><th>UOM</th><th>Accessories (auto)</th><th>Weight</th></tr></thead>
        <tbody>${g.items.map(it => { const a = isMtr(it.unit) ? accessories(num(it.qty)) : null; return `<tr><td>${esc((F().shortName ? F().shortName(it.desc) : it.desc))}${it.finish ? `<span class="fx-fin">${esc(it.finish)}</span>` : ''}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td><td class="c">${a ? `${a.plates} plates · ${a.bolts} bolts` : '—'}</td><td class="c">${esc(it.weight || '—')}</td></tr>`; }).join('')}</tbody>
      </table>
    </div>`;
  }

  // ---- INBOUND / COMPARISON tab (ordered vs done vs remaining) ----
  function renderInbound(body, gs) {
    if (!gs.length) { body.innerHTML = emptyState('No inbound orders', 'Orders sent to the factory show here for comparison.'); return; }
    const S = F().STAGES || {};
    body.innerHTML = gs.map(g => `<div class="fx-card">
      <div class="fx-card-top"><div><b class="fx-cust">${esc(g.customer)}</b><span class="fx-meta">Indent No. ${esc(g.indentNo)} · ${g.items.length} line(s)</span></div></div>
      <table class="fx-tbl"><thead><tr><th>Description</th><th>Ordered</th><th>Done</th><th>Remaining</th><th>Status</th></tr></thead>
        <tbody>${g.items.map(it => { const total = num(it.qtyTotal), done = num(it.qtyDone), rem = total - done; return `<tr>
          <td>${esc((F().shortName ? F().shortName(it.desc) : it.desc))}${it.finish ? `<span class="fx-fin">${esc(it.finish)}</span>` : ''}</td>
          <td class="c">${esc(it.qty)} ${esc(it.unit)}</td>
          <td class="c">${done || 0}</td>
          <td class="c">${rem > 0 ? `<span class="fx-rem">${rem} left</span>` : '<span class="fx-fi-ok">0</span>'}</td>
          <td class="c"><span class="fx-status fx-st-${it.status}">${esc(S[it.status] || it.status)}</span>${it.dispatched ? ' <span class="fx-fi-ok">🚚 sent</span>' : ''}</td></tr>`; }).join('')}</tbody>
      </table></div>`).join('');
  }

  // ---- DISPATCHED log ----
  function renderLog(body, list) {
    if (!list.length) { body.innerHTML = emptyState('Nothing dispatched yet', 'Dispatched items appear here and are saved to the office.'); return; }
    body.innerHTML = `<div class="fx-card"><table class="fx-tbl"><thead><tr><th>Customer</th><th>Description</th><th>Qty</th><th>Weight</th><th>Dispatched on</th></tr></thead>
      <tbody>${list.map(x => `<tr><td>${esc(x.ind.customer)}</td><td>${esc((F().shortName ? F().shortName(x.it.desc) : x.it.desc))}</td><td class="c">${esc(x.it.qty)} ${esc(x.it.unit)}</td><td class="c">${esc(x.it.weight || '—')}</td><td class="c">${x.it.dispatchedAt ? new Date(x.it.dispatchedAt).toLocaleString('en-IN') : '—'}</td></tr>`).join('')}</tbody>
    </table></div>`;
  }

  // ---- Editable "TODAY'S DISPATCH" note (auto joint plates + bolts) + print ----
  function buildNoteHtml(gs, meta) {
    meta = meta || {};
    const today = meta.date || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    const noNo = meta.no != null ? meta.no : todayNo();
    const title = meta.title || "TODAY'S DISPATCH";
    const logo = F().LOGO ? F().LOGO() : '';
    const blocks = gs.map((g, i) => {
      let totalPlates = 0, totalBolts = 0;
      const rows = g.items.map((it, j) => {
        let extra = '';
        if (isMtr(it.unit)) { const a = accessories(num(it.qty)); totalPlates += a.plates; totalBolts += a.bolts; extra = ` <span style="color:#555">→ ${a.plates} joint plates, ${a.bolts} bolt sets</span>`; }
        return `<tr><td class="c">${j + 1}</td><td>${esc(it.desc).replace(/\n/g, '<br>')}${it.finish ? ' <i>(' + esc(it.finish) + ')</i>' : ''}${extra}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td><td class="c">${esc(it.weight || '')}</td></tr>`;
      }).join('');
      const acc = (totalPlates || totalBolts) ? `<tr><td></td><td><b>Connector / Joint plate</b></td><td class="c"><b>${totalPlates}</b></td><td class="c">Nos</td><td></td></tr><tr><td></td><td><b>Bolt, Nut &amp; Washer</b></td><td class="c"><b>${totalBolts}</b></td><td class="c">Sets</td><td></td></tr>` : '';
      return `<div class="blk"><div class="blk-head">${i + 1}) ${esc(g.customer)} — <b>${esc(g.indentNo)}</b></div>
        <table class="tbl"><thead><tr><th style="width:7%">Sl</th><th>Description</th><th style="width:12%">Qty</th><th style="width:9%">UOM</th><th style="width:13%">Weight (kg)</th></tr></thead>
          <tbody>${rows}${acc}</tbody></table></div>`;
    }).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Today's Dispatch</title><style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact}@page{size:A4;margin:10mm}html,body{background:#fff}
body{font-family:Arial,Helvetica,sans-serif;color:#000;font-size:12px;margin:0;padding:6mm}
.wrap{border:2px solid #000;padding:10px}.hd{display:flex;align-items:center;justify-content:center;gap:12px;border-bottom:2px solid #000;padding-bottom:8px;margin-bottom:8px}
.hd img{height:46px}.top{display:flex;justify-content:space-between;font-weight:bold;margin-bottom:10px}
.title{text-align:center;font-size:17px;font-weight:bold;text-decoration:underline;margin:6px 0 14px;letter-spacing:1px}
.blk{margin-bottom:16px}.blk-head{font-weight:bold;font-size:14px;text-decoration:underline;margin-bottom:6px}
.tbl{width:100%;border-collapse:collapse}.tbl th,.tbl td{border:1px solid #000;padding:4px 6px;font-size:11.5px}
.c{text-align:center}.sign{display:flex;justify-content:space-between;margin-top:24px;font-weight:bold}
@media print{body{padding:0}}</style></head><body>
<div class="wrap"><div class="layer" contenteditable="true" spellcheck="false">
  <div class="hd">${logo ? `<img src="${logo}">` : '<b style="font-size:20px">FIXOTECH</b>'}</div>
  <div class="top"><span>No. ${esc(noNo)}</span><span>Date : ${esc(today)}</span></div>
  <div class="title">${esc(title)}</div>${blocks}
  <div class="sign"><span>Prepared by</span><span>Received by</span></div>
</div></div></body></html>`;
  }

  function printNote(gs) {
    if (!gs.length) { toast('Nothing ready to dispatch'); return; }
    const m = modal(`<div class="fx-ed-head"><h3>Verify &amp; Print — Today's Dispatch</h3><span class="fx-ed-hint">✎ Click any cell to edit. Joint plates &amp; bolts auto-added.</span></div>
      <div class="fx-ed-body"><iframe id="dp-frame"></iframe></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="dp-cancel">Cancel</button><button class="fx-btn" id="dp-send-office">📤 Send to Office</button><button class="fx-btn fx-btn-go" id="dp-print">🖨 Proceed to Print</button></div>`, 'fx-ed-modal');
    const fr = m.querySelector('#dp-frame'); const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(buildNoteHtml(gs)); d.close();
    m.querySelector('#dp-cancel').onclick = () => closeModal(m);
    m.querySelector('#dp-send-office').onclick = () => { gs.forEach(sendNoteToOffice); closeModal(m); };
    m.querySelector('#dp-print').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }

  function doDispatch(g, all) {
    const m = modal(`<h3>Confirm dispatch — ${esc(g.customer)}</h3>
      <div class="fx-modal-body"><p class="fx-note">Mark ${g.items.length} item(s) as <b>DISPATCHED</b>. This updates the Factory Floor, saves to the office dispatch log, and notifies the office.</p></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="dp-x">Cancel</button><button class="fx-btn fx-btn-go" id="dp-ok">✓ Confirm dispatched</button></div>`);
    m.querySelector('#dp-x').onclick = () => closeModal(m);
    m.querySelector('#dp-ok').onclick = () => {
      if (F().markDispatched) F().markDispatched(g.items.map(it => it.id));
      // Save a dispatch record to the office log.
      try {
        const log = JSON.parse(localStorage.getItem('fixo_dispatch_log') || '[]');
        log.unshift({ id: 'dp-' + Date.now(), customer: g.customer, indentNo: g.indentNo || '', at: new Date().toISOString(), count: g.items.length, items: g.items.map(it => ({ desc: it.desc, qty: it.qty, unit: it.unit, weight: it.weight, finish: it.finish })) });
        localStorage.setItem('fixo_dispatch_log', JSON.stringify(log.slice(0, 200)));
        const seq = (JSON.parse(localStorage.getItem('fixo_dispatch_seq') || '0')) + 1; localStorage.setItem('fixo_dispatch_seq', JSON.stringify(seq));
      } catch (e) {}
      closeModal(m); toast('✓ Dispatched — office notified & saved'); render();
    };
  }

  function emptyState(t, s) { return `<div class="fx-empty"><div class="fx-empty-ic">🚚</div><h3>${esc(t)}</h3><p>${s}</p></div>`; }
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = `<div class="fx-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) closeModal(el); }); return el; }
  function closeModal(m) { const o = m.classList.contains('fx-modal-overlay') ? m : m.closest('.fx-modal-overlay'); if (o) o.remove(); }

  document.addEventListener('DOMContentLoaded', () => {
    if (document.body.dataset.screen === 'screen-dispatch' || (function () { try { return localStorage.getItem('fixo_screen') === 'screen-dispatch'; } catch (e) { return false; } })()) render();
  });
  window.FIXO_DISPATCH = { render, buildNote: buildNoteHtml, accessories, isMtr };
})();
