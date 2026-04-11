/* ══════════════════════════════════════════════════════════════
   QUÊTES — Veilleurs au Clair de Lune
   quetes.js
   Dépend de : data.js (QUETES, DB_ITEMS, helpers)
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
function normalize(str) {
  return String(str || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getFiltered() {
  const q = normalize(searchQuery);
  return QUETES.filter(e => {
    if (e.type !== activeTab) return false;
    if (activePalier !== 'all' && e.palier !== activePalier) return false;
    if (activeZones.size > 0 && !activeZones.has(e.zone)) return false;
    const done = isQuestDone(e);
    if (activeStatut === 'todo' && done)  return false;
    if (activeStatut === 'done' && !done) return false;
    if (q &&
      !normalize(e.titre).includes(q) &&
      !normalize(e.zone).includes(q)  &&
      !normalize(e.npc).includes(q)   &&
      !normalize(e.desc).includes(q)
    ) return false;
    return true;
  });
}

/* ══════════════════════════════════
   RENDU ITEM — style compendium
   Produit un <a> cliquable vers compendium.html#id
   avec image, couleur rareté, quantité
══════════════════════════════════ */
function renderItemRow(itemId, qte) {
  const item  = dbItem(itemId);
  const color = item ? rarityColor(item.rarity) : '#888';
  const name  = item ? item.name : itemId;
  const imgSrc = item ? (item.img || item.image || null) : null;

  const visual = imgSrc
    ? `<img class="qi-img" src="${imgSrc}" alt="${name}">`
    : `<span class="qi-emoji">📦</span>`;

  const href = `../Compendium/compendium.html#${itemId}`;

  return `
    <a class="quest-item-row" href="${href}" target="_blank" title="Voir dans le Compendium" style="--item-color:${color}">
      <span class="qi-visual">${visual}</span>
      <span class="qi-name" style="color:${color}">${name}</span>
      <span class="qi-qty">×${qte}</span>
    </a>`;
}

/* Badge compact utilisé dans les objectifs (sur la même ligne que le texte) */
function renderItemChip(itemId, qte) {
  const item  = dbItem(itemId);
  const color = item ? rarityColor(item.rarity) : '#888';
  const name  = item ? item.name : itemId;
  const imgSrc = item ? (item.img || item.image || null) : null;

  const visual = imgSrc
    ? `<img class="chip-img" src="${imgSrc}" alt="${name}">`
    : `<span class="chip-emoji">📦</span>`;

  return `
    <a class="item-chip" href="../Compendium/compendium.html#${itemId}" target="_blank"
       style="--chip-color:${color}" title="${name}">
      <span class="chip-visual">${visual}</span>
      <span class="chip-name" style="color:${color}">${name}</span>
      <span class="chip-qty">×${qte}</span>
    </a>`;
}

/* Récompense item (dans la section récompenses du modal) */
function renderRewardItem(r) {
  if (r.type === 'exp')  return `<span class="reward-item reward-xp">✨ ${r.label}</span>`;
  if (r.type === 'cols') return `<span class="reward-item reward-gold">🪙 ${r.label}</span>`;

  /* type === 'items' */
  if (!r.itemId) return `<span class="reward-item reward-item-r">📦 ${r.label}</span>`;

  const item   = dbItem(r.itemId);
  const color  = item ? rarityColor(item.rarity) : '#c0a0dc';
  const name   = item ? item.name : r.label;
  const imgSrc = item ? (item.img || item.image || null) : null;
  const visual = imgSrc
    ? `<img class="reward-img" src="${imgSrc}" alt="${name}">`
    : `<span>📦</span>`;

  return `
    <a class="reward-item reward-item-linked" href="../Compendium/compendium.html#${r.itemId}"
       target="_blank" style="--item-color:${color};border-color:${color}33;background:${color}0d">
      <span class="reward-visual">${visual}</span>
      <span class="reward-name" style="color:${color}">${r.label}</span>
    </a>`;
}

/* Mini tag pour les cartes (exp / cols / items) */
function rewardMiniTag(r) {
  if (r.type === 'exp')  return `<span class="rmt rmt-exp">✨ ${r.label}</span>`;
  if (r.type === 'cols') return `<span class="rmt rmt-cols">🪙 ${r.label}</span>`;
  if (!r.itemId)         return `<span class="rmt rmt-item">📦 ${r.label}</span>`;

  const item  = dbItem(r.itemId);
  const color = item ? rarityColor(item.rarity) : '#c0a0dc';
  return `<span class="rmt rmt-item" style="color:${color};border-color:${color}33;background:${color}0d">📦 ${r.label}</span>`;
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
function buildPalierFilters() {
  const list   = QUETES.filter(q => q.type === activeTab);
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
  const zf   = document.getElementById('zone-filters');
  const list = QUETES.filter(q => q.type === activeTab);
  const zones = [...new Set(list.map(q => q.zone))].sort();
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
  const base = QUETES.filter(q => q.type === activeTab);
  document.getElementById('cnt-all').textContent  = base.length;
  document.getElementById('cnt-todo').textContent = base.filter(q => !isQuestDone(q)).length;
  document.getElementById('cnt-done').textContent = base.filter(q =>  isQuestDone(q)).length;
}

/* ══════════════════════════════════
   INVENTAIRE
══════════════════════════════════ */
/* Collecte tous les item ids référencés dans les quêtes */
function getAllQuestItemIds() {
  const ids = new Set();
  QUETES.forEach(q => {
    q.objectifs.flat().forEach(o => {
      if (o.items) o.items.forEach(it => ids.add(it.id));
    });
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
  const inv  = getInventory();
  const ids  = getAllQuestItemIds();
  panel.innerHTML = '';

  ids.forEach(id => {
    const item   = dbItem(id);
    const name   = item ? item.name : id;
    const color  = item ? rarityColor(item.rarity) : '#888';
    const imgSrc = item ? (item.img || item.image || null) : null;

    const row = document.createElement('div');
    row.className = 'inv-row';
    row.innerHTML = `
      <span class="inv-visual">
        ${imgSrc ? `<img class="inv-img" src="${imgSrc}" alt="${name}">` : `<span class="inv-emoji">📦</span>`}
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
    const xp  = q.recompenses.find(r => r.type === 'exp')?.label  || '';
    const col = q.recompenses.find(r => r.type === 'cols')?.label || '';
    div.innerHTML = `
      <span class="feasible-dot" style="background:var(--quete-${q.type})"></span>
      <span class="feasible-name">${q.titre}</span>
      <span class="feasible-rew">${xp}${col ? ' · ' + col : ''}</span>`;
    div.addEventListener('click', () => openModal(q));
    fp.appendChild(div);
  });
}

/* ══════════════════════════════════
   GRILLE — cartes hauteur fixe
══════════════════════════════════ */
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

  const paliers = [...new Set(entities.map(q => q.palier))].sort((a, b) => a - b);
  let idx = 0;

  paliers.forEach(p => {
    const heading = document.createElement('div');
    heading.className = 'palier-heading';
    heading.textContent = `⬡ Palier ${p}`;
    queteGrid.appendChild(heading);

    entities.filter(q => q.palier === p).forEach(q => {
      const card = document.createElement('div');
      card.className = `quete-card ${q.type}`;
      card.dataset.id = q.id;
      card.style.animationDelay = `${idx * 0.03}s`;
      idx++;

      const { done, total, pct } = getProgress(q);
      const effectiveDone = done === total && total > 0;
      const zs = getZoneStyle(q.zone);
      const mapUrl = ZONE_MAP_URLS[q.zone] || '#';

      card.innerHTML = `
        <div class="type-stripe"></div>
        <div class="card-body">
          <div class="card-top">
            <div class="card-title">${q.titre}</div>
            <span class="card-badge ${effectiveDone ? 'badge-done' : 'badge-todo'}">${effectiveDone ? 'Terminée' : 'À faire'}</span>
          </div>
          <div class="card-meta">
            <span class="ctag ctag-palier">P${q.palier}</span>
            <a class="ctag ctag-zone" href="${mapUrl}"
               style="color:${zs.color};border-color:${zs.dim};background:${zs.glow}"
               title="Voir sur la carte" onclick="event.stopPropagation()">🗺 ${q.zone}</a>
          </div>
          <p class="card-desc">${q.desc}</p>
          <div class="card-rewards-mini">
            ${q.recompenses.map(r => rewardMiniTag(r)).join('')}
          </div>
        </div>
        <div class="card-footer">
          <div class="card-progress">
            <div class="progress-wrap">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <span class="progress-lbl">${done}/${total}</span>
          </div>
          <span class="card-npc">🧑 ${q.npc}</span>
        </div>`;

      card.addEventListener('mousedown', e => e.preventDefault());
      card.addEventListener('click', () => openModal(q));
      queteGrid.appendChild(card);
    });
  });
}

/* ══════════════════════════════════
   MODAL
══════════════════════════════════ */
function openModal(q) {
  modalContent.innerHTML = renderSheet(q);
  bindModalCheckboxes(q);
  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
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

/* ── Bind checkboxes dans le modal ── */
function bindModalCheckboxes(q) {
  modalContent.querySelectorAll('.obj-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      const oi = parseInt(cb.dataset.oi);
      const si = cb.dataset.si !== undefined ? parseInt(cb.dataset.si) : undefined;
      setCk(q.id, oi, si, cb.checked);

      cb.closest('.obj-item')?.classList.toggle('done', cb.checked);

      const { done, total, pct } = getProgress(q);
      const bar   = modalContent.querySelector('.modal-progress-fill');
      const lbl   = modalContent.querySelector('.modal-progress-lbl');
      const badge = modalContent.querySelector('.quest-status-badge');
      if (bar)   bar.style.width   = pct + '%';
      if (lbl)   lbl.textContent   = `${done}/${total} objectifs`;
      const isDone = done === total && total > 0;
      if (badge) {
        badge.className   = `quest-status-badge ${isDone ? 'badge-done' : 'badge-todo'}`;
        badge.textContent = isDone ? 'Terminée' : 'À faire';
      }

      buildGrid();
      updateStatutCounts();
    });
  });
}

/* ── Rendu fiche ── */
function renderSheet(q) {
  const zs = getZoneStyle(q.zone);
  const { done, total, pct } = getProgress(q);
  const isDone = done === total && total > 0;

  /* Objectifs */
  const objsHTML = q.objectifs.map((o, i) => {
    if (Array.isArray(o)) {
      const subs = o.map((sub, j) => {
        const ck = getCk(q.id, i, j);
        const chips = sub.items ? sub.items.map(it => renderItemChip(it.id, it.qte)).join('') : '';
        return `
          <div class="obj-item obj-sub ${ck ? 'done' : ''} obj-item-${q.type}">
            <label class="obj-ck-label">
              <input type="checkbox" class="obj-checkbox" data-oi="${i}" data-si="${j}" ${ck ? 'checked' : ''}/>
              <span class="obj-checkmark"></span>
            </label>
            <span class="obj-text">${sub.texte}${chips}</span>
          </div>`;
      }).join('');
      return `<div class="obj-group"><div class="obj-group-lbl">↳ Séquence</div>${subs}</div>`;
    } else {
      const ck = getCk(q.id, i);
      const chips = o.items ? o.items.map(it => renderItemChip(it.id, it.qte)).join('') : '';
      return `
        <div class="obj-item ${ck ? 'done' : ''} obj-item-${q.type}">
          <label class="obj-ck-label">
            <input type="checkbox" class="obj-checkbox" data-oi="${i}" ${ck ? 'checked' : ''}/>
            <span class="obj-checkmark"></span>
          </label>
          <span class="obj-text">${o.texte}${chips}</span>
        </div>`;
    }
  }).join('');

  /* Récompenses */
  const rewHTML = q.recompenses.map(r => renderRewardItem(r)).join('');

  return `
    <div class="quest-sheet">
      <div class="quest-sheet-header">
        <div class="quest-type-icon qicon-${q.type}">${TYPE_ICONS[q.type]}</div>
        <div class="quest-sheet-info">
          <div class="quest-sheet-name">${q.titre}</div>
          <div class="quest-badge-row">
            <span class="quest-type-badge qbadge-${q.type}">${TYPE_LABELS[q.type]}</span>
            <span class="quest-status-badge ${isDone ? 'badge-done' : 'badge-todo'}">${isDone ? 'Terminée' : 'À faire'}</span>
          </div>
          <div class="quest-meta-row">
            <div class="quest-meta-item">
              <span class="quest-meta-key">Palier</span>
              <span class="quest-meta-val">⬡ ${q.palier}</span>
            </div>
            <div class="quest-meta-item">
              <span class="quest-meta-key">Zone</span>
              <a class="quest-meta-val quest-zone-link"
                 href="${ZONE_MAP_URLS[q.zone] || '#'}"
                 style="color:${zs.color};text-shadow:0 0 8px ${zs.dim}"
                 target="_blank">🗺 ${q.zone} ↗</a>
            </div>
            <div class="quest-meta-item">
              <span class="quest-meta-key">PNJ</span>
              <span class="quest-meta-val">🧑 ${q.npc}</span>
            </div>
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
  mainTitle.textContent   = t;
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
   INIT — appelé par quetes-loader.js
   après chargement Firestore
══════════════════════════════════ */
function initQuetes() {
  document.querySelector('.sort-btn[data-tab="main"]')?.classList.add('active-main');
  refreshAll();
}

window._initQuetes = initQuetes;

/* Fallback si pas de loader (ouverture directe sans Firebase) */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { if (!window._loaderRan) initQuetes(); });
} else {
  if (!window._loaderRan) initQuetes();
}