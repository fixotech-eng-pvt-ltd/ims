// ============================================================
// Fixotech — INDENT PREP  (office app, sits between Proforma & ChatIQ)
// Prepare a Production Work Order (indent) DIRECTLY — no need to open Proforma.
// Start from scratch, or pull line-items from a saved Proforma or a customer's
// past order/quotation, edit the indent, preview/print it, and send it to the
// Factory Floor (+ Dispatch) — urgent-flagging supported. A Tracker view shows
// every indent by status: drafts (saved here), sent (awaiting factory), and
// factory-approved. Reuses the shared PROD/R/05 builder (FIXO_PF.buildIndentHtml)
// and the shared factory pipeline (FIXO_FACTORY.receiveIndent) so nothing forks.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const logAct = (action, detail) => { try { if (window.FIXO_LOG) FIXO_LOG.activity('indent', action, detail || {}); } catch (e) {} };
  const uid = (p) => (p || 'id') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const DRAFTS = 'fixo_indent_drafts', FACTORY = 'fixo_factory_indents', SEQ = 'fixo_indent_seq';
  const loadDrafts = () => { try { return JSON.parse(localStorage.getItem(DRAFTS) || '[]') || []; } catch (e) { return []; } };
  const saveDrafts = (a) => { try { localStorage.setItem(DRAFTS, JSON.stringify(a.slice(0, 80))); } catch (e) {} };
  const loadSent = () => { try { return JSON.parse(localStorage.getItem(FACTORY) || '[]') || []; } catch (e) { return []; } };
  function nextIndentNo() { const n = (parseInt(localStorage.getItem(SEQ) || '0', 10) || 0) + 1; return String(n).padStart(3, '0'); }

  let view = 'prepare';         // prepare | tracker
  let model = null;             // current indent being prepared
  let clientsCache = [];
  let trackFilter = 'all';      // all | draft | sent | approved

  function freshModel() {
    return { id: uid('ind-'), indentNo: nextIndentNo(), indentDate: today(), indentCustomer: '', indentNotes: '', customer: '', priority: false, source: 'blank', items: [blankItem()], images: {}, status: 'draft' };
  }
  function blankItem() { return { sl: '', desc: '', qty: '', unit: 'Nos', dealtBy: '', deliveryDate: '' }; }

  // ---------- data sources ----------
  function clients() { return (window.FixoDB ? window.FixoDB.listClients() : Promise.resolve([])).then(a => (clientsCache = a || [])); }
  function itemsFromOrder(o) {
    return (o.items || []).map(it => ({ sl: '', desc: it.desc || it.name || '', qty: (it.qty != null ? it.qty : ''), unit: it.unit || it.uom || 'Nos', dealtBy: '', deliveryDate: '' }));
  }

  // ---------- root render ----------
  function hostEl() { return document.getElementById('indent-app'); }
  function render() {
    const host = hostEl(); if (!host) return;
    if (!model) model = freshModel();
    const drafts = loadDrafts(), sent = loadSent();
    const nApproved = sent.filter(s => s.factoryApproved).length;
    const nAwaiting = sent.length - nApproved;
    host.innerHTML = `
      <div class="idp-hero">
        <div class="idp-hero-t"><span class="idp-hero-ic">🗂️</span><div><h2>Indent Prep</h2><p>Prepare a Production Work Order &amp; send it to the factory</p></div></div>
        <div class="idp-stats">
          ${statCard(drafts.length, 'Saved drafts')}
          ${statCard(nAwaiting, 'Awaiting factory', nAwaiting ? 'amber' : '')}
          ${statCard(nApproved, 'Factory approved', 'green')}
        </div>
      </div>
      <div class="idp-tabs">
        <button class="idp-tab ${view === 'prepare' ? 'active' : ''}" data-v="prepare">📝 Prepare indent</button>
        <button class="idp-tab ${view === 'tracker' ? 'active' : ''}" data-v="tracker">📊 All indents ${sent.length + drafts.length ? `<em>${sent.length + drafts.length}</em>` : ''}</button>
      </div>
      <div id="idp-body"></div>`;
    host.querySelectorAll('.idp-tab').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    if (view === 'prepare') renderPrepare(); else renderTracker();
  }
  const statCard = (n, l, cls) => `<div class="idp-stat ${cls || ''}"><b>${n}</b><span>${l}</span></div>`;

  // ---------- PREPARE ----------
  function renderPrepare() {
    const body = document.getElementById('idp-body'); if (!body) return;
    const rows = model.items.map((it, i) => itemRow(it, i)).join('');
    body.innerHTML = `
      <div class="idp-source">
        <span class="idp-src-lab">Start from:</span>
        <button class="idp-src-btn ${model.source === 'blank' ? 'active' : ''}" data-src="blank">✎ Blank</button>
        <button class="idp-src-btn ${model.source === 'proforma' ? 'active' : ''}" data-src="proforma">🧾 A saved Proforma</button>
        <button class="idp-src-btn ${model.source === 'order' ? 'active' : ''}" data-src="order">📦 A past order / quotation</button>
        <span class="idp-src-note" id="idp-src-note">${model.source !== 'blank' && model.customer ? 'Loaded from ' + esc(model.source) + ' · ' + esc(model.customer) : ''}</span>
      </div>

      <div class="idp-card">
        <div class="idp-fields">
          <label>Indent No.<input id="idp-no" value="${esc(model.indentNo)}"></label>
          <label>Date<input id="idp-date" value="${esc(model.indentDate)}"></label>
          <label>Customer / Site (heading)<input id="idp-cust" value="${esc(model.indentCustomer)}" placeholder="e.g. Shivashakthi Entpr."></label>
          <label class="idp-wide">Notes (one per line — e.g. finish / colour)<textarea id="idp-notes" rows="2" placeholder="e.g. Siemens grey">${esc(model.indentNotes)}</textarea></label>
        </div>

        <div class="idp-items-wrap">
          <table class="idp-table">
            <thead><tr><th>Sl</th><th>Description</th><th>Qty</th><th>UOM</th><th>Dealt&nbsp;By</th><th>Delivery</th><th></th></tr></thead>
            <tbody id="idp-body-rows">${rows}</tbody>
          </table>
        </div>
        <button class="idp-add" id="idp-add">＋ Add line</button>

        <label class="idp-urgent"><input type="checkbox" id="idp-urgent" ${model.priority ? 'checked' : ''}> 🚩 Send as <b>URGENT</b> (alerts the factory floor)</label>

        <div class="idp-actions">
          <button class="idp-btn" id="idp-preview">🖨 Preview &amp; Print</button>
          <button class="idp-btn" id="idp-save">💾 Save draft</button>
          <button class="idp-btn idp-btn-go" id="idp-send">➤ Send to Factory</button>
        </div>
        <div id="idp-msg"></div>
      </div>`;

    // field bindings
    body.querySelector('#idp-no').oninput = e => model.indentNo = e.target.value;
    body.querySelector('#idp-date').oninput = e => model.indentDate = e.target.value;
    body.querySelector('#idp-cust').oninput = e => model.indentCustomer = e.target.value;
    body.querySelector('#idp-notes').oninput = e => model.indentNotes = e.target.value;
    body.querySelector('#idp-urgent').onchange = e => model.priority = e.target.checked;
    bindRows(body);
    body.querySelector('#idp-add').onclick = () => { model.items.push(blankItem()); renderPrepare(); };
    body.querySelectorAll('[data-src]').forEach(b => b.onclick = () => chooseSource(b.dataset.src));
    body.querySelector('#idp-preview').onclick = previewPrint;
    body.querySelector('#idp-save').onclick = saveDraft;
    body.querySelector('#idp-send').onclick = sendToFactory;
  }
  function itemRow(it, i) {
    const uoms = ['Nos', 'Mtrs', 'Kgs']; const cur = uoms.find(o => o.toLowerCase().slice(0, 3) === String(it.unit || 'Nos').toLowerCase().slice(0, 3)) || (it.unit || 'Nos');
    return `<tr data-i="${i}">
      <td><input class="idp-sl" value="${esc(it.sl || '')}" placeholder="—"></td>
      <td><textarea class="idp-desc" rows="2" placeholder="Product heading + sizes">${esc(it.desc || '')}</textarea></td>
      <td><input class="idp-qty" value="${it.qty === 0 || it.qty == null ? '' : esc(it.qty)}"></td>
      <td><select class="idp-uom">${[...new Set([cur, ...uoms])].map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select></td>
      <td><input class="idp-dealt" value="${esc(it.dealtBy || '')}"></td>
      <td><input class="idp-deliv" value="${esc(it.deliveryDate || '')}" placeholder="dd-mmm"></td>
      <td><button class="idp-del" title="Remove">×</button></td>
    </tr>`;
  }
  function bindRows(body) {
    body.querySelectorAll('#idp-body-rows tr').forEach(tr => {
      const i = +tr.dataset.i;
      const sync = () => { const it = model.items[i]; if (!it) return; it.sl = tr.querySelector('.idp-sl').value; it.desc = tr.querySelector('.idp-desc').value; it.qty = tr.querySelector('.idp-qty').value; it.unit = tr.querySelector('.idp-uom').value; it.dealtBy = tr.querySelector('.idp-dealt').value; it.deliveryDate = tr.querySelector('.idp-deliv').value; };
      tr.querySelectorAll('input,textarea,select').forEach(inp => { inp.oninput = sync; inp.onchange = sync; });
      tr.querySelector('.idp-del').onclick = () => { model.items.splice(i, 1); if (!model.items.length) model.items.push(blankItem()); renderPrepare(); };
    });
  }

  // ---------- source pickers ----------
  function chooseSource(src) {
    if (src === 'blank') { const keepNo = model.indentNo; model = freshModel(); model.indentNo = keepNo; renderPrepare(); return; }
    if (src === 'proforma') return pickProforma();
    if (src === 'order') return pickOrderCustomer();
  }
  function pickProforma() {
    let list = []; try { list = JSON.parse(localStorage.getItem('fixo_saved_proformas') || '[]'); } catch (e) {}
    const rows = list.length ? list.map(r => `<button class="idp-pick-row" data-pf="${r.id}"><b>${esc(r.customer || 'Proforma')}</b><span>${esc(r.refNo || '')} · ${esc(r.savedAt || '')} · ${(r.model && r.model.items || []).length} line(s)</span></button>`).join('')
      : '<div class="idp-empty">No saved proformas yet. Save one in the Proforma app first, or start blank.</div>';
    const m = modal(`<h3>Pick a saved Proforma</h3><div class="idp-pick-list">${rows}</div><div class="idp-modal-act"><button class="idp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelectorAll('[data-pf]').forEach(b => b.onclick = () => { const r = list.find(x => x.id === b.dataset.pf); m.remove(); if (r) loadFrom('proforma', r.model.customer || r.customer, itemsFromModel(r.model)); });
  }
  function itemsFromModel(mdl) { return (mdl.items || []).map(it => ({ sl: it.sl || '', desc: it.desc || '', qty: it.qty != null ? it.qty : '', unit: it.unit || it.uom || 'Nos', dealtBy: '', deliveryDate: '' })); }

  async function pickOrderCustomer() {
    if (!clientsCache.length) await clients();
    const listHtml = (q) => {
      const list = (window.FixoDB.searchClients ? window.FixoDB.searchClients(q, clientsCache) : clientsCache).slice(0, 40);
      return list.map(c => `<button class="idp-pick-row" data-cid="${c.id}"><b>${esc(c.company_name || c.client_name)}</b><span>${esc(c.gstin || '')}${c.state ? ' · ' + esc(c.state) : ''}</span></button>`).join('') || '<div class="idp-empty">No matching customer.</div>';
    };
    const m = modal(`<h3>Pick a customer</h3><input class="idp-search" id="idp-cs" placeholder="Search customer…"><div class="idp-pick-list" id="idp-cs-list">${listHtml('')}</div><div class="idp-modal-act"><button class="idp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    const wire = () => m.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { const c = clientsCache.find(x => x.id === b.dataset.cid); m.remove(); if (c) pickOrderForClient(c); });
    wire();
    m.querySelector('#idp-cs').oninput = (e) => { m.querySelector('#idp-cs-list').innerHTML = listHtml(e.target.value); wire(); };
  }
  async function pickOrderForClient(c) {
    let orders = []; try { orders = await window.FixoDB.listOrders(c.id); } catch (e) {}
    orders = (orders || []).slice().sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
    const rows = orders.length ? orders.map((o, i) => `<button class="idp-pick-row" data-oi="${i}"><b>${esc(o.quote_no || o.voucher_no || 'Order')}</b><span>${esc((o.order_date || '').slice(0, 10))} · ${(o.items || []).length} line(s) · ${esc(o.status || '')}</span></button>`).join('')
      : '<div class="idp-empty">This customer has no recorded orders/quotations. Start blank and type the lines.</div>';
    const m = modal(`<h3>${esc(c.company_name || c.client_name)} — pick an order/quotation</h3><div class="idp-pick-list">${rows}</div><div class="idp-modal-act"><button class="idp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelectorAll('[data-oi]').forEach(b => b.onclick = () => { const o = orders[+b.dataset.oi]; m.remove(); if (o) loadFrom('order', c.company_name || c.client_name, itemsFromOrder(o)); });
  }
  function loadFrom(source, customer, items) {
    const keepNo = model.indentNo;
    model = freshModel(); model.indentNo = keepNo;
    model.source = source; model.customer = customer || ''; model.indentCustomer = customer || '';
    model.items = items && items.length ? items : [blankItem()];
    renderPrepare();
    toast('Loaded ' + (items ? items.length : 0) + ' line(s) from ' + source);
  }

  // ---------- preview / print (shared PROD/R/05 builder) ----------
  function previewPrint() {
    const html = (window.FIXO_PF && FIXO_PF.buildIndentHtml)
      ? FIXO_PF.buildIndentHtml(model, { editable: true, size: model.items.length > 10 ? 'full' : 'auto' })
      : fallbackHtml();
    openEditor(html);
  }
  function openEditor(html) {
    const m = modal(`<div class="idp-editor-head"><b>Verify &amp; Print — Production Work Order</b><button class="idp-btn" data-x>Close</button></div>
      <iframe id="idp-frame" class="idp-frame"></iframe>
      <div class="idp-modal-act"><button class="idp-btn idp-btn-go" data-print>🖨 Print / Save PDF</button></div>`, true);
    const frame = m.querySelector('#idp-frame');
    const d = frame.contentDocument || frame.contentWindow.document; d.open(); d.write(html); d.close();
    if (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.attachReplaceUI) { try { FIXO_PRODUCT_IMG.attachReplaceUI(d, { imgClass: 'prod-thumb', onReplaced: () => toast('Picture updated') }); } catch (e) {} }
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-print]').onclick = () => { try { frame.contentWindow.focus(); frame.contentWindow.print(); logAct('printed', { no: model.indentNo, customer: model.indentCustomer }); } catch (e) { toast('Print blocked — allow pop-ups'); } };
  }
  function fallbackHtml() {
    const rows = model.items.map((it, i) => `<tr><td>${esc(it.sl || (i + 1))}</td><td>${esc(it.desc)}</td><td>${esc(it.qty)}</td><td>${esc(it.unit)}</td></tr>`).join('');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{font-family:Arial;padding:16px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:5px}</style></head><body><h3>PRODUCTION WORK ORDER — ${esc(model.indentCustomer)}</h3><div>No. ${esc(model.indentNo)} · ${esc(model.indentDate)}</div><table><thead><tr><th>Sl</th><th>Description</th><th>Qty</th><th>UOM</th></tr></thead><tbody>${rows}</tbody></table></body></html>`;
  }

  // ---------- save / send ----------
  function validate() {
    const real = model.items.filter(it => (it.desc || '').trim());
    if (!real.length) { toast('Add at least one line with a description'); return null; }
    if (!(model.indentCustomer || '').trim()) { toast('Enter the customer / site heading'); return null; }
    return real;
  }
  function saveDraft() {
    const real = validate(); if (!real) return;
    model.status = 'draft'; model.savedAt = today();
    const drafts = loadDrafts().filter(d => d.id !== model.id);
    drafts.unshift(JSON.parse(JSON.stringify(model)));
    saveDrafts(drafts);
    logAct('saved_draft', { no: model.indentNo, customer: model.indentCustomer, lines: real.length });
    const msg = document.getElementById('idp-msg'); if (msg) msg.innerHTML = `<div class="idp-ok">💾 Saved as a draft — find it under <b>All indents</b>. You can keep editing and send it later.</div>`;
    toast('Draft saved');
    try { window.dispatchEvent(new CustomEvent('fixo:sync', { detail: { keys: [DRAFTS] } })); } catch (e) {}
  }
  function sendToFactory() {
    const real = validate(); if (!real) return;
    const urgent = model.priority;
    const rec = {
      id: model.id || uid('ind-'), refNo: '', indentNo: model.indentNo || nextIndentNo(),
      indentDate: model.indentDate || today(), sentAt: new Date().toISOString(), priority: !!urgent,
      customer: model.indentCustomer || model.customer || '', customerAddr: '',
      indentCustomer: model.indentCustomer || model.customer || '', indentNotes: model.indentNotes || '',
      items: real.map((it, i) => ({ id: uid('it-'), sl: it.sl || '', desc: it.desc || '', qty: it.qty, unit: it.unit || 'Nos', dealtBy: it.dealtBy || '', deliveryDate: it.deliveryDate || '' }))
    };
    if (window.FIXO_FACTORY && FIXO_FACTORY.receiveIndent) FIXO_FACTORY.receiveIndent(rec);
    else { toast('Factory module not ready'); return; }
    // remove any draft with this id — it's now a live indent
    saveDrafts(loadDrafts().filter(d => d.id !== model.id));
    logAct('sent', { no: rec.indentNo, customer: rec.customer, urgent: !!urgent, lines: rec.items.length });
    localStorage.setItem(SEQ, String(parseInt(model.indentNo, 10) || (parseInt(localStorage.getItem(SEQ) || '0', 10))));
    const msg = document.getElementById('idp-msg');
    if (msg) msg.innerHTML = `<div class="idp-ok">✓ Indent <b>${esc(rec.indentNo)}</b> sent to the Factory Floor${urgent ? ' as <b>🚩 URGENT</b>' : ''} — it also lands with the Dispatch department. Track it under <b>All indents</b>.</div>`;
    toast(urgent ? 'Sent to Factory as URGENT 🚩' : 'Sent to Factory');
    model = freshModel();
    // refresh header stats but stay on the confirmation
    const drafts = loadDrafts(), sent = loadSent();
    setTimeout(() => { view = 'tracker'; render(); }, 900);
  }

  // ---------- TRACKER ----------
  function renderTracker() {
    const body = document.getElementById('idp-body'); if (!body) return;
    const drafts = loadDrafts().map(d => ({ kind: 'draft', d }));
    const sent = loadSent().map(s => ({ kind: s.factoryApproved ? 'approved' : 'sent', d: s }));
    let all = [...drafts, ...sent];
    if (trackFilter !== 'all') all = all.filter(x => x.kind === trackFilter);
    const chip = (k) => k === 'draft' ? '<span class="idp-chip draft">📝 Draft (not sent)</span>' : k === 'approved' ? '<span class="idp-chip ok">✓ Approved by factory</span>' : '<span class="idp-chip wait">⏳ At factory — awaiting approval</span>';
    const rows = all.length ? all.map(({ kind, d }) => {
      const lines = (d.items || []).length;
      const when = d.savedAt || (d.sentAt ? new Date(d.sentAt).toLocaleString('en-IN') : '');
      const actions = kind === 'draft'
        ? `<button class="idp-mini" data-open="${d.id}">✎ Open</button><button class="idp-mini" data-send="${d.id}">➤ Send</button><button class="idp-mini idp-mini-x" data-del="${d.id}">🗑</button>`
        : `<button class="idp-mini" data-reprint="${d.id}">🖨 Reprint</button>`;
      return `<div class="idp-track-row ${kind}">
        <div class="idp-track-main"><b>${esc(d.indentCustomer || d.customer || 'Indent')}</b>
          <span class="idp-track-sub">No. ${esc(d.indentNo || '—')} · ${lines} line(s)${when ? ' · ' + esc(when) : ''}${d.priority ? ' · 🚩 URGENT' : ''}</span></div>
        <div class="idp-track-status">${chip(kind)}</div>
        <div class="idp-track-act">${actions}</div>
      </div>`;
    }).join('') : `<div class="idp-empty">No indents in this view yet. Prepare one under <b>Prepare indent</b>.</div>`;

    const f = (k, lbl) => `<button class="idp-vt ${trackFilter === k ? 'active' : ''}" data-f="${k}">${lbl}</button>`;
    body.innerHTML = `
      <div class="idp-track-bar">
        ${f('all', 'All')} ${f('draft', '📝 Drafts')} ${f('sent', '⏳ At factory')} ${f('approved', '✓ Approved')}
      </div>
      <div class="idp-track-list">${rows}</div>`;
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { trackFilter = b.dataset.f; renderTracker(); });
    body.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const d = loadDrafts().find(x => x.id === b.dataset.open); if (d) { model = JSON.parse(JSON.stringify(d)); view = 'prepare'; render(); } });
    body.querySelectorAll('[data-send]').forEach(b => b.onclick = () => { const d = loadDrafts().find(x => x.id === b.dataset.send); if (d) { model = JSON.parse(JSON.stringify(d)); sendToFactory(); } });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('Delete this draft?')) return; saveDrafts(loadDrafts().filter(x => x.id !== b.dataset.del)); renderTracker(); });
    body.querySelectorAll('[data-reprint]').forEach(b => b.onclick = () => { const s = loadSent().find(x => x.id === b.dataset.reprint); if (s) { model = normalizeSent(s); previewPrint(); } });
  }
  function normalizeSent(s) {
    return { id: s.id, indentNo: s.indentNo, indentDate: s.indentDate, indentCustomer: s.indentCustomer || s.customer, indentNotes: s.indentNotes || '', customer: s.customer, priority: !!s.priority, images: {}, items: (s.items || []).map(it => ({ sl: it.sl || '', desc: it.desc || '', qty: it.qty, unit: it.unit || 'Nos', dealtBy: it.dealtBy || '', deliveryDate: it.deliveryDate || '' })) };
  }

  // ---------- modal helper ----------
  function modal(inner, big) {
    const el = document.createElement('div'); el.className = 'idp-overlay';
    el.innerHTML = `<div class="idp-modal ${big ? 'big' : ''}">${inner}</div>`;
    document.body.appendChild(el);
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    return el;
  }

  // ---------- boot ----------
  function boot() {
    document.querySelectorAll('[data-open-app="screen-indent"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-indent') render();
  }
  document.addEventListener('DOMContentLoaded', boot);
  // live refresh when factory approval / new indents arrive from the cloud
  window.addEventListener('fixo:sync', (e) => { if (document.body.dataset.screen === 'screen-indent' && view === 'tracker') { const keys = (e.detail && e.detail.keys) || []; if (!keys.length || keys.indexOf(FACTORY) >= 0 || keys.indexOf(DRAFTS) >= 0) renderTracker(); } });

  window.FIXO_INDENT = { render };
})();
