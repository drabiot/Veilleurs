/* ══════════════════════════════════════════════════════════════
   QUÊTES — Veilleurs au Clair de Lune
   quetes.js
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   VARIABLES CSS — injectées en :root
   (les variables quête ne sont pas dans style.css)
══════════════════════════════════ */
(function injectCSSVars() {
  const root = document.documentElement;
  root.style.setProperty('--quete-main',     '#e07c50');
  root.style.setProperty('--quete-main-dim', 'rgba(224,124,80,.4)');
  root.style.setProperty('--quete-sec',      '#6aaad4');
  root.style.setProperty('--quete-sec-dim',  'rgba(106,170,212,.4)');
  root.style.setProperty('--quete-ter',      '#82c470');
  root.style.setProperty('--quete-ter-dim',  'rgba(130,196,112,.4)');
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
    if (activeStatut !== 'all' && e.statut !== activeStatut) return false;
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
   SIDEBAR — BLOCS COLLAPSIBLES
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
initCollapsible('palier-block-header',  'palier-block-body');
initCollapsible('zone-block-header',    'zone-block-body');
initCollapsible('statut-block-header',  'statut-block-body');

/* ══════════════════════════════════
   CONSTRUCTION FILTRES PALIER
══════════════════════════════════ */
function buildPalierFilters() {
  const list = QUETES.filter(q => q.type === activeTab);
  const paliers = [...new Set(list.map(q => q.palier))].sort((a, b) => a - b);
  palierFilters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `palier-filter-btn${activePalier === 'all' ? ' active' : ''}`;
  allBtn.innerHTML = `<span>⬡ Tous</span><span class="palier-count">${list.length}</span>`;
  allBtn.addEventListener('click', () => { activePalier = 'all'; refreshAll(); });
  palierFilters.appendChild(allBtn);

  paliers.forEach(p => {
    const count = list.filter(q => q.palier === p).length;
    const btn = document.createElement('button');
    btn.className = `palier-filter-btn${activePalier === p ? ' active' : ''}`;
    btn.innerHTML = `<span>⬡ Palier ${p}</span><span class="palier-count">${count}</span>`;
    btn.addEventListener('click', () => { activePalier = p; refreshAll(); });
    palierFilters.appendChild(btn);
  });
}

/* ══════════════════════════════════
   CONSTRUCTION FILTRES ZONE
══════════════════════════════════ */
function buildZoneFilters() {
  const zf   = document.getElementById('zone-filters');
  const list = QUETES.filter(q => q.type === activeTab);
  const zones = [...new Set(list.map(q => q.zone))].sort();

  // Reset — tout coché
  activeZones = new Set(zones);
  zf.innerHTML = '';

  zones.forEach(z => {
    const count = list.filter(q => q.zone === z).length;
    const label = document.createElement('label');
    label.className = 'bfilter-row';
    label.innerHTML = `
      <input type="checkbox" checked />
      <span class="bfilter-dot dot-zone"></span>
      <span class="bfilter-label">${z}</span>
      <span class="bfilter-count">${count}</span>`;

    const cb = label.querySelector('input');
    cb.addEventListener('change', () => {
      if (cb.checked) activeZones.add(z);
      else            activeZones.delete(z);
      buildGrid();
    });
    zf.appendChild(label);
  });
}

/* ══════════════════════════════════
   COMPTEURS STATUT
══════════════════════════════════ */
function updateStatutCounts() {
  const base = QUETES.filter(q => q.type === activeTab);
  document.getElementById('cnt-all').textContent  = base.length;
  document.getElementById('cnt-todo').textContent = base.filter(q => q.statut === 'todo').length;
  document.getElementById('cnt-done').textContent = base.filter(q => q.statut === 'done').length;
}

/* ══════════════════════════════════
   GRILLE
══════════════════════════════════ */
function buildGrid() {
  const entities = getFiltered();
  queteGrid.innerHTML = '';

  if (entities.length === 0) {
    gridEmpty.style.display  = 'flex';
    queteGrid.style.display  = 'none';
    resultCount.textContent  = '0 résultat';
    return;
  }
  gridEmpty.style.display = 'none';
  queteGrid.style.display = 'grid';
  resultCount.textContent = `${entities.length} quête${entities.length > 1 ? 's' : ''}`;

  const paliers = [...new Set(entities.map(q => q.palier))].sort((a, b) => a - b);
  let idx = 0;

  paliers.forEach(p => {
    // Séparateur palier
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

      const doneCount  = q.objectifs.filter(o => o.done).length;
      const totalCount = q.objectifs.length;
      const pct        = Math.round((doneCount / totalCount) * 100);

      card.innerHTML = `
        <div class="type-stripe"></div>
        <div class="quete-card-inner">
          <div class="card-top">
            <div class="card-title">${q.titre}</div>
            <span class="card-status-badge ${q.statut === 'done' ? 'badge-done' : 'badge-todo'}">${STATUT_LABELS[q.statut]}</span>
          </div>
          <div class="card-meta">
            <span class="ctag ctag-palier">P${q.palier}</span>
            <span class="ctag">🗺 ${q.zone}</span>
          </div>
          <p class="card-desc">${q.desc}</p>
          <div class="card-progress">
            <div class="progress-bar-wrap">
              <div class="progress-bar-fill" style="width:${pct}%"></div>
            </div>
            <span class="progress-label">${doneCount}/${totalCount}</span>
          </div>
        </div>
        <div class="card-npc-badge">🧑 ${q.npc}</div>`;

      card.addEventListener('mousedown', ev => ev.preventDefault());
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
  modalOverlay.style.top = '0';
  modalOverlay.classList.add('open');
}

function closeModal() {
  modalOverlay.classList.remove('open');
}

modalCloseBtn.addEventListener('click', closeModal);

modalOverlay.addEventListener('click', e => {
  if (e.target !== modalOverlay) return;
  closeModal();
  // Propagation du clic vers la grille
  modalOverlay.style.pointerEvents = 'none';
  const el = document.elementFromPoint(e.clientX, e.clientY);
  if (el) el.click();
  modalOverlay.style.pointerEvents = '';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

/* ── Rendu de la fiche quête ── */
function renderSheet(q) {
  const objsHTML = q.objectifs.map(o => `
    <div class="obj-item ${o.done ? 'done' : ''} obj-item-${q.type}">
      <span class="obj-check">${o.done ? '✅' : '◻'}</span>
      <span>${o.texte}</span>
    </div>`).join('');

  const rewHTML = q.recompenses.map(r => {
    const cls = r.type === 'xp'   ? 'reward-xp'
              : r.type === 'gold' ? 'reward-gold'
              : 'reward-item-r';
    return `<span class="reward-item ${cls}">${r.label}</span>`;
  }).join('');

  return `
    <div class="quest-sheet">
      <div class="quest-sheet-header">

        <div class="quest-type-icon qicon-${q.type}">${TYPE_ICONS[q.type]}</div>

        <div class="quest-sheet-info">
          <div class="quest-sheet-name">${q.titre}</div>
          <div class="quest-badge-row">
            <span class="quest-type-badge qbadge-${q.type}">${TYPE_LABELS[q.type]}</span>
            <span class="quest-status-badge ${q.statut === 'done' ? 'badge-done' : 'badge-todo'}">${STATUT_LABELS[q.statut]}</span>
          </div>
          <div class="quest-meta-row">
            <div class="quest-meta-item">
              <span class="quest-meta-key">Palier</span>
              <span class="quest-meta-val">⬡ ${q.palier}</span>
            </div>
            <div class="quest-meta-item">
              <span class="quest-meta-key">Zone</span>
              <span class="quest-meta-val">🗺 ${q.zone}</span>
            </div>
            <div class="quest-meta-item">
              <span class="quest-meta-key">PNJ</span>
              <span class="quest-meta-val">🧑 ${q.npc}</span>
            </div>
          </div>
        </div>

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
   HEADER TITRE
══════════════════════════════════ */
const TITLES = {
  main: ['Quêtes Principales',  '// PRINCIPALES · VEILLEURS AU CLAIR DE LUNE'],
  sec:  ['Quêtes Secondaires',  '// SECONDAIRES · VEILLEURS AU CLAIR DE LUNE'],
  ter:  ['Quêtes Tertiaires',   '// TERTIAIRES · VEILLEURS AU CLAIR DE LUNE'],
};

function updateHeader() {
  const [t, s] = TITLES[activeTab];
  mainTitle.textContent    = t;
  mainSubtitle.textContent = s;
}

/* ══════════════════════════════════
   ONGLETS SIDEBAR
══════════════════════════════════ */
function setActiveTab(tab) {
  activeTab    = tab;
  activePalier = 'all';
  activeStatut = 'all';
  document.querySelector('input[name="statut-filter"][value="all"]').checked = true;

  // Mise à jour classe des boutons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.classList.remove('active-main', 'active-sec', 'active-ter');
    if (btn.dataset.tab === tab) btn.classList.add(`active-${tab}`);
  });

  refreshAll();
}

/* ══════════════════════════════════
   REFRESH GLOBAL
══════════════════════════════════ */
function refreshAll() {
  updateHeader();
  buildPalierFilters();
  buildZoneFilters();
  updateStatutCounts();
  buildGrid();
}

/* ══════════════════════════════════
   ÉVÉNEMENTS
══════════════════════════════════ */

// Onglets type
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => setActiveTab(btn.dataset.tab));
});

// Recherche
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  buildGrid();
});

// Radio statut
document.querySelectorAll('input[name="statut-filter"]').forEach(rb => {
  rb.addEventListener('change', () => {
    activeStatut = rb.value;
    buildGrid();
  });
});

/* ══════════════════════════════════
   LAYOUT — comme bestiaire.js
   positionne le layout sous le header
══════════════════════════════════ */
function setLayout() {
  const header = document.querySelector('.site-header');
  const layout = document.querySelector('.quetes-layout');
  if (header && layout) {
    layout.style.top = header.getBoundingClientRect().height + 'px';
  }
}
setLayout();
window.addEventListener('resize', setLayout);

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
// Activer l'onglet par défaut (main)
document.querySelector('.sort-btn[data-tab="main"]').classList.add('active-main');
refreshAll();
