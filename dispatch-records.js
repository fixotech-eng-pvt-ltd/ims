// ============================================================
// Fixotech DISPATCH RECORDS (office-side app)
// Collects every dispatch note the factory sends ("dispatched"), saved to
// localStorage: fixo_dispatch_log. View, filter, print.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  function load() { try { return JSON.parse(localStorage.getItem('fixo_dispatch_log') || '[]'); } catch (e) { return []; } }
  function save(a) { try { localStorage.setItem('fixo_dispatch_log', JSON.stringify(a)); } catch (e) {} }

  const LOGO = () => (window.FIXO_FACTORY && FIXO_FACTORY.LOGO ? FIXO_FACTORY.LOGO() : '');
  const isMtr = (u) => (window.FIXO_DISPATCH && FIXO_DISPATCH.isMtr) ? FIXO_DISPATCH.isMtr(u) : /mtr|meter/i.test(u || '');
  const acc = (m) => (window.FIXO_DISPATCH && FIXO_DISPATCH.accessories) ? FIXO_DISPATCH.accessories(m) : { nos: Math.round(m / 2.5), plates: Math.round(m / 2.5) * 2, bolts: Math.round(m / 2.5) * 8 };
  const numv = (v) => parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')) || 0;
  // A saved office record → the group shape the factory note builder expects.
  const recToGroup = (r) => ({ customer: r.customer, indentNo: r.indentNo || '', items: (r.items || []).map(it => ({ desc: it.desc, qty: it.qty, unit: it.unit, weight: it.weight, finish: it.finish })) });

  function render() {
    const host = document.getElementById('dispatch-records-app'); if (!host) return;
    const log = load();
    const totItems = log.reduce((n, r) => n + (r.count || (r.items || []).length), 0);
    const logo = LOGO();
    host.innerHTML = `
      <div class="fx-hero" style="background:linear-gradient(120deg,#3730a3,#4f46e5 60%,#6366f1)">
        <div class="fx-hero-title"><span class="fx-hero-ic">📥</span><div><h2>Dispatch Records</h2><p>Dispatch notes received from the factory</p></div></div>
        <div class="fx-hero-right"><div class="fx-stats">
          <div class="fx-stat"><b>${log.length}</b><span>Dispatches</span></div>
          <div class="fx-stat green"><b>${totItems}</b><span>Items sent</span></div>
        </div>${logo ? `<div class="fx-logo-chip"><img src="${logo}" alt="Fixotech" onerror="this.style.display='none'"></div>` : ''}</div>
      </div>
      <div class="fx-main">${log.length ? `<div class="fx-cards">${log.map(recCard).join('')}</div>` : '<div class="fx-empty"><div class="fx-empty-ic">📥</div><h3>No dispatches yet</h3><p>When the factory sends a dispatch note (or marks an order dispatched), it appears here — exactly as prepared on the factory side.</p></div>'}</div>`;
    host.querySelectorAll('[data-view-dr]').forEach(b => b.onclick = () => viewRec(log.find(r => r.id === b.dataset.viewDr)));
    host.querySelectorAll('[data-print-dr]').forEach(b => b.onclick = () => printRec(log.find(r => r.id === b.dataset.printDr)));
    host.querySelectorAll('[data-del-dr]').forEach(b => b.onclick = () => { save(load().filter(r => r.id !== b.dataset.delDr)); render(); });
    markSeen();
  }
  // Card mirrors the factory note: shows finish + auto connector/joint plates & bolt sets.
  function recCard(r) {
    let tp = 0, tb = 0;
    const rows = (r.items || []).map(it => {
      let extra = '';
      if (isMtr(it.unit)) { const a = acc(numv(it.qty)); tp += a.plates; tb += a.bolts; extra = ` <span class="dr-acc">→ ${a.plates} joint plates, ${a.bolts} bolt sets</span>`; }
      return `<tr><td>${esc(String(it.desc).replace(/\n/g, ' '))}${it.finish ? ` <i>(${esc(it.finish)})</i>` : ''}${extra}</td><td class="c">${esc(it.qty)}</td><td class="c">${esc(it.unit)}</td><td class="c">${esc(it.weight || '—')}</td></tr>`;
    }).join('');
    const accRows = (tp || tb) ? `<tr class="dr-acc-row"><td><b>Connector / Joint plate</b></td><td class="c"><b>${tp}</b></td><td class="c">Nos</td><td></td></tr><tr class="dr-acc-row"><td><b>Bolt, Nut &amp; Washer</b></td><td class="c"><b>${tb}</b></td><td class="c">Sets</td><td></td></tr>` : '';
    return `<div class="fx-card">
      <div class="fx-card-top">
        <div><b class="fx-cust">${esc(r.customer)}</b><span class="fx-meta">${r.indentNo ? 'Indent ' + esc(r.indentNo) + ' · ' : ''}${new Date(r.at).toLocaleString('en-IN')} · ${(r.items || []).length} item(s)</span></div>
        <div class="fx-card-btns"><button class="fx-btn" data-view-dr="${r.id}">👁 View note</button><button class="fx-btn fx-print" data-print-dr="${r.id}">🖨 Print note</button><button class="so-del" data-del-dr="${r.id}" title="Remove">&times;</button></div>
      </div>
      <table class="fx-tbl"><thead><tr><th>Description</th><th>Qty</th><th>UOM</th><th>Weight</th></tr></thead>
        <tbody>${rows}${accRows}</tbody></table>
    </div>`;
  }
  // Build the SAME note the factory prepared (logo + accessories + format).
  function noteHtmlFor(r) {
    const date = new Date(r.at).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: '2-digit' });
    if (window.FIXO_DISPATCH && FIXO_DISPATCH.buildNote)
      return FIXO_DISPATCH.buildNote([recToGroup(r)], { date, title: 'DISPATCH NOTE', no: r.indentNo || '' });
    return '<p style="font-family:Arial">Dispatch note unavailable.</p>';
  }
  function viewRec(r) {
    if (!r) return;
    const el = document.createElement('div'); el.className = 'fx-modal-overlay';
    el.innerHTML = `<div class="fx-modal fx-ed-modal"><div class="fx-ed-head"><h3>Dispatch note — ${esc(r.customer)}</h3></div>
      <div class="fx-ed-body"><iframe id="dr-frame"></iframe></div>
      <div class="fx-modal-actions"><button class="fx-btn" id="dr-close">Close</button><button class="fx-btn fx-btn-go" id="dr-print2">🖨 Print</button></div></div>`;
    document.body.appendChild(el);
    const fr = el.querySelector('#dr-frame'); const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(noteHtmlFor(r)); d.close();
    el.addEventListener('click', e => { if (e.target === el) el.remove(); });
    el.querySelector('#dr-close').onclick = () => el.remove();
    el.querySelector('#dr-print2').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }
  function printRec(r) {
    if (!r) return;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(noteHtmlFor(r)); w.document.close();
    setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
  }
  // ---- unseen badge on the office tile ----
  function unseen() { return load().filter(r => !r.seenOffice).length; }
  function markSeen() { const l = load(); let ch = false; l.forEach(r => { if (!r.seenOffice) { r.seenOffice = true; ch = true; } }); if (ch) save(l); refreshBadge(); }
  function refreshBadge() {
    const b = document.getElementById('dr-badge'); if (!b) return; const n = unseen();
    if (n) { b.hidden = false; b.textContent = n; } else b.hidden = true;
  }
  document.addEventListener('DOMContentLoaded', () => {
    refreshBadge();
    document.querySelectorAll('[data-open-app="screen-dispatch-records"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-dispatch-records') render();
  });
  window.FIXO_DISPATCH_RECORDS = { render, refreshBadge };
})();
