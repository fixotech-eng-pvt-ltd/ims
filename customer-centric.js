// ============================================================
// FIXOTECH — CUSTOMER CENTRIC  (office)
//  Everything for ONE customer, for a chosen day / week / month, gathered in
//  one place — quotations, orders, invoices, dispatches (with vehicle + Tally
//  code) and job work — so the office can post it to the books / Tally. This is
//  the final consolidation stage before the ledger. (Payments: last stage —
//  placeholder kept, slots in when ready.)
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => (window.FIXO_DOC && FIXO_DOC.money) ? FIXO_DOC.money(n) : Number(n || 0).toLocaleString('en-IN');
  const recs = () => (window.FIXO_RECORDS && FIXO_RECORDS.collect) ? FIXO_RECORDS.collect() : [];

  let selCust = null, period = 'month';
  function inPeriod(d) {
    if (!d) return period === 'all';
    if (period === 'all') return true;
    const now = new Date(); const diff = (now - d) / 86400000;
    if (period === 'day') return d.toDateString() === now.toDateString();
    if (period === 'week') return diff <= 7 && diff >= -1;
    if (period === 'month') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    return true;
  }

  function render() {
    const host = document.getElementById('custcentric-app'); if (!host) return;
    const all = recs();
    const custs = [...new Set(all.map(r => r.customer).filter(c => c && c !== '—'))].sort();
    if (!selCust || !custs.includes(selCust)) selCust = custs[0] || null;
    host.innerHTML = `
      <div class="cc-wrap">
        <div class="cc-hero"><div class="cc-hero-l"><span class="cc-hero-ic">🧭</span><div><h2>Customer Centric</h2><p>All of a customer's activity → ready for the ledger / Tally</p></div></div></div>
        <div class="cc-controls">
          <select id="cc-cust" class="cc-sel">${custs.map(c => `<option ${c === selCust ? 'selected' : ''}>${esc(c)}</option>`).join('') || '<option>No customers</option>'}</select>
          <div class="cc-period">
            ${['day', 'week', 'month', 'all'].map(p => `<button class="cc-pbtn ${period === p ? 'active' : ''}" data-p="${p}">${p === 'day' ? 'Today' : p === 'week' ? 'This week' : p === 'month' ? 'This month' : 'All'}</button>`).join('')}
          </div>
        </div>
        <div id="cc-body"></div>
      </div>`;
    host.querySelector('#cc-cust').onchange = (e) => { selCust = e.target.value; draw(); };
    host.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { period = b.dataset.p; render(); });
    draw();
  }

  function draw() {
    const body = document.getElementById('cc-body'); if (!body) return;
    const mine = recs().filter(r => r.customer === selCust && inPeriod(r.date));
    const group = (types) => mine.filter(r => types.indexOf(r.type) >= 0);
    const quotes = group(['Quotation', 'Quotation (Inno)', 'Proforma']);
    const orders = group(['Sales Order (Inno)', 'Indent', 'Indent (draft)']);
    const invoices = group(['Invoice (Inno)']);
    const dispatches = group(['Dispatch Note']);
    const jobs = group(['Job Work']);
    const invTot = invoices.reduce((s, r) => s + (r.amount || 0), 0);
    const quoteTot = quotes.reduce((s, r) => s + (r.amount || 0), 0);

    const tiles = `<div class="cc-tiles">
      <div class="cc-tile"><div class="cc-tv">${quotes.length}</div><div class="cc-tl">Quotations / proformas</div><div class="cc-ts">₹${money(quoteTot)}</div></div>
      <div class="cc-tile"><div class="cc-tv">${orders.length}</div><div class="cc-tl">Orders / indents</div></div>
      <div class="cc-tile"><div class="cc-tv">${invoices.length}</div><div class="cc-tl">Invoices</div><div class="cc-ts">₹${money(invTot)}</div></div>
      <div class="cc-tile"><div class="cc-tv">${dispatches.length}</div><div class="cc-tl">Dispatches</div></div></div>`;

    const section = (title, list, render) => `<div class="cc-card"><div class="cc-card-h">${title} <span class="cc-count">${list.length}</span></div>${list.length ? list.map(render).join('') : '<div class="cc-empty">None in this period.</div>'}</div>`;
    const row = (r, right) => `<div class="cc-row"><div><b>${esc(r.no)}</b><span class="cc-sub">${esc(r.dateStr || '')}${r.status ? ' · ' + esc(r.status) : ''}</span></div><div class="cc-right">${right || (r.amount ? '₹' + money(r.amount) : '')}</div></div>`;
    const dispRow = (r) => { const ex = r.extra || {}; return `<div class="cc-row"><div><b>${esc(ex.tally || r.no)}</b><span class="cc-sub">${esc(r.dateStr || '')}${ex.vehicle ? ' · 🚚 ' + esc(ex.vehicle) : ''}${ex.items ? ' · ' + ex.items.length + ' item(s)' : ''}</span></div><div class="cc-right">${ex.tally ? '<span class="cc-tally">Tally: ' + esc(ex.tally) + '</span>' : ''}</div></div>`; };

    body.innerHTML = tiles +
      section('🧾 Quotations &amp; proformas', quotes, (r) => row(r)) +
      section('📦 Orders &amp; indents', orders, (r) => row(r)) +
      section('💳 Invoices', invoices, (r) => row(r)) +
      section('🚚 Dispatches (vehicle · Tally code)', dispatches, dispRow) +
      section('🔄 Job work', jobs, (r) => row(r, esc(r.status))) +
      `<div class="cc-card cc-ledger"><div class="cc-card-h">📒 For the books / Tally</div>
        <div class="cc-ledger-body">
          <p>Invoiced this period: <b>₹${money(invTot)}</b> · Dispatch notes: <b>${dispatches.length}</b>${dispatches.filter(d => d.extra && d.extra.tally).length ? ' (Tally codes ready above)' : ''}.</p>
          ${window.FIXO_DOC && FIXO_DOC.openTally ? '<button class="cc-btn go" id="cc-tally">⎘ Tally voucher code (invoices)</button>' : ''}
          <div class="cc-payhold">💤 <b>Payments</b> — final stage, kept ready. Will show receipts &amp; balance for ${esc(selCust || '')} here once enabled.</div>
        </div></div>`;
    const tb = body.querySelector('#cc-tally'); if (tb) tb.onclick = () => openCustomerTally(invoices);
  }

  function openCustomerTally(invoices) {
    // Pull the real invoice models and reuse the Inno Tally voucher builder.
    try {
      const store = (window.FIXO_DOC && FIXO_DOC.loadStore && FIXO_DOC.SAVED_KEYS) ? FIXO_DOC.loadStore(FIXO_DOC.SAVED_KEYS.INV) : [];
      const nums = new Set(invoices.map(r => r.no));
      const models = store.filter(r => nums.has(r.docNo || r.invNo)).map(r => r.model).filter(Boolean);
      if (!models.length) { toast('No matching Inno invoices to export'); return; }
      if (FIXO_DOC.openTally) FIXO_DOC.openTally(models, 'Tally vouchers — ' + (selCust || ''));
    } catch (e) { toast('Could not build Tally code'); }
  }
  function toast(m) { return (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m)); }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-custcentric"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-custcentric') render();
  });
  window.FIXO_CUSTCENTRIC = { render };
})();
