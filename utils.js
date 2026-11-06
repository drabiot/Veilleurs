/* ══════════════════════════════════════════════════════
   UTILS — Helpers partagés (classic script)
   À charger AVANT tout autre script de module.
   - Déclarations top-level accessibles dans les scripts classiques
   - Namespace window.VCL pour les modules ES
══════════════════════════════════════════════════════ */

/** Retire accents + lowercase — utilisé par les filtres de recherche */
function normalize(str) {
  return String(str ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Référence « id@n » = niveau d'étoile n défini dans la fiche (fiche de base + deltas stars 1…n en cascade).
 *  `find(id)` retrouve une fiche par id ; renvoie la fiche telle quelle, ou la version étoilée (name + ★…, star = n), ou null. */
function resolveStarItem(id, find) {
  const it = find(id);
  if (it) return it;
  const m = typeof id === 'string' ? id.match(/^(.+)@([1-5])$/) : null;
  const base = m && find(m[1]);
  if (!base) return null;
  const o = { ...base }; delete o.stars;
  for (let i = 1; i <= +m[2]; i++) {
    const d = base.stars && base.stars[i];
    if (!d || typeof d !== 'object') continue;
    for (const [k, v] of Object.entries(d)) { if (v === null) delete o[k]; else o[k] = v; }
  }
  return { ...o, id, name: (base.name || m[1]) + ' ' + '★'.repeat(+m[2]), star: +m[2] };
}

/** Distance de Levenshtein — helper interne pour fuzzyMatch */
function _editDist(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++)
      cur[j] = a[i-1] === b[j-1] ? prev[j-1] : 1 + Math.min(prev[j], cur[j-1], prev[j-1]);
    const t = prev; prev = cur; cur = t;
  }
  return prev[b.length];
}

/* Normalisation mémoïsée (cible et requête reviennent à chaque frappe) */
const _fuzzyNormCache = new Map();
function _fuzzyNorm(s) {
  s = String(s ?? '');
  let v = _fuzzyNormCache.get(s);
  if (v === undefined) {
    v = normalize(s).replace(/\s+/g, ' ').trim();
    if (_fuzzyNormCache.size > 20000) _fuzzyNormCache.clear();
    _fuzzyNormCache.set(s, v);
  }
  return v;
}

/**
 * Correspondance floue : tolère fautes de frappe et espaces multiples.
 * exact=true → inclus uniquement si la cible contient la requête telle quelle (items sensibles).
 */
function fuzzyMatch(query, target, exact = false) {
  const nq = _fuzzyNorm(query);
  const nt = _fuzzyNorm(target);
  if (!nq) return true;
  if (nt.includes(nq)) return true;
  if (exact) return false;
  const tokens = nq.split(' ').filter(t => t.length >= 2);
  if (!tokens.length) return false;
  const targetWords = nt.split(' ');
  return tokens.every(token => {
    if (nt.includes(token)) return true;
    const maxDist = token.length <= 5 ? 1 : token.length <= 8 ? 2 : 3;
    return targetWords.some(w => _editDist(token, w) <= maxDist);
  });
}

/** Table des raretés — source unique de vérité */
const RARITIES = {
  'commun':     { label: 'Commun',      color: '#59d059' },
  'rare':       { label: 'Rare',        color: '#2a5fa8' },
  'epique':     { label: 'Épique',      color: '#6a3daa' },
  'legendaire': { label: 'Légendaire',  color: '#d7af5f' },
  'mythique':   { label: 'Mythique',    color: '#f5b5e4' },
  'godlike':    { label: 'Godlike',     color: '#a83020' },
  'event':      { label: 'Event',       color: '#ebebeb' },
};

/** Couleur d'une rareté avec fallback */
function getRarityColor(key) {
  return (RARITIES[key] || { color: '#888' }).color;
}

/** Échappe les caractères HTML dangereux pour injection dans innerHTML */
function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * POST vers un webhook Discord — avec ou sans pièce jointe.
 * `file` est un Blob/File, `fname` le nom attendu côté Discord.
 * Renvoie la Promise fetch (le caller décide du await / catch).
 */
function postDiscord(url, payload, file, fname) {
  if (file && fname) {
    const p = { ...payload, attachments: [{ id: 0, filename: fname }] };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    fd.append('files[0]', file, fname);
    return fetch(url, { method: 'POST', body: fd });
  }
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
}

// Namespace pour accès depuis les modules ES (où `const` top-level n'est pas visible)
window.VCL = { normalize, fuzzyMatch, RARITIES, getRarityColor, escHtml, postDiscord };

// Empêche Chrome d'afficher les suggestions d'email/mdp sur les champs de recherche
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('input[autocomplete="new-password"]').forEach(inp => {
    inp.setAttribute('readonly', '');
    inp.addEventListener('focus', () => inp.removeAttribute('readonly'));
    inp.addEventListener('blur',  () => inp.setAttribute('readonly', ''));
  });
});
