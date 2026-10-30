// Fixotech Inno Structures LLP — Inno Inventory Management System (standalone app)
// Full-page view of the SAME inventory master (fixo_inno_inventory) that the
// Quotation / Sales Order / Invoice apps use — fully interlinked: edit an item
// here and it changes everywhere, and sales still auto-reduce stock.
(function () {
  if (!window.FIXO_DOC) { console.error('inno-core.js must load before inno-inventory.js'); return; }
  const D = FIXO_DOC, esc = D.esc;
  let panel = null;

  function render() {
    const host = document.getElementById('inno-inv-app'); if (!host) return;
    host.innerHTML = `
      <div class="inv-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${D.CO.logo}" onerror="this.style.display='none'" class="inv-header-logo"><div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">INNO <span class="inv-h-bold">INVENTORY</span></div><div class="inv-h-sub">Inventory Management System</div></div></div>
          <div class="inv-header-right"><div class="inv-h-co">${esc(D.CO.name)}</div></div>
        </div>
        <div class="inv-topbtns">
          <button class="cp-btn small cp-btn-go" id="iv-new">＋ New item</button>
          <button class="cp-btn small" id="iv-export">⬇ Export</button>
          <button class="cp-btn small" id="iv-import">⬆ Import</button>
          <input type="file" id="iv-file" accept="application/json,.json" hidden>
        </div>
        <div class="inv-card" id="iv-panel"></div>
      </div>`;

    panel = D.mountInventory(host.querySelector('#iv-panel'), { showUse: false, listClass: 'inv-iv-list' });
    host.querySelector('#iv-new').onclick = () => D.editInvItem(null, (s) => { if (s && panel) panel.refresh(); });
    host.querySelector('#iv-export').onclick = () => {
      const data = { app: 'fixo-inno', version: 2, exportedAt: new Date().toISOString(), inventory: D.invList() };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'inno-inventory-' + new Date().toISOString().slice(0, 10) + '.json'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    };
    const fileInp = host.querySelector('#iv-file');
    host.querySelector('#iv-import').onclick = () => fileInp.click();
    fileInp.onchange = () => { const f = fileInp.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const obj = JSON.parse(rd.result); const inv = Array.isArray(obj) ? obj : (obj.inventory || []); D.importAll({ inventory: inv }, false); if (panel) panel.refresh(); (window.FIXO && FIXO.toast ? FIXO.toast : alert)('Imported ' + inv.length + ' items'); } catch (e) { alert('Could not read file: ' + e.message); } }; rd.readAsText(f); };
  }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-inno-inventory"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-inno-inventory') render();
  });
  window.FIXO_INNO_INV = { render };
})();
