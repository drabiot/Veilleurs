/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — app.js
═══════════════════════════════════════════════ */

import { listenCollection, COL } from './firebase.js';

window._pageInit = () => {
  // On crée un objet pour stocker nos données vivantes
  const liveData = {
    items: [], itemsSecret: [], mobs: [], mobsSecret: [],
    pnj: [], quetes: [], regions: [], panoplies: [], users: []
  };

  // La fonction qui recalcule et dessine le tableau
const refreshLeaderboard = () => {
    const userMap = {};
    liveData.users.forEach(u => {
        if (u._id) userMap[u._id] = u.pseudo || u.displayName || "Membre";
    });

    const allData = [
        ...liveData.items, ...liveData.itemsSecret,
        ...liveData.mobs, ...liveData.mobsSecret,
        ...liveData.pnj, ...liveData.quetes,
        ...liveData.regions, ...liveData.panoplies
    ].filter(Boolean);

    const counts = allData.reduce((acc, curr) => {
        const contrib = curr._contributor;
        if (!contrib) return acc;
        let finalName = (contrib.uid && userMap[contrib.uid])
            ? userMap[contrib.uid]
            : (contrib.name || "Anonyme");
        if (finalName !== "Anonyme") acc[finalName] = (acc[finalName] || 0) + 1;
        return acc;
    }, {});

    const sorted = Object.entries(counts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

    if (sorted.length === 0) return; // On attend d'avoir des données

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
};

  // On lance les écouteurs temps réel sur chaque collection
  listenCollection(COL.items, (d) => { liveData.items = d; refreshLeaderboard(); });
  listenCollection(COL.users, (d) => { liveData.users = d; refreshLeaderboard(); });
  listenCollection(COL.mobs,  (d) => { liveData.mobs = d;  refreshLeaderboard(); });
  listenCollection(COL.quetes, (d) => { liveData.quetes = d; refreshLeaderboard(); });
  listenCollection(COL.panoplies, (d) => { liveData.panoplies = d; refreshLeaderboard(); });
  listenCollection(COL.mobsSecret, (d) => { liveData.mobsSecret = d; refreshLeaderboard(); });
  listenCollection(COL.itemsSecret, (d) => { liveData.itemsSecret = d; refreshLeaderboard(); });
  listenCollection(COL.regions, (d) => { liveData.regions = d; refreshLeaderboard(); });
  listenCollection(COL.pnj, (d) => { liveData.pnj = d; refreshLeaderboard(); });
};