// ══════════════════════════════════════════════════════
// CORBEILLE
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { invalidateModCache, escHtml, setHash: _setHash, _COL_LABELS, db, COL, collection, getDocs, getDoc, doc, setDoc, deleteDoc, hashName, sanitizeForFirestore, toast, modal } = ctx;
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
      const restoreData = { ...(item.data || {}) };
      if (!restoreData.nameHash && restoreData.name) {
        try { restoreData.nameHash = await hashName(restoreData.name); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, targetId), sanitizeForFirestore(restoreData));
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
}
