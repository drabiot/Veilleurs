// ══════════════════════════════════════════════════════
// PANNEAUX D'ORDRE — mobs, items, PNJ, régions, panoplies
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, addCreatorBtn: _addCreatorBtn, setHash: _setHash, db, hasRole, COL, doc, updateDoc, toast, modal, escHtml, showPanel: _showPanel, collection, getDocs } = ctx;
const { normalize, fuzzyMatch } = window.VCL;

// État lu par l'éditeur (renommage / suppression d'entrée) et fonctions de rechargement appelées par le noyau
const _expose = (key, get, set) => { ctx.shared[key] = { get data() { return get(); }, set data(v) { set(v); } }; };
// ── Mob order panel ───────────────────────────────────
let _mobOrderData       = [];
let _mobOrderDirty      = false;
let _dragSrc            = null;
let _mobPalierCollapsed = new Set();
let _mobCollapseInit   = false;

const TYPE_ORDER_MOD  = { monstre: 0, sbire: 1, mini_boss: 2, boss: 3, worldboss: 4 };
const TYPE_LABELS_MOD = { monstre: 'Monstre', sbire: 'Sbire', mini_boss: 'Mini-boss', boss: 'Boss', worldboss: 'WorldBoss' };

function mobTag(mob) {
  return `P${mob.palier||1} ${TYPE_LABELS_MOD[mob.type]||mob.type}`;
}

window.showMobOrder = async () => {
  _setHash('mob-order');
  document.getElementById('mob-order-panel').style.display = '';
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
    // Contributeurs+ : inclure les mobs sensibles
    if (hasRole(ctx.role, 'contributeur')) {
      const secret = await cachedDocs(COL.mobsSecret).catch(() => []);
      const existingIds = new Set(mobs.map(m => String(m.id)));
      for (const s of secret) {
        if (!existingIds.has(String(s.id))) mobs.push({ ...s, _sensible: true });
      }
    }
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
    const visible = _mobOrderData.filter(m => fuzzyMatch(searchQ, m.name));
    if (!visible.length) { listEl.innerHTML = '<div class="empty">Aucun résultat</div>'; return; }
    visible.forEach(mob => {
      const row = document.createElement('div');
      row.className = 'mob-order-row';
      row.dataset.id = mob.id;
      const globalIdx = _mobOrderData.indexOf(mob) + 1;
      row.innerHTML = `
        <span class="mob-order-handle" style="color:var(--border);">⠿</span>
        <span class="mob-order-index" style="display:inline-flex;align-items:center;justify-content:center;">${globalIdx}</span>
        <span class="mob-order-name">${mob.name||mob.id}${mob._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
        <span class="mob-order-tag">${mobTag(mob)}</span>
        <button class="ed-edit-btn" title="Modifier : ${mob.name||mob.id}\nID : ${mob.id}">✏️</button>`;
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(mob._sensible ? 'mobs_secret' : 'mobs', mob.id, mob, 'mob'); });
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
        <span class="mob-order-name">${mob.name||mob.id}${mob._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
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
      row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(mob._sensible ? 'mobs_secret' : 'mobs', mob.id, mob, 'mob'); });
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
  parchemin:   { label: 'Parchemins',      emoji: '📃' },
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
  document.getElementById('item-order-panel').style.display = '';
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

    // Contributeurs+ : inclure les items sensibles (items_hidden)
    if (hasRole(ctx.role, 'contributeur')) {
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
    const visible = _itemOrderData.filter(it => fuzzyMatch(searchQ, it.name));
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
  ctx.edCache.sets = null;
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
  document.getElementById('pnj-order-panel').style.display = '';
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
    const [_pnjPublic, _regDocsRaw] = await Promise.all([
      cachedDocs('personnages'),
      cachedDocs('regions'),
    ]);
    const pnjs = [..._pnjPublic];
    // Contributeurs+ : inclure les PNJ sensibles
    if (hasRole(ctx.role, 'contributeur')) {
      const secret = await cachedDocs(COL.pnjSecret).catch(() => []);
      const existingIds = new Set(pnjs.map(p => String(p.id)));
      for (const s of secret) {
        if (!existingIds.has(String(s.id))) pnjs.push({ ...s, _sensible: true });
      }
    }

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
      <span class="mob-order-name">${pnj.name||pnj.id}${pnj._sensible ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒</span>' : ''}</span>
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

    row.querySelector('.ed-edit-btn').addEventListener('click', e => { e.stopPropagation(); showEditor(pnj._sensible ? 'pnj_secret' : 'personnages', pnj.id, pnj, 'pnj'); });
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
    const results = allPnjs.filter(p => fuzzyMatch(searchQ, p.name));
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
  ctx.edCache.regions = null;

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
  document.getElementById('region-order-panel').style.display = '';
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
    const visible = _regionOrderData.filter(r => fuzzyMatch(searchQ, r.name||r.id||''));
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
  ctx.edCache.regions = null;
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
    ? _panoplieOrderData.filter(p => fuzzyMatch(searchQ, (p.label||'') + ' ' + (p.id||'')))
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

_expose('mobOrder', () => _mobOrderData, v => { _mobOrderData = v; });
_expose('itemOrder', () => _itemOrderData, v => { _itemOrderData = v; });
_expose('pnjRegions', () => _pnjRegions, v => { _pnjRegions = v; });
_expose('regionOrder', () => _regionOrderData, v => { _regionOrderData = v; });
Object.assign(window, { loadMobOrder, loadItemOrder, loadPnjOrder, loadRegionOrder, loadPanoplieOrder });
}
