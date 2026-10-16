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
const SUPPORTED = ['fr', 'en'];
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
function injectSwitch() {
  const host = document.querySelector('.header-right');
  if (!host || document.getElementById('vcl-lang-btn')) return;
  if (!document.getElementById('vcl-lang-css')) {
    const st = document.createElement('style');
    st.id = 'vcl-lang-css';
    st.textContent = `.vcl-lang-btn{background:transparent;border:1px solid rgba(224,172,96,.4);color:#e0ac60;border-radius:4px;padding:3px 9px;margin-right:8px;font:600 11px/1.2 inherit;font-family:inherit;letter-spacing:.06em;cursor:pointer}.vcl-lang-btn:hover{background:rgba(224,172,96,.12)}`;
    document.head.appendChild(st);
  }
  const b = document.createElement('button');
  b.id = 'vcl-lang-btn';
  b.className = 'vcl-lang-btn';
  b.setAttribute('data-no-i18n', '');
  b.type = 'button';
  b.textContent = lang === 'fr' ? '🌐 EN' : '🌐 FR';
  b.title = lang === 'fr' ? 'Switch to English' : 'Passer en français';
  b.onclick = () => setLang(lang === 'fr' ? 'en' : 'fr');
  host.insertBefore(b, host.firstChild);
}

// ── Démarrage ────────────────────────────────────────────────────
async function boot() {
  injectSwitch();
  if (lang !== 'en') return;
  try {
    const r = await fetch(new URL('./i18n/en.json', import.meta.url), { cache: 'no-cache' });
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
  t: s => (lang === 'en' ? (translate(s) ?? s) : s),   // pour les textes construits dans le code
  missing: () => [...missing.entries()].sort((a, b) => b[1] - a[1]),
  size: () => exact.size + patterns.length,
};
