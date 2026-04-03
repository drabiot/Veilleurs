/**
 * MonstreViewer3D — composant réutilisable pour Veilleurs au Clair de Lune
 * 
 * Usage :
 *   const viewer = new MonstreViewer3D(containerElement, options);
 *   viewer.charger('gobelin-des-cendres');
 * 
 * Dépend de Three.js (r128+) chargé avant ce fichier.
 */

class MonstreViewer3D {
  constructor(container, options = {}) {
    this.container = container;
    this.opts = Object.assign({
      basePath: './Bestiaire/models/',        // chemin vers les dossiers de monstres
      configPath: './Bestiaire/monstres.json', // fichier de config central
      autoRotate: true,
      bgColor: 0x0d0d1a,
      fogColor: 0x0d0d1a,
    }, options);

    this._config = null;       // données monstres.json
    this._pieces = [];         // objets THREE chargés
    this._selected = null;
    this._animId = null;

    this._initScene();
    this._initControls();
    this._loadConfig();
  }

  /* ─── Scène ─── */

  _initScene() {
    const w = this.container.clientWidth || 400;
    const h = this.container.clientHeight || 400;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();

    // Lumières
    const ambient = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe8c0, 1.2);
    key.position.set(4, 8, 5);
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x8090ff, 0.5);
    fill.position.set(-5, 2, -4);
    this.scene.add(fill);

    // Caméra
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    this.camera.position.set(0, 1, 4);
    this.camera.lookAt(0, 0, 0);

    // État orbite
    this._orb = { phi: Math.PI / 2, theta: 0, r: 4, targetPhi: Math.PI / 2, targetTheta: 0, targetR: 4 };
    this._dragging = false;
    this._lastMouse = { x: 0, y: 0 };

    // Resize observer
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

    // Inertie orbe
    if (this.opts.autoRotate && !this._dragging) {
      this._orb.targetTheta += 0.004;
    }
    this._orb.theta  += (this._orb.targetTheta - this._orb.theta)  * 0.08;
    this._orb.phi    += (this._orb.targetPhi   - this._orb.phi)    * 0.08;
    this._orb.r      += (this._orb.targetR     - this._orb.r)      * 0.08;

    const { phi, theta, r } = this._orb;
    this.camera.position.set(
      r * Math.sin(phi) * Math.sin(theta),
      r * Math.cos(phi) + (this._camHauteur || 0),
      r * Math.sin(phi) * Math.cos(theta)
    );
    this.camera.lookAt(0, this._camHauteur || 0, 0);

    this.renderer.render(this.scene, this.camera);
  }

  /* ─── Contrôles souris / touch ─── */

  _initControls() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      this._dragging = true;
      this._lastMouse = { x: e.clientX, y: e.clientY };
    });
    window.addEventListener('mouseup', () => { this._dragging = false; });
    window.addEventListener('mousemove', e => {
      if (!this._dragging) return;
      const dx = e.clientX - this._lastMouse.x;
      const dy = e.clientY - this._lastMouse.y;
      this._lastMouse = { x: e.clientX, y: e.clientY };
      this._orb.targetTheta -= dx * 0.012;
      this._orb.targetPhi = Math.max(0.1, Math.min(Math.PI - 0.1, this._orb.targetPhi - dy * 0.012));
    });
    // Touch (drag uniquement, pas de pinch zoom)
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._dragging = true;
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

  /* ─── Chargement ─── */

  async _loadConfig() {
    try {
      const r = await fetch(this.opts.configPath);
      this._config = await r.json();
    } catch(e) {
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
      // Attendre que la config soit prête
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
    this._orb.targetR   = this._orb.r   = cam.distance || 4;
    this._camHauteur = cam.hauteur || 0;

    const loader = new THREE.ObjectLoader();
    const baseUrl = this.opts.basePath + monstre.id + '/';

    const promesses = monstre.morceaux.map(m => this._chargerMorceau(loader, baseUrl, m));
    await Promise.all(promesses);

    // Centrage vertical auto
    const box = new THREE.Box3();
    this._pieces.forEach(p => box.expandByObject(p));
    const center = box.getCenter(new THREE.Vector3());
    this._pieces.forEach(p => { p.position.y -= center.y; });
  }

  /**
   * Charge et affiche un monstre directement depuis un objet de données (champ morceaux).
   * @param {object} mobData  - objet monstre avec morceaux[] et camera
   */
  async chargerDepuisData(mobData) {
    this._vider();

    const cam = mobData.camera || {};
    this._orb.targetR    = this._orb.r    = cam.distance || 4;
    this._orb.targetPhi  = this._orb.phi  = Math.PI / 2;
    this._orb.targetTheta = this._orb.theta = 0;
    this._camHauteur = cam.hauteur || 0;

    const promesses = mobData.morceaux.map(m => this._chargerMorceauDirect(m));
    await Promise.all(promesses);

    const box = new THREE.Box3();
    this._pieces.forEach(p => box.expandByObject(p));
    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      this._pieces.forEach(p => { p.position.y -= center.y; });
    }
  }

  async _chargerMorceauDirect(cfg) {
    try {
      const r = await fetch(cfg.fichier);
      const json = await r.json();
      const obj = this._parseMinecraftModel(json);

      if (cfg.position) obj.position.set(...cfg.position);
      if (cfg.rotation) obj.rotation.set(...cfg.rotation);
      if (cfg.scale !== undefined) obj.scale.setScalar(cfg.scale);

      obj.traverse(c => {
        if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; }
      });

      this.scene.add(obj);
      this._pieces.push(obj);
    } catch(e) {
      console.warn('[MonstreViewer3D] Erreur morceau direct', cfg.fichier, e);
    }
  }

  /* ─── Parser Minecraft block model (format ModelEngine) ─── */

  _resolveTexture(json) {
    const textures = json.textures || {};
    // Find first non-reference value (e.g. "modelengine:entity/em_bandit_a1")
    for (const val of Object.values(textures)) {
      if (val && !val.startsWith('#')) {
        const colon = val.indexOf(':');
        if (colon < 0) return val;
        const namespace = val.slice(0, colon);
        const path      = val.slice(colon + 1);
        return `../img/compendium/${namespace}/textures/${path}.png`;
      }
    }
    return null;
  }

  _parseMinecraftModel(json) {
    const group = new THREE.Group();

    const texSrc = this._resolveTexture(json);
    let material;
    if (texSrc) {
      const tex = new THREE.TextureLoader().load(texSrc);
      tex.magFilter = THREE.NearestFilter;
      tex.minFilter = THREE.NearestFilter;
      material = new THREE.MeshLambertMaterial({
        map: tex,
        side: THREE.DoubleSide,
        transparent: true,
        alphaTest: 0.1,
      });
    } else {
      material = new THREE.MeshLambertMaterial({ color: 0x888888, side: THREE.DoubleSide });
    }

    const S = 1 / 16; // Minecraft units → world units

    for (const elem of (json.elements || [])) {
      const [x1,y1,z1] = elem.from.map(v => v * S);
      const [x2,y2,z2] = elem.to.map(v => v * S);

      // Each face: 4 vertices (quad), UV from Minecraft [u1,v1,u2,v2]
      // Minecraft UV: V=0 top, V=16 bottom → flip V for WebGL (V=0 bottom)
      const faceDefs = {
        // north = -Z face. Looking from -Z: left=west(x1), right=east(x2)
        north: [x1,y2,z1, x2,y2,z1, x2,y1,z1, x1,y1,z1],
        // south = +Z face. Looking from +Z: left=east(x2), right=west(x1)
        south: [x2,y2,z2, x1,y2,z2, x1,y1,z2, x2,y1,z2],
        // east = +X face. Looking from +X: left=south(z2), right=north(z1)
        east:  [x2,y2,z2, x2,y2,z1, x2,y1,z1, x2,y1,z2],
        // west = -X face. Looking from -X: left=north(z1), right=south(z2)
        west:  [x1,y2,z1, x1,y2,z2, x1,y1,z2, x1,y1,z1],
        // up = +Y face. Looking from above: left=west(x1), right=east(x2), top=north(z1)
        up:    [x1,y2,z1, x2,y2,z1, x2,y2,z2, x1,y2,z2],
        // down = -Y face. Looking from below: left=west(x1), right=east(x2), top=south(z2)
        down:  [x1,y1,z2, x2,y1,z2, x2,y1,z1, x1,y1,z1],
      };

      const positions = [];
      const uvs = [];
      const indices = [];
      let vi = 0;

      for (const [faceName, faceInfo] of Object.entries(elem.faces || {})) {
        const verts = faceDefs[faceName];
        if (!verts) continue;

        for (let i = 0; i < 12; i++) positions.push(verts[i]);

        const [u1,v1,u2,v2] = faceInfo.uv;
        const rot = faceInfo.rotation || 0;

        // UV corners: TL(v0), TR(v1), BR(v2), BL(v3)
        // Flip V: mc_v → 1 - mc_v/16
        let fu = [
          u1/16, 1-v1/16,   // TL
          u2/16, 1-v1/16,   // TR
          u2/16, 1-v2/16,   // BR
          u1/16, 1-v2/16,   // BL
        ];

        // Apply UV face rotation (Minecraft rotates texture CCW)
        if (rot === 90)  fu = [fu[6],fu[7], fu[0],fu[1], fu[2],fu[3], fu[4],fu[5]];
        if (rot === 180) fu = [fu[4],fu[5], fu[6],fu[7], fu[0],fu[1], fu[2],fu[3]];
        if (rot === 270) fu = [fu[2],fu[3], fu[4],fu[5], fu[6],fu[7], fu[0],fu[1]];

        for (let i = 0; i < 8; i++) uvs.push(fu[i]);

        indices.push(vi,vi+1,vi+2, vi,vi+2,vi+3);
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
        const [ox,oy,oz] = origin.map(v => v * S);
        const rad = THREE.MathUtils.degToRad(angle);
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
      const r = await fetch(baseUrl + cfg.fichier);
      const json = await r.json();
      const obj = loader.parse(json);

      // Appliquer la position/rotation/scale définie dans monstres.json
      if (cfg.position) obj.position.set(...cfg.position);
      if (cfg.rotation) obj.rotation.set(...cfg.rotation);
      if (cfg.scale !== undefined) obj.scale.setScalar(cfg.scale);

      // Activer les ombres
      obj.traverse(c => {
        if (c.isMesh) {
          c.castShadow = true;
          c.receiveShadow = true;
        }
      });

      this.scene.add(obj);
      this._pieces.push(obj);
    } catch(e) {
      console.warn('[MonstreViewer3D] Erreur morceau', cfg.fichier, e);
    }
  }

  _vider() {
    this._pieces.forEach(p => {
      this.scene.remove(p);
      p.traverse(c => { if (c.isMesh) { c.geometry.dispose(); } });
    });
    this._pieces = [];
  }

  /**
   * Prend une capture PNG de la scène et retourne un Data URL.
   * @returns {string} Data URL de l'image
   */
  capturer() {
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  /**
   * Télécharge une capture PNG.
   * @param {string} nom - nom du fichier (sans extension)
   */
  telecharger(nom = 'monstre') {
    const url = this.capturer();
    const a = document.createElement('a');
    a.href = url;
    a.download = nom + '.png';
    a.click();
  }

  /**
   * Détruit le viewer et libère les ressources.
   */
  destroy() {
    cancelAnimationFrame(this._animId);
    this._ro.disconnect();
    this._vider();
    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }

  /**
   * Génère une capture PNG statique du modèle (hors-écran).
   * @param {object} mobData  - objet monstre avec morceaux[] et camera
   * @param {number} size     - taille en px du canvas de capture
   * @returns {Promise<string>} Data URL PNG
   */
  static captureStatic(mobData, size = 200) {
    return new Promise(resolve => {
      const tmp = document.createElement('div');
      tmp.style.cssText = `position:fixed;left:-9999px;top:0;width:${size}px;height:${size}px;pointer-events:none;`;
      document.body.appendChild(tmp);

      const viewer = new MonstreViewer3D(tmp, { autoRotate: false });
      viewer.chargerDepuisData(mobData).then(() => {
        let frames = 0;
        const wait = () => {
          viewer.renderer.render(viewer.scene, viewer.camera);
          if (++frames < 12) { requestAnimationFrame(wait); return; }
          const url = viewer.capturer();
          viewer.destroy();
          document.body.removeChild(tmp);
          resolve(url);
        };
        requestAnimationFrame(wait);
      });
    });
  }
}