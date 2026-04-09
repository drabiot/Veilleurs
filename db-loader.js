/* ══════════════════════════════════════════════════════
   DB-LOADER — Chargement Firestore centralisé
   Charge toutes les collections en parallèle,
   peuple les variables globales, puis appelle
   window._pageInit() définie par chaque page.
══════════════════════════════════════════════════════ */
import { loadCollection, COL } from './firebase.js';

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
