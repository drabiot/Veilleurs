/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const sidebarTree   = document.getElementById('sidebar-tree');
const searchInput   = document.getElementById('sidebar-search');
const placeholder   = document.getElementById('glossary-placeholder');
const itemDisplay   = document.getElementById('item-display');
const sortPalierBtn = document.getElementById('sort-palier');
const sortAlphaBtn  = document.getElementById('sort-alpha');

/* ══════════════════════════════════
   ÉTAT TRI
══════════════════════════════════ */
let currentSort = 'palier'; // 'palier' | 'alpha'

sortPalierBtn.addEventListener('click', () => {
  currentSort = 'palier';
  sortPalierBtn.classList.add('active');
  sortAlphaBtn.classList.remove('active');
  buildSidebar(currentItems());
});

sortAlphaBtn.addEventListener('click', () => {
  currentSort = 'alpha';
  sortAlphaBtn.classList.add('active');
  sortPalierBtn.classList.remove('active');
  buildSidebar(currentItems());
});

/* Renvoie la liste filtrée/triée selon l'état courant */
function currentItems() {
  const q = searchInput.value.trim();
  const norm = normalize(q);
  ITEMS.forEach(item => {
	if (typeof item.name !== 'string') console.warn('Item sans name string:', item);
	if (item.lore !== undefined && typeof item.lore !== 'string') console.warn('Lore invalide:', item);
	});
  const filtered = q.length >= 1
    ? ITEMS.filter(item =>
        normalize(String(item.name  || '')).includes(norm) ||
        normalize(String(item.lore  || '')).includes(norm) ||
        normalize(catData(item.category).label || '').includes(norm) ||
        (item.tags || []).some(t => t != null && normalize(String(t)).includes(norm))
      )
    : [...ITEMS];
  return filtered;
}

/* Construit une sidebar à plat A→Z (sans paliers/catégories) */
function buildSidebarAlpha(items) {
  sidebarTree.innerHTML = '';
  const sorted = [...items].sort((a, b) =>
    normalize(a.name).localeCompare(normalize(b.name))
  );

  if (sorted.length === 0) {
    sidebarTree.innerHTML = '<div class="sidebar-empty">Aucun résultat</div>';
    return;
  }

  sorted.forEach(item => {
    const link = document.createElement('a');
    link.className  = 'sidebar-item sidebar-item-flat';
    link.href       = `#${item.id}`;
    link.dataset.id = item.id;
    const color = rarityColor(item.rarity);
    link.innerHTML = `
      <span class="sidebar-item-dot" style="background:${color}"></span>
      ${item.name}`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showItem(item.id);
      history.pushState({ item: item.id }, '', `#${item.id}`);
    });
    sidebarTree.appendChild(link);
  });

  /* Remettre l'item actif */
  const activeId = window.location.hash.replace('#', '');
  if (activeId) {
    sidebarTree.querySelector(`.sidebar-item[data-id="${activeId}"]`)?.classList.add('active');
  }
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function normalize(str) {
  if (str == null) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function rarityColor(rarityKey) {
  return (RARITIES[rarityKey] || { color: '#666' }).color;
}

function rarityLabel(rarityKey) {
  return (RARITIES[rarityKey] || { label: rarityKey }).label;
}

function catData(categoryKey) {
  return CATEGORIES[categoryKey] || { label: categoryKey, emoji: '📦' };
}

function parseText(str) {
  if (!str) return '';

  const lines = str.split('\n');

  // Pré-analyse : collecte tous les taux présents
  const rates = lines
    .map(l => { const m = l.match(/\[(\d+(?:\.\d+)?)\]/); return m ? parseFloat(m[1]) : null; })
    .filter(v => v !== null);
  const maxRate = rates.length > 1 ? Math.max(...rates) : null;
  const minRate = rates.length > 1 ? Math.min(...rates) : null;

  function getRank(str) {
    const m = str.match(/\[(\d+(?:\.\d+)?)\]/);
    if (!m || maxRate === null) return 'neutral';
    if (maxRate === minRate) return 'neutral';
    const v = parseFloat(m[1]);
    if (v === maxRate) return 'high';
    if (v === minRate) return 'low';
    return 'neutral';
  }

  let html = '';
  let inList = false;
  let lastWasText = false;

  lines.forEach(raw => {
    const line = raw.trim();
    const rank  = getRank(line);

    if (line.match(/^[-*]\s+/)) {
      if (!inList) {
        if (lastWasText) html = html.replace(/<br>$/, '');
        html += '<ul class="item-list">';
        inList = true;
      }
      const content = line.replace(/^[-*]\s+/, '');
      const { badge, text } = extractBadge(content, rank);
      html += `<li class="obtain-line"><span class="obtain-bullet">◆</span>${badge}<span class="obtain-text">${inlineMd(text)}</span></li>`;
      lastWasText = false;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line === '') {
        html += '<br>';
        lastWasText = false;
      } else {
        const { badge, text } = extractBadge(line, rank);
        html += `<span class="obtain-line">${badge}<span class="obtain-text">${inlineMd(text)}</span></span><br>`;
        lastWasText = true;
      }
    }
  });

  if (inList) html += '</ul>';
  html = html.replace(/(<br>)+$/, '');
  return html;
}

function extractBadge(str, rank) {
  const match = str.match(/\[(\d+(?:\.\d+)?)\]/);
  if (!match) return { badge: '', text: str };

  let color = '#c9a84c';
  if (rank === 'high') color = '#7fdf62';
  if (rank === 'low')  color = '#c0392b';

  const badge = `<span class="drop-badge" style="color:${color}; border-color:${color}33;">${match[1]}%</span>`;
  const text  = str.replace(match[0], '').trim();
  return { badge, text };
}

function inlineMd(str) {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/* Regroupe les items par palier puis par catégorie */
function groupItems(items) {
  const grouped = {};
  items.forEach(item => {
    const p = item.palier || 1;
    if (!grouped[p]) grouped[p] = {};
    if (!grouped[p][item.category]) grouped[p][item.category] = [];
    grouped[p][item.category].push(item);
  });
  return grouped;
}

/* ══════════════════════════════════
   CONSTRUCTION SIDEBAR
══════════════════════════════════ */
function buildSidebar(items, expandAll = false) {
  if (currentSort === 'alpha') { buildSidebarAlpha(items); return; }
  sidebarTree.innerHTML = '';
  const grouped = groupItems(items);

  Object.keys(grouped)
    .sort((a, b) => a - b)
    .forEach(palier => {

      /* ── Bloc Palier ── */
      const palierBlock = document.createElement('div');
      palierBlock.className = 'palier-block';

      const ph = document.createElement('div');
      ph.className = 'palier-header' + (expandAll ? ' open' : '');
      ph.innerHTML = `<span class="palier-label">⬡ Palier ${palier}</span><span class="palier-arrow">▶</span>`;

      const pb = document.createElement('div');
      pb.className = 'palier-body' + (expandAll ? ' open' : '');

      ph.addEventListener('click', () => {
        ph.classList.toggle('open');
        pb.classList.toggle('open');
      });

      /* ── Blocs Catégorie ── */
      Object.keys(grouped[palier]).forEach(cat => {
        const catItems  = grouped[palier][cat];
        const cat_data  = catData(cat);

        const cb = document.createElement('div');
        cb.className = 'categorie-block';

        const ch = document.createElement('div');
        ch.className = 'categorie-header' + (expandAll ? ' open' : '');
        ch.innerHTML = `
          <span class="categorie-label">
            <span class="categorie-emoji">${cat_data.emoji}</span>
            ${cat_data.label}
            <span class="categorie-count">${catItems.length}</span>
          </span>
          <span class="categorie-arrow">▶</span>`;

        const cbody = document.createElement('div');
        cbody.className = 'categorie-body' + (expandAll ? ' open' : '');

        ch.addEventListener('click', () => {
          ch.classList.toggle('open');
          cbody.classList.toggle('open');
        });

        /* ── Items ── */
        catItems.forEach(item => {
          const link = document.createElement('a');
          link.className  = 'sidebar-item';
          link.href       = `#${item.id}`;
          link.dataset.id = item.id;

          const color = rarityColor(item.rarity);
          link.innerHTML = `
            <span class="sidebar-item-dot" style="background:${color}"></span>
            ${item.name}`;

          link.addEventListener('click', (e) => {
            e.preventDefault();
            showItem(item.id);
            history.pushState({ item: item.id }, '', `#${item.id}`);
          });

          cbody.appendChild(link);
        });

        cb.appendChild(ch);
        cb.appendChild(cbody);
        pb.appendChild(cb);
      });

      palierBlock.appendChild(ph);
      palierBlock.appendChild(pb);
      sidebarTree.appendChild(palierBlock);
    });
}

/* ══════════════════════════════════════════════════════════════
   VISIONNEUSE D'IMAGES — DIAPORAMA + WEBGL
══════════════════════════════════════════════════════════════ */
const SLIDE_DELAY = 3000;
let   _slideTimer = null;
let   _slideIndex = 0;
let   _slidePaused = false;
let   _slideMedia  = [];

function resolveMedia(item) {
  if (item.images && Array.isArray(item.images)) return item.images;
  if (item.model)  return [item.model];
  if (item.image)  return [item.image];
  if (item.img)  return [item.img];
  return [];
}

function stopSlideshow() {
  if (_slideTimer) { clearInterval(_slideTimer); _slideTimer = null; }
}

function renderMedia(media, color, altName) {
  const inner = document.getElementById('item-media-inner');
  if (!inner) return;

  inner.classList.add('fade-out');

  setTimeout(() => {
    stopWebGL();
    inner.innerHTML = '';

    if (!media) {
      inner.innerHTML = `<span class="item-image-placeholder">📦</span>`;
      inner.classList.remove('fade-out');
      return;
    }

    if (typeof media === 'object' && media.model) {
      renderWebGL(inner, media.model, media.texture, color);
      inner.classList.remove('fade-out');
      return;
    }

    const img = document.createElement('img');
    img.src = media;
    img.alt = altName || '';
    img.onload = () => inner.classList.remove('fade-out');
    img.onerror = () => inner.classList.remove('fade-out');
    inner.appendChild(img);
  }, 220);
}

function updateSlideIndicators() {
  document.querySelectorAll('.slide-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === _slideIndex);
  });
  const counter = document.getElementById('slide-counter');
  if (counter) counter.textContent = `${_slideIndex + 1} / ${_slideMedia.length}`;
}

function goToSlide(index, color, name) {
  _slideIndex = (index + _slideMedia.length) % _slideMedia.length;
  renderMedia(_slideMedia[_slideIndex], color, name);
  updateSlideIndicators();
}

function startSlideshow(color, name) {
  stopSlideshow();
  if (_slideMedia.length <= 1 || _slidePaused) return;
  _slideTimer = setInterval(() => {
    goToSlide(_slideIndex + 1, color, name);
  }, SLIDE_DELAY);
}

/* ── Toggle pause ── */
function togglePause(color, name) {
  _slidePaused = !_slidePaused;
  const btn = document.getElementById('slide-pause');
  if (btn) btn.textContent = _slidePaused ? '▶' : '⏸';
  if (_slidePaused) stopSlideshow();
  else startSlideshow(color, name);
}

/* ══════════════════════════════════
   RENDU WEBGL — MODÈLE MINECRAFT
══════════════════════════════════ */
let _webglRenderer = null;
let _webglAnimId   = null;

function stopWebGL() {
  if (_webglAnimId)   { cancelAnimationFrame(_webglAnimId); _webglAnimId = null; }
  if (_webglRenderer) { _webglRenderer.dispose(); _webglRenderer = null; }
}

function renderWebGL(container, modelPath, texturePath, accentColor) {
  function initScene() {
    const W = container.clientWidth  || 128;
    const H = container.clientHeight || 128;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: false });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);
    _webglRenderer = renderer;

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, W / H, 0.1, 100);
    camera.position.set(0, 0, 3.5);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 1.2));
    const dir = new THREE.DirectionalLight(0xffffff, 0.5);
    dir.position.set(3, 5, 3);
    scene.add(dir);

    function buildScene(texture) {
      if (texture) {
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
      }

      if (typeof modelPath === 'object' && modelPath !== null) {
        buildFromMCModel(scene, modelPath, texture, accentColor);
      } else {
        fetch(modelPath)
          .then(r => r.json())
          .then(mcModel => buildFromMCModel(scene, mcModel, texture, accentColor))
          .catch(err => {
            console.error('[3D] fetch bloqué — utilise un objet JSON inline à la place du chemin fichier :', err);
            buildFallbackCube(scene, texture);
          });
      }
    }

    function loadTextureCompat(src, onLoad) {
      const img = new Image();
      img.onload = () => {
        const tex = new THREE.Texture(img);
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.needsUpdate = true;
        onLoad(tex);
      };
      img.onerror = () => onLoad(null);
      img.crossOrigin = '';
      img.src = src;
    }

    if (texturePath) {
      loadTextureCompat(texturePath, (tex) => {
        if (tex) buildScene(tex);
        else     buildScene(null);
      });
    } else {
      buildScene(null);
    }

    let isDragging = false, lastX = 0, lastY = 0;
    let rotX = 0.4, rotY = 0.6;
    let autoRotate = true;

    const el = renderer.domElement;
    el.style.cursor = 'grab';

    el.addEventListener('mousedown', e => {
      isDragging = true; autoRotate = false;
      lastX = e.clientX; lastY = e.clientY;
      el.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      rotY += (e.clientX - lastX) * 0.01;
      rotX += (e.clientY - lastY) * 0.01;
      lastX = e.clientX; lastY = e.clientY;
    });
    window.addEventListener('mouseup', () => {
      isDragging = false; el.style.cursor = 'grab';
    });

    el.addEventListener('touchstart', e => {
      isDragging = true; autoRotate = false;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!isDragging) return;
      rotY += (e.touches[0].clientX - lastX) * 0.012;
      rotX += (e.touches[0].clientY - lastY) * 0.012;
      lastX = e.touches[0].clientX; lastY = e.touches[0].clientY;
    }, { passive: true });
    el.addEventListener('touchend', () => { isDragging = false; });

    const pivot = new THREE.Group();
    scene.add(pivot);
    window._mcPivot = pivot;

    function animate() {
      _webglAnimId = requestAnimationFrame(animate);
      if (autoRotate) rotY += 0.008;
      pivot.rotation.x = rotX;
      pivot.rotation.y = rotY;
      renderer.render(scene, camera);
    }
    animate();
  }

  /* ══════════════════════════════════════════════════════════
     PARSEUR MINECRAFT — UV correct par face
  ══════════════════════════════════════════════════════════ */
  function buildFromMCModel(scene, mcModel, texture, accentColor) {
    const pivot    = window._mcPivot || scene;
    const elements = mcModel.elements;
    if (!elements || elements.length === 0) { buildFallbackCube(scene, texture); return; }

    const TW = (mcModel.texture_size && mcModel.texture_size[0]) || 64;
    const TH = (mcModel.texture_size && mcModel.texture_size[1]) || 64;
    const S  = 1 / 16;

    const baseMat = texture
      ? new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.05 })
      : new THREE.MeshLambertMaterial({ color: accentColor || 0x888888 });

    const FACE_META = {
      north: { normal: [  0,  0, -1 ], right: [-1, 0, 0], up: [0,  1, 0] },
      south: { normal: [  0,  0,  1 ], right: [ 1, 0, 0], up: [0,  1, 0] },
      east:  { normal: [  1,  0,  0 ], right: [ 0, 0,-1], up: [0,  1, 0] },
      west:  { normal: [ -1,  0,  0 ], right: [ 0, 0, 1], up: [0,  1, 0] },
      up:    { normal: [  0,  1,  0 ], right: [ 1, 0, 0], up: [0,  0,-1] },
      down:  { normal: [  0, -1,  0 ], right: [ 1, 0, 0], up: [0,  0, 1] },
    };

    elements.forEach(elDef => {
      const fx = elDef.from[0], fy = elDef.from[1], fz = elDef.from[2];
      const tx = elDef.to[0],   ty = elDef.to[1],   tz = elDef.to[2];

      const sx = (tx - fx) * S, sy = (ty - fy) * S, sz = (tz - fz) * S;
      const cx = ((fx + tx) / 2 - 8) * S;
      const cy = ((fy + ty) / 2 - 8) * S;
      const cz = ((fz + tz) / 2 - 8) * S;

      let elementParent = pivot;
      let elementOffset = new THREE.Vector3(cx, cy, cz);

      if (elDef.rotation) {
        const r   = elDef.rotation;
        const ang = (r.angle * Math.PI) / 180;
        const ox  = (r.origin[0] - 8) * S;
        const oy  = (r.origin[1] - 8) * S;
        const oz  = (r.origin[2] - 8) * S;

        const helper = new THREE.Object3D();
        helper.position.set(ox, oy, oz);
        pivot.add(helper);
        if      (r.axis === 'x') helper.rotation.x = ang;
        else if (r.axis === 'y') helper.rotation.y = ang;
        else if (r.axis === 'z') helper.rotation.z = ang;

        elementParent = helper;
        elementOffset = new THREE.Vector3(cx - ox, cy - oy, cz - oz);
      }

      Object.entries(FACE_META).forEach(([faceName, meta]) => {
        const faceDef = elDef.faces && elDef.faces[faceName];
        if (!faceDef) return;

        const uv = faceDef.uv;

        let pw, ph;
        if (faceName === 'north' || faceName === 'south') { pw = sx; ph = sy; }
        else if (faceName === 'east'  || faceName === 'west')  { pw = sz; ph = sy; }
        else                                                    { pw = sx; ph = sz; } // up / down

        const geo = new THREE.PlaneGeometry(pw, ph);

        if (uv && texture) {
          let u1 = uv[0] / TW, v1 = 1 - uv[3] / TH;
          let u2 = uv[2] / TW, v2 = 1 - uv[1] / TH;

          const rot = (faceDef.rotation || 0) % 360;
          const uvCoords = [
            [u1, v2], // bl
            [u2, v2], // br
            [u1, v1], // tl
            [u2, v1], // tr
          ];
          const rotSteps = rot / 90;
          for (let r = 0; r < rotSteps; r++) {
            const [bl, br, tl, tr] = uvCoords;
            uvCoords[0] = tl; uvCoords[1] = bl; uvCoords[2] = tr; uvCoords[3] = br;
          }

          const uvAttr = geo.attributes.uv;
          uvAttr.setXY(0, uvCoords[2][0], uvCoords[2][1]); // tl
          uvAttr.setXY(1, uvCoords[3][0], uvCoords[3][1]); // tr
          uvAttr.setXY(2, uvCoords[0][0], uvCoords[0][1]); // bl
          uvAttr.setXY(3, uvCoords[1][0], uvCoords[1][1]); // br
          uvAttr.needsUpdate = true;
        }

        const mesh = new THREE.Mesh(geo, baseMat);

        const n  = meta.normal;
        const halfX = sx / 2, halfY = sy / 2, halfZ = sz / 2;
        const offsets = {
          north: [0,         0,        -halfZ],
          south: [0,         0,         halfZ],
          east:  [ halfX,    0,         0    ],
          west:  [-halfX,    0,         0    ],
          up:    [0,         halfY,     0    ],
          down:  [0,        -halfY,     0    ],
        };
        const off = offsets[faceName];
        mesh.position.set(
          elementOffset.x + off[0],
          elementOffset.y + off[1],
          elementOffset.z + off[2]
        );

        mesh.lookAt(
          mesh.position.x + n[0],
          mesh.position.y + n[1],
          mesh.position.z + n[2]
        );

        elementParent.add(mesh);
      });
    });

    if (mcModel.display && mcModel.display.gui) {
      const g = mcModel.display.gui;
      if (g.rotation) {
        pivot.rotation.x = ( g.rotation[0] * Math.PI) / 180;
        pivot.rotation.y = ( g.rotation[1] * Math.PI) / 180;
        pivot.rotation.z = ( g.rotation[2] * Math.PI) / 180;
      }
    }
  }

  function buildFallbackCube(scene, texture) {
    const pivot = window._mcPivot || scene;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = texture
      ? new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.1 })
      : new THREE.MeshLambertMaterial({ color: 0x6a5acd });
    pivot.add(new THREE.Mesh(geo, mat));
  }

  if (typeof THREE === 'undefined') {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
    s.onload = initScene;
    document.head.appendChild(s);
  } else {
    initScene();
  }
}

/* ══════════════════════════════════
   AFFICHAGE FICHE ITEM
══════════════════════════════════ */
function showItem(id) {
  const item = ITEMS.find(i => i.id === id);
  if (!item) return;

  stopSlideshow();
  stopWebGL();

  placeholder.style.display = 'none';

  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  const color  = rarityColor(item.rarity);
  const rlabel = rarityLabel(item.rarity);
  const cdata  = catData(item.category);

  _slideMedia  = resolveMedia(item);
  _slideIndex  = 0;
  _slidePaused = false;

  const hasSlideshow = _slideMedia.length > 1;

  const slideshowControls = hasSlideshow ? `
    <div class="slideshow-controls">
      <button class="slide-btn" id="slide-prev" title="Précédent">‹</button>
      <div class="slide-dots">
        ${_slideMedia.map((_, i) => `<span class="slide-dot${i === 0 ? ' active' : ''}"></span>`).join('')}
      </div>
      <span id="slide-counter" class="slide-counter">1 / ${_slideMedia.length}</span>
      <button class="slide-btn" id="slide-pause" title="Pause / Lecture">⏸</button>
      <button class="slide-btn" id="slide-next" title="Suivant">›</button>
    </div>` : '';

  function mediaTypeLabel(m) {
    if (!m) return '';
    if (typeof m === 'object' && m.model) return '<span class="media-type-badge">3D</span>';
    if (typeof m === 'string' && m.endsWith('.gif')) return '<span class="media-type-badge">GIF</span>';
    return '';
  }

  itemDisplay.innerHTML = `
    <div class="item-sheet">
      <div class="item-header">

        <!-- Cadre média -->
        <div class="item-image-wrap" style="color:${color}; border-color:${color};">
          <div class="item-image-bg" style="background:${color};"></div>
          <div class="item-image-border" style="border-color:${color};"></div>
          <div class="item-image-inner" id="item-media-inner">
            <span class="item-image-placeholder">${cdata.emoji}</span>
          </div>
          ${mediaTypeLabel(_slideMedia[0])}
          ${slideshowControls}
        </div>

        <!-- Infos -->
        <div class="item-info">
          <h2 class="item-name">${item.name}</h2>
          <div class="item-rarity-badge" style="color:${color}; border-color:${color};">
            <span class="item-rarity-dot" style="background:${color};"></span>
            ${rlabel}
          </div>
          <blockquote class="item-lore">${parseText(item.lore)}</blockquote>
        </div>

      </div>

      <div class="item-sep"></div>
      <div class="item-section-title">Comment obtenir cet item</div>
      <div class="item-obtain">${parseText(item.obtain)}</div>
      <div class="item-sep"></div>
      <div class="item-tags">
        ${(item.tags || []).map(t => `<span class="item-tag">${t}</span>`).join('')}
      </div>

    </div>`

  if (_slideMedia.length > 0) {
    renderMedia(_slideMedia[0], color, item.name);
  }

  if (hasSlideshow) {
    document.getElementById('slide-prev').addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(_slideIndex - 1, color, item.name);
      if (!_slidePaused) startSlideshow(color, item.name);
    });
    document.getElementById('slide-next').addEventListener('click', (e) => {
      e.stopPropagation();
      goToSlide(_slideIndex + 1, color, item.name);
      if (!_slidePaused) startSlideshow(color, item.name);
    });
    document.getElementById('slide-pause').addEventListener('click', (e) => {
      e.stopPropagation();
      togglePause(color, item.name);
    });
    document.querySelectorAll('.slide-dot').forEach((dot, i) => {
      dot.addEventListener('click', () => {
        goToSlide(i, color, item.name);
        if (!_slidePaused) startSlideshow(color, item.name);
      });
    });
    startSlideshow(color, item.name);
  }
}

/* ══════════════════════════════════
   RECHERCHE
══════════════════════════════════ */
searchInput.addEventListener('input', () => {
  const expandAll = currentSort === 'palier';
  buildSidebar(currentItems(), expandAll);
});

/* ══════════════════════════════════
   NAVIGATION PAR HASH
══════════════════════════════════ */
window.addEventListener('popstate', () => {
  const id = window.location.hash.replace('#', '');
  if (id) showItem(id);
  else {
    placeholder.style.display = '';
    itemDisplay.innerHTML = '';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  }
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
buildSidebar(ITEMS);

const initId = window.location.hash.replace('#', '');
if (initId) {
  const target = ITEMS.find(i => i.id === initId);
  if (target) {

    buildSidebar(ITEMS);
    requestAnimationFrame(() => {
      const link = sidebarTree.querySelector(`.sidebar-item[data-id="${initId}"]`);
      if (link) {
        link.closest('.palier-body')?.classList.add('open');
        link.closest('.palier-body')?.previousElementSibling?.classList.add('open');
        link.closest('.categorie-body')?.classList.add('open');
        link.closest('.categorie-body')?.previousElementSibling?.classList.add('open');
      }
      showItem(initId);
    });
  }
}
