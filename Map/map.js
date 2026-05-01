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

/* ══════════════════════════════════
   CORRESPONDANCES TYPES
══════════════════════════════════ */
const TYPE_LABELS = {
  région:             'Région',
  donjon:             'Donjon',
  boss:               'Boss',
  zone_monstre:       'Zone Monstres',
  quête_principale:   'Quête Principale',
  quête_secondaire:   'Quête Secondaire',
  quête_tertiaire:    'Quête Tertiaire',
  craft_armes:        'Forgeron d\'Armes',
  craft_armures:      'Forgeron d\'Armures',
  craft_accessoires:  'Forgeron d\'Accessoires',
  craft_lingots:      'Forgeron de Lingots',
  craft_cles:         'Forgeron de Clés',
  craft_runes:        'Artisan de Runes',
  alchimiste:          'Alchimiste',
  bucheron:            'Bûcheron',
  refaconneur:         'Refaçonneur',
  repreneur_butin:     'Repreneur de Butin',
  repreneur_armes:     "Repreneur d'Armes",
  marchand_itinerant:  'Marchand Itinérant',
  marchand_equipement: 'Marchand d\'Équipement',
  marchand_consommable:'Marchand de Consommable',
  marchand_outils:     'Marchand d\'Outils',
  marchand_access:     'Marchand d\'Accessoires',
  marchand_occulte:    'Marchand Occulte',
  autre:               'Autre',
};

const _map_EMOJI = {
  région:             '📍',
  donjon:             '⚔️',
  boss:               '☠️',
  zone_monstre:       '💀',
  quête_principale:   '💬',
  quête_secondaire:   '❓',
  quête_tertiaire:    '📋',
  craft_armes:        '⚒️',
  craft_armures:      '🛡️',
  craft_accessoires:  '💍',
  craft_lingots:      '🔩',
  craft_cles:         '🗝️',
  craft_runes:        '💎',
  alchimiste:          '⚗️',
  bucheron:            '🪓',
  refaconneur:         '🔧',
  repreneur_butin:     '🛒',
  repreneur_armes:     '⚔️',
  marchand_itinerant:  '💰',
  marchand_equipement: '⚔️',
  marchand_consommable:'🧪',
  marchand_outils:     '🔧',
  marchand_access:     '💍',
  marchand_occulte:    '🩸',
  autre:               '🦠',
};

// Mappage pnj.type → marker type
const PNJ_TO_MARKER_TYPE = {
  "quête principale":        "quête_principale",
  "quête secondaire":        "quête_secondaire",
  "quête tertiaire":         "quête_tertiaire",
  "quêtes":                  "quête_secondaire",
  "donjon":                  "donjon",
  "forgeron d'armes":        "craft_armes",
  "forgeron d'armures":      "craft_armures",
  "forgeron d'accessoires":  "craft_accessoires",
  "forgeron de lingots":     "craft_lingots",
  "forgeron de clés":        "craft_cles",
  "alchimiste":              "alchimiste",
  "bûcheron":                "bucheron",
  "repreneur de butin":      "repreneur_butin",
  "repreneur d'armes":       "repreneur_armes",
  "refaçonneur":             "refaconneur",
  "marchand itinérant":      "marchand_itinerant",
  "marchand d'équipement":   "marchand_equipement",
  "marchand de consommable": "marchand_consommable",
  "marchand d'outils":       "marchand_outils",
  "marchand d'accessoires":  "marchand_access",
  "marchand occulte":        "marchand_occulte",
  "artisan de runes":        "craft_runes",
  "artisan_runes":           "craft_runes",
  "artisan runes":           "craft_runes",
  "fabricant secret":        "autre",
  "autres":                  "autre",
};

/* ══════════════════════════════════
   CONSTRUCTION DES MARKERS DYNAMIQUES
══════════════════════════════════ */
function buildDynamicMarkers() {
  const pnjs    = window._map_pnj     || [];
  const regions = window._map_regions || [];
  const mobs    = window._map_mobs    || [];
  const quetes  = window._map_quetes  || [];
  const donjons = window._map_donjons || [];

  // Index quêtes par pnj id ET pnj name (compat texte libre)
  const questsByRef = new Map();
  for (const q of quetes) {
    if (!q.npc) continue;
    if (!questsByRef.has(q.npc)) questsByRef.set(q.npc, []);
    questsByRef.get(q.npc).push(q);
  }

  const byFloor = {};

  // PNJs
  for (const p of pnjs) {
    if (!p.coords || !p.palier) continue;
    const f = +p.palier;
    if (!byFloor[f]) byFloor[f] = [];
    const markerType = PNJ_TO_MARKER_TYPE[(p.type || '').toLowerCase()] || 'autre';
    const linked = [
      ...(questsByRef.get(p.id)   || []),
      ...(questsByRef.get(p.name) || []),
    ];
    const questDesc = linked.map(q => q.titre || q.id).join(' · ');
    const questLink = linked.length === 1
      ? `../Quetes/quetes.html#${linked[0].id}`
      : '../Quetes/quetes.html';
    byFloor[f].push({
      id:     p.id || p._id,
      type:   markerType,
      layer:  p.is_underground ? 'underground' : 'surface',
      gx:     p.coords.x,
      gy:     p.coords.z,
      name:   p.name || p.type,
      desc:   questDesc || p.tag || '',
      link:   linked.length ? questLink : `../Bestiaire/bestiaire.html#personnages/${p.id || p._id}`,
      quests: linked,
    });
  }

  // Régions
  for (const r of regions) {
    if (!r.coords || !r.palier) continue;
    const f = +r.palier;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push({
      id:    r.id || r._id,
      type:  'région',
      layer: 'surface',
      gx:    r.coords.x,
      gy:    r.coords.z,
      name:  r.name,
      desc:  r.lore || '',
      link:  '',
    });
  }

  // Boss — Firestore mobs (migrated + creator, coords:{x,z} ou map_spawns:[{x,z}])
  const _fsBossIds = new Set();
  for (const m of mobs) {
    if ((m.type || '').toLowerCase() !== 'boss') continue;
    if (!m.palier) continue;
    const f     = +m.palier;
    const id    = m.id || m._id;
    const layer = m.is_underground ? 'underground' : 'surface';
    const spawns = m.map_spawns && m.map_spawns.length
      ? m.map_spawns
      : (m.coords && m.coords.x != null ? [{ x: m.coords.x, z: m.coords.z }] : []);
    if (!spawns.length) continue;
    if (!byFloor[f]) byFloor[f] = [];
    _fsBossIds.add(id);
    spawns.forEach((s, si) => {
      byFloor[f].push({
        id:    si === 0 ? id : `${id}_${si}`,
        type:  'boss',
        layer,
        gx:    s.x,
        gy:    s.z,
        name:  m.name,
        desc:  m.lore || '',
        link:  `../Bestiaire/bestiaire.html#monstres/${id}`,
      });
    });
  }

  // Boss — FLOOR_MARKERS (hardcodés data.js), ignorés si déjà dans Firestore
  const _addBossFloor = (floorMarkers, layer) => {
    for (const [floorStr, markers] of Object.entries(floorMarkers)) {
      const f = +floorStr;
      for (const m of markers) {
        if (m.type !== 'boss' || !m.coords || !m.coords.length) continue;
        if (_fsBossIds.has(m.id)) continue;
        if (!byFloor[f]) byFloor[f] = [];
        m.coords.forEach((c, ci) => {
          byFloor[f].push({
            id:   ci === 0 ? m.id : `${m.id}_${ci}`,
            type: 'boss',
            layer,
            gx:   c.gx,
            gy:   c.gy,
            name: m.name,
            desc: m.desc || '',
            link: m.link || `../Bestiaire/bestiaire.html#monstres/${m.id}`,
          });
        });
      }
    }
  };
  if (typeof FLOOR_MARKERS             !== 'undefined') _addBossFloor(FLOOR_MARKERS,             'surface');
  if (typeof FLOOR_MARKERS_UNDERGROUND !== 'undefined') _addBossFloor(FLOOR_MARKERS_UNDERGROUND, 'underground');

  // Donjons depuis la collection Firestore
  for (const d of donjons) {
    if (d.gx == null || d.gy == null || !d.floor) continue;
    const f = +d.floor;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push({
      id:    d._id || d.id || `donjon_db_${d.name}`,
      type:  'donjon',
      layer: 'surface',
      gx:    d.gx,
      gy:    d.gy,
      name:  d.name || 'Donjon',
      desc:  d.desc || '',
      link:  d.link || '',
    });
  }

  // Marqueurs de quêtes migrés depuis map_markers (quête_principale, _secondaire, _tertiaire)
  const QUEST_MARKER_TYPES = new Set(['quête_principale', 'quête_secondaire', 'quête_tertiaire']);
  const MM_TYPE_NORM = {
    main: 'quête_principale', primary: 'quête_principale',
    sec:  'quête_secondaire', secondary: 'quête_secondaire',
    ter:  'quête_tertiaire',  tertiary:  'quête_tertiaire',
  };

  // Index des questIds couverts par un map_marker du bon type (évite les doublons)
  const _coveredQuestIds = new Set(
    (window._map_mapMarkers || [])
      .filter(mm => mm.questId && QUEST_MARKER_TYPES.has(MM_TYPE_NORM[mm.type] || mm.type))
      .map(mm => mm.questId)
  );

  for (const mm of (window._map_mapMarkers || [])) {
    const mmType = MM_TYPE_NORM[mm.type] || mm.type;
    if (!QUEST_MARKER_TYPES.has(mmType)) continue;
    if (mm.gx == null || mm.gy == null || !mm.floor) continue;
    const f = +mm.floor;
    if (!byFloor[f]) byFloor[f] = [];
    const questLink = mm.questId
      ? `../Quetes/quetes.html#${mm.questId}`
      : (mm.link || '../Quetes/quetes.html');
    byFloor[f].push({
      id:    mm._id || mm.id || `quest_mm_${f}_${mm.name}`,
      type:  mmType,
      layer: mm.is_underground ? 'underground' : 'surface',
      gx:    +mm.gx,
      gy:    +mm.gy,
      name:  mm.name || '',
      desc:  mm.desc || '',
      link:  questLink,
    });
  }

  // Quêtes Firestore avec coords directes (nouvelles quêtes créées via le creator)
  const _FS_QUEST_TYPE = {
    main: 'quête_principale', sec: 'quête_secondaire', ter: 'quête_tertiaire',
    secondary: 'quête_secondaire', tertiary: 'quête_tertiaire',
  };
  for (const q of (window._map_quetes || [])) {
    if (!q.coords || q.coords.x == null || q.coords.z == null) continue;
    if (!q.palier) continue;
    const qid = q.id || q._id;
    if (!qid) continue;
    if (_coveredQuestIds.has(qid)) continue; // déjà couvert par un map_marker
    const markerType = _FS_QUEST_TYPE[q.type] || 'quête_principale';
    const f = +q.palier;
    if (!byFloor[f]) byFloor[f] = [];
    const npcPart = (() => {
      if (!q.npc) return '';
      const pnjs = window._map_pnj || [];
      const pnjFound = pnjs.find(p => (p.id || p._id) === q.npc);
      return `🧑 ${pnjFound ? (pnjFound.name || pnjFound.nom || q.npc) : q.npc}`;
    })();
    const descPart = q.desc || '';
    byFloor[f].push({
      id:    `fs_q_${qid}`,
      type:  markerType,
      layer: 'surface',
      gx:    +q.coords.x,
      gy:    +q.coords.z,
      name:  q.titre || qid,
      desc:  [npcPart, descPart].filter(Boolean).join(' — '),
      link:  `../Quetes/quetes.html#${qid}`,
    });
  }

  // Quêtes Firestore sans coords — fallback via région ou PNJ
  const _regionByName = new Map((regions).map(r => [r.name, r]));
  for (const q of (window._map_quetes || [])) {
    if (!q.palier) continue;
    const qid = q.id || q._id;
    if (!qid) continue;
    if (_coveredQuestIds.has(qid)) continue;
    // Skip quests already handled (have coords)
    if (q.coords && q.coords.x != null && q.coords.z != null) continue;
    const markerType = _FS_QUEST_TYPE[q.type] || 'quête_principale';
    // Fallback 1 : PNJ correspondant dans la liste
    let fallbackGx = null, fallbackGy = null;
    if (q.npc) {
      const pnjMatch = pnjs.find(p =>
        (p.id || p._id) === q.npc || (p.name || p.nom) === q.npc
      );
      if (pnjMatch?.coords) {
        fallbackGx = +pnjMatch.coords.x;
        fallbackGy = +pnjMatch.coords.z;
      }
    }
    // Fallback 2 : centre de la région/zone
    if (fallbackGx == null && q.zone) {
      const reg = _regionByName.get(q.zone);
      if (reg?.coords) {
        fallbackGx = +reg.coords.x;
        fallbackGy = +reg.coords.z;
      }
    }
    if (fallbackGx == null) continue; // Pas de position disponible
    const f = +q.palier;
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push({
      id:    `fs_q_${qid}`,
      type:  markerType,
      layer: 'surface',
      gx:    fallbackGx,
      gy:    fallbackGy,
      name:  q.titre || qid,
      desc:  [q.npc ? `🧑 ${q.npc}` : '', q.desc || ''].filter(Boolean).join(' — '),
      link:  `../Quetes/quetes.html#${qid}`,
    });
  }

  window._mapMarkers = byFloor;
}

function getFloorMarkers(floor) {
  return (window._mapMarkers || {})[floor] || [];
}

function getFlatFloorMarkers(floor) {
  return getFloorMarkers(floor).filter(m => (m.layer || 'surface') === currentLayer);
}

function getFlatOtherLayerMarkers() {
  return [];
}

/* ══════════════════════════════════
   LAYER SWITCHER
══════════════════════════════════ */
function ensureGhostOverlay() {
  let ghost = document.getElementById('map-ghost');
  if (!ghost) {
    ghost = document.createElement('img');
    ghost.id  = 'map-ghost';
    ghost.alt = '';
    ghost.style.cssText = `
      position: absolute; top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain; pointer-events: none;
      opacity: 0; transition: opacity 0.35s ease; z-index: 0;
    `;
    const mapImg = document.getElementById('map-svg');
    mapImg.parentElement.insertBefore(ghost, mapImg);
  }
  return ghost;
}

function floorHasUnderground(n) {
  if (typeof FLOOR_DATA !== 'undefined' && FLOOR_DATA[n]) return !!FLOOR_DATA[n].hasUnderground;
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

function buildLayerSwitcher() {
  const container = document.createElement('div');
  container.id = 'layer-switcher';
  container.style.cssText = `
    display: flex; align-self: stretch;
    border: 1px solid rgba(224,172,96,0.35); border-radius: 0px;
    overflow: hidden; flex-shrink: 0;
    box-shadow: 0 0 12px rgba(224,172,96,0.12), inset 0 1px 0 rgba(255,255,255,0.05);
  `;
  const tabs = [
    { layer: 'surface',     label: 'Surface',  icon: '⛰️' },
    { layer: 'underground', label: 'Sous-sol', icon: '🕳️' },
  ];
  tabs.forEach(({ layer, label, icon }) => {
    const btn = document.createElement('button');
    btn.dataset.layer = layer;
    btn.innerHTML = `<span style="font-size:13px;line-height:1">${icon}</span><span>${label}</span>`;
    btn.style.cssText = `
      display: flex; align-items: center; gap: 6px; padding: 0px 14px; height: 100%;
      font-family: 'Cinzel', serif; font-size: 11px; font-weight: 600;
      letter-spacing: 0.08em; cursor: pointer; border: none;
      border-right: 1px solid rgba(224,172,96,0.2);
      transition: background 0.15s, color 0.15s; white-space: nowrap; user-select: none;
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
    btn.style.color     = active ? '#E0AC60' : 'rgba(255,255,255,0.38)';
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

function goToLayer(layer) {
  if (layer === currentLayer) return;
  currentLayer = layer;
  updateLayerBtn();
  loadMapImage(currentFloor, currentLayer);
  history.replaceState({ floor: currentFloor, layer: currentLayer }, '', `#floor-${currentFloor}-${currentLayer}`);
  renderMarkers();
  hideTooltip();
}

/* ══════════════════════════════════
   HASH PARSING
══════════════════════════════════ */
function parseHash(hash) {
  const raw = hash || window.location.hash;
  const m = raw.match(/#floor-(\d+)(?:-(surface|underground))?/);
  return {
    floor: m ? parseInt(m[1]) : 1,
    layer: (m && m[2]) ? m[2] : 'surface',
  };
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
function gameToScreen(gx, gy) {
  const img = gameToPixel(gx, gy);
  return imageToScreen(img.x, img.y);
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
    document.getElementById('coord-xy').textContent   = `X: ${game.x}  Z: ${game.y}`;
    coordDisplay.classList.remove('hidden');
  });
  mapViewport.addEventListener('mouseleave', () => coordDisplay.classList.add('hidden'));
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
  history.pushState({ floor: n, layer: currentLayer }, '', `#floor-${n}-${currentLayer}`);
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
   CHAÎNE QUÊTES PRINCIPALES
══════════════════════════════════ */
function getQuestChainSvg() {
  let svg = document.getElementById('quest-chain-layer');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'quest-chain-layer';
    svg.style.cssText = `
      position:absolute; top:0; left:0; width:100%; height:100%;
      pointer-events:none; z-index:5; overflow:visible;
    `;
    markersLayer.parentElement.insertBefore(svg, markersLayer.nextSibling);
  }
  return svg;
}

function clearQuestChain() {
  const svg = document.getElementById('quest-chain-layer');
  if (svg) svg.innerHTML = '';
  markersLayer.querySelectorAll('.marker[data-quest-chain]').forEach(el => {
    el.removeAttribute('data-quest-chain');
    el.querySelector('.marker-icon') && (el.querySelector('.marker-icon').style.outline = '');
    el.style.zIndex = '';
  });
}

function getQuestOrder(name) {
  const m = name.match(/^(\d+)\s*[-–]/);
  return m ? parseInt(m[1]) : null;
}

function showQuestChain(hoveredMarker) {
  // Chaîne visuelle désactivée
}

/* ══════════════════════════════════
   ZONES MONSTRES (polygones Firestore)
══════════════════════════════════ */
function pointInPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i][0], yi = pts[i][1];
    const xj = pts[j][0], yj = pts[j][1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function getZoneSvg() {
  let svg = document.getElementById('zones-layer');
  if (!svg) {
    svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'zones-layer';
    svg.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;overflow:visible;';
    markersLayer.parentElement.insertBefore(svg, markersLayer);
  }
  return svg;
}

function isZoneMonstresEnabled() {
  const cb = document.querySelector('.marker-filter[data-type="zone_monstre"]');
  return cb ? cb.checked : false;
}

let _activeZoneId   = null;
let _zoneCleanupFns = new Map();

function renderZones() {
  const svg    = getZoneSvg();
  svg.innerHTML = '';
  document.querySelectorAll('.monster-pin-map').forEach(p => p.remove());
  _zoneCleanupFns.clear();
  _activeZoneId = null;

  const zones  = (window._map_zones || []).filter(z =>
    +z.floor === currentFloor &&
    (currentLayer === 'underground' ? !!z.is_underground : !z.is_underground)
  );
  const zoneOn = isZoneMonstresEnabled();
  const mobsById = new Map((window._map_mobs || []).map(m => [m.id || m._id, m]));

  let zoneTooltip = document.getElementById('zone-tooltip-map');
  if (!zoneTooltip) {
    zoneTooltip = document.createElement('div');
    zoneTooltip.id        = 'zone-tooltip-map';
    zoneTooltip.className = 'map-tooltip hidden';
    zoneTooltip.style.cssText = 'position:absolute;bottom:16px;right:16px;pointer-events:none;min-width:180px;';
    document.querySelector('.map-main').appendChild(zoneTooltip);
  }
  zoneTooltip.classList.add('hidden');

  zones.forEach(zone => {
    const rawPoly = zone.polygon || [];
    if (rawPoly.length < 3) return;
    // Normalise: accepte {x,z} (Firestore) ou [x,z] (legacy)
    const polygon = rawPoly.map(p => Array.isArray(p) ? p : [p.x ?? p.gx, p.z ?? p.gy]);
    const color = zone.color || '#e0ac60';
    const cx = zone.gx ?? polygon.reduce((s, p) => s + p[0], 0) / polygon.length;
    const cy = zone.gy ?? polygon.reduce((s, p) => s + p[1], 0) / polygon.length;

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    const sCenter = gameToScreen(cx, cy);

    function refreshPolyPoints() {
      const pts = polygon.map(p => { const s = gameToScreen(p[0], p[1]); return `${s.x},${s.y}`; }).join(' ');
      poly.setAttribute('points', pts);
    }
    refreshPolyPoints();
    zone._refreshPoly = refreshPolyPoints;

    poly.setAttribute('stroke',           color);
    poly.setAttribute('stroke-width',     '2');
    poly.setAttribute('stroke-dasharray', '6 3');
    poly.setAttribute('fill',             zoneOn ? color + '55' : color + '2a');
    poly.style.opacity       = zoneOn ? '1' : '0';
    poly.style.transition    = 'opacity .25s ease';
    poly.style.pointerEvents = 'none';

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    function refreshLabel() {
      const s = gameToScreen(cx, cy);
      label.setAttribute('x', s.x);
      label.setAttribute('y', s.y + 14);
    }
    refreshLabel();
    zone._refreshLabel = refreshLabel;

    label.setAttribute('text-anchor',       'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill',              color);
    label.setAttribute('font-family',       'JetBrains Mono, monospace');
    label.setAttribute('font-size',         '13');
    label.setAttribute('font-weight',       '700');
    label.setAttribute('stroke',            'rgba(0,0,0,0.9)');
    label.setAttribute('stroke-width',      '4');
    label.setAttribute('paint-order',       'stroke fill');
    label.style.opacity    = zoneOn ? '1' : '0';
    label.style.transition = 'opacity .25s ease';
    label.style.pointerEvents = 'none';
    label.textContent = zone.name || '';

    const cleanup = () => {
      poly.style.opacity  = isZoneMonstresEnabled() ? '1' : '0';
      poly.setAttribute('fill', isZoneMonstresEnabled() ? color + '55' : color + '2a');
      label.style.opacity = isZoneMonstresEnabled() ? '1' : '0';
      zoneTooltip.classList.add('hidden');
      document.querySelectorAll('.monster-pin-map').forEach(p => p.remove());
      _activeZoneId = null;
    };
    _zoneCleanupFns.set(zone._id || zone.id, cleanup);

    const activate = () => {
      if (_activeZoneId && _activeZoneId !== (zone._id || zone.id)) {
        const prev = _zoneCleanupFns.get(_activeZoneId);
        if (prev) prev();
      }
      _activeZoneId = zone._id || zone.id;
      poly.style.opacity = '1';
      poly.setAttribute('fill', color + '55');
      label.style.opacity = '1';

      const mobIds = zone.mobs || [];
      const resolvedMobs = mobIds.map(id => mobsById.get(id)).filter(Boolean);

      if (resolvedMobs.length) {
        const count = resolvedMobs.length;
        const deployR = Math.max(50, count * 20);
        resolvedMobs.forEach((mob, i) => {
          const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
          const mgx = cx + deployR * Math.cos(angle);
          const mgy = cy + deployR * Math.sin(angle);
          const s   = gameToScreen(mgx, mgy);
          const pin = document.createElement('div');
          pin.className    = 'marker monster-pin-map';
          pin.dataset.type = 'zone_monstre';
          pin.style.left   = s.x + 'px';
          pin.style.top    = s.y + 'px';
          const icon = document.createElement('div');
          icon.className   = 'marker-icon';
          icon.textContent = '💀';
          icon.style.background = color;
          icon.style.boxShadow  = `0 2px 12px ${color}88`;
          pin.appendChild(icon);
          pin.addEventListener('mouseenter', () => {
            showTooltip({ type: 'zone_monstre', name: mob.name || mob.id, desc: mob.lore || '', link: `../Bestiaire/bestiaire.html#monstres/${mob.id || mob._id}` });
          });
          pin.addEventListener('mouseleave', hideTooltip);
          pin.addEventListener('click', e => {
            e.stopPropagation();
            const link = `../Bestiaire/bestiaire.html#monstres/${mob.id || mob._id}`;
            window.open(link, '_blank');
          });
          markersLayer.appendChild(pin);
        });
      }

      zoneTooltip.innerHTML = `
        <div class="tooltip-type">Zone Monstres</div>
        <div class="tooltip-name" style="color:${color}">${zone.name || ''}</div>
        <div class="tooltip-desc">${resolvedMobs.map(m => m.name || m.id).join(' · ') || 'Aucun mob lié'}</div>`;
      zoneTooltip.classList.remove('hidden');
    };
    zone._activate = activate;

    g.appendChild(poly);
    g.appendChild(label);
    svg.appendChild(g);
  });

  // Fallback : FLOOR_ZONES / FLOOR_ZONES_UNDERGROUND (data.js) pour les zones pas encore dans Firestore
  const _fsZoneIds = new Set(zones.map(z => z._id || z.id));
  const _renderLegacyZones = (src, layer) => {
    if (layer !== currentLayer) return;
    (src[currentFloor] || []).forEach(zone => {
      if (_fsZoneIds.has(zone.id)) return;
      const pts = zone.points || [];
      if (pts.length < 3) return;
      const color = zone.color || '#e0ac60';
      const cx = pts.reduce((s, p) => s + p.gx, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.gy, 0) / pts.length;

      const g    = document.createElementNS('http://www.w3.org/2000/svg', 'svg').constructor === SVGSVGElement
        ? null : document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const grp  = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const refreshPts = () => {
        poly.setAttribute('points', pts.map(p => { const s = gameToScreen(p.gx, p.gy); return `${s.x},${s.y}`; }).join(' '));
      };
      refreshPts();
      zone._refreshPoly = refreshPts;
      poly.setAttribute('stroke', color); poly.setAttribute('stroke-width', '2');
      poly.setAttribute('stroke-dasharray', '6 3');
      poly.setAttribute('fill', zoneOn ? color + '55' : color + '2a');
      poly.style.opacity = zoneOn ? '1' : '0'; poly.style.transition = 'opacity .25s ease';
      poly.style.pointerEvents = 'none';

      const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      const refreshLbl = () => { const s = gameToScreen(cx, cy); lbl.setAttribute('x', s.x); lbl.setAttribute('y', s.y + 14); };
      refreshLbl();
      zone._refreshLabel = refreshLbl;
      lbl.setAttribute('text-anchor', 'middle'); lbl.setAttribute('dominant-baseline', 'middle');
      lbl.setAttribute('fill', color); lbl.setAttribute('font-family', 'JetBrains Mono, monospace');
      lbl.setAttribute('font-size', '13'); lbl.setAttribute('font-weight', '700');
      lbl.setAttribute('stroke', 'rgba(0,0,0,0.9)'); lbl.setAttribute('stroke-width', '4');
      lbl.setAttribute('paint-order', 'stroke fill');
      lbl.style.opacity = zoneOn ? '1' : '0'; lbl.style.transition = 'opacity .25s ease';
      lbl.style.pointerEvents = 'none';
      lbl.textContent = zone.name || '';

      const cleanup = () => {
        poly.style.opacity = isZoneMonstresEnabled() ? '1' : '0';
        poly.setAttribute('fill', isZoneMonstresEnabled() ? color + '55' : color + '2a');
        lbl.style.opacity = isZoneMonstresEnabled() ? '1' : '0';
        zoneTooltip.classList.add('hidden');
        document.querySelectorAll('.monster-pin-map').forEach(p => p.remove());
        _activeZoneId = null;
      };
      _zoneCleanupFns.set(zone.id, cleanup);

      zone._activate = () => {
        if (_activeZoneId && _activeZoneId !== zone.id) { const fn = _zoneCleanupFns.get(_activeZoneId); if (fn) fn(); }
        _activeZoneId = zone.id;
        poly.style.opacity = '1'; poly.setAttribute('fill', color + '55'); lbl.style.opacity = '1';
        const monsters = zone.monsters || [];
        if (monsters.length) {
          const count = monsters.length, deployR = Math.max(50, count * 20);
          monsters.forEach((mob, i) => {
            const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
            const s = gameToScreen(cx + deployR * Math.cos(angle), cy + deployR * Math.sin(angle));
            const pin = document.createElement('div');
            pin.className = 'marker monster-pin-map'; pin.dataset.type = 'zone_monstre';
            pin.style.left = s.x + 'px'; pin.style.top = s.y + 'px';
            const icon = document.createElement('div');
            icon.className = 'marker-icon'; icon.textContent = mob.emoji || '💀';
            icon.style.background = color; icon.style.boxShadow = `0 2px 12px ${color}88`;
            pin.appendChild(icon);
            pin.addEventListener('mouseenter', () => showTooltip({ type: 'zone_monstre', name: mob.name, desc: `Niv. ${mob.level || '?'} ${mob.difficulty || ''}`, link: mob.link || '' }));
            pin.addEventListener('mouseleave', hideTooltip);
            if (mob.link) pin.addEventListener('click', e => { e.stopPropagation(); window.open(mob.link, '_blank'); });
            markersLayer.appendChild(pin);
          });
        }
        zoneTooltip.innerHTML = `<div class="tooltip-type">Zone Monstres</div><div class="tooltip-name" style="color:${color}">${zone.name || ''}</div><div class="tooltip-desc">${monsters.map(m => m.name).join(' · ') || 'Aucun mob'}</div>`;
        zoneTooltip.classList.remove('hidden');
      };

      grp.appendChild(poly); grp.appendChild(lbl);
      svg.appendChild(grp);
      _fsZoneIds.add(zone.id);
    });
  };
  if (typeof FLOOR_ZONES             !== 'undefined') _renderLegacyZones(FLOOR_ZONES,             'surface');
  if (typeof FLOOR_ZONES_UNDERGROUND !== 'undefined') _renderLegacyZones(FLOOR_ZONES_UNDERGROUND, 'underground');

  // Hover hit-test
  const allZones = [...zones];
  if (typeof FLOOR_ZONES !== 'undefined') allZones.push(...(FLOOR_ZONES[currentFloor] || []).filter(z => z.polygon || z.points));

  if (allZones.length > 0) {
    let _lastZoneHover = null;
    let _hoverFrame    = false;
    let _lastX = 0, _lastY = 0;

    const hoverHandler = (e) => {
      _lastX = e.clientX; _lastY = e.clientY;
      if (_hoverFrame) return;
      _hoverFrame = true;
      requestAnimationFrame(() => {
        _hoverFrame = false;
        if (!isZoneMonstresEnabled()) return;
        const vp  = clientToVp(_lastX, _lastY);
        const img = screenToImage(vp.x, vp.y);
        const gp  = pixelToGame(img.x, img.y);
        const hit = allZones.find(z => {
          const raw  = z.polygon || (z.points ? z.points.map(p => [p.gx, p.gy]) : []);
          const poly = raw.map(p => Array.isArray(p) ? p : [p.x ?? p.gx, p.z ?? p.gy]);
          return poly.length >= 3 && pointInPolygon(gp.x, gp.y, poly);
        });
        const hitId = hit ? (hit._id || hit.id) : null;
        if (hitId === _lastZoneHover) return;
        if (_lastZoneHover) {
          const fn = _zoneCleanupFns.get(_lastZoneHover);
          if (fn) fn();
        }
        _lastZoneHover = hitId;
        if (hit && hit._activate) hit._activate();
      });
    };
    mapViewport.addEventListener('mousemove', hoverHandler);
    mapViewport._zoneHoverHandler2 = hoverHandler;
  }
}

function refreshZonePositions() {
  const zones = (window._map_zones || []).filter(z => +z.floor === currentFloor);
  zones.forEach(z => {
    if (z._refreshPoly)  z._refreshPoly();
    if (z._refreshLabel) z._refreshLabel();
  });
  document.querySelectorAll('.monster-pin-map').forEach(p => p.remove());
  if (_activeZoneId) {
    const z = zones.find(z => (z._id || z.id) === _activeZoneId);
    if (z && z._activate) z._activate();
  }
}

/* ══════════════════════════════════
   RENDU MARQUEURS
══════════════════════════════════ */
function renderMarkers() {
  clearQuestChain();
  markersLayer.innerHTML = '';
  document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());
  document.querySelectorAll('.monster-pin-map').forEach(p => p.remove());
  if (mapViewport._zoneHoverHandler2) {
    mapViewport.removeEventListener('mousemove', mapViewport._zoneHoverHandler2);
    mapViewport._zoneHoverHandler2 = null;
  }
  renderZones();

  const filterState = {};
  document.querySelectorAll('.marker-filter').forEach(cb => {
    filterState[cb.dataset.type] = cb.checked;
  });
  const isTypeVisible = (type) => filterState[type] !== false;

  const markers = getFlatFloorMarkers(currentFloor);

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
  renderGhostPin();
  renderCustomPins();
}

function renderSingleMarker(m) {
  const el = document.createElement('div');
  el.className    = 'marker';
  el.dataset.type = m.type;
  el.dataset.id   = m.id;
  el.style.left   = (m.sx ?? gameToScreen(m.gx, m.gy).x) + 'px';
  el.style.top    = (m.sy ?? gameToScreen(m.gx, m.gy).y) + 'px';

  const icon = document.createElement('div');
  icon.className   = 'marker-icon';
  icon.textContent = _map_EMOJI[m.type] || '📍';
  const pinColor = m.type !== 'région' ? (window._map_pin_colors || {})[m.type] : null;
  if (pinColor) { icon.style.background = pinColor; icon.style.boxShadow = `0 2px 10px ${pinColor}88`; }
  el.appendChild(icon);

  el.addEventListener('mouseenter', () => {
    showTooltip(m);
    if (m.type === 'quête_principale') showQuestChain(m);
  });
  el.addEventListener('mouseleave', () => {
    hideTooltip();
    if (m.type === 'quête_principale') clearQuestChain();
  });
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    pinTooltip(m);
    if (m.link) window.open(m.link, '_blank');
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
      icon.textContent = _map_EMOJI[m.type] || '📍';
      const subPinColor = m.type !== 'région' ? (window._map_pin_colors || {})[m.type] : null;
      if (subPinColor) { icon.style.background = subPinColor; icon.style.boxShadow = `0 2px 8px ${subPinColor}88`; }
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
let _pinnedTooltip    = false;
let _tooltipHideTimer = null;

function showTooltip(marker) {
  clearTimeout(_tooltipHideTimer);
  tooltipType.textContent = TYPE_LABELS[marker.type] || marker.type;
  tooltipName.textContent = marker.name;
  tooltipDesc.textContent = marker.desc || '';
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

function getAllMarkers() {
  const all = [];
  const seen = new Set();
  const byFloor = window._mapMarkers || {};
  for (const [floor, markers] of Object.entries(byFloor)) {
    for (const m of markers) {
      const key = m.id;
      if (seen.has(key)) continue;
      seen.add(key);
      all.push({ ...m, floor: parseInt(floor), layer: 'surface' });
    }
  }
  return all;
}

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
        <span class="search-result-emoji">${_map_EMOJI[m.type] || '📍'}</span>
        <div class="search-result-info">
          <span class="search-result-name">${m.name}</span>
          <span class="search-result-meta">${TYPE_LABELS[m.type] || m.type} · Étage ${m.floor}</span>
        </div>`;
      item.addEventListener('click', () => {
        if (m.floor !== currentFloor) goToFloor(m.floor);
        const img = gameToPixel(m.gx, m.gy);
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
  if (_customPinMode) {
    if (e.target.closest('.marker')) return;
    const vp   = clientToVp(e.clientX, e.clientY);
    const img  = screenToImage(vp.x, vp.y);
    const game = pixelToGame(img.x, img.y);
    addCustomPin(game.x, game.y);
    return;
  }
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
   PIN FANTÔME (depuis URL params)
══════════════════════════════════ */
let _ghostPin = null;

function parseGhostPin() {
  const p = new URLSearchParams(window.location.search);
  const gx = parseFloat(p.get('ghost_gx'));
  const gz = parseFloat(p.get('ghost_gz'));
  const floor = parseInt(p.get('ghost_floor')) || 1;
  const name  = decodeURIComponent(p.get('ghost_name') || 'Point de quête');
  if (isNaN(gx) || isNaN(gz)) return null;
  return { gx, gz, floor, name };
}

function renderGhostPin() {
  document.querySelectorAll('.ghost-pin-marker').forEach(e => e.remove());
  if (!_ghostPin || _ghostPin.floor !== currentFloor) return;
  const c = MAP_CALIBRATION[currentFloor];
  if (!c) return; // pas de calibration pour cet étage
  const s  = gameToScreen(_ghostPin.gx, _ghostPin.gz);
  const el = document.createElement('div');
  el.className = 'ghost-pin-marker marker';
  el.style.left = s.x + 'px';
  el.style.top  = s.y + 'px';
  const icon = document.createElement('div');
  icon.className   = 'marker-icon ghost-pin-icon';
  icon.textContent = '📍';
  el.appendChild(icon);
  el.addEventListener('mouseenter', () => showTooltip({ type: 'autre', name: _ghostPin.name, desc: `X: ${Math.round(_ghostPin.gx)}  ·  Z: ${Math.round(_ghostPin.gz)}`, link: '' }));
  el.addEventListener('mouseleave', hideTooltip);
  markersLayer.appendChild(el);
}

/* ══════════════════════════════════
   PINS PERSONNELS (localStorage)
══════════════════════════════════ */
const CUSTOM_PINS_KEY = 'vcl_map_custom_pins';
let _customPinMode = false;

function loadCustomPins() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_PINS_KEY) || '[]'); } catch { return []; }
}
function saveCustomPins(pins) {
  localStorage.setItem(CUSTOM_PINS_KEY, JSON.stringify(pins));
}

function renderCustomPins() {
  const pins = loadCustomPins().filter(p =>
    p.floor === currentFloor && (p.layer || 'surface') === currentLayer
  );
  pins.forEach(pin => {
    const s  = gameToScreen(pin.gx, pin.gz);
    const el = document.createElement('div');
    el.className    = 'marker custom-pin-marker';
    el.dataset.type = 'custom';
    el.style.left   = s.x + 'px';
    el.style.top    = s.y + 'px';
    const icon = document.createElement('div');
    icon.className   = 'marker-icon';
    icon.textContent = '📌';
    icon.style.background = '#1a2e1a';
    icon.style.boxShadow  = '0 2px 10px #4a8a4a88';
    el.appendChild(icon);
    el.addEventListener('mouseenter', () => showTooltip({ type: 'autre', name: pin.name, desc: pin.desc || 'Pin personnel — clic pour supprimer', link: '' }));
    el.addEventListener('mouseleave', hideTooltip);
    el.addEventListener('click', e => {
      e.stopPropagation();
      _showDeletePinDialog(pin.id, pin.name);
    });
    markersLayer.appendChild(el);
  });
}

function toggleCustomPinMode() {
  _customPinMode = !_customPinMode;
  const btn = document.getElementById('custom-pin-mode-btn');
  if (btn) btn.classList.toggle('active', _customPinMode);
  mapViewport.style.cursor = _customPinMode ? 'crosshair' : 'grab';
}

let _pendingPinCoords = null;

function addCustomPin(gx, gz) {
  _pendingPinCoords = { gx, gz };
  const dialog = document.getElementById('custom-pin-dialog');
  const input  = document.getElementById('cpd-name-input');
  const coords = document.getElementById('cpd-coords-display');
  if (coords) coords.textContent = `X: ${Math.round(gx)}  ·  Z: ${Math.round(gz)}`;
  if (input)  input.value = '';
  dialog?.classList.remove('hidden');
  setTimeout(() => input?.focus(), 40);
}

function _confirmCustomPin() {
  const name   = document.getElementById('cpd-name-input')?.value.trim();
  const dialog = document.getElementById('custom-pin-dialog');
  if (name && _pendingPinCoords) {
    const pins = loadCustomPins();
    pins.push({
      id: `custom_${Date.now()}`,
      floor: currentFloor, layer: currentLayer,
      gx: _pendingPinCoords.gx, gz: _pendingPinCoords.gz,
      name, desc: '',
    });
    saveCustomPins(pins);
    renderMarkers();
  }
  _pendingPinCoords = null;
  _customPinMode = false;
  document.getElementById('custom-pin-mode-btn')?.classList.remove('active');
  mapViewport.style.cursor = 'grab';
  dialog?.classList.add('hidden');
}

function _cancelCustomPin() {
  _pendingPinCoords = null;
  _customPinMode = false;
  document.getElementById('custom-pin-mode-btn')?.classList.remove('active');
  mapViewport.style.cursor = 'grab';
  document.getElementById('custom-pin-dialog')?.classList.add('hidden');
}

let _pendingDeletePinId = null;
function _showDeletePinDialog(pinId, pinName) {
  _pendingDeletePinId = pinId;
  const msg = document.getElementById('delete-pin-msg');
  if (msg) msg.textContent = `"${pinName}"`;
  document.getElementById('delete-pin-dialog')?.classList.remove('hidden');
}
function _confirmDeletePin() {
  if (_pendingDeletePinId) {
    saveCustomPins(loadCustomPins().filter(p => p.id !== _pendingDeletePinId));
    renderMarkers();
  }
  _pendingDeletePinId = null;
  document.getElementById('delete-pin-dialog')?.classList.add('hidden');
}
function _cancelDeletePin() {
  _pendingDeletePinId = null;
  document.getElementById('delete-pin-dialog')?.classList.add('hidden');
}

/* ══════════════════════════════════
   INIT (asynchrone — attend les données Firestore)
══════════════════════════════════ */
function applyPinColorsToLegend() {
  const colors = window._map_pin_colors || {};
  document.querySelectorAll('#legend-filters input.marker-filter[data-type]').forEach(cb => {
    const type = cb.dataset.type;
    if (type === 'région') return;
    const color = colors[type];
    if (!color) return;
    const dot = cb.nextElementSibling;
    if (dot) { dot.style.background = color; dot.style.boxShadow = `0 0 6px ${color}88`; }
  });
}

function focusQuestOnMap(questId) {
  if (!questId) return;
  const byFloor = window._mapMarkers || {};
  for (const [f, markers] of Object.entries(byFloor)) {
    const found = markers.find(m =>
      m.id === `fs_q_${questId}` ||
      (m.link && m.link.includes(`#${questId}`))
    );
    if (!found) continue;
    // Auto-activer le filtre correspondant au type de quête si pas encore coché
    const filterCb = document.querySelector(`.marker-filter[data-type="${found.type}"]`);
    if (filterCb && !filterCb.checked) {
      filterCb.checked = true;
      filterCb.dispatchEvent(new Event('change'));
    }
    const floor = +f;
    if (floor !== currentFloor) goToFloor(floor);
    _searchFocusId = found.id;
    const img = gameToPixel(found.gx, found.gy);
    panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
    panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
    applyTransform();
    return;
  }
}

function initMap() {
  buildDynamicMarkers();
  applyPinColorsToLegend();
  updateVpBounds();
  _ghostPin = parseGhostPin();
  const _initHash = parseHash(window.location.hash);
  const _urlParams = new URLSearchParams(window.location.search);
  const _questIdParam = _urlParams.get('questId');
  currentLayer = _initHash.layer;
  buildLayerSwitcher();
  buildWheel();
  document.getElementById('custom-pin-mode-btn')?.addEventListener('click', toggleCustomPinMode);
  // Déplacer les dialogs en fin de body pour éviter les conflits flex/overflow
  ['custom-pin-dialog','delete-pin-dialog'].forEach(id => {
    const el = document.getElementById(id);
    if (el) document.body.appendChild(el);
  });
  document.getElementById('cpd-confirm')?.addEventListener('click', _confirmCustomPin);
  document.getElementById('cpd-cancel')?.addEventListener('click', _cancelCustomPin);
  document.getElementById('cpd-name-input')?.addEventListener('keydown', e => {
    if (e.key === 'Enter')  _confirmCustomPin();
    if (e.key === 'Escape') _cancelCustomPin();
  });
  document.getElementById('delete-pin-confirm')?.addEventListener('click', _confirmDeletePin);
  document.getElementById('delete-pin-cancel')?.addEventListener('click', _cancelDeletePin);
  requestAnimationFrame(() => {
    updateVpBounds();
    const targetFloor = (_ghostPin && _ghostPin.floor) ? _ghostPin.floor : _initHash.floor;
    goToFloor(targetFloor);
    if (_questIdParam) {
      focusQuestOnMap(_questIdParam);
    } else if (_ghostPin && _ghostPin.floor === targetFloor) {
      const img = gameToPixel(_ghostPin.gx, _ghostPin.gz);
      panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
      panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
      applyTransform();
    }
  });
}

window._mapReady = () => {
  if (window._mapDataLoaded) initMap();
};

if (window._mapDataLoaded) initMap();

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
});
