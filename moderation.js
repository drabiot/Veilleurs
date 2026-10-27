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
  const type = COL_TO_TYPE[_ed.collection];
  if (!type || !_ed.origData) return;
  sessionStorage.setItem('editSub', JSON.stringify({ type, data: _ed.origData }));
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

_lazyPanel(() => import('./moderation-orders.js?v=0ee74eeb'), ['showMobOrder', 'filterMobOrder', 'saveMobOrder', 'showItemOrder', 'filterItemOrder', 'saveItemOrder', 'showPnjOrder', 'filterPnjOrder', 'autoSortPnjOrder', 'savePnjOrder', 'showRegionOrder', 'filterRegionOrder', 'saveRegionOrder', 'showPanoplieOrder', 'renderPanoplieOrder', 'savePanoplieOrder', 'loadMobOrder', 'loadItemOrder', 'loadPnjOrder', 'loadRegionOrder', 'loadPanoplieOrder']);


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
    get allSubs() { return allSubs; },
    get customRoles() { return _shared.roles?.customRoles ?? []; },
    _SUB_COL_MAP, generateCardBlob, auth, roleLevel, TIER_FIRESTORE, TIER_DEFAULTS,
    getTierDisplay: _getTierDisplay,
    ed: _ed, orderData: _orderData, getItemGameplayKeys, desanitizeFromFirestore, get sensState() { return _shared.sens?.state ?? _sensDefault; },
    _regionName, _readContribs, _COL_LABELS, _slugName, _renamedItemId, _renameImagePaths, _toastImageRenames,
    _syncPnjObtain, _syncMobObtain, _syncItemObtain, _recordItemRename, _renameItemReferences,
    renderSubs, hasRole, addCreatorBtn: _addCreatorBtn, edCache: _edCache, shared: _shared,
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

_lazyPanel(() => import('./moderation-editor.js?v=df351add'), ['cpSvDown', 'cpHueDown', 'cpHexInput', 'cpRgbInput', 'edPickPreset', 'edSwitchTab', 'edAddGenField', 'edRenameField', 'edDelGenRow', 'edOpenRegions', 'edCloseRegions', 'edFilterRegions', 'edSelectRegion', 'showEditor', 'editorGoBack', 'saveEditor', 'deleteCurrentEntry']);



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


_lazyPanel(() => import('./moderation-trash.js?v=6311a2da'), ['showTrash', 'loadTrash', 'restoreFromTrash', 'permanentDeleteTrash', 'emptyTrash']);


let CREATOR_PALIERS = [1, 2, 3]; // mis à jour dynamiquement depuis Firestore config/paliers
let _paliersOpts = null; // options du champ palier (null = défaut du Tableau de chasse), lu par moderation-quality.js
let _paliersConfig = []; // données complètes { id, label, color, floorName }
_lazyPanel(() => import('./moderation-roles.js?v=ac9e1251'), ['showPermissions', 'loadPermissions', '_setPermission', '_setCustomRoleBaseTier', 'showDiscordRoles', 'loadDiscordRoles', 'saveDiscordRoles', 'togglePermTech', '_setCollectionPerm', 'loadRoles', 'showCreateRoleForm', 'hideCreateRoleForm', 'createRole', 'deleteRole', 'showGenerateRulesModal', 'closeRulesModal', 'copyGeneratedRules', 'toggleCreatorTool', 'toggleCreatorPalier']);


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


_lazyPanel(() => import('./moderation-discord.js?v=c3dddcc5'), ['showDiscordWebhooks', 'loadDiscordWebhooks', 'deleteChannelPosts', 'saveDiscordWebhooks', 'switchDwTab', 'dwEmbedRemove', 'dwEmbedAdd', 'dwUnsentCheckAll', 'dwUnsentDelete', 'dwPublishUnsentSend', 'dwPublishFilter', 'dwPublishCheckAll', 'dwPublishSelected', 'reorderAllChannelTags', 'testNewSubmissionWebhook', 'testDiscordWebhook']);


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
_lazyPanel(() => import('./moderation-quests.js?v=0'), ['showQuestOrder', 'renderQuestOrder', 'showQuestOrphans', 'loadQuestOrphans', 'saveQuestOrder', 'loadQuestOrder']);


_lazyPanel(() => import('./moderation-users.js?v=e7d486e9'), ['showUsersPanel', 'loadUsers', 'filterUsers', 'suspendUser', 'unsuspendUser', 'setUserRole', 'deleteUserAccount']);


_lazyPanel(() => import('./moderation-leaderboard.js?v=6ffaeb75'), ['showLeaderboard', 'loadLeaderboard', 'resetHomeLeaderboard', 'undoHomeLeaderboardReset', 'showLeaderboardUser', 'openLbMigrateDialog', 'closeLbMigrateDialog', 'lbMigrateSearchUsers', 'confirmLbMigrate']);


_lazyPanel(() => import('./moderation-sensible.js?v=0'), ['sensReload', 'sensEditItem', 'sensEditMob', 'sensEditPnj', 'sensFilterItemsPublic', 'sensFilterMobsPublic', 'sensItemToSensible', 'sensItemToPublic', 'sensMobToSensible', 'sensMobToPublic', 'sensFilterPnjPublic', 'sensPnjToSensible', 'sensPnjToPublic']);

_lazyPanel(() => import('./moderation-audit.js?v=24907cd5'), ['showAuditLog', 'loadAuditLog', 'renderAuditLog', 'loadAuditLogMore']);

_lazyPanel(() => import('./moderation-stats.js?v=4d38d6b4'), ['resetStatistiques', 'showStatistiques', 'loadStatistiques', 'showMigration', 'sensRunKeyMigration']);


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

_lazyPanel(() => import('./moderation-quality.js?v=0'), ['showCompletion', 'loadCompletion', 'renderCompletion', 'ignoreCompletionDoc', 'unignoreCompletionDoc', 'saveTableauDeChasse', 'saveCompletionFields', 'openCompletionInCreator', 'showCreatorValidation', 'loadCreatorValidation', '_setCvMode', '_setCvSubMode', '_onCvToggle', 'saveCreatorValidation']);


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

_lazyPanel(() => import('./moderation-images.js?v=f6dc8676'), ['showImagesTool', 'loadImagesTool', 'saveImagesConfig', 'imgFileDrop', 'imgFileSelect', 'imgUploadToGithub', 'resetImagesTool', 'switchImgTab', 'tpkOpenLightbox', 'tpkLbClose', 'tpkLbBgDown', 'tpkLoadZip', 'tpkRefreshGithub', 'tpkSelToInutile', 'tpkSelToIllisible', 'tpkSelClear', 'tpkRender', 'tpkLeftMore', 'tpkCreateVFolder', 'tpkDeleteVFolder', 'tpkCollapseAll', 'tpkVisualMatch', 'tpkMatchUpdateCount', 'tpkMatchSelectAll', 'tpkMatchApply', 'tpkSaveReference', 'previewNormalize', 'runNormalize', 'showCalibrateur', 'showCaptureSprites']);
_lazyPanel(() => import('./moderation-obtain-legacy.js?v=99eaff64'), ['showObtainLegacy', 'loadObtainLegacy', 'filterObtainLegacy']);
_lazyPanel(() => import('./moderation-data-all.js?v=e899a830'), ['showDataAll', 'loadDataAll', 'onDataAllTypeChange', 'renderDataAll', 'deleteDataDuplicates']);


_lazyPanel(() => import('./moderation-map.js?v=14c5774d'), ['showMapPanel', 'deleteMapMarker', 'showZoneEditor', 'zeZoom', 'zeZoomReset', 'zeLayerChange', 'zeFloorChange', 'zeRenderSvg', 'zeRemovePoint', 'zeCheckSave', 'zoneEditorReset', 'zoneEditorSave', 'zeSearchMob', 'zeAddMobFromSelect', 'zeAddMob', 'zeRemoveMob', 'zeRenderMobList', 'showZoneList', 'loadZoneList', 'renderZoneList', 'migrateHardcodedZones', 'switchMapTab', 'loadPassages', 'renderPassageList', 'pgValidate', 'pgReset', 'pgSearchPins', 'pgAddLink', 'pgRemoveLink', 'saveNewPassage', 'deletePassage', 'loadAllMapPins', 'renderAllMapPins', 'loadPinColors', 'savePinColors', 'loadPinEmojis', 'savePinEmojis', 'saveIndividualPinEmoji', 'loadPinCategories', 'savePinCategories', 'loadPinTypes']);


_lazyPanel(() => import('./moderation-game-config.js?v=bfa73f54'), ['showGameConfig', 'gcUpdatePalier', 'gcAddPalier', 'gcRemovePalier', 'saveGameConfig']);


_lazyPanel(() => import('./moderation-game-tools.js?v=0065abfb'), ['showEventsTool', 'moveVclEvent', 'createVclEvent', 'deleteVclEvent', 'showDonjonsTool', 'createVclDonjon', 'moveVclDonjon', 'deleteVclDonjon', 'showTitresTool', 'createVclTitre', 'addVclTitreStat', 'removeVclTitreStat', 'renameVclTitre', 'moveVclTitre', 'deleteVclTitre', 'showEffectsTool', 'seedEffectTypes', 'saveEffectTypes', 'switchEffectsTab', 'addEffectType', 'addEffectTemplate']);


_lazyPanel(() => import('./moderation-bugs.js?v=0490d991'), ['showBugsConnus', '_loadBugsConnus', 'saveBugForm', 'startEditBug', 'cancelEditBug', 'saveEditBug', 'deleteBug']);

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
