// ============================================================
// Fixotech — AUTOMATE ME (AI-style conversational quotation builder)
// Admin activates it from the Admin Panel; then an "Automate Me" tile appears
// on the Office home. You chat like ChatGPT: pick a customer with @ (or add a
// new one and answer a few questions), add products one by one, and it prepares
// an editable Approval document, then a Quotation you can edit, download as PDF,
// save, and forward to the Proforma Invoice.
//
// No external AI — it's a reliable, guided assistant (deterministic Q&A) that
// reuses the existing customer, order and proforma machinery.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const uid = () => 'am' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));

  const CHATS = 'fixo_automate_chats', CUR = 'fixo_automate_cur', FLAG = 'fixo_automate_me';
  const load = () => { try { return JSON.parse(localStorage.getItem(CHATS) || '[]'); } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(CHATS, JSON.stringify(a.slice(0, 60))); } catch (e) {} };
  const isOn = () => { try { return localStorage.getItem(FLAG) === '1'; } catch (e) { return false; } };
  function setOn(v) { try { localStorage.setItem(FLAG, v ? '1' : '0'); } catch (e) {} applyGate(); }

  let chats = load();
  let curId = null;
  let clientsCache = [];

  // Show/hide the office tile based on the admin flag.
  function applyGate() { const t = document.getElementById('tile-automate'); if (t) t.hidden = !isOn(); }

  // ---------- data helpers ----------
  async function clients() { try { clientsCache = await window.FixoDB.listClients(); } catch (e) {} return clientsCache; }
  function suggestRate(desc) {
    // recent quoted rate for a similar product from the local order cache
    let orders = []; try { orders = JSON.parse(localStorage.getItem('fixo_orders') || '[]'); } catch (e) {}
    const d = desc.toLowerCase(); let best = null, bestDate = '';
    orders.forEach(o => (o.items || []).forEach(it => {
      if (it.desc && it.desc.toLowerCase().includes(d.split(' ')[0]) && +it.rate) {
        if ((o.order_date || '') >= bestDate) { bestDate = o.order_date || ''; best = +it.rate; }
      }
    }));
    return best;
  }

  // ---------- chat model ----------
  const cur = () => chats.find(c => c.id === curId);
  function newChat() {
    const c = { id: uid(), title: 'New quotation', clientId: null, clientName: '', isNew: false, newClient: {}, items: [], step: 'customer', messages: [], createdAt: new Date().toISOString() };
    chats.unshift(c); curId = c.id; save(chats);
    botSay(c, 'Hello! 👋 I\'m your <b>Automate Me</b> assistant. Let\'s prepare a quotation.<br><br>Type <b>@</b> to pick a customer, or choose <b>＋ New customer</b> to add one.');
    persist(); render();
  }
  function openChat(id) { curId = id; try { localStorage.setItem(CUR, id); } catch (e) {} render(); }
  function persist() { save(chats); }

  function botSay(c, html) { c.messages.push({ role: 'bot', html }); }
  function userSay(c, text) { c.messages.push({ role: 'user', html: esc(text) }); }

  // ---------- the conversation engine ----------
  async function handle(text) {
    const c = cur(); if (!c) return;
    text = (text || '').trim(); if (!text) return;
    userSay(c, text); appendMsg({ role: 'user', html: esc(text) });
    const low = text.toLowerCase();

    if (c.step === 'customer') {
      botSay(c, 'Please tap <b>@</b> below to choose a customer, or <b>＋ New customer</b>.'); return finish(c);
    }
    if (c.step === 'new_name') { c.newClient.company_name = text; c.title = text; c.step = 'new_gst'; botSay(c, `Great — <b>${esc(text)}</b>. What is their <b>GST number</b>? (or type <i>skip</i>)`); return finish(c); }
    if (c.step === 'new_gst') { if (low !== 'skip') c.newClient.gstin = text.toUpperCase(); c.step = 'new_phone'; botSay(c, 'Contact <b>phone number</b>? (or <i>skip</i>)'); return finish(c); }
    if (c.step === 'new_phone') { if (low !== 'skip') c.newClient.phone = text; c.step = 'new_person'; botSay(c, 'Contact <b>person name</b>? (or <i>skip</i>)'); return finish(c); }
    if (c.step === 'new_person') { if (low !== 'skip') c.newClient.client_name = text; c.step = 'new_addr'; botSay(c, '<b>Address</b> (city / site)? (or <i>skip</i>)'); return finish(c); }
    if (c.step === 'new_addr') {
      if (low !== 'skip') c.newClient.site_address = text;
      const rec = await window.FixoDB.addClient(c.newClient);
      c.clientId = rec.id; c.clientName = rec.company_name; c.title = rec.company_name;
      c.step = 'product';
      botSay(c, `✅ Saved <b>${esc(rec.company_name)}</b> to your customers.<br><br>Now, what <b>product</b> would you like to quote? (e.g. <i>GI Perforated Cable Tray 300x50</i>)`);
      return finish(c);
    }
    if (c.step === 'product') {
      c.draft = { desc: text }; c.step = 'qty';
      botSay(c, `How many <b>${esc(text)}</b>? Enter the <b>quantity</b> (and unit if you like, e.g. <i>500 Nos</i> or <i>120 Mtr</i>).`);
      return finish(c);
    }
    if (c.step === 'qty') {
      c.draft.qty = num(text); c.draft.unit = /mtr|meter|mtrs/i.test(low) ? 'Mtr' : (/kg/i.test(low) ? 'Kg' : 'Nos');
      const sug = suggestRate(c.draft.desc);
      c.step = 'rate';
      botSay(c, `What <b>rate</b> per ${esc(c.draft.unit)} (₹)?${sug ? ` <span class="am-dim">Recent quoted rate was about <b>${money(sug)}</b> — type it or a new one.</span>` : ''}`);
      return finish(c);
    }
    if (c.step === 'rate') {
      c.draft.rate = num(text);
      c.draft.amount = Math.round(c.draft.qty * c.draft.rate * 100) / 100;
      c.items.push(c.draft); const added = c.draft; c.draft = null; c.step = 'more';
      botSay(c, `Added: <b>${esc(added.desc)}</b> — ${added.qty} ${esc(added.unit)} × ${money(added.rate)} = <b>${money(added.amount)}</b>.<br><br>Add <b>another product</b>? Type its name, or type <b>done</b> to prepare the quotation.`);
      return finish(c);
    }
    if (c.step === 'more') {
      if (/^(done|finish|no|that'?s all|prepare|proceed)$/i.test(low) || low === 'done') { return prepareApproval(c); }
      c.draft = { desc: text }; c.step = 'qty';
      botSay(c, `How many <b>${esc(text)}</b>? Enter the <b>quantity</b>.`);
      return finish(c);
    }
    // after docs are shown, allow "quotation"/"save" via text too
    if (/quotation|proceed|final/i.test(low) && c.step === 'approved') { return makeQuotation(c); }
    botSay(c, 'You can use the buttons above, or type <b>done</b> when ready.'); return finish(c);
  }

  function finish(c) { persist(); appendLast(c); scrollDown(); }

  // ---------- customer selection (from the @ picker) ----------
  function pickCustomer(client) {
    const c = cur(); if (!c) return;
    c.clientId = client.id; c.clientName = client.company_name || client.client_name; c.title = c.clientName; c.isNew = false; c.step = 'product';
    userSay(c, '@' + c.clientName); appendMsg({ role: 'user', html: '@' + esc(c.clientName) });
    const info = [client.gstin ? 'GST ' + client.gstin : '', client.phone ? '📞 ' + client.phone : '', client.client_name ? '👤 ' + client.client_name : ''].filter(Boolean).join(' · ');
    botSay(c, `Selected <b>${esc(c.clientName)}</b>.${info ? '<br><span class="am-dim">' + esc(info) + '</span>' : ''}<br><br>What <b>product</b> would you like to quote?`);
    finish(c); renderSidebar();
  }
  function startNewCustomer() {
    const c = cur(); if (!c) return;
    c.isNew = true; c.newClient = {}; c.step = 'new_name';
    userSay(c, '＋ New customer'); appendMsg({ role: 'user', html: '＋ New customer' });
    botSay(c, 'Let\'s add a new customer. What is the <b>company / business name</b>?');
    finish(c);
  }

  // ---------- Approval document (editable) ----------
  function prepareApproval(c) {
    if (!c.items.length) { botSay(c, 'No products added yet. Type a product name to begin.'); return finish(c); }
    // animated "preparing"
    const anim = { role: 'bot', html: '<span class="am-prep">⚙️ Preparing your approval document<span class="am-dots"><i>.</i><i>.</i><i>.</i></span></span>' };
    c.messages.push(anim); appendLast(c); scrollDown(); persist();
    setTimeout(() => {
      c.messages.pop();                 // remove the animation message
      c.step = 'approval';
      c.messages.push({ role: 'bot', html: approvalHtml(c) });
      persist(); renderMessages(); scrollDown();
    }, 1400);
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
      <div class="am-doc-h">📝 APPROVAL DOCUMENT — ${esc(c.clientName || 'Customer')}</div>
      <div class="am-doc-sub">Check the details below. Tap any cell to edit, then Approve.</div>
      <table class="am-doc-tbl"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th>Rate</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
        <tfoot><tr><td colspan="5">Subtotal</td><td class="am-num"><b>${money(sub)}</b></td></tr></tfoot></table>
      <div class="am-doc-btns"><button class="fx-btn" data-act="recalc">↻ Update totals</button><button class="fx-btn fx-btn-go" data-act="approve">✓ Approve &amp; make quotation</button></div>
    </div>`;
  }

  // read edited cells back into c.items
  function readDoc(scope) {
    const c = cur(); if (!c) return;
    const rows = [...scope.querySelectorAll('tbody tr')];
    c.items = rows.map(tr => {
      const g = (f) => (tr.querySelector('[data-f="' + f + '"]') || {}).textContent || '';
      const qty = num(g('qty')), rate = num(g('rate'));
      return { desc: g('desc').trim(), qty, unit: (g('unit').trim() || 'Nos'), rate, amount: Math.round(qty * rate * 100) / 100 };
    }).filter(it => it.desc);
    persist();
  }

  // ---------- Quotation (editable) ----------
  function makeQuotation(c) {
    c.step = 'quotation';
    c.messages.push({ role: 'bot', html: '<span class="am-prep">🧾 Generating the quotation<span class="am-dots"><i>.</i><i>.</i><i>.</i></span></span>' });
    appendLast(c); scrollDown(); persist();
    setTimeout(() => { c.messages.pop(); c.messages.push({ role: 'bot', html: quotationHtml(c) }); persist(); renderMessages(); scrollDown(); }, 1200);
  }
  function quotationHtml(c) {
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0);
    const gst = Math.round(sub * 0.18 * 100) / 100, total = sub + gst;
    const rows = c.items.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.desc)}</td><td class="am-num">${it.qty} ${esc(it.unit)}</td><td class="am-num">${money(it.rate)}</td><td class="am-num">${money(it.amount)}</td></tr>`).join('');
    return `<div class="am-doc" data-doc="quotation" contenteditable="false">
      <div class="am-doc-h">🧾 QUOTATION — ${esc(c.clientName || 'Customer')}</div>
      <div class="am-doc-sub">Ready. You can edit any cell, then download / save / forward.</div>
      <div contenteditable="true" class="am-quote-body">
        <table class="am-doc-tbl"><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
          <tbody>${rows}</tbody>
          <tfoot>
            <tr><td colspan="4">Subtotal</td><td class="am-num">${money(sub)}</td></tr>
            <tr><td colspan="4">GST 18%</td><td class="am-num">${money(gst)}</td></tr>
            <tr class="am-total"><td colspan="4"><b>Total</b></td><td class="am-num"><b>${money(total)}</b></td></tr>
          </tfoot></table>
      </div>
      <div class="am-doc-btns">
        <button class="fx-btn" data-act="pdf">⬇ Download PDF</button>
        <button class="fx-btn" data-act="save">💾 Save order</button>
        <button class="fx-btn fx-btn-go" data-act="forward">→ Forward to Proforma</button>
      </div>
    </div>`;
  }

  function currentItems(c) { return c.items.map(it => ({ desc: it.desc, unit: it.unit, qty: it.qty, rate: it.rate, amount: it.amount })); }

  function printQuotation(c) {
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0), gst = Math.round(sub * 0.18 * 100) / 100, total = sub + gst;
    const logo = (window.FIXO_FACTORY && FIXO_FACTORY.LOGO) ? FIXO_FACTORY.LOGO() : '';
    const rows = c.items.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.desc)}</td><td class="c">${it.qty} ${esc(it.unit)}</td><td class="r">${money(it.rate)}</td><td class="r">${money(it.amount)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Quotation - ${esc(c.clientName)}</title><style>
      *{box-sizing:border-box}@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#111;font-size:12px}
      .hd{display:flex;align-items:center;gap:12px;border-bottom:2px solid #111;padding-bottom:8px}.hd img{height:46px}
      h1{font-size:20px;margin:0}.title{text-align:center;font-size:16px;font-weight:bold;letter-spacing:1px;margin:14px 0}
      table{width:100%;border-collapse:collapse;margin-top:8px}th,td{border:1px solid #999;padding:6px 8px}.c{text-align:center}.r{text-align:right}
      th{background:#eef}tfoot td{font-weight:bold}.meta{margin-top:8px}</style></head><body>
      <div class="hd">${logo ? `<img src="${logo}">` : ''}<div><h1>FIXOTECH ENGINEERING</h1><div>Cable Trays &amp; Support Systems</div></div></div>
      <div class="title">QUOTATION</div>
      <div class="meta"><b>To:</b> ${esc(c.clientName || '')}<br><b>Date:</b> ${new Date().toLocaleDateString('en-IN')}</div>
      <table><thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>${rows}</tbody>
        <tfoot><tr><td colspan="4" class="r">Subtotal</td><td class="r">${money(sub)}</td></tr>
        <tr><td colspan="4" class="r">GST 18%</td><td class="r">${money(gst)}</td></tr>
        <tr><td colspan="4" class="r">Total</td><td class="r">${money(total)}</td></tr></tfoot></table>
      <p style="margin-top:24px">For FIXOTECH ENGINEERING</p></body></html>`;
    const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to download the PDF'); return; }
    w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350);
  }

  async function saveOrder(c) {
    if (c.savedOrderId) { toast('Already saved'); return; }
    if (!c.clientId) { toast('No customer on this quotation'); return; }
    const sub = c.items.reduce((s, it) => s + (it.amount || 0), 0);
    const rec = await window.FixoDB.addOrder({
      client_id: c.clientId, order_date: new Date().toISOString().slice(0, 10),
      quote_no: 'AM-' + Date.now().toString().slice(-6), items: currentItems(c),
      total_cost: Math.round(sub), status: 'quoted', source: 'automate'
    });
    c.savedOrderId = rec.id; persist();
    botSay(c, `💾 Saved to <b>${esc(c.clientName)}</b>'s order history. You can now forward it to the Proforma Invoice.`);
    finish(c);
  }
  function forwardProforma(c) {
    if (window.FIXO_PF && FIXO_PF.loadFromQuote) {
      FIXO_PF.loadFromQuote(currentItems(c), c.clientName, {});
      if (window.showScreen) showScreen('screen-proforma');
      toast('Forwarded to Proforma Invoice — finish it there');
    } else toast('Proforma module not ready');
  }

  // ---------- rendering ----------
  function render() {
    const host = document.getElementById('automate-app'); if (!host) return;
    if (!isOn()) { host.innerHTML = `<div class="ciq"><div class="ciq-main"><div class="ciq-empty" style="margin-top:16vh"><h1>Automate Me is turned off</h1><p class="am-dim">An administrator can activate it from the Admin Panel → Automate Me.</p></div></div></div>`; return; }
    if (!chats.length) { newChat(); return; }
    if (!curId || !cur()) curId = chats[0].id;
    host.innerHTML = `
      <div class="ciq">
        <aside class="ciq-side">
          <div class="ciq-side-top"><button class="ciq-back" data-goto="screen-home">←</button><div class="ciq-brand">Automate <b>Me</b></div></div>
          <button class="ciq-new" id="am-new">＋ New quotation</button>
          <div class="ciq-side-lab">Conversations</div>
          <div class="ciq-examples" id="am-chats"></div>
        </aside>
        <main class="ciq-main">
          <div class="ciq-top"><span class="ciq-model">🤖 Automate Me · <span id="am-title"></span></span></div>
          <div class="ciq-scroll" id="am-scroll"></div>
          <div class="ciq-composer">
            <div class="am-at-dd" id="am-at-dd" hidden></div>
            <div class="ciq-inputwrap">
              <button id="am-at" title="Mention a customer">@</button>
              <textarea id="am-input" rows="1" placeholder="Type a message…  (tap @ to choose a customer)"></textarea>
              <button id="am-send">➤</button>
            </div>
            <div class="ciq-foot">Automate Me prepares quotations from your conversation. Review before sending.</div>
          </div>
        </main>
      </div>`;
    renderSidebar(); renderMessages();
    const inp = host.querySelector('#am-input'), sendBtn = host.querySelector('#am-send');
    const doSend = () => { const t = inp.value; inp.value = ''; if (t.trim()) handle(t); };
    sendBtn.onclick = doSend;
    inp.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSend(); } };
    inp.oninput = () => { onAtType(inp); };
    host.querySelector('#am-at').onclick = () => openAt(inp);
    host.querySelector('#am-new').onclick = () => newChat();
  }
  function renderSidebar() {
    const box = document.getElementById('am-chats'); if (!box) return;
    box.innerHTML = chats.map(c => `<button class="ciq-eg ${c.id === curId ? 'active' : ''}" data-chat="${c.id}" title="${esc(c.title)}">💬 ${esc(c.title || 'New quotation')}</button>`).join('') || '<div class="ciq-side-empty2">No conversations yet</div>';
    box.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => openChat(b.dataset.chat));
    const t = document.getElementById('am-title'); if (t) t.textContent = (cur() || {}).title || 'New quotation';
  }
  function msgHtml(m) { return `<div class="ciq-msg ${m.role}"><div class="ciq-avatar">${m.role === 'bot' ? 'AI' : '🙂'}</div><div class="ciq-bubble">${m.html}</div></div>`; }
  function renderMessages() {
    const sc = document.getElementById('am-scroll'); const c = cur(); if (!sc || !c) return;
    sc.innerHTML = c.messages.map(msgHtml).join('');
    wireDocs(sc); scrollDown();
  }
  function appendMsg(m) { const sc = document.getElementById('am-scroll'); if (!sc) return; sc.insertAdjacentHTML('beforeend', msgHtml(m)); wireDocs(sc); }
  function appendLast(c) { const sc = document.getElementById('am-scroll'); if (!sc || !c.messages.length) return; sc.insertAdjacentHTML('beforeend', msgHtml(c.messages[c.messages.length - 1])); wireDocs(sc); }
  function scrollDown() { const sc = document.getElementById('am-scroll'); if (sc) sc.scrollTop = sc.scrollHeight; }

  // wire the action buttons inside doc cards (delegation-safe: re-bind each render)
  function wireDocs(scope) {
    scope.querySelectorAll('[data-act]').forEach(b => {
      if (b.__wired) return; b.__wired = true;
      b.onclick = () => {
        const c = cur(); if (!c) return;
        const doc = b.closest('.am-doc');
        const act = b.dataset.act;
        if (act === 'recalc') { readDoc(doc); renderMessages(); }
        else if (act === 'approve') { readDoc(doc); makeQuotation(c); }
        else if (act === 'pdf') { readQuote(doc); printQuotation(c); }
        else if (act === 'save') { readQuote(doc); saveOrder(c); }
        else if (act === 'forward') { readQuote(doc); forwardProforma(c); }
      };
    });
  }
  // quotation body edits (recompute from its item rows)
  function readQuote(doc) {
    const c = cur(); if (!c || !doc) return;
    const rows = [...doc.querySelectorAll('tbody tr')];
    if (!rows.length) return;
    const parsed = rows.map(tr => {
      const tds = tr.querySelectorAll('td');
      const desc = (tds[1] ? tds[1].textContent : '').trim();
      const qtyUnit = tds[2] ? tds[2].textContent : ''; const qty = num(qtyUnit);
      const unit = (qtyUnit.replace(/[0-9.,\s]/g, '') || 'Nos');
      const rate = num(tds[3] ? tds[3].textContent : '');
      return { desc, qty, unit, rate, amount: Math.round(qty * rate * 100) / 100 };
    }).filter(it => it.desc);
    if (parsed.length) { c.items = parsed; persist(); }
  }

  // ---------- @ customer picker ----------
  function openAt(inp) { const dd = document.getElementById('am-at-dd'); if (!dd) return; buildAt(''); dd.hidden = false; }
  function onAtType(inp) {
    const v = inp.value; const at = v.lastIndexOf('@');
    const dd = document.getElementById('am-at-dd'); if (!dd) return;
    if (at >= 0 && (at === 0 || /\s/.test(v[at - 1]))) { buildAt(v.slice(at + 1)); dd.hidden = false; }
    else dd.hidden = true;
  }
  async function buildAt(q) {
    const dd = document.getElementById('am-at-dd'); if (!dd) return;
    if (!clientsCache.length) await clients();
    const ql = (q || '').toLowerCase();
    const list = (window.FixoDB.searchClients ? window.FixoDB.searchClients(q, clientsCache) : clientsCache.filter(c => (c.company_name || '').toLowerCase().includes(ql))).slice(0, 8);
    dd.innerHTML = `<button class="am-at-item am-at-new" data-newc="1">＋ New customer</button>` +
      list.map(c => `<button class="am-at-item" data-cid="${c.id}"><b>${esc(c.company_name || c.client_name)}</b>${c.gstin ? '<span>' + esc(c.gstin) + '</span>' : ''}</button>`).join('');
    dd.querySelector('[data-newc]').onclick = () => { dd.hidden = true; clearAt(); startNewCustomer(); };
    dd.querySelectorAll('[data-cid]').forEach(b => b.onclick = () => { dd.hidden = true; clearAt(); const cl = clientsCache.find(x => x.id === b.dataset.cid); if (cl) pickCustomer(cl); });
  }
  function clearAt() { const inp = document.getElementById('am-input'); if (!inp) return; const v = inp.value; const at = v.lastIndexOf('@'); if (at >= 0) inp.value = v.slice(0, at); }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', () => {
    applyGate();
    try { curId = localStorage.getItem(CUR); } catch (e) {}
    document.querySelectorAll('[data-open-app="screen-automate"]').forEach(b => b.addEventListener('click', () => { clients(); setTimeout(render, 0); }));
    if (localStorage.getItem('fixo_screen') === 'screen-automate') { clients(); render(); }
  });
  window.addEventListener('fixo:sync', applyGate);   // flag may change from the admin (global)

  window.FIXO_AUTOMATE = { render, isOn, setOn, applyGate };
})();
