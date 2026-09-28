// ============================================================
// Fixotech — TRADING (Phase 8)
// A SEPARATE trading-stock module for bought-in items (threaded rod, anchor
// fasteners, channel nuts, washers, bolts — M08/M10/M12 …). Priced, with
// opening / receipt / issue / balance and a reorder level. Shared by the OFFICE
// and the DISPATCH department (synced across devices); dispatch owns it. Office
// can raise a REQUEST → dispatch fulfils it. Kept entirely separate from the
// manufacturing inventory & order billing — never mixed. Sales here can later
// feed Customer Base → Tally as their own stream.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const uid = (p) => (p || 't') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toISOString().slice(0, 10);
  const userName = () => { try { const u = window.FIXO_AUTH && FIXO_AUTH.currentUser(); return u ? (u.name || u.email || '') : ''; } catch (e) { return ''; } };
  const LOGO = () => (typeof LOGO_IMG !== 'undefined' && LOGO_IMG) ? LOGO_IMG : '';

  const IK = 'fixo_trading_items', RK = 'fixo_trading_requests', SEEDF = 'fixo_trading_seed_v1';
  const load = () => { try { return JSON.parse(localStorage.getItem(IK) || '[]') || []; } catch (e) { return []; } };
  const save = (a) => { try { localStorage.setItem(IK, JSON.stringify(a)); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(IK); } catch (e) {} };
  const loadReq = () => { try { return JSON.parse(localStorage.getItem(RK) || '[]') || []; } catch (e) { return []; } };
  const saveReq = (a) => { try { localStorage.setItem(RK, JSON.stringify(a.slice(0, 300))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(RK); } catch (e) {} };

  const balanceOf = (it) => num(it.opening) + (it.txns || []).reduce((s, t) => s + num(t.receipt) - num(t.issue), 0);
  const statusOf = (it) => { const b = balanceOf(it); if (b <= 0) return 'out'; if (num(it.reorder) > 0 && b <= num(it.reorder)) return 'reorder'; return 'ok'; };
  const findItem = (id) => load().find(x => x.id === id);

  function seedOnce() {
    if (localStorage.getItem(SEEDF) === '1') return;
    if (!load().length) {
      const seed = [
        ['M08 Threaded Rod', 'Nos', 45], ['M10 Threaded Rod', 'Nos', 55], ['M12 Threaded Rod', 'Nos', 70],
        ['M08 Anchor Fastener', 'Nos', 12], ['M10 Anchor Fastener', 'Nos', 16], ['M12 Anchor Fastener', 'Nos', 22],
        ['Channel Nut M08', 'Nos', 6], ['Channel Nut M10', 'Nos', 8], ['Channel Nut M12', 'Nos', 10],
        ['Washer M08', 'Nos', 2], ['Washer M10', 'Nos', 3], ['Washer M12', 'Nos', 4],
        ['Hex Bolt M08', 'Nos', 5], ['Hex Bolt M10', 'Nos', 7], ['Hex Bolt M12', 'Nos', 9]
      ];
      save(seed.map(([name, unit, rate]) => ({ id: 'trd-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''), name, unit, rate, opening: 0, reorder: 50, txns: [] })));
    }
    localStorage.setItem(SEEDF, '1');
  }

  let tab = 'stock', q = '';

  function render() {
    seedOnce();
    const host = document.getElementById('trading-app'); if (!host) return;
    const all = load();
    const out = all.filter(i => statusOf(i) === 'out').length, ro = all.filter(i => statusOf(i) === 'reorder').length;
    const pend = loadReq().filter(r => r.status !== 'fulfilled').length;
    const logo = LOGO();
    host.innerHTML = `
      <div class="fx-hero trd-hero">
        <div class="fx-hero-title"><span class="fx-hero-ic">🛒</span><div><h2>Trading</h2><p>Bought-in stock · fasteners &amp; hardware · office ⇄ dispatch</p></div></div>
        <div class="fx-hero-right"><div class="fx-stats">
          <div class="fx-stat"><b>${all.length}</b><span>Products</span></div>
          <div class="fx-stat amber"><b>${ro}</b><span>Reorder</span></div>
          <div class="fx-stat red"><b>${out}</b><span>Out</span></div>
        </div>${logo ? `<div class="fx-logo-chip"><img src="${logo}" alt="Fixotech" onerror="this.style.display='none'"></div>` : ''}</div>
      </div>
      <div class="fx-tabs">
        <button class="fx-tab ${tab === 'stock' ? 'active' : ''}" data-t="stock">📦 Stock</button>
        <button class="fx-tab ${tab === 'requests' ? 'active' : ''}" data-t="requests">📤 Requests ${pend ? `<span class="fx-badge">${pend}</span>` : ''}</button>
      </div>
      <div id="trd-body"></div>`;
    host.querySelectorAll('.fx-tab').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    if (tab === 'stock') renderStock(); else renderRequests();
  }

  // ---------- STOCK ----------
  function renderStock() {
    const body = document.getElementById('trd-body'); if (!body) return;
    const ql = q.trim().toLowerCase();
    const list = (ql ? load().filter(i => i.name.toLowerCase().includes(ql)) : load()).slice().sort((a, b) => a.name.localeCompare(b.name));
    const rows = list.length ? list.map(it => {
      const bal = balanceOf(it), st = statusOf(it);
      const badge = st === 'out' ? '<span class="fx-prio-tag">⚠ OUT</span>' : st === 'reorder' ? '<span class="trd-ro">REORDER</span>' : '<span class="fx-fi-ok">✓ OK</span>';
      return `<tr>
        <td><b class="trd-name" data-ledger="${it.id}">${esc(it.name)}</b></td>
        <td class="c">${esc(it.unit)}</td>
        <td class="r">${money(it.rate)}</td>
        <td class="c"><b class="${bal <= 0 ? 'inv-neg' : num(it.reorder) > 0 && bal <= num(it.reorder) ? 'inv-lowtx' : 'inv-ok'}">${bal}</b></td>
        <td class="c">${esc(it.reorder || 0)}</td>
        <td class="c">${badge}</td>
        <td class="c trd-actions">
          <button class="fx-btn fx-btn-sm" data-recv="${it.id}" title="Receipt (stock in)">➕ In</button>
          <button class="fx-btn fx-btn-sm" data-issue="${it.id}" title="Issue / sold (stock out)">➖ Out</button>
          <button class="fx-btn fx-btn-sm" data-edit="${it.id}" title="Edit product">✎</button>
        </td></tr>`;
    }).join('') : `<tr><td colspan="7" class="c fx-meta" style="padding:22px">${ql ? 'No product matches “' + esc(q) + '”.' : 'No trading products yet — tap “Add product”.'}</td></tr>`;
    body.innerHTML = `
      <div class="inv-toolbar">
        <input class="fx-in inv-search" id="trd-search" placeholder="🔎 Search product…" value="${esc(q)}">
        <button class="fx-btn" id="trd-print">🖨 Print list</button>
        <button class="fx-btn fx-btn-go" id="trd-recv">➕ Stock received</button>
        <button class="fx-btn" id="trd-add">✎ Add product</button>
      </div>
      <div class="fx-card" style="overflow-x:auto"><table class="fx-tbl trd-tbl"><thead><tr>
        <th>Product</th><th>Unit</th><th>Rate</th><th>Balance</th><th>Reorder</th><th>Status</th><th></th>
      </tr></thead><tbody>${rows}</tbody></table></div>`;
    const s = body.querySelector('#trd-search');
    s.oninput = () => { q = s.value; renderStock(); const n = document.getElementById('trd-search'); if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); } };
    body.querySelector('#trd-add').onclick = () => editItem(null);
    body.querySelector('#trd-recv').onclick = () => openReceive();
    body.querySelector('#trd-print').onclick = () => printList(list);
    body.querySelectorAll('[data-ledger]').forEach(b => b.onclick = () => openLedger(b.dataset.ledger));
    body.querySelectorAll('[data-recv]').forEach(b => b.onclick = () => addTxn(b.dataset.recv, 'receipt'));
    body.querySelectorAll('[data-issue]').forEach(b => b.onclick = () => addTxn(b.dataset.issue, 'issue'));
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editItem(b.dataset.edit));
  }

  function editItem(id) {
    const it = id ? findItem(id) : null;
    const m = modal(`<h3>${it ? '✎ Edit' : '➕ Add'} trading product</h3>
      <div class="fx-modal-body inv-form">
        <label class="fx-lab">Product name</label><input class="fx-in" id="te-name" value="${esc(it ? it.name : '')}" placeholder="e.g. M10 Threaded Rod">
        <div class="inv-form-row">
          <div><label class="fx-lab">Unit</label><input class="fx-in" id="te-unit" value="${esc(it ? it.unit : 'Nos')}"></div>
          <div><label class="fx-lab">Rate ₹</label><input class="fx-in" id="te-rate" type="number" min="0" step="0.01" value="${it ? num(it.rate) : ''}"></div>
        </div>
        <div class="inv-form-row">
          <div><label class="fx-lab">Opening stock</label><input class="fx-in" id="te-open" type="number" min="0" value="${it ? num(it.opening) : 0}" ${it ? 'disabled' : ''}></div>
          <div><label class="fx-lab">Reorder level</label><input class="fx-in" id="te-ro" type="number" min="0" value="${it ? num(it.reorder) : 50}"></div>
        </div>
      </div>
      <div class="fx-modal-actions">${it ? '<button class="so-del" id="te-del">Delete</button>' : ''}<button class="fx-btn" id="te-x">Cancel</button><button class="fx-btn fx-btn-go" id="te-ok">Save</button></div>`);
    m.querySelector('#te-x').onclick = () => closeModal(m);
    if (it) m.querySelector('#te-del').onclick = () => { if (!confirm('Delete ' + it.name + '?')) return; save(load().filter(x => x.id !== it.id)); closeModal(m); render(); };
    m.querySelector('#te-ok').onclick = () => {
      const name = m.querySelector('#te-name').value.trim(); if (!name) { toast('Enter a name'); return; }
      const list = load();
      if (it) { const t = list.find(x => x.id === it.id); t.name = name; t.unit = m.querySelector('#te-unit').value.trim() || 'Nos'; t.rate = num(m.querySelector('#te-rate').value); t.reorder = num(m.querySelector('#te-ro').value); }
      else { list.push({ id: 'trd-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Math.random().toString(36).slice(2, 4), name, unit: m.querySelector('#te-unit').value.trim() || 'Nos', rate: num(m.querySelector('#te-rate').value), opening: num(m.querySelector('#te-open').value), reorder: num(m.querySelector('#te-ro').value), txns: [] }); }
      save(list); closeModal(m); render(); toast('Saved');
    };
  }

  function addTxn(id, kind) {
    const it = findItem(id); if (!it) return;
    const isRecv = kind === 'receipt';
    const m = modal(`<h3>${isRecv ? '➕ Stock in — receipt' : '➖ Stock out — issue / sold'} · ${esc(it.name)}</h3>
      <div class="fx-modal-body inv-form">
        <p class="fx-note">Balance: <b>${balanceOf(it)} ${esc(it.unit)}</b> · Rate ${money(it.rate)}</p>
        <div class="inv-form-row">
          <div><label class="fx-lab">Date</label><input class="fx-in" id="tx-date" type="date" value="${today()}"></div>
          <div><label class="fx-lab">Quantity (${esc(it.unit)})</label><input class="fx-in" id="tx-qty" type="number" min="0" placeholder="0"></div>
          <div><label class="fx-lab">${isRecv ? 'Bill No.' : 'Ref / Invoice'}</label><input class="fx-in" id="tx-bill" placeholder="${isRecv ? 'Supplier bill' : 'Customer / invoice'}"></div>
        </div>
        <label class="fx-lab">${isRecv ? 'Supplier' : 'Sold to / Customer'}</label><input class="fx-in" id="tx-part" placeholder="${isRecv ? 'Supplier name' : 'Customer name'}">
        <p class="fx-note" id="tx-warn"></p>
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="tx-x">Cancel</button><button class="fx-btn fx-btn-go" id="tx-ok">${isRecv ? 'Add receipt' : 'Record issue'}</button></div>`);
    const qi = m.querySelector('#tx-qty'), warn = m.querySelector('#tx-warn');
    if (!isRecv) qi.oninput = () => { const after = balanceOf(it) - num(qi.value); warn.innerHTML = after < 0 ? `⚠ Only <b>${balanceOf(it)}</b> in stock.` : (num(qi.value) ? `✓ ${after} ${esc(it.unit)} will remain · value ${money(num(qi.value) * num(it.rate))}` : ''); };
    m.querySelector('#tx-x').onclick = () => closeModal(m);
    m.querySelector('#tx-ok').onclick = () => {
      const qty = num(qi.value); if (qty <= 0) { toast('Enter a quantity'); return; }
      const list = load(); const t = list.find(x => x.id === id);
      const rec = { id: uid('tx'), date: m.querySelector('#tx-date').value || today(), particulars: m.querySelector('#tx-part').value.trim(), bill: m.querySelector('#tx-bill').value.trim(), remarks: '' };
      if (isRecv) rec.receipt = qty; else { rec.issue = qty; rec.amount = Math.round(qty * num(t.rate)); }
      t.txns = t.txns || []; t.txns.push(rec); save(list); closeModal(m); render();
      toast(isRecv ? ('Received ' + qty + ' ' + it.unit) : ('Issued ' + qty + ' ' + it.unit + ' · ' + money(rec.amount || 0)));
    };
  }

  // Quick "stock received" that can add a new product on the fly.
  function openReceive() {
    const all = load().slice().sort((a, b) => a.name.localeCompare(b.name));
    const m = modal(`<h3>➕ Trading stock received</h3>
      <div class="fx-modal-body inv-form">
        <label class="fx-lab">Product</label>
        <input class="fx-in" id="rc-name" list="trc-list" placeholder="e.g. M10 Threaded Rod — or a new name" autocomplete="off">
        <datalist id="trc-list">${all.map(i => `<option value="${esc(i.name)}">`).join('')}</datalist>
        <div class="inv-form-row" style="margin-top:8px">
          <div><label class="fx-lab">Quantity</label><input class="fx-in" id="rc-qty" type="number" min="0" placeholder="0"></div>
          <div><label class="fx-lab">Unit</label><input class="fx-in" id="rc-unit" value="Nos"></div>
          <div><label class="fx-lab">Rate ₹</label><input class="fx-in" id="rc-rate" type="number" min="0" step="0.01" placeholder="sell rate"></div>
        </div>
        <div class="inv-form-row" style="margin-top:8px">
          <div><label class="fx-lab">Supplier</label><input class="fx-in" id="rc-sup" placeholder="Supplier"></div>
          <div><label class="fx-lab">Bill No.</label><input class="fx-in" id="rc-bill" placeholder="Bill"></div>
        </div>
        <p class="fx-note" id="rc-hint"></p>
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="rc-x">Cancel</button><button class="fx-btn fx-btn-go" id="rc-ok">✓ Add to stock</button></div>`);
    const nameEl = m.querySelector('#rc-name'), unitEl = m.querySelector('#rc-unit'), rateEl = m.querySelector('#rc-rate'), hint = m.querySelector('#rc-hint');
    const matchOf = () => all.find(x => x.name.toLowerCase() === nameEl.value.trim().toLowerCase());
    nameEl.oninput = () => { const it = matchOf(); if (it) { unitEl.value = it.unit; rateEl.value = num(it.rate) || ''; hint.innerHTML = `Existing · balance <b>${balanceOf(it)} ${esc(it.unit)}</b>.`; } else if (nameEl.value.trim()) hint.textContent = 'New product — will be created.'; else hint.textContent = ''; };
    m.querySelector('#rc-x').onclick = () => closeModal(m);
    m.querySelector('#rc-ok').onclick = () => {
      const name = nameEl.value.trim(), qty = num(m.querySelector('#rc-qty').value);
      if (!name) { toast('Enter the product'); return; } if (qty <= 0) { toast('Enter the quantity'); return; }
      const list = load(); let it = list.find(x => x.name.toLowerCase() === name.toLowerCase());
      const txn = { id: uid('tx'), date: today(), particulars: m.querySelector('#rc-sup').value.trim(), bill: m.querySelector('#rc-bill').value.trim(), remarks: '', receipt: qty };
      if (it) { it.txns = it.txns || []; it.txns.push(txn); if (num(rateEl.value)) it.rate = num(rateEl.value); }
      else { it = { id: 'trd-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Math.random().toString(36).slice(2, 4), name, unit: unitEl.value.trim() || 'Nos', rate: num(rateEl.value), opening: 0, reorder: 50, txns: [txn] }; list.push(it); }
      save(list); closeModal(m); render(); toast('✓ Added ' + qty + ' ' + it.unit + ' of ' + name);
    };
  }

  function openLedger(id) {
    const it = findItem(id); if (!it) return;
    let run = num(it.opening);
    const rows = [`<tr class="inv-open"><td>—</td><td><i>Opening</i></td><td></td><td class="c"></td><td class="c"></td><td class="c"><b>${run}</b></td></tr>`];
    (it.txns || []).forEach(t => { run += num(t.receipt) - num(t.issue); rows.push(`<tr><td>${esc(t.date || '')}</td><td>${esc(t.particulars || '')}${t.bill ? ' · ' + esc(t.bill) : ''}</td><td class="c">${t.receipt ? '+' + num(t.receipt) : ''}</td><td class="c">${t.issue ? '−' + num(t.issue) : ''}</td><td class="c">${t.amount ? money(t.amount) : ''}</td><td class="c"><b>${run}</b></td></tr>`); });
    const m = modal(`<div class="fx-ed-head"><h3>Stock card — ${esc(it.name)}</h3><span class="fx-ed-hint">Rate ${money(it.rate)} · Balance <b>${balanceOf(it)} ${esc(it.unit)}</b></span></div>
      <div class="inv-ledger-wrap"><table class="fx-tbl inv-ledger"><thead><tr><th>Date</th><th>Particulars</th><th>In</th><th>Out</th><th>Value</th><th>Balance</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="tl-x">Close</button></div>`, 'inv-ledger-modal');
    m.querySelector('#tl-x').onclick = () => closeModal(m);
  }

  // ---------- REQUESTS (office → dispatch) ----------
  function renderRequests() {
    const body = document.getElementById('trd-body'); if (!body) return;
    const reqs = loadReq().slice().sort((a, b) => (b.at || '').localeCompare(a.at || ''));
    const rows = reqs.length ? reqs.map(r => {
      const done = r.status === 'fulfilled';
      return `<div class="trd-req ${done ? 'done' : ''}">
        <div class="trd-req-main"><b>${done ? '✓ Fulfilled' : '⏳ Pending'}</b>
          <span class="fx-meta">${esc((r.at || '').slice(0, 16).replace('T', ' '))}${r.by ? ' · by ' + esc(r.by) : ''}${r.fulfilledBy ? ' · done by ' + esc(r.fulfilledBy) : ''}</span>
          <div class="trd-req-items">${(r.items || []).map(i => `${esc(i.qty)} ${esc(i.unit || '')} × <b>${esc(i.name)}</b>`).join(' · ')}</div>
          ${r.note ? `<div class="fx-meta">📝 ${esc(r.note)}</div>` : ''}</div>
        <div class="trd-req-act">
          <button class="fx-btn fx-btn-sm" data-rprint="${r.id}">🖨 Print</button>
          ${done ? '' : `<button class="fx-btn fx-btn-sm fx-btn-go" data-rfulfil="${r.id}">✓ Fulfil</button>`}
          <button class="fx-btn fx-btn-sm" data-rdel="${r.id}">🗑</button>
        </div></div>`;
    }).join('') : `<div class="idp-empty" style="padding:30px;text-align:center;color:#94a3b8">No requests yet. The office can raise one for the dispatch department to fulfil.</div>`;
    body.innerHTML = `<div class="inv-toolbar"><span class="fx-meta">Office raises a request → Dispatch fulfils it.</span><button class="fx-btn fx-btn-go" id="trd-newreq">➕ New request</button></div>${rows}`;
    body.querySelector('#trd-newreq').onclick = () => newRequest();
    body.querySelectorAll('[data-rfulfil]').forEach(b => b.onclick = () => { const rs = loadReq(); const r = rs.find(x => x.id === b.dataset.rfulfil); if (r) { r.status = 'fulfilled'; r.fulfilledAt = new Date().toISOString(); r.fulfilledBy = userName(); saveReq(rs); toast('Marked fulfilled'); renderRequests(); } });
    body.querySelectorAll('[data-rdel]').forEach(b => b.onclick = () => { if (!confirm('Delete this request?')) return; saveReq(loadReq().filter(x => x.id !== b.dataset.rdel)); renderRequests(); });
    body.querySelectorAll('[data-rprint]').forEach(b => b.onclick = () => { const r = loadReq().find(x => x.id === b.dataset.rprint); if (r) printRequest(r); });
  }
  function newRequest() {
    const all = load().slice().sort((a, b) => a.name.localeCompare(b.name));
    let lines = [{ name: '', qty: '', unit: 'Nos' }];
    const m = modal(`<h3>➕ New trading request</h3>
      <div class="fx-modal-body inv-form">
        <p class="fx-note">Request items for the <b>dispatch department</b> to fulfil.</p>
        <div id="tr-lines"></div>
        <button class="fx-btn" id="tr-add" style="margin-top:6px">＋ Add line</button>
        <label class="fx-lab" style="margin-top:10px">Note (optional)</label><input class="fx-in" id="tr-note" placeholder="e.g. urgent for site delivery">
      </div>
      <div class="fx-modal-actions"><button class="fx-btn" id="tr-x">Cancel</button><button class="fx-btn fx-btn-go" id="tr-ok">Send request</button></div>`);
    const dl = `<datalist id="tr-dl">${all.map(i => `<option value="${esc(i.name)}">`).join('')}</datalist>`;
    const draw = () => { m.querySelector('#tr-lines').innerHTML = dl + lines.map((l, i) => `<div class="inv-form-row tr-line" data-i="${i}" style="margin-bottom:6px"><div style="flex:2"><input class="fx-in tr-name" list="tr-dl" placeholder="Product" value="${esc(l.name)}"></div><div><input class="fx-in tr-qty" type="number" min="0" placeholder="Qty" value="${esc(l.qty)}"></div><div><input class="fx-in tr-unit" placeholder="Unit" value="${esc(l.unit)}"></div></div>`).join(''); bind(); };
    const bind = () => { m.querySelectorAll('.tr-line').forEach(row => { const i = +row.dataset.i; row.querySelector('.tr-name').oninput = e => lines[i].name = e.target.value; row.querySelector('.tr-qty').oninput = e => lines[i].qty = e.target.value; row.querySelector('.tr-unit').oninput = e => lines[i].unit = e.target.value; }); };
    draw();
    m.querySelector('#tr-add').onclick = () => { lines.push({ name: '', qty: '', unit: 'Nos' }); draw(); };
    m.querySelector('#tr-x').onclick = () => closeModal(m);
    m.querySelector('#tr-ok').onclick = () => {
      const items = lines.filter(l => (l.name || '').trim() && num(l.qty) > 0).map(l => ({ name: l.name.trim(), qty: num(l.qty), unit: l.unit.trim() || 'Nos' }));
      if (!items.length) { toast('Add at least one item'); return; }
      const rs = loadReq(); rs.unshift({ id: uid('req'), at: new Date().toISOString(), by: userName(), items, note: m.querySelector('#tr-note').value.trim(), status: 'pending' });
      saveReq(rs); closeModal(m); toast('Request sent to dispatch'); tab = 'requests'; render();
    };
  }

  // ---------- prints ----------
  function shell(title, inner) {
    const logo = LOGO();
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      *{box-sizing:border-box}@page{size:A4;margin:12mm}body{font-family:Arial,sans-serif;color:#000;font-size:12px;padding:6mm}
      .hd{display:flex;align-items:center;gap:12px;border-bottom:2px solid #000;padding-bottom:8px}.hd img{height:44px}h1{font-size:20px;margin:0}
      .title{text-align:center;font-weight:bold;font-size:16px;margin:12px 0}table{width:100%;border-collapse:collapse;margin-top:8px}
      th,td{border:1px solid #555;padding:6px 8px}th{background:#eef}.r{text-align:right}.c{text-align:center}</style></head><body>
      <div class="hd">${logo ? `<img src="${logo}">` : ''}<div><h1>FIXOTECH ENGINEERING</h1><div>Trading Division</div></div></div>${inner}
      <p style="margin-top:22px">For FIXOTECH ENGINEERING</p></body></html>`;
  }
  function printList(list) {
    const rows = list.map((it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.name)}</td><td class="c">${esc(it.unit)}</td><td class="r">${money(it.rate)}</td><td class="c">${balanceOf(it)}</td><td class="c">${esc(it.reorder || 0)}</td><td class="c">${statusOf(it) === 'out' ? 'OUT' : statusOf(it) === 'reorder' ? 'REORDER' : 'OK'}</td></tr>`).join('');
    openPrint(shell('Trading Stock', `<div class="title">TRADING STOCK LIST</div><div>Date: ${new Date().toLocaleDateString('en-IN')}</div>
      <table><thead><tr><th>#</th><th>Product</th><th>Unit</th><th>Rate</th><th>Balance</th><th>Reorder</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`));
  }
  function printRequest(r) {
    const rows = (r.items || []).map((it, i) => `<tr><td class="c">${i + 1}</td><td>${esc(it.name)}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td></tr>`).join('');
    openPrint(shell('Trading Request', `<div class="title">TRADING REQUEST</div><div>Date: ${esc((r.at || '').slice(0, 10))} · Raised by: ${esc(r.by || '')}</div>
      <table><thead><tr><th>#</th><th>Product</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${rows}</tbody></table>${r.note ? `<p><b>Note:</b> ${esc(r.note)}</p>` : ''}
      <div style="margin-top:20px">To be fulfilled by the Dispatch Department.</div>`));
  }
  function openPrint(html) { const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; } w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350); }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'fx-modal-overlay'; el.innerHTML = `<div class="fx-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) closeModal(el); }); return el; }
  function closeModal(m) { const o = m.classList && m.classList.contains('fx-modal-overlay') ? m : m.closest('.fx-modal-overlay'); if (o) o.remove(); }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-trading"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-trading') render();
  });
  window.addEventListener('fixo:sync', (e) => { if (document.body.dataset.screen === 'screen-trading') { const keys = (e.detail && e.detail.keys) || []; if (!keys.length || keys.indexOf(IK) >= 0 || keys.indexOf(RK) >= 0) render(); } });

  window.FIXO_TRADING = { render };
})();
