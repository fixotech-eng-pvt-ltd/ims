// ============================================================
// Fixotech ChatIQ — a ChatGPT-style assistant whose knowledge base is the
// platform's own order database. Marketing/sales can ask, in plain English,
// about previous rates, a client's past orders, price differences, monthly
// orders, etc. Also handles basic small-talk.
//   Sidebar: "Question asking" (live) + "Automate me" (placeholder).
// Rule-based engine over FixoDB (clients + orders) — no external API.
// ============================================================
(function () {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

  let dataset = null;   // [{client, orders:[...]}]
  let messages = [];    // {role, html} — current conversation
  let chats = [];       // [{id, title, messages, ts}] — saved conversations
  let attached = null;  // {name, kind, text} — a file the user attached for analysis
  let kb = {};          // taught facts (learns): { "gi rate": "82", ... }
  try { kb = JSON.parse(localStorage.getItem('fixo_chatiq_kb') || '{}') || {}; } catch (e) {}
  function saveKb() { try { localStorage.setItem('fixo_chatiq_kb', JSON.stringify(kb)); } catch (e) {} }
  const MSGS_LS = 'fixo_chatiq_current', CHATS_LS = 'fixo_chatiq_chats';
  try { messages = JSON.parse(localStorage.getItem(MSGS_LS) || '[]') || []; } catch (e) {}
  try { chats = JSON.parse(localStorage.getItem(CHATS_LS) || '[]') || []; } catch (e) {}
  function persist() { try { localStorage.setItem(MSGS_LS, JSON.stringify(messages)); localStorage.setItem(CHATS_LS, JSON.stringify(chats)); } catch (e) {} }
  function archiveChat() {
    const firstUser = messages.find(m => m.role === 'user');
    if (!firstUser) return;
    const title = firstUser.html.replace(/<[^>]+>/g, '').slice(0, 40);
    chats.unshift({ id: 'c' + Date.now(), title, messages: messages.slice(), ts: Date.now() });
    chats = chats.slice(0, 30);
  }

  async function loadData() {
    if (dataset) return dataset;
    dataset = [];
    try {
      const DB = window.FixoDB; if (!DB) return dataset;
      const clients = await DB.listClients();
      for (const c of clients) {
        let orders = [];
        try { orders = await DB.listOrders(c.id); } catch (e) {}
        dataset.push({ client: c, orders: orders || [] });
      }
    } catch (e) { console.warn('ChatIQ data load failed', e); }
    return dataset;
  }

  // ---------------- UI ----------------
  function render() {
    const host = document.getElementById('chatiq-app'); if (!host) return;
    if (host.dataset.built) { renderMessages(); return; }
    host.dataset.built = '1';
    host.innerHTML = `
      <div class="ciq">
        <aside class="ciq-side">
          <div class="ciq-side-top">
            <button class="ciq-back" data-goto="screen-home" title="Back to apps">←</button>
            <span class="ciq-brand">Fixotech <b>ChatIQ</b></span>
          </div>
          <button class="ciq-new" id="ciq-new">✎ New chat</button>
          <div class="ciq-nav">
            <button class="ciq-nav-item active" data-mode="ask"><span>💬</span> Question asking</button>
            <button class="ciq-nav-item locked" data-mode="automate"><span>⚡</span> Automate me <em>soon</em></button>
          </div>
          <div class="ciq-side-lab">Recent chats</div>
          <div class="ciq-examples" id="ciq-chats"></div>
          <div class="ciq-side-lab">Try asking</div>
          <div class="ciq-examples">
            <button class="ciq-eg">Rate I gave for perforated cable tray</button>
            <button class="ciq-eg">What is the best price I can give for ladder tray?</button>
            <button class="ciq-eg">Which is the best order I've given?</button>
            <button class="ciq-eg">Have I given a rate of 450 before?</button>
          </div>
        </aside>
        <main class="ciq-main">
          <div class="ciq-top"><span class="ciq-model">Fixotech ChatIQ</span></div>
          <div class="ciq-scroll" id="ciq-scroll"></div>
          <div class="ciq-composer">
            <div class="ciq-attach-chip" id="ciq-attach-chip" hidden></div>
            <div class="ciq-inputwrap">
              <button id="ciq-attach" title="Attach a file to analyze (Excel, CSV, PDF)">＋</button>
              <input type="file" id="ciq-file" accept=".xlsx,.xls,.csv,.txt,.pdf,image/*" hidden>
              <textarea id="ciq-input" rows="1" placeholder="Ask about rates, clients, past orders…"></textarea>
              <button id="ciq-send" title="Send">➤</button>
            </div>
            <div class="ciq-foot">ChatIQ answers from your order database. Check important figures before quoting.</div>
          </div>
        </main>
      </div>`;
    const input = host.querySelector('#ciq-input');
    const send = () => { const v = input.value.trim(); if (!v) return; input.value = ''; input.style.height = 'auto'; ask(v); };
    host.querySelector('#ciq-send').onclick = send;
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
    input.addEventListener('input', () => { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; });
    host.querySelector('#ciq-new').onclick = () => { if (messages.length) archiveChat(); messages = []; attached = null; persist(); renderMessages(); renderChatList(); updateAttachChip(); input.focus(); };
    host.querySelectorAll('.ciq-eg').forEach(b => b.onclick = () => ask(b.textContent));
    // Attach a file to analyze
    const fileInp = host.querySelector('#ciq-file');
    host.querySelector('#ciq-attach').onclick = () => fileInp.click();
    fileInp.onchange = () => { const f = fileInp.files[0]; if (f) ingestFile(f); fileInp.value = ''; };
    renderChatList(); updateAttachChip();
    host.querySelectorAll('.ciq-nav-item').forEach(b => b.onclick = () => {
      if (b.dataset.mode === 'automate') { pushBot("<b>Automate me</b> is coming soon — it'll let you set up automatic reports and follow-ups. For now, use <b>Question asking</b>."); return; }
    });
    host.querySelector('.ciq-back').onclick = () => window.showScreen && showScreen('screen-home');
    renderMessages();
    loadData();
  }

  function renderMessages() {
    const s = document.getElementById('ciq-scroll'); if (!s) return;
    if (!messages.length) {
      s.innerHTML = `<div class="ciq-empty"><h1>What can I help with?</h1>
        <div class="ciq-empty-egs">
          <button class="ciq-eg2" data-q="Show me the last order of every client">📋 Recent orders</button>
          <button class="ciq-eg2" data-q="Rate I gave for perforated cable tray">🏷️ Past rates</button>
          <button class="ciq-eg2" data-q="Orders this month">📆 This month</button>
          <button class="ciq-eg2" data-q="Which client ordered the most?">🏆 Top client</button>
        </div></div>`;
      s.querySelectorAll('.ciq-eg2').forEach(b => b.onclick = () => ask(b.dataset.q));
      return;
    }
    s.innerHTML = messages.map(m => `<div class="ciq-msg ${m.role}"><div class="ciq-avatar">${m.role === 'user' ? '🙂' : '<b>IQ</b>'}</div><div class="ciq-bubble">${m.html}</div></div>`).join('');
    s.scrollTop = s.scrollHeight;
  }
  function pushUser(t) { messages.push({ role: 'user', html: esc(t) }); persist(); renderMessages(); renderChatList(); }
  function pushBot(html) { messages.push({ role: 'bot', html }); persist(); renderMessages(); }
  function renderChatList() {
    const el = document.getElementById('ciq-chats'); if (!el) return;
    el.innerHTML = chats.length ? chats.map(c => `<button class="ciq-eg" data-chat="${c.id}" title="${esc(c.title)}">${esc(c.title)}</button>`).join('') : '<div class="ciq-side-empty2">No saved chats yet</div>';
    el.querySelectorAll('[data-chat]').forEach(b => b.onclick = () => {
      const c = chats.find(x => x.id === b.dataset.chat); if (!c) return;
      if (messages.length) archiveChat();
      messages = c.messages.slice(); chats = chats.filter(x => x.id !== c.id); persist(); renderMessages(); renderChatList();
    });
  }

  async function ask(q) {
    pushUser(q);
    pushBot('<span class="ciq-typing"><i></i><i></i><i></i></span>');
    await loadData();
    const html = answer(q);
    messages.pop();                 // remove typing indicator
    pushBot(html);
  }

  // ---------------- File attach + analysis ----------------
  function updateAttachChip() {
    const c = document.getElementById('ciq-attach-chip'); if (!c) return;
    if (attached) { c.hidden = false; c.innerHTML = `📎 <b>${esc(attached.name)}</b> <span class="ciq-x" id="ciq-attach-x">✕</span>`; const x = c.querySelector('#ciq-attach-x'); if (x) x.onclick = () => { attached = null; updateAttachChip(); }; }
    else { c.hidden = true; c.innerHTML = ''; }
  }
  async function ingestFile(f) {
    const name = f.name, ext = (name.split('.').pop() || '').toLowerCase();
    const isImg = /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|bmp)$/i.test(name);
    pushBot(`<span class="ciq-typing"><i></i><i></i><i></i></span>`);
    let text = '', imgUrl = '';
    try {
      if (isImg) { imgUrl = await new Promise((rs) => { const r = new FileReader(); r.onload = () => rs(r.result); r.onerror = () => rs(''); r.readAsDataURL(f); }); }
      else if (ext === 'csv' || ext === 'txt') { text = await f.text(); }
      else if (ext === 'xlsx' || ext === 'xls') { text = await readXlsx(f); }
      else if (ext === 'pdf') { text = await readPdf(f); }
    } catch (e) { text = ''; }
    attached = { name, kind: isImg ? 'image' : ext, text: (text || '').slice(0, 20000), img: imgUrl };
    messages.pop(); // typing
    updateAttachChip();
    if (isImg) {
      // Try to recognise the product from the file name against the catalogue.
      const guessSlug = (window.FIXO_PRODUCT_IMG && FIXO_PRODUCT_IMG.slugFor) ? FIXO_PRODUCT_IMG.slugFor(name.replace(/\.[a-z0-9]+$/i, '').replace(/[-_]/g, ' ')) : '';
      const pretty = guessSlug && guessSlug.indexOf('custom-') !== 0 ? guessSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';
      pushBot(`${imgUrl ? `<div class="ciq-order"><img src="${imgUrl}" style="max-width:220px;border-radius:8px"></div>` : ''}Attached the photo <b>${esc(name)}</b> ✓.${pretty ? ` From the file name this looks like a <b>${esc(pretty)}</b> — its recent order rates I can pull if you ask “rate for ${esc(pretty.toLowerCase())}”.` : ` I can't read a photo visually yet, so tell me what it is (e.g. “this is a perforated tray”) and I'll remember it and pull its rates & past orders.`}`);
    } else if (!attached.text) pushBot(`I attached <b>${esc(name)}</b> but couldn't read its contents. Try a CSV, Excel, PDF or image.`);
    else pushBot(`Attached <b>${esc(name)}</b> ✓ — ${attached.text.split(/\r?\n/).length} line(s) read. Ask me to <i>summarize it</i>, find the <i>total</i>, or ask any question about it.`);
  }
  async function readXlsx(f) {
    if (typeof ExcelJS === 'undefined') return '';
    const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await f.arrayBuffer());
    let out = [];
    wb.eachSheet(ws => { out.push('# ' + ws.name); ws.eachRow(r => { out.push((r.values || []).slice(1).map(v => v == null ? '' : (v.text || v.result || v)).join('\t')); }); });
    return out.join('\n');
  }
  async function readPdf(f) {
    const lib = window.pdfjsLib || window['pdfjs-dist/build/pdf']; if (!lib) return '';
    const doc = await lib.getDocument({ data: await f.arrayBuffer() }).promise;
    let out = [];
    for (let p = 1; p <= Math.min(doc.numPages, 15); p++) { const pg = await doc.getPage(p); const tc = await pg.getTextContent(); out.push(tc.items.map(i => i.str).join(' ')); }
    return out.join('\n');
  }
  function analyzeAttachment(q) {
    const t = attached.text, n = norm(q);
    const lines = t.split(/\r?\n/).filter(x => x.trim());
    const nums = (t.match(/[\d,]+\.?\d*/g) || []).map(x => +x.replace(/,/g, '')).filter(x => !isNaN(x) && x > 0);
    if (/total|sum|add up/.test(n) && nums.length) { const s = nums.reduce((a, b) => a + b, 0); return `From <b>${esc(attached.name)}</b>, I found ${nums.length} numbers; their sum is <b>${money(s)}</b> (verify against the actual total column).`; }
    if (/how many (rows|lines|items)|count/.test(n)) return `<b>${esc(attached.name)}</b> has <b>${lines.length}</b> non-empty line(s).`;
    // default: summary
    return `Summary of <b>${esc(attached.name)}</b> — ${lines.length} line(s):<div class="ciq-order"><pre style="white-space:pre-wrap;margin:0;font-size:12px">${esc(lines.slice(0, 25).join('\n'))}${lines.length > 25 ? '\n…' : ''}</pre></div>Ask me for the total, a specific value, or to find something in it.`;
  }

  // ---------------- Query engine ----------------
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  function allOrders() { const o = []; dataset.forEach(d => d.orders.forEach(od => o.push({ o: od, client: d.client }))); return o; }
  function findClient(q) {
    const n = norm(q); let best = null, bestLen = 0;
    dataset.forEach(d => {
      const name = norm(d.client.company_name || d.client.client_name || '');
      if (!name) return;
      // match full name, or a distinctive first word (>3 chars)
      const first = name.split(' ')[0];
      if (n.includes(name) && name.length > bestLen) { best = d; bestLen = name.length; }
      else if (first.length > 3 && n.includes(first) && first.length > bestLen) { best = d; bestLen = first.length; }
    });
    return best;
  }
  const PRODUCT_WORDS = ['perforated cable tray', 'perforated tray', 'ladder cable tray', 'ladder tray', 'raceway', 'reducer', 'horizontal bend', 'vertical bend', 'cross bend', 'tee bend', 'bend', 'cover', 'channel', 'clamp', 'connector', 'threaded rod', 'perforated', 'ladder', 'cable tray', 'tray'];
  function findProduct(q) { const n = norm(q); return PRODUCT_WORDS.find(p => n.includes(norm(p))) || null; }
  // A description matches a product query if it contains the whole phrase OR
  // every significant word of it (so "perforated tray" finds "GI Perforated Cable Tray").
  function descMatches(desc, product) {
    const d = norm(desc), p = norm(product);
    if (!p) return false;
    if (d.includes(p)) return true;
    const words = String(product).toLowerCase().split(/\s+/).filter(w => w.length > 2 && !/^(the|and|type|with|cable)$/.test(w));
    return words.length > 0 && words.every(w => d.includes(w.replace(/[^a-z0-9]/g, '')));
  }
  function productRates(product) {
    if (!product || !dataset) return '';
    const hits = [];
    dataset.forEach(d => d.orders.forEach(o => (o.items || []).forEach(it => { if (descMatches(it.desc, product) && +it.rate) hits.push({ rate: +it.rate, date: o.order_date }); })));
    if (!hits.length) return '';
    hits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const lo = Math.min.apply(0, hits.map(h => h.rate)), hi = Math.max.apply(0, hits.map(h => h.rate));
    return `Recent quoted rate: <b>${money(hits[0].rate)}</b> (range ${money(lo)}–${money(hi)} across ${hits.length} order line(s)).`;
  }
  function findPeriod(q) {
    const n = norm(q); let mo = null, yr = null;
    MONTHS.forEach((m, i) => { if (n.includes(m) || n.includes(m.slice(0, 3))) mo = i; });
    const my = n.match(/\b(20\d{2})\b/); if (my) yr = my[1];
    if (/this month/.test(n)) { const d = new Date(); mo = d.getMonth(); yr = String(d.getFullYear()); }
    return (mo != null || yr) ? { mo, yr } : null;
  }
  function orderInPeriod(od, p) {
    const d = parseDate(od.order_date); if (!d) return false;
    if (p.mo != null && d.getMonth() !== p.mo) return false;
    if (p.yr && String(d.getFullYear()) !== p.yr) return false;
    return true;
  }
  function parseDate(s) { if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d; }
  function fmtDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : (s || '—'); }

  function orderCard(od, client) {
    const items = (od.items || []).slice(0, 8).map(it => `<tr><td>${esc(it.desc || '')}</td><td class="r">${esc(it.qty || '')} ${esc(it.unit || '')}</td><td class="r">${money(it.rate)}</td><td class="r">${money(it.amount)}</td></tr>`).join('');
    return `<div class="ciq-order"><div class="ciq-order-h">${client ? esc(client.company_name || client.client_name) + ' · ' : ''}${esc(od.quote_no || od.voucher_no || 'Order')} · ${fmtDate(od.order_date)} <b>${money(od.total_cost)}</b></div>
      ${items ? `<table class="ciq-tbl"><tr><th>Item</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Amount</th></tr>${items}</table>` : ''}</div>`;
  }

  function answer(q) {
    const n = norm(q);
    // If a product photo is attached and the user names it, treat that product.
    if (attached && attached.kind === 'image') {
      const told = q.match(/(?:this is|it is|it's|that is)\s+(?:an?\s+)?(.+)/i);
      if (told) { const p = findProduct(told[1]) || told[1].trim(); attached.product = p; const rates = productRates(p); return `Understood — the photo is a <b>${esc(p)}</b>.${rates ? ' ' + rates : ' I don\'t have past orders for it yet.'}`; }
      if (/what|which|identify|recogni|rate|price|order/.test(n) && attached.product) { const r = productRates(attached.product); return `That photo is a <b>${esc(attached.product)}</b>.${r ? ' ' + r : ''}`; }
    }
    // Attached file takes priority when the question is about it
    if (attached && attached.text && /(summar|analy|this file|attach|the excel|the pdf|the sheet|the document|the csv|total|how many rows|list the|what.*in)/.test(n))
      return analyzeAttachment(q);

    // ---- Learn / remember a fact (ChatIQ learns) ----
    const kvSet = q.match(/(?:remember|note|save|set|store)\s+(?:that\s+)?(.+?)\s*(?:is|are|=|:)\s*(.+)/i);
    if (kvSet) { const key = norm(kvSet[1].replace(/\bthe\b/g, '').trim()); kb[key] = kvSet[2].trim().replace(/[.?!]+$/, ''); saveKb(); return `Got it — I'll remember that <b>${esc(kvSet[1].trim())}</b> is <b>${esc(kb[key])}</b>. Ask me anytime.`; }
    if (/what do you know|what have you learned|show.*(notes|memory|what.*learned)|list.*(notes|memory)/.test(n)) {
      const ks = Object.keys(kb);
      return ks.length ? 'Here is what I have learned so far:<ul class="ciq-ul">' + ks.map(k => `<li>${esc(k)} — <b>${esc(kb[k])}</b></li>`).join('') + '</ul>' : "I haven't been taught any custom facts yet. Tell me e.g. “remember that GI rate is 82”.";
    }
    // Direct recall of a taught fact
    const kbKey = Object.keys(kb).find(k => k.length > 2 && n.includes(k));
    if (kbKey && /(what|whats|how much|rate|cost|price|value|tell me)/.test(n)) return `${esc(kbKey.replace(/\b\w/g, c => c.toUpperCase()))} is <b>${esc(kb[kbKey])}</b> <span class="ciq-dim">(you taught me this)</span>.`;

    // ---- Material cost / rate (GI, MS, Stainless Steel, Aluminium, finishes) ----
    const matWord = ['stainless steel', 'aluminium', 'aluminum', 'hot dip', 'hotdip', 'powder coated', 'powder coat', 'gi', 'ms', 'ss'].find(m => n.includes(m));
    if (matWord && /(rate|cost|price|charge|per kg|\brm\b|raw material|how much)/.test(n)) {
      const mk = Object.keys(kb).find(k => k.includes(matWord) && /(rate|cost|price)/.test(k));
      if (mk) return `The <b>${esc(matWord.toUpperCase())}</b> rate is <b>${esc(kb[mk])}</b> <span class="ciq-dim">(you taught me this)</span>.`;
      const rates = [];
      (dataset || []).forEach(d => d.orders.forEach(o => (o.items || []).forEach(it => { if (norm(it.desc).includes(matWord) && +it.rate) rates.push({ rate: +it.rate, date: o.order_date, client: d.client }); })));
      if (rates.length) {
        rates.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
        const lo = Math.min.apply(0, rates.map(r => r.rate)), hi = Math.max.apply(0, rates.map(r => r.rate)), latest = rates[0];
        return `For <b>${esc(matWord.toUpperCase())}</b> items, quoted rates have ranged <b>${money(lo)}–${money(hi)}</b> across ${rates.length} line(s). Most recent: <b>${money(latest.rate)}</b> (${esc((latest.client.company_name || '').split(' ')[0])}, ${fmtDate(latest.date)}).<br><span class="ciq-dim">Want an exact sheet rate used for quoting? Teach me: “remember that ${esc(matWord)} rate is 82”.</span>`;
      }
      return `I don't have recorded <b>${esc(matWord.toUpperCase())}</b> rates in past orders yet. Teach me and I'll use it going forward — e.g. “remember that ${esc(matWord)} rate is 82”.`;
    }

    if (!dataset || !dataset.length) return "I couldn't find any order data yet — but you can still teach me facts (e.g. “remember that GI rate is 82”) or attach a file to analyze.";

    // ---- best / highest-value order ----
    if (/best order|biggest order|largest order|highest order/.test(n)) {
      let best = null; allOrders().forEach(x => { if (!best || (+x.o.total_cost || 0) > (+best.o.total_cost || 0)) best = x; });
      if (best) return `The largest order so far is <b>${money(best.o.total_cost)}</b> — ${esc(best.client.company_name || best.client.client_name)} (${fmtDate(best.o.order_date)}):${orderCard(best.o)}`;
    }
    // ---- best (lowest) price given for a product ----
    if (/best (price|rate)|lowest (price|rate)|minimum (price|rate)|cheapest/.test(n)) {
      const p = findProduct(q);
      if (p) {
        let lo = null; allOrders().forEach(({ o, client }) => (o.items || []).forEach(it => { if (descMatches(it.desc, p) && +it.rate && (!lo || +it.rate < lo.rate)) lo = { rate: +it.rate, date: o.order_date, client }; }));
        if (lo) return `The lowest rate you've given for <b>${esc(p)}</b> is <b>${money(lo.rate)}</b> — to ${esc(lo.client.company_name)} (${fmtDate(lo.date)}). That's the floor you've quoted before; anything lower is a new low.`;
      }
    }
    // ---- have I given this rate before? ----
    const rateAsk = n.match(/(?:given|quoted|used|rate of|price of)\s*(?:a rate of\s*)?(?:rs\.?\s*|₹\s*)?(\d{2,6})/);
    if (rateAsk && /(before|previously|earlier|ever|given|quoted)/.test(n)) {
      const target = +rateAsk[1]; const hits = [];
      allOrders().forEach(({ o, client }) => (o.items || []).forEach(it => { if (Math.round(+it.rate) === target) hits.push({ client, date: o.order_date, desc: it.desc }); }));
      if (hits.length) return `Yes — <b>${money(target)}</b> has been quoted <b>${hits.length}</b> time(s), e.g. ${hits.slice(0, 4).map(h => `${esc((h.client.company_name || '').split(' ')[0])} (${esc(h.desc.slice(0, 30))}, ${fmtDate(h.date)})`).join('; ')}.`;
      return `No — I don't see <b>${money(target)}</b> quoted in any past order.`;
    }

    // ---- friendly, formal small talk ----
    if (/^(hi|hello|hey|yo|hii+|namaste|hola)\b/.test(n) || /good (morning|afternoon|evening)/.test(n))
      return "Hello, and welcome. 👋 I'm Fixotech ChatIQ — happy to help. You can ask me about a client's past orders, material rates, the price you've quoted before, or attach a quotation/photo to review. How may I assist you today?";
    if (/how are you|how's it going|how do you do|hows it going/.test(n)) return "I'm doing well, thank you for asking — ready and at your service. What would you like to look into?";
    if (/thank/.test(n)) return "You're most welcome. I'm glad to help — do let me know if there's anything else.";
    if (/\b(bye|goodbye|see you|talk later|good night)\b/.test(n)) return "Goodbye for now — it was a pleasure assisting you. I'll keep this chat saved for whenever you return. 🙏";
    if (/who are you|what can you do|what are you|help\b/.test(n))
      return "I'm <b>Fixotech ChatIQ</b>, your assistant for the order data. I can help with:<ul class='ciq-ul'><li>A client's past orders — “what did <i>Gopalan Enterprises</i> order last?”</li><li>Material & product rates — “what is the <i>GI</i> rate?”, “rate for <i>ladder tray</i>”</li><li>Comparisons — “price difference for <i>perforated tray</i>”, “best order I've given”</li><li>Reviewing files — attach an <i>Excel / PDF / photo</i> and ask about it</li><li>Learning — tell me “remember that <i>GI rate is 82</i>” and I'll use it</li></ul>How can I help?";
    if (/weather|cricket|news|movie|song/.test(n)) return "That's a little outside what I handle — I'm focused on your Fixotech orders, rates and clients. But I'm always glad to chat. Shall we look at a client, a rate, or a past order?";

    const client = findClient(q), product = findProduct(q), period = findPeriod(q);

    // ---- top client / most orders ----
    if (/most|top client|biggest|highest/.test(n)) {
      let best = null; dataset.forEach(d => { const t = d.orders.reduce((s, o) => s + (+o.total_cost || 0), 0); if (!best || t > best.t) best = { d, t, c: d.orders.length }; });
      if (best && best.t) return `The top client by value is <b>${esc(best.d.client.company_name || best.d.client.client_name)}</b> — ${best.c} order(s) worth <b>${money(best.t)}</b> in total.`;
    }

    // ---- price difference (a product's rate over time, or a client's last two orders) ----
    if (/difference|compare|change in (price|rate)|vary/.test(n)) {
      if (product) {
        const hits = [];
        allOrders().forEach(({ o, client }) => (o.items || []).forEach(it => { if (descMatches(it.desc, product) && +it.rate) hits.push({ rate: +it.rate, date: o.order_date, client }); }));
        hits.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
        if (hits.length >= 2) {
          const a = hits[0], b = hits[hits.length - 1], diff = b.rate - a.rate;
          return `For <b>${esc(product)}</b>, the earliest recorded rate was <b>${money(a.rate)}</b> (${fmtDate(a.date)}) and the latest was <b>${money(b.rate)}</b> (${fmtDate(b.date)}) — a ${diff >= 0 ? 'rise' : 'drop'} of <b>${money(Math.abs(diff))}</b>. Rates seen: ${hits.map(h => money(h.rate)).join(', ')}.`;
        }
        if (hits.length === 1) return `I only have one recorded rate for <b>${esc(product)}</b>: <b>${money(hits[0].rate)}</b> (${fmtDate(hits[0].date)}).`;
      }
      if (client && client.orders.length >= 2) {
        const os = client.orders.slice().sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
        const diff = (+os[0].total_cost || 0) - (+os[1].total_cost || 0);
        return `${esc(client.client.company_name)}'s last order was <b>${money(os[0].total_cost)}</b> (${fmtDate(os[0].order_date)}) vs previous <b>${money(os[1].total_cost)}</b> (${fmtDate(os[1].order_date)}) — a difference of <b>${money(Math.abs(diff))}</b>.`;
      }
    }

    // ---- rate for a product (optionally for a client) ----
    if (product && /(rate|price|cost|charge|how much)/.test(n)) {
      let hits = [];
      allOrders().forEach(({ o, client: c }) => (o.items || []).forEach(it => { if (descMatches(it.desc, product) && +it.rate) hits.push({ rate: +it.rate, date: o.order_date, client: c, desc: it.desc }); }));
      if (client) hits = hits.filter(h => (h.client.company_name || '') === (client.client.company_name || ''));
      hits.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      if (hits.length) {
        const latest = hits[0];
        const list = hits.slice(0, 5).map(h => `${money(h.rate)} <span class="ciq-dim">(${esc((h.client.company_name || '').split(' ')[0])}, ${fmtDate(h.date)})</span>`).join('<br>');
        return `The most recent rate for <b>${esc(product)}</b>${client ? ' to ' + esc(client.client.company_name) : ''} was <b>${money(latest.rate)}</b> (${fmtDate(latest.date)}).<br><br><span class="ciq-dim">Recent rates:</span><br>${list}`;
      }
      return `I don't have a recorded rate for <b>${esc(product)}</b>${client ? ' for ' + esc(client.client.company_name) : ''} yet.`;
    }

    // ---- client contact details (person / phone / GST / address / email) ----
    if (client && /(contact|person|who\s+(contact|deal|spoke|handle)|phone|mobile|number|gst|gstin|email|mail|address|located|where)/.test(n)) {
      const c = client.client, bits = [];
      const wantAll = /(detail|info|about|everything|all)/.test(n);
      if (wantAll || /(contact|person|who)/.test(n)) bits.push('👤 Contact person: <b>' + (c.client_name ? esc(c.client_name) : 'not on record') + '</b>');
      if (wantAll || /(phone|mobile|number|contact)/.test(n)) bits.push('📞 Phone: <b>' + (c.phone ? esc(c.phone) : 'not on record') + '</b>');
      if (wantAll || /(gst|gstin)/.test(n)) bits.push('🧾 GSTIN: <b>' + (c.gstin ? esc(c.gstin) : 'not on record') + '</b>');
      if (wantAll || /(email|mail)/.test(n)) bits.push('✉ Email: <b>' + (c.email ? esc(c.email) : 'not on record') + '</b>');
      if (wantAll || /(address|located|where|state)/.test(n)) {
        if (c.site_address) bits.push('🏢 Business address: ' + esc(c.site_address));
        if (c.delivery_address && c.delivery_address !== c.site_address) bits.push('🚚 Delivery address: ' + esc(c.delivery_address));
        if (c.state) bits.push('📍 State: ' + esc(c.state));
      }
      if (bits.length) return `<b>${esc(c.company_name)}</b><ul class="ciq-ul"><li>${bits.join('</li><li>')}</li></ul>`;
    }

    // ---- a client's orders (last / all / count / total) ----
    if (client) {
      const os = client.orders.slice().sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''));
      if (!os.length) return `${esc(client.client.company_name)} has no recorded orders yet.`;
      if (/how many|number of|count/.test(n)) return `${esc(client.client.company_name)} has <b>${os.length}</b> recorded order(s).`;
      if (/total|value|worth|business/.test(n)) { const t = os.reduce((s, o) => s + (+o.total_cost || 0), 0); return `${esc(client.client.company_name)} has ordered <b>${money(t)}</b> across ${os.length} order(s).`; }
      if (/last|previous|recent|latest/.test(n)) return `Here's the most recent order for <b>${esc(client.client.company_name)}</b>:${orderCard(os[0])}`;
      // default: list a few
      return `<b>${esc(client.client.company_name)}</b> — ${os.length} order(s):${os.slice(0, 4).map(o => orderCard(o)).join('')}`;
    }

    // ---- orders in a period ----
    if (period) {
      const hits = allOrders().filter(x => orderInPeriod(x.o, period));
      const label = (period.mo != null ? MONTHS[period.mo][0].toUpperCase() + MONTHS[period.mo].slice(1) : '') + (period.yr ? ' ' + period.yr : '');
      if (!hits.length) return `No orders found for <b>${esc(label.trim())}</b>.`;
      const total = hits.reduce((s, x) => s + (+x.o.total_cost || 0), 0);
      return `<b>${hits.length}</b> order(s) in <b>${esc(label.trim())}</b>, totalling <b>${money(total)}</b>:${hits.slice(0, 6).map(x => orderCard(x.o, x.client)).join('')}`;
    }

    // ---- "last order of every client" ----
    if (/every client|all client|each client|last order/.test(n)) {
      const rows = dataset.filter(d => d.orders.length).slice(0, 8).map(d => { const o = d.orders.slice().sort((a, b) => (b.order_date || '').localeCompare(a.order_date || ''))[0]; return `<tr><td>${esc(d.client.company_name || d.client.client_name)}</td><td>${fmtDate(o.order_date)}</td><td class="r">${money(o.total_cost)}</td></tr>`; }).join('');
      if (rows) return `Most recent order per client:<table class="ciq-tbl"><tr><th>Client</th><th>Date</th><th class="r">Value</th></tr>${rows}</table>`;
    }

    // ---- product across clients (no rate word) ----
    if (product) {
      const hits = allOrders().filter(x => (x.o.items || []).some(it => norm(it.desc).includes(product)));
      if (hits.length) return `<b>${esc(product)}</b> appears in <b>${hits.length}</b> order(s). Recent ones:${hits.slice(0, 4).map(x => orderCard(x.o, x.client)).join('')}`;
    }

    return `I'd be happy to help — I just need a little more to go on. Try naming a <b>client</b>, a <b>product</b>, a <b>material</b>, or a <b>month</b> — for example “last order of Gopalan Enterprises”, “what is the GI rate?”, or “orders in June 2025”. You can also attach a file or teach me a fact with “remember that …”.`;
  }

  document.addEventListener('DOMContentLoaded', () => {
    // build lazily when the screen is first shown
    document.querySelectorAll('[data-open-app="screen-chatiq"]').forEach(b => b.addEventListener('click', () => setTimeout(render, 0)));
    if (localStorage.getItem('fixo_screen') === 'screen-chatiq') render();
  });
  window.FIXO_CHATIQ = { render };
})();
