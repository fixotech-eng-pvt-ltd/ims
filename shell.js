// ============================================================
// Fixotech Ecosystem shell — screen router + app hand-offs
// Screens: landing (Office/Factory) → home (app launcher) →
// individual apps (Smart Calculator, Proforma Invoice, …).
// Everything lives in ONE app so data flows between apps in-memory.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));

  function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === id));
    document.body.dataset.screen = id;
    window.scrollTo(0, 0);
    try { localStorage.setItem('fixo_screen', id); } catch (e) {}
  }
  window.showScreen = showScreen;

  document.addEventListener('DOMContentLoaded', () => {
    // Always boot to a safe screen (the landing / workspace picker). Deep-
    // restoring into an app or admin screen could show a blank body if that
    // screen didn't re-render on reopen — booting to landing is bulletproof.
    // auth.js (loaded earlier) redirects to the login screen if not signed in.
    (window.showScreen || showScreen)('screen-landing');

    const office = document.getElementById('btn-office');
    if (office) office.addEventListener('click', () => showScreen('screen-home'));
    const factory = document.getElementById('btn-factory');
    if (factory) factory.addEventListener('click', () => showScreen('screen-factory-home'));

    document.querySelectorAll('[data-open-app]').forEach(c => {
      if (c.classList.contains('disabled')) return;
      c.addEventListener('click', () => showScreen(c.dataset.openApp));
    });
    document.querySelectorAll('[data-goto]').forEach(b => b.addEventListener('click', () => showScreen(b.dataset.goto)));

    // Home header: hamburger menu + bell
    const menuBtn = document.getElementById('hm-menu');
    const menuPop = document.getElementById('hm-menu-pop');
    if (menuBtn && menuPop) {
      menuBtn.addEventListener('click', (e) => { e.stopPropagation(); menuPop.hidden = !menuPop.hidden; });
      document.addEventListener('click', (e) => { if (!menuPop.contains(e.target) && e.target !== menuBtn) menuPop.hidden = true; });
    }
    const bell = document.getElementById('hm-bell');
    if (bell) bell.addEventListener('click', showNotifications);
    refreshBell();

    const fwd = document.getElementById('btn-forward-proforma');
    if (fwd) fwd.addEventListener('click', forwardToProforma);

    // Factory home launcher: open Floor or Dispatch app
    document.querySelectorAll('[data-open-factory]').forEach(b => b.addEventListener('click', () => {
      if (b.dataset.openFactory === 'dispatch') { showScreen('screen-dispatch'); if (window.FIXO_DISPATCH && FIXO_DISPATCH.render) FIXO_DISPATCH.render(); }
      else if (b.dataset.openFactory === 'inventory') { showScreen('screen-inventory'); if (window.FIXO_INVENTORY && FIXO_INVENTORY.render) FIXO_INVENTORY.render(); }
      else { showScreen('screen-factory'); if (window.FIXO_FACTORY && FIXO_FACTORY.render) FIXO_FACTORY.render(); }
    }));
    const fhBell = document.getElementById('fh-bell');
    if (fhBell) fhBell.addEventListener('click', showNotifications);

    // Admin panel (admin accounts only; tile is hidden otherwise by auth.js)
    const adminBtn = document.getElementById('btn-admin');
    if (adminBtn) adminBtn.addEventListener('click', () => { showScreen('screen-admin'); if (window.FIXO_ADMIN) FIXO_ADMIN.render(); });
  });

  // ---------- Office notifications (factory approvals reflect here) ----------
  const NOTIF = 'fixo_office_notifications';
  function loadNotifs() { try { return JSON.parse(localStorage.getItem(NOTIF) || '[]'); } catch (e) { return []; } }
  function saveNotifs(a) { try { localStorage.setItem(NOTIF, JSON.stringify(a)); } catch (e) {} }
  function refreshBell() {
    const n = loadNotifs().filter(x => !x.seen).length;
    ['hm-bell', 'fh-bell'].forEach(id => {
      const bell = document.getElementById(id); if (!bell) return;
      let b = bell.querySelector('.hm-bell-badge');
      if (n) { if (!b) { b = document.createElement('span'); b.className = 'hm-bell-badge'; bell.appendChild(b); } b.textContent = n; }
      else if (b) b.remove();
    });
  }
  function showNotifications() {
    const list = loadNotifs();
    const rows = list.length
      ? list.map(x => {
          const when = `<span>${new Date(x.at).toLocaleString('en-IN')}</span>`;
          if (x.type === 'dispatch_undone')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'} warn">↩ Factory <b>undid dispatch</b> — Indent ${esc(x.indentNo)} · ${esc(x.customer)}<br><em>${esc(x.desc || '')}</em> — reason: ${esc(x.reason || '')}${when}</div>`;
          if (x.type === 'stage_undone')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'} warn">↩ Factory <b>moved a stage back</b> — Indent ${esc(x.indentNo)} · ${esc(x.customer)}<br><em>${esc(x.desc || '')}</em> — ${esc(x.reason || '')}${when}</div>`;
          if (x.type === 'powdercoat_query')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'} warn">🎨 Factory <b>asks powder-coat colour</b> — Indent ${esc(x.indentNo)} · ${esc(x.customer)}<br><em>${esc(x.desc || '')}</em>${when}</div>`;
          if (x.type === 'priority_set')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'} warn">🚩 Factory marked <b>URGENT</b> — Indent ${esc(x.indentNo)} · ${esc(x.customer)}${when}</div>`;
          if (x.type === 'dispatch_note_sent')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'}">📤 Dispatch <b>note sent</b> — ${esc(x.customer)} (${esc(x.reason || '')}) — see Dispatch Records${when}</div>`;
          if (x.type === 'dispatch_approved')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'}">✓ Dispatch dept <b>approved</b> Indent ${esc(x.indentNo)}${when}</div>`;
          if (x.type === 'floor_sheet')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'}">📄 Factory uploaded a <b>work-sheet</b> — ${esc(x.reason || '')}${when}</div>`;
          if (x.type === 'dispatched')
            return `<div class="hm-notif ${x.seen ? '' : 'unseen'}">🚚 <b>Dispatched</b> — ${esc(x.customer)} (${esc(x.reason || '')})${when}</div>`;
          return `<div class="hm-notif ${x.seen ? '' : 'unseen'}">✓ Factory <b>approved</b> Indent No. ${esc(x.indentNo)} — ${esc(x.customer)}${when}</div>`;
        }).join('')
      : '<div class="hm-notif-empty">No notifications yet.</div>';
    const el = document.createElement('div'); el.className = 'fx-modal-overlay';
    el.innerHTML = `<div class="fx-modal"><h3>Notifications</h3><div class="hm-notif-list">${rows}</div><div class="fx-modal-actions"><button class="fx-btn fx-btn-go" id="hm-notif-close">Close</button></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target === el) el.remove(); });
    el.querySelector('#hm-notif-close').onclick = () => el.remove();
    list.forEach(x => x.seen = true); saveNotifs(list); refreshBell();
  }
  window.FIXO_OFFICE = { refreshBell };

  // ---------- Smart Calculator → Proforma hand-off ----------
  function forwardToProforma() {
    if (!window.FIXO || !FIXO.hasQuoteItems || !FIXO.hasQuoteItems()) { toast('Add items to the quote first'); return; }
    // Prefer the edited quotation (negotiation / approval edits) over the raw quote.
    const fd = FIXO.getForwardData ? FIXO.getForwardData() : null;
    const client = fd ? fd.client : FIXO.getClientName();
    const items = fd ? fd.items : FIXO.getQuoteSnapshot().items.map(it => ({ desc: it.name || '', unit: it.type === 'linear' ? 'Mtr' : 'Nos', qty: it.qty, rate: it.quoteRate, amount: it.totalCost }));
    const meta = fd ? { freight: fd.freight, deliverAddr: fd.deliverAddr } : {};
    if (window.FIXO_PF && FIXO_PF.loadFromQuote) FIXO_PF.loadFromQuote(items, client, meta);
    showScreen('screen-proforma');
    if (fd && fd.edited) toast('Forwarded the edited quotation to Proforma');
    const btn = document.getElementById('btn-forward-proforma');
    if (btn) { btn.classList.add('forwarded'); btn.innerHTML = '✓ Forwarded to Proforma Invoice'; }
    toast('Quote forwarded to Proforma Invoice');
  }
})();
