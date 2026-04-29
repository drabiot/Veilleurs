/* ═══════════════════════════════════════════════
   Les Veilleurs au Clair de Lune — app.js (Accueil)
═══════════════════════════════════════════════ */

window._pageInit = () => {
  // On liste toutes les sources possibles exposées par le loader
  const sources = [
    window.VCL_ITEMS,
    window.VCL_ITEMS_SECRET,
    window.VCL_MOBS,
    window.VCL_MOBS_SECRET,
    window.VCL_PERSONNAGES,
    window.VCL_QUETES,
    window.VCL_REGIONS,
    window.VCL_PANOPLIES
  ];

  // On aplatit tout en un seul tableau et on enlève les sources vides (null/undefined)
  const allData = sources.flat().filter(Boolean);
  
  const tbody = document.getElementById('leaderboard-body');
  if (!tbody) return;

  // Comptage par _contributor.name
  const counts = allData.reduce((acc, curr) => {
    // On extrait le nom depuis la map _contributor
    const name = (curr._contributor && curr._contributor.name) ? curr._contributor.name : null;
    
    // On ne compte que si on a un nom (on ignore les anonymes)
    if (name) {
      acc[name] = (acc[name] || 0) + 1;
    }
    return acc;
  }, {});

  // Transformation en tableau pour le tri
  const sorted = Object.entries(counts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Affichage
  if (sorted.length === 0) {
    tbody.innerHTML = '<tr><td colspan="3">Aucune contribution trouvée.</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map((user, i) => `
    <tr>
      <td>${i === 0 ? '✨ #1' : '#' + (i + 1)}</td>
      <td style="${i === 0 ? 'color: var(--gold); font-weight: bold;' : ''}">${user.name}</td>
      <td>${user.count} <small style="opacity:0.7">contributions</small></td>
    </tr>
  `).join('');
};