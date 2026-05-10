/* ══════════════════════════════════════════════════════
   AUTH WIDGET — Pages publiques du wiki VCL
   Ajoute connexion/déconnexion dans le header.
   Expose : window._vcl_uid, _vcl_role, _vcl_base_role, _vcl_can_view_sensible
   Dispatch : 'vcl:auth-ready' sur document avec detail {uid, role, baseRole}
══════════════════════════════════════════════════════ */

import { auth, db, getUserRole, login, loginWithGoogle, logout, hasRole, ROLES }
  from './firebase.js';
import { onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import { doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

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
      <span class="vcl-auth-pseudo" id="vcl-user-pseudo"></span>
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
      <div class="vcl-auth-modal-title">🌙 Connexion</div>
      <div class="vcl-auth-error" id="vcl-auth-error"></div>
      <input class="vcl-auth-input" id="vcl-auth-email" type="text"
             placeholder="Identifiant ou e-mail" autocomplete="email" />
      <input class="vcl-auth-input" id="vcl-auth-password" type="password"
             placeholder="Mot de passe" autocomplete="current-password" />
      <button class="vcl-auth-primary-btn" id="vcl-auth-submit">🔑 Se connecter</button>
      <div class="vcl-auth-divider">— ou —</div>
      <button class="vcl-auth-google-btn" id="vcl-auth-google">🌐 Continuer avec Google</button>
    </div>`;
  document.body.appendChild(overlay);
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
  document.getElementById('vcl-user-pseudo').textContent =
    user.displayName || user.email?.split('@')[0] || 'Veilleur';
  const badge = document.getElementById('vcl-role-badge');
  badge.textContent = `${d.emoji} ${d.label}`;
  badge.style.background = d.color;
  if (hasRole(baseRole, 'contributeur')) _injectModLink();
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

  document.getElementById('vcl-login-btn').onclick = () => {
    _showError('');
    overlay.classList.remove('hidden');
    document.getElementById('vcl-auth-email').focus();
  };
  document.getElementById('vcl-modal-close').onclick = () => overlay.classList.add('hidden');
  overlay.onclick = e => { if (e.target === overlay) overlay.classList.add('hidden'); };
  document.getElementById('vcl-logout-btn').onclick = () => logout();

  const doLogin = async () => {
    let email = document.getElementById('vcl-auth-email').value.trim();
    if (email && !email.includes('@')) email += '@veilleurs.wiki';
    const pwd   = document.getElementById('vcl-auth-password').value;
    if (!email || !pwd) { _showError('Remplissez tous les champs.'); return; }
    _showError('');
    const btn = document.getElementById('vcl-auth-submit');
    btn.disabled = true;
    try {
      await login(email, pwd);
      overlay.classList.add('hidden');
    } catch (e) {
      _showError(['auth/wrong-password','auth/user-not-found','auth/invalid-credential']
        .includes(e.code) ? 'Identifiants incorrects.' : e.message);
    } finally { btn.disabled = false; }
  };

  document.getElementById('vcl-auth-submit').onclick = doLogin;
  document.getElementById('vcl-auth-password').addEventListener('keydown',
    e => { if (e.key === 'Enter') doLogin(); });

  document.getElementById('vcl-auth-google').onclick = async () => {
    _showError('');
    try {
      await loginWithGoogle();
      overlay.classList.add('hidden');
    } catch (e) { _showError(e.message); }
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
  });
})();
