/* ══════════════════════════════════════════════════════════════
   QUÊTES — Chargement Firestore
   quetes-loader.js  (module ES)

   Charge les items depuis Firestore → peuple DB_ITEMS
   puis appelle window._initQuetes()
══════════════════════════════════════════════════════════════ */
import { loadCollection, COL } from '../firebase.js';

(async () => {
  try {
    const items = await loadCollection(COL.items);
    DB_ITEMS.push(...items);
  } catch (err) {
    console.error('[Quêtes] Erreur chargement Firestore items :', err);
  }
  window._initQuetes?.();
})();