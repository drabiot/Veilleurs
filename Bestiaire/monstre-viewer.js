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

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.setClearColor(this.opts.bgColor, 1);
    this.container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(this.opts.fogColor, 8, 30);

    // Lumières
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const key = new THREE.DirectionalLight(0xffe8c0, 1.0);
    key.position.set(4, 8, 5);
    key.castShadow = true;
    this.scene.add(key);

    const fill = new THREE.DirectionalLight(0x6080ff, 0.4);
    fill.position.set(-5, 2, -4);
    this.scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.3);
    rim.position.set(0, -3, -6);
    this.scene.add(rim);

    // Sol discret
    const solGeo = new THREE.CircleGeometry(4, 64);
    const solMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a2e,
      roughness: 1,
      metalness: 0,
    });
    const sol = new THREE.Mesh(solGeo, solMat);
    sol.rotation.x = -Math.PI / 2;
    sol.position.y = -1.2;
    sol.receiveShadow = true;
    this.scene.add(sol);

    // Caméra
    this.camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    this.camera.position.set(0, 1, 4);
    this.camera.lookAt(0, 0, 0);

    // État orbite
    this._orb = { phi: Math.PI / 4, theta: 0, r: 4, targetPhi: Math.PI / 4, targetTheta: 0, targetR: 4 };
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
    el.addEventListener('wheel', e => {
      e.preventDefault();
      this._orb.targetR = Math.max(1.5, Math.min(20, this._orb.targetR + e.deltaY * 0.01));
    }, { passive: false });

    // Touch
    let lastTouchDist = 0;
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        this._dragging = true;
        this._lastMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      } else if (e.touches.length === 2) {
        lastTouchDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
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
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        this._orb.targetR = Math.max(1.5, Math.min(20, this._orb.targetR - (dist - lastTouchDist) * 0.02));
        lastTouchDist = dist;
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
    this.container.removeChild(this.renderer.domElement);
  }
}