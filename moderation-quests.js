// ══════════════════════════════════════════════════════
// QUÊTES — liste/ordre des quêtes et quêtes orphelines (sans mapId)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, escHtml, addCreatorBtn: _addCreatorBtn, setHash: _setHash, shared: _shared, db, doc, updateDoc, toast, modal, collection, getDocs, showPanel: _showPanel, COL, hasRole } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
// ═══════════════════════════════════════════════════
// LISTE DES QUÊTES
// ═══════════════════════════════════════════════════
let _questOrderData  = [];
_shared.questOrder = { get data() { return _questOrderData; }, set data(v) { _questOrderData = v; } };
let _questOrderDirty = false;
let _questDragSrc    = null;
let _questPalierCollapsed    = new Set();
let _questPalierSubCollapsed = new Set(); // clés : "type-palier"
let _questCollapseInit       = false;

const QUEST_TYPE_ORDER  = ['main', 'sec', 'ter'];
const QUEST_TYPE_LABELS_MOD = { main: '⚔️ Principale', sec: '🗺️ Secondaire', ter: '📋 Fractured Underworld' };
const QUEST_TYPE_COLORS_MOD = { main: '#e07c50',        sec: '#6aaad4',        ter: '#82c470'     };

window.showQuestOrder = async () => {
  _setHash('quest-order');
  document.getElementById('quest-order-panel').style.display = '';
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
      fuzzyMatch(q, qt.titre||qt.id||'') ||
      fuzzyMatch(q, qt.zone||'') ||
      fuzzyMatch(q, qt.npc||'')
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

window.loadQuestOrder = loadQuestOrder;
}
