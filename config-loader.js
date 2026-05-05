// Utilitaire partagé : chargement de la config paliers et paramètres de jeu depuis Firestore.
// Utilisé par creator.html et moderation.js.

export const DEFAULT_PALIERS = [
  { id: 1, label: 'Palier 1', color: '#4ade80', floorName: 'Villes Européennes' },
  { id: 2, label: 'Palier 2', color: '#f59e0b', floorName: 'Désert Aride' },
  { id: 3, label: 'Palier 3', color: '#f87171', floorName: 'Forêt Elfique' },
];

export const DEFAULT_MAX_LEVEL = 18;

export async function loadPaliersConfig(db, getDocFn, docFn) {
  try {
    const snap = await getDocFn(docFn(db, 'config', 'paliers'));
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data.paliers) && data.paliers.length > 0) {
        return data.paliers;
      }
    }
  } catch (e) {
    console.warn('[VCL] config/paliers non chargée:', e);
  }
  return DEFAULT_PALIERS;
}

export async function loadMaxLevel(db, getDocFn, docFn) {
  try {
    const snap = await getDocFn(docFn(db, 'config', 'game'));
    if (snap.exists() && typeof snap.data().maxLevel === 'number') {
      return snap.data().maxLevel;
    }
  } catch (e) {
    console.warn('[VCL] config/game non chargée:', e);
  }
  return DEFAULT_MAX_LEVEL;
}
