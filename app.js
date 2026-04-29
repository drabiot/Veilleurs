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

      if (finalName !== "Anonyme") {
        acc[finalName] = (acc[finalName] || 0) + 1;
      }
      return acc;
    }, {});

    const sorted = Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return;

    tbody.innerHTML = sorted.map((user, i) => `
      <tr>
        <td>${i === 0 ? '✨ #1' : '#' + (i + 1)}</td>
        <td style="${i === 0 ? 'color: var(--gold); font-weight: bold;' : ''}">${user.name}</td>
        <td>${user.count}</td>
      </tr>
    `).join('');
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