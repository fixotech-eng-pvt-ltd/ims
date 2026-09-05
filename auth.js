// ============================================================
// Fixotech — Authentication + access control + activity/error logging
// One shared login for the whole ecosystem. The session persists (users stay
// logged in until they explicitly log out). The admin email unlocks the Admin
// Panel. Data is local-first and syncs to Supabase (app_users, activity_log,
// error_log, app_settings) when those tables exist.
// ============================================================
(function () {
  const LS_USERS = 'fixo_app_users', LS_SESSION = 'fixo_auth';
  const LS_ACT = 'fixo_activity_log', LS_ERR = 'fixo_error_log';

  // Seeded accounts (passwords are SHA-256 hashes, never plaintext in code).
  const SEED_USERS = [
    { email: 'fixotechengs@gmail.com', name: 'Administrator', pass: 'bbe59ff20d0833c6f22bcebb4417cbaf357d5000e580e265e063a43e74b1a985', is_admin: true, active: true, access: {} },
    { email: 'Fixotech', name: 'Fixotech Team', pass: '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4', is_admin: false, active: true, access: {} }
  ];

  // App catalogue used by access control (key → label).
  const APPS = [
    { key: 'calculator', label: 'Smart Calculator', side: 'office' },
    { key: 'proforma', label: 'Proforma Invoice', side: 'office' },
    { key: 'chatiq', label: 'ChatIQ', side: 'office' },
    { key: 'dispatch-records', label: 'Dispatch Records', side: 'office' },
    { key: 'factory-floor', label: 'Factory Floor', side: 'factory' },
    { key: 'dispatch', label: 'Dispatch', side: 'factory' },
    { key: 'inventory', label: 'Inventory', side: 'factory' }
  ];

  const readJSON = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const writeJSON = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  async function sha256(s) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(s)));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function loadUsers() {
    const u = readJSON(LS_USERS, null);
    if (Array.isArray(u) && u.length) return u;
    writeJSON(LS_USERS, SEED_USERS);
    pushUsers(SEED_USERS);   // first run → seed the shared accounts into Supabase
    return SEED_USERS.slice();
  }
  function saveUsers(a) { writeJSON(LS_USERS, a); pushUsers(a); }
  function session() { return readJSON(LS_SESSION, null); }
  function setSession(s) { if (s) writeJSON(LS_SESSION, s); else localStorage.removeItem(LS_SESSION); }
  const isLoggedIn = () => !!session();
  const isAdmin = () => { const s = session(); return !!(s && s.is_admin); };
  const currentUser = () => session();
  const findUser = (id) => loadUsers().find(u => (u.email || '').toLowerCase() === String(id || '').toLowerCase());

  async function login(id, pw) {
    const u = findUser(id);
    if (!u) return { ok: false, error: 'No such user ID.' };
    if (!u.active) return { ok: false, error: 'This account is disabled by the admin.' };
    if (await sha256(pw) !== u.pass) return { ok: false, error: 'Wrong password.' };
    setSession({ email: u.email, name: u.name, is_admin: !!u.is_admin, at: new Date().toISOString() });
    logActivity('auth', 'login', { email: u.email });
    return { ok: true, user: u };
  }
  function logout() { const s = session(); logActivity('auth', 'logout', { email: s && s.email }); setSession(null); applyGate(); }

  // Access: admins see everything; otherwise access[key] === false hides it.
  function canAccess(key) { const s = session(); if (!s) return false; if (s.is_admin) return true; const u = findUser(s.email); return !u || u.access[key] !== false; }

  // ---------------- Activity + error logging (Monitoring / FixTech Help) ----------------
  function logActivity(app, action, detail) {
    const rec = { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), user_email: (session() || {}).email || '', app, action, detail: detail || {} };
    const list = readJSON(LS_ACT, []); list.unshift(rec); writeJSON(LS_ACT, list.slice(0, 800));
    pushRow('activity_log', { id: rec.id, at: rec.at, user_email: rec.user_email, app, action, detail: rec.detail });
    if (window.FIXO_ADMIN && FIXO_ADMIN.refresh) FIXO_ADMIN.refresh();
  }
  function logError(err) {
    const rec = { id: 'e' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), at: new Date().toISOString(), user_email: (session() || {}).email || '', level: err.level || 'error', message: String(err.message || err).slice(0, 500), source: err.source || '', stack: (err.stack || '').slice(0, 1500), status: 'open' };
    const list = readJSON(LS_ERR, []);
    // de-dupe identical consecutive messages
    if (list[0] && list[0].message === rec.message && list[0].source === rec.source) return;
    list.unshift(rec); writeJSON(LS_ERR, list.slice(0, 400));
    pushRow('error_log', { id: rec.id, at: rec.at, user_email: rec.user_email, level: rec.level, message: rec.message, source: rec.source, stack: rec.stack, status: 'open' });
    if (window.FIXO_ADMIN && FIXO_ADMIN.refresh) FIXO_ADMIN.refresh();
  }
  const loadActivity = () => readJSON(LS_ACT, []);
  const loadErrors = () => readJSON(LS_ERR, []);
  function setErrorStatus(id, status) {
    const list = readJSON(LS_ERR, []); const e = list.find(x => x.id === id);
    if (e) { e.status = status; e.resolved_at = status === 'resolved' ? new Date().toISOString() : null; writeJSON(LS_ERR, list); pushRow('error_log', { id, status: e.status, resolved_at: e.resolved_at }, true); }
  }

  // Capture uncaught errors + promise rejections automatically.
  window.addEventListener('error', (e) => { try { logError({ message: e.message, source: (e.filename || '') + ':' + (e.lineno || ''), stack: e.error && e.error.stack }); } catch (_) {} });
  window.addEventListener('unhandledrejection', (e) => { try { const r = e.reason; logError({ message: 'Unhandled promise: ' + (r && r.message ? r.message : r), stack: r && r.stack }); } catch (_) {} });

  // ---------------- Best-effort Supabase sync (silent until tables exist) ----------------
  function supa() { try { const c = window.FixoDB && FixoDB.getCfg(); return (c && c.url && c.key) ? c : null; } catch (e) { return null; } }
  async function pushRow(table, row, isPatch) {
    const c = supa(); if (!c) return;
    try {
      const base = c.url.replace(/\/$/, '') + '/rest/v1/' + table;
      if (isPatch) await fetch(base + '?id=eq.' + encodeURIComponent(row.id), { method: 'PATCH', headers: hdr(c), body: JSON.stringify(row) });
      else await fetch(base, { method: 'POST', headers: Object.assign(hdr(c), { Prefer: 'resolution=merge-duplicates' }), body: JSON.stringify(row) });
    } catch (e) { /* offline / table missing — stays local */ }
  }
  async function pushUsers(users) {
    const c = supa(); if (!c) return;
    try { await fetch(c.url.replace(/\/$/, '') + '/rest/v1/app_users', { method: 'POST', headers: Object.assign(hdr(c), { Prefer: 'resolution=merge-duplicates' }), body: JSON.stringify(users.map(u => ({ email: u.email, display_name: u.name, is_admin: !!u.is_admin, active: !!u.active, access: u.access || {}, pass: u.pass }))) }); } catch (e) {}
  }
  const hdr = (c) => ({ apikey: c.key, Authorization: 'Bearer ' + c.key, 'Content-Type': 'application/json' });

  // ---------------- Login screen + gate ----------------
  function renderLogin() {
    const host = document.getElementById('login-app'); if (!host) return;
    host.innerHTML = `
      <div class="lg-card">
        <img class="lg-logo" src="https://fplogoimages.withfloats.com/actual/4787f692897d42598da86c9d05413fc6jpeg" alt="Fixotech" onerror="this.style.display='none'">
        <h1 class="lg-title">FIXOTECH <span>ECOSYSTEM</span></h1>
        <p class="lg-sub">Sign in to continue</p>
        <form id="lg-form" autocomplete="off">
          <label class="lg-lab">User ID / Email</label>
          <input class="lg-in" id="lg-id" placeholder="Fixotech" autocapitalize="none" autocorrect="off">
          <label class="lg-lab">Password</label>
          <input class="lg-in" id="lg-pw" type="password" placeholder="••••••">
          <button class="lg-btn" type="submit">Log in</button>
          <div class="lg-err" id="lg-err" hidden></div>
        </form>
        <p class="lg-foot">One shared login for the office &amp; factory. You stay signed in until you log out.</p>
      </div>`;
    const form = host.querySelector('#lg-form'), err = host.querySelector('#lg-err');
    form.onsubmit = async (e) => {
      e.preventDefault();
      err.hidden = true;
      const r = await login(host.querySelector('#lg-id').value.trim(), host.querySelector('#lg-pw').value);
      if (!r.ok) { err.textContent = r.error; err.hidden = false; return; }
      applyGate();
      if (window.showScreen) showScreen('screen-landing');
    };
    setTimeout(() => { const el = host.querySelector('#lg-id'); if (el) el.focus(); }, 50);
  }

  // Show/hide app based on auth; render the landing user bar + admin tile.
  function applyGate() {
    const logged = isLoggedIn();
    if (!logged) { if (window.showScreen) showScreen('screen-login'); renderLogin(); return; }
    // logged in — reveal workspace, fill user bar, toggle admin tile
    const s = session();
    const bar = document.getElementById('landing-userbar');
    if (bar) bar.innerHTML = `<span class="ub-who">👤 ${s.name || s.email}${s.is_admin ? ' <em>· Admin</em>' : ''}</span><button class="ub-logout" id="ub-logout">Log out</button>`;
    const lo = document.getElementById('ub-logout'); if (lo) lo.onclick = () => logout();
    const adminCard = document.getElementById('btn-admin'); if (adminCard) adminCard.hidden = !s.is_admin;
    applyAccess();
  }

  // Hide app tiles a non-admin user isn't allowed to open.
  function applyAccess() {
    const map = { 'screen-calculator': 'calculator', 'screen-proforma': 'proforma', 'screen-chatiq': 'chatiq', 'screen-dispatch-records': 'dispatch-records' };
    document.querySelectorAll('[data-open-app]').forEach(el => { const k = map[el.dataset.openApp]; if (k) el.hidden = !canAccess(k); });
    const fmap = { floor: 'factory-floor', dispatch: 'dispatch', inventory: 'inventory' };
    document.querySelectorAll('[data-open-factory]').forEach(el => { const k = fmap[el.dataset.openFactory]; if (k) el.hidden = !canAccess(k); });
  }

  document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    // Gate the app on load: not logged in → login screen.
    if (!isLoggedIn()) { showScreenSafe('screen-login'); renderLogin(); }
    else applyGate();
    // Re-apply the user bar / access whenever we return to landing or a home.
    const g = window.showScreen;
    if (g && !g.__authWrapped) {
      window.showScreen = function (id) {
        if (!isLoggedIn() && id !== 'screen-login') { renderLogin(); return g('screen-login'); }
        if (id === 'screen-login') renderLogin();          // always draw the login card
        const r = g.apply(this, arguments);
        if (id === 'screen-landing' || id === 'screen-home' || id === 'screen-factory-home') applyGate();
        return r;
      };
      window.showScreen.__authWrapped = true;
    }

    // Safety net: if boot ever leaves a blank screen (no active screen, or an
    // empty one), recover to login/landing so the app can never get stuck.
    setTimeout(() => {
      try {
        const active = document.querySelector('.screen.active');
        const loginBlank = active && active.id === 'screen-login' && !document.querySelector('#login-app .lg-card');
        if (!active || !(active.textContent || '').trim() || loginBlank) {
          if (!isLoggedIn()) { renderLogin(); (window.showScreen || g)('screen-login'); }
          else (window.showScreen || g)('screen-landing');
        }
      } catch (e) {}
    }, 700);
  });
  function showScreenSafe(id) { if (window.showScreen) showScreen(id); else document.addEventListener('DOMContentLoaded', () => showScreen(id)); }

  window.FIXO_AUTH = { login, logout, isLoggedIn, isAdmin, currentUser, canAccess, loadUsers, saveUsers, findUser, sha256, applyGate, applyAccess, APPS };
  window.FIXO_LOG = { activity: logActivity, error: logError, loadActivity, loadErrors, setErrorStatus };
})();
