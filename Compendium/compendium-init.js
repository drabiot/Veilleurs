/* ══════════════════════════════════
   COMPENDIUM — Chargement Firestore
   Charge les items depuis la DB puis
   lance l'init du compendium.
══════════════════════════════════ */
import { loadCollection, COL } from '../firebase.js';

(async () => {
  try {
    const items = await loadCollection(COL.items);
    // Peupler le tableau global attendu par compendium.js
    ITEMS.push(...items);
  } catch (err) {
    console.error('[Compendium] Erreur chargement Firestore :', err);
  }
  // Lancer l'init dans tous les cas (même si vide, pour afficher la page)
  window._initCompendium?.();
})();
