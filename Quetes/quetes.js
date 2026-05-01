/* ══════════════════════════════════════════════════════════════
   QUÊTES — Veilleurs au Clair de Lune
   quetes.js
══════════════════════════════════════════════════════════════ */

(function injectCSSVars() {
  const r = document.documentElement;
  r.style.setProperty('--quete-main',     '#e07c50');
  r.style.setProperty('--quete-main-dim', 'rgba(224,124,80,.4)');
  r.style.setProperty('--quete-sec',      '#6aaad4');
  r.style.setProperty('--quete-sec-dim',  'rgba(106,170,212,.4)');
  r.style.setProperty('--quete-ter',      '#82c470');
  r.style.setProperty('--quete-ter-dim',  'rgba(130,196,112,.4)');
})();

/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
let activeTab    = 'main';
let activePalier = 'all';
let activeZones  = new Set();
let activeStatut = 'all';
let searchQuery  = '';

/* ══════════════════════════════════
   PERSISTANCE CHECKBOXES
══════════════════════════════════ */
function ckKey(qid, oi, si) {
  return si !== undefined ? `vcl_obj_${qid}_${oi}_${si}` : `vcl_obj_${qid}_${oi}`;
}
function getCk(qid, oi, si)      { return localStorage.getItem(ckKey(qid, oi, si)) === '1'; }
function setCk(qid, oi, si, val) { localStorage.setItem(ckKey(qid, oi, si), val ? '1' : '0'); }

function getProgress(q) {
  let done = 0, total = 0;
  q.objectifs.forEach((o, i) => {
    if (Array.isArray(o)) {
      o.forEach((sub, j) => { total++; if (getCk(q.id, i, j)) done++; });
    } else {
      total++; if (getCk(q.id, i)) done++;
    }
  });
  return { done, total, pct: total ? Math.round((done / total) * 100) : 0 };
}

function isQuestDone(q) {
  const { done, total } = getProgress(q);
  return done === total && total > 0;
}

function isQuestStarted(q) {
  const { done, total } = getProgress(q);
  return done > 0 && done < total;
}

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const searchInput   = document.getElementById('sidebar-search');
const palierFilters = document.getElementById('palier-filters');
const queteGrid     = document.getElementById('quete-grid');
const gridEmpty     = document.getElementById('grid-empty');
const resultCount   = document.getElementById('result-count');
const mainTitle     = document.getElementById('main-title');
const mainSubtitle  = document.getElementById('main-subtitle');
const modalOverlay  = document.getElementById('quest-modal-overlay');
const modalContent  = document.getElementById('quest-modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
// normalize → défini dans /utils.js

/* Résout un nom de PNJ : si la valeur ressemble à un ID (pas d'espace, tirets/underscores),
   tente de le résoudre via l'index PNJ chargé depuis Firestore. */
function resolvePnjName(npc) {
  if (!npc) return '';
  if (window._vcl_pnj_index) {
    const resolved = window._vcl_pnj_index.get(npc);
    if (resolved) return resolved;
  }
  return npc;
}

function getFiltered() {
  const q = normalize(searchQuery);
  return QUETES.filter(e => {
    if (e.type !== activeTab) return false;
    if (activePalier !== 'all' && e.palier !== activePalier) return false;
    if (activeZones.size > 0 && !activeZones.has(e.zone)) return false;
    const done = isQuestDone(e);
    if (activeStatut === 'todo'  && done)                  return false;
    if (activeStatut === 'done'  && !done)                 return false;
    if (activeStatut === 'wip'   && !isQuestStarted(e))   return false;
    if (q &&
      !normalize(e.titre).includes(q) &&
      !normalize(e.zone).includes(q)  &&
      !normalize(resolvePnjName(e.npc)).includes(q) &&
      !normalize(e.desc).includes(q)
    ) return false;
    return true;
  });
}

/* ══════════════════════════════════
   RENDU RÉCOMPENSES
   - exp   : { type:'exp',  xp:420 }        → "420 XP" auto
   - cols  : { type:'cols', cols:50 }        → "50 Cols" auto
   - items : { type:'items', itemId, qte, label? }
══════════════════════════════════ */

/* Parse la valeur numérique d'une récompense exp/cols (gère le format hérité `label`) */
function rewardVal(r, key) {
  return r[key] != null ? r[key] : (parseInt(r.label) || 0);
}

/* Label formaté automatiquement — gère les deux formats (xp/cols ou label hérité) */
function rewardLabel(r) {
  if (r.type === 'exp')  return `${rewardVal(r, 'xp').toLocaleString('fr-FR')} XP`;
  if (r.type === 'cols') return `${rewardVal(r, 'cols').toLocaleString('fr-FR')} Cols`;
  /* items */
  const item = r.itemId ? dbItem(r.itemId) : null;
  const name = item ? item.name : (r.label || '?');
  return r.qte > 1 ? `${name} ×${r.qte}` : name;
}

/* Mini tag sur la carte */
function rewardMiniTag(r) {
  if (r.type === 'exp') {
    return `<span class="rmt rmt-exp">✨ ${rewardLabel(r)}</span>`;
  }
  if (r.type === 'cols') {
    return `<span class="rmt rmt-cols">🪙 ${rewardLabel(r)}</span>`;
  }
  /* items */
  const item  = r.itemId ? dbItem(r.itemId) : null;
  const color = item ? rarityColor(item.rarity) : '#c0a0dc';
  const imgSrc = item ? (getItemImg(item)) : null;
  const visual = imgSrc
    ? `<img class="rmt-item-img" src="${imgSrc}" alt="">`
    : `<span class="rmt-item-icon">📦</span>`;
  const label = rewardLabel(r);
  return `<span class="rmt rmt-item" style="color:${color};border-color:${color}33;background:${color}0d">
    <span class="rmt-visual">${visual}</span>${label}
  </span>`;
}

/* Récompense complète dans le modal */
function renderRewardFull(r) {
  if (r.type === 'exp') {
    return `<div class="reward-full reward-full-exp">
      <span class="reward-full-icon">✨</span>
      <div class="reward-full-body">
        <span class="reward-full-val">${rewardVal(r, 'xp').toLocaleString('fr-FR')}</span>
        <span class="reward-full-unit">XP</span>
      </div>
    </div>`;
  }
  if (r.type === 'cols') {
    return `<div class="reward-full reward-full-cols">
      <span class="reward-full-icon">🪙</span>
      <div class="reward-full-body">
        <span class="reward-full-val">${rewardVal(r, 'cols').toLocaleString('fr-FR')}</span>
        <span class="reward-full-unit">Cols</span>
      </div>
    </div>`;
  }
  /* items */
  const item   = r.itemId ? dbItem(r.itemId) : null;
  const color  = item ? rarityColor(item.rarity) : '#c0a0dc';
  const name   = item ? item.name : (r.label || r.itemId || '?');
  const imgSrc = item ? (getItemImg(item)) : null;
  const visual = imgSrc
    ? `<img class="reward-img" src="${imgSrc}" alt="${name}">`
    : `<span class="reward-icon-fallback">📦</span>`;
  const href = r.itemId ? `../Compendium/compendium.html#${r.itemId}` : null;
  const tag  = href ? 'a' : 'div';
  const attrs = href ? `href="${href}" target="_blank"` : '';
  return `<${tag} class="reward-full reward-full-item" ${attrs} style="--item-color:${color};border-color:${color}33;background:${color}0d">
    <span class="reward-full-img">${visual}</span>
    <div class="reward-full-body">
      <span class="reward-full-name" style="color:${color}">${name}</span>
      ${r.qte > 1 ? `<span class="reward-full-qty">×${r.qte}</span>` : ''}
    </div>
  </${tag}>`;
}

/* ══════════════════════════════════
   RENDU ITEM CHIP (dans objectifs)
   Style identique craft-ingredient du compendium
══════════════════════════════════ */
function formatObjectifText(texte, floor) {
  return texte.replace(/\((-?\d+)\s*,\s*(-?\d+)\)/g, (_, x, z) => {
    if (floor != null) {
      const href = `../Map/map.html?ghost_gx=${x}&ghost_gz=${z}&ghost_floor=${floor}&ghost_name=${encodeURIComponent(`Objectif · X:${x} Z:${z}`)}#floor-${floor}-surface`;
      return `<a class="coord-badge coord-badge-link" href="${href}" target="_blank" onclick="event.stopPropagation()">📍 X:${x}, Z:${z}</a>`;
    }
    return `<span class="coord-badge">📍 X:${x}, Z:${z}</span>`;
  });
}

function renderItemChip(itemId, qte) {
  const item   = dbItem(itemId);
  const color  = item ? rarityColor(item.rarity) : '#888';
  const name   = item ? item.name : itemId;
  const imgSrc = item ? (getItemImg(item)) : null;

  const visual = imgSrc
    ? `<img class="chip-img" src="${imgSrc}" alt="${name}">`
    : `<span class="chip-fallback">📦</span>`;

  const qty = (qte !== undefined && qte !== null)
    ? `<span class="chip-qty">×${qte}</span>`
    : '';

  const href = `../Compendium/compendium.html#${itemId}`;
  return `<a class="item-chip" href="${href}" target="_blank"
     style="--chip-color:${color}" title="Voir dans le Compendium — ${name}">
    <span class="chip-visual">${visual}</span>
    <span class="chip-name" style="color:${color}">${name}</span>
    ${qty}
  </a>`;
}

function renderMobChip(mobId, qte) {
  const mob    = dbMob(mobId);
  const color  = '#d47070';
  const name   = mob ? mob.name : mobId;
  const imgSrc = mob ? (mob.images?.[0] || mob.img || null) : null;

  const visual = imgSrc
    ? `<img class="chip-img" src="${imgSrc}" alt="${name}">`
    : `<span class="chip-fallback">👾</span>`;

  const qty = (qte !== undefined && qte !== null)
    ? `<span class="chip-qty">×${qte}</span>`
    : '';

  const href = `../Bestiaire/bestiaire.html#monstres/${mobId}`;
  return `<a class="item-chip" href="${href}" target="_blank"
     style="--chip-color:${color}" title="Voir dans le Bestiaire — ${name}">
    <span class="chip-visual">${visual}</span>
    <span class="chip-name" style="color:${color}">${name}</span>
    ${qty}
  </a>`;
}

/* ══════════════════════════════════
   SIDEBAR COLLAPSIBLES
══════════════════════════════════ */
function initCollapsible(hid, bid) {
  const h = document.getElementById(hid);
  const b = document.getElementById(bid);
  if (!h || !b) return;
  h.addEventListener('click', () => { h.classList.toggle('open'); b.classList.toggle('open'); });
}
initCollapsible('palier-block-header', 'palier-block-body');
initCollapsible('zone-block-header',   'zone-block-body');
initCollapsible('statut-block-header', 'statut-block-body');
initCollapsible('inv-block-header',    'inv-block-body');

/* ══════════════════════════════════
   FILTRES PALIER
══════════════════════════════════ */
let _tabQuestsCache = null;
function getTabQuests() {
  return _tabQuestsCache || (_tabQuestsCache = QUETES.filter(q => q.type === activeTab));
}

function buildPalierFilters() {
  const list    = getTabQuests();
  const paliers = [...new Set(list.map(q => q.palier))].sort((a, b) => a - b);
  palierFilters.innerHTML = '';

  const mk = (label, count, isActive, onClick) => {
    const btn = document.createElement('button');
    btn.className = `palier-filter-btn${isActive ? ' active' : ''}`;
    btn.innerHTML = `<span class="pfb-hex">⬡</span><span class="pfb-label">${label}</span><span class="palier-count">${count}</span>`;
    btn.addEventListener('click', onClick);
    palierFilters.appendChild(btn);
  };

  mk('Tous', list.length, activePalier === 'all', () => { activePalier = 'all'; refreshAll(); });
  paliers.forEach(p => {
    const cnt = list.filter(q => q.palier === p).length;
    mk(`Palier ${p}`, cnt, activePalier === p, () => { activePalier = p; refreshAll(); });
  });
}

/* ══════════════════════════════════
   FILTRES ZONE
══════════════════════════════════ */
function buildZoneFilters() {
  const zf    = document.getElementById('zone-filters');
  const list  = getTabQuests();
  const zones = [...new Set(list.map(q => q.zone))].sort((a, b) => {
    const ra = ZONE_META_BY_NAME.get(a);
    const rb = ZONE_META_BY_NAME.get(b);
    const pa = ra?.palier ?? 99, pb = rb?.palier ?? 99;
    if (pa !== pb) return pa - pb;
    return (ra?.ordre ?? 99) - (rb?.ordre ?? 99);
  });
  activeZones = new Set(zones);
  zf.innerHTML = '';

  zones.forEach(z => {
    const cnt = list.filter(q => q.zone === z).length;
    const zs  = getZoneStyle(z);
    const lbl = document.createElement('label');
    lbl.className = 'bfilter-row';
    lbl.innerHTML = `
      <input type="checkbox" checked />
      <span class="bfilter-dot dot-zone" style="background:${zs.color};box-shadow:0 0 5px ${zs.dim}"></span>
      <span class="bfilter-label">${z}</span>
      <span class="bfilter-count">${cnt}</span>`;
    const cb = lbl.querySelector('input');
    cb.addEventListener('change', () => {
      cb.checked ? activeZones.add(z) : activeZones.delete(z);
      buildGrid();
    });
    zf.appendChild(lbl);
  });
}

/* ══════════════════════════════════
   COMPTEURS STATUT
══════════════════════════════════ */
function updateStatutCounts() {
  const base = getTabQuests();
  document.getElementById('cnt-all').textContent  = base.length;
  document.getElementById('cnt-todo').textContent = base.filter(q => !isQuestDone(q) && !isQuestStarted(q)).length;
  document.getElementById('cnt-wip').textContent  = base.filter(q =>  isQuestStarted(q)).length;
  document.getElementById('cnt-done').textContent = base.filter(q =>  isQuestDone(q)).length;
}

/* ══════════════════════════════════
   INVENTAIRE
══════════════════════════════════ */
function getAllQuestItemIds() {
  const ids = new Set();
  QUETES.forEach(q => {
    q.objectifs.flat().forEach(o => { if (o.items) o.items.forEach(it => ids.add(it.id)); });
    q.recompenses.forEach(r => { if (r.itemId) ids.add(r.itemId); });
  });
  return [...ids];
}

function getInventory() {
  const inv = {};
  getAllQuestItemIds().forEach(id => {
    inv[id] = parseInt(localStorage.getItem(`vcl_inv_${id}`) || '0', 10);
  });
  return inv;
}

function setInvItem(id, val) {
  localStorage.setItem(`vcl_inv_${id}`, Math.max(0, parseInt(val, 10) || 0));
}

function getFeasibleQuests() {
  const inv = getInventory();
  return QUETES.filter(q => {
    if (isQuestDone(q)) return false;
    const allObjs = q.objectifs.flat();
    const hasItems = allObjs.some(o => o.items);
    if (!hasItems) return false;
    return allObjs.every(o => {
      if (!o.items) return true;
      return o.items.every(it => (inv[it.id] || 0) >= it.qte);
    });
  });
}

function buildInventoryPanel() {
  const panel = document.getElementById('inv-panel');
  if (!panel) return;
  const inv = getInventory();
  const ids = getAllQuestItemIds();
  panel.innerHTML = '';

  ids.forEach(id => {
    const item   = dbItem(id);
    const name   = item ? item.name : id;
    const color  = item ? rarityColor(item.rarity) : '#888';
    const imgSrc = item ? (getItemImg(item)) : null;

    const row = document.createElement('div');
    row.className = 'inv-row';
    row.innerHTML = `
      <span class="inv-visual">
        ${imgSrc
          ? `<img class="inv-img" src="${imgSrc}" alt="${name}">`
          : `<span class="inv-emoji">📦</span>`}
      </span>
      <span class="inv-label" style="color:${color}">${name}</span>
      <input type="number" class="inv-input" min="0" value="${inv[id]}" data-id="${id}" />`;
    panel.appendChild(row);
  });

  panel.querySelectorAll('.inv-input').forEach(inp => {
    inp.addEventListener('change', () => {
      setInvItem(inp.dataset.id, inp.value);
      buildFeasiblePanel();
      updateStatutCounts();
    });
  });

  buildFeasiblePanel();
}

function buildFeasiblePanel() {
  const fp = document.getElementById('feasible-panel');
  if (!fp) return;
  const quests = getFeasibleQuests();
  fp.innerHTML = '';

  if (quests.length === 0) {
    fp.innerHTML = '<div class="feasible-empty">Aucune quête réalisable avec cet inventaire</div>';
    return;
  }

  const title = document.createElement('div');
  title.className = 'feasible-title';
  title.textContent = `✅ ${quests.length} quête${quests.length > 1 ? 's' : ''} réalisable${quests.length > 1 ? 's' : ''}`;
  fp.appendChild(title);

  quests.forEach(q => {
    const div = document.createElement('div');
    div.className = `feasible-item feasible-${q.type}`;
    const xp  = q.recompenses.find(r => r.type === 'exp');
    const col = q.recompenses.find(r => r.type === 'cols');
    const rewStr = [
      xp  ? `${rewardVal(xp, 'xp')} XP`    : '',
      col ? `${rewardVal(col, 'cols')} Cols` : '',
    ].filter(Boolean).join(' · ');
    div.innerHTML = `
      <span class="feasible-dot" style="background:var(--quete-${q.type})"></span>
      <span class="feasible-name">${q.titre}</span>
      <span class="feasible-rew">${rewStr}</span>`;
    div.addEventListener('click', () => openModal(q));
    fp.appendChild(div);
  });
}

/* ══════════════════════════════════
   ITEMS REQUIS (objectifs)
══════════════════════════════════ */
function getQuestRequiredItems(q) {
  const items = [];
  const seen  = new Set();
  q.objectifs.flat().forEach(o => {
    if (!o.items) return;
    o.items.forEach(it => {
      if (!seen.has(it.id)) { seen.add(it.id); items.push(it); }
    });
  });
  return items;
}

function renderCardItemIcon(it) {
  const item   = dbItem(it.id);
  const color  = item ? rarityColor(item.rarity) : '#888';
  const name   = item ? item.name : it.id;
  const imgSrc = item ? getItemImg(item) : null;
  const qtyBadge = (it.qte && it.qte > 1) ? `<span class="card-item-qty">×${it.qte}</span>` : '';
  const inner   = imgSrc ? `<img src="${imgSrc}" alt="${name}">` : '📦';
  const tipText = name + (it.qte > 1 ? ` ×${it.qte}` : '');
  return `<span class="card-item-icon" data-tip="${tipText}" style="--chip-color:${color}">${inner}${qtyBadge}</span>`;
}

/* ══════════════════════════════════
   GRILLE — cartes hauteur fixe
══════════════════════════════════ */
function _questXP(q)   { const r = (q.recompenses||[]).find(x => x.type === 'exp');  return r ? rewardVal(r, 'xp')   : 0; }
function _questCols(q) { const r = (q.recompenses||[]).find(x => x.type === 'cols'); return r ? rewardVal(r, 'cols') : 0; }

function _sortQuests(list, mode) {
  const arr = list.slice();
  if (mode === 'profit') {
    arr.sort((a, b) => (_questXP(b) + _questCols(b)) - (_questXP(a) + _questCols(a)));
  } else if (mode === 'exp') {
    arr.sort((a, b) => _questXP(b) - _questXP(a));
  } else if (mode === 'cols') {
    arr.sort((a, b) => _questCols(b) - _questCols(a));
  } else if (mode === 'alpha-asc') {
    arr.sort((a, b) => (a.titre || '').localeCompare(b.titre || '', 'fr'));
  } else if (mode === 'alpha-desc') {
    arr.sort((a, b) => (b.titre || '').localeCompare(a.titre || '', 'fr'));
  } else {
    arr.sort((a, b) => {
      const ao = a.ordre ?? null, bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return 0;
    });
  }
  return arr;
}

let _currentSort = 'default';

function buildGrid() {
  const entities = getFiltered();
  queteGrid.innerHTML = '';

  if (entities.length === 0) {
    gridEmpty.style.display = 'flex';
    queteGrid.style.display = 'none';
    resultCount.textContent = '0 résultat';
    return;
  }
  gridEmpty.style.display = 'none';
  queteGrid.style.display = 'grid';
  resultCount.textContent = `${entities.length} quête${entities.length > 1 ? 's' : ''}`;

  // En mode tri explicite : liste plate sans sectionnement par palier
  if (_currentSort !== 'default') {
    const sorted = _sortQuests(entities, _currentSort);
    let idx = 0;
    sorted.forEach(q => _buildGridCard(q, idx++));
    return;
  }

  const paliers = [...new Set(entities.map(q => q.palier))].sort((a, b) => a - b);
  let idx = 0;

  paliers.forEach(p => {
    const heading = document.createElement('div');
    heading.className = 'palier-heading';
    heading.textContent = `⬡ Palier ${p}`;
    queteGrid.appendChild(heading);

    _sortQuests(entities.filter(q => q.palier === p), 'default').forEach(q => {
      _buildGridCard(q, idx++);
    });
  });
}

function _buildGridCard(q, idx) {
  const card = document.createElement('div');
  card.className = `quete-card ${q.type}`;
  card.dataset.id = q.id;
  card.style.animationDelay = `${idx * 0.03}s`;

  const { done, total, pct } = getProgress(q);
  const effectiveDone    = done === total && total > 0;
  const effectiveStarted = !effectiveDone && done > 0;
  const zs     = getZoneStyle(q.zone);
  const mapUrl = getMapUrl(q.zone);

  card.style.setProperty('--zone-color', zs.color);
  card.style.setProperty('--zone-dim',   zs.dim);

  const rewFooter  = q.recompenses.slice(0, 3).map(r => rewardMiniTag(r)).join('');
  const reqItems   = getQuestRequiredItems(q);
  const itemsRow   = reqItems.length > 0
    ? `<div class="card-items-row">${reqItems.slice(0, 6).map(it => renderCardItemIcon(it)).join('')}${reqItems.length > 6 ? `<span class="card-items-more">+${reqItems.length - 6}</span>` : ''}</div>`
    : '';
  if (reqItems.length > 0) card.classList.add('has-items');

  card.innerHTML = `
    <div class="type-stripe"></div>
    <div class="card-body">
      <div class="card-top">
        <div class="card-title">${q.titre}</div>
        <span class="card-badge ${effectiveDone ? 'badge-done' : effectiveStarted ? 'badge-wip' : 'badge-todo'}">${effectiveDone ? 'Terminée' : effectiveStarted ? 'En cours' : 'À faire'}</span>
      </div>
      <div class="card-meta">
        <span class="ctag ctag-palier">P${q.palier}</span>
        ${(q.zone && q.zone !== 'undefined')
          ? (mapUrl
            ? `<a class="ctag ctag-zone" href="${mapUrl}"
                 style="color:${zs.color};border-color:${zs.dim};background:${zs.glow}"
                 title="Voir sur la carte" onclick="event.stopPropagation()">🗺 ${q.zone}</a>`
            : `<span class="ctag ctag-zone" style="color:${zs.color};border-color:${zs.dim};background:${zs.glow}">🗺 ${q.zone}</span>`)
          : (q.coords && q.coords.x != null && q.coords.z != null
            ? `<a class="ctag ctag-zone ctag-coords" href="../Map/map.html?questId=${q.id}#floor-${q.palier}-surface" target="_blank" onclick="event.stopPropagation()">📍 X ${q.coords.x} · Z ${q.coords.z}</a>`
            : '')
        }
      </div>
      <p class="card-desc">${q.desc || ''}</p>
      ${itemsRow}
    </div>
    <div class="card-footer">
      <div class="card-rewards-footer">${rewFooter}</div>
      <div class="card-progress-wrap">
        <div class="card-progress">
          <div class="progress-wrap"><div class="progress-fill" style="width:${pct}%"></div></div>
          <span class="progress-lbl">${done}/${total}</span>
        </div>
        ${q.npc ? `<span class="card-npc">🧑 ${resolvePnjName(q.npc)}</span>` : ''}
      </div>
    </div>`;

  card.addEventListener('mousedown', e => e.preventDefault());
  card.addEventListener('click', () => openModal(q));
  queteGrid.appendChild(card);
}

/* ══════════════════════════════════
   HASH ROUTING
   quetes.html#quest_id
   → active le bon tab, scrolle la card, ouvre le modal
══════════════════════════════════ */
let _questsIndex = null;
let _questsIndexSize = -1;
function getQuestById(id) {
  if (!_questsIndex || _questsIndexSize !== QUETES.length) {
    _questsIndex = new Map(QUETES.map(q => [q.id, q]));
    _questsIndexSize = QUETES.length;
  }
  return _questsIndex.get(id) || null;
}

function navigateToQuest(id, { pushState = true } = {}) {
  const q = getQuestById(id);
  if (!q) return;

  /* Changer d'onglet si nécessaire */
  if (q.type !== activeTab) {
    activeTab    = q.type;
    activePalier = 'all';
    activeStatut = 'all';
    document.querySelector('input[name="statut-filter"][value="all"]').checked = true;
    document.querySelectorAll('.sort-btn').forEach(btn => {
      btn.classList.remove('active-main', 'active-sec', 'active-ter');
      if (btn.dataset.tab === q.type) btn.classList.add(`active-${q.type}`);
    });
    refreshAll();
  }

  /* Scroll vers la card */
  requestAnimationFrame(() => {
    const card = queteGrid.querySelector(`.quete-card[data-id="${id}"]`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    openModal(q);
  });

  if (pushState) history.pushState({ quest: id }, '', `#${id}`);
}

function handleHashOnLoad() {
  const id = window.location.hash.replace('#', '');
  if (id) navigateToQuest(id, { pushState: false });
}

window.addEventListener('popstate', () => {
  const id = window.location.hash.replace('#', '');
  if (id) navigateToQuest(id, { pushState: false });
  else closeModal();
});

/* ══════════════════════════════════
   MODAL
══════════════════════════════════ */
function openModal(q) {
  window._currentModalQuest = q;
  modalContent.innerHTML = renderSheet(q);
  bindModalCheckboxes(q);
  modalOverlay.classList.add('open');
  /* Met à jour le hash sans dupliquer */
  if (window.location.hash !== `#${q.id}`) {
    history.pushState({ quest: q.id }, '', `#${q.id}`);
  }
}

function closeModal() {
  modalOverlay.classList.remove('open');
  window._currentModalQuest = null;
  _tipAnchor = null;
  _tip.hide();
  // Fermer le popup de coordonnées s'il est ouvert
  if (_objLocPopup) {
    _objLocPopup.remove();
    _objLocPopup = null;
    document.removeEventListener('click', _dismissObjLocPopup, true);
  }
  /* Retire le hash */
  if (window.location.hash) {
    history.pushState(null, '', window.location.pathname + window.location.search);
  }
}

modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => {
  if (e.target !== modalOverlay) return;
  closeModal();
  modalOverlay.style.pointerEvents = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el) el.click();
  modalOverlay.style.pointerEvents = '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── Bind checkboxes ── */
/* Vrai si un objectif antérieur à `i` porte le tag `next` ET n'est pas coché.
   Dès qu'un tel verrou est rencontré, tous les objectifs suivants sont bloqués. */
function isObjectiveBlocked(q, i) {
  for (let j = 0; j < i; j++) {
    const prev = q.objectifs[j];
    if (Array.isArray(prev)) continue;
    if (prev?.next && !getCk(q.id, j)) return true;
  }
  return false;
}

function updateNextBlocking(q) {
  q.objectifs.forEach((o, i) => {
    if (Array.isArray(o)) return;
    const itemEl = modalContent.querySelector(`.obj-item[data-oi="${i}"]`);
    const cb = itemEl?.querySelector('.obj-checkbox');
    if (!itemEl || !cb) return;
    const blocked = isObjectiveBlocked(q, i);
    cb.disabled = blocked;
    itemEl.classList.toggle('obj-blocked', blocked);
    // Si l'étape est de nouveau verrouillée, on force à décocher
    if (blocked && cb.checked) {
      cb.checked = false;
      setCk(q.id, i, undefined, false);
      itemEl.classList.remove('done');
    }
  });
}

window.questToggleAll = function(qid) {
  const q = getQuestById(qid);
  if (!q) return;
  const { done, total } = getProgress(q);
  questCheckAll(qid, done < total);
};

window.questCheckAll = function(qid, checked) {
  const q = getQuestById(qid);
  if (!q) return;
  // Écrire directement en localStorage pour contourner le blocage DOM (next:true)
  q.objectifs.forEach((o, i) => {
    if (Array.isArray(o)) {
      o.forEach((_, j) => setCk(qid, i, j, checked));
    } else {
      setCk(qid, i, undefined, checked);
    }
  });
  // Re-rendre le modal pour refléter le nouvel état
  modalContent.innerHTML = renderSheet(q);
  bindModalCheckboxes(q);
  buildGrid();
  updateStatutCounts();
};

function bindModalCheckboxes(q) {
  modalContent.querySelectorAll('.obj-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const oi = parseInt(cb.dataset.oi);
      const si = cb.dataset.si !== undefined ? parseInt(cb.dataset.si) : undefined;
      setCk(q.id, oi, si, cb.checked);
      cb.closest('.obj-item')?.classList.toggle('done', cb.checked);

      // Mettre à jour le blocage des étapes suivantes
      updateNextBlocking(q);

      const { done, total, pct } = getProgress(q);
      const bar   = modalContent.querySelector('.modal-progress-fill');
      const lbl   = modalContent.querySelector('.modal-progress-lbl');
      const badge = modalContent.querySelector('.quest-status-badge');
      if (bar)   bar.style.width   = pct + '%';
      if (lbl)   lbl.textContent   = `${done}/${total} objectifs`;
      const isDone    = done === total && total > 0;
      const isStarted = !isDone && done > 0;
      if (badge) {
        badge.className   = `quest-status-badge ${isDone ? 'badge-done' : isStarted ? 'badge-wip' : 'badge-todo'}`;
        badge.textContent = isDone ? 'Terminée' : isStarted ? 'En cours' : 'À faire';
      }
      buildGrid();
      updateStatutCounts();
    });
  });
}

/* ── Rendu fiche modal ── */
function renderSheet(q) {
  const zs = getZoneStyle(q.zone);
  const mapUrl = getMapUrl(q.zone);
  const { done, total, pct } = getProgress(q);
  const isDone    = done === total && total > 0;
  const isStarted = !isDone && done > 0;

  /* Objectifs */
  const objsHTML = q.objectifs.map((o, i) => {
    if (Array.isArray(o)) {
      // Héritage : tableau de sous-objectifs (ancien système phases)
      const subs = o.map((sub, j) => {
        const ck    = getCk(q.id, i, j);
        const itemChips = sub.items ? sub.items.map(it => renderItemChip(it.id, it.qte)).join('') : '';
        const mobChips  = sub.mobs  ? sub.mobs .map(m  => renderMobChip (m.id,  m.qte )).join('') : '';
        const chips = itemChips + mobChips;
        return `<div class="obj-item obj-sub ${ck ? 'done' : ''} obj-item-${q.type}">
          <label class="obj-ck-label">
            <input type="checkbox" class="obj-checkbox" data-oi="${i}" data-si="${j}" ${ck ? 'checked' : ''}/>
            <span class="obj-checkmark"></span>
          </label>
          <span class="obj-text">${formatObjectifText(sub.texte, q.palier)}${chips}</span>
        </div>`;
      }).join('');
      return `<div class="obj-group"><div class="obj-group-lbl">↳ Séquence</div>${subs}</div>`;
    } else {
      const ck    = getCk(q.id, i);
      // Blocage cumulatif : bloqué tant qu'un objectif antérieur avec next:true n'est pas coché
      const blocked = isObjectiveBlocked(q, i);
      const itemChips = o.items ? o.items.map(it => renderItemChip(it.id, it.qte)).join('') : '';
      const mobChips  = o.mobs  ? o.mobs .map(m  => renderMobChip (m.id,  m.qte )).join('') : '';
      const chips = itemChips + mobChips;
      const locChip = (() => {
        const loc = o.location;
        if (!loc) return '';
        const hasCoords = loc.x != null && loc.z != null;
        if (!hasCoords) return '';
        const label   = loc.regionName
          ? `📍 ${loc.regionName}`
          : `📍 X ${loc.x} · Z ${loc.z}`;
        const name = (o.texte || 'Objectif').replace(/'/g, "\'");
        return `<span class="obj-loc-chip obj-loc-pin-btn" onclick="showObjLocPin(event,${loc.x},${loc.z},${q.palier},'${name}')" title="X:${loc.x} · Z:${loc.z} — cliquer pour voir">${label}</span>`;
      })();
      const objEl = `<div class="obj-item ${ck ? 'done' : ''} ${blocked ? 'obj-blocked' : ''} obj-item-${q.type}" data-oi="${i}">
        <label class="obj-ck-label">
          <input type="checkbox" class="obj-checkbox" data-oi="${i}" ${ck ? 'checked' : ''} ${blocked ? 'disabled' : ''}/>
          <span class="obj-checkmark"></span>
        </label>
        <span class="obj-text">${formatObjectifText(o.texte, q.palier)}${chips}${locChip}</span>
      </div>`;
      const arrowEl = o.next && i < q.objectifs.length - 1
        ? `<div class="obj-next-arrow">↓</div>`
        : '';
      return objEl + arrowEl;
    }
  }).join('');

  /* Récompenses */
  const rewHTML = q.recompenses.map(r => renderRewardFull(r)).join('');

  /* Zone link conditionnel */
  const zoneEl = q.zone
    ? (mapUrl
        ? `<a class="quest-meta-val quest-zone-link" href="${mapUrl}" style="color:${zs.color};text-shadow:0 0 8px ${zs.dim}" target="_blank">🗺 ${q.zone} ↗</a>`
        : `<span class="quest-meta-val" style="color:${zs.color}">🗺 ${q.zone}</span>`)
    : '';

  /* Coordonnées de départ de la quête → renvoie au pin de la quête sur la carte */
  const questCoordsEl = (() => {
    const c = q.coords;
    if (!c || c.x == null || c.z == null) return '';
    const href = `../Map/map.html?questId=${q.id}#floor-${q.palier}-surface`;
    return `<a class="obj-loc-chip quest-coords-chip" href="${href}" target="_blank" title="Voir sur la carte">📍 X ${c.x} · Z ${c.z}</a>`;
  })();

  /* Bouton "Copier le lien" */
  const shareUrl = `${location.origin}${location.pathname}#${q.id}`;

  return `<div class="quest-sheet">
    <div class="quest-sheet-header">
      <div class="quest-type-icon qicon-${q.type}">${TYPE_ICONS[q.type]}</div>
      <div class="quest-sheet-info">
        <div class="quest-sheet-name">${q.titre}</div>
        <div class="quest-badge-row">
          <span class="quest-type-badge qbadge-${q.type}">${TYPE_LABELS[q.type]}</span>
          <span class="quest-status-badge ${isDone ? 'badge-done' : isStarted ? 'badge-wip' : 'badge-todo'}">${isDone ? 'Terminée' : isStarted ? 'En cours' : 'À faire'}</span>
          <button class="quest-share-btn" title="Copier le lien de la quête" onclick="
            navigator.clipboard.writeText('${shareUrl}');
            this.textContent='✓ Copié';
            setTimeout(()=>this.textContent='⇗ Lien',1500)">⇗ Lien</button>
        </div>
        <div class="quest-meta-row">
          <div class="quest-meta-item">
            <span class="quest-meta-key">Palier</span>
            <span class="quest-meta-val">⬡ ${q.palier}</span>
          </div>
          ${zoneEl ? `<div class="quest-meta-item"><span class="quest-meta-key">Zone</span>${zoneEl}</div>` : ''}
          ${q.npc  ? `<div class="quest-meta-item"><span class="quest-meta-key">PNJ</span><span class="quest-meta-val">🧑 ${resolvePnjName(q.npc)}</span></div>` : ''}
          ${questCoordsEl ? `<div class="quest-meta-item"><span class="quest-meta-key">Départ</span>${questCoordsEl}</div>` : ''}
        </div>
      </div>
    </div>

    <div class="modal-progress-bar">
      <div class="modal-progress-fill" style="width:${pct}%"></div>
      <span class="modal-progress-lbl">${done}/${total} objectifs</span>
    </div>

    <div class="quest-body">
      <div class="quest-section">
        <div class="quest-section-title">Description</div>
        <blockquote class="quest-lore">${q.desc}</blockquote>
      </div>
      <div class="quest-section">
        <div class="quest-section-title">Objectifs</div>
        <div class="quest-check-all-row">
          <button class="quest-check-all-btn quest-toggle-all-btn" onclick="questToggleAll('${q.id}')">
            ${isDone ? '○ Tout décocher' : '✓ Tout cocher'}
          </button>
        </div>
        <div class="obj-list">${objsHTML}</div>
      </div>
      <div class="quest-section">
        <div class="quest-section-title">Récompenses</div>
        <div class="reward-list">${rewHTML}</div>
      </div>
    </div>
  </div>`;
}

/* ══════════════════════════════════
   HEADER
══════════════════════════════════ */
const TITLES = {
  main: ['Quêtes Principales', '// PRINCIPALES · VEILLEURS AU CLAIR DE LUNE'],
  sec:  ['Quêtes Secondaires', '// SECONDAIRES · VEILLEURS AU CLAIR DE LUNE'],
  ter:  ['Quêtes Tertiaires',  '// TERTIAIRES · VEILLEURS AU CLAIR DE LUNE'],
};
function updateHeader() {
  const [t, s] = TITLES[activeTab];
  mainTitle.textContent    = t;
  mainSubtitle.textContent = s;
}

/* ══════════════════════════════════
   ONGLETS
══════════════════════════════════ */
function setActiveTab(tab) {
  activeTab    = tab;
  activePalier = 'all';
  activeStatut = 'all';
  document.querySelector('input[name="statut-filter"][value="all"]').checked = true;
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.remove('active-main', 'active-sec', 'active-ter');
    if (btn.dataset.tab === tab) btn.classList.add(`active-${tab}`);
  });
  refreshAll();
}

/* ══════════════════════════════════
   REFRESH
══════════════════════════════════ */
function refreshAll() {
  _tabQuestsCache = null;
  updateHeader();
  buildPalierFilters();
  buildZoneFilters();
  updateStatutCounts();
  buildGrid();
  buildInventoryPanel();
}

/* ══════════════════════════════════
   EVENTS
══════════════════════════════════ */
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.dataset.tab && btn.dataset.tab !== 'inv') setActiveTab(btn.dataset.tab);
  });
});

const _sortSelectEl = document.getElementById('quest-sort');
if (_sortSelectEl) {
  _sortSelectEl.addEventListener('change', () => {
    _currentSort = _sortSelectEl.value;
    buildGrid();
  });
}

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  buildGrid();
});

document.querySelectorAll('input[name="statut-filter"]').forEach(rb => {
  rb.addEventListener('change', () => {
    activeStatut = rb.value;
    buildGrid();
  });
});

/* ══════════════════════════════════
   LAYOUT
══════════════════════════════════ */
function setLayout() {
  const header = document.querySelector('.site-header');
  const layout = document.querySelector('.quetes-layout');
  if (header && layout) layout.style.top = header.getBoundingClientRect().height + 'px';
}
setLayout();
window.addEventListener('resize', setLayout);

/* ══════════════════════════════════
   PIN POPUP OBJECTIF
══════════════════════════════════ */
let _objLocPopup = null;
function _dismissObjLocPopup(e) {
  if (_objLocPopup && !_objLocPopup.contains(e.target)) {
    _objLocPopup.remove();
    _objLocPopup = null;
    document.removeEventListener('click', _dismissObjLocPopup, true);
  }
}

window.showObjLocPin = function(e, x, z, floor, name) {
  e.stopPropagation();
  if (_objLocPopup) { _objLocPopup.remove(); _objLocPopup = null; }

  const popup = document.createElement('div');
  popup.style.cssText = 'position:fixed;background:var(--surface,#1a1a2e);border:1px solid var(--border,#333);border-radius:10px;padding:12px 16px;z-index:9999;box-shadow:0 6px 28px rgba(0,0,0,.6);font-size:13px;min-width:190px;pointer-events:auto;';

  const href = `../Map/map.html?ghost_gx=${x}&ghost_gz=${z}&ghost_floor=${floor}&ghost_name=${encodeURIComponent(name)}#floor-${floor}-surface`;
  popup.innerHTML = `
    <div style="font-size:10px;font-weight:700;color:var(--muted,#888);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">📍 Point d'objectif</div>
    <div style="font-size:14px;font-weight:700;margin-bottom:10px;">X ${x} · Z ${z}<span style="font-size:11px;font-weight:400;color:var(--muted,#888);margin-left:6px;">Étage ${floor}</span></div>
    <a href="${href}" target="_blank" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:var(--accent,#7a5af8);text-decoration:none;border:1px solid rgba(122,90,248,.3);padding:4px 10px;border-radius:6px;background:rgba(122,90,248,.08);">🗺️ Voir sur la carte →</a>
  `;

  const rect = e.currentTarget.getBoundingClientRect();
  const top  = rect.bottom + 6;
  let left = rect.left;
  popup.style.top  = top  + 'px';
  popup.style.left = left + 'px';
  document.body.appendChild(popup);

  // Ajuste si popup déborde à droite
  const pw = popup.offsetWidth;
  if (left + pw > window.innerWidth - 8) {
    popup.style.left = Math.max(8, window.innerWidth - pw - 8) + 'px';
  }
  // Ajuste si déborde en bas
  const ph = popup.offsetHeight;
  if (top + ph > window.innerHeight - 8) {
    popup.style.top = (rect.top - ph - 6) + 'px';
  }

  _objLocPopup = popup;
  setTimeout(() => document.addEventListener('click', _dismissObjLocPopup, true), 0);
};

/* ══════════════════════════════════
   TOOLTIP ITEMS (body-level, bypass overflow:hidden)
══════════════════════════════════ */
/* ══════════════════════════════════
   TOOLTIP ITEMS — singleton body-level
══════════════════════════════════ */
const _tip = (() => {
  let el        = null;
  let hideTimer = null;

  function getEl() {
    if (!el) {
      el = document.createElement('div');
      el.className = 'vcl-item-tip';
      document.body.appendChild(el);
    }
    return el;
  }

  return {
    show(anchor, text, color) {
      clearTimeout(hideTimer);
      const t = getEl();
      t.classList.remove('visible');
      t.textContent = text;
      t.style.color       = color;
      t.style.borderColor = color + '55';
      t.style.left = '-9999px';
      t.style.top  = '0px';          // top:0 pour forcer le rendu vertical correct
      void t.offsetWidth;            // force layout synchrone
      const tw = t.offsetWidth;
      const th = t.offsetHeight;
      const r  = anchor.getBoundingClientRect();
      let left = Math.round(r.left + r.width / 2 - tw / 2);
      let top  = Math.round(r.top - th - 8);
      if (left < 6) left = 6;
      if (left + tw > window.innerWidth - 6) left = window.innerWidth - tw - 6;
      if (top < 6) top = Math.round(r.bottom + 8);
      t.style.left = left + 'px';
      t.style.top  = top  + 'px';
      requestAnimationFrame(() => t.classList.add('visible'));
    },
    hide() {
      clearTimeout(hideTimer);
      if (!el) return;
      el.classList.remove('visible');
      hideTimer = setTimeout(() => { el?.remove(); el = null; }, 120);
    }
  };
})();

/* ══════════════════════════════════
   TOOLTIP DÉLÉGATION (sur queteGrid)
   Persiste à travers les rebuilds de grille et les ouvertures/fermetures de modal
══════════════════════════════════ */
let _tipAnchor = null;

queteGrid.addEventListener('mouseover', e => {
  const icon = e.target.closest('.card-item-icon[data-tip]');
  if (icon === _tipAnchor) return;
  _tipAnchor = icon;
  if (!icon) { _tip.hide(); return; }
  const color = icon.style.getPropertyValue('--chip-color') || '#c8a96e';
  _tip.show(icon, icon.dataset.tip, color);
});

queteGrid.addEventListener('mouseout', e => {
  if (!_tipAnchor) return;
  if (!_tipAnchor.contains(e.relatedTarget)) {
    _tipAnchor = null;
    _tip.hide();
  }
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */

/* Premier init : lancé dès que le DOM est prêt,
   DB_ITEMS peut être vide (Firestore pas encore chargé).
   La grille s'affiche sans les visuels items. */
function initQuetesDOM() {
  if (window._domInited) return;
  window._domInited = true;
  document.querySelector('.sort-btn[data-tab="main"]')?.classList.add('active-main');
  refreshAll();
  handleHashOnLoad();
}

/* Appelé par quetes-loader.js une fois DB_ITEMS peuplé.
   On re-render tout maintenant qu'on a les données items.
   Si le modal est ouvert on le re-render aussi. */
function initQuetes() {
  window._dbReady = true;

  /* Si le DOM n'était pas encore init, on le fait maintenant */
  if (!window._domInited) {
    window._domInited = true;
    document.querySelector('.sort-btn[data-tab="main"]')?.classList.add('active-main');
  }

  /* Re-render complet avec les vrais items */
  refreshAll();

  /* Si le modal est ouvert, on re-render la fiche avec les vrais items */
  if (modalOverlay.classList.contains('open') && window._currentModalQuest) {
    modalContent.innerHTML = renderSheet(window._currentModalQuest);
    bindModalCheckboxes(window._currentModalQuest);
  }

  /* Hash routing (rejoué si items manquaient au premier passage) */
  handleHashOnLoad();
}

window._initQuetes = initQuetes;

/* Lancement DOM immédiat (sans attendre Firestore) */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initQuetesDOM);
} else {
  initQuetesDOM();
}