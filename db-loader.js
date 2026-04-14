/* ══════════════════════════════════════════════════════
   DB-LOADER — Chargement Firestore centralisé
   Charge toutes les collections en parallèle,
   peuple les variables globales, puis appelle
   window._pageInit() définie par chaque page.
══════════════════════════════════════════════════════ */
import { loadCollection, COL, getHiddenByName } from './firebase.js';

// Exposer le lookup sensible (par hash de nom exact) aux scripts classiques.
window.VCL_DB = { getHiddenByName, COL };

(async () => {
  try {
    const [items, mobs, pnj] = await Promise.all([
      loadCollection(COL.items),
      loadCollection(COL.mobs),
      loadCollection(COL.pnj),
    ]);
    if (typeof ITEMS      !== 'undefined') ITEMS.push(...items);
    if (typeof MOBS       !== 'undefined') MOBS.push(...mobs);
    if (typeof PERSONNAGES !== 'undefined') PERSONNAGES.push(...pnj);
  } catch (err) {
    console.error('[DB-Loader] Erreur Firestore :', err);
  }
  window._pageInit?.();
})();
