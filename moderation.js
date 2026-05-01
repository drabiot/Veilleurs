import { db, auth, onAuthStateChanged,
         login, logout, loginWithGoogle,
         ROLES, roleLevel, hasRole, COL,
         collection, getDocs, getDoc, doc, updateDoc, setDoc, addDoc,
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
  // _docKey = clé Firestore réelle (peut différer de data.id, ex. items_hidden où la clé est le hash du nom)
  _modCache[colName] = snap.docs.map(d => ({ _docKey: d.id, id: d.id, ...d.data() }));
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
  // Lire le rôle (retry once — auth token may not have propagated to Firestore yet)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      currentRole = snap.exists() ? (snap.data().role || 'membre') : 'membre';
      break;
    } catch {
      if (attempt === 0) await new Promise(r => setTimeout(r, 800));
      else currentRole = 'membre';
    }
  }

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
    // backfill email si absent
    if (snapU.exists() && !snapU.data().email && user.email) {
      updateDoc(doc(db, 'users', user.uid), { email: user.email }).catch(() => {});
    }
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
    // Pré-charger les pseudos et les panoplies (pour labels sets dans résumé)
    const uids = [...new Set(allSubs.flatMap(s => [s.submittedBy, s.reviewedBy].filter(Boolean)))];
    await Promise.all([
      fetchUserNames(uids).catch(() => {}),
      cachedDocs('panoplies').catch(() => {}),
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

function _buildPrettySummary(data, type) {
  const esc = window.VCL.escHtml;
  const RARITY_COLORS = { commun:'#4ade80', rare:'#60a5fa', epique:'#a78bfa', legendaire:'#e8d44a', mythique:'#f5b5e4', godlike:'#f87171', event:'#e2e8f0' };
  const RARITY_LABELS = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
  const CAT_LABELS    = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire', consommable:'🧪 Consommable', nourriture:'🍖 Nourriture', materiaux:'🧱 Matériaux', ressources:'⛏️ Ressources', outils:'🛠️ Outils', rune:'🔮 Rune', quete:'📜 Quête', donjon:'🏰 Donjon', monnaie:'🪙 Monnaie' };

  const rows = [];
  const field = (label, val, color) => {
    if (val == null || val === '' || val === false) return;
    rows.push(`<div style="display:flex;gap:6px;align-items:baseline;font-size:12px;padding:2px 0;">
      <span style="color:var(--muted);min-width:90px;flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</span>
      <span style="color:${color||'var(--text)'};word-break:break-word;">${val}</span>
    </div>`);
  };

  if (type === 'item') {
    const rarColor = RARITY_COLORS[data.rarity] || 'var(--muted)';
    if (data.rarity)   field('Rareté',   `<span style="font-weight:700;">${RARITY_LABELS[data.rarity]||data.rarity}</span>`, rarColor);
    if (data.category) field('Catégorie', CAT_LABELS[data.category]||data.category);
    if (data.palier)   field('Palier',   'Palier ' + data.palier);
    if (data.lvl)      field('Niveau',   'Niveau ≥ ' + data.lvl);
    if (data.cat)      field('Slot',     data.cat);
    if (data.classes?.length) field('Classes', data.classes.join(', '));
    if (data.set) {
      const pano = (_modCache['panoplies'] || []).find(p => p.id === data.set);
      field('Set', esc(pano?.label || data.set), '#d7af5f');
    }
    if (data.sensible) field('', '🔒 Sensible', '#f87171');
    if (data.event)    field('', '🎊 Event',    '#a855f7');
    if (data.evolutif) field('', '🔄 Évolutif', '#60a5fa');
    if (data.stats && Object.keys(data.stats).length) {
      const statLines = Object.entries(data.stats).map(([k, v]) => {
        const val = Array.isArray(v) ? `${v[0]}–${v[1]}` : v;
        return `<span style="background:rgba(122,90,248,.12);border:1px solid rgba(122,90,248,.2);border-radius:4px;padding:1px 6px;font-size:11px;">${esc(k)} <b>${val}</b></span>`;
      }).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Stats</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${statLines}</div>`);
    }
    if (data.craft?.length) {
      const craftLines = data.craft.map(c => `<span style="background:var(--surface3);border-radius:4px;padding:1px 6px;font-size:11px;">×${c.qty} ${esc(c.id)}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Craft</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${craftLines}</div>`);
    }
    if (data.obtain)  field('Obtention', esc(data.obtain).replace(/\n/g,'<br>'));
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.tags?.length) field('Tags', data.tags.map(t=>`<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 5px;">${esc(t)}</span>`).join(' '));
  } else if (type === 'mob') {
    if (data.type)    field('Type',     data.type);
    if (data.palier)  field('Palier',   'Palier ' + data.palier);
    if (data.region)  field('Région',   data.region);
    if (data.behavior)field('Comportement', data.behavior);
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.loot?.length) {
      const lootLines = data.loot.map(l => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${esc(l.id)} <b style="color:var(--success)">${l.chance}%</b></span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Loot</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${lootLines}</div>`);
    }
  } else if (type === 'pnj') {
    if (data.tag)    field('Type',   data.tag);
    if (data.palier) field('Palier', 'Palier ' + data.palier);
    if (data.region) field('Région', data.region);
    if (data.coords) field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
  } else if (type === 'region') {
    if (data.palier)  field('Palier', 'Palier ' + data.palier);
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.inCodex) field('Codex',  '✓ Dans le Codex', 'var(--success)');
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
  } else if (type === 'quest') {
    const QUEST_TYPE_LABELS = { main:'⚔️ Principale', sec:'🗺️ Secondaire', ter:'📋 Tertiaire' };
    if (data.type)    field('Type',   QUEST_TYPE_LABELS[data.type]||data.type);
    if (data.palier)  field('Palier', 'Palier ' + data.palier);
    if (data.npc)     field('PNJ',    data.npc);
    if (data.zone)    field('Zone',   data.zone);
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.desc)    field('Desc',   `<i style="color:var(--muted)">${esc(data.desc).slice(0,200)}</i>`);
    if (data.objectifs?.length) {
      const objLines = data.objectifs.map(o => `<div style="font-size:11px;display:flex;gap:5px;"><span style="color:var(--accent);">◻</span><span>${esc(o.texte||'—')}</span></div>`).join('');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Objectifs</div><div style="display:flex;flex-direction:column;gap:1px;">${objLines}</div>`);
    }
  } else if (type === 'panoplie') {
    if (data.bonuses?.length) {
      const bonLines = data.bonuses.map(b => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${b.pieces}×: ${esc(b.stat)} +${b.value}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Bonus</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${bonLines}</div>`);
    }
  } else {
    return '';
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
    actionsHtml = `
      <input type="text" class="sub-comment" id="comment-${sub._id}" placeholder="Commentaire (optionnel)">
      <button class="btn btn-ghost"   id="btn-edit-${sub._id}" onclick="toggleEdit('${sub._id}')" style="font-size:12px;">✏️ Modifier</button>
      <button class="btn btn-ghost"   onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre cette soumission dans le Creator pour l'éditer">⚙️ Creator</button>
      <button class="btn btn-approve" onclick="approve('${sub._id}')">✓ Approuver</button>
      <button class="btn btn-reject"  onclick="reject('${sub._id}')">✕ Rejeter</button>
    `;
  } else if (sub.comment) {
    actionsHtml = `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>`;
  }

  const modBadge = sub.isModification
    ? `<span class="sub-type" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);">✏️ Modif</span>`
    : `<span class="sub-type" style="background:rgba(74,222,128,.12);color:var(--success);border:1px solid rgba(74,222,128,.3);">✨ Ajout</span>`;

  const preservedHtml = '';

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
    ${preservedHtml}
    ${playerCommentHtml}
    <div class="sub-body">
      <div class="sub-actions">
        ${actionsHtml}
        <button class="btn btn-copy" onclick="copyCode('${sub._id}')">📋 Copier</button>
        ${currentRole === 'admin' || sub.status === 'pending' ? `<button class="btn btn-copy" onclick="deleteSub('${sub._id}')" style="color:var(--danger);border-color:var(--danger);">🗑️</button>` : ''}
        <button class="btn-toggle" onclick="toggleDetails('${sub._id}', this)">▾ Voir</button>
      </div>
      <div class="sub-details" id="details-${sub._id}">
        ${sub.isModification ? `<div id="diff-${sub._id}" style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="loadSubDiff('${sub._id}','${sub.type}','${String(sub.data?.id||'')}')">🔍 Voir les changements</button></div>` : ''}
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
const _diffDataStore = new Map(); // subId → { current, proposed }

// Champs dont l'ordre de tableau est non significatif
const _UNORDERED_ARRAY_FIELDS = new Set(['stats','craft','effects','bonuses','tags','classes','images','loot','drops','zones','objectifs','recompenses']);
// Champs à ignorer dans le diff (images et ordre gérés en interne lors de l'approbation)
const _DIFF_SKIP_FIELDS = new Set(['_order','ordre','_contributor','_ts','images','image','img']);

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
    if (!snap.exists()) {
      el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Document original introuvable — traité comme ajout.</div>';
      return;
    }
    const sub = allSubs.find(s => s._id === subId);
    if (!sub) return;
    const current  = snap.data();
    const proposed = sub.data || {};
    _diffDataStore.set(subId, { current, proposed });
    el.innerHTML = _renderDiffView(subId, current, proposed);
  } catch(e) {
    el.innerHTML = `<div style="font-size:12px;color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.applyDiffSelection = async function(subId) {
  const stored = _diffDataStore.get(subId);
  if (!stored) { toast('Diff non chargé — cliquez d\'abord sur "Voir les changements".', 'error'); return; }
  const sub = allSubs.find(s => s._id === subId);
  if (!sub) return;
  const { proposed } = stored;
  const diffEl = document.getElementById(`diff-${subId}`);
  const rows = diffEl ? diffEl.querySelectorAll('[data-diff-key]') : [];

  // Partir de la version proposée (contient tous les champs inchangés)
  const merged = { ...proposed };
  for (const row of rows) {
    const k    = row.dataset.diffKey;
    const kind = row.dataset.diffKind;
    const cb   = row.querySelector('input[type=checkbox]');
    if (!cb || cb.checked) continue; // accepté → pas de revert
    // Refusé → revenir à la valeur actuelle
    if (kind === 'added')   { delete merged[k]; }
    if (kind === 'changed') { merged[k] = stored.current[k]; }
    if (kind === 'removed') { merged[k] = stored.current[k]; }
  }

  sub.data = merged;
  const codeDiv = document.getElementById(`code-${subId}`);
  if (codeDiv) codeDiv.textContent = toJSStr(merged, 0) + ',';
  const prettyDiv = document.getElementById(`pretty-${subId}`);
  if (prettyDiv) prettyDiv.innerHTML = _buildPrettySummary(merged, sub.type);

  try {
    await updateDoc(doc(db, 'submissions', subId), { data: merged });
    toast('✓ Sélection appliquée et sauvegardée', 'success');
    // Recharger le diff avec le nouvel état
    const type   = sub.type;
    const docId  = String(sub.data?.id || '');
    _diffDataStore.set(subId, { current: stored.current, proposed: merged });
    if (diffEl) diffEl.innerHTML = _renderDiffView(subId, stored.current, merged);
  } catch(e) {
    toast('Erreur sauvegarde : ' + e.message, 'error');
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
  window.open('creator.html');
};

// Ouvre l'item actuellement dans l'éditeur dans le Creator
window.openEditorInCreator = function() {
  const COL_TO_TYPE = {
    'items':'item', 'items_sensible':'item',
    'mobs':'mob', 'mobs_secret':'mob',
    'personnages':'pnj',
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
      await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore({ ...gameplay, sensible: true }));
      // items_secret sert aussi de point d'ancrage pour le _contributor (créé même si vide)
      await setDoc(doc(db, COL.itemsSecret, String(dataId)), sanitizeForFirestore({ ...secret, _contributor: _contribField, sensible: true }));
      // Nettoyer toute version publique existante
      try { await deleteDoc(doc(db, COL.items, String(dataId))); } catch {}
      store.invalidate('items');
    } else if (sub.type === 'mob' && isSensible) {
      // Mob sensible → doc complet dans mobs_secret, jamais dans mobs
      const payload = { _order: Date.now(), _contributor: _contribField, ...sub.data, sensible: true };
      await setDoc(doc(db, COL.mobsSecret, String(dataId)), sanitizeForFirestore(payload));
      try { await deleteDoc(doc(db, COL.mobs, String(dataId))); } catch {}
      store.invalidate('mobs');
    } else {
      // Flux standard
      let dataToWrite = { _order: Date.now(), ...sub.data, _contributor: _contribField };
      // Panoplie : couleur par défaut si absente (définie par la modération côté liste)
      if (sub.type === 'panoplie' && !dataToWrite.color) dataToWrite.color = '#b87333';

      // Pour une modification : préserver l'ordre et les images du doc existant
      if (sub.isModification) {
        try {
          const existingSnap = await getDoc(doc(db, target, String(dataId)));
          if (existingSnap.exists()) {
            const existing = existingSnap.data();
            if (existing._order != null) dataToWrite._order = existing._order;
            if (existing.ordre  != null) dataToWrite.ordre  = existing.ordre;
            if (existing.images?.length) dataToWrite.images = existing.images;
            else if (existing.image)     dataToWrite.image  = existing.image;
          }
        } catch {}
      }

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
      const storeKey = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quest:'quetes', panoplie:'panoplies' }[sub.type];
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
let _mobCollapseInit   = false;

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
  'trash':          () => showTrash(),
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
  'data-all':         () => showDataAll(),
  'zones':              () => showZoneEditor(),
  'images':             () => showImagesTool(),
  'pnj-migration':        () => showPnjMigration(),
  'zone-list':            () => showZoneList(),
  'quest-map-migration':  () => showQuestMapMigration(),
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

const _COL_LABELS = { items:'Item', mobs:'Mob', personnages:'PNJ', regions:'Région', panoplies:'Panoplie', quetes:'Quête', items_sensible:'Item Sensible', map_markers:'Marqueur Carte' };

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
  const btnDel = document.getElementById('btn-delete-editor');
  if (btnDel) { btnDel.disabled = false; btnDel.textContent = '🗑️ Supprimer'; }

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
  if (_editorOrigin === 'allpins')         { showMapPanel(); switchMapTab('allpins'); return; }
  if (_editorOrigin === 'data-all')        { showDataAll();        return; }
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
      // Si le nom (donc le hash) a changé, supprimer l'ancien doc items_hidden (keyé par hash)
      if (hash !== _editorId) {
        try { await deleteDoc(doc(db, COL.itemsHidden, _editorId)); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore({ ...gameplay, sensible: true }));
      const itemId = String(newData.id || '');
      const oldItemId = String(_editorOrigData?.id || '');
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
      if (idx >= 0) _sensState.itemsHidden[idx] = { _id: hash, ...merged };
      else _sensState.itemsHidden.push({ _id: hash, ...merged });
      _editorId = hash;
      _editorOrigData = { ...newData };
      // Forcer rechargement propre du panel data-all (sinon affiche encore l'ancien hash)
      _dataAllLoaded = false;
      btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
      setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }, 2500);
      return;
    }

    // Renommage d'ID → recréer le document (toutes collections)
    const rawNewId = (newData.id != null ? String(newData.id).trim() : '');
    const newDocId = rawNewId || _editorId;

    const _editorContrib = _editorOrigData?._contributor || null;
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
      const contributor = existing._contributor || _editorContrib || _selfContrib;
      await setDoc(doc(db, _editorCollection, newDocId), { ...existing, ...newData, id: newDocId, ...( contributor ? { _contributor: contributor } : {}) });
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
      if (!_editorContrib && _selfContrib) patch._contributor = _selfContrib;
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
    const trashPayload = sanitizeForFirestore({
      originalCollection: _editorCollection,
      originalId: _editorId,
      deletedAt: serverTimestamp(),
      deletedBy: currentUser?.uid || null,
      deletedByName: _userNames.get(currentUser?.uid) || currentUser?.email || 'Inconnu',
      data: _editorOrigData || {}
    });
    try { await addDoc(collection(db, 'trash'), trashPayload); } catch(te) { console.warn('[Trash] Sauvegarde corbeille échouée:', te); }

    if (_editorCollection === 'items_sensible') {
      // Supprimer items_hidden (par hash). Pour items_secret (par publicId) : seulement
      // s'il n'existe pas d'autre items_hidden avec le même publicId (cas doublon),
      // sinon on priverait le sibling de ses données secrètes.
      await deleteDoc(doc(db, COL.itemsHidden, _editorId));
      const itemId = String(_editorOrigData?.id || '');
      if (itemId) {
        invalidateModCache(COL.itemsHidden);
        const remaining = await cachedDocs(COL.itemsHidden).catch(() => []);
        const hasSibling = remaining.some(d => d._docKey !== _editorId && String(d.id || '') === itemId);
        if (!hasSibling) {
          try { await deleteDoc(doc(db, COL.itemsSecret, itemId)); } catch {}
          invalidateModCache(COL.itemsSecret);
        }
      } else {
        invalidateModCache(COL.itemsHidden);
      }
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
      await setDoc(doc(db, COL.itemsHidden, targetId), sanitizeForFirestore(item.data || {}));
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

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost';
      delBtn.title = 'Supprimer tous les posts Discord de ce webhook';
      delBtn.style.cssText = 'font-size:11px;padding:5px 8px;flex-shrink:0;color:var(--danger);';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => deleteWebhookPosts(key, input.value.trim()));

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(testBtn);
      row.appendChild(delBtn);
      section.appendChild(row);
    }
    list.appendChild(section);
  }
}

window.deleteWebhookPosts = async function deleteWebhookPosts(key, url) {
  if (!url) { toast('⚠ Aucun webhook configuré pour ce palier', 'warning'); return; }
  if (!await modal.confirm(`Supprimer tous les posts Discord pour « ${key} » ?\n(supprime uniquement les messages sur Discord, les données Firestore sont conservées)`)) return;

  const match = url.match(/webhooks\/(\d+)\/([^/?]+)/);
  if (!match) { toast('⛔ URL webhook invalide', 'error'); return; }
  const [, whId, whToken] = match;

  const snap = await getDocs(collection(db, 'discord_posts'));
  console.log('[dwDelete] total docs:', snap.docs.length, snap.docs.map(d => d.data()));
  const posts = snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(p => p.webhookKey === key);
  console.log('[dwDelete] key filter:', key, '→ matched:', posts.length);

  if (!posts.length) {
    toast('Aucun post tracké pour ce webhook. Les posts envoyés avant l\'activation du tracking ne sont pas supprimables automatiquement.', 'warning');
    return;
  }

  const WORKER_URL = 'https://veilleurs.paulrobinpro49.workers.dev';
  const WORKER_SECRET = 's3+/M21~hZ$)';

  let deleted = 0, failed = 0;
  for (const post of posts) {
    try {
      // Supprimer le message webhook
      let delUrl = `https://discord.com/api/webhooks/${whId}/${whToken}/messages/${post.messageId}`;
      if (post.threadId) delUrl += `?thread_id=${post.threadId}`;
      const r = await fetch(delUrl, { method: 'DELETE' });
      if (!r.ok && r.status !== 404) {
        const body = await r.text().catch(() => '');
        const json = JSON.parse(body || '{}');
        if (json.code === 10003) {
          await deleteDoc(doc(db, 'discord_posts', post._id)).catch(() => {});
          deleted++; continue;
        }
        console.warn('[deleteWebhookPosts] message delete failed', r.status, body);
        failed++; continue;
      }
      // Supprimer le thread forum via Cloudflare Worker
      if (post.threadId) {
        const rt = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId: post.threadId, secret: WORKER_SECRET }),
        });
        if (!rt.ok) {
          const body = await rt.text().catch(() => '');
          console.warn('[deleteWebhookPosts] thread delete failed', rt.status, body);
        }
      }
      await deleteDoc(doc(db, 'discord_posts', post._id)).catch(() => {});
      deleted++;
    } catch(e) { console.error('[deleteWebhookPosts] error', e); failed++; }
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
    console.log('[dw-group]', sub.data?.name, '| sub.data.set:', sub.data?.set, '| liveItem.set:', liveItem?.set, '| setId:', setId);
    if (setId) {
      if (!setGroups.has(setId)) setGroups.set(setId, []);
      setGroups.get(setId).push(sub);
    } else {
      soloSubs.push(sub);
    }
  }
  console.log('[dw-group] setGroups:', [...setGroups.keys()], '| soloSubs:', soloSubs.length);

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

  // Grouper par set
  const setGroups = new Map();
  const soloItems = [];
  for (const item of items) {
    const setId = item.set || null;
    if (setId) {
      if (!setGroups.has(setId)) setGroups.set(setId, []);
      setGroups.get(setId).push(item);
    } else {
      soloItems.push(item);
    }
  }

  const total = soloItems.length + setGroups.size;
  let done = 0;

  for (const item of soloItems) {
    progText.textContent = `Envoi ${done + 1} / ${total} — ${item.name || ''}…`;
    progBar.style.width  = `${Math.round(done / total * 100)}%`;
    try {
      await _sendSingleItemDiscord(item);
    } catch(e) {
      toast(`⛔ Erreur pour « ${item.name} » : ${e.message}`, 'error');
    }
    done++;
    if (done < total) await new Promise(r => setTimeout(r, 1100));
  }

  for (const [setId, setItems] of setGroups) {
    const label = setItems[0].name || setId;
    progText.textContent = `Envoi ${done + 1} / ${total} — Set ${label}…`;
    progBar.style.width  = `${Math.round(done / total * 100)}%`;
    try {
      await _sendSetGroupItemsDiscord(setItems);
    } catch(e) {
      toast(`⛔ Erreur set « ${setId} » : ${e.message}`, 'error');
    }
    done++;
    if (done < total) await new Promise(r => setTimeout(r, 1100));
  }

  progBar.style.width  = '100%';
  progText.textContent = `✓ ${done} envoi${done>1?'s':''} réussi${done>1?'s':''} !`;
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
  const discordRes = await window.VCL.postDiscord(`${url}?wait=true`, payload, imgBlob, imgFname)
    .then(r => r.ok ? r.json() : null).catch(() => null);
  if (discordRes?.id && itemId) {
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_item_${itemId}`), {
        itemId: String(itemId), itemName: item.name || '', webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
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
  console.log('[saw] called, type:', sub.type, 'cat:', sub.data?.category, 'palier:', sub.data?.palier);
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

  const discordRes = await window.VCL.postDiscord(`${url}?wait=true`, payload, imgBlob, imgFname)
    .then(r => { console.log('[discord] status', r.status); return r.ok ? r.json() : r.text().then(t => { console.warn('[discord] body', t); return null; }); })
    .catch(e => { console.error('[discord] fetch error', e); return null; });
  console.log('[discord] discordRes', discordRes);
  console.log('[discord] id check:', discordRes?.id);
  if (discordRes?.id) {
    console.log('[discord] saving to firestore, key:', key, 'subId:', sub._id);
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_${sub._id}`), {
        subId: sub._id, subName: sub.data.name || '', webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
        sentAt: new Date().toISOString(),
      });
      console.log('[discord] firestore saved!');
    } catch(e) { console.warn('[discord] discord_posts save failed:', e); }
  }
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

  // Vérifier si un thread Discord existe déjà pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  // Discord : max 10 embeds par message
  let fetchUrl, payload;
  if (existingThreadId) {
    // Poster dans le thread existant (pas de thread_name, pas de applied_tags)
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = { embeds: embeds.slice(0, 10) };
  } else {
    // Créer un nouveau thread
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName, embeds: embeds.slice(0, 10) };
    const appliedTags = _resolveTagRules(first.data, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }

  let discordRes = null;
  if (files.length) {
    const p  = { ...payload, attachments: files.map((f, i) => ({ id: i, filename: f.fname })) };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    files.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
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

  const [itemNames, mobsPublic, mobsSecret, pnjs] = await Promise.all([
    _getItemNamesCache(),
    cachedDocs(COL.mobs),
    cachedDocs(COL.mobsSecret).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allMobs = [...mobsPublic, ...mobsSecret];

  const embeds = [];
  const files  = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { blob: imgBlob, fname: imgFname } = await _fetchItemImgBlob(item);
    const indexedFname = (imgBlob && imgFname)
      ? `image_${i}.${imgFname.split('.').pop() || 'png'}`
      : null;
    if (imgBlob && indexedFname) files.push({ blob: imgBlob, fname: indexedFname });

    const itemForEmbed = item.obtain ? { ...item, obtain:
      _enrichObtainWithPnjCoords(
        _enrichObtainWithMobChances(item.obtain, item.id, allMobs),
        pnjs)
    } : item;
    embeds.push(_buildApprovalEmbed(itemForEmbed, indexedFname, _dwConfig.embedFields || null, itemNames, null));
  }

  // Vérifier si thread existant pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  let fetchUrl, payload;
  if (existingThreadId) {
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = { embeds: embeds.slice(0, 10) };
  } else {
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName, embeds: embeds.slice(0, 10) };
    const appliedTags = _resolveTagRules(first, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }

  let discordRes = null;
  if (files.length) {
    const p  = { ...payload, attachments: files.map((f, i) => ({ id: i, filename: f.fname })) };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    files.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
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
  const tier = (isEvent || palier === 0) ? 'events' : (palier ? 'P' + palier : '');
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
      <span class="user-email" style="font-size:11px;color:var(--muted);">${escHtml(u.email || '—')}</span>
      <span class="user-role-badge" style="color:${roleColor[u.role] || 'var(--muted)'};">${escHtml(u.role || 'membre')}</span>
      <select class="user-role-sel" onchange="setUserRole('${escHtml(u.uid)}', this.value, this)">${sel}</select>
      <button class="btn btn-ghost" style="font-size:11px;padding:2px 8px;color:var(--danger);border-color:var(--danger);" onclick="deleteUserAccount('${escHtml(u.uid)}', '${escHtml(u.pseudo || u.uid)}')">🗑️</button>
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

window.deleteUserAccount = async (uid, pseudo) => {
  if (!confirm(`Supprimer le compte de « ${pseudo} » ?\n\nCela supprime uniquement le document Firestore (pas le compte Firebase Auth).`)) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
    _allUsers = _allUsers.filter(u => u.uid !== uid);
    renderUsers(_allUsers);
    toast(`Compte « ${pseudo} » supprimé.`, 'success');
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// ═══════════════════════════════════════════════════════
// LEADERBOARD — contributions approuvées par membre
// ═══════════════════════════════════════════════════════

const _LB_EXCLUDED_DOC = 'config/leaderboard_excluded';

const _LB_SCAN_COLS = [
  { col: COL.items,       type: 'item'     },
  { col: COL.itemsSecret, type: 'item'     },
  { col: COL.mobs,        type: 'mob'      },
  { col: COL.mobsSecret,  type: 'mob'      },
  { col: COL.pnj,         type: 'pnj'      },
  { col: 'regions',       type: 'region'   },
  { col: 'quetes',        type: 'quest'    },
  { col: 'panoplies',     type: 'panoplie' },
];

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
  const listEl   = document.getElementById('leaderboard-list');
  const detailEl = document.getElementById('leaderboard-user-detail');
  if (detailEl) detailEl.style.display = 'none';
  listEl.style.display = '';
  listEl.innerHTML = '<div class="empty">Chargement…</div>';

  let excludedIds = new Set();
  try {
    const exSnap = await getDoc(doc(db, 'config', 'leaderboard_excluded'));
    if (exSnap.exists()) excludedIds = new Set(exSnap.data().ids || []);
  } catch {}

  const byKey = {};
  for (const { col, type } of _LB_SCAN_COLS) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const data = d.data();
        const c = data._contributor;
        if (!c) continue;
        const entryId = col + '/' + d.id;
        if (excludedIds.has(entryId)) continue;
        const uid   = c.uid  || null;
        const cname = c.name || 'Inconnu';
        const key   = uid || ('__' + cname);
        if (!byKey[key]) byKey[key] = { uid, name: cname, subs: [] };
        byKey[key].subs.push({
          _id: entryId, _col: col, _docId: d.id, type,
          name: data.name || data.titre || data.label || d.id,
        });
      }
    } catch {}
  }

  // Resolve current pseudo for uid-based entries
  await Promise.all(
    Object.values(byKey)
      .filter(e => e.uid)
      .map(async e => {
        try {
          const snap = await getDoc(doc(db, COL.users, e.uid));
          if (snap.exists() && snap.data().pseudo) e.name = snap.data().pseudo;
        } catch {}
      })
  );

  // Merge anon entries ('__name') into uid entries with same name
  for (const anonKey of Object.keys(byKey)) {
    if (!anonKey.startsWith('__')) continue;
    const anonName = anonKey.slice(2);
    const uidEntry = Object.values(byKey).find(e => e.uid && e.name === anonName);
    if (uidEntry) {
      uidEntry.subs.push(...byKey[anonKey].subs);
      delete byKey[anonKey];
    }
  }

  console.log('[LB] byKey:', Object.fromEntries(Object.entries(byKey).map(([k,v]) => [k, { uid: v.uid, name: v.name, count: v.subs.length }])));

  const ranked = Object.values(byKey).sort((a, b) => b.subs.length - a.subs.length);
  listEl.innerHTML = '';
  if (ranked.length) {
    _renderLbRows(ranked, listEl, false);
  } else {
    listEl.innerHTML = '<div class="empty">Aucune contribution trouvée.</div>';
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
    const n = u.subs.length;
    titleEl.textContent = `${u.name} — ${n} contribution${n > 1 ? 's' : ''}`;
  };
  updateTitle();

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

// Formule d'image identique à creator.js / atelier.js (source de vérité partagée)
function _sensComputeImg(category, id, palier, isEvent) {
  if (!id) return null;
  const tier = (isEvent || palier === 0) ? 'events' : (palier ? 'P' + palier : '');
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
    case 'quete':       return `../img/compendium/textures/items/Quest/${tp}${id}.png`;
    case 'donjon':      return `../img/compendium/textures/items/Donjon/${tp}${id}.png`;
    case 'monnaie':     return `../img/compendium/textures/items/Monnaie/${tp}${id}.png`;
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

// Ouvre le bon éditeur pour un item public ou sensible depuis la liste "À compléter".
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
          <button class="btn btn-ghost btn-sm" onclick="_openItemForCompletion('${escHtml(editKey)}',${sens},'data-incomplete')" style="font-size:11px;">✏️ Éditer</button>
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
  const tier = (item.event || item.palier === 0) ? 'events' : (item.palier ? 'P' + item.palier : '');
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
        window.VCL.normalize(d.name||'').includes(norm) || (d.id||'').includes(norm)
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
    const col = _imgSelectedItem.sensible ? COL.itemsSecret : COL.items;
    const docId = _imgSelectedItem.sensible
      ? String(_imgSelectedItem.id || _imgSelectedItem._id || '')
      : String(_imgSelectedItem.id || '');
    if (docId) {
      try { await updateDoc(doc(db, col, docId), { images: [path] }); } catch {}
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
let _tpkGhMap     = new Map(); // lowercase basename → github path
let _tpkGhSha     = new Map(); // github path → sha (for blob API)
let _tpkGhInverse = new Map(); // github path → { url, matchType, tpkFile }
let _tpkManual    = new Map(); // tpk path → github path (manual links)
let _tpkLinkSrc   = null;     // tpk file being linked
let _tpkLeftVis   = [];
let _tpkLeftPage  = 0;        // index (pas page) dans _tpkLeftVis
let _tpkFolders   = {};       // folderPath → collapsed bool (panel droit)
let _tpkLeftFolders = {};     // folderPath → collapsed bool (panel gauche)
let _tpkVFolders    = {};     // basename → virtual folder name
let _tpkVFolderList = [];     // ordered list of virtual folder names (always includes 'inutile')
let _tpkVFCollapsed = {};     // virtual folder name → collapsed bool

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
    if (!_tpkVFolderList.includes('inutile')) _tpkVFolderList.unshift('inutile');
  } catch { _tpkVFolders = {}; _tpkVFolderList = ['inutile']; }
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
    _tpkGhMap.clear(); _tpkGhFiles = []; _tpkGhSha.clear();
    (data.tree || []).forEach(node => {
      if (node.type !== 'blob') return;
      const low = node.path.toLowerCase();
      if (!low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.jpeg')) return;
      const base = node.path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
      _tpkGhMap.set(base, node.path);
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
  _tpkGhMap.clear(); _tpkGhFiles = [];
  await _tpkFetchGhTree();
  _tpkApplyMatch();
  tpkRender();
};

// ── Matching (auto + manuel) ─────────────────────────────────────────────────

function _tpkApplyMatch() {
  _tpkGhInverse.clear();
  for (const f of _tpkFiles) {
    const manual = _tpkManual.get(f.basename);
    const auto   = _tpkGhMap.get(f.basename);
    if (manual === '__none__') {
      // Blacklisté : faux positif confirmé par hash visuel
      f.githubPath = null; f.matchType = null;
    } else if (manual) {
      f.githubPath = manual; f.matchType = 'manual';
      _tpkGhInverse.set(manual, { url: f.url, matchType: 'manual', tpkFile: f });
    } else if (auto && !_tpkGhInverse.has(auto)) {
      f.githubPath = auto; f.matchType = 'auto';
      _tpkGhInverse.set(auto, { url: f.url, matchType: 'auto', tpkFile: f });
    } else {
      f.githubPath = null; f.matchType = null;
    }
  }
}

// ── Animation thumbnails (boucle RAF partagée) ───────────────────────────────

let _tpkAnimCells = []; // { type, cvs, img/imgs, w, h, vert, frames, frame, interval, lastTick }
let _tpkAnimRAF   = null;

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

// ── Rendu gauche (grille) ────────────────────────────────────────────────────

window.tpkRender = function() {
  _tpkStopAnimLoop();
  const q = (document.getElementById('tpk-search')?.value || '').toLowerCase();
  const unmatchedAll = _tpkFiles.filter(f => !f.githubPath && (!q || f.path.toLowerCase().includes(q)));
  const unmatched = unmatchedAll.filter(f => !_tpkVFolders[f.basename]);
  unmatched.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0) || a.path.localeCompare(b.path));

  // Grouper les paires base + _e, puis classer par dossier
  const baseMap = new Map(unmatched.map(f => [f.basename, f]));
  const paired  = new Set();
  const rawEntries = [];
  for (const f of unmatched) {
    if (paired.has(f)) continue;
    const eFile = baseMap.get(f.basename + '_e');
    if (eFile && !paired.has(eFile)) {
      paired.add(f); paired.add(eFile);
      rawEntries.push({ pair: [f, eFile] });
    } else if (f.basename.endsWith('_e')) {
      const base = baseMap.get(f.basename.slice(0, -2));
      if (base && !paired.has(base)) {
        paired.add(f); paired.add(base);
        rawEntries.push({ pair: [base, f] });
      } else {
        rawEntries.push({ single: f });
      }
    } else {
      rawEntries.push({ single: f });
    }
  }

  // Grouper par dossier ZIP
  const byFolder = new Map();
  for (const entry of rawEntries) {
    const f = entry.pair ? entry.pair[0] : entry.single;
    const parts = f.path.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(entry);
  }
  _tpkLeftVis = [];
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

  const leftEl = document.getElementById('tpk-left');
  const leftMore = document.getElementById('tpk-left-more');
  if (leftEl) leftEl.innerHTML = '';
  if (leftMore) leftMore.style.display = 'none';
  _tpkLeftPage = 0;
  tpkLeftMore();
  _tpkRenderTree(q);
  _tpkRenderVFolders();
};

window.tpkLeftMore = function() {
  const el  = document.getElementById('tpk-left');
  const btn = document.getElementById('tpk-left-more');
  if (!el) return;
  let shown = 0;
  while (_tpkLeftPage < _tpkLeftVis.length && shown < TPK_PAGE) {
    const entry = _tpkLeftVis[_tpkLeftPage++];
    if (entry.folder !== undefined) {
      el.appendChild(_tpkMakeFolderHeaderLeft(entry));
    } else {
      el.appendChild(entry.pair ? _tpkMakePairCell(entry.pair[0], entry.pair[1]) : _tpkMakeLeftCell(entry.single));
      shown++;
    }
  }
  if (btn) btn.style.display = _tpkLeftPage < _tpkLeftVis.length ? '' : 'none';
};

function _tpkMakeFolderHeaderLeft(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:5px;padding:5px 3px 3px;margin-top:4px;border-top:1px solid var(--border);font-size:10px;color:var(--muted);cursor:pointer;user-select:none;';
  div.innerHTML = `<span style="font-size:9px;opacity:.55;">${entry.collapsed ? '▶' : '▼'}</span><span>📁 ${escHtml(entry.folder)}</span><span style="opacity:.4;">(${entry.count})</span>`;
  div.addEventListener('click', () => {
    _tpkLeftFolders[entry.folder] = !entry.collapsed;
    tpkRender();
  });
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
    const icon = folderName === 'inutile' ? '🚫' : '📁';
    header.innerHTML = `<span style="font-size:9px;opacity:.55;">${collapsed ? '▶' : '▼'}</span><span>${icon} ${escHtml(folderName)}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">(${folderFiles.length})</span>`;
    header.addEventListener('click', () => {
      _tpkVFCollapsed[folderName] = !collapsed;
      _tpkRenderVFolders();
    });

    if (folderName !== 'inutile') {
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
    const icon = name === 'inutile' ? '🚫' : '📁';
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
  if (folderName === 'inutile') return;
  for (const k of Object.keys(_tpkVFolders)) {
    if (_tpkVFolders[k] === folderName) delete _tpkVFolders[k];
  }
  _tpkVFolderList = _tpkVFolderList.filter(n => n !== folderName);
  _tpkSaveVFolders();
  tpkRender();
};

// Détecte le type de texture d'un fichier pour le rendu dans la grille
function _tpkDetectType(f) {
  const W = f._w, H = f._h;
  if (!W || !H) return 'normal';
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
  const name = f.path.split('/').pop();
  const selected = _tpkLinkSrc === f;
  const border = selected ? 'var(--warn)' : f.isNew ? 'var(--accent)' : 'var(--border)';
  const bg     = selected ? 'color-mix(in srgb,var(--warn) 15%,var(--surface2))'
                          : f.isNew ? 'color-mix(in srgb,var(--accent) 10%,var(--surface2))' : 'var(--surface2)';
  const cell = document.createElement('div');
  cell.title = f.path;
  cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:6px;border:2px solid ${border};background:${bg};position:relative;`;
  cell.appendChild(_tpkMakeThumbCanvas(f, 52));
  cell.insertAdjacentHTML('beforeend', `
    <span style="font-size:9px;color:var(--muted);word-break:break-all;text-align:center;line-height:1.2;max-width:68px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(name)}</span>
    ${f.isNew ? '<span style="font-size:8px;color:var(--accent);font-weight:700;">NEW</span>' : ''}`);
  const linkBtn = document.createElement('button');
  linkBtn.textContent = '🔗';
  linkBtn.title = selected ? 'Annuler liaison' : 'Lier manuellement à un fichier GitHub';
  linkBtn.style.cssText = `position:absolute;top:2px;right:2px;background:${selected ? 'var(--warn)' : 'rgba(0,0,0,.35)'};border:none;border-radius:3px;color:#fff;font-size:9px;padding:1px 3px;cursor:pointer;line-height:1.4;`;
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
window.runMigrateOcculteIds = async function() {
  if (!await modal.confirm(
    'Pour les 12 items occultes ciblés (liste explicite, PNJs non concernés) :\n' +
    ' • renomme les IDs en ajoutant "_p{palier}" si pas déjà fait\n' +
    ' • ajoute le booléen occulte: true s\'il manque\n\n' +
    'Cette opération est IRRÉVERSIBLE. Continuer ?'
  )) return;

  const btn = document.getElementById('btn-migrate-occulte');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Migration…'; }

  try {
    // Charger tous les items (public + sensible)
    const [pubDocs, hidDocs] = await Promise.all([
      cachedDocs(COL.items),
      cachedDocs(COL.itemsHidden).catch(() => []),
    ]);
    const allItems = [
      ...pubDocs.map(d => ({ ...d, _col: COL.items })),
      ...hidDocs.map(d => ({ ...d, _col: COL.itemsHidden })),
    ];

    // Liste explicite des IDs à flagger (PNJs en collection personnages
    // ne sont pas concernés — on ne lit que items / items_hidden)
    const OCCULTE_TARGET_IDS = new Set([
      'amulette_occulte_p1',
      'anneau_occulte_p1',
      'anneau_occulte_p2',
      'bracelet_occulte_p1',
      'bracelet_occulte_p2',
      'capuche_occulte_p1',
      'crane_occulte_p1',
      'gants_occultes_p1',
      'parchemin_occulte_p2',
      'poignard_occulte_p2',
      'robe_occulte_p1',
      'sablier_occulte_p2',
    ]);
    const occulteItems = allItems.filter(it => {
      const id = String(it.id || it._id || '');
      return OCCULTE_TARGET_IDS.has(id);
    });

    if (!occulteItems.length) {
      toast('✓ Aucun item occulte trouvé.', 'success');
      return;
    }

    const log = [];
    let renamedCount = 0;
    let flaggedCount = 0;
    for (const item of occulteItems) {
      const oldId = item.id || item._id || '';
      // docKey = clé Firestore réelle. Pour items_hidden c'est le hash du nom (≠ publicId).
      // Pour items, c'est le publicId.
      const docKey = item._docKey || oldId;
      const palier = item.palier;
      const idNeedsRename = !/_p[123]$/.test(oldId);
      const flagNeedsAdd  = item.occulte !== true;

      if (!idNeedsRename && !flagNeedsAdd) continue;

      try {
        if (idNeedsRename) {
          if (!palier) { log.push(`⚠️ ${oldId} — palier manquant, ignoré`); continue; }
          const newId = `${oldId}_p${palier}`;
          const payload = { ...item, id: newId, occulte: true };
          delete payload._col; delete payload._id; delete payload._docKey;

          if (item._col === COL.itemsHidden) {
            // items_hidden est keyé par hash : on n'écrit/supprime QUE via docKey,
            // jamais via publicId (sinon on crée un doc parasite)
            await setDoc(doc(db, item._col, docKey), sanitizeForFirestore(payload));
            // items_secret est keyé par publicId : renommer oldId → newId
            try {
              const secSnap = await getDoc(doc(db, COL.itemsSecret, oldId));
              if (secSnap.exists()) {
                await setDoc(doc(db, COL.itemsSecret, newId), secSnap.data());
                await deleteDoc(doc(db, COL.itemsSecret, oldId));
              }
            } catch {}
          } else {
            // items : la clé EST le publicId, donc rename = setDoc(newId) + deleteDoc(oldId)
            await setDoc(doc(db, item._col, newId), sanitizeForFirestore(payload));
            await deleteDoc(doc(db, item._col, oldId));
          }
          renamedCount++;
          if (flagNeedsAdd) flaggedCount++;
          log.push(`✓ ${oldId} → ${newId} (+ occulte: true)`);
        } else {
          // ID déjà bon, on ajoute juste le booléen — utiliser docKey (hash pour items_hidden)
          await updateDoc(doc(db, item._col, docKey), { occulte: true });
          flaggedCount++;
          log.push(`✓ ${oldId} (+ occulte: true)`);
        }
        store.invalidate('items');
        invalidateModCache(item._col);
      } catch(e) {
        log.push(`⛔ ${oldId} : ${e.message}`);
      }
    }

    if (!renamedCount && !flaggedCount) {
      toast('✓ Tous les items occultes sont déjà à jour.', 'success');
      return;
    }

    const summary = `Migration terminée : ${renamedCount} renommage(s), ${flaggedCount} ajout(s) du flag\n\n${log.join('\n')}`;
    await modal.confirm(summary);
    toast(`✓ ${renamedCount} renommé(s), ${flaggedCount} flagué(s)`, 'success');
  } catch(e) {
    toast('⛔ Erreur migration : ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔑 Migration IDs Occultes'; }
  }
};

// ── Backfill flag sensible ─────────────────────────
// Ajoute sensible: true à tous les docs des collections "secrètes"
// (items_hidden, items_secret, mobs_secret) qui ne l'ont pas.
window.runBackfillSensibleFlag = async function() {
  if (!await modal.confirm(
    'Ajoute sensible: true à tous les docs de items_hidden, items_secret et mobs_secret qui ne l\'ont pas.\n\nContinuer ?'
  )) return;

  const btn = document.getElementById('btn-backfill-sensible');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Backfill…'; }

  try {
    const targets = [COL.itemsHidden, COL.itemsSecret, COL.mobsSecret];
    let updated = 0;
    let alreadyOk = 0;
    const log = [];
    for (const colName of targets) {
      let docs;
      try { docs = await cachedDocs(colName); }
      catch(e) { log.push(`⛔ ${colName} : ${e.message}`); continue; }
      for (const d of docs) {
        if (d.sensible === true) { alreadyOk++; continue; }
        // _docKey = clé Firestore réelle (hash pour items_hidden, publicId ailleurs)
        const docKey = d._docKey || d.id;
        try {
          await updateDoc(doc(db, colName, docKey), { sensible: true });
          updated++;
        } catch(e) {
          log.push(`⛔ ${colName}/${docKey} : ${e.message}`);
        }
      }
      invalidateModCache(colName);
    }
    const summary = `Backfill terminé : ${updated} doc(s) mis à jour, ${alreadyOk} déjà OK.${log.length ? '\n\n' + log.join('\n') : ''}`;
    await modal.confirm(summary);
    toast(`✓ ${updated} doc(s) mis à jour`, 'success');
  } catch(e) {
    toast('⛔ Erreur backfill : ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔒 Backfill flag sensible'; }
  }
};

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
  _setHash('map');
  _showPanel('map-panel', 'btn-map-order');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  switchMapTab('markers');
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
      <td style="font-weight:600;">${m.color ? `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${m.color};margin-right:5px;vertical-align:middle;"></span>` : ''}${m.name || '—'}</td>
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
      document.getElementById('map-form-color').value = m.color || '#444444';
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
    document.getElementById('map-form-color').value   = '#444444';
  }
  onMapFormTypeChange();
  formEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.closeMapMarkerForm = function closeMapMarkerForm() {
  document.getElementById('map-marker-form').style.display = 'none';
};

window.onMapFormTypeChange = function onMapFormTypeChange() {
  const t = document.getElementById('map-form-type').value;
  document.getElementById('map-form-donjon-fields').style.display = t === 'donjon' ? '' : 'none';
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

  const colorVal = document.getElementById('map-form-color').value;
  const obj = {
    type,
    floor,
    name,
    desc:  document.getElementById('map-form-desc').value.trim() || null,
    link:  document.getElementById('map-form-link').value.trim() || null,
    gx:    gxVal !== '' ? parseFloat(gxVal) : null,
    gy:    gyVal !== '' ? parseFloat(gyVal) : null,
    color: colorVal !== '#444444' ? colorVal : null,
  };

  if (type === 'donjon') {
    const lvl = document.getElementById('map-form-level').value.trim();
    if (lvl) obj.level = lvl;
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
    ? `img/maps/floor-${_zeFloor}_underground.png`
    : `img/maps/floor-${_zeFloor}.png`;
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
  { key: 'evolutif',  label: '🔄 Évolutif',    types: ['item'],           filter: d => d.evolutif === true },
  { key: 'event',     label: '🎊 Event',        types: ['item'],           filter: d => d.event === true },
  { key: 'sensible',  label: '🔒 Sensible',     types: ['item','mob'],     filter: d => d.sensible === true },
  { key: 'boss',      label: '💀 Boss',         types: ['mob'],            filter: d => d.type === 'boss' },
  { key: 'miniboss',  label: '⚔️ Mini-Boss',   types: ['mob'],            filter: d => d.type === 'miniboss' },
  { key: 'codex',     label: '📖 Codex',        types: ['mob','region'],   filter: d => d.codex === true },
  { key: 'sans_lore', label: '📖 Sans lore',    types: ['item','mob'],     filter: d => !d.lore },
  { key: 'avec_craft',label: '🔨 Avec craft',   types: ['item'],           filter: d => Array.isArray(d.craft) && d.craft.length > 0 },
  { key: 'avec_evo',  label: '🔀 Avec évolutions', types: ['item'],        filter: d => Array.isArray(d.evolutions) && d.evolutions.length > 0 },
  { key: 'no_palier', label: '❓ Sans palier',  types: ['item','mob','pnj','region','quest'], filter: d => !d.palier },
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
  const typeVal = document.getElementById('data-all-type')?.value || '';
  const catSel  = document.getElementById('data-all-category');
  if (catSel) catSel.style.display = (typeVal === 'item') ? '' : 'none';
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

window.renderDataAll = function() {
  if (!_dataAllLoaded) return;
  const listEl    = document.getElementById('data-all-list');
  const countEl   = document.getElementById('data-all-count');
  if (!listEl) return;

  const searchQ    = normalize((document.getElementById('data-all-search')?.value || '').trim());
  const typeFilter = document.getElementById('data-all-type')?.value   || '';
  const palierFilter = document.getElementById('data-all-palier')?.value || '';
  const catFilter  = document.getElementById('data-all-category')?.value || '';
  const sortBy     = document.getElementById('data-all-sort')?.value    || 'name';

  let results = _dataAllData;

  if (typeFilter)   results = results.filter(d => d._type === typeFilter);
  if (palierFilter) results = results.filter(d => String(d.palier) === palierFilter);
  if (catFilter)    results = results.filter(d => d.category === catFilter);
  if (searchQ)      results = results.filter(d =>
    normalize(d.name || '').includes(searchQ) ||
    normalize(d.id   || '').includes(searchQ)
  );

  for (const flagKey of _dataAllFlagSet) {
    const def = _DATA_ALL_FLAGS.find(f => f.key === flagKey);
    if (def) results = results.filter(d => def.filter(d));
  }

  // Sort
  results = [...results];
  if (sortBy === 'name')   results.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  else if (sortBy === 'palier') results.sort((a, b) => (a.palier || 9) - (b.palier || 9) || (a.name || '').localeCompare(b.name || '', 'fr'));
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

    if (d.palier) _daAddBadge(badgesEl, 'P'+d.palier, 'var(--accent)', 'rgba(122,90,248,.15)');
    if (d.category) _daAddBadge(badgesEl, d.category, 'var(--muted)', 'transparent');
    if (d.evolutif)            _daAddBadge(badgesEl, '🔄', '#60a5fa', 'rgba(96,165,250,.1)');
    if (d.event)               _daAddBadge(badgesEl, '🎊', '#a855f7', 'rgba(168,85,247,.1)');
    if (d.sensible)            _daAddBadge(badgesEl, '🔒', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'boss')     _daAddBadge(badgesEl, 'Boss', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'miniboss') _daAddBadge(badgesEl, 'Mini', '#f59e0b', 'rgba(245,158,11,.1)');
    if (d.codex)               _daAddBadge(badgesEl, 'Codex', '#4ade80', 'rgba(74,222,128,.1)');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
    editBtn.textContent = '✏️';
    editBtn.title = 'Éditer dans le panneau';
    editBtn.onclick = () => showEditor(
      d.sensible ? 'items_sensible' : (d._col || COL_MAP[d._type] || d._type),
      d.sensible ? (d._docKey || d.id) : d.id,    // items sensibles : passer le hash (clé Firestore), pas le publicId
      d, 'data-all'
    );

    row.appendChild(nameEl);
    row.appendChild(idEl);
    row.appendChild(badgesEl);
    row.appendChild(editBtn);
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

// ══════════════════════════════════════════════════════
// MIGRATION PNJ TYPES
// ══════════════════════════════════════════════════════

const PNJ_MIG_TYPES = [
  // Craft
  "forgeron d'armes", "forgeron d'armures", "forgeron d'accessoires",
  "forgeron de lingots", "forgeron de clés",
  // Artisans
  "alchimiste", "bûcheron", "refaçonneur",
  // Commerce
  "repreneur de butin", "repreneur d'armes", "marchand itinérant",
  "marchand d'équipement", "marchand de consommable", "marchand d'outils",
  "marchand d'accessoires", "marchand occulte",
  // Autres
  "fabricant secret", "autres",
  // Quêtes
  "quête principale", "quête secondaire", "quête tertiaire",
  "donjon",
];

let _pnjMigList    = [];
let _pnjMigChanges = {};

window.showPnjMigration = function showPnjMigration() {
  _setHash('pnj-migration');
  _showPanel('pnj-migration-panel', 'btn-pnj-migration');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  loadPnjMigration();
};

window.loadPnjMigration = async function loadPnjMigration() {
  const tableEl = document.getElementById('pnjmig-table');
  tableEl.innerHTML = '<div class="empty">Chargement…</div>';
  _pnjMigChanges = {};
  _pnjmigUpdateSaveBtn();
  try {
    const snap = await getDocs(collection(db, COL.pnj));
    _pnjMigList = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    renderPnjMigration();
  } catch (err) {
    tableEl.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.renderPnjMigration = function renderPnjMigration() {
  const tableEl  = document.getElementById('pnjmig-table');
  const filter   = document.getElementById('pnjmig-filter')?.value || 'all';
  const searchQ  = (document.getElementById('pnjmig-search')?.value || '').toLowerCase();
  const knownSet = new Set(PNJ_MIG_TYPES);

  const filtered = _pnjMigList.filter(p => {
    const type    = (p.type || '').toLowerCase().trim();
    const hasMissing = !type;
    const hasUnknown = type && !knownSet.has(type);
    if (filter === 'missing' && !hasMissing) return false;
    if (filter === 'unknown' && !hasUnknown) return false;
    if (searchQ && !(p.name || '').toLowerCase().includes(searchQ)) return false;
    return true;
  });

  document.getElementById('pnjmig-count').textContent = `${filtered.length} PNJ`;

  if (!filtered.length) {
    tableEl.innerHTML = '<div class="empty">Aucun PNJ correspondant</div>';
    return;
  }

  const rows = filtered.map(p => {
    const currentType = _pnjMigChanges[p._id] !== undefined
      ? _pnjMigChanges[p._id]
      : (p.type || '');
    const isModified  = _pnjMigChanges[p._id] !== undefined;
    const isUnknown   = currentType && !new Set(PNJ_MIG_TYPES).has(currentType.toLowerCase());

    const options = ['', ...PNJ_MIG_TYPES].map(t =>
      `<option value="${t}" ${currentType === t ? 'selected' : ''}>${t || '— aucun —'}</option>`
    ).join('');

    const rowStyle = isModified ? 'background:rgba(245,158,11,0.12);' : '';
    const badge    = isUnknown  ? `<span style="font-size:10px;color:#f59e0b;margin-left:4px;">[inconnu]</span>` : '';

    return `<tr style="${rowStyle}">
      <td style="padding:6px 8px;font-weight:600;font-size:13px;">${p.name || p._id}${badge}</td>
      <td style="padding:6px 8px;font-size:12px;color:var(--muted);">${p.palier ? `Palier ${p.palier}` : '—'}</td>
      <td style="padding:6px 8px;font-size:12px;color:var(--muted);">${p.region || '—'}</td>
      <td style="padding:6px 8px;">
        <select style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:12px;outline:none;${isModified?'border-color:#f59e0b;':''}"
                data-pnj-id="${p._id}" onchange="pnjMigSetType(this)">
          ${options}
        </select>
      </td>
    </tr>`;
  }).join('');

  tableEl.innerHTML = `
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <thead>
        <tr style="font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);border-bottom:1px solid var(--border);">
          <th style="text-align:left;padding:6px 8px;">Nom</th>
          <th style="text-align:left;padding:6px 8px;">Palier</th>
          <th style="text-align:left;padding:6px 8px;">Région</th>
          <th style="text-align:left;padding:6px 8px;">Type</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
};

window.pnjMigSetType = function pnjMigSetType(sel) {
  const id      = sel.dataset.pnjId;
  const newType = sel.value;
  const p       = _pnjMigList.find(x => x._id === id);
  if (!p) return;
  if (newType === (p.type || '')) {
    delete _pnjMigChanges[id];
  } else {
    _pnjMigChanges[id] = newType;
  }
  sel.style.borderColor = _pnjMigChanges[id] !== undefined ? '#f59e0b' : '';
  const tr = sel.closest('tr');
  if (tr) tr.style.background = _pnjMigChanges[id] !== undefined ? 'rgba(245,158,11,0.12)' : '';
  _pnjmigUpdateSaveBtn();
};

function _pnjmigUpdateSaveBtn() {
  const btn = document.getElementById('pnjmig-save-btn');
  if (!btn) return;
  const count = Object.keys(_pnjMigChanges).length;
  btn.disabled = count === 0;
  btn.textContent = count > 0 ? `💾 Sauvegarder (${count} modification${count > 1 ? 's' : ''})` : '💾 Sauvegarder les modifications';
}

window.savePnjMigration = async function savePnjMigration() {
  const ids = Object.keys(_pnjMigChanges);
  if (!ids.length) return;
  const btn = document.getElementById('pnjmig-save-btn');
  btn.disabled = true;
  btn.textContent = '⏳ Sauvegarde…';
  let ok = 0, fail = 0;
  for (const id of ids) {
    try {
      await setDoc(doc(db, COL.pnj, id), { type: _pnjMigChanges[id] }, { merge: true });
      const p = _pnjMigList.find(x => x._id === id);
      if (p) p.type = _pnjMigChanges[id];
      delete _pnjMigChanges[id];
      ok++;
    } catch {
      fail++;
    }
  }
  if (fail === 0) {
    toast(`✓ ${ok} PNJ mis à jour`, 'success');
    delete _modCache['personnages'];
    invalidateCache(COL.pnj);
  } else {
    toast(`⚠️ ${ok} OK, ${fail} erreurs`, 'warn');
    if (ok > 0) invalidateCache(COL.pnj);
  }
  _pnjmigUpdateSaveBtn();
  renderPnjMigration();
};

/* ══════════════════════════════════════════════════════
   DONJONS — Normalisation des IDs (m1d2 → nom_du_donjon)
══════════════════════════════════════════════════════ */

window.renameDonjonIds = async function renameDonjonIds() {
  const btn = document.getElementById('btn-rename-donjon-ids');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ En cours…'; }
  try {
    const snap = await getDocs(collection(db, COL.donjons));
    const oldIdPattern = /^m\d+d\d+/;
    const toRename = snap.docs.filter(d => oldIdPattern.test(d.id));
    if (!toRename.length) {
      toast('✓ Tous les IDs sont déjà normalisés', 'success');
      if (btn) { btn.disabled = false; btn.textContent = '🔧 Normaliser IDs donjons'; }
      return;
    }
    let ok = 0;
    for (const d of toRename) {
      const data = d.data();
      const newId = normalize(data.name || d.id)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      if (!newId || newId === d.id) continue;
      await setDoc(doc(db, COL.donjons, newId), data);
      await deleteDoc(doc(db, COL.donjons, d.id));
      ok++;
    }
    invalidateCache(COL.donjons);
    toast('✓ ' + ok + ' IDs normalisés', 'success');
    if (btn) { btn.style.display = 'none'; }
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '🔧 Normaliser IDs donjons'; }
  }
};

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
  saveBtn.style.cssText = 'background:var(--accent);color:#fff;font-size:12px;';
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
    if (!confirm('Supprimer la zone "' + (zone.name || zone._id) + '" ? Cette action est irréversible.')) return;
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

let _allPinsList = [];
let _pinColors   = {};

window.switchMapTab = function switchMapTab(tab) {
  ['markers', 'allpins', 'colors', 'emojis'].forEach(t => {
    const div = document.getElementById('map-tab-' + t);
    const btn = document.getElementById('map-tab-btn-' + t);
    const active = t === tab;
    if (div) div.style.display = active ? '' : 'none';
    if (btn) {
      btn.style.background = active ? 'var(--accent)' : 'transparent';
      btn.style.color      = active ? '#fff'          : 'var(--muted)';
    }
  });
  const hdr = document.getElementById('map-header-btns');
  if (hdr) hdr.style.display = tab === 'markers' ? '' : 'none';

  if (tab === 'allpins') loadAllMapPins();
  if (tab === 'colors')  loadPinColors();
  if (tab === 'emojis')  loadPinEmojis();
};

window.loadAllMapPins = async function loadAllMapPins() {
  const el = document.getElementById('all-pins-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [pnjSnap, mobSnap, markerSnap] = await Promise.all([
      getDocs(collection(db, COL.pnj)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.mapMarkers)),
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
  "forgeron d'accessoires":  "craft_accessoires",
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
  "marchand occulte":        "marchand_occulte",
  "fabricant secret":        "autre",
  "autres":                  "autre",
};

const _AP_TYPE_LABELS = {
  région: 'Région', donjon: 'Donjon', boss: 'Boss', mini_boss: 'Mini-Boss', zone_monstre: 'Zone Monstres',
  quête_principale: 'Quête Principale', quête_secondaire: 'Quête Secondaire', quête_tertiaire: 'Quête Tertiaire',
  craft_armes: "Forgeron d'Armes", craft_armures: "Forgeron d'Armures",
  craft_accessoires: "Forgeron d'Accessoires", craft_lingots: 'Forgeron de Lingots', craft_cles: 'Forgeron de Clés',
  alchimiste: 'Alchimiste', bucheron: 'Bûcheron', refaconneur: 'Refaçonneur',
  repreneur_butin: 'Repreneur de Butin', repreneur_armes: "Repreneur d'Armes",
  marchand_itinerant: 'Marchand Itinérant', marchand_equipement: "Marchand d'Équipement",
  marchand_consommable: 'Marchand de Consommable', marchand_outils: "Marchand d'Outils",
  marchand_access: "Marchand d'Accessoires", marchand_occulte: 'Marchand Occulte', autre: 'Autre',
};

function _apGetFloor(p) { return p._source === 'pnj' ? p.palier : (p.floor ?? p.palier); }
function _apGetType(p) {
  if (p._source === 'pnj')    return _AP_PNJ_TO_TYPE[(p.type || '').toLowerCase()] || 'autre';
  if (p._source === 'mob')    return 'boss';
  return p.type || 'autre';
}
function _apGetGx(p) { return p.coords?.x ?? p.gx; }
function _apGetGy(p) { return p.coords?.z ?? p.gy; }

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

  const SOURCE_LABELS = { pnj: 'PNJ', mob: 'Mob', marker: 'Marqueur' };
  const frag = document.createDocumentFragment();

  for (const floor of Object.keys(byFloor).sort((a, b) => +a - +b)) {
    const floorHdr = document.createElement('div');
    floorHdr.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    floorHdr.textContent = 'Palier ' + floor;
    frag.appendChild(floorHdr);

    for (const type of Object.keys(byFloor[floor]).sort()) {
      const pins = byFloor[floor][type];
      const pinColor = _pinColors[type] || null;

      const typeHdr = document.createElement('div');
      typeHdr.style.cssText = 'font-size:10px;font-weight:600;color:var(--accent);margin:8px 0 4px;display:flex;align-items:center;gap:6px;';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-block;width:10px;height:10px;border-radius:50%;background:${pinColor || 'var(--muted)'};flex-shrink:0;`;
      typeHdr.appendChild(dot);
      typeHdr.appendChild(Object.assign(document.createElement('span'), {
        innerHTML: (_AP_TYPE_LABELS[type] || type) + ` <span style="color:var(--muted);font-weight:400;">(${pins.length})</span>`,
      }));
      frag.appendChild(typeHdr);

      const AP_COL = { pnj: 'personnages', mob: 'mobs', marker: 'map_markers' };
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
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
          <td style="padding:4px 6px;font-weight:500;">${p.name || p._id || '—'}</td>
          <td style="text-align:center;padding:4px 6px;"></td>
          <td style="text-align:center;padding:4px 6px;color:var(--muted);">${SOURCE_LABELS[p._source] || p._source}</td>
          <td style="text-align:center;padding:4px 6px;font-family:monospace;font-size:11px;color:var(--muted);">${gx != null ? gx + ' / ' + gy : '—'}</td>
          <td style="padding:4px 6px;text-align:right;"></td>
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

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost btn-sm ed-edit-btn';
        editBtn.style.cssText = 'font-size:11px;padding:2px 8px;';
        editBtn.textContent = '✏️ Éditer';
        editBtn.addEventListener('click', e => {
          e.stopPropagation();
          showEditor(AP_COL[p._source] || 'personnages', p._id, p, 'allpins');
        });
        tr.querySelector('td:last-child').appendChild(editBtn);
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
    const snap = await getDoc(doc(db, 'config', 'pin_type_colors'));
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

  const CATEGORIES = [
    { label: '🗺️ Principaux',    types: ['donjon', 'boss', 'mini_boss', 'zone_monstre'] },
    { label: '💬 Quêtes',         types: ['quête_principale', 'quête_secondaire', 'quête_tertiaire'] },
    { label: '⚒️ Forge / Craft',  types: ['craft_armes', 'craft_armures', 'craft_accessoires', 'craft_lingots', 'craft_cles'] },
    { label: '🧪 Artisans',       types: ['alchimiste', 'bucheron', 'refaconneur'] },
    { label: '🛒 Commerce',       types: ['repreneur_butin', 'repreneur_armes', 'marchand_itinerant', 'marchand_equipement', 'marchand_consommable', 'marchand_outils', 'marchand_access', 'marchand_occulte'] },
    { label: '🦠 Autres',         types: ['autre'] },
  ];

  const DEFAULT_COLORS = {
    donjon: '#ef4444', boss: '#dc2626', mini_boss: '#f97316', zone_monstre: '#fb923c',
    quête_principale: '#f59e0b', quête_secondaire: '#10b981', quête_tertiaire: '#06b6d4',
    craft_armes: '#8b5cf6', craft_armures: '#7c3aed', craft_accessoires: '#a78bfa',
    craft_lingots: '#6d28d9', craft_cles: '#4c1d95',
    alchimiste: '#34d399', bucheron: '#65a30d', refaconneur: '#a16207',
    repreneur_butin: '#f59e0b', repreneur_armes: '#b45309',
    marchand_itinerant: '#eab308', marchand_equipement: '#ca8a04',
    marchand_consommable: '#84cc16', marchand_outils: '#16a34a',
    marchand_access: '#0891b2', marchand_occulte: '#7c3aed',
    autre: '#6b7280',
  };

  const frag = document.createDocumentFragment();
  for (const cat of CATEGORIES) {
    const catHdr = document.createElement('div');
    catHdr.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    catHdr.textContent = cat.label;
    frag.appendChild(catHdr);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';

    for (const type of cat.types) {
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
      grid.appendChild(row);
    }
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
  marchand_access: '💍', marchand_occulte: '🩸', autre: '🦠',
};

window.loadPinEmojis = async function loadPinEmojis() {
  const el = document.getElementById('pin-emojis-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDoc(doc(db, 'config', 'pin_type_emojis'));
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

const _EMOJI_CATEGORIES = [
  { label: '🗺️ Principaux',   types: ['donjon', 'boss', 'mini_boss', 'zone_monstre'] },
  { label: '💬 Quêtes',        types: ['quête_principale', 'quête_secondaire', 'quête_tertiaire'] },
  { label: '⚒️ Forge / Craft', types: ['craft_armes', 'craft_armures', 'craft_accessoires', 'craft_lingots', 'craft_cles', 'craft_runes'] },
  { label: '🧪 Artisans',      types: ['alchimiste', 'bucheron', 'refaconneur'] },
  { label: '🛒 Commerce',      types: ['repreneur_butin', 'repreneur_armes', 'marchand_itinerant', 'marchand_equipement', 'marchand_consommable', 'marchand_outils', 'marchand_access', 'marchand_occulte'] },
  { label: '🦠 Autres',        types: ['région', 'autre'] },
];

function renderPinEmojiForm() {
  const el = document.getElementById('pin-emojis-content');
  if (!el) return;
  const frag = document.createDocumentFragment();

  for (const cat of _EMOJI_CATEGORIES) {
    const catHdr = document.createElement('div');
    catHdr.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    catHdr.textContent = cat.label;
    frag.appendChild(catHdr);

    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';

    for (const type of cat.types) {
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
      grid.appendChild(row);
    }
    frag.appendChild(grid);
  }
  el.innerHTML = '';
  el.appendChild(frag);
}

/* ══════════════════════════════════════════════════════
   OUTIL MIGRATION QUÊTES → CARTE
══════════════════════════════════════════════════════ */

let _qmAllPins   = [];
let _qmQuetes    = [];
let _qmExisting  = new Set();
let _qmMapping   = {};

window.showQuestMapMigration = function showQuestMapMigration() {
  _setHash('quest-map-migration');
  _showPanel('quest-map-migration-panel', 'btn-quest-map-migration');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  loadQuestMapMigration();
};

window.loadQuestMapMigration = async function loadQuestMapMigration() {
  const tableEl = document.getElementById('qm-table');
  tableEl.innerHTML = '<div class="empty">Chargement…</div>';
  document.getElementById('qm-save-btn').disabled = true;
  _qmMapping = {};

  try {
    // 1) Quêtes Firestore
    const qSnap = await getDocs(collection(db, COL.quetes));
    _qmQuetes = qSnap.docs.map(d => ({ _id: d.id, ...d.data() }));

    // 2) Map markers déjà existants de type quête_principale
    const mmSnap = await getDocs(collection(db, COL.mapMarkers));
    _qmExisting = new Set(
      mmSnap.docs.map(d => d.data().sourceId).filter(Boolean)
    );

    // 3) Pins depuis data.js (déjà chargé en script classique)
    _qmAllPins = [];
    const _QM_TYPES = new Set(['quête_principale', 'quête_secondaire']);
    if (typeof FLOOR_MARKERS !== 'undefined') {
      for (const [floorStr, markers] of Object.entries(FLOOR_MARKERS)) {
        const floor = parseInt(floorStr);
        for (const m of markers) {
          if (!_QM_TYPES.has(m.type)) continue;
          _qmAllPins.push({ ...m, floor });
        }
      }
    }

    // 4) Auto-match par titre (retire le numéro en tête)
    const _QM_TYPE_FS = { 'quête_principale': 'main', 'quête_secondaire': 'sec' };
    for (const pin of _qmAllPins) {
      if (_qmExisting.has(pin.id)) continue;
      const pinTitle = pin.name.replace(/^\d+\s*[-–]\s*/, '').toLowerCase().trim();
      const fsType   = _QM_TYPE_FS[pin.type];
      const match = _qmQuetes.find(q => {
        if (fsType && q.type && q.type !== fsType) return false;
        const t = (q.titre || '').toLowerCase().trim();
        return t === pinTitle || t.includes(pinTitle) || pinTitle.includes(t.split(' ').slice(0, 3).join(' '));
      });
      _qmMapping[pin.id] = match ? match._id : '__none__';
    }

    renderQuestMapMigration();
    document.getElementById('qm-save-btn').disabled = false;
  } catch (err) {
    tableEl.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
    toast('⛔ Erreur chargement : ' + err.message, 'error');
  }
};

const _QM_TYPE_FS   = { 'quête_principale': 'main', 'quête_secondaire': 'sec' };
const _QM_TYPE_LABEL = { 'quête_principale': '💬 Principale', 'quête_secondaire': '❓ Secondaire' };

window.renderQuestMapMigration = function renderQuestMapMigration() {
  const tableEl   = document.getElementById('qm-table');
  const floorF    = document.getElementById('qm-filter-floor')?.value || '';
  const typeF     = document.getElementById('qm-filter-type')?.value  || '';
  const showExist = document.getElementById('qm-show-existing')?.checked || false;

  let filtered = _qmAllPins;
  if (floorF)     filtered = filtered.filter(p => String(p.floor) === floorF);
  if (typeF)      filtered = filtered.filter(p => p.type === typeF);
  if (!showExist) filtered = filtered.filter(p => !_qmExisting.has(p.id));

  document.getElementById('qm-count').textContent = `${filtered.length} marqueur(s)`;

  if (!filtered.length) {
    tableEl.innerHTML = `<div class="empty">${_qmAllPins.length === 0
      ? 'Aucun marqueur de quête dans data.js'
      : 'Tous déjà migrés (cochez "Afficher déjà migrés" pour voir)'}</div>`;
    return;
  }

  const t = document.createElement('table');
  t.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
  t.innerHTML = `<thead><tr style="border-bottom:1px solid var(--border);">
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Marqueur (data.js)</th>
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Type</th>
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Palier</th>
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Coords</th>
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Quête Firestore</th>
    <th style="text-align:left;padding:6px 8px;color:var(--muted);font-weight:700;">Statut</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');

  for (const pin of filtered) {
    const isExist = _qmExisting.has(pin.id);
    const tr = document.createElement('tr');
    tr.style.cssText = `border-bottom:1px solid var(--border);${isExist ? 'opacity:0.5;' : ''}`;

    // Nom
    const tdName = document.createElement('td');
    tdName.style.cssText = 'padding:6px 8px;font-weight:600;';
    tdName.textContent = pin.name;
    tr.appendChild(tdName);

    // Type
    const tdType = document.createElement('td');
    tdType.style.cssText = 'padding:6px 8px;white-space:nowrap;font-size:11px;';
    tdType.textContent = _QM_TYPE_LABEL[pin.type] || pin.type;
    tr.appendChild(tdType);

    // Palier
    const tdFloor = document.createElement('td');
    tdFloor.style.cssText = 'padding:6px 8px;white-space:nowrap;';
    tdFloor.textContent = `Palier ${pin.floor}`;
    tr.appendChild(tdFloor);

    // Coordonnées
    const tdCoords = document.createElement('td');
    tdCoords.style.cssText = 'padding:6px 8px;white-space:nowrap;font-family:monospace;color:var(--muted);font-size:11px;';
    tdCoords.textContent = `${pin.gx}, ${pin.gy}`;
    tr.appendChild(tdCoords);

    // Select quête Firestore
    const tdSelect = document.createElement('td');
    tdSelect.style.cssText = 'padding:6px 8px;';
    if (!isExist) {
      const sel = document.createElement('select');
      sel.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:11px;outline:none;max-width:300px;width:100%;';
      sel.innerHTML = `<option value="__none__">— Aucune (garder lien Gitbook) —</option>`;
      const fsType = _QM_TYPE_FS[pin.type];
      const palierQuetes = _qmQuetes
        .filter(q => !q.palier || String(q.palier) === String(pin.floor))
        .filter(q => !fsType || !q.type || q.type === fsType);
      for (const q of palierQuetes) {
        const opt = document.createElement('option');
        opt.value = q._id;
        opt.textContent = (q.titre || q._id).substring(0, 60);
        if (_qmMapping[pin.id] === q._id) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => { _qmMapping[pin.id] = sel.value; _qmRefreshStatus(tr, pin, sel.value); });
      tdSelect.appendChild(sel);
    } else {
      tdSelect.innerHTML = '<span style="color:var(--muted);font-size:11px;">déjà migré</span>';
    }
    tr.appendChild(tdSelect);

    // Statut
    const tdStatus = document.createElement('td');
    tdStatus.style.cssText = 'padding:6px 8px;';
    tdStatus.dataset.statusCell = '1';
    _qmSetStatus(tdStatus, isExist, !isExist && _qmMapping[pin.id] && _qmMapping[pin.id] !== '__none__');
    tr.appendChild(tdStatus);

    tbody.appendChild(tr);
  }
  t.appendChild(tbody);
  tableEl.innerHTML = '';
  tableEl.appendChild(t);
};

function _qmSetStatus(td, isExist, hasMatch) {
  if (isExist)       td.innerHTML = '<span style="color:#4caf50;font-size:11px;">✓ Migré</span>';
  else if (hasMatch) td.innerHTML = '<span style="color:#e0ac60;font-size:11px;">🔗 Auto-matché</span>';
  else               td.innerHTML = '<span style="color:var(--muted);font-size:11px;">— Sans quête</span>';
}

function _qmRefreshStatus(tr, pin, newQuestId) {
  const td = tr.querySelector('[data-status-cell]');
  if (td) _qmSetStatus(td, false, newQuestId && newQuestId !== '__none__');
}

window.saveQuestMapMigration = async function saveQuestMapMigration() {
  const btn = document.getElementById('qm-save-btn');
  btn.disabled = true;
  btn.textContent = 'Migration en cours…';

  const toMigrate = _qmAllPins.filter(p => !_qmExisting.has(p.id));
  let ok = 0, errs = 0;

  for (const pin of toMigrate) {
    const questId = _qmMapping[pin.id];
    const matchedQuest = questId && questId !== '__none__'
      ? _qmQuetes.find(q => q._id === questId)
      : null;

    const docPrefix = pin.type === 'quête_secondaire' ? 'qs' : 'qp';
    const obj = {
      type:     pin.type,
      floor:    pin.floor,
      name:     pin.name,
      gx:       pin.gx,
      gy:       pin.gy,
      desc:     pin.desc || '',
      link:     matchedQuest ? `../Quetes/quetes.html#${matchedQuest._id}` : (pin.link || ''),
      sourceId: pin.id,
    };
    if (matchedQuest) obj.questId = matchedQuest._id;

    try {
      await setDoc(doc(db, COL.mapMarkers, `${docPrefix}_${pin.id}`), obj);
      _qmExisting.add(pin.id);
      ok++;
    } catch (e) {
      console.error('[QuestMigration]', pin.id, e);
      errs++;
    }
  }

  invalidateCache(COL.mapMarkers);
  invalidateModCache(COL.mapMarkers);

  toast(
    errs > 0 ? `⚠️ ${ok} migrés, ${errs} erreurs` : `✓ ${ok} marqueur(s) migrés`,
    errs > 0 ? 'warn' : 'success'
  );
  btn.disabled = false;
  btn.textContent = '💾 Migrer les quêtes';
  renderQuestMapMigration();
};

