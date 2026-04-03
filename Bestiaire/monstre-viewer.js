/**
 * MonstreViewer3D — composant réutilisable pour Veilleurs au Clair de Lune
 *
 * Usage :
 *   const viewer = new MonstreViewer3D(containerElement, options);
 *   viewer.charger('gobelin-des-cendres');
 *
 * Dépend de Three.js (r128+) chargé avant ce fichier.
 *
 * Correctifs v2 :
 *   - Les textures sont attendues (Promise) avant toute capture
 *   - captureStatic utilise un renderer WebGL partagé (évite l'épuisement des contextes)
 *   - Les captures sont sérialisées pour éviter les race conditions
 */

class MonstreViewer3D {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign({
      basePath:   './Bestiaire/models/',
      configPath: './Bestiaire/monstres.json',
      autoRotate: true,
      bgColor:    0x0d0d1a,
      fogColor:   0x0d0d1a,
    }, options);

    this._config       = null;
    this._pieces       = [];
    this._selected     = null;
    this._animId       = null;
    this._texPromises  = [];   // promesses de chargement de textures

    this._initScene();
    this._initControls();
    this._loadConfig();
  }

  /* ─── Scène ─────────────────────────────────────────────────────────── */

  _initScene() {
    const w = this.container.clientWidth  || 400;
    const h = this.container.clientHeight || 400;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
    key.position.set(4, 8, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8090ff, 0.5);
    fill.position.set(-5, 2, -4);
    this.scene.add(fill);

    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    this.camera.position.set(0, 1, 4);
    this.camera.lookAt(0, 0, 0);

    this._orb = {
      phi: Math.PI / 2, theta: 0, r: 4,
      targetPhi: Math.PI / 2, targetTheta: 0, targetR: 4,
    };
    this._dragging  = false;
    this._lastMouse = { x: 0, y: 0 };

    this._ro = new ResizeObserver(() => this._onResize());
    this._ro.observe(this.container);

    this._animate();
  }

  _onResize() {
    const w = this.container.clientWidth;
    const h = this.container.clientHeight;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  _animate() {
    this._animId = requestAnimationFrame(() => this._animate());

    if (this.opts.autoRotate && !this._dragging) {
      this._orb.targetTheta += 0.004;
    }
    this._orb.theta += (this._orb.targetTheta - this._orb.theta) * 0.08;
    this._orb.phi   += (this._orb.targetPhi   - this._orb.phi)   * 0.08;
    this._orb.r     += (this._orb.targetR     - this._orb.r)     * 0.08;

    const { phi, theta, r } = this._orb;
    const cy = this._camHauteur || 0;
    this.camera.position.set(
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi) + cy,
      r * Math.sin(phi) * Math.cos(theta),
    );
    this.camera.lookAt(0, cy, 0);

    this.renderer.render(this.scene, this.camera);
  }

  /* ─── Contrôles souris / touch ──────────────────────────────────────── */

  _initControls() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      this._dragging  = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup',   () => { this._dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._orb.targetTheta -= dx * 0.012;
      this._orb.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this._orb.targetPhi - dy * 0.012));
    });

    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._dragging  = true;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      }
    });
    el.addEventListener('touchend', () => { this._dragging = false; });
    el.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length === 1 && this._dragging) {
        const dx = e.touches[0].clientX - this._lastMouse.x;
        const dy = e.touches[0].clientY - this._lastMouse.y;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        this._orb.targetTheta -= dx * 0.012;
        this._orb.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this._orb.targetPhi - dy * 0.012));
      }
    }, { passive: false });
  }

  /* ─── Chargement config ─────────────────────────────────────────────── */

  async _loadConfig() {
    try {
      const r    = await fetch(this.opts.configPath);
      this._config = await r.json();
    } catch (e) {
      console.warn('[MonstreViewer3D] Impossible de charger monstres.json :', e);
      this._config = [];
    }
  }

  /**
   * Charge et affiche un monstre par son id.
   * @param {string} monsterId  - correspond au champ "id" dans monstres.json
   */
  async charger(monsterId) {
    if (!this._config) {
      await new Promise(res => setTimeout(res, 300));
      return this.charger(monsterId);
    }

    const monstre = this._config.find(m => m.id === monsterId);
    if (!monstre) {
      console.warn('[MonstreViewer3D] Monstre introuvable :', monsterId);
      return;
    }

    this._vider();

    const cam = monstre.camera || {};
    this._orb.targetR = this._orb.r = cam.distance || 4;
    this._camHauteur  = cam.hauteur || 0;

    const loader  = new THREE.ObjectLoader();
    const baseUrl = this.opts.basePath + monstre.id + '/';

    await Promise.all(monstre.morceaux.map(m => this._chargerMorceau(loader, baseUrl, m)));

    this._centrerVerticalement();
  }

  /**
   * Charge et affiche un monstre directement depuis un objet de données.
   * Attend que toutes les textures soient chargées avant de résoudre.
   * @param {object} mobData  - objet monstre avec morceaux[] et camera
   */
  async chargerDepuisData(mobData) {
    this._vider();

    const cam = mobData.camera || {};
    this._orb.targetR     = this._orb.r     = cam.distance || 4;
    this._orb.targetPhi   = this._orb.phi   = Math.PI / 2;
    this._orb.targetTheta = this._orb.theta = 0;
    this._camHauteur = cam.hauteur || 0;

    await Promise.all(mobData.morceaux.map(m => this._chargerMorceauDirect(m)));

    // ← CORRECTIF 1 : attendre que toutes les textures soient prêtes
    await this._attendreTextures();

    this._centrerVerticalement();
  }

  /**
   * Attend que toutes les TextureLoader promises lancées par _parseMinecraftModel
   * soient résolues (ou rejetées), puis vide la liste.
   */
  async _attendreTextures() {
    if (this._texPromises.length === 0) return;
    await Promise.allSettled(this._texPromises);
    this._texPromises = [];
  }

  _centrerVerticalement() {
    const box = new THREE.Box3();
    this._pieces.forEach(p => box.expandByObject(p));
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      this._pieces.forEach(p => { p.position.y -= center.y; });
    }
  }

  async _chargerMorceauDirect(cfg) {
    try {
      const r    = await fetch(cfg.fichier);
      const json = await r.json();
      const obj  = this._parseMinecraftModel(json);  // enregistre les texPromises

      if (cfg.position) obj.position.set(...cfg.position);
      if (cfg.rotation) obj.rotation.set(...cfg.rotation);
      if (cfg.scale !== undefined) obj.scale.setScalar(cfg.scale);

      obj.traverse(c => {
        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });

      this.scene.add(obj);
      this._pieces.push(obj);
    } catch (e) {
      console.warn('[MonstreViewer3D] Erreur morceau direct', cfg.fichier, e);
    }
  }

  /* ─── Parser Minecraft block model (format ModelEngine) ─────────────── */

  _resolveTexture(json) {
    const textures = json.textures || {};
    for (const val of Object.values(textures)) {
      if (val && !val.startsWith('#')) {
        const colon     = val.indexOf(':');
        if (colon < 0) return val;
        const namespace = val.slice(0, colon);
        const path      = val.slice(colon + 1);
        return `../img/compendium/${namespace}/textures/${path}.png`;
      }
    }
    return null;
  }

  _parseMinecraftModel(json) {
    const group  = new THREE.Group();
    const texSrc = this._resolveTexture(json);
    let material;

    if (texSrc) {
      // ← CORRECTIF 1 : on crée une Promise par texture et on la stocke
      const texPromise = new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(
          texSrc,
          tex => {
            tex.magFilter = THREE.NearestFilter;
            tex.minFilter = THREE.NearestFilter;
            // Affecter la texture sur le matériau une fois chargée
            material.map = tex;
            material.needsUpdate = true;
            resolve(tex);
          },
          undefined,
          err => {
            console.warn('[MonstreViewer3D] Texture introuvable :', texSrc, err);
            reject(err);
          },
        );
      });
      this._texPromises.push(texPromise);

      material = new THREE.MeshLambertMaterial({
        side:        THREE.DoubleSide,
        transparent: true,
        alphaTest:   0.1,
      });
    } else {
      material = new THREE.MeshLambertMaterial({ color: 0x888888, side: THREE.DoubleSide });
    }

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

      const positions = [];
      const uvs       = [];
      const indices   = [];
      let vi = 0;

      for (const [faceName, faceInfo] of Object.entries(elem.faces || {})) {
        const verts = faceDefs[faceName];
        if (!verts) continue;

        for (let i = 0; i < 12; i++) positions.push(verts[i]);

        const [u1, v1, u2, v2] = faceInfo.uv;
        const rot = faceInfo.rotation || 0;

        let fu = [
          u1 / 16, 1 - v1 / 16,
          u2 / 16, 1 - v1 / 16,
          u2 / 16, 1 - v2 / 16,
          u1 / 16, 1 - v2 / 16,
        ];

        if (rot === 90)  fu = [fu[6], fu[7], fu[0], fu[1], fu[2], fu[3], fu[4], fu[5]];
        if (rot === 180) fu = [fu[4], fu[5], fu[6], fu[7], fu[0], fu[1], fu[2], fu[3]];
        if (rot === 270) fu = [fu[2], fu[3], fu[4], fu[5], fu[6], fu[7], fu[0], fu[1]];

        for (let i = 0; i < 8; i++) uvs.push(fu[i]);

        indices.push(vi, vi + 1, vi + 2, vi, vi + 2, vi + 3);
        vi += 4;
      }

      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geo.setAttribute('uv',       new THREE.Float32BufferAttribute(uvs, 2));
      geo.setIndex(indices);
      geo.computeVertexNormals();

      const mesh = new THREE.Mesh(geo, material);

      if (elem.rotation) {
        const { origin, angle, axis } = elem.rotation;
        const [ox, oy, oz] = origin.map(v => v * S);
        const rad   = THREE.MathUtils.degToRad(angle);
        const pivot = new THREE.Object3D();
        pivot.position.set(ox, oy, oz);
        pivot.rotation[axis] = rad;
        mesh.position.set(-ox, -oy, -oz);
        pivot.add(mesh);
        group.add(pivot);
      } else {
        group.add(mesh);
      }
    }

    return group;
  }

  async _chargerMorceau(loader, baseUrl, cfg) {
    try {
      const r   = await fetch(baseUrl + cfg.fichier);
      const json = await r.json();
      const obj  = loader.parse(json);

      if (cfg.position) obj.position.set(...cfg.position);
      if (cfg.rotation) obj.rotation.set(...cfg.rotation);
      if (cfg.scale !== undefined) obj.scale.setScalar(cfg.scale);

      obj.traverse(c => {
        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });

      this.scene.add(obj);
      this._pieces.push(obj);
    } catch (e) {
      console.warn('[MonstreViewer3D] Erreur morceau', cfg.fichier, e);
    }
  }

  _vider() {
    this._pieces.forEach(p => {
      this.scene.remove(p);
      p.traverse(c => { if (c.isMesh) { c.geometry.dispose(); } });
    });
    this._pieces      = [];
    this._texPromises = [];
  }

  /* ─── Capture ───────────────────────────────────────────────────────── */

  capturer() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  telecharger(nom = 'monstre') {
    const url = this.capturer();
    const a   = document.createElement('a');
    a.href     = url;
    a.download = nom + '.png';
    a.click();
  }

  destroy() {
    cancelAnimationFrame(this._animId);
    this._ro.disconnect();
    this._vider();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  /* ─── Capture statique (renderer partagé + file sérialisée) ─────────── */

  /**
   * CORRECTIF 2 : renderer WebGL partagé entre toutes les captures statiques.
   * Évite l'épuisement des contextes GPU quand on génère N miniatures d'un coup.
   */
  static _sharedRenderer   = null;
  static _sharedScene      = null;
  static _sharedCamera     = null;

  static _getSharedRig(size) {
    if (!MonstreViewer3D._sharedRenderer) {
      const renderer = new THREE.WebGLRenderer({
        antialias:            true,
        alpha:                true,
        preserveDrawingBuffer: true,
      });
      renderer.setPixelRatio(1);
      // Hors-document : pas besoin de l'ajouter au DOM
      MonstreViewer3D._sharedRenderer = renderer;

      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight(0xffffff, 0.9));
      const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
      key.position.set(4, 8, 5);
      scene.add(key);
      const fill = new THREE.DirectionalLight(0x8090ff, 0.5);
      fill.position.set(-5, 2, -4);
      scene.add(fill);
      MonstreViewer3D._sharedScene = scene;

      const camera = new THREE.PerspectiveCamera(45, 1, 0.01, 200);
      MonstreViewer3D._sharedCamera = camera;
    }

    MonstreViewer3D._sharedRenderer.setSize(size, size);
    return {
      renderer: MonstreViewer3D._sharedRenderer,
      scene:    MonstreViewer3D._sharedScene,
      camera:   MonstreViewer3D._sharedCamera,
    };
  }

  /**
   * CORRECTIF 3 : file d'attente sérialisée.
   * Les appels concurrents (ex. grille de monstres) sont exécutés l'un après l'autre,
   * jamais en parallèle, ce qui évite les race conditions sur le renderer partagé.
   */
  static _captureQueue = Promise.resolve();

  /**
   * Génère une capture PNG statique du modèle.
   * @param {object} mobData  - objet monstre avec morceaux[] et camera
   * @param {number} size     - taille en px du canvas de capture
   * @returns {Promise<string>} Data URL PNG
   */
  static captureStatic(mobData, size = 200) {
    MonstreViewer3D._captureQueue = MonstreViewer3D._captureQueue
      .then(() => MonstreViewer3D._doCapture(mobData, size))
      .catch(err => {
        console.warn('[MonstreViewer3D] Erreur dans la file de capture :', err);
        return null;
      });
    return MonstreViewer3D._captureQueue;
  }

  static async _doCapture(mobData, size) {
    const { renderer, scene, camera } = MonstreViewer3D._getSharedRig(size);

    // Vider la scène partagée des pièces du monstre précédent
    const pieces = [];
    const texPromises = [];

    const cam = mobData.camera || {};
    const dist    = cam.distance || 4;
    const hauteur = cam.hauteur  || 0;

    camera.aspect = 1;
    camera.updateProjectionMatrix();
    camera.position.set(0, dist * Math.cos(Math.PI / 2) + hauteur, dist * Math.sin(Math.PI / 2));
    camera.lookAt(0, hauteur, 0);

    // Viewer temporaire minimaliste pour parser les morceaux
    // (on réutilise le parser sans créer de vrai renderer)
    const tmpViewer = Object.create(MonstreViewer3D.prototype);
    tmpViewer._texPromises = texPromises;
    tmpViewer._resolveTexture = MonstreViewer3D.prototype._resolveTexture;
    tmpViewer._parseMinecraftModel = MonstreViewer3D.prototype._parseMinecraftModel;

    for (const cfg of mobData.morceaux) {
      try {
        const r    = await fetch(cfg.fichier);
        const json = await r.json();
        const obj  = tmpViewer._parseMinecraftModel(json);

        if (cfg.position) obj.position.set(...cfg.position);
        if (cfg.rotation) obj.rotation.set(...cfg.rotation);
        if (cfg.scale !== undefined) obj.scale.setScalar(cfg.scale);

        scene.add(obj);
        pieces.push(obj);
      } catch (e) {
        console.warn('[MonstreViewer3D] _doCapture : erreur morceau', cfg.fichier, e);
      }
    }

    // ← CORRECTIF 1 : attendre toutes les textures avant de capturer
    if (texPromises.length > 0) {
      await Promise.allSettled(texPromises);
    }

    // Centrage vertical
    const box = new THREE.Box3();
    pieces.forEach(p => box.expandByObject(p));
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      pieces.forEach(p => { p.position.y -= center.y; });
    }

    // Render final
    renderer.render(scene, camera);
    const dataUrl = renderer.domElement.toDataURL('image/png');

    // Nettoyage : retirer les pièces de la scène partagée
    pieces.forEach(p => {
      scene.remove(p);
      p.traverse(c => { if (c.isMesh) { c.geometry.dispose(); } });
    });

    return dataUrl;
  }
}