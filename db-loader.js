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
    const [items, mobs, pnj, panoplies] = await Promise.all([
      loadCollection(COL.items),
      loadCollection(COL.mobs),
      loadCollection(COL.pnj),
      loadCollection(COL.panoplies).catch(() => []),
    ]);
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
