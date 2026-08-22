// ============================================================
// Product image resolver.
// Maps a product name/description to a picture so the quotation and the
// Indent (Production Work Order) can show what each line item actually is —
// this helps the factory floor understand the product at a glance.
//
// HOW TO ADD IMAGES (once the product photo folder is ready):
//   1. Put the image files in:  assets/products/
//   2. Name them with the slugs used in MAP below (e.g. ladder-cable-tray.png),
//      OR add/adjust a keyword→file entry in MAP.
//   3. Supported extensions are tried in order: .png .jpg .jpeg .webp
// If no image exists for a product, nothing is shown (no broken image icon).
//
// A single image can serve several variants: if only one "reducer" image
// exists, every reducer type falls back to it. More specific keywords win.
// ============================================================
(function () {
  const BASE = 'assets/products/';
  const EXTS = ['png', 'jpg', 'jpeg', 'webp'];

  // Ordered most-specific → most-generic. First keyword found in the product
  // text wins. `file` is the base filename (no extension).
  // NOTE: most-specific first. For a product string we return the FIRST entry
  // whose keyword appears in it, so perforated/ladder variants must precede the
  // generic ones. Every `file` has a real image in assets/products/.
  const MAP = [
    // --- Horizontal bends ---
    { kw: ['perforated horizontal bend'], file: 'perforated-horizontal-bend' },
    { kw: ['ladder horizontal bend'], file: 'ladder-horizontal-bend' },
    { kw: ['horizontal bend', 'horizontal elbow'], file: 'horizontal-bend' },
    // --- Vertical bends ---
    { kw: ['perforated vertical bend'], file: 'perforated-vertical-bend' },
    { kw: ['ladder vertical bend'], file: 'ladder-vertical-bend' },
    { kw: ['vertical bend', 'vertical elbow'], file: 'vertical-bend' },
    // --- Cross bends ---
    { kw: ['perforated cross bend', 'perforated cross'], file: 'perforated-cross-bend' },
    { kw: ['ladder cross bend', 'ladder cross'], file: 'ladder-cross-bend' },
    { kw: ['cross bend', 'cross'], file: 'cross-bend' },
    // --- Tee bends ---
    { kw: ['perforated tee bend', 'perforated tee'], file: 'perforated-tee-bend' },
    { kw: ['ladder tee bend', 'ladder tee'], file: 'ladder-tee-bend' },
    { kw: ['tee bend', 'equal tee', 'tee'], file: 'tee-bend' },
    // --- Reducers ---
    { kw: ['ladder reducer'], file: 'ladder-reducer' },
    { kw: ['reducer'], file: 'reducer' },   // perforated reducer falls back here
    // --- Junction box ---
    { kw: ['junction box', 'junction'], file: 'junction-box' },
    // --- Raceways ---
    { kw: ['ceiling raceway', 'ceiling'], file: 'raceway-ceiling' },
    { kw: ['floor raceway', 'floor'], file: 'raceway-floor' },
    { kw: ['raceway', 'trunking', 'wire way', 'wireway'], file: 'raceway-ceiling' },
    // --- Cable trays (generic last so bends/reducers win) ---
    { kw: ['perforated cable tray', 'perforated tray', 'perforated'], file: 'perforated-cable-tray' },
    { kw: ['ladder cable tray', 'ladder tray', 'ladder'], file: 'ladder-cable-tray' },
  ];

  function norm(s) { return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim(); }

  // ---------------------------------------------------------------
  // User replacements.
  // One store, keyed by product slug, shared by EVERY document (quotation,
  // Indent, …) and persisted. So replacing a picture in the quotation shows up
  // in the Indent, and a replacement made later in the Indent shows up if you
  // reprint the quotation — it always flows both ways, at any stage.
  // ---------------------------------------------------------------
  const LS_KEY = 'fixo_product_img_overrides';
  let overrides = {};
  try { overrides = JSON.parse(localStorage.getItem(LS_KEY) || '{}') || {}; } catch (e) { overrides = {}; }

  const listeners = [];
  function onChange(fn) { listeners.push(fn); }
  function emit(slug) { listeners.forEach(fn => { try { fn(slug, overrides[slug] || ''); } catch (e) {} }); }

  function setOverride(slug, dataUrl) {
    if (!slug) return;
    overrides[slug] = dataUrl;
    persist();
    emit(slug);
  }
  function clearOverride(slug) {
    if (!slug) return;
    delete overrides[slug];
    persist();
    emit(slug);
  }
  function persist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(overrides)); }
    catch (e) {
      // Quota exceeded — keep working in-memory rather than losing the picture.
      console.warn('Product image overrides could not be saved (storage full).');
    }
  }
  function getOverride(slug) { return overrides[slug] || ''; }

  // Stable slug for any product string: the matched catalogue slug, or a
  // "custom-…" slug derived from the description for brand-new products that
  // have no picture in the folder yet.
  function slugFor(text) {
    const t = norm(text);
    if (!t) return '';
    for (const m of MAP) {
      if (m.kw.some(k => t.indexOf(k) !== -1)) return m.file;
    }
    return 'custom-' + t.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  }

  // Does this product have a picture shipped in the folder?
  function catalogueUrl(text) {
    const t = norm(text);
    if (!t) return '';
    for (const m of MAP) {
      if (m.kw.some(k => t.indexOf(k) !== -1)) return BASE + m.file + '.' + EXTS[0];
    }
    return '';
  }

  // Embedded base64 for each catalogue slug (from product-images-data.js).
  // Preferred over the file path so pictures embed in Excel and work from
  // file:// (where fetch() and canvas toDataURL are blocked).
  function embedded(slug) {
    return (window.FIXO_PRODUCT_IMG_DATA && slug && window.FIXO_PRODUCT_IMG_DATA[slug]) || '';
  }

  // The URL to actually display: a user replacement always wins, then the
  // embedded base64, then the raw file path as a last resort.
  function guessUrl(text) {
    const slug = slugFor(text);
    if (!slug) return '';
    return getOverride(slug) || embedded(slug) || catalogueUrl(text);
  }
  function urlForSlug(slug) {
    if (!slug) return '';
    return getOverride(slug) || embedded(slug) || (slug.indexOf('custom-') !== 0 ? BASE + slug + '.' + EXTS[0] : '');
  }

  // ---------------------------------------------------------------
  // Markup helper — an image slot that can be clicked to replace.
  // Empty slots (new product, no picture) render as an "+ Add image" button.
  // ---------------------------------------------------------------
  function slotHtml(text, cls) {
    const slug = slugFor(text);
    const url = guessUrl(text);
    if (!slug) return '';
    return url
      ? `<span class="fx-imgslot" data-slug="${slug}" contenteditable="false" title="Click to replace this picture"><img class="${cls || 'fx-thumb'}" src="${url}"><span class="fx-imgbadge">Replace</span></span>`
      : `<span class="fx-imgslot fx-empty" data-slug="${slug}" contenteditable="false" title="Click to add a picture for this product">+ Img</span>`;
  }

  // ---------------------------------------------------------------
  // Pick a file and downscale it (keeps localStorage small enough to persist).
  // ---------------------------------------------------------------
  let picker = null;
  function pickImage() {
    return new Promise(resolve => {
      if (!picker) {
        picker = document.createElement('input');
        picker.type = 'file'; picker.accept = 'image/*'; picker.hidden = true;
        document.body.appendChild(picker);
      }
      picker.value = '';
      picker.onchange = () => {
        const f = picker.files[0];
        if (!f) return resolve('');
        const r = new FileReader();
        r.onload = () => downscale(r.result).then(resolve);
        r.onerror = () => resolve('');
        r.readAsDataURL(f);
      };
      picker.click();
    });
  }
  function downscale(dataUrl, max) {
    max = max || 700;
    return new Promise(res => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w <= max && h <= max) return res(dataUrl);
        const s = Math.min(max / w, max / h);
        const c = document.createElement('canvas');
        c.width = Math.round(w * s); c.height = Math.round(h * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => res(dataUrl);
      img.src = dataUrl;
    });
  }

  const SLOT_CSS = `
.fx-imgslot{position:relative;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;vertical-align:middle}
.fx-imgslot img{display:block}
.fx-imgslot .fx-imgbadge{position:absolute;left:0;right:0;bottom:0;background:rgba(23,37,84,.86);color:#fff;font-size:7px;font-weight:700;letter-spacing:.3px;text-align:center;padding:1px 0;opacity:0;transition:opacity .12s;pointer-events:none;text-transform:uppercase}
.fx-imgslot:hover{outline:2px solid #2563eb;outline-offset:1px}
.fx-imgslot:hover .fx-imgbadge{opacity:1}
.fx-imgslot.fx-empty{border:1px dashed #94a3b8;color:#64748b;font-size:7.5px;font-weight:700;padding:0 4px;min-width:26px;height:26px;border-radius:3px;background:#f8fafc}
.fx-imgslot.fx-empty:hover{border-color:#2563eb;color:#2563eb;background:#eff6ff}
@media print{.fx-imgslot .fx-imgbadge{display:none}.fx-imgslot:hover{outline:none}.fx-imgslot.fx-empty{display:none}}
`;

  // ---------------------------------------------------------------
  // Wire click-to-replace inside a document (works for editor iframes).
  // After a replacement, every slot with that slug — in this document and in
  // any other view — updates immediately.
  // ---------------------------------------------------------------
  function attachReplaceUI(doc, opts) {
    opts = opts || {};
    if (!doc) return;
    if (!doc.getElementById('fx-slot-css')) {
      const st = doc.createElement('style');
      st.id = 'fx-slot-css'; st.textContent = SLOT_CSS;
      (doc.head || doc.documentElement).appendChild(st);
    }
    const refresh = (slug) => {
      doc.querySelectorAll('.fx-imgslot[data-slug="' + (window.CSS && CSS.escape ? CSS.escape(slug) : slug) + '"]').forEach(slot => {
        const url = urlForSlug(slug);
        if (!url) return;
        let im = slot.querySelector('img');
        if (!im) {
          slot.classList.remove('fx-empty');
          slot.textContent = '';
          im = doc.createElement('img');
          im.className = opts.imgClass || 'fx-thumb';
          slot.appendChild(im);
          const b = doc.createElement('span');
          b.className = 'fx-imgbadge'; b.textContent = 'Replace';
          slot.appendChild(b);
        }
        im.src = url;
      });
    };
    doc.addEventListener('click', async (e) => {
      const slot = e.target.closest && e.target.closest('.fx-imgslot');
      if (!slot) return;
      e.preventDefault(); e.stopPropagation();
      const slug = slot.dataset.slug;
      const url = await pickImage();
      if (!url) return;
      setOverride(slug, url);      // persists + notifies every other view
      refresh(slug);
      if (opts.onReplaced) opts.onReplaced(slug, url);
    }, true);
    // Keep this document in sync if the picture is changed from another screen.
    onChange((slug) => refresh(slug));
  }

  window.FIXO_PRODUCT_IMG = {
    guessUrl, slugFor, catalogueUrl, urlForSlug, slotHtml,
    setOverride, getOverride, clearOverride, onChange,
    pickImage, attachReplaceUI, SLOT_CSS
  };
})();
