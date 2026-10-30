/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — app.js
═══════════════════════════════════════════════ */

import { db, COL } from './firebase.js';
import { doc, getDoc, collection, getDocs } from './d1db.js';
import { loadHonorTitles, findHonorTitle, honorBadgeHtml } from './honor-titles.js';

const _LB_SCAN_COLS = [
  { col: COL.items,       type: 'item'     },
  { col: COL.mobs,        type: 'mob'      },
  { col: COL.pnj,         type: 'pnj'      },
  { col: COL.regions,     type: 'region'   },
  { col: COL.quetes,      type: 'quest'    },
  { col: COL.panoplies,   type: 'panoplie' },
];

async function loadLeaderboard() {
  let excludedIds = new Set();
  try {
    const exSnap = await getDoc(doc(db, 'config', 'leaderboard_excluded'));
    if (exSnap.exists()) excludedIds = new Set(exSnap.data().ids || []);
  } catch {}

  const byKey = {};
  for (const { col } of _LB_SCAN_COLS) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const data = d.data();
        const entryId = col + '/' + d.id;
        if (excludedIds.has(entryId)) continue;
        const raw = data._contributor;
        const contribs = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        for (const c of contribs) {
          const uid  = c.uid  || null;
          const name = c.name || 'Inconnu';
          if (!uid) continue; // invités : non comptés
          const key = uid;
          if (!byKey[key]) byKey[key] = { uid, name, count: 0 };
          byKey[key].count += (c.modOnly ? 0 : 1) + (c.edits || 0); // création = 1, chaque modification approuvée = +1
        }
      }
    } catch {}
  }

  // Resolve current pseudo from single config/pseudos map
  try {
    const pseudoSnap = await getDoc(doc(db, 'config', 'pseudos'));
    if (pseudoSnap.exists()) {
      const pseudoMap = pseudoSnap.data();
      for (const e of Object.values(byKey)) {
        if (e.uid && pseudoMap[e.uid]) e.name = pseudoMap[e.uid];
      }
    }
  } catch {}

  // Remise à zéro : config/leaderboard_reset.baseline = compteurs figés au moment du reset
  // (clé = uid ou '__pseudo'). Seules les contributions arrivées depuis comptent.
  // Rien n'est supprimé des documents : supprimer config/leaderboard_reset rétablit le classement complet.
  try {
    const resetSnap = await getDoc(doc(db, 'config', 'leaderboard_reset'));
    const baseline = resetSnap.exists() ? (resetSnap.data().baseline || {}) : {};
    for (const [key, e] of Object.entries(byKey)) {
      e.count -= Number(baseline[key]) || 0;
      if (e.count <= 0) delete byKey[key];
    }
  } catch {}

  const honor = await loadHonorTitles();
  const badge = e => honorBadgeHtml(findHonorTitle(honor, e.uid, e.name));

  const sorted = Object.values(byKey)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!sorted.length) {
    const loading = document.getElementById('podium-loading');
    if (loading) loading.textContent = 'Une nouvelle saison commence — les archives attendent leurs premiers Veilleurs.';
    return;
  }

  // ── Podium (top 3) ──
  const podiumRow = document.getElementById('podium-row');
  if (podiumRow) {
    const slots = [
      { data: sorted[1], cls: 'podium-2nd', rank: '#2' },
      { data: sorted[0], cls: 'podium-1st', rank: '#1' },
      { data: sorted[2], cls: 'podium-3rd', rank: '#3' },
    ];
    podiumRow.innerHTML = slots.map(({ data, cls, rank }) => {
      if (!data) return '';
      const isFst = cls === 'podium-1st';
      return `
        <div class="podium-slot ${cls}">
          ${isFst ? '<div class="podium-crown">✦</div>' : ''}
          <div class="podium-name" data-no-i18n>${data.name}</div>
          ${badge(data) ? `<div class="podium-honor">${badge(data)}</div>` : ''}
          <div class="podium-score">${data.count} contribution${data.count > 1 ? 's' : ''}</div>
          <div class="podium-block">${rank}</div>
        </div>`;
    }).join('');
  }

  // ── Liste #4+ ──
  const lbList = document.getElementById('lb-list');
  const lbBody = document.getElementById('leaderboard-body');
  const rest = sorted.slice(3);

  if (lbBody) {
    if (rest.length > 0) {
      lbList.style.display = '';
      lbBody.innerHTML = rest.map((u, i) => `
        <div class="lb-row">
          <span class="lb-rank">#${i + 4}</span>
          <span class="lb-name" data-no-i18n>${u.name}${badge(u)}</span>
          <span class="lb-count">${u.count}</span>
        </div>`).join('');
    } else {
      lbList.style.display = 'none';
    }
  }
}

window._pageInit = () => {
  loadLeaderboard();
};
