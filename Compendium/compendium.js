// escHtml → défini globalement dans /utils.js (function au top-level classique)

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
    : ITEMS.slice();
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
      ${escHtml(item.name)}${item.quality ? ' <span class="sidebar-quality-badge">✦</span>' : ''}`;
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
   ORDRE DE RARETÉ
══════════════════════════════════ */
const RARITY_ORDER = ['commun', 'rare', 'epique', 'legendaire', 'mythique', 'godlike', 'event'];
function rarityRank(key) {
  const i = RARITY_ORDER.indexOf(key);
  return i === -1 ? RARITY_ORDER.length : i;
}

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
// normalize → défini dans /utils.js

// Index O(1) pour les lookups d'items (peuplé dans initCompendium après Firestore).
const ITEMS_BY_ID = new Map();

function rarityColor(rarityKey) {
  return (RARITIES[rarityKey] || { color: '#666' }).color;
}

function rarityLabel(rarityKey) {
  return (RARITIES[rarityKey] || { label: rarityKey }).label;
}

function catData(categoryKey) {
  return CATEGORIES[categoryKey] || { label: categoryKey, emoji: '📦' };
}

function inlineLinks(str) {
  // Syntaxe : [type:id|Nom affiché] ou [id|Nom affiché] (item par défaut)
  // type peut être : mob, npc, item
  return str.replace(/\[([^\]|]+)\|([^\]]+)\]/g, function(_, ref, label) {
    // Détecter si ref contient un type explicite : "mob:sanglier_corrompu"
    const colonIdx = ref.indexOf(':');
    let type, id;
    if (colonIdx !== -1) {
      type = ref.slice(0, colonIdx);
      id   = ref.slice(colonIdx + 1);
    } else {
      // Pas de type explicite → chercher dans ITEMS d'abord, puis MOBS
      id   = ref;
      type = null;
    }

    const inItems = ITEMS_BY_ID.get(id);

    if (!type) {
      type = inItems ? 'item' : 'mob';
    }

    if (type === 'item') {
      const target = inItems;
      if (!target) return `<span style="color:#888;border-bottom:1px dashed #555" title="Item introuvable: ${escHtml(id)}">${label}</span>`;
      const color = rarityColor(target.rarity);
      return `<a class="obtain-entity-link" href="compendium.html#${escHtml(id)}" data-id="${escHtml(id)}" data-type="item" style="color:${color}">${label}</a>`;
    }

    if (type === 'donjon') {
      const page = `../Map/map.html#donjon-${escHtml(id)}`;
      return `<a class="obtain-entity-link" href="${page}" data-id="${escHtml(id)}" data-type="donjon" style="color:#e8b44a">${label}</a>`;
    }

    if (type === 'quest') {
      const page = `../Quetes/quetes.html#${escHtml(id)}`;
      return `«<a class="obtain-entity-link" href="${page}" data-id="${escHtml(id)}" data-type="quest" style="color:#e07c50">${label}</a>»`;
    }

    // Pour mobs et npc → bestiaire avec préfixe de section
    const sectionPrefix = type === 'npc' ? 'personnages' : 'monstres';
    const hash  = `${sectionPrefix}/${id}`;
    const page  = `../Bestiaire/bestiaire.html#${escHtml(hash)}`;
    const color = 'var(--gold)';

    return `<a class="obtain-entity-link" href="${page}" data-id="${escHtml(id)}" data-type="${escHtml(type)}" data-hash="${escHtml(hash)}" style="color:${color}">${label}</a>`;
  });
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
  return inlineLinks(escHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'));
}

/* Regroupe les items par palier puis par catégorie, triés par rareté */
function groupItems(items) {
  const grouped = {};
  items.forEach(item => {
    const p = item.palier || 1;
    if (!grouped[p]) grouped[p] = {};
    if (!grouped[p][item.category]) grouped[p][item.category] = [];
    grouped[p][item.category].push(item);
  });
  // Trier chaque catégorie par ordre admin (champ `ordre`), puis par rareté en fallback
  for (const palier of Object.values(grouped)) {
    for (const cat of Object.keys(palier)) {
      palier[cat].sort((a, b) => {
        const ao = a.ordre ?? null, bo = b.ordre ?? null;
        if (ao !== null && bo !== null) return ao - bo;
        if (ao !== null) return -1;
        if (bo !== null) return 1;
        return rarityRank(a.rarity) - rarityRank(b.rarity);
      });
    }
  }
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
      Object.keys(grouped[palier])
        .sort((a, b) => {
          const oa = (CATEGORIES[a] && CATEGORIES[a].ordre) ?? 999;
          const ob = (CATEGORIES[b] && CATEGORIES[b].ordre) ?? 999;
          return oa - ob;
        })
        .forEach(cat => {
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
          ${escHtml(item.name)}${item.quality ? ' <span class="sidebar-quality-badge">✦</span>' : ''}`;

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
  if (item.model) return [item.model];
  return getItemImages(item);
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
   RENDU CRAFT
══════════════════════════════════ */
function renderCraft(craftList) {
  if (!craftList || craftList.length === 0) return '';

  // Détection nouveau format : tableau d'objets {name?, npcId?, items:[]}
  // vs ancien format : tableau de tableaux ou tableau plat d'entrées {qty, id}
  const isNewFormat = craftList.length > 0 &&
    !Array.isArray(craftList[0]) &&
    craftList[0].items !== undefined;

  let recettes;
  if (isNewFormat) {
    recettes = craftList; // [{name, npcId, items:[{qty,id}]}]
  } else {
    // Rétrocompatibilité ancien format
    const isNested = Array.isArray(craftList[0]);
    const raw = isNested ? craftList : [craftList];
    recettes = raw.map((items, i) => ({ name: null, npcId: null, items }));
  }

  function renderRows(items) {
    return items.map(entry => {
      const currency = CURRENCIES[entry.id];
      if (currency) {
        return `
          <div class="craft-ingredient-row">
            <span class="craft-ingredient-qty">×${entry.qty}</span>
            <span class="craft-ingredient-visual">
              <span class="craft-ingredient-emoji">${currency.emoji}</span>
            </span>
            <span class="craft-ingredient-name craft-currency-name" style="color:${currency.color};">
              ${currency.label}
            </span>
          </div>`;
      }

      const ingredient = ITEMS_BY_ID.get(entry.id);
      let imgHtml;
      if (ingredient) {
        const imgSrc = getItemImg(ingredient);
        imgHtml = imgSrc
          ? `<img class="craft-ingredient-img" src="${imgSrc}" alt="${escHtml(ingredient.name)}">`
          : `<span class="craft-ingredient-emoji">${catData(ingredient.category).emoji}</span>`;
      } else {
        imgHtml = `<span class="craft-ingredient-emoji">❓</span>`;
      }

      const name  = ingredient ? escHtml(ingredient.name) : `<em style="color:#888">${escHtml(entry.id)}</em>`;
      const color = ingredient ? rarityColor(ingredient.rarity) : '#666';
      const nameHtml = ingredient
        ? `<a class="craft-ingredient-name" href="#${escHtml(entry.id)}" style="color:${color}" data-id="${escHtml(entry.id)}">${name}</a>`
        : `<span class="craft-ingredient-name" style="color:#888">${name}</span>`;

      return `
        <div class="craft-ingredient-row">
          <span class="craft-ingredient-qty">×${entry.qty}</span>
          <span class="craft-ingredient-visual">${imgHtml}</span>
          ${nameHtml}
        </div>`;
    }).join('');
  }

function renderNpcHeader(recette, index) {
  const label = escHtml(recette.name || ('Recette ' + (index + 1)));
  if (!recette.npcId) {
    return `<div class="craft-npc-header craft-npc-header--plain">
      <span class="craft-npc-label">${label}</span>
    </div>`;
  }

  const section  = recette.npcSection || 'personnages'; // défaut : personnages
  const npcItem  = ITEMS_BY_ID.get(recette.npcId);
  const npcMob   = (typeof MOBS  !== 'undefined') && MOBS.find(m => m.id === recette.npcId);
  const npc      = npcItem || npcMob;
  const npcName  = npc ? (npc.name || label) : label;
  const npcImg   = npc ? getItemImg(npc) : null;
  const npcColor = npcItem ? rarityColor(npcItem.rarity) : 'var(--gold)';

  const npcNameEsc = escHtml(npcName);
  const imgHtml = npcImg
    ? `<img class="craft-npc-img" src="${npcImg}" alt="${npcNameEsc}">`
    : `<span class="craft-npc-ico">⚒</span>`;

  return `<div class="craft-npc-header" data-npc-id="${escHtml(recette.npcId)}" data-npc-section="${escHtml(section)}">
    <span class="craft-npc-visual">${imgHtml}</span>
    <span class="craft-npc-name" style="color:${npcColor}">${npcNameEsc}</span>
    <span class="craft-npc-arrow">›</span>
  </div>`;
}

  if (recettes.length === 1) {
    return `
      <div class="item-obtain">
        <div class="craft-list">${renderRows(recettes[0].items)}</div>
      </div>`;
  }

  const tabsHtml = recettes.map((r, i) => {
    const label = escHtml(r.name || ('Recette ' + (i + 1)));
    return `<button class="craft-tab${i === 0 ? ' active' : ''}" data-tab="${i}">${label}</button>`;
  }).join('');

  const panelsHtml = recettes.map((r, i) => `
    <div class="craft-panel${i === 0 ? ' active' : ''}" data-panel="${i}">
      <div class="craft-list">${renderRows(r.items)}</div>
    </div>`).join('');

  return `
    <div class="item-obtain craft-tabbed">
      <div class="craft-tabs">${tabsHtml}</div>
      <div class="craft-panels">${panelsHtml}</div>
    </div>`;
}

/* ══════════════════════════════════
   AFFICHAGE FICHE ITEM
══════════════════════════════════ */

/* Formate une durée en secondes vers une chaîne lisible :
   45 → "45 s", 60 → "1 min", 90 → "1 min 30", 3600 → "1 h", 5400 → "1 h 30" */
function formatDuration(sec) {
  const s = Number(sec);
  if (!isFinite(s) || s <= 0) return '';
  if (s < 60) return `${s} s`;
  if (s < 3600) {
    const m = Math.floor(s / 60), r = s % 60;
    return r ? `${m} min ${r}` : `${m} min`;
  }
  const h = Math.floor(s / 3600), rm = Math.floor((s % 3600) / 60);
  return rm ? `${h} h ${rm}` : `${h} h`;
}

function renderEffects(effectsList) {
  if (!effectsList || effectsList.length === 0) return '';

  const rows = effectsList.map(eff => {
    const meta    = EFFECT_META[eff.type] || { icon: '◆', color: '#aaa', label: eff.type, prefix: '' };
    const color   = eff.color  || meta.color;
    const icon    = eff.icon   || meta.icon;
    const label   = eff.label  || meta.label;
    const prefix  = eff.prefix ?? meta.prefix;
    const valueStr = `${prefix}${eff.value}${eff.unit ? ' ' + eff.unit : ''}`;
    const duration = eff.instant          ? 'Instantané'
                   : eff.type === 'cooldown' ? 'Cooldown'
                   : eff.duration            ? formatDuration(eff.duration)
                   : '';
    return `
      <div class="effect-row">
        <div class="effect-icon" style="color:${color};">${escHtml(icon)}</div>
        <div class="effect-body">
          <div class="effect-label">${escHtml(label)}</div>
          <div class="effect-value" style="color:${color};">${escHtml(valueStr)}</div>
        </div>
        ${duration ? `<div class="effect-duration">${escHtml(duration)}</div>` : ''}
      </div>`;
  }).join('');

  return `<div class="item-obtain effects-panel">${rows}</div>`;
}
function bindCraftLinks() {
  document.querySelectorAll('.craft-ingredient-name[data-id]').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = link.dataset.id;
      showItem(targetId);
      history.pushState({ item: targetId }, '', `#${targetId}`);
    });
  });
}

function bindCraftTabs() {
  document.querySelectorAll('.craft-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const idx = tab.dataset.tab;
      document.querySelectorAll('.craft-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.craft-panel').forEach(p => p.classList.remove('active'));
      tab.classList.add('active');
      document.querySelector(`.craft-panel[data-panel="${idx}"]`)?.classList.add('active');
    });
  });
}

function bindEntityLinks() {
  // Liens [id|Nom] dans obtain/lore → navigation sans rechargement
  document.querySelectorAll('.obtain-entity-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const id   = link.dataset.id;
      const type = link.dataset.type;
      if (type === 'item') {
        showItem(id);
        history.pushState({ item: id }, '', `#${id}`);
      } else {
        // Redirige vers le bestiaire si c'est un mob
        window.location.href = link.href;
      }
    });
  });

  // Liens NPC dans les headers craft
  document.querySelectorAll('.craft-npc-header[data-npc-id]').forEach(header => {
    header.style.cursor = 'pointer';
    header.addEventListener('click', () => {
      const id      = header.dataset.npcId;
      const section = header.dataset.npcSection || 'personnages';
      const inItems = ITEMS_BY_ID.get(id);
      if (inItems) {
        showItem(id);
        history.pushState({ item: id }, '', `#${id}`);
      } else {
        window.location.href = `../Bestiaire/bestiaire.html#${section}/${id}`;
      }
    });
  });
}

function renderEvolutionChain(item) {
  const hasPrev = item.evolvedFrom?.length > 0;
  const hasNext = item.evolutions?.length > 0;
  if (!hasPrev && !hasNext) return '';

  function evoLink(evoId) {
    const other = ITEMS_BY_ID.get(evoId);
    const c     = other ? rarityColor(other.rarity) : '#9a9ab0';
    const name  = other ? escHtml(other.name) : escHtml(evoId);
    return `<a class="obtain-entity-link evo-chain-link" href="compendium.html#${escHtml(evoId)}" data-id="${escHtml(evoId)}" data-type="item" style="color:${c};border-color:${c}40;background:${c}12;">${name}</a>`;
  }

  // Arbre récursif d'évolutions
  function evoTree(evoId, visited = new Set()) {
    if (visited.has(evoId)) return '';
    const v2 = new Set(visited); v2.add(evoId);
    const evo = ITEMS_BY_ID.get(evoId);
    const children = evo?.evolutions?.filter(id => !v2.has(id)) || [];
    const childHtml = children.map(cId => evoTree(cId, v2)).join('');
    return `<div class="evo-tree-node">
      <div class="evo-tree-row"><span class="evo-arrow">→</span>${evoLink(evoId)}</div>
      ${childHtml ? `<div class="evo-tree-children">${childHtml}</div>` : ''}
    </div>`;
  }

  const curColor = rarityColor(item.rarity);
  let html = '';

  if (hasPrev) {
    const prevLinks = item.evolvedFrom.map(id => evoLink(id)).join(' ');
    html += `<div class="evo-prev-row"><span style="font-size:11px;color:var(--muted);margin-right:6px;">Évolue depuis :</span>${prevLinks}</div>`;
  }

  if (hasNext) {
    const visited = new Set([item.id]);
    const treeHtml = item.evolutions.map(id => evoTree(id, visited)).join('');
    html += `<div class="evo-next-block">
      <span style="font-size:11px;color:var(--muted);">Peut évoluer en :</span>
      <div class="evo-tree-root">${treeHtml}</div>
    </div>`;
  }

  return `
    <div class="evo-chain-wrap">
      <div class="item-section-title" style="margin-bottom:8px;">🔄 Évolutions</div>
      ${html}
    </div>`;
}

function showItem(id, initialQuality = false) {
  const item = ITEMS_BY_ID.get(id);
  if (!item) return;

  stopSlideshow();
  stopWebGL();
  placeholder.style.display = 'none';

  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });

  // ── État du toggle (false = Normal, true = Qualité)
  let qualityMode = initialQuality && !!item.quality;

  // ── Données selon le mode actif
  function getVariant() {
    if (qualityMode && item.quality) {
      return {
        lore:   item.quality.lore   ?? item.lore,
        obtain: item.quality.obtain ?? item.obtain,
      };
    }
    return { lore: item.lore, obtain: item.obtain };
  }

  // ── Craft selon le mode actif
  function getCraft() {
    if (qualityMode && item.quality) return item.quality.craft ?? item.craft ?? null;
    return item.craft ?? null;
  }

  const color  = rarityColor(item.rarity);
  const rlabel = rarityLabel(item.rarity);
  const cdata  = catData(item.category);

  _slideMedia  = resolveMedia(item);
  _slideIndex  = 0;
  _slidePaused = false;

  const hasSlideshow = _slideMedia.length > 1;
  const hasQuality   = !!item.quality;

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
    return '';
  }

  const qualityToggle = hasQuality ? `
    <div class="quality-toggle" id="quality-toggle">
      <span class="quality-toggle-label" id="qt-normal">Normal</span>
      <button class="qt-switch" id="qt-switch" title="Basculer vers la version Qualité" aria-pressed="false">
        <span class="qt-thumb"></span>
      </button>
      <span class="quality-toggle-label" id="qt-quality">✦ Qualité</span>
    </div>` : '';

  // ── Injection HTML complète
  itemDisplay.innerHTML = `
    <div class="item-sheet">
      <div class="item-header">
        <div class="item-image-wrap" style="color:${color}; border-color:${color};">
          <div class="item-image-bg" style="background:${color};"></div>
          <div class="item-image-border" style="border-color:${color};"></div>
          <div class="item-image-inner" id="item-media-inner">
            <span class="item-image-placeholder">${cdata.emoji}</span>
          </div>
          ${mediaTypeLabel(_slideMedia[0])}
          ${slideshowControls}
        </div>
        <div class="item-info">
          <h2 class="item-name">${escHtml(item.name)}</h2>
          <div class="item-rarity-badge" style="color:${color}; border-color:${color};">
            <span class="item-rarity-dot" style="background:${color};"></span>
            ${rlabel}
          </div>
          ${qualityToggle}
          <blockquote class="item-lore" id="item-lore-text">${parseText(item.lore)}</blockquote>
        </div>
      </div>

      <div class="item-sep"></div>
      ${renderEvolutionChain(item)}
      <div class="item-section-title">Comment obtenir cet item</div>
      <div class="item-obtain" id="item-obtain-text">${parseText(item.obtain)}</div>
      ${(item.craft || item.effects) ? `
      <div class="effects-craft-titles" id="effects-craft-titles">
        <div class="item-section-title">${item.craft ? 'Craft' : ''}</div>
        <div class="item-section-title">${item.effects ? 'Effets' : ''}</div>
      </div>
      <div class="effects-craft-row">
        <div id="item-craft-wrap">${renderCraft(item.craft ?? null)}</div>
        <div id="item-effects-wrap">${renderEffects(item.effects ?? null)}</div>
      </div>` : ''}
      <div class="item-sep"></div>

      <div class="item-tags">
        ${(item.tags || []).map(t => `<span class="item-tag">${t}</span>`).join('')}
      </div>
    </div>`;

  // ── Bind les liens craft initiaux
  bindCraftLinks();
  bindCraftTabs();
  bindEntityLinks();

  // ── Logique toggle Normal / Qualité
  if (hasQuality) {
    const switchBtn = document.getElementById('qt-switch');
    const loreEl    = document.getElementById('item-lore-text');
    const obtainEl  = document.getElementById('item-obtain-text');
    const craftWrap = document.getElementById('item-craft-wrap');
    const labelNorm = document.getElementById('qt-normal');
    const labelQual = document.getElementById('qt-quality');

    switchBtn.addEventListener('click', () => {
      qualityMode = !qualityMode;
      switchBtn.classList.toggle('active', qualityMode);
      switchBtn.setAttribute('aria-pressed', qualityMode);
      labelNorm.classList.toggle('qt-active', !qualityMode);
      labelQual.classList.toggle('qt-active',  qualityMode);
      history.replaceState({ item: id, quality: qualityMode }, '', qualityMode ? `#${id}-quality` : `#${id}`);

      const v = getVariant();
      loreEl.innerHTML   = parseText(v.lore);
      obtainEl.innerHTML = parseText(v.obtain);

      // ── Mise à jour du craft selon la version
      craftWrap.innerHTML = renderCraft(getCraft());
      const effectsWrap = document.getElementById('item-effects-wrap');
        if (effectsWrap) {
          const qualEffects = qualityMode && item.quality?.effects ? item.quality.effects : item.effects;
          effectsWrap.innerHTML = renderEffects(qualEffects ?? null);
        }
      bindCraftLinks();
      bindCraftTabs();
      bindEntityLinks();
    });

    // État initial
    if (qualityMode) {
      switchBtn.classList.add('active');
      switchBtn.setAttribute('aria-pressed', 'true');
      labelQual.classList.add('qt-active');
      const v = getVariant();
      loreEl.innerHTML   = parseText(v.lore);
      obtainEl.innerHTML = parseText(v.obtain);
      craftWrap.innerHTML = renderCraft(getCraft());
      const effectsWrap = document.getElementById('item-effects-wrap');
      if (effectsWrap) effectsWrap.innerHTML = renderEffects(item.quality?.effects ?? item.effects ?? null);
      bindCraftLinks();
      bindCraftTabs();
      bindEntityLinks();
    } else {
      labelNorm.classList.add('qt-active');
    }
  }

  // ── Média & slideshow
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
function parseHash(hash) {
  const raw = hash.replace('#', '');
  if (raw.endsWith('-quality')) return { id: raw.slice(0, -8), quality: true };
  return { id: raw, quality: false };
}

window.addEventListener('popstate', () => {
  const { id, quality } = parseHash(window.location.hash);
  if (id) showItem(id, quality);
  else {
    placeholder.style.display = '';
    itemDisplay.innerHTML = '';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  }
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
function initCompendium() {
  // Indexer une fois les items chargés depuis Firestore
  ITEMS_BY_ID.clear();
  for (const it of ITEMS) ITEMS_BY_ID.set(it.id, it);

  buildSidebar(ITEMS);
  document.querySelector('.glossary-subtitle').innerHTML =
    '// BASE DE DONNÉES · VEILLEURS AU CLAIR DE LUNE &nbsp;·&nbsp; <span style="color:var(--gold);font-weight:600">' + ITEMS.length + '</span> items recensés';

  const { id: initId, quality: initQuality } = parseHash(window.location.hash);
  if (initId) {
    const target = ITEMS_BY_ID.get(initId);
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
        showItem(initId, initQuality);
      });
    }
  }
}
window._pageInit = initCompendium;
