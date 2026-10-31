import { db, auth, onAuthStateChanged,
         logout, loginWithDiscord,
         ROLES, roleLevel, hasRole, COL,
         collection, getDocs, getDoc, doc, updateDoc, setDoc, addDoc,
         deleteDoc, deleteField, serverTimestamp, writeBatch, orderBy, where, query, limit,
         hashName, getItemGameplayKeys,
         sanitizeForFirestore, desanitizeFromFirestore,
         invalidateCache, loadCollection, loadEventNames, anonName }
                             from './firebase.js';
import { toast }  from './components/toast.js';
import { modal }  from './components/modal.js';
import { store }  from './store.js';
// Modules lourds chargés à la première utilisation (statistiques, carte Discord, outil API items, JSZip) plutôt qu'au chargement de la page
const generateCardBlob = (...a) => import('./card-renderer.js').then(m => m.generateCardBlob(...a));
const _loadExternalScript = url => new Promise((res, rej) => { const el = document.createElement('script'); el.src = url; el.onload = res; el.onerror = () => rej(new Error('Script non chargé : ' + url)); document.head.appendChild(el); });
// Vérificateur de soumissions (OCR) : le script n'est chargé qu'au premier clic sur « Vérifier »
{
  const _stub = async (id) => {
    if (window.verifySubmission === _stub) await _loadExternalScript('submission-verify.js?v=e9de96eb');
    if (window.verifySubmission === _stub) { toast('Vérificateur indisponible', 'error'); return; }
    return window.verifySubmission(id);
  };
  window.verifySubmission = _stub;
}

loadEventNames(); // EVENT_NAMES = collection `events` (select « Évènement » de l'éditeur)

// Helpers partagés — utils.js est chargé en classic script avant ce module
const { normalize, fuzzyMatch } = window.VCL;

// Chargement du secret worker depuis Firestore (jamais exposé dans le code)
let _cachedWorkerSecret = null;
async function _getWorkerSecret() {
  if (_cachedWorkerSecret) return _cachedWorkerSecret;
  try {
    const snap = await getDoc(doc(db, 'secrets', 'worker'));
    if (snap.exists()) {
      _cachedWorkerSecret = snap.data().workerSecret;
      return _cachedWorkerSecret;
    }
  } catch (e) { console.error('[getWorkerSecret]', e); }
  throw new Error('Secret worker introuvable dans Firestore (secrets/worker.workerSecret)');
}
const _WIKI_ROOT = new URL('.', import.meta.url).href;
const WORKER_URL  = 'https://veilleurs.veilleurs-wiki.workers.dev';

let currentUser = null;
let currentRole = 'visiteur';
// État de la liste des soumissions (moderation-submissions.js) partagé avec le noyau et les autres panneaux
const _st = { all: [], status: 'pending', type: 'all', search: '' };
window._allSubsForVerify = () => _st.all; // lu par submission-verify.js
const _userNames = new Map(); // uid → pseudo

// ── Cache lecture Firestore (session) ─────────────────
// Évite de relire la même collection plusieurs fois dans la même session.
// Invalidé explicitement après chaque sauvegarde qui modifie la collection.
const _modCache = {};
async function cachedDocs(colName) {
  if (_modCache[colName]) return _modCache[colName];
  const snap = await getDocs(collection(db, colName));
  // _docKey = clé Firestore réelle (peut différer de data.id, ex. items_hidden où la clé est le hash du nom)
  _modCache[colName] = snap.docs.map(d => ({ _docKey: d.id, id: d.id, ...d.data() }));
  return _modCache[colName];
}
function invalidateModCache(colName) {
  delete _modCache[colName];
}

// ── Journal d'audit ───────────────────────────────────
// Écrit silencieusement une entrée dans audit_log — ne bloque jamais l'action principale.
async function _writeAudit(action, targetType, targetId, targetName, metadata = {}) {
  try {
    const actorPseudo = _userNames.get(currentUser?.uid) || currentUser?.email || '?';
    await addDoc(collection(db, 'audit_log'), {
      action,
      actorUid:    currentUser?.uid  || null,
      actorPseudo,
      targetType,
      targetId:    String(targetId   || ''),
      targetName:  String(targetName || ''),
      metadata,
      createdAt:   serverTimestamp(),
    });
  } catch(e) {
    console.warn('[audit]', e);
  }
}

// ── Auth ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    showAuthWall();
    return;
  }
  currentUser = user;
  // Lire le rôle + vérifier la suspension (retry once — auth token may not have propagated to Firestore yet)
  let _userData = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      _userData   = snap.exists() ? snap.data() : null;
      currentRole = _userData?.role || 'membre';
      break;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 800));
      else currentRole = 'membre';
    }
  }

  // Vérifier la suspension avant toute chose
  if (_userData?.suspended) {
    const reason = _userData.suspendedReason ? ` : ${_userData.suspendedReason}` : '.';
    showAuthWall(`🚫 Compte suspendu${reason}`);
    return;
  }

  if (!hasRole(currentRole, 'contributeur')) {
    showAuthWall('⛔ Accès réservé aux contributeurs.');
    return;
  }

  // Masquer les éléments admin-only pour tout rôle non-admin.
  // La liste est pilotée par l'attribut data-min-role dans moderation.html —
  // ajouter data-min-role="admin" sur un bouton suffit, sans toucher au JS.
  if (currentRole !== 'admin') {
    document.querySelectorAll('[data-min-role="admin"]').forEach(el => {
      el.style.display = 'none';
    });
  }

  // Appliquer les permissions configurables des outils du panel (peut ré-afficher des éléments admin-by-default)
  await _applyToolPermissions();

  document.getElementById('auth-wall').style.display   = 'none';
  document.getElementById('main-layout').style.display = 'grid';
  if (localStorage.getItem('vcl_sidebar_hidden')) document.body.classList.add('sidebar-hidden');
  // Afficher le pseudo si disponible, sinon l'email
  try {
    const snapU = await getDoc(doc(db, 'users', user.uid));
    const pseudo = snapU.exists() ? (snapU.data().pseudo || null) : null;
    document.getElementById('header-user').textContent = '👤 ' + (pseudo || user.email);
    // backfill email si absent
    if (snapU.exists() && !snapU.data().email && user.email) {
      updateDoc(doc(db, 'users', user.uid), { email: user.email }).catch(() => {});
    }
  } catch { document.getElementById('header-user').textContent = '👤 ' + user.email; }
  document.getElementById('header-role').textContent   = currentRole;
  document.getElementById('btn-logout').style.display  = '';

  // Charger la config dynamique des paliers avant de router
  await _loadPaliersConfig();
  _populateAllPalierSelects();

  // Hash routing — navigue vers le panel correspondant au hash initial
  _routeToHash();

  // Enregistrer la connexion dans l'audit log (contributeurs seulement, pas les admins)
  if (currentRole === 'contributeur') {
    if (_userData?.pseudo) _userNames.set(currentUser.uid, _userData.pseudo);
    _writeAudit('login', 'session', currentUser.uid, _userData?.pseudo || user.email, {});
  }
});

// Maps tool permission IDs → button ID(s) in the sidebar.
// Default roles: 'admin' for privileged tools, 'contributeur' for the rest.
const MOD_TOOL_BUTTONS = {
  tool_trash:       { btns: ['btn-trash'],                             defaultRole: 'admin' },
  tool_leaderboard: { btns: ['btn-leaderboard'],                       defaultRole: 'admin' },
  tool_audit_log:   { btns: ['btn-audit-log'],                         defaultRole: 'admin' },
  tool_map:         { btns: ['btn-map-order'],                         defaultRole: 'contributeur' },
  tool_zones:       { btns: ['btn-zone-list', 'btn-zone-editor'],       defaultRole: 'contributeur' },
  tool_diagnostic:  { btns: ['btn-ghost-ids', 'btn-region-orphans'],   defaultRole: 'contributeur' },
  tool_capture:     { btns: ['btn-capture-sprites'],                   defaultRole: 'contributeur' },
};

async function _applyToolPermissions() {
  try {
    const snap = await getDoc(doc(db, 'config', 'permissions'));
    const minRole = snap.exists() ? (snap.data().minRole || {}) : {};
    for (const [permId, { btns, defaultRole }] of Object.entries(MOD_TOOL_BUTTONS)) {
      const required = minRole[permId] || defaultRole;
      const visible = hasRole(currentRole, required);
      for (const btnId of btns) {
        const el = document.getElementById(btnId);
        if (el) el.style.display = visible ? '' : 'none';
      }
    }
  } catch {} // silencieux — fallback sur data-min-role
}

function showAuthWall(msg) {
  document.getElementById('auth-wall').style.display   = 'flex';
  document.getElementById('main-layout').style.display = 'none';
  if (msg) {
    const err = document.getElementById('login-error');
    err.textContent = msg; err.style.display = '';
  }
}

window.doLoginDiscord = async () => {
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  try {
    await loginWithDiscord('login');
  } catch(e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      err.textContent = '⛔ ' + e.message; err.style.display = '';
    }
  }
};

window.doLogout = async () => {
  await logout();
  location.reload();
};

window.toggleSidebar = function toggleSidebar() {
  const hidden = document.body.classList.toggle('sidebar-hidden');
  localStorage.setItem('vcl_sidebar_hidden', hidden ? '1' : '');
};

_lazyPanel(() => import('./moderation-submissions.js?v=370d4b9c'), ['loadSubmissions', 'setFilter', 'setFilterSearch', 'loadSubDiff', 'applyDiffSelection', 'modImgFile', 'modImgDrop', 'modImgClear', 'modImgPaste', 'copyCode', 'toggleDetails', 'toggleEdit', 'onEditorInput', 'openInCreator', 'openEditorInCreator', 'approve', 'reject', 'restorePending', 'requestChanges', 'bulkDeleteSubs', 'bulkApproveSubs', 'deleteSub', 'renderSubs', 'updateCounts']);

// id de région → nom affiché sur le wiki (« hanaka » → « Hanaka ») ; à défaut, l'id tel quel
function _regionName(id) {
  const r = (_modCache['regions'] || []).find(x => (x.id || x._id) === id);
  return r?.name || r?.label || id;
}

const escHtml = window.VCL.escHtml;

// ── Diff soumission vs document actuel ───────────────
const _SUB_COL_MAP = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quest:'quetes', panoplie:'panoplies' };
// Ajoute un bouton Creator à gauche du ✏️ dans une ligne de liste
function _addCreatorBtn(row, creatorType, data) {
  const editBtn = row.querySelector('.ed-edit-btn');
  if (!editBtn || !data) return;
  const btn = document.createElement('button');
  btn.className = 'btn btn-ghost';
  btn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
  btn.title = 'Ouvrir dans le Creator';
  btn.textContent = '⚙️';
  btn.setAttribute('draggable', 'false');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    sessionStorage.setItem('editSub', JSON.stringify({ type: creatorType, data }));
    window.open('creator.html');
  });
  editBtn.parentNode.insertBefore(btn, editBtn);
}

// Lit _contributor depuis un doc Firestore — toujours retourne un array (compat vieux format objet)
function _readContribs(data) {
  const c = data?._contributor;
  if (!c) return [];
  return Array.isArray(c) ? c : [c];
}

// Fusionne des contributeurs existants avec un nouveau — dedup par uid puis par name, retourne array.
// Classement : la création d'un document compte 1 ; chaque modification approuvée compte +1 (champ `edits`).
// Un contributeur ajouté par une modification porte `modOnly` : sa 1re modification est alors sa seule contribution.
function _mergeContributors(existing, newContrib, isMod = false) {
  const result = existing.map(c => ({ ...c }));
  const hit = result.find(c =>
    (newContrib.uid && c.uid === newContrib.uid) ||
    (!newContrib.uid && c.name === newContrib.name)
  );
  if (hit) { if (isMod) hit.edits = (hit.edits || 0) + 1; }
  else result.push(isMod ? { ...newContrib, edits: 1, modOnly: true } : newContrib);
  return result.length ? result : [newContrib];
}

_lazyPanel(() => import('./moderation-orders.js?v=669c0ebf'), ['showMobOrder', 'filterMobOrder', 'saveMobOrder', 'showItemOrder', 'filterItemOrder', 'saveItemOrder', 'showPnjOrder', 'filterPnjOrder', 'autoSortPnjOrder', 'savePnjOrder', 'showRegionOrder', 'filterRegionOrder', 'saveRegionOrder', 'showPanoplieOrder', 'renderPanoplieOrder', 'savePanoplieOrder', 'loadMobOrder', 'loadItemOrder', 'loadPnjOrder', 'loadRegionOrder', 'loadPanoplieOrder']);


let _activePanel = 'submissions';
window._modDoRefresh = () => { location.reload(); }; // location.reload() conserve le hash

// ── Hash routing ──────────────────────────────────────
const HASH_PANELS = {
  'submissions':    () => { loadSubmissions(); showSubmissions(); },
  'mob-order':      () => showMobOrder(),
  'item-order':     () => showItemOrder(),
  'pnj-order':      () => showPnjOrder(),
  'region-order':   () => showRegionOrder(),
  'quest-order':    () => showQuestOrder(),
  'panoplie-order': () => showPanoplieOrder(),
  'map':            () => showMapPanel(),
  'passages':       () => { showMapPanel(); switchMapTab('passages'); },
  'trash':          () => showTrash(),
  'diag':           () => showDiagHub(),
  'content':        () => showContentHub(),
  'ghost-ids':      () => showGhostIds(),
  'dead-links':     () => showDeadLinks(),
  'self-craft':     () => showSelfCraft(),
  'orphan-ids':     () => showOrphanIds(),
  'region-orphans': () => showRegionOrphans(),
  'mob-orphans':    () => showMobOrphans(),
  'quest-orphans':  () => showQuestOrphans(),
  'members':        () => showUsersPanel(),
  'leaderboard':    () => showLeaderboard(),
  'permissions':    () => showPermissions(),
  'discord-roles':  () => showDiscordRoles(),
  'completion':       () => showCompletion(),
  'creator-validation': () => showCreatorValidation(),
  'obtain-legacy':     () => showObtainLegacy(),
  'calibrateur':       () => showCalibrateur(),
  'capture-sprites':  () => showCaptureSprites(),
  'data-all':         () => showDataAll(),
  'zones':              () => showZoneEditor(),
  'images':             () => showImagesTool(),
  'zone-list':            () => showZoneList(),
  'effects-tool':         () => showEffectsTool(),
  'events-tool':          () => showEventsTool(),
  'donjons-tool':         () => showDonjonsTool(),
  'worldboss-tool':       () => showWorldbossTool(),
  'secret-forgerons':     () => showSecretForgerons(),
  'discord-routes':       () => showDiscordRoutes(),
  'titres-tool':          () => showTitresTool(),
  'game-config':          () => showGameConfig(),
  'audit-log':            () => showAuditLog(),
  'tags':                 () => showTagsPanel(),
  'statistiques':         () => showStatistiques(),
  'bugs-connus':          () => showBugsConnus(),
  'translations':         () => showTranslations(),
  'api-items':            () => showApiItems(),
  'config':               () => showConfigHub(),
};

function _setHash(hash) {
  history.replaceState(null, '', '#' + hash);
  _activePanel = hash;
  // Cache TOUS les panneaux et désactive TOUS les boutons de filtre —
  // chaque show* n'a plus qu'à afficher son propre panneau et activer son bouton.
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sidebar')?.classList.remove('in-order-panel');
  _syncNavHubs();
}

// Masque tous les panneaux .main, retire tous les actifs de la sidebar,
// puis affiche le panneau et le bouton demandés.
function _showPanel(panelId, btnId) {
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sidebar').classList.remove('in-order-panel');
  const panel = document.getElementById(panelId);
  if (panel) panel.style.display = '';
  if (btnId) {
    const btn = document.getElementById(btnId);
    if (btn) btn.classList.add('active');
  }
  _syncNavHubs();
}

// ── Panneaux chargés à la demande ─────────────────────
// Chaque panneau vit dans son module (moderation-*.js) qui exporte init(ctx) et y définit ses window.*.
// _lazyPanel pose des stubs window.<nom> : au premier appel le module est importé, init(ctx) remplace les stubs
// par les vraies fonctions, puis l'appel est relayé (les onclick="…" du HTML et les appels nus continuent de marcher).
// Les variables modifiables du noyau sont exposées en lecture seule par getters (ctx.role, ctx.user).
// État vide renvoyé à l'éditeur tant que moderation-sensible.js n'est pas chargé
const _sensDefault = { itemsHidden: [], itemsSecretById: new Map(), itemsPublic: [], mobsSecret: [], mobsPublic: [], pnjSecret: [], pnjPublic: [] };
let _panelCtx = null;
function _getPanelCtx() {
  return _panelCtx ??= {
    db, collection, getDocs, getDoc, doc, query, orderBy, where, limit, updateDoc, setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp,
    deleteField, ROLES, anonName, invalidateCache, hashName, sanitizeForFirestore, loadEventNames, WORKER_URL,
    getWorkerSecret: _getWorkerSecret, loadExternalScript: _loadExternalScript,
    toast, modal, store, escHtml, COL, get MANAGED_TIERS() { return MANAGED_TIERS; },
    setHash: _setHash, showPanel: _showPanel, cachedDocs, invalidateModCache, writeAudit: _writeAudit,
    get role() { return currentRole; },
    get user() { return currentUser; },
    userNames: _userNames,
    get allSubs() { return _st.all; },
    st: _st, modCache: _modCache, _mergeContributors, loadCollection,
    get customRoles() { return _shared.roles?.customRoles ?? []; },
    _SUB_COL_MAP, generateCardBlob, auth, roleLevel, TIER_FIRESTORE, TIER_DEFAULTS,
    getTierDisplay: _getTierDisplay,
    ed: _ed, orderData: _orderData, getItemGameplayKeys, desanitizeFromFirestore, get sensState() { return _shared.sens?.state ?? _sensDefault; },
    _regionName, _readContribs, _COL_LABELS, _slugName, _renamedItemId, _renameImagePaths, _toastImageRenames,
    _syncPnjObtain: (...a) => window._syncPnjObtain(...a), _syncMobObtain: (...a) => window._syncMobObtain(...a), _syncItemObtain: (...a) => window._syncItemObtain(...a),
    _recordItemRename: (...a) => window._recordItemRename(...a), _renameItemReferences: (...a) => window._renameItemReferences(...a),
    renderSubs: (...a) => window.renderSubs(...a), hasRole, addCreatorBtn: _addCreatorBtn, edCache: _edCache, shared: _shared,
    get creatorPaliers() { return CREATOR_PALIERS; },
    get paliersConfig() { return _paliersConfig; },
    get paliersOpts() { return _paliersOpts; },
    applyPaliers: list => { _paliersConfig = list; CREATOR_PALIERS = list.map(p => p.id); _paliersOpts = list.map(p => [p.id, p.label]); },
    populateAllPalierSelects: _populateAllPalierSelects,
  };
}
function _lazyPanel(load, names) {
  let p = null;
  const ensure = () => p ??= load().then(m => m.init(_getPanelCtx())).catch(e => { p = null; throw e; });
  for (const n of names) {
    const stub = async (...a) => {
      await ensure();
      if (window[n] === stub) throw new Error('Panneau mal initialisé : window.' + n);
      return window[n](...a);
    };
    window[n] = stub;
  }
}

// ── Hubs de navigation (onglets) ──────────────────────
// Un seul bouton sidebar par hub ; chaque panneau membre reçoit une barre d'onglets.
// Les anciens boutons restent dans le DOM (cachés) : les show* référencent leurs IDs,
// leur display propre porte les permissions (tool_*, data-min-role) et leurs badges
// alimentent les onglets.
const NAV_HUBS = [
  { key: 'diag', btn: 'btn-diag-hub', badge: 'count-diag-hub', legacy: 'diag-legacy-btns', def: 'dead-links',
    groups: [
      { label: 'Références', tabs: [
        { hash: 'dead-links',  label: '💀 Liens morts',        btn: 'btn-dead-links',  panel: 'dead-links-panel',  fn: () => showDeadLinks() },
        { hash: 'ghost-ids',   label: '🔗 IDs fantômes',       btn: 'btn-ghost-ids',   panel: 'ghost-id-panel',    fn: () => showGhostIds() },
        { hash: 'orphan-ids',  label: '⚠️ IDs orphelins',      btn: 'btn-orphan-ids',  panel: 'orphan-ids-panel',  fn: () => showOrphanIds(),  count: 'count-orphan-ids' },
        { hash: 'self-craft',  label: '🔁 Crafts circulaires', btn: 'btn-self-craft',  panel: 'self-craft-panel',  fn: () => showSelfCraft() },
      ]},
      { label: 'Rattachement', tabs: [
        { hash: 'region-orphans', label: '🗺️ Régions orphelines', btn: 'btn-region-orphans', panel: 'region-orphan-panel', fn: () => showRegionOrphans() },
        { hash: 'mob-orphans',    label: '👾 Mobs orphelins',     btn: 'btn-mob-orphans',    panel: 'mob-orphan-panel',    fn: () => showMobOrphans() },
        { hash: 'quest-orphans',  label: '📋 Quêtes orphelines',  btn: 'btn-quest-orphans',  panel: 'quest-orphan-panel',  fn: () => showQuestOrphans() },
      ]},
      { label: 'Complétude', tabs: [
        { hash: 'completion',          label: '🎯 Tableau de Chasse', btn: 'btn-completion',         panel: 'completion-panel',         fn: () => showCompletion(), count: 'count-incomplete' },
        { hash: 'obtain-legacy',       label: '🗂️ Obtentions libres', btn: 'btn-obtain-legacy',      panel: 'obtain-legacy-panel',      fn: () => showObtainLegacy(), count: 'count-obtain-legacy' },
        { hash: 'creator-validation',  label: '⚙️ Champs requis',     btn: 'btn-creator-validation', panel: 'creator-validation-panel', fn: () => showCreatorValidation() },
      ]},
    ]},
  { key: 'content', btn: 'btn-content-hub', badge: null, legacy: 'content-legacy-btns', def: 'data-all',
    groups: [
      { label: "Vue d'ensemble", tabs: [
        { hash: 'data-all', label: '🗂️ Data', btn: 'btn-data-all', panel: 'data-all-panel', fn: () => showDataAll() },
      ]},
      { label: "Ordre d'affichage", tabs: [
        { hash: 'item-order',     label: '⚔️ Items',     btn: 'btn-item-order',     panel: 'item-order-panel',     fn: () => showItemOrder() },
        { hash: 'mob-order',      label: '🔢 Mobs',      btn: 'btn-mob-order',      panel: 'mob-order-panel',      fn: () => showMobOrder() },
        { hash: 'pnj-order',      label: '🧑 PNJ',       btn: 'btn-pnj-order',      panel: 'pnj-order-panel',      fn: () => showPnjOrder() },
        { hash: 'region-order',   label: '📍 Régions',   btn: 'btn-region-order',   panel: 'region-order-panel',   fn: () => showRegionOrder() },
        { hash: 'quest-order',    label: '📜 Quêtes',    btn: 'btn-quest-order',    panel: 'quest-order-panel',    fn: () => showQuestOrder() },
        { hash: 'panoplie-order', label: '🔗 Panoplies', btn: 'btn-panoplie-order', panel: 'panoplie-order-panel', fn: () => showPanoplieOrder() },
      ]},
      { label: 'Source externe', tabs: [
        { hash: 'api-items', label: '🔌 API', btn: 'btn-api-items', panel: 'api-items-panel', fn: () => showApiItems() },
      ]},
    ]},
  { key: 'map', btn: 'btn-map-hub', badge: null, legacy: 'map-legacy-btns', def: 'map',
    groups: [
      { label: 'Pins', tabs: [
        { hash: 'map', label: '📍 Pins & types', btn: 'btn-map-order', panel: 'map-panel', fn: () => showMapPanel() },
      ]},
      { label: 'Zones de monstres', tabs: [
        { hash: 'zone-list', label: '💀 Liste',   btn: 'btn-zone-list',   panel: 'zone-list-panel',   fn: () => showZoneList() },
        { hash: 'zones',     label: '✏️ Éditeur', btn: 'btn-zone-editor', panel: 'zone-editor-panel', fn: () => showZoneEditor() },
      ]},
    ]},
  { key: 'admin', btn: 'btn-admin-hub', badge: null, legacy: 'admin-legacy-btns', def: 'members',
    groups: [
      { label: 'Membres', tabs: [
        { hash: 'members',     label: '👥 Membres',      btn: 'btn-users',       panel: 'users-panel',       fn: () => showUsersPanel() },
        { hash: 'leaderboard', label: '🏆 Leaderboard',  btn: 'btn-leaderboard', panel: 'leaderboard-panel', fn: () => showLeaderboard() },
        { hash: 'permissions', label: '🔑 Permissions',  btn: 'btn-permissions', panel: 'permissions-panel', fn: () => showPermissions() },
        { hash: 'discord-roles', label: '🎮 Rôles Discord', btn: 'btn-discord-roles', panel: 'discord-roles-panel', fn: () => showDiscordRoles() },
      ]},
      { label: 'Suivi', tabs: [
        { hash: 'audit-log',   label: "📋 Journal d'audit", btn: 'btn-audit-log',   panel: 'audit-log-panel',   fn: () => showAuditLog() },
        { hash: 'statistiques', label: '📊 Statistiques',   btn: 'btn-statistiques', panel: 'panel-statistiques', fn: () => showStatistiques() },
        { hash: 'trash',       label: '🗑️ Corbeille',       btn: 'btn-trash',       panel: 'trash-panel',       fn: () => showTrash(), count: 'count-trash' },
      ]},
    ]},
  { key: 'config', btn: 'btn-config-hub', badge: null, legacy: 'config-legacy-btns', def: 'game-config',
    groups: [
      { label: 'Règles du jeu', tabs: [
        { hash: 'game-config',  label: '🌍 Config Jeu', btn: 'btn-game-config',  panel: 'game-config-panel',  fn: () => showGameConfig() },
        { hash: 'effects-tool', label: '✨ Effets',     btn: 'btn-effects-tool', panel: 'effects-tool-panel', fn: () => showEffectsTool() },
        { hash: 'events-tool',  label: '🎪 Events',     btn: 'btn-events-tool',  panel: 'events-tool-panel',  fn: () => showEventsTool() },
        { hash: 'donjons-tool', label: '🏰 Donjons',    btn: 'btn-donjons-tool', panel: 'donjons-tool-panel', fn: () => showDonjonsTool() },
        { hash: 'worldboss-tool', label: '🌍 Worldboss', btn: 'btn-worldboss-tool', panel: 'worldboss-tool-panel', fn: () => showWorldbossTool() },
        { hash: 'secret-forgerons', label: '🔮 Forgerons secrets', btn: 'btn-secret-forgerons', panel: 'secret-forgerons-panel', fn: () => showSecretForgerons() },
        { hash: 'discord-routes', label: '📣 Discord', btn: 'btn-discord-routes', panel: 'discord-routes-panel', fn: () => showDiscordRoutes() },
        { hash: 'titres-tool',  label: '🏅 Titres',     btn: 'btn-titres-tool',  panel: 'titres-tool-panel',  fn: () => showTitresTool() },
        { hash: 'tags',         label: '🏷️ Tags',       btn: 'btn-tags',         panel: 'tags-panel',         fn: () => showTagsPanel() },
      ]},
      { label: 'Communication', tabs: [
        { hash: 'bugs-connus',  label: '🐛 Bugs connus',      btn: 'btn-bugs-connus',      panel: 'bugs-connus-panel',      fn: () => showBugsConnus() },
        { hash: 'translations', label: '🌐 Traduction',       btn: 'btn-translations',     panel: 'translations-panel',     fn: () => showTranslations(), count: 'count-translations' },
      ]},
    ]},
  { key: 'studio', btn: 'btn-studio-hub', badge: null, legacy: 'studio-legacy-btns', def: 'images',
    groups: [
      { label: 'Assets', tabs: [
        { hash: 'images',          label: '🖼️ Images',          btn: 'btn-images-tool',     panel: 'images-tool-panel', fn: () => showImagesTool() },
        { hash: 'capture-sprites', label: '📸 Capture Sprites', btn: 'btn-capture-sprites', panel: 'capture-panel',     fn: () => showCaptureSprites() },
      ]},
      { label: '3D', tabs: [
        { hash: 'calibrateur',     label: '🎮 Calibrateur 3D',  btn: 'btn-calibrateur',     panel: 'calibrateur-panel', fn: () => showCalibrateur() },
      ]},
    ]},
];
for (const h of NAV_HUBS) { h.tabs = h.groups.flatMap(g => g.tabs); h.last = h.def; }

const _hubByKey = k => NAV_HUBS.find(h => h.key === k);

function _hubTabVisible(t) {
  const b = document.getElementById(t.btn);
  return !!b && b.style.display !== 'none';
}

function _hubBadgeText(t) {
  const el = t.count && document.getElementById(t.count);
  return el && el.style.display !== 'none' && el.textContent.trim() !== '0' ? el.textContent.trim() : '';
}

function _renderHubTabs(hub) {
  for (const t of hub.tabs) {
    const panel = document.getElementById(t.panel);
    if (!panel) continue;
    let bar = panel.querySelector(':scope > .diag-tabs');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'diag-tabs';
      panel.prepend(bar);
    }
    bar.innerHTML = hub.groups.map(g => {
      const tabs = g.tabs.filter(_hubTabVisible);
      if (!tabs.length) return '';
      return `<div class="diag-group"><span class="diag-group-label">${g.label}</span>` + tabs.map(x => {
        const badge = _hubBadgeText(x);
        return `<button class="diag-tab${x.hash === t.hash ? ' active' : ''}" data-hub="${hub.key}" data-tab="${x.hash}">${x.label}${badge ? ` <span class="filter-count">${badge}</span>` : ''}</button>`;
      }).join('') + '</div>';
    }).join('');
  }
  const hubBtn = document.getElementById(hub.btn);
  if (hubBtn) hubBtn.style.display = hub.tabs.some(_hubTabVisible) ? '' : 'none';
  if (hub.badge) {
    const total = hub.tabs.reduce((n, t) => n + (parseInt(_hubBadgeText(t), 10) || 0), 0);
    const el = document.getElementById(hub.badge);
    if (el) { el.textContent = total; el.style.display = total > 0 ? '' : 'none'; }
  }
}

function _syncNavHubs() {
  for (const hub of NAV_HUBS) {
    const btn = document.getElementById(hub.btn);
    if (!btn) continue;
    const inHub = hub.tabs.some(t => t.hash === _activePanel);
    if (inHub) hub.last = _activePanel;
    btn.classList.toggle('active', inHub);
    _renderHubTabs(hub);
  }
}

function _showHub(hub) {
  const t = hub.tabs.find(x => x.hash === hub.last && _hubTabVisible(x)) || hub.tabs.find(_hubTabVisible);
  if (t) t.fn();
}

document.addEventListener('click', e => {
  const tab = e.target.closest?.('.diag-tab');
  if (!tab) return;
  NAV_HUBS.find(h => h.key === tab.dataset.hub)?.tabs.find(t => t.hash === tab.dataset.tab)?.fn();
});

// Les badges (alimentés par les loaders existants) rafraîchissent les onglets
for (const hub of NAV_HUBS) {
  const legacy = document.getElementById(hub.legacy);
  if (legacy) new MutationObserver(() => _renderHubTabs(hub)).observe(legacy, {
    subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ['style'],
  });
}

window.showDiagHub    = () => _showHub(_hubByKey('diag'));
window.showContentHub = () => _showHub(_hubByKey('content'));
window.showMapHub     = () => _showHub(_hubByKey('map'));
window.showAdminHub   = () => _showHub(_hubByKey('admin'));
window.showConfigHub  = () => _showHub(_hubByKey('config'));
window.showStudioHub  = () => _showHub(_hubByKey('studio'));

function _routeToHash() {
  const hash = location.hash.slice(1) || 'submissions';
  loadSubmissions(); // toujours charger les soumissions en fond
  _refreshOrphanCount(); // badge IDs orphelins
  const fn = HASH_PANELS[hash];
  if (fn) fn();
}

window.addEventListener('hashchange', () => {
  if (document.getElementById('main-layout').style.display === 'none') return;
  _routeToHash();
});

function refreshCurrentPanel() {
  const refreshMap = {
    quest:          () => { delete _modCache['quetes'];      loadQuestOrder();    },
    region:         () => { delete _modCache['regions'];     loadRegionOrder();   },
    mob:            () => { delete _modCache['mobs'];        loadMobOrder();      },
    item:           () => { delete _modCache['items'];       loadItemOrder();     },
    pnj:            () => { delete _modCache['personnages']; loadPnjOrder();      },
    panoplie:       () => { delete _modCache['panoplies'];   loadPanoplieOrder(); },
    map:            () => { switchMapTab('allpins'); },
    'ghost-ids':    () => loadGhostIds(),
    'dead-links':   () => loadDeadLinks(),
    'orphan-ids':   () => loadOrphanIds(),
    'region-orphans': () => loadRegionOrphans(),
    'mob-orphans':  () => loadMobOrphans(),
    'quest-orphans': () => loadQuestOrphans(),
    submissions:    () => loadSubmissions(),
    'data-all':     () => loadDataAll(),
  };
  (refreshMap[_activePanel] || refreshMap.submissions)();
}

window.showSubmissions = function showSubmissions() {
  _setHash('submissions');
  document.getElementById('submissions-list').style.display = '';
  // _setHash efface tous les .filter-btn actifs — restaurer le bon état
  document.querySelectorAll('.filter-btn[data-status]').forEach(b =>
    b.classList.toggle('active', b.dataset.status === _st.status)
  );
  const sel = document.getElementById('filter-type-select');
  if (sel) sel.value = _st.type;
}


_lazyPanel(() => import('./moderation-integrity.js?v=7fccedbe'), ['showGhostIds', 'showSelfCraft', 'showDeadLinks', 'showOrphanIds', '_goToSubmission', 'showRegionOrphans', 'loadRegionOrphans', 'showMobOrphans', 'loadMobOrphans', 'loadDeadLinks', 'loadOrphanIds', '_refreshOrphanCount', 'loadGhostIds']);


// ══════════════════════════════════════════════════════
// ÉDITEUR DE DONNÉES
// ══════════════════════════════════════════════════════
// État de l'éditeur de données (moderation-editor.js) lu aussi par approve (renommage d'ID)
const _ed = { collection: null, id: null, origin: null, origData: null };

const _COL_LABELS = { items:'Item', mobs:'Mob', personnages:'PNJ', regions:'Région', panoplies:'Panoplie', quetes:'Quête', items_sensible:'Item Sensible', mobs_secret:'Mob Sensible', pnj_secret:'PNJ Sensible', map_markers:'Marqueur Carte' };

// Caches de l'éditeur (listes de régions / sets), invalidés aussi par moderation-orders.js
const _edCache = { regions: null, sets: null };
// État partagé entre modules (posé par les panneaux au chargement : voir _orderData)
const _shared = {};
const _orderData = k => _shared[k]?.data ?? [];

_lazyPanel(() => import('./moderation-editor.js?v=7d94172e'), ['cpSvDown', 'cpHueDown', 'cpHexInput', 'cpRgbInput', 'edPickPreset', 'edSwitchTab', 'edAddGenField', 'edRenameField', 'edDelGenRow', 'edOpenRegions', 'edCloseRegions', 'edFilterRegions', 'edSelectRegion', 'showEditor', 'editorGoBack', 'saveEditor', 'deleteCurrentEntry']);



const _ee = escHtml;

// ── Renommage d'item : l'ID suit le nom, et tout ce qui référence l'ancien ID est mis à jour ──
function _slugName(name) {
  return normalize(String(name || '').replace(/\s*\[qualit[eé]\]\s*/gi, ' ').trim())
    .replace(/['\u2019\u2018`]/g, '_').replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
}
// Nouvel ID = slug du nouveau nom + le suffixe de l'ancien ID (_p1, _p2_2, _event…). null = rien à changer ou suffixe introuvable.
function _renamedItemId(oldId, oldName, newName) {
  const os = _slugName(oldName), ns = _slugName(newName);
  if (!ns || !oldId || os === ns) return null;
  let suffix = null;
  if (os && oldId.startsWith(os) && (oldId.length === os.length || oldId[os.length] === '_')) suffix = oldId.slice(os.length);
  else { const m = String(oldId).match(/(_(?:qualite_)?p\d+(?:_\d+)?|_event|_archive)$/); if (m) suffix = m[1]; }
  if (suffix === null) return null;
  const id = ns + suffix;
  return id === oldId ? null : id;
}

// Remplace l'ancien ID par le nouveau partout où il est utilisé comme valeur : crafts et évolutions des autres items, loot des mobs,
// ventes des PNJ, récompenses de quêtes, panoplies, builds publiés, soumissions en attente, réglages… Retourne le nombre de documents modifiés.
// Chemins de textures : …/ancien_id.png devient …/nouvel_id.png. Retourne les nouveaux chemins et les paires [ancien, nouveau] (le FICHIER
// du dépôt doit porter le nouveau nom : la modération ne peut pas renommer un fichier du site).
function _renameImagePaths(images, oldId, newId) {
  const pairs = [];
  const esc = String(oldId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp('([\\/])' + esc + '(\\.[A-Za-z0-9]+)$');
  const out = (Array.isArray(images) ? images : []).map(p => {
    if (typeof p !== 'string' || !re.test(p)) return p;
    const np = p.replace(re, '$1' + newId + '$2');
    pairs.push([p, np]);
    return np;
  });
  return { images: out, pairs };
}
const _toastImageRenames = pairs => pairs.length && toast(
  '🖼️ Texture : le chemin a changé. Renomme le fichier dans le dépôt (img/…) : ' + pairs.map(([a, b]) => `${a.split('/').pop()} → ${b.split('/').pop()}`).join(', '),
  'warning', 14000);

_lazyPanel(() => import('./moderation-item-sync.js?v=3d35868a'), ['_syncPnjObtain', '_syncMobObtain', '_syncItemObtain', '_recordItemRename', '_renameItemReferences']);



_lazyPanel(() => import('./moderation-trash.js?v=6311a2da'), ['showTrash', 'loadTrash', 'restoreFromTrash', 'permanentDeleteTrash', 'emptyTrash']);


let CREATOR_PALIERS = [1, 2, 3]; // mis à jour dynamiquement depuis Firestore config/paliers
let _paliersOpts = null; // options du champ palier (null = défaut du Tableau de chasse), lu par moderation-quality.js
let _paliersConfig = []; // données complètes { id, label, color, floorName }
_lazyPanel(() => import('./moderation-roles.js?v=1d2f83bc'), ['showPermissions', 'loadPermissions', '_setPermission', '_setCustomRoleBaseTier', 'showDiscordRoles', 'loadDiscordRoles', 'saveDiscordRoles', 'togglePermTech', '_setCollectionPerm', 'loadRoles', 'showCreateRoleForm', 'hideCreateRoleForm', 'createRole', 'deleteRole', 'showGenerateRulesModal', 'closeRulesModal', 'copyGeneratedRules', 'toggleCreatorTool', 'toggleCreatorPalier']);


async function _loadPaliersConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'paliers'));
    if (snap.exists() && Array.isArray(snap.data().paliers) && snap.data().paliers.length) {
      _paliersConfig = snap.data().paliers;
      CREATOR_PALIERS = _paliersConfig.map(p => p.id);
      // Options du champ palier du Tableau de chasse (moderation-quality.js)
      _paliersOpts = _paliersConfig.map(p => [p.id, p.label]);
    }
  } catch(e) {
    console.warn('[mod] config/paliers non chargée:', e);
  }
}

function _populateAllPalierSelects() {
  const paliers = _paliersConfig.length ? _paliersConfig
    : [{ id:1, label:'Palier 1' }, { id:2, label:'Palier 2' }, { id:3, label:'Palier 3' }];
  const selectIds = [
    'map-filter-floor', 'map-form-floor', 'ap-filter-floor', 'dw-pub-palier',
    'zl-filter-floor', 'ze-floor', 'qm-filter-floor', 'data-all-palier'
  ];
  for (const id of selectIds) {
    const sel = document.getElementById(id);
    if (!sel) continue;
    const currentVal = sel.value;
    const firstOpt = sel.options[0]?.value === '' ? sel.options[0].cloneNode(true) : null;
    sel.innerHTML = '';
    if (firstOpt) sel.appendChild(firstOpt);
    for (const p of paliers) {
      const opt = document.createElement('option');
      opt.value = String(p.id);
      opt.textContent = p.label;
      sel.appendChild(opt);
    }
    if (currentVal) sel.value = currentVal;
  }
}


_lazyPanel(() => import('./moderation-discord.js?v=a0debecd'), ['showDiscordWebhooks', 'discordRenderSync', 'discordSyncItem', 'discordAutoSync', 'discordCancelBulk', 'discordResendAll', 'discordResendChannel', 'discordResendItem', 'discordDeletePost', 'discordDeleteAllPosts', 'discordDeleteChannelPosts', 'discordRestoreVisibility', 'discordSendMissing', 'discordSearchItems', 'discordFilterPosts', 'loadDiscordWebhooks', 'deleteChannelPosts', 'saveDiscordWebhooks', 'switchDwTab', 'dwEmbedRemove', 'dwEmbedAdd', 'dwUnsentCheckAll', 'dwUnsentDelete', 'dwPublishUnsentSend', 'dwPublishFilter', 'dwPublishCheckAll', 'dwPublishSelected', 'reorderAllChannelTags', 'testNewSubmissionWebhook', 'testDiscordWebhook']);


// ── Gestion des Rôles ─────────────────────────────────
// admin = fixe. visiteur/membre/contributeur = éditables comme des rôles custom.
const TIER_FIRESTORE = ['visiteur', 'membre', 'contributeur', 'admin'];
const TIER_DEFAULTS = {
  visiteur:     { label: 'Visiteur',     emoji: '👤', color: '#4ade80' },
  membre:       { label: 'Membre',       emoji: '⭐', color: '#60a5fa' },
  contributeur: { label: 'Contributeur', emoji: '🔨', color: '#f59e0b' },
  admin:        { label: 'Admin',        emoji: '👑', color: '#f87171' },
};
// IDs des tiers Firestore non-admin gérés comme rôles standards
const MANAGED_TIERS = ['visiteur', 'membre', 'contributeur'];


function _getTierDisplay(id) {
  const cr = (_shared.roles?.customRoles ?? []).find(r => r.id === id);
  if (cr) return { label: cr.label, emoji: cr.emoji, color: cr.color };
  return TIER_DEFAULTS[id] || { label: id, emoji: '?', color: '#888' };
}



_lazyPanel(() => import('./moderation-quests.js?v=4dbe13c5'), ['showQuestOrder', 'renderQuestOrder', 'showQuestOrphans', 'loadQuestOrphans', 'saveQuestOrder', 'loadQuestOrder']);


_lazyPanel(() => import('./moderation-users.js?v=e7d486e9'), ['showUsersPanel', 'loadUsers', 'filterUsers', 'suspendUser', 'unsuspendUser', 'setUserRole', 'deleteUserAccount']);


_lazyPanel(() => import('./moderation-leaderboard.js?v=6ffaeb75'), ['showLeaderboard', 'loadLeaderboard', 'resetHomeLeaderboard', 'undoHomeLeaderboardReset', 'showLeaderboardUser', 'openLbMigrateDialog', 'closeLbMigrateDialog', 'lbMigrateSearchUsers', 'confirmLbMigrate']);



_lazyPanel(() => import('./moderation-audit.js?v=24907cd5'), ['showAuditLog', 'loadAuditLog', 'renderAuditLog', 'loadAuditLogMore']);

_lazyPanel(() => import('./moderation-stats.js?v=99e636bd'), ['resetStatistiques', 'showStatistiques', 'loadStatistiques']);


_lazyPanel(() => import('./moderation-tags.js?v=922eadc4'), ['showTagsPanel', 'updateTagRuleValueOptions', 'loadTagRules', 'addTagRule', 'deleteTagRule', 'seedDefaultTagRules', 'applyTagRules']);


// ── Sidebar section toggle ─────────────────────────────
window.toggleSidebarSection = (id) => {
  const sec  = document.getElementById(id);
  if (!sec) return;
  const body = sec.querySelector('.sidebar-sec-body');
  const chev = sec.querySelector('.sidebar-chev');
  const open = sec.classList.toggle('open');
  if (body) body.style.display = open ? '' : 'none';
  if (chev) chev.textContent   = open ? '▾' : '▸';
};

_lazyPanel(() => import('./moderation-quality.js?v=8acdd552'), ['showCompletion', 'loadCompletion', 'renderCompletion', 'ignoreCompletionDoc', 'unignoreCompletionDoc', 'saveTableauDeChasse', 'saveCompletionFields', 'openCompletionInCreator', 'showCreatorValidation', 'loadCreatorValidation', '_setCvMode', '_setCvSubMode', '_onCvToggle', 'saveCreatorValidation']);


// ── Auto-scroll pendant le drag dans n'importe quelle liste draggable ──
(() => {
  const EDGE = 60;      // zone d'activation en pixels depuis le bord
  const MAX_SPEED = 18; // vitesse max en pixels par frame
  let rafId = null;
  let targetEl = null;
  let dy = 0;
  let dragging = false;

  const findScrollableAncestor = (el) => {
    while (el && el !== document.body && el !== document.documentElement) {
      const cs = getComputedStyle(el);
      const canScroll = /(auto|scroll|overlay)/.test(cs.overflowY);
      if (canScroll && el.scrollHeight > el.clientHeight) return el;
      el = el.parentElement;
    }
    return document.scrollingElement || document.documentElement;
  };

  const step = () => {
    if (!dragging || !targetEl || !dy) { rafId = null; return; }
    targetEl.scrollTop += dy;
    rafId = requestAnimationFrame(step);
  };

  document.addEventListener('dragstart', () => { dragging = true; }, true);
  const stopScroll = () => {
    dragging = false; dy = 0; targetEl = null;
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  };
  document.addEventListener('dragend',  stopScroll, true);
  document.addEventListener('drop',     stopScroll, true);

  document.addEventListener('dragover', (e) => {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const scroller = el ? findScrollableAncestor(el) : null;
    if (!scroller) { dy = 0; return; }
    targetEl = scroller;
    const rect = scroller === document.scrollingElement || scroller === document.documentElement
      ? { top: 0, bottom: window.innerHeight }
      : scroller.getBoundingClientRect();
    const y = e.clientY;
    if (y - rect.top < EDGE) {
      dy = -Math.ceil(MAX_SPEED * (1 - (y - rect.top) / EDGE));
    } else if (rect.bottom - y < EDGE) {
      dy =  Math.ceil(MAX_SPEED * (1 - (rect.bottom - y) / EDGE));
    } else {
      dy = 0;
    }
    if (dy && !rafId) rafId = requestAnimationFrame(step);
  }, true);

  // Pendant un drag, certains navigateurs bloquent le wheel natif → on scroll nous-mêmes
  document.addEventListener('wheel', (e) => {
    if (!dragging) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const scroller = el ? findScrollableAncestor(el) : null;
    if (!scroller) return;
    scroller.scrollTop += e.deltaY;
    e.preventDefault();
  }, { capture: true, passive: false });
})();

_lazyPanel(() => import('./moderation-images.js?v=f9a6d1cd'), ['showImagesTool', 'loadImagesTool', 'saveImagesConfig', 'imgFileDrop', 'imgFileSelect', 'imgUploadToGithub', 'resetImagesTool', 'switchImgTab', 'tpkOpenLightbox', 'tpkLbClose', 'tpkLbBgDown', 'tpkLoadZip', 'tpkRefreshGithub', 'tpkSelToInutile', 'tpkSelToIllisible', 'tpkSelClear', 'tpkRender', 'tpkLeftMore', 'tpkCreateVFolder', 'tpkDeleteVFolder', 'tpkCollapseAll', 'tpkVisualMatch', 'tpkMatchUpdateCount', 'tpkMatchSelectAll', 'tpkMatchApply', 'tpkSaveReference', 'previewNormalize', 'runNormalize', 'showCalibrateur', 'showCaptureSprites']);
_lazyPanel(() => import('./moderation-obtain-legacy.js?v=f9522b63'), ['showObtainLegacy', 'loadObtainLegacy', 'filterObtainLegacy']);
_lazyPanel(() => import('./moderation-data-all.js?v=52fe6b52'), ['showDataAll', 'loadDataAll', 'onDataAllTypeChange', 'renderDataAll', 'deleteDataDuplicates']);


_lazyPanel(() => import('./moderation-map.js?v=3b718245'), ['showMapPanel', 'deleteMapMarker', 'showZoneEditor', 'zeZoom', 'zeZoomReset', 'zeLayerChange', 'zeFloorChange', 'zeRenderSvg', 'zeRemovePoint', 'zeCheckSave', 'zoneEditorReset', 'zoneEditorSave', 'zeSearchMob', 'zeAddMobFromSelect', 'zeAddMob', 'zeRemoveMob', 'zeRenderMobList', 'showZoneList', 'loadZoneList', 'renderZoneList', 'migrateHardcodedZones', 'switchMapTab', 'loadPassages', 'renderPassageList', 'pgValidate', 'pgReset', 'pgSearchPins', 'pgAddLink', 'pgRemoveLink', 'saveNewPassage', 'deletePassage', 'loadAllMapPins', 'renderAllMapPins', 'loadPinColors', 'savePinColors', 'loadPinEmojis', 'savePinEmojis', 'saveIndividualPinEmoji', 'loadPinCategories', 'savePinCategories', 'loadPinTypes']);


_lazyPanel(() => import('./moderation-game-config.js?v=499a603d'), ['showGameConfig', 'gcUpdatePalier', 'gcAddPalier', 'gcRemovePalier', 'saveGameConfig']);


_lazyPanel(() => import('./moderation-game-tools.js?v=5b63ecd5'), ['showEventsTool', 'moveVclEvent', 'createVclEvent', 'deleteVclEvent', 'setVclEventEmoji', 'showWorldbossTool', 'setVclWorldbossEmoji', 'showSecretForgerons', 'setSecretForgeronsHidden', 'showDiscordRoutes', 'setDiscordRoute', 'setDiscordEnabled', 'showDonjonsTool', 'createVclDonjon', 'moveVclDonjon', 'deleteVclDonjon', 'showTitresTool', 'createVclTitre', 'addVclTitreStat', 'removeVclTitreStat', 'renameVclTitre', 'moveVclTitre', 'deleteVclTitre', 'showEffectsTool', 'seedEffectTypes', 'saveEffectTypes', 'switchEffectsTab', 'addEffectType', 'addEffectTemplate']);


_lazyPanel(() => import('./moderation-bugs.js?v=0490d991'), ['showBugsConnus', '_loadBugsConnus', 'saveBugForm', 'startEditBug', 'cancelEditBug', 'saveEditBug', 'deleteBug']);

_lazyPanel(() => import('./moderation-translations.js?v=7dc401a8'), ['showTranslations', '_loadTranslations', 'trDecide', 'trAcceptAll', 'trSetStatus', 'trSearch', 'trExport', 'trClean']);

// ══════════════════════════════════════════════════════
//  ONGLET API (items SAO) — logique dans moderation-api-items.js
// ══════════════════════════════════════════════════════
let _apiItemsTool = null;
window.showApiItems = async function showApiItems() {
  _setHash('api-items');
  _showPanel('api-items-panel', 'btn-api-items');
  const { createApiItemsTool } = await import('./moderation-api-items.js?v=836e72a6');
  _apiItemsTool ??= createApiItemsTool({
    db, doc, setDoc, updateDoc, getDoc, writeBatch, serverTimestamp, deleteField,
    cachedDocs, invalidateModCache, store, COL, toast, modal,
    writeAudit: _writeAudit, mergeContributors: _mergeContributors, readContribs: _readContribs,
    getUser: () => ({ uid: currentUser?.uid, name: _userNames.get(currentUser?.uid) || currentUser?.email }),
  });
  await _apiItemsTool.show();
};

// Couche « qualité des données » : observe les onglets-listes dès le chargement, donc importée tout de suite (et non au premier clic)
import('./moderation-dq.js?v=e70bf703').then(m => m.init(_getPanelCtx())).catch(e => console.warn('[mod] couche qualité indisponible', e));

