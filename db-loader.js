/* ══════════════════════════════════════════════════════
   DB-LOADER — Chargement Firestore centralisé
   Charge toutes les collections en parallèle,
   peuple les variables globales, puis appelle
   window._pageInit() définie par chaque page.
══════════════════════════════════════════════════════ */
import { loadCollection, COL, getHiddenByName, getHiddenById } from './firebase.js';

// Exposer le lookup sensible (par hash de nom exact) aux scripts classiques.
window.VCL_DB = { getHiddenByName, getHiddenById, COL };

(async () => {
  try {
	const users = await loadCollection(COL.users, 0);
    const [items, itemsSec, mobs, mobsSec, pnj, quetes, regions, panoplies] = await Promise.all([
      loadCollection(COL.items),
      loadCollection(COL.itemsSecret).catch(() => []),
      loadCollection(COL.mobs),
      loadCollection(COL.mobsSecret).catch(() => []),
      loadCollection(COL.pnj),
      loadCollection(COL.quetes),
      loadCollection(COL.regions),
      loadCollection(COL.panoplies).catch(() => []),
    ]);

    // On expose tout
    window.VCL_ITEMS = items;
    window.VCL_ITEMS_SECRET = itemsSec;
    window.VCL_MOBS = mobs;
    window.VCL_MOBS_SECRET = mobsSec;
    window.VCL_PERSONNAGES = pnj;
    window.VCL_QUETES = quetes;
    window.VCL_REGIONS = regions;
    window.VCL_PANOPLIES = panoplies;
    window.VCL_USERS_LIST = users; // Stockage de la liste des users
    if (typeof ITEMS      !== 'undefined') ITEMS.push(...items);
    if (typeof MOBS       !== 'undefined') MOBS.push(...mobs);
    if (typeof PERSONNAGES !== 'undefined') PERSONNAGES.push(...pnj);
    // Fusionne les panoplies Firestore dans SETS (si défini sur la page)
    if (typeof SETS !== 'undefined' && Array.isArray(panoplies)) {
      for (const p of panoplies) {
        const key = p.id || p._id;
        if (!key) continue;
        // Normalise les clés de bonuses (Firestore stocke en string)
        const bonuses = {};
        if (p.bonuses && typeof p.bonuses === 'object') {
          for (const [k, v] of Object.entries(p.bonuses)) bonuses[k] = v;
        }
        SETS[key] = {
          label: p.label ?? key,
          color: p.color ?? '#888',
          bonuses,
          ordre: p.ordre ?? 999,
        };
      }
    }
  } catch (err) {
    console.error('[DB-Loader] Erreur Firestore :', err);
  }
  window._pageInit?.();
})();
