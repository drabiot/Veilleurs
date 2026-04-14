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
  const [items, firestoreQuetes, regions] = await Promise.allSettled([
    loadCollection(COL.items),
    loadCollection(COL.quetes),
    loadCollection(COL.regions),
  ]);

  if (items.status === 'fulfilled') {
    DB_ITEMS.push(...items.value);
  } else {
    console.error('[Quêtes] Erreur chargement items :', items.reason);
  }

  if (firestoreQuetes.status === 'fulfilled') {
    const existingIds = new Set(QUETES.map(q => q.id));
    const newQuetes = firestoreQuetes.value
      .map(normalizeFirestoreQuest)
      .filter(q => q.id && !existingIds.has(q.id));
    QUETES.push(...newQuetes);
  } else {
    console.error('[Quêtes] Erreur chargement quêtes Firestore :', firestoreQuetes.reason);
  }

  if (regions.status === 'fulfilled') {
    populateZoneColors(regions.value);
  } else {
    console.error('[Quêtes] Erreur chargement régions :', regions.reason);
  }

  

  window._initQuetes?.();
})();
