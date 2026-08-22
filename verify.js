// ============================================================
// Verify & Edit window — opens before any print/export.
// Shows the quotation data in an editable form (customer, quote no,
// dates, line items, and logo/mark/seal images). "Proceed" generates
// the chosen output (Approval PDF / Print PDF / Excel) from the edited
// model, so any correction the user makes is reflected in the file.
// ============================================================
(function () {
  const money = (n) => Number(n || 0).toLocaleString('en-IN');
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  let pendingImages = {};   // { logo, cert, seal } dataURL overrides
  let currentMode = 'final';

  const MODES = {
    approval: { title: 'Verify & Edit — Approval Copy', btn: 'Proceed to Approval Print' },
    final: { title: 'Verify & Edit — Final Print', btn: 'Proceed to Print' },
    excel: { title: 'Verify & Edit — Excel', btn: 'Generate Excel' }
  };

  document.addEventListener('DOMContentLoaded', () => {
    buildModal();          // form-based verify (used for Excel)
    buildPdfEditor();      // WYSIWYG click-to-edit preview (used for PDF)
    // PDF buttons open the WYSIWYG editor; Excel buttons open the form.
    rewire('btn-approval-pdf', () => openPdfEditor('approval'));
    rewire('btn-download-pdf', () => openPdfEditor('final'));
    rewire('btn-csv', () => openVerify('excel'));
    rewire('btn-print-csv', () => openVerify('excel'));
  });

  function rewire(id, handler) {
    const btn = document.getElementById(id);
    if (!btn) return;
    const clone = btn.cloneNode(true);      // drop existing listeners
    btn.parentNode.replaceChild(clone, btn);
    clone.addEventListener('click', handler);
  }

  // ---------------- WYSIWYG PDF editor ----------------
  function buildPdfEditor() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-overlay" id="pdf-editor-modal">
        <div class="modal-dialog pdfed-dialog">
          <div class="modal-header">
            <div class="modal-title-group"><h3 id="pe-title">Verify &amp; Edit — PDF</h3></div>
            <button class="modal-close-btn" id="pe-x">&times;</button>
          </div>
          <div class="pdfed-toolbar">
            <span class="pdfed-hint">✎ Click anywhere in the document to edit any text. Replace images if needed, then print.</span>
            <span class="pdfed-imgbtns">
              <button class="cp-btn small" data-repl="logo">Replace Logo</button>
              <button class="cp-btn small" data-repl="cert">Replace Mark</button>
              <button class="cp-btn small" data-repl="seal">Replace Seal</button>
              <input type="file" accept="image/*" id="pe-file" hidden>
            </span>
          </div>
          <div class="pdfed-body"><iframe id="pe-frame" title="Quotation preview"></iframe></div>
          <div class="modal-actions vf-actions">
            <button class="btn-cancel" id="pe-cancel">Cancel</button>
            <button class="btn-send" id="pe-proceed">Proceed to Print</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el.firstElementChild);
    document.getElementById('pe-x').addEventListener('click', closePe);
    document.getElementById('pe-cancel').addEventListener('click', closePe);
    document.getElementById('pe-proceed').addEventListener('click', proceedPrint);

    let replTarget = null;
    const fileInp = document.getElementById('pe-file');
    document.querySelectorAll('#pdf-editor-modal [data-repl]').forEach(b =>
      b.addEventListener('click', () => { replTarget = b.dataset.repl; fileInp.value = ''; fileInp.click(); }));
    fileInp.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f || !replTarget) return;
      const url = await fileToDataURL(f);
      const doc = document.getElementById('pe-frame').contentDocument;
      const img = doc && doc.getElementById('pv-' + replTarget);
      if (img) img.src = url;
      else (window.FIXO && FIXO.toast) && FIXO.toast('This document has no ' + replTarget + ' image slot');
    });
  }

  function openPdfEditor(mode) {
    if (!window.FIXO || !FIXO.hasQuoteItems || !FIXO.hasQuoteItems()) { (window.FIXO && FIXO.toast ? FIXO.toast('Add items to the quote first') : alert('Add items first')); return; }
    currentMode = mode;
    // Start from the merged model so earlier edits (incl. approval-copy edits)
    // are already present when you open the final print.
    const model = (typeof mergedQuoteModel === 'function') ? mergedQuoteModel() : buildQuoteModel();
    const html = buildQuoteHtml(model, { isDraft: mode === 'approval', editable: true });
    document.getElementById('pe-title').textContent = mode === 'approval' ? 'Verify & Edit — Approval Copy' : 'Verify & Edit — Final Print';
    document.getElementById('pe-proceed').textContent = mode === 'approval' ? 'Proceed to Approval Print' : 'Proceed to Print';
    const frame = document.getElementById('pe-frame');
    const d = frame.contentDocument || frame.contentWindow.document;
    d.open(); d.write(html); d.close();
    // Click any product picture to replace it — the change flows to the Indent
    // and every other stage.
    if (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.attachReplaceUI) {
      FIXO_PRODUCT_IMG.attachReplaceUI(d, {
        imgClass: 'qthumb',
        onReplaced: () => (window.FIXO && FIXO.toast) && FIXO.toast('Picture updated everywhere')
      });
    }
    // Live: recompute amounts/total as the user edits, and record every edit so
    // it flows to the printed PDF, the Excel, the approval copy and the save.
    wireEditorLive(d);
    document.getElementById('pdf-editor-modal').classList.add('show');
  }

  // Keep the editor self-consistent and continuously capture edits.
  function wireEditorLive(doc) {
    if (!doc) return;
    const inr = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const recompute = () => {
      let total = 0;
      doc.querySelectorAll('table.prod tr').forEach(tr => {
        if (tr.querySelector('th') || tr.classList.contains('make') || tr.classList.contains('tot')) return;
        const td = tr.querySelectorAll('td');
        if (td.length < 6) return;
        const desc = (td[1].innerText || '').trim();
        const qty = num(td[3].innerText), rate = num(td[4].innerText);
        if (!desc && !qty && !rate) return;               // filler row
        // Qty 0 = rate-only reference line: keep the rate, blank the qty/unit/amount.
        if (!qty) { td[2].innerText = ''; td[3].innerText = ''; td[5].innerText = ''; return; }
        td[5].innerText = inr(Math.round(qty * rate));
        total += num(td[5].innerText);
      });
      // TOTAL sits in the last cell of the first .tot row.
      const totRow = doc.querySelector('table.prod tr.tot');
      if (totRow) { const cells = totRow.querySelectorAll('td'); if (cells.length) cells[cells.length - 1].innerText = inr(total); }
    };
    let t = null;
    doc.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => { recompute(); captureEditorEdits(document.getElementById('pe-frame')); }, 180);
    }, true);
  }

  function proceedPrint() {
    const frame = document.getElementById('pe-frame');
    captureEditorEdits(frame);   // pull any click-to-edit changes into the shared model
    try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) { }
    if (currentMode === 'final' && typeof recordExport === 'function') recordExport('PDF Quotation');
    closePe();
  }

  // Read the (possibly hand-edited) quotation table out of the WYSIWYG iframe so
  // description / qty / rate / customer changes flow into the Proforma Invoice.
  function captureEditorEdits(frame) {
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      if (!doc) return;
      const base = buildQuoteModel();
      const items = [];
      doc.querySelectorAll('table.prod tr').forEach(tr => {
        if (tr.querySelector('th') || tr.classList.contains('make') || tr.classList.contains('tot')) return;
        const td = tr.querySelectorAll('td');
        if (td.length < 6) return;
        // Read only the text span — never the image slot's "+ Img"/"Replace" label.
        const descEl = td[1].querySelector('.qdesc > span:not(.fx-imgslot)');
        const desc = ((descEl ? descEl.innerText : td[1].innerText) || '').trim();
        const qty = num(td[3].innerText);
        const rate = num(td[4].innerText);
        if (!desc && !qty && !rate) return;   // filler row
        items.push({ sl: items.length + 1, desc, unit: (td[2].innerText || '').trim(), qty, rate, amount: Math.round(qty * rate) });
      });
      if (!items.length) return;
      const clEl = doc.querySelector('.cl');
      let total = 0; items.forEach(it => total += it.amount);
      const model = Object.assign({}, base, { items, total });
      if (clEl && clEl.innerText.trim()) model.client = clEl.innerText.trim();
      if (window.FIXO && FIXO.setEditedQuote) FIXO.setEditedQuote(model);
    } catch (e) { /* best-effort */ }
  }
  function closePe() { document.getElementById('pdf-editor-modal').classList.remove('show'); }

  function buildModal() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-overlay" id="verify-modal">
        <div class="modal-dialog verify-dialog">
          <div class="modal-header">
            <div class="modal-title-group"><h3 id="vf-title">Verify &amp; Edit</h3></div>
            <button class="modal-close-btn" id="vf-x">&times;</button>
          </div>
          <div class="modal-body">
            <p class="vf-note">Everything is filled automatically. Correct anything below — customer, quote number, figures, or the logo/mark/seal — then proceed. Your edits appear in the printed file.</p>
            <div class="vf-grid">
              <label>Customer (M/s)<input type="text" id="vf-client"></label>
              <label>QTN No.<input type="text" id="vf-qtnNo"></label>
              <label>QTN Date<input type="text" id="vf-date"></label>
              <label>Enquiry Ref<input type="text" id="vf-enq"></label>
              <label>Source<input type="text" id="vf-source"></label>
              <label>Dt<input type="text" id="vf-dt"></label>
            </div>

            <div class="vf-sec-head"><span>Line items</span><button class="cp-btn small" id="vf-add">+ Add row</button></div>
            <div class="vf-items-wrap">
              <table class="vf-items">
                <thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
                <tbody id="vf-items-body"></tbody>
                <tfoot><tr><td colspan="5" class="vf-tot-lbl">TOTAL</td><td class="vf-tot" id="vf-total">₹0</td><td></td></tr></tfoot>
              </table>
            </div>

            <div class="vf-sec-head"><span>Images (optional — replace)</span></div>
            <div class="vf-imgs">
              <div class="vf-img"><span>Logo</span><input type="file" accept="image/*" data-img="logo"><em data-imgname="logo">default</em></div>
              <div class="vf-img"><span>Mark / Cert</span><input type="file" accept="image/*" data-img="cert"><em data-imgname="cert">default</em></div>
              <div class="vf-img"><span>Seal &amp; Sign</span><input type="file" accept="image/*" data-img="seal"><em data-imgname="seal">default</em></div>
            </div>
          </div>
          <div class="modal-actions vf-actions">
            <button class="btn-cancel" id="vf-cancel">Cancel</button>
            <button class="btn-send" id="vf-proceed">Proceed</button>
          </div>
        </div>
      </div>`;
    document.body.appendChild(el.firstElementChild);

    document.getElementById('vf-x').addEventListener('click', close);
    document.getElementById('vf-cancel').addEventListener('click', close);
    document.getElementById('vf-add').addEventListener('click', () => addRow({ desc: '', unit: 'Nos', qty: 1, rate: 0 }));
    document.getElementById('vf-proceed').addEventListener('click', proceed);
    document.querySelectorAll('#verify-modal [data-img]').forEach(inp => {
      inp.addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        const key = e.target.dataset.img;
        pendingImages[key] = await fileToDataURL(f);
        const em = document.querySelector('#verify-modal [data-imgname="' + key + '"]');
        if (em) { em.textContent = f.name; em.classList.add('set'); }
      });
    });
  }

  function openVerify(mode) {
    currentMode = mode;
    pendingImages = {};
    if (!window.FIXO || !FIXO.hasQuoteItems || !FIXO.hasQuoteItems()) { (FIXO && FIXO.toast ? FIXO.toast('Add items to the quote first') : alert('Add items first')); return; }
    // Merged model carries over any edits made in the PDF editor so Excel matches.
    const m = (typeof mergedQuoteModel === 'function') ? mergedQuoteModel() : buildQuoteModel();
    document.getElementById('vf-title').textContent = MODES[mode].title;
    document.getElementById('vf-proceed').textContent = MODES[mode].btn;
    document.getElementById('vf-client').value = m.client === 'N/A' ? '' : m.client;
    document.getElementById('vf-qtnNo').value = m.qtnNo;
    document.getElementById('vf-date').value = m.date;
    document.getElementById('vf-enq').value = m.enquiryRef;
    document.getElementById('vf-source').value = m.source;
    document.getElementById('vf-dt').value = m.dt;
    document.getElementById('vf-items-body').innerHTML = '';
    m.items.forEach(it => addRow({ desc: String(it.desc || '').replace(/\n/g, ' — '), unit: it.unit, qty: it.qty, rate: it.rate }));
    document.querySelectorAll('#verify-modal [data-imgname]').forEach(em => { em.textContent = 'default'; em.classList.remove('set'); });
    document.querySelectorAll('#verify-modal [data-img]').forEach(i => i.value = '');
    recalc();
    document.getElementById('verify-modal').classList.add('show');
  }

  function addRow(it) {
    const tb = document.getElementById('vf-items-body');
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="vf-sl"></td>
      <td><input type="text" class="vf-desc" value="${esc(it.desc)}"></td>
      <td><input type="text" class="vf-unit" value="${esc(it.unit || '')}"></td>
      <td><input type="number" class="vf-qty" value="${esc(it.qty)}" min="0" step="1"></td>
      <td><input type="number" class="vf-rate" value="${esc(it.rate)}" min="0" step="0.01"></td>
      <td class="vf-amt">₹0</td>
      <td><button class="vf-del" title="Remove">×</button></td>`;
    tb.appendChild(tr);
    tr.querySelector('.vf-qty').addEventListener('input', recalc);
    tr.querySelector('.vf-rate').addEventListener('input', recalc);
    tr.querySelector('.vf-del').addEventListener('click', () => { tr.remove(); recalc(); });
    recalc();
  }

  function recalc() {
    let total = 0;
    document.querySelectorAll('#vf-items-body tr').forEach((tr, i) => {
      tr.querySelector('.vf-sl').textContent = i + 1;
      const amt = Math.round(num(tr.querySelector('.vf-qty').value) * num(tr.querySelector('.vf-rate').value));
      tr.querySelector('.vf-amt').textContent = '₹' + money(amt);
      tr.dataset.amt = amt;
      total += amt;
    });
    document.getElementById('vf-total').textContent = '₹' + money(total);
  }

  function collectModel() {
    const base = buildQuoteModel();
    const items = [];
    document.querySelectorAll('#vf-items-body tr').forEach((tr, i) => {
      const qty = num(tr.querySelector('.vf-qty').value);
      const rate = num(tr.querySelector('.vf-rate').value);
      const desc = tr.querySelector('.vf-desc').value.trim();
      if (!desc && !qty && !rate) return;
      items.push({ sl: i + 1, desc, unit: tr.querySelector('.vf-unit').value.trim(), qty, rate, amount: Math.round(qty * rate) });
    });
    let total = 0; items.forEach(it => total += it.amount);
    return Object.assign(base, {
      client: document.getElementById('vf-client').value.trim() || 'N/A',
      qtnNo: document.getElementById('vf-qtnNo').value.trim(),
      date: document.getElementById('vf-date').value.trim(),
      enquiryRef: document.getElementById('vf-enq').value.trim(),
      source: document.getElementById('vf-source').value.trim(),
      dt: document.getElementById('vf-dt').value.trim(),
      items, total,
      images: Object.assign({}, pendingImages)
    });
  }

  function proceed() {
    const model = collectModel();
    if (!model.items.length) { (FIXO && FIXO.toast ? FIXO.toast('Add at least one line item') : alert('Add a line item')); return; }
    if (window.FIXO && FIXO.setEditedQuote) FIXO.setEditedQuote(model);   // edits flow to Proforma
    close();
    if (currentMode === 'excel') {
      if (typeof exportXlsx === 'function') exportXlsx(model);
      else if (typeof exportCSV === 'function') exportCSV({ model: model });
    } else {
      downloadPDF(currentMode, { model: model });
    }
  }

  function close() { document.getElementById('verify-modal').classList.remove('show'); }

  function fileToDataURL(file) {
    return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
  }
})();
