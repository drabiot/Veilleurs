/* ══════════════════════════════════════════════════════════════
   I18N — français (source) → anglais
   ──────────────────────────────────────────────────────────────
   Le site est écrit en français. En mode « en », les textes de l'interface sont remplacés
   d'après le dictionnaire i18n/en.json : { "texte français exact": "English text" }.
   • Marche sur le HTML statique ET sur ce que les scripts affichent ensuite (MutationObserver).
   • Une clé peut contenir des variables : "{n} résultats" → "{n} results".
   • Les noms d'items/mobs/PNJ ne sont jamais traduits (pas dans le dictionnaire).
   • Un bloc peut être exclu avec l'attribut  data-no-i18n.
   • Debug : ajouter ?i18n_debug=1 → window.VCL_I18N.missing() liste les textes restés en français.
   Langue : ?lang=en|fr  >  choix mémorisé (localStorage)  >  langue du navigateur (français → fr, sinon en).
══════════════════════════════════════════════════════════════ */

const LS_KEY = 'vcl_lang';
// Langues proposées. 'fr' = langue source du site (aucun dictionnaire) ; les autres chargent i18n/<code>.json.
const LANGUAGES = [
  { code: 'fr', label: 'Français' },
  { code: 'en', label: 'English' },
];
const SUPPORTED = LANGUAGES.map(l => l.code);
const ATTRS = ['title', 'placeholder', 'alt', 'aria-label', 'data-tooltip', 'data-label'];
const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'NOSCRIPT', 'CODE', 'PRE']);

const safe = (op, v) => { try { return op === 'get' ? localStorage.getItem(LS_KEY) : localStorage.setItem(LS_KEY, v); } catch { return null; } };

function detectLang() {
  const url = new URL(location.href);
  const q = url.searchParams.get('lang');
  if (SUPPORTED.includes(q)) {
    safe('set', q);
    url.searchParams.delete('lang');
    history.replaceState(null, '', url.pathname + url.search + url.hash);   // l'URL partagée reste neutre
    return q;
  }
  const saved = safe('get');
  if (SUPPORTED.includes(saved)) return saved;
  return (navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export const lang = detectLang();
document.documentElement.lang = lang;

export function setLang(l) {
  if (!SUPPORTED.includes(l) || l === lang) return;
  safe('set', l);
  location.reload();   // le plus fiable : on repart du français d'origine
}

// ── Dictionnaire ─────────────────────────────────────────────────
const exact = new Map();
const patterns = [];                 // { re, tpl }
const missing = new Map();           // texte français non traduit → occurrences (debug)
const keep = new Set();              // textes à laisser tels quels (pas « manquants »)
const DEBUG = new URLSearchParams(location.search).has('i18n_debug');

const squash = s => s.replace(/\s+/g, ' ').trim();
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function compile(dict) {
  for (const k of dict._keep || []) keep.add(squash(k));            // textes volontairement identiques (noms propres…)
  for (const [k, v] of Object.entries(dict)) {
    if (k.startsWith('_') || typeof v !== 'string') continue;       // _comment, _keep…
    if (/\{\w+\}/.test(k)) {
      const re = new RegExp('^' + esc(squash(k)).replace(/\\\{(\w+)\\\}/g, (_, n) => `(?<${n}>.+?)`) + '$');
      patterns.push({ re, tpl: v });
    } else exact.set(squash(k), v);
    outputs.add(squash(v.replace(/\{\w+\}/g, ' ')));
  }
}

function translate(s) {
  const n = squash(s);
  if (!n) return null;
  const hit = exact.get(n);
  if (hit != null) return hit;
  for (const p of patterns) {
    const m = p.re.exec(n);
    if (m) return p.tpl.replace(/\{(\w+)\}/g, (_, k) => (m.groups[k] ?? ''));
  }
  return null;
}

const outputs = new Set();           // textes déjà en anglais (valeurs du dictionnaire) : jamais « manquants »
const looksFrench = s => /[a-zA-ZÀ-ÿ]{3,}/.test(s) && !/^[\d\s.,:;/\\|+\-–—×x%()[\]#@*•·→←↑↓✦✕✓]+$/.test(s);

function translateTextNode(node) {
  const raw = node.nodeValue;
  if (!raw || !raw.trim()) return;
  const out = translate(raw);
  if (out == null) {
    if (DEBUG && looksFrench(raw) && !keep.has(squash(raw)) && !outputs.has(squash(raw))) { const k = squash(raw); missing.set(k, (missing.get(k) || 0) + 1); }
    return;
  }
  outputs.add(out);                      // déjà traduit : le debug ne le signalera pas quand l'observateur le revoit
  if (squash(raw) === out) return;
  const lead = raw.match(/^\s*/)[0], trail = raw.match(/\s*$/)[0];
  node.nodeValue = lead + out + trail;
}

function translateAttrs(el) {
  for (const a of ATTRS) {
    if (!el.hasAttribute || !el.hasAttribute(a)) continue;
    const raw = el.getAttribute(a), out = translate(raw);
    if (out != null && out !== raw) el.setAttribute(a, out);
    else if (out == null && DEBUG && looksFrench(raw) && !keep.has(squash(raw)) && !outputs.has(squash(raw))) { const k = squash(raw); missing.set(k, (missing.get(k) || 0) + 1); }
  }
  if (el.tagName === 'INPUT' && /^(button|submit|reset)$/i.test(el.type || '')) {
    const out = translate(el.value);
    if (out != null) el.value = out;
  }
}

const skipped = n => {
  const el = n.nodeType === 1 ? n : n.parentElement;
  return !el || SKIP_TAGS.has(el.tagName) || el.closest('[data-no-i18n]');
};

function walk(root) {
  if (!root || skipped(root)) return;
  if (root.nodeType === 3) { translateTextNode(root); return; }
  if (root.nodeType !== 1) return;
  translateAttrs(root);
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
    acceptNode: n => (n.nodeType === 1 && (SKIP_TAGS.has(n.tagName) || n.hasAttribute('data-no-i18n')) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  let n = tw.nextNode();
  while (n) { if (n.nodeType === 3) translateTextNode(n); else translateAttrs(n); n = tw.nextNode(); }
}

function observe() {
  const mo = new MutationObserver(records => {
    for (const r of records) {
      if (r.type === 'childList') r.addedNodes.forEach(walk);
      else if (r.type === 'characterData') { if (!skipped(r.target)) translateTextNode(r.target); }
      else if (r.type === 'attributes' && !skipped(r.target)) translateAttrs(r.target);
    }
  });
  mo.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

// ── Sélecteur de langue (dans le header de chaque page) ──────────
// Le bouton affiche la langue ACTIVE (drapeau + code) ; un clic ouvre la liste des langues disponibles.
// Pour ajouter une langue : l'ajouter dans LANGUAGES et créer i18n/<code>.json (même format que en.json).
// Drapeaux en SVG : les emojis de drapeaux ne s'affichent pas sous Windows.
function flagSvg(code, n) {
  if (code === 'fr') return '<svg viewBox="0 0 3 2" width="20" height="14" aria-hidden="true"><rect width="1" height="2" fill="#0055A4"/><rect x="1" width="1" height="2" fill="#fff"/><rect x="2" width="1" height="2" fill="#EF4135"/></svg>';
  if (code === 'en') {
    const id = 'vcl-uk-' + n;
    return `<svg viewBox="0 0 60 30" width="22" height="11" aria-hidden="true"><clipPath id="${id}"><path d="M30,15 h30 v15 z v15 h-30 z h-30 v-15 z v-15 h30 z"/></clipPath><path d="M0,0 v30 h60 v-30 z" fill="#00247d"/><path d="M0,0 L60,30 M60,0 L0,30" stroke="#fff" stroke-width="6"/><path d="M0,0 L60,30 M60,0 L0,30" clip-path="url(#${id})" stroke="#cf142b" stroke-width="4"/><path d="M30,0 v30 M0,15 h60" stroke="#fff" stroke-width="10"/><path d="M30,0 v30 M0,15 h60" stroke="#cf142b" stroke-width="6"/></svg>`;
  }
  return '<span aria-hidden="true">🌐</span>';
}

const LANG_CSS = `
.vcl-lang{position:relative;display:inline-block;margin-right:8px;vertical-align:middle}
.vcl-lang-btn{display:inline-flex;align-items:center;gap:5px;background:transparent;border:1px solid rgba(224,172,96,.4);color:#e0ac60;border-radius:4px;padding:2px 7px;font-family:inherit;font-size:11px;font-weight:600;line-height:1.2;letter-spacing:.06em;cursor:pointer}
.vcl-lang-btn:hover,.vcl-lang-btn[aria-expanded="true"]{background:rgba(224,172,96,.12)}
.vcl-lang-btn .caret{font-size:8px;opacity:.7}
.vcl-lang-btn svg,.vcl-lang-opt svg{display:block;width:18px;height:12px;border-radius:2px;flex:none}
.vcl-lang-menu{position:fixed !important;z-index:2147483000;min-width:128px;background:#15120e;border:1px solid rgba(224,172,96,.4);border-radius:6px;padding:3px;box-shadow:0 10px 28px rgba(0,0,0,.55)}
.vcl-lang-menu[hidden]{display:none}
.vcl-lang-opt{display:flex;align-items:center;gap:8px;width:100%;background:transparent;border:0;border-radius:4px;color:#d8cdb8;padding:5px 8px;font-family:inherit;font-size:11px;font-weight:500;line-height:1.2;text-align:left;cursor:pointer}
.vcl-lang-opt:hover,.vcl-lang-opt:focus-visible{background:rgba(224,172,96,.14);outline:none}
.vcl-lang-opt .check{margin-left:auto;padding-left:10px;color:#e0ac60}
`;

function injectSwitch() {
  const host = document.querySelector('.header-right');
  if (!host || document.getElementById('vcl-lang')) return;
  if (!document.getElementById('vcl-lang-css')) {
    const st = document.createElement('style');
    st.id = 'vcl-lang-css';
    st.textContent = LANG_CSS;
    document.head.appendChild(st);
  }
  const cur = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];
  const wrap = document.createElement('div');
  wrap.id = 'vcl-lang';
  wrap.className = 'vcl-lang';
  wrap.setAttribute('data-no-i18n', '');
  wrap.innerHTML = `
    <button type="button" class="vcl-lang-btn" id="vcl-lang-btn" aria-haspopup="menu" aria-expanded="false" title="${cur.label}">
      ${flagSvg(cur.code, 0)}<span>${cur.code.toUpperCase()}</span><span class="caret">▾</span>
    </button>
    <div class="vcl-lang-menu" id="vcl-lang-menu" role="menu" hidden>
      ${LANGUAGES.map((l, i) => `<button type="button" class="vcl-lang-opt" role="menuitemradio" aria-checked="${l.code === lang}" data-lang="${l.code}">
        ${flagSvg(l.code, i + 1)}<span>${l.label}</span>${l.code === lang ? '<span class="check">✓</span>' : ''}</button>`).join('')}
    </div>`;
  const btn = wrap.querySelector('#vcl-lang-btn'), menu = wrap.querySelector('#vcl-lang-menu');
  menu.setAttribute('data-no-i18n', '');
  document.body.appendChild(menu);   // hors du header : un parent avec transform/filter casserait position:fixed
  const close = () => { menu.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  // menu en position fixe, calé sous le bouton et gardé dans l'écran (indépendant du conteneur du header)
  const place = () => {
    const r = btn.getBoundingClientRect(), w = menu.offsetWidth;
    menu.style.top = Math.round(r.bottom + 6) + 'px';
    menu.style.left = Math.round(Math.max(8, Math.min(r.right - w, innerWidth - w - 8))) + 'px';
  };
  btn.onclick = e => {
    e.stopPropagation();
    const open = menu.hidden;
    menu.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) { place(); menu.querySelector('.vcl-lang-opt')?.focus(); }
  };
  addEventListener('resize', close);
  addEventListener('scroll', close, true);
  menu.querySelectorAll('.vcl-lang-opt').forEach(o => { o.onclick = () => { close(); setLang(o.dataset.lang); }; });
  document.addEventListener('click', e => { if (!wrap.contains(e.target) && !menu.contains(e.target)) close(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) { close(); btn.focus(); } });
  host.insertBefore(wrap, host.firstChild);
}

// ── Démarrage ────────────────────────────────────────────────────
async function boot() {
  injectSwitch();
  if (lang === 'fr') return;           // le français est la source : rien à traduire
  try {
    const r = await fetch(new URL(`./i18n/${lang}.json`, import.meta.url), { cache: 'no-cache' });
    if (r.ok) compile(await r.json());
  } catch { /* sans dictionnaire : le site reste en français */ }
  walk(document.body);
  const t = translate(document.title);
  if (t) document.title = t;
  observe();
}

if (document.readyState === 'loading') await new Promise(r => document.addEventListener('DOMContentLoaded', r, { once: true }));
await boot();

window.VCL_I18N = {
  lang,
  setLang,
  t: s => (lang !== 'fr' ? (translate(s) ?? s) : s),   // pour les textes construits dans le code
  missing: () => [...missing.entries()].sort((a, b) => b[1] - a[1]),
  size: () => exact.size + patterns.length,
};
