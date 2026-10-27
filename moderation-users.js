// ══════════════════════════════════════════════════════
// MEMBRES — gestion des rôles
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { writeAudit: _writeAudit, escHtml, setHash: _setHash, MANAGED_TIERS, getTierDisplay: _getTierDisplay, db, ROLES, collection, getDocs, doc, updateDoc, deleteDoc, deleteField, serverTimestamp } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
const ROLES_LIST = ROLES.filter(r => r !== 'visiteur');
let _allUsers = [];

function _assignableRoles() {
  const custom = ctx.customRoles.filter(r => r.id !== 'visiteur');
  return [...custom, { id: 'admin', label: 'Admin', emoji: '👑', color: '#f87171' }];
}

function _roleSortKey(role) {
  if (role === 'admin') return 100;
  const mi = MANAGED_TIERS.indexOf(role);
  if (mi !== -1) return mi + 1;
  const cr = ctx.customRoles.find(r => r.id === role);
  return cr ? (MANAGED_TIERS.indexOf(cr.baseTier || 'membre') + 1) : 0;
}

function _renderUsersRoleFilter() {
  const sel = document.getElementById('users-role-filter');
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = '<option value="">Tous les rôles</option>';
  for (const r of _assignableRoles()) {
    const opt = document.createElement('option');
    opt.value = r.id;
    opt.textContent = `${r.emoji || ''} ${r.label}`;
    sel.appendChild(opt);
  }
  sel.value = prev;
}

window.showUsersPanel = async () => {
  _setHash('members');
  document.getElementById('users-panel').style.display = '';
  document.getElementById('btn-users').classList.add('active');
  if (ctx.customRoles.every(r => MANAGED_TIERS.includes(r.id))) await loadRoles();
  await loadUsers();
};

window.loadUsers = async () => {
  const list = document.getElementById('users-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(collection(db, 'users'));
    _allUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }))
      .sort((a, b) => _roleSortKey(b.role) - _roleSortKey(a.role)
                   || (a.pseudo || '').localeCompare(b.pseudo || ''));
    renderUsers(_allUsers);
  } catch (e) {
    list.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

function renderUsers(users) {
  const list = document.getElementById('users-list');
  if (!users.length) { list.innerHTML = '<div class="empty">Aucun membre.</div>'; return; }

  _renderUsersRoleFilter();

  // Contribution count depuis ctx.allSubs (déjà en mémoire)
  const contribCount = new Map();
  for (const s of ctx.allSubs) {
    if (s.status === 'approved' && s.submittedBy) {
      contribCount.set(s.submittedBy, (contribCount.get(s.submittedBy) || 0) + 1);
    }
  }

  const assignable = _assignableRoles();
  list.innerHTML = '';
  users.forEach(u => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.dataset.uid = u.uid;

    const isSuspended = !!u.suspended;
    const count       = contribCount.get(u.uid) || 0;
    const roleDisplay = _getTierDisplay(u.role || 'membre');
    const sel = assignable.map(r =>
      `<option value="${r.id}"${r.id === u.role ? ' selected' : ''}>${r.emoji ? r.emoji + ' ' : ''}${r.label}</option>`
    ).join('');

    const suspBadge = isSuspended
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;flex-shrink:0;" title="${escHtml(u.suspendedReason || '')}">🚫 Suspendu</span>`
      : '';
    const suspBtn = isSuspended
      ? `<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px;color:var(--success,#4ade80);border-color:var(--success,#4ade80);" onclick="unsuspendUser('${escHtml(u.uid)}', '${escHtml(u.pseudo || u.uid)}')">✓ Lever</button>`
      : `<button class="btn btn-ghost" style="font-size:11px;padding:2px 8px;color:var(--warn,#f59e0b);border-color:var(--warn,#f59e0b);" onclick="suspendUser('${escHtml(u.uid)}', '${escHtml(u.pseudo || u.uid)}')">🚫 Suspendre</button>`;

    const countBadge = count > 0
      ? `<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:rgba(224,172,96,.12);color:var(--accent);border:1px solid rgba(224,172,96,.25);margin-left:4px;">${count} contrib.</span>`
      : '';

    row.innerHTML = `
      <span class="user-pseudo">${escHtml(u.pseudo || '—')} ${suspBadge}${countBadge}</span>
      <span class="user-uid">${escHtml(u.uid)}</span>
      <span class="user-email" style="font-size:11px;color:var(--muted);">${escHtml(u.email || '—')}</span>
      <span class="user-role-badge" style="color:${roleDisplay.color || 'var(--muted)'};">${escHtml(roleDisplay.emoji ? roleDisplay.emoji + ' ' : '')}${escHtml(roleDisplay.label || u.role || 'membre')}</span>
      <select class="user-role-sel" onchange="setUserRole('${escHtml(u.uid)}', this.value, this)">${sel}</select>
      ${suspBtn}
      <button class="btn btn-ghost" style="font-size:11px;padding:2px 8px;color:var(--danger);border-color:var(--danger);" onclick="deleteUserAccount('${escHtml(u.uid)}', '${escHtml(u.pseudo || u.uid)}')">🗑️</button>
    `;
    list.appendChild(row);
  });
}

window.filterUsers = () => {
  const q    = normalize((document.getElementById('users-search')?.value || '').trim());
  const role = document.getElementById('users-role-filter')?.value || '';
  let filtered = _allUsers;
  if (q) filtered = filtered.filter(u =>
    fuzzyMatch(q, u.pseudo || '') ||
    fuzzyMatch(q, u.email  || '') ||
    fuzzyMatch(q, u.uid    || '')
  );
  if (role) filtered = filtered.filter(u => (u.role || 'membre') === role);
  renderUsers(filtered);
};

window.suspendUser = async (uid, pseudo) => {
  const reason = window.prompt(`Raison de la suspension pour « ${pseudo} » (facultatif) :`, '');
  if (reason === null) return; // annulé
  try {
    await updateDoc(doc(db, 'users', uid), {
      suspended:        true,
      suspendedReason:  reason || '',
      suspendedAt:      serverTimestamp(),
      suspendedBy:      ctx.user.uid,
    });
    const u = _allUsers.find(x => x.uid === uid);
    if (u) { u.suspended = true; u.suspendedReason = reason || ''; }
    renderUsers(_allUsers);
    _writeAudit('suspend', 'user', uid, pseudo, { reason: reason || '' });
    toast(`🚫 ${pseudo} suspendu.`, 'success');
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.unsuspendUser = async (uid, pseudo) => {
  if (!await modal.confirm(`Lever la suspension de <b>${escHtml(pseudo)}</b> ?`, { confirmLabel: 'Lever la suspension' })) return;
  try {
    await updateDoc(doc(db, 'users', uid), {
      suspended:       deleteField(),
      suspendedReason: deleteField(),
      suspendedAt:     deleteField(),
      suspendedBy:     deleteField(),
    });
    const u = _allUsers.find(x => x.uid === uid);
    if (u) { delete u.suspended; delete u.suspendedReason; }
    renderUsers(_allUsers);
    _writeAudit('unsuspend', 'user', uid, pseudo, {});
    toast(`✓ Suspension de ${pseudo} levée.`, 'success');
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.setUserRole = async (uid, newRole, sel) => {
  if (!_assignableRoles().some(r => r.id === newRole)) return;
  const prev = sel.dataset.prev || sel.querySelector('option[selected]')?.value || sel.value;
  sel.disabled = true;
  try {
    await updateDoc(doc(db, 'users', uid), { role: newRole });
    const u = _allUsers.find(x => x.uid === uid);
    const pseudo = u?.pseudo || uid;
    if (u) u.role = newRole;
    sel.dataset.prev = newRole;
    _writeAudit('role_change', 'user', uid, pseudo, { prevRole: prev, newRole });
  } catch (e) {
    sel.value = prev;
    toast('Erreur : ' + e.message, 'error');
  } finally {
    sel.disabled = false;
  }
};

window.deleteUserAccount = async (uid, pseudo) => {
  if (!await modal.confirm(
    `Supprimer le profil de <b>${escHtml(pseudo)}</b> ?<br><br>` +
    `⚠️ Cela supprime uniquement le document Firestore (pseudo, rôle, email).<br>` +
    `Le compte Firebase Auth <b>n'est pas supprimé</b> — l'utilisateur pourra se reconnecter et créera un nouveau profil.`,
    { danger: true, confirmLabel: 'Supprimer le profil' }
  )) return;
  try {
    await deleteDoc(doc(db, 'users', uid));
    _allUsers = _allUsers.filter(u => u.uid !== uid);
    renderUsers(_allUsers);
    toast(`Compte « ${pseudo} » supprimé.`, 'success');
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};
}
