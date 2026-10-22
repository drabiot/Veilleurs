/* Synchronisation des effets de l'arbre de compétences avec Firestore.
   Les effets par défaut sont dans skilltree-effects.js ; les modifications faites par un
   admin sont stockées dans config/skilltree et appliquées par-dessus au chargement. */
import { db, getDoc, setDoc, doc } from '../firebase.js';

const REF = () => doc(db, 'config', 'skilltree');

async function load() {
  try {
    const snap = await getDoc(REF());
    if (snap.exists()) window.VCLSkillTree?.applyOverrides(snap.data().overrides || {});
  } catch (e) { console.warn('[SkillTree] chargement des effets :', e); }
}

async function save(overrides) {
  await setDoc(REF(), { overrides, updatedAt: Date.now() });
}

window.VCLSkillSync = { load, save };
load();
