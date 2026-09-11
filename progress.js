// ============================================================
// Fixotech — PROGRESS STATUS widget
// A big, blurred-backdrop overview of EVERYTHING in flight: quotations,
// proforma invoices and indents — what stage each is at (preparation →
// proforma → indent → at factory → factory-approved → dispatch-approved →
// dispatched). Filter by week / month. Click any item to jump straight to
// that stage where you can keep editing. Opened from a button in the Smart
// Calculator top bar. Purely a reader over the existing saved stores; it
// never forks data.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const load = (k) => { try { return JSON.parse(localStorage.getItem(k) || '[]') || []; } catch (e) { return []; } };
  const loadMap = (k) => { try { return JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch (e) { return {}; } };
  // best-effort timestamp: ISO fields first, else trailing digits in the id.
  function tsOf(rec) {
    for (const f of ['sentAt', 'createdAt', 'at', 'ts']) { if (rec[f]) { const t = Date.parse(rec[f]); if (!isNaN(t)) return t; } }
    const m = String(rec.id || '').match(/(\d{10,})/); if (m) return +m[1];
    if (rec.savedAt) { const t = Date.parse(rec.savedAt); if (!isNaN(t)) return t; }
    return 0;
  }
  const fmtDate = (ts) => ts ? new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '';

  // stage catalogue (order = pipeline position)
  const STAGE = {
    quotation:        { step: 1, label: 'Quotation',        chip: 'Preparation',        cls: 'st-quote',  ic: '🧮' },
    proforma:         { step: 2, label: 'Proforma',         chip: 'Proforma stage',     cls: 'st-prof',   ic: '🧾' },
    proforma_declined:{ step: 2, label: 'Proforma',         chip: 'Client declined',    cls: 'st-warn',   ic: '🧾' },
    indent_draft:     { step: 3, label: 'Indent',           chip: 'Being prepared',     cls: 'st-draft',  ic: '🗂️' },
    at_factory:       { step: 4, label: 'Indent',           chip: 'At factory — waiting',cls: 'st-wait',  ic: '🏭' },
    factory_approved: { step: 5, label: 'Indent',           chip: 'Factory approved',   cls: 'st-ok',     ic: '🏭' },
    dispatch_approved:{ step: 6, label: 'Dispatch',         chip: 'Dispatch approved',  cls: 'st-ok',     ic: '📦' },
    dispatched:       { step: 7, label: 'Dispatch',         chip: 'Dispatched ✓',       cls: 'st-done',   ic: '🚚' }
  };

  let filter = 'all';   // all | week | month

  function gather() {
    const items = [];
    // 1) Quotations (saved orders from the calculator)
    load('fixo_saved_orders').forEach(o => items.push({
      stage: 'quotation', id: o.id, title: o.client || 'Unnamed', sub: `${(o.q || []).length} item(s)`, ts: tsOf(o),
      go: () => { if (window.showScreen) showScreen('screen-calculator'); if (typeof window.reopenSavedOrder === 'function') window.reopenSavedOrder(o.id); }
    }));
    // 2) Proformas (saved)
    load('fixo_saved_proformas').forEach(p => {
      const appr = p.model && p.model.approval;
      items.push({
        stage: appr === 'declined' ? 'proforma_declined' : 'proforma', id: p.id,
        title: p.customer || (p.model && p.model.customer) || 'Unnamed', sub: `${esc(p.refNo || '')}${(p.model && p.model.items || []).length ? ' · ' + p.model.items.length + ' line(s)' : ''}`, ts: tsOf(p),
        go: () => { if (window.FIXO_PF && FIXO_PF.reopenSaved) FIXO_PF.reopenSaved(p.id); else if (window.showScreen) showScreen('screen-proforma'); }
      });
    });
    // 3) Indent drafts (being prepared)
    load('fixo_indent_drafts').forEach(d => items.push({
      stage: 'indent_draft', id: d.id, title: d.indentCustomer || d.customer || 'Indent', sub: `No. ${esc(d.indentNo || '—')} · ${(d.items || []).length} line(s)`, ts: tsOf(d), priority: !!d.priority,
      go: () => { if (window.FIXO_INDENT && FIXO_INDENT.openDraft) FIXO_INDENT.openDraft(d.id); else if (window.showScreen) showScreen('screen-indent'); }
    }));
    // 4) Indents sent to factory → status from factory + dispatch stores
    const appr = loadMap('fixo_dispatch_approvals');
    const dispatched = load('fixo_dispatch_log');
    const dispByIndent = {}; dispatched.forEach(d => { if (d.indentNo) dispByIndent[d.indentNo] = true; });
    load('fixo_factory_indents').forEach(f => {
      let stage = 'at_factory';
      if (dispByIndent[f.indentNo]) stage = 'dispatched';
      else if (appr[f.indentNo]) stage = 'dispatch_approved';
      else if (f.factoryApproved) stage = 'factory_approved';
      items.push({
        stage, id: f.id, title: f.customer || f.indentCustomer || 'Indent', sub: `No. ${esc(f.indentNo || '—')} · ${(f.items || []).length} line(s)`, ts: tsOf(f), priority: !!f.priority,
        go: () => { if (window.FIXO_INDENT && FIXO_INDENT.showTracker) FIXO_INDENT.showTracker(); else if (window.showScreen) showScreen('screen-indent'); }
      });
    });
    return items;
  }

  function withinFilter(ts) {
    if (filter === 'all' || !ts) return filter === 'all';
    const now = Date.now(); const span = filter === 'week' ? 7 : 31;
    return ts >= now - span * 864e5;
  }

  function open() {
    let el = document.getElementById('fx-progress-overlay');
    if (!el) { el = document.createElement('div'); el.id = 'fx-progress-overlay'; el.className = 'fxp-overlay'; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) close(); }); }
    render(el);
    document.body.classList.add('fxp-open');
    requestAnimationFrame(() => el.classList.add('show'));
  }
  function close() { const el = document.getElementById('fx-progress-overlay'); if (el) el.classList.remove('show'); document.body.classList.remove('fxp-open'); setTimeout(() => { if (el && !el.classList.contains('show')) el.remove(); }, 200); }

  function render(el) {
    let all = gather().sort((a, b) => (b.ts || 0) - (a.ts || 0));
    const totalAll = all.length;
    all = all.filter(x => withinFilter(x.ts));

    // headline counts by pipeline bucket
    const bucket = (fn) => all.filter(fn).length;
    const nQuote = bucket(x => x.stage === 'quotation');
    const nProf = bucket(x => x.stage === 'proforma' || x.stage === 'proforma_declined');
    const nPrep = bucket(x => x.stage === 'indent_draft');
    const nFactory = bucket(x => x.stage === 'at_factory');
    const nAppr = bucket(x => x.stage === 'factory_approved' || x.stage === 'dispatch_approved');
    const nDone = bucket(x => x.stage === 'dispatched');

    const kpi = (n, l, cls) => `<div class="fxp-kpi ${cls}"><b>${n}</b><span>${l}</span></div>`;
    const chipRow = ['all', 'week', 'month'].map(f => `<button class="fxp-filter ${filter === f ? 'active' : ''}" data-filter="${f}">${f === 'all' ? 'All' : f === 'week' ? 'This week' : 'This month'}</button>`).join('');

    const card = (x) => {
      const s = STAGE[x.stage] || STAGE.quotation;
      return `<button class="fxp-card ${s.cls}" data-open="${esc(x.id)}">
        <span class="fxp-card-ic">${s.ic}</span>
        <span class="fxp-card-main"><b>${esc(x.title)}${x.priority ? ' <span class="fxp-urg">🚩</span>' : ''}</b><span class="fxp-card-sub">${x.sub}</span></span>
        <span class="fxp-card-right"><span class="fxp-stage ${s.cls}">${s.chip}</span><span class="fxp-when">${fmtDate(x.ts)}</span></span>
      </button>`;
    };

    // group by pipeline label, keep pipeline order
    const groups = [
      ['🧮 Quotations', all.filter(x => x.stage === 'quotation')],
      ['🧾 Proforma invoices', all.filter(x => x.stage === 'proforma' || x.stage === 'proforma_declined')],
      ['🗂️ Indents being prepared', all.filter(x => x.stage === 'indent_draft')],
      ['🏭 At the factory', all.filter(x => x.stage === 'at_factory' || x.stage === 'factory_approved')],
      ['🚚 Dispatch', all.filter(x => x.stage === 'dispatch_approved' || x.stage === 'dispatched')]
    ];
    const groupsHtml = groups.filter(g => g[1].length).map(([title, list]) =>
      `<div class="fxp-group"><div class="fxp-group-h">${title} <em>${list.length}</em></div>${list.map(card).join('')}</div>`
    ).join('') || `<div class="fxp-empty">Nothing in this window yet. Create a quotation, proforma or indent and it'll appear here — with its live stage.</div>`;

    const cur = (() => { try { return localStorage.getItem('fixo_screen') || ''; } catch (e) { return ''; } })();
    const curName = { 'screen-calculator': 'Smart Calculator', 'screen-proforma': 'Proforma Invoice', 'screen-indent': 'Indent Prep', 'screen-chatiq': 'ChatIQ' }[cur] || '';

    el.innerHTML = `
      <div class="fxp-modal">
        <div class="fxp-head">
          <div><h2>📊 Progress Status</h2><p>Every quotation, proforma &amp; indent — and exactly where it stands. Tap any to jump back in.</p></div>
          <button class="fxp-x" id="fxp-x" title="Close">✕</button>
        </div>
        ${curName ? `<div class="fxp-here">📍 You're currently in <b>${curName}</b>.</div>` : ''}
        <div class="fxp-kpis">
          ${kpi(nQuote, 'Quotations', 'st-quote')}${kpi(nProf, 'Proformas', 'st-prof')}${kpi(nPrep, 'Preparing', 'st-draft')}
          ${kpi(nFactory, 'At factory', 'st-wait')}${kpi(nAppr, 'Approved', 'st-ok')}${kpi(nDone, 'Dispatched', 'st-done')}
        </div>
        <div class="fxp-filters">${chipRow}<span class="fxp-count">${all.length} shown${filter !== 'all' ? ` · ${totalAll} total` : ''}</span></div>
        <div class="fxp-body">${groupsHtml}</div>
      </div>`;
    el.querySelector('#fxp-x').onclick = close;
    el.querySelectorAll('[data-filter]').forEach(b => b.onclick = () => { filter = b.dataset.filter; render(el); });
    el.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const x = all.find(y => String(y.id) === b.dataset.open); if (x && x.go) { close(); setTimeout(x.go, 60); } });
  }

  window.FIXO_PROGRESS = { open, close };
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
})();
