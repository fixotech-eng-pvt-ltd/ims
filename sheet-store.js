// ============================================================
// FIXOTECH — FACTORY STORE (steel sheets)
//  The "store" where all sheets are kept — separate from the accessories
//  inventory. Tracks every sheet type (MS / HR / HRPO / GI / Stainless Steel ×
//  thickness × size), opening stock, sheets received (with the supplier bill),
//  sheets used on orders (partial sheets allowed), live balance and a daily
//  closing balance. Office sees available / used / remaining to decide reorders.
//  Receiving supports a PHOTO + an AI-style sheet COUNT from the photo, flagging
//  any difference against the count the engineer declared.
// ============================================================
(function () {
  const SHEETS = 'fixo_sheet_store';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };
  const uid = (p) => (p || 'sh-') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB');
  const todayKey = () => new Date().toISOString().slice(0, 10);
  const nf = (n) => { const v = Math.round(num(n) * 100) / 100; return (v % 1 === 0 ? v.toFixed(0) : v.toFixed(2)); };

  const MATERIALS = ['MS', 'HR', 'HRPO', 'GI', 'Stainless Steel'];
  const THICK = ['0.8', '1.0', '1.2', '1.5', '1.6', '2.0', '2.5', '3.0'];
  const SIZES = ['2500 × 1250', '2440 × 1220', '3000 × 1500', '2000 × 1000', 'Coil / cut'];

  const load = () => { try { return JSON.parse(localStorage.getItem(SHEETS) || '[]') || []; } catch (e) { return []; } };
  const store = (a) => { try { localStorage.setItem(SHEETS, JSON.stringify(a.slice(0, 2000))); } catch (e) {} try { if (window.FIXO_SYNC && FIXO_SYNC.pushStore) FIXO_SYNC.pushStore(SHEETS); } catch (e) {} };
  const find = (id) => load().find(s => s.id === id);
  const logAct = (a, d) => { try { if (window.FIXO_LOG) FIXO_LOG.activity('sheetstore', a, d || {}); } catch (e) {} };

  function balance(s) {
    let b = num(s.opening);
    (s.txns || []).forEach(t => { if (t.type === 'in') b += num(t.qty); else if (t.type === 'out') b -= num(t.qty); else if (t.type === 'adjust') b += num(t.qty); });
    return Math.round(b * 100) / 100;
  }
  const label = (s) => `${esc(s.material)} ${esc(s.thickness)}mm${s.size ? ' · ' + esc(s.size) : ''}`;
  function dayFlow(s, key) {
    let inn = 0, out = 0; (s.txns || []).forEach(t => { if ((t.dateKey || '') !== key) return; if (t.type === 'in') inn += num(t.qty); else if (t.type === 'out') out += num(t.qty); else if (t.type === 'adjust') { if (num(t.qty) >= 0) inn += num(t.qty); else out += -num(t.qty); } }); return { inn, out };
  }

  let view = 'stock';
  function render() {
    const host = document.getElementById('sheet-store-app'); if (!host) return;
    const CO = (window.FIXO_DOC && FIXO_DOC.CO) || {};
    const logo = (typeof LOGO_IMG !== 'undefined' && LOGO_IMG) ? LOGO_IMG : '';
    host.innerHTML = `
      <div class="ss-wrap">
        <div class="ss-hero">
          <div class="ss-hero-l"><span class="ss-hero-ic">🗂️</span><div><h2>Factory Store — Sheets</h2><p>Steel sheet stock · received · used · daily closing balance</p></div></div>
          ${logo ? `<div class="ss-logo"><img src="${logo}" onerror="this.style.display='none'"></div>` : ''}
        </div>
        <div class="ss-tabs">
          <button class="ss-tab ${view === 'stock' ? 'active' : ''}" data-v="stock">📦 Stock</button>
          <button class="ss-tab ${view === 'day' ? 'active' : ''}" data-v="day">📅 Day close</button>
          <button class="ss-tab ${view === 'moves' ? 'active' : ''}" data-v="moves">🧾 Movements</button>
        </div>
        <div id="ss-body"></div>
      </div>`;
    host.querySelectorAll('[data-v]').forEach(b => b.onclick = () => { view = b.dataset.v; render(); });
    if (view === 'day') renderDay(); else if (view === 'moves') renderMoves(); else renderStock();
  }

  // ---------- STOCK ----------
  function renderStock() {
    const body = document.getElementById('ss-body');
    const list = load();
    const totalBal = list.reduce((a, s) => a + balance(s), 0);
    const low = list.filter(s => s.minQty && balance(s) <= num(s.minQty));
    const rows = list.length ? list.map(s => {
      const b = balance(s); const lo = s.minQty && b <= num(s.minQty);
      return `<tr class="${lo ? 'ss-low' : ''}">
        <td><b>${label(s)}</b>${lo ? ' <span class="ss-chip no">LOW</span>' : ''}</td>
        <td class="r">${nf(s.opening)}</td>
        <td class="r">${nf((s.txns || []).filter(t => t.type === 'in').reduce((a, t) => a + num(t.qty), 0))}</td>
        <td class="r">${nf((s.txns || []).filter(t => t.type === 'out').reduce((a, t) => a + num(t.qty), 0))}</td>
        <td class="r b">${nf(b)}</td>
        <td class="c">
          <button class="ss-mini in" data-in="${s.id}">＋ Receive</button>
          <button class="ss-mini out" data-out="${s.id}">－ Use</button>
          <button class="ss-mini" data-edit="${s.id}">✎</button>
          <button class="ss-mini x" data-del="${s.id}">🗑</button>
        </td></tr>`;
    }).join('') : '<tr><td colspan="6" class="c ss-muted">No sheet types yet. Click ＋ Add sheet type to set opening stock.</td></tr>';
    body.innerHTML = `
      <div class="ss-tiles">
        <div class="ss-tile"><div class="ss-tile-v">${nf(totalBal)}</div><div class="ss-tile-l">Sheets in store</div></div>
        <div class="ss-tile"><div class="ss-tile-v">${list.length}</div><div class="ss-tile-l">Sheet types</div></div>
        <div class="ss-tile ${low.length ? 'warn' : ''}"><div class="ss-tile-v">${low.length}</div><div class="ss-tile-l">Low / reorder</div></div>
      </div>
      <div class="ss-bar"><button class="ss-btn go" id="ss-add">＋ Add sheet type</button><span class="ss-hint">Office view — what's available, used &amp; remaining, so you know when to order more.</span></div>
      <div class="ss-card"><div class="ss-tblwrap"><table class="ss-tbl"><thead><tr><th>Sheet (material · thickness · size)</th><th class="r">Opening</th><th class="r">Received</th><th class="r">Used</th><th class="r">Balance</th><th class="c">Actions</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    body.querySelector('#ss-add').onclick = () => editType(null);
    body.querySelectorAll('[data-in]').forEach(b => b.onclick = () => moveModal(b.dataset.in, 'in'));
    body.querySelectorAll('[data-out]').forEach(b => b.onclick = () => moveModal(b.dataset.out, 'out'));
    body.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => editType(find(b.dataset.edit)));
    body.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { if (confirm('Remove this sheet type and its history?')) { store(load().filter(x => x.id !== b.dataset.del)); render(); } });
  }

  function editType(s) {
    const isNew = !s; s = s || { id: uid(), material: 'MS', thickness: '1.5', size: SIZES[0], unit: 'sheets', opening: '', minQty: '', txns: [] };
    const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
    const m = modal(`<h3>${isNew ? 'Add' : 'Edit'} sheet type</h3>
      <div class="ss-fields">
        <label>Material<select id="ss-mat">${opt(MATERIALS, s.material)}</select></label>
        <label>Thickness (mm)<input id="ss-th" list="ss-thl" value="${esc(s.thickness)}"><datalist id="ss-thl">${THICK.map(t => `<option>${t}</option>`).join('')}</datalist></label>
        <label>Sheet size<input id="ss-sz" list="ss-szl" value="${esc(s.size || '')}"><datalist id="ss-szl">${SIZES.map(t => `<option>${esc(t)}</option>`).join('')}</datalist></label>
        <label>Opening stock (sheets)<input id="ss-op" type="number" step="any" value="${esc(s.opening)}" ${isNew ? '' : 'disabled'}></label>
        <label>Reorder level (optional)<input id="ss-min" type="number" step="any" value="${esc(s.minQty)}"></label>
      </div>
      ${isNew ? '' : '<p class="ss-note">Opening stock is locked after creation — use Receive / Use to change the balance so history stays correct.</p>'}
      <div class="ss-modal-act"><button class="ss-btn go" data-save>💾 Save</button><button class="ss-btn" data-x>Cancel</button></div>`);
    m.querySelector('[data-x]').onclick = () => m.remove();
    m.querySelector('[data-save]').onclick = () => {
      s.material = m.querySelector('#ss-mat').value; s.thickness = m.querySelector('#ss-th').value.trim(); s.size = m.querySelector('#ss-sz').value.trim();
      s.minQty = num(m.querySelector('#ss-min').value);
      if (isNew) s.opening = num(m.querySelector('#ss-op').value);
      const list = load().filter(x => x.id !== s.id); list.unshift(s); store(list); m.remove(); logAct(isNew ? 'add_type' : 'edit_type', { sheet: label(s).replace(/<[^>]+>/g, '') }); toast('Saved'); render();
    };
  }

  // ---------- Receive / Use ----------
  function moveModal(id, type) {
    const s = find(id); if (!s) return;
    const isIn = type === 'in';
    let photo = '', scanCount = null;
    const m = modal(`<h3>${isIn ? '＋ Receive sheets' : '－ Use sheets'} — ${label(s)}</h3>
      <div class="ss-target">Current balance: <b>${nf(balance(s))} sheets</b></div>
      <div class="ss-fields">
        <label>${isIn ? 'Sheets received' : 'Sheets used'}<input id="ss-q" type="number" step="any" placeholder="0 — part sheets ok e.g. 0.5"></label>
        <label>Date<input id="ss-d" value="${today()}"></label>
        ${isIn
          ? `<label>Supplier<input id="ss-sup" placeholder="e.g. Steel Center"></label><label>Bill / invoice no.<input id="ss-bill" placeholder="supplier bill no."></label><label>Bill amount ₹ (optional)<input id="ss-amt" type="number" step="any"></label>`
          : `<label>For order / customer<input id="ss-ord" placeholder="customer / indent no."></label><label class="ss-wide">Note (e.g. part sheet kept back)<input id="ss-note" placeholder="optional"></label>`}
      </div>
      ${isIn ? `<div class="ss-scanbox">
        <div class="ss-scan-h">📷 Photo &amp; auto-count <span class="ss-muted">— attach a photo of the stack; the app estimates the sheet count and flags any mismatch.</span></div>
        <div class="ss-scan-row">
          <label class="ss-photo-btn">📷 Add / take photo<input type="file" id="ss-ph" accept="image/*" capture="environment" hidden></label>
          <span id="ss-scan-status" class="ss-muted">No photo yet.</span>
        </div>
        <div id="ss-scan-prev"></div>
        <div id="ss-scan-flag"></div>
      </div>` : ''}
      <div class="ss-modal-act"><button class="ss-btn go" data-save>💾 Save</button><button class="ss-btn" data-x>Cancel</button></div>`, 'big');
    m.querySelector('[data-x]').onclick = () => m.remove();

    const flag = () => {
      if (!isIn) return; const el = m.querySelector('#ss-scan-flag'); if (!el) return;
      const declared = num(m.querySelector('#ss-q').value);
      if (scanCount == null) { el.innerHTML = ''; return; }
      if (!declared) { el.innerHTML = `<div class="ss-flag ok">📷 Scan estimate: <b>${scanCount}</b> sheets. Type the count above to compare.</div>`; return; }
      const diff = declared - scanCount;
      if (Math.abs(diff) <= Math.max(1, Math.round(declared * 0.03))) el.innerHTML = `<div class="ss-flag ok">✓ Declared <b>${nf(declared)}</b> ≈ scan <b>${scanCount}</b>. Matches.</div>`;
      else el.innerHTML = `<div class="ss-flag no">⚠ Mismatch — declared <b>${nf(declared)}</b> but scan found <b>${scanCount}</b> (${diff > 0 ? diff + ' fewer in photo' : (-diff) + ' more in photo'}). Please verify before saving.</div>`;
    };
    if (isIn) {
      const qel = m.querySelector('#ss-q'); qel.oninput = flag;
      const fi = m.querySelector('#ss-ph');
      fi.onchange = () => { const f = fi.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => {
        downscale(rd.result, 1000, (small) => {
          photo = small;
          m.querySelector('#ss-scan-prev').innerHTML = `<div class="ss-scan-imgwrap"><img src="${small}" class="ss-scan-img"><div class="ss-scan-ctl"><label>Stack direction <select id="ss-dir"><option value="h">Stacked ▲▼ (horizontal sheets)</option><option value="v">Side-by-side ◀▶</option></select></label><label>Sensitivity <input id="ss-sens" type="range" min="0" max="100" value="55"></label><button class="ss-btn go" id="ss-count">🔢 Count sheets</button></div></div>`;
          m.querySelector('#ss-scan-status').textContent = 'Photo added — tap "Count sheets".';
          const run = () => { const dir = m.querySelector('#ss-dir').value; const sens = num(m.querySelector('#ss-sens').value) / 100; m.querySelector('#ss-scan-status').textContent = 'Counting…'; estimateCount(small, dir, sens, (n) => { scanCount = n; m.querySelector('#ss-scan-status').innerHTML = `Scan estimate: <b>${n}</b> sheets`; flag(); }); };
          m.querySelector('#ss-count').onclick = run; run();
        });
      }; rd.readAsDataURL(f); };
    }
    m.querySelector('[data-save]').onclick = () => {
      const q = num(m.querySelector('#ss-q').value); if (q <= 0) { toast('Enter a quantity'); return; }
      if (!isIn && q > balance(s) + 0.001) { if (!confirm('Using more than the balance — allow negative stock?')) return; }
      const t = { id: uid('tx-'), type, qty: q, date: m.querySelector('#ss-d').value.trim() || today(), dateKey: todayKey(), at: new Date().toISOString() };
      if (isIn) { t.supplier = m.querySelector('#ss-sup').value.trim(); t.billNo = m.querySelector('#ss-bill').value.trim(); t.amount = num(m.querySelector('#ss-amt').value); if (photo) t.photo = photo; if (scanCount != null) { t.scanCount = scanCount; t.declared = q; } }
      else { t.order = m.querySelector('#ss-ord').value.trim(); t.note = m.querySelector('#ss-note').value.trim(); }
      s.txns = s.txns || []; s.txns.unshift(t);
      const list = load().filter(x => x.id !== s.id); list.unshift(s); store(list); m.remove();
      logAct(isIn ? 'receive' : 'use', { sheet: label(s).replace(/<[^>]+>/g, ''), qty: q, scan: scanCount, supplier: t.supplier, order: t.order });
      toast(isIn ? `Received ${nf(q)} sheets` + (scanCount != null && Math.abs(q - scanCount) > 1 ? ' — ⚠ scan differed' : '') : `Used ${nf(q)} sheets`); render();
    };
  }

  // ---------- Day close ----------
  function renderDay() {
    const body = document.getElementById('ss-body');
    const key = todayKey(); const list = load();
    const rows = list.map(s => { const f = dayFlow(s, key); const bal = balance(s); const open = Math.round((bal - f.inn + f.out) * 100) / 100; return { s, open, inn: f.inn, out: f.out, bal }; });
    const any = rows.some(r => r.inn || r.out);
    const tr = rows.map(r => `<tr><td><b>${label(r.s)}</b></td><td class="r">${nf(r.open)}</td><td class="r ss-g">${r.inn ? '+' + nf(r.inn) : '—'}</td><td class="r ss-r">${r.out ? '−' + nf(r.out) : '—'}</td><td class="r b">${nf(r.bal)}</td></tr>`).join('');
    body.innerHTML = `
      <div class="ss-bar"><b>Today — ${today()}</b><span class="ss-hint">Opening, received &amp; used today, with the auto closing balance per sheet type.</span><button class="ss-btn" id="ss-print">🖨 Print day sheet</button></div>
      <div class="ss-card"><div class="ss-tblwrap"><table class="ss-tbl"><thead><tr><th>Sheet</th><th class="r">Opening</th><th class="r">Received</th><th class="r">Used</th><th class="r">Closing</th></tr></thead><tbody>${tr || '<tr><td colspan="5" class="c ss-muted">No sheet types yet.</td></tr>'}</tbody></table></div></div>
      ${any ? '' : '<p class="ss-muted" style="padding:8px 2px">No movements recorded today yet.</p>'}`;
    const pr = body.querySelector('#ss-print'); if (pr) pr.onclick = () => printDay(rows);
  }
  function printDay(rows) {
    const w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print'); return; }
    const tr = rows.map(r => `<tr><td>${label(r.s)}</td><td style="text-align:right">${nf(r.open)}</td><td style="text-align:right">${nf(r.inn)}</td><td style="text-align:right">${nf(r.out)}</td><td style="text-align:right"><b>${nf(r.bal)}</b></td></tr>`).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Sheet Store — Day Close ${today()}</title><style>body{font-family:Arial;padding:18px}h2{margin:0 0 4px}table{width:100%;border-collapse:collapse;margin-top:10px}td,th{border:1px solid #333;padding:6px 8px;font-size:13px}th{background:#eef}</style></head><body><h2>FIXOTECH — Factory Store (Sheets) · Day Close</h2><div>${today()}</div><table><thead><tr><th>Sheet</th><th>Opening</th><th>Received</th><th>Used</th><th>Closing</th></tr></thead><tbody>${tr}</tbody></table></body></html>`);
    w.document.close(); setTimeout(() => { try { w.focus(); w.print(); } catch (e) {} }, 300);
  }

  // ---------- Movements log ----------
  function renderMoves() {
    const body = document.getElementById('ss-body');
    const all = [];
    load().forEach(s => (s.txns || []).forEach(t => all.push({ s, t })));
    all.sort((a, b) => (b.t.at || '').localeCompare(a.t.at || ''));
    const rows = all.length ? all.slice(0, 400).map(({ s, t }) => `<tr>
      <td class="c">${esc(t.date || '')}</td><td><b>${label(s)}</b></td>
      <td class="c"><span class="ss-chip ${t.type === 'in' ? 'in' : t.type === 'out' ? 'out' : ''}">${t.type === 'in' ? 'Received' : t.type === 'out' ? 'Used' : 'Adjust'}</span></td>
      <td class="r b">${t.type === 'out' ? '−' : '+'}${nf(t.qty)}</td>
      <td>${esc(t.supplier || t.order || '')}${t.billNo ? ' · ' + esc(t.billNo) : ''}${t.note ? ' · ' + esc(t.note) : ''}${t.scanCount != null ? ` · 📷 scan ${t.scanCount}${t.declared != null && Math.abs(num(t.declared) - t.scanCount) > 1 ? ' ⚠' : ''}` : ''}</td>
      <td class="c">${t.photo ? `<button class="ss-mini" data-ph="${s.id}|${t.id}">📷</button>` : ''}</td></tr>`).join('') : '<tr><td colspan="6" class="c ss-muted">No movements yet.</td></tr>';
    body.innerHTML = `<div class="ss-card"><div class="ss-tblwrap"><table class="ss-tbl"><thead><tr><th>Date</th><th>Sheet</th><th class="c">Type</th><th class="r">Qty</th><th>Ref</th><th class="c">Photo</th></tr></thead><tbody>${rows}</tbody></table></div></div>`;
    body.querySelectorAll('[data-ph]').forEach(b => b.onclick = () => { const [sid, tid] = b.dataset.ph.split('|'); const s = find(sid); const t = s && (s.txns || []).find(x => x.id === tid); if (t && t.photo) modal(`<h3>Receipt photo — ${label(s)}</h3><img src="${t.photo}" style="max-width:100%;border-radius:8px">${t.scanCount != null ? `<p class="ss-note">Scan estimate ${t.scanCount} · declared ${nf(t.declared)}</p>` : ''}<div class="ss-modal-act"><button class="ss-btn go" data-x>Close</button></div>`, 'big').querySelector('[data-x]').onclick = function () { this.closest('.ss-overlay').remove(); }; });
  }

  // ---------- image helpers ----------
  function downscale(dataUrl, max, cb) {
    try { const img = new Image(); img.onload = () => { let w = img.width, h = img.height; if (w > max || h > max) { const s = max / Math.max(w, h); w = Math.round(w * s); h = Math.round(h * s); } const c = document.createElement('canvas'); c.width = w; c.height = h; c.getContext('2d').drawImage(img, 0, 0, w, h); try { cb(c.toDataURL('image/jpeg', 0.82)); } catch (e) { cb(dataUrl); } }; img.onerror = () => cb(dataUrl); img.src = dataUrl; } catch (e) { cb(dataUrl); }
  }
  // Edge-based sheet counter: a stack of sheets shows repeated edges (lines). We
  // build a brightness profile along the stacking direction, take its gradient,
  // and count the evenly-spaced peaks. It's a best-effort ESTIMATE the engineer
  // confirms — not a trained model — but good enough to flag a miscount.
  function estimateCount(dataUrl, dir, sensitivity, cb) {
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 700; let w = img.width, h = img.height; const sc = Math.min(1, maxW / Math.max(w, h)); w = Math.max(1, Math.round(w * sc)); h = Math.max(1, Math.round(h * sc));
        const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0, w, h);
        const data = ctx.getImageData(0, 0, w, h).data;
        const gray = (x, y) => { const i = (y * w + x) * 4; return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]; };
        let prof = [];
        if (dir === 'v') { const y0 = Math.floor(h * 0.2), y1 = Math.max(y0 + 1, Math.ceil(h * 0.8)); for (let x = 0; x < w; x++) { let s = 0; for (let y = y0; y < y1; y++) s += gray(x, y); prof.push(s / (y1 - y0)); } }
        else { const x0 = Math.floor(w * 0.2), x1 = Math.max(x0 + 1, Math.ceil(w * 0.8)); for (let y = 0; y < h; y++) { let s = 0; for (let x = x0; x < x1; x++) s += gray(x, y); prof.push(s / (x1 - x0)); } }
        // smooth
        const sm = prof.map((v, i) => { let a = 0, n = 0; for (let k = -2; k <= 2; k++) { const j = i + k; if (j >= 0 && j < prof.length) { a += prof[j]; n++; } } return a / n; });
        // Count DARK BANDS (each sheet edge = one dark line = one band). We cross
        // the mean with a hysteresis margin so a single band counts exactly once,
        // not twice (which is what counting raw gradient peaks did).
        let mn = Infinity, mx = -Infinity, sum = 0;
        sm.forEach(v => { if (v < mn) mn = v; if (v > mx) mx = v; sum += v; });
        const mean = sum / sm.length, rng = (mx - mn) || 1;
        const margin = rng * (0.04 + (1 - sensitivity) * 0.16);   // higher sensitivity → smaller margin → more bands
        let count = 0, state = 1;   // 1 = in light region, -1 = in dark band
        for (let i = 0; i < sm.length; i++) {
          if (state >= 0 && sm[i] < mean - margin) { count++; state = -1; }
          else if (sm[i] > mean + margin) { state = 1; }
        }
        cb(Math.max(0, count));
      } catch (e) { cb(0); }
    };
    img.onerror = () => cb(0);
    img.src = dataUrl;
  }

  function toast(m) { return (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m)); }
  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'ss-overlay'; el.innerHTML = `<div class="ss-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-sheet-store"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-sheet-store') render();
  });
  window.FIXO_SHEET_STORE = { render, balance, load };
})();
