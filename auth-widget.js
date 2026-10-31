/* ══════════════════════════════════════════════════════
   AUTH WIDGET — Pages publiques du wiki VCL
   Ajoute connexion/déconnexion dans le header.
   Expose : window._vcl_uid, _vcl_role, _vcl_base_role, _vcl_can_view_sensible
   Dispatch : 'vcl:auth-ready' sur document avec detail {uid, role, baseRole}
══════════════════════════════════════════════════════ */

import './i18n.js';   // langue + traduction de l'interface (chargé sur toutes les pages publiques via ce widget)
import { auth, db, getUserRole, loginWithDiscord, logout, hasRole, ROLES }
  from './firebase.js';
import { loadHonorTitles, findHonorTitle, honorBadgeHtml } from './honor-titles.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc, collection, getDocs, query, where, updateDoc }
  from './d1db.js';

// ── Display config ───────────────────────────────────
const _baseDisplay = {
  visiteur:     { label: 'Visiteur',     emoji: '👤', color: '#4ade80' },
  membre:       { label: 'Membre',       emoji: '⭐', color: '#60a5fa' },
  contributeur: { label: 'Contributeur', emoji: '🔨', color: '#f59e0b' },
  admin:        { label: 'Admin',        emoji: '👑', color: '#f87171' },
};

let _customRoles = [];
let _roleDisplay  = { ..._baseDisplay };

// ── Helpers ──────────────────────────────────────────
function _prefix() {
  const a = document.querySelector('.header-nav a.nav-link');
  return a?.getAttribute('href')?.startsWith('../') ? '../' : '';
}

function _baseTier(role) {
  if (ROLES.includes(role)) return role;
  return _customRoles.find(r => r.id === role)?.baseTier || 'visiteur';
}

function _display(role) {
  if (_roleDisplay[role]) return _roleDisplay[role];
  const cr = _customRoles.find(r => r.id === role);
  return cr
    ? { label: cr.label, emoji: cr.emoji || '⭐', color: cr.color || '#888' }
    : { label: role, emoji: '?', color: '#888' };
}

async function _loadCustomRoles() {
  try {
    const snap = await getDoc(doc(db, 'config', 'customRoles'));
    if (!snap.exists()) return;
    _customRoles = snap.data().roles || [];
    const bd = snap.data().baseRoleDisplay || {};
    for (const [r, v] of Object.entries(bd)) {
      if (_roleDisplay[r]) _roleDisplay[r] = { ..._roleDisplay[r], ...v };
    }
  } catch { /* offline ou non créé */ }
}

// ── DOM injection ────────────────────────────────────
function _injectWidget() {
  if (document.getElementById('vcl-auth-widget')) return;

  // Widget dans header-right
  const widget = document.createElement('div');
  widget.id = 'vcl-auth-widget';
  widget.className = 'vcl-auth-widget';
  widget.innerHTML = `
    <button class="vcl-auth-btn" id="vcl-login-btn">🔑 Connexion</button>
    <div id="vcl-user-info" style="display:none">
      <img class="vcl-auth-avatar" id="vcl-user-avatar" alt="" style="display:none">
      <span class="vcl-auth-pseudo" id="vcl-user-pseudo"></span>
      <span id="vcl-user-honor"></span>
      <span class="vcl-auth-role-badge" id="vcl-role-badge"></span>
      <button class="vcl-auth-btn" id="vcl-logout-btn">Déconnexion</button>
    </div>`;
  document.querySelector('.header-right')?.insertBefore(widget, document.querySelector('.header-right').firstChild);

  // Overlay de connexion
  const overlay = document.createElement('div');
  overlay.id = 'vcl-auth-overlay';
  overlay.className = 'vcl-auth-overlay hidden';
  overlay.innerHTML = `
    <div class="vcl-auth-modal-box" role="dialog" aria-modal="true">
      <button class="vcl-auth-close-btn" id="vcl-modal-close" title="Fermer">✕</button>
      <div class="vcl-auth-modal-logo">🌙</div>
      <div class="vcl-auth-hint" id="vcl-auth-hint" style="text-align:center;margin-bottom:12px;"></div>

      <div class="vcl-auth-error" id="vcl-auth-error"></div>

      <button class="vcl-auth-google-btn vcl-auth-discord-btn" id="vcl-auth-discord">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.3 4.4A19.8 19.8 0 0 0 15.4 3l-.2.5a18.3 18.3 0 0 0-6.4 0L8.6 3a19.8 19.8 0 0 0-4.9 1.4C.6 9 -.3 13.5.1 18a19.9 19.9 0 0 0 6 3l.8-1.1a13 13 0 0 1-2-1l.5-.4a14.2 14.2 0 0 0 12.2 0l.5.4a13 13 0 0 1-2 1l.8 1.1a19.9 19.9 0 0 0 6-3c.5-5.2-.8-9.7-3.6-13.6ZM8 15.3c-1.2 0-2.1-1.1-2.1-2.4S6.800 10.500 8 10.500s2.200 1.100 2.100 2.400c0 1.300-.9 2.400-2.100 2.400Zm8 0c-1.200 0-2.100-1.100-2.100-2.400s.9-2.400 2.100-2.400 2.200 1.100 2.100 2.400c0 1.300-.9 2.400-2.100 2.400Z"/></svg>
        Continuer avec Discord
      </button>
    </div>`;
  document.documentElement.appendChild(overlay);
}

function _injectModLink() {
  if (document.querySelector('.vcl-nav-mod')) return;
  const nav = document.querySelector('.header-nav');
  if (!nav) return;
  const a = document.createElement('a');
  a.className = 'nav-link vcl-nav-mod';
  a.href = `${_prefix()}moderation.html`;
  a.innerHTML = '<span class="nav-icon">🛡️</span><span class="nav-label">Modération</span>';
  nav.appendChild(a);
}

function _removeModLink() {
  document.querySelector('.vcl-nav-mod')?.remove();
}

// ── UI state ─────────────────────────────────────────
function _showLoginUI() {
  document.getElementById('vcl-login-btn').style.display = '';
  document.getElementById('vcl-user-info').style.display = 'none';
  _removeModLink();
}

function _showUserUI(user, role, baseRole) {
  const d = _display(role);
  document.getElementById('vcl-login-btn').style.display = 'none';
  document.getElementById('vcl-user-info').style.display = 'flex';
  const pseudo = user.displayName || user.email?.split('@')[0] || 'Veilleur';
  document.getElementById('vcl-user-pseudo').textContent = pseudo;
  _loadAvatar(user.uid);
  // titre honorifique (config/leaderboard_titles), reconnu par uid ou par pseudo
  const honorEl = document.getElementById('vcl-user-honor');
  if (honorEl) {
    honorEl.innerHTML = '';
    loadHonorTitles().then(t => {
      if (document.getElementById('vcl-user-pseudo')?.textContent === pseudo) honorEl.innerHTML = honorBadgeHtml(findHonorTitle(t, user.uid, pseudo));
    });
  }
  const badge = document.getElementById('vcl-role-badge');
  badge.textContent = `${d.emoji} ${d.label}`;
  badge.style.background = d.color;
  if (hasRole(baseRole, 'contributeur')) _injectModLink();

}

// Avatar Discord (users/{uid}.discordId + discordAvatar) à gauche du pseudo
async function _loadAvatar(uid) {
  const img = document.getElementById('vcl-user-avatar');
  if (!img) return;
  img.style.display = 'none';
  try {
    const d = (await getDoc(doc(db, 'users', uid))).data() || {};
    if (!d.discordId) return;
    img.onerror = () => { img.style.display = 'none'; };
    img.src = d.discordAvatar
      ? `https://cdn.discordapp.com/avatars/${d.discordId}/${d.discordAvatar}.png?size=64`
      : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(d.discordId) >> 22n) % 6n)}.png`;
    img.style.display = '';
  } catch { /* pas d'avatar */ }
}

function _showError(msg) {
  const el = document.getElementById('vcl-auth-error');
  if (!el) return;
  el.textContent = msg;
  el.style.display = msg ? '' : 'none';
}

// ── Events ───────────────────────────────────────────
function _wireEvents() {
  const overlay = document.getElementById('vcl-auth-overlay');

  const DEFAULT_HINT = 'Connecte-toi avec Discord pour publier des builds et voir tes contributions comptées dans le leaderboard.';
  // Ouvre la fenêtre de connexion ; msg explique ce que la connexion apporte dans le contexte courant
  window.vclOpenLogin = msg => {
    document.getElementById('vcl-auth-hint').textContent = msg || DEFAULT_HINT;
    _showError('');
    overlay.classList.remove('hidden');
  };
  document.getElementById('vcl-login-btn').onclick = () => window.vclOpenLogin();
  document.getElementById('vcl-modal-close').onclick = () => overlay.classList.add('hidden');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
  document.getElementById('vcl-logout-btn').onclick = () => logout();

  document.getElementById('vcl-auth-discord').onclick = async () => {
    _showError('');
    try {
      await loginWithDiscord('login');
      overlay.classList.add('hidden');
    } catch (e) { if (e.code !== 'auth/popup-closed-by-user') _showError(e.message); }
  };
}

// ── Réponses des admins aux signalements (bug / suggestion / erreur de fiche) ──
// Au retour d'un joueur connecté qui a signalé quelque chose, un popup affiche la réponse des admins (une fois : replySeen).
function _esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

async function _showReportReplies(uid) {
  try { if (sessionStorage.getItem('vcl_rr_' + uid)) return; } catch {}   // une vérification par session
  let replies;
  try {
    const snap = await getDocs(query(collection(db, 'reports'), where('submittedBy', '==', uid)));
    replies = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(r => r.reply && !r.replySeen)
      .sort((a, b) => (a.replyAt?.toMillis?.() ?? 0) - (b.replyAt?.toMillis?.() ?? 0));
  } catch { return; }
  try { sessionStorage.setItem('vcl_rr_' + uid, '1'); } catch {}
  if (!replies.length || document.getElementById('vcl-reply-overlay')) return;

  const ov = document.createElement('div');
  ov.id = 'vcl-reply-overlay';
  ov.className = 'vcl-reply-overlay';
  ov.innerHTML = '<div class="vcl-reply-modal"><h3>💬 Réponse à ton signalement</h3>'
    + replies.map(r => '<div class="vcl-reply-item">'
      + '<div class="vcl-reply-q">' + (r.ficheId ? _esc((r.ficheName || r.ficheId)) + ' — ' : '') + _esc(String(r.text || '').slice(0, 300)) + '</div>'
      + '<div class="vcl-reply-a">' + _esc(r.reply).replace(/\n/g, '<br>') + '</div></div>').join('')
    + '<div class="vcl-reply-actions"><button type="button" id="vcl-reply-ok">Merci !</button></div></div>';
  document.body.appendChild(ov);
  document.getElementById('vcl-reply-ok').onclick = () => {
    ov.remove();
    replies.forEach(r => updateDoc(doc(db, 'reports', r.id), { replySeen: true }).catch(() => {}));
  };
}

// ── Globals & event ──────────────────────────────────
function _setGlobals(uid, role, baseRole) {
  window._vcl_uid               = uid;
  window._vcl_role              = role;
  window._vcl_base_role         = baseRole;
  window._vcl_can_view_sensible = hasRole(baseRole, 'contributeur');
}

function _dispatch(uid, role, baseRole) {
  document.dispatchEvent(new CustomEvent('vcl:auth-ready', {
    detail: { uid, role, baseRole }
  }));
}

// ── Init ─────────────────────────────────────────────
(async () => {
  _injectWidget();
  _wireEvents();
  await _loadCustomRoles();

  onAuthStateChanged(auth, async user => {
    if (!user) {
      _setGlobals(null, 'visiteur', 'visiteur');
      _showLoginUI();
      _dispatch(null, 'visiteur', 'visiteur');
      return;
    }
    const role     = await getUserRole(user.uid);
    const baseRole = _baseTier(role);
    _setGlobals(user.uid, role, baseRole);
    _showUserUI(user, role, baseRole);
    _dispatch(user.uid, role, baseRole);
    _showReportReplies(user.uid);
  });
})();
