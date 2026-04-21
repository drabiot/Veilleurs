
// ═══════════════════════════════════════════════════
// IMAGE FORUM DISCORD
// ═══════════════════════════════════════════════════
let forumImageFile = null;

function _setForumImage(file) {
  if (!file || !file.type.startsWith('image/')) return;
  forumImageFile = file;
  const url = URL.createObjectURL(file);
  const preview = document.getElementById('forum-img-preview');
  const placeholder = document.getElementById('forum-img-placeholder');
  const zone = document.getElementById('forum-img-zone');
  const clearBtn = document.getElementById('forum-img-clear-btn');
  const badge = document.getElementById('forum-img-badge');
  preview.src = url;
  preview.style.display = 'block';
  placeholder.style.display = 'none';
  zone.classList.add('has-img');
  if (clearBtn) clearBtn.style.display = 'block';
  if (badge) badge.style.display = '';
}

function clearForumImage() {
  forumImageFile = null;
  const preview = document.getElementById('forum-img-preview');
  const placeholder = document.getElementById('forum-img-placeholder');
  const zone = document.getElementById('forum-img-zone');
  const clearBtn = document.getElementById('forum-img-clear-btn');
  const badge = document.getElementById('forum-img-badge');
  const input = document.getElementById('forum-img-input');
  if (preview) { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (zone) zone.classList.remove('has-img');
  if (clearBtn) clearBtn.style.display = 'none';
  if (badge) badge.style.display = 'none';
  if (input) input.value = '';
}

function onForumImgFile(file) { _setForumImage(file); }

function onForumImgDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) _setForumImage(file);
}


// ═══════════════════════════════════════════════════
// CREATOR CONFIG (visibilité outils / paliers)
// ═══════════════════════════════════════════════════
function applyCreatorConfig(cfg) {
  if (!cfg) return;
  window._vcl_lastCreatorConfig = cfg; // mémorisé pour re-apply après auth
  // Les contributeurs+ voient tout
  if (['contributeur', 'admin'].includes(window._vcl_role || '')) {
    document.querySelectorAll('.mode-btn').forEach(b => { b.style.display = ''; });
    for (const selId of ['f-palier', 'mob-palier', 'pnj-palier', 'reg-palier']) {
      const sel = document.getElementById(selId);
      if (sel) sel.querySelectorAll('option').forEach(o => o.hidden = false);
    }
    _setCreatorDisabled(false);
    switchMode(creatorMode); // restaure le formulaire actif
    return;
  }
  // Outils
  const tools = cfg.tools || {};
  const MODES = ['item', 'mob', 'pnj', 'region', 'quest', 'panoplie'];
  for (const m of MODES) {
    const enabled = tools[m] !== false;
    const btn = document.querySelector(`.mode-btn[data-mode="${m}"]`);
    if (btn) btn.style.display = enabled ? '' : 'none';
  }
  const first = MODES.find(m => tools[m] !== false);
  if (!first) {
    _setCreatorDisabled(true);
  } else {
    _setCreatorDisabled(false);
    // Si le mode actif est désactivé, basculer vers le premier disponible
    if (tools[creatorMode] === false) switchMode(first);
  }
  // Paliers masqués
  const hiddenPaliers = new Set(cfg.hiddenPaliers || []);
  for (const selId of ['f-palier', 'mob-palier', 'pnj-palier', 'reg-palier']) {
    const sel = document.getElementById(selId);
    if (!sel) continue;
    for (const opt of sel.querySelectorAll('option[value]')) {
      const v = parseInt(opt.value);
      if (!v) continue;
      opt.hidden = hiddenPaliers.has(v);
      if (hiddenPaliers.has(v) && sel.value === String(v)) sel.value = '';
    }
  }
}

// ═══════════════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════════════
let selRarity    = '';
let selClasses   = [];
let craftEntries = [];
let effectEntries= [];
let activeTags   = new Set();
let craftUid     = 0;
let effectUid    = 0;
let selThreshold = {}; // { force:20, dexterite:15, ... }

const THRESHOLD_ATTRS = [
  { id:'force',        label:'Force',       icon:'⚔️' },
  { id:'dexterite',    label:'Dextérité',   icon:'🏹' },
  { id:'intelligence', label:'Intelligence',icon:'📘' },
  { id:'esprit',       label:'Esprit',      icon:'✨' },
  { id:'defense_car',  label:'Défense',     icon:'🛡️' },
  { id:'vitalite',     label:'Vitalité',    icon:'❤️' },
];

function buildThresholdGrid() {
  const grid = document.getElementById('threshold-grid');
  if (!grid || grid.dataset.built === '1') return;
  grid.dataset.built = '1';
  THRESHOLD_ATTRS.forEach(a => {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
    const lab = document.createElement('label');
    lab.textContent = `${a.icon} ${a.label}`;
    lab.style.cssText = 'font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;';
    const inp = document.createElement('input');
    inp.type = 'number';
    inp.min = '0';
    inp.placeholder = '0';
    inp.id = `thr-${a.id}`;
    inp.style.cssText = 'width:100%;';
    inp.addEventListener('input', () => {
      const v = parseInt(inp.value);
      if (v > 0) selThreshold[a.id] = v;
      else delete selThreshold[a.id];
      if (typeof update === 'function') update();
    });
    wrap.appendChild(lab);
    wrap.appendChild(inp);
    grid.appendChild(wrap);
  });
}

function resetThresholdInputs() {
  selThreshold = {};
  THRESHOLD_ATTRS.forEach(a => {
    const el = document.getElementById(`thr-${a.id}`);
    if (el) el.value = '';
  });
}

function loadThreshold(thr) {
  resetThresholdInputs();
  if (!thr || typeof thr !== 'object') return;
  for (const [k, v] of Object.entries(thr)) {
    const n = parseInt(v);
    if (!n || n <= 0) continue;
    selThreshold[k] = n;
    const el = document.getElementById(`thr-${k}`);
    if (el) el.value = n;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', buildThresholdGrid);
} else {
  buildThresholdGrid();
}

const pendingOrphans = new Map(); // id → displayName (tapé par l'user)

// ═══════════════════════════════════════════════════
// STATS CONFIG
// ═══════════════════════════════════════════════════
const STAT_DEFS = [
  { group:'Offensif', stats:[
    { id:'degats',             label:'Dégâts',                   color:'#e0923a' },
    { id:'degats_physique',    label:'Dégâts Physique %',         color:'#e0923a' },
    { id:'degats_arme',        label:"Dégâts d'Arme %",          color:'#e0923a' },
    { id:'degats_magique',     label:'Dégâts Magiques %',         color:'#e86ca0' },
    { id:'degats_competence',  label:'Dégâts Compétence %',       color:'#a07ae8' },
    { id:'degats_projectile',  label:'Dégâts Projectile %'                        },
    { id:'vitesse_attaque',    label:"Vitesse d'Attaque",         color:'#a07ae8' },
    { id:'crit_chance',        label:'Crit Chance %',             color:'#e8d44a' },
    { id:'crit_degats',        label:'Crit Dégâts %',             color:'#e8d44a' },
    { id:'crit_comp_chance',   label:'Crit Compétence Chance %',  color:'#a07ae8' },
    { id:'crit_comp_degats',   label:'Crit Compétence Dégâts %',  color:'#a07ae8' },
  ]},
  { group:'Défensif', stats:[
    { id:'defense',            label:'Défense',                   color:'#9a9ab0' },
    { id:'maitrise_bloc',      label:'Maîtrise de Blocage %',     color:'#b8b050' },
    { id:'puissance_bloc',     label:'Puissance de Blocage %'                     },
    { id:'sante',              label:'Santé',                     color:'#e85050' },
    { id:'esquive',            label:'Esquive %',                 color:'#50b8c8' },
    { id:'reduction_degats',   label:'Réduction Dégâts %',        color:'#9a9ab0' },
    { id:'reduction_chutes',   label:'Réduction Chutes %'                         },
    { id:'tenacite',           label:'Ténacité %',                color:'#50a8e8' },
    { id:'res_recul',          label:'Résistance Recul %'                         },
  ]},
  { group:'Mobilité & Ressources', stats:[
    { id:'hate',               label:'Hâte %',                   color:'#50a8e8' },
    { id:'vitesse_deplacement',label:'Vitesse Déplacement /s',    color:'#e8d44a' },
    { id:'mana',               label:'Mana',                      color:'#50d8e8' },
    { id:'stamina',            label:'Stamina',                   color:'#e8c040' },
  ]},
  { group:'Régénération & Soutien', stats:[
    { id:'vol_vie',            label:'Vol de Vie %',              color:'#a03030' },
    { id:'omnivamp',           label:'Omnivampirisme %',          color:'#a03030' },
    { id:'soin_bonus',         label:'Soin Bonus',                color:'#50e050' },
    { id:'regen_sante',        label:'Régén. Santé /s',          color:'#e85050' },
    { id:'regen_mana',         label:'Régén. Mana /s',           color:'#50d8e8' },
    { id:'regen_stamina',      label:'Régén. Stamina /s',        color:'#e8a030' },
  ]},
];

// ═══════════════════════════════════════════════════
// AUTO-TAG MAPS
// ═══════════════════════════════════════════════════
const SLOT_OPTIONS = {
  arme:       [['arme_p','Arme Principale'], ['arme_s','Arme Secondaire / Bouclier']],
  armure:     [['casque','Casque'],['plastron','Plastron'],['jambières','Jambières'],['bottes','Bottes']],
  accessoire: [['anneau','Anneau'],['amulette','Amulette'],['bracelet','Bracelet'],['artefact','Artefact'],['gants','Gants']]
};

const SLOT_TAG_MAP = {
  anneau:'Anneau', amulette:'Amulette', bracelet:'Bracelet', artefact:'Artefact',
  casque:'Casque', plastron:'Plastron', 'jambières':'Jambières', bottes:'Bottes', gants:'Gants',
  arme_s:'Bouclier'
};

const CLS_TAG_MAP  = { guerrier:'Guerrier', assassin:'Assassin', archer:'Archer', mage:'Mage', shaman:'Shaman' };
const RARITY_TAG_MAP = {
  commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire',
  mythique:'Mythique', godlike:'Godlike', event:'Event'
};

// ═══════════════════════════════════════════════════
// PRESET TAGS
// ═══════════════════════════════════════════════════
const PRESET_TAG_GROUPS = [
  { label:'Type', tags:['Arme','Épée','Dague','Hache','Lance','Marteau','Hallebarde','Arc','Bâton','Bouclier','Casque','Plastron','Jambières','Bottes','Gants','Anneau','Amulette','Bracelet','Artefact'] },
  { label:'Classe', tags:['Guerrier','Assassin','Archer','Mage','Shaman'] },
  { label:'Palier', tags:['Palier 1','Palier 2','Palier 3'] },
  { label:'Rareté', tags:['Commun','Rare','Épique','Légendaire','Mythique','Godlike','Event'] },
  { label:'Autre', tags:['Consommable','Nourriture','Matériau','Ressource','Outil','Rune','Donjon','Quête','Set','Boss','World Boss','Event'] },
];

// ═══════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {
  const _params = new URLSearchParams(location.search);

  // Afficher le bouton d'écriture seulement en mode éditeur
  if (_params.has('edit')) {
    document.getElementById('write-file-btn').style.display = '';
  }

  buildStatsUI();
  buildPresetTags();
  buildSetSelect();
  initObtainData();
  initLoadSearch();
  initLoadSearchForAllModes();
  initCustomSelects();
  buildOrphanSection();
  buildEffectTemplates();

  loadAuthor();
  loadHistory();
  // Effacer le brouillon si l'utilisateur force un rechargement (Ctrl+Shift+R)
  if (performance.navigation.type === 1) {
    localStorage.removeItem('vcl_form_v2');
    localStorage.removeItem('vcl_form');
  }

  // Pré-remplir depuis sessionStorage (bouton "Ouvrir dans Creator" depuis moderation.html)
  const editSubRaw = sessionStorage.getItem('editSub');
  if (editSubRaw) {
    sessionStorage.removeItem('editSub');
    try {
      const { type, data } = JSON.parse(editSubRaw);
      if (type && data) {
        switchMode(type);
        loadFromData(data, type);
        return; // skip restoreForm — data loaded from session
      }
    } catch(e) {}
  }

  const _validModes = ['item','mob','pnj','region','quest','panoplie'];
  const _urlMode = _params.has('mode') && _validModes.includes(_params.get('mode')) ? _params.get('mode') : null;
  if (_urlMode) switchMode(_urlMode);
  restoreForm(_urlMode);

  // Pré-remplir depuis le tracker d'IDs fantômes (moderation.html)
  if (_params.has('ghostid')) {
    const ghostId   = _params.get('ghostid');
    const ghostType = _params.get('ghosttype') || 'item'; // 'item' | 'mob'
    if (ghostType === 'mob') {
      switchMode('mob');
      const el = document.getElementById('mob-id');
      if (el) { el.value = ghostId; mobIdLocked = true; update(); }
    } else {
      const fId = document.getElementById('f-id');
      if (fId) { fId.value = ghostId; idLocked = true; update(); }
    }
  }
});

// ═══════════════════════════════════════════════════
// AUTH MODAL
// ═══════════════════════════════════════════════════
function openLoginModal() {
  document.getElementById('login-modal').classList.remove('hidden');
  switchAuthTab('login');
  document.getElementById('modal-email').focus();
}
function closeLoginModal() {
  document.getElementById('login-modal').classList.add('hidden');
  document.getElementById('modal-error').style.display = 'none';
}
function switchAuthTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('panel-login').style.display         = isLogin ? '' : 'none';
  document.getElementById('panel-register').style.display      = isLogin ? 'none' : '';
  document.getElementById('panel-pseudo').style.display        = 'none';
  const pcp = document.getElementById('panel-change-pseudo');
  if (pcp) pcp.style.display = 'none';
  document.getElementById('tab-login').style.color        = isLogin ? 'var(--accent)' : 'var(--muted)';
  document.getElementById('tab-login').style.borderBottomColor    = isLogin ? 'var(--accent)' : 'transparent';
  document.getElementById('tab-register').style.color     = isLogin ? 'var(--muted)' : 'var(--accent)';
  document.getElementById('tab-register').style.borderBottomColor = isLogin ? 'transparent' : 'var(--accent)';
  document.getElementById('modal-error').style.display = 'none';
}
function toEmail(input) {
  // Si l'input contient un @, c'est un vrai email (compte Google ou ancien compte)
  // Sinon c'est un identifiant → on génère l'email interne
  return input.includes('@') ? input : `${input}@veilleurs.wiki`;
}

async function doLogin() {
  const raw = document.getElementById('modal-email').value.trim();
  const pw  = document.getElementById('modal-password').value;
  const err = document.getElementById('modal-error');
  err.style.display = 'none';
  if (!raw || !pw) return;
  try {
    await window._vcl_login(toEmail(raw), pw);
    closeLoginModal();
  } catch (e) {
    err.textContent = e.message.includes('invalid-credential') ? 'Identifiant ou mot de passe incorrect.' : e.message;
    err.style.display = '';
  }
}

async function doLoginGoogle() {
  const err = document.getElementById('modal-error');
  err.style.display = 'none';
  try {
    const cred = await window._vcl_loginGoogle();
    const uid  = cred.user.uid;
    const snap = await window._vcl_getDoc(window._vcl_doc(window._vcl_db, 'users', uid));
    if (!snap.exists()) {
      // Première connexion Google : demander le pseudo
      const suggested = (cred.user.displayName || cred.user.email.split('@')[0]).slice(0, 32);
      document.getElementById('panel-login').style.display    = 'none';
      document.getElementById('panel-register').style.display = 'none';
      document.getElementById('panel-pseudo').style.display   = '';
      document.getElementById('google-pseudo').value = suggested;
      document.getElementById('google-pseudo').focus();
      document.getElementById('google-pseudo').select();
    } else {
      closeLoginModal();
    }
  } catch (e) {
    if (e.code !== 'auth/popup-closed-by-user') {
      err.textContent = e.message;
      err.style.display = '';
    }
  }
}

async function doSavePseudo() {
  const pseudo = document.getElementById('google-pseudo').value.trim();
  const err    = document.getElementById('modal-error');
  err.style.display = 'none';
  if (!pseudo) { err.textContent = 'Le pseudo est obligatoire.'; err.style.display = ''; return; }
  if (pseudo.length < 2)  { err.textContent = 'Pseudo trop court (2 caractères min).'; err.style.display = ''; return; }
  if (!/^[\w\- ]+$/i.test(pseudo)) { err.textContent = 'Pseudo invalide (lettres, chiffres, - et _ seulement).'; err.style.display = ''; return; }
  const user = window._vcl_auth?.currentUser;
  if (!user) { err.textContent = 'Session expirée, réessaie.'; err.style.display = ''; return; }
  try {
    await window._vcl_setDoc(window._vcl_doc(window._vcl_db, 'users', user.uid), { pseudo, role: 'membre' });
    const authorInput = document.getElementById('author-input');
    if (authorInput) { authorInput.value = pseudo; saveAuthor(); }
    closeLoginModal();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = '';
  }
}

async function openChangePseudoModal() {
  const user = window._vcl_auth?.currentUser;
  if (!user) { openLoginModal(); return; }

  // Lecture du pseudo actuel
  let currentPseudo = '';
  try {
    const snap = await window._vcl_getDoc(window._vcl_doc(window._vcl_db, 'users', user.uid));
    if (snap.exists()) currentPseudo = snap.data()?.pseudo || '';
  } catch {}

  // Ouvre la modal, masque les panneaux de login et affiche le panel change-pseudo
  document.getElementById('login-modal').classList.remove('hidden');
  document.getElementById('panel-login').style.display         = 'none';
  document.getElementById('panel-register').style.display      = 'none';
  document.getElementById('panel-pseudo').style.display        = 'none';
  document.getElementById('panel-change-pseudo').style.display = '';
  document.getElementById('modal-error').style.display         = 'none';

  // Préremplir
  const input = document.getElementById('change-pseudo-input');
  input.value = currentPseudo;
  input.focus();
  input.select();

  // Détecter provider pour afficher le champ mot de passe ou l'indication Google
  const providers = (user.providerData || []).map(p => p.providerId);
  const pwField   = document.getElementById('change-pseudo-pw-field');
  const gHint     = document.getElementById('change-pseudo-google-hint');
  if (providers.includes('password')) {
    pwField.style.display = '';
    gHint.style.display   = 'none';
  } else if (providers.includes('google.com')) {
    pwField.style.display = 'none';
    gHint.style.display   = '';
  } else {
    pwField.style.display = '';
    gHint.style.display   = 'none';
  }
}

async function doChangePseudo() {
  const err = document.getElementById('modal-error');
  err.style.display = 'none';
  const newPseudo = document.getElementById('change-pseudo-input').value.trim();
  const password  = document.getElementById('change-pseudo-password').value;

  if (!newPseudo) { err.textContent = 'Le pseudo est obligatoire.'; err.style.display = ''; return; }
  if (!/^[\w\- ]{2,32}$/.test(newPseudo)) {
    err.textContent = 'Pseudo invalide (2-32 caractères, lettres/chiffres/espace/-/_).';
    err.style.display = '';
    return;
  }

  try {
    const applied = await window._vcl_changePseudoSecurely(newPseudo, { password });
    const authorInput = document.getElementById('author-input');
    if (authorInput) { authorInput.value = applied; saveAuthor(); }
    document.getElementById('change-pseudo-password').value = '';
    closeLoginModal();
  } catch (e) {
    const code = e?.code || e?.message || '';
    const msg  = code === 'invalid-pseudo'       ? 'Pseudo invalide (2-32 caractères, lettres/chiffres/espace/-/_).'
              : code === 'pseudo-taken'          ? 'Ce pseudo est déjà utilisé.'
              : code === 'password-required'     ? 'Mot de passe obligatoire pour ré-authentifier.'
              : code === 'auth/wrong-password'   ? 'Mot de passe incorrect.'
              : code === 'auth/invalid-credential' ? 'Mot de passe incorrect.'
              : code === 'auth/popup-closed-by-user' ? 'Ré-authentification annulée.'
              : code === 'no-current-user'       ? 'Session expirée, reconnecte-toi.'
              : (e?.message || 'Erreur inconnue');
    err.textContent = msg;
    err.style.display = '';
  }
}

async function doRegister() {
  const identifiant = document.getElementById('reg-pseudo').value.trim();
  const pw          = document.getElementById('reg-password').value;
  const err         = document.getElementById('modal-error');
  err.style.display = 'none';

  // Validation identifiant : 2-32 caractères, lettres/chiffres/tirets/underscores (pas d'espaces)
  if (!identifiant) { err.textContent = "L'identifiant est obligatoire."; err.style.display = ''; return; }
  if (identifiant.length < 2)  { err.textContent = 'Identifiant trop court (2 caractères min).'; err.style.display = ''; return; }
  if (identifiant.length > 32) { err.textContent = 'Identifiant trop long (32 caractères max).'; err.style.display = ''; return; }
  if (!/^[\w\-]+$/i.test(identifiant)) { err.textContent = 'Identifiant invalide (lettres, chiffres, - et _ seulement, sans espaces).'; err.style.display = ''; return; }
  if (!pw) { err.textContent = 'Mot de passe obligatoire.'; err.style.display = ''; return; }
  if (pw.length < 6) { err.textContent = 'Mot de passe trop court (6 caractères min).'; err.style.display = ''; return; }

  const email = toEmail(identifiant);

  try {
    const cred = await window._vcl_register(email, pw);
    // Sauvegarder l'identifiant dans Firestore — retry si le token n'est pas encore propagé
    const saveProfile = async () => {
      await window._vcl_setDoc(
        window._vcl_doc(window._vcl_db, 'users', cred.user.uid),
        { pseudo: identifiant, role: 'membre' }
      );
    };
    try {
      await saveProfile();
    } catch {
      await new Promise(r => setTimeout(r, 1000));
      try { await saveProfile(); } catch (e2) {
        console.warn('Profil non sauvegardé :', e2.message);
      }
    }
    // Connexion directe — pas de vérification email requise
    const authorInput = document.getElementById('author-input');
    if (authorInput) { authorInput.value = identifiant; saveAuthor(); }
    closeLoginModal();
  } catch (e) {
    const msg = e.code === 'auth/email-already-in-use' ? 'Cet identifiant est déjà utilisé.'
              : e.code === 'auth/weak-password'        ? 'Mot de passe trop faible (6 caractères min).'
              : e.message;
    err.textContent = msg;
    err.style.display = '';
  }
}
async function doLogout() {
  await window._vcl_logout();
  window.location.reload();
}

// ═══════════════════════════════════════════════════
// AUTEUR
// ═══════════════════════════════════════════════════
function saveAuthor() {
  const v = document.getElementById('author-input').value.trim();
  if (v) localStorage.setItem('vcl_author', v);
  else   localStorage.removeItem('vcl_author');
}

function loadAuthor() {
  const v = localStorage.getItem('vcl_author');
  if (v) document.getElementById('author-input').value = v;
}

function getAuthor() {
  return document.getElementById('author-input').value.trim() || null;
}

// ═══════════════════════════════════════════════════
// PERSISTANCE FORMULAIRE
// ═══════════════════════════════════════════════════
let _skipSave = false; // évite de sauvegarder pendant un reset

function saveForm() {
  if (_skipSave) return;
  try {
    const data = {
      _mode: creatorMode,
      name:     document.getElementById('f-name').value,
      id:       document.getElementById('f-id').value,
      idLocked,
      category: document.getElementById('f-category').value,
      cat:      document.getElementById('f-cat').value,
      palier:   document.getElementById('f-palier').value,
      lvl:      document.getElementById('f-lvl').value,
      lore:     document.getElementById('f-lore').value,
      obtainOverride: document.getElementById('f-obtain-override').value,
      selRarity, selClasses, selTwoHanded, selSensible, selEvolutif,
      activeTags: [...activeTags],
      obtainSources,
      stats: (() => {
        const s = {};
        for (const { stats } of STAT_DEFS) {
          for (const { id } of stats) {
            const mn = document.getElementById(`smin-${id}`)?.value;
            const mx = document.getElementById(`smax-${id}`)?.value;
            if (mn !== '') s[id] = { min: mn, max: mx };
          }
        }
        return s;
      })(),
      // Mob form
      mob: creatorMode === 'mob' ? {
        name:      document.getElementById('mob-name')?.value || '',
        id:        document.getElementById('mob-id')?.value   || '',
        idLocked:  mobIdLocked,
        type:      document.getElementById('mob-type')?.value || 'monstre',
        behavior:  document.getElementById('mob-behavior')?.value || 'agressif',
        palier:    document.getElementById('mob-palier')?.value || '',
        region:    document.getElementById('mob-region')?.value || '',
        regionSearch: document.getElementById('mob-region-search')?.value || '',
        lore:      document.getElementById('mob-lore')?.value   || '',
        spawnTime: document.getElementById('mob-spawntime')?.value || '',
        inCodex:   mobInCodex,
        sensible:  mobSensible,
      } : null,
      // PNJ form
      pnj: creatorMode === 'pnj' ? {
        id:           document.getElementById('pnj-id')?.value      || '',
        type:         document.getElementById('pnj-type')?.value     || '',
        palier:       document.getElementById('pnj-palier')?.value   || '',
        region:       document.getElementById('pnj-region')?.value   || '',
        regionSearch: document.getElementById('pnj-region-search')?.value || '',
        x:            document.getElementById('pnj-x')?.value        || '',
        y:            document.getElementById('pnj-y')?.value        || '',
        z:            document.getElementById('pnj-z')?.value        || '',
      } : null,
      // Région form
      region: creatorMode === 'region' ? {
        name:    document.getElementById('reg-name')?.value   || '',
        id:      document.getElementById('reg-id')?.value     || '',
        idLocked: regIdLocked,
        palier:  document.getElementById('reg-palier')?.value || '',
        lore:    document.getElementById('reg-lore')?.value   || '',
        inCodex: regInCodex,
        canTp:   regCanTp,
      } : null,
      // Panoplie form
      panoplie: creatorMode === 'panoplie' ? {
        label:    document.getElementById('panop-label')?.value || '',
        id:       document.getElementById('panop-id')?.value    || '',
        idLocked: panopIdLocked,
        bonuses:  panopBonuses.map(b => ({ pieces: b.pieces, stat: b.stat, value: b.value })),
      } : null,
    };
    localStorage.setItem('vcl_form_v2', JSON.stringify(data));
  } catch(e) {}
}

function restoreForm(forcedMode) {
  try {
    // Try new key first, fall back to legacy key
    const raw = localStorage.getItem('vcl_form_v2') || localStorage.getItem('vcl_form');
    if (!raw) { update(); return; }
    const d = JSON.parse(raw);

    // Restore active mode — skip if a URL mode param already set the mode
    if (d._mode && d._mode !== 'item' && !forcedMode) {
      switchMode(d._mode);
    }

    // ── Item form ──
    if (d.name) document.getElementById('f-name').value = d.name;
    if (d.idLocked && d.id) {
      document.getElementById('f-id').value = d.id;
      idLocked = true;
    } else {
      document.getElementById('f-id').value = d.name ? nameToId(d.name) : '';
      idLocked = false;
    }
    if (d.category) {
      document.getElementById('f-category').value = d.category;
      onCatChange();
    }
    if (d.cat)    document.getElementById('f-cat').value    = d.cat;
    if (d.palier) document.getElementById('f-palier').value = d.palier;
    if (d.lvl)    document.getElementById('f-lvl').value    = d.lvl;
    if (d.lore)   document.getElementById('f-lore').value   = d.lore;
    if (d.obtainOverride) {
      document.getElementById('f-obtain-override').value = d.obtainOverride;
      document.getElementById('obtain-override-wrap').style.display = '';
    }
    if (d.selRarity) setRarity(d.selRarity);
    if (d.selSensible) {
      selSensible = true;
      document.getElementById('sensible-btn').classList.add('active');
    }
    if (d.selTwoHanded) {
      selTwoHanded = true;
      document.getElementById('twohanded-btn').classList.add('active');
    }
    if (d.selEvolutif) {
      selEvolutif = true;
      document.getElementById('evolutif-btn')?.classList.add('active');
    }
    if (d.selClasses?.length) {
      selClasses = d.selClasses;
      document.querySelectorAll('.cls-btn').forEach(b => b.classList.toggle('active', d.selClasses.includes(b.dataset.c)));
    }
    if (d.activeTags?.length) {
      activeTags = new Set(d.activeTags);
      syncPresetTagButtons();
      renderCustomTags();
    }
    if (d.obtainSources?.length) {
      obtainSources = d.obtainSources;
      renderObtainSources();
    }
    if (d.stats) {
      for (const [id, { min, max }] of Object.entries(d.stats)) {
        const minEl = document.getElementById(`smin-${id}`);
        const maxEl = document.getElementById(`smax-${id}`);
        if (minEl) { minEl.value = min; maxEl.value = max; onStatInput(id); }
      }
    }

    // ── Mob form ──
    if (d.mob) {
      const m = d.mob;
      if (m.name) document.getElementById('mob-name').value = m.name;
      if (m.id)   document.getElementById('mob-id').value   = m.id;
      mobIdLocked = !!m.idLocked;
      if (m.type)      setMobType(m.type);
      if (m.behavior)  setBehavior(m.behavior);
      if (m.palier)    { document.getElementById('mob-palier').value = m.palier; _customSelUpdaters['mob-palier']?.(); }
      if (m.region)    { document.getElementById('mob-region').value = m.region; }
      if (m.regionSearch) document.getElementById('mob-region-search').value = m.regionSearch;
      if (m.lore)      document.getElementById('mob-lore').value = m.lore;
      if (m.spawnTime) document.getElementById('mob-spawntime').value = m.spawnTime;
      if (m.inCodex !== undefined) setMobCodex(m.inCodex);
      if (m.sensible) { mobSensible = true; document.getElementById('mob-sensible-btn')?.classList.add('active'); }
    }

    // ── PNJ form ──
    if (d.pnj) {
      const p = d.pnj;
      if (p.type)   { document.getElementById('pnj-type').value = p.type; onPnjTypeChange(); }
      if (p.palier) document.getElementById('pnj-palier').value = p.palier;
      if (p.region) document.getElementById('pnj-region').value = p.region;
      if (p.regionSearch) document.getElementById('pnj-region-search').value = p.regionSearch;
      if (p.x !== '') document.getElementById('pnj-x').value = p.x;
      if (p.y !== '') document.getElementById('pnj-y').value = p.y;
      if (p.z !== '') document.getElementById('pnj-z').value = p.z;
    }

    // ── Région form ──
    if (d.region) {
      const r = d.region;
      if (r.name)  { document.getElementById('reg-name').value = r.name; onRegNameInput(); }
      if (r.idLocked && r.id) { document.getElementById('reg-id').value = r.id; regIdLocked = true; }
      if (r.palier) document.getElementById('reg-palier').value = r.palier;
      if (r.lore)   document.getElementById('reg-lore').value   = r.lore;
      if (r.inCodex !== undefined && typeof setRegCodex === 'function') setRegCodex(r.inCodex);
      if (r.canTp   !== undefined && typeof setRegCanTp === 'function') setRegCanTp(r.canTp);
    }

    // ── Panoplie form ──
    if (d.panoplie) {
      const p = d.panoplie;
      if (p.label) document.getElementById('panop-label').value = p.label;
      if (p.idLocked && p.id) { document.getElementById('panop-id').value = p.id; panopIdLocked = true; }
      else if (p.label) document.getElementById('panop-id').value = nameToId(p.label);
      if (p.bonuses?.length) {
        panopBonuses = p.bonuses.map(b => ({ uid: ++_panopUid, pieces: b.pieces, stat: b.stat, value: b.value }));
        renderPanopBonuses();
      }
    }

    refreshCustomSelects();
    update();
  } catch(e) { refreshCustomSelects(); update(); }
}

function clearSavedForm() {
  localStorage.removeItem('vcl_form_v2');
  localStorage.removeItem('vcl_form');
}

// ═══════════════════════════════════════════════════
// BUILD STATS UI
// ═══════════════════════════════════════════════════
function buildStatsUI() {
  const container = document.getElementById('stats-container');
  for (const { group, stats } of STAT_DEFS) {
    const glabel = document.createElement('div');
    glabel.className = 'stat-group-label';
    glabel.textContent = group;
    container.appendChild(glabel);

    for (const { id, label, color } of stats) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      row.id = `srow-${id}`;
      const labelStyle = color ? `style="color:${color}"` : '';
      row.innerHTML = `
        <label title="${id}" ${labelStyle}>${label}</label>
        <input type="number" step="any" id="smin-${id}" placeholder="—" oninput="onStatInput('${id}')">
        <span class="stat-sep">→</span>
        <input type="number" step="any" id="smax-${id}" placeholder="max" oninput="onStatInput('${id}')">
      `;
      container.appendChild(row);
    }
  }
}

function onStatInput(id) {
  const minV = document.getElementById(`smin-${id}`).value;
  const maxV = document.getElementById(`smax-${id}`).value;
  document.getElementById(`srow-${id}`).classList.toggle('has-val', minV !== '' && minV !== '0');
  update();
}

function getStats() {
  const out = {};
  for (const { stats } of STAT_DEFS) {
    for (const { id } of stats) {
      const minEl = document.getElementById(`smin-${id}`);
      const maxEl = document.getElementById(`smax-${id}`);
      if (!minEl || minEl.value === '') continue;
      const min = parseFloat(minEl.value);
      if (isNaN(min)) continue;
      const maxRaw = maxEl.value;
      if (maxRaw !== '' && parseFloat(maxRaw) !== min) {
        out[id] = [min, parseFloat(maxRaw)];
      } else {
        out[id] = min;
      }
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════
// AUTO ID FROM NAME
// ═══════════════════════════════════════════════════
function nameToId(name) {
  return normalize(name)
    .replace(/['\u2019\u2018`]/g, '_')  // apostrophes → _
    .replace(/\s+/g, '_')               // spaces → _
    .replace(/[^a-z0-9_]/g, '')         // remove anything else
    .replace(/_+/g, '_')                // no double __
    .replace(/^_|_$/g, '');             // trim edges
}

let idLocked = false; // true = ID a été fixé manuellement, ne pas écraser depuis le nom

function _computeItemId() {
  const name = document.getElementById('f-name').value;
  const slug  = nameToId(name);
  const cat   = document.getElementById('f-category').value;
  if (selEvolutif && cat === 'arme') {
    const palier = document.getElementById('f-palier').value;
    return palier ? `${slug}_${palier}` : slug;
  }
  return slug;
}

function onNameInput() {
  if (!idLocked) document.getElementById('f-id').value = _computeItemId();
  update();
}

// ═══════════════════════════════════════════════════
// OBTAIN BUILDER
// ═══════════════════════════════════════════════════
let obtainSources  = [];
let obtainUid      = 0;
let obtainDrop     = null;

let allMobs      = [];
let allDonjons   = [];
let allArtisans  = [];
let allMarchands = [];
let allQuetes    = [];

function initObtainData() {
  if (typeof MOBS !== 'undefined') {
    allMobs = MOBS.map(m => ({
      id: m.id, name: m.name, palier: m.palier, mobType: m.type,
      loot: m.loot || [],
      subtitle: (m.type === 'boss' ? '👑 Boss' : '👾 Monstre') + ' · Palier ' + (m.palier || '?') + (m.region ? ' · ' + m.region : ''),
      search: (m.name + ' ' + m.id + ' ' + (m.region || '')).toLowerCase()
    }));
  }
  if (typeof FLOOR_MARKERS !== 'undefined') {
    const flat = Object.values(FLOOR_MARKERS).flat();
    const toItem = m => ({
      id: m.id, name: m.name, desc: m.desc || '',
      subtitle: m.desc || m.id,
      search: (m.name + ' ' + m.id + ' ' + (m.desc || '')).toLowerCase()
    });
    allDonjons   = flat.filter(m => m.type === 'donjon').map(toItem);
    allArtisans  = flat.filter(m => m.type === 'artisant').map(toItem);
    allMarchands = flat.filter(m => m.type === 'marchand').map(toItem);
  }
  if (typeof QUETES_DATA !== 'undefined') {
    const TYPE_LABELS_Q = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
    allQuetes = QUETES_DATA.map(q => ({
      id: q.id, name: q.titre || q.name || q.id,
      subtitle: (TYPE_LABELS_Q[q.type] || q.type || '') + (q.palier ? ' · Palier ' + q.palier : ''),
      search: ((q.titre || q.name || '') + ' ' + q.id).toLowerCase()
    }));
  }
  onObtainTypeChange();
}

function obtainItemsForType(type) {
  return { mob: allMobs, donjon: allDonjons, artisant: allArtisans, marchand: allMarchands, quete: allQuetes }[type] || [];
}

const OBTAIN_PLACEHOLDERS = {
  mob:      'Rechercher un mob…',
  donjon:   'Rechercher un donjon…',
  artisant: 'Rechercher un forgeron / artisan…',
  quete:    'Rechercher une quête…',
  marchand: 'Rechercher un marchand…',
};

function onObtainTypeChange() {
  const type = document.getElementById('obtain-type').value;
  const container = document.getElementById('obtain-search-container');
  container.innerHTML = '';
  hideLootPicker();

  obtainDrop = makeSearchDrop(obtainItemsForType(type), OBTAIN_PLACEHOLDERS[type], (id) => {
    if (type === 'mob') {
      const mob = allMobs.find(m => m.id === id);
      if (mob) showLootPicker(mob); else hideLootPicker();
      document.getElementById('obtain-add-btn').disabled = true;
    } else {
      hideLootPicker();
      // Sélection = ajout direct (pas besoin de bouton "Ajouter")
      if (id) addObtainSource();
    }
  }, type === 'mob', 'mob');
  container.appendChild(obtainDrop.element);
  document.getElementById('obtain-add-btn').disabled = true;
  // Le bouton "Ajouter" n'est plus nécessaire : sélection = ajout direct
  // (masqué pour mob = loot picker, masqué pour les autres = ajout auto)
  document.getElementById('obtain-add-btn').style.display = 'none';
}

function showLootPicker(mob) {
  const picker  = document.getElementById('obtain-loot-picker');
  const entries = document.getElementById('obtain-loot-entries');
  entries.innerHTML = '';

  if (!mob.loot || !mob.loot.length) {
    entries.innerHTML = '<span style="color:var(--muted);font-size:12px;font-style:italic;">Aucun drop listé pour ce mob.</span>';
    picker.style.display = '';
    return;
  }

  for (const loot of mob.loot) {
    const itemName = (typeof ITEMS !== 'undefined' && ITEMS.find(i => i.id === loot.id)?.name) || loot.id;
    const alreadyAdded = obtainSources.some(s => s.type === 'mob' && s.mobId === mob.id && s.lootId === loot.id);

    const btn = document.createElement('button');
    btn.style.cssText = `padding:5px 12px;border-radius:20px;border:1px solid var(--border);cursor:pointer;font-size:12px;background:var(--surface);color:var(--text);transition:all .15s;${alreadyAdded ? 'opacity:.4;cursor:default;' : ''}`;
    btn.innerHTML = `${itemName} <b style="color:var(--success)">${loot.chance}%</b>${loot.qty ? ' <span style="color:var(--muted)">×'+loot.qty+'</span>' : ''}`;
    if (!alreadyAdded) {
      btn.addEventListener('mouseenter', () => btn.style.background = 'var(--surface2)');
      btn.addEventListener('mouseleave', () => btn.style.background = 'var(--surface)');
      btn.addEventListener('click', () => {
        addObtainMobSource(mob, loot, itemName);
        showLootPicker(mob); // re-render to grey out added entry
      });
    }
    entries.appendChild(btn);
  }
  picker.style.display = '';
}

function hideLootPicker() {
  document.getElementById('obtain-loot-picker').style.display = 'none';
  document.getElementById('obtain-loot-entries').innerHTML = '';
}

function addObtainMobManual() {
  const mob = obtainDrop ? allMobs.find(m => m.id === obtainDrop.getValue()) : null;
  if (!mob) return;
  const chanceRaw = document.getElementById('obtain-manual-chance').value;
  const chance = chanceRaw !== '' ? parseFloat(chanceRaw) : null;
  // Clé unique : mob + pas de lootId (manuel)
  if (obtainSources.some(s => s.type === 'mob' && s.mobId === mob.id && !s.lootId)) return;
  obtainSources.push({
    uid: obtainUid++, type: 'mob',
    id: mob.id, mobId: mob.id, lootId: null,
    name: mob.name, lootName: null,
    palier: mob.palier, mobType: mob.mobType,
    chance, qty: null
  });
  document.getElementById('obtain-manual-chance').value = '';
  renderObtainSources();
  update();
}

function addObtainMobSource(mob, loot, itemName) {
  if (obtainSources.some(s => s.type === 'mob' && s.mobId === mob.id && s.lootId === loot.id)) return;
  obtainSources.push({
    uid: obtainUid++, type: 'mob',
    id: mob.id, mobId: mob.id, lootId: loot.id,
    name: mob.name, lootName: itemName,
    palier: mob.palier, mobType: mob.mobType,
    chance: loot.chance, qty: loot.qty ?? null
  });
  renderObtainSources();
  update();
}

function addObtainSource() {
  const type = document.getElementById('obtain-type').value;
  if (type === 'mob') return; // handled by loot picker
  const id = obtainDrop ? obtainDrop.getValue() : '';
  if (!id) return;

  const item = obtainItemsForType(type).find(it => it.id === id);
  if (!item) return;
  if (obtainSources.some(s => s.id === id && s.type === type)) return;

  obtainSources.push({ uid: obtainUid++, type, id, name: item.name, desc: item.desc, subtitle: item.subtitle });
  obtainDrop.reset();
  document.getElementById('obtain-add-btn').disabled = true;
  renderObtainSources();
  update();
}

function removeObtainSource(uid) {
  obtainSources = obtainSources.filter(s => s.uid !== uid);
  renderObtainSources();
  // Rafraîchit le loot picker si un mob est sélectionné
  if (document.getElementById('obtain-type').value === 'mob') {
    const mobId = obtainDrop?.getValue();
    if (mobId) { const mob = allMobs.find(m => m.id === mobId); if (mob) showLootPicker(mob); }
  }
  update();
}

const OBTAIN_ICONS = { mob:'🗡️', donjon:'🏰', artisant:'🔨', marchand:'🛒', quete:'📜' };

function renderObtainSources() {
  const list = document.getElementById('obtain-sources-list');
  list.innerHTML = '';
  for (const s of obtainSources) {
    const chip = document.createElement('div');
    chip.style.cssText = 'display:flex;align-items:center;justify-content:space-between;gap:8px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;';
    let label = `${OBTAIN_ICONS[s.type] || ''} `;
    if (s.type === 'mob') {
      if (s.lootName) {
        label += `<b>${s.lootName}</b> depuis <span style="color:var(--muted)">${s.name}</span>`;
      } else {
        label += `<span style="color:var(--muted)">Manuel ·</span> <b>${s.name}</b>`;
      }
      if (s.palier) label += ` [P${s.palier}]`;
      if (s.chance != null) label += ` — <b style="color:var(--success)">${s.chance}%</b>`;
      else label += ` <span style="color:var(--muted)">— chance non définie</span>`;
      if (s.qty) label += ` <span style="color:var(--muted)">×${s.qty}</span>`;
    } else if (s.type === 'quete') {
      const href = `Quetes/quetes.html#${encodeURIComponent(s.id)}`;
      label += `<a href="${href}" target="_blank" style="color:var(--accent);text-decoration:none;font-weight:600;">${s.name}</a>`;
      if (s.subtitle) label += ` <span style="color:var(--muted)">— ${s.subtitle}</span>`;
    } else {
      label += `<b>${s.name}</b>`;
      if (s.desc) label += ` <span style="color:var(--muted)">— ${s.desc}</span>`;
    }
    chip.innerHTML = `<span>${label}</span><button class="btn-icon" onclick="removeObtainSource(${s.uid})">✕</button>`;
    list.appendChild(chip);
  }
}

function buildObtainText() {
  const override = document.getElementById('f-obtain-override')?.value?.trim();
  if (override) return override;
  const parts = [];
  const mobs      = obtainSources.filter(s => s.type === 'mob');
  const donjons   = obtainSources.filter(s => s.type === 'donjon');
  const artisans  = obtainSources.filter(s => s.type === 'artisant');
  const marchands = obtainSources.filter(s => s.type === 'marchand');

  const quetes     = obtainSources.filter(s => s.type === 'quete');

  if (mobs.length) {
    // Une ligne par mob : [mob_id|Nom Mob][chance]
    const lines = mobs.map(s => {
      const base = `[${s.mobId}|${s.name}]`;
      return `- ${base}[${s.chance != null ? s.chance : '?'}]`;
    });
    parts.push('Obtenable en tuant:\n' + lines.join('\n'));
  }
  for (const d of donjons)   parts.push(`Obtenable en récompense du [npc:${d.id}|${d.name}]`);
  for (const a of artisans)  parts.push(`Fabricable au [npc:${a.id}|${a.name}]`);
  for (const m of marchands) parts.push(`Achetable au [npc:${m.id}|${m.name}]`);
  for (const q of quetes)    parts.push(`Récompense de la quête [quest:${q.id}|${q.name}]`);
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════
// RARITY
// ═══════════════════════════════════════════════════
function setRarity(r) {
  // Remove old rarity tag
  if (selRarity && RARITY_TAG_MAP[selRarity]) activeTags.delete(RARITY_TAG_MAP[selRarity]);
  // Toggle off if same clicked again
  selRarity = (selRarity === r) ? '' : r;
  // Add new rarity tag
  if (selRarity && RARITY_TAG_MAP[selRarity]) activeTags.add(RARITY_TAG_MAP[selRarity]);
  document.querySelectorAll('.r-btn[data-r]').forEach(b => b.classList.toggle('active', b.dataset.r === selRarity));
  const rarityField = document.getElementById('rarity-field');
  if (rarityField) rarityField.classList.toggle('unset', !selRarity);
  syncPresetTagButtons();
  renderCustomTags();
  update();
}

// ═══════════════════════════════════════════════════
// CLASSES
// ═══════════════════════════════════════════════════
function toggleCls(btn) {
  const c = btn.dataset.c;
  btn.classList.toggle('active');
  if (btn.classList.contains('active')) {
    if (!selClasses.includes(c)) selClasses.push(c);
    if (CLS_TAG_MAP[c]) activeTags.add(CLS_TAG_MAP[c]);
  } else {
    selClasses = selClasses.filter(x => x !== c);
    if (CLS_TAG_MAP[c]) activeTags.delete(CLS_TAG_MAP[c]);
  }
  syncPresetTagButtons();
  renderCustomTags();
  update();
}

// ═══════════════════════════════════════════════════
// CATEGORY CHANGE
// ═══════════════════════════════════════════════════
function buildCatSlotOptions(cat) {
  const sel = document.getElementById('f-cat');
  sel.innerHTML = '<option value="">— Aucun —</option>';
  for (const [val, label] of (SLOT_OPTIONS[cat] || [])) {
    const opt = document.createElement('option');
    opt.value = val; opt.textContent = label;
    sel.appendChild(opt);
  }
  _customSelUpdaters['f-cat']?.();
}

function syncPresetTagButtons() {
  document.querySelectorAll('.p-tag[data-tag]').forEach(b => {
    b.classList.toggle('active', activeTags.has(b.dataset.tag));
  });
}

function onCatSlotChange() {
  const slot = document.getElementById('f-cat').value;
  // Remove all slot tags first
  for (const tag of Object.values(SLOT_TAG_MAP)) activeTags.delete(tag);
  // Add new one
  if (slot && SLOT_TAG_MAP[slot]) activeTags.add(SLOT_TAG_MAP[slot]);
  // Deux mains impossible sur arme secondaire/bouclier
  const twoHandedField = document.getElementById('twohanded-field');
  if (slot === 'arme_s') {
    if (twoHandedField) twoHandedField.style.display = 'none';
    if (selTwoHanded) { selTwoHanded = false; document.getElementById('twohanded-btn').classList.remove('active'); activeTags.delete('Deux Mains'); }
  } else if (document.getElementById('f-category').value === 'arme') {
    if (twoHandedField) twoHandedField.style.display = '';
  }
  syncPresetTagButtons();
  renderCustomTags();
  update();
}

function onCatChange() {
  const cat = document.getElementById('f-category').value;
  const isEquip = ['arme','armure','accessoire'].includes(cat);
  const hasStats = ['arme','armure','accessoire','rune'].includes(cat);
  const isCons  = ['consommable','nourriture'].includes(cat);
  const isArme  = cat === 'arme';
  document.getElementById('stats-section').style.display    = hasStats ? '' : 'none';
  document.getElementById('effects-section').style.display  = isCons  ? '' : 'none';
  document.getElementById('classes-field').style.display    = isEquip ? '' : 'none';
  document.getElementById('twohanded-field').style.display      = isArme           ? '' : 'none';
  document.getElementById('rune-slots-field').style.display     = cat === 'armure' ? '' : 'none';
  if (!isArme) {
    selTwoHanded = false; document.getElementById('twohanded-btn').classList.remove('active');
    selEvolutif  = false; document.getElementById('evolutif-btn').classList.remove('active');
  }
  if (cat !== 'armure') document.getElementById('f-rune-slots').value = '';
  // Rebuild slot options and clear old slot tags
  buildCatSlotOptions(cat);
  for (const tag of Object.values(SLOT_TAG_MAP)) activeTags.delete(tag);
  // Auto-tag catégorie
  const CAT_TAG_MAP = { materiaux:'Matériau', ressources:'Ressource', consommable:'Consommable', nourriture:'Nourriture', outils:'Outil', rune:'Rune', quete:'Quête', donjon:'Donjon' };
  for (const t of Object.values(CAT_TAG_MAP)) activeTags.delete(t);
  if (CAT_TAG_MAP[cat]) activeTags.add(CAT_TAG_MAP[cat]);
  syncPresetTagButtons();
  renderCustomTags();
  update();
}

let selSensible  = false;
let selTwoHanded = false;
let selEvolutif  = false;

function toggleSensible() {
  selSensible = !selSensible;
  document.getElementById('sensible-btn').classList.toggle('active', selSensible);
  update();
}

function onPalierChange() {
  // Remove all palier tags
  ['Palier 1','Palier 2','Palier 3'].forEach(t => activeTags.delete(t));
  const p = document.getElementById('f-palier').value;
  if (p) activeTags.add(`Palier ${p}`);
  syncPresetTagButtons();
  renderCustomTags();
  if (selEvolutif && !idLocked) document.getElementById('f-id').value = _computeItemId();
  update();
}

function toggleEvolutif() {
  selEvolutif = !selEvolutif;
  document.getElementById('evolutif-btn').classList.toggle('active', selEvolutif);
  if (!idLocked) document.getElementById('f-id').value = _computeItemId();
  update();
}


function toggleTwoHanded() {
  selTwoHanded = !selTwoHanded;
  document.getElementById('twohanded-btn').classList.toggle('active', selTwoHanded);
  // Sync tag 'Deux Mains'
  if (selTwoHanded) activeTags.add('Deux Mains');
  else              activeTags.delete('Deux Mains');
  renderCustomTags();
  update();
}

// ═══════════════════════════════════════════════════
// LOAD EXISTING ITEM
// ═══════════════════════════════════════════════════
let allItemsIndex = [];
let allMobsIndex  = [];
let loadDrop = null;

function ensureAllItemsIndex() {
  if (allItemsIndex.length || typeof ITEMS === 'undefined') return;
  const rarityLabel = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
  allItemsIndex = ITEMS.map(it => ({
    id: it.id,
    name: it.name || it.id,
    subtitle: [rarityLabel[it.rarity] || it.rarity, it.category, it.palier ? 'P'+it.palier : ''].filter(Boolean).join(' · '),
    search: ((it.name || '') + ' ' + it.id + ' ' + (it.category || '')).toLowerCase(),
    _raw: it
  }));
}

function ensureAllMobsIndex() {
  if (allMobsIndex.length || typeof MOBS === 'undefined') return;
  allMobsIndex = MOBS.map(m => ({
    id: m.id,
    name: m.name || m.id,
    subtitle: [m.type || '', m.palier ? 'P'+m.palier : '', m.region || ''].filter(Boolean).join(' · '),
    search: ((m.name || '') + ' ' + m.id + ' ' + (m.region || '')).toLowerCase(),
    _raw: m
  }));
}

function initLoadSearch() {
  ensureAllItemsIndex();
  loadDrop = makeSearchDrop(allItemsIndex, 'Rechercher un item à éditer…', (id) => {
    if (!id) return;
    const entry = allItemsIndex.find(it => it.id === id);
    if (entry) loadItem(entry._raw);
  });
  document.getElementById('load-item-search-wrap').appendChild(loadDrop.element);
}

// ── Load search for all modes ──────────────────────────
let _pnjDropBuilt      = false;
let _regDropBuilt      = false;
let _panopDropBuilt    = false;

async function _buildLoadDrops() {
  const getDocs = window._vcl_getDocs;
  const col     = window._vcl_collection;
  const db      = window._vcl_db;
  if (!getDocs || !col || !db) return;

  // ── PNJ ──
  const pnjWrap = document.getElementById('load-pnj-search-wrap');
  if (pnjWrap && !_pnjDropBuilt) {
    try {
      const snap = await getDocs(col(db, 'personnages'));
      const pnjs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (pnjs.length) {
        const idx = pnjs.map(p => {
          const parts = [];
          if (p.palier) parts.push('P' + p.palier);
          if (p.region) parts.push(p.region);
          return {
            id:       p.id || p._id,
            name:     p.name || p.nom || p.id || p._id,
            subtitle: parts.join(' · '),
            search:   ((p.name || p.nom || '') + ' ' + (p.region || '') + ' ' + (p.id || p._id || '')).toLowerCase(),
            _raw: p
          };
        });
        pnjWrap.innerHTML = '';
        const drop = makeSearchDrop(idx, 'Rechercher un PNJ à éditer…', id => {
          if (!id) return;
          const entry = idx.find(p => p.id === id);
          if (entry) loadPnj(entry._raw);
        });
        pnjWrap.appendChild(drop.element);
        _pnjDropBuilt = true;
      }
    } catch(e) { console.warn('[Creator] PNJ dropdown:', e); }
  }

  // ── Région ──
  const regWrap = document.getElementById('load-region-search-wrap');
  if (regWrap && !_regDropBuilt) {
    await loadRegionsCache();
    if (_regionsCache?.length) {
      const idx = _regionsCache.map(r => ({
        id: r.id || r._id,
        name: r.name || r.id || r._id,
        subtitle: r.palier ? 'P' + r.palier : '',
        search: ((r.name || '') + ' ' + (r.id || r._id || '')).toLowerCase(),
        _raw: r
      }));
      regWrap.innerHTML = '';
      const drop = makeSearchDrop(idx, 'Rechercher une région à éditer…', id => {
        if (!id) return;
        const entry = idx.find(r => r.id === id);
        if (entry) loadRegion(entry._raw);
      });
      regWrap.appendChild(drop.element);
      _regDropBuilt = true;
    }
  }

  // ── Panoplie ──
  const panopWrap = document.getElementById('load-panoplie-search-wrap');
  if (panopWrap && !_panopDropBuilt) {
    await loadPanopliesCache();
    if (_panopliesCache?.length) {
      const idx = _panopliesCache.map(p => ({
        id: p.id || p._id,
        name: p.label || p.id || p._id,
        subtitle: '',
        search: ((p.label || '') + ' ' + (p.id || p._id || '')).toLowerCase(),
        _raw: p
      }));
      panopWrap.innerHTML = '';
      const drop = makeSearchDrop(idx, 'Rechercher une panoplie à éditer…', id => {
        if (!id) return;
        const entry = idx.find(p => p.id === id);
        if (entry) loadPanoplie(entry._raw);
      });
      panopWrap.appendChild(drop.element);
      _panopDropBuilt = true;
    }
  }
}

function _buildMobLoadDrop() {
  const mobWrap = document.getElementById('load-mob-search-wrap');
  if (!mobWrap) return;
  ensureAllMobsIndex();
  if (!allMobsIndex.length) return;
  mobWrap.innerHTML = '';
  const drop = makeSearchDrop(allMobsIndex, 'Rechercher un mob à éditer…', id => {
    if (!id) return;
    const entry = allMobsIndex.find(m => m.id === id);
    if (entry) loadMob(entry._raw);
  });
  mobWrap.appendChild(drop.element);
}

function initLoadSearchForAllModes() {
  // Mob — rebuilt in _pageInit once Firestore data is loaded
  const mobWrap = document.getElementById('load-mob-search-wrap');
  if (mobWrap) {
    _buildMobLoadDrop(); // works immediately if MOBS already populated (e.g. hot reload)
  }
  // PNJ / Région / Panoplie — built from _buildLoadDrops() after _pageInit
  _buildLoadDrops();

  // Quête (chargement Firestore à la demande)
  const questWrap = document.getElementById('load-quest-search-wrap');
  if (questWrap) {
    const hint = document.createElement('div');
    hint.style.cssText = 'font-size:12px;color:var(--muted);padding:6px 0;cursor:pointer;';
    hint.textContent = '🔍 Cliquer pour charger les quêtes…';
    questWrap.appendChild(hint);
    hint.addEventListener('click', async () => {
      hint.textContent = 'Chargement…';
      try {
        const db  = window._vcl_db;
        const col = window._vcl_collection;
        const get = window._vcl_getDocs;
        if (!db || !col || !get) { hint.textContent = 'Firestore non disponible.'; return; }
        const snap = await get(col(db, 'quetes'));
        const quests = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
        const idx = quests.map(q => ({
          id: q.id || q._id, name: q.titre || q.id || q._id,
          subtitle: [q.type||'', q.palier ? 'P'+q.palier : ''].filter(Boolean).join(' · '),
          search: ((q.titre||'') + ' ' + (q.id||q._id||'')).toLowerCase(),
          _raw: q
        }));
        questWrap.innerHTML = '';
        const drop = makeSearchDrop(idx, 'Rechercher une quête à éditer…', id => {
          if (!id) return;
          const entry = idx.find(q => (q.id||q._id) === id);
          if (entry) loadQuest(entry._raw);
        });
        questWrap.appendChild(drop.element);
      } catch(e) {
        hint.textContent = '⛔ Erreur : ' + e.message;
      }
    }, { once: true });
  }
}

// ── loadFromData : rempli un formulaire depuis un objet data (sessionStorage / modération) ──
function loadFromData(data, type) {
  switch (type) {
    case 'mob':      loadMob(data);    break;
    case 'pnj':      loadPnj(data);    break;
    case 'region':   loadRegion(data); break;
    case 'quest':    loadQuest(data);  break;
    case 'panoplie': loadPanoplie(data); break;
    default:         loadItem(data);   break;
  }
}

// ── loadPanoplie (parallel to loadMob etc.) ─────────────────────
function loadPanoplie(p) {
  switchMode('panoplie');
  const labelEl = document.getElementById('panop-label');
  const idEl    = document.getElementById('panop-id');
  if (labelEl) labelEl.value = p.label || '';
  if (idEl)    idEl.value    = p.id || p._id || '';
  panopIdLocked = !!(p.id || p._id);
  panopBonuses = [];
  if (p.bonuses?.length) {
    for (const b of p.bonuses) {
      panopBonuses.push({ uid: ++_panopUid, pieces: b.pieces, stat: b.stat, value: b.value });
    }
  }
  renderPanopBonuses();
  // Bannière édition
  const banner = document.getElementById('panoplie-editing-banner');
  const nameEl = document.getElementById('panoplie-editing-name');
  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = p.label || p.id || p._id || '';
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  refreshCustomSelects();
  update();
}

function loadItem(item) {
  switchMode('item');
  resetFormSilent();

  // Bannière
  document.getElementById('editing-name').textContent = item.name || item.id;
  document.getElementById('editing-banner').style.display = 'flex';

  // Identité
  document.getElementById('f-name').value = item.name || '';
  document.getElementById('f-id').value   = item.id   || '';
  idLocked = !!(item.id);

  if (item.rarity)   setRarity(item.rarity);

  if (item.category) {
    document.getElementById('f-category').value = item.category;
    onCatChange();
  }
  if (item.cat)    document.getElementById('f-cat').value    = String(item.cat);
  if (item.palier) document.getElementById('f-palier').value = String(item.palier);
  if (item.lvl)    document.getElementById('f-lvl').value    = String(item.lvl);

  // Set
  if (item.set && setDrop && typeof SETS !== 'undefined' && SETS[item.set]) {
    setDrop.setValue(item.set, SETS[item.set].label);
  }

  // Classes
  // Sensible
  if (item.sensible) {
    selSensible = true;
    document.getElementById('sensible-btn').classList.add('active');
  }

  // Two-handed
  if (item.twoHanded) {
    selTwoHanded = true;
    document.getElementById('twohanded-btn').classList.add('active');
  }

  // Évolutif
  if (item.evolving) {
    selEvolutif = true;
    document.getElementById('evolutif-btn').classList.add('active');
  }

  // Rune slots
  if (item.rune_slots) document.getElementById('f-rune-slots').value = item.rune_slots;

  if (item.classes) {
    selClasses = [...item.classes];
    document.querySelectorAll('.cls-btn').forEach(b => b.classList.toggle('active', item.classes.includes(b.dataset.c)));
  }

  // Stats
  if (item.stats) {
    for (const [id, val] of Object.entries(item.stats)) {
      const minEl = document.getElementById(`smin-${id}`);
      const maxEl = document.getElementById(`smax-${id}`);
      if (!minEl) continue;
      if (Array.isArray(val)) { minEl.value = val[0]; maxEl.value = val[1]; }
      else                    { minEl.value = val;    maxEl.value = '';     }
      onStatInput(id);
    }
  }

  // Craft
  if (item.craft?.length) {
    ensureItemIndex();
    for (const { qty, id } of item.craft) {
      addCraft();
      const entry = craftEntries[craftEntries.length - 1];
      entry.qty = qty || 1;
      entry.itemId = id;
      const row = document.getElementById(`craft-${entry.uid}`);
      if (row) row.querySelector('input[type=number]').value = qty || 1;
      const name = itemIndex.find(it => it.id === id)?.name || id;
      entry.drop?.setValue(id, name);
    }
  }

  // Effects
  if (item.effects?.length) {
    for (const eff of item.effects) {
      addEffect();
      const e = effectEntries[effectEntries.length - 1];
      if (e._type)  e._type.value  = eff.type  || 'heal';
      if (e._val)   e._val.value   = eff.value  ?? '';
      if (e._unit)  e._unit.value  = eff.unit   || '';
      // Durée stockée en secondes → choisir l'unité la plus lisible
      if (e._dur && e._durUnit) {
        const s = eff.duration;
        if (s == null || s === '') { e._dur.value = ''; e._durUnit.value = 's'; }
        else if (s >= 3600 && s % 3600 === 0) { e._dur.value = s / 3600; e._durUnit.value = 'h'; }
        else if (s >= 60 && s % 60 === 0)     { e._dur.value = s / 60;   e._durUnit.value = 'min'; }
        else                                   { e._dur.value = s;        e._durUnit.value = 's'; }
      }
      if (e._label) e._label.value = eff.label  || '';
    }
  }

  // Threshold (prérequis d'attributs)
  if (item.threshold) loadThreshold(item.threshold);

  // Lore
  if (item.lore) document.getElementById('f-lore').value = item.lore;

  // Obtain — texte brut en override
  if (item.obtain) {
    document.getElementById('f-obtain-override').value = item.obtain;
    document.getElementById('obtain-override-wrap').style.display = '';
  }

  // Tags
  if (item.tags?.length) {
    activeTags = new Set(item.tags);
    document.querySelectorAll('.p-tag').forEach(b => b.classList.toggle('active', activeTags.has(b.dataset.tag)));
    renderCustomTags();
  }

  loadDrop?.reset();
  update();
  // Scroll vers le formulaire
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
}

function resetFormSilent() {
  _skipSave = true;
  document.querySelectorAll('#formPanel input[type=text], #formPanel input[type=number], #formPanel textarea').forEach(i => i.value = '');
  document.querySelectorAll('#formPanel select').forEach(s => s.selectedIndex = 0);
  selRarity = ''; selClasses = []; craftEntries = []; effectEntries = []; selTwoHanded = false; selSensible = false; selEvolutif = false; idLocked = false;
  document.getElementById('evolutif-btn')?.classList.remove('active');
  resetThresholdInputs();
  const rarityField = document.getElementById('rarity-field');
  if (rarityField) rarityField.classList.add('unset');
  document.getElementById('sensible-btn').classList.remove('active');
  document.getElementById('twohanded-btn').classList.remove('active');
  activeTags = new Set();
  obtainSources = [];
  if (setDrop) setDrop.reset();
  document.querySelectorAll('.r-btn, .cls-btn, .p-tag').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.stat-row').forEach(r => r.classList.remove('has-val'));
  document.getElementById('craft-list').innerHTML    = '';
  document.getElementById('effects-list').innerHTML  = '';
  document.getElementById('obtain-override-wrap').style.display = 'none';
  renderObtainSources();
  clearForumImage();
  onCatChange();
  refreshCustomSelects();
  _skipSave = false;
  clearSavedForm();
}

function loadMob(mob) {
  switchMode('mob');
  resetMobForm();
  if (mob.id)   { document.getElementById('mob-id').value = mob.id; mobIdLocked = true; }
  if (mob.name)     document.getElementById('mob-name').value  = mob.name;
  if (mob.lore)     document.getElementById('mob-lore').value  = mob.lore;
  if (mob.spawnTime)document.getElementById('mob-spawntime').value = mob.spawnTime;
  if (mob.type)     setMobType(mob.type);
  if (mob.behavior) setBehavior(mob.behavior);
  if (mob.palier)   document.getElementById('mob-palier').value = String(mob.palier);
  if (mob.inCodex !== undefined) setMobCodex(mob.inCodex);
  if (mob.sensible) { mobSensible = true; document.getElementById('mob-sensible-btn').classList.add('active'); }
  if (mob.region) {
    document.getElementById('mob-region').value = mob.region;
    const regionName = _allMobRegions.find(r => r.id === mob.region)?.name || mob.region;
    document.getElementById('mob-region-search').value = regionName;
  }
  if (mob.coords) {
    document.getElementById('mob-x').value = mob.coords.x ?? '';
    document.getElementById('mob-y').value = mob.coords.y ?? '';
    document.getElementById('mob-z').value = mob.coords.z ?? '';
  }
  if (mob.loot?.length) {
    ensureItemIndex();
    for (const l of mob.loot) {
      addMobLoot();
      const entry = mobLootEntries[mobLootEntries.length - 1];
      entry.chance = l.chance !== undefined ? l.chance : 100;
      entry.itemId = l.id;
      const row = document.getElementById(`mob-loot-${entry.uid}`);
      if (row) {
        // Le second enfant du row est le champ chance (après le dropdown)
        const chInput = row.querySelectorAll('input')[0];
        if (chInput) chInput.value = l.chance !== undefined ? l.chance : 100;
        const name = itemIndex.find(it => it.id === l.id)?.name || l.id;
        entry.drop?.setValue(l.id, name);
      }
    }
  }
  // Bannière édition
  const banner = document.getElementById('mob-editing-banner');
  const nameEl = document.getElementById('mob-editing-name');
  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = mob.name || mob.id || '';
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  refreshCustomSelects();
  update();
}

function loadPnj(pnj) {
  switchMode('pnj');
  resetPnjForm();
  if (pnj.id) {
    document.getElementById('pnj-id').value = pnj.id;
    pnjIdLocked = true;
  }
  if (pnj.name) {
    const sel = document.getElementById('pnj-type');
    // Exact match first, then case-insensitive fallback
    const normName = pnj.name.toLowerCase().replace(/\u2019/g, "'");
    const matchOpt = Array.from(sel.options).find(o =>
      o.value === pnj.name || o.value.toLowerCase().replace(/\u2019/g, "'") === normName
    );
    if (matchOpt) sel.value = matchOpt.value;
  }
  if (pnj.region) {
    document.getElementById('pnj-region').value        = pnj.region;
    const regionName = _allMobRegions.find(r => r.id === pnj.region)?.name || pnj.region;
    document.getElementById('pnj-region-search').value = regionName;
  }
  if (pnj.palier) document.getElementById('pnj-palier').value = String(pnj.palier);
  if (pnj.coords) {
    document.getElementById('pnj-x').value = pnj.coords.x ?? '';
    document.getElementById('pnj-y').value = pnj.coords.y ?? '';
    document.getElementById('pnj-z').value = pnj.coords.z ?? '';
  }
  // Restore sells — push entries with data, then render once
  ensureAllItemsIndex();
  const sells = Array.isArray(pnj.sells) ? pnj.sells
    : pnj.sells && typeof pnj.sells === 'object' ? Object.values(pnj.sells) : [];
  for (const s of sells) {
    pnjSells.push({
      uid:    pnjSellUid++,
      itemId: s.id    || '',
      buy:    s.buy   != null ? s.buy   : '',
      price:  s.price != null ? s.price : '',
    });
  }
  if (sells.length) renderPnjSells();
  // Restore crafts — push entries with data, then render once
  const crafts = Array.isArray(pnj.craft) ? pnj.craft
    : pnj.craft && typeof pnj.craft === 'object' ? Object.values(pnj.craft) : [];
  for (const c of crafts) {
    const ings = Array.isArray(c.ingredients) ? c.ingredients
      : c.ingredients && typeof c.ingredients === 'object' ? Object.values(c.ingredients) : [];
    pnjCrafts.push({
      uid:         pnjCraftUid++,
      resultId:    c.id      || '',
      time:        c.time    || '',
      quality:     !!c.quality,
      ingredients: ings.map(i => ({ uid: pnjIngUid++, itemId: i.id || '', qty: i.qty || 1 })),
    });
  }
  if (crafts.length) renderPnjCrafts();
  // Bannière édition
  const banner = document.getElementById('pnj-editing-banner');
  const nameEl = document.getElementById('pnj-editing-name');
  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = pnj.name || pnj.id || '';
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  refreshCustomSelects();
  update();
}

function loadRegion(reg) {
  switchMode('region');
  resetRegionForm();
  if (reg.id)     { document.getElementById('reg-id').value   = reg.id;   regIdLocked = true; }
  if (reg.name)   document.getElementById('reg-name').value = reg.name;
  if (reg.lore)   document.getElementById('reg-lore').value = reg.lore;
  if (reg.palier) document.getElementById('reg-palier').value = String(reg.palier);
  if (reg.inCodex !== undefined) setRegCodex(reg.inCodex);
  if (reg.canTp   !== undefined) setRegCanTp(reg.canTp);
  // Bannière édition
  const banner = document.getElementById('region-editing-banner');
  const nameEl = document.getElementById('region-editing-name');
  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = reg.name || reg.id || '';
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  refreshCustomSelects();
  update();
}

function loadQuest(quest) {
  switchMode('quest');
  if (quest.id)     document.getElementById('quest-id').value    = quest.id;
  if (quest.titre)  document.getElementById('quest-titre').value = quest.titre;
  if (quest.type)   document.getElementById('quest-type').value  = quest.type;
  if (quest.palier) document.getElementById('quest-palier').value = String(quest.palier);
  if (quest.npc)    document.getElementById('quest-npc').value   = quest.npc;
  if (quest.desc)   document.getElementById('quest-desc').value  = quest.desc;
  // Bannière édition
  const banner = document.getElementById('quest-editing-banner');
  const nameEl = document.getElementById('quest-editing-name');
  if (banner) banner.style.display = 'flex';
  if (nameEl) nameEl.textContent = quest.titre || quest.id || '';
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  refreshCustomSelects();
  update();
}

function loadByType(type, obj) {
  switch (type) {
    case 'mob':    loadMob(obj);    break;
    case 'pnj':    loadPnj(obj);    break;
    case 'region': loadRegion(obj); break;
    case 'quest':  loadQuest(obj);  break;
    default:       loadItem(obj);   break;
  }
}

function clearEditingMode() {
  document.getElementById('editing-banner').style.display = 'none';
  resetFormSilent();
  update();
}

function clearMobEditingMode() {
  const b = document.getElementById('mob-editing-banner');
  if (b) b.style.display = 'none';
  resetMobForm();
}

function clearPnjEditingMode() {
  const b = document.getElementById('pnj-editing-banner');
  if (b) b.style.display = 'none';
  resetPnjForm();
}

function clearRegionEditingMode() {
  const b = document.getElementById('region-editing-banner');
  if (b) b.style.display = 'none';
  resetRegionForm();
}

function clearQuestEditingMode() {
  const b = document.getElementById('quest-editing-banner');
  if (b) b.style.display = 'none';
  update();
}

function clearPanoplieEditingMode() {
  const b = document.getElementById('panoplie-editing-banner');
  if (b) b.style.display = 'none';
  panopBonuses = []; panopIdLocked = false;
  const lbl = document.getElementById('panop-label'); if (lbl) lbl.value = '';
  const idd = document.getElementById('panop-id');    if (idd) idd.value = '';
  renderPanopBonuses();
  update();
}

function clearObtainOverride() {
  document.getElementById('f-obtain-override').value = '';
  document.getElementById('obtain-override-wrap').style.display = 'none';
  update();
}

// ═══════════════════════════════════════════════════
// SHARED SEARCHABLE DROPDOWN
// ── Positionnement intelligent des dropdowns ──────────
// Ouvre la liste en-dessous si assez de place, sinon au-dessus.
function positionDrop(list, anchor) {
  const rect = anchor.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - 8;
  const spaceAbove = rect.top - 8;
  const listMaxH = 200;
  if (spaceBelow < listMaxH && spaceAbove > spaceBelow) {
    list.style.top    = 'auto';
    list.style.bottom = 'calc(100% + 4px)';
    list.classList.add('drop-up');
  } else {
    list.style.top    = 'calc(100% + 4px)';
    list.style.bottom = 'auto';
    list.classList.remove('drop-up');
  }
}

// ═══════════════════════════════════════════════════
// CUSTOM SELECT — remplace les <select> natifs par des
// dropdowns stylés identiques aux search-drops
// ═══════════════════════════════════════════════════
const _customSelUpdaters = {};

function initCustomSelects() {
  document.querySelectorAll('.field select').forEach(nativeSel => {
    const wrap = document.createElement('div');
    wrap.className = 'custom-sel-wrap';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'custom-sel-trigger';

    const valSpan = document.createElement('span');
    valSpan.className = 'custom-sel-value';

    trigger.appendChild(valSpan);
    trigger.insertAdjacentHTML('beforeend',
      '<svg class="custom-sel-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 6">' +
      '<path fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" d="M1 1l4 4 4-4"/></svg>'
    );

    const list = document.createElement('div');
    list.className = 'drop-list';

    wrap.appendChild(trigger);
    wrap.appendChild(list);

    function updateDisplay() {
      const opt = nativeSel.options[nativeSel.selectedIndex];
      const hasVal = opt && opt.value !== '';
      valSpan.textContent = opt ? opt.text : '';
      valSpan.classList.toggle('custom-sel-placeholder', !hasVal);
    }

    function buildListItems() {
      list.innerHTML = '';
      const curVal = nativeSel.value;
      Array.from(nativeSel.options).forEach(opt => {
        const di = document.createElement('div');
        di.className = 'drop-item';
        di.textContent = opt.text;
        if (!opt.value) di.style.cssText = 'color:var(--muted);font-style:italic;';
        if (opt.value && opt.value === curVal) di.classList.add('focused');
        di.addEventListener('mousedown', ev => {
          ev.preventDefault();
          nativeSel.value = opt.value;
          nativeSel.dispatchEvent(new Event('change', { bubbles: true }));
          list.classList.remove('open');
          trigger.classList.remove('open');
          updateDisplay();
        });
        list.appendChild(di);
      });
    }

    trigger.addEventListener('click', () => {
      const isOpen = list.classList.contains('open');
      document.querySelectorAll('.drop-list.open').forEach(d => d.classList.remove('open'));
      document.querySelectorAll('.custom-sel-trigger.open').forEach(t => t.classList.remove('open'));
      if (!isOpen) {
        buildListItems();
        positionDrop(list, wrap);
        list.classList.add('open');
        trigger.classList.add('open');
      }
    });

    trigger.addEventListener('blur', () => setTimeout(() => {
      list.classList.remove('open');
      trigger.classList.remove('open');
    }, 150));

    // Mettre à jour l'affichage quand le select natif change (via dispatchEvent)
    nativeSel.addEventListener('change', updateDisplay);

    nativeSel.style.display = 'none';
    nativeSel.parentNode.insertBefore(wrap, nativeSel);
    wrap.appendChild(nativeSel);

    if (nativeSel.id) _customSelUpdaters[nativeSel.id] = updateDisplay;
    updateDisplay();
  });
}

function refreshCustomSelects() {
  Object.values(_customSelUpdaters).forEach(fn => fn());
}

// items: [{ id, name, search }]
// onSelect(id, name) appelé à chaque sélection / désélection
// Retourne { mount(container), getValue, reset }
// ═══════════════════════════════════════════════════
function makeSearchDrop(items, placeholder, onSelect, allowCreate = false, createEntityType = 'item') {
  let selectedId = '';
  let focusedIdx = -1;

  const wrap = document.createElement('div');
  wrap.className = 'search-drop-wrap';

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.placeholder = placeholder;

  const list = document.createElement('div');
  list.className = 'drop-list';

  wrap.appendChild(inp);
  wrap.appendChild(list);

  function openDrop(q) {
    q = q.toLowerCase();
    const results = q.length < 1
      ? []
      : items.filter(it => it.search.includes(q)).slice(0, 40);
    list.innerHTML = '';
    focusedIdx = -1;
    if (q.length >= 1 && !results.length) {
      if (allowCreate) {
        const suggestedId = nameToId(inp.value);
        const di = document.createElement('div');
        di.className = 'drop-item';
        di.style.cssText = 'border-left:3px solid #d7af5f;';
        di.innerHTML = `<span class="drop-item-name" style="color:#d7af5f;">➕ Créer « ${escHtml(inp.value)} »</span><span class="drop-item-id" style="color:#d7af5f;">→ ${escHtml(suggestedId)} · orphelin</span>`;
        di.addEventListener('mousedown', ev => {
          ev.preventDefault();
          const originalName = inp.value;
          if (createEntityType !== 'item') addPendingOrphan(suggestedId, originalName, createEntityType);
          selectedId = suggestedId;
          inp.value = originalName;
          inp.classList.remove('selected-item');
          inp.classList.add('orphan-item');
          list.classList.remove('open');
          onSelect(suggestedId, originalName);
        });
        list.appendChild(di);
      } else {
        list.innerHTML = '<div class="drop-empty">Aucun résultat.</div>';
      }
    } else {
      results.forEach(it => {
        const di = document.createElement('div');
        di.className = 'drop-item';
        di.innerHTML = `<span class="drop-item-name">${escHtml(it.name)}</span><span class="drop-item-id">${escHtml(it.subtitle || it.id)}</span>`;
        di.addEventListener('mousedown', ev => { ev.preventDefault(); pick(it); });
        list.appendChild(di);
      });
    }
    const willOpen = q.length >= 1;
    if (willOpen) positionDrop(list, wrap);
    list.classList.toggle('open', willOpen);
  }

  function pick(it) {
    selectedId = it.id;
    inp.value = it.name;
    inp.classList.add('selected-item');
    list.classList.remove('open');
    onSelect(it.id, it.name);
  }

  inp.addEventListener('input', () => {
    selectedId = '';
    inp.classList.remove('selected-item', 'orphan-item');
    openDrop(inp.value);
    onSelect('', '');
  });
  inp.addEventListener('focus', () => {
    if (!inp.classList.contains('selected-item')) openDrop(inp.value);
  });
  inp.addEventListener('blur', () => setTimeout(() => list.classList.remove('open'), 150));
  inp.addEventListener('keydown', ev => {
    const rows = list.querySelectorAll('.drop-item');
    if (ev.key === 'ArrowDown') { ev.preventDefault(); focusedIdx = Math.min(focusedIdx+1, rows.length-1); }
    else if (ev.key === 'ArrowUp') { ev.preventDefault(); focusedIdx = Math.max(focusedIdx-1, 0); }
    else if (ev.key === 'Enter') { ev.preventDefault(); const target = focusedIdx >= 0 ? rows[focusedIdx] : rows[0]; target?.dispatchEvent(new Event('mousedown')); return; }
    else if (ev.key === 'Escape') { list.classList.remove('open'); return; }
    rows.forEach((el, i) => el.classList.toggle('focused', i === focusedIdx));
  });

  return {
    element: wrap,
    getValue: () => selectedId,
    setValue: (id, name) => { selectedId = id; inp.value = name || ''; inp.classList.toggle('selected-item', !!id); inp.classList.remove('orphan-item'); },
    reset: () => { selectedId = ''; inp.value = ''; inp.classList.remove('selected-item', 'orphan-item'); list.classList.remove('open'); }
  };
}

// ═══════════════════════════════════════════════════
// PENDING ORPHANS
// ═══════════════════════════════════════════════════
function addPendingOrphan(id, displayName, entityType = 'item') {
  if (entityType === 'item' && typeof ITEMS !== 'undefined' && ITEMS.some(it => it.id === id)) return;
  if (entityType === 'mob'  && typeof MOBS  !== 'undefined' && MOBS.some(m => m.id === id))   return;
  pendingOrphans.set(id, { name: displayName, entityType });
  // Pour les mobs orphelins : ajouter une entrée synthétique dans allMobs
  // pour que le loot picker et addObtainMobManual puissent le trouver
  if (entityType === 'mob' && !allMobs.some(m => m.id === id)) {
    allMobs.push({
      id, name: displayName, palier: null, mobType: 'monstre', loot: [],
      subtitle: '👾 Monstre · Orphelin',
      search: (displayName + ' ' + id).toLowerCase()
    });
  }
  buildOrphanSection();
}

// ═══════════════════════════════════════════════════
// SET SEARCH
// ═══════════════════════════════════════════════════
let setDrop = null;

function buildSetSelect() {
  if (typeof SETS === 'undefined') return;
  const container = document.getElementById('set-drop-container');
  if (!container) return;
  const setItems = Object.entries(SETS)
    .sort((a, b) => (a[1].ordre ?? 999) - (b[1].ordre ?? 999))
    .map(([id, { label }]) => ({
      id, name: label, search: (label + ' ' + id).toLowerCase()
    }));
  setDrop = makeSearchDrop(setItems, 'Rechercher un set…', () => update());
  container.innerHTML = '';
  container.appendChild(setDrop.element);
}

// ═══════════════════════════════════════════════════
// CRAFT
// ═══════════════════════════════════════════════════
let itemIndex = [];
const CRAFT_CATEGORIES = new Set(['materiaux','ressources','monnaie','donjon','quete','arme','armure','accessoire']);

function ensureItemIndex() {
  if (itemIndex.length) return;
  if (typeof ITEMS === 'undefined') return;
  itemIndex = ITEMS
    .filter(it => CRAFT_CATEGORIES.has(it.category))
    .map(it => ({
      id: it.id,
      name: it.name || it.id,
      search: ((it.name || '') + ' ' + it.id).toLowerCase()
    }));

  // Ajouter les IDs orphelins (référencés en craft mais absents de ITEMS)
  const knownIds = new Set(ITEMS.map(i => i.id));
  const orphanIds = [];
  const seenOrphans = new Set();
  for (const item of ITEMS) {
    if (!item.craft) continue;
    for (const c of item.craft) {
      if (c.id && !knownIds.has(c.id) && !seenOrphans.has(c.id) && !CURRENCIES[c.id]) {
        seenOrphans.add(c.id);
        orphanIds.push(c.id);
        itemIndex.push({ id: c.id, name: `${c.id} ⚠️`, search: c.id.toLowerCase() });
      }
    }
  }

  // Afficher la barre des orphelins
  if (orphanIds.length) {
    const bar  = document.getElementById('orphan-ids-bar');
    const list = document.getElementById('orphan-ids-list');
    if (bar && list) {
      list.innerHTML = '';
      orphanIds.forEach(id => {
        const chip = document.createElement('button');
        chip.className = 'btn btn-ghost btn-sm';
        chip.style.cssText = 'font-size:11px;padding:3px 8px;border-color:#4a3a10;color:#e8d44a;';
        chip.textContent = id;
        chip.onclick = () => {
          addCraftEntry(id, id);
          chip.style.opacity = '0.4';
          chip.disabled = true;
        };
        list.appendChild(chip);
      });
      bar.style.display = '';
    }
  }
}

function addCraft() {
  ensureItemIndex();
  const uid = craftUid++;
  const entry = { uid, itemId: '', qty: 1 };
  craftEntries.push(entry);

  const row = document.createElement('div');
  row.className = 'craft-item';
  row.id = `craft-${uid}`;

  const qtyInp = document.createElement('input');
  qtyInp.type = 'number'; qtyInp.min = '1'; qtyInp.value = '1'; qtyInp.placeholder = 'Qté';
  qtyInp.addEventListener('input', () => { entry.qty = parseInt(qtyInp.value) || 1; update(); });

  const drop = makeSearchDrop(itemIndex, 'Rechercher un ingrédient…', (id) => {
    const alreadyUsed = id && craftEntries.some(e => e.uid !== uid && e.itemId === id);
    if (alreadyUsed) {
      drop.setValue('', '');
      entry.itemId = '';
      return;
    }
    entry.itemId = id;
    const inp = drop?.element.querySelector('input');
    if (inp) { inp.readOnly = !!id; inp.style.cursor = id ? 'default' : ''; }
    update();
  }, true);
  entry.drop = drop;

  const rmBtn = document.createElement('button');
  rmBtn.className = 'btn-icon'; rmBtn.textContent = '✕';
  rmBtn.addEventListener('click', () => { craftEntries = craftEntries.filter(e => e.uid !== uid); row.remove(); update(); });

  row.appendChild(qtyInp);
  row.appendChild(drop.element);
  row.appendChild(rmBtn);
  document.getElementById('craft-list').appendChild(row);
}

function addCraftEntry(id, name) {
  if (craftEntries.some(e => e.itemId === id)) return;
  addCraft();
  const entry = craftEntries[craftEntries.length - 1];
  entry.itemId = id;
  entry.drop?.setValue(id, name);
  update();
}

function getCraft() {
  return craftEntries.filter(e => e.itemId).map(e => ({ qty: e.qty, id: e.itemId }));
}

// ═══════════════════════════════════════════════════
// EFFECTS
// ═══════════════════════════════════════════════════
const EFFECT_TYPES = ['heal','mana','stamina','regen','buff','feed','debuff','cooldown','use','level','force','arcane','healing','mana_heal','stam_heal','crit_c','crit_d','res','dex_att','force_att','esp_att','intel_att','vita_att','def_att'];

const EFFECT_TEMPLATES = [
  { label:'❤️ Soin',         effects:[{ type:'heal',    value:50  }] },
  { label:'💧 Mana',         effects:[{ type:'mana',    value:30  }] },
  { label:'👟 Stamina',      effects:[{ type:'stamina', value:40  }] },
  { label:'🍖 Nourriture',   effects:[{ type:'feed',    value:30  }, { type:'regen', value:2, unit:'PV/s' }] },
  { label:'💓 Régén. soin',  effects:[{ type:'regen',   value:5,  unit:'PV/s' }] },
  { label:'💪 Buff force',   effects:[{ type:'buff',    value:10, unit:'% dégâts' }] },
  { label:'☠️ Poison',       effects:[{ type:'debuff',  value:5,  unit:'dégâts/s' }] },
  { label:'🧪 Plein soins',  effects:[{ type:'heal',    value:100 }, { type:'mana', value:50 }, { type:'stamina', value:50 }] },
];

function buildEffectTemplates() {
  const container = document.getElementById('effect-templates');
  container.innerHTML = '';
  for (const tpl of EFFECT_TEMPLATES) {
    const btn = document.createElement('button');
    btn.className = 'p-tag';
    btn.textContent = tpl.label;
    btn.addEventListener('click', () => applyEffectTemplate(tpl));
    container.appendChild(btn);
  }
}

function applyEffectTemplate(tpl) {
  // Apply template effects
  for (const eff of tpl.effects) {
    addEffect();
    const e = effectEntries[effectEntries.length - 1];
    if (e._type)  e._type.value  = eff.type;
    if (e._val)   e._val.value   = eff.value  ?? '';
    if (e._unit)  e._unit.value  = eff.unit   || '';
    if (e._label) e._label.value = eff.label  || '';
  }
  update();
}

function addEffect() {
  const uid = effectUid++;
  effectEntries.push({ uid });

  const row = document.createElement('div');
  row.id = `eff-${uid}`;
  row.style.cssText = 'display:grid;grid-template-columns:110px 70px 70px 60px 55px 1fr auto;gap:6px;align-items:center;';

  const makeInp = (placeholder, type='text', opts='') => {
    const el = document.createElement('input');
    el.type = type; el.placeholder = placeholder;
    if (type === 'number') el.step = 'any';
    el.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;width:100%';
    el.addEventListener('focus', () => el.style.borderColor = 'var(--accent)');
    el.addEventListener('blur',  () => el.style.borderColor = 'var(--border)');
    el.addEventListener('input', update);
    return el;
  };

  const typeSel = document.createElement('select');
  typeSel.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;width:100%';
  typeSel.innerHTML = EFFECT_TYPES.map(t => `<option value="${t}">${t}</option>`).join('');
  typeSel.addEventListener('change', update);

  const valInp   = makeInp('Valeur','number');
  const unitInp  = makeInp('PV / s…');
  const durInp   = makeInp('Durée','number');
  const durUnitSel = document.createElement('select');
  durUnitSel.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:5px;color:var(--text);padding:6px 4px;font-size:12px;outline:none;width:100%';
  durUnitSel.innerHTML = '<option value="s">s</option><option value="min">min</option><option value="h">h</option>';
  durUnitSel.addEventListener('change', update);
  const labelInp = makeInp('Label (optionnel)');

  const rmBtn = document.createElement('button');
  rmBtn.className = 'btn-icon';
  rmBtn.textContent = '✕';
  rmBtn.addEventListener('click', () => {
    effectEntries = effectEntries.filter(e => e.uid !== uid);
    row.remove();
    update();
  });

  row.appendChild(typeSel);
  row.appendChild(valInp);
  row.appendChild(unitInp);
  row.appendChild(durInp);
  row.appendChild(durUnitSel);
  row.appendChild(labelInp);
  row.appendChild(rmBtn);
  document.getElementById('effects-list').appendChild(row);

  // Store refs
  const entry = effectEntries.find(e => e.uid === uid);
  entry._type = typeSel; entry._val = valInp; entry._unit = unitInp;
  entry._dur = durInp; entry._durUnit = durUnitSel; entry._label = labelInp;
}

function getEffects() {
  return effectEntries.map(e => {
    const obj = { type: e._type.value };
    const v = parseFloat(e._val.value);
    if (!isNaN(v)) obj.value = v;
    const u = e._unit.value.trim(); if (u) obj.unit = u;
    // Durée : stockée en secondes (canonique) pour rester compatible avec le compendium
    const d = parseFloat(e._dur?.value);
    if (!isNaN(d) && d > 0) {
      const mult = e._durUnit?.value === 'h' ? 3600 : e._durUnit?.value === 'min' ? 60 : 1;
      obj.duration = Math.round(d * mult);
    }
    const l = e._label.value.trim(); if (l) obj.label = l;
    return obj;
  });
}

// ═══════════════════════════════════════════════════
// TAGS
// ═══════════════════════════════════════════════════
function buildPresetTags() {
  const container = document.getElementById('preset-tags-container');
  for (const { label, tags } of PRESET_TAG_GROUPS) {
    const glabel = document.createElement('span');
    glabel.className = 'preset-group-label';
    glabel.textContent = label;
    container.appendChild(glabel);

    for (const tag of tags) {
      const btn = document.createElement('button');
      btn.className = 'p-tag';
      btn.textContent = tag;
      btn.dataset.tag = tag;
      btn.addEventListener('click', () => {
        if (activeTags.has(tag)) {
          activeTags.delete(tag);
          btn.classList.remove('active');
        } else {
          activeTags.add(tag);
          btn.classList.add('active');
        }
        renderCustomTags();
        update();
      });
      container.appendChild(btn);
    }
  }
}

function onTagKey(e) {
  if ((e.key === 'Enter' || e.key === ',') && e.target.value.trim()) {
    e.preventDefault();
    addCustomTag(e.target.value.trim());
    e.target.value = '';
  } else if (e.key === 'Backspace' && !e.target.value) {
    // remove last custom (non-preset) tag
    const customTags = [...activeTags].filter(t => !isPresetTag(t));
    if (customTags.length) {
      activeTags.delete(customTags[customTags.length - 1]);
      renderCustomTags();
      update();
    }
  }
}

function isPresetTag(t) {
  return PRESET_TAG_GROUPS.some(g => g.tags.includes(t));
}

function addCustomTag(val) {
  activeTags.add(val);
  renderCustomTags();
  update();
}

function renderCustomTags() {
  const area = document.getElementById('tag-area');
  const input = document.getElementById('tag-input');
  area.querySelectorAll('.tag-chip').forEach(c => c.remove());
  // Only show custom (non-preset) tags as chips
  for (const t of activeTags) {
    if (isPresetTag(t)) continue;
    const chip = document.createElement('span');
    chip.className = 'tag-chip';
    chip.innerHTML = `${t} <button onclick="removeCustomTag('${t.replace(/'/g,"\\'")}')">×</button>`;
    area.insertBefore(chip, input);
  }
}

function removeCustomTag(t) {
  activeTags.delete(t);
  renderCustomTags();
  update();
}

// ═══════════════════════════════════════════════════
// SECTION TOGGLE
// ═══════════════════════════════════════════════════
function toggleSec(head) {
  head.classList.toggle('collapsed');
  head.nextElementSibling.classList.toggle('hidden');
}

// ═══════════════════════════════════════════════════
// PREVIEW
// ═══════════════════════════════════════════════════
const RARITY_COLORS = {
  commun:'#59d059', rare:'#2a5fa8', epique:'#6a3daa',
  legendaire:'#d7af5f', mythique:'#f5b5e4', godlike:'#a83020', event:'#ebebeb'
};
const RARITY_LABELS = {
  commun:'Commun', rare:'Rare', epique:'Épique',
  legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event'
};
const CAT_ICONS = {
  arme:'⚔️', armure:'🛡️', accessoire:'💍', consommable:'🧪',
  nourriture:'🍖', materiaux:'🧱', ressources:'⛏️', outils:'🛠️',
  rune:'🔮', quete:'📜', donjon:'🏰', monnaie:'🪙'
};

// Transforme le format obtain [npc:id|Name] / [mob_id|Name][chance] en HTML lisible
function renderObtainHtml(text) {
  if (!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;

  lines.forEach(raw => {
    const line = raw.trim();
    if (line.match(/^[-*]\s+/)) {
      if (!inList) { html += '<ul style="margin:4px 0 4px 0;padding:0;list-style:none;">'; inList = true; }
      const content = line.replace(/^[-*]\s+/, '');
      html += `<li style="display:flex;align-items:baseline;gap:5px;padding:1px 0;">`
            + `<span style="color:var(--accent);font-size:9px;flex-shrink:0;">◆</span>`
            + `<span>${_renderObtainInline(content)}</span></li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line === '') { html += '<br>'; }
      else { html += `<span style="display:block;">${_renderObtainInline(line)}</span>`; }
    }
  });

  if (inList) html += '</ul>';
  return html;
}

function _renderObtainInline(text) {
  return escHtml(text)
    // **gras**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // [npc:id|Nom] → badge violet
    .replace(/\[npc:([^\]|]+)\|([^\]]+)\]/g,
      (_, id, name) => `<span style="color:var(--accent);background:rgba(122,90,248,.12);border:1px solid rgba(122,90,248,.3);border-radius:4px;padding:0 5px;font-size:10px;" title="${id}">${name}</span>`)
    // [mob_id|Nom][chance] → badge rouge avec %
    .replace(/\[([^\]:]+)\|([^\]]+)\]\[(\d+(?:\.\d+)?)\]/g,
      (_, id, name, chance) => `<span style="color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:4px;padding:0 5px;font-size:10px;" title="${id}">${name} <b>${chance}%</b></span>`)
    // [mob_id|Nom] sans chance
    .replace(/\[([^\]:]+)\|([^\]]+)\]/g,
      (_, id, name) => `<span style="color:#f87171;background:rgba(248,113,113,.1);border:1px solid rgba(248,113,113,.25);border-radius:4px;padding:0 5px;font-size:10px;" title="${id}">${name}</span>`);
}

// escHtml → défini dans /utils.js

function switchTab(tab) {
  ['preview','history'].forEach(t => {
    document.getElementById('tab-'+t).classList.toggle('active', t === tab);
    document.getElementById('pane-'+t).classList.toggle('active', t === tab);
  });
}

function renderPreview() {
  const wrap = document.getElementById('preview-wrap');
  const obj  = buildObj();

  if (!obj.id && !obj.name) {
    wrap.innerHTML = '';
    return;
  }

  const rc = RARITY_COLORS[obj.rarity] || '#7a7a90';
  const rl = RARITY_LABELS[obj.rarity] || (obj.rarity || '');
  const ci = CAT_ICONS[obj.category]   || '📦';

  let h = `<div class="item-card">`;

  // Header
  h += `<div class="ic-header">`;
  h += `<div class="ic-img">${ci}</div>`;
  h += `<div class="ic-info">`;
  if (obj.name)   h += `<div class="ic-name">${escHtml(obj.name)}</div>`;
  if (obj.rarity) h += `<div class="ic-rarity" style="color:${rc}"><span class="ic-rarity-dot" style="background:${rc}"></span>${escHtml(rl)}</div>`;
  const meta = [];
  if (obj.category) meta.push(escHtml(obj.category));
  if (obj.cat)      meta.push(escHtml(obj.cat));
  if (obj.palier)   meta.push('Palier ' + obj.palier);
  if (obj.lvl)      meta.push('Niv. ' + obj.lvl);
  if (obj.twoHanded) meta.push('Deux mains');
  if (meta.length)   h += `<div class="ic-meta">${meta.join(' · ')}</div>`;
  if (selClasses.length) {
    h += `<div class="ic-classes">`;
    for (const c of selClasses) h += `<span class="ic-class">${escHtml(c)}</span>`;
    h += `</div>`;
  }
  h += `</div></div>`;

  // Body
  h += `<div class="ic-body">`;

  // Set
  if (obj.set && typeof SETS !== 'undefined' && SETS[obj.set]) {
    h += `<div class="ic-set">◆ ${escHtml(SETS[obj.set].label)}</div>`;
  }

  // Stats
  if (obj.stats && Object.keys(obj.stats).length) {
    h += `<div><div class="ic-section-label">Stats</div><div class="ic-stats">`;
    for (const [sid, val] of Object.entries(obj.stats)) {
      let slabel = sid;
      for (const { stats } of STAT_DEFS) {
        const s = stats.find(s => s.id === sid);
        if (s) { slabel = s.label; break; }
      }
      const vs = Array.isArray(val) ? `${val[0]} – ${val[1]}` : String(val);
      h += `<div class="ic-stat"><span class="ic-stat-label">${escHtml(slabel)}</span><span class="ic-stat-val">${escHtml(vs)}</span></div>`;
    }
    h += `</div></div>`;
  }

  // Effects
  if (obj.effects?.length) {
    h += `<div><div class="ic-section-label">Effets</div><div class="ic-stats">`;
    for (const eff of obj.effects) {
      const m     = (typeof EFFECT_META !== 'undefined' && EFFECT_META[eff.type]) || null;
      const icon  = m?.icon  || '✨';
      const color = m?.color || '#7a7a90';
      const lbl   = m?.label || eff.type;
      const pre   = m?.prefix ?? '';
      const vs    = eff.value !== undefined ? `${pre}${eff.value}${eff.unit ? ' '+eff.unit : ''}` : lbl;
      h += `<div class="ic-stat"><span class="ic-stat-label" style="color:${color}">${icon} ${escHtml(lbl)}</span><span class="ic-stat-val" style="color:${color}">${escHtml(vs)}</span></div>`;
    }
    h += `</div></div>`;
  }

  // Lore
  if (obj.lore) {
    h += `<div class="ic-lore">${escHtml(obj.lore).replace(/\n/g,'<br>')}</div>`;
  }

  // Obtain
  if (obj.obtain) {
    h += `<div><div class="ic-section-label">Obtention</div><div class="ic-obtain">${renderObtainHtml(obj.obtain)}</div></div>`;
  }

  // Craft
  if (obj.craft?.length) {
    h += `<div><div class="ic-section-label">Craft</div><div class="ic-stats">`;
    for (const c of obj.craft) {
      const cname = (typeof ITEMS !== 'undefined' && ITEMS.find(i => i.id === c.id)?.name) || c.id;
      h += `<div class="ic-stat"><span class="ic-stat-label">${escHtml(cname)}</span><span class="ic-stat-val">×${c.qty}</span></div>`;
    }
    h += `</div></div>`;
  }

  // Tags
  if (obj.tags?.length) {
    h += `<div class="ic-tags">`;
    for (const t of obj.tags) h += `<span class="ic-tag">${escHtml(t)}</span>`;
    h += `</div>`;
  }

  h += `</div></div>`;
  wrap.innerHTML = h;
}

function renderMobPreview() {
  const wrap = document.getElementById('preview-wrap');
  const obj  = buildMobObj();

  if (!obj.id && !obj.name) {
    wrap.innerHTML = '';
    return;
  }

  const TYPE_ICONS  = { monstre:'🐺', miniboss:'⚔️', mini_boss:'⚔️', boss:'💀', sbire:'🗡️' };
  const TYPE_LABELS = { monstre:'Monstre', miniboss:'Mini-Boss', mini_boss:'Mini-Boss', boss:'Boss', sbire:'Sbire' };
  const TYPE_COLORS = { monstre:'#9a9ab0', miniboss:'#f59e0b', mini_boss:'#f59e0b', boss:'#f87171', sbire:'#a07ae8' };
  const BEH_LABELS  = { agressif:'Agressif', neutre:'Neutre', passif:'Passif' };
  const BEH_COLORS  = { agressif:'#f87171', neutre:'#fbbf24', passif:'#4ade80' };

  const tc = TYPE_COLORS[obj.type] || '#9a9ab0';
  const tl = TYPE_LABELS[obj.type] || obj.type || '';
  const ti = TYPE_ICONS[obj.type]  || '👾';
  const bc = BEH_COLORS[obj.behavior] || '#9a9ab0';
  const bl = BEH_LABELS[obj.behavior] || obj.behavior || '';
  const regionName = _allMobRegions.find(r => r.id === obj.region)?.name || obj.region || '';

  let h = `<div class="mob-card">`;

  // Header
  h += `<div class="mob-card-header">`;
  h += `<div class="mob-card-name">${ti} ${escHtml(obj.name || '')}</div>`;
  h += `<div class="mob-card-meta">`;
  h += `<span class="mob-card-badge" style="background:${tc}22;color:${tc};border:1px solid ${tc}55;">${tl}</span>`;
  h += `<span class="mob-card-badge" style="background:${bc}22;color:${bc};border:1px solid ${bc}55;">${bl}</span>`;
  if (obj.palier)   h += `<span style="color:var(--muted)">Palier ${obj.palier}</span>`;
  if (regionName)   h += `<span style="color:var(--muted)">📍 ${escHtml(regionName)}</span>`;
  if (obj.inCodex)  h += `<span class="mob-card-badge" style="background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.3);">Codex</span>`;
  if (obj.sensible) h += `<span class="mob-card-badge" style="background:rgba(248,113,113,.12);color:#f87171;border:1px solid rgba(248,113,113,.3);">🔒 Sensible</span>`;
  if (obj.spawnTime) h += `<span style="color:var(--muted)">⏱ ${escHtml(obj.spawnTime)}</span>`;
  h += `</div></div>`;

  // Body
  h += `<div class="mob-card-body">`;
  if (obj.lore) h += `<div class="ic-lore">${escHtml(obj.lore).replace(/\n/g,'<br>')}</div>`;

  if (obj.loot?.length) {
    h += `<div><div class="ic-section-label">Loot</div><div class="ic-stats">`;
    for (const l of obj.loot) {
      const iname = (typeof ITEMS !== 'undefined' && ITEMS.find(i => i.id === l.id)?.name) || l.id;
      const ch    = l.chance === '?' ? '?' : l.chance + '%';
      h += `<div class="ic-stat"><span class="ic-stat-label">${escHtml(iname)}</span><span class="ic-stat-val">${escHtml(String(ch))}</span></div>`;
    }
    h += `</div></div>`;
  }

  h += `</div></div>`;
  wrap.innerHTML = h;
}

function renderRegionPreview() {
  const wrap = document.getElementById('preview-wrap');
  const obj  = buildRegionObj();

  if (!obj.id && !obj.name) {
    wrap.innerHTML = '';
    return;
  }

  const PALIER_COLORS = { 1:'#4ade80', 2:'#f59e0b', 3:'#f87171' };
  const pc = PALIER_COLORS[obj.palier] || '#9a9ab0';

  let h = `<div class="mob-card">`;

  // Header
  h += `<div class="mob-card-header">`;
  h += `<div class="mob-card-name">📍 ${escHtml(obj.name || '')}</div>`;
  h += `<div class="mob-card-meta">`;
  if (obj.palier) h += `<span class="mob-card-badge" style="background:${pc}22;color:${pc};border:1px solid ${pc}55;">Palier ${obj.palier}</span>`;
  if (obj.inCodex) h += `<span class="mob-card-badge" style="background:rgba(74,222,128,.1);color:#4ade80;border:1px solid rgba(74,222,128,.3);">📖 Codex</span>`;
  if (obj.canTp === true)  h += `<span class="mob-card-badge" style="background:rgba(96,165,250,.1);color:#60a5fa;border:1px solid rgba(96,165,250,.3);">✈️ Téléportation</span>`;
  if (obj.canTp === false) h += `<span class="mob-card-badge" style="background:rgba(156,163,175,.1);color:#9ca3af;border:1px solid rgba(156,163,175,.3);">🚫 Sans TP</span>`;
  h += `</div>`;
  if (obj.id) h += `<div style="font-size:10px;color:var(--muted);font-family:monospace;margin-top:4px;">${escHtml(obj.id)}</div>`;
  h += `</div>`;

  // Body
  h += `<div class="mob-card-body">`;
  if (obj.lore) h += `<div class="ic-lore">${escHtml(obj.lore).replace(/\n/g,'<br>')}</div>`;
  h += `</div></div>`;

  wrap.innerHTML = h;
}

function renderPnjPreview() {
  const wrap = document.getElementById('preview-wrap');
  const obj  = buildPnjObj();

  if (!obj.id && !obj.name) {
    wrap.innerHTML = '';
    return;
  }

  const regionName = _allMobRegions.find(r => r.id === obj.region)?.name || obj.region || '';

  let h = `<div class="mob-card">`;

  // Header
  h += `<div class="mob-card-header">`;
  h += `<div class="mob-card-name">🧑 ${escHtml(obj.name || obj.id || '')}</div>`;
  h += `<div class="mob-card-meta">`;
  if (obj.tag)     h += `<span class="mob-card-badge" style="background:rgba(122,90,248,.15);color:var(--accent);border:1px solid rgba(122,90,248,.4);">${escHtml(obj.name || obj.tag)}</span>`;
  if (obj.palier)  h += `<span style="color:var(--muted)">Palier ${obj.palier}</span>`;
  if (regionName)  h += `<span style="color:var(--muted)">📍 ${escHtml(regionName)}</span>`;
  if (obj.coords)  h += `<span style="color:var(--muted);font-family:monospace;font-size:11px;">X${obj.coords.x} Y${obj.coords.y} Z${obj.coords.z}</span>`;
  h += `</div>`;
  if (obj.id) h += `<div style="font-size:10px;color:var(--muted);font-family:monospace;margin-top:4px;">${escHtml(obj.id)}</div>`;
  h += `</div>`;

  // Body
  h += `<div class="mob-card-body">`;

  if (obj.sells?.length) {
    h += `<div><div class="ic-section-label">Ventes (${obj.sells.length})</div><div class="ic-stats">`;
    for (const s of obj.sells.slice(0, 5)) {
      const iname = (typeof ITEMS !== 'undefined' && ITEMS.find(i => i.id === s.id)?.name) || s.id;
      const price = s.buy != null ? s.buy + '⚙' : '—';
      h += `<div class="ic-stat"><span class="ic-stat-label">${escHtml(iname)}</span><span class="ic-stat-val">${escHtml(String(price))}</span></div>`;
    }
    if (obj.sells.length > 5) h += `<div style="font-size:11px;color:var(--muted);padding:2px 4px;">+${obj.sells.length - 5} de plus…</div>`;
    h += `</div></div>`;
  }

  if (obj.craft?.length) {
    h += `<div><div class="ic-section-label">Craft (${obj.craft.length} recette${obj.craft.length > 1 ? 's' : ''})</div><div class="ic-stats">`;
    for (const c of obj.craft.slice(0, 4)) {
      const iname = (typeof ITEMS !== 'undefined' && ITEMS.find(i => i.id === c.id)?.name) || c.id;
      const ing   = c.ingredients?.length ? `${c.ingredients.length} ing.` : '';
      h += `<div class="ic-stat"><span class="ic-stat-label">${escHtml(iname)}</span><span class="ic-stat-val">${escHtml(ing)}</span></div>`;
    }
    if (obj.craft.length > 4) h += `<div style="font-size:11px;color:var(--muted);padding:2px 4px;">+${obj.craft.length - 4} de plus…</div>`;
    h += `</div></div>`;
  }

  h += `</div></div>`;
  wrap.innerHTML = h;
}

function filterStats() {
  const q = document.getElementById('stat-search').value.trim().toLowerCase();
  const container = document.getElementById('stats-container');
  const rows = container.querySelectorAll('.stat-row');
  const labels = container.querySelectorAll('.stat-group-label');

  rows.forEach(row => {
    const text = (row.querySelector('label')?.textContent || '').toLowerCase();
    row.style.display = (!q || text.includes(q)) ? '' : 'none';
  });

  // Hide group labels when all their rows are hidden
  labels.forEach(glabel => {
    let next = glabel.nextElementSibling;
    let any = false;
    while (next && !next.classList.contains('stat-group-label')) {
      if (next.style.display !== 'none') any = true;
      next = next.nextElementSibling;
    }
    glabel.style.display = any ? '' : 'none';
  });
}

function clearStats() {
  document.querySelectorAll('.stat-row').forEach(r => r.classList.remove('has-val'));
  for (const { stats } of STAT_DEFS) {
    for (const { id } of stats) {
      const minEl = document.getElementById(`smin-${id}`);
      const maxEl = document.getElementById(`smax-${id}`);
      if (minEl) minEl.value = '';
      if (maxEl) maxEl.value = '';
    }
  }
  update();
}

// ═══════════════════════════════════════════════════
// SESSION HISTORY
// ═══════════════════════════════════════════════════
let sessionHistory = []; // [{ ts, obj, code }]

function saveHistory() {
  try { localStorage.setItem('vcl_history', JSON.stringify(sessionHistory)); } catch(e) {}
}

function loadHistory() {
  try {
    const raw = localStorage.getItem('vcl_history');
    if (!raw) return;
    sessionHistory = JSON.parse(raw);
    renderHistory();
  } catch(e) {}
}

function _guessEntryType(obj) {
  if (obj.behavior !== undefined || obj.spawnTime !== undefined || obj.loot !== undefined) return 'mob';
  if (obj.sells !== undefined || obj.tag !== undefined) return 'pnj';
  if (obj.inCodex !== undefined && obj.canTp !== undefined) return 'region';
  if (obj.objectifs !== undefined || obj.recompenses !== undefined) return 'quest';
  return 'item';
}

function addToHistory(obj, code) {
  const idx = sessionHistory.findIndex(h => h.obj.id === obj.id);
  const entry = { ts: Date.now(), _type: creatorMode, obj: JSON.parse(JSON.stringify(obj)), code };
  if (idx >= 0) sessionHistory[idx] = entry;
  else sessionHistory.unshift(entry);
  saveHistory();
  renderHistory();
}

async function clearHistory() {
  if (!sessionHistory.length) return;
  if (!await window._modal?.confirm('Vider l\'historique ?')) return;
  sessionHistory = [];
  saveHistory();
  renderHistory();
}

function renderHistory() {
  const list  = document.getElementById('history-list');
  const badge = document.getElementById('history-count');
  if (!sessionHistory.length) {
    list.innerHTML = '<div class="ic-empty" style="padding:30px 10px;">Aucun item soumis pour l\'instant.</div>';
    badge.style.display = 'none';
    return;
  }
  badge.style.display = '';
  badge.textContent   = sessionHistory.length;
  list.innerHTML      = '';
  for (const entry of sessionHistory) {
    const { obj, ts } = entry;
    const entryType = entry._type || _guessEntryType(obj);
    const typeLabel = { item:'Item', mob:'Mob', pnj:'PNJ', region:'Région', quest:'Quête' }[entryType] || entryType;
    const color = RARITY_COLORS[obj.rarity] || '#7a7a90';
    const rl    = RARITY_LABELS[obj.rarity] || '';
    const time  = new Date(ts).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' });
    const meta  = [typeLabel, rl || obj.category || obj.type, obj.palier ? 'P'+obj.palier : ''].filter(Boolean).join(' · ');

    const div = document.createElement('div');
    div.className = 'hist-item';
    div.innerHTML = `
      <span class="hist-dot" style="background:${color}"></span>
      <div class="hist-info">
        <div class="hist-name">${escHtml(obj.name || obj.id || '—')}</div>
        <div class="hist-meta">${escHtml(meta)} <span style="margin-left:6px;opacity:.5">${time}</span></div>
      </div>
      <div class="hist-actions">
        <button class="btn btn-ghost btn-sm" title="Recharger dans le formulaire">↩ Charger</button>
        <button class="btn-icon" title="Supprimer de l'historique">✕</button>
      </div>`;
    div.querySelector('.btn-ghost').addEventListener('click', () => {
      const type = entry._type || _guessEntryType(entry.obj);
      loadByType(type, entry.obj);
      switchTab('preview');
    });
    div.querySelector('.btn-icon').addEventListener('click', () => {
      sessionHistory = sessionHistory.filter(h => h !== entry);
      renderHistory();
      saveHistory();
    });
    list.appendChild(div);
  }
}

// ═══════════════════════════════════════════════════
// BUILD & FORMAT OUTPUT
// ═══════════════════════════════════════════════════
function buildObj() {
  const id       = document.getElementById('f-id').value.trim();
  const name     = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value;
  const cat      = document.getElementById('f-cat').value;
  const palier   = document.getElementById('f-palier').value;
  const lvl      = document.getElementById('f-lvl').value;
  const set      = setDrop ? setDrop.getValue() : '';
  const lore     = document.getElementById('f-lore').value.trim();
  const obtain   = buildObtainText();
  const stats    = getStats();
  const craft    = getCraft();
  const effects  = getEffects();
  const tagsArr  = [...activeTags];

  const obj = {};
  if (id)                    obj.id       = id;
  if (name)                  obj.name     = name;
  if (set)                   obj.set      = set;
  if (selRarity)             obj.rarity   = selRarity;
  if (cat)                   obj.cat      = cat;
  if (category)              obj.category = category;
  if (palier)                obj.palier   = +palier;
  if (lvl)                   obj.lvl      = +lvl;
  {
    const CAT_IMG = {
      arme:        id ? `../img/compendium/textures/weapons/${id}.png`                          : null,
      armure:      id ? `../img/compendium/textures/armors/${id}.png`                           : null,
      accessoire:  id ? `../img/compendium/textures/trinkets/${palier ? 'P'+palier+'/' : ''}${id}.png` : null,
      outils:      id ? `../img/compendium/textures/gears/${id}.png`                            : null,
      materiaux:   id ? `../img/compendium/textures/items/Material/${id}.png`                   : null,
      ressources:  id ? `../img/compendium/textures/items/Ressources/${id}.png`                 : null,
      consommable: id ? `../img/compendium/textures/items/Consommable/${id}.png`                : null,
      nourriture:  id ? `../img/compendium/textures/items/Nourriture/${id}.png`                 : null,
      rune:        id ? `../img/compendium/textures/items/Runes/${id}.png`                      : null,
      quete:       id ? `../img/compendium/textures/items/Quest/${id}.png`                      : null,
      donjon:      id ? `../img/compendium/textures/items/Donjon/${id}.png`                     : null,
    };
    const _imgUrl = (category && CAT_IMG[category]) || null;
    if (_imgUrl) obj.images = [_imgUrl];
  }
  if (selTwoHanded)              obj.twoHanded  = true;
  if (cat === 'artefact')        obj.unique     = true;
  if (selEvolutif)               obj.evolving   = true;
  const runeSlots = parseInt(document.getElementById('f-rune-slots').value);
  if (runeSlots > 0)             obj.rune_slots = runeSlots;
  if (selSensible)               obj.sensible  = true;
  if (Object.keys(stats).length)  obj.stats   = stats;
  if (selClasses.length)     obj.classes  = [...selClasses];
  if (effects.length)        obj.effects  = effects;
  if (Object.keys(selThreshold).length) obj.threshold = { ...selThreshold };
  if (lore)                  obj.lore     = lore;
  if (tagsArr.length)        obj.tags     = tagsArr;
  if (obtain)                obj.obtain   = obtain;
  if (craft.length)          obj.craft    = craft;
  return obj;
}

function toJS(val, depth = 0) {
  const T = '\t';
  const pad  = T.repeat(depth);
  const pad2 = T.repeat(depth + 1);

  if (Array.isArray(val)) {
    if (!val.length) return '[]';
    // Simple arrays of primitives: inline
    if (val.every(v => typeof v !== 'object' || v === null)) {
      return '[' + val.map(v => JSON.stringify(v)).join(', ') + ']';
    }
    return '[\n' + val.map(v => pad2 + toJS(v, depth + 1)).join(',\n') + '\n' + pad + ']';
  }

  if (val !== null && typeof val === 'object') {
    const entries = Object.entries(val);
    if (!entries.length) return '{}';
    // Small stat-like objects: inline
    const allPrim = entries.every(([,v]) => typeof v !== 'object');
    if (allPrim && entries.length <= 6 && depth > 0) {
      return '{' + entries.map(([k,v]) => `${k}:${JSON.stringify(v)}`).join(', ') + '}';
    }
    return '{\n' + entries.map(([k,v]) => `${pad2}${k}:\t\t${toJS(v, depth+1)}`).join(',\n') + '\n' + pad + '}';
  }

  return JSON.stringify(val);
}

// ═══════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════
function validateForm() {
  const id       = document.getElementById('f-id').value.trim();
  const name     = document.getElementById('f-name').value.trim();
  const category = document.getElementById('f-category').value;
  const cat      = document.getElementById('f-cat').value;
  const palier   = document.getElementById('f-palier').value;
  const lvl      = document.getElementById('f-lvl').value;
  const isEquip  = ['arme','armure','accessoire'].includes(category);

  const errors   = []; // bloquent la copie
  const warnings = []; // n'empêchent pas la copie

  const lore = document.getElementById('f-lore').value.trim();

  if (!name)      errors.push({ field:'f-name',     msg:'Nom affiché manquant' });
  if (!id)        errors.push({ field:'f-id',        msg:'ID manquant' });
  if (!category)  errors.push({ field:'f-category',  msg:'Catégorie non sélectionnée' });
  if (!selRarity) errors.push({ field:null,          msg:'Rareté non sélectionnée' });
  if (!lore)      errors.push({ field:'f-lore',      msg:'Lore obligatoire' });
  if (isEquip && !cat)    warnings.push({ field:'f-cat',    msg:'Slot (cat) non sélectionné' });
  if (isEquip && !palier) warnings.push({ field:'f-palier', msg:'Palier non renseigné' });
  if (isEquip && !lvl)    warnings.push({ field:'f-lvl',    msg:'Niveau requis non renseigné' });

  return { errors, warnings };
}

function renderValidation() {
  const { errors, warnings } = validateForm();
  const panel = document.getElementById('validation-panel');

  // Reset field highlights
  document.querySelectorAll('.field input, .field select, .field textarea').forEach(el => {
    el.style.borderColor = '';
  });

  if (!errors.length && !warnings.length) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'flex';
  panel.innerHTML = '';

  for (const { field, msg } of errors) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;';
    row.innerHTML = `<span style="color:var(--danger);font-weight:700;">✕</span> <span style="color:var(--danger);">${msg}</span>`;
    panel.appendChild(row);
    if (field) {
      const el = document.getElementById(field);
      if (el) el.style.borderColor = 'var(--danger)';
    }
  }

  for (const { field, msg } of warnings) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;';
    row.innerHTML = `<span style="color:#d7af5f;font-weight:700;">⚠</span> <span style="color:#d7af5f;">${msg}</span>`;
    panel.appendChild(row);
    if (field) {
      const el = document.getElementById(field);
      if (el) el.style.borderColor = '#d7af5f';
    }
  }
}

function buildOrphanSection() {
  // Panneau "Items orphelins" retiré — fonction conservée en no-op
  // pour ne pas casser les appelants historiques.
  return;
  /* eslint-disable no-unreachable */
  if (typeof MOBS === 'undefined' || typeof ITEMS === 'undefined') return;
  const itemIds = new Set(ITEMS.map(it => it.id));

  const orphanMap = {}; // id → [label, ...]

  // Orphelins depuis les loot de mobs
  for (const mob of MOBS) {
    for (const loot of (mob.loot || [])) {
      if (!itemIds.has(loot.id) && !CURRENCIES[loot.id]) {
        if (!orphanMap[loot.id]) orphanMap[loot.id] = [];
        const pct = loot.chance != null ? `${loot.chance}%` : '?%';
        orphanMap[loot.id].push(`${mob.name} (${pct}${loot.qty ? ' ×'+loot.qty : ''})`);
      }
    }
  }

  // Orphelins depuis les crafts d'items existants
  for (const item of ITEMS) {
    for (const c of (item.craft || [])) {
      if (c.id && !itemIds.has(c.id) && !CURRENCIES[c.id]) {
        if (!orphanMap[c.id]) orphanMap[c.id] = [];
        const label = `Craft de ${item.name || item.id}`;
        if (!orphanMap[c.id].includes(label)) orphanMap[c.id].push(label);
      }
    }
  }

  const ids = Object.keys(orphanMap);
  const mobOrphans = [...pendingOrphans.entries()].filter(([, d]) => d.entityType === 'mob');
  const section = document.getElementById('orphan-section');
  if (!ids.length && !mobOrphans.length) { section.style.display = 'none'; return; }

  section.style.display = '';
  document.getElementById('orphan-count').textContent = `— ${ids.length} item${ids.length > 1 ? 's' : ''}`;

  const list = document.getElementById('orphan-list');
  list.innerHTML = '';
  for (const id of ids.sort()) {
    const labels  = orphanMap[id];
    const subText = labels.join(', ');

    const row = document.createElement('div');
    row.style.cssText = `display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;`;
    row.innerHTML = `
      <div style="flex:1;min-width:0;">
        <div style="font-family:monospace;font-size:11px;color:var(--success);font-weight:700;">${escHtml(id)}</div>
        <div style="color:var(--muted);font-size:10px;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(subText)}">${escHtml(subText)}</div>
      </div>
      <button class="btn btn-ghost btn-sm" style="flex-shrink:0;">✏️ Créer</button>`;
    row.querySelector('button').addEventListener('click', () => {
      if (creatorMode !== 'item') switchMode('item');
      resetFormSilent();
      document.getElementById('editing-banner').style.display = 'none';
      document.getElementById('f-id').value = id;
      idLocked = true;
      // Pré-remplir les sources depuis les loot de mobs
      for (const mob of MOBS) {
        const loot = mob.loot?.find(l => l.id === id);
        if (loot) addObtainMobSource(
          { ...mob, subtitle:'', search:'', mobType: mob.type, palier: mob.palier },
          loot, id
        );
      }
      update();
      document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
      document.getElementById('f-name').focus();
    });
    list.appendChild(row);
  }
}

// Retourne la liste des mobs qui drop cet id alors qu'il n'existe pas dans ITEMS
function getOrphanMobs(id) {
  if (!id || typeof MOBS === 'undefined' || typeof ITEMS === 'undefined') return [];
  if (ITEMS.some(it => it.id === id)) return []; // existe déjà → pas orphelin
  return MOBS.filter(m => m.loot?.some(l => l.id === id)).map(m => m.name);
}

function isDuplicate(id) {
  if (!id || typeof ITEMS === 'undefined') return false;
  // En mode édition, l'ID original est autorisé
  const editingName = document.getElementById('editing-name').textContent;
  if (editingName) {
    const original = ITEMS.find(it => it.name === editingName);
    if (original && original.id === id) return false;
  }
  return ITEMS.some(it => it.id === id);
}

function isMobDuplicate(id) {
  if (!id || typeof MOBS === 'undefined') return false;
  return MOBS.some(m => m.id === id || m._id === id);
}

let _regionsCache = null; // [{ id }] chargé une fois
async function loadRegionsCache() {
  if (_regionsCache) return;
  const getDocs = window._vcl_getDocs;
  const col     = window._vcl_collection;
  const db      = window._vcl_db;
  if (!getDocs || !col || !db) return;
  try {
    const snap = await getDocs(col(db, 'regions'));
    _regionsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch {}
}
function isRegionDuplicate(id) {
  if (!id || !_regionsCache) return false;
  return _regionsCache.some(r => r.id === id || r._id === id);
}

let _panopliesCache = null;
async function loadPanopliesCache() {
  if (_panopliesCache) return;
  const getDocs = window._vcl_getDocs;
  const col     = window._vcl_collection;
  const db      = window._vcl_db;
  if (!getDocs || !col || !db) return;
  try {
    const snap = await getDocs(col(db, 'panoplies'));
    _panopliesCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch { _panopliesCache = []; }
}
function isPanoplieDuplicate(id) {
  if (!id || !_panopliesCache) return false;
  return _panopliesCache.some(p => p.id === id || p._id === id);
}

function update() {
  // ── Mob mode ──
  if (creatorMode === 'mob') {
    const obj   = buildMobObj();
    const empty = !obj.id && !obj.name;
    document.getElementById('out-code').textContent = empty
      ? '// Remplis le formulaire\n// pour générer le code ici.'
      : toJS(obj, 0) + ',';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('id-orphan-badge').style.display    = 'none';
    document.getElementById('validation-panel').style.display   = 'none';
    const dupBadge = document.getElementById('mob-id-duplicate-badge');
    if (dupBadge) dupBadge.style.display = isMobDuplicate(obj.id) ? '' : 'none';
    renderMobPreview();
    return;
  }
  // ── PNJ mode ──
  if (creatorMode === 'pnj') {
    const obj   = buildPnjObj();
    const empty = !obj.id && !obj.name;
    document.getElementById('out-code').textContent = empty
      ? '// Remplis le formulaire\n// pour générer le code ici.'
      : toJS(obj, 0) + ',';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('id-orphan-badge').style.display    = 'none';
    document.getElementById('validation-panel').style.display   = 'none';
    if (empty) document.getElementById('preview-wrap').innerHTML = '';
    else renderPnjPreview();
    return;
  }
  // ── Région mode ──
  if (creatorMode === 'region') {
    const obj   = buildRegionObj();
    const empty = !obj.id && !obj.name;
    document.getElementById('out-code').textContent = empty
      ? '// Remplis le formulaire\n// pour générer le code ici.'
      : toJS(obj, 0) + ',';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('id-orphan-badge').style.display    = 'none';
    document.getElementById('validation-panel').style.display   = 'none';
    const regDupBadge = document.getElementById('reg-id-duplicate-badge');
    if (regDupBadge) regDupBadge.style.display = isRegionDuplicate(obj.id) ? '' : 'none';
    if (empty) document.getElementById('preview-wrap').innerHTML = '';
    else renderRegionPreview();
    return;
  }
  // ── Quête mode ──
  if (creatorMode === 'quest') {
    const obj   = buildQuestObj();
    const empty = !obj.id && !obj.titre;
    document.getElementById('out-code').textContent = empty
      ? '// Remplis le formulaire\n// pour générer le code ici.'
      : toJS(obj, 0) + ',';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('id-orphan-badge').style.display    = 'none';
    document.getElementById('validation-panel').style.display   = 'none';
    renderQuestPreview(empty ? null : obj);
    return;
  }
  // ── Panoplie mode ──
  if (creatorMode === 'panoplie') {
    const obj   = buildPanoplieObj();
    const empty = !obj.id && !obj.label;
    document.getElementById('out-code').textContent = empty
      ? '// Remplis le formulaire\n// pour générer le code ici.'
      : toJS(obj, 0) + ',';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('id-orphan-badge').style.display    = 'none';
    document.getElementById('validation-panel').style.display   = 'none';
    const dupBadge = document.getElementById('panop-id-duplicate-badge');
    if (dupBadge) dupBadge.style.display = isPanoplieDuplicate(obj.id) ? '' : 'none';
    if (empty) document.getElementById('preview-wrap').innerHTML = '';
    else renderPanopliePreview();
    return;
  }
  // ── Item mode (original) ──
  const obj = buildObj();
  if (!obj.id && !obj.name) {
    document.getElementById('out-code').textContent = '// Remplis le formulaire\n// pour générer le code ici.';
    document.getElementById('id-duplicate-badge').style.display = 'none';
    document.getElementById('validation-panel').style.display = 'none';
    document.getElementById('preview-wrap').innerHTML = '';
    return;
  }
  const dup = isDuplicate(obj.id);
  document.getElementById('id-duplicate-badge').style.display = dup ? '' : 'none';
  const orphanMobs = getOrphanMobs(obj.id);
  const orphanBadge = document.getElementById('id-orphan-badge');
  orphanBadge.style.display = orphanMobs.length ? '' : 'none';
  if (orphanMobs.length) orphanBadge.title = 'Cet ID est déjà attendu par : ' + orphanMobs.join(', ');
  document.getElementById('out-code').textContent = toJS(obj, 0) + ',';
  renderValidation();
  renderPreview();
  if (dup) document.getElementById('f-id').style.borderColor = 'var(--danger)';
  saveForm();
}

async function copyCode() {
  if (creatorMode !== 'item') {
    const code = document.getElementById('out-code').textContent;
    if (!code || code.startsWith('//')) return;
    navigator.clipboard.writeText(code).then(() => {
      const m = document.getElementById('copy-msg');
      m.classList.add('show');
      setTimeout(() => m.classList.remove('show'), 2000);
    });
    return;
  }
  const { errors } = validateForm();
  if (errors.length) {
    window._toast?.('⛔ Corrige les erreurs avant de copier', 'error', 5000);
    return;
  }
  const id = document.getElementById('f-id').value.trim();
  if (isDuplicate(id)) {
    if (!await window._modal?.confirm(`⚠️ L'ID "${id}" existe déjà dans data.js.\n\nTu es en train d'écraser un item existant. Continuer ?`)) return;
  }
  buildObj();
  const code = document.getElementById('out-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const m = document.getElementById('copy-msg');
    m.classList.add('show');
    setTimeout(() => m.classList.remove('show'), 2000);
  });
}

async function resetForm() {
  if (!await window._modal?.confirm('Réinitialiser le formulaire ?')) return;
  if (creatorMode === 'mob') {
    resetMobForm();
  } else if (creatorMode === 'pnj') {
    resetPnjForm();
  } else if (creatorMode === 'region') {
    resetRegionForm();
  } else if (creatorMode === 'quest') {
    resetQuestForm();
  } else if (creatorMode === 'panoplie') {
    resetPanoplieForm();
  } else {
    document.getElementById('editing-banner').style.display = 'none';
    resetFormSilent();
    renderCustomTags();
  }
  update();
}

// ═══════════════════════════════════════════════════
// SOUMISSION DISCORD
// ═══════════════════════════════════════════════════
const DISCORD_WEBHOOK = 'https://discord.com/api/webhooks/1476647889920065549/1xPGdMDmpL7iswdaUNuwlnvmQPv9ED74Qn3ftPabthzX_TIMrYIPvLWfKirBwAMMyhFG';

// Webhooks forums Discord (arme/armure/accessoire × palier)
const FORUM_WEBHOOKS = {
  'arme_1':         'https://discord.com/api/webhooks/1491072737761038357/DXrNa-UEnhY_IYNWxsxTI4ztqt_-_6vhgf7p35Ia7AIZgjPya9sA4nTuT4IekyTM0Mek',
  'arme_2':         'https://discord.com/api/webhooks/1491072819088588970/RAPDd0z4d5Aiy0SXP_li1xo2LuzrlMoIU0ALs0lCEwwisMhlB0aCVxTdkF-7g72PMWk8',
  'arme_event':     '',
  'armure_1':       'https://discord.com/api/webhooks/1491072872637272214/IK9fJGjMJ8up1jlyCNIjxVf_SBv1MRnh8QXY2Xndxca_W0YWImaFNttv47ZJZfsnJadk',
  'armure_2':       'https://discord.com/api/webhooks/1491072932800368832/pukxiljqxIQCm6Fh8I1v1fXhF-G-_FyJ_iU_BMXcM5216MwOsbeUVLo7HRU6KqzEoFL1',
  'armure_event':   '',
  'accessoire_1':   'https://discord.com/api/webhooks/1491072941985890386/RFNjfNRfGuRv7nmzEMmHdz4lhzxH9DzjX8rqpDLLKfLHkWS95xOgGMvPTFqRiQgqzNj1',
  'accessoire_2':   'https://discord.com/api/webhooks/1491073046759342081/b-b21JWzETX1zsTVfMtop5tJm0fr1ZhTV5oQmXEH_DVKVFdbatHPYg2LybvKtsqMmqBO',
  'accessoire_event': '',
};

function getForumWebhook(obj) {
  const key = obj.rarity === 'event' ? `${obj.category}_event` : `${obj.category}_${obj.palier}`;
  return FORUM_WEBHOOKS[key] || null;
}

function buildItemCardEmbed(obj, color, imageFilename) {
  const RARITY_LABEL = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
  const RARITY_ICON  = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const CAT_LABEL    = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire', materiaux:'🧱 Matériau', ressources:'⛏️ Ressource', consommable:'🧪 Consommable', nourriture:'🍖 Nourriture', rune:'🔮 Rune', quete:'📜 Quête', donjon:'🏰 Donjon' };
  const CLS_LABEL    = { guerrier:'⚔️ Guerrier', assassin:'🗡️ Assassin', archer:'🏹 Archer', mage:'📖 Mage', shaman:'🌿 Shaman' };

  const rarIcon  = RARITY_ICON[obj.rarity]  || '▪️';
  const rarLabel = RARITY_LABEL[obj.rarity] || obj.rarity;
  const catLabel = CAT_LABEL[obj.category]  || obj.category;

  // ── Ligne d'identité compacte dans la description ──
  const infoLine = [
    `${rarIcon} **${rarLabel}**`,
    catLabel,
    obj.palier  ? `Palier ${obj.palier}` : null,
    obj.lvl     ? `Niveau ≥ ${obj.lvl}`  : null,
  ].filter(Boolean).join('  ·  ');

  const clsLine = obj.classes?.length
    ? obj.classes.map(c => CLS_LABEL[c] || c).join('  ·  ')
    : null;

  const loreLine = obj.lore ? `\n*${obj.lore.slice(0, 280)}*` : '';

  const descParts = [infoLine];
  if (clsLine) descParts.push(clsLine);
  if (loreLine) descParts.push(loreLine);

  const fields = [];

  // Stats
  const ALL_STAT_LABELS = {};
  if (typeof ALL_STATS !== 'undefined') ALL_STATS.forEach(s => ALL_STAT_LABELS[s.id] = s.label + (s.unit ? ' ' + s.unit : ''));
  const statEntries = obj.stats ? Object.entries(obj.stats) : [];
  if (statEntries.length || obj.rune_slots) {
    const lines = statEntries.map(([k, v]) => {
      const label = ALL_STAT_LABELS[k] || k;
      const val   = Array.isArray(v) ? `${v[0]} — ${v[1]}` : String(v);
      return `**${label}** \`${val}\``;
    });
    if (obj.rune_slots) lines.push(`**Emplacements de Runes** \`${obj.rune_slots}\``);
    fields.push({ name:'📊 Stats', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  if (obj.obtain) {
    const clean = obj.obtain
      .replace(/\[npc:[\w]+\|([^\]]+)\]/g, '**$1**')
      .replace(/\[[\w]+\|([^\]]+)\]/g, '**$1**')
      .slice(0, 1024);
    fields.push({ name:'📍 Obtention', value: clean, inline: false });
  }

  if (obj.craft?.length) {
    const lines = obj.craft.map(c => {
      const found = (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === c.id) : null;
      return `\`${c.qty}×\` ${found ? found.name : c.id}`;
    });
    fields.push({ name:'🔨 Craft', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  const embed = {
    title: obj.name,
    description: descParts.join('\n').slice(0, 4096),
    color,
    fields,
  };

  if (imageFilename) embed.image = { url: `attachment://${imageFilename}` };

  return embed;
}

const RARITY_COLORS_HEX = {
  commun: 0x59d059, rare: 0x2a5fa8, epique: 0x6a3daa,
  legendaire: 0xd7af5f, mythique: 0xf5b5e4, godlike: 0xa83020, event: 0xebebeb
};

function findTargetRegion(obj) {
  const p   = `P${obj.palier || 1}`;
  if (obj.sensible) {
    if (obj.category === 'arme')       return `Sensible > Armes > Palier ${obj.palier || 1}`;
    if (obj.category === 'accessoire') return `Sensible > Accessoires > Palier ${obj.palier || 1}`;
    if (obj.category === 'armure')     return `Sensible > Armures > Palier ${obj.palier || 1}`;
    return `Sensible > Items > Palier ${obj.palier || 1}`;
  }
  const tags = obj.tags    || [];
  const cls  = obj.classes || [];
  const cat  = obj.cat     || '';
  const rar  = obj.rarity  || '';
  if (obj.category === 'arme') {
    if (rar === 'event') return `Armes > ${p} > Events`;
    if (cls.includes('guerrier')) {
      if (cat === 'arme_s') return `Armes > ${p} > Guerrier > Boucliers`;
      if (tags.some(t => ['Lance','Hallebarde','Hast','Pique'].includes(t))) return `Armes > ${p} > Guerrier > Hast`;
      return `Armes > ${p} > Guerrier > Épées`;
    }
    if (cls.includes('assassin')) return `Armes > ${p} > Assassin`;
    if (cls.includes('archer')) {
      if (tags.some(t => ['Arbalète','Arbalète Lourde'].includes(t))) return `Armes > ${p} > Archer > Arbalètes`;
      return `Armes > ${p} > Archer > Arcs`;
    }
    if (cls.includes('mage') || cls.includes('shaman')) {
      if (tags.some(t => ['Catalyseur'].includes(t))) return `Armes > ${p} > Mage-Shaman > Catalyseurs`;
      return `Armes > ${p} > Mage-Shaman > Bâtons`;
    }
    return `Armes > ${p} > Events`;
  }
  if (obj.category === 'accessoire') {
    if (rar === 'event') return `Accessoires > ${p} > Events`;
    const sec = { anneau:'Anneaux', amulette:'Amulettes', gants:'Gants', bracelet:'Bracelets', artefact:'Artefacts' };
    return `Accessoires > ${p} > ${sec[cat] || 'Artefacts'}`;
  }
  if (obj.category === 'armure') {
    if (cls.includes('guerrier'))                           return `Armures > ${p} > Guerrier`;
    if (cls.includes('assassin') || cls.includes('archer')) return `Armures > ${p} > Assassin-Archer`;
    if (cls.includes('mage')     || cls.includes('shaman')) return `Armures > ${p} > Mage-Shaman`;
    return `Armures > ${p} > Génériques`;
  }
  const itemMap = { outils:'Outils', rune:'Runes', consommable:'Consommables', nourriture:'Nourritures', materiaux:'Matériaux', ressources:'Ressources', quete:'Quêtes', donjon:'Donjon', monnaie:'Monnaie' };
  return `Items > ${p} > ${itemMap[obj.category] || 'Matériaux'}`;
}

// ── Validation dynamique via config Firestore ───────────────────
// window._vcl_creatorValidation est chargé dans le module 2 de creator.html
function validateCurrentMode() {
  const cfg = window._vcl_creatorValidation;
  if (!cfg || !cfg[creatorMode]) return { errors: [] };
  const required = cfg[creatorMode]?.required || [];
  const errors = [];
  const FIELD_IDS = {
    mob:      { name:'mob-name', palier:'mob-palier', region:'mob-region' },
    pnj:      { type:'pnj-type', coords:'pnj-x', region:'pnj-region' },
    region:   { name:'reg-name', palier:'reg-palier' },
    quest:    { titre:'quest-titre', type:'quest-type', objectifs:'quest-objectifs' },
    panoplie: { label:'panop-label', bonuses:'__panopBonuses__' },
  };
  const fieldMap = FIELD_IDS[creatorMode] || {};
  const FIELD_LABELS = {
    name:'Nom', palier:'Palier', region:'Région', type:'Type', coords:'Coordonnées',
    titre:'Titre', objectifs:'Objectifs', label:'Nom', bonuses:'Bonus', npc:'PNJ'
  };
  for (const f of required) {
    if (f === '__panopBonuses__' || f === 'bonuses') {
      if (!panopBonuses.length) errors.push('Au moins un bonus est requis.');
    } else if (f === 'coords') {
      const x = document.getElementById('pnj-x')?.value;
      const y = document.getElementById('pnj-y')?.value;
      const z = document.getElementById('pnj-z')?.value;
      if (!x || !y || !z) errors.push('Coordonnées (X, Y, Z) requises.');
    } else if (f === 'objectifs') {
      // quest objectifs — check via buildQuestObj
    } else {
      const elId = fieldMap[f] || f;
      const el = document.getElementById(elId);
      if (el && !el.value.trim()) {
        const label = FIELD_LABELS[f] || f;
        // Highlight
        el.style.borderColor = 'var(--danger)';
        el.addEventListener('input', () => { el.style.borderColor = ''; }, { once: true });
        errors.push(`${label} est requis.`);
      }
    }
  }
  return { errors };
}

async function submitToDiscord() {
  // Invités : pseudo obligatoire
  if (!window._vcl_user) {
    const pseudo = getAuthor();
    if (!pseudo) {
      const input = document.getElementById('author-input');
      if (input) { input.style.borderColor = 'var(--danger)'; input.focus(); }
      window._toast?.('⚠️ Entre ton pseudo avant de soumettre.', 'warning');
      return;
    }
  }

  if (creatorMode === 'region') {
    const regErrors = [];
    if (!document.getElementById('reg-name').value.trim()) regErrors.push('Le nom est obligatoire.');
    if (!document.getElementById('reg-palier').value)      regErrors.push('Le palier est obligatoire.');
    if (regInCodex && !document.getElementById('reg-lore').value.trim()) regErrors.push('Le lore est obligatoire pour une région Codex.');
    if (regErrors.length) {
      window._toast?.('⛔ ' + regErrors.join(' · '), 'error', 5000);
      return;
    }
    await submitToFirestore();
    return;
  }

  if (creatorMode === 'quest') {
    const q = buildQuestObj();
    const qErrors = [];
    if (!q.id)    qErrors.push('ID manquant — remplis le titre.');
    if (!q.type)  qErrors.push('Type de quête obligatoire.');
    if (!q.titre) qErrors.push('Titre obligatoire.');
    if (!q.desc)  qErrors.push('Description obligatoire.');
    if (qErrors.length) {
      window._toast?.('⛔ ' + qErrors.join(' · '), 'error', 5000);
      return;
    }
    const btn = document.getElementById('btn-submit-discord');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
    try { await submitToFirestore(); }
    catch (err) { window._toast?.('⛔ Erreur : ' + err.message, 'error'); }
    finally { if (btn) { btn.disabled = false; btn.textContent = '📨 Soumettre'; } }
    return;
  }

  if (creatorMode === 'panoplie') {
    const p = buildPanoplieObj();
    const pErrors = [];
    if (!p.label) pErrors.push('Nom obligatoire.');
    if (!p.id) pErrors.push('ID manquant.');
    if (!p.bonuses || !Object.keys(p.bonuses).length) pErrors.push('Au moins un bonus obligatoire.');
    if (pErrors.length) {
      window._toast?.('⛔ ' + pErrors.join(' · '), 'error', 5000);
      return;
    }
    await submitToFirestore();
    return;
  }

  if (creatorMode === 'mob') {
    const data = buildMobObj();
    const errs = [];
    if (!data.id || !data.name) errs.push('Nom et ID obligatoires.');
    if (data.inCodex && !data.lore) errs.push('Le lore est obligatoire si le mob est dans le Codex.');
    // Validation dynamique depuis config Firestore
    const { errors: dynErrors } = validateCurrentMode();
    errs.push(...dynErrors);
    if (errs.length) { window._toast?.('⛔ ' + errs.join(' · '), 'error', 5000); return; }
    await submitToFirestore();
    return;
  }

  if (creatorMode === 'pnj') {
    const { errors: dynErrors } = validateCurrentMode();
    if (dynErrors.length) { window._toast?.('⛔ ' + dynErrors.join(' · '), 'error', 5000); return; }
    await submitToFirestore();
    return;
  }

  if (creatorMode !== 'item') {
    await submitToFirestore();
    return;
  }

  const { errors } = validateForm();
  if (errors.length) {
    window._toast?.('⛔ Corrige les erreurs avant de soumettre', 'error', 5000);
    return;
  }

  const btn = document.getElementById('btn-submit-discord');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }

  try {
    await submitToFirestore();

    // Post forum Discord (best-effort, n'empêche pas la soumission si ça rate)
    const obj   = buildObj();
    const color = RARITY_COLORS_HEX[obj.rarity] || 0x7a7a90;
    // Détermine le nom de fichier image (MIME → extension)
    const _imgExt = forumImageFile
      ? ({ 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' }[forumImageFile.type]
         || forumImageFile.name?.split('.').pop() || 'png')
      : null;
    const _imgFname = _imgExt ? `image.${_imgExt}` : null;

    // _discordSend → utilise window.VCL.postDiscord (défini dans /utils.js)
    const _discordSend = (url, payload, file, fname) =>
      window.VCL.postDiscord(url, payload, file, fname).catch(() => {});

    // Post forum si équipement
    const forumUrl = getForumWebhook(obj);
    if (forumUrl) {
      const cardEmbed = buildItemCardEmbed(obj, color, _imgFname);
      _discordSend(
        forumUrl + '?wait=true',
        { thread_name: obj.name, embeds: [cardEmbed] },
        forumImageFile, _imgFname
      );
    }

  } catch (err) {
    window._toast?.('⛔ Erreur de soumission : ' + err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📨 Soumettre'; }
  }
}

// Convertit les tableaux imbriqués en objets compatibles Firestore
// sanitizeForFirestore → défini dans /firebase.js, exposé via window._vcl_sanitize
const sanitizeForFirestore = (...args) => window._vcl_sanitize(...args);

async function submitToFirestore() {
  const db              = window._vcl_db;
  const addDoc          = window._vcl_addDoc;
  const col             = window._vcl_collection;
  const serverTimestamp = window._vcl_serverTimestamp;
  const user            = window._vcl_user;

  if (!db) throw new Error('Firebase non initialisé');

  // Vérifier que l'outil est activé (sauf pour les contributeurs+)
  if (!['contributeur', 'admin'].includes(window._vcl_role || '')) {
    const cfg = window._vcl_lastCreatorConfig;
    if (cfg?.tools?.[creatorMode] === false) {
      throw new Error(`L'outil "${creatorMode}" est actuellement désactivé.`);
    }
  }

  let type, data;
  if (creatorMode === 'item') {
    const { errors } = validateForm();
    if (errors.length) throw new Error('Formulaire invalide');
    type = 'item';
    data = buildObj();
  } else if (creatorMode === 'mob') {
    type = 'mob';
    data = buildMobObj();
    if (!data.id || !data.name) throw new Error('Nom et ID obligatoires');
    if (data.inCodex && !data.lore) throw new Error('Le lore est obligatoire si le mob est dans le Codex');
  } else if (creatorMode === 'pnj') {
    type = 'pnj';
    data = buildPnjObj();
    if (!data.id || !data.name) throw new Error('Nom et ID obligatoires');
    if (!data.coords) throw new Error('Les coordonnées X, Y et Z sont obligatoires');
  } else if (creatorMode === 'region') {
    type = 'region';
    data = buildRegionObj();
    if (!data.id || !data.name) throw new Error('Nom et ID obligatoires');
    if (data.inCodex && !data.lore) throw new Error('Le lore est obligatoire pour une région Codex');
  } else if (creatorMode === 'quest') {
    type = 'quest';
    data = buildQuestObj();
    if (!data.id)    throw new Error('ID manquant (remplis le titre)');
    if (!data.type)  throw new Error('Type de quête obligatoire');
    if (!data.titre) throw new Error('Titre obligatoire');
    if (!data.desc)  throw new Error('Description obligatoire');
  } else if (creatorMode === 'panoplie') {
    type = 'panoplie';
    data = buildPanoplieObj();
    if (!data.id)    throw new Error('ID manquant (remplis le nom)');
    if (!data.label) throw new Error('Nom obligatoire');
    if (!data.bonuses || !Object.keys(data.bonuses).length) throw new Error('Au moins un bonus obligatoire');
  }

  // Nettoyer pour Firestore
  const clean = sanitizeForFirestore(JSON.parse(JSON.stringify(data)));

  // Lire l'image en base64 si présente (limite ~700KB pour rester sous le 1MB Firestore)
  let forumImageData = null;
  if (forumImageFile) {
    try {
      forumImageData = await new Promise((res, rej) => {
        const r = new FileReader();
        r.onload  = e => res(e.target.result);
        r.onerror = () => rej(new Error('Lecture image échouée'));
        r.readAsDataURL(forumImageFile);
      });
      if (forumImageData.length > 700_000) forumImageData = null; // trop grand
    } catch { forumImageData = null; }
  }

  const docRef = await addDoc(col(db, 'submissions'), {
    type,
    status:        'pending',
    data:          clean,
    submittedBy:   user ? user.uid : null,
    submitterName: getAuthor() || (user ? user.displayName || user.email : null) || null,
    submittedAt:   serverTimestamp(),
    reviewedBy:    null,
    reviewedAt:    null,
    comment:       '',
    ...(forumImageData ? { forum_image: forumImageData } : {}),
  });

  const code = creatorMode === 'item' ? toJS(data, 0) + ',' : toJS(data, 0) + ',';
  addToHistory(data, code);

  if (creatorMode === 'item') {
    document.getElementById('editing-banner').style.display = 'none';
    resetFormSilent();
    renderCustomTags();
  } else if (creatorMode === 'mob') {
    resetMobForm();
  } else if (creatorMode === 'pnj') {
    resetPnjForm();
  } else if (creatorMode === 'region') {
    resetRegionForm();
  } else if (creatorMode === 'quest') {
    resetQuestForm();
  } else if (creatorMode === 'panoplie') {
    resetPanoplieForm();
  }
  update();

  const m = document.getElementById('copy-msg');
  m.textContent = '✓ Soumis ! En attente de validation.';
  m.classList.add('show');
  setTimeout(() => { m.classList.remove('show'); m.textContent = '✓ Copié !'; }, 3500);
}

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-drop-wrap') && !e.target.closest('.custom-sel-wrap')) {
    document.querySelectorAll('.drop-list').forEach(d => d.classList.remove('open'));
  }
});

// ═══════════════════════════════════════════════════
// RÉGION — STATE
// ═══════════════════════════════════════════════════
let regInCodex  = true;
let regCanTp    = null;

function setRegCanTp(val) {
  regCanTp = val;
  const yes = document.getElementById('reg-tp-yes');
  const no  = document.getElementById('reg-tp-no');
  if (yes) { yes.style.background = val === true  ? 'rgba(74,222,128,.15)' : ''; yes.style.color = val === true  ? 'var(--success)' : ''; yes.style.borderColor = val === true  ? 'var(--success)' : ''; }
  if (no)  { no.style.background  = val === false ? 'rgba(248,113,113,.15)' : ''; no.style.color  = val === false ? 'var(--danger)'  : ''; no.style.borderColor  = val === false ? 'var(--danger)'  : ''; }
  update();
}

function setRegCodex(val) {
  regInCodex = val;
  const yes = document.getElementById('reg-codex-yes');
  const no  = document.getElementById('reg-codex-no');
  if (yes) { yes.style.background = val ? 'rgba(74,222,128,.15)' : ''; yes.style.color = val ? 'var(--success)' : ''; yes.style.borderColor = val ? 'var(--success)' : ''; }
  if (no)  { no.style.background  = !val ? 'rgba(248,113,113,.15)' : ''; no.style.color  = !val ? 'var(--danger)'  : ''; no.style.borderColor  = !val ? 'var(--danger)'  : ''; }
  const loreBadge = document.getElementById('reg-lore-badge');
  if (loreBadge) loreBadge.style.display = val ? '' : 'none';
  update();
}

// ═══════════════════════════════════════════════════
// MOB — STATE
// ═══════════════════════════════════════════════════
let mobIdLocked     = false;
let mobInCodex      = true;
let mobSensible     = false;
let mobLootEntries  = [];
let mobLootUid      = 0;

function onMobNameInput() {
  if (!mobIdLocked) document.getElementById('mob-id').value = nameToId(document.getElementById('mob-name').value);
  update();
}

function setMobType(type) {
  // Normalize : mini_boss (Firestore) ↔ miniboss (boutons UI)
  const uiType    = type === 'mini_boss' ? 'miniboss' : type;
  const storeType = type === 'miniboss'  ? 'mini_boss' : type;
  document.getElementById('mob-type').value = storeType;
  ['monstre','miniboss','boss','sbire'].forEach(t =>
    document.getElementById('type-' + t).classList.toggle('active', t === uiType));
  document.getElementById('mob-spawntime-field').style.display = (uiType === 'boss' || uiType === 'miniboss') ? '' : 'none';
  update();
}

function setBehavior(val) {
  document.getElementById('mob-behavior').value = val;
  ['agressif','neutre','passif'].forEach(b => {
    document.getElementById('beh-' + b).classList.toggle('active', b === val);
  });
  update();
}

function toggleMobSensible() {
  mobSensible = !mobSensible;
  document.getElementById('mob-sensible-btn').classList.toggle('active', mobSensible);
  update();
}

function setMobCodex(val) {
  mobInCodex = val;
  const yes = document.getElementById('mob-codex-yes');
  const no  = document.getElementById('mob-codex-no');
  yes.style.cssText = val
    ? 'background:rgba(74,222,128,.15);color:var(--success);border-color:var(--success);'
    : 'background:var(--surface2);color:var(--text);border-color:var(--border);';
  no.style.cssText  = !val
    ? 'background:rgba(248,113,113,.15);color:var(--danger);border-color:var(--danger);'
    : 'background:var(--surface2);color:var(--text);border-color:var(--border);';
  const badge = document.getElementById('mob-lore-badge');
  if (badge) badge.style.display = val ? '' : 'none';
  update();
}

// ═══════════════════════════════════════════════════
// MOB — LOOT
// ═══════════════════════════════════════════════════
function addMobLoot() {
  ensureItemIndex();
  const uid = mobLootUid++;
  const entry = { uid, itemId: '', chance: 100 };
  mobLootEntries.push(entry);

  const row = document.createElement('div');
  row.id = `mob-loot-${uid}`;
  row.style.cssText = 'display:grid;grid-template-columns:1fr 90px 28px;gap:6px;align-items:start;';

  const drop = makeSearchDrop(itemIndex, 'Item droppé…', (id) => { entry.itemId = id; update(); }, true);
  entry.drop = drop;

  // Chance : texte libre pour accepter "?" + nombres 0-100
  const chanceEl = document.createElement('input');
  chanceEl.type = 'text'; chanceEl.value = '100'; chanceEl.placeholder = '% ou ?';
  chanceEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;transition:border-color .15s;font-family:monospace;';
  chanceEl.addEventListener('focus', () => chanceEl.style.borderColor = 'var(--accent)');
  chanceEl.addEventListener('blur',  () => {
    chanceEl.style.borderColor = 'var(--border)';
    // Nettoyer : garder "?" ou un nombre valide
    const v = chanceEl.value.trim();
    if (v !== '?' && (isNaN(+v) || +v < 0 || +v > 100)) chanceEl.value = '100';
  });
  chanceEl.addEventListener('input', () => {
    const v = chanceEl.value.trim();
    entry.chance = (v === '?' || v === '') ? '?' : (isNaN(+v) ? 100 : +v);
    update();
  });

  const rmBtn = document.createElement('button');
  rmBtn.className = 'btn-icon'; rmBtn.textContent = '✕';
  rmBtn.addEventListener('click', () => { mobLootEntries = mobLootEntries.filter(e => e.uid !== uid); row.remove(); update(); });

  row.appendChild(drop.element);
  row.appendChild(chanceEl);
  row.appendChild(rmBtn);
  document.getElementById('mob-loot-list').appendChild(row);
}

function getMobLoot() {
  return mobLootEntries
    .filter(e => e.itemId)
    .map(e => ({ id: e.itemId, chance: e.chance === '?' ? '?' : (isNaN(e.chance) ? 100 : e.chance) }));
}

// ═══════════════════════════════════════════════════
// MOB — RÉGIONS
// ═══════════════════════════════════════════════════
let _allMobRegions = [];

function onMobPalierChange() {
  // Réinitialiser la région si elle ne correspond plus au nouveau palier
  const palier = document.getElementById('mob-palier').value;
  const currentId = document.getElementById('mob-region').value;
  if (currentId && palier) {
    const current = _allMobRegions.find(r => r.id === currentId);
    if (current && String(current.palier||'') !== palier) {
      document.getElementById('mob-region').value      = '';
      document.getElementById('mob-regionid').value    = '';
      document.getElementById('mob-region-search').value = '';
    }
  }
  // Re-render sans ouvrir la liste (l'utilisateur l'ouvrira en cliquant sur le champ)
  renderMobRegionDropdown();
  update();
}

function regionDropKeydown(ev, dropId) {
  if (ev.key !== 'Enter' && ev.key !== 'Escape') return;
  const dd = document.getElementById(dropId);
  if (!dd?.classList.contains('open')) return;
  ev.preventDefault();
  if (ev.key === 'Escape') { dd.classList.remove('open'); return; }
  // Enter → sélectionner le premier item
  dd.querySelector('.region-drop-item')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
}

function openMobRegionList() {
  const dd = document.getElementById('mob-region-dropdown');
  renderMobRegionDropdown();
  positionDrop(dd, dd.parentElement);
  dd.classList.add('open');
}

function closeMobRegionList() {
  document.getElementById('mob-region-dropdown').classList.remove('open');
}

function filterMobRegionList() {
  const dd = document.getElementById('mob-region-dropdown');
  renderMobRegionDropdown();
  positionDrop(dd, dd.parentElement);
  dd.classList.add('open');
}

function renderMobRegionDropdown() {
  const dropdown = document.getElementById('mob-region-dropdown');
  if (!dropdown) return;
  const q      = normalize((document.getElementById('mob-region-search')?.value || '').trim());
  const palier = document.getElementById('mob-palier')?.value || '';

  let filtered = _allMobRegions;
  if (palier) filtered = filtered.filter(r => String(r.palier||'') === palier);
  if (q)      filtered = filtered.filter(r => normalize(r.name||r.id||'').includes(q));

  dropdown.innerHTML = '';
  if (!filtered.length) {
    dropdown.innerHTML = '<div style="padding:8px 12px;color:var(--muted);font-size:12px;">Aucune région</div>';
    return;
  }

  // Grouper par palier puis codex/hors-codex
  const groups = {};
  filtered.forEach(r => {
    const p   = r.palier || '?';
    const sub = r.inCodex === false ? 'Hors Codex' : 'Codex';
    const key = `${p}__${sub}`;
    if (!groups[key]) groups[key] = { palier: p, sub, items: [] };
    groups[key].items.push(r);
  });

  // Trier : paliers croissants, puis Codex avant Hors Codex
  const sorted = Object.values(groups).sort((a, b) => {
    if (a.palier !== b.palier) return String(a.palier).localeCompare(String(b.palier), undefined, { numeric: true });
    return a.sub === 'Codex' ? -1 : 1;
  });

  let lastPalier = null;
  sorted.forEach(({ palier, sub, items }) => {
    // En-tête palier (une seule fois par palier)
    if (palier !== lastPalier) {
      const ph = document.createElement('div');
      ph.style.cssText = 'padding:6px 12px 2px;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;border-top:' + (lastPalier !== null ? '1px solid var(--surface3)' : 'none');
      ph.textContent = palier === '?' ? 'Palier inconnu' : `Palier ${palier}`;
      dropdown.appendChild(ph);
      lastPalier = palier;
    }

    // Sous-en-tête Codex / Hors Codex
    const sh = document.createElement('div');
    sh.style.cssText = 'padding:3px 18px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;';
    sh.textContent = sub;
    dropdown.appendChild(sh);

    items.forEach(r => {
      const item = document.createElement('div');
      item.className = 'region-drop-item';
      item.style.cssText = 'padding:6px 24px;cursor:pointer;font-size:13px;color:var(--text);transition:background .1s;';
      item.textContent = r.name || r.id;
      item.addEventListener('mousedown', e => { e.preventDefault(); selectMobRegion(r); });
      item.addEventListener('mouseover', () => item.style.background = 'var(--surface3)');
      item.addEventListener('mouseout',  () => item.style.background = '');
      dropdown.appendChild(item);
    });
  });
}

function selectMobRegion(r) {
  document.getElementById('mob-region-search').value = r.name || r.id;
  document.getElementById('mob-region').value        = r.id;
  document.getElementById('mob-regionid').value      = r.id;
  document.getElementById('mob-region-dropdown').classList.remove('open');
  update();
}

// ── PNJ — Dropdown région (même pattern que mob) ──
function openPnjRegionList() {
  const dd = document.getElementById('pnj-region-dropdown');
  renderPnjRegionDropdown();
  positionDrop(dd, dd.parentElement);
  dd.classList.add('open');
}

function closePnjRegionList() {
  document.getElementById('pnj-region-dropdown').classList.remove('open');
}

function filterPnjRegionList() {
  const dd = document.getElementById('pnj-region-dropdown');
  renderPnjRegionDropdown();
  positionDrop(dd, dd.parentElement);
  dd.classList.add('open');
}

function renderPnjRegionDropdown() {
  const dropdown = document.getElementById('pnj-region-dropdown');
  if (!dropdown) return;
  const q = normalize((document.getElementById('pnj-region-search')?.value || '').trim());

  let filtered = _allMobRegions;
  if (q) filtered = filtered.filter(r => normalize(r.name || r.id || '').includes(q));

  dropdown.innerHTML = '';
  if (!filtered.length) {
    dropdown.innerHTML = '<div style="padding:8px 12px;color:var(--muted);font-size:12px;">Aucune région</div>';
    return;
  }

  const groups = {};
  filtered.forEach(r => {
    const p   = r.palier || '?';
    const sub = r.inCodex === false ? 'Hors Codex' : 'Codex';
    const key = `${p}__${sub}`;
    if (!groups[key]) groups[key] = { palier: p, sub, items: [] };
    groups[key].items.push(r);
  });

  const sorted = Object.values(groups).sort((a, b) => {
    if (a.palier !== b.palier) return String(a.palier).localeCompare(String(b.palier), undefined, { numeric: true });
    return a.sub === 'Codex' ? -1 : 1;
  });

  let lastPalier = null;
  sorted.forEach(({ palier, sub, items }) => {
    if (palier !== lastPalier) {
      const ph = document.createElement('div');
      ph.style.cssText = 'padding:6px 12px 2px;font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;border-top:' + (lastPalier !== null ? '1px solid var(--surface3)' : 'none');
      ph.textContent = palier === '?' ? 'Palier inconnu' : `Palier ${palier}`;
      dropdown.appendChild(ph);
      lastPalier = palier;
    }
    const sh = document.createElement('div');
    sh.style.cssText = 'padding:3px 18px;font-size:10px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;';
    sh.textContent = sub;
    dropdown.appendChild(sh);
    items.forEach(r => {
      const item = document.createElement('div');
      item.className = 'region-drop-item';
      item.style.cssText = 'padding:6px 24px;cursor:pointer;font-size:13px;color:var(--text);transition:background .1s;';
      item.textContent = r.name || r.id;
      item.addEventListener('mousedown', e => { e.preventDefault(); selectPnjRegion(r); });
      item.addEventListener('mouseover', () => item.style.background = 'var(--surface3)');
      item.addEventListener('mouseout',  () => item.style.background = '');
      dropdown.appendChild(item);
    });
  });
}

function selectPnjRegion(r) {
  const name = r.name || r.id;
  document.getElementById('pnj-region-search').value = name;
  document.getElementById('pnj-region').value        = name;
  document.getElementById('pnj-region-dropdown').classList.remove('open');
  if (!pnjIdLocked) document.getElementById('pnj-id').value = buildPnjId();
  update();
}

async function loadMobRegions() {
  if (_allMobRegions.length) return;
  const getDocs = window._vcl_getDocs;
  const col     = window._vcl_collection;
  const db      = window._vcl_db;
  if (!getDocs || !col || !db) { setTimeout(loadMobRegions, 300); return; }
  try {
    const snap = await getDocs(col(db, 'regions'));
    const regions = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    regions.sort((a, b) => {
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      if ((a.palier||1) !== (b.palier||1)) return (a.palier||1) - (b.palier||1);
      return (a.name||a.id||'').localeCompare(b.name||b.id||'', 'fr');
    });
    _allMobRegions = regions;
  } catch(e) { console.warn('[Mob] Régions non chargées:', e); }
}

// ═══════════════════════════════════════════════════
// MOB — BUILD OBJECT
// ═══════════════════════════════════════════════════
function buildMobObj() {
  const id        = document.getElementById('mob-id').value.trim();
  const name      = document.getElementById('mob-name').value.trim();
  const type      = document.getElementById('mob-type').value;
  const behavior  = document.getElementById('mob-behavior').value;
  const palier    = document.getElementById('mob-palier').value;
  const lore      = document.getElementById('mob-lore').value.trim();
  const spawnTime = document.getElementById('mob-spawntime').value.trim();
  const regionId = document.getElementById('mob-region').value;

  const obj = {};
  if (id)       obj.id       = id;
  if (name)     obj.name     = name;
  obj.type     = type;
  obj.behavior = behavior;
  if (palier)   obj.palier   = +palier;
  if (regionId) obj.region   = regionId;
  if (id && palier) obj.images = [`../img/mobs/P${palier}/${id}.png`];
  obj.inCodex  = mobInCodex;
  if (mobSensible) obj.sensible = true;
  if (lore)     obj.lore     = lore;
  if (spawnTime && (type === 'boss' || type === 'mini_boss')) obj.spawnTime = spawnTime;
  const cx = document.getElementById('mob-x')?.value;
  const cy = document.getElementById('mob-y')?.value;
  const cz = document.getElementById('mob-z')?.value;
  if (cx !== '' && cy !== '' && cz !== '' && cx != null && cy != null && cz != null) {
    obj.coords = { x: +cx, y: +cy, z: +cz };
  }
  const loot = getMobLoot();
  if (loot.length) obj.loot = loot;

  return obj;
}

// ═══════════════════════════════════════════════════
// MOB — RESET
// ═══════════════════════════════════════════════════
function resetMobForm() {
  mobIdLocked = false; mobInCodex = true; mobSensible = false; mobLootEntries = [];
  const sensBtn = document.getElementById('mob-sensible-btn'); if (sensBtn) sensBtn.classList.remove('active');
  ['mob-name','mob-id','mob-lore','mob-spawntime','mob-regionid','mob-x','mob-y','mob-z'].forEach(fid => {
    const el = document.getElementById(fid); if (el) el.value = '';
  });
  setMobType('monstre');
  setBehavior('agressif');
  document.getElementById('mob-palier').selectedIndex   = 0;
  _customSelUpdaters['mob-palier']?.();
  document.getElementById('mob-region').value           = '';
  document.getElementById('mob-regionid').value         = '';
  document.getElementById('mob-region-search').value    = '';
  document.getElementById('mob-spawntime-field').style.display = 'none';
  document.getElementById('mob-loot-list').innerHTML    = '';
  const dupBadge = document.getElementById('mob-id-duplicate-badge');
  if (dupBadge) dupBadge.style.display = 'none';
  setMobCodex(true);
  update();
}

// ═══════════════════════════════════════════════════
// CREATOR MODE
// ═══════════════════════════════════════════════════
let creatorMode  = 'item';
let pnjIdLocked  = false;
let regIdLocked  = false;

const MODE_SUBTITLES = {
  item:     'Créer un item',
  mob:      'Créer un mob',
  pnj:      'Créer un PNJ',
  region:   'Créer une région (codex ou non)',
  quest:    'Créer une quête',
  panoplie: 'Créer une panoplie',
};

function switchMode(mode) {
  creatorMode = mode;
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  document.getElementById('item-form').style.display   = mode === 'item'   ? 'flex' : 'none';
  document.getElementById('mob-form').style.display    = mode === 'mob'    ? 'flex' : 'none';
  document.getElementById('pnj-form').style.display    = mode === 'pnj'    ? 'flex' : 'none';
  document.getElementById('region-form').style.display = mode === 'region' ? 'flex' : 'none';
  document.getElementById('quest-form').style.display  = mode === 'quest'  ? 'flex' : 'none';
  const panopForm = document.getElementById('panoplie-form');
  if (panopForm) panopForm.style.display = mode === 'panoplie' ? 'flex' : 'none';
  document.getElementById('header-subtitle').textContent = MODE_SUBTITLES[mode] || '';
  document.getElementById('btn-submit-discord').style.display = '';
  // Reset output
  document.getElementById('out-code').textContent = '// Remplis le formulaire\n// pour générer le code ici.';
  document.getElementById('validation-panel').style.display = 'none';
  document.getElementById('id-duplicate-badge').style.display = 'none';
  document.getElementById('id-orphan-badge').style.display = 'none';
  if (mode === 'mob')    loadMobRegions();
  if (mode === 'pnj')    loadMobRegions();
  if (mode === 'region') loadRegionsCache();
  if (mode === 'quest')  loadMobRegions().then(initQuestZoneDrop);
  if (mode === 'panoplie') { loadPanopliesCache().then(() => { renderPanopBonuses(); update(); }); }
  update();
}

// ═══════════════════════════════════════════════════
// PNJ — STATE
// ═══════════════════════════════════════════════════
let pnjSells    = [];
let pnjCrafts   = [];
let pnjSellUid  = 0;
let pnjCraftUid = 0;
let pnjIngUid   = 0;

const PNJ_TYPE_TAGS = {
  "forgeron d'armes":        "forgeron_armes",
  "forgeron d'armures":      "forgeron_armures",
  "forgeron d'accessoires":  "forgeron_accessoires",
  "forgeron de lingots":     "forgeron_lingots",
  "forgeron de clés":        "forgeron_cles",
  "forgeron d'items secrets":"forgeron_items_secrets",
  "marchand d'équipement":   "marchand_equipement",
  "marchand de consommable": "marchand_consommable",
  "marchand d'outils":       "marchand_outils",
  "marchand d'accessoires":  "marchand_accessoires",
  "marchand itinérant":      "marchand_itinerant",
  "repreneur de butin":      "repreneur_butin",
  "bûcheron":                "bucheron",
  "alchimiste":              "alchimiste",
  "quêtes":                  "quetes",
  "quête principale":        "quete_principale",
  "marchand occulte":        "marchand_occulte",
  "fabricant secret":        "fabricant_secret",
  "autres":                  "autres",
};

function pnjRegionSlug(regionName) {
  if (!regionName) return '';
  if (nameToId(regionName) === 'ville_de_depart') return 'vdp';
  return nameToId(regionName);
}

function buildPnjId() {
  const type       = document.getElementById('pnj-type').value;
  const region     = document.getElementById('pnj-region').value.trim();
  const typeSlug   = PNJ_TYPE_TAGS[type] || nameToId(type);
  const regionSlug = pnjRegionSlug(region);
  if (!typeSlug && !regionSlug) return '';
  if (!regionSlug) return typeSlug;
  if (!typeSlug)   return regionSlug;
  return typeSlug + '_' + regionSlug;
}

function onPnjTypeChange() {
  if (!pnjIdLocked) document.getElementById('pnj-id').value = buildPnjId();
  update();
}

function onRegNameInput() {
  if (!regIdLocked) document.getElementById('reg-id').value = nameToId(document.getElementById('reg-name').value);
  update();
}

// ═══════════════════════════════════════════════════
// PNJ — SELLS
// ═══════════════════════════════════════════════════
function addPnjSell() {
  ensureAllItemsIndex();
  pnjSells.push({ uid: pnjSellUid++, itemId: '', buy: '', price: '' });
  renderPnjSells();
}

function renderPnjSells() {
  const list = document.getElementById('pnj-sells-list');
  list.innerHTML = '';
  for (const s of pnjSells) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:1fr 78px 78px auto;gap:6px;align-items:start;';

    const drop = makeSearchDrop(allItemsIndex, 'Item…', id => { s.itemId = id; update(); }, true);
    if (s.itemId) {
      const f = allItemsIndex.find(it => it.id === s.itemId);
      if (f) drop.setValue(s.itemId, f.name);
    }
    s.drop = drop;

    const mkNum = pl => {
      const el = document.createElement('input');
      el.type = 'number'; el.min = '0'; el.step = 'any'; el.placeholder = pl;
      el.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;transition:border-color .15s;';
      el.addEventListener('focus', () => el.style.borderColor = 'var(--accent)');
      el.addEventListener('blur',  () => el.style.borderColor = 'var(--border)');
      return el;
    };

    const buyEl   = mkNum('Achat');
    const priceEl = mkNum('Rachat');
    if (s.buy   !== '') buyEl.value   = s.buy;
    if (s.price !== '') priceEl.value = s.price;
    buyEl.addEventListener('input',   () => { s.buy   = buyEl.value;   update(); });
    priceEl.addEventListener('input', () => { s.price = priceEl.value; update(); });

    const rm = document.createElement('button');
    rm.className = 'btn-icon'; rm.textContent = '✕';
    rm.addEventListener('click', () => { pnjSells = pnjSells.filter(e => e.uid !== s.uid); renderPnjSells(); update(); });

    row.appendChild(drop.element);
    row.appendChild(buyEl);
    row.appendChild(priceEl);
    row.appendChild(rm);
    list.appendChild(row);
  }
}

// ═══════════════════════════════════════════════════
// PNJ — CRAFT
// ═══════════════════════════════════════════════════
function addPnjCraft() {
  ensureAllItemsIndex();
  pnjCrafts.push({ uid: pnjCraftUid++, resultId: '', time: '', quality: false, ingredients: [] });
  renderPnjCrafts();
}

function renderPnjCrafts() {
  const list = document.getElementById('pnj-crafts-list');
  list.innerHTML = '';
  for (const c of pnjCrafts) {
    const card = document.createElement('div');
    card.className = 'pnj-craft-card';

    // ── Header : résultat · temps · qualité · supprimer ──
    const head = document.createElement('div');
    head.style.cssText = 'display:grid;grid-template-columns:1fr 80px auto auto;gap:6px;align-items:start;';

    const resDrop = makeSearchDrop(allItemsIndex, 'Résultat…', id => { c.resultId = id; update(); }, true);
    if (c.resultId) {
      const f = allItemsIndex.find(it => it.id === c.resultId);
      if (f) resDrop.setValue(c.resultId, f.name);
    }
    c.resDrop = resDrop;

    const timeEl = document.createElement('input');
    timeEl.type = 'text'; timeEl.placeholder = '10s'; timeEl.value = c.time;
    timeEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 10px;font-size:13px;outline:none;width:100%;transition:border-color .15s;';
    timeEl.addEventListener('input', () => { c.time = timeEl.value.trim(); update(); });
    timeEl.addEventListener('focus', () => timeEl.style.borderColor = 'var(--accent)');
    timeEl.addEventListener('blur',  () => timeEl.style.borderColor = 'var(--border)');

    const qualBtn = document.createElement('button');
    qualBtn.className = 'r-btn'; qualBtn.style.setProperty('--c', '#4ade80');
    qualBtn.textContent = '✓ Qualité';
    if (c.quality) qualBtn.classList.add('active');
    qualBtn.addEventListener('click', () => { c.quality = !c.quality; qualBtn.classList.toggle('active', c.quality); update(); });

    const rmCard = document.createElement('button');
    rmCard.className = 'btn-icon'; rmCard.textContent = '✕';
    rmCard.addEventListener('click', () => { pnjCrafts = pnjCrafts.filter(e => e.uid !== c.uid); renderPnjCrafts(); update(); });

    head.appendChild(resDrop.element);
    head.appendChild(timeEl);
    head.appendChild(qualBtn);
    head.appendChild(rmCard);
    card.appendChild(head);

    // ── Ingrédients ──
    const ingsWrap = document.createElement('div');
    ingsWrap.className = 'pnj-craft-ings';

    const ingsLabel = document.createElement('div');
    ingsLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px;';
    ingsLabel.textContent = 'Ingrédients';
    ingsWrap.appendChild(ingsLabel);

    for (const ing of c.ingredients) {
      const ingRow = document.createElement('div');
      ingRow.style.cssText = 'display:grid;grid-template-columns:70px 1fr auto;gap:6px;align-items:start;';

      const qtyEl = document.createElement('input');
      qtyEl.type = 'number'; qtyEl.min = '1'; qtyEl.value = ing.qty; qtyEl.placeholder = 'Qté';
      qtyEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;transition:border-color .15s;';
      qtyEl.addEventListener('input', () => { ing.qty = parseInt(qtyEl.value) || 1; update(); });
      qtyEl.addEventListener('focus', () => qtyEl.style.borderColor = 'var(--accent)');
      qtyEl.addEventListener('blur',  () => qtyEl.style.borderColor = 'var(--border)');

      const ingDrop = makeSearchDrop(allItemsIndex, 'Ingrédient…', id => { ing.itemId = id; update(); }, true);
      if (ing.itemId) {
        const f = allItemsIndex.find(it => it.id === ing.itemId);
        if (f) ingDrop.setValue(ing.itemId, f.name);
      }

      const rmIng = document.createElement('button');
      rmIng.className = 'btn-icon'; rmIng.textContent = '✕';
      rmIng.addEventListener('click', () => { c.ingredients = c.ingredients.filter(e => e !== ing); renderPnjCrafts(); update(); });

      ingRow.appendChild(qtyEl);
      ingRow.appendChild(ingDrop.element);
      ingRow.appendChild(rmIng);
      ingsWrap.appendChild(ingRow);
    }

    const addIngBtn = document.createElement('button');
    addIngBtn.className = 'btn btn-ghost btn-sm';
    addIngBtn.style.cssText = 'width:100%;margin-top:4px;';
    addIngBtn.textContent = '+ Ingrédient';
    addIngBtn.addEventListener('click', () => {
      c.ingredients.push({ uid: pnjIngUid++, itemId: '', qty: 1 });
      renderPnjCrafts();
    });
    ingsWrap.appendChild(addIngBtn);

    card.appendChild(ingsWrap);
    list.appendChild(card);
  }
}

// ═══════════════════════════════════════════════════
// PNJ — BUILD OBJECT
// ═══════════════════════════════════════════════════
function buildPnjObj() {
  const id     = document.getElementById('pnj-id').value.trim();
  const type   = document.getElementById('pnj-type').value;
  const palier = document.getElementById('pnj-palier').value;
  const region = document.getElementById('pnj-region').value.trim();
  const cx     = document.getElementById('pnj-x').value;
  const cy     = document.getElementById('pnj-y').value;
  const cz     = document.getElementById('pnj-z').value;

  const obj = {};
  if (id)     obj.id     = id;
  if (type)   { obj.name = type; obj.tag = PNJ_TYPE_TAGS[type] || nameToId(type); }
  if (palier) obj.palier = +palier;
  if (region) obj.region = region;
  if (cx !== '' && cy !== '' && cz !== '') obj.coords = { x: +cx, y: +cy, z: +cz };
  if (id) obj.images = [`../img/compendium/montages/${id}.png`];

  const sells = pnjSells.filter(s => s.itemId).map(s => {
    const e = { id: s.itemId };
    if (s.buy   !== '') e.buy   = +s.buy;
    if (s.price !== '') e.price = +s.price;
    return e;
  });
  if (sells.length) obj.sells = sells;

  const crafts = pnjCrafts.filter(c => c.resultId).map(c => {
    const e = { id: c.resultId };
    if (c.time)    e.time = c.time;
    if (c.quality) e.quality = true;
    const ings = c.ingredients.filter(i => i.itemId).map(i => ({ id: i.itemId, qty: i.qty }));
    if (ings.length) e.ingredients = ings;
    return e;
  });
  if (crafts.length) obj.craft = crafts;

  return obj;
}

// ═══════════════════════════════════════════════════
// RÉGION — BUILD OBJECT
// ═══════════════════════════════════════════════════
function buildRegionObj() {
  const id     = document.getElementById('reg-id').value.trim();
  const name   = document.getElementById('reg-name').value.trim();
  const palier = document.getElementById('reg-palier').value;
  const lore   = document.getElementById('reg-lore').value.trim();

  const obj = {};
  if (id)     obj.id      = id;
  if (name)   obj.name    = name;
  if (palier) obj.palier  = +palier;
  obj.inCodex = regInCodex;
  obj.images  = [];
  if (regCanTp !== null) obj.canTp = regCanTp;
  if (lore)   obj.lore    = lore;

  return obj;
}

// ═══════════════════════════════════════════════════
// PANOPLIE — STATE + HELPERS
// ═══════════════════════════════════════════════════
let panopBonuses = []; // [{uid, pieces, stat, value}]
let _panopUid = 0;
let panopIdLocked = false;
let _panopStatChoices = null;

function panopStatChoices() {
  if (_panopStatChoices) return _panopStatChoices;
  if (typeof STAT_GROUPS === 'undefined') return [];
  _panopStatChoices = STAT_GROUPS.flatMap(g =>
    g.stats.map(s => ({ id: s.id, label: s.label, unit: s.unit || '' }))
  );
  return _panopStatChoices;
}

function onPanopLabelInput() {
  const label = document.getElementById('panop-label').value.trim();
  if (!panopIdLocked) {
    const id = (typeof nameToId === 'function' ? nameToId(label) : label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''));
    document.getElementById('panop-id').value = id;
  }
  update();
}

function addPanopBonus(preset) {
  panopBonuses.push({
    uid: ++_panopUid,
    pieces: preset?.pieces ?? 2,
    stat:   preset?.stat   ?? '',
    value:  preset?.value  ?? '',
  });
  renderPanopBonuses();
  update();
}

function removePanopBonus(uid) {
  panopBonuses = panopBonuses.filter(b => b.uid !== uid);
  renderPanopBonuses();
  update();
}

function renderPanopBonuses() {
  const wrap = document.getElementById('panop-bonuses-list');
  if (!wrap) return;
  if (!panopBonuses.length) {
    wrap.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0;">Aucun bonus. Clique sur « + Ajouter un bonus ».</div>';
    return;
  }
  const stats = panopStatChoices();
  const statsOpts = ['<option value="">— stat —</option>']
    .concat(stats.map(s => `<option value="${escHtml(s.id)}">${escHtml(s.label)}${s.unit ? ' (' + s.unit + ')' : ''}</option>`))
    .join('');
  wrap.innerHTML = panopBonuses.map(b => `
    <div class="panop-bonus-row" data-uid="${b.uid}" style="display:flex;gap:8px;align-items:center;margin-bottom:6px;">
      <div class="field" style="max-width:90px;margin:0;">
        <label style="font-size:10px;">Pièces</label>
        <input type="number" min="2" max="12" value="${b.pieces}" data-k="pieces" oninput="updatePanopBonus(${b.uid}, 'pieces', this.value)">
      </div>
      <div class="field" style="flex:1;margin:0;">
        <label style="font-size:10px;">Stat</label>
        <select data-k="stat" onchange="updatePanopBonus(${b.uid}, 'stat', this.value)">${statsOpts}</select>
      </div>
      <div class="field" style="max-width:100px;margin:0;">
        <label style="font-size:10px;">Valeur</label>
        <input type="number" step="any" value="${b.value}" data-k="value" oninput="updatePanopBonus(${b.uid}, 'value', this.value)">
      </div>
      <button class="btn btn-ghost btn-sm" style="margin-top:14px;" onclick="removePanopBonus(${b.uid})" title="Supprimer">🗑️</button>
    </div>
  `).join('');
  // Remettre les valeurs de select (innerHTML reset)
  panopBonuses.forEach(b => {
    const row = wrap.querySelector(`.panop-bonus-row[data-uid="${b.uid}"]`);
    if (row) {
      const sel = row.querySelector('select[data-k="stat"]');
      if (sel) sel.value = b.stat || '';
    }
  });
}

function updatePanopBonus(uid, key, value) {
  const b = panopBonuses.find(x => x.uid === uid);
  if (!b) return;
  if (key === 'pieces') b.pieces = Math.max(2, parseInt(value, 10) || 2);
  else if (key === 'value') b.value = value === '' ? '' : parseFloat(value);
  else b[key] = value;
  update();
}

function buildPanoplieObj() {
  const id    = document.getElementById('panop-id').value.trim();
  const label = document.getElementById('panop-label').value.trim();

  const obj = {};
  if (id)    obj.id    = id;
  if (label) obj.label = label;

  // Grouper les bonus par nombre de pièces
  const bonuses = {};
  for (const b of panopBonuses) {
    if (!b.stat || b.value === '' || b.value == null) continue;
    const key = String(b.pieces);
    if (!bonuses[key]) bonuses[key] = {};
    bonuses[key][b.stat] = Number(b.value);
  }
  if (Object.keys(bonuses).length) obj.bonuses = bonuses;
  return obj;
}

function resetPanoplieForm() {
  panopBonuses = []; panopIdLocked = false;
  ['panop-label','panop-id'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  renderPanopBonuses();
}

function loadPanoplie(p) {
  switchMode('panoplie');
  resetPanoplieForm();
  if (p.id || p._id) { document.getElementById('panop-id').value = p.id || p._id; panopIdLocked = true; }
  if (p.label)       document.getElementById('panop-label').value = p.label;
  const bonuses = p.bonuses || {};
  for (const [pieces, stats] of Object.entries(bonuses)) {
    for (const [stat, value] of Object.entries(stats || {})) {
      panopBonuses.push({ uid: ++_panopUid, pieces: +pieces, stat, value });
    }
  }
  renderPanopBonuses();
  document.getElementById('formPanel').scrollTo({ top: 0, behavior: 'smooth' });
  update();
}

function renderPanopliePreview() {
  const wrap = document.getElementById('preview-wrap');
  const obj  = buildPanoplieObj();
  if (!obj.id && !obj.label) { wrap.innerHTML = ''; return; }
  const color = obj.color || '#b87333';
  const statMap = Object.fromEntries(panopStatChoices().map(s => [s.id, s]));
  let h = `<div class="mob-card" style="border-color:${color}55;">`;
  h += `<div class="mob-card-header">`;
  h += `<div class="mob-card-name" style="color:${color};">🔗 ${escHtml(obj.label || '')}</div>`;
  if (obj.id) h += `<div style="font-size:10px;color:var(--muted);font-family:monospace;margin-top:4px;">${escHtml(obj.id)}</div>`;
  h += `</div>`;
  h += `<div class="mob-card-body">`;
  const entries = Object.entries(obj.bonuses || {}).sort((a, b) => +a[0] - +b[0]);
  if (!entries.length) {
    h += `<div class="ic-empty">Aucun bonus défini</div>`;
  } else {
    h += `<ul style="list-style:none;padding:0;margin:0;">`;
    for (const [pieces, stats] of entries) {
      const parts = Object.entries(stats).map(([k, v]) => {
        const meta = statMap[k];
        const label = meta ? meta.label : k;
        const unit  = meta?.unit ? (meta.unit === '%' ? '%' : meta.unit === '/s' ? '/s' : '') : '';
        return `+${v}${unit} ${escHtml(label)}`;
      });
      h += `<li style="padding:4px 0;border-top:1px solid var(--border);font-size:12px;"><b style="color:${color};">${pieces} pièces</b> — ${parts.join(', ')}</li>`;
    }
    h += `</ul>`;
  }
  h += `</div></div>`;
  wrap.innerHTML = h;
}

// ═══════════════════════════════════════════════════
// PNJ / RÉGION — RESET
// ═══════════════════════════════════════════════════
function resetPnjForm() {
  pnjSells = []; pnjCrafts = []; pnjIdLocked = false;
  ['pnj-id','pnj-region','pnj-region-search','pnj-x','pnj-y','pnj-z'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const t = document.getElementById('pnj-type');   if (t) t.value = '';
  const p = document.getElementById('pnj-palier'); if (p) p.selectedIndex = 0;
  _customSelUpdaters['pnj-type']?.();
  _customSelUpdaters['pnj-palier']?.();
  document.getElementById('pnj-sells-list').innerHTML  = '';
  document.getElementById('pnj-crafts-list').innerHTML = '';
}

function resetRegionForm() {
  regIdLocked = false;
  ['reg-name','reg-id','reg-lore'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  const p = document.getElementById('reg-palier'); if (p) p.selectedIndex = 0;
  _customSelUpdaters['reg-palier']?.();
  setRegCodex(true);
  setRegCanTp(null);
}

// ═══════════════════════════════════════════════════
// QUÊTE — STATE
// ═══════════════════════════════════════════════════
let questSimpleObjs  = []; // [{uid, texte, next, items:[{uid, itemId, qte}]}]
let questRecompenses = []; // [{uid, type, label, itemId}]
let _qObjUid = 0, _qRewUid = 0, _qItemUid = 0;

function questTitreToId(titre, palier) {
  const stripped = titre.replace(/^\d+\s*[-–—]\s*/, '');
  const base = nameToId(stripped);
  return palier ? `p${palier}_${base}` : base;
}

function onQuestTitreInput() {
  const titre  = document.getElementById('quest-titre').value;
  const palier = document.getElementById('quest-palier').value;
  document.getElementById('quest-id').value = questTitreToId(titre, palier);
  update();
}

function onQuestPalierChange() {
  const titre  = document.getElementById('quest-titre').value;
  const palier = document.getElementById('quest-palier').value;
  document.getElementById('quest-id').value = questTitreToId(titre, palier);
  update();
}

// ── Mode toggle objectifs

// ── Row builder : item requis dans un objectif
function _makeQuestItemRow(item, onRemove) {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 60px auto;gap:5px;align-items:start;';

  ensureAllItemsIndex();
  const drop = makeSearchDrop(allItemsIndex, 'Item…', id => { item.itemId = id; update(); }, true);
  if (item.itemId) {
    const f = allItemsIndex.find(it => it.id === item.itemId);
    if (f) drop.setValue(item.itemId, f.name);
  }

  const qteEl = document.createElement('input');
  qteEl.type = 'number'; qteEl.min = '1'; qteEl.placeholder = 'Qté';
  qteEl.value = item.qte || '';
  qteEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;';
  qteEl.addEventListener('input', () => { item.qte = +qteEl.value; update(); });

  const rm = document.createElement('button');
  rm.className = 'btn-icon'; rm.textContent = '✕';
  rm.addEventListener('click', onRemove);

  row.append(drop.element, qteEl, rm);
  return row;
}

function _makeQuestMobRow(mob, onRemove) {
  const row = document.createElement('div');
  row.style.cssText = 'display:grid;grid-template-columns:1fr 60px auto;gap:5px;align-items:start;';

  ensureAllMobsIndex();
  const drop = makeSearchDrop(allMobsIndex, 'Monstre…', id => { mob.mobId = id; update(); }, false);
  if (mob.mobId) {
    const f = allMobsIndex.find(m => m.id === mob.mobId);
    if (f) drop.setValue(mob.mobId, f.name);
  }

  const qteEl = document.createElement('input');
  qteEl.type = 'number'; qteEl.min = '1'; qteEl.placeholder = 'Qté';
  qteEl.value = mob.qte || '';
  qteEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;';
  qteEl.addEventListener('input', () => { mob.qte = +qteEl.value; update(); });

  const rm = document.createElement('button');
  rm.className = 'btn-icon'; rm.textContent = '✕';
  rm.addEventListener('click', onRemove);

  row.append(drop.element, qteEl, rm);
  return row;
}

// ── Row builder : un objectif
function _makeQuestObjRow(obj, onRemove, onNextToggle) {
  const container = document.createElement('div');
  container.style.cssText = 'display:flex;flex-direction:column;gap:0;';

  const wrap = document.createElement('div');
  wrap.className = 'quest-obj-row';

  const topRow = document.createElement('div');
  topRow.style.cssText = 'display:flex;gap:6px;align-items:start;';

  const texteEl = document.createElement('input');
  texteEl.type = 'text'; texteEl.placeholder = 'Ex : Parler à Abraham';
  texteEl.value = obj.texte || '';
  texteEl.style.cssText = 'flex:1;background:var(--surface3);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:13px;outline:none;transition:border-color .15s;';
  texteEl.addEventListener('focus', () => texteEl.style.borderColor = 'var(--accent)');
  texteEl.addEventListener('blur',  () => texteEl.style.borderColor = 'var(--border)');
  texteEl.addEventListener('input', () => { obj.texte = texteEl.value; update(); });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'obj-next-btn' + (obj.next ? ' active' : '');
  nextBtn.title = 'Indique une suite logique vers l\'étape suivante';
  nextBtn.textContent = '→ Suite';
  nextBtn.addEventListener('click', () => {
    obj.next = !obj.next;
    nextBtn.classList.toggle('active', !!obj.next);
    if (onNextToggle) onNextToggle();
    update();
  });

  const rm = document.createElement('button');
  rm.className = 'btn-icon'; rm.textContent = '✕';
  rm.addEventListener('click', onRemove);

  topRow.append(texteEl, nextBtn, rm);

  const itemsWrap = document.createElement('div');
  itemsWrap.className = 'quest-obj-items';

  if (!obj.mobs) obj.mobs = [];
  const renderItems = () => {
    itemsWrap.innerHTML = '';
    for (const it of obj.items) {
      const row = _makeQuestItemRow(it, () => {
        obj.items = obj.items.filter(i => i.uid !== it.uid);
        renderItems(); update();
      });
      itemsWrap.appendChild(row);
    }
    for (const m of obj.mobs) {
      const row = _makeQuestMobRow(m, () => {
        obj.mobs = obj.mobs.filter(x => x.uid !== m.uid);
        renderItems(); update();
      });
      itemsWrap.appendChild(row);
    }
    const btnBar = document.createElement('div');
    btnBar.style.cssText = 'display:flex;gap:6px;';

    const addItemBtn = document.createElement('button');
    addItemBtn.className = 'btn btn-ghost btn-sm';
    addItemBtn.textContent = '+ Item requis';
    addItemBtn.style.cssText = 'font-size:11px;padding:3px 9px;';
    addItemBtn.addEventListener('click', () => {
      ensureAllItemsIndex();
      obj.items.push({ uid: _qItemUid++, itemId: '', qte: 1 });
      renderItems();
    });

    const addMobBtn = document.createElement('button');
    addMobBtn.className = 'btn btn-ghost btn-sm';
    addMobBtn.textContent = '+ Monstre requis';
    addMobBtn.style.cssText = 'font-size:11px;padding:3px 9px;';
    addMobBtn.addEventListener('click', () => {
      ensureAllMobsIndex();
      obj.mobs.push({ uid: _qItemUid++, mobId: '', qte: 1 });
      renderItems();
    });

    btnBar.append(addItemBtn, addMobBtn);
    itemsWrap.appendChild(btnBar);
  };
  renderItems();

  wrap.append(topRow, itemsWrap);

  // Flèche de suite (affichée sous la row si next: true)
  const arrowEl = document.createElement('div');
  arrowEl.className = 'obj-next-arrow';
  arrowEl.textContent = '↓';
  arrowEl.style.display = obj.next ? '' : 'none';
  nextBtn.addEventListener('click', () => {
    arrowEl.style.display = obj.next ? '' : 'none';
  });

  container.append(wrap, arrowEl);
  return container;
}

// ── Simple mode
function addQuestObjectif() {
  ensureAllItemsIndex();
  ensureAllMobsIndex();
  questSimpleObjs.push({ uid: _qObjUid++, texte: '', items: [], mobs: [] });
  renderQuestSimpleObjs();
}

function renderQuestSimpleObjs() {
  const list = document.getElementById('qobj-simple-list');
  list.innerHTML = '';
  for (const obj of questSimpleObjs) {
    const row = _makeQuestObjRow(obj, () => {
      questSimpleObjs = questSimpleObjs.filter(o => o.uid !== obj.uid);
      renderQuestSimpleObjs(); update();
    }, () => {
      renderQuestSimpleObjs(); update();
    });
    list.appendChild(row);
  }
}


// ── Récompenses
function addQuestRecompense() {
  // exp et cols sont uniques — on choisit le premier type disponible
  const used = new Set(questRecompenses.filter(r => r.type !== 'items').map(r => r.type));
  const next = ['exp', 'cols'].find(t => !used.has(t)) || 'items';
  questRecompenses.push({ uid: _qRewUid++, type: next, value: '', itemId: '' });
  renderQuestRecompenses();
}

function renderQuestRecompenses() {
  ensureAllItemsIndex();
  const list = document.getElementById('quest-rew-list');
  list.innerHTML = '';
  for (const rew of questRecompenses) {
    const row = document.createElement('div');
    row.style.cssText = 'display:grid;grid-template-columns:100px 1fr auto;gap:6px;align-items:start;';

    const typeEl = document.createElement('select');
    typeEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px;font-size:13px;outline:none;height:38px;width:100%;';
    const takenTypes = new Set(questRecompenses.filter(r => r.uid !== rew.uid && r.type !== 'items').map(r => r.type));
    typeEl.innerHTML = `
      <option value="exp"  ${rew.type==='exp'  ?'selected':''} ${takenTypes.has('exp')  ?'disabled':''}>⭐ XP</option>
      <option value="cols" ${rew.type==='cols' ?'selected':''} ${takenTypes.has('cols') ?'disabled':''}>🪙 Cols</option>
      <option value="items"${rew.type==='items'?'selected':''}>🎁 Item</option>`;
    typeEl.addEventListener('change', () => {
      const taken = new Set(questRecompenses.filter(r => r.uid !== rew.uid && r.type !== 'items').map(r => r.type));
      if (typeEl.value !== 'items' && taken.has(typeEl.value)) { typeEl.value = rew.type; return; }
      rew.type = typeEl.value; rew.value = ''; rew.itemId = '';
      renderQuestRecompenses(); update();
    });

    let valueEl;
    if (rew.type === 'items') {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:grid;grid-template-columns:1fr 70px;gap:5px;align-items:start;';

      const drop = makeSearchDrop(allItemsIndex, 'Rechercher item…', id => {
        rew.itemId = id;
        const f = allItemsIndex.find(it => it.id === id);
        rew.value = f ? f.name : id;
        update();
      }, true);
      if (rew.itemId) {
        const f = allItemsIndex.find(it => it.id === rew.itemId);
        if (f) drop.setValue(rew.itemId, f.name);
      }

      const qteEl = document.createElement('input');
      qteEl.type = 'number'; qteEl.min = '1'; qteEl.placeholder = 'Qté';
      qteEl.value = rew.qte || '';
      qteEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 6px;font-size:12px;text-align:center;outline:none;width:100%;height:38px;box-sizing:border-box;transition:border-color .15s;';
      qteEl.addEventListener('focus', () => qteEl.style.borderColor = 'var(--accent)');
      qteEl.addEventListener('blur',  () => qteEl.style.borderColor = 'var(--border)');
      qteEl.addEventListener('input', () => { rew.qte = qteEl.value ? +qteEl.value : null; update(); });

      wrap.append(drop.element, qteEl);
      valueEl = wrap;
    } else {
      const numEl = document.createElement('input');
      numEl.type = 'number'; numEl.min = '0';
      numEl.placeholder = rew.type === 'exp' ? '420' : '50';
      numEl.value = rew.value || '';
      numEl.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 10px;font-size:13px;outline:none;width:100%;height:38px;box-sizing:border-box;transition:border-color .15s;';
      numEl.addEventListener('focus', () => numEl.style.borderColor = 'var(--accent)');
      numEl.addEventListener('blur',  () => numEl.style.borderColor = 'var(--border)');
      numEl.addEventListener('input', () => { rew.value = numEl.value; update(); });
      valueEl = numEl;
    }

    const rm = document.createElement('button');
    rm.className = 'btn-icon'; rm.textContent = '✕';
    rm.style.marginTop = '1px';
    rm.addEventListener('click', () => {
      questRecompenses = questRecompenses.filter(r => r.uid !== rew.uid);
      renderQuestRecompenses(); update();
    });

    row.append(typeEl, valueEl, rm);
    list.appendChild(row);
  }
}

// ── Build object
function buildQuestObj() {
  const id     = document.getElementById('quest-id').value.trim();
  const titre  = document.getElementById('quest-titre').value.trim();
  const type   = document.getElementById('quest-type').value;
  const palier = document.getElementById('quest-palier').value;
  const zone   = _questZoneDrop ? _questZoneDrop.getValue() : '';
  const npc    = document.getElementById('quest-npc').value.trim();
  const desc   = document.getElementById('quest-desc').value.trim();

  const obj = {};
  if (id)     obj.id     = id;
  if (type)   obj.type   = type;
  if (palier) obj.palier = +palier;
  if (titre)  obj.titre  = titre;
  if (zone)   obj.zone   = zone;
  obj.npc = npc;
  if (desc)   obj.desc   = desc;

  const objs = questSimpleObjs
    .filter(o => o.texte.trim())
    .map(o => {
      const e = { texte: o.texte.trim() };
      const items = o.items.filter(i => i.itemId).map(i => ({ id: i.itemId, qte: +i.qte || 1 }));
      if (items.length) e.items = items;
      const mobs = (o.mobs || []).filter(m => m.mobId).map(m => ({ id: m.mobId, qte: +m.qte || 1 }));
      if (mobs.length) e.mobs = mobs;
      if (o.next) e.next = true;
      return e;
    });
  if (objs.length) obj.objectifs = objs;

  const rews = questRecompenses
    .filter(r => r.type === 'items' ? r.itemId : r.value)
    .map(r => {
      if (r.type === 'items') {
        const e = { type: 'items', itemId: r.itemId };
        if (r.value) e.label = r.value;
        if (r.qte && r.qte > 1) e.qte = r.qte;
        return e;
      }
      if (r.type === 'exp')  return { type: 'exp',  xp:   parseInt(r.value) || 0 };
      if (r.type === 'cols') return { type: 'cols', cols: parseInt(r.value) || 0 };
      return { type: r.type, label: r.value };
    });
  if (rews.length) obj.recompenses = rews;

  obj.statut = 'todo';
  return obj;
}

// ── Zone dropdown
let _questZoneDrop = null;

function initQuestZoneDrop() {
  const container = document.getElementById('quest-zone-container');
  if (!container) return;
  const zones = _allMobRegions.map(r => ({
    id:     r.name || r.id,
    name:   r.name || r.id,
    search: normalize(r.name || r.id),
    subtitle: r.palier ? `Palier ${r.palier}` : '',
  }));
  _questZoneDrop = makeSearchDrop(zones, '🔍 Zone…', () => update(), false);
  container.innerHTML = '';
  container.appendChild(_questZoneDrop.element);
}

// ── Preview
const QUEST_TYPE_COLORS = { main: '#e07c50', secondary: '#6aaad4', tertiary: '#82c470' };
const QUEST_TYPE_LABELS = { main: 'Principale', secondary: 'Secondaire', tertiary: 'Tertiaire' };

function renderQuestPreview(obj) {
  const wrap = document.getElementById('preview-wrap');
  if (!obj) { wrap.innerHTML = ''; return; }

  const tc = QUEST_TYPE_COLORS[obj.type] || '#9a9ab0';
  const tl = QUEST_TYPE_LABELS[obj.type] || obj.type || '?';

  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Objectifs HTML
  let objHtml = '';
  if (obj.objectifs?.length) {
    obj.objectifs.forEach((o, idx) => {
      objHtml += `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;">
        <span style="color:${tc};flex-shrink:0;margin-top:1px;">◻</span>
        <span style="font-size:12px;">${esc(o.texte)}</span>
      </div>`;
      if (o.items?.length) {
        o.items.forEach(it => {
          objHtml += `<div style="font-size:11px;color:var(--muted);padding-left:18px;">→ ${esc(it.id)} ×${it.qte}</div>`;
        });
      }
      if (o.next && idx < obj.objectifs.length - 1) {
        objHtml += `<div style="text-align:center;font-size:14px;color:${tc};opacity:.7;margin:1px 0;line-height:1;">↓</div>`;
      }
    });
  }

  // Récompenses HTML
  let rewHtml = '';
  if (obj.recompenses?.length) {
    rewHtml = '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;">';
    obj.recompenses.forEach(r => {
      const icon = r.type === 'exp' ? '⭐' : r.type === 'cols' ? '🪙' : '🎁';
      let lbl = r.type === 'items' ? (r.label || r.itemId || '?') : (r.label || '?');
      if (r.type === 'items' && r.qte > 1) lbl += ` ×${r.qte}`;
      rewHtml += `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:3px 10px;font-size:12px;">${icon} ${esc(lbl)}</span>`;
    });
    rewHtml += '</div>';
  }

  wrap.innerHTML = `
    <div style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:10px;overflow:hidden;">
      <div style="background:var(--surface2);border-bottom:3px solid ${tc};padding:12px 14px;">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
          <span style="background:${tc}22;color:${tc};border:1px solid ${tc}66;border-radius:10px;padding:2px 10px;font-size:11px;font-weight:700;">${esc(tl)}</span>
          ${obj.palier ? `<span style="font-size:11px;color:var(--muted);">Palier ${obj.palier}</span>` : ''}
        </div>
        <div style="font-family:'Cinzel',Georgia,serif;font-size:16px;font-weight:900;color:var(--text);line-height:1.2;">${esc(obj.titre||'—')}</div>
        <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:11px;color:var(--muted);">
          ${obj.zone ? `<span>📍 ${esc(obj.zone)}</span>` : ''}
          ${obj.npc  ? `<span>🧑 ${esc(obj.npc)}</span>`  : ''}
        </div>
      </div>
      ${obj.desc ? `<div style="padding:10px 14px;font-size:12px;color:var(--text);line-height:1.6;border-bottom:1px solid var(--border);">${esc(obj.desc)}</div>` : ''}
      ${objHtml ? `<div style="padding:10px 14px;border-bottom:1px solid var(--border);">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">Objectifs</div>
        ${objHtml}
      </div>` : ''}
      ${rewHtml ? `<div style="padding:10px 14px;">
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;">Récompenses</div>
        ${rewHtml}
      </div>` : ''}
    </div>`;
}

// ── Reset
function resetQuestForm() {
  questSimpleObjs  = [];
  questRecompenses = [];
  ['quest-titre','quest-id','quest-npc','quest-desc'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  if (_questZoneDrop) _questZoneDrop.reset();
  const t = document.getElementById('quest-type');   if (t) t.selectedIndex = 0;
  const p = document.getElementById('quest-palier'); if (p) p.selectedIndex = 0;
  _customSelUpdaters['quest-type']?.();
  _customSelUpdaters['quest-palier']?.();
  renderQuestSimpleObjs();
  renderQuestRecompenses();
}

function _revealLayout() {
  const layout = document.getElementById('main-layout');
  if (layout) layout.style.visibility = '';
}

function _setCreatorDisabled(disabled) {
  let msg = document.getElementById('creator-disabled-msg');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'creator-disabled-msg';
    msg.innerHTML = `
      <div class="cdm-icon">🔒</div>
      <div class="cdm-title">Creator indisponible</div>
      <div class="cdm-sub">Aucun outil de création n'est disponible pour le moment. Reviens plus tard !</div>`;
    document.body.appendChild(msg);
  }
  const submitBtn   = document.getElementById('btn-submit-discord');
  const resetBtn    = submitBtn?.nextElementSibling;
  const subtitle    = document.getElementById('header-subtitle');
  if (disabled) {
    msg.style.display         = 'flex';
    document.getElementById('main-layout').style.visibility = 'hidden';
    if (submitBtn) submitBtn.style.display    = 'none';
    if (resetBtn)  resetBtn.style.display     = 'none';
    if (subtitle)  subtitle.textContent       = '';
  } else {
    _revealLayout();
    msg.style.display         = 'none';
    if (submitBtn) submitBtn.style.display    = '';
    if (resetBtn)  resetBtn.style.display     = '';
  }
}


// ── Appelé par db-loader.js après chargement Firestore ─
window._pageInit = function() {
  allMobsIndex = []; // force rebuild avec les données fraîches
  _buildMobLoadDrop();
  _pnjDropBuilt = false; _regDropBuilt = false; _panopDropBuilt = false;
  _buildLoadDrops();
  initObtainData();  // recharge la liste de mobs pour le loot picker
  buildOrphanSection();
};

// ── Autocomplete off (sauf champs auth) ────────────────
  document.addEventListener('DOMContentLoaded', function() {
    const skip = new Set(['modal-email','reg-pseudo','modal-password']);
    document.querySelectorAll('input, textarea').forEach(function(el) {
      if (!skip.has(el.id)) el.setAttribute('autocomplete', 'off');
    });
  });
