(() => {
  'use strict';

  /* ══ ÉTAT ══ */
  let equipped      = {};
  let equippedRunes = {};
  let activeSlot    = null;
  let filterQ       = '';
  let filterRar     = null;
  let filterTier 	= null;
  let activeClass   = null;
  let filterStats	= new Set();
  const NUM_BUILDS   = 100;
	let activeBuildIndex = 0;

  /* ══ INDEX MAPS ══
     Lookup O(1) au lieu de N × Array.find() dans les boucles de rendu.
     Les données viennent de Compendium/data.js (chargé avant ce script). */
  const STATS_BY_ID   = new Map(ALL_STATS.map(s => [s.id, s]));
  const SLOTS_BY_ID   = new Map(ALL_SLOTS.map(s => [s.id, s]));
  const CAR_BY_ID     = new Map(CARACTERISTIQUES.map(c => [c.id, c]));
  const RUNES_BY_ID   = new Map(RUNES.map(r => [r.id, r]));
  const CLASSES_BY_ID = new Map(CLASSES.map(c => [c.id, c]));

  /* ══ VALIDATION DES RUNES ══ */
  function isRuneKeyValid(runeKey, equippedItems) {
    const match = runeKey.match(/^(.+)_rune_(\d+)$/);
    if (!match) return false;
    const slotId    = match[1];
    const runeIndex = parseInt(match[2]);
    const item      = equippedItems[slotId];
    if (!item || !item.stats) return false;
    const slots = item.rune_slots;
    if (!slots || slots <= 0) return false;
    return runeIndex < slots;
  }

  /* ══ VÉRIFICATION NIVEAU ══ */
  function itemAllowedForLevel(item, level) {
    const reqLvl = item.lvl || 1;
    return level >= reqLvl;
  }
  function itemMeetsThreshold(item) {
  	if (!item.threshold) return true;
  	return Object.entries(item.threshold).every(function(e) {
    	return (caracterPoints[e[0]] || 0) >= e[1];
  		});
	}

  /* ══ TOOLTIP CARACTÉRISTIQUES ══
     Styles définis dans atelier.css (.car-tooltip, .car-tt-*) */
  function buildCarTooltip() {
    if (document.getElementById('car-tooltip')) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'car-tooltip';
    tooltip.className = 'car-tooltip';
    document.body.appendChild(tooltip);
  }

  /* ══ SKIN 3D ══ */
function getSkinPath(classId) {
  if (!classId) return '../img/skins/default.png';
  return '../img/skins/' + classId + '.png';
}

function initSkinViewer(W, colH) {
  const canvas = document.getElementById('mq-skin-canvas');
  if (!canvas) return;

  if (window.__skinViewer) {
    window.__skinViewer.dispose();
    window.__skinViewer = null;
  }

  window.__skinViewer = new skinview3d.SkinViewer({
    canvas: canvas,
    width:  W,
    height: colH,
  });

  window.__skinViewer.autoRotate  = false;
  window.__skinViewer.zoom        = 0.70;
  window.__skinViewer.globalLight = 3;
  window.__skinViewer.cameraLight = 1;

  canvas.addEventListener('wheel', function(e) {
    e.stopPropagation();
    e.preventDefault();
  }, { passive: false, capture: true });

  // La bonne API pour cette version
  const walk = new skinview3d.WalkingAnimation();
  walk.speed = 0.4;
  window.__skinViewer.animation = walk;

  window.__skinViewer.loadSkin(getSkinPath(activeClass))
    .then(function() { loadAccessoriesForClass(activeClass); })
    .catch(function(err) { console.error('Skin init failed:', err); });
}

function updateSkinClass() {
  if (!window.__skinViewer) return;
  clearAccessories();
  window.__skinViewer.loadSkin(getSkinPath(activeClass))
    .then(function() { loadAccessoriesForClass(activeClass); })
    .catch(function(err) { console.error('Skin update failed:', err); });
}
/* ══ ACCESSOIRES 3D ══ */
function clearAccessories() {
  if (!window.__skinViewer) return;
  const skin = window.__skinViewer.playerObject.skin;
  ['head', 'rightArm', 'leftArm', 'body'].forEach(function(boneName) {
    const bone = skin[boneName];
    if (!bone) return;
    // Supprime uniquement les meshes taggés comme accessoires
    const toRemove = bone.children.filter(function(c) { return c.userData.isAccessory; });
    toRemove.forEach(function(c) { bone.remove(c); });
  });
}

function loadAccessoriesForClass(classId) {
  clearAccessories();
  if (!window.__skinViewer) return;
  const skin = window.__skinViewer.playerObject.skin;
  const THREE = skinview3d.THREE;

  if (!THREE) { console.warn('THREE non trouvé'); return; }

  const ACCESSORIES = {
    guerrier: function() {
      // Épée dans la main droite
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.9, 0.06),
        new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.2 })
      );
      blade.position.set(0.1, -0.7, 0);
      blade.rotation.z = Math.PI / 12;
      blade.userData.isAccessory = true;
      skin.rightArm.add(blade);

      // Garde de l'épée
      const guard = new THREE.Mesh(
        new THREE.BoxGeometry(0.35, 0.08, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xb8860b, metalness: 0.6 })
      );
      guard.position.set(0.1, -0.35, 0);
      guard.userData.isAccessory = true;
      skin.rightArm.add(guard);
    },

    assassin: function() {
      // Dague courte main droite
      const dagger = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 0.5, 0.05),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.9, roughness: 0.1 })
      );
      dagger.position.set(0.08, -0.55, 0.05);
      dagger.rotation.z = -Math.PI / 8;
      dagger.userData.isAccessory = true;
      skin.rightArm.add(dagger);

      // Dague main gauche
      const dagger2 = dagger.clone();
      dagger2.position.set(-0.08, -0.55, 0.05);
      dagger2.rotation.z = Math.PI / 8;
      dagger2.userData.isAccessory = true;
      skin.leftArm.add(dagger2);
    },

    archer: function() {
      // Arc (main gauche)
      const bow = new THREE.Mesh(
        new THREE.TorusGeometry(0.28, 0.03, 6, 12, Math.PI),
        new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.8 })
      );
      bow.position.set(-0.05, -0.4, 0.1);
      bow.rotation.x = Math.PI / 2;
      bow.rotation.z = Math.PI / 2;
      bow.userData.isAccessory = true;
      skin.leftArm.add(bow);
    },

    mage: function() {
      // Bâton main droite
      const staff = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 1.2, 8),
        new THREE.MeshStandardMaterial({ color: 0x4a2080, roughness: 0.6 })
      );
      staff.position.set(0.1, -0.7, 0);
      staff.userData.isAccessory = true;
      skin.rightArm.add(staff);

      // Orbe en haut du bâton
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.12, 10, 10),
        new THREE.MeshStandardMaterial({ color: 0x8844ff, emissive: 0x4400aa, roughness: 0.1 })
      );
      orb.position.set(0.1, -0.05, 0);
      orb.userData.isAccessory = true;
      skin.rightArm.add(orb);
    },

    shaman: function() {
      // Totem / bâton nature
      const totem = new THREE.Mesh(
        new THREE.CylinderGeometry(0.05, 0.05, 1.1, 6),
        new THREE.MeshStandardMaterial({ color: 0x5a3010, roughness: 0.9 })
      );
      totem.position.set(0.1, -0.65, 0);
      totem.userData.isAccessory = true;
      skin.rightArm.add(totem);

      // Feuilles au sommet
      const leaves = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 7, 7),
        new THREE.MeshStandardMaterial({ color: 0x228822, emissive: 0x114411, roughness: 0.7 })
      );
      leaves.position.set(0.1, -0.02, 0);
      leaves.userData.isAccessory = true;
      skin.rightArm.add(leaves);
    },
  };

  if (classId && ACCESSORIES[classId]) {
    ACCESSORIES[classId]();
  }
}

  function positionCarTooltip(e, tooltip) {
    const offset = 16;
    const tw = tooltip.offsetWidth  || 230;
    const th = tooltip.offsetHeight || 100;
    let x = e.clientX + offset;
    let y = e.clientY + offset;
    if (x + tw > window.innerWidth  - 8) x = e.clientX - tw - offset;
    if (y + th > window.innerHeight - 8) y = e.clientY - th - offset;
    tooltip.style.left = x + 'px';
    tooltip.style.top  = y + 'px';
  }

  function showCarTooltip(e, car) {
    const tooltip = document.getElementById('car-tooltip');
    if (!tooltip) return;

    let html = '<div class="car-tt-header">' +
               '<span class="car-tt-icon">' + car.icon + '</span>' +
               '<span class="car-tt-name" style="color:' + car.color + '">' + car.label + '</span>' +
               '</div>';

    html += '<div class="car-tt-desc">' + car.desc + '</div>';

    if (car.stats && Object.keys(car.stats).length > 0) {
      html += '<div class="car-tt-stats">';
      Object.entries(car.stats).forEach(function(entry) {
        const statDef = STATS_BY_ID.get(entry[0]);
        const label = statDef ? statDef.label : entry[0];
        const unit  = statDef ? statDef.unit  : '';
        const icon  = statDef ? statDef.icon  : '◈';
        const val   = entry[1];
        html += '<div class="car-tt-stat-row">' +
                '<span class="car-tt-stat-icon">' + icon + '</span>' +
                '<span class="car-tt-stat-label">' + label + '</span>' +
                '<span class="car-tt-stat-val" style="color:' + car.color + '">+' + val + unit +
                '<span class="car-tt-per-pt">/ pt</span>' +
                '</span>' +
                '</div>';
      });
      html += '</div>';
    }

    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    positionCarTooltip(e, tooltip);
  }

  function hideCarTooltip() {
    const tooltip = document.getElementById('car-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  /* ══ SÉLECTEUR DE NIVEAU ══ */
  function buildLevelPanel() {
    const wrap = document.getElementById('level-panel');
    if (!wrap) return;
    wrap.innerHTML = '';

    /* Barre de niveau */
    const levelRow = document.createElement('div');
    levelRow.className = 'level-row';

    const btnDec = document.createElement('button');
    btnDec.className = 'level-arrow';
    btnDec.textContent = '−';
    btnDec.addEventListener('click', () => changeLevelBy(-1));

    const levelDisplay = document.createElement('div');
	levelDisplay.className = 'level-display';
	levelDisplay.id = 'level-display';

	const lvlNum = document.createElement('input');
	lvlNum.type = 'number';
	lvlNum.className = 'level-num';
	lvlNum.id = 'level-num';
	lvlNum.value = buildLevel;
	lvlNum.min = 1;
	lvlNum.max = MAX_LEVEL;
	lvlNum.addEventListener('change', function() {
		const val = Math.max(1, Math.min(MAX_LEVEL, parseInt(this.value) || 1));
		this.value = val;
		const delta = val - buildLevel;
		if (delta !== 0) changeLevelBy(delta);
	});
	
    const lvlMax = document.createElement('span');
    lvlMax.className = 'level-max';
    lvlMax.textContent = '/ ' + MAX_LEVEL;

    levelDisplay.appendChild(lvlNum);
    levelDisplay.appendChild(lvlMax);

    const btnInc = document.createElement('button');
    btnInc.className = 'level-arrow';
    btnInc.textContent = '+';
    btnInc.addEventListener('click', () => changeLevelBy(1));

    levelRow.appendChild(btnDec);
    levelRow.appendChild(levelDisplay);
    levelRow.appendChild(btnInc);
    wrap.appendChild(levelRow);

    /* Barre de progression */
    const progressWrap = document.createElement('div');
    progressWrap.className = 'level-progress-wrap';
    const progressFill = document.createElement('div');
    progressFill.className = 'level-progress-fill';
    progressFill.id = 'level-progress-fill';
    progressFill.style.width = ((buildLevel / MAX_LEVEL) * 100) + '%';
    progressWrap.appendChild(progressFill);
    wrap.appendChild(progressWrap);

    /* Points disponibles */
    const pointsRow = document.createElement('div');
    pointsRow.className = 'level-points-row';
    pointsRow.id = 'level-points-row';
    wrap.appendChild(pointsRow);

    /* Caractéristiques */
    const carBlock = document.createElement('div');
    carBlock.className = 'car-block';

    CARACTERISTIQUES.forEach(car => {
      const row = document.createElement('div');
      row.className = 'car-row';

      const icon = document.createElement('span');
      icon.className = 'car-icon';
      icon.textContent = car.icon;
      icon.style.color = car.color;

      const label = document.createElement('span');
      label.className = 'car-label';
      label.textContent = car.label;

      const controls = document.createElement('div');
      controls.className = 'car-controls';

      const btnMinus = document.createElement('button');
      btnMinus.className = 'car-btn car-btn-minus';
      btnMinus.textContent = '−';
      btnMinus.dataset.car = car.id;
      btnMinus.addEventListener('click', () => adjustCar(car.id, -1));

      const val = document.createElement('input');
		val.type = 'number';
		val.className = 'car-val';
		val.id = 'car-val-' + car.id;
		val.value = caracterPoints[car.id];
		val.min = 0;
		val.addEventListener('change', function() {
    const avail    = getAvailablePoints();
    const bonus    = getBuffBonus(car.id);
    const current  = caracterPoints[car.id] || 0;
    const requested = (parseInt(this.value) || 0) - bonus; // ← soustraire le buff
    const delta    = requested - current;
    const clamped  = delta > 0 ? current + Math.min(delta, avail) : Math.max(0, requested);
    caracterPoints[car.id] = clamped;
    this.value = clamped + bonus; // ← réafficher le total
    updateLevelUI();
    renderStats();
    saveToStorage();	
		});

      const btnPlus = document.createElement('button');
      btnPlus.className = 'car-btn car-btn-plus';
      btnPlus.textContent = '+';
      btnPlus.dataset.car = car.id;
      btnPlus.addEventListener('click', () => adjustCar(car.id, +1));

      controls.appendChild(btnMinus);
      controls.appendChild(val);
      const buffSpan = document.createElement('span');
			controls.appendChild(buffSpan);

			controls.appendChild(btnPlus);

      row.appendChild(icon);
      row.appendChild(label);
      row.appendChild(controls);
      carBlock.appendChild(row);

      /* ── Tooltip hover ── */
      row.addEventListener('mouseenter', function(e) { showCarTooltip(e, car); });
      row.addEventListener('mousemove',  function(e) {
        const tooltip = document.getElementById('car-tooltip');
        if (tooltip && tooltip.classList.contains('visible')) positionCarTooltip(e, tooltip);
      });
      row.addEventListener('mouseleave', hideCarTooltip);
    });

    wrap.appendChild(carBlock);
    updateLevelUI();
  }

  function updateLevelUI() {
    const numEl = document.getElementById('level-num');
	if (numEl) numEl.value = buildLevel;

    const fill = document.getElementById('level-progress-fill');
    if (fill) fill.style.width = ((buildLevel / MAX_LEVEL) * 100) + '%';

    const avail = getAvailablePoints();
    const pointsRow = document.getElementById('level-points-row');
    if (pointsRow) {
      if (avail > 0) {
        pointsRow.innerHTML =
          '<span class="points-avail-label">Points disponibles</span>' +
          '<span class="points-avail-val" style="color:var(--gold)">' + avail + '</span>';
      } else {
        pointsRow.innerHTML =
          '<span class="points-avail-label">Points disponibles</span>' +
          '<span class="points-avail-val" style="color:var(--muted)">0</span>';
      }
    }

    CARACTERISTIQUES.forEach(function(car) {
    const valEl = document.getElementById('car-val-' + car.id);
    if (valEl) valEl.value = caracterPoints[car.id] + getBuffBonus(car.id)
		});
  }

  function changeLevelBy(delta) {
    const newLevel = Math.max(1, Math.min(MAX_LEVEL, buildLevel + delta));
    if (newLevel === buildLevel) return;

    if (delta < 0) {
      const newMaxPoints = newLevel;
      const spent = Object.values(caracterPoints).reduce((a, b) => a + b, 0);

      const itemsAtRisk = Object.keys(equipped).filter(slotId => {
        const item = equipped[slotId];
        return item && !itemAllowedForLevel(item, newLevel);
      });

      if (itemsAtRisk.length > 0 || spent > newMaxPoints) {
        openLevelChangeModal(newLevel, itemsAtRisk, spent > newMaxPoints ? spent - newMaxPoints : 0);
        return;
      }
    }

    applyLevelChange(newLevel);
  }

  function openLevelChangeModal(newLevel, itemsAtRisk, pointsToRemove) {
    document.getElementById('modal-title').textContent = '⚠ Changement de Niveau';

	const hint = document.getElementById('modal-level-hint');
	const lines = [];

	if (itemsAtRisk.length > 0) {
	lines.push(
		'Passer au niveau\u00a0<span style="color:var(--gold);font-family:\'Cinzel\',serif;font-weight:600">' + newLevel + '</span>' +
		' supprimera\u00a0<span style="color:#d9614a;font-weight:700">' + itemsAtRisk.length + '</span>' +
		'\u00a0item' + (itemsAtRisk.length > 1 ? 's' : '') + ' dont le niveau requis est trop élevé\u00a0:'
	);
	}
	if (pointsToRemove > 0) {
	lines.push(
		'<span style="color:#e09555">⚠\u00a0Les points de caractéristique alloués dépassent le maximum autorisé au niveau\u00a0' +
		'<span style="color:var(--gold);font-family:\'Cinzel\',serif;font-weight:600">' + newLevel + '</span>' +
		'\u00a0et seront réinitialisés.</span>'
	);
	}

	hint.innerHTML = lines.join('<br><br>');

    const container = document.getElementById('modal-level-items');
    container.innerHTML = '';
    itemsAtRisk.forEach(slotId => {
      const item = equipped[slotId];
      const slotDef = SLOTS_BY_ID.get(slotId);
      const rarColor = getRarityColor(item.rarity);
      const line = document.createElement('div');
      line.className = 'class-warn-item';
      line.innerHTML =
        '<span style="width:6px;height:6px;border-radius:50%;background:' + rarColor + ';flex-shrink:0;display:inline-block"></span>' +
        '<span class="class-warn-item-name">' + item.name + '</span>' +
        '<span class="class-warn-slot">' + (slotDef ? slotDef.ico + ' ' + slotDef.label : slotId) + '</span>' +
        '<span style="font-size:8px;color:#d9614a;margin-left:4px">Niv. ' + (item.lvl || 1) + '</span>';
      container.appendChild(line);
    });

    ['export', 'import', 'reset', 'confirm-class'].forEach(m => {
      const z = document.getElementById('modal-zone-' + m);
      if (z) z.style.display = 'none';
    });
    document.getElementById('modal-zone-confirm-level').style.display = 'flex';

    document.getElementById('btn-confirm-level').onclick = () => {
      applyLevelChange(newLevel, itemsAtRisk, pointsToRemove);
      closeModal();
    };

    document.getElementById('modal').classList.add('open');
  }

  function applyLevelChange(newLevel, itemsAtRisk, pointsToRemove) {
    buildLevel = newLevel;

    if (itemsAtRisk && itemsAtRisk.length) {
      itemsAtRisk.forEach(slotId => {
        delete equipped[slotId];
        clearRunesForSlot(slotId);
        redrawSlot(slotId);
      });
    }

    const maxPoints = buildLevel;
    const spent = Object.values(caracterPoints).reduce((a, b) => a + b, 0);
    if (spent > maxPoints) {
      caracterPoints = { vitalite: 0, defense_car: 0, intelligence: 0, force: 0, esprit: 0, dexterite: 0 };
    }

    updateLevelUI();
    renderStats();
    renderItemList();
    saveToStorage();
	updateSkinClass();
  }

  function adjustCar(carId, delta) {
    const current = caracterPoints[carId] || 0;
    const avail   = getAvailablePoints();

    if (delta > 0 && avail <= 0) return;
    if (delta < 0 && current <= 0) return;

    caracterPoints[carId] = current + delta;
    updateLevelUI();
    renderStats();
	renderItemList();
    saveToStorage();
  }

  /* ══ SÉLECTEUR DE CLASSE ══ */
  function buildClassPicker() {
    const wrap = document.getElementById('class-picker');
    if (!wrap) return;
    wrap.innerHTML = '';

    const btnAll = document.createElement('button');
    btnAll.className = 'class-btn' + (activeClass === null ? ' active' : '');
    btnAll.dataset.c = '';
    btnAll.innerHTML = '<span class="class-btn-ico">👥</span><span class="class-btn-label">Toutes</span>';
    wrap.appendChild(btnAll);

    CLASSES.forEach(function(cls) {
      const btn = document.createElement('button');
      btn.className = 'class-btn' + (activeClass === cls.id ? ' active' : '');
      btn.dataset.c = cls.id;
      btn.innerHTML = '<span class="class-btn-ico">' + cls.ico + '</span><span class="class-btn-label">' + cls.label + '</span>';
      wrap.appendChild(btn);
    });

    wrap.addEventListener('click', function(e) {
      const btn = e.target.closest('.class-btn');
      if (!btn) return;
      const newClass = btn.dataset.c || null;

      const itemsAtRisk = Object.keys(equipped).filter(function(slotId) {
        const item = equipped[slotId];
        return item && !itemAllowedForClass(item, newClass);
      });

      function applyClassChange() {
				activeClass = newClass;
				wrap.querySelectorAll('.class-btn').forEach(function(b) { b.classList.remove('active'); });
				btn.classList.add('active');
				itemsAtRisk.forEach(function(slotId) {
						const removedItem = equipped[slotId]; // ← capturer avant delete
						delete equipped[slotId];
						clearRunesForSlot(slotId);
						redrawSlot(slotId);

						// ← Débloquer l'offhand si c'était une 2 mains
						const offSlotId = findOffhandSlotId(removedItem);
						if (offSlotId) redrawSlot(offSlotId);
				});
				renderStats();
				renderItemList();
				saveToStorage();
				updateSkinClass();
			}

      if (!itemsAtRisk.length) { applyClassChange(); return; }

      const newLabel = newClass
        ? (CLASSES_BY_ID.get(newClass) || { label: '?' }).label
        : 'Toutes classes';

      document.getElementById('modal-title').textContent = '⚠ Changement de classe';

      const hint = document.getElementById('modal-class-hint');
      hint.innerHTML =
        'Passer en <span style="color:var(--gold);font-family:\'Cinzel\',serif;font-weight:600">' + newLabel + '</span>' +
        ' supprimera <span style="color:#d9614a;font-weight:700">' + itemsAtRisk.length + '</span>' +
        ' item' + (itemsAtRisk.length > 1 ? 's' : '') + ' incompatible' + (itemsAtRisk.length > 1 ? 's' : '') + ' :';

      const container = document.getElementById('modal-class-items');
      container.innerHTML = '';
      itemsAtRisk.forEach(function(slotId) {
        const item = equipped[slotId];
        const slotDef = SLOTS_BY_ID.get(slotId);
        const slotLabel = slotDef ? slotDef.label : slotId;
        const rarColor = getRarityColor(item.rarity);
        const line = document.createElement('div');
        line.className = 'class-warn-item';
        line.innerHTML =
          '<span style="width:6px;height:6px;border-radius:50%;background:' + rarColor + ';flex-shrink:0;display:inline-block"></span>' +
          '<span class="class-warn-item-name">' + item.name + '</span>' +
          '<span class="class-warn-slot">' + slotDef.ico + ' ' + slotLabel + '</span>';
        container.appendChild(line);
      });

      ['export', 'import', 'reset', 'confirm-level'].forEach(function(m) {
        const zone = document.getElementById('modal-zone-' + m);
        if (zone) zone.style.display = 'none';
      });
      document.getElementById('modal-zone-confirm-class').style.display = 'flex';

      document.getElementById('btn-confirm-class').onclick = function() {
        applyClassChange();
        closeModal();
      };

      document.getElementById('modal').classList.add('open');
    });
  }

  function itemAllowedForClass(item, classId) {
    if (!classId) return true;
    const list = item.classes || item.class || [];
    if (!list || list.length === 0) return true;
    return list.includes(classId);
  }

  /* ══ GRILLE ══ */
  function buildGrid() {
    const colL = document.getElementById('col-left');
    const colR = document.getElementById('col-right');
    const bot  = document.getElementById('row-bot');
    colL.innerHTML = colR.innerHTML = bot.innerHTML = '';
    SLOTS_LEFT.forEach(s  => colL.appendChild(makeSlot(s)));
    SLOTS_RIGHT.forEach(s => colR.appendChild(makeSlot(s)));
    SLOTS_BOT.forEach(s   => bot.appendChild(makeSlot(s)));
  }

  function makeSlot(slotDef) {
    const el = document.createElement('div');
    el.className = 'slot';
    el.dataset.slotId = slotDef.id;
    drawSlot(el, slotDef);
    el.addEventListener('click', () => selectSlot(slotDef.id));
    return el;
  }

  function drawSlot(el, slotDef) {
    const item = equipped[slotDef.id];
    el.innerHTML = '';
    el.classList.remove('filled', 'active', 'slot-blocked');
    if (getBlockedSlots().has(slotDef.id)) {
			el.classList.add('slot-blocked');
			el.innerHTML =
				'<div class="slot-icon">' + slotDef.ico + '</div>' +
				'<div class="slot-label" style="color:#d9614a;font-size:9px">Arme 2 mains</div>';
			return;
		}
    if (slotDef.id === activeSlot) el.classList.add('active');

    const btnDel = document.createElement('button');
    btnDel.className = 'slot-del';
    btnDel.textContent = '✕';
    btnDel.addEventListener('click', e => { e.stopPropagation(); clearSlot(slotDef.id); });
    el.appendChild(btnDel);

    if (item) {
      el.classList.add('filled');
      const col = getRarityColor(item.rarity);
      const dot = document.createElement('span');
      dot.className = 'slot-dot';
      dot.style.background = col;
      el.appendChild(dot);
      const _slotImgSrc = getItemImg(item);
      if (_slotImgSrc) {
        const img = document.createElement('img');
        img.src = _slotImgSrc; img.alt = item.name; img.className = 'slot-img';
        el.appendChild(img);
      } else {
        appendDiv(el, 'slot-icon', slotDef.ico);
      }
      appendDiv(el, 'slot-name', item.name);

      const runeCount = item.rune_slots;
      if (runeCount && runeCount > 0) {
        const orbsRow = document.createElement('div');
        orbsRow.className = 'rune-orbs-row';
        for (let i = 0; i < runeCount; i++) {
          const runeKey = slotDef.id + '_rune_' + i;
          const runeId  = equippedRunes[runeKey];
          const rune    = runeId ? RUNES_BY_ID.get(runeId) : null;
          const orb = document.createElement('div');
          orb.className = 'rune-orb' + (rune ? ' rune-orb-filled' : ' rune-orb-empty');
          if (rune) {
            orb.style.background   = rune.color + '30';
            orb.style.borderColor  = rune.color;
            orb.style.boxShadow    = '0 0 0 2px ' + rune.color + '55';
            orb.title = rune.name;
          }
          orb.addEventListener('click', function(e) {
            e.stopPropagation();
            openRunePicker(runeKey, orb, slotDef.id);
          });
          orbsRow.appendChild(orb);
        }
        el.appendChild(orbsRow);
      }

    } else {
      appendDiv(el, 'slot-icon', slotDef.ico);
      appendDiv(el, 'slot-label', slotDef.label);
    }
  }

  function appendDiv(parent, cls, text) {
    const d = document.createElement('div');
    d.className = cls;
    d.textContent = text;
    parent.appendChild(d);
  }

  function redrawSlot(slotId) {
    const def = SLOTS_BY_ID.get(slotId);
    const el  = document.querySelector('.slot[data-slot-id="' + slotId + '"]');
    if (def && el) drawSlot(el, def);
  }

  /* ══ RUNE PICKER ══ */
  function openRunePicker(runeKey, anchorEl, slotId) {
    const existing = document.getElementById('rune-picker-popup');
    if (existing) {
      const wasKey = existing.dataset.runeKey;
      existing.remove();
      if (wasKey === runeKey) return;
    }

    const popup = document.createElement('div');
    popup.id = 'rune-picker-popup';
    popup.className = 'rune-picker-popup';
    popup.dataset.runeKey = runeKey;

    const currentRuneId = equippedRunes[runeKey];

    const title = document.createElement('div');
    title.className = 'rune-picker-title';
    const orbIdx = parseInt(runeKey.split('_rune_')[1]) + 1;
    title.textContent = 'Emplacement de Rune ' + orbIdx;
    popup.appendChild(title);

    RUNES.forEach(function(rune) {
      const item = document.createElement('div');
      item.className = 'rune-picker-item' + (currentRuneId === rune.id ? ' active' : '');

      const pip = document.createElement('span');
      pip.className = 'rune-pip';
      pip.style.background = rune.color;

      const name = document.createElement('span');
      name.className = 'rune-picker-name';
      name.textContent = rune.name;

      const stats = document.createElement('div');
			stats.className = 'rune-picker-stats';

			const statsLines = Object.entries(rune.stats).map(function(e) {
					const statDef = STATS_BY_ID.get(e[0]);
					const icon  = statDef ? statDef.icon  : '◈';
					const label = statDef ? statDef.label : e[0];
					const unit  = statDef ? statDef.unit  : '';
					return '<div style="display:flex;align-items:center;gap:8px;padding:2px 0">' +
							'<span style="font-size:11px;width:15px;text-align:center;flex-shrink:0">' + icon + '</span>' +
							'<span style="flex:1;color:rgba(255,255,255,.55);font-size:10.5px">' + label + '</span>' +
							'<span style="font-weight:700;color:rgba(255,255,255,.9)">+' + e[1] + unit + '</span>' +
							'</div>';
			}).join('');

					const buffLines = rune.buff ? Object.entries(rune.buff).map(function(e) {
					const carDef = CAR_BY_ID.get(e[0]);
					const icon  = carDef ? carDef.icon  : '◈';
					const label = carDef ? carDef.label : e[0];
					const color = carDef ? carDef.color : '#aaa';
					return '<div style="display:flex;align-items:center;gap:8px;padding:2px 0">' +
							'<span style="font-size:11px;width:15px;text-align:center;flex-shrink:0">' + icon + '</span>' +
							'<span style="flex:1;font-size:10.5px;color:' + color + '">' + label + '</span>' +
							'<span style="font-weight:700;color:' + color + '">+' + e[1] + ' pt</span>' +
							'</div>';
			}).join('') : '';

stats.innerHTML = statsLines +
    (buffLines ? '<div style="border-top:1px solid rgba(255,255,255,.06);margin-top:4px;padding-top:4px">' + buffLines + '</div>' : '');

      item.appendChild(pip);
      item.appendChild(name);
      item.appendChild(stats);

      item.addEventListener('click', function(e) {
			e.stopPropagation();
			if (equippedRunes[runeKey] === rune.id) {
				delete equippedRunes[runeKey];   // déjà sélectionnée → on l'enlève
			} else {
				equippedRunes[runeKey] = rune.id;
			}
			popup.remove();
			redrawSlot(slotId);
			renderStats();
			saveToStorage();
			});

      popup.appendChild(item);
    });

    if (currentRuneId) {
      const sep = document.createElement('div');
      sep.className = 'rune-picker-sep';
      popup.appendChild(sep);

      const rem = document.createElement('div');
      rem.className = 'rune-picker-remove';
      rem.textContent = '✕ Retirer la rune';
      rem.addEventListener('click', function(e) {
        e.stopPropagation();
        delete equippedRunes[runeKey];
        popup.remove();
        redrawSlot(slotId);
        renderStats();
        saveToStorage();
      });
      popup.appendChild(rem);
    }

    document.body.appendChild(popup);
    const rect = anchorEl.getBoundingClientRect();
    const popW = popup.offsetWidth || 260;
    const popH = popup.offsetHeight || 300;
    let left = rect.left + window.scrollX;
    let top  = rect.bottom + window.scrollY + 5;
    if (left + popW > window.innerWidth - 8) left = window.innerWidth - popW - 8;
    if (top + popH > window.innerHeight + window.scrollY - 8) top = rect.top + window.scrollY - popH - 5;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';

    setTimeout(function() {
      function onOutside(e) {
        if (!popup.contains(e.target) && e.target !== anchorEl) {
          popup.remove();
          document.removeEventListener('click', onOutside);
        }
      }
      document.addEventListener('click', onOutside);
    }, 0);
  }

  function clearRunesForSlot(slotId) {
    Object.keys(equippedRunes).forEach(function(key) {
      if (key.startsWith(slotId + '_rune_')) delete equippedRunes[key];
    });
  }

  /* ══ STATS ══ */
  function buildStatsUI() {
    const list = document.getElementById('stats-list');
    list.innerHTML = '';

    STAT_GROUPS.forEach(group => {
      const glabel = document.createElement('div');
      glabel.className = 'stat-group-label';
      glabel.textContent = group.label;
      list.appendChild(glabel);

      group.stats.forEach(stat => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.dataset.statId = stat.id;
        row.innerHTML =
          '<span class="stat-value" id="sv-' + stat.id + '">—</span>' +
          '<div class="stat-bar-wrap"><div class="stat-bar-fill" id="sb-' + stat.id + '" style="width:0%"></div></div>' +
          '<span class="stat-icon">' + stat.icon + '</span>' +
          '<span class="stat-name">' + stat.label + '</span>';
        list.appendChild(row);
		row.style.cursor = 'pointer';
		row.addEventListener('click', function() {
		if (filterStats.has(stat.id)) {
			filterStats.delete(stat.id);
			row.classList.remove('stat-filtered');
		} else {
			filterStats.add(stat.id);
			row.classList.add('stat-filtered');
		}
		renderItemList();
		});
      });
    });
  }

  function computeSetCounts() {
    const counts = {};
    const blockedSlots = getBlockedSlots();
    Object.entries(equipped).forEach(function(entry) {
        const slotId = entry[0];
        const item   = entry[1];
        if (blockedSlots.has(slotId)) return;
        if (!item || !item.set) return;
        counts[item.set] = (counts[item.set] || 0) + 1;
    });
    return counts;
	}

  function computeSetBonuses(setCounts) {
    const bonusMins = {};
    const bonusMaxs = {};
    ALL_STATS.forEach(function(s) { bonusMins[s.id] = 0; bonusMaxs[s.id] = 0; });

    Object.entries(setCounts).forEach(function(entry) {
      const setId = entry[0]; const count = entry[1];
      const setDef = SETS[setId];
      if (!setDef) return;
      Object.entries(setDef.bonuses).forEach(function(b) {
        const threshold = parseInt(b[0]); const stats = b[1];
        if (count < threshold) return;
        Object.entries(stats).forEach(function(sv) {
          const sid = sv[0]; const val = sv[1];
          if (!(sid in bonusMins)) return;
          bonusMins[sid] += getMin(val);
          bonusMaxs[sid] += getMax(val);
        });
      });
    });
    return { bonusMins, bonusMaxs };
  }

  function computeStats() {
    const mins = {};
    const maxs = {};
    ALL_STATS.forEach(s => { mins[s.id] = 0; maxs[s.id] = 0; });

    /* ── Items équipés ── */
    const blockedSlots = getBlockedSlots();
		Object.entries(equipped).forEach(function(entry) {
				const slotId = entry[0];
				const item   = entry[1];
				if (blockedSlots.has(slotId)) return;
				if (!item || !item.stats) return;
				Object.entries(item.stats).forEach(function(e) {
						const key = e[0]; const val = e[1];
						if (!(key in mins)) return;
						mins[key] += getMin(val);
						maxs[key] += getMax(val);
				});
		});

    /* ── Bonus de panoplies ── */
    const setCounts = computeSetCounts();
    const sb = computeSetBonuses(setCounts);
    ALL_STATS.forEach(function(s) {
      mins[s.id] += sb.bonusMins[s.id];
      maxs[s.id] += sb.bonusMaxs[s.id];
    });

    /* ── Bonus des runes ── */
    Object.entries(equippedRunes).forEach(function(entry) {
      const runeId = entry[1];
      const rune = RUNES_BY_ID.get(runeId);
      if (!rune) return;
      Object.entries(rune.stats).forEach(function(sv) {
        const sid = sv[0]; const val = sv[1];
        if (!(sid in mins)) return;
        mins[sid] += val;
        maxs[sid] += val;
      });
    });

    /* ── Bonus des caractéristiques ── */
		CARACTERISTIQUES.forEach(function(car) {
				if (!car.stats) return;
				
				// Points alloués manuellement
				let pts = caracterPoints[car.id] || 0;
				
				// ← Ajouter les buffs de tous les items équipés (non bloqués)
				Object.entries(equipped).forEach(function(entry) {
						const slotId = entry[0];
						const item   = entry[1];
						if (blockedSlots.has(slotId)) return;
						if (!item || !item.buff) return;
						pts += item.buff[car.id] || 0;
				});

        Object.entries(equippedRunes).forEach(function(entry) {
            const runeKey = entry[0];
            const runeId  = entry[1];
            const slotId  = runeKey.split('_rune_')[0];
            if (blockedSlots.has(slotId)) return;
            const rune = RUNES_BY_ID.get(runeId);
            if (rune && rune.buff) pts += rune.buff[car.id] || 0;
        });
				
				if (pts <= 0) return;
				Object.entries(car.stats).forEach(function(entry) {
						const sid      = entry[0];
						const perPoint = entry[1];
						if (!(sid in mins)) return;
						mins[sid] += pts * perPoint;
						maxs[sid] += pts * perPoint;
				});
		});

    return { mins, maxs, setCounts };
  }

  /* ══ CAROUSEL PANOPLIES ══ */
  let setCarouselIndex = 0;
  let setCollapsed     = false;

  function renderSetBonuses(setCounts) {
    const box = document.getElementById('set-bonuses');
    if (!box) return;
    box.innerHTML = '';

    const activeSets = Object.entries(setCounts).filter(function(e) { return e[1] >= 2; });
    if (!activeSets.length) { box.style.display = 'none'; return; }
    box.style.display = 'block';

    if (setCarouselIndex >= activeSets.length) setCarouselIndex = 0;

    const entry  = activeSets[setCarouselIndex];
    const setId  = entry[0]; const count = entry[1];
    const setDef = SETS[setId];
    if (!setDef) return;

    const total = activeSets.length;

    const nav = document.createElement('div');
    nav.className = 'set-carousel-nav';

    const btnPrev = document.createElement('button');
    btnPrev.className = 'set-carousel-arrow';
    btnPrev.innerHTML = '‹';
    btnPrev.disabled = (total <= 1);
    btnPrev.addEventListener('click', function() {
      setCarouselIndex = (setCarouselIndex - 1 + total) % total;
      renderSetBonuses(setCounts);
    });

    const dots = document.createElement('div');
    dots.className = 'set-carousel-dots';
    for (var di = 0; di < total; di++) {
      const dot = document.createElement('span');
      dot.className = 'set-carousel-dot' + (di === setCarouselIndex ? ' active' : '');
      dots.appendChild(dot);
    }

    const btnNext = document.createElement('button');
    btnNext.className = 'set-carousel-arrow';
    btnNext.innerHTML = '›';
    btnNext.disabled = (total <= 1);
    btnNext.addEventListener('click', function() {
      setCarouselIndex = (setCarouselIndex + 1) % total;
      renderSetBonuses(setCounts);
    });

    const btnCollapse = document.createElement('button');
    btnCollapse.className = 'set-carousel-collapse';
    btnCollapse.innerHTML = setCollapsed ? '▼' : '▲';
    btnCollapse.title = setCollapsed ? 'Afficher les panoplies' : 'Masquer les panoplies';
    btnCollapse.addEventListener('click', function() {
      setCollapsed = !setCollapsed;
      renderSetBonuses(setCounts);
    });

    nav.appendChild(btnPrev);
    nav.appendChild(dots);
    nav.appendChild(btnNext);
    nav.appendChild(btnCollapse);
    box.appendChild(nav);

    if (setCollapsed) return;
    const wrap = document.createElement('div');
    wrap.className = 'set-bonus-block';

    const head = document.createElement('div');
    head.className = 'set-bonus-head';
    head.innerHTML =
      '<span class="set-bonus-name" style="color:' + setDef.color + '">' + setDef.label + '</span>' +
      '<span class="set-bonus-count" style="border-color:' + setDef.color + '60;color:' + setDef.color + '">' + count + ' pcs</span>';
    wrap.appendChild(head);

    Object.entries(setDef.bonuses).forEach(function(b) {
      const threshold = parseInt(b[0]); const stats = b[1];
      const isActive = count >= threshold;
      const tier = document.createElement('div');
      tier.className = 'set-bonus-tier' + (isActive ? ' active' : '');

      const tierHead = document.createElement('div');
      tierHead.className = 'set-bonus-tier-head';
      tierHead.innerHTML = '<span class="set-tier-n">' + threshold + ' pcs</span>' +
        (isActive ? '<span class="set-tier-check">✓</span>' : '<span class="set-tier-lock">○</span>');
      tier.appendChild(tierHead);

      Object.entries(stats).forEach(function(sv) {
        const statDef = STATS_BY_ID.get(sv[0]);
        const label = statDef ? statDef.label : sv[0];
        const unit  = statDef ? statDef.unit  : '';
        const icon  = statDef ? statDef.icon  : '';
        const val   = sv[1];
        const valStr = Array.isArray(val)
          ? (val[0] === val[1] ? '+' + val[0] + unit : '+' + val[0] + '–' + val[1] + unit)
          : '+' + val + unit;
        const line = document.createElement('div');
        line.className = 'set-bonus-stat';
        line.innerHTML =
          '<span class="set-stat-icon">' + icon + '</span>' +
          '<span class="set-stat-label">' + label + '</span>' +
          '<span class="set-stat-val">' + valStr + '</span>';
        tier.appendChild(line);
      });

      wrap.appendChild(tier);
    });

    box.appendChild(wrap);
  }

  function roundUp2(n) {
    return Math.floor(n * 100) / 100;
  }

  function renderStats() {
		updateLevelUI();
    const result = computeStats();
    const mins = result.mins; const maxs = result.maxs;
    renderSetBonuses(result.setCounts);
    ALL_STATS.forEach(function(stat) {
      const valEl = document.getElementById('sv-' + stat.id);
      const barEl = document.getElementById('sb-' + stat.id);
      if (!valEl || !barEl) return;

      const lo = roundUp2(mins[stat.id] || 0);
      const hi = roundUp2(maxs[stat.id] || 0);

      if (hi === 0 && lo === 0) {
		valEl.innerHTML = '—';
		valEl.className = 'stat-value';
	  } else if (lo === hi) {
		valEl.innerHTML = '<span style="' + (lo < 0 ? 'color:#d9614a' : '') + '">' + lo + stat.unit + '</span>';
		valEl.className = 'stat-value nonzero';
	  } else {
		valEl.innerHTML =
			'<span class="sv-hi"' + (hi < 0 ? ' style="color:#d9614a"' : '') + '>' + hi + stat.unit + '</span>' +
			'<span class="sv-lo"' + (lo < 0 ? ' style="color:#d9614a"' : '') + '>' + lo + stat.unit + '</span>';
		valEl.className = 'stat-value nonzero has-range';
	  }

      const pct = Math.min(100, Math.round((hi / stat.max) * 100));
      barEl.style.width = pct + '%';
      if      (pct >= 75) barEl.style.background = '#d7af5f';
      else if (pct >= 40) barEl.style.background = '#9a7040';
      else                barEl.style.background = 'rgba(255,255,255,.12)';
    });
  }

  /* ══ SÉLECTION DE SLOT ══ */
	function findOffhandSlotId(item) {
    if (!item || !item.twoHanded) return null;
    const offCat = TWO_HANDED_PAIRS[item.cat];
    if (!offCat) return null;
    const offSlot = SLOTS_BY_ID.get(offCat || (s.cats && s.cats.includes(offCat)));
    return offSlot ? offSlot.id : null;
	}

	function getBlockedSlots() {
    const blocked = new Set();
    Object.values(equipped).forEach(function(item) {
        const offSlotId = findOffhandSlotId(item);
        if (offSlotId) blocked.add(offSlotId);
    });
    return blocked;
	}

  function selectSlot(slotId) {
		if (getBlockedSlots().has(slotId)) return;
    activeSlot = (activeSlot === slotId) ? null : slotId;
    document.querySelectorAll('.slot').forEach(function(el) {
      el.classList.toggle('active', el.dataset.slotId === activeSlot);
    });
    renderPickerInfo();
    renderItemList();
  }

  function findBestSlotForItem(item) {
    const blocked = getBlockedSlots();
    const compatible = ALL_SLOTS.filter(function(s) {
      return s.cats.includes(item.cat) && !blocked.has(s.id);
    });
    if (!compatible.length) return null;
    // 1) slot ayant déjà cet item (pour le déséquiper)
    const same = compatible.find(function(s) { return equipped[s.id] && equipped[s.id].id === item.id; });
    if (same) return same.id;
    // 2) slot vide
    const empty = compatible.find(function(s) { return !equipped[s.id]; });
    if (empty) return empty.id;
    // 3) premier slot compatible
    return compatible[0].id;
  }

  function renderPickerInfo() {
    const box = document.getElementById('picker-info');
    if (!activeSlot) {
      box.innerHTML = '<div class="psi-hint">Tous les items · cliquez sur un emplacement pour filtrer</div>';
      return;
    }
    const s = SLOTS_BY_ID.get(activeSlot);
    box.innerHTML =
      '<div class="psi-label">Emplacement sélectionné</div>' +
      '<div class="psi-name">' + s.ico + ' ' + s.label + '</div>';
  }

	function clearSlot(slotId) {
    const removedItem = equipped[slotId];
    delete equipped[slotId];
    clearRunesForSlot(slotId);
    saveToStorage();
    redrawSlot(slotId);

    const offSlotId = findOffhandSlotId(removedItem);
    if (offSlotId) {
        redrawSlot(offSlotId);
        if (activeSlot === offSlotId) renderItemList();
    }

    renderStats();
    if (activeSlot === slotId) renderItemList();
	}

  /* ══ PICKER — FILTRES ══ */
  function buildFilters() {
    const wrap = document.getElementById('filters-wrap');
    wrap.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'rarity-chip active';
    all.textContent = 'Tout';
    all.dataset.r = '';
    wrap.appendChild(all);
    Object.entries(RARITIES).forEach(function(entry) {
      const k = entry[0]; const v = entry[1];
      const btn = document.createElement('button');
      btn.className = 'rarity-chip';
      btn.dataset.r = k;
      btn.textContent = v.label;
      btn.style.borderColor = v.color + '60';
      wrap.appendChild(btn);
    });
    wrap.addEventListener('click', function(e) {
      const chip = e.target.closest('.rarity-chip');
      if (!chip) return;
      filterRar = chip.dataset.r || null;
      wrap.querySelectorAll('.rarity-chip').forEach(function(c) { c.classList.remove('active'); });
      chip.classList.add('active');
      renderItemList();
    });
  }

  function buildTierFilter() {
	const wrap = document.getElementById('tier-wrap');
	if (!wrap) return;
	wrap.innerHTML = '';

	const tiers = [...new Set(ITEMS.map(i => i.palier))].sort((a, b) => a - b);

	const all = document.createElement('button');
	all.className = 'rarity-chip active';
	all.textContent = 'Tout';
	all.dataset.t = '';
	wrap.appendChild(all);

	tiers.forEach(function(t) {
	const btn = document.createElement('button');
	btn.className = 'rarity-chip';
	btn.dataset.t = t;
	btn.textContent = t === 0 ? 'Évènements' : 'Palier ' + t;
	wrap.appendChild(btn);
	});

	wrap.addEventListener('click', function(e) {
	const chip = e.target.closest('.rarity-chip');
	if (!chip || !('t' in chip.dataset)) return;
	filterTier = chip.dataset.t !== '' ? parseInt(chip.dataset.t) : null;
	wrap.querySelectorAll('.rarity-chip').forEach(c => c.classList.remove('active'));
	chip.classList.add('active');
	renderItemList();
	});
	}

  function formatStatValue(val, unit) {
    if (Array.isArray(val)) {
      if (val[0] === val[1]) return val[0] + unit;
      return '<span class="istat-range">' +
             '<span class="istat-lo">' + val[0] + unit + '</span>' +
             '<span class="istat-sep"> – </span>' +
             '<span class="istat-hi">' + val[1] + unit + '</span>' +
             '</span>';
    }
    return val + unit;
  }

	function buildItemStatsHTML(item) {
			const entries = Object.entries(item.stats || {}).filter(function(e) {
					const v = Array.isArray(e[1]) ? e[1][1] : e[1];
					return v !== 0;
			});

			const runeSlotLine = item.rune_slots > 0
					? '<div class="istat-row">' +
						'<span class="istat-icon">💎</span>' +
						'<span class="istat-label">Emplacement de Runes</span>' +
						'<span class="istat-val">' + item.rune_slots + '</span>' +
						'</div>'
					: '';

			const lines = entries.map(function(e) {
					const key = e[0]; const val = e[1];
					const statDef = STATS_BY_ID.get(key);
					const label = statDef ? statDef.label : key;
					const unit  = statDef ? statDef.unit  : '';
					const icon  = statDef ? statDef.icon  : '';
					const isNeg = Array.isArray(val) ? val[1] < 0 : val < 0;
					return '<div class="istat-row">' +
							'<span class="istat-icon">' + icon + '</span>' +
							'<span class="istat-label">' + label + '</span>' +
							'<span class="istat-val"' + (isNeg ? ' style="color:#d9614a"' : '') + '>' + formatStatValue(val, unit) + '</span>' +
							'</div>';
			}).join('');

			// ── Buffs de caractéristiques ──
			const buffEntries = Object.entries(item.buff || {});
			const buffLines = buffEntries.map(function(e) {
					const carDef = CAR_BY_ID.get(e[0]);
					const label = carDef ? carDef.label : e[0];
					const icon  = carDef ? carDef.icon  : '◈';
					const color = carDef ? carDef.color : '#aaa';
					return '<div class="istat-row">' +
							'<span class="istat-icon">' + icon + '</span>' +
							'<span class="istat-label" style="color:' + color + '">' + label + '</span>' +
							'<span class="istat-val" style="color:' + color + '">+' + e[1] + ' pt</span>' +
							'</div>';
			}).join('');

			if (!lines && !buffLines && !runeSlotLine) return '';

			return (lines || runeSlotLine ? '<div class="istat-block">' + lines + runeSlotLine + '</div>' : '') +
						(buffLines ? '<div class="istat-block" style="border-top:1px solid rgba(255,255,255,.06);margin-top:4px;padding-top:4px">' + buffLines + '</div>' : '');
	}

  function buildBadgesHTML(item) {
    let badges = '';

    // Badges de classe
    if (item.classes && item.classes.length > 0) {
      item.classes.forEach(function(cid) {
        const cls = CLASSES_BY_ID.get(cid);
        if (!cls) return;
        badges += '<span class="item-class-badge" style="border-color:' + cls.color + '60;color:' + cls.color + '">' + cls.ico + ' ' + cls.label + '</span>';
      });
    }

    // Badge de set
    if (item.set) {
      const setDef = SETS[item.set];
      const color = setDef ? setDef.color : '#888';
      const label = setDef ? setDef.label : item.set;
      badges += '<span class="item-set-badge" style="border-color:' + color + '60;color:' + color + '">◈ ' + label + '</span>';
    }

    if (!badges) return '';
    return '<div class="item-badges-row">' + badges + '</div>';
  }

  function buildItemLevelBadgeHTML(item) {
    const lvl = item.lvl || 1;
    const allowed = itemAllowedForLevel(item, buildLevel);
    const color = allowed ? 'var(--muted)' : '#d9614a';
    return '<span class="item-lvl-badge" style="color:' + color + ';border-color:' + color + '50">' +
           (allowed ? '' : '⚠ ') + 'Niv. ' + lvl + '</span>';
  }

	function getBuffBonus(carId) {
			const blockedSlots = getBlockedSlots();
			let bonus = 0;

			// Buffs des items équipés
			Object.entries(equipped).forEach(function(entry) {
					if (blockedSlots.has(entry[0])) return;
					const item = entry[1];
					if (item && item.buff) bonus += item.buff[carId] || 0;
			});

			// Buffs des runes équipées
			Object.entries(equippedRunes).forEach(function(entry) {
					const runeKey = entry[0];
					const runeId  = entry[1];
					const slotId = runeKey.split('_rune_')[0];
					if (blockedSlots.has(slotId)) return;
					const rune = RUNES_BY_ID.get(runeId);
					if (rune && rune.buff) bonus += rune.buff[carId] || 0;
			});

			return bonus;
	}

  function renderItemList() {
    const list = document.getElementById('items-list');
    // normalize → /utils.js (source unique)
    const q    = normalize(filterQ);
    const statsFilter = function(item) {
      return filterStats.size === 0 || [...filterStats].every(function(sid) {
        if (!item.stats) return false;
        const val = item.stats[sid];
        if (val === undefined) return false;
        const v = Array.isArray(val) ? val[1] : val;
        return v !== 0;
      });
    };

    const _equipCats = new Set(ALL_SLOTS.flatMap(function(s) { return s.cats; }));

    let visible;
    if (!activeSlot) {
      // Mode "tous les items" — uniquement armes / armures / accessoires
      visible = ITEMS.filter(function(item) {
        return _equipCats.has(item.cat) &&
          itemAllowedForClass(item, activeClass) &&
          (!filterRar  || item.rarity === filterRar) &&
          (filterTier === null || item.palier === filterTier) &&
          (!q || normalize(item.name).includes(q)) &&
          statsFilter(item);
      });
    } else {
      const slot = SLOTS_BY_ID.get(activeSlot);
      visible = ITEMS.filter(function(item) {
        if (item.unique) {
          const alreadyEquippedElsewhere = Object.entries(equipped).some(function(e) {
            return e[1] && e[1].id === item.id && e[0] !== activeSlot;
          });
          if (alreadyEquippedElsewhere) return false;
        }
        return slot.cats.includes(item.cat) &&
          itemAllowedForClass(item, activeClass) &&
          (!filterRar  || item.rarity === filterRar) &&
          (filterTier === null || item.palier === filterTier) &&
          (!q || normalize(item.name).includes(q)) &&
          statsFilter(item);
      });
    }

    if (!visible.length) {
      list.innerHTML = '<div class="picker-empty-msg">Aucun item compatible</div>';
      return;
    }

    visible.sort(function(a, b) {
      if (a.palier !== b.palier) return (a.palier || 0) - (b.palier || 0);
      const ao = a.ordre ?? null;
      const bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return 0;
    });

    list.innerHTML = '';
    visible.forEach(function(item) {
      const row = document.createElement('div');
      const levelOk = itemAllowedForLevel(item, buildLevel);
	  const thresholdOk = itemMeetsThreshold(item);
	  const isLocked    = !levelOk || !thresholdOk;
	  row.className = 'item-row' + (isLocked ? ' item-locked' : '');
      // Actif si équipé dans le slot actif (ou dans n'importe quel slot si vue globale)
      const isActive = activeSlot
        ? (equipped[activeSlot] && equipped[activeSlot].id === item.id)
        : Object.values(equipped).some(function(e) { return e && e.id === item.id; });
      if (isActive) row.classList.add('active');
      const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
      const rarLabel = (RARITIES[item.rarity] || { label: item.rarity }).label;
      row.innerHTML =
        '<div class="item-thumb">' +
          (getItemImg(item) ? '<img src="' + getItemImg(item) + '" alt="' + item.name + '">' : '<span>📦</span>') +
          '<div class="item-thumb-bar" style="background:' + rarColor + '"></div>' +
        '</div>' +
        '<div class="item-meta">' +
          '<div class="item-meta-top">' +
            '<div class="item-meta-name">' + item.name + '</div>' +
            buildItemLevelBadgeHTML(item) +
          '</div>' +
        '<div class="item-meta-rarity" style="color:' + rarColor + '">' + rarLabel + ' · Palier ' + item.palier + '</div>' +
        buildBadgesHTML(item) +
        buildItemStatsHTML(item) +
		    buildThresholdHTML(item) +
        '</div>';

    	if (!isLocked) {
			row.addEventListener('click', function() {
				// En vue globale, trouver le meilleur slot pour cet item
				const targetSlot = activeSlot || findBestSlotForItem(item);
				if (!targetSlot) return;

				if (equipped[targetSlot] && equipped[targetSlot].id === item.id) {
    				clearSlot(targetSlot);
				} else {
					clearRunesForSlot(targetSlot);

					const previousItem = equipped[targetSlot];
					const prevOffSlotId = findOffhandSlotId(previousItem);

					equipped[targetSlot] = item;

					// Offhand du nouvel item (2 mains → bloquer)
					const offSlotId = findOffhandSlotId(item);
					if (offSlotId) {
						delete equipped[offSlotId];
						clearRunesForSlot(offSlotId);
						redrawSlot(offSlotId);
					}

					// Offhand de l'ancien item (2 mains → débloquer si le nouveau est 1 main)
					if (prevOffSlotId && prevOffSlotId !== offSlotId) {
						redrawSlot(prevOffSlotId);
					}

					saveToStorage();
					redrawSlot(targetSlot);
					renderStats();
					renderItemList();
				}
			});
      } else {
        row.title = 'Niveau ' + (item.lvl || 1) + ' requis';
      }
      list.appendChild(row);
    });
  }

  function buildThresholdHTML(item) {
  if (!item.threshold || !Object.keys(item.threshold).length) return '';
  const rows = Object.entries(item.threshold).map(function(e) {
    const carDef = CAR_BY_ID.get(e[0]);
    const label  = carDef ? carDef.label : e[0];
    const icon   = carDef ? carDef.icon  : '◈';
    const color  = carDef ? carDef.color : '#888';
    const current = caracterPoints[e[0]] || 0;
    const required = e[1];
    const ok = current >= required;
    return '<div class="thresh-row">' +
      '<span class="thresh-icon">' + icon + '</span>' +
      '<span class="thresh-label" style="color:' + color + '">' + label + '</span>' +
      '<span class="thresh-val" style="color:' + (ok ? '#6dba6d' : '#d9614a') + '">' +
        (ok ? '✓' : '✕') + ' ' + current + ' / ' + required +
      '</span>' +
    '</div>';
  }).join('');
  return '<div class="thresh-block">' +
    '<div class="thresh-title">Prérequis</div>' +
    rows +
  '</div>';
}

  /* ══ PERSISTANCE localStorage ══ */
  const SIG = "🌙𝓥𝓮𝓲𝓵𝓵𝓮𝓾𝓻𝓼 𝓪𝓾 𝓒𝓵𝓪𝓲𝓻 𝓭𝓮 𝓛𝓾𝓷𝓮🌙";
  const STORAGE_KEY_BASE = 'vcl_atelier';
	const META_KEY         = 'vcl_atelier_meta';

	function getBuildKey(idx) {
		return STORAGE_KEY_BASE + '_' + idx;
	}

	// Migration : si l'ancien format existe et que le build 0 n'existe pas encore
	(function migrate() {
		const old = localStorage.getItem(STORAGE_KEY_BASE);
		if (old && !localStorage.getItem(getBuildKey(0))) {
			localStorage.setItem(getBuildKey(0), old);
			localStorage.removeItem(STORAGE_KEY_BASE);
		}
	})();

	// Charge l'index actif depuis le meta
	(function loadActiveBuild() {
		try {
			const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
			activeBuildIndex = meta.active ?? 0;
		} catch(e) { activeBuildIndex = 0; }
	})();

	function saveToStorage() {
		const equippedSlots = {};
		Object.entries(equipped).forEach(function(e) {
			if (e[1]) equippedSlots[e[0]] = { id: e[1].id, name: e[1].name || e[1].id };
		});
		try {
			localStorage.setItem(getBuildKey(activeBuildIndex), JSON.stringify({
				v: 2, sig: SIG,
				name: document.getElementById('inp-name').value.trim(),
				classe: activeClass || '',
				level: buildLevel,
				caracterPoints: caracterPoints,
				slots: equippedSlots,
				runes: equippedRunes,
			}));
			localStorage.setItem(META_KEY, JSON.stringify({ active: activeBuildIndex }));
			window._vclActiveBuildKey = getBuildKey(activeBuildIndex);
			window.dispatchEvent(new CustomEvent('vcl:stuffChanged'));
			updateBuildTabs();
		} catch(e) {}
	}

	

	function loadBuild(idx) {
		// Sauvegarde le build actuel avant de switcher
		saveToStorage();

		activeBuildIndex = idx;
		window._vclActiveBuildKey = getBuildKey(idx);
		localStorage.setItem(META_KEY, JSON.stringify({ active: idx }));

		// Reset état
		equipped = {};
		equippedRunes = {};
		activeSlot = null;
		buildLevel = 1;
		caracterPoints = { vitalite: 0, defense_car: 0, intelligence: 0, force: 0, esprit: 0, dexterite: 0 };

		try {
			const raw = localStorage.getItem(getBuildKey(idx));
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed.sig === SIG && parsed.slots) {
					Object.entries(parsed.slots).forEach(function(e) {
						const slotId = e[0];
						const entry  = e[1];
						const itemId = typeof entry === 'string' ? entry : entry.id;
						const item   = ITEMS.find(function(i) { return i.id === itemId; });
						if (item) equipped[slotId] = item;
					});
					if (parsed.runes) {
						Object.entries(parsed.runes).forEach(function(e) {
							if (RUNES_BY_ID.get(e[1]) && isRuneKeyValid(e[0], equipped))
								equippedRunes[e[0]] = e[1];
						});
					}
					if (parsed.name)  document.getElementById('inp-name').value = parsed.name;
					else              document.getElementById('inp-name').value = '';
					if (parsed.classe) { activeClass = parsed.classe || null; buildClassPicker(); updateSkinClass(); }
					else               { activeClass = null; buildClassPicker(); updateSkinClass(); }
					if (parsed.level >= 1) buildLevel = parsed.level;
					if (parsed.caracterPoints) {
						Object.keys(caracterPoints).forEach(k => {
							if (typeof parsed.caracterPoints[k] === 'number')
								caracterPoints[k] = parsed.caracterPoints[k];
						});
					}
				}
			} else {
				// Build vide : reset le nom
				document.getElementById('inp-name').value = '';
				activeClass = null;
				buildClassPicker();
				updateSkinClass();
			}
		} catch(e) {}

		buildGrid();
		buildLevelPanel();
		renderStats();
		renderPickerInfo();
		renderItemList();
		updateBuildTabs();
		window.dispatchEvent(new CustomEvent('vcl:stuffChanged'));
	}

	function buildBuildTabs() {
  let bar = document.getElementById('build-tabs-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'build-tabs-bar';
    bar.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:50%',
      'transform:translateX(-50%)',
      'display:flex',
      'gap:8px',
      'z-index:10',
      'pointer-events:all',
    ].join(';');

    // Insérer DANS .mq (l'encadré doré du skin)
    const mq = document.querySelector('.mq');
    if (mq) {
      // S'assurer que .mq est en position relative pour que absolute fonctionne
      mq.style.position = 'relative';
      mq.appendChild(bar);
    }
  }

		bar.innerHTML = '';

		for (let i = 0; i < NUM_BUILDS; i++) {
			// Lire le nom sauvegardé
			let buildName = 'Build ' + (i + 1);
			try {
				const raw = localStorage.getItem(getBuildKey(i));
				if (raw) {
					const p = JSON.parse(raw);
					if (p.name) buildName = p.name;
				}
			} catch(e) {}

			const btn = document.createElement('button');
			btn.dataset.buildIdx = i;
			btn.style.cssText = [
				'display:flex',
				'flex-direction:column',
				'align-items:center',
				'justify-content:center',
				'gap:2px',
				'width:72px',
				'padding:6px 8px',
				'border-radius:0px',
				'border:1px solid var(--rim)',
				'background:' + (i === activeBuildIndex ? 'var(--surface2)' : 'var(--surface)'),
				'color:' + (i === activeBuildIndex ? 'var(--gold)' : 'var(--muted)'),
				'cursor:pointer',
				'transition:all .15s',
				'font-family:inherit',
				i === activeBuildIndex ? 'box-shadow:0 0 0 1px var(--gold)40' : '',
			].join(';');

			const num = document.createElement('span');
			num.style.cssText = 'font-family:"Cinzel",serif;font-size:16px;font-weight:700;line-height:1;color:' +
				(i === activeBuildIndex ? 'var(--gold)' : 'var(--muted)');
			num.textContent = i + 1;

			const lbl = document.createElement('span');
			lbl.style.cssText = 'font-size:8px;max-width:64px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
			lbl.textContent = buildName;

			btn.appendChild(num);
			btn.appendChild(lbl);

			btn.addEventListener('click', function() {
				const idx = parseInt(this.dataset.buildIdx);
				if (idx === activeBuildIndex) return;
				loadBuild(idx);
			});

			bar.appendChild(btn);
		}
	}

	function updateBuildTabs() {
		const bar = document.getElementById('build-tabs-bar');
		if (!bar) { buildBuildTabs(); return; }

		bar.querySelectorAll('button').forEach(function(btn) {
			const i = parseInt(btn.dataset.buildIdx);
			const isActive = i === activeBuildIndex;

			btn.style.background  = isActive ? 'var(--surface2)' : 'var(--surface)';
			btn.style.color       = isActive ? 'var(--gold)' : 'var(--muted)';
			btn.style.boxShadow   = isActive ? '0 0 0 1px rgba(215,175,95,.4)' : 'none';
			btn.style.borderColor = isActive ? 'var(--gold)' : 'var(--rim)';

			const num = btn.querySelector('span:first-child');
			if (num) num.style.color = isActive ? 'var(--gold)' : 'var(--muted)';

			// Mettre à jour le label avec le nom actuel
			const lbl = btn.querySelector('span:last-child');
			if (lbl) {
				let buildName = 'Build ' + (i + 1);
				try {
					const raw = localStorage.getItem(getBuildKey(i));
					if (raw) {
						const p = JSON.parse(raw);
						if (p.name) buildName = p.name;
					}
				} catch(e) {}
				// Si c'est le build actif, prendre le nom depuis l'input directement
				if (isActive) {
					const inp = document.getElementById('inp-name');
					if (inp && inp.value.trim()) buildName = inp.value.trim();
				}
				lbl.textContent = buildName;
			}
		});
	}

  /* ══ MODALES ══ */
  function openModal(mode) {
    const modal = document.getElementById('modal');
    modal.dataset.mode = mode;
    const errEl = document.getElementById('modal-error');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    ['export', 'import', 'reset', 'confirm-class', 'confirm-level'].forEach(function(m) {
      const zone = document.getElementById('modal-zone-' + m);
      if (zone) zone.style.display = (m === mode) ? 'flex' : 'none';
    });
    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
  }

  /* ══ EXPORT ══ */
  document.getElementById('btn-export').addEventListener('click', function() {
    const name = document.getElementById('inp-name').value.trim() || 'Mon Stuff';
    const equippedIds = {};
    Object.entries(equipped).forEach(function(e) {
      if (e[1]) equippedIds[e[0]] = e[1].id;
    });
    const payload = {
      v: 1,
      sig: SIG,
			buildIndex: activeBuildIndex,
      name: name,
      classe: activeClass || '',
      level: buildLevel,
      caracterPoints: caracterPoints,
      slots: equippedIds,
      runes: equippedRunes,
    };
    const ta = document.getElementById('modal-ta-export');
    if (ta) ta.value = '```json\n' + JSON.stringify(payload, null, 2) + '\n```';
    document.getElementById('modal-title').textContent = '◈ Exporter — ' + name;
    openModal('export');
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-export');
    if (!ta) return;
    ta.select();
    document.execCommand('copy');
    const b = document.getElementById('btn-copy');
    b.textContent = '✓ Copié !';
    setTimeout(function() { b.textContent = '◈ Copier'; }, 1600);
  });

  /* ══ IMPORT ══ */
  document.getElementById('btn-import').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-import');
    if (ta) ta.value = '';
    document.getElementById('modal-title').textContent = '↑ Importer un Stuff';
    openModal('import');
  });

  document.getElementById('btn-confirm-import').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-import');
    const raw = ta ? ta.value.trim() : '';
	const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const errEl = document.getElementById('modal-error');

    if (!cleaned) {
      if (errEl) { errEl.textContent = '⚠ Collez un JSON valide avant d\'importer.'; errEl.style.display = 'block'; }
      return;
    }

    try {
      const parsed = JSON.parse(cleaned);

      if (parsed.sig !== SIG) {
        throw new Error('Signature invalide');
      }

      if (parsed.v === 1 && parsed.slots) {
        equipped = {};
        equippedRunes = {};

		if (parsed.level && parsed.level >= 1 && parsed.level <= MAX_LEVEL) {
          buildLevel = parsed.level;
        }
        if (parsed.caracterPoints && typeof parsed.caracterPoints === 'object') {
          Object.keys(caracterPoints).forEach(k => {
            if (typeof parsed.caracterPoints[k] === 'number') {
              caracterPoints[k] = parsed.caracterPoints[k];
            }
          });
        }

		const importLevel = (parsed.level >= 1 && parsed.level <= MAX_LEVEL) ? parsed.level : buildLevel;
		Object.entries(parsed.slots).forEach(function(e) {
			const slotId = e[0]; const itemId = e[1];
			const item = ITEMS.find(function(i) { return i.id === itemId; });
			if (item && itemAllowedForLevel(item, importLevel) && itemMeetsThreshold(item))
				equipped[slotId] = item;
		});

        if (parsed.runes && typeof parsed.runes === 'object') {
          Object.entries(parsed.runes).forEach(function(e) {
            const runeKey = e[0]; const runeId = e[1];
            if (
              RUNES_BY_ID.get(runeId) &&
              isRuneKeyValid(runeKey, equipped)
            ) {
              equippedRunes[runeKey] = runeId;
            }
          });
        }

        if (parsed.name) document.getElementById('inp-name').value = parsed.name;
        if (parsed.classe) {
          activeClass = parsed.classe || null;
          buildClassPicker();
		  updateSkinClass();
        }
      }
      else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        equipped = parsed;
        equippedRunes = {};
      } else {
        throw new Error('Format non reconnu');
      }

      buildGrid();
      buildLevelPanel();
      saveToStorage();
      renderStats();
      renderPickerInfo();
      renderItemList();
      closeModal();

    } catch(e) {
      if (errEl) {
        errEl.textContent = '✕ JSON invalide ou format non reconnu. Vérifiez le contenu.';
        errEl.style.display = 'block';
      }
    }
  });

  /* ══ RESET ══ */
  document.getElementById('btn-reset').addEventListener('click', function() {
    document.getElementById('modal-title').textContent = '✕ Réinitialiser';
    openModal('reset');
  });

  document.getElementById('btn-confirm-reset').addEventListener('click', function() {
    equipped = {};
    equippedRunes = {};
    activeSlot = null;
    buildLevel = 1;
    caracterPoints = { vitalite: 0, defense_car: 0, intelligence: 0, force: 0, esprit: 0, dexterite: 0 };
    localStorage.removeItem(getBuildKey(activeBuildIndex));
    buildGrid();
    buildLevelPanel();
    renderStats();
    renderPickerInfo();
    renderItemList();
    closeModal();
	filterStats = new Set();
  document.querySelectorAll('.stat-row.stat-filtered').forEach(r => r.classList.remove('stat-filtered'));
  document.getElementById('inp-name').value = '';
  updateBuildTabs();
  });

  /* ══ FERMETURE MODALE ══ */
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  /* ══ RECHERCHE ══ */
  // Les items "sensibles" ne sont pas dans ITEMS : ils sont stockés dans
  // items_hidden, accessibles uniquement par hash(nom exact). On tente un
  // lookup débouncé à chaque frappe ; si l'item existe, on l'injecte dans
  // ITEMS et on re-render.
  const _sensibleTried = new Set(); // normalisés déjà tentés
  let _sensibleTimer = null;
  function _sensibleImg(category, id, palier) {
    if (!id) return null;
    const p = palier ? 'P' + palier + '\'' : '';
    switch (category) {
      case 'arme':        return '../img/compendium/textures/weapons/' + id + '.png';
      case 'armure':      return '../img/compendium/textures/armors/' + id + '.png';
      case 'accessoire':  return '../img/compendium/textures/trinkets/' + p + id + '.png';
      case 'outils':      return '../img/compendium/textures/gears/' + id + '.png';
      case 'materiaux':   return '../img/compendium/textures/items/Material/' + id + '.png';
      case 'ressources':  return '../img/compendium/textures/items/Ressources/' + id + '.png';
      case 'consommable': return '../img/compendium/textures/items/Consommable/' + id + '.png';
      case 'nourriture':  return '../img/compendium/textures/items/Nourriture/' + id + '.png';
      case 'rune':        return '../img/compendium/textures/items/Runes/' + id + '.png';
      case 'quete':       return '../img/compendium/textures/items/Quest/' + id + '.png';
      case 'donjon':      return '../img/compendium/textures/items/Donjon/' + id + '.png';
      default:            return null;
    }
  }
  async function _trySensibleLookup(rawName) {
    const q = normalize(rawName);
    if (!q || q.length < 3) return;
    if (_sensibleTried.has(q)) return;
    _sensibleTried.add(q);
    const api = window.VCL_DB;
    if (!api || !api.getHiddenByName) return;
    try {
      const hit = await api.getHiddenByName(api.COL.itemsHidden, rawName);
      if (!hit) return;
      // Éviter doublon si l'item est déjà dans ITEMS (cas limite)
      if (ITEMS.some(function(it) { return it.id === hit.id; })) return;
      if (!hit.img) hit.img = _sensibleImg(hit.category || hit.cat, hit.id, hit.palier);
      ITEMS.push(hit);
      // Ne re-render que si la recherche courante correspond encore
      if (normalize(filterQ) === q) renderItemList();
    } catch (err) {
      console.warn('[atelier] sensible lookup:', err);
    }
  }
  document.getElementById('inp-search').addEventListener('input', function(e) {
    filterQ = e.target.value.trim();
    renderItemList();
    clearTimeout(_sensibleTimer);
    const raw = filterQ;
    _sensibleTimer = setTimeout(function() { _trySensibleLookup(raw); }, 250);
  });

  document.getElementById('inp-name').addEventListener('input', function() {
    saveToStorage();
		updateBuildTabs();
  });

  /* ══ RESIZE ══ */
  function fitGrid() {
    const header = document.querySelector('.site-header');
    const page   = document.querySelector('.page');
    if (!header || !page) return;

    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
    page.style.marginTop = header.offsetHeight + 'px';
    page.style.height = 'calc(100vh - ' + header.offsetHeight + 'px)';

    const wrap = document.querySelector('.mannequin-col');
    const mq   = document.querySelector('.mq');
    if (!wrap || !mq) return;

    const G    = 10;
    const padW = 48;
    const padH = 40;

    const availW = wrap.clientWidth  - padW;
    const availH = wrap.clientHeight - padH;

    if (availW <= 0 || availH <= 0) {
      requestAnimationFrame(fitGrid);
      return;
    }

    const Sw = Math.floor((availW - 2.2 * G) / 4.75);
    const Sh = Math.floor((availH - 5 * G) / 6);
    const S  = Math.max(44, Math.min(Sw, Sh, 110));
    const colH = 5 * S + 4 * G;
    const W  = Math.round(colH * 0.55);

    mq.style.setProperty('--S', S + 'px');
    mq.style.setProperty('--W', W + 'px');
    mq.style.setProperty('--G', G + 'px');

    if (window.__skinViewer) {
		window.__skinViewer.setSize(W, colH);
	} else {
		initSkinViewer(W, colH);
	}

    const totalW = 2 * S + W + 2 * G;
    const rowBot = document.getElementById('row-bot');
    if (rowBot) rowBot.style.width = totalW + 'px';

    mq.style.width = totalW + 'px';
  }

  window.addEventListener('resize', fitGrid);

  /* ══ INIT ══ */
  function init() {
    buildCarTooltip();
    buildClassPicker();
    buildGrid();
    buildFilters();
	buildTierFilter();
    buildStatsUI();
    buildLevelPanel();

    try {
      const raw = localStorage.getItem(getBuildKey(activeBuildIndex));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sig === SIG && (parsed.v === 1 || parsed.v === 2) && parsed.slots) {

          const sensiblePending = []; // { slotId, name } à résoudre en async

          Object.entries(parsed.slots).forEach(function(e) {
            const slotId = e[0];
            const entry  = e[1];
            // Compat v1 (string) et v2 ({ id, name })
            const itemId   = typeof entry === 'string' ? entry : entry.id;
            const itemName = typeof entry === 'string' ? null  : entry.name;
            const item = ITEMS.find(function(i) { return i.id === itemId; });
            if (item) {
              equipped[slotId] = item;
            } else if (itemName) {
              // Item non trouvé dans ITEMS → potentiellement sensible
              sensiblePending.push({ slotId: slotId, name: itemName });
            }
          });

          if (parsed.runes && typeof parsed.runes === 'object') {
            Object.entries(parsed.runes).forEach(function(e) {
              const runeKey = e[0]; const runeId = e[1];
              if (
                RUNES_BY_ID.get(runeId) &&
                isRuneKeyValid(runeKey, equipped)
              ) {
                equippedRunes[runeKey] = runeId;
              }
            });
          }

          if (parsed.name) document.getElementById('inp-name').value = parsed.name;
          if (parsed.classe) {
            activeClass = parsed.classe;
            buildClassPicker();
          }
          if (parsed.level && parsed.level >= 1 && parsed.level <= MAX_LEVEL) {
            buildLevel = parsed.level;
          }
          if (parsed.caracterPoints && typeof parsed.caracterPoints === 'object') {
            Object.keys(caracterPoints).forEach(k => {
              if (typeof parsed.caracterPoints[k] === 'number') {
                caracterPoints[k] = parsed.caracterPoints[k];
              }
            });
          }

          buildGrid();
          buildLevelPanel();

          // Restauration asynchrone des items sensibles
          if (sensiblePending.length) {
            sensiblePending.forEach(function(pending) {
              (function(slotId, rawName) {
                var api = window.VCL_DB;
                if (!api || !api.getHiddenByName) return;
                api.getHiddenByName(api.COL.itemsHidden, rawName).then(function(hit) {
                  if (!hit) return;
                  if (ITEMS.some(function(it) { return it.id === hit.id; })) {
                    equipped[slotId] = ITEMS.find(function(it) { return it.id === hit.id; });
                  } else {
                    if (!hit.img) hit.img = _sensibleImg(hit.category || hit.cat, hit.id, hit.palier);
                    ITEMS.push(hit);
                    equipped[slotId] = hit;
                  }
                  buildGrid();
                  renderStats();
                  renderPickerInfo();
                }).catch(function() {});
              })(pending.slotId, pending.name);
            });
          }
        }
      }
    } catch(e) { }

    renderStats();
    renderPickerInfo();
    renderItemList();
		buildBuildTabs();
	requestAnimationFrame(function() {
		fitGrid();
		requestAnimationFrame(fitGrid);
	});
    if (window.ResizeObserver) {
      new ResizeObserver(fitGrid).observe(document.querySelector('.site-header'));
    }
  }

  window._pageInit = init;

})();

(function () {
  'use strict';

  const SIG         = '🌙VCL_DRAWER_v2';
  const STORAGE_KEY = 'vcl_craft_drawer_v2';

  /* Lookup partagé — ALL_SLOTS vient de Compendium/data.js */
  const SLOTS_BY_ID = new Map(ALL_SLOTS.map(s => [s.id, s]));

  /* ══ ORDRE D'AFFICHAGE DES SLOTS ══ */
  const SLOT_ORDER = [
    'casque', 'plastron', 'jambieres', 'bottes',
    'arme_pr', 'arme_sec',
    'anneau1', 'anneau2', 'amulette', 'bracelet', 'gants',
    'artefact1', 'artefact2', 'artefact3',
  ];

  function loadState() {
    try {
      const raw = localStorage.getItem(getBuildKey(activeBuildIndex));
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p.sig === SIG ? p : null;
    } catch (e) { return null; }
  }
  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        sig:     SIG,
        checked: checkedKeys,
        qty:     haveQty,
      }));
    } catch (e) {}
  }

  let checkedKeys = {};
  let haveQty     = {};

  function getEquippedCraftItems() {
    if (typeof ITEMS === 'undefined') return [];
    const results = [];
    try {
      const raw = localStorage.getItem(window._vclActiveBuildKey || 'vcl_atelier_0');
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!parsed || !parsed.slots) return [];

      /* Trier selon SLOT_ORDER */
      const sortedEntries = Object.entries(parsed.slots).sort(function (a, b) {
        const ia = SLOT_ORDER.indexOf(a[0]);
        const ib = SLOT_ORDER.indexOf(b[0]);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      });

      sortedEntries.forEach(function (entry) {
        const slotId = entry[0];
        const raw    = entry[1];
        const itemId = typeof raw === 'string' ? raw : raw.id;
        const item = ITEMS.find(function (i) { return i.id === itemId; });
        if (!item) return;
        if (!item.craft || !Array.isArray(item.craft) || !item.craft.length) return;
        results.push({ slotId: slotId, item: item });
      });
    } catch (e) {}
    return results;
  }

  function computeAll() {
    return getEquippedCraftItems().map(function (entry) {
      const mats = [];
      entry.item.craft.forEach(function (c) {
        if (!c || !c.id) return;
        mats.push({ matId: c.id, qty: c.qty || 1 });
      });
      return { slotId: entry.slotId, item: entry.item, mats: mats };
    });
  }

  function key(slotId, matId) { return slotId + '::' + matId; }

  function isMatDone(slotId, matId, need) {
    const k = key(slotId, matId);
    if (checkedKeys[k]) return true;
    return (parseInt(haveQty[k] || 0)) >= need;
  }

  /* ══ RÉSUMÉ GLOBAL DES MATÉRIAUX (sans doublons) ══ */
  function buildSummaryBlock(groups) {
    /* Agrège toutes les quantités nécessaires par matId */
    const totals = {};
    groups.forEach(function (g) {
      g.mats.forEach(function (m) {
        totals[m.matId] = (totals[m.matId] || 0) + m.qty;
      });
    });

    const entries = Object.entries(totals);
    if (!entries.length) return null;

    const block = document.createElement('div');
    block.style.cssText = 'margin-bottom:10px;border:1px solid var(--rim);padding:6px 8px;';

    const title = document.createElement('div');
    title.style.cssText = 'font-family:"Cinzel",serif;font-size:7.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);margin-bottom:6px;border-bottom:1px solid var(--rim);padding-bottom:4px;';
    title.textContent = '⬡ Résumé Global';
    block.appendChild(title);

    entries.forEach(function (e) {
      const matId = e[0];
      const need  = e[1];
      const matItem = (typeof ITEMS !== 'undefined') ? ITEMS.find(function (i) { return i.id === matId; }) : null;
      const matName = matItem ? matItem.name : matId;
      const isCols  = matId === 'cols';

      /* Quantité déjà possédée = somme des haveQty sur tous les slots pour ce matId */
      let totalHave = 0;
      groups.forEach(function (g) {
        totalHave += parseInt(haveQty[key(g.slotId, matId)] || 0);
      });
      const done = totalHave >= need;

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:3px 2px;' + (done ? 'opacity:.45;' : '');

      /* Icône */
      const imgW = document.createElement('div');
      imgW.style.cssText = 'width:18px;height:18px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.03);border:1px solid var(--rim);';
      if (isCols) {
        imgW.innerHTML = '<span style="font-size:12px">🪙</span>';
      } else if (matItem && getItemImg(matItem)) {
        imgW.innerHTML = '<img src="' + getItemImg(matItem) + '" alt="" style="width:14px;height:14px;object-fit:contain;image-rendering:pixelated;">';
      } else {
        imgW.innerHTML = '<span style="font-size:10px">📦</span>';
      }

      const nameEl = document.createElement('span');
      nameEl.style.cssText = 'flex:1;font-family:"JetBrains Mono",monospace;font-size:9px;color:var(--bright);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;' + (done ? 'text-decoration:line-through;' : '');
      nameEl.textContent = matName;

      const qtyEl = document.createElement('span');
      qtyEl.style.cssText = 'font-family:"Cinzel",serif;font-size:9px;font-weight:700;' + (done ? 'color:var(--muted);' : 'color:var(--gold);');
      qtyEl.textContent = Math.min(totalHave, need) + ' / ' + need;

      row.appendChild(imgW);
      row.appendChild(nameEl);
      row.appendChild(qtyEl);
      block.appendChild(row);
    });

    return block;
  }

  /* ══ DOM ══ */
  const drawer    = document.getElementById('craft-drawer');
  const tab       = document.getElementById('craft-drawer-tab');
  const closeBtn  = document.getElementById('craft-drawer-close');
  const checklist = document.getElementById('cdp-checklist');
  const progFill  = document.getElementById('cdp-prog-fill');
  const progLabel = document.getElementById('cdp-prog-label');

  tab.addEventListener('click', function () {
    drawer.classList.toggle('open');
    if (drawer.classList.contains('open')) refresh();
  });
  closeBtn.addEventListener('click', function () {
    drawer.classList.remove('open');
  });

  function updateBadge() { /* désactivé */ }

  function updateProgress(groups) {
    let total = 0, done = 0;
    groups.forEach(function (g) {
      g.mats.forEach(function (m) {
        total++;
        if (isMatDone(g.slotId, m.matId, m.qty)) done++;
      });
    });
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    progFill.style.width  = pct + '%';
    progLabel.textContent = done + ' / ' + total;
  }

  function refresh() {
    const groups = computeAll();
    updateProgress(groups);
    buildChecklist(groups);
  }

 function buildChecklist(groups) {
    checklist.innerHTML = '';

    if (!groups.length) {
      checklist.innerHTML =
        '<div class="cdp-empty">' +
        '<span class="cdp-empty-icon">🧰</span>' +
        'Aucun item équipé avec un craft.<br>Équipez des items craftables dans l\'Atelier.' +
        '</div>';
      return;
    }

    const summaryBlock = buildSummaryBlock(groups);
    if (summaryBlock) {
      summaryBlock.dataset.summary = '1';
      checklist.appendChild(summaryBlock);
    }

    groups.forEach(function (g) {
      const item   = g.item;
      const slotId = g.slotId;
      const rarCol = (typeof RARITIES !== 'undefined' && RARITIES[item.rarity])
        ? RARITIES[item.rarity].color : '#888';

      /* État collapsed persisté en mémoire par clé slotId */
      if (typeof buildChecklist._collapsed === 'undefined') buildChecklist._collapsed = {};
      const isCollapsed = !!buildChecklist._collapsed[slotId];

      const group = document.createElement('div');
      group.className = 'cdp-group';

      /* ── En-tête ── */
      const header = document.createElement('div');
      header.className = 'cdp-group-header';
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';

      /* Checkbox de groupe */
      const groupCheckbox = document.createElement('div');
      groupCheckbox.style.cssText = 'width:14px;height:14px;flex-shrink:0;border:1.5px solid var(--rim2);background:transparent;display:flex;align-items:center;justify-content:center;font-size:8px;color:transparent;cursor:pointer;transition:all .14s;';

      function allGroupDone() {
        return g.mats.every(function (m) { return isMatDone(slotId, m.matId, m.qty); });
      }
      function refreshGroupCheckbox() {
        if (allGroupDone()) {
          groupCheckbox.style.background  = 'rgba(89,208,89,.12)';
          groupCheckbox.style.borderColor = 'rgba(89,208,89,.5)';
          groupCheckbox.style.color       = '#59d059';
          groupCheckbox.textContent       = '✓';
        } else {
          groupCheckbox.style.background  = 'transparent';
          groupCheckbox.style.borderColor = 'var(--rim2)';
          groupCheckbox.style.color       = 'transparent';
          groupCheckbox.textContent       = '';
        }
      }
      refreshGroupCheckbox();

      groupCheckbox.addEventListener('click', function (e) {
        e.stopPropagation();
        const nowDone = allGroupDone();
        g.mats.forEach(function (m) {
          const k = key(slotId, m.matId);
          if (nowDone) {
            delete checkedKeys[k];
            haveQty[k] = 0;
          } else {
            checkedKeys[k] = true;
            haveQty[k]     = m.qty;
          }
        });
        saveState();
        refresh();
      });

      /* Flèche collapse */
      const arrow = document.createElement('span');
      arrow.style.cssText = 'font-size:8px;color:var(--muted);flex-shrink:0;transition:transform .18s;margin-left:auto;padding-left:4px;';
      arrow.textContent = '▲';
      if (isCollapsed) arrow.style.transform = 'rotate(180deg)';

      /* Compteur d'ingrédients quand replié */
      const countBadge = document.createElement('span');
      countBadge.style.cssText = 'font-family:"JetBrains Mono",monospace;font-size:7px;color:var(--muted);flex-shrink:0;padding-right:2px;';
      const doneMats  = g.mats.filter(function (m) { return isMatDone(slotId, m.matId, m.qty); }).length;
      countBadge.textContent = doneMats + '/' + g.mats.length;

      /* Zone des lignes matériaux */
      const matsWrap = document.createElement('div');
      matsWrap.style.cssText = 'overflow:hidden;transition:max-height .22s ease;';
      matsWrap.style.maxHeight = isCollapsed ? '0' : '1000px';

      /* Toggle au clic sur le header (pas sur la checkbox) */
      header.addEventListener('click', function (e) {
        if (groupCheckbox.contains(e.target)) return;
        buildChecklist._collapsed[slotId] = !buildChecklist._collapsed[slotId];
        const nowCollapsed = buildChecklist._collapsed[slotId];
        matsWrap.style.maxHeight = nowCollapsed ? '0' : '1000px';
        arrow.style.transform = nowCollapsed ? 'rotate(180deg)' : 'rotate(0deg)';
      });

      const dot = document.createElement('span');
      dot.className = 'cdp-group-dot';
      dot.style.background = rarCol;

      const imgWrap = document.createElement('div');
      imgWrap.className = 'cdp-group-img';
      if (getItemImg(item)) {
        imgWrap.innerHTML = '<img src="' + getItemImg(item) + '" alt="">';
      } else {
        imgWrap.innerHTML = '<span style="font-size:13px">📦</span>';
      }

      const nameEl = document.createElement('span');
      nameEl.className = 'cdp-group-name';
      nameEl.style.color = rarCol;
      nameEl.textContent = item.name;

      const slotEl = document.createElement('span');
      slotEl.className = 'cdp-group-slot';
      if (typeof ALL_SLOTS !== 'undefined') {
        const slotDef = ALL_SLOTS.find(function(s) { return s.id === slotId; });
        slotEl.textContent = slotDef ? slotDef.ico + ' ' + slotDef.label : slotId;
      }

      header.appendChild(groupCheckbox);
      header.appendChild(dot);
      header.appendChild(imgWrap);
      header.appendChild(nameEl);
      header.appendChild(slotEl);
      header.appendChild(countBadge);
      header.appendChild(arrow);
      group.appendChild(header);

      /* ── Lignes matériaux dans le wrapper ── */
      g.mats.forEach(function (m) {
        matsWrap.appendChild(buildMatRow(slotId, m.matId, m.qty, group, groups, refreshGroupCheckbox));
      });

      group.appendChild(matsWrap);
      checklist.appendChild(group);
    });
  }
  function buildMatRow(slotId, matId, need, groupEl, groups, refreshGroupCheckboxFn) {
    const isCols  = matId === 'cols';
    const matItem = (!isCols && typeof ITEMS !== 'undefined') ? ITEMS.find(function (i) { return i.id === matId; }) : null;
    const have    = parseInt(haveQty[key(slotId, matId)] || 0);
    const done    = isMatDone(slotId, matId, need);
    const qtyOk   = have >= need;

    const row = document.createElement('div');
    row.className = 'cdp-mat-row' + (done ? ' mat-done' : '') + (qtyOk ? ' qty-ok' : '');

    const box = document.createElement('div');
    box.className = 'cdp-mat-checkbox';
    box.textContent = done ? '✓' : '';

    const imgW = document.createElement('div');
    imgW.className = 'cdp-mat-img';
    if (isCols) {
      imgW.innerHTML = '<span style="font-size:14px;line-height:1;">🪙</span>';
    } else if (matItem && getItemImg(matItem)) {
      imgW.innerHTML = '<img src="' + getItemImg(matItem) + '" alt="">';
    } else {
      imgW.innerHTML = '<span class="cdp-fallback">📦</span>';
    }

    const info = document.createElement('div');
    info.className = 'cdp-mat-info';
    const matName = matItem ? matItem.name : (isCols ? 'Cols' : matId);
    info.innerHTML = '<div class="cdp-mat-name">' + matName + '</div>';

    const qtyWrap = document.createElement('div');
    qtyWrap.className = 'cdp-qty-wrap';

    const haveInput = document.createElement('input');
    haveInput.type        = 'number';
    haveInput.className   = 'cdp-qty-have';
    haveInput.min         = 0;
    haveInput.max         = need;
    haveInput.placeholder = '0';
    haveInput.value       = have > 0 ? Math.min(have, need) : '';
    haveInput.title       = 'Quantité possédée';

    haveInput.addEventListener('click', function (e) { e.stopPropagation(); });
    haveInput.addEventListener('input', function (e) {
      e.stopPropagation();
      let v = parseInt(haveInput.value) || 0;
      if (v > need) { v = need; haveInput.value = need; }
      if (v < 0)    { v = 0;    haveInput.value = 0; }

      haveQty[key(slotId, matId)] = v;
      if (v >= need) {
        checkedKeys[key(slotId, matId)] = true;
      } else {
        delete checkedKeys[key(slotId, matId)];
      }
      saveState();

      const newDone = v >= need;
      row.classList.toggle('mat-done', newDone);
      row.classList.toggle('qty-ok',   newDone);
      box.textContent = newDone ? '✓' : '';
      if (refreshGroupCheckboxFn) refreshGroupCheckboxFn();
      updateProgress(computeAll());
      _refreshSummary();
    });

    const sep = document.createElement('span');
    sep.className   = 'cdp-qty-sep';
    sep.textContent = '/';

    const needSpan = document.createElement('span');
    needSpan.className   = 'cdp-qty-need';
    needSpan.textContent = need;

    qtyWrap.appendChild(haveInput);
    qtyWrap.appendChild(sep);
    qtyWrap.appendChild(needSpan);

    row.addEventListener('click', function (e) {
      if (e.target === haveInput) return;
      const k = key(slotId, matId);
      const wasDone = isMatDone(slotId, matId, need);
      if (wasDone) {
        delete checkedKeys[k];
        haveQty[k]      = 0;
        haveInput.value = '';
      } else {
        checkedKeys[k]  = true;
        haveQty[k]      = need;
        haveInput.value = need;
      }
      saveState();
      const newDone = !wasDone;
      row.classList.toggle('mat-done', newDone);
      row.classList.toggle('qty-ok',   newDone);
      box.textContent = newDone ? '✓' : '';
      if (refreshGroupCheckboxFn) refreshGroupCheckboxFn();
      updateProgress(computeAll());
      _refreshSummary();
    });

    row.appendChild(box);
    row.appendChild(imgW);
    row.appendChild(info);
    row.appendChild(qtyWrap);
    return row;
  }

  /* Rafraîchit uniquement le bloc résumé sans tout reconstruire */
  function _refreshSummary() {
    const groups = computeAll();
    const existing = checklist.querySelector('[data-summary]');
    if (existing) existing.remove();
    const block = buildSummaryBlock(groups);
    if (block) {
      block.dataset.summary = '1';
      checklist.insertBefore(block, checklist.firstChild);
    }
  }

  /* ══ CONTRÔLES ══ */
  document.getElementById('cdp-check-all').addEventListener('click', function () {
    const groups = computeAll();
    groups.forEach(function (g) {
      g.mats.forEach(function (m) {
        checkedKeys[key(g.slotId, m.matId)] = true;
        haveQty[key(g.slotId, m.matId)]     = m.qty;
      });
    });
    saveState(); refresh();
  });

  document.getElementById('cdp-uncheck-all').addEventListener('click', function () {
    checkedKeys = {};
    /* Remettre toutes les quantités à 0 aussi */
    Object.keys(haveQty).forEach(function (k) { haveQty[k] = 0; });
    saveState(); refresh();
  });

  document.getElementById('cdp-reset-qty').addEventListener('click', function () {
    haveQty = {}; saveState(); refresh();
  });

  document.getElementById('cdp-reset-all').addEventListener('click', function () {
    checkedKeys = {}; haveQty = {}; saveState(); refresh();
  });

  /* ══ OBSERVER ══ */
  window.addEventListener('vcl:stuffChanged', function () {
    if (drawer.classList.contains('open')) refresh();
    else updateProgress(computeAll());
  });

  /* ══ INIT ══ */
  function init() {
    const saved = loadState();
    if (saved) {
      checkedKeys = saved.checked || {};
      haveQty     = saved.qty    || {};
    }
    updateProgress(computeAll());
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* Tiroir stats */
const statsDrawer  = document.getElementById('stats-drawer');
const statsTab     = document.getElementById('stats-drawer-tab');
const statsClose   = document.getElementById('stats-drawer-close');

statsTab.addEventListener('click', function() {
  statsDrawer.classList.toggle('open');
});
statsClose.addEventListener('click', function() {
  statsDrawer.classList.remove('open');
});
