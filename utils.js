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

/** Distance de Levenshtein — helper interne pour fuzzyMatch */
function _editDist(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  const dp = Array.from({length: a.length + 1}, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

/**
 * Correspondance floue : tolère fautes de frappe et espaces multiples.
 * exact=true → inclus uniquement si la cible contient la requête telle quelle (items sensibles).
 */
function fuzzyMatch(query, target, exact = false) {
  const nq = normalize(String(query ?? '')).replace(/\s+/g, ' ').trim();
  const nt = normalize(String(target ?? '')).replace(/\s+/g, ' ').trim();
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
