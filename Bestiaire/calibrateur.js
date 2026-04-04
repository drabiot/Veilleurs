/* ══════════════════════════════════════════════════════
   CALIBRATEUR DE MODÈLES — Veilleurs au Clair de Lune
   Permet de positionner/orienter les morceaux de models
   ModelEngine et d'exporter les valeurs vers data.js
══════════════════════════════════════════════════════ */

const viewport    = document.getElementById('calib-viewport');
const pieceList   = document.getElementById('piece-list');
const ctrlPanel   = document.getElementById('ctrl-panel');
const ctrlTitle   = document.getElementById('ctrl-title');
const jsonOutput  = document.getElementById('json-output');
const monsterSel  = document.getElementById('monster-select');

/* ─── État ─── */
let pieces        = [];   // { outerGroup, boxHelper, cfg }
let selectedIdx   = -1;
let cameraTarget  = new THREE.Vector3(0, 0.5, 0);
let camHauteur    = 0.5;
let camDistance   = 2.5;

/* ─── Drag-to-move ─── */
const raycaster    = new THREE.Raycaster();
const meshToPiece  = new Map();          // Mesh → pieceIdx
let dragPieceIdx   = -1;
let dragMode       = false;
let isDragging     = false;
let dragStartMouse = { x: 0, y: 0 };
const dragPlane    = new THREE.Plane();
const dragOffset   = new THREE.Vector3();
let dragShift      = false;

/* ─── Scene Three.js ─── */
let scene, camera, renderer, previewCamera;
let orbiting = false, lastMouse = { x: 0, y: 0 };
const orb = { phi: 1.1, theta: 0.4, r: 2.5, tPhi: 1.1, tTheta: 0.4, tR: 2.5 };

/* ─── Helpers drag ─── */

function getMouseNDC(clientX, clientY) {
  const rect = renderer.domElement.getBoundingClientRect();
  return new THREE.Vector2(
    ((clientX - rect.left) / rect.width)  *  2 - 1,
    ((clientY - rect.top)  / rect.height) * -2 + 1
  );
}

function setupDragPlane(pieceIdx, hitPoint, shiftKey) {
  const pos = pieces[pieceIdx].outerGroup.position;
  if (shiftKey) {
    const camDir = new THREE.Vector3();
    camera.getWorldDirection(camDir);
    camDir.y = 0;
    if (camDir.length() < 0.001) camDir.set(0, 0, 1);
    camDir.normalize();
    dragPlane.setFromNormalAndCoplanarPoint(camDir, pos);
  } else {
    dragPlane.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 1, 0), pos);
  }
  dragOffset.copy(pos).sub(hitPoint);
}

function movePieceDrag(pieceIdx, clientX, clientY) {
  const ndc = getMouseNDC(clientX, clientY);
  raycaster.setFromCamera(ndc, camera);
  const target = new THREE.Vector3();
  if (!raycaster.ray.intersectPlane(dragPlane, target)) return;
  target.add(dragOffset);

  const piece = pieces[pieceIdx];
  if (dragShift) {
    piece.cfg.position[1] = round4(target.y);
  } else {
    piece.cfg.position[0] = round4(target.x);
    piece.cfg.position[2] = round4(target.z);
  }
  piece.outerGroup.position.set(...piece.cfg.position);
  syncControlsToSelected();
  updateJSON();
}

function rebuildMeshMap() {
  meshToPiece.clear();
  pieces.forEach((p, idx) => {
    p.outerGroup.traverse(obj => {
      if (obj.isMesh) meshToPiece.set(obj, idx);
    });
  });
}

function syncControlsToSelected() {
  if (selectedIdx < 0) return;
  const cfg  = pieces[selectedIdx].cfg;
  const nums  = Array.from(ctrlPanel.querySelectorAll('input[type=number]'));
  const rngs  = Array.from(ctrlPanel.querySelectorAll('input[type=range]'));
  if (nums.length < 7) return;
  for (let i = 0; i < 3; i++) {
    const v = round4(cfg.position[i]);
    nums[i].value = v; rngs[i].value = v;
  }
  for (let i = 0; i < 3; i++) {
    const v = round4(cfg.rotation[i] * 180 / Math.PI);
    nums[3 + i].value = v; rngs[3 + i].value = v;
  }
  const sc = round3(cfg.scale);
  nums[6].value = sc; rngs[6].value = sc;
}

/* ─── Scene Three.js ─── */

function initScene() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(viewport.clientWidth, viewport.clientHeight);
  renderer.autoClear = false;
  viewport.appendChild(renderer.domElement);

  scene = new THREE.Scene();

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
  key.position.set(4, 8, 5);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x8090ff, 0.5);
  fill.position.set(-5, 2, -4);
  scene.add(fill);

  scene.add(new THREE.AxesHelper(0.5));
  const grid = new THREE.GridHelper(3, 30, 0x2a2a50, 0x1e1e3a);
  scene.add(grid);

  camera = new THREE.PerspectiveCamera(45, viewport.clientWidth / viewport.clientHeight, 0.001, 200);
  previewCamera = new THREE.PerspectiveCamera(45, 180 / 220, 0.001, 200);

  const el = renderer.domElement;

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    dragStartMouse = { x: e.clientX, y: e.clientY };
    isDragging = false;
    dragShift  = e.shiftKey;

    const allMeshes = [...meshToPiece.keys()];
    if (allMeshes.length > 0) {
      raycaster.setFromCamera(getMouseNDC(e.clientX, e.clientY), camera);
      const hits = raycaster.intersectObjects(allMeshes, false);
      if (hits.length > 0) {
        const pieceIdx = meshToPiece.get(hits[0].object);
        if (pieceIdx !== undefined) {
          selectPiece(pieceIdx);
          dragPieceIdx = pieceIdx;
          dragMode = true;
          setupDragPlane(pieceIdx, hits[0].point, e.shiftKey);
          return;
        }
      }
    }
    orbiting = true;
    lastMouse = { x: e.clientX, y: e.clientY };
  });

  window.addEventListener('mouseup', () => {
    orbiting = false;
    dragMode = false;
    dragPieceIdx = -1;
    isDragging = false;
    renderer.domElement.style.cursor = '';
  });

  window.addEventListener('mousemove', e => {
    if (dragMode) {
      const dx = e.clientX - dragStartMouse.x;
      const dy = e.clientY - dragStartMouse.y;
      if (!isDragging && Math.sqrt(dx * dx + dy * dy) > 4) isDragging = true;
      if (isDragging && dragPieceIdx >= 0) {
        renderer.domElement.style.cursor = 'move';
        movePieceDrag(dragPieceIdx, e.clientX, e.clientY);
      }
      return;
    }
    if (!orbiting) return;
    const dx = e.clientX - lastMouse.x;
    const dy = e.clientY - lastMouse.y;
    lastMouse = { x: e.clientX, y: e.clientY };
    orb.tTheta -= dx * 0.012;
    orb.tPhi = Math.max(0.05, Math.min(Math.PI - 0.05, orb.tPhi - dy * 0.012));
  });

  el.addEventListener('wheel', e => {
    e.preventDefault();
    orb.tR = Math.max(0.2, Math.min(15, orb.tR + e.deltaY * 0.005));
  }, { passive: false });

  new ResizeObserver(() => {
    const w = viewport.clientWidth, h = viewport.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }).observe(viewport);

  animate();
}

function animate() {
  requestAnimationFrame(animate);
  orb.phi    += (orb.tPhi    - orb.phi)    * 0.1;
  orb.theta  += (orb.tTheta  - orb.theta)  * 0.1;
  orb.r      += (orb.tR      - orb.r)      * 0.1;
  const { phi, theta, r } = orb;
  camera.position.set(
    cameraTarget.x + r * Math.sin(phi) * Math.sin(theta),
    cameraTarget.y + r * Math.cos(phi),
    cameraTarget.z + r * Math.sin(phi) * Math.cos(theta)
  );
  camera.lookAt(cameraTarget);

  if (selectedIdx >= 0 && pieces[selectedIdx]) {
    pieces[selectedIdx].boxHelper.update();
  }

  const dpr = renderer.getPixelRatio();
  const W   = Math.floor(viewport.clientWidth  * dpr);
  const H   = Math.floor(viewport.clientHeight * dpr);

  renderer.setScissorTest(false);
  renderer.clear();
  renderer.setScissorTest(true);

  renderer.setViewport(0, 0, W, H);
  renderer.setScissor(0, 0, W, H);
  renderer.render(scene, camera);

  const PW = Math.floor(180 * dpr);
  const PH = Math.floor(220 * dpr);
  const PX = W - PW - Math.floor(10 * dpr);
  const PY = Math.floor(10 * dpr);

  renderer.setViewport(PX, PY, PW, PH);
  renderer.setScissor(PX, PY, PW, PH);
  renderer.clearDepth();

  previewCamera.aspect = PW / PH;
  previewCamera.updateProjectionMatrix();

  let previewCenterY = camHauteur;
  let previewDist    = camDistance;

  if (pieces.length > 0) {
    const box = new THREE.Box3();
    pieces.forEach(p => box.expandByObject(p.outerGroup));
    if (!box.isEmpty()) {
      previewCenterY = (box.min.y + box.max.y) / 2;
      const sizeY  = box.max.y - box.min.y;
      const sizeX  = box.max.x - box.min.x;
      const fovRad = previewCamera.fov * Math.PI / 180;
      previewDist  = Math.max(sizeY / (2 * Math.tan(fovRad / 2)),
                              sizeX / (2 * Math.tan(fovRad * previewCamera.aspect / 2))) * 1.2;
    }
  }

  previewCamera.position.set(0, previewCenterY, previewDist);
  previewCamera.lookAt(0, previewCenterY, 0);

  renderer.render(scene, previewCamera);
  renderer.setScissorTest(false);
}

/* ─── Parser Minecraft block model ─── */

/**
 * Résout une valeur de texture (potentiellement une référence #key) vers une URL.
 * Déréférence les alias chaînés (#body → #skin → "minecraft:entity/zombie").
 */
function resolveTextureValue(textures, value) {
  if (!value) return null;

  let current = value;
  const seen  = new Set();
  while (current.startsWith('#')) {
    const key = current.slice(1);
    if (seen.has(key)) break;
    seen.add(key);
    current = textures[key] || '';
  }

  if (!current || current.startsWith('#')) return null;

  const colon = current.indexOf(':');
  if (colon < 0) return current;
  const namespace = current.slice(0, colon);
  const path      = current.slice(colon + 1);
  return `../img/compendium/${namespace}/textures/${path}.png`;
}

/**
 * Construit un Map<clé|url, MeshLambertMaterial> pour toutes les textures du modèle.
 * Un seul matériau est créé par URL distincte.
 */
function buildMaterialMap(json) {
  const textures    = json.textures || {};
  const materialMap = new Map();

  for (const [key, rawValue] of Object.entries(textures)) {
    const url = resolveTextureValue(textures, rawValue);
    if (!url) continue;

    if (materialMap.has(url)) {
      materialMap.set(key, materialMap.get(url));
      continue;
    }

    const tex = new THREE.TextureLoader().load(url);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;

    const mat = new THREE.MeshLambertMaterial({
      map:         tex,
      side:        THREE.DoubleSide,
      transparent: true,
      alphaTest:   0.1,
    });

    materialMap.set(key, mat);
    materialMap.set(url, mat);
  }

  return materialMap;
}

/**
 * Retourne le matériau correspondant à la texture d'une face.
 */
function materialForFace(materialMap, textures, faceTexture, fallback) {
  if (!faceTexture) return fallback;

  const key = faceTexture.startsWith('#') ? faceTexture.slice(1) : faceTexture;
  if (materialMap.has(key)) return materialMap.get(key);

  const url = resolveTextureValue(textures, faceTexture);
  if (url && materialMap.has(url)) return materialMap.get(url);

  return fallback;
}

function parseMinecraftModel(json) {
  const group    = new THREE.Group();
  const textures = json.textures || {};
  const fallback = new THREE.MeshLambertMaterial({ color: 0x8888aa, side: THREE.DoubleSide });

  // Un matériau par texture distincte
  const materialMap = buildMaterialMap(json);

  const S = 1 / 16;
  for (const elem of (json.elements || [])) {
    const [x1, y1, z1] = elem.from.map(v => v * S);
    const [x2, y2, z2] = elem.to.map(v => v * S);

    const faceDefs = {
      north: [x1, y2, z1, x2, y2, z1, x2, y1, z1, x1, y1, z1],
      south: [x2, y2, z2, x1, y2, z2, x1, y1, z2, x2, y1, z2],
      east:  [x2, y2, z2, x2, y2, z1, x2, y1, z1, x2, y1, z2],
      west:  [x1, y2, z1, x1, y2, z2, x1, y1, z2, x1, y1, z1],
      up:    [x1, y2, z1, x2, y2, z1, x2, y2, z2, x1, y2, z2],
      down:  [x1, y1, z2, x2, y1, z2, x2, y1, z1, x1, y1, z1],
    };

    // Regrouper les faces par matériau pour minimiser le nombre de Mesh
    const byMaterial = new Map();
    const slot = mat => {
      if (!byMaterial.has(mat)) byMaterial.set(mat, { positions: [], uvs: [], indices: [], vi: 0 });
      return byMaterial.get(mat);
    };

    for (const [faceName, fi] of Object.entries(elem.faces || {})) {
      const verts = faceDefs[faceName];
      if (!verts) continue;

      const mat = materialForFace(materialMap, textures, fi.texture, fallback);
      const s   = slot(mat);

      for (let i = 0; i < 12; i++) s.positions.push(verts[i]);

      const [u1, v1, u2, v2] = fi.uv;
      const rot = fi.rotation || 0;
      let fu = [u1/16, 1-v1/16, u2/16, 1-v1/16, u2/16, 1-v2/16, u1/16, 1-v2/16];
      if (rot === 90)  fu = [fu[6], fu[7], fu[0], fu[1], fu[2], fu[3], fu[4], fu[5]];
      if (rot === 180) fu = [fu[4], fu[5], fu[6], fu[7], fu[0], fu[1], fu[2], fu[3]];
      if (rot === 270) fu = [fu[2], fu[3], fu[4], fu[5], fu[6], fu[7], fu[0], fu[1]];
      for (let i = 0; i < 8; i++) s.uvs.push(fu[i]);

      const vi = s.vi;
      s.indices.push(vi, vi+1, vi+2, vi, vi+2, vi+3);
      s.vi += 4;
    }

    // Pivot de rotation de l'élément
    let pivotObj    = null;
    let pivotOffset = null;
    if (elem.rotation) {
      const { origin, angle, axis } = elem.rotation;
      const [ox, oy, oz] = origin.map(v => v * S);
      pivotObj = new THREE.Object3D();
      pivotObj.position.set(ox, oy, oz);
      pivotObj.rotation[axis] = THREE.MathUtils.degToRad(angle);
      pivotOffset = new THREE.Vector3(-ox, -oy, -oz);
    }

    for (const [mat, s] of byMaterial) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(s.positions, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(s.uvs, 2));
      geo.setIndex(s.indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, mat);

      if (pivotObj) {
        mesh.position.copy(pivotOffset);
        pivotObj.add(mesh);
      } else {
        group.add(mesh);
      }
    }

    if (pivotObj) group.add(pivotObj);
  }

  return group;
}

/* ─── Chargement monstre ─── */

async function loadMonster(mob) {
  for (const p of pieces) {
    scene.remove(p.outerGroup);
    scene.remove(p.boxHelper);
    p.outerGroup.traverse(c => { if (c.isMesh) c.geometry.dispose(); });
  }
  pieces = [];
  selectPiece(-1);

  if (mob.camera) {
    camDistance = mob.camera.distance ?? 2.5;
    camHauteur  = mob.camera.hauteur  ?? 0.5;
    syncCameraUI();
  }

  for (const cfg of mob.morceaux) {
    try {
      const resp = await fetch(cfg.fichier);
      const json = await resp.json();
      const modelGroup = parseMinecraftModel(json);

      const outerGroup = new THREE.Group();
      outerGroup.add(modelGroup);

      const pos = cfg.position ? [...cfg.position] : [0, 0, 0];
      const rot = cfg.rotation ? [...cfg.rotation] : [0, 0, 0];
      const sc  = cfg.scale    !== undefined ? cfg.scale : 1;

      outerGroup.position.set(...pos);
      outerGroup.rotation.set(...rot);
      outerGroup.scale.setScalar(sc);

      const boxHelper = new THREE.BoxHelper(outerGroup, 0x00eeff);
      boxHelper.visible = false;

      scene.add(outerGroup);
      scene.add(boxHelper);

      pieces.push({
        outerGroup, boxHelper,
        cfg: { fichier: cfg.fichier, position: pos, rotation: rot, scale: sc }
      });
    } catch(e) {
      console.warn('[Calibrateur] Erreur chargement', cfg.fichier, e);
    }
  }

  const box = new THREE.Box3();
  pieces.forEach(p => box.expandByObject(p.outerGroup));
  if (!box.isEmpty()) {
    box.getCenter(cameraTarget);
    const size = box.getSize(new THREE.Vector3()).length();
    orb.tR = orb.r = Math.max(0.8, size * 2.2);
  }

  rebuildMeshMap();
  buildPieceList();
  updateJSON();
}

/* ─── UI liste des pièces ─── */

function buildPieceList() {
  pieceList.innerHTML = '';
  pieces.forEach((p, i) => {
    const name = p.cfg.fichier.split('/').pop().replace('.json', '');
    const btn = document.createElement('button');
    btn.className = 'piece-btn';
    btn.textContent = name;
    btn.title = p.cfg.fichier;
    btn.addEventListener('click', () => selectPiece(i));
    pieceList.appendChild(btn);
  });
}

function selectPiece(index) {
  pieces.forEach((p, i) => {
    p.boxHelper.visible = (i === index);
  });
  document.querySelectorAll('.piece-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  selectedIdx = index;

  if (index < 0 || index >= pieces.length) {
    ctrlTitle.textContent = 'Aucune pièce';
    ctrlPanel.innerHTML = '<p class="ctrl-hint">← Sélectionne un morceau dans la liste ou clique dessus dans la vue 3D</p>';
    return;
  }

  const name = pieces[index].cfg.fichier.split('/').pop().replace('.json', '');
  ctrlTitle.textContent = name;
  buildControls(index);
}

/* ─── Contrôles transforms ─── */

function buildControls(index) {
  ctrlPanel.innerHTML = '';
  const piece = pieces[index];
  const cfg   = piece.cfg;

  const fields = [
    { group: 'Position',     label: 'X', key: 'position', axis: 0, min: -3,   max: 3,   step: 0.001 },
    { group: null,           label: 'Y', key: 'position', axis: 1, min: -3,   max: 3,   step: 0.001 },
    { group: null,           label: 'Z', key: 'position', axis: 2, min: -3,   max: 3,   step: 0.001 },
    { group: 'Rotation (°)', label: 'X', key: 'rotation', axis: 0, min: -180, max: 180, step: 0.5, isDeg: true },
    { group: null,           label: 'Y', key: 'rotation', axis: 1, min: -180, max: 180, step: 0.5, isDeg: true },
    { group: null,           label: 'Z', key: 'rotation', axis: 2, min: -180, max: 180, step: 0.5, isDeg: true },
    { group: 'Scale',        label: '',  key: 'scale',    min: 0.05, max: 4, step: 0.01 },
  ];

  let lastGroup = null;

  for (const f of fields) {
    if (f.group && f.group !== lastGroup) {
      const sep = document.createElement('div');
      sep.className = 'ctrl-group-title';
      sep.textContent = f.group;
      ctrlPanel.appendChild(sep);
      lastGroup = f.group;
    }

    const rawVal = f.key === 'scale'
      ? cfg.scale
      : (f.isDeg ? cfg[f.key][f.axis] * (180 / Math.PI) : cfg[f.key][f.axis]);

    const row   = document.createElement('div');
    row.className = 'ctrl-row';

    const label = document.createElement('label');
    label.textContent = f.label;

    const range = document.createElement('input');
    range.type = 'range';
    range.min = f.min; range.max = f.max; range.step = f.step;
    range.value = rawVal;
    if (f.key === 'scale') range.classList.add('green');

    const num = document.createElement('input');
    num.type = 'number';
    num.min = f.min; num.max = f.max; num.step = f.step;
    num.value = parseFloat(rawVal.toFixed(4));

    const apply = val => {
      const v = parseFloat(val);
      if (isNaN(v)) return;
      if (f.key === 'scale') {
        cfg.scale = v;
        piece.outerGroup.scale.setScalar(v);
      } else if (f.isDeg) {
        const rad = v * Math.PI / 180;
        cfg[f.key][f.axis] = rad;
        piece.outerGroup.rotation[['x','y','z'][f.axis]] = rad;
      } else {
        cfg[f.key][f.axis] = v;
        piece.outerGroup.position[['x','y','z'][f.axis]] = v;
      }
      updateJSON();
    };

    range.addEventListener('input', () => { num.value = parseFloat(range.value).toFixed(4); apply(range.value); });
    num.addEventListener('change', () => { range.value = num.value; apply(num.value); });

    row.append(label, range, num);
    ctrlPanel.appendChild(row);
  }
}

/* ─── Export ─── */

function fmtArr(arr) {
  return '[' + arr.join(', ') + ']';
}

function updateJSON() {
  const lines = ['morceaux: ['];
  pieces.forEach((p, i) => {
    const pos   = fmtArr(p.cfg.position.map(v => round4(v)));
    const rot   = fmtArr(p.cfg.rotation.map(v => round4(v)));
    const sc    = round3(p.cfg.scale);
    const comma = i < pieces.length - 1 ? ',' : '';
    lines.push(
      `    {`,
      `      fichier: '${p.cfg.fichier}',`,
      `      position: ${pos},`,
      `      rotation: ${rot},`,
      `      scale: ${sc}`,
      `    }${comma}`,
    );
  });
  lines.push(
    `  ],`,
    `  camera: {`,
    `    distance: ${round3(camDistance)},   // distance de la caméra (plus grand = plus loin)`,
    `    hauteur: ${round3(camHauteur)}   // hauteur du point de regard (0 = centre, + = plus haut)`,
    `  }`,
  );
  jsonOutput.value = lines.join('\n');
}

const round4 = v => parseFloat(v.toFixed(4));
const round3 = v => parseFloat(v.toFixed(3));

/* ─── Caméra UI ─── */

function syncCameraUI() {
  document.getElementById('cam-dist').value     = camDistance;
  document.getElementById('cam-dist-num').value = camDistance;
  document.getElementById('cam-haut').value     = camHauteur;
  document.getElementById('cam-haut-num').value = camHauteur;
}

function bindCameraInput(rangeId, numId, setter) {
  const range = document.getElementById(rangeId);
  const num   = document.getElementById(numId);
  range.addEventListener('input', () => {
    num.value = range.value;
    setter(parseFloat(range.value));
    updateJSON();
  });
  num.addEventListener('change', () => {
    range.value = num.value;
    setter(parseFloat(num.value));
    updateJSON();
  });
}

bindCameraInput('cam-dist', 'cam-dist-num', v => { camDistance = v; orb.tR = v; });
bindCameraInput('cam-haut', 'cam-haut-num', v => {
  camHauteur = v;
  cameraTarget.y = v;
});

/* ─── Reset pièce ─── */

document.getElementById('reset-btn').addEventListener('click', () => {
  if (selectedIdx < 0 || selectedIdx >= pieces.length) return;
  const p = pieces[selectedIdx];
  p.cfg.position = [0, 0, 0];
  p.cfg.rotation = [0, 0, 0];
  p.cfg.scale    = 1;
  p.outerGroup.position.set(0, 0, 0);
  p.outerGroup.rotation.set(0, 0, 0);
  p.outerGroup.scale.setScalar(1);
  buildControls(selectedIdx);
  updateJSON();
});

/* ─── Copier ─── */

document.getElementById('copy-btn').addEventListener('click', () => {
  navigator.clipboard.writeText(jsonOutput.value).then(() => {
    const btn = document.getElementById('copy-btn');
    btn.textContent = '✓ Copié !';
    btn.classList.add('success');
    setTimeout(() => { btn.textContent = '📋 Copier'; btn.classList.remove('success'); }, 1800);
  });
});

/* ─── Sélecteur monstre ─── */

const mobsAvec3D = (typeof MOBS !== 'undefined' ? MOBS : [])
  .filter(m => m.morceaux && m.morceaux.length > 0);

mobsAvec3D.forEach(mob => {
  const opt = document.createElement('option');
  opt.value = mob.id;
  opt.textContent = `[P${mob.palier}] ${mob.name}`;
  monsterSel.appendChild(opt);
});

monsterSel.addEventListener('change', () => {
  const mob = mobsAvec3D.find(m => m.id === monsterSel.value);
  if (mob) loadMonster(mob);
});

/* ─── Init ─── */

initScene();

if (mobsAvec3D.length > 0) {
  monsterSel.value = mobsAvec3D[0].id;
  loadMonster(mobsAvec3D[0]);
}