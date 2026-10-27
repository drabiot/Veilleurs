// ══════════════════════════════════════════════════════
// LEADERBOARD — contributions approuvées + migration contributeur anonyme → compte
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { writeAudit: _writeAudit, escHtml, setHash: _setHash, db, COL, collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, query, anonName, toast, modal } = ctx;
const _LB_EXCLUDED_DOC = 'config/leaderboard_excluded';

const _LB_SCAN_COLS = [
  { col: COL.items,       type: 'item'     },
  { col: COL.itemsSecret, type: 'item'     },
  { col: COL.mobs,        type: 'mob'      },
  { col: COL.mobsSecret,  type: 'mob'      },
  { col: COL.pnj,         type: 'pnj'      },
  { col: COL.pnjSecret,   type: 'pnj'      },
  { col: 'regions',       type: 'region'   },
  { col: 'quetes',        type: 'quest'    },
  { col: 'panoplies',     type: 'panoplie' },
];

window.showLeaderboard = async () => {
  _setHash('leaderboard');
  document.getElementById('leaderboard-panel').style.display = '';
  document.getElementById('btn-leaderboard').classList.add('active');
  _lbRefreshResetInfo();
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
        const raw = data._contributor;
        const entryId = col + '/' + d.id;
        if (excludedIds.has(entryId)) continue;
        for (const c of (Array.isArray(raw) ? raw : raw ? [raw] : [])) {
          const uid = c.uid || null;
          if (!uid) continue; // invités : non comptés
          const cname = c.name || 'Inconnu';
          if (!byKey[uid]) byKey[uid] = { uid, name: cname, subs: [] };
          const docName = data.name || data.titre || data.label || d.id;
          // création = 1 contribution ; chaque modification approuvée = +1
          if (!c.modOnly) byKey[uid].subs.push({ _id: entryId, _col: col, _docId: d.id, type, name: docName });
          for (let i = 0; i < (c.edits || 0); i++) byKey[uid].subs.push({ _id: entryId, _col: col, _docId: d.id, type, name: docName + ' (modification)' });
        }
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

  // Section exclusions
  if (excludedIds.size > 0) {
    const excSection = document.createElement('div');
    excSection.style.cssText = 'margin-top:16px;border-top:1px solid var(--border);padding-top:12px;';
    excSection.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;">🚫 Contributions exclues (${excludedIds.size})</div>`;
    for (const entryId of excludedIds) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px;';
      const docId = entryId.includes('/') ? entryId.slice(entryId.indexOf('/') + 1) : entryId;
      row.innerHTML = `<span style="flex:1;color:var(--muted);font-family:monospace;">${escHtml(docId)}</span>`;
      const btn = document.createElement('button');
      btn.className = 'btn btn-ghost';
      btn.style.cssText = 'font-size:10px;padding:2px 6px;flex-shrink:0;';
      btn.textContent = '↩ Réintégrer';
      btn.addEventListener('click', () => _lbUnexclude(entryId));
      row.appendChild(btn);
      excSection.appendChild(row);
    }
    listEl.appendChild(excSection);
  }
};

// ── Remise à zéro du classement de l'accueil ──────────
// Ne supprime rien : fige les compteurs actuels dans config/leaderboard_reset.baseline ;
// app.js (accueil) les soustrait. Même règles de comptage que app.js (tableau _contributor, exclusions).
async function _lbHomeCounts() {
  let excluded = new Set();
  try {
    const ex = await getDoc(doc(db, 'config', 'leaderboard_excluded'));
    if (ex.exists()) excluded = new Set(ex.data().ids || []);
  } catch {}
  const counts = {};
  for (const { col } of _LB_SCAN_COLS) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        if (excluded.has(col + '/' + d.id)) continue;
        const raw = d.data()._contributor;
        for (const c of (Array.isArray(raw) ? raw : raw ? [raw] : [])) {
          const uid = c.uid || null, name = c.name || 'Inconnu';
          if (!uid) continue; // invités : non comptés
          const key = uid;
          counts[key] = (counts[key] || 0) + (c.modOnly ? 0 : 1) + (c.edits || 0); // même règle que l'accueil
        }
      }
    } catch {}
  }
  return counts;
}

async function _lbRefreshResetInfo() {
  const info = document.getElementById('lb-reset-info');
  const undo = document.getElementById('btn-lb-undo-reset');
  try {
    const snap = await getDoc(doc(db, 'config', 'leaderboard_reset'));
    const at = snap.exists() ? snap.data().at?.toDate?.() : null;
    if (info) info.innerHTML = snap.exists() ? `<br>♻️ L'accueil est remis à zéro depuis le <b>${at ? at.toLocaleDateString('fr-FR') : '?'}</b> (ce classement-ci reste complet).` : '';
    if (undo) undo.style.display = snap.exists() ? '' : 'none';
  } catch {}
}

window.resetHomeLeaderboard = async function resetHomeLeaderboard() {
  const ok = await modal.confirm('Remettre le classement de l\'accueil à zéro ?',
    'Tout le monde repart à 0 sur la page d\'accueil. Aucune contribution n\'est supprimée : ce classement-ci reste complet, et tu peux annuler à tout moment.');
  if (!ok) return;
  try {
    const baseline = await _lbHomeCounts();
    await setDoc(doc(db, 'config', 'leaderboard_reset'), { at: serverTimestamp(), by: ctx.user?.uid || null, baseline });
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
}
