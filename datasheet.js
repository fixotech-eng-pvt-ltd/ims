// ============================================================
// Fixotech Engineering — DATA SHEET PREP  (Technical Data Sheet builder)
// Office-side engineering app. Pick any product (full Smart-Calculator list),
// choose Material + Finish (GI / MS / Stainless Steel / Aluminium — same options
// as the Smart Calculator, which fills MOC & Finish), fill the specs (dropdown
// options + free typing on every field), add client / project info, then print
// the Technical Data Sheet (header banner, watermark, stamp, date). The sheet
// fits its content (no wasted paper). Drafts persist across reloads.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const toast = (m) => (window.FIXO && FIXO.toast ? FIXO.toast(m) : console.log(m));
  const uid = (p) => (p || 'ds') + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  const today = () => new Date().toLocaleDateString('en-GB').replace(/\//g, '-');   // dd-mm-yyyy
  // Banner that prints ON the data sheet (team-supplied logo + cert badges).
  const HEADER = (typeof window !== 'undefined' && window.ENGG_HEADER_DATA) ? window.ENGG_HEADER_DATA : 'assets/brand/engg-header.png';
  // The normal engineering logo for the APP's own top bar (not the printed sheet).
  const ENGG_LOGO = 'https://fplogoimages.withfloats.com/actual/4787f692897d42598da86c9d05413fc6jpeg';
  const WM = 'assets/watermark-f.png';
  // The real company stamp used on the quotation / proforma (from images.js).
  function stampData() { try { return (typeof SEAL_IMG !== 'undefined' && SEAL_IMG) ? SEAL_IMG : null; } catch (e) { return null; } }

  // ---------- Material / Finish (identical to the Smart Calculator) ----------
  const MATERIALS = {
    'GI': { finishes: ['GI', 'Powder Coated'], gsm: true },
    'MS': { finishes: ['Plain', 'Hot Dip', 'Powder Coated'] },
    'Stainless Steel': { finishes: ['SS 202', 'SS 304', 'SS 316'] },
    'Aluminium': { finishes: ['Commercial Grade', 'Marine Grade'] }
  };
  const GSM_OPTS = ['—', '80', '120', '180', '200', '275'];
  // Material + finish (+GSM) → the MOC and Finish text printed on the data sheet.
  function materialSpec(mat, fin, gsm) {
    let moc = mat, finish = fin;
    if (mat === 'GI') { moc = 'GI'; finish = fin === 'GI' ? ('Pre-Galvanized (GI)' + (gsm && gsm !== '—' ? ' ' + gsm + ' GSM' : '')) : ('GI Powder Coated' + (gsm && gsm !== '—' ? ' ' + gsm + ' GSM' : '')); }
    else if (mat === 'MS') { moc = 'MS'; finish = fin === 'Hot Dip' ? 'MS Hot Dip Galvanized' : fin === 'Powder Coated' ? 'MS Powder Coated' : 'MS Plain'; }
    else if (mat === 'Stainless Steel') { moc = fin; finish = 'Stainless Steel ' + fin; }
    else if (mat === 'Aluminium') { moc = 'Aluminium'; finish = 'Aluminium (' + fin + ')'; }
    return { moc, finish };
  }

  // ---------- product field templates (dropdown options + free typing) ----------
  // Matched exactly to the reference Technical Data Sheets.
  const F = (key, label, opts, def) => ({ key, label, opts: opts || [], def: def == null ? '' : def });
  const THK = ['1.0mm', '1.2mm', '1.5mm', '1.6mm', '2.0mm', '2.5mm', '3.0mm'];
  const WID = ['50mm', '75mm', '100mm', '150mm', '200mm', '300mm', '450mm', '600mm'];
  const TEMPLATES = {
    perforated: { label: 'Perforated Cable Tray', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('thickness', 'Thickness', THK, '1.6mm'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('width', 'Width', WID.concat(['200, 150, 100mm']), '200, 150, 100mm'),
      F('height', 'Height', ['25mm', '40mm', '50mm', '60mm', '75mm', '100mm'], '60mm'),
      F('length', 'Length of Tray', ['2500mm', '3000mm'], '2500mm'),
      F('jointPlate', 'Joint Plate', ['50 x 175mm', '40 x 175mm'], '50 x 175mm'),
      F('boltSize', 'Bolt Size', ['M08 x 15 mm', 'M8 x 20 mm', 'M10 x 25 mm'], 'M08 x 15 mm'),
      F('perforation', 'Perforation %', ['Not more than 17.5%', 'Not more than 20%', 'As per standard'], 'Not more than 17.5%')
    ] },
    ladder: { label: 'Ladder Cable Tray', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('thickness', 'Thickness', THK, '2.0mm'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('width', 'Width', WID.concat(['200, 100mm']), '200, 100mm'),
      F('sideRunner', 'Side Runner', ['C type', 'L type'], 'C type'),
      F('height', 'Height', ['50mm', '60mm', '75mm', '100mm'], '50mm'),
      F('collar', 'Collar', ['10 mm', '12 mm', 'Nil'], '12 mm'),
      F('length', 'Length', ['2500mm', '3000mm'], '2500mm'),
      F('crossRung', 'Cross Rung Size', ['35 x 15 mm', '40 x 20 mm'], '35 x 15 mm'),
      F('rungSlot', 'Rung Slot', ['30 x 8 Oblong', '25 x 8 Oblong'], '30 x 8 Oblong'),
      F('rungSpace', 'Rungs Space', ['300mm Centre to center', '250mm Centre to center'], '300mm Centre to center'),
      F('connecting', 'Connecting type', ['Joint plate size of 40 x 175mm', 'Joint plate size of 50 x 175mm'], 'Joint plate size of 40 x 175mm')
    ] },
    raceway: { label: 'Raceway with Cover', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('bottomThk', 'Bottom Thickness', THK, '1.6mm'),
      F('width', 'Width', WID, '200mm'),
      F('height', 'Height', ['25mm', '40mm', '50mm', '75mm'], '50mm'),
      F('collar', 'Collar', ['10 mm', '12 mm', 'Nil'], '10 mm'),
      F('coverThk', 'Cover Thickness', THK, '1.6mm'),
      F('length', 'Length', ['2500mm', '3000mm'], '2500mm'),
      F('coverCollar', 'Cover Collar', ['10mm', '12mm'], '10mm'),
      F('coverLength', 'Cover Length', ['2500mm', '3000mm'], '2500mm'),
      F('cover', 'Cover', ['Push to fix type', 'Screwed type'], 'Push to fix type'),
      F('connecting', 'Connecting type', ['Joint Plate 40 x 175mm', 'Joint Plate 50 x 175mm'], 'Joint Plate 40 x 175mm'),
      F('boltSize', 'Bolt Size', ['M08 x 15 mm', 'M8 x 20 mm', 'M10 x 25 mm'], 'M08 x 15 mm')
    ] },
    jbox: { label: 'Junction Box', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('thkBox', 'Thickness (Box)', ['1.6 mm', '2.0 mm', '2.5 mm'], '2.0 mm'),
      F('dimOuter', 'Dimension (Outer)', ['(L)100 x (W)100 x (H)55 mm', '(L)150 x (W)150 x (H)75 mm', '(L)200 x (W)200 x (H)100 mm'], '(L)100 x (W)100 x (H)55 mm'),
      F('dimInner', 'Dimension (Inner)', ['(L)60 x (W)60 x (H)53 mm'], '(L)60 x (W)60 x (H)53 mm'),
      F('cover', 'Cover', ['Screwed type', 'Hinged type'], 'Screwed type'),
      F('thickness', 'Thickness', ['1.6 mm', '2.0 mm'], '2.0 mm'),
      F('opening', 'Opening', ['4 Side opening', '2 Side opening', '1 Side opening'], '4 Side opening'),
      F('dummyCover', 'Dummy Cover', ['1.6 mm thickness 2 Nos', 'Nil'], '1.6 mm thickness 2 Nos')
    ] },
    covertray: { label: 'Cable Tray with Cover', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('thickness', 'Bottom Thickness', THK, '1.6mm'),
      F('width', 'Width', WID, '200mm'),
      F('height', 'Height', ['25mm', '40mm', '50mm', '75mm', '100mm'], '50mm'),
      F('sideLip', 'Side Lip / Limb', ['10 mm', '12 mm', 'Nil'], '10 mm'),
      F('coverThk', 'Cover Thickness', THK, '1.6mm'),
      F('length', 'Length', ['2500mm', '3000mm'], '2500mm'),
      F('jointPlate', 'Joint Plate', ['40 x 175mm', '50 x 175mm'], '40 x 175mm'),
      F('boltSize', 'Bolt Size', ['M08 x 15 mm', 'M8 x 20 mm', 'M10 x 25 mm'], 'M08 x 15 mm')
    ] },
    generic: { label: 'Product', fields: [
      F('make', 'Make', ['FIXOTECH'], 'FIXOTECH'),
      F('moc', 'MOC', ['GI', 'MS', 'SS 304', 'SS 316', 'Aluminium'], 'GI'),
      F('finish', 'Finish', ['Pre-Galvanized (GI)', 'MS Hot Dip Galvanized', 'MS Powder Coated', 'Stainless Steel', 'Aluminium'], 'Pre-Galvanized (GI)'),
      F('thickness', 'Thickness', THK, '1.6mm'),
      F('width', 'Width', WID, '200mm'),
      F('height', 'Height', ['50mm', '60mm', '75mm', '100mm'], '50mm'),
      F('length', 'Length', ['2500mm', '3000mm'], ''),
      F('jointPlate', 'Joint Plate', ['40 x 175mm', '50 x 175mm'], ''),
      F('boltSize', 'Bolt Size', ['M08 x 15 mm', 'M8 x 20 mm', 'M10 x 25 mm'], '')
    ] }
  };

  // Full product list (grouped) — mirrors the Smart Calculator; each maps to a template.
  const DS_GROUPS = [
    ['Cable Trays & Raceway', [
      ['Perforated Cable Tray', 'perforated', 'Perforated Cable Tray'],
      ['Cable Tray with Cover', 'covertray', 'Cable Tray with Cover'],
      ['Cover Cable Tray', 'covertray', 'Cover Cable Tray'],
      ['Raceway with Cover (Unperforated)', 'raceway', 'Raceway with Cover (Unperforated)'],
      ['PG (GI) Raceway with Cover (Partition)', 'raceway', 'PG (GI) Raceway with Cover (Partition)'],
      ['Aluminium Raceway with Cover', 'raceway', 'Aluminium Raceway with Cover']
    ]],
    ['Ladder Cable Trays', [
      ['Ladder Cable Tray (Welded) 300 c/c', 'ladder', 'Ladder Cable Tray (Welded)'],
      ['Ladder Cable Tray (Welded) 250 c/c', 'ladder', 'Ladder Cable Tray (Welded)'],
      ['Ladder Cable Tray (Boltable) 300 c/c', 'ladder', 'Ladder Cable Tray (Boltable)'],
      ['Ladder Cable Tray (Boltable) 250 c/c', 'ladder', 'Ladder Cable Tray (Boltable)']
    ]],
    ['Junction Box', [
      ['Junction Box 4 sides open & Top screwed with cover', 'jbox', 'Junction Box 4 sides open & Top screwed with cover'],
      ['Junction Box', 'jbox', 'Junction Box']
    ]],
    ['Bends & Fittings', [
      ['Perforated Tee Bend', 'generic', 'Perforated Tee Bend'],
      ['Perforated Cross Bend', 'generic', 'Perforated Cross Bend'],
      ['Perforated Unequal Tee Bend', 'generic', 'Perforated Unequal Tee Bend'],
      ['Horizontal Bend Perforated', 'generic', 'Horizontal Bend Perforated'],
      ['Horizontal Bend Perf. with Cover', 'generic', 'Horizontal Bend Perf. with Cover'],
      ['Reducer Bend', 'generic', 'Reducer Bend'],
      ['Tee Bend with Cover', 'generic', 'Tee Bend with Cover'],
      ['Cross Bend with Cover', 'generic', 'Cross Bend with Cover'],
      ['Tee Bend with Cover (Partition)', 'generic', 'Tee Bend with Cover (Partition)'],
      ['Vertical Bend', 'generic', 'Vertical Bend'],
      ['H Bend Ladder', 'generic', 'H Bend Ladder'],
      ['Vertical Tee Bend Ladder', 'generic', 'Vertical Tee Bend Ladder'],
      ['Ladder Equal Tee', 'generic', 'Ladder Equal Tee'],
      ['Ladder Equal Cross', 'generic', 'Ladder Equal Cross']
    ]],
    ['Other', [['Other / Custom', 'generic', 'Cable Tray']]]
  ];
  const DS_BY_NAME = {};
  DS_GROUPS.forEach(g => g[1].forEach(p => { DS_BY_NAME[p[0]] = { tmpl: p[1], printed: p[2] }; }));

  const SESS = 'fixo_ds_sessions', SAVED = 'fixo_ds_saved';
  const loadSaved = () => { try { return JSON.parse(localStorage.getItem(SAVED) || '[]') || []; } catch (e) { return []; } };
  const storeSaved = (a) => { try { localStorage.setItem(SAVED, JSON.stringify(a.slice(0, 500))); } catch (e) {} };

  let clientsCache = [];
  async function loadClients() { try { if (window.FixoDB && FixoDB.listClients) clientsCache = await FixoDB.listClients() || []; } catch (e) { clientsCache = []; } return clientsCache; }

  function freshValues(tmpl) { const o = {}; TEMPLATES[tmpl].fields.forEach(f => o[f.key] = f.def); return o; }
  function applyMaterial(m) { const s = materialSpec(m.material, m.finSel, m.gsm); if ('moc' in m.values) m.values.moc = s.moc; if ('finish' in m.values) m.values.finish = s.finish; }
  function fresh(sel) {
    sel = sel || 'Perforated Cable Tray'; const info = DS_BY_NAME[sel] || { tmpl: 'generic', printed: sel };
    const m = { id: uid('ds-'), sel, tmpl: info.tmpl, productName: info.printed, customer: '', projectName: '', location: '', date: today(), material: 'GI', finSel: 'GI', gsm: '—', values: freshValues(info.tmpl) };
    applyMaterial(m); return m;
  }

  // ---------- sessions ----------
  let sessions = [], activeIdx = 0, model = null;
  function loadSessions() {
    try { const s = JSON.parse(localStorage.getItem(SESS) || 'null'); if (s && Array.isArray(s.sessions) && s.sessions.filter(Boolean).length) { sessions = s.sessions.filter(Boolean); activeIdx = Math.min(s.activeIdx || 0, sessions.length - 1); model = sessions[activeIdx]; return; } } catch (e) {}
    sessions = [fresh()]; activeIdx = 0; model = sessions[activeIdx];
  }
  function persistSessions() { try { if (model) sessions[activeIdx] = model; if (sessions.length) localStorage.setItem(SESS, JSON.stringify({ sessions, activeIdx })); } catch (e) {} }
  function newSession() { persistSessions(); sessions.push(fresh()); activeIdx = sessions.length - 1; model = sessions[activeIdx]; render(); persistSessions(); }
  function switchSession(i) { if (i === activeIdx) return; persistSessions(); activeIdx = i; model = sessions[activeIdx]; render(); }
  function closeSession(i) { persistSessions(); if (sessions.length <= 1) { sessions = [fresh()]; activeIdx = 0; } else { sessions.splice(i, 1); activeIdx = Math.min(i, sessions.length - 1); } model = sessions[activeIdx]; render(); persistSessions(); }
  function clearSession() { if (!confirm('Clear this data sheet and start fresh? (Saved data sheets are not affected.)')) return; sessions[activeIdx] = fresh(model.sel); model = sessions[activeIdx]; render(); persistSessions(); }
  const tmplOf = (m) => TEMPLATES[m.tmpl] || TEMPLATES.generic;
  const sessLabel = (m) => (m.customer || '').trim() ? (m.customer || '').trim().slice(0, 16) : tmplOf(m).label;

  function setProductByName(sel) {
    const info = DS_BY_NAME[sel] || { tmpl: 'generic', printed: sel };
    model.sel = sel; model.tmpl = info.tmpl; model.productName = info.printed; model.values = freshValues(info.tmpl); applyMaterial(model); render();
  }

  // ---------- builder UI ----------
  function render() {
    const host = document.getElementById('datasheet-app'); if (!host) return;
    if (!sessions.length) loadSessions();
    model = sessions[activeIdx];
    const tmpl = tmplOf(model);
    const sessTabs = sessions.map((s, i) => `<div class="inv-sess-tab ${i === activeIdx ? 'active' : ''}" data-si="${i}"><span class="inv-sess-no">${esc(tmplOf(s).label)}</span><span class="inv-sess-sub">${esc(sessLabel(s))}</span>${sessions.length > 1 ? `<span class="inv-sess-close" data-close="${i}" title="Close">×</span>` : ''}</div>`).join('');
    const prodSelect = `<select id="ds-prodsel" class="inv-in">${DS_GROUPS.map(g => `<optgroup label="${esc(g[0])}">${g[1].map(p => `<option value="${esc(p[0])}" ${p[0] === model.sel ? 'selected' : ''}>${esc(p[0])}</option>`).join('')}</optgroup>`).join('')}</select>`;
    const matOpts = Object.keys(MATERIALS).map(x => `<option ${x === model.material ? 'selected' : ''}>${x}</option>`).join('');
    const finOpts = (MATERIALS[model.material] || MATERIALS.GI).finishes.map(x => `<option ${x === model.finSel ? 'selected' : ''}>${x}</option>`).join('');
    const gsmSel = MATERIALS[model.material] && MATERIALS[model.material].gsm;
    const dl = (f) => `<datalist id="ds-dl-${f.key}">${f.opts.map(o => `<option value="${esc(o)}">`).join('')}</datalist>`;
    const fieldRows = tmpl.fields.map(f => `<label class="ds-field"><span class="ds-flab">${esc(f.label)}</span><input class="inv-in ds-fin" list="ds-dl-${f.key}" data-fk="${f.key}" value="${esc(model.values[f.key] == null ? '' : model.values[f.key])}" placeholder="${esc(f.def || 'type or pick')}" autocomplete="off">${dl(f)}</label>`).join('');

    host.innerHTML = `
      <div class="inv-wrap ds-wrap">
        <div class="inv-header">
          <div class="inv-header-left"><img src="${ENGG_LOGO}" onerror="this.style.display='none'" class="inv-header-logo">
            <div class="inv-header-divider"></div>
            <div class="inv-header-titles"><div class="inv-h-title">DATA <span class="inv-h-bold">SHEET PREP</span></div><div class="inv-h-sub">Technical Data Sheet</div></div></div>
          <div class="inv-header-right"><div class="inv-h-co">FIXOTECH ENGINEERING SYSTEMS PVT. LTD.</div></div>
        </div>

        <div class="inv-sess-bar"><div class="inv-sess-tabs" id="ds-sess-tabs">${sessTabs}</div><button class="inv-sess-add" id="ds-sess-add" title="New data sheet">＋</button></div>
        <div class="inv-topbtns">
          <button class="cp-btn small" id="ds-save">💾 Save</button>
          <button class="cp-btn small" id="ds-records">📋 Data sheet records</button>
          <button class="cp-btn small inv-clear" id="ds-clear">🗑 Clear</button>
        </div>

        <div class="inv-card"><div class="inv-card-h"><span class="inv-step">1</span> Client &amp; Project</div>
          <div class="ds-client">
            <label class="ds-field"><span class="ds-flab">Customer name</span><div class="inv-cust-box"><input class="inv-in" id="ds-cust" value="${esc(model.customer)}" placeholder="Type to search existing customers…" autocomplete="off"><div class="inv-cust-dd" id="ds-cust-dd" hidden></div></div></label>
            <label class="ds-field"><span class="ds-flab">Project name</span><input class="inv-in" id="ds-proj" value="${esc(model.projectName)}" placeholder="Project / site name"></label>
            <label class="ds-field"><span class="ds-flab">Project location</span><input class="inv-in" id="ds-loc" value="${esc(model.location)}" placeholder="City / site location"></label>
            <label class="ds-field"><span class="ds-flab">Date</span><input class="inv-in" id="ds-date" value="${esc(model.date)}"></label>
          </div>
        </div>

        <div class="inv-card"><div class="inv-card-h"><span class="inv-step">2</span> Product &amp; Material</div>
          <div class="ds-pmrow">
            <label class="ds-field ds-wide"><span class="ds-flab">Product</span>${prodSelect}</label>
            <label class="ds-field"><span class="ds-flab">Material</span><select id="ds-material" class="inv-in">${matOpts}</select></label>
            <label class="ds-field"><span class="ds-flab">Finish</span><select id="ds-finish" class="inv-in">${finOpts}</select></label>
            <label class="ds-field" ${gsmSel ? '' : 'style="display:none"'}><span class="ds-flab">GSM</span><select id="ds-gsm" class="inv-in">${GSM_OPTS.map(x => `<option ${x === model.gsm ? 'selected' : ''}>${x === '—' ? '— GSM' : x + ' GSM'}</option>`).join('')}</select></label>
          </div>
          <label class="ds-field ds-pname"><span class="ds-flab">Product (as printed)</span><input class="inv-in" id="ds-pname" value="${esc(model.productName)}" placeholder="Product description"></label>
        </div>

        <div class="inv-card"><div class="inv-card-h"><span class="inv-step">3</span> ${esc(tmpl.label)} — specifications <span class="rp-mini">options or type freely</span></div>
          <div class="ds-fields">${fieldRows}</div>
        </div>

        <button class="inv-bigbtn" id="ds-verify">🖨 Verify &amp; Print — Technical Data Sheet</button>
      </div>`;

    const bind = (id, key) => { const el = document.getElementById(id); if (el) el.oninput = () => { model[key] = el.value; }; };
    bind('ds-proj', 'projectName'); bind('ds-loc', 'location'); bind('ds-date', 'date'); bind('ds-pname', 'productName');
    document.getElementById('ds-cust').oninput = (e) => { model.customer = e.target.value; drawCustDD(); };
    attachCustomerPicker();
    document.getElementById('ds-prodsel').onchange = (e) => setProductByName(e.target.value);
    document.getElementById('ds-material').onchange = (e) => { model.material = e.target.value; const fins = MATERIALS[model.material].finishes; if (!fins.includes(model.finSel)) model.finSel = fins[0]; applyMaterial(model); render(); };
    document.getElementById('ds-finish').onchange = (e) => { model.finSel = e.target.value; applyMaterial(model); render(); };
    const gs = document.getElementById('ds-gsm'); if (gs) gs.onchange = (e) => { model.gsm = e.target.value.replace(' GSM', '').replace('— ', '—'); applyMaterial(model); render(); };
    host.querySelectorAll('.ds-fin').forEach(inp => inp.oninput = () => { model.values[inp.dataset.fk] = inp.value; });
    document.getElementById('ds-sess-add').onclick = () => newSession();
    document.getElementById('ds-sess-tabs').querySelectorAll('.inv-sess-tab').forEach(t => { t.onclick = (e) => { if (e.target.dataset.close != null) { closeSession(+e.target.dataset.close); return; } switchSession(+t.dataset.si); }; });
    document.getElementById('ds-save').onclick = () => saveSheet();
    document.getElementById('ds-records').onclick = openRecords;
    document.getElementById('ds-clear').onclick = clearSession;
    document.getElementById('ds-verify').onclick = openEditor;
  }

  // ---------- customer autocomplete (reuses the engineering client master) ----------
  function drawCustDD() {
    const dd = document.getElementById('ds-cust-dd'), inp = document.getElementById('ds-cust'); if (!dd || !inp) return;
    const q = (inp.value || '').trim().toLowerCase();
    const list = (clientsCache || []).filter(c => !q || (c.company_name || '').toLowerCase().includes(q) || (c.client_name || '').toLowerCase().includes(q)).slice(0, 8);
    dd.innerHTML = list.map(c => `<button class="inv-cust-row" data-cn="${esc(c.company_name || c.client_name || '')}"><b>${esc(c.company_name || c.client_name || '')}</b>${c.city || c.gstin ? `<span>${esc([c.gstin, c.city].filter(Boolean).join(' · '))}</span>` : ''}</button>`).join('');
    dd.hidden = !list.length;
    dd.querySelectorAll('[data-cn]').forEach(b => b.onclick = () => { model.customer = b.dataset.cn; inp.value = b.dataset.cn; dd.hidden = true; });
  }
  function attachCustomerPicker() {
    const inp = document.getElementById('ds-cust'), dd = document.getElementById('ds-cust-dd'); if (!inp) return;
    inp.onfocus = () => { if (!clientsCache.length) loadClients().then(drawCustDD); else drawCustDD(); };
    inp.onblur = () => setTimeout(() => { if (dd) dd.hidden = true; }, 180);
  }

  // ---------- save / records ----------
  function saveSheet(silent) {
    if (!model.customer && !model.projectName) { if (!silent) toast('Add a customer or project name first'); return false; }
    const list = loadSaved().filter(r => r.id !== model.id);
    list.unshift({ id: model.id, product: tmplOf(model).label, customer: model.customer, project: model.projectName, savedAt: new Date().toLocaleString('en-IN'), model: JSON.parse(JSON.stringify(model)) });
    storeSaved(list); if (!silent) toast('Data sheet saved'); return true;
  }
  function openRecords() {
    const m = modal(`<div class="inv-ed-head"><h3>Data sheet records</h3><button class="cp-btn" data-x>Close</button></div>
      <input class="inv-in" id="ds-rec-s" placeholder="Search customer / project / product…" style="margin:4px 0 10px">
      <div class="modal-body" id="ds-rec-list"></div>`, 'big');
    m.querySelector('[data-x]').onclick = () => m.remove();
    const draw = () => {
      const q = (m.querySelector('#ds-rec-s').value || '').toLowerCase();
      const list = loadSaved().filter(r => !q || (r.customer + ' ' + r.project + ' ' + r.product).toLowerCase().includes(q));
      m.querySelector('#ds-rec-list').innerHTML = list.length ? list.map(r => `<div class="inv-rec-row">
        <div class="inv-rec-main"><b>${esc(r.customer || r.project || 'Data sheet')}</b> <span class="inv-chip st-draft">${esc(r.product)}</span><span class="inv-rec-sub">${esc(r.project || '')}${r.project ? ' · ' : ''}${esc(r.savedAt)}</span></div>
        <div class="inv-rec-act"><button class="cp-btn so-open" data-open="${r.id}">Open</button><button class="so-del" data-del="${r.id}">×</button></div></div>`).join('') : '<div class="so-empty">No saved data sheets.</div>';
      m.querySelectorAll('[data-open]').forEach(b => b.onclick = () => { const r = loadSaved().find(x => x.id === b.dataset.open); if (r) { persistSessions(); sessions[activeIdx] = JSON.parse(JSON.stringify(r.model)); model = sessions[activeIdx]; persistSessions(); m.remove(); render(); toast('Reopened'); } });
      m.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { storeSaved(loadSaved().filter(x => x.id !== b.dataset.del)); draw(); });
    };
    m.querySelector('#ds-rec-s').oninput = draw; draw();
  }

  // ---------- the printable Technical Data Sheet (editable) ----------
  function roundStamp() {
    return `<svg class="ds-stamp" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg"><defs><path id="sc" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0"/></defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="#1a3a8f" stroke-width="2"/><circle cx="60" cy="60" r="44" fill="none" stroke="#1a3a8f" stroke-width="1"/>
      <text font-size="9.5" font-weight="bold" fill="#1a3a8f" letter-spacing="1.5"><textPath href="#sc" startOffset="2%">FIXOTECH ENGINEERING SYSTEMS PVT. LTD.</textPath></text>
      <text x="60" y="58" text-anchor="middle" font-size="12" font-weight="bold" fill="#1a3a8f">FIXOTECH</text>
      <text x="60" y="72" text-anchor="middle" font-size="7.5" fill="#1a3a8f">Authorised</text></svg>`;
  }
  function stampBlock() {
    const s = stampData();
    return s ? `<img src="${s}" class="ds-stamp-img" alt="Authorised stamp">` : roundStamp();
  }
  function dataSheetHtml(m, editable) {
    const tmpl = tmplOf(m);
    const rows = tmpl.fields.map(f => `<tr class="ds-irow"><td class="ds-k">${esc(f.label)}</td><td class="ds-c">:</td><td class="ds-v">${esc(m.values[f.key] == null ? '' : m.values[f.key])}</td></tr>`).join('');
    const ed = editable ? ' contenteditable="true" spellcheck="false"' : '';
    const clientLine = (m.customer || m.projectName || m.location)
      ? `<div class="ds-client-line">${m.customer ? '<b>Customer:</b> ' + esc(m.customer) : ''}${m.projectName ? ' &nbsp; <b>Project:</b> ' + esc(m.projectName) : ''}${m.location ? ' &nbsp; <b>Location:</b> ' + esc(m.location) : ''}</div>` : '';
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Technical Data Sheet — ${esc(tmpl.label)}</title><style>
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}@page{size:A4;margin:10mm}
body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12.5px;margin:0;padding:8mm}
.doc{border:2px solid #000;padding:12px 18px 16px;position:relative}
.wm{position:absolute;top:55%;left:50%;width:58%;transform:translate(-50%,-50%);opacity:.06;pointer-events:none;z-index:0}
.layer{position:relative;z-index:1}
.hdr{width:100%;display:block;border-bottom:1.5px solid #000;padding-bottom:8px}
.hdr img{width:100%;max-height:86px;object-fit:contain;display:block}
.hdrfallback{font-size:22px;font-weight:800;text-align:center}.hdrfallback small{display:block;font-size:11px;font-weight:bold}
.pcat{font-weight:bold;text-decoration:underline;margin:12px 0 2px;font-size:13px}
h1{text-align:center;font-size:20px;text-decoration:underline;margin:2px 0 8px;letter-spacing:.5px}
.ds-client-line{font-size:11px;margin:0 0 8px;color:#222}
table.spec{width:100%;border-collapse:collapse}
table.spec td{padding:6px 6px;vertical-align:top;font-size:12.5px}
.ds-k{width:33%;color:#111}.ds-c{width:4%;text-align:center}.ds-v{width:63%;font-weight:600}
.ds-irow:first-child .ds-v{font-weight:800}
.signblock{margin-top:22px}.ds-stamp{width:92px;height:92px;display:block}
.ds-stamp-img{height:84px;display:block;object-fit:contain}
.foot{margin-top:6px}.foot .b{font-weight:600}
${editable ? '.layer[contenteditable] td:hover{background:rgba(59,130,246,.08)}' : ''}
</style></head><body><div class="doc">
  <img src="${WM}" class="wm" onerror="this.style.display='none'">
  <div class="layer"${ed}>
  <div class="hdr"><img src="${HEADER}" onerror="this.outerHTML='<div class=&quot;hdrfallback&quot;>FIXOTECH<small>ENGINEERING SYSTEMS PVT. LTD. &nbsp;·&nbsp; ISO 9001:2015 CERTIFIED COMPANY</small></div>'"></div>
  <div class="pcat">${esc(tmpl.label)}</div>
  <h1>Technical Data Sheet</h1>
  ${clientLine}
  <table class="spec"><tr class="ds-irow"><td class="ds-k">Product</td><td class="ds-c">:</td><td class="ds-v">${esc(m.productName)}</td></tr>${rows}</table>
  <div class="signblock">
    <div class="stampwrap">${stampBlock()}</div>
    <div class="foot"><div>Bangalore</div><div class="b">Date : - ${esc(m.date)}</div></div>
  </div>
  </div>
</div></body></html>`;
  }

  function openEditor() {
    const m = modal(`<div class="inv-ed-head"><h3>Verify &amp; Edit — Data Sheet</h3><span class="inv-ed-hint">✎ Click any value to edit before printing.</span><button class="cp-btn" data-x>Close</button></div>
      <iframe id="ds-frame" class="inv-frame"></iframe>
      <div class="inv-modal-act"><button class="cp-btn btn-save-edit" data-save>💾 Save changes</button><button class="cp-btn cp-btn-go" data-print>🖨 Print / Save PDF</button></div>`, 'big');
    const fr = m.querySelector('#ds-frame');
    const draw = () => { const d = fr.contentDocument || fr.contentWindow.document; d.open(); d.write(dataSheetHtml(model, true)); d.close(); };
    draw();
    const commit = () => {
      try {
        const d = fr.contentDocument || fr.contentWindow.document;
        const grab = (el) => (el ? (el.innerText != null ? el.innerText : el.textContent) : '').replace(/ /g, ' ').trim();
        const irows = [...d.querySelectorAll('table.spec tr.ds-irow')];
        if (irows.length) { model.productName = grab(irows[0].querySelector('.ds-v')) || model.productName; tmplOf(model).fields.forEach((f, i) => { const tr = irows[i + 1]; if (tr) model.values[f.key] = grab(tr.querySelector('.ds-v')); }); }
        persistSessions(); if (loadSaved().some(r => r.id === model.id)) saveSheet(true); render();
      } catch (e) {}
    };
    m.querySelector('[data-x]').onclick = () => { commit(); m.remove(); };
    m.querySelector('[data-save]').onclick = () => { commit(); draw(); toast('Changes saved'); };
    m.querySelector('[data-print]').onclick = () => { commit(); draw(); try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (e) {} };
  }

  function modal(inner, cls) { const el = document.createElement('div'); el.className = 'inv-overlay'; el.innerHTML = `<div class="inv-modal ${cls || ''}">${inner}</div>`; document.body.appendChild(el); el.addEventListener('click', e => { if (e.target === el) el.remove(); }); return el; }

  loadSessions();
  setInterval(() => { if (sessions.length) persistSessions(); }, 1500);
  window.addEventListener('beforeunload', () => { if (sessions.length) persistSessions(); });
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[data-open-app="screen-datasheet"]').forEach(b => b.addEventListener('click', () => { loadClients(); setTimeout(render, 0); }));
    if (localStorage.getItem('fixo_screen') === 'screen-datasheet') { loadClients(); render(); }
  });
  window.FIXO_DATASHEET = { render };
})();
