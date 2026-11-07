// ============================================================
// Fixotech Inno Structures LLP — Smart IQ (ChatIQ for Inno)
// Ask anything end-to-end about the Inno business and get an answer from the
// live data: previous / this-week / pending / in-progress orders, inventory
// (what's in stock, what's low), receivables & payables (who owes us / whom we
// owe), totals, and per-customer history. Rule-based engine over the Inno stores.
// ============================================================
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before inno-chatiq.js'); return; }
  const D = FIXO_DOC, esc = D.esc, money = D.money;
  const MSGS = 'fixo_inno_chatiq_msgs';
  let messages = [];
  try { messages = JSON.parse(localStorage.getItem(MSGS) || '[]') || []; } catch (e) {}
  const persist = () => { try { localStorage.setItem(MSGS, JSON.stringify(messages.slice(-60))); } catch (e) {} };

  // ---- data accessors ----
  const store = (k) => D.loadStore(k);
  const invoices = () => store('fixo_inno_invoices');
  const quotes = () => store('fixo_inno_quotes');
  const sorders = () => store('fixo_inno_sorders');
  const inventory = () => D.invList();
  const bills = () => store('fixo_inno_purchase_bills');
  const pays = () => store('fixo_inno_payments');
  const customers = () => { try { return D.loadCusts(); } catch (e) { return []; } };
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };
  const recDate = (r) => parseDate((r.model && r.model.invDate) || r.savedAt) || new Date();
  const dn = (r) => r.docNo || r.invNo || (r.model && (r.model.docNo || r.model.invNo)) || '';
  const daysAgo = (n) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(0, 0, 0, 0); return d; };
  const money0 = (n) => '₹' + money(n);
  const m0 = (n) => Number(n || 0) >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : Number(n || 0) >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + ' L' : '₹' + money(n);
  const paidFor = (t, id) => pays().reduce((s, p) => { let x = 0; if (p.target === t && p.targetId === id) x += num(p.amount); if (Array.isArray(p.allocations)) x += p.allocations.filter(a => a.target === t && a.targetId === id).reduce((y, a) => y + num(a.amount), 0); return s + x; }, 0);
  const agingTxt = (dueStr) => { const d = parseDate(dueStr); if (!d) return ''; const diff = Math.round((new Date().setHours(0, 0, 0, 0) - d.setHours(0, 0, 0, 0)) / 86400000); return diff > 0 ? diff + 'd overdue' : diff === 0 ? 'due today' : 'due in ' + (-diff) + 'd'; };

  function receivables() { return invoices().map(r => { const total = num(r.total); const out = Math.round((total - paidFor('INV', r.id)) * 100) / 100; return { no: dn(r), party: r.customer, due: (r.model && r.model.dueDate) || r.savedAt, total, out }; }).filter(x => x.out > 0.5); }
  function payables() { return bills().map(b => { const out = Math.round((num(b.amount) - paidFor('BILL', b.id)) * 100) / 100; return { no: b.billNo, party: b.vendor, due: b.dueDate, total: num(b.amount), out }; }).filter(x => x.out > 0.5); }

  function findCustomer(q) { const n = norm(q); let best = null, len = 0; const names = new Set(); invoices().concat(quotes(), sorders()).forEach(r => { if (r.customer) names.add(r.customer); }); customers().forEach(c => { if (c.name) names.add(c.name); }); names.forEach(nm => { const ln = norm(nm); if (!ln) return; const first = ln.split(' ')[0]; if (n.includes(ln) && ln.length > len) { best = nm; len = ln.length; } else if (first.length > 3 && n.includes(first) && first.length > len) { best = nm; len = first.length; } }); return best; }
  function findItem(q) { const n = norm(q); let best = null, len = 0; inventory().forEach(it => { const nm = norm(it.name); if (!nm) return; if (n.includes(nm) && nm.length > len) { best = it; len = nm.length; } }); if (best) return best; // word-based
    const words = n.replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3 && !/stock|inventory|have|much|many|item|price|rate/.test(w)); let b2 = null, s2 = 0; inventory().forEach(it => { const d = norm(it.name); const hit = words.filter(w => d.includes(w)).length; if (hit > s2) { s2 = hit; b2 = it; } }); return s2 >= 1 ? b2 : null; }

  const docRow = (r, kind) => `<tr><td><b>${esc(dn(r))}</b></td><td>${esc(r.customer || '')}</td><td>${esc((r.model && r.model.invDate) || r.savedAt || '')}</td><td class="r">${money0(num(r.total))}</td><td>${esc(r.status || '')}</td></tr>`;
  const docTable = (rows, kind) => rows.length ? `<div class="ciq-order"><table class="ciq-tbl"><tr><th>No.</th><th>Party</th><th>Date</th><th class="r">Amount</th><th>Status</th></tr>${rows.map(r => docRow(r, kind)).join('')}</table></div>` : '';

  // ---------------- Query engine ----------------
  function answer(q) {
    const n = norm(q);
    const inFy = (r) => true;

    // ---- Receivables / who owes us ----
    if (/(pending|outstanding|due).*(payment|receiv|amount)|who owes|receivable|money.*(due|pending)|collect|unpaid invoice/.test(n)) {
      const rec = receivables().sort((a, b) => b.out - a.out); const tot = rec.reduce((s, x) => s + x.out, 0);
      if (!rec.length) return 'No pending receivables — every invoice is paid. 🎉';
      const top = rec.slice(0, 8).map(x => `<tr><td><b>${esc(x.party || '')}</b></td><td>${esc(x.no)}</td><td>${esc(x.due || '—')}</td><td class="r">${money0(x.out)}</td><td>${esc(agingTxt(x.due))}</td></tr>`).join('');
      return `Customers owe us <b>${m0(tot)}</b> across <b>${rec.length}</b> unpaid invoice(s).<div class="ciq-order"><table class="ciq-tbl"><tr><th>Customer</th><th>Invoice</th><th>Due</th><th class="r">Pending</th><th>Aging</th></tr>${top}</table></div>See the full list in <b>Payments & Bills → Outstanding</b>.`;
    }
    // ---- Payables / whom we owe ----
    if (/(bill|payable|we owe|supplier|vendor).*(pay|due|pending|owe)|how much.*(to pay|do we owe)|pay.*(supplier|vendor|bill)/.test(n)) {
      const pay = payables().sort((a, b) => b.out - a.out); const tot = pay.reduce((s, x) => s + x.out, 0);
      if (!pay.length) return 'No supplier bills pending — all purchase bills are paid. 🎉';
      const top = pay.slice(0, 8).map(x => `<tr><td><b>${esc(x.party || '')}</b></td><td>${esc(x.no || '')}</td><td>${esc(x.due || '—')}</td><td class="r">${money0(x.out)}</td><td>${esc(agingTxt(x.due))}</td></tr>`).join('');
      return `We owe suppliers <b>${m0(tot)}</b> across <b>${pay.length}</b> unpaid bill(s).<div class="ciq-order"><table class="ciq-tbl"><tr><th>Supplier</th><th>Bill</th><th>Due</th><th class="r">Pending</th><th>Aging</th></tr>${top}</table></div>`;
    }
    // ---- Inventory ----
    if (/low stock|out of stock|finished|re-?order|running (out|low)|not (in|available).*(stock|inventory)/.test(n)) {
      const low = inventory().filter(it => D.isLow && D.isLow(it)); const zero = inventory().filter(it => (it.stock !== '' && it.stock != null && num(it.stock) <= 0));
      const list = (low.length ? low : zero);
      if (!list.length) return 'Nothing is low on stock right now. 👍';
      return `<b>${list.length}</b> item(s) need attention (at/below reorder):<div class="ciq-order"><table class="ciq-tbl"><tr><th>Item</th><th class="r">Stock</th><th class="r">Reorder</th></tr>${list.slice(0, 12).map(it => `<tr><td>${esc(it.name)}</td><td class="r">${esc(it.stock)}</td><td class="r">${esc(it.reorder || '—')}</td></tr>`).join('')}</table></div>`;
    }
    if (/inventory value|stock value|total stock|how many items|inventory summary/.test(n)) {
      const all = inventory(); const val = all.reduce((s, p) => s + num(p.stock) * num(p.rate), 0); const low = all.filter(it => D.isLow && D.isLow(it)).length;
      return `Inventory: <b>${all.length}</b> items · stock value <b>${m0(val)}</b> · <b>${low}</b> low-stock.`;
    }
    if (/stock|inventory|do we have|in stock|available|how many.*(have|left)|price of|rate of/.test(n)) {
      const it = findItem(q);
      if (it) { const hasStock = it.stock !== '' && it.stock != null; return `<b>${esc(it.name)}</b> — ${hasStock ? 'stock on hand <b>' + esc(it.stock) + '</b>' + (it.reorder ? ' (reorder at ' + esc(it.reorder) + ')' : '') : 'stock not tracked'} · rate <b>${money0(it.rate)}</b>${it.sku ? ' · SKU ' + esc(it.sku) : ''} · HSN ${esc(it.hsn || '—')}.`; }
      return "I couldn't find that item in inventory. Try the exact name, or ask “low stock items”.";
    }
    // ---- This week ----
    if (/this week|past week|last 7 days|weekly/.test(n)) {
      const wk = daysAgo(7); const pick = (arr) => arr.filter(r => recDate(r) >= wk);
      const iv = pick(invoices()), so = pick(sorders()), qt = pick(quotes());
      const sum = iv.reduce((s, r) => s + num(r.total), 0);
      if (!iv.length && !so.length && !qt.length) return 'Nothing recorded in the last 7 days yet.';
      return `In the last 7 days: <b>${iv.length}</b> invoice(s) (${m0(sum)}), <b>${so.length}</b> sales order(s), <b>${qt.length}</b> quotation(s).${docTable(iv.slice(0, 6), 'INV')}`;
    }
    // ---- Pending orders (confirmed SO not invoiced, accepted quotes not converted) ----
    if (/pending order|to invoice|awaiting.*(invoice|dispatch)|not.*invoiced|orders.*pending|open order/.test(n)) {
      const invSrc = new Set(invoices().map(r => r.source && r.source.docNo).filter(Boolean));
      const soSrc = new Set(sorders().map(r => r.source && r.source.docNo).filter(Boolean));
      const soPending = sorders().filter(s => s.status === 'confirmed' && !invSrc.has(dn(s)));
      const qtPending = quotes().filter(qr => qr.status === 'approved' && !soSrc.has(dn(qr)));
      if (!soPending.length && !qtPending.length) return 'No pending orders — everything confirmed has moved forward. 👍';
      return `Pending: <b>${soPending.length}</b> confirmed sales order(s) awaiting invoice, and <b>${qtPending.length}</b> accepted quote(s) not yet turned into a sales order.${docTable(soPending.slice(0, 6), 'SO')}`;
    }
    // ---- In progress ----
    if (/in progress|ongoing|pipeline|what.*(working|progress)|active deal/.test(n)) {
      const qtOpen = quotes().filter(qr => qr.status === 'draft' || qr.status === 'sent');
      const soOpen = sorders().filter(s => s.status === 'confirmed');
      const invOpen = invoices().filter(r => r.status === 'sent' || r.status === 'draft');
      return `In progress now: <b>${qtOpen.length}</b> open quotation(s), <b>${soOpen.length}</b> confirmed sales order(s), <b>${invOpen.length}</b> invoice(s) awaiting approval/payment. Open <b>Reports → Deal board</b> to see each one's stage.`;
    }
    // ---- Previous / last / recent order ----
    if (/previous order|last order|recent order|latest (order|invoice)|most recent/.test(n)) {
      const all = invoices().slice().sort((a, b) => recDate(b) - recDate(a));
      if (!all.length) return 'No invoices recorded yet.';
      const r = all[0]; const items = (r.model && r.model.items || []).filter(it => it.desc).slice(0, 8).map(it => `<tr><td>${esc(it.desc)}</td><td class="r">${esc(it.qty)} ${esc(it.unit || '')}</td><td class="r">${money0(num(it.rate))}</td></tr>`).join('');
      return `Most recent invoice: <b>${esc(dn(r))}</b> — ${esc(r.customer || '')} · ${esc((r.model && r.model.invDate) || r.savedAt)} · <b>${money0(num(r.total))}</b>${items ? `<div class="ciq-order"><table class="ciq-tbl"><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th></tr>${items}</table></div>` : ''}`;
    }
    // ---- Totals / sales ----
    if (/total (sales|invoiced|revenue|business)|how much.*(sold|invoiced|billed|sales)|revenue|turnover/.test(n)) {
      const my = n.match(/\b(\d{2}\/\d{2})\b/); let list = invoices();
      const tot = list.reduce((s, r) => s + num(r.total), 0);
      return `Total invoiced across all records: <b>${m0(tot)}</b> from <b>${list.length}</b> invoice(s). For a year-by-year / monthly / quarterly split, open <b>Reports</b>.`;
    }
    // ---- Counts ----
    if (/how many (invoice|quote|quotation|order|sales order|customer|item)/.test(n)) {
      return `Counts — invoices <b>${invoices().length}</b>, quotations <b>${quotes().length}</b>, sales orders <b>${sorders().length}</b>, customers <b>${customers().length}</b>, inventory items <b>${inventory().length}</b>.`;
    }
    // ---- Customer-specific ----
    const cust = findCustomer(q);
    if (cust) {
      const iv = invoices().filter(r => norm(r.customer) === norm(cust));
      const so = sorders().filter(r => norm(r.customer) === norm(cust));
      const qt = quotes().filter(r => norm(r.customer) === norm(cust));
      const rec = receivables().filter(x => norm(x.party) === norm(cust)).reduce((s, x) => s + x.out, 0);
      const billed = iv.reduce((s, r) => s + num(r.total), 0);
      return `<b>${esc(cust)}</b> — <b>${iv.length}</b> invoice(s) (${m0(billed)}), <b>${so.length}</b> sales order(s), <b>${qt.length}</b> quotation(s).${rec > 0.5 ? ` Pending from them: <b>${m0(rec)}</b>.` : ' Nothing pending — fully paid.'}${docTable(iv.slice(0, 6), 'INV')}`;
    }

    // ---- default / help ----
    return `I can answer from your Inno data. Try:<ul class="ciq-ul">
      <li>“<b>Pending payments</b>” / “who owes us money”</li>
      <li>“<b>Bills to pay</b>” / “how much do we owe suppliers”</li>
      <li>“<b>This week's orders</b>”</li>
      <li>“<b>Pending orders</b>” / “what's in progress”</li>
      <li>“Do we have <b>Base Plate</b> in stock?” / “<b>low stock</b> items”</li>
      <li>“<b>Total invoiced</b>” · “<b>last order</b>” · orders for a <b>customer name</b></li></ul>`;
  }

  // ---------------- Chat UI ----------------
  function render() {
    const host = document.getElementById('inno-chatiq-app'); if (!host) return;
    host.innerHTML = `
      <div class="ciq">
        <main class="ciq-main" style="width:100%">
          <div class="ciq-top"><span class="ciq-model">Inno <b>Smart IQ</b></span><button class="ciq-new" id="iq-new" style="margin-left:auto">✎ New chat</button></div>
          <div class="ciq-scroll" id="iq-scroll"></div>
          <div class="ciq-composer">
            <div class="ciq-inputwrap">
              <textarea id="iq-input" rows="1" placeholder="Ask about orders, pending payments, inventory…"></textarea>
              <button id="iq-send" title="Send">➤</button>
            </div>
            <div class="ciq-foot">Smart IQ answers from your live Inno data (orders, inventory, payments). Check key figures before acting.</div>
          </div>
        </main>
      </div>`;
    const input = host.querySelector('#iq-input');
    const send = () => { const t = input.value.trim(); if (!t) return; input.value = ''; ask(t); };
    host.querySelector('#iq-send').onclick = send;
    input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } };
    host.querySelector('#iq-new').onclick = () => { messages = []; persist(); renderMessages(); input.focus(); };
    renderMessages();
    input.focus();
  }
  function renderMessages() {
    const s = document.getElementById('iq-scroll'); if (!s) return;
    if (!messages.length) {
      s.innerHTML = `<div class="ciq-welcome"><div class="ciq-welcome-ic">💡</div><h3>Inno Smart IQ</h3><p>Ask me anything about the Inno business — orders, pending payments, inventory and more.</p>
        <div class="ciq-egs">${['Pending payments', "This week's orders", 'Pending orders', 'Low stock items', 'Bills to pay', 'Total invoiced'].map(e => `<button class="ciq-eg2" data-q="${esc(e)}">${esc(e)}</button>`).join('')}</div></div>`;
      s.querySelectorAll('.ciq-eg2').forEach(b => b.onclick = () => ask(b.dataset.q));
      return;
    }
    s.innerHTML = messages.map(m => `<div class="ciq-msg ${m.role}"><div class="ciq-bubble">${m.html}</div></div>`).join('');
    s.scrollTop = s.scrollHeight;
  }
  function ask(q) {
    messages.push({ role: 'user', html: esc(q) }); persist(); renderMessages();
    setTimeout(() => { messages.push({ role: 'bot', html: answer(q) }); persist(); renderMessages(); }, 120);
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-inno-chatiq"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-inno-chatiq') render();
  });
  window.FIXO_INNO_IQ = { render };
})();
