/* ══════════════════════════════════════════════════════════════
   BESTIAIRE — Veilleurs au Clair de Lune
══════════════════════════════════════════════════════════════ */

// escHtml → défini globalement dans /utils.js (function au top-level classique)

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
  await ensureThree();
  while (_captureQueue.length > 0) {
    const { card, mob } = _captureQueue.shift();
    if (card._stale) continue;   // carte remplacée entre-temps (données mises à jour)
    try {
      const url = await MonstreViewer3D.captureStatic(mob, 200);
      const wrap = card.querySelector('.card-img-wrap');
      if (!wrap) continue;
      wrap.querySelector('img')?.remove();
      wrap.querySelector('.card-img-placeholder')?.remove();
      const snap = document.createElement('img');
      snap.className = 'loaded';
      snap.src = url;
      snap.alt = mob.name;
      wrap.insertBefore(snap, wrap.firstChild);
    } catch(e) {
      console.warn('[capture3D]', mob.id, e);
    } finally {
      card.classList.remove('is-capturing');   // en cas d'échec, le « ? » réapparaît
    }
  }
  _captureRunning = false;
}
let activePalier   = 'all';
const ALL_TYPES      = ['boss', 'mini_boss', 'monstre', 'sbire', 'worldboss'];
const ALL_BEHAVIORS  = ['agressif', 'neutre', 'passif'];
let activeTypes      = new Set(ALL_TYPES);
let activeBehaviors  = new Set(ALL_BEHAVIORS);
let activeRegions    = null;   // null = toutes ; sinon Set des régions retenues (1er clic exclusif, comme les catégories PNJ)
let activePnjTags    = new Set(Object.keys(typeof PNJ_TAG_LABELS !== 'undefined' ? PNJ_TAG_LABELS : {}));
let searchQuery      = '';
let activeSort       = (() => { try { return localStorage.getItem('vcl_bestiaire_sort') || 'default'; } catch { return 'default'; } })();

// Accent des cartes par type (halo, bordure, dégradé) et intensité : boss/worldboss > mini-boss > le reste
const TYPE_ACCENT = { boss: '#e05555', worldboss: '#38bdf8', mini_boss: '#d86f6f', monstre: '#e09050', sbire: '#8090c0' };
const TYPE_TIER   = { boss: 'tier-boss', worldboss: 'tier-boss', mini_boss: 'tier-mini' };
const REDUCED_MOTION = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

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
const behaviorSection = document.getElementById('behavior-block');
const regionSection = document.getElementById('region-block');
const regionFilters = document.getElementById('region-filters');
const mainTagline   = document.getElementById('main-tagline');
const sortSelect    = document.getElementById('sort-select');
const activeFiltersEl = document.getElementById('active-filters');

/* ── Sélecteur taille de cartes ── */
(function initCardSize() {
  const saved = localStorage.getItem('vcl_bestiaire_size') || 'medium';
  if (saved !== 'medium') entityGrid.classList.add('size-' + saved);
  const btns = document.getElementById('card-size-btns');
  if (btns) {
    const mark = size => btns.querySelectorAll('.card-size-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.size === size);
      b.setAttribute('aria-pressed', String(b.dataset.size === size));
    });
    mark(saved);
    btns.addEventListener('click', e => {
      const btn = e.target.closest('.card-size-btn');
      if (!btn) return;
      const size = btn.dataset.size;
      entityGrid.className = entityGrid.className.replace(/\bsize-\w+\b/g, '').trim();
      if (size !== 'medium') entityGrid.classList.add('size-' + size);
      mark(size);
      localStorage.setItem('vcl_bestiaire_size', size);
    });
  }
})();

function getMapZone(entity) {
  return entity.mapZone || null;
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
// normalize + getRarityColor → définis dans /utils.js
// Index lazy des items, reconstruit automatiquement quand ITEMS grandit
// (Firestore peut repopuler le tableau de façon asynchrone via db-loader).
let _itemsIndex = null;
let _itemsIndexSize = -1;
function findItem(id) {
  if (typeof ITEMS === 'undefined') return null;
  if (!_itemsIndex || _itemsIndexSize !== ITEMS.length) {
    _itemsIndex = new Map(ITEMS.map(i => [i.id, i]));
    _itemsIndexSize = ITEMS.length;
  }
  return _itemsIndex.get(id) || null;
}

// Lazy-load THREE.js (utilisé uniquement par MonstreViewer3D pour les mobs 3D).
// Permet d'éviter les ~600 KB au chargement initial de la page.
let _threeLoader = null;
function ensureThree() {
  if (typeof THREE !== 'undefined') return Promise.resolve();
  if (_threeLoader) return _threeLoader;
  _threeLoader = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _threeLoader;
}
function getRegionLabel(id) {
  if (!id) return '';
  if (window._regionIndex) {
    const label = window._regionIndex.get(id);
    if (label) return label;
  }
  // Fallback : convertit snake_case → mots capitalisés
  return id.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
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
    const entity = list.find(e => (e.id || e._id) === entityId) || list.find(e => (e.id || e._id)?.startsWith(entityId + '_'));
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
  const entity = list.find(e => (e.id || e._id) === state.entityId) || list.find(e => (e.id || e._id)?.startsWith(state.entityId + '_'));
  if (entity) openModal(entity, false);
});

/* ══════════════════════════════════
   FILTRAGE
══════════════════════════════════ */
function getList() { return activeTab === 'monstres' ? MOBS : PERSONNAGES; }

function getPnjEffectiveTag(e) {
  if (e.occulte === true) return 'marchand_occulte';
  if (e.type === 'artisan_runes' || e.type === 'artisan_runes') return 'artisan_runes';
  if (e.tag === 'fabricant_secrets' || e.tag === 'fabricant_secret') return 'forgeron_items_secrets';
  return e.tag;
}

function getFiltered() {
  const q = normalize(searchQuery);
  const filtered = getList().filter(e => {
    if (e.sensible) {
      const canSee = activeTab === 'monstres' ? window._vcl_can_view_sensible : window._vcl_can_view_sensible_pnj;
      if (!canSee) return false;
    }
    if (q && !fuzzyMatch(q, e.name, e.sensible === true) && !fuzzyMatch(q, getRegionLabel(e.region||'')) && !fuzzyMatch(q, e.region||'') && !fuzzyMatch(q, e.lore||'', e.sensible === true)) return false;
    if (activePalier !== 'all' && e.palier !== activePalier) return false;
    if (activeTab === 'monstres') {
      if (!activeTypes.has(e.type)) return false;
      if (e.behavior && !activeBehaviors.has(e.behavior)) return false;
      if (activeRegions && !activeRegions.has(e.region || '')) return false;
    } else {
      const tag = getPnjEffectiveTag(e);
      if (tag && !activePnjTags.has(tag)) return false;
    }
    return true;
  });

  if (activeTab === 'personnages') {
    // Tri PNJ aligné sur le panel modération : palier → ordre des régions (manuel)
    //                                          → ordre des PNJ → nom
    // Les régions sont identifiées par `region` (= name humain), pas par id.
    // _regionOrderIndex est indexé par id ; on cherche d'abord par id, sinon par name.
    const regionOrderByName = (() => {
      if (!window._regionOrderIndex || !window._regionIndex) return null;
      const map = new Map();
      for (const [id, ordre] of window._regionOrderIndex) {
        const name = window._regionIndex.get(id) || id;
        map.set(name, ordre);
        map.set(id, ordre);
      }
      return map;
    })();
    const regOrd = (e) => {
      if (!e.region) return 9999;
      return regionOrderByName?.get(e.region) ?? 9999;
    };
    filtered.sort((a, b) => {
      if (a.palier !== b.palier) return a.palier - b.palier;
      const ra = regOrd(a), rb = regOrd(b);
      if (ra !== rb) return ra - rb;
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  } else {
    filtered.sort((a, b) => {
      if (a.palier !== b.palier) return a.palier - b.palier;
      if (a.ordre != null && b.ordre != null) return a.ordre - b.ordre;
      if (a.ordre != null) return -1;
      if (b.ordre != null) return 1;
      return normalize(a.name).localeCompare(normalize(b.name));
    });
  }

  // Tri choisi : s'applique par-dessus l'ordre ci-dessus (tri stable → l'ordre du jeu reste le critère secondaire)
  const byName = (a, b) => normalize(a.name).localeCompare(normalize(b.name));
  if (activeSort === 'name')           filtered.sort(byName);
  else if (activeSort === 'name-desc') filtered.sort((a, b) => byName(b, a));
  else if (activeSort === 'type') {
    const order = ['worldboss', 'boss', 'mini_boss', 'monstre', 'sbire'];
    filtered.sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  } else if (activeSort === 'region') {
    const regKey = e => e.region ? normalize(getRegionLabel(e.region)) : '￿';   // sans région → à la fin
    filtered.sort((a, b) => regKey(a).localeCompare(regKey(b)));
  }
  return filtered;
}

/* ══════════════════════════════════
   COMPTEURS SIDEBAR
══════════════════════════════════ */
function updateCounts() {
  if (activeTab === 'monstres') {
    const list = MOBS.filter(e => activePalier === 'all' || e.palier === activePalier);
    const q    = normalize(searchQuery);
    const filtered = q ? list.filter(e =>
      fuzzyMatch(q, e.name) || fuzzyMatch(q, e.region||'')
    ) : list;
    ALL_TYPES.forEach(t => {
      const el = document.getElementById(`count-${t}`);
      if (el) el.textContent = filtered.filter(e => e.type === t).length;
    });
    ALL_BEHAVIORS.forEach(b => {
      const el = document.getElementById(`count-beh-${b}`);
      if (el) el.textContent = filtered.filter(e => e.behavior === b).length;
    });
    regionFilters.querySelectorAll('[data-region-count]').forEach(el => {
      el.textContent = filtered.filter(e => (e.region || '') === el.dataset.regionCount).length;
    });
  } else {
    const list = PERSONNAGES.filter(e => activePalier === 'all' || e.palier === activePalier);
    const q    = normalize(searchQuery);
    const filtered = q ? list.filter(e =>
      fuzzyMatch(q, e.name) || fuzzyMatch(q, e.region||'')
    ) : list;
        Object.keys(PNJ_TAG_LABELS).forEach(tag => {
      const el = document.getElementById(`count-${tag}`);
      if (el) el.textContent = filtered.filter(e => getPnjEffectiveTag(e) === tag).length;
    });
    const groupExtras = { forgeron: ['refaconneur', 'fabricant_cles'], marchand: ['repreneur_butin', 'marchand_occulte'] };
    ['forgeron', 'marchand'].forEach(cat => {
      const el = document.getElementById(`group-count-${cat}`);
      if (el) el.textContent = filtered.filter(e => {
        const tag = getPnjEffectiveTag(e);
        return tag && (tag.startsWith(cat) || (groupExtras[cat]||[]).includes(tag));
      }).length;
    });

  }
}

/* ══════════════════════════════════
   SIDEBAR — BLOCS COLLAPSE
══════════════════════════════════ */
// Activable à la souris comme au clavier (Entrée / Espace)
function onActivate(el, fn) {
  el.setAttribute('role', 'button');
  el.tabIndex = 0;
  el.addEventListener('click', fn);
  el.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(e); }
  });
}

function setBlockOpen(header, body, open) {
  header.classList.toggle('open', open);
  body.classList.toggle('open', open);
  header.setAttribute('aria-expanded', String(open));
}
const _userToggled = new Set();   // blocs que le visiteur a ouverts/fermés lui-même (on n'y touche plus)
function initCollapsible(headerId, bodyId) {
  const header = document.getElementById(headerId);
  const body   = document.getElementById(bodyId);
  if (!header || !body) return;
  header.setAttribute('aria-expanded', String(body.classList.contains('open')));
  onActivate(header, () => {
    _userToggled.add(headerId);
    setBlockOpen(header, body, !body.classList.contains('open'));
  });
}
initCollapsible('palier-block-header',   'palier-block-body');
initCollapsible('type-block-header',     'type-block-body');
initCollapsible('behavior-block-header', 'behavior-block-body');
initCollapsible('region-block-header',   'region-block-body');
initCollapsible('pnj-tag-block-header',  'pnj-tag-block-body');

document.querySelectorAll('.pnj-cat-header').forEach(header => {
  onActivate(header, () => {
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

  // Un seul palier : le bloc n'apporte rien, on le replie (sauf si le visiteur l'a ouvert lui-même)
  if (!_userToggled.has('palier-block-header')) {
    setBlockOpen(document.getElementById('palier-block-header'), document.getElementById('palier-block-body'), paliers.length > 1);
  }
}

// Régions des monstres : liste dynamique, case cochée = région affichée
function buildRegionFilters() {
  const regions = [...new Set(MOBS.map(e => e.region || '').filter(Boolean))]
    .sort((a, b) => getRegionLabel(a).localeCompare(getRegionLabel(b), 'fr'));
  regionFilters.innerHTML = '';
  regions.forEach(r => {
    const row = document.createElement('label');
    row.className = 'bfilter-row';
    row.innerHTML = `
      <input type="checkbox" class="region-filter-cb" value="${escHtml(r)}" ${!activeRegions || activeRegions.has(r) ? 'checked' : ''} />
      <span class="bfilter-dot bfilter-region"></span>
      <span class="bfilter-label">${escHtml(getRegionLabel(r))}</span>
      <span class="bfilter-count" data-region-count="${escHtml(r)}"></span>`;
    row.querySelector('input').addEventListener('change', e => {
      const value = e.target.value;
      if (!activeRegions) activeRegions = new Set([value]);
      else if (activeRegions.has(value)) activeRegions.delete(value);
      else activeRegions.add(value);
      if (activeRegions.size === 0) activeRegions = null;
      _syncRegionCheckboxes();
      updateCounts();
      buildGrid();
    });
    regionFilters.appendChild(row);
  });
  // Le bloc n'a pas d'intérêt tant qu'il n'y a qu'une région
  regionSection.dataset.empty = regions.length > 1 ? '' : '1';
  updateSidebarSections();
}
function _syncRegionCheckboxes() {
  regionFilters.querySelectorAll('.region-filter-cb').forEach(c => { c.checked = !activeRegions || activeRegions.has(c.value); });
}

function updateSidebarSections() {
  const mobs = activeTab === 'monstres';
  typeSection.style.display     = mobs ? '' : 'none';
  behaviorSection.style.display = mobs ? '' : 'none';
  regionSection.style.display   = mobs && !regionSection.dataset.empty ? '' : 'none';
  pnjTagSection.style.display   = mobs ? 'none' : '';
}

/* ══════════════════════════════════
   GRILLE
══════════════════════════════════ */
// Cartes mises en cache : un filtre ou un tri ne recrée pas les cartes (images et captures 3D conservées)
// et les déplace en douceur (FLIP) au lieu de tout reconstruire.
const _cardCache = new Map();   // "onglet:id" → { card, sig }
let _lastGridTab = null;
let _modalOrigin = null;        // rectangle de la carte cliquée (origine de l'animation de la fiche)
let _lastFocus   = null;        // élément à refocaliser à la fermeture de la fiche

function _cardSig(e) {
  return [e.name, e.type, e.tag, e.occulte, e.palier, e.behavior, e.region, e.sensible, e.inCodex, e.images?.[0] || e.img || '', e.morceaux?.length || 0].join('|');
}

function _openFromCard(card, entity) {
  _modalOrigin = card.getBoundingClientRect();
  _lastFocus   = card;
  openModal(entity);
}

function makeCard(e) {
  const isMob = activeTab === 'monstres';
  const card = document.createElement('div');
  card.className = 'entity-card';
  card.dataset.id = e.id;
  card.tabIndex = 0;
  card.setAttribute('role', 'button');
  card.setAttribute('aria-label', e.name);

  const _eImg = e.images?.[0] || e.img;
  // Grille : miniature WebP (≈10-30 Ko au lieu de 100-560 Ko) ; si elle n'existe pas encore, on retombe sur l'image d'origine
  const _thumb = u => /\/img\/(mobs|compendium\/montages)\//.test(u || '') ? u.replace('/img/', '/img/thumbs/').replace(/\.(png|jpe?g)$/i, '.webp') : u;
  const imgHTML = _eImg
    ? `<img loading="lazy" decoding="async" src="${_thumb(_eImg)}" alt="${escHtml(e.name)}" onload="this.classList.add('loaded')" onerror="if(!this.dataset.fb&&this.src!==${JSON.stringify(_eImg).replace(/"/g, '&quot;')}){this.dataset.fb=1;this.src=${JSON.stringify(_eImg).replace(/"/g, '&quot;')}}else{this.style.display='none';this.nextElementSibling.style.display='flex'}">`
    : '';
  const phStyle = _eImg ? 'style="display:none"' : '';
  const ph = `<span class="card-img-placeholder" ${phStyle} aria-hidden="true"><span class="ph-q">?</span></span>`;

  const effTag = isMob ? null : getPnjEffectiveTag(e);
  const typeKey   = isMob ? e.type : (effTag || 'pnj');
  const typeLabel = isMob ? (TYPE_LABELS[e.type]||e.type) : (PNJ_TAG_LABELS[effTag]||effTag||'PNJ');
  const typeBadge = `<span class="card-type-badge badge-${typeKey}" style="${!isMob && effTag ? `background:${PNJ_TAG_COLORS[effTag]}22;color:${PNJ_TAG_COLORS[effTag]};border-color:${PNJ_TAG_COLORS[effTag]}55` : ''}">${typeLabel}</span>`;

  const accent = isMob ? TYPE_ACCENT[e.type] : PNJ_TAG_COLORS[effTag];
  if (accent) card.style.setProperty('--tc', accent);
  const tier = isMob ? TYPE_TIER[e.type] : '';
  if (tier) card.classList.add(tier);

  const palierBadge = `<span class="card-palier-badge">P${e.palier}</span>`;
  const codexBadge = (isMob && e.inCodex) ? `<span class="card-codex-badge">📖</span>` : '';

  let behaviorHTML = '';
  if (isMob) {
    behaviorHTML = `
      <div class="card-behavior-row beh-${e.behavior}">
        <span class="card-behavior-dot cdot-${e.behavior}"></span>
        <span class="card-behavior-text">${escHtml(BEHAVIOR_LABELS[e.behavior]||e.behavior)}</span>
      </div>`;
  } else {
    behaviorHTML = `
      <div class="card-behavior-row is-plain">
        <span class="card-behavior-text">${escHtml(getRegionLabel(e.region||''))}</span>
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
      <div class="card-name">${escHtml(e.name)}${e.sensible ? ' <span style="font-size:9px;opacity:.65;vertical-align:middle;" title="Visible grâce à votre rôle">&#x1F512;</span>' : ''}</div>
      ${behaviorHTML}
    </div>`;

  card.addEventListener('mousedown', (ev) => ev.preventDefault());
  card.addEventListener('click', () => _openFromCard(card, e));
  card.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); _openFromCard(card, e); }
  });

  if (e.morceaux && e.morceaux.length > 0 && typeof MonstreViewer3D !== 'undefined') {
    if (!_eImg) card.classList.add('is-capturing');   // reflet de chargement en attendant la capture (plutôt que le « ? »)
    _queueCapture(card, e);
  }
  return card;
}

function buildGrid() {
  const entities = getFiltered();
  renderActiveFilters();
  entityGrid.querySelectorAll('.skel-card').forEach(n => n.remove());

  if (entities.length === 0) {
    gridEmpty.style.display = 'flex';
    entityGrid.style.display = 'none';
    resultCount.textContent = '0 résultat';
    return;
  }
  const wasHidden = entityGrid.style.display === 'none';
  gridEmpty.style.display = 'none';
  entityGrid.style.display = 'grid';
  resultCount.textContent = `${entities.length} entrée${entities.length>1?'s':''}`;

  const tabChanged = _lastGridTab !== activeTab;
  _lastGridTab = activeTab;
  const animate = !REDUCED_MOTION && typeof Element.prototype.animate === 'function';

  // Positions avant le changement (FLIP) — pas à l'ouverture de la page ni au changement d'onglet
  const before = new Map();
  if (animate && !tabChanged && !wasHidden) {
    for (const c of entityGrid.children) before.set(c, c.getBoundingClientRect());
  }

  const wanted = entities.map(e => {
    const key = activeTab + ':' + (e.id || e._id);
    const sig = _cardSig(e);
    let rec = _cardCache.get(key);
    if (!rec || rec.sig !== sig) {
      if (rec) rec.card._stale = true;
      rec = { card: makeCard(e), sig };
      _cardCache.set(key, rec);
    }
    return rec.card;
  });

  // Retire ce qui n'est plus affiché, puis range dans le nouvel ordre (sans toucher aux cartes déjà bien placées)
  const wantedSet = new Set(wanted);
  for (const c of [...entityGrid.children]) if (!wantedSet.has(c)) c.remove();
  wanted.forEach((card, i) => {
    if (entityGrid.children[i] !== card) entityGrid.insertBefore(card, entityGrid.children[i] || null);
  });

  if (!animate) return;
  const vh = window.innerHeight;
  const visible = r => r.bottom > 0 && r.top < vh;
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  let n = 0;
  wanted.forEach(card => {
    const now  = card.getBoundingClientRect();
    const prev = before.get(card);
    if (prev) {
      const dx = prev.left - now.left, dy = prev.top - now.top;
      if ((dx || dy) && (visible(now) || visible(prev))) {
        card.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'none' }], { duration: 380, easing: ease });
      }
    } else if (visible(now)) {
      card.animate(
        [{ opacity: 0, transform: 'translateY(10px) scale(.96)' }, { opacity: 1, transform: 'none' }],
        { duration: 320, delay: Math.min(n++, 20) * 22, easing: ease, fill: 'backwards' }
      );
    }
  });
}

/* ══════════════════════════════════
   FILTRES ACTIFS (puces) + TRI
══════════════════════════════════ */
function _summary(labels) {
  if (labels.length === 0) return '—';
  return labels.length <= 2 ? labels.join(', ') : `${labels.slice(0, 2).join(', ')} +${labels.length - 2}`;
}

function _resetTypeFilters() {
  activeTypes = new Set(ALL_TYPES);
  document.querySelectorAll('.type-filter-cb').forEach(c => { c.checked = true; });
}
function _resetBehaviorFilters() {
  activeBehaviors = new Set(ALL_BEHAVIORS);
  document.querySelectorAll('.behavior-filter-cb').forEach(c => { c.checked = true; });
}
function _resetPnjTagFilters() {
  activePnjTags = new Set(_allPnjTags);
  _pnjTagsAllState = true;
  _syncPnjTagCheckboxes();
}

function renderActiveFilters() {
  const chips = [];
  if (searchQuery) chips.push({ k: 'Recherche', v: searchQuery, reset: () => { searchInput.value = ''; searchQuery = ''; } });
  if (activePalier !== 'all') chips.push({ k: 'Palier', v: String(activePalier), reset: () => { activePalier = 'all'; } });
  if (activeTab === 'monstres') {
    if (activeTypes.size < ALL_TYPES.length) {
      chips.push({ k: 'Type', v: _summary(ALL_TYPES.filter(t => activeTypes.has(t)).map(t => TYPE_LABELS[t])), reset: _resetTypeFilters });
    }
    if (activeBehaviors.size < ALL_BEHAVIORS.length) {
      chips.push({ k: 'Comportement', v: _summary(ALL_BEHAVIORS.filter(b => activeBehaviors.has(b)).map(b => BEHAVIOR_LABELS[b])), reset: _resetBehaviorFilters });
    }
    if (activeRegions) {
      chips.push({ k: 'Région', v: _summary([...activeRegions].map(getRegionLabel)), reset: () => { activeRegions = null; } });
    }
  } else if (!_pnjTagsAllState) {
    chips.push({ k: 'Catégorie', v: _summary([...activePnjTags].map(t => PNJ_TAG_LABELS[t] || t)), reset: _resetPnjTagFilters });
  }

  activeFiltersEl.replaceChildren();
  activeFiltersEl.style.display = chips.length ? 'flex' : 'none';
  chips.forEach(c => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'af-chip';
    b.title = 'Retirer ce filtre';
    b.innerHTML = `<span class="af-k">${c.k}</span><span class="af-v"></span><span class="af-x" aria-hidden="true">✕</span>`;
    b.querySelector('.af-v').textContent = c.v;
    b.addEventListener('click', () => { c.reset(); refreshAll(); });
    activeFiltersEl.appendChild(b);
  });
  if (chips.length > 1) {
    const clear = document.createElement('button');
    clear.type = 'button';
    clear.className = 'af-clear';
    clear.textContent = 'Tout réinitialiser';
    clear.addEventListener('click', () => { chips.forEach(c => c.reset()); refreshAll(); });
    activeFiltersEl.appendChild(clear);
  }
}

const SORT_OPTIONS = {
  monstres: [
    ['default',   'Ordre par défaut'],
    ['name',      'Nom (A → Z)'],
    ['name-desc', 'Nom (Z → A)'],
    ['type',      "Type (boss d'abord)"],
    ['region',    'Région'],
  ],
  personnages: [
    ['default',   'Ordre par défaut'],
    ['name',      'Nom (A → Z)'],
    ['name-desc', 'Nom (Z → A)'],
    ['region',    'Région'],
  ],
};
function buildSortOptions() {
  const opts = SORT_OPTIONS[activeTab];
  if (!opts.some(([v]) => v === activeSort)) activeSort = 'default';   // ex. « Type » n'existe pas pour les PNJ
  sortSelect.replaceChildren(...opts.map(([v, label]) => {
    const o = document.createElement('option');
    o.value = v;
    o.textContent = label;
    return o;
  }));
  sortSelect.value = activeSort;
}

/* Braises : quelques points lumineux qui montent lentement derrière les cartes */
function initEmbers() {
  if (REDUCED_MOTION) return;
  const main = document.querySelector('.bestiaire-main');
  if (!main || main.querySelector('.embers')) return;
  const box = document.createElement('div');
  box.className = 'embers';
  box.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 14; i++) {
    const s = document.createElement('span');
    s.style.setProperty('--x',  (4 + Math.random() * 92).toFixed(1) + '%');
    s.style.setProperty('--s',  (1.5 + Math.random() * 2.5).toFixed(1) + 'px');
    s.style.setProperty('--t',  (14 + Math.random() * 14).toFixed(1) + 's');
    s.style.setProperty('--dl', (-Math.random() * 24).toFixed(1) + 's');
    s.style.setProperty('--dx', (-40 + Math.random() * 80).toFixed(0) + 'px');
    box.appendChild(s);
  }
  main.prepend(box);
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
  if (activeTab === 'monstres') {
    renderMobSheet(entity);
    window._vclLogContentView?.('mob', entity.id || entity._id, entity.name);
  } else {
    renderPNJSheet(entity);
    window._vclLogContentView?.('pnj', entity.id || entity._id, entity.name);
  }
  attachModalHandlers();
  // Bouton « Signaler une erreur » avec le contexte de la fiche
  modalContent.insertAdjacentHTML('beforeend', `<div class="vcl-fiche-report-wrap">${window.vclReportFicheHtml?.(activeTab === 'monstres' ? 'mob' : 'pnj', entity.id || entity._id, entity.name) || ''}</div>`);

  modalOverlay.style.top = '0';
  modalOverlay.classList.add('open');

  // La fiche « sort » de la carte cliquée : origine de l'animation = centre de la carte
  const modalEl = document.getElementById('mob-modal');
  if (modalEl) {
    modalEl.style.animation = 'none';   // le rectangle est lu sans transformation d'entrée
    if (_modalOrigin) {
      const m = modalEl.getBoundingClientRect();
      modalEl.style.transformOrigin = `${_modalOrigin.left + _modalOrigin.width / 2 - m.left}px ${_modalOrigin.top + _modalOrigin.height / 2 - m.top}px`;
    } else {
      modalEl.style.transformOrigin = '';
    }
    void modalEl.offsetWidth;
    modalEl.style.animation = '';       // relance l'animation, même si une fiche était déjà ouverte
  }
  _modalOrigin = null;
  modalCloseBtn.focus({ preventScroll: true });

  if (pushHistory) {
    pushHash(activeTab, entity.id || entity._id);
  }
}

function _closeModalDOM() {
  if (_activeViewer) { _activeViewer.destroy(); _activeViewer = null; }
  const wasOpen = modalOverlay.classList.contains('open');
  modalOverlay.classList.remove('open');
  if (wasOpen && _lastFocus?.isConnected) _lastFocus.focus({ preventScroll: true });   // le clavier reprend là où il était
  _lastFocus = null;
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

  // Lancer le viewer après que le DOM soit rendu (et THREE chargé)
  requestAnimationFrame(async () => {
    await ensureThree();
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
    : (mob.images?.[0] || mob.img)
      ? `<img loading="lazy" decoding="async" src="${mob.images?.[0] || mob.img}" alt="${escHtml(mob.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><span class="mob-img-placeholder" style="display:none"><span class="ph-q">?</span></span>`
      : `<span class="mob-img-placeholder"><span class="ph-q">?</span></span>`;

  let attacksHTML = '';
  if (mob.attacks && mob.attacks.length > 0) {
    attacksHTML = `
      <div class="mob-section">
        <div class="mob-section-title">Attaques</div>
        <div class="mob-attacks-list">
          ${mob.attacks.map(a => `
            <div class="mob-attack-row">
              <div class="attack-name">${escHtml(a.name)}${a.dmg && a.dmg!=='—' ? ` <span class="attack-dmg">[ ${escHtml(a.dmg)} ]</span>` : ''}</div>
              ${a.desc ? `<div class="attack-desc">${escHtml(a.desc)}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  let lootHTML = '';
  // Filtrer les drops pointant vers un item absent de la collection publique
  // (item sensible → items_hidden, invisible au public).
  const visibleLoot = (mob.loot || []).filter(l => !!findItem(l.id));
  if (visibleLoot.length > 0) {
    const rows = visibleLoot.map(l => {
      const item  = findItem(l.id);
      const name  = item ? item.name : (l.name || l.id);
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item ? (getItemImg(item) || '') : '';
      const rc    = dropRateColor(l.chance);
      const href  = item ? `../Compendium/compendium.html#${escHtml(item.id)}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${img}" alt="${escHtml(name)}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      const hasCraft = item?.craft && item.craft.length > 0;
      const craftIngredients = hasCraft ? item.craft.map(c => {
        const ing      = findItem(c.id);
        const ingName  = ing ? ing.name : c.id;
        const ingColor = ing ? getRarityColor(ing.rarity) : '#8c8c8c';
        const ingImg   = ing ? (getItemImg(ing) || '') : '';
        const ingHref  = ing ? `../Compendium/compendium.html#${escHtml(ing.id)}` : '#';
        const ingImgPart = ingImg
          ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${ingImg}" alt="${escHtml(ingName)}" onerror="this.style.display='none'"></div>`
          : `<span class="loot-dot" style="background:${ingColor}"></span>`;
        return `<a class="loot-row craft-ingredient-row" href="${ingHref}">
          ${ingImgPart}
          <span class="loot-name" style="color:${ingColor}">${escHtml(ingName)}</span>
          <span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${escHtml(String(c.qty))}</span>
        </a>`;
      }).join('') : '';
      return `
        <div class="loot-row-wrap">
          <a class="loot-row" href="${href}">
            ${imgPart}
            <span class="loot-name" style="color:${color}">${escHtml(name)}</span>
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
      <blockquote class="mob-lore">${escHtml(mob.lore).replace(/\n/g,'<br>')}</blockquote>
    </div>` : '';

  const bcolor = BEHAVIOR_COLORS[mob.behavior] || '#888';

  // Boss / mini-boss : liste à puces des coordonnées où il apparaît (coords + coords_more)
  const locHTML = (() => {
    if (!['boss', 'mini_boss', 'worldboss'].includes(mob.type) || mob.sensible) return '';
    const pts = [mob.coords, ...(Array.isArray(mob.coords_more) ? mob.coords_more : [])].filter(c => c && c.x != null && c.z != null)
      .filter((c, i, arr) => arr.findIndex(o => o.x === c.x && o.z === c.z) === i); // doublons masqués (même règle que la carte : un pin par point distinct en X / Z)
    if (!pts.length) return '';
    const fmt = c => `X ${c.x}${c.y ? ' · Y ' + c.y : ''} · Z ${c.z}`;
    // Chaque point est un pin de la carte (id du mob, puis id_1, id_2…) : le clic ouvre la carte centrée sur ce pin
    const mid = mob.id || mob._id;
    const href = (c, i) => `../Map/map.html?pnjId=${encodeURIComponent(i === 0 ? mid : mid + '_' + i)}`;
    return `<div class="mob-loc">
      <span class="mob-meta-key">Localisation</span>
      <ul class="mob-loc-list">${pts.map((c, i) => `<li><a class="mob-loc-link" href="${href(c, i)}" target="_blank" title="Voir sur la carte">${escHtml(fmt(c))} <span aria-hidden="true">📍</span></a></li>`).join('')}</ul>
    </div>`;
  })();

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
            <div class="mob-name">${escHtml(mob.name)}${mob.sensible ? ' <span style="font-size:11px;opacity:.65" title="Visible grâce à votre rôle">🔒</span>' : ''}</div>
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
                ${escHtml(getRegionLabel(mob.region))}
                ${getMapZone(mob) ? `<a class="region-link" href="../Map/map.html">→ Carte</a>` : ''}
              </span>
            </div>` : ''}
          </div>
          ${locHTML}
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
      ensureThree().then(() => {
        _activeViewer = new MonstreViewer3D(container, { autoRotate: false });
        _activeViewer.chargerDepuisData(mob);
      });
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
  const effTag = getPnjEffectiveTag(pnj);
  let sellsHTML = '';

  const _findItemOrSensitive = (id) => findItem(id) || (window._vcl_can_view_sensible_pnj && window._sensitiveItemsById?.get(id));
  // Inclure les items sensibles si l'utilisateur est autorisé
  const visibleSells = (pnj.sells || []).filter(s => !!_findItemOrSensitive(s.id));
  if (visibleSells.length > 0) {
    const hasPriceCol = visibleSells.some(s => s.price != null);
    const hasBuyCol   = visibleSells.some(s => s.buy   != null);

    const rows = visibleSells.map(s => {
      const item  = _findItemOrSensitive(s.id);
      const name  = item ? item.name : s.id;
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item ? (getItemImg(item) || '') : '';
      const href  = item ? `../Compendium/compendium.html#${escHtml(item.id)}${s.quality ? '-quality' : ''}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${img}" alt="${escHtml(name)}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      const priceVal = hasPriceCol
        ? `<span class="pnj-val pnj-val-vente${s.price == null ? ' pnj-val-empty' : ''}">${s.price != null ? `${s.price} cols` : '—'}</span>`
        : '';
      const buyVal = hasBuyCol
        ? `<span class="pnj-val pnj-val-achat${s.buy == null ? ' pnj-val-empty' : ''}">${s.buy != null ? `${s.buy} cols` : '—'}</span>`
        : '';
      const qualityBadge = s.quality ? ' <span class="loot-quality-badge">✦</span>' : '';
      const sensTag = !findItem(s.id) && item ? ' <span style="font-size:9px;opacity:0.65" title="Visible grâce à votre rôle">🔒</span>' : '';
      return `
        <a class="loot-row${s.quality ? ' loot-row-quality' : ''}" href="${href}">
          ${imgPart}
          <span class="loot-name" style="color:${color}">${escHtml(name)}${qualityBadge}${sensTag}</span>
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
  // Inclure les recettes sensibles si l'utilisateur est autorisé
  const visibleCraft = (pnj.craft || []).filter(r => !!_findItemOrSensitive(r.id));
  if (visibleCraft.length > 0) {
    const rows = visibleCraft.map(recipe => {
      const result      = _findItemOrSensitive(recipe.id);
      const resultName  = result
        ? (recipe.quality ? (result.quality?.name || result.name) : result.name)
        : recipe.id;
      const resultColor = result ? getRarityColor(result.rarity) : '#8c8c8c';
      const resultImg   = result
        ? (recipe.quality
            ? (result.quality?.images?.[0] || result.quality?.image || getItemImg(result) || '')
            : (getItemImg(result) || ''))
        : '';
      const resultSensTag = !findItem(recipe.id) && result ? ' <span style="font-size:9px;opacity:0.65" title="Visible grâce à votre rôle">🔒</span>' : '';
      const resultHref  = result ? `../Compendium/compendium.html#${escHtml(result.id)}${recipe.quality ? '-quality' : ''}` : '#';
      const resultImgPart = resultImg
        ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${resultImg}" alt="${escHtml(resultName)}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${resultColor}"></span>`;
      const qualityBadge = recipe.quality ? ' <span class="loot-quality-badge">✦</span>' : '';

      const ingsHTML = (recipe.ingredients || []).map(c => {
        // Monnaie (cols) : même rendu que dans le Compendium — pièce 🪙 et nom en or, sans lien
        const cur = (typeof CURRENCIES !== 'undefined') ? CURRENCIES[c.id] : null;
        if (cur) {
          return `
          <div class="loot-row craft-currency-row">
            <div class="loot-img-wrap craft-currency-ico">${cur.emoji}</div>
            <span class="loot-name" style="color:${cur.color}">${escHtml(cur.label)}</span>
            <span class="loot-drop-rate" style="color:${cur.color};border-color:${cur.color}44">×${escHtml(String(c.qty))}</span>
          </div>`;
        }
        const ing      = _findItemOrSensitive(c.id);
        const ingName  = ing ? ing.name : c.id;
        const ingColor = ing ? getRarityColor(ing.rarity) : '#8c8c8c';
        const ingImg   = ing ? (getItemImg(ing) || '') : '';
        const ingHref  = ing ? `../Compendium/compendium.html#${escHtml(ing.id)}` : '#';
        const ingImgPart = ingImg
          ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${ingImg}" alt="${escHtml(ingName)}" onerror="this.style.display='none'"></div>`
          : `<span class="loot-dot" style="background:${ingColor}"></span>`;
        return `
          <a class="loot-row" href="${ingHref}">
            ${ingImgPart}
            <span class="loot-name" style="color:${ingColor}">${escHtml(ingName)}</span>
            <span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${escHtml(String(c.qty))}</span>
          </a>`;
      }).join('');

      return `
        <div class="craft-recipe-row">
          <a class="craft-result-cell${recipe.quality ? ' loot-row-quality' : ''}" href="${resultHref}">
            ${resultImgPart}
            <span class="loot-name" style="color:${resultColor}">${escHtml(resultName)}${qualityBadge}${resultSensTag}</span>
            ${recipe.time ? `<span class="craft-timer">⏱ ${escHtml(recipe.time)}</span>` : ''}
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

  // Recyclage : le joueur donne un item (et éventuellement des cols), le PNJ rend des Pièces de Recyclage après un délai
  let recycleHTML = '';
  const recycles = (pnj.recycle || []).filter(r => r && r.id);
  if (recycles.length) {
    const cur = (typeof CURRENCIES !== 'undefined') ? CURRENCIES.pieces_recyclage : null;
    const rows = recycles.map(r => {
      const it      = _findItemOrSensitive(r.id);
      const name    = it ? it.name : r.id;
      const color   = it ? getRarityColor(it.rarity) : '#8c8c8c';
      const img     = it ? (getItemImg(it) || '') : '';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img loading="lazy" decoding="async" src="${img}" alt="${escHtml(name)}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      const href    = it ? `../Compendium/compendium.html#${escHtml(it.id)}` : '#';
      const reward  = r.reward != null ? r.reward : '?';
      const rewardHTML = `
          <div class="loot-row craft-currency-row">
            <div class="loot-img-wrap craft-currency-ico">${cur ? cur.emoji : '♻️'}</div>
            <span class="loot-name" style="color:${cur ? cur.color : '#6fc4b8'}">${escHtml(cur ? cur.label : 'Pièces de Recyclage')}</span>
            <span class="loot-drop-rate" style="color:${cur ? cur.color : '#6fc4b8'};border-color:${cur ? cur.color : '#6fc4b8'}44">×${escHtml(String(reward))}</span>
          </div>`;
      const colsCur = (typeof CURRENCIES !== 'undefined') ? CURRENCIES.cols : null;
      const costHTML = r.cost && colsCur ? `
          <div class="loot-row craft-currency-row">
            <div class="loot-img-wrap craft-currency-ico">${colsCur.emoji}</div>
            <span class="loot-name" style="color:${colsCur.color}">${escHtml(colsCur.label)}</span>
            <span class="loot-drop-rate" style="color:${colsCur.color};border-color:${colsCur.color}44">×${escHtml(String(r.cost))}</span>
          </div>` : '';
      // Lecture de gauche à droite : on DONNE l'item (+ éventuel coût en cols) → on REÇOIT les pièces, après le délai
      return `
        <div class="craft-recipe-row">
          <div class="craft-result-cell">
            <a class="loot-row" href="${href}">
              ${imgPart}
              <span class="loot-name" style="color:${color}">${escHtml(name)}</span>
              <span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${escHtml(String(r.qty || 1))}</span>
            </a>
            ${costHTML}
          </div>
          <div class="craft-ings-col">
            ${rewardHTML}
            ${r.time ? `<span class="craft-timer">⏱ ${escHtml(r.time)}</span>` : ''}
          </div>
        </div>`;
    }).join('');
    recycleHTML = `
      <div class="mob-section full-width">
        <div class="mob-section-title">Recyclage <span style="font-weight:400;opacity:.7;text-transform:none;letter-spacing:0;">— l'item donné → les pièces reçues</span></div>
        <div class="mob-loot-list">${rows}</div>
      </div>`;
  }

  const loreHTML = pnj.lore ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">Description</div>
      <blockquote class="mob-lore">${escHtml(pnj.lore).replace(/\n/g,'<br>')}</blockquote>
    </div>` : '';

  const instructionsHTML = pnj.instructions ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">📍 Accès</div>
      <p class="mob-lore" style="font-style:normal;margin:0;">${escHtml(pnj.instructions).replace(/\n/g,'<br>')}</p>
    </div>` : '';

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:#ffd9a0;border-color:#c06c2055;">
          <div class="mob-image-bg" style="background:rgba(100,80,30,.85);"></div>
          <div class="mob-image-border" style="border-color:#c06c2055;"></div>
          <div class="mob-image-inner">
            ${(pnj.images?.[0] || pnj.img) ? `<img loading="lazy" decoding="async" src="${pnj.images?.[0] || pnj.img}" alt="${escHtml(pnj.name)}">` : '<span class="mob-img-placeholder"><span class="ph-q">?</span></span>'}
          </div>
        </div>
                <div class="mob-header-info">
          <div class="mob-name">${escHtml(pnj.name)}${pnj.sensible ? ' <span style="font-size:11px;opacity:.65" title="Visible grâce à votre rôle">🔒</span>' : ''}</div>
          <div class="mob-badge-row">
            <span class="mob-type-badge" style="background:${effTag ? PNJ_TAG_COLORS[effTag]+'22' : 'rgba(100,80,30,.85)'};color:${effTag ? PNJ_TAG_COLORS[effTag] : '#ffd9a0'};border:1px solid ${effTag ? PNJ_TAG_COLORS[effTag]+'55' : '#c06c2055'};">${PNJ_TAG_LABELS[effTag]||effTag||'PNJ'}</span>
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
                ${escHtml(getRegionLabel(pnj.region))}
                ${(pnj.coords && !pnj.sensible) ? `<a class="region-link" href="../Map/map.html?pnjId=${encodeURIComponent(pnj.id)}">→ Carte</a>` : ''}
              </span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${instructionsHTML}
        ${sellsHTML}
		${craftHTML}
        ${recycleHTML}
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
    mainTagline.textContent  = 'Toutes les créatures rencontrées au clair de lune : leurs attaques, leur butin et leurs repaires.';
  } else {
    mainTitle.textContent    = 'Personnages';
    mainSubtitle.textContent = '// PNJ & VENDEURS · VEILLEURS AU CLAIR DE LUNE';
    mainTagline.textContent  = 'Forgerons, marchands et artisans du monde : où les trouver et ce qu\'ils proposent.';
  }
}

/* ══════════════════════════════════
   REFRESH GLOBAL
══════════════════════════════════ */
function refreshAll() {
  updateHeader();
  updateSidebarSections();
  buildPalierFilters();
  buildRegionFilters();
  buildSortOptions();
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

document.querySelectorAll('.behavior-filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) activeBehaviors.add(cb.value);
    else            activeBehaviors.delete(cb.value);
    updateCounts();
    buildGrid();
  });
});

sortSelect.addEventListener('change', () => {
  activeSort = sortSelect.value;
  try { localStorage.setItem('vcl_bestiaire_sort', activeSort); } catch {}
  buildGrid();
});

// Filtres PNJ : 1er clic = exclusif (n'affiche que ce tag), clics suivants = additif.
// Si la sélection devient vide, on revient à l'état "tous affichés".
const _allPnjTags = new Set(Object.keys(typeof PNJ_TAG_LABELS !== 'undefined' ? PNJ_TAG_LABELS : {}));
let _pnjTagsAllState = true;

function _syncPnjTagCheckboxes() {
  document.querySelectorAll('.pnj-tag-filter-cb').forEach(c => {
    c.checked = activePnjTags.has(c.value);
  });
}

document.querySelectorAll('.pnj-tag-filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    const value = cb.value;
    if (_pnjTagsAllState) {
      activePnjTags = new Set([value]);
      _pnjTagsAllState = false;
    } else {
      if (activePnjTags.has(value)) activePnjTags.delete(value);
      else                          activePnjTags.add(value);
      if (activePnjTags.size === 0) {
        activePnjTags = new Set(_allPnjTags);
        _pnjTagsAllState = true;
      }
    }
    _syncPnjTagCheckboxes();
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

initEmbers();

window._pageInit = function () {
  history.replaceState({ tab: activeTab, entityId: null }, '', location.hash || `#${activeTab}`);
  refreshAll();
  applyHash();
};
window._vcl_bestiaire_refresh = () => { refreshAll(); applyHash(); };