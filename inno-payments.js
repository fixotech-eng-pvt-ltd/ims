// ============================================================
// Fixotech Inno Structures LLP — PAYMENTS & BILLS  (Accounts)
// • Purchase Bills (payables) — record bills received from suppliers.
// • Payments — record money received (map to an Invoice) or paid (map to a Bill);
//   partial payments supported, so balances stay correct.
// • Outstanding — the "no more Excel" report: who owes us / whom we owe, with the
//   amount pending and how many days it has been due (aging), both directions.
// Reuses the shared engine (inno-core.js) and the existing invoice store.
// ============================================================
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before inno-payments.js'); return; }
  const D = FIXO_DOC, esc = D.esc, money = D.money;
  const BILLS = 'fixo_inno_purchase_bills', PAYS = 'fixo_inno_payments';
  const uid = (p) => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');   // dd/mm/yyyy
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };
  const dayDiff = (a, b) => Math.round((a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0)) / 86400000);
  const money0 = (n) => '₹' + money(n);
  const m0 = (n) => Number(n || 0) >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : Number(n || 0) >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + ' L' : '₹' + money(n);

  const loadBills = () => { try { return JSON.parse(localStorage.getItem(BILLS) || '[]') || []; } catch (e) { return []; } };
  const storeBills = (a) => { try { localStorage.setItem(BILLS, JSON.stringify(a.slice(0, 2000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(BILLS); } catch (e) {} };
  const loadPays = () => { try { return JSON.parse(localStorage.getItem(PAYS) || '[]') || []; } catch (e) { return []; } };
  const storePays = (a) => { try { localStorage.setItem(PAYS, JSON.stringify(a.slice(0, 5000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(PAYS); } catch (e) {} };

  const invoices = () => D.loadStore(D.SAVED_KEYS.INV);
  const paidFor = (target, id) => loadPays().filter(p => p.target === target && p.targetId === id).reduce((s, p) => s + num(p.amount), 0);
  // Days a doc is overdue (+) or still has before due (−); null if no due date.
  function agingDays(dueStr) { const d = parseDate(dueStr); if (!d) return null; return dayDiff(new Date(), d); }
  function agingChip(days) {
    if (days == null) return '<span class="pm-age">—</span>';
    if (days < 0) return `<span class="pm-age ok">due in ${-days}d</span>`;
    if (days === 0) return '<span class="pm-age warn">due today</span>';
    const cls = days > 60 ? 'no' : days > 30 ? 'warn2' : 'warn';
    return `<span class="pm-age ${cls}">${days}d overdue</span>`;
  }

  // ---- receivables (our invoices) & payables (purchase bills) with balances ----
  function receivables() {
    return invoices().map(r => { const total = num(r.total); const paid = paidFor('INV', r.id); const out = Math.round((total - paid) * 100) / 100; const due = (r.model && r.model.dueDate) || r.savedAt; return { id: r.id, no: r.docNo || r.invNo, party: r.customer, date: (r.model && r.model.invDate) || r.savedAt, due, total, paid, out, days: agingDays(due), rec: r }; }).filter(x => x.out > 0.5);
  }
  function payables() {
    return loadBills().map(b => { const total = num(b.amount); const paid = paidFor('BILL', b.id); const out = Math.round((total - paid) * 100) / 100; return { id: b.id, no: b.billNo, party: b.vendor, date: b.billDate, due: b.dueDate, total, paid, out, days: agingDays(b.dueDate), bill: b }; }).filter(x => x.out > 0.5);
  }

  let view = 'outstanding';
  function render() {
    const host = document.getElementById('inno-pay-app'); if (!host) return;
    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${D.CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">INNO <span class="inv-h-bold">PAYMENTS &amp; BILLS</span></div><div class="inv-h-sub">Receivables · Payables · Aging</div></div></div>
          <div class="inv-header-right"><div class="inv-h-co">${esc(D.CO.name)}</div></div>
        </div>
        <div class="inv-topbtns pm-tabs">
          <button class="cp-btn small ${view === 'outstanding' ? 'cp-btn-go' : ''}" data-v="outstanding">📊 Outstanding</button>
          <button class="cp-btn small ${view === 'bills' ? 'cp-btn-go' : ''}" data-v="bills">🧾 Purchase Bills</button>
          <button class="cp-btn small ${view === 'payments' ? 'cp-btn-go' : ''}" data-v="payments">💵 Payments</button>
        </div>
        <div id="pm-body"></div>
      </div>`;
    host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    if (view === 'bills') renderBills(); else if (view === 'payments') renderPayments(); else renderOutstanding();
  }

  // ---------- OUTSTANDING (no-Excel report) ----------
  function renderOutstanding() {
    const body = document.getElementById('pm-body');
    const rec = receivables().sort((a, b) => (b.days || -9999) - (a.days || -9999));
    const pay = payables().sort((a, b) => (b.days || -9999) - (a.days || -9999));
    const recTot = rec.reduce((s, x) => s + x.out, 0), payTot = pay.reduce((s, x) => s + x.out, 0);
    const recOverdue = rec.filter(x => x.days > 0).length, payOverdue = pay.filter(x => x.days > 0).length;
    const tile = (lbl, val, sub, cls) => `<div class="rp-tile"><div class="rp-tile-v ${cls || ''}">${val}</div><div class="rp-tile-l">${esc(lbl)}</div>${sub ? `<div class="rp-tile-s">${esc(sub)}</div>` : ''}</div>`;
    const rrows = rec.length ? rec.map(x => `<tr><td><b>${esc(x.party || '—')}</b><div class="pm-sub">${esc(x.no || '')}</div></td><td class="c">${esc(x.due || '—')}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.paid)}</td><td class="r b">${money(x.out)}</td><td class="c">${agingChip(x.days)}</td><td class="c"><button class="cp-btn small" data-recpay="${x.id}">＋ Receipt</button></td></tr>`).join('') : '<tr><td colspan="7" class="c pm-sub">No pending receivables 🎉</td></tr>';
    const prows = pay.length ? pay.map(x => `<tr><td><b>${esc(x.party || '—')}</b><div class="pm-sub">${esc(x.no || '')}</div></td><td class="c">${esc(x.due || '—')}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.paid)}</td><td class="r b">${money(x.out)}</td><td class="c">${agingChip(x.days)}</td><td class="c"><button class="cp-btn small" data-billpay="${x.id}">＋ Pay</button></td></tr>`).join('') : '<tr><td colspan="7" class="c pm-sub">No pending bills to pay 🎉</td></tr>';

    body.innerHTML = `
      <div class="rp-tiles pm-tiles">
        ${tile('Receivable (owed to us)', m0(recTot), rec.length + ' open · ' + recOverdue + ' overdue', 'pm-green')}
        ${tile('Payable (we owe)', m0(payTot), pay.length + ' open · ' + payOverdue + ' overdue', 'pm-red')}
        ${tile('Net position', m0(recTot - payTot), recTot - payTot >= 0 ? 'in our favour' : 'we owe more', '')}
      </div>
      <div class="inv-card"><div class="inv-card-h">🟢 Receivables — customers who owe us (unpaid invoices)</div>
        <div class="inv-items-wrap"><table class="inv-tbl rp-tbl pm-tbl"><thead><tr><th>Customer / Invoice</th><th>Due</th><th>Invoice ₹</th><th>Received ₹</th><th>Pending ₹</th><th>Aging</th><th></th></tr></thead><tbody>${rrows}</tbody></table></div></div>
      <div class="inv-card"><div class="inv-card-h">🔴 Payables — suppliers we owe (unpaid purchase bills)</div>
        <div class="inv-items-wrap"><table class="inv-tbl rp-tbl pm-tbl"><thead><tr><th>Supplier / Bill</th><th>Due</th><th>Bill ₹</th><th>Paid ₹</th><th>Pending ₹</th><th>Aging</th><th></th></tr></thead><tbody>${prows}</tbody></table></div></div>`;
    body.querySelectorAll('[data-recpay]').forEach(b => b.onclick = () => recordPayment('in', b.dataset.recpay));
    body.querySelectorAll('[data-billpay]').forEach(b => b.onclick = () => recordPayment('out', b.dataset.billpay));
  }

  // ---------- PURCHASE BILLS ----------
  function editBill(bill, after) {
    const b = bill || { id: uid('bill-'), billNo: '', vendor: '', billDate: today(), dueDate: today(), amount: '', bank: '', notes: '' };
    const m = modal(`<h3>${bill ? 'Edit' : 'New'} purchase bill</h3>
      <div class="inv-fields" style="grid-template-columns:1fr 1fr">
        <label>Supplier / Vendor<input id="b-vendor" value="${esc(b.vendor)}" placeholder="Vendor name"></label>
        <label>Bill No.<input id="b-no" value="${esc(b.billNo)}" placeholder="Supplier bill number"></label>
        <label>Bill Date<input id="b-date" value="${esc(b.billDate)}" placeholder="dd/mm/yyyy"></label>
        <label>Due Date<input id="b-due" value="${esc(b.dueDate)}" placeholder="dd/mm/yyyy"></label>
        <label>Amount ₹ (total incl. GST)<input id="b-amt" type="number" value="${esc(b.amount)}" placeholder="0.00"></label>
        <label class="inv-wide2">Bank / payment details<input id="b-bank" value="${esc(b.bank || '')}" placeholder="A/c no · IFSC · UPI — how to pay this supplier"></label>
        <label class="inv-wide2">Notes<input id="b-notes" value="${esc(b.notes || '')}"></label>
      </div>
      <div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-save>💾 Save bill</button><button class="cp-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-save]').onclick = () => {
      const vendor = m.querySelector('#b-vendor').value.trim(); if (!vendor) { toast('Supplier name required'); return; }
      const saved = { id: b.id, billNo: m.querySelector('#b-no').value.trim(), vendor, billDate: m.querySelector('#b-date').value.trim() || today(), dueDate: m.querySelector('#b-due').value.trim(), amount: num(m.querySelector('#b-amt').value), bank: m.querySelector('#b-bank').value.trim(), notes: m.querySelector('#b-notes').value.trim() };
      const list = loadBills().filter(x => x.id !== b.id); list.unshift(saved); storeBills(list); m.remove(); toast('Bill saved'); if (after) after();
    };
  }
  function renderBills() {
    const body = document.getElementById('pm-body');
    body.innerHTML = `<div class="inv-topbtns"><button class="cp-btn small cp-btn-go" id="pm-newbill">＋ New purchase bill</button><input class="inv-in" id="pm-bill-s" placeholder="Search supplier / bill no…" style="max-width:320px"></div>
      <div class="inv-card"><div class="inv-card-h">Purchase bills (payables)</div><div class="modal-body" id="pm-bill-list"></div></div>`;
    const draw = () => {
      const q = (body.querySelector('#pm-bill-s').value || '').toLowerCase();
      const list = loadBills().filter(b => !q || ((b.vendor || '') + ' ' + (b.billNo || '')).toLowerCase().includes(q));
      body.querySelector('#pm-bill-list').innerHTML = list.length ? list.map(b => { const paid = paidFor('BILL', b.id); const out = num(b.amount) - paid; const st = out <= 0.5 ? 'st-ok' : paid > 0.5 ? 'st-sent' : 'st-no'; const lbl = out <= 0.5 ? 'Paid' : paid > 0.5 ? 'Part-paid' : 'Unpaid'; return `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${esc(b.vendor)}</b> <span class="inv-chip ${st}">${lbl}</span><span class="inv-rec-sub">${esc(b.billNo || '')} · ${esc(b.billDate || '')}${b.dueDate ? ' · due ' + esc(b.dueDate) + ' ' + stripTags(agingChip(agingDays(b.dueDate))) : ''} · ₹${money(b.amount)}${out > 0.5 ? ' · pending ₹' + money(out) : ''}</span></div>
        <div class="inv-rec-act">${out > 0.5 ? `<button class="cp-btn cp-btn-go" data-pay="${b.id}">＋ Pay</button>` : ''}<button class="cp-btn so-open" data-edit="${b.id}">Edit</button><button class="so-del" data-del="${b.id}">×</button></div></div>`; }).join('') : '<div class="so-empty">No purchase bills yet. Click ＋ New purchase bill.</div>';
      body.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => editBill(loadBills().find(y => y.id === x.dataset.edit), draw));
      body.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { if (confirm('Delete this bill?')) { storeBills(loadBills().filter(y => y.id !== x.dataset.del)); draw(); } });
      body.querySelectorAll('[data-pay]').forEach(x => x.onclick = () => recordPayment('out', x.dataset.pay, draw));
    };
    body.querySelector('#pm-newbill').onclick = () => editBill(null, draw);
    body.querySelector('#pm-bill-s').oninput = draw; draw();
  }
  const stripTags = (h) => String(h).replace(/<[^>]+>/g, '');

  // ---------- PAYMENTS (record + map to invoice/bill) ----------
  function recordPayment(dir, targetId, after) {
    // dir: 'in' = received from customer → map to Invoice; 'out' = paid to supplier → map to Bill
    let target = dir === 'in' ? 'INV' : 'BILL';
    const pick = () => {
      if (dir === 'in') { const r = invoices().find(x => x.id === targetId); return r ? { no: r.docNo || r.invNo, party: r.customer, total: num(r.total), paid: paidFor('INV', r.id) } : null; }
      const b = loadBills().find(x => x.id === targetId); return b ? { no: b.billNo, party: b.vendor, total: num(b.amount), paid: paidFor('BILL', b.id), bank: b.bank } : null;
    };
    const openForm = () => {
      const info = pick(); const out = info ? Math.round((info.total - info.paid) * 100) / 100 : 0;
      const m = modal(`<h3>${dir === 'in' ? '💰 Receipt from customer' : '💸 Payment to supplier'}</h3>
        ${info ? `<div class="pm-target">${dir === 'in' ? 'Invoice' : 'Bill'} <b>${esc(info.no || '')}</b> · ${esc(info.party || '')}<br>Total ₹${money(info.total)} · Already ${dir === 'in' ? 'received' : 'paid'} ₹${money(info.paid)} · <b>Pending ₹${money(out)}</b>${info.bank ? '<br>🏦 ' + esc(info.bank) : ''}</div>` : '<div class="pm-target">Select what this payment is against.</div>'}
        <div class="inv-fields" style="grid-template-columns:1fr 1fr">
          <label>Amount ₹<input id="p-amt" type="number" value="${out > 0 ? out : ''}" placeholder="0.00"></label>
          <label>Date<input id="p-date" value="${today()}"></label>
          <label>Mode<select id="p-mode"><option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>Other</option></select></label>
          <label>Reference / Note<input id="p-note" placeholder="UTR / cheque no / note"></label>
        </div>
        <div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-save>💾 Save payment</button><button class="cp-btn" data-x>Cancel</button></div>`);
      m.querySelector('[data-x]').onclick = () => m.remove();
      m.querySelector('[data-save]').onclick = () => {
        const amt = num(m.querySelector('#p-amt').value); if (amt <= 0) { toast('Enter an amount'); return; }
        const rec = { id: uid('pay-'), date: m.querySelector('#p-date').value.trim() || today(), direction: dir, target, targetId, targetNo: info ? info.no : '', party: info ? info.party : '', amount: amt, mode: m.querySelector('#p-mode').value, note: m.querySelector('#p-note').value.trim(), createdAt: new Date().toISOString() };
        const list = loadPays(); list.unshift(rec); storePays(list); m.remove(); toast('Payment recorded & mapped'); if (after) after(); else render();
      };
    };
    if (targetId) return openForm();
    // No target yet → pick one first
    const items = dir === 'in' ? receivables() : payables();
    const m = modal(`<div class="inv-ed-head"><h3>${dir === 'in' ? 'Receipt — pick the invoice' : 'Payment — pick the bill'}</h3><button class="cp-btn" data-x>Close</button></div>
      <input class="inv-in" id="pm-pick-s" placeholder="Search ${dir === 'in' ? 'customer / invoice' : 'supplier / bill'}…" style="margin:4px 0 10px">
      <div class="modal-body" id="pm-pick-list"></div>`, 'big');
    m.querySelector('[data-x]').onclick = () => m.remove();
    const draw = () => { const q = (m.querySelector('#pm-pick-s').value || '').toLowerCase(); const list = items.filter(x => !q || ((x.party || '') + ' ' + (x.no || '')).toLowerCase().includes(q));
      m.querySelector('#pm-pick-list').innerHTML = list.length ? list.map(x => `<button class="inv-pick-row" data-id="${x.id}"><b>${esc(x.party || '—')} — ${esc(x.no || '')}</b><span>pending ₹${money(x.out)} · ${esc(x.due || 'no due date')} ${stripTags(agingChip(x.days))}</span></button>`).join('') : '<div class="so-empty">Nothing pending here.</div>';
      m.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { targetId = b.dataset.id; m.remove(); openForm(); }); };
    m.querySelector('#pm-pick-s').oninput = draw; draw();
  }
  function renderPayments() {
    const body = document.getElementById('pm-body');
    body.innerHTML = `<div class="inv-topbtns"><button class="cp-btn small cp-btn-go" id="pm-newrec">＋ Receipt (from customer)</button><button class="cp-btn small" id="pm-newpay">＋ Payment (to supplier)</button><input class="inv-in" id="pm-pay-s" placeholder="Search party / ref…" style="max-width:300px"></div>
      <div class="inv-card"><div class="inv-card-h">Payments &amp; receipts</div><div class="modal-body" id="pm-pay-list"></div></div>`;
    const draw = () => {
      const q = (body.querySelector('#pm-pay-s').value || '').toLowerCase();
      const list = loadPays().filter(p => !q || ((p.party || '') + ' ' + (p.targetNo || '') + ' ' + (p.note || '')).toLowerCase().includes(q));
      body.querySelector('#pm-pay-list').innerHTML = list.length ? list.map(p => `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${p.direction === 'in' ? '⬇ Received' : '⬆ Paid'} ₹${money(p.amount)}</b> <span class="inv-chip ${p.direction === 'in' ? 'st-ok' : 'st-no'}">${esc(p.party || '')}</span><span class="inv-rec-sub">${esc(p.date || '')} · ${esc(p.mode || '')} · ${p.target === 'INV' ? 'Invoice' : 'Bill'} ${esc(p.targetNo || '')}${p.note ? ' · ' + esc(p.note) : ''}</span></div>
        <div class="inv-rec-act"><button class="so-del" data-del="${p.id}">×</button></div></div>`).join('') : '<div class="so-empty">No payments recorded yet.</div>';
      body.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { if (confirm('Delete this payment? (balances will update)')) { storePays(loadPays().filter(y => y.id !== x.dataset.del)); draw(); } });
    };
    body.querySelector('#pm-newrec').onclick = () => recordPayment('in', null, draw);
    body.querySelector('#pm-newpay').onclick = () => recordPayment('out', null, draw);
    body.querySelector('#pm-pay-s').oninput = draw; draw();
  }

  function toast(m) { return (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m)); }
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'inv-overlay'; el.innerHTML = `<div class="inv-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-inno-payments"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-inno-payments') render();
  });
  window.FIXO_PAYMENTS = { render };
})();
