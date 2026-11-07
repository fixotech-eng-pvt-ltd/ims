// ============================================================
// Fixotech Inno Structures LLP — PAYMENTS & BILLS  (Accounts)
// Mirrors the Zoho Books flow the team uses:
//  • Purchase Bills (payables) — bills received from suppliers.
//  • Payments Received  — ONE receipt from a customer, allocated across many
//    open invoices (per-invoice amount + "Pay in full"); any extra = Advance.
//  • Payments Made      — ONE payment to a supplier, allocated across many bills.
//  • Payment # auto-numbered per financial year, Mode + Deposit-To + Reference.
//  • Outstanding — the "no more Excel" report: receivables + payables with aging.
// Reuses the shared engine (inno-core.js) and the existing invoice store.
// ============================================================
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before inno-payments.js'); return; }
  const D = FIXO_DOC, esc = D.esc, money = D.money;
  const BILLS = 'fixo_inno_purchase_bills', PAYS = 'fixo_inno_payments';
  const uid = (p) => (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');   // dd/mm/yyyy
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const r2 = (n) => Math.round(num(n) * 100) / 100;
  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };
  const dayDiff = (a, b) => Math.round((a.setHours(0, 0, 0, 0) - b.setHours(0, 0, 0, 0)) / 86400000);
  const m0 = (n) => Number(n || 0) >= 1e7 ? '₹' + (n / 1e7).toFixed(2) + ' Cr' : Number(n || 0) >= 1e5 ? '₹' + (n / 1e5).toFixed(2) + ' L' : '₹' + money(n);
  const stripTags = (h) => String(h).replace(/<[^>]+>/g, '');

  const loadBills = () => { try { return JSON.parse(localStorage.getItem(BILLS) || '[]') || []; } catch (e) { return []; } };
  const storeBills = (a) => { try { localStorage.setItem(BILLS, JSON.stringify(a.slice(0, 2000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(BILLS); } catch (e) {} };
  const loadPays = () => { try { return JSON.parse(localStorage.getItem(PAYS) || '[]') || []; } catch (e) { return []; } };
  const storePays = (a) => { try { localStorage.setItem(PAYS, JSON.stringify(a.slice(0, 5000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(PAYS); } catch (e) {} };

  const invoices = () => D.loadStore(D.SAVED_KEYS.INV);

  // How much has been applied to one target (INV/BILL id) — counts both the
  // legacy single-target shape AND the new per-payment allocations array.
  function paidFor(target, id) {
    return loadPays().reduce((s, p) => {
      let t = 0;
      if (p.target === target && p.targetId === id) t += num(p.amount);
      if (Array.isArray(p.allocations)) t += p.allocations.filter(a => a.target === target && a.targetId === id).reduce((x, a) => x + num(a.amount), 0);
      return s + t;
    }, 0);
  }
  // Financial-year code (Apr–Mar) for Payment numbering, e.g. 26-27.
  function finYear() { const d = new Date(); const y = d.getFullYear(), m = d.getMonth(); const s = m >= 3 ? y : y - 1; return String(s % 100).padStart(2, '0') + '-' + String((s + 1) % 100).padStart(2, '0'); }
  function nextPayNo(dir) {
    const fy = finYear(); const pre = (dir === 'in' ? 'RCPT' : 'PAY') + '/' + fy + '-';
    let max = 0; loadPays().forEach(p => { if (p.direction === dir && p.payNo && p.payNo.indexOf(pre) === 0) { const n = parseInt(p.payNo.slice(pre.length), 10); if (n > max) max = n; } });
    return pre + String(max + 1).padStart(3, '0');
  }

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
    return invoices().map(r => { const total = num(r.total); const paid = paidFor('INV', r.id); const out = r2(total - paid); const due = (r.model && r.model.dueDate) || r.savedAt; return { id: r.id, no: r.docNo || r.invNo, party: r.customer, date: (r.model && r.model.invDate) || r.savedAt, due, total, paid, out, days: agingDays(due), rec: r }; }).filter(x => x.out > 0.5);
  }
  function payables() {
    return loadBills().map(b => { const total = num(b.amount); const paid = paidFor('BILL', b.id); const out = r2(total - paid); return { id: b.id, no: b.billNo, party: b.vendor, date: b.billDate, due: b.dueDate, total, paid, out, days: agingDays(b.dueDate), bill: b }; }).filter(x => x.out > 0.5);
  }
  // Distinct parties with something open, for the "pick who paid" step.
  function openParties(dir) {
    const rows = dir === 'in' ? receivables() : payables(); const map = {};
    rows.forEach(x => { const k = (x.party || '—'); if (!map[k]) map[k] = { party: k, out: 0, count: 0, oldest: null }; map[k].out += x.out; map[k].count++; if (x.days != null && (map[k].oldest == null || x.days > map[k].oldest)) map[k].oldest = x.days; });
    return Object.values(map).sort((a, b) => b.out - a.out);
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
    const rrows = rec.length ? rec.map(x => `<tr><td><b>${esc(x.party || '—')}</b><div class="pm-sub">${esc(x.no || '')}</div></td><td class="c">${esc(x.due || '—')}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.paid)}</td><td class="r b">${money(x.out)}</td><td class="c">${agingChip(x.days)}</td><td class="c"><button class="cp-btn small" data-recpay="${esc(x.party || '')}">＋ Receipt</button></td></tr>`).join('') : '<tr><td colspan="7" class="c pm-sub">No pending receivables 🎉</td></tr>';
    const prows = pay.length ? pay.map(x => `<tr><td><b>${esc(x.party || '—')}</b><div class="pm-sub">${esc(x.no || '')}</div></td><td class="c">${esc(x.due || '—')}</td><td class="r">${money(x.total)}</td><td class="r">${money(x.paid)}</td><td class="r b">${money(x.out)}</td><td class="c">${agingChip(x.days)}</td><td class="c"><button class="cp-btn small" data-billpay="${esc(x.party || '')}">＋ Pay</button></td></tr>`).join('') : '<tr><td colspan="7" class="c pm-sub">No pending bills to pay 🎉</td></tr>';

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
    body.querySelectorAll('[data-recpay]').forEach(b => b.onclick = () => allocPayment('in', b.dataset.recpay));
    body.querySelectorAll('[data-billpay]').forEach(b => b.onclick = () => allocPayment('out', b.dataset.billpay));
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
        <div class="inv-rec-act">${out > 0.5 ? `<button class="cp-btn cp-btn-go" data-pay="${esc(b.vendor)}">＋ Pay</button>` : ''}<button class="cp-btn so-open" data-edit="${b.id}">Edit</button><button class="so-del" data-del="${b.id}">×</button></div></div>`; }).join('') : '<div class="so-empty">No purchase bills yet. Click ＋ New purchase bill.</div>';
      body.querySelectorAll('[data-edit]').forEach(x => x.onclick = () => editBill(loadBills().find(y => y.id === x.dataset.edit), draw));
      body.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { if (confirm('Delete this bill?')) { storeBills(loadBills().filter(y => y.id !== x.dataset.del)); draw(); } });
      body.querySelectorAll('[data-pay]').forEach(x => x.onclick = () => allocPayment('out', x.dataset.pay, draw));
    };
    body.querySelector('#pm-newbill').onclick = () => editBill(null, draw);
    body.querySelector('#pm-bill-s').oninput = draw; draw();
  }

  // ---------- PAYMENT (Zoho-style: one payment, many invoices/bills) ----------
  // dir: 'in' = receipt from a customer (→ invoices); 'out' = payment to a supplier (→ bills)
  function allocPayment(dir, party, after) {
    const isIn = dir === 'in', target = isIn ? 'INV' : 'BILL';
    if (!party) return pickParty(dir, after);
    const rows = (isIn ? receivables() : payables()).filter(x => (x.party || '—') === party)
      .sort((a, b) => (b.days || -9999) - (a.days || -9999));   // oldest/most-overdue first
    if (!rows.length) { toast('Nothing open for ' + party); return; }
    const bank = !isIn ? (rows.map(r => r.bill && r.bill.bank).find(Boolean) || '') : '';
    const alloc = {}; rows.forEach(r => alloc[r.id] = 0);
    const totalOpen = r2(rows.reduce((s, r) => s + r.out, 0));

    const m = modal(`<div class="inv-ed-head"><h3>${isIn ? '💰 Payment Received' : '💸 Payment Made'} — ${esc(party)}</h3><button class="cp-btn" data-x>Close</button></div>
      <div class="pm-target">${rows.length} open ${isIn ? 'invoice' : 'bill'}${rows.length > 1 ? 's' : ''} · total pending <b>₹${money(totalOpen)}</b>${bank ? '<br>🏦 ' + esc(bank) : ''}</div>
      <div class="inv-fields pm-payhead" style="grid-template-columns:1fr 1fr 1fr">
        <label>Amount ${isIn ? 'Received' : 'Paid'} ₹<input id="p-amt" type="number" placeholder="0.00"></label>
        <label>Payment Date<input id="p-date" value="${today()}"></label>
        <label>Payment #<input id="p-no" value="${esc(nextPayNo(dir))}"></label>
        <label>Mode<select id="p-mode"><option>Bank Transfer</option><option>UPI</option><option>Cheque</option><option>Cash</option><option>NEFT/RTGS</option><option>Other</option></select></label>
        <label>${isIn ? 'Deposit To' : 'Paid Through'}<select id="p-acct"><option>Bank</option><option>Cash in hand</option><option>UPI / Wallet</option></select></label>
        <label>Reference<input id="p-ref" placeholder="UTR / cheque no"></label>
      </div>
      <div class="pm-allocbar"><button class="cp-btn small" id="p-auto">⚡ Auto-allocate (oldest first)</button><button class="cp-btn small" id="p-clear">Clear</button>
        <span class="pm-allocsum" id="p-sum"></span></div>
      <div class="inv-items-wrap"><table class="inv-tbl pm-tbl pm-alloc"><thead><tr><th>${isIn ? 'Invoice' : 'Bill'}</th><th>Date</th><th>Due</th><th class="r">Pending ₹</th><th class="r">${isIn ? 'Received' : 'Payment'} ₹</th><th></th></tr></thead><tbody id="p-rows"></tbody></table></div>
      <div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-save>💾 Save payment</button><button class="cp-btn" data-x2>Cancel</button></div>`, 'big');

    const amtEl = m.querySelector('#p-amt'), sumEl = m.querySelector('#p-sum');
    const drawRows = () => {
      m.querySelector('#p-rows').innerHTML = rows.map(r => `<tr><td><b>${esc(r.no || '—')}</b></td><td class="c">${esc(r.date || '—')}</td><td class="c">${esc(r.due || '—')} ${stripTags(agingChip(r.days))}</td><td class="r">${money(r.out)}</td>
        <td class="r"><input class="inv-in pm-alin" data-aid="${r.id}" type="number" value="${alloc[r.id] ? alloc[r.id] : ''}" placeholder="0" style="max-width:120px;text-align:right"></td>
        <td><button class="cp-btn small pm-full" data-full="${r.id}">Pay in full</button></td></tr>`).join('');
      m.querySelectorAll('.pm-alin').forEach(i => i.oninput = () => { alloc[i.dataset.aid] = num(i.value); recalc(); });
      m.querySelectorAll('[data-full]').forEach(b => b.onclick = () => { const r = rows.find(x => x.id === b.dataset.full); alloc[r.id] = r.out; drawRows(); recalc(); });
    };
    const recalc = () => {
      const applied = r2(rows.reduce((s, r) => s + num(alloc[r.id]), 0));
      const entered = num(amtEl.value);
      const excess = r2(entered - applied);
      let msg = `Allocated <b>₹${money(applied)}</b>`;
      if (entered > 0) msg += ` of ₹${money(entered)} entered`;
      if (excess > 0.5) msg += ` · <span class="pm-red">Unapplied ₹${money(excess)} → ${isIn ? 'Customer' : 'Vendor'} Advance</span>`;
      else if (excess < -0.5) msg += ` · <span class="pm-red">Over-allocated by ₹${money(-excess)}</span>`;
      sumEl.innerHTML = msg;
    };
    m.querySelector('#p-auto').onclick = () => { let left = num(amtEl.value) || totalOpen; rows.forEach(r => { const take = Math.min(r.out, r2(left)); alloc[r.id] = take > 0 ? take : 0; left = r2(left - take); }); if (!num(amtEl.value)) amtEl.value = r2(rows.reduce((s, r) => s + r.out, 0)); drawRows(); recalc(); };
    m.querySelector('#p-clear').onclick = () => { rows.forEach(r => alloc[r.id] = 0); drawRows(); recalc(); };
    amtEl.oninput = recalc;
    [...m.querySelectorAll('[data-x],[data-x2]')].forEach(b => b.onclick = () => m.remove());
    m.querySelector('[data-save]').onclick = () => {
      const allocations = rows.filter(r => num(alloc[r.id]) > 0).map(r => ({ target, targetId: r.id, no: r.no, amount: r2(alloc[r.id]) }));
      const applied = r2(allocations.reduce((s, a) => s + a.amount, 0));
      const entered = r2(num(amtEl.value) || applied);
      if (applied <= 0 && entered <= 0) { toast('Enter an amount or allocate to a document'); return; }
      if (applied - entered > 0.5) { toast('Allocated more than the amount — reduce allocation'); return; }
      const advance = r2(entered - applied);
      const rec = {
        id: uid('pay-'), payNo: m.querySelector('#p-no').value.trim(), date: m.querySelector('#p-date').value.trim() || today(),
        direction: dir, party, amount: entered, applied, advance: advance > 0.5 ? advance : 0,
        mode: m.querySelector('#p-mode').value, account: m.querySelector('#p-acct').value, ref: m.querySelector('#p-ref').value.trim(),
        allocations, createdAt: new Date().toISOString()
      };
      const list = loadPays(); list.unshift(rec); storePays(list); m.remove();
      toast(`${isIn ? 'Receipt' : 'Payment'} ${rec.payNo} saved — ₹${money(entered)} across ${allocations.length} ${isIn ? 'invoice' : 'bill'}(s)` + (rec.advance ? ` · ₹${money(rec.advance)} advance` : ''));
      if (after) after(); else render();
    };
    drawRows(); recalc();
    setTimeout(() => amtEl.focus(), 30);
  }

  // Pick which customer/supplier the payment is from/to.
  function pickParty(dir, after) {
    const isIn = dir === 'in';
    const parties = openParties(dir);
    const m = modal(`<div class="inv-ed-head"><h3>${isIn ? 'Payment Received — pick customer' : 'Payment Made — pick supplier'}</h3><button class="cp-btn" data-x>Close</button></div>
      <input class="inv-in" id="pp-s" placeholder="Search ${isIn ? 'customer' : 'supplier'}…" style="margin:4px 0 10px">
      <div class="modal-body" id="pp-list"></div>`, 'big');
    m.querySelector('[data-x]').onclick = () => m.remove();
    const draw = () => { const q = (m.querySelector('#pp-s').value || '').toLowerCase(); const list = parties.filter(x => !q || x.party.toLowerCase().includes(q));
      m.querySelector('#pp-list').innerHTML = list.length ? list.map(x => `<button class="inv-pick-row" data-p="${esc(x.party)}"><b>${esc(x.party)}</b><span>${x.count} open · pending ₹${money(x.out)}${x.oldest > 0 ? ' · ' + x.oldest + 'd overdue' : ''}</span></button>`).join('') : '<div class="so-empty">Nothing pending here 🎉</div>';
      m.querySelectorAll('[data-p]').forEach(b => b.onclick = () => { m.remove(); allocPayment(dir, b.dataset.p, after); }); };
    m.querySelector('#pp-s').oninput = draw; draw();
  }

  function renderPayments() {
    const body = document.getElementById('pm-body');
    body.innerHTML = `<div class="inv-topbtns"><button class="cp-btn small cp-btn-go" id="pm-newrec">＋ Payment Received</button><button class="cp-btn small" id="pm-newpay">＋ Payment Made</button><input class="inv-in" id="pm-pay-s" placeholder="Search party / payment # / ref…" style="max-width:320px"></div>
      <div class="inv-card"><div class="inv-card-h">All payments &amp; receipts</div><div class="modal-body" id="pm-pay-list"></div></div>`;
    const draw = () => {
      const q = (body.querySelector('#pm-pay-s').value || '').toLowerCase();
      const list = loadPays().filter(p => !q || ((p.party || '') + ' ' + (p.payNo || p.targetNo || '') + ' ' + (p.ref || p.note || '')).toLowerCase().includes(q));
      body.querySelector('#pm-pay-list').innerHTML = list.length ? list.map(p => {
        const isIn = p.direction === 'in';
        const nAlloc = Array.isArray(p.allocations) ? p.allocations.length : (p.targetNo ? 1 : 0);
        const docs = Array.isArray(p.allocations) && p.allocations.length ? p.allocations.map(a => a.no).filter(Boolean).join(', ') : (p.targetNo || '');
        return `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${isIn ? '⬇ Received' : '⬆ Paid'} ₹${money(p.amount)}</b> <span class="inv-chip ${isIn ? 'st-ok' : 'st-no'}">${esc(p.party || '')}</span>${p.payNo ? '<span class="inv-chip st-sent">' + esc(p.payNo) + '</span>' : ''}<span class="inv-rec-sub">${esc(p.date || '')} · ${esc(p.mode || '')}${p.account ? ' · ' + esc(p.account) : ''} · ${nAlloc} ${isIn ? 'invoice' : 'bill'}(s)${docs ? ': ' + esc(docs) : ''}${p.advance ? ' · advance ₹' + money(p.advance) : ''}${(p.ref || p.note) ? ' · ' + esc(p.ref || p.note) : ''}</span></div>
        <div class="inv-rec-act"><button class="so-del" data-del="${p.id}">×</button></div></div>`; }).join('') : '<div class="so-empty">No payments recorded yet.</div>';
      body.querySelectorAll('[data-del]').forEach(x => x.onclick = () => { if (confirm('Delete this payment? (balances will update)')) { storePays(loadPays().filter(y => y.id !== x.dataset.del)); draw(); } });
    };
    body.querySelector('#pm-newrec').onclick = () => allocPayment('in', null, draw);
    body.querySelector('#pm-newpay').onclick = () => allocPayment('out', null, draw);
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
