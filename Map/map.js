/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
const MAP_SIZE          = 900;
let   currentFloor      = 1;
let   currentLayer      = 'surface';
let   zoomLevel         = 1;
const ZOOM_MIN          = 0.4;
const ZOOM_MAX          = 10;
const ZOOM_FACTOR       = 1.15;
const ITEM_HEIGHT       = 32;
const CLUSTER_RADIUS_PX = 30;

let isPanning      = false;
let panLastX       = 0;
let panLastY       = 0;
let panOffset      = { x: 0, y: 0 };
let _searchFocusId = null;

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
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

function showDungeonSpawn(marker) {
  /*clearDungeonSpawn();

  const spawnImg = gameToPixel(marker.spawnGx, marker.spawnGy);
  const spawnS   = imageToScreen(spawnImg.x, spawnImg.y);
  const entrImg  = gameToPixel(marker.gx, marker.gy);
  const entrS    = imageToScreen(entrImg.x, entrImg.y);

  // Ligne pointillée entrée → spawn
  const svg = getQuestChainSvg(); // réutilise le même SVG overlay
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('x1', entrS.x); line.setAttribute('y1', entrS.y);
  line.setAttribute('x2', spawnS.x); line.setAttribute('y2', spawnS.y);
  line.setAttribute('stroke', '#e6c924');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-dasharray', '5 3');
  line.style.opacity = '0.7';
  svg.appendChild(line);
  svg.dataset.dungeonLine = 'true';

  // Pin spawn
  const pin = document.createElement('div');
  pin.id           = 'dungeon-spawn-pin';
  pin.className    = 'marker';
  pin.dataset.type = 'dungeon-spawn';
  pin.style.left   = spawnS.x + 'px';
  pin.style.top    = spawnS.y + 'px';
  pin.style.zIndex = '20';

  const icon = document.createElement('div');
  icon.className        = 'marker-icon';
  icon.textContent      = '⚔️';
  icon.style.background = '#ebbc22';
  icon.style.border     = '2px solid #e78428';
  pin.appendChild(icon);

  // Badge layer
  if (marker.spawnLayer && marker.spawnLayer !== currentLayer) {
    const badge = document.createElement('span');
    badge.style.cssText = `
      position:absolute; bottom:-4px; right:-4px;
      font-size:9px; background:rgba(0,0,0,0.72);
      color:#fff; border-radius:3px; padding:1px 3px;
      pointer-events:none;
    `;
    badge.textContent = marker.spawnLayer === 'underground' ? '🕳️' : '⛰️';
    icon.style.position = 'relative';
    icon.appendChild(badge);
  }

  // Tooltip spawn
  pin.addEventListener('mouseenter', () => showTooltip({
    type: 'donjon',
    name: marker.name + ' — Spawn',
    desc: marker.spawnLayer === 'underground' ? 'Point d\'apparition · Sous-sol' : 'Point d\'apparition',
    link: marker.link,
  }));
  pin.addEventListener('mouseleave', hideTooltip);

  // Clic → bascule vers la layer du spawn
  pin.addEventListener('click', (e) => {
    e.stopPropagation();
    const targetLayer = marker.spawnLayer || currentLayer;
    const targetFloor = marker.spawnFloor || currentFloor;
    if (targetFloor !== currentFloor) goToFloor(targetFloor);
    if (targetLayer !== currentLayer) goToLayer(targetLayer);
    const img = gameToPixel(marker.spawnGx, marker.spawnGy);
    panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
    applyTransform();
  });

  markersLayer.appendChild(pin);*/
}

function clearDungeonSpawn() {
  const pin = document.getElementById('dungeon-spawn-pin');
  if (pin) pin.remove();
  const svg = document.getElementById('quest-chain-layer');
  if (svg && svg.dataset.dungeonLine) {
    svg.innerHTML = '';
    delete svg.dataset.dungeonLine;
  }
}

function getFloorMarkers(floor) {
  if (currentLayer === 'underground') {
    const src = (typeof FLOOR_MARKERS_UNDERGROUND !== 'undefined') ? FLOOR_MARKERS_UNDERGROUND : null;
    return (src && src[floor]) || [];
  }
  const src = (typeof FLOOR_MARKERS_SURFACE !== 'undefined')
    ? FLOOR_MARKERS_SURFACE
    : (typeof FLOOR_MARKERS !== 'undefined' ? FLOOR_MARKERS : null);
  return (src && src[floor]) || [];
}

/* Expanse les markers boss (qui ont un tableau coords) en markers plats avec gx/gy */
function getFlatFloorMarkers(floor) {
  const raw = getFloorMarkers(floor);
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

function getFlatOtherLayerMarkers(floor) {
  const otherLayer = currentLayer === 'surface' ? 'underground' : 'surface';
  const src =
    otherLayer === 'underground'
      ? (typeof FLOOR_MARKERS_UNDERGROUND !== 'undefined' ? FLOOR_MARKERS_UNDERGROUND : null)
      : (typeof FLOOR_MARKERS_SURFACE !== 'undefined'
          ? FLOOR_MARKERS_SURFACE
          : typeof FLOOR_MARKERS !== 'undefined' ? FLOOR_MARKERS : null);
  const raw = (src && src[floor]) || [];
  const flat = [];
  for (const m of raw) {
    if (m.coords && Array.isArray(m.coords)) {
      m.coords.forEach(c =>
        flat.push({ ...m, gx: c.gx, gy: c.gy, coords: undefined, _ghostLayer: otherLayer })
      );
    } else {
      flat.push({ ...m, _ghostLayer: otherLayer });
    }
  }
  return flat;
}

function getFloorZones(floor) {
  if (currentLayer === 'underground') {
    const src = (typeof FLOOR_ZONES_UNDERGROUND !== 'undefined') ? FLOOR_ZONES_UNDERGROUND : null;
    return (src && src[floor]) || [];
  }
  const src = (typeof FLOOR_ZONES_SURFACE !== 'undefined')
    ? FLOOR_ZONES_SURFACE
    : (typeof FLOOR_ZONES !== 'undefined' ? FLOOR_ZONES : null);
  return (src && src[floor]) || [];
}

function ensureGhostOverlay() {
  let ghost = document.getElementById('map-ghost');
  if (!ghost) {
    ghost = document.createElement('img');
    ghost.id  = 'map-ghost';
    ghost.alt = '';
    ghost.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.35s ease;
      z-index: 0;
    `;
    const mapImg = document.getElementById('map-svg');
    mapImg.parentElement.insertBefore(ghost, mapImg);
  }
  return ghost;
}

function floorHasUnderground(n) {
  if (typeof FLOOR_DATA !== 'undefined' && FLOOR_DATA[n]) {
    return !!FLOOR_DATA[n].hasUnderground;
  }
  return false;
}

function updateGhostOverlay() {
  const ghost  = ensureGhostOverlay();
  const mapImg = document.getElementById('map-svg');

  if (currentLayer === 'underground') {
    ghost.src           = `img/maps/floor-${currentFloor}.png`;
    ghost.style.opacity = '0.10';
    ghost.style.filter  = 'grayscale(60%) brightness(0.8)';
    mapImg.style.zIndex = '1';
  } else {
    ghost.style.opacity = '0';
    mapImg.style.zIndex = '';
  }
}

/* ══════════════════════════════════
   LAYER SWITCHER — bouton toggle
══════════════════════════════════ */
function buildLayerSwitcher() {
  const container = document.createElement('div');
  container.id = 'layer-switcher';
  container.style.cssText = `
		display: flex;
		align-self: stretch;
		border: 1px solid rgba(224,172,96,0.35);
		border-radius: 0px;
		overflow: hidden;
		flex-shrink: 0;
		box-shadow: 0 0 12px rgba(224,172,96,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
	`;

  const tabs = [
    { layer: 'surface',     label: 'Surface',   icon: '⛰️' },
    { layer: 'underground', label: 'Sous-sol',   icon: '🕳️' },
  ];

  tabs.forEach(({ layer, label, icon }) => {
    const btn = document.createElement('button');
    btn.dataset.layer = layer;
    btn.innerHTML = `<span style="font-size:13px;line-height:1">${icon}</span><span>${label}</span>`;
    btn.style.cssText = `
      display: flex;
			
      align-items: center;
      gap: 6px;
      padding: 0px 14px;
			height: 100%;
      font-family: 'Cinzel', serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.08em;
      cursor: pointer;
      border: none;
      border-right: 1px solid rgba(224,172,96,0.2);
      transition: background 0.15s, color 0.15s;
      white-space: nowrap;
      user-select: none;
    `;
    if (layer === 'underground') btn.style.borderRight = 'none';
    container.appendChild(btn);
  });

  updateLayerTabStyles(container);

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-layer]');
    if (!btn) return;
    goToLayer(btn.dataset.layer);
    updateLayerTabStyles(container);
  });

  const searchbar = document.querySelector('.map-searchbar');
  if (searchbar) {
    searchbar.style.display    = 'flex';
    searchbar.style.alignItems = 'center';
    searchbar.style.gap        = '8px';
    searchbar.appendChild(container);
  }

  updateLayerBtnVisibility();
}

function updateLayerTabStyles(container) {
  container.querySelectorAll('button[data-layer]').forEach(btn => {
    const active = btn.dataset.layer === currentLayer;
    btn.style.background = active
      ? 'linear-gradient(135deg, rgba(224,172,96,0.28) 0%, rgba(180,130,60,0.18) 100%)'
      : 'rgba(14,12,10,0.6)';
    btn.style.color = active ? '#E0AC60' : 'rgba(255,255,255,0.38)';
    btn.style.boxShadow = active ? 'inset 0 -2px 0 #E0AC60' : 'none';
  });
}

function updateLayerBtn() {
  const container = document.getElementById('layer-switcher');
  if (container) updateLayerTabStyles(container);
}

function updateLayerBtnVisibility() {
  const container = document.getElementById('layer-switcher');
  if (!container) return;
  const hasUnder = floorHasUnderground(currentFloor);
  container.style.display = hasUnder ? 'flex' : 'none';
  if (!hasUnder && currentLayer === 'underground') {
    currentLayer = 'surface';
    updateLayerBtn();
    updateGhostOverlay();
  }
}


/* ══════════════════════════════════
   CHARGEMENT IMAGE MAP
   Source de vérité unique pour charger
   la bonne image selon étage + couche.
══════════════════════════════════ */
function loadMapImage(n, layer) {
  const mapImg = document.getElementById('map-svg');
  const ghost  = ensureGhostOverlay();

  if (layer === 'underground') {
    mapImg.style.opacity = '0';
    mapImg.style.zIndex  = '1';
    mapImg.src = `../img/maps/floor-${n}_underground.png`;
    mapImg.onload  = () => { mapImg.style.opacity = '1'; mapImg.removeAttribute('data-missing'); };
    mapImg.onerror = () => { mapImg.src = ''; mapImg.setAttribute('data-missing', 'true'); mapImg.style.opacity = '0'; };

    ghost.src           = `../img/maps/floor-${n}.png`;
    ghost.style.filter  = 'grayscale(60%) brightness(0.8)';
    ghost.style.zIndex  = '0';
    ghost.style.opacity = '0.10';
  } else {
    mapImg.style.opacity = '0';
    mapImg.style.zIndex  = '';
    mapImg.src = `../img/maps/floor-${n}.png`;
    mapImg.onload  = () => { mapImg.style.opacity = '1'; mapImg.removeAttribute('data-missing'); };
    mapImg.onerror = () => { mapImg.src = ''; mapImg.setAttribute('data-missing', 'true'); mapImg.style.opacity = '0'; };

    ghost.style.opacity = '0';
  }
}

/* ══════════════════════════════════
   CHANGEMENT DE COUCHE
══════════════════════════════════ */
function goToLayer(layer) {
  if (layer === currentLayer) return;
  currentLayer = layer;
  updateLayerBtn();
  loadMapImage(currentFloor, currentLayer);
  history.replaceState(
    { floor: currentFloor, layer: currentLayer },
    '',
    `#floor-${currentFloor}-${currentLayer}`
  );
  renderMarkers();
  hideTooltip();
}

/* ══════════════════════════════════
   HASH PARSING
══════════════════════════════════ */
function parseHash(hash) {
  const raw = hash || window.location.hash;
  // Format bestiaire : #m1z3, #m1r1, #m1d2, #m2z1u1…
  const zm = raw.match(/#(m(\d+)[a-z]\w*)/);
  if (zm) {
    const floor = parseInt(zm[2]);
    const id    = zm[1];
    const underground = /u\d+$/.test(id);
    return { floor, layer: underground ? 'underground' : 'surface', focusId: id };
  }
  const m = raw.match(/#floor-(\d+)(?:-(surface|underground))?/);
  return {
    floor: m ? parseInt(m[1]) : 1,
    layer: (m && m[2]) ? m[2] : 'surface',
  };
}

function navigateToMapId(id) {
  // Chercher dans quelle layer + floor se trouve cet id (zones d'abord, puis markers)
  let targetLayer = currentLayer;
  let targetFloor = currentFloor;

  const zoneSources = [
    { layer: 'surface',     src: typeof FLOOR_ZONES_SURFACE !== 'undefined' ? FLOOR_ZONES_SURFACE : (typeof FLOOR_ZONES !== 'undefined' ? FLOOR_ZONES : null) },
    { layer: 'underground', src: typeof FLOOR_ZONES_UNDERGROUND !== 'undefined' ? FLOOR_ZONES_UNDERGROUND : null },
  ];
  const markerSources = [
    { layer: 'surface',     src: typeof FLOOR_MARKERS_SURFACE !== 'undefined' ? FLOOR_MARKERS_SURFACE : (typeof FLOOR_MARKERS !== 'undefined' ? FLOOR_MARKERS : null) },
    { layer: 'underground', src: typeof FLOOR_MARKERS_UNDERGROUND !== 'undefined' ? FLOOR_MARKERS_UNDERGROUND : null },
  ];

  // Chercher dans les zones
  outer:
  for (const { layer, src } of zoneSources) {
    if (!src) continue;
    for (const [floor, zones] of Object.entries(src)) {
      if (zones.some(z => z.id === id)) {
        targetLayer = layer;
        targetFloor = parseInt(floor);
        break outer;
      }
    }
  }
  // Chercher dans les markers si pas trouvé dans les zones
  if (targetLayer === currentLayer && targetFloor === currentFloor) {
    outer:
    for (const { layer, src } of markerSources) {
      if (!src) continue;
      for (const [floor, markers] of Object.entries(src)) {
        if (markers.some(m => m.id === id)) {
          targetLayer = layer;
          targetFloor = parseInt(floor);
          break outer;
        }
      }
    }
  }

  // Appliquer floor + layer si nécessaire, puis naviguer
  if (targetFloor !== currentFloor) goToFloor(targetFloor);
  if (targetLayer !== currentLayer) goToLayer(targetLayer);

  // Maintenant chercher la zone/marker dans le contexte correct
  const zones = getFloorZones(currentFloor);
  const zone  = zones.find(z => z.id === id);
  if (zone) {
    updateVpBounds();
    const minGx = Math.min(...zone.points.map(p => p.gx));
    const maxGx = Math.max(...zone.points.map(p => p.gx));
    const minGy = Math.min(...zone.points.map(p => p.gy));
    const maxGy = Math.max(...zone.points.map(p => p.gy));
    const cx = (minGx + maxGx) / 2;
    const cy = (minGy + maxGy) / 2;

    const leftPx   = gameToPixel(minGx, cy).x;
    const rightPx  = gameToPixel(maxGx, cy).x;
    const topPx    = gameToPixel(cx, minGy).y;
    const bottomPx = gameToPixel(cx, maxGy).y;
    const zoneImgW = rightPx - leftPx;
    const zoneImgH = bottomPx - topPx;

    if (zoneImgW > 0 && zoneImgH > 0) {
      const padding = 80;
      const zoomW = (_vpW - padding * 2) / zoneImgW;
      const zoomH = (_vpH - padding * 2) / zoneImgH;
      zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(zoomW, zoomH)));
    }

    const img   = gameToPixel(cx, cy);
    panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
    applyTransform();
    if (zone._activate) {
      window._activeZoneId = zone.id;
      zone._activate();
    }
    return;
  }

  const markers = getFlatFloorMarkers(currentFloor);
  const matched = markers.filter(m => m.id === id);
  if (matched.length > 0) {
    const cx = matched.reduce((s, m) => s + m.gx, 0) / matched.length;
    const cy = matched.reduce((s, m) => s + m.gy, 0) / matched.length;
    const img   = gameToPixel(cx, cy);
    panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
    _searchFocusId = id;
    applyTransform();
    showTooltip(matched[0]);
  }
}

/* ══════════════════════════════════
   POSITION VIEWPORT
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
   CONVERSIONS COORDONNÉES
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
/** Raccourci : coordonnées jeu → coordonnées écran (gameToPixel + imageToScreen). */
function gameToScreen(gx, gy) {
  const img = gameToPixel(gx, gy);
  return imageToScreen(img.x, img.y);
}

/* ══════════════════════════════════
   HELPER
══════════════════════════════════ */
function isZoneFilterEnabled() {
  const cb = document.querySelector('.marker-filter[data-type="zone_monstre"]');
  return cb ? cb.checked : false;
}

function cleanupAllZones() {
  if (window._zoneLeaveTimer) {
    clearTimeout(window._zoneLeaveTimer);
    window._zoneLeaveTimer = null;
  }
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  if (!isZoneFilterEnabled()) {
    document.querySelectorAll('.monster-pin-static').forEach(p => p.remove());
  }
  const zt = document.getElementById('zone-tooltip');
  if (zt) zt.classList.add('hidden');
  const svgEl = document.getElementById('zones-layer');
  if (svgEl) {
    const zoneOn = isZoneFilterEnabled();
    svgEl.querySelectorAll('polygon').forEach(poly => {
      poly.style.opacity = zoneOn ? '1' : '0';
    });
    svgEl.querySelectorAll('text').forEach(t => {
      t.style.opacity = zoneOn ? '1' : '0';
    });
  }
  const zones = getFloorZones(currentFloor);
  if (!isZoneFilterEnabled()) {
    zones.forEach(zone => {
      const regionName = zone.regionName || zone.name;
      const markerData = getFloorMarkers(currentFloor).find(m =>
        m.type === 'région' && m.name === regionName
      );
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '1'; pin.style.pointerEvents = ''; pin.style.cursor = ''; }
      }
    });
  }
  window._zoneCleanup = null;
}

/* ══════════════════════════════════
   MOLETTE ÉTAGES
══════════════════════════════════ */
function buildWheel() {
  wheelTrack.innerHTML = '';
  for (let i = 1; i <= FLOOR_COUNT; i++) {
    const el = document.createElement('div');
    el.className   = 'wheel-num' + (i === currentFloor ? ' wheel-active' : '');
    el.textContent = String(i).padStart(2, '0');
    el.dataset.floor = i;
    el.addEventListener('click', () => goToFloor(i));
    wheelTrack.appendChild(el);
  }
  scrollWheelTo(currentFloor);

  const coordDisplay = document.createElement('div');
  coordDisplay.id        = 'coord-display';
  coordDisplay.className = 'coord-display hidden';
  coordDisplay.innerHTML = '<span id="coord-zone"></span><span id="coord-xy"></span>';
  document.querySelector('.map-main').appendChild(coordDisplay);

  mapViewport.addEventListener('mousemove', (e) => {
    const c = MAP_CALIBRATION[currentFloor];
    if (!c) return;
    const vp   = clientToVp(e.clientX, e.clientY);
    const img  = screenToImage(vp.x, vp.y);
    const game = pixelToGame(img.x, img.y);
    document.getElementById('coord-zone').textContent = FLOOR_NAMES[currentFloor] || `Étage ${currentFloor}`;
    document.getElementById('coord-xy').textContent   = `X: ${game.x}  Y: ${game.y}`;
    coordDisplay.classList.remove('hidden');
  });
  mapViewport.addEventListener('mouseleave', () => {
    coordDisplay.classList.add('hidden');
    window._zonePinActive = false;
    cleanupAllZones();
  });
}

function scrollWheelTo(floor) {
  const display   = document.querySelector('.wheel-display');
  const midHeight = display.offsetHeight / 2;
  const offset    = -(floor - 1) * ITEM_HEIGHT + midHeight - ITEM_HEIGHT / 2;
  wheelTrack.style.transform = `translateY(${offset}px)`;
  document.querySelectorAll('.wheel-num').forEach(el => {
    el.classList.toggle('wheel-active', parseInt(el.dataset.floor) === floor);
  });
}

/* ══════════════════════════════════
   CHANGEMENT D'ÉTAGE
══════════════════════════════════ */
function goToFloor(n) {
  n = Math.max(1, Math.min(FLOOR_COUNT, n));
  history.pushState(
    { floor: n, layer: currentLayer },
    '',
    `#floor-${n}-${currentLayer}`
  );
  currentFloor = n;
  floorInput.value          = n;
  floorDisplay.textContent  = String(n).padStart(2, '0');
  floorInfoNum.textContent  = n;
  floorNameDisp.textContent = FLOOR_NAMES[n] || `Étage ${n}`;

  loadMapImage(n, currentLayer);

  updateLayerBtnVisibility();
  scrollWheelTo(n);
  renderMarkers();
  hideTooltip();
}

/* ══════════════════════════════════
   CLUSTERING
══════════════════════════════════ */
function clusterMarkers(markers) {
  const positioned = markers.map(m => {
    const img = gameToPixel(m.gx, m.gy);
    const s   = imageToScreen(img.x, img.y);
    return { ...m, sx: s.x, sy: s.y };
  });
  const clusters = [];
  const used = new Set();
  positioned.forEach((m, i) => {
    if (used.has(i)) return;
    const group = [m];
    used.add(i);
    positioned.forEach((other, j) => {
      if (used.has(j)) return;
      if (Math.hypot(m.sx - other.sx, m.sy - other.sy) < CLUSTER_RADIUS_PX) {
        group.push(other); used.add(j);
      }
    });
    clusters.push(group);
  });
  return clusters;
}

/* ══════════════════════════════════
   PINS MONSTRES AU HOVER
══════════════════════════════════ */
function spawnMonsterPinsStatic(zone) {
  if (!zone.monsters || zone.monsters.length === 0) return;

  const cx  = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
  const cy  = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
  const imgC = gameToPixel(cx, cy);
  const sC   = imageToScreen(imgC.x, imgC.y);
  const count = zone.monsters.length;
  const radius = 52;
  const startAngle  = -150 * (Math.PI / 180);
  const endAngle    = -30  * (Math.PI / 180);
  const step        = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
  const offsetAngle = count === 1 ? (startAngle + endAngle) / 2 : startAngle;

  zone.monsters.forEach((monster, i) => {
    const angle = offsetAngle + i * step;
    const sx = sC.x + Math.cos(angle) * radius;
    const sy = sC.y + Math.sin(angle) * radius;

    const pin = document.createElement('div');
    pin.className    = 'marker monster-pin-static';
    pin.dataset.type = 'monster-static';
    pin.style.left   = sx + 'px';
    pin.style.top    = sy + 'px';
    pin.style.zIndex = '10';
    if (monster.link) pin.style.cursor = 'pointer';

    const icon = document.createElement('div');
    icon.className        = 'marker-icon';
    icon.textContent      = monster.emoji || '💀';
    icon.style.background = zone.color;
    icon.style.boxShadow  = `0 2px 12px ${zone.color}88`;
    pin.appendChild(icon);

    pin.addEventListener('mouseenter', () => showTooltip({
      type: 'zone_monstre',
      name: monster.name,
      desc: `Niveau ${monster.level} · ${monster.difficulty}`,
      link: monster.link,
    }));
    pin.addEventListener('mouseleave', hideTooltip);
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (monster.link) window.open(monster.link, '_blank');
    });

    markersLayer.appendChild(pin);
  });
}

function spawnMonsterPins(zone) {
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  if (!zone.monsters || zone.monsters.length === 0) return;

  const cx      = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
  const cy      = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
  const imgC    = gameToPixel(cx, cy);
  const sC      = imageToScreen(imgC.x, imgC.y);
  const count   = zone.monsters.length;
  const radius  = 52;
  const startAngle  = -150 * (Math.PI / 180);
  const endAngle    = -30  * (Math.PI / 180);
  const step        = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
  const offsetAngle = count === 1 ? (startAngle + endAngle) / 2 : startAngle;

  zone.monsters.forEach((monster, i) => {
    const angle = offsetAngle + i * step;
    const sx    = sC.x + Math.cos(angle) * radius;
    const sy    = sC.y + Math.sin(angle) * radius;

    const pin = document.createElement('div');
    pin.className    = 'marker monster-pin-hover';
    pin.dataset.type = 'zone_monstre';
    pin.style.left   = sx + 'px';
    pin.style.top    = sy + 'px';
    pin.style.zIndex = '10';
    if (monster.link) pin.style.cursor = 'pointer';

    const icon = document.createElement('div');
    icon.className        = 'marker-icon';
    icon.textContent      = monster.emoji || '💀';
    icon.style.background = zone.color;
    icon.style.boxShadow  = `0 2px 12px ${zone.color}88`;
    icon.style.color      = zone.color;
    pin.appendChild(icon);

    pin.addEventListener('mouseenter', () => {
      if (window._zoneLeaveTimer) {
        clearTimeout(window._zoneLeaveTimer);
        window._zoneLeaveTimer = null;
      }
      window._zonePinActive = true;
      const zt = document.getElementById('zone-tooltip');
      if (zt) zt.classList.remove('hidden');

      tooltipType.textContent = 'Monstre';
      tooltipName.textContent = monster.name;
      tooltipDesc.textContent = `Niveau ${monster.level} · ${monster.difficulty}`;
      if (monster.link) {
        tooltipLink.href   = monster.link;
        tooltipLink.target = '_blank';
        tooltipLink.rel    = 'noopener noreferrer';
        tooltipLink.classList.remove('hidden');
      } else {
        tooltipLink.classList.add('hidden');
      }
      tooltip.classList.remove('hidden');
    });

    pin.addEventListener('mouseleave', (e) => {
      if (pin.contains(e.relatedTarget)) return;
      window._zonePinActive = false;
      window._zoneLeaveTimer = setTimeout(() => {
        if (!window._zonePinActive) {
          hideTooltip();
          window._zoneCleanup && window._zoneCleanup();
        }
      }, 400);
    });

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (monster.link) window.open(monster.link, '_blank');
    });

    markersLayer.appendChild(pin);
  });
}

/* ══════════════════════════════════
   RENDU ZONES
══════════════════════════════════ */
function isZoneHoverEnabled() {
  const cb = document.getElementById('zone-hover-toggle');
  return cb ? cb.checked : true;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].gx, yi = points[i].gy;
    const xj = points[j].gx, yj = points[j].gy;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

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
    markersLayer.parentElement.insertBefore(svgEl, markersLayer);
  }
  svgEl.innerHTML = '';

  if (window._zoneLeaveTimer) { clearTimeout(window._zoneLeaveTimer); window._zoneLeaveTimer = null; }
  if (window._zoneHoverHandler) { mapViewport.removeEventListener('mousemove', window._zoneHoverHandler); window._zoneHoverHandler = null; }
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  window._zoneCleanup   = null;
  window._activeZoneId  = null;

  let zoneTooltip = document.getElementById('zone-tooltip');
  if (!zoneTooltip) {
    zoneTooltip = document.createElement('div');
    zoneTooltip.id        = 'zone-tooltip';
    zoneTooltip.className = 'zone-tooltip hidden';
    document.querySelector('.map-main').appendChild(zoneTooltip);
  }
  zoneTooltip.classList.add('hidden');

  const zoneOn = isZoneFilterEnabled();
  const zones  = getFloorZones(currentFloor);

  // Index region-marker par nom (construit 1×, réutilisé dans _cleanup/_activate et init loop)
  const regionMarkerByName = new Map();
  getFloorMarkers(currentFloor).forEach(m => {
    if (m.type === 'région') regionMarkerByName.set(m.name, m);
  });

  zones.forEach(zone => {
    const pointsStr = zone.points.map(p => {
      const s = gameToScreen(p.gx, p.gy);
      return `${s.x},${s.y}`;
    }).join(' ');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.pointerEvents = 'none';

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points',           pointsStr);
    poly.setAttribute('stroke',           zone.color);
    poly.setAttribute('stroke-width',     '2');
    poly.setAttribute('stroke-dasharray', '6 3');
    poly.setAttribute('fill',             zoneOn ? zone.color + '55' : zone.color + '2a');
    poly.style.transition    = 'opacity .25s ease';
    poly.style.opacity       = zoneOn ? '1' : '0';
    poly.style.pointerEvents = 'none';

    if (!zone._centroid) {
      const cx = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
      const cy = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
      zone._centroid = { cx, cy };
    }
    const sC = gameToScreen(zone._centroid.cx, zone._centroid.cy);

    const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emojiText.setAttribute('x',                 sC.x);
    emojiText.setAttribute('y',                 sC.y - 10);
    emojiText.setAttribute('text-anchor',       'middle');
    emojiText.setAttribute('dominant-baseline', 'middle');
    emojiText.setAttribute('font-size',         '22');
    emojiText.style.transition    = 'opacity .25s ease';
    emojiText.style.opacity       = zoneOn ? '1' : '0';
    emojiText.style.pointerEvents = 'none';
    emojiText.textContent = zone.emoji || '❓';

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x',                 sC.x);
    label.setAttribute('y',                 sC.y + 16);
    label.setAttribute('text-anchor',       'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill',              zone.color);
    label.setAttribute('font-family',       'JetBrains Mono, monospace');
    label.setAttribute('font-size',         '13');
    label.setAttribute('font-weight',       '700');
    label.setAttribute('stroke',            'rgba(0,0,0,0.9)');
    label.setAttribute('stroke-width',      '4');
    label.setAttribute('paint-order',       'stroke fill');
    label.setAttribute('letter-spacing',    '1');
    label.style.transition    = 'opacity .25s ease';
    label.style.opacity       = zoneOn ? '1' : '0';
    label.style.pointerEvents = 'none';
    label.textContent = zone.name;

    zone._cleanup = () => {
      const stillOn = isZoneFilterEnabled();
      poly.style.opacity      = stillOn ? '1' : '0';
      poly.setAttribute('fill', stillOn ? zone.color + '55' : zone.color + '2a');
      emojiText.style.opacity = stillOn ? '1' : '0';
      label.style.opacity     = stillOn ? '1' : '0';
      zoneTooltip.classList.add('hidden');
      document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
      const regionName = zone.regionName || zone.name;
      const markerData = regionMarkerByName.get(regionName);
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '1'; pin.style.pointerEvents = ''; pin.style.cursor = ''; }
      }
      window._activeZoneId = null;
      window._zoneCleanup  = null;
    };

    zone._activate = () => {
      window._zoneCleanup     = zone._cleanup;
      poly.style.opacity      = '1';
      poly.setAttribute('fill', zone.color + '55');
      emojiText.style.opacity = '1';
      label.style.opacity     = '1';
      const regionName = zone.regionName || zone.name;
      const markerData = regionMarkerByName.get(regionName);
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '0'; pin.style.pointerEvents = 'none'; pin.style.cursor = 'default'; }
      }
      if (zone.monsters && zone.monsters.length > 0) {
        const monstersHtml = zone.monsters.map(m => `
          <div class="zone-tooltip-monster">
            <span class="zone-tooltip-monster-emoji">${m.emoji}</span>
            <span class="zone-tooltip-monster-name">${m.name}</span>
            <span class="zone-tooltip-monster-level">Niv. ${m.level}</span>
            <span class="zone-tooltip-monster-diff">${m.difficulty}</span>
          </div>`).join('');
        zoneTooltip.innerHTML = `
          <div class="zone-tooltip-header">
            <span class="zone-tooltip-emoji">${zone.emoji || '❓'}</span>
            <span class="zone-tooltip-name" style="color:${zone.color}">${zone.name}</span>
          </div>
          <div class="zone-tooltip-sep"></div>
          <div class="zone-tooltip-monsters">${monstersHtml}</div>`;
        zoneTooltip.classList.remove('hidden');
      }
      spawnMonsterPins(zone);
    };

    g.appendChild(poly);
    g.appendChild(emojiText);
    g.appendChild(label);
    svgEl.appendChild(g);
  });

  // Throttle via requestAnimationFrame : au plus 1 calcul par frame, même sous une rafale de mousemove
  let _hoverFrameScheduled = false;
  let _lastHoverX = 0, _lastHoverY = 0;

  const processHover = () => {
    _hoverFrameScheduled = false;
    if (!isZoneHoverEnabled()) return;

    const els = document.elementsFromPoint(_lastHoverX, _lastHoverY);
    const hasPriorityPin = els.some(el => {
      const marker = el.closest('.marker');
      return marker &&
             marker.dataset.type !== 'zone_monstre' &&
             marker.dataset.type !== 'monster-static' &&
             !marker.classList.contains('monster-pin-hover') &&
             !marker.classList.contains('monster-pin-static');
    });
    if (hasPriorityPin) {
      if (window._zoneCleanup) { window._zoneCleanup(); }
      return;
    }

    const vp  = clientToVp(_lastHoverX, _lastHoverY);
    const img = screenToImage(vp.x, vp.y);
    const gp  = pixelToGame(img.x, img.y);
    const hitZone = zones.find(z => pointInPolygon(gp.x, gp.y, z.points));

    if (!hitZone) {
      if (window._zoneCleanup && !window._zoneLeaveTimer) {
        window._zoneLeaveTimer = setTimeout(() => {
          if (window._zoneCleanup) window._zoneCleanup();
          window._zoneLeaveTimer = null;
        }, 400);
      }
      return;
    }

    if (window._zoneLeaveTimer) { clearTimeout(window._zoneLeaveTimer); window._zoneLeaveTimer = null; }
    if (window._activeZoneId === hitZone.id) return;

    if (window._zoneCleanup) window._zoneCleanup();
    window._activeZoneId = hitZone.id;
    hitZone._activate();
  };

  window._zoneHoverHandler = (e) => {
    _lastHoverX = e.clientX;
    _lastHoverY = e.clientY;
    if (_hoverFrameScheduled) return;
    _hoverFrameScheduled = true;
    requestAnimationFrame(processHover);
  };

  mapViewport.addEventListener('mousemove', window._zoneHoverHandler);

  if (zoneOn) {
    zones.forEach(zone => {
      const regionName = zone.regionName || zone.name;
      const markerData = regionMarkerByName.get(regionName);
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '0'; pin.style.pointerEvents = 'none'; pin.style.cursor = 'default'; }
      }
      spawnMonsterPinsStatic(zone);
    });
  }
}

/* ══════════════════════════════════
   RENDU MARQUEURS
══════════════════════════════════ */
function renderMarkers() {
  clearQuestChain();
  markersLayer.innerHTML = '';
  document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());

  // Cache l'état des filtres une fois — évite N querySelector DOM par frame
  const filterState = {};
  document.querySelectorAll('.marker-filter').forEach(cb => {
    filterState[cb.dataset.type] = cb.checked;
  });
  const isTypeVisible = (type) => filterState[type] !== false;

  const markers = getFlatFloorMarkers(currentFloor);

	const otherLayerMarkers = getFlatOtherLayerMarkers(currentFloor);
  otherLayerMarkers.forEach(m => {
    if (!isTypeVisible(m.type)) return;
    const s = gameToScreen(m.gx, m.gy);
    renderGhostMarker({ ...m, sx: s.x, sy: s.y });
  });

  const focusedList = _searchFocusId ? markers.filter(m => m.id === _searchFocusId) : [];
  const isMultiFocus = focusedList.length > 1;

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
  } else if (isMultiFocus) {
    focusedList.forEach(focused => {
      const s = gameToScreen(focused.gx, focused.gy);
      renderSingleMarker({ ...focused, sx: s.x, sy: s.y });
    });
    markersLayer.querySelectorAll(`.marker[data-id="${_searchFocusId}"]`).forEach(el => {
      el.classList.remove('marker-dimmed');
    });
  }

  renderZones();
}


/* ══════════════════════════════════
   CHAÎNE QUÊTES PRINCIPALES
   Au hover d'un pin quête_principale,
   trace une ligne SVG reliant tous les
   pins précédents dans l'ordre.
══════════════════════════════════ */

function getQuestOrder(name) {
  const m = name.match(/^(\d+)\s*[-–]/);
  return m ? parseInt(m[1]) : null;
}

function getQuestChainSvg() {
  let svg = document.getElementById('quest-chain-layer');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'quest-chain-layer';
    svg.style.cssText = `
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      pointer-events:none;
      z-index:5;
      overflow:visible;
    `;
    markersLayer.parentElement.insertBefore(svg, markersLayer.nextSibling);
  }
  return svg;
}

function clearQuestChain() {
  const svg = document.getElementById('quest-chain-layer');
  if (svg) svg.innerHTML = '';
  /* Retirer le highlight des pins */
  markersLayer.querySelectorAll('.marker[data-quest-chain]').forEach(el => {
    el.removeAttribute('data-quest-chain');
    el.querySelector('.marker-icon') && (el.querySelector('.marker-icon').style.outline = '');
    el.style.zIndex = '';
  });
}

function showQuestChain(hoveredMarker) {
  clearQuestChain();

  const order = getQuestOrder(hoveredMarker.name);
  if (order === null) return;

  /* Récupérer tous les marqueurs de quête principale du floor actuel */
  const allMarkers = getFloorMarkers(currentFloor).filter(m => m.type === 'quête_principale');

  /* Trier par numéro */
  const sorted = allMarkers
    .map(m => ({ ...m, order: getQuestOrder(m.name) }))
    .filter(m => m.order !== null)
    .sort((a, b) => a.order - b.order);

  /* Ne garder que jusqu'à la quête hovée (incluse) */
  const chain = sorted.filter(m => m.order <= order);
  if (chain.length < 2) return;

  /* Convertir en coordonnées écran */
  const screenPoints = chain.map(m => {
    const img = gameToPixel(m.gx, m.gy);
    return imageToScreen(img.x, img.y);
  });

  const svg = getQuestChainSvg();
  const COLOR = '#f0c040';

  /* Ligne de chemin */
  for (let i = 0; i < screenPoints.length - 1; i++) {
    const a = screenPoints[i];
    const b = screenPoints[i + 1];

    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', a.x);
    line.setAttribute('y1', a.y);
    line.setAttribute('x2', b.x);
    line.setAttribute('y2', b.y);
    line.setAttribute('stroke', COLOR);
    line.setAttribute('stroke-width', '2');
    line.setAttribute('stroke-dasharray', '6 4');
    line.setAttribute('stroke-linecap', 'round');
    line.style.opacity = '0.75';
    svg.appendChild(line);
  }

  /* Numéroter chaque étape avec un petit cercle SVG */
  screenPoints.forEach((pt, i) => {
    const m = chain[i];
    const isHovered = m.order === order;

    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('cx', pt.x);
    circle.setAttribute('cy', pt.y);
    circle.setAttribute('r', isHovered ? '14' : '10');
    circle.setAttribute('fill', isHovered ? COLOR : '#a07820');
    circle.setAttribute('stroke', COLOR);
    circle.setAttribute('stroke-width', '2');
    circle.style.opacity = isHovered ? '1' : '0.7';
    svg.appendChild(circle);

    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('x', pt.x);
    text.setAttribute('y', pt.y);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('dominant-baseline', 'middle');
    text.setAttribute('font-size', isHovered ? '10' : '8');
    text.setAttribute('font-weight', '700');
    text.setAttribute('font-family', 'JetBrains Mono, monospace');
    text.setAttribute('fill', '#1a1000');
    text.style.pointerEvents = 'none';
    text.textContent = m.order;
    svg.appendChild(text);
  });
}

function renderGhostMarker(m) {
  const el = document.createElement('div');
  el.className    = 'marker marker-ghost';
  el.dataset.type = m.type;
  el.dataset.id   = m.id;
  el.style.left   = m.sx + 'px';
  el.style.top    = m.sy + 'px';
  el.style.opacity = '0.65';
	el.style.filter  = 'grayscale(25%) brightness(0.95)';
  el.style.pointerEvents = 'auto';
  el.style.zIndex        = '0';

  const icon = document.createElement('div');
  icon.className   = 'marker-icon';
  icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';

  /* Petit badge indiquant la layer d'origine */
  const badge = document.createElement('span');
  badge.style.cssText = `
    position: absolute;
    bottom: -4px; right: -4px;
    font-size: 9px;
    line-height: 1;
    background: rgba(0,0,0,0.72);
    color: #fff;
    border-radius: 3px;
    padding: 1px 3px;
    pointer-events: none;
    white-space: nowrap;
    letter-spacing: 0.03em;
  `;
  badge.textContent = m._ghostLayer === 'underground' ? '🕳️' : '⛰️';
  icon.style.position = 'relative';
  icon.appendChild(badge);

  el.appendChild(icon);

  /* Tooltip au survol */
  el.addEventListener('mouseenter', () => {
    const layerLabel = m._ghostLayer === 'underground' ? 'Sous-sol' : 'Surface';
    tooltipType.textContent = (TYPE_LABELS[m.type] || m.type) + ` · ${layerLabel}`;
    tooltipName.textContent = m.name;
    tooltipDesc.textContent = m.desc || '';
    tooltipLink.classList.add('hidden');
    tooltip.classList.remove('hidden');
  });
  el.addEventListener('mouseleave', hideTooltip);

  /* Clic → bascule vers la bonne layer + centre la vue */
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    goToLayer(m._ghostLayer);
    const img = gameToPixel(m.gx, m.gy);
    panOffset.x    = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y    = -((img.y - MAP_SIZE / 2) * zoomLevel);
    _searchFocusId = m.id;
    applyTransform();
    showTooltip(m);
  });

  markersLayer.appendChild(el);
}

function renderSingleMarker(m) {
  const el = document.createElement('div');
  el.className    = 'marker';
  el.dataset.type = m.type;
  el.dataset.id   = m.id;
  el.style.left   = m.sx + 'px';
  el.style.top    = m.sy + 'px';

  if (m.colorLeft && m.colorRight) {
    const icon  = document.createElement('div');
    icon.className = 'marker-icon-split';
    const left  = document.createElement('div');
    left.className        = 'split-left';
    left.style.background = m.colorLeft;
    left.textContent      = m.emojiLeft || '';
    const right = document.createElement('div');
    right.className        = 'split-right';
    right.style.background = m.colorRight;
    right.textContent      = m.emojiRight || '';
    icon.appendChild(left);
    icon.appendChild(right);
    el.appendChild(icon);
  } else {
    const icon = document.createElement('div');
    icon.className   = 'marker-icon';
    icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';
    el.appendChild(icon);
  }

  el.addEventListener('mouseenter', () => {
    showTooltip(m);
    if (m.type === 'quête_principale') showQuestChain(m);
	if (m.type === 'donjon' && m.spawnGx !== undefined) showDungeonSpawn(m);
  });
  el.addEventListener('mouseleave', () => {
    hideTooltip();
    if (m.type === 'quête_principale') clearQuestChain();
	if (m.type === 'donjon') clearDungeonSpawn();
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    const siblings = getFlatFloorMarkers(currentFloor).filter(f => f.id === m.id);
    if (siblings.length > 1 && _searchFocusId !== m.id) {
      _searchFocusId = m.id;
      renderMarkers();
      pinTooltip(m);
    } else {
      pinTooltip(m);
      if (m.link) window.open(m.link, '_blank');
    }
  });
  markersLayer.appendChild(el);
}

function renderCluster(group) {
  const sx = group.reduce((s, m) => s + m.sx, 0) / group.length;
  const sy = group.reduce((s, m) => s + m.sy, 0) / group.length;

  const el = document.createElement('div');
  el.className  = 'marker cluster-marker';
  el.style.left = sx + 'px';
  el.style.top  = sy + 'px';
  el.innerHTML  = `<div class="cluster-dot" data-count="${group.length}">⚙️</div>`;

  let isExpanded = false;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());
    if (isExpanded) {
      isExpanded = false;
      markersLayer.querySelectorAll('.marker').forEach(m => m.classList.remove('marker-dimmed'));
      return;
    }
    isExpanded = true;
    markersLayer.querySelectorAll('.marker').forEach(m => { if (m !== el) m.classList.add('marker-dimmed'); });

    const expanded      = document.createElement('div');
    expanded.className  = 'cluster-expanded';
    expanded.style.left = sx + 'px';
    expanded.style.top  = sy + 'px';

    const angleStep    = (2 * Math.PI) / group.length;
    const deployRadius = Math.max(50, group.length * 12);

    group.forEach((m, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const mx    = Math.round(Math.cos(angle) * deployRadius);
      const my    = Math.round(Math.sin(angle) * deployRadius);

      const line = document.createElement('div');
      line.className = 'cluster-line';
      const len = Math.hypot(mx, my);
      const ang = Math.atan2(my, mx) * 180 / Math.PI;
      line.style.cssText = `width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%;left:0;top:-16px;position:absolute;`;
      expanded.appendChild(line);

      const sub = document.createElement('div');
      sub.className    = 'marker cluster-sub';
      sub.dataset.type = m.type;
      sub.style.left   = mx + 'px';
      sub.style.top    = (my - 16) + 'px';

      const icon = document.createElement('div');
      icon.className   = 'marker-icon marker-icon-sm';
      icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';
      sub.appendChild(icon);

      sub.addEventListener('mouseenter', () => {
        showTooltip(m);
        if (m.type === 'quête_principale') showQuestChain(m);
      });
      sub.addEventListener('mouseleave', () => {
        hideTooltip();
        if (m.type === 'quête_principale') clearQuestChain();
      });
      sub.addEventListener('click', (e) => {
        e.stopPropagation();
        pinTooltip(m);
        if (m.link) window.open(m.link, '_blank');
      });
      expanded.appendChild(sub);
    });

    markersLayer.appendChild(expanded);
    setTimeout(() => {
      document.addEventListener('click', () => {
        expanded.remove();
        isExpanded = false;
        markersLayer.querySelectorAll('.marker').forEach(m => m.classList.remove('marker-dimmed'));
      }, { once: true });
    }, 10);
  });

  el.addEventListener('mouseenter', () => {
    tooltipType.textContent = `${group.length} éléments`;
    tooltipName.textContent = group.map(m => m.name).join(', ');
    tooltipDesc.textContent = 'Cliquez pour déployer';
    tooltipLink.classList.add('hidden');
    tooltip.classList.remove('hidden');
  });
  el.addEventListener('mouseleave', hideTooltip);
  markersLayer.appendChild(el);
}

/* ══════════════════════════════════
   TOOLTIP
══════════════════════════════════ */
const TYPE_LABELS = {
  donjon:           'Donjon',
  région:           'Région',
  ressource:        'Ressource',
  marchand:         'Marchand',
  artisant:         'Artisant',
  repreneur_butin:  'Repreneur de Butin',
  quête_principale: 'Quête Principale',
  quête_secondaire: 'Quête Secondaire',
  clef:             'Clef',
  obj_special:      'Objet Spécial',
  boss:             'Boss',
};

let _pinnedTooltip    = false;
let _tooltipHideTimer = null;

function showTooltip(marker) {
  clearTimeout(_tooltipHideTimer);
  tooltipType.textContent = TYPE_LABELS[marker.type] || marker.type;
  tooltipName.textContent = marker.name;
  tooltipDesc.textContent = marker.desc;
  if (marker.link) {
    tooltipLink.href   = marker.link;
    tooltipLink.target = '_blank';
    tooltipLink.rel    = 'noopener noreferrer';
    tooltipLink.classList.remove('hidden');
  } else {
    tooltipLink.classList.add('hidden');
  }
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  if (_pinnedTooltip) return;
  if (window._zonePinActive) return;
  _tooltipHideTimer = setTimeout(() => tooltip.classList.add('hidden'), 150);
}

function pinTooltip(marker) {
  _pinnedTooltip = true;
  showTooltip(marker);
  setTimeout(() => {
    document.addEventListener('click', function onClickOutside(e) {
      if (!tooltip.contains(e.target) && !e.target.closest('.marker')) {
        _pinnedTooltip = false;
        tooltip.classList.add('hidden');
        document.removeEventListener('click', onClickOutside);
      }
    });
  }, 0);
}

/* ══════════════════════════════════
   FILTRES
══════════════════════════════════ */
const toggleAll = document.getElementById('toggle-all-filters');

toggleAll.addEventListener('change', () => {
  const checked = toggleAll.checked;
  document.querySelectorAll('.marker-filter').forEach(cb => { cb.checked = checked; });
  renderMarkers();
});

document.querySelectorAll('.marker-filter').forEach(cb => {
  cb.addEventListener('change', () => {
    const all   = document.querySelectorAll('.marker-filter');
    const allOn = [...all].every(c => c.checked);
    const none  = [...all].every(c => !c.checked);
    toggleAll.checked       = allOn;
    toggleAll.indeterminate = !allOn && !none;
    renderMarkers();
  });
});

tooltip.addEventListener('mouseenter', () => clearTimeout(_tooltipHideTimer));
tooltip.addEventListener('mouseleave', () => hideTooltip());

/* ══════════════════════════════════
   ZOOM & PAN
══════════════════════════════════ */
function applyTransform() {
  mapCanvas.style.transform = `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoomLevel})`;
  zoomLevelEl.textContent   = Math.round(zoomLevel * 100) + '%';
  renderMarkers();
}

function zoomFromPoint(vpX, vpY, factor) {
  const oldZoom = zoomLevel;
  zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * factor));
  const ratio = zoomLevel / oldZoom;
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  panOffset.x -= (vpX - cx) * (ratio - 1);
  panOffset.y -= (vpY - cy) * (ratio - 1);
  applyTransform();
}

document.getElementById('zoom-in').addEventListener('click',    () => zoomFromPoint(_vpW / 2, _vpH / 2, ZOOM_FACTOR));
document.getElementById('zoom-out').addEventListener('click',   () => zoomFromPoint(_vpW / 2, _vpH / 2, 1 / ZOOM_FACTOR));
document.getElementById('zoom-reset').addEventListener('click', () => { zoomLevel = 1; panOffset = { x: 0, y: 0 }; applyTransform(); });

mapViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const vp = clientToVp(e.clientX, e.clientY);
  zoomFromPoint(vp.x, vp.y, e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR);
}, { passive: false });

mapViewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.marker')) return;
  isPanning = true; panLastX = e.clientX; panLastY = e.clientY;
  mapViewport.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panOffset.x += e.clientX - panLastX;
  panOffset.y += e.clientY - panLastY;
  panLastX = e.clientX; panLastY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', () => { isPanning = false; mapViewport.style.cursor = 'grab'; });

mapViewport.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; isPanning = true; panLastX = t.clientX; panLastY = t.clientY;
}, { passive: true });
mapViewport.addEventListener('touchmove', (e) => {
  if (!isPanning) return;
  const t = e.touches[0];
  panOffset.x += t.clientX - panLastX; panOffset.y += t.clientY - panLastY;
  panLastX = t.clientX; panLastY = t.clientY;
  applyTransform();
}, { passive: true });
mapViewport.addEventListener('touchend', () => { isPanning = false; });

/* ══════════════════════════════════
   CONTRÔLES MOLETTE ÉTAGES
══════════════════════════════════ */
document.getElementById('wheel-up').addEventListener('click',   () => goToFloor(currentFloor - 1));
document.getElementById('wheel-down').addEventListener('click', () => goToFloor(currentFloor + 1));

document.querySelector('.wheel-display').addEventListener('wheel', (e) => {
  e.preventDefault();
  goToFloor(currentFloor + (e.deltaY > 0 ? 1 : -1));
}, { passive: false });

let wheelDragging = false, wheelDragStartY = 0, wheelDragFloor = 1;
const WHEEL_DRAG_SENSITIVITY = 18;
const wheelDisplay = document.querySelector('.wheel-display');

wheelDisplay.addEventListener('mousedown', (e) => {
  wheelDragging = true; wheelDragStartY = e.clientY; wheelDragFloor = currentFloor;
  wheelDisplay.style.cursor = 'grabbing'; e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!wheelDragging) return;
  const target = Math.max(1, Math.min(FLOOR_COUNT,
    wheelDragFloor - Math.round((e.clientY - wheelDragStartY) / WHEEL_DRAG_SENSITIVITY)));
  if (target !== currentFloor) goToFloor(target);
});
window.addEventListener('mouseup', () => {
  if (!wheelDragging) return; wheelDragging = false; wheelDisplay.style.cursor = 'grab';
});
wheelDisplay.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; wheelDragging = true; wheelDragStartY = t.clientY; wheelDragFloor = currentFloor;
}, { passive: true });
wheelDisplay.addEventListener('touchmove', (e) => {
  if (!wheelDragging) return;
  const t = e.touches[0];
  const target = Math.max(1, Math.min(FLOOR_COUNT,
    wheelDragFloor - Math.round((t.clientY - wheelDragStartY) / WHEEL_DRAG_SENSITIVITY)));
  if (target !== currentFloor) goToFloor(target);
}, { passive: true });
wheelDisplay.addEventListener('touchend', () => { wheelDragging = false; });

floorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const v = parseInt(floorInput.value); if (!isNaN(v)) goToFloor(v); }
});
floorInput.addEventListener('blur', () => {
  const v = parseInt(floorInput.value);
  if (!isNaN(v)) goToFloor(v); else floorInput.value = currentFloor;
});
document.addEventListener('keydown', (e) => {
  if (document.activeElement === floorInput) return;
  if (e.key === 'ArrowUp')   goToFloor(currentFloor + 1);
  if (e.key === 'ArrowDown') goToFloor(currentFloor - 1);
});

window.addEventListener('resize', () => { updateVpBounds(); renderMarkers(); });

/* ══════════════════════════════════
   BARRE DE RECHERCHE
══════════════════════════════════ */
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

// Mémoïsé — les données sont 100% statiques, on construit l'index une fois.
let _allMarkersCache = null;
function getAllMarkers() {
  if (_allMarkersCache) return _allMarkersCache;

  const all  = [];
  const seen = new Set();

  const sources = [
    { layer: 'surface',     src: typeof FLOOR_MARKERS !== 'undefined' ? FLOOR_MARKERS : null },
    { layer: 'underground', src: typeof FLOOR_MARKERS_UNDERGROUND !== 'undefined' ? FLOOR_MARKERS_UNDERGROUND : null },
  ];

  sources.forEach(({ layer, src }) => {
    if (!src) return;
    Object.entries(src).forEach(([floor, markers]) => {
      markers.forEach(m => {
        const key = `${layer}:${m.id}`;
        if (seen.has(key)) return;
        seen.add(key);
        const flat = m.coords ? { ...m, gx: m.coords[0].gx, gy: m.coords[0].gy } : m;
        all.push({ ...flat, floor: parseInt(floor), layer });
      });
    });
  });

  _allMarkersCache = all;
  return all;
}

// normalize → défini dans /utils.js

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (query.length < 2) { searchResults.classList.add('hidden'); return; }

  const norm    = normalize(query);
  const matches = getAllMarkers().filter(m =>
    normalize(m.name).includes(norm) ||
    normalize(m.desc || '').includes(norm) ||
    normalize(TYPE_LABELS[m.type] || m.type).includes(norm)
  ).slice(0, 12);

  searchResults.innerHTML = '';
  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-result-empty">Aucun résultat</div>';
  } else {
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <span class="search-result-emoji">${m.emoji || MARKER_EMOJI[m.type] || '📍'}</span>
        <div class="search-result-info">
          <span class="search-result-name">${m.name}</span>
          <span class="search-result-meta">${TYPE_LABELS[m.type] || m.type} · Étage ${m.floor}</span>
        </div>`;
      item.addEventListener('click', () => {
        if (m.floor !== currentFloor) goToFloor(m.floor);
		if (m.layer && m.layer !== currentLayer) {
			goToLayer(m.layer);
		}
        const allFlat = getFlatFloorMarkers(currentFloor);
        const bossMatches = allFlat.filter(bm => bm.id === m.id);
        let cx = m.gx, cy = m.gy;
        if (bossMatches.length > 1) {
          cx = bossMatches.reduce((s, bm) => s + bm.gx, 0) / bossMatches.length;
          cy = bossMatches.reduce((s, bm) => s + bm.gy, 0) / bossMatches.length;
        }
        const img = gameToPixel(cx, cy);
        panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
        panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
        _searchFocusId = m.id;
        applyTransform();
        showTooltip(m);
        searchResults.classList.add('hidden');
        searchInput.value = '';
      });
      searchResults.appendChild(item);
    });
  }
  searchResults.classList.remove('hidden');
});

mapViewport.addEventListener('click', (e) => {
  if (!e.target.closest('.marker') && !e.target.closest('.map-searchbar')) {
    _searchFocusId = null;
    renderMarkers();
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.map-searchbar')) searchResults.classList.add('hidden');
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResults.classList.add('hidden');
    searchInput.value = '';
    _searchFocusId = null;
    renderMarkers();
  }
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
updateVpBounds();

/* Parse le hash initial : #floor-3-underground, #floor-2 ou #m1z1, #m1r1… */
const _initHash = parseHash(window.location.hash);
currentLayer = _initHash.layer;
buildLayerSwitcher();
buildWheel();

requestAnimationFrame(() => {
  updateVpBounds();
  goToFloor(_initHash.floor);
  if (_initHash.focusId) {
    requestAnimationFrame(() => navigateToMapId(_initHash.focusId));
  }
});

window.addEventListener('popstate', (e) => {
  const state = e.state || parseHash();
  const layer = state.layer || 'surface';
  const floor = state.floor || 1;
  if (layer !== currentLayer) {
    currentLayer = layer;
    updateLayerBtn();
    updateGhostOverlay();
  }
  goToFloor(floor);
  if (state.focusId) {
    requestAnimationFrame(() => navigateToMapId(state.focusId));
  }
});