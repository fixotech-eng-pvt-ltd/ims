// ============================================================
// Fixotech Inno Structures LLP — INVOICING app
// A GST Tax-Invoice builder (replaces Zoho for this company). Matches the
// FIS tax-invoice format: Bill-To / Ship-To, HSN/SAC, per-item CGST/SGST (or
// IGST inter-state), discount, totals + amount-in-words, notes & T&C. Editable
// WYSIWYG PDF (print / save) with a Save option, saved invoices for reuse, and a
// seeded product catalogue (struts, base plates, clamps, fasteners, services).
// Self-contained & separate from the Engineering IMS.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const uid = (p) => (p || 'inv') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');   // dd/mm/yyyy (as on FIS invoice)

  const CO = {
    name: 'FIXOTECH INNO STRUCTURES LLP',
    address: 'NO 4, J.P.R Building, Lakshmipura Main Road, Bangalore, Karnataka 560090, India',
    gstin: '29AAKFF5695E1ZY',
    // Embedded (data-URI) so the logo always renders in the PDF editor, print & offline.
    logo: (typeof window !== 'undefined' && window.INNO_LOGO_DATA) ? window.INNO_LOGO_DATA : 'assets/brand/inno-logo.png'
  };
  const STATUS = { draft: { label: 'Draft', cls: 'st-draft' }, sent: { label: 'Sent to client', cls: 'st-sent' }, approved: { label: 'Approved', cls: 'st-ok' }, declined: { label: 'Not approved', cls: 'st-no' } };
  const SAVED = 'fixo_inno_invoices', SEQ = 'fixo_inno_inv_seq', CUSTS = 'fixo_inno_customers';
  const CO_STATE = '29';   // Karnataka — company's place of supply
  // Indian states (code → name) for Place of Supply.
  const STATES = [['37','Andhra Pradesh'],['12','Arunachal Pradesh'],['18','Assam'],['10','Bihar'],['04','Chandigarh'],['22','Chhattisgarh'],['07','Delhi'],['30','Goa'],['24','Gujarat'],['06','Haryana'],['02','Himachal Pradesh'],['01','Jammu & Kashmir'],['20','Jharkhand'],['29','Karnataka'],['32','Kerala'],['23','Madhya Pradesh'],['27','Maharashtra'],['14','Manipur'],['17','Meghalaya'],['15','Mizoram'],['13','Nagaland'],['21','Odisha'],['34','Puducherry'],['03','Punjab'],['08','Rajasthan'],['11','Sikkim'],['33','Tamil Nadu'],['36','Telangana'],['16','Tripura'],['09','Uttar Pradesh'],['05','Uttarakhand'],['19','West Bengal']];
  const stateName = (code) => { const s = STATES.find(x => x[0] === code); return s ? s[1] : ''; };
  const posLabel = (code) => code ? '[' + code + '] ' + stateName(code) : '';
  const gstStateCode = (gstin) => (String(gstin || '').trim().match(/^(\d{2})/) || [, ''])[1];
  const loadCusts = () => { try { return JSON.parse(localStorage.getItem(CUSTS) || '[]') || []; } catch (e) { return []; } };
  const storeCusts = (a) => { try { localStorage.setItem(CUSTS, JSON.stringify(a.slice(0, 500))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(CUSTS); } catch (e) {} };
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED) || '[]') || []; } catch (e) { return []; } };
  const storeSaved = (a) => { try { localStorage.setItem(SAVED, JSON.stringify(a.slice(0, 200))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(SAVED); } catch (e) {} };
  function nextInvNo() { const n = (parseInt(localStorage.getItem(SEQ) || '100', 10) || 100) + 1; localStorage.setItem(SEQ, String(n)); return 'FIS0' + n; }

  // Seeded catalogue (from the FIS invoice + brochure). rate ₹, HSN/SAC, unit.
  const PRODUCTS = [
    { name: 'Uni Strut Channel 41X41 2mm (ZAM) - 3mtr', hsn: '72169930', unit: 'NOS', rate: 295 },
    { name: 'Uni Strut Channel 41X21 2mm (ZAM) - 3mtr', hsn: '72169930', unit: 'NOS', rate: 230 },
    { name: 'Base Plate RBP41 HDG', hsn: '73089090', unit: 'NOS', rate: 250 },
    { name: 'Angle Connector', hsn: '72169930', unit: 'NOS', rate: 220 },
    { name: 'End Cap 41', hsn: '39269099', unit: 'NOS', rate: 10 },
    { name: 'End Clamp', hsn: '72169930', unit: 'NOS', rate: 30 },
    { name: 'Mid Clamp', hsn: '72169930', unit: 'NOS', rate: 45 },
    { name: 'Clamp for Strut Channel', hsn: '72169930', unit: 'NOS', rate: 45 },
    { name: 'Chemical Anchor Fastener M12X120', hsn: '72169930', unit: 'NOS', rate: 290 },
    { name: 'Hilti Make Chemical for Anchor Fastener', hsn: '73181900', unit: 'NOS', rate: 2000 },
    { name: 'Bolt and Nut M10X65 (8.8 grade)', hsn: '73181500', unit: 'NOS', rate: 49 },
    { name: 'Bolt and Nut M10X25 (8.8 grade)', hsn: '73181500', unit: 'NOS', rate: 40 },
    { name: 'Self Screw', hsn: '72169930', unit: 'NOS', rate: 25 },
    { name: 'L and Key Bolt and Wing Nut M8X30', hsn: '72169930', unit: 'NOS', rate: 30 },
    { name: 'Site Visit, Design and Analysis', hsn: '998391', unit: 'NOS', rate: 5000 }
  ];

  let model = null;
  function fresh() {
    return {
      id: uid('inv-'), invNo: nextInvNo(), invDate: today(), terms: 'Due on Receipt', dueDate: today(), eway: '', orderNo: '', salesperson: '', subject: '',
      posCode: CO_STATE, placeOfSupply: posLabel(CO_STATE), type: 'state', gstRate: 18,
      custId: '', billName: '', billGst: '', billAddr: '', sameShip: true, shipName: '', shipGst: '', shipAddr: '',
      items: [blank()], discountPct: 0, status: 'draft', sentAt: '', approvedAt: '',
      notes: 'Looking forward for your business.',
      tcDelivery: 'Packing & Delivery charges extra at actuals.',
      tcPayment: '50% Advance and the rest before dispatch.',
      tcNote: 'Prices are subject to change depends upon the changes in the material rates.'
    };
  }
  const blank = () => ({ desc: '', sku: '', hsn: '', qty: '', unit: 'NOS', rate: '' });

  // ---------- working sessions (like the Smart Calculator's Order 1/2/3) ----------
  // Multiple invoices open at once; auto-saved so a reload (or accidental refresh)
  // never loses work — only "Clear" empties the current one.
  const SESS = 'fixo_inno_sessions';
  let sessions = [], activeIdx = 0;
  function loadSessions() {
    try { const s = JSON.parse(localStorage.getItem(SESS) || 'null'); if (s && Array.isArray(s.sessions) && s.sessions.filter(Boolean).length) { sessions = s.sessions.filter(Boolean); activeIdx = Math.min(s.activeIdx || 0, sessions.length - 1); model = sessions[activeIdx]; return; } } catch (e) {}
    sessions = [fresh()]; activeIdx = 0; model = sessions[activeIdx];
  }
  function persistSessions() { try { if (model) sessions[activeIdx] = model; if (!sessions.length) return; localStorage.setItem(SESS, JSON.stringify({ sessions, activeIdx })); } catch (e) {} }
  function newSession() { persistSessions(); sessions.push(fresh()); activeIdx = sessions.length - 1; model = sessions[activeIdx]; render(); persistSessions(); }
  function switchSession(i) { if (i === activeIdx) return; persistSessions(); activeIdx = i; model = sessions[activeIdx]; render(); }
  function closeSession(i) {
    persistSessions();
    if (sessions.length <= 1) { sessions = [fresh()]; activeIdx = 0; }
    else { sessions.splice(i, 1); activeIdx = Math.min(i, sessions.length - 1); }
    model = sessions[activeIdx]; render(); persistSessions();
  }
  function clearSession() {
    if (!confirm('Clear this invoice and start fresh? (Saved invoice records are not affected.)')) return;
    sessions[activeIdx] = fresh(); model = sessions[activeIdx]; render(); persistSessions();
  }
  function sessLabel(m) { const c = (m.billName || '').trim(); return c ? c.slice(0, 18) : (m.invNo || 'Invoice'); }

  function totals(m) {
    const sub = m.items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
    const disc = Math.round(sub * num(m.discountPct) / 100 * 100) / 100;
    const taxable = sub - disc;
    let cgst = 0, sgst = 0, igst = 0;
    if (m.type === 'state') { cgst = taxable * (m.gstRate / 2) / 100; sgst = cgst; } else { igst = taxable * m.gstRate / 100; }
    const tax = cgst + sgst + igst;
    const grand = Math.round((taxable + tax) * 100) / 100;
    return { sub, disc, taxable, cgst, sgst, igst, tax, grand };
  }
  function inWords(n) {
    n = Math.round(num(n) * 100); const paise = n % 100; n = Math.floor(n / 100);
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const two = (x) => x < 20 ? a[x] : b[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
    const three = (x) => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + (x % 100 ? two(x % 100) : '');
    let s = '', c = Math.floor(n / 1e7); n %= 1e7; const l = Math.floor(n / 1e5); n %= 1e5; const t = Math.floor(n / 1e3); n %= 1e3;
    if (c) s += three(c) + ' Crore '; if (l) s += three(l) + ' Lakh '; if (t) s += three(t) + ' Thousand '; if (n) s += three(n);
    let out = 'Indian Rupee ' + (s.trim() || 'Zero'); if (paise) out += ' and ' + two(paise) + ' Paise'; return out.replace(/\s+/g, ' ') + ' Only';
  }

  function seedCusts() {
    if (localStorage.getItem('fixo_inno_cust_seed') === '1') return;
    if (!loadCusts().length) storeCusts([{ id: 'cust-thrivasol', name: 'THRIVASOL RENEWABLE TECHNOLOGIES PRIVATE LIMITED', gstin: '29AANCT2412M1ZX', stateCode: '29', billAddr: '', shipAddr: '', email: '', phone: '' }]);
    localStorage.setItem('fixo_inno_cust_seed', '1');
  }
  // ---------- builder UI ----------
  function render() {
    const host = document.getElementById('invoice-app'); if (!host) return;
    seedCusts();
    if (!sessions.length) loadSessions();
    model = sessions[activeIdx];
    const taxMode = model.type === 'state' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)';
    const sessTabs = sessions.map((s, i) => `<div class="inv-sess-tab ${i === activeIdx ? 'active' : ''}" data-si="${i}"><span class="inv-sess-no">${esc(s.invNo || ('Invoice ' + (i + 1)))}</span><span class="inv-sess-sub">${esc(sessLabel(s) === (s.invNo || '') ? 'New' : sessLabel(s))}</span>${sessions.length > 1 ? `<span class="inv-sess-close" data-close="${i}" title="Close">×</span>` : ''}</div>`).join('');
    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left">
            <img src="${CO.logo}" onerror="this.style.display='none'" class="inv-header-logo">
            <div class="inv-header-divider"></div>
            <div class="inv-header-titles">
              <div class="inv-h-title">INNO <span class="inv-h-bold">INVOICE GEN</span></div>
              <div class="inv-h-sub">GST Tax Invoicing</div>
            </div>
          </div>
          <div class="inv-header-right">
            <span class="inv-chip ${(STATUS[model.status] || STATUS.draft).cls}">${(STATUS[model.status] || STATUS.draft).label}</span>
            <div class="inv-h-no">${esc(model.invNo)}</div>
            <div class="inv-h-co">${esc(CO.name)} · GSTIN ${esc(CO.gstin)}</div>
          </div>
        </div>
        <div class="inv-sess-bar">
          <div class="inv-sess-tabs" id="inv-sess-tabs">${sessTabs}</div>
          <button class="inv-sess-add" id="inv-sess-add" title="New invoice session">＋</button>
        </div>
        <div class="inv-topbtns">
          <button class="cp-btn small" id="inv-save">💾 Save</button>
          <button class="cp-btn small" id="inv-saved">📋 Invoice records</button>
          <button class="cp-btn small" id="inv-tally">🧮 Tally code</button>
          <button class="cp-btn small inv-clear" id="inv-clear">🗑 Clear</button>
        </div>

        <div class="inv-card">
          <div class="inv-card-h"><span class="inv-step">1</span> Customer</div>
          <div class="inv-cust-pick">
            <div class="inv-cust-box">
              <input id="f-customer" class="inv-in inv-cust-in" placeholder="Select or add a customer…" value="${esc(model.billName)}" autocomplete="off">
              <div class="inv-cust-dd" id="inv-cust-dd" hidden></div>
            </div>
            <button class="cp-btn" id="inv-newcust">＋ New customer</button>
          </div>
          ${model.billName ? `<div class="inv-cust-info">${model.billGst ? '🧾 GSTIN ' + esc(model.billGst) + ' · ' : ''}📍 ${esc(model.placeOfSupply || '—')}${model.billAddr ? '<br>' + esc(model.billAddr) : ''}</div>` : ''}
        </div>

        <div class="inv-two">
          <div class="inv-card"><div class="inv-card-h">Bill To</div>
            <input id="f-bname" class="inv-in" placeholder="Customer name" value="${esc(model.billName)}">
            <input id="f-bgst" class="inv-in" placeholder="GSTIN" value="${esc(model.billGst)}">
            <textarea id="f-baddr" class="inv-in" rows="2" placeholder="Billing address">${esc(model.billAddr)}</textarea>
          </div>
          <div class="inv-card"><div class="inv-card-h">Ship To <label class="inv-same"><input type="checkbox" id="f-same" ${model.sameShip ? 'checked' : ''}> same as Bill To</label></div>
            <input id="f-sname" class="inv-in" placeholder="Ship name" value="${esc(model.shipName)}" ${model.sameShip ? 'disabled' : ''}>
            <input id="f-sgst" class="inv-in" placeholder="GSTIN" value="${esc(model.shipGst)}" ${model.sameShip ? 'disabled' : ''}>
            <textarea id="f-saddr" class="inv-in" rows="2" placeholder="Shipping address" ${model.sameShip ? 'disabled' : ''}>${esc(model.shipAddr)}</textarea>
          </div>
        </div>

        <div class="inv-card">
          <div class="inv-card-h"><span class="inv-step">2</span> Invoice details</div>
          <div class="inv-fields">
            <label>Invoice No<input id="f-no" value="${esc(model.invNo)}"></label>
            <label>Invoice Date<input id="f-date" value="${esc(model.invDate)}"></label>
            <label>Order No (PO)<input id="f-order" value="${esc(model.orderNo || '')}"></label>
            <label>Terms<input id="f-terms" value="${esc(model.terms)}"></label>
            <label>Due Date<input id="f-due" value="${esc(model.dueDate)}"></label>
            <label>E-Way Bill#<input id="f-eway" value="${esc(model.eway)}"></label>
            <label>Salesperson<input id="f-sales" value="${esc(model.salesperson || '')}"></label>
            <label>Place of Supply<select id="f-pos">${STATES.map(s => `<option value="${s[0]}" ${s[0] === model.posCode ? 'selected' : ''}>[${s[0]}] ${s[1]}</option>`).join('')}</select></label>
            <label class="inv-wide2">Subject<input id="f-subject" value="${esc(model.subject || '')}" placeholder="What this invoice is for"></label>
          </div>
          <div class="inv-tax-row">
            <span class="inv-taxmode" id="f-taxmode">🧮 ${taxMode}</span>
            <label class="inv-gst">GST %<input id="f-gst" type="number" value="${model.gstRate}" min="0" step="0.5"></label>
            <label class="inv-gst">Discount %<input id="f-disc" type="number" value="${model.discountPct}" min="0" step="0.5"></label>
          </div>
        </div>

        <div class="inv-card">
          <div class="inv-card-h"><span class="inv-step">3</span> Items <button class="cp-btn small" id="inv-add">+ Add row</button><button class="cp-btn small" id="inv-pick">🔎 Pick product</button></div>
          <datalist id="inv-prods">${PRODUCTS.map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
          <div class="inv-items-wrap"><table class="inv-tbl"><thead><tr><th>#</th><th>Item &amp; Description</th><th>SKU</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="inv-rows"></tbody></table></div>
        </div>

        <div class="inv-bottom">
          <div class="inv-card inv-notes-card">
            <div class="inv-card-h">Notes &amp; Terms</div>
            <label class="inv-lab">Notes</label><input id="f-notes" class="inv-in" value="${esc(model.notes)}">
            <label class="inv-lab">Delivery Charges</label><input id="f-tcd" class="inv-in" value="${esc(model.tcDelivery)}">
            <label class="inv-lab">Payment Method</label><input id="f-tcp" class="inv-in" value="${esc(model.tcPayment)}">
            <label class="inv-lab">Note</label><input id="f-tcn" class="inv-in" value="${esc(model.tcNote)}">
          </div>
          <div class="inv-card inv-tot-card"><div id="inv-totals"></div></div>
        </div>

        <button class="inv-bigbtn" id="inv-verify">🖨 Verify &amp; Print — preview as PDF</button>

        <div class="inv-stage">
          <div class="inv-stage-lab">Save &amp; send</div>
          <div class="inv-stage-btns">
            <button class="cp-btn" id="inv-draft">💾 Save as Draft</button>
            <button class="cp-btn cp-btn-go" id="inv-send">📤 Save &amp; Send to client</button>
            <button class="cp-btn inv-ok" id="inv-appr">✓ Client approved</button>
            <button class="cp-btn inv-no" id="inv-decl">✕ Not approved</button>
          </div>
          <div class="inv-stage-hint" id="inv-stage-hint"></div>
        </div>
      </div>`;

    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = () => { model[key] = el.value; }; };
    ['f-no:invNo', 'f-date:invDate', 'f-order:orderNo', 'f-terms:terms', 'f-due:dueDate', 'f-eway:eway', 'f-sales:salesperson', 'f-subject:subject', 'f-bname:billName', 'f-bgst:billGst', 'f-baddr:billAddr', 'f-sname:shipName', 'f-sgst:shipGst', 'f-saddr:shipAddr', 'f-notes:notes', 'f-tcd:tcDelivery', 'f-tcp:tcPayment', 'f-tcn:tcNote'].forEach(p => { const [id, key] = p.split(':'); bind(id, key); });
    document.getElementById('f-gst').oninput = e => { model.gstRate = num(e.target.value); renderTotals(); };
    document.getElementById('f-disc').oninput = e => { model.discountPct = num(e.target.value); renderTotals(); };
    // Place of Supply drives CGST+SGST (same state as company) vs IGST (inter-state).
    document.getElementById('f-pos').onchange = e => { applyPos(e.target.value); const tm = document.getElementById('f-taxmode'); if (tm) tm.textContent = '🧮 ' + (model.type === 'state' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'); renderTotals(); };
    document.getElementById('f-same').onchange = e => { model.sameShip = e.target.checked; render(); };
    attachCustomerPicker();
    document.getElementById('inv-newcust').onclick = () => newCustomer();
    document.getElementById('inv-sess-add').onclick = () => newSession();
    document.getElementById('inv-sess-tabs').querySelectorAll('.inv-sess-tab').forEach(t => {
      t.onclick = (e) => { if (e.target.dataset.close != null) { closeSession(+e.target.dataset.close); return; } switchSession(+t.dataset.si); };
    });
    document.getElementById('inv-save').onclick = () => saveInvoice();
    document.getElementById('inv-saved').onclick = openSaved;
    document.getElementById('inv-tally').onclick = () => openTally([model], 'Tally code — ' + (model.invNo || 'this invoice'));
    document.getElementById('inv-clear').onclick = () => clearSession();
    document.getElementById('inv-verify').onclick = openEditor;
    document.getElementById('inv-draft').onclick = () => setStatus('draft', true);
    document.getElementById('inv-send').onclick = () => setStatus('sent', true);
    document.getElementById('inv-appr').onclick = () => setStatus('approved');
    document.getElementById('inv-decl').onclick = () => setStatus('declined');
    updateStageHint();
    document.getElementById('inv-add').onclick = () => { model.items.push(blank()); renderRows(); renderTotals(); };
    document.getElementById('inv-pick').onclick = pickProduct;
    renderRows(); renderTotals();
  }

  // Place-of-supply → tax type. Same state as the company (Karnataka 29) ⇒ intra
  // (CGST+SGST); any other state ⇒ inter-state (IGST).
  function applyPos(code) { model.posCode = code; model.placeOfSupply = posLabel(code); model.type = code === CO_STATE ? 'state' : 'inter'; }

  // Customer-first selector (Zoho-style): search saved customers, auto-fill
  // billing/shipping + GSTIN + place of supply; or add a new customer.
  function applyCustomer(c) {
    model.custId = c.id; model.billName = c.name || ''; model.billGst = c.gstin || ''; model.billAddr = c.billAddr || '';
    model.shipName = c.shipName || c.name || ''; model.shipGst = c.gstin || ''; model.shipAddr = c.shipAddr || c.billAddr || '';
    const code = c.stateCode || gstStateCode(c.gstin) || model.posCode; applyPos(code);
    render();
  }
  function attachCustomerPicker() {
    const inp = document.getElementById('f-customer'), dd = document.getElementById('inv-cust-dd'); if (!inp || !dd) return;
    const draw = () => {
      const q = inp.value.trim().toLowerCase();
      const list = loadCusts().filter(c => !q || (c.name || '').toLowerCase().includes(q)).slice(0, 8);
      dd.innerHTML = list.map(c => `<button class="inv-cust-row" data-cid="${c.id}"><b>${esc(c.name)}</b><span>${esc([c.gstin, posLabel(c.stateCode || gstStateCode(c.gstin))].filter(Boolean).join(' · '))}</span></button>`).join('') + `<button class="inv-cust-row inv-cust-new" data-new="1">＋ Add “${esc(inp.value || 'new customer')}”</button>`;
      dd.hidden = false;
      dd.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { const c = loadCusts().find(x => x.id === b.dataset.cid); dd.hidden = true; if (c) applyCustomer(c); });
      dd.querySelector('[data-new]').onclick = () => { dd.hidden = true; newCustomer(inp.value.trim()); };
    };
    inp.onfocus = draw; inp.oninput = () => { model.billName = inp.value; draw(); };
    inp.onblur = () => setTimeout(() => { dd.hidden = true; }, 180);
  }
  function newCustomer(preName) {
    const m = modal(`<h3>＋ New customer</h3>
      <div class="fx-modal-body inv-form">
        <label class="inv-lab">Customer name *</label><input class="inv-in" id="nc-name" value="${esc(preName || '')}">
        <div class="inv-two2"><div><label class="inv-lab">GSTIN</label><input class="inv-in" id="nc-gst" placeholder="29AABC..."></div>
          <div><label class="inv-lab">State (Place of Supply)</label><select class="inv-in" id="nc-state">${STATES.map(s => `<option value="${s[0]}" ${s[0] === CO_STATE ? 'selected' : ''}>[${s[0]}] ${s[1]}</option>`).join('')}</select></div></div>
        <label class="inv-lab">Billing address</label><textarea class="inv-in" id="nc-baddr" rows="2"></textarea>
        <label class="inv-lab">Shipping address (optional)</label><textarea class="inv-in" id="nc-saddr" rows="2"></textarea>
        <div class="inv-two2"><div><label class="inv-lab">Email</label><input class="inv-in" id="nc-email"></div><div><label class="inv-lab">Phone</label><input class="inv-in" id="nc-phone"></div></div>
      </div>
      <div class="inv-modal-act"><button class="cp-btn" data-x>Cancel</button><button class="cp-btn cp-btn-go" data-ok>Save &amp; select</button></div>`);
    const g = (id) => m.querySelector('#' + id);
    g('nc-gst').oninput = () => { const code = gstStateCode(g('nc-gst').value); if (code) g('nc-state').value = code; };
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-ok]').onclick = () => {
      const name = g('nc-name').value.trim(); if (!name) { toast('Enter a name'); return; }
      const c = { id: uid('cust-'), name, gstin: g('nc-gst').value.trim().toUpperCase(), stateCode: g('nc-state').value, billAddr: g('nc-baddr').value.trim(), shipAddr: g('nc-saddr').value.trim(), email: g('nc-email').value.trim(), phone: g('nc-phone').value.trim() };
      const list = loadCusts().filter(x => x.name.toLowerCase() !== name.toLowerCase()); list.unshift(c); storeCusts(list);
      m.remove(); applyCustomer(c); toast('Customer saved');
    };
  }

  function rowHtml(it, i) {
    const amt = num(it.qty) * num(it.rate);
    return `<tr data-i="${i}">
      <td class="c">${i + 1}</td>
      <td><input class="r-desc" list="inv-prods" value="${esc(it.desc)}" placeholder="Item name"></td>
      <td><input class="r-sku" value="${esc(it.sku)}" placeholder="SKU"></td>
      <td><input class="r-hsn" value="${esc(it.hsn)}" placeholder="HSN"></td>
      <td><input class="r-qty" value="${esc(it.qty)}"></td>
      <td><input class="r-unit" value="${esc(it.unit || 'NOS')}"></td>
      <td><input class="r-rate" value="${esc(it.rate)}"></td>
      <td class="c r-amt">₹${money(amt)}</td>
      <td><button class="r-del" title="Remove">×</button></td></tr>`;
  }
  function renderRows() {
    const tb = document.getElementById('inv-rows'); if (!tb) return;
    tb.innerHTML = model.items.map(rowHtml).join('');
    tb.querySelectorAll('tr').forEach(tr => {
      const i = +tr.dataset.i;
      const sync = () => { const it = model.items[i]; if (!it) return; it.desc = tr.querySelector('.r-desc').value; it.sku = tr.querySelector('.r-sku').value; it.hsn = tr.querySelector('.r-hsn').value; it.qty = tr.querySelector('.r-qty').value; it.unit = tr.querySelector('.r-unit').value; it.rate = tr.querySelector('.r-rate').value; tr.querySelector('.r-amt').textContent = '₹' + money(num(it.qty) * num(it.rate)); renderTotals(); };
      tr.querySelectorAll('input').forEach(inp => inp.oninput = sync);
      // auto-fill HSN/rate/unit when a known product name is chosen
      tr.querySelector('.r-desc').addEventListener('change', () => { const p = PRODUCTS.find(x => x.name.toLowerCase() === model.items[i].desc.toLowerCase()); if (p) { model.items[i].hsn = p.hsn; model.items[i].unit = p.unit; if (!num(model.items[i].rate)) model.items[i].rate = p.rate; renderRows(); renderTotals(); } });
      tr.querySelector('.r-del').onclick = () => { model.items.splice(i, 1); if (!model.items.length) model.items.push(blank()); renderRows(); renderTotals(); };
    });
  }
  function renderTotals() {
    const el = document.getElementById('inv-totals'); if (!el) return;
    const t = totals(model);
    const half = model.gstRate / 2;
    const taxRows = model.type === 'state'
      ? `<div class="inv-tr"><span>CGST (${half}%)</span><b>₹${money(t.cgst)}</b></div><div class="inv-tr"><span>SGST (${half}%)</span><b>₹${money(t.sgst)}</b></div>`
      : `<div class="inv-tr"><span>IGST (${model.gstRate}%)</span><b>₹${money(t.igst)}</b></div>`;
    el.innerHTML = `<div class="inv-tr"><span>Sub Total</span><b>₹${money(t.sub)}</b></div>
      ${t.disc ? `<div class="inv-tr"><span>Discount (${model.discountPct}%)</span><b>(-) ₹${money(t.disc)}</b></div>` : ''}
      ${taxRows}
      <div class="inv-tr inv-grand"><span>Total</span><b>₹${money(t.grand)}</b></div>
      <div class="inv-words">${esc(inWords(t.grand))}</div>`;
  }

  function pickProduct() {
    const m = modal(`<h3>Pick a product</h3><input class="inv-in" id="pp-s" placeholder="Search…" style="margin-bottom:8px"><div class="inv-pick-list" id="pp-list"></div><div class="inv-modal-act"><button class="cp-btn" data-x>Close</button></div>`);
    const draw = (q) => { const list = PRODUCTS.filter(p => !q || p.name.toLowerCase().includes(q.toLowerCase())); m.querySelector('#pp-list').innerHTML = list.map(p => `<button class="inv-pick-row" data-p="${esc(p.name)}"><b>${esc(p.name)}</b><span>HSN ${esc(p.hsn)} · ${esc(p.unit)} · ₹${p.rate}</span></button>`).join(''); m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { const p = PRODUCTS.find(x => x.name === b.dataset.p); const empty = model.items.find(it => !it.desc); const it = empty || (model.items.push(blank()), model.items[model.items.length - 1]); it.desc = p.name; it.hsn = p.hsn; it.unit = p.unit; it.rate = p.rate; it.qty = it.qty || 1; m.remove(); renderRows(); renderTotals(); }); };
    draw(''); m.querySelector('#pp-s').oninput = e => draw(e.target.value); m.querySelector('[data-x]').onclick = () => m.remove();
  }

  // ---------- save / reopen / status ----------
  function saveInvoice(silent) {
    if (!model.items.some(it => (it.desc || '').trim())) { if (!silent) toast('Add at least one item'); return false; }
    const list = loadSaved().filter(r => r.id !== model.id);
    list.unshift({ id: model.id, invNo: model.invNo, customer: model.billName, savedAt: new Date().toLocaleString('en-IN'), total: totals(model).grand, status: model.status || 'draft', model: JSON.parse(JSON.stringify(model)) });
    storeSaved(list);
    if (!silent) toast('Invoice saved');
    return true;
  }
  function setStatus(st) {
    if (!model.items.some(it => (it.desc || '').trim())) { toast('Add items first'); return; }
    if (st === 'sent' && !model.sentAt) model.sentAt = new Date().toLocaleString('en-IN');
    if (st === 'approved') model.approvedAt = new Date().toLocaleString('en-IN');
    model.status = st;
    saveInvoice(true);   // auto-save so the record keeps the stage
    render();
    toast('Marked ' + (STATUS[st] || {}).label);
  }
  function updateStageHint() {
    const el = document.getElementById('inv-stage-hint'); if (!el) return;
    const map = { draft: 'Created — save it, preview the approval draft, then mark it sent to the client.', sent: 'Sent to the client' + (model.sentAt ? ' on ' + esc(model.sentAt) : '') + ' — awaiting their approval.', approved: '✓ Client approved' + (model.approvedAt ? ' on ' + esc(model.approvedAt) : '') + '.', declined: '✕ Client has not approved this invoice.' };
    el.innerHTML = map[model.status] || map.draft;
  }
  let recFilter = 'all';
  function openSaved() {
    const m = modal(`<h3>Invoice records</h3>
      <div class="inv-rec-bar" id="inv-rec-bar"></div>
      <div class="inv-rec-tally"><button class="cp-btn small" id="inv-rec-tally-all">🧮 Export all to Tally</button><button class="cp-btn small" id="inv-rec-tally-view">🧮 Tally — this view</button></div>
      <div class="modal-body" id="inv-rec-list"></div>
      <div class="inv-modal-act"><button class="cp-btn" data-x>Close</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    const isDone = (r) => (r.status || 'draft') !== 'draft';
    const viewList = () => { let list = loadSaved(); if (recFilter === 'draft') list = list.filter(r => !isDone(r)); else if (recFilter === 'completed') list = list.filter(r => isDone(r)); return list; };
    m.querySelector('#inv-rec-tally-all').onclick = () => { const all = loadSaved(); if (!all.length) return toast('No invoices to export'); openTally(all.map(r => r.model), 'Tally code — all invoices (' + all.length + ')'); };
    m.querySelector('#inv-rec-tally-view').onclick = () => { const list = viewList(); if (!list.length) return toast('Nothing in this view'); openTally(list.map(r => r.model), 'Tally code — ' + recFilter + ' (' + list.length + ')'); };
    const drawBar = () => {
      const all = loadSaved();
      const count = (k) => k === 'all' ? all.length : k === 'draft' ? all.filter(r => !isDone(r)).length : all.filter(r => isDone(r)).length;
      const f = (k, lbl) => `<button class="inv-rec-f ${recFilter === k ? 'active' : ''}" data-f="${k}">${lbl} <em>${count(k)}</em></button>`;
      m.querySelector('#inv-rec-bar').innerHTML = f('draft', '📝 Drafts') + f('completed', '✓ Completed') + f('all', 'All');
      m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { recFilter = b.dataset.f; drawBar(); drawList(); });
    };
    const drawList = () => {
      const list = viewList();
      const el = m.querySelector('#inv-rec-list');
      el.innerHTML = list.length ? list.map(r => { const st = STATUS[r.status || 'draft'] || STATUS.draft; return `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${esc(r.customer || 'Invoice')}</b> <span class="inv-chip ${st.cls}">${st.label}</span><span class="inv-rec-sub">${esc(r.invNo)} · ${esc(r.savedAt)} · ₹${money(r.total)}</span></div>
        <div class="inv-rec-act">
          <button class="cp-btn so-open" data-id="${r.id}">Open</button>
          <button class="cp-btn" data-tally="${r.id}" title="Tally code">🧮</button>
          <button class="cp-btn" data-sent="${r.id}" title="Mark sent">📤</button>
          <button class="cp-btn inv-ok" data-appr="${r.id}" title="Approved">✓</button>
          <button class="cp-btn inv-no" data-decl="${r.id}" title="Not approved">✕</button>
          <button class="so-del" data-id="${r.id}">×</button>
        </div></div>`; }).join('') : '<div class="so-empty">No invoices in this view.</div>';
      el.querySelectorAll('.so-open').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.id); if (r) { sessions[activeIdx] = JSON.parse(JSON.stringify(r.model)); model = sessions[activeIdx]; persistSessions(); m.remove(); render(); toast('Reopened ' + (r.customer || '')); } });
      el.querySelectorAll('[data-tally]').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.tally); if (r) openTally([r.model], 'Tally code — ' + (r.invNo || '')); });
      el.querySelectorAll('.so-del').forEach(b => b.onclick = () => { storeSaved(loadSaved().filter(x => x.id !== b.dataset.id)); drawBar(); drawList(); });
      const setRec = (id, st) => { const all = loadSaved(); const r = all.find(x => x.id === id); if (r) { r.status = st; if (r.model) { r.model.status = st; if (st === 'sent' && !r.model.sentAt) r.model.sentAt = new Date().toLocaleString('en-IN'); if (st === 'approved') r.model.approvedAt = new Date().toLocaleString('en-IN'); } storeSaved(all); if (model && model.id === id) { model.status = st; } drawBar(); drawList(); toast('Marked ' + (STATUS[st] || {}).label); } };
      el.querySelectorAll('[data-sent]').forEach(b => b.onclick = () => setRec(b.dataset.sent, 'sent'));
      el.querySelectorAll('[data-appr]').forEach(b => b.onclick = () => setRec(b.dataset.appr, 'approved'));
      el.querySelectorAll('[data-decl]').forEach(b => b.onclick = () => setRec(b.dataset.decl, 'declined'));
    };
    drawBar(); drawList();
  }

  // ---------- PDF (editable) ----------
  function invoiceHtml(m, editable, isDraft) {
    const t = totals(m);
    const ship = m.sameShip ? { name: m.billName, gst: m.billGst, addr: m.billAddr } : { name: m.shipName, gst: m.shipGst, addr: m.shipAddr };
    const half = m.gstRate / 2;
    const taxHead = m.type === 'state' ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>';
    const rows = m.items.filter(it => (it.desc || '').trim()).map((it, i) => {
      const amt = num(it.qty) * num(it.rate); const afterDisc = amt - amt * num(m.discountPct) / 100;
      const taxCell = m.type === 'state'
        ? `<td class="r">${half}%<br>${money(afterDisc * half / 100)}</td><td class="r">${half}%<br>${money(afterDisc * half / 100)}</td>`
        : `<td class="r">${m.gstRate}%<br>${money(afterDisc * m.gstRate / 100)}</td>`;
      return `<tr><td class="c">${i + 1}</td><td>${esc(it.desc)}${it.sku ? `<div class="sku">SKU : ${esc(it.sku)}</div>` : ''}</td><td class="c">${esc(it.hsn)}</td><td class="c">${esc(it.qty)} ${esc(it.unit || '')}</td><td class="r">${money(it.rate)}</td>${taxCell}<td class="r b">${money(amt)}</td></tr>`;
    }).join('');
    const taxTot = m.type === 'state'
      ? `<tr><td>CGST${half} (${half}%)</td><td class="r">${money(t.cgst)}</td></tr><tr><td>SGST${half} (${half}%)</td><td class="r">${money(t.sgst)}</td></tr>`
      : `<tr><td>IGST (${m.gstRate}%)</td><td class="r">${money(t.igst)}</td></tr>`;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Tax Invoice ${esc(m.invNo)}</title><style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:11px;margin:0;padding:8mm}
.doc{border:1px solid #333}.top{display:flex;justify-content:space-between;padding:10px 12px;border-bottom:1px solid #333}
.co b{font-size:15px}.co div{font-size:10px;color:#333;max-width:320px}.ti{text-align:right}.ti h1{margin:0;font-size:22px;letter-spacing:1px;color:#1e3a8a}
.meta{display:flex;flex-wrap:wrap;gap:2px 20px;padding:8px 12px;border-bottom:1px solid #333;font-size:10.5px}
.meta div span{color:#555}.party{display:flex;border-bottom:1px solid #333}.party>div{flex:1;padding:8px 12px}.party>div+div{border-left:1px solid #333}
.party b{font-size:11px}.party .lab{color:#555;font-size:9.5px;text-transform:uppercase}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:4px 6px}th{background:#eef;font-size:9.5px}.c{text-align:center}.r{text-align:right}.b{font-weight:bold}
.sku{font-size:9px;color:#555}.tot{display:flex;justify-content:flex-end;padding:8px 12px}.tot table{width:300px}
.tot td{border:none;padding:3px 6px}.tot .g td{border-top:1px solid #333;font-weight:bold;font-size:13px;color:#1e3a8a}
.words{padding:6px 12px;font-style:italic;border-top:1px solid #333}.foot{display:flex;justify-content:space-between;padding:10px 12px;border-top:1px solid #333}
.tc{font-size:9.5px;color:#333}.sign{text-align:right}.sign b{font-size:11px}
.wm{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:68px;font-weight:900;color:rgba(220,0,0,.12);letter-spacing:4px;pointer-events:none;z-index:5;white-space:nowrap}
${editable ? '.layer[contenteditable] td:hover,.layer[contenteditable] [contenteditable]:hover{background:rgba(59,130,246,.06)}' : ''}
</style></head><body><div class="doc">${isDraft ? '<div class="wm">DRAFT — FOR APPROVAL</div>' : ''}<div class="layer"${editable ? ' contenteditable="true" spellcheck="false"' : ''}>
  <div class="top"><div class="co"><img src="${CO.logo}" style="height:34px" onerror="this.style.display='none'"><br><b>${esc(CO.name)}</b><div>${esc(CO.address)}</div><div>GSTIN ${esc(CO.gstin)}</div></div>
    <div class="ti"><h1>${isDraft ? 'APPROVAL COPY' : 'TAX INVOICE'}</h1>${isDraft ? '<div style="font-size:10px;color:#b00;font-weight:bold">DRAFT — not a valid tax invoice</div>' : ''}</div></div>
  <div class="meta">
    <div><span>Invoice No :</span> <b>${esc(m.invNo)}</b></div><div><span>Invoice Date :</span> ${esc(m.invDate)}</div>
    <div><span>Terms :</span> ${esc(m.terms)}</div><div><span>Due Date :</span> ${esc(m.dueDate)}</div>
    <div><span>E-Way Bill# :</span> ${esc(m.eway)}</div><div><span>Place Of Supply :</span> ${esc(m.placeOfSupply)}</div></div>
  <div class="party"><div><div class="lab">Bill To</div><b>${esc(m.billName)}</b><div>${esc(m.billAddr)}</div>${m.billGst ? `<div>GSTIN ${esc(m.billGst)}</div>` : ''}</div>
    <div><div class="lab">Ship To</div><b>${esc(ship.name)}</b><div>${esc(ship.addr)}</div>${ship.gst ? `<div>GSTIN ${esc(ship.gst)}</div>` : ''}</div></div>
  <table class="items pi-irows"><thead><tr><th>#</th><th>Item &amp; Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th>${taxHead}<th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><table>
    <tr><td>Sub Total</td><td class="r">${money(t.sub)}</td></tr>
    ${t.disc ? `<tr><td>Discount (${m.discountPct}%)</td><td class="r">(-) ${money(t.disc)}</td></tr>` : ''}
    ${taxTot}<tr class="g"><td>Total</td><td class="r">₹${money(t.grand)}</td></tr></table></div>
  <div class="words"><b>Total In Words :</b> ${esc(inWords(t.grand))}</div>
  <div class="foot"><div class="tc"><b>Notes:</b> ${esc(m.notes)}<br><b>Terms &amp; Conditions</b><br>Delivery Charges : ${esc(m.tcDelivery)}<br>Payment Method : ${esc(m.tcPayment)}<br>Note : ${esc(m.tcNote)}</div>
    <div class="sign"><b>${esc(CO.name)}</b><br><br><br>Authorized Signature</div></div>
</div></div></body></html>`;
  }
  function openEditor() {
    if (!model.items.some(it => (it.desc || '').trim())) { toast('Add at least one item'); return; }
    let draftView = false;
    const m = modal(`<div class="inv-ed-head"><h3>Verify &amp; Edit — ${esc(model.invNo)}</h3>
        <div class="inv-ed-seg"><button class="inv-ed-tab active" data-view="final">🧾 Final invoice</button><button class="inv-ed-tab" data-view="draft">📄 Approval draft</button></div>
        <span class="inv-ed-hint">✎ Click any cell to edit — changes are saved.</span><button class="cp-btn" data-x>Close</button></div>
      <iframe id="inv-frame" class="inv-frame"></iframe>
      <div class="inv-modal-act"><button class="cp-btn btn-save-edit" data-save>💾 Save changes</button><button class="cp-btn cp-btn-go" data-print>🖨 Print / Save PDF</button></div>`, 'big');
    const fr = m.querySelector('#inv-frame');
    const draw = () => { const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(invoiceHtml(model, true, draftView)); d.close(); };
    draw();
    const commit = () => {
      try {
        const d = fr.contentDocument || fr.contentWindow.document;
        const grab = (el) => (el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/ /g, ' ').trim();
        const rows = [...d.querySelectorAll('table.items tbody tr')];
        if (rows.length) model.items = rows.map(tr => { const td = tr.querySelectorAll('td'); const q = grab(td[3]); const qty = num(q); const unit = q.replace(/[0-9.,\s]/g, '') || 'NOS'; return { desc: (td[1].innerText || '').split('\n')[0].trim(), sku: (grab(td[1]).match(/SKU\s*:\s*(\S+)/) || [, ''])[1], hsn: grab(td[2]), qty: qty, unit: unit, rate: num(grab(td[4])) }; }).filter(it => it.desc);
        // persist edits everywhere: live model + the saved record (if this invoice was saved)
        if (loadSaved().some(r => r.id === model.id)) saveInvoice(true);
        render();
      } catch (e) {}
    };
    m.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { commit(); draftView = b.dataset.view === 'draft'; m.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b)); draw(); });
    m.querySelector('[data-x]').onclick = () => { commit(); m.remove(); };
    m.querySelector('[data-save]').onclick = () => { commit(); toast('Changes saved'); };
    m.querySelector('[data-print]').onclick = () => { commit(); draw(); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }

  // ---------- Tally export (copy/paste XML — no live connection) ----------
  // Generates standard Tally "Import Data" Sales vouchers. The user pastes the
  // XML into Tally (Gateway → Import Data → Vouchers) or saves the .xml file and
  // imports it. Accounting voucher: Party Dr, Sales Cr (taxable), GST ledgers Cr.
  function tallyDate(d) { const m = String(d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) { const t = new Date(); return t.getFullYear() + String(t.getMonth() + 1).padStart(2, '0') + String(t.getDate()).padStart(2, '0'); } let y = m[3]; if (y.length === 2) y = '20' + y; return y + m[2].padStart(2, '0') + m[1].padStart(2, '0'); }
  function xesc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ledgerEntry(name, deemedPos, amount) { return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xesc(name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${deemedPos ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`; }
  function tallyVoucher(mo) {
    const t = totals(mo); const party = mo.billName || 'Cash'; const dt = tallyDate(mo.invDate);
    const narr = mo.items.filter(i => (i.desc || '').trim()).map(i => `${num(i.qty)} ${i.unit || ''} ${i.desc} @ ${money(i.rate)}`).join('; ');
    let tax = '';
    if (mo.type === 'state') { tax = ledgerEntry('Output CGST', false, t.cgst) + ledgerEntry('Output SGST', false, t.sgst); }
    else { tax = ledgerEntry('Output IGST', false, t.igst); }
    const round = +(t.grand - (t.taxable + t.cgst + t.sgst + t.igst)).toFixed(2);
    // Balance the voucher: party Dr = grand; Sales + taxes + round-off = grand.
    const roundEntry = round ? ledgerEntry('Round Off', round < 0, round) : '';
    return `  <TALLYMESSAGE xmlns:UDF="TallyUDF">
   <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
    <DATE>${dt}</DATE>
    <EFFECTIVEDATE>${dt}</EFFECTIVEDATE>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${xesc(mo.invNo)}</VOUCHERNUMBER>
    <PARTYLEDGERNAME>${xesc(party)}</PARTYLEDGERNAME>
    <PARTYNAME>${xesc(party)}</PARTYNAME>
    ${mo.orderNo ? `<REFERENCE>${xesc(mo.orderNo)}</REFERENCE>` : ''}
    <PLACEOFSUPPLY>${xesc(stateName(mo.posCode))}</PLACEOFSUPPLY>
    ${mo.billGst ? `<PARTYGSTIN>${xesc(mo.billGst)}</PARTYGSTIN>` : ''}
    <NARRATION>${xesc(narr)}</NARRATION>
${ledgerEntry(party, true, -t.grand)}
${ledgerEntry('Sales', false, t.taxable)}
${tax}${roundEntry ? '\n' + roundEntry : ''}
   </VOUCHER>
  </TALLYMESSAGE>`;
  }
  function tallyEnvelope(models) {
    const vouchers = models.filter(Boolean).map(tallyVoucher).join('\n');
    return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xesc(CO.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
   <REQUESTDATA>
${vouchers}
   </REQUESTDATA>
  </IMPORTDATA>
 </BODY>
</ENVELOPE>`;
  }
  function openTally(models, title) {
    const xml = tallyEnvelope(models);
    const m = modal(`<h3>${xesc(title || 'Tally code')}</h3>
      <p class="inv-tally-note">Copy this and paste into Tally (Gateway of Tally → Import Data → Vouchers), or download the .xml and import it. Ledgers used: the customer name, <b>Sales</b>, <b>Output CGST/SGST/IGST</b> — create them once in Tally if they don't exist.</p>
      <textarea class="inv-tally-box" id="inv-tally-xml" readonly spellcheck="false">${xesc(xml)}</textarea>
      <div class="inv-modal-act">
        <button class="cp-btn cp-btn-go" id="inv-tally-copy">📋 Copy</button>
        <button class="cp-btn" id="inv-tally-dl">⬇ Download .xml</button>
        <button class="cp-btn" data-x>Close</button>
      </div>`, 'inv-modal-wide');
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('#inv-tally-copy').onclick = () => { const ta = m.querySelector('#inv-tally-xml'); ta.select(); try { navigator.clipboard.writeText(xml); } catch (e) { document.execCommand('copy'); } toast('Tally code copied'); };
    m.querySelector('#inv-tally-dl').onclick = () => { const blob = new Blob([xml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tally-' + (models.length === 1 ? (models[0].invNo || 'invoice') : 'invoices') + '.xml'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Downloaded'); };
  }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'inv-overlay'; el.innerHTML = `<div class="inv-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  // Keep the working sessions alive across reloads/accidental refresh — they only
  // clear when the user clicks Clear. Autosave every 1.5s + on page unload.
  loadSessions();
  setInterval(() => { if (sessions.length) persistSessions(); }, 1500);
  window.addEventListener('beforeunload', () => { if (sessions.length) persistSessions(); });

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-invoice"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-invoice') render();
  });
  window.FIXO_INVOICE = { render };
})();
