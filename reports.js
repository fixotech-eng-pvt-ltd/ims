// Fixotech Inno Structures LLP — Inno Reports
// Financial reports (monthly + yearly) across quotations, sales orders and
// invoices, plus a printable presentation report. Reads the shared stores.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before reports.js'); return; }
  const D = FIXO_DOC, esc = D.esc, money = D.money, totals = D.totals;
  const FY_MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];

  const parseDate = (s) => { const m = String(s || '').match(/(\d{1,2})\/(\d{1,2})\/(\d{2,4})/); if (!m) return null; let y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[2] - 1, +m[1]); };
  const finMonth = (d) => (d.getMonth() - 3 + 12) % 12;   // Apr=0 … Mar=11
  const recDate = (r) => parseDate((r.model && r.model.invDate) || r.savedAt) || new Date();
  const recFy = (r) => D.finYear(recDate(r));
  const records = (type) => D.loadStore(D.SAVED_KEYS[type]);

  function fyList() {
    const set = {};
    ['QT', 'SO', 'INV'].forEach(t => records(t).forEach(r => { set[recFy(r)] = 1; }));
    const cur = D.finYear(); set[cur] = 1;
    return Object.keys(set).sort().reverse();
  }

  // Aggregate one store for a FY → {count, taxable, tax, grand, byMonth[12], byStatus{}}
  function agg(type, fy) {
    const out = { count: 0, taxable: 0, tax: 0, grand: 0, byMonth: FY_MONTHS.map(() => ({ count: 0, taxable: 0, tax: 0, grand: 0 })), byStatus: {} };
    records(type).forEach(r => {
      if (recFy(r) !== fy) return;
      const t = r.model ? totals(r.model) : { taxable: 0, tax: 0, grand: r.total || 0 };
      const mi = finMonth(recDate(r));
      out.count++; out.taxable += t.taxable; out.tax += t.tax; out.grand += t.grand;
      const b = out.byMonth[mi]; b.count++; b.taxable += t.taxable; b.tax += t.tax; b.grand += t.grand;
      const st = r.status || 'draft'; out.byStatus[st] = (out.byStatus[st] || 0) + 1;
    });
    return out;
  }

  let fy = null;
  function render() {
    const host = document.getElementById('reports-app'); if (!host) return;
    const fys = fyList(); if (!fy || fys.indexOf(fy) < 0) fy = fys[0] || D.finYear();
    const inv = agg('INV', fy), qt = agg('QT', fy), so = agg('SO', fy);
    const tile = (lbl, val, sub) => `<div class="rp-tile"><div class="rp-tile-v">${val}</div><div class="rp-tile-l">${esc(lbl)}</div>${sub ? `<div class="rp-tile-s">${esc(sub)}</div>` : ''}</div>`;
    const maxM = Math.max(1, ...inv.byMonth.map(b => b.grand));
    const conv = qt.count ? Math.round(inv.count / qt.count * 100) : 0;

    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${D.CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">INNO <span class="inv-h-bold">REPORTS</span></div><div class="inv-h-sub">Financial — Monthly &amp; Yearly</div></div></div>
          <div class="inv-header-right"><div class="inv-h-no">FY ${esc(fy)}</div><div class="inv-h-co">${esc(D.CO.name)}</div></div>
        </div>
        <div class="inv-topbtns">
          <label class="rp-fy">Financial Year
            <select id="rp-fy">${fys.map(y => `<option ${y === fy ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
          <button class="cp-btn small cp-btn-go" id="rp-print">🖨 Presentation report</button>
        </div>

        <div class="rp-tiles">
          ${tile('Invoiced (incl. GST)', '₹' + money(inv.grand), inv.count + ' invoice' + (inv.count === 1 ? '' : 's'))}
          ${tile('Taxable value', '₹' + money(inv.taxable), 'GST ₹' + money(inv.tax))}
          ${tile('Quotations', '₹' + money(qt.grand), qt.count + ' quote' + (qt.count === 1 ? '' : 's'))}
          ${tile('Sales Orders', '₹' + money(so.grand), so.count + ' order' + (so.count === 1 ? '' : 's'))}
          ${tile('Quote → Invoice', conv + '%', 'conversion')}
        </div>

        <div class="inv-card"><div class="inv-card-h">Monthly — invoiced value (FY ${esc(fy)})</div>
          <div class="rp-bars">${inv.byMonth.map((b, i) => `<div class="rp-bar"><div class="rp-bar-track"><div class="rp-bar-fill" style="height:${Math.round(b.grand / maxM * 100)}%" title="₹${money(b.grand)}"></div></div><div class="rp-bar-lbl">${FY_MONTHS[i]}</div></div>`).join('')}</div>
        </div>

        <div class="inv-card"><div class="inv-card-h">Monthly breakdown</div>
          <div class="inv-items-wrap"><table class="inv-tbl rp-tbl"><thead><tr><th>Month</th><th>Invoices</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead>
          <tbody>${inv.byMonth.map((b, i) => `<tr><td>${FY_MONTHS[i]}</td><td class="c">${b.count}</td><td class="r">${money(b.taxable)}</td><td class="r">${money(b.tax)}</td><td class="r b">${money(b.grand)}</td></tr>`).join('')}
          <tr class="rp-tot"><td><b>Total</b></td><td class="c b">${inv.count}</td><td class="r b">${money(inv.taxable)}</td><td class="r b">${money(inv.tax)}</td><td class="r b">₹${money(inv.grand)}</td></tr></tbody></table></div>
        </div>

        <div class="inv-two">
          <div class="inv-card"><div class="inv-card-h">Invoice status</div>${statusRows(inv.byStatus)}</div>
          <div class="inv-card"><div class="inv-card-h">Pipeline this FY</div>
            <div class="inv-tr"><span>Quotations</span><b>${qt.count} · ₹${money(qt.grand)}</b></div>
            <div class="inv-tr"><span>Sales Orders</span><b>${so.count} · ₹${money(so.grand)}</b></div>
            <div class="inv-tr inv-grand"><span>Invoices</span><b>${inv.count} · ₹${money(inv.grand)}</b></div>
          </div>
        </div>
      </div>`;

    document.getElementById('rp-fy').onchange = e => { fy = e.target.value; render(); };
    document.getElementById('rp-print').onclick = () => printReport(fy, inv, qt, so);
  }

  function statusRows(by) {
    const keys = Object.keys(by); if (!keys.length) return '<div class="so-empty">No invoices yet.</div>';
    return keys.map(k => `<div class="inv-tr"><span>${esc(k)}</span><b>${by[k]}</b></div>`).join('');
  }

  function printReport(fy, inv, qt, so) {
    const rowsHtml = inv.byMonth.map((b, i) => `<tr><td>${FY_MONTHS[i]}</td><td class="c">${b.count}</td><td class="r">${money(b.taxable)}</td><td class="r">${money(b.tax)}</td><td class="r">${money(b.grand)}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Report FY ${esc(fy)}</title><style>
      *{box-sizing:border-box}@page{size:A4;margin:12mm}body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;padding:6mm}
      .hd{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #1e3a8a;padding-bottom:8px}
      .hd h1{margin:0;color:#1e3a8a;font-size:20px}.hd .sub{color:#555;font-size:11px}
      h2{color:#1e3a8a;font-size:14px;margin:18px 0 6px}
      .tiles{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}.tile{flex:1;min-width:120px;border:1px solid #ccc;border-radius:8px;padding:10px}
      .tile .v{font-size:17px;font-weight:800;color:#1e3a8a}.tile .l{font-size:10px;color:#555;text-transform:uppercase;letter-spacing:.5px}
      table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #bbb;padding:5px 7px;font-size:11px}th{background:#eef}
      .c{text-align:center}.r{text-align:right}.tot td{font-weight:bold;background:#f5f7ff}
      .foot{margin-top:24px;color:#666;font-size:10px;border-top:1px solid #ccc;padding-top:6px}
    </style></head><body>
      <div class="hd"><div><h1>Financial Report</h1><div class="sub">Financial Year ${esc(fy)} (Apr–Mar)</div></div>
        <div style="text-align:right"><b>${esc(D.CO.name)}</b><br><span class="sub">GSTIN ${esc(D.CO.gstin)}</span></div></div>
      <div class="tiles">
        <div class="tile"><div class="v">₹${money(inv.grand)}</div><div class="l">Total Invoiced</div></div>
        <div class="tile"><div class="v">₹${money(inv.taxable)}</div><div class="l">Taxable Value</div></div>
        <div class="tile"><div class="v">₹${money(inv.tax)}</div><div class="l">GST Collected</div></div>
        <div class="tile"><div class="v">${inv.count}</div><div class="l">Invoices</div></div>
      </div>
      <h2>Monthly breakdown — Invoices</h2>
      <table><thead><tr><th>Month</th><th>Invoices</th><th>Taxable ₹</th><th>GST ₹</th><th>Total ₹</th></tr></thead>
        <tbody>${rowsHtml}<tr class="tot"><td>Total</td><td class="c">${inv.count}</td><td class="r">${money(inv.taxable)}</td><td class="r">${money(inv.tax)}</td><td class="r">${money(inv.grand)}</td></tr></tbody></table>
      <h2>Sales pipeline</h2>
      <table><thead><tr><th>Stage</th><th>Count</th><th>Value ₹</th></tr></thead><tbody>
        <tr><td>Quotations</td><td class="c">${qt.count}</td><td class="r">${money(qt.grand)}</td></tr>
        <tr><td>Sales Orders</td><td class="c">${so.count}</td><td class="r">${money(so.grand)}</td></tr>
        <tr class="tot"><td>Invoices</td><td class="c">${inv.count}</td><td class="r">${money(inv.grand)}</td></tr></tbody></table>
      <div class="foot">Generated ${new Date().toLocaleString('en-IN')} · Fixotech Inno Structures LLP — Inno Reports</div>
    </body></html>`;
    const w = window.open('', '_blank'); if (w) { w.document.write(html); w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300); }
    else { const m = document.createElement('div'); m.className = 'inv-overlay'; m.innerHTML = `<div class="inv-modal big"><div class="inv-ed-head"><h3>Report FY ${esc(fy)}</h3><button class="cp-btn" data-x>Close</button></div><iframe class="inv-frame"></iframe><div class="inv-modal-act"><button class="cp-btn cp-btn-go" data-print>🖨 Print</button></div></div>`; document.body.appendChild(m); const fr = m.querySelector('iframe'); const d = fr.contentDocument; d.open(); d.write(html); d.close(); m.querySelector('[data-x]').onclick = () => m.remove(); m.querySelector('[data-print]').onclick = () => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} }; }
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-reports"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-reports') render();
  });
  window.FIXO_REPORTS = { render };
})();
