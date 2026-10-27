// ══════════════════════════════════════════════════════
// RÔLES ET PERMISSIONS — permissions par rôle, rôles Discord, gestion des rôles, règles Firestore
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { getWorkerSecret: _getWorkerSecret, WORKER_URL, escHtml, setHash: _setHash, showPanel: _showPanel, db, auth, roleLevel, collection, getDoc, doc, setDoc, query, limit, toast, modal, MANAGED_TIERS, TIER_FIRESTORE, TIER_DEFAULTS, getTierDisplay: _getTierDisplay, cachedDocs } = ctx;
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
  for (const p of ctx.creatorPaliers) {
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

// Lu par le noyau (getTierDisplay) et par le panneau Membres
ctx.shared.roles = { get customRoles() { return _customRoles; } };
}
