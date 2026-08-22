// ============================================================
// Fixotech Proforma Invoice app
// Builds the customer-facing Proforma (State: CGST+SGST, or
// Inter-state: IGST) from a forwarded quote / uploaded quote /
// manual entry, matching the STATE PI & INTER STATE PI templates.
// Output: WYSIWYG click-to-edit PDF (print) + styled Excel (.xlsx).
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));

  const CO = {
    name: 'FIXOTECH ENGINEERING SYSTEMS PVT LTD',
    address: 'No. 4 & 5/ 12 & 13,  J.P.R Building Gurunanjudaiah Industrial Area, Abbigere, Chikkabanavara, Bangalore -90',
    contact: 'Ph : 9900032639 , 9900032641   Email : sales@fixotech.in   fixotech@rediffmail.com   Website : www.fixotechcabletrays.in',
    tin: 'Our Tin no.29120850733',
    gst: 'GST No : 29AABCF3782C1ZP',
    footer: 'Note : "PRINTED FROM THE ONLINE SYSTEMS ARE CONSIDERED UNCONTROLLED"',
    banks: [
      { name: 'State Bank of India', ac: 'Fixotech Engineering systems Pvt Ltd', branch: '5/3&4 HMT School Main Road Near HMT Theatre, Jalahalli', type: 'CURRENT ACCOUNT', no: '64087938427', ifsc: 'SBIN0016335' },
      { name: 'AXIS BANK LTD', ac: 'Fixotech Engineering systems Pvt Ltd', branch: 'No. 149, 100ft Road, Peenya Industrial Estt, Bangalore 560058', type: 'CURRENT ACCOUNT', no: '560010200062569', ifsc: 'UTIB0000560' }
    ]
  };
  const img = (k, glob) => (model.images && model.images[k]) || (typeof glob !== 'undefined' ? glob : '');

  function getPiNo() {
    const now = new Date();
    const fy1 = now.getMonth() >= 3 ? now.getFullYear() % 100 : (now.getFullYear() - 1) % 100;
    const seq = parseInt(localStorage.getItem('fixo_pi_seq') || '0', 10) + 1;
    localStorage.setItem('fixo_pi_seq', String(seq));
    return 'FESPL/PI/' + fy1 + '-' + (fy1 + 1) + '/' + String(seq).padStart(4, '0');
  }
  const today = () => new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  // Indian amount-in-words
  function inWords(n) {
    n = Math.round(num(n));
    if (n === 0) return 'Rupees Zero Only';
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (x) => x < 20 ? a[x] : (b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : ''));
    const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
    let s = '';
    const cr = Math.floor(n / 1e7); n %= 1e7;
    const la = Math.floor(n / 1e5); n %= 1e5;
    const th = Math.floor(n / 1e3); n %= 1e3;
    if (cr) s += three(cr) + ' Crore ';
    if (la) s += three(la) + ' Lakh ';
    if (th) s += three(th) + ' Thousand ';
    if (n) s += three(n);
    return 'Rupees ' + s.trim().replace(/\s+/g, ' ') + ' Only';
  }

  // ---------------- model ----------------
  let model = null;
  function freshModel() {
    return {
      type: 'state', gstRate: 18, freight: 0,
      refNo: getPiNo(), piDate: today(), poNo: '', poDate: '',
      customer: '', customerAddr: '', customerGst: '',
      deliveryTo: '', deliveryAddr: '',
      items: [], images: {},
      approval: '', approved: false, indentReady: false, sentToFactory: false
    };
  }
  function totals(m) {
    const basic = m.items.reduce((s, it) => s + num(it.amount), 0);
    let cgst = 0, sgst = 0, igst = 0, tax = 0;
    if (m.type === 'state') { cgst = basic * (m.gstRate / 2) / 100; sgst = cgst; tax = cgst + sgst; }
    else { igst = basic * m.gstRate / 100; tax = igst; }
    const freight = num(m.freight) || 0;
    const gross = basic + tax + freight;
    const totalValue = Math.round(gross);
    const roundOff = +(totalValue - gross).toFixed(2);
    return { basic, cgst, sgst, igst, tax, freight, roundOff, totalValue };
  }

  // ---------------- UI ----------------
  document.addEventListener('DOMContentLoaded', () => {
    const host = document.getElementById('pf-app');
    if (!host) return;
    model = freshModel();
    renderBuilder(host);
    buildEditor();
    window.FIXO_PF = { loadFromQuote, loadItems, buildIndentHtml };
  });

  function renderBuilder(host) {
    host.innerHTML = `
      <div class="pf-wrap">
        <div class="pf-head">
          <div>
            <h2>Proforma Invoice</h2>
            <p class="pf-sub">Forwarded from the Smart Calculator or uploaded — finalise details, then verify &amp; print or email.</p>
          </div>
          <div class="pf-src" id="pf-src">Manual entry</div>
        </div>

        <div class="pf-status" id="pf-status"></div>

        <div class="pf-topbtns">
          <button class="cp-btn small" id="pf-save">💾 Save Proforma</button>
          <button class="cp-btn small" id="pf-saved">📂 Saved Proformas</button>
          <button class="cp-btn small" id="pf-factory-indents">🏭 Indents at Factory</button>
        </div>

        <div class="pf-apptabs">
          <button class="pf-apptab active" data-pane="pi">Proforma Invoice</button>
          <button class="pf-apptab locked" data-pane="indent" id="pf-indent-tabbtn">Indent <span class="pf-lock" id="pf-indent-lock">🔒</span></button>
        </div>

        <div id="pf-tab-pi" class="pf-tabpane active">
        <div class="pf-toolbar">
          <div class="pf-typetoggle">
            <button class="pf-tab active" data-type="state">State (CGST + SGST)</button>
            <button class="pf-tab" data-type="interstate">Inter-state (IGST)</button>
          </div>
          <label class="pf-gst">GST %<input type="number" id="pf-gst" value="18" min="0" step="0.5"></label>
          <span class="pf-spacer"></span>
          <button class="cp-btn" id="pf-upload-btn">⬆ Upload quote (PDF/CSV)</button>
          <input type="file" id="pf-upload" accept=".csv,.pdf" hidden>
        </div>

        <div class="pf-fields">
          <label>Ref No<input type="text" id="pf-ref"></label>
          <label>Date<input type="text" id="pf-date"></label>
          <label>PO No<input type="text" id="pf-pono"></label>
          <label>PO Date<input type="text" id="pf-podate"></label>
          <label class="wide">Customer (M/s) — To<input type="text" id="pf-cust" placeholder="Customer company name"></label>
          <label>Customer GST No<input type="text" id="pf-custgst"></label>
          <label class="wide2">Customer Address<textarea id="pf-custaddr" rows="2"></textarea></label>
          <label class="wide">Delivery to (M/s)<input type="text" id="pf-delto" placeholder="If different"></label>
          <label class="wide">Delivery Address<textarea id="pf-deladdr" rows="2"></textarea></label>
        </div>

        <div class="pf-sec-head"><span>Line items</span><button class="cp-btn small" id="pf-add">+ Add row</button></div>
        <div class="pf-items-wrap">
          <table class="vf-items pf-items-tbl">
            <thead><tr><th>#</th><th>Description</th><th>Unit</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
            <tbody id="pf-items-body"></tbody>
          </table>
        </div>

        <div class="pf-totals" id="pf-totals"></div>

        <div class="pf-actions">
          <button class="btn-export btn-print" id="pf-print">🖨 Verify &amp; Print PDF</button>
          <button class="btn-export btn-print" id="pf-excel">▦ Save Excel</button>
          <button class="btn-action btn-whatsapp" id="pf-wa">WhatsApp</button>
          <button class="btn-action btn-email" id="pf-email">Email</button>
        </div>

        <div class="pf-approval">
          <div class="pf-appr-head">Client approval <span id="pf-appr-state" class="pf-appr-state"></span></div>
          <div class="pf-appr-btns">
            <button class="cp-btn primary" id="pf-appr-yes">✓ Client Approved</button>
            <button class="cp-btn danger" id="pf-appr-no">✕ Declined</button>
            <button class="cp-btn" id="pf-appr-edit">✎ Re-edit</button>
            <span class="pf-appr-hint">On approval, the Indent tab unlocks and the customer record is updated.</span>
          </div>
        </div>
        </div><!-- /pf-tab-pi -->

        <div id="pf-tab-indent" class="pf-tabpane" hidden>
          <div id="pf-indent"></div>
        </div>
      </div>`;

    // bind header fields
    const bindVal = (id, key) => { const el = document.getElementById(id); el.value = model[key] || ''; el.addEventListener('input', () => { model[key] = el.value; }); };
    bindVal('pf-ref', 'refNo'); bindVal('pf-date', 'piDate'); bindVal('pf-pono', 'poNo'); bindVal('pf-podate', 'poDate');
    bindVal('pf-cust', 'customer'); bindVal('pf-custgst', 'customerGst'); bindVal('pf-custaddr', 'customerAddr');
    bindVal('pf-delto', 'deliveryTo'); bindVal('pf-deladdr', 'deliveryAddr');

    host.querySelectorAll('.pf-tab').forEach(t => t.addEventListener('click', () => {
      host.querySelectorAll('.pf-tab').forEach(x => x.classList.toggle('active', x === t));
      model.type = t.dataset.type; renderTotals();
    }));
    const gst = document.getElementById('pf-gst');
    gst.value = model.gstRate;
    gst.addEventListener('input', () => { model.gstRate = num(gst.value); renderTotals(); });

    document.getElementById('pf-add').addEventListener('click', () => { addRow({ desc: '', unit: 'Nos', qty: 1, rate: 0 }); syncItems(); });
    document.getElementById('pf-upload-btn').addEventListener('click', () => document.getElementById('pf-upload').click());
    document.getElementById('pf-upload').addEventListener('change', onUpload);
    document.getElementById('pf-print').addEventListener('click', openEditor);
    document.getElementById('pf-excel').addEventListener('click', () => exportPiXlsx());
    document.getElementById('pf-wa').addEventListener('click', () => sharePi('wa'));
    document.getElementById('pf-email').addEventListener('click', () => sharePi('email'));

    // PI | Indent tabs
    host.querySelectorAll('.pf-apptab').forEach(t => t.addEventListener('click', () => {
      if (t.dataset.pane === 'indent' && !model.approved) { toast('Indent unlocks after the client approves the Proforma'); return; }
      host.querySelectorAll('.pf-apptab').forEach(x => x.classList.toggle('active', x === t));
      const isPi = t.dataset.pane === 'pi';
      const pi = document.getElementById('pf-tab-pi'), ind = document.getElementById('pf-tab-indent');
      pi.classList.toggle('active', isPi); pi.hidden = !isPi;
      ind.classList.toggle('active', !isPi); ind.hidden = isPi;
      if (!isPi) renderIndent();
    }));

    // Client approval
    document.getElementById('pf-appr-yes').addEventListener('click', () => setApproval('approved'));
    document.getElementById('pf-appr-no').addEventListener('click', () => setApproval('declined'));
    document.getElementById('pf-appr-edit').addEventListener('click', () => setApproval('reedit'));

    // Save / reopen proforma + factory indents
    document.getElementById('pf-save').addEventListener('click', saveProforma);
    document.getElementById('pf-saved').addEventListener('click', openSavedProformas);
    document.getElementById('pf-factory-indents').addEventListener('click', openFactoryIndents);

    attachCustomerAutocomplete();
    renderItems();
    renderTotals();
    renderStatus();
    renderApproval();
  }

  // ---------------- shared customer autocomplete ----------------
  let clientCache = null;
  async function attachCustomerAutocomplete() {
    const input = document.getElementById('pf-cust');
    if (!input || !window.FixoDB) return;
    const box = input.closest('label'); box.style.position = 'relative';
    let dd = box.querySelector('.pf-cust-dd');
    if (!dd) { dd = document.createElement('div'); dd.className = 'client-search-dd pf-cust-dd'; dd.hidden = true; box.appendChild(dd); }
    if (!clientCache) { try { clientCache = await FixoDB.listClients(); } catch (e) { clientCache = []; } }
    const render = () => {
      const matches = FixoDB.searchClients(input.value, clientCache);
      dd.innerHTML = matches.map(c => `<div class="csd-item" data-id="${c.id}"><span class="csd-co">${esc(c.company_name || c.client_name || '(unnamed)')}</span><span class="csd-sub">${esc([c.client_name, c.phone, c.gstin].filter(Boolean).join(' · '))}</span></div>`).join('')
        || `<div class="csd-empty">No matching customers</div>`;
      dd.hidden = false;
      dd.querySelectorAll('.csd-item').forEach(it => it.addEventListener('mousedown', (e) => {
        e.preventDefault();
        const c = clientCache.find(x => x.id === it.dataset.id); if (!c) return;
        model.customer = c.company_name || c.client_name || '';
        model.customerGst = c.gstin || '';
        model.customerAddr = c.site_address || '';
        input.value = model.customer;
        const g = document.getElementById('pf-custgst'); if (g) g.value = model.customerGst;
        const ad = document.getElementById('pf-custaddr'); if (ad) ad.value = model.customerAddr;
        dd.hidden = true;
      }));
    };
    input.addEventListener('input', render);
    input.addEventListener('focus', render);
    input.addEventListener('blur', () => setTimeout(() => { dd.hidden = true; }, 150));
  }

  // ---------------- status pipeline ----------------
  const STAGES = ['Quotation', 'Proforma', 'Approved', 'Indent', 'Sent to Factory'];
  function stageIndex() {
    if (model.sentToFactory) return 4;
    if (model.indentReady) return 3;
    if (model.approved) return 2;
    return 1; // in Proforma
  }
  function renderStatus() {
    const el = document.getElementById('pf-status'); if (!el) return;
    const cur = stageIndex();
    el.innerHTML = STAGES.map((s, i) =>
      `<div class="pf-stg ${i < cur ? 'done' : i === cur ? 'now' : ''}"><span class="pf-stg-dot">${i < cur ? '✓' : i + 1}</span>${s}</div>`
    ).join('<span class="pf-stg-sep"></span>');
  }
  function renderApproval() {
    const s = document.getElementById('pf-appr-state'); if (!s) return;
    s.textContent = model.approval ? ({ approved: '✓ Approved', declined: '✕ Declined', reedit: '✎ Re-edit requested' })[model.approval] : '— pending';
    s.className = 'pf-appr-state ' + (model.approval || '');
    // Decline / re-edit → show the reason and a Rework action
    let extra = document.getElementById('pf-rework-box');
    if (model.approval === 'declined' || model.approval === 'reedit') {
      if (!extra) { extra = document.createElement('div'); extra.id = 'pf-rework-box'; extra.className = 'pf-rework-box'; s.parentNode.appendChild(extra); }
      extra.innerHTML = `<span class="pf-rework-reason">Reason: ${esc(model.declineReason || '—')}</span>
        <button class="cp-btn small" id="pf-rework-btn">↻ Rework &amp; re-submit</button>`;
      extra.querySelector('#pf-rework-btn').onclick = reworkProforma;
    } else if (extra) { extra.remove(); }
  }
  function reworkProforma() {
    model.approval = ''; model.approved = false; model.declineReason = '';
    // back to editable PI tab
    const pi = document.getElementById('pf-tab-pi'), ind = document.getElementById('pf-tab-indent');
    if (pi && ind) { pi.hidden = false; pi.classList.add('active'); ind.hidden = true; ind.classList.remove('active'); }
    document.querySelectorAll('.pf-apptab').forEach(x => x.classList.toggle('active', x.dataset.pane === 'pi'));
    renderStatus(); renderApproval();
    toast('Reworking — edit the proforma and re-submit for approval');
  }

  // ---- Save / reopen proforma + factory-indent visibility ----
  function pfModal(inner) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = '<div class="fx-modal">' + inner + '</div>'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }
  function loadSavedPf() { try { return JSON.parse(localStorage.getItem('fixo_saved_proformas') || '[]'); } catch (e) { return []; } }
  function storeSavedPf(a) { try { localStorage.setItem('fixo_saved_proformas', JSON.stringify(a)); } catch (e) {} }
  function saveProforma() {
    if (!model.items || !model.items.length) { toast('Add items first'); return; }
    const list = loadSavedPf();
    list.unshift({ id: 'pf-' + Date.now(), savedAt: new Date().toLocaleString('en-IN'), customer: model.customer || 'Unnamed', refNo: model.refNo || '', model: JSON.parse(JSON.stringify(model)) });
    storeSavedPf(list.slice(0, 40));
    toast('Proforma saved — reopen it anytime from “Saved Proformas”');
  }
  function openSavedProformas() {
    const list = loadSavedPf();
    const rows = list.length ? list.map(r => `<div class="so-row"><div class="so-info"><b>${esc(r.customer)}</b><span>${esc(r.refNo)} · ${esc(r.savedAt)}</span></div><div class="so-btns"><button class="fx-btn fx-btn-go so-open" data-id="${r.id}">Reopen</button><button class="so-del" data-id="${r.id}">&times;</button></div></div>`).join('') : '<div class="so-empty">No saved proformas yet. Build one and click “Save Proforma”.</div>';
    const m = pfModal(`<h3>Saved Proformas</h3><div class="modal-body">${rows}</div><div class="fx-modal-actions"><button class="fx-btn" id="pf-sv-close">Close</button></div>`);
    m.querySelector('#pf-sv-close').onclick = () => m.remove();
    m.querySelectorAll('.so-open').forEach(b => b.onclick = () => { reopenProforma(b.dataset.id); m.remove(); });
    m.querySelectorAll('.so-del').forEach(b => b.onclick = () => { storeSavedPf(loadSavedPf().filter(x => x.id !== b.dataset.id)); m.remove(); openSavedProformas(); });
  }
  function reopenProforma(id) {
    const rec = loadSavedPf().find(x => x.id === id); if (!rec) return;
    model = rec.model; renderBuilder(document.getElementById('pf-app'));
    const src = document.getElementById('pf-src'); if (src) src.textContent = '📂 Reopened saved proforma · ' + (rec.customer || '');
    toast('Reopened ' + (rec.customer || 'proforma'));
  }
  function openFactoryIndents() {
    let inds = []; try { inds = JSON.parse(localStorage.getItem('fixo_factory_indents') || '[]'); } catch (e) {}
    const rows = inds.length ? inds.map(ind => {
      const appr = ind.factoryApproved;
      const status = appr ? '<span class="pf-fi-ok">✓ Approved by factory</span>' : '<span class="pf-fi-wait">⏳ Awaiting factory approval</span>';
      const when = appr && ind.factoryApprovedAt ? ' · ' + new Date(ind.factoryApprovedAt).toLocaleString('en-IN') : '';
      return `<div class="so-row"><div class="so-info"><b>${esc(ind.customer)}</b><span>Indent No. ${esc(ind.indentNo)} · ${(ind.items || []).length} line(s)${when}</span></div><div>${status}</div></div>`;
    }).join('') : '<div class="so-empty">No indents sent to the factory yet.</div>';
    const m = pfModal(`<h3>Indents at Factory</h3><p class="fx-note">Live status of indents sent to the factory — approved vs still awaiting approval.</p><div class="modal-body">${rows}</div><div class="fx-modal-actions"><button class="fx-btn fx-btn-go" id="pf-fi-close">Close</button></div>`);
    m.querySelector('#pf-fi-close').onclick = () => m.remove();
  }
  function setApproval(kind) {
    if (kind === 'declined' || kind === 'reedit') {
      askDeclineReason(kind, (reason) => finalizeApproval(kind, reason));
      return;
    }
    finalizeApproval(kind, '');
  }
  function askDeclineReason(kind, done) {
    const title = kind === 'declined' ? 'Client declined — why?' : 'Re-edit requested — what to change?';
    const m = pfModal(`<h3>${esc(title)}</h3>
      <div class="modal-body">
        <label class="fx-lab">Reason</label>
        <select class="fx-in" id="pf-dr-reason">
          <option>Price too high</option>
          <option>Wants different specification / size</option>
          <option>Quantity change</option>
          <option>Went with another vendor</option>
          <option>Delivery timeline</option>
          <option>Other</option>
        </select>
        <input class="fx-in" id="pf-dr-note" placeholder="Add a note (optional)" style="margin-top:8px">
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="pf-dr-cancel">Cancel</button><button class="fx-btn fx-btn-go" id="pf-dr-ok">Save</button></div>`);
    m.querySelector('#pf-dr-cancel').onclick = () => m.remove();
    m.querySelector('#pf-dr-ok').onclick = () => { const r = m.querySelector('#pf-dr-reason').value, nt = m.querySelector('#pf-dr-note').value; m.remove(); done(r + (nt ? ' — ' + nt : '')); };
  }
  async function finalizeApproval(kind, reason) {
    model.approval = kind;
    model.approved = kind === 'approved';
    model.declineReason = (kind === 'declined' || kind === 'reedit') ? reason : '';
    const lock = document.getElementById('pf-indent-lock');
    const tb = document.getElementById('pf-indent-tabbtn');
    if (tb) tb.classList.toggle('locked', !model.approved);
    if (lock) lock.textContent = model.approved ? '✓' : '🔒';
    renderStatus(); renderApproval();
    // Record the approval against the customer as a shared status entry (client data).
    try {
      if (kind === 'approved' && window.FixoDB && model.customer) {
        const list = await FixoDB.listClients();
        const c = list.find(x => (x.company_name || '').toLowerCase() === String(model.customer).toLowerCase());
        if (c) {
          const t = totals(model);
          await FixoDB.addOrder({
            client_id: c.id, order_date: new Date().toISOString().slice(0, 10),
            quote_no: model.refNo, items: model.items, total_cost: t.totalValue,
            status: 'proforma_approved', source: 'proforma'
          });
        }
      }
    } catch (e) { /* non-fatal */ }
    toast(kind === 'approved' ? 'Client approved — Indent unlocked' : kind === 'declined' ? 'Marked declined' : 'Re-edit requested');
  }

  // ---------------- Indent = PRODUCTION WORK ORDER (office ↔ factory) ----------------
  // Builds the exact PROD/R/05 form. `size`: 'full' = one full A4 page (~28 rows,
  // for large orders); 'half' = compact top-half block (for small orders, so a
  // second indent can be printed below on the same sheet). 'auto' decides by size.
  function buildIndentHtml(m, opts) {
    opts = opts || {};
    const editable = !!opts.editable;
    const yellow = !!opts.yellow;           // factory copy = yellow, office copy = white
    const dispatch = !!opts.dispatchCols;   // add "✓ Dispatch" + "Weight" columns
    const items = m.items || [];
    let size = opts.size || 'auto';
    if (size === 'auto') size = items.length > 10 ? 'full' : 'half';
    const totalRows = size === 'full' ? 28 : 13;
    const logo = img('logo', typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : undefined);
    const cols = dispatch ? 8 : 6;
    const custColspan = cols - 1, titleColspan = cols - 2, signColspan = cols / 2;
    const dispCells = (it) => dispatch
      ? `<td class="c">${it && it.readyToDispatch ? '✓' : ''}</td><td class="c">${it && it.weight ? esc(it.weight) : ''}</td>` : '';

    const imgFor = (txt) => (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.slotHtml)
      ? FIXO_PRODUCT_IMG.slotHtml(txt, 'prod-thumb') : '';
    const ml = (s) => esc(s).replace(/\n/g, '<br>');
    const custHeading = m.indentCustomer || m.customer || m.deliveryTo || '';
    const noteLines = String(m.indentNotes || '').split('\n').map(s => s.trim()).filter(Boolean);
    let rows = '';
    let used = 0;
    if (custHeading) { rows += `<tr class="idt-cust"><td class="c">&nbsp;</td><td colspan="${custColspan}">${ml(custHeading)}</td></tr>`; used++; }
    noteLines.forEach(n => { rows += `<tr class="idt-note"><td class="c">&nbsp;</td><td colspan="${custColspan}">${ml(n)}</td></tr>`; used++; });
    const qv = (q) => (q === 0 || q === '0' || q == null || q === '') ? '' : esc(q);
    items.forEach((it) => {
      rows += `<tr class="idt-item">
        <td class="c">${esc(it.sl != null ? it.sl : '')}</td>
        <td><div class="desc-cell"><span class="desc-txt">${ml(it.desc)}</span>${imgFor(it.desc)}</div></td>
        <td class="c">${qv(it.qty)}</td>
        <td class="c">${esc(it.unit || it.uom || '')}</td>
        <td class="c">${it.dealtBy ? esc(it.dealtBy) : ''}</td>
        <td class="c">${it.deliveryDate ? esc(it.deliveryDate) : ''}</td>
        ${dispCells(it)}
      </tr>`;
      used++;
    });
    const fillerCells = '<td class="c">&nbsp;</td>' + '<td></td>'.repeat(cols - 1);
    for (let f = used; f < totalRows; f++) rows += `<tr>${fillerCells}</tr>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Production Work Order</title><style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
@page{size:A4;margin:8mm}
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8mm;color:#000;font-size:11px;background:${yellow ? '#f7f0a8' : '#fff'}}
.pwo{border:2px solid #000;background:${yellow ? '#f7f0a8' : '#fff'};${size === 'half' ? 'page-break-inside:avoid;' : 'min-height:274mm;'}display:flex;flex-direction:column}
.pwo + .pwo{margin-top:6mm}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:2px 5px;vertical-align:middle}
.c{text-align:center}
.hd{display:flex;align-items:center;justify-content:center;gap:10px;border-bottom:2px solid #000;padding:6px}
.hd img{height:46px}
.hd .co{ text-align:center }
.hd .co b{font-size:19px;letter-spacing:1px}
.hd .co div{font-size:8.5px;font-weight:bold}
.norow td{font-weight:bold;font-size:12px;border-top:none}
.no-val{color:#b00000;font-weight:bold;font-size:15px}
.titlerow th{font-weight:bold;text-align:center;font-size:14px;letter-spacing:.5px}
.titlerow .code{font-size:12px}
thead th{font-weight:bold;text-align:center;font-size:10.5px;background:${yellow ? '#f2ea90' : '#fff'}}
tbody td{height:${size === 'full' ? '9mm' : '8mm'}}
.desc-col{width:${dispatch ? '38%' : '46%'};text-align:left}
.idt-cust td{font-weight:bold;font-size:12.5px;text-align:left}
.idt-note td{font-style:italic;text-decoration:underline;text-align:left;font-size:10.5px}
.idt-item td{height:${size === 'full' ? '13mm' : '11mm'};vertical-align:top}
.desc-cell{display:flex;align-items:flex-start;justify-content:space-between;gap:8px;min-height:${size === 'full' ? '11mm' : '9mm'}}
.desc-txt{flex:1;text-align:left;white-space:pre-wrap}
.prod-thumb{height:${size === 'full' ? '13mm' : '11mm'};width:auto;max-width:24mm;object-fit:contain;border:1px solid #ccc}
${(window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.SLOT_CSS) || ''}
.sign td{font-weight:bold;font-size:11px;height:14mm;vertical-align:bottom}
.layer[contenteditable] td:hover{background:rgba(59,130,246,.07)}
@media print{body{padding:0}.layer[contenteditable] td:hover{background:transparent}}
</style></head><body>
<div class="pwo">
<div class="layer"${editable ? ' contenteditable="true" spellcheck="false"' : ''}>
  <div class="hd">
    ${logo ? `<img id="pv-logo" src="${logo}">` : `<div class="co"><b>FIXOTECH</b><div>ENGINEERING SYSTEMS PRIVATE LIMITED</div><div>ISO 9001:2015 CERTIFIED COMPANY</div></div>`}
  </div>
  <table>
    <tr class="norow"><td style="width:12%">No.</td><td class="no-val" style="width:38%">${esc(m.indentNo || '001')}</td><td style="width:20%;text-align:right">Date :</td><td style="width:30%">${esc(m.indentDate || '')}</td></tr>
  </table>
  <table>
    <thead>
    <tr class="titlerow"><th colspan="${titleColspan}">PRODUCTION WORK ORDER</th><th colspan="2" class="code">PROD/R/05</th></tr>
    <tr>
      <th style="width:8%">Sl.<br>No.</th><th class="desc-col">Description</th><th style="width:9%">QTY.</th><th style="width:9%">UOM</th><th style="width:12%">Dealt By</th><th style="width:12%">Delivery<br>Date</th>${dispatch ? '<th style="width:8%">✓<br>Dispatch</th><th style="width:10%">Weight<br>(kg)</th>' : ''}
    </tr></thead>
    <tbody>${rows}</tbody>
    <tr class="sign"><td colspan="${signColspan}">Prepared by</td><td colspan="${signColspan}">Authorised by</td></tr>
  </table>
</div>
</div>
</body></html>`;
  }

  function idtRowHtml(it, i) {
    it = it || { desc: '', qty: '', unit: '', dealtBy: '', deliveryDate: '' };
    return `
      <tr>
        <td class="c"><input class="idt-sl-in" value="${esc(it.sl != null ? it.sl : '')}" placeholder="—" title="Sl.No — e.g. I, II, III or leave blank"></td>
        <td><textarea class="idt-desc" rows="2" placeholder="Product heading + sizes (type freely — one line each)">${esc(it.desc)}</textarea></td>
        <td class="c"><input class="idt-qty" value="${(it.qty === 0 || it.qty === '0' || it.qty == null) ? '' : esc(it.qty)}"></td>
        <td class="c">${(function () { const u = (it.unit || it.uom || 'Nos'); const opts = ['Nos', 'Mtrs', 'Kgs']; const cur = opts.find(o => o.toLowerCase().slice(0, 3) === String(u).toLowerCase().slice(0, 3)) || u; return `<select class="idt-uom">${[...new Set([cur, ...opts])].map(o => `<option ${o === cur ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`; })()}</td>
        <td class="c"><input class="idt-dealt" value="${esc(it.dealtBy || '')}"></td>
        <td class="c"><input class="idt-deliv" value="${esc(it.deliveryDate || '')}" placeholder="dd-mmm"></td>
        <td class="c"><button class="idt-del" title="Remove line">&times;</button></td>
      </tr>`;
  }

  function renderIndent() {
    const host = document.getElementById('pf-indent'); if (!host) return;
    if (!model.indentNo) model.indentNo = model.items.length && model.items[0].serial ? model.items[0].serial : '001';
    if (!model.indentDate) model.indentDate = today();
    if (model.indentCustomer == null) model.indentCustomer = model.customer || model.deliveryTo || '';
    if (model.indentNotes == null) model.indentNotes = '';
    const rows = model.items.map((it, i) => idtRowHtml(it, i)).join('');
    const autoSize = model.items.length > 10 ? 'Full page' : 'Half page';
    host.innerHTML = `
      <div class="pf-indent-note"><b>Production Work Order (Indent)</b> — sent to the factory, no prices. One order per sheet. Series <b>No. ${esc(model.indentNo)}</b> (dummy 001 for now). Type the description block freely, just like the handwritten indent — product heading on one line, sizes below. The product picture prints on the right with room to annotate.</div>
      <div class="pf-fields" style="grid-template-columns:repeat(3,1fr)">
        <label>No.<input type="text" id="idt-no" value="${esc(model.indentNo)}"></label>
        <label>Date<input type="text" id="idt-date" value="${esc(model.indentDate)}"></label>
        <label>Page size
          <select id="idt-size"><option value="auto">Auto (${autoSize})</option><option value="full">Full page</option><option value="half">Half page</option></select>
        </label>
      </div>
      <div class="pf-fields" style="grid-template-columns:1fr 1fr">
        <label>Customer / Site (heading)<input type="text" id="idt-cust" value="${esc(model.indentCustomer)}" placeholder="e.g. Shivashakthi Entpr."></label>
        <label>Notes (one per line — e.g. finish / colour)<textarea id="idt-notes" rows="2" placeholder="e.g. Siemens grey">${esc(model.indentNotes)}</textarea></label>
      </div>
      <div class="pf-items-wrap">
        <table class="vf-items idt-table">
          <thead><tr><th>Sl.No</th><th>Description</th><th>QTY.</th><th>UOM</th><th>Dealt By</th><th>Delivery Date</th><th></th></tr></thead>
          <tbody id="idt-body">${rows}</tbody>
        </table>
      </div>
      <div style="margin:6px 0"><button class="btn-export" id="idt-add" style="padding:8px 14px">+ Add line</button></div>
      <label class="idt-urgent"><input type="checkbox" id="idt-urgent"> 🚩 Send as <b>URGENT</b> (alerts the factory floor)</label>
      <div class="pf-actions">
        <button class="btn-export btn-print" id="idt-print">🖨 Verify &amp; Print Indent</button>
        <button class="btn-forward" id="idt-send" style="width:auto;padding:12px 20px;margin:0">➤ Send to Factory</button>
      </div>
      <div id="idt-factory-msg"></div>`;
    document.getElementById('idt-no').addEventListener('input', e => { model.indentNo = e.target.value; });
    document.getElementById('idt-date').addEventListener('input', e => { model.indentDate = e.target.value; });
    document.getElementById('idt-cust').addEventListener('input', e => { model.indentCustomer = e.target.value; });
    document.getElementById('idt-notes').addEventListener('input', e => { model.indentNotes = e.target.value; });
    bindIndentRows(host);
    document.getElementById('idt-add').addEventListener('click', () => {
      model.items.push({ serial: '001', desc: '', qty: '', unit: 'Nos', dealtBy: '', deliveryDate: '' });
      const tb = document.getElementById('idt-body');
      tb.insertAdjacentHTML('beforeend', idtRowHtml(model.items[model.items.length - 1], model.items.length - 1));
      bindIndentRows(host);
    });
    document.getElementById('idt-print').addEventListener('click', () => openIndentEditor(document.getElementById('idt-size').value));
    document.getElementById('idt-send').addEventListener('click', sendToFactory);
  }

  function bindIndentRows(host) {
    host.querySelectorAll('#idt-body tr').forEach((tr, i) => {
      const sync = () => {
        if (!model.items[i]) return;
        model.items[i].sl = tr.querySelector('.idt-sl-in').value;
        model.items[i].desc = tr.querySelector('.idt-desc').value;
        model.items[i].qty = tr.querySelector('.idt-qty').value;
        model.items[i].unit = tr.querySelector('.idt-uom').value;
        model.items[i].dealtBy = tr.querySelector('.idt-dealt').value;
        model.items[i].deliveryDate = tr.querySelector('.idt-deliv').value;
      };
      tr.querySelectorAll('input,textarea').forEach(inp => { inp.oninput = sync; });
      const del = tr.querySelector('.idt-del');
      if (del) del.onclick = () => { model.items.splice(i, 1); renderIndent(); };
    });
  }

  function openIndentEditor(size) {
    const html = buildIndentHtml(model, { editable: true, size: size || 'auto' });
    const titleEl = document.getElementById('pi-editor-title'); if (titleEl) titleEl.textContent = 'Verify & Edit — Production Work Order (Indent)';
    const procEl = document.getElementById('pi-proceed'); if (procEl) procEl.textContent = 'Proceed to Print';
    const frame = document.getElementById('pi-frame');
    const d = frame.contentDocument || frame.contentWindow.document;
    d.open(); d.write(html); d.close();
    // Click any product picture to replace it — the change flows to the
    // quotation and every other stage.
    if (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.attachReplaceUI) {
      FIXO_PRODUCT_IMG.attachReplaceUI(d, { imgClass: 'prod-thumb', onReplaced: () => toast('Picture updated everywhere') });
    }
    document.getElementById('pi-editor-modal').classList.add('show');
  }
  function sendToFactory() {
    model.sentToFactory = true;
    renderStatus();
    // Persist the indent (yellow copy) to the shared factory store.
    const urgentEl = document.getElementById('idt-urgent');
    const rec = {
      id: 'ind-' + Date.now(),
      refNo: model.refNo || '', indentNo: model.indentNo || '001',
      indentDate: model.indentDate || '', sentAt: new Date().toISOString(),
      priority: !!(urgentEl && urgentEl.checked),
      customer: model.indentCustomer || model.customer || '', customerAddr: model.customerAddr || '',
      indentCustomer: model.indentCustomer || model.customer || '', indentNotes: model.indentNotes || '',
      items: (model.items || []).map((it, i) => ({
        id: 'it-' + Date.now() + '-' + i,
        sl: it.sl != null ? it.sl : '', desc: it.desc || '', qty: it.qty,
        unit: it.unit || it.uom || '', dealtBy: it.dealtBy || '', deliveryDate: it.deliveryDate || ''
      }))
    };
    if (window.FIXO_FACTORY && FIXO_FACTORY.receiveIndent) FIXO_FACTORY.receiveIndent(rec);
    const msg = document.getElementById('idt-factory-msg');
    if (msg) msg.innerHTML = `<div class="pf-factory-ok">✓ Indent sent to Factory${rec.priority ? ' as <b>🚩 URGENT</b> — the floor is alerted' : ''} — it's now in the Factory app (Indents tab).</div>`;
    toast(rec.priority ? 'Sent to Factory as URGENT 🚩' : 'Sent to Factory');
  }

  function addRow(it) {
    const tb = document.getElementById('pf-items-body');
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
    tr.querySelector('.vf-qty').addEventListener('input', syncItems);
    tr.querySelector('.vf-rate').addEventListener('input', syncItems);
    ['.vf-desc', '.vf-unit'].forEach(s => tr.querySelector(s).addEventListener('input', syncItems));
    tr.querySelector('.vf-del').addEventListener('click', () => { tr.remove(); syncItems(); });
  }
  function renderItems() {
    document.getElementById('pf-items-body').innerHTML = '';
    (model.items.length ? model.items : [{ desc: '', unit: 'Nos', qty: 1, rate: 0 }]).forEach(addRow);
    syncItems();
  }
  function syncItems() {
    const items = [];
    document.querySelectorAll('#pf-items-body tr').forEach((tr, i) => {
      const qty = num(tr.querySelector('.vf-qty').value);
      const rate = num(tr.querySelector('.vf-rate').value);
      const amount = Math.round(qty * rate);
      tr.querySelector('.vf-sl').textContent = i + 1;
      tr.querySelector('.vf-amt').textContent = '₹' + money(amount);
      items.push({ sl: i + 1, desc: tr.querySelector('.vf-desc').value, unit: tr.querySelector('.vf-unit').value, qty, rate, amount });
    });
    model.items = items;
    renderTotals();
  }
  function renderTotals() {
    const t = totals(model);
    const rows = model.type === 'state'
      ? `<div><span>CGST @${(model.gstRate / 2)}%</span><b>₹${money(t.cgst)}</b></div><div><span>SGST @${(model.gstRate / 2)}%</span><b>₹${money(t.sgst)}</b></div>`
      : `<div><span>IGST @${model.gstRate}%</span><b>₹${money(t.igst)}</b></div>`;
    document.getElementById('pf-totals').innerHTML = `
      <div class="pf-tot-box">
        <div><span>BASIC</span><b>₹${money(t.basic)}</b></div>
        ${rows}
        ${t.freight > 0 ? `<div><span>FREIGHT</span><b>₹${money(t.freight)}</b></div>` : ''}
        <div><span>ROUND OFF</span><b>₹${money(t.roundOff)}</b></div>
        <div class="pf-grand"><span>TOTAL VALUE</span><b>₹${money(t.totalValue)}</b></div>
        <div class="pf-words">${inWords(t.totalValue)}</div>
      </div>`;
  }

  // ---------------- entry points ----------------
  function loadFromQuote(items, client, meta) {
    meta = meta || {};
    model = freshModel();
    model.items = (items || []).map((it, i) => ({ sl: i + 1, serial: '001', desc: it.desc || it.name || '', unit: it.unit || 'Nos', qty: num(it.qty), rate: num(it.rate), amount: Math.round(num(it.qty) * num(it.rate)) }));
    model.fromCalculator = true;
    model.freight = num(meta.freight) || 0;
    if (meta.deliverAddr) { model.deliveryAddr = meta.deliverAddr; model.deliveryTo = model.deliveryTo || client || ''; }
    if (client && client !== 'N/A') model.customer = client;
    // pull GST/address from the client DB if we have a match
    tryFillCustomerFromDB(client);
    const host = document.getElementById('pf-app'); renderBuilder(host);
    document.getElementById('pf-src').textContent = '✓ Received from Smart Calculator' + (client && client !== 'N/A' ? ' · ' + client : '');
    document.getElementById('pf-src').classList.add('recv');
  }
  function loadItems(items, meta) { loadFromQuote(items, meta && meta.client); }

  async function tryFillCustomerFromDB(client) {
    try {
      if (!client || !window.FixoDB) return;
      const list = await FixoDB.listClients();
      const c = list.find(x => (x.company_name || '').toLowerCase() === String(client).toLowerCase() || (x.client_name || '').toLowerCase() === String(client).toLowerCase());
      if (c) {
        model.customer = c.company_name || c.client_name || client;
        model.customerGst = c.gstin || '';
        model.customerAddr = c.site_address || '';
        ['pf-cust', 'pf-custgst', 'pf-custaddr'].forEach((id, i) => { const el = document.getElementById(id); if (el) el.value = [model.customer, model.customerGst, model.customerAddr][i]; });
      }
    } catch (e) { /* optional */ }
  }

  async function onUpload(e) {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    if (!window.FixoParse) { toast('Parser not loaded'); return; }
    try {
      const isPdf = /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
      const parsed = isPdf ? await window.FixoParse.pdf(file) : window.FixoParse.csv(await file.text());
      if (!parsed.items.length) { toast('Could not extract line items from that file'); return; }
      loadFromQuote(parsed.items.map(it => ({ desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate })), parsed.customer || model.customer);
      if (parsed.customer) { model.customer = parsed.customer; const el = document.getElementById('pf-cust'); if (el) el.value = parsed.customer; }
      if (parsed.gst) { model.customerGst = parsed.gst; const el = document.getElementById('pf-custgst'); if (el) el.value = parsed.gst; }
      document.getElementById('pf-src').textContent = 'Uploaded: ' + file.name;
      toast('Loaded ' + parsed.items.length + ' item(s) from ' + file.name);
    } catch (err) { toast('Upload failed: ' + err.message); }
  }

  // ---------------- PI document (HTML) ----------------
  function buildPiHtml(m, opts) {
    opts = opts || {};
    const editable = !!opts.editable;
    const t = totals(m);
    const paperCss = 'A4';
    const logo = img('logo', typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : undefined);
    const cert = img('cert', typeof CERT_IMG !== 'undefined' ? CERT_IMG : undefined);
    const seal = img('seal', typeof SEAL_IMG !== 'undefined' ? SEAL_IMG : undefined);
    const wm = img('watermark', typeof WATERMARK_IMG !== 'undefined' ? WATERMARK_IMG : undefined);
    const title = m.type === 'state' ? 'ORDER ACCEPTANCE' : 'PROFORMA INVOICE / ORDER ACCEPTANCE';
    const taxRows = m.type === 'state'
      ? `<tr><td class="r lbl">CGST @${m.gstRate / 2}%</td><td class="r">${money(t.cgst)}</td></tr>
         <tr><td class="r lbl">SGST @${m.gstRate / 2}%</td><td class="r">${money(t.sgst)}</td></tr>`
      : `<tr><td class="r lbl">IGST @${m.gstRate}%</td><td class="r">${money(t.igst)}</td></tr>`;

    let rows = '';
    m.items.forEach((it, i) => {
      rows += `<tr><td class="c">${it.sl != null ? it.sl : i + 1}</td><td>${esc(it.desc)}</td><td class="c">${esc(it.unit || '')}</td><td class="c">${esc(it.qty)}</td><td class="r">${money(it.rate)}</td><td class="r b">${money(it.amount)}</td></tr>`;
    });
    for (let f = model.items.length; f < 8; f++) rows += '<tr><td class="c">&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>';

    const bank = (bk) => `<div class="bk"><div>Name of the Bank : ${esc(bk.name)}</div><div>Name of the account : ${esc(bk.ac)}</div><div>Branch Address : ${esc(bk.branch)}</div><div>Type of Account : ${esc(bk.type)}</div><div>Account No : ${esc(bk.no)}</div><div>IFSC Code : ${esc(bk.ifsc)}</div></div>`;

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Proforma Invoice</title><style>
*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}
@page{size:${paperCss};margin:8mm}
body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:8mm;color:#000;font-size:10px}
.doc{border:1.5px solid #000;position:relative}
.layer{position:relative;z-index:1}
.wm{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;opacity:.06;pointer-events:none;z-index:0}
.wm img{width:42%;max-width:300px}
table{width:100%;border-collapse:collapse}
td,th{border:1px solid #000;padding:3px 5px;vertical-align:top}
.c{text-align:center}.r{text-align:right}.b{font-weight:bold}.lbl{font-weight:bold}
.headwrap{display:flex;border-bottom:1px solid #000}
.logobox{flex:1;border-right:1px solid #000;padding:6px 8px;text-align:center}
.logobox img{max-height:48px;max-width:100%}
.certbox{width:150px;padding:5px;display:flex;align-items:center;justify-content:center}
.certbox img{max-height:54px;max-width:100%}
.line{text-align:center;font-size:8.5px;border-bottom:1px solid #000;padding:2px 4px}
.title{text-align:center;font-weight:bold;font-size:13px;letter-spacing:1px;border-bottom:1px solid #000;padding:4px 0}
.party td{font-size:9.5px}
.cl{color:#8a0000;font-weight:bold}
.prod th{font-weight:bold;text-align:center;font-size:10px;background:#eef2f7}
.tot td{font-size:9.5px}
.tot .grand td{font-weight:bold;background:#dbe5f1;font-size:11px}
.foot td{font-size:9px}
.words{font-weight:bold;font-size:9.5px}
.sign{height:70px;position:relative}
.sign .seal{position:absolute;left:8px;bottom:18px;height:40px}
.bank td{font-size:8.5px}
.bk div{line-height:1.5}
.note{color:#c00000;text-align:center;font-weight:bold;font-size:9px}
.layer[contenteditable] td:hover{background:rgba(59,130,246,.07)}
@media print{body{padding:0}.layer[contenteditable] td:hover{background:transparent}}
</style></head><body>
<div class="doc">
${wm ? `<div class="wm"><img id="pv-wm" src="${wm}"></div>` : ''}
<div class="layer"${editable ? ' contenteditable="true" spellcheck="false"' : ''}>
  <div class="headwrap">
    <div class="logobox">${logo ? `<img id="pv-logo" src="${logo}">` : `<b style="font-size:20px">FIXOTECH</b>`}</div>
    <div class="certbox">${cert ? `<img id="pv-cert" src="${cert}">` : ''}</div>
  </div>
  <div class="line">${esc(CO.address)}</div>
  <div class="line">${esc(CO.contact)}</div>
  <div class="title">${title}</div>

  <table class="party">
    <tr><td style="width:50%"><b>Ref No</b> ${esc(m.refNo)}</td><td colspan="2"><b>Date :-</b> ${esc(m.piDate)}</td></tr>
    <tr><td><b>To,</b></td><td><b>PO No:-</b> ${esc(m.poNo)}</td><td style="width:22%"><b>Date:-</b> ${esc(m.poDate)}</td></tr>
    <tr><td><b>M/s</b> <span class="cl">${esc(m.customer)}</span></td><td colspan="2"><b>Delivery Address:-</b></td></tr>
    <tr><td>${esc(m.customerAddr).replace(/\n/g, '<br>')}</td><td colspan="2"><b>M/s</b> ${esc(m.deliveryTo)}</td></tr>
    <tr><td><b>GST NO:-</b> ${esc(m.customerGst)}</td><td colspan="2">${esc(m.deliveryAddr).replace(/\n/g, '<br>')}</td></tr>
  </table>

  <table class="prod">
    <tr><th style="width:8%">SL.NO</th><th style="width:44%">DESCRIPTION</th><th style="width:10%">UNIT</th><th style="width:10%">QTY</th><th style="width:13%">RATES</th><th style="width:15%">AMOUNT</th></tr>
    ${rows}
  </table>

  <table class="tot">
    <tr><td rowspan="${(m.type === 'state' ? 5 : 4) + (t.freight > 0 ? 1 : 0)}" style="border:none"></td><td class="r lbl" style="width:26%">BASIC</td><td class="r" style="width:15%">${money(t.basic)}</td></tr>
    ${taxRows}
    ${t.freight > 0 ? `<tr><td class="r lbl">FREIGHT</td><td class="r">${money(t.freight)}</td></tr>` : ''}
    <tr><td class="r lbl">ROUND OFF</td><td class="r">${money(t.roundOff)}</td></tr>
    <tr class="grand"><td class="r">TOTAL VALUE</td><td class="r">${money(t.totalValue)}</td></tr>
  </table>

  <table class="foot">
    <tr><td colspan="2">TRANSPORTATION CHARGES EXTRA</td></tr>
    <tr><td colspan="2" class="words">AMOUNT IN WORDS: ${esc(inWords(t.totalValue))}</td></tr>
    <tr><td style="width:55%">${esc(CO.tin)}<br>Yours faithfully,<br><b>For ${esc(CO.name)}</b></td>
        <td class="sign">${esc(CO.gst)}${seal ? `<img id="pv-seal" class="seal" src="${seal}">` : ''}<div style="position:absolute;left:8px;bottom:2px"><b>Authorised Signatory</b></div></td></tr>
  </table>

  <table class="bank">
    <tr><td colspan="2"><b>Our Bank details</b></td></tr>
    <tr><td style="width:50%">${bank(CO.banks[0])}</td><td>${bank(CO.banks[1])}</td></tr>
  </table>

  <table><tr class="note"><td>${esc(CO.footer)}</td></tr></table>
</div>
</div>
</body></html>`;
  }

  // ---------------- WYSIWYG editor + print ----------------
  function buildEditor() {
    const el = document.createElement('div');
    el.innerHTML = `
      <div class="modal-overlay" id="pi-editor-modal">
        <div class="modal-dialog pdfed-dialog">
          <div class="modal-header"><div class="modal-title-group"><h3 id="pi-editor-title">Verify &amp; Edit — Proforma Invoice</h3></div><button class="modal-close-btn" id="pi-x">&times;</button></div>
          <div class="pdfed-toolbar">
            <span class="pdfed-hint">✎ Click anywhere to edit. Replace images if needed, then print.</span>
            <span class="pdfed-imgbtns">
              <button class="cp-btn small" data-repl="logo">Replace Logo</button>
              <button class="cp-btn small" data-repl="cert">Replace Mark</button>
              <button class="cp-btn small" data-repl="seal">Replace Seal</button>
              <input type="file" accept="image/*" id="pi-file" hidden>
            </span>
          </div>
          <div class="pdfed-body"><iframe id="pi-frame" title="Proforma preview"></iframe></div>
          <div class="modal-actions vf-actions"><button class="btn-cancel" id="pi-cancel">Cancel</button><button class="btn-send" id="pi-proceed">Proceed to Print</button></div>
        </div>
      </div>`;
    document.body.appendChild(el.firstElementChild);
    document.getElementById('pi-x').addEventListener('click', closeEditor);
    document.getElementById('pi-cancel').addEventListener('click', closeEditor);
    document.getElementById('pi-proceed').addEventListener('click', () => {
      const frame = document.getElementById('pi-frame');
      try { frame.contentWindow.focus(); frame.contentWindow.print(); } catch (e) {}
      closeEditor();
    });
    let repl = null;
    const fi = document.getElementById('pi-file');
    document.querySelectorAll('#pi-editor-modal [data-repl]').forEach(b => b.addEventListener('click', () => { repl = b.dataset.repl; fi.value = ''; fi.click(); }));
    fi.addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f || !repl) return;
      const url = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(f); });
      const d = document.getElementById('pi-frame').contentDocument;
      const im = d && d.getElementById('pv-' + repl); if (im) im.src = url;
    });
  }
  function openEditor() {
    if (!model.items.length || model.items.every(it => !it.desc && !it.amount)) { toast('Add at least one line item'); return; }
    const html = buildPiHtml(model, { editable: true });
    const frame = document.getElementById('pi-frame');
    const d = frame.contentDocument || frame.contentWindow.document;
    d.open(); d.write(html); d.close();
    document.getElementById('pi-editor-modal').classList.add('show');
  }
  function closeEditor() { document.getElementById('pi-editor-modal').classList.remove('show'); }

  // ---------------- Excel ----------------
  function piFileName(ext) {
    const slug = (s) => String(s || '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'PI';
    const d = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return 'Fixotech_ProformaInvoice_' + slug(model.customer) + '_' + slug(model.refNo) + '_' + d + '.' + ext;
  }
  async function exportPiXlsx(returnBlob) {
    if (typeof ExcelJS === 'undefined') { toast('Excel engine not loaded'); return; }
    if (!model.items.length) { toast('Add line items first'); return; }
    const t = totals(model);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Proforma Invoice', { views: [{ showGridLines: false }], pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } } });
    ws.columns = [{ width: 8 }, { width: 44 }, { width: 10 }, { width: 10 }, { width: 14 }, { width: 16 }];
    const thin = { style: 'thin', color: { argb: 'FF000000' } };
    const box = { top: thin, left: thin, bottom: thin, right: thin };
    const set = (a, v, o) => { o = o || {}; const c = ws.getCell(a); c.value = v; c.font = { name: 'Arial', size: o.size || 10, bold: !!o.bold, color: { argb: o.color || 'FF000000' } }; c.alignment = { vertical: 'middle', horizontal: o.align || 'left', wrapText: !!o.wrap }; if (o.fill) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: o.fill } }; if (o.border !== false) c.border = box; return c; };
    const b64 = d => (d && d.indexOf(',') >= 0) ? d.split(',')[1] : d;

    ws.getRow(1).height = 20; ws.getRow(2).height = 20; ws.getRow(3).height = 20;
    ws.mergeCells('A1:D3'); ws.mergeCells('E1:F3'); ws.getCell('A1').border = box; ws.getCell('E1').border = box;
    try {
      const lg = img('logo', typeof LOGO_IMG !== 'undefined' ? LOGO_IMG : undefined);
      const ct = img('cert', typeof CERT_IMG !== 'undefined' ? CERT_IMG : undefined);
      if (lg) ws.addImage(wb.addImage({ base64: b64(lg), extension: 'png' }), { tl: { col: 0.15, row: 0.15 }, br: { col: 3.0, row: 2.85 } });
      if (ct) ws.addImage(wb.addImage({ base64: b64(ct), extension: 'png' }), { tl: { col: 4.15, row: 0.15 }, br: { col: 5.85, row: 2.85 } });
    } catch (e) {}
    ws.mergeCells('A4:F4'); set('A4', CO.address, { align: 'center', size: 8 });
    ws.mergeCells('A5:F5'); set('A5', CO.contact, { align: 'center', size: 8 });
    ws.mergeCells('A6:F6'); set('A6', model.type === 'state' ? 'ORDER ACCEPTANCE' : 'PROFORMA INVOICE / ORDER ACCEPTANCE', { bold: true, align: 'center', size: 12 });

    let r = 7;
    const two = (a, b) => { ws.mergeCells('A' + r + ':C' + r); ws.mergeCells('D' + r + ':F' + r); set('A' + r, a, { bold: true, size: 9 }); set('D' + r, b, { bold: true, size: 9 }); r++; };
    two('Ref No ' + model.refNo, 'Date :- ' + model.piDate);
    two('To,', 'PO No:- ' + model.poNo + '     Date:- ' + model.poDate);
    two('M/s  ' + model.customer, 'Delivery Address:-');
    two(model.customerAddr, 'M/s  ' + model.deliveryTo);
    two('GST NO:- ' + model.customerGst, model.deliveryAddr);

    const hdr = ['SL.NO', 'DESCRIPTION', 'UNIT', 'QTY', 'RATES', 'AMOUNT'];
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((c, i) => set(c + r, hdr[i], { bold: true, align: 'center', size: 9, fill: 'FFEEF2F7' })); r++;
    model.items.forEach((it, i) => {
      set('A' + r, it.sl != null ? it.sl : i + 1, { align: 'center', size: 9 });
      set('B' + r, it.desc, { size: 9, wrap: true });
      set('C' + r, it.unit || '', { align: 'center', size: 9 });
      set('D' + r, it.qty, { align: 'center', size: 9 });
      set('E' + r, Number(it.rate), { align: 'right', size: 9 }); ws.getCell('E' + r).numFmt = '#,##0.00';
      set('F' + r, Number(it.amount), { align: 'right', size: 9, bold: true }); ws.getCell('F' + r).numFmt = '#,##0.00';
      r++;
    });
    const totLines = model.type === 'state'
      ? [['BASIC', t.basic], ['CGST @' + (model.gstRate / 2) + '%', t.cgst], ['SGST @' + (model.gstRate / 2) + '%', t.sgst], ...(t.freight > 0 ? [['FREIGHT', t.freight]] : []), ['ROUND OFF', t.roundOff], ['TOTAL VALUE', t.totalValue]]
      : [['BASIC', t.basic], ['IGST @' + model.gstRate + '%', t.igst], ...(t.freight > 0 ? [['FREIGHT', t.freight]] : []), ['ROUND OFF', t.roundOff], ['TOTAL VALUE', t.totalValue]];
    totLines.forEach((ln, idx) => {
      ws.mergeCells('A' + r + ':D' + r);
      const grand = ln[0] === 'TOTAL VALUE';
      set('A' + r, '', {});
      set('E' + r, ln[0], { bold: true, align: 'right', size: 9, fill: grand ? 'FFDBE5F1' : undefined });
      set('F' + r, Number(ln[1]), { bold: true, align: 'right', size: 9, fill: grand ? 'FFDBE5F1' : undefined }); ws.getCell('F' + r).numFmt = '#,##0.00';
      r++;
    });
    ws.mergeCells('A' + r + ':F' + r); set('A' + r, 'TRANSPORTATION CHARGES EXTRA', { size: 9 }); r++;
    ws.mergeCells('A' + r + ':F' + r); set('A' + r, 'AMOUNT IN WORDS: ' + inWords(t.totalValue), { bold: true, size: 9 }); r++;
    ws.mergeCells('A' + r + ':C' + (r + 2)); ws.mergeCells('D' + r + ':F' + (r + 2));
    set('A' + r, CO.tin + '\nYours faithfully,\nFor ' + CO.name, { size: 9, wrap: true });
    set('D' + r, CO.gst + '\n\nAuthorised Signatory', { size: 9, wrap: true });
    r += 3;
    ws.mergeCells('A' + r + ':F' + r); set('A' + r, 'Our Bank details', { bold: true, size: 9 }); r++;
    const bankText = (bk) => 'Name of the Bank : ' + bk.name + '\nName of the account : ' + bk.ac + '\nBranch Address : ' + bk.branch + '\nType of Account : ' + bk.type + '\nAccount No : ' + bk.no + '\nIFSC Code : ' + bk.ifsc;
    ws.mergeCells('A' + r + ':C' + r); ws.mergeCells('D' + r + ':F' + r);
    set('A' + r, bankText(CO.banks[0]), { size: 8, wrap: true }); set('D' + r, bankText(CO.banks[1]), { size: 8, wrap: true }); ws.getRow(r).height = 78; r++;
    ws.mergeCells('A' + r + ':F' + r); set('A' + r, CO.footer, { bold: true, align: 'center', size: 9, color: 'FFCC0000' });

    const buf = await wb.xlsx.writeBuffer();
    const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    if (returnBlob) return { blob, filename: piFileName('xlsx') };
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = piFileName('xlsx'); a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Proforma Excel saved');
  }

  // ---------------- share (attach the Excel) ----------------
  async function sharePi(kind) {
    if (!model.items.length) { toast('Add line items first'); return; }
    const x = await exportPiXlsx(true);
    if (!x) return;
    const file = new File([x.blob], x.filename, { type: x.blob.type });
    const text = 'Fixotech Proforma Invoice ' + model.refNo + (model.customer ? ' — ' + model.customer : '');
    if (window.shareQuoteFiles) {
      const res = await window.shareQuoteFiles([file], 'Proforma Invoice', text);
      if (res === 'shared') { toast('Shared'); return; }
      if (res === 'cancelled') return;
    }
    // fallback: download + open wa/mail
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
    if (kind === 'wa') window.open('https://wa.me/?text=' + encodeURIComponent(text + '\n\n[Proforma Excel downloaded — please attach]'), '_blank');
    else window.open('mailto:?subject=' + encodeURIComponent('Fixotech Proforma Invoice ' + model.refNo) + '&body=' + encodeURIComponent(text + '\n\n[Proforma Excel downloaded — please attach]'), '_blank');
    toast('File downloaded — attach it to send');
  }
})();
