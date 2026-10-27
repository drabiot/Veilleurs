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
let allSubs      = [];
window._allSubsForVerify = () => allSubs; // lu par submission-verify.js
let filterStatus = 'pending';
let filterType   = 'all';
let filterSearch = '';
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

// ── Load submissions ──────────────────────────────────
async function fetchUserNames(uids) {
  await Promise.all(uids.map(async uid => {
    if (_userNames.has(uid)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      _userNames.set(uid, snap.exists() ? (snap.data().pseudo || snap.data().displayName || null) : null);
    } catch { _userNames.set(uid, null); }
  }));
}

function userName(uid, fallback) {
  // Pas de compte → "pseudo (invité)"
  if (!uid) return fallback ? `${fallback} (invité)` : '— (invité)';
  if (fallback) return fallback;
  const name = _userNames.get(uid);
  return name || uid.slice(0, 8) + '…';
}

window.loadSubmissions = async () => {
  document.getElementById('submissions-list').innerHTML = '<div class="empty">Chargement…</div>';
  try {
    let snap;
    try {
      const q = query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'));
      snap = await getDocs(q);
    } catch {
      // Fallback sans orderBy (en cas d'index manquant ou de docs sans submittedAt)
      snap = await getDocs(collection(db, 'submissions'));
    }
    allSubs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    // Trier côté client par submittedAt desc (robuste si certains docs n'ont pas le champ)
    allSubs.sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() ?? a.submittedAt ?? 0;
      const tb = b.submittedAt?.toMillis?.() ?? b.submittedAt ?? 0;
      if (tb !== ta) return tb - ta;
      return a._id < b._id ? -1 : a._id > b._id ? 1 : 0; // tiebreaker stable
    });
    // Pré-charger les pseudos et les panoplies (pour labels sets dans résumé)
    const uids = [...new Set(allSubs.flatMap(s => [s.submittedBy, s.reviewedBy].filter(Boolean)))];
    await Promise.all([
      fetchUserNames(uids).catch(() => {}),
      cachedDocs('panoplies').catch(() => {}),
      // noms et icônes des items cités dans les résumés (cache différentiel : quasi gratuit après la 1re fois)
      _modCache['regions'] ? null : loadCollection(COL.regions).then(arr => { _modCache['regions'] ??= arr.map(d => ({ _docKey: d._id, ...d, id: d.id ?? d._id })); }).catch(() => {}),
      _modCache['items'] ? null : loadCollection(COL.items).then(arr => { _modCache['items'] ??= arr.map(d => ({ _docKey: d._id, ...d, id: d.id ?? d._id })); }).catch(() => {}),
    ]);
    updateCounts();
    renderSubs();
  } catch(e) {
    document.getElementById('submissions-list').innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
  }
};

function updateCounts() {
  const nPending = allSubs.filter(s => s.status === 'pending').length;
  document.getElementById('count-all').textContent      = allSubs.length;
  document.getElementById('count-pending').textContent  = nPending;
  document.getElementById('count-approved').textContent = allSubs.filter(s => s.status === 'approved').length;
  // Title badge
  document.title = nPending > 0 ? `(${nPending}) Modération — VCL` : 'Modération — VCL';
  document.getElementById('count-rejected').textContent           = allSubs.filter(s => s.status === 'rejected').length;
  document.getElementById('count-changes-requested').textContent  = allSubs.filter(s => s.status === 'changes_requested').length;
}

// ── Filters ───────────────────────────────────────────
window.setFilter = (key, val) => {
  showSubmissions();
  if (key === 'status') {
    filterStatus = val;
    document.querySelectorAll('.filter-btn[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === val));
  } else {
    filterType = val;
    const sel = document.getElementById('filter-type-select');
    if (sel) sel.value = val;
  }
  renderSubs();
};

function _buildStatsBar() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); weekAgo.setHours(0, 0, 0, 0);
  const toDate = ts => { if (!ts) return null; return ts.toDate ? ts.toDate() : new Date(ts); };

  const approvedToday = allSubs.filter(s => { const d = toDate(s.reviewedAt); return s.status === 'approved' && d && d >= today; }).length;
  const approvedWeek  = allSubs.filter(s => { const d = toDate(s.reviewedAt); return s.status === 'approved' && d && d >= weekAgo; }).length;
  const nPending = allSubs.filter(s => s.status === 'pending').length;

  const TYPE_LABELS = { item: 'Items', mob: 'Mobs', pnj: 'PNJ', region: 'Régions', quest: 'Quêtes', panoplie: 'Panoplies' };
  const typeCounts = {};
  for (const s of allSubs.filter(s => s.status === 'pending')) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  const typeParts = Object.entries(typeCounts).filter(([, n]) => n > 0).map(([t, n]) => `${TYPE_LABELS[t] || t} ${n}`).join(' · ');

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding:10px 14px;background:var(--surface2,#2a2a3e);border-radius:6px;font-size:12px;color:var(--text-muted,#aaa);border:1px solid var(--border,#333);';
  bar.innerHTML = `<span>📥 En attente : <strong style="color:var(--warn,#f59e0b)">${nPending}</strong></span><span>✅ Approuvées aujourd'hui : <strong style="color:var(--success,#4ade80)">${approvedToday}</strong></span><span>📅 Cette semaine : <strong style="color:var(--success,#4ade80)">${approvedWeek}</strong></span>${typeParts ? `<span style="margin-left:auto;opacity:.75">⏳ ${typeParts}</span>` : ''}`;
  return bar;
}

function renderSubs() {
  const list = document.getElementById('submissions-list');
  let subs = allSubs;
  if (filterStatus !== 'all') subs = subs.filter(s => s.status === filterStatus);
  if (filterType   !== 'all') subs = subs.filter(s => s.type === filterType);
  if (filterSearch) {
    const q = normalize(filterSearch);
    subs = subs.filter(s =>
      fuzzyMatch(q, s.data?.name || s.data?.titre || s.data?.label || '') ||
      fuzzyMatch(q, s.data?.id || '')
    );
  }

  list.innerHTML = '';
  list.appendChild(_buildStatsBar());

  if (!subs.length) {
    list.insertAdjacentHTML('beforeend', '<div class="empty">Aucune soumission dans cette catégorie.</div>');
    return;
  }

  const bulkBar = document.createElement('div');
  bulkBar.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';

  if (filterStatus === 'pending') {
    const approveAllBtn = document.createElement('button');
    approveAllBtn.className = 'btn';
    approveAllBtn.style.cssText = 'font-size:12px;background:var(--success,#4ade80);color:#111;';
    approveAllBtn.textContent = `✅ Tout approuver (${subs.length})`;
    approveAllBtn.addEventListener('click', () => bulkApproveSubs());
    bulkBar.appendChild(approveAllBtn);
  }

  if (filterStatus === 'approved' || filterStatus === 'rejected') {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn btn-danger';
    bulkBtn.style.cssText = 'font-size:12px;';
    bulkBtn.textContent = `🗑️ Tout supprimer (${subs.length})`;
    bulkBtn.addEventListener('click', () => bulkDeleteSubs(filterStatus));
    bulkBar.appendChild(bulkBtn);
  }

  if (bulkBar.children.length) list.appendChild(bulkBar);

  for (const sub of subs) {
    list.appendChild(buildCard(sub));
  }
}

window.setFilterSearch = (val) => {
  filterSearch = val.trim();
  showSubmissions();
  renderSubs();
};

// Ordre canonique des champs pour un affichage stable
const FIELD_ORDER = ['id','name','rarity','category','cat','palier','lvl','twoHanded','sensible',
  'classes','tags','lore','obtain','stats','bonuses','craft','effects','images','inCodex',
  'type','mobType','region','zones','loot','drops','ordre'];

function sortedEntries(obj) {
  const entries = Object.entries(obj);
  entries.sort(([a], [b]) => {
    const ia = FIELD_ORDER.indexOf(a), ib = FIELD_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return entries;
}

function toJSStr(obj, depth = 0) {
  const T = '\t', pad = T.repeat(depth), pad2 = T.repeat(depth + 1);
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    if (obj.every(v => typeof v !== 'object' || v === null)) return '[' + obj.map(v => JSON.stringify(v)).join(', ') + ']';
    return '[\n' + obj.map(v => pad2 + toJSStr(v, depth+1)).join(',\n') + '\n' + pad + ']';
  }
  if (obj !== null && typeof obj === 'object') {
    const entries = sortedEntries(obj);
    if (!entries.length) return '{}';
    const allPrim = entries.every(([,v]) => typeof v !== 'object');
    if (allPrim && entries.length <= 6 && depth > 0) return '{' + entries.map(([k,v]) => `${k}:${JSON.stringify(v)}`).join(', ') + '}';
    return '{\n' + entries.map(([k,v]) => `${pad2}${k}:\t\t${toJSStr(v, depth+1)}`).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(obj);
}

// ── Résumé lisible d'une soumission : champs connus mis en forme à la main, puis TOUS les autres champs ──
const _PRETTY_SKIP = new Set(['_order', 'ordre', '_contributor', '_ts', '_updatedAt', '_id', 'nameHash', 'images', 'image', 'img', 'screenshots']);
const _PRETTY_SHOWN = {
  item:     ['id', 'name', 'quality', 'rarity', 'category', 'palier', 'lvl', 'cat', 'classes', 'set', 'sensible', 'event', 'evolutif', 'stats', 'effects', 'cooldown_apply', 'craft', 'craft_cd', 'craft_qty', 'obtain', 'lore', 'competence', 'tags', 'skill_name', 'skill_rarity'],
  mob:      ['type', 'palier', 'region', 'behavior', 'lore', 'loot'],
  pnj:      ['id', 'name', 'tag', 'type', 'palier', 'region', 'coords', 'craft', 'sells', 'lore', 'instructions', 'underground', 'sensible'],
  region:   ['palier', 'coords', 'inCodex', 'lore'],
  quest:    ['type', 'palier', 'npc', 'zone', 'coords', 'desc', 'objectifs'],
  panoplie: ['bonuses'],
};
const _PRETTY_LABELS = { id: 'ID', name: 'Nom', label: 'Nom', titre: 'Titre', craft: 'Craft', ingredients: 'Ingrédients', tag: 'Type', coords: 'Coords', desc: 'Description', lore: 'Lore', dialogue: 'Dialogue', dialogues: 'Dialogues' };

// id → nom lisible, d'après les collections déjà chargées par la modération
function _prettyName(id) {
  for (const col of ['items', 'mobs', 'personnages', 'quetes', 'panoplies', 'regions']) {
    const hit = (_modCache[col] || []).find(x => (x.id || x._id) === id);
    if (hit) return hit.name || hit.label || hit.titre || null;
  }
  return null;
}
function _prettyId(id, esc) {
  const n = _prettyName(id);
  const code = `<code style="font-size:10px;color:var(--muted);background:rgba(255,255,255,.05);border-radius:3px;padding:1px 5px;">${esc(String(id))}</code>`;
  return n && n !== id ? `${esc(n)} ${code}` : esc(String(id));
}
function _prettyVal(v, esc, depth = 0) {
  if (v == null || v === '' || v === false) return '';
  if (v === true) return '✓';
  if (typeof v !== 'object') return esc(String(v)).replace(/\n/g, '<br>');
  if (Array.isArray(v)) {
    const items = v.filter(x => x != null && x !== '' && x !== false);
    if (!items.length) return '';
    if (items.every(x => typeof x !== 'object')) {
      return items.map(x => `<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 5px;">${esc(String(x))}</span>`).join(' ');
    }
    const chip = depth > 0; // listes imbriquées (ex. ingrédients) : en pastilles ; listes de premier niveau : une ligne par entrée
    return `<div style="display:flex;${chip ? 'flex-wrap:wrap;' : 'flex-direction:column;'}gap:3px;">${items.map(x =>
      `<div style="${chip ? 'background:var(--surface3);border-radius:4px;padding:1px 6px;font-size:11px;' : ''}">${_prettyVal(x, esc, depth + 1)}</div>`).join('')}</div>`;
  }
  const parts = [];
  const qty = v.qty ?? v.qte;
  if (typeof v.id === 'string') parts.push((qty != null ? `<b>×${esc(String(qty))}</b> ` : '') + _prettyId(v.id, esc));
  for (const [k, x] of Object.entries(v)) {
    if (_PRETTY_SKIP.has(k) || k === 'qty' || k === 'qte' || (k === 'id' && typeof x === 'string')) continue;
    const s = _prettyVal(x, esc, depth + 1);
    if (s) parts.push(`<span style="color:var(--muted);font-size:10px;">${esc(_PRETTY_LABELS[k] || k.replace(/_/g, ' '))}</span> ${s}`);
  }
  return parts.join(' <span style="color:var(--muted);">·</span> ');
}

// ── Fiche PNJ « comme sur le wiki » : en-tête, Fabrique, Marchande, Description, Accès ──
function _wikiItem(id, esc, right = '') {
  if (id === 'cols') { // la monnaie n'est pas un item
    return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;"><span style="width:22px;text-align:center;flex-shrink:0;">🪙</span><span style="color:#d7af5f;font-weight:600;">Cols</span>${right}</div>`;
  }
  const it =(_modCache['items'] || []).find(x => (x.id || x._id) === id) || null;
  const name = it?.name || id;
  const color = it && typeof getRarityColor === 'function' ? getRarityColor(it.rarity) : '#8c8c8c';
  const img = it && typeof getItemImg === 'function' ? getItemImg(it) : null;
  const icon = img
    ? `<img src="${esc(img)}" alt="" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">`
    : `<span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin:0 7px;"></span>`;
  const unknown = it ? '' : ' <span title="Item introuvable dans le wiki" style="font-size:10px;color:#f59e0b;">⚠</span>';
  return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;">${icon}<span style="color:${color};font-weight:600;">${esc(name)}</span>${unknown}${right}</div>`;
}

// id de région → nom affiché sur le wiki (« hanaka » → « Hanaka ») ; à défaut, l'id tel quel
function _regionName(id) {
  const r = (_modCache['regions'] || []).find(x => (x.id || x._id) === id);
  return r?.name || r?.label || id;
}

function _pnjWikiSummary(d, esc) {
  const section = (title, body) => `<div style="margin-top:10px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);padding-bottom:3px;margin-bottom:4px;">${title}</div>${body}</div>`;
  const chip = (txt, color) => `<span style="font-size:11px;background:var(--surface3);border:1px solid var(--border);border-radius:12px;padding:2px 9px;${color ? `color:${color};` : ''}">${txt}</span>`;
  const badge = (txt, color) => `<span style="margin-left:auto;font-size:11px;font-weight:700;color:${color};border:1px solid ${color}55;border-radius:10px;padding:0 8px;">${txt}</span>`;

  const typeLabel = d.type || (d.tag ? String(d.tag).replace(/_/g, ' ') : '');
  let html = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;">
    <span style="font-size:15px;font-weight:700;color:var(--accent);">${esc(d.name || d.id || '—')}</span>
    ${typeLabel ? chip('🧑 ' + esc(typeLabel)) : ''}
    ${d.palier != null && d.palier !== '' ? chip('Palier ' + (d.palier == -1 ? 'Archive' : d.palier)) : ''}
    ${d.region ? chip('📍 ' + esc(_regionName(d.region))) : ''}
    ${d.coords ? chip(`X ${esc(d.coords.x)} · Y ${esc(d.coords.y)} · Z ${esc(d.coords.z)}`) : ''}
    ${d.underground ? chip('⛏️ Souterrain') : ''}
    ${d.sensible ? chip('🔒 Sensible', '#f87171') : ''}
    ${d.id ? `<code style="font-size:10px;color:var(--muted);margin-left:auto;">${esc(d.id)}</code>` : ''}
  </div>`;

  if (Array.isArray(d.craft) && d.craft.length) {
    const rows = d.craft.map(r => {
      const timer = r.time ? badge('⏱ ' + esc(String(r.time)), 'var(--muted)') : '';
      const star = r.quality ? ' <span title="Version qualité" style="color:#d7af5f;">✦</span>' : '';
      const ings = (r.ingredients || []).map(i => _wikiItem(i.id, esc, badge('×' + esc(String(i.qty ?? 1)), '#8c8c8c'))).join('');
      return `<div style="display:grid;grid-template-columns:minmax(190px,1fr) 2fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div>${_wikiItem(r.id, esc, star + timer)}</div>
        <div style="border-left:2px solid var(--border);padding-left:10px;">${ings || '<i style="color:var(--muted);font-size:11px;">Aucun ingrédient</i>'}</div>
      </div>`;
    }).join('');
    html += section('Fabrique', rows);
  }

  if (Array.isArray(d.sells) && d.sells.length) {
    const rows = d.sells.map(s => {
      const price = s.price != null ? badge('Vente ' + esc(String(s.price)) + ' cols', '#4ade80') : '';
      const buy = s.buy != null ? badge('Achat ' + esc(String(s.buy)) + ' cols', '#60a5fa') : '';
      return _wikiItem(s.id, esc, (s.quality ? ' <span style="color:#d7af5f;">✦</span>' : '') + price + buy);
    }).join('');
    html += section('Marchande', rows);
  }

  if (d.lore) html += section('Description', `<div style="font-style:italic;color:var(--muted);font-size:12px;line-height:1.5;">${esc(d.lore).replace(/\n/g, '<br>')}</div>`);
  if (d.instructions) html += section('📍 Accès', `<div style="font-size:12px;line-height:1.5;">${esc(d.instructions).replace(/\n/g, '<br>')}</div>`);
  return html;
}

function _buildPrettySummary(data, type) {
  const esc = window.VCL.escHtml;
  const RARITY_COLORS = { commun:'#4ade80', rare:'#60a5fa', epique:'#a78bfa', legendaire:'#e8d44a', mythique:'#f5b5e4', godlike:'#f87171', event:'#e2e8f0' };
  const RARITY_LABELS = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
  const CAT_LABELS    = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire', consommable:'🧪 Consommable', nourriture:'🍖 Nourriture', parchemin:'📃 Parchemin', materiaux:'🧱 Matériaux', ressources:'⛏️ Ressources', outils:'🛠️ Outils', rune:'🔮 Rune', quete:'📜 Quête', donjon:'🏰 Donjon', monnaie:'🪙 Monnaie' };

  const rows = [];
  const field = (label, val, color) => {
    if (val == null || val === '' || val === false) return;
    rows.push(`<div style="display:flex;gap:6px;align-items:baseline;font-size:12px;padding:2px 0;">
      <span style="color:var(--muted);min-width:90px;flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</span>
      <span style="color:${color||'var(--text)'};word-break:break-word;">${val}</span>
    </div>`);
  };

  // Ligne « id caché │ valeur affichée » : l'id n'est montré que s'il diffère de la valeur affichée
  const idCode = id => `<code style="font-size:10px;color:var(--muted);background:rgba(255,255,255,.05);border-radius:3px;padding:1px 5px;">${esc(String(id))}</code>`;
  const idPair = (id, shown) => {
    const plain = String(shown).replace(/<[^>]*>/g, '').trim();
    if (id == null || id === '' || plain === String(id).trim()) return shown;
    return `${idCode(id)}<span style="color:var(--rim2);margin:0 6px;">│</span>${shown}`;
  };
  const SLOT_LABELS = { arme_p:'Arme Principale', arme_s:'Arme Secondaire / Bouclier', anneau:'Anneau', amulette:'Amulette', bracelet:'Bracelet', artefact:'Artefact', gants:'Gants', casque:'Casque', plastron:'Plastron', 'jambières':'Jambières', bottes:'Bottes' };
  const statDef  = id => (typeof ALL_STATS !== 'undefined' ? ALL_STATS.find(x => x.id === id) : null);
  const itemName = id => ((_modCache['items'] || []).find(i => (i.id || i._id) === id) || {}).name;

  if (type === 'item') {
    const rarColor = RARITY_COLORS[data.rarity] || 'var(--muted)';
    if (data.name) field('Nom', `<b style="font-size:13px;">${esc(data.name)}</b>${data.quality ? ' <span style="font-size:10px;font-weight:700;color:#34d399;border:1px solid rgba(52,211,153,.4);border-radius:10px;padding:1px 7px;">✦ Qualité</span>' : ''}${data.id ? ' ' + idCode(data.id) : ''}`, rarColor);
    if (data.rarity)   field('Rareté',   idPair(data.rarity, `<span style="font-weight:700;">${RARITY_LABELS[data.rarity]||data.rarity}</span>`), rarColor);
    if (data.category) field('Catégorie', idPair(data.category, esc(CAT_LABELS[data.category]||data.category)));
    if (data.palier != null && data.palier !== '') field('Palier',   idPair(data.palier, data.palier == 'event' ? 'Event' : 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier)));
    if (data.lvl)      field('Niveau',   idPair(data.lvl, 'Niveau ≥ ' + data.lvl));
    if (data.cat)      field('Slot',     idPair(data.cat, esc(SLOT_LABELS[data.cat] || data.cat)));
    if (data.classes?.length) field('Classes', data.classes.map(c => idPair(c, esc((typeof CLASSES !== 'undefined' && CLASSES.find(x => x.id === c)?.label) || c))).join(' &nbsp; '));
    if (data.set) {
      const pano = (_modCache['panoplies'] || []).find(p => p.id === data.set);
      field('Set', idPair(data.set, esc(pano?.label || data.set)), '#d7af5f');
    }
    if (data.sensible) field('', '🔒 Sensible', '#f87171');
    // Le champ « event » (quel évènement) n'a de sens que dans le palier Event
    if (data.palier === 'event') field('Évènement', typeof data.event === 'string' && data.event ? esc(data.event) : '<i style="color:var(--muted)">non renseigné</i>', '#a855f7');
    if (data.evolutif) field('', '🔄 Évolutif', '#60a5fa');
    if (data.stats && Object.keys(data.stats).length) {
      const statLines = Object.entries(data.stats).map(([k, v]) => {
        const val = Array.isArray(v) ? `${v[0]}–${v[1]}` : v;
        const d = statDef(k), unit = d ? d.unit : '';
        return `<span style="background:rgba(224,172,96,.12);border:1px solid rgba(224,172,96,.2);border-radius:4px;padding:1px 6px;font-size:11px;">${idPair(k, esc(d ? d.label : k))} <b>${val}${esc(unit)}</b></span>`;
      }).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Stats</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${statLines}</div>`);
    }
    // Effets (consommables) : une ligne par effet, comme sur le wiki ; recharge et utilisations regroupées dans « Utilisation »
    if (Array.isArray(data.effects) && data.effects.length) {
      const fmtDur = sec => { const n = +sec; if (!isFinite(n) || n <= 0) return ''; if (n % 3600 === 0) return (n / 3600) + ' h'; if (n % 60 === 0) return (n / 60) + ' min'; return n + ' s'; };
      const meta = t => (typeof EFFECT_META !== 'undefined' && EFFECT_META[t]) || { icon: '◆', color: '#aaa', label: t, prefix: '' };
      const real = data.effects.filter(e => e && !['cooldown', 'use', 'level'].includes(e.type));
      const cd = data.effects.find(e => e && e.type === 'cooldown'), use = data.effects.find(e => e && e.type === 'use');
      if (real.length) {
        const eff = real.map(e => {
          const m = meta(e.type), col = e.color || m.color;
          const val = `${e.prefix ?? m.prefix ?? ''}${e.value ?? ''}${e.unit ? ' ' + String(e.unit).trim() : ''}`;
          const dur = e.instant ? 'Instantané' : fmtDur(e.duration);
          return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;"><span style="width:20px;text-align:center;">${esc(e.icon || m.icon)}</span><span style="color:${col};font-weight:600;">${esc(val)}</span>${dur ? `<span style="font-size:10px;color:var(--muted);background:var(--surface3);border-radius:10px;padding:1px 7px;">⏳ ${esc(dur)}</span>` : ''}<span style="font-size:10px;color:var(--muted);">${idCode(e.type)}</span></div>`;
        }).join('');
        rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Effets</div><div style="margin-bottom:2px;">${eff}</div>`);
      }
      const ac = data.cooldown_apply;
      if (cd || use || (ac && ac.value > 0)) {
        const chips = [];
        if (cd) chips.push(`<span style="background:rgba(244,114,182,.12);border:1px solid rgba(244,114,182,.3);color:#f472b6;border-radius:4px;padding:1px 7px;font-size:11px;">⏱ Recharge <b>${esc(fmtDur(cd.value) || cd.value + ' s')}</b></span>`);
        if (use) chips.push(`<span style="background:var(--surface3);border-radius:4px;padding:1px 7px;font-size:11px;">🧪 <b>${esc(String(use.value))}</b> utilisation${use.value > 1 ? 's' : ''}</span>`);
        const apply = (ac && ac.value > 0) ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;">↳ ${esc(ac.lead || 'À la consommation, applique')} <b style="color:#f0a030;">${esc(fmtDur(ac.value))}</b> de recharge sur ${esc(ac.target || 'les objets du même type')}</div>` : '';
        rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Utilisation</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${chips.join('')}</div>${apply}`);
      }
    }
    if (data.craft?.length) {
      const craftLines = data.craft.map(c => c && c.id === 'cols'
        ? `<span style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:#c9a84c;border-radius:4px;padding:1px 6px;font-size:11px;">🪙 <b>${esc(String(c.qty))}</b> cols</span>`
        : `<span style="background:var(--surface3);border-radius:4px;padding:1px 6px;font-size:11px;"><b>×${c.qty}</b> ${idPair(c.id, esc(itemName(c.id) || c.id))}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Craft${data.craft_qty > 1 ? ` <span style="text-transform:none;letter-spacing:0;font-weight:400;">· ×${esc(String(data.craft_qty))} par craft</span>` : ''}${data.craft_cd ? ` <span style="text-transform:none;letter-spacing:0;font-weight:400;">· ⏱ ${esc(String(data.craft_cd))}</span>` : ''}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${craftLines}</div>`);
    }
    {
      const raw = data.obtain || '';
      const resolved = resolveObtain(raw);
      field('Obtention', raw
        ? idPair(raw.replace(/\n/g, ' ⏎ '), esc(resolved).replace(/\n/g, '<br>'))
        : '<i style="color:var(--muted)">Aucune source renseignée</i>');
    }
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.competence) field('Compétence', esc(data.competence).replace(/\n/g,'<br>'));
    if (data.tags?.length) field('Tags', data.tags.map(t=>`<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 5px;">${esc(t)}</span>`).join(' '));
  } else if (type === 'mob') {
    if (data.type)    field('Type',     data.type);
    if (data.palier)  field('Palier',   'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.region)  field('Région',   esc(_regionName(data.region)));
    if (data.behavior)field('Comportement', data.behavior);
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.loot?.length) {
      const lootLines = data.loot.map(l => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${esc(l.id)} <b style="color:var(--success)">${l.chance}%</b></span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Loot</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${lootLines}</div>`);
    }
  } else if (type === 'pnj') {
    rows.push(_pnjWikiSummary(data, esc));
  } else if (type === 'region') {
    if (data.palier)  field('Palier', 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.inCodex) field('Codex',  '✓ Dans le Codex', 'var(--success)');
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
  } else if (type === 'quest') {
    const QUEST_TYPE_LABELS = { main:'⚔️ Principale', sec:'🗺️ Secondaire', ter:'📋 Tertiaire' };
    if (data.type)    field('Type',   QUEST_TYPE_LABELS[data.type]||data.type);
    if (data.palier)  field('Palier', 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.npc)     field('PNJ',    data.npc);
    if (data.zone)    field('Zone',   data.zone);
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.desc)    field('Desc',   `<i style="color:var(--muted)">${esc(data.desc).slice(0,200)}</i>`);
    if (data.objectifs?.length) {
      const objLines = data.objectifs.map(o => {
        let line = `<div style="font-size:11px;display:flex;gap:5px;"><span style="color:var(--accent);">◻</span><span>${esc(o.texte||'—')}</span></div>`;
        if (o.location?.x != null || o.location?.z != null) line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">📍 X ${o.location?.x ?? '?'} · Z ${o.location?.z ?? '?'}</div>`;
        if (o.items?.length) o.items.forEach(it => { line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">→ item: <code>${esc(it.id||it.itemId||'?')}</code> ×${it.qte||1}</div>`; });
        if (o.mobs?.length)  o.mobs.forEach(m  => { line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">→ mob: <code>${esc(m.id||m.mobId||'?')}</code> ×${m.qte||1}</div>`; });
        return line;
      }).join('');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Objectifs</div><div style="display:flex;flex-direction:column;gap:1px;">${objLines}</div>`);
    }
  } else if (type === 'panoplie') {
    if (data.bonuses?.length) {
      const bonLines = data.bonuses.map(b => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${b.pieces}×: ${esc(b.stat)} +${b.value}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Bonus</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${bonLines}</div>`);
    }
  }

  // Tous les autres champs de la soumission, tels quels (ids résolus en noms quand on les connaît)
  const shown = new Set(_PRETTY_SHOWN[type] || []);
  const n0 = rows.length;
  for (const [k, v] of Object.entries(data || {})) {
    if (shown.has(k) || _PRETTY_SKIP.has(k)) continue;
    const s = _prettyVal(v, esc);
    if (s) field(_PRETTY_LABELS[k] || k.replace(/_/g, ' '), s);
  }
  if (rows.length > n0 && n0 > 0) {
    rows.splice(n0, 0, '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 2px;border-top:1px solid var(--border);padding-top:6px;">Autres informations</div>');
  }

  if (!rows.length) return '';
  return `<div style="padding:8px 10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);">${rows.join('')}</div>`;
}

function buildCard(sub) {
  const card = document.createElement('div');
  card.className = `sub-card status-${sub.status}`;
  card.id = `card-${sub._id}`;

  const typeLabels = { item:'⚔️ Item', mob:'👾 Mob', pnj:'🧑 PNJ', region:'📍 Région', quest:'📜 Quête', panoplie:'🔗 Panoplie' };
  const name = sub.data?.titre || sub.data?.name || sub.data?.label || sub._id;
  const ts   = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleString('fr-FR') : '—';
  const code = toJSStr(sub.data || {}, 0) + ',';

  const statusLabel = { pending:'⏳ En attente', approved:'✓ Approuvé', rejected:'✕ Rejeté', changes_requested:'💬 Modif. demandées' }[sub.status] || sub.status;

  let actionsHtml = '';
  let editorHtml  = '';
  if (sub.status === 'pending' || sub.status === 'changes_requested') {
    editorHtml = `
      <div class="sub-editor" id="editor-${sub._id}">
        <textarea class="sub-editor-ta" id="editor-ta-${sub._id}" spellcheck="false" oninput="onEditorInput('${sub._id}')"></textarea>
        <div class="sub-editor-err" id="editor-err-${sub._id}"></div>
        <div class="sub-editor-status" id="editor-status-${sub._id}"></div>
      </div>
    `;
    const changeNotice = sub.status === 'changes_requested' && sub.changeRequestComment
      ? `<div style="margin-bottom:6px;padding:8px 10px;background:rgba(245,158,11,.12);border-left:3px solid var(--warn,#f59e0b);border-radius:4px;font-size:12px;color:var(--warn,#f59e0b);">💬 ${escHtml(sub.changeRequestComment)}</div>`
      : '';
    actionsHtml = `
      ${changeNotice}
      <input type="text" class="sub-comment" id="comment-${sub._id}" placeholder="Commentaire (optionnel)">
      <button class="btn btn-ghost"   id="btn-edit-${sub._id}" onclick="toggleEdit('${sub._id}')" style="font-size:12px;">✏️ Modifier</button>
      <button class="btn btn-ghost"   onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre cette soumission dans le Creator pour l'éditer">⚙️ Creator</button>
      <button class="btn btn-ghost"   id="btn-verify-${sub._id}" onclick="verifySubmission('${sub._id}')" style="font-size:12px;" title="Lit les captures jointes (gratuit, dans ton navigateur) et compare avec les champs saisis">🔍 Vérifier</button>
      <button class="btn btn-ghost"   onclick="requestChanges('${sub._id}')" style="font-size:12px;color:var(--warn,#f59e0b);">💬 Demander modifs</button>
      <button class="btn btn-approve" onclick="approve('${sub._id}')">✓ Approuver</button>
      <button class="btn btn-reject"  onclick="reject('${sub._id}')">✕ Rejeter</button>
    `;
  } else if (sub.status === 'rejected') {
    actionsHtml = `
      ${sub.comment ? `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>` : ''}
      <button class="btn btn-ghost" onclick="restorePending('${sub._id}')" style="font-size:12px;">🔄 Remettre en attente</button>
      <button class="btn btn-ghost" onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre dans le Creator pour corriger">⚙️ Creator</button>
    `;
  } else if (sub.comment) {
    actionsHtml = `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>`;
  }

  const modBadge = sub.isModification
    ? `<span class="sub-type" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);">✏️ Modif</span>`
    : `<span class="sub-type" style="background:rgba(74,222,128,.12);color:var(--success);border:1px solid rgba(74,222,128,.3);">✨ Ajout</span>`;
  const chasseBadge = sub.fromTableauDeChasse
    ? `<span class="sub-type" style="background:rgba(215,175,95,.12);color:#d7af5f;border:1px solid rgba(215,175,95,.3);" title="Soumission issue du tableau de chasse">🎯 Chasse</span>`
    : '';

  const preservedHtml = '';

  const playerCommentHtml = sub.submitter_comment
    ? `<div style="margin:4px 0 6px;padding:6px 10px;background:rgba(215,175,95,.08);border:1px solid rgba(215,175,95,.25);border-radius:6px;font-size:12px;color:#d7af5f;">💬 ${escHtml(sub.submitter_comment)}</div>`
    : '';

  card.innerHTML = `
    <div class="sub-head">
      <span class="sub-type">${typeLabels[sub.type] || sub.type}</span>
      ${modBadge}
      ${chasseBadge}
      <span class="sub-name">${escHtml(name)}</span>
      <span class="sub-meta">${ts}</span>
      <span class="sub-meta">par <b>${escHtml(userName(sub.submittedBy, sub.submitterName))}</b></span>
      <span class="sub-status ${sub.status}">${statusLabel}</span>
    </div>
    ${preservedHtml}
    ${playerCommentHtml}
    <div class="sub-body">
      <div class="sub-actions">
        ${actionsHtml}
        <button class="btn btn-copy" onclick="copyCode('${sub._id}')">📋 Copier</button>
        <button class="btn-toggle" onclick="toggleDetails('${sub._id}', this)">▾ Voir</button>
      </div>
      <div class="sub-details" id="details-${sub._id}">
        ${sub.data?.id ? `<div id="diff-${sub._id}" style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="loadSubDiff('${sub._id}','${sub.type}','${String(sub.data?.id||'')}')">${sub.isModification ? '🔍 Voir les changements' : '🔍 Comparer avec item existant'}</button></div>` : ''}
        <div id="pretty-${sub._id}">${_buildPrettySummary(sub.data || {}, sub.type)}</div>
        <div id="screens-${sub._id}"></div>
        <details style="margin-top:6px;">
          <summary style="font-size:10px;color:var(--muted);cursor:pointer;user-select:none;padding:3px 0;">⟨⟩ JSON brut</summary>
          <div class="sub-code" id="code-${sub._id}">${escHtml(code)}</div>
        </details>
        ${editorHtml}
      </div>
    </div>
  `;

  // Afficher les screenshots soumis (nouveau: sub.screenshots[], legacy: sub.forum_image)
  const allScreens = sub.screenshots?.length ? sub.screenshots
    : sub.forum_image ? [sub.forum_image]
    : [];
  if (allScreens.length) {
    const wrap = card.querySelector(`#screens-${sub._id}`);
    if (wrap) {
      wrap.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;';
      allScreens.forEach(src => {
        const img = document.createElement('img');
        img.style.cssText = 'max-height:180px;max-width:100%;border-radius:6px;border:1px solid var(--border);cursor:zoom-in;object-fit:contain;background:var(--surface2);';
        img.src = src;
        img.onclick = e => { e.stopPropagation(); openLightbox(src); };
        wrap.appendChild(img);
      });
    }
  }

  return card;
}

const escHtml = window.VCL.escHtml;

// ── Diff soumission vs document actuel ───────────────
const _SUB_COL_MAP = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quest:'quetes', panoplie:'panoplies' };
// Collections de fallback pour les documents sensibles (fusionnées si plusieurs)
const _SUB_FALLBACK_COLS = { item: ['items_hidden', 'items_secret'], mob: ['mobs_secret'], pnj: ['pnj_secret'] };
const _diffDataStore = new Map(); // subId → { current, proposed }

// Champs dont l'ordre de tableau est non significatif
const _UNORDERED_ARRAY_FIELDS = new Set(['stats','craft','effects','bonuses','tags','classes','images','loot','drops','zones','objectifs','recompenses']);
// Champs à ignorer dans le diff (régénérés ou gérés en interne lors de l'approbation)
const _DIFF_SKIP_FIELDS = new Set(['_order','ordre','_contributor','_ts','images','image','img','nameHash']);

function _diffValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 1);
  return String(v);
}

// Sérialisation canonique : trie les clés d'objets (insensible à l'ordre des clés),
// préserve l'ordre des éléments d'un tableau (sauf si on l'appelle via _canonicalArr).
function _canonicalJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(_canonicalJSON).join(',') + ']';
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v).sort(([a], [b]) => a.localeCompare(b));
    return '{' + entries.map(([k, val]) => JSON.stringify(k) + ':' + _canonicalJSON(val)).join(',') + '}';
  }
  return JSON.stringify(v);
}

// Pour les champs de type tableau non-ordonné : trie aussi les éléments du tableau.
function _canonicalArr(arr) {
  return [...arr].map(_canonicalJSON).sort().join('\x00');
}

function _renderDiffView(subId, current, proposed) {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  const sorted = [...allKeys].sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a), ib = FIELD_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const rows = [];
  for (const k of sorted) {
    if (k.startsWith('_') || _DIFF_SKIP_FIELDS.has(k)) continue;
    const hasOld = k in current, hasNew = k in proposed;
    let equal = false;
    if (hasOld && hasNew) {
      if (_UNORDERED_ARRAY_FIELDS.has(k) && Array.isArray(current[k]) && Array.isArray(proposed[k])) {
        // Tableau non-ordonné : compare sans tenir compte de l'ordre des éléments
        equal = _canonicalArr(current[k]) === _canonicalArr(proposed[k]);
      } else {
        // Comparaison canonique : insensible à l'ordre des clés d'objets
        equal = _canonicalJSON(current[k]) === _canonicalJSON(proposed[k]);
      }
    }
    if (!hasOld && hasNew)      rows.push({ k, kind:'added',   old:null,       new:proposed[k] });
    else if (hasOld && !hasNew) rows.push({ k, kind:'removed', old:current[k], new:null });
    else if (!equal)            rows.push({ k, kind:'changed', old:current[k], new:proposed[k] });
  }

  if (!rows.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0;">Aucune différence détectée entre la version actuelle et la proposition.</div>';

  const pal = {
    added:   { bg:'rgba(74,222,128,.08)',  bd:'rgba(74,222,128,.35)',  ic:'✚', col:'var(--success)' },
    removed: { bg:'rgba(248,113,113,.08)', bd:'rgba(248,113,113,.35)', ic:'✕', col:'var(--danger)'  },
    changed: { bg:'rgba(245,158,11,.08)',  bd:'rgba(245,158,11,.35)',  ic:'~', col:'#f59e0b'         },
  };

  const safe = subId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const rowsHtml = rows.map((r, ri) => {
    const p = pal[r.kind];
    let content;
    if (r.kind === 'changed') {
      content = `<span style="color:var(--danger);text-decoration:line-through;opacity:.7;word-break:break-all;">${escHtml(_diffValue(r.old))}</span>
                 <span style="color:var(--muted);margin:0 4px;">→</span>
                 <span style="color:var(--success);word-break:break-all;">${escHtml(_diffValue(r.new))}</span>`;
    } else if (r.kind === 'added') {
      content = `<span style="color:var(--success);word-break:break-all;">${escHtml(_diffValue(r.new))}</span>`;
    } else {
      content = `<span style="color:var(--danger);opacity:.8;word-break:break-all;">${escHtml(_diffValue(r.old))}</span>`;
    }
    return `<div data-diff-key="${escHtml(r.k)}" data-diff-kind="${r.kind}" style="display:flex;gap:8px;padding:5px 10px;background:${p.bg};border-left:3px solid ${p.bd};margin-bottom:3px;border-radius:0 4px 4px 0;align-items:center;flex-wrap:wrap;">
      <input type="checkbox" id="diffck-${safe}-${ri}" checked title="Cocher = accepter ce changement" style="flex-shrink:0;cursor:pointer;width:14px;height:14px;accent-color:var(--accent);">
      <span style="font-size:12px;font-weight:700;color:${p.col};width:14px;text-align:center;flex-shrink:0;">${p.ic}</span>
      <span style="font-size:11px;font-weight:700;color:var(--muted);min-width:70px;flex-shrink:0;">${escHtml(r.k)}</span>
      <span style="font-size:12px;flex:1;min-width:0;">${content}</span>
    </div>`;
  }).join('');

  return `<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;" id="diff-view-${safe}">
    <div style="padding:6px 10px;background:var(--surface2);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:10px;">
      <span>${rows.length} champ${rows.length > 1 ? 's' : ''} modifié${rows.length > 1 ? 's' : ''}</span>
      <span style="font-weight:400;">
        <span style="color:var(--success);">✚</span> ajouté ·
        <span style="color:#f59e0b;">~</span> modifié ·
        <span style="color:var(--danger);">✕</span> supprimé
      </span>
      <span style="font-size:10px;color:var(--muted);font-weight:400;">☑ = accepter le changement</span>
    </div>
    <div style="padding:8px;">${rowsHtml}</div>
    <div style="padding:6px 10px;background:var(--surface2);border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;">
      <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="applyDiffSelection('${subId}')">✔ Appliquer la sélection à la soumission</button>
      <span style="font-size:11px;color:var(--muted);">Les changements non cochés seront revertés à la valeur actuelle.</span>
    </div>
  </div>`;
}

window.loadSubDiff = async function(subId, type, docId) {
  const el = document.getElementById(`diff-${subId}`);
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Chargement du diff…</div>';
  const colName = _SUB_COL_MAP[type];
  if (!colName || !docId) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Impossible de charger le diff (ID ou type manquant).</div>';
    return;
  }
  try {
    const snap = await getDoc(doc(db, colName, String(docId)));
    let current = snap.exists() ? snap.data() : null;

    if (!current) {
      // Fallback : collections sensibles (items_hidden + items_secret, mobs_secret, pnj_secret)
      const fallbacks = _SUB_FALLBACK_COLS[type] || [];
      for (const fbCol of fallbacks) {
        const fb = await getDoc(doc(db, fbCol, String(docId)));
        if (fb.exists()) current = current ? { ...current, ...fb.data() } : fb.data();
      }
    }

    if (!current) {
      el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Document original introuvable — traité comme ajout.</div>';
      return;
    }
    const sub = allSubs.find(s => s._id === subId);
    if (!sub) return;
    let proposed = sub.data || {};
    // Modification d'item sensible : les champs items_secret absents de la soumission
    // seront préservés à l'approbation → les refléter dans le proposed du diff
    if (sub.isModification && type === 'item' && sub.data?.sensible) {
      const gameplayKeys = await getItemGameplayKeys().catch(() => []);
      const merged = { ...proposed };
      for (const [k, v] of Object.entries(current)) {
        if (k.startsWith('_') || k === 'sensible' || k === 'nameHash') continue;
        if (gameplayKeys.includes(k)) continue; // gameplay : pas de merge (soumission fait foi)
        if (!(k in merged)) merged[k] = v;
      }
      proposed = merged;
    }
    _diffDataStore.set(subId, { current, proposed });
    el.innerHTML = _renderDiffView(subId, current, proposed);
  } catch(e) {
    el.innerHTML = `<div style="font-size:12px;color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.applyDiffSelection = async function(subId) {
    const stored = _diffDataStore.get(subId);
    if (!stored) { toast('Erreur: Diff non chargé', 'error'); return; }

    const { current, proposed } = stored;
    
    // On clone la proposition (qui contient tes onglets base + quality)
    let merged = JSON.parse(JSON.stringify(proposed));

    // On applique les modifs des cases à cocher
    const diffEl = document.getElementById(`diff-${subId}`);
    if (diffEl) {
        const rows = diffEl.querySelectorAll('[data-diff-key]');
        rows.forEach(row => {
            const k = row.dataset.diffKey;
            const cb = row.querySelector('input[type=checkbox]');
            if (cb && !cb.checked) {
                // Si décoché, on remet la valeur de 'current'
                merged[k] = current[k];
                if (current[k] === undefined) delete merged[k];
            }
        });
    }

    // Sécurité Coordonnées / ID
    if (current.coords && !merged.coords) merged.coords = current.coords;
    if (current.id && !merged.id) merged.id = current.id;

    try {
        const cleaned = sanitizeForFirestore(merged);
        await updateDoc(doc(db, 'submissions', subId), { data: cleaned });
        
        // Mise à jour de la liste locale pour que tes onglets reflètent le changement
        const idx = allSubs.findIndex(s => s._id === subId);
        if (idx !== -1) allSubs[idx].data = merged;

        toast('✓ Sauvegardé avec succès !');
        renderSubs(); // Rafraîchit l'affichage
    } catch (e) {
        console.error(e);
        toast('Erreur save: ' + e.message, 'error');
    }
};

// ── Copier le code ────────────────────────────────────
// ── Image soumission : voir / changer ─────────────────
async function _applyModImage(id, file) {
  if (!file || !file.type.startsWith('image/')) return;
  const sub = allSubs.find(s => s._id === id);
  if (!sub) return;

  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej();
    r.readAsDataURL(file);
  });

  sub.forum_image = base64;

  const zone        = document.getElementById(`mod-img-zone-${id}`);
  const preview     = document.getElementById(`mod-img-preview-${id}`);
  const placeholder = document.getElementById(`mod-img-placeholder-${id}`);
  const clearBtn    = document.getElementById(`mod-img-clear-${id}`);
  if (zone)        zone.classList.add('has-img');
  if (preview)     {
    preview.src = base64;
    preview.style.display = 'block';
    preview.onclick = e => { e.stopPropagation(); openLightbox(base64); };
  }
  if (placeholder) placeholder.style.display = 'none';
  if (clearBtn)    clearBtn.style.display = '';
}

function openLightbox(src) {
  const lb = document.getElementById('img-lightbox');
  document.getElementById('img-lightbox-img').src = src;
  lb.classList.add('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('img-lightbox')?.classList.remove('open');
});

window.modImgFile = (id, file) => _applyModImage(id, file);

window.modImgDrop = (id, e) => {
  e.preventDefault();
  document.getElementById(`mod-img-zone-${id}`)?.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) _applyModImage(id, file);
};

window.modImgClear = (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (sub) sub.forum_image = null;
  const zone        = document.getElementById(`mod-img-zone-${id}`);
  const preview     = document.getElementById(`mod-img-preview-${id}`);
  const placeholder = document.getElementById(`mod-img-placeholder-${id}`);
  const clearBtn    = document.getElementById(`mod-img-clear-${id}`);
  const input       = document.getElementById(`mod-img-input-${id}`);
  if (zone)        zone.classList.remove('has-img');
  if (preview)     { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (clearBtn)    clearBtn.style.display = 'none';
  if (input)       input.value = '';
};

window.modImgPaste = async (id) => {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const mime = item.types.find(t => t.startsWith('image/'));
      if (mime) {
        const blob = await item.getType(mime);
        const ext  = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' }[mime] || 'png';
        await _applyModImage(id, new File([blob], `image.${ext}`, { type: mime }));
        return;
      }
    }
    toast('Pas d\'image dans le presse-papiers.', 'warning');
  } catch(e) {
    toast('Impossible de lire le presse-papiers : ' + e.message, 'error');
  }
};

window.copyCode = (id) => {
  const sub  = allSubs.find(s => s._id === id);
  if (!sub) return;
  const code = toJSStr(sub.data || {}, 0) + ',';
  navigator.clipboard.writeText(code);
};

// ── Toggle détails (code + éditeur) ──────────────────
window.toggleDetails = (id, btn) => {
  const details = document.getElementById(`details-${id}`);
  if (!details) return;
  const open = details.classList.toggle('open');
  btn.textContent = open ? '▴ Masquer' : '▾ Voir';
};

// ── Toggle éditeur inline ─────────────────────────────
window.toggleEdit = async (id) => {
  // S'assurer que les détails sont ouverts avant d'éditer
  const details = document.getElementById(`details-${id}`);
  const toggleBtn = document.querySelector(`#card-${id} .btn-toggle`);
  if (details && !details.classList.contains('open')) {
    details.classList.add('open');
    if (toggleBtn) toggleBtn.textContent = '▴ Masquer';
  }
  const sub     = allSubs.find(s => s._id === id);
  const editor  = document.getElementById(`editor-${id}`);
  const ta      = document.getElementById(`editor-ta-${id}`);
  const codeDiv = document.getElementById(`code-${id}`);
  const btn     = document.getElementById(`btn-edit-${id}`);
  const errDiv  = document.getElementById(`editor-err-${id}`);
  if (!editor || !ta) return;

  const isOpen = editor.classList.contains('open');
  if (isOpen) {
    // Fermer : valider le JSON
    const errMsg = tryParseEdit(id);
    if (errMsg) { errDiv.textContent = errMsg; errDiv.style.display = ''; return; }
    errDiv.style.display = 'none';
    // Mettre à jour l'aperçu
    codeDiv.textContent = toJSStr(sub.data, 0) + ',';
    const prettyDiv = document.getElementById(`pretty-${id}`);
    if (prettyDiv) prettyDiv.innerHTML = _buildPrettySummary(sub.data || {}, sub.type);
    editor.classList.remove('open');
    if (codeDiv) codeDiv.style.display = '';
    btn.textContent = '✏️ Modifier';
    btn.style.background = '';
    // Persister en Firestore pour survivre à un refresh
    try {
      btn.disabled = true;
      await updateDoc(doc(db, 'submissions', id), { data: sub.data });
      const statusEl = document.getElementById(`editor-status-${id}`);
      if (statusEl) { statusEl.textContent = '💾 Sauvegardé'; statusEl.className = 'sub-editor-status ok'; statusEl.style.display = ''; }
    } catch(e) {
      toast('Erreur sauvegarde : ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  } else {
    // Ouvrir : pre-fill JSON
    // L'éditeur prend la place du bloc « JSON brut » déjà déroulé, avec le même format
    const det = codeDiv?.closest('details'); if (det) det.open = true;
    ta.value = toJSStr(sub.data || {}, 0);
    if (codeDiv) { codeDiv.parentNode.insertBefore(editor, codeDiv); codeDiv.style.display = 'none'; }
    editor.classList.add('open');
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 200), 700) + 'px';
    btn.textContent = '✔ Valider';
    btn.style.background = 'rgba(224,172,96,.25)';
    ta.focus();
  }
};

// Accepte le format affiché dans « JSON brut » ({id:"x", sells:[…],}) comme du JSON classique : clés sans guillemets et virgules finales tolérées.
function _parseObjectLiteral(src) {
  let out = '', i = 0, str = false;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (str) {
      out += ch;
      if (ch === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (ch === '"') str = false;
      i++; continue;
    }
    if (ch === '"') { str = true; out += ch; i++; continue; }
    if (/[A-Za-z_$]/.test(ch)) {                       // identifiant hors chaîne : clé à mettre entre guillemets (sauf true / false / null)
      let j = i; while (j < n && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j); let k = j; while (k < n && /\s/.test(src[k])) k++;
      out += (src[k] === ':' && !['true', 'false', 'null'].includes(word)) ? '"' + word + '"' : word;
      i = j; continue;
    }
    out += ch; i++;
  }
  out = out.replace(/,\s*([}\]])/g, '$1').replace(/,\s*$/, '');   // virgules finales (hors chaînes : une virgule suivie de } ou ] n'existe pas dans un texte entre guillemets sans être déjà protégée)
  return JSON.parse(out);
}

function tryParseEdit(id) {
  const sub = allSubs.find(s => s._id === id);
  const ta  = document.getElementById(`editor-ta-${id}`);
  if (!sub || !ta) return null;
  try {
    const parsed = _parseObjectLiteral(ta.value);
    if (typeof parsed !== 'object' || parsed === null) return 'Objet attendu.';
    sub.data = parsed; // mutate in-place → approve() lira la version modifiée
    return null;
  } catch(e) {
    return 'Syntaxe invalide : ' + e.message;
  }
}

// ── Live JSON validation dans l'éditeur inline ────────
window.onEditorInput = (id) => {
  const ta     = document.getElementById(`editor-ta-${id}`);
  const status = document.getElementById(`editor-status-${id}`);
  if (!ta) return;
  try {
    _parseObjectLiteral(ta.value);
    ta.classList.add('json-valid');
    ta.classList.remove('json-invalid');
    if (status) { status.textContent = '✓ Syntaxe valide'; status.className = 'sub-editor-status ok'; }
  } catch(e) {
    ta.classList.add('json-invalid');
    ta.classList.remove('json-valid');
    if (status) { status.textContent = '✕ ' + e.message; status.className = 'sub-editor-status err'; }
  }
};

// ── Ouvrir dans Creator ────────────────────────────────
window.openInCreator = (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (!sub || !['pending', 'changes_requested', 'rejected'].includes(sub.status)) return;
  sessionStorage.setItem('editSub', JSON.stringify({ type: sub.type, data: sub.data }));
  window.open('creator.html');
};

// Ouvre l'item actuellement dans l'éditeur dans le Creator
window.openEditorInCreator = function() {
  const COL_TO_TYPE = {
    'items':'item', 'items_sensible':'item',
    'mobs':'mob', 'mobs_secret':'mob',
    'personnages':'pnj', 'pnj_secret':'pnj',
    'regions':'region',
    'quetes':'quest',
    'panoplies':'panoplie',
  };
  const type = COL_TO_TYPE[_editorCollection];
  if (!type || !_editorOrigData) return;
  sessionStorage.setItem('editSub', JSON.stringify({ type, data: _editorOrigData }));
  window.open('creator.html');
};

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

// Champs que le Creator sait produire, par type de soumission (= ce que build*Obj() renvoie).
// Tout autre champ d'un document existant est conservé quand une modification est approuvée.
const _CREATOR_MANAGED_KEYS = {
  item:     new Set(['cat','category','classes','competence','cooldown_apply','craft','craft_cd','craft_qty','effects','event','evolutif','evolutions','evolvedFrom','id','images','lore','lvl','name','obtain','occulte','palier','quality','rarity','rune_slots','sensible','set','skill_name','skill_rarity','stats','tags','twoHanded','unique']),
  mob:      new Set(['id','name','type','behavior','palier','region','images','inCodex','sensible','lore','spawnTime','coords','coords_more','loot']),
  pnj:      new Set(['coords','craft','id','images','instructions','is_underground','name','palier','region','sells','sensible','tag','type']),
  region:   new Set(['canTp','coords','id','images','inCodex','lore','name','palier']),
  quest:    new Set(['id','type','palier','zone','npc','desc','coords','titre','objectifs','recompenses','statut']),
  panoplie: new Set(['bonuses','id','label']),
};

// ── Approve ───────────────────────────────────────────
window.approve = async (id) => {
  const sub     = allSubs.find(s => s._id === id);
  if (!sub) return;

  // Si l'éditeur est ouvert, valider d'abord
  const editor = document.getElementById(`editor-${id}`);
  if (editor?.classList.contains('open')) {
    const errMsg = tryParseEdit(id);
    if (errMsg) {
      const errDiv = document.getElementById(`editor-err-${id}`);
      if (errDiv) { errDiv.textContent = errMsg; errDiv.style.display = ''; }
      return;
    }
    editor.classList.remove('open');
  }

  const comment = document.getElementById(`comment-${id}`)?.value?.trim() || '';
  const btn     = document.querySelector(`#card-${id} .btn-approve`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const colMap = { item: 'items', mob: 'mobs', pnj: 'personnages', region: 'regions', quest: 'quetes', panoplie: 'panoplies' };
    const target = colMap[sub.type];
    if (!target) throw new Error('Type inconnu : ' + sub.type);

    let dataId = sub.data?.id;
    if (!dataId) throw new Error('Pas d\'ID dans les données');

    if (sub.data?.sensible === true) throw new Error('Les items / mobs / PNJ sensibles ne sont plus gérés : décoche « sensible » dans la soumission.');
    const _contribName  = sub.submitterName || _userNames.get(sub.submittedBy) || 'Inconnu';
    const _contribField = { uid: sub.submittedBy || null, name: _contribName };

    // Nouveau PNJ : l'ID par défaut est NOM + palier + lieu. Une soumission qui porte encore l'ancien format (type + palier + lieu) est convertie,
    // et un ID déjà pris reçoit un _2, _3… : un nouvel ajout n'écrase jamais un PNJ existant.
    if (sub.type === 'pnj' && !sub.isModification) {
      const taken = async id => (await getDoc(doc(db, 'personnages', String(id)))).exists();
      const old = String(dataId);
      const nameSlug = _slugName(sub.data.name || '');
      const typeSlug = _slugName(sub.data.type || '');
      let nid = old;
      if (nameSlug && typeSlug && old.startsWith(typeSlug + '_') && !old.startsWith(nameSlug + '_')) nid = nameSlug + old.slice(typeSlug.length); // ancien format
      let base = nid, n = 2;
      while (await taken(nid)) nid = `${base}_${n++}`;
      if (nid !== old) {
        toast(`ID du PNJ : ${old} → ${nid}`, 'info', 6000);
        dataId = nid;
        sub.data = { ...sub.data, id: nid };
        if (Array.isArray(sub.data.images)) sub.data.images = sub.data.images.map(p => typeof p === 'string' ? p.split(old).join(nid) : p);
      }
    }

    // Modification d'item avec un nouveau nom : l'ID suit le nom (les références sont mises à jour après l'écriture)
    let _renameFrom = null;
    if (sub.type === 'item' && sub.isModification) {
      const exSnap = await getDoc(doc(db, 'items', String(dataId))).catch(() => null);
      if (exSnap?.exists() && sub.data.name && exSnap.data().name && sub.data.name !== exSnap.data().name) {
        const nid = _renamedItemId(String(dataId), exSnap.data().name, sub.data.name);
        if (nid) {
          const clash = await getDoc(doc(db, 'items', nid));
          if (clash.exists()) throw new Error(`Renommage impossible : un item avec l'ID « ${nid} » existe déjà.`);
          _renameFrom = String(dataId);
          dataId = nid;
          sub.data = { ...sub.data, id: nid };
        }
      }
    }

    {
      // Flux standard
      let dataToWrite = { _order: Date.now(), ...sub.data };
      // Panoplie : couleur par défaut si absente (définie par la modération côté liste)
      if (sub.type === 'panoplie' && !dataToWrite.color) dataToWrite.color = '#b87333';

      // Pour une modification : préserver l'ordre, les images et les contributeurs existants
      let _stdExistContribs = [];
      if (sub.isModification) {
        try {
          const existingSnap = await getDoc(doc(db, target, String(_renameFrom || dataId)));
          if (existingSnap.exists()) {
            const existing = existingSnap.data();
            if (existing._order != null) dataToWrite._order = existing._order;
            if (existing.ordre  != null) dataToWrite.ordre  = existing.ordre;
            if (existing.images?.length) dataToWrite.images = existing.images;
            else if (existing.image)     dataToWrite.image  = existing.image;
            // setDoc remplace le document : on reporte les champs que le Creator ne sait pas produire
            // (threshold, camera, morceaux, color…), sinon ils seraient effacés à l'approbation.
            const _managed = _CREATOR_MANAGED_KEYS[sub.type];
            if (_managed) {
              for (const [k, v] of Object.entries(existing)) {
                if (k in dataToWrite || _managed.has(k) || ['_order', '_contributor', '_updatedAt', 'ordre', 'images', 'image'].includes(k)) continue;
                dataToWrite[k] = v;
              }
              // palier Archive (-1) non sélectionnable dans le Creator : une soumission sans palier ne doit pas le faire disparaître
              if (!('palier' in dataToWrite) && existing.palier != null) dataToWrite.palier = existing.palier;
            }
            _stdExistContribs = _readContribs(existing);
          } else {
            toast(`⚠️ Modification approuvée comme nouvel ajout — "${dataId}" n'existait pas encore.`, 'warning', 6000);
          }
        } catch {}
      }
      dataToWrite._contributor = _mergeContributors(_stdExistContribs, _contribField, !!sub.isModification);

      let _imgPairs = [];
      if (_renameFrom && dataToWrite.images?.length) { const r = _renameImagePaths(dataToWrite.images, _renameFrom, String(dataId)); dataToWrite.images = r.images; _imgPairs = r.pairs; }

      await setDoc(doc(db, target, String(dataId)), dataToWrite);

      if (_renameFrom) { // ancien document supprimé, puis toutes les références pointent vers le nouvel ID
        await deleteDoc(doc(db, target, _renameFrom));
        try {
          const n = await _renameItemReferences(_renameFrom, String(dataId));
          await _recordItemRename(_renameFrom, String(dataId));
          toast(`ID renommé : ${_renameFrom} → ${dataId} (${n} document${n !== 1 ? 's' : ''} mis à jour)`, 'success', 7000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
        _writeAudit('rename_id', 'item', String(dataId), sub.data?.name || String(dataId), { from: _renameFrom, to: String(dataId) });
        _toastImageRenames(_imgPairs);
      }

      // Si l'entité était précédemment sensible, nettoyer les collections cachées
      if (sub.type === 'item') {
        // items_hidden est keyé par nameHash (pas item.id) — calculer le hash pour la suppression
        const cleanHash = await hashName(sub.data?.name || '').catch(() => '');
        try { await deleteDoc(doc(db, COL.itemsSecret, String(dataId))); } catch {}
        if (cleanHash) try { await deleteDoc(doc(db, COL.itemsHidden, cleanHash)); } catch {}
        // Fallback : si l'item avait été approuvé avec l'ancien système (clé = item.id)
        try { await deleteDoc(doc(db, COL.itemsHidden, String(dataId))); } catch {}
      } else if (sub.type === 'mob') {
        try { await deleteDoc(doc(db, COL.mobsSecret, String(dataId))); } catch {}
      } else if (sub.type === 'pnj') {
        try { await deleteDoc(doc(db, COL.pnjSecret, String(dataId))); } catch {}
      }

      // Invalider le store (cache + mémoire) pour forcer un re-fetch sur les pages de lecture
      const storeKey = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quest:'quetes', panoplie:'panoplies' }[sub.type];
      if (storeKey) {
        store.invalidate(storeKey);
        // Bump wiki_version pour notifier les autres onglets/pages
        setDoc(doc(db, 'config', 'wiki_version'), { lastUpdated: serverTimestamp(), collection: storeKey }, { merge: true }).catch(() => {});
      }

      // PNJ approuvé : ses items fabriqués / vendus reçoivent la source d'obtention correspondante
      if (sub.type === 'pnj') {
        _syncPnjObtain({ ...dataToWrite, id: String(dataId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain PNJ]', e));
      }

      // Mob approuvé : les items de son loot reçoivent / mettent à jour la ligne « Obtenable en tuant »
      if (sub.type === 'mob') {
        _syncMobObtain({ ...dataToWrite, id: String(dataId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain mob]', e));
      }

      // Item approuvé : les PNJ qui le fabriquent / vendent déjà y écrivent leur source d'obtention
      if (sub.type === 'item') {
        _syncItemObtain(String(dataId)).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain item]', e));
      }

      // Si PNJ approuvé et panneau d'ordre ouvert, le recharger
      if (sub.type === 'pnj') {
        invalidateModCache('personnages');
        if (document.getElementById('pnj-order-panel')?.style.display !== 'none') {
          loadPnjOrder().catch(() => {});
        }
      }
    }

    // Mettre à jour la soumission
    const subUpdate = {
      status:     'approved',
      reviewedBy: currentUser.uid,
      reviewedAt: serverTimestamp(),
      comment,
    };
    await updateDoc(doc(db, 'submissions', id), subUpdate);

    sub.status     = 'approved';
    sub.comment    = comment;
    sub.reviewedBy = currentUser.uid;
    _writeAudit('approve', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type, comment });
    updateCounts();
    renderSubs();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✓ Approuver'; }
  }
};

// ── Reject ────────────────────────────────────────────
window.reject = async (id) => {
  const sub     = allSubs.find(s => s._id === id);
  if (!sub) return;
  const comment = document.getElementById(`comment-${id}`)?.value?.trim() || '';
  const btn     = document.querySelector(`#card-${id} .btn-reject`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    await updateDoc(doc(db, 'submissions', id), {
      status:     'rejected',
      reviewedBy: currentUser.uid,
      reviewedAt: serverTimestamp(),
      comment,
    });

    sub.status     = 'rejected';
    sub.comment    = comment;
    sub.reviewedBy = currentUser.uid;
    _writeAudit('reject', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type, comment });
    updateCounts();
    renderSubs();

    // Avertissement si d'autres soumissions en attente référencent cet élément
    const rejectedId = sub.data?.id;
    if (rejectedId) {
      const refs = allSubs.filter(s => s._id !== id && s.status === 'pending' && (
        s.data?.region === rejectedId ||
        s.data?.craft?.some?.(c => c.id === rejectedId) ||
        s.data?.loot?.some?.(l => l.id === rejectedId)
      ));
      if (refs.length) {
        toast(`⚠️ ${refs.length} soumission(s) en attente référencent cet élément.`, 'warning', 6000);
      }
    }
    _refreshOrphanCount();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✕ Rejeter'; }
  }
};

// ── Restore to pending ────────────────────────────────
window.restorePending = async (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (!sub) return;
  try {
    await updateDoc(doc(db, 'submissions', id), {
      status:     'pending',
      reviewedBy: null,
      reviewedAt: null,
      comment:    null,
    });
    sub.status     = 'pending';
    sub.reviewedBy = null;
    sub.reviewedAt = null;
    sub.comment    = null;
    _writeAudit('restore_pending', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type });
    updateCounts();
    renderSubs();
    toast('🔄 Soumission remise en attente.', 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ── Request changes ───────────────────────────────────
window.requestChanges = async (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (!sub) return;

  const sharedComment = document.getElementById(`comment-${id}`)?.value?.trim() || '';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:10000;';
  overlay.innerHTML = `
    <div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#333);border-radius:8px;padding:22px 20px 18px;max-width:420px;width:90%;font-family:'JetBrains Mono',monospace;">
      <div style="font-size:13px;color:var(--text,#ddd);margin-bottom:12px;">💬 Indiquer les modifications demandées :</div>
      <textarea id="_vcl-cr-ta" style="width:100%;min-height:80px;box-sizing:border-box;background:var(--surface2,#2a2a3e);border:1px solid var(--border,#444);border-radius:4px;color:var(--text,#ddd);font-size:12px;padding:8px;resize:vertical;" placeholder="Ex : merci d'ajouter le lore et l'image…"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button class="btn btn-ghost" id="_vcl-cr-cancel" style="font-size:12px;">Annuler</button>
        <button class="btn" id="_vcl-cr-ok" style="font-size:12px;background:var(--warn,#f59e0b);color:#111;">💬 Envoyer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (sharedComment) overlay.querySelector('#_vcl-cr-ta').value = sharedComment;

  await new Promise(resolve => {
    overlay.querySelector('#_vcl-cr-cancel').addEventListener('click', () => { overlay.remove(); resolve(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(); } });
    overlay.querySelector('#_vcl-cr-ok').addEventListener('click', async () => {
      const comment = overlay.querySelector('#_vcl-cr-ta').value.trim();
      if (!comment) { overlay.querySelector('#_vcl-cr-ta').style.border = '1px solid var(--danger,#e74c3c)'; return; }
      overlay.querySelector('#_vcl-cr-ok').disabled = true;
      try {
        await updateDoc(doc(db, 'submissions', id), {
          status: 'changes_requested',
          changeRequestComment: comment,
          comment,
          reviewedBy: currentUser.uid,
          reviewedAt: serverTimestamp(),
        });
        sub.status = 'changes_requested';
        sub.changeRequestComment = comment;
        sub.comment = comment;
        sub.reviewedBy = currentUser.uid;
        _writeAudit('changes_requested', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { comment });
        updateCounts();
        renderSubs();
        toast('💬 Modifications demandées', 'info');
      } catch(e) { toast('⛔ Erreur : ' + e.message, 'error'); }
      overlay.remove();
      resolve();
    });
  });
};

// ── Mob order panel ───────────────────────────────────
let _mobOrderData       = [];
let _mobOrderDirty      = false;
let _dragSrc            = null;
let _mobPalierCollapsed = new Set();
let _mobCollapseInit   = false;

const TYPE_ORDER_MOD  = { monstre: 0, sbire: 1, mini_boss: 2, boss: 3, worldboss: 4 };
const TYPE_LABELS_MOD = { monstre: 'Monstre', sbire: 'Sbire', mini_boss: 'Mini-boss', boss: 'Boss', worldboss: 'WorldBoss' };

function mobTag(mob) {
  return `P${mob.palier||1} ${TYPE_LABELS_MOD[mob.type]||mob.type}`;
}

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
  'migration':        () => showMigration(),
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
  'titres-tool':          () => showTitresTool(),
  'game-config':          () => showGameConfig(),
  'audit-log':            () => showAuditLog(),
  'tags':                 () => showTagsPanel(),
  'statistiques':         () => showStatistiques(),
  'bugs-connus':          () => showBugsConnus(),
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
let _panelCtx = null;
function _getPanelCtx() {
  return _panelCtx ??= {
    db, collection, getDocs, getDoc, doc, query, orderBy, where, limit, updateDoc, setDoc, addDoc, deleteDoc, writeBatch, serverTimestamp,
    deleteField, ROLES, anonName, hashName, sanitizeForFirestore, loadEventNames, WORKER_URL,
    getWorkerSecret: _getWorkerSecret, loadExternalScript: _loadExternalScript,
    toast, modal, store, escHtml, COL, get MANAGED_TIERS() { return MANAGED_TIERS; },
    setHash: _setHash, showPanel: _showPanel, cachedDocs, invalidateModCache, writeAudit: _writeAudit,
    get role() { return currentRole; },
    get user() { return currentUser; },
    userNames: _userNames,
    get allSubs() { return allSubs; },
    get customRoles() { return _customRoles; },
    getTierDisplay: _getTierDisplay,
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
      { label: 'Visibilité', tabs: [
        { hash: 'migration', label: '🔒 Sensible', btn: 'btn-migration', panel: 'migration-panel', fn: () => showMigration() },
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
        { hash: 'titres-tool',  label: '🏅 Titres',     btn: 'btn-titres-tool',  panel: 'titres-tool-panel',  fn: () => showTitresTool() },
        { hash: 'tags',         label: '🏷️ Tags',       btn: 'btn-tags',         panel: 'tags-panel',         fn: () => showTagsPanel() },
      ]},
      { label: 'Communication', tabs: [
        { hash: 'bugs-connus',  label: '🐛 Bugs connus',      btn: 'btn-bugs-connus',      panel: 'bugs-connus-panel',      fn: () => showBugsConnus() },
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
    b.classList.toggle('active', b.dataset.status === filterStatus)
  );
  const sel = document.getElementById('filter-type-select');
  if (sel) sel.value = filterType;
}

window.showMobOrder = async () => {
  _setHash('mob-order');
  document.getElementById('mob-order-panel').style.display = '';
  document.getElementById('btn-mob-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadMobOrder();
};

async function loadMobOrder() {
  const listEl = document.getElementById('mob-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _mobOrderDirty = false;
  document.getElementById('btn-save-order').disabled = true;
  try {
    const mobs = [...(await cachedDocs('mobs'))];
    // Contributeurs+ : inclure les mobs sensibles
    if (hasRole(currentRole, 'contributeur')) {
      const secret = await cachedDocs(COL.mobsSecret).catch(() => []);
      const existingIds = new Set(mobs.map(m => String(m.id)));
      for (const s of secret) {
        if (!existingIds.has(String(s.id))) mobs.push({ ...s, _sensible: true });
      }
    }
    // Tri initial : ordre existant → palier → type → nom
    mobs.sort((a, b) => {
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      if ((a.palier||1) !== (b.palier||1)) return (a.palier||1) - (b.palier||1);
      const ta = TYPE_ORDER_MOD[a.type]??99, tb = TYPE_ORDER_MOD[b.type]??99;
      if (ta !== tb) return ta - tb;
      return (a.name||'').localeCompare(b.name||'');
    });
    _mobOrderData = mobs;
    renderMobOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

function renderMobOrder() {
  const listEl  = document.getElementById('mob-order-list');
  const searchQ = normalize(document.getElementById('mob-order-search').value.trim());
  listEl.innerHTML = '';

  // ── Mode recherche : liste plate, positions globales, pas de drag ──
  if (searchQ) {
    const visible = _mobOrderData.filter(m => fuzzyMatch(searchQ, m.name));
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(mob => {
      const row = document.createElement('div');
      row.className = 'mob-order-row';
      row.dataset.id = mob.id;
      const globalIdx = _mobOrderData.indexOf(mob) + 1;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${globalIdx}</span>
        <span class="mob-order-name">${mob.name||mob.id}${mob._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
        <span class="mob-order-tag">${mobTag(mob)}</span>
        <button class="ed-edit-btn" title="Modifier : ${mob.name||mob.id}\nID : ${mob.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(mob._sensible ? 'mobs_secret' : 'mobs', mob.id, mob, 'mob'); });
      _addCreatorBtn(row, 'mob', mob);
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : groupes par palier ──
  const paliers = [...new Set(_mobOrderData.map(m => m.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucun mob</div>'; return; }
  if (!_mobCollapseInit) { _mobCollapseInit = true; paliers.forEach(p => _mobPalierCollapsed.add(p)); }

  paliers.forEach(palier => {
    const palierMobs = _mobOrderData.filter(m => (m.palier||1) === palier);
    const collapsed  = _mobPalierCollapsed.has(palier);

    const section = document.createElement('div');
    section.className = 'palier-section';

    const ph = document.createElement('div');
    ph.className = 'palier-section-header';
    ph.innerHTML = `
      <span style="flex:1;">Palier ${palier}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:400;">${palierMobs.length} mob${palierMobs.length>1?'s':''}</span>
      <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;line-height:1;" title="${collapsed?'Dérouler':'Réduire'}">${collapsed?'▶':'▼'}</button>`;
    ph.addEventListener('click', () => {
      if (_mobPalierCollapsed.has(palier)) _mobPalierCollapsed.delete(palier);
      else _mobPalierCollapsed.add(palier);
      renderMobOrder();
    });
    section.appendChild(ph);

    const body = document.createElement('div');
    body.className = 'palier-section-body';
    body.style.display = collapsed ? 'none' : '';

    palierMobs.forEach(mob => {
      const palierIdx = palierMobs.indexOf(mob);
      const row = document.createElement('div');
      row.className  = 'mob-order-row';
      row.draggable  = true;
      row.dataset.id = mob.id;
      row.innerHTML  = `
        <span class="mob-order-handle">⠿</span>
        <input type="number" class="mob-order-index" value="${palierIdx+1}" min="1" max="${palierMobs.length}" title="Position dans ce palier">
        <span class="mob-order-name">${mob.name||mob.id}${mob._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
        <span class="mob-order-tag">${mobTag(mob)}</span>
        <button class="ed-edit-btn" title="Modifier : ${mob.name||mob.id}\nID : ${mob.id}" draggable="false">✏️</button>`;

      const indexInput = row.querySelector('.mob-order-index');
      indexInput.addEventListener('click', e => e.stopPropagation());
      indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
      indexInput.addEventListener('change', () => {
        let toPalierIdx = parseInt(indexInput.value, 10) - 1;
        toPalierIdx = Math.max(0, Math.min(palierMobs.length - 1, toPalierIdx));
        if (toPalierIdx === palierIdx) { indexInput.value = palierIdx + 1; return; }
        const fromGlobal = _mobOrderData.indexOf(mob);
        const [removed]  = _mobOrderData.splice(fromGlobal, 1);
        const nowPalier  = _mobOrderData.filter(m => (m.palier||1) === palier);
        const insertAt   = toPalierIdx < nowPalier.length
          ? _mobOrderData.indexOf(nowPalier[toPalierIdx])
          : (_mobOrderData.indexOf(nowPalier[nowPalier.length-1]) + 1 || _mobOrderData.length);
        _mobOrderData.splice(insertAt, 0, removed);
        _mobOrderDirty = true;
        document.getElementById('btn-save-order').disabled = false;
        renderMobOrder();
      });

      row.addEventListener('dragstart', e => { if (e.target.closest('.ed-edit-btn')) { e.preventDefault(); return; } _dragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend',   () => row.classList.remove('dragging'));
      row.addEventListener('dragover',  e => { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drag-over');
        if (!_dragSrc || _dragSrc === row) return;
        const fromMob = _mobOrderData.find(m => m.id === _dragSrc.dataset.id);
        const toMob   = _mobOrderData.find(m => m.id === row.dataset.id);
        if (!fromMob || !toMob || (fromMob.palier||1) !== (toMob.palier||1)) return;
        const fromIdx = _mobOrderData.findIndex(m => m.id === _dragSrc.dataset.id);
        const toIdx   = _mobOrderData.findIndex(m => m.id === row.dataset.id);
        if (fromIdx === -1 || toIdx === -1) return;
        const [moved] = _mobOrderData.splice(fromIdx, 1);
        _mobOrderData.splice(toIdx, 0, moved);
        _mobOrderDirty = true;
        document.getElementById('btn-save-order').disabled = false;
        renderMobOrder();
      });
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(mob._sensible ? 'mobs_secret' : 'mobs', mob.id, mob, 'mob'); });
      _addCreatorBtn(row, 'mob', mob);

      body.appendChild(row);
    });
    section.appendChild(body);
    listEl.appendChild(section);
  });
}

window.filterMobOrder = () => {
  renderMobOrder();
};

window.saveMobOrder = async () => {
  if (!_mobOrderDirty) return;
  const btn = document.getElementById('btn-save-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';

  // Écrire ordre = position (1-based) pour chaque mob dans l'ordre actuel
  let ok = 0, err = 0;
  for (let i = 0; i < _mobOrderData.length; i++) {
    try {
      await updateDoc(doc(db, 'mobs', _mobOrderData[i].id), { ordre: i + 1 });
      ok++;
    } catch(e) {
      console.error(_mobOrderData[i].id, e);
      err++;
    }
  }

  // Invalider les caches
  localStorage.removeItem('vcl_cache_v2_mobs');
  localStorage.removeItem('vcl_cache_meta_v2_mobs');
  invalidateModCache('mobs');

  _mobOrderDirty = false;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? `⚠️ Erreur lors de la sauvegarde.` : `✓ Ordre sauvegardé (${ok} mobs, err ? 'error' : 'success').`);
  document.getElementById('mob-order-search').value = '';
  await loadMobOrder();
};

// ── Item order panel ──────────────────────────────────
let _itemOrderData       = [];
let _itemOrderDirty      = false;
let _itemDragSrc         = null;  // drag item
let _itemCatDragSrc      = null;  // drag catégorie { palier, cat }
let _itemPalierCollapsed = new Set();
let _itemCatCollapsed    = new Set(); // clé : `${palier}:${cat}`
let _itemCollapseInit    = false;

const ITEM_CATEGORIES = {
  materiaux:   { label: 'Matériaux',       emoji: '🧱' },
  quete:       { label: 'Objets de Quête', emoji: '📜' },
  ressources:  { label: 'Ressources',      emoji: '⛏️' },
  nourriture:  { label: 'Nourriture',      emoji: '🍖' },
  consommable: { label: 'Consommables',    emoji: '🧪' },
  arme:        { label: 'Armes',           emoji: '⚔️' },
  armure:      { label: 'Armures',         emoji: '🛡️' },
  accessoire:  { label: 'Accessoires',     emoji: '💍' },
  outils:      { label: 'Outils',          emoji: '🛠️' },
  rune:        { label: 'Runes',           emoji: '🔮' },
  parchemin:   { label: 'Parchemins',      emoji: '📃' },
  donjon:      { label: 'Donjon',          emoji: '🏰' },
  monnaie:     { label: 'Monnaie',         emoji: '🪙' },
};

function itemCatLabel(cat) {
  const c = ITEM_CATEGORIES[cat];
  return c ? `${c.emoji} ${c.label}` : cat || '—';
}

const RARITY_ORDER_MOD = ['commun','rare','epique','legendaire','mythique','godlike','event'];
function itemTag(item) {
  const r = RARITY_ORDER_MOD.includes(item.rarity) ? item.rarity : (item.rarity || '');
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : (item.type || '—');
}

window.showItemOrder = async () => {
  _setHash('item-order');
  document.getElementById('item-order-panel').style.display = '';
  document.getElementById('btn-item-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadItemOrder();
};

async function loadItemOrder() {
  const listEl = document.getElementById('item-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _itemOrderDirty = false;
  document.getElementById('btn-save-item-order').disabled = true;
  try {
    let items = [...(await cachedDocs('items'))];

    // Contributeurs+ : inclure les items sensibles (items_hidden)
    if (hasRole(currentRole, 'contributeur')) {
      const hidden = await cachedDocs(COL.itemsHidden).catch(() => []);
      const existingIds = new Set(items.map(i => String(i.id)));
      for (const h of hidden) {
        if (!existingIds.has(String(h.id))) {
          items.push({ ...h, _sensible: true });
        }
      }
    }

    // Tri initial : ordre existant → _order (timestamp approbation) → nom
    items.sort((a, b) => {
      const ao = a.ordre ?? null, bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      // items sans ordre : par _order (timestamp), puis nom
      const at = a._order ?? 0, bt = b._order ?? 0;
      if (at !== bt) return at - bt;
      return (a.name||'').localeCompare(b.name||'');
    });
    _itemOrderData = items;
    renderItemOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

function renderItemOrder() {
  const listEl  = document.getElementById('item-order-list');
  const searchQ = normalize(document.getElementById('item-order-search').value.trim());
  listEl.innerHTML = '';

  // ── Mode recherche : liste plate avec position globale ──
  if (searchQ) {
    const visible = _itemOrderData.filter(it => fuzzyMatch(searchQ, it.name));
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(item => {
      const row = document.createElement('div');
      row.className  = 'mob-order-row';
      row.dataset.id = item.id;
      const globalIdx = _itemOrderData.indexOf(item) + 1;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${globalIdx}</span>
        <span class="mob-order-name">${item.name||item.id}</span>
        <span class="mob-order-tag">${itemCatLabel(item.category)} · ${itemTag(item)}</span>
        <button class="ed-edit-btn" title="Modifier : ${item.name||item.id}\nID : ${item.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('items', item.id, item, 'item'); });
      _addCreatorBtn(row, 'item', item);
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : palier → catégorie → items ──
  const paliers = [...new Set(_itemOrderData.map(it => it.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucun item</div>'; return; }
  if (!_itemCollapseInit) { _itemCollapseInit = true; paliers.forEach(p => _itemPalierCollapsed.add(p)); }

  paliers.forEach(palier => {
    const palierItems    = _itemOrderData.filter(it => (it.palier||1) === palier);
    const palierCollapsed = _itemPalierCollapsed.has(palier);

    const section = document.createElement('div');
    section.className = 'palier-section';

    const ph = document.createElement('div');
    ph.className = 'palier-section-header';
    ph.innerHTML = `
      <span style="flex:1;">Palier ${palier}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:400;">${palierItems.length} item${palierItems.length>1?'s':''}</span>
      <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;line-height:1;" title="${palierCollapsed?'Dérouler':'Réduire'}">${palierCollapsed?'▶':'▼'}</button>`;
    ph.addEventListener('click', () => {
      if (_itemPalierCollapsed.has(palier)) _itemPalierCollapsed.delete(palier);
      else _itemPalierCollapsed.add(palier);
      renderItemOrder();
    });
    section.appendChild(ph);

    const palierBody = document.createElement('div');
    palierBody.className = 'palier-section-body';
    palierBody.style.display = palierCollapsed ? 'none' : '';

    // Catégories dans l'ordre d'apparition dans _itemOrderData (reflète l'ordre admin)
    const cats = [...new Set(palierItems.map(it => it.category || ''))];

    cats.forEach(cat => {
      const catItems     = palierItems.filter(it => (it.category||'') === cat);
      const catKey       = `${palier}:${cat}`;
      const catCollapsed = _itemCatCollapsed.has(catKey);

      const catSection = document.createElement('div');
      catSection.className  = 'mob-order-row';
      catSection.draggable  = true;
      catSection.dataset.cat    = cat;
      catSection.dataset.palier = palier;
      catSection.style.cssText  = 'flex-direction:column;align-items:stretch;padding:0;margin-bottom:4px;cursor:default;background:var(--surface2);';

      // ── En-tête de catégorie (draggable) ──
      const ch = document.createElement('div');
      ch.style.cssText = `
        display:flex;align-items:center;gap:8px;padding:6px 10px 6px 10px;
        border-radius:6px 6px 0 0;cursor:grab;user-select:none;`;
      ch.innerHTML = `
        <span class="mob-order-handle" style="font-size:16px;">⠿</span>
        <span style="flex:1;font-size:12px;font-weight:700;color:var(--text);">${itemCatLabel(cat)}</span>
        <span style="font-size:11px;color:var(--muted);font-weight:400;">${catItems.length} item${catItems.length>1?'s':''}</span>
        <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:12px;padding:0 4px;line-height:1;">${catCollapsed?'▶':'▼'}</button>`;

      ch.addEventListener('click', e => {
        e.stopPropagation();
        if (_itemCatCollapsed.has(catKey)) _itemCatCollapsed.delete(catKey);
        else _itemCatCollapsed.add(catKey);
        renderItemOrder();
      });
      catSection.appendChild(ch);

      // ── Drag catégorie ──
      catSection.addEventListener('dragstart', e => {
        if (_itemDragSrc) return; // un item est déjà en cours de drag
        _itemCatDragSrc = { palier, cat };
        catSection.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.stopPropagation();
      });
      catSection.addEventListener('dragend', () => {
        catSection.classList.remove('dragging');
        _itemCatDragSrc = null;
      });
      catSection.addEventListener('dragover', e => {
        if (!_itemCatDragSrc || _itemCatDragSrc.palier !== palier || _itemCatDragSrc.cat === cat) return;
        e.preventDefault();
        e.stopPropagation();
        catSection.classList.add('drag-over');
      });
      catSection.addEventListener('dragleave', () => catSection.classList.remove('drag-over'));
      catSection.addEventListener('drop', e => {
        e.preventDefault();
        e.stopPropagation();
        catSection.classList.remove('drag-over');
        if (!_itemCatDragSrc || _itemCatDragSrc.palier !== palier || _itemCatDragSrc.cat === cat) return;

        const srcCat   = _itemCatDragSrc.cat;
        const srcItems = _itemOrderData.filter(it => (it.palier||1) === palier && (it.category||'') === srcCat);

        // Retirer les items source de _itemOrderData
        srcItems.forEach(it => {
          const idx = _itemOrderData.indexOf(it);
          if (idx !== -1) _itemOrderData.splice(idx, 1);
        });

        // Trouver le premier item de la catégorie cible (après suppression des sources)
        const firstTargetIdx = _itemOrderData.findIndex(it => (it.palier||1) === palier && (it.category||'') === cat);
        const insertAt = firstTargetIdx === -1 ? _itemOrderData.length : firstTargetIdx;

        _itemOrderData.splice(insertAt, 0, ...srcItems);
        _itemOrderDirty = true;
        document.getElementById('btn-save-item-order').disabled = false;
        _itemCatDragSrc = null;
        renderItemOrder();
      });

      // ── Corps : items de la catégorie ──
      const catBody = document.createElement('div');
      catBody.style.cssText = `padding:0 4px 4px 8px;${catCollapsed ? 'display:none;' : ''}`;

      catItems.forEach(item => {
        const catIdx = catItems.indexOf(item);
        const row = document.createElement('div');
        row.className  = 'mob-order-row';
        row.draggable  = true;
        row.dataset.id = item.id;
        row.style.cssText = 'margin-top:3px;';
        row.innerHTML  = `
          <span class="mob-order-handle">⠿</span>
          <input type="number" class="mob-order-index" value="${catIdx+1}" min="1" max="${catItems.length}" title="Position dans cette catégorie">
          <span class="mob-order-name">${item.name||item.id}${item._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
          <span class="mob-order-tag">${itemTag(item)}</span>
          <button class="ed-edit-btn" title="Modifier : ${item.name||item.id}\nID : ${item.id}" draggable="false">✏️</button>`;

        const indexInput = row.querySelector('.mob-order-index');
        indexInput.addEventListener('click', e => e.stopPropagation());
        indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
        indexInput.addEventListener('change', () => {
          let toCatIdx = parseInt(indexInput.value, 10) - 1;
          toCatIdx = Math.max(0, Math.min(catItems.length - 1, toCatIdx));
          if (toCatIdx === catIdx) { indexInput.value = catIdx + 1; return; }
          const fromGlobal = _itemOrderData.indexOf(item);
          const [removed]  = _itemOrderData.splice(fromGlobal, 1);
          const nowCat     = _itemOrderData.filter(it => (it.palier||1) === palier && (it.category||'') === cat);
          const insertAt   = toCatIdx < nowCat.length
            ? _itemOrderData.indexOf(nowCat[toCatIdx])
            : (_itemOrderData.indexOf(nowCat[nowCat.length-1]) + 1 || _itemOrderData.length);
          _itemOrderData.splice(insertAt, 0, removed);
          _itemOrderDirty = true;
          document.getElementById('btn-save-item-order').disabled = false;
          renderItemOrder();
        });

        row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('items', item.id, item, 'item'); });
        _addCreatorBtn(row, 'item', item);
        row.addEventListener('dragstart', e => {
          if (e.target.closest('.ed-edit-btn') || _itemCatDragSrc) return;
          _itemDragSrc = row;
          row.classList.add('dragging');
          e.dataTransfer.effectAllowed = 'move';
          e.stopPropagation();
        });
        row.addEventListener('dragend', () => { row.classList.remove('dragging'); _itemDragSrc = null; });
        row.addEventListener('dragover', e => {
          if (_itemCatDragSrc) return;
          e.preventDefault();
          e.stopPropagation();
          row.classList.add('drag-over');
        });
        row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
        row.addEventListener('drop', e => {
          e.preventDefault();
          e.stopPropagation();
          row.classList.remove('drag-over');
          if (_itemCatDragSrc || !_itemDragSrc || _itemDragSrc === row) return;
          const fromItem = _itemOrderData.find(it => it.id === _itemDragSrc.dataset.id);
          const toItem   = _itemOrderData.find(it => it.id === row.dataset.id);
          if (!fromItem || !toItem) return;
          if ((fromItem.palier||1) !== (toItem.palier||1)) return;
          if ((fromItem.category||'') !== (toItem.category||'')) return;
          const fromIdx = _itemOrderData.findIndex(it => it.id === _itemDragSrc.dataset.id);
          const toIdx   = _itemOrderData.findIndex(it => it.id === row.dataset.id);
          if (fromIdx === -1 || toIdx === -1) return;
          const [moved] = _itemOrderData.splice(fromIdx, 1);
          _itemOrderData.splice(toIdx, 0, moved);
          _itemOrderDirty = true;
          document.getElementById('btn-save-item-order').disabled = false;
          renderItemOrder();
        });

        catBody.appendChild(row);
      });

      catSection.appendChild(catBody);
      palierBody.appendChild(catSection);
    });

    section.appendChild(palierBody);
    listEl.appendChild(section);
  });
}

window.filterItemOrder = () => renderItemOrder();

window.saveItemOrder = async () => {
  if (!_itemOrderDirty) return;
  const btn = document.getElementById('btn-save-item-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, err = 0;
  for (let i = 0; i < _itemOrderData.length; i++) {
    try {
      await updateDoc(doc(db, 'items', _itemOrderData[i].id), { ordre: i + 1 });
      ok++;
    } catch(e) { console.error(_itemOrderData[i].id, e); err++; }
  }
  localStorage.removeItem('vcl_cache_v2_items');
  localStorage.removeItem('vcl_cache_meta_v2_items');
  invalidateModCache('items');
  _cachedSets = null;
  _itemOrderDirty = false;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? '⚠️ Erreur lors de la sauvegarde.' : `✓ Ordre sauvegardé (${ok} items, err ? 'error' : 'success').`);
  document.getElementById('item-order-search').value = '';
  await loadItemOrder();
};

// ── PNJ order panel ───────────────────────────────────
// _pnjRegions = [{id, name, pnjs:[{id,name,region,...},...]},...] dans l'ordre drag
let _pnjRegions         = [];
let _pnjDirty           = false;
let _pnjDragSrc         = null;  // drag région
let _pnjItemDragSrc     = null;  // drag PNJ individuel
let _pnjCollapsed       = new Set(); // IDs de régions réduites
let _pnjCollapseInit    = false;
let _pnjPalierCollapsed = new Set(); // paliers réduits

window.showPnjOrder = async () => {
  _setHash('pnj-order');
  document.getElementById('pnj-order-panel').style.display = '';
  document.getElementById('btn-pnj-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadPnjOrder();
};

async function loadPnjOrder() {
  const listEl = document.getElementById('pnj-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _pnjDirty = false;
  document.getElementById('btn-save-pnj-order').disabled = true;
  try {
    const [_pnjPublic, _regDocsRaw] = await Promise.all([
      cachedDocs('personnages'),
      cachedDocs('regions'),
    ]);
    const pnjs = [..._pnjPublic];
    // Contributeurs+ : inclure les PNJ sensibles
    if (hasRole(currentRole, 'contributeur')) {
      const secret = await cachedDocs(COL.pnjSecret).catch(() => []);
      const existingIds = new Set(pnjs.map(p => String(p.id)));
      for (const s of secret) {
        if (!existingIds.has(String(s.id))) pnjs.push({ ...s, _sensible: true });
      }
    }

    // Index canonique des régions par id ET par nom normalisé. `pnj.region` stocke
    // habituellement l'id snake_case ("ville_de_depart") mais peut aussi contenir
    // le nom humain selon les anciennes données — on accepte les deux.
    const regById       = new Map();
    const regByNormName = new Map();
    _regDocsRaw.forEach(r => {
      const name = r.name || r.id;
      regById.set(r.id, { id: r.id, name });
      regByNormName.set(normalize(name), { id: r.id, name });
    });

    // Grouper les PNJ par id canonique de région
    const byRegionId = {};
    pnjs.forEach(p => {
      const raw = p.region || '';
      if (!raw) {
        (byRegionId[''] ||= []).push(p);
        return;
      }
      const canon = regById.get(raw) ?? regByNormName.get(normalize(raw));
      if (canon) {
        (byRegionId[canon.id] ||= []).push(p);
      } else {
        // Région inconnue : préfixe pour distinguer des ids réels
        (byRegionId['__raw__' + raw] ||= []).push(p);
      }
    });

    // Trier les PNJ dans chaque groupe par ordre admin puis alpha
    Object.values(byRegionId).forEach(arr => arr.sort((a, b) => {
      const ao = a.ordre ?? null, bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return (a.name||'').localeCompare(b.name||'', 'fr');
    }));

    // Régions connues depuis Firestore, triées par leur ordre actuel
    const regDocs = [..._regDocsRaw].sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999));

    // Construire _pnjRegions :
    // 1. Régions connues — clé = doc.id, libellé = doc.name (humain)
    _pnjRegions = regDocs.map(r => {
      const name = r.name || r.id;
      return { id: r.id, name, pnjs: byRegionId[r.id] || [] };
    });

    // 2. Régions inconnues (référence brute non résolue), triées alphabétiquement
    const unknownKeys = Object.keys(byRegionId)
      .filter(k => k.startsWith('__raw__'))
      .sort((a, b) => a.localeCompare(b, 'fr'));
    unknownKeys.forEach(k => {
      const rawName = k.slice('__raw__'.length);
      _pnjRegions.push({ id: '__unknown__' + rawName, name: rawName, pnjs: byRegionId[k] });
    });

    // 3. PNJ sans région
    if (byRegionId['']?.length) {
      _pnjRegions.push({ id: '__none__', name: '', pnjs: byRegionId[''] });
    }

    renderPnjOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

function _makePnjRegionGroup(group, gi, palierPnjs, palier) {
  const collapsed = _pnjCollapsed.has(group.id);
  const groupEl   = document.createElement('div');
  groupEl.dataset.gi    = gi;
  groupEl.style.cssText = 'margin-bottom:4px;';

  const header = document.createElement('div');
  header.draggable = true;
  header.style.cssText = `
    display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:6px;
    background:var(--surface2);border:1px solid var(--border);
    cursor:grab;user-select:none;margin-bottom:3px;
    font-size:12px;font-weight:700;color:var(--accent);
    transition:border-color .1s,background .1s;`;
  header.innerHTML = `
    <span style="font-size:15px;color:var(--muted);">⠿</span>
    <span style="flex:1;">${group.name || '— Sans région —'}</span>
    <span style="font-size:11px;color:var(--muted);font-weight:400;">${palierPnjs.length} PNJ</span>
    <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;line-height:1;" title="${collapsed?'Dérouler':'Réduire'}">${collapsed?'▶':'▼'}</button>`;

  header.addEventListener('click', () => {
    if (_pnjCollapsed.has(group.id)) _pnjCollapsed.delete(group.id);
    else _pnjCollapsed.add(group.id);
    renderPnjOrder();
  });
  header.addEventListener('dragstart', e => {
    if (_pnjItemDragSrc) return;
    _pnjDragSrc = groupEl; groupEl.style.opacity = '.35';
    e.dataTransfer.effectAllowed = 'move';
    e.stopPropagation();
  });
  header.addEventListener('dragend', () => {
    groupEl.style.opacity = '';
    document.querySelectorAll('#pnj-order-list [data-gi]').forEach(g => { g.style.outline = ''; });
    _pnjDragSrc = null;
  });
  header.addEventListener('dragover', e => {
    if (_pnjItemDragSrc || !_pnjDragSrc || _pnjDragSrc === groupEl) return;
    e.preventDefault(); e.stopPropagation();
    groupEl.style.outline = '2px solid var(--accent)';
  });
  header.addEventListener('dragleave', () => { groupEl.style.outline = ''; });
  header.addEventListener('drop', e => {
    e.preventDefault(); e.stopPropagation();
    groupEl.style.outline = '';
    if (_pnjItemDragSrc || !_pnjDragSrc || _pnjDragSrc === groupEl) return;
    const fromGi = parseInt(_pnjDragSrc.dataset.gi, 10);
    const toGi   = parseInt(groupEl.dataset.gi, 10);
    if (isNaN(fromGi) || isNaN(toGi)) return;
    const [moved] = _pnjRegions.splice(fromGi, 1);
    _pnjRegions.splice(toGi, 0, moved);
    _pnjDirty = true;
    document.getElementById('btn-save-pnj-order').disabled = false;
    _pnjDragSrc = null;
    renderPnjOrder();
  });

  groupEl.appendChild(header);

  const pnjList = document.createElement('div');
  pnjList.style.cssText = `padding:0 4px 2px 8px;${collapsed ? 'display:none;' : ''}`;

  palierPnjs.forEach(pnj => {
    const pnjIdx = palierPnjs.indexOf(pnj);
    const row = document.createElement('div');
    row.className    = 'mob-order-row';
    row.draggable    = true;
    row.dataset.id   = pnj.id;
    row.dataset.gi   = gi;
    row.style.cssText = 'margin-top:3px;';
    row.innerHTML = `
      <span class="mob-order-handle">⠿</span>
      <input type="number" class="mob-order-index" value="${pnjIdx+1}" min="1" max="${palierPnjs.length}" title="Position dans cette région">
      <span class="mob-order-name">${pnj.name||pnj.id}${pnj._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
      <button class="ed-edit-btn" title="Modifier : ${pnj.name||pnj.id}\nID : ${pnj.id}" draggable="false">✏️</button>`;

    const indexInput = row.querySelector('.mob-order-index');
    indexInput.addEventListener('click', e => e.stopPropagation());
    indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
    indexInput.addEventListener('change', () => {
      let toIdx = parseInt(indexInput.value, 10) - 1;
      toIdx = Math.max(0, Math.min(palierPnjs.length - 1, toIdx));
      if (toIdx === pnjIdx) { indexInput.value = pnjIdx + 1; return; }
      const fromIdx = group.pnjs.indexOf(pnj);
      group.pnjs.splice(fromIdx, 1);
      // palierPnjs est un sous-ensemble de group.pnjs pour ce palier
      // recalculer la position globale dans group.pnjs
      const nowPalierPnjs = group.pnjs.filter(p => (p.palier||1) === palier);
      const insertBefore  = nowPalierPnjs[toIdx];
      if (insertBefore) {
        const insertAt = group.pnjs.indexOf(insertBefore);
        group.pnjs.splice(insertAt, 0, pnj);
      } else {
        // insérer après le dernier du palier dans group.pnjs
        const last = nowPalierPnjs[nowPalierPnjs.length - 1];
        const insertAt = last ? group.pnjs.indexOf(last) + 1 : group.pnjs.length;
        group.pnjs.splice(insertAt, 0, pnj);
      }
      _pnjDirty = true;
      document.getElementById('btn-save-pnj-order').disabled = false;
      renderPnjOrder();
    });

    row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(pnj._sensible ? 'pnj_secret' : 'personnages', pnj.id, pnj, 'pnj'); });
    _addCreatorBtn(row, 'pnj', pnj);
    row.addEventListener('dragstart', e => {
      if (e.target.closest('.ed-edit-btn') || _pnjDragSrc) return;
      _pnjItemDragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.stopPropagation();
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); _pnjItemDragSrc = null; });
    row.addEventListener('dragover', e => {
      if (_pnjDragSrc || !_pnjItemDragSrc || _pnjItemDragSrc === row) return;
      // même région et même palier seulement
      if (_pnjItemDragSrc.dataset.gi !== row.dataset.gi) return;
      e.preventDefault(); e.stopPropagation();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      row.classList.remove('drag-over');
      if (_pnjDragSrc || !_pnjItemDragSrc || _pnjItemDragSrc === row) return;
      if (_pnjItemDragSrc.dataset.gi !== row.dataset.gi) return;
      const fromPnj = group.pnjs.find(p => p.id === _pnjItemDragSrc.dataset.id);
      const toPnj   = group.pnjs.find(p => p.id === row.dataset.id);
      if (!fromPnj || !toPnj) return;
      const fromIdx = group.pnjs.indexOf(fromPnj);
      const toIdx2  = group.pnjs.indexOf(toPnj);
      if (fromIdx === -1 || toIdx2 === -1) return;
      const [moved] = group.pnjs.splice(fromIdx, 1);
      group.pnjs.splice(toIdx2, 0, moved);
      _pnjDirty = true;
      document.getElementById('btn-save-pnj-order').disabled = false;
      _pnjItemDragSrc = null;
      renderPnjOrder();
    });

    pnjList.appendChild(row);
  });

  groupEl.appendChild(pnjList);
  return groupEl;
}

function renderPnjOrder() {
  const listEl  = document.getElementById('pnj-order-list');
  const searchQ = normalize(document.getElementById('pnj-order-search').value.trim());
  listEl.innerHTML = '';

  // ── Mode recherche : liste plate ──
  if (searchQ) {
    const allPnjs = _pnjRegions.flatMap(g => g.pnjs);
    // Calculer positions globales (palier → région → nom)
    const paliers = [...new Set(allPnjs.map(p => p.palier||1))].sort((a,b) => a-b);
    const posMap  = new Map();
    let pos = 1;
    paliers.forEach(pal => _pnjRegions.forEach(g => g.pnjs.filter(p => (p.palier||1)===pal).forEach(p => posMap.set(p.id, pos++))));
    const results = allPnjs.filter(p => fuzzyMatch(searchQ, p.name));
    if (!results.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    results.forEach(p => {
      const row = document.createElement('div');
      row.className = 'mob-order-row';
      row.dataset.id = p.id;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${posMap.get(p.id)}</span>
        <span class="mob-order-name">${p.name||p.id}</span>
        <span class="mob-order-tag">${p.region||'—'}</span>
        <button class="ed-edit-btn" title="Modifier : ${p.name||p.id}\nID : ${p.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('personnages', p.id, p, 'pnj'); });
      _addCreatorBtn(row, 'pnj', p);
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : palier → régions ──
  const allPnjs = _pnjRegions.flatMap(g => g.pnjs);
  if (!allPnjs.length) { listEl.innerHTML = '<div class="empty">Aucun PNJ</div>'; return; }

  const paliers = [...new Set(allPnjs.map(p => p.palier||1))].sort((a,b) => a-b);
  if (!_pnjCollapseInit) { _pnjCollapseInit = true; paliers.forEach(p => _pnjPalierCollapsed.add(p)); }

  paliers.forEach(palier => {
    const totalCount   = allPnjs.filter(p => (p.palier||1) === palier).length;
    if (!totalCount) return;
    const palCollapsed = _pnjPalierCollapsed.has(palier);

    const palSection = document.createElement('div');
    palSection.className = 'palier-section';

    const ph = document.createElement('div');
    ph.className = 'palier-section-header';
    ph.innerHTML = `
      <span style="flex:1;">Palier ${palier}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:400;">${totalCount} PNJ</span>
      <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;line-height:1;" title="${palCollapsed?'Dérouler':'Réduire'}">${palCollapsed?'▶':'▼'}</button>`;
    ph.addEventListener('click', () => {
      if (_pnjPalierCollapsed.has(palier)) _pnjPalierCollapsed.delete(palier);
      else _pnjPalierCollapsed.add(palier);
      renderPnjOrder();
    });
    palSection.appendChild(ph);

    const palBody = document.createElement('div');
    palBody.className    = 'palier-section-body';
    palBody.style.display = palCollapsed ? 'none' : '';

    _pnjRegions.forEach((group, gi) => {
      const palierPnjs = group.pnjs.filter(p => (p.palier||1) === palier);
      if (!palierPnjs.length) return;
      palBody.appendChild(_makePnjRegionGroup(group, gi, palierPnjs, palier));
    });

    palSection.appendChild(palBody);
    listEl.appendChild(palSection);
  });
}

window.filterPnjOrder = () => renderPnjOrder();

window.autoSortPnjOrder = () => {
  for (const group of _pnjRegions) {
    group.pnjs.sort((a, b) => {
      const typeA = (a.name || a.type || '').toLowerCase();
      const typeB = (b.name || b.type || '').toLowerCase();
      if (typeA !== typeB) return typeA.localeCompare(typeB, 'fr');
      return (a.name || '').localeCompare(b.name || '', 'fr');
    });
  }
  _pnjDirty = true;
  document.getElementById('btn-save-pnj-order').disabled = false;
  renderPnjOrder();
  toast('⚡ PNJ triés automatiquement.', 'success');
};

window.savePnjOrder = async () => {
  const btn = document.getElementById('btn-save-pnj-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, err = 0;

  // 1. Mettre à jour l'ordre des régions connues uniquement
  let regPos = 1;
  for (const g of _pnjRegions) {
    if (g.id.startsWith('__')) continue; // groupes synthétiques (sans région, région inconnue)
    try {
      await updateDoc(doc(db, 'regions', g.id), { ordre: regPos++ });
      ok++;
    } catch(e) { console.error(g.id, e); err++; }
  }

  // 2. Mettre à jour l'ordre des PNJ (ordre global = région + nom)
  let pos = 1;
  for (const g of _pnjRegions) {
    for (const pnj of g.pnjs) {
      try {
        await updateDoc(doc(db, 'personnages', pnj.id), { ordre: pos++ });
        ok++;
      } catch(e) { console.error(pnj.id, e); err++; }
    }
  }

  localStorage.removeItem('vcl_cache_v2_regions');
  localStorage.removeItem('vcl_cache_meta_v2_regions');
  localStorage.removeItem('vcl_cache_v2_personnages');
  localStorage.removeItem('vcl_cache_meta_v2_personnages');
  invalidateModCache('regions');
  invalidateModCache('personnages');
  _cachedRegions = null;

  _pnjDirty = false;
  btn.disabled = true;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? '⚠️ Erreur lors de la sauvegarde.' : `✓ Sauvegardé (${ok} documents mis à jour, err ? 'error' : 'success').`);
};

// ── Region order panel ────────────────────────────────
let _regionOrderData  = [];
let _regionOrderDirty = false;
let _regionDragSrc    = null;
let _regionPalierCollapsed = new Set();
let _regionCollapseInit    = false;

window.showRegionOrder = async () => {
  _setHash('region-order');
  document.getElementById('region-order-panel').style.display = '';
  document.getElementById('btn-region-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadRegionOrder();
};

async function loadRegionOrder() {
  const listEl = document.getElementById('region-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _regionOrderDirty = false;
  document.getElementById('btn-save-region-order').disabled = true;
  try {
    const regions = [...(await cachedDocs('regions'))];
    regions.sort((a, b) => {
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      if ((a.palier||1) !== (b.palier||1)) return (a.palier||1) - (b.palier||1);
      return (a.name||'').localeCompare(b.name||'', 'fr');
    });
    _regionOrderData = regions;
    renderRegionOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

function renderRegionOrder() {
  const listEl  = document.getElementById('region-order-list');
  const searchQ = normalize(document.getElementById('region-order-search').value.trim());
  listEl.innerHTML = '';

  if (searchQ) {
    const visible = _regionOrderData.filter(r => fuzzyMatch(searchQ, r.name||r.id||''));
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(r => {
      const row = document.createElement('div');
      row.className = 'mob-order-row';
      row.dataset.id = r.id;
      const globalIdx = _regionOrderData.indexOf(r) + 1;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${globalIdx}</span>
        <span class="mob-order-name">${r.name||r.id}</span>
        <span class="mob-order-tag">P${r.palier||1}</span>
        <button class="ed-edit-btn" title="Modifier : ${r.name||r.id}\nID : ${r.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('regions', r.id, r, 'region'); });
      _addCreatorBtn(row, 'region', r);
      listEl.appendChild(row);
    });
    return;
  }

  const paliers = [...new Set(_regionOrderData.map(r => r.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucune région</div>'; return; }
  if (!_regionCollapseInit) { _regionCollapseInit = true; paliers.forEach(p => _regionPalierCollapsed.add(p)); }

  const isSameGroup = (a, b) => (a.palier||1) === (b.palier||1);

  paliers.forEach(palier => {
    const palierRegions = _regionOrderData.filter(r => (r.palier||1) === palier);
    const collapsed     = _regionPalierCollapsed.has(palier);

    const section = document.createElement('div');
    section.className = 'palier-section';

    const ph = document.createElement('div');
    ph.className = 'palier-section-header';
    ph.innerHTML = `
      <span style="flex:1;">Palier ${palier}</span>
      <span style="font-size:11px;color:var(--muted);font-weight:400;">${palierRegions.length} région${palierRegions.length>1?'s':''}</span>
      <button data-toggle style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:13px;padding:0 2px;line-height:1;" title="${collapsed?'Dérouler':'Réduire'}">${collapsed?'▶':'▼'}</button>`;
    ph.addEventListener('click', () => {
      if (_regionPalierCollapsed.has(palier)) _regionPalierCollapsed.delete(palier);
      else _regionPalierCollapsed.add(palier);
      renderRegionOrder();
    });
    section.appendChild(ph);

    const body = document.createElement('div');
    body.className = 'palier-section-body';
    body.style.display = collapsed ? 'none' : '';

    palierRegions.forEach(r => {
      const palierIdx  = palierRegions.indexOf(r);
      const row = document.createElement('div');
      row.className  = 'mob-order-row';
      row.draggable  = true;
      row.dataset.id = r.id;
      const horsCodexBadge = r.inCodex === false
        ? `<span class="mob-order-tag" style="background:rgba(248,113,113,.12);color:#f87171;border-color:rgba(248,113,113,.3);">Hors Codex</span>`
        : '';
      row.innerHTML  = `
        <span class="mob-order-handle">⠿</span>
        <input type="number" class="mob-order-index" value="${palierIdx+1}" min="1" max="${palierRegions.length}" title="Position dans ce palier">
        <span class="mob-order-name">${r.name||r.id}</span>
        ${horsCodexBadge}
        <span class="mob-order-tag">P${r.palier||1}</span>
        <button class="ed-edit-btn" title="Modifier : ${r.name||r.id}\nID : ${r.id}" draggable="false">✏️</button>`;

      const indexInput = row.querySelector('.mob-order-index');
      indexInput.addEventListener('click', e => e.stopPropagation());
      indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
      indexInput.addEventListener('change', () => {
        let toIdx = parseInt(indexInput.value, 10) - 1;
        toIdx = Math.max(0, Math.min(palierRegions.length - 1, toIdx));
        if (toIdx === palierIdx) { indexInput.value = palierIdx + 1; return; }
        const fromGlobal = _regionOrderData.indexOf(r);
        const [removed]  = _regionOrderData.splice(fromGlobal, 1);
        const nowGroup   = _regionOrderData.filter(x => (x.palier||1) === palier);
        const insertAt   = toIdx < nowGroup.length
          ? _regionOrderData.indexOf(nowGroup[toIdx])
          : (_regionOrderData.indexOf(nowGroup[nowGroup.length-1]) + 1 || _regionOrderData.length);
        _regionOrderData.splice(insertAt, 0, removed);
        _regionOrderDirty = true;
        document.getElementById('btn-save-region-order').disabled = false;
        renderRegionOrder();
      });

      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('regions', r.id, r, 'region'); });
      _addCreatorBtn(row, 'region', r);
      row.addEventListener('dragstart', e => { if (e.target.closest('.ed-edit-btn')) { e.preventDefault(); return; } _regionDragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      row.addEventListener('dragend',   () => { row.classList.remove('dragging'); _regionDragSrc = null; });
      row.addEventListener('dragover',  e => { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault(); row.classList.remove('drag-over');
        if (!_regionDragSrc || _regionDragSrc === row) return;
        const fromR = _regionOrderData.find(x => x.id === _regionDragSrc.dataset.id);
        const toR   = _regionOrderData.find(x => x.id === row.dataset.id);
        if (!fromR || !toR || !isSameGroup(fromR, toR)) return;
        const fromIdx = _regionOrderData.findIndex(x => x.id === _regionDragSrc.dataset.id);
        const toIdx2  = _regionOrderData.findIndex(x => x.id === row.dataset.id);
        if (fromIdx === -1 || toIdx2 === -1) return;
        const [moved] = _regionOrderData.splice(fromIdx, 1);
        _regionOrderData.splice(toIdx2, 0, moved);
        _regionOrderDirty = true;
        document.getElementById('btn-save-region-order').disabled = false;
        renderRegionOrder();
      });

      body.appendChild(row);
    });

    section.appendChild(body);
    listEl.appendChild(section);
  });
}

window.filterRegionOrder = () => renderRegionOrder();

window.saveRegionOrder = async () => {
  if (!_regionOrderDirty) return;
  const btn = document.getElementById('btn-save-region-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, err = 0;
  for (let i = 0; i < _regionOrderData.length; i++) {
    try {
      await updateDoc(doc(db, 'regions', _regionOrderData[i].id), { ordre: i + 1 });
      ok++;
    } catch(e) { console.error(_regionOrderData[i].id, e); err++; }
  }
  localStorage.removeItem('vcl_cache_v2_regions');
  localStorage.removeItem('vcl_cache_meta_v2_regions');
  invalidateModCache('regions');
  _cachedRegions = null;
  _regionOrderDirty = false;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? '⚠️ Erreur lors de la sauvegarde.' : `✓ Ordre sauvegardé (${ok} régions, err ? 'error' : 'success').`);
  document.getElementById('region-order-search').value = '';
  await loadRegionOrder();
};

// ── Panoplie order panel ─────────────────────────────
let _panoplieOrderData  = [];
let _panoplieOrderDirty = false;
let _panoplieDragSrc    = null;

window.showPanoplieOrder = async () => {
  _setHash('panoplie-order');
  document.getElementById('panoplie-order-panel').style.display = '';
  document.getElementById('btn-panoplie-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadPanoplieOrder();
};

async function loadPanoplieOrder() {
  const listEl = document.getElementById('panoplie-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _panoplieOrderDirty = false;
  document.getElementById('btn-save-panoplie-order').disabled = true;
  try {
    const rows = [...(await cachedDocs('panoplies'))];
    rows.sort((a, b) => {
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      return (a.label || a.id || '').localeCompare(b.label || b.id || '', 'fr');
    });
    _panoplieOrderData = rows;
    renderPanoplieOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

window.renderPanoplieOrder = function renderPanoplieOrder() {
  const listEl  = document.getElementById('panoplie-order-list');
  const searchQ = normalize(document.getElementById('panoplie-order-search').value.trim());
  listEl.innerHTML = '';

  const items = searchQ
    ? _panoplieOrderData.filter(p => fuzzyMatch(searchQ, (p.label||'') + ' ' + (p.id||'')))
    : _panoplieOrderData;

  if (!items.length) { listEl.innerHTML = '<div class="empty">Aucune panoplie</div>'; return; }

  items.forEach(p => {
    const globalIdx = _panoplieOrderData.indexOf(p);
    const bonusCount = p.bonuses && typeof p.bonuses === 'object' ? Object.keys(p.bonuses).length : 0;
    const row = document.createElement('div');
    row.className  = 'mob-order-row';
    row.draggable  = !searchQ;
    row.dataset.id = p.id;
    row.innerHTML  = `
      <span class="mob-order-handle">⠿</span>
      <input type="number" class="mob-order-index" value="${globalIdx+1}" min="1" max="${_panoplieOrderData.length}" ${searchQ?'disabled':''}>
      <span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${p.color||'#b87333'};border:1px solid var(--border);flex-shrink:0;"></span>
      <span class="mob-order-name">${p.label||p.id}</span>
      <span class="mob-order-tag">${bonusCount} bonus</span>
      <button class="ed-edit-btn" title="Modifier : ${p.label||p.id}\nID : ${p.id}" draggable="false">✏️</button>`;

    row.querySelector('.ed-edit-btn').addEventListener('click', e => {
      e.stopPropagation();
      showEditor('panoplies', p.id, p, 'panoplie');
    });
    _addCreatorBtn(row, 'panoplie', p);

    const indexInput = row.querySelector('.mob-order-index');
    indexInput.addEventListener('click', e => e.stopPropagation());
    indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
    indexInput.addEventListener('change', () => {
      let to = parseInt(indexInput.value, 10) - 1;
      to = Math.max(0, Math.min(_panoplieOrderData.length - 1, to));
      const from = _panoplieOrderData.indexOf(p);
      if (from === to) { indexInput.value = from + 1; return; }
      const [moved] = _panoplieOrderData.splice(from, 1);
      _panoplieOrderData.splice(to, 0, moved);
      _panoplieOrderDirty = true;
      document.getElementById('btn-save-panoplie-order').disabled = false;
      renderPanoplieOrder();
    });

    row.addEventListener('dragstart', e => { _panoplieDragSrc = row; row.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
    row.addEventListener('dragend',   () => { row.classList.remove('dragging'); _panoplieDragSrc = null; });
    row.addEventListener('dragover',  e => { e.preventDefault(); row.classList.add('drag-over'); });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault(); row.classList.remove('drag-over');
      if (!_panoplieDragSrc || _panoplieDragSrc === row) return;
      const fromIdx = _panoplieOrderData.findIndex(x => x.id === _panoplieDragSrc.dataset.id);
      const toIdx   = _panoplieOrderData.findIndex(x => x.id === row.dataset.id);
      if (fromIdx === -1 || toIdx === -1) return;
      const [moved] = _panoplieOrderData.splice(fromIdx, 1);
      _panoplieOrderData.splice(toIdx, 0, moved);
      _panoplieOrderDirty = true;
      document.getElementById('btn-save-panoplie-order').disabled = false;
      renderPanoplieOrder();
    });

    listEl.appendChild(row);
  });
};

window.savePanoplieOrder = async () => {
  if (!_panoplieOrderDirty) return;
  const btn = document.getElementById('btn-save-panoplie-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, err = 0;
  for (let i = 0; i < _panoplieOrderData.length; i++) {
    try {
      await updateDoc(doc(db, 'panoplies', _panoplieOrderData[i].id), { ordre: i + 1 });
      ok++;
    } catch(e) { console.error(_panoplieOrderData[i].id, e); err++; }
  }
  localStorage.removeItem('vcl_cache_v2_panoplies');
  localStorage.removeItem('vcl_cache_meta_v2_panoplies');
  invalidateModCache('panoplies');
  _panoplieOrderDirty = false;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? '⚠️ Erreur lors de la sauvegarde.' : `✓ Ordre sauvegardé (${ok} panoplies, err ? 'error' : 'success').`);
  document.getElementById('panoplie-order-search').value = '';
  await loadPanoplieOrder();
};

// ── Ghost ID tracker ─────────────────────────────────
window.showGhostIds = async () => {
  _setHash('ghost-ids');
  document.getElementById('ghost-id-panel').style.display = '';
  document.getElementById('btn-ghost-ids').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadGhostIds();
};

// ══════════════════════════════════════════════════════
// LIENS MORTS (données publiées → IDs inexistants)
// ══════════════════════════════════════════════════════
// CRAFTS CIRCULAIRES (item se contient dans son propre craft)
// ══════════════════════════════════════════════════════
window.showSelfCraft = async () => {
  _setHash('self-craft');
  document.getElementById('self-craft-panel').style.display = '';
  document.getElementById('btn-self-craft').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadSelfCraft();
};

async function loadSelfCraft() {
  const listEl = document.getElementById('self-craft-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const items = await cachedDocs('items');
    const bugs = [];

    for (const item of items) {
      if (!item.craft || !Array.isArray(item.craft) || !item.id) continue;
      let selfRef = false;
      outer: for (const c of item.craft) {
        if (c.id === item.id) { selfRef = true; break; }
        if (Array.isArray(c.items)) {
          for (const ing of c.items) {
            if (ing.id === item.id) { selfRef = true; break outer; }
          }
        }
      }
      if (selfRef) bugs.push(item);
    }

    listEl.innerHTML = '';
    if (!bugs.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun craft circulaire trouvé.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${bugs.length} item${bugs.length > 1 ? 's' : ''} avec craft circulaire`;
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Item</th><th>ID</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const item of bugs) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500;">${escHtml(item.name || item.id)}</td>
        <td><span class="ghost-id">${escHtml(item.id)}</span></td>
        <td style="white-space:nowrap;"></td>`;

      const actTd = tr.querySelector('td:last-child');

      // Bouton ouvrir dans le Creator
      const histBtn = document.createElement('button');
      histBtn.className = 'btn btn-ghost';
      histBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-right:4px;';
      histBtn.textContent = '⚙️ Creator';
      histBtn.onclick = () => {
        sessionStorage.setItem('editSub', JSON.stringify({ type: 'item', data: item }));
        window.open('creator.html', '_blank');
      };

      // Bouton retirer l'ingrédient fautif
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-ghost';
      fixBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
      fixBtn.textContent = '🗑️ Retirer';

      fixBtn.onclick = async () => {
        fixBtn.disabled = true;
        fixBtn.textContent = '…';
        try {
          const newCraft = item.craft
            .map(c => {
              if (c.id === item.id) return null;
              if (Array.isArray(c.items)) return { ...c, items: c.items.filter(ing => ing.id !== item.id) };
              return c;
            })
            .filter(Boolean);

          await updateDoc(doc(db, 'items', item.id), { craft: sanitizeForFirestore(newCraft) });
          invalidateModCache('items');
          await _writeAudit('fix_self_craft', 'item', item.id, item.name || item.id, {});
          tr.style.opacity = '0.4';
          fixBtn.textContent = '✓ Retiré';
        } catch (e) {
          fixBtn.disabled = false;
          fixBtn.textContent = '🗑️ Retirer';
          alert('Erreur : ' + e.message);
        }
      };

      actTd.appendChild(histBtn);
      actTd.appendChild(fixBtn);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    listEl.appendChild(table);
  } catch (e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════
let _deadLinksSnapshot = null; // { deduped, ENTITY_POOL }
window.showDeadLinks = async () => {
  _setHash('dead-links');
  document.getElementById('dead-links-panel').style.display = '';
  document.getElementById('btn-dead-links').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadDeadLinks();
};

async function loadDeadLinks() {
  const listEl = document.getElementById('dead-links-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [items, hiddenItems, mobs, pnjs, quetes, panoplies] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
      cachedDocs('mobs'),
      cachedDocs('personnages'),
      cachedDocs('quetes'),
      cachedDocs('panoplies'),
    ]);

    const itemIds     = new Set([...items.map(i => i.id), ...hiddenItems.map(h => h.id).filter(Boolean)]);
    const mobIds      = new Set(mobs.map(m => m.id));
    const pnjIds      = new Set(pnjs.map(p => p.id));
    const questIds    = new Set(quetes.map(q => q.id));
    const panoplieIds = new Set(panoplies.map(p => p.id));

    const EXCLUDED_IDS = new Set(['cols']);

    const itemNameMap = new Map();
    for (const i of [...items, ...hiddenItems]) {
      if (i.id && i.name) itemNameMap.set(i.id, i.name);
    }

    // Pool d'entités par type cible pour la recherche de correction
    const ENTITY_POOL = {
      item:      [...items, ...hiddenItems].filter(i => i.id).map(i => ({ id: i.id, name: i.name || i.id })),
      mob:       mobs.map(m => ({ id: m.id, name: m.name || m.id })),
      pnj:       pnjs.map(p => {
        const name = p.nom || p.name || p.id;
        const allIds = [];
        // craft[] (format Firestore) : c.id = résultat
        const craftArr = Array.isArray(p.craft) ? p.craft
          : p.craft && typeof p.craft === 'object' ? Object.values(p.craft) : [];
        for (const c of craftArr) { if (c.id) allIds.push(c.id); }
        // crafts[] (format submission) : c.resultId = résultat
        for (const c of (p.crafts || [])) {
          if (c.resultId) allIds.push(c.resultId);
          else if (c.id)  allIds.push(c.id);
        }
        // sells[] : items vendus par le marchand
        for (const s of (p.sells || [])) { if (s.id) allIds.push(s.id); }
        const itemNames = [...new Set(allIds)]
          .map(id => itemNameMap.get(id) || id.replace(/_/g, ' ')).filter(Boolean).join(' ');
        const extra = p.instructions || '';
        return { id: p.id, name, search: normalize(name + ' ' + itemNames + ' ' + extra) };
      }),
      'quête':   quetes.map(q => ({ id: q.id, name: q.titre || q.name || q.id })),
      panoplie:  panoplies.map(p => ({ id: p.id, name: p.label || p.id })),
    };

    // { srcType, srcId, srcName, field, refId, targetType }
    const broken = [];

    function addBroken(srcType, srcId, srcName, field, refId, targetType) {
      broken.push({ srcType, srcId, srcName, field, refId, targetType });
    }

    // ── Items ──────────────────────────────────────────
    for (const item of items) {
      const name = item.name || item.id;

      // craft (flat: [{id,qty}], new format: [{name, npcId, items:[{id,qty}]}])
      for (const c of (item.craft || [])) {
        if (c.id && !itemIds.has(c.id) && !EXCLUDED_IDS.has(c.id))
          addBroken('item', item.id, name, 'craft', c.id, 'item');
        for (const ing of (c.items || [])) {
          if (ing.id && !itemIds.has(ing.id) && !EXCLUDED_IDS.has(ing.id))
            addBroken('item', item.id, name, 'craft', ing.id, 'item');
        }
      }

      // obtain — format [ref|label] où ref = "type:id" ou juste "id"
      if (item.obtain) {
        const reObtain = /\[([^\]|]+)\|[^\]]+\]/g;
        let mo;
        while ((mo = reObtain.exec(item.obtain)) !== null) {
          const ref = mo[1];
          const colonIdx = ref.indexOf(':');
          let type, id;
          if (colonIdx !== -1) { type = ref.slice(0, colonIdx); id = ref.slice(colonIdx + 1); }
          else { type = null; id = ref; }
          if (!id) continue;
          if (type === 'donjon') continue;
          if (type === 'npc') {
            if (!pnjIds.has(id)) addBroken('item', item.id, name, 'obtain (npc)', id, 'pnj');
          } else if (type === 'quest') {
            if (!questIds.has(id)) addBroken('item', item.id, name, 'obtain (quête)', id, 'quête');
          } else if (type === 'item') {
            if (!itemIds.has(id) && !EXCLUDED_IDS.has(id)) addBroken('item', item.id, name, 'obtain (item)', id, 'item');
          } else {
            if (!itemIds.has(id) && !mobIds.has(id) && !EXCLUDED_IDS.has(id))
              addBroken('item', item.id, name, 'obtain (mob)', id, 'mob');
          }
        }
      }

      for (const evId of (item.evolutions || [])) {
        if (!itemIds.has(evId)) addBroken('item', item.id, name, 'evolutions', evId, 'item');
      }
      for (const fId of (item.evolvedFrom || [])) {
        if (!itemIds.has(fId)) addBroken('item', item.id, name, 'evolvedFrom', fId, 'item');
      }
      if (item.set && !panoplieIds.has(item.set))
        addBroken('item', item.id, name, 'set', item.set, 'panoplie');
    }

    // ── Mobs ───────────────────────────────────────────
    for (const mob of mobs) {
      const name = mob.name || mob.id;
      for (const loot of (mob.loot || [])) {
        if (loot.id && !itemIds.has(loot.id) && !EXCLUDED_IDS.has(loot.id))
          addBroken('mob', mob.id, name, 'loot', loot.id, 'item');
      }
    }

    // ── PNJ ────────────────────────────────────────────
    for (const pnj of pnjs) {
      const name = pnj.nom || pnj.name || pnj.id;
      for (const s of (pnj.sells || [])) {
        if (s.id && !itemIds.has(s.id) && !EXCLUDED_IDS.has(s.id))
          addBroken('pnj', pnj.id, name, 'sells', s.id, 'item');
      }
      const craftArr = Array.isArray(pnj.craft) ? pnj.craft
        : (pnj.craft && typeof pnj.craft === 'object') ? Object.values(pnj.craft) : [];
      for (const c of craftArr) {
        if (c.id && !itemIds.has(c.id) && !EXCLUDED_IDS.has(c.id))
          addBroken('pnj', pnj.id, name, 'craft', c.id, 'item');
        for (const ing of (c.ingredients || [])) {
          if (ing.id && !itemIds.has(ing.id) && !EXCLUDED_IDS.has(ing.id))
            addBroken('pnj', pnj.id, name, 'craft.ingredient', ing.id, 'item');
        }
      }
    }

    // ── Quêtes ─────────────────────────────────────────
    for (const q of quetes) {
      const name = q.titre || q.name || q.id;
      for (const obj of (q.objectifs || [])) {
        for (const it of (obj.items || [])) {
          const id = it.id || it.itemId;
          if (id && !itemIds.has(id) && !EXCLUDED_IDS.has(id))
            addBroken('quête', q.id, name, 'objectif.items', id, 'item');
        }
        for (const mb of (obj.mobs || [])) {
          const id = mb.id || mb.mobId;
          if (id && !mobIds.has(id))
            addBroken('quête', q.id, name, 'objectif.mobs', id, 'mob');
        }
      }
      for (const r of (q.recompenses || [])) {
        if (r.itemId && !itemIds.has(r.itemId) && !EXCLUDED_IDS.has(r.itemId))
          addBroken('quête', q.id, name, 'recompense.item', r.itemId, 'item');
      }
    }

    // Dédoublonnage exact
    const seen = new Set();
    const deduped = broken.filter(b => {
      const key = `${b.srcType}|${b.srcId}|${b.field}|${b.refId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Map "srcType|srcId" → palier (number) pour la désambiguïsation auto
    const SRC_PALIER = new Map();
    for (const e of [...items, ...hiddenItems]) if (e.id) SRC_PALIER.set(`item|${e.id}`, e.palier || 1);
    for (const e of mobs)   if (e.id) SRC_PALIER.set(`mob|${e.id}`,   e.palier || 1);
    for (const e of pnjs)   if (e.id) SRC_PALIER.set(`pnj|${e.id}`,   e.palier || 1);
    for (const e of quetes) if (e.id) SRC_PALIER.set(`quête|${e.id}`, e.palier || 1);

    _deadLinksSnapshot = { deduped, ENTITY_POOL, SRC_PALIER };

    // corrections en attente dont le lien n'est plus mort (corrigé ailleurs) : on les oublie
    const liveKeys = new Set(deduped.map(_dlKey));
    for (const k of [..._dlStaged.keys()]) if (!liveKeys.has(k)) _dlStaged.delete(k);
    _dlUpdateSendBar();

    listEl.innerHTML = '';
    if (!deduped.length) {
      _deadLinksSnapshot = null;
      listEl.innerHTML = '<div class="empty">✓ Aucun lien mort — toutes les références sont valides.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${deduped.length} lien${deduped.length > 1 ? 's' : ''} mort${deduped.length > 1 ? 's' : ''} trouvé${deduped.length > 1 ? 's' : ''}`;
    listEl.appendChild(summary);

    const TYPE_EMOJI = { item: '⚔️', mob: '👾', pnj: '🧑', 'quête': '📜', panoplie: '🔗' };

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Source</th><th>Champ</th><th>ID manquant</th><th>Cible</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const b of deduped) {
      const srcEmoji = TYPE_EMOJI[b.srcType] || '📄';
      const tgtEmoji = TYPE_EMOJI[b.targetType] || '📄';

      // ── Ligne principale ────────────────────────────
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span style="font-size:10px;color:var(--muted);">${srcEmoji} ${escHtml(b.srcType)}</span><br>
          <span style="font-weight:500;">${escHtml(b.srcName)}</span><br>
          <span class="ghost-id" style="font-size:10px;">${escHtml(b.srcId)}</span>
        </td>
        <td><code style="font-size:11px;color:var(--accent);">${escHtml(b.field)}</code></td>
        <td><span class="ghost-id">${escHtml(b.refId)}</span></td>
        <td><span style="font-size:11px;">${tgtEmoji} ${escHtml(b.targetType)}</span></td>
        <td style="white-space:nowrap;"></td>`;

      const actTd = tr.querySelector('td:last-child');
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-ghost';
      fixBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
      fixBtn.textContent = '✏️ Corriger';
      const undoBtn = document.createElement('button');
      undoBtn.className = 'btn btn-ghost';
      undoBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-left:4px;display:none;';
      undoBtn.textContent = '↩ Annuler';

      // ── Ligne de correction (masquée par défaut) ────
      const fixTr = document.createElement('tr');
      fixTr.style.cssText = 'display:none;background:rgba(224,172,96,.04);';
      const fixTd = document.createElement('td');
      fixTd.colSpan = 5;
      fixTd.style.cssText = 'padding:8px 12px;border-top:none;';

      // Recherche dans le pool de la cible
      const pool = ENTITY_POOL[b.targetType] || [];
      let selectedId = null;
      const chips = [];
      const suggestions = _dlSuggest(b, pool, SRC_PALIER.get(`${b.srcType}|${b.srcId}`));

      const label = document.createElement('span');
      label.style.cssText = 'font-size:12px;color:var(--muted);margin-right:6px;';
      label.textContent = 'Remplacer par :';

      const searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'position:relative;display:inline-block;';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = `🔍 ${tgtEmoji} Chercher…`;
      searchInput.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 10px;font-size:12px;outline:none;width:240px;';

      const dropdown = document.createElement('div');
      dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;z-index:200;width:320px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--surface);box-shadow:0 4px 16px rgba(0,0,0,.3);';

      const applyBtn = document.createElement('button');
      applyBtn.className = 'btn';
      applyBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:11px;padding:4px 12px;margin-left:6px;opacity:.4;cursor:not-allowed;';
      applyBtn.textContent = '✓ Valider';
      applyBtn.title = 'Mettre cette correction en attente (envoi groupé)';
      applyBtn.disabled = true;

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-left:4px;';
      cancelBtn.textContent = '✕';

      function selectEntity(e) {
        selectedId = e.id;
        searchInput.value = `${e.name}  [${e.id}]`;
        dropdown.style.display = 'none';
        for (const c of chips) c.el.style.borderColor = c.id === e.id ? 'var(--accent)' : '';
        applyBtn.disabled = false;
        applyBtn.style.opacity = '1';
        applyBtn.style.cursor = '';
      }

      function renderDropdown(q) {
        const norm = normalize(q);
        const results = norm
          ? pool.filter(e => normalize(e.search || e.name).includes(norm) || normalize(e.id).includes(norm))
          : [...suggestions.map(s => s.e), ...pool.filter(e => !suggestions.some(s => s.e.id === e.id))].slice(0, 40);
        dropdown.innerHTML = '';
        if (!results.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--muted);';
          empty.textContent = 'Aucun résultat';
          dropdown.appendChild(empty);
        } else {
          for (const e of results.slice(0, 60)) {
            const row = document.createElement('div');
            row.style.cssText = 'padding:6px 12px;font-size:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);';
            row.innerHTML = `<span style="font-weight:500;">${escHtml(e.name)}</span><span style="font-size:10px;color:var(--muted);font-family:monospace;">${escHtml(e.id)}</span>`;
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--surface2)'; });
            row.addEventListener('mouseleave', () => { row.style.background = ''; });
            row.addEventListener('mousedown', ev => { ev.preventDefault(); selectEntity(e); });
            dropdown.appendChild(row);
          }
        }
        dropdown.style.display = '';
      }

      searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
      searchInput.addEventListener('input', () => {
        selectedId = null;
        applyBtn.disabled = true;
        applyBtn.style.opacity = '.4';
        applyBtn.style.cursor = 'not-allowed';
        renderDropdown(searchInput.value);
      });
      searchInput.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

      // Valider = mettre la correction en attente (rien n'est écrit) ; tout part avec « Envoyer les corrections »
      const stKey = _dlKey(b);
      const idCell = tr.children[2];
      fixBtn._label = () => _dlStaged.has(stKey) ? '✏️ Modifier' : '✏️ Corriger';
      function refreshStaged() {
        const st = _dlStaged.get(stKey);
        idCell.querySelector('.dl-staged-new')?.remove();
        tr.style.opacity = st ? '.65' : '';
        if (st) {
          const s = document.createElement('div');
          s.className = 'dl-staged-new';
          s.style.cssText = 'font-size:11px;color:var(--success);margin-top:2px;word-break:break-all;';
          s.textContent = `→ ${st.newId}`;
          idCell.appendChild(s);
        }
        fixBtn.textContent = fixBtn._label();
        undoBtn.style.display = st ? '' : 'none';
      }
      applyBtn.addEventListener('click', () => {
        if (!selectedId) return;
        if (b.srcType === b.targetType && selectedId === b.srcId) { toast('⛔ Un élément ne peut pas se référencer lui-même', 'error'); return; }
        _dlStaged.set(stKey, { b, newId: selectedId });
        fixTr.style.display = 'none';
        refreshStaged();
        _dlUpdateSendBar();
      });
      undoBtn.addEventListener('click', () => {
        _dlStaged.delete(stKey);
        refreshStaged();
        _dlUpdateSendBar();
      });

      cancelBtn.addEventListener('click', () => {
        fixTr.style.display = 'none';
        fixBtn.textContent = fixBtn._label();
      });

      fixBtn.addEventListener('click', () => {
        const open = fixTr.style.display !== 'none';
        if (open) { fixTr.style.display = 'none'; fixBtn.textContent = fixBtn._label(); }
        else {
          // Fermer les autres fix rows ouverts
          tbody.querySelectorAll('tr[data-fix-row]').forEach(r => { r.style.display = 'none'; });
          tbody.querySelectorAll('button[data-fix-btn]').forEach(b => { b.textContent = b._label ? b._label() : '✏️ Corriger'; });
          fixTr.style.display = '';
          fixBtn.textContent = '▲ Fermer';
          // rien n'est présélectionné : on choisit une suggestion ou on cherche
          selectedId = null;
          searchInput.value = '';
          applyBtn.disabled = true;
          applyBtn.style.opacity = '.4';
          applyBtn.style.cursor = 'not-allowed';
          for (const c of chips) c.el.style.borderColor = '';
        }
      });
      fixBtn.dataset.fixBtn = '1';
      fixTr.dataset.fixRow = '1';

      searchWrap.appendChild(searchInput);
      searchWrap.appendChild(dropdown);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:4px;';
      row.appendChild(label);
      row.appendChild(searchWrap);
      row.appendChild(applyBtn);
      row.appendChild(cancelBtn);
      // Suggestions : l'utilisateur clique celle qui convient, puis « Appliquer »
      const sugWrap = document.createElement('div');
      sugWrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:6px;';
      const sugLabel = document.createElement('span');
      sugLabel.style.cssText = 'font-size:12px;color:var(--muted);margin-right:2px;';
      sugLabel.textContent = suggestions.length ? 'Suggestions (un clic valide) :' : 'Aucune suggestion — utilise la recherche.';
      sugWrap.appendChild(sugLabel);
      for (const { e } of suggestions) {
        const chip = document.createElement('button');
        chip.className = 'btn btn-ghost';
        chip.style.cssText = 'font-size:11px;padding:3px 8px;';
        chip.title = e.id;
        chip.textContent = e.name && e.name !== e.id ? `${e.name} · ${e.id}` : e.id;
        chip.title = `Choisir : ${e.id}`;
        chip.addEventListener('click', () => { selectEntity(e); applyBtn.click(); }); // un clic = choisi et mis en attente
        chips.push({ id: e.id, el: chip });
        sugWrap.appendChild(chip);
      }

      fixTd.appendChild(sugWrap);
      fixTd.appendChild(row);
      fixTr.appendChild(fixTd);

      // Ouvre la donnée qui porte le lien mort dans l'éditeur de la modération (liste de ses champs) ; « Fermer » revient ici
      const _colOf = { item: 'items', mob: 'mobs', pnj: 'personnages', 'quête': 'quetes', panoplie: 'panoplies' }[b.srcType];
      if (_colOf) {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-ghost';
        openBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-right:4px;';
        openBtn.textContent = '📂 Ouvrir';
        openBtn.title = 'Ouvre cette donnée dans l\'éditeur (liste des champs)';
        openBtn.addEventListener('click', async () => {
          try {
            const snap = await getDoc(doc(db, _colOf, String(b.srcId)));
            if (!snap.exists()) { toast('Donnée introuvable : ' + b.srcId, 'error'); return; }
            const data = { id: snap.id, ...snap.data() };
            showEditor(_colOf, String(b.srcId), data, 'dead-links');
          } catch (e) { toast('Erreur : ' + e.message, 'error'); }
        });
        actTd.appendChild(openBtn);
      }
      actTd.appendChild(fixBtn);
      actTd.appendChild(undoBtn);
      tbody.appendChild(tr);
      tbody.appendChild(fixTr);
      refreshStaged();   // retrouve l'état « en attente » après un rafraîchissement
    }

    table.appendChild(tbody);
    listEl.appendChild(table);

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
}

const _DEAD_LINK_COL = { item: 'items', mob: 'mobs', 'quête': 'quetes', pnj: 'personnages' };

// Applique UN fix sur data (mutates) — pur, sans I/O
function _applyPatchToData(data, b, newId) {
  if (b.field === 'craft') {
    // PNJ craft peut être un objet {0:{…},1:{…}} au lieu d'un array
    const craftRaw = data.craft;
    const isObj = craftRaw && !Array.isArray(craftRaw) && typeof craftRaw === 'object';
    const craftArr = JSON.parse(JSON.stringify(isObj ? Object.values(craftRaw) : (craftRaw || [])));
    for (const c of craftArr) {
      if (c.id === b.refId) c.id = newId;
      // items = format item/quête, ingredients = format PNJ
      for (const ing of [...(c.items || []), ...(c.ingredients || [])]) if (ing.id === b.refId) ing.id = newId;
    }
    data.craft = isObj ? Object.fromEntries(craftArr.map((c, i) => [String(i), c])) : craftArr;

  } else if (b.field === 'craft.ingredient') {
    const craftRaw = data.craft;
    const isObj = craftRaw && !Array.isArray(craftRaw) && typeof craftRaw === 'object';
    const craftArr = JSON.parse(JSON.stringify(isObj ? Object.values(craftRaw) : (craftRaw || [])));
    for (const c of craftArr)
      for (const ing of (c.ingredients || [])) if (ing.id === b.refId) ing.id = newId;
    data.craft = isObj ? Object.fromEntries(craftArr.map((c, i) => [String(i), c])) : craftArr;

  } else if (b.field === 'sells') {
    data.sells = (data.sells || []).map(s => s.id === b.refId ? { ...s, id: newId } : s);

  } else if (b.field.startsWith('obtain')) {
    data.obtain = (data.obtain || '').replace(/\[([^\]|]+)\|([^\]]+)\]/g, (match, ref, lbl) => {
      const colonIdx = ref.indexOf(':');
      const id = colonIdx !== -1 ? ref.slice(colonIdx + 1) : ref;
      if (id !== b.refId) return match;
      return `[${colonIdx !== -1 ? ref.slice(0, colonIdx + 1) : ''}${newId}|${lbl}]`;
    });

  } else if (b.field === 'evolutions') {
    data.evolutions = (data.evolutions || []).map(id => id === b.refId ? newId : id);

  } else if (b.field === 'evolvedFrom') {
    data.evolvedFrom = (data.evolvedFrom || []).map(id => id === b.refId ? newId : id);

  } else if (b.field === 'set') {
    data.set = newId;

  } else if (b.field === 'loot') {
    data.loot = (data.loot || []).map(l => l.id === b.refId ? { ...l, id: newId } : l);

  } else if (b.field === 'npc') {
    data.npc = newId;

  } else if (b.field === 'objectif.items') {
    const objectifs = JSON.parse(JSON.stringify(data.objectifs || []));
    for (const obj of objectifs)
      for (const it of (obj.items || []))
        if ((it.id || it.itemId) === b.refId) { it.id = newId; if ('itemId' in it) it.itemId = newId; }
    data.objectifs = objectifs;

  } else if (b.field === 'objectif.mobs') {
    const objectifs = JSON.parse(JSON.stringify(data.objectifs || []));
    for (const obj of objectifs)
      for (const mb of (obj.mobs || []))
        if ((mb.id || mb.mobId) === b.refId) { mb.id = newId; if ('mobId' in mb) mb.mobId = newId; }
    data.objectifs = objectifs;

  } else if (b.field === 'recompense.item') {
    const recompenses = JSON.parse(JSON.stringify(data.recompenses || []));
    for (const r of recompenses) if (r.itemId === b.refId) r.itemId = newId;
    data.recompenses = recompenses;

  } else {
    throw new Error('Champ non supporté : ' + b.field);
  }
}

// ── Corrections en attente : rien n'est écrit avant « Envoyer les corrections » ──
const _dlStaged = new Map();   // clé du lien mort -> { b, newId }
const _dlKey = b => [b.srcType, b.srcId, b.field, b.refId].join('|');

function _dlUpdateSendBar() {
  const list = document.getElementById('dead-links-list');
  if (!list) return;
  let bar = document.getElementById('dl-send-bar');
  const n = _dlStaged.size;
  if (!n) { bar?.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'dl-send-bar';
    bar.className = 'dl-send-bar';
    list.before(bar);
  }
  bar.innerHTML = `<span><b>${n}</b> correction${n > 1 ? 's' : ''} en attente</span>
    <button class="btn" id="dl-send-btn" style="background:var(--accent);color:var(--on-accent);">📤 Envoyer les corrections</button>
    <button class="btn btn-ghost" id="dl-cancel-btn">Tout annuler</button>`;
  bar.querySelector('#dl-send-btn').onclick = _dlSendStaged;
  bar.querySelector('#dl-cancel-btn').onclick = () => { _dlStaged.clear(); loadDeadLinks(); };
}

async function _dlSendStaged() {
  const entries = [..._dlStaged.values()];
  if (!entries.length) return;
  const btn = document.getElementById('dl-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
  try {
    // regrouper par document source : un seul chargement et une seule écriture par document
    const byDoc = new Map();
    for (const e of entries) {
      const col = _DEAD_LINK_COL[e.b.srcType];
      if (!col) continue;
      const k = col + '/' + e.b.srcId;
      if (!byDoc.has(k)) byDoc.set(k, []);
      byDoc.get(k).push(e);
    }
    const snaps = await Promise.all([...byDoc.keys()].map(async k => {
      const [col, id] = k.split('/');
      return { k, col, id, snap: await getDoc(doc(db, col, id)) };
    }));
    const writes = [], done = [], failed = [];
    for (const { k, col, id, snap } of snaps) {
      if (!snap.exists()) { failed.push(...byDoc.get(k)); continue; }
      const before = snap.data();
      const data = { ...before };
      for (const e of byDoc.get(k)) {
        try { _applyPatchToData(data, e.b, e.newId); done.push(e); } catch { failed.push(e); }
      }
      // on n'écrit que les champs réellement modifiés
      const patch = {};
      for (const key of Object.keys(data)) if (JSON.stringify(data[key]) !== JSON.stringify(before[key])) patch[key] = data[key];
      if (Object.keys(patch).length) writes.push({ col, id, patch });
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      for (const w of writes.slice(i, i + 400)) batch.update(doc(db, w.col, w.id), sanitizeForFirestore(w.patch));
      await batch.commit();
    }
    for (const col of new Set(writes.map(w => w.col))) invalidateModCache(col);
    await Promise.all(done.map(e => _writeAudit('dead_link_fix', e.b.srcType, e.b.srcId, e.b.srcName, { field: e.b.field, oldRef: e.b.refId, newRef: e.newId })));
    done.forEach(e => _dlStaged.delete(_dlKey(e.b)));
    toast(`✓ ${done.length} correction${done.length > 1 ? 's' : ''} envoyée${done.length > 1 ? 's' : ''}` + (failed.length ? ` — ${failed.length} échec${failed.length > 1 ? 's' : ''} (document introuvable ou champ non supporté, conservé${failed.length > 1 ? 'es' : 'e'} en attente)` : ''), failed.length ? 'info' : 'success');
    await loadDeadLinks();
  } catch (e) {
    toast('⛔ ' + e.message, 'error');
    _dlUpdateSendBar();
  }
}

// ── Suggestions d'IDs pour un lien mort ──────────────
// Proposées à l'utilisateur, jamais appliquées automatiquement : c'est lui qui choisit.
// Score 100 : ID identique ; 90/80 : même ID + suffixe court (_p1…) dans un sens ou dans l'autre ;
// 70/60 : suffixe jusqu'à 8 caractères ; 30 : sous-chaîne ; sinon recouvrement des mots (ID + nom).
function _dlIdScore(normDeadId, normPoolId) {
  if (normDeadId === normPoolId) return 100;
  if (normPoolId.startsWith(normDeadId + '_')) {
    const sfx = normPoolId.slice(normDeadId.length + 1);
    if (sfx.length <= 3) return 90;
    if (sfx.length <= 8) return 70;
    return 0;
  }
  if (normDeadId.startsWith(normPoolId + '_') && normPoolId.length >= 4) {
    const sfx = normDeadId.slice(normPoolId.length + 1);
    if (sfx.length <= 3) return 80;
    if (sfx.length <= 8) return 60;
    return 0;
  }
  if (normDeadId.length >= 6 && normPoolId.length >= 6 && normPoolId.includes(normDeadId)) return 30;
  return 0;
}

const _dlTokens = s => normalize(String(s || '')).split(/[s_]+/).filter(t => t && !/^pd+$/.test(t));

function _dlSuggest(b, pool, srcPalier) {
  const dead = normalize(b.refId);
  const deadTok = _dlTokens(b.refId);
  const out = [];
  for (const e of pool) {
    if (b.srcType === b.targetType && e.id === b.srcId) continue; // jamais l'entité elle-même
    const ne = normalize(e.id);
    let score = _dlIdScore(dead, ne);
    if (deadTok.length) {
      const tok = new Set([..._dlTokens(e.id), ..._dlTokens(e.name)]);
      const common = deadTok.filter(t => tok.has(t)).length;
      if (common) score = Math.max(score, Math.round(55 * common / deadTok.length) + (common === deadTok.length ? 5 : 0));
    }
    if (score < 25) continue;
    if (srcPalier != null && ne.endsWith('_p' + srcPalier)) score += 3;
    out.push({ e, score });
  }
  return out.sort((x, y) => y.score - x.score || x.e.id.length - y.e.id.length).slice(0, 8);
}

// ══════════════════════════════════════════════════════
// IDs ORPHELINS (soumissions pending → IDs rejetés)
// ══════════════════════════════════════════════════════
window.showOrphanIds = async () => {
  _setHash('orphan-ids');
  document.getElementById('orphan-ids-panel').style.display = '';
  document.getElementById('btn-orphan-ids').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadOrphanIds();
};

async function loadOrphanIds() {
  const listEl = document.getElementById('orphan-ids-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [rejectedSnap, pendingSnap] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
    ]);

    // Map rejectedId → submission doc info
    const rejectedMap = new Map();
    for (const d of rejectedSnap.docs) {
      const data = d.data();
      const rid = data?.data?.id;
      if (rid) rejectedMap.set(rid, { subId: d.id, name: data?.data?.name || rid, type: data?.type || '?' });
    }

    if (rejectedMap.size === 0) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID orphelin détecté.</div>';
      _updateOrphanBadge(0);
      return;
    }

    // Orphans: { orphanId → [{ pendingSubId, pendingName, context, rejectedName }] }
    const orphans = {};

    for (const d of pendingSnap.docs) {
      const sub = d.data();
      const subName = sub.data?.name || sub.data?.id || '(soumission)';
      const check = (id, ctx) => {
        if (!id || !rejectedMap.has(id)) return;
        (orphans[id] ??= []).push({
          pendingSubId: d.id,
          pendingName: subName,
          pendingType: sub.type,
          context: ctx,
          rejectedName: rejectedMap.get(id).name,
          rejectedSubId: rejectedMap.get(id).subId,
        });
      };
      for (const c of (sub.data?.craft || []))       check(c.id, 'Craft');
      for (const ev of (sub.data?.evolutions || []))  check(ev,   'Évolution');
      for (const fv of (sub.data?.evolvedFrom || [])) check(fv,   'Évolué de');
      if (sub.data?.obtain) {
        const re = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
        let mo;
        while ((mo = re.exec(sub.data.obtain)) !== null) check(mo[1], 'Obtention');
      }
    }

    const orphanIds = Object.keys(orphans).sort();
    _updateOrphanBadge(orphanIds.length);

    if (!orphanIds.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID orphelin détecté.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${orphanIds.length} ID${orphanIds.length > 1 ? 's' : ''} orphelin${orphanIds.length > 1 ? 's' : ''} — soumissions en attente avec références invalides`;
    listEl.innerHTML = '';
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>ID orphelin</th><th>Soumission en attente</th><th>Contexte</th><th>Soumission rejetée</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const id of orphanIds) {
      for (const entry of orphans[id]) {
        const tr = document.createElement('tr');
        tr.style.cssText = 'background:rgba(248,113,113,.05);';
        tr.innerHTML = `
          <td><span class="ghost-id">${escHtml(id)}</span></td>
          <td>
            <span style="font-size:11px;">${escHtml(entry.pendingName)}</span>
            <a href="#" onclick="event.preventDefault();_goToSubmission(${JSON.stringify(entry.pendingSubId)})"
               style="display:block;font-size:10px;color:var(--accent);">voir soumission →</a>
          </td>
          <td><span style="font-size:11px;color:var(--muted);">${escHtml(entry.context)}</span></td>
          <td>
            <span style="font-size:11px;color:#f87171;">${escHtml(entry.rejectedName)}</span>
            <span style="display:block;font-size:10px;color:var(--muted);">rejetée</span>
          </td>`;
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    listEl.appendChild(table);
  } catch(e) {
    listEl.innerHTML = `<div class="empty">Erreur : ${escHtml(e.message)}</div>`;
  }
}

async function _refreshOrphanCount() {
  try {
    const [rejSnap, pendSnap] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
    ]);
    const rejectedIds = new Set(rejSnap.docs.map(d => d.data()?.data?.id).filter(Boolean));
    if (!rejectedIds.size) { _updateOrphanBadge(0); return; }
    const orphanIds = new Set();
    for (const d of pendSnap.docs) {
      const sub = d.data();
      for (const c of (sub.data?.craft || []))       if (rejectedIds.has(c.id))  orphanIds.add(c.id);
      for (const ev of (sub.data?.evolutions || []))  if (rejectedIds.has(ev))    orphanIds.add(ev);
      for (const fv of (sub.data?.evolvedFrom || [])) if (rejectedIds.has(fv))    orphanIds.add(fv);
      if (sub.data?.obtain) {
        const re = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
        let mo;
        while ((mo = re.exec(sub.data.obtain)) !== null) if (rejectedIds.has(mo[1])) orphanIds.add(mo[1]);
      }
    }
    _updateOrphanBadge(orphanIds.size);
  } catch {}
}

function _updateOrphanBadge(count) {
  const badge = document.getElementById('count-orphan-ids');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}

window._goToSubmission = function(subId) {
  setFilter('status', 'pending');
  renderSubs();
  setTimeout(() => {
    const card = document.getElementById('card-' + subId);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
};

// ══════════════════════════════════════════════════════
// RÉGIONS ORPHELINES
// ══════════════════════════════════════════════════════
window.showRegionOrphans = async () => {
  _setHash('region-orphans');
  document.getElementById('region-orphan-panel').style.display = '';
  document.getElementById('btn-region-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadRegionOrphans();
};

// ── Système ignore (localStorage) ───────────────────
const IGNORE_KEY = 'vcl_orphan_ignored';
function _getIgnored() {
  try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '{}'); } catch { return {}; }
}
function _isIgnored(cat, id) { const d = _getIgnored(); return !!(d[cat] && d[cat].includes(id)); }
function _addIgnored(cat, id) {
  const d = _getIgnored(); d[cat] = [...new Set([...(d[cat]||[]), id])];
  localStorage.setItem(IGNORE_KEY, JSON.stringify(d));
}
function _removeIgnored(cat, id) {
  const d = _getIgnored(); d[cat] = (d[cat]||[]).filter(x => x !== id);
  localStorage.setItem(IGNORE_KEY, JSON.stringify(d));
}

// ── Helpers communs ──────────────────────────────────
function _orphanSubHead(text, activeCount, ignoredCount) {
  const d = document.createElement('div');
  d.style.cssText = 'font-size:13px;font-weight:700;color:var(--text);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;';
  d.innerHTML = `${text} <span style="font-size:11px;font-weight:400;color:var(--muted);">${activeCount} trouvé${activeCount>1?'s':''}</span>`
    + (ignoredCount ? `<span style="font-size:11px;font-weight:400;color:var(--muted);margin-left:auto;">${ignoredCount} ignoré${ignoredCount>1?'s':''}</span>` : '');
  return d;
}

function _orphanIgnoredToggle(container, rows) {
  // rows = [{tr, restore}] already built
  if (!rows.length) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:4px;';
  const tog = document.createElement('button');
  tog.className = 'btn btn-ghost';
  tog.style.cssText = 'font-size:11px;padding:3px 8px;opacity:.6;';
  tog.textContent = `▶ Afficher les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`;
  let open = false;
  const table = document.createElement('table');
  table.className = 'ghost-table';
  table.style.display = 'none';
  table.style.marginTop = '6px';
  const tbody = document.createElement('tbody');
  rows.forEach(({ tr }) => tbody.appendChild(tr));
  table.appendChild(tbody);
  tog.addEventListener('click', () => {
    open = !open;
    table.style.display = open ? '' : 'none';
    tog.textContent = open
      ? `▼ Masquer les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`
      : `▶ Afficher les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`;
  });
  wrap.appendChild(tog);
  wrap.appendChild(table);
  container.appendChild(wrap);
}

window.loadRegionOrphans = async function loadRegionOrphans() {
  const listEl = document.getElementById('region-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [regions, mobs] = await Promise.all([
      cachedDocs('regions'),
      cachedDocs('mobs'),
    ]);

    const regionIds = new Set(regions.map(r => r.id));
    const mobsWithBadRegion = mobs.filter(m => m.region && !regionIds.has(m.region));

    listEl.innerHTML = '';

    // ── Section 1 : mobs avec région invalide ────────────
    const active1   = mobsWithBadRegion.filter(m => !_isIgnored('region-bad-mob', m.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','fr'));
    const ignored1  = mobsWithBadRegion.filter(m =>  _isIgnored('region-bad-mob', m.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','fr'));
    listEl.appendChild(_orphanSubHead('🔴 Mobs avec région non reconnue', active1.length, ignored1.length));

    if (!active1.length && !ignored1.length) {
      const ok = document.createElement('div'); ok.style.cssText='font-size:12px;color:var(--success);padding:6px 0;'; ok.textContent='✓ Aucun mob avec une région invalide.'; listEl.appendChild(ok);
    } else if (active1.length) {
      // Map nom normalisé → ID de région (pour auto-correction)
      const regionByName = new Map(regions.map(r => [r.name?.trim().toLowerCase(), r.id]));
      const autoFixable = active1.filter(m => regionByName.has(m.region?.trim().toLowerCase()));

      if (autoFixable.length) {
        const autoBar = document.createElement('div');
        autoBar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;';
        autoBar.innerHTML = `<span style="color:var(--success);">🔧 <b>${autoFixable.length}</b> mob${autoFixable.length>1?'s':''} peut être corrigé automatiquement (nom exact trouvé dans les régions)</span>`;
        const autoBtn = document.createElement('button');
        autoBtn.className = 'btn btn-ghost';
        autoBtn.style.cssText = 'font-size:11px;padding:4px 12px;margin-left:auto;';
        autoBtn.textContent = `🔧 Tout auto-corriger (${autoFixable.length})`;
        autoBtn.addEventListener('click', async () => {
          autoBtn.disabled = true; autoBtn.textContent = 'Correction en cours…';
          let done = 0, failed = 0;
          for (const mob of autoFixable) {
            const rid = regionByName.get(mob.region?.trim().toLowerCase());
            if (!rid) { failed++; continue; }
            try {
              await updateDoc(doc(db, 'mobs', mob.id), { region: rid });
              invalidateModCache('mobs');
              done++;
            } catch(e) { failed++; }
          }
          autoBtn.textContent = `✓ ${done} corrigé${done>1?'s':''}${failed?` · ${failed} échec${failed>1?'s':''}` : ''}`;
          setTimeout(() => loadRegionOrphans(), 800);
        });
        autoBar.appendChild(autoBtn);
        listEl.appendChild(autoBar);
      }

      const table = document.createElement('table'); table.className='ghost-table';
      table.innerHTML=`<thead><tr><th>Mob</th><th>ID mob</th><th>Valeur région (texte libre)</th><th>→ Région détectée</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      for (const mob of active1) {
        const matchedId = regionByName.get(mob.region?.trim().toLowerCase());
        const matchedRegion = matchedId ? regions.find(r => r.id === matchedId) : null;
        const detectedCell = matchedRegion
          ? `<span style="color:var(--success);font-family:monospace;font-size:12px;">${escHtml(matchedRegion.name)} <span style="opacity:.6;">(${escHtml(matchedId)})</span></span>`
          : `<span style="color:var(--muted);font-size:11px;">—</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="color:var(--warn);font-family:monospace;font-size:12px;">${escHtml(mob.region)}</span></td><td>${detectedCell}</td><td style="white-space:nowrap;display:flex;gap:6px;"></td>`;
        const td = tr.querySelector('td:last-child');
        if (matchedId) {
          const fixBtn = document.createElement('button'); fixBtn.className='btn btn-ghost'; fixBtn.style.cssText='font-size:11px;padding:4px 10px;color:var(--success);'; fixBtn.textContent='🔧 Corriger';
          fixBtn.addEventListener('click', async () => {
            fixBtn.disabled = true; fixBtn.textContent = '…';
            await updateDoc(doc(db, 'mobs', mob.id), { region: matchedId });
            invalidateModCache('mobs');
            loadRegionOrphans();
          });
          td.appendChild(fixBtn);
        }
        const editBtn = document.createElement('button'); editBtn.className='btn btn-ghost'; editBtn.style.cssText='font-size:11px;padding:4px 10px;'; editBtn.textContent='✏️ Éditer';
        editBtn.addEventListener('click', () => showEditor('mobs', mob.id, mob, 'region-orphan'));
        const ignBtn = document.createElement('button'); ignBtn.className='btn btn-ghost'; ignBtn.style.cssText='font-size:11px;padding:4px 10px;opacity:.7;'; ignBtn.textContent='✓ C\'est normal';
        ignBtn.addEventListener('click', () => { _addIgnored('region-bad-mob', mob.id); loadRegionOrphans(); });
        td.appendChild(editBtn); td.appendChild(ignBtn);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody); listEl.appendChild(table);
    }
    if (ignored1.length) {
      const rows = ignored1.map(mob => {
        const tr = document.createElement('tr');
        tr.style.opacity='.5';
        tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-family:monospace;font-size:12px;">${escHtml(mob.region)}</span></td><td></td>`;
        const restBtn = document.createElement('button'); restBtn.className='btn btn-ghost'; restBtn.style.cssText='font-size:11px;padding:4px 10px;'; restBtn.textContent='↩ Restaurer';
        restBtn.addEventListener('click', () => { _removeIgnored('region-bad-mob', mob.id); loadRegionOrphans(); });
        tr.querySelector('td:last-child').appendChild(restBtn);
        return { tr };
      });
      _orphanIgnoredToggle(listEl, rows);
    }

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

// ══════════════════════════════════════════════════════
// MOBS ORPHELINS
// ══════════════════════════════════════════════════════
window.showMobOrphans = async () => {
  _setHash('mob-orphans');
  document.getElementById('mob-orphan-panel').style.display = '';
  document.getElementById('btn-mob-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadMobOrphans();
};

window.loadMobOrphans = async function loadMobOrphans() {
  const listEl = document.getElementById('mob-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [mobs, items, regions] = await Promise.all([
      cachedDocs('mobs'),
      cachedDocs('items'),
      cachedDocs('regions'),
    ]);

    const regionIds = new Set(regions.map(r => r.id));

    // Section 1 : mobs sans région du tout (les mobs avec région invalide sont dans "Région Orphelins")
    const mobsNoValidRegion = mobs.filter(m => !m.region);

    listEl.innerHTML = '';

    const makeMobSection = (cat, headText, list, extraCol) => {
      const active  = list.filter(m => !_isIgnored(cat, m.id)).sort((a,b)=>(a.palier||1)-(b.palier||1)||(a.name||'').localeCompare(b.name||'','fr'));
      const ignored = list.filter(m =>  _isIgnored(cat, m.id)).sort((a,b)=>(a.palier||1)-(b.palier||1)||(a.name||'').localeCompare(b.name||'','fr'));
      listEl.appendChild(_orphanSubHead(headText, active.length, ignored.length));

      if (!active.length && !ignored.length) {
        const ok = document.createElement('div'); ok.style.cssText='font-size:12px;color:var(--success);padding:6px 0;'; ok.textContent='✓ Aucun.'; listEl.appendChild(ok); return;
      }

      if (active.length) {
        const hasExtra = !!extraCol;
        const table = document.createElement('table'); table.className='ghost-table';
        table.innerHTML=`<thead><tr><th>Mob</th><th>ID</th><th>Type</th>${hasExtra?`<th>${escHtml(extraCol.head)}</th>`:''}<th></th></tr></thead>`;
        const tbody = document.createElement('tbody');
        for (const mob of active) {
          const typeLabel = `P${mob.palier||'?'} ${mob.type||'—'}`;
          const extraCell = hasExtra ? `<td><span style="font-family:monospace;font-size:11px;color:var(--warn);">${escHtml(extraCol.val(mob)||'—')}</span></td>` : '';
          const tr = document.createElement('tr');
          tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-size:11px;color:var(--muted);">${escHtml(typeLabel)}</span></td>${extraCell}<td style="white-space:nowrap;display:flex;gap:6px;"></td>`;
          const td = tr.querySelector('td:last-child');
          const editBtn = document.createElement('button'); editBtn.className='btn btn-ghost'; editBtn.style.cssText='font-size:11px;padding:4px 10px;'; editBtn.textContent='✏️ Corriger';
          editBtn.addEventListener('click', () => showEditor('mobs', mob.id, mob, 'mob-orphan'));
          const ignBtn = document.createElement('button'); ignBtn.className='btn btn-ghost'; ignBtn.style.cssText='font-size:11px;padding:4px 10px;opacity:.7;'; ignBtn.textContent="✓ C'est normal";
          ignBtn.addEventListener('click', () => { _addIgnored(cat, mob.id); loadMobOrphans(); });
          td.appendChild(editBtn); td.appendChild(ignBtn);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody); listEl.appendChild(table);
      }

      if (ignored.length) {
        const rows = ignored.map(mob => {
          const typeLabel = `P${mob.palier||'?'} ${mob.type||'—'}`;
          const tr = document.createElement('tr'); tr.style.opacity='.5';
          tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-size:11px;color:var(--muted);">${escHtml(typeLabel)}</span></td><td></td>`;
          const restBtn = document.createElement('button'); restBtn.className='btn btn-ghost'; restBtn.style.cssText='font-size:11px;padding:4px 10px;'; restBtn.textContent='↩ Restaurer';
          restBtn.addEventListener('click', () => { _removeIgnored(cat, mob.id); loadMobOrphans(); });
          tr.querySelector('td:last-child').appendChild(restBtn);
          return { tr };
        });
        _orphanIgnoredToggle(listEl, rows);
      }
    };

    makeMobSection(
      'mob-region',
      '🔴 Mobs sans région',
      mobsNoValidRegion,
      { head: 'Valeur actuelle', val: m => m.region || '' }
    );

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

// ══════════════════════════════════════════════════════
// IDs FANTÔMES (items)
// ══════════════════════════════════════════════════════
async function loadGhostIds() {
  const listEl = document.getElementById('ghost-id-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [items, mobs, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('mobs'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    const definedItemIds = new Set([
      ...items.map(i => i.id),
      ...hiddenItems.map(h => h.id).filter(Boolean),
    ]);
    const definedMobIds  = new Set(mobs.map(m => m.id));

    // ghostId → [{ label, type }]
    // type: 'craft' | 'drop' | 'mob-obtain'
    const refs = {};

    const EXCLUDED_IDS = new Set(['cols']); // IDs spéciaux (monnaie, etc.) jamais dans items

    // 1. Ingrédients de craft référençant un item inexistant
    for (const item of items) {
      for (const c of (item.craft || [])) {
        if (c.id && !definedItemIds.has(c.id) && !EXCLUDED_IDS.has(c.id)) {
          (refs[c.id] ??= []).push({ label: `Craft : ${item.name || item.id}`, type: 'craft' });
        }
      }
    }

    // 2. Loot de mobs référençant un item inexistant
    for (const mob of mobs) {
      for (const loot of (mob.loot || [])) {
        if (loot.id && !definedItemIds.has(loot.id) && !EXCLUDED_IDS.has(loot.id)) {
          const pct = loot.chance != null ? `${loot.chance}%` : '?%';
          (refs[loot.id] ??= []).push({ label: `Drop : ${mob.name || mob.id} (${pct})`, type: 'drop' });
        }
      }
    }

    // 3. Mobs référencés dans item.obtain mais absents de la collection mobs
    // Format : [mobId|MobName][chance] — on exclut [npc:xxx|...] qui sont des PNJ
    const reMobRef = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
    for (const item of items) {
      if (!item.obtain) continue;
      let m;
      reMobRef.lastIndex = 0;
      while ((m = reMobRef.exec(item.obtain)) !== null) {
        const mobId = m[1];
        if (!definedMobIds.has(mobId)) {
          (refs[mobId] ??= []).push({ label: `Obtain (mob) : ${item.name || item.id}`, type: 'mob-obtain' });
        }
      }
    }

    // 4. IDs de soumissions rejetées référencés dans des soumissions en attente
    try {
      const [rejectedSnap, pendingSnap] = await Promise.all([
        getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
        getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
      ]);
      const rejectedIds = new Set(
        rejectedSnap.docs.map(d => d.data()?.data?.id).filter(Boolean)
      );
      if (rejectedIds.size > 0) {
        for (const d of pendingSnap.docs) {
          const sub = d.data();
          const subName = sub.data?.name || sub.data?.id || '(soumission)';
          // craft ingredients
          for (const c of (sub.data?.craft || [])) {
            if (c.id && rejectedIds.has(c.id) && !definedItemIds.has(c.id)) {
              (refs[c.id] ??= []).push({ label: `Craft (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // evolutions
          for (const evId of (sub.data?.evolutions || [])) {
            if (rejectedIds.has(evId) && !definedItemIds.has(evId)) {
              (refs[evId] ??= []).push({ label: `Évolution (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // evolvedFrom
          for (const fId of (sub.data?.evolvedFrom || [])) {
            if (rejectedIds.has(fId) && !definedItemIds.has(fId)) {
              (refs[fId] ??= []).push({ label: `Évolué de (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // obtain string — mob refs
          if (sub.data?.obtain) {
            const reObt = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
            let mo;
            while ((mo = reObt.exec(sub.data.obtain)) !== null) {
              const mobId = mo[1];
              if (rejectedIds.has(mobId) && !definedMobIds.has(mobId)) {
                (refs[mobId] ??= []).push({ label: `Obtention (soumission en attente) : ${subName}`, type: 'rejected' });
              }
            }
          }
        }
      }
    } catch(e) { console.warn('[loadGhostIds] rejected scan error', e); }

    const ghostIds = Object.keys(refs).sort();
    listEl.innerHTML = '';

    if (!ghostIds.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID fantôme — tout est défini.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${ghostIds.length} ID${ghostIds.length > 1 ? 's' : ''} fantôme${ghostIds.length > 1 ? 's' : ''} trouvé${ghostIds.length > 1 ? 's' : ''}`;
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Type</th><th>ID fantôme</th><th>Référencé dans</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const id of ghostIds) {
      const entries = refs[id];
      // Un ID est un mob fantôme si toutes ses références viennent de mob-obtain ou rejected mob
      const isMob = entries.every(e => e.type === 'mob-obtain' || (e.type === 'rejected' && e.label.includes('Obtention')));
      const isRejected = entries.some(e => e.type === 'rejected');
      const tr = document.createElement('tr');
      if (isRejected) tr.style.cssText = 'background:rgba(248,113,113,.05);';
      const refsHtml = entries.map(e =>
        `<span class="ghost-type-${e.type}">${escHtml(e.label)}</span>`
      ).join('<br>');
      const typeCell = isRejected
        ? `<span style="font-size:10px;font-weight:700;color:#f87171;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:2px 7px;">🚫 Rejet</span>`
        : isMob
          ? `<span style="font-size:10px;font-weight:700;color:var(--warn);background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:2px 7px;">Mob</span>`
          : `<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(224,172,96,.1);border:1px solid rgba(224,172,96,.3);border-radius:8px;padding:2px 7px;">Item</span>`;
      const actionCell = isRejected
        ? `<span style="font-size:11px;color:var(--muted);">Soumission rejetée — à corriger</span>`
        : isMob
          ? `<a href="creator.html?ghostid=${encodeURIComponent(id)}&ghosttype=mob" target="_blank"
               class="btn btn-ghost" style="font-size:11px;padding:4px 10px;text-decoration:none;">👾 Créer le mob</a>`
          : `<a href="creator.html?ghostid=${encodeURIComponent(id)}" target="_blank"
               class="btn btn-ghost" style="font-size:11px;padding:4px 10px;text-decoration:none;">✏️ Créer l'item</a>`;
      tr.innerHTML = `
        <td>${typeCell}</td>
        <td><span class="ghost-id">${escHtml(id)}</span></td>
        <td><span class="ghost-refs">${refsHtml}</span></td>
        <td style="white-space:nowrap;">${actionCell}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    listEl.appendChild(table);

  } catch(e) {
    listEl.innerHTML = `<div class="empty">Erreur : ${escHtml(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════
// ÉDITEUR DE DONNÉES
// ══════════════════════════════════════════════════════
let _editorCollection = null;
let _editorId         = null;
let _editorOrigin     = null;

const _COL_LABELS = { items:'Item', mobs:'Mob', personnages:'PNJ', regions:'Région', panoplies:'Panoplie', quetes:'Quête', items_sensible:'Item Sensible', mobs_secret:'Mob Sensible', pnj_secret:'PNJ Sensible', map_markers:'Marqueur Carte' };

let _cachedRegions = null;
let _cachedSets    = null;

async function _loadRegionsForEditor() {
  if (_cachedRegions) return _cachedRegions;
  try {
    const docs = await cachedDocs('regions');
    _cachedRegions = [...docs].sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999));
  } catch { _cachedRegions = []; }
  return _cachedRegions;
}

async function _populateSetDatalist() {
  const dl = document.getElementById('ed-dl-sets');
  if (!dl) return;
  if (_cachedSets === null) {
    let items = _itemOrderData.length ? _itemOrderData : null;
    if (!items) {
      try {
        items = await cachedDocs('items');
      } catch { items = []; }
    }
    _cachedSets = [...new Set(items.map(i => i.set).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
  }
  dl.innerHTML = _cachedSets.map(s => `<option value="${_ee(s)}">`).join('');
}

// ── Éditeur générique ────────────────────────────────
let _editorOrigData = null;

const _ee = escHtml;

function _typeOf(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float';
  if (typeof val === 'string') return 'string';
  if (Array.isArray(val)) return 'array';
  return 'map';
}
function _typeColor(t) {
  return { bool:'#7dd3fc', int:'#86efac', float:'#a5f3c4', string:'#fcd34d', array:'#c084fc', map:'#f472b6', null:'var(--muted)' }[t] || 'var(--muted)';
}
function _typeLabel(t) {
  return { bool:'bool', int:'int', float:'float', string:'str', array:'array', map:'map', null:'null' }[t] || t;
}

const _GEN_FIELD_ORDER = [
  'id','name','titre','type','palier','zone','npc','rarity','category','cat','lvl','set','behavior','difficulty',
  'region','tag','inCodex','color','sensible','twoHanded','rune_slots',
  'images','lore','obtain','respawnDelay','spawnTime',
  'stats','classes','tags','effects','craft','loot','sells','zones','drops','morceaux','camera','attacks',
  'ordre','_order'
];

// ── Color Picker complet (HSV) ────────────────────
let _cpState = {};   // { [pickerId]: { h, s, v } }
let _cpDrag  = null; // { id, type: 'sv'|'hue' }

function _cpHsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r=c; g=x; }
  else if (h < 120) { r=x; g=c; }
  else if (h < 180) {      g=c; b=x; }
  else if (h < 240) {      g=x; b=c; }
  else if (h < 300) { r=x;      b=c; }
  else              { r=c;      b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function _cpRgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d > 0) {
    if      (max === r) h = ((g-b)/d + (g<b?6:0)) * 60;
    else if (max === g) h = ((b-r)/d + 2) * 60;
    else                h = ((r-g)/d + 4) * 60;
  }
  return [h, max===0 ? 0 : d/max*100, max*100];
}
function _cpHexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function _cpRgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function _makeColorObj(hex) {
  const [r,g,b] = _cpHexToRgb(hex);
  return { color: hex, dim: `rgba(${r},${g},${b},.35)`, glow: `rgba(${r},${g},${b},.08)` };
}

function isQualityOnly(data) {
  if (!data.quality) return false;
  // Un item "qualité uniquement" n'a aucun champ de contenu hors quality, id, et métadonnées
  const CONTENT_FIELDS = ['lore', 'obtain', 'craft', 'effects', 'images'];
  return !CONTENT_FIELDS.some(f => f in data && data[f] != null && data[f] !== '' && !(Array.isArray(data[f]) && data[f].length === 0));
}

function _cpUpdate(id, h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  v = Math.max(0, Math.min(100, v));
  _cpState[id] = { h, s, v };

  const [r,g,b] = _cpHsvToRgb(h, s, v);
  const hex     = _cpRgbToHex(r, g, b);
  const wrap    = document.getElementById(id);
  if (!wrap) return;

  // Carré SV — couleur de fond = teinte pure
  const pureHex = _cpRgbToHex(..._cpHsvToRgb(h, 100, 100));
  const svBg = wrap.querySelector('.ed-cp-sv-bg');
  if (svBg) svBg.style.background = pureHex;

  // Curseur SV
  const cur = wrap.querySelector('.ed-cp-cursor');
  if (cur) { cur.style.left = s+'%'; cur.style.top = (100-v)+'%'; cur.style.background = hex; }

  // Thumb teinte
  const hThumb = wrap.querySelector('.ed-cp-hue-thumb');
  if (hThumb) { hThumb.style.left = (h/360*100)+'%'; hThumb.style.background = pureHex; }

  // Input hex
  const hexIn = wrap.querySelector('.ed-cp-hex-in');
  if (hexIn && document.activeElement !== hexIn) hexIn.value = hex;

  // Inputs RGB
  const rgbIns = wrap.querySelectorAll('.ed-cp-rgb-in');
  if (rgbIns[0] && document.activeElement !== rgbIns[0]) rgbIns[0].value = r;
  if (rgbIns[1] && document.activeElement !== rgbIns[1]) rgbIns[1].value = g;
  if (rgbIns[2] && document.activeElement !== rgbIns[2]) rgbIns[2].value = b;

  // Swatches + labels
  const colorObj = _makeColorObj(hex);
  const sw = wrap.querySelector('.ed-cp-swatch'), swd = wrap.querySelector('.ed-cp-swatch-dim');
  if (sw)  sw.style.background  = hex;
  if (swd) swd.style.background = colorObj.dim;
  const hs = wrap.querySelector('.ed-cp-hex-lbl'), ds = wrap.querySelector('.ed-cp-dim-lbl'), gs = wrap.querySelector('.ed-cp-glow-lbl');
  if (hs) hs.textContent = hex;
  if (ds) ds.textContent = colorObj.dim;
  if (gs) gs.textContent = colorObj.glow;

  // Valeur sérialisée collectée par _collectGenericForm (JSON objet pour régions, hex pour panoplies)
  const mode = wrap.dataset.cpMode || 'object';
  const out  = wrap.querySelector('.ed-cp-out');
  if (out) out.value = mode === 'hex' ? hex : JSON.stringify(colorObj);

  // Palette — marquer la pastille active
  wrap.querySelectorAll('.ed-cp-preset').forEach(p => {
    p.style.outline       = p.dataset.hex === hex ? '2px solid #fff' : 'none';
    p.style.outlineOffset = '1px';
  });
}

document.addEventListener('mousemove', e => {
  if (!_cpDrag) return;
  const wrap = document.getElementById(_cpDrag.id);
  if (!wrap) { _cpDrag = null; return; }
  const st = _cpState[_cpDrag.id] || { h:0, s:100, v:100 };
  if (_cpDrag.type === 'sv') {
    const rect = wrap.querySelector('.ed-cp-sv').getBoundingClientRect();
    _cpUpdate(_cpDrag.id, st.h,
      Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),
      Math.max(0,Math.min(100,100-(e.clientY-rect.top)/rect.height*100)));
  } else {
    const rect = wrap.querySelector('.ed-cp-hue').getBoundingClientRect();
    _cpUpdate(_cpDrag.id, Math.max(0,Math.min(360,(e.clientX-rect.left)/rect.width*360)), st.s, st.v);
  }
});
document.addEventListener('mouseup', () => { _cpDrag = null; });

window.cpSvDown = function(e, id) {
  e.preventDefault(); _cpDrag = { id, type:'sv' };
  const rect = e.currentTarget.getBoundingClientRect(), st = _cpState[id]||{h:0,s:100,v:100};
  _cpUpdate(id, st.h,
    Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),
    Math.max(0,Math.min(100,100-(e.clientY-rect.top)/rect.height*100)));
};
window.cpHueDown = function(e, id) {
  e.preventDefault(); _cpDrag = { id, type:'hue' };
  const rect = e.currentTarget.getBoundingClientRect(), st = _cpState[id]||{h:0,s:100,v:100};
  _cpUpdate(id, Math.max(0,Math.min(360,(e.clientX-rect.left)/rect.width*360)), st.s, st.v);
};
window.cpHexInput = function(input, id) {
  const hex = input.value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const [r,g,b] = _cpHexToRgb(hex); const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(id, h, s, v);
};
window.cpRgbInput = function(input, id) {
  const wrap = document.getElementById(id); if (!wrap) return;
  const ins = wrap.querySelectorAll('.ed-cp-rgb-in');
  const r = Math.max(0,Math.min(255,parseInt(ins[0]?.value)||0));
  const g = Math.max(0,Math.min(255,parseInt(ins[1]?.value)||0));
  const b = Math.max(0,Math.min(255,parseInt(ins[2]?.value)||0));
  const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(id, h, s, v);
};
window.edPickPreset = function(swatch) {
  const wrap = swatch.closest('.ed-color-picker'); if (!wrap) return;
  const [r,g,b] = _cpHexToRgb(swatch.dataset.hex);
  const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(wrap.id, h, s, v);
};

function _genValueHtml(key, val, col) {
  const t = _typeOf(val);
  const isInternal = key === '_order';
  const isReadonly = isInternal;

  if (isReadonly) {
    return `<input class="ed-input" value="${_ee(String(val ?? ''))}" readonly style="opacity:.4;cursor:default;font-family:monospace;">`;
  }

  if (t === 'bool') {
    return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0;">
      <input type="checkbox" data-gf-type="bool"${val ? ' checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;cursor:pointer;">
      <span class="ed-gen-bool-txt" style="font-size:12px;color:var(--muted);">${val ? 'true' : 'false'}</span>
    </label>`;
  }

  if (t === 'int' || t === 'float') {
    return `<input class="ed-input" type="number" step="${t === 'float' ? 'any' : '1'}" data-gf-type="number" value="${_ee(String(val ?? ''))}">`;
  }

  // Color picker complet pour le champ color des régions & panoplies
  if (key === 'color' && (col === 'regions' || col === 'panoplies')) {
    const mode = col === 'panoplies' ? 'hex' : 'object';
    const hex  = mode === 'hex'
      ? (typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val) ? val : '#b87333')
      : ((val && typeof val === 'object' && val.color) ? val.color : '#9a9ab0');
    const obj = _makeColorObj(hex);
    const CP  = 'ed-cp-reg';  // ID fixe (un seul éditeur ouvert à la fois)

    const PRESETS = [
      { label:'Naturel',  colors:['#4ade80','#22c55e','#86efac','#a3e635','#34d399'] },
      { label:'Chaud',    colors:['#fbbf24','#f59e0b','#e0a050','#fb923c','#f97316'] },
      { label:'Feu',      colors:['#f87171','#ef4444','#f43f5e','#fb7185','#dc2626'] },
      { label:'Froid',    colors:['#60a5fa','#38bdf8','#7dd3fc','#a5f3fc','#818cf8'] },
      { label:'Mystique', colors:['#c084fc','#a855f7','#e879f9','#f0abfc','#d946ef'] },
      { label:'Neutre',   colors:['#9a9ab0','#94a3b8','#6b7280','#d4d4d8','#a1a1aa'] },
    ];
    const paletteHtml = PRESETS.map(g => `
      <div style="display:contents;">
        <span style="font-size:10px;color:var(--muted);grid-column:1;align-self:center;white-space:nowrap;">${_ee(g.label)}</span>
        ${g.colors.map(c => `<div class="ed-cp-preset" data-hex="${_ee(c)}" onclick="edPickPreset(this)"
          style="width:20px;height:20px;border-radius:4px;background:${_ee(c)};cursor:pointer;border:1px solid rgba(255,255,255,.15);transition:transform .12s;"
          onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform=''"></div>`).join('')}
      </div>`).join('');

    return `<div class="ed-color-picker" id="${_ee(CP)}" data-init-hex="${_ee(hex)}" data-cp-mode="${mode}"
      style="display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;max-width:320px;">

      <!-- Carré Saturation / Valeur -->
      <div class="ed-cp-sv" style="position:relative;width:100%;height:180px;border-radius:5px;cursor:crosshair;user-select:none;flex-shrink:0;"
           onmousedown="cpSvDown(event,'${_ee(CP)}')">
        <div class="ed-cp-sv-bg" style="position:absolute;inset:0;border-radius:5px;"></div>
        <div style="position:absolute;inset:0;border-radius:5px;background:linear-gradient(to right,#fff,transparent);"></div>
        <div style="position:absolute;inset:0;border-radius:5px;background:linear-gradient(to bottom,transparent,#000);"></div>
        <div class="ed-cp-cursor" style="position:absolute;width:13px;height:13px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.6);transform:translate(-50%,-50%);pointer-events:none;"></div>
      </div>

      <!-- Slider Teinte -->
      <div class="ed-cp-hue" style="position:relative;height:14px;border-radius:7px;cursor:pointer;user-select:none;
           background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);"
           onmousedown="cpHueDown(event,'${_ee(CP)}')">
        <div class="ed-cp-hue-thumb" style="position:absolute;top:50%;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 2px 4px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none;"></div>
      </div>

      <!-- Swatches + labels -->
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="ed-cp-swatch"     style="width:32px;height:32px;border-radius:5px;flex-shrink:0;border:1px solid rgba(255,255,255,.2);" title="color"></div>
        <div class="ed-cp-swatch-dim" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;border:1px solid rgba(255,255,255,.1);" title="dim (opacité 35%)"></div>
        <div style="font-family:monospace;font-size:11px;display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden;">
          <span class="ed-cp-hex-lbl"  style="color:var(--text);font-weight:600;"></span>
          <span class="ed-cp-dim-lbl"  style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
          <span class="ed-cp-glow-lbl" style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
        </div>
      </div>

      <!-- Inputs Hex + RGB -->
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--muted);width:20px;">#</span>
        <input class="ed-input ed-cp-hex-in" type="text" maxlength="7"
               style="font-family:monospace;width:76px;padding:4px 6px;font-size:13px;"
               oninput="cpHexInput(this,'${_ee(CP)}')" spellcheck="false" autocomplete="off">
        <span style="font-size:11px;color:var(--muted);">R</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
        <span style="font-size:11px;color:var(--muted);">G</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
        <span style="font-size:11px;color:var(--muted);">B</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
      </div>

      <!-- Palette de présélections -->
      <div style="display:grid;grid-template-columns:52px repeat(5,20px);gap:4px 6px;align-items:center;padding-top:4px;border-top:1px solid var(--border);">
        ${paletteHtml}
      </div>

      <!-- Valeur sérialisée (lue par _collectGenericForm) -->
      ${mode === 'hex'
        ? `<input class="ed-cp-out" data-gf-type="string" type="hidden" value="${_ee(hex)}">`
        : `<textarea class="ed-cp-out ed-json-ta" data-gf-type="json" spellcheck="false" style="display:none;">${_ee(JSON.stringify(obj))}</textarea>`}
    </div>`;
  }

  if (t === 'array' || t === 'map') {
    return `<textarea class="ed-json-ta" data-gf-type="json" spellcheck="false">${_ee(JSON.stringify(val, null, 2))}</textarea>`;
  }

  if (t === 'null') {
    return `<input class="ed-input" data-gf-type="string" value="" placeholder="(null)">`;
  }

  // Champ coords sur les PNJ → 3 inputs X/Y/Z
  if (key === 'coords' && col === 'personnages') {
    const c = (val && typeof val === 'object') ? val : { x: null, y: null, z: null };
    const xv = c.x ?? '';
    const yv = c.y ?? '';
    const zv = c.z ?? '';
    return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        X <input class="ed-input" type="number" step="any" data-gf-type="coords-x" value="${_ee(String(xv))}" style="width:76px;" placeholder="—">
      </label>
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        Z <input class="ed-input" type="number" step="any" data-gf-type="coords-z" value="${_ee(String(zv))}" style="width:76px;" placeholder="—">
      </label>
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        Y <input class="ed-input" type="number" step="any" data-gf-type="coords-y" value="${_ee(String(yv))}" style="width:76px;" placeholder="—">
      </label>
    </div>`;
  }

  // Champ region sur les mobs et PNJ → dropdown searchable groupé par palier/codex
  if (key === 'region' && (col === 'mobs' || col === 'personnages')) {
    const regions = _cachedRegions || [];
    const known = new Set(regions.map(r => r.id));
    const currentName = regions.find(r => r.id === val)?.name || (val && !known.has(val) ? `⚠️ ${val} (non reconnu)` : '');
    const paliers = [...new Set(regions.map(r => r.palier || 1))].sort((a,b) => a-b);

    let itemsHtml = `<div data-reg-id="" data-reg-name=""
      style="padding:7px 14px;cursor:pointer;font-size:13px;color:var(--muted);font-style:italic;"
      onmousedown="edSelectRegion(event,this)"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">— aucune —</div>`;

    for (const p of paliers) {
      const groups = [
        { label: `Palier ${p} — Codex`,      items: regions.filter(r => (r.palier||1)===p && r.inCodex!==false) },
        { label: `Palier ${p} — Hors Codex`, items: regions.filter(r => (r.palier||1)===p && r.inCodex===false) },
      ].filter(g => g.items.length);
      for (const { label, items } of groups) {
        itemsHtml += `<div data-reg-group style="padding:4px 10px 2px;font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;pointer-events:none;">${_ee(label)}</div>`;
        itemsHtml += items.map(r => `<div data-reg-id="${_ee(r.id)}" data-reg-name="${_ee(r.name||r.id)}"
          style="padding:6px 14px 6px 20px;cursor:pointer;font-size:13px;color:var(--text);"
          onmousedown="edSelectRegion(event,this)"
          onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">${_ee(r.name||r.id)}</div>`).join('');
      }
    }
    if (val && !known.has(val)) {
      itemsHtml += `<div data-reg-id="${_ee(val)}" data-reg-name="${_ee(val)}"
        style="padding:6px 14px;cursor:pointer;font-size:13px;color:var(--warn);"
        onmousedown="edSelectRegion(event,this)"
        onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">⚠️ ${_ee(val)} (conserver tel quel)</div>`;
    }

    return `<div style="position:relative;">
      <input type="text" class="ed-input" placeholder="🔍 Rechercher une région…"
             value="${_ee(currentName)}" autocomplete="off"
             oninput="edFilterRegions(this)" onfocus="edOpenRegions(this)"
             onblur="setTimeout(()=>edCloseRegions(this),150)">
      <input type="hidden" data-gf-type="string" value="${_ee(val||'')}">
      <div data-reg-dropdown style="display:none;position:absolute;top:100%;left:0;right:0;z-index:300;
           max-height:240px;overflow-y:auto;background:var(--surface2);border:1px solid var(--accent);
           border-top:none;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,.5);">
        ${itemsHtml}
      </div>
    </div>`;
  }

  // string
  const str = String(val ?? '');
  const listAttr = key === 'set' ? ' list="ed-dl-sets"' : '';
  if (key !== 'set') {
    return `<textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string">${_ee(str)}</textarea>`;
  }
  return `<input class="ed-input" data-gf-type="string" value="${_ee(str)}"${listAttr} autocomplete="off">`;
}

//here

const QUALITY_FIELDS = ['lore', 'obtain', 'craft', 'effects', 'images', 'name'];

function _renderFormFields(data, col, ns) {
  const entries = Object.entries(data).sort(([ak, av], [bk, bv]) => {
    const ia = _GEN_FIELD_ORDER.indexOf(ak), ib = _GEN_FIELD_ORDER.indexOf(bk);
    const ta = _typeOf(av), tb = _typeOf(bv);
    const cxa = ta === 'array' || ta === 'map', cxb = tb === 'array' || tb === 'map';
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    if (cxa && !cxb) return 1;
    if (!cxa && cxb) return -1;
    return ak.localeCompare(bk);
  });

  return entries.map(([key, val]) => {
    const t = _typeOf(val);
    const isFixed = key === '_order' || key === 'id';
    const nsAttr  = ns ? `data-gf-ns="${ns}"` : '';
    return `<div class="ed-gen-row" data-gf-orig-key="${_ee(key)}" ${nsAttr}>
      <div class="ed-gen-keycell">
        ${isFixed
          ? `<span class="ed-gen-keylbl" style="cursor:default;color:var(--muted);">${_ee(key)}</span>`
          : `<span class="ed-gen-keylbl" title="Clic pour renommer" onclick="edRenameField(this)">${_ee(key)}</span>`}
      </div>
      <span class="ed-gen-type" style="color:${_typeColor(t)};">${_typeLabel(t)}</span>
      <div class="ed-gen-val">${_genValueHtml(key, val, col)}</div>
      ${isFixed ? '<span></span>' : `<button type="button" class="ed-gen-delbtn" onclick="edDelGenRow(this)" title="Supprimer">✕</button>`}
    </div>`;
  }).join('');
}

window.edSwitchTab = function(tab) {
  document.querySelectorAll('.ed-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('ed-tab-base').style.display = tab === 'base' ? '' : 'none';
  document.querySelectorAll(`#ed-tab-base .ed-json-ta, #ed-tab-base .ed-textarea`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
};

window.edAddGenField = function() {
  // Toujours cibler le panneau BASE, jamais quality
  const container = document.getElementById('ed-gen-fields');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'ed-gen-row ed-gen-newrow';
  row.dataset.gfNs = 'base';  // ← ajout important
  row.innerHTML = `
    <input class="ed-gen-new-key ed-input" placeholder="nom_du_champ" style="font-family:monospace;font-size:12px;">
    <select class="ed-gen-new-type ed-input" style="font-size:11px;padding:5px 4px;">
      <option value="string">str</option>
      <option value="number">int</option>
      <option value="bool">bool</option>
      <option value="json">array/map</option>
    </select>
    <div class="ed-gen-val">
      <textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string" placeholder="valeur…"></textarea>
    </div>
    <button type="button" class="ed-gen-delbtn" onclick="edDelGenRow(this)" title="Annuler">✕</button>`;

  const typeSelect = row.querySelector('.ed-gen-new-type');
  const valDiv     = row.querySelector('.ed-gen-val');
  typeSelect.addEventListener('change', () => {
    const t = typeSelect.value;
    if (t === 'bool') {
      valDiv.innerHTML = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0;">
        <input type="checkbox" data-gf-type="bool" style="accent-color:var(--accent);width:15px;height:15px;">
        <span class="ed-gen-bool-txt" style="font-size:12px;color:var(--muted);">false</span>
      </label>`;
      valDiv.querySelector('input').addEventListener('change', function() {
        this.closest('label').querySelector('.ed-gen-bool-txt').textContent = this.checked ? 'true' : 'false';
      });
    } else if (t === 'json') {
      valDiv.innerHTML = `<textarea class="ed-json-ta" data-gf-type="json" spellcheck="false" placeholder="[] ou {}" style="min-height:50px;"></textarea>`;
    } else if (t === 'number') {
      valDiv.innerHTML = `<input class="ed-input" type="number" data-gf-type="number" placeholder="0">`;
    } else {
      valDiv.innerHTML = `<textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string" placeholder="valeur…"></textarea>`;
    }
  });

  container.appendChild(row);
  row.querySelector('.ed-gen-new-key').focus();
};

function _initFormExtras(scope = '#editor-form') {
  document.querySelectorAll(`${scope} .ed-json-ta`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => { 
      ta.style.height = 'auto'; 
      ta.style.height = ta.scrollHeight + 'px'; 
    });
  });
  document.querySelectorAll(`${scope} .ed-textarea`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => { 
      ta.style.height = 'auto'; 
      ta.style.height = ta.scrollHeight + 'px'; 
    });
  });
  document.querySelectorAll(`${scope} [data-gf-type="bool"]`).forEach(cb => {
    cb.addEventListener('change', function () {
      const lbl = this.closest('label')?.querySelector('.ed-gen-bool-txt');
      if (lbl) lbl.textContent = this.checked ? 'true' : 'false';
    });
  });
}

function _buildGenericForm(data, col) {
  // Normaliser img / image → images
  if ('img' in data || 'image' in data) {
    const existing = data.images?.length ? data.images : null;
    if (!existing) {
      const src = data.img || data.image;
      data = { ...data, images: src ? [src] : [] };
    }
    const { img, image, ...rest } = data;
    data = rest;
  }

  // Injections auto (inchangées)
  if (col === 'regions'     && !('color'  in data)) data = { ...data, color: _makeColorObj('#9a9ab0') };
  if (col === 'panoplies'   && !('color'  in data)) data = { ...data, color: '#b87333' };
  if (col === 'items'       && !('obtain' in data)) data = { ...data, obtain: '' };
  if (col === 'personnages') {
    const c = data.coords;
    if (c == null || typeof c === 'string') data = { ...data, coords: { x: null, y: null, z: null } };
  }
  if (col === 'items' && !('stats' in data) && ['arme','armure','accessoire','rune'].includes(data.category)) {
    data = { ...data, stats: {} };
  }

  _editorOrigData = { ...data };

  const { quality: _qualityData, ...baseData } = data;

  return `
    <div id="ed-tab-base" class="ed-tab-panel">
      <div id="ed-gen-fields" style="display:flex;flex-direction:column;gap:4px;">
        ${_renderFormFields(baseData, col, '')}
      </div>
      <datalist id="ed-dl-sets"></datalist>
      <button type="button" onclick="edAddGenField()" class="btn btn-ghost"
              style="font-size:12px;padding:6px 14px;margin-top:10px;">＋ Ajouter un champ</button>
    </div>`;
}

function _collectGenericForm() {
  // On repart de l'original (indispensable pour les panoplies et PNJ)
  const result = { ...(_editorOrigData || {}) };
  
  // 1. On ramasse TOUT ce qui est Base / Dynamique
  // On cible tous les champs qui ne sont PAS dans l'onglet qualité
  const allRows = document.querySelectorAll('.ed-gen-row, .ed-gen-newrow');
  const _criticalFields = new Set(['palier', 'region', 'category', 'rarity']);
  allRows.forEach(row => {
    const data = _innerExtract(row);
    if (data) {
      if (_criticalFields.has(data.key) && (data.value === null || data.value === '') && _editorOrigData?.[data.key] != null) {
        result[data.key] = _editorOrigData[data.key];
      } else {
        result[data.key] = data.value;
      }
    }
  });

  return result;
}

function _innerExtract(row) {
  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const keyIn  = row.querySelector('.ed-gen-key-input');
  const newKey = row.querySelector('.ed-gen-new-key');
  
  let key = (keyIn ? keyIn.value : (keyLbl ? keyLbl.textContent : '')).trim();
  key = key.replace(/\(hérité\)/g, '').trim();
  const effectiveKey = newKey ? newKey.value.trim() : key;
  
  if (!effectiveKey) return null;

  const t = el.dataset.gfType;
  let val;
  if (t === 'bool') val = el.checked;
  else if (t === 'number') val = el.value === '' ? null : Number(el.value);
  else if (t === 'json') {
    try { val = el.value.trim() ? JSON.parse(el.value) : null; }
    catch(e) { val = null; }
  }
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    val = { x: x===''?null:Number(x), y: y===''?null:Number(y), z: z===''?null:Number(z) };
  }
  else { val = el.value; }

  return { key: effectiveKey, value: val };
}


// Fonction utilitaire pour extraire la valeur d'une ligne (Base ou Qualité)
function _extractDataFromRow(row) {
  const keyInput = row.querySelector('.ed-gen-key-input');
  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const newKeyEl = row.querySelector('.ed-gen-new-key');
  
  const key = (keyInput ? keyInput.value.trim() : (keyLbl ? keyLbl.textContent.replace(/\(hérité\)/g,'').trim() : ''));
  const effectiveKey = newKeyEl ? newKeyEl.value.trim() : key;
  
  if (!effectiveKey) return null;

  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const t = el.dataset.gfType;
  let val;

  if (t === 'bool') val = el.checked;
  else if (t === 'number') val = el.value === '' ? null : +el.value;
  else if (t === 'json') {
    try { val = el.value.trim() ? JSON.parse(el.value) : null; } 
    catch(e) { val = null; }
  } 
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    val = { x: x===''?null:+x, y: y===''?null:+y, z: z===''?null:+z };
  }
  else {
    val = el.value;
  }

  return { key: effectiveKey, value: val };
}

// Fonction helper pour éviter la répétition et les erreurs de parsing
function _extractValueFromRow(row) {
  const keyInput = row.querySelector('.ed-gen-key-input');
  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const newKeyEl = row.querySelector('.ed-gen-new-key');
  
  const key = (keyInput ? keyInput.value.trim() : (keyLbl ? keyLbl.textContent.replace(/\(hérité\)/g,'').trim() : ''));
  const effectiveKey = newKeyEl ? newKeyEl.value.trim() : key;
  
  if (!effectiveKey) return null;

  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const t = el.dataset.gfType;
  let value;

  if (t === 'bool') value = el.checked;
  else if (t === 'number') value = el.value === '' ? null : +el.value;
  else if (t === 'json') {
    try { value = el.value.trim() ? JSON.parse(el.value) : null; } 
    catch(e) { value = null; }
  } 
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    value = { x: x===''?null:+x, y: y===''?null:+y, z: z===''?null:+z };
  }
  else {
    value = el.value;
  }

  return { key: effectiveKey, value: value };
}

window.edRenameField = function(lbl) {
  const currentKey = lbl.textContent.trim();
  const input = document.createElement('input');
  input.className = 'ed-gen-key-input ed-input';
  input.value = currentKey;
  input.title = 'Renommer ce champ — appuyez sur Entrée pour valider';
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  input.addEventListener('blur', () => {
    const newKey = input.value.trim();
    if (!newKey) { input.replaceWith(lbl); return; }
    if (newKey !== currentKey) {
      const row = input.closest('.ed-gen-row');
      if (row) row.dataset.gfOrigKey = currentKey; // keep original for diff
      lbl.textContent = newKey;
    }
    input.replaceWith(lbl);
  });
  lbl.replaceWith(input);
  input.focus(); input.select();
};

window.edDelGenRow = function(btn) {
  btn.closest('.ed-gen-row').remove();
};

// ── Region dropdown (éditeur) ────────────────────────
window.edOpenRegions = function(input) {
  const dd = input.closest('div[style*="position:relative"]').querySelector('[data-reg-dropdown]');
  if (dd) { dd.style.display = ''; edFilterRegions(input); }
};
window.edCloseRegions = function(input) {
  const wrap = input.closest('div[style*="position:relative"]');
  if (!wrap) return;
  const dd = wrap.querySelector('[data-reg-dropdown]');
  if (dd) dd.style.display = 'none';
  // Restaure le nom affiché depuis la valeur cachée
  const hidden = wrap.querySelector('input[type="hidden"]');
  if (hidden) {
    const cached = (_cachedRegions || []).find(r => r.id === hidden.value);
    input.value = cached ? (cached.name || cached.id) : (hidden.value || '');
  }
};
window.edFilterRegions = function(input) {
  const dd = input.closest('div[style*="position:relative"]').querySelector('[data-reg-dropdown]');
  if (!dd) return;
  dd.style.display = '';
  const q = normalize(input.value.trim());
  let lastGroup = null;
  Array.from(dd.children).forEach(el => {
    if (el.hasAttribute('data-reg-group')) {
      lastGroup = el; el.style.display = 'none'; return;
    }
    if (!el.hasAttribute('data-reg-id') && !el.hasAttribute('data-reg-name')) return;
    const name = normalize(el.dataset.regName || '');
    const id   = (el.dataset.regId   || '').toLowerCase();
    const show = !q || name.includes(q) || id.includes(q);
    el.style.display = show ? '' : 'none';
    if (show && lastGroup) { lastGroup.style.display = ''; lastGroup = null; }
  });
};
window.edSelectRegion = function(e, el) {
  e.preventDefault();
  const wrap   = el.closest('div[style*="position:relative"]');
  const textIn = wrap.querySelector('input[type="text"]');
  const hidden = wrap.querySelector('input[type="hidden"]');
  const id     = el.dataset.regId;
  const name   = el.dataset.regName;
  if (hidden) hidden.value = id;
  if (textIn) textIn.value = name || '';
  const dd = wrap.querySelector('[data-reg-dropdown]');
  if (dd) dd.style.display = 'none';
};


window.showEditor = async function(collection, id, data, origin) {
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.getElementById('editor-panel').style.display = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

  document.querySelector('.sidebar').classList.add('in-order-panel');

  _editorCollection = collection;
  _editorId         = id;
  _editorOrigin     = origin;

  // Fetch data from Firestore when not provided (e.g. called from the completion panel)
  if (!data) {
    document.getElementById('editor-title').textContent            = '✏️  Chargement…';
    document.getElementById('editor-collection-badge').textContent = _COL_LABELS[collection] || collection;
    document.getElementById('ed-error').style.display              = 'none';
    document.getElementById('editor-form').innerHTML               = '<div class="empty">Chargement…</div>';
    const btnL = document.getElementById('btn-save-editor');
    btnL.textContent = '💾 Sauvegarder'; btnL.disabled = false;
    btnL.style.background = 'var(--accent)'; btnL.style.color = '#fff';
    try {
      const snap = await getDoc(doc(db, collection, id));
      data = snap.exists() ? desanitizeFromFirestore({ id: snap.id, ...snap.data() }) : { id };
    } catch(e) {
      document.getElementById('ed-error').textContent = `Erreur lors du chargement : ${e.message}`;
      document.getElementById('ed-error').style.display = '';
      return;
    }
  }

  document.getElementById('editor-title').textContent            = `✏️  ${data.name || id}`;
  document.getElementById('editor-collection-badge').textContent = _COL_LABELS[collection] || collection;
  document.getElementById('ed-error').style.display              = 'none';
  const btn = document.getElementById('btn-save-editor');
  btn.textContent = '💾 Sauvegarder'; btn.disabled = false;
  btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
  const btnDel = document.getElementById('btn-delete-editor');
  if (btnDel) { btnDel.disabled = false; btnDel.textContent = '🗑️ Supprimer'; }

  // Charger les régions si besoin (pour la datalist)
  if (collection === 'mobs' || collection === 'personnages' || collection === 'regions' ||
      collection === 'mobs_secret' || collection === 'pnj_secret') {
    await _loadRegionsForEditor();
  }

  // Construire le formulaire générique (variantes sensibles traitées comme leur collection publique)
  const _colAlias = { items_sensible: 'items', mobs_secret: 'mobs', pnj_secret: 'personnages' };
  const formCollection = _colAlias[collection] ?? collection;
  document.getElementById('editor-form').innerHTML = _buildGenericForm(data, formCollection);


  // Basculer sur l'onglet qualité si l'item n'a pas de version normale
  if (isQualityOnly(data)) {
    edSwitchTab('quality');
  }

  // Initialiser le color picker si présent (régions)
  const cpEl = document.querySelector('#editor-form .ed-color-picker[data-init-hex]');
  if (cpEl) {
    const initHex    = cpEl.dataset.initHex || '#9a9ab0';
    const [ir,ig,ib] = _cpHexToRgb(initHex);
    const [ih,is,iv] = _cpRgbToHsv(ir, ig, ib);
    _cpUpdate(cpEl.id, ih, is, iv);
  }

  // Peupler la datalist des sets (items et items_sensible)
  if (collection === 'items' || collection === 'items_sensible') await _populateSetDatalist();

  _initFormExtras('#editor-form');
};

window.editorGoBack = function() {
  if (_editorOrigin === 'mob')            { showMobOrder();       return; }
  if (_editorOrigin === 'item')           { showItemOrder();      return; }
  if (_editorOrigin === 'pnj')            { showPnjOrder();       return; }
  if (_editorOrigin === 'region')         { showRegionOrder();    return; }
  if (_editorOrigin === 'panoplie')       { showPanoplieOrder();  return; }
  if (_editorOrigin === 'quest')          { showQuestOrder();     return; }
  if (_editorOrigin === 'region-orphan')  { showRegionOrphans(); return; }
  if (_editorOrigin === 'mob-orphan')     { showMobOrphans();    return; }
  if (_editorOrigin === 'quest-orphan')  { showQuestOrphans();  return; }
  if (_editorOrigin === 'migration')       { showMigration();       return; }
  if (_editorOrigin === 'completion')      { showCompletion(); return; }
  if (_editorOrigin === 'allpins')         { showMapPanel(); switchMapTab('allpins'); return; }
  if (_editorOrigin === 'data-all')        { showDataAll();        return; }
  if (_editorOrigin === 'dead-links')      { showDeadLinks();      return; }
  showSubmissions();
};

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

// ── Obtention écrite dans l'item : quand un PNJ fabrique ou vend un item, la ligne « Fabricable au [PNJ] » / « Achetable au [PNJ] » est ajoutée
// au champ `obtain` de cet item (sans doublon). Si le PNJ ne fabrique / ne vend plus l'item, sa ligne est retirée. Les autres lignes ne sont jamais touchées.
async function _syncPnjObtain(pnj) {
  const pid = pnj && (pnj.id || pnj._id);
  if (!pid || !pnj.name) return [];
  const want = new Map(); // id d'item -> ligne
  for (const e of (pnj.craft || [])) if (e && e.id) want.set(e.id, `Fabricable au [npc:${pid}|${pnj.name}]${npcLocSuffix(pnj, pnj.region ? _regionName(pnj.region) : '')}`);
  for (const e of (pnj.sells || [])) if (e && e.id && !want.has(e.id)) want.set(e.id, `Achetable au [npc:${pid}|${pnj.name}]${npcLocSuffix(pnj, pnj.region ? _regionName(pnj.region) : '')}`);
  const esc = String(pid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const mine = new RegExp('^[\\s-]*(Fabricable|Achetable) au \\[npc:' + esc + '[|\\]].*$', 'i');
  const snap = await getDocs(collection(db, 'items'));
  const touched = [];
  for (const d of snap.docs) {
    const data = d.data();
    const lines = String(data.obtain || '').split('\n');
    const kept = lines.filter(l => !mine.test(l.trim()));
    const line = want.get(d.id);
    const had = kept.length !== lines.length;
    if (!line && !had) continue;                       // l'item n'a rien à voir avec ce PNJ
    const text = line ? [...kept.filter(l => l.trim() !== ''), line].join('\n') : kept.join('\n').trim();
    if (text === String(data.obtain || '')) continue;
    await updateDoc(d.ref, { obtain: text });
    touched.push(data.name || d.id);
  }
  if (touched.length) invalidateModCache('items');
  return touched;
}

// Sens inverse : à la création / modification d'un item, les PNJ qui le fabriquent ou le vendent déjà y ajoutent leur ligne d'obtention.
// ── Loot des mobs ↔ obtain des items : la ligne « - [mob|Nom][chance] » du bloc « Obtenable en tuant: » suit le loot du mob (le mob fait foi).
const _mobLineRe = mid => new RegExp('^\\s*-\\s*\\[' + String(mid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\|[^\\]]*\\]\\[[^\\]]*\\]\\s*$');
function _upsertMobLine(text, mid, name, chance) {
  const line = `- [${mid}|${name || mid}][${chance != null && chance !== '' ? chance : '?'}]`;
  const lines = String(text || '').split('\n');
  const re = _mobLineRe(mid);
  const at = lines.findIndex(l => re.test(l));
  if (at >= 0) { lines[at] = line; return lines.join('\n'); }
  let last = -1, inBlock = false;
  lines.forEach((l, i) => {
    if (/^\s*Obtenable en tuant/i.test(l)) { inBlock = true; last = i; }
    else if (inBlock && /^\s*-\s*\[[^|\]]+\|[^\]]*\]\[[^\]]*\]\s*$/.test(l)) last = i;
    else if (l.trim() && !/^\s*-/.test(l)) inBlock = false;
  });
  if (last >= 0) { lines.splice(last + 1, 0, line); return lines.join('\n'); }
  const base = lines.filter(l => l.trim() !== '');
  return [...base, 'Obtenable en tuant:', line].join('\n');
}
function _removeMobLine(text, mid) {
  const re = _mobLineRe(mid);
  let lines = String(text || '').split('\n').filter(l => !re.test(l));
  // un bloc « Obtenable en tuant: » devenu vide disparaît aussi
  lines = lines.filter((l, i) => !(/^\s*Obtenable en tuant/i.test(l) && !/^\s*-\s*\[/.test(lines[i + 1] || '')));
  return lines.join('\n').trim();
}
// Mob créé / modifié : chaque item de son loot reçoit (ou met à jour) sa ligne ; un item qu'il ne loot plus la perd.
async function _syncMobObtain(mob) {
  const mid = mob && (mob.id || mob._id);
  if (!mid) return [];
  const lootMap = new Map();
  for (const l of (Array.isArray(mob.loot) ? mob.loot : [])) if (l && l.id) lootMap.set(l.id, l.chance);
  const snap = await getDocs(collection(db, 'items'));
  const touched = [];
  for (const d of snap.docs) {
    const data = d.data(), cur = String(data.obtain || '');
    const has = _mobLineRe(mid);
    const hadLine = cur.split('\n').some(l => has.test(l));
    let next = cur;
    if (lootMap.has(d.id)) next = _upsertMobLine(cur, mid, mob.name, lootMap.get(d.id));
    else if (hadLine) next = _removeMobLine(cur, mid);
    else continue;
    if (next === cur) continue;
    await updateDoc(d.ref, { obtain: next });
    touched.push(data.name || d.id);
  }
  if (touched.length) invalidateModCache('items');
  return touched;
}

async function _syncItemObtain(itemId) {
  if (!itemId) return [];
  const ref = doc(db, 'items', String(itemId));
  const snap = await getDoc(ref);
  if (!snap.exists()) return [];
  const cur = String(snap.data().obtain || '');
  const lst = v => Array.isArray(v) ? v : (v && typeof v === 'object' ? Object.values(v) : []);
  const pnjs = await getDocs(collection(db, 'personnages'));
  let lines = cur.split('\n');
  for (const d of pnjs.docs) {
    const p = d.data(), pid = p.id || d.id;
    if (!p.name) continue;
    const crafts = lst(p.craft).some(e => e && e.id === itemId);
    const sells = lst(p.sells).some(e => e && e.id === itemId);
    if (!crafts && !sells) continue;
    const loc = npcLocSuffix(p, p.region ? _regionName(p.region) : '');
    const line = `${crafts ? 'Fabricable' : 'Achetable'} au [npc:${pid}|${p.name}]${loc}`;
    const esc = String(pid).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mine = new RegExp('^[\\s-]*(Fabricable|Achetable) au \\[npc:' + esc + '[|\\]].*$', 'i');
    lines = lines.filter(l => !mine.test(l.trim()));
    lines = lines.filter(l => l.trim() !== '').concat(line);
  }
  let text = lines.join('\n');
  try {
    const mobsSnap = await getDocs(collection(db, 'mobs'));
    for (const d of mobsSnap.docs) {
      const m = d.data(), l = (Array.isArray(m.loot) ? m.loot : []).find(x => x && x.id === itemId);
      if (l) text = _upsertMobLine(text, m.id || d.id, m.name, l.chance);
    }
  } catch (e) { console.warn('[obtain mobs]', e); }
  if (text === cur) return [];
  await updateDoc(ref, { obtain: text });
  invalidateModCache('items');
  return [snap.data().name || String(itemId)];
}

// Registre des renommages (config/item_renames : { map: { ancienId: nouvelId } }). Les navigateurs qui ont encore l'ancien ID
// dans un brouillon d'Atelier le convertissent au chargement. Les chaînes sont raccourcies (a→b puis b→c devient a→c).
async function _recordItemRename(oldId, newId) {
  try {
    const ref = doc(db, 'config', 'item_renames');
    const snap = await getDoc(ref);
    const map = snap.exists() ? { ...(snap.data().map || {}) } : {};
    for (const k of Object.keys(map)) if (map[k] === oldId) map[k] = newId;
    map[oldId] = newId;
    delete map[newId];
    await setDoc(ref, { map });
  } catch (e) { console.warn('[renommage] registre non mis à jour :', e); }
}

async function _renameItemReferences(oldId, newId, opts = {}) {
  const COLS = ['items', 'mobs', 'personnages', 'quetes', 'panoplies', 'regions', 'zones', 'donjons', 'map_markers', 'builds_published', 'submissions', 'config'];
  const deepRep = v => {
    if (v === oldId) return { v: newId, c: true };
    if (opts.npcText && typeof v === 'string' && (v.includes(`[npc:${oldId}|`) || v.includes(`[npc:${oldId}]`))) {
      return { v: v.split(`[npc:${oldId}|`).join(`[npc:${newId}|`).split(`[npc:${oldId}]`).join(`[npc:${newId}]`), c: true };
    }
    if (Array.isArray(v)) { let c = false; const o = v.map(x => { const r = deepRep(x); if (r.c) c = true; return r.v; }); return { v: o, c }; }
    if (v && typeof v === 'object' && typeof v.toMillis !== 'function') {
      let c = false; const o = {};
      for (const [k, x] of Object.entries(v)) { const r = deepRep(x); if (r.c) c = true; o[k] = r.v; }
      return { v: o, c };
    }
    return { v, c: false };
  };
  let touched = 0;
  for (const col of COLS) {
    const snap = await getDocs(collection(db, col));
    for (const d of snap.docs) {
      if ((col === 'items' || col === 'personnages') && (d.id === oldId || d.id === newId)) continue;
      const data = d.data();
      if (col === 'submissions' && data.status !== 'pending') continue; // l'historique des soumissions traitées reste tel quel
      const patch = {};
      for (const [k, v] of Object.entries(data)) {
        if (k.startsWith('_')) continue;
        const r = deepRep(v);
        if (r.c) patch[k] = r.v;
      }
      if (Object.keys(patch).length) { await updateDoc(d.ref, patch); touched++; }
    }
    invalidateModCache(col);
  }
  return touched;
}

// ID attendu pour un palier : quêtes « pN_titre », items « nom_pN » (suffixe éventuel « _2 » conservé). null = pas de règle.
function _idForPalier(col, id, palier) {
  const p = Number(palier);
  if (!id || !Number.isInteger(p) || p < 1) return null;   // Event / Archive / vide : on ne touche pas
  if (col === 'quetes') return /^p\d+_/.test(id) ? id.replace(/^p\d+_/, `p${p}_`) : null;
  if (col === 'items')  return /_p\d+(?:_\d+)?$/.test(id) ? id.replace(/_p\d+((?:_\d+)?)$/, `_p${p}$1`) : null;
  return null;
}

// ── Save (générique) ─────────────────────────────────
window.saveEditor = async function() {
  const btn    = document.getElementById('btn-save-editor');
  const errDiv = document.getElementById('ed-error');
  errDiv.style.display = 'none';
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';

  try {
    const newData = _collectGenericForm();

    // ── Cas spécial : item sensible (items_hidden + items_secret) ──────────
    if (_editorCollection === 'items_sensible') {
      const gameplayKeys = await getItemGameplayKeys();
      const gameplay = {};
      const secret   = {};
      for (const [k, v] of Object.entries(newData)) {
        if (k === 'sensible') continue;
        if (gameplayKeys.includes(k)) gameplay[k] = v;
        else                          secret[k]   = v;
      }
      const nameHash = await hashName(newData.name);
      if (!nameHash) throw new Error('Nom manquant pour hash');
      const itemId    = String(newData.id || '');
      const oldItemId = String(_editorOrigData?.id || _editorId || '');
      // items_hidden est TOUJOURS keyé par hash du nom (jamais par item.id)
      const newHiddenDocId = nameHash;
      if (newHiddenDocId !== _editorId) {
        try { await deleteDoc(doc(db, COL.itemsHidden, _editorId)); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, newHiddenDocId), sanitizeForFirestore({ ...gameplay, nameHash, sensible: true }));
      // Si le publicId a changé, supprimer l'ancien doc items_secret (keyé par publicId) → évite l'orphelin
      if (oldItemId && oldItemId !== itemId) {
        try { await deleteDoc(doc(db, COL.itemsSecret, oldItemId)); } catch {}
      }
      if (itemId) {
        if (Object.keys(secret).length) {
          await setDoc(doc(db, COL.itemsSecret, itemId), sanitizeForFirestore({ ...secret, sensible: true }));
        } else {
          try { await deleteDoc(doc(db, COL.itemsSecret, itemId)); } catch {}
        }
      }
      invalidateModCache(COL.itemsHidden);
      invalidateModCache(COL.itemsSecret);
      // Mettre à jour _sensState en mémoire
      const merged = { ...gameplay, ...secret };
      const idx = _sensState.itemsHidden.findIndex(x => x._id === _editorId);
      if (idx >= 0) _sensState.itemsHidden[idx] = { _id: newHiddenDocId, ...merged };
      else _sensState.itemsHidden.push({ _id: newHiddenDocId, ...merged });
      _editorId = newHiddenDocId;
      _editorOrigData = { ...newData };
      // Forcer rechargement propre du panel data-all (sinon affiche encore l'ancien hash)
      _dataAllLoaded = false;
      btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
      setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }, 2500);
      return;
    }

    // L'ID suit le palier (quêtes : pN_…, items : …_pN) : un palier corrigé après coup corrige aussi l'ID, donc la clé du document
    // (sauf si l'ID a été modifié à la main dans le formulaire)
    {
      const synced = _idForPalier(_editorCollection, String(newData.id ?? ''), newData.palier);
      if (synced && synced !== String(newData.id) && String(newData.id) === String(_editorId)) {
        toast(`ID aligné sur le palier : ${newData.id} → ${synced}`, 'info');
        newData.id = synced;
        const idRow = [...document.querySelectorAll('.ed-gen-row')].find(r => r.querySelector('.ed-gen-keylbl')?.textContent.trim() === 'id');
        const idInput = idRow?.querySelector('[data-gf-type]');
        if (idInput) idInput.value = synced;
      }
    }

    // Item renommé dans le formulaire : l'ID suit le nom (sauf si l'ID a été modifié à la main)
    if (_editorCollection === 'items' && newData.name && _editorOrigData?.name && newData.name !== _editorOrigData.name
        && String(newData.id ?? '') === String(_editorId)) {
      const nid = _renamedItemId(String(_editorId), _editorOrigData.name, newData.name);
      if (nid) {
        toast(`ID aligné sur le nom : ${newData.id} → ${nid}`, 'info');
        newData.id = nid;
        const idRow = [...document.querySelectorAll('.ed-gen-row')].find(r => r.querySelector('.ed-gen-keylbl')?.textContent.trim() === 'id');
        const idInput = idRow?.querySelector('[data-gf-type]');
        if (idInput) idInput.value = nid;
      }
    }

    // Renommage d'ID → recréer le document (toutes collections)
    const rawNewId = (newData.id != null ? String(newData.id).trim() : '');
    const newDocId = rawNewId || _editorId;

    const _editorContribs = _readContribs(_editorOrigData);
    const _selfContrib = currentUser
      ? { uid: currentUser.uid, name: _userNames.get(currentUser.uid) || currentUser.displayName || currentUser.email || 'Inconnu' }
      : null;

    if (newDocId !== _editorId) {
      // Vérifier qu'aucun document n'existe déjà avec cet ID
      const clashSnap = await getDoc(doc(db, _editorCollection, newDocId));
      if (clashSnap.exists()) {
        throw new Error(`Un document avec l'ID "${newDocId}" existe déjà dans ${_editorCollection}.`);
      }
      const currentSnap = await getDoc(doc(db, _editorCollection, _editorId));
      const existing = currentSnap.exists() ? currentSnap.data() : {};
      const existContribs = _readContribs(existing);
      const contribs = existContribs.length ? existContribs : _editorContribs;
      const _merged = { ...existing, ...newData, id: newDocId, ...(contribs.length ? { _contributor: contribs } : {}) };
      let _edImgPairs = [];
      if (_editorCollection === 'items' && _merged.images?.length) { const r = _renameImagePaths(_merged.images, _editorId, newDocId); _merged.images = r.images; _edImgPairs = r.pairs; newData.images = r.images; }
      await setDoc(doc(db, _editorCollection, newDocId), _merged);
      await deleteDoc(doc(db, _editorCollection, _editorId));
      if (_editorCollection === 'personnages') { // quêtes, textes d'obtention [npc:id|nom], soumissions en attente…
        try {
          const n = await _renameItemReferences(_editorId, newDocId, { npcText: true });
          toast(`Références au PNJ mises à jour : ${n} document${n !== 1 ? 's' : ''}`, 'success', 6000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
      }
      if (_editorCollection === 'items') { // toutes les références à l'ancien ID suivent
        try {
          const n = await _renameItemReferences(_editorId, newDocId);
          await _recordItemRename(_editorId, newDocId);
          toast(`Références mises à jour : ${n} document${n !== 1 ? 's' : ''}`, 'success', 6000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
        _writeAudit('rename_id', 'item', newDocId, newData.name || newDocId, { from: _editorId, to: newDocId });
        _toastImageRenames(_edImgPairs);
      }
      _editorCacheRename(_editorCollection, _editorId, newDocId, newData);
      _editorId = newDocId;
    } else {
      // On prépare le patch à partir de newData
      const patch = { ...newData };

      // Suppression UNIQUEMENT des champs qui ont réellement disparu du formulaire
      // On ignore 'quality' ici car il est géré globalement dans newData
      Object.keys(_editorOrigData).forEach(k => {
        if (!(k in newData) && k !== '_order') {
          patch[k] = deleteField();
        }
      });

      if (!_editorContribs.length && _selfContrib) {
        patch._contributor = [_selfContrib];
      } else if (_editorContribs.length) {
        patch._contributor = _editorContribs; // préserver sans ajouter l'éditeur admin
      }

      // Nettoyage pour Firestore (évite les undefined/null selon tes besoins)
      await updateDoc(doc(db, _editorCollection, _editorId), sanitizeForFirestore(patch));
    }

    if (_editorCollection === 'items') {
      _syncItemObtain(String(_editorId)).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain item]', e));
    }

    if (_editorCollection === 'mobs') {
      _syncMobObtain({ ...newData, id: String(newData.id ?? _editorId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain mob]', e));
    }

    if (_editorCollection === 'personnages') {
      _syncPnjObtain({ ...newData, id: String(newData.id ?? _editorId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain PNJ]', e));
    }

    // Invalider les caches localStorage et session
    localStorage.removeItem(`vcl_cache_v2_${_editorCollection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_editorCollection}`);
    invalidateModCache(_editorCollection);
    if (_editorCollection === 'regions') _cachedRegions = null;
    if (_editorCollection === 'items')   _cachedSets    = null;

    // Mettre à jour le cache mémoire
    _editorCacheUpdate(_editorCollection, _editorId, newData);
    if (_editorCollection === 'mobs_secret') {
      const idx = _sensState.mobsSecret.findIndex(x => x._id === _editorId);
      if (idx >= 0) Object.assign(_sensState.mobsSecret[idx], newData);
    } else if (_editorCollection === 'pnj_secret') {
      const idx = _sensState.pnjSecret.findIndex(x => x._id === _editorId);
      if (idx >= 0) Object.assign(_sensState.pnjSecret[idx], newData);
    }
    _editorOrigData = { ...newData };
    // Mettre à jour le cache data-all (force rechargement propre)
    _dataAllLoaded = false;

    btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
    setTimeout(() => {
      btn.disabled = false; btn.textContent = '💾 Sauvegarder';
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
    }, 2500);

  } catch(e) {
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
    errDiv.textContent = '⛔ ' + e.message;
    errDiv.style.display = '';
  }
};

function _editorCacheRename(col, oldId, newId, newData) {
  const renameIn = (obj) => {
    obj.id = newId;
    Object.keys(obj).forEach(k => { if (k !== '_order' && !(k in newData)) delete obj[k]; });
    Object.entries(newData).forEach(([k, v]) => { if (k !== '_order' || !(k in obj)) obj[k] = v; });
  };
  if      (col === 'items')       { const it = _itemOrderData.find(i => i.id === oldId); if (it) renameIn(it); }
  else if (col === 'mobs')        { const m  = _mobOrderData.find(m => m.id === oldId);   if (m)  renameIn(m); }
  else if (col === 'personnages') { _pnjRegions.forEach(r => { const p = r.pnjs.find(p => p.id === oldId); if (p) renameIn(p); }); }
  else if (col === 'regions')     { const r  = _regionOrderData.find(r => r.id === oldId); if (r) renameIn(r); }
  else if (col === 'quetes')      { const qt = _questOrderData.find(q => q.id === oldId);  if (qt) renameIn(qt); }
}

function _editorCacheUpdate(col, id, newData) {
  const applyTo = (obj) => {
    // Supprimer les clés qui ne sont plus présentes (sauf internes)
    Object.keys(obj).forEach(k => { if (k !== '_order' && !(k in newData)) delete obj[k]; });
    Object.entries(newData).forEach(([k, v]) => { if (k !== '_order' || !(k in obj)) obj[k] = v; });
  };
  if      (col === 'items')       { const it = _itemOrderData.find(i => i.id === id); if (it) applyTo(it); }
  else if (col === 'mobs')        { const m  = _mobOrderData.find(m => m.id === id);   if (m)  applyTo(m); }
  else if (col === 'personnages') { _pnjRegions.forEach(r => { const p = r.pnjs.find(p => p.id === id); if (p) applyTo(p); }); }
  else if (col === 'regions')     { const r  = _regionOrderData.find(r => r.id === id); if (r) applyTo(r); }
  else if (col === 'quetes')      { const qt = _questOrderData.find(q => q.id === id);  if (qt) applyTo(qt); }
}

// ── Delete entry (depuis l'éditeur) ──────────────────
window.deleteCurrentEntry = async function() {
  const typeName = _COL_LABELS[_editorCollection] || _editorCollection;
  if (!await modal.confirm(`Supprimer ce ${typeName} "${_editorId}" ?\n\nL'entrée sera placée en corbeille (restaurable depuis l'onglet Admin > Corbeille).`)) return;
  const btn = document.getElementById('btn-delete-editor');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    // Sauvegarder en corbeille avant suppression
    const trashPayload = {
      originalCollection: _editorCollection,
      originalId: _editorId,
      deletedAt: serverTimestamp(),
      deletedBy: currentUser?.uid || null,
      deletedByName: _userNames.get(currentUser?.uid) || currentUser?.email || 'Inconnu',
      data: sanitizeForFirestore(_editorOrigData || {})
    };
    try { await addDoc(collection(db, 'trash'), trashPayload); } catch(te) { console.warn('[Trash] Sauvegarde corbeille échouée:', te); }

    if (_editorCollection === 'items_sensible') {
      // items_hidden keyé par nameHash (_editorId = hash), items_secret keyé par item.id
      const itemId = String(_editorOrigData?.id || '');
      const delBatch = writeBatch(db);
      delBatch.delete(doc(db, COL.itemsHidden, _editorId));
      if (itemId) delBatch.delete(doc(db, COL.itemsSecret, itemId));
      await delBatch.commit();
      invalidateModCache(COL.itemsHidden);
      invalidateModCache(COL.itemsSecret);
      _sensState.itemsHidden = _sensState.itemsHidden.filter(x => x._id !== _editorId);
      _dataAllData = _dataAllData.filter(d => !(d._col === COL.itemsHidden && d._docKey === _editorId));
      editorGoBack();
      return;
    }
    await deleteDoc(doc(db, _editorCollection, _editorId));
    // Invalider les caches localStorage
    localStorage.removeItem(`vcl_cache_v2_${_editorCollection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_editorCollection}`);
    invalidateModCache(_editorCollection);
    // Retirer de la liste locale (évite d'avoir à recharger le panneau)
    if      (_editorCollection === 'mobs')        { _mobOrderData    = _mobOrderData.filter(m => m.id !== _editorId); }
    else if (_editorCollection === 'items')        { _itemOrderData   = _itemOrderData.filter(i => i.id !== _editorId); }
    else if (_editorCollection === 'personnages')  { _pnjRegions.forEach(r => { r.pnjs = r.pnjs.filter(p => p.id !== _editorId); }); }
    else if (_editorCollection === 'regions')      { _regionOrderData = _regionOrderData.filter(r => r.id !== _editorId); }
    else if (_editorCollection === 'quetes')       { _questOrderData  = _questOrderData.filter(q => q.id !== _editorId); }
    // Retirer aussi du cache data-all (suppression en chaîne sans reload)
    const _delId = _editorId;
    const _delCol = _editorCollection;
    _dataAllData = _dataAllData.filter(d => !(d.id === _delId && d._col === _delCol));
    editorGoBack();
  } catch(e) {
    btn.disabled = false; btn.textContent = '🗑️ Supprimer';
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ════════════════════════════════════════
//   CORBEILLE
// ════════════════════════════════════════

window.showTrash = async () => {
  _setHash('trash');
  document.getElementById('trash-panel').style.display = '';
  document.getElementById('btn-trash').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadTrash();
};

window.loadTrash = async function loadTrash() {
  const listEl = document.getElementById('trash-list');
  const emptyBtn = document.getElementById('btn-empty-trash');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(collection(db, 'trash'));
    const items = snap.docs.map(d => ({ _trashId: d.id, ...d.data() }));
    items.sort((a, b) => {
      const ta = a.deletedAt?.seconds || 0;
      const tb = b.deletedAt?.seconds || 0;
      return tb - ta;
    });
    const countEl = document.getElementById('count-trash');
    if (countEl) { countEl.textContent = items.length; countEl.style.display = items.length ? '' : 'none'; }
    if (emptyBtn) emptyBtn.style.display = items.length ? '' : 'none';
    if (!items.length) { listEl.innerHTML = '<div class="empty">Corbeille vide.</div>'; return; }
    listEl.innerHTML = '';
    const COL_LABELS_TRASH = { ...(_COL_LABELS || {}), items:'Item', mobs:'Mob', personnages:'PNJ', regions:'Région', panoplies:'Panoplie', quetes:'Quête', items_sensible:'Item Sensible' };
    items.forEach(item => {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;flex-wrap:wrap;';
      const colLabel = COL_LABELS_TRASH[item.originalCollection] || item.originalCollection || '?';
      const itemName = item.data?.name || item.data?.label || item.data?.titre || item.originalId || '?';
      const deletedDate = item.deletedAt?.seconds
        ? new Date(item.deletedAt.seconds * 1000).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
        : '—';
      row.innerHTML = `
        <div style="flex:1;min-width:180px;">
          <div style="font-size:13px;font-weight:700;color:var(--text);">${escHtml(itemName)}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px;">
            <b>${escHtml(colLabel)}</b> · ID : <code style="font-size:10px;">${escHtml(item.originalId || '?')}</code>
          </div>
          <div style="font-size:11px;color:var(--muted);margin-top:1px;">
            Supprimé le ${escHtml(deletedDate)} par <b>${escHtml(item.deletedByName || '?')}</b>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0;">
          <button class="btn btn-approve" style="font-size:12px;" onclick="restoreFromTrash('${escHtml(item._trashId)}')">↩ Restaurer</button>
          <button class="btn btn-reject"  style="font-size:12px;" onclick="permanentDeleteTrash('${escHtml(item._trashId)}')">🗑️ Supprimer</button>
        </div>`;
      listEl.appendChild(row);
    });
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.restoreFromTrash = async function restoreFromTrash(trashId) {
  const snap = await getDoc(doc(db, 'trash', trashId));
  if (!snap.exists()) { toast('⛔ Entrée introuvable en corbeille.', 'error'); return; }
  const item = snap.data();
  const targetCol = item.originalCollection;
  const targetId  = item.originalId;
  if (!targetCol || !targetId) { toast('⛔ Données de restauration incomplètes.', 'error'); return; }
  try {
    if (targetCol === 'items_sensible') {
      const restoreData = { ...(item.data || {}) };
      if (!restoreData.nameHash && restoreData.name) {
        try { restoreData.nameHash = await hashName(restoreData.name); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, targetId), sanitizeForFirestore(restoreData));
      await deleteDoc(doc(db, 'trash', trashId));
      localStorage.removeItem(`vcl_cache_v2_${COL.itemsHidden}`);
      localStorage.removeItem(`vcl_cache_meta_v2_${COL.itemsHidden}`);
      invalidateModCache(COL.itemsHidden);
      toast(`✓ "${targetId}" restauré dans items_hidden.`, 'success');
      loadTrash();
      return;
    }
    await setDoc(doc(db, targetCol, targetId), sanitizeForFirestore(item.data || {}));
    await deleteDoc(doc(db, 'trash', trashId));
    localStorage.removeItem(`vcl_cache_v2_${targetCol}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${targetCol}`);
    invalidateModCache(targetCol);
    toast(`✓ "${targetId}" restauré dans ${targetCol}.`, 'success');
    loadTrash();
  } catch(e) {
    toast('⛔ Erreur restauration : ' + e.message, 'error');
  }
};

window.permanentDeleteTrash = async function permanentDeleteTrash(trashId) {
  if (!await modal.confirm('Supprimer définitivement cette entrée de la corbeille ? Cette action est irréversible.')) return;
  try {
    await deleteDoc(doc(db, 'trash', trashId));
    toast('✓ Supprimé définitivement.', 'success');
    loadTrash();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

window.emptyTrash = async function emptyTrash() {
  if (!await modal.confirm('Vider toute la corbeille ? Toutes les entrées seront supprimées définitivement et irrécupérables.')) return;
  try {
    const snap = await getDocs(collection(db, 'trash'));
    await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
    toast('✓ Corbeille vidée.', 'success');
    loadTrash();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

let CREATOR_PALIERS = [1, 2, 3]; // mis à jour dynamiquement depuis Firestore config/paliers
let _paliersConfig = []; // données complètes { id, label, color, floorName }
let _ccConfig = null;

async function _loadPaliersConfig() {
  try {
    const snap = await getDoc(doc(db, 'config', 'paliers'));
    if (snap.exists() && Array.isArray(snap.data().paliers) && snap.data().paliers.length) {
      _paliersConfig = snap.data().paliers;
      CREATOR_PALIERS = _paliersConfig.map(p => p.id);
      // Mettre à jour les options du champ palier dans le completion panel
      // _CF_DEFS est initialisé plus bas dans le module, mais cette fonction est appelée
      // de manière asynchrone (après login), donc _CF_DEFS est déjà défini.
      _CF_DEFS.palier.opts = _paliersConfig.map(p => [p.id, p.label]);
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

async function _saveCreatorConfig() {
  try {
    await setDoc(doc(db, 'config', 'creator'), _ccConfig);
  } catch(e) {
    toast(`⛔ Erreur sauvegarde config creator : ${e.message}`, "error");
  }
}

window.toggleCreatorTool = async function(toolId) {
  if (!_ccConfig) return;
  _ccConfig.tools = _ccConfig.tools || {};
  _ccConfig.tools[toolId] = _ccConfig.tools[toolId] === false ? true : false;
  _renderPermsForRole(_selectedRoleId);
  await _saveCreatorConfig();
};

window.toggleCreatorPalier = async function(p) {
  if (!_ccConfig) return;
  const hidden = new Set(_ccConfig.hiddenPaliers || []);
  if (hidden.has(p)) hidden.delete(p); else hidden.add(p);
  _ccConfig.hiddenPaliers = [...hidden];
  _renderPermsForRole(_selectedRoleId);
  await _saveCreatorConfig();
};

// ── Discord Webhooks ──────────────────────────────────
let _dwConfig = null;
const DW_CATEGORIES = [
  { id: 'arme',       label: '⚔️ Arme' },
  { id: 'armure',     label: '🛡️ Armure' },
  { id: 'accessoire', label: '💍 Accessoire' },
];

const EMBED_FIELDS = [
  { id:'identity', label:'🏷️ Identité',   desc:'Rareté · Catégorie · Palier · Niveau' },
  { id:'classes',  label:'⚔️ Classes',    desc:'Classes requises' },
  { id:'lore',     label:'📖 Lore',       desc:'Texte de lore en italique' },
  { id:'stats',    label:'📊 Stats',      desc:'Stats + emplacements de runes' },
  { id:'obtain',   label:'📍 Obtention',  desc:"Méthode d'obtention" },
  { id:'craft',    label:'🔨 Craft',      desc:'Recette de craft' },
  { id:'effects',  label:'✨ Effets',     desc:'Effets spéciaux' },
  { id:'bonuses',  label:'🔗 Bonus pano', desc:'Bonus de panoplie' },
];


let _dwPublishItems = [];
let _dwActivetab = 'webhooks';

window.showDiscordWebhooks = async () => {
  _setHash('webhooks');
  document.getElementById('discord-webhooks-panel').style.display = '';
  document.getElementById('btn-discord-webhooks').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadDiscordWebhooks();
};

window.loadDiscordWebhooks = async function loadDiscordWebhooks() {
  const loading = document.getElementById('dw-loading');
  const content = document.getElementById('dw-content');
  loading.style.display = '';
  loading.textContent   = 'Chargement…';
  content.style.display = 'none';
  try {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};

    // Migrate: array format (v1) → object format (v2)
    if (Array.isArray(_dwConfig.tagRules)) {
      const oldRules = _dwConfig.tagRules;
      _dwConfig.tagRules = {};
      for (const cat of DW_CATEGORIES) {
        for (const p of CREATOR_PALIERS) {
          const key = `${cat.id}_${p}`;
          if (_dwConfig[key]) _dwConfig.tagRules[key] = oldRules.map(r => ({...r}));
        }
      }
    }
    // Migrate: legacy flat tags → tagRules object (very old format)
    if (_dwConfig.tags && !_dwConfig.tagRules) {
      _dwConfig.tagRules = {};
      const rules = Object.entries(_dwConfig.tags).map(([k, v]) => {
        const isCategory = ['arme','armure','accessoire'].includes(k);
        return { field: isCategory ? 'category' : 'rarity', op: 'eq', value: k, tagId: v };
      }).filter(r => r.tagId);
      for (const cat of DW_CATEGORIES) {
        for (const p of CREATOR_PALIERS) {
          const key = `${cat.id}_${p}`;
          if (_dwConfig[key]) _dwConfig.tagRules[key] = rules.map(r => ({...r}));
        }
      }
    }
    if (!_dwConfig.tagRules) _dwConfig.tagRules = {};

    _renderDiscordWebhooks();
    document.getElementById('dw-template').value = _dwConfig.template || '';
    switchDwTab(_dwActivetab || 'webhooks');
    loading.style.display = 'none';
    content.style.display = '';
  } catch(e) {
    loading.textContent = `Erreur : ${e.message}`;
  }
};

function _renderDiscordWebhooks() {
  const list = document.getElementById('dw-list');
  list.innerHTML = '';

  // ── Webhook "Nouveaux ajouts" ──────────────────────────
  const newSubSection = document.createElement('div');
  newSubSection.style.cssText = 'margin-bottom:24px;padding:12px 14px;background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.2);border-radius:8px;';
  newSubSection.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📬 Nouvelles soumissions</div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5;">
      Webhook envoyé automatiquement quand un contributeur soumet un ajout ou une modification. Contient toute la data.
    </p>
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="text" id="dw-new-submission" placeholder="https://discord.com/api/webhooks/…"
        value="${_dwConfig?.new_submission || ''}"
        style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:11px;outline:none;font-family:monospace;transition:border-color .15s;"
        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px;flex-shrink:0;" onclick="testNewSubmissionWebhook()">🧪 Test</button>
    </div>
  `;
  list.appendChild(newSubSection);

  for (const cat of DW_CATEGORIES) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:20px;';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:10px;';
    header.textContent = cat.label;
    section.appendChild(header);

    for (const p of CREATOR_PALIERS) {
      const key = `${cat.id}_${p}`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
      const input = document.createElement('input');
      input.type        = 'text';
      input.id          = `dw-${key}`;
      input.placeholder = 'ID du channel Discord (forum)';
      input.value       = _dwConfig[key] || '';
      input.style.cssText = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:11px;outline:none;font-family:monospace;transition:border-color .15s;';
      input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
      input.addEventListener('blur',  () => { input.style.borderColor = 'var(--border)'; });

      const label = document.createElement('span');
      label.textContent = `Palier ${p}`;
      label.style.cssText = 'font-size:12px;width:58px;flex-shrink:0;color:var(--text);';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost';
      delBtn.title = 'Supprimer tous les posts Discord de ce channel';
      delBtn.style.cssText = 'font-size:11px;padding:5px 8px;flex-shrink:0;color:var(--danger);';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => deleteChannelPosts(key));

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(delBtn);
      section.appendChild(row);
    }
    list.appendChild(section);
  }
}

window.deleteChannelPosts = async function deleteChannelPosts(key) {
  if (!await modal.confirm(`Supprimer tous les posts Discord pour « ${key} » ?\n(supprime uniquement les messages sur Discord, les données Firestore sont conservées)`)) return;

  const snap = await getDocs(collection(db, 'discord_posts'));
  const posts = snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(p => p.webhookKey === key);

  if (!posts.length) {
    toast('Aucun post tracké pour ce channel.', 'warning');
    return;
  }

  const WORKER_SECRET = await _getWorkerSecret();
  let deleted = 0, failed = 0;
  for (const post of posts) {
    try {
      if (post.threadId) {
        const rt = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: WORKER_SECRET, action: 'delete_thread', threadId: post.threadId }),
        });
        if (!rt.ok) { console.warn('[deleteChannelPosts] thread delete failed', rt.status); failed++; continue; }
      }
      await deleteDoc(doc(db, 'discord_posts', post._id)).catch(() => {});
      deleted++;
    } catch(e) { console.error('[deleteChannelPosts] error', e); failed++; }
  }
  toast(`${deleted} post(s) supprimé(s)${failed ? `, ${failed} échec(s) — voir console` : ''}.`, deleted ? 'success' : 'error');
};

window.saveDiscordWebhooks = async function saveDiscordWebhooks() {
  const btn = document.getElementById('dw-save-btn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = {};
    for (const cat of DW_CATEGORIES) {
      for (const p of CREATOR_PALIERS) {
        const key = `${cat.id}_${p}`;
        const val = document.getElementById(`dw-${key}`)?.value?.trim() || '';
        if (val) data[key] = val;
      }
    }
    const tpl = document.getElementById('dw-template')?.value?.trim() || '';
    if (tpl) data.template = tpl;
    const newSub = document.getElementById('dw-new-submission')?.value?.trim() || '';
    if (newSub) data.new_submission = newSub;
    // Persist embedFields from in-memory config
    if (_dwConfig?.embedFields) data.embedFields = _dwConfig.embedFields;

    // Persist tagRules object (keyed by channel, skip empty arrays)
    if (_dwConfig?.tagRules && !Array.isArray(_dwConfig.tagRules)) {
      const cleaned = {};
      for (const [k, v] of Object.entries(_dwConfig.tagRules)) {
        if (Array.isArray(v) && v.length > 0) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length) data.tagRules = cleaned;
    }

    // Preserve set cache
    if (_dwConfig?._setCache) data._setCache = _dwConfig._setCache;

    await setDoc(doc(db, 'config', 'discord_webhooks'), data);
    _dwConfig = data;
    btn.textContent = '✓ Sauvegardé';
    setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }, 2000);
  } catch(e) {
    toast(`⛔ Erreur sauvegarde webhooks : ${e.message}`, "error");
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
  }
};

// ── Tab switcher ──────────────────────────────────────
window.switchDwTab = function switchDwTab(name) {
  _dwActivetab = name;
  const tabs = ['webhooks', 'embed', 'publish'];
  for (const t of tabs) {
    const tab = document.getElementById(`dw-tab-${t}`);
    const btn = document.getElementById(`dw-tab-btn-${t}`);
    if (!tab || !btn) continue;
    const active = t === name;
    tab.style.display = active ? '' : 'none';
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
  }
  if (name === 'embed')   _renderEmbedBuilder();
  if (name === 'publish') _renderPublishPanel();
};

// ── Embed Builder ─────────────────────────────────────
function _renderEmbedBuilder() {
  const activeEl   = document.getElementById('dw-embed-active');
  const inactiveEl = document.getElementById('dw-embed-inactive');
  if (!activeEl || !inactiveEl) return;

  const allIds   = EMBED_FIELDS.map(f => f.id);
  const activeIds = (_dwConfig?.embedFields) ? [..._dwConfig.embedFields] : [...allIds];
  const inactiveIds = allIds.filter(id => !activeIds.includes(id));

  const INPUT_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--text);outline:none;';
  const BTN_GHOST   = 'background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--muted);cursor:pointer;font-size:11px;padding:3px 7px;';

  function rebuildActiveDOM() {
    activeEl.innerHTML = '';
    const ids = (_dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id));
    for (let i = 0; i < ids.length; i++) {
      const fid = ids[i];
      const fd  = EMBED_FIELDS.find(f => f.id === fid);
      if (!fd) continue;
      const row = document.createElement('div');
      row.dataset.id = fid;
      row.draggable  = true;
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;cursor:grab;user-select:none;transition:opacity .15s;';
      row.innerHTML = `
        <span style="color:var(--muted);font-size:14px;flex-shrink:0;">≡</span>
        <span style="flex:1;font-size:12px;font-weight:600;">${fd.label}</span>
        <span style="font-size:11px;color:var(--muted);">${fd.desc}</span>
        <button style="${BTN_GHOST}" title="Désactiver" onclick="dwEmbedRemove('${fid}')">✕</button>
      `;
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', fid); row.style.opacity = '.4'; });
      row.addEventListener('dragend',   () => { row.style.opacity = '1'; });
      row.addEventListener('dragover',  e => { e.preventDefault(); row.style.borderColor = 'var(--accent)'; });
      row.addEventListener('dragleave', () => { row.style.borderColor = 'var(--border)'; });
      row.addEventListener('drop',      e => {
        e.preventDefault();
        row.style.borderColor = 'var(--border)';
        const srcId = e.dataTransfer.getData('text/plain');
        if (srcId === fid) return;
        const arr = _dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id);
        const si = arr.indexOf(srcId), di = arr.indexOf(fid);
        if (si < 0 || di < 0) return;
        arr.splice(di, 0, arr.splice(si, 1)[0]);
        _dwConfig.embedFields = arr;
        rebuildActiveDOM(); _renderEmbedPreview();
      });
      activeEl.appendChild(row);
    }
  }

  function rebuildInactiveDOM() {
    inactiveEl.innerHTML = '';
    const activeIds2 = _dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id);
    const inactive = EMBED_FIELDS.filter(f => !activeIds2.includes(f.id));
    if (!inactive.length) {
      inactiveEl.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic;">Tous les blocs sont actifs.</div>';
      return;
    }
    for (const fd of inactive) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;opacity:.6;';
      row.innerHTML = `
        <span style="flex:1;font-size:12px;">${fd.label} <span style="color:var(--muted);font-size:11px;">· ${fd.desc}</span></span>
        <button style="${BTN_GHOST};color:var(--accent);" onclick="dwEmbedAdd('${fd.id}')">＋</button>
      `;
      inactiveEl.appendChild(row);
    }
  }

  if (!_dwConfig.embedFields) _dwConfig.embedFields = EMBED_FIELDS.map(f => f.id);
  rebuildActiveDOM();
  rebuildInactiveDOM();
  _renderEmbedPreview();

  window.dwEmbedRemove = function(fid) {
    _dwConfig.embedFields = (_dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id)).filter(id => id !== fid);
    rebuildActiveDOM(); rebuildInactiveDOM(); _renderEmbedPreview();
  };
  window.dwEmbedAdd = function(fid) {
    if (!_dwConfig.embedFields) _dwConfig.embedFields = EMBED_FIELDS.map(f=>f.id);
    if (!_dwConfig.embedFields.includes(fid)) _dwConfig.embedFields.push(fid);
    rebuildActiveDOM(); rebuildInactiveDOM(); _renderEmbedPreview();
  };
}

// ── Tag Rules ─────────────────────────────────────────
function _dwAllChannelKeys() {
  const standard = [];
  for (const cat of DW_CATEGORIES) {
    for (const p of [...CREATOR_PALIERS, 'event']) standard.push(`${cat.id}_${p}`);
  }
  const extra = Object.keys(_dwConfig.tagRules || {}).filter(k => !standard.includes(k));
  return [...standard, ...extra];
}

function _dwChannelLabel(key) {
  const parts  = key.split('_');
  const catId  = parts.slice(0, -1).join('_');
  const palier = parts[parts.length - 1];
  const cat    = DW_CATEGORIES.find(c => c.id === catId);
  if (!cat) return key;
  return palier === 'event' ? `${cat.label} · Event` : `${cat.label} · Palier ${palier}`;
}


// ── Publish Panel ─────────────────────────────────────
function _renderUnsentSection() {
  const section = document.getElementById('dw-unsent-section');
  if (!section) return;
  const unsent = allSubs.filter(s =>
    s.status === 'approved' &&
    s.type === 'item' &&
    s.discord_sent === false &&
    ['arme', 'armure', 'accessoire'].includes(s.data?.category) &&
    s.data?.palier
  );
  const RARITY_ICON = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const CAT_ICON    = { arme:'⚔️', armure:'🛡️', accessoire:'💍' };
  let body = '';
  if (!unsent.length) {
    body = `<div style="padding:12px 14px;font-size:12px;color:var(--muted);font-style:italic;">Aucune approval en attente d'envoi.</div>`;
  } else {
    let rows = '';
    for (const sub of unsent) {
      const it = sub.data || {};
      rows += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;transition:background .1s;"
        onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
        <input type="checkbox" class="dw-unsent-check" data-subid="${_ee(sub._id)}" checked
          style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0;cursor:pointer;">
        <span style="flex:1;font-size:13px;font-weight:500;">${_ee(it.name||'—')}</span>
        <span style="font-size:11px;color:var(--muted);">
          ${CAT_ICON[it.category]||''} ${_ee(it.category||'')} · P${_ee(String(it.palier||'?'))} · ${RARITY_ICON[it.rarity]||''} ${_ee(it.rarity||'')}
        </span>
        <button onclick="dwUnsentDelete('${_ee(sub._id)}')" title="Retirer de la file d'envoi Discord"
          style="background:none;border:none;cursor:pointer;color:var(--danger,#f87171);font-size:14px;padding:2px 6px;border-radius:4px;flex-shrink:0;"
          onmouseenter="this.style.background='rgba(248,113,113,.15)'" onmouseleave="this.style.background='none'">🗑️</button>
      </div>`;
    }
    body = `<div style="padding:8px 10px;display:flex;flex-direction:column;gap:2px;">${rows}</div>`;
  }
  section.style.display = '';
  section.innerHTML = `
    <div style="border:1px solid var(--accent);border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:10px 14px;background:rgba(224,172,96,.1);border-bottom:1px solid var(--accent);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:13px;font-weight:700;color:var(--accent);">🆕 Nouvelles approvals${unsent.length ? ` — ${unsent.length} non envoyée${unsent.length>1?'s':''}` : ''}</span>
        ${unsent.length ? `<div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(true)"  style="font-size:11px;padding:4px 10px;">✅ Tout cocher</button>
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(false)" style="font-size:11px;padding:4px 10px;">☐ Tout décocher</button>
          <button id="dw-unsent-send-btn" class="btn" onclick="dwPublishUnsentSend()"
            style="background:var(--accent);color:var(--on-accent);font-size:12px;">📤 Envoyer la file</button>
        </div>` : ''}
      </div>
      ${body}
    </div>`;
}

window.dwUnsentCheckAll = function(state) {
  document.querySelectorAll('.dw-unsent-check').forEach(cb => { cb.checked = state; });
};

window.dwUnsentDelete = async function(subId) {
  if (!await modal.confirm('Retirer cet item de la file d\'envoi Discord ? (il restera approuvé mais ne sera plus proposé à l\'envoi)')) return;
  try {
    await updateDoc(doc(db, 'submissions', subId), { discord_sent: true });
    const sub = allSubs.find(s => s._id === subId);
    if (sub) sub.discord_sent = true;
    _renderUnsentSection();
    toast('✓ Item retiré de la file d\'envoi.', 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

window.dwPublishUnsentSend = async function() {
  const checks = [...document.querySelectorAll('.dw-unsent-check:checked')];
  if (!checks.length) { toast('⚠️ Aucun item sélectionné.', 'warning'); return; }
  const btn = document.getElementById('dw-unsent-send-btn');
  if (btn) btn.disabled = true;
  const ids  = checks.map(c => c.dataset.subid);
  const subs = allSubs.filter(s => ids.includes(s._id));

  let done = 0, failed = 0;
  const total = subs.length;

  for (const sub of subs) {
    try {
      await sendApprovalWebhook(sub);
      await updateDoc(doc(db, 'submissions', sub._id), { discord_sent: true });
      sub.discord_sent = true;
      done++;
    } catch(e) {
      toast(`⛔ Erreur « ${sub.data?.name || sub._id} » : ${e.message}`, 'error');
      failed++;
    }
    if (done + failed < total) await new Promise(r => setTimeout(r, 2500));
  }

  if (done) toast(`✓ ${done} envoi${done>1?'s':''} réussi${done>1?'s':''}`, 'success');
  if (btn) btn.disabled = false;
  _renderUnsentSection();
};

async function _renderPublishPanel() {
  _renderUnsentSection();
  const listEl = document.getElementById('dw-pub-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;">Chargement des items…</div>';
  try {
    const [items, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    _dwPublishItems = [...items, ...hiddenItems].filter(it => it.category && it.palier);
    _dwPublishItems.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    dwPublishFilter();
  } catch(e) {
    listEl.innerHTML = `<div style="color:var(--muted);font-size:13px;">Erreur : ${_ee(e.message)}</div>`;
  }
}

window.dwPublishFilter = function() {
  const cat    = document.getElementById('dw-pub-cat')?.value    || '';
  const palier = document.getElementById('dw-pub-palier')?.value || '';
  const q      = (document.getElementById('dw-pub-search')?.value || '').toLowerCase();
  const listEl = document.getElementById('dw-pub-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const RARITY_ICON = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const CAT_ICON    = { arme:'⚔️', armure:'🛡️', accessoire:'💍' };

  const filtered = _dwPublishItems.filter(it => {
    if (cat    && it.category !== cat) return false;
    if (palier && String(it.palier) !== palier) return false;
    if (q      && !(it.name||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--muted);font-style:italic;padding:12px 0;">Aucun item trouvé.</div>';
    return;
  }

  for (const it of filtered) {
    const id  = it._id || it.id;
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;cursor:pointer;transition:background .1s;';
    row.onmouseenter = () => { row.style.background = 'var(--surface2)'; };
    row.onmouseleave = () => { row.style.background = ''; };
    row.innerHTML = `
      <input type="checkbox" class="dw-pub-check" data-id="${_ee(id)}" style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0;">
      <span style="flex:1;font-size:13px;font-weight:500;">${_ee(it.name||'—')}</span>
      <span style="font-size:11px;color:var(--muted);">
        ${CAT_ICON[it.category]||''} ${it.category||''} · P${it.palier||'?'} · ${RARITY_ICON[it.rarity]||''} ${it.rarity||''}
        ${it.sensible ? '<span style="color:#f87171;margin-left:4px;">🔞</span>' : ''}
      </span>
    `;
    listEl.appendChild(row);
  }
};

window.dwPublishCheckAll = function(state) {
  document.querySelectorAll('.dw-pub-check').forEach(cb => { cb.checked = state; });
};

window.dwPublishSelected = async function() {
  const checks = [...document.querySelectorAll('.dw-pub-check:checked')];
  if (!checks.length) { toast('⚠️ Aucun item sélectionné.', 'warning'); return; }

  const btn = document.getElementById('dw-pub-send-btn');
  const prog = document.getElementById('dw-pub-progress');
  const progText = document.getElementById('dw-pub-progress-text');
  const progBar  = document.getElementById('dw-pub-progress-bar');
  btn.disabled = true;
  prog.style.display = '';

  const ids   = checks.map(c => c.dataset.id);
  const items = _dwPublishItems.filter(it => ids.includes(it._id || it.id));

  const total = items.length;
  let done = 0;

  for (const item of items) {
    progText.textContent = `Envoi ${done + 1} / ${total} — ${item.name || ''}…`;
    progBar.style.width  = `${Math.round(done / total * 100)}%`;
    try {
      await _sendSingleItemDiscord(item);
    } catch(e) {
      toast(`⛔ Erreur pour « ${item.name} » : ${e.message}`, 'error');
    }
    done++;
    if (done < total) await new Promise(r => setTimeout(r, 2500));
  }

  progBar.style.width  = '100%';
  progText.textContent = `✓ ${done} envoi${done>1?'s':''} réussi${done>1?'s':''} !`;
  setTimeout(() => { prog.style.display = 'none'; btn.disabled = false; }, 3000);
};

// ── Helpers Discord bot (via Cloudflare Worker — évite CORS) ─────────

async function _workerCall(action, payload) {
  const secret = await _getWorkerSecret();
  const r = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, action, ...payload }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); console.warn('[worker]', action, r.status, t.slice(0, 200)); return null; }
  return r.json();
}


async function _postBotForumThread(channelId, threadName, content, fileBlob, fileName, tagIds) {
  const secret = await _getWorkerSecret();
  const message = {};
  if (content) message.content = content;
  message.attachments = [{ id: 0, filename: fileName }];
  const thread = { name: threadName, message };
  if (tagIds?.length) thread.applied_tags = tagIds;

  const fd = new FormData();
  fd.append('secret', secret);
  fd.append('action', 'post_thread');
  fd.append('channelId', channelId);
  fd.append('thread', JSON.stringify(thread));
  if (fileBlob && fileName) fd.append('file', fileBlob, fileName);
  fd.append('fileName', fileName);

  try {
    let r = await fetch(`${WORKER_URL}?action=post_thread`, { method: 'POST', body: fd });
    if (r.status === 429) {
      const err = await r.json().catch(() => ({}));
      const wait = Math.ceil((err.retry_after || 5) * 1000) + 500;
      console.warn(`[botPost] rate limit — attente ${Math.ceil(wait/1000)}s`);
      await new Promise(res => setTimeout(res, wait));
      r = await fetch(`${WORKER_URL}?action=post_thread`, { method: 'POST', body: fd });
    }
    if (!r.ok) { const t = await r.text().catch(() => ''); console.warn('[botPost]', r.status, t.slice(0, 200)); return null; }
    const data = await r.json();
    return { threadId: data.id, messageId: data.message?.id || data.id, raw: data };
  } catch(e) { console.error('[botPost]', e); return null; }
}

async function _getChannelId(key) {
  const val = _dwConfig?.[key];
  if (!val) return null;
  // Migration : si valeur = URL webhook, dériver le channel ID automatiquement
  if (val.startsWith('http')) {
    const m = val.match(/\/webhooks\/(\d+)\/([^?/]+)/);
    if (!m) return null;
    const data = await _workerCall('get_webhook', { webhookId: m[1], webhookToken: m[2] });
    const channelId = data?.channel_id || null;
    if (channelId) _dwConfig[key] = channelId; // mise à jour en mémoire
    return channelId;
  }
  return val;
}

// Priorité pour l'ordre d'affichage des tags dans le channel
const TAG_TYPE_PRIORITY = { rarity: 0, slot: 1, set: 2, class: 3 };

async function _ensureTag(channelId, tagName, emoji = null, type = 'class') {
  if (!channelId || !tagName) return null;
  const name = tagName.slice(0, 20);
  if (!_dwConfig._tagCache)     _dwConfig._tagCache     = {};
  if (!_dwConfig._tagTypeCache) _dwConfig._tagTypeCache = {};
  const cacheKey = `${channelId}::${name}`;
  if (_dwConfig._tagCache[cacheKey]) {
    console.log(`[ensureTag] cache hit: "${name}" type=${type} id=${_dwConfig._tagCache[cacheKey]}`);
    return _dwConfig._tagCache[cacheKey];
  }

  const chan = await _workerCall('get_channel', { channelId });
  if (!chan) return null;
  const existing = (chan.available_tags || []).find(t => t.name === name);
  if (existing) {
    _dwConfig._tagCache[cacheKey]        = existing.id;
    _dwConfig._tagTypeCache[existing.id] = type;
    console.log(`[ensureTag] existing: "${name}" type=${type} id=${existing.id}`);
    return existing.id;
  }

  const newTag = { name, moderated: false };
  if (emoji) newTag.emoji_name = emoji;
  const updated = await _workerCall('patch_channel', {
    channelId,
    patch: { available_tags: [...(chan.available_tags || []), newTag] },
  });
  const created = (updated?.available_tags || []).find(t => t.name === name);
  if (created) {
    _dwConfig._tagCache[cacheKey]        = created.id;
    _dwConfig._tagTypeCache[created.id]  = type;
    console.log(`[ensureTag] created: "${name}" type=${type} id=${created.id}`);
    return created.id;
  }
  console.warn(`[ensureTag] FAILED to create tag "${name}"`);
  return null;
}

// Réordonne available_tags du channel selon rareté → set → classe
async function _reorderChannelTags(channelId) {
  if (!channelId) return;
  const chan = await _workerCall('get_channel', { channelId });
  if (!chan?.available_tags?.length) return;

  const typeCache = _dwConfig._tagTypeCache || {};
  const rarityNames = new Set(Object.values(window.VCL.RARITIES || {}).map(r => r.label));
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const classNames = new Set(CLASSES.map(c => c.label));
  const slotNames = new Set([...Object.values(SLOT_TAG_INFO).map(s => s.label), 'Deux mains']);

  const sorted = [...chan.available_tags].sort((a, b) => {
    const typeOf = t => rarityNames.has(t.name) ? 0 : slotNames.has(t.name) ? 1 : classNames.has(t.name) ? 3 : 2;
    const pa = typeCache[a.id] !== undefined ? TAG_TYPE_PRIORITY[typeCache[a.id]] : typeOf(a);
    const pb = typeCache[b.id] !== undefined ? TAG_TYPE_PRIORITY[typeCache[b.id]] : typeOf(b);
    if (pa !== pb) return pa - pb;
    // Sous-tri : raretés par ordre défini, classes par ordre CLASSES
    if (pa === 0) {
      const rar = Object.keys(window.VCL.RARITIES || {});
      const ia  = rar.findIndex(k => window.VCL.RARITIES[k].label === a.name);
      const ib  = rar.findIndex(k => window.VCL.RARITIES[k].label === b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    if (pa === 3) {
      const ia = CLASSES.findIndex(c => c.label === a.name);
      const ib = CLASSES.findIndex(c => c.label === b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.name.localeCompare(b.name);
  });

  const changed = sorted.some((t, i) => t.id !== chan.available_tags[i].id);
  console.log('[reorder] avant:', chan.available_tags.map(t => t.name), '→ après:', sorted.map(t => t.name), 'changed:', changed);
  if (!changed) return;

  const result = await _workerCall('patch_channel', { channelId, patch: { available_tags: sorted } });
  console.log('[reorder] patch result available_tags:', result?.available_tags?.map(t => t.name));
}

window.reorderAllChannelTags = async function reorderAllChannelTags() {
  const btn = document.getElementById('btn-reorder-tags');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Réorganisation…'; }

  const seen = new Set();
  let ok = 0, skipped = 0, failed = 0;

  for (const cat of DW_CATEGORIES) {
    for (const p of CREATOR_PALIERS) {
      const key = `${cat.id}_${p}`;
      const channelId = await _getChannelId(key).catch(() => null);
      if (!channelId || seen.has(channelId)) { skipped++; continue; }
      seen.add(channelId);
      try {
        await _reorderChannelTags(channelId);
        ok++;
      } catch(e) {
        console.warn('[reorderAll] failed for', key, e);
        failed++;
      }
    }
  }

  console.log(`[reorderAll] done — ${ok} channels réorganisés, ${skipped} vides, ${failed} erreurs`);
  if (btn) {
    btn.textContent = failed ? `✗ ${failed} erreur(s)` : `✓ ${ok} channel(s) réorganisé(s)`;
    setTimeout(() => { btn.disabled = false; btn.textContent = '🔃 Réorganiser les tags'; }, 3000);
  }
}

function _buildCardMaps(panList, pnjList) {
  const panoplieData = {}, panoplieMap = {};
  for (const pan of panList) {
    const id = pan._id || pan.id;
    panoplieMap[id] = pan.label || id;
    panoplieData[id] = pan;
  }
  const pnjMap = {};
  for (const pnj of pnjList) {
    pnjMap[pnj._id || pnj.id] = pnj;
    if (pnj.id && pnj.id !== pnj._id) pnjMap[pnj.id] = pnj;
  }
  return { panoplieData, panoplieMap, pnjMap };
}

const RARITY_EMOJI = {
  commun:     '🌿',
  rare:       '💎',
  epique:     '💜',
  legendaire: '⭐',
  mythique:   '🌸',
  godlike:    '🔥',
  event:      '🎉',
};

const SLOT_TAG_INFO = {
  amulette:   { label: 'Amulette',         ico: '📿' },
  anneau:     { label: 'Anneau',            ico: '💍' },
  bracelet:   { label: 'Bracelet',         ico: '⭕' },
  gants:      { label: 'Gants',            ico: '🧤' },
  casque:     { label: 'Casque',           ico: '🧢' },
  plastron:   { label: 'Plastron',         ico: '👔' },
  'jambières':{ label: 'Jambières',        ico: '👖' },
  bottes:     { label: 'Bottes',           ico: '👢' },
  arme_p:     { label: 'Arme Principale',  ico: '⚔️' },
  arme_s:     { label: 'Arme Secondaire',  ico: '🛡️' },
  artefact:   { label: 'Artefact',         ico: '🔮' },
};

async function _ensureSlotTag(channelId, category, twoHanded) {
  if (twoHanded) return _ensureTag(channelId, 'Deux mains', '⚔️', 'slot');
  const info = SLOT_TAG_INFO[category];
  if (!info) return null;
  return _ensureTag(channelId, info.label, info.ico.replace(/️/g, ''), 'slot');
}

async function _deleteExistingDiscordPost(docId) {
  try {
    const snap = await getDoc(doc(db, 'discord_posts', docId));
    if (!snap.exists()) return;
    const { threadId } = snap.data();
    if (threadId) await _workerCall('delete_thread', { threadId });
    await deleteDoc(doc(db, 'discord_posts', docId));
  } catch(e) { console.warn('[deletePost]', e); }
}

async function _sendSingleItemDiscord(item) {
  const cat    = item.category;
  const palier = item.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = `${cat}_${palier}`;
  const channelId0 = await _getChannelId(key);
  if (!channelId0) throw new Error(`Aucun channel configuré pour ${key}`);

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const cardBlob  = await generateCardBlob(item, maps, 3);
  const cardFname = `${item.id || item._id || 'item'}_card.png`;

  const itemId   = item._id || item.id;
  const wikiUrl  = itemId ? `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${itemId}` : null;
  const content  = wikiUrl ? `↗ [Lien vers le Wiki](<${wikiUrl}>)` : '';

  const channelId = channelId0;
  const postDocId = itemId ? `${key}_item_${itemId}` : null;

  // Supprimer le post existant avant de recréer
  if (postDocId) await _deleteExistingDiscordPost(postDocId);

  const tags = [];
  if (item.rarity) {
    const rarLabel = window.VCL.RARITIES?.[item.rarity]?.label || item.rarity;
    const rarEmoji = RARITY_EMOJI[item.rarity] || null;
    const tagId = await _ensureTag(channelId, rarLabel, rarEmoji, 'rarity');
    if (tagId) tags.push(tagId);
  }
  const slotTagId = await _ensureSlotTag(channelId, item.cat, item.twoHanded);
  if (slotTagId && !tags.includes(slotTagId)) tags.push(slotTagId);
  if (item.set) {
    const setLabel = panList.find(p => (p._id || p.id) === item.set)?.label || item.set.replace(/_/g, ' ');
    const tagId = await _ensureTag(channelId, setLabel, '✨', 'set');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const sortedClasses = [...(item.classes || [])].sort((a, b) => {
    const ai = CLASSES.findIndex(c => c.id === a);
    const bi = CLASSES.findIndex(c => c.id === b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  for (const cls of sortedClasses) {
    const clsData = CLASSES.find(c => c.id === cls);
    const label = clsData?.label || cls;
    const emoji = clsData?.ico?.replace(/️/g, '') || null;
    const tagId = await _ensureTag(channelId, label, emoji, 'class');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  await _reorderChannelTags(channelId);

  console.log('[send] applied_tags order:', tags);
  const res = await _postBotForumThread(channelId, item.name || 'Item', content, cardBlob, cardFname, tags);
  if (!res) throw new Error('Échec de l\'envoi bot Discord');

  if (postDocId) {
    try {
      await setDoc(doc(db, 'discord_posts', postDocId), {
        itemId: String(itemId), itemName: item.name || '', webhookKey: key, channelId,
        messageId: res.messageId, threadId: res.threadId,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

window.testNewSubmissionWebhook = async function() {
  const url = document.getElementById('dw-new-submission')?.value?.trim();
  if (!url) { toast('⚠️ Aucun webhook configuré.', 'warning'); return; }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '🧪 **Test webhook** · Nouvelles soumissions · VCL Wiki Modération' })
    });
    if (resp.ok || resp.status === 204) toast('✓ Message de test envoyé !', 'success');
    else { const t = await resp.text().catch(() => String(resp.status)); toast(`⛔ Erreur Discord ${resp.status} : ${t.slice(0,200)}`, 'error'); }
  } catch(e) { toast(`⛔ Erreur réseau : ${e.message}`, 'error'); }
};

window.testDiscordWebhook = async function testDiscordWebhook(key) {
  const url = document.getElementById(`dw-${key}`)?.value?.trim();
  if (!url) { toast('⚠️ Aucun webhook configuré pour cette combinaison.', 'warning'); return; }
  const parts = key.split('_');
  const catId = parts.slice(0, -1).join('_');
  const palier = parts[parts.length - 1];
  const catLabel = DW_CATEGORIES.find(c => c.id === catId)?.label || catId;
  const palierLabel = palier === 'event' ? 'Event' : `Palier ${palier}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_name: `🧪 Test · ${catLabel} · ${palierLabel}`, content: `🧪 **Test webhook** · ${catLabel} · ${palierLabel} · VCL Wiki Modération` })
    });
    if (resp.ok || resp.status === 204) {
      toast('✓ Message de test envoyé !', 'success');
    } else {
      const text = await resp.text().catch(() => String(resp.status));
      toast(`⛔ Erreur Discord ${resp.status} :\n${text.slice(0, 300)}`, "error");
    }
  } catch(e) {
    toast(`⛔ Erreur réseau : ${e.message}`, "error");
  }
};

// ── Permissions ────────────────────────────────────────
const PERM_ROLES_ALL   = ['visiteur', 'membre', 'contributeur', 'admin'];
const PERM_ROLE_LABELS = { visiteur: 'Visiteur', membre: 'Membre', contributeur: 'Contrib.', admin: 'Admin' };
const PERM_ROLE_COLORS = { visiteur: '#4ade80', membre: '#60a5fa', contributeur: '#f59e0b', admin: '#f87171' };

const PERM_SECTIONS = [
  { space: 'wiki', title: '🌐 Wiki', perms: [
    { id: 'view_compendium',   label: 'Compendium',        desc: 'Liste et détail des items',                                    defaultRole: 'visiteur' },
    { id: 'view_bestiaire',    label: 'Bestiaire',         desc: 'Mobs, PNJ et encyclopédie',                                    defaultRole: 'visiteur' },
    { id: 'view_atelier',      label: 'Atelier',           desc: 'Simulateur de builds',                                         defaultRole: 'visiteur' },
    { id: 'view_map',          label: 'Carte',             desc: 'Carte interactive du monde',                                   defaultRole: 'visiteur' },
    { id: 'view_quetes',       label: 'Quêtes',            desc: 'Encyclopédie des quêtes',                                      defaultRole: 'visiteur' },
    { id: 'view_items_secret', label: 'Items secrets',     desc: 'Données cachées des items — dans les rules Firestore',          defaultRole: 'contributeur', serverSide: true },
    { id: 'view_mobs_secret',  label: 'Mobs & PNJ secrets',desc: 'Données cachées des mobs/PNJ — dans les rules Firestore',      defaultRole: 'contributeur', serverSide: true },
  ]},
  { space: 'creator', title: '🛠️ Creator', perms: [
    { id: 'submit_item',    label: 'Soumettre un item',      desc: 'Armes, armures, accessoires…',  defaultRole: 'membre' },
    { id: 'submit_mob',     label: 'Soumettre un mob',       desc: 'Monstres et créatures',         defaultRole: 'membre' },
    { id: 'submit_pnj',     label: 'Soumettre un PNJ',       desc: 'Personnages non-joueurs',       defaultRole: 'membre' },
    { id: 'submit_region',  label: 'Soumettre une région',   desc: 'Zones et territoires',          defaultRole: 'membre' },
    { id: 'submit_quest',   label: 'Soumettre une quête',    desc: 'Quêtes du jeu',                 defaultRole: 'membre' },
    { id: 'submit_panoplie',label: 'Soumettre une panoplie', desc: 'Ensembles d\'équipement',       defaultRole: 'contributeur' },
  ]},
  { space: 'moderation', title: '🛡️ Modération', perms: [
    { id: '_mod_panel',      label: 'Accès au panel',          desc: 'Lire les soumissions — dans les rules Firestore',           defaultRole: 'contributeur', serverSide: true },
    { id: '_approve',        label: 'Approuver / Rejeter',     desc: 'Modifier les soumissions — dans les rules Firestore',        defaultRole: 'contributeur', serverSide: true },
    { id: '_edit_direct',    label: 'Écriture directe',        desc: 'Écrire items, mobs, régions… — sync avec les collection perms', defaultRole: 'contributeur', serverSide: true },
    { id: 'tool_map',        label: '🗺️ Gestion carte',        desc: 'Marqueurs sur la carte',            defaultRole: 'contributeur' },
    { id: 'tool_zones',      label: '📍 Zones de spawn',       desc: 'Liste et éditeur de polygones',     defaultRole: 'contributeur' },
    { id: 'tool_diagnostic', label: '🔍 Diagnostic',           desc: 'IDs fantômes, régions orphelines',  defaultRole: 'contributeur' },
    { id: 'tool_capture',    label: '📸 Capture Sprites',      desc: 'Capture d\'images de sprites',      defaultRole: 'contributeur' },
    { id: '_users',          label: 'Gestion membres',         desc: 'Modifier les rôles utilisateurs — dans les rules Firestore', defaultRole: 'admin',         serverSide: true },
    { id: 'tool_trash',      label: '🗑️ Corbeille',            desc: 'Restaurer les éléments supprimés',  defaultRole: 'admin' },
    { id: 'tool_leaderboard',label: '🏆 Classement',           desc: 'Leaderboard des contributions',     defaultRole: 'admin' },
    { id: 'tool_audit_log',  label: '📋 Journal d\'audit',     desc: 'Historique des actions',            defaultRole: 'admin' },
    { id: '_permissions',    label: '🔑 Permissions',          desc: 'Config Firestore — dans les rules Firestore',               defaultRole: 'admin',         serverSide: true },
    { id: '_admin',          label: '⚙️ Configuration admin',  desc: 'Migration, config jeu — dans les rules Firestore',          defaultRole: 'admin',         serverSide: true },
  ]},
];

let _permConfig    = null;
let _selectedRoleId = 'admin';

function _effectiveLevel(roleId) {
  if (PERM_ROLES_ALL.includes(roleId)) return roleLevel(roleId);
  const cr = _customRoles.find(r => r.id === roleId);
  return cr ? roleLevel(cr.baseTier || 'visiteur') : 0;
}

function _roleHasPerm(roleId, perm) {
  if (roleId === 'admin') return true;
  const minRole = _permConfig?.[perm.id] ?? (perm.defaultRole || 'visiteur');
  return _effectiveLevel(roleId) >= roleLevel(minRole);
}

window.showPermissions = async () => {
  _setHash('permissions');
  document.getElementById('permissions-panel').style.display = '';
  document.getElementById('btn-permissions').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadPermissions();
};

window.loadPermissions = async function() {
  const loading = document.getElementById('perm-loading');
  const layout  = document.getElementById('perm-layout');
  const tech    = document.getElementById('perm-tech-panel');
  loading.style.display = ''; loading.textContent = 'Chargement…';
  if (layout) layout.style.display = 'none';
  if (tech)   tech.style.display   = 'none';
  try {
    const [permSnap, ccSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'permissions')),
      getDoc(doc(db, 'config', 'creator')),
    ]);
    const permData  = permSnap.exists() ? permSnap.data() : {};
    _permConfig     = permData.minRole     || {};
    _colPermConfig  = permData.collections || {};
    _ccConfig       = ccSnap.exists() ? ccSnap.data() : {};
    await loadRoles();
    _renderPermsSidebar();
    _renderPermsForRole(_selectedRoleId);
    _renderCollectionPerms();
    loading.style.display = 'none';
    if (layout) layout.style.display = '';
  } catch(e) { loading.textContent = `Erreur : ${e.message}`; }
};

function _renderPermsSidebar() {
  const list = document.getElementById('perm-role-list');
  if (!list) return;
  list.innerHTML = '';
  const adminD = TIER_DEFAULTS.admin;
  const managed = MANAGED_TIERS.slice().reverse()
    .map(id => _customRoles.find(r => r.id === id)).filter(Boolean);
  const customs = _customRoles.filter(r => !MANAGED_TIERS.includes(r.id));
  const allDisplay = [{ id: 'admin', label: adminD.label, emoji: adminD.emoji, color: adminD.color }, ...managed, ...customs];
  for (const role of allDisplay) {
    const item = document.createElement('div');
    item.className = 'perm-role-item' + (role.id === _selectedRoleId ? ' active' : '');
    item.dataset.roleId = role.id;
    item.onclick = () => _selectRole(role.id);
    const avatar = document.createElement('div');
    avatar.className = 'perm-role-avatar';
    avatar.style.background = role.color || '#888';
    avatar.textContent = role.emoji || '?';
    const name = document.createElement('span');
    name.textContent = role.label;
    item.append(avatar, name);
    list.appendChild(item);
  }
}

function _selectRole(roleId) {
  _selectedRoleId = roleId;
  document.querySelectorAll('.perm-role-item').forEach(el => {
    el.classList.toggle('active', el.dataset.roleId === roleId);
  });
  _renderPermsForRole(roleId);
  // Close edit form when switching roles
  const editEl = document.getElementById('perm-role-edit');
  if (editEl) editEl.style.display = 'none';
}

function _renderPermsForRole(roleId) {
  const headerEl = document.getElementById('perm-role-header');
  const editEl   = document.getElementById('perm-role-edit');
  const spacesEl = document.getElementById('perm-spaces');
  if (!headerEl || !spacesEl) return;

  const isAdminRole   = roleId === 'admin';
  const isManagedTier = MANAGED_TIERS.includes(roleId);
  const isCustom      = !isAdminRole && !isManagedTier;

  let roleData;
  if (isAdminRole) {
    roleData = { id: 'admin', ...TIER_DEFAULTS.admin };
  } else {
    roleData = _customRoles.find(r => r.id === roleId) || { id: roleId, label: roleId, emoji: '?', color: '#888', baseTier: 'visiteur' };
  }

  // ── Header ──────────────────────────────────────
  headerEl.className = 'perm-role-header';
  headerEl.innerHTML = '';

  const bigAvatar = document.createElement('div');
  bigAvatar.id = 'perm-big-avatar';
  bigAvatar.style.cssText = `width:44px;height:44px;border-radius:50%;background:${roleData.color||'#888'};display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;`;
  bigAvatar.textContent = roleData.emoji || '?';

  const titleBlock = document.createElement('div');
  titleBlock.style.cssText = 'flex:1;';
  const titleEl = document.createElement('div');
  titleEl.className = 'perm-role-title';
  titleEl.textContent = roleData.label;
  titleBlock.appendChild(titleEl);

  if (isAdminRole) {
    const badge = document.createElement('span');
    badge.className = 'perm-role-tier-badge';
    badge.style.cssText = 'background:rgba(248,113,113,.15);color:#f87171;';
    badge.textContent = '🔒 Fixe';
    titleBlock.appendChild(badge);
  } else if (isManagedTier) {
    const td = TIER_DEFAULTS[roleId] || {};
    const badge = document.createElement('span');
    badge.className = 'perm-role-tier-badge';
    badge.style.cssText = `background:${(td.color||'#888')}22;color:${td.color||'#888'};`;
    badge.textContent = `tier ${roleId}`;
    titleBlock.appendChild(badge);
  } else {
    const tierKey = roleData.baseTier || 'visiteur';
    const td = TIER_DEFAULTS[tierKey] || {};
    const badge = document.createElement('span');
    badge.className = 'perm-role-tier-badge';
    badge.style.cssText = `background:${(td.color||'#888')}22;color:${td.color||'#888'};`;
    badge.textContent = `base: ${tierKey}`;
    titleBlock.appendChild(badge);
  }

  const actionsDiv = document.createElement('div');
  actionsDiv.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;';

  if (isCustom) {
    const tierSel = document.createElement('div');
    tierSel.style.cssText = 'display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;';
    for (const t of MANAGED_TIERS) {
      const td = TIER_DEFAULTS[t];
      const isActive = roleData.baseTier === t;
      const btn = document.createElement('button');
      btn.style.cssText = `padding:4px 10px;font-size:11px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;`
                        + `background:${isActive ? td.color : 'var(--surface3)'};color:${isActive ? '#000' : 'var(--muted)'};transition:background .12s,color .12s;`;
      btn.textContent = td.label;
      btn.title = `Tier de base : ${t}`;
      btn.onclick = () => _setCustomRoleBaseTier(roleId, t);
      tierSel.appendChild(btn);
    }
    actionsDiv.appendChild(tierSel);
  }

  if (!isAdminRole) {
    const editBtn = document.createElement('button');
    editBtn.id = 'perm-edit-toggle-btn';
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'font-size:11px;';
    editBtn.textContent = '✏️ Éditer';
    editBtn.onclick = () => {
      const isOpen = editEl && editEl.style.display !== 'none';
      if (editEl) editEl.style.display = isOpen ? 'none' : '';
      editBtn.textContent = isOpen ? '✏️ Éditer' : '✕ Fermer';
    };
    actionsDiv.appendChild(editBtn);
  }

  if (isCustom) {
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost';
    delBtn.style.cssText = 'font-size:11px;color:var(--danger);border-color:rgba(248,113,113,.4);';
    delBtn.textContent = '✕ Supprimer';
    delBtn.onclick = () => deleteRole(roleId);
    actionsDiv.appendChild(delBtn);
  }

  headerEl.append(bigAvatar, titleBlock, actionsDiv);

  // ── Inline edit form ─────────────────────────────
  if (editEl) {
    editEl.innerHTML = '';
    editEl.style.display = 'none';
    if (!isAdminRole) {
      editEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:20px;';
      const INS = 'background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:7px 10px;font-size:12px;font-family:inherit;';
      const row1 = document.createElement('div');
      row1.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
      const inputLabel = Object.assign(document.createElement('input'), { type:'text', value:roleData.label, maxLength:32, placeholder:'Nom' });
      inputLabel.style.cssText = INS + 'flex:1;';
      const inputEmoji = Object.assign(document.createElement('input'), { type:'text', value:roleData.emoji||'', maxLength:4, placeholder:'Emoji' });
      inputEmoji.style.cssText = INS + 'width:60px;text-align:center;';
      const inputColor = Object.assign(document.createElement('input'), { type:'color', value:roleData.color||'#888' });
      inputColor.style.cssText = 'border:1px solid var(--border);border-radius:4px;height:33px;width:50px;cursor:pointer;';
      const syncAvatar = () => {
        const av = document.getElementById('perm-big-avatar');
        if (av) { av.style.background = inputColor.value; av.textContent = inputEmoji.value || roleData.emoji; }
      };
      inputEmoji.oninput = syncAvatar; inputColor.oninput = syncAvatar;
      row1.append(inputLabel, inputEmoji, inputColor);
      const row2 = document.createElement('div');
      row2.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
      const cancelBtn = Object.assign(document.createElement('button'), { className:'btn btn-ghost', textContent:'Annuler' });
      cancelBtn.style.cssText = 'font-size:11px;';
      cancelBtn.onclick = () => {
        editEl.style.display = 'none';
        const tb = document.getElementById('perm-edit-toggle-btn');
        if (tb) tb.textContent = '✏️ Éditer';
      };
      const saveBtn = Object.assign(document.createElement('button'), { className:'btn btn-approve', textContent:'✓ Sauvegarder' });
      saveBtn.style.cssText = 'font-size:11px;';
      saveBtn.onclick = async () => {
        const newLabel = inputLabel.value.trim() || roleData.label;
        const newEmoji = inputEmoji.value.trim() || roleData.emoji;
        const newColor = inputColor.value;
        const cr = _customRoles.find(r => r.id === roleId);
        if (cr) { cr.label = newLabel; cr.emoji = newEmoji; cr.color = newColor; }
        await _saveRoles();
        _renderPermsSidebar();
        _renderPermsForRole(roleId);
        toast(`✅ Rôle "${newLabel}" mis à jour`, 'success');
      };
      row2.append(cancelBtn, saveBtn);
      editEl.append(row1, row2);
    }
  }

  // ── Permission spaces ─────────────────────────────
  spacesEl.innerHTML = '';
  for (const section of PERM_SECTIONS) {
    const secEl = document.createElement('div');
    secEl.className = 'perm-space-section';
    const titleDiv = document.createElement('div');
    titleDiv.className = 'perm-space-title';
    titleDiv.textContent = section.title;
    secEl.appendChild(titleDiv);
    for (const perm of section.perms) {
      secEl.appendChild(_buildPermToggleRow(perm, roleId, isAdminRole));
    }
    if (section.space === 'creator') {
      secEl.appendChild(_buildCreatorConfigSection());
    }
    spacesEl.appendChild(secEl);
  }
}

function _buildPermToggleRow(perm, roleId, isAdminRole) {
  const hasIt = isAdminRole || _roleHasPerm(roleId, perm);
  const row = document.createElement('div');
  row.className = 'perm-toggle-row' + (perm.serverSide ? ' server-side' : '');
  const info = document.createElement('div');
  info.className = 'perm-toggle-info';
  info.innerHTML = `<div class="perm-toggle-label">${perm.label}</div><div class="perm-toggle-desc">${perm.desc}</div>`;
  row.appendChild(info);
  if (perm.serverSide) {
    const badge = document.createElement('span');
    badge.className = 'perm-server-badge';
    badge.title = 'Nécessite un redéploiement des rules Firestore pour prendre effet';
    badge.textContent = '🛡️';
    row.appendChild(badge);
  }
  const toggle = document.createElement('button');
  toggle.className = `perm-toggle ${hasIt ? 'on' : 'off'}`;
  if (isAdminRole) {
    toggle.disabled = true;
  } else {
    toggle.onclick = () => {
      const currentLevel = _effectiveLevel(roleId);
      if (hasIt) {
        const newLevel = Math.min(currentLevel + 1, PERM_ROLES_ALL.length - 1);
        _setPermission(perm.id, PERM_ROLES_ALL[newLevel]);
      } else {
        _setPermission(perm.id, PERM_ROLES_ALL[currentLevel]);
      }
      if (perm.serverSide) _showRulesDeployBanner();
    };
  }
  row.appendChild(toggle);
  return row;
}

function _showRulesDeployBanner() {
  let banner = document.getElementById('perm-deploy-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'perm-deploy-banner';
    banner.style.cssText = 'position:sticky;top:0;z-index:10;background:#78350f;border-bottom:1px solid #f59e0b;color:#fbbf24;padding:8px 14px;font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px;';
    banner.innerHTML = `<span>⚠️ Permissions serveur modifiées — pensez à regénérer et déployer les rules Firestore.</span>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.style.cssText = 'font-size:11px;color:#fbbf24;border-color:rgba(251,191,36,.4);flex-shrink:0;';
    btn.textContent = '📋 Générer les rules';
    btn.onclick = () => { showGenerateRulesModal(); };
    banner.appendChild(btn);
    const detail = document.getElementById('perm-detail');
    if (detail) detail.prepend(banner);
  }
}

function _buildCreatorConfigSection() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:10px;';
  const toggleBtn = document.createElement('button');
  toggleBtn.className = 'btn btn-ghost';
  toggleBtn.style.cssText = 'font-size:11px;width:100%;text-align:left;';
  toggleBtn.textContent = '⚙️ Config Creator (outils & paliers) ▸';
  wrap.appendChild(toggleBtn);
  const body = document.createElement('div');
  body.style.cssText = 'display:none;margin-top:8px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;';
  toggleBtn.onclick = () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    toggleBtn.textContent = open ? '⚙️ Config Creator (outils & paliers) ▸' : '⚙️ Config Creator (outils & paliers) ▾';
  };
  // Outils actifs
  const toolsLabel = document.createElement('div');
  toolsLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;';
  toolsLabel.textContent = 'Outils actifs';
  body.appendChild(toolsLabel);
  const CC_TOOLS = [
    { id:'item',     label:'⚔️ Items' },
    { id:'mob',      label:'👾 Mobs' },
    { id:'pnj',      label:'🧑 PNJ' },
    { id:'region',   label:'📍 Régions' },
    { id:'quest',    label:'📜 Quêtes' },
    { id:'panoplie', label:'🔗 Panoplies' },
  ];
  const ccTools = (_ccConfig||{}).tools || {};
  const toolsGrid = document.createElement('div');
  toolsGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;';
  for (const t of CC_TOOLS) {
    const on = ccTools[t.id] !== false;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.style.cssText = on
      ? 'background:rgba(74,222,128,.15);color:#4ade80;border-color:rgba(74,222,128,.4);'
      : 'color:var(--danger);border-color:rgba(248,113,113,.4);';
    btn.textContent = `${t.label} ${on ? '✓' : '✕'}`;
    btn.onclick = () => toggleCreatorTool(t.id);
    toolsGrid.appendChild(btn);
  }
  body.appendChild(toolsGrid);
  // Paliers visibles
  const paliersLabel = document.createElement('div');
  paliersLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;';
  paliersLabel.textContent = 'Paliers visibles dans le Creator';
  body.appendChild(paliersLabel);
  const hidden = new Set((_ccConfig||{}).hiddenPaliers || []);
  const paliersGrid = document.createElement('div');
  paliersGrid.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;';
  for (const p of CREATOR_PALIERS) {
    const visible = !hidden.has(p);
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.style.cssText = visible
      ? 'background:rgba(74,222,128,.15);color:#4ade80;border-color:rgba(74,222,128,.4);'
      : 'color:var(--danger);border-color:rgba(248,113,113,.4);';
    btn.textContent = `P${p} ${visible ? '✓' : '✕'}`;
    btn.onclick = () => toggleCreatorPalier(p);
    paliersGrid.appendChild(btn);
  }
  body.appendChild(paliersGrid);
  wrap.appendChild(body);
  return wrap;
}

window._setPermission = async function(permId, role) {
  if (!_permConfig) return;
  _permConfig[permId] = role;
  _renderPermsForRole(_selectedRoleId);
  try {
    await setDoc(doc(db, 'config', 'permissions'), { minRole: _permConfig, collections: _colPermConfig || {} });
  } catch(e) {
    toast(`⛔ Erreur sauvegarde permissions : ${e.message}`, 'error');
  }
};

window._setCustomRoleBaseTier = async function(roleId, newTier) {
  const cr = _customRoles.find(r => r.id === roleId);
  if (!cr) return;
  cr.baseTier = newTier;
  await _saveRoles();
  _renderPermsSidebar();
  _renderPermsForRole(roleId);
  toast(`✅ Tier de "${cr.label}" changé en ${newTier}`, 'success');
};

// ── Rôles Discord → rôles du site ─────────────────────
// Config : config/discordRoles = { map: { <idRôleDiscord>: <idRôleSite> }, defaultRole }.
// Appliquée par le worker à chaque connexion Discord (cf. cloudflare-worker.js). Les droits Firebase
// d'un rôle du site découlent de son tier (visiteur < membre < contributeur < admin) via les rules.
const DISCORD_TIER_DOC = {
  visiteur:     'Lecture du wiki public (compendium, bestiaire, carte, quêtes). Aucune écriture.',
  membre:       'Visiteur + compte actif : soumettre des items/mobs/PNJ/régions/quêtes via le Creator (validés par la modération), favoris, builds, changer son pseudo.',
  contributeur: 'Membre + lire les données secrètes (items/mobs/PNJ sensibles), accéder à la modération (approuver/rejeter), écrire directement items, mobs, PNJ, régions, quêtes, zones, marqueurs, donjons.',
  admin:        'Tout : panoplies, gestion des membres et des rôles, permissions, configuration, journal d\'audit, secrets.',
};

let _discordRolesCfg = { map: {}, defaultRole: 'membre' };
let _discordGuildRoles = [];

function _discordRoleColor(c) { return c ? '#' + c.toString(16).padStart(6, '0') : '#99aab5'; }

function _siteRoleChoices() {
  const a = TIER_DEFAULTS.admin;
  return [{ id: 'admin', label: a.label, emoji: a.emoji, color: a.color }, ..._customRoles];
}

function _permListHtml(roleId) {
  const esc = window.VCL.escHtml;
  return PERM_SECTIONS.map(sec => `
    <div style="margin-top:10px;">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">${esc(sec.title)}</div>
      ${sec.perms.map(p => {
        const ok = _roleHasPerm(roleId, p);
        return `<div style="display:flex;gap:8px;align-items:flex-start;padding:3px 0;opacity:${ok ? 1 : .45};">
          <span style="width:16px;flex-shrink:0;color:${ok ? '#4ade80' : 'var(--danger)'};font-weight:700;">${ok ? '✓' : '✕'}</span>
          <span style="font-size:12px;"><b>${esc(p.label)}</b>${p.serverSide ? ' 🛡️' : ''} — <span style="color:var(--muted);">${esc(p.desc)}</span></span>
        </div>`;
      }).join('')}
    </div>`).join('');
}

window.showDiscordRoles = async function() {
  _setHash('discord-roles');
  document.getElementById('discord-roles-panel').style.display = '';
  document.getElementById('btn-discord-roles')?.classList.add('active');
  await loadDiscordRoles();
};

window.loadDiscordRoles = async function() {
  const body = document.getElementById('discord-roles-body');
  body.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [cfgSnap, permSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'discordRoles')),
      _permConfig ? null : getDoc(doc(db, 'config', 'permissions')),
      loadRoles(),
    ]);
    if (permSnap) _permConfig = permSnap.exists() ? (permSnap.data().minRole || {}) : {};
    const d = cfgSnap.exists() ? cfgSnap.data() : {};
    _discordRolesCfg = { map: { ...(d.map || {}) }, defaultRole: d.defaultRole || 'membre' };

    const r = await fetch(WORKER_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: await _getWorkerSecret(), action: 'get_guild_roles' }),
    });
    const roles = await r.json();
    if (!Array.isArray(roles)) throw new Error(roles?.error || roles?.message || 'Réponse Discord invalide (worker à jour ?)');
    _discordGuildRoles = roles.filter(x => !x.managed && x.name !== '@everyone').sort((a, b) => b.position - a.position);
    _renderDiscordRoles();
  } catch (e) {
    body.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${window.VCL.escHtml(e.message)}</div>`;
  }
};

function _renderDiscordRoles() {
  const esc = window.VCL.escHtml;
  const body = document.getElementById('discord-roles-body');
  const choices = _siteRoleChoices();
  const opts = (sel, withNone) => (withNone ? `<option value="">— aucun (rôle par défaut) —</option>` : '') +
    choices.map(c => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(c.emoji || '')} ${esc(c.label)}</option>`).join('');
  const selectCss = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;';

  body.innerHTML = `
    <div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:14px;font-size:12px;line-height:1.5;">
      <b>Comment ça marche</b> — À chaque connexion via Discord, le rôle du site est recalculé : on prend le rôle le plus élevé parmi
      ceux mappés ci-dessous que la personne possède sur le serveur. Les comptes <code>admin</code> et ceux marqués <code>roleLocked</code> ne sont jamais modifiés.
      Les droits Firebase d'un rôle découlent de son <b>tier</b> :
      <ul style="margin:6px 0 0 18px;padding:0;">
        ${Object.keys(DISCORD_TIER_DOC).map(t => `<li><b>${esc(TIER_DEFAULTS[t].emoji)} ${esc(TIER_DEFAULTS[t].label)}</b> — ${esc(DISCORD_TIER_DOC[t])}</li>`).join('')}
      </ul>
      <div style="margin-top:6px;color:var(--muted);">Pour des droits sur mesure, crée un rôle dans 🔑 Permissions (avec le tier voulu), puis associe-le ici.</div>
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <label style="font-size:12px;">Membre du serveur sans rôle mappé :</label>
      <select id="dr-default" style="${selectCss}">${opts(_discordRolesCfg.defaultRole, false)}</select>
    </div>

    <div id="dr-list">
      ${_discordGuildRoles.map(g => {
        const site = _discordRolesCfg.map[g.id] || '';
        return `<div class="dr-row" data-did="${esc(g.id)}" style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;padding:8px 12px;background:var(--surface);">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="width:12px;height:12px;border-radius:50%;background:${_discordRoleColor(g.color)};flex-shrink:0;"></span>
            <span style="flex:1;font-size:13px;font-weight:600;">${esc(g.name)}</span>
            <span style="font-size:11px;color:var(--muted);">→</span>
            <select class="dr-select" style="${selectCss}">${opts(site, true)}</select>
            <button class="btn btn-ghost dr-toggle" style="font-size:11px;" ${site ? '' : 'disabled'}>Permissions ▸</button>
          </div>
          <div class="dr-perms" style="display:none;margin-top:8px;border-top:1px solid var(--border);padding-top:6px;"></div>
        </div>`;
      }).join('') || '<div class="empty">Aucun rôle trouvé sur le serveur.</div>'}
    </div>
    <div style="display:flex;justify-content:flex-end;margin-top:10px;">
      <button class="btn btn-approve" onclick="saveDiscordRoles()">💾 Enregistrer</button>
    </div>`;

  body.querySelectorAll('.dr-row').forEach(row => {
    const sel = row.querySelector('.dr-select'), tog = row.querySelector('.dr-toggle'), perms = row.querySelector('.dr-perms');
    const refresh = () => { if (perms.style.display !== 'none') perms.innerHTML = _permListHtml(sel.value); };
    sel.onchange = () => { tog.disabled = !sel.value; if (!sel.value) perms.style.display = 'none'; refresh(); };
    tog.onclick = () => {
      const open = perms.style.display !== 'none';
      perms.style.display = open ? 'none' : '';
      tog.textContent = open ? 'Permissions ▸' : 'Permissions ▾';
      if (!open) perms.innerHTML = _permListHtml(sel.value);
    };
  });
}

window.saveDiscordRoles = async function() {
  const map = {};
  document.querySelectorAll('#dr-list .dr-row').forEach(row => {
    const v = row.querySelector('.dr-select').value;
    if (v) map[row.dataset.did] = v;
  });
  const defaultRole = document.getElementById('dr-default').value || 'membre';
  const grantsAdmin = Object.values(map).includes('admin');
  if (grantsAdmin && !confirm('⚠️ Un rôle Discord est associé à Admin : ses membres auront tous les droits à leur prochaine connexion. Continuer ?')) return;
  try {
    await setDoc(doc(db, 'config', 'discordRoles'), { map, defaultRole });
    _discordRolesCfg = { map, defaultRole };
    toast('✅ Rôles Discord enregistrés (appliqués à la prochaine connexion de chacun)', 'success');
  } catch (e) { toast(`⛔ Erreur sauvegarde : ${e.message}`, 'error'); }
};

window.togglePermTech = function() {
  const layout = document.getElementById('perm-layout');
  const tech   = document.getElementById('perm-tech-panel');
  if (!layout || !tech) return;
  const showingTech = tech.style.display !== 'none';
  tech.style.display   = showingTech ? 'none' : '';
  layout.style.display = showingTech ? '' : 'none';
};

// ── Permissions Firestore par collection ──────────────
const FIRESTORE_COLLECTIONS = [
  { id: 'items',         label: '⚔️ Items',             defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'items_hidden',  label: '🗂️ Items (données)',    defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'items_secret',  label: '🔒 Items (secrets)',    defaultRead: 'contributeur', defaultWrite: 'contributeur' },
  { id: 'mobs',          label: '👾 Mobs',               defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'mobs_secret',   label: '🔒 Mobs (secrets)',     defaultRead: 'contributeur', defaultWrite: 'contributeur' },
  { id: 'personnages',   label: '🧑 PNJ / Personnages',  defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'pnj_secret',    label: '🔒 PNJ (secrets)',      defaultRead: 'contributeur', defaultWrite: 'contributeur' },
  { id: 'regions',       label: '📍 Régions',            defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'quetes',        label: '📜 Quêtes',             defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'panoplies',     label: '🔗 Panoplies',          defaultRead: 'public',       defaultWrite: 'admin' },
  { id: 'map_markers',   label: '🗺️ Marqueurs carte',   defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'donjons',       label: '🏰 Donjons',            defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'zones',         label: '💀 Zones de spawn',     defaultRead: 'public',       defaultWrite: 'contributeur' },
  { id: 'trash',         label: '🗑️ Corbeille',          defaultRead: 'contributeur', defaultWrite: 'contributeur' },
  { id: 'discord_posts', label: '🔔 Posts Discord',      defaultRead: 'admin',        defaultWrite: 'admin' },
  { id: 'audit_log',     label: '📋 Audit log',          defaultRead: 'admin',        defaultWrite: 'contributeur', splitWrite: true },
  { id: 'config',        label: '⚙️ Config',             defaultRead: 'public',       defaultWrite: 'admin' },
];
const COL_READ_OPTS  = ['public', 'membre', 'contributeur', 'admin'];
const COL_WRITE_OPTS = ['membre', 'contributeur', 'admin'];
const COL_OPT_LABELS = { public: 'Public', membre: 'Membre', contributeur: 'Contrib.', admin: 'Admin' };
const COL_OPT_COLORS = { public: '#4ade80', membre: '#60a5fa', contributeur: '#f59e0b', admin: '#f87171' };

let _colPermConfig = null;

function _renderCollectionPerms() {
  const wrap = document.getElementById('collection-perm-content');
  if (!wrap) return;
  wrap.innerHTML = '';

  const titleEl = document.createElement('div');
  titleEl.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:8px;';
  titleEl.textContent = 'Permissions Firestore — Collections';
  wrap.appendChild(titleEl);

  const note = document.createElement('p');
  note.style.cssText = 'font-size:11px;color:var(--muted);margin-bottom:12px;';
  note.innerHTML = 'Lecture/écriture par collection. Après modification → <b>📋 Générer les rules Firestore</b> et appliquer dans la console Firebase. <code>users</code>, <code>submissions</code>, <code>config/pseudos</code> non modifiables (logique complexe).';
  wrap.appendChild(note);

  const grid = document.createElement('div');
  grid.style.cssText = 'display:flex;flex-direction:column;gap:6px;';

  for (const col of FIRESTORE_COLLECTIONS) {
    const cfg       = (_colPermConfig || {})[col.id] || {};
    const readRole  = cfg.read  || col.defaultRead;
    const writeRole = cfg.write || col.defaultWrite;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;flex-wrap:wrap;';

    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:140px;';
    info.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--text);">${col.label}</div>`
                   + `<div style="font-size:10px;color:var(--muted);margin-top:1px;font-family:monospace;">${col.id}</div>`;
    row.appendChild(info);

    const mkSeg = (opts, current, op) => {
      const outer = document.createElement('div');
      outer.style.cssText = 'display:flex;flex-direction:column;gap:3px;align-items:center;';
      const lbl = document.createElement('div');
      lbl.style.cssText = 'font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;';
      lbl.textContent = op === 'read' ? 'Lecture' : (col.splitWrite ? 'Créer*' : 'Écrire');
      const seg = document.createElement('div');
      seg.style.cssText = 'display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;';
      for (const opt of opts) {
        const btn = document.createElement('button');
        const active = opt === current;
        const c = COL_OPT_COLORS[opt];
        btn.style.cssText = `padding:4px 8px;font-size:10px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;`
                          + `background:${active ? c : 'var(--surface3)'};color:${active ? '#000' : 'var(--muted)'};transition:background .12s,color .12s;`;
        btn.textContent = COL_OPT_LABELS[opt];
        btn.onclick = () => _setCollectionPerm(col.id, op, opt);
        seg.appendChild(btn);
      }
      outer.appendChild(lbl);
      outer.appendChild(seg);
      return outer;
    };

    row.appendChild(mkSeg(COL_READ_OPTS,  readRole,  'read'));
    row.appendChild(mkSeg(COL_WRITE_OPTS, writeRole, 'write'));
    grid.appendChild(row);
  }

  const note2 = document.createElement('p');
  note2.style.cssText = 'font-size:10px;color:var(--muted);margin-top:8px;';
  note2.textContent = '* audit_log : Créer = rôle sélectionné, Supprimer = admin toujours, Mettre à jour = jamais.';
  wrap.appendChild(grid);
  wrap.appendChild(note2);
}

window._setCollectionPerm = async function(colId, op, role) {
  if (_colPermConfig === null) _colPermConfig = {};
  if (!_colPermConfig[colId]) _colPermConfig[colId] = {};
  _colPermConfig[colId][op] = role;
  _renderCollectionPerms();
  try {
    await setDoc(doc(db, 'config', 'permissions'), { minRole: _permConfig || {}, collections: _colPermConfig });
  } catch(e) {
    toast(`⛔ Erreur sauvegarde collection perms : ${e.message}`, 'error');
  }
};

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

let _customRoles  = []; // tous les rôles (managed tiers + custom), sauf admin
let _selectedTier = 'contributeur';

// Assure que les 3 tiers gérés sont dans _customRoles avec leurs defaults
function _ensureManagedTiers() {
  for (const id of MANAGED_TIERS) {
    if (!_customRoles.find(r => r.id === id)) {
      const d = TIER_DEFAULTS[id];
      _customRoles.unshift({ id, label: d.label, emoji: d.emoji, color: d.color, baseTier: id });
    }
  }
  // Tri : managed tiers en premier, custom ensuite
  _customRoles.sort((a, b) => {
    const ai = MANAGED_TIERS.indexOf(a.id), bi = MANAGED_TIERS.indexOf(b.id);
    if (ai !== -1 && bi !== -1) return ai - bi;
    if (ai !== -1) return -1;
    if (bi !== -1) return 1;
    return 0;
  });
}

function _getTierDisplay(id) {
  const cr = _customRoles.find(r => r.id === id);
  if (cr) return { label: cr.label, emoji: cr.emoji, color: cr.color };
  return TIER_DEFAULTS[id] || { label: id, emoji: '?', color: '#888' };
}

window.loadRoles = async function() {
  try {
    const snap = await getDoc(doc(db, 'config', 'customRoles'));
    _customRoles = snap.exists() ? (snap.data().roles || []) : [];
    _ensureManagedTiers();
  } catch(e) { console.error('loadRoles:', e.message); }
};

window.showCreateRoleForm = function showCreateRoleForm() {
  const form = document.getElementById('perm-create-form');
  if (!form) return;
  form.style.display = '';
  document.getElementById('role-new-label').value = '';
  document.getElementById('role-new-emoji').value = '';
  document.getElementById('role-new-color').value = '#f59e0b';
  _selectedTier = 'contributeur';

  // Render tier selector
  const tierEl = document.getElementById('role-new-tier');
  tierEl.innerHTML = '';
  for (const [t, d] of Object.entries(TIER_DEFAULTS)) {
    if (t === 'admin') continue;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.style.cssText = `border-color:${t === _selectedTier ? d.color : 'var(--border)'};color:${t === _selectedTier ? d.color : 'var(--muted)'};`;
    btn.textContent = d.label;
    btn.onclick = () => {
      _selectedTier = t;
      const keys = Object.keys(TIER_DEFAULTS).filter(k => k !== 'admin');
      document.querySelectorAll('#role-new-tier button').forEach((b, i) => {
        const tier = keys[i];
        const td = TIER_DEFAULTS[tier];
        b.style.borderColor = tier === t ? td.color : 'var(--border)';
        b.style.color = tier === t ? td.color : 'var(--muted)';
      });
    };
    tierEl.appendChild(btn);
  }
  document.getElementById('role-new-label').focus();
};

window.hideCreateRoleForm = function() {
  const form = document.getElementById('perm-create-form');
  if (form) form.style.display = 'none';
};

window.createRole = async function() {
  const label = document.getElementById('role-new-label').value.trim();
  const emoji = document.getElementById('role-new-emoji').value.trim() || '⭐';
  const color = document.getElementById('role-new-color').value;
  if (!label) { toast('⚠️ Nom du rôle requis', 'error'); return; }
  const id = label.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9_]/g,'_');
  if (_customRoles.find(r => r.id === id)) { toast('⚠️ Un rôle avec cet identifiant existe déjà', 'error'); return; }
  _customRoles.push({ id, label, emoji, color, baseTier: _selectedTier });
  await _saveRoles();
  hideCreateRoleForm();
  _selectedRoleId = id;
  _renderPermsSidebar();
  _renderPermsForRole(id);
  toast(`✅ Rôle "${label}" créé`, 'success');
};

window.deleteRole = async function(id) {
  if (!confirm(`Supprimer le rôle "${id}" ? Les utilisateurs avec ce rôle devront être réassignés.`)) return;
  _customRoles = _customRoles.filter(r => r.id !== id);
  await _saveRoles();
  _selectedRoleId = 'admin';
  _renderPermsSidebar();
  _renderPermsForRole('admin');
  toast('✅ Rôle supprimé', 'success');
};

async function _saveRoles() {
  try {
    await setDoc(doc(db, 'config', 'customRoles'), {
      roles: _customRoles,
    });
  } catch(e) {
    toast(`⛔ Erreur sauvegarde rôles : ${e.message}`, 'error');
  }
}

window.showGenerateRulesModal = function() {
  const modal = document.getElementById('rules-modal');
  if (!modal) return;
  const output = document.getElementById('rules-output');
  output.value = _generateRules();
  modal.style.display = 'flex';
};

window.closeRulesModal = function() {
  document.getElementById('rules-modal').style.display = 'none';
};

window.copyGeneratedRules = function() {
  const ta = document.getElementById('rules-output');
  ta.select();
  navigator.clipboard.writeText(ta.value).then(() => toast('📋 Rules copiées', 'success'));
};

function _roleToFirestoreRule(role) {
  if (role === 'public')       return 'true';
  if (role === 'membre')       return 'isMembre()';
  if (role === 'contributeur') return 'isContrib()';
  if (role === 'admin')        return 'isAdmin()';
  return 'false';
}

function _colRule(id, op) {
  const col = FIRESTORE_COLLECTIONS.find(c => c.id === id);
  const cfg = (_colPermConfig || {})[id] || {};
  if (op === 'read')  return _roleToFirestoreRule(cfg.read  || col?.defaultRead  || 'public');
  return _roleToFirestoreRule(cfg.write || col?.defaultWrite || 'contributeur');
}

function _permRule(permId, defaultRole) {
  return _roleToFirestoreRule(_permConfig?.[permId] ?? defaultRole);
}

function _generateRules() {
  // Regroupe les rôles custom par tier
  const contribExtra = _customRoles.filter(r => r.baseTier === 'contributeur' || r.baseTier === 'admin').map(r => `'${r.id}'`);
  const adminExtra   = _customRoles.filter(r => r.baseTier === 'admin').map(r => `'${r.id}'`);
  const membreExtra  = _customRoles.filter(r => ['membre','contributeur','admin'].includes(r.baseTier)).map(r => `'${r.id}'`);

  const contribList = [...new Set(["'contributeur'", "'admin'", ...contribExtra])].join(', ');
  const adminList   = ["'admin'", ...new Set(adminExtra)].join(', ');
  const membreList  = [...new Set(["'membre'", "'contributeur'", "'admin'", ...membreExtra])].join(', ');

  return `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    function isAuth() {
      return request.auth != null;
    }

    function userRole() {
      return exists(/databases/$(database)/documents/users/$(request.auth.uid))
        ? get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role
        : 'visiteur';
    }

    // Rôles personnalisés inclus selon leur tier de base.
    // ⚠ Regénérer ces rules (modération → Générer les rules) après tout ajout/changement de rôle.
    function isAdmin()   { return isAuth() && userRole() in [${adminList}]; }
    function isContrib() { return isAuth() && userRole() in [${contribList}]; }
    function isMembre()  { return isAuth() && userRole() in [${membreList}]; }

    function creatorToolEnabled(toolType) {
      return !exists(/databases/$(database)/documents/config/creator)
        || get(/databases/$(database)/documents/config/creator).data.get('tools', {}).get(toolType, true) != false;
    }

    // Un compteur ne peut bouger que de ±1 (aperçus / favoris des builds)
    function bumpedByOne(field) {
      return request.resource.data[field] == resource.data[field] + 1
          || request.resource.data[field] == resource.data[field] - 1;
    }

    match /items/{id} {
      allow read:  if ${_colRule('items','read')};
      allow write: if ${_colRule('items','write')};
    }

    // Traces de suppression pour la synchro différentielle (cf. firebase.js)
    match /tombstones/{id} {
      allow read:  if true;
      allow write: if isContrib();
    }

    // Lecture à l'unité publique (recherche par hash du nom) ; liste réservée aux contributeurs
    match /items_hidden/{id} {
      allow get:   if true;
      allow list:  if ${_permRule('view_items_secret', 'contributeur')};
      allow write: if ${_colRule('items_hidden','write')};
    }

    match /items_secret/{id} {
      allow read:  if ${_permRule('view_items_secret', 'contributeur')};
      allow write: if ${_colRule('items_secret','write')};
    }

    match /mobs/{id} {
      allow read:  if ${_colRule('mobs','read')};
      allow write: if ${_colRule('mobs','write')};
    }

    match /mobs_secret/{id} {
      allow read:  if ${_permRule('view_mobs_secret', 'contributeur')};
      allow write: if ${_colRule('mobs_secret','write')};
    }

    match /personnages/{id} {
      allow read:  if ${_colRule('personnages','read')};
      allow write: if ${_colRule('personnages','write')};
    }

    match /pnj_secret/{id} {
      allow read:  if ${_permRule('view_mobs_secret', 'contributeur')};
      allow write: if ${_colRule('pnj_secret','write')};
    }

    match /regions/{id} {
      allow read:  if ${_colRule('regions','read')};
      allow write: if ${_colRule('regions','write')};
    }

    match /quetes/{id} {
      allow read:  if ${_colRule('quetes','read')};
      allow write: if ${_colRule('quetes','write')};
    }

    match /panoplies/{id} {
      allow read:  if ${_colRule('panoplies','read')};
      allow write: if ${_colRule('panoplies','write')};
    }

    match /users/{uid} {
      allow get:    if isAuth() && (request.auth.uid == uid || ${_permRule('_users', 'admin')});
      // Liste complète réservée à l'admin ; un membre ne peut faire que des recherches limitées (unicité du pseudo)
      allow list:   if ${_permRule('_users', 'admin')}
                    || (isAuth() && request.query.limit != null && request.query.limit <= 2);
      allow create: if isAuth()
                    && request.auth.uid == uid
                    && request.resource.data.role == 'membre'
                    && request.resource.data.keys().hasOnly(['pseudo','role','email']);
      allow update: if ${_permRule('_users', 'admin')}
                    || (isAuth()
                        && request.auth.uid == uid
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['pseudo','email'])
                        && request.resource.data.pseudo is string);
      allow delete: if ${_permRule('_users', 'admin')};
    }

    match /map_markers/{id} {
      allow read:  if ${_colRule('map_markers','read')};
      allow write: if ${_colRule('map_markers','write')};
    }

    match /donjons/{id} {
      allow read:  if ${_colRule('donjons','read')};
      allow write: if ${_colRule('donjons','write')};
    }

    match /zones/{id} {
      allow read:  if ${_colRule('zones','read')};
      allow write: if ${_colRule('zones','write')};
    }

    // Config publique, sauf les webhooks Discord (système désactivé) : admin uniquement
    match /config/{id} {
      allow read:  if (id != 'discord_webhooks' && ${_colRule('config','read')}) || isAdmin();
      allow write: if ${_colRule('config','write')};
    }

    // La modération prévient les autres pages après chaque approbation
    match /config/wiki_version {
      allow write: if isContrib();
    }

    match /config/pseudos {
      allow read: if true;
      allow create: if isAuth()
                    && request.resource.data.keys().hasOnly([request.auth.uid]);
      allow update: if isAuth()
                    && request.resource.data.diff(resource.data).affectedKeys().hasOnly([request.auth.uid]);
      allow delete: if isAdmin();
    }

    match /trash/{id} {
      allow read:   if ${_colRule('trash','read')};
      allow create: if ${_colRule('trash','write')};
      allow delete: if ${_colRule('trash','write')};
    }

    match /discord_posts/{id} {
      allow read:  if ${_colRule('discord_posts','read')};
      allow write: if ${_colRule('discord_posts','write')};
    }

    match /secrets/{id} {
      allow read:  if isAdmin();
      allow write: if isAdmin();
    }

    match /audit_log/{id} {
      allow read:   if ${_colRule('audit_log','read')};
      allow create: if ${_colRule('audit_log','write')};
      allow update: if false;
      allow delete: if isAdmin();
    }

    // ── Statistiques de fréquentation : écriture ouverte mais bornée, jamais de suppression ──
    match /page_views/{docId} {
      // get public : le tracker lit le compteur du jour pour appliquer le plafond quotidien
      allow get:    if true;
      allow list:   if isAdmin();
      allow create: if request.resource.data.size() <= 100
                    && request.resource.data.get('count', 0) <= 1
                    && request.resource.data.get('uniques', 0) <= 1;
      allow update: if request.resource.data.size() <= 100
                    && request.resource.data.get('count', 0) <= resource.data.get('count', 0) + 1
                    && request.resource.data.get('uniques', 0) <= resource.data.get('uniques', 0) + 1;
      allow delete: if isAdmin();
    }

    match /user_visits/{docId} {
      allow read:   if isAdmin();
      allow create, update: if request.resource.data.size() <= 100;
      allow delete: if isAdmin();
    }

    match /item_views/{docId} {
      allow read:   if isAdmin();
      allow create, update: if request.resource.data.size() <= 100;
      allow delete: if isAdmin();
    }

    match /search_logs/{docId} {
      allow read:   if isAdmin();
      allow create, update: if request.resource.data.size() <= 100;
      allow delete: if isAdmin();
    }

    // Signalements des visiteurs
    match /reports/{id} {
      allow create: if request.resource.data.keys().size() <= 20;
      allow read, update, delete: if isContrib();
    }

    // ── Builds communautaires ───────────────────────────────────────
    match /builds_published/{buildId} {
      allow get:  if resource.data.visibility == 'public'
                  || (isAuth() && resource.data.authorUid == request.auth.uid)
                  || isAdmin();
      // Les builds « lien uniquement » ne sont pas listables : la requête doit filtrer sur visibility == 'public' (ou sur son propre authorUid)
      allow list: if resource.data.visibility == 'public'
                  || (isAuth() && resource.data.authorUid == request.auth.uid)
                  || isAdmin();
      allow create: if isMembre()
                    && request.auth.uid == request.resource.data.authorUid
                    && request.resource.data.name is string
                    && request.resource.data.name.size() >= 1
                    && request.resource.data.name.size() <= 60
                    && request.resource.data.visibility in ['public', 'unlisted']
                    && request.resource.data.previewCount == 0
                    && request.resource.data.favoriteCount == 0;
      allow update: if (isAuth()
                        && resource.data.authorUid == request.auth.uid
                        && request.resource.data.diff(resource.data).affectedKeys()
                             .hasOnly(['name','visibility','updatedAt','slots','runes',
                                       'skillNodes','statsSnapshot','classe','level',
                                       'slotImages','sensibleSlots','runeNames']))
                    || isAdmin()
                    || (isAuth()
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['previewCount'])
                        && bumpedByOne('previewCount'))
                    || (isAuth()
                        && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['favoriteCount'])
                        && bumpedByOne('favoriteCount'));
      allow delete: if isAdmin()
                    || (isAuth() && resource.data.authorUid == request.auth.uid);

      match /favoritedBy/{uid} {
        allow read:   if true;
        allow create: if isMembre() && request.auth.uid == uid;
        allow delete: if isMembre() && request.auth.uid == uid;
        allow update: if false;
      }
    }

    match /user_favorites/{docId} {
      allow get:    if isAuth() && resource.data.uid == request.auth.uid;
      // Un utilisateur ne liste que ses propres favoris (la requête doit filtrer sur uid)
      allow list:   if isAuth() && resource.data.uid == request.auth.uid;
      allow create: if isMembre()
                    && request.auth.uid == request.resource.data.uid;
      allow delete: if isMembre() && resource.data.uid == request.auth.uid;
      allow update: if false;
    }

    match /builds_sensible/{buildId} {
      allow read:   if isContrib();
      allow create: if isMembre() && request.auth.uid == request.resource.data.authorUid;
      allow delete: if isAdmin() || (isAuth() && resource.data.authorUid == request.auth.uid);
      allow update: if false;
    }

    match /events/{id} {
      allow read:   if true;
      allow write:  if isAdmin();
    }

    match /known_bugs/{id} {
      allow read:  if true;
      allow write: if isContrib();
    }

    match /submissions/{id} {
      // Ouvert aux visiteurs, mais borné : champs et longueurs limités
      allow create: if request.resource.data.submitterName is string
                    && request.resource.data.submitterName.size() >= 2
                    && request.resource.data.submitterName.size() <= 80
                    && request.resource.data.type in ['item','mob','pnj','region','quest','panoplie']
                    && request.resource.data.status == 'pending'
                    && request.resource.data.keys().size() <= 30
                    && (${_permRule('_mod_panel', 'contributeur')} || creatorToolEnabled(request.resource.data.type));
      allow read:   if ${_permRule('_approve', 'admin')}
                    || (${_permRule('_mod_panel', 'contributeur')} && resource.data.status == 'pending')
                    || (isAuth() && resource.data.submittedBy == request.auth.uid);
      // Approuver / rejeter / supprimer : rôle « _approve » (admin par défaut) ; modifier une soumission en attente : contributeurs et auteur
      allow update: if ${_permRule('_approve', 'admin')}
                    || (${_permRule('_mod_panel', 'contributeur')} && resource.data.status == 'pending' && request.resource.data.status == 'pending')
                    || (isAuth() && resource.data.submittedBy == request.auth.uid
                        && resource.data.status == 'pending' && request.resource.data.status == 'pending');
      allow delete: if ${_permRule('_approve', 'admin')};
    }

  }
}`;
}

async function _extractSubBlob(sub) {
  if (sub.forum_image) {
    try {
      const dataUrl = sub.forum_image;
      const mime    = dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png';
      const extMap  = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' };
      const fname   = `image.${extMap[mime] || 'png'}`;
      const b64  = dataUrl.split(',')[1];
      const bin  = atob(b64);
      const arr  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return { blob: new Blob([arr], { type: mime }), fname };
    } catch {}
  }
  return _fetchItemImgBlob(sub.data);
}

async function sendApprovalWebhook(sub) {
  console.log('[saw] called, type:', sub.type, 'cat:', sub.data?.category, 'palier:', sub.data?.palier);
  if (sub.type !== 'item') return;
  const cat = sub.data?.category;
  if (!['arme', 'armure', 'accessoire'].includes(cat)) return;
  const palier = sub.data?.palier;
  if (!palier) return;
  const key = `${cat}_${palier}`;

  if (!_dwConfig) {
    try {
      const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
      _dwConfig = snap.exists() ? snap.data() : {};
    } catch { return; }
  }

  const channelId = await _getChannelId(key);
  if (!channelId) return;

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const cardBlob  = await generateCardBlob(sub.data, maps, 3);
  const cardFname = `${sub.data.id || sub.data._id || 'item'}_card.png`;

  const subItemId = sub.data.id || sub.data._id;
  const wikiUrl   = subItemId ? `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${subItemId}` : null;
  const content   = wikiUrl ? `↗ [Lien vers le Wiki](<${wikiUrl}>)` : '';

  const postDocId = `${key}_${sub._id}`;
  await _deleteExistingDiscordPost(postDocId);

  const tags = [];
  if (sub.data.rarity) {
    const rarLabel = window.VCL.RARITIES?.[sub.data.rarity]?.label || sub.data.rarity;
    const rarEmoji = RARITY_EMOJI[sub.data.rarity] || null;
    const tagId = await _ensureTag(channelId, rarLabel, rarEmoji, 'rarity');
    if (tagId) tags.push(tagId);
  }
  const slotTagId = await _ensureSlotTag(channelId, sub.data.cat, sub.data.twoHanded);
  if (slotTagId && !tags.includes(slotTagId)) tags.push(slotTagId);
  if (sub.data.set) {
    const setLabel = panList.find(p => (p._id || p.id) === sub.data.set)?.label || sub.data.set.replace(/_/g, ' ');
    const tagId = await _ensureTag(channelId, setLabel, '✨', 'set');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const sortedClasses = [...(sub.data.classes || [])].sort((a, b) => {
    const ai = CLASSES.findIndex(c => c.id === a);
    const bi = CLASSES.findIndex(c => c.id === b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  for (const cls of sortedClasses) {
    const clsData = CLASSES.find(c => c.id === cls);
    const label = clsData?.label || cls;
    const emoji = clsData?.ico?.replace(/️/g, '') || null;
    const tagId = await _ensureTag(channelId, label, emoji, 'class');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  await _reorderChannelTags(channelId);

  const res = await _postBotForumThread(channelId, sub.data.name || 'Item', content, cardBlob, cardFname, tags);
  if (!res) { console.error('[saw] bot post failed'); return; }

  try {
    await setDoc(doc(db, 'discord_posts', postDocId), {
      subId: sub._id, subName: sub.data.name || '', webhookKey: key, channelId,
      messageId: res.messageId, threadId: res.threadId,
      sentAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('[saw] discord_posts save failed:', e); }
}

// ── Envoi groupé d'un set (plusieurs embeds dans un seul post) ──
async function _sendSetGroupDiscord(subs) {
  console.log('[sgd] called, subs:', subs.length);
  if (!subs.length) return;
  if (!_dwConfig) {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};
  }

  // Webhook du premier item du set
  const first  = subs[0];
  const cat    = first.data?.category;
  const palier = first.data?.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = first.data.rarity === 'event' ? `${cat}_event` : `${cat}_${palier}`;
  const url = _dwConfig[key];
  if (!url) throw new Error(`Aucun webhook configuré pour ${key}`);

  // Nom du thread = label du set
  const setId = first.data.set;
  let threadName = setId;
  if (_dwConfig._setCache?.[setId]) {
    threadName = _dwConfig._setCache[setId];
  } else {
    try {
      const snap = await getDoc(doc(db, 'panoplies', setId));
      if (snap.exists()) {
        threadName = snap.data().label || setId;
        if (!_dwConfig._setCache) _dwConfig._setCache = {};
        _dwConfig._setCache[setId] = threadName;
      }
    } catch {}
  }

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const files = []; // { blob, fname }

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const cardBlob  = await generateCardBlob(sub.data, maps, 3);
    const cardFname = `${sub.data.id || sub.data._id || `item_${i}`}_card.png`;
    files.push({ blob: cardBlob, fname: cardFname });
  }

  // Embed minimal : liens wiki pour chaque item du set
  const wikiLinks = subs.map(sub => {
    const id = sub.data.id || sub.data._id;
    return id ? `[🌐 ${sub.data.name || id}](<https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${id}>)` : null;
  }).filter(Boolean).join('\n');
  const setEmbed = wikiLinks ? { description: wikiLinks } : null;

  // Vérifier si un thread Discord existe déjà pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  // Discord : max 10 fichiers par message
  let fetchUrl, payload;
  if (existingThreadId) {
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = {};
  } else {
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first.data, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }
  if (setEmbed) payload.embeds = [setEmbed];

  let discordRes = null;
  if (files.length) {
    const filesSlice = files.slice(0, 10);
    const p  = { ...payload, attachments: filesSlice.map((f, i) => ({ id: i, filename: f.fname })) };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    filesSlice.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
    const r = await fetch(fetchUrl, { method: 'POST', body: fd });
    if (r.ok) discordRes = await r.json();
  } else {
    const r = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) discordRes = await r.json();
  }

  // Sauvegarder dans discord_posts seulement si nouveau thread créé
  if (!existingThreadId && discordRes?.id) {
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_${setId}`), {
        setId, setName: threadName, webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

// Variante de _sendSetGroupDiscord pour items déjà publiés (pas des submissions)
async function _sendSetGroupItemsDiscord(items) {
  if (!items.length) return;
  if (!_dwConfig) {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};
  }

  const first  = items[0];
  const cat    = first.category;
  const palier = first.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = first.rarity === 'event' ? `${cat}_event` : `${cat}_${palier}`;
  const url = _dwConfig[key];
  if (!url) throw new Error(`Aucun webhook configuré pour ${key}`);

  const setId = first.set;
  let threadName = setId;
  if (_dwConfig._setCache?.[setId]) {
    threadName = _dwConfig._setCache[setId];
  } else {
    try {
      const snap = await getDoc(doc(db, 'panoplies', setId));
      if (snap.exists()) {
        threadName = snap.data().label || setId;
        if (!_dwConfig._setCache) _dwConfig._setCache = {};
        _dwConfig._setCache[setId] = threadName;
      }
    } catch {}
  }

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const files = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cardBlob  = await generateCardBlob(item, maps, 3);
    const cardFname = `${item.id || item._id || `item_${i}`}_card.png`;
    files.push({ blob: cardBlob, fname: cardFname });
  }

  // Embed minimal : liens wiki pour chaque item du set
  const wikiLinks = items.map(item => {
    const id = item.id || item._id;
    return id ? `[🌐 ${item.name || id}](<https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${id}>)` : null;
  }).filter(Boolean).join('\n');
  const setEmbed = wikiLinks ? { description: wikiLinks } : null;

  // Vérifier si thread existant pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  let fetchUrl, payload;
  if (existingThreadId) {
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = {};
  } else {
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }
  if (setEmbed) payload.embeds = [setEmbed];

  const _doFetch = async (fUrl, fPayload) => {
    if (files.length) {
      const filesSlice = files.slice(0, 10);
      const p  = { ...fPayload, attachments: filesSlice.map((f, i) => ({ id: i, filename: f.fname })) };
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify(p));
      filesSlice.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
      return fetch(fUrl, { method: 'POST', body: fd });
    }
    return fetch(fUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fPayload) });
  };

  let discordRes = null;
  let usedExistingThread = !!existingThreadId;
  let r = await _doFetch(fetchUrl, payload);

  if (!r.ok && existingThreadId) {
    // Thread probablement archivé — recréer un nouveau thread
    console.warn(`[dwPublish] thread ${existingThreadId} inaccessible (${r.status}), tentative de recréation…`);
    const fallbackUrl     = `${url}?wait=true`;
    const fallbackPayload = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) fallbackPayload.applied_tags = appliedTags;
    if (setEmbed) fallbackPayload.embeds = [setEmbed];
    r = await _doFetch(fallbackUrl, fallbackPayload);
    usedExistingThread = false;
  }

  if (r.ok) {
    discordRes = await r.json();
  } else {
    const body = await r.text().catch(() => '');
    throw new Error(`Discord ${r.status} : ${body.slice(0, 200)}`);
  }

  if (!usedExistingThread && discordRes?.id) {
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_${setId}`), {
        setId, setName: threadName, webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

// ── Item names cache (for craft display) ──────────────
let _itemNamesCache = null;
async function _getItemNamesCache() {
  if (_itemNamesCache) return _itemNamesCache;
  try {
    const [items, hidden] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    _itemNamesCache = new Map();
    for (const it of [...items, ...hidden]) {
      const id = it._id || it.id;
      if (id && it.name) _itemNamesCache.set(id, it.name);
    }
  } catch { _itemNamesCache = new Map(); }
  return _itemNamesCache;
}

function _resolveTagRules(item, rules = []) {
  const tags = [];
  for (const r of rules) {
    if (!r.tagId) continue;
    const val = item[r.field];
    let match = false;
    if (r.op === 'eq')          match = String(val) == String(r.value) || val == r.value;
    if (r.op === 'contains')    match = Array.isArray(val) && val.includes(r.value);
    if (r.op === 'not_contains')match = Array.isArray(val) && !val.includes(r.value);
    if (r.op === 'gte')         match = Number(val) >= Number(r.value);
    if (r.op === 'lte')         match = Number(val) <= Number(r.value);
    if (match) tags.push(r.tagId);
  }
  return tags;
}

// ── Item image fetch (attach as file, not URL reference) ─
function _itemImgSrc(obj) {
  const base = new URL('.', window.location.href).href;
  const imgVal = (Array.isArray(obj.images) && obj.images[0]) || obj.img;
  if (imgVal) {
    const rel = imgVal.replace(/^(\.\.\/)+/, '');
    return base + rel;
  }
  if (!obj.id) return null;
  const { id, category, palier, event: isEvent } = obj;
  const tier = (isEvent || (palier === 0 || palier === 'event')) ? 'events' : (palier ? 'P' + palier : '');
  const tp   = tier ? tier + '/' : '';
  switch (category) {
    case 'arme':        return `${base}img/compendium/textures/weapons/${tp}${id}.png`;
    case 'armure':      return `${base}img/compendium/textures/armors/${tp}${id}.png`;
    case 'accessoire':  return `${base}img/compendium/textures/trinkets/${tp}${id}.png`;
    case 'outils':      return `${base}img/compendium/textures/gears/${tp}${id}.png`;
    case 'materiaux':   return `${base}img/compendium/textures/items/Material/${tp}${id}.png`;
    case 'ressources':  return `${base}img/compendium/textures/items/Ressources/${tp}${id}.png`;
    case 'consommable': return `${base}img/compendium/textures/items/Consommable/${tp}${id}.png`;
    case 'nourriture':  return `${base}img/compendium/textures/items/Nourriture/${tp}${id}.png`;
    case 'rune':        return `${base}img/compendium/textures/items/Runes/${tp}${id}.png`;
    case 'parchemin':   return `${base}img/compendium/textures/items/Parchemins/${tp}${id}.png`;
    case 'quete':       return `${base}img/compendium/textures/items/Quest/${tp}${id}.png`;
    case 'donjon':      return `${base}img/compendium/textures/items/Donjon/${tp}${id}.png`;
    case 'monnaie':     return `${base}img/compendium/textures/items/Monnaie/${tp}${id}.png`;
    default:            return null;
  }
}

async function _fetchItemImgBlob(obj) {
  const src = _itemImgSrc(obj);
  if (!src) return { blob: null, fname: null };
  try {
    const resp = await fetch(src);
    if (!resp.ok) return { blob: null, fname: null };
    const blob = await resp.blob();
    const ext  = src.split('.').pop().split('?')[0].toLowerCase() || 'png';
    return { blob, fname: `item.${ext}` };
  } catch {
    return { blob: null, fname: null };
  }
}

// ── Stat helpers ──────────────────────────────────────
const DW_STAT_LABELS = {
  // Offensif
  degats:              '🗡️ Dégâts',
  degats_physique:     '💥 Dég. Physique',
  degats_arme:         '⚔️ Dég. d\'Arme',
  degats_magique:      '📖 Dég. Magiques',
  degats_competence:   '✨ Dég. Compétence',
  degats_projectile:   '🏹 Dég. Projectile',
  vitesse_attaque:     '💨 Vitesse Attaque',
  crit_chance:         '🎯 Chance Critique',
  crit_degats:         '💢 Dégâts Critique',
  crit_comp_chance:    '🎯 Crit. Compétence',
  crit_comp_degats:    '💢 Crit Dégâts Compétence',
  // Défensif
  defense:             '🛡️ Défense',
  durabilite_garde:    '🛡️ Durabilité de la Garde',
  blocage:             '🧱 Blocage',
  puissance_bloc:      '💪 Puis. de Blocage',
  sante:               '❤️ Santé',
  esquive:             '💨 Esquive',
  reduction_degats:    '🔰 Réd. de Dégâts',
  reduction_chutes:    '🦘 Réd. de Chutes',
  tenacite:            '🏋️ Ténacité',
  res_recul:           '🔒 Rés. au Recul',
  // Mobilité & Ressources
  hate:                '🌀 Hâte',
  vitesse_deplacement: '💨 Vit. Déplacement',
  mana:                '💧 Mana',
  stamina:             '👟 Stamina',
  // Soutien
  vol_vie:             '🩸 Vol de Vie',
  omnivamp:            '👄 Vampirisme de sort',
  soin_bonus:          '✳️ Soin Bonus',
  regen_sante:         '💓 Rég. Santé',
  regen_mana:          '💦 Rég. Mana',
  regen_stamina:       '👟 Rég. Stamina',
};

function _fmtStatVal(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v[0] === v[1] ? String(v[0]) : `${v[0]}–${v[1]}`;
  if (typeof v === 'object') {
    const { min, max } = v;
    if (min !== undefined && max !== undefined) return min === max ? String(min) : `${min}–${max}`;
    return JSON.stringify(v);
  }
  return String(v);
}

const _SP = '\u200B'; // Discord spacer

function _enrichObtainWithPnjCoords(obtain, pnjs) {
  if (!obtain || !pnjs?.length) return obtain;
  const pnjById   = new Map();
  const pnjByName = new Map();
  for (const pnj of pnjs) {
    if (!pnj.coords || pnj.coords.x == null) continue;
    if (pnj.id) pnjById.set(pnj.id, pnj.coords);
    const n = (pnj.name || pnj.nom || '').trim().toLowerCase();
    if (n) pnjByName.set(n, pnj.coords);
  }
  const fmtCoords = c => `\n\`x:${c.x}\` \`y:${c.y}\` \`z:${c.z}\``;
  // New bracket format: [npc:id|Name]
  let result = obtain.replace(/\[npc:([^\]|]+)\|([^\]]+)\]/g, (match, pnjId, name) => {
    const c = pnjById.get(pnjId) || pnjByName.get(name.trim().toLowerCase());
    return c ? `[npc:${pnjId}|${name} ${fmtCoords(c)}]` : match;
  });
  // Old format: npc:text (no bracket, no ID) — negative lookbehind avoids re-matching inside [npc:...|...]
  const namesSorted = [...pnjByName.keys()].sort((a, b) => b.length - a.length);
  result = result.replace(/(?<!\[)npc:([^\n\[]+)/g, (match, text) => {
    const textLow = text.trim().toLowerCase();
    const found   = namesSorted.find(n => textLow.includes(n));
    if (!found) return match;
    const c = pnjByName.get(found);
    return `npc:${text.trim()} ${fmtCoords(c)}`;
  });
  return result;
}

function _enrichObtainWithMobChances(obtain, itemId, mobs) {
  if (!obtain || !itemId || !mobs?.length) return obtain;
  const chanceMap = new Map();
  for (const mob of mobs) {
    const loot = (mob.loot || []).find(l => l.id === itemId);
    if (loot) {
      const c = loot.chance === '?' ? '?' : parseFloat(loot.chance);
      if (c === '?' || !isNaN(c)) chanceMap.set(mob.id, c);
    }
  }
  return obtain.replace(/\[([^\]|:]+)\|([^\]]+)\](\[\?\]|(?!\[))/g, (match, mobId, name) => {
    const chance = chanceMap.get(mobId);
    return chance != null ? `[${mobId}|${name}][${chance}]` : match;
  });
}

function _buildApprovalEmbed(obj, imageFilename, activeFields = null, itemNames = null, contributorName = null) {
  const RARITY_LABEL  = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Évènement' };
  const RARITY_ICON   = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const RARITY_COLORS = { commun:0x59d059, rare:0x2a5fa8, epique:0x6a3daa, legendaire:0xd7af5f, mythique:0xf5b5e4, godlike:0xa83020, event:0xdedede };
  const CAT_LABEL     = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire' };
  const CLS_LABEL     = { guerrier:'⚔️ Guerrier', assassin:'🗡️ Assassin', archer:'🏹 Archer', mage:'📖 Mage', shaman:'🌿 Shaman' };

  const active = activeFields ?? EMBED_FIELDS.map(f => f.id);
  const has    = id => active.includes(id);

  const rarIcon  = RARITY_ICON[obj.rarity]  || '▪️';
  const rarLabel = RARITY_LABEL[obj.rarity] || obj.rarity || '—';
  const catLabel = CAT_LABEL[obj.category]  || obj.category || '—';
  const color    = RARITY_COLORS[obj.rarity] || 0x7a7a90;

  // ── Description ──────────────────────────────────────
  const descParts = [];

  if (has('identity')) {
    descParts.push([
      `${rarIcon} **${rarLabel}**`,
      catLabel,
      obj.palier    ? `Palier ${obj.palier}` : null,
      obj.lvl       ? `Niveau : ${obj.lvl}`  : null,
      obj.twoHanded ? '🤲 Deux mains'         : null,
      obj.sensible  ? '🤫 Sensible'           : null,
    ].filter(Boolean).join('\n'));
  }

  if (has('classes') && obj.classes?.length) {
    descParts.push(obj.classes.map(c => CLS_LABEL[c] || c).join('  ·  '));
  }

  if (has('lore') && obj.lore) {
    descParts.push(`\n> *${obj.lore.slice(0, 300)}*`);
  }

  // ── Fields ───────────────────────────────────────────
  const embedFields = [];
  const mainParts = [];

  if (has('stats')) {
    const statEntries = obj.stats ? Object.entries(obj.stats) : [];
    if (statEntries.length || obj.rune_slots) {
      const lines = statEntries.map(([k, v]) => `${DW_STAT_LABELS[k] || k}  \`${_fmtStatVal(v)}\``);
      if (obj.rune_slots) lines.push(`🔮 Empl. Runes  \`${obj.rune_slots}\``);
      mainParts.push('📊 **Stats**\n' + lines.join('\n'));
    }
  }

  if (has('obtain')) {
    const raw   = resolveObtain(obj.obtain || '');
    const clean = raw
      .replace(/\[npc:[^\]|]+\|([^\]]+)\]/g, (_, content) => {
        const [namePart, coordsPart] = content.split('\n');
        const name   = namePart.trim();
        const coords = coordsPart?.trim() || '';
        return coords ? `**${name}**\n${coords}` : `**${name}**`;
      })
      .replace(/\[[^\]|:]+\|([^\]]+)\]/g, (_, name) => `**${name.split('\n')[0].trim()}**`)
      .replace(/\[(\d+(?:[.,]\d+)?)\]/g, ' [$1%]')
      .replace(/\[\?\]/g, ' [?%]')
      .replace(/\bnpc:/g, '')
      || '—';
    mainParts.push('📍 **Obtention**\n' + clean);
  }

  if (has('craft') && obj.craft?.length) {
    const lines = obj.craft.map(c => {
      const name = itemNames?.get(c.id) || c.name || c.id.replace(/_/g, ' ');
      return `\`${c.qty}×\`  **${name}**`;
    });
    mainParts.push('🔨 **Craft**\n' + lines.join('\n'));
  }

  if (mainParts.length) {
    embedFields.push({ name: _SP, value: mainParts.join('\n\n').slice(0, 1024), inline: false });
  }

  if (has('effects') && obj.effects?.length) {
    const lines = obj.effects.map(e => `▸ ${e.label || e.id || JSON.stringify(e)}`);
    embedFields.push({ name: '✨ Effets spéciaux', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  if (has('bonuses') && obj.bonuses?.length) {
    const lines = obj.bonuses.map(b => {
      const thresh = b.count ? `**(×${b.count})** ` : '';
      return `${thresh}${b.bonus || b.label || JSON.stringify(b)}`;
    });
    embedFields.push({ name: '🔗 Bonus de panoplie', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  // ── Lien wiki ────────────────────────────────────────
  const itemId = obj.id || obj._id || obj._docId;
  if (itemId) {
    const wikiUrl = `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${itemId}`;
    embedFields.push({ name: _SP, value: `[🌐 Voir la fiche sur le wiki](${wikiUrl})`, inline: false });
  }

  // ── Embed object ─────────────────────────────────────
  const footerText = contributorName
    ? `🌙 Veilleurs au Clair de Lune — ${contributorName}`
    : '🌙 Veilleurs au Clair de Lune';
  const embed = {
    title:       obj.name,
    description: descParts.join('\n').slice(0, 4096) || undefined,
    color,
    fields:      embedFields,
    footer:      { text: footerText },
  };

  if (imageFilename) embed.thumbnail = { url: `attachment://${imageFilename}` };

  return embed;
}

// ── Embed Preview ─────────────────────────────────────
const _PREVIEW_ITEM = {
  name: 'Épée de Cristal',
  id:   'epee_cristal',
  rarity: 'legendaire',
  category: 'arme',
  palier: 2,
  lvl: 35,
  twoHanded: true,
  classes: ['guerrier', 'assassin'],
  lore: "Forgée dans les profondeurs des mines de Cristalith, cette lame légendaire vibre d'une énergie ancienne.",
  stats: {
    degats:      { min: 280, max: 350 },
    crit_chance: { min: 15, max: 15  },
    defense:     { min: 40,  max: 60  },
    sante:       { min: 800, max: 800 },
  },
  obtain: 'Obtenu en battant le [boss:gardien|Gardien de Cristal] dans le [region:mines|Donjon des Mines].',
  craft: [
    { qty: 3, id: 'cristal_pur' },
    { qty: 1, id: 'fil_argent'  },
  ],
  rune_slots: 2,
  effects: [{ label: 'Chaque coup critique inflige +20% de dégâts bonus pendant 3s.' }],
};

function _renderEmbedPreview() {
  const el = document.getElementById('dw-embed-preview');
  if (!el) return;

  const embed = _buildApprovalEmbed(_PREVIEW_ITEM, null, _dwConfig?.embedFields || null);

  const RARITY_COLORS_CSS = {
    legendaire: '#d7af5f', commun: '#59d059', rare: '#2a5fa8',
    epique: '#6a3daa', mythique: '#f5b5e4', godlike: '#a83020', event: '#dedede',
  };
  const accentColor = RARITY_COLORS_CSS[_PREVIEW_ITEM.rarity] || '#7a7a90';

  const escP = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Minimal markdown → HTML (bold, italic, code, blockquote)
  function mdToHtml(text) {
    if (!text) return '';
    return escP(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,.1);border-radius:3px;padding:1px 5px;font-family:monospace;font-size:11px;">$1</code>')
      .replace(/^&gt;\s?(.+)$/gm, '<span style="border-left:3px solid rgba(255,255,255,.2);padding-left:8px;display:block;color:rgba(255,255,255,.7);font-style:italic;">$1</span>')
      .replace(/\n/g, '<br>');
  }

  let fieldsHtml = '';
  for (const f of (embed.fields || [])) {
    if (f.name === _SP || f.value === _SP) {
      fieldsHtml += '<div style="height:6px;"></div>';
      continue;
    }
    fieldsHtml += `
      <div style="margin-bottom:2px;">
        <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:3px;">${escP(f.name)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.85);line-height:1.5;">${mdToHtml(f.value)}</div>
      </div>`;
  }

  // Preview uses the real URL (not attachment://) for display
  const thumbUrl = _itemImgSrc(_PREVIEW_ITEM) || '';

  el.innerHTML = `
    <div style="display:inline-flex;max-width:520px;width:100%;border-radius:8px;overflow:hidden;background:#2b2d31;font-family:sans-serif;">
      <div style="width:4px;flex-shrink:0;background:${accentColor};"></div>
      <div style="flex:1;padding:14px 16px;min-width:0;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${accentColor};margin-bottom:6px;">${escP(embed.title || '')}</div>
            ${embed.description ? `<div style="font-size:13px;color:rgba(255,255,255,.85);margin-bottom:10px;line-height:1.5;">${mdToHtml(embed.description)}</div>` : ''}
          </div>
          ${thumbUrl ? `<img src="${escP(thumbUrl)}" style="width:60px;height:60px;object-fit:contain;border-radius:6px;flex-shrink:0;background:rgba(0,0,0,.3);" onerror="this.style.display='none'">` : ''}
        </div>
        ${fieldsHtml ? `<div style="display:flex;flex-direction:column;gap:4px;">${fieldsHtml}</div>` : ''}
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:rgba(255,255,255,.35);">VCL Wiki</span>
          <span style="font-size:10px;color:rgba(255,255,255,.35);">${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:8px;font-style:italic;">Aperçu avec un item fictif — image non chargée en local, visible en production.</p>
  `;
}

// ── Bulk delete submissions ───────────────────────────
window.bulkDeleteSubs = async (status) => {
  const targets = allSubs.filter(s => s.status === status);
  if (!targets.length) return;
  const label = status === 'approved' ? 'approuvées' : 'rejetées';
  if (!await modal.confirm(`Supprimer définitivement les ${targets.length} soumissions ${label} ?`)) return;
  try {
    await Promise.all(targets.map(s => deleteDoc(doc(db, 'submissions', s._id))));
    const ids = new Set(targets.map(s => s._id));
    allSubs = allSubs.filter(s => !ids.has(s._id));
    updateCounts();
    renderSubs();
    toast(`✓ ${targets.length} soumission${targets.length > 1 ? 's' : ''} supprimée${targets.length > 1 ? 's' : ''}.`, 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ── Bulk approve submissions ──────────────────────────
window.bulkApproveSubs = async () => {
  let targets = allSubs.filter(s => s.status === 'pending');
  if (filterType   !== 'all') targets = targets.filter(s => s.type === filterType);
  if (filterSearch) {
    const q = normalize(filterSearch);
    targets = targets.filter(s =>
      fuzzyMatch(q, s.data?.name || s.data?.titre || s.data?.label || '') ||
      fuzzyMatch(q, s.data?.id || '')
    );
  }
  if (!targets.length) return;
  if (!await modal.confirm(
    `Approuver <b>${targets.length}</b> soumission${targets.length > 1 ? 's' : ''} en attente ?<br>` +
    `Chaque soumission sera publiée dans la base de données.`,
    { confirmLabel: `✅ Approuver les ${targets.length}` }
  )) return;

  let done = 0, errors = 0;
  for (const sub of [...targets]) {
    try {
      await window.approve(sub._id);
      done++;
    } catch(e) {
      errors++;
      console.error('[bulkApprove]', sub._id, e);
    }
  }
  toast(
    errors ? `⚠️ ${done} approuvées, ${errors} erreur${errors > 1 ? 's' : ''}.` :
             `✅ ${done} soumission${done > 1 ? 's' : ''} approuvée${done > 1 ? 's' : ''}.`,
    errors ? 'warning' : 'success'
  );
};

// ── Delete submission ─────────────────────────────────
window.deleteSub = async (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (currentRole !== 'admin' && sub && sub.status !== 'pending') {
    toast('⛔ Seuls les admins peuvent supprimer les soumissions approuvées/rejetées.', 'error');
    return;
  }
  if (!await modal.confirm('Supprimer définitivement cette soumission ?')) return;
  try {
    await deleteDoc(doc(db, 'submissions', id));
    allSubs = allSubs.filter(s => s._id !== id);
    updateCounts();
    renderSubs();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ═══════════════════════════════════════════════════
// LISTE DES QUÊTES
// ═══════════════════════════════════════════════════
let _questOrderData  = [];
let _questOrderDirty = false;
let _questDragSrc    = null;
let _questPalierCollapsed    = new Set();
let _questPalierSubCollapsed = new Set(); // clés : "type-palier"
let _questCollapseInit       = false;

const QUEST_TYPE_ORDER  = ['main', 'sec', 'ter'];
const QUEST_TYPE_LABELS_MOD = { main: '⚔️ Principale', sec: '🗺️ Secondaire', ter: '📋 Tertiaire' };
const QUEST_TYPE_COLORS_MOD = { main: '#e07c50',        sec: '#6aaad4',        ter: '#82c470'     };

window.showQuestOrder = async () => {
  _setHash('quest-order');
  document.getElementById('quest-order-panel').style.display = '';
  document.getElementById('btn-quest-order').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadQuestOrder();
};

async function loadQuestOrder() {
  const listEl = document.getElementById('quest-order-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _questOrderDirty = false;
  document.getElementById('btn-save-quest-order').disabled = true;
  try {
    const quetes = [...(await cachedDocs('quetes'))];
    quetes.sort((a, b) => {
      const ti = QUEST_TYPE_ORDER.indexOf(a.type) - QUEST_TYPE_ORDER.indexOf(b.type);
      if (ti !== 0) return ti;
      if ((a.palier||1) !== (b.palier||1)) return (a.palier||1) - (b.palier||1);
      // Respecter l'ordre existant, puis fallback alphabétique
      const ao = a.ordre ?? null, bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return (a.titre||a.id||'').localeCompare(b.titre||b.id||'', 'fr');
    });
    _questOrderData = quetes;
    renderQuestOrder();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
}

window.renderQuestOrder = function renderQuestOrder() {
  const listEl  = document.getElementById('quest-order-list');
  if (!listEl) return;
  const q = normalize((document.getElementById('quest-order-search')?.value || '').trim());

  if (!_questOrderData.length) { listEl.innerHTML = '<div class="empty">Aucune quête</div>'; return; }

  // ── Mode recherche : liste plate, pas de drag ──
  if (q) {
    const visible = _questOrderData.filter(qt =>
      fuzzyMatch(q, qt.titre||qt.id||'') ||
      fuzzyMatch(q, qt.zone||'') ||
      fuzzyMatch(q, qt.npc||'')
    );
    listEl.innerHTML = '';
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(qt => {
      const globalIdx = _questOrderData.indexOf(qt) + 1;
      listEl.appendChild(_buildQuestRow(qt, 'quest', globalIdx));
    });
    return;
  }

  // ── Mode normal : type → palier → quêtes draggables ──
  listEl.innerHTML = '';
  if (!_questCollapseInit) {
    _questCollapseInit = true;
    QUEST_TYPE_ORDER.forEach(t => { if (_questOrderData.some(q => q.type === t)) _questPalierCollapsed.add(t); });
  }
  for (const type of QUEST_TYPE_ORDER) {
    const group = _questOrderData.filter(qt => qt.type === type);
    if (!group.length) continue;

    const tc = QUEST_TYPE_COLORS_MOD[type] || '#9a9ab0';
    const tl = QUEST_TYPE_LABELS_MOD[type] || type;
    const collapsed = _questPalierCollapsed.has(type);

    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:16px;';

    const gh = document.createElement('div');
    gh.style.cssText = `padding:6px 10px;background:${tc}18;border-left:3px solid ${tc};border-radius:0 6px 6px 0;font-size:11px;font-weight:700;color:${tc};text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px;display:flex;align-items:center;gap:8px;cursor:pointer;user-select:none;`;
    gh.innerHTML = `<span>${tl}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">${group.length} quête${group.length>1?'s':''}</span><button style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:12px;padding:0 4px;line-height:1;margin-left:auto;">${collapsed?'▶':'▼'}</button>`;
    gh.querySelector('button').addEventListener('click', e => {
      e.stopPropagation();
      if (_questPalierCollapsed.has(type)) _questPalierCollapsed.delete(type);
      else _questPalierCollapsed.add(type);
      renderQuestOrder();
    });
    section.appendChild(gh);

    if (!collapsed) {
      const paliers = [...new Set(group.map(qt => qt.palier || 1))].sort((a,b) => a-b);
      for (const palier of paliers) {
        const palierGroup = group.filter(qt => (qt.palier||1) === palier);
        const subKey = `${type}-${palier}`;
        const subCollapsed = _questPalierSubCollapsed.has(subKey);

        const ph = document.createElement('div');
        ph.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 10px 2px;display:flex;align-items:center;gap:6px;cursor:pointer;user-select:none;';
        ph.innerHTML = `<span>Palier ${palier}</span><span style="opacity:.5;font-size:9px;">${palierGroup.length} quête${palierGroup.length>1?'s':''}</span><span style="margin-left:auto;font-size:11px;">${subCollapsed?'▶':'▼'}</span>`;
        ph.addEventListener('click', () => {
          if (_questPalierSubCollapsed.has(subKey)) _questPalierSubCollapsed.delete(subKey);
          else _questPalierSubCollapsed.add(subKey);
          renderQuestOrder();
        });
        section.appendChild(ph);

        if (!subCollapsed) {
          palierGroup.forEach(qt => {
            const palierIdx = palierGroup.indexOf(qt) + 1;
            const row = _buildQuestRow(qt, 'quest', palierIdx, palierGroup.length);
            section.appendChild(row);
          });
        }
      }
    }
    listEl.appendChild(section);
  }

  const untyped = _questOrderData.filter(qt => !qt.type);
  if (untyped.length) {
    const uh = document.createElement('div');
    uh.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);margin-bottom:6px;';
    uh.textContent = '— Sans type —';
    listEl.appendChild(uh);
    untyped.forEach(qt => {
      const gi = _questOrderData.indexOf(qt) + 1;
      listEl.appendChild(_buildQuestRow(qt, 'quest', gi));
    });
  }
};

// ════════════════════════════════════════
//   QUÊTES ORPHELINES (sans mapId)
// ════════════════════════════════════════

window.showQuestOrphans = async () => {
  _setHash('quest-orphans');
  document.getElementById('quest-orphan-panel').style.display = '';
  document.getElementById('btn-quest-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadQuestOrphans();
};

window.loadQuestOrphans = async function loadQuestOrphans() {
  const listEl = document.getElementById('quest-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [quetes, pnjs] = await Promise.all([cachedDocs('quetes'), cachedDocs('pnj')]);
    const pnjById   = new Map(pnjs.map(p => [p.id || p._id, p]));
    const pnjByName = new Map(pnjs.map(p => [p.name || p.nom, p]));
    const hasCoords = q => q.coords && q.coords.x != null && q.coords.z != null;
    const hasNpcPos = q => {
      if (!q.npc) return false;
      const p = pnjById.get(q.npc) || pnjByName.get(q.npc);
      return p && p.coords && p.coords.x != null;
    };
    const orphans = quetes.filter(q => !hasCoords(q) && !hasNpcPos(q));
    if (!orphans.length) {
      listEl.innerHTML = '<div class="empty" style="color:#6fbf73;">✓ Toutes les quêtes apparaissent sur la carte</div>';
      return;
    }
    listEl.innerHTML = '';

    const byType = {};
    for (const q of orphans) {
      const t = q.type || '—';
      if (!byType[t]) byType[t] = [];
      byType[t].push(q);
    }

    const typeOrder = ['main','sec','ter','—'];
    for (const type of typeOrder) {
      const group = byType[type];
      if (!group || !group.length) continue;

      const tc = QUEST_TYPE_COLORS_MOD[type] || 'var(--muted)';
      const tl = QUEST_TYPE_LABELS_MOD[type] || type;

      const gh = document.createElement('div');
      gh.style.cssText = `padding:6px 10px;background:${tc}18;border-left:3px solid ${tc};border-radius:0 6px 6px 0;font-size:11px;font-weight:700;color:${tc};text-transform:uppercase;letter-spacing:.05em;margin:10px 0 6px;display:flex;align-items:center;gap:8px;`;
      gh.innerHTML = `<span>${tl}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">${group.length} sans position carte</span>`;
      listEl.appendChild(gh);

      group.sort((a,b) => ((a.palier||1)-(b.palier||1)) || (a.titre||'').localeCompare(b.titre||'','fr'));
      group.forEach(qt => {
        const row = _buildQuestRow(qt, 'quest-orphan');
        row.style.borderLeft = '3px solid var(--danger)';
        listEl.appendChild(row);
      });
    }
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${e.message}</div>`;
  }
};

function _buildQuestRow(qt, origin = 'quest', posIdx = null, groupLen = null) {
  const row = document.createElement('div');
  row.className  = 'mob-order-row';
  row.dataset.id = qt.id;

  const tc = QUEST_TYPE_COLORS_MOD[qt.type] || 'var(--muted)';
  const zone = qt.zone ? `<span style="font-size:11px;color:var(--muted);">📍 ${escHtml(qt.zone)}</span>` : '';
  const npc  = qt.npc  ? `<span style="font-size:11px;color:var(--muted);">🧑 ${escHtml(qt.npc)}</span>`  : '';

  const isDraggable = origin === 'quest' && posIdx !== null && groupLen !== null;

  if (isDraggable) {
    row.draggable = true;
    row.innerHTML = `
      <span class="mob-order-handle">⠿</span>
      <input type="number" class="mob-order-index" value="${posIdx}" min="1" max="${groupLen}" title="Position dans ce groupe" draggable="false">
      <span style="width:8px;height:8px;border-radius:50%;background:${tc};flex-shrink:0;display:inline-block;"></span>
      <span class="mob-order-name" style="flex:1;min-width:0;">${escHtml(qt.titre || qt.id)}</span>
      ${zone}${npc}
      <button class="ed-edit-btn" title="Modifier : ${qt.titre||qt.id}\nID : ${qt.id}" draggable="false">✏️</button>`;

    const indexInput = row.querySelector('.mob-order-index');
    indexInput.addEventListener('click', e => e.stopPropagation());
    indexInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); indexInput.blur(); } });
    indexInput.addEventListener('change', () => {
      // Trouver le groupe (même type + palier) dans _questOrderData
      const palier = qt.palier || 1;
      const type   = qt.type;
      const grp    = _questOrderData.filter(q => q.type === type && (q.palier||1) === palier);
      let toIdx = parseInt(indexInput.value, 10) - 1;
      toIdx = Math.max(0, Math.min(grp.length - 1, toIdx));
      const curIdx = grp.indexOf(qt);
      if (toIdx === curIdx) { indexInput.value = curIdx + 1; return; }
      const fromGlobal = _questOrderData.indexOf(qt);
      const [removed]  = _questOrderData.splice(fromGlobal, 1);
      const nowGrp     = _questOrderData.filter(q => q.type === type && (q.palier||1) === palier);
      const insertAt   = toIdx < nowGrp.length
        ? _questOrderData.indexOf(nowGrp[toIdx])
        : (_questOrderData.indexOf(nowGrp[nowGrp.length - 1]) + 1 || _questOrderData.length);
      _questOrderData.splice(insertAt, 0, removed);
      _questOrderDirty = true;
      document.getElementById('btn-save-quest-order').disabled = false;
      renderQuestOrder();
    });

    row.addEventListener('dragstart', e => {
      if (e.target.closest('.ed-edit-btn')) { e.preventDefault(); return; }
      _questDragSrc = row;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => { row.classList.remove('dragging'); _questDragSrc = null; });
    row.addEventListener('dragover', e => {
      if (!_questDragSrc || _questDragSrc === row) return;
      e.preventDefault();
      row.classList.add('drag-over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      row.classList.remove('drag-over');
      if (!_questDragSrc || _questDragSrc === row) return;
      const fromQt = _questOrderData.find(q => q.id === _questDragSrc.dataset.id);
      const toQt   = _questOrderData.find(q => q.id === row.dataset.id);
      if (!fromQt || !toQt) return;
      // Seulement dans le même type + palier
      if (fromQt.type !== toQt.type || (fromQt.palier||1) !== (toQt.palier||1)) return;
      const fromIdx = _questOrderData.findIndex(q => q.id === _questDragSrc.dataset.id);
      const toIdx2  = _questOrderData.findIndex(q => q.id === row.dataset.id);
      if (fromIdx === -1 || toIdx2 === -1) return;
      const [moved] = _questOrderData.splice(fromIdx, 1);
      _questOrderData.splice(toIdx2, 0, moved);
      _questOrderDirty = true;
      document.getElementById('btn-save-quest-order').disabled = false;
      renderQuestOrder();
    });
  } else {
    row.innerHTML = `
      <span style="width:8px;height:8px;border-radius:50%;background:${tc};flex-shrink:0;display:inline-block;"></span>
      <span class="mob-order-name" style="flex:1;min-width:0;">${escHtml(qt.titre || qt.id)}</span>
      ${zone}${npc}
      <button class="ed-edit-btn" title="Modifier : ${qt.titre||qt.id}\nID : ${qt.id}">✏️</button>`;
  }

  row.querySelector('.ed-edit-btn').addEventListener('click', e => {
    e.stopPropagation();
    showEditor('quetes', qt.id, qt, origin);
  });
  _addCreatorBtn(row, 'quest', qt);
  return row;
}

window.saveQuestOrder = async () => {
  if (!_questOrderDirty) return;
  const btn = document.getElementById('btn-save-quest-order');
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, err = 0;
  for (let i = 0; i < _questOrderData.length; i++) {
    try {
      await updateDoc(doc(db, 'quetes', _questOrderData[i].id), { ordre: i + 1 });
      ok++;
    } catch(e) { console.error(_questOrderData[i].id, e); err++; }
  }
  localStorage.removeItem('vcl_cache_v2_quetes');
  localStorage.removeItem('vcl_cache_meta_v2_quetes');
  invalidateModCache('quetes');
  _questOrderDirty = false;
  btn.textContent = '💾 Sauvegarder';
  toast(err ? '⚠️ Erreur lors de la sauvegarde.' : `✓ Ordre sauvegardé (${ok} quêtes, err ? 'error' : 'success').`);
  document.getElementById('quest-order-search').value = '';
  await loadQuestOrder();
};

_lazyPanel(() => import('./moderation-users.js?v=c337e72d'), ['showUsersPanel', 'loadUsers', 'filterUsers', 'suspendUser', 'unsuspendUser', 'setUserRole', 'deleteUserAccount']);

window.resetHomeLeaderboard = async function resetHomeLeaderboard() {
  const ok = await modal.confirm('Remettre le classement de l\'accueil à zéro ?',
    'Tout le monde repart à 0 sur la page d\'accueil. Aucune contribution n\'est supprimée : ce classement-ci reste complet, et tu peux annuler à tout moment.');
  if (!ok) return;
  try {
    const baseline = await _lbHomeCounts();
    await setDoc(doc(db, 'config', 'leaderboard_reset'), { at: serverTimestamp(), by: currentUser?.uid || null, baseline });
    await _writeAudit('update', 'config', 'leaderboard_reset', 'Remise à zéro accueil', { members: Object.keys(baseline).length });
    toast('♻️ Classement de l\'accueil remis à zéro', 'success');
    await _lbRefreshResetInfo();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.undoHomeLeaderboardReset = async function undoHomeLeaderboardReset() {
  const ok = await modal.confirm('Annuler la remise à zéro ?', 'Le classement complet réapparaît sur l\'accueil.');
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'config', 'leaderboard_reset'));
    await _writeAudit('delete', 'config', 'leaderboard_reset', 'Annulation remise à zéro accueil');
    toast('↩ Classement complet rétabli', 'success');
    await _lbRefreshResetInfo();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

function _renderLbRows(ranked, listEl, isSnapshot) {
  if (!ranked.length) { listEl.innerHTML += '<div class="empty">Aucune contribution approuvée.</div>'; return; }
  const TYPE_ICON = { item:'⚔️', mob:'👾', pnj:'🧑', region:'📍', quest:'📜', panoplie:'🔗' };
  ranked.forEach((u, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
    const total = u.subs ? u.subs.length : (u.total || 0);
    const byType = u.subs
      ? u.subs.reduce((acc, s) => { acc[s.type] = (acc[s.type]||0)+1; return acc; }, {})
      : (u.byType || {});
    const byTypeParts = Object.entries(byType).map(([t, n]) => `${TYPE_ICON[t]||'📄'} ${n}`).join('  ');
    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:12px;padding:10px 14px;background:var(--surface);border:1px solid var(--border);border-radius:8px;margin-bottom:6px;${!isSnapshot ? 'cursor:pointer;' : ''}transition:background .15s;`;
    if (!isSnapshot) {
      row.onmouseenter = () => { row.style.background = 'var(--surface2)'; };
      row.onmouseleave = () => { row.style.background = 'var(--surface)'; };
    }
    row.innerHTML = `
      <span style="font-size:18px;width:28px;text-align:center;flex-shrink:0;">${medal}</span>
      <span style="flex:1;font-size:13px;font-weight:700;">${escHtml(u.name)}</span>
      <span style="font-size:12px;color:var(--muted);">${byTypeParts}</span>
      <span style="font-size:13px;font-weight:700;color:var(--accent);">${total}</span>
    `;
    if (!isSnapshot) row.addEventListener('click', () => showLeaderboardUser(u));
    listEl.appendChild(row);
  });
}

_lazyPanel(() => import('./moderation-leaderboard.js?v=77530f00'), ['showLeaderboard', 'loadLeaderboard', 'resetHomeLeaderboard', 'undoHomeLeaderboardReset', 'showLeaderboardUser', 'openLbMigrateDialog', 'closeLbMigrateDialog', 'lbMigrateSearchUsers', 'confirmLbMigrate']);

  const updateTitle = () => {
    const n = u.subs.length;
    titleEl.textContent = `${u.name} — ${n} contribution${n > 1 ? 's' : ''}`;
  };
  updateTitle();
  const migrateBtn = document.getElementById('btn-lb-migrate');
  if (migrateBtn) {
    migrateBtn.style.display = u.uid ? 'none' : '';
    migrateBtn._lbUser = u;
  }

  const TYPE_ICON  = { item:'⚔️', mob:'👾', pnj:'🧑', region:'📍', quest:'📜', panoplie:'🔗' };
  const TYPE_LABEL = { item:'Item', mob:'Mob', pnj:'PNJ', region:'Région', quest:'Quête', panoplie:'Panoplie' };

  const renderRows = () => {
    subsEl.innerHTML = '';
    if (!u.subs.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent = 'Aucune contribution.';
      subsEl.appendChild(empty);
      return;
    }
    const sorted = [...u.subs].sort((a, b) =>
      (a.type || '').localeCompare(b.type || '', 'fr') || (a.name || '').localeCompare(b.name || '', 'fr')
    );
    for (const s of sorted) {
      const row = document.createElement('div');
      row.id = `lb-row-${CSS.escape(s._id)}`;
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;';
      row.innerHTML = `
        <span style="width:18px;text-align:center;flex-shrink:0;">${TYPE_ICON[s.type]||'📄'}</span>
        <span style="flex:1;font-weight:600;">${escHtml(s.name || s._docId)}</span>
        <span style="color:var(--muted);font-size:11px;">${TYPE_LABEL[s.type]||s.type}</span>
      `;
      const ignoreBtn = document.createElement('button');
      ignoreBtn.className = 'btn btn-ghost';
      ignoreBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--muted);flex-shrink:0;';
      ignoreBtn.title = 'Décomptabiliser cette contribution';
      ignoreBtn.textContent = '✕ Retirer';
      ignoreBtn.addEventListener('click', () => _lbExclude(s._id, u, updateTitle, renderRows));
      row.appendChild(ignoreBtn);
      subsEl.appendChild(row);
    }
  };
  renderRows();
};

async function _lbUnexclude(entryId) {
  try {
    const ref = doc(db, 'config', 'leaderboard_excluded');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().ids || []) : [];
    await setDoc(ref, { ids: existing.filter(id => id !== entryId) });
    toast('Contribution réintégrée.', 'success');
    await loadLeaderboard();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
}

async function _lbExclude(entryId, userData, updateTitle, renderRows) {
  try {
    const ref = doc(db, 'config', 'leaderboard_excluded');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().ids || []) : [];
    if (existing.includes(entryId)) { toast('Déjà retiré.', 'warning'); return; }
    await setDoc(ref, { ids: [...existing, entryId] });
    userData.subs = userData.subs.filter(s => s._id !== entryId);
    updateTitle();
    renderRows();
    toast('Contribution retirée du leaderboard.', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════
// LEADERBOARD — Migration contributeur anonyme → compte
// ═══════════════════════════════════════════════════════
let _lbMigrateSource = null;
let _lbMigrateTarget = null;

window.openLbMigrateDialog = function() {
  const btn = document.getElementById('btn-lb-migrate');
  const u = btn?._lbUser;
  if (!u) return;
  _lbMigrateSource = u;
  _lbMigrateTarget = null;
  const infoEl = document.getElementById('lb-migrate-info');
  if (infoEl) infoEl.textContent = `Contributions de "${u.name}" (${u.subs.length}) à rattacher à un compte.`;
  const searchEl = document.getElementById('lb-migrate-user-search');
  if (searchEl) searchEl.value = '';
  const resultsEl = document.getElementById('lb-migrate-user-results');
  if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
  const selectedEl = document.getElementById('lb-migrate-selected');
  if (selectedEl) selectedEl.textContent = '';
  const confirmBtn = document.getElementById('btn-lb-migrate-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '🔀 Confirmer'; }
  const dlg = document.getElementById('lb-migrate-dialog');
  if (dlg) dlg.style.display = 'flex';
};

window.closeLbMigrateDialog = function() {
  const dlg = document.getElementById('lb-migrate-dialog');
  if (dlg) dlg.style.display = 'none';
  _lbMigrateSource = null;
  _lbMigrateTarget = null;
};

window.lbMigrateSearchUsers = async function(query) {
  const resultsEl = document.getElementById('lb-migrate-user-results');
  if (!resultsEl) return;
  const q = (query || '').trim().toLowerCase();
  if (!q) { resultsEl.style.display = 'none'; resultsEl.innerHTML = ''; return; }
  if (!window._allUsersCache) {
    try {
      const snap = await getDocs(collection(db, 'users'));
      window._allUsersCache = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
    } catch { window._allUsersCache = []; }
  }
  const matches = window._allUsersCache.filter(u => {
    const pseudo = (u.pseudo || u.displayName || '').toLowerCase();
    const email = (u.email || '').toLowerCase();
    return pseudo.includes(q) || email.includes(q);
  }).slice(0, 8);
  if (!matches.length) {
    resultsEl.innerHTML = '<div style="padding:8px 12px;font-size:12px;color:var(--muted);">Aucun résultat</div>';
    resultsEl.style.display = '';
    return;
  }
  resultsEl.innerHTML = '';
  matches.forEach(u => {
    const row = document.createElement('div');
    row.style.cssText = 'padding:8px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border);';
    row.textContent = `${u.pseudo || u.displayName || '—'} (${u.email || u.uid})`;
    row.addEventListener('mouseenter', () => { row.style.background = 'var(--surface2)'; });
    row.addEventListener('mouseleave', () => { row.style.background = ''; });
    row.addEventListener('click', () => {
      _lbMigrateTarget = u;
      const selectedEl = document.getElementById('lb-migrate-selected');
      if (selectedEl) selectedEl.textContent = `→ ${u.pseudo || u.displayName || u.uid}`;
      const confirmBtn = document.getElementById('btn-lb-migrate-confirm');
      if (confirmBtn) confirmBtn.disabled = false;
      resultsEl.style.display = 'none';
      const searchEl = document.getElementById('lb-migrate-user-search');
      if (searchEl) searchEl.value = u.pseudo || u.displayName || '';
    });
    resultsEl.appendChild(row);
  });
  resultsEl.style.display = '';
};

window.confirmLbMigrate = async function() {
  if (!_lbMigrateSource || !_lbMigrateTarget) return;
  const confirmBtn = document.getElementById('btn-lb-migrate-confirm');
  if (confirmBtn) { confirmBtn.disabled = true; confirmBtn.textContent = '⏳ Migration…'; }
  const anonName = _lbMigrateSource.name;
  const targetUid = _lbMigrateTarget.uid;
  const targetName = _lbMigrateTarget.pseudo || _lbMigrateTarget.displayName || anonName;
  let updated = 0, errors = 0;
  for (const { col } of _LB_SCAN_COLS) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const c = d.data()._contributor;
        if (!c || c.uid !== null || c.name !== anonName) continue;
        try {
          await updateDoc(doc(db, col, d.id), { '_contributor.uid': targetUid, '_contributor.name': targetName });
          updated++;
        } catch { errors++; }
      }
    } catch { errors++; }
  }
  closeLbMigrateDialog();
  toast(`${updated} contribution(s) migrée(s) vers ${targetName}.${errors ? ` ${errors} erreur(s).` : ''}`, updated > 0 ? 'success' : 'warning');
  await loadLeaderboard();
};

// ═══════════════════════════════════════════════════════
// SENSIBLE — Liste & toggle (admin only)
// ═══════════════════════════════════════════════════════

const _sensState = {
  itemsHidden: [],          // docs de items_hidden (_id = hash)
  itemsSecretById: new Map(), // id original → doc items_secret
  itemsPublic: [],          // docs de items
  mobsSecret: [],           // docs de mobs_secret
  mobsPublic: [],           // docs de mobs
  pnjSecret: [],            // docs de pnj_secret
  pnjPublic: [],            // docs de personnages
};

function _sensEsc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Formule d'image identique à creator.js / atelier.js (source de vérité partagée)
function _sensComputeImg(category, id, palier, isEvent) {
  if (!id) return null;
  const tier = (isEvent || (palier === 0 || palier === 'event')) ? 'events' : (palier ? 'P' + palier : '');
  const tp = tier ? tier + '/' : '';
  switch (category) {
    case 'arme':        return `../img/compendium/textures/weapons/${tp}${id}.png`;
    case 'armure':      return `../img/compendium/textures/armors/${tp}${id}.png`;
    case 'accessoire':  return `../img/compendium/textures/trinkets/${tp}${id}.png`;
    case 'outils':      return `../img/compendium/textures/gears/${tp}${id}.png`;
    case 'materiaux':   return `../img/compendium/textures/items/Material/${tp}${id}.png`;
    case 'ressources':  return `../img/compendium/textures/items/Ressources/${tp}${id}.png`;
    case 'consommable': return `../img/compendium/textures/items/Consommable/${tp}${id}.png`;
    case 'nourriture':  return `../img/compendium/textures/items/Nourriture/${tp}${id}.png`;
    case 'rune':        return `../img/compendium/textures/items/Runes/${tp}${id}.png`;
    case 'parchemin':   return `../img/compendium/textures/items/Parchemins/${tp}${id}.png`;
    case 'quete':       return `../img/compendium/textures/items/Quest/${tp}${id}.png`;
    case 'donjon':      return `../img/compendium/textures/items/Donjon/${tp}${id}.png`;
    case 'monnaie':     return `../img/compendium/textures/items/Monnaie/${tp}${id}.png`;
    default:            return null;
  }
}

_lazyPanel(() => import('./moderation-audit.js?v=24907cd5'), ['showAuditLog', 'loadAuditLog', 'renderAuditLog', 'loadAuditLogMore']);

// ══════════════════════════════════════════════════════
// STATISTIQUES — données de tracking dans Cloudflare D1 (worker POST /stats, même secret que le proxy Discord)
async function _fetchStats(action = 'summary', extra = {}) {
  const r = await fetch(WORKER_URL + '/stats', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: await _getWorkerSecret(), action, ...extra }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('Stats HTTP ' + r.status));
  return d;
}
window.resetStatistiques = async function() {
  if (currentRole !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  const ok = await modal.confirm('Supprimer toutes les données de statistiques (visites, profils, items consultés, recherches) ? Cette action est irréversible.', { confirmLabel: 'Supprimer', danger: true });
  if (!ok) return;
  try {
    const total = (await _fetchStats('reset')).deleted || 0;
    toast(`✓ ${total} document${total !== 1 ? 's' : ''} supprimé${total !== 1 ? 's' : ''}`, 'success');
    loadStatistiques();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

// ══════════════════════════════════════════════════════
window.showStatistiques = function() {
  if (currentRole !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _setHash('statistiques');
  document.getElementById('panel-statistiques').style.display = '';
  document.getElementById('btn-statistiques').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  loadStatistiques();
};

window.loadStatistiques = async function loadStatistiques() {
  const container = document.getElementById('stats-content');
  container.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const { renderStats, statsDay } = await import('./stats-page.js?v=c37c2cc8');
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const [summary, repSnap, items] = await Promise.all([
      _fetchStats('summary', {
        date7: statsDay(-6), date30: statsDay(-29), date35: statsDay(-34),
        dayStart: midnight.getTime(), weekStart: midnight.getTime() - 6 * 86400000,
      }),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(10))).catch(() => ({ docs: [] })),
      cachedDocs(COL.items).catch(() => []),
    ]);
    const reports = repSnap.docs.map(d => { const r = d.data(); return { pseudo: r.pseudo, page: r.page, text: r.text, ts: r.createdAt?.toMillis?.() ?? 0 }; });
    renderStats(container, summary, { items, reports, anonName }, {
      escHtml,
      loadUser: id => _fetchStats('user', { id }).then(r => r.user),
      loadCloudflare: () => _fetchStats('cloudflare'),
      loadAudit: async uid => {
        const { AUDIT_ACTION_LABELS } = await import('./moderation-audit.js?v=24907cd5');
        const snap = await getDocs(query(collection(db, 'audit_log'),
          where('actorUid', '==', uid), orderBy('createdAt', 'desc'), limit(50)));
        return snap.docs.map(d => {
          const a = d.data();
          return { label: AUDIT_ACTION_LABELS[a.action] || a.action, target: a.targetName || a.targetId || '', ts: a.createdAt?.toMillis?.() ?? 0 };
        });
      },
    });
  } catch (e) {
    container.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.showMigration = async () => {
  if (currentRole !== 'admin') return;
  _setHash('migration');
  document.getElementById('migration-panel').style.display = '';
  document.getElementById('btn-migration').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await sensReload();
};

// Migration one-shot : re-keyer items_hidden de item.id → nameHash + supprimer doublons
window.sensRunKeyMigration = async () => {
  if (currentRole !== 'admin') return;
  const log = document.getElementById('sens-migration-log');
  if (log) log.textContent = '';
  const print = (msg) => { if (log) log.textContent += msg + '\n'; console.log('[sensMigration]', msg); };

  print('Chargement items_hidden…');
  let docs;
  try {
    const snap = await getDocs(collection(db, COL.itemsHidden));
    docs = snap.docs;
  } catch (e) {
    print('Erreur : ' + e.message); return;
  }

  print(`${docs.length} doc(s) trouvé(s).`);

  // Grouper par champ 'id' (item ID original) pour détecter les doublons
  const byItemId = new Map(); // itemId → [{docKey, data}]
  for (const d of docs) {
    const data = d.data();
    const itemId = String(data.id || '');
    if (!itemId) { print(`  SKIP ${d.id} — pas de champ id`); continue; }
    if (!byItemId.has(itemId)) byItemId.set(itemId, []);
    byItemId.get(itemId).push({ docKey: d.id, data });
  }

  let migrated = 0, cleaned = 0, skipped = 0, errors = 0;

  for (const [itemId, entries] of byItemId) {
    const name = entries[0].data.name || '';
    const expectedHash = name ? await hashName(name).catch(() => '') : '';
    if (!expectedHash) { print(`  SKIP ${itemId} — hash vide (name="${name}")`); skipped++; continue; }

    // Identifier les docs correctement keyés et les orphelins
    const correct = entries.filter(e => e.docKey === expectedHash);
    const orphans = entries.filter(e => e.docKey !== expectedHash);

    if (correct.length === 0) {
      // Aucun doc avec la bonne clé → migrer le premier, supprimer les autres
      const [toKeep, ...toDelete] = orphans;
      print(`  Migre ${toKeep.docKey} → ${expectedHash} (${name})`);
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, COL.itemsHidden, expectedHash), { ...toKeep.data, nameHash: expectedHash });
        batch.delete(doc(db, COL.itemsHidden, toKeep.docKey));
        for (const o of toDelete) batch.delete(doc(db, COL.itemsHidden, o.docKey));
        await batch.commit();
        migrated++;
        cleaned += toDelete.length;
      } catch (e) { print(`  ERREUR : ${e.message}`); errors++; }
    } else if (orphans.length > 0) {
      // Doc correct existe + orphelins → supprimer les orphelins
      print(`  Nettoie ${orphans.length} orphelin(s) pour "${name}"`);
      try {
        const batch = writeBatch(db);
        for (const o of orphans) {
          print(`    Supprime orphelin ${o.docKey}`);
          batch.delete(doc(db, COL.itemsHidden, o.docKey));
        }
        await batch.commit();
        cleaned += orphans.length;
      } catch (e) { print(`  ERREUR nettoyage : ${e.message}`); errors++; }
    } else {
      skipped++; // déjà correct, un seul doc
    }
  }

  print(`\nTerminé : ${migrated} migré(s), ${cleaned} orphelin(s) supprimé(s), ${skipped} déjà correct(s), ${errors} erreur(s).`);

  invalidateModCache(COL.itemsHidden);
  await sensReload();
};

// ═══════════════════════════════════════════════════════
// TAGS — Règles automatiques de tags sur items
// ═══════════════════════════════════════════════════════
const ITEM_TAG_FIELDS = [
  { id: 'category', label: 'Catégorie', values: ['arme','armure','accessoire','consommable','nourriture','materiaux','ressources','outils','rune','parchemin','quete','donjon','monnaie'] },
  { id: 'rarity',   label: 'Rareté',   values: ['commun','rare','epique','legendaire','mythique','godlike','event'] },
  { id: 'classes',  label: 'Classe',   values: ['guerrier','assassin','archer','mage','shaman'] },
  { id: 'palier',   label: 'Palier',   values: ['1','2','3','4','5','6','7','8','9','10'] },
  { id: 'cat',      label: 'Cat/Slot', values: [] },
  { id: 'type',     label: 'Type',     values: [] },
  { id: 'slot',     label: 'Slot',     values: [] },
  { id: 'sensible',  label: 'Sensible',  values: ['true','false'] },
  { id: 'twoHanded', label: 'Deux mains', values: ['true','false'] },
];

const SEL_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;';

let _tagRules = [];

window.showTagsPanel = function() {
  _setHash('tags');
  document.getElementById('tags-panel').style.display = '';
  document.getElementById('btn-tags')?.classList.add('active');
  _initTagRuleForm();
  loadTagRules();
};

function _initTagRuleForm() {
  const fieldSel = document.getElementById('tag-rule-field');
  if (!fieldSel || fieldSel.options.length > 0) return;
  ITEM_TAG_FIELDS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.label;
    fieldSel.appendChild(opt);
  });
  updateTagRuleValueOptions();
}

window.updateTagRuleValueOptions = function() {
  const fieldEl = document.getElementById('tag-rule-field');
  const wrap    = document.getElementById('tag-rule-value-wrap');
  if (!fieldEl || !wrap) return;
  const field = ITEM_TAG_FIELDS.find(f => f.id === fieldEl.value);
  const label = wrap.querySelector('label');
  wrap.innerHTML = '';
  if (label) wrap.appendChild(label); else {
    const l = document.createElement('label');
    l.style.cssText = 'font-size:11px;color:var(--muted);';
    l.textContent = 'Valeur';
    wrap.appendChild(l);
  }
  if (field && field.values.length > 0) {
    const sel = document.createElement('select');
    sel.id = 'tag-rule-value';
    sel.style.cssText = SEL_STYLE + 'width:150px;';
    field.values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = 'tag-rule-value';
    inp.placeholder = 'valeur…';
    inp.style.cssText = SEL_STYLE + 'width:140px;';
    wrap.appendChild(inp);
  }
};

window.loadTagRules = async function() {
  try {
    const snap = await getDoc(doc(db, 'config', 'tag_rules'));
    _tagRules = snap.exists() ? (snap.data().rules || []) : [];
  } catch { _tagRules = []; }
  renderTagRulesList();
};

function renderTagRulesList() {
  const listEl = document.getElementById('tag-rules-list');
  if (!listEl) return;
  if (!_tagRules.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted);">Aucune règle définie.</div>';
    return;
  }
  listEl.innerHTML = '';
  _tagRules.forEach((rule, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;';
    const fieldLabel = ITEM_TAG_FIELDS.find(f => f.id === rule.field)?.label || rule.field;
    row.innerHTML = `
      <span style="color:var(--muted);min-width:80px;">${escHtml(fieldLabel)}</span>
      <span style="color:var(--text);">=</span>
      <span style="font-weight:600;min-width:80px;">${escHtml(String(rule.value))}</span>
      <span style="color:var(--muted);">→ 🏷️</span>
      <span style="color:var(--accent);font-weight:600;">${escHtml(rule.tag)}</span>
      <button class="btn btn-ghost" onclick="deleteTagRule(${i})" style="font-size:11px;padding:2px 8px;margin-left:auto;">✕</button>
    `;
    listEl.appendChild(row);
  });
}

window.addTagRule = async function() {
  const field = document.getElementById('tag-rule-field')?.value;
  const value = (document.getElementById('tag-rule-value')?.value || '').trim();
  const tag   = (document.getElementById('tag-rule-tag')?.value  || '').trim();
  if (!field || !value || !tag) { toast('Remplis tous les champs.', 'warning'); return; }
  _tagRules.push({ field, value, tag });
  await _saveTagRules();
  renderTagRulesList();
  if (document.getElementById('tag-rule-value')) document.getElementById('tag-rule-value').value = '';
  if (document.getElementById('tag-rule-tag'))   document.getElementById('tag-rule-tag').value   = '';
};

window.deleteTagRule = async function(index) {
  _tagRules.splice(index, 1);
  await _saveTagRules();
  renderTagRulesList();
};

async function _saveTagRules() {
  await setDoc(doc(db, 'config', 'tag_rules'), { rules: _tagRules });
}

window.seedDefaultTagRules = async function() {
  const defaults = [
    // Rareté
    { field: 'rarity', value: 'commun',     tag: 'Commun' },
    { field: 'rarity', value: 'rare',       tag: 'Rare' },
    { field: 'rarity', value: 'epique',     tag: 'Épique' },
    { field: 'rarity', value: 'legendaire', tag: 'Légendaire' },
    { field: 'rarity', value: 'mythique',   tag: 'Mythique' },
    { field: 'rarity', value: 'godlike',    tag: 'Godlike' },
    { field: 'rarity', value: 'event',      tag: 'Event' },
    // Classe
    { field: 'classes', value: 'guerrier',  tag: 'Guerrier' },
    { field: 'classes', value: 'assassin',  tag: 'Assassin' },
    { field: 'classes', value: 'archer',    tag: 'Archer' },
    { field: 'classes', value: 'mage',      tag: 'Mage' },
    { field: 'classes', value: 'shaman',    tag: 'Shaman' },
    // Slot
    { field: 'category', value: 'anneau',   tag: 'Anneau' },
    { field: 'category', value: 'amulette', tag: 'Amulette' },
    { field: 'category', value: 'bracelet', tag: 'Bracelet' },
    { field: 'category', value: 'artefact', tag: 'Artefact' },
    { field: 'category', value: 'casque',   tag: 'Casque' },
    { field: 'category', value: 'plastron', tag: 'Plastron' },
    { field: 'category', value: 'jambières',tag: 'Jambières' },
    { field: 'category', value: 'bottes',   tag: 'Bottes' },
    { field: 'category', value: 'gants',    tag: 'Gants' },
    { field: 'category', value: 'arme_s',   tag: 'Bouclier' },
    // Catégorie item
    { field: 'cat', value: 'materiaux',     tag: 'Matériau' },
    { field: 'cat', value: 'ressources',    tag: 'Ressource' },
    { field: 'cat', value: 'consommable',   tag: 'Consommable' },
    { field: 'cat', value: 'nourriture',    tag: 'Nourriture' },
    { field: 'cat', value: 'outils',        tag: 'Outil' },
    { field: 'cat', value: 'rune',          tag: 'Rune' },
    { field: 'cat', value: 'parchemin',     tag: 'Parchemin' },
    { field: 'cat', value: 'quete',         tag: 'Quête' },
    { field: 'cat', value: 'donjon',        tag: 'Donjon' },
    // Palier
    { field: 'palier', value: '1',  tag: 'Palier 1' },
    { field: 'palier', value: '2',  tag: 'Palier 2' },
    { field: 'palier', value: '3',  tag: 'Palier 3' },
    { field: 'palier', value: '4',  tag: 'Palier 4' },
    { field: 'palier', value: '5',  tag: 'Palier 5' },
    { field: 'palier', value: '6',  tag: 'Palier 6' },
    { field: 'palier', value: '7',  tag: 'Palier 7' },
    { field: 'palier', value: '8',  tag: 'Palier 8' },
    { field: 'palier', value: '9',  tag: 'Palier 9' },
    { field: 'palier', value: '10', tag: 'Palier 10' },
  ];
  // merge: keep existing rules not in defaults, add defaults not already present
  const existing = _tagRules.filter(r => !defaults.some(d => d.field === r.field && d.value === r.value && d.tag === r.tag));
  _tagRules = [...existing, ...defaults];
  await _saveTagRules();
  renderTagRulesList();
  toast(`✅ ${defaults.length} règles par défaut chargées.`, 'success');
};

window.applyTagRules = async function() {
  const statusEl = document.getElementById('tag-apply-status');
  if (statusEl) statusEl.textContent = '⏳ Application en cours…';
  let updated = 0, errors = 0;
  for (const col of ['items', 'items_secret']) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const data = d.data();
        const currentTags = Array.isArray(data.tags) ? [...data.tags] : [];
        const newTags = [...currentTags];
        for (const rule of _tagRules) {
          const val = data[rule.field];
          const match = Array.isArray(val)
            ? val.map(String).includes(String(rule.value))
            : String(val) === String(rule.value);
          if (match && !newTags.includes(rule.tag)) newTags.push(rule.tag);
        }
        if (newTags.length !== currentTags.length || newTags.some((t, i) => t !== currentTags[i])) {
          try {
            await updateDoc(doc(db, col, d.id), { tags: newTags });
            updated++;
          } catch { errors++; }
        }
      }
    } catch { errors++; }
  }
  if (statusEl) statusEl.textContent = `✅ ${updated} item(s) mis à jour.${errors ? ` ${errors} erreur(s).` : ''}`;
};

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

// ── Completion panel ───────────────────────────────────

// Définitions des champs pour les inputs guidés
// Clé = fieldId, ou "mode:fieldId" pour une surcharge par mode
const _CF_DEFS = {
  palier:      { type:'select',    opts:[[1,'Palier 1'],[2,'Palier 2'],[3,'Palier 3'],['event','Event'],[-1,'Palier Archive']] },
  difficulty:  { type:'number',    min:1, max:5, placeholder:'1–5' },
  lvl:         { type:'number',    min:1, placeholder:'Niveau requis' },
  lore:        { type:'textarea',  placeholder:'Texte de lore…' },
  obtain:      { type:'textarea',  placeholder:"Description de l'obtention…" },
  desc:        { type:'textarea',  placeholder:'Description…' },
  objectifs:   { type:'textarea',  placeholder:'Objectifs (un par ligne)' },
  recompenses: { type:'textarea',  placeholder:'Récompenses' },
  name:        { type:'text',      placeholder:'Nom affiché' },
  label:       { type:'text',      placeholder:'Nom affiché' },
  titre:       { type:'text',      placeholder:'Titre' },
  images:      { type:'text',      placeholder:'URL image (https://…)' },
  color:       { type:'colortext', placeholder:'#a07ae8' },
  npc:         { type:'text',      placeholder:'ID ou nom du PNJ donneur' },
  zone:        { type:'text',      placeholder:'ID région' },
  // Surcharges par mode
  'items:event':     { type:'select', get opts() { return (typeof EVENT_NAMES !== 'undefined' ? EVENT_NAMES : []).map(n => [n, n]); } },
  'items:rarity':    { type:'select', opts:[['commun','Commun'],['rare','Rare'],['epique','Épique'],['legendaire','Légendaire'],['mythique','Mythique'],['godlike','Godlike'],['event','Évènement']] },
  'items:category':  { type:'select', opts:[['arme','⚔️ Arme'],['armure','🛡️ Armure'],['accessoire','💍 Accessoire'],['materiaux','🧱 Matériau'],['ressources','⛏️ Ressource'],['consommable','🧪 Consommable'],['nourriture','🍖 Nourriture'],['outils','🔧 Outil'],['rune','🔮 Rune'],['parchemin','📃 Parchemin'],['quete','📜 Objet Quête'],['donjon','🏰 Donjon']] },
  'items:classes':   { type:'multicheckbox', opts:[['guerrier','⚔️ Guerrier'],['assassin','🗡️ Assassin'],['archer','🏹 Archer'],['mage','📖 Mage'],['shaman','🌿 Shaman']] },
  'mobs:type':       { type:'select', opts:[['monstre','👹 Monstre'],['sbire','💀 Sbire'],['mini_boss','⚡ Mini-Boss'],['worldboss','🌍 WorldBoss'],['boss','🔥 Boss']] },
  'mobs:region':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'quetes:type':     { type:'select', opts:[['main','⚔️ Principale'],['sec','🗺️ Secondaire'],['ter','📋 Tertiaire']] },
  'quetes:zone':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'pnj:type':        { type:'select', opts:[['marchand','🛒 Marchand'],['donneur_quete','📜 Donneur quête'],['forgeron','⚒️ Forgeron'],['aubergiste','🍺 Aubergiste'],['instructeur','📚 Instructeur'],['autre','❓ Autre']] },
  'pnj:region':      { type:'dbselect', colName:'regions', labelKey:'name' },
  craft_cd:          { type:'text', placeholder:'ex: 24h, aucun' },
};

const _NUMERIC_CF_FIELDS = new Set(['palier','lvl','difficulty','rune_slots','ordre']);

// Construit un input guidé pour un champ manquant
function _buildCompletionInput(fieldId, mode, currentValue) {
  const def = _CF_DEFS[`${mode}:${fieldId}`] || _CF_DEFS[fieldId];
  const BASE_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:13px;outline:none;';

  if (!def || def.type === 'text') {
    const el = document.createElement('input');
    el.type = 'text'; el.dataset.field = fieldId;
    el.placeholder = def?.placeholder || fieldId;
    el.style.cssText = BASE_STYLE;
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'number') {
    const el = document.createElement('input');
    el.type = 'number'; el.dataset.field = fieldId;
    if (def.min != null) el.min = def.min;
    if (def.max != null) el.max = def.max;
    el.placeholder = def.placeholder || fieldId;
    el.style.cssText = BASE_STYLE + 'width:80px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'select') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:140px;cursor:pointer;';
    el.innerHTML = '<option value="">— choisir —</option>' +
      def.opts.map(([v, l]) =>
        `<option value="${escHtml(String(v))}"${String(v) === String(currentValue) ? ' selected' : ''}>${escHtml(l || String(v))}</option>`
      ).join('');
    return el;
  }

  if (def.type === 'textarea') {
    const el = document.createElement('textarea');
    el.dataset.field = fieldId;
    el.placeholder = def.placeholder || fieldId;
    el.rows = 3;
    el.style.cssText = BASE_STYLE + 'width:300px;max-width:100%;resize:vertical;font-family:inherit;font-size:12px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'colortext') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.style.cssText = 'width:36px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
    const textEl = document.createElement('input');
    textEl.type = 'text'; textEl.dataset.field = fieldId;
    textEl.placeholder = def.placeholder || '#a07ae8';
    textEl.style.cssText = BASE_STYLE + 'width:120px;font-family:monospace;';
    if (currentValue) { textEl.value = currentValue; try { colorPicker.value = currentValue; } catch {} }
    colorPicker.addEventListener('input', () => { textEl.value = colorPicker.value; });
    textEl.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) try { colorPicker.value = textEl.value; } catch {} });
    wrap.appendChild(colorPicker);
    wrap.appendChild(textEl);
    return wrap;
  }

  if (def.type === 'multicheckbox') {
    const wrap = document.createElement('div');
    wrap.dataset.field = fieldId;
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    const current = Array.isArray(currentValue) ? currentValue : [];
    def.opts.forEach(([v, l]) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;white-space:nowrap;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = v; cb.checked = current.includes(v);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(l || v));
      wrap.appendChild(label);
    });
    return wrap;
  }

  if (def.type === 'dbselect') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:160px;cursor:pointer;';
    el.innerHTML = '<option value="">Chargement…</option>';
    cachedDocs(def.colName).then(docs => {
      docs = [...docs].sort((a, b) => (a[def.labelKey]||a.id||'').localeCompare(b[def.labelKey]||b.id||'', 'fr'));
      el.innerHTML = '<option value="">— choisir —</option>' +
        docs.map(d => `<option value="${escHtml(d.id||'')}"${d.id === String(currentValue||'') ? ' selected' : ''}>${escHtml(d[def.labelKey]||d.id||'')}</option>`).join('');
    }).catch(() => { el.innerHTML = '<option value="">Erreur</option>'; });
    return el;
  }

  // Fallback
  const el = document.createElement('input');
  el.type = 'text'; el.dataset.field = fieldId;
  el.placeholder = fieldId;
  el.style.cssText = BASE_STYLE;
  if (currentValue != null) el.value = currentValue;
  return el;
}

const REQUIRED_ADMIN_FIELDS = {
  mob:    ['difficulty'],
  region: ['color'],
};

let _completionResults = [];
let _tdcData = {};
let _completionIgnored = null;
let _subsByDoc = {}; // { [colName~docId]: submission } — dernière sub par doc // { [mode]: Set<string> } — null = non chargé

async function _loadCompletionIgnored() {
  if (_completionIgnored !== null) return;
  _completionIgnored = {};
  try {
    const snap = await getDoc(doc(db, 'config', 'completion_ignored'));
    if (snap.exists()) {
      for (const [mode, ids] of Object.entries(snap.data())) {
        _completionIgnored[mode] = new Set(Array.isArray(ids) ? ids : []);
      }
    }
  } catch {}
  for (const mode of Object.keys(QUALITY_COL_MAP)) {
    if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  }
}

async function _saveCompletionIgnored() {
  const payload = {};
  for (const [m, ids] of Object.entries(_completionIgnored || {})) {
    if (ids.size) payload[m] = [...ids];
  }
  await setDoc(doc(db, 'config', 'completion_ignored'), payload);
}

window.showCompletion = async () => {
  _setHash('completion');
  document.getElementById('completion-panel').style.display = '';
  document.getElementById('btn-completion').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCompletion();
};

window.loadCompletion = async () => {
  const list = document.getElementById('completion-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';
  _completionIgnored = null; // forcer rechargement
  await _loadCompletionIgnored();

  // Charger quality standards depuis Firestore
  let standards = {};
  try {
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        const normReq = [...new Set((cfg.required || []).map(_normF))];
        const normByCat = {};
        for (const [sc, scfg] of Object.entries(cfg.byCategory || {})) {
          normByCat[sc] = { required: [...new Set((scfg.required || []).map(_normF))] };
        }
        standards[mode] = { required: normReq, byCategory: normByCat };
      }
    }
  } catch {}

  // Fusionner les champs admin obligatoires (required_admin_fields ou fallback)
  let adminFields = REQUIRED_ADMIN_FIELDS;
  try {
    const snap = await getDoc(doc(db, 'config', 'required_admin_fields'));
    if (snap.exists()) adminFields = snap.data();
  } catch {}
  const _adminColMap = { mob:'mobs', quete:'quetes', region:'regions' };
  for (const [type, fields] of Object.entries(adminFields)) {
    const mode = _adminColMap[type] || type;
    if (!standards[mode]) standards[mode] = { required: [], byCategory: {} };
    for (const f of fields) {
      if (!standards[mode].required.includes(f)) standards[mode].required.push(f);
    }
  }

  if (!Object.keys(standards).length) {
    list.innerHTML = '<div class="empty">Aucune configuration définie. Définissez les champs requis dans ⚙️ Champs requis.</div>';
    const badge = document.getElementById('count-incomplete');
    if (badge) badge.style.display = 'none';
    return;
  }

  _completionResults = [];
  try {
    for (const [mode, std] of Object.entries(standards)) {
      const colName = QUALITY_COL_MAP[mode];
      if (!colName) continue;
      const disc    = QUALITY_DISCRIMINANT[mode];
      const hasByCat = disc && Object.keys(std.byCategory || {}).length > 0;
      let docs = [];
      try { docs = await cachedDocs(colName); } catch { continue; }
      for (const _d of docs) {
        const d = (!_d.images?.length && (_d.img || _d.image))
          ? { ..._d, images: [_d.img || _d.image].filter(Boolean) }
          : _d;
        const missing = (std.required || []).filter(f => _fieldEmpty(d, f));
        const discVal = disc ? (d[disc] || null) : null;
        if (hasByCat && !discVal) {
          if (!missing.includes(disc)) missing.push(disc);
        } else if (discVal && std.byCategory?.[discVal]) {
          for (const f of (std.byCategory[discVal].required || [])) {
            if (!missing.includes(f) && _fieldEmpty(d, f)) missing.push(f);
          }
        }
        if (missing.length) _completionResults.push({ mode, colName, doc: d, missing, discVal });
      }
    }
  } catch(e) {
    list.innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
    return;
  }

  // Quêtes sans description (vérification systématique, indépendante des standards)
  try {
    const questDocs = await cachedDocs('quetes');
    // Ajouter 'desc' aux quêtes déjà dans les résultats qui n'ont pas de description
    for (const r of _completionResults) {
      if (r.colName === 'quetes' && (!r.doc.desc || !r.doc.desc.trim())) {
        if (!r.missing.includes('desc')) r.missing.push('desc');
      }
    }
    const coveredQuestIds = new Set(_completionResults.filter(r => r.colName === 'quetes').map(r => r.doc.id || r.doc._id));
    for (const q of questDocs) {
      const qid = q.id || q._id;
      if (coveredQuestIds.has(qid)) continue;
      if (!q.desc || !q.desc.trim()) {
        _completionResults.push({ mode: 'quetes', colName: 'quetes', doc: q, missing: ['desc'], discVal: null });
      }
    }
  } catch {}

  // craft_cd — requis seulement si l'item a des ingrédients de craft
  try {
    const itemDocs = await cachedDocs(COL.items);
    for (const r of _completionResults) {
      if (r.colName === COL.items && Array.isArray(r.doc.craft) && r.doc.craft.length > 0
          && (!r.doc.craft_cd || !String(r.doc.craft_cd).trim())) {
        if (!r.missing.includes('craft_cd')) r.missing.push('craft_cd');
      }
    }
    const coveredItemIds = new Set(
      _completionResults.filter(r => r.colName === COL.items).map(r => r.doc.id || r.doc._id)
    );
    for (const item of itemDocs) {
      const iid = item.id || item._id;
      if (coveredItemIds.has(iid)) continue;
      if (Array.isArray(item.craft) && item.craft.length > 0
          && (!item.craft_cd || !String(item.craft_cd).trim())) {
        _completionResults.push({
          mode: 'items', colName: COL.items, doc: item,
          missing: ['craft_cd'], discVal: item.category || null,
        });
      }
    }
  } catch {}

  // Badge sidebar (exclut les ignorés)
  const _activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
  const badge = document.getElementById('count-incomplete');
  if (badge) { badge.textContent = _activeCount; badge.style.display = _activeCount ? '' : 'none'; }

  // Filtre dynamique : uniquement les champs qui ont au moins un manquant
  const allMissingFields = [...new Set(_completionResults.flatMap(r => r.missing))].sort();
  const filterBar = document.getElementById('completion-filter-bar');
  const filterSel = document.getElementById('completion-filter-field');
  if (filterSel) {
    const prev = filterSel.value;
    filterSel.innerHTML = '<option value="">Tous les problèmes</option>' +
      allMissingFields.map(f => `<option value="${escHtml(f)}"${f === prev ? ' selected' : ''}>${escHtml(f)}</option>`).join('');
    if (filterBar) filterBar.style.display = allMissingFields.length > 1 ? 'flex' : 'none';
  }

  // Charger la sélection du tableau de chasse
  try {
    const tdcSnap = await getDoc(doc(db, 'config', 'tableau_de_chasse'));
    _tdcData = tdcSnap.exists() ? tdcSnap.data() : {};
  } catch { _tdcData = {}; }

  // Construire lookup soumissions par doc (depuis allSubs global)
  _subsByDoc = {};
  for (const sub of (window.allSubs || [])) {
    const colName = _SUB_COL_MAP[sub.type];
    const id = sub.data?.id;
    if (!colName || !id) continue;
    const key = colName + '~' + id;
    const existing = _subsByDoc[key];
    // Garder la plus récente (par submittedAt)
    if (!existing || (sub.submittedAt?.seconds || 0) > (existing.submittedAt?.seconds || 0)) {
      _subsByDoc[key] = sub;
    }
  }

  // Auto-retirer du TDC : items complets (plus dans _completionResults) OU submission approuvée
  const _incompleteKeys = new Set(_completionResults.map(r => r.mode + '~' + (r.doc.id || '')));
  let _tdcModified = false;
  for (const [mode, ids] of Object.entries(_tdcData)) {
    if (!Array.isArray(ids)) continue;
    const colName = QUALITY_COL_MAP[mode];
    const filtered = ids.filter(id => {
      if (!_incompleteKeys.has(mode + '~' + id)) return false; // plus de champs manquants
      const sub = _subsByDoc[colName + '~' + id];
      if (sub?.status === 'approved') return false; // submission acceptée
      return true;
    });
    if (filtered.length !== ids.length) { _tdcData[mode] = filtered; _tdcModified = true; }
  }
  if (_tdcModified) {
    try { await setDoc(doc(db, 'config', 'tableau_de_chasse'), _tdcData); } catch {}
  }

  renderCompletion(); // inclut _appendBrokenImagesSection en fin
};

function _buildCompletionCard(mode, colName, d, missing, discVal, { ignored = false } = {}) {
  const safeId    = (d.id || '').replace(/[^a-zA-Z0-9_-]/g, '_') || Math.random().toString(36).slice(2);
  const subcatLbl = discVal ? _subcatLabel(mode, discVal) : null;
  const docId     = d.id || '';
  const sub       = _subsByDoc[(QUALITY_COL_MAP[mode] || colName) + '~' + docId];
  const hasPending = !ignored && (sub?.status === 'pending' || sub?.status === 'changes_requested');

  const card = document.createElement('div');
  card.style.cssText = `background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;${ignored ? 'opacity:.55;' : ''}${hasPending ? 'border-left:3px solid var(--warn);' : ''}`;

  const headRow = document.createElement('div');
  headRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;';
  headRow.innerHTML = `
    ${!ignored ? `<label class="tdc-check" title="Ajouter au tableau de chasse"><input type="checkbox" data-mode="${escHtml(mode)}" data-id="${escHtml(docId)}"${(_tdcData[mode]||[]).includes(docId) ? ' checked' : ''} onchange="saveTableauDeChasse()">🎯</label>` : ''}
    <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:8px;background:var(--surface3);color:var(--muted);flex-shrink:0;">${escHtml(mode)}</span>
    ${subcatLbl ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(224,172,96,.12);color:var(--accent);border:1px solid rgba(224,172,96,.25);flex-shrink:0;">${escHtml(subcatLbl)}</span>` : ''}
    ${d.palier != null ? `<span class="dq-pal">${d.palier === 'event' ? 'Event' : d.palier < 0 ? 'Archive' : 'P' + escHtml(String(d.palier))}</span>` : ''}
    <span style="font-size:14px;font-weight:700;">${escHtml(d.name||d.titre||d.label||docId||'—')}</span>
    <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(docId)}</span>
    ${hasPending
      ? `<span style="font-size:11px;color:var(--warn);font-weight:600;flex:1;min-width:0;">⏳ Vérification en cours — soumission en attente de modération</span>`
      : `<span style="font-size:11px;color:var(--muted);flex:1;min-width:0;">${ignored ? '🚫 Ignoré · ' : ''}Manque : ${missing.map(f => `<code style="background:var(--surface2);padding:1px 4px;border-radius:3px;">${escHtml(f)}</code>`).join(' ')}</span>`
    }
    ${!ignored && !hasPending ? `<button class="btn btn-ghost btn-sm" onclick="showEditor('${escHtml(colName)}','${escHtml(docId)}',null,'completion')" style="font-size:11px;flex-shrink:0;">✏️ Éditer</button>` : ''}
    ${!ignored && !hasPending && mode === 'items' ? `<button class="btn btn-ghost btn-sm" onclick="openCompletionInCreator('${escHtml(colName)}','${escHtml(docId)}')" style="font-size:11px;flex-shrink:0;" title="Ouvrir dans le Creator">⚙️ Creator</button>` : ''}
    ${!ignored
      ? `<button class="btn btn-ghost btn-sm" onclick="window.ignoreCompletionDoc('${escHtml(mode)}','${escHtml(docId)}',this)" style="font-size:11px;flex-shrink:0;color:var(--muted);" title="Marquer comme exception — ne plus afficher dans Tableau de Chasse">🚫 Ignorer</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="window.unignoreCompletionDoc('${escHtml(mode)}','${escHtml(docId)}',this)" style="font-size:11px;flex-shrink:0;" title="Réintégrer dans Tableau de Chasse">↩️ Réactiver</button>`
    }
  `;
  card.appendChild(headRow);

  if (!ignored && !hasPending) {
    const fieldsWrap = document.createElement('div');
    fieldsWrap.id = `completion-fields-${safeId}`;
    fieldsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;';
    for (const f of missing) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;';
      lbl.textContent = f;
      wrap.appendChild(lbl);
      wrap.appendChild(_buildCompletionInput(f, mode, d[f] != null ? d[f] : undefined));
      fieldsWrap.appendChild(wrap);
    }
    card.appendChild(fieldsWrap);

    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'margin-top:10px;display:flex;align-items:center;gap:8px;';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-ghost btn-sm';
    saveBtn.style.cssText = 'font-size:12px;';
    saveBtn.textContent = '💾 Sauvegarder';
    saveBtn.setAttribute('onclick', `saveCompletionFields('${escHtml(mode)}','${escHtml(docId)}',this)`);
    const statusEl = document.createElement('span');
    statusEl.id = `completion-status-${safeId}`;
    statusEl.style.cssText = 'font-size:11px;';
    saveRow.appendChild(saveBtn);
    saveRow.appendChild(statusEl);
    card.appendChild(saveRow);
  }

  return card;
}

window.renderCompletion = function renderCompletion() {
  const list        = document.getElementById('completion-list');
  const filterField = document.getElementById('completion-filter-field')?.value || '';

  const isIgnored = r => _completionIgnored?.[r.mode]?.has(r.doc.id || '');
  let results = _completionResults.filter(r => !isIgnored(r));
  if (filterField) results = results.filter(r => r.missing.includes(filterField));
  if (window._dqSort('completion-panel') === 'palier') results = [...results].sort((a, b) => window._dqRank(a.doc.palier) - window._dqRank(b.doc.palier));

  list.innerHTML = '';

  if (!results.length) {
    list.innerHTML = filterField
      ? '<div class="empty">Aucun document incomplet pour ce critère. ✓</div>'
      : '<div class="empty">Aucun document à compléter. ✓</div>';
    _appendBrokenImagesSection();
    return;
  }

  const byMode = {};
  for (const r of results) {
    if (!byMode[r.mode]) byMode[r.mode] = [];
    byMode[r.mode].push(r);
  }

  for (const [mode, rows] of Object.entries(byMode)) {
    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:12px;';
    header.textContent = `${QUALITY_MODE_LABELS[mode] || mode} — ${rows.length} incomplet${rows.length > 1 ? 's' : ''}`;
    list.appendChild(header);
    for (const { colName, doc: d, missing, discVal } of rows) {
      list.appendChild(_buildCompletionCard(mode, colName, d, missing, discVal));
    }
  }

  _appendBrokenImagesSection();
};

function _appendIgnoredSection() {
  const list = document.getElementById('completion-list');
  if (!list) return;
  const ignoredRows = _completionResults.filter(r => _completionIgnored?.[r.mode]?.has(r.doc.id || ''));
  if (!ignoredRows.length) return;

  const header = document.createElement('div');
  header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;cursor:pointer;display:flex;align-items:center;gap:6px;';
  header.innerHTML = `<span id="ignored-chevron">▶</span> 🚫 Ignorés — ${ignoredRows.length} exception${ignoredRows.length > 1 ? 's' : ''}`;
  list.appendChild(header);

  const body = document.createElement('div');
  body.id = 'ignored-section-body';
  body.style.display = 'none';
  list.appendChild(body);

  header.onclick = () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    document.getElementById('ignored-chevron').textContent = open ? '▶' : '▼';
  };

  for (const { colName, doc: d, missing, discVal, mode } of ignoredRows) {
    body.appendChild(_buildCompletionCard(mode, colName, d, missing, discVal, { ignored: true }));
  }
}

window.ignoreCompletionDoc = async (mode, docId, btn) => {
  if (!_completionIgnored) _completionIgnored = {};
  if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  _completionIgnored[mode].add(docId);
  if (btn) btn.disabled = true;
  try {
    await _saveCompletionIgnored();
    const activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
    const badge = document.getElementById('count-incomplete');
    if (badge) { badge.textContent = activeCount; badge.style.display = activeCount ? '' : 'none'; }
    renderCompletion();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
    _completionIgnored[mode].delete(docId);
    if (btn) btn.disabled = false;
  }
};

window.unignoreCompletionDoc = async (mode, docId, btn) => {
  _completionIgnored?.[mode]?.delete(docId);
  if (btn) btn.disabled = true;
  try {
    await _saveCompletionIgnored();
    const activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
    const badge = document.getElementById('count-incomplete');
    if (badge) { badge.textContent = activeCount; badge.style.display = activeCount ? '' : 'none'; }
    renderCompletion();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.saveTableauDeChasse = async function() {
  const result = { items: [], mobs: [], pnj: [], regions: [], quetes: [], panoplies: [] };
  document.querySelectorAll('#completion-list input[type=checkbox][data-mode]').forEach(cb => {
    const m = cb.dataset.mode;
    if (cb.checked && result[m] !== undefined) result[m].push(cb.dataset.id);
  });
  try {
    await setDoc(doc(db, 'config', 'tableau_de_chasse'), result);
    _tdcData = result;
  } catch(e) {
    toast('⛔ Tableau de chasse : ' + e.message, 'error');
  }
};

async function _appendBrokenImagesSection() {
  const list = document.getElementById('completion-list');
  if (!list) return;
  const imgHeader = document.createElement('div');
  imgHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;';
  imgHeader.textContent = '🖼️ Images — vérification en cours…';
  list.appendChild(imgHeader);
  try {
    const itemDocs = await _loadItemDocsForImageCheck();
    const broken = await _checkBrokenImages(itemDocs, (done, total) => {
      imgHeader.textContent = `🖼️ Images — ${done} / ${total} vérifiées…`;
    });
    if (!broken.length) {
      imgHeader.textContent = '🖼️ Images — toutes accessibles ✓';
    } else {
      imgHeader.textContent = `🖼️ Images cassées — ${broken.length} item${broken.length > 1 ? 's' : ''}`;
      for (const { doc: d, brokenUrls } of broken) {
        const sens = d._sensible === true;
        const editKey = sens ? (d._docKey || '') : (d.id || '');
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:700;flex:1;min-width:120px;">${escHtml(d.name||d.id||'—')}${sens ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒 Sensible</span>' : ''}</span>
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(d.id||'')}</span>
          <div style="width:100%;display:flex;flex-direction:column;gap:3px;">
            ${brokenUrls.map(u => `<span style="font-size:11px;color:var(--danger);font-family:monospace;word-break:break-all;">⛔ ${escHtml(u)}</span>`).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="_openItemForCompletion('${escHtml(editKey)}',${sens},'completion')" style="font-size:11px;">✏️ Éditer</button>
        `;
        list.appendChild(card);
      }
    }
  } catch {
    imgHeader.textContent = '🖼️ Images — erreur lors de la vérification';
  }
  _appendIgnoredSection();
}

window.saveCompletionFields = async (mode, docId, btn) => {
  const colName = QUALITY_COL_MAP[mode] || ({ mob:'mobs', quete:'quetes', region:'regions' }[mode]) || mode;
  if (!hasRole(currentRole, 'contributeur')) { toast('⛔ Accès refusé', 'error'); return; }
  const safeDocId  = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fieldsWrap = document.getElementById(`completion-fields-${safeDocId}`);
  const status     = document.getElementById(`completion-status-${safeDocId}`);
  if (!fieldsWrap) return;

  const patch = {};

  // input / select / textarea avec data-field (hors checkbox et color picker)
  for (const el of fieldsWrap.querySelectorAll('input[data-field]:not([type=checkbox]):not([type=color]), select[data-field], textarea[data-field]')) {
    const f = el.dataset.field;
    const v = el.value.trim();
    if (!v) continue;
    patch[f] = _NUMERIC_CF_FIELDS.has(f) && !isNaN(Number(v)) ? Number(v) : v;
  }

  // div[data-field] = multicheckbox
  for (const wrap of fieldsWrap.querySelectorAll('div[data-field]')) {
    const f       = wrap.dataset.field;
    const checked = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
    if (checked.length) patch[f] = checked;
  }

  if (!Object.keys(patch).length) { toast('⚠️ Aucun champ rempli', 'warning'); return; }
  try {
    if (btn) btn.disabled = true;
    await updateDoc(doc(db, colName, docId), patch);
    invalidateModCache(colName);
    await loadCompletion();
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
    if (btn) btn.disabled = false;
  }
};

window.openCompletionInCreator = async function(colName, docId) {
  let data = null;
  try {
    const snap = await getDoc(doc(db, colName, docId));
    if (snap.exists()) data = { id: snap.id, ...snap.data() };
  } catch(e) {
    toast('⛔ Impossible de charger le document : ' + e.message, 'error');
    return;
  }
  if (!data) { toast('⛔ Document introuvable.', 'error'); return; }
  const typeMap = { items:'item', mobs:'mob', personnages:'pnj', regions:'region', quetes:'quest', panoplies:'panoplie' };
  const type = typeMap[colName] || 'item';
  sessionStorage.setItem('editSub', JSON.stringify({ type, data }));
  window.open('creator.html', '_blank');
};

// ── Creator Validation Config (Champs requis) ──────────
const QUALITY_FIELD_SCHEMA = {
  items: [
    { id: 'name',     label: 'Nom affiché' },
    { id: 'rarity',   label: 'Rareté' },
    { id: 'category', label: 'Catégorie' },
    { id: 'palier',   label: 'Palier' },
    { id: 'event',    label: 'Évènement (palier Event uniquement)' },
    { id: 'lvl',      label: 'Niveau requis' },
    { id: 'images',   label: 'Image' },
    { id: 'lore',     label: 'Lore' },
    { id: 'obtain',   label: 'Obtention' },
    { id: 'stats',    label: 'Stats' },
    { id: 'effects',  label: 'Effets' },
    { id: 'cat',      label: 'Slot interne' },
    { id: 'craft_cd', label: 'CD de craft' },
  ],
  mobs: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'palier', label: 'Palier' },
    { id: 'region', label: 'Région' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'loot',   label: 'Loot' },
  ],
  pnj: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'coords', label: 'Coordonnées' },
    { id: 'region', label: 'Région' },
    { id: 'palier', label: 'Palier' },
  ],
  regions: [
    { id: 'name',   label: 'Nom' },
    { id: 'palier', label: 'Palier' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'images', label: 'Image' },
  ],
  quetes: [
    { id: 'titre',      label: 'Titre' },
    { id: 'type',       label: 'Type' },
    { id: 'palier',     label: 'Palier' },
    { id: 'zone',       label: 'Zone' },
    { id: 'npc',        label: 'PNJ donneur' },
    { id: 'desc',       label: 'Description' },
    { id: 'objectifs',  label: 'Objectifs' },
    { id: 'recompenses',label: 'Récompenses' },
  ],
  panoplies: [
    { id: 'label',   label: 'Nom' },
    { id: 'bonuses', label: 'Bonus' },
    { id: 'images',  label: 'Image' },
  ],
};

const QUALITY_COL_MAP = {
  items: COL.items, mobs: COL.mobs, pnj: COL.pnj,
  regions: COL.regions, quetes: COL.quetes, panoplies: COL.panoplies,
};

const QUALITY_MODE_LABELS = {
  items:     '⚔️ Items',
  mobs:      '👾 Mobs',
  pnj:       '🧑 PNJ',
  regions:   '📍 Régions',
  quetes:    '📜 Quêtes',
  panoplies: '🔗 Panoplies',
};

// Champ discriminant par mode (détermine la sous-catégorie d'un doc)
const QUALITY_DISCRIMINANT = {
  items:  'category',
  mobs:   'type',
  quetes: 'type',
};

// Sous-catégories connues par mode (UI + règles byCategory)
const QUALITY_SUBCATEGORIES = {
  items: [
    { id: 'arme',        label: '⚔️ Arme' },
    { id: 'armure',      label: '🛡️ Armure' },
    { id: 'accessoire',  label: '💍 Accessoire' },
    { id: 'materiaux',   label: '🧱 Matériau' },
    { id: 'ressources',  label: '⛏️ Ressource' },
    { id: 'consommable', label: '🧪 Consommable' },
    { id: 'nourriture',  label: '🍖 Nourriture' },
    { id: 'outils',      label: '🔧 Outil' },
    { id: 'rune',        label: '🔮 Rune' },
    { id: 'parchemin',   label: '📃 Parchemin' },
    { id: 'quete',       label: '📜 Objet Quête' },
    { id: 'donjon',      label: '🏰 Donjon' },
  ],
  mobs: [
    { id: 'monstre',   label: '👹 Monstre' },
    { id: 'sbire',     label: '💀 Sbire' },
    { id: 'mini_boss', label: '⚡ Mini-Boss' },
    { id: 'worldboss', label: '🌍 WorldBoss' },
    { id: 'boss',      label: '🔥 Boss' },
  ],
  quetes: [
    { id: 'main', label: '⚔️ Principale' },
    { id: 'sec',  label: '🗺️ Secondaire' },
    { id: 'ter',  label: '📋 Tertiaire' },
  ],
};

// _cvData: { [mode]: { required: Set<string>, byCategory: { [subcat]: Set<string> } } }
let _cvData    = {};
let _cvMode    = 'items';
let _cvSubMode = {}; // mode → sous-catégorie sélectionnée dans l'UI
let _cvDirty   = false;
let _cvStats   = {}; // { [mode]: { [fieldId]: count } } — nb docs manquant ce champ

function _cvModeData(mode) {
  if (!_cvData[mode]) _cvData[mode] = { required: new Set(), byCategory: {} };
  return _cvData[mode];
}
function _cvSubData(mode, subcat) {
  const md = _cvModeData(mode);
  if (!md.byCategory[subcat]) md.byCategory[subcat] = new Set();
  return md.byCategory[subcat];
}

window.showCreatorValidation = async () => {
  if (currentRole !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _cvStats = {};
  _setHash('creator-validation');
  document.getElementById('creator-validation-panel').style.display = '';
  document.getElementById('btn-creator-validation').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCreatorValidation();
};

window.loadCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  try {
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    _cvData = {};
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        _cvData[mode] = { required: new Set((cfg.required || []).map(_normF)), byCategory: {} };
        for (const [subcat, scfg] of Object.entries(cfg.byCategory || {})) {
          _cvData[mode].byCategory[subcat] = new Set((scfg.required || []).map(_normF));
        }
      }
    }
    _renderCvUI();
    if (status) status.style.display = 'none';
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  }
};

async function _computeCvStats(mode) {
  if (_cvStats[mode]) return;
  const col = QUALITY_COL_MAP[mode];
  if (!col) return;
  await _loadCompletionIgnored();
  const allDocs = await cachedDocs(col);
  const ignoredSet = _completionIgnored?.[mode] || new Set();
  const docs = allDocs.filter(d => !ignoredSet.has(d.id || ''));
  const fields = QUALITY_FIELD_SCHEMA[mode] || [];
  const discriminant = QUALITY_DISCRIMINANT[mode];
  const subCats = QUALITY_SUBCATEGORIES[mode] || [];

  // global counts (ignorés exclus)
  const global = {};
  for (const f of fields) global[f.id] = docs.filter(d => _fieldEmpty(d, f.id)).length;

  // per-subcategory counts
  const byCategory = {};
  if (discriminant && subCats.length) {
    for (const sc of subCats) {
      const subset = docs.filter(d => d[discriminant] === sc.id);
      const counts = {};
      for (const f of fields) counts[f.id] = subset.filter(d => _fieldEmpty(d, f.id)).length;
      byCategory[sc.id] = counts;
    }
  }

  _cvStats[mode] = { global, byCategory };
}

function _renderCvFieldGrid(fields, reqSet, scope, subcat) {
  const subcatAttr = subcat ? ` data-subcat="${subcat}"` : '';
  const modeStats = _cvStats[_cvMode] || {};
  return fields.map(f => {
    const counts = scope === 'bycat' && subcat
      ? modeStats.byCategory?.[subcat]
      : modeStats.global;
    const count = counts?.[f.id];
    const impactHtml = count != null
      ? `<span class="cv-field-impact${count > 0 ? ' has-missing' : ''}" title="${count} doc${count !== 1 ? 's' : ''} manquant ce champ">${count}</span>`
      : `<span class="cv-field-impact">—</span>`;
    return `<div class="cv-field-row">
      <span class="cv-field-label">${f.label || f.id}</span>
      ${impactHtml}
      <div class="cv-field-toggle-wrap">
        <button class="perm-toggle ${reqSet.has(f.id) ? 'on' : 'off'}"
          data-mode="${_cvMode}" data-scope="${scope}" data-field="${f.id}"${subcatAttr}
          onclick="window._onCvToggle(this)" title="${reqSet.has(f.id) ? 'Requis' : 'Optionnel'}">
        </button>
      </div>
    </div>`;
  }).join('');
}

function _renderCvUI() {
  const tabsEl = document.getElementById('cv-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML = Object.entries(QUALITY_MODE_LABELS).map(([m, lbl]) => {
    const reqCount = _cvData[m]?.required?.size || 0;
    return `<button class="cv-mode-tab${m === _cvMode ? ' active' : ''}" onclick="window._setCvMode('${m}')">
      ${lbl} <span class="cv-mode-req-count">${reqCount}</span>
    </button>`;
  }).join('');

  const grid    = document.getElementById('cv-grid');
  const fields  = QUALITY_FIELD_SCHEMA[_cvMode] || [];
  const md      = _cvModeData(_cvMode);
  const subCats = QUALITY_SUBCATEGORIES[_cvMode] || [];
  const globalCount = md.required.size;

  let html = `<div class="cv-section">
    <div class="cv-section-header">
      <span class="cv-section-title">Toujours requis</span>
      ${globalCount ? `<span class="cv-section-count">${globalCount} champ${globalCount > 1 ? 's' : ''}</span>` : ''}
    </div>
    ${_renderCvFieldGrid(fields, md.required, 'global', null)}
  </div>`;

  if (subCats.length) {
    const selSub = _cvSubMode[_cvMode] || subCats[0].id;
    if (!_cvSubMode[_cvMode]) _cvSubMode[_cvMode] = selSub;
    const subReq = _cvSubData(_cvMode, selSub);
    const subCount = subReq.size;

    html += `<div class="cv-section">
      <div class="cv-section-header">
        <span class="cv-section-title">Par catégorie</span>
        ${subCount ? `<span class="cv-section-count">${subCount} champ${subCount > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="cv-subcat-bar">
        ${subCats.map(sc => `<button class="cv-subcat-btn${sc.id === selSub ? ' active' : ''}"
          onclick="window._setCvSubMode('${sc.id}')">${sc.label}</button>`).join('')}
      </div>
      ${_renderCvFieldGrid(fields, subReq, 'bycat', selSub)}
    </div>`;
  }

  grid.innerHTML = html;

  if (!_cvStats[_cvMode]) {
    _computeCvStats(_cvMode).then(() => _renderCvUI());
  }
}

window._setCvMode    = (m)  => { _cvMode = m; _renderCvUI(); };
window._setCvSubMode = (sc) => { _cvSubMode[_cvMode] = sc; _renderCvUI(); };
window._onCvToggle   = (btn) => {
  const { mode, scope, field, subcat } = btn.dataset;
  const isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn);
  btn.classList.toggle('off', isOn);
  btn.title = !isOn ? 'Requis' : 'Optionnel';
  if (scope === 'global') {
    const req = _cvModeData(mode).required;
    !isOn ? req.add(field) : req.delete(field);
  } else {
    const req = _cvSubData(mode, subcat);
    !isOn ? req.add(field) : req.delete(field);
  }
  _cvDirty = true;
  const saveBtn = document.getElementById('btn-save-creator-validation');
  if (saveBtn) saveBtn.classList.add('cv-save-dirty');
  _renderCvUI();
};

window.saveCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  const btn    = document.getElementById('btn-save-creator-validation');
  const payload = {};
  for (const [mode, md] of Object.entries(_cvData)) {
    const entry = {};
    if (md.required?.size) entry.required = [...md.required];
    const byCat = {};
    for (const [subcat, req] of Object.entries(md.byCategory || {})) {
      if (req.size) byCat[subcat] = { required: [...req] };
    }
    if (Object.keys(byCat).length) entry.byCategory = byCat;
    if (Object.keys(entry).length) payload[mode] = entry;
  }
  try {
    if (btn) btn.disabled = true;
    await setDoc(doc(db, 'config', 'data_quality_standards'), payload);
    if (status) { status.textContent = '✓ Sauvegardé'; status.style.color = 'var(--success)'; status.style.display = ''; }
    toast('✓ Champs requis sauvegardés', 'success');
    _cvDirty = false;
    if (btn) { btn.classList.remove('cv-save-dirty'); }
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── Data Incomplète ───────────────────────────────────
function _testImageUrl(url) {
  return new Promise(resolve => {
    if (!url || typeof url !== 'string' || url.startsWith('data:')) { resolve(true); return; }
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(false); }, 8000);
    img.onload  = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

function _normalizeUrlForModeration(url) {
  if (!url || typeof url !== 'string') return url;
  let u = url;
  while (u.startsWith('../')) u = u.slice(3);
  return u;
}

async function _checkBrokenImages(docs, onProgress) {
  const BATCH = 8;
  const broken = [];
  const entries = docs.map(d => {
    const urls = [];
    if (d.img   && typeof d.img   === 'string' && !d.img.startsWith('data:'))   urls.push(_normalizeUrlForModeration(d.img));
    if (d.image && typeof d.image === 'string' && !d.image.startsWith('data:')) urls.push(_normalizeUrlForModeration(d.image));
    if (Array.isArray(d.images)) d.images.forEach(u => { if (u && typeof u === 'string' && !u.startsWith('data:')) urls.push(_normalizeUrlForModeration(u)); });
    return { doc: d, urls };
  }).filter(e => e.urls.length > 0);

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ({ doc: d, urls }) => {
      const ok = await Promise.all(urls.map(_testImageUrl));
      const bad = urls.filter((_, j) => !ok[j]);
      if (bad.length) broken.push({ doc: d, brokenUrls: bad });
    }));
    done = Math.min(i + BATCH, entries.length);
    if (onProgress) onProgress(done, entries.length);
  }
  return broken;
}

// Charge tous les items à vérifier : publics + (admin) sensibles fusionnés.
// Les images d'un item sensible peuvent vivre dans items_hidden OU items_secret selon le split gameplay/secret.
async function _loadItemDocsForImageCheck() {
  const pub = await cachedDocs('items').catch(() => []);
  if (currentRole !== 'admin') return pub;
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const secretById = new Map(secret.map(s => [String(s.id), s]));
  const seen = new Set();
  const sensible = [];
  for (const h of hidden) {
    const s = h.id ? (secretById.get(String(h.id)) || {}) : {};
    sensible.push({ ...h, ...s, _docKey: h._docKey, _sensible: true });
    if (h.id) seen.add(String(h.id));
  }
  for (const s of secret) {
    if (!seen.has(String(s.id))) sensible.push({ ...s, _sensible: true });
  }
  return [...pub, ...sensible];
}

// Ouvre le bon éditeur pour un item public ou sensible depuis la liste "Tableau de chasse".
window._openItemForCompletion = async function(key, sensible, origin) {
  if (!sensible) { showEditor('items', key, null, origin || 'completion'); return; }
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const h = hidden.find(x => x._docKey === key);
  if (!h) { toast('⛔ Item sensible introuvable.', 'error'); return; }
  const s = h.id ? (secret.find(x => String(x._docKey) === String(h.id)) || {}) : {};
  const merged = {};
  for (const [k, v] of Object.entries(h)) { if (k !== '_docKey') merged[k] = v; }
  for (const [k, v] of Object.entries(s)) { if (k !== '_docKey') merged[k] = v; }
  showEditor('items_sensible', key, merged, origin || 'completion');
};

function _fieldEmpty(d, fieldId) {
  // L'évènement n'est requis que pour les items du palier Event
  if (fieldId === 'event') return d.palier === 'event' && !(typeof d.event === 'string' && d.event);
  if (fieldId === 'coords') return !d.coords || d.coords.x == null;
  // img et images sont interchangeables : si l'un est rempli, l'autre n'est pas manquant
  if (fieldId === 'img' || fieldId === 'images' || fieldId === 'image') {
    const hasImg    = d.img   != null && d.img   !== '';
    const hasImage  = d.image != null && d.image !== '';
    const hasImages = Array.isArray(d.images) && d.images.length > 0 && d.images.some(x => x != null && x !== '');
    return !hasImg && !hasImage && !hasImages;
  }
  const v = d[fieldId];
  if (v == null || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function _subcatLabel(mode, subcatId) {
  return (QUALITY_SUBCATEGORIES[mode] || []).find(s => s.id === subcatId)?.label || subcatId || null;
}

window.sensReload = async () => {
  document.getElementById('sens-loading').style.display = '';
  document.getElementById('sens-loading').textContent = 'Chargement…';
  document.getElementById('sens-content').style.display = 'none';
  try {
    const [ih, is, ip, ms, mp, ps, pp] = await Promise.all([
      getDocs(collection(db, COL.itemsHidden)),
      getDocs(collection(db, COL.itemsSecret)),
      getDocs(collection(db, COL.items)),
      getDocs(collection(db, COL.mobsSecret)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.pnjSecret)),
      getDocs(collection(db, COL.pnj)),
    ]);
    // Déduplication par champ 'id' : si deux docs ont le même item (ancienne clé + nameHash), garder le plus récent (nameHash)
    const _ihAll = ih.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    const _ihById = new Map();
    for (const item of _ihAll) {
      const key = String(item.id || item._id || '');
      const existing = _ihById.get(key);
      // Préférer le doc dont la clé est le nameHash (pas un id numérique)
      if (!existing || /^[0-9]+$/.test(existing._id)) _ihById.set(key, item);
    }
    _sensState.itemsHidden = [..._ihById.values()];
    _sensState.itemsSecretById = new Map(
      is.docs.map(d => [d.id, desanitizeFromFirestore({ _id: d.id, ...d.data() })])
    );
    _sensState.itemsPublic = ip.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsSecret = ms.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsPublic = mp.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.pnjSecret = ps.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.pnjPublic = pp.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));

    // Sort alphabétique pour confort
    const byName = (a, b) => normalize(a.name || a._id).localeCompare(normalize(b.name || b._id), 'fr');
    _sensState.itemsHidden.sort(byName);
    _sensState.itemsPublic.sort(byName);
    _sensState.mobsSecret.sort(byName);
    _sensState.mobsPublic.sort(byName);
    _sensState.pnjSecret.sort(byName);
    _sensState.pnjPublic.sort(byName);

    _sensRenderAll();
    document.getElementById('sens-loading').style.display = 'none';
    document.getElementById('sens-content').style.display = '';
  } catch (err) {
    document.getElementById('sens-loading').textContent = 'Erreur : ' + err.message;
    console.error(err);
  }
};

function _sensRenderAll() {
  _sensRenderItemsHidden();
  _sensRenderItemsPublic();
  _sensRenderMobsHidden();
  _sensRenderMobsPublic();
  _sensRenderPnjHidden();
  _sensRenderPnjPublic();
}

// ─── Rendu ───────────────────────────────────────────────

function _sensItemRow(item, btnHtml) {
  const id = _sensEsc(item.id || item._id);
  const name = _sensEsc(item.name || item._id);
  const rar  = _sensEsc(item.rarity || '—');
  const pal  = item.palier != null ? 'P' + _sensEsc(item.palier) : '—';
  const lvl  = item.lvl != null ? 'lvl ' + _sensEsc(item.lvl) : '';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${rar} · ${pal} ${lvl}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensMobRow(mob, btnHtml) {
  const id = _sensEsc(mob.id || mob._id);
  const name = _sensEsc(mob.name || mob._id);
  const type = _sensEsc(mob.type || '—');
  const pal  = mob.palier != null ? 'P' + _sensEsc(mob.palier) : '—';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${type} · ${pal}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensRenderItemsHidden() {
  const list = _sensState.itemsHidden;
  document.getElementById('sens-items-hidden-count').textContent = list.length + ' item(s)';
  const el = document.getElementById('sens-items-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun item sensible.</div>';
    return;
  }
  el.innerHTML = list.map(item => {
    const h = _sensEsc(item._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditItem('${h}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensItemToPublic('${h}')" style="font-size:11px;padding:3px 10px;">🔓 Public</button>`;
    return _sensItemRow(item, btns);
  }).join('');
}

window.sensEditItem = async function(hashId) {
  const hidden = _sensState.itemsHidden.find(x => x._id === hashId);
  if (!hidden) return;
  const secret = hidden.id ? (_sensState.itemsSecretById.get(String(hidden.id)) || {}) : {};
  // Fusionner hidden + secret en un seul objet éditable (sans méta _id)
  const merged = {};
  for (const [k, v] of Object.entries(hidden))  { if (k !== '_id') merged[k] = v; }
  for (const [k, v] of Object.entries(secret))  { if (k !== '_id') merged[k] = v; }
  await showEditor('items_sensible', hashId, merged, 'migration');
};

window.sensEditMob = async function(mobId) {
  const mob = _sensState.mobsSecret.find(x => x._id === mobId);
  if (!mob) return;
  const data = {};
  for (const [k, v] of Object.entries(mob)) { if (k !== '_id') data[k] = v; }
  await showEditor('mobs_secret', mobId, data, 'migration');
};

window.sensEditPnj = async function(pnjId) {
  const pnj = _sensState.pnjSecret.find(x => x._id === pnjId);
  if (!pnj) return;
  const data = {};
  for (const [k, v] of Object.entries(pnj)) { if (k !== '_id') data[k] = v; }
  await showEditor('pnj_secret', pnjId, data, 'migration');
};

function _sensRenderItemsPublic() {
  const list = _sensState.itemsPublic;
  document.getElementById('sens-items-public-count').textContent = list.length + ' item(s)';
  window.sensFilterItemsPublic();
}

window.sensFilterItemsPublic = function() {
  const q = normalize(document.getElementById('sens-items-search').value.trim());
  const el = document.getElementById('sens-items-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.itemsPublic.filter(item =>
    normalize(item.name || '').includes(q) || normalize(item._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(item => {
    const btn = `<button class="btn btn-ghost" onclick="sensItemToSensible('${_sensEsc(item._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensItemRow(item, btn);
  }).join('');
};

function _sensRenderMobsHidden() {
  const list = _sensState.mobsSecret;
  document.getElementById('sens-mobs-hidden-count').textContent = list.length + ' mob(s)';
  const el = document.getElementById('sens-mobs-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun mob sensible.</div>';
    return;
  }
  el.innerHTML = list.map(mob => {
    const id = _sensEsc(mob._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditMob('${id}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensMobToPublic('${id}')" style="font-size:11px;padding:3px 10px;">🔓 Rendre public</button>`;
    return _sensMobRow(mob, btns);
  }).join('');
}

function _sensRenderMobsPublic() {
  const list = _sensState.mobsPublic;
  document.getElementById('sens-mobs-public-count').textContent = list.length + ' mob(s)';
  window.sensFilterMobsPublic();
}

window.sensFilterMobsPublic = function() {
  const q = normalize(document.getElementById('sens-mobs-search').value.trim());
  const el = document.getElementById('sens-mobs-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.mobsPublic.filter(mob =>
    normalize(mob.name || '').includes(q) || normalize(mob._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(mob => {
    const btn = `<button class="btn btn-ghost" onclick="sensMobToSensible('${_sensEsc(mob._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensMobRow(mob, btn);
  }).join('');
};

// ─── Toggles ─────────────────────────────────────────────

// Item public → sensible : split gameplay/secret + hash + cibles + delete source
window.sensItemToSensible = async (sourceId) => {
  const item = _sensState.itemsPublic.find(x => x._id === sourceId);
  if (!item) { toast('Item introuvable.', 'info'); return; }
  if (!item.name) { toast('Item sans name, impossible de hasher.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${item.name}" sensible ?\n\nIl disparaîtra des pages publiques et ne sera accessible via l'atelier qu'en tapant son nom exact.`)) return;
  try {
    const gameplayKeys = await getItemGameplayKeys();
    const allKeys = Object.keys(item).filter(k => k !== '_id');
    const gameplay = {};
    for (const k of allKeys) if (gameplayKeys.includes(k)) gameplay[k] = item[k];
    const secret = {};
    for (const k of allKeys) if (!gameplayKeys.includes(k) && k !== 'sensible') secret[k] = item[k];

    const hash = await hashName(item.name);
    if (!hash) throw new Error('hash vide');

    await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore({ ...gameplay, sensible: true }));
    if (Object.keys(secret).length) {
      await setDoc(doc(db, COL.itemsSecret, sourceId), sanitizeForFirestore({ ...secret, sensible: true }));
    }
    await deleteDoc(doc(db, COL.items, sourceId));

    store.invalidate('items');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Item sensible → public : merge hidden+secret, write to items, delete cibles
window.sensItemToPublic = async (hashId) => {
  const hidden = _sensState.itemsHidden.find(x => x._id === hashId);
  if (!hidden) { toast('Hidden item introuvable.', 'info'); return; }
  const origId = hidden.id;
  if (!origId) { toast('Hidden item sans champ id — impossible de déterminer l\'id cible.', 'error'); return; }
  if (!await modal.confirm(`Rendre "${hidden.name || origId}" public ?\n\nIl redeviendra visible dans le compendium et l'atelier normalement.`)) return;
  try {
    const secret = _sensState.itemsSecretById.get(origId) || null;
    // Merge : gameplay d'abord (source de vérité pour stats), puis secret (flavor)
    const merged = {};
    for (const [k, v] of Object.entries(hidden)) if (k !== '_id') merged[k] = v;
    if (secret) {
      for (const [k, v] of Object.entries(secret)) if (k !== '_id') merged[k] = v;
    }
    // Recalcul de l'image depuis la formule (on ne la stocke pas dans hidden)
    const _sensImg = _sensComputeImg(merged.category, merged.id, merged.palier, merged.event);
    merged.images = _sensImg ? [_sensImg] : [];
    delete merged.img;
    // Pas de flag sensible dans le doc public
    delete merged.sensible;

    await setDoc(doc(db, COL.items, origId), sanitizeForFirestore(merged));
    await deleteDoc(doc(db, COL.itemsHidden, hashId));
    if (secret) {
      await deleteDoc(doc(db, COL.itemsSecret, origId));
    }

    store.invalidate('items');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Mob public → sensible : doc entier vers mobs_secret
window.sensMobToSensible = async (sourceId) => {
  const mob = _sensState.mobsPublic.find(x => x._id === sourceId);
  if (!mob) { toast('Mob introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${mob.name || sourceId}" sensible ?\n\nIl disparaîtra complètement des pages publiques.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(mob)) if (k !== '_id') payload[k] = v;
    payload.sensible = true;

    await setDoc(doc(db, COL.mobsSecret, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.mobs, sourceId));

    store.invalidate('mobs');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Mob sensible → public : doc entier vers mobs
window.sensMobToPublic = async (sourceId) => {
  const mob = _sensState.mobsSecret.find(x => x._id === sourceId);
  if (!mob) { toast('Mob sensible introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${mob.name || sourceId}" public ?\n\nIl redeviendra visible dans le bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(mob)) if (k !== '_id') payload[k] = v;
    delete payload.sensible;

    await setDoc(doc(db, COL.mobs, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.mobsSecret, sourceId));

    store.invalidate('mobs');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

function _sensPnjRow(pnj, btnHtml) {
  const id  = _sensEsc(pnj.id || pnj._id);
  const name = _sensEsc(pnj.name || pnj._id);
  const type = _sensEsc(pnj.type || pnj.tag || '—');
  const pal  = pnj.palier != null ? 'P' + _sensEsc(pnj.palier) : '—';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${type} · ${pal}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensRenderPnjHidden() {
  const list = _sensState.pnjSecret;
  document.getElementById('sens-pnj-hidden-count').textContent = list.length + ' PNJ';
  const el = document.getElementById('sens-pnj-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun PNJ sensible.</div>';
    return;
  }
  el.innerHTML = list.map(pnj => {
    const id = _sensEsc(pnj._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditPnj('${id}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensPnjToPublic('${id}')" style="font-size:11px;padding:3px 10px;">🔓 Rendre public</button>`;
    return _sensPnjRow(pnj, btns);
  }).join('');
}

function _sensRenderPnjPublic() {
  const list = _sensState.pnjPublic;
  document.getElementById('sens-pnj-public-count').textContent = list.length + ' PNJ';
  window.sensFilterPnjPublic();
}

window.sensFilterPnjPublic = function() {
  const q = normalize(document.getElementById('sens-pnj-search').value.trim());
  const el = document.getElementById('sens-pnj-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.pnjPublic.filter(pnj =>
    normalize(pnj.name || '').includes(q) || normalize(pnj._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(pnj => {
    const btn = `<button class="btn btn-ghost" onclick="sensPnjToSensible('${_sensEsc(pnj._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensPnjRow(pnj, btn);
  }).join('');
};

// PNJ public → sensible : doc entier vers pnj_secret
window.sensPnjToSensible = async (sourceId) => {
  const pnj = _sensState.pnjPublic.find(x => x._id === sourceId);
  if (!pnj) { toast('PNJ introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${pnj.name || sourceId}" sensible ?\n\nIl disparaîtra complètement du bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(pnj)) if (k !== '_id') payload[k] = v;
    payload.sensible = true;

    await setDoc(doc(db, COL.pnjSecret, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.pnj, sourceId));

    store.invalidate('pnj');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// PNJ sensible → public : doc entier vers personnages
window.sensPnjToPublic = async (sourceId) => {
  const pnj = _sensState.pnjSecret.find(x => x._id === sourceId);
  if (!pnj) { toast('PNJ sensible introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${pnj.name || sourceId}" public ?\n\nIl redeviendra visible dans le bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(pnj)) if (k !== '_id') payload[k] = v;
    delete payload.sensible;

    await setDoc(doc(db, COL.pnj, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.pnjSecret, sourceId));

    store.invalidate('pnj');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

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

// ══════════════════════════════════════════════════════
// OUTIL IMAGES
// ══════════════════════════════════════════════════════
let _imgConfig = null; // { token, repo, branch, templates }
let _imgSelectedItem = null;
let _imgFile = null;
let _imgResize = 256;
let _imgActiveTab = 'upload';

// Templates de référence — format web (préfixe ../ requis pour les pages en sous-dossier).
// L'upload GitHub strip le ../ avant d'envoyer au repo.
const IMG_DEFAULT_TEMPLATES = {
  arme:        '../img/compendium/textures/weapons/{tier}/{id}.png',
  armure:      '../img/compendium/textures/armors/{tier}/{id}.png',
  accessoire:  '../img/compendium/textures/trinkets/{tier}/{id}.png',
  outils:      '../img/compendium/textures/gears/{tier}/{id}.png',
  materiaux:   '../img/compendium/textures/items/Material/{tier}/{id}.png',
  ressources:  '../img/compendium/textures/items/Ressources/{tier}/{id}.png',
  consommable: '../img/compendium/textures/items/Consommable/{tier}/{id}.png',
  nourriture:  '../img/compendium/textures/items/Nourriture/{tier}/{id}.png',
  rune:        '../img/compendium/textures/items/Runes/{tier}/{id}.png',
  parchemin:   '../img/compendium/textures/items/Parchemins/{tier}/{id}.png',
  quete:       '../img/compendium/textures/items/Quest/{tier}/{id}.png',
  donjon:      '../img/compendium/textures/items/Donjon/{tier}/{id}.png',
  monnaie:     '../img/compendium/textures/items/Monnaie/{tier}/{id}.png',
};

function _imgResizeToCanvas(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

function _imgComputePath(item) {
  const tpl = _imgConfig?.templates?.[item.category] || IMG_DEFAULT_TEMPLATES[item.category];
  if (!tpl) return null;
  const tier = (item.event || (item.palier === 0 || item.palier === 'event')) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  return tpl
    .replace(/\{tier\}\//g, tp)    // "{tier}/" → "P1/" ou "" (évite le double slash)
    .replace(/\{tier\}/g,   tier)  // "{tier}" seul → "P1" ou ""
    .replace(/\{id\}/g,     item.id || '')
    .replace(/\{palier\}/g, item.palier ?? '')
    .replace(/\{cat\}/g,    item.cat || '');
}

window.showImagesTool = async function() {
  _setHash('images');
  _showPanel('images-tool-panel', 'btn-images-tool');
  await loadImagesTool();
};

window.loadImagesTool = async function() {
  try {
    const snap = await getDoc(doc(db, 'config', 'image_paths'));
    _imgConfig = snap.exists() ? snap.data() : {};
    if (!_imgConfig.templates) _imgConfig.templates = { ...IMG_DEFAULT_TEMPLATES };
    // Migrer les vieux templates (sans ../ ou avec le bug P{palier}')
    for (const [cat, def] of Object.entries(IMG_DEFAULT_TEMPLATES)) {
      const tpl = _imgConfig.templates[cat];
      if (!tpl || !tpl.startsWith('../') || tpl.includes("'")) {
        _imgConfig.templates[cat] = def;
      }
    }
    // Remplir les champs config
    const t = document.getElementById('img-config-token');
    const r = document.getElementById('img-config-repo');
    const b = document.getElementById('img-config-branch');
    if (t) t.value = _imgConfig.token || '';
    if (r) r.value = _imgConfig.repo  || '';
    if (b) b.value = _imgConfig.branch || 'main';
    const s = document.getElementById('img-config-resize');
    if (s) s.value = _imgConfig.resizeSize ?? 256;
    _imgResize = _imgConfig.resizeSize ?? 256;
    _renderImgTemplates();
    _buildImgItemSearch();
  } catch(e) {
    toast('⛔ Erreur chargement config images : ' + e.message, 'error');
  }
};

window.saveImagesConfig = async function() {
  const token      = document.getElementById('img-config-token')?.value?.trim() || '';
  const repo       = document.getElementById('img-config-repo')?.value?.trim()  || '';
  const branch     = document.getElementById('img-config-branch')?.value?.trim() || 'main';
  const resizeSize = parseInt(document.getElementById('img-config-resize')?.value || '256', 10) || 256;
  // Collecter les templates
  const templates = {};
  document.querySelectorAll('.img-tpl-input').forEach(inp => {
    const cat = inp.dataset.cat;
    if (cat) templates[cat] = inp.value.trim() || IMG_DEFAULT_TEMPLATES[cat];
  });
  _imgConfig = { ..._imgConfig, token, repo, branch, templates, resizeSize };
  _imgResize = resizeSize;
  try {
    await setDoc(doc(db, 'config', 'image_paths'), _imgConfig);
    toast('✓ Config images sauvegardée', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

function _renderImgTemplates() {
  const listEl = document.getElementById('img-templates-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  const cats = Object.keys(IMG_DEFAULT_TEMPLATES);
  for (const cat of cats) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    row.innerHTML = `
      <span style="font-size:12px;min-width:90px;flex-shrink:0;color:var(--text);">${cat}</span>
      <input type="text" class="img-tpl-input" data-cat="${cat}"
        value="${escHtml(_imgConfig?.templates?.[cat] || IMG_DEFAULT_TEMPLATES[cat])}"
        style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:11px;font-family:monospace;outline:none;">
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0;" onclick="this.previousElementSibling.value='${IMG_DEFAULT_TEMPLATES[cat].replace(/'/g,"\\'")}'">↺</button>
    `;
    listEl.appendChild(row);
  }
}

let _imgAllItems = [];

function _buildImgItemSearch() {
  const wrap = document.getElementById('img-item-search-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="font-size:11px;color:var(--muted);">Chargement…</div>';
  Promise.all([
    cachedDocs(COL.items),
    cachedDocs(COL.itemsHidden).catch(() => []),
  ]).then(([docs, hidden]) => {
    _imgAllItems = [
      ...docs.map(d => ({ ...d })),
      ...hidden.map(d => ({ ...d, sensible: true })),
    ];
    wrap.innerHTML = '';
    const inp = document.createElement('input');
    inp.type = 'search'; inp.placeholder = '🔍 Rechercher un item…';
    inp.style.cssText = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 10px;font-size:13px;outline:none;';
    const list = document.createElement('div');
    list.style.cssText = 'max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;display:none;margin-top:2px;';
    wrap.appendChild(inp); wrap.appendChild(list);

    const renderList = (q) => {
      const norm = window.VCL.normalize(q);
      const hits = _imgAllItems.filter(d =>
        window.VCL.fuzzyMatch(norm, d.name||'') || window.VCL.fuzzyMatch(norm, d.id||'')
      ).slice(0, 30);
      list.innerHTML = '';
      if (!hits.length) { list.style.display = 'none'; return; }
      list.style.display = '';
      hits.forEach(d => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);';
        row.innerHTML = `<b>${escHtml(d.name||d.id)}</b> <span style="font-size:10px;color:var(--muted);">${d.category||''} ${d.palier?'P'+d.palier:''} ${d.sensible?'🔒':''}</span>`;
        row.addEventListener('mousedown', e => { e.preventDefault(); inp.value = d.name||d.id; list.style.display='none'; _imgSelectItem(d); });
        list.appendChild(row);
      });
    };
    inp.addEventListener('input', () => renderList(inp.value.trim()));
    inp.addEventListener('focus', () => { if (inp.value.trim()) renderList(inp.value.trim()); });
    inp.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; }, 200));
  }).catch(() => { wrap.innerHTML = '<div style="font-size:11px;color:var(--danger);">Erreur chargement items</div>'; });
}

function _imgSelectItem(item) {
  _imgSelectedItem = item;
  const infoEl = document.getElementById('img-item-info');
  const detailEl = document.getElementById('img-item-detail');
  const pathEl  = document.getElementById('img-computed-path');
  const uploadBtn = document.getElementById('img-upload-btn');
  if (!item) {
    if (infoEl) infoEl.style.display = 'none';
    if (uploadBtn) uploadBtn.disabled = true;
    return;
  }
  if (detailEl) detailEl.innerHTML = `<b>${escHtml(item.name || item.id)}</b> · <code>${item.id}</code> · ${item.category || '?'} · ${item.palier ? 'P'+item.palier : '—'}`;
  const path = _imgComputePath(item);
  if (pathEl) pathEl.textContent = path || '(pas de template pour cette catégorie)';
  if (infoEl) infoEl.style.display = '';
  if (uploadBtn) uploadBtn.disabled = !_imgFile || !path;
}

window.imgFileDrop = function(e) {
  e.preventDefault();
  const zone = document.getElementById('img-drop-zone');
  if (zone) zone.style.borderColor = 'var(--border)';
  const file = e.dataTransfer?.files?.[0];
  if (file) _imgSetFile(file);
};

window.imgFileSelect = function(file) { if (file) _imgSetFile(file); };

function _imgSetFile(file) {
  if (!file.type.startsWith('image/')) { toast('⚠️ Fichier image uniquement', 'warning'); return; }
  const size = _imgResize || 256;
  const preview = document.getElementById('img-drop-preview');
  const placeholder = document.getElementById('img-drop-placeholder');
  const sizeInfo = document.getElementById('img-resize-info');
  if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = ''; }
  if (placeholder) placeholder.style.display = 'none';
  if (sizeInfo) { sizeInfo.textContent = '⏳ Redimensionnement…'; sizeInfo.style.color = 'var(--muted)'; }
  _imgResizeToCanvas(file, size).then(blob => {
    _imgFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
    if (preview) preview.src = URL.createObjectURL(blob);
    if (sizeInfo) { sizeInfo.textContent = `✓ Redimensionné : ${size}×${size} px`; sizeInfo.style.color = 'var(--success)'; }
    const uploadBtn = document.getElementById('img-upload-btn');
    if (uploadBtn) uploadBtn.disabled = !_imgSelectedItem || !_imgComputePath(_imgSelectedItem);
  }).catch(() => {
    _imgFile = file;
    if (sizeInfo) { sizeInfo.textContent = '⚠️ Redimensionnement échoué'; sizeInfo.style.color = 'var(--warn)'; }
    const uploadBtn = document.getElementById('img-upload-btn');
    if (uploadBtn) uploadBtn.disabled = !_imgSelectedItem || !_imgComputePath(_imgSelectedItem);
  });
}

window.imgUploadToGithub = async function() {
  if (!_imgSelectedItem || !_imgFile) return;
  const path = _imgComputePath(_imgSelectedItem);
  if (!path) { toast('⚠️ Pas de template configuré pour cette catégorie', 'warning'); return; }
  const token  = _imgConfig?.token  || '';
  const repo   = _imgConfig?.repo   || '';
  const branch = _imgConfig?.branch || 'main';
  if (!token || !repo) { toast('⚠️ Configure le token GitHub et le repo dans l\'onglet Config', 'warning'); switchImgTab('config'); return; }

  const btn    = document.getElementById('img-upload-btn');
  const status = document.getElementById('img-upload-status');
  btn.disabled = true; btn.textContent = '⏳ Envoi…';
  if (status) status.textContent = '';

  try {
    // Lire le fichier en base64
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(_imgFile);
    });

    // _imgComputePath retourne un path web (../img/...) ; GitHub attend un path repo (img/...)
    const githubPath = path.replace(/^(\.\.\/)+/, '');
    // Vérifier si le fichier existe déjà (pour récupérer son SHA)
    const apiBase = `https://api.github.com/repos/${repo}/contents/${githubPath}`;
    let sha = null;
    try {
      const existing = await fetch(apiBase + `?ref=${branch}`, { headers: { Authorization: `token ${token}` } });
      if (existing.ok) { const j = await existing.json(); sha = j.sha; }
    } catch {}

    const body = { message: `🖼️ Image : ${_imgSelectedItem.name || _imgSelectedItem.id}`, content: base64, branch };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: String(resp.status) }));
      const msg = resp.status === 404
        ? 'Repo introuvable ou accès refusé — vérifiez le repo et le token dans Config'
        : (err.message || String(resp.status));
      throw new Error(msg);
    }

    // Mettre à jour le champ images dans Firestore
    if (_imgSelectedItem.sensible) {
      // items_hidden keyé par nameHash — mettre à jour pour que non-contribs voient l'image
      const imgHash = await hashName(_imgSelectedItem.name || '').catch(() => '');
      if (imgHash) try { await updateDoc(doc(db, COL.itemsHidden, imgHash), { images: [path] }); } catch {}
      // Aussi dans items_secret (keyé par item.id) pour les contribs
      const secretId = String(_imgSelectedItem.id || _imgSelectedItem._id || '');
      if (secretId) try { await updateDoc(doc(db, COL.itemsSecret, secretId), { images: [path] }); } catch {}
    } else {
      const docId = String(_imgSelectedItem.id || '');
      if (docId) try { await updateDoc(doc(db, COL.items, docId), { images: [path] }); } catch {}
    }

    if (status) { status.textContent = `✓ Envoyé : ${path}`; status.style.color = 'var(--success)'; }
    toast(`✓ Image envoyée sur GitHub : ${path}`, 'success');
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
    toast('⛔ Erreur upload : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📤 Envoyer sur GitHub';
  }
};

window.resetImagesTool = async function() {
  _imgSelectedItem = null;
  _imgFile = null;
  const preview     = document.getElementById('img-drop-preview');
  const placeholder = document.getElementById('img-drop-placeholder');
  const sizeInfo    = document.getElementById('img-resize-info');
  const itemInfo    = document.getElementById('img-item-info');
  const fileInput   = document.getElementById('img-file-input');
  if (preview)     { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (sizeInfo)    sizeInfo.textContent = '';
  if (itemInfo)    itemInfo.style.display = 'none';
  if (fileInput)   fileInput.value = '';
  const uploadBtn = document.getElementById('img-upload-btn');
  if (uploadBtn)   uploadBtn.disabled = true;
  const status = document.getElementById('img-upload-status');
  if (status)      status.textContent = '';
  switchImgTab('upload');
  await loadImagesTool();
};

window.switchImgTab = function(name) {
  _imgActiveTab = name;
  const tabs = ['upload', 'textures', 'config'];
  for (const t of tabs) {
    const panel = document.getElementById(`img-tab-${t}`);
    const btn   = document.getElementById(`img-tab-btn-${t}`);
    if (!panel || !btn) continue;
    const active = t === name;
    panel.style.display = active ? '' : 'none';
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
  }
};

// ── Lightbox ──────────────────────────────────────────────────────────────────

let _lbScale = 1, _lbTx = 0, _lbTy = 0;
let _lbDrag = false, _lbDragX = 0, _lbDragY = 0;
let _lbUseCanvas = false;
let _lbSpriteInterval = null, _lbSpriteFrame = 0, _lbSpriteFrames = 0;
let _lbSpriteW = 0, _lbSpriteH = 0, _lbSpriteVert = true, _lbSpriteImg = null;

function _lbActiveEl() {
  return document.getElementById(_lbUseCanvas ? 'tpk-lb-canvas' : 'tpk-lb-img');
}
function _lbSetCursor(c) {
  const img = document.getElementById('tpk-lb-img');
  const cvs = document.getElementById('tpk-lb-canvas');
  if (img) img.style.cursor = c;
  if (cvs) cvs.style.cursor = c;
}


// ── Dessin face avant skin (partagé lightbox + thumbnails) ───────────────────
// Dessine la face avant du personnage dans cvs (adapté à toute taille de canvas)
function _drawSkinFront(img, cvs, W, H) {
  const CW = cvs.width, CH = cvs.height;
  const sc = Math.min(CW / 16, CH / 32);
  const ox = ((CW - 16 * sc) / 2) | 0;
  const oy = ((CH - 32 * sc) / 2) | 0;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const b = (sx,sy,sw,sh,dx,dy) =>
    ctx.drawImage(img, sx, sy, sw, sh, ox+dx*sc, oy+dy*sc, sw*sc, sh*sc);
  const bf = (sx,sy,sw,sh,dx,dy) => {
    ctx.save();
    ctx.translate(ox+(dx+sw)*sc, oy+dy*sc);
    ctx.scale(-1,1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw*sc, sh*sc);
    ctx.restore();
  };
  b(8,8,8,8,4,0); b(20,20,8,12,4,8); b(44,20,4,12,0,8); b(4,20,4,12,4,20);
  if (H >= 64) { b(36,52,4,12,12,8); b(20,52,4,12,8,20); }
  else         { bf(44,20,4,12,12,8); bf(4,20,4,12,8,20); }
  b(40,8,8,8,4,0); b(20,36,8,12,4,8); b(44,36,4,12,0,8); b(4,36,4,12,4,20);
  if (H >= 64) { b(52,52,4,12,12,8); b(4,52,4,12,8,20); }
}

function _lbDrawSkin(img, cvs, W, H) {
  cvs.width = 128; cvs.height = 256; // 8× scale for lightbox
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#18181f';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  _drawSkinFront(img, cvs, W, H);
}

function _lbDrawSpriteFrame() {
  const cvs = document.getElementById('tpk-lb-canvas');
  if (!cvs || !_lbSpriteImg) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (_lbSpriteVert) {
    ctx.drawImage(_lbSpriteImg, 0, _lbSpriteFrame * _lbSpriteH, _lbSpriteW, _lbSpriteH, 0, 0, _lbSpriteW, _lbSpriteH);
  } else {
    ctx.drawImage(_lbSpriteImg, _lbSpriteFrame * _lbSpriteW, 0, _lbSpriteW, _lbSpriteH, 0, 0, _lbSpriteW, _lbSpriteH);
  }
}

// fullPath optionnel — chemin ZIP ou GitHub complet, utilisé pour détecter les skins
window.tpkOpenLightbox = function(url, name, fullPath) {
  const lb    = document.getElementById('tpk-lightbox');
  const img   = document.getElementById('tpk-lb-img');
  const cvs   = document.getElementById('tpk-lb-canvas');
  const nm    = document.getElementById('tpk-lb-name');
  const badge = document.getElementById('tpk-lb-badge');
  if (!lb || !img) return;
  _lbTx = 0; _lbTy = 0; _lbScale = 1; _lbUseCanvas = false;
  if (_lbSpriteInterval) { clearInterval(_lbSpriteInterval); _lbSpriteInterval = null; }
  img.style.display = ''; if (cvs) cvs.style.display = 'none';
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
  img.src = '';
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    const isVertStrip  = H >= W * 2 && H % W === 0;
    const isHorizStrip = W >= H * 2 && W % H === 0;
    // Skin MC : 64×64 ou 64×32 ET chemin contient un indicateur connu
    const pathLow = (fullPath || name || '').toLowerCase();
    const isSkin = W === 64 && (H === 64 || H === 32)
      && /skin|player|steve|alex|char(?:_|$)|humanoid|entity\/player/.test(pathLow);
    if (isSkin && cvs) {
      _lbUseCanvas = true;
      img.style.display = 'none';
      _lbDrawSkin(img, cvs, W, H);
      cvs.style.display = '';
      if (badge) { badge.textContent = `🧑 Skin MC (${W}×${H})`; badge.style.display = ''; }
    } else if ((isVertStrip || isHorizStrip) && cvs) {
      _lbUseCanvas = true;
      img.style.display = 'none';
      _lbSpriteImg = img;
      _lbSpriteVert = isVertStrip;
      if (isVertStrip) { _lbSpriteW = W; _lbSpriteH = W; _lbSpriteFrames = H / W; }
      else             { _lbSpriteW = H; _lbSpriteH = H; _lbSpriteFrames = W / H; }
      _lbSpriteFrame = 0;
      cvs.width = _lbSpriteW; cvs.height = _lbSpriteH;
      cvs.style.display = '';
      _lbDrawSpriteFrame();
      _lbSpriteInterval = setInterval(() => {
        _lbSpriteFrame = (_lbSpriteFrame + 1) % _lbSpriteFrames;
        _lbDrawSpriteFrame();
      }, 80);
      if (badge) { badge.textContent = `🎞️ Spritesheet — ${_lbSpriteFrames} frames`; badge.style.display = ''; }
    }
    const ew = _lbUseCanvas ? (cvs?.width  || W) : W;
    const eh = _lbUseCanvas ? (cvs?.height || H) : H;
    const fit = Math.min(window.innerWidth, window.innerHeight) * 0.65;
    _lbScale = Math.max(1, Math.round(fit / Math.max(ew, eh)));
    _lbUpdate();
  };
  img.src = url;
  if (nm) nm.textContent = name || '';
  lb.style.display = '';
};

window.tpkLbClose = function() {
  const lb = document.getElementById('tpk-lightbox');
  if (lb) lb.style.display = 'none';
  if (_lbSpriteInterval) { clearInterval(_lbSpriteInterval); _lbSpriteInterval = null; }
};

window.tpkLbBgDown = function(e) {
  if (e.target === document.getElementById('tpk-lightbox') ||
      e.target === document.getElementById('tpk-lb-wrap')) tpkLbClose();
};

function _lbUpdate() {
  const el = _lbActiveEl();
  if (el) el.style.transform = `translate(calc(-50% + ${_lbTx}px), calc(-50% + ${_lbTy}px)) scale(${_lbScale})`;
}

// Drag
document.addEventListener('mousedown', e => {
  const el = _lbActiveEl();
  if (e.target !== el) return;
  _lbDrag = true;
  _lbDragX = e.clientX - _lbTx;
  _lbDragY = e.clientY - _lbTy;
  _lbSetCursor('grabbing');
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!_lbDrag) return;
  _lbTx = e.clientX - _lbDragX;
  _lbTy = e.clientY - _lbDragY;
  _lbUpdate();
});
document.addEventListener('mouseup', () => {
  if (_lbDrag) {
    _lbDrag = false;
    _lbSetCursor('grab');
  }
});

// Zoom molette (centré sur le curseur)
document.addEventListener('wheel', e => {
  const lb = document.getElementById('tpk-lightbox');
  if (!lb || lb.style.display === 'none') return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const prevScale = _lbScale;
  _lbScale = Math.max(0.25, Math.min(40, _lbScale * factor));
  // Ajuster la translation pour zoomer vers le curseur
  const wrap = document.getElementById('tpk-lb-wrap');
  if (wrap) {
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width  / 2;
    const cy = e.clientY - rect.top  - rect.height / 2;
    _lbTx += cx * (1 - _lbScale / prevScale);
    _lbTy += cy * (1 - _lbScale / prevScale);
  }
  _lbUpdate();
}, { passive: false });

// ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('tpk-lightbox');
    if (lb && lb.style.display !== 'none') tpkLbClose();
  }
});

// ── Texture Pack ──────────────────────────────────────────────────────────────

const TPK_REF_KEY        = 'tpk_reference_filenames';
const TPK_LINKS_KEY      = 'tpk_manual_links';
const TPK_VFOLDERS_KEY   = 'vcl_tpk_vfolders';
const TPK_VFLIST_KEY     = 'vcl_tpk_vfolder_list';
const TPK_PAGE           = 60;

let _tpkFiles     = []; // { path, basename, url, isNew, githubPath, matchType }
let _tpkGhFiles   = []; // all github image paths (sorted)
let _tpkGhMap     = new Map(); // lowercase basename → github path (last wins, kept for compat)
let _tpkGhMapAll  = new Map(); // lowercase basename → [github path, ...] (all matches)
let _tpkGhSha     = new Map(); // github path → sha (for blob API)
let _tpkGhInverse = new Map(); // github path → { url, matchType, tpkFile }
let _tpkManual    = new Map(); // tpk path → github path (manual links)
let _tpkLinkSrc   = null;     // tpk file being linked
let _tpkLeftVis   = [];
let _tpkLeftPage  = 0;        // index (pas page) dans _tpkLeftVis
let _tpkFolders   = {};       // folderPath → collapsed bool (panel droit)
let _tpkLeftFolders = {};     // folderPath → collapsed bool (panel gauche)
let _tpkVFolders    = {};     // basename → virtual folder name
let _tpkVFolderList = [];     // ordered list of virtual folder names (always includes 'inutile', 'illisible')
const TPK_PERMANENT = ['inutile', 'illisible'];
function _tpkVFolderIcon(name) { return name === 'inutile' ? '🚫' : name === 'illisible' ? '❓' : '📁'; }
let _tpkVFCollapsed = {};     // virtual folder name → collapsed bool
let _tpkModelMap    = {};     // basename → 'block3d' (has 3D model)
let _tpkSelected    = new Set(); // basenames selected for bulk action

// ── Persistance liens manuels ────────────────────────────────────────────────

function _tpkLoadManual() {
  try {
    const raw = JSON.parse(localStorage.getItem(TPK_LINKS_KEY) || '{}');
    _tpkManual = new Map();
    for (const [k, v] of Object.entries(raw)) {
      // Normalise les anciennes clés (full path) vers basename
      const base = k.includes('/') ? k.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase() : k;
      if (!_tpkManual.has(base)) _tpkManual.set(base, v);
    }
  } catch { _tpkManual = new Map(); }
}
function _tpkSaveManual() {
  localStorage.setItem(TPK_LINKS_KEY, JSON.stringify(Object.fromEntries(_tpkManual)));
}

function _tpkLoadVFolders() {
  try {
    _tpkVFolders = JSON.parse(localStorage.getItem(TPK_VFOLDERS_KEY) || '{}');
    const raw = JSON.parse(localStorage.getItem(TPK_VFLIST_KEY) || '[]');
    _tpkVFolderList = Array.isArray(raw) ? raw : [];
    for (const p of [...TPK_PERMANENT].reverse()) {
      if (!_tpkVFolderList.includes(p)) _tpkVFolderList.unshift(p);
    }
  } catch { _tpkVFolders = {}; _tpkVFolderList = [...TPK_PERMANENT]; }
}
function _tpkSaveVFolders() {
  localStorage.setItem(TPK_VFOLDERS_KEY, JSON.stringify(_tpkVFolders));
  localStorage.setItem(TPK_VFLIST_KEY, JSON.stringify(_tpkVFolderList));
}

// ── Chargement ZIP ───────────────────────────────────────────────────────────

window.tpkLoadZip = async function(file) {
  if (!file) return;
  const statsEl = document.getElementById('tpk-stats');
  if (statsEl) statsEl.textContent = '⏳ Lecture du ZIP…';
  _tpkLinkSrc = null;
  _tpkLoadManual();
  _tpkLoadVFolders();
  try {
    if (typeof JSZip === 'undefined') await _loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip  = await JSZip.loadAsync(file);
    const ref  = new Set(JSON.parse(localStorage.getItem(TPK_REF_KEY) || '[]'));
    const tasks = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir) return;
      const low = relPath.toLowerCase();
      if (!low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.jpeg')) return;
      tasks.push(entry.async('blob').then(blob => ({
        path: relPath,
        basename: relPath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase(),
        url: URL.createObjectURL(blob),
        isNew: ref.size > 0 && !ref.has(relPath),
        githubPath: null, matchType: null,
      })));
    });
    _tpkFiles = await Promise.all(tasks);
    _tpkFiles.sort((a, b) => a.path.localeCompare(b.path));

    // Parse JSON model files to detect 3D block models
    _tpkModelMap = {};
    _tpkSelected.clear();
    const modelTasks = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir || !relPath.toLowerCase().endsWith('.json')) return;
      modelTasks.push(entry.async('string').then(text => ({ relPath, text })));
    });
    const modelRaws = await Promise.all(modelTasks);
    for (const { relPath, text } of modelRaws) {
      try {
        const data = JSON.parse(text);
        const texs = data.textures || {};
        const has3d = !!data.elements ||
          /block\/(cube|orientable|column|slab|stairs|fence|wall|door|trapdoor)/.test(data.parent || '') ||
          relPath.toLowerCase().includes('/models/block/');
        for (const texRef of Object.values(texs)) {
          const bname = String(texRef).split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
          if (has3d && !_tpkModelMap[bname]) _tpkModelMap[bname] = 'block3d';
        }
      } catch {}
    }
    // Also treat any texture in textures/block/ as 3D
    for (const f of _tpkFiles) {
      if (f.path.toLowerCase().includes('/textures/block/') || f.path.toLowerCase().startsWith('textures/block/')) {
        if (!_tpkModelMap[f.basename]) _tpkModelMap[f.basename] = 'block3d';
      }
    }
    document.getElementById('tpk-save-ref-btn').disabled = false;
    const vBtn = document.getElementById('tpk-visual-btn');
    if (vBtn) vBtn.disabled = false;
    if (_tpkGhMap.size === 0) await _tpkFetchGhTree();
    _tpkApplyMatch();
    tpkRender();
  } catch(e) {
    if (statsEl) statsEl.textContent = '⛔ ' + e.message;
    toast('⛔ Erreur ZIP : ' + e.message, 'error');
  }
};

// ── GitHub tree ──────────────────────────────────────────────────────────────

async function _tpkFetchGhTree() {
  const token  = _imgConfig?.token  || '';
  const repo   = _imgConfig?.repo   || '';
  const branch = _imgConfig?.branch || 'main';
  if (!token || !repo) return;
  const ghBtn = document.getElementById('tpk-gh-btn');
  if (ghBtn) { ghBtn.disabled = true; ghBtn.textContent = '⏳…'; }
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
      { headers: { Authorization: `token ${token}` } }
    );
    if (!resp.ok) throw new Error(resp.status);
    const data = await resp.json();
    _tpkGhMap.clear(); _tpkGhMapAll.clear(); _tpkGhFiles = []; _tpkGhSha.clear();
    (data.tree || []).forEach(node => {
      if (node.type !== 'blob') return;
      const low = node.path.toLowerCase();
      if (!low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.jpeg')) return;
      const base = node.path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
      _tpkGhMap.set(base, node.path);
      if (!_tpkGhMapAll.has(base)) _tpkGhMapAll.set(base, []);
      _tpkGhMapAll.get(base).push(node.path);
      _tpkGhSha.set(node.path, node.sha);
      _tpkGhFiles.push(node.path);
    });
    _tpkGhFiles.sort();
    if (ghBtn) { ghBtn.disabled = false; ghBtn.textContent = '🔄 GitHub'; }
    toast(`✓ ${_tpkGhFiles.length} fichiers GitHub`, 'success');
  } catch(e) {
    if (ghBtn) { ghBtn.disabled = false; ghBtn.textContent = '🔄 GitHub'; }
    toast('⛔ Erreur GitHub : ' + e.message, 'error');
  }
}

window.tpkRefreshGithub = async function() {
  _tpkGhMap.clear(); _tpkGhMapAll.clear(); _tpkGhFiles = [];
  await _tpkFetchGhTree();
  _tpkApplyMatch();
  tpkRender();
};

// ── Matching (auto + manuel) ─────────────────────────────────────────────────

function _tpkPathScore(zipPath, ghPath) {
  const z = zipPath.toLowerCase().split('/').slice(0, -1).reverse();
  const g = ghPath.toLowerCase().split('/').slice(0, -1).reverse();
  let score = 0;
  for (let i = 0; i < Math.min(z.length, g.length); i++) {
    if (z[i] === g[i]) score++;
    else break;
  }
  return score;
}

function _tpkBestGhPath(zipFile, candidates) {
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, p) =>
    _tpkPathScore(zipFile.path, p) > _tpkPathScore(zipFile.path, best) ? p : best,
    candidates[0]
  );
}

function _tpkApplyMatch() {
  _tpkGhInverse.clear();
  for (const f of _tpkFiles) {
    const manual     = _tpkManual.get(f.basename);
    const candidates = _tpkGhMapAll.get(f.basename) || [];
    if (manual === '__none__') {
      f.githubPath = null; f.matchType = null;
    } else if (manual) {
      f.githubPath = manual; f.matchType = 'manual';
      _tpkGhInverse.set(manual, { url: f.url, matchType: 'manual', tpkFile: f });
    } else {
      // Pick the GitHub path that best matches this ZIP file's folder structure
      const available = candidates.filter(p => !_tpkGhInverse.has(p));
      const auto = _tpkBestGhPath(f, available);
      if (auto) {
        f.githubPath = auto; f.matchType = 'auto';
        _tpkGhInverse.set(auto, { url: f.url, matchType: 'auto', tpkFile: f });
      } else {
        f.githubPath = null; f.matchType = null;
      }
    }
  }
}

// ── Animation thumbnails (boucle RAF partagée) ───────────────────────────────

let _tpkAnimCells = []; // { type, cvs, img/imgs, w, h, vert, frames, frame, interval, lastTick }
let _tpkAnimRAF   = null;
let _tpkScrollObs = null; // IntersectionObserver for infinite scroll

function _tpkStartAnimLoop() {
  if (_tpkAnimRAF) return;
  function loop(ts) {
    _tpkAnimRAF = requestAnimationFrame(loop);
    let alive = false;
    for (const a of _tpkAnimCells) {
      if (!a.cvs.isConnected) continue;
      alive = true;
      if (ts - (a.lastTick || 0) < a.interval) continue;
      a.lastTick = ts;
      a.frame = (a.frame + 1) % a.frames;
      const ctx = a.cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, a.cvs.width, a.cvs.height);
      if (a.type === 'sprite') {
        if (a.vert) ctx.drawImage(a.img, 0, a.frame*a.h, a.w, a.h, 0, 0, a.cvs.width, a.cvs.height);
        else        ctx.drawImage(a.img, a.frame*a.w, 0, a.w, a.h, 0, 0, a.cvs.width, a.cvs.height);
      } else if (a.type === 'pair') {
        ctx.drawImage(a.imgs[a.frame], 0, 0, a.cvs.width, a.cvs.height);
      }
    }
    if (!alive) { cancelAnimationFrame(_tpkAnimRAF); _tpkAnimRAF = null; _tpkAnimCells = []; }
  }
  _tpkAnimRAF = requestAnimationFrame(loop);
}

function _tpkStopAnimLoop() {
  if (_tpkAnimRAF) { cancelAnimationFrame(_tpkAnimRAF); _tpkAnimRAF = null; }
  _tpkAnimCells = [];
}

// ── Sélection multiple ───────────────────────────────────────────────────────

function _tpkUpdateSelBar() {
  const bar   = document.getElementById('tpk-sel-bar');
  const count = document.getElementById('tpk-sel-count');
  if (!bar) return;
  const n = _tpkSelected.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (count) count.textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
}

function _tpkSetChk(chk, sel) {
  chk.style.borderColor = sel ? 'var(--accent)' : 'rgba(255,255,255,0.35)';
  chk.style.background  = sel ? 'var(--accent)' : 'rgba(0,0,0,0.45)';
  chk.innerHTML = sel ? '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>' : '';
}

function _tpkSelMoveTo(targetFolder) {
  if (!_tpkSelected.size) return;
  const panel = document.getElementById('images-tool-panel');
  const scrollTop = panel ? panel.scrollTop : 0;
  for (const bn of _tpkSelected) _tpkVFolders[bn] = targetFolder;
  _tpkSelected.clear();
  _tpkSaveVFolders();
  tpkRender();
  if (panel) panel.scrollTop = scrollTop;
}
window.tpkSelToInutile   = () => _tpkSelMoveTo('inutile');
window.tpkSelToIllisible = () => _tpkSelMoveTo('illisible');

window.tpkSelClear = function() {
  _tpkSelected.clear();
  document.querySelectorAll('.tpk-cell-chk').forEach(chk => _tpkSetChk(chk, false));
  document.querySelectorAll('.tpk-cell').forEach(c => { c.style.outline = ''; });
  _tpkUpdateSelBar();
};

function _tpkBuildRawEntries(files) {
  const baseMap = new Map(files.map(f => [f.basename, f]));
  const paired  = new Set();
  const entries = [];
  for (const f of files) {
    if (paired.has(f)) continue;
    const eFile = baseMap.get(f.basename + '_e');
    if (eFile && !paired.has(eFile)) {
      paired.add(f); paired.add(eFile);
      entries.push({ pair: [f, eFile] });
    } else if (f.basename.endsWith('_e')) {
      const base = baseMap.get(f.basename.slice(0, -2));
      if (base && !paired.has(base)) {
        paired.add(f); paired.add(base);
        entries.push({ pair: [base, f] });
      } else { entries.push({ single: f }); }
    } else { entries.push({ single: f }); }
  }
  return entries;
}

// ── Rendu gauche (grille) ────────────────────────────────────────────────────

window.tpkRender = function() {
  _tpkStopAnimLoop();
  const q = (document.getElementById('tpk-search')?.value || '').toLowerCase();
  const unmatchedAll = _tpkFiles.filter(f => !f.githubPath && (!q || f.path.toLowerCase().includes(q)));
  const unmatched = unmatchedAll.filter(f => !_tpkVFolders[f.basename]);
  unmatched.sort((a, b) => a.path.localeCompare(b.path));
  // Clean up selection: remove items no longer in unmatched
  const unmatchedSet = new Set(unmatched.map(f => f.basename));
  for (const bn of [..._tpkSelected]) { if (!unmatchedSet.has(bn)) _tpkSelected.delete(bn); }
  _tpkUpdateSelBar();

  // Séparer nouveau vs existant
  const newFiles     = unmatched.filter(f => f.isNew);
  const regularFiles = unmatched.filter(f => !f.isNew);

  _tpkLeftVis = [];

  // ── Section NOUVEAU ──
  if (newFiles.length > 0) {
    const newCollapsed = _tpkLeftFolders['__new__'] ?? false;
    _tpkLeftVis.push({ newSection: true, count: newFiles.length, collapsed: newCollapsed });
    if (!newCollapsed) _tpkLeftVis.push(..._tpkBuildRawEntries(newFiles));
  }

  // ── Dossiers ZIP (fichiers existants) ──
  const byFolder = new Map();
  for (const entry of _tpkBuildRawEntries(regularFiles)) {
    const f = entry.pair ? entry.pair[0] : entry.single;
    const parts = f.path.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(entry);
  }
  for (const [folder, entries] of [...byFolder.entries()].sort()) {
    const collapsed = _tpkLeftFolders[folder] ?? false;
    if (folder) _tpkLeftVis.push({ folder, count: entries.length, collapsed });
    if (!collapsed) _tpkLeftVis.push(...entries);
  }

  const newCount     = _tpkFiles.filter(f => f.isNew && !f.githubPath).length;
  const manualCount  = [..._tpkManual.values()].filter(v => v !== '__none__').length;
  const vfolderCount = unmatchedAll.length - unmatched.length;
  const statsEl = document.getElementById('tpk-stats');
  if (statsEl) statsEl.textContent = [
    `${_tpkFiles.length} textures`,
    `${_tpkGhInverse.size} matchées`,
    `${unmatched.length} à trier`,
    vfolderCount  ? `${vfolderCount} en dossiers` : '',
    newCount      ? `${newCount} nouvelles`        : '',
    manualCount   ? `${manualCount} liens manuels` : '',
  ].filter(Boolean).join(' · ');

  const lc = document.getElementById('tpk-left-count');
  const rc = document.getElementById('tpk-right-count');
  if (lc) lc.textContent = `(${unmatched.length})`;
  if (rc) rc.textContent = `(${_tpkGhInverse.size}/${_tpkGhFiles.length})`;

  const banner = document.getElementById('tpk-link-banner');
  if (banner) {
    if (_tpkLinkSrc) {
      banner.style.display = '';
      banner.textContent = `🔗 Mode liaison actif — clique sur le "?" correspondant à droite pour lier "${_tpkLinkSrc.path.split('/').pop()}" · reclique sur la texture pour annuler`;
    } else {
      banner.style.display = 'none';
    }
  }

  if (_tpkScrollObs) { _tpkScrollObs.disconnect(); _tpkScrollObs = null; }
  const leftEl = document.getElementById('tpk-left');
  if (leftEl) leftEl.innerHTML = '';
  _tpkLeftPage = 0;
  tpkLeftMore();
  _tpkRenderTree(q);
  _tpkRenderVFolders();
};

window.tpkLeftMore = function() {
  const el = document.getElementById('tpk-left');
  if (!el) return;
  let shown = 0;
  while (_tpkLeftPage < _tpkLeftVis.length && shown < TPK_PAGE) {
    const entry = _tpkLeftVis[_tpkLeftPage++];
    if (entry.newSection) {
      el.appendChild(_tpkMakeNewSectionHeader(entry));
    } else if (entry.folder !== undefined) {
      el.appendChild(_tpkMakeFolderHeaderLeft(entry));
    } else {
      el.appendChild(entry.pair ? _tpkMakePairCell(entry.pair[0], entry.pair[1]) : _tpkMakeLeftCell(entry.single));
      shown++;
    }
  }
  if (_tpkLeftPage < _tpkLeftVis.length) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:4px;grid-column:1/-1;';
    el.appendChild(sentinel);
    if (_tpkScrollObs) _tpkScrollObs.disconnect();
    _tpkScrollObs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      _tpkScrollObs.disconnect(); _tpkScrollObs = null;
      sentinel.remove();
      tpkLeftMore();
    }, { root: document.getElementById('images-tool-panel'), rootMargin: '300px', threshold: 0 });
    _tpkScrollObs.observe(sentinel);
  }
};

function _tpkMakeNewSectionHeader(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:6px;padding:6px 4px 4px;margin-top:2px;border-top:2px solid var(--accent);font-size:11px;font-weight:700;color:var(--accent);cursor:pointer;user-select:none;';
  div.innerHTML = `<span style="font-size:9px;opacity:.7;">${entry.collapsed ? '▶' : '▼'}</span><span>✨ NOUVEAU</span><span style="font-size:10px;font-weight:400;opacity:.7;">(${entry.count})</span>`;
  div.addEventListener('click', () => {
    _tpkLeftFolders['__new__'] = !entry.collapsed;
    tpkRender();
  });
  // Checkbox sélection globale section NOUVEAU
  const newFiles = _tpkFiles.filter(f => f.isNew && !f.githubPath && !_tpkVFolders[f.basename]);
  const allSel = newFiles.length > 0 && newFiles.every(f => _tpkSelected.has(f.basename));
  const chk = document.createElement('div');
  chk.style.cssText = `width:12px;height:12px;border:2px solid ${allSel?'var(--accent)':'rgba(200,200,200,0.35)'};border-radius:2px;background:${allSel?'var(--accent)':'rgba(0,0,0,0.35)'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;
  if (allSel) chk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  chk.addEventListener('click', e => {
    e.stopPropagation();
    const files = _tpkFiles.filter(f => f.isNew && !f.githubPath && !_tpkVFolders[f.basename]);
    const nowAll = files.length > 0 && files.every(f => _tpkSelected.has(f.basename));
    const basenames = new Set(files.map(f => f.basename));
    for (const f of files) { if (nowAll) _tpkSelected.delete(f.basename); else _tpkSelected.add(f.basename); }
    const newSel = !nowAll;
    document.querySelectorAll('.tpk-cell-chk').forEach(c => {
      if (basenames.has(c.dataset.basename)) {
        _tpkSetChk(c, newSel);
        const cell = c.closest('.tpk-cell');
        if (cell) cell.style.outline = newSel ? '2px solid var(--accent)' : '';
      }
    });
    _tpkSetChk(chk, newSel);
    _tpkUpdateSelBar();
  });
  div.insertBefore(chk, div.firstChild);
  return div;
}

function _tpkMakeFolderHeaderLeft(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:5px;padding:5px 3px 3px;margin-top:4px;border-top:1px solid var(--border);font-size:10px;color:var(--muted);cursor:pointer;user-select:none;';
  div.innerHTML = `<span style="font-size:9px;opacity:.55;">${entry.collapsed ? '▶' : '▼'}</span><span>📁 ${escHtml(entry.folder)}</span><span style="opacity:.4;">(${entry.count})</span>`;
  div.addEventListener('click', () => {
    _tpkLeftFolders[entry.folder] = !entry.collapsed;
    tpkRender();
  });
  // Checkbox sélection dossier
  const folderFiles = _tpkFiles.filter(f => !f.githubPath && !_tpkVFolders[f.basename] && f.path.startsWith(entry.folder + '/'));
  const allSel = folderFiles.length > 0 && folderFiles.every(f => _tpkSelected.has(f.basename));
  const folderChk = document.createElement('div');
  folderChk.style.cssText = `width:12px;height:12px;border:2px solid ${allSel?'var(--accent)':'rgba(200,200,200,0.35)'};border-radius:2px;background:${allSel?'var(--accent)':'rgba(0,0,0,0.35)'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;
  if (allSel) folderChk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  folderChk.addEventListener('click', e => {
    e.stopPropagation();
    const files = _tpkFiles.filter(f => !f.githubPath && !_tpkVFolders[f.basename] && f.path.startsWith(entry.folder + '/'));
    const nowAllSel = files.length > 0 && files.every(f => _tpkSelected.has(f.basename));
    const basenames = new Set(files.map(f => f.basename));
    for (const f of files) { if (nowAllSel) _tpkSelected.delete(f.basename); else _tpkSelected.add(f.basename); }
    const newSel = !nowAllSel;
    // Update visible cell checkboxes for this folder
    document.querySelectorAll('.tpk-cell-chk').forEach(chk => {
      if (basenames.has(chk.dataset.basename)) {
        _tpkSetChk(chk, newSel);
        const c = chk.closest('.tpk-cell');
        if (c) { c.style.outline = newSel ? '2px solid var(--accent)' : ''; }
      }
    });
    _tpkSetChk(folderChk, newSel);
    _tpkUpdateSelBar();
  });
  div.insertBefore(folderChk, div.firstChild);
  const inutileBtn = document.createElement('button');
  inutileBtn.textContent = '🚫';
  inutileBtn.title = 'Tout mettre dans "inutile"';
  inutileBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:10px;padding:0 3px;opacity:.5;line-height:1;flex-shrink:0;';
  inutileBtn.addEventListener('click', e => {
    e.stopPropagation();
    const panel = document.getElementById('images-tool-panel');
    const scrollTop = panel ? panel.scrollTop : 0;
    const prefix = entry.folder + '/';
    const affected = _tpkFiles.filter(f => !f.githubPath && f.path.startsWith(prefix));
    for (const f of affected) _tpkVFolders[f.basename] = 'inutile';
    _tpkSaveVFolders();
    tpkRender();
    if (panel) panel.scrollTop = scrollTop;
  });
  div.appendChild(inutileBtn);
  return div;
}

// ── Dossiers virtuels (local, non-GitHub) ───────────────────────────────────

function _tpkRenderVFolders() {
  const el = document.getElementById('tpk-left-vfolders');
  if (!el) return;
  el.innerHTML = '';
  if (!_tpkVFolderList.length) return;
  const q = (document.getElementById('tpk-search')?.value || '').toLowerCase();

  for (const folderName of _tpkVFolderList) {
    const folderFiles = _tpkFiles.filter(f =>
      !f.githubPath &&
      _tpkVFolders[f.basename] === folderName &&
      (!q || f.path.toLowerCase().includes(q))
    );

    const collapsed = _tpkVFCollapsed[folderName] ?? true;
    const section   = document.createElement('div');
    section.style.cssText = 'margin-top:10px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 3px;border-top:1px solid var(--border);font-size:11px;font-weight:700;cursor:pointer;user-select:none;';
    const icon = _tpkVFolderIcon(folderName);
    header.innerHTML = `<span style="font-size:9px;opacity:.55;">${collapsed ? '▶' : '▼'}</span><span>${icon} ${escHtml(folderName)}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">(${folderFiles.length})</span>`;
    header.addEventListener('click', () => {
      _tpkVFCollapsed[folderName] = !collapsed;
      _tpkRenderVFolders();
    });

    if (!TPK_PERMANENT.includes(folderName)) {
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.title = 'Supprimer ce dossier (les textures retournent à "À trier")';
      delBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:11px;padding:0 4px;opacity:.45;';
      delBtn.addEventListener('click', e => { e.stopPropagation(); tpkDeleteVFolder(folderName); });
      header.appendChild(delBtn);
    }
    section.appendChild(header);

    if (!collapsed) {
      if (folderFiles.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;color:var(--muted);padding:8px 4px;text-align:center;opacity:.5;';
        empty.textContent = 'Vide';
        section.appendChild(empty);
      } else {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px;padding-top:6px;';
        for (const f of folderFiles) grid.appendChild(_tpkMakeLeftCell(f));
        section.appendChild(grid);
      }
    }
    el.appendChild(section);
  }
}

function _tpkShowVFolderMenu(e, f) {
  document.querySelectorAll('.tpk-ctx-menu').forEach(m => m.remove());
  const current = _tpkVFolders[f.basename];
  const menu    = document.createElement('div');
  menu.className = 'tpk-ctx-menu';
  const left = Math.min(e.clientX, window.innerWidth  - 180);
  const top  = Math.min(e.clientY, window.innerHeight - 200);
  menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;background:var(--surface);border:1px solid var(--border);border-radius:7px;z-index:9999;padding:4px 0;min-width:160px;box-shadow:0 4px 18px rgba(0,0,0,.4);`;

  const addItem = (html, onClick, color) => {
    const item = document.createElement('div');
    item.innerHTML = html;
    item.style.cssText = `padding:6px 12px;font-size:12px;cursor:pointer;color:${color || 'var(--text)'};white-space:nowrap;`;
    item.addEventListener('mouseenter', () => item.style.background = 'var(--surface2)');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('mousedown', ev => { ev.stopPropagation(); menu.remove(); onClick(); });
    menu.appendChild(item);
  };
  const addSep = () => { const s = document.createElement('div'); s.style.cssText = 'height:1px;background:var(--border);margin:3px 0;'; menu.appendChild(s); };

  if (current) {
    addItem(`✕ Retirer de <b>${escHtml(current)}</b>`, () => {
      delete _tpkVFolders[f.basename];
      _tpkSaveVFolders();
      tpkRender();
    }, 'var(--danger)');
    addSep();
  }

  for (const name of _tpkVFolderList) {
    if (name === current) continue;
    const icon = _tpkVFolderIcon(name);
    addItem(`${icon} ${escHtml(name)}`, () => {
      _tpkVFolders[f.basename] = name;
      _tpkSaveVFolders();
      tpkRender();
    });
  }

  document.body.appendChild(menu);
  const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

window.tpkCreateVFolder = function() {
  const name = window.prompt('Nom du nouveau dossier :', '');
  if (!name || !name.trim()) return;
  const clean = name.trim().toLowerCase();
  if (_tpkVFolderList.includes(clean)) { toast('Ce dossier existe déjà', 'warning'); return; }
  _tpkVFolderList.push(clean);
  _tpkVFCollapsed[clean] = false;
  _tpkSaveVFolders();
  _tpkRenderVFolders();
};

window.tpkDeleteVFolder = function(folderName) {
  if (TPK_PERMANENT.includes(folderName)) return;
  for (const k of Object.keys(_tpkVFolders)) {
    if (_tpkVFolders[k] === folderName) delete _tpkVFolders[k];
  }
  _tpkVFolderList = _tpkVFolderList.filter(n => n !== folderName);
  _tpkSaveVFolders();
  tpkRender();
};

window.tpkCollapseAll = function(val) {
  // Section NOUVEAU
  _tpkLeftFolders['__new__'] = val;
  // Left ZIP panel — direct parent folders of all unmatched files
  for (const f of _tpkFiles) {
    const parts = f.path.split('/');
    if (parts.length > 1) _tpkLeftFolders[parts.slice(0, -1).join('/')] = val;
  }
  // Right GitHub panel — all folder paths in tree
  for (const p of _tpkGhFiles) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      _tpkFolders[parts.slice(0, i).join('/')] = val;
    }
  }
  // Virtual folders
  for (const name of _tpkVFolderList) _tpkVFCollapsed[name] = val;
  tpkRender();
};

// Détecte le type de texture d'un fichier pour le rendu dans la grille
function _tpkDetectType(f) {
  const W = f._w, H = f._h;
  if (!W || !H) return 'normal';
  if (_tpkModelMap[f.basename]) return 'model3d';
  if (W === 64 && (H === 64 || H === 32) &&
      /skin|player|steve|alex|char(?:_|$)|humanoid|entity\/player/.test(f.path.toLowerCase())) return 'skin';
  if (H >= W * 2 && H % W === 0) return 'sprite-vert';
  if (W >= H * 2 && W % H === 0) return 'sprite-horiz';
  return 'normal';
}

function _tpkMakeThumbCanvas(f, size) {
  const cvs = document.createElement('canvas');
  cvs.width = size; cvs.height = size;
  cvs.style.cssText = `width:${size}px;height:${size}px;image-rendering:pixelated;cursor:zoom-in;display:block;`;
  cvs.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(f.url, f.path.split('/').pop(), f.path); });
  const tmpImg = new Image();
  tmpImg.src = f.url;
  tmpImg.onload = () => {
    f._w = tmpImg.naturalWidth; f._h = tmpImg.naturalHeight;
    const type = _tpkDetectType(f);
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    if (type === 'skin') {
      ctx.fillStyle = '#18181f'; ctx.fillRect(0, 0, size, size);
      _drawSkinFront(tmpImg, cvs, f._w, f._h);
    } else if (type === 'model3d') {
      ctx.drawImage(tmpImg, 0, 0, size, size);
      // Badge 3D overlay
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, size - 11, size, 11);
      ctx.fillStyle = '#7ecfff';
      ctx.font = `bold ${Math.max(7, size/7.5)|0}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('3D', size/2, size - 5.5);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    } else if (type === 'sprite-vert' || type === 'sprite-horiz') {
      const vert   = type === 'sprite-vert';
      const fw = vert ? f._w : f._h;
      const fh = vert ? f._w : f._h;
      const frames = vert ? f._h / f._w : f._w / f._h;
      ctx.drawImage(tmpImg, 0, 0, fw, fh, 0, 0, size, size);
      _tpkAnimCells.push({ type:'sprite', cvs, img:tmpImg, w:fw, h:fh, vert, frames, frame:0, interval:80, lastTick:0 });
      _tpkStartAnimLoop();
    } else {
      ctx.drawImage(tmpImg, 0, 0, size, size);
    }
  };
  return cvs;
}


function _tpkMakeLeftCell(f) {
  const name     = f.path.split('/').pop();
  const linking  = _tpkLinkSrc === f;
  const isSel    = _tpkSelected.has(f.basename);
  const border   = linking ? 'var(--warn)' : isSel ? 'var(--accent)' : f.isNew ? 'var(--accent)' : 'var(--border)';
  const bg       = linking ? 'color-mix(in srgb,var(--warn) 15%,var(--surface2))'
                 : isSel   ? 'color-mix(in srgb,var(--accent) 18%,var(--surface2))'
                 : f.isNew ? 'color-mix(in srgb,var(--accent) 10%,var(--surface2))' : 'var(--surface2)';
  const cell = document.createElement('div');
  cell.className = 'tpk-cell';
  cell.title = f.path;
  cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:6px;border:2px solid ${border};background:${bg};position:relative;${isSel ? 'outline:2px solid var(--accent);outline-offset:1px;' : ''}`;
  cell.appendChild(_tpkMakeThumbCanvas(f, 52));
  cell.insertAdjacentHTML('beforeend', `
    <span style="font-size:9px;color:var(--muted);word-break:break-all;text-align:center;line-height:1.2;max-width:68px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(name)}</span>
    ${f.isNew ? '<span style="font-size:8px;color:var(--accent);font-weight:700;">NEW</span>' : ''}`);
  // Checkbox sélection (top-left)
  const chk = document.createElement('div');
  chk.className = 'tpk-cell-chk';
  chk.dataset.basename = f.basename;
  chk.style.cssText = `position:absolute;top:2px;left:2px;width:13px;height:13px;border:2px solid ${isSel?'var(--accent)':'rgba(255,255,255,0.35)'};border-radius:3px;background:${isSel?'var(--accent)':'rgba(0,0,0,0.45)'};cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
  if (isSel) chk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  chk.addEventListener('click', e => {
    e.stopPropagation();
    const now = !_tpkSelected.has(f.basename);
    if (now) _tpkSelected.add(f.basename); else _tpkSelected.delete(f.basename);
    _tpkSetChk(chk, now);
    cell.style.outline = now ? '2px solid var(--accent)' : '';
    cell.style.background = now ? 'color-mix(in srgb,var(--accent) 18%,var(--surface2))' : bg;
    _tpkUpdateSelBar();
  });
  cell.appendChild(chk);
  // Bouton liaison (top-right)
  const linkBtn = document.createElement('button');
  linkBtn.textContent = '🔗';
  linkBtn.title = linking ? 'Annuler liaison' : 'Lier manuellement à un fichier GitHub';
  linkBtn.style.cssText = `position:absolute;top:2px;right:2px;background:${linking ? 'var(--warn)' : 'rgba(0,0,0,.35)'};border:none;border-radius:3px;color:#fff;font-size:9px;padding:1px 3px;cursor:pointer;line-height:1.4;`;
  linkBtn.addEventListener('click', e => { e.stopPropagation(); _tpkLinkSrc = _tpkLinkSrc === f ? null : f; tpkRender(); });
  cell.appendChild(linkBtn);
  cell.addEventListener('contextmenu', e => { e.preventDefault(); _tpkShowVFolderMenu(e, f); });
  return cell;
}

function _tpkMakePairCell(fb, fe) {
  const cell = document.createElement('div');
  cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:6px;border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface2));position:relative;';
  cell.title = fb.path + '\n+ ' + fe.path;

  // Canvas animé base ↔ emissive (une frame par seconde)
  const cvs = document.createElement('canvas');
  cvs.width = 52; cvs.height = 52;
  cvs.style.cssText = 'width:52px;height:52px;image-rendering:pixelated;cursor:zoom-in;display:block;';
  cvs.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(fb.url, fb.path.split('/').pop(), fb.path); });

  let imgB = null, imgE = null;
  const tryReg = () => {
    if (!imgB || !imgE) return;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 52, 52);
    ctx.drawImage(imgB, 0, 0, 52, 52);
    _tpkAnimCells.push({ type:'pair', cvs, imgs:[imgB, imgE], frames:2, frame:0, interval:1000, lastTick:0 });
    _tpkStartAnimLoop();
  };
  const lb = new Image(); lb.src = fb.url; lb.onload = () => { imgB = lb; tryReg(); };
  const le = new Image(); le.src = fe.url; le.onload = () => { imgE = le; tryReg(); };

  cell.appendChild(cvs);
  const nm = fb.path.split('/').pop().replace(/\.[^.]+$/, '');
  cell.insertAdjacentHTML('beforeend', `
    <span style="font-size:9px;color:var(--muted);text-align:center;overflow:hidden;max-width:68px;white-space:nowrap;text-overflow:ellipsis;">${escHtml(nm)}</span>
    <span style="font-size:7px;color:var(--accent);">+_e</span>`);
  const lnkRow = document.createElement('div');
  lnkRow.style.cssText = 'display:flex;gap:3px;';
  const makeLnk = f => {
    const sel = _tpkLinkSrc === f;
    const b = document.createElement('button');
    b.textContent = '🔗';
    b.title = (sel ? 'Annuler' : 'Lier') + ' ' + f.path.split('/').pop();
    b.style.cssText = `background:${sel?'var(--warn)':'rgba(0,0,0,.35)'};border:none;border-radius:3px;color:#fff;font-size:9px;padding:1px 4px;cursor:pointer;`;
    b.addEventListener('click', e => { e.stopPropagation(); _tpkLinkSrc = _tpkLinkSrc === f ? null : f; tpkRender(); });
    return b;
  };
  lnkRow.appendChild(makeLnk(fb));
  lnkRow.appendChild(makeLnk(fe));
  cell.appendChild(lnkRow);
  return cell;
}

// ── Rendu droit (arbre dossiers GitHub) ─────────────────────────────────────

function _tpkBuildNode(paths) {
  const root = {};
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = { __files: [] };
      cur = cur[parts[i]];
    }
    if (!cur.__files) cur.__files = [];
    cur.__files.push(p);
  }
  return root;
}

function _tpkRenderTree(q) {
  const el = document.getElementById('tpk-right');
  if (!el) return;
  el.innerHTML = '';
  if (!_tpkGhFiles.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px;">Configure le token GitHub puis charge un ZIP.</div>';
    return;
  }
  const files = q ? _tpkGhFiles.filter(p => p.toLowerCase().includes(q)) : _tpkGhFiles;
  _tpkRenderNode(_tpkBuildNode(files), '', el, 0, !!q);
}

function _tpkRenderNode(node, prefix, container, depth, forceExpand) {
  const indent = depth * 16;
  for (const [key, child] of Object.entries(node)) {
    if (key === '__files') continue;
    const fp = prefix ? `${prefix}/${key}` : key;
    const collapsed = forceExpand ? false : (_tpkFolders[fp] ?? (depth >= 1));
    const wrap = document.createElement('div');
    const header = document.createElement('div');
    header.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 4px 2px ${indent + 2}px;cursor:pointer;border-radius:4px;font-size:11px;color:var(--text);user-select:none;`;
    header.innerHTML = `<span style="font-size:9px;opacity:.5;">${collapsed ? '▶' : '▼'}</span><span>📁</span><span>${escHtml(key)}</span>`;
    header.addEventListener('click', () => {
      _tpkFolders[fp] = !(_tpkFolders[fp] ?? (depth >= 1));
      _tpkRenderTree((document.getElementById('tpk-search')?.value || '').toLowerCase());
    });
    wrap.appendChild(header);
    if (!collapsed) {
      const inner = document.createElement('div');
      _tpkRenderNode(child, fp, inner, depth + 1, forceExpand);
      wrap.appendChild(inner);
    }
    container.appendChild(wrap);
  }
  const files = node.__files || [];
  if (!files.length) return;
  const row = document.createElement('div');
  row.style.cssText = `padding-left:${indent + 18}px;display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 6px;`;
  files.forEach(ghPath => row.appendChild(_tpkMakeGhCell(ghPath)));
  container.appendChild(row);
}

function _tpkMakeGhCell(ghPath) {
  const match    = _tpkGhInverse.get(ghPath);
  const name     = ghPath.split('/').pop();
  const isTarget = _tpkLinkSrc !== null && !match;
  const cell     = document.createElement('div');
  cell.title = match
    ? `${ghPath}\n← ${match.tpkFile.path}${match.matchType === 'manual' ? '\n(lien manuel)' : ' (auto)'}`
    : ghPath;
  const border  = match ? (match.matchType === 'manual' ? 'var(--warn)' : 'var(--border)')
                        : isTarget ? 'var(--accent)' : 'var(--border)';
  const bg      = isTarget ? 'color-mix(in srgb,var(--accent) 8%,var(--surface2))' : 'var(--surface2)';
  const opacity = match ? '1' : isTarget ? '1' : '0.4';
  cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 3px;border-radius:5px;cursor:${isTarget ? 'crosshair' : match ? 'pointer' : 'default'};border:1px solid ${border};background:${bg};opacity:${opacity};width:58px;flex-shrink:0;position:relative;`;
  const badge = match?.matchType === 'manual' ? '<span style="font-size:7px;color:var(--warn);font-weight:700;">MANUEL</span>' : '';
  cell.innerHTML = `<span style="font-size:8px;color:var(--muted);word-break:break-all;text-align:center;line-height:1.2;max-width:56px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(name)}</span>${badge}`;
  if (match) {
    const img = document.createElement('img');
    img.src = match.url;
    img.style.cssText = 'width:44px;height:44px;object-fit:contain;image-rendering:pixelated;cursor:zoom-in;display:block;';
    img.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(match.url, name, ghPath); });
    cell.insertBefore(img, cell.firstChild);
    cell.addEventListener('click', () => navigator.clipboard?.writeText(ghPath).then(() => toast(`📋 ${ghPath}`, 'success')));
    // Bouton delink visible (✕)
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.title = match.matchType === 'manual' ? 'Supprimer lien manuel' : 'Exclure du match auto';
    delBtn.style.cssText = 'position:absolute;top:1px;left:1px;background:rgba(180,0,0,.75);border:none;border-radius:3px;color:#fff;font-size:8px;padding:0 3px;cursor:pointer;line-height:1.6;z-index:1;';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (match.matchType === 'manual') {
        _tpkManual.delete(match.tpkFile.basename);
      } else {
        _tpkManual.set(match.tpkFile.basename, '__none__');
      }
      _tpkSaveManual();
      _tpkApplyMatch();
      tpkRender();
      toast('✗ Lien supprimé', 'success');
    });
    cell.appendChild(delBtn);
    if (match.matchType === 'manual') {
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        _tpkManual.delete(match.tpkFile.basename);
        _tpkSaveManual();
        _tpkApplyMatch();
        tpkRender();
        toast('✗ Lien manuel supprimé', 'success');
      });
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:44px;height:44px;background:var(--surface2);border-radius:3px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--muted);';
    placeholder.textContent = '?';
    cell.insertBefore(placeholder, cell.firstChild);
    if (isTarget) {
      cell.addEventListener('click', () => {
        _tpkManual.set(_tpkLinkSrc.basename, ghPath);
        _tpkSaveManual();
        _tpkLinkSrc = null;
        _tpkApplyMatch();
        tpkRender();
        toast(`✓ Lié : ${name}`, 'success');
      });
    }
  }
  return cell;
}

// ── Perceptual hashing (dHash 16×16 = 256 bits) ──────────────────────────────

function _tpkHash(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = 17, H = 16;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const hash = new Uint8Array(32); // 256 bits
        let bit = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W - 1; x++) {
            const i = (y * W + x) * 4;
            const g1 = px[i] * 0.299 + px[i+1] * 0.587 + px[i+2] * 0.114;
            const g2 = px[i+4] * 0.299 + px[i+5] * 0.587 + px[i+6] * 0.114;
            if (g1 > g2) hash[bit >> 3] |= 1 << (bit & 7);
            bit++;
          }
        }
        resolve(hash);
      } catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function _tpkHamming(h1, h2) {
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    let x = h1[i] ^ h2[i];
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

let _tpkMatchCandidates = []; // { tpkFile, ghPath, tpkUrl, ghUrl, dist, remove }

window.tpkVisualMatch = async function() {
  const autoMatched = _tpkFiles.filter(f => f.matchType === 'auto');
  const unmatched   = _tpkFiles.filter(f => !f.githubPath);
  const allTpk      = [...autoMatched, ...unmatched];
  if (!allTpk.length) { toast('Rien à analyser', 'info'); return; }

  const token   = _imgConfig?.token || '';
  const repo    = _imgConfig?.repo  || '';
  const statsEl = document.getElementById('tpk-stats');
  const btn     = document.getElementById('tpk-visual-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }

  try {
    // 1. Hash texture pack
    if (statsEl) statsEl.textContent = `⏳ Hash textures (${allTpk.length})…`;
    const tpkHashes = new Map();
    for (const f of allTpk) {
      try { tpkHashes.set(f, await _tpkHash(f.url)); } catch {}
    }

    // 2. Télécharger images GitHub nécessaires
    const ghToFetch = new Set([
      ..._tpkGhFiles.filter(p => !_tpkGhInverse.has(p)),
      ...autoMatched.map(f => f.githubPath).filter(Boolean),
    ]);
    const ghHashes  = new Map();
    const ghBlobUrl = new Map(); // pour affichage dans le modal
    const ghPaths   = [...ghToFetch];
    const BATCH     = 8;
    for (let i = 0; i < ghPaths.length; i += BATCH) {
      if (statsEl) statsEl.textContent = `⏳ GitHub (${i}/${ghPaths.length})…`;
      await Promise.all(ghPaths.slice(i, i + BATCH).map(async ghPath => {
        try {
          const sha  = _tpkGhSha.get(ghPath);
          if (!sha) return;
          const resp = await fetch(
            `https://api.github.com/repos/${repo}/git/blobs/${sha}`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw' } }
          );
          if (!resp.ok) return;
          const blob    = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          ghBlobUrl.set(ghPath, blobUrl);
          ghHashes.set(ghPath, await _tpkHash(blobUrl));
        } catch {}
      }));
    }

    // 3. Construire les candidats à confirmer
    _tpkMatchCandidates = [];

    // Faux positifs auto (à retirer)
    for (const f of autoMatched) {
      const th = tpkHashes.get(f);
      const gh = ghHashes.get(f.githubPath);
      if (!th || !gh) continue;
      const dist = _tpkHamming(th, gh);
      if (dist > 10) { // probable faux positif → proposer la suppression
        _tpkMatchCandidates.push({ tpkFile: f, ghPath: f.githubPath, tpkUrl: f.url, ghUrl: ghBlobUrl.get(f.githubPath), dist, remove: true });
      }
    }

    // Nouveaux matchs potentiels
    _tpkApplyMatch();
    const stillUnmatched = _tpkFiles.filter(f => !f.githubPath);
    const stillFreeGh    = _tpkGhFiles.filter(p => !_tpkGhInverse.has(p) && ghHashes.has(p));
    const pairs = [];
    for (const f of stillUnmatched) {
      const th = tpkHashes.get(f);
      if (!th) continue;
      for (const ghPath of stillFreeGh) {
        const gh = ghHashes.get(ghPath);
        if (!gh) continue;
        pairs.push({ f, ghPath, dist: _tpkHamming(th, gh) });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const usedGh  = new Set();
    const usedTpk = new Set();
    for (const { f, ghPath, dist } of pairs) {
      if (dist > 8) break;
      if (usedTpk.has(f) || usedGh.has(ghPath)) continue;
      _tpkMatchCandidates.push({ tpkFile: f, ghPath, tpkUrl: f.url, ghUrl: ghBlobUrl.get(ghPath), dist, remove: false });
      usedTpk.add(f); usedGh.add(ghPath);
    }

    if (!_tpkMatchCandidates.length) {
      toast('Aucune correspondance trouvée', 'info');
      return;
    }
    _tpkShowMatchModal();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Match visuel'; }
  }
};

function _tpkShowMatchModal() {
  const grid  = document.getElementById('tpk-match-grid');
  const modal = document.getElementById('tpk-match-modal');
  if (!grid || !modal) return;
  grid.innerHTML = '';

  _tpkMatchCandidates.forEach((c, i) => {
    const tpkName = c.tpkFile.path.split('/').pop();
    const ghName  = c.ghPath.split('/').pop();
    const card    = document.createElement('label');
    card.style.cssText = `display:flex;gap:10px;align-items:center;padding:10px;border-radius:8px;border:2px solid ${c.remove ? 'var(--danger,#e55)' : 'var(--border)'};background:var(--surface2);cursor:pointer;`;
    card.innerHTML = `
      <input type="checkbox" data-idx="${i}" ${c.remove ? '' : 'checked'} onchange="tpkMatchUpdateCount()" style="accent-color:var(--accent);width:16px;height:16px;flex-shrink:0;">
      <img src="${c.tpkUrl}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;" title="${c.tpkFile.path}">
      <span style="font-size:16px;color:var(--muted);">${c.remove ? '✕' : '→'}</span>
      <img src="${c.ghUrl || ''}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;${!c.ghUrl ? 'opacity:.3' : ''}" title="${c.ghPath}">
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.tpkFile.path}">${tpkName}</div>
        <div style="font-size:9px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.ghPath}">${c.remove ? '✕ ' : '→ '}${ghName}</div>
        <div style="font-size:8px;color:var(--muted);opacity:.6;">dist: ${c.dist}/64${c.remove ? ' · faux positif ?' : ''}</div>
      </div>`;
    grid.appendChild(card);
  });

  tpkMatchUpdateCount();
  modal.style.display = '';
}

window.tpkMatchUpdateCount = function() {
  const checked = document.querySelectorAll('#tpk-match-grid input[type=checkbox]:checked').length;
  const el = document.getElementById('tpk-match-apply-count');
  if (el) el.textContent = `(${checked})`;
};

window.tpkMatchSelectAll = function(val) {
  document.querySelectorAll('#tpk-match-grid input[type=checkbox]').forEach(cb => { cb.checked = val; });
  tpkMatchUpdateCount();
};

window.tpkMatchApply = function() {
  document.querySelectorAll('#tpk-match-grid input[type=checkbox]:checked').forEach(cb => {
    const c = _tpkMatchCandidates[+cb.dataset.idx];
    if (!c) return;
    if (c.remove) _tpkManual.set(c.tpkFile.basename, '__none__');
    else          _tpkManual.set(c.tpkFile.basename, c.ghPath);
  });
  _tpkSaveManual();
  _tpkApplyMatch();
  tpkRender();
  document.getElementById('tpk-match-modal').style.display = 'none';
  toast(`✓ Correspondances appliquées`, 'success');
};

window.tpkSaveReference = function() {
  const paths = _tpkFiles.map(f => f.path);
  localStorage.setItem(TPK_REF_KEY, JSON.stringify(paths));
  _tpkFiles.forEach(f => { f.isNew = false; });
  tpkRender();
  toast(`✓ Référence sauvegardée (${paths.length} textures)`, 'success');
};

window.previewNormalize = async function() {
  const cat = document.getElementById('img-norm-type')?.value || '';
  const previewEl = document.getElementById('img-norm-preview');
  if (!previewEl) return;
  previewEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const docs = await cachedDocs(COL.items);
    const filtered = docs.filter(d => !cat || d.category === cat);
    const rows = filtered.slice(0, 50).map(item => {
      const expected = _imgComputePath(item);
      const current  = (item.images?.[0] || item.image || item.img || '');
      const ok = expected && current === expected;
      return `<div style="display:flex;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);align-items:baseline;">
        <span style="min-width:140px;flex-shrink:0;color:${ok?'var(--success)':'var(--text)'};">${escHtml(item.name||item.id)}</span>
        <span style="color:${ok?'var(--success)':'var(--danger)'};font-family:monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${current ? escHtml(current) : '<i style="opacity:.5">—</i>'} ${!ok && expected ? '→ ' + escHtml(expected) : ''}
        </span>
      </div>`;
    }).join('');
    const total = filtered.length;
    const toFix = filtered.filter(item => {
      const expected = _imgComputePath(item);
      const current  = item.images?.[0] || item.image || item.img || '';
      return expected && current !== expected;
    }).length;
    previewEl.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${total} items · <b style="color:var(--warn);">${toFix} à corriger</b></div>${rows}${total > 50 ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;">… ${total-50} autres</div>` : ''}`;
  } catch(e) {
    previewEl.innerHTML = `<div class="empty" style="color:var(--danger)">${escHtml(e.message)}</div>`;
  }
};

window.runNormalize = async function() {
  if (!await modal.confirm('Met à jour le champ "images" de tous les items selon les templates configurés.\n\nCette opération modifie Firestore. Continuer ?')) return;
  const cat = document.getElementById('img-norm-type')?.value || '';
  const previewEl = document.getElementById('img-norm-preview');
  if (previewEl) previewEl.innerHTML = '<div class="empty">Normalisation en cours…</div>';
  try {
    const docs = await cachedDocs(COL.items);
    const filtered = docs.filter(d => !cat || d.category === cat);
    let updated = 0;
    for (const item of filtered) {
      const expected = _imgComputePath(item);
      if (!expected) continue;
      const current = item.images?.[0] || item.image || item.img || '';
      if (current === expected) continue;
      try {
        await updateDoc(doc(db, COL.items, item.id), { images: [expected] });
        invalidateModCache(COL.items);
        updated++;
      } catch {}
    }
    if (previewEl) previewEl.innerHTML = `<div style="font-size:13px;color:var(--success);padding:12px 0;">✓ ${updated} item(s) mis à jour</div>`;
    toast(`✓ ${updated} chemins d'images normalisés`, 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

// ── Migration IDs Occultes ─────────────────────────

// ── Outils modération ──────────────────────────────
window.showCalibrateur = function() {
  _setHash('calibrateur');
  _showPanel('calibrateur-panel', 'btn-calibrateur');
  const iframe = document.getElementById('calibrateur-iframe');
  if (!iframe.src || iframe.src === 'about:blank') {
    iframe.src = 'Bestiaire/calibrateur.html';
  }
};

window.showCaptureSprites = function() {
  _setHash('capture-sprites');
  _showPanel('capture-panel', 'btn-capture-sprites');
  const iframe = document.getElementById('capture-iframe');
  if (!iframe.src || iframe.src === 'about:blank') {
    iframe.src = 'capture-sprites.html';
  }
};

/* ══════════════════════════════════════════════════════
   OUTIL CARTE — Gestion des map_markers (Firestore)
══════════════════════════════════════════════════════ */

window.showMapPanel = function showMapPanel() {
  _setHash('map');
  _showPanel('map-panel', 'btn-map-order');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  switchMapTab('allpins');
};

/* Marqueurs tab removed — map_markers are managed via allpins tab */

window.deleteMapMarker = async function deleteMapMarker(id) {
  const confirmed = await modal.confirm(`Supprimer ce marqueur ?`, 'Cette action est irréversible.');
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, COL.mapMarkers, id));
    invalidateModCache(COL.mapMarkers);
    invalidateCache(COL.mapMarkers);
    toast('✓ Marqueur supprimé', 'success');
  } catch (err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════
   ÉDITEUR DE ZONES (polygones zone_monstre)
══════════════════════════════════════════════════════ */

let _zePoints  = [];
let _zeFloor   = 1;
let _zeLayer   = 'surface';

window.showZoneEditor = function showZoneEditor() {
  _setHash('zones');
  _showPanel('zone-editor-panel', 'btn-zone-editor');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  _zeInit();
};

// ── Pan / Zoom state ──────────────────────────────────
let _zeScale  = 0.6;
let _zePanX   = 0;
let _zePanY   = 0;
let _zeDragging = false;
let _zeDragStart = null;

function _zeApplyTransform() {
  const canvas = document.getElementById('ze-canvas');
  if (canvas) canvas.style.transform = `translate(${_zePanX}px,${_zePanY}px) scale(${_zeScale})`;
  const label = document.getElementById('ze-zoom-label');
  if (label) label.textContent = Math.round(_zeScale * 100) + '%';
}

window.zeZoom = function zeZoom(factor) {
  const vp = document.getElementById('ze-viewport');
  if (!vp) return;
  const newScale = Math.min(4, Math.max(0.15, _zeScale * factor));
  const cx = vp.clientWidth  / 2;
  const cy = vp.clientHeight / 2;
  _zePanX  = cx - (cx - _zePanX) * (newScale / _zeScale);
  _zePanY  = cy - (cy - _zePanY) * (newScale / _zeScale);
  _zeScale = newScale;
  _zeApplyTransform();
  zeRenderSvg();
};

window.zeZoomReset = function zeZoomReset() {
  const vp = document.getElementById('ze-viewport');
  if (!vp) return;
  _zeScale = Math.min(vp.clientWidth / 900, vp.clientHeight / 900);
  _zePanX  = (vp.clientWidth  - 900 * _zeScale) / 2;
  _zePanY  = (vp.clientHeight - 900 * _zeScale) / 2;
  _zeApplyTransform();
  zeRenderSvg();
};

function _zeInitPanZoom() {
  const vp = document.getElementById('ze-viewport');
  if (!vp || vp._zeEventsAttached) return;
  vp._zeEventsAttached = true;

  // Mouse wheel → zoom toward cursor
  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const rect   = vp.getBoundingClientRect();
    const cx     = e.clientX - rect.left;
    const cy     = e.clientY - rect.top;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newS   = Math.min(4, Math.max(0.15, _zeScale * factor));
    _zePanX = cx - (cx - _zePanX) * (newS / _zeScale);
    _zePanY = cy - (cy - _zePanY) * (newS / _zeScale);
    _zeScale = newS;
    _zeApplyTransform();
    zeRenderSvg();
  }, { passive: false });

  // Right-click drag → pan
  vp.addEventListener('mousedown', e => {
    if (e.button !== 2) return;
    e.preventDefault();
    _zeDragging  = true;
    _zeDragStart = { x: e.clientX - _zePanX, y: e.clientY - _zePanY };
    vp.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', e => {
    if (!_zeDragging) return;
    _zePanX = e.clientX - _zeDragStart.x;
    _zePanY = e.clientY - _zeDragStart.y;
    _zeApplyTransform();
  });
  window.addEventListener('mouseup', e => {
    if (e.button !== 2 || !_zeDragging) return;
    _zeDragging = false;
    vp.style.cursor = '';
  });
  vp.addEventListener('contextmenu', e => e.preventDefault());

  // Left click on SVG → add point
  const svg = document.getElementById('ze-svg');
  if (svg) {
    svg.addEventListener('click', e => {
      if (_zeDragging) return;
      const vpRect = vp.getBoundingClientRect();
      const px = (e.clientX - vpRect.left - _zePanX) / _zeScale;
      const py = (e.clientY - vpRect.top  - _zePanY) / _zeScale;
      if (px < 0 || py < 0 || px > 900 || py > 900) return;
      const game = _zePixelToGame(px, py);
      _zePoints.push({ px, py, gx: game.x, gy: game.y });
      zeRenderSvg();
      zeUpdateOutput();
    });
  }
}

function _zeMapSrc() {
  return _zeLayer === 'underground'
    ? `img/maps/floor-${_zeFloor}_underground.webp`
    : `img/maps/floor-${_zeFloor}.webp`;
}

function _zeUpdateLayerButtons() {
  const sur = document.getElementById('ze-layer-surface');
  const sub = document.getElementById('ze-layer-underground');
  if (!sur || !sub) return;
  const onSurface = _zeLayer !== 'underground';
  sur.style.background = onSurface ? 'var(--accent)' : 'transparent';
  sur.style.color      = onSurface ? '#fff' : 'var(--muted)';
  sub.style.background = !onSurface ? 'var(--accent)' : 'transparent';
  sub.style.color      = !onSurface ? '#fff' : 'var(--muted)';
}

window.zeLayerChange = function zeLayerChange(layer) {
  _zeLayer = layer;
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
  _zeUpdateLayerButtons();
};

function _zeInit() {
  _zeFloor = parseInt(document.getElementById('ze-floor')?.value || '1');
  _zeLayer = 'surface';
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
  _zeUpdateLayerButtons();
  _zePoints   = [];
  _zeMobsList = [];
  const s = document.getElementById('ze-mob-search');
  const r = document.getElementById('ze-mob-results');
  if (s) s.value = '';
  if (r) r.style.display = 'none';
  _zeInitPanZoom();
  zeZoomReset();
  zeRenderSvg();
  zeUpdateOutput();
  zeRenderMobList();
  _zeLoadMobs();
}

window.zeFloorChange = function zeFloorChange() {
  _zeFloor = parseInt(document.getElementById('ze-floor')?.value || '1');
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
};

// Calibration image → jeu
function _zeCalib() {
  return (typeof MAP_CALIBRATION !== 'undefined') ? MAP_CALIBRATION[_zeFloor] : null;
}
function _zePixelToGame(px, py) {
  const c = _zeCalib();
  if (!c) return { x: Math.round(px), y: Math.round(py) };
  const scale = c.radiusGame / c.radiusPixel;
  return { x: Math.round(c.centerGame.x + (px - c.centerPixel.x) * scale), y: Math.round(c.centerGame.y + (py - c.centerPixel.y) * scale) };
}

window.zeRenderSvg = function zeRenderSvg() {
  const svg   = document.getElementById('ze-svg');
  if (!svg) return;
  const color = document.getElementById('ze-color')?.value || '#ff4444';
  svg.innerHTML = '';
  if (_zePoints.length >= 2) {
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', _zePoints.map(p => `${p.px},${p.py}`).join(' '));
    poly.setAttribute('fill',            color + '44');
    poly.setAttribute('stroke',          color);
    poly.setAttribute('stroke-width',    String(2 / _zeScale));
    poly.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(poly);
  }
  _zePoints.forEach((p, i) => {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.cursor = 'pointer';
    g.addEventListener('click', ev => { ev.stopPropagation(); zeRemovePoint(i); });
    const r = 7 / _zeScale;
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', p.px); circle.setAttribute('cy', p.py);
    circle.setAttribute('r', r); circle.setAttribute('fill', color);
    circle.setAttribute('stroke', '#fff'); circle.setAttribute('stroke-width', String(2 / _zeScale));
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', p.px); label.setAttribute('y', p.py);
    label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('font-size', String(9 / _zeScale)); label.setAttribute('font-weight', '700');
    label.setAttribute('fill', '#fff'); label.style.pointerEvents = 'none';
    label.textContent = i + 1;
    g.appendChild(circle); g.appendChild(label);
    svg.appendChild(g);
  });
};

window.zeRemovePoint = function zeRemovePoint(i) {
  _zePoints.splice(i, 1);
  zeRenderSvg();
  zeUpdateOutput();
};

function zeUpdateOutput() {
  const countEl = document.getElementById('ze-count');
  const listEl  = document.getElementById('ze-points-list');
  if (countEl) countEl.textContent = _zePoints.length;
  if (listEl) {
    listEl.innerHTML = _zePoints.map((p, i) => `
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 0;">
        <span style="color:var(--muted);min-width:16px;text-align:right;">${i + 1}.</span>
        <span style="font-family:monospace;">X:${p.gx}&nbsp; Z:${p.gy}</span>
        <button class="btn btn-ghost btn-sm" onclick="zeRemovePoint(${i})" style="margin-left:auto;font-size:10px;padding:1px 6px;color:var(--danger);">✕</button>
      </div>
    `).join('');
  }
  zeCheckSave();
}

window.zeCheckSave = function zeCheckSave() {
  const btn  = document.getElementById('ze-save-btn');
  const name = document.getElementById('ze-name')?.value?.trim();
  if (btn) btn.disabled = !(name && _zePoints.length >= 3);
};

window.zoneEditorReset = function zoneEditorReset() {
  _zePoints   = [];
  _zeMobsList = [];
  _zeLayer    = 'surface';
  _zeUpdateLayerButtons();
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
  zeRenderSvg();
  zeUpdateOutput();
  zeRenderMobList();
};

window.zoneEditorSave = async function zoneEditorSave() {
  const name  = document.getElementById('ze-name')?.value?.trim();
  const desc  = document.getElementById('ze-desc')?.value?.trim();
  const color = document.getElementById('ze-color')?.value || '#ff4444';
  if (!name)               { toast('⚠ Nom de zone obligatoire', 'warning'); return; }
  if (_zePoints.length < 3){ toast('⚠ Minimum 3 points pour un polygone', 'warning'); return; }
  const polygon = _zePoints.map(p => ({ x: p.gx, z: p.gy }));
  const cx = Math.round(_zePoints.reduce((s, p) => s + p.gx, 0) / _zePoints.length);
  const cy = Math.round(_zePoints.reduce((s, p) => s + p.gy, 0) / _zePoints.length);
  const obj = { floor: _zeFloor, name, color, polygon, gx: cx, gy: cy, is_underground: _zeLayer === 'underground', createdAt: serverTimestamp() };
  if (desc) obj.desc = desc;
  if (_zeMobsList.length > 0) obj.mobs = _zeMobsList.map(m => m._id || m.id);
  try {
    const newId = `zone_${Date.now()}`;
    await setDoc(doc(db, COL.zones, newId), obj);
    toast('✓ Zone sauvegardée !', 'success');
    invalidateCache(COL.zones);
    zoneEditorReset();
    document.getElementById('ze-name').value = '';
    document.getElementById('ze-desc').value = '';
  } catch(err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════
// OBTENTIONS LIBRES (non structurées)
// ══════════════════════════════════════════════════════

// Patterns reconnus par le builder structuré (y compris anciens formats pour compatibilité)
const OBTAIN_STRUCTURED_PATTERNS = [
  /^Obtenable en tuant:$/,
  /^Obtenable en finissant le donjon:$/,
  /^-\s*\[([^|]+)\|([^\]]+)\]\[([^\]]+)\]$/,
  /^Obtenable en récompense du \[npc:[^|]+\|[^\]]+\]$/,
  /^Fabricable au \[npc:[^|]+\|[^\]]+\]$/,
  /^\[obtain:[\w-]+\]$/,
  /^Fabricable à la Forge( du Fractured Underworld)?$/,
  /^Achetable au \[npc:[^|]+\|[^\]]+\]$/,
  /^Récompense de la quête \[quest:[^|]+\|[^\]]+\]$/,
  /^Récompenses des quêtes\s*:$/,
  /^-\s*\[quest:[^|]+\|[^\]]+\]$/,
  /^Récoltable dans \[region:[^|]+\|[^\]]+\]$/,
  /^Autre source — .+$/,
  /^Récoltable dans \[region:[^|]+\|[^\]]+\]\s*\[coords:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]$/,
  /^Récoltable aux coordonnées \[coords:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]$/,
  /^Obtenable pendant l'Event \[.+\]$/,
  // Anciens formats (compatibilité)
  /^Trouvable dans un coffre — .+$/,
  /^Récompense d'événement — .+$/,
  /^Trouvable en exploration — .+$/,
];

function _isObtainStructured(obtain) {
  if (!obtain || !obtain.trim()) return true;
  for (const line of obtain.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (!OBTAIN_STRUCTURED_PATTERNS.some(rx => rx.test(t))) return false;
  }
  return true;
}

let _obtainLegacyAll  = [];
let _obtainLegacyShown = [];

window.showObtainLegacy = async function() {
  _setHash('obtain-legacy');
  _showPanel('obtain-legacy-panel', 'btn-obtain-legacy');
  await loadObtainLegacy();
};

window.loadObtainLegacy = async function() {
  const listEl = document.getElementById('obtain-legacy-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _obtainLegacyAll = [];

  // Invalider le cache pour avoir des données fraîches
  invalidateModCache('items');
  invalidateModCache(COL.itemsSecret);
  invalidateModCache(COL.itemsHidden);

  try {
    const [publicItems, secretItems, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs(COL.itemsSecret).catch(() => []),
      cachedDocs(COL.itemsHidden).catch(() => []),
    ]);

    // Map id → hidden doc (name, rarity, category) pour enrichir les items sensibles
    const hiddenById = new Map(hiddenItems.map(h => [String(h.id), h]));

    const sensibleItems = secretItems
      .filter(s => s.obtain)
      .map(s => {
        const h = hiddenById.get(String(s.id)) || {};
        return { ...h, ...s, _isSensible: true };
      });

    _obtainLegacyAll = [...publicItems, ...sensibleItems]
      .filter(i => i.obtain && !_isObtainStructured(i.obtain));
  } catch(e) {
    listEl.innerHTML = '<div class="empty">Erreur : ' + e.message + '</div>';
    return;
  }

  const badge = document.getElementById('count-obtain-legacy');
  if (badge) {
    badge.textContent = _obtainLegacyAll.length;
    badge.style.display = _obtainLegacyAll.length ? '' : 'none';
  }

  filterObtainLegacy();
};

window.filterObtainLegacy = function() {
  const q   = (document.getElementById('obtain-legacy-search')?.value || '').toLowerCase();
  const cat = document.getElementById('obtain-legacy-cat')?.value || '';
  _obtainLegacyShown = _obtainLegacyAll.filter(i => {
    if (cat && i.category !== cat) return false;
    if (q && !((i.name || '').toLowerCase().includes(q)) && !((i.obtain || '').toLowerCase().includes(q))) return false;
    return true;
  });
  _renderObtainLegacy();
};

function _renderObtainLegacy() {
  const listEl = document.getElementById('obtain-legacy-list');
  if (!_obtainLegacyShown.length) {
    listEl.innerHTML = '<div class="empty">' + (_obtainLegacyAll.length ? 'Aucun résultat pour ce filtre.' : '✓ Aucun item avec obtention libre — tout est structuré !') + '</div>';
    return;
  }

  const RARITY_COLORS = { commun:'#aaa', rare:'#4da6ff', epique:'#c47aff', legendaire:'#ffb830', mythique:'#ff6060', godlike:'#ff3aba', event:'#60e8b0' };
  const CAT_ICONS = { arme:'⚔️', armure:'🛡️', accessoire:'💍', consommable:'🧪', nourriture:'🍖', parchemin:'📃', materiaux:'🧱', ressources:'⛏️', outils:'🛠️', rune:'🔮', quete:'📜', donjon:'🏰', monnaie:'🪙' };

  listEl.innerHTML = '';
  listEl.dataset.dqList = '1';
  for (const item of _obtainLegacyShown) {
    const row = document.createElement('div');
    row.dataset.dqKey = String(item.id || item.name || '');
    row.dataset.dqId = String(item.id || '');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);margin-bottom:6px;';

    const rarColor = RARITY_COLORS[item.rarity] || '#aaa';
    const catIcon  = CAT_ICONS[item.category] || '📦';

    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;';
    left.innerHTML =
      `<div data-dq-badge="1" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">` +
        `<span style="font-size:12px;">${catIcon}</span>` +
        `<span style="font-size:14px;font-weight:700;color:${rarColor};">${item.name || '(sans nom)'}</span>` +
        `<span style="font-size:10px;color:var(--muted);font-family:monospace;">${item.id || ''}</span>` +
        (item.rarity ? `<span style="font-size:10px;padding:1px 7px;border-radius:8px;border:1px solid ${rarColor}40;color:${rarColor};background:${rarColor}12;">${item.rarity}</span>` : '') +
      `</div>` +
      `<div style="font-size:11px;color:var(--muted);font-family:monospace;white-space:pre-wrap;background:rgba(0,0,0,.2);border-radius:4px;padding:5px 8px;border-left:2px solid var(--border);">${(item.obtain || '').replace(/</g,'&lt;')}</div>`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'flex-shrink:0;font-size:11px;padding:5px 11px;white-space:nowrap;';
    editBtn.innerHTML = '✏️ Éditer';
    editBtn.onclick = () => {
      sessionStorage.setItem('editSub', JSON.stringify({ type: 'item', data: item }));
      window.open('creator.html', '_blank');
    };

    row.appendChild(left);
    row.appendChild(editBtn);
    listEl.appendChild(row);
  }

  const summary = document.createElement('div');
  summary.style.cssText = 'font-size:11px;color:var(--muted);text-align:right;margin-top:4px;';
  summary.textContent = _obtainLegacyShown.length + ' item' + (_obtainLegacyShown.length > 1 ? 's' : '');
  listEl.appendChild(summary);
}

// ══════════════════════════════════════════════════════
// DATA ALL PANEL
// ══════════════════════════════════════════════════════

let _dataAllLoaded  = false;
let _dataAllData    = [];
let _dataAllFlagSet = new Set();

const _DATA_ALL_COLS = {
  item:     { col: 'items',       nameKey: 'name',  label: '⚔️' },
  mob:      { col: 'mobs',        nameKey: 'name',  label: '👾' },
  pnj:      { col: 'personnages', nameKey: 'name',  label: '🧑' },
  region:   { col: 'regions',     nameKey: 'name',  label: '📍' },
  quest:    { col: 'quetes',      nameKey: 'titre', label: '📜' },
  panoplie: { col: 'panoplies',   nameKey: 'label', label: '🔗' },
};

const _DATA_ALL_FLAGS = [
  { key: 'evolutif',   label: '🔄 Évolutif',      types: ['item'],                            filter: d => d.evolutif === true },
  { key: 'event',      label: '🎊 Event',          types: ['item'],                            filter: d => d.palier === 'event' },
  { key: 'sensible',   label: '🔒 Sensible',       types: ['item','mob','pnj'],                filter: d => d.sensible === true },
  { key: 'boss',       label: '💀 Boss',           types: ['mob'],                             filter: d => d.type === 'boss' },
  { key: 'miniboss',   label: '⚔️ Mini-Boss',     types: ['mob'],                             filter: d => d.type === 'miniboss' },
  { key: 'codex',      label: '📖 Codex',          types: ['mob','region'],                    filter: d => d.codex === true },
  { key: 'sans_lore',  label: '📖 Sans lore',      types: ['item','mob'],                      filter: d => !d.lore },
  { key: 'avec_craft', label: '🔨 Avec craft',     types: ['item'],                            filter: d => Array.isArray(d.craft) && d.craft.length > 0 },
  { key: 'avec_evo',   label: '🔀 Avec évolutions',types: ['item'],                            filter: d => Array.isArray(d.evolutions) && d.evolutions.length > 0 },
  { key: 'no_palier',  label: '❓ Sans palier',    types: ['item','mob','pnj','region','quest'],filter: d => !d.palier },
  { key: 'sans_image', label: '🖼️ Sans image',    types: ['item','mob'],                      filter: d => !d.images?.length },
  { key: 'sans_obtain',label: '📍 Sans obtention', types: ['item'],                            filter: d => !d.obtain },
  { key: 'sans_stats', label: '📊 Sans stats',     types: ['item'],                            filter: d => !d.stats },
  { key: 'avec_set',   label: '◈ Avec set',        types: ['item'],                            filter: d => !!d.set },
  { key: 'unique',     label: '✦ Unique',          types: ['item'],                            filter: d => !!d.unique },
  { key: 'deux_mains', label: '⚔️⚔️ 2 mains',    types: ['item'],                            filter: d => !!d.twoHanded },
  { key: 'avec_effets',label: '✨ Avec effets',    types: ['item','mob'],                      filter: d => Array.isArray(d.effects) && d.effects.length > 0 },
];

window.showDataAll = async function() {
  _setHash('data-all');
  document.getElementById('data-all-panel').style.display = '';
  document.getElementById('btn-data-all').classList.add('active');
  _buildDataAllChips();
  if (!_dataAllLoaded) await loadDataAll();
  else renderDataAll();
};

let _loadDataAllInFlight = null;
window.loadDataAll = async function() {
  // Garde anti-réentrance : si un load est déjà en cours, on retourne sa promesse
  // → évite que deux clics rapides (ou hash routing + bouton) doublent _dataAllData
  if (_loadDataAllInFlight) return _loadDataAllInFlight;
  _loadDataAllInFlight = (async () => {
    _dataAllLoaded = false;
    _dataAllData   = [];
    const listEl = document.getElementById('data-all-list');
    if (listEl) listEl.innerHTML = '<div class="empty">Chargement…</div>';

    try {
      for (const [type, conf] of Object.entries(_DATA_ALL_COLS)) {
        const docs = await cachedDocs(conf.col);
        for (const d of docs) {
          _dataAllData.push({
            _type:  type,
            _col:   conf.col,
            _icon:  conf.label,
            _docKey: d._docKey,
            id:     d.id,
            name:   d[conf.nameKey] || d.name || d.id,
            ...d
          });
        }
      }
      // Ajouter les items sensibles (items_hidden + compléments items_secret)
      // Dédupliquer par id logique : ne pas ajouter si un item avec le même id est déjà dans la liste
      try {
        const existingItemIds = new Set(
          _dataAllData.filter(d => d._type === 'item').map(d => String(d.id))
        );
        const hiddenDocs = await cachedDocs(COL.itemsHidden);
        const secretDocs = await cachedDocs(COL.itemsSecret).catch(() => []);
        const secretMap  = new Map(secretDocs.map(d => [String(d.id || d._id || ''), d]));
        for (const d of hiddenDocs) {
          if (existingItemIds.has(String(d.id))) continue;
          const sec = secretMap.get(String(d.id || '')) || {};
          _dataAllData.push({
            _type: 'item', _col: COL.itemsHidden, _icon: '⚔️',
            _docKey: d._docKey,                      // hash réel (clé Firestore)
            id: d.id, name: d.name || d.id,
            sensible: true,
            ...d, ...sec,
            _docKey: d._docKey,                      // re-protéger après spread (sec.id ne doit pas écraser)
          });
        }
      } catch {}

      // Mobs sensibles
      try {
        const existingMobIds = new Set(_dataAllData.filter(d => d._type === 'mob').map(d => String(d.id)));
        const secretMobs = await cachedDocs(COL.mobsSecret).catch(() => []);
        for (const d of secretMobs) {
          if (existingMobIds.has(String(d.id))) continue;
          _dataAllData.push({
            _type: 'mob', _col: COL.mobsSecret, _icon: '👾',
            _docKey: d._docKey, id: d.id, name: d.name || d.id,
            sensible: true, ...d, _docKey: d._docKey,
          });
        }
      } catch {}

      // PNJ sensibles
      try {
        const existingPnjIds = new Set(_dataAllData.filter(d => d._type === 'pnj').map(d => String(d.id)));
        const secretPnjs = await cachedDocs(COL.pnjSecret).catch(() => []);
        for (const d of secretPnjs) {
          if (existingPnjIds.has(String(d.id))) continue;
          _dataAllData.push({
            _type: 'pnj', _col: COL.pnjSecret, _icon: '🧑',
            _docKey: d._docKey, id: d.id, name: d.name || d.id,
            sensible: true, ...d, _docKey: d._docKey,
          });
        }
      } catch {}

      // Filet de sécurité : dédup finale par (collection, clé Firestore réelle)
      const _seen = new Set();
      _dataAllData = _dataAllData.filter(d => {
        const k = `${d._col}::${d._docKey || d.id}`;
        if (_seen.has(k)) return false;
        _seen.add(k);
        return true;
      });

      _dataAllLoaded = true;
      renderDataAll();
    } catch(e) {
      if (listEl) listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
    }
  })();
  try { await _loadDataAllInFlight; }
  finally { _loadDataAllInFlight = null; }
};

window.onDataAllTypeChange = function() {
  _dataAllFlagSet = new Set();
  _buildDataAllChips();
  const typeVal    = document.getElementById('data-all-type')?.value || '';
  const catSel     = document.getElementById('data-all-category');
  const raritySel  = document.getElementById('data-all-rarity');
  if (catSel)    catSel.style.display    = (typeVal === 'item') ? '' : 'none';
  if (raritySel) raritySel.style.display = (typeVal === 'item') ? '' : 'none';
  renderDataAll();
};

function _buildDataAllChips() {
  const chipsEl = document.getElementById('data-all-chips');
  if (!chipsEl) return;
  const selectedType = document.getElementById('data-all-type')?.value || '';
  chipsEl.innerHTML = '';

  _DATA_ALL_FLAGS
    .filter(f => !selectedType || f.types.includes(selectedType))
    .forEach(f => {
      const chip = document.createElement('button');
      chip.className = 'filter-btn';
      chip.style.cssText = 'font-size:11px;padding:2px 10px;border-radius:20px;';
      chip.textContent = f.label;
      if (_dataAllFlagSet.has(f.key)) chip.classList.add('active');
      chip.onclick = () => {
        if (_dataAllFlagSet.has(f.key)) _dataAllFlagSet.delete(f.key);
        else _dataAllFlagSet.add(f.key);
        chip.classList.toggle('active');
        renderDataAll();
      };
      chipsEl.appendChild(chip);
    });
}

// Tri « Ancien palier » : proposé uniquement quand le filtre est sur le palier Archive (-1)
// et qu'il reste des items archivés ; l'option disparaît d'elle-même une fois l'archive vidée.
function _daSyncOldPalierSort(palierFilter) {
  const sel = document.getElementById('data-all-sort');
  if (!sel) return;
  const available = palierFilter === '-1' && _dataAllData.some(d => d.palier == -1 && d._oldPalier != null);
  const opt = sel.querySelector('option[value="old"]');
  if (available && !opt) {
    const o = document.createElement('option');
    o.value = 'old';
    o.textContent = 'Ancien palier (archive)';
    sel.appendChild(o);
  } else if (!available && opt) {
    if (sel.value === 'old') sel.value = 'name';
    opt.remove();
  }
}

// Filtre « Ex-palier » : équipements de l'archive (palier -1) selon leur ancien palier (ex-P1, ex-P2…).
// Le menu n'apparaît que s'il reste des items archivés ; il disparaît de lui-même une fois l'archive vidée.
const _EX_PALIER_EQUIP = new Set(['arme', 'armure', 'accessoire']);
let _exPalierSel = ''; // ancien palier sélectionné ('' = aucun) ; une seule pastille active à la fois
function _daSyncExPalierFilter() {
  const box = document.getElementById('data-all-expalier');
  if (!box) return '';
  const olds = [...new Set(_dataAllData.filter(d => d.palier == -1 && d._oldPalier != null).map(d => String(d._oldPalier)))]
    .sort((a, b) => (Number(a) || 98) - (Number(b) || 98));
  if (!olds.includes(_exPalierSel)) _exPalierSel = '';
  box.innerHTML = '';
  olds.forEach(o => {
    const n = _dataAllData.filter(d => d.palier == -1 && String(d._oldPalier) === o && _EX_PALIER_EQUIP.has(d.category)).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-btn' + (o === _exPalierSel ? ' active' : '');
    chip.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:20px;';
    chip.title = `Équipements de l'archive qui étaient en palier ${o} (cliquer de nouveau pour retirer le filtre)`;
    chip.textContent = `ex-P${o} (${n})`;
    chip.onclick = () => { _exPalierSel = (_exPalierSel === o) ? '' : o; renderDataAll(); };
    box.appendChild(chip);
  });
  box.style.display = olds.length ? 'inline-flex' : 'none';
  return _exPalierSel;
}

window.renderDataAll = function() {
  if (!_dataAllLoaded) return;
  const listEl    = document.getElementById('data-all-list');
  const countEl   = document.getElementById('data-all-count');
  if (!listEl) return;

  const searchQ      = normalize((document.getElementById('data-all-search')?.value || '').trim());
  const typeFilter   = document.getElementById('data-all-type')?.value    || '';
  const palierFilter = document.getElementById('data-all-palier')?.value  || '';
  const catFilter    = document.getElementById('data-all-category')?.value || '';
  const rarityFilter = document.getElementById('data-all-rarity')?.value  || '';
  _daSyncOldPalierSort(palierFilter);
  const sortBy       = document.getElementById('data-all-sort')?.value    || 'name';

  let results = _dataAllData;

  if (typeFilter)   results = results.filter(d => d._type === typeFilter);
  if (palierFilter) results = results.filter(d => String(d.palier) === palierFilter);
  const exPalier = _daSyncExPalierFilter();
  if (exPalier) results = results.filter(d => d.palier == -1 && String(d._oldPalier) === exPalier && _EX_PALIER_EQUIP.has(d.category));
  if (catFilter)    results = results.filter(d => d.category === catFilter);
  if (rarityFilter) results = results.filter(d => d._type === 'item' && d.rarity === rarityFilter);
  if (searchQ)      results = results.filter(d =>
    fuzzyMatch(searchQ, d.name || '') ||
    fuzzyMatch(searchQ, d.id   || '') ||
    (d.tags || []).some(t => fuzzyMatch(searchQ, t)) ||
    (d.set  && fuzzyMatch(searchQ, d.set))
  );

  for (const flagKey of _dataAllFlagSet) {
    const def = _DATA_ALL_FLAGS.find(f => f.key === flagKey);
    if (def) results = results.filter(d => def.filter(d));
  }

  // Sort
  results = [...results];
  if (sortBy === 'name')   results.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  else if (sortBy === 'palier') results.sort((a, b) => (a.palier || 9) - (b.palier || 9) || (a.name || '').localeCompare(b.name || '', 'fr'));
  else if (sortBy === 'old') {
    const oldRank = d => { const n = Number(d._oldPalier); return Number.isFinite(n) ? n : 98; };
    results.sort((a, b) => oldRank(a) - oldRank(b) || (a.name || '').localeCompare(b.name || '', 'fr'));
  }
  else if (sortBy === 'type')  results.sort((a, b) => a._type.localeCompare(b._type) || (a.name || '').localeCompare(b.name || '', 'fr'));

  if (countEl) countEl.textContent = `${results.length} résultat${results.length !== 1 ? 's' : ''}`;

  if (!results.length) {
    listEl.innerHTML = '<div class="empty">Aucun résultat</div>';
    return;
  }

  listEl.innerHTML = '';
  const COL_MAP = { item:'items', mob:'mobs', pnj:'personnages', region:'regions', quest:'quetes', panoplie:'panoplies' };

  results.forEach(d => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameEl.innerHTML = `${d._icon} <b>${escHtml(d.name || d.id)}</b>`;

    const idEl = document.createElement('code');
    idEl.style.cssText = 'font-size:10px;color:var(--muted);flex-shrink:0;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    idEl.textContent = d.id;

    const badgesEl = document.createElement('span');
    badgesEl.style.cssText = 'display:flex;gap:3px;flex-shrink:0;flex-wrap:nowrap;';

    if (d.palier) _daAddBadge(badgesEl, d.palier == -1 ? 'Archive' : 'P'+d.palier, 'var(--accent)', 'rgba(224,172,96,.15)');
    if (d.palier == -1 && d._oldPalier != null) _daAddBadge(badgesEl, 'ex-P' + d._oldPalier, '#60a5fa', 'rgba(96,165,250,.12)');
    if (d.category) _daAddBadge(badgesEl, d.category, 'var(--muted)', 'transparent');
    if (d.rarity && d._type === 'item') {
      const _RC = { commun:'#aaa', rare:'#4da6ff', epique:'#c47aff', legendaire:'#ffb830', mythique:'#ff6060', godlike:'#ff3aba', event:'#60e8b0' };
      const rc = _RC[d.rarity] || '#aaa';
      _daAddBadge(badgesEl, d.rarity, rc, rc + '22');
    }
    if (d.set)                 _daAddBadge(badgesEl, '◈ ' + d.set, 'var(--muted)', 'rgba(255,255,255,.04)');
    if (d.evolutif)            _daAddBadge(badgesEl, '🔄', '#60a5fa', 'rgba(96,165,250,.1)');
    if (d.palier === 'event')  _daAddBadge(badgesEl, '🎊', '#a855f7', 'rgba(168,85,247,.1)');
    if (d.sensible)            _daAddBadge(badgesEl, '🔒', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'boss')     _daAddBadge(badgesEl, 'Boss', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'miniboss') _daAddBadge(badgesEl, 'Mini', '#f59e0b', 'rgba(245,158,11,.1)');
    if (d.codex)               _daAddBadge(badgesEl, 'Codex', '#4ade80', 'rgba(74,222,128,.1)');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
    editBtn.textContent = '✏️';
    editBtn.title = 'Éditer dans le panneau';
    editBtn.onclick = () => {
      let col;
      if (d.sensible && d._type === 'item') col = 'items_sensible';
      else if (d.sensible && d._type === 'mob') col = 'mobs_secret';
      else if (d.sensible && d._type === 'pnj') col = 'pnj_secret';
      else col = d._col || COL_MAP[d._type] || d._type;
      showEditor(col, d.sensible ? (d._docKey || d.id) : d.id, d, 'data-all');
    };

    const compUrl = d._type === 'item'
      ? `Compendium/compendium.html#${encodeURIComponent(d.id)}`
      : d._type === 'mob'
        ? `Bestiaire/bestiaire.html#monstres/${encodeURIComponent(d.id)}`
        : d._type === 'pnj'
          ? `Bestiaire/bestiaire.html#personnages/${encodeURIComponent(d.id)}`
          : null;
    row.appendChild(nameEl);
    row.appendChild(idEl);
    row.appendChild(badgesEl);
    row.appendChild(editBtn);

    if (compUrl) {
      const compBtn = document.createElement('a');
      compBtn.className = 'btn btn-ghost';
      compBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;text-decoration:none;';
      compBtn.textContent = '📖';
      compBtn.title = 'Voir dans le Compendium / Bestiaire';
      compBtn.href = compUrl;
      compBtn.target = '_blank';
      compBtn.setAttribute('draggable', 'false');
      compBtn.addEventListener('click', e => e.stopPropagation());
      row.appendChild(compBtn);
    }

    listEl.appendChild(row);
  });
};

window.deleteDataDuplicates = async function() {
  if (!_dataAllLoaded || !_dataAllData.length) {
    toast('⚠️ Chargez d\'abord les données (🔄 Rafraîchir)', 'warning');
    return;
  }
  // Trouver les doublons : même id dans la même collection
  const seen = new Map(); // `col:id` → first entry
  const dupes = [];
  for (const d of _dataAllData) {
    const key = `${d._col}:${d.id}`;
    if (seen.has(key)) {
      dupes.push(d);
    } else {
      seen.set(key, d);
    }
  }
  if (!dupes.length) { toast('✓ Aucun doublon détecté.', 'success'); return; }
  const list = dupes.map(d => `  • ${d._col}/${d.id} — ${d.name || '—'}`).join('\n');
  if (!await modal.confirm(`${dupes.length} doublon(s) détecté(s) :\n\n${list}\n\nSupprimer ces entrées ?`)) return;
  let deleted = 0;
  for (const d of dupes) {
    try {
      await deleteDoc(doc(db, d._col, d.id));
      _dataAllData = _dataAllData.filter(x => !(x.id === d.id && x._col === d._col && x !== seen.get(`${d._col}:${d.id}`)));
      localStorage.removeItem(`vcl_cache_v2_${d._col}`);
      localStorage.removeItem(`vcl_cache_meta_v2_${d._col}`);
      invalidateModCache(d._col);
      deleted++;
    } catch(e) {
      toast(`⛔ Erreur ${d.id} : ${e.message}`, 'error');
    }
  }
  toast(`✓ ${deleted} doublon(s) supprimé(s)`, 'success');
  _dataAllLoaded = false;
  renderDataAll();
};

function _daAddBadge(container, text, color, bg) {
  const b = document.createElement('span');
  b.style.cssText = `font-size:10px;padding:1px 5px;border-radius:8px;color:${color};background:${bg};border:1px solid ${color}40;white-space:nowrap;flex-shrink:0;`;
  b.textContent = text;
  container.appendChild(b);
}

/* ══════════════════════════════════════════════════════
   ÉDITEUR DE ZONES — Sélection de mobs
══════════════════════════════════════════════════════ */

let _zeMobsList = [];
let _zeMobsDb   = [];

async function _zeLoadMobs() {
  if (_zeMobsDb.length > 0) { _zePopulateMobSelect(); return; }
  try {
    const snap = await getDocs(collection(db, COL.mobs));
    _zeMobsDb = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      .filter(m => m.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    _zePopulateMobSelect();
  } catch(e) {
    console.warn('[ZoneEditor] chargement mobs échoué', e);
  }
}

window.zeSearchMob = function zeSearchMob() {
  const q       = (document.getElementById('ze-mob-search')?.value || '').trim();
  const results = document.getElementById('ze-mob-results');
  if (!results) return;
  if (q.length < 1) { results.style.display = 'none'; return; }
  const addedIds = new Set(_zeMobsList.map(m => m._id || m.id));
  const norm     = q.toLowerCase();
  const matches  = _zeMobsDb
    .filter(m => !addedIds.has(m._id || m.id) && (m.name || '').toLowerCase().includes(norm))
    .slice(0, 15);
  results.innerHTML = '';
  if (!matches.length) {
    const noRes = document.createElement('div');
    noRes.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--muted);';
    noRes.textContent = 'Aucun résultat';
    results.appendChild(noRes);
    results.style.display = '';
    return;
  }
  matches.forEach(m => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);';
    div.innerHTML = '💀 <span>' + (m.name || m._id || m.id) + '</span>';
    div.addEventListener('mouseenter', () => { div.style.background = 'var(--surface2)'; });
    div.addEventListener('mouseleave', () => { div.style.background = ''; });
    div.addEventListener('click', e => {
      e.stopPropagation();
      zeAddMob(m._id || m.id, m.name || '');
    });
    results.appendChild(div);
  });
  results.style.display = '';
};

function _zePopulateMobSelect(selectId, filter) {
  const sel = document.getElementById(selectId || 'ze-mob-select');
  if (!sel) return;
  const addedIds = new Set(_zeMobsList.map(m => m._id || m.id));
  const q = (filter || '').toLowerCase();
  sel.innerHTML = '<option value="">— Choisir un mob —</option>' +
    _zeMobsDb.map(m => {
      const id = m._id || m.id;
      if (addedIds.has(id)) return '';
      if (q && !(m.name || '').toLowerCase().includes(q)) return '';
      return '<option value="' + id + '">' + (m.name || id) + '</option>';
    }).join('');
}

window.zeAddMobFromSelect = function zeAddMobFromSelect(selectId) {
  const sel = document.getElementById(selectId || 'ze-mob-select');
  if (!sel || !sel.value) return;
  const id  = sel.value;
  if (_zeMobsList.some(m => (m._id || m.id) === id)) { sel.value = ''; return; }
  const mob = _zeMobsDb.find(m => (m._id || m.id) === id);
  _zeMobsList.push(mob || { _id: id, name: id });
  sel.value = '';
  zeRenderMobList();
  _zePopulateMobSelect(selectId);
};

window.zeAddMob = function zeAddMob(id, name) {
  if (_zeMobsList.some(m => (m._id || m.id) === id)) return;
  const mob = _zeMobsDb.find(m => (m._id || m.id) === id);
  _zeMobsList.push(mob || { _id: id, name });
  const search  = document.getElementById('ze-mob-search');
  const results = document.getElementById('ze-mob-results');
  if (search)  search.value = '';
  if (results) results.style.display = 'none';
  zeRenderMobList();
};

window.zeRemoveMob = function zeRemoveMob(id) {
  _zeMobsList = _zeMobsList.filter(m => (m._id || m.id) !== id);
  zeRenderMobList();
};

window.zeRenderMobList = function zeRenderMobList() {
  const listEl = document.getElementById('ze-mob-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!_zeMobsList.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:var(--muted);padding:4px 0;';
    empty.textContent = 'Aucun mob lié';
    listEl.appendChild(empty);
    return;
  }
  _zeMobsList.forEach(m => {
    const id  = m._id || m.id;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-bottom:4px;';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:13px;flex:1;';
    nameEl.textContent = '💀 ' + (m.name || id);
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn btn-ghost btn-sm';
    rmBtn.style.cssText = 'font-size:10px;padding:2px 7px;color:var(--danger);';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => zeRemoveMob(id));
    row.appendChild(nameEl);
    row.appendChild(rmBtn);
    listEl.appendChild(row);
  });
};

document.addEventListener('click', e => {
  if (!e.target.closest('#ze-mob-search') && !e.target.closest('#ze-mob-results')) {
    const r = document.getElementById('ze-mob-results');
    if (r) r.style.display = 'none';
  }
});

/* ══════════════════════════════════════════════════════
   LISTE DES ZONES
══════════════════════════════════════════════════════ */

let _zoneListAll  = [];
let _zlMobsDb     = [];

window.showZoneList = async function showZoneList() {
  _setHash('zone-list');
  _showPanel('zone-list-panel', 'btn-zone-list');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadZoneList();
};

window.loadZoneList = async function loadZoneList() {
  const el = document.getElementById('zone-list-content');
  el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snapZ, snapM] = await Promise.all([
      getDocs(collection(db, COL.zones)),
      getDocs(collection(db, COL.mobs)),
    ]);
    _zoneListAll = snapZ.docs.map(d => ({ _id: d.id, ...d.data() }));
    _zlMobsDb    = snapM.docs.map(d => ({ _id: d.id, ...d.data() }))
      .filter(m => m.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderZoneList();
  } catch(e) {
    el.innerHTML = '<div class="empty" style="color:var(--danger)">⛔ ' + e.message + '</div>';
  }
};

window.renderZoneList = function renderZoneList() {
  const el      = document.getElementById('zone-list-content');
  const floorF  = document.getElementById('zl-filter-floor')?.value || '';
  const searchF = (document.getElementById('zl-search')?.value || '').toLowerCase();
  const mobsById = new Map(_zlMobsDb.map(m => [m._id || m.id, m]));

  const filtered = _zoneListAll.filter(z => {
    if (floorF  && String(z.floor) !== floorF) return false;
    if (searchF && !(z.name || '').toLowerCase().includes(searchF)) return false;
    return true;
  }).sort((a, b) => (a.floor || 1) - (b.floor || 1) || (a.name || '').localeCompare(b.name || ''));

  if (!filtered.length) { el.innerHTML = '<div class="empty">Aucune zone</div>'; return; }

  el.innerHTML = '';
  let currentFloor = null;
  filtered.forEach(zone => {
    // En-tête de palier
    if (zone.floor !== currentFloor) {
      currentFloor = zone.floor;
      const floorHeader = document.createElement('div');
      floorHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
      floorHeader.textContent = 'Palier ' + (zone.floor || '?');
      el.appendChild(floorHeader);
    }

    const color  = zone.color || '#e0ac60';
    const mobIds = zone.mobs || [];
    const card   = document.createElement('div');
    card.id = 'zl-card-' + zone._id;
    card.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);cursor:pointer;';
    const colorDot = document.createElement('span');
    colorDot.style.cssText = 'width:14px;height:14px;border-radius:3px;flex-shrink:0;display:inline-block;background:' + color + ';';
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;font-size:13px;font-weight:600;';
    nameSpan.textContent = zone.name || '—';
    const mobCount = document.createElement('span');
    mobCount.style.cssText = 'font-size:11px;color:var(--muted);';
    mobCount.textContent = mobIds.length + ' mob' + (mobIds.length > 1 ? 's' : '');
    const ugBadge = document.createElement('span');
    ugBadge.style.cssText = 'font-size:10px;padding:1px 7px;border-radius:10px;' + (zone.is_underground
      ? 'background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3);'
      : 'background:rgba(16,185,129,.1);color:#6ee7b7;border:1px solid rgba(16,185,129,.25);');
    ugBadge.textContent = zone.is_underground ? '🕳️ Sous-sol' : '🌿 Surface';
    const chevron = document.createElement('span');
    chevron.style.cssText = 'font-size:11px;color:var(--muted);';
    chevron.textContent = '▾';
    header.appendChild(colorDot);
    header.appendChild(nameSpan);
    header.appendChild(mobCount);
    header.appendChild(ugBadge);
    header.appendChild(chevron);

    const body = document.createElement('div');
    body.style.cssText = 'display:none;padding:12px 14px;';

    header.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      chevron.textContent = open ? '▾' : '▴';
      if (!open) _renderZoneMobEditor(zone, body, mobsById, header, nameSpan, colorDot, mobCount, ugBadge);
    });

    card.appendChild(header);
    card.appendChild(body);
    el.appendChild(card);
  });
};

function _renderZoneMobEditor(zone, body, mobsById, header, nameSpan, colorDot, mobCountSpan, ugBadge) {
  body.innerHTML = '';

  // ── Champs éditables ─────────────────────────────
  const fieldsGrid = document.createElement('div');
  fieldsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 110px 48px auto;gap:8px;margin-bottom:12px;align-items:end;';

  function _field(label, el) {
    const wrap = document.createElement('div');
    const lbl  = document.createElement('label');
    lbl.style.cssText = 'font-size:10px;color:var(--muted);display:block;margin-bottom:3px;';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  }
  function _input(val) {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = val || '';
    el.style.cssText = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
    return el;
  }

  const nameInput = _input(zone.name);
  const descInput = _input(zone.desc || zone.description || '');

  const floorSel = document.createElement('select');
  floorSel.style.cssText = 'width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
  [1,2,3].forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = 'Palier ' + n;
    if ((zone.floor || 1) === n) o.selected = true;
    floorSel.appendChild(o);
  });

  const colorPick = document.createElement('input');
  colorPick.type  = 'color';
  colorPick.value = zone.color || '#e0ac60';
  colorPick.style.cssText = 'width:48px;height:34px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;';

  const ugCheck = document.createElement('input');
  ugCheck.type    = 'checkbox';
  ugCheck.checked = !!zone.is_underground;
  ugCheck.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:var(--accent);margin-top:6px;';

  const ugWrap = document.createElement('div');
  ugWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
  const ugLbl = document.createElement('label');
  ugLbl.style.cssText = 'font-size:10px;color:var(--muted);';
  ugLbl.textContent = 'Sous-sol';
  ugWrap.appendChild(ugLbl);
  ugWrap.appendChild(ugCheck);

  fieldsGrid.appendChild(_field('Nom', nameInput));
  fieldsGrid.appendChild(_field('Description', descInput));
  fieldsGrid.appendChild(_field('Palier', floorSel));
  fieldsGrid.appendChild(_field('Couleur', colorPick));
  fieldsGrid.appendChild(ugWrap);
  body.appendChild(fieldsGrid);

  // Boutons Sauvegarder / Supprimer
  const actRow = document.createElement('div');
  actRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border);';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:12px;';
  saveBtn.textContent = '💾 Sauvegarder';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const updates = {
      name:          nameInput.value.trim(),
      desc:          descInput.value.trim(),
      floor:         parseInt(floorSel.value),
      color:         colorPick.value,
      is_underground: ugCheck.checked,
    };
    try {
      await setDoc(doc(db, COL.zones, zone._id), updates, { merge: true });
      Object.assign(zone, updates);
      invalidateCache(COL.zones);
      if (nameSpan)  nameSpan.textContent = zone.name || '—';
      if (colorDot)  colorDot.style.background = zone.color;
      if (ugBadge) {
        ugBadge.textContent = zone.is_underground ? '🕳️ Sous-sol' : '🌿 Surface';
        ugBadge.style.cssText = 'font-size:10px;padding:1px 7px;border-radius:10px;' + (zone.is_underground
          ? 'background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3);'
          : 'background:rgba(16,185,129,.1);color:#6ee7b7;border:1px solid rgba(16,185,129,.25);');
      }
      toast('✓ Zone mise à jour', 'success');
    } catch(e) {
      toast('⛔ ' + e.message, 'error');
    }
    saveBtn.disabled = false;
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-reject';
  delBtn.style.cssText = 'font-size:12px;';
  delBtn.textContent = '🗑️ Supprimer';
  delBtn.addEventListener('click', async () => {
    if (!await modal.confirm(`Supprimer la zone <b>${escHtml(zone.name || zone._id)}</b> ?<br>Cette action est irréversible.`, { danger: true, confirmLabel: 'Supprimer' })) return;
    try {
      await deleteDoc(doc(db, COL.zones, zone._id));
      invalidateCache(COL.zones);
      _zoneListAll = _zoneListAll.filter(z => z._id !== zone._id);
      const card = document.getElementById('zl-card-' + zone._id);
      if (card) card.remove();
      toast('✓ Zone supprimée', 'success');
    } catch(e) {
      toast('⛔ ' + e.message, 'error');
    }
  });

  actRow.appendChild(saveBtn);
  actRow.appendChild(delBtn);
  body.appendChild(actRow);

  // ── Mobs liés ────────────────────────────────────
  const mobLabel = document.createElement('div');
  mobLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;';
  mobLabel.textContent = 'Mobs liés';
  body.appendChild(mobLabel);

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:10px;';

  const refreshMobList = () => {
    listWrap.innerHTML = '';
    const mobIds = zone.mobs || [];
    if (!mobIds.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--muted);';
      empty.textContent = 'Aucun mob lié';
      listWrap.appendChild(empty);
    } else {
      mobIds.forEach(id => {
        const mob  = mobsById.get(id);
        const name = mob ? mob.name : id;
        const row  = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'flex:1;font-size:13px;';
        nameEl.textContent = '💀 ' + name;
        const rmBtn = document.createElement('button');
        rmBtn.className = 'btn btn-ghost btn-sm';
        rmBtn.style.cssText = 'font-size:10px;padding:2px 7px;color:var(--danger);';
        rmBtn.textContent = '✕';
        rmBtn.addEventListener('click', async () => {
          const newMobs = (zone.mobs || []).filter(m => m !== id);
          await _zlSaveZoneMobs(zone, newMobs);
          zone.mobs = newMobs;
          if (mobCountSpan) mobCountSpan.textContent = newMobs.length + ' mob' + (newMobs.length > 1 ? 's' : '');
          refreshMobList();
          _zlRefreshAddSel();
        });
        row.appendChild(nameEl);
        row.appendChild(rmBtn);
        listWrap.appendChild(row);
      });
    }
  };
  refreshMobList();
  body.appendChild(listWrap);

  // Ajouter un mob — select dropdown
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:6px;';
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;';

  const _zlRefreshAddSel = () => {
    sel.innerHTML = '<option value="">— Ajouter un mob —</option>' +
      _zlMobsDb.map(m => {
        const id = m._id || m.id;
        if ((zone.mobs || []).includes(id)) return '';
        return '<option value="' + id + '">' + (m.name || id) + '</option>';
      }).join('');
  };
  _zlRefreshAddSel();

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost btn-sm';
  addBtn.textContent = '+ Ajouter';
  addBtn.addEventListener('click', async () => {
    if (!sel.value) return;
    const newMobs = [...(zone.mobs || []), sel.value];
    await _zlSaveZoneMobs(zone, newMobs);
    zone.mobs = newMobs;
    if (mobCountSpan) mobCountSpan.textContent = newMobs.length + ' mob' + (newMobs.length > 1 ? 's' : '');
    refreshMobList();
    _zlRefreshAddSel();
  });
  addRow.appendChild(sel);
  addRow.appendChild(addBtn);
  body.appendChild(addRow);
}

async function _zlSaveZoneMobs(zone, newMobs) {
  try {
    await setDoc(doc(db, COL.zones, zone._id), { mobs: newMobs }, { merge: true });
    invalidateCache(COL.zones);
    toast('✓ Zone mise à jour', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
}


/* ══════════════════════════════════════════════════════
   MIGRATION ZONES HARDCODÉES (FLOOR_ZONES / FLOOR_ZONES_UNDERGROUND → Firestore)
══════════════════════════════════════════════════════ */

window.migrateHardcodedZones = async function migrateHardcodedZones() {
  const btn = document.getElementById('btn-migrate-zones');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Migration…'; }

  // Collecte toutes les zones depuis data.js via window (compat module scope)
  const fz  = window.FLOOR_ZONES             || (typeof FLOOR_ZONES             !== 'undefined' ? FLOOR_ZONES             : null);
  const fzu = window.FLOOR_ZONES_UNDERGROUND || (typeof FLOOR_ZONES_UNDERGROUND !== 'undefined' ? FLOOR_ZONES_UNDERGROUND : null);

  const sources = [];
  if (fz)  { for (const [floor, zones] of Object.entries(fz))  zones.forEach(z => sources.push({ ...z, floor: +floor, underground: false })); }
  if (fzu) { for (const [floor, zones] of Object.entries(fzu)) zones.forEach(z => sources.push({ ...z, floor: +floor, underground: true  })); }

  if (!sources.length) {
    toast('⚠ Aucune zone trouvée dans data.js — data.js est-il chargé ?', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Migrer data.js'; }
    return;
  }

  // Vérifie lesquelles existent déjà
  const snap = await getDocs(collection(db, COL.zones));
  const existing = new Set(snap.docs.map(d => d.id));

  let ok = 0, skip = 0, fail = 0;
  for (const z of sources) {
    if (existing.has(z.id)) { skip++; continue; }
    const polygon = (z.points || []).map(p => ({ x: p.gx, z: p.gy }));
    const cx = Math.round(polygon.reduce((s, p) => s + p.x, 0) / polygon.length);
    const cy = Math.round(polygon.reduce((s, p) => s + p.z, 0) / polygon.length);
    const mobs = (z.monsters || [])
      .map(m => { const match = (m.link || '').match(/#monstres\/(.+)$/); return match ? match[1] : null; })
      .filter(Boolean);
    const obj = { floor: z.floor, name: z.name || '', color: z.color || '#e0ac60', polygon, gx: cx, gy: cy, mobs };
    if (z.underground) obj.is_underground = true;
    try {
      await setDoc(doc(db, COL.zones, z.id), obj);
      ok++;
    } catch(e) {
      fail++;
      toast('⛔ ' + z.name + ' : ' + e.message, 'error');
      console.error('[ZoneMig]', z.id, e);
    }
  }

  invalidateCache(COL.zones);
  const msg = ok + ' migrées' + (skip ? ', ' + skip + ' déjà existantes' : '') + (fail ? ', ' + fail + ' erreurs' : '');
  toast(fail ? '⚠ ' + msg : '✓ ' + msg, fail ? 'warning' : 'success');
  if (btn) { btn.disabled = false; btn.textContent = '⚡ Migrer data.js'; }
  await loadZoneList();
};

/* ══════════════════════════════════════════════════════
   CARTE — ONGLETS (Marqueurs / Tous les pins / Couleurs)
══════════════════════════════════════════════════════ */

let _pinCategories = null;

const _DEFAULT_CATEGORIES = [
  { id: 'cat-principaux', label: '🗺️ Principaux',   types: ['donjon', 'boss', 'zone_monstre'] },
  { id: 'cat-quetes',     label: '💬 Quêtes',         types: ['quête_principale', 'quête_secondaire'] },
  { id: 'cat-craft',      label: '⚒️ Forge / Craft',  types: ['craft_cles'] },
  { id: 'cat-artisans',   label: '🧪 Artisans',       types: ['alchimiste', 'bucheron', 'refaconneur'] },
  { id: 'cat-commerce',   label: '🛒 Commerce',       types: ['repreneur_butin', 'marchand_consommable', 'marchand_outils', 'marchand_access', 'marchand_ressources', 'marchand_occulte'] },
  { id: 'cat-recyclage', label: 'Recyclage', types: ['recyclage_access', 'recyclage_arme'] },
  { id: 'cat-autres',     label: '🦠 Autres',         types: ['région', 'passage'] },
];

let _allPinsList = [];
let _pinColors   = {};

window.switchMapTab = function switchMapTab(tab) {
  ['allpins', 'colors', 'emojis', 'pintypes', 'categories', 'passages'].forEach(t => {
    const div = document.getElementById('map-tab-' + t);
    const btn = document.getElementById('map-tab-btn-' + t);
    const active = t === tab;
    if (div) div.style.display = active ? '' : 'none';
    if (btn) {
      btn.style.background = active ? 'var(--accent)' : 'transparent';
      btn.style.color      = active ? '#fff'          : 'var(--muted)';
    }
  });

  if (tab === 'allpins')    loadAllMapPins();
  if (tab === 'colors')     loadPinColors();
  if (tab === 'emojis')     loadPinEmojis();
  if (tab === 'pintypes')   loadPinTypes();
  if (tab === 'categories') loadPinCategories();
  if (tab === 'passages')   loadPassages();
};

// ── PASSAGES ──────────────────────────────────────────
let _passagesList = [];       // cache local des passages chargés
let _allMarkersForPg = [];    // cache pour la recherche de pins liés
let _pgLinks = [];            // liens en cours de création (tableau d'objets {id, name})

window.loadPassages = async function loadPassages() {
  const el = document.getElementById('passages-list-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(query(
      collection(db, COL.mapMarkers),
      where('type', '==', 'passage')
    ));
    _passagesList = snap.docs.map(d => ({ _docKey: d.id, ...d.data() }));

    // Charger tous les pins linkables depuis toutes les collections
    const [allMarkersSnap, pnjSnap, mobSnap, donjonSnap, queteSnap] = await Promise.all([
      getDocs(collection(db, COL.mapMarkers)),
      getDocs(collection(db, COL.pnj)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.donjons)),
      getDocs(collection(db, COL.quetes)),
    ]);
    _allMarkersForPg = [];
    allMarkersSnap.docs.forEach(d => {
      const data = d.data();
      if (data.type === 'passage') return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.floor, type: data.type || 'marker' });
    });
    pnjSnap.docs.forEach(d => {
      const data = d.data();
      const floor = data.coords?.palier ?? data.palier ?? data.floor;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor, type: data.role || 'pnj' });
    });
    mobSnap.docs.forEach(d => {
      const data = d.data();
      if ((data.type || '').toLowerCase() !== 'boss' || !data.palier) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.palier, type: 'boss' });
    });
    donjonSnap.docs.forEach(d => {
      const data = d.data();
      if (data.gx == null || !data.floor) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.floor, type: 'donjon' });
    });
    queteSnap.docs.forEach(d => {
      const data = d.data();
      const floor = data.coords?.palier ?? data.palier;
      if (!floor) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor, type: 'quête' });
    });

    // Peupler le filtre palier
    const floors = [...new Set(_passagesList.map(p => p.floor).filter(Boolean))].sort((a, b) => +a - +b);
    const sel = document.getElementById('pg-filter-floor');
    if (sel) {
      sel.innerHTML = '<option value="">Tous les paliers</option>' +
        floors.map(f => `<option value="${f}">Palier ${f}</option>`).join('');
    }

    renderPassageList();
  } catch (err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.renderPassageList = function renderPassageList() {
  const el = document.getElementById('passages-list-content');
  if (!el) return;
  const floorF  = document.getElementById('pg-filter-floor')?.value || '';
  const searchF = (document.getElementById('pg-filter-search')?.value || '').toLowerCase();

  const list = _passagesList.filter(p => {
    if (floorF  && String(p.floor ?? '') !== floorF) return false;
    if (searchF && !(p.name || '').toLowerCase().includes(searchF)) return false;
    return true;
  });

  if (!list.length) { el.innerHTML = '<div class="empty">Aucun passage</div>'; return; }

  const byFloor = {};
  for (const p of list) {
    const f = p.floor ?? '?';
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(p);
  }

  let html = '';
  for (const floor of Object.keys(byFloor).sort((a, b) => +a - +b)) {
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);">Palier ${floor}</div>`;
    for (const p of byFloor[floor]) {
      const links = (p.links || []);
      const linksHtml = links.length
        ? links.map(id => {
            const m = _allMarkersForPg.find(x => x.id === id);
            return `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:11px;">${escHtml(m?.name || id)}</span>`;
          }).join(' ')
        : '<span style="color:var(--muted);font-size:11px;">Aucun pin lié</span>';

      const mapHref = `Map/map.html?ghost_gx=${p.gx}&ghost_gz=${p.gy}&ghost_floor=${p.floor}&ghost_name=${encodeURIComponent(p.name || '')}#floor-${p.floor}-surface`;
      html += `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);">
          <span style="font-size:20px;margin-top:2px;">🚪</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;">${escHtml(p.name || p._docKey)}</div>
            ${p.desc ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(p.desc)}</div>` : ''}
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">GX ${p.gx ?? '—'} / GY ${p.gy ?? '—'}${p.layer ? ' · ' + escHtml(p.layer) : ''}</div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${linksHtml}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <a href="${mapHref}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;text-decoration:none;" title="Voir sur la carte">🗺️</a>
            <button class="btn btn-ghost btn-sm" onclick="deletePassage('${escHtml(p._docKey)}')"
              style="font-size:11px;padding:3px 8px;color:var(--danger);" title="Supprimer">🗑️</button>
          </div>
        </div>`;
    }
  }
  el.innerHTML = html;
};

window.pgValidate = function pgValidate() {
  const name  = document.getElementById('pg-name')?.value.trim();
  const gx    = document.getElementById('pg-gx')?.value.trim();
  const gy    = document.getElementById('pg-gy')?.value.trim();
  const floor = document.getElementById('pg-floor')?.value.trim();
  const btn   = document.getElementById('pg-save-btn');
  if (btn) btn.disabled = !(name && gx !== '' && gy !== '' && floor);
};

window.pgReset = function pgReset() {
  ['pg-name', 'pg-gx', 'pg-gy', 'pg-floor', 'pg-layer', 'pg-desc', 'pg-link-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _pgLinks = [];
  const ll = document.getElementById('pg-links-list');
  if (ll) ll.innerHTML = '';
  const err = document.getElementById('pg-create-error');
  if (err) err.style.display = 'none';
  const details = document.getElementById('passage-create-details');
  if (details) details.open = false;
  pgValidate();
};

window.pgSearchPins = async function pgSearchPins(val) {
  const res = document.getElementById('pg-link-results');
  if (!res) return;
  const q = val.trim();
  if (!q) { res.style.display = 'none'; return; }

  if (!_allMarkersForPg.length) {
    res.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:var(--muted);">⏳ Chargement…</div>';
    res.style.display = '';
    await loadPassages();
    if (document.getElementById('pg-link-input')?.value !== val) return;
  }
  const nq = normalize(q);

  const matches = _allMarkersForPg
    .filter(m => !_pgLinks.find(l => l.id === m.id))
    .filter(m => fuzzyMatch(nq, normalize(m.name || m.id)))
    .slice(0, 12);

  if (!matches.length) { res.style.display = 'none'; return; }

  res.innerHTML = matches.map(m =>
    `<div style="padding:6px 10px;cursor:pointer;font-size:12px;" onmousedown="pgAddLink('${escHtml(m.id)}','${escHtml(m.name || m.id)}')"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      📍 ${escHtml(m.name || m.id)} <span style="color:var(--muted);font-size:11px;">· P${m.floor ?? '?'}</span>
    </div>`
  ).join('');
  res.style.display = '';
};

window.pgAddLink = function pgAddLink(id, name) {
  if (_pgLinks.find(l => l.id === id)) return;
  _pgLinks.push({ id, name });
  _renderPgLinks();
  const inp = document.getElementById('pg-link-input');
  const res = document.getElementById('pg-link-results');
  if (inp) inp.value = '';
  if (res) res.style.display = 'none';
};

window.pgRemoveLink = function pgRemoveLink(id) {
  _pgLinks = _pgLinks.filter(l => l.id !== id);
  _renderPgLinks();
};

function _renderPgLinks() {
  const ll = document.getElementById('pg-links-list');
  if (!ll) return;
  ll.innerHTML = _pgLinks.map(l =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;">
      ${escHtml(l.name || l.id)}
      <button onclick="pgRemoveLink('${escHtml(l.id)}')"
        style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;font-size:12px;line-height:1;">×</button>
    </span>`
  ).join('');
}

window.saveNewPassage = async function saveNewPassage() {
  const name  = document.getElementById('pg-name')?.value.trim();
  const gx    = parseFloat(document.getElementById('pg-gx')?.value);
  const gy    = parseFloat(document.getElementById('pg-gy')?.value);
  const floor = parseInt(document.getElementById('pg-floor')?.value, 10);
  const layer = document.getElementById('pg-layer')?.value.trim() || null;
  const desc  = document.getElementById('pg-desc')?.value.trim() || null;
  const errEl = document.getElementById('pg-create-error');
  const btn   = document.getElementById('pg-save-btn');

  if (!name || isNaN(gx) || isNaN(gy) || isNaN(floor)) {
    if (errEl) { errEl.textContent = 'Nom, GX, GY et Palier sont requis.'; errEl.style.display = ''; }
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Création…';

  try {
    const docId = 'passage_' + Date.now();
    const obj = {
      type: 'passage',
      name,
      gx,
      gy,
      floor,
      links: _pgLinks.map(l => l.id),
    };
    if (layer) obj.layer = layer;
    if (desc)  obj.desc  = desc;

    await setDoc(doc(db, COL.mapMarkers, docId), obj);
    invalidateCache(COL.mapMarkers);
    invalidateModCache(COL.mapMarkers);
    toast('Passage créé !', 'success');
    pgReset();
    await loadPassages();
  } catch (err) {
    if (errEl) { errEl.textContent = '⛔ ' + err.message; errEl.style.display = ''; }
    btn.disabled = false;
    btn.textContent = '💾 Créer le passage';
  }
};

window.deletePassage = async function deletePassage(docKey) {
  if (!confirm(`Supprimer ce passage ?`)) return;
  try {
    await deleteDoc(doc(db, COL.mapMarkers, docKey));
    invalidateCache(COL.mapMarkers);
    invalidateModCache(COL.mapMarkers);
    _passagesList = _passagesList.filter(p => p._docKey !== docKey);
    renderPassageList();
    toast('Passage supprimé.', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
};

window.loadAllMapPins = async function loadAllMapPins() {
  const el = document.getElementById('all-pins-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [pnjSnap, mobSnap, markerSnap, donjonSnap, regionSnap, queteSnap] = await Promise.all([
      getDocs(collection(db, COL.pnj)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.mapMarkers)),
      getDocs(collection(db, COL.donjons)),
      getDocs(collection(db, COL.regions)),
      getDocs(collection(db, COL.quetes)),
    ]);
    _allPinsList = [];
    pnjSnap.forEach(d => {
      const p = { _id: d.id, ...d.data(), _source: 'pnj' };
      if (p.coords) _allPinsList.push(p);
    });
    mobSnap.forEach(d => {
      const m = { _id: d.id, ...d.data(), _source: 'mob' };
      if ((m.type || '').toLowerCase() === 'boss' && m.palier) _allPinsList.push(m);
    });
    markerSnap.forEach(d => {
      _allPinsList.push({ _id: d.id, ...d.data(), _source: 'marker' });
    });
    donjonSnap.forEach(d => {
      const donjon = { _id: d.id, ...d.data(), _source: 'donjon' };
      if (donjon.gx != null && donjon.gy != null && donjon.floor) _allPinsList.push(donjon);
    });
    regionSnap.forEach(d => {
      const r = { _id: d.id, ...d.data(), _source: 'region' };
      if (r.coords && r.palier) _allPinsList.push(r);
    });
    queteSnap.forEach(d => {
      const q = { _id: d.id, ...d.data(), _source: 'quete' };
      if (q.coords?.x != null && q.palier) _allPinsList.push(q);
    });
    // Populate type filter
    const typeSel = document.getElementById('ap-filter-type');
    if (typeSel) {
      const types = [...new Set(_allPinsList.map(p => _apGetType(p)))].sort();
      typeSel.innerHTML = '<option value="">Tous les types</option>' +
        types.map(t => `<option value="${t}">${_AP_TYPE_LABELS[t] || t}</option>`).join('');
    }
    renderAllMapPins();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};


const _AP_PNJ_TO_TYPE = {
  "quête principale":        "quête_principale",
  "quête secondaire":        "quête_secondaire",
  "quête tertiaire":         "quête_tertiaire",
  "quêtes":                  "quête_secondaire",
  "donjon":                  "donjon",
  "forgeron d'armes":        "craft_armes",
  "forgeron d'armures":      "craft_armures",
  "forgeron d'accessoires":  "marchand_access",
  "forgeron de lingots":     "craft_lingots",
  "forgeron de clés":        "craft_cles",
  "alchimiste":              "alchimiste",
  "bûcheron":                "bucheron",
  "refaçonneur":             "refaconneur",
  "repreneur de butin":      "repreneur_butin",
  "repreneur d'armes":       "repreneur_armes",
  "marchand itinérant":      "marchand_itinerant",
  "marchand d'équipement":   "marchand_equipement",
  "marchand de consommable": "marchand_consommable",
  "marchand d'outils":       "marchand_outils",
  "marchand d'accessoires":  "marchand_access",
  "recyclage d'accessoires": "recyclage_access",
  "recyclage d'armes":       "recyclage_arme",
  "marchand de ressources":  "marchand_ressources",
  "marchand occulte":        "marchand_occulte",
  "fabricant secret":        "autre",
  "autres":                  "autre",
};

const _AP_TYPE_LABELS = {
  région: 'Région', donjon: 'Donjon', boss: 'Boss', mini_boss: 'Mini-Boss', zone_monstre: 'Zone Monstres',
  quête_principale: 'Quête Principale', quête_secondaire: 'Quête Secondaire', quête_tertiaire: 'Quête Tertiaire',
  craft_armes: "Forgeron d'Armes", craft_armures: "Forgeron d'Armures",
  craft_accessoires: "Forgeron d'Accessoires", craft_lingots: 'Forgeron de Lingots', craft_cles: 'Fabricants de Clés',
  craft_runes: 'Maître des Runes', alchimiste: 'Alchimiste', bucheron: 'Bûcheron', refaconneur: 'Refaçonneur',
  repreneur_butin: 'Repreneur de Butin', repreneur_armes: "Repreneur d'Armes",
  marchand_itinerant: 'Marchand Itinérant', marchand_equipement: "Marchand d'Équipement",
  marchand_consommable: 'Marchand de Consommable', marchand_outils: "Marchand d'Outils",
  marchand_access: "Vendeur d'Accessoires", recyclage_access: "Recyclage d'Accessoires", recyclage_arme: "Recyclage d'Armes", marchand_ressources: 'Marchand de Ressources', marchand_occulte: 'Marchand Occulte',
  passage: 'Passage', autre: 'Autre',
};

function _apGetFloor(p) {
  if (p._source === 'donjon') return p.floor;
  if (p._source === 'pnj' || p._source === 'region' || p._source === 'quete') return p.palier;
  return p.floor ?? p.palier;
}
function _apGetType(p) {
  if (p._source === 'pnj')    return _AP_PNJ_TO_TYPE[(p.type || '').toLowerCase()] || 'autre';
  if (p._source === 'mob')    return 'boss';
  if (p._source === 'donjon') return 'donjon';
  if (p._source === 'region') return 'région';
  if (p._source === 'quete') {
    const QT = { main: 'quête_principale', sec: 'quête_secondaire', ter: 'quête_tertiaire', secondary: 'quête_secondaire', tertiary: 'quête_tertiaire' };
    return QT[p.type] || 'quête_principale';
  }
  return p.type || 'autre';
}
function _apGetGx(p) {
  if (p._source === 'donjon') return p.gx;
  return p.coords?.x ?? p.gx;
}
function _apGetGy(p) {
  if (p._source === 'donjon') return p.gy;
  return p.coords?.z ?? p.gy;
}

window.renderAllMapPins = function renderAllMapPins() {
  const el = document.getElementById('all-pins-content');
  if (!el) return;
  const floorF  = document.getElementById('ap-filter-floor')?.value  || '';
  const typeF   = document.getElementById('ap-filter-type')?.value   || '';
  const searchF = (document.getElementById('ap-filter-search')?.value || '').toLowerCase();

  const list = _allPinsList.filter(p => {
    if (floorF  && String(_apGetFloor(p) ?? '') !== floorF)            return false;
    if (typeF   && _apGetType(p) !== typeF)                            return false;
    if (searchF && !(p.name || '').toLowerCase().includes(searchF))   return false;
    return true;
  });

  if (!list.length) { el.innerHTML = '<div class="empty">Aucun pin</div>'; return; }

  const byFloor = {};
  for (const p of list) {
    const f = _apGetFloor(p) ?? '?';
    if (!byFloor[f]) byFloor[f] = {};
    const t = _apGetType(p);
    if (!byFloor[f][t]) byFloor[f][t] = [];
    byFloor[f][t].push(p);
  }

  const SOURCE_LABELS = { pnj: 'PNJ', mob: 'Mob', marker: 'Marqueur', donjon: 'Donjon', region: 'Région', quete: 'Quête' };
  const frag = document.createDocumentFragment();

  for (const floor of Object.keys(byFloor).sort((a, b) => +a - +b)) {
    const floorHdr = document.createElement('div');
    floorHdr.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    floorHdr.textContent = 'Palier ' + floor;
    frag.appendChild(floorHdr);

    for (const type of Object.keys(byFloor[floor]).sort()) {
      const pins = byFloor[floor][type];
      const pinColor = _pinColors[type] || null;

      const typeEmoji = _pinEmojis[type] || _DEFAULT_EMOJIS[type] || '📍';
      const typeHdr = document.createElement('div');
      typeHdr.style.cssText = 'font-size:10px;font-weight:600;color:var(--accent);margin:8px 0 4px;display:flex;align-items:center;gap:6px;';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:${pinColor || '#555'};font-size:12px;flex-shrink:0;`;
      dot.textContent = typeEmoji;
      typeHdr.appendChild(dot);
      typeHdr.appendChild(Object.assign(document.createElement('span'), {
        innerHTML: (_AP_TYPE_LABELS[type] || type) + ` <span style="color:var(--muted);font-weight:400;">(${pins.length})</span>`,
      }));
      frag.appendChild(typeHdr);

      const AP_COL = { pnj: 'personnages', mob: 'mobs', marker: 'map_markers', donjon: 'donjons', region: 'regions', quete: 'quetes' };
      const table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px;';
      table.innerHTML = `<thead><tr style="font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:3px 6px;">Nom</th>
        <th style="text-align:center;padding:3px 6px;">Emoji</th>
        <th style="text-align:center;padding:3px 6px;">Source</th>
        <th style="text-align:center;padding:3px 6px;">GX / GY</th>
        <th style="padding:3px 6px;"></th>
      </tr></thead>`;
      const tbody = document.createElement('tbody');
      for (const p of pins) {
        const gx = _apGetGx(p), gy = _apGetGy(p);
        const pFloor = _apGetFloor(p);
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
          <td style="padding:4px 6px;font-weight:500;">${p.name || p._id || '—'}</td>
          <td style="text-align:center;padding:4px 6px;"></td>
          <td style="text-align:center;padding:4px 6px;color:var(--muted);">${SOURCE_LABELS[p._source] || p._source}</td>
          <td style="text-align:center;padding:4px 6px;font-family:monospace;font-size:11px;color:var(--muted);">${gx != null ? gx + ' / ' + gy : '—'}</td>
          <td style="padding:4px 6px;text-align:right;white-space:nowrap;"></td>
        `;
        // Emoji individuel inline
        const emojiInp = document.createElement('input');
        emojiInp.type = 'text';
        emojiInp.value = p.emoji || '';
        emojiInp.placeholder = _DEFAULT_EMOJIS[_apGetType(p)] || '?';
        emojiInp.title = 'Emoji individuel (vide = utilise le défaut du type)';
        emojiInp.style.cssText = 'width:36px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:16px;text-align:center;padding:2px 2px;';
        emojiInp.addEventListener('change', () => {
          saveIndividualPinEmoji(p._source, p._id, emojiInp.value.trim());
        });
        tr.querySelectorAll('td')[1].appendChild(emojiInp);

        const lastTd = tr.querySelector('td:last-child');

        if (gx != null && gy != null && pFloor != null) {
          const mapLink = document.createElement('a');
          mapLink.className = 'btn btn-ghost btn-sm';
          mapLink.style.cssText = 'font-size:11px;padding:2px 6px;text-decoration:none;margin-right:4px;';
          mapLink.title = 'Voir sur la carte';
          mapLink.textContent = '🗺️';
          mapLink.target = '_blank';
          mapLink.href = `Map/map.html?ghost_gx=${gx}&ghost_gz=${gy}&ghost_floor=${pFloor}&ghost_name=${encodeURIComponent(p.name || '')}#floor-${pFloor}-surface`;
          lastTd.appendChild(mapLink);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost btn-sm ed-edit-btn';
        editBtn.style.cssText = 'font-size:11px;padding:2px 8px;';
        editBtn.textContent = '✏️ Éditer';
        editBtn.addEventListener('click', e => {
          e.stopPropagation();
          showEditor(AP_COL[p._source] || 'personnages', p._id, p, 'allpins');
        });
        lastTd.appendChild(editBtn);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      frag.appendChild(table);
    }
  }
  el.innerHTML = '';
  el.appendChild(frag);
};

window.loadPinColors = async function loadPinColors() {
  const el = document.getElementById('pin-colors-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap] = await Promise.all([
      getDoc(doc(db, 'config', 'pin_type_colors')),
      _ensureCategoriesLoaded(),
      _ensureCustomTypesLoaded(),
    ]);
    _pinColors = snap.exists() ? snap.data() : {};
    renderPinColorForm();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinColors = async function savePinColors() {
  const btn = document.getElementById('btn-save-pin-colors');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    const colors = {};
    document.querySelectorAll('#pin-colors-content input[type="color"]').forEach(inp => {
      colors[inp.dataset.type] = inp.value;
    });
    await setDoc(doc(db, 'config', 'pin_type_colors'), colors);
    _pinColors = colors;
    toast('✓ Couleurs sauvegardées', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

function renderPinColorForm() {
  const el = document.getElementById('pin-colors-content');
  if (!el) return;

  const DEFAULT_COLORS = {
    donjon: '#ef4444', boss: '#dc2626', zone_monstre: '#fb923c',
    quête_principale: '#f59e0b', quête_secondaire: '#10b981', quête_tertiaire: '#06b6d4',
    craft_armes: '#8b5cf6', craft_armures: '#7c3aed', craft_accessoires: '#a78bfa',
    craft_lingots: '#6d28d9', craft_cles: '#4c1d95', craft_runes: '#3a1a6e',
    alchimiste: '#34d399', bucheron: '#65a30d', refaconneur: '#a16207',
    repreneur_butin: '#f59e0b', repreneur_armes: '#b45309',
    marchand_itinerant: '#eab308', marchand_equipement: '#ca8a04',
    marchand_consommable: '#84cc16', marchand_outils: '#16a34a',
    marchand_access: '#0891b2', recyclage_access: '#14b8a6', recyclage_arme: '#22c55e', marchand_ressources: '#ca8a04', marchand_occulte: '#7c3aed',
    passage: '#1a3a5c', autre: '#6b7280',
  };

  const cats = (_pinCategories || _DEFAULT_CATEGORIES).filter(c => c.types.length > 0);
  const categorized = new Set(cats.flatMap(c => c.types));
  const uncategorized = Object.keys(_AP_TYPE_LABELS).filter(t => !categorized.has(t));

  function makeColorRow(type) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = _pinColors[type] || DEFAULT_COLORS[type] || '#888888';
    inp.dataset.type = type;
    inp.style.cssText = 'width:32px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;flex:1;';
    lbl.textContent = _AP_TYPE_LABELS[type] || type;
    row.appendChild(inp);
    row.appendChild(lbl);
    return row;
  }

  function makeSectionHeader(text) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    h.textContent = text;
    return h;
  }

  const frag = document.createDocumentFragment();

  for (const cat of cats) {
    frag.appendChild(makeSectionHeader(cat.label));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    cat.types.forEach(t => grid.appendChild(makeColorRow(t)));
    frag.appendChild(grid);
  }

  if (uncategorized.length > 0) {
    frag.appendChild(makeSectionHeader('🏷️ Personnalisés'));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    uncategorized.sort().forEach(t => grid.appendChild(makeColorRow(t)));
    frag.appendChild(grid);
  }

  el.innerHTML = '';
  el.appendChild(frag);
}

/* ══════════════════════════════════════════════════════
   EMOJIS DE PINS (par type + individuel)
══════════════════════════════════════════════════════ */

let _pinEmojis = {};

const _DEFAULT_EMOJIS = {
  région: '📍', donjon: '⚔️', boss: '☠️', mini_boss: '💀', zone_monstre: '💀',
  quête_principale: '💬', quête_secondaire: '❓', quête_tertiaire: '📋',
  craft_armes: '⚒️', craft_armures: '🛡️', craft_accessoires: '💍',
  craft_lingots: '🔩', craft_cles: '🗝️', craft_runes: '🔮',
  alchimiste: '⚗️', bucheron: '🪓', refaconneur: '🔧',
  repreneur_butin: '🛒', repreneur_armes: '⚔️',
  marchand_itinerant: '💰', marchand_equipement: '⚔️',
  marchand_consommable: '🧪', marchand_outils: '🔧',
  marchand_access: '💍', recyclage_access: '♻️', recyclage_arme: '♻️', marchand_ressources: '⛏️', marchand_occulte: '🩸',
  passage: '🚪', autre: '🦠',
};

window.loadPinEmojis = async function loadPinEmojis() {
  const el = document.getElementById('pin-emojis-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap] = await Promise.all([
      getDoc(doc(db, 'config', 'pin_type_emojis')),
      _ensureCategoriesLoaded(),
      _ensureCustomTypesLoaded(),
    ]);
    _pinEmojis = snap.exists() ? snap.data() : {};
    renderPinEmojiForm();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinEmojis = async function savePinEmojis() {
  const btn = document.getElementById('btn-save-pin-emojis');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    const emojis = {};
    document.querySelectorAll('#pin-emojis-content input[data-type]').forEach(inp => {
      if (inp.value.trim()) emojis[inp.dataset.type] = inp.value.trim();
    });
    await setDoc(doc(db, 'config', 'pin_type_emojis'), emojis);
    _pinEmojis = emojis;
    toast('✓ Emojis sauvegardés', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

window.saveIndividualPinEmoji = async function saveIndividualPinEmoji(source, id, emoji) {
  const COL_MAP = { pnj: COL.pnj, mob: COL.mobs, marker: COL.mapMarkers };
  const col = COL_MAP[source];
  if (!col || !id) return;
  try {
    const patch = emoji ? { emoji } : { emoji: deleteField() };
    await updateDoc(doc(db, col, id), patch);
    toast('✓ Emoji mis à jour', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
};

function renderPinEmojiForm() {
  const el = document.getElementById('pin-emojis-content');
  if (!el) return;

  const cats = (_pinCategories || _DEFAULT_CATEGORIES).filter(c => c.types.length > 0);
  const categorized = new Set(cats.flatMap(c => c.types));
  const uncategorized = Object.keys(_AP_TYPE_LABELS).filter(t => !categorized.has(t));

  function makeEmojiRow(type) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = _pinEmojis[type] || _DEFAULT_EMOJIS[type] || '';
    inp.dataset.type = type;
    inp.placeholder = _DEFAULT_EMOJIS[type] || '?';
    inp.style.cssText = 'width:40px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:18px;text-align:center;padding:2px 4px;flex-shrink:0;';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost btn-sm';
    resetBtn.textContent = '↩';
    resetBtn.title = 'Réinitialiser au défaut';
    resetBtn.style.cssText = 'font-size:11px;padding:2px 6px;flex-shrink:0;';
    resetBtn.addEventListener('click', () => { inp.value = _DEFAULT_EMOJIS[type] || ''; });
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;flex:1;';
    lbl.textContent = _AP_TYPE_LABELS[type] || type;
    row.appendChild(inp);
    row.appendChild(lbl);
    row.appendChild(resetBtn);
    return row;
  }

  function makeSectionHeader(text) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    h.textContent = text;
    return h;
  }

  const frag = document.createDocumentFragment();

  for (const cat of cats) {
    frag.appendChild(makeSectionHeader(cat.label));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    cat.types.forEach(t => grid.appendChild(makeEmojiRow(t)));
    frag.appendChild(grid);
  }

  if (uncategorized.length > 0) {
    frag.appendChild(makeSectionHeader('🏷️ Personnalisés'));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    uncategorized.sort().forEach(t => grid.appendChild(makeEmojiRow(t)));
    frag.appendChild(grid);
  }

  el.innerHTML = '';
  el.appendChild(frag);
}

/* ══════════════════════════════════════════════════════
   CATÉGORIES DE PINS (config/pin_categories)
══════════════════════════════════════════════════════ */

async function _ensureCategoriesLoaded() {
  if (_pinCategories !== null) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'pin_categories'));
    _pinCategories = (snap.exists() && Array.isArray(snap.data().categories))
      ? snap.data().categories
      : _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
  } catch {
    _pinCategories = _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
  }
}

window.loadPinCategories = async function loadPinCategories() {
  const el = document.getElementById('pin-categories-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDoc(doc(db, 'config', 'pin_categories'));
    _pinCategories = (snap.exists() && Array.isArray(snap.data().categories))
      ? snap.data().categories
      : _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
    renderCategoryEditor();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinCategories = async function savePinCategories() {
  _pinCategories = _readCategoryEditorState();
  const btn = document.getElementById('btn-save-pin-categories');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    await setDoc(doc(db, 'config', 'pin_categories'), { categories: _pinCategories });
    toast('✓ Catégories sauvegardées', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

function _readCategoryEditorState() {
  const cards = document.querySelectorAll('#pin-categories-content .cat-card');
  const result = [];
  cards.forEach(card => {
    const id    = card.dataset.catId;
    const label = card.querySelector('.cat-label-input')?.value?.trim() || '';
    const types = [...card.querySelectorAll('.cat-type-chip[data-type]')].map(c => c.dataset.type);
    result.push({ id, label, types });
  });
  return result;
}

function renderCategoryEditor() {
  const el = document.getElementById('pin-categories-content');
  if (!el) return;

  const cats = _pinCategories || _DEFAULT_CATEGORIES;
  const allKnownTypes = [...new Set([
    ...Object.keys(_AP_TYPE_LABELS),
    ...cats.flatMap(c => c.types),
  ])].sort();

  el.innerHTML = '';

  const dl = document.createElement('datalist');
  dl.id = 'known-pin-types-list';
  allKnownTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.label = _AP_TYPE_LABELS[t] || t;
    dl.appendChild(opt);
  });
  el.appendChild(dl);

  const addCatBtn = document.createElement('button');
  addCatBtn.className = 'btn btn-ghost';
  addCatBtn.style.cssText = 'font-size:12px;margin-bottom:12px;';
  addCatBtn.textContent = '+ Nouvelle catégorie';
  addCatBtn.addEventListener('click', () => _addNewCategory());
  el.appendChild(addCatBtn);

  const container = document.createElement('div');
  container.id = 'cat-list';
  container.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  cats.forEach((cat, idx) => container.appendChild(_buildCategoryCard(cat, idx, cats.length)));
  el.appendChild(container);
}

function _buildCategoryCard(cat, idx, total) {
  const card = document.createElement('div');
  card.className = 'cat-card';
  card.dataset.catId = cat.id;
  card.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';

  const labelInp = document.createElement('input');
  labelInp.className = 'cat-label-input';
  labelInp.type = 'text';
  labelInp.value = cat.label;
  labelInp.placeholder = 'Nom de la catégorie…';
  labelInp.style.cssText = 'flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;font-size:12px;font-weight:600;outline:none;min-width:0;';
  hdr.appendChild(labelInp);

  if (idx > 0) {
    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-ghost btn-sm';
    upBtn.textContent = '▲';
    upBtn.title = 'Monter';
    upBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;';
    upBtn.addEventListener('click', () => _moveCat(idx, -1));
    hdr.appendChild(upBtn);
  }
  if (idx < total - 1) {
    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-ghost btn-sm';
    downBtn.textContent = '▼';
    downBtn.title = 'Descendre';
    downBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;';
    downBtn.addEventListener('click', () => _moveCat(idx, 1));
    hdr.appendChild(downBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-ghost btn-sm';
  delBtn.textContent = '🗑️';
  delBtn.title = 'Supprimer cette catégorie';
  delBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;color:var(--danger);';
  delBtn.addEventListener('click', () => _deleteCat(idx));
  hdr.appendChild(delBtn);

  card.appendChild(hdr);

  const typesArea = document.createElement('div');
  typesArea.className = 'cat-types-area';
  typesArea.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  cat.types.forEach(type => typesArea.appendChild(_buildTypeChip(type)));
  card.appendChild(typesArea);

  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:4px;margin-top:8px;';

  const typeInput = document.createElement('input');
  typeInput.type = 'text';
  typeInput.placeholder = 'type de pin… (ex: boss)';
  typeInput.setAttribute('list', 'known-pin-types-list');
  typeInput.style.cssText = 'flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:11px;outline:none;min-width:0;';

  const addTypeBtn = document.createElement('button');
  addTypeBtn.className = 'btn btn-ghost btn-sm';
  addTypeBtn.textContent = '+ Ajouter';
  addTypeBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
  addTypeBtn.addEventListener('click', () => {
    const val = typeInput.value.trim();
    if (!val) return;
    if (typesArea.querySelector(`.cat-type-chip[data-type="${CSS.escape(val)}"]`)) {
      toast('Ce type est déjà dans cette catégorie', 'error'); return;
    }
    typesArea.appendChild(_buildTypeChip(val));
    typeInput.value = '';
    typeInput.focus();
  });
  typeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTypeBtn.click(); } });

  addRow.appendChild(typeInput);
  addRow.appendChild(addTypeBtn);
  card.appendChild(addRow);

  return card;
}

function _buildTypeChip(type) {
  const chip = document.createElement('span');
  chip.className = 'cat-type-chip';
  chip.dataset.type = type;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 6px 2px 4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-size:11px;';

  const color = (_pinColors || {})[type] || null;
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;background:${color || '#666'};flex-shrink:0;`;
  chip.appendChild(dot);

  const emoji = (_pinEmojis || {})[type] || _DEFAULT_EMOJIS[type] || '📍';
  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = emoji;
  chip.appendChild(emojiSpan);

  const lblSpan = document.createElement('span');
  lblSpan.textContent = _AP_TYPE_LABELS[type] || type;
  chip.appendChild(lblSpan);

  const removeBtn = document.createElement('button');
  removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--muted);padding:0 0 0 2px;font-size:12px;line-height:1;flex-shrink:0;';
  removeBtn.textContent = '×';
  removeBtn.title = 'Retirer de cette catégorie';
  removeBtn.addEventListener('click', () => chip.remove());
  chip.appendChild(removeBtn);

  return chip;
}

function _moveCat(idx, dir) {
  const state = _readCategoryEditorState();
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.length) return;
  [state[idx], state[newIdx]] = [state[newIdx], state[idx]];
  _pinCategories = state;
  renderCategoryEditor();
}

function _deleteCat(idx) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  const state = _readCategoryEditorState();
  state.splice(idx, 1);
  _pinCategories = state;
  renderCategoryEditor();
}

function _addNewCategory() {
  const state = _readCategoryEditorState();
  state.push({ id: 'cat-' + Date.now(), label: '', types: [] });
  _pinCategories = state;
  renderCategoryEditor();
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('#pin-categories-content .cat-card');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      last.querySelector('.cat-label-input')?.focus();
    }
  });
}

/* ══════════════════════════════════════════════════════
   ONGLET TYPES DE PINS — liste et création de types
   (config/custom_pin_types + types natifs _AP_TYPE_LABELS)
══════════════════════════════════════════════════════ */

let _customPinTypes = [];

window.loadPinTypes = async function loadPinTypes() {
  const el = document.getElementById('pin-types-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDoc(doc(db, 'config', 'custom_pin_types'));
    _customPinTypes = (snap.exists() && Array.isArray(snap.data().types)) ? snap.data().types : [];
    _mergeCustomPinTypes();
    renderPinTypesList();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

function _mergeCustomPinTypes() {
  for (const ct of _customPinTypes) {
    if (!ct.id) continue;
    _AP_TYPE_LABELS[ct.id] = ct.label || ct.id;
    // Mapping PNJ type → pin type (identity pour les types custom)
    _AP_PNJ_TO_TYPE[ct.id] = ct.id;
  }
}

async function _ensureCustomTypesLoaded() {
  if (_customPinTypes.length > 0) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'custom_pin_types'));
    _customPinTypes = (snap.exists() && Array.isArray(snap.data().types)) ? snap.data().types : [];
    _mergeCustomPinTypes();
  } catch { _customPinTypes = []; }
}

function renderPinTypesList() {
  const el = document.getElementById('pin-types-content');
  if (!el) return;
  el.innerHTML = '';

  // Formulaire création
  el.appendChild(_buildAddPinTypeForm());

  // Table — types natifs + custom
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-top:4px;';
  table.innerHTML = `<thead><tr style="font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);">
    <th style="text-align:left;padding:5px 8px;">Nom</th>
    <th style="text-align:left;padding:5px 8px;font-family:monospace;">ID</th>
    <th style="padding:5px 8px;"></th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');

  // Types natifs (lecture seule)
  for (const [id, label] of Object.entries(_AP_TYPE_LABELS).sort((a,b) => a[1].localeCompare(b[1]))) {
    const isCustom = _customPinTypes.some(ct => ct.id === id);
    if (isCustom) continue; // affiché dans la section custom ci-dessous
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding:5px 8px;">${label}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:11px;color:var(--muted);">${id}</td>
      <td style="padding:5px 8px;text-align:right;"><span style="font-size:10px;color:var(--muted);padding:2px 5px;border:1px solid var(--border);border-radius:4px;">natif</span></td>
    `;
    tbody.appendChild(tr);
  }

  // Types custom (supprimables)
  for (const ct of _customPinTypes) {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding:5px 8px;font-weight:500;">${ct.label || ct.id}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:11px;color:var(--accent);">${ct.id}</td>
      <td style="padding:5px 8px;text-align:right;"></td>
    `;
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.cssText = 'font-size:11px;padding:2px 6px;color:var(--danger);';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Supprimer ce type';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le type "${ct.id}" ?`)) return;
      _customPinTypes = _customPinTypes.filter(c => c.id !== ct.id);
      try {
        await setDoc(doc(db, 'config', 'custom_pin_types'), { types: _customPinTypes });
        delete _AP_TYPE_LABELS[ct.id];
        toast('✓ Type supprimé', 'success');
        renderPinTypesList();
      } catch(err) { toast('⛔ ' + err.message, 'error'); }
    });
    tr.querySelector('td:last-child').appendChild(delBtn);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  el.appendChild(table);
}

function _buildAddPinTypeForm() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:700;margin-bottom:8px;';
  title.textContent = '+ Nouveau type de pin';
  wrap.appendChild(title);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:flex-end;';
  const inputStyle = 'background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;box-sizing:border-box;';

  function field(lbl, inp) {
    const w = document.createElement('div');
    w.style.flex = '1';
    const l = document.createElement('label');
    l.style.cssText = 'font-size:10px;color:var(--muted);display:block;margin-bottom:2px;';
    l.textContent = lbl;
    w.appendChild(l);
    inp.style.cssText = inputStyle + 'width:100%;';
    w.appendChild(inp);
    return w;
  }

  const labelInp = Object.assign(document.createElement('input'), { type:'text', placeholder:'Nom affiché *  (ex: Crates)' });
  const idInp    = Object.assign(document.createElement('input'), { type:'text', placeholder:'ID *  (ex: crates)' });
  idInp.style.fontFamily = 'monospace';

  row.appendChild(field('Nom *', labelInp));
  row.appendChild(field('ID *', idInp));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:12px;flex-shrink:0;align-self:flex-end;';
  addBtn.textContent = '✓ Ajouter';
  addBtn.addEventListener('click', async () => {
    const label = labelInp.value.trim();
    const id    = idInp.value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!label) { toast('⛔ Nom requis', 'error'); return; }
    if (!id)    { toast('⛔ ID requis', 'error'); return; }
    if (_AP_TYPE_LABELS[id]) { toast(`⛔ ID "${id}" déjà utilisé`, 'error'); return; }

    _customPinTypes.push({ id, label });
    try {
      await setDoc(doc(db, 'config', 'custom_pin_types'), { types: _customPinTypes });
      _AP_TYPE_LABELS[id] = label;
      toast(`✓ Type "${label}" créé`, 'success');
      renderPinTypesList();
    } catch(err) {
      _customPinTypes.pop();
      toast('⛔ ' + err.message, 'error');
    }
  });

  row.appendChild(addBtn);
  wrap.appendChild(row);
  return wrap;
}

// ── Config Jeu (paliers + MAX_LEVEL) ────────────────────
let _gcPaliers  = [];
let _gcMaxLevel = 18;

window.showGameConfig = async () => {
  if (currentRole !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _setHash('game-config');
  document.getElementById('game-config-panel').style.display = '';
  document.getElementById('btn-game-config').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await _loadGameConfigData();
};

async function _loadGameConfigData() {
  const content = document.getElementById('gc-content');
  content.innerHTML = '<div style="color:var(--muted);font-size:13px;">Chargement…</div>';
  try {
    const [snapP, snapG] = await Promise.all([
      getDoc(doc(db, 'config', 'paliers')),
      getDoc(doc(db, 'config', 'game')),
    ]);
    _gcPaliers  = snapP.exists() && Array.isArray(snapP.data().paliers) && snapP.data().paliers.length
      ? snapP.data().paliers.map(p => ({ ...p }))
      : [{ id:1, label:'Palier 1', color:'#4ade80', floorName:'Villes Européennes' },
         { id:2, label:'Palier 2', color:'#f59e0b', floorName:'Désert Aride' },
         { id:3, label:'Palier 3', color:'#f87171', floorName:'Forêt Elfique' }];
    _gcMaxLevel = snapG.exists() && typeof snapG.data().maxLevel === 'number'
      ? snapG.data().maxLevel : 18;
    _renderGameConfig();
  } catch(e) {
    content.innerHTML = `<div style="color:var(--danger);">Erreur chargement : ${e.message}</div>`;
  }
}

function _renderGameConfig() {
  const content = document.getElementById('gc-content');
  const S = {
    section:  'margin-bottom:28px;',
    h:        'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:12px;',
    row:      'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;',
    inp:      'background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:13px;outline:none;',
    label:    'font-size:11px;color:var(--muted);width:70px;flex-shrink:0;',
  };

  let html = `
    <div style="${S.section}">
      <div style="${S.h}">Paliers</div>
      <div id="gc-paliers-list">`;

  for (let i = 0; i < _gcPaliers.length; i++) {
    const p = _gcPaliers[i];
    html += `
        <div style="${S.row}" id="gc-palier-row-${i}">
          <span style="${S.label}">ID</span>
          <input type="number" min="1" max="99" value="${p.id}" style="${S.inp}width:64px;"
            data-gc="id" data-idx="${i}" oninput="gcUpdatePalier(${i},'id',+this.value)">
          <span style="${S.label}">Label</span>
          <input type="text" value="${p.label}" style="${S.inp}flex:1;"
            data-gc="label" data-idx="${i}" oninput="gcUpdatePalier(${i},'label',this.value)">
          <span style="${S.label}">Couleur</span>
          <input type="color" value="${p.color || '#888888'}" style="width:40px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;"
            data-gc="color" data-idx="${i}" oninput="gcUpdatePalier(${i},'color',this.value)">
          <span style="${S.label}">Zone</span>
          <input type="text" value="${p.floorName || ''}" placeholder="Nom de la zone" style="${S.inp}flex:1;"
            data-gc="floorName" data-idx="${i}" oninput="gcUpdatePalier(${i},'floorName',this.value)">
          <button class="btn btn-ghost" style="color:var(--danger);font-size:12px;padding:5px 8px;flex-shrink:0;"
            onclick="gcRemovePalier(${i})" title="Supprimer ce palier">🗑️</button>
        </div>`;
  }

  html += `
      </div>
      <button class="btn btn-ghost" onclick="gcAddPalier()" style="font-size:12px;margin-top:4px;">+ Ajouter un palier</button>
    </div>

    <div style="${S.section}">
      <div style="${S.h}">Paramètres de jeu</div>
      <div style="${S.row}">
        <span style="${S.label}">Niveau max</span>
        <input type="number" id="gc-maxlevel" min="1" max="99" value="${_gcMaxLevel}"
          style="${S.inp}width:80px;" oninput="_gcMaxLevel=+this.value">
        <span style="font-size:12px;color:var(--muted);">Niveau maximum des items et personnages</span>
      </div>
    </div>`;

  content.innerHTML = html;
}

window.gcUpdatePalier = (idx, field, val) => { _gcPaliers[idx][field] = val; };

window.gcAddPalier = () => {
  const maxId = _gcPaliers.reduce((m, p) => Math.max(m, p.id), 0);
  _gcPaliers.push({ id: maxId + 1, label: `Palier ${maxId + 1}`, color: '#a78bfa', floorName: '' });
  _renderGameConfig();
};

window.gcRemovePalier = async (idx) => {
  const p = _gcPaliers[idx];
  if (_gcPaliers.length <= 1) { toast('⚠️ Impossible de supprimer le dernier palier', 'warning'); return; }
  if (!await modal.confirm(`Supprimer "${p.label}" ?\nLes données existantes qui référencent ce palier ne seront pas affectées.`)) return;
  _gcPaliers.splice(idx, 1);
  _renderGameConfig();
};

window.saveGameConfig = async () => {
  const btn = document.getElementById('gc-save-btn');
  btn.disabled = true; btn.textContent = '⏳';

  // Validation
  const ids = _gcPaliers.map(p => p.id);
  if (new Set(ids).size !== ids.length) {
    toast('⚠️ Les IDs de palier doivent être uniques', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }
  if (_gcPaliers.some(p => !p.label?.trim())) {
    toast('⚠️ Tous les paliers doivent avoir un label', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }
  const maxLv = +document.getElementById('gc-maxlevel').value;
  if (!maxLv || maxLv < 1 || maxLv > 99) {
    toast('⚠️ Niveau max invalide (1–99)', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }

  try {
    const newPalierIds = ids.filter(id => !CREATOR_PALIERS.includes(id));

    await Promise.all([
      setDoc(doc(db, 'config', 'paliers'), { paliers: _gcPaliers }),
      setDoc(doc(db, 'config', 'game'),    { maxLevel: maxLv }),
    ]);

    // Mettre à jour l'état en mémoire
    _paliersConfig  = _gcPaliers.map(p => ({ ...p }));
    CREATOR_PALIERS = _paliersConfig.map(p => p.id);
    _CF_DEFS.palier.opts = _paliersConfig.map(p => [p.id, p.label]);
    _populateAllPalierSelects();

    toast('✓ Configuration sauvegardée', 'success');
  } catch(e) {
    toast(`⛔ Erreur : ${e.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
  }
};

_lazyPanel(() => import('./moderation-game-tools.js?v=0'), ['showEventsTool', 'moveVclEvent', 'createVclEvent', 'deleteVclEvent', 'showDonjonsTool', 'createVclDonjon', 'moveVclDonjon', 'deleteVclDonjon', 'showTitresTool', 'createVclTitre', 'addVclTitreStat', 'removeVclTitreStat', 'renameVclTitre', 'moveVclTitre', 'deleteVclTitre', 'showEffectsTool', 'seedEffectTypes', 'saveEffectTypes', 'switchEffectsTab', 'addEffectType', 'addEffectTemplate']);

window.addEffectType = function addEffectType() {
  const id     = document.getElementById('new-effect-id').value.trim();
  const icon   = document.getElementById('new-effect-icon').value.trim();
  const color  = document.getElementById('new-effect-color').value.trim();
  const label  = document.getElementById('new-effect-label').value.trim();
  const prefix = document.getElementById('new-effect-prefix').value.trim();
  if (!id) { toast('ID obligatoire', 'warning'); return; }
  if (_effectsData.types.some(t => t.id === id)) { toast('ID déjà existant', 'warning'); return; }
  _effectsData.types.push({ id, icon, color, label, prefix });
  _markEffectsDirty();
  document.getElementById('new-effect-id').value = '';
  document.getElementById('new-effect-icon').value = '';
  document.getElementById('new-effect-color').value = '';
  document.getElementById('new-effect-label').value = '';
  document.getElementById('new-effect-prefix').value = '';
  renderEffectTypes();
};

window.addEffectTemplate = function addEffectTemplate() {
  _effectsData.templates.push({ label: 'Nouveau template', effects: [] });
  _markEffectsDirty();
  renderEffectTypes();
  switchEffectsTab('templates');
};

_lazyPanel(() => import('./moderation-bugs.js?v=b25b387d'), ['showBugsConnus', '_loadBugsConnus', 'saveBugForm', 'startEditBug', 'cancelEditBug', 'saveEditBug', 'deleteBug']);

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

// ══════════════════════════════════════════════════════
// QUALITÉ DES DONNÉES : tri par palier + « mettre de côté »
// ══════════════════════════════════════════════════════
// Couche commune posée sur les onglets-listes du hub. Elle observe chaque panneau et, après chaque rendu :
//  - ajoute un badge de palier à chaque ligne et permet de trier par palier ;
//  - (aside: true) ajoute « ⏸ Mettre de côté » : la ligne descend tout en bas, sous un séparateur.
// Les onglets qui ont déjà leur propre « ignorer » (orphelins, Tableau de Chasse) gardent le leur et gagnent le tri.
// Préférences (tri, lignes mises de côté) : localStorage, propres à chaque navigateur.
const DQ_PANELS = [
  { panel: 'dead-links-panel',    aside: true },
  { panel: 'ghost-id-panel',      aside: true },
  { panel: 'orphan-ids-panel',    aside: true },
  { panel: 'self-craft-panel',    aside: true },
  { panel: 'obtain-legacy-panel', aside: true },
  { panel: 'region-orphan-panel', aside: false },
  { panel: 'mob-orphan-panel',    aside: false },
  { panel: 'quest-orphan-panel',  aside: false },
  { panel: 'completion-panel',    aside: false, onSort: () => window.renderCompletion?.() },
];
const _DQ_ASIDE = 'vcl_dq_aside', _DQ_SORT = 'vcl_dq_sort';
const _dqLoad = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const _dqSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _dqAside = p => new Set(_dqLoad(_DQ_ASIDE)[p] || []);
function _dqToggleAside(p, key) {
  const d = _dqLoad(_DQ_ASIDE), s = new Set(d[p] || []);
  s.has(key) ? s.delete(key) : s.add(key);
  d[p] = [...s]; _dqSave(_DQ_ASIDE, d);
}
const _dqSort = p => _dqLoad(_DQ_SORT)[p] || 'default';
function _dqRank(p) {
  if (p == null || p === '') return 3000;
  if (p === 'event') return 1000;
  const n = Number(p);
  return Number.isNaN(n) ? 3000 : n < 0 ? 2000 : n;
}
function _dqLabel(p) {
  if (p == null || p === '') return '—';
  if (p === 'event') return 'Event';
  const n = Number(p);
  return Number.isNaN(n) ? '—' : n < 0 ? 'Archive' : 'P' + n;
}
window._dqRank = _dqRank;
window._dqSort = _dqSort;

// Paliers connus : uniquement depuis le cache déjà chargé par les onglets (aucune lecture Firestore en plus).
function _dqPalierMap() {
  const m = new Map();
  for (const col of ['items', 'items_hidden', 'mobs', 'personnages', 'quetes', 'regions'])
    for (const d of (_modCache[col] || [])) if (d.id && d.palier != null) m.set(d.id, d.palier);
  return m;
}
function _dqPalierOf(ids, map) {
  for (const id of ids) {
    if (map.has(id)) return map.get(id);
    const m = id.match(/_p(\d+)(?:_\d+)?$/);
    if (m) return +m[1];
  }
  return null;
}

function _dqBar(cfg) {
  const panel = document.getElementById(cfg.panel);
  if (!panel) return null;
  let bar = panel.querySelector(':scope > .dq-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'dq-bar';
    bar.innerHTML = `<span class="dq-bar-label">Trier</span>
      <button class="diag-tab" data-dq-sort="default">Ordre d'origine</button>
      <button class="diag-tab" data-dq-sort="palier">Par palier</button>
      <span class="dq-bar-aside" style="display:none;"></span>`;
    bar.addEventListener('click', e => {
      const s = e.target.closest('[data-dq-sort]');
      if (s) {
        const d = _dqLoad(_DQ_SORT); d[cfg.panel] = s.dataset.dqSort; _dqSave(_DQ_SORT, d);
        cfg.onSort ? cfg.onSort() : _dqEnhance(cfg);
        _dqBarState(cfg, bar._asideCount || 0);
      } else if (e.target.closest('[data-dq-clear]')) {
        const d = _dqLoad(_DQ_ASIDE); delete d[cfg.panel]; _dqSave(_DQ_ASIDE, d);
        _dqEnhance(cfg);
      }
    });
    const tabs = panel.querySelector(':scope > .diag-tabs');
    tabs ? tabs.after(bar) : panel.prepend(bar);
  }
  return bar;
}
function _dqBarState(cfg, asideCount = 0) {
  const bar = _dqBar(cfg);
  if (!bar) return;
  bar._asideCount = asideCount;
  const mode = _dqSort(cfg.panel);
  bar.querySelectorAll('[data-dq-sort]').forEach(b => b.classList.toggle('active', b.dataset.dqSort === mode));
  const a = bar.querySelector('.dq-bar-aside');
  if (a) {
    a.style.display = cfg.aside && asideCount ? '' : 'none';
    a.innerHTML = `⏸ ${asideCount} mis de côté <button class="diag-tab" data-dq-clear="1">Tout remettre</button>`;
  }
}

const _dqObs = new Map();
async function _dqEnhance(cfg) {
  const panel = document.getElementById(cfg.panel);
  if (!panel) return;
  const findGroups = () => [...panel.querySelectorAll('table.ghost-table > tbody')].map(box => ({ box, tr: true }))
    .concat([...panel.querySelectorAll('[data-dq-list]')].map(box => ({ box, tr: false })));
  if (!findGroups().length) return;   // rien à traiter : on ne lit rien dans Firestore
  const map = _dqPalierMap();
  const obs = _dqObs.get(cfg.panel);
  obs?.disconnect();   // nos propres modifications du DOM ne doivent pas relancer le traitement
  try {
    const aside = cfg.aside ? _dqAside(cfg.panel) : new Set();
    const mode = _dqSort(cfg.panel);
    let asideTotal = 0;
    const groups = findGroups();
    for (const g of groups) {
      const units = [];
      for (const el of [...g.box.children]) {
        if (el.classList.contains('dq-sep')) continue;
        if (g.tr && el.dataset.fixRow && units.length) { units[units.length - 1].els.push(el); continue; }
        if (!g.tr && el.dataset.dqKey === undefined) continue;
        units.push({ els: [el], idx: units.length });
      }
      for (const u of units) {
        const head = u.els[0];
        if (head.dataset.dqDone === undefined) {
          const cells = g.tr ? [...head.children] : [];
          if (g.tr) head.dataset.dqKey = cells.slice(0, Math.max(1, cells.length - 1)).map(c => {
            const t = c.cloneNode(true);
            t.querySelectorAll('.dl-staged-new, .dq-pal').forEach(n => n.remove());   // l'état « en attente » ne fait pas partie de l'identité de la ligne
            return t.textContent.replace(/\s+/g, ' ').trim();
          }).join('|');
          const ids = [...head.querySelectorAll('.ghost-id')].map(s => s.textContent.trim());
          if (head.dataset.dqId) ids.unshift(head.dataset.dqId);
          head.dataset.dqPal = _dqPalierOf(ids, map) ?? '';
          head.dataset.dqIdx = u.idx;
          const badge = document.createElement('span');
          badge.className = 'dq-pal';
          badge.textContent = _dqLabel(head.dataset.dqPal === '' ? null : head.dataset.dqPal);
          (g.tr ? cells[0] : (head.querySelector('[data-dq-badge]') || head)).prepend(badge);
          if (cfg.aside) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost dq-aside-btn';
            btn.addEventListener('click', () => { _dqToggleAside(cfg.panel, head.dataset.dqKey); _dqEnhance(cfg); });
            (g.tr ? cells[cells.length - 1] : head).appendChild(btn);
          }
          head.dataset.dqDone = '1';
        }
        u.key = head.dataset.dqKey;
        u.pal = head.dataset.dqPal === '' ? null : head.dataset.dqPal;
        u.aside = aside.has(u.key);
        u.idx = +head.dataset.dqIdx;
        const btn = head.querySelector('.dq-aside-btn');
        if (btn) { btn.textContent = u.aside ? '↩ Remettre' : '⏸ Mettre de côté'; btn.title = u.aside ? 'Remettre dans la liste' : 'Mettre de côté : la ligne descend tout en bas'; }
        u.els.forEach(e => { e.style.opacity = u.aside ? '.5' : ''; });
        if (u.aside) asideTotal++;
      }
      units.sort((a, b) => (a.aside - b.aside) || (mode === 'palier' ? _dqRank(a.pal) - _dqRank(b.pal) : 0) || a.idx - b.idx);
      const tail = g.tr ? null : [...g.box.children].find(c => c.dataset.dqKey === undefined && !c.classList.contains('dq-sep'));
      let sep = [...g.box.children].find(c => c.classList.contains('dq-sep'));
      const wantSep = units.some(u => u.aside);
      if (!wantSep && sep) { sep.remove(); sep = null; }
      if (wantSep && !sep) {
        sep = document.createElement(g.tr ? 'tr' : 'div');
        sep.className = 'dq-sep';
        const label = '⏸ Mis de côté';
        if (g.tr) sep.innerHTML = `<td colspan="${g.box.closest('table').querySelectorAll('thead th').length || 5}">${label}</td>`;
        else sep.textContent = label;
      }
      const desired = [];
      for (const u of units) {
        if (u.aside && sep && !desired.includes(sep)) desired.push(sep);
        desired.push(...u.els);
      }
      // On ne déplace rien si l'ordre est déjà bon : déplacer un nœud fait perdre le focus d'un champ de saisie qu'il contient
      const current = [...g.box.children].filter(c => desired.includes(c));
      if (desired.some((e, i) => current[i] !== e)) desired.forEach(e => g.box.insertBefore(e, tail));
    }
    _dqBarState(cfg, asideTotal);
  } finally {
    obs?.observe(panel, { childList: true, subtree: true });
  }
}

function _dqInit() {
  for (const cfg of DQ_PANELS) {
    const panel = document.getElementById(cfg.panel);
    if (!panel) continue;
    _dqBarState(cfg);
    let t = null;
    // On ignore ce qui se passe dans les lignes d'édition (saisie, menus déroulants) : seule la liste elle-même nous concerne
    const obs = new MutationObserver(recs => {
      if (recs.every(r => r.target.closest?.('[data-fix-row], .dq-bar'))) return;
      clearTimeout(t); t = setTimeout(() => _dqEnhance(cfg), 80);
    });
    _dqObs.set(cfg.panel, obs);
    obs.observe(panel, { childList: true, subtree: true });
  }
}
_dqInit();
