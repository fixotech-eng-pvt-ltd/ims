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
    logo: 'assets/brand/inno-logo.png'
  };
  const SAVED = 'fixo_inno_invoices', SEQ = 'fixo_inno_inv_seq';
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
      id: uid('inv-'), invNo: nextInvNo(), invDate: today(), terms: 'Due on Receipt', dueDate: today(), eway: '',
      placeOfSupply: 'Karnataka (29)', type: 'state', gstRate: 18,
      billName: '', billGst: '', billAddr: '', sameShip: true, shipName: '', shipGst: '', shipAddr: '',
      items: [blank()], discountPct: 0,
      notes: 'Looking forward for your business.',
      tcDelivery: 'Packing & Delivery charges extra at actuals.',
      tcPayment: '50% Advance and the rest before dispatch.',
      tcNote: 'Prices are subject to change depends upon the changes in the material rates.'
    };
  }
  const blank = () => ({ desc: '', sku: '', hsn: '', qty: '', unit: 'NOS', rate: '' });

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

  // ---------- builder UI ----------
  function render() {
    const host = document.getElementById('invoice-app'); if (!host) return;
    if (!model) model = fresh();
    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-head">
          <div class="inv-head-l"><img src="${CO.logo}" onerror="this.style.display='none'" class="inv-logo"><div><h2>Tax Invoice</h2><p class="inv-sub">${esc(CO.name)} · GSTIN ${esc(CO.gstin)}</p></div></div>
        </div>
        <div class="inv-topbtns">
          <button class="cp-btn small" id="inv-new">＋ New invoice</button>
          <button class="cp-btn small" id="inv-save">💾 Save invoice</button>
          <button class="cp-btn small" id="inv-saved">📂 Saved invoices</button>
          <button class="cp-btn small" id="inv-print">🖨 Verify &amp; Print</button>
        </div>

        <div class="inv-card">
          <div class="inv-fields">
            <label>Invoice No<input id="f-no" value="${esc(model.invNo)}"></label>
            <label>Invoice Date<input id="f-date" value="${esc(model.invDate)}"></label>
            <label>Terms<input id="f-terms" value="${esc(model.terms)}"></label>
            <label>Due Date<input id="f-due" value="${esc(model.dueDate)}"></label>
            <label>E-Way Bill#<input id="f-eway" value="${esc(model.eway)}"></label>
            <label>Place of Supply<input id="f-pos" value="${esc(model.placeOfSupply)}"></label>
          </div>
          <div class="inv-tax-row">
            <div class="inv-seg"><button class="inv-segb ${model.type === 'state' ? 'active' : ''}" data-type="state">State (CGST+SGST)</button><button class="inv-segb ${model.type === 'inter' ? 'active' : ''}" data-type="inter">Inter-state (IGST)</button></div>
            <label class="inv-gst">GST %<input id="f-gst" type="number" value="${model.gstRate}" min="0" step="0.5"></label>
            <label class="inv-gst">Discount %<input id="f-disc" type="number" value="${model.discountPct}" min="0" step="0.5"></label>
          </div>
        </div>

        <div class="inv-two">
          <div class="inv-card"><div class="inv-card-h">Bill To</div>
            <input id="f-bname" class="inv-in" placeholder="Customer name" value="${esc(model.billName)}">
            <input id="f-bgst" class="inv-in" placeholder="GSTIN" value="${esc(model.billGst)}">
            <textarea id="f-baddr" class="inv-in" rows="2" placeholder="Billing address">${esc(model.billAddr)}</textarea>
            <datalist id="inv-custs">${[...new Set(loadSaved().map(r => r.model && r.model.billName).filter(Boolean))].map(n => `<option value="${esc(n)}">`).join('')}</datalist>
          </div>
          <div class="inv-card"><div class="inv-card-h">Ship To <label class="inv-same"><input type="checkbox" id="f-same" ${model.sameShip ? 'checked' : ''}> same as Bill To</label></div>
            <input id="f-sname" class="inv-in" placeholder="Ship name" value="${esc(model.shipName)}" ${model.sameShip ? 'disabled' : ''}>
            <input id="f-sgst" class="inv-in" placeholder="GSTIN" value="${esc(model.shipGst)}" ${model.sameShip ? 'disabled' : ''}>
            <textarea id="f-saddr" class="inv-in" rows="2" placeholder="Shipping address" ${model.sameShip ? 'disabled' : ''}>${esc(model.shipAddr)}</textarea>
          </div>
        </div>

        <div class="inv-card">
          <div class="inv-card-h">Items <button class="cp-btn small" id="inv-add">+ Add row</button><button class="cp-btn small" id="inv-pick">🔎 Pick product</button></div>
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
      </div>`;

    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = () => { model[key] = el.value; if (['f-gst', 'f-disc'].includes(id)) renderTotals(); }; };
    ['f-no:invNo', 'f-date:invDate', 'f-terms:terms', 'f-due:dueDate', 'f-eway:eway', 'f-pos:placeOfSupply', 'f-bname:billName', 'f-bgst:billGst', 'f-baddr:billAddr', 'f-sname:shipName', 'f-sgst:shipGst', 'f-saddr:shipAddr', 'f-notes:notes', 'f-tcd:tcDelivery', 'f-tcp:tcPayment', 'f-tcn:tcNote'].forEach(p => { const [id, key] = p.split(':'); bind(id, key); });
    document.getElementById('f-gst').oninput = e => { model.gstRate = num(e.target.value); renderTotals(); };
    document.getElementById('f-disc').oninput = e => { model.discountPct = num(e.target.value); renderTotals(); };
    document.getElementById('f-bname').setAttribute('list', 'inv-custs');
    document.getElementById('f-bname').addEventListener('change', () => { const r = loadSaved().find(x => x.model && x.model.billName === model.billName); if (r && r.model) { model.billGst = r.model.billGst || ''; model.billAddr = r.model.billAddr || ''; document.getElementById('f-bgst').value = model.billGst; document.getElementById('f-baddr').value = model.billAddr; } });
    document.getElementById('f-same').onchange = e => { model.sameShip = e.target.checked; render(); };
    host.querySelectorAll('[data-type]').forEach(b => b.onclick = () => { model.type = b.dataset.type; render(); });
    document.getElementById('inv-new').onclick = () => { model = fresh(); render(); };
    document.getElementById('inv-save').onclick = saveInvoice;
    document.getElementById('inv-saved').onclick = openSaved;
    document.getElementById('inv-print').onclick = openEditor;
    document.getElementById('inv-add').onclick = () => { model.items.push(blank()); renderRows(); renderTotals(); };
    document.getElementById('inv-pick').onclick = pickProduct;
    renderRows(); renderTotals();
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

  // ---------- save / reopen ----------
  function saveInvoice() {
    if (!model.items.some(it => (it.desc || '').trim())) { toast('Add at least one item'); return; }
    const list = loadSaved().filter(r => r.id !== model.id);
    list.unshift({ id: model.id, invNo: model.invNo, customer: model.billName, savedAt: new Date().toLocaleString('en-IN'), total: totals(model).grand, model: JSON.parse(JSON.stringify(model)) });
    storeSaved(list);
    toast('Invoice saved');
  }
  function openSaved() {
    const list = loadSaved();
    const rows = list.length ? list.map(r => `<div class="so-row"><div class="so-info"><b>${esc(r.customer || 'Invoice')}</b><span>${esc(r.invNo)} · ${esc(r.savedAt)} · ₹${money(r.total)}</span></div><div class="so-btns"><button class="cp-btn so-open" data-id="${r.id}">Reopen</button><button class="so-del" data-id="${r.id}">×</button></div></div>`).join('') : '<div class="so-empty">No saved invoices yet.</div>';
    const m = modal(`<h3>Saved invoices</h3><div class="modal-body">${rows}</div><div class="inv-modal-act"><button class="cp-btn" data-x>Close</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelectorAll('.so-open').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.id); if (r) { model = JSON.parse(JSON.stringify(r.model)); m.remove(); render(); toast('Reopened ' + (r.customer || '')); } });
    m.querySelectorAll('.so-del').forEach(b => b.onclick = () => { storeSaved(loadSaved().filter(x => x.id !== b.dataset.id)); m.remove(); openSaved(); });
  }

  // ---------- PDF (editable) ----------
  function invoiceHtml(m, editable) {
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
${editable ? '.layer[contenteditable] td:hover,.layer[contenteditable] [contenteditable]:hover{background:rgba(59,130,246,.06)}' : ''}
</style></head><body><div class="doc"><div class="layer"${editable ? ' contenteditable="true" spellcheck="false"' : ''}>
  <div class="top"><div class="co"><img src="${CO.logo}" style="height:30px" onerror="this.style.display='none'"><br><b>${esc(CO.name)}</b><div>${esc(CO.address)}</div><div>GSTIN ${esc(CO.gstin)}</div></div>
    <div class="ti"><h1>TAX INVOICE</h1></div></div>
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
    const m = modal(`<div class="inv-ed-head"><h3>Verify &amp; Edit — Tax Invoice</h3><span class="inv-ed-hint">✎ Click any cell to edit.</span><button class="cp-btn" data-x>Close</button></div>
      <iframe id="inv-frame" class="inv-frame"></iframe>
      <div class="inv-modal-act"><button class="cp-btn btn-save-edit" data-save>💾 Save changes</button><button class="cp-btn cp-btn-go" data-print>🖨 Save &amp; Print</button></div>`, 'big');
    const fr = m.querySelector('#inv-frame'); const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(invoiceHtml(model, true)); d.close();
    const commit = () => {
      try {
        const grab = (el) => (el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/ /g, ' ').trim();
        const rows = [...d.querySelectorAll('table.items tbody tr')];
        if (rows.length) model.items = rows.map(tr => { const td = tr.querySelectorAll('td'); const q = grab(td[3]); const qty = num(q); const unit = q.replace(/[0-9.,\s]/g, '') || 'NOS'; return { desc: (td[1].innerText || '').split('\n')[0].trim(), sku: (grab(td[1]).match(/SKU\s*:\s*(\S+)/) || [, ''])[1], hsn: grab(td[2]), qty: qty, unit: unit, rate: num(grab(td[4])) }; }).filter(it => it.desc);
        render();
      } catch (e) {}
    };
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-save]').onclick = () => { commit(); toast('Saved'); };
    m.querySelector('[data-print]').onclick = () => { commit(); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'inv-overlay'; el.innerHTML = `<div class="inv-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-invoice"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-invoice') render();
  });
  window.FIXO_INVOICE = { render };
})();
