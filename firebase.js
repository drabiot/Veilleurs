/* ══════════════════════════════════════════════════════
   FIREBASE — Config & helpers partagés
   Import depuis n'importe quelle page :
   <script type="module">
     import { db, auth, getCurrentUser, getUserRole } from './firebase.js';
   </script>
══════════════════════════════════════════════════════ */

import { initializeApp, getApps, getApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, enableIndexedDbPersistence,
         doc, getDoc, collection, getDocs, onSnapshot,
         setDoc, addDoc, updateDoc, deleteDoc,
         query, where, orderBy }                  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, signOut }    from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
const app  = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// Cache offline — une visite déjà faite = 0 reads Firestore
enableIndexedDbPersistence(db).catch(() => {});

// ── Collections ──────────────────────────────────────
export const COL = {
  items:    'items',
  mobs:     'mobs',
  pnj:      'personnages',
  regions:  'regions',
  users:    'users',      // profils + rôles
};

// ── Rôles ─────────────────────────────────────────────
// Hiérarchie : visiteur < membre < contributeur < modo < admin
export const ROLES = ['visiteur', 'membre', 'contributeur', 'modo', 'admin'];

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

export async function logout() {
  return signOut(auth);
}

// ── Data helpers ─────────────────────────────────────

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
         updateDoc, deleteDoc, query, where, orderBy };
