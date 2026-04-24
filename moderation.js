import { db, auth, onAuthStateChanged,
         login, logout, loginWithGoogle,
         ROLES, roleLevel, hasRole, COL,
         collection, getDocs, getDoc, doc, updateDoc, setDoc,
         deleteDoc, deleteField, serverTimestamp, orderBy, query,
         hashName, getItemGameplayKeys,
         sanitizeForFirestore, desanitizeFromFirestore,
         invalidateCache }
                             from './firebase.js';
import { toast }  from './components/toast.js';
import { modal }  from './components/modal.js';
import { store }  from './store.js';

// Helpers partagés — utils.js est chargé en classic script avant ce module
const { normalize } = window.VCL;
const _WIKI_ROOT = new URL('.', import.meta.url).href;

let currentUser = null;
let currentRole = 'visiteur';
let allSubs      = [];
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
  _modCache[colName] = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  return _modCache[colName];
}
function invalidateModCache(colName) {
  delete _modCache[colName];
}

// ── Auth ──────────────────────────────────────────────
onAuthStateChanged(auth, async user => {
  if (!user) {
    showAuthWall();
    return;
  }
  currentUser = user;
  // Lire le rôle
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    currentRole = snap.exists() ? (snap.data().role || 'membre') : 'membre';
  } catch { currentRole = 'membre'; }

  if (!hasRole(currentRole, 'contributeur')) {
    showAuthWall('⛔ Accès réservé aux contributeurs.');
    return;
  }

  // Masquer les sections admin-only pour tout rôle non-admin (contributeur, modo, etc.)
  if (currentRole !== 'admin') {
    ['btn-users', 'btn-discord-webhooks', 'btn-permissions', 'btn-migration', 'btn-creator-validation', 'btn-migration-evolutif', 'sec-admin'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  }

  document.getElementById('auth-wall').style.display   = 'none';
  document.getElementById('main-layout').style.display = 'grid';
  // Afficher le pseudo si disponible, sinon l'email
  try {
    const snapU = await getDoc(doc(db, 'users', user.uid));
    const pseudo = snapU.exists() ? (snapU.data().pseudo || null) : null;
    document.getElementById('header-user').textContent = '👤 ' + (pseudo || user.email);
  } catch { document.getElementById('header-user').textContent = '👤 ' + user.email; }
  document.getElementById('header-role').textContent   = currentRole;
  document.getElementById('btn-logout').style.display  = '';

  // Hash routing — navigue vers le panel correspondant au hash initial
  _routeToHash();
});

function showAuthWall(msg) {
  document.getElementById('auth-wall').style.display   = 'flex';
  document.getElementById('main-layout').style.display = 'none';
  if (msg) {
    const err = document.getElementById('login-error');
    err.textContent = msg; err.style.display = '';
  }
}

function toEmail(input) {
  return input.includes('@') ? input : `${input}@veilleurs.wiki`;
}

window.doLogin = async () => {
  const raw  = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  const err  = document.getElementById('login-error');
  err.style.display = 'none';
  try {
    await login(toEmail(raw), pass);
  } catch(e) {
    err.textContent = '⛔ ' + (e.message.includes('invalid-credential') ? 'Identifiant ou mot de passe incorrect.' : e.message);
    err.style.display = '';
  }
};

window.doLoginGoogle = async () => {
  const err = document.getElementById('login-error');
  err.style.display = 'none';
  try {
    await loginWithGoogle();
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
    // Pré-charger les pseudos de tous les auteurs (non-bloquant)
    const uids = [...new Set(allSubs.flatMap(s => [s.submittedBy, s.reviewedBy].filter(Boolean)))];
    try { await fetchUserNames(uids); } catch {}
    updateCounts();
    renderSubs();
    _saveLbSnapshot(allSubs).catch(() => {}); // snapshot de secours en arrière-plan
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
  document.getElementById('count-rejected').textContent = allSubs.filter(s => s.status === 'rejected').length;
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

function renderSubs() {
  const list = document.getElementById('submissions-list');
  let subs = allSubs;
  if (filterStatus !== 'all') subs = subs.filter(s => s.status === filterStatus);
  if (filterType   !== 'all') subs = subs.filter(s => s.type === filterType);
  if (filterSearch) {
    const q = normalize(filterSearch);
    subs = subs.filter(s =>
      normalize(s.data?.name || s.data?.titre || s.data?.label || '').includes(q) ||
      normalize(s.data?.id || '').includes(q)
    );
  }
  if (!subs.length) { list.innerHTML = '<div class="empty">Aucune soumission dans cette catégorie.</div>'; return; }

  list.innerHTML = '';
  if (filterStatus === 'approved' || filterStatus === 'rejected') {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn btn-danger';
    bulkBtn.style.cssText = 'margin-bottom:12px;font-size:12px;';
    bulkBtn.textContent = `🗑️ Tout supprimer (${subs.length})`;
    bulkBtn.addEventListener('click', () => bulkDeleteSubs(filterStatus));
    list.appendChild(bulkBtn);
  }
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

function buildCard(sub) {
  const card = document.createElement('div');
  card.className = `sub-card status-${sub.status}`;
  card.id = `card-${sub._id}`;

  const typeLabels = { item:'⚔️ Item', mob:'👾 Mob', pnj:'🧑 PNJ', region:'📍 Région', quest:'📜 Quête', panoplie:'🔗 Panoplie' };
  const name = sub.data?.titre || sub.data?.name || sub.data?.label || sub._id;
  const ts   = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleString('fr-FR') : '—';
  const code = toJSStr(sub.data || {}, 0) + ',';

  const statusLabel = { pending:'⏳ En attente', approved:'✓ Approuvé', rejected:'✕ Rejeté' }[sub.status] || sub.status;

  let actionsHtml = '';
  let editorHtml  = '';
  if (sub.status === 'pending') {
    editorHtml = `
      <div class="sub-editor" id="editor-${sub._id}">
        <textarea class="sub-editor-ta" id="editor-ta-${sub._id}" spellcheck="false" oninput="onEditorInput('${sub._id}')"></textarea>
        <div class="sub-editor-err" id="editor-err-${sub._id}"></div>
        <div class="sub-editor-status" id="editor-status-${sub._id}"></div>
      </div>
    `;
    const hasImg = !!sub.forum_image;
    actionsHtml = `
      <input type="text" class="sub-comment" id="comment-${sub._id}" placeholder="Commentaire (optionnel)">
      <button class="btn btn-ghost"   id="btn-edit-${sub._id}" onclick="toggleEdit('${sub._id}')" style="font-size:12px;">✏️ Modifier</button>
      <button class="btn btn-ghost"   onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre cette soumission dans le Creator pour l'éditer">⚙️ Creator</button>
      <button class="btn btn-approve" onclick="approve('${sub._id}')">✓ Approuver</button>
      <button class="btn btn-reject"  onclick="reject('${sub._id}')">✕ Rejeter</button>
    `;
    if (sub.type === 'item') {
      actionsHtml += `
        <div class="mod-img-row">
          <div class="mod-img-zone${hasImg ? ' has-img' : ''}" id="mod-img-zone-${sub._id}"
               ondragover="event.preventDefault();this.classList.add('drag-over')"
               ondragleave="this.classList.remove('drag-over')"
               ondrop="modImgDrop('${sub._id}',event)">
            <img class="mod-img-preview" id="mod-img-preview-${sub._id}" style="display:none" alt="">
            <span class="mod-img-placeholder" id="mod-img-placeholder-${sub._id}"${hasImg ? ' style="display:none"' : ''}>🖼️ Glisse une image ici</span>
          </div>
          <div class="mod-img-actions">
            <button class="btn btn-ghost btn-sm" onclick="modImgPaste('${sub._id}')" style="font-size:11px;">📋 Coller</button>
            <button class="btn btn-ghost btn-sm" onclick="document.getElementById('mod-img-input-${sub._id}').click()" style="font-size:11px;">📁 Fichier</button>
            <button class="mod-img-clear" id="mod-img-clear-${sub._id}" onclick="modImgClear('${sub._id}')"${hasImg ? '' : ' style="display:none"'}>✕ Supprimer</button>
          </div>
          <input type="file" id="mod-img-input-${sub._id}" accept="image/*" style="display:none" onchange="modImgFile('${sub._id}',this.files[0])">
        </div>
      `;
    }
  } else if (sub.comment) {
    actionsHtml = `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>`;
  }

  const modBadge = sub.isModification
    ? `<span class="sub-type" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);">✏️ Modif</span>`
    : `<span class="sub-type" style="background:rgba(74,222,128,.12);color:var(--success);border:1px solid rgba(74,222,128,.3);">✨ Ajout</span>`;

  const playerCommentHtml = sub.submitter_comment
    ? `<div style="margin:4px 0 6px;padding:6px 10px;background:rgba(215,175,95,.08);border:1px solid rgba(215,175,95,.25);border-radius:6px;font-size:12px;color:#d7af5f;">💬 ${escHtml(sub.submitter_comment)}</div>`
    : '';

  card.innerHTML = `
    <div class="sub-head">
      <span class="sub-type">${typeLabels[sub.type] || sub.type}</span>
      ${modBadge}
      <span class="sub-name">${escHtml(name)}</span>
      <span class="sub-meta">${ts}</span>
      <span class="sub-meta">par <b>${escHtml(userName(sub.submittedBy, sub.submitterName))}</b></span>
      <span class="sub-status ${sub.status}">${statusLabel}</span>
    </div>
    ${playerCommentHtml}
    <div class="sub-body">
      <div class="sub-actions">
        ${actionsHtml}
        <button class="btn btn-copy" onclick="copyCode('${sub._id}')">📋 Copier</button>
        ${currentRole === 'admin' || sub.status === 'pending' ? `<button class="btn btn-copy" onclick="deleteSub('${sub._id}')" style="color:var(--danger);border-color:var(--danger);">🗑️</button>` : ''}
        <button class="btn-toggle" onclick="toggleDetails('${sub._id}', this)">▾ Voir</button>
      </div>
      <div class="sub-details" id="details-${sub._id}">
        <div class="sub-code" id="code-${sub._id}">${escHtml(code)}</div>
        ${editorHtml}
      </div>
    </div>
  `;

  // Initialiser le preview image hors innerHTML (évite de mettre le base64 dans le template)
  if (sub.forum_image && sub.type === 'item' && sub.status === 'pending') {
    const img = card.querySelector(`#mod-img-preview-${sub._id}`);
    if (img) {
      img.src = sub.forum_image;
      img.style.display = 'block';
      img.onclick = e => { e.stopPropagation(); openLightbox(sub.forum_image); };
    }
  }

  return card;
}

const escHtml = window.VCL.escHtml;

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
window.toggleEdit = (id) => {
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
    editor.classList.remove('open');
    btn.textContent = '✏️ Modifier';
    btn.style.background = '';
  } else {
    // Ouvrir : pre-fill JSON
    ta.value = JSON.stringify(sub.data || {}, null, 2);
    editor.classList.add('open');
    btn.textContent = '✔ Valider';
    btn.style.background = 'rgba(122,90,248,.25)';
    ta.focus();
  }
};

function tryParseEdit(id) {
  const sub = allSubs.find(s => s._id === id);
  const ta  = document.getElementById(`editor-ta-${id}`);
  if (!sub || !ta) return null;
  try {
    const parsed = JSON.parse(ta.value);
    if (typeof parsed !== 'object' || parsed === null) return 'Objet JSON attendu.';
    sub.data = parsed; // mutate in-place → approve() lira la version modifiée
    return null;
  } catch(e) {
    return 'JSON invalide : ' + e.message;
  }
}

// ── Live JSON validation dans l'éditeur inline ────────
window.onEditorInput = (id) => {
  const ta     = document.getElementById(`editor-ta-${id}`);
  const status = document.getElementById(`editor-status-${id}`);
  if (!ta) return;
  try {
    JSON.parse(ta.value);
    ta.classList.add('json-valid');
    ta.classList.remove('json-invalid');
    if (status) { status.textContent = '✓ JSON valide'; status.className = 'sub-editor-status ok'; }
  } catch(e) {
    ta.classList.add('json-invalid');
    ta.classList.remove('json-valid');
    if (status) { status.textContent = '✕ ' + e.message; status.className = 'sub-editor-status err'; }
  }
};

// ── Ouvrir dans Creator ────────────────────────────────
window.openInCreator = (id) => {
  const sub = allSubs.find(s => s._id === id);
  if (!sub || sub.status !== 'pending') return;
  sessionStorage.setItem('editSub', JSON.stringify({ type: sub.type, data: sub.data }));
  window.open('../creator.html');
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

    const dataId = sub.data?.id;
    if (!dataId) throw new Error('Pas d\'ID dans les données');

    const isSensible = sub.data?.sensible === true;
    const _contribName  = sub.submitterName || _userNames.get(sub.submittedBy) || 'Inconnu';
    const _contribField = { uid: sub.submittedBy || null, name: _contribName };

    if (sub.type === 'item' && isSensible) {
      // Item sensible → split gameplay (items_hidden par hash) + flavor (items_secret par id)
      const gameplayKeys = await getItemGameplayKeys();
      const gameplay = {};
      const secret   = {};
      for (const [k, v] of Object.entries(sub.data)) {
        if (k === 'sensible') continue;
        if (gameplayKeys.includes(k)) gameplay[k] = v;
        else                          secret[k]   = v;
      }
      const hash = await hashName(sub.data.name);
      if (!hash) throw new Error('Nom manquant pour hash');
      await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore(gameplay));
      // items_secret sert aussi de point d'ancrage pour le _contributor (créé même si vide)
      await setDoc(doc(db, COL.itemsSecret, String(dataId)), sanitizeForFirestore({ ...secret, _contributor: _contribField }));
      // Nettoyer toute version publique existante
      try { await deleteDoc(doc(db, COL.items, String(dataId))); } catch {}
      store.invalidate('items');
    } else if (sub.type === 'mob' && isSensible) {
      // Mob sensible → doc complet dans mobs_secret, jamais dans mobs
      const payload = { _order: Date.now(), _contributor: _contribField, ...sub.data };
      delete payload.sensible;
      await setDoc(doc(db, COL.mobsSecret, String(dataId)), sanitizeForFirestore(payload));
      try { await deleteDoc(doc(db, COL.mobs, String(dataId))); } catch {}
      store.invalidate('mobs');
    } else {
      // Flux standard
      const dataToWrite = { _order: Date.now(), ...sub.data, _contributor: _contribField };
      // Panoplie : couleur par défaut si absente (définie par la modération côté liste)
      if (sub.type === 'panoplie' && !dataToWrite.color) dataToWrite.color = '#b87333';
      await setDoc(doc(db, target, String(dataId)), dataToWrite);

      // Si l'entité était précédemment sensible, nettoyer les collections cachées
      if (sub.type === 'item') {
        try { await deleteDoc(doc(db, COL.itemsSecret, String(dataId))); } catch {}
        try {
          const hash = await hashName(sub.data.name);
          if (hash) await deleteDoc(doc(db, COL.itemsHidden, hash));
        } catch {}
      } else if (sub.type === 'mob') {
        try { await deleteDoc(doc(db, COL.mobsSecret, String(dataId))); } catch {}
      }

      // Invalider le store (cache + mémoire) pour forcer un re-fetch sur les pages de lecture
      const storeKey = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quetes:'quetes', panoplie:'panoplies' }[sub.type];
      if (storeKey) {
        store.invalidate(storeKey);
        // Bump wiki_version pour notifier les autres onglets/pages
        setDoc(doc(db, 'config', 'wiki_version'), { lastUpdated: serverTimestamp(), collection: storeKey }, { merge: true }).catch(() => {});
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
    const isDiscordItem = sub.type === 'item' &&
      ['arme', 'armure', 'accessoire'].includes(sub.data?.category) && sub.data?.palier;
    const subUpdate = {
      status:     'approved',
      reviewedBy: currentUser.uid,
      reviewedAt: serverTimestamp(),
      comment,
    };
    if (isDiscordItem) subUpdate.discord_sent = false;
    await updateDoc(doc(db, 'submissions', id), subUpdate);

    sub.status     = 'approved';
    sub.comment    = comment;
    sub.reviewedBy = currentUser.uid;
    if (isDiscordItem) sub.discord_sent = false;
    updateCounts();
    renderSubs();
    _saveLbSnapshot(allSubs).catch(() => {});
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
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✕ Rejeter'; }
  }
};

// ── Mob order panel ───────────────────────────────────
let _mobOrderData       = [];
let _mobOrderDirty      = false;
let _dragSrc            = null;
let _mobPalierCollapsed = new Set();

const TYPE_ORDER_MOD  = { monstre: 0, sbire: 1, mini_boss: 2, boss: 3 };
const TYPE_LABELS_MOD = { monstre: 'Monstre', sbire: 'Sbire', mini_boss: 'Mini-boss', boss: 'Boss' };

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
  'ghost-ids':      () => showGhostIds(),
  'region-orphans': () => showRegionOrphans(),
  'mob-orphans':    () => showMobOrphans(),
  'quest-orphans':  () => showQuestOrphans(),
  'members':        () => showUsersPanel(),
  'leaderboard':    () => showLeaderboard(),
  'webhooks':       () => showDiscordWebhooks(),
  'permissions':    () => showPermissions(),
  'migration':        () => showMigration(),
  'completion':       () => showCompletion(),
  'creator-validation': () => showCreatorValidation(),
  'data-incomplete':  () => showDataIncomplete(),
  'obtain-legacy':     () => showObtainLegacy(),
  'calibrateur':       () => showCalibrateur(),
  'capture-sprites':  () => showCaptureSprites(),
  'pnj-coords':       () => showPnjCoords(),
};

function _setHash(hash) {
  history.replaceState(null, '', '#' + hash);
  _activePanel = hash;
  // Cache TOUS les panneaux et désactive TOUS les boutons de filtre —
  // chaque show* n'a plus qu'à afficher son propre panneau et activer son bouton.
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sidebar')?.classList.remove('in-order-panel');
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
}

function _routeToHash() {
  const hash = location.hash.slice(1) || 'submissions';
  loadSubmissions(); // toujours charger les soumissions en fond
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
    map:            () => { delete _modCache['map_markers']; loadMapMarkers(); },
    'ghost-ids':    () => loadGhostIds(),
    'region-orphans': () => loadRegionOrphans(),
    'mob-orphans':  () => loadMobOrphans(),
    'quest-orphans': () => loadQuestOrphans(),
    submissions:    () => loadSubmissions(),
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
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('mob-order-panel').style.display     = '';
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');

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
    const visible = _mobOrderData.filter(m => normalize(m.name).includes(searchQ));
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(mob => {
      const row = document.createElement('div');
      row.className = 'mob-order-row';
      row.dataset.id = mob.id;
      const globalIdx = _mobOrderData.indexOf(mob) + 1;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${globalIdx}</span>
        <span class="mob-order-name">${mob.name||mob.id}</span>
        <span class="mob-order-tag">${mobTag(mob)}</span>
        <button class="ed-edit-btn" title="Modifier : ${mob.name||mob.id}\nID : ${mob.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('mobs', mob.id, mob, 'mob'); });
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : groupes par palier ──
  const paliers = [...new Set(_mobOrderData.map(m => m.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucun mob</div>'; return; }

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
    ph.querySelector('[data-toggle]').addEventListener('click', () => {
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
        <span class="mob-order-name">${mob.name||mob.id}</span>
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
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('mobs', mob.id, mob, 'mob'); });

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
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('item-order-panel').style.display    = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');

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

    // Admins : inclure aussi les items sensibles (items_hidden)
    if (currentRole === 'admin') {
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
    const visible = _itemOrderData.filter(it => normalize(it.name).includes(searchQ));
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
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : palier → catégorie → items ──
  const paliers = [...new Set(_itemOrderData.map(it => it.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucun item</div>'; return; }

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
    ph.querySelector('[data-toggle]').addEventListener('click', () => {
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

      ch.querySelector('[data-toggle]').addEventListener('click', e => {
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
let _pnjPalierCollapsed = new Set(); // paliers réduits

window.showPnjOrder = async () => {
  _setHash('pnj-order');
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('pnj-order-panel').style.display     = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');

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
    const [pnjs, _regDocsRaw] = await Promise.all([
      cachedDocs('personnages'),
      cachedDocs('regions'),
    ]);

    // Grouper tous les PNJ par région (clé = p.region || '')
    const byRegion = {};
    pnjs.forEach(p => {
      const key = p.region || '';
      if (!byRegion[key]) byRegion[key] = [];
      byRegion[key].push(p);
    });
    // Trier par ordre admin (champ `ordre`), puis alphabétiquement en fallback
    Object.values(byRegion).forEach(arr => arr.sort((a, b) => {
      const ao = a.ordre ?? null, bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return (a.name||'').localeCompare(b.name||'', 'fr');
    }));

    // Régions connues depuis Firestore, triées par leur ordre actuel
    const regDocs = [..._regDocsRaw].sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999));

    // Construire _pnjRegions :
    // 1. Régions connues (dans leur ordre), avec leurs PNJ
    const knownNames = new Set();
    _pnjRegions = regDocs.map(r => {
      const name = r.name || r.id;
      knownNames.add(name);
      return { id: r.id, name, pnjs: byRegion[name] || [] };
    });

    // 2. Régions inconnues (présentes dans les PNJ mais pas dans la collection regions)
    //    triées alphabétiquement, ajoutées à la fin
    const unknownNames = Object.keys(byRegion)
      .filter(k => k !== '' && !knownNames.has(k))
      .sort((a, b) => a.localeCompare(b, 'fr'));
    unknownNames.forEach(name => {
      _pnjRegions.push({ id: '__unknown__' + name, name, pnjs: byRegion[name] });
    });

    // 3. PNJ sans région
    if (byRegion['']?.length) {
      _pnjRegions.push({ id: '__none__', name: '', pnjs: byRegion[''] });
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

  header.querySelector('[data-toggle]').addEventListener('click', e => {
    e.stopPropagation();
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
      <span class="mob-order-name">${pnj.name||pnj.id}</span>
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

    row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('personnages', pnj.id, pnj, 'pnj'); });
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
    const results = allPnjs.filter(p => normalize(p.name).includes(searchQ));
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
      listEl.appendChild(row);
    });
    return;
  }

  // ── Mode normal : palier → régions ──
  const allPnjs = _pnjRegions.flatMap(g => g.pnjs);
  if (!allPnjs.length) { listEl.innerHTML = '<div class="empty">Aucun PNJ</div>'; return; }

  const paliers = [...new Set(allPnjs.map(p => p.palier||1))].sort((a,b) => a-b);

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
    ph.querySelector('[data-toggle]').addEventListener('click', () => {
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

window.showRegionOrder = async () => {
  _setHash('region-order');
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('region-order-panel').style.display  = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

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
    const visible = _regionOrderData.filter(r => normalize(r.name||r.id||'').includes(searchQ));
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
      listEl.appendChild(row);
    });
    return;
  }

  const paliers = [...new Set(_regionOrderData.map(r => r.palier || 1))].sort((a,b) => a-b);
  if (!paliers.length) { listEl.innerHTML = '<div class="empty">Aucune région</div>'; return; }

  const isSameGroup = (a, b) => (a.palier||1) === (b.palier||1) && (a.inCodex === false) === (b.inCodex === false);

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
    ph.querySelector('[data-toggle]').addEventListener('click', () => {
      if (_regionPalierCollapsed.has(palier)) _regionPalierCollapsed.delete(palier);
      else _regionPalierCollapsed.add(palier);
      renderRegionOrder();
    });
    section.appendChild(ph);

    const body = document.createElement('div');
    body.className = 'palier-section-body';
    body.style.display = collapsed ? 'none' : '';

    const subGroups = [
      { label: 'Codex',      filter: r => r.inCodex !== false },
      { label: 'Hors Codex', filter: r => r.inCodex === false },
    ];

    subGroups.forEach(({ label, filter }) => {
      const groupRegions = palierRegions.filter(filter);
      if (!groupRegions.length) return;

      const sh = document.createElement('div');
      sh.style.cssText = 'padding:4px 10px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-top:4px;';
      sh.textContent = label;
      body.appendChild(sh);

      groupRegions.forEach(r => {
        const groupIdx = groupRegions.indexOf(r);
        const row = document.createElement('div');
        row.className  = 'mob-order-row';
        row.draggable  = true;
        row.dataset.id = r.id;
        row.innerHTML  = `
          <span class="mob-order-handle">⠿</span>
          <input type="number" class="mob-order-index" value="${groupIdx+1}" min="1" max="${groupRegions.length}" title="Position dans ce groupe">
          <span class="mob-order-name">${r.name||r.id}</span>
          <span class="mob-order-tag">P${r.palier||1}</span>
          <button class="ed-edit-btn" title="Modifier : ${r.name||r.id}\nID : ${r.id}" draggable="false">✏️</button>`;

        const indexInput = row.querySelector('.mob-order-index');
        indexInput.addEventListener('click', e => e.stopPropagation());
        indexInput.addEventListener('keydown', e => { if (e.key==='Enter') { e.preventDefault(); indexInput.blur(); } });
        indexInput.addEventListener('change', () => {
          let toGroupIdx = parseInt(indexInput.value, 10) - 1;
          toGroupIdx = Math.max(0, Math.min(groupRegions.length - 1, toGroupIdx));
          if (toGroupIdx === groupIdx) { indexInput.value = groupIdx + 1; return; }
          const fromGlobal = _regionOrderData.indexOf(r);
          const [removed]  = _regionOrderData.splice(fromGlobal, 1);
          const nowGroup   = _regionOrderData.filter(filter).filter(x => (x.palier||1) === palier);
          const insertAt   = toGroupIdx < nowGroup.length
            ? _regionOrderData.indexOf(nowGroup[toGroupIdx])
            : (_regionOrderData.indexOf(nowGroup[nowGroup.length-1]) + 1 || _regionOrderData.length);
          _regionOrderData.splice(insertAt, 0, removed);
          _regionOrderDirty = true;
          document.getElementById('btn-save-region-order').disabled = false;
          renderRegionOrder();
        });

        row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor('regions', r.id, r, 'region'); });
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
          const toIdx   = _regionOrderData.findIndex(x => x.id === row.dataset.id);
          if (fromIdx === -1 || toIdx === -1) return;
          const [moved] = _regionOrderData.splice(fromIdx, 1);
          _regionOrderData.splice(toIdx, 0, moved);
          _regionOrderDirty = true;
          document.getElementById('btn-save-region-order').disabled = false;
          renderRegionOrder();
        });

        body.appendChild(row);
      });
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
  ['users-panel','submissions-list','mob-order-panel','item-order-panel',
   'pnj-order-panel','region-order-panel','quest-order-panel',
   'discord-webhooks-panel','permissions-panel','ghost-id-panel',
   'region-orphan-panel','mob-orphan-panel','quest-orphan-panel','editor-panel'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  ['btn-mob-order','btn-item-order','btn-pnj-order','btn-region-order',
   'btn-quest-order','btn-ghost-ids','btn-region-orphans','btn-mob-orphans',
   'btn-quest-orphans','btn-discord-webhooks','btn-permissions'
  ].forEach(id => document.getElementById(id)?.classList.remove('active'));

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
    ? _panoplieOrderData.filter(p => normalize((p.label||'') + ' ' + (p.id||'')).includes(searchQ))
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

// Migration one-shot des SETS hardcodés vers Firestore
window.importSetsToFirestore = async () => {
  const btn = document.getElementById('btn-import-sets');
  if (!await modal.confirm('Importer les SETS hardcodés de Compendium/data.js dans Firestore ?\n\nLes panoplies déjà existantes avec le même ID seront écrasées.')) return;
  btn.disabled = true; btn.textContent = '⏳ Import…';
  try {
    // Charge data.js comme script classique (définit window.SETS — data.js utilise `let SETS` global)
    if (typeof window.SETS === 'undefined') {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'Compendium/data.js?v=' + Date.now();
        s.onload = resolve;
        s.onerror = () => reject(new Error('Impossible de charger Compendium/data.js'));
        document.head.appendChild(s);
      });
    }
    const SETS = window.SETS;
    if (!SETS || typeof SETS !== 'object') throw new Error('SETS introuvable dans data.js');
    const entries = Object.entries(SETS);
    if (!entries.length) throw new Error('Aucun set trouvé');

    let ok = 0, err = 0, idx = 0;
    for (const [id, set] of entries) {
      try {
        // Les bonuses en data.js utilisent des clés numériques (2, 3, ...) — Firestore les stocke en string
        const bonuses = {};
        if (set.bonuses && typeof set.bonuses === 'object') {
          for (const [k, v] of Object.entries(set.bonuses)) bonuses[String(k)] = v;
        }
        const payload = {
          id,
          label: set.label || id,
          color: set.color || '#888',
          bonuses,
          ordre: ++idx,
        };
        await setDoc(doc(db, 'panoplies', id), payload);
        ok++;
      } catch(e) { console.error('[import SETS]', id, e); err++; }
    }
    localStorage.removeItem('vcl_cache_v2_panoplies');
    localStorage.removeItem('vcl_cache_meta_v2_panoplies');
    invalidateModCache('panoplies');
    toast(`✓ Import terminé : ${ok} panoplies${err ? ` (${err} erreurs)` : ''}.`, 'success');
    await loadPanoplieOrder();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '📥 Importer SETS';
  }
};

// ── Ghost ID tracker ─────────────────────────────────
window.showGhostIds = async () => {
  _setHash('ghost-ids');
  document.getElementById('users-panel').style.display        = 'none';
  document.getElementById('submissions-list').style.display   = 'none';
  document.getElementById('mob-order-panel').style.display    = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('item-order-panel').style.display   = 'none';
  document.getElementById('pnj-order-panel').style.display    = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('ghost-id-panel').style.display      = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

  document.getElementById('btn-ghost-ids').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadGhostIds();
};

// ══════════════════════════════════════════════════════
// RÉGIONS ORPHELINES
// ══════════════════════════════════════════════════════
window.showRegionOrphans = async () => {
  _setHash('region-orphans');
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('region-orphan-panel').style.display = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

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
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('mob-orphan-panel').style.display    = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');

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
      // Un ID est un mob fantôme si toutes ses références viennent de mob-obtain
      const isMob = entries.every(e => e.type === 'mob-obtain');
      const tr = document.createElement('tr');
      const refsHtml = entries.map(e =>
        `<span class="ghost-type-${e.type}">${escHtml(e.label)}</span>`
      ).join('<br>');
      const typeCell = isMob
        ? `<span style="font-size:10px;font-weight:700;color:var(--warn);background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:2px 7px;">Mob</span>`
        : `<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(122,90,248,.1);border:1px solid rgba(122,90,248,.3);border-radius:8px;padding:2px 7px;">Item</span>`;
      const actionCell = isMob
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

const _COL_LABELS = { items:'Item', mobs:'Mob', personnages:'PNJ', regions:'Région', panoplies:'Panoplie', quetes:'Quête', items_sensible:'Item Sensible' };

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
  'id','name','titre','type','palier','zone','npc','mapId','rarity','category','cat','lvl','set','behavior','difficulty',
  'region','regionId','tag','inCodex','color','sensible','twoHanded','rune_slots',
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
  if (str.length > 100 || str.includes('\n')) {
    return `<textarea class="ed-textarea" data-gf-type="string">${_ee(str)}</textarea>`;
  }
  return `<input class="ed-input" data-gf-type="string" value="${_ee(str)}"${listAttr} autocomplete="off">`;
}

function _buildGenericForm(data, col) {
  // Normaliser img / image → images (tableau)
  if ('img' in data || 'image' in data) {
    const existing = data.images && data.images.length ? data.images : null;
    if (!existing) {
      const src = data.img || data.image;
      data = { ...data, images: src ? [src] : [] };
    }
    const { img, image, ...rest } = data;
    data = rest;
  }

  // Auto-injecter le champ color pour les régions qui n'en ont pas encore
  if (col === 'regions' && !('color' in data)) {
    data = { ...data, color: _makeColorObj('#9a9ab0') };
  }
  // Auto-injecter le champ color pour les panoplies qui n'en ont pas encore
  if (col === 'panoplies' && !('color' in data)) {
    data = { ...data, color: '#b87333' };
  }
  // Auto-injecter mapId pour les quêtes qui n'en ont pas encore
  if (col === 'quetes' && !('mapId' in data)) {
    data = { ...data, mapId: '' };
  }
  // Auto-injecter obtain pour les items qui n'en ont pas encore
  if (col === 'items' && !('obtain' in data)) {
    data = { ...data, obtain: '' };
  }
  // Normaliser coords pour les PNJ → toujours un objet {x,y,z} avec null si absent
  if (col === 'personnages') {
    const c = data.coords;
    if (c == null || typeof c === 'string') {
      data = { ...data, coords: { x: null, y: null, z: null } };
    }
  }
  // Auto-injecter stats pour les catégories qui en ont (arme, armure, accessoire, rune)
  if (col === 'items' && !('stats' in data) && ['arme','armure','accessoire','rune'].includes(data.category)) {
    data = { ...data, stats: {} };
  }

  _editorOrigData = { ...data };

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

  const rowsHtml = entries.map(([key, val]) => {
    const t = _typeOf(val);
    const isFixed = key === '_order' || key === 'id';
    return `<div class="ed-gen-row" data-gf-orig-key="${_ee(key)}">
      <div class="ed-gen-keycell">
        ${isFixed
          ? `<span class="ed-gen-keylbl" style="cursor:default;color:var(--muted);">${_ee(key)}</span>`
          : `<span class="ed-gen-keylbl" title="Clic pour renommer" onclick="edRenameField(this)">${_ee(key)}</span>`}
      </div>
      <span class="ed-gen-type" style="color:${_typeColor(t)};">${_typeLabel(t)}</span>
      <div class="ed-gen-val">${_genValueHtml(key, val, col)}</div>
      ${isFixed ? '<span></span>' : `<button type="button" class="ed-gen-delbtn" onclick="edDelGenRow(this)" title="Supprimer ce champ">✕</button>`}
    </div>`;
  }).join('');

  return `<div id="ed-gen-fields" style="display:flex;flex-direction:column;gap:4px;">
    ${rowsHtml}
  </div>
  <datalist id="ed-dl-sets"></datalist>
  <button type="button" onclick="edAddGenField()" class="btn btn-ghost" style="font-size:12px;padding:6px 14px;margin-top:10px;">＋ Ajouter un champ</button>`;
}

function _collectGenericForm() {
  const result = {};
  document.querySelectorAll('#ed-gen-fields .ed-gen-row').forEach(row => {
    const keyInput = row.querySelector('.ed-gen-key-input');
    const keyLbl   = row.querySelector('.ed-gen-keylbl');
    const newKeyEl = row.querySelector('.ed-gen-new-key');
    const key = (keyInput ? keyInput.value.trim() : (keyLbl ? keyLbl.textContent.trim() : ''));
    const effectiveKey = newKeyEl ? newKeyEl.value.trim() : key;
    if (!effectiveKey) return;

    const el = row.querySelector('[data-gf-type]');
    if (!el) return; // readonly field (id for items/pnj/regions, _order)

    const t = el.dataset.gfType;
    if (t === 'bool')   { result[effectiveKey] = el.checked; return; }
    if (t === 'number') { const v = el.value.trim(); if (v !== '') result[effectiveKey] = +v; return; }
    if (t === 'coords-x') {
      const xEl = row.querySelector('[data-gf-type="coords-x"]');
      const yEl = row.querySelector('[data-gf-type="coords-y"]');
      const zEl = row.querySelector('[data-gf-type="coords-z"]');
      const x = xEl?.value.trim(), y = yEl?.value.trim(), z = zEl?.value.trim();
      result[effectiveKey] = { x: x !== '' ? +x : null, y: y !== '' ? +y : null, z: z !== '' ? +z : null };
      return;
    }
    if (t === 'json')   {
      const v = el.value.trim();
      if (!v) { result[effectiveKey] = null; return; }
      const parsed = JSON.parse(v); // throws if invalid → caught by saveEditor
      result[effectiveKey] = parsed; return;
    }
    result[effectiveKey] = el.value;
  });
  // Preserve readonly fields from origData
  if (_editorOrigData) {
    if ('id' in _editorOrigData && !('id' in result)) result.id = _editorOrigData.id;
    if ('_order' in _editorOrigData) result._order = _editorOrigData._order;
  }
  return result;
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

window.edAddGenField = function() {
  const container = document.getElementById('ed-gen-fields');
  const row = document.createElement('div');
  row.className = 'ed-gen-row ed-gen-newrow';
  row.innerHTML = `
    <input class="ed-gen-new-key ed-input" placeholder="nom_du_champ" style="font-family:monospace;font-size:12px;">
    <select class="ed-gen-new-type ed-input" style="font-size:11px;padding:5px 4px;">
      <option value="string">str</option>
      <option value="number">int</option>
      <option value="bool">bool</option>
      <option value="json">array/map</option>
    </select>
    <div class="ed-gen-val">
      <input class="ed-input" data-gf-type="string" placeholder="valeur…">
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
      valDiv.querySelector('input').addEventListener('change', function () {
        this.closest('label').querySelector('.ed-gen-bool-txt').textContent = this.checked ? 'true' : 'false';
      });
    } else if (t === 'json') {
      valDiv.innerHTML = `<textarea class="ed-json-ta" data-gf-type="json" spellcheck="false" placeholder="[] ou {}" style="min-height:50px;"></textarea>`;
    } else if (t === 'number') {
      valDiv.innerHTML = `<input class="ed-input" type="number" data-gf-type="number" placeholder="0">`;
    } else {
      valDiv.innerHTML = `<input class="ed-input" data-gf-type="string" placeholder="valeur…">`;
    }
  });

  container.appendChild(row);
  row.querySelector('.ed-gen-new-key').focus();
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

  // Fetch data from Firestore when not provided (e.g. called from data-incomplete panel)
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

  // Charger les régions si besoin (pour la datalist)
  if (collection === 'mobs' || collection === 'personnages' || collection === 'regions') {
    await _loadRegionsForEditor();
  }

  // Construire le formulaire générique (items_sensible traité comme items)
  const formCollection = collection === 'items_sensible' ? 'items' : collection;
  document.getElementById('editor-form').innerHTML = _buildGenericForm(data, formCollection);

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

  // Auto-resize des JSON textareas
  document.querySelectorAll('#editor-form .ed-json-ta').forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; });
  });

  // Sync labels des booleans
  document.querySelectorAll('#editor-form [data-gf-type="bool"]').forEach(cb => {
    cb.addEventListener('change', function () {
      const lbl = this.closest('label')?.querySelector('.ed-gen-bool-txt');
      if (lbl) lbl.textContent = this.checked ? 'true' : 'false';
    });
  });
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
  if (_editorOrigin === 'data-incomplete') { showCompletion(); return; }
  if (_editorOrigin === 'completion')      { showCompletion(); return; }
  showSubmissions();
};

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
      const hash = await hashName(newData.name);
      if (!hash) throw new Error('Nom manquant pour recalculer le hash');
      // Si le nom a changé, supprimer l'ancien doc items_hidden
      if (hash !== _editorId) {
        try { await deleteDoc(doc(db, COL.itemsHidden, _editorId)); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore(gameplay));
      const itemId = String(newData.id || '');
      if (itemId) {
        if (Object.keys(secret).length) {
          await setDoc(doc(db, COL.itemsSecret, itemId), sanitizeForFirestore(secret));
        } else {
          try { await deleteDoc(doc(db, COL.itemsSecret, itemId)); } catch {}
        }
      }
      // Mettre à jour _sensState en mémoire
      const merged = { ...gameplay, ...secret };
      const idx = _sensState.itemsHidden.findIndex(x => x._id === _editorId);
      if (idx >= 0) _sensState.itemsHidden[idx] = { _id: hash, ...merged };
      else _sensState.itemsHidden.push({ _id: hash, ...merged });
      _editorId = hash;
      _editorOrigData = { ...newData };
      btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
      setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }, 2500);
      return;
    }

    // Renommage d'ID → recréer le document (toutes collections)
    const rawNewId = (newData.id != null ? String(newData.id).trim() : '');
    const newDocId = rawNewId || _editorId;
    if (newDocId !== _editorId) {
      // Vérifier qu'aucun document n'existe déjà avec cet ID
      const clashSnap = await getDoc(doc(db, _editorCollection, newDocId));
      if (clashSnap.exists()) {
        throw new Error(`Un document avec l'ID "${newDocId}" existe déjà dans ${_editorCollection}.`);
      }
      const currentSnap = await getDoc(doc(db, _editorCollection, _editorId));
      const existing = currentSnap.exists() ? currentSnap.data() : {};
      await setDoc(doc(db, _editorCollection, newDocId), { ...existing, ...newData, id: newDocId });
      await deleteDoc(doc(db, _editorCollection, _editorId));
      _editorCacheRename(_editorCollection, _editorId, newDocId, newData);
      _editorId = newDocId;
    } else {
      // Patch : nouvelles valeurs + deleteField() pour les champs supprimés
      const patch = {};
      Object.entries(newData).forEach(([k, v]) => { patch[k] = v; });
      Object.keys(_editorOrigData).forEach(k => {
        if (!(k in newData) && k !== '_order') patch[k] = deleteField();
      });
      await updateDoc(doc(db, _editorCollection, _editorId), patch);
    }

    // Invalider les caches localStorage et session
    localStorage.removeItem(`vcl_cache_v2_${_editorCollection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_editorCollection}`);
    invalidateModCache(_editorCollection);
    if (_editorCollection === 'regions') _cachedRegions = null;
    if (_editorCollection === 'items')   _cachedSets    = null;

    // Mettre à jour le cache mémoire
    _editorCacheUpdate(_editorCollection, _editorId, newData);
    _editorOrigData = { ...newData };

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
  if (!await modal.confirm(`Supprimer définitivement ce ${typeName} "${_editorId}" ?\n\nCette action est irréversible.`)) return;
  const btn = document.getElementById('btn-delete-editor');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    if (_editorCollection === 'items_sensible') {
      // Supprimer items_hidden (par hash) + items_secret (par id)
      await deleteDoc(doc(db, COL.itemsHidden, _editorId));
      const itemId = String(_editorOrigData?.id || '');
      if (itemId) try { await deleteDoc(doc(db, COL.itemsSecret, itemId)); } catch {}
      _sensState.itemsHidden = _sensState.itemsHidden.filter(x => x._id !== _editorId);
      editorGoBack();
      return;
    }
    await deleteDoc(doc(db, _editorCollection, _editorId));
    // Invalider les caches localStorage
    localStorage.removeItem(`vcl_cache_v2_${_editorCollection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_editorCollection}`);
    // Retirer de la liste locale (évite d'avoir à recharger le panneau)
    if      (_editorCollection === 'mobs')        { _mobOrderData    = _mobOrderData.filter(m => m.id !== _editorId); }
    else if (_editorCollection === 'items')        { _itemOrderData   = _itemOrderData.filter(i => i.id !== _editorId); }
    else if (_editorCollection === 'personnages')  { _pnjRegions.forEach(r => { r.pnjs = r.pnjs.filter(p => p.id !== _editorId); }); }
    else if (_editorCollection === 'regions')      { _regionOrderData = _regionOrderData.filter(r => r.id !== _editorId); }
    else if (_editorCollection === 'quetes')       { _questOrderData  = _questOrderData.filter(q => q.id !== _editorId); }
    editorGoBack();
  } catch(e) {
    btn.disabled = false; btn.textContent = '🗑️ Supprimer';
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ⚠️ Ajouter ici les nouveaux paliers quand ils sont créés dans le creator
const CREATOR_PALIERS = [1, 2, 3];
let _ccConfig = null;

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
  _renderPermissions();
  await _saveCreatorConfig();
};

window.toggleCreatorPalier = async function(p) {
  if (!_ccConfig) return;
  const hidden = new Set(_ccConfig.hiddenPaliers || []);
  if (hidden.has(p)) hidden.delete(p); else hidden.add(p);
  _ccConfig.hiddenPaliers = [...hidden];
  _renderPermissions();
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

const TAG_RULE_FIELDS = [
  { id:'rarity',    label:'Rareté',      type:'enum',    values:['commun','rare','epique','legendaire','mythique','godlike','event'] },
  { id:'category',  label:'Catégorie',   type:'enum',    values:['arme','armure','accessoire'] },
  { id:'classes',   label:'Classes',     type:'array',   values:['guerrier','assassin','archer','mage','shaman'] },
  { id:'palier',    label:'Palier',      type:'number' },
  { id:'sensible',  label:'Sensible',    type:'boolean' },
  { id:'twoHanded', label:'Deux mains',  type:'boolean' },
  { id:'rune_slots',label:'Empl. runes', type:'number'  },
];

let _dwPublishItems = [];
let _dwActivetab = 'webhooks';

window.showDiscordWebhooks = async () => {
  _setHash('webhooks');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

  document.getElementById('discord-webhooks-panel').style.display = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

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
      input.placeholder = 'https://discord.com/api/webhooks/…';
      input.value       = _dwConfig[key] || '';
      input.style.cssText = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:11px;outline:none;font-family:monospace;transition:border-color .15s;';
      input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
      input.addEventListener('blur',  () => { input.style.borderColor = 'var(--border)'; });

      const label = document.createElement('span');
      label.textContent = `Palier ${p}`;
      label.style.cssText = 'font-size:12px;width:58px;flex-shrink:0;color:var(--text);';

      const testBtn = document.createElement('button');
      testBtn.className = 'btn btn-ghost';
      testBtn.style.cssText = 'font-size:11px;padding:5px 10px;flex-shrink:0;';
      testBtn.textContent = '🧪 Test';
      testBtn.addEventListener('click', () => testDiscordWebhook(key));

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(testBtn);
      section.appendChild(row);
    }
    list.appendChild(section);
  }
}

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
  const tabs = ['webhooks', 'embed', 'tags', 'publish'];
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
  if (name === 'tags')    _renderTagRules();
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

function _renderTagRules() {
  const container = document.getElementById('dw-tag-rules-list');
  if (!container) return;
  container.innerHTML = '';

  if (!_dwConfig.tagRules || Array.isArray(_dwConfig.tagRules)) _dwConfig.tagRules = {};

  const SEL  = 'background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
  const MONO = 'background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;font-family:monospace;outline:none;width:155px;';

  for (const key of _dwAllChannelKeys()) {
    const hasWebhook = !!(_dwConfig[key]);
    const rules      = _dwConfig.tagRules[key] || [];
    const label      = _dwChannelLabel(key);

    const section = document.createElement('div');
    section.style.cssText = 'border:1px solid var(--border);border-radius:10px;overflow:hidden;';

    // Header
    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface2);';
    hdr.innerHTML = `
      <span style="font-size:13px;font-weight:700;">${_ee(label)}</span>
      <div style="display:flex;align-items:center;gap:8px;">
        ${hasWebhook
          ? '<span style="font-size:10px;color:#4ade80;background:rgba(74,222,128,.1);padding:2px 8px;border-radius:10px;border:1px solid rgba(74,222,128,.3);">✓ Webhook actif</span>'
          : '<span style="font-size:10px;color:var(--muted);padding:2px 8px;border-radius:10px;border:1px solid var(--border);">Pas de webhook</span>'}
        <button class="btn btn-ghost" onclick="dwAddTagRule('${key}')" style="font-size:11px;padding:3px 9px;">＋ Règle</button>
      </div>`;
    section.appendChild(hdr);

    // Rules body
    const body = document.createElement('div');
    body.id    = `dw-rules-body-${key}`;
    body.style.cssText = 'padding:10px;display:flex;flex-direction:column;gap:6px;';

    if (!rules.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--muted);font-style:italic;padding:2px 0;';
      empty.textContent   = 'Aucune règle — les tags de ce forum seront ignorés.';
      body.appendChild(empty);
    } else {
      rules.forEach((r, i) => {
        const fieldDef = TAG_RULE_FIELDS.find(f => f.id === r.field);
        const ops      = _dwTagRuleOpsFor(fieldDef?.type);
        const fieldOpts = TAG_RULE_FIELDS.map(f => `<option value="${_ee(f.id)}" ${r.field===f.id?'selected':''}>${_ee(f.label)}</option>`).join('');
        const opOpts    = ops.map(([v,l]) => `<option value="${_ee(v)}" ${r.op===v?'selected':''}>${_ee(l)}</option>`).join('');
        const valWidget = _dwTagRuleValueWidget(fieldDef, r.value, `dwRuleSync('${key}',${i},'value',this.value)`);

        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;';
        row.innerHTML = `
          <select onchange="dwRuleFieldChange('${key}',${i},this.value)" style="${SEL}">${fieldOpts}</select>
          <select onchange="dwRuleSync('${key}',${i},'op',this.value)" style="${SEL}">${opOpts}</select>
          <div style="flex:1;min-width:80px;display:flex;">${valWidget}</div>
          <span style="font-size:12px;color:var(--muted);flex-shrink:0;">→</span>
          <input type="text" value="${_ee(r.tagId||'')}" placeholder="ID tag Discord…"
            onchange="dwRuleSync('${key}',${i},'tagId',this.value)"
            style="${MONO}">
          <button class="btn btn-ghost" onclick="dwRuleRemove('${key}',${i})" style="font-size:11px;padding:4px 8px;flex-shrink:0;">✕</button>`;
        body.appendChild(row);
      });
    }
    section.appendChild(body);
    container.appendChild(section);
  }
}

function _dwTagRuleOpsFor(fieldType) {
  if (fieldType === 'array')   return [['contains','contient'],['not_contains','ne contient pas']];
  if (fieldType === 'boolean') return [['eq','est']];
  if (fieldType === 'number')  return [['eq','='],['gte','≥'],['lte','≤']];
  return [['eq','=']];
}

function _dwTagRuleValueWidget(fieldDef, currentValue, onChange) {
  const S = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
  if (!fieldDef) return `<input type="text" value="${_ee(String(currentValue??''))}" placeholder="valeur" onchange="${onChange}" style="${S}">`;
  if (fieldDef.type === 'boolean') {
    return `<select onchange="${onChange}" style="width:80px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;">
      <option value="true"  ${currentValue===true||currentValue==='true'?'selected':''}>Oui</option>
      <option value="false" ${currentValue===false||currentValue==='false'?'selected':''}>Non</option>
    </select>`;
  }
  if (fieldDef.type === 'number') {
    return `<input type="number" value="${_ee(String(currentValue??''))}" placeholder="0" onchange="${onChange}" style="width:70px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;">`;
  }
  const opts = (fieldDef.values||[]).map(v => `<option value="${_ee(v)}" ${currentValue==v?'selected':''}>${_ee(v)}</option>`).join('');
  return `<select onchange="${onChange}" style="${S}">${opts}</select>`;
}

window.dwRuleSync = function(channelKey, idx, prop, value) {
  if (!_dwConfig.tagRules) _dwConfig.tagRules = {};
  const rules = _dwConfig.tagRules[channelKey];
  if (!rules || !rules[idx]) return;
  const r = rules[idx];
  if (prop === 'value' && (r.field === 'sensible' || r.field === 'twoHanded')) {
    r[prop] = (value === 'true');
  } else if (prop === 'value' && (r.field === 'palier' || r.field === 'rune_slots')) {
    r[prop] = Number(value);
  } else {
    r[prop] = value;
  }
};

window.dwRuleFieldChange = function(channelKey, idx, newField) {
  const rules = _dwConfig.tagRules?.[channelKey];
  if (!rules || !rules[idx]) return;
  const fd = TAG_RULE_FIELDS.find(f => f.id === newField);
  const ops = _dwTagRuleOpsFor(fd?.type);
  rules[idx].field = newField;
  rules[idx].op    = ops[0][0];
  rules[idx].value = fd?.type === 'boolean' ? true : (fd?.values?.[0] ?? '');
  _renderTagRules();
};

window.dwRuleRemove = function(channelKey, idx) {
  const rules = _dwConfig.tagRules?.[channelKey];
  if (!rules) return;
  rules.splice(idx, 1);
  _renderTagRules();
};

window.dwAddTagRule = function(channelKey) {
  if (!_dwConfig) return;
  if (!_dwConfig.tagRules) _dwConfig.tagRules = {};
  if (!_dwConfig.tagRules[channelKey]) _dwConfig.tagRules[channelKey] = [];
  _dwConfig.tagRules[channelKey].push({ field: 'rarity', op: 'eq', value: 'commun', tagId: '' });
  _renderTagRules();
};

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
      <div style="padding:10px 14px;background:rgba(122,90,248,.1);border-bottom:1px solid var(--accent);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:13px;font-weight:700;color:var(--accent);">🆕 Nouvelles approvals${unsent.length ? ` — ${unsent.length} non envoyée${unsent.length>1?'s':''}` : ''}</span>
        ${unsent.length ? `<div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(true)"  style="font-size:11px;padding:4px 10px;">✅ Tout cocher</button>
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(false)" style="font-size:11px;padding:4px 10px;">☐ Tout décocher</button>
          <button id="dw-unsent-send-btn" class="btn" onclick="dwPublishUnsentSend()"
            style="background:var(--accent);color:#fff;font-size:12px;">📤 Envoyer la file</button>
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

  // Grouper par set — les items sans set partent individuellement
  // Pour les anciennes soumissions, sub.data.set peut être absent (snapshot avant l'ajout du champ).
  // On tombe alors dans la collection 'items' déjà mise en cache.
  const _cachedItems = _modCache['items'] || [];
  const setGroups = new Map(); // setId → [sub]
  const soloSubs  = [];
  for (const sub of subs) {
    const liveItem = _cachedItems.find(it => it.id === sub.data?.id);
    const setId = sub.data?.set || liveItem?.set || null;
    if (setId) {
      if (!setGroups.has(setId)) setGroups.set(setId, []);
      setGroups.get(setId).push(sub);
    } else {
      soloSubs.push(sub);
    }
  }

  let done = 0, failed = 0;
  const total = soloSubs.length + setGroups.size;

  for (const sub of soloSubs) {
    try {
      await sendApprovalWebhook(sub);
      await updateDoc(doc(db, 'submissions', sub._id), { discord_sent: true });
      sub.discord_sent = true;
      done++;
    } catch(e) {
      toast(`⛔ Erreur « ${sub.data?.name || sub._id} » : ${e.message}`, 'error');
      failed++;
    }
    if (done + failed < total) await new Promise(r => setTimeout(r, 1100));
  }

  for (const setSubs of setGroups.values()) {
    try {
      await _sendSetGroupDiscord(setSubs);
      await Promise.all(setSubs.map(s => updateDoc(doc(db, 'submissions', s._id), { discord_sent: true })));
      for (const s of setSubs) s.discord_sent = true;
      done++;
    } catch(e) {
      const names = setSubs.map(s => s.data?.name || s._id).join(', ');
      toast(`⛔ Erreur set « ${names} » : ${e.message}`, 'error');
      failed++;
    }
    if (done + failed < total) await new Promise(r => setTimeout(r, 1100));
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
  let done = 0;

  for (const item of items) {
    progText.textContent = `Envoi ${done + 1} / ${items.length} — ${item.name || ''}…`;
    progBar.style.width  = `${Math.round(done / items.length * 100)}%`;
    try {
      await _sendSingleItemDiscord(item);
    } catch(e) {
      toast(`⛔ Erreur pour « ${item.name} » : ${e.message}`, 'error');
    }
    done++;
    if (done < items.length) await new Promise(r => setTimeout(r, 1100));
  }

  progBar.style.width  = '100%';
  progText.textContent = `✓ ${done} item${done>1?'s':''} envoyé${done>1?'s':''} !`;
  setTimeout(() => { prog.style.display = 'none'; btn.disabled = false; }, 3000);
};

async function _sendSingleItemDiscord(item) {
  const cat    = item.category;
  const palier = item.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = `${cat}_${palier}`;
  const url = _dwConfig?.[key];
  if (!url) throw new Error(`Aucun webhook configuré pour ${key}`);

  const [itemNames, { blob: imgBlob, fname: imgFname }, mobsPublic, mobsSecret, pnjs] = await Promise.all([
    _getItemNamesCache(),
    _fetchItemImgBlob(item),
    cachedDocs(COL.mobs),
    cachedDocs(COL.mobsSecret).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allMobs = [...mobsPublic, ...mobsSecret];
  const itemForEmbed = item.obtain ? { ...item, obtain:
    _enrichObtainWithPnjCoords(
      _enrichObtainWithMobChances(item.obtain, item.id, allMobs),
      pnjs)
  } : item;
  // Cherche le nom du soumetteur dans les submissions en mémoire
  const itemId = item._id || item.id;
  const matchSub = itemId
    ? [...allSubs].reverse().find(s => s.type === 'item' && (String(s.data?.id) === String(itemId) || String(s.data?._id) === String(itemId)))
    : null;
  const _contributor = matchSub
    ? (matchSub.submitterName || _userNames.get(matchSub.submittedBy) || null)
    : null;

  const embed = _buildApprovalEmbed(itemForEmbed, imgFname, _dwConfig?.embedFields || null, itemNames, _contributor);
  const tags  = _resolveTagRules(item, (_dwConfig?.tagRules || {})[key] || []);

  const payload = { thread_name: item.name || 'Item', embeds: [embed] };
  if (tags.length) payload.applied_tags = tags;
  if (_dwConfig?.template) {
    const RARITY_LABEL = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
    const CAT_LABEL    = { arme:'Arme', armure:'Armure', accessoire:'Accessoire' };
    const CLS_LABEL    = { guerrier:'Guerrier', assassin:'Assassin', archer:'Archer', mage:'Mage', shaman:'Shaman' };
    payload.content = _dwConfig.template
      .replace(/\{nom\}/g,       item.name        || '')
      .replace(/\{categorie\}/g, CAT_LABEL[item.category]  || item.category || '')
      .replace(/\{rarete\}/g,    RARITY_LABEL[item.rarity] || item.rarity   || '')
      .replace(/\{palier\}/g,    item.palier       || '')
      .replace(/\{niveau\}/g,    item.lvl          || '')
      .replace(/\{classes\}/g,   (item.classes || []).map(c => CLS_LABEL[c] || c).join(', '));
  }
  await window.VCL.postDiscord(`${url}?wait=false`, payload, imgBlob, imgFname);
}

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
  { title: 'Wiki — Pages publiques', perms: [
    { id: 'view_compendium', label: 'Compendium',  desc: 'Liste et détail des items' },
    { id: 'view_bestiaire',  label: 'Bestiaire',   desc: 'Mobs, PNJ et encyclopédie' },
    { id: 'view_atelier',    label: 'Atelier',     desc: 'Simulateur de builds' },
    { id: 'view_map',        label: 'Carte',       desc: 'Carte interactive du monde' },
    { id: 'view_quetes',     label: 'Quêtes',      desc: 'Encyclopédie des quêtes' },
  ]},
  { title: 'Contributions (Creator)', perms: [
    { id: 'submit_item',   label: 'Soumettre un item',    desc: 'Armes, armures, accessoires…' },
    { id: 'submit_mob',    label: 'Soumettre un mob',     desc: 'Monstres et créatures' },
    { id: 'submit_pnj',    label: 'Soumettre un PNJ',     desc: 'Personnages non-joueurs' },
    { id: 'submit_region', label: 'Soumettre une région', desc: 'Zones et territoires' },
    { id: 'submit_quest',  label: 'Soumettre une quête',  desc: 'Quêtes du jeu' },
  ]},
  { title: 'Modération — fixe (règles Firestore)', perms: [
    { id: '_mod_panel',   label: 'Panel modération',         desc: 'Soumissions, éditeur, outils',   fixed: 'contributeur' },
    { id: '_approve',     label: 'Approuver / Rejeter',      desc: 'Modérer les soumissions',        fixed: 'contributeur' },
    { id: '_edit_direct', label: 'Écriture directe en base', desc: 'Items, mobs, PNJ, régions…',    fixed: 'contributeur' },
    { id: '_admin',       label: 'Configuration admin',      desc: 'Permissions, webhooks, rôles',   fixed: 'admin' },
  ]},
];

let _permConfig = null;

window.showPermissions = async () => {
  _setHash('permissions');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('permissions-panel').style.display = '';
  document.getElementById('btn-permissions').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadPermissions();
};

window.loadPermissions = async function() {
  const loading = document.getElementById('perm-loading');
  const content = document.getElementById('perm-content');
  loading.style.display = ''; loading.textContent = 'Chargement…';
  content.style.display = 'none';
  try {
    const [permSnap, ccSnap] = await Promise.all([
      getDoc(doc(db, 'config', 'permissions')),
      getDoc(doc(db, 'config', 'creator')),
    ]);
    _permConfig = permSnap.exists() ? (permSnap.data().minRole || {}) : {};
    _ccConfig   = ccSnap.exists() ? ccSnap.data() : {};
    _renderPermissions();
    loading.style.display = 'none';
    content.style.display = '';
  } catch(e) { loading.textContent = `Erreur : ${e.message}`; }
};

function _renderPermissions() {
  const content = document.getElementById('perm-content');
  content.innerHTML = '';

  // Sections rôle-minimum
  for (const section of PERM_SECTIONS) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-bottom:24px;';
    const title = document.createElement('div');
    title.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:10px;';
    title.textContent = section.title;
    wrap.appendChild(title);
    const rows = document.createElement('div');
    rows.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
    for (const perm of section.perms) rows.appendChild(_buildPermRow(perm));
    wrap.appendChild(rows);
    content.appendChild(wrap);
  }

  // Section Creator — Outils actifs
  const ccTools = (_ccConfig || {}).tools || {};
  const CC_TOOLS = [
    { id: 'item',     label: '⚔️ Items',     desc: 'Soumission d\'items dans le Creator' },
    { id: 'mob',      label: '👾 Mobs',      desc: 'Soumission de mobs dans le Creator' },
    { id: 'pnj',      label: '🧑 PNJ',       desc: 'Soumission de PNJ dans le Creator' },
    { id: 'region',   label: '📍 Régions',   desc: 'Soumission de régions dans le Creator' },
    { id: 'quest',    label: '📜 Quêtes',    desc: 'Soumission de quêtes dans le Creator' },
    { id: 'panoplie', label: '🔗 Panoplies', desc: 'Soumission de panoplies dans le Creator' },
  ];
  const toolsWrap = document.createElement('div');
  toolsWrap.style.cssText = 'margin-bottom:24px;';
  const toolsTitle = document.createElement('div');
  toolsTitle.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:10px;';
  toolsTitle.textContent = 'Creator — Outils actifs';
  toolsWrap.appendChild(toolsTitle);
  const toolsRows = document.createElement('div');
  toolsRows.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  for (const t of CC_TOOLS) {
    const on = ccTools[t.id] !== false;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;';
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;min-width:140px;';
    info.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--text);">${t.label}</div>`
                   + `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${t.desc}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.style.cssText = on
      ? 'background:rgba(74,222,128,.15);color:#4ade80;border-color:rgba(74,222,128,.4);flex-shrink:0;'
      : 'color:var(--danger);border-color:rgba(248,113,113,.4);flex-shrink:0;';
    btn.textContent = on ? '✓ Actif' : '✕ Désactivé';
    btn.onclick = () => toggleCreatorTool(t.id);
    row.appendChild(info);
    row.appendChild(btn);
    toolsRows.appendChild(row);
  }
  toolsWrap.appendChild(toolsRows);
  content.appendChild(toolsWrap);

  // Section Creator — Paliers visibles
  const hidden = new Set((_ccConfig || {}).hiddenPaliers || []);
  const paliersWrap = document.createElement('div');
  paliersWrap.style.cssText = 'margin-bottom:24px;';
  const paliersTitle = document.createElement('div');
  paliersTitle.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:10px;';
  paliersTitle.textContent = 'Creator — Paliers visibles';
  paliersWrap.appendChild(paliersTitle);
  const paliersRows = document.createElement('div');
  paliersRows.style.cssText = 'display:flex;flex-direction:column;gap:6px;';
  for (const p of CREATOR_PALIERS) {
    const visible = !hidden.has(p);
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;';
    const info = document.createElement('div');
    info.style.cssText = 'flex:1;';
    info.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--text);">Palier ${p}</div>`;
    const btn = document.createElement('button');
    btn.className = 'btn btn-sm btn-ghost';
    btn.style.cssText = visible
      ? 'background:rgba(74,222,128,.15);color:#4ade80;border-color:rgba(74,222,128,.4);flex-shrink:0;'
      : 'color:var(--danger);border-color:rgba(248,113,113,.4);flex-shrink:0;';
    btn.textContent = visible ? '✓ Visible' : '✕ Masqué';
    btn.onclick = () => toggleCreatorPalier(p);
    row.appendChild(info);
    row.appendChild(btn);
    paliersRows.appendChild(row);
  }
  paliersWrap.appendChild(paliersRows);
  content.appendChild(paliersWrap);
}

function _buildPermRow(perm) {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;flex-wrap:wrap;';

  const info = document.createElement('div');
  info.style.cssText = 'flex:1;min-width:140px;';
  info.innerHTML = `<div style="font-size:13px;font-weight:600;color:var(--text);">${perm.label}</div>`
                 + `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${perm.desc}</div>`;
  row.appendChild(info);

  if (perm.fixed) {
    const badge = document.createElement('span');
    const col = PERM_ROLE_COLORS[perm.fixed] || '#888';
    badge.style.cssText = `padding:4px 12px;font-size:11px;font-weight:700;background:${col};color:#000;border-radius:6px;`;
    badge.textContent = PERM_ROLE_LABELS[perm.fixed] + '+';
    const lock = document.createElement('span');
    lock.style.cssText = 'font-size:12px;color:var(--muted);';
    lock.textContent = '🔒';
    lock.title = 'Géré par les règles Firestore — non modifiable ici';
    row.appendChild(badge);
    row.appendChild(lock);
    return row;
  }

  const current = _permConfig[perm.id] ?? 'visiteur';
  const seg = document.createElement('div');
  seg.style.cssText = 'display:flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;flex-shrink:0;';

  for (const role of PERM_ROLES_ALL) {
    const btn = document.createElement('button');
    const active = role === current;
    const col = PERM_ROLE_COLORS[role];
    btn.style.cssText = `padding:5px 10px;font-size:11px;font-weight:600;border:none;cursor:pointer;white-space:nowrap;`
                      + `background:${active ? col : 'var(--surface3)'};color:${active ? '#000' : 'var(--muted)'};`
                      + `transition:background .12s,color .12s;`;
    btn.textContent = PERM_ROLE_LABELS[role];
    btn.title = `Rôle minimum : ${role}`;
    btn.onclick = () => _setPermission(perm.id, role);
    seg.appendChild(btn);
  }
  row.appendChild(seg);
  return row;
}

window._setPermission = async function(permId, role) {
  if (!_permConfig) return;
  _permConfig[permId] = role;
  _renderPermissions();
  try {
    await setDoc(doc(db, 'config', 'permissions'), { minRole: _permConfig });
  } catch(e) {
    toast(`⛔ Erreur sauvegarde permissions : ${e.message}`, "error");
  }
};

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
  if (sub.type !== 'item') return;
  const cat = sub.data?.category;
  if (!['arme', 'armure', 'accessoire'].includes(cat)) return;
  const palier = sub.data?.palier;
  if (!palier) return;
  const key = sub.data.rarity === 'event' ? `${cat}_event` : `${cat}_${palier}`;

  if (!_dwConfig) {
    try {
      const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
      _dwConfig = snap.exists() ? snap.data() : {};
    } catch { return; }
  }

  const url = _dwConfig[key];
  if (!url) return;

  const { blob: imgBlob, fname: imgFname } = await _extractSubBlob(sub);

  const [itemNames, mobsPublic, mobsSecret, pnjs] = await Promise.all([
    _getItemNamesCache(),
    cachedDocs(COL.mobs),
    cachedDocs(COL.mobsSecret).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allMobs = [...mobsPublic, ...mobsSecret];
  const subDataForEmbed = sub.data.obtain ? { ...sub.data, obtain:
    _enrichObtainWithPnjCoords(
      _enrichObtainWithMobChances(sub.data.obtain, sub.data.id, allMobs),
      pnjs)
  } : sub.data;
  const contributorName = sub.submitterName || (_userNames.get(sub.submittedBy) || null);
  const embed   = _buildApprovalEmbed(subDataForEmbed, imgFname, _dwConfig.embedFields || null, itemNames, contributorName);

  // Thread name: use set label if item belongs to a set, else item name
  let threadName = sub.data.name;
  if (sub.data.set && _dwConfig._setCache?.[sub.data.set]) {
    threadName = _dwConfig._setCache[sub.data.set];
  } else if (sub.data.set) {
    try {
      const setSnap = await getDoc(doc(db, 'panoplies', sub.data.set));
      if (setSnap.exists()) {
        const setLabel = setSnap.data().label || sub.data.set;
        if (!_dwConfig._setCache) _dwConfig._setCache = {};
        _dwConfig._setCache[sub.data.set] = setLabel;
        threadName = setLabel;
      }
    } catch { /* ignore */ }
  }

  const payload = { thread_name: threadName, embeds: [embed] };

  // Apply Discord forum tags via rules engine (channel-specific)
  const appliedTags = _resolveTagRules(sub.data, (_dwConfig.tagRules || {})[key] || []);
  if (appliedTags.length) payload.applied_tags = appliedTags;

  if (_dwConfig.template) {
    const RARITY_LABEL = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
    const CAT_LABEL    = { arme:'Arme', armure:'Armure', accessoire:'Accessoire' };
    const CLS_LABEL    = { guerrier:'Guerrier', assassin:'Assassin', archer:'Archer', mage:'Mage', shaman:'Shaman' };
    payload.content = _dwConfig.template
      .replace(/\{nom\}/g,       sub.data.name        || '')
      .replace(/\{categorie\}/g, CAT_LABEL[sub.data.category]  || sub.data.category || '')
      .replace(/\{rarete\}/g,    RARITY_LABEL[sub.data.rarity] || sub.data.rarity   || '')
      .replace(/\{palier\}/g,    sub.data.palier       || '')
      .replace(/\{niveau\}/g,    sub.data.lvl          || '')
      .replace(/\{classes\}/g,   (sub.data.classes || []).map(c => CLS_LABEL[c] || c).join(', '));
  }

  await window.VCL.postDiscord(`${url}?wait=false`, payload, imgBlob, imgFname);
}

// ── Envoi groupé d'un set (plusieurs embeds dans un seul post) ──
async function _sendSetGroupDiscord(subs) {
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

  const [itemNames, mobsPublic, mobsSecret, pnjs] = await Promise.all([
    _getItemNamesCache(),
    cachedDocs(COL.mobs),
    cachedDocs(COL.mobsSecret).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allMobs = [...mobsPublic, ...mobsSecret];

  const embeds = [];
  const files  = []; // { blob, fname }

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const { blob, fname } = await _extractSubBlob(sub);
    const indexedFname = (blob && fname)
      ? `image_${i}.${fname.split('.').pop() || 'png'}`
      : null;
    if (blob && indexedFname) files.push({ blob, fname: indexedFname });

    const subDataForEmbed = sub.data.obtain ? { ...sub.data, obtain:
      _enrichObtainWithPnjCoords(
        _enrichObtainWithMobChances(sub.data.obtain, sub.data.id, allMobs),
        pnjs)
    } : sub.data;

    const contributorName = sub.submitterName || (_userNames.get(sub.submittedBy) || null);
    embeds.push(_buildApprovalEmbed(subDataForEmbed, indexedFname, _dwConfig.embedFields || null, itemNames, contributorName));
  }

  // Discord : max 10 embeds par message
  const payload = { thread_name: threadName, embeds: embeds.slice(0, 10) };
  const appliedTags = _resolveTagRules(first.data, (_dwConfig.tagRules || {})[key] || []);
  if (appliedTags.length) payload.applied_tags = appliedTags;

  if (files.length) {
    const p  = { ...payload, attachments: files.map((f, i) => ({ id: i, filename: f.fname })) };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    files.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
    await fetch(`${url}?wait=false`, { method: 'POST', body: fd });
  } else {
    await fetch(`${url}?wait=false`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
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
  const { id, category, palier } = obj;
  switch (category) {
    case 'arme':       return `${base}img/compendium/textures/weapons/${id}.png`;
    case 'armure':     return `${base}img/compendium/textures/armors/${id}.png`;
    case 'accessoire': return `${base}img/compendium/textures/trinkets/${palier ? 'P'+palier+'/' : ''}${id}.png`;
    default:           return null;
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
  crit_comp_degats:    '💢 Crit. Comp. Dég.',
  // Défensif
  defense:             '🛡️ Défense',
  maitrise_bloc:       '🧱 Maî. de Blocage',
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
  omnivamp:            '👄 Omnivamp',
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
    const raw   = obj.obtain || '';
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
    const wikiUrl = `${_WIKI_ROOT}Compendium/compendium.html#item/${encodeURIComponent(itemId)}`;
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
let _questPalierCollapsed = new Set();

const QUEST_TYPE_ORDER  = ['main', 'sec', 'ter'];
const QUEST_TYPE_LABELS_MOD = { main: '⚔️ Principale', sec: '🗺️ Secondaire', ter: '📋 Tertiaire' };
const QUEST_TYPE_COLORS_MOD = { main: '#e07c50',        sec: '#6aaad4',        ter: '#82c470'     };

window.showQuestOrder = async () => {
  _setHash('quest-order');
  document.getElementById('users-panel').style.display         = 'none';
  document.getElementById('submissions-list').style.display    = 'none';
  document.getElementById('mob-order-panel').style.display     = 'none';
  document.getElementById('item-order-panel').style.display    = 'none';
  document.getElementById('discord-webhooks-panel').style.display = 'none';
  document.getElementById('permissions-panel').style.display      = 'none';
  document.getElementById('btn-discord-webhooks').classList.remove('active');
  document.getElementById('pnj-order-panel').style.display     = 'none';
  document.getElementById('ghost-id-panel').style.display      = 'none';
  document.getElementById('region-order-panel').style.display  = 'none';
  document.getElementById('panoplie-order-panel').style.display = 'none';
  document.getElementById('quest-order-panel').style.display   = 'none';
  document.getElementById('region-orphan-panel').style.display = 'none';
  document.getElementById('mob-orphan-panel').style.display    = 'none';
  document.getElementById('quest-orphan-panel').style.display  = 'none';
  document.getElementById('editor-panel').style.display        = 'none';

  document.getElementById('quest-order-panel').style.display   = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

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
      normalize(qt.titre||qt.id||'').includes(q) ||
      normalize(qt.zone||'').includes(q) ||
      normalize(qt.npc||'').includes(q)
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

        const ph = document.createElement('div');
        ph.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;padding:4px 10px 2px;';
        ph.textContent = `Palier ${palier}`;
        section.appendChild(ph);

        palierGroup.forEach(qt => {
          const palierIdx = palierGroup.indexOf(qt) + 1;
          const row = _buildQuestRow(qt, 'quest', palierIdx, palierGroup.length);
          section.appendChild(row);
        });
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
  // Cacher tous les panneaux
  ['submissions-list','mob-order-panel','item-order-panel','pnj-order-panel',
   'ghost-id-panel','region-order-panel','quest-order-panel','panoplie-order-panel',
   'region-orphan-panel','mob-orphan-panel','quest-orphan-panel',
   'editor-panel','discord-webhooks-panel','permissions-panel'
  ].forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
  ['btn-mob-order','btn-item-order','btn-pnj-order','btn-ghost-ids',
   'btn-region-order','btn-quest-order','btn-panoplie-order','btn-region-orphans','btn-mob-orphans',
   'btn-quest-orphans','btn-discord-webhooks','btn-permissions'
  ].forEach(id => { document.getElementById(id)?.classList.remove('active'); });

  document.getElementById('quest-orphan-panel').style.display = '';
  document.getElementById('btn-quest-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadQuestOrphans();
};

window.loadQuestOrphans = async function loadQuestOrphans() {
  const listEl = document.getElementById('quest-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const quetes = await cachedDocs('quetes');
    const orphans = quetes.filter(q => !q.mapId);
    if (!orphans.length) {
      listEl.innerHTML = '<div class="empty" style="color:#6fbf73;">✓ Toutes les quêtes ont un mapId</div>';
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
      gh.innerHTML = `<span>${tl}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">${group.length} sans mapId</span>`;
      listEl.appendChild(gh);

      group.sort((a,b) => ((a.palier||1)-(b.palier||1)) || (a.titre||'').localeCompare(b.titre||'','fr'));
      group.forEach(qt => {
        const row = _buildQuestRow(qt, 'quest-orphan');
        // Indicateur visuel d'orphelin
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

/* ══════════════════════════════════════════════════════
   MEMBRES — gestion des rôles
══════════════════════════════════════════════════════ */
const ROLES_LIST = ROLES.filter(r => r !== 'visiteur');
let _allUsers = [];

window.showUsersPanel = async () => {
  _setHash('members');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sidebar').classList.remove('in-order-panel');
  document.getElementById('users-panel').style.display = '';
  document.getElementById('btn-users').classList.add('active');
  await loadUsers();
};

window.loadUsers = async () => {
  const list = document.getElementById('users-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(collection(db, 'users'));
    _allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => ROLES_LIST.indexOf(b.role) - ROLES_LIST.indexOf(a.role)
                   || (a.pseudo || '').localeCompare(b.pseudo || ''));
    renderUsers(_allUsers);
  } catch (e) {
    list.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

function renderUsers(users) {
  const list = document.getElementById('users-list');
  if (!users.length) { list.innerHTML = '<div class="empty">Aucun membre.</div>'; return; }

  const roleColor = { membre: 'var(--muted)', contributeur: '#60a5fa', admin: 'var(--danger)' };

  list.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.dataset.uid = u.uid;

    const sel = ROLES_LIST.map(r =>
      `<option value="${r}"${r === u.role ? ' selected' : ''}>${r}</option>`
    ).join('');

    row.innerHTML = `
      <span class="user-pseudo">${escHtml(u.pseudo || '—')}</span>
      <span class="user-uid">${escHtml(u.uid)}</span>
      <span class="user-role-badge" style="color:${roleColor[u.role] || 'var(--muted)'};">${escHtml(u.role || 'membre')}</span>
      <select class="user-role-sel" onchange="setUserRole('${escHtml(u.uid)}', this.value, this)">${sel}</select>
    `;
    list.appendChild(row);
  });
}

window.filterUsers = () => {
  const q = document.getElementById('users-search').value.trim().toLowerCase();
  renderUsers(q ? _allUsers.filter(u => (u.pseudo || '').toLowerCase().includes(q)) : _allUsers);
};

window.setUserRole = async (uid, newRole, sel) => {
  if (!ROLES_LIST.includes(newRole)) return;
  const prev = sel.dataset.prev || sel.querySelector('option[selected]')?.value || sel.value;
  sel.disabled = true;
  try {
    await updateDoc(doc(db, 'users', uid), { role: newRole });
    const u = _allUsers.find(x => x.uid === uid);
    if (u) u.role = newRole;
    sel.dataset.prev = newRole;
  } catch (e) {
    sel.value = prev;
    toast('Erreur : ' + e.message, 'error');
  } finally {
    sel.disabled = false;
  }
};

// ═══════════════════════════════════════════════════════
// LEADERBOARD — contributions approuvées par membre
// ═══════════════════════════════════════════════════════

const _LB_EXCLUDED_DOC  = 'config/leaderboard_excluded';
const _LB_SNAPSHOT_DOC  = 'config/leaderboard_snapshot';

async function _saveLbSnapshot(subs, excludedIds = new Set()) {
  const approved = subs.filter(s => s.status === 'approved' && !excludedIds.has(s._id));
  const counts = {};
  for (const s of approved) {
    const uid  = s.submittedBy || null;
    const key  = uid || ('__' + (s.submitterName || 'anon'));
    const name = s.submitterName || _userNames.get(uid) || (uid ? uid.slice(0, 8) + '…' : '—');
    if (!counts[key]) counts[key] = { uid, name, total: 0, byType: {} };
    counts[key].byType[s.type] = (counts[key].byType[s.type] || 0) + 1;
    counts[key].total++;
  }
  await setDoc(doc(db, 'config', 'leaderboard_snapshot'), { counts, updatedAt: serverTimestamp() });
}

window.showLeaderboard = async () => {
  _setHash('leaderboard');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.sidebar').classList.remove('in-order-panel');
  document.getElementById('leaderboard-panel').style.display = '';
  document.getElementById('btn-leaderboard').classList.add('active');
  await loadLeaderboard();
};

window.loadLeaderboard = async () => {
  const listEl = document.getElementById('leaderboard-list');
  const detailEl = document.getElementById('leaderboard-user-detail');
  if (detailEl) detailEl.style.display = 'none';
  listEl.style.display = '';
  listEl.innerHTML = '<div class="empty">Chargement…</div>';

  // Charger les IDs exclus
  let excludedIds = new Set();
  try {
    const exSnap = await getDoc(doc(db, 'config', 'leaderboard_excluded'));
    if (exSnap.exists()) excludedIds = new Set(exSnap.data().ids || []);
  } catch {}

  const subs = allSubs.length ? allSubs : await getDocs(collection(db, 'submissions'))
    .then(s => s.docs.map(d => ({ _id: d.id, ...d.data() }))).catch(() => []);

  const approved = subs.filter(s => s.status === 'approved' && !excludedIds.has(s._id));

  if (approved.length > 0) {
    const byKey = {};
    for (const s of approved) {
      const uid  = s.submittedBy || null;
      const name = s.submitterName || _userNames.get(uid) || (uid ? uid.slice(0, 8) + '…' : '— (invité)');
      const key  = uid || ('__' + (s.submitterName || 'anon'));
      if (!byKey[key]) byKey[key] = { uid, name, subs: [] };
      byKey[key].subs.push(s);
    }
    const ranked = Object.values(byKey).sort((a, b) => b.subs.length - a.subs.length);
    _saveLbSnapshot(subs, excludedIds).catch(() => {});
    listEl.innerHTML = '';
    _renderLbRows(ranked, listEl, false);
  } else {
    // Fallback : scanner les collections pour le champ _contributor
    const scanCols = [
      { col: COL.items,       type: 'item'      },
      { col: COL.itemsSecret, type: 'item'      },
      { col: COL.mobs,        type: 'mob'       },
      { col: COL.mobsSecret,  type: 'mob'       },
      { col: COL.pnj,         type: 'pnj'       },
      { col: 'regions',       type: 'region'    },
      { col: 'quetes',        type: 'quest'     },
      { col: 'panoplies',     type: 'panoplie'  },
    ];
    const byKey = {};
    for (const { col, type } of scanCols) {
      try {
        const snap = await getDocs(collection(db, col));
        for (const d of snap.docs) {
          const c = d.data()._contributor;
          if (!c) continue;
          const uid   = c.uid  || null;
          const cname = c.name || 'Inconnu';
          const key   = uid || ('__' + cname);
          if (!byKey[key]) byKey[key] = { uid, name: cname, subs: [] };
          byKey[key].subs.push({
            _id: d.id, type, isFromCollection: true,
            name: d.data().name || d.data().titre || d.data().label || d.id,
          });
        }
      } catch {}
    }
    const ranked = Object.values(byKey).sort((a, b) => b.subs.length - a.subs.length);
    listEl.innerHTML = '';
    if (ranked.length) {
      const warn = document.createElement('div');
      warn.style.cssText = 'font-size:12px;color:var(--warn);padding:6px 10px;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);border-radius:6px;margin-bottom:12px;';
      warn.textContent = '⚠️ Historique des soumissions supprimé — affichage depuis les documents approuvés.';
      listEl.appendChild(warn);
      _renderLbRows(ranked, listEl, false);
    } else {
      listEl.innerHTML = '<div class="empty">Aucune contribution trouvée.</div>';
    }
  }
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

window.showLeaderboardUser = function(u) {
  document.getElementById('leaderboard-list').style.display = 'none';
  const detailEl = document.getElementById('leaderboard-user-detail');
  const titleEl  = document.getElementById('leaderboard-user-title');
  const subsEl   = document.getElementById('leaderboard-user-subs');
  detailEl.style.display = '';
  const updateTitle = () => {
    titleEl.textContent = `${u.name} — ${u.subs.length} contribution${u.subs.length > 1 ? 's' : ''} approuvée${u.subs.length > 1 ? 's' : ''}`;
  };
  updateTitle();

  const TYPE_ICON  = { item:'⚔️', mob:'👾', pnj:'🧑', region:'📍', quest:'📜', panoplie:'🔗' };
  const TYPE_LABEL = { item:'Item', mob:'Mob', pnj:'PNJ', region:'Région', quest:'Quête', panoplie:'Panoplie' };

  const renderRows = () => {
    subsEl.innerHTML = '';
    const sorted = [...u.subs].sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() ?? 0;
      const tb = b.submittedAt?.toMillis?.() ?? 0;
      return tb - ta;
    });
    for (const s of sorted) {
      const name = s.isFromCollection
        ? s.name
        : (s.data?.name || s.data?.titre || s.data?.label || s._id);
      const ts   = s.isFromCollection ? '—' : (s.submittedAt?.toDate
        ? s.submittedAt.toDate().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })
        : '—');
      const actionLabel = s.isFromCollection ? '' : (s.editType === 'edit' ? '✏️ Modif.' : '➕ Ajout');
      const row = document.createElement('div');
      row.id = `lb-row-${s._id}`;
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;';
      row.innerHTML = `
        <span style="width:18px;text-align:center;flex-shrink:0;">${TYPE_ICON[s.type]||'📄'}</span>
        <span style="flex:1;font-weight:600;">${escHtml(name)}</span>
        <span style="color:var(--muted);font-size:11px;">${TYPE_LABEL[s.type]||s.type}</span>
        <span style="color:var(--muted);font-size:11px;">${actionLabel}</span>
        <span style="color:var(--muted);font-size:11px;white-space:nowrap;">${ts}</span>
      `;
      if (!s.isFromCollection) {
        const ignoreBtn = document.createElement('button');
        ignoreBtn.className = 'btn btn-ghost';
        ignoreBtn.style.cssText = 'font-size:11px;padding:2px 8px;color:var(--muted);flex-shrink:0;';
        ignoreBtn.title = 'Masquer du leaderboard (test)';
        ignoreBtn.textContent = '✕ Ignorer';
        ignoreBtn.addEventListener('click', () => _lbExclude(s._id, u, updateTitle, renderRows));
        row.appendChild(ignoreBtn);
      }
      subsEl.appendChild(row);
    }
  };
  renderRows();
};

async function _lbExclude(subId, userData, updateTitle, renderRows) {
  try {
    const ref = doc(db, 'config', 'leaderboard_excluded');
    const snap = await getDoc(ref);
    const existing = snap.exists() ? (snap.data().ids || []) : [];
    if (existing.includes(subId)) { toast('Déjà ignoré.', 'warning'); return; }
    await setDoc(ref, { ids: [...existing, subId] });
    userData.subs = userData.subs.filter(s => s._id !== subId);
    updateTitle();
    renderRows();
    _saveLbSnapshot(allSubs, new Set([...existing, subId])).catch(() => {});
    toast('Contribution masquée du leaderboard.', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
}

// ═══════════════════════════════════════════════════════
// SENSIBLE — Liste & toggle (admin only)
// ═══════════════════════════════════════════════════════

const _sensState = {
  itemsHidden: [],          // docs de items_hidden (_id = hash)
  itemsSecretById: new Map(), // id original → doc items_secret
  itemsPublic: [],          // docs de items
  mobsSecret: [],           // docs de mobs_secret
  mobsPublic: [],           // docs de mobs
};

function _sensEsc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Formule d'image identique à creator.html:3022-3033 (source de vérité partagée)
function _sensComputeImg(category, id, palier) {
  if (!id) return null;
  const p = palier ? 'P' + palier + '/' : '';
  switch (category) {
    case 'arme':        return `../img/compendium/textures/weapons/${id}.png`;
    case 'armure':      return `../img/compendium/textures/armors/${id}.png`;
    case 'accessoire':  return `../img/compendium/textures/trinkets/${p}${id}.png`;
    case 'outils':      return `../img/compendium/textures/gears/${id}.png`;
    case 'materiaux':   return `../img/compendium/textures/items/Material/${id}.png`;
    case 'ressources':  return `../img/compendium/textures/items/Ressources/${id}.png`;
    case 'consommable': return `../img/compendium/textures/items/Consommable/${id}.png`;
    case 'nourriture':  return `../img/compendium/textures/items/Nourriture/${id}.png`;
    case 'rune':        return `../img/compendium/textures/items/Runes/${id}.png`;
    case 'quete':       return `../img/compendium/textures/items/Quest/${id}.png`;
    case 'donjon':      return `../img/compendium/textures/items/Donjon/${id}.png`;
    default:            return null;
  }
}

window.showMigration = async () => {
  if (currentRole !== 'admin') return;
  _setHash('migration');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('migration-panel').style.display = '';
  document.getElementById('btn-migration').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await sensReload();
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
  palier:      { type:'select',    opts:[[1,'Palier 1'],[2,'Palier 2'],[3,'Palier 3']] },
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
  mapId:       { type:'text',      placeholder:'ID marqueur sur la carte' },
  npc:         { type:'text',      placeholder:'ID ou nom du PNJ donneur' },
  zone:        { type:'text',      placeholder:'ID région' },
  // Surcharges par mode
  'items:rarity':    { type:'select', opts:[['commun','Commun'],['rare','Rare'],['epique','Épique'],['legendaire','Légendaire'],['mythique','Mythique'],['godlike','Godlike'],['event','Évènement']] },
  'items:category':  { type:'select', opts:[['arme','⚔️ Arme'],['armure','🛡️ Armure'],['accessoire','💍 Accessoire'],['materiaux','🧱 Matériau'],['ressources','⛏️ Ressource'],['consommable','🧪 Consommable'],['nourriture','🍖 Nourriture'],['outils','🔧 Outil'],['rune','🔮 Rune'],['quete','📜 Objet Quête'],['donjon','🏰 Donjon']] },
  'items:classes':   { type:'multicheckbox', opts:[['guerrier','⚔️ Guerrier'],['assassin','🗡️ Assassin'],['archer','🏹 Archer'],['mage','📖 Mage'],['shaman','🌿 Shaman']] },
  'mobs:type':       { type:'select', opts:[['monstre','👹 Monstre'],['sbire','💀 Sbire'],['mini_boss','⚡ Mini-Boss'],['boss','🔥 Boss']] },
  'mobs:region':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'quetes:type':     { type:'select', opts:[['main','⚔️ Principale'],['sec','🗺️ Secondaire'],['ter','📋 Tertiaire']] },
  'quetes:zone':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'quetes:mapId':    { type:'text',    placeholder:'ID marqueur carte' },
  'pnj:type':        { type:'select', opts:[['marchand','🛒 Marchand'],['donneur_quete','📜 Donneur quête'],['forgeron','⚒️ Forgeron'],['aubergiste','🍺 Aubergiste'],['instructeur','📚 Instructeur'],['autre','❓ Autre']] },
  'pnj:region':      { type:'dbselect', colName:'regions', labelKey:'name' },
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
  quete:  ['mapId'],
  region: ['color'],
};

let _completionResults = [];

window.showCompletion = async () => {
  _setHash('completion');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('completion-panel').style.display = '';
  document.getElementById('btn-completion').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCompletion();
};

window.loadCompletion = async () => {
  const list = document.getElementById('completion-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';

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

  // Badge sidebar
  const badge = document.getElementById('count-incomplete');
  if (badge) { badge.textContent = _completionResults.length; badge.style.display = _completionResults.length ? '' : 'none'; }

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

  renderCompletion(); // inclut _appendBrokenImagesSection en fin
};

window.renderCompletion = function renderCompletion() {
  const list        = document.getElementById('completion-list');
  const filterField = document.getElementById('completion-filter-field')?.value || '';

  let results = _completionResults;
  if (filterField) results = results.filter(r => r.missing.includes(filterField));

  list.innerHTML = '';

  if (!results.length) {
    list.innerHTML = filterField
      ? '<div class="empty">Aucun document incomplet pour ce critère. ✓</div>'
      : '<div class="empty">Aucun document à compléter. ✓</div>';
    _appendBrokenImagesSection();
    return;
  }

  // Grouper par mode
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
      const safeId    = (d.id || '').replace(/[^a-zA-Z0-9_-]/g, '_') || Math.random().toString(36).slice(2);
      const subcatLbl = discVal ? _subcatLabel(mode, discVal) : null;
      const docId     = d.id || '';

      const card = document.createElement('div');
      card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;';

      // Ligne d'en-tête
      const headRow = document.createElement('div');
      headRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;';
      headRow.innerHTML = `
        <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:8px;background:var(--surface3);color:var(--muted);flex-shrink:0;">${escHtml(mode)}</span>
        ${subcatLbl ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(122,90,248,.12);color:var(--accent);border:1px solid rgba(122,90,248,.25);flex-shrink:0;">${escHtml(subcatLbl)}</span>` : ''}
        <span style="font-size:14px;font-weight:700;">${escHtml(d.name||d.titre||d.label||docId||'—')}</span>
        <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(docId)}</span>
        <span style="font-size:11px;color:var(--warn);flex:1;min-width:0;">Manque : ${missing.map(f => `<code style="background:var(--surface2);padding:1px 4px;border-radius:3px;">${escHtml(f)}</code>`).join(' ')}</span>
        <button class="btn btn-ghost btn-sm" onclick="showEditor('${escHtml(colName)}','${escHtml(docId)}',null,'completion')" style="font-size:11px;flex-shrink:0;">✏️ Éditer</button>
        ${mode === 'items' ? `<button class="btn btn-ghost btn-sm" onclick="openCompletionInCreator('${escHtml(colName)}','${escHtml(docId)}')" style="font-size:11px;flex-shrink:0;" title="Ouvrir dans le Creator">⚙️ Creator</button>` : ''}
      `;
      card.appendChild(headRow);

      // Champs inline guidés
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
        const inputEl = _buildCompletionInput(f, mode, d[f] != null ? d[f] : undefined);
        wrap.appendChild(inputEl);
        fieldsWrap.appendChild(wrap);
      }
      card.appendChild(fieldsWrap);

      // Bouton sauvegarder
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
      list.appendChild(card);
    }
  }

  _appendBrokenImagesSection();
};

async function _appendBrokenImagesSection() {
  const list = document.getElementById('completion-list');
  if (!list) return;
  const imgHeader = document.createElement('div');
  imgHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;';
  imgHeader.textContent = '🖼️ Images — vérification en cours…';
  list.appendChild(imgHeader);
  try {
    const itemDocs = await cachedDocs('items').catch(() => []);
    const broken = await _checkBrokenImages(itemDocs, (done, total) => {
      imgHeader.textContent = `🖼️ Images — ${done} / ${total} vérifiées…`;
    });
    if (!broken.length) {
      imgHeader.textContent = '🖼️ Images — toutes accessibles ✓';
    } else {
      imgHeader.textContent = `🖼️ Images cassées — ${broken.length} item${broken.length > 1 ? 's' : ''}`;
      for (const { doc: d, brokenUrls } of broken) {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:700;flex:1;min-width:120px;">${escHtml(d.name||d.id||'—')}</span>
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(d.id||'')}</span>
          <div style="width:100%;display:flex;flex-direction:column;gap:3px;">
            ${brokenUrls.map(u => `<span style="font-size:11px;color:var(--danger);font-family:monospace;word-break:break-all;">⛔ ${escHtml(u)}</span>`).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showEditor('items','${escHtml(d.id||'')}',null,'completion')" style="font-size:11px;">✏️ Éditer</button>
        `;
        list.appendChild(card);
      }
    }
  } catch {
    imgHeader.textContent = '🖼️ Images — erreur lors de la vérification';
  }
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
    patch[f] = _NUMERIC_CF_FIELDS.has(f) ? Number(v) : v;
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
    if (status) { status.textContent = '✓ Sauvegardé'; status.style.color = 'var(--success)'; }
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
  } finally {
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
    { id: 'lvl',      label: 'Niveau requis' },
    { id: 'images',   label: 'Image' },
    { id: 'lore',     label: 'Lore' },
    { id: 'obtain',   label: 'Obtention' },
    { id: 'stats',    label: 'Stats' },
    { id: 'effects',  label: 'Effets' },
    { id: 'cat',      label: 'Slot interne' },
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
    { id: 'quete',       label: '📜 Objet Quête' },
    { id: 'donjon',      label: '🏰 Donjon' },
  ],
  mobs: [
    { id: 'monstre',   label: '👹 Monstre' },
    { id: 'sbire',     label: '💀 Sbire' },
    { id: 'mini_boss', label: '⚡ Mini-Boss' },
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
  _setHash('creator-validation');
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
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

function _renderCvFieldGrid(fields, reqSet, scope, subcat) {
  const subcatAttr = subcat ? ` data-subcat="${subcat}"` : '';
  return `
    <div style="display:grid;grid-template-columns:1fr 80px;gap:6px;padding:0 4px;margin-bottom:6px;border-bottom:1px solid var(--border);padding-bottom:6px;">
      <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;">Champ</span>
      <span style="font-size:10px;font-weight:700;color:var(--muted);text-align:center;text-transform:uppercase;letter-spacing:.06em;">Requis</span>
    </div>
    ${fields.map(f => `
      <label style="display:grid;grid-template-columns:1fr 80px;gap:6px;align-items:center;padding:8px 4px;border-bottom:1px solid var(--border);cursor:pointer;">
        <span style="font-size:13px;">${f.label || f.id}</span>
        <div style="text-align:center;">
          <input type="checkbox" data-mode="${_cvMode}" data-scope="${scope}" data-field="${f.id}"${subcatAttr}
            style="width:16px;height:16px;cursor:pointer;"
            ${reqSet.has(f.id) ? 'checked' : ''} onchange="window._onCvToggle(this)">
        </div>
      </label>
    `).join('')}
  `;
}

function _renderCvUI() {
  const tabsEl = document.getElementById('cv-tabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = Object.entries(QUALITY_MODE_LABELS).map(([m, lbl]) =>
    `<button class="btn btn-ghost btn-sm${m === _cvMode ? ' active' : ''}" onclick="window._setCvMode('${m}')">${lbl}</button>`
  ).join('');

  const grid    = document.getElementById('cv-grid');
  const fields  = QUALITY_FIELD_SCHEMA[_cvMode] || [];
  const md      = _cvModeData(_cvMode);
  const subCats = QUALITY_SUBCATEGORIES[_cvMode] || [];
  let html = '';

  html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:10px 4px 8px;margin-bottom:4px;">Toujours requis</div>`;
  html += _renderCvFieldGrid(fields, md.required, 'global', null);

  if (subCats.length) {
    const selSub = _cvSubMode[_cvMode] || subCats[0].id;
    if (!_cvSubMode[_cvMode]) _cvSubMode[_cvMode] = selSub;
    const subReq = _cvSubData(_cvMode, selSub);

    html += `<div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:18px 4px 8px;margin-bottom:4px;">Par catégorie</div>`;
    html += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;">
      ${subCats.map(sc =>
        `<button class="btn btn-ghost btn-sm${sc.id === selSub ? ' active' : ''}"
          onclick="window._setCvSubMode('${sc.id}')" style="font-size:11px;">${sc.label}</button>`
      ).join('')}
    </div>`;
    html += _renderCvFieldGrid(fields, subReq, 'bycat', selSub);
  }

  grid.innerHTML = html;
}

window._setCvMode    = (m)  => { _cvMode = m; _renderCvUI(); };
window._setCvSubMode = (sc) => { _cvSubMode[_cvMode] = sc; _renderCvUI(); };
window._onCvToggle   = (cb) => {
  const { mode, scope, field, subcat } = cb.dataset;
  if (scope === 'global') {
    const req = _cvModeData(mode).required;
    cb.checked ? req.add(field) : req.delete(field);
  } else {
    const req = _cvSubData(mode, subcat);
    cb.checked ? req.add(field) : req.delete(field);
  }
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

function _fieldEmpty(d, fieldId) {
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

window.showDataIncomplete = async () => showCompletion();

window.loadDataIncomplete = async () => {
  const list = document.getElementById('data-incomplete-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';

  // Charger config depuis Firestore — structure { required, byCategory }
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
  } catch { /* silently ignore */ }
  if (!Object.keys(standards).length) {
    list.innerHTML = '<div class="empty">Aucune configuration définie. Définissez les champs requis dans ⚙️ Champs requis.</div>';
    const badge = document.getElementById('count-data-incomplete');
    if (badge) badge.style.display = 'none';
    return;
  }

  const results = [];
  try {
    for (const [mode, std] of Object.entries(standards)) {
      const colName  = QUALITY_COL_MAP[mode];
      if (!colName) continue;
      const disc     = QUALITY_DISCRIMINANT[mode];
      const hasByCat = disc && Object.keys(std.byCategory || {}).length > 0;
      let docs = [];
      try { docs = await cachedDocs(colName); } catch { continue; }
      for (const _d of docs) {
        // Normalise img/image → images pour que les anciens docs soient traités correctement
        const d = (!_d.images?.length && (_d.img || _d.image))
          ? { ..._d, images: [_d.img || _d.image].filter(Boolean) }
          : _d;
        const missing = (std.required || []).filter(f => _fieldEmpty(d, f));

        const discVal = disc ? (d[disc] || null) : null;
        if (hasByCat && !discVal) {
          // Catégorie absente alors que des règles par catégorie existent
          if (!missing.includes(disc)) missing.push(disc);
        } else if (discVal && std.byCategory?.[discVal]) {
          for (const f of (std.byCategory[discVal].required || [])) {
            if (!missing.includes(f) && _fieldEmpty(d, f)) missing.push(f);
          }
        }

        if (missing.length) results.push({ mode, doc: d, missing, discVal });
      }
    }
  } catch(e) {
    list.innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
    return;
  }

  // Badge sidebar
  const badge = document.getElementById('count-data-incomplete');
  if (badge) { badge.textContent = results.length; badge.style.display = results.length ? '' : 'none'; }

  list.innerHTML = '';

  if (!results.length) {
    list.innerHTML = '<div class="empty">Aucun document incomplet. ✓</div>';
  } else {
    // Grouper par mode
    const byMode = {};
    for (const r of results) {
      if (!byMode[r.mode]) byMode[r.mode] = [];
      byMode[r.mode].push(r);
    }
    for (const [mode, rows] of Object.entries(byMode)) {
      const header = document.createElement('div');
      header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;';
      header.textContent = `${QUALITY_MODE_LABELS[mode] || mode} — ${rows.length} incomplet${rows.length > 1 ? 's' : ''}`;
      list.appendChild(header);
      for (const { doc: d, missing, discVal } of rows) {
        const colName   = QUALITY_COL_MAP[mode];
        const subcatLbl = discVal ? _subcatLabel(mode, discVal) : null;
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;flex-wrap:wrap;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:700;flex:1;min-width:120px;">${escHtml(d.name||d.titre||d.label||d.id||'—')}</span>
          ${subcatLbl ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(122,90,248,.12);color:var(--accent);border:1px solid rgba(122,90,248,.25);">${escHtml(subcatLbl)}</span>` : ''}
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(d.id||'')}</span>
          <span style="font-size:11px;color:var(--warn);">Manque : ${missing.map(f => `<code style="background:var(--surface2);padding:1px 4px;border-radius:3px;">${escHtml(f)}</code>`).join(' ')}</span>
          <button class="btn btn-ghost btn-sm" onclick="showEditor('${escHtml(colName)}','${escHtml(d.id||'')}',null,'data-incomplete')" style="font-size:11px;">✏️ Éditer</button>
        `;
        list.appendChild(card);
      }
    }
  }

  // ── Vérification des images cassées ──────────────────
  const imgHeader = document.createElement('div');
  imgHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;';
  imgHeader.textContent = '🖼️ Images — vérification en cours…';
  list.appendChild(imgHeader);

  try {
    const itemDocs = await cachedDocs('items').catch(() => []);
    const broken = await _checkBrokenImages(itemDocs, (done, total) => {
      imgHeader.textContent = `🖼️ Images — ${done} / ${total} vérifiées…`;
    });

    if (!broken.length) {
      imgHeader.textContent = '🖼️ Images — toutes accessibles ✓';
    } else {
      imgHeader.textContent = `🖼️ Images cassées — ${broken.length} item${broken.length > 1 ? 's' : ''}`;
      for (const { doc: d, brokenUrls } of broken) {
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:700;flex:1;min-width:120px;">${escHtml(d.name||d.id||'—')}</span>
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(d.id||'')}</span>
          <div style="width:100%;display:flex;flex-direction:column;gap:3px;">
            ${brokenUrls.map(u => `<span style="font-size:11px;color:var(--danger);font-family:monospace;word-break:break-all;">⛔ ${escHtml(u)}</span>`).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showEditor('items','${escHtml(d.id||'')}',null,'data-incomplete')" style="font-size:11px;">✏️ Éditer</button>
        `;
        list.appendChild(card);
      }
    }
  } catch(e) {
    imgHeader.textContent = '🖼️ Images — erreur lors de la vérification';
  }
};

window.sensReload = async () => {
  document.getElementById('sens-loading').style.display = '';
  document.getElementById('sens-loading').textContent = 'Chargement…';
  document.getElementById('sens-content').style.display = 'none';
  try {
    const [ih, is, ip, ms, mp] = await Promise.all([
      getDocs(collection(db, COL.itemsHidden)),
      getDocs(collection(db, COL.itemsSecret)),
      getDocs(collection(db, COL.items)),
      getDocs(collection(db, COL.mobsSecret)),
      getDocs(collection(db, COL.mobs)),
    ]);
    _sensState.itemsHidden = ih.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.itemsSecretById = new Map(
      is.docs.map(d => [d.id, desanitizeFromFirestore({ _id: d.id, ...d.data() })])
    );
    _sensState.itemsPublic = ip.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsSecret = ms.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsPublic = mp.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));

    // Sort alphabétique pour confort
    const byName = (a, b) => normalize(a.name || a._id).localeCompare(normalize(b.name || b._id), 'fr');
    _sensState.itemsHidden.sort(byName);
    _sensState.itemsPublic.sort(byName);
    _sensState.mobsSecret.sort(byName);
    _sensState.mobsPublic.sort(byName);

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
    const btn = `<button class="btn btn-ghost" onclick="sensMobToPublic('${_sensEsc(mob._id)}')" style="font-size:11px;padding:3px 10px;">🔓 Rendre public</button>`;
    return _sensMobRow(mob, btn);
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

    await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore(gameplay));
    if (Object.keys(secret).length) {
      await setDoc(doc(db, COL.itemsSecret, sourceId), sanitizeForFirestore(secret));
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
    const _sensImg = _sensComputeImg(merged.category, merged.id, merged.palier);
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
    delete payload.sensible; // on garde pas le flag, la collection suffit

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

// ── Coords PNJ ────────────────────────────────────────
window.showPnjCoords = function() {
  _setHash('pnj-coords');
  _showPanel('pnj-coords-panel', 'btn-pnj-coords');
};

function _escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.addCoordsToAllPnj = async function() {
  const statusEl = document.getElementById('pnj-coords-step1-status');
  statusEl.style.display = '';
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = '⏳ Chargement des PNJ…';
  try {
    const pnjs = await cachedDocs('personnages');
    const toUpdate = pnjs.filter(p => !('coords' in p) || typeof p.coords === 'string');
    if (!toUpdate.length) {
      statusEl.textContent = '✓ Tous les PNJ ont déjà le champ coords (map).';
      statusEl.style.color = 'var(--success)';
      return;
    }
    statusEl.textContent = `⏳ Mise à jour de ${toUpdate.length} PNJ…`;
    let done = 0;
    for (const p of toUpdate) {
      await updateDoc(doc(db, 'personnages', p.id), { coords: { x: null, y: null, z: null } });
      p.coords = { x: null, y: null, z: null };
      done++;
      if (done % 10 === 0) statusEl.textContent = `⏳ ${done} / ${toUpdate.length}…`;
    }
    localStorage.removeItem('vcl_cache_v2_personnages');
    localStorage.removeItem('vcl_cache_meta_v2_personnages');
    invalidateModCache('personnages');
    statusEl.textContent = `✓ ${done} PNJ mis à jour !`;
    statusEl.style.color = 'var(--success)';
    toast(`✓ coords ajouté à ${done} PNJ`, 'success');
  } catch(e) {
    statusEl.textContent = '⛔ ' + e.message;
    statusEl.style.color = 'var(--danger)';
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

window.revertObtainCoords = async function() {
  const statusEl = document.getElementById('pnj-coords-step2-status');
  statusEl.style.display = '';
  statusEl.style.color = 'var(--muted)';
  statusEl.textContent = '⏳ Chargement…';
  try {
    const [pnjs, items] = await Promise.all([
      cachedDocs('personnages'),
      cachedDocs('items'),
    ]);
    const pnjsWithName = pnjs.filter(p => p.name).sort((a, b) => b.name.length - a.name.length);
    if (!pnjsWithName.length) {
      statusEl.textContent = '⚠️ Aucun PNJ trouvé.';
      statusEl.style.color = 'var(--warn)';
      return;
    }
    statusEl.textContent = `⏳ Analyse de ${items.length} items…`;
    let count = 0;
    for (const item of items) {
      if (!item.obtain) continue;
      let obtain = item.obtain;
      for (const pnj of pnjsWithName) {
        // Retire "Nom PNJ (quoi que ce soit)" → "Nom PNJ"
        const pattern = new RegExp(_escapeRegex(pnj.name) + '\\s*\\([^)]*\\)', 'g');
        obtain = obtain.replace(pattern, pnj.name);
      }
      if (obtain !== item.obtain) {
        await updateDoc(doc(db, 'items', item.id), { obtain });
        item.obtain = obtain;
        count++;
        statusEl.textContent = `⏳ ${count} item${count>1?'s':''} nettoyé${count>1?'s':''}…`;
      }
    }
    if (count > 0) {
      localStorage.removeItem('vcl_cache_v2_items');
      localStorage.removeItem('vcl_cache_meta_v2_items');
      invalidateModCache('items');
    }
    statusEl.textContent = `✓ ${count} item${count>1?'s':''} nettoyé${count>1?'s':''} !`;
    statusEl.style.color = 'var(--success)';
    toast(`✓ ${count} items nettoyés`, count > 0 ? 'success' : 'info');
  } catch(e) {
    statusEl.textContent = '⛔ ' + e.message;
    statusEl.style.color = 'var(--danger)';
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════
   OUTIL CARTE — Gestion des map_markers (Firestore)
══════════════════════════════════════════════════════ */

let _mapMarkersList = [];

window.showMapPanel = async function showMapPanel() {
  _showPanel('map-panel', 'btn-map-order');
  _setHash('map');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadMapMarkers();
};

async function loadMapMarkers() {
  const tableEl = document.getElementById('map-markers-table');
  tableEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(collection(db, COL.mapMarkers));
    _mapMarkersList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    renderMapTable();
  } catch (err) {
    tableEl.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
    toast('⛔ Erreur chargement map_markers : ' + err.message, 'error');
  }
}

window.renderMapTable = function renderMapTable() {
  const tableEl = document.getElementById('map-markers-table');
  const floorF  = document.getElementById('map-filter-floor')?.value || '';
  const typeF   = document.getElementById('map-filter-type')?.value  || '';
  const searchF = (document.getElementById('map-filter-search')?.value || '').toLowerCase();

  const filtered = _mapMarkersList.filter(m => {
    if (floorF  && String(m.floor) !== floorF)           return false;
    if (typeF   && m.type !== typeF)                      return false;
    if (searchF && !(m.name || '').toLowerCase().includes(searchF)) return false;
    return true;
  });

  if (!filtered.length) {
    tableEl.innerHTML = '<div class="empty">Aucun marqueur</div>';
    return;
  }

  const TYPE_EMOJI = { donjon: '⚔️', ressource: '🌿', zone_monstre: '💀' };

  const rows = filtered.map(m => `
    <tr>
      <td>${TYPE_EMOJI[m.type] || '📍'} ${m.type || '—'}</td>
      <td style="font-weight:600;">${m.name || '—'}</td>
      <td style="text-align:center;">${m.floor ?? '—'}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--muted);">${m.gx ?? '—'} / ${m.gy ?? '—'}</td>
      <td style="white-space:nowrap;">
        <button class="btn btn-ghost btn-sm" onclick="openMapMarkerForm(${JSON.stringify(m._id)})" style="font-size:11px;padding:3px 8px;">✏️</button>
        <button class="btn btn-ghost btn-sm" onclick="deleteMapMarker(${JSON.stringify(m._id)})" style="font-size:11px;padding:3px 8px;color:var(--danger);">🗑️</button>
      </td>
    </tr>
  `).join('');

  tableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px 8px;">Type</th>
          <th style="text-align:left;padding:6px 8px;">Nom</th>
          <th style="text-align:center;padding:6px 8px;">Palier</th>
          <th style="text-align:left;padding:6px 8px;">Coords (X / Z)</th>
          <th style="padding:6px 8px;"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
};

window.openMapMarkerForm = function openMapMarkerForm(id) {
  const formEl = document.getElementById('map-marker-form');
  formEl.style.display = '';
  document.getElementById('map-form-title').textContent = id ? 'Modifier le marqueur' : 'Nouveau marqueur';
  document.getElementById('map-form-id').value = id || '';

  if (id) {
    const m = _mapMarkersList.find(x => x._id === id);
    if (m) {
      document.getElementById('map-form-type').value  = m.type  || 'donjon';
      document.getElementById('map-form-floor').value = String(m.floor ?? 1);
      document.getElementById('map-form-name').value  = m.name  || '';
      document.getElementById('map-form-gx').value    = m.gx    ?? '';
      document.getElementById('map-form-gy').value    = m.gy    ?? '';
      document.getElementById('map-form-desc').value  = m.desc  || '';
      document.getElementById('map-form-link').value  = m.link  || '';
      document.getElementById('map-form-level').value = m.level || '';
      document.getElementById('map-form-color').value = m.color || '#ff4444';
      document.getElementById('map-form-polygon').value = m.polygon ? JSON.stringify(m.polygon) : '';
    }
  } else {
    document.getElementById('map-form-type').value    = 'donjon';
    document.getElementById('map-form-floor').value   = '1';
    document.getElementById('map-form-name').value    = '';
    document.getElementById('map-form-gx').value      = '';
    document.getElementById('map-form-gy').value      = '';
    document.getElementById('map-form-desc').value    = '';
    document.getElementById('map-form-link').value    = '';
    document.getElementById('map-form-level').value   = '';
    document.getElementById('map-form-color').value   = '#ff4444';
    document.getElementById('map-form-polygon').value = '';
  }
  onMapFormTypeChange();
  formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeMapMarkerForm = function closeMapMarkerForm() {
  document.getElementById('map-marker-form').style.display = 'none';
};

window.onMapFormTypeChange = function onMapFormTypeChange() {
  const t = document.getElementById('map-form-type').value;
  document.getElementById('map-form-donjon-fields').style.display = t === 'donjon'      ? '' : 'none';
  document.getElementById('map-form-zone-fields').style.display   = t === 'zone_monstre' ? '' : 'none';
};

window.saveMapMarker = async function saveMapMarker() {
  const name  = document.getElementById('map-form-name').value.trim();
  const type  = document.getElementById('map-form-type').value;
  const floor = parseInt(document.getElementById('map-form-floor').value);
  const gxVal = document.getElementById('map-form-gx').value;
  const gyVal = document.getElementById('map-form-gy').value;

  if (!name)  { toast('⚠ Le nom est obligatoire', 'warning'); return; }
  if (!type)  { toast('⚠ Le type est obligatoire', 'warning'); return; }
  if (isNaN(floor)) { toast('⚠ Palier invalide', 'warning'); return; }

  const obj = {
    type,
    floor,
    name,
    desc:  document.getElementById('map-form-desc').value.trim() || null,
    link:  document.getElementById('map-form-link').value.trim() || null,
    gx:    gxVal !== '' ? parseFloat(gxVal) : null,
    gy:    gyVal !== '' ? parseFloat(gyVal) : null,
  };

  if (type === 'donjon') {
    const lvl = document.getElementById('map-form-level').value.trim();
    if (lvl) obj.level = lvl;
  }
  if (type === 'zone_monstre') {
    obj.color = document.getElementById('map-form-color').value;
    const polyRaw = document.getElementById('map-form-polygon').value.trim();
    if (polyRaw) {
      try { obj.polygon = JSON.parse(polyRaw); } catch { toast('⚠ JSON polygone invalide', 'warning'); return; }
    }
  }

  // Nettoyer les nulls
  Object.keys(obj).forEach(k => { if (obj[k] === null) delete obj[k]; });

  try {
    const existingId = document.getElementById('map-form-id').value;
    if (existingId) {
      await setDoc(doc(db, COL.mapMarkers, existingId), obj, { merge: true });
      const idx = _mapMarkersList.findIndex(m => m._id === existingId);
      if (idx !== -1) _mapMarkersList[idx] = { _id: existingId, ...obj };
      toast('✓ Marqueur mis à jour', 'success');
    } else {
      const newId = `${type}_${Date.now()}`;
      await setDoc(doc(db, COL.mapMarkers, newId), obj);
      _mapMarkersList.push({ _id: newId, ...obj });
      toast('✓ Marqueur créé', 'success');
    }
    invalidateModCache(COL.mapMarkers);
    invalidateCache(COL.mapMarkers);
    closeMapMarkerForm();
    renderMapTable();
  } catch (err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};

window.deleteMapMarker = async function deleteMapMarker(id) {
  const m = _mapMarkersList.find(x => x._id === id);
  if (!m) return;
  const confirmed = await modal.confirm(`Supprimer "${m.name}" ?`, 'Cette action est irréversible.');
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, COL.mapMarkers, id));
    _mapMarkersList = _mapMarkersList.filter(x => x._id !== id);
    invalidateModCache(COL.mapMarkers);
    invalidateCache(COL.mapMarkers);
    renderMapTable();
    toast('✓ Marqueur supprimé', 'success');
  } catch (err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};

// ══════════════════════════════════════════════════════
// OBTENTIONS LIBRES (non structurées)
// ══════════════════════════════════════════════════════

// Patterns reconnus par le builder structuré (y compris anciens formats pour compatibilité)
const OBTAIN_STRUCTURED_PATTERNS = [
  /^Obtenable en tuant:$/,
  /^-\s*\[([^|]+)\|([^\]]+)\]\[([^\]]+)\]$/,
  /^Obtenable en récompense du \[npc:[^|]+\|[^\]]+\]$/,
  /^Fabricable au \[npc:[^|]+\|[^\]]+\]$/,
  /^Achetable au \[npc:[^|]+\|[^\]]+\]$/,
  /^Récompense de la quête \[quest:[^|]+\|[^\]]+\]$/,
  /^Récoltable dans \[region:[^|]+\|[^\]]+\]$/,
  /^Autre source — .+$/,
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
  const CAT_ICONS = { arme:'⚔️', armure:'🛡️', accessoire:'💍', consommable:'🧪', nourriture:'🍖', materiaux:'🧱', ressources:'⛏️', outils:'🛠️', rune:'🔮', quete:'📜', donjon:'🏰', monnaie:'🪙' };

  listEl.innerHTML = '';
  for (const item of _obtainLegacyShown) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);margin-bottom:6px;';

    const rarColor = RARITY_COLORS[item.rarity] || '#aaa';
    const catIcon  = CAT_ICONS[item.category] || '📦';

    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;';
    left.innerHTML =
      `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">` +
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


