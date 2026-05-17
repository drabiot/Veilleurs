/* ══ builds-publish.js — Publication de builds vers Firestore ══
   ES module importé dynamiquement depuis atelier.js et builds.js
   Dépendances : firebase.js (db, COL), sanitizeForFirestore
*/

import {
  db, COL,
  sanitizeForFirestore, desanitizeFromFirestore,
  collection, addDoc, getDocs, query, where, getDoc, setDoc, doc, serverTimestamp,
} from '../firebase.js';

/**
 * Publie le build courant dans Firestore.
 * @param {object} payload     - { name, classe, level, caracterPoints, slots, slotImages,
 *                                 sensibleSlots, sensibleSlotsData, runes }
 * @param {object} stats       - résultat de computeStats() : { mins, maxs, setCounts }
 * @param {string} visibility  - 'public' | 'unlisted'
 * @param {object} auth        - firebase auth instance (window._auth)
 * @returns {string} buildId   - ID du document créé
 */
function _buildFingerprint(slots, carPoints) {
  // Compare item IDs only (not names) — avoids property-order sensitivity
  const slotPart = Object.entries(slots || {})
    .map(([k, v]) => k + ':' + (v && typeof v === 'object' ? (v.id ?? '') : (v ?? '')))
    .sort()
    .join('|');
  const carPart = Object.entries(carPoints || {})
    .filter(([, n]) => n > 0)
    .map(([k, v]) => k + ':' + v)
    .sort()
    .join('|');
  return slotPart + '§' + carPart;
}

export async function publishBuild({ payload, stats, visibility, auth }) {
  const user = auth?.currentUser;
  if (!user) throw new Error('Connectez-vous pour publier.');

  const name = payload.name.slice(0, 60);

  // Vérifier les doublons exacts : même auteur + même nom + même items + mêmes attributs
  try {
    const existing = await getDocs(query(
      collection(db, COL.buildsPublished),
      where('authorUid', '==', user.uid),
      where('name', '==', name)
    ));
    if (!existing.empty) {
      const newFp = _buildFingerprint(payload.slots, payload.caracterPoints);
      const isDuplicate = existing.docs.some(d => {
        const data = d.data();
        const slots = desanitizeFromFirestore(data.slots || {});
        return _buildFingerprint(slots, data.caracterPoints) === newFp;
      });
      if (isDuplicate) throw new Error('Un build identique (même nom, mêmes équipements et attributs) existe déjà.');
    }
  } catch(e) {
    if (e.message?.includes('identique')) throw e; // re-throw duplicate error
    // query failure (index manquant etc.) → on laisse passer
  }

  // statsSnapshot : valeurs maxs aplaties pour les requêtes where()
  const statsSnapshot = {};
  if (stats?.maxs) {
    Object.entries(stats.maxs).forEach(function([k, v]) {
      if (typeof v === 'number' && v !== 0) statsSnapshot[k] = Math.round(v * 100) / 100;
    });
  }

  const pseudo = user.displayName || user.email?.split('@')[0] || 'Anonyme';

  // Doc public — les slots sensibles sont EXCLUS (seulement le marqueur sensibleSlots)
  const docData = {
    authorUid:      user.uid,
    authorPseudo:   pseudo,
    name,
    classe:         payload.classe || '',
    level:          payload.level  || 1,
    visibility:     visibility,
    createdAt:      serverTimestamp(),
    updatedAt:      serverTimestamp(),
    slots:          sanitizeForFirestore(payload.slots      || {}),
    runes:          sanitizeForFirestore(payload.runes      || {}),
    runeNames:      payload.runeNames || {},
    slotImages:     payload.slotImages || {},
    sensibleSlots:  payload.sensibleSlots || {},   // { slotId: true } — marqueur only
    caracterPoints: payload.caracterPoints || {},
    statsSnapshot:  statsSnapshot,
    previewCount:   0,
    favoriteCount:  0,
    forkOf:         payload.forkOf || null,
  };

  const ref = await addDoc(collection(db, COL.buildsPublished), docData);

  // Doc protégé builds_sensible/{buildId} — lisible uniquement par contributeur+
  const sensibleSlotsData = payload.sensibleSlotsData || {};
  if (Object.keys(sensibleSlotsData).length > 0) {
    await setDoc(doc(db, COL.buildsSensible, ref.id), {
      authorUid: user.uid,
      slots:     sanitizeForFirestore(sensibleSlotsData), // { slotId: { id, name, img? } }
    });
  }

  return ref.id;
}

/**
 * Charge un build Firestore dans l'atelier via localStorage.
 * Appelé quand atelier.html?build=<id> est détecté.
 * Pour les utilisateurs autorisés, fusionne aussi les slots sensibles.
 */
export async function loadBuildFromFirestore(buildId, dbInst, getDocFn, docFn, desanitizeFn) {
  const snap = await getDocFn(docFn(dbInst, COL.buildsPublished, buildId));
  if (!snap.exists()) return;
  const data = snap.data();
  const SIG = window._atelierSIG;

  const allSlots = desanitizeFn(data.slots || {});

  // Fusionner les slots sensibles pour les utilisateurs autorisés
  if (window._canSeeSensibleItems && data.sensibleSlots && Object.keys(data.sensibleSlots).length > 0) {
    try {
      const sensSnap = await getDocFn(docFn(dbInst, COL.buildsSensible, buildId));
      if (sensSnap.exists()) {
        const sensData = desanitizeFn(sensSnap.data().slots || {});
        Object.assign(allSlots, sensData);
      }
    } catch {}
  }

  const build = {
    v: 2, sig: SIG,
    name:           data.name,
    classe:         data.classe,
    level:          data.level,
    caracterPoints: data.caracterPoints || {},
    slots:          allSlots,
    runes:          desanitizeFn(data.runes || {}),
    forkOf:         buildId,
  };
  const STORAGE_KEY = 'vcl_atelier_0';
  const META_KEY    = 'vcl_atelier_meta';
  localStorage.setItem(STORAGE_KEY, JSON.stringify(build));
  localStorage.setItem(META_KEY, JSON.stringify({ active: 0 }));
  window._pageInit?.();
}
