/* ══════════════════════════════════
   MAP2 — Moteur carte interactive v2
   Source de marqueurs : Firestore (PNJ, mobs, map_markers) + statique (régions, zones)
══════════════════════════════════ */

/* ── État ── */
const MAP_SIZE      = 900;
let currentFloor    = 1;
let currentLayer    = 'surface';
let zoomLevel       = 1;
const ZOOM_MIN      = 0.4;
const ZOOM_MAX      = 10;
const ZOOM_FACTOR   = 1.15;
const CLUSTER_RADIUS_PX = 30;

let isPanning   = false;
let panLastX    = 0;
let panLastY    = 0;
let panOffset   = { x: 0, y: 0 };
let _searchFocusId = null;

/* ── DOM ── */
const floorInput    = document.getElementById('floor-input');
const floorDisplay  = document.getElementById('floor-display');
const floorNameDisp = document.getElementById('floor-name-display');
const floorInfoNum  = document.getElementById('floor-info-num');
const wheelTrack    = document.getElementById('wheel-track');
const markersLayer  = document.getElementById('markers-layer');
const tooltip       = document.getElementById('map-tooltip');
const tooltipType   = document.getElementById('tooltip-type');
const tooltipName   = document.getElementById('tooltip-name');
const tooltipDesc   = document.getElementById('tooltip-desc');
const tooltipLink   = document.getElementById('tooltip-link');
const mapCanvas     = document.getElementById('map-canvas');
const mapViewport   = document.getElementById('map-viewport');
const zoomLevelEl   = document.getElementById('zoom-level');

/* ── Mapping PNJ type → type de marqueur carte ── */
const PNJ_TO_MARKER_TYPE = {
  "forgeron d'armes":        "artisant",
  "forgeron d'armures":      "artisant",
  "forgeron d'accessoires":  "artisant",
  "forgeron de lingots":     "artisant",
  "forgeron de clés":        "artisant",
  "forgeron d'items secrets":"artisant",
  "bûcheron":                "artisant",
  "alchimiste":              "artisant",
  "marchand d'équipement":   "marchand",
  "marchand de consommable": "marchand",
  "marchand d'outils":       "marchand",
  "marchand d'accessoires":  "marchand",
  "marchand itinérant":      "marchand",
  "repreneur de butin":      "repreneur_butin",
  "marchand occulte":        "occulte",
  "fabricant secret":        "secret",
  "quêtes":                  "quête_secondaire",
  "quête principale":        "quête_principale",
};

/* ── Emoji par type ── */
const MARKER_EMOJI = {
  région:           '📍',
  donjon:           '⚔️',
  zone_monstre:     '💀',
  ressource:        '🌿',
  artisant:         '⚒️',
  marchand:         '💰',
  repreneur_butin:  '🛒',
  occulte:          '🔮',
  secret:           '🔐',
  quête_principale: '💬',
  quête_secondaire: '❓',
  boss:             '☠️',
  miniboss:         '⚔️',
  autre:            '🦠',
};

/* ── Types qui restent statiques (data.js seulement) ── */
const STATIC_ONLY_TYPES = new Set(['région']);

/* ══════════════════════════════════
   CONVERSION COORDS FIRESTORE → MARQUEUR
══════════════════════════════════ */
function pnjToMarker(pnj) {
  if (!pnj.coords || pnj.coords.x == null || pnj.coords.z == null) return null;
  const rawName = (pnj.name || '').toLowerCase();
  return {
    id:    'pnj_' + (pnj._id || pnj.id || ''),
    type:  PNJ_TO_MARKER_TYPE[rawName] || 'autre',
    gx:    pnj.coords.x,
    gy:    pnj.coords.z,
    floor: pnj.palier ? +pnj.palier : 1,
    name:  pnj.name || pnj._id || pnj.id || '',
    desc:  pnj.region || '',
    link:  `../Bestiaire/bestiaire.html#personnages/${pnj._id || pnj.id || ''}`,
  };
}

function mobToMarker(mob) {
  if (!mob.coords || mob.coords.x == null || mob.coords.z == null) return null;
  const t = mob.type === 'boss' ? 'boss' : mob.type === 'mini_boss' ? 'miniboss' : null;
  if (!t) return null;
  return {
    id:    'mob_' + (mob._id || mob.id || ''),
    type:  t,
    gx:    mob.coords.x,
    gy:    mob.coords.z,
    floor: mob.palier ? +mob.palier : 1,
    name:  mob.name || mob._id || mob.id || '',
    desc:  mob.region || '',
    link:  `../Bestiaire/bestiaire.html#mobs/${mob._id || mob.id || ''}`,
  };
}

function fsMarkerToMarker(m) {
  return {
    ...m,
    id: 'mm_' + (m._id || m.id || ''),
  };
}

/* ══════════════════════════════════
   SOURCES DE MARQUEURS
══════════════════════════════════ */
function getStaticFloorMarkers(floor) {
  const src = typeof FLOOR_MARKERS !== 'undefined' ? FLOOR_MARKERS : {};
  const raw = (src[floor]) || [];
  const flat = [];
  for (const m of raw) {
    if (m.coords && Array.isArray(m.coords)) {
      m.coords.forEach(c => flat.push({ ...m, gx: c.gx, gy: c.gy, coords: undefined }));
    } else {
      flat.push(m);
    }
  }
  return flat;
}

function getAllMarkersForFloor(floor) {
  const staticMarkers = getStaticFloorMarkers(floor)
    .filter(m => STATIC_ONLY_TYPES.has(m.type));

  const pnjMarkers = (window._pnjMarkers || [])
    .map(pnjToMarker)
    .filter(m => m && +m.floor === +floor);

  const mobMarkers = (window._mobMarkers || [])
    .map(mobToMarker)
    .filter(m => m && +m.floor === +floor);

  const fsMarkers = (window._mapMarkersFS || [])
    .filter(m => +m.floor === +floor)
    .map(fsMarkerToMarker);

  return [...staticMarkers, ...pnjMarkers, ...mobMarkers, ...fsMarkers];
}

function getFloorZones(floor) {
  const src = typeof FLOOR_ZONES !== 'undefined' ? FLOOR_ZONES : {};
  return (src[floor]) || [];
}

/* ══════════════════════════════════
   CALIBRATION / CONVERSIONS
══════════════════════════════════ */
function pixelToGame(px, py) {
  const c = MAP_CALIBRATION[currentFloor];
  if (!c) return { x: '?', y: '?' };
  const scale = c.radiusGame / c.radiusPixel;
  return {
    x: Math.round(c.centerGame.x + (px - c.centerPixel.x) * scale),
    y: Math.round(c.centerGame.y + (py - c.centerPixel.y) * scale),
  };
}
function gameToPixel(gx, gy) {
  const c = MAP_CALIBRATION[currentFloor];
  if (!c) return { x: 0, y: 0 };
  const scale = c.radiusPixel / c.radiusGame;
  return {
    x: c.centerPixel.x + (gx - c.centerGame.x) * scale,
    y: c.centerPixel.y + (gy - c.centerGame.y) * scale,
  };
}
function imageToScreen(imgX, imgY) {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  return { x: cx + (imgX - MAP_SIZE / 2) * zoomLevel, y: cy + (imgY - MAP_SIZE / 2) * zoomLevel };
}
function screenToImage(sx, sy) {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  return { x: (sx - cx) / zoomLevel + MAP_SIZE / 2, y: (sy - cy) / zoomLevel + MAP_SIZE / 2 };
}
function gameToScreen(gx, gy) {
  return imageToScreen(gameToPixel(gx, gy).x, gameToPixel(gx, gy).y);
}

/* ══════════════════════════════════
   VIEWPORT
══════════════════════════════════ */
let _vpLeft = 0, _vpTop = 0, _vpW = 0, _vpH = 0;
function updateVpBounds() {
  const r = mapViewport.getBoundingClientRect();
  _vpLeft = Math.round(r.left);
  _vpTop  = Math.round(r.top);
  _vpW    = Math.round(r.width);
  _vpH    = Math.round(r.height);
}
function clientToVp(cx, cy) { return { x: cx - _vpLeft, y: cy - _vpTop }; }

/* ══════════════════════════════════
   TRANSFORM
══════════════════════════════════ */
function applyTransform() {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  mapCanvas.style.transform = `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoomLevel})`;
  zoomLevelEl.textContent = Math.round(zoomLevel * 100) + '%';
  renderMarkers();
}

function clampPan() {
  const maxPan = (MAP_SIZE * zoomLevel) / 2 + 200;
  panOffset.x = Math.max(-maxPan, Math.min(maxPan, panOffset.x));
  panOffset.y = Math.max(-maxPan, Math.min(maxPan, panOffset.y));
}

/* ══════════════════════════════════
   CHARGEMENT IMAGE
══════════════════════════════════ */
function loadMapImage(n, layer) {
  const mapImg = document.getElementById('map-svg');
  if (layer === 'underground') {
    mapImg.src = `../img/maps/floor-${n}_underground.png`;
  } else {
    mapImg.src = `../img/maps/floor-${n}.png`;
  }
  mapImg.style.opacity = '0';
  mapImg.onload  = () => { mapImg.style.opacity = '1'; mapImg.removeAttribute('data-missing'); };
  mapImg.onerror = () => { mapImg.src = ''; mapImg.setAttribute('data-missing', 'true'); mapImg.style.opacity = '0'; };
}

/* ══════════════════════════════════
   ÉTAGES
══════════════════════════════════ */
function goToFloor(n) {
  if (n < 1 || n > FLOOR_COUNT) return;
  currentFloor = n;
  floorDisplay.textContent  = String(n).padStart(2, '0');
  floorInfoNum.textContent  = n;
  floorNameDisp.textContent = (typeof FLOOR_NAMES !== 'undefined' && FLOOR_NAMES[n]) || '';
  floorInput.value = n;
  loadMapImage(n, currentLayer);
  updateWheelTrack(n);
  renderMarkers();
  hideTooltip();
  history.replaceState({ floor: n, layer: currentLayer }, '', `#floor-${n}-${currentLayer}`);
}

function goToLayer(layer) {
  if (layer === currentLayer) return;
  currentLayer = layer;
  loadMapImage(currentFloor, currentLayer);
  renderMarkers();
  hideTooltip();
  history.replaceState({ floor: currentFloor, layer }, '', `#floor-${currentFloor}-${layer}`);
}

/* ══════════════════════════════════
   MOLETTE
══════════════════════════════════ */
function buildWheelTrack() {
  wheelTrack.innerHTML = '';
  for (let i = 1; i <= FLOOR_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'wheel-num';
    el.textContent = i;
    el.dataset.floor = i;
    el.addEventListener('click', () => goToFloor(i));
    wheelTrack.appendChild(el);
  }
  updateWheelTrack(currentFloor);
}

function updateWheelTrack(floor) {
  const ITEM_H = 32;
  wheelTrack.querySelectorAll('.wheel-num').forEach(el => {
    el.classList.toggle('wheel-active', +el.dataset.floor === floor);
  });
  const offset = -(floor - 1) * ITEM_H + (document.querySelector('.wheel-display')?.clientHeight / 2 || 0) - ITEM_H / 2;
  wheelTrack.style.transform = `translateY(${offset}px)`;
}

/* ══════════════════════════════════
   CLUSTERING
══════════════════════════════════ */
function clusterMarkers(markers) {
  const groups = [];
  const used = new Set();
  for (let i = 0; i < markers.length; i++) {
    if (used.has(i)) continue;
    const m = markers[i];
    const s = gameToScreen(m.gx, m.gy);
    const group = [{ ...m, sx: s.x, sy: s.y }];
    used.add(i);
    for (let j = i + 1; j < markers.length; j++) {
      if (used.has(j)) continue;
      const n = markers[j];
      const sn = gameToScreen(n.gx, n.gy);
      const dx = s.x - sn.x, dy = s.y - sn.y;
      if (Math.sqrt(dx * dx + dy * dy) < CLUSTER_RADIUS_PX) {
        group.push({ ...n, sx: sn.x, sy: sn.y });
        used.add(j);
      }
    }
    groups.push(group);
  }
  return groups;
}

/* ══════════════════════════════════
   RENDU MARQUEURS
══════════════════════════════════ */
function renderMarkers() {
  markersLayer.innerHTML = '';

  const filterState = {};
  document.querySelectorAll('.marker-filter').forEach(cb => {
    filterState[cb.dataset.type] = cb.checked;
  });
  const isTypeVisible = (type) => filterState[type] !== false;

  const markers = getAllMarkersForFloor(currentFloor);

  const focusedList = _searchFocusId ? markers.filter(m => m.id === _searchFocusId) : [];

  const visible = markers.filter(m => {
    if (m.id === _searchFocusId) return false;
    return isTypeVisible(m.type);
  });

  clusterMarkers(visible).forEach(group => {
    if (group.length === 1) renderSingleMarker(group[0]);
    else                    renderCluster(group);
  });

  if (_searchFocusId) {
    markersLayer.querySelectorAll('.marker').forEach(el => el.classList.add('marker-dimmed'));
  }

  if (focusedList.length === 1) {
    const focused = focusedList[0];
    const s = gameToScreen(focused.gx, focused.gy);
    renderSingleMarker({ ...focused, sx: s.x, sy: s.y });
    const el = markersLayer.querySelector(`.marker[data-id="${focused.id}"]`);
    if (el) el.classList.remove('marker-dimmed');
  } else if (focusedList.length > 1) {
    focusedList.forEach(focused => {
      const s = gameToScreen(focused.gx, focused.gy);
      renderSingleMarker({ ...focused, sx: s.x, sy: s.y });
    });
    markersLayer.querySelectorAll(`.marker[data-id="${_searchFocusId}"]`).forEach(el => el.classList.remove('marker-dimmed'));
  }

  renderZones();
}

function renderSingleMarker(m) {
  if (!m.sx) {
    const s = gameToScreen(m.gx, m.gy);
    m = { ...m, sx: s.x, sy: s.y };
  }
  const pin = document.createElement('div');
  pin.className    = 'marker';
  pin.dataset.type = m.type;
  pin.dataset.id   = m.id;
  pin.style.left   = m.sx + 'px';
  pin.style.top    = m.sy + 'px';

  const icon = document.createElement('div');
  icon.className   = 'marker-icon';
  icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';
  pin.appendChild(icon);

  pin.addEventListener('mouseenter', () => showTooltip(m));
  pin.addEventListener('mouseleave', hideTooltip);
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    if (m.link) window.open(m.link, '_blank');
  });

  markersLayer.appendChild(pin);
}

function renderCluster(group) {
  const cx = group.reduce((s, m) => s + m.sx, 0) / group.length;
  const cy = group.reduce((s, m) => s + m.sy, 0) / group.length;

  const pin = document.createElement('div');
  pin.className = 'marker cluster-marker';
  pin.style.left = cx + 'px';
  pin.style.top  = cy + 'px';

  const dot = document.createElement('div');
  dot.className    = 'cluster-dot';
  dot.dataset.count = group.length;
  dot.textContent   = MARKER_EMOJI[group[0].type] || '📍';
  pin.appendChild(dot);

  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel * 2);
    const img = gameToPixel(group[0].gx, group[0].gy);
    panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
    clampPan();
    applyTransform();
  });

  markersLayer.appendChild(pin);
}

/* ══════════════════════════════════
   RENDU ZONES
══════════════════════════════════ */
function renderZones() {
  let svgEl = document.getElementById('zones-layer');
  if (!svgEl) {
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.id = 'zones-layer';
    svgEl.style.cssText = `
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      pointer-events:none;
      z-index:1;
      overflow:visible;
    `;
    mapViewport.appendChild(svgEl);
  }
  svgEl.innerHTML = '';

  const zoneOn = document.querySelector('.marker-filter[data-type="zone_monstre"]')?.checked;
  if (!zoneOn) return;

  const zones = getFloorZones(currentFloor);
  zones.forEach(zone => {
    const pts = zone.points.map(p => {
      const s = gameToScreen(p.gx, p.gy);
      return `${s.x},${s.y}`;
    }).join(' ');

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', pts);
    poly.setAttribute('fill', zone.color || '#ff4444');
    poly.setAttribute('fill-opacity', '0.18');
    poly.setAttribute('stroke', zone.color || '#ff4444');
    poly.setAttribute('stroke-width', '1.5');
    poly.setAttribute('stroke-opacity', '0.5');
    svgEl.appendChild(poly);
  });
}

/* ══════════════════════════════════
   TOOLTIP
══════════════════════════════════ */
function showTooltip(m) {
  tooltipType.textContent = m.type?.replace(/_/g, ' ') || '';
  tooltipName.textContent = m.name || '';
  tooltipDesc.textContent = m.desc || '';
  if (m.link) {
    tooltipLink.href = m.link;
    tooltipLink.classList.remove('hidden');
  } else {
    tooltipLink.classList.add('hidden');
  }
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  tooltip.classList.add('hidden');
}

/* ══════════════════════════════════
   RECHERCHE
══════════════════════════════════ */
function buildSearchIndex() {
  return getAllMarkersForFloor(currentFloor);
}

function setupSearch() {
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');

  input.addEventListener('input', () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { results.classList.add('hidden'); _searchFocusId = null; renderMarkers(); return; }

    const all = [];
    for (let f = 1; f <= FLOOR_COUNT; f++) {
      getAllMarkersForFloor(f).forEach(m => all.push({ ...m, _floor: f }));
    }

    const matches = all.filter(m => (m.name || '').toLowerCase().includes(q)).slice(0, 20);
    results.innerHTML = '';
    if (!matches.length) {
      results.innerHTML = '<div class="search-result-empty">Aucun résultat</div>';
    } else {
      matches.forEach(m => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
          <span class="search-result-emoji">${m.emoji || MARKER_EMOJI[m.type] || '📍'}</span>
          <div class="search-result-info">
            <span class="search-result-name">${m.name}</span>
            <span class="search-result-meta">${m.type?.replace(/_/g, ' ') || ''} · Étage ${m._floor}</span>
          </div>
        `;
        item.addEventListener('click', () => {
          results.classList.add('hidden');
          input.value = m.name;
          if (+m._floor !== currentFloor) goToFloor(+m._floor);
          _searchFocusId = m.id;
          const img = gameToPixel(m.gx, m.gy);
          panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
          panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
          applyTransform();
          showTooltip(m);
        });
        results.appendChild(item);
      });
    }
    results.classList.remove('hidden');
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { results.classList.add('hidden'); _searchFocusId = null; renderMarkers(); }
  });

  document.addEventListener('click', (e) => {
    if (!results.contains(e.target) && e.target !== input) {
      results.classList.add('hidden');
    }
  });
}

/* ══════════════════════════════════
   FILTRES SIDEBAR
══════════════════════════════════ */
function setupFilters() {
  document.querySelectorAll('.marker-filter').forEach(cb => {
    cb.addEventListener('change', () => renderMarkers());
  });

  const toggleAll = document.getElementById('toggle-all-filters');
  if (toggleAll) {
    toggleAll.addEventListener('change', () => {
      document.querySelectorAll('.marker-filter').forEach(cb => {
        cb.checked = toggleAll.checked;
      });
      renderMarkers();
    });
  }

  const zoneHover = document.getElementById('zone-hover-toggle');
  if (zoneHover) {
    zoneHover.addEventListener('change', () => renderMarkers());
  }
}

/* ══════════════════════════════════
   ZOOM & PAN
══════════════════════════════════ */
function setupZoomPan() {
  document.getElementById('zoom-in').addEventListener('click', () => {
    zoomLevel = Math.min(ZOOM_MAX, zoomLevel * ZOOM_FACTOR);
    clampPan(); applyTransform();
  });
  document.getElementById('zoom-out').addEventListener('click', () => {
    zoomLevel = Math.max(ZOOM_MIN, zoomLevel / ZOOM_FACTOR);
    clampPan(); applyTransform();
  });
  document.getElementById('zoom-reset').addEventListener('click', () => {
    zoomLevel = 1; panOffset = { x: 0, y: 0 }; applyTransform();
  });

  mapViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const vp = clientToVp(e.clientX, e.clientY);
    const imgBefore = screenToImage(vp.x, vp.y);
    if (e.deltaY < 0) zoomLevel = Math.min(ZOOM_MAX, zoomLevel * ZOOM_FACTOR);
    else              zoomLevel = Math.max(ZOOM_MIN, zoomLevel / ZOOM_FACTOR);
    const imgAfter = screenToImage(vp.x, vp.y);
    panOffset.x += (imgAfter.x - imgBefore.x) * zoomLevel;
    panOffset.y += (imgAfter.y - imgBefore.y) * zoomLevel;
    clampPan(); applyTransform();
  }, { passive: false });

  mapViewport.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isPanning = true; panLastX = e.clientX; panLastY = e.clientY;
    mapViewport.style.cursor = 'grabbing';
  });
  window.addEventListener('mousemove', (e) => {
    if (!isPanning) return;
    panOffset.x += e.clientX - panLastX;
    panOffset.y += e.clientY - panLastY;
    panLastX = e.clientX; panLastY = e.clientY;
    clampPan(); applyTransform();
  });
  window.addEventListener('mouseup', () => {
    isPanning = false;
    mapViewport.style.cursor = 'grab';
  });

  /* Touch */
  let _t0 = null, _tp0 = null, _z0 = 1;
  mapViewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      _t0 = e.touches[0]; _tp0 = { ...panOffset };
    } else if (e.touches.length === 2) {
      _z0 = zoomLevel;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      _t0 = { dist: Math.sqrt(dx * dx + dy * dy) };
    }
  }, { passive: true });
  mapViewport.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (e.touches.length === 1 && _t0 && _tp0) {
      panOffset.x = _tp0.x + e.touches[0].clientX - _t0.clientX;
      panOffset.y = _tp0.y + e.touches[0].clientY - _t0.clientY;
      clampPan(); applyTransform();
    } else if (e.touches.length === 2 && _t0) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, _z0 * (dist / _t0.dist)));
      clampPan(); applyTransform();
    }
  }, { passive: false });
  mapViewport.addEventListener('touchend', () => { _t0 = null; _tp0 = null; });
}

/* ══════════════════════════════════
   MOLETTE ÉTAGES
══════════════════════════════════ */
function setupWheel() {
  document.getElementById('wheel-up').addEventListener('click', () => goToFloor(currentFloor + 1));
  document.getElementById('wheel-down').addEventListener('click', () => goToFloor(currentFloor - 1));

  floorInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const v = parseInt(floorInput.value);
      if (!isNaN(v)) goToFloor(v);
    }
  });
  floorInput.addEventListener('blur', () => {
    const v = parseInt(floorInput.value);
    if (!isNaN(v)) goToFloor(v);
    else floorInput.value = currentFloor;
  });

  let wDragging = false, wStartY = 0, wStartFloor = 1;
  const wheelDisplay = document.querySelector('.wheel-display');
  if (wheelDisplay) {
    wheelDisplay.addEventListener('mousedown', (e) => {
      wDragging = true; wStartY = e.clientY; wStartFloor = currentFloor;
    });
    window.addEventListener('mousemove', (e) => {
      if (!wDragging) return;
      const delta = Math.round((wStartY - e.clientY) / 32);
      goToFloor(Math.max(1, Math.min(FLOOR_COUNT, wStartFloor + delta)));
    });
    window.addEventListener('mouseup', () => { wDragging = false; });
  }
}

/* ══════════════════════════════════
   COORDONNÉES CURSOR
══════════════════════════════════ */
function setupCoordDisplay() {
  const coord = document.createElement('div');
  coord.className = 'coord-display hidden';
  coord.id = 'coord-display';
  coord.innerHTML = '<span id="coord-x">X: —</span><span id="coord-y">Z: —</span><span id="coord-zone"></span>';
  mapViewport.appendChild(coord);

  mapViewport.addEventListener('mousemove', (e) => {
    if (isPanning) return;
    coord.classList.remove('hidden');
    const vp = clientToVp(e.clientX, e.clientY);
    const img = screenToImage(vp.x, vp.y);
    const g = pixelToGame(img.x, img.y);
    document.getElementById('coord-x').textContent = 'X: ' + g.x;
    document.getElementById('coord-y').textContent = 'Z: ' + g.y;
  });
  mapViewport.addEventListener('mouseleave', () => coord.classList.add('hidden'));
}

/* ══════════════════════════════════
   CALLBACK FIRESTORE
══════════════════════════════════ */
window._onFirestoreLoaded = function () {
  renderMarkers();
  // Mettre à jour le moteur de recherche
};

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
function init() {
  updateVpBounds();
  window.addEventListener('resize', () => { updateVpBounds(); applyTransform(); });

  buildWheelTrack();
  setupZoomPan();
  setupWheel();
  setupFilters();
  setupSearch();
  setupCoordDisplay();

  // Lire le hash initial
  const hash = window.location.hash;
  let startFloor = 1;
  let startLayer = 'surface';
  if (hash) {
    const m = hash.match(/#floor-(\d+)(?:-(surface|underground))?/);
    if (m) { startFloor = parseInt(m[1]); startLayer = m[2] || 'surface'; }
  }
  currentLayer = startLayer;
  goToFloor(startFloor);

  applyTransform();
}

document.addEventListener('DOMContentLoaded', init);
