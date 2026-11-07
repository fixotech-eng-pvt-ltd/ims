// ============================================================
// FIXOTECH — JOB WORK (outsourcing)  [factory side]
//  Material leaves the factory for an outside process — laser cutting, rolling,
//  powder coating, etc. — gets done, and comes back. Tracks what went out, to
//  whom, for which order, how much has returned, the cost, and what's still
//  pending at the vendor. (Powder-coating detailed spec can be extended later.)
// ============================================================
(function () {
  const KEY = 'fixo_job_work';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const uid = (p) => (p || 'jw-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');
  const money = (n) => (window.FIXO_DOC && FIXO_DOC.money) ? FIXO_DOC.money(n) : Number(n || 0).toLocaleString('en-IN');
  const nf = (n) => { const v = Math.round(num(n) * 100) / 100; return v % 1 === 0 ? v.toFixed(0) : v.toFixed(2); };

  const TYPES = ['Laser Cutting', 'Rolling', 'Powder Coating', 'Bending', 'Galvanising', 'Machining', 'Other'];
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } };
  const store = (a) => { try { localStorage.setItem(KEY, JSON.stringify(a.slice(0, 3000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(KEY); } catch (e) {} };
  const find = (id) => load().find(j => j.id === id);
  const logAct = (a, d) => { try { if (window.FIXO_LOG) FIXO_LOG.activity('jobwork', a, d || {}); } catch (e) {} };
  const back = (j) => (j.receipts || []).reduce((s, r) => s + num(r.qty), 0);
  const statusOf = (j) => { const b = back(j); if (b <= 0) return 'sent'; if (b + 0.001 < num(j.qtySent)) return 'partial'; return 'received'; };
  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };

  let view = 'open';
  function render() {
    const host = document.getElementById('jobwork-app'); if (!host) return;
    const logo = (typeof LOGO_IMG !== 'undefined' && LOGO_IMG) ? LOGO_IMG : '';
    host.innerHTML = `
      <div class="jw-wrap">
        <div class="jw-hero">
          <div class="jw-hero-l"><span class="jw-hero-ic">🔄</span><div><h2>Job Work — Outsourcing</h2><p>Laser cutting · rolling · powder coating — sent out &amp; received back</p></div></div>
          ${logo ? `<div class="jw-logo"><img src="${logo}" onerror="this.style.display='none'"></div>` : ''}
        </div>
        <div class="jw-tabs">
          <button class="jw-tab ${view === 'open' ? 'active' : ''}" data-v="open">📤 Out at vendor</button>
          <button class="jw-tab ${view === 'all' ? 'active' : ''}" data-v="all">📋 All jobs</button>
          <button class="jw-tab ${view === 'vendor' ? 'active' : ''}" data-v="vendor">🏭 By vendor</button>
        </div>
        <div class="jw-bar"><button class="jw-btn go" id="jw-new">＋ New job work</button><input class="jw-in" id="jw-s" placeholder="Search vendor / customer / item…"></div>
        <div id="jw-body"></div>
      </div>`;
    host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    host.querySelector('#jw-new').onclick = () => editJob(null);
    const s = host.querySelector('#jw-s'); s.oninput = () => draw(s.value);
    draw('');
  }

  function draw(q) {
    const body = document.getElementById('jw-body'); if (!body) return;
    q = (q || '').toLowerCase();
    let list = load().filter(j => !q || ((j.vendor || '') + ' ' + (j.customer || '') + ' ' + (j.item || '') + ' ' + (j.type || '') + ' ' + (j.jobNo || '')).toLowerCase().includes(q));
    if (view === 'open') list = list.filter(j => statusOf(j) !== 'received');
    list.sort((a, b) => (b.dateSent && a.dateSent) ? (parseDate(b.dateSent) || 0) - (parseDate(a.dateSent) || 0) : 0);
    const outCount = load().filter(j => statusOf(j) !== 'received').length;
    const outVal = load().filter(j => statusOf(j) !== 'received').reduce((s, j) => s + num(j.amount), 0);
    const tiles = `<div class="jw-tiles">
      <div class="jw-tile"><div class="jw-tile-v">${outCount}</div><div class="jw-tile-l">Jobs out at vendors</div></div>
      <div class="jw-tile"><div class="jw-tile-v">₹${money(outVal)}</div><div class="jw-tile-l">Value out (est.)</div></div>
      <div class="jw-tile"><div class="jw-tile-v">${load().length}</div><div class="jw-tile-l">Total jobs</div></div></div>`;

    if (view === 'vendor') { body.innerHTML = tiles + vendorView(list); wire(body); return; }
    const rows = list.length ? list.map(j => {
      const st = statusOf(j), b = back(j), rem = num(j.qtySent) - b;
      const chip = st === 'received' ? '<span class="jw-chip ok">✓ Received</span>' : st === 'partial' ? '<span class="jw-chip warn">Part received</span>' : '<span class="jw-chip out">At vendor</span>';
      const overdue = st !== 'received' && (() => { const d = parseDate(j.expReturn); return d && d < new Date(); })();
      return `<div class="jw-row ${st}">
        <div class="jw-row-main">
          <b>${esc(j.type)} — ${esc(j.vendor || '—')}</b> ${chip}${overdue ? '<span class="jw-chip late">overdue</span>' : ''}
          <div class="jw-sub">${esc(j.jobNo || '')}${j.customer ? ' · ' + esc(j.customer) : ''}${j.indentNo ? ' · Indent ' + esc(j.indentNo) : ''} · ${esc(j.item || '')}</div>
          <div class="jw-sub">Sent ${esc(j.dateSent || '')}${j.expReturn ? ' · due ' + esc(j.expReturn) : ''} · ${nf(j.qtySent)} ${esc(j.unit || '')} out · ${nf(b)} back${rem > 0.001 ? ' · <b>' + nf(rem) + ' pending</b>' : ''}${j.amount ? ' · ₹' + money(j.amount) : ''}</div>
        </div>
        <div class="jw-row-act">
          ${st !== 'received' ? `<button class="jw-mini go" data-recv="${j.id}">↩ Receive</button>` : ''}
          <button class="jw-mini" data-edit="${j.id}">✎</button>
          <button class="jw-mini x" data-del="${j.id}">🗑</button>
        </div></div>`;
    }).join('') : '<div class="jw-empty">No job work here. Click ＋ New job work to send material out for an outside process.</div>';
    body.innerHTML = tiles + `<div class="jw-card">${rows}</div>`;
    wire(body);
  }
  function vendorView(list) {
    const by = {}; list.forEach(j => { (by[j.vendor || '—'] = by[j.vendor || '—'] || []).push(j); });
    return Object.keys(by).sort().map(v => {
      const jobs = by[v]; const out = jobs.filter(j => statusOf(j) !== 'received').length; const val = jobs.reduce((s, j) => s + num(j.amount), 0);
      const rows = jobs.map(j => `<div class="jw-vrow"><span>${esc(j.type)} · ${esc(j.item || '')}</span><span>${nf(j.qtySent)} out · ${nf(back(j))} back · ${esc(statusOf(j))}</span></div>`).join('');
      return `<div class="jw-card"><div class="jw-vhead"><b>${esc(v)}</b><span>${jobs.length} job(s) · ${out} open · ₹${money(val)}</span></div>${rows}</div>`;
    }).join('') || '<div class="jw-empty">No vendors yet.</div>';
  }
  function wire(body) {
    body.querySelectorAll('[data-recv]').forEach(b => b.onclick = () => receiveJob(b.dataset.recv));
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editJob(find(b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Delete this job?')) { store(load().filter(x => x.id !== b.dataset.del)); render(); } });
  }

  function editJob(j) {
    const isNew = !j; j = j || { id: uid(), jobNo: nextNo(), type: 'Powder Coating', vendor: '', customer: '', indentNo: '', item: '', qtySent: '', unit: 'Nos', dateSent: today(), expReturn: '', amount: '', color: '', notes: '', receipts: [] };
    const opt = (v) => TYPES.map(t => `<option ${t === v ? 'selected' : ''}>${esc(t)}</option>`).join('');
    const m = modal(`<h3>${isNew ? 'New' : 'Edit'} job work</h3>
      <div class="jw-fields">
        <label>Process<select id="j-type">${opt(j.type)}</select></label>
        <label>Job no.<input id="j-no" value="${esc(j.jobNo)}"></label>
        <label>Vendor (where it's sent)<input id="j-ven" value="${esc(j.vendor)}" placeholder="e.g. Super Roll Tech"></label>
        <label>For customer<input id="j-cust" value="${esc(j.customer)}" placeholder="customer"></label>
        <label>Indent / order no.<input id="j-ind" value="${esc(j.indentNo)}"></label>
        <label>Item / material<input id="j-item" value="${esc(j.item)}" placeholder="what is sent"></label>
        <label>Qty sent<input id="j-qty" type="number" step="any" value="${esc(j.qtySent)}"></label>
        <label>Unit<input id="j-unit" value="${esc(j.unit)}"></label>
        <label>Date sent<input id="j-ds" value="${esc(j.dateSent)}"></label>
        <label>Expected return<input id="j-er" value="${esc(j.expReturn)}" placeholder="dd/mm/yyyy"></label>
        <label>Cost / charge ₹<input id="j-amt" type="number" step="any" value="${esc(j.amount)}"></label>
        <label id="j-colwrap" ${j.type === 'Powder Coating' ? '' : 'style="display:none"'}>Colour / shade<input id="j-col" value="${esc(j.color || '')}" placeholder="e.g. RAL 7035 / Siemens grey"></label>
        <label class="jw-wide">Notes<input id="j-notes" value="${esc(j.notes || '')}"></label>
      </div>
      <div class="jw-modal-act"><button class="jw-btn go" data-save>💾 Save</button><button class="jw-btn" data-x>Cancel</button></div>`, 'big');
    m.querySelector('#j-type').onchange = (e) => { m.querySelector('#j-colwrap').style.display = e.target.value === 'Powder Coating' ? '' : 'none'; };
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-save]').onclick = () => {
      const vendor = m.querySelector('#j-ven').value.trim(); if (!vendor) { toast('Vendor required'); return; }
      Object.assign(j, { type: m.querySelector('#j-type').value, jobNo: m.querySelector('#j-no').value.trim(), vendor, customer: m.querySelector('#j-cust').value.trim(), indentNo: m.querySelector('#j-ind').value.trim(), item: m.querySelector('#j-item').value.trim(), qtySent: num(m.querySelector('#j-qty').value), unit: m.querySelector('#j-unit').value.trim() || 'Nos', dateSent: m.querySelector('#j-ds').value.trim() || today(), expReturn: m.querySelector('#j-er').value.trim(), amount: num(m.querySelector('#j-amt').value), color: m.querySelector('#j-col') ? m.querySelector('#j-col').value.trim() : '', notes: m.querySelector('#j-notes').value.trim() });
      const list = load().filter(x => x.id !== j.id); list.unshift(j); store(list); m.remove(); logAct('job_saved', { type: j.type, vendor: j.vendor, customer: j.customer, qty: j.qtySent }); toast('Job saved'); render();
    };
  }
  function receiveJob(id) {
    const j = find(id); if (!j) return;
    const b = back(j), rem = num(j.qtySent) - b;
    const m = modal(`<h3>↩ Receive back — ${esc(j.type)}</h3>
      <div class="jw-target">${esc(j.vendor)} · ${esc(j.item || '')}<br>${nf(j.qtySent)} ${esc(j.unit)} sent · ${nf(b)} already back · <b>${nf(rem)} pending</b></div>
      <div class="jw-fields">
        <label>Qty received now<input id="r-qty" type="number" step="any" value="${nf(rem)}"></label>
        <label>Date<input id="r-date" value="${today()}"></label>
        <label>Rejected / short (optional)<input id="r-rej" type="number" step="any" placeholder="0"></label>
        <label class="jw-wide">Note<input id="r-note" placeholder="e.g. 2 pcs rework"></label>
      </div>
      <div class="jw-modal-act"><button class="jw-btn go" data-save>💾 Save receipt</button><button class="jw-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-save]').onclick = () => {
      const qty = num(m.querySelector('#r-qty').value); if (qty <= 0) { toast('Enter a quantity'); return; }
      j.receipts = j.receipts || []; j.receipts.push({ qty, date: m.querySelector('#r-date').value.trim() || today(), rejected: num(m.querySelector('#r-rej').value), note: m.querySelector('#r-note').value.trim(), at: new Date().toISOString() });
      const list = load().filter(x => x.id !== j.id); list.unshift(j); store(list); m.remove(); logAct('job_received', { type: j.type, vendor: j.vendor, qty }); toast('Receipt recorded'); render();
    };
  }
  function nextNo() { const n = load().length + 1; const d = new Date(); return 'JW/' + String(d.getFullYear()).slice(2) + '-' + String(n).padStart(3, '0'); }

  function toast(m) { return (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m)); }
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'jw-overlay'; el.innerHTML = `<div class="jw-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-jobwork"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-jobwork') render();
  });
  window.FIXO_JOBWORK = { render, load };
})();
