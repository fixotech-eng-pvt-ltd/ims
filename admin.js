// ============================================================
// Fixotech — ADMIN PANEL (admin email only)
// Tabs: Testing Mode (global) · Access Control · Monitoring · FixTech Help.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const A = () => window.FIXO_AUTH, L = () => window.FIXO_LOG;
  let tab = 'testing';

  function render() {
    const host = document.getElementById('admin-app'); if (!host) return;
    if (!A() || !A().isAdmin()) { host.innerHTML = `<div class="fx-empty"><div class="fx-empty-ic">🔒</div><h3>Admin access only</h3><p>This panel is available to the administrator account.</p></div>`; return; }
    const errOpen = (L().loadErrors() || []).filter(e => e.status !== 'resolved').length;
    host.innerHTML = `
      <div class="fx-hero" style="background:linear-gradient(120deg,#111827,#1f2937 60%,#374151)">
        <div class="fx-hero-title"><span class="fx-hero-ic">🛡️</span><div><h2>Admin Panel</h2><p>Directors &amp; tech team · full control of the platform</p></div></div>
      </div>
      <div class="fx-tabs">
        <button class="fx-tab ${tab === 'testing' ? 'active' : ''}" data-t="testing">🧪 Testing Mode</button>
        <button class="fx-tab ${tab === 'access' ? 'active' : ''}" data-t="access">👥 Access Control</button>
        <button class="fx-tab ${tab === 'monitor' ? 'active' : ''}" data-t="monitor">📊 Monitoring</button>
        <button class="fx-tab ${tab === 'help' ? 'active' : ''}" data-t="help">🛠️ FixTech Help ${errOpen ? `<span class="fx-badge">${errOpen}</span>` : ''}</button>
      </div>
      <div id="admin-body"></div>`;
    host.querySelectorAll('.fx-tab').forEach(b => b.onclick = () => { tab = b.dataset.t; render(); });
    const body = host.querySelector('#admin-body');
    if (tab === 'testing') renderTesting(body);
    else if (tab === 'access') renderAccess(body);
    else if (tab === 'monitor') renderMonitor(body);
    else renderHelp(body);
  }

  // ---- Testing Mode (global; only admin controls it) ----
  function renderTesting(body) {
    const on = !!(window.FIXO_TESTING && FIXO_TESTING.isOn());
    body.innerHTML = `
      <div class="fx-card" style="padding:22px">
        <div class="adm-toggle-row">
          <div>
            <h3 style="margin:0 0 4px">Phase-1 Testing Mode is <b style="color:${on ? '#16a34a' : '#64748b'}">${on ? 'ON' : 'OFF'}</b></h3>
            <p class="fx-meta" style="max-width:560px">When ON, the whole platform (every device) is limited to <b>Smart Calculator → Quotation → Proforma → Indent</b>, with the indent visible on the Factory Floor &amp; Dispatch for printing. Only the admin can switch this.</p>
          </div>
          <button class="tm-switch ${on ? 'on' : ''}" id="adm-tm"><span class="tm-knob"></span></button>
        </div>
      </div>`;
    const sw = body.querySelector('#adm-tm');
    sw.onclick = () => {
      if (window.FIXO_TESTING && FIXO_TESTING.toggle) FIXO_TESTING.toggle();
      L().activity('admin', 'testing_mode', { on: !!(window.FIXO_TESTING && FIXO_TESTING.isOn()) });
      renderTesting(body);
    };
  }

  // ---- Access Control (who can use which app) ----
  function renderAccess(body) {
    const users = A().loadUsers(), apps = A().APPS;
    const rows = users.map(u => `
      <tr>
        <td><b>${esc(u.email)}</b><div class="fx-meta">${esc(u.name || '')}</div></td>
        <td class="c">${u.is_admin ? '✓' : ''}</td>
        <td class="c"><input type="checkbox" data-active="${esc(u.email)}" ${u.active ? 'checked' : ''} ${u.is_admin ? 'disabled' : ''}></td>
        <td>${u.is_admin ? '<span class="fx-meta">all apps</span>' : apps.map(a => `<label class="adm-acc"><input type="checkbox" data-acc="${esc(u.email)}|${a.key}" ${(u.access || {})[a.key] !== false ? 'checked' : ''}>${esc(a.label)}</label>`).join('')}</td>
        <td class="c">${u.is_admin ? '' : `<button class="so-del" data-del="${esc(u.email)}" title="Remove">&times;</button>`}</td>
      </tr>`).join('');
    body.innerHTML = `
      <div class="fx-card"><table class="fx-tbl adm-users"><thead><tr>
        <th>User</th><th>Admin</th><th>Active</th><th>App access</th><th></th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <div class="fx-card" style="margin-top:12px;padding:16px">
        <h3 style="margin:0 0 10px">➕ Add a user (Gmail / user ID)</h3>
        <div class="adm-addrow">
          <input class="fx-in" id="au-email" placeholder="name@gmail.com or user ID">
          <input class="fx-in" id="au-name" placeholder="Display name">
          <input class="fx-in" id="au-pw" type="text" placeholder="Password">
          <label class="adm-acc"><input type="checkbox" id="au-admin"> Admin</label>
          <button class="fx-btn fx-btn-go" id="au-add">Add user</button>
        </div>
        <p class="fx-note" id="au-msg"></p>
      </div>`;
    body.querySelectorAll('[data-active]').forEach(c => c.onchange = () => { const us = A().loadUsers(); const u = us.find(x => x.email === c.dataset.active); if (u) { u.active = c.checked; A().saveUsers(us); L().activity('admin', 'user_active', { email: u.email, active: u.active }); } });
    body.querySelectorAll('[data-acc]').forEach(c => c.onchange = () => { const [em, key] = c.dataset.acc.split('|'); const us = A().loadUsers(); const u = us.find(x => x.email === em); if (u) { u.access = u.access || {}; u.access[key] = c.checked; A().saveUsers(us); } });
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (!confirm('Remove ' + b.dataset.del + '?')) return; A().saveUsers(A().loadUsers().filter(x => x.email !== b.dataset.del)); L().activity('admin', 'user_remove', { email: b.dataset.del }); renderAccess(body); });
    body.querySelector('#au-add').onclick = async () => {
      const email = body.querySelector('#au-email').value.trim(), name = body.querySelector('#au-name').value.trim(), pw = body.querySelector('#au-pw').value, admin = body.querySelector('#au-admin').checked;
      const msg = body.querySelector('#au-msg');
      if (!email || !pw) { msg.textContent = 'Email/ID and password are required.'; return; }
      const us = A().loadUsers();
      if (us.some(u => u.email.toLowerCase() === email.toLowerCase())) { msg.textContent = 'That user already exists.'; return; }
      us.push({ email, name: name || email, pass: await A().sha256(pw), is_admin: admin, active: true, access: {} });
      A().saveUsers(us); L().activity('admin', 'user_add', { email, admin });
      renderAccess(body);
    };
  }

  // ---- Monitoring (activity feed) ----
  function renderMonitor(body) {
    const acts = L().loadActivity();
    const rows = acts.length ? acts.slice(0, 300).map(a => `<tr>
      <td class="c fx-meta">${new Date(a.at).toLocaleString('en-IN')}</td>
      <td>${esc(a.user_email || '—')}</td>
      <td><span class="fx-fin">${esc(a.app || '')}</span> ${esc(a.action || '')}</td>
      <td class="fx-meta">${esc(shortDetail(a.detail))}</td></tr>`).join('') : `<tr><td colspan="4" class="c fx-meta" style="padding:22px">No activity recorded yet.</td></tr>`;
    body.innerHTML = `
      <div class="inv-toolbar"><span class="fx-meta">${acts.length} event(s) · newest first</span>
        <button class="fx-btn" id="mon-refresh">↻ Refresh</button><button class="fx-btn" id="mon-clear">Clear</button></div>
      <div class="fx-card"><table class="fx-tbl"><thead><tr><th>When</th><th>User</th><th>Activity</th><th>Detail</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    body.querySelector('#mon-refresh').onclick = () => renderMonitor(body);
    body.querySelector('#mon-clear').onclick = () => { if (confirm('Clear the local activity feed?')) { localStorage.setItem('fixo_activity_log', '[]'); renderMonitor(body); } };
  }
  function shortDetail(d) { if (!d || typeof d !== 'object') return ''; return Object.entries(d).map(([k, v]) => k + ': ' + (typeof v === 'object' ? JSON.stringify(v) : v)).join(' · ').slice(0, 80); }

  // ---- FixTech Help (errors / issues) ----
  let helpFilter = 'open';
  function renderHelp(body) {
    let errs = L().loadErrors();
    if (helpFilter === 'open') errs = errs.filter(e => e.status !== 'resolved');
    const rows = errs.length ? errs.slice(0, 200).map(e => `<tr class="${e.status === 'resolved' ? 'adm-res' : ''}">
      <td class="c">${e.status === 'resolved' ? '✅' : '⚠️'}</td>
      <td class="c fx-meta">${new Date(e.at).toLocaleString('en-IN')}</td>
      <td><b>${esc(e.message)}</b>${e.source ? `<div class="fx-meta">${esc(e.source)}</div>` : ''}${e.stack ? `<details><summary class="fx-meta">stack</summary><pre class="adm-stack">${esc(e.stack)}</pre></details>` : ''}</td>
      <td class="c">${e.status === 'resolved' ? '<span class="fx-fi-ok">rectified</span>' : `<button class="fx-btn fx-btn-sm" data-res="${e.id}">✓ Mark rectified</button>`}</td></tr>`).join('') : `<tr><td colspan="4" class="c fx-meta" style="padding:22px">No ${helpFilter === 'open' ? 'open ' : ''}issues 🎉 The system auto-captures errors as they happen.</td></tr>`;
    body.innerHTML = `
      <div class="inv-toolbar">
        <div class="fx-view-toggle"><button class="fx-vt ${helpFilter === 'open' ? 'active' : ''}" data-f="open">Open</button><button class="fx-vt ${helpFilter === 'all' ? 'active' : ''}" data-f="all">All</button></div>
        <span class="fx-meta" style="flex:1">Errors &amp; issues detected across the platform</span>
        <button class="fx-btn" id="help-report">🖨 Generate report</button>
      </div>
      <div class="fx-card"><table class="fx-tbl"><thead><tr><th></th><th>When</th><th>Issue</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    body.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { helpFilter = b.dataset.f; renderHelp(body); });
    body.querySelectorAll('[data-res]').forEach(b => b.onclick = () => { L().setErrorStatus(b.dataset.res, 'resolved'); L().activity('admin', 'issue_resolved', { id: b.dataset.res }); renderHelp(body); });
    body.querySelector('#help-report').onclick = () => printReport();
  }
  function printReport() {
    const errs = L().loadErrors();
    const open = errs.filter(e => e.status !== 'resolved').length;
    const rows = errs.map((e, i) => `<tr><td>${i + 1}</td><td>${new Date(e.at).toLocaleString('en-IN')}</td><td>${esc(e.message)}</td><td>${esc(e.source || '')}</td><td>${e.status}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>FixTech Help Report</title><style>
      body{font-family:Arial;color:#000;padding:14px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px}
      th,td{border:1px solid #000;padding:5px 7px;font-size:11px;text-align:left}th{background:#eee}</style></head><body>
      <h2>FIXOTECH — FixTech Help Report</h2><div>Generated: ${new Date().toLocaleString('en-IN')} · Total ${errs.length} · Open ${open} · Rectified ${errs.length - open}</div>
      <table><thead><tr><th>#</th><th>When</th><th>Issue</th><th>Source</th><th>Status</th></tr></thead><tbody>${rows || '<tr><td colspan="5">No issues.</td></tr>'}</tbody></table>
      </body></html>`;
    const w = window.open('', '_blank'); if (!w) return; w.document.write(html); w.document.close(); setTimeout(() => { try { w.print(); } catch (e) {} }, 300);
  }

  window.FIXO_ADMIN = { render, refresh: () => { const s = document.getElementById('screen-admin'); if (s && s.classList.contains('active')) render(); } };

  // Re-draw the panel when the app reopens directly onto the Admin screen
  // (otherwise it restores as a blank body — every other screen self-renders).
  document.addEventListener('DOMContentLoaded', () => {
    try { if (localStorage.getItem('fixo_screen') === 'screen-admin') setTimeout(render, 0); } catch (e) {}
  });
})();
