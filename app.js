/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — app.js
═══════════════════════════════════════════════ */

window._pageInit = () => {
  const usersList = window.VCL_USERS_LIST || [];
  
  // 1. On crée une map [UID] -> [Pseudo] pour un accès rapide
  const userMap = {};
  usersList.forEach(u => {
    // On prend 'pseudo' ou 'displayName' selon ta structure Firestore
    if (u._id) userMap[u._id] = u.pseudo || u.displayName || "Membre";
  });

  const sources = [
    window.VCL_ITEMS, window.VCL_ITEMS_SECRET,
    window.VCL_MOBS, window.VCL_MOBS_SECRET,
    window.VCL_PERSONNAGES, window.VCL_QUETES,
    window.VCL_REGIONS, window.VCL_PANOPLIES
  ];

  const allData = sources.flat().filter(Boolean);
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  // 2. Calcul des contributions avec ta priorité UID > Name
  const counts = allData.reduce((acc, curr) => {
    const contrib = curr._contributor;
    if (!contrib) return acc;

    let finalName = "Anonyme";

    if (contrib.uid && userMap[contrib.uid]) {
      // Priorité 1 : On a un UID et il existe dans la collection Users
      finalName = userMap[contrib.uid];
    } else if (contrib.name) {
      // Priorité 2 : Pas d'UID ou user inconnu, on prend le nom enregistré
      finalName = contrib.name;
    }

    if (finalName !== "Anonyme") {
      acc[finalName] = (acc[finalName] || 0) + 1;
    }
    return acc;
  }, {});

  // 3. Tri et affichage (Top 10)
  const sorted = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  tbody.innerHTML = sorted.map((user, i) => `
    <tr>
      <td>${i === 0 ? '✨ #1' : '#' + (i + 1)}</td>
      <td style="${i === 0 ? 'color: var(--gold); font-weight: bold;' : ''}">${user.name}</td>
      <td>${user.count}</td>
    </tr>
  `).join('');
};