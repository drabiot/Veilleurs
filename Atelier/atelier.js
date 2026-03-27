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

  /* ══ VALIDATION DES RUNES ══ */
  function isRuneKeyValid(runeKey, equippedItems) {
    const match = runeKey.match(/^(.+)_rune_(\d+)$/);
    if (!match) return false;
    const slotId    = match[1];
    const runeIndex = parseInt(match[2]);
    const item      = equippedItems[slotId];
    if (!item || !item.stats) return false;
    const slots = item.stats['Emplacement de Runes'];
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

  /* ══ TOOLTIP CARACTÉRISTIQUES ══ */
  function buildCarTooltip() {
    if (document.getElementById('car-tooltip')) return;

    const style = document.createElement('style');
    style.textContent = `
      .car-tooltip {
        position: fixed;
        z-index: 9999;
        pointer-events: none;
        opacity: 0;
        transform: translateY(6px) scale(0.97);
        transition: opacity .15s ease, transform .15s ease;
        background: #111220;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 10px;
        padding: 11px 14px;
        min-width: 190px;
        max-width: 250px;
        box-shadow: 0 8px 28px rgba(0,0,0,.6), 0 0 0 1px rgba(255,255,255,.04);
        font-size: 11.5px;
        color: rgba(255,255,255,.75);
        line-height: 1.5;
      }
      .car-tooltip.visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
      .car-tt-header {
        display: flex;
        align-items: center;
        gap: 6px;
        margin-bottom: 6px;
      }
      .car-tt-icon {
        font-size: 15px;
        line-height: 1;
      }
      .car-tt-name {
        font-weight: 700;
        font-size: 12.5px;
        letter-spacing: .02em;
      }
      .car-tt-desc {
        font-style: italic;
        color: rgba(255,255,255,.45);
        font-size: 11px;
        margin-bottom: 8px;
        line-height: 1.45;
      }
      .car-tt-stats {
        display: flex;
        flex-direction: column;
        gap: 4px;
        border-top: 1px solid rgba(255,255,255,.07);
        padding-top: 7px;
      }
      .car-tt-stat-row {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .car-tt-stat-icon { font-size: 12px; flex-shrink: 0; width: 16px; text-align: center; }
      .car-tt-stat-label { flex: 1; color: rgba(255,255,255,.6); font-size: 11px; }
      .car-tt-stat-val {
        font-weight: 700;
        font-size: 11.5px;
        white-space: nowrap;
      }
      .car-tt-per-pt {
        font-size: 9.5px;
        color: rgba(255,255,255,.3);
        margin-left: 2px;
        font-weight: 400;
      }
    `;
    document.head.appendChild(style);

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
  window.__skinViewer.zoom        = 0.85;
  window.__skinViewer.globalLight = 3;
  window.__skinViewer.cameraLight = 1;

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
        const statDef = ALL_STATS.find(function(s) { return s.id === entry[0]; });
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
      const slotDef = ALL_SLOTS.find(s => s.id === slotId);
      const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
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
        ? (CLASSES.find(function(c) { return c.id === newClass; }) || { label: '?' }).label
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
        const slotDef = ALL_SLOTS.find(function(s) { return s.id === slotId; });
        const slotLabel = slotDef ? slotDef.label : slotId;
        const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
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
      const col = (RARITIES[item.rarity] || { color: '#888' }).color;
      const dot = document.createElement('span');
      dot.className = 'slot-dot';
      dot.style.background = col;
      el.appendChild(dot);
      if (item.img) {
        const img = document.createElement('img');
        img.src = item.img; img.alt = item.name; img.className = 'slot-img';
        el.appendChild(img);
      } else {
        appendDiv(el, 'slot-icon', slotDef.ico);
      }
      appendDiv(el, 'slot-name', item.name);

      const runeCount = item.stats && item.stats['Emplacement de Runes'];
      if (runeCount && runeCount > 0) {
        const orbsRow = document.createElement('div');
        orbsRow.className = 'rune-orbs-row';
        for (let i = 0; i < runeCount; i++) {
          const runeKey = slotDef.id + '_rune_' + i;
          const runeId  = equippedRunes[runeKey];
          const rune    = runeId ? RUNES.find(function(r) { return r.id === runeId; }) : null;
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
    const def = ALL_SLOTS.find(s => s.id === slotId);
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
					const statDef = ALL_STATS.find(function(s) { return s.id === e[0]; });
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
					const carDef = CARACTERISTIQUES.find(function(c) { return c.id === e[0]; });
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
      const rune = RUNES.find(function(r) { return r.id === runeId; });
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
        const statDef = ALL_STATS.find(function(s) { return s.id === sv[0]; });
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
    const offSlot = ALL_SLOTS.find(function(s) {
        return s.id === offCat || (s.cats && s.cats.includes(offCat));
    });
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
    activeSlot = slotId;
    document.querySelectorAll('.slot').forEach(function(el) {
      el.classList.toggle('active', el.dataset.slotId === slotId);
    });
    renderPickerInfo();
    renderItemList();
  }

  function renderPickerInfo() {
    const box = document.getElementById('picker-info');
    if (!activeSlot) {
      box.innerHTML = '<div class="psi-hint">Cliquez sur un emplacement</div>';
      return;
    }
    const s = ALL_SLOTS.find(function(x) { return x.id === activeSlot; });
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

			const lines = entries.map(function(e) {
					const key = e[0]; const val = e[1];
					if (key === 'Emplacement de Runes') {
							return '<div class="istat-row">' +
									'<span class="istat-icon">💎</span>' +
									'<span class="istat-label">Emplacement de Runes</span>' +
									'<span class="istat-val">' + val + '</span>' +
									'</div>';
					}
					const statDef = ALL_STATS.find(function(s) { return s.id === key; });
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
					const carDef = CARACTERISTIQUES.find(function(c) { return c.id === e[0]; });
					const label = carDef ? carDef.label : e[0];
					const icon  = carDef ? carDef.icon  : '◈';
					const color = carDef ? carDef.color : '#aaa';
					return '<div class="istat-row">' +
							'<span class="istat-icon">' + icon + '</span>' +
							'<span class="istat-label" style="color:' + color + '">' + label + '</span>' +
							'<span class="istat-val" style="color:' + color + '">+' + e[1] + ' pt</span>' +
							'</div>';
			}).join('');

			if (!lines && !buffLines) return '';

			return (lines ? '<div class="istat-block">' + lines + '</div>' : '') +
						(buffLines ? '<div class="istat-block" style="border-top:1px solid rgba(255,255,255,.06);margin-top:4px;padding-top:4px">' + buffLines + '</div>' : '');
	}

  function buildClassBadgesHTML(item) {
    if (!item.classes || item.classes.length === 0) return '';
    const badges = item.classes.map(function(cid) {
      const cls = CLASSES.find(function(c) { return c.id === cid; });
      if (!cls) return '';
      return '<span class="item-class-badge">' + cls.ico + ' ' + cls.label + '</span>';
    }).join('');
    return '<div class="item-class-badges">' + badges + '</div>';
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
					const rune = RUNES.find(function(r) { return r.id === runeId; });
					if (rune && rune.buff) bonus += rune.buff[carId] || 0;
			});

			return bonus;
	}

  function renderItemList() {
    const list = document.getElementById('items-list');
    if (!activeSlot) {
      list.innerHTML = '<div class="picker-empty-msg">Sélectionnez un emplacement</div>';
      return;
    }
    const slot = ALL_SLOTS.find(function(s) { return s.id === activeSlot; });
    const norm = function(str) { return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); };
    const q    = norm(filterQ);
    const visible = ITEMS.filter(function(item) {
		return slot.cats.includes(item.cat) &&
				itemAllowedForClass(item, activeClass) &&
				(!filterRar  || item.rarity === filterRar) &&
				(filterTier === null || item.palier === filterTier) &&
				(!q || norm(item.name).includes(q)) &&
				(filterStats.size === 0 || [...filterStats].every(function(sid) {
					if (!item.stats) return false;
					const val = item.stats[sid];
					if (val === undefined) return false;
					const v = Array.isArray(val) ? val[1] : val;
					return v !== 0;
				})); 
		});
    if (!visible.length) {
      list.innerHTML = '<div class="picker-empty-msg">Aucun item compatible</div>';
      return;
    }
    list.innerHTML = '';
    visible.forEach(function(item) {
      const row = document.createElement('div');
      const levelOk = itemAllowedForLevel(item, buildLevel);
	  const thresholdOk = itemMeetsThreshold(item);
	  const isLocked    = !levelOk || !thresholdOk;
	  row.className = 'item-row' + (isLocked ? ' item-locked' : '');
      if (equipped[activeSlot] && equipped[activeSlot].id === item.id) row.classList.add('active');
      const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
      const rarLabel = (RARITIES[item.rarity] || { label: item.rarity }).label;
      row.innerHTML =
        '<div class="item-thumb">' +
          (item.img ? '<img src="' + item.img + '" alt="' + item.name + '">' : '<span>📦</span>') +
          '<div class="item-thumb-bar" style="background:' + rarColor + '"></div>' +
        '</div>' +
        '<div class="item-meta">' +
          '<div class="item-meta-top">' +
            '<div class="item-meta-name">' + item.name + '</div>' +
            buildItemLevelBadgeHTML(item) +
          '</div>' +
        '<div class="item-meta-rarity" style="color:' + rarColor + '">' + rarLabel + ' · Palier ' + item.palier + '</div>' +
        buildClassBadgesHTML(item) +
        buildItemStatsHTML(item) +
		buildThresholdHTML(item) +
        '</div>';

    	if (!isLocked) {
			row.addEventListener('click', function() {
				if (equipped[activeSlot] && equipped[activeSlot].id === item.id) {
    				clearSlot(activeSlot);
					} else {
						clearRunesForSlot(activeSlot);

						// ← Vérifier si l'ancien item était 2 mains avant de le remplacer
						const previousItem = equipped[activeSlot];
						const prevOffSlotId = findOffhandSlotId(previousItem);

						equipped[activeSlot] = item;

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
						redrawSlot(activeSlot);
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
    const carDef = CARACTERISTIQUES.find(function(c) { return c.id === e[0]; });
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
  const STORAGE_KEY = 'vcl_atelier';

	function saveToStorage() {
	const equippedIds = {};
	Object.entries(equipped).forEach(function(e) {
		if (e[1]) equippedIds[e[0]] = e[1].id;
	});
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({
		v: 1, sig: SIG,
		name: document.getElementById('inp-name').value.trim(),
		classe: activeClass || '',
		level: buildLevel,
		caracterPoints: caracterPoints,
		slots: equippedIds,
		runes: equippedRunes,
		}));
	} catch(e) {}
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
              RUNES.find(function(r) { return r.id === runeId; }) &&
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
    localStorage.removeItem(STORAGE_KEY);
    buildGrid();
    buildLevelPanel();
    renderStats();
    renderPickerInfo();
    renderItemList();
    closeModal();
	filterStats = new Set();
	document.querySelectorAll('.stat-row.stat-filtered')
	.forEach(function(r) { r.classList.remove('stat-filtered'); });
  });

  /* ══ FERMETURE MODALE ══ */
  document.getElementById('btn-modal-close').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  /* ══ RECHERCHE ══ */
  document.getElementById('inp-search').addEventListener('input', function(e) {
    filterQ = e.target.value.trim();
    renderItemList();
  });

  document.getElementById('inp-name').addEventListener('input', function() {
    saveToStorage();
  });

  /* ══ RESIZE ══ */
  function fitGrid() {
    const header = document.querySelector('.site-header');
    const page   = document.querySelector('.page');
    if (!header || !page) return;

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
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sig === SIG && parsed.v === 1 && parsed.slots) {

          Object.entries(parsed.slots).forEach(function(e) {
            const item = ITEMS.find(function(i) { return i.id === e[1]; });
            if (item) equipped[e[0]] = item;
          });

          if (parsed.runes && typeof parsed.runes === 'object') {
            Object.entries(parsed.runes).forEach(function(e) {
              const runeKey = e[0]; const runeId = e[1];
              if (
                RUNES.find(function(r) { return r.id === runeId; }) &&
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
        }
      }
    } catch(e) { }

    renderStats();
    renderPickerInfo();
	requestAnimationFrame(function() {
		fitGrid();
		requestAnimationFrame(fitGrid);
	});
    if (window.ResizeObserver) {
      new ResizeObserver(fitGrid).observe(document.querySelector('.site-header'));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();