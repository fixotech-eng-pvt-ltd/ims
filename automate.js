// ============================================================
// Fixotech — AUTOMATE ME  (a section INSIDE ChatIQ)
// A guided, chat-style quotation builder. Admin activates it from the Admin
// Panel; it then appears as the "Automate me" section in ChatIQ.
// Flow: pick a customer with @ (new → guided Q&A; existing → full info shown) →
// add products from a scrollable photo picker (+ freight, + notes) → Preview
// for approval (editable) → wait → Proceed to final quotation (editable) →
// Download PDF / Save / Forward to Proforma. You can also paste a WhatsApp /
// email requirement and it reads it, confirms, and builds the quotation.
// No external LLM — a reliable deterministic assistant.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const uid = () => 'am' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const imgUrl = (name) => { try { return (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.guessUrl) ? FIXO_PRODUCT_IMG.guessUrl(name) : ''; } catch (e) { return ''; } };

  const CHATS = 'fixo_automate_chats', CUR = 'fixo_automate_cur', FLAG = 'fixo_automate_me';
  const load = () => { try { return JSON.parse(localStorage.getItem(CHATS) || '[]'); } catch (e) { return []; } };
  const store = (a) => { try { localStorage.setItem(CHATS, JSON.stringify(a.slice(0, 60))); } catch (e) {} };
  const isOn = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
  function setOn(v) { try { localStorage.setItem(FLAG, v ? '1' : '0'); } catch (e) {} applyGate(); }
  function applyGate() { const t = document.getElementById('tile-automate'); if (t) t.hidden = true; /* no separate tile — lives in ChatIQ */ }

  // Curated product catalogue for the scrollable picker (photos via product-images).
  const CATALOG = [
    'GI Perforated Cable Tray', 'GI Ladder Type Cable Tray', 'GI Raceway With Cover',
    'Hot Dip Perforated Cable Tray', 'Hot Dip Ladder Type Cable Tray',
    'Cable Tray - Slotted Channel', 'Cable Tray - Horizontal Bend', 'Cable Tray - Vertical Bend',
    'Cable Tray - Cross Bend', 'Cable Tray - Tee Bend', 'Cable Tray - Reducer',
    'Cable Tray - Junction Box', 'Cable Tray - Coupler Plate',
    'M08 Threaded Rod', 'M08 Anchor Fastener', 'Bolt, Nut & Washer Set'
  ];

  let chats = load();
  let curId = null;
  let clientsCache = [];

  const cur = () => chats.find(c => c.id === curId);
  function clients() { return (window.FixoDB ? window.FixoDB.listClients() : Promise.resolve([])).then(a => (clientsCache = a || [])); }
  function suggestRate(desc) {
    let orders = []; try { orders = JSON.parse(localStorage.getItem('fixo_orders') || '[]'); } catch (e) {}
    const key = (desc || '').toLowerCase().split(' ').filter(w => w.length > 3)[0] || '';
    let best = null, bd = '';
    orders.forEach(o => (o.items || []).forEach(it => { if (key && (it.desc || '').toLowerCase().includes(key) && +it.rate && (o.order_date || '') >= bd) { bd = o.order_date || ''; best = +it.rate; } }));
    return best;
  }

  // ---------- chat lifecycle ----------
  function newChat() {
    const c = { id: uid(), title: 'New quotation', clientId: null, clientName: '', newClient: {}, items: [], notes: [], step: 'customer', messages: [], createdAt: new Date().toISOString() };
    chats.unshift(c); curId = c.id; persist();
    botSay(c, 'Hello! 👋 I\'m <b>Automate Me</b>. Let\'s build a quotation.<br><br>Tap <b>@</b> below to choose a customer, or <b>＋ New customer</b> to add one. You can also <b>📩 paste a WhatsApp / email requirement</b> and I\'ll read it.');
    render();
  }
  function openChat(id) { curId = id; try { localStorage.setItem(CUR, id); } catch (e) {} render(); }
  function persist() { store(chats); }
  function botSay(c, html) { c.messages.push({ role: 'bot', html }); }
  function userSay(c, text) { c.messages.push({ role: 'user', html: esc(text) }); }
  function finishTurn(c) { persist(); appendLast(c); scrollDown(); }

  // ---------- conversation engine ----------
  async function handle(text) {
    const c = cur(); if (!c) return;
    text = (text || '').trim(); if (!text) return;
    userSay(c, text); appendMsg({ role: 'user', html: esc(text) });
    const low = text.toLowerCase();

    if (c.step === 'customer') { botSay(c, 'Please tap <b>@</b> to choose a customer, or <b>＋ New customer</b>.'); return finishTurn(c); }
    if (c.step === 'new_name') { c.newClient.company_name = text; c.title = text; c.step = 'new_gst'; botSay(c, `Great — <b>${esc(text)}</b>. Their <b>GST number</b>? (or <i>skip</i>)`); return finishTurn(c); }
    if (c.step === 'new_gst') { if (low !== 'skip') c.newClient.gstin = text.toUpperCase(); c.step = 'new_phone'; botSay(c, 'Contact <b>phone</b>? (or <i>skip</i>)'); return finishTurn(c); }
    if (c.step === 'new_phone') { if (low !== 'skip') c.newClient.phone = text; c.step = 'new_person'; botSay(c, 'Contact <b>person name</b>? (or <i>skip</i>)'); return finishTurn(c); }
    if (c.step === 'new_person') { if (low !== 'skip') c.newClient.client_name = text; c.step = 'new_addr'; botSay(c, '<b>Address</b> (city / site)? (or <i>skip</i>)'); return finishTurn(c); }
    if (c.step === 'new_addr') {
      if (low !== 'skip') c.newClient.site_address = text;
      const rec = await window.FixoDB.addClient(c.newClient);
      c.clientId = rec.id; c.clientName = rec.company_name; c.title = rec.company_name;
      botSay(c, `✅ Saved <b>${esc(rec.company_name)}</b> to your customers.`); finishTurn(c);
      return toMenu(c, true);
    }
    if (c.step === 'qty') { c.draft.qty = num(text); c.draft.unit = /mtr|meter/i.test(low) ? 'Mtr' : (/kg/i.test(low) ? 'Kg' : 'Nos'); const sug = suggestRate(c.draft.desc); c.step = 'rate'; botSay(c, `<b>Rate</b> per ${esc(c.draft.unit)} (₹)?${sug ? ` <span class="am-dim">recent ≈ ${money(sug)}</span>` : ''}`); return finishTurn(c); }
    if (c.step === 'rate') {
      c.draft.rate = num(text); c.draft.amount = Math.round(c.draft.qty * c.draft.rate * 100) / 100;
      c.items.push(c.draft); const a = c.draft; c.draft = null;
      botSay(c, `Added: <b>${esc(a.desc)}</b> — ${a.qty} ${esc(a.unit)} × ${money(a.rate)} = <b>${money(a.amount)}</b>.`); finishTurn(c);
      return toMenu(c);
    }
    if (c.step === 'freight_amt') { const amt = num(text); c.items.push({ desc: 'Freight & Forwarding', qty: 1, unit: 'Lot', rate: amt, amount: amt }); botSay(c, `Added <b>Freight & Forwarding</b> — ${money(amt)}.`); finishTurn(c); return toMenu(c); }
    if (c.step === 'note_text') { c.notes.push(text); botSay(c, `📝 Noted: “${esc(text)}”. It'll appear on the quotation.`); finishTurn(c); return toMenu(c); }
    if (c.step === 'custom_prod') { c.draft = { desc: text }; c.step = 'qty'; botSay(c, `How many <b>${esc(text)}</b>? Enter the <b>quantity</b> (add unit if you like, e.g. <i>120 Mtr</i>).`); return finishTurn(c); }
    if (c.step === 'confirm_req') { /* handled by buttons */ botSay(c, 'Use the buttons above to confirm the requirement.'); return finishTurn(c); }

    // free text while in menu → treat as a product name
    if (c.step === 'menu' && c.clientId) { c.draft = { desc: text }; c.step = 'qty'; botSay(c, `How many <b>${esc(text)}</b>? Enter the <b>quantity</b>.`); return finishTurn(c); }
    botSay(c, 'Use the options above, or tap ✓ <b>Preview for approval</b> when ready.'); return finishTurn(c);
  }

  // ---------- customer selection ----------
  async function pickCustomer(client) {
    const c = cur(); if (!c) return;
    c.clientId = client.id; c.clientName = client.company_name || client.client_name; c.title = c.clientName; c.step = 'menu';
    userSay(c, '@' + c.clientName); appendMsg({ role: 'user', html: '@' + esc(c.clientName) });
    // full info card so the preparer knows exactly who this is
    let recent = '';
    try { const os = await window.FixoDB.listOrders(client.id); if (os && os.length) { const t = os.reduce((s, o) => s + (+o.total_cost || 0), 0); recent = `<div class="am-info-row"><span>📦</span> ${os.length} past order(s) · ${money(t)} total · last ${esc((os[0].order_date || '').slice(0, 10))}</div>`; } } catch (e) {}
    const row = (ic, label, val) => val ? `<div class="am-info-row"><span>${ic}</span> <b>${esc(label)}:</b> ${esc(val)}</div>` : '';
    botSay(c, `<div class="am-info"><div class="am-info-h">👤 ${esc(c.clientName)}</div>
      ${row('🧾', 'GST', client.gstin)}${row('📞', 'Phone', client.phone)}${row('✉', 'Email', client.email)}
      ${row('🙋', 'Contact', client.client_name)}${row('🏢', 'Address', client.site_address || client.billing_address)}
      ${row('📍', 'State', client.state)}${recent}</div>`);
    finishTurn(c); renderSidebar();
    toMenu(c, true);
  }
  function startNewCustomer() {
    const c = cur(); if (!c) return;
    c.newClient = {}; c.step = 'new_name';
    userSay(c, '＋ New customer'); appendMsg({ role: 'user', html: '＋ New customer' });
    botSay(c, 'Let\'s add a new customer. What is the <b>company / business name</b>?');
    finishTurn(c);
  }

  // ---------- the product / options menu (photo picker) ----------
  function toMenu(c, intro) {
    c.step = 'menu';
    const cards = CATALOG.map(n => { const u = imgUrl(n); return `<button class="am-pick-card" data-prod="${esc(n)}">${u ? `<img src="${u}" onerror="this.style.display='none'">` : '<span class="am-pick-ic">📦</span>'}<span>${esc(n)}</span></button>`; }).join('');
    const html = `<div class="am-menu">
      ${intro ? '<div class="am-menu-lab">Add products — scroll and tap. Then add freight/details, or preview.</div>' : '<div class="am-menu-lab">Add another product, freight, a detail — or preview for approval.</div>'}
      <div class="am-pick-row">${cards}<button class="am-pick-card am-pick-custom" data-act="custom"><span class="am-pick-ic">＋</span><span>Custom</span></button></div>
      <div class="am-menu-btns">
        <button class="fx-btn" data-act="freight">🚚 Freight</button>
        <button class="fx-btn" data-act="note">📝 Add detail</button>
        <button class="fx-btn fx-btn-go" data-act="preview">✓ Preview for approval</button>
      </div>
      ${c.items.length ? `<div class="am-menu-sofar">So far: ${c.items.length} line(s) · ${money(c.items.reduce((s, it) => s + (it.amount || 0), 0))}</div>` : ''}
    </div>`;
    botSay(c, html); finishTurn(c);
  }
  function selectProduct(name) {
    const c = cur(); if (!c) return;
    c.draft = { desc: name }; c.step = 'qty';
    userSay(c, name); appendMsg({ role: 'user', html: esc(name) });
    const sug = suggestRate(name);
    botSay(c, `How many <b>${esc(name)}</b>? Enter the <b>quantity</b>.${sug ? ` <span class="am-dim">(recent rate ≈ ${money(sug)})</span>` : ''}`);
    finishTurn(c);
  }

  // ---------- requirement paste (WhatsApp / email) ----------
  function pasteRequirement() {
    const c = cur(); if (!c) return;
    const m = modal(`<h3>📩 Paste requirement (WhatsApp / email)</h3>
      <div class="fx-modal-body"><p class="fx-note">Paste the customer's message. I'll read it and list the products for you to confirm.</p>
      <textarea id="am-req" class="fx-in" rows="7" placeholder="e.g. Need 500 nos GI perforated cable tray 300x50, 200 mtr ladder tray, 100 bolts..."></textarea></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="am-req-x">Cancel</button><button class="fx-btn fx-btn-go" id="am-req-ok">Read it</button></div>`);
    m.querySelector('#am-req-x').onclick = () => closeModal(m);
    m.querySelector('#am-req-ok').onclick = () => { const t = m.querySelector('#am-req').value; closeModal(m); ingestRequirement(t); };
  }
  function parseRequirement(text) {
    const items = [];
    (text || '').split(/\n|;|,|•|\*/).forEach(line => {
      line = line.trim(); if (line.length < 3) return;
      // qty before or after a product phrase
      let m = line.match(/(\d[\d,\.]*)\s*(nos|no|pcs|mtr|mtrs|meter|meters|m|kg|kgs|sets?|units?)?\s*(?:of\s+|x\s+|-\s*)?(.+)/i);
      if (m && /[a-z]{3,}/i.test(m[3])) { const qty = num(m[1]); const unit = /mtr|meter|\bm\b/i.test(m[2] || '') ? 'Mtr' : (/kg/i.test(m[2] || '') ? 'Kg' : 'Nos'); items.push({ desc: m[3].replace(/[.:-]+$/, '').trim(), qty: qty || 1, unit, rate: suggestRate(m[3]) || 0 }); return; }
      m = line.match(/(.+?)[\s:-]+(\d[\d,\.]*)\s*(nos|pcs|mtr|mtrs|meter|m|kg|sets?)?$/i);
      if (m && /[a-z]{3,}/i.test(m[1])) { const unit = /mtr|meter|\bm\b/i.test(m[3] || '') ? 'Mtr' : (/kg/i.test(m[3] || '') ? 'Kg' : 'Nos'); items.push({ desc: m[1].trim(), qty: num(m[2]) || 1, unit, rate: suggestRate(m[1]) || 0 }); }
    });
    return items;
  }
  function ingestRequirement(text) {
    const c = cur(); if (!c || !(text || '').trim()) return;
    userSay(c, '📩 Requirement pasted'); appendMsg({ role: 'user', html: '📩 Requirement pasted' });
    const parsed = parseRequirement(text);
    if (!parsed.length) { botSay(c, 'I couldn\'t spot clear line items in that. You can add products from the picker below.'); finishTurn(c); return toMenu(c); }
    c.pendingReq = parsed; c.step = 'confirm_req';
    const rows = parsed.map((p, i) => `<tr><td>${i + 1}</td><td>${esc(p.desc)}</td><td class="am-num">${p.qty} ${esc(p.unit)}</td><td class="am-num">${p.rate ? money(p.rate) : '—'}</td></tr>`).join('');
    botSay(c, `<div class="am-doc"><div class="am-doc-h">📩 I read this requirement</div>
      <div class="am-doc-sub">Is this correct? Rates shown are recent suggestions (edit later).</div>
      <table class="am-doc-tbl"><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Rate</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="am-doc-btns"><button class="fx-btn" data-act="req-ignore">✗ Ignore</button><button class="fx-btn fx-btn-go" data-act="req-use">✓ Yes, add these</button></div></div>`);
    finishTurn(c);
  }

  // ---------- approval (editable) ----------
  function prepareApproval() {
    const c = cur(); if (!c) return;
    if (!c.items.length) { botSay(c, 'No products yet — add at least one from the picker.'); finishTurn(c); return toMenu(c); }
    c.messages.push({ role: 'bot', html: '<span class="am-prep">⚙️ Preparing the approval document<span class="am-dots"><i>.</i><i>.</i><i>.</i></span></span>' });
    appendLast(c); scrollDown(); persist();
    setTimeout(() => { c.messages.pop(); c.step = 'approval'; c.messages.push({ role: 'bot', html: approvalHtml(c) }); persist(); renderMessages(); scrollDown(); }, 1300);
  }
  function approvalHtml(c) {
    const rows = c.items.map((it, i) => `<tr>
      <td>${i + 1}</td><td contenteditable="true" data-f="desc">${esc(it.desc)}</td>
      <td contenteditable="true" data-f="qty" class="am-num">${it.qty}</td>
      <td contenteditable="true" data-f="unit">${esc(it.unit)}</td>
      <td contenteditable="true" data-f="rate" class="am-num">${it.rate}</td>
      <td class="am-num am-amt">${money(it.amount)}</td></tr>`).join('');
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0);
    return `<div class="am-doc" data-doc="approval">
      <div class="am-doc-h">📝 APPROVAL DRAFT — ${esc(c.clientName || 'Customer')}</div>
      <div class="am-doc-sub">This is your editor — tap any cell to change it. Add more from the menu if needed. When you're happy, proceed. (No rush — nothing is sent yet.)</div>
      <table class="am-doc-tbl"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody><tfoot><tr><td colspan="5">Subtotal</td><td class="am-num"><b>${money(sub)}</b></td></tr></tfoot></table>
      ${c.notes.length ? `<div class="am-doc-notes"><b>Notes:</b> ${c.notes.map(esc).join(' · ')}</div>` : ''}
      <div class="am-doc-btns"><button class="fx-btn" data-act="recalc">↻ Update totals</button><button class="fx-btn" data-act="addmore">＋ Add more</button><button class="fx-btn fx-btn-go" data-act="tofinal">Proceed to final quotation →</button></div>
    </div>`;
  }
  function readDoc(scope) {
    const c = cur(); if (!c || !scope) return;
    const rows = [...scope.querySelectorAll('tbody tr')];
    c.items = rows.map(tr => { const g = f => (tr.querySelector('[data-f="' + f + '"]') || {}).textContent || ''; const qty = num(g('qty')), rate = num(g('rate')); return { desc: g('desc').trim(), qty, unit: (g('unit').trim() || 'Nos'), rate, amount: Math.round(qty * rate * 100) / 100 }; }).filter(it => it.desc);
    persist();
  }

  // ---------- final quotation (editable) ----------
  function makeQuotation() {
    const c = cur(); if (!c) return;
    c.step = 'quotation';
    c.messages.push({ role: 'bot', html: '<span class="am-prep">🧾 Preparing the final quotation<span class="am-dots"><i>.</i><i>.</i><i>.</i></span></span>' });
    appendLast(c); scrollDown(); persist();
    setTimeout(() => { c.messages.pop(); c.messages.push({ role: 'bot', html: quotationHtml(c) }); persist(); renderMessages(); scrollDown(); }, 1200);
  }
  function quotationHtml(c) {
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0), gst = Math.round(sub * 0.18 * 100) / 100, total = sub + gst;
    const rows = c.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.desc)}</td><td class="am-num">${it.qty} ${esc(it.unit)}</td><td class="am-num">${money(it.rate)}</td><td class="am-num">${money(it.amount)}</td></tr>`).join('');
    return `<div class="am-doc" data-doc="quotation">
      <div class="am-doc-h">🧾 FINAL QUOTATION — ${esc(c.clientName || 'Customer')}</div>
      <div class="am-doc-sub">Edit any cell if needed, then download / save / forward.</div>
      <div class="am-quote-body" contenteditable="true">
        <table class="am-doc-tbl"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr><td colspan="4">Subtotal</td><td class="am-num">${money(sub)}</td></tr>
            <tr><td colspan="4">GST 18%</td><td class="am-num">${money(gst)}</td></tr>
            <tr class="am-total"><td colspan="4"><b>Total</b></td><td class="am-num"><b>${money(total)}</b></td></tr></tfoot></table>
        ${c.notes.length ? `<p><b>Notes:</b> ${c.notes.map(esc).join(' · ')}</p>` : ''}
      </div>
      <div class="am-doc-btns"><button class="fx-btn" data-act="pdf">⬇ Download PDF</button><button class="fx-btn" data-act="save">💾 Save order</button><button class="fx-btn fx-btn-go" data-act="forward">→ Forward to Proforma</button></div>
    </div>`;
  }
  function readQuote(doc) {
    const c = cur(); if (!c || !doc) return;
    const rows = [...doc.querySelectorAll('tbody tr')]; if (!rows.length) return;
    const parsed = rows.map(tr => { const td = tr.querySelectorAll('td'); const desc = (td[1] ? td[1].textContent : '').trim(); const qu = td[2] ? td[2].textContent : ''; const qty = num(qu); const unit = qu.replace(/[0-9.,\s]/g, '') || 'Nos'; const rate = num(td[3] ? td[3].textContent : ''); return { desc, qty, unit, rate, amount: Math.round(qty * rate * 100) / 100 }; }).filter(it => it.desc);
    if (parsed.length) { c.items = parsed; persist(); }
  }
  const outItems = (c) => c.items.map(it => ({ desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount }));

  function printQuotation(c) {
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0), gst = Math.round(sub * 0.18 * 100) / 100, total = sub + gst;
    const logo = (window.FIXO_FACTORY && FIXO_FACTORY.LOGO) ? FIXO_FACTORY.LOGO() : '';
    const rows = c.items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.desc)}</td><td class="c">${it.qty} ${esc(it.unit)}</td><td class="r">${money(it.rate)}</td><td class="r">${money(it.amount)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotation - ${esc(c.clientName)}</title><style>
      *{box-sizing:border-box}@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px}
      .hd{display:flex;align-items:center;gap:12px;border-bottom:2px solid #111;padding-bottom:8px}.hd img{height:46px}h1{font-size:20px;margin:0}
      .title{text-align:center;font-size:16px;font-weight:bold;letter-spacing:1px;margin:14px 0}table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #999;padding:6px 8px}.c{text-align:center}.r{text-align:right}th{background:#eef}tfoot td{font-weight:bold}</style></head><body>
      <div class="hd">${logo ? `<img src="${logo}">` : ''}<div><h1>FIXOTECH ENGINEERING</h1><div>Cable Trays &amp; Support Systems</div></div></div>
      <div class="title">QUOTATION</div><div><b>To:</b> ${esc(c.clientName || '')}<br><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
      <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" class="r">Subtotal</td><td class="r">${money(sub)}</td></tr><tr><td colspan="4" class="r">GST 18%</td><td class="r">${money(gst)}</td></tr>
        <tr><td colspan="4" class="r">Total</td><td class="r">${money(total)}</td></tr></tfoot></table>
      ${c.notes.length ? '<p><b>Notes:</b> ' + c.notes.map(esc).join(' · ') + '</p>' : ''}
      <p style="margin-top:24px">For FIXOTECH ENGINEERING</p></body></html>`;
    const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to download the PDF'); return; }
    w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
  }
  async function saveOrder(c) {
    if (!c.clientId) { toast('No customer selected'); return; }
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0);
    await window.FixoDB.addOrder({ client_id: c.clientId, order_date: new Date().toISOString().slice(0, 10), quote_no: 'AM-' + Date.now().toString().slice(-6), items: outItems(c), total_cost: Math.round(sub), status: 'quoted', source: 'automate' });
    try { if (window.FIXO_LOG) FIXO_LOG.activity('automate', 'quotation', { customer: c.clientName, lines: c.items.length, value: Math.round(sub) }); } catch (e) {}
    botSay(c, `💾 Saved to <b>${esc(c.clientName)}</b>'s order history.`); finishTurn(c);
  }
  function forwardProforma(c) {
    if (window.FIXO_PF && FIXO_PF.loadFromQuote) { FIXO_PF.loadFromQuote(outItems(c), c.clientName, {}); if (window.showScreen) showScreen('screen-proforma'); toast('Forwarded to Proforma Invoice'); }
    else toast('Proforma not ready');
  }

  // ---------- rendering (inside ChatIQ / #chatiq-app) ----------
  function hostEl() { return document.getElementById('chatiq-app'); }
  function backToAsk() { if (window.FIXO_CHATIQ && FIXO_CHATIQ.showAsk) FIXO_CHATIQ.showAsk(); else if (window.showScreen) showScreen('screen-home'); }

  function open() {
    const host = hostEl(); if (!host) return;
    host.dataset.built = '';   // let ChatIQ rebuild when we go back
    if (!isOn()) {
      host.innerHTML = `<div class="am-wrap am-off"><button class="am-x" id="am-close" title="Close">✕</button>
        <div class="am-off-box"><div class="am-off-ic">🤖</div><h1>Automate Me is turned off</h1>
        <p class="am-dim">An administrator can activate it from the Admin Panel → Automate Me.</p>
        <button class="fx-btn fx-btn-go" id="am-back2">← Back to ChatIQ</button></div></div>`;
      host.querySelector('#am-close').onclick = backToAsk;
      host.querySelector('#am-back2').onclick = backToAsk;
      return;
    }
    if (!chats.length) { newChat(); return; }
    if (!curId || !cur()) curId = chats[0].id;
    render();
  }

  function render() {
    const host = hostEl(); if (!host || !isOn()) { if (host && !isOn()) open(); return; }
    host.innerHTML = `
      <div class="am-wrap ciq">
        <aside class="ciq-side">
          <div class="ciq-side-top"><button class="ciq-back" id="am-back" title="Back to ChatIQ">←</button><div class="ciq-brand">Automate <b>Me</b></div></div>
          <button class="ciq-new" id="am-new">＋ New quotation</button>
          <div class="ciq-side-lab">Conversations</div>
          <div class="ciq-examples" id="am-chats"></div>
        </aside>
        <main class="ciq-main">
          <div class="ciq-top"><span class="ciq-model">🤖 Automate Me · <span id="am-title"></span></span><button class="am-x" id="am-close" title="Close">✕</button></div>
          <div class="ciq-scroll" id="am-scroll"></div>
          <div class="ciq-composer">
            <div class="am-at-dd" id="am-at-dd" hidden></div>
            <div class="ciq-inputwrap">
              <button id="am-at" title="Choose a customer">@</button>
              <button id="am-req" title="Paste a WhatsApp / email requirement">📩</button>
              <textarea id="am-input" rows="1" placeholder="Type here…  (tap @ for customer, 📩 to paste a requirement)"></textarea>
              <button id="am-send">➤</button>
            </div>
            <div class="ciq-foot">Automate Me builds quotations from your conversation. Review before sending.</div>
          </div>
        </main>
      </div>`;
    renderSidebar(); renderMessages();
    const inp = host.querySelector('#am-input'), send = host.querySelector('#am-send');
    const doSend = () => { const t = inp.value; inp.value = ''; if (t.trim()) handle(t); };
    send.onclick = doSend;
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };
    inp.oninput = () => onAtType(inp);
    host.querySelector('#am-at').onclick = () => { buildAt(''); document.getElementById('am-at-dd').hidden = false; };
    host.querySelector('#am-req').onclick = () => pasteRequirement();
    host.querySelector('#am-new').onclick = () => newChat();
    host.querySelector('#am-back').onclick = backToAsk;
    host.querySelector('#am-close').onclick = backToAsk;
  }
  function renderSidebar() {
    const box = document.getElementById('am-chats'); if (!box) return;
    box.innerHTML = chats.map(c => `<button class="ciq-eg ${c.id === curId ? 'active' : ''}" data-chat="${c.id}">💬 ${esc(c.title || 'New quotation')}</button>`).join('') || '<div class="ciq-side-empty2">No conversations yet</div>';
    box.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => openChat(b.dataset.chat));
    const t = document.getElementById('am-title'); if (t) t.textContent = (cur() || {}).title || 'New quotation';
  }
  const msgHtml = (m) => `<div class="ciq-msg ${m.role}"><div class="ciq-avatar">${m.role === 'bot' ? 'AI' : '🙂'}</div><div class="ciq-bubble">${m.html}</div></div>`;
  function renderMessages() { const sc = document.getElementById('am-scroll'); const c = cur(); if (!sc || !c) return; sc.innerHTML = c.messages.map(msgHtml).join(''); wire(sc); scrollDown(); }
  function appendMsg(m) { const sc = document.getElementById('am-scroll'); if (!sc) return; sc.insertAdjacentHTML('beforeend', msgHtml(m)); wire(sc); }
  function appendLast(c) { const sc = document.getElementById('am-scroll'); if (!sc || !c.messages.length) return; sc.insertAdjacentHTML('beforeend', msgHtml(c.messages[c.messages.length - 1])); wire(sc); }
  function scrollDown() { const sc = document.getElementById('am-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }

  function wire(scope) {
    scope.querySelectorAll('[data-prod]').forEach(b => { if (b.__w) return; b.__w = 1; b.onclick = () => selectProduct(b.dataset.prod); });
    scope.querySelectorAll('[data-act]').forEach(b => {
      if (b.__w) return; b.__w = 1;
      b.onclick = () => {
        const c = cur(); if (!c) return; const doc = b.closest('.am-doc'); const act = b.dataset.act;
        if (act === 'custom') { c.step = 'custom_prod'; botSay(c, 'Type the <b>custom product name</b>.'); finishTurn(c); }
        else if (act === 'freight') { c.step = 'freight_amt'; botSay(c, 'Enter the <b>freight / forwarding amount</b> (₹).'); finishTurn(c); }
        else if (act === 'note') { c.step = 'note_text'; botSay(c, 'Type the <b>detail / note</b> to add to the quotation (e.g. delivery time, payment terms).'); finishTurn(c); }
        else if (act === 'preview') prepareApproval();
        else if (act === 'addmore') toMenu(c);
        else if (act === 'recalc') { readDoc(doc); renderMessages(); }
        else if (act === 'tofinal') { readDoc(doc); makeQuotation(); }
        else if (act === 'pdf') { readQuote(doc); printQuotation(c); }
        else if (act === 'save') { readQuote(doc); saveOrder(c); }
        else if (act === 'forward') { readQuote(doc); forwardProforma(c); }
        else if (act === 'req-use') { (c.pendingReq || []).forEach(p => c.items.push({ desc: p.desc, qty: p.qty, unit: p.unit, rate: p.rate, amount: Math.round(p.qty * p.rate * 100) / 100 })); c.pendingReq = null; botSay(c, '✓ Added. Set/adjust rates in the approval step. Add more or preview.'); finishTurn(c); toMenu(c); }
        else if (act === 'req-ignore') { c.pendingReq = null; botSay(c, 'Okay, ignored. Add products from the picker.'); finishTurn(c); toMenu(c); }
      };
    });
  }

  // ---------- @ customer picker ----------
  function onAtType(inp) { const v = inp.value; const at = v.lastIndexOf('@'); const dd = document.getElementById('am-at-dd'); if (!dd) return; if (at >= 0 && (at === 0 || /\s/.test(v[at - 1]))) { buildAt(v.slice(at + 1)); dd.hidden = false; } else dd.hidden = true; }
  async function buildAt(q) {
    const dd = document.getElementById('am-at-dd'); if (!dd) return;
    if (!clientsCache.length) await clients();
    const list = (window.FixoDB.searchClients ? window.FixoDB.searchClients(q, clientsCache) : clientsCache).slice(0, 8);
    dd.innerHTML = `<button class="am-at-item am-at-new" data-newc="1">＋ New customer</button>` + list.map(c => `<button class="am-at-item" data-cid="${c.id}"><b>${esc(c.company_name || c.client_name)}</b>${c.gstin ? '<span>' + esc(c.gstin) + '</span>' : ''}</button>`).join('');
    dd.querySelector('[data-newc]').onclick = () => { dd.hidden = true; clearAt(); startNewCustomer(); };
    dd.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { dd.hidden = true; clearAt(); const cl = clientsCache.find(x => x.id === b.dataset.cid); if (cl) pickCustomer(cl); });
  }
  function clearAt() { const inp = document.getElementById('am-input'); if (!inp) return; const v = inp.value; const at = v.lastIndexOf('@'); if (at >= 0) inp.value = v.slice(0, at); }

  function modal(inner) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = `<div class="fx-modal">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }
  function closeModal(m) { const o = m.classList && m.classList.contains('fx-modal-overlay') ? m : m.closest('.fx-modal-overlay'); if (o) o.remove(); }

  document.addEventListener('DOMContentLoaded', () => { applyGate(); try { curId = localStorage.getItem(CUR); } catch (e) {} });
  window.addEventListener('fixo:sync', applyGate);

  window.FIXO_AUTOMATE = { open, isOn, setOn, applyGate };
})();
