/* ══════════════════════════════════════════════════════════════
   BESTIAIRE — Veilleurs au Clair de Lune
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
let activeTab    = 'monstres';
let activePalier = 'all';
let activeTypes  = new Set(['boss', 'mini_boss', 'monstre', 'sbire']);
let searchQuery  = '';

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
    }
    return true;
  });
}

/* ══════════════════════════════════
   COMPTEURS SIDEBAR
══════════════════════════════════ */
function updateCounts() {
  if (activeTab !== 'monstres') return;

  const list = MOBS.filter(e => activePalier === 'all' || e.palier === activePalier);
  const q    = normalize(searchQuery);
  const filtered = q ? list.filter(e =>
    normalize(e.name).includes(q) || normalize(e.region||'').includes(q)
  ) : list;

  ['boss','mini_boss','monstre','sbire'].forEach(t => {
    const el = document.getElementById(`count-${t}`);
    if (el) el.textContent = filtered.filter(e => e.type === t).length;
  });
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
initCollapsible('palier-block-header', 'palier-block-body');
initCollapsible('type-block-header',   'type-block-body');

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
  typeSection.style.display = activeTab === 'monstres' ? '' : 'none';
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

    const typeKey   = isMob ? e.type : 'pnj';
    const typeLabel = isMob ? (TYPE_LABELS[e.type]||e.type) : (e.role||'PNJ');
    const typeBadge = `<span class="card-type-badge badge-${typeKey}">${typeLabel}</span>`;
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
  });
}

/* ══════════════════════════════════
   MODAL
══════════════════════════════════ */

/**
 * @param {object}  entity
 * @param {boolean} pushHistory
 */
function openModal(entity, pushHistory = true) {
  modalContent.innerHTML = '';
  if (activeTab === 'monstres') renderMobSheet(entity);
  else                          renderPNJSheet(entity);

  modalOverlay.style.top = '0';
  modalOverlay.classList.add('open');

  if (pushHistory) {
    pushHash(activeTab, entity.id);
  }
}

function _closeModalDOM() {
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

/* ── Fiche Monstre ── */
function renderMobSheet(mob) {
  const tc = TYPE_COLORS[mob.type] || { bg:'#333', text:'#aaa', border:'#44444455' };

  const imgContent = mob.img
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
      return `
        <a class="loot-row" href="${href}" ${!item?'style="pointer-events:none"':''}>
          ${imgPart}
          <span class="loot-name" style="color:${color}">${name}</span>
          ${l.qty ? `<span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${l.qty}</span>` : ''}
          <span class="loot-drop-rate" style="color:${rc};border-color:${rc}33">${l.chance}%</span>
        </a>`;
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

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:${tc.text};border-color:${tc.border};">
          <div class="mob-image-bg" style="background:${tc.bg};"></div>
          <div class="mob-image-border" style="border-color:${tc.border};"></div>
          <div class="mob-image-inner">${imgContent}</div>
        </div>
        <div class="mob-header-info">
          <div class="mob-name">${mob.name}</div>
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
              <span class="mob-meta-val">
                <span class="difficulty-stars">${diffStarsHTML(mob.difficulty)}</span>
                <span style="font-size:9px;color:var(--muted);margin-left:6px;letter-spacing:.08em">${DIFF_LABELS[mob.difficulty]||''}</span>
              </span>
            </div>
            ${mob.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">
                ${mob.region}
                ${mob.regionId ? `<a class="region-link" href="../Map/map.html#${mob.regionId}">→ Carte</a>` : ''}
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
}

/* ── Fiche PNJ ── */
function renderPNJSheet(pnj) {
  let sellsHTML = '';
  if (pnj.sells && pnj.sells.length > 0) {
    const rows = pnj.sells.map(s => {
      const item  = findItem(s.id);
      const name  = item ? item.name : s.id;
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item?.img || item?.image || '';
      const href  = item ? `../Compendium/compendium.html#${item.id}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img src="${img}" alt="${name}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      return `
        <a class="loot-row" href="${href}">
          ${imgPart}
          <span class="loot-name" style="color:${color}">${name}</span>
          ${s.price ? `<span class="loot-drop-rate" style="color:#c9a84c;border-color:#c9a84c33">${s.price} cols</span>`
                    : `<span class="loot-drop-rate" style="color:#888;border-color:#88888833">Craft</span>`}
        </a>`;
    }).join('');
    sellsHTML = `
      <div class="mob-section full-width">
        <div class="mob-section-title">Vend</div>
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
            <span class="mob-type-badge" style="background:rgba(100,80,30,.85);color:#ffd9a0;border:1px solid #c06c2055;">${pnj.role||'PNJ'}</span>
          </div>
          <div class="mob-meta-row">
            <div class="mob-meta-item">
              <span class="mob-meta-key">Palier</span>
              <span class="mob-meta-val">⬡ ${pnj.palier}</span>
            </div>
            ${pnj.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">${pnj.region}</span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${sellsHTML}
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