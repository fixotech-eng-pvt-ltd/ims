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
    return { id: uid('ind-'), indentNo: nextIndentNo(), indentDate: today(), indentCustomer: '', indentNotes: '', preparedBy: currentUserName(), deliveryAddr: '', customer: '', priority: false, source: 'blank', items: [blankItem()], images: {}, status: 'draft' };
  }
  function blankItem() { return { sl: '', desc: '', qty: '', unit: 'Nos', dealtBy: '', deliveryDate: '' }; }

  // Product picker (material variance + product) — sets the line description so the
  // matching product photo is auto-chosen on the printed indent.
  const MATERIALS = [
    { key: 'gi', label: 'GI (Pre-Galvanised)', prefix: 'GI', ic: '🧲' },
    { key: 'hotdip', label: 'Hot Dip Galvanised', prefix: 'Hot Dip', ic: '🔥' },
    { key: 'powder', label: 'Powder Coated', prefix: 'Powder Coated', ic: '🎨' },
    { key: 'ms', label: 'MS (Mild Steel)', prefix: 'MS', ic: '⚙️' },
    { key: 'ss', label: 'Stainless Steel', prefix: 'SS', ic: '✨' }
  ];
  const BASE_PRODUCTS = [
    'Perforated Cable Tray', 'Ladder Type Cable Tray', 'Raceway With Cover', 'Slotted Channel',
    'Horizontal Bend', 'Vertical Bend', 'Cross Bend', 'Tee Bend', 'Reducer',
    'Junction Box', 'Coupler Plate', 'Threaded Rod', 'Anchor Fastener', 'Bolt, Nut & Washer Set'
  ];
  const imgUrl = (name) => { try { return (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.guessUrl) ? FIXO_PRODUCT_IMG.guessUrl(name) : ''; } catch (e) { return ''; } };
  const currentUserName = () => { try { const u = window.FIXO_AUTH && FIXO_AUTH.currentUser(); return u ? (u.name || u.email || '') : ''; } catch (e) { return ''; } };

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
          <label>Prepared by (your name — signs the indent)<input id="idp-prepby" value="${esc(model.preparedBy || '')}" placeholder="Preparer name"></label>
          <label class="idp-wide">Delivery address (for Dispatch — where to send the material)<textarea id="idp-deliv" rows="2" placeholder="Site / delivery address & contact">${esc(model.deliveryAddr || '')}</textarea></label>
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
    body.querySelector('#idp-prepby').oninput = e => model.preparedBy = e.target.value;
    body.querySelector('#idp-deliv').oninput = e => model.deliveryAddr = e.target.value;
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
    const thumb = (it.desc && (it.desc || '').trim()) ? imgUrl(it.desc) : '';
    return `<tr data-i="${i}">
      <td><input class="idp-sl" value="${esc(it.sl || '')}" placeholder="—"></td>
      <td>
        <div class="idp-desc-cell">
          ${thumb ? `<img class="idp-desc-thumb" src="${thumb}" onerror="this.style.display='none'">` : ''}
          <textarea class="idp-desc" rows="2" placeholder="Tap “Pick product”, or type the heading + sizes">${esc(it.desc || '')}</textarea>
        </div>
        <button class="idp-pick-prod" data-pick="${i}">🔍 Pick product &amp; material</button>
      </td>
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
      const pick = tr.querySelector('.idp-pick-prod'); if (pick) pick.onclick = () => pickProductForRow(i);
      tr.querySelector('.idp-del').onclick = () => { model.items.splice(i, 1); if (!model.items.length) model.items.push(blankItem()); renderPrepare(); };
    });
  }

  // Per-line product picker: choose material (GI/MS/SS…) then the product (photos).
  // Sets the line's description to "<material> <product>" so the print auto-shows
  // the matching product image. Any sizes the user typed are preserved below it.
  function pickProductForRow(i) {
    const it = model.items[i]; if (!it) return;
    const matBtns = MATERIALS.map(mm => `<button class="idp-mat-opt" data-mat="${mm.key}"><span>${mm.ic}</span>${esc(mm.label)}</button>`).join('');
    const m = modal(`<h3>Choose product for line ${i + 1}</h3>
      <div class="idp-pick-step"><div class="idp-pick-lab">1 · Material / finish</div><div class="idp-mat-opts">${matBtns}</div></div>
      <div class="idp-pick-step" id="idp-prod-step" hidden><div class="idp-pick-lab">2 · Product</div><div class="idp-prod-grid" id="idp-prod-grid"></div></div>
      <div class="idp-modal-act"><button class="idp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    let chosenMat = null;
    m.querySelectorAll('[data-mat]').forEach(b => b.onclick = () => {
      chosenMat = MATERIALS.find(x => x.key === b.dataset.mat);
      m.querySelectorAll('[data-mat]').forEach(x => x.classList.toggle('active', x === b));
      const grid = m.querySelector('#idp-prod-grid');
      grid.innerHTML = BASE_PRODUCTS.map(p => { const u = imgUrl((chosenMat.prefix ? chosenMat.prefix + ' ' : '') + p); return `<button class="idp-prod-card" data-prod="${esc(p)}">${u ? `<img src="${u}" onerror="this.style.display='none'">` : '<span class="idp-prod-ic">📦</span>'}<span>${esc(p)}</span></button>`; }).join('');
      m.querySelector('#idp-prod-step').hidden = false;
      grid.querySelectorAll('[data-prod]').forEach(pb => pb.onclick = () => {
        const name = (chosenMat.prefix ? chosenMat.prefix + ' ' : '') + pb.dataset.prod;
        // keep any extra size lines the user already typed (lines after the first)
        const extra = (it.desc || '').split('\n').slice(1).join('\n').trim();
        it.desc = extra ? name + '\n' + extra : name;
        m.remove(); renderPrepare();
      });
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
    const m = modal(`<div class="idp-editor-head"><b>Verify &amp; Print — Production Work Order</b><span class="idp-ed-hint">✎ Edit any cell, then Save.</span><button class="idp-btn" data-x>Close</button></div>
      <iframe id="idp-frame" class="idp-frame"></iframe>
      <div class="idp-modal-act"><button class="idp-btn idp-btn-save" data-save>💾 Save changes</button><button class="idp-btn idp-btn-go" data-print>🖨 Save &amp; Print PDF</button></div>`, true);
    const frame = m.querySelector('#idp-frame');
    const d = frame.contentDocument || frame.contentWindow.document; d.open(); d.write(html); d.close();
    if (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.attachReplaceUI) { try { FIXO_PRODUCT_IMG.attachReplaceUI(d, { imgClass: 'prod-thumb', onReplaced: () => toast('Picture updated') }); } catch (e) {} }
    const commit = () => { try { readIndentEdits(d); persistModelEverywhere(); } catch (e) {} };
    m.querySelector('[data-save]').onclick = () => { commit(); renderPrepare(); toast('Changes saved — reflected everywhere'); };
    m.querySelector('[data-x]').onclick = () => { commit(); m.remove(); renderPrepare(); };
    m.querySelector('[data-print]').onclick = () => { commit(); try { frame.contentWindow.focus(); frame.contentWindow.print(); logAct('printed', { no: model.indentNo, customer: model.indentCustomer }); } catch (e) { toast('Print blocked — allow pop-ups'); } };
  }
  // Read the edited indent (contenteditable) back into the model, so any change
  // made in the PDF editor is captured — not just visual.
  function readIndentEdits(doc) {
    if (!doc) return;
    const rows = [...doc.querySelectorAll('tr.idt-item')];
    if (rows.length) {
      model.items = rows.map(tr => {
        const td = tr.querySelectorAll('td');
        const descEl = tr.querySelector('.desc-txt') || td[1];
        const grab = (el) => (el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/ /g, ' ').trim();
        return { sl: grab(td[0]), desc: grab(descEl), qty: grab(td[2]), unit: grab(td[3]) || 'Nos', dealtBy: grab(td[4]), deliveryDate: grab(td[5]) };
      }).filter(it => (it.desc || '').trim());
      if (!model.items.length) model.items = [blankItem()];
    }
    const cust = doc.querySelector('tr.idt-cust td:nth-child(2)'); if (cust) { const v = (cust.innerText || cust.textContent || '').trim(); if (v) model.indentCustomer = v; }
  }
  // Save the current model to WHEREVER it belongs: its draft, and — if it was
  // already sent — the live factory indent too (so edits reflect everywhere and
  // the factory/dispatch/office all see the change). This is the "bypass" glue:
  // a change made at any stage is recorded and visible in every stage.
  function persistModelEverywhere() {
    const real = model.items.filter(it => (it.desc || '').trim());
    // update a matching draft
    const drafts = loadDrafts();
    const di = drafts.findIndex(d => d.id === model.id);
    if (di >= 0) { drafts[di] = JSON.parse(JSON.stringify(model)); saveDrafts(drafts); }
    // update a matching sent/factory indent
    try {
      let sent = loadSent(); const si = sent.findIndex(s => s.id === model.id);
      if (si >= 0) {
        const s = sent[si];
        s.indentCustomer = model.indentCustomer || s.indentCustomer; s.customer = model.indentCustomer || s.customer;
        s.indentNotes = model.indentNotes || s.indentNotes; s.preparedBy = model.preparedBy || s.preparedBy;
        // merge item text edits onto existing factory items (keep production state)
        s.items = real.map((it, k) => Object.assign({}, s.items[k] || {}, { sl: it.sl, desc: it.desc, qty: it.qty, unit: it.unit, dealtBy: it.dealtBy, deliveryDate: it.deliveryDate }));
        localStorage.setItem(FACTORY, JSON.stringify(sent));
        try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(FACTORY); } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('fixo:sync', { detail: { keys: [FACTORY] } })); } catch (e) {}
      }
    } catch (e) {}
    logAct('edited', { no: model.indentNo, customer: model.indentCustomer, lines: real.length });
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
      indentCustomer: model.indentCustomer || model.customer || '', indentNotes: model.indentNotes || '', preparedBy: model.preparedBy || '', deliveryAddr: model.deliveryAddr || '',
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
    // Newest first — today's indents on top (by sent time / id timestamp).
    const trkTs = (x) => Date.parse(x.d.sentAt || '') || (parseInt(String(x.d.id).replace(/\D/g, '').slice(0, 13), 10) || 0);
    all.sort((a, b) => trkTs(b) - trkTs(a));
    const chip = (k) => k === 'draft' ? '<span class="idp-chip draft">📝 Draft (not sent)</span>' : k === 'approved' ? '<span class="idp-chip ok">✓ Approved by factory</span>' : '<span class="idp-chip wait">⏳ At factory — awaiting approval</span>';
    const rows = all.length ? all.map(({ kind, d }) => {
      const lines = (d.items || []).length;
      const when = d.savedAt || (d.sentAt ? new Date(d.sentAt).toLocaleString('en-IN') : '');
      const actions = kind === 'draft'
        ? `<button class="idp-mini" data-open="${d.id}">✎ Open</button><button class="idp-mini" data-send="${d.id}">➤ Send</button><button class="idp-mini idp-mini-x" data-del="${d.id}">🗑</button>`
        : `<button class="idp-mini" data-reprint="${d.id}">🖨 Reprint</button>${(d.docs && (d.docs.plan || d.docs.inspection)) ? `<button class="idp-mini" data-docs="${d.id}">📁 Factory docs</button>` : ''}`;
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
    body.querySelectorAll('[data-docs]').forEach(b => b.onclick = () => { const s = loadSent().find(x => x.id === b.dataset.docs); if (s) viewFactoryDocs(s); });
  }
  // Read-only viewer so the office & management can review the Production Plan and
  // Inspection Report the factory filled (synced from the factory record).
  function viewFactoryDocs(s) {
    const docs = s.docs || {};
    const tabs = [['plan', '🗒 Production Plan'], ['inspection', '📋 Inspection Report']].filter(t => docs[t[0]]);
    if (!tabs.length) { toast('No factory documents saved yet'); return; }
    let cur = tabs[0][0];
    const m = modal(`<div class="idp-editor-head"><b>Factory documents — ${esc(s.customer)} (No. ${esc(s.indentNo)})</b><button class="idp-btn" data-x>Close</button></div>
      <div class="idp-doc-tabs">${tabs.map(t => `<button class="idp-mini" data-dt="${t[0]}">${t[1]}</button>`).join('')}<button class="idp-btn idp-btn-go" data-print style="margin-left:auto">🖨 Print / Save PDF</button></div>
      <iframe id="idp-frame" class="idp-frame"></iframe>`, true);
    const fr = m.querySelector('#idp-frame');
    const load = (k) => { const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(docs[k] || '<p>Not available.</p>'); d.close(); cur = k; };
    load(cur);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelectorAll('[data-dt]').forEach(b => b.onclick = () => load(b.dataset.dt));
    m.querySelector('[data-print]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }
  function normalizeSent(s) {
    return { id: s.id, indentNo: s.indentNo, indentDate: s.indentDate, indentCustomer: s.indentCustomer || s.customer, indentNotes: s.indentNotes || '', preparedBy: s.preparedBy || '', deliveryAddr: s.deliveryAddr || '', customer: s.customer, priority: !!s.priority, images: {}, items: (s.items || []).map(it => ({ sl: it.sl || '', desc: it.desc || '', qty: it.qty, unit: it.unit || 'Nos', dealtBy: it.dealtBy || '', deliveryDate: it.deliveryDate || '' })) };
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

  window.FIXO_INDENT = {
    render,
    openDraft(id) { if (window.showScreen) showScreen('screen-indent'); const d = loadDrafts().find(x => x.id === id); if (d) { model = JSON.parse(JSON.stringify(d)); view = 'prepare'; } else { view = 'tracker'; } render(); },
    showTracker() { if (window.showScreen) showScreen('screen-indent'); view = 'tracker'; render(); }
  };
})();
