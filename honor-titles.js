/* ══════════════════════════════════════════════════════
   TITRES HONORIFIQUES — petit badge à côté du pseudo
   Source : config/leaderboard_titles.titles = { clé: { name, title } }
   clé = uid du compte, ou '__pseudo' pour une contribution sans compte.
   Un membre est reconnu par son uid OU par son pseudo (insensible à la casse).
══════════════════════════════════════════════════════ */
import { db } from './firebase.js';
import { doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

let _titles = null;

export function loadHonorTitles() {
  _titles ??= getDoc(doc(db, 'config', 'leaderboard_titles'))
    .then(s => (s.exists() ? s.data().titles || {} : {}))
    .catch(() => ({}));
  return _titles;
}

export function findHonorTitle(titles, uid, name) {
  const n = String(name || '').trim().toLowerCase();
  for (const [key, t] of Object.entries(titles || {})) {
    if (!t || !t.title) continue;
    if ((uid && key === uid) || (name && key === '__' + name) || (n && String(t.name || '').trim().toLowerCase() === n)) return t.title;
  }
  return '';
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const honorBadgeHtml = title => (title
  ? `<span class="honor-badge" title="${esc(title)}">✦ ${esc(title)}</span>`
  : '');
