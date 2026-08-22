// ============================================================
// Fixotech — PHASE 1 TESTING MODE
// A master switch (on the landing page) that limits the app to the
// Phase 1 flow only: Smart Calculator → Quotation → Proforma Invoice → Indent.
// Everything else (ChatIQ, Dispatch Records, the whole Factory side) is locked.
// Toggle it on/off any time; the choice persists across reloads & devices-of-one.
// ============================================================
(function () {
  const KEY = 'fixo_testing_mode';
  // Phase 1 scope: Office quoting (Calculator → Quotation → Proforma → Indent)
  // PLUS the indent reaching the Factory Floor & Dispatch for VIEWING + PRINTING
  // (urgent flag included). Production & dispatch actions there are Phase 2, so
  // Factory/Dispatch are shown but limited to their Indents tab (see factory.js /
  // dispatch.js, which read FIXO_TESTING.isOn()).
  // Only these are fully locked while testing is ON:
  const LOCKED_SEL = [
    '[data-open-app="screen-chatiq"]',
    '[data-open-app="screen-dispatch-records"]'
  ];
  const LOCKED_SCREENS = ['screen-chatiq', 'screen-dispatch-records'];

  const isOn = () => { try { return localStorage.getItem(KEY) === '1'; } catch (e) { return false; } };
  const setOn = (v) => { try { localStorage.setItem(KEY, v ? '1' : '0'); } catch (e) {} };
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));

  // ---- Guard navigation: block locked screens while testing is ON ----
  function installNavGuard() {
    const orig = window.showScreen;
    if (!orig || orig.__fixoGuarded) return;
    const guarded = function (id) {
      if (isOn() && LOCKED_SCREENS.indexOf(id) >= 0) {
        toast('🔒 Locked in Phase 1 testing — Calculator, Quotation & Proforma only');
        return orig('screen-home');
      }
      return orig(id);
    };
    guarded.__fixoGuarded = true;
    window.showScreen = guarded;
  }

  // ---- Apply the on/off visual + interaction state ----
  function apply() {
    const on = isOn();
    document.body.classList.toggle('testing-on', on);
    // lock/unlock tiles
    LOCKED_SEL.forEach(sel => document.querySelectorAll(sel).forEach(el => {
      el.classList.toggle('fx-locked', on);
      if (on) el.setAttribute('data-locked', '1'); else el.removeAttribute('data-locked');
    }));
    // reflect switch state (both landing + any duplicate)
    document.querySelectorAll('.tm-switch').forEach(sw => sw.classList.toggle('on', on));
    document.querySelectorAll('.tm-state').forEach(s => s.textContent = on ? 'ON' : 'OFF');
    // If testing is ON and we're stranded on a now-locked screen, bounce home.
    if (on && LOCKED_SCREENS.indexOf(document.body.dataset.screen) >= 0) window.showScreen('screen-home');
  }

  function toggle() {
    const next = !isOn();
    setOn(next);
    apply();
    toast(next
      ? '🧪 Phase 1 testing ON — only Calculator → Quotation → Proforma → Indent'
      : 'Testing mode OFF — full ecosystem unlocked');
  }

  // ---- Inject the switch + banner into the landing page ----
  function injectUI() {
    const landing = document.querySelector('.landing');
    if (landing && !landing.querySelector('.tm-panel')) {
      const panel = document.createElement('div');
      panel.className = 'tm-panel';
      panel.innerHTML = `
        <button class="tm-switch" id="tm-switch" title="Turn Phase 1 testing on/off" aria-label="Phase 1 testing switch">
          <span class="tm-knob"></span>
        </button>
        <div class="tm-text">
          <b>🧪 Phase&nbsp;1 Testing Mode — <span class="tm-state">OFF</span></b>
          <span>Scope: <b>Smart&nbsp;Calculator → Quotation → Proforma&nbsp;Invoice → Indent</b>, and the indent showing on the <b>Factory&nbsp;Floor</b> &amp; <b>Dispatch</b> (with urgent) for direct printing. Production/dispatch actions &amp; the other apps stay hidden until you switch it off.</span>
        </div>`;
      landing.appendChild(panel);
      panel.querySelector('#tm-switch').addEventListener('click', toggle);
    }
    // A small always-visible banner on the office home while testing is on.
    document.querySelectorAll('#screen-home .home-body-v2, #screen-factory-home .home-body-v2').forEach(body => {
      if (body.querySelector('.tm-banner')) return;
      const b = document.createElement('div');
      b.className = 'tm-banner';
      b.innerHTML = '🧪 <b>Phase 1 testing is ON</b> — scope: Quotation → Proforma → Indent, with the indent showing on the Factory Floor & Dispatch (Indents tab) for printing. Switch it off from the landing page.';
      body.insertBefore(b, body.firstChild);
    });
  }

  // ---- Block clicks on locked tiles (capture phase, before other handlers) ----
  function installClickGuard() {
    document.addEventListener('click', (e) => {
      if (!isOn()) return;
      const hit = e.target.closest(LOCKED_SEL.join(','));
      if (hit) {
        e.preventDefault(); e.stopPropagation();
        toast('🔒 Not part of Phase 1 testing — switch testing off to use this');
      }
    }, true);
  }

  document.addEventListener('DOMContentLoaded', () => {
    injectUI();
    installNavGuard();
    installClickGuard();
    apply();
    // Re-apply whenever a screen is shown (home tiles get re-locked on re-entry).
    const g = window.showScreen;
    window.showScreen = function (id) { const r = g.apply(this, arguments); injectUI(); apply(); return r; };
  });

  window.FIXO_TESTING = { isOn, toggle, apply };
})();
