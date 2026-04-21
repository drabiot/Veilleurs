/* ══════════════════════════════════════════════════════
   FIREBASE — Config & helpers partagés
   Import depuis n'importe quelle page :
   <script type="module">
     import { db, auth, getCurrentUser, getUserRole } from './firebase.js';
   </script>
══════════════════════════════════════════════════════ */

import { initializeApp, getApps, getApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { initializeFirestore, getFirestore,
         persistentLocalCache, persistentMultipleTabManager,
         doc, getDoc, collection, getDocs, onSnapshot,
         setDoc, addDoc, updateDoc, deleteDoc, deleteField,
         serverTimestamp,
         query, where, orderBy }                  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, signOut,
         createUserWithEmailAndPassword,
         GoogleAuthProvider, signInWithPopup,
         sendEmailVerification,
         reauthenticateWithCredential, reauthenticateWithPopup,
         EmailAuthProvider, updateProfile }      from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

// ── Config ──────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBdeKmmEFxmGt7_37PF9uWhm5nz-6eaKq0",
  authDomain:        "veilleurs-a13b3.firebaseapp.com",
  projectId:         "veilleurs-a13b3",
  storageBucket:     "veilleurs-a13b3.firebasestorage.app",
  messagingSenderId: "876055511485",
  appId:             "1:876055511485:web:33d8c8dce684bec05692d4",
  measurementId:     "G-HRCG5Q4G9P"
};

// ── Init (guard contre la double initialisation) ─────
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Cache offline multi-onglets — API moderne (remplace enableIndexedDbPersistence dépréciée)
// try/catch au cas où initializeFirestore est appelé deux fois (defensive)
let _db;
try {
  _db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  });
} catch {
  _db = getFirestore(app);
}
export const db   = _db;
export const auth = getAuth(app);

// ── Collections ──────────────────────────────────────
export const COL = {
  items:        'items',
  itemsHidden:  'items_hidden',   // gameplay des items sensibles, docId = hashName(name)
  itemsSecret:  'items_secret',   // flavor des items sensibles (lore/obtain/craft…), contrib only
  mobs:         'mobs',
  mobsSecret:   'mobs_secret',    // mobs sensibles (doc complet), contrib only
  pnj:          'personnages',
  regions:      'regions',
  users:        'users',          // profils + rôles
  quetes:       'quetes',         // quêtes approuvées via modération
  panoplies:    'panoplies',      // panoplies (sets d'équipement)
  mapMarkers:   'map_markers',    // marqueurs carte gérés via modération (donjons, ressources, zones)
};

// ── Rôles ─────────────────────────────────────────────
// Hiérarchie : visiteur < membre < contributeur < admin
export const ROLES = ['visiteur', 'membre', 'contributeur', 'admin'];

export function roleLevel(role) {
  return ROLES.indexOf(role ?? 'visiteur');
}

export function hasRole(userRole, required) {
  return roleLevel(userRole) >= roleLevel(required);
}

// ── Auth helpers ─────────────────────────────────────

/** Retourne une Promise<{uid, email, role}|null> */
export function getCurrentUser() {
  return new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, async user => {
      unsub();
      if (!user) { resolve(null); return; }
      const role = await getUserRole(user.uid);
      resolve({ uid: user.uid, email: user.email, role });
    });
  });
}

/** Lit le rôle d'un user depuis Firestore */
export async function getUserRole(uid) {
  try {
    const snap = await getDoc(doc(db, COL.users, uid));
    return snap.exists() ? (snap.data().role ?? 'membre') : 'membre';
  } catch {
    return 'visiteur';
  }
}

export async function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function register(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function loginWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function sendVerificationEmail() {
  if (auth.currentUser) return sendEmailVerification(auth.currentUser);
}

export async function logout() {
  return signOut(auth);
}

// ── Data helpers ─────────────────────────────────────

/**
 * Sanitize une valeur pour Firestore :
 *  [n, m] (2 nombres)        → {min: n, max: m}   (ranges)
 *  tableaux imbriqués          → {"0":…,"1":…}     (Firestore refuse les arrays d'arrays)
 */
export function sanitizeForFirestore(val, insideArray = false) {
  if (Array.isArray(val)) {
    if (val.length === 2 && val.every(v => typeof v === 'number')) return { min: val[0], max: val[1] };
    if (insideArray) {
      const out = {};
      val.forEach((v, i) => { out[String(i)] = sanitizeForFirestore(v, false); });
      return out;
    }
    return val.map(v => sanitizeForFirestore(v, true));
  }
  if (val !== null && typeof val === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(val)) out[k] = sanitizeForFirestore(v, false);
    return out;
  }
  return val;
}

/**
 * Inverse la sanitization Firestore :
 *  {min,max}          → [min, max]   (ranges de stats)
 *  {"0":…,"1":…,…}   → […]          (tableaux imbriqués)
 * Idempotent sur des données déjà désanitisées.
 */
export function desanitizeFromFirestore(val) {
  if (val === null || val === undefined || typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map(v => desanitizeFromFirestore(v));

  const keys = Object.keys(val);

  // {min: n, max: m} exactement → [n, m]
  if (keys.length === 2 && 'min' in val && 'max' in val &&
      typeof val.min === 'number' && typeof val.max === 'number') {
    return [val.min, val.max];
  }

  // {"0":…,"1":…} clés toutes numériques consécutives → tableau
  if (keys.length > 0 && keys.every((k, i) => k === String(i))) {
    return keys.map(k => desanitizeFromFirestore(val[k]));
  }

  const out = {};
  for (const [k, v] of Object.entries(val)) out[k] = desanitizeFromFirestore(v);
  return out;
}

// ── Items sensibles — liste des champs gameplay ──────
// Les champs listés ici vont dans items_hidden (public via get par hash).
// Tout le reste d'un item sensible va dans items_secret (contrib only).
// La liste est surchargeable via config/sensibleFields.itemGameplayKeys
// pour permettre à la modération d'ajouter/retirer des champs plus tard.
export const DEFAULT_ITEM_GAMEPLAY_KEYS = [
  'id', 'name', 'rarity', 'category', 'cat',
  'palier', 'lvl', 'set', 'stats', 'classes',
  'twoHanded', 'rune_slots',
];

/**
 * Retourne la liste effective des champs gameplay pour items sensibles.
 * Lit config/sensibleFields.itemGameplayKeys si dispo, sinon fallback défaut.
 * Toujours cast en tableau de strings unique.
 */
export async function getItemGameplayKeys() {
  try {
    const snap = await getDoc(doc(db, 'config', 'sensibleFields'));
    if (snap.exists()) {
      const arr = snap.data()?.itemGameplayKeys;
      if (Array.isArray(arr) && arr.length) {
        return [...new Set(arr.filter(k => typeof k === 'string' && k))];
      }
    }
  } catch (err) {
    console.warn('[getItemGameplayKeys] fallback défaut:', err);
  }
  return [...DEFAULT_ITEM_GAMEPLAY_KEYS];
}

// ── Items/mobs sensibles — lookup par hash du nom ────
// Normalise agressivement pour le hash : strip tout sauf [a-z0-9].
// Doit être appliquée identiquement en écriture (creator) et en lecture (atelier).
export function normalizeForHash(name) {
  return String(name ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Hash SHA-1 hex d'un nom normalisé. Retourne '' si nom vide. */
export async function hashName(name) {
  const normalized = normalizeForHash(name);
  if (!normalized) return '';
  const buf = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest('SHA-1', buf);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Lookup d'un item/mob caché par nom exact (après normalisation).
 * Fait un getDoc ciblé (pas de list) — autorisé au public par les règles.
 * Retourne l'objet désanitisé (avec _id = docId = hash) ou null.
 * Pas de cache localStorage : on ne veut pas persister les hits côté visiteur.
 */
const _hiddenLookupCache = new Map(); // mémoire uniquement, par (col+hash)
export async function getHiddenByName(colName, name) {
  const hash = await hashName(name);
  if (!hash) return null;
  const cacheKey = `${colName}/${hash}`;
  if (_hiddenLookupCache.has(cacheKey)) return _hiddenLookupCache.get(cacheKey);
  try {
    const snap = await getDoc(doc(db, colName, hash));
    const data = snap.exists()
      ? desanitizeFromFirestore({ _id: snap.id, ...snap.data() })
      : null;
    _hiddenLookupCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn(`[getHiddenByName] ${colName}:`, err);
    return null;
  }
}

/** Récupère un doc par ID dans une collection (ex: items_secret/{id}). Retourne null si absent ou refusé. */
export async function getSecretById(colName, id) {
  if (!id) return null;
  try {
    const snap = await getDoc(doc(db, colName, String(id)));
    return snap.exists() ? desanitizeFromFirestore({ _id: snap.id, ...snap.data() }) : null;
  } catch {
    return null; // accès refusé (non-contrib) → silencieux
  }
}

/**
 * Charge toute une collection avec cache localStorage.
 * v2 : les données sont stockées désanitisées (format JS original).
 */
const CACHE_TTL = 60 * 60 * 1000; // 1 heure

export async function loadCollection(colName, maxAgeMs = CACHE_TTL) {
  const cacheKey = `vcl_cache_v2_${colName}`;
  const metaKey  = `vcl_cache_meta_v2_${colName}`;

  try {
    const meta = JSON.parse(localStorage.getItem(metaKey) || '{}');
    if (meta.ts && Date.now() - meta.ts < maxAgeMs) {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      if (cached) return cached; // déjà désanitisé
    }
  } catch {}

  const snap = await getDocs(collection(db, colName));
  // Désanitiser ici → le cache stocke le format JS d'origine
  const data = snap.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));

  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
    localStorage.setItem(metaKey, JSON.stringify({ ts: Date.now() }));
  } catch {}

  return data;
}

/**
 * Écoute une collection en temps réel.
 * callback(data) est appelé immédiatement puis à chaque changement.
 * Retourne la fonction `unsubscribe` pour arrêter l'écoute.
 */
export function listenCollection(colName, callback) {
  return onSnapshot(collection(db, colName), snap => {
    const data = snap.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    callback(data);
  });
}

/** Invalide le cache d'une collection (forcer un re-fetch) */
export function invalidateCache(colName) {
  localStorage.removeItem(`vcl_cache_v2_${colName}`);
  localStorage.removeItem(`vcl_cache_meta_v2_${colName}`);
}

// ── Exports Firestore bruts (pour les pages qui en ont besoin) ──
export { doc, getDoc, collection, getDocs, onSnapshot, setDoc, addDoc,
         updateDoc, deleteDoc, deleteField, serverTimestamp,
         query, where, orderBy };

// ── Exports Auth bruts (pour listeners réactifs côté pages) ──
export { onAuthStateChanged,
         reauthenticateWithCredential, reauthenticateWithPopup,
         EmailAuthProvider, GoogleAuthProvider, updateProfile };

// ── Helpers ré-authentification ───────────────────────────
/**
 * Ré-authentifie l'utilisateur courant avant une opération sensible.
 * - email/password : nécessite `password`
 * - google         : déclenche un popup
 * Retourne true en cas de succès, throw sinon.
 */
export async function reauthenticateCurrentUser({ password } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('no-current-user');
  const providers = (user.providerData || []).map(p => p.providerId);
  if (providers.includes('password')) {
    if (!password) throw new Error('password-required');
    const cred = EmailAuthProvider.credential(user.email, password);
    await reauthenticateWithCredential(user, cred);
    return true;
  }
  if (providers.includes('google.com')) {
    await reauthenticateWithPopup(user, new GoogleAuthProvider());
    return true;
  }
  throw new Error('unsupported-provider');
}

/**
 * Met à jour le pseudo de l'utilisateur courant de façon sécurisée.
 * - ré-authentifie d'abord (password requis si email/password)
 * - vérifie l'unicité du pseudo (pas d'autre uid avec ce pseudo)
 * - update users/{uid}.pseudo
 * - met à jour displayName Firebase Auth
 */
export async function changePseudoSecurely(newPseudo, { password } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('no-current-user');

  const pseudo = String(newPseudo || '').trim();
  if (!/^[A-Za-z0-9 _-]{2,32}$/.test(pseudo)) throw new Error('invalid-pseudo');

  // Unicité : query users where pseudo == pseudo
  const q = query(collection(db, COL.users), where('pseudo', '==', pseudo));
  const snap = await getDocs(q);
  if (snap.docs.some(d => d.id !== user.uid)) throw new Error('pseudo-taken');

  // Ré-auth
  await reauthenticateCurrentUser({ password });

  // Update Firestore
  await updateDoc(doc(db, COL.users, user.uid), { pseudo });
  // Update Firebase Auth displayName (best effort)
  try { await updateProfile(user, { displayName: pseudo }); } catch {}

  return pseudo;
}
