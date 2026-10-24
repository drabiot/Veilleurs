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
         setDoc as _setDoc, addDoc as _addDoc, updateDoc as _updateDoc,
         deleteDoc as _deleteDoc, deleteField,
         serverTimestamp, increment, writeBatch as _writeBatch, Timestamp,
         query, where, orderBy, limit }           from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getAuth, onAuthStateChanged,
         signInWithEmailAndPassword, signOut,
         createUserWithEmailAndPassword, signInWithCustomToken,
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
  pnjSecret:    'pnj_secret',       // PNJs sensibles (doc complet), contrib only
  regions:      'regions',
  users:        'users',          // profils + rôles
  quetes:       'quetes',         // quêtes approuvées via modération
  panoplies:    'panoplies',      // panoplies (sets d'équipement)
  mapMarkers:   'map_markers',    // marqueurs carte gérés via modération (donjons, ressources)
  zones:        'zones',          // zones de spawn de monstres (polygones)
  donjons:      'donjons',        // donjons migrés depuis data.js
  submissions: 'submissions',
  buildsPublished: 'builds_published', // builds communautaires publiés
  buildsSensible:  'builds_sensible',  // données des slots sensibles (contrib+ only)
  userFavorites:   'user_favorites',   // index plat des favoris par user
  events:          'events',           // events (Noël 2025, etc.) pour les sources d'obtention
};

// ── Synchronisation différentielle ─────────────────────
// Collections lues via loadCollection() et mises en cache localement. Toute écriture dessus
// (setDoc / addDoc / updateDoc / deleteDoc / writeBatch exportés ci-dessous) est datée avec
// `_updatedAt` ; une suppression laisse une trace dans `tombstones`. Les visiteurs ne
// redemandent alors à Firestore que ce qui a changé depuis leur dernière visite.
// ⚠ Un script qui écrit sans passer par ces fonctions doit dater ses écritures lui-même
//   (et poser une trace de suppression), ou bumper config/sync.epoch pour forcer un rechargement.
const SYNC_COLS = new Set([COL.items, COL.itemsHidden, COL.itemsSecret, COL.mobs, COL.mobsSecret,
  COL.pnj, COL.pnjSecret, COL.regions, COL.quetes, COL.panoplies, COL.mapMarkers, COL.zones, COL.donjons]);
const _segs   = ref => String(ref?.path || '').split('/');
const _isSync = ref => { const s = _segs(ref); return SYNC_COLS.has(s[0]) && s.length <= 2; };
const _stamp  = () => ({ _updatedAt: serverTimestamp() });
const _tomb   = ref => [doc(db, 'tombstones', `${_segs(ref)[0]}__${ref.id}`), { col: _segs(ref)[0], id: ref.id, ts: serverTimestamp() }];
const _stampArgs = args => (args.length === 1 && args[0] && typeof args[0] === 'object')
  ? [{ ...args[0], ..._stamp() }]
  : [...args, '_updatedAt', serverTimestamp()];

const setDoc    = (ref, data, opts) => _setDoc(ref, _isSync(ref) ? { ...data, ..._stamp() } : data, opts);
const addDoc    = (ref, data)       => _addDoc(ref, _isSync(ref) ? { ...data, ..._stamp() } : data);
const updateDoc = (ref, ...args)    => _updateDoc(ref, ...(_isSync(ref) ? _stampArgs(args) : args));
const deleteDoc = async ref => {
  if (!_isSync(ref)) return _deleteDoc(ref);
  const b = _writeBatch(db);
  b.set(..._tomb(ref));
  b.delete(ref);
  try { return await b.commit(); }
  catch (e) { // règles de `tombstones` pas encore déployées : on supprime quand même
    if (e?.code !== 'permission-denied') throw e;
    return _deleteDoc(ref);
  }
};
const writeBatch = dbArg => {
  const b = _writeBatch(dbArg);
  const w = {
    set(ref, data, opts)  { b.set(ref, _isSync(ref) ? { ...data, ..._stamp() } : data, opts); return w; },
    update(ref, ...args)  { b.update(ref, ...(_isSync(ref) ? _stampArgs(args) : args)); return w; },
    delete(ref)           { if (_isSync(ref)) b.set(..._tomb(ref)); b.delete(ref); return w; },
    commit: () => b.commit(),
  };
  return w;
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

const DISCORD_WORKER = 'https://veilleurs.veilleurs-wiki.workers.dev';

/**
 * Connexion (mode 'login') ou liaison du compte courant (mode 'link') via Discord.
 * Le worker vérifie l'appartenance au serveur, synchronise le rôle et renvoie un custom token.
 * Doit être appelée directement depuis un clic (ouverture de popup).
 */
export async function loginWithDiscord(mode = 'login') {
  const popup = window.open('about:blank', 'vcl-discord', 'width=520,height=760');
  if (!popup) return loginWithDiscordRedirect(mode);
  try {
    const idToken = mode === 'link' ? await auth.currentUser?.getIdToken() : undefined;
    const r = await fetch(DISCORD_WORKER + '/discord/start', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, idToken, origin: location.origin }),
    });
    const d = await r.json();
    if (!d.url) throw new Error(d.error || 'Connexion Discord indisponible.');
    popup.location.href = d.url;
    const res = await new Promise((resolve, reject) => {
      const onMsg = e => {
        if (e.source !== popup || e.data?.type !== 'vcl-discord') return;
        cleanup(); resolve(e.data);
      };
      const cleanup = () => { clearInterval(timer); window.removeEventListener('message', onMsg); };
      const timer = setInterval(() => {
        if (popup.closed) { cleanup(); reject(Object.assign(new Error('closed'), { code: 'auth/popup-closed-by-user' })); }
      }, 500);
      window.addEventListener('message', onMsg);
    });
    if (res.error) throw new Error(res.error);
    const cred = await signInWithCustomToken(auth, res.token);
    if (res.pseudo && cred.user.displayName !== res.pseudo) {
      try { await updateProfile(cred.user, { displayName: res.pseudo }); } catch {}
    }
    return cred;
  } catch (e) { popup.close(); throw e; }
}

/** Popups bloquées : redirection plein écran, le token revient dans le fragment (voir consumeDiscordRedirect). */
async function loginWithDiscordRedirect(mode) {
  const idToken = mode === 'link' ? await auth.currentUser?.getIdToken() : undefined;
  const r = await fetch(DISCORD_WORKER + '/discord/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, idToken, origin: location.origin, redirect: true, path: location.pathname }),
  });
  const d = await r.json();
  if (!d.url) throw new Error(d.error || 'Connexion Discord indisponible.');
  sessionStorage.setItem('vcl_discord_back', location.search + location.hash);
  location.href = d.url;
  return new Promise(() => {});
}

/** Au chargement : finalise une connexion Discord revenue par redirection. */
(async function consumeDiscordRedirect() {
  const h = new URLSearchParams(location.hash.slice(1));
  const token = h.get('vcl-discord');
  if (!token) return;
  const pseudo = h.get('pseudo') || '';
  const back = sessionStorage.getItem('vcl_discord_back') || '';
  sessionStorage.removeItem('vcl_discord_back');
  history.replaceState(null, '', location.pathname + (back.startsWith('?') ? back.split('#')[0] : location.search) + (back.includes('#') ? back.slice(back.indexOf('#')) : ''));
  try {
    const cred = await signInWithCustomToken(auth, token);
    if (pseudo && cred.user.displayName !== pseudo) {
      try { await updateProfile(cred.user, { displayName: pseudo }); } catch {}
    }
  } catch (e) { console.error('[discord] redirect login:', e); }
})();

export async function sendVerificationEmail() {
  if (auth.currentUser) return sendEmailVerification(auth.currentUser);
}

export async function logout() {
  return signOut(auth);
}

/** Enregistre une visite de page.
 *  - 1 session = 30 min d'inactivité max (localStorage pv_session_last).
 *  - page_views/site_YYYY-MM-DD : incrémenté une seule fois par session (compteur global de visites).
 *  - user_visits : section trackée au plus une fois par heure (pour répartition par outil).
 *  - Ignoré pour les admins.
 */
/** Date locale YYYY-MM-DD (évite le décalage UTC de toISOString). */
function _localDate(d = new Date()) {
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

const _PV_SESSION_TTL = 30 * 60 * 1000;

export async function logPageView(section) {
  const user = await new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
  });
  if (user) {
    let role = sessionStorage.getItem('vcl_role_' + user.uid);
    if (!role) {
      role = await getUserRole(user.uid);
      sessionStorage.setItem('vcl_role_' + user.uid, role);
    }
    if (role === 'admin') return;
  }

  const now   = Date.now();
  const today = _localDate();
  const hour  = new Date().getHours();

  // Session : nouvelle session si inactivité > 30 min
  const lastActivity = parseInt(localStorage.getItem('pv_session_last') || '0');
  const isNewSession = now - lastActivity >= _PV_SESSION_TTL;
  localStorage.setItem('pv_session_last', String(now));

  // Incrémenter le compteur global de visites (une fois par session)
  if (isNewSession) {
    try {
      const ref = doc(db, 'page_views', 'site_' + today);
      await setDoc(ref, { section: 'site', date: today, count: increment(1) }, { merge: true });
      await updateDoc(ref, { [`hours.${hour}`]: increment(1) });
    } catch { /* silently fail */ }
  }

  // Tracking par section dans user_visits (au plus une fois par heure par section)
  const sectionKey = 'pv_' + section;
  const lastSection = parseInt(localStorage.getItem(sectionKey) || '0');
  const isNewSectionVisit = now - lastSection >= 60 * 60 * 1000;
  if (isNewSectionVisit) localStorage.setItem(sectionKey, String(now));

  // Session depth : sections visitées dans la session courante
  let sessionSections = new Set((localStorage.getItem('pv_session_sections') || '').split(',').filter(Boolean));
  if (isNewSession) {
    const prevDepth = sessionSections.size;
    sessionSections = new Set();
    // Écriture de la profondeur de la session précédente
    if (prevDepth > 0) {
      try {
        const visId = user?.uid || localStorage.getItem('vcl_anon_id');
        if (visId) {
          await setDoc(doc(db, 'user_visits', visId),
            { totalSessions: increment(1), totalSectionVisits: increment(prevDepth) },
            { merge: true });
        }
      } catch {}
    }
  }
  sessionSections.add(section);
  localStorage.setItem('pv_session_sections', [...sessionSections].join(','));

  if (!isNewSectionVisit) return;

  try {
    let visitorId, pseudo, isAnonymous;
    if (user) {
      visitorId = user.uid;
      pseudo = user.displayName || user.email || user.uid;
      isAnonymous = false;
    } else {
      let anonId = localStorage.getItem('vcl_anon_id');
      if (!anonId) {
        anonId = 'anon_' + Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);
        localStorage.setItem('vcl_anon_id', anonId);
      }
      visitorId = anonId;
      pseudo = 'Anonyme';
      isAnonymous = true;
    }

    // firstSeen : une seule fois par visiteur (flag localStorage)
    const firstSeenKey = 'pv_fs_' + String(visitorId).slice(0, 16);
    const isFirstSeen  = !localStorage.getItem(firstSeenKey);
    if (isFirstSeen) localStorage.setItem(firstSeenKey, today);

    // Appareil
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

    const uvRef = doc(db, 'user_visits', visitorId);
    await setDoc(uvRef, {
      pseudo,
      isAnonymous,
      [`sections.${section}`]: increment(1),
      total: increment(1),
      lastSeen: today,
      [`devices.${device}`]:   increment(1),
      ...(isFirstSeen && { firstSeen: today }),
    }, { merge: true });
  } catch { /* silently fail */ }
}

/** Log la consultation d'un contenu (mob, pnj, quete, item…) — rate-limited 1/hr par contenu.
 *  Stocke dans user_visits/{userId} sous les clés `{type}s.{id}` et `{type}_names.{id}`.
 *  Exposé globalement via window._vclLogContentView depuis chaque page.
 */
export async function logContentView(contentType, contentId, contentName) {
  if (!contentId) return;
  const safeId   = String(contentId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cacheKey = `cv_${contentType}_${safeId}`;
  const last = parseInt(localStorage.getItem(cacheKey) || '0');
  const now  = Date.now();
  if (now - last < 60 * 60 * 1000) return;
  localStorage.setItem(cacheKey, String(now));
  try {
    const user = auth.currentUser;
    if (user) {
      const role = sessionStorage.getItem('vcl_role_' + user.uid);
      if (role === 'admin') return;
    }
    const visitorId = user?.uid || localStorage.getItem('vcl_anon_id');
    if (!visitorId) return;
    // Namespace : mob→mobs, pnj→pnj, quete→quetes, item→items
    const ns = contentType === 'pnj' ? 'pnj' : contentType + 's';
    await setDoc(doc(db, 'user_visits', visitorId), {
      [`${ns}.${safeId}`]:            increment(1),
      [`${contentType}_names.${safeId}`]: contentName || String(contentId),
    }, { merge: true });
  } catch {}
}

/** Log une vue d'item dans le compendium — rate-limited 1/hr par item. */
export async function logItemView(itemId, itemName) {
  if (!itemId) return;
  const safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const key  = 'iv_' + safeId;
  const last = parseInt(localStorage.getItem(key) || '0');
  const now  = Date.now();
  if (now - last < 60 * 60 * 1000) return;
  localStorage.setItem(key, String(now));
  const today = _localDate();
  try {
    const ref = doc(db, 'item_views', safeId + '_' + today);
    await setDoc(ref, { itemId: String(itemId), name: itemName || '', date: today, count: increment(1) }, { merge: true });
  } catch {}
  // Tracking par utilisateur
  try {
    const user = auth.currentUser;
    if (user) {
      const role = sessionStorage.getItem('vcl_role_' + user.uid);
      if (role === 'admin') return;
    }
    const visitorId = user?.uid || localStorage.getItem('vcl_anon_id');
    if (!visitorId) return;
    await setDoc(doc(db, 'user_visits', visitorId), {
      [`items.${safeId}`]:      increment(1),
      [`item_names.${safeId}`]: itemName || String(itemId),
    }, { merge: true });
  } catch {}
}

/** Log un terme recherché dans le compendium — rate-limited 1/5min par terme. */
export async function logSearchQuery(term) {
  if (!term || term.length < 2) return;
  const normalized = term.toLowerCase().trim().slice(0, 50);
  const safeKey = normalized.replace(/[^a-z0-9]/g, '_');
  const key  = 'sq_' + safeKey;
  const last = parseInt(localStorage.getItem(key) || '0');
  const now  = Date.now();
  if (now - last < 5 * 60 * 1000) return;
  localStorage.setItem(key, String(now));
  const today = _localDate();
  try {
    const ref = doc(db, 'search_logs', safeKey + '_' + today);
    await setDoc(ref, { term: normalized, date: today, count: increment(1) }, { merge: true });
  } catch {}
  // Tracking par utilisateur
  try {
    const user = auth.currentUser;
    if (user) {
      const role = sessionStorage.getItem('vcl_role_' + user.uid);
      if (role === 'admin') return;
    }
    const visitorId = user?.uid || localStorage.getItem('vcl_anon_id');
    if (!visitorId) return;
    await setDoc(doc(db, 'user_visits', visitorId), {
      [`searches.${safeKey}`]: increment(1),
    }, { merge: true });
  } catch {}
}

/** Log un rapport bug/suggestion envoyé via le widget — collection reports. */
export async function logReport(pseudo, page, text) {
  try {
    await addDoc(collection(db, 'reports'), {
      pseudo: pseudo || 'Anonyme',
      page:   page   || '',
      text:   String(text || '').slice(0, 2000),
      createdAt: serverTimestamp(),
    });
    return true;
  } catch { return false; }
}
// Exposé globalement pour report-widget.js (script non-module)
window._vclLogReport = logReport;

// ── Known Bugs ────────────────────────────────────────

// ── Events : collection `events` (outil modération « Events ») = source unique des noms d'évènement ──
// Met à jour EVENT_NAMES (Compendium/data.js) en place, triée par `ordre` puis date de création.
export async function loadEventNames() {
  if (typeof EVENT_NAMES === 'undefined') return null;
  let names = [];
  try {
    const snap = await getDocs(collection(db, COL.events));
    const ts = d => d.createdAt?.seconds ?? 0;
    names = snap.docs.map(d => d.data())
      .filter(d => d.name)
      .sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9) || ts(a) - ts(b))
      .map(d => d.name);
  } catch (e) { console.warn('[events]', e.message); return null; }
  if (names.length && typeof EVENT_NAMES !== 'undefined') EVENT_NAMES.splice(0, EVENT_NAMES.length, ...names);
  return names;
}

export async function getKnownBugs() {
  const snap = await getDocs(query(collection(db, 'known_bugs'), orderBy('createdAt', 'desc')));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function saveKnownBug({ title, description, status }) {
  return addDoc(collection(db, 'known_bugs'), {
    title:       String(title       || '').trim(),
    description: String(description || '').trim(),
    status:      status || 'actif',
    createdAt:   serverTimestamp(),
    updatedAt:   serverTimestamp(),
  });
}

export async function updateKnownBug(id, data) {
  await updateDoc(doc(db, 'known_bugs', id), { ...data, updatedAt: serverTimestamp() });
}

export async function deleteKnownBug(id) {
  await deleteDoc(doc(db, 'known_bugs', id));
}

window._vclGetKnownBugs = getKnownBugs;

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
  'twoHanded', 'rune_slots', 'img',
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
 * Lookup d'items cachés par nom exact.
 * Doc key = nameHash → getDoc direct sans query (fonctionne pour non-contribs via allow get).
 * Retourne un tableau pour compatibilité avec les appelants existants.
 */
const _hiddenLookupCache = new Map(); // mémoire uniquement
export async function getHiddenByName(colName, name) {
  const hash = await hashName(name);
  if (!hash) return [];
  const cacheKey = `${colName}/name/${hash}`;
  if (_hiddenLookupCache.has(cacheKey)) return _hiddenLookupCache.get(cacheKey);
  try {
    const snap = await getDoc(doc(db, colName, hash));
    const data = snap.exists() ? [desanitizeFromFirestore({ _id: snap.id, ...snap.data() })] : [];
    _hiddenLookupCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn(`[getHiddenByName] ${colName}:`, err);
    return [];
  }
}

/**
 * Lookup d'un item caché par son item.id (champ 'id' dans le doc).
 * Doc key = nameHash → nécessite une query list → contrib+ seulement (Firestore rules).
 * Utilisé uniquement en modération. L'Atelier utilise getHiddenByName.
 */
export async function getHiddenById(colName, itemId) {
  if (!itemId) return null;
  const cacheKey = `${colName}/id/${itemId}`;
  if (_hiddenLookupCache.has(cacheKey)) return _hiddenLookupCache.get(cacheKey);
  try {
    const q = query(collection(db, colName), where('id', '==', String(itemId)), limit(1));
    const snap = await getDocs(q);
    const data = snap.empty ? null : desanitizeFromFirestore({ _id: snap.docs[0].id, ...snap.docs[0].data() });
    _hiddenLookupCache.set(cacheKey, data);
    return data;
  } catch (err) {
    console.warn(`[getHiddenById] ${colName}:`, err);
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

// Une seule lecture de config/wiki_version, partagée par tous les loadCollection de la page.
let _wikiVerP = null;
function _wikiBumpedSince(ts) {
  _wikiVerP ??= getDoc(doc(db, 'config', 'wiki_version'))
    .then(s => (s.exists() ? (s.data().lastUpdated?.toMillis?.() ?? 0) : 0))
    .catch(() => 0);
  return _wikiVerP.then(v => v > ts);
}

// Époque de synchro (config/sync.epoch) : posée par le script de migration, bumpée pour forcer
// un rechargement complet chez tout le monde. 0 = pas migré → ancien mode (TTL + wiki_version).
let _epochP = null;
function _syncEpoch() {
  _epochP ??= getDoc(doc(db, 'config', 'sync'))
    .then(s => (s.exists() ? (s.data().epoch || 0) : 0))
    .catch(() => null);
  return _epochP;
}

const _ms = t => (t && typeof t.toMillis === 'function') ? t.toMillis() : 0;

async function _syncFull(colName, key, epoch) {
  const [snap, tomb] = await Promise.all([
    getDocs(collection(db, colName)),
    getDocs(query(collection(db, 'tombstones'), where('col', '==', colName))).catch(() => null),
  ]);
  let cur = 0;
  const data = snap.docs.map(d => {
    const raw = d.data();
    cur = Math.max(cur, _ms(raw._updatedAt));
    const { _updatedAt, ...rest } = raw;
    return desanitizeFromFirestore({ _id: d.id, ...rest });
  });
  let tcur = 0;
  tomb?.docs.forEach(t => { tcur = Math.max(tcur, _ms(t.data().ts)); });
  try { localStorage.setItem(key, JSON.stringify({ epoch, ts: Date.now(), cur, tcur, data })); } catch {}
  return data;
}

async function _syncDelta(colName, cache, key) {
  const [dSnap, tSnap] = await Promise.all([
    getDocs(query(collection(db, colName), where('_updatedAt', '>', Timestamp.fromMillis(cache.cur)))),
    getDocs(query(collection(db, 'tombstones'), where('ts', '>', Timestamp.fromMillis(cache.tcur)))).catch(() => ({ docs: [] })),
  ]);
  const byId = new Map(cache.data.map(d => [d._id, d]));
  let { cur, tcur } = cache, changed = false;
  tSnap.docs.forEach(t => {
    const x = t.data();
    tcur = Math.max(tcur, _ms(x.ts));
    if (x.col === colName && byId.delete(x.id)) changed = true;   // d'abord les suppressions…
  });
  dSnap.docs.forEach(d => {                                        // …puis les ajouts / modifications
    const raw = d.data();
    cur = Math.max(cur, _ms(raw._updatedAt));
    const { _updatedAt, ...rest } = raw;
    byId.set(d.id, desanitizeFromFirestore({ _id: d.id, ...rest }));
    changed = true;
  });
  const data = changed ? [...byId.values()] : cache.data;
  if (changed || cur !== cache.cur || tcur !== cache.tcur) {
    try { localStorage.setItem(key, JSON.stringify({ ...cache, ts: Date.now(), cur, tcur, data })); } catch {}
  }
  return data;
}

export async function loadCollection(colName, maxAgeMs = CACHE_TTL) {
  if (SYNC_COLS.has(colName)) {
    const epoch = await _syncEpoch();
    if (epoch) { // migration faite : mode différentiel
      const key = `vcl_cache_v3_${colName}`;
      let cache = null;
      try { cache = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
      const usable = cache && cache.epoch === epoch && cache.cur > 0 && Date.now() - cache.ts < 7 * 24 * 3600e3;
      if (usable) {
        try { return await _syncDelta(colName, cache, key); } catch { return cache.data; } // hors-ligne / quota : on garde le cache
      }
      try { return await _syncFull(colName, key, epoch); } catch (e) { if (cache) return cache.data; throw e; }
    }
  }
  return _legacyLoadCollection(colName, maxAgeMs);
}

async function _legacyLoadCollection(colName, maxAgeMs = CACHE_TTL) {
  const cacheKey = `vcl_cache_v2_${colName}`;
  const metaKey  = `vcl_cache_meta_v2_${colName}`;

  try {
    const meta = JSON.parse(localStorage.getItem(metaKey) || '{}');
    if (meta.ts && Date.now() - meta.ts < maxAgeMs) {
      const cached = JSON.parse(localStorage.getItem(cacheKey) || 'null');
      // Cache périmé si config/wiki_version a été bumpée après sa création
      if (cached && !(await _wikiBumpedSince(meta.ts))) return cached; // déjà désanitisé
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
  // Ancien mode : on supprime le cache. Mode différentiel : le cache reste valable, le prochain
  // load() ne récupère que les changements (les écritures de cette page sont déjà datées).
  localStorage.removeItem(`vcl_cache_v2_${colName}`);
  localStorage.removeItem(`vcl_cache_meta_v2_${colName}`);
}

// ── Exports Firestore bruts (pour les pages qui en ont besoin) ──
export { doc, getDoc, collection, getDocs, onSnapshot, setDoc, addDoc,
         updateDoc, deleteDoc, deleteField, serverTimestamp, writeBatch,
         query, where, orderBy, limit };

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
  if (providers.length === 0) return true; // session Discord (custom token) : pas de mot de passe à redemander
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
  if (!/^[\p{L}\p{N}_\- \[\]]{2,32}$/u.test(pseudo)) throw new Error('invalid-pseudo');

  // Unicité : query users where pseudo == pseudo
  const q = query(collection(db, COL.users), where('pseudo', '==', pseudo), limit(2)); // limit exigé par les rules (pas de listing complet des users)
  const snap = await getDocs(q);
  if (snap.docs.some(d => d.id !== user.uid)) throw new Error('pseudo-taken');

  // Ré-auth
  await reauthenticateCurrentUser({ password });

  // Update Firestore
  await updateDoc(doc(db, COL.users, user.uid), { pseudo });
  // Sync leaderboard pseudo map
  try { await setDoc(doc(db, 'config', 'pseudos'), { [user.uid]: pseudo }, { merge: true }); } catch {}
  // Update Firebase Auth displayName (best effort)
  try { await updateProfile(user, { displayName: pseudo }); } catch {}

  return pseudo;
}
