// Fixotech Inno Structures LLP — Inno Reports
// Financial reports across quotations, sales orders and invoices:
//   • Operations snapshot ("in one shot"): today's sales, what's pending, and
//     where every deal/project stands in the Quotation → Sales Order → Invoice chain.
//   • Period breakdowns: Weekly, Monthly, Quarterly, Yearly.
//   • Exports: PDF report + Presentation (slide) format, each with monthly + quarterly.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before reports.js'); return; }
  const D = FIXO_DOC, esc = D.esc, money = D.money, totals = D.totals;
  const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const QUARTERS = [['Q1', 'Apr–Jun', 0], ['Q2', 'Jul–Sep', 3], ['Q3', 'Oct–Dec', 6], ['Q4', 'Jan–Mar', 9]];

  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };
  const finMonth = (d) => (d.getMonth() - 3 + 12) % 12;
  const recDate = (r) => parseDate((r.model && r.model.invDate) || r.savedAt) || new Date();
  const recFy = (r) => D.finYear(recDate(r));
  const records = (type) => D.loadStore(D.SAVED_KEYS[type]);
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const money0 = (n) => '₹' + money(n);

  function fyList() { const set = {}; ['QT', 'SO', 'INV'].forEach(t => records(t).forEach(r => { set[recFy(r)] = 1; })); set[D.finYear()] = 1; return Object.keys(set).sort().reverse(); }

  function agg(type, fy) {
    const out = { count: 0, taxable: 0, tax: 0, grand: 0, byMonth: FY_MONTHS.map(() => ({ count: 0, taxable: 0, tax: 0, grand: 0 })), byStatus: {} };
    records(type).forEach(r => {
      if (recFy(r) !== fy) return;
      const t = r.model ? totals(r.model) : { taxable: 0, tax: 0, grand: r.total || 0 };
      const mi = finMonth(recDate(r)); out.count++; out.taxable += t.taxable; out.tax += t.tax; out.grand += t.grand;
      const b = out.byMonth[mi]; b.count++; b.taxable += t.taxable; b.tax += t.tax; b.grand += t.grand;
      const st = r.status || 'draft'; out.byStatus[st] = (out.byStatus[st] || 0) + 1;
    });
    return out;
  }
  const quarters = (a) => QUARTERS.map(q => { const s = { label: q[0], span: q[1], count: 0, taxable: 0, tax: 0, grand: 0 }; for (let i = q[2]; i < q[2] + 3; i++) { s.count += a.byMonth[i].count; s.taxable += a.byMonth[i].taxable; s.tax += a.byMonth[i].tax; s.grand += a.byMonth[i].grand; } return s; });

  // Link each quotation → its sales order → its invoice (via source refs) for the
  // "where is every deal" board. Also surface SOs / invoices created directly.
  function pipeline(fy) {
    const QT = records('QT'), SO = records('SO'), INV = records('INV');
    const inFy = (r) => !fy || recFy(r) === fy;
    const rows = [];
    const soByQt = {}, invBySo = {};
    SO.forEach(s => { if (s.source && s.source.docNo) soByQt[s.source.docNo] = s; });
    INV.forEach(i => { if (i.source && i.source.docNo) invBySo[i.source.docNo] = i; });
    const usedSO = {}, usedINV = {};
    QT.filter(inFy).forEach(q => {
      const so = soByQt[q.docNo]; if (so) usedSO[so.id] = 1;
      const inv = so ? invBySo[so.docNo] : null; if (inv) usedINV[inv.id] = 1;
      rows.push({ customer: q.customer, qt: q, so: so, inv: inv });
    });
    SO.filter(s => inFy(s) && !usedSO[s.id]).forEach(so => { const inv = invBySo[so.docNo]; if (inv) usedINV[inv.id] = 1; rows.push({ customer: so.customer, qt: null, so: so, inv: inv }); });
    INV.filter(i => inFy(i) && !usedINV[i.id]).forEach(inv => rows.push({ customer: inv.customer, qt: null, so: null, inv: inv }));
    return rows;
  }
  function stageOf(row) {
    const inv = row.inv, so = row.so, qt = row.qt;
    if (inv && (inv.status === 'approved')) return { t: '✅ Invoiced & approved', cls: 'st-ok', won: 1 };
    if (inv) return { t: '🧾 Invoiced (' + (inv.status || 'draft') + ')', cls: 'st-sent', won: 1 };
    if (so && so.status === 'confirmed') return { t: '📦 SO confirmed — to invoice', cls: 'st-sent' };
    if (so && so.status === 'cancelled') return { t: '✕ SO cancelled', cls: 'st-no', lost: 1 };
    if (so) return { t: '📦 Sales order ' + (so.status || 'draft'), cls: 'st-draft' };
    if (qt && qt.status === 'approved') return { t: '👍 Quote accepted — to sales order', cls: 'st-ok' };
    if (qt && qt.status === 'declined') return { t: '❌ Quote declined', cls: 'st-no', lost: 1 };
    if (qt && qt.status === 'sent') return { t: '📤 Quote sent — awaiting reply', cls: 'st-sent' };
    return { t: '🧮 Quotation draft', cls: 'st-draft' };
  }

  let fy = null, view = 'Monthly';
  function render() {
    const host = document.getElementById('reports-app'); if (!host) return;
    const fys = fyList(); if (!fy || fys.indexOf(fy) < 0) fy = fys[0] || D.finYear();
    const inv = agg('INV', fy), qt = agg('QT', fy), so = agg('SO', fy);
    const tile = (lbl, val, sub) => `<div class="rp-tile"><div class="rp-tile-v">${val}</div><div class="rp-tile-l">${esc(lbl)}</div>${sub ? `<div class="rp-tile-s">${esc(sub)}</div>` : ''}</div>`;
    const conv = qt.count ? Math.round(inv.count / qt.count * 100) : 0;

    // ----- operations snapshot -----
    const today = new Date();
    const todayCount = (type) => records(type).filter(r => sameDay(recDate(r), today));
    const invToday = todayCount('INV'), qtToday = todayCount('QT'), soToday = todayCount('SO');
    const sum = (arr) => arr.reduce((s, r) => s + (r.total || 0), 0);
    const rows = pipeline(fy).map(r => ({ r, s: stageOf(r) }));
    const won = rows.filter(x => x.s.won).length, lost = rows.filter(x => x.s.lost).length, active = rows.length - won - lost;
    const openQuotes = rows.filter(x => x.r.qt && !x.r.so && (x.r.qt.status === 'draft' || x.r.qt.status === 'sent')).length;
    const soToInvoice = rows.filter(x => x.r.so && x.r.so.status !== 'cancelled' && x.r.so.status !== 'invoiced' && !x.r.inv).length;
    const invPending = rows.filter(x => x.r.inv && x.r.inv.status !== 'approved').length;

    const chip = (lbl, val, cls) => `<div class="rp-chip ${cls || ''}"><span class="rp-chip-v">${val}</span><span class="rp-chip-l">${esc(lbl)}</span></div>`;
    const boardRows = rows.length ? rows.map(x => {
      const c = (d) => d ? `<b>${esc(d.docNo)}</b><br><span class="rp-mini">${esc((d.status || 'draft'))}</span>` : '<span class="rp-mini">—</span>';
      return `<tr><td>${esc(x.r.customer || '—')}</td><td>${c(x.r.qt)}</td><td>${c(x.r.so)}</td><td>${c(x.r.inv)}</td><td><span class="inv-chip ${x.s.cls}">${x.s.t}</span></td></tr>`;
    }).join('') : '<tr><td colspan="5" class="c rp-mini">No deals yet this financial year.</td></tr>';

    // ----- period section (Monthly / Quarterly) -----
    const qs = quarters(inv);
    const periodBars = view === 'Quarterly'
      ? (() => { const mx = Math.max(1, ...qs.map(q => q.grand)); return qs.map(q => `<div class="rp-bar"><div class="rp-bar-track"><div class="rp-bar-fill" style="height:${Math.round(q.grand / mx * 100)}%" title="${money0(q.grand)}"></div></div><div class="rp-bar-lbl">${q.label}</div></div>`).join(''); })()
      : (() => { const mx = Math.max(1, ...inv.byMonth.map(b => b.grand)); return inv.byMonth.map((b, i) => `<div class="rp-bar"><div class="rp-bar-track"><div class="rp-bar-fill" style="height:${Math.round(b.grand / mx * 100)}%" title="${money0(b.grand)}"></div></div><div class="rp-bar-lbl">${FY_MONTHS[i]}</div></div>`).join(''); })();
    const periodTable = view === 'Quarterly'
      ? qs.map(q => `<tr><td>${q.label} <span class="rp-mini">${q.span}</span></td><td class="c">${q.count}</td><td class="r">${money(q.taxable)}</td><td class="r">${money(q.tax)}</td><td class="r b">${money(q.grand)}</td></tr>`).join('')
      : inv.byMonth.map((b, i) => `<tr><td>${FY_MONTHS[i]}</td><td class="c">${b.count}</td><td class="r">${money(b.taxable)}</td><td class="r">${money(b.tax)}</td><td class="r b">${money(b.grand)}</td></tr>`).join('');

    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${D.CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">INNO <span class="inv-h-bold">REPORTS</span></div><div class="inv-h-sub">Operations &amp; Financial</div></div></div>
          <div class="inv-header-right"><div class="inv-h-no">FY ${esc(fy)}</div><div class="inv-h-co">${esc(D.CO.name)}</div></div>
        </div>
        <div class="inv-topbtns">
          <label class="rp-fy">Financial Year <select id="rp-fy">${fys.map(y => `<option ${y === fy ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
          <button class="cp-btn small cp-btn-go" id="rp-pdf">🖨 PDF report</button>
          <button class="cp-btn small" id="rp-present">📊 Presentation</button>
        </div>

        <div class="inv-card rp-ops">
          <div class="inv-card-h">🟢 Operations snapshot — ${esc(today.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</div>
          <div class="rp-chips">
            ${chip('Invoiced today', invToday.length + ' · ' + money0(sum(invToday)), 'c-ok')}
            ${chip('Quotes today', qtToday.length, 'c-info')}
            ${chip('Orders today', soToday.length, 'c-info')}
            ${chip('Open quotations', openQuotes < 0 ? 0 : openQuotes, 'c-warn')}
            ${chip('SO → to invoice', soToInvoice, 'c-warn')}
            ${chip('Invoices pending', invPending, 'c-warn')}
            ${chip('Won', won, 'c-ok')}
            ${chip('Lost', lost, 'c-no')}
            ${chip('In progress', active, 'c-info')}
          </div>
        </div>

        <div class="inv-card">
          <div class="inv-card-h">📋 Deal / project board — where is every sale (Quotation → Sales Order → Invoice)</div>
          <div class="inv-items-wrap"><table class="inv-tbl rp-tbl"><thead><tr><th>Customer / Project</th><th>Quotation</th><th>Sales Order</th><th>Invoice</th><th>Stage — where are we</th></tr></thead><tbody>${boardRows}</tbody></table></div>
        </div>

        <div class="rp-tiles">
          ${tile('Invoiced (incl. GST)', money0(inv.grand), inv.count + ' invoice' + (inv.count === 1 ? '' : 's'))}
          ${tile('Taxable value', money0(inv.taxable), 'GST ' + money0(inv.tax))}
          ${tile('Quotations', money0(qt.grand), qt.count + ' quote' + (qt.count === 1 ? '' : 's'))}
          ${tile('Sales Orders', money0(so.grand), so.count + ' order' + (so.count === 1 ? '' : 's'))}
          ${tile('Quote → Invoice', conv + '%', 'conversion')}
        </div>

        <div class="inv-card">
          <div class="inv-card-h">Invoiced value — FY ${esc(fy)}
            <span class="rp-seg"><button class="rp-seg-b ${view === 'Monthly' ? 'active' : ''}" data-view="Monthly">Monthly</button><button class="rp-seg-b ${view === 'Quarterly' ? 'active' : ''}" data-view="Quarterly">Quarterly</button></span></div>
          <div class="rp-bars">${periodBars}</div>
        </div>

        <div class="inv-card"><div class="inv-card-h">${view} breakdown</div>
          <div class="inv-items-wrap"><table class="inv-tbl rp-tbl"><thead><tr><th>${view === 'Quarterly' ? 'Quarter' : 'Month'}</th><th>Invoices</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead>
          <tbody>${periodTable}<tr class="rp-tot"><td><b>Total</b></td><td class="c b">${inv.count}</td><td class="r b">${money(inv.taxable)}</td><td class="r b">${money(inv.tax)}</td><td class="r b">₹${money(inv.grand)}</td></tr></tbody></table></div>
        </div>
      </div>`;

    document.getElementById('rp-fy').onchange = e => { fy = e.target.value; render(); };
    host.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; render(); });
    document.getElementById('rp-pdf').onclick = () => exportReport(fy, false);
    document.getElementById('rp-present').onclick = () => exportReport(fy, true);
  }

  // ----- PDF + Presentation export (both include monthly + quarterly + pipeline) -----
  function exportReport(fy, presentation) {
    const inv = agg('INV', fy), qt = agg('QT', fy), so = agg('SO', fy);
    const qs = quarters(inv);
    const rows = pipeline(fy).map(r => ({ r, s: stageOf(r) }));
    const won = rows.filter(x => x.s.won).length, lost = rows.filter(x => x.s.lost).length;
    const conv = qt.count ? Math.round(inv.count / qt.count * 100) : 0;
    const monthRows = inv.byMonth.map((b, i) => `<tr><td>${FY_MONTHS[i]}</td><td class="c">${b.count}</td><td class="r">${money(b.taxable)}</td><td class="r">${money(b.tax)}</td><td class="r">${money(b.grand)}</td></tr>`).join('');
    const qRows = qs.map(q => `<tr><td>${q.label} <span class="mini">${q.span}</span></td><td class="c">${q.count}</td><td class="r">${money(q.taxable)}</td><td class="r">${money(q.tax)}</td><td class="r">${money(q.grand)}</td></tr>`).join('');
    const boardRows = rows.map(x => { const d = (dd) => dd ? dd.docNo + ' (' + (dd.status || 'draft') + ')' : '—'; return `<tr><td>${esc(x.r.customer || '—')}</td><td>${d(x.r.qt)}</td><td>${d(x.r.so)}</td><td>${d(x.r.inv)}</td><td>${esc(x.s.t)}</td></tr>`; }).join('') || '<tr><td colspan="5" class="c">No deals</td></tr>';
    const kpis = [['Total Invoiced', '₹' + money(inv.grand)], ['Taxable', '₹' + money(inv.taxable)], ['GST Collected', '₹' + money(inv.tax)], ['Invoices', inv.count], ['Quotations', qt.count], ['Sales Orders', so.count], ['Won / Lost', won + ' / ' + lost], ['Quote→Invoice', conv + '%']];

    const common = `
      *{box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0}
      h1{color:#1e3a8a;margin:0}h2{color:#1e3a8a;font-size:15px;margin:16px 0 6px}
      table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #bbb;padding:5px 7px;font-size:11px}th{background:#eef}
      .c{text-align:center}.r{text-align:right}.tot td,.mini{font-size:10px}.tot td{font-weight:bold;background:#f5f7ff}
      .kpis{display:flex;gap:10px;flex-wrap:wrap}.kpi{flex:1;min-width:110px;border:1px solid #ccc;border-radius:8px;padding:10px}
      .kpi .v{font-size:17px;font-weight:800;color:#1e3a8a}.kpi .l{font-size:9.5px;color:#555;text-transform:uppercase;letter-spacing:.4px}
      .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e3a8a;padding-bottom:8px}`;
    const kpiHtml = kpis.map(k => `<div class="kpi"><div class="v">${k[1]}</div><div class="l">${esc(k[0])}</div></div>`).join('');
    const header = `<div class="hd"><div><h1>${presentation ? 'Business Review' : 'Financial Report'}</h1><div style="color:#555;font-size:11px">Financial Year ${esc(fy)} (Apr–Mar)</div></div><div style="text-align:right"><b>${esc(D.CO.name)}</b><br><span style="color:#555;font-size:11px">GSTIN ${esc(D.CO.gstin)}</span></div></div>`;
    const sections = `
      <h2>Key numbers</h2><div class="kpis">${kpiHtml}</div>
      <h2>Monthly breakdown — Invoices</h2><table><thead><tr><th>Month</th><th>Inv</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead><tbody>${monthRows}<tr class="tot"><td>Total</td><td class="c">${inv.count}</td><td class="r">${money(inv.taxable)}</td><td class="r">${money(inv.tax)}</td><td class="r">${money(inv.grand)}</td></tr></tbody></table>
      <h2>Quarterly breakdown</h2><table><thead><tr><th>Quarter</th><th>Inv</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead><tbody>${qRows}</tbody></table>
      <h2>Deal / project board — Quotation → Sales Order → Invoice</h2><table><thead><tr><th>Customer</th><th>Quotation</th><th>Sales Order</th><th>Invoice</th><th>Stage</th></tr></thead><tbody>${boardRows}</tbody></table>`;

    let html;
    if (presentation) {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Business Review FY ${esc(fy)}</title><style>${common}
        @page{size:A4 landscape;margin:0}
        .slide{width:297mm;height:209mm;padding:16mm 18mm;page-break-after:always;display:flex;flex-direction:column;background:linear-gradient(135deg,#fff,#f3f6ff)}
        .slide h1{font-size:30px}.slide h2{font-size:22px;margin:0 0 12px}
        .cover{justify-content:center;align-items:center;text-align:center;background:linear-gradient(135deg,#1e3a8a,#3b82f6);color:#fff}
        .cover h1{color:#fff;font-size:40px}.cover .fy{font-size:20px;margin-top:10px;opacity:.9}
        .slide .kpi .v{font-size:24px}.slide .kpi{min-width:150px;padding:16px}
        .slide table{font-size:13px}.slide th,.slide td{padding:7px 9px}
      </style></head><body>
        <div class="slide cover"><div><div style="font-size:16px;letter-spacing:3px">FIXOTECH INNO STRUCTURES LLP</div><h1>Business Review</h1><div class="fy">Financial Year ${esc(fy)}</div></div></div>
        <div class="slide"><h2>Key numbers</h2><div class="kpis">${kpiHtml}</div></div>
        <div class="slide"><h2>Monthly performance</h2><table><thead><tr><th>Month</th><th>Inv</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead><tbody>${monthRows}<tr class="tot"><td>Total</td><td class="c">${inv.count}</td><td class="r">${money(inv.taxable)}</td><td class="r">${money(inv.tax)}</td><td class="r">${money(inv.grand)}</td></tr></tbody></table></div>
        <div class="slide"><h2>Quarterly performance</h2><table><thead><tr><th>Quarter</th><th>Inv</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead><tbody>${qRows}</tbody></table></div>
        <div class="slide"><h2>Deal / project board</h2><table><thead><tr><th>Customer</th><th>Quotation</th><th>Sales Order</th><th>Invoice</th><th>Stage</th></tr></thead><tbody>${boardRows}</tbody></table></div>
      </body></html>`;
    } else {
      html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report FY ${esc(fy)}</title><style>${common}@page{size:A4;margin:12mm}body{padding:6mm}</style></head><body>
        ${header}${sections}
        <div style="margin-top:20px;color:#666;font-size:10px;border-top:1px solid #ccc;padding-top:6px">Generated ${new Date().toLocaleString('en-IN')} · Fixotech Inno Structures LLP — Inno Reports</div></body></html>`;
    }
    const w = window.open('', '_blank');
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 350); }
    else {
      const m = document.createElement('div'); m.className = 'inv-overlay'; m.innerHTML = `<div class="inv-modal big"><div class="inv-ed-head"><h3>${presentation ? 'Presentation' : 'PDF report'} — FY ${esc(fy)}</h3><button class="cp-btn" data-x>Close</button></div><iframe class="inv-frame"></iframe><div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-print>🖨 Print / Save PDF</button></div></div>`;
      document.body.appendChild(m); const fr = m.querySelector('iframe'); const d = fr.contentDocument; d.open(); d.write(html); d.close();
      m.querySelector('[data-x]').onclick = () => m.remove(); m.querySelector('[data-print]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-reports"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-reports') render();
  });
  window.FIXO_REPORTS = { render };
})();
