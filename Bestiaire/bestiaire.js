/* ══════════════════════════════════════════════════════════════
   BESTIAIRE — Veilleurs au Clair de Lune
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
let activeTab      = 'monstres';
let _activeViewer  = null;

/* ── Queue de capture 3D pour les cartes ── */
const _captureQueue = [];
let   _captureRunning = false;

function _queueCapture(card, mob) {
  _captureQueue.push({ card, mob });
  if (!_captureRunning) _runCaptureQueue();
}

async function _runCaptureQueue() {
  _captureRunning = true;
  while (_captureQueue.length > 0) {
    const { card, mob } = _captureQueue.shift();
    if (!card.isConnected) continue;
    try {
      const url = await MonstreViewer3D.captureStatic(mob, 200);
      if (!card.isConnected) continue;
      const wrap = card.querySelector('.card-img-wrap');
      if (!wrap) continue;
      wrap.querySelector('img')?.remove();
      wrap.querySelector('.card-img-placeholder')?.remove();
      const snap = document.createElement('img');
      snap.src = url;
      snap.alt = mob.name;
      wrap.insertBefore(snap, wrap.firstChild);
    } catch(e) {
      console.warn('[capture3D]', mob.id, e);
    }
  }
  _captureRunning = false;
}
let activePalier   = 'all';
let activeTypes    = new Set(['boss', 'mini_boss', 'monstre', 'sbire']);
let activePnjTags  = new Set(Object.keys(typeof PNJ_TAG_LABELS !== 'undefined' ? PNJ_TAG_LABELS : {}));
let searchQuery    = '';

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const searchInput   = document.getElementById('sidebar-search');
const palierFilters = document.getElementById('palier-filters');
const entityGrid    = document.getElementById('entity-grid');
const gridEmpty     = document.getElementById('grid-empty');
const resultCount   = document.getElementById('result-count');
const mainTitle     = document.getElementById('main-title');
const mainSubtitle  = document.getElementById('main-subtitle');
const modalOverlay  = document.getElementById('mob-modal-overlay');
const modalContent  = document.getElementById('mob-modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const typeSection   = document.getElementById('type-block');
const pnjTagSection = document.getElementById('pnj-tag-block');

function getMapZone(entity) {
  return entity.mapZone || entity.regionId || null;
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function getRarityColor(key) {
  if (typeof RARITIES !== 'undefined' && RARITIES[key]) return RARITIES[key].color;
  return { commun:'#8c8c8c', peu_commun:'#2dc44e', rare:'#4e96e8', epique:'#a135db', legendaire:'#e0ac60' }[key] || '#8c8c8c';
}
function findItem(id) {
  return (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === id) || null : null;
}
function dropRateColor(chance) {
  if (chance >= 70) return '#7fdf62';
  if (chance >= 30) return '#c9a84c';
  return '#c0392b';
}
function diffStarsHTML(diff) {
  return Array.from({length:5}, (_,i) =>
    `<span class="diff-star ${i < diff ? 'filled' : 'empty'}">◆</span>`
  ).join('');
}

function pushHash(tab, entityId = null) {
  const hash = entityId ? `#${tab}/${entityId}` : `#${tab}`;
  history.pushState({ tab, entityId }, '', hash);
}

function applyHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;

  const [tab, entityId] = raw.split('/');

  if ((tab === 'monstres' || tab === 'personnages') && tab !== activeTab) {
    activeTab    = tab;
    activePalier = 'all';
    document.querySelectorAll('.sort-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    refreshAll();
  }

  if (entityId) {
    const list   = activeTab === 'monstres' ? MOBS : PERSONNAGES;
    const entity = list.find(e => e.id === entityId);
    if (entity) openModal(entity, /* pushHistory = */ false);
  }
}

window.addEventListener('popstate', (e) => {
  const state = e.state;

  if (!state) {
    _closeModalDOM();
    return;
  }

  if (!state.entityId) {
    _closeModalDOM();
    if (state.tab && state.tab !== activeTab) {
      activeTab    = state.tab;
      activePalier = 'all';
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === state.tab);
      });
      refreshAll();
    }
    return;
  }

  const list   = (state.tab === 'monstres' ? MOBS : PERSONNAGES);
  const entity = list.find(e => e.id === state.entityId);
  if (entity) openModal(entity, false);
});

/* ══════════════════════════════════
   FILTRAGE
══════════════════════════════════ */
function getList() { return activeTab === 'monstres' ? MOBS : PERSONNAGES; }

function getFiltered() {
  const q = normalize(searchQuery);
  return getList().filter(e => {
    if (q && !normalize(e.name).includes(q) && !normalize(e.region||'').includes(q) && !normalize(e.lore||'').includes(q)) return false;
    if (activePalier !== 'all' && e.palier !== activePalier) return false;
    if (activeTab === 'monstres') {
      if (!activeTypes.has(e.type)) return false;
    } else {
      if (e.tag && !activePnjTags.has(e.tag)) return false;
    }
    return true;
  });
}

/* ══════════════════════════════════
   COMPTEURS SIDEBAR
══════════════════════════════════ */
function updateCounts() {
  if (activeTab === 'monstres') {
    const list = MOBS.filter(e => activePalier === 'all' || e.palier === activePalier);
    const q    = normalize(searchQuery);
    const filtered = q ? list.filter(e =>
      normalize(e.name).includes(q) || normalize(e.region||'').includes(q)
    ) : list;
    ['boss','mini_boss','monstre','sbire'].forEach(t => {
      const el = document.getElementById(`count-${t}`);
      if (el) el.textContent = filtered.filter(e => e.type === t).length;
    });
  } else {
    const list = PERSONNAGES.filter(e => activePalier === 'all' || e.palier === activePalier);
    const q    = normalize(searchQuery);
    const filtered = q ? list.filter(e =>
      normalize(e.name).includes(q) || normalize(e.region||'').includes(q)
    ) : list;
    Object.keys(PNJ_TAG_LABELS).forEach(tag => {
      const el = document.getElementById(`count-${tag}`);
      if (el) el.textContent = filtered.filter(e => e.tag === tag).length;
    });
    const groupExtras = { forgeron: ['refaconneur', 'fabricant_cles', 'fabricant_secrets'], marchand: ['repreneur_butin'] };
    ['forgeron', 'marchand'].forEach(cat => {
      const el = document.getElementById(`group-count-${cat}`);
      if (el) el.textContent = filtered.filter(e => e.tag && (e.tag.startsWith(cat) || (groupExtras[cat]||[]).includes(e.tag))).length;
    });
  }
}

/* ══════════════════════════════════
   SIDEBAR — BLOCS COLLAPSE
══════════════════════════════════ */
function initCollapsible(headerId, bodyId) {
  const header = document.getElementById(headerId);
  const body   = document.getElementById(bodyId);
  if (!header || !body) return;
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    body.classList.toggle('open');
  });
}
initCollapsible('palier-block-header',   'palier-block-body');
initCollapsible('type-block-header',     'type-block-body');
initCollapsible('pnj-tag-block-header',  'pnj-tag-block-body');

document.querySelectorAll('.pnj-cat-header').forEach(header => {
  header.addEventListener('click', () => {
    const cat  = header.dataset.cat;
    const body  = document.getElementById(`group-body-${cat}`);
    const arrow = header.querySelector('.pnj-cat-arrow');
    if (!body) return;
    const isOpen = body.classList.toggle('open');
    if (arrow) arrow.classList.toggle('open', isOpen);
  });
});

/* ══════════════════════════════════
   CONSTRUCTION FILTRES PALIER
══════════════════════════════════ */
function buildPalierFilters() {
  const list   = getList();
  const paliers = [...new Set(list.map(e => e.palier))].sort((a,b)=>a-b);
  palierFilters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `palier-filter-btn${activePalier==='all' ? ' active' : ''}`;
  allBtn.innerHTML = `<span>⬡ Tous</span><span class="palier-count">${list.length}</span>`;
  allBtn.addEventListener('click', () => { activePalier = 'all'; refreshAll(); });
  palierFilters.appendChild(allBtn);

  paliers.forEach(p => {
    const count = list.filter(e => e.palier === p).length;
    const btn = document.createElement('button');
    btn.className = `palier-filter-btn${activePalier===p ? ' active' : ''}`;
    btn.innerHTML = `<span>⬡ Palier ${p}</span><span class="palier-count">${count}</span>`;
    btn.addEventListener('click', () => { activePalier = p; refreshAll(); });
    palierFilters.appendChild(btn);
  });
}

function updateSidebarSections() {
  typeSection.style.display    = activeTab === 'monstres'   ? '' : 'none';
  pnjTagSection.style.display  = activeTab === 'personnages' ? '' : 'none';
}

/* ══════════════════════════════════
   GRILLE
══════════════════════════════════ */
function buildGrid() {
  const entities = getFiltered();
  entityGrid.innerHTML = '';

  if (entities.length === 0) {
    gridEmpty.style.display = 'flex';
    entityGrid.style.display = 'none';
    resultCount.textContent = '0 résultat';
    return;
  }
  gridEmpty.style.display = 'none';
  entityGrid.style.display = 'grid';
  resultCount.textContent = `${entities.length} entrée${entities.length>1?'s':''}`;

  entities.forEach((e, idx) => {
    const card = document.createElement('div');
    card.className = 'entity-card';
    card.dataset.id = e.id;
    card.style.animationDelay = `${idx * 0.025}s`;

    const isMob = activeTab === 'monstres';

    const imgHTML = e.img
      ? `<img src="${e.img}" alt="${e.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
      : '';
    const phStyle = e.img ? 'style="display:none"' : '';
    const ph = `<span class="card-img-placeholder" ${phStyle}>${isMob ? '👾' : '🧑'}</span>`;

    const typeKey   = isMob ? e.type : (e.tag || 'pnj');
    const typeLabel = isMob ? (TYPE_LABELS[e.type]||e.type) : (PNJ_TAG_LABELS[e.tag]||e.tag||'PNJ');
    const typeBadge = `<span class="card-type-badge badge-${typeKey}" style="${!isMob && e.tag ? `background:${PNJ_TAG_COLORS[e.tag]}22;color:${PNJ_TAG_COLORS[e.tag]};border-color:${PNJ_TAG_COLORS[e.tag]}55` : ''}">${typeLabel}</span>`;
    const palierBadge = `<span class="card-palier-badge">P${e.palier}</span>`;
	const codexBadge = (isMob && e.inCodex) ? `<span class="card-codex-badge">📖</span>` : '';

    let behaviorHTML = '';
    if (isMob) {
      behaviorHTML = `
        <div class="card-behavior-row">
          <span class="card-behavior-dot cdot-${e.behavior}"></span>
          <span class="card-behavior-text">${BEHAVIOR_LABELS[e.behavior]||e.behavior}</span>
        </div>`;
    } else {
      behaviorHTML = `
        <div class="card-behavior-row">
          <span class="card-behavior-text" style="color:var(--muted)">${e.region||''}</span>
        </div>`;
    }

    card.innerHTML = `
		<div class="card-img-wrap">
			${imgHTML}${ph}
			${typeBadge}
			${palierBadge}
			${codexBadge}
		</div>
		<div class="card-info">
			<div class="card-name">${e.name}</div>
			${behaviorHTML}
		</div>`;

    card.addEventListener('mousedown', (ev) => ev.preventDefault());
    card.addEventListener('click', () => openModal(e));
    entityGrid.appendChild(card);

    if (e.morceaux && e.morceaux.length > 0 && typeof MonstreViewer3D !== 'undefined') {
      _queueCapture(card, e);
    }
  });
}

/* ══════════════════════════════════
   MODAL
══════════════════════════════════ */

/**
 * @param {object}  entity
 * @param {boolean} pushHistory
 */
function attachModalHandlers() {
  modalContent.querySelectorAll('.craft-toggle').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      const panel = btn.closest('.loot-row-wrap')?.querySelector('.craft-panel');
      if (panel) panel.classList.toggle('open');
      btn.classList.toggle('active');
    });
  });

}

function openModal(entity, pushHistory = true) {
  if (_activeViewer) { _activeViewer.destroy(); _activeViewer = null; }
  modalContent.innerHTML = '';
  if (activeTab === 'monstres') renderMobSheet(entity);
  else                          renderPNJSheet(entity);
  attachModalHandlers();

  modalOverlay.style.top = '0';
  modalOverlay.classList.add('open');

  if (pushHistory) {
    pushHash(activeTab, entity.id);
  }
}

function _closeModalDOM() {
  if (_activeViewer) { _activeViewer.destroy(); _activeViewer = null; }
  modalOverlay.classList.remove('open');
}

function closeModal() {
  _closeModalDOM();
  history.replaceState({ tab: activeTab, entityId: null }, '', `#${activeTab}`);
}

modalCloseBtn.addEventListener('click', closeModal);
// Remplace le handler existant
modalOverlay.addEventListener('click', e => {
  if (e.target !== modalOverlay) return;
  closeModal();
  modalOverlay.style.pointerEvents = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el) el.click();
  modalOverlay.style.pointerEvents = '';
});
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

let _fullscreenViewer = null;

function _openFullscreen3D(mob) {
  const existing = document.getElementById('mob-3d-fullscreen-overlay');
  if (existing) existing.remove();
  if (_fullscreenViewer) { _fullscreenViewer.destroy(); _fullscreenViewer = null; }

  const overlay = document.createElement('div');
  overlay.id = 'mob-3d-fullscreen-overlay';
  overlay.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    z-index: 99999;
    background: rgba(0,0,0,.92);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  `;

  const inner = document.createElement('div');
  inner.style.cssText = `
    position: relative;
    width: calc(100% - 80px);
    height: calc(100% - 80px);
    background: rgba(13,13,26,.95);
    border: 1px solid rgba(255,255,255,.12);
    box-shadow: 0 0 80px rgba(0,0,0,.85), 0 0 0 1px rgba(224,172,96,.07);
  `;

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: 10px; right: 12px;
    z-index: 10;
    background: rgba(255,255,255,.06);
    border: 1px solid rgba(255,255,255,.15);
    color: rgba(255,255,255,.5);
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    width: 28px; height: 28px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  `;

  const container = document.createElement('div');
  container.style.cssText = `width: 100%; height: 100%;`;

  const hint = document.createElement('p');
  hint.textContent = 'Clic + glisser pour tourner · Échap pour fermer';
  hint.style.cssText = `
    margin-top: 12px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: rgba(255,255,255,.3);
    letter-spacing: .08em;
  `;

  inner.appendChild(closeBtn);
  inner.appendChild(container);
  overlay.appendChild(inner);
  overlay.appendChild(hint);
  document.body.appendChild(overlay);

  // Lancer le viewer après que le DOM soit rendu
  requestAnimationFrame(() => {
    _fullscreenViewer = new MonstreViewer3D(container, { autoRotate: true });
    _fullscreenViewer.chargerDepuisData(mob);
  });

  const close = () => {
    if (_fullscreenViewer) { _fullscreenViewer.destroy(); _fullscreenViewer = null; }
    overlay.remove();
    document.removeEventListener('keydown', onKey);
  };

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  closeBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
}

/* ── Fiche Monstre ── */
function renderMobSheet(mob) {
  const tc = TYPE_COLORS[mob.type] || { bg:'#333', text:'#aaa', border:'#44444455' };

  const has3D = mob.morceaux && mob.morceaux.length > 0;
  const imgContent = has3D
    ? `<div id="mob-3d-container" class="mob-3d-container" style="position:relative;">
        <button class="btn-expand-3d" id="btn-expand-3d" title="Agrandir le modèle 3D">⛶</button>
      </div>`
    : mob.img
      ? `<img src="${mob.img}" alt="${mob.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="mob-img-placeholder" style="display:none">👾</span>`
      : `<span class="mob-img-placeholder">👾</span>`;

  let attacksHTML = '';
  if (mob.attacks && mob.attacks.length > 0) {
    attacksHTML = `
      <div class="mob-section">
        <div class="mob-section-title">Attaques</div>
        <div class="mob-attacks-list">
          ${mob.attacks.map(a => `
            <div class="mob-attack-row">
              <div class="attack-name">${a.name}${a.dmg && a.dmg!=='—' ? ` <span class="attack-dmg">[ ${a.dmg} ]</span>` : ''}</div>
              ${a.desc ? `<div class="attack-desc">${a.desc}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  let lootHTML = '';
  if (mob.loot && mob.loot.length > 0) {
    const rows = mob.loot.map(l => {
      const item  = findItem(l.id);
      const name  = item ? item.name : (l.name || l.id);
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item?.img || item?.image || '';
      const rc    = dropRateColor(l.chance);
      const href  = item ? `../Compendium/compendium.html#${item.id}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img src="${img}" alt="${name}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      const hasCraft = item?.craft && item.craft.length > 0;
      const craftIngredients = hasCraft ? item.craft.map(c => {
        const ing      = findItem(c.id);
        const ingName  = ing ? ing.name : c.id;
        const ingColor = ing ? getRarityColor(ing.rarity) : '#8c8c8c';
        const ingImg   = ing?.img || '';
        const ingHref  = ing ? `../Compendium/compendium.html#${ing.id}` : '#';
        const ingImgPart = ingImg
          ? `<div class="loot-img-wrap"><img src="${ingImg}" alt="${ingName}" onerror="this.style.display='none'"></div>`
          : `<span class="loot-dot" style="background:${ingColor}"></span>`;
        return `<a class="loot-row craft-ingredient-row" href="${ingHref}">
          ${ingImgPart}
          <span class="loot-name" style="color:${ingColor}">${ingName}</span>
          <span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${c.qty}</span>
        </a>`;
      }).join('') : '';
      return `
        <div class="loot-row-wrap">
          <a class="loot-row" href="${href}">
            ${imgPart}
            <span class="loot-name" style="color:${color}">${name}</span>
            ${l.qty ? `<span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${l.qty}</span>` : ''}
            <span class="loot-drop-rate" style="color:${rc};border-color:${rc}33">${l.chance ?? '?'}%</span>
          </a>
          ${hasCraft ? `<div class="craft-panel">${craftIngredients}</div>` : ''}
        </div>`;
    }).join('');
    lootHTML = `
      <div class="mob-section">
        <div class="mob-section-title">Butin</div>
        <div class="mob-loot-list">${rows}</div>
      </div>`;
  }

  const loreHTML = mob.lore ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">Lore</div>
      <blockquote class="mob-lore">${mob.lore}</blockquote>
    </div>` : '';

  const bcolor = BEHAVIOR_COLORS[mob.behavior] || '#888';

  const spawnBadgeHTML = (() => {
    if (!mob.spawnTime) return '';
    const st = mob.spawnTime;
    const label = typeof st === 'string' ? st : (st.max ? `${st.min}–${st.max} min` : `${st.min} min`);
    return `<div class="mob-spawn-badge">⏱ ${label}</div>`;
  })();

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:${tc.text};border-color:${tc.border};">
          <div class="mob-image-bg" style="background:${tc.bg};"></div>
          <div class="mob-image-border" style="border-color:${tc.border};"></div>
          <div class="mob-image-inner">${imgContent}</div>
        </div>
        <div class="mob-header-info">
          <div class="mob-name-row">
            <div class="mob-name">${mob.name}</div>
            ${spawnBadgeHTML}
          </div>
          <div class="mob-badge-row">
            <span class="mob-type-badge" style="background:${tc.bg};color:${tc.text};border:1px solid ${tc.border};">${TYPE_LABELS[mob.type]||mob.type}</span>
            <span class="mob-behavior-badge" style="color:${bcolor};border-color:${bcolor}44;">${BEHAVIOR_LABELS[mob.behavior]||mob.behavior}</span>
          </div>
          <div class="mob-meta-row">
            <div class="mob-meta-item">
              <span class="mob-meta-key">Palier</span>
              <span class="mob-meta-val">⬡ ${mob.palier}</span>
            </div>
            <div class="mob-meta-item">
              <span class="mob-meta-key">Difficulté</span>
              <span class="mob-meta-val" style="display:flex;align-items:center;gap:6px;">
				<span class="difficulty-stars">${diffStarsHTML(mob.difficulty)}</span>
				<span style="font-size:9px;color:var(--muted);letter-spacing:.08em">${DIFF_LABELS[mob.difficulty]||''}</span>
			  </span>
            </div>
            ${mob.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">
                ${mob.region}
                ${getMapZone(mob) ? `<a class="region-link" href="../Map/map.html#${getMapZone(mob)}">→ Carte</a>` : ''}
              </span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${attacksHTML}
        ${lootHTML}
        ${loreHTML}
      </div>
    </div>`;

  if (has3D) {
    const container = document.getElementById('mob-3d-container');
    if (container && typeof MonstreViewer3D !== 'undefined') {
      _activeViewer = new MonstreViewer3D(container, { autoRotate: false });
      _activeViewer.chargerDepuisData(mob);
    }
  }
  const expandBtn = document.getElementById('btn-expand-3d');
  if (expandBtn) {
    expandBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      _openFullscreen3D(mob);
    });
  }
}

/* ── Fiche PNJ ── */
function renderPNJSheet(pnj) {
  let sellsHTML = '';
  if (pnj.sells && pnj.sells.length > 0) {
    const hasPriceCol = pnj.sells.some(s => s.price != null);
    const hasBuyCol   = pnj.sells.some(s => s.buy   != null);

    const rows = pnj.sells.map(s => {
      const item  = findItem(s.id);
      const name  = item ? item.name : s.id;
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item?.img || item?.image || '';
      const href  = item ? `../Compendium/compendium.html#${item.id}${s.quality ? '-quality' : ''}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img src="${img}" alt="${name}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      const priceVal = hasPriceCol
        ? `<span class="pnj-val pnj-val-vente${s.price == null ? ' pnj-val-empty' : ''}">${s.price != null ? `${s.price} cols` : '—'}</span>`
        : '';
      const buyVal = hasBuyCol
        ? `<span class="pnj-val pnj-val-achat${s.buy == null ? ' pnj-val-empty' : ''}">${s.buy != null ? `${s.buy} cols` : '—'}</span>`
        : '';
      const qualityBadge = s.quality ? ' <span class="loot-quality-badge">✦</span>' : '';
      return `
        <a class="loot-row${s.quality ? ' loot-row-quality' : ''}" href="${href}">
          ${imgPart}
          <span class="loot-name" style="color:${color}">${name}${qualityBadge}</span>
          ${priceVal}${buyVal}
        </a>`;
    }).join('');

    const hdrRow = `
      <div class="pnj-sells-hdr">
        <div style="width:22px;flex-shrink:0"></div>
        <div style="flex:1"></div>
        ${hasPriceCol ? '<span class="pnj-col-hdr pnj-col-hdr-vente">Vente</span>' : ''}
        ${hasBuyCol   ? '<span class="pnj-col-hdr pnj-col-hdr-achat">Achat</span>' : ''}
      </div>`;

    sellsHTML = `
      <div class="mob-section full-width">
        <div class="mob-section-title">Marchande</div>
        <div class="mob-loot-list">
          ${hdrRow}
          ${rows}
        </div>
      </div>`;
  }

  let craftHTML = '';
  if (pnj.craft && pnj.craft.length > 0) {
    const rows = pnj.craft.map(recipe => {
      const result      = findItem(recipe.id);
      const resultName  = result ? result.name : recipe.id;
      const resultColor = result ? getRarityColor(result.rarity) : '#8c8c8c';
      const resultImg   = result?.img || result?.image || '';
      const resultHref  = result ? `../Compendium/compendium.html#${result.id}${recipe.quality ? '-quality' : ''}` : '#';
      const resultImgPart = resultImg
        ? `<div class="loot-img-wrap"><img src="${resultImg}" alt="${resultName}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${resultColor}"></span>`;
      const qualityBadge = recipe.quality ? ' <span class="loot-quality-badge">✦</span>' : '';

      const ingsHTML = (recipe.ingredients || []).map(c => {
        const ing      = findItem(c.id);
        const ingName  = ing ? ing.name : c.id;
        const ingColor = ing ? getRarityColor(ing.rarity) : '#8c8c8c';
        const ingImg   = ing?.img || ing?.image || '';
        const ingHref  = ing ? `../Compendium/compendium.html#${ing.id}` : '#';
        const ingImgPart = ingImg
          ? `<div class="loot-img-wrap"><img src="${ingImg}" alt="${ingName}" onerror="this.style.display='none'"></div>`
          : `<span class="loot-dot" style="background:${ingColor}"></span>`;
        return `
          <a class="loot-row" href="${ingHref}">
            ${ingImgPart}
            <span class="loot-name" style="color:${ingColor}">${ingName}</span>
            <span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${c.qty}</span>
          </a>`;
      }).join('');

      return `
        <div class="craft-recipe-row">
          <a class="craft-result-cell${recipe.quality ? ' loot-row-quality' : ''}" href="${resultHref}">
            ${resultImgPart}
            <span class="loot-name" style="color:${resultColor}">${resultName}${qualityBadge}</span>
            ${recipe.time ? `<span class="craft-timer">⏱ ${recipe.time}</span>` : ''}
          </a>
          <div class="craft-ings-col">
            ${ingsHTML}
          </div>
        </div>`;
    }).join('');

    craftHTML = `
      <div class="mob-section full-width">
        <div class="mob-section-title">Fabrique</div>
        <div class="mob-loot-list">${rows}</div>
      </div>`;
  }

  const loreHTML = pnj.lore ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">Description</div>
      <blockquote class="mob-lore">${pnj.lore}</blockquote>
    </div>` : '';

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:#ffd9a0;border-color:#c06c2055;">
          <div class="mob-image-bg" style="background:rgba(100,80,30,.85);"></div>
          <div class="mob-image-border" style="border-color:#c06c2055;"></div>
          <div class="mob-image-inner">
            ${pnj.img ? `<img src="${pnj.img}" alt="${pnj.name}">` : '<span class="mob-img-placeholder">🧑</span>'}
          </div>
        </div>
        <div class="mob-header-info">
          <div class="mob-name">${pnj.name}</div>
          <div class="mob-badge-row">
            <span class="mob-type-badge" style="background:${pnj.tag ? PNJ_TAG_COLORS[pnj.tag]+'22' : 'rgba(100,80,30,.85)'};color:${pnj.tag ? PNJ_TAG_COLORS[pnj.tag] : '#ffd9a0'};border:1px solid ${pnj.tag ? PNJ_TAG_COLORS[pnj.tag]+'55' : '#c06c2055'};">${PNJ_TAG_LABELS[pnj.tag]||pnj.tag||'PNJ'}</span>
          </div>
          <div class="mob-meta-row">
            <div class="mob-meta-item">
              <span class="mob-meta-key">Palier</span>
              <span class="mob-meta-val">⬡ ${pnj.palier}</span>
            </div>
            ${pnj.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">
                ${pnj.region}
                ${getMapZone(pnj) ? `<a class="region-link" href="../Map/map.html#${getMapZone(pnj)}">→ Carte</a>` : ''}
              </span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${sellsHTML}
		${craftHTML}
        ${loreHTML}
      </div>
    </div>`;
}

/* ══════════════════════════════════
   HEADER TITRE
══════════════════════════════════ */
function updateHeader() {
  if (activeTab === 'monstres') {
    mainTitle.textContent    = 'Bestiaire';
    mainSubtitle.textContent = '// MONSTRES · VEILLEURS AU CLAIR DE LUNE';
  } else {
    mainTitle.textContent    = 'Personnages';
    mainSubtitle.textContent = '// PNJ & VENDEURS · VEILLEURS AU CLAIR DE LUNE';
  }
}

/* ══════════════════════════════════
   REFRESH GLOBAL
══════════════════════════════════ */
function refreshAll() {
  updateHeader();
  updateSidebarSections();
  buildPalierFilters();
  updateCounts();
  buildGrid();
}

/* ══════════════════════════════════
   ÉVÉNEMENTS
══════════════════════════════════ */

// Onglets
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab    = btn.dataset.tab;
    activePalier = 'all';
    pushHash(activeTab);
    refreshAll();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  updateCounts();
  buildGrid();
});

document.querySelectorAll('.type-filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) activeTypes.add(cb.value);
    else            activeTypes.delete(cb.value);
    updateCounts();
    buildGrid();
  });
});

document.querySelectorAll('.pnj-tag-filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) activePnjTags.add(cb.value);
    else            activePnjTags.delete(cb.value);
    updateCounts();
    buildGrid();
  });
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */

function setLayout() {
  const header = document.querySelector('.site-header');
  const layout = document.querySelector('.bestiaire-layout');
  if (header && layout) {
    layout.style.top = header.getBoundingClientRect().height + 'px';
  }
}
setLayout();
window.addEventListener('resize', setLayout);

history.replaceState({ tab: activeTab, entityId: null }, '', location.hash || `#${activeTab}`);
refreshAll();
applyHash();