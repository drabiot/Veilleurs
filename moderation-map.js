// ══════════════════════════════════════════════════════
// CARTE — marqueurs, zones, passages, pins (map_markers, zones, config pins)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { invalidateModCache, escHtml, setHash: _setHash, showPanel: _showPanel, db, COL, collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, deleteField, serverTimestamp, where, query, invalidateCache, toast, modal } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
window.showMapPanel = function showMapPanel() {
  _setHash('map');
  _showPanel('map-panel', 'btn-map-order');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  switchMapTab('allpins');
};

/* Marqueurs tab removed — map_markers are managed via allpins tab */

window.deleteMapMarker = async function deleteMapMarker(id) {
  const confirmed = await modal.confirm(`Supprimer ce marqueur ?`, 'Cette action est irréversible.');
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, COL.mapMarkers, id));
    invalidateModCache(COL.mapMarkers);
    invalidateCache(COL.mapMarkers);
    toast('✓ Marqueur supprimé', 'success');
  } catch (err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};

/* ══════════════════════════════════════════════════════
   ÉDITEUR DE ZONES (polygones zone_monstre)
══════════════════════════════════════════════════════ */

const ZE_SIZE = 900;           // la carte est affichée dans un repère 900×900 (calibration MAP_CALIBRATION)
const SVG_NS  = 'http://www.w3.org/2000/svg';

let _zePoints  = [];           // [{px, py, gx, gy}]
let _zeFloor   = 1;
let _zeLayer   = 'surface';
let _zeEditId  = null;         // id de la zone en cours d'édition (null = nouvelle)
let _zeZones   = [];           // zones existantes (toutes), pour l'aperçu et l'édition
let _zeCreatedAt = undefined;

// ── Pan / Zoom state ──────────────────────────────────
let _zeScale = 0.6;
let _zePanX  = 0;
let _zePanY  = 0;
let _zeDrag  = null;           // geste en cours : { kind: 'pan'|'vertex', ... }

window.showZoneEditor = function showZoneEditor() {
  _setHash('zones');
  _showPanel('zone-editor-panel', 'btn-zone-editor');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  _zeInit();
};

function _zeApplyTransform() {
  const canvas = document.getElementById('ze-canvas');
  if (canvas) canvas.style.transform = `translate(${_zePanX}px,${_zePanY}px) scale(${_zeScale})`;
  const label = document.getElementById('ze-zoom-label');
  if (label) label.textContent = Math.round(_zeScale * 100) + '%';
}

function _zeZoomAt(cx, cy, factor) {
  const newScale = Math.min(8, Math.max(0.1, _zeScale * factor));
  _zePanX  = cx - (cx - _zePanX) * (newScale / _zeScale);
  _zePanY  = cy - (cy - _zePanY) * (newScale / _zeScale);
  _zeScale = newScale;
  _zeApplyTransform();
  zeRenderSvg();
}

window.zeZoom = function zeZoom(factor) {
  const vp = document.getElementById('ze-viewport');
  if (vp) _zeZoomAt(vp.clientWidth / 2, vp.clientHeight / 2, factor);
};

window.zeZoomReset = function zeZoomReset() {
  const vp = document.getElementById('ze-viewport');
  if (!vp || !vp.clientWidth) return;
  _zeScale = Math.min(vp.clientWidth / ZE_SIZE, vp.clientHeight / ZE_SIZE);
  _zePanX  = (vp.clientWidth  - ZE_SIZE * _zeScale) / 2;
  _zePanY  = (vp.clientHeight - ZE_SIZE * _zeScale) / 2;
  _zeApplyTransform();
  zeRenderSvg();
};

// Position souris → repère image 900×900
function _zeToImg(e) {
  const rect = document.getElementById('ze-viewport').getBoundingClientRect();
  return { x: (e.clientX - rect.left - _zePanX) / _zeScale, y: (e.clientY - rect.top - _zePanY) / _zeScale };
}
const _zeClamp = v => Math.min(ZE_SIZE, Math.max(0, v));

function _zeMakePoint(px, py) {
  px = _zeClamp(px); py = _zeClamp(py);
  const g = _zePixelToGame(px, py);
  return { px, py, gx: g.x, gy: g.y };
}

function _zeInitPanZoom() {
  const vp = document.getElementById('ze-viewport');
  if (!vp || vp._zeEventsAttached) return;
  vp._zeEventsAttached = true;

  vp.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = vp.getBoundingClientRect();
    _zeZoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 1 / 1.15);
  }, { passive: false });

  vp.addEventListener('contextmenu', e => e.preventDefault());

  vp.addEventListener('mousedown', e => {
    if (e.button !== 0 && e.button !== 2) return;
    e.preventDefault();
    const vertEl = e.target.closest?.('[data-vi]');
    const midEl  = e.target.closest?.('[data-mid]');
    const zoneEl = e.target.closest?.('[data-zone]');
    const base = { sx: e.clientX, sy: e.clientY, moved: false };
    if (e.button === 2) {
      _zeDrag = { ...base, kind: 'pan', button: 2, ox: _zePanX, oy: _zePanY, vi: vertEl ? +vertEl.dataset.vi : -1 };
    } else if (vertEl) {
      _zeDrag = { ...base, kind: 'vertex', i: +vertEl.dataset.vi };
    } else if (midEl) {
      // insère un sommet au milieu de l'arête puis le déplace
      const i = +midEl.dataset.mid;
      const a = _zePoints[i], b = _zePoints[(i + 1) % _zePoints.length];
      _zePoints.splice(i + 1, 0, _zeMakePoint((a.px + b.px) / 2, (a.py + b.py) / 2));
      _zeDrag = { ...base, kind: 'vertex', i: i + 1, inserted: true };
      zeRenderSvg(); zeUpdateOutput();
    } else {
      _zeDrag = { ...base, kind: 'pan', button: 0, ox: _zePanX, oy: _zePanY, zoneId: zoneEl ? zoneEl.dataset.zone : null };
    }
    vp.style.cursor = _zeDrag.kind === 'vertex' ? 'grabbing' : '';
  });

  window.addEventListener('mousemove', e => {
    const vp2 = document.getElementById('ze-viewport');
    if (!vp2) return;
    const info = document.getElementById('ze-cursor-info');
    if (info && vp2.offsetParent) {
      const r = vp2.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        const p = _zeToImg(e);
        if (p.x >= 0 && p.y >= 0 && p.x <= ZE_SIZE && p.y <= ZE_SIZE) {
          const g = _zePixelToGame(p.x, p.y);
          info.textContent = `X: ${g.x}  Z: ${g.y}`;
        }
      }
    }
    if (!_zeDrag) return;
    const dx = e.clientX - _zeDrag.sx, dy = e.clientY - _zeDrag.sy;
    if (!_zeDrag.moved && Math.hypot(dx, dy) > 4) _zeDrag.moved = true;
    if (!_zeDrag.moved) return;
    if (_zeDrag.kind === 'pan') {
      _zePanX = _zeDrag.ox + dx;
      _zePanY = _zeDrag.oy + dy;
      _zeApplyTransform();
    } else if (_zeDrag.kind === 'vertex') {
      const p = _zeToImg(e);
      _zePoints[_zeDrag.i] = _zeMakePoint(p.x, p.y);
      zeRenderSvg();
      zeUpdateOutput();
    }
  });

  window.addEventListener('mouseup', e => {
    const d = _zeDrag;
    if (!d) return;
    _zeDrag = null;
    vp.style.cursor = '';
    if (d.kind === 'pan' && !d.moved) {
      if (d.button === 2) {
        if (d.vi >= 0) zeRemovePoint(d.vi);
      } else if (d.zoneId && _zePoints.length === 0) {
        _zeLoadZone(d.zoneId);
      } else {
        const p = _zeToImg(e);
        if (p.x >= 0 && p.y >= 0 && p.x <= ZE_SIZE && p.y <= ZE_SIZE) {
          _zePoints.push(_zeMakePoint(p.x, p.y));
          zeRenderSvg();
          zeUpdateOutput();
        }
      }
    }
  });

  // Ctrl+Z : retire le dernier sommet (uniquement quand l'éditeur est visible et qu'aucun champ n'a le focus)
  document.addEventListener('keydown', e => {
    if (!vp.offsetParent) return;
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      if (_zePoints.length) zeRemovePoint(_zePoints.length - 1);
    }
  });

  if (window.ResizeObserver) {
    let lastW = vp.clientWidth;
    new ResizeObserver(() => {
      const w = vp.clientWidth;
      if (w && !lastW) zeZoomReset();   // le panneau vient d'être affiché
      lastW = w;
    }).observe(vp);
  }
}

function _zeMapSrc() {
  return _zeLayer === 'underground'
    ? `img/maps/floor-${_zeFloor}_underground.webp`
    : `img/maps/floor-${_zeFloor}.webp`;
}

function _zeUpdateLayerButtons() {
  const sur = document.getElementById('ze-layer-surface');
  const sub = document.getElementById('ze-layer-underground');
  if (!sur || !sub) return;
  const onSurface = _zeLayer !== 'underground';
  sur.style.background = onSurface ? 'var(--accent)' : 'transparent';
  sur.style.color      = onSurface ? 'var(--on-accent)' : 'var(--muted)';
  sub.style.background = !onSurface ? 'var(--accent)' : 'transparent';
  sub.style.color      = !onSurface ? 'var(--on-accent)' : 'var(--muted)';
}

function _zeRefreshMap() {
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
  _zeUpdateLayerButtons();
  zeRenderSvg();
  _zeRenderOthers();
}

window.zeLayerChange = function zeLayerChange(layer) {
  _zeLayer = layer;
  _zeRefreshMap();
};

window.zeFloorChange = function zeFloorChange() {
  _zeFloor = parseInt(document.getElementById('ze-floor')?.value || '1');
  _zeRefreshMap();
};

async function _zeLoadZones() {
  try {
    const snap = await getDocs(collection(db, COL.zones));
    _zeZones = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  } catch (e) {
    console.warn('[ZoneEditor] chargement zones échoué', e);
  }
  zeRenderSvg();
  _zeRenderOthers();
}

function _zeInit() {
  _zeFloor = parseInt(document.getElementById('ze-floor')?.value || '1');
  _zeLayer = 'surface';
  _zePoints = [];
  _zeMobsList = [];
  _zeEditId = null;
  _zeCreatedAt = undefined;
  _zeSetMode();
  ['ze-name', 'ze-desc', 'ze-mob-search'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  const r = document.getElementById('ze-mob-results');
  if (r) r.style.display = 'none';
  const img = document.getElementById('ze-map-img');
  if (img) img.src = _zeMapSrc();
  _zeUpdateLayerButtons();
  _zeInitPanZoom();
  zeZoomReset();
  zeUpdateOutput();
  zeRenderMobList();
  _zeLoadMobs();
  _zeLoadZones();
}

function _zeSetMode() {
  const el = document.getElementById('ze-mode');
  if (!el) return;
  const z = _zeEditId && _zeZones.find(z => z._id === _zeEditId);
  el.textContent = _zeEditId ? '✏️ Édition : ' + (z?.name || _zeEditId) : 'Nouvelle zone';
  el.style.color = _zeEditId ? 'var(--accent)' : 'var(--muted)';
}

// Calibration image → jeu
function _zeCalib() {
  return (typeof MAP_CALIBRATION !== 'undefined') ? MAP_CALIBRATION[_zeFloor] : null;
}
function _zePixelToGame(px, py) {
  const c = _zeCalib();
  if (!c) return { x: Math.round(px), y: Math.round(py) };
  const scale = c.radiusGame / c.radiusPixel;
  return { x: Math.round(c.centerGame.x + (px - c.centerPixel.x) * scale), y: Math.round(c.centerGame.y + (py - c.centerPixel.y) * scale) };
}
function _zeGameToPixel(gx, gy) {
  const c = _zeCalib();
  if (!c) return { px: gx, py: gy };
  const scale = c.radiusGame / c.radiusPixel;
  return { px: c.centerPixel.x + (gx - c.centerGame.x) / scale, py: c.centerPixel.y + (gy - c.centerGame.y) / scale };
}

// Zones existantes visibles : même palier + même couche, hors zone en cours d'édition
function _zeVisibleOthers() {
  return _zeZones.filter(z => +z.floor === _zeFloor && !!z.is_underground === (_zeLayer === 'underground')
    && z._id !== _zeEditId && Array.isArray(z.polygon) && z.polygon.length >= 3);
}

function _zeSvg(tag, attrs, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(el);
  return el;
}

window.zeRenderSvg = function zeRenderSvg() {
  const svg = document.getElementById('ze-svg');
  if (!svg) return;
  const color = document.getElementById('ze-color')?.value || '#ff4444';
  const k = 1 / _zeScale;            // taille constante à l'écran quel que soit le zoom
  svg.innerHTML = '';

  // Autres zones (arrière-plan, cliquables quand aucun point n'est posé)
  _zeVisibleOthers().forEach(z => {
    const pts = z.polygon.map(p => _zeGameToPixel(p.x, p.z));
    const zc = z.color || '#e0ac60';
    _zeSvg('polygon', {
      points: pts.map(p => `${p.px},${p.py}`).join(' '),
      fill: zc + '30', stroke: zc, 'stroke-width': 1.5 * k, 'stroke-linejoin': 'round', 'stroke-dasharray': `${6 * k} ${4 * k}`,
      'data-zone': z._id, style: 'cursor:pointer;',
    }, svg).appendChild(Object.assign(document.createElementNS(SVG_NS, 'title'), { textContent: (z.name || z._id) + ' — clic pour éditer' }));
    const cx = pts.reduce((s, p) => s + p.px, 0) / pts.length;
    const cy = pts.reduce((s, p) => s + p.py, 0) / pts.length;
    const t = _zeSvg('text', {
      x: cx, y: cy, 'text-anchor': 'middle', 'dominant-baseline': 'middle', 'font-size': 11 * k, 'font-weight': 700,
      fill: '#fff', stroke: '#000', 'stroke-width': 3 * k, 'paint-order': 'stroke', style: 'pointer-events:none;',
    }, svg);
    t.textContent = z.name || '';
  });

  const n = _zePoints.length;
  if (n >= 2) {
    const pts = _zePoints.map(p => `${p.px},${p.py}`).join(' ');
    if (n >= 3) {
      _zeSvg('polygon', { points: pts, fill: color + '55', stroke: color, 'stroke-width': 2.5 * k, 'stroke-linejoin': 'round', style: 'pointer-events:none;' }, svg);
    } else {
      _zeSvg('polyline', { points: pts, fill: 'none', stroke: color, 'stroke-width': 2.5 * k, style: 'pointer-events:none;' }, svg);
    }
    // arêtes : poignée « + » au milieu pour insérer un sommet
    if (n >= 3) {
      _zePoints.forEach((a, i) => {
        const b = _zePoints[(i + 1) % n];
        const mx = (a.px + b.px) / 2, my = (a.py + b.py) / 2;
        const g = _zeSvg('g', { 'data-mid': i, style: 'cursor:copy;' }, svg);
        _zeSvg('circle', { cx: mx, cy: my, r: 6 * k, fill: '#000a', stroke: color, 'stroke-width': 1.5 * k }, g);
        _zeSvg('path', { d: `M${mx - 3 * k},${my} H${mx + 3 * k} M${mx},${my - 3 * k} V${my + 3 * k}`, stroke: '#fff', 'stroke-width': 1.5 * k, style: 'pointer-events:none;' }, g);
      });
    }
  }
  _zePoints.forEach((p, i) => {
    const g = _zeSvg('g', { 'data-vi': i, style: 'cursor:grab;' }, svg);
    _zeSvg('circle', { cx: p.px, cy: p.py, r: 9 * k, fill: color, stroke: '#fff', 'stroke-width': 2 * k }, g);
    const t = _zeSvg('text', {
      x: p.px, y: p.py, 'text-anchor': 'middle', 'dominant-baseline': 'central', 'font-size': 10 * k, 'font-weight': 700,
      fill: '#fff', stroke: '#000', 'stroke-width': 2 * k, 'paint-order': 'stroke', style: 'pointer-events:none;',
    }, g);
    t.textContent = i + 1;
  });
};

function _zeRenderOthers() {
  const el = document.getElementById('ze-others');
  if (!el) return;
  const others = _zeVisibleOthers().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  el.innerHTML = '';
  if (!others.length) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);">Aucune autre zone</div>';
    return;
  }
  others.forEach(z => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;';
    const dot = document.createElement('span');
    dot.style.cssText = 'width:12px;height:12px;border-radius:3px;flex-shrink:0;background:' + (z.color || '#e0ac60') + ';';
    const nm = document.createElement('span');
    nm.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nm.textContent = z.name || z._id;
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost btn-sm';
    btn.style.cssText = 'font-size:10px;padding:2px 8px;';
    btn.textContent = '✏️ Éditer';
    btn.addEventListener('click', () => _zeLoadZone(z._id));
    row.append(dot, nm, btn);
    el.appendChild(row);
  });
}

// Charge une zone existante dans l'éditeur (la sauvegarde la met à jour au lieu d'en créer une)
async function _zeLoadZone(id) {
  const z = _zeZones.find(z => z._id === id);
  if (!z) return;
  if (_zePoints.length && !await modal.confirm('Remplacer le tracé en cours ?', 'Les points non sauvegardés seront perdus.')) return;
  _zeEditId = id;
  _zeCreatedAt = z.createdAt;
  _zeFloor = +z.floor || 1;
  _zeLayer = z.is_underground ? 'underground' : 'surface';
  const floorSel = document.getElementById('ze-floor');
  if (floorSel) floorSel.value = String(_zeFloor);
  document.getElementById('ze-name').value = z.name || '';
  document.getElementById('ze-desc').value = z.desc || z.description || '';
  document.getElementById('ze-color').value = /^#[0-9a-f]{6}$/i.test(z.color || '') ? z.color : '#e0ac60';
  _zePoints = (z.polygon || []).map(p => {
    const px = _zeGameToPixel(p.x, p.z);
    return { px: px.px, py: px.py, gx: p.x, gy: p.z };
  });
  _zeMobsList = (z.mobs || []).map(mid => _zeMobsDb.find(m => (m._id || m.id) === mid) || { _id: mid, name: mid });
  _zeSetMode();
  _zeRefreshMap();
  zeUpdateOutput();
  zeRenderMobList();
}

window.zeRemovePoint = function zeRemovePoint(i) {
  _zePoints.splice(i, 1);
  zeRenderSvg();
  zeUpdateOutput();
};

function zeUpdateOutput() {
  const countEl = document.getElementById('ze-count');
  const listEl  = document.getElementById('ze-points-list');
  if (countEl) countEl.textContent = _zePoints.length;
  if (listEl) {
    listEl.innerHTML = _zePoints.map((p, i) => `
      <div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:2px 0;">
        <span style="color:var(--muted);min-width:16px;text-align:right;">${i + 1}.</span>
        <span style="font-family:monospace;">X:${p.gx}&nbsp; Z:${p.gy}</span>
        <button class="btn btn-ghost btn-sm" onclick="zeRemovePoint(${i})" style="margin-left:auto;font-size:10px;padding:1px 6px;color:var(--danger);">✕</button>
      </div>
    `).join('');
  }
  zeCheckSave();
}

window.zeCheckSave = function zeCheckSave() {
  const btn  = document.getElementById('ze-save-btn');
  const name = document.getElementById('ze-name')?.value?.trim();
  if (btn) btn.disabled = !(name && _zePoints.length >= 3);
};

window.zoneEditorReset = function zoneEditorReset() {
  _zePoints   = [];
  _zeMobsList = [];
  _zeEditId   = null;
  _zeCreatedAt = undefined;
  ['ze-name', 'ze-desc'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
  _zeSetMode();
  _zeRefreshMap();
  zeUpdateOutput();
  zeRenderMobList();
};

window.zoneEditorSave = async function zoneEditorSave() {
  const name  = document.getElementById('ze-name')?.value?.trim();
  const desc  = document.getElementById('ze-desc')?.value?.trim();
  const color = document.getElementById('ze-color')?.value || '#ff4444';
  if (!name)               { toast('⚠ Nom de zone obligatoire', 'warning'); return; }
  if (_zePoints.length < 3){ toast('⚠ Minimum 3 points pour un polygone', 'warning'); return; }
  const polygon = _zePoints.map(p => ({ x: p.gx, z: p.gy }));
  const cx = Math.round(_zePoints.reduce((s, p) => s + p.gx, 0) / _zePoints.length);
  const cy = Math.round(_zePoints.reduce((s, p) => s + p.gy, 0) / _zePoints.length);
  const obj = { floor: _zeFloor, name, color, polygon, gx: cx, gy: cy, is_underground: _zeLayer === 'underground' };
  const mobIds = _zeMobsList.map(m => m._id || m.id);
  try {
    if (_zeEditId) {
      // mise à jour d'une zone existante : on conserve createdAt et on écrase desc/mobs
      obj.desc = desc || '';
      obj.mobs = mobIds;
      await setDoc(doc(db, COL.zones, _zeEditId), obj, { merge: true });
    } else {
      obj.createdAt = serverTimestamp();
      if (desc) obj.desc = desc;
      if (mobIds.length > 0) obj.mobs = mobIds;
      await setDoc(doc(db, COL.zones, `zone_${Date.now()}`), obj);
    }
    toast(_zeEditId ? '✓ Zone mise à jour !' : '✓ Zone sauvegardée !', 'success');
    invalidateCache(COL.zones);
    zoneEditorReset();
    _zeLoadZones();
  } catch(err) {
    toast('⛔ Erreur : ' + err.message, 'error');
  }
};



/* ══════════════════════════════════════════════════════
   ÉDITEUR DE ZONES — Sélection de mobs
══════════════════════════════════════════════════════ */

let _zeMobsList = [];
let _zeMobsDb   = [];

async function _zeLoadMobs() {
  if (_zeMobsDb.length > 0) { _zePopulateMobSelect(); return; }
  try {
    const snap = await getDocs(collection(db, COL.mobs));
    _zeMobsDb = snap.docs.map(d => ({ _id: d.id, ...d.data() }))
      .filter(m => m.name)
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    _zePopulateMobSelect();
  } catch(e) {
    console.warn('[ZoneEditor] chargement mobs échoué', e);
  }
}

window.zeSearchMob = function zeSearchMob() {
  const q       = (document.getElementById('ze-mob-search')?.value || '').trim();
  const results = document.getElementById('ze-mob-results');
  if (!results) return;
  if (q.length < 1) { results.style.display = 'none'; return; }
  const addedIds = new Set(_zeMobsList.map(m => m._id || m.id));
  const norm     = q.toLowerCase();
  const matches  = _zeMobsDb
    .filter(m => !addedIds.has(m._id || m.id) && (m.name || '').toLowerCase().includes(norm))
    .slice(0, 15);
  results.innerHTML = '';
  if (!matches.length) {
    const noRes = document.createElement('div');
    noRes.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--muted);';
    noRes.textContent = 'Aucun résultat';
    results.appendChild(noRes);
    results.style.display = '';
    return;
  }
  matches.forEach(m => {
    const div = document.createElement('div');
    div.style.cssText = 'padding:8px 12px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--border);';
    div.innerHTML = '💀 <span>' + (m.name || m._id || m.id) + '</span>';
    div.addEventListener('mouseenter', () => { div.style.background = 'var(--surface2)'; });
    div.addEventListener('mouseleave', () => { div.style.background = ''; });
    div.addEventListener('click', e => {
      e.stopPropagation();
      zeAddMob(m._id || m.id, m.name || '');
    });
    results.appendChild(div);
  });
  results.style.display = '';
};

function _zePopulateMobSelect(selectId, filter) {
  const sel = document.getElementById(selectId || 'ze-mob-select');
  if (!sel) return;
  const addedIds = new Set(_zeMobsList.map(m => m._id || m.id));
  const q = (filter || '').toLowerCase();
  sel.innerHTML = '<option value="">— Choisir un mob —</option>' +
    _zeMobsDb.map(m => {
      const id = m._id || m.id;
      if (addedIds.has(id)) return '';
      if (q && !(m.name || '').toLowerCase().includes(q)) return '';
      return '<option value="' + id + '">' + (m.name || id) + '</option>';
    }).join('');
}

window.zeAddMobFromSelect = function zeAddMobFromSelect(selectId) {
  const sel = document.getElementById(selectId || 'ze-mob-select');
  if (!sel || !sel.value) return;
  const id  = sel.value;
  if (_zeMobsList.some(m => (m._id || m.id) === id)) { sel.value = ''; return; }
  const mob = _zeMobsDb.find(m => (m._id || m.id) === id);
  _zeMobsList.push(mob || { _id: id, name: id });
  sel.value = '';
  zeRenderMobList();
  _zePopulateMobSelect(selectId);
};

window.zeAddMob = function zeAddMob(id, name) {
  if (_zeMobsList.some(m => (m._id || m.id) === id)) return;
  const mob = _zeMobsDb.find(m => (m._id || m.id) === id);
  _zeMobsList.push(mob || { _id: id, name });
  const search  = document.getElementById('ze-mob-search');
  const results = document.getElementById('ze-mob-results');
  if (search)  search.value = '';
  if (results) results.style.display = 'none';
  zeRenderMobList();
};

window.zeRemoveMob = function zeRemoveMob(id) {
  _zeMobsList = _zeMobsList.filter(m => (m._id || m.id) !== id);
  zeRenderMobList();
};

window.zeRenderMobList = function zeRenderMobList() {
  const listEl = document.getElementById('ze-mob-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  if (!_zeMobsList.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:12px;color:var(--muted);padding:4px 0;';
    empty.textContent = 'Aucun mob lié';
    listEl.appendChild(empty);
    return;
  }
  _zeMobsList.forEach(m => {
    const id  = m._id || m.id;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;margin-bottom:4px;';
    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'font-size:13px;flex:1;';
    nameEl.textContent = '💀 ' + (m.name || id);
    const rmBtn = document.createElement('button');
    rmBtn.className = 'btn btn-ghost btn-sm';
    rmBtn.style.cssText = 'font-size:10px;padding:2px 7px;color:var(--danger);';
    rmBtn.textContent = '✕';
    rmBtn.addEventListener('click', () => zeRemoveMob(id));
    row.appendChild(nameEl);
    row.appendChild(rmBtn);
    listEl.appendChild(row);
  });
};

document.addEventListener('click', e => {
  if (!e.target.closest('#ze-mob-search') && !e.target.closest('#ze-mob-results')) {
    const r = document.getElementById('ze-mob-results');
    if (r) r.style.display = 'none';
  }
});

/* ══════════════════════════════════════════════════════
   LISTE DES ZONES
══════════════════════════════════════════════════════ */

let _zoneListAll  = [];
let _zlMobsDb     = [];

window.showZoneList = async function showZoneList() {
  _setHash('zone-list');
  _showPanel('zone-list-panel', 'btn-zone-list');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadZoneList();
};

window.loadZoneList = async function loadZoneList() {
  const el = document.getElementById('zone-list-content');
  el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snapZ, snapM] = await Promise.all([
      getDocs(collection(db, COL.zones)),
      getDocs(collection(db, COL.mobs)),
    ]);
    _zoneListAll = snapZ.docs.map(d => ({ _id: d.id, ...d.data() }));
    _zlMobsDb    = snapM.docs.map(d => ({ _id: d.id, ...d.data() }))
      .filter(m => m.name).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    renderZoneList();
  } catch(e) {
    el.innerHTML = '<div class="empty" style="color:var(--danger)">⛔ ' + e.message + '</div>';
  }
};

window.renderZoneList = function renderZoneList() {
  const el      = document.getElementById('zone-list-content');
  const floorF  = document.getElementById('zl-filter-floor')?.value || '';
  const searchF = (document.getElementById('zl-search')?.value || '').toLowerCase();
  const mobsById = new Map(_zlMobsDb.map(m => [m._id || m.id, m]));

  const filtered = _zoneListAll.filter(z => {
    if (floorF  && String(z.floor) !== floorF) return false;
    if (searchF && !(z.name || '').toLowerCase().includes(searchF)) return false;
    return true;
  }).sort((a, b) => (a.floor || 1) - (b.floor || 1) || (a.name || '').localeCompare(b.name || ''));

  if (!filtered.length) { el.innerHTML = '<div class="empty">Aucune zone</div>'; return; }

  el.innerHTML = '';
  let currentFloor = null;
  filtered.forEach(zone => {
    // En-tête de palier
    if (zone.floor !== currentFloor) {
      currentFloor = zone.floor;
      const floorHeader = document.createElement('div');
      floorHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
      floorHeader.textContent = 'Palier ' + (zone.floor || '?');
      el.appendChild(floorHeader);
    }

    const color  = zone.color || '#e0ac60';
    const mobIds = zone.mobs || [];
    const card   = document.createElement('div');
    card.id = 'zl-card-' + zone._id;
    card.style.cssText = 'border:1px solid var(--border);border-radius:8px;overflow:hidden;margin-bottom:8px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--surface2);cursor:pointer;';
    const colorDot = document.createElement('span');
    colorDot.style.cssText = 'width:14px;height:14px;border-radius:3px;flex-shrink:0;display:inline-block;background:' + color + ';';
    const nameSpan = document.createElement('span');
    nameSpan.style.cssText = 'flex:1;font-size:13px;font-weight:600;';
    nameSpan.textContent = zone.name || '—';
    const mobCount = document.createElement('span');
    mobCount.style.cssText = 'font-size:11px;color:var(--muted);';
    mobCount.textContent = mobIds.length + ' mob' + (mobIds.length > 1 ? 's' : '');
    const ugBadge = document.createElement('span');
    ugBadge.style.cssText = 'font-size:10px;padding:1px 7px;border-radius:10px;' + (zone.is_underground
      ? 'background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3);'
      : 'background:rgba(16,185,129,.1);color:#6ee7b7;border:1px solid rgba(16,185,129,.25);');
    ugBadge.textContent = zone.is_underground ? '🕳️ Sous-sol' : '🌿 Surface';
    const chevron = document.createElement('span');
    chevron.style.cssText = 'font-size:11px;color:var(--muted);';
    chevron.textContent = '▾';
    header.appendChild(colorDot);
    header.appendChild(nameSpan);
    header.appendChild(mobCount);
    header.appendChild(ugBadge);
    header.appendChild(chevron);

    const body = document.createElement('div');
    body.style.cssText = 'display:none;padding:12px 14px;';

    header.addEventListener('click', () => {
      const open = body.style.display !== 'none';
      body.style.display = open ? 'none' : '';
      chevron.textContent = open ? '▾' : '▴';
      if (!open) _renderZoneMobEditor(zone, body, mobsById, header, nameSpan, colorDot, mobCount, ugBadge);
    });

    card.appendChild(header);
    card.appendChild(body);
    el.appendChild(card);
  });
};

function _renderZoneMobEditor(zone, body, mobsById, header, nameSpan, colorDot, mobCountSpan, ugBadge) {
  body.innerHTML = '';

  // ── Champs éditables ─────────────────────────────
  const fieldsGrid = document.createElement('div');
  fieldsGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 110px 48px auto;gap:8px;margin-bottom:12px;align-items:end;';

  function _field(label, el) {
    const wrap = document.createElement('div');
    const lbl  = document.createElement('label');
    lbl.style.cssText = 'font-size:10px;color:var(--muted);display:block;margin-bottom:3px;';
    lbl.textContent = label;
    wrap.appendChild(lbl);
    wrap.appendChild(el);
    return wrap;
  }
  function _input(val) {
    const el = document.createElement('input');
    el.type = 'text';
    el.value = val || '';
    el.style.cssText = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
    return el;
  }

  const nameInput = _input(zone.name);
  const descInput = _input(zone.desc || zone.description || '');

  const floorSel = document.createElement('select');
  floorSel.style.cssText = 'width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
  [1,2,3].forEach(n => {
    const o = document.createElement('option');
    o.value = n; o.textContent = 'Palier ' + n;
    if ((zone.floor || 1) === n) o.selected = true;
    floorSel.appendChild(o);
  });

  const colorPick = document.createElement('input');
  colorPick.type  = 'color';
  colorPick.value = zone.color || '#e0ac60';
  colorPick.style.cssText = 'width:48px;height:34px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;';

  const ugCheck = document.createElement('input');
  ugCheck.type    = 'checkbox';
  ugCheck.checked = !!zone.is_underground;
  ugCheck.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:var(--accent);margin-top:6px;';

  const ugWrap = document.createElement('div');
  ugWrap.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;';
  const ugLbl = document.createElement('label');
  ugLbl.style.cssText = 'font-size:10px;color:var(--muted);';
  ugLbl.textContent = 'Sous-sol';
  ugWrap.appendChild(ugLbl);
  ugWrap.appendChild(ugCheck);

  fieldsGrid.appendChild(_field('Nom', nameInput));
  fieldsGrid.appendChild(_field('Description', descInput));
  fieldsGrid.appendChild(_field('Palier', floorSel));
  fieldsGrid.appendChild(_field('Couleur', colorPick));
  fieldsGrid.appendChild(ugWrap);
  body.appendChild(fieldsGrid);

  // Boutons Sauvegarder / Supprimer
  const actRow = document.createElement('div');
  actRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-bottom:14px;padding-bottom:14px;border-bottom:1px solid var(--border);';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn';
  saveBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:12px;';
  saveBtn.textContent = '💾 Sauvegarder';
  saveBtn.addEventListener('click', async () => {
    saveBtn.disabled = true;
    const updates = {
      name:          nameInput.value.trim(),
      desc:          descInput.value.trim(),
      floor:         parseInt(floorSel.value),
      color:         colorPick.value,
      is_underground: ugCheck.checked,
    };
    try {
      await setDoc(doc(db, COL.zones, zone._id), updates, { merge: true });
      Object.assign(zone, updates);
      invalidateCache(COL.zones);
      if (nameSpan)  nameSpan.textContent = zone.name || '—';
      if (colorDot)  colorDot.style.background = zone.color;
      if (ugBadge) {
        ugBadge.textContent = zone.is_underground ? '🕳️ Sous-sol' : '🌿 Surface';
        ugBadge.style.cssText = 'font-size:10px;padding:1px 7px;border-radius:10px;' + (zone.is_underground
          ? 'background:rgba(139,92,246,.15);color:#a78bfa;border:1px solid rgba(139,92,246,.3);'
          : 'background:rgba(16,185,129,.1);color:#6ee7b7;border:1px solid rgba(16,185,129,.25);');
      }
      toast('✓ Zone mise à jour', 'success');
    } catch(e) {
      toast('⛔ ' + e.message, 'error');
    }
    saveBtn.disabled = false;
  });

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-reject';
  delBtn.style.cssText = 'font-size:12px;';
  delBtn.textContent = '🗑️ Supprimer';
  delBtn.addEventListener('click', async () => {
    if (!await modal.confirm(`Supprimer la zone <b>${escHtml(zone.name || zone._id)}</b> ?<br>Cette action est irréversible.`, { danger: true, confirmLabel: 'Supprimer' })) return;
    try {
      await deleteDoc(doc(db, COL.zones, zone._id));
      invalidateCache(COL.zones);
      _zoneListAll = _zoneListAll.filter(z => z._id !== zone._id);
      const card = document.getElementById('zl-card-' + zone._id);
      if (card) card.remove();
      toast('✓ Zone supprimée', 'success');
    } catch(e) {
      toast('⛔ ' + e.message, 'error');
    }
  });

  actRow.appendChild(saveBtn);
  actRow.appendChild(delBtn);
  body.appendChild(actRow);

  // ── Mobs liés ────────────────────────────────────
  const mobLabel = document.createElement('div');
  mobLabel.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;';
  mobLabel.textContent = 'Mobs liés';
  body.appendChild(mobLabel);

  const listWrap = document.createElement('div');
  listWrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:10px;';

  const refreshMobList = () => {
    listWrap.innerHTML = '';
    const mobIds = zone.mobs || [];
    if (!mobIds.length) {
      const empty = document.createElement('div');
      empty.style.cssText = 'font-size:12px;color:var(--muted);';
      empty.textContent = 'Aucun mob lié';
      listWrap.appendChild(empty);
    } else {
      mobIds.forEach(id => {
        const mob  = mobsById.get(id);
        const name = mob ? mob.name : id;
        const row  = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
        const nameEl = document.createElement('span');
        nameEl.style.cssText = 'flex:1;font-size:13px;';
        nameEl.textContent = '💀 ' + name;
        const rmBtn = document.createElement('button');
        rmBtn.className = 'btn btn-ghost btn-sm';
        rmBtn.style.cssText = 'font-size:10px;padding:2px 7px;color:var(--danger);';
        rmBtn.textContent = '✕';
        rmBtn.addEventListener('click', async () => {
          const newMobs = (zone.mobs || []).filter(m => m !== id);
          await _zlSaveZoneMobs(zone, newMobs);
          zone.mobs = newMobs;
          if (mobCountSpan) mobCountSpan.textContent = newMobs.length + ' mob' + (newMobs.length > 1 ? 's' : '');
          refreshMobList();
          _zlRefreshAddSel();
        });
        row.appendChild(nameEl);
        row.appendChild(rmBtn);
        listWrap.appendChild(row);
      });
    }
  };
  refreshMobList();
  body.appendChild(listWrap);

  // Ajouter un mob — select dropdown
  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:6px;';
  const sel = document.createElement('select');
  sel.style.cssText = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;';

  const _zlRefreshAddSel = () => {
    sel.innerHTML = '<option value="">— Ajouter un mob —</option>' +
      _zlMobsDb.map(m => {
        const id = m._id || m.id;
        if ((zone.mobs || []).includes(id)) return '';
        return '<option value="' + id + '">' + (m.name || id) + '</option>';
      }).join('');
  };
  _zlRefreshAddSel();

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-ghost btn-sm';
  addBtn.textContent = '+ Ajouter';
  addBtn.addEventListener('click', async () => {
    if (!sel.value) return;
    const newMobs = [...(zone.mobs || []), sel.value];
    await _zlSaveZoneMobs(zone, newMobs);
    zone.mobs = newMobs;
    if (mobCountSpan) mobCountSpan.textContent = newMobs.length + ' mob' + (newMobs.length > 1 ? 's' : '');
    refreshMobList();
    _zlRefreshAddSel();
  });
  addRow.appendChild(sel);
  addRow.appendChild(addBtn);
  body.appendChild(addRow);
}

async function _zlSaveZoneMobs(zone, newMobs) {
  try {
    await setDoc(doc(db, COL.zones, zone._id), { mobs: newMobs }, { merge: true });
    invalidateCache(COL.zones);
    toast('✓ Zone mise à jour', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
}


/* ══════════════════════════════════════════════════════
   MIGRATION ZONES HARDCODÉES (FLOOR_ZONES / FLOOR_ZONES_UNDERGROUND → Firestore)
══════════════════════════════════════════════════════ */

window.migrateHardcodedZones = async function migrateHardcodedZones() {
  const btn = document.getElementById('btn-migrate-zones');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Migration…'; }

  // Collecte toutes les zones depuis data.js via window (compat module scope)
  const fz  = window.FLOOR_ZONES             || (typeof FLOOR_ZONES             !== 'undefined' ? FLOOR_ZONES             : null);
  const fzu = window.FLOOR_ZONES_UNDERGROUND || (typeof FLOOR_ZONES_UNDERGROUND !== 'undefined' ? FLOOR_ZONES_UNDERGROUND : null);

  const sources = [];
  if (fz)  { for (const [floor, zones] of Object.entries(fz))  zones.forEach(z => sources.push({ ...z, floor: +floor, underground: false })); }
  if (fzu) { for (const [floor, zones] of Object.entries(fzu)) zones.forEach(z => sources.push({ ...z, floor: +floor, underground: true  })); }

  if (!sources.length) {
    toast('⚠ Aucune zone trouvée dans data.js — data.js est-il chargé ?', 'error');
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Migrer data.js'; }
    return;
  }

  // Vérifie lesquelles existent déjà
  const snap = await getDocs(collection(db, COL.zones));
  const existing = new Set(snap.docs.map(d => d.id));

  let ok = 0, skip = 0, fail = 0;
  for (const z of sources) {
    if (existing.has(z.id)) { skip++; continue; }
    const polygon = (z.points || []).map(p => ({ x: p.gx, z: p.gy }));
    const cx = Math.round(polygon.reduce((s, p) => s + p.x, 0) / polygon.length);
    const cy = Math.round(polygon.reduce((s, p) => s + p.z, 0) / polygon.length);
    const mobs = (z.monsters || [])
      .map(m => { const match = (m.link || '').match(/#monstres\/(.+)$/); return match ? match[1] : null; })
      .filter(Boolean);
    const obj = { floor: z.floor, name: z.name || '', color: z.color || '#e0ac60', polygon, gx: cx, gy: cy, mobs };
    if (z.underground) obj.is_underground = true;
    try {
      await setDoc(doc(db, COL.zones, z.id), obj);
      ok++;
    } catch(e) {
      fail++;
      toast('⛔ ' + z.name + ' : ' + e.message, 'error');
      console.error('[ZoneMig]', z.id, e);
    }
  }

  invalidateCache(COL.zones);
  const msg = ok + ' migrées' + (skip ? ', ' + skip + ' déjà existantes' : '') + (fail ? ', ' + fail + ' erreurs' : '');
  toast(fail ? '⚠ ' + msg : '✓ ' + msg, fail ? 'warning' : 'success');
  if (btn) { btn.disabled = false; btn.textContent = '⚡ Migrer data.js'; }
  await loadZoneList();
};

/* ══════════════════════════════════════════════════════
   CARTE — ONGLETS (Marqueurs / Tous les pins / Couleurs)
══════════════════════════════════════════════════════ */

let _pinCategories = null;

const _DEFAULT_CATEGORIES = [
  { id: 'cat-principaux', label: '🗺️ Principaux',   types: ['donjon', 'boss', 'zone_monstre'] },
  { id: 'cat-quetes',     label: '💬 Quêtes',         types: ['quête_principale', 'quête_secondaire'] },
  { id: 'cat-craft',      label: '⚒️ Forge / Craft',  types: ['craft_cles', 'craft_secrets'] },
  { id: 'cat-artisans',   label: '🧪 Artisans',       types: ['alchimiste', 'bucheron', 'mineur', 'refaconneur'] },
  { id: 'cat-commerce',   label: '🛒 Commerce',       types: ['repreneur_butin', 'marchand_consommable', 'marchand_outils', 'marchand_access', 'marchand_ressources', 'marchand_occulte'] },
  { id: 'cat-recyclage', label: 'Recyclage', types: ['recyclage_access', 'recyclage_arme'] },
  { id: 'cat-autres',     label: '🦠 Autres',         types: ['région', 'passage'] },
];

let _allPinsList = [];
let _pinColors   = {};

window.switchMapTab = function switchMapTab(tab) {
  ['allpins', 'colors', 'emojis', 'pintypes', 'categories', 'passages'].forEach(t => {
    const div = document.getElementById('map-tab-' + t);
    const btn = document.getElementById('map-tab-btn-' + t);
    const active = t === tab;
    if (div) div.style.display = active ? '' : 'none';
    if (btn) {
      btn.style.background = active ? 'var(--accent)' : 'transparent';
      btn.style.color      = active ? '#fff'          : 'var(--muted)';
    }
  });

  if (tab === 'allpins')    loadAllMapPins();
  if (tab === 'colors')     loadPinColors();
  if (tab === 'emojis')     loadPinEmojis();
  if (tab === 'pintypes')   loadPinTypes();
  if (tab === 'categories') loadPinCategories();
  if (tab === 'passages')   loadPassages();
};

// ── PASSAGES ──────────────────────────────────────────
let _passagesList = [];       // cache local des passages chargés
let _allMarkersForPg = [];    // cache pour la recherche de pins liés
let _pgLinks = [];            // liens en cours de création (tableau d'objets {id, name})

window.loadPassages = async function loadPassages() {
  const el = document.getElementById('passages-list-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(query(
      collection(db, COL.mapMarkers),
      where('type', '==', 'passage')
    ));
    _passagesList = snap.docs.map(d => ({ _docKey: d.id, ...d.data() }));

    // Charger tous les pins linkables depuis toutes les collections
    const [allMarkersSnap, pnjSnap, mobSnap, donjonSnap, queteSnap] = await Promise.all([
      getDocs(collection(db, COL.mapMarkers)),
      getDocs(collection(db, COL.pnj)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.donjons)),
      getDocs(collection(db, COL.quetes)),
    ]);
    _allMarkersForPg = [];
    allMarkersSnap.docs.forEach(d => {
      const data = d.data();
      if (data.type === 'passage') return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.floor, type: data.type || 'marker' });
    });
    pnjSnap.docs.forEach(d => {
      const data = d.data();
      const floor = data.coords?.palier ?? data.palier ?? data.floor;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor, type: data.role || 'pnj' });
    });
    mobSnap.docs.forEach(d => {
      const data = d.data();
      if ((data.type || '').toLowerCase() !== 'boss' || !data.palier) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.palier, type: 'boss' });
    });
    donjonSnap.docs.forEach(d => {
      const data = d.data();
      if (data.gx == null || !data.floor) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor: data.floor, type: 'donjon' });
    });
    queteSnap.docs.forEach(d => {
      const data = d.data();
      const floor = data.coords?.palier ?? data.palier;
      if (!floor) return;
      _allMarkersForPg.push({ id: d.id, name: data.name || d.id, floor, type: 'quête' });
    });

    // Peupler le filtre palier
    const floors = [...new Set(_passagesList.map(p => p.floor).filter(Boolean))].sort((a, b) => +a - +b);
    const sel = document.getElementById('pg-filter-floor');
    if (sel) {
      sel.innerHTML = '<option value="">Tous les paliers</option>' +
        floors.map(f => `<option value="${f}">Palier ${f}</option>`).join('');
    }

    renderPassageList();
  } catch (err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.renderPassageList = function renderPassageList() {
  const el = document.getElementById('passages-list-content');
  if (!el) return;
  const floorF  = document.getElementById('pg-filter-floor')?.value || '';
  const searchF = (document.getElementById('pg-filter-search')?.value || '').toLowerCase();

  const list = _passagesList.filter(p => {
    if (floorF  && String(p.floor ?? '') !== floorF) return false;
    if (searchF && !(p.name || '').toLowerCase().includes(searchF)) return false;
    return true;
  });

  if (!list.length) { el.innerHTML = '<div class="empty">Aucun passage</div>'; return; }

  const byFloor = {};
  for (const p of list) {
    const f = p.floor ?? '?';
    if (!byFloor[f]) byFloor[f] = [];
    byFloor[f].push(p);
  }

  let html = '';
  for (const floor of Object.keys(byFloor).sort((a, b) => +a - +b)) {
    html += `<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);">Palier ${floor}</div>`;
    for (const p of byFloor[floor]) {
      const links = (p.links || []);
      const linksHtml = links.length
        ? links.map(id => {
            const m = _allMarkersForPg.find(x => x.id === id);
            return `<span style="background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:11px;">${escHtml(m?.name || id)}</span>`;
          }).join(' ')
        : '<span style="color:var(--muted);font-size:11px;">Aucun pin lié</span>';

      const mapHref = `Map/map.html?ghost_gx=${p.gx}&ghost_gz=${p.gy}&ghost_floor=${p.floor}&ghost_name=${encodeURIComponent(p.name || '')}#floor-${p.floor}-surface`;
      html += `
        <div style="display:flex;align-items:flex-start;gap:10px;padding:8px 10px;border:1px solid var(--border);border-radius:8px;margin-bottom:6px;background:var(--surface);">
          <span style="font-size:20px;margin-top:2px;">🚪</span>
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;font-size:13px;">${escHtml(p.name || p._docKey)}</div>
            ${p.desc ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;">${escHtml(p.desc)}</div>` : ''}
            <div style="font-size:11px;color:var(--muted);margin-top:4px;">GX ${p.gx ?? '—'} / GY ${p.gy ?? '—'}${p.layer ? ' · ' + escHtml(p.layer) : ''}</div>
            <div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px;">${linksHtml}</div>
          </div>
          <div style="display:flex;gap:4px;flex-shrink:0;">
            <a href="${mapHref}" target="_blank" class="btn btn-ghost btn-sm" style="font-size:11px;padding:3px 8px;text-decoration:none;" title="Voir sur la carte">🗺️</a>
            <button class="btn btn-ghost btn-sm" onclick="deletePassage('${escHtml(p._docKey)}')"
              style="font-size:11px;padding:3px 8px;color:var(--danger);" title="Supprimer">🗑️</button>
          </div>
        </div>`;
    }
  }
  el.innerHTML = html;
};

window.pgValidate = function pgValidate() {
  const name  = document.getElementById('pg-name')?.value.trim();
  const gx    = document.getElementById('pg-gx')?.value.trim();
  const gy    = document.getElementById('pg-gy')?.value.trim();
  const floor = document.getElementById('pg-floor')?.value.trim();
  const btn   = document.getElementById('pg-save-btn');
  if (btn) btn.disabled = !(name && gx !== '' && gy !== '' && floor);
};

window.pgReset = function pgReset() {
  ['pg-name', 'pg-gx', 'pg-gy', 'pg-floor', 'pg-layer', 'pg-desc', 'pg-link-input'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  _pgLinks = [];
  const ll = document.getElementById('pg-links-list');
  if (ll) ll.innerHTML = '';
  const err = document.getElementById('pg-create-error');
  if (err) err.style.display = 'none';
  const details = document.getElementById('passage-create-details');
  if (details) details.open = false;
  pgValidate();
};

window.pgSearchPins = async function pgSearchPins(val) {
  const res = document.getElementById('pg-link-results');
  if (!res) return;
  const q = val.trim();
  if (!q) { res.style.display = 'none'; return; }

  if (!_allMarkersForPg.length) {
    res.innerHTML = '<div style="padding:8px 10px;font-size:12px;color:var(--muted);">⏳ Chargement…</div>';
    res.style.display = '';
    await loadPassages();
    if (document.getElementById('pg-link-input')?.value !== val) return;
  }
  const nq = normalize(q);

  const matches = _allMarkersForPg
    .filter(m => !_pgLinks.find(l => l.id === m.id))
    .filter(m => fuzzyMatch(nq, normalize(m.name || m.id)))
    .slice(0, 12);

  if (!matches.length) { res.style.display = 'none'; return; }

  res.innerHTML = matches.map(m =>
    `<div style="padding:6px 10px;cursor:pointer;font-size:12px;" onmousedown="pgAddLink('${escHtml(m.id)}','${escHtml(m.name || m.id)}')"
      onmouseover="this.style.background='var(--surface2)'" onmouseout="this.style.background=''">
      📍 ${escHtml(m.name || m.id)} <span style="color:var(--muted);font-size:11px;">· P${m.floor ?? '?'}</span>
    </div>`
  ).join('');
  res.style.display = '';
};

window.pgAddLink = function pgAddLink(id, name) {
  if (_pgLinks.find(l => l.id === id)) return;
  _pgLinks.push({ id, name });
  _renderPgLinks();
  const inp = document.getElementById('pg-link-input');
  const res = document.getElementById('pg-link-results');
  if (inp) inp.value = '';
  if (res) res.style.display = 'none';
};

window.pgRemoveLink = function pgRemoveLink(id) {
  _pgLinks = _pgLinks.filter(l => l.id !== id);
  _renderPgLinks();
};

function _renderPgLinks() {
  const ll = document.getElementById('pg-links-list');
  if (!ll) return;
  ll.innerHTML = _pgLinks.map(l =>
    `<span style="display:inline-flex;align-items:center;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:2px 6px;font-size:11px;">
      ${escHtml(l.name || l.id)}
      <button onclick="pgRemoveLink('${escHtml(l.id)}')"
        style="background:none;border:none;cursor:pointer;color:var(--danger);padding:0;font-size:12px;line-height:1;">×</button>
    </span>`
  ).join('');
}

window.saveNewPassage = async function saveNewPassage() {
  const name  = document.getElementById('pg-name')?.value.trim();
  const gx    = parseFloat(document.getElementById('pg-gx')?.value);
  const gy    = parseFloat(document.getElementById('pg-gy')?.value);
  const floor = parseInt(document.getElementById('pg-floor')?.value, 10);
  const layer = document.getElementById('pg-layer')?.value.trim() || null;
  const desc  = document.getElementById('pg-desc')?.value.trim() || null;
  const errEl = document.getElementById('pg-create-error');
  const btn   = document.getElementById('pg-save-btn');

  if (!name || isNaN(gx) || isNaN(gy) || isNaN(floor)) {
    if (errEl) { errEl.textContent = 'Nom, GX, GY et Palier sont requis.'; errEl.style.display = ''; }
    return;
  }

  btn.disabled = true;
  btn.textContent = '⏳ Création…';

  try {
    const docId = 'passage_' + Date.now();
    const obj = {
      type: 'passage',
      name,
      gx,
      gy,
      floor,
      links: _pgLinks.map(l => l.id),
    };
    if (layer) obj.layer = layer;
    if (desc)  obj.desc  = desc;

    await setDoc(doc(db, COL.mapMarkers, docId), obj);
    invalidateCache(COL.mapMarkers);
    invalidateModCache(COL.mapMarkers);
    toast('Passage créé !', 'success');
    pgReset();
    await loadPassages();
  } catch (err) {
    if (errEl) { errEl.textContent = '⛔ ' + err.message; errEl.style.display = ''; }
    btn.disabled = false;
    btn.textContent = '💾 Créer le passage';
  }
};

window.deletePassage = async function deletePassage(docKey) {
  if (!confirm(`Supprimer ce passage ?`)) return;
  try {
    await deleteDoc(doc(db, COL.mapMarkers, docKey));
    invalidateCache(COL.mapMarkers);
    invalidateModCache(COL.mapMarkers);
    _passagesList = _passagesList.filter(p => p._docKey !== docKey);
    renderPassageList();
    toast('Passage supprimé.', 'success');
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
  }
};

window.loadAllMapPins = async function loadAllMapPins() {
  const el = document.getElementById('all-pins-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [pnjSnap, mobSnap, markerSnap, donjonSnap, regionSnap, queteSnap] = await Promise.all([
      getDocs(collection(db, COL.pnj)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.mapMarkers)),
      getDocs(collection(db, COL.donjons)),
      getDocs(collection(db, COL.regions)),
      getDocs(collection(db, COL.quetes)),
    ]);
    _allPinsList = [];
    pnjSnap.forEach(d => {
      const p = { _id: d.id, ...d.data(), _source: 'pnj' };
      if (p.coords) _allPinsList.push(p);
    });
    mobSnap.forEach(d => {
      const m = { _id: d.id, ...d.data(), _source: 'mob' };
      if ((m.type || '').toLowerCase() === 'boss' && m.palier) _allPinsList.push(m);
    });
    markerSnap.forEach(d => {
      _allPinsList.push({ _id: d.id, ...d.data(), _source: 'marker' });
    });
    donjonSnap.forEach(d => {
      const donjon = { _id: d.id, ...d.data(), _source: 'donjon' };
      if (donjon.gx != null && donjon.gy != null && donjon.floor) _allPinsList.push(donjon);
    });
    regionSnap.forEach(d => {
      const r = { _id: d.id, ...d.data(), _source: 'region' };
      if (r.coords && r.palier) _allPinsList.push(r);
    });
    queteSnap.forEach(d => {
      const q = { _id: d.id, ...d.data(), _source: 'quete' };
      if (q.coords?.x != null && q.palier) _allPinsList.push(q);
    });
    // Populate type filter
    const typeSel = document.getElementById('ap-filter-type');
    if (typeSel) {
      const types = [...new Set(_allPinsList.map(p => _apGetType(p)))].sort();
      typeSel.innerHTML = '<option value="">Tous les types</option>' +
        types.map(t => `<option value="${t}">${_AP_TYPE_LABELS[t] || t}</option>`).join('');
    }
    renderAllMapPins();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};


const _AP_PNJ_TO_TYPE = {
  "quête principale":        "quête_principale",
  "quête secondaire":        "quête_secondaire",
  "quête tertiaire":         "quête_tertiaire",
  "quêtes":                  "quête_secondaire",
  "donjon":                  "donjon",
  "forgeron d'armes":        "craft_armes",
  "forgeron d'armures":      "craft_armures",
  "forgeron d'accessoires":  "marchand_access",
  "forgeron de lingots":     "craft_lingots",
  "forgeron de clés":        "craft_cles",
  "forgeron d'items secrets":"craft_secrets",
  "alchimiste":              "alchimiste",
  "bûcheron":                "bucheron",
  "mineur":                  "mineur",
  "refaçonneur":             "refaconneur",
  "repreneur de butin":      "repreneur_butin",
  "repreneur d'armes":       "repreneur_armes",
  "marchand itinérant":      "marchand_itinerant",
  "marchand d'équipement":   "marchand_equipement",
  "marchand de consommable": "marchand_consommable",
  "marchand d'outils":       "marchand_outils",
  "marchand d'accessoires":  "marchand_access",
  "recyclage d'accessoires": "recyclage_access",
  "recyclage d'armes":       "recyclage_arme",
  "marchand de ressources":  "marchand_ressources",
  "marchand occulte":        "marchand_occulte",
  "fabricant secret":        "autre",
  "autres":                  "autre",
};

const _AP_TYPE_LABELS = {
  région: 'Région', donjon: 'Donjon', boss: 'Boss', mini_boss: 'Mini-Boss', zone_monstre: 'Zone Monstres',
  quête_principale: 'Quête Principale', quête_secondaire: 'Quête Secondaire', quête_tertiaire: 'Quête Fractured Underworld',
  craft_armes: "Forgeron d'Armes", craft_armures: "Forgeron d'Armures",
  craft_accessoires: "Forgeron d'Accessoires", craft_lingots: 'Forgeron de Lingots', craft_cles: 'Fabricants de Clés',
  craft_secrets: "Forgeron d'Items Secrets",
  craft_runes: 'Maître des Runes', alchimiste: 'Alchimiste', bucheron: 'Bûcheron', mineur: 'Mineur', refaconneur: 'Refaçonneur',
  repreneur_butin: 'Repreneur de Butin', repreneur_armes: "Repreneur d'Armes",
  marchand_itinerant: 'Marchand Itinérant', marchand_equipement: "Marchand d'Équipement",
  marchand_consommable: 'Marchand de Consommable', marchand_outils: "Marchand d'Outils",
  marchand_access: "Vendeur d'Accessoires", recyclage_access: "Recyclage d'Accessoires", recyclage_arme: "Recyclage d'Armes", marchand_ressources: 'Marchand de Ressources', marchand_occulte: 'Marchand Occulte',
  passage: 'Passage', autre: 'Autre',
};

function _apGetFloor(p) {
  if (p._source === 'donjon') return p.floor;
  if (p._source === 'pnj' || p._source === 'region' || p._source === 'quete') return p.palier;
  return p.floor ?? p.palier;
}
function _apGetType(p) {
  if (p._source === 'pnj')    return _AP_PNJ_TO_TYPE[(p.type || '').toLowerCase()] || 'autre';
  if (p._source === 'mob')    return 'boss';
  if (p._source === 'donjon') return 'donjon';
  if (p._source === 'region') return 'région';
  if (p._source === 'quete') {
    const QT = { main: 'quête_principale', sec: 'quête_secondaire', ter: 'quête_tertiaire', secondary: 'quête_secondaire', tertiary: 'quête_tertiaire' };
    return QT[p.type] || 'quête_principale';
  }
  return p.type || 'autre';
}
function _apGetGx(p) {
  if (p._source === 'donjon') return p.gx;
  return p.coords?.x ?? p.gx;
}
function _apGetGy(p) {
  if (p._source === 'donjon') return p.gy;
  return p.coords?.z ?? p.gy;
}

window.renderAllMapPins = function renderAllMapPins() {
  const el = document.getElementById('all-pins-content');
  if (!el) return;
  const floorF  = document.getElementById('ap-filter-floor')?.value  || '';
  const typeF   = document.getElementById('ap-filter-type')?.value   || '';
  const searchF = (document.getElementById('ap-filter-search')?.value || '').toLowerCase();

  const list = _allPinsList.filter(p => {
    if (floorF  && String(_apGetFloor(p) ?? '') !== floorF)            return false;
    if (typeF   && _apGetType(p) !== typeF)                            return false;
    if (searchF && !(p.name || '').toLowerCase().includes(searchF))   return false;
    return true;
  });

  if (!list.length) { el.innerHTML = '<div class="empty">Aucun pin</div>'; return; }

  const byFloor = {};
  for (const p of list) {
    const f = _apGetFloor(p) ?? '?';
    if (!byFloor[f]) byFloor[f] = {};
    const t = _apGetType(p);
    if (!byFloor[f][t]) byFloor[f][t] = [];
    byFloor[f][t].push(p);
  }

  const SOURCE_LABELS = { pnj: 'PNJ', mob: 'Mob', marker: 'Marqueur', donjon: 'Donjon', region: 'Région', quete: 'Quête' };
  const frag = document.createDocumentFragment();

  for (const floor of Object.keys(byFloor).sort((a, b) => +a - +b)) {
    const floorHdr = document.createElement('div');
    floorHdr.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:16px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    floorHdr.textContent = 'Palier ' + floor;
    frag.appendChild(floorHdr);

    for (const type of Object.keys(byFloor[floor]).sort()) {
      const pins = byFloor[floor][type];
      const pinColor = _pinColors[type] || null;

      const typeEmoji = _pinEmojis[type] || _DEFAULT_EMOJIS[type] || '📍';
      const typeHdr = document.createElement('div');
      typeHdr.style.cssText = 'font-size:10px;font-weight:600;color:var(--accent);margin:8px 0 4px;display:flex;align-items:center;gap:6px;';
      const dot = document.createElement('span');
      dot.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:6px;background:${pinColor || '#555'};font-size:12px;flex-shrink:0;`;
      dot.textContent = typeEmoji;
      typeHdr.appendChild(dot);
      typeHdr.appendChild(Object.assign(document.createElement('span'), {
        innerHTML: (_AP_TYPE_LABELS[type] || type) + ` <span style="color:var(--muted);font-weight:400;">(${pins.length})</span>`,
      }));
      frag.appendChild(typeHdr);

      const AP_COL = { pnj: 'personnages', mob: 'mobs', marker: 'map_markers', donjon: 'donjons', region: 'regions', quete: 'quetes' };
      const table = document.createElement('table');
      table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px;';
      table.innerHTML = `<thead><tr style="font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);">
        <th style="text-align:left;padding:3px 6px;">Nom</th>
        <th style="text-align:center;padding:3px 6px;">Emoji</th>
        <th style="text-align:center;padding:3px 6px;">Source</th>
        <th style="text-align:center;padding:3px 6px;">GX / GY</th>
        <th style="padding:3px 6px;"></th>
      </tr></thead>`;
      const tbody = document.createElement('tbody');
      for (const p of pins) {
        const gx = _apGetGx(p), gy = _apGetGy(p);
        const pFloor = _apGetFloor(p);
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid var(--border)';
        tr.innerHTML = `
          <td style="padding:4px 6px;font-weight:500;">${p.name || p._id || '—'}</td>
          <td style="text-align:center;padding:4px 6px;"></td>
          <td style="text-align:center;padding:4px 6px;color:var(--muted);">${SOURCE_LABELS[p._source] || p._source}</td>
          <td style="text-align:center;padding:4px 6px;font-family:monospace;font-size:11px;color:var(--muted);">${gx != null ? gx + ' / ' + gy : '—'}</td>
          <td style="padding:4px 6px;text-align:right;white-space:nowrap;"></td>
        `;
        // Emoji individuel inline
        const emojiInp = document.createElement('input');
        emojiInp.type = 'text';
        emojiInp.value = p.emoji || '';
        emojiInp.placeholder = _DEFAULT_EMOJIS[_apGetType(p)] || '?';
        emojiInp.title = 'Emoji individuel (vide = utilise le défaut du type)';
        emojiInp.style.cssText = 'width:36px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:16px;text-align:center;padding:2px 2px;';
        emojiInp.addEventListener('change', () => {
          saveIndividualPinEmoji(p._source, p._id, emojiInp.value.trim());
        });
        tr.querySelectorAll('td')[1].appendChild(emojiInp);

        const lastTd = tr.querySelector('td:last-child');

        if (gx != null && gy != null && pFloor != null) {
          const mapLink = document.createElement('a');
          mapLink.className = 'btn btn-ghost btn-sm';
          mapLink.style.cssText = 'font-size:11px;padding:2px 6px;text-decoration:none;margin-right:4px;';
          mapLink.title = 'Voir sur la carte';
          mapLink.textContent = '🗺️';
          mapLink.target = '_blank';
          mapLink.href = `Map/map.html?ghost_gx=${gx}&ghost_gz=${gy}&ghost_floor=${pFloor}&ghost_name=${encodeURIComponent(p.name || '')}#floor-${pFloor}-surface`;
          lastTd.appendChild(mapLink);
        }

        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-ghost btn-sm ed-edit-btn';
        editBtn.style.cssText = 'font-size:11px;padding:2px 8px;';
        editBtn.textContent = '✏️ Éditer';
        editBtn.addEventListener('click', e => {
          e.stopPropagation();
          showEditor(AP_COL[p._source] || 'personnages', p._id, p, 'allpins');
        });
        lastTd.appendChild(editBtn);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody);
      frag.appendChild(table);
    }
  }
  el.innerHTML = '';
  el.appendChild(frag);
};

window.loadPinColors = async function loadPinColors() {
  const el = document.getElementById('pin-colors-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap] = await Promise.all([
      getDoc(doc(db, 'config', 'pin_type_colors')),
      _ensureCategoriesLoaded(),
      _ensureCustomTypesLoaded(),
    ]);
    _pinColors = snap.exists() ? snap.data() : {};
    renderPinColorForm();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinColors = async function savePinColors() {
  const btn = document.getElementById('btn-save-pin-colors');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    const colors = {};
    document.querySelectorAll('#pin-colors-content input[type="color"]').forEach(inp => {
      colors[inp.dataset.type] = inp.value;
    });
    await setDoc(doc(db, 'config', 'pin_type_colors'), colors);
    _pinColors = colors;
    toast('✓ Couleurs sauvegardées', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

function renderPinColorForm() {
  const el = document.getElementById('pin-colors-content');
  if (!el) return;

  const DEFAULT_COLORS = {
    donjon: '#ef4444', boss: '#dc2626', zone_monstre: '#fb923c',
    quête_principale: '#f59e0b', quête_secondaire: '#10b981', quête_tertiaire: '#06b6d4',
    craft_armes: '#8b5cf6', craft_armures: '#7c3aed', craft_accessoires: '#a78bfa',
    craft_lingots: '#6d28d9', craft_cles: '#4c1d95', craft_secrets: '#8b3c00', craft_runes: '#3a1a6e',
    alchimiste: '#34d399', bucheron: '#65a30d', mineur: '#92400e', refaconneur: '#a16207',
    repreneur_butin: '#f59e0b', repreneur_armes: '#b45309',
    marchand_itinerant: '#eab308', marchand_equipement: '#ca8a04',
    marchand_consommable: '#84cc16', marchand_outils: '#16a34a',
    marchand_access: '#0891b2', recyclage_access: '#14b8a6', recyclage_arme: '#22c55e', marchand_ressources: '#ca8a04', marchand_occulte: '#7c3aed',
    passage: '#1a3a5c', autre: '#6b7280',
  };

  const cats = (_pinCategories || _DEFAULT_CATEGORIES).filter(c => c.types.length > 0);
  const categorized = new Set(cats.flatMap(c => c.types));
  const uncategorized = Object.keys(_AP_TYPE_LABELS).filter(t => !categorized.has(t));

  function makeColorRow(type) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
    const inp = document.createElement('input');
    inp.type = 'color';
    inp.value = _pinColors[type] || DEFAULT_COLORS[type] || '#888888';
    inp.dataset.type = type;
    inp.style.cssText = 'width:32px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;flex:1;';
    lbl.textContent = _AP_TYPE_LABELS[type] || type;
    row.appendChild(inp);
    row.appendChild(lbl);
    return row;
  }

  function makeSectionHeader(text) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    h.textContent = text;
    return h;
  }

  const frag = document.createDocumentFragment();

  for (const cat of cats) {
    frag.appendChild(makeSectionHeader(cat.label));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    cat.types.forEach(t => grid.appendChild(makeColorRow(t)));
    frag.appendChild(grid);
  }

  if (uncategorized.length > 0) {
    frag.appendChild(makeSectionHeader('🏷️ Personnalisés'));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    uncategorized.sort().forEach(t => grid.appendChild(makeColorRow(t)));
    frag.appendChild(grid);
  }

  el.innerHTML = '';
  el.appendChild(frag);
}

/* ══════════════════════════════════════════════════════
   EMOJIS DE PINS (par type + individuel)
══════════════════════════════════════════════════════ */

let _pinEmojis = {};

const _DEFAULT_EMOJIS = {
  région: '📍', donjon: '⚔️', boss: '☠️', mini_boss: '💀', zone_monstre: '💀',
  quête_principale: '💬', quête_secondaire: '❓', quête_tertiaire: '📋',
  craft_armes: '⚒️', craft_armures: '🛡️', craft_accessoires: '💍',
  craft_lingots: '🔩', craft_cles: '🗝️', craft_secrets: '🔮', craft_runes: '🔮',
  alchimiste: '⚗️', bucheron: '🪓', mineur: '⛏️', refaconneur: '🔧',
  repreneur_butin: '🛒', repreneur_armes: '⚔️',
  marchand_itinerant: '💰', marchand_equipement: '⚔️',
  marchand_consommable: '🧪', marchand_outils: '🔧',
  marchand_access: '💍', recyclage_access: '♻️', recyclage_arme: '♻️', marchand_ressources: '⛏️', marchand_occulte: '🩸',
  passage: '🚪', autre: '🦠',
};

window.loadPinEmojis = async function loadPinEmojis() {
  const el = document.getElementById('pin-emojis-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap] = await Promise.all([
      getDoc(doc(db, 'config', 'pin_type_emojis')),
      _ensureCategoriesLoaded(),
      _ensureCustomTypesLoaded(),
    ]);
    _pinEmojis = snap.exists() ? snap.data() : {};
    renderPinEmojiForm();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinEmojis = async function savePinEmojis() {
  const btn = document.getElementById('btn-save-pin-emojis');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    const emojis = {};
    document.querySelectorAll('#pin-emojis-content input[data-type]').forEach(inp => {
      if (inp.value.trim()) emojis[inp.dataset.type] = inp.value.trim();
    });
    await setDoc(doc(db, 'config', 'pin_type_emojis'), emojis);
    _pinEmojis = emojis;
    toast('✓ Emojis sauvegardés', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

window.saveIndividualPinEmoji = async function saveIndividualPinEmoji(source, id, emoji) {
  const COL_MAP = { pnj: COL.pnj, mob: COL.mobs, marker: COL.mapMarkers };
  const col = COL_MAP[source];
  if (!col || !id) return;
  try {
    const patch = emoji ? { emoji } : { emoji: deleteField() };
    await updateDoc(doc(db, col, id), patch);
    toast('✓ Emoji mis à jour', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
};

function renderPinEmojiForm() {
  const el = document.getElementById('pin-emojis-content');
  if (!el) return;

  const cats = (_pinCategories || _DEFAULT_CATEGORIES).filter(c => c.types.length > 0);
  const categorized = new Set(cats.flatMap(c => c.types));
  const uncategorized = Object.keys(_AP_TYPE_LABELS).filter(t => !categorized.has(t));

  function makeEmojiRow(type) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;';
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = _pinEmojis[type] || _DEFAULT_EMOJIS[type] || '';
    inp.dataset.type = type;
    inp.placeholder = _DEFAULT_EMOJIS[type] || '?';
    inp.style.cssText = 'width:40px;background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:18px;text-align:center;padding:2px 4px;flex-shrink:0;';
    const resetBtn = document.createElement('button');
    resetBtn.className = 'btn btn-ghost btn-sm';
    resetBtn.textContent = '↩';
    resetBtn.title = 'Réinitialiser au défaut';
    resetBtn.style.cssText = 'font-size:11px;padding:2px 6px;flex-shrink:0;';
    resetBtn.addEventListener('click', () => { inp.value = _DEFAULT_EMOJIS[type] || ''; });
    const lbl = document.createElement('span');
    lbl.style.cssText = 'font-size:12px;flex:1;';
    lbl.textContent = _AP_TYPE_LABELS[type] || type;
    row.appendChild(inp);
    row.appendChild(lbl);
    row.appendChild(resetBtn);
    return row;
  }

  function makeSectionHeader(text) {
    const h = document.createElement('div');
    h.style.cssText = 'font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:14px 0 6px;padding-bottom:4px;border-bottom:1px solid var(--border);';
    h.textContent = text;
    return h;
  }

  const frag = document.createDocumentFragment();

  for (const cat of cats) {
    frag.appendChild(makeSectionHeader(cat.label));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    cat.types.forEach(t => grid.appendChild(makeEmojiRow(t)));
    frag.appendChild(grid);
  }

  if (uncategorized.length > 0) {
    frag.appendChild(makeSectionHeader('🏷️ Personnalisés'));
    const grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;';
    uncategorized.sort().forEach(t => grid.appendChild(makeEmojiRow(t)));
    frag.appendChild(grid);
  }

  el.innerHTML = '';
  el.appendChild(frag);
}

/* ══════════════════════════════════════════════════════
   CATÉGORIES DE PINS (config/pin_categories)
══════════════════════════════════════════════════════ */

async function _ensureCategoriesLoaded() {
  if (_pinCategories !== null) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'pin_categories'));
    _pinCategories = (snap.exists() && Array.isArray(snap.data().categories))
      ? snap.data().categories
      : _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
  } catch {
    _pinCategories = _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
  }
}

window.loadPinCategories = async function loadPinCategories() {
  const el = document.getElementById('pin-categories-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDoc(doc(db, 'config', 'pin_categories'));
    _pinCategories = (snap.exists() && Array.isArray(snap.data().categories))
      ? snap.data().categories
      : _DEFAULT_CATEGORIES.map(c => ({ ...c, types: [...c.types] }));
    renderCategoryEditor();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

window.savePinCategories = async function savePinCategories() {
  _pinCategories = _readCategoryEditorState();
  const btn = document.getElementById('btn-save-pin-categories');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Sauvegarde…'; }
  try {
    await setDoc(doc(db, 'config', 'pin_categories'), { categories: _pinCategories });
    toast('✓ Catégories sauvegardées', 'success');
  } catch(err) {
    toast('⛔ ' + err.message, 'error');
  }
  if (btn) { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }
};

function _readCategoryEditorState() {
  const cards = document.querySelectorAll('#pin-categories-content .cat-card');
  const result = [];
  cards.forEach(card => {
    const id    = card.dataset.catId;
    const label = card.querySelector('.cat-label-input')?.value?.trim() || '';
    const types = [...card.querySelectorAll('.cat-type-chip[data-type]')].map(c => c.dataset.type);
    result.push({ id, label, types });
  });
  return result;
}

function renderCategoryEditor() {
  const el = document.getElementById('pin-categories-content');
  if (!el) return;

  const cats = _pinCategories || _DEFAULT_CATEGORIES;
  const allKnownTypes = [...new Set([
    ...Object.keys(_AP_TYPE_LABELS),
    ...cats.flatMap(c => c.types),
  ])].sort();

  el.innerHTML = '';

  const dl = document.createElement('datalist');
  dl.id = 'known-pin-types-list';
  allKnownTypes.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.label = _AP_TYPE_LABELS[t] || t;
    dl.appendChild(opt);
  });
  el.appendChild(dl);

  const addCatBtn = document.createElement('button');
  addCatBtn.className = 'btn btn-ghost';
  addCatBtn.style.cssText = 'font-size:12px;margin-bottom:12px;';
  addCatBtn.textContent = '+ Nouvelle catégorie';
  addCatBtn.addEventListener('click', () => _addNewCategory());
  el.appendChild(addCatBtn);

  const container = document.createElement('div');
  container.id = 'cat-list';
  container.style.cssText = 'display:flex;flex-direction:column;gap:10px;';
  cats.forEach((cat, idx) => container.appendChild(_buildCategoryCard(cat, idx, cats.length)));
  el.appendChild(container);
}

function _buildCategoryCard(cat, idx, total) {
  const card = document.createElement('div');
  card.className = 'cat-card';
  card.dataset.catId = cat.id;
  card.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;';

  const hdr = document.createElement('div');
  hdr.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:8px;';

  const labelInp = document.createElement('input');
  labelInp.className = 'cat-label-input';
  labelInp.type = 'text';
  labelInp.value = cat.label;
  labelInp.placeholder = 'Nom de la catégorie…';
  labelInp.style.cssText = 'flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 8px;font-size:12px;font-weight:600;outline:none;min-width:0;';
  hdr.appendChild(labelInp);

  if (idx > 0) {
    const upBtn = document.createElement('button');
    upBtn.className = 'btn btn-ghost btn-sm';
    upBtn.textContent = '▲';
    upBtn.title = 'Monter';
    upBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;';
    upBtn.addEventListener('click', () => _moveCat(idx, -1));
    hdr.appendChild(upBtn);
  }
  if (idx < total - 1) {
    const downBtn = document.createElement('button');
    downBtn.className = 'btn btn-ghost btn-sm';
    downBtn.textContent = '▼';
    downBtn.title = 'Descendre';
    downBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;';
    downBtn.addEventListener('click', () => _moveCat(idx, 1));
    hdr.appendChild(downBtn);
  }

  const delBtn = document.createElement('button');
  delBtn.className = 'btn btn-ghost btn-sm';
  delBtn.textContent = '🗑️';
  delBtn.title = 'Supprimer cette catégorie';
  delBtn.style.cssText = 'font-size:10px;padding:3px 6px;flex-shrink:0;color:var(--danger);';
  delBtn.addEventListener('click', () => _deleteCat(idx));
  hdr.appendChild(delBtn);

  card.appendChild(hdr);

  const typesArea = document.createElement('div');
  typesArea.className = 'cat-types-area';
  typesArea.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
  cat.types.forEach(type => typesArea.appendChild(_buildTypeChip(type)));
  card.appendChild(typesArea);

  const addRow = document.createElement('div');
  addRow.style.cssText = 'display:flex;gap:4px;margin-top:8px;';

  const typeInput = document.createElement('input');
  typeInput.type = 'text';
  typeInput.placeholder = 'type de pin… (ex: boss)';
  typeInput.setAttribute('list', 'known-pin-types-list');
  typeInput.style.cssText = 'flex:1;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:4px 8px;font-size:11px;outline:none;min-width:0;';

  const addTypeBtn = document.createElement('button');
  addTypeBtn.className = 'btn btn-ghost btn-sm';
  addTypeBtn.textContent = '+ Ajouter';
  addTypeBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
  addTypeBtn.addEventListener('click', () => {
    const val = typeInput.value.trim();
    if (!val) return;
    if (typesArea.querySelector(`.cat-type-chip[data-type="${CSS.escape(val)}"]`)) {
      toast('Ce type est déjà dans cette catégorie', 'error'); return;
    }
    typesArea.appendChild(_buildTypeChip(val));
    typeInput.value = '';
    typeInput.focus();
  });
  typeInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); addTypeBtn.click(); } });

  addRow.appendChild(typeInput);
  addRow.appendChild(addTypeBtn);
  card.appendChild(addRow);

  return card;
}

function _buildTypeChip(type) {
  const chip = document.createElement('span');
  chip.className = 'cat-type-chip';
  chip.dataset.type = type;
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:2px 6px 2px 4px;background:var(--surface);border:1px solid var(--border);border-radius:4px;font-size:11px;';

  const color = (_pinColors || {})[type] || null;
  const dot = document.createElement('span');
  dot.style.cssText = `display:inline-block;width:8px;height:8px;border-radius:2px;background:${color || '#666'};flex-shrink:0;`;
  chip.appendChild(dot);

  const emoji = (_pinEmojis || {})[type] || _DEFAULT_EMOJIS[type] || '📍';
  const emojiSpan = document.createElement('span');
  emojiSpan.textContent = emoji;
  chip.appendChild(emojiSpan);

  const lblSpan = document.createElement('span');
  lblSpan.textContent = _AP_TYPE_LABELS[type] || type;
  chip.appendChild(lblSpan);

  const removeBtn = document.createElement('button');
  removeBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--muted);padding:0 0 0 2px;font-size:12px;line-height:1;flex-shrink:0;';
  removeBtn.textContent = '×';
  removeBtn.title = 'Retirer de cette catégorie';
  removeBtn.addEventListener('click', () => chip.remove());
  chip.appendChild(removeBtn);

  return chip;
}

function _moveCat(idx, dir) {
  const state = _readCategoryEditorState();
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= state.length) return;
  [state[idx], state[newIdx]] = [state[newIdx], state[idx]];
  _pinCategories = state;
  renderCategoryEditor();
}

function _deleteCat(idx) {
  if (!confirm('Supprimer cette catégorie ?')) return;
  const state = _readCategoryEditorState();
  state.splice(idx, 1);
  _pinCategories = state;
  renderCategoryEditor();
}

function _addNewCategory() {
  const state = _readCategoryEditorState();
  state.push({ id: 'cat-' + Date.now(), label: '', types: [] });
  _pinCategories = state;
  renderCategoryEditor();
  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('#pin-categories-content .cat-card');
    const last = cards[cards.length - 1];
    if (last) {
      last.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      last.querySelector('.cat-label-input')?.focus();
    }
  });
}

/* ══════════════════════════════════════════════════════
   ONGLET TYPES DE PINS — liste et création de types
   (config/custom_pin_types + types natifs _AP_TYPE_LABELS)
══════════════════════════════════════════════════════ */

let _customPinTypes = [];

window.loadPinTypes = async function loadPinTypes() {
  const el = document.getElementById('pin-types-content');
  if (el) el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDoc(doc(db, 'config', 'custom_pin_types'));
    _customPinTypes = (snap.exists() && Array.isArray(snap.data().types)) ? snap.data().types : [];
    _mergeCustomPinTypes();
    renderPinTypesList();
  } catch(err) {
    if (el) el.innerHTML = `<div class="empty" style="color:var(--danger)">⛔ ${err.message}</div>`;
  }
};

function _mergeCustomPinTypes() {
  for (const ct of _customPinTypes) {
    if (!ct.id) continue;
    _AP_TYPE_LABELS[ct.id] = ct.label || ct.id;
    // Mapping PNJ type → pin type (identity pour les types custom)
    _AP_PNJ_TO_TYPE[ct.id] = ct.id;
  }
}

async function _ensureCustomTypesLoaded() {
  if (_customPinTypes.length > 0) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'custom_pin_types'));
    _customPinTypes = (snap.exists() && Array.isArray(snap.data().types)) ? snap.data().types : [];
    _mergeCustomPinTypes();
  } catch { _customPinTypes = []; }
}

function renderPinTypesList() {
  const el = document.getElementById('pin-types-content');
  if (!el) return;
  el.innerHTML = '';

  // Formulaire création
  el.appendChild(_buildAddPinTypeForm());

  // Table — types natifs + custom
  const table = document.createElement('table');
  table.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;margin-top:4px;';
  table.innerHTML = `<thead><tr style="font-size:10px;color:var(--muted);border-bottom:1px solid var(--border);">
    <th style="text-align:left;padding:5px 8px;">Nom</th>
    <th style="text-align:left;padding:5px 8px;font-family:monospace;">ID</th>
    <th style="padding:5px 8px;"></th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');

  // Types natifs (lecture seule)
  for (const [id, label] of Object.entries(_AP_TYPE_LABELS).sort((a,b) => a[1].localeCompare(b[1]))) {
    const isCustom = _customPinTypes.some(ct => ct.id === id);
    if (isCustom) continue; // affiché dans la section custom ci-dessous
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding:5px 8px;">${label}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:11px;color:var(--muted);">${id}</td>
      <td style="padding:5px 8px;text-align:right;"><span style="font-size:10px;color:var(--muted);padding:2px 5px;border:1px solid var(--border);border-radius:4px;">natif</span></td>
    `;
    tbody.appendChild(tr);
  }

  // Types custom (supprimables)
  for (const ct of _customPinTypes) {
    const tr = document.createElement('tr');
    tr.style.borderBottom = '1px solid var(--border)';
    tr.innerHTML = `
      <td style="padding:5px 8px;font-weight:500;">${ct.label || ct.id}</td>
      <td style="padding:5px 8px;font-family:monospace;font-size:11px;color:var(--accent);">${ct.id}</td>
      <td style="padding:5px 8px;text-align:right;"></td>
    `;
    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-ghost btn-sm';
    delBtn.style.cssText = 'font-size:11px;padding:2px 6px;color:var(--danger);';
    delBtn.textContent = '🗑️';
    delBtn.title = 'Supprimer ce type';
    delBtn.addEventListener('click', async () => {
      if (!confirm(`Supprimer le type "${ct.id}" ?`)) return;
      _customPinTypes = _customPinTypes.filter(c => c.id !== ct.id);
      try {
        await setDoc(doc(db, 'config', 'custom_pin_types'), { types: _customPinTypes });
        delete _AP_TYPE_LABELS[ct.id];
        toast('✓ Type supprimé', 'success');
        renderPinTypesList();
      } catch(err) { toast('⛔ ' + err.message, 'error'); }
    });
    tr.querySelector('td:last-child').appendChild(delBtn);
    tbody.appendChild(tr);
  }

  table.appendChild(tbody);
  el.appendChild(table);
}

function _buildAddPinTypeForm() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px;margin-bottom:12px;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:12px;font-weight:700;margin-bottom:8px;';
  title.textContent = '+ Nouveau type de pin';
  wrap.appendChild(title);

  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;align-items:flex-end;';
  const inputStyle = 'background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;box-sizing:border-box;';

  function field(lbl, inp) {
    const w = document.createElement('div');
    w.style.flex = '1';
    const l = document.createElement('label');
    l.style.cssText = 'font-size:10px;color:var(--muted);display:block;margin-bottom:2px;';
    l.textContent = lbl;
    w.appendChild(l);
    inp.style.cssText = inputStyle + 'width:100%;';
    w.appendChild(inp);
    return w;
  }

  const labelInp = Object.assign(document.createElement('input'), { type:'text', placeholder:'Nom affiché *  (ex: Crates)' });
  const idInp    = Object.assign(document.createElement('input'), { type:'text', placeholder:'ID *  (ex: crates)' });
  idInp.style.fontFamily = 'monospace';

  row.appendChild(field('Nom *', labelInp));
  row.appendChild(field('ID *', idInp));

  const addBtn = document.createElement('button');
  addBtn.className = 'btn';
  addBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:12px;flex-shrink:0;align-self:flex-end;';
  addBtn.textContent = '✓ Ajouter';
  addBtn.addEventListener('click', async () => {
    const label = labelInp.value.trim();
    const id    = idInp.value.trim().toLowerCase().replace(/\s+/g, '_');
    if (!label) { toast('⛔ Nom requis', 'error'); return; }
    if (!id)    { toast('⛔ ID requis', 'error'); return; }
    if (_AP_TYPE_LABELS[id]) { toast(`⛔ ID "${id}" déjà utilisé`, 'error'); return; }

    _customPinTypes.push({ id, label });
    try {
      await setDoc(doc(db, 'config', 'custom_pin_types'), { types: _customPinTypes });
      _AP_TYPE_LABELS[id] = label;
      toast(`✓ Type "${label}" créé`, 'success');
      renderPinTypesList();
    } catch(err) {
      _customPinTypes.pop();
      toast('⛔ ' + err.message, 'error');
    }
  });

  row.appendChild(addBtn);
  wrap.appendChild(row);
  return wrap;
}
}
