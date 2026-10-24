// ============================================================
// Fixotech Inno Structures LLP — shared DOCUMENT engine
// One engine powers three apps that share customers, an inventory/items master,
// financial-year numbering, the stamp and the WYSIWYG PDF editor:
//   • Inno Smart Quotation Calculator  (QT)  FIS26/27-QT001
//   • Inno Sales OQ (Sales Order)      (SO)  FIS26/27-SO001
//   • Inno Invoice Gen (Tax Invoice)   (INV) FIS26/27-001
// Flow: Quotation → Sales Order → Invoice (one-click convert, links kept).
// window.FIXO_DOC.make(cfg) returns a self-contained app ({render,loadDoc,...}).
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const uid = (p) => (p || 'doc') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');

  const CO = {
    name: 'FIXOTECH INNO STRUCTURES LLP',
    address: 'NO 4, J.P.R Building, Lakshmipura Main Road, Bangalore, Karnataka 560090, India',
    gstin: '29AAKFF5695E1ZY',
    logo: (typeof window !== 'undefined' && window.INNO_LOGO_DATA) ? window.INNO_LOGO_DATA : 'assets/brand/inno-logo.png',
    stamp: (typeof window !== 'undefined' && window.INNO_STAMP_DATA) ? window.INNO_STAMP_DATA : 'inno-stamp.png'
  };
  const CUSTS = 'fixo_inno_customers', INV = 'fixo_inno_inventory', SEQFY = 'fixo_inno_seq_fy';
  const CO_STATE = '29';
  const STATES = [['37','Andhra Pradesh'],['12','Arunachal Pradesh'],['18','Assam'],['10','Bihar'],['04','Chandigarh'],['22','Chhattisgarh'],['07','Delhi'],['30','Goa'],['24','Gujarat'],['06','Haryana'],['02','Himachal Pradesh'],['01','Jammu & Kashmir'],['20','Jharkhand'],['29','Karnataka'],['32','Kerala'],['23','Madhya Pradesh'],['27','Maharashtra'],['14','Manipur'],['17','Meghalaya'],['15','Mizoram'],['13','Nagaland'],['21','Odisha'],['34','Puducherry'],['03','Punjab'],['08','Rajasthan'],['11','Sikkim'],['33','Tamil Nadu'],['36','Telangana'],['16','Tripura'],['09','Uttar Pradesh'],['05','Uttarakhand'],['19','West Bengal']];
  const stateName = (code) => { const s = STATES.find(x => x[0] === code); return s ? s[1] : ''; };
  const posLabel = (code) => code ? '[' + code + '] ' + stateName(code) : '';
  const gstStateCode = (gstin) => (String(gstin || '').trim().match(/^(\d{2})/) || [, ''])[1];
  const loadCusts = () => { try { return JSON.parse(localStorage.getItem(CUSTS) || '[]') || []; } catch (e) { return []; } };
  const storeCusts = (a) => { try { localStorage.setItem(CUSTS, JSON.stringify(a.slice(0, 500))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(CUSTS); } catch (e) {} };

  // ---------- financial-year numbering (Apr→Mar); rolls over each April ----------
  function finYear(d) { const dt = d instanceof Date ? d : new Date(); const y = dt.getFullYear(), start = dt.getMonth() >= 3 ? y : y - 1; const p2 = (n) => String(n % 100).padStart(2, '0'); return p2(start) + '/' + p2(start + 1); }
  const DOC_TAG = { INV: '', QT: 'QT', SO: 'SO' };
  function loadSeqFy() { try { return JSON.parse(localStorage.getItem(SEQFY) || '{}') || {}; } catch (e) { return {}; } }
  function peekDocNo(type, fy) { fy = fy || finYear(); const all = loadSeqFy(); const n = (all[type + '|' + fy] || 0) + 1; return 'FIS' + fy + '-' + DOC_TAG[type] + String(n).padStart(3, '0'); }
  function nextDocNo(type, fy) { fy = fy || finYear(); const all = loadSeqFy(); const key = type + '|' + fy; const n = (all[key] || 0) + 1; all[key] = n; try { localStorage.setItem(SEQFY, JSON.stringify(all)); } catch (e) {} return 'FIS' + fy + '-' + DOC_TAG[type] + String(n).padStart(3, '0'); }

  // ---------- inventory / items master (shared by all apps) ----------
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
    { name: 'Site Visit, Design and Analysis', hsn: '998391', unit: 'NOS', rate: 5000, cat: 'Service' }
  ];
  const loadInv = () => { try { return JSON.parse(localStorage.getItem(INV) || 'null'); } catch (e) { return null; } };
  const storeInv = (a) => { try { localStorage.setItem(INV, JSON.stringify(a.slice(0, 2000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(INV); } catch (e) {} };
  function seedInventory() { if (loadInv()) return; storeInv(PRODUCTS.map(p => ({ id: uid('itm-'), name: p.name, sku: '', hsn: p.hsn, unit: p.unit, rate: p.rate, category: p.cat || 'Product', stock: '', notes: '' }))); }
  function invList() { const l = loadInv(); return Array.isArray(l) ? l : []; }
  function upsertInvItem(it) { const l = invList(); const i = l.findIndex(x => x.id === it.id); if (i >= 0) l[i] = it; else l.unshift(it); storeInv(l); return it; }

  function seedCusts() {
    if (localStorage.getItem('fixo_inno_cust_seed') === '1') return;
    if (!loadCusts().length) storeCusts([{ id: 'cust-thrivasol', name: 'THRIVASOL RENEWABLE TECHNOLOGIES PRIVATE LIMITED', gstin: '29AANCT2412M1ZX', stateCode: '29', billAddr: '', shipAddr: '', email: '', phone: '' }]);
    localStorage.setItem('fixo_inno_cust_seed', '1');
  }

  // ---------- shared calc ----------
  const blank = () => ({ desc: '', sku: '', hsn: '', qty: '', unit: 'NOS', rate: '', itemId: '' });
  function totals(m) {
    const sub = m.items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
    const disc = Math.round(sub * num(m.discountPct) / 100 * 100) / 100;
    const taxable = sub - disc;
    let cgst = 0, sgst = 0, igst = 0;
    if (m.type === 'state') { cgst = taxable * (m.gstRate / 2) / 100; sgst = cgst; } else { igst = taxable * m.gstRate / 100; }
    const tax = cgst + sgst + igst;
    return { sub, disc, taxable, cgst, sgst, igst, tax, grand: Math.round((taxable + tax) * 100) / 100 };
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
  const dn = (m) => m.docNo || m.invNo || '';

  // ---------- shared modal ----------
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'inv-overlay'; el.innerHTML = `<div class="inv-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  // ---------- shared inventory management (edit-save-search + linked docs) ----------
  function editInvItem(item, after) {
    const it = item || { id: uid('itm-'), name: '', sku: '', hsn: '', unit: 'NOS', rate: '', category: 'Product', stock: '', notes: '' };
    const m = modal(`<h3>${item ? 'Edit' : 'New'} item</h3>
      <div class="inv-fields" style="grid-template-columns:1fr 1fr">
        <label class="inv-wide2">Name<input id="it-name" value="${esc(it.name)}" placeholder="Item / product name"></label>
        <label>SKU (custom)<input id="it-sku" value="${esc(it.sku)}" placeholder="e.g. FIS-STRUT-41"></label>
        <label>HSN/SAC<input id="it-hsn" value="${esc(it.hsn)}"></label>
        <label>Unit<input id="it-unit" value="${esc(it.unit || 'NOS')}"></label>
        <label>Rate ₹<input id="it-rate" type="number" value="${esc(it.rate)}"></label>
        <label>Category<select id="it-cat"><option ${it.category === 'Product' ? 'selected' : ''}>Product</option><option ${it.category === 'Raw Material' ? 'selected' : ''}>Raw Material</option><option ${it.category === 'Service' ? 'selected' : ''}>Service</option></select></label>
        <label>Stock qty<input id="it-stock" value="${esc(it.stock)}" placeholder="optional"></label>
        <label class="inv-wide2">Notes<input id="it-notes" value="${esc(it.notes || '')}"></label>
      </div>
      <div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-save>💾 Save item</button><button class="cp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => { m.remove(); if (after) after(null); };
    m.querySelector('[data-save]').onclick = () => {
      const name = m.querySelector('#it-name').value.trim(); if (!name) { toast('Name is required'); return; }
      const saved = { id: it.id, name, sku: m.querySelector('#it-sku').value.trim(), hsn: m.querySelector('#it-hsn').value.trim(), unit: m.querySelector('#it-unit').value.trim() || 'NOS', rate: num(m.querySelector('#it-rate').value), category: m.querySelector('#it-cat').value, stock: m.querySelector('#it-stock').value.trim(), notes: m.querySelector('#it-notes').value.trim() };
      upsertInvItem(saved); toast('Item saved'); m.remove(); if (after) after(saved);
    };
  }
  function openInventory() {
    const m = modal(`<div class="inv-ed-head"><h3>Inventory / Items master</h3><button class="cp-btn small cp-btn-go" id="inv-m-new">＋ New item</button><button class="cp-btn" data-x>Close</button></div>
      <input class="inv-in" id="inv-m-s" placeholder="Search name / SKU / HSN / category…" style="margin:4px 0 10px">
      <div class="modal-body" id="inv-m-list"></div>`, 'big');
    m.querySelector('[data-x]').onclick = () => { m.remove(); if (ACTIVE && ACTIVE.rerender) ACTIVE.rerender(); };
    const draw = () => {
      const q = (m.querySelector('#inv-m-s').value || '').toLowerCase();
      const list = invList().filter(p => !q || (p.name + ' ' + (p.sku || '') + ' ' + (p.hsn || '') + ' ' + (p.category || '')).toLowerCase().includes(q));
      m.querySelector('#inv-m-list').innerHTML = list.length ? list.map(p => { const d = docsForItem(p); const nDocs = d.QT.length + d.SO.length + d.INV.length; return `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${esc(p.name)}</b> <span class="inv-chip st-draft">${esc(p.category || 'Product')}</span><span class="inv-rec-sub">${p.sku ? 'SKU ' + esc(p.sku) + ' · ' : ''}HSN ${esc(p.hsn) || '—'} · ${esc(p.unit)} · ₹${money(p.rate)}${p.stock !== '' && p.stock != null ? ' · stock ' + esc(p.stock) : ''} · 📄 ${nDocs} doc${nDocs === 1 ? '' : 's'}</span></div>
        <div class="inv-rec-act"><button class="cp-btn so-open" data-edit="${p.id}">Edit</button><button class="cp-btn" data-docs="${p.id}" title="Quotations / Sales Orders / Invoices">📄</button><button class="cp-btn" data-use="${p.id}" title="Add to current document">➕</button><button class="so-del" data-del="${p.id}">×</button></div></div>`; }).join('') : '<div class="so-empty">No items. Click ＋ New item.</div>';
      m.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editInvItem(invList().find(x => x.id === b.dataset.edit), () => draw()));
      m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this item from inventory?')) { storeInv(invList().filter(x => x.id !== b.dataset.del)); draw(); } });
      m.querySelectorAll('[data-docs]').forEach(b => b.onclick = () => openItemDocs(invList().find(x => x.id === b.dataset.docs)));
      m.querySelectorAll('[data-use]').forEach(b => b.onclick = () => { const p = invList().find(x => x.id === b.dataset.use); if (p && ACTIVE && ACTIVE.addItem) { ACTIVE.addItem(p); toast('Added to ' + ACTIVE.cfg.noun.toLowerCase()); } else { toast('Open an invoice/quotation first'); } });
    };
    m.querySelector('#inv-m-s').oninput = draw; m.querySelector('#inv-m-new').onclick = () => editInvItem(null, (s) => { if (s) draw(); });
    draw();
  }

  // ---------- cross-document product search ----------
  const SAVED_KEYS = { QT: 'fixo_inno_quotes', SO: 'fixo_inno_sorders', INV: 'fixo_inno_invoices' };
  function loadStore(key) { try { return JSON.parse(localStorage.getItem(key) || '[]') || []; } catch (e) { return []; } }
  function allDocs() { const out = []; Object.keys(SAVED_KEYS).forEach(type => loadStore(SAVED_KEYS[type]).forEach(r => out.push(Object.assign({ docType: r.docType || type }, r)))); return out; }
  // Every quotation / sales-order / invoice that contains this product.
  function docsForItem(item) {
    const res = { QT: [], SO: [], INV: [] };
    const nm = (item.name || '').toLowerCase(), id = item.id;
    allDocs().forEach(r => {
      const its = (r.model && r.model.items) || [];
      const hit = its.find(it => (it.itemId && it.itemId === id) || (it.desc && it.desc.toLowerCase() === nm));
      if (hit) { const t = r.docType || 'INV'; (res[t] || res.INV).push({ docNo: dn(r.model || r), customer: r.customer, savedAt: r.savedAt, status: r.status, qty: hit.qty, rate: hit.rate }); }
    });
    return res;
  }
  function openItemDocs(item) {
    if (!item) return;
    const d = docsForItem(item);
    const sec = (title, arr) => `<div class="inv-card-h" style="margin-top:10px">${title} <em>(${arr.length})</em></div>` + (arr.length ? arr.map(r => `<div class="inv-rec-row"><div class="inv-rec-main"><b>${esc(r.docNo)}</b> <span class="inv-rec-sub">${esc(r.customer || '')} · qty ${esc(r.qty)} @ ₹${money(r.rate)} · ${esc(r.savedAt || '')}</span></div></div>`).join('') : '<div class="so-empty">None</div>');
    modal(`<div class="inv-ed-head"><h3>Documents for “${esc(item.name)}”</h3><button class="cp-btn" data-x>Close</button></div>
      ${item.sku ? `<div class="inv-rec-sub" style="margin:-4px 0 6px">SKU ${esc(item.sku)} · HSN ${esc(item.hsn)}</div>` : ''}
      <div class="modal-body">${sec('🧮 Quotations', d.QT)}${sec('📦 Sales Orders', d.SO)}${sec('🧾 Invoices', d.INV)}</div>`, 'big').querySelector('[data-x]').onclick = function () { this.closest('.inv-overlay').remove(); };
  }

  // ---------- document interconnection (Quotation → Sales Order → Invoice) ----------
  function recByNo(no) { for (const t of ['QT', 'SO', 'INV']) { const r = loadStore(SAVED_KEYS[t]).find(x => dn(x.model || x) === no); if (r) return { type: t, rec: r }; } return null; }
  function childOf(no) { for (const t of ['SO', 'INV']) { const r = loadStore(SAVED_KEYS[t]).find(x => x.source && x.source.docNo === no); if (r) return { type: t, docNo: dn(r.model || r), rec: r }; } return null; }
  // The full QT→SO→INV chain any saved document belongs to (ordered).
  function fullChain(no) {
    let root = no, cur = recByNo(no), g = 0;
    while (cur && cur.rec.source && cur.rec.source.docNo && g++ < 12) { root = cur.rec.source.docNo; cur = recByNo(root); }
    const chain = []; let curNo = root; g = 0;
    while (curNo && g++ < 12) { const c = recByNo(curNo); if (!c) break; chain.push({ type: c.type, docNo: curNo, status: c.rec.status || 'draft' }); const ch = childOf(curNo); curNo = ch ? ch.docNo : null; }
    return chain;
  }
  function downstreamFor(no) { const ch = childOf(no); return ch ? { type: ch.type, docNo: ch.docNo } : null; }

  // ---------- backup / restore / real-data import (one place, all Inno data) ----------
  function innoSummary() {
    const s = (k) => loadStore(k).length;
    return { customers: loadCusts().length, inventory: invList().length, quotes: s(SAVED_KEYS.QT), sorders: s(SAVED_KEYS.SO), invoices: s(SAVED_KEYS.INV) };
  }
  function exportAll() {
    return { app: 'fixo-inno', version: 2, exportedAt: new Date().toISOString(),
      customers: loadCusts(), inventory: invList(),
      quotes: loadStore(SAVED_KEYS.QT), sorders: loadStore(SAVED_KEYS.SO), invoices: loadStore(SAVED_KEYS.INV),
      seq: (function () { try { return JSON.parse(localStorage.getItem(SEQFY) || '{}'); } catch (e) { return {}; } })() };
  }
  const putStore = (key, arr) => { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(key); } catch (e) {} };
  // Normalise an imported document record so reports/board/chain all work.
  function normDoc(r, type) {
    const m = r.model || r; const no = r.docNo || r.invNo || m.docNo || m.invNo || '';
    const model = Object.assign({}, m);
    model.docType = model.docType || type; model.docNo = no; model.invNo = no;
    model.items = (model.items || []).map(it => Object.assign({ desc: '', sku: '', hsn: '', qty: '', unit: 'NOS', rate: '', itemId: '' }, it));
    if (!model.invDate) model.invDate = r.date || r.savedAt || today();
    if (model.type == null) model.type = model.gstStateCode && model.gstStateCode !== CO_STATE ? 'inter' : (model.posCode && model.posCode !== CO_STATE ? 'inter' : 'state');
    if (model.gstRate == null) model.gstRate = 18;
    if (!model.posCode) model.posCode = CO_STATE;
    if (!model.placeOfSupply) model.placeOfSupply = posLabel(model.posCode);
    if (model.discountPct == null) model.discountPct = 0;
    const t = totals(model);
    return { id: r.id || uid('doc-'), docType: type, docNo: no, invNo: no, customer: r.customer || model.billName || '', savedAt: r.savedAt || model.invDate || today(), total: r.total != null ? r.total : t.grand, status: r.status || model.status || 'draft', source: r.source || model.source || null, model };
  }
  // After import, advance the FY counters past the highest imported number so new
  // documents never collide with historical FIS numbers.
  function reseqFromData() {
    const seq = {};
    const scan = (type) => loadStore(SAVED_KEYS[type]).forEach(r => { const no = dn(r.model || r); const m = String(no).match(/^FIS(\d{2}\/\d{2})-(?:QT|SO)?(\d+)$/); if (m) { const key = type + '|' + m[1]; const n = parseInt(m[2], 10) || 0; if (n > (seq[key] || 0)) seq[key] = n; } });
    ['QT', 'SO', 'INV'].forEach(scan);
    try { const cur = JSON.parse(localStorage.getItem(SEQFY) || '{}'); Object.keys(cur).forEach(k => { if ((cur[k] || 0) > (seq[k] || 0)) seq[k] = cur[k]; }); localStorage.setItem(SEQFY, JSON.stringify(seq)); } catch (e) {}
  }
  function importAll(data, replace) {
    if (!data || typeof data !== 'object') throw new Error('Invalid data');
    const mergeArr = (key, incoming, idf) => { const cur = replace ? [] : loadStore(key); const byId = {}; cur.forEach(x => byId[idf(x)] = x); (incoming || []).forEach(x => byId[idf(x)] = x); return Object.values(byId); };
    if (data.customers) { const cur = replace ? [] : loadCusts(); const byId = {}; cur.forEach(c => byId[c.id || c.name] = c); data.customers.forEach(c => byId[c.id || c.name] = Object.assign({ id: uid('cust-') }, c)); storeCusts(Object.values(byId)); }
    if (data.inventory) { const cur = replace ? [] : invList(); const byId = {}; cur.forEach(i => byId[i.id || i.name] = i); data.inventory.forEach(i => byId[i.id || i.name] = Object.assign({ id: uid('itm-'), category: 'Product', unit: 'NOS' }, i)); storeInv(Object.values(byId)); }
    const docs = (arr, type) => (arr || []).map(r => normDoc(r, type));
    if (data.quotes) putStore(SAVED_KEYS.QT, mergeArr(SAVED_KEYS.QT, docs(data.quotes, 'QT'), x => x.id));
    if (data.sorders) putStore(SAVED_KEYS.SO, mergeArr(SAVED_KEYS.SO, docs(data.sorders, 'SO'), x => x.id));
    if (data.invoices) putStore(SAVED_KEYS.INV, mergeArr(SAVED_KEYS.INV, docs(data.invoices, 'INV'), x => x.id));
    if (replace && data.seq) { try { localStorage.setItem(SEQFY, JSON.stringify(data.seq)); } catch (e) {} }
    reseqFromData();
    return innoSummary();
  }

  // ---------- Tally export (copy/paste XML — no live connection) ----------
  function tallyDate(d) { const m = String(d || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) { const t = new Date(); return t.getFullYear() + String(t.getMonth() + 1).padStart(2, '0') + String(t.getDate()).padStart(2, '0'); } let y = m[3]; if (y.length === 2) y = '20' + y; return y + m[2].padStart(2, '0') + m[1].padStart(2, '0'); }
  function xesc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function ledgerEntry(name, deemedPos, amount) { return `<ALLLEDGERENTRIES.LIST><LEDGERNAME>${xesc(name)}</LEDGERNAME><ISDEEMEDPOSITIVE>${deemedPos ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE><AMOUNT>${amount.toFixed(2)}</AMOUNT></ALLLEDGERENTRIES.LIST>`; }
  function tallyVoucher(mo) {
    const t = totals(mo); const party = mo.billName || 'Cash'; const dt = tallyDate(mo.invDate);
    const narr = mo.items.filter(i => (i.desc || '').trim()).map(i => `${num(i.qty)} ${i.unit || ''} ${i.desc} @ ${money(i.rate)}`).join('; ');
    let tax = mo.type === 'state' ? ledgerEntry('Output CGST', false, t.cgst) + ledgerEntry('Output SGST', false, t.sgst) : ledgerEntry('Output IGST', false, t.igst);
    const round = +(t.grand - (t.taxable + t.cgst + t.sgst + t.igst)).toFixed(2);
    const roundEntry = round ? ledgerEntry('Round Off', round < 0, round) : '';
    return `  <TALLYMESSAGE xmlns:UDF="TallyUDF">
   <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
    <DATE>${dt}</DATE>
    <EFFECTIVEDATE>${dt}</EFFECTIVEDATE>
    <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
    <VOUCHERNUMBER>${xesc(dn(mo))}</VOUCHERNUMBER>
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
    return `<ENVELOPE>
 <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>
 <BODY>
  <IMPORTDATA>
   <REQUESTDESC><REPORTNAME>Vouchers</REPORTNAME><STATICVARIABLES><SVCURRENTCOMPANY>${xesc(CO.name)}</SVCURRENTCOMPANY></STATICVARIABLES></REQUESTDESC>
   <REQUESTDATA>
${models.filter(Boolean).map(tallyVoucher).join('\n')}
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
      <div class="inv-modal-act"><button class="cp-btn cp-btn-go" id="inv-tally-copy">📋 Copy</button><button class="cp-btn" id="inv-tally-dl">⬇ Download .xml</button><button class="cp-btn" data-x>Close</button></div>`, 'inv-modal-wide');
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('#inv-tally-copy').onclick = () => { const ta = m.querySelector('#inv-tally-xml'); ta.select(); try { navigator.clipboard.writeText(xml); } catch (e) { document.execCommand('copy'); } toast('Tally code copied'); };
    m.querySelector('#inv-tally-dl').onclick = () => { const blob = new Blob([xml], { type: 'application/xml' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'tally-' + (models.length === 1 ? (dn(models[0]) || 'doc') : 'docs') + '.xml'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000); toast('Downloaded'); };
  }

  // ---------- printable document HTML (shared, editable) ----------
  function docHtml(cfg, m, editable, isDraft) {
    const t = totals(m);
    const ship = m.sameShip ? { name: m.billName, gst: m.billGst, addr: m.billAddr } : { name: m.shipName, gst: m.shipGst, addr: m.shipAddr };
    const half = m.gstRate / 2;
    const taxHead = m.type === 'state' ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>';
    const rows = m.items.filter(it => (it.desc || '').trim()).map((it, i) => {
      const amt = num(it.qty) * num(it.rate); const afterDisc = amt - amt * num(m.discountPct) / 100;
      const txCell = (pct, val) => `<td class="r cell-tax"><span class="tx-pct">${pct}%</span><br><span class="tx-val">${money(val)}</span></td>`;
      const taxCell = m.type === 'state' ? txCell(half, afterDisc * half / 100) + txCell(half, afterDisc * half / 100) : txCell(m.gstRate, afterDisc * m.gstRate / 100);
      return `<tr><td class="c">${i + 1}</td><td class="cell-desc">${esc(it.desc)}${it.sku ? `<div class="sku">SKU : <span class="sku-v">${esc(it.sku)}</span></div>` : ''}</td><td class="c cell-hsn">${esc(it.hsn)}</td><td class="c cell-qty">${esc(it.qty)} ${esc(it.unit || '')}</td><td class="r cell-rate">${money(it.rate)}</td>${taxCell}<td class="r b cell-amt">${money(amt)}</td></tr>`;
    }).join('');
    const taxTot = m.type === 'state'
      ? `<tr><td>CGST (${half}%)</td><td class="r"><span id="tt-cgst">${money(t.cgst)}</span></td></tr><tr><td>SGST (${half}%)</td><td class="r"><span id="tt-sgst">${money(t.sgst)}</span></td></tr>`
      : `<tr><td>IGST (${m.gstRate}%)</td><td class="r"><span id="tt-igst">${money(t.igst)}</span></td></tr>`;
    const heading = isDraft ? cfg.draftHeading : cfg.docHeading;
    const docNoShown = dn(m) || peekDocNo(cfg.type);
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(cfg.noun)} ${esc(docNoShown)}</title><style>
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
.tc{font-size:9.5px;color:#333}.sign{text-align:right}.sign b{font-size:11px}.stampimg{height:118px;object-fit:contain;display:block;margin:0 0 0 auto}
.wm{position:absolute;top:44%;left:50%;transform:translate(-50%,-50%) rotate(-28deg);font-size:68px;font-weight:900;color:rgba(220,0,0,.12);letter-spacing:4px;pointer-events:none;z-index:5;white-space:nowrap}
${editable ? '.layer[contenteditable] td:hover,.layer[contenteditable] [contenteditable]:hover{background:rgba(59,130,246,.06)}' : ''}
</style></head><body><div class="doc">${isDraft ? `<div class="wm">${esc(cfg.draftWm || 'DRAFT')}</div>` : ''}<div class="layer"${editable ? ' contenteditable="true" spellcheck="false"' : ''}>
  <div class="top"><div class="co"><img src="${CO.logo}" style="height:34px" onerror="this.style.display='none'"><br><b>${esc(CO.name)}</b><div>${esc(CO.address)}</div><div>GSTIN ${esc(CO.gstin)}</div></div>
    <div class="ti"><h1>${esc(heading)}</h1>${isDraft ? '<div style="font-size:10px;color:#b00;font-weight:bold">DRAFT — not final</div>' : ''}</div></div>
  <div class="meta">
    <div><span>${esc(cfg.noun)} No :</span> <b>${esc(docNoShown)}</b></div><div><span>Date :</span> ${esc(m.invDate)}</div>
    <div><span>Terms :</span> ${esc(m.terms)}</div><div><span>${esc(cfg.dateLabel)} :</span> ${esc(m.dueDate)}</div>
    ${m.eway ? `<div><span>E-Way Bill# :</span> ${esc(m.eway)}</div>` : ''}<div><span>Place Of Supply :</span> ${esc(m.placeOfSupply)}</div>
    ${m.source ? `<div><span>Ref :</span> ${esc(m.source.docNo)}</div>` : ''}</div>
  <div class="party"><div><div class="lab">${cfg.type === 'QT' ? 'Quotation To' : 'Bill To'}</div><b>${esc(m.billName)}</b><div>${esc(m.billAddr)}</div>${m.billGst ? `<div>GSTIN ${esc(m.billGst)}</div>` : ''}</div>
    <div><div class="lab">Ship To</div><b>${esc(ship.name)}</b><div>${esc(ship.addr)}</div>${ship.gst ? `<div>GSTIN ${esc(ship.gst)}</div>` : ''}</div></div>
  <table class="items pi-irows"><thead><tr><th>#</th><th>Item &amp; Description</th><th>HSN/SAC</th><th>Qty</th><th>Rate</th>${taxHead}<th>Amount</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="tot"><table>
    <tr><td>Sub Total</td><td class="r"><span id="tt-sub">${money(t.sub)}</span></td></tr>
    <tr id="tt-disc-row" style="display:${t.disc ? '' : 'none'}"><td>Discount (${m.discountPct}%)</td><td class="r">(-) <span id="tt-disc">${money(t.disc)}</span></td></tr>
    ${taxTot}<tr class="g"><td>Total</td><td class="r"><span id="tt-grand">₹${money(t.grand)}</span></td></tr></table></div>
  <div class="words"><b>Total In Words :</b> ${esc(inWords(t.grand))}</div>
  <div class="foot"><div class="tc"><b>Notes:</b> ${esc(m.notes)}<br><b>Terms &amp; Conditions</b><br>Delivery Charges : ${esc(m.tcDelivery)}<br>Payment Method : ${esc(m.tcPayment)}<br>Note : ${esc(m.tcNote)}</div>
    <div class="sign"><img src="${CO.stamp}" class="stampimg" onerror="this.outerHTML='<b>${esc(CO.name)}</b><br><br><br>Authorized Signature'"></div></div>
</div></div>${editable ? `<script>(function(){
  var GST=${m.gstRate},DISC=${num(m.discountPct)},TYPE=${JSON.stringify(m.type)};
  function n(v){var x=parseFloat(String(v==null?'':v).replace(/[^0-9.\\-]/g,''));return isNaN(x)?0:x;}
  function f(x){return (x||0).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});}
  var tb=document.querySelector('table.items tbody');
  function recalc(){
    if(!tb)return; var sub=0;
    [].slice.call(tb.rows).forEach(function(tr){
      var qe=tr.querySelector('.cell-qty'),re=tr.querySelector('.cell-rate');
      var q=n(qe&&qe.innerText),r=n(re&&re.innerText),amt=q*r,after=amt-amt*DISC/100; sub+=amt;
      var ac=tr.querySelector('.cell-amt'); if(ac)ac.innerText=f(amt);
      var tx=tr.querySelectorAll('.cell-tax .tx-val');
      if(TYPE==='state'){ if(tx[0])tx[0].innerText=f(after*(GST/2)/100); if(tx[1])tx[1].innerText=f(after*(GST/2)/100); }
      else if(tx[0]){ tx[0].innerText=f(after*GST/100); }
    });
    var disc=sub*DISC/100,taxable=sub-disc,cgst=0,sgst=0,igst=0;
    if(TYPE==='state'){cgst=sgst=taxable*(GST/2)/100;}else{igst=taxable*GST/100;}
    var grand=Math.round(taxable+cgst+sgst+igst);
    var S=function(id,v){var e=document.getElementById(id);if(e)e.innerText=v;};
    S('tt-sub',f(sub));S('tt-disc',f(disc));S('tt-cgst',f(cgst));S('tt-sgst',f(sgst));S('tt-igst',f(igst));S('tt-grand','₹'+f(grand));
    var dr=document.getElementById('tt-disc-row'); if(dr)dr.style.display=disc?'':'none';
  }
  document.addEventListener('input',function(e){var t=e.target; if(t&&t.closest&&t.closest('table.items'))recalc();});
})();</script>` : ''}</body></html>`;
  }

  // ---------- which app is in front (for the inventory ➕) ----------
  let ACTIVE = null;
  const APPS = {};

  // ============================================================
  // FACTORY — one document app (quotation / sales order / invoice)
  // ============================================================
  function make(cfg) {
    let sessions = [], activeIdx = 0, model = null;
    const SESS = cfg.sessKey, SAVED = cfg.savedKey, STATUS = cfg.statuses;
    const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED) || '[]') || []; } catch (e) { return []; } };
    const storeSaved = (a) => { try { localStorage.setItem(SAVED, JSON.stringify(a.slice(0, 500))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(SAVED); } catch (e) {} };

    // Number is assigned lazily — on first Save/convert — so opening or discarding
    // an empty draft never burns an invoice/quote/SO number (keeps them gap-free).
    function ensureNo() { if (!model.docNo) { model.docNo = nextDocNo(cfg.type); model.invNo = model.docNo; } return model.docNo; }
    function fresh() {
      return { id: uid('doc-'), docType: cfg.type, docNo: '', invDate: today(), terms: 'Due on Receipt', dueDate: today(), eway: '', orderNo: '', salesperson: '', subject: '',
        posCode: CO_STATE, placeOfSupply: posLabel(CO_STATE), type: 'state', gstRate: 18,
        custId: '', billName: '', billGst: '', billAddr: '', sameShip: true, shipName: '', shipGst: '', shipAddr: '',
        items: [blank()], discountPct: 0, status: 'draft', sentAt: '', approvedAt: '',
        notes: 'Looking forward for your business.', tcDelivery: 'Packing & Delivery charges extra at actuals.', tcPayment: '50% Advance and the rest before dispatch.', tcNote: 'Prices are subject to change depends upon the changes in the material rates.', source: null };
    }
    function loadSessions() {
      try { const s = JSON.parse(localStorage.getItem(SESS) || 'null'); if (s && Array.isArray(s.sessions) && s.sessions.filter(Boolean).length) { sessions = s.sessions.filter(Boolean); activeIdx = Math.min(s.activeIdx || 0, sessions.length - 1); model = sessions[activeIdx]; return; } } catch (e) {}
      sessions = [fresh()]; activeIdx = 0; model = sessions[activeIdx];
    }
    function persistSessions() { try { if (model) sessions[activeIdx] = model; if (!sessions.length) return; localStorage.setItem(SESS, JSON.stringify({ sessions, activeIdx })); } catch (e) {} }
    function newSession() { persistSessions(); sessions.push(fresh()); activeIdx = sessions.length - 1; model = sessions[activeIdx]; render(); persistSessions(); }
    function switchSession(i) { if (i === activeIdx) return; persistSessions(); activeIdx = i; model = sessions[activeIdx]; render(); }
    function closeSession(i) { persistSessions(); if (sessions.length <= 1) { sessions = [fresh()]; activeIdx = 0; } else { sessions.splice(i, 1); activeIdx = Math.min(i, sessions.length - 1); } model = sessions[activeIdx]; render(); persistSessions(); }
    function clearSession() { if (!confirm('Clear this ' + cfg.noun.toLowerCase() + ' and start fresh? (Saved records are not affected.)')) return; sessions[activeIdx] = fresh(); model = sessions[activeIdx]; render(); persistSessions(); }
    const sessLabel = (m) => { const c = (m.billName || '').trim(); return c ? c.slice(0, 18) : (dn(m) || cfg.noun); };

    function applyPos(code) { model.posCode = code; model.placeOfSupply = posLabel(code); model.type = code === CO_STATE ? 'state' : 'inter'; }
    function applyCustomer(c) { model.custId = c.id; model.billName = c.name || ''; model.billGst = c.gstin || ''; model.billAddr = c.billAddr || ''; model.shipName = c.shipName || c.name || ''; model.shipGst = c.gstin || ''; model.shipAddr = c.shipAddr || c.billAddr || ''; applyPos(c.stateCode || gstStateCode(c.gstin) || model.posCode); render(); }

    function saveDoc(silent) {
      if (!model.items.some(it => (it.desc || '').trim())) { if (!silent) toast('Add at least one item'); return false; }
      ensureNo();
      const list = loadSaved().filter(r => r.id !== model.id);
      list.unshift({ id: model.id, docType: cfg.type, docNo: dn(model), invNo: dn(model), customer: model.billName, savedAt: new Date().toLocaleString('en-IN'), total: totals(model).grand, status: model.status || 'draft', source: model.source || null, model: JSON.parse(JSON.stringify(model)) });
      storeSaved(list); if (!silent) toast(cfg.noun + ' saved'); return true;
    }
    function setStatus(st) {
      if (!model.items.some(it => (it.desc || '').trim())) { toast('Add items first'); return; }
      if (st === 'sent' && !model.sentAt) model.sentAt = new Date().toLocaleString('en-IN');
      if (st === 'approved') model.approvedAt = new Date().toLocaleString('en-IN');
      model.status = st; saveDoc(true); render(); toast('Marked ' + ((STATUS[st] || {}).label || st));
    }

    // ----- convert: QT → SO → INV (or bypass straight to Invoice) -----
    function convertDoc(srcModel, toTypeArg) {
      const toType = toTypeArg || (cfg.convert && cfg.convert.toType); const target = APPS[toType]; if (!target) { toast('Target app not loaded'); return; }
      // Interconnection guard: warn if this source was already carried forward.
      const existing = downstreamFor(dn(srcModel));
      if (existing && !confirm(cfg.noun + ' ' + dn(srcModel) + ' is already linked to ' + existing.docNo + '. Create another ' + target.cfg.noun.toLowerCase() + ' anyway?')) return;
      const copy = JSON.parse(JSON.stringify(srcModel));
      copy.id = uid('doc-'); copy.docType = toType; copy.docNo = nextDocNo(toType); copy.invNo = copy.docNo;
      copy.status = 'draft'; copy.sentAt = ''; copy.approvedAt = '';
      copy.source = { type: cfg.type, docNo: dn(srcModel), id: srcModel.id };
      // Mark the source as moved forward so reports show where each deal stands.
      try { const sList = loadSaved(); const sr = sList.find(x => x.id === srcModel.id); if (sr) { sr.status = cfg.type === 'SO' ? 'invoiced' : 'approved'; if (sr.model) sr.model.status = sr.status; storeSaved(sList); if (model && model.id === srcModel.id) model.status = sr.status; } } catch (e) {}
      target.loadDoc(copy, true);
      toast(cfg.noun + ' → ' + target.cfg.noun + ' ' + copy.docNo);
      nav(target.cfg.screen);
    }
    // Load a document into THIS app's active session and show it.
    function loadDoc(docModel, keepUnsaved) {
      if (!sessions.length) loadSessions();
      persistSessions();
      sessions[activeIdx] = JSON.parse(JSON.stringify(docModel)); model = sessions[activeIdx]; persistSessions();
      if (document.getElementById(cfg.mountId)) render();
    }

    // ----- rows -----
    function rowHtml(it, i) {
      const amt = num(it.qty) * num(it.rate);
      return `<tr data-i="${i}"><td class="c">${i + 1}</td>
        <td><input class="r-desc" list="inv-prods-${cfg.type}" value="${esc(it.desc)}" placeholder="Item name"></td>
        <td><input class="r-sku" value="${esc(it.sku)}" placeholder="SKU"></td>
        <td><input class="r-hsn" value="${esc(it.hsn)}" placeholder="HSN"></td>
        <td><input class="r-qty" value="${esc(it.qty)}"></td>
        <td><input class="r-unit" value="${esc(it.unit || 'NOS')}"></td>
        <td><input class="r-rate" value="${esc(it.rate)}"></td>
        <td class="c r-amt">₹${money(amt)}</td>
        <td><button class="r-del" title="Remove">×</button></td></tr>`;
    }
    function renderRows() {
      const tb = document.getElementById(cfg.type + '-rows'); if (!tb) return;
      tb.innerHTML = model.items.map(rowHtml).join('');
      tb.querySelectorAll('tr').forEach(tr => {
        const i = +tr.dataset.i;
        const sync = () => { const it = model.items[i]; if (!it) return; it.desc = tr.querySelector('.r-desc').value; it.sku = tr.querySelector('.r-sku').value; it.hsn = tr.querySelector('.r-hsn').value; it.qty = tr.querySelector('.r-qty').value; it.unit = tr.querySelector('.r-unit').value; it.rate = tr.querySelector('.r-rate').value; tr.querySelector('.r-amt').textContent = '₹' + money(num(it.qty) * num(it.rate)); renderTotals(); };
        tr.querySelectorAll('input').forEach(inp => inp.oninput = sync);
        tr.querySelector('.r-desc').addEventListener('change', () => { const it = model.items[i]; const p = invList().find(x => x.name.toLowerCase() === (it.desc || '').toLowerCase()); if (p) { it.hsn = p.hsn; it.unit = p.unit; it.sku = p.sku || it.sku; it.itemId = p.id; if (!num(it.rate)) it.rate = p.rate; renderRows(); renderTotals(); } });
        tr.querySelector('.r-del').onclick = () => { model.items.splice(i, 1); if (!model.items.length) model.items.push(blank()); renderRows(); renderTotals(); };
      });
    }
    function renderTotals() {
      const el = document.getElementById(cfg.type + '-totals'); if (!el) return;
      const t = totals(model); const half = model.gstRate / 2;
      const taxRows = model.type === 'state'
        ? `<div class="inv-tr"><span>CGST (${half}%)</span><b>₹${money(t.cgst)}</b></div><div class="inv-tr"><span>SGST (${half}%)</span><b>₹${money(t.sgst)}</b></div>`
        : `<div class="inv-tr"><span>IGST (${model.gstRate}%)</span><b>₹${money(t.igst)}</b></div>`;
      el.innerHTML = `<div class="inv-tr"><span>Sub Total</span><b>₹${money(t.sub)}</b></div>
        ${t.disc ? `<div class="inv-tr"><span>Discount (${model.discountPct}%)</span><b>(-) ₹${money(t.disc)}</b></div>` : ''}
        ${taxRows}<div class="inv-tr inv-grand"><span>Total</span><b>₹${money(t.grand)}</b></div>
        <div class="inv-words">${esc(inWords(t.grand))}</div>`;
    }
    function addItem(p) {
      const empty = model.items.find(it => !it.desc);
      const it = empty || (model.items.push(blank()), model.items[model.items.length - 1]);
      it.desc = p.name; it.sku = p.sku || ''; it.hsn = p.hsn; it.unit = p.unit || 'NOS'; it.rate = p.rate; it.qty = num(it.qty) || 1; it.itemId = p.id;
      renderRows(); renderTotals();
    }
    function pickProduct() {
      const m = modal(`<div class="inv-ed-head"><h3>Pick from inventory</h3><button class="cp-btn small" id="pp-new">＋ New item</button><button class="cp-btn" data-x>Close</button></div>
        <input class="inv-in" id="pp-s" placeholder="Search name / SKU / HSN…" style="margin:4px 0 8px"><div class="inv-pick-list" id="pp-list"></div>`);
      const draw = (q) => { q = (q || '').toLowerCase();
        const list = invList().filter(p => !q || (p.name + ' ' + (p.sku || '') + ' ' + (p.hsn || '') + ' ' + (p.category || '')).toLowerCase().includes(q));
        m.querySelector('#pp-list').innerHTML = list.length ? list.map(p => `<button class="inv-pick-row" data-id="${p.id}"><b>${esc(p.name)}</b><span>${p.sku ? 'SKU ' + esc(p.sku) + ' · ' : ''}HSN ${esc(p.hsn)} · ${esc(p.unit)} · ₹${money(p.rate)} · ${esc(p.category || 'Product')}</span></button>`).join('') : '<div class="so-empty">No match. Use ＋ New item to add it.</div>';
        m.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { const p = invList().find(x => x.id === b.dataset.id); if (p) { addItem(p); m.remove(); } });
      };
      draw(''); m.querySelector('#pp-s').oninput = e => draw(e.target.value); m.querySelector('[data-x]').onclick = () => m.remove();
      m.querySelector('#pp-new').onclick = () => { m.remove(); editInvItem(null, (saved) => { if (saved) addItem(saved); }); };
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
    function attachCustomerPicker() {
      const inp = document.getElementById('f-customer'), dd = document.getElementById('inv-cust-dd'); if (!inp || !dd) return;
      const draw = () => { const q = inp.value.trim().toLowerCase();
        const list = loadCusts().filter(c => !q || (c.name || '').toLowerCase().includes(q)).slice(0, 8);
        dd.innerHTML = list.map(c => `<button class="inv-cust-row" data-cid="${c.id}"><b>${esc(c.name)}</b><span>${esc([c.gstin, posLabel(c.stateCode || gstStateCode(c.gstin))].filter(Boolean).join(' · '))}</span></button>`).join('') + `<button class="inv-cust-row inv-cust-new" data-new="1">＋ Add “${esc(inp.value || 'new customer')}”</button>`;
        dd.hidden = false;
        dd.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { const c = loadCusts().find(x => x.id === b.dataset.cid); dd.hidden = true; if (c) applyCustomer(c); });
        dd.querySelector('[data-new]').onclick = () => { dd.hidden = true; newCustomer(inp.value.trim()); };
      };
      inp.onfocus = draw; inp.oninput = () => { model.billName = inp.value; draw(); };
      inp.onblur = () => setTimeout(() => { dd.hidden = true; }, 180);
    }

    // ----- records -----
    let recFilter = 'all';
    function openSaved() {
      const m = modal(`<h3>${esc(cfg.noun)} records</h3>
        <div class="inv-rec-bar" id="inv-rec-bar"></div>
        ${cfg.tally ? `<div class="inv-rec-tally"><button class="cp-btn small" id="inv-rec-tally-all">🧮 Export all to Tally</button><button class="cp-btn small" id="inv-rec-tally-view">🧮 Tally — this view</button></div>` : ''}
        <div class="modal-body" id="inv-rec-list"></div>
        <div class="inv-modal-act"><button class="cp-btn" data-x>Close</button></div>`);
      m.querySelector('[data-x]').onclick = () => m.remove();
      const isDone = (r) => (r.status || 'draft') !== 'draft';
      const viewList = () => { let list = loadSaved(); if (recFilter === 'draft') list = list.filter(r => !isDone(r)); else if (recFilter === 'completed') list = list.filter(r => isDone(r)); return list; };
      if (cfg.tally) {
        m.querySelector('#inv-rec-tally-all').onclick = () => { const all = loadSaved(); if (!all.length) return toast('Nothing to export'); openTally(all.map(r => r.model), 'Tally code — all (' + all.length + ')'); };
        m.querySelector('#inv-rec-tally-view').onclick = () => { const list = viewList(); if (!list.length) return toast('Nothing in this view'); openTally(list.map(r => r.model), 'Tally code — ' + recFilter + ' (' + list.length + ')'); };
      }
      const drawBar = () => {
        const all = loadSaved();
        const count = (k) => k === 'all' ? all.length : k === 'draft' ? all.filter(r => !isDone(r)).length : all.filter(r => isDone(r)).length;
        const f = (k, lbl) => `<button class="inv-rec-f ${recFilter === k ? 'active' : ''}" data-f="${k}">${lbl} <em>${count(k)}</em></button>`;
        m.querySelector('#inv-rec-bar').innerHTML = f('draft', '📝 Drafts') + f('completed', '✓ Completed') + f('all', 'All');
        m.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { recFilter = b.dataset.f; drawBar(); drawList(); });
      };
      const drawList = () => {
        const list = viewList(); const el = m.querySelector('#inv-rec-list');
        el.innerHTML = list.length ? list.map(r => { const st = STATUS[r.status || 'draft'] || STATUS.draft; return `<div class="inv-rec-row">
          <div class="inv-rec-main"><b>${esc(r.customer || cfg.noun)}</b> <span class="inv-chip ${st.cls}">${st.label}</span><span class="inv-rec-sub">${esc(dn(r.model || r))}${r.source ? ' · from ' + esc(r.source.docNo) : ''} · ${esc(r.savedAt)} · ₹${money(r.total)}</span></div>
          <div class="inv-rec-act">
            <button class="cp-btn so-open" data-id="${r.id}">Open</button>
            ${cfg.convert ? `<button class="cp-btn cp-btn-go" data-conv="${r.id}" title="${esc(cfg.convert.label)}">${esc(cfg.convert.icon || '➡')}</button>` : ''}
            ${cfg.tally ? `<button class="cp-btn" data-tally="${r.id}" title="Tally code">🧮</button>` : ''}
            <button class="so-del" data-id="${r.id}">×</button>
          </div></div>`; }).join('') : '<div class="so-empty">No ' + cfg.noun.toLowerCase() + 's in this view.</div>';
        el.querySelectorAll('.so-open').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.id); if (r) { loadDoc(r.model); m.remove(); toast('Reopened ' + (r.customer || '')); } });
        el.querySelectorAll('[data-conv]').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.conv); if (r) { m.remove(); convertDoc(r.model); } });
        if (cfg.tally) el.querySelectorAll('[data-tally]').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.tally); if (r) openTally([r.model], 'Tally code — ' + dn(r.model || r)); });
        el.querySelectorAll('.so-del').forEach(b => b.onclick = () => { storeSaved(loadSaved().filter(x => x.id !== b.dataset.id)); drawBar(); drawList(); });
      };
      drawBar(); drawList();
    }

    function updateStageHint() {
      const el = document.getElementById(cfg.type + '-stage-hint'); if (!el) return;
      const s = model.status || 'draft'; const lbl = (STATUS[s] || {}).label || s;
      el.innerHTML = s === 'draft' ? 'Draft — save it, preview the PDF, then move it forward.' : '• ' + esc(lbl) + (model.sentAt ? ' · ' + esc(model.sentAt) : '') + (cfg.convert && (s === 'approved' || s === 'confirmed') ? ' — ready to ' + esc(cfg.convert.label.toLowerCase()) : '');
    }

    // ----- editor -----
    function openEditor() {
      if (!model.items.some(it => (it.desc || '').trim())) { toast('Add at least one item'); return; }
      let draftView = false;
      const m = modal(`<div class="inv-ed-head"><h3>Verify &amp; Edit — ${esc(dn(model) || peekDocNo(cfg.type))}</h3>
          <div class="inv-ed-seg"><button class="inv-ed-tab active" data-view="final">🧾 Final</button><button class="inv-ed-tab" data-view="draft">📄 Draft copy</button></div>
          <span class="inv-ed-hint">✎ Click any cell to edit — totals recalculate live; Save changes to keep them.</span><button class="cp-btn" data-x>Close</button></div>
        <iframe id="inv-frame" class="inv-frame"></iframe>
        <div class="inv-modal-act"><button class="cp-btn btn-save-edit" data-save>💾 Save changes</button><button class="cp-btn cp-btn-go" data-print>🖨 Print / Save PDF</button></div>`, 'big');
      const fr = m.querySelector('#inv-frame');
      const draw = () => { const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(docHtml(cfg, model, true, draftView)); d.close(); };
      draw();
      const commit = () => {
        try {
          const d = fr.contentDocument || fr.contentWindow.document;
          const grab = (el) => (el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/ /g, ' ').trim();
          const rows = [...d.querySelectorAll('table.items tbody tr')];
          if (rows.length) model.items = rows.map(tr => { const q = grab(tr.querySelector('.cell-qty')); const skuEl = tr.querySelector('.sku-v'); const descCell = tr.querySelector('.cell-desc'); return { desc: (descCell ? (descCell.innerText || '') : '').split('\n')[0].trim(), sku: skuEl ? grab(skuEl) : '', hsn: grab(tr.querySelector('.cell-hsn')), qty: num(q), unit: q.replace(/[0-9.,\s]/g, '') || 'NOS', rate: num(grab(tr.querySelector('.cell-rate'))), itemId: '' }; }).filter(it => it.desc);
          if (loadSaved().some(r => r.id === model.id)) saveDoc(true);
          persistSessions(); render();
        } catch (e) {}
      };
      m.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { commit(); draftView = b.dataset.view === 'draft'; m.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === b)); draw(); });
      m.querySelector('[data-x]').onclick = () => { commit(); m.remove(); };
      m.querySelector('[data-save]').onclick = () => { commit(); draw(); toast('Changes saved'); };
      m.querySelector('[data-print]').onclick = () => { commit(); draw(); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
    }

    // ----- render -----
    function render() {
      const host = document.getElementById(cfg.mountId); if (!host) return;
      seedCusts(); seedInventory();
      if (!sessions.length) loadSessions();
      model = sessions[activeIdx]; ACTIVE = api;
      const taxMode = model.type === 'state' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)';
      const provNo = peekDocNo(cfg.type);
      const sessTabs = sessions.map((s, i) => `<div class="inv-sess-tab ${i === activeIdx ? 'active' : ''}" data-si="${i}"><span class="inv-sess-no">${esc(dn(s) || 'Draft')}</span><span class="inv-sess-sub">${esc((s.billName || '').trim() ? (s.billName || '').trim().slice(0, 18) : 'New')}</span>${sessions.length > 1 ? `<span class="inv-sess-close" data-close="${i}" title="Close">×</span>` : ''}</div>`).join('');
      const stageBtns = cfg.stages.map(s => `<button class="cp-btn ${s.cls || ''}" data-stage="${s.status}">${s.label}</button>`).join('')
        + (cfg.convert ? `<button class="cp-btn inv-ok" id="${cfg.type}-convert">${esc(cfg.convert.label)}</button>` : '')
        + (cfg.bypass ? `<button class="cp-btn inv-bypass" id="${cfg.type}-bypass">${esc(cfg.bypass.label)}</button>` : '');
      // interconnection strip: the whole Quotation → Sales Order → Invoice chain
      const chain = dn(model) ? fullChain(dn(model)) : null;
      const TYPEN = { QT: 'Quotation', SO: 'Sales Order', INV: 'Invoice' };
      const chainStrip = (chain && chain.length > 1)
        ? `<div class="inv-chain">${chain.map((c, i) => `${i ? '<span class="inv-chain-arr">→</span>' : ''}<span class="inv-chain-node ${dn(model) === c.docNo ? 'cur' : ''}" data-chain="${esc(c.docNo)}" data-ctype="${c.type}" title="${esc(TYPEN[c.type])}">${esc(TYPEN[c.type])} <b>${esc(c.docNo)}</b></span>`).join('')}</div>`
        : (model.source ? `<div class="inv-src-note">↳ Created from ${esc(TYPEN[model.source.type] || model.source.type)} <b>${esc(model.source.docNo)}</b></div>` : '');
      host.innerHTML = `
        <div class="inv-wrap">
          <div class="inv-header">
            <div class="inv-header-left"><img src="${CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
              <div class="inv-header-titles"><div class="inv-h-title">${esc(cfg.appTitle[0])} <span class="inv-h-bold">${esc(cfg.appTitle[1])}</span></div><div class="inv-h-sub">${esc(cfg.subtitle)}</div></div></div>
            <div class="inv-header-right"><span class="inv-chip ${(STATUS[model.status] || STATUS.draft).cls}">${(STATUS[model.status] || STATUS.draft).label}</span><div class="inv-h-no">${esc(dn(model) || provNo)}${dn(model) ? '' : ' <span class="inv-h-prov">· on save</span>'}</div><div class="inv-h-co">${esc(CO.name)} · GSTIN ${esc(CO.gstin)}</div></div>
          </div>
          <div class="inv-sess-bar"><div class="inv-sess-tabs" id="inv-sess-tabs">${sessTabs}</div><button class="inv-sess-add" id="inv-sess-add" title="New ${esc(cfg.noun.toLowerCase())}">＋</button></div>
          <div class="inv-topbtns">
            <button class="cp-btn small" id="inv-save">💾 Save</button>
            <button class="cp-btn small" id="inv-saved">📋 ${esc(cfg.noun)} records</button>
            <button class="cp-btn small" id="inv-inventory">📦 Inventory</button>
            ${cfg.tally ? `<button class="cp-btn small" id="inv-tally">🧮 Tally code</button>` : ''}
            <button class="cp-btn small inv-clear" id="inv-clear">🗑 Clear</button>
          </div>
          ${chainStrip}

          <div class="inv-card"><div class="inv-card-h"><span class="inv-step">1</span> Customer</div>
            <div class="inv-cust-pick"><div class="inv-cust-box"><input id="f-customer" class="inv-in inv-cust-in" placeholder="Select or add a customer…" value="${esc(model.billName)}" autocomplete="off"><div class="inv-cust-dd" id="inv-cust-dd" hidden></div></div><button class="cp-btn" id="inv-newcust">＋ New customer</button></div>
            ${model.billName ? `<div class="inv-cust-info">${model.billGst ? '🧾 GSTIN ' + esc(model.billGst) + ' · ' : ''}📍 ${esc(model.placeOfSupply || '—')}${model.billAddr ? '<br>' + esc(model.billAddr) : ''}</div>` : ''}</div>

          <div class="inv-two">
            <div class="inv-card"><div class="inv-card-h">${cfg.type === 'QT' ? 'Quotation To' : 'Bill To'}</div>
              <input id="f-bname" class="inv-in" placeholder="Customer name" value="${esc(model.billName)}"><input id="f-bgst" class="inv-in" placeholder="GSTIN" value="${esc(model.billGst)}"><textarea id="f-baddr" class="inv-in" rows="2" placeholder="Billing address">${esc(model.billAddr)}</textarea></div>
            <div class="inv-card"><div class="inv-card-h">Ship To <label class="inv-same"><input type="checkbox" id="f-same" ${model.sameShip ? 'checked' : ''}> same as above</label></div>
              <input id="f-sname" class="inv-in" placeholder="Ship name" value="${esc(model.shipName)}" ${model.sameShip ? 'disabled' : ''}><input id="f-sgst" class="inv-in" placeholder="GSTIN" value="${esc(model.shipGst)}" ${model.sameShip ? 'disabled' : ''}><textarea id="f-saddr" class="inv-in" rows="2" placeholder="Shipping address" ${model.sameShip ? 'disabled' : ''}>${esc(model.shipAddr)}</textarea></div>
          </div>

          <div class="inv-card"><div class="inv-card-h"><span class="inv-step">2</span> ${esc(cfg.noun)} details</div>
            <div class="inv-fields">
              <label>${esc(cfg.noun)} No<input id="f-no" value="${esc(dn(model))}" placeholder="${esc(provNo)} (assigned on save)"></label>
              <label>Date<input id="f-date" value="${esc(model.invDate)}"></label>
              <label>Order No (PO)<input id="f-order" value="${esc(model.orderNo || '')}"></label>
              <label>Terms<input id="f-terms" value="${esc(model.terms)}"></label>
              <label>${esc(cfg.dateLabel)}<input id="f-due" value="${esc(model.dueDate)}"></label>
              <label>E-Way Bill#<input id="f-eway" value="${esc(model.eway)}"></label>
              <label>Salesperson<input id="f-sales" value="${esc(model.salesperson || '')}"></label>
              <label>Place of Supply<select id="f-pos">${STATES.map(s => `<option value="${s[0]}" ${s[0] === model.posCode ? 'selected' : ''}>[${s[0]}] ${s[1]}</option>`).join('')}</select></label>
              <label class="inv-wide2">Subject<input id="f-subject" value="${esc(model.subject || '')}" placeholder="What this ${esc(cfg.noun.toLowerCase())} is for"></label>
            </div>
            <div class="inv-tax-row"><span class="inv-taxmode" id="f-taxmode">🧮 ${taxMode}</span><label class="inv-gst">GST %<input id="f-gst" type="number" value="${model.gstRate}" min="0" step="0.5"></label><label class="inv-gst">Discount %<input id="f-disc" type="number" value="${model.discountPct}" min="0" step="0.5"></label></div>
          </div>

          <div class="inv-card"><div class="inv-card-h"><span class="inv-step">3</span> Items <button class="cp-btn small" id="inv-add">+ Add row</button><button class="cp-btn small" id="inv-pick">🔎 Pick from inventory</button></div>
            <datalist id="inv-prods-${cfg.type}">${invList().map(p => `<option value="${esc(p.name)}">`).join('')}</datalist>
            <div class="inv-items-wrap"><table class="inv-tbl"><thead><tr><th>#</th><th>Item &amp; Description</th><th>SKU</th><th>HSN/SAC</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th><th></th></tr></thead><tbody id="${cfg.type}-rows"></tbody></table></div></div>

          <div class="inv-bottom">
            <div class="inv-card inv-notes-card"><div class="inv-card-h">Notes &amp; Terms</div>
              <label class="inv-lab">Notes</label><input id="f-notes" class="inv-in" value="${esc(model.notes)}">
              <label class="inv-lab">Delivery Charges</label><input id="f-tcd" class="inv-in" value="${esc(model.tcDelivery)}">
              <label class="inv-lab">Payment Method</label><input id="f-tcp" class="inv-in" value="${esc(model.tcPayment)}">
              <label class="inv-lab">Note</label><input id="f-tcn" class="inv-in" value="${esc(model.tcNote)}"></div>
            <div class="inv-card inv-tot-card"><div id="${cfg.type}-totals"></div></div>
          </div>

          <button class="inv-bigbtn" id="inv-verify">🖨 Verify &amp; Print — preview as PDF</button>
          <div class="inv-stage"><div class="inv-stage-lab">Save &amp; move forward</div><div class="inv-stage-btns">${stageBtns}</div><div class="inv-stage-hint" id="${cfg.type}-stage-hint"></div></div>
        </div>`;

      const bind = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = () => { model[key] = el.value; }; };
      ['f-date:invDate', 'f-order:orderNo', 'f-terms:terms', 'f-due:dueDate', 'f-eway:eway', 'f-sales:salesperson', 'f-subject:subject', 'f-bname:billName', 'f-bgst:billGst', 'f-baddr:billAddr', 'f-sname:shipName', 'f-sgst:shipGst', 'f-saddr:shipAddr', 'f-notes:notes', 'f-tcd:tcDelivery', 'f-tcp:tcPayment', 'f-tcn:tcNote'].forEach(p => { const [id, key] = p.split(':'); bind(id, key); });
      const noEl = document.getElementById('f-no'); if (noEl) noEl.oninput = () => { model.docNo = noEl.value; model.invNo = noEl.value; };
      document.getElementById('f-gst').oninput = e => { model.gstRate = num(e.target.value); renderTotals(); };
      document.getElementById('f-disc').oninput = e => { model.discountPct = num(e.target.value); renderTotals(); };
      document.getElementById('f-pos').onchange = e => { applyPos(e.target.value); const tm = document.getElementById('f-taxmode'); if (tm) tm.textContent = '🧮 ' + (model.type === 'state' ? 'CGST + SGST (intra-state)' : 'IGST (inter-state)'); renderTotals(); };
      document.getElementById('f-same').onchange = e => { model.sameShip = e.target.checked; render(); };
      attachCustomerPicker();
      document.getElementById('inv-newcust').onclick = () => newCustomer();
      document.getElementById('inv-sess-add').onclick = () => newSession();
      document.getElementById('inv-sess-tabs').querySelectorAll('.inv-sess-tab').forEach(t => { t.onclick = (e) => { if (e.target.dataset.close != null) { closeSession(+e.target.dataset.close); return; } switchSession(+t.dataset.si); }; });
      document.getElementById('inv-save').onclick = () => saveDoc();
      document.getElementById('inv-saved').onclick = openSaved;
      document.getElementById('inv-inventory').onclick = openInventory;
      if (cfg.tally) document.getElementById('inv-tally').onclick = () => openTally([model], 'Tally code — ' + (dn(model) || 'this ' + cfg.noun.toLowerCase()));
      document.getElementById('inv-clear').onclick = () => clearSession();
      document.getElementById('inv-verify').onclick = openEditor;
      host.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => setStatus(b.dataset.stage));
      if (cfg.convert) { const cb = document.getElementById(cfg.type + '-convert'); if (cb) cb.onclick = () => { if (saveDoc(true)) convertDoc(model); }; }
      if (cfg.bypass) { const bb = document.getElementById(cfg.type + '-bypass'); if (bb) bb.onclick = () => { if (saveDoc(true)) convertDoc(model, cfg.bypass.toType); }; }
      // click any node in the chain strip to open that document
      host.querySelectorAll('[data-chain]').forEach(n => n.onclick = () => { const t = n.dataset.ctype, no = n.dataset.chain; const app = APPS[t]; const rec = loadStore(SAVED_KEYS[t]).find(r => dn(r.model || r) === no); if (app && rec) { app.loadDoc(rec.model); nav(app.cfg.screen); } });
      updateStageHint();
      document.getElementById('inv-add').onclick = () => { model.items.push(blank()); renderRows(); renderTotals(); };
      document.getElementById('inv-pick').onclick = pickProduct;
      renderRows(); renderTotals();
    }

    loadSessions();
    setInterval(() => { if (sessions.length) persistSessions(); }, 1500);
    window.addEventListener('beforeunload', () => { if (sessions.length) persistSessions(); });
    document.addEventListener('DOMContentLoaded', () => {
      document.querySelectorAll('[data-open-app="' + cfg.screen + '"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
      if (localStorage.getItem('fixo_screen') === cfg.screen) render();
    });

    const api = { cfg, render, rerender: () => { if (document.getElementById(cfg.mountId)) render(); }, loadDoc, addItem };
    APPS[cfg.type] = api;
    return api;
  }

  // ---------- navigation between apps ----------
  function nav(screen) {
    try { if (typeof window.showScreen === 'function') { window.showScreen(screen); return; } } catch (e) {}
    const b = document.querySelector('[data-open-app="' + screen + '"]'); if (b) b.click();
  }

  window.FIXO_DOC = { make, finYear, peekDocNo, nextDocNo, invList, allDocs, docsForItem, openInventory, totals, SAVED_KEYS, loadStore, CO, money: money, esc: esc,
    fullChain, downstreamFor, innoSummary, exportAll, importAll, loadCusts };
})();
