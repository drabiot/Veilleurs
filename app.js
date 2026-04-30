/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — app.js
═══════════════════════════════════════════════ */

import { db, COL } from './firebase.js';
import { doc, getDoc, collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const _LB_SCAN_COLS = [
  { col: COL.items,       type: 'item'     },
  { col: COL.itemsSecret, type: 'item'     },
  { col: COL.mobs,        type: 'mob'      },
  { col: COL.mobsSecret,  type: 'mob'      },
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
        const c = data._contributor;
        if (!c) continue;
        const entryId = col + '/' + d.id;
        if (excludedIds.has(entryId)) continue;
        const uid  = c.uid  || null;
        const name = c.name || 'Inconnu';
        if (name === 'Anonyme' || name === 'Inconnu') continue;
        const key = uid || ('__' + name);
        if (!byKey[key]) byKey[key] = { uid, name, count: 0 };
        byKey[key].count++;
      }
    } catch {}
  }

  const sorted = Object.values(byKey)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  if (!sorted.length) return;

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
          <div class="podium-name">${data.name}</div>
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
          <span class="lb-name">${u.name}</span>
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
