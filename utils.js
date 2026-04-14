/* ══════════════════════════════════════════════════════
   UTILS — Helpers partagés (classic script)
   À charger AVANT tout autre script de module.
   - Déclarations top-level accessibles dans les scripts classiques
   - Namespace window.VCL pour les modules ES
══════════════════════════════════════════════════════ */

/** Retire accents + lowercase — utilisé par les filtres de recherche */
function normalize(str) {
  return String(str ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
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
window.VCL = { normalize, RARITIES, getRarityColor, escHtml, postDiscord };
