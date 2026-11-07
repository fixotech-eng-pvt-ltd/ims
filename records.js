// ============================================================
// FIXOTECH RECORDS  (office)  — one place for every document
//  Pulls together quotations, proformas, indents, production plans, operator
//  slips, dispatch notes, sales orders, invoices, purchase bills and job work
//  into ONE searchable, filterable register (by type / year / customer / text).
//  Exposes FIXO_RECORDS.query() so Smart IQ can fetch a document on request.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const money = (n) => (window.FIXO_DOC && FIXO_DOC.money) ? FIXO_DOC.money(n) : Number(n || 0).toLocaleString('en-IN');
  const rd = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch (e) { return []; } };
  const parseDate = (s) => {
    if (!s) return null;
    const m = String(s).match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (m) { let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); }
    const t = Date.parse(s); return isNaN(t) ? null : new Date(t);
  };
  const dstr = (d) => d ? d.toLocaleDateString('en-GB') : '';

  // ---- collect every document into a common shape ----
  function collect() {
    const out = [];
    const add = (type, no, customer, dateRaw, amount, status, extra) => { const d = parseDate(dateRaw); out.push({ type, no: no || '—', customer: customer || '—', date: d, dateStr: dstr(d), amount: amount || 0, status: status || '', extra: extra || {} }); };
    rd('fixo_saved_orders').forEach(o => add('Quotation', o.quoteNo || o.qtnNo, o.client || o.clientName, o.date || o.savedAt || o.createdAt, o.total, o.status, { k: 'fixo_saved_orders', id: o.id }));
    rd('fixo_saved_proformas').forEach(o => add('Proforma', o.piNo, o.client || o.clientName, o.date || o.savedAt, o.total, o.status, { k: 'fixo_saved_proformas', id: o.id }));
    rd('fixo_indent_drafts').forEach(o => add('Indent (draft)', o.indentNo, o.indentCustomer || o.customer, o.savedAt || o.indentDate, 0, 'draft', { k: 'fixo_indent_drafts', id: o.id, screen: 'screen-indent' }));
    rd('fixo_factory_indents').forEach(o => {
      add('Indent', o.indentNo, o.indentCustomer || o.customer, o.sentAt || o.indentDate, 0, o.factoryApproved ? 'approved' : 'at factory', { k: 'fixo_factory_indents', id: o.id, screen: 'screen-factory' });
      if (o.docs && o.docs.plan) add('Production Plan', o.indentNo, o.indentCustomer || o.customer, o.sentAt, 0, 'saved', { html: o.docs.plan });
      if (o.docs && o.docs.inspection) add('Inspection Report', o.indentNo, o.indentCustomer || o.customer, o.sentAt, 0, 'saved', { html: o.docs.inspection });
    });
    rd('fixo_dispatch_log').forEach(o => add('Dispatch Note', o.tally || o.indentNo || '', o.customer, o.at, 0, 'dispatched', { vehicle: o.vehicle, tally: o.tally, items: o.items }));
    rd('fixo_job_work').forEach(o => add('Job Work', o.jobNo, o.customer || o.vendor, o.dateSent, o.amount, o.type, { k: 'fixo_job_work', id: o.id, screen: 'screen-jobwork' }));
    rd('fixo_inno_invoices').forEach(o => add('Invoice (Inno)', o.docNo || o.invNo, o.customer, (o.model && o.model.invDate) || o.savedAt, o.total, o.status, { screen: 'screen-invoice' }));
    rd('fixo_inno_sorders').forEach(o => add('Sales Order (Inno)', o.docNo, o.customer, (o.model && o.model.soDate) || o.savedAt, o.total, o.status, {}));
    rd('fixo_inno_quotes').forEach(o => add('Quotation (Inno)', o.docNo, o.customer, (o.model && o.model.qtDate) || o.savedAt, o.total, o.status, {}));
    rd('fixo_inno_purchase_bills').forEach(o => add('Purchase Bill', o.billNo, o.vendor, o.billDate, o.amount, '', {}));
    return out.sort((a, b) => (b.date ? b.date.getTime() : 0) - (a.date ? a.date.getTime() : 0));
  }

  // Public query for Smart IQ: returns best-matching records for a free text.
  function query(text, limit) {
    const q = String(text || '').toLowerCase().trim(); if (!q) return [];
    const words = q.split(/\s+/);
    return collect().map(r => {
      const hay = (r.type + ' ' + r.no + ' ' + r.customer + ' ' + r.status).toLowerCase();
      let score = 0; words.forEach(w => { if (hay.indexOf(w) >= 0) score++; });
      return { r, score };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, limit || 10).map(x => x.r);
  }

  const TYPES = ['Quotation', 'Proforma', 'Indent', 'Indent (draft)', 'Production Plan', 'Inspection Report', 'Dispatch Note', 'Job Work', 'Sales Order (Inno)', 'Invoice (Inno)', 'Quotation (Inno)', 'Purchase Bill'];
  let fType = 'all', fYear = 'all', fCust = 'all', fQ = '';

  function render() {
    const host = document.getElementById('records-app'); if (!host) return;
    const all = collect();
    const years = [...new Set(all.map(r => r.date ? r.date.getFullYear() : null).filter(Boolean))].sort().reverse();
    const custs = [...new Set(all.map(r => r.customer).filter(c => c && c !== '—'))].sort();
    host.innerHTML = `
      <div class="rc-wrap">
        <div class="rc-hero"><div class="rc-hero-l"><span class="rc-hero-ic">🗃️</span><div><h2>Fixotech Records</h2><p>Every quotation · indent · plan · slip · dispatch · invoice — one place</p></div></div></div>
        <div class="rc-filters">
          <input class="rc-in" id="rc-q" placeholder="🔍 Search no. / customer / type…" value="${esc(fQ)}">
          <select id="rc-type"><option value="all">All types</option>${TYPES.map(t => `<option ${t === fType ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <select id="rc-year"><option value="all">All years</option>${years.map(y => `<option ${String(y) === String(fYear) ? 'selected' : ''}>${y}</option>`).join('')}</select>
          <select id="rc-cust"><option value="all">All customers</option>${custs.map(c => `<option ${c === fCust ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select>
          <button class="rc-btn" id="rc-csv">⬇ Export CSV</button>
          <button class="rc-btn go" id="rc-save" title="Save & sync">💾 Save</button>
        </div>
        <div id="rc-body"></div>
      </div>`;
    const wire = () => {
      host.querySelector('#rc-q').oninput = (e) => { fQ = e.target.value; draw(); };
      host.querySelector('#rc-type').onchange = (e) => { fType = e.target.value; draw(); };
      host.querySelector('#rc-year').onchange = (e) => { fYear = e.target.value; draw(); };
      host.querySelector('#rc-cust').onchange = (e) => { fCust = e.target.value; draw(); };
      host.querySelector('#rc-csv').onclick = exportCsv;
      host.querySelector('#rc-save').onclick = () => { try { if (window.FIXO_SYNC && FIXO_SYNC.flush) FIXO_SYNC.flush(); } catch (e) {} try { if (window.FIXO_LOG) FIXO_LOG.activity('records', 'save', {}); } catch (e) {} if (window.FIXO && FIXO.toast) FIXO.toast('Records saved & synced ✓'); };
    };
    function filtered() {
      const q = fQ.toLowerCase();
      return all.filter(r =>
        (fType === 'all' || r.type === fType) &&
        (fYear === 'all' || (r.date && String(r.date.getFullYear()) === String(fYear))) &&
        (fCust === 'all' || r.customer === fCust) &&
        (!q || (r.type + ' ' + r.no + ' ' + r.customer + ' ' + r.status).toLowerCase().includes(q)));
    }
    function draw() {
      const list = filtered();
      const byType = {}; list.forEach(r => byType[r.type] = (byType[r.type] || 0) + 1);
      const chips = Object.keys(byType).sort().map(t => `<span class="rc-chip">${esc(t)} <b>${byType[t]}</b></span>`).join('');
      const rows = list.length ? list.slice(0, 600).map((r, i) => `<tr>
        <td><span class="rc-type rc-t-${r.type.replace(/[^a-z]/gi, '').toLowerCase()}">${esc(r.type)}</span></td>
        <td><b>${esc(r.no)}</b></td><td>${esc(r.customer)}</td><td class="c">${esc(r.dateStr || '—')}</td>
        <td class="r">${r.amount ? '₹' + money(r.amount) : '—'}</td><td class="c">${esc(r.status || '')}</td>
        <td class="c"><button class="rc-mini" data-i="${i}">View</button></td></tr>`).join('') : '<tr><td colspan="7" class="c rc-muted">No records match.</td></tr>';
      host.querySelector('#rc-body').innerHTML = `
        <div class="rc-summary"><b>${list.length}</b> record(s) ${chips ? '· ' + chips : ''}</div>
        <div class="rc-card"><div class="rc-tblwrap"><table class="rc-tbl"><thead><tr><th>Type</th><th>No.</th><th>Customer</th><th class="c">Date</th><th class="r">Amount</th><th class="c">Status</th><th class="c"></th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
      host.querySelectorAll('[data-i]').forEach(b => b.onclick = () => openRecord(list[+b.dataset.i]));
    }
    render._draw = draw; wire(); draw();
  }
  function draw() { if (render._draw) render._draw(); }

  function openRecord(r) {
    const ex = r.extra || {};
    // Documents with saved HTML (production plan / inspection report / dispatch
    // note) open in an in-app preview — reliable, no pop-up blocking.
    if (ex.html) {
      const m = modal(`<h3>${esc(r.type)} — ${esc(r.no)} · ${esc(r.customer)}</h3>
        <iframe class="rc-doc-frame" id="rc-doc-frame"></iframe>
        <div class="rc-modal-act"><button class="rc-btn go" data-print>🖨 Print</button><button class="rc-btn" data-x>Close</button></div>`, 'rc-doc-modal');
      const fr = m.querySelector('#rc-doc-frame'); const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(ex.html); d.close();
      m.querySelector('[data-x]').onclick = () => m.remove();
      m.querySelector('[data-print]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
      return;
    }
    const extraHtml = ex.vehicle || ex.tally ? `<p class="rc-note">${ex.tally ? 'Tally code: <b>' + esc(ex.tally) + '</b><br>' : ''}${ex.vehicle ? 'Vehicle: <b>' + esc(ex.vehicle) + '</b>' : ''}</p>` : '';
    const items = ex.items ? `<div class="rc-items">${ex.items.map(it => `<div>• ${esc(it.desc)} — ${esc(it.qty)} ${esc(it.unit || '')}</div>`).join('')}</div>` : '';
    const m = modal(`<h3>${esc(r.type)} — ${esc(r.no)}</h3>
      <p class="rc-note">Customer: <b>${esc(r.customer)}</b><br>Date: ${esc(r.dateStr || '—')}${r.amount ? '<br>Amount: ₹' + money(r.amount) : ''}${r.status ? '<br>Status: ' + esc(r.status) : ''}</p>
      ${extraHtml}${items}
      <div class="rc-modal-act">${ex.screen ? `<button class="rc-btn go" data-open>Open in app →</button>` : ''}<button class="rc-btn" data-x>Close</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    const op = m.querySelector('[data-open]'); if (op) op.onclick = () => { m.remove(); try { if (window.showScreen) showScreen(ex.screen); else { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); const el = document.getElementById(ex.screen); if (el) el.classList.add('active'); } } catch (e) {} };
  }
  function exportCsv() {
    const list = collect();
    const csv = ['Type,No,Customer,Date,Amount,Status'].concat(list.map(r => [r.type, r.no, r.customer, r.dateStr, r.amount, r.status].map(x => '"' + String(x == null ? '' : x).replace(/"/g, '""') + '"').join(','))).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'fixotech-records.csv'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'rc-overlay'; el.innerHTML = `<div class="rc-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-records"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-records') render();
  });
  window.FIXO_RECORDS = { render, query, collect };
})();
