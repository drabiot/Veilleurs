/* ══════════════════════════════════════════════════════
   FIREBASE — Config & helpers partagés
   Import depuis n'importe quelle page :
   <script type="module">
     import { db, auth, getCurrentUser, getUserRole } from './firebase.js';
   </script>
══════════════════════════════════════════════════════ */

import { initializeApp, getApps, getApp }          from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { db as _d1db, setTokenProvider, doc, getDoc, collection, getDocs, onSnapshot,
         setDoc as _setDoc, addDoc as _addDoc, updateDoc as _updateDoc, deleteDoc as _deleteDoc, deleteField,
         serverTimestamp, increment, writeBatch as _writeBatch, Timestamp,
         query, where, orderBy, limit }           from './d1db.js';
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

// Base de données = Cloudflare D1 via le worker (d1db.js) ; Firebase ne sert plus que pour l'authentification.
export const db   = _d1db;
export const auth = getAuth(app);
setTokenProvider(async () => (auth.currentUser ? auth.currentUser.getIdToken() : null));

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

// ── Lecture / écriture D1 ───────────────────────────────
// Le contenu est lu via GET /db/sync (public) ou POST /db/read (collections protégées), avec un cache local
// « depuis la révision N ». Après une écriture, on oublie l'heure de la dernière vérification pour que le
// prochain chargement récupère tout de suite le changement.
const D1_COLS = new Set([COL.items, COL.mobs, COL.pnj, COL.regions, COL.quetes, COL.panoplies, COL.mapMarkers, COL.zones, COL.donjons]);
const REMOVED_COLS = new Set([COL.itemsHidden, COL.itemsSecret, COL.mobsSecret, COL.pnjSecret]);
const PRIVATE_D1_COLS = new Set(); // plus aucune collection protégée lue par cache
const _colOf = ref => String(ref?.path || '').split('/')[0];
const _forget = ref => { try { localStorage.removeItem(`vcl_sync_chk_${_colOf(ref)}`); } catch {} };
const _w = fn => async (ref, ...args) => { const r = await fn(ref, ...args); _forget(ref); return r; };
const setDoc    = _w(_setDoc);
const addDoc    = _w(_addDoc);
const updateDoc = _w(_updateDoc);
const deleteDoc = _w(_deleteDoc);
const writeBatch = dbArg => {
  const b = _writeBatch(dbArg), refs = [];
  const w = {
    set(ref, ...a)    { refs.push(ref); b.set(ref, ...a); return w; },
    update(ref, ...a) { refs.push(ref); b.update(ref, ...a); return w; },
    delete(ref)       { refs.push(ref); b.delete(ref); return w; },
    commit: async () => { const r = await b.commit(); refs.forEach(_forget); return r; },
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
    // Firestore indisponible (quota…) : le worker lit la copie D1 du compte, pour rester connecté avec le bon rôle
    try {
      const u = auth.currentUser;
      if (u && u.uid === uid) {
        const r = await fetch(DISCORD_WORKER + '/me', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken: await u.getIdToken() }),
        });
        if (r.ok) return (await r.json()).role ?? 'membre';
      }
    } catch {}
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

const _ANON_ANIMALS = ['Loup','Renard','Corbeau','Hibou','Lynx','Cerf','Ours','Faucon','Sanglier','Blaireau','Dragon','Griffon','Lézard','Serpent','Chouette','Belette'];
const _ANON_ADJ     = ['Curieux','Discret','Pensif','Vaillant','Rusé','Sombre','Lunaire','Errant','Brave','Calme','Fier','Agile','Sage','Hardi','Mystérieux','Rêveur'];

/** Nom stable dérivé de l'id anonyme (ex. « Renard Pensif #4821 ») : même visiteur, même nom. */
export function anonName(id) {
  let h = 2166136261;
  for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0;
  return `${_ANON_ANIMALS[h % 16]} ${_ANON_ADJ[(h >>> 4) % 16]} #${String(h % 9000 + 1000)}`;
}

const _PV_SESSION_TTL = 30 * 60 * 1000;

// Stats et tracking : écrits dans Cloudflare D1 via le worker (POST /track), plus dans Firestore.
// Les échecs sont silencieux : le suivi ne doit jamais gêner la navigation.
async function _track(ops) {
  try {
    await fetch(DISCORD_WORKER + '/track', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ops }), keepalive: true,
    });
  } catch {}
}

/** Connecté sur un navigateur qui avait un profil anonyme : le worker fusionne ses stats dans le compte.
 *  La clé locale n'est retirée qu'après succès ; si le worker échoue, on réessaiera à la prochaine page. */
async function _mergeAnonStats(user) {
  try {
    const anonId = localStorage.getItem('vcl_anon_id');
    if (!anonId) return;
    const r = await fetch(DISCORD_WORKER + '/track/merge', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anonId, idToken: await user.getIdToken() }),
    });
    if (r.ok) localStorage.removeItem('vcl_anon_id');
  } catch {}
}

/** Visites des admins jamais comptées : le flag local suit l'appareil, même déconnecté. */
async function _trackingBlocked(knownUser) {
  try {
    if (localStorage.getItem('vcl_no_track') === '1') return true;
  } catch {}
  const user = knownUser !== undefined ? knownUser : await new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
  });
  if (!user) return false;
  let role = sessionStorage.getItem('vcl_role_' + user.uid);
  if (!role) {
    role = await getUserRole(user.uid);
    if (role !== 'visiteur') sessionStorage.setItem('vcl_role_' + user.uid, role);
  }
  if (role !== 'admin') return false;
  try { localStorage.setItem('vcl_no_track', '1'); } catch {}
  return true;
}

export async function logPageView(section) {
  const user = await new Promise(resolve => {
    const unsub = onAuthStateChanged(auth, u => { unsub(); resolve(u); });
  });
  if (await _trackingBlocked(user)) return;
  if (user) await _mergeAnonStats(user);

  const now   = Date.now();
  const today = _localDate();
  const hour  = new Date().getHours();
  const ops   = [];

  // Session : nouvelle session si inactivité > 30 min
  const lastActivity = parseInt(localStorage.getItem('pv_session_last') || '0');
  const isNewSession = now - lastActivity >= _PV_SESSION_TTL;
  localStorage.setItem('pv_session_last', String(now));

  // Compteur global de visites (une fois par session) + visiteurs uniques (une fois par navigateur et par jour)
  const siteInc = {};
  if (isNewSession) { siteInc.count = 1; siteInc[`hours.${hour}`] = 1; }
  if (localStorage.getItem('pv_uv') !== today) {
    localStorage.setItem('pv_uv', today);
    siteInc.uniques = 1;
  }
  if (Object.keys(siteInc).length) {
    ops.push({ col: 'page_views', id: 'site_' + today, set: { section: 'site', date: today }, inc: siteInc });
  }

  // Tracking par section dans user_visits (au plus une fois par heure par section)
  const sectionKey = 'pv_' + section;
  const lastSection = parseInt(localStorage.getItem(sectionKey) || '0');
  const isNewSectionVisit = now - lastSection >= 60 * 60 * 1000;
  if (isNewSectionVisit) localStorage.setItem(sectionKey, String(now));

  const visId = user?.uid || localStorage.getItem('vcl_anon_id');

  // Session depth : sections visitées dans la session courante
  let sessionSections = new Set((localStorage.getItem('pv_session_sections') || '').split(',').filter(Boolean));
  if (isNewSession) {
    const prevDepth = sessionSections.size;
    sessionSections = new Set();
    // Profondeur de la session précédente
    if (prevDepth > 0 && visId) {
      ops.push({ col: 'user_visits', id: visId,
        set: user ? {} : { isAnonymous: true, pseudo: anonName(visId) },
        inc: { totalSessions: 1, totalSectionVisits: Math.min(prevDepth, 20) } });
    }
  }
  sessionSections.add(section);
  localStorage.setItem('pv_session_sections', [...sessionSections].join(','));

  if (isNewSectionVisit) {
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
      pseudo = anonName(anonId);
      isAnonymous = true;
    }

    // firstSeen : une seule fois par visiteur (flag localStorage)
    const firstSeenKey = 'pv_fs_' + String(visitorId).slice(0, 16);
    const isFirstSeen  = !localStorage.getItem(firstSeenKey);
    if (isFirstSeen) localStorage.setItem(firstSeenKey, today);

    // Appareil
    const device = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ? 'mobile' : 'desktop';

    ops.push({ col: 'user_visits', id: visitorId,
      set: { pseudo, isAnonymous, lastSeen: today, ...(isFirstSeen && { firstSeen: today }) },
      inc: { [`sections.${section}`]: 1, total: 1, [`devices.${device}`]: 1, [`dsec.${today}.${section}`]: 1 } });
  }

  if (ops.length) await _track(ops);
}

/** Log la consultation d'un contenu (mob, pnj, quete, item…) — rate-limited 1/hr par contenu.
 *  Stocke dans user_visits/{userId} sous les clés `{type}s.{id}` et `{type}_names.{id}`.
 *  Exposé globalement via window._vclLogContentView depuis chaque page.
 */
export async function logContentView(contentType, contentId, contentName) {
  if (!contentId || await _trackingBlocked()) return;
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
    await _track([{ col: 'user_visits', id: visitorId,
      set: { [`${contentType}_names.${safeId}`]: contentName || String(contentId) },
      inc: { [`${ns}.${safeId}`]: 1 } }]);
  } catch {}
}

/** Log une vue d'item dans le compendium — rate-limited 1/hr par item. */
export async function logItemView(itemId, itemName) {
  if (!itemId || await _trackingBlocked()) return;
  const safeId = String(itemId).replace(/[^a-zA-Z0-9_-]/g, '_');
  const key  = 'iv_' + safeId;
  const last = parseInt(localStorage.getItem(key) || '0');
  const now  = Date.now();
  if (now - last < 60 * 60 * 1000) return;
  localStorage.setItem(key, String(now));
  const today = _localDate();
  try {
    await _track([{ col: 'item_views', id: safeId + '_' + today,
      set: { itemId: String(itemId), name: itemName || '', date: today }, inc: { count: 1 } }]);
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
    await _track([{ col: 'user_visits', id: visitorId,
      set: { [`item_names.${safeId}`]: itemName || String(itemId) },
      inc: { [`items.${safeId}`]: 1 } }]);
  } catch {}
}

/** Log un terme recherché dans le compendium — rate-limited 1/5min par terme. */
export async function logSearchQuery(term) {
  if (!term || term.length < 2 || await _trackingBlocked()) return;
  const normalized = term.toLowerCase().trim().slice(0, 50);
  const safeKey = normalized.replace(/[^a-z0-9]/g, '_');
  const key  = 'sq_' + safeKey;
  const last = parseInt(localStorage.getItem(key) || '0');
  const now  = Date.now();
  if (now - last < 5 * 60 * 1000) return;
  localStorage.setItem(key, String(now));
  const today = _localDate();
  try {
    await _track([{ col: 'search_logs', id: safeKey + '_' + today,
      set: { term: normalized, date: today }, inc: { count: 1 } }]);
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
    await _track([{ col: 'user_visits', id: visitorId, set: {}, inc: { [`searches.${safeKey}`]: 1 } }]);
  } catch {}
}

/** Log un rapport bug/suggestion envoyé via le widget — collection reports. */
export async function logReport(pseudo, page, text, fiche = null) {
  try {
    const data = {
      pseudo: pseudo || 'Anonyme',
      page:   page   || '',
      text:   String(text || '').slice(0, 2000),
      createdAt: serverTimestamp(),
    };
    // Contexte de la fiche signalée (bouton « Signaler une erreur ») : type, id, nom
    if (fiche && fiche.id) {
      data.ficheType = String(fiche.type || '').slice(0, 20);
      data.ficheId   = String(fiche.id).slice(0, 120);
      data.ficheName = String(fiche.name || '').slice(0, 200);
    }
    await addDoc(collection(db, 'reports'), data);
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
  const CK = 'vcl_event_names', CKE = 'vcl_event_emojis';
  let names = [], emojis = {};
  try {
    // Timeout : si Firestore ne répond pas (quota, réseau, Firefox sans cache), on ne bloque pas le chargement de la page
    const snap = await Promise.race([
      getDocs(collection(db, COL.events)),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    const ts = d => d.createdAt?.seconds ?? 0;
    const evs = snap.docs.map(d => d.data())
      .filter(d => d.name)
      .sort((a, b) => (a.ordre ?? 1e9) - (b.ordre ?? 1e9) || ts(a) - ts(b));
    names = evs.map(d => d.name);
    evs.forEach(d => { if (d.emoji) emojis[d.name] = d.emoji; });
    try { localStorage.setItem(CK, JSON.stringify(names)); localStorage.setItem(CKE, JSON.stringify(emojis)); } catch {}
  } catch (e) {
    console.warn('[events]', e.message);
    try { names = JSON.parse(localStorage.getItem(CK) || '[]'); } catch { names = []; }
    try { emojis = JSON.parse(localStorage.getItem(CKE) || '{}'); } catch { emojis = {}; }
  }
  window.EVENT_EMOJIS = emojis; // nom d'event -> emoji choisi dans l'outil modération « Events » (absent = emoji par défaut)
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

// Le système d'items / mobs / PNJ « sensibles » (items_hidden, items_secret, mobs_secret, pnj_secret) est supprimé.
// Ces fonctions restent exportées pour les anciens appelants mais ne lisent plus rien.
export async function getHiddenByName() { return []; }
export async function getHiddenById()   { return null; }
export async function getSecretById()   { return null; }

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

// Pause entre deux vérifications auprès du worker (nulle dans la modération / le créateur : ils doivent voir leurs écritures tout de suite).
const _isEditorPage = /\/(moderation|creator)(\.html)?$/i.test(location.pathname);
const _chkKey = colName => `vcl_sync_chk_${colName}`;
const _D1_PAUSE_MS = _isEditorPage ? 0 : 30 * 1000;
const _isReload = (() => { try { return performance.getEntriesByType('navigation')[0]?.type === 'reload'; } catch { return false; } })();

// Lecture du contenu dans D1 via le worker. Cache local `vcl_cache_d1_*` = { rev, epoch, ts, data } ; le serveur renvoie
// tout ce qui a une révision > rev (et la liste des suppressions). Collections publiques : GET /db/sync ;
// collections protégées (items secrets…) : POST /db/read avec le jeton de l'utilisateur, cache propre à chaque compte.
async function _d1Load(colName) {
  const priv = PRIVATE_D1_COLS.has(colName);
  const user = priv ? await getCurrentUser() : null;
  if (priv && !user) return []; // pas connecté : rien à voir
  const key = `vcl_cache_d1_${colName}` + (priv ? `_${user.uid}` : '');
  const chk = _chkKey(colName) + (priv ? `_${user.uid}` : '');
  let cache = null;
  try { cache = JSON.parse(localStorage.getItem(key) || 'null'); } catch {}
  const usable = cache && cache.rev > 0 && Date.now() - cache.ts < 7 * 24 * 3600e3;
  if (usable) {
    try { if (!_isReload && Date.now() - parseInt(localStorage.getItem(chk) || '0') < _D1_PAUSE_MS) return cache.data; } catch {}
  }
  const get = async since => {
    if (!priv) return fetch(`${DISCORD_WORKER}/db/sync?col=${colName}&since=${since}`).then(r => { if (!r.ok) throw new Error('d1 ' + r.status); return r.json(); });
    const r = await fetch(`${DISCORD_WORKER}/db/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ col: colName, since, idToken: await user.getIdToken() }) });
    if (!r.ok) throw new Error('d1 ' + r.status);
    return r.json();
  };
  let j = await get(usable ? cache.rev : 0), delta = usable;
  if (delta && j.epoch !== cache.epoch) { j = await get(0); delta = false; } // rechargement complet demandé
  const row = x => desanitizeFromFirestore({ _id: x.id, ...x.d });
  let data;
  if (delta) {
    const byId = new Map(cache.data.map(d => [d._id, d]));
    (j.deleted || []).forEach(id => byId.delete(id));
    j.docs.forEach(x => byId.set(x.id, row(x)));
    data = ((j.deleted || []).length || j.docs.length) ? [...byId.values()] : cache.data;
  } else {
    data = j.docs.map(row);
  }
  try {
    localStorage.setItem(key, JSON.stringify({ rev: j.rev, epoch: j.epoch, ts: Date.now(), data }));
    localStorage.setItem(chk, String(Date.now()));
  } catch {}
  return data;
}

export async function loadCollection(colName, maxAgeMs = CACHE_TTL) {
  if (REMOVED_COLS.has(colName)) return []; // système « sensible » supprimé
  if (D1_COLS.has(colName) || PRIVATE_D1_COLS.has(colName)) {
    try { return await _d1Load(colName); }
    catch (e) {
      console.warn('[d1] lecture impossible, repli sur le cache :', colName, e && e.message);
      try {
        const u = PRIVATE_D1_COLS.has(colName) ? auth.currentUser : null;
        const c = JSON.parse(localStorage.getItem(`vcl_cache_d1_${colName}` + (u ? `_${u.uid}` : '')) || 'null');
        if (c?.data) return c.data;
      } catch {}
      throw e;
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
  try { Object.keys(localStorage).filter(k => k.startsWith(_chkKey(colName))).forEach(k => localStorage.removeItem(k)); } catch {} // force la prochaine vérification
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
