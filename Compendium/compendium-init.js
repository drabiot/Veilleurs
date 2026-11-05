/* ══════════════════════════════════
   COMPENDIUM — Chargement Firestore
   Charge les items depuis la DB puis
   lance l'init du compendium.
══════════════════════════════════ */
import { loadCollection, COL, db, doc, getDoc } from '../firebase.js';

(async () => {
  try {
    const items = await loadCollection(COL.items);
    // Peupler le tableau global attendu par compendium.js
    ITEMS.push(...items);
  } catch (err) {
    console.error('[Compendium] Erreur chargement Firestore :', err);
  }
  // Items du tableau de chasse (config/tableau_de_chasse) : icône 🎯 dans le compendium
  window._vclHunt = new Set();
  try {
    const snap = await getDoc(doc(db, 'config', 'tableau_de_chasse'));
    const t = snap.exists() ? snap.data() : {};
    (t.items || []).filter(Boolean).forEach(id => window._vclHunt.add(id));
    (Array.isArray(t.avis) ? t.avis : []).forEach(a => { if (a && a.mode === 'items' && a.kind === 'update' && a.docId) window._vclHunt.add(a.docId); });
  } catch (err) { console.warn('[Compendium] tableau de chasse illisible :', err); }
  // Lancer l'init dans tous les cas (même si vide, pour afficher la page)
  window._initCompendium?.();
})();
