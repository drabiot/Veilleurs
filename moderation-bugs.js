// ══════════════════════════════════════════════════════
// BUGS CONNUS
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { writeAudit: _writeAudit, setHash: _setHash, showPanel: _showPanel, db, collection, getDocs, doc, updateDoc, addDoc, deleteDoc, serverTimestamp, orderBy, query } = ctx;
window.showBugsConnus = async function showBugsConnus() {
  _setHash('bugs-connus');
  _showPanel('bugs-connus-panel', 'btn-bugs-connus');
  await _loadBugsConnus();
};

window._loadBugsConnus = async function _loadBugsConnus() {
  const container = document.getElementById('bugs-list-container');
  if (!container) return;
  container.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'known_bugs'), orderBy('createdAt', 'desc')));
    const bugs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    _renderBugsConnus(bugs, container);
  } catch (e) {
    container.innerHTML = '<div class="empty">Erreur de chargement.</div>';
    console.error('[bugs-connus]', e);
  }
};

const _BUG_STATUS_INFO = {
  actif:    { label: '\u{1F534} Actif' },
  en_cours: { label: '\u{1F7E1} En cours de résolution' },
  résolu:   { label: '✅ Résolu' },
};

function _renderBugsConnus(bugs, container) {
  if (!bugs.length) {
    container.innerHTML = '<div class="empty">Aucun bug enregistré.</div>';
    return;
  }
  container.innerHTML = bugs.map(b => {
    const s = _BUG_STATUS_INFO[b.status] || { label: b.status };
    const eid = JSON.stringify(b.id).replace(/"/g, '&quot;');
    const etitle = JSON.stringify(b.title || '').replace(/"/g, '&quot;');
    return '<div class="bug-row" id="bug-row-' + b.id + '" style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;">'
      + '<div id="bug-view-' + b.id + '">'
      + '<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;">'
      + '<div style="flex:1;min-width:0;"><span style="font-weight:600;font-size:13px;">' + _escHtmlBug(b.title || '(sans titre)') + '</span>'
      + (b.description ? '<p style="margin:6px 0 0;font-size:12px;color:var(--muted);">' + _escHtmlBug(b.description) + '</p>' : '')
      + '</div>'
      + '<div style="display:flex;gap:6px;align-items:center;flex-shrink:0;">'
      + '<span class="tag" style="font-size:11px;">' + s.label + '</span>'
      + '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;" onclick="window.startEditBug(' + eid + ')">&#x270F;&#xFE0F;</button>'
      + '<button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--danger);" onclick="window.deleteBug(' + eid + ',' + etitle + ')">&#x1F5D1;&#xFE0F;</button>'
      + '</div></div></div>'
      + '<div id="bug-edit-' + b.id + '" style="display:none;">'
      + '<div style="display:flex;flex-direction:column;gap:8px;">'
      + '<input id="bug-edit-title-' + b.id + '" type="text" value="' + _escHtmlBugAttr(b.title || '') + '" placeholder="Titre *" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:12px;outline:none;">'
      + '<textarea id="bug-edit-desc-' + b.id + '" rows="2" placeholder="Description" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:12px;outline:none;resize:vertical;font-family:inherit;">' + _escHtmlBug(b.description || '') + '</textarea>'
      + '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">'
      + '<select id="bug-edit-status-' + b.id + '" style="background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:12px;outline:none;">'
      + '<option value="actif"'    + (b.status === 'actif'    ? ' selected' : '') + '>\u{1F534} Actif</option>'
      + '<option value="en_cours"' + (b.status === 'en_cours' ? ' selected' : '') + '>\u{1F7E1} En cours de résolution</option>'
      + '<option value="résolu"'   + (b.status === 'résolu'   ? ' selected' : '') + '>✅ Résolu</option>'
      + '</select>'
      + '<button class="btn" style="background:var(--accent);color:var(--on-accent);font-size:12px;" onclick="window.saveEditBug(' + eid + ')">Sauvegarder</button>'
      + '<button class="btn btn-ghost" style="font-size:12px;" onclick="window.cancelEditBug(' + eid + ')">Annuler</button>'
      + '</div></div></div></div>';
  }).join('');
}

function _escHtmlBug(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function _escHtmlBugAttr(s) {
  return _escHtmlBug(s).replace(/"/g,'&quot;');
}

window.saveBugForm = async function saveBugForm() {
  const title       = document.getElementById('bug-form-title').value.trim();
  const description = document.getElementById('bug-form-desc').value.trim();
  const status      = document.getElementById('bug-form-status').value;
  if (!title) { toast('Le titre est obligatoire', 'warning'); return; }
  try {
    await addDoc(collection(db, 'known_bugs'), {
      title, description, status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    await _writeAudit('create', 'known_bug', '', title, { status });
    document.getElementById('bug-form-title').value  = '';
    document.getElementById('bug-form-desc').value   = '';
    document.getElementById('bug-form-status').value = 'actif';
    toast('Bug publié', 'success');
    await _loadBugsConnus();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.startEditBug = function startEditBug(id) {
  document.getElementById('bug-view-' + id).style.display = 'none';
  document.getElementById('bug-edit-' + id).style.display = '';
};

window.cancelEditBug = function cancelEditBug(id) {
  document.getElementById('bug-edit-' + id).style.display = 'none';
  document.getElementById('bug-view-' + id).style.display = '';
};

window.saveEditBug = async function saveEditBug(id) {
  const title       = document.getElementById('bug-edit-title-'  + id).value.trim();
  const description = document.getElementById('bug-edit-desc-'   + id).value.trim();
  const status      = document.getElementById('bug-edit-status-' + id).value;
  if (!title) { toast('Le titre est obligatoire', 'warning'); return; }
  try {
    await updateDoc(doc(db, 'known_bugs', id), { title, description, status, updatedAt: serverTimestamp() });
    await _writeAudit('update', 'known_bug', id, title, { status });
    toast('Bug mis à jour', 'success');
    await _loadBugsConnus();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.deleteBug = async function deleteBug(id, name) {
  const ok = await modal.confirm('Supprimer ce bug ?', 'Cette action est irréversible.');
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'known_bugs', id));
    await _writeAudit('delete', 'known_bug', id, name);
    toast('Bug supprimé', 'success');
    await _loadBugsConnus();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};


}
