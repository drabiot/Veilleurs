import { loadCollection, COL, getHiddenByName } from './firebase.js';

window.VCL_DB = { getHiddenByName, COL };

(async () => {
  try {
    // 1. On récupère TOUTES les collections nécessaires
    const [items, itemsSecret, mobs, mobsSecret, pnj, quetes, regions, panoplies] = await Promise.all([
      loadCollection(COL.items),
      loadCollection(COL.itemsSecret).catch(() => []), 
      loadCollection(COL.mobs),
      loadCollection(COL.mobsSecret).catch(() => []),
      loadCollection(COL.pnj),
      loadCollection(COL.quetes),
      loadCollection(COL.regions),
      loadCollection(COL.panoplies).catch(() => []),
    ]);

    // 2. IMPORTANT : On les expose dans window pour app.js
    window.VCL_ITEMS = items;
    window.VCL_ITEMS_SECRET = itemsSecret;
    window.VCL_MOBS = mobs;
    window.VCL_MOBS_SECRET = mobsSecret;
    window.VCL_PERSONNAGES = pnj;
    window.VCL_QUETES = quetes;
    window.VCL_REGIONS = regions;
    window.VCL_PANOPLIES = panoplies;

    // 3. Rétrocompatibilité (pour tes autres scripts qui utilisent ITEMS ou MOBS en majuscules)
    if (typeof ITEMS      !== 'undefined') ITEMS.push(...items);
    if (typeof MOBS       !== 'undefined') MOBS.push(...mobs);
    if (typeof PERSONNAGES !== 'undefined') PERSONNAGES.push(...pnj);
    
    // ... (ton code pour les panoplies reste ici) ...

  } catch (err) {
    console.error('[DB-Loader] Erreur :', err);
  }
  
  // 4. On prévient la page que TOUT est chargé
  window._pageInit?.();
})();
