/* Libellé d'un palier d'après config/paliers (window._vcl_paliers, chargée par store.js) : « Palier 1 », « World Boss », « Archive »…
   Repli (config pas encore chargée / palier absent) : ancien format. */
function vclPalierLabel(p) {
  const cfg = (window._vcl_paliers || []).find(x => String(x.id) === String(p));
  if (cfg && cfg.label) return cfg.label;
  return p == 'event' ? 'Event' : p == -1 ? 'Archive' : p == 'worldboss' ? 'World Boss' : 'Palier ' + p;
}

(() => {
  'use strict';

  /* ══ ÉTAT ══ */
  let equipped        = {};
  let equippedRunes   = {};
  let activeSlot      = null;
  let activeRuneSlot  = null; // runeKey actif, ex. "plastron_rune_0"
  let activeRuneSlotId = null; // slotId parent de l'emplacement de rune actif
  let filterQ       = '';
  let filterRar     = null;
  let filterTier 	= null;
  let filterEvent   = null; // sous-catégorie du palier Event
  let filterEquip   = false; // n'afficher que les items équipables au niveau actuel du build
  let activeClass   = null;
  let activeTitre   = null; // id du titre choisi (config/titres) : ses stats s'ajoutent au build
  let skillNodes    = []; // arbre de compétences : clés "x,y" dans l'ordre de prise (centre offert, non listé)
  let filterStats	= new Set();
  const NUM_BUILDS   = 3;
	let activeBuildIndex = 0;
  let _rlTimer = null; // debounce renderItemList

  /* ══ HELPER ID ══ */
  // Ancien ID d'un item renommé → nouvel ID (table config/item_renames chargée par atelier.html)
  function _rid(id) { return window._vclResolveItemId ? window._vclResolveItemId(id) : id; }
  function getItemId(item) { return item && (item.id ?? item._id) || null; }

  /* ══ INDEX MAPS ══
     Lookup O(1) au lieu de N × Array.find() dans les boucles de rendu.
     Les données viennent de Compendium/data.js (chargé avant ce script). */
  const STATS_BY_ID   = new Map(ALL_STATS.map(s => [s.id, s]));
  const SLOTS_BY_ID   = new Map(ALL_SLOTS.map(s => [s.id, s]));
  let   RUNES_BY_ID   = new Map(); // peuplé dans init() depuis ITEMS (cat='rune')
  const CLASSES_BY_ID = new Map(CLASSES.map(c => [c.id, c]));
  // Cache statique — toutes les catégories d'items équipables (ne change pas)
  const _EQUIP_CATS   = new Set(ALL_SLOTS.flatMap(function(s) { return s.cats; }));

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

  /* Le palier « Event » a pour id 'event' : on le trie après les paliers numériques */
  function _palierNum(p) { return p === 'event' ? 99 : p === 'worldboss' ? 98 : (p || 0); }

  /* ══ VÉRIFICATION NIVEAU ══ */
  function itemAllowedForLevel(item, level) {
    const reqLvl = item.lvl || 1;
    return level >= reqLvl;
  }
  /* ══ TOOLTIP PANOPLIES ══ */
  function hideSetTooltip() {
    const tooltip = document.getElementById('set-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  function buildSetTooltip() {
    if (document.getElementById('set-tooltip')) return;
    const tooltip = document.createElement('div');
    tooltip.id = 'set-tooltip';
    tooltip.className = 'set-tooltip';
    document.body.appendChild(tooltip);
  }

  function showSetTooltip(e, setId) {
    const tooltip = document.getElementById('set-tooltip');
    if (!tooltip) return;
    const setDef = SETS[setId];
    if (!setDef) return;

    // Compter les items de ce set actuellement équipés
    const setCounts = computeSetCounts();
    const equipped_count = setCounts[setId] || 0;

    // Tous les items du set
    const setItems = ITEMS.filter(function(i) { return i.set === setId; });

    let html = '<div class="car-tt-header">' +
      '<span class="car-tt-name" style="color:' + setDef.color + '">◈ ' + setDef.label + '</span>' +
      '</div>';

    // Items du set
    html += '<div style="margin-bottom:6px;border-bottom:1px solid rgba(255,255,255,.06);padding-bottom:6px;">';
    setItems.forEach(function(item) {
      const isEquipped = Object.values(equipped).some(function(e) { return e && e.id === item.id; });
      const rarColor = (RARITIES[item.rarity] || {color:'#888'}).color;
      html += '<div style="display:flex;align-items:center;gap:6px;padding:2px 0;">' +
        '<span style="width:6px;height:6px;border-radius:50%;background:' + rarColor + ';flex-shrink:0;display:inline-block"></span>' +
        '<span style="font-size:10.5px;color:' + (isEquipped ? '#d7af5f' : 'rgba(255,255,255,.5)') + ';' + (isEquipped ? 'font-weight:600' : '') + '">' + item.name + '</span>' +
        (isEquipped ? '<span style="font-size:9px;color:#d7af5f;margin-left:auto">✓</span>' : '') +
        '</div>';
    });
    html += '</div>';

    // Bonus de panoplie
    html += '<div class="car-tt-stats">';
    Object.entries(setDef.bonuses).forEach(function(b) {
      const threshold = parseInt(b[0]);
      const stats = b[1];
      const isActive = equipped_count >= threshold;
      html += '<div style="margin-bottom:4px;">' +
        '<div style="font-size:9px;font-weight:700;letter-spacing:.1em;color:' + (isActive ? setDef.color : 'rgba(255,255,255,.3)') + ';margin-bottom:2px;">' +
        (isActive ? '✓ ' : '○ ') + threshold + ' pcs</div>';
      Object.entries(stats).forEach(function(sv) {
        const statDef = STATS_BY_ID.get(sv[0]);
        const label = statDef ? statDef.label : sv[0];
        const unit  = statDef ? statDef.unit  : '';
        const icon  = statDef ? statDef.icon  : '◈';
        const val   = sv[1];
        const valStr = Array.isArray(val)
          ? (val[0] === val[1] 
              ? (val[0] < 0 ? val[0] + unit : '+' + val[0] + unit)
              : (val[0] < 0 ? val[0] + '–' + val[1] + unit : '+' + val[0] + '–' + val[1] + unit))
          : (val < 0 ? val + unit : '+' + val + unit);
        html += '<div class="car-tt-stat-row" style="opacity:' + (isActive ? '1' : '0.4') + '">' +
          '<span class="car-tt-stat-icon">' + icon + '</span>' +
          '<span class="car-tt-stat-label">' + label + '</span>' +
          '<span class="car-tt-stat-val" style="color:' + setDef.color + '">' + valStr + '</span>' +
          '</div>';
      });
      html += '</div>';
    });
    html += '</div>';

    tooltip.style.width = '';
    tooltip.innerHTML = html;
    tooltip.classList.add('visible');
    positionTooltip(e, tooltip);
  }

  function hideSetTooltip() {
    const tooltip = document.getElementById('set-tooltip');
    if (tooltip) tooltip.classList.remove('visible');
  }

  // Survol d'un emplacement équipé : nom, rareté et stats de l'item
  function showSlotTooltip(e, item) {
    const tooltip = document.getElementById('set-tooltip');
    if (!tooltip || !item) return;
    const rar = RARITIES[item.rarity] || { color: '#888', label: item.rarity || '' };
    tooltip.style.width = item.competence ? '320px' : '';
    tooltip.innerHTML = '<div class="car-tt-header"><span class="car-tt-name" style="color:' + rar.color + '">' + item.name + '</span></div>' +
      '<div style="font-size:10px;color:rgba(255,255,255,.45);margin-bottom:6px;">' + rar.label + ' · ' + vclPalierLabel(item.palier) + '</div>' +
      '<div class="car-tt-stats">' + (buildItemStatsHTML(item) || '<div style="font-size:10px;color:rgba(255,255,255,.35)">Aucune statistique</div>') + '</div>' +
      buildSkillBoxHTML(item);
    tooltip.classList.add('visible');
    positionTooltip(e, tooltip);
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

  function positionTooltip(e, tooltip) {
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
	lvlNum.dataset.nostep = '1';   // a déjà ses boutons − / +
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
	lvlNum.addEventListener('input', function() {
		// Debounce rapid +/- key holds
		clearTimeout(_rlTimer);
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

    updateLevelUI();
  }

  function updateLevelUI() {
    const numEl = document.getElementById('level-num');
	if (numEl) numEl.value = buildLevel;

    const fill = document.getElementById('level-progress-fill');
    if (fill) fill.style.width = ((buildLevel / MAX_LEVEL) * 100) + '%';

  }

  function changeLevelBy(delta) {
    const newLevel = Math.max(1, Math.min(MAX_LEVEL, buildLevel + delta));
    if (newLevel === buildLevel) return;

    if (delta < 0) {
      const itemsAtRisk = Object.keys(equipped).filter(slotId => {
        const item = equipped[slotId];
        return item && !itemAllowedForLevel(item, newLevel);
      });

      if (itemsAtRisk.length > 0) {
        openLevelChangeModal(newLevel, itemsAtRisk);
        return;
      }
    }

    applyLevelChange(newLevel);
  }

  function openLevelChangeModal(newLevel, itemsAtRisk) {
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
      applyLevelChange(newLevel, itemsAtRisk);
      closeModal();
    };

    document.getElementById('modal').classList.add('open');
  }

  function applyLevelChange(newLevel, itemsAtRisk) {
    buildLevel = newLevel;
    _setSkillNodes(skillNodes);

    if (itemsAtRisk && itemsAtRisk.length) {
      itemsAtRisk.forEach(slotId => {
        delete equipped[slotId];
        clearRunesForSlot(slotId);
        redrawSlot(slotId);
      });
    }

    updateLevelUI();
    renderStats();
    clearTimeout(_rlTimer);
    _rlTimer = setTimeout(renderItemList, 80);
    saveToStorage();
	updateSkinClass();
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
          const rune    = runeId ? (RUNES_BY_ID.get(runeId) || _hiddenCache.get(runeId)) : null;
          const orb = document.createElement('div');
          const isActiveOrb = activeRuneSlot === runeKey;
          orb.className = 'rune-orb' +
            (rune ? ' rune-orb-filled' : ' rune-orb-empty') +
            (isActiveOrb ? ' rune-orb-active' : '');
          if (rune) {
            const runeColor = rune.color || getRarityColor(rune.rarity);
            orb.style.borderColor = runeColor;
            orb.style.setProperty('--rune-glow', runeColor + '55');
            orb.title = rune.name;
            const orbRuneId = getItemId(rune);
            const runeImg = getItemImg(rune) || (orbRuneId ? '../img/compendium/textures/items/Runes/' + orbRuneId + '.png' : null);
            if (runeImg) {
              const img = document.createElement('img');
              img.src = runeImg; img.alt = rune.name;
              img.onerror = function() { this.style.display = 'none'; };
              orb.appendChild(img);
            } else {
              orb.textContent = '💎';
            }
          } else {
            orb.textContent = '+';
          }
          orb.addEventListener('click', function(e) {
            e.stopPropagation();
            selectRuneSlot(runeKey, slotDef.id);
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

  /* ══ SÉLECTION D'EMPLACEMENT DE RUNE ══ */
  function selectRuneSlot(runeKey, parentSlotId) {
    const prevSlotId = activeRuneSlotId;
    if (activeRuneSlot === runeKey) {
      activeRuneSlot   = null;
      activeRuneSlotId = null;
    } else {
      activeRuneSlot   = runeKey;
      activeRuneSlotId = parentSlotId;
    }
    activeSlot = null;
    document.querySelectorAll('.slot').forEach(function(el) { el.classList.remove('active'); });
    if (prevSlotId) redrawSlot(prevSlotId);
    if (activeRuneSlotId && activeRuneSlotId !== prevSlotId) redrawSlot(activeRuneSlotId);
    renderPickerInfo();
    renderItemList();
  }

  function clearRunesForSlot(slotId) {
    Object.keys(equippedRunes).forEach(function(key) {
      if (key.startsWith(slotId + '_rune_')) delete equippedRunes[key];
    });
  }

  // Garde les runes qui tiennent dans newCount emplacements, supprime le reste.
  function trimRunesForSlot(slotId, newCount) {
    Object.keys(equippedRunes).forEach(function(key) {
      if (!key.startsWith(slotId + '_rune_')) return;
      const idx = parseInt(key.split('_rune_')[1], 10);
      if (isNaN(idx) || idx >= (newCount || 0)) delete equippedRunes[key];
    });
  }

  /* ══ STATS ══ */
  function buildStatsUI() {
    const list = document.getElementById('stats-list');
    list.innerHTML = '';

    // Liste à plat, dans l'ordre du panneau « Statistiques » du jeu (STAT_DISPLAY_ORDER) ; les stats non listées suivent à la fin.
    const order = (typeof STAT_DISPLAY_ORDER !== 'undefined') ? STAT_DISPLAY_ORDER : [];
    const rank = id => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
    const ordered = ALL_STATS.map(function(stat, i) { return { stat: stat, i: i }; })
      .sort(function(a, b) { return rank(a.stat.id) - rank(b.stat.id) || a.i - b.i; })
      .map(function(x) { return x.stat; });
    ordered.forEach(stat => {
        const row = document.createElement('div');
        row.className = 'stat-row';
        row.dataset.statId = stat.id;
        row.innerHTML =
          '<span class="stat-value" id="sv-' + stat.id + '">—</span>' +
          '<div class="stat-bar-wrap"><div class="stat-bar-fill" id="sb-' + stat.id + '" style="width:0%"></div></div>' +
          '<span class="stat-icon">' + stat.icon + '</span>' +
          '<span class="stat-name">' + stat.label + '</span>';
        list.appendChild(row);
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
      const rune = RUNES_BY_ID.get(runeId) || _hiddenCache.get(runeId);
      if (!rune) return;
      Object.entries(rune.stats || {}).forEach(function(sv) {
        const sid = sv[0]; const val = sv[1];
        if (!(sid in mins)) return;
        mins[sid] += val;
        maxs[sid] += val;
      });
    });

    /* ── Stats de base de la classe (niveau 1, sans équipement) ── */
    const _base = (typeof CLASS_BASE_STATS !== 'undefined' && activeClass) ? CLASS_BASE_STATS[activeClass] : null;
    if (_base) {
      Object.entries(_base).forEach(function(e) {
        if (!(e[0] in mins)) return;
        mins[e[0]] += e[1];
        maxs[e[0]] += e[1];
      });
    }

    /* ── Gains de la classe à chaque niveau (niveau 1 = aucun, niveau N = N-1 montées) ── */
    const _gains = (typeof CLASS_LEVEL_GAINS !== 'undefined' && activeClass) ? CLASS_LEVEL_GAINS[activeClass] : null;
    if (_gains && buildLevel > 1) {
      Object.entries(_gains).forEach(function(e) {
        if (!(e[0] in mins)) return;
        const v = e[1] * (buildLevel - 1);
        mins[e[0]] += v;
        maxs[e[0]] += v;
      });
    }

    /* ── Bonus du titre ── */
    const _ti = _titreById(activeTitre);
    if (_ti) {
      Object.entries(_ti.stats || {}).forEach(function(e) {
        const v = +e[1] || 0;
        if (!(e[0] in mins)) return;
        mins[e[0]] += v;
        maxs[e[0]] += v;
      });
    }

    /* ── Bonus de l'arbre de compétences ── */
    if (window.VCLSkillTree) {
      const sk = window.VCLSkillTree.statsFor(skillNodes, activeClass);
      Object.keys(sk).forEach(function(sid) {
        if (!(sid in mins)) return;
        mins[sid] += sk[sid];
        maxs[sid] += sk[sid];
      });
    }

    return { mins, maxs, setCounts };
  }

  /* ══ ARBRE DE COMPÉTENCES — état ══ */
  function _setSkillNodes(nodes) {
    skillNodes = window.VCLSkillTree
      ? window.VCLSkillTree.sanitize(nodes, window.VCLSkillTree.maxPoints(buildLevel))
      : [];
  }
  function _applySkillNodes(nodes) {
    _setSkillNodes(nodes);
    renderStats();
    saveToStorage();
  }
  window.addEventListener('vcl:skilltree-effects', function() { renderStats(); });
  window._atelierSkills = {
    getNodes: function() { return skillNodes.slice(); },
    setNodes: _applySkillNodes,
    getLevel: function() { return buildLevel; },
    getClass: function() { return activeClass; },
  };

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
        const sg = n => (+n < 0 ? String(n) : '+' + n);   // valeur négative : « -0.6 », pas « +-0.6 »
        const valStr = Array.isArray(val)
          ? (val[0] === val[1] ? sg(val[0]) + unit : sg(val[0]) + '–' + val[1] + unit)
          : sg(val) + unit;
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
      // Stats générales : la vitesse d'attaque s'affiche en % (sur les items elle est en /s)
      const unitTot = stat.id === 'vitesse_attaque' ? '%' : stat.unit;

      if (hi === 0 && lo === 0) {
		valEl.innerHTML = '—';
		valEl.className = 'stat-value';
	  } else if (lo === hi) {
		valEl.innerHTML = '<span style="' + (lo < 0 ? 'color:#d9614a' : '') + '">' + lo + unitTot + '</span>';
		valEl.className = 'stat-value nonzero';
	  } else {
		valEl.innerHTML =
			'<span class="sv-hi"' + (hi < 0 ? ' style="color:#d9614a"' : '') + '>' + hi + unitTot + '</span>' +
			'<span class="sv-lo"' + (lo < 0 ? ' style="color:#d9614a"' : '') + '>' + lo + unitTot + '</span>';
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
    // TWO_HANDED_PAIRS lie des catégories (arme_p → arme_s), pas des ids de slot (arme_pr / arme_sec)
    const offSlot = ALL_SLOTS.find(function(sl) { return sl.cats.includes(offCat); });
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
    if (window._previewMode) return;
    if (getBlockedSlots().has(slotId)) return;
    const prevRuneSlotId = activeRuneSlotId;
    activeRuneSlot   = null;
    activeRuneSlotId = null;
    if (prevRuneSlotId) redrawSlot(prevRuneSlotId);
    activeSlot = (activeSlot === slotId) ? null : slotId;
    document.querySelectorAll('.slot').forEach(function(el) {
      el.classList.toggle('active', el.dataset.slotId === activeSlot);
    });
    renderPickerInfo();
    renderItemList();
    if (window.innerWidth <= 768) {
      document.dispatchEvent(new CustomEvent('atelier:slotSelected', { detail: { active: !!activeSlot } }));
    }
  }

  document.addEventListener('atelier:deselectSlot', function() {
    if (!activeSlot && !activeRuneSlot) return;
    activeSlot = null;
    activeRuneSlot = null;
    activeRuneSlotId = null;
    document.querySelectorAll('.slot').forEach(function(el) { el.classList.remove('active'); });
    renderPickerInfo();
    renderItemList();
  });

  function findBestRuneSlot() {
    // 1) First empty rune slot among equipped items
    for (const slotId of Object.keys(equipped)) {
      const it = equipped[slotId];
      if (!it || !it.rune_slots) continue;
      for (let i = 0; i < it.rune_slots; i++) {
        const runeKey = slotId + '_rune_' + i;
        if (!equippedRunes[runeKey]) return { runeKey, slotId };
      }
    }
    // 2) Fallback: first rune slot (overwrite)
    for (const slotId of Object.keys(equipped)) {
      const it = equipped[slotId];
      if (it && it.rune_slots > 0) return { runeKey: slotId + '_rune_0', slotId };
    }
    return null;
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
    if (activeRuneSlot) {
      const orbIdx = parseInt(activeRuneSlot.split('_rune_')[1]) + 1;
      const currentRune = equippedRunes[activeRuneSlot] ? RUNES_BY_ID.get(equippedRunes[activeRuneSlot]) : null;
      box.innerHTML =
        '<div class="psi-label">Emplacement de Rune sélectionné</div>' +
        '<div class="psi-name">💎 Emplacement ' + orbIdx +
        (currentRune ? ' · <span style="opacity:.65">' + currentRune.name + '</span>' : '') + '</div>';
      return;
    }
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
    if (window._previewMode) return;
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
    if (!activeSlot || activeSlot === slotId) renderItemList();
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

	const tiers = [...new Set(ITEMS.map(i => i.palier))].sort((a, b) => { const r = (p => p == -1 ? 3 : p == 'event' ? 2 : p == 'worldboss' ? 1 : 0); return r(a) - r(b) || (Number(a) - Number(b) || 0); });

	const all = document.createElement('button');
	all.className = 'rarity-chip active';
	all.textContent = 'Tout';
	all.dataset.t = '';
	wrap.appendChild(all);

	tiers.forEach(function(t) {
	const btn = document.createElement('button');
	btn.className = 'rarity-chip';
	btn.dataset.t = t;
	btn.textContent = vclPalierLabel(t);
	wrap.appendChild(btn);
	});

	wrap.addEventListener('click', function(e) {
	const chip = e.target.closest('.rarity-chip');
	if (!chip || !('t' in chip.dataset)) return;
	filterTier = chip.dataset.t !== '' ? (isNaN(chip.dataset.t) ? chip.dataset.t : parseInt(chip.dataset.t)) : null;
	wrap.querySelectorAll('.rarity-chip').forEach(c => c.classList.remove('active'));
	chip.classList.add('active');
	filterEvent = null;
	buildEventFilter();
	renderItemList();
	});
	buildEventFilter();
	}

  // Interrupteur « Équipables » : n'affiche que les items utilisables au niveau actuel du build (activable / désactivable)
  function buildEquipFilter() {
    if (document.getElementById('equip-wrap')) return;
    const anchor = document.getElementById('filters-wrap');
    if (!anchor) return;
    try { filterEquip = localStorage.getItem('vcl_atelier_equip') === '1'; } catch (e) {}
    const wrap = document.createElement('div');
    wrap.id = 'equip-wrap';
    wrap.className = 'picker-filters-wrap';
    const btn = document.createElement('button');
    btn.className = 'rarity-chip equip-chip' + (filterEquip ? ' active' : '');
    btn.textContent = '⚔ Équipables';
    btn.title = "Activé : masque les items dont le niveau requis dépasse le niveau du build";
    btn.setAttribute('aria-pressed', String(filterEquip));
    btn.addEventListener('click', function() {
      filterEquip = !filterEquip;
      btn.classList.toggle('active', filterEquip);
      btn.setAttribute('aria-pressed', String(filterEquip));
      try { localStorage.setItem('vcl_atelier_equip', filterEquip ? '1' : '0'); } catch (e) {}
      renderItemList();
    });
    wrap.appendChild(btn);
    anchor.insertAdjacentElement('afterend', wrap);
  }

  // Sous-catégories par évènement, visibles quand le palier « Event » est sélectionné
  function buildEventFilter() {
    let wrap = document.getElementById('event-wrap');
    if (!wrap) {
      const tw = document.getElementById('tier-wrap');
      if (!tw) return;
      wrap = document.createElement('div');
      wrap.id = 'event-wrap';
      wrap.className = 'tier-wrap picker-filters-wrap';
      tw.insertAdjacentElement('afterend', wrap);
      wrap.addEventListener('click', function(e) {
        const chip = e.target.closest('.rarity-chip');
        if (!chip) return;
        filterEvent = chip.dataset.e !== '' ? chip.dataset.e : null;
        wrap.querySelectorAll('.rarity-chip').forEach(c => c.classList.toggle('active', c === chip));
        renderItemList();
      });
    }
    wrap.innerHTML = '';
    if (filterTier !== 'event' && filterTier !== 'worldboss') { wrap.style.display = 'none'; return; }
    const names = [...new Set(ITEMS.filter(i => i.palier === filterTier && typeof i.event === 'string' && i.event).map(i => i.event))]
      .sort((a, b) => { const r = n => { const i = EVENT_NAMES.indexOf(n); return i < 0 ? 999 : i; }; return r(a) - r(b) || a.localeCompare(b, 'fr'); });
    wrap.style.display = '';
    [['', filterTier === 'worldboss' ? 'Tous les world boss' : 'Tous les évènements']].concat(names.map(n => [n, n])).forEach(function(e) {
      const btn = document.createElement('button');
      btn.className = 'rarity-chip' + ((filterEvent || '') === e[0] ? ' active' : '');
      btn.dataset.e = e[0];
      btn.textContent = e[1];
      wrap.appendChild(btn);
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
			const statsObj = item.stats || {};
			const orderedEntries = [];
			const seen = new Set();
			for (const group of STAT_GROUPS) {
				for (const stat of group.stats) {
					if (stat.id in statsObj) { orderedEntries.push([stat.id, statsObj[stat.id]]); seen.add(stat.id); }
				}
			}
			for (const pair of Object.entries(statsObj)) { if (!seen.has(pair[0])) orderedEntries.push(pair); }
			const entries = orderedEntries.filter(function(e) {
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

			if (!lines && !runeSlotLine) return '';

			return '<div class="istat-block">' + lines + runeSlotLine + '</div>';
	}

  // Encadré « compétence » des armes : blocs séparés par une ligne vide, 1re ligne « Titre: » en gras
  function buildSkillBoxHTML(item) {
    const raw = typeof item.competence === 'string' ? item.competence.trim() : '';
    if (!raw) return '';
    const esc = function(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); };
    const blocks = raw.split(/\n\s*\n/).map(function(block) {
      const lines = block.split('\n');
      const first = lines[0].trim();
      const hasTitle = lines.length > 1 && /:$/.test(first);
      return '<div class="item-skill-block">' +
        (hasTitle ? '<div class="item-skill-title">' + esc(first.slice(0, -1)) + '</div>' : '') +
        '<div class="item-skill-text">' + esc((hasTitle ? lines.slice(1) : lines).join('\n').trim()).replace(/\n/g, '<br>') + '</div>' +
        '</div>';
    }).join('');
    return '<div class="item-skill-box">' + blocks + '</div>';
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

    // Badge deux mains
    if (item.twoHanded) {
      badges += '<span class="item-class-badge">⚔️ Deux mains</span>';
    }

    // Badge de set
    if (item.set) {
      const setDef = SETS[item.set];
      const color = setDef ? setDef.color : '#888';
      const label = setDef ? setDef.label : item.set;
      badges += '<span class="item-set-badge" data-set-id="' + item.set + '" style="border-color:' + color + '60;color:' + color + '">◈ ' + label + '</span>';
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

  function matchesSetSearch(item, normalizedQuery) {
    if (!item.set) return false;
    const setDef = SETS[item.set];
    if (!setDef) return false;
    return fuzzyMatch(normalizedQuery, setDef.label);
  }

  function renderItemList() {
    const list = document.getElementById('items-list');
    const q    = normalize(filterQ);

    // Filtre « Équipables » : masque les items dont le niveau requis dépasse celui du build
    const equipFilter = function(item) { return !filterEquip || itemAllowedForLevel(item, buildLevel); };

    const statsFilter = function(item) {
      return filterStats.size === 0 || [...filterStats].every(function(sid) {
        if (!item.stats) return false;
        const val = item.stats[sid];
        if (val === undefined) return false;
        // Ignorer les valeurs négatives (ex: malus de vitesse)
        const v = Array.isArray(val) ? val[1] : val;
        return v > 0;
      });
    };

    /* ── Mode rune : affiche les items cat='rune' ── */
    if (activeRuneSlot) {
      const runes = ITEMS.filter(function(item) {
        return (item.cat === 'rune' || item.category === 'rune') &&
          (!filterRar  || item.rarity === filterRar) &&
          (filterTier === null || item.palier === filterTier) &&
          (filterEvent === null || item.event === filterEvent) &&
          equipFilter(item) &&
          (!q || fuzzyMatch(q, item.name)) &&
          statsFilter(item);
      });
      // Injecter les runes sensibles du cache (même logique que les autres items sensibles)
      if (q) {
        _hiddenCache.forEach(function(item) {
          if (item.cat !== 'rune' && item.category !== 'rune') return;
          if (normalize(item.name) !== q) return;
          if (!runes.some(function(v) { return v.id === item.id; })) runes.push(item);
        });
      }
      runes.sort(function(a, b) {
        if (_palierNum(a.palier) !== _palierNum(b.palier)) return _palierNum(a.palier) - _palierNum(b.palier);
        return (a.ordre ?? 999) - (b.ordre ?? 999);
      });
      if (!runes.length) {
        list.innerHTML = '<div class="picker-empty-msg">Aucune rune disponible</div>';
        return;
      }
      list.innerHTML = '';
      const _runesFrag = document.createDocumentFragment();
      runes.forEach(function(rune) {
        const rid = getItemId(rune);
        if (!rid) return;
        const row = document.createElement('div');
        const isActive = equippedRunes[activeRuneSlot] === rid;
        row.className = 'item-row' + (isActive ? ' active' : '');
        const rarColor = (RARITIES[rune.rarity] || { color: '#888' }).color;
        const rarLabel = (RARITIES[rune.rarity] || { label: rune.rarity }).label;
        const imgSrc = getItemImg(rune) || ('../img/compendium/textures/items/Runes/' + rid + '.png');
        row.innerHTML =
          '<div class="item-thumb">' +
            '<img src="' + imgSrc + '" alt="' + rune.name + '" onerror="this.style.display=\'none\'">' +
            '<div class="item-thumb-bar" style="background:' + rarColor + '"></div>' +
          '</div>' +
          '<div class="item-meta">' +
            '<div class="item-meta-top"><div class="item-meta-name">' + rune.name + (_isSecretItem(rune) ? ' <span class="sensible-tag" title="Visible grâce à votre rôle">🔒</span>' : '') + '</div></div>' +
            '<div class="item-meta-rarity" style="color:' + rarColor + '">' + rarLabel + '</div>' +
            buildItemStatsHTML(rune) +
          '</div>';
        row.addEventListener('click', function() {
          if (equippedRunes[activeRuneSlot] === rid) {
            delete equippedRunes[activeRuneSlot];
          } else {
            equippedRunes[activeRuneSlot] = rid;
          }
          if (activeRuneSlotId) redrawSlot(activeRuneSlotId);
          renderStats();
          renderItemList();
          saveToStorage();
        });
        _runesFrag.appendChild(row);
      });
      list.appendChild(_runesFrag);
      return;
    }

    let visible;
    if (!activeSlot) {
      // Mode "tous les items" — armes / armures / accessoires + runes
      visible = ITEMS.filter(function(item) {
        return (_EQUIP_CATS.has(item.cat) || item.cat === 'rune' || item.category === 'rune') &&
          itemAllowedForClass(item, activeClass) &&
          (!filterRar  || item.rarity === filterRar) &&
          (filterTier === null || item.palier === filterTier) &&
          (filterEvent === null || item.event === filterEvent) &&
          equipFilter(item) &&
          (!q || fuzzyMatch(q, item.name) || matchesSetSearch(item, q)) &&
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
          (filterEvent === null || item.event === filterEvent) &&
        equipFilter(item) &&
        (!q || fuzzyMatch(q, item.name) || matchesSetSearch(item, q)) &&
        statsFilter(item);
      });
    }
    // Injecter les items sensibles depuis le cache local (jamais dans ITEMS global)
    // Visibles uniquement si la recherche correspond exactement au nom
    if (q) {
      _hiddenCache.forEach(function(item) {
        if (normalize(item.name) !== q) return;
        const isRune = item.cat === 'rune' || item.category === 'rune';
        if (activeSlot && !SLOTS_BY_ID.get(activeSlot)?.cats.includes(item.cat)) return;
        if (!activeSlot && !_EQUIP_CATS.has(item.cat) && !isRune) return;
        if (!visible.some(function(v) { return v.id === item.id; })) visible.push(item);
      });
    }

    if (!visible.length) {
      list.innerHTML = '<div class="picker-empty-msg">Aucun item compatible</div>';
      return;
    }

    visible.sort(function(a, b) {
      if (a.palier !== b.palier) return _palierNum(a.palier) - _palierNum(b.palier);
      const ao = a.ordre ?? null;
      const bo = b.ordre ?? null;
      if (ao !== null && bo !== null) return ao - bo;
      if (ao !== null) return -1;
      if (bo !== null) return 1;
      return 0;
    });

    list.innerHTML = '';
    const _frag = document.createDocumentFragment();
    visible.forEach(function(item) {
      const row = document.createElement('div');
      const levelOk = itemAllowedForLevel(item, buildLevel);
	  const isLocked    = !levelOk;
	  row.className = 'item-row' + (isLocked ? ' item-locked' : '');
      // Actif si équipé dans le slot actif (ou dans n'importe quel slot si vue globale)
      const isActive = activeSlot
        ? (equipped[activeSlot] && equipped[activeSlot].id === item.id)
        : Object.values(equipped).some(function(e) { return e && e.id === item.id; });
      if (isActive) row.classList.add('active');
      const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
      const rarLabel = (RARITIES[item.rarity] || { label: item.rarity }).label;
      const _itemImg = getItemImg(item) || ((item.cat === 'rune' || item.category === 'rune') ? '../img/compendium/textures/items/Runes/' + (getItemId(item) || '') + '.png' : null);
      row.innerHTML =
        '<div class="item-thumb">' +
          (_itemImg ? '<img src="' + _itemImg + '" alt="' + item.name + '" onerror="this.style.display=\'none\'">' : '<span>📦</span>') +
          '<div class="item-thumb-bar" style="background:' + rarColor + '"></div>' +
        '</div>' +
        '<div class="item-meta">' +
          '<div class="item-meta-top">' +
            '<div class="item-meta-name">' + item.name + (_isSecretItem(item) ? ' <span class="sensible-tag" title="Visible grâce à votre rôle">🔒</span>' : '') + '</div>' +
            buildItemLevelBadgeHTML(item) +
          '</div>' +
        '<div class="item-meta-rarity" style="color:' + rarColor + '">' + rarLabel + ' · ' + vclPalierLabel(item.palier) + '</div>' +
        buildBadgesHTML(item) +
        buildItemStatsHTML(item) +
        buildSkillBoxHTML(item) +
        '</div>';

    	if (!isLocked) {
			row.addEventListener('click', function() {
				// Rune sans slot actif → auto-équiper au meilleur emplacement de rune
				if ((item.cat === 'rune' || item.category === 'rune') && !activeRuneSlot) {
					const rid = getItemId(item);
					if (!rid) return;
					const existingKey = Object.keys(equippedRunes).find(function(k) { return equippedRunes[k] === rid; });
					if (existingKey) {
						delete equippedRunes[existingKey];
						redrawSlot(existingKey.split('_rune_')[0]);
					} else {
						const best = findBestRuneSlot();
						if (!best) return;
						equippedRunes[best.runeKey] = rid;
						redrawSlot(best.slotId);
					}
					saveToStorage();
					renderStats();
					renderItemList();
					return;
				}
				// En vue globale, trouver le meilleur slot pour cet item
				const targetSlot = activeSlot || findBestSlotForItem(item);
				if (!targetSlot) return;

				if (equipped[targetSlot] && equipped[targetSlot].id === item.id) {
    				clearSlot(targetSlot);
				} else {
					trimRunesForSlot(targetSlot, item.rune_slots || 0);

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
      _frag.appendChild(row);
    });
    list.appendChild(_frag);
  }

  /* ══ PERSISTANCE localStorage ══ */
  const SIG = "🌙𝓥𝓮𝓲𝓵𝓵𝓮𝓾𝓻𝓼 𝓪𝓾 𝓒𝓵𝓪𝓲𝓻 𝓭𝓮 𝓛𝓾𝓷𝓮🌙";
  const STORAGE_KEY_BASE = 'vcl_atelier';
	const META_KEY         = 'vcl_atelier_meta';

	function getBuildKey(idx) {
		return STORAGE_KEY_BASE + '_' + idx;
	}

  window._vclGetBuildKey      = getBuildKey;
  window._vclGetBuildKey(activeBuildIndex);

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
      window._vclActiveBuildIndex = activeBuildIndex;
		} catch(e) { activeBuildIndex = 0; }
	})();

	/* Instantané des stats max du build courant (même format que statsSnapshot publié) — lu par le comparateur */
	function _statsSnapshot() {
		const snap = {};
		try {
			const maxs = computeStats().maxs;
			Object.keys(maxs).forEach(function(k) {
				if (typeof maxs[k] === 'number' && maxs[k] !== 0) snap[k] = Math.round(maxs[k] * 100) / 100;
			});
		} catch (e) {}
		return snap;
	}

	function saveToStorage() {
		if (window._previewMode) return;
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
				skillNodes: skillNodes,
				titre: activeTitre || '',
				slots: equippedSlots,
				runes: equippedRunes,
				stats: _statsSnapshot(),
			}));
			localStorage.setItem(META_KEY, JSON.stringify({ active: activeBuildIndex }));
			window._vclActiveBuildKey = getBuildKey(activeBuildIndex);
      window._vclGetBuildKey(activeBuildIndex);
      window._vclActiveBuildIndex = activeBuildIndex;
			window.dispatchEvent(new CustomEvent('vcl:stuffChanged'));
			updateBuildTabs();
		} catch(e) {}
	}

	

	function loadBuild(idx) {
		// Sauvegarde le build actuel avant de switcher
		saveToStorage();

		activeBuildIndex = idx;
    window._vclGetBuildKey(idx);
		window._vclActiveBuildKey = getBuildKey(idx);
    window._vclActiveBuildIndex = idx;
		localStorage.setItem(META_KEY, JSON.stringify({ active: idx }));

		// Reset état
		equipped = {};
		equippedRunes = {};
		activeSlot = null;
		buildLevel = 1;
		skillNodes = [];
		activeTitre = null;

		const sensiblePending = [];
		try {
			const raw = localStorage.getItem(getBuildKey(idx));
			if (raw) {
				const parsed = JSON.parse(raw);
				if (parsed.sig === SIG && parsed.slots) {
					Object.entries(parsed.slots).forEach(function(e) {
						const slotId = e[0];
						const entry  = e[1];
						const itemId   = typeof entry === 'string' ? entry : entry.id;
						const itemName = typeof entry === 'string' ? null  : entry.name;
						const item     = ITEMS.find(function(i) { return i.id === itemId; });
						if (item) {
							equipped[slotId] = item;
						} else if (itemId && _hiddenCache.has(itemId)) {
							equipped[slotId] = _hiddenCache.get(itemId);
						} else if (itemName) {
							sensiblePending.push({ slotId: slotId, name: itemName, id: itemId });
						}
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
					_setSkillNodes(parsed.skillNodes);
          _setTitre(parsed.titre);
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

		// Restauration asynchrone des items sensibles (absents de ITEMS et du cache)
		if (sensiblePending.length) {
			const pendingForBuild = idx;
			sensiblePending.forEach(function(pending) {
				(function(slotId, rawName, savedId) {
					var api = window.VCL_DB;
					if (!api || !api.getHiddenByName) return;
					// getHiddenByName = getDoc par hash (fonctionne pour non-contribs)
					const fetchHidden = api.getHiddenByName(api.COL.itemsHidden, rawName)
						.then(function(hits) { return hits && hits[0] || null; });
					fetchHidden.then(async function(hit) {
						if (!hit) return;
						if (!_hiddenCache.has(hit.id)) {
							if (hit.id && api.getSecretById) {
								const secret = await api.getSecretById(api.COL.itemsSecret, hit.id);
								if (secret) Object.assign(hit, secret);
							}
							if (!hit.images?.length && !hit.image && !hit.img) {
								const builtImg = _sensibleImg(hit.category || hit.cat, hit.id, hit.palier, hit.event);
								if (builtImg) { hit.img = builtImg; hit.images = [builtImg]; }
							}
							_hiddenCache.set(hit.id, hit);
						}
						// L'utilisateur a peut-être changé de build entre-temps : ne réinjecte que si on est encore sur le bon
						if (activeBuildIndex !== pendingForBuild) return;
						equipped[slotId] = _hiddenCache.get(hit.id);
						buildGrid();
						renderStats();
						renderPickerInfo();
						window.dispatchEvent(new CustomEvent('vcl:stuffChanged'));
					}).catch(function() {});
				})(pending.slotId, pending.name, pending.id);
			});
		}
	}

	/* Mode « calcul des stats » (page ouverte en iframe cachée par le comparateur, ?vcl_stats=0,1…) :
	   les builds enregistrés avant l'ajout de `stats` n'en ont pas ; on ouvre chacun des index demandés, on le sauvegarde
	   (saveToStorage écrit les stats), puis on revient au build actif. Retourne les index complétés. */
	window._vclFillStats = async function (only) {
		const orig = activeBuildIndex, filled = [];
		for (let w = 0; w < 80 && window._vclTitres === undefined; w++) await new Promise(function (r) { setTimeout(r, 100); });   // les titres (stats du titre) se chargent en asynchrone
		await new Promise(function (r) { setTimeout(r, 1500); });   // laisse finir l'initialisation de la page (sinon le titre manque dans les stats)
		for (let i = 0; i < NUM_BUILDS; i++) {
			if (only && only.length && only.indexOf(i) < 0) continue;
			let p = null;
			try { p = JSON.parse(localStorage.getItem(getBuildKey(i)) || 'null'); } catch (e) {}
			if (!p || (!p.classe && !Object.keys(p.slots || {}).length)) continue;
			loadBuild(i);
			await new Promise(function (r) { setTimeout(r, 1000); });   // items sensibles restaurés en asynchrone
			if (activeBuildIndex === i) { saveToStorage(); filled.push(i); }
		}
		if (activeBuildIndex !== orig) loadBuild(orig);
		return filled;
	};

	function buildBuildTabs() {
  let bar = document.getElementById('build-tabs-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'build-tabs-bar';
    bar.style.cssText = [
      'position:absolute',
      'top:8px',
      'left:8px',
      'right:8px',
      'display:flex',
      'gap:6px',
      'z-index:10',
      'pointer-events:all',
    ].join(';');

    // Insérer DANS .mq-skin pour rester dans les bornes du cadre personnage
    const skinEl = document.getElementById('mq-skin');
    if (skinEl) {
      skinEl.style.position = 'relative';
      skinEl.appendChild(bar);
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
				'flex:1',
				'min-width:0',
				'padding:6px 4px',
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
			lbl.style.cssText = 'font-size:8px;width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:center;';
			lbl.textContent = buildName;

			btn.appendChild(num);
			btn.appendChild(lbl);

			btn.addEventListener('click', function() {
				if (window._previewMode) return;
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

		const isPreview = !!(window._previewMode || activeBuildIndex > 2);

		bar.querySelectorAll('button[data-build-idx]').forEach(function(btn) {
			const i = parseInt(btn.dataset.buildIdx);
			const isActive = !isPreview && i === activeBuildIndex;

			btn.style.background  = isActive ? 'var(--surface2)' : 'var(--surface)';
			btn.style.color       = isActive ? 'var(--gold)' : 'var(--muted)';
			btn.style.boxShadow   = isActive ? '0 0 0 1px rgba(215,175,95,.4)' : 'none';
			btn.style.borderColor = isActive ? 'var(--gold)' : 'var(--rim)';
			btn.style.opacity     = isPreview ? '0.4' : '';

			const num = btn.querySelector('span:first-child');
			if (num) num.style.color = isActive ? 'var(--gold)' : 'var(--muted)';

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
				if (isActive) {
					const inp = document.getElementById('inp-name');
					if (inp && inp.value.trim()) buildName = inp.value.trim();
				}
				lbl.textContent = buildName;
			}
		});

		// Indicateur "Aperçu" quand aucun slot n'est actif
		let ind = bar.querySelector('.preview-tab-ind');
		if (isPreview) {
			if (!ind) {
				ind = document.createElement('div');
				ind.className = 'preview-tab-ind';
				ind.style.cssText = 'padding:4px 10px;color:rgba(125,204,144,.9);font-size:9px;letter-spacing:.12em;text-transform:uppercase;border:1px solid rgba(80,200,120,.3);border-radius:3px;white-space:nowrap;align-self:center;font-family:inherit;';
				ind.textContent = '◈ Aperçu';
				bar.appendChild(ind);
			}
		} else if (ind) {
			ind.remove();
		}
	}

  /* ══ MODALES ══ */
  function openModal(mode) {
    const modal = document.getElementById('modal');
    modal.dataset.mode = mode;
    modal.classList.toggle('wide', mode === 'optimize');
    const errEl = document.getElementById('modal-error');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    ['export', 'import', 'publish', 'reset', 'confirm-class', 'confirm-level', 'optimize'].forEach(function(m) {
      const zone = document.getElementById('modal-zone-' + m);
      if (zone) zone.style.display = (m === mode) ? 'flex' : 'none';
    });
    modal.classList.add('open');
  }

  function closeModal() {
    document.getElementById('modal').classList.remove('open');
  }

  /* ══ EXPORT / IMPORT JSON ══ */
  function _buildExportPayload() {
    const slots = {};
    Object.entries(equipped).forEach(function(e) {
      if (e[1]) slots[e[0]] = getItemId(e[1]);
    });
    return { v:1, sig:SIG, name: document.getElementById('inp-name').value.trim() || 'Mon Build',
      classe: activeClass || '', level: buildLevel,
      skillNodes: skillNodes, titre: activeTitre || '', slots: slots, runes: equippedRunes };
  }

  document.getElementById('btn-export').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-export');
    if (ta) ta.value = '```json\n' + JSON.stringify(_buildExportPayload(), null, 2) + '\n```';
    document.getElementById('modal-title').textContent = '↑ Exporter — JSON';
    openModal('export');
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-export');
    if (!ta) return;
    ta.select();
    document.execCommand('copy');
    const b = this;
    b.textContent = '✓ Copié !';
    setTimeout(function() { b.textContent = '◈ Copier'; }, 1600);
  });

  document.getElementById('btn-import').addEventListener('click', function() {
    const ta = document.getElementById('modal-ta-import');
    if (ta) ta.value = '';
    const errEl = document.getElementById('modal-error');
    if (errEl) { errEl.style.display = 'none'; }
    document.getElementById('modal-title').textContent = '↓ Importer — JSON';
    openModal('import');
  });

  document.getElementById('btn-confirm-import').addEventListener('click', function() {
    const ta    = document.getElementById('modal-ta-import');
    const raw   = ta ? ta.value.trim() : '';
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    const errEl = document.getElementById('modal-error');
    if (!clean) {
      if (errEl) { errEl.textContent = '⚠ Collez un JSON valide.'; errEl.style.display = 'block'; }
      return;
    }
    try {
      const parsed = JSON.parse(clean);
      if (parsed.sig !== SIG) throw new Error('Signature invalide');
      if (parsed.v === 1 && parsed.slots) {
        equipped = {}; equippedRunes = {};
        if (parsed.level >= 1 && parsed.level <= MAX_LEVEL) buildLevel = parsed.level;
        _setSkillNodes(parsed.skillNodes);
          _setTitre(parsed.titre);
        const lvl = (parsed.level >= 1 && parsed.level <= MAX_LEVEL) ? parsed.level : buildLevel;
        Object.entries(parsed.slots).forEach(function(e) {
          const item = ITEMS.find(function(i) { return i.id === _rid(e[1]); });
          if (item && itemAllowedForLevel(item, lvl)) equipped[e[0]] = item;
        });
        if (parsed.runes) Object.entries(parsed.runes).forEach(function(e) {
          if (RUNES_BY_ID.get(e[1]) && isRuneKeyValid(e[0], equipped)) equippedRunes[e[0]] = e[1];
        });
        if (parsed.name) document.getElementById('inp-name').value = parsed.name;
        if (parsed.classe) { activeClass = parsed.classe || null; buildClassPicker(); updateSkinClass(); }
      } else { throw new Error('Format non reconnu'); }
      buildGrid(); buildLevelPanel(); saveToStorage(); renderStats(); renderPickerInfo(); renderItemList();
      closeModal();
    } catch(e) {
      if (errEl) { errEl.textContent = '✕ JSON invalide ou format non reconnu.'; errEl.style.display = 'block'; }
    }
  });

  /* ══ PUBLISH ══ */
  function _isSecretItem(item) {
    const id = getItemId(item);
    return _hiddenCache.has(id) || window._hiddenItemIds?.has(id);
  }

  function _buildPublishPayload() {
    const name = document.getElementById('inp-name').value.trim() || 'Mon Build';
    const slots = {};
    const slotImages = {};
    const sensibleSlots     = {}; // marqueur public : quels slots ont un item sensible
    const sensibleSlotsData = {}; // données complètes, stockées dans builds_sensible (contrib+ only)
    Object.entries(equipped).forEach(function(e) {
      const item = e[1];
      if (!item) return;
      const id  = getItemId(item);
      // Chemin réel de l'item d'abord (worldboss/archive/dossiers spéciaux) ; reconstruction palier+id seulement en repli
      const img = getItemImg(item) || _sensibleImg(item.category || item.cat, id, item.palier, item.event);
      if (_isSecretItem(item)) {
        // N'exposer ni l'ID ni le nom dans le doc public
        sensibleSlots[e[0]] = true;
        sensibleSlotsData[e[0]] = { id: id, name: item.name || id };
        if (img) sensibleSlotsData[e[0]].img = img;
      } else {
        slots[e[0]] = { id: id, name: item.name || id };
        if (img) slotImages[e[0]] = img;
      }
    });
    const runeNames = {};
    Object.entries(equippedRunes).forEach(function(e) {
      const rune = RUNES_BY_ID.get(e[1]);
      if (rune && rune.name) runeNames[e[0]] = rune.name;
    });
    return {
      name: name,
      classe: activeClass || '',
      level: buildLevel,
      skillNodes: skillNodes.slice(),
      titre: activeTitre || '',
      slots: slots,
      slotImages: slotImages,
      sensibleSlots: sensibleSlots,
      sensibleSlotsData: sensibleSlotsData,
      runes: Object.assign({}, equippedRunes),
      runeNames: runeNames,
    };
  }

  /* Comparateur : instantané des stats du build courant (même format que statsSnapshot), puis ouverture de la page */
  document.getElementById('btn-compare').addEventListener('click', function() {
    const maxs = computeStats().maxs;
    const snap = {};
    Object.keys(maxs).forEach(function(k) {
      if (typeof maxs[k] === 'number' && maxs[k] !== 0) snap[k] = Math.round(maxs[k] * 100) / 100;
    });
    try {
      localStorage.setItem('vcl_compare_local', JSON.stringify({
        name: document.getElementById('inp-name').value.trim() || 'Mon Build',
        classe: activeClass || '', level: buildLevel, statsSnapshot: snap,
      }));
    } catch (e) {}
    window.location.href = '../Builds/comparateur.html?ids=local';
  });

  document.getElementById('btn-publish').addEventListener('click', function() {
    if (!window._auth?.currentUser) {
      const msg = 'Connecte-toi avec Discord pour publier ton build : il sera rattaché à ton compte, partageable par lien et visible dans le forum des builds.';
      if (window.vclOpenLogin) window.vclOpenLogin(msg);
      else document.querySelector('.vcl-auth-btn, #vcl-login-btn, [data-auth-trigger]')?.click();
      return;
    }
    const currentName = document.getElementById('inp-name').value.trim();
    document.getElementById('publish-name-inp').value = currentName;
    document.getElementById('publish-error').style.display = 'none';
    document.getElementById('chk-publish-unlisted').checked = false;
    document.getElementById('publish-comment-inp').value = '';
    document.getElementById('modal-title').textContent = '◈ Publier le Build';
    openModal('publish');
  });

  document.getElementById('btn-confirm-publish').addEventListener('click', async function() {
    const name = document.getElementById('publish-name-inp').value.trim();
    const errEl = document.getElementById('publish-error');
    errEl.style.display = 'none';
    if (!name) {
      errEl.textContent = '⚠ Donnez un nom à votre build avant de publier.';
      errEl.style.display = 'block';
      return;
    }
    if (!window._auth?.currentUser) {
      errEl.textContent = '⚠ Connectez-vous pour publier.';
      errEl.style.display = 'block';
      return;
    }
    const btn = this;
    btn.disabled = true;
    btn.textContent = '…';
    try {
      const visibility = document.getElementById('chk-publish-unlisted').checked ? 'unlisted' : 'public';
      const payload = _buildPublishPayload();
      payload.name = name;
      payload.comment = document.getElementById('publish-comment-inp').value.trim();
      const stats = computeStats();
      const { publishBuild } = await import('../Builds/builds-publish.js');
      const buildId = await publishBuild({ payload, stats, visibility, auth: window._auth });
      closeModal();
      const shareUrl = window.location.origin + '/Builds/builds.html?id=' + buildId;
      _showPublishToast(name, buildId, visibility);
    } catch(e) {
      errEl.textContent = '✕ ' + (e.message || 'Erreur lors de la publication.');
      errEl.style.display = 'block';
    } finally {
      btn.disabled = false;
      btn.textContent = '◈ Publier';
    }
  });

  function _showPublishToast(name, buildId, visibility) {
    const existing = document.getElementById('vcl-publish-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'vcl-publish-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);' +
      'background:var(--surface,#1a1a2e);border:1px solid var(--rim,rgba(212,181,126,.3));' +
      'color:var(--text,#e8e0d0);padding:12px 20px;border-radius:8px;z-index:9999;' +
      'font-size:13px;display:flex;align-items:center;gap:12px;box-shadow:0 4px 20px rgba(0,0,0,.5);';
    toast.innerHTML = '<span style="color:var(--gold,#d4b57e)">✓</span>' +
      '<span>Build <strong>' + escHtml(name) + '</strong> publié' +
      (visibility === 'unlisted' ? ' (lien uniquement)' : '') + '</span>' +
      '<a href="../Builds/builds.html" style="color:var(--gold,#d4b57e);text-decoration:none;font-size:12px;">Voir les builds →</a>' +
      '<a href="../Builds/comparateur.html?ids=' + encodeURIComponent(buildId) + '" style="color:var(--gold,#d4b57e);text-decoration:none;font-size:12px;">⚖ Comparer</a>' +
      '<button onclick="this.parentElement.remove()" style="background:none;border:none;color:var(--muted,#888);cursor:pointer;padding:0 4px;">✕</button>';
    document.body.appendChild(toast);
    setTimeout(function() { toast.remove(); }, 6000);
  }


  /* ══ TITRES ══
     config/titres : { list: [{ id, name, stats: { <stat>: <valeur> } }] }, géré dans Modération > Titres. */
  function _titreById(id) {
    if (!id) return null;
    return (window._vclTitres || []).find(function(t) { return t.id === id; }) || null;
  }
  function _titreChips(t) {
    return Object.entries(t.stats || {}).map(function(e) {
      const st = STATS_BY_ID.get(e[0]);
      const v = +e[1] || 0;
      return (st ? st.label : e[0]) + ' ' + (v > 0 ? '+' : '') + v + (e[0] === 'vitesse_attaque' ? '%' : (st && st.unit ? st.unit : ''));
    });
  }
  function _renderTitreBtn() {
    const btn = document.getElementById('btn-titre'), lab = document.getElementById('titre-btn-label');
    if (!btn || !lab) return;
    const t = _titreById(activeTitre);
    lab.textContent = t ? t.name : 'Titre';
    btn.classList.toggle('has-titre', !!t);
    btn.title = t ? 'Titre : ' + t.name : 'Titre';
  }
  function _renderTitreMenu() {
    const menu = document.getElementById('titre-menu');
    if (!menu) return;
    const list = window._vclTitres || [];
    menu.innerHTML = '';
    const none = document.createElement('button');
    none.type = 'button'; none.className = 'titre-row titre-row-none' + (activeTitre ? '' : ' active');
    none.innerHTML = '<span class="titre-row-name">Aucun titre</span>';
    none.addEventListener('click', function() { _chooseTitre(null); });
    menu.appendChild(none);
    if (!list.length) {
      const e = document.createElement('div'); e.className = 'titre-empty'; e.textContent = 'Aucun titre disponible pour le moment.';
      menu.appendChild(e); return;
    }
    list.forEach(function(t) {
      const row = document.createElement('button');
      row.type = 'button'; row.className = 'titre-row' + (t.id === activeTitre ? ' active' : '');
      row.setAttribute('role', 'option');
      const chips = _titreChips(t).map(function(c) { return '<span class="titre-chip">' + escHtml(c) + '</span>'; }).join('');
      row.innerHTML = '<span class="titre-row-name">' + escHtml(t.name) + '</span>' + (chips ? '<span class="titre-row-stats">' + chips + '</span>' : '');
      row.addEventListener('click', function() { _chooseTitre(t.id === activeTitre ? null : t.id); }); // recliquer sur le titre actif le retire
      if (t.id === activeTitre) row.title = 'Cliquer pour retirer ce titre';
      menu.appendChild(row);
    });
  }
  function _setTitre(id) { activeTitre = id || null; _renderTitreBtn(); _renderTitreMenu(); }
  function _chooseTitre(id) {
    _setTitre(id);
    _closeTitreMenu();
    renderStats();
    saveToStorage();
  }
  function _closeTitreMenu() {
    const menu = document.getElementById('titre-menu'), btn = document.getElementById('btn-titre');
    if (menu) menu.hidden = true;
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  (function initTitres() {
    const btn = document.getElementById('btn-titre'), menu = document.getElementById('titre-menu');
    if (!btn || !menu) return;
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const open = menu.hidden;
      menu.hidden = !open;
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) _renderTitreMenu();
    });
    document.addEventListener('click', function(e) { if (!menu.hidden && !e.target.closest('.titre-wrap')) _closeTitreMenu(); });
    document.addEventListener('keydown', function(e) { if (e.key === 'Escape') _closeTitreMenu(); });
    window.addEventListener('vcl:titres', function() { _renderTitreMenu(); _renderTitreBtn(); renderStats(); });
    _renderTitreBtn();
  })();

  /* ══ BUILD ALÉATOIRE ══ */
  const _RARITY_WEIGHTS = { commun:1, rare:3, epique:5, legendaire:7, mythique:6, godlike:5, event:3 };

  function _generateRandomBuild() {
    const newEquipped = {};
    const usedUniqueIds = new Set();
    ALL_SLOTS.forEach(function(slot) {
      const candidates = ITEMS.filter(function(item) {
        if (!slot.cats.includes(item.cat)) return false;
        if (item.cat === 'rune') return false;
        if ((item.lvl || 1) > buildLevel) return false;
        if (activeClass) {
          const cls = item.classes || item.class || [];
          if (Array.isArray(cls) && cls.length > 0 && !cls.includes(activeClass)) return false;
        }
        if (_isSecretItem(item) && !window._canSeeSensibleItems) return false;
        // Items uniques : ne pas équiper deux fois le même item
        if (item.unique && usedUniqueIds.has(item.id ?? item._id)) return false;
        return true;
      });
      if (!candidates.length) return;
      let totalW = candidates.reduce(function(s, i) { return s + (_RARITY_WEIGHTS[i.rarity] || 1); }, 0);
      let r = Math.random() * totalW;
      let picked = candidates[0];
      for (let i = 0; i < candidates.length; i++) {
        r -= (_RARITY_WEIGHTS[candidates[i].rarity] || 1);
        if (r <= 0) { picked = candidates[i]; break; }
      }
      newEquipped[slot.id] = picked;
      if (picked.unique) usedUniqueIds.add(picked.id ?? picked._id);
    });
    return newEquipped;
  }

  document.getElementById('btn-random').addEventListener('click', function() {
    equipped = _generateRandomBuild();
    equippedRunes = {};
    buildGrid();
    buildLevelPanel();
    saveToStorage();
    renderStats();
    renderPickerInfo();
    renderItemList();
  });


  /* ══ BUILD OPTIMISÉ ══
     Recherche locale (hill-climbing avec redémarrages) sur les slots. Le score passe par computeStats()
     (panoplies, arbre de compétences, 2 mains…) : un minimum raté est lourdement pénalisé, puis on maximise
     les stats prioritaires, puis la somme normalisée de toutes les stats. */
  const _statNorm = function(id) { const s = STATS_BY_ID.get(id); return (s && s.max) || 100; };

  function _optScore(mins, req, prio) {
    let score = 0;
    Object.keys(req).forEach(function(id) { score -= 1000 * Math.max(0, req[id] - (mins[id] || 0)) / _statNorm(id); });
    prio.forEach(function(p) { score += p.w * (mins[p.id] || 0) / _statNorm(p.id); });
    ALL_STATS.forEach(function(s) { score += 0.2 * (mins[s.id] || 0) / _statNorm(s.id); });
    return score;
  }

  /* Filtres du build optimisé. Chaque puce a 3 états : neutre / autorisé (✓) / interdit (✕).
     Étiquettes d'un item : « obt:<type> » (une ou plusieurs manières de l'obtenir), « pal:<palier> », « evt:<nom> ».
     - interdit palier / évènement : l'item est écarté ;
     - interdit type d'obtention : écarté seulement si TOUTES ses manières de l'obtenir sont interdites ;
     - s'il y a des « autorisé » : l'item doit en avoir au moins un dans chaque groupe utilisé (obtention ; palier / évènement). */
  const _OPT_OBTAIN = [
    ['mob', '💀 Drop de mob'], ['pnj_achat', '🛒 Achat chez un PNJ'], ['pnj_craft', '🔨 Craft par un PNJ'],
    ['forge', '⚒️ Forge'], ['autel', '🗿 Autel'], ['donjon', '🏰 Donjon'], ['quete', '📜 Quête'], ['autre', '❔ Autre / inconnu']
  ];
  let _optTri = {};            // étiquette → 1 (autorisé) | -1 (interdit), mémorisé entre deux ouvertures de la fenêtre
  let _optFilter = null;       // { allow:Set, ban:Set, obtainOf:Map(id → Set) } figé au lancement

  // Items interdits / imposés (barres de recherche) : id → nom, mémorisés entre deux ouvertures de la fenêtre
  const _optExcl = new Map(), _optForce = new Map();

  function _optNormName(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }

  // Classe / niveau effectivement utilisés par la génération (ceux du build en mode « compléter », ceux de la fenêtre sinon)
  function _optConfig() {
    if (_optMode() === 'complete') return { cls: activeClass || null, lvl: buildLevel };
    return { cls: document.getElementById('opt-class').value || null, lvl: Math.max(1, parseInt(document.getElementById('opt-level').value) || 1) };
  }
  // Un item imposé doit être équipable avec cette config : classe, niveau et un slot de sa catégorie
  function _optEligible(item) {
    const c = _optConfig();
    return (item.lvl || 1) <= c.lvl && itemAllowedForClass(item, c.cls) && ALL_SLOTS.some(function(s) { return s.cats.includes(item.cat); });
  }
  let _optForceRender = null;
  function _optPruneForce() {
    _optForce.forEach(function(name, id) {
      const it = ITEMS.find(function(i) { return getItemId(i) === id; });
      if (!it || !_optEligible(it)) _optForce.delete(id);
    });
    if (_optForceRender) _optForceRender();
  }

  function _optSetupPicker(inputId, listId, chipsId, store, eligible) {
    const inp = document.getElementById(inputId), list = document.getElementById(listId), chips = document.getElementById(chipsId);
    const renderChips = function() {
      chips.innerHTML = '';
      store.forEach(function(name, id) {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = name + ' ✕';
        b.className = 'opt-chip ' + (store === _optForce ? 'allow' : 'ban');
        b.addEventListener('click', function() { store.delete(id); renderChips(); });
        chips.appendChild(b);
      });
      _optUpdateBadges();
    };
    const hide = function() { list.style.display = 'none'; list.innerHTML = ''; };
    inp.oninput = function() {
      const q = _optNormName(inp.value.trim());
      if (q.length < 2) { hide(); return; }
      const hits = ITEMS.filter(function(i) {
        const id = getItemId(i);
        return i.cat !== 'rune' && i.category !== 'rune' && !store.has(id) && (!eligible || eligible(i)) && !(_isSecretItem(i) && !window._canSeeSensibleItems) && _optNormName(i.name).indexOf(q) >= 0;
      }).slice(0, 8);
      list.innerHTML = '';
      hits.forEach(function(i) {
        const row = document.createElement('div');
        row.innerHTML = '<span></span><small></small>';
        row.firstChild.textContent = i.name;
        row.lastChild.textContent = vclPalierLabel(i.palier);
        row.addEventListener('mousedown', function(e) {
          e.preventDefault();
          store.set(getItemId(i), i.name); inp.value = ''; hide(); renderChips();
        });
        list.appendChild(row);
      });
      list.style.display = hits.length ? 'block' : 'none';
    };
    inp.onblur = hide;
    inp.value = ''; hide(); renderChips();
    return renderChips;
  }

  function _optMode() {
    const r = document.querySelector('input[name="opt-mode"]:checked');
    return r ? r.value : 'zero';
  }
  function _optSyncMode() {
    const complete = _optMode() === 'complete';
    ['opt-class', 'opt-level'].forEach(function(id) {
      const el = document.getElementById(id);
      el.disabled = complete; el.style.opacity = complete ? '.4' : '';
    });
  }

  function _optObtainTypes() {
    const mobIds = new Set(), buyIds = new Set(), craftIds = new Set();
    (window.store.mobs || []).forEach(function(m) { (Array.isArray(m.loot) ? m.loot : []).forEach(function(l) { if (l && l.id) mobIds.add(l.id); }); });
    (window.store.pnj || []).forEach(function(p) {
      if (window.vclIsSecretPnj && window.vclIsSecretPnj(p)) return;
      (Array.isArray(p.sells) ? p.sells : []).forEach(function(e) { const id = e && (e.id || e.itemId); if (id) buyIds.add(id); });
      (Array.isArray(p.craft) ? p.craft : []).forEach(function(e) { const id = e && (e.id || e.itemId); if (id) craftIds.add(id); });
    });
    const out = new Map();
    ITEMS.forEach(function(item) {
      const id = item.id || item._id, ob = typeof item.obtain === 'string' ? item.obtain : '', t = new Set();
      if (mobIds.has(id) || /Obtenable en tuant/i.test(ob)) t.add('mob');
      if (buyIds.has(id) || /Achetable/i.test(ob)) t.add('pnj_achat');
      if (craftIds.has(id) || /Fabricable/i.test(ob)) t.add('pnj_craft');
      if (/\[obtain:forge/.test(ob)) t.add('forge');
      if (/\[obtain:altar/.test(ob)) t.add('autel');
      if (/donjon/i.test(ob)) t.add('donjon');
      if (/qu[êe]te|\[quest/i.test(ob)) t.add('quete');
      if (!t.size) t.add('autre');
      out.set(id, t);
    });
    return out;
  }

  function _optItemAllowed(item) {
    const f = _optFilter;
    if (!f) return true;
    if (f.forceIds.has(getItemId(item))) return true;
    if (f.exclIds.has(getItemId(item))) return false;
    const tags = ['pal:' + item.palier];
    if (typeof item.event === 'string' && item.event) tags.push('evt:' + item.event);
    if (tags.some(function(t) { return f.ban.has(t); })) return false;
    const types = f.obtainOf ? (f.obtainOf.get(item.id || item._id) || new Set(['autre'])) : null;
    if (types && f.banObtain && Array.from(types).every(function(t) { return f.ban.has('obt:' + t); })) return false;
    // « Autorisé » : deux groupes indépendants (ET entre eux, OU à l'intérieur) — obtention d'un côté, palier / évènement de l'autre
    const hasAllow = function(prefixes) { return Array.from(f.allow).some(function(t) { return prefixes.indexOf(t.slice(0, 4)) >= 0; }); };
    if (hasAllow(['obt:'])) {
      if (!types || !Array.from(types).some(function(t) { return f.allow.has('obt:' + t); })) return false;
    }
    if (hasAllow(['pal:', 'evt:']) && !tags.some(function(t) { return f.allow.has(t); })) return false;
    return true;
  }

  function _optUpdateBadges() {
    const n = { obt: 0, pal: 0, tit: 0, items: _optExcl.size + _optForce.size };
    Object.keys(_optTri).forEach(function(t) { if (t.indexOf('obt:') === 0) n.obt++; else if (t.indexOf('tit:') === 0) n.tit++; else n.pal++; });
    document.querySelectorAll('.opt-badge').forEach(function(b) { b.textContent = n[b.dataset.badge] || ''; });
  }

  function _optRenderTri() {
    const tiers = Array.from(new Set(ITEMS.map(function(i) { return i.palier; }).filter(function(p) { return p !== undefined && p !== null; })))
      .sort(function(a, b) { return _palierNum(b) - _palierNum(a); });
    const evtMap = {};
    ITEMS.forEach(function(i) { if (typeof i.event === 'string' && i.event) evtMap[i.event] = i.palier; });
    const esc = function(s) { return String(s).replace(/"/g, '&quot;'); };
    const chip = function(tag, label) { return '<button type="button" class="opt-chip" data-tag="' + esc(tag) + '" data-label="' + esc(label) + '"></button>'; };
    const group = function(title, chips) {
      return chips.length ? '<div class="opt-group"><div class="opt-group-title">' + title + '</div><div class="opt-chips">' + chips.join('') + '</div></div>' : '';
    };
    document.getElementById('opt-panel-obt').innerHTML = _OPT_OBTAIN.map(function(o) { return chip('obt:' + o[0], o[1]); }).join('');
    document.getElementById('opt-panel-pal').innerHTML =
      group('Paliers', tiers.map(function(p) { return chip('pal:' + p, vclPalierLabel(p)); })) +
      group('Évènements &amp; World Boss', Object.keys(evtMap).sort().map(function(n) {
        return chip('evt:' + n, (evtMap[n] === 'worldboss' ? '👑 ' : evtMap[n] === 'event' ? '🎉 ' : '') + n);
      }));
    document.getElementById('opt-panel-tit').innerHTML = (window._vclTitres || []).length
      ? (window._vclTitres || []).map(function(t) { return chip('tit:' + t.id, t.name); }).join('')
      : '<span class="opt-legend">Aucun titre disponible pour le moment.</span>';
    document.querySelectorAll('#opt-panel-obt .opt-chip, #opt-panel-pal .opt-chip, #opt-panel-tit .opt-chip').forEach(function(b) {
      const paint = function() {
        const v = _optTri[b.dataset.tag] || 0;
        b.textContent = (v === 1 ? '✓ ' : v === -1 ? '✕ ' : '') + b.dataset.label;
        b.classList.toggle('allow', v === 1);
        b.classList.toggle('ban', v === -1);
      };
      paint();
      b.addEventListener('click', function() {
        const v = _optTri[b.dataset.tag] || 0;
        const nv = v === 0 ? 1 : v === 1 ? -1 : 0;
        if (nv) _optTri[b.dataset.tag] = nv; else delete _optTri[b.dataset.tag];
        paint(); _optUpdateBadges();
      });
    });
    document.querySelectorAll('.opt-tab').forEach(function(t) {
      t.onclick = function() {
        document.querySelectorAll('.opt-tab').forEach(function(x) { x.classList.toggle('active', x === t); });
        document.querySelectorAll('.opt-panel').forEach(function(p) { p.hidden = p.dataset.panel !== t.dataset.tab; });
      };
    });
    _optUpdateBadges();
  }

  function _optPools() {
    const pools = {};
    ALL_SLOTS.forEach(function(slot) {
      pools[slot.id] = ITEMS.filter(function(item) {
        if (!slot.cats.includes(item.cat) || item.cat === 'rune') return false;
        if ((item.lvl || 1) > buildLevel) return false;
        if (!itemAllowedForClass(item, activeClass)) return false;
        if (_isSecretItem(item) && !window._canSeeSensibleItems) return false;
        return _optItemAllowed(item);
      });
    });
    // Items imposés : le slot ne propose plus que cet item (premier slot libre de sa catégorie)
    const taken = {};
    const locked = _optFilter && _optFilter.locked ? _optFilter.locked : {};
    Object.keys(locked).forEach(function(sid) { taken[sid] = true; pools[sid] = [locked[sid]]; });
    (_optFilter ? _optFilter.forced : []).forEach(function(item) {
      if (Object.keys(locked).some(function(sid) { return getItemId(locked[sid]) === getItemId(item); })) return;
      const slot = ALL_SLOTS.find(function(s) { return !taken[s.id] && s.cats.includes(item.cat); });
      if (slot) { taken[slot.id] = true; pools[slot.id] = [item]; }
    });
    return pools;
  }

  // Garde les meilleurs candidats par slot (score isolé) + des items de panoplie : réduit fortement le coût de la recherche.
  function _optPrune(pools, req, prio) {
    const out = {};
    Object.keys(pools).forEach(function(slotId) {
      const scored = pools[slotId].map(function(item) {
        const m = {};
        Object.entries(item.stats || {}).forEach(function(e) { m[e[0]] = getMin(e[1]); });
        const sc = _optScore(m, {}, prio) + Object.keys(req).reduce(function(a, id) { return a + 4 * (m[id] || 0) / _statNorm(id); }, 0);
        return { item: item, sc: sc };
      }).sort(function(a, b) { return b.sc - a.sc; });
      const keep = scored.slice(0, 35).map(function(x) { return x.item; });
      scored.slice(35).forEach(function(x) { if (x.item.set && keep.length < 100) keep.push(x.item); });
      out[slotId] = keep;
    });
    return out;
  }

  function _optBlockedFor(map) {
    const saved = equipped; equipped = map;
    try { return Array.from(getBlockedSlots()); } finally { equipped = saved; }
  }

  function _optRunePool() {
    return ITEMS.filter(function(item) {
      return (item.cat === 'rune' || item.category === 'rune') && !(_isSecretItem(item) && !window._canSeeSensibleItems) && _optItemAllowed(item);
    });
  }

  function _optSearch(pools, req, prio, deadline, lockedRunes) {
    lockedRunes = lockedRunes || {};
    const savedEq = equipped, savedRunes = equippedRunes;
    const slotIds = ALL_SLOTS.map(function(s) { return s.id; });
    const runePool = _optRunePool();
    const setIds = Object.keys(SETS || {});

    // Les clés de runes dont l'item n'a plus assez d'emplacements sont ignorées au calcul.
    function evalState(map, runes) {
      const valid = {};
      Object.keys(runes).forEach(function(k) { if (isRuneKeyValid(k, map)) valid[k] = runes[k]; });
      equipped = map; equippedRunes = valid;
      return _optScore(computeStats().mins, req, prio);
    }
    function usedElsewhere(map, slotId, item) {
      if (!item.unique) return false;
      const id = getItemId(item);
      return Object.keys(map).some(function(k) { return k !== slotId && map[k] && getItemId(map[k]) === id; });
    }
    function runeKeysOf(map) {
      const keys = [];
      slotIds.forEach(function(sid) {
        const it = map[sid];
        if (it && it.stats && it.rune_slots > 0) for (let i = 0; i < it.rune_slots; i++) keys.push(sid + '_rune_' + i);
      });
      return keys;
    }

    // Une passe de recherche locale sur les items (runes figées)
    function climbItems(map, runes, cur) {
      for (let pass = 0; pass < 8; pass++) {
        let improved = false;
        slotIds.slice().sort(function() { return Math.random() - 0.5; }).forEach(function(sid) {
          pools[sid].forEach(function(it) {
            if (map[sid] === it || usedElsewhere(map, sid, it)) return;
            const prev = map[sid];
            map[sid] = it;
            const sc = evalState(map, runes);
            if (sc > cur + 1e-9) { cur = sc; improved = true; }
            else if (prev) map[sid] = prev; else delete map[sid];
          });
        });
        if (!improved) break;
      }
      return cur;
    }

    // Une passe de recherche locale sur les runes (la même rune peut équiper plusieurs pièces)
    function climbRunes(map, runes, cur) {
      for (let pass = 0; pass < 6; pass++) {
        let improved = false;
        runeKeysOf(map).sort(function() { return Math.random() - 0.5; }).forEach(function(key) {
          if (lockedRunes[key]) return;
          runePool.forEach(function(r) {
            const rid = getItemId(r);
            if (runes[key] === rid) return;
            const prev = runes[key];
            runes[key] = rid;
            const sc = evalState(map, runes);
            if (sc > cur + 1e-9) { cur = sc; improved = true; }
            else if (prev) runes[key] = prev; else delete runes[key];
          });
        });
        if (!improved) break;
      }
      return cur;
    }

    let best = null, bestScore = -Infinity, runs = 0;
    try {
      while (runs < 3 || (Date.now() < deadline && runs < 40)) {
        runs++;
        const map = {}, runes = Object.assign({}, lockedRunes);
        // Une restart sur deux démarre sur une panoplie complète (impossible à atteindre en changeant un item à la fois)
        const seedSet = (runs % 2 === 0 && setIds.length) ? setIds[Math.floor(Math.random() * setIds.length)] : null;
        slotIds.forEach(function(sid) {
          const list = pools[sid];
          if (!list.length) return;
          const inSet = seedSet ? list.filter(function(i) { return i.set === seedSet; }) : [];
          const src = inSet.length ? inSet : list.slice(0, 12);
          const it = src[Math.floor(Math.random() * src.length)];
          if (!usedElsewhere(map, sid, it)) map[sid] = it;
        });
        let cur = evalState(map, runes);
        for (let round = 0; round < 3; round++) {
          const before = cur;
          cur = climbItems(map, runes, cur);
          cur = climbRunes(map, runes, cur);
          if (cur <= before + 1e-9) break;
        }
        if (cur > bestScore) {
          bestScore = cur;
          const keptRunes = {};
          Object.keys(runes).forEach(function(k) { if (isRuneKeyValid(k, map)) keptRunes[k] = runes[k]; });
          best = { map: Object.assign({}, map), runes: keptRunes };
        }
      }
    } finally { equipped = savedEq; equippedRunes = savedRunes; }
    if (best) {
      _optBlockedFor(best.map).forEach(function(sid) { delete best.map[sid]; });
      Object.keys(best.runes).forEach(function(k) { if (!isRuneKeyValid(k, best.map)) delete best.runes[k]; });
    }
    return best;
  }

  // Arbre de compétences : choisit les cases (connectées au centre, plafonnées aux points du niveau) qui maximisent le score
  // à équipement fixé. Glouton sur « chemin vers une case » : gain du chemin / longueur du chemin.
  function _optTree(map, runes, req, prio, startNodes) {
    const ST = window.VCLSkillTree, fxAll = window.VCL_SKILL_EFFECTS;
    if (!ST || !activeClass || !fxAll || !fxAll[activeClass]) return [];
    const max = ST.maxPoints(buildLevel);
    if (max <= 0) return [];
    const savedEq = equipped, savedRunes = equippedRunes, savedNodes = skillNodes;
    let base;
    try {
      equipped = map; equippedRunes = runes; skillNodes = [];
      base = Object.assign({}, computeStats().mins); // le centre de l'arbre est déjà compté
    } finally { equipped = savedEq; equippedRunes = savedRunes; skillNodes = savedNodes; }

    const effOf = function(k) {
      const fx = fxAll[activeClass][ST.numbers[k]];
      return fx && STATS_BY_ID.has(fx.stats) ? fx : null;
    };
    const scoreWith = function(bonus) {
      const mins = Object.assign({}, base);
      Object.keys(bonus).forEach(function(s) { mins[s] = (mins[s] || 0) + bonus[s]; });
      return _optScore(mins, req, prio);
    };
    const owned = { '0,0': 1 }, nodes = [], bonus = {};
    ST.sanitize(startNodes || [], max).forEach(function(k) {
      owned[k] = 1; nodes.push(k);
      const fx = effOf(k); if (fx) bonus[fx.stats] = (bonus[fx.stats] || 0) + fx.bonus;
    });
    // Un chemin n'est utilisable que si l'arbre l'accepte tel quel (sinon les points seraient perdus)
    const valid = function(path) { return ST.sanitize(nodes.concat(path), max).length === nodes.length + path.length; };
    while (nodes.length < max) {
      // BFS depuis les cases possédées, à travers les cases libres
      const par = {}, dist = {}, queue = [];
      Object.keys(owned).forEach(function(k) { dist[k] = 0; queue.push(k); });
      for (let qi = 0; qi < queue.length; qi++) {
        const k = queue[qi];
        Object.keys(ST.graph.adj[k] || {}).forEach(function(n) {
          if (dist[n] !== undefined || !ST.graph.nodes[n]) return;
          dist[n] = dist[k] + 1; par[n] = k; queue.push(n);
        });
      }
      const cur = scoreWith(bonus);
      let bestPath = null, bestRatio = 1e-12;
      Object.keys(dist).forEach(function(t) {
        if (!dist[t] || dist[t] > max - nodes.length) return;
        const path = []; for (let k = t; !owned[k]; k = par[k]) path.unshift(k);
        if (!valid(path)) return;   // case clé (keystone) dont les voisins ne sont pas tous pris : le chemin serait rejeté à la fin
        const b = Object.assign({}, bonus);
        path.forEach(function(k) { const fx = effOf(k); if (fx) b[fx.stats] = (b[fx.stats] || 0) + fx.bonus; });
        const ratio = (scoreWith(b) - cur) / path.length;
        if (ratio > bestRatio) { bestRatio = ratio; bestPath = path; }
      });
      if (!bestPath) break;
      bestPath.forEach(function(k) {
        owned[k] = 1; nodes.push(k);
        const fx = effOf(k); if (fx) bonus[fx.stats] = (bonus[fx.stats] || 0) + fx.bonus;
      });
    }
    // Points restants : on les dépense quand même (meilleure case voisine, même à gain nul)
    while (nodes.length < max) {
      const cur = scoreWith(bonus);
      let bestK = null, bestG = -Infinity;
      Object.keys(owned).forEach(function(o) {
        Object.keys(ST.graph.adj[o] || {}).forEach(function(n) {
          if (owned[n] || !ST.graph.nodes[n] || !valid([n])) return;
          const fx = effOf(n), b = Object.assign({}, bonus);
          if (fx) b[fx.stats] = (b[fx.stats] || 0) + fx.bonus;
          const g = scoreWith(b) - cur;
          if (g > bestG) { bestG = g; bestK = n; }
        });
      });
      if (!bestK) break;
      owned[bestK] = 1; nodes.push(bestK);
      const fx = effOf(bestK); if (fx) bonus[fx.stats] = (bonus[fx.stats] || 0) + fx.bonus;
    }
    return ST.sanitize(nodes, max);
  }

  // Titre : meilleur titre autorisé pour cet équipement + cet arbre (aucun titre si aucun n'améliore le score)
  function _optTitle(map, runes, req, prio, nodes) {
    const list = (window._vclTitres || []).filter(function(t) {
      if (_optTri['tit:' + t.id] === -1) return false;
      return !Object.keys(_optTri).some(function(k) { return k.indexOf('tit:') === 0 && _optTri[k] === 1; }) || _optTri['tit:' + t.id] === 1;
    });
    if (!list.length) return null;
    const savedEq = equipped, savedRunes = equippedRunes, savedNodes = skillNodes, savedTitre = activeTitre;
    let base;
    try {
      equipped = map; equippedRunes = runes; skillNodes = nodes; activeTitre = null;
      base = Object.assign({}, computeStats().mins);
    } finally { equipped = savedEq; equippedRunes = savedRunes; skillNodes = savedNodes; activeTitre = savedTitre; }
    let best = null, bestScore = _optScore(base, req, prio) + 1e-9;
    list.forEach(function(t) {
      const mins = Object.assign({}, base);
      Object.keys(t.stats || {}).forEach(function(s) { if (s in mins) mins[s] += +t.stats[s] || 0; });
      const sc = _optScore(mins, req, prio);
      if (sc > bestScore) { bestScore = sc; best = t.id; }
    });
    return best;
  }

  // Priorités : liste de niveaux (du plus important au moins important), chaque niveau regroupe des stats à égalité
  let _optLevels = [[]];

  function _optRenderPrio() {
    const wrap = document.getElementById('opt-prio');
    wrap.innerHTML = '';
    _optLevels.forEach(function(stats, li) {
      const row = document.createElement('div');
      row.className = 'opt-level';
      const num = document.createElement('span');
      num.className = 'opt-level-num'; num.textContent = li + 1;
      const box = document.createElement('div');
      box.className = 'opt-level-stats';
      stats.forEach(function(sid) {
        const st = STATS_BY_ID.get(sid);
        const chip = document.createElement('button');
        chip.type = 'button'; chip.className = 'opt-chip allow';
        chip.textContent = (st ? (st.icon || '') + ' ' + st.label : sid) + ' ✕';
        chip.addEventListener('click', function() { stats.splice(stats.indexOf(sid), 1); _optRenderPrio(); });
        box.appendChild(chip);
      });
      const used = new Set([].concat.apply([], _optLevels));
      const sel = document.createElement('select');
      sel.className = 'input-name';
      sel.innerHTML = '<option value="">' + (stats.length ? '+ à égalité' : '+ stat') + '</option>' + ALL_STATS.filter(function(s) { return !used.has(s.id); }).map(function(s) {
        return '<option value="' + s.id + '">' + (s.icon || '') + ' ' + s.label + '</option>';
      }).join('');
      sel.addEventListener('change', function() { if (sel.value) { stats.push(sel.value); _optRenderPrio(); } });
      box.appendChild(sel);
      row.appendChild(num); row.appendChild(box);
      if (_optLevels.length > 1) {
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'opt-x'; x.title = 'Supprimer ce niveau'; x.textContent = '✕';
        x.addEventListener('click', function() { _optLevels.splice(li, 1); _optRenderPrio(); });
        row.appendChild(x);
      }
      wrap.appendChild(row);
    });
    if (_optLevels[_optLevels.length - 1].length) {
      const add = document.createElement('button');
      add.type = 'button'; add.className = 'opt-link';
      add.textContent = '+ Ajouter un niveau de priorité inférieur';
      add.addEventListener('click', function() { _optLevels.push([]); _optRenderPrio(); });
      wrap.appendChild(add);
    }
  }

  // Poids par niveau : chaque niveau pèse nettement plus que le suivant, les stats d'un même niveau pèsent pareil
  function _optPrioWeights() {
    const levels = _optLevels.filter(function(l) { return l.length; });
    const out = [];
    levels.forEach(function(l, i) { l.forEach(function(id) { out.push({ id: id, w: 3 * Math.pow(2.5, levels.length - 1 - i) }); }); });
    return out;
  }

  function _optStatOptions(emptyLabel) {
    return '<option value="">' + emptyLabel + '</option>' + ALL_STATS.map(function(s) {
      return '<option value="' + s.id + '">' + (s.icon || '') + ' ' + s.label + '</option>';
    }).join('');
  }

  function _optAddMinRow(statId, val) {
    const row = document.createElement('div');
    row.className = 'opt-min-row';
    row.innerHTML = '<select class="input-name opt-min-stat">' + _optStatOptions('— stat —') + '</select>' +
      '<input class="input-name opt-min-val" type="number" step="any" placeholder="min" />' +
      '<button type="button" class="opt-x" title="Retirer">✕</button>';
    row.querySelector('select').value = statId || '';
    row.querySelector('.opt-min-val').value = val != null ? val : '';
    row.querySelector('.opt-x').addEventListener('click', function() { row.remove(); });
    document.getElementById('opt-mins').appendChild(row);
  }

  document.getElementById('btn-optimize').addEventListener('click', function() {
    document.getElementById('modal-title').textContent = '🎯 Build Optimisé';
    const clsSel = document.getElementById('opt-class');
    clsSel.innerHTML = '<option value="">👥 Toutes</option>' + CLASSES.map(function(c) {
      return '<option value="' + c.id + '">' + c.ico + ' ' + c.label + '</option>';
    }).join('');
    clsSel.value = activeClass || '';
    const lvl = document.getElementById('opt-level');
    lvl.max = MAX_LEVEL; lvl.value = buildLevel;
    _optRenderPrio();
    if (!document.querySelector('#opt-mins .opt-min-stat')) _optAddMinRow();
    _optRenderTri();
    document.querySelectorAll('input[name="opt-mode"]').forEach(function(r) { r.onchange = function() { _optSyncMode(); _optPruneForce(); }; });
    _optSyncMode();
    _optSetupPicker('opt-excl-q', 'opt-excl-list', 'opt-excl-chips', _optExcl);
    _optForceRender = _optSetupPicker('opt-force-q', 'opt-force-list', 'opt-force-chips', _optForce, _optEligible);
    ['opt-class', 'opt-level'].forEach(function(id) { var el = document.getElementById(id); el.onchange = _optPruneForce; el.oninput = _optPruneForce; });
    _optPruneForce();
    document.getElementById('opt-result').style.display = 'none';
    openModal('optimize');
  });
  document.getElementById('btn-opt-addmin').addEventListener('click', function() { _optAddMinRow(); });

  document.getElementById('btn-opt-run').addEventListener('click', function() {
    const btn = document.getElementById('btn-opt-run');
    const out = document.getElementById('opt-result');
    const req = {};
    document.querySelectorAll('#opt-mins > div').forEach(function(row) {
      const id = row.querySelector('select').value;
      const v  = parseFloat(row.querySelector('.opt-min-val').value);
      if (id && !isNaN(v)) req[id] = Math.max(req[id] === undefined ? -Infinity : req[id], v);
    });
    const prio = _optPrioWeights();

    // Mode « compléter » : ce qui est équipé (items, runes, arbre) est gardé tel quel, classe et niveau aussi.
    // Mode « de zéro » : classe + niveau demandés, équipement vidé.
    const complete = _optMode() === 'complete';
    const lockedItems = {}, lockedRunes = {};
    let lockedNodes = [];
    if (complete) {
      const blocked = getBlockedSlots();
      Object.keys(equipped).forEach(function(sid) { if (equipped[sid] && !blocked.has(sid)) lockedItems[sid] = equipped[sid]; });
      Object.assign(lockedRunes, equippedRunes);
      lockedNodes = skillNodes.slice();
    } else {
      equipped = {}; equippedRunes = {};
      const newClass = document.getElementById('opt-class').value || null;
      if (newClass !== activeClass) {
        const cb = document.querySelector('#class-picker .class-btn[data-c="' + (newClass || '') + '"]');
        if (cb) cb.click();
      }
      const newLvl = Math.max(1, Math.min(MAX_LEVEL, parseInt(document.getElementById('opt-level').value) || 1));
      if (newLvl !== buildLevel) applyLevelChange(newLvl);
    }

    btn.disabled = true; btn.textContent = '⏳ Recherche…';
    out.style.display = 'block'; out.textContent = 'Recherche du meilleur équipement…';
    const tri = Object.assign({}, _optTri);
    setTimeout(async function() {
      try {
        const allow = new Set(Object.keys(tri).filter(function(t) { return tri[t] === 1; }));
        const ban = new Set(Object.keys(tri).filter(function(t) { return tri[t] === -1; }));
        const isObt = function(t) { return t.indexOf('obt:') === 0; };
        let obtainOf = null;
        if (Array.from(allow).some(isObt) || Array.from(ban).some(isObt)) {
          try { await window.store.load(['mobs', 'pnj']); obtainOf = _optObtainTypes(); }
          catch (e) { console.error('[Atelier] sources mob/PNJ :', e); out.textContent = '⛔ Impossible de charger les mobs / PNJ.'; return; }
        }
        _optPruneForce();
        const forceIds = new Set(_optForce.keys());
        const forced = ITEMS.filter(function(i) { return forceIds.has(getItemId(i)); });
        _optFilter = { allow: allow, ban: ban, obtainOf: obtainOf, banObtain: Array.from(ban).some(isObt),
                       exclIds: new Set(_optExcl.keys()), forceIds: forceIds, forced: forced, locked: lockedItems };
        const pools = _optPrune(_optPools(), req, prio);
        // 1) équipement sans arbre → 2) arbre pour cet équipement → 3) équipement refait avec l'arbre → 4) arbre final
        // Mode « compléter » : un titre déjà choisi est gardé ; sinon on cherche le meilleur titre autorisé
        const lockedTitre = complete ? activeTitre : null;
        activeTitre = lockedTitre;
        skillNodes = lockedNodes.slice();
        let found = _optSearch(pools, req, prio, Date.now() + 1500, lockedRunes);
        if (found) {
          const t1 = _optTree(found.map, found.runes, req, prio, lockedNodes);
          const ti1 = lockedTitre || _optTitle(found.map, found.runes, req, prio, t1);
          skillNodes = t1; activeTitre = ti1;
          const found2 = _optSearch(pools, req, prio, Date.now() + 1500, lockedRunes);
          if (found2) found = found2;
          const t2 = _optTree(found.map, found.runes, req, prio, lockedNodes);
          skillNodes = t2.length ? t2 : t1;
          activeTitre = lockedTitre || _optTitle(found.map, found.runes, req, prio, skillNodes);
        }
        equipped = found ? found.map : {};
        equippedRunes = found ? found.runes : {};
        _setTitre(activeTitre);
        buildGrid(); buildLevelPanel(); saveToStorage(); renderStats(); renderPickerInfo(); renderItemList();

        const mins = computeStats().mins;
        const ids = Object.keys(req);
        const unmet = ids.some(function(id) { return (mins[id] || 0) < req[id]; });
        out.innerHTML = (unmet ? '<div style="color:#d9614a;margin-bottom:4px">Impossible de tout respecter pour cette classe et ce niveau : voici le plus proche.</div>' : '') +
          ids.map(function(id) {
            const ok = (mins[id] || 0) >= req[id];
            const st = STATS_BY_ID.get(id);
            return '<div style="color:' + (ok ? '#7ac47a' : '#d9614a') + '">' + (ok ? '✓' : '✗') + ' ' + (st ? st.label : id) +
              ' : ' + Math.round((mins[id] || 0) * 100) / 100 + ' / ' + req[id] + '</div>';
          }).join('') + '<div style="opacity:.6;margin-top:4px">Clique sur Générer pour une autre variante.</div>';
        // Génération terminée : on ferme la fenêtre pour voir le build ; un minimum raté est signalé par une notification
        closeModal();
        if (unmet) import('../components/toast.js').then(function(m) { m.toast('Impossible de tout respecter : voici le build le plus proche.', 'warning'); }).catch(function() {});
      } catch (err) {
        console.error('[Atelier] build optimisé :', err);
        out.textContent = '⛔ Erreur pendant la génération.';
      } finally { btn.disabled = false; btn.textContent = '🎯 Générer'; }
    }, 30);
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
    skillNodes = [];
    activeTitre = null;
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
  const _sensibleTried = new Set(); // noms normalisés déjà tentés
  const _hiddenCache   = new Map(); // id → item, jamais exposé dans ITEMS global
  let _sensibleTimer = null;
  function _sensibleImg(category, id, palier, isEvent) {
    if (!id) return null;
    const tier = (isEvent || (palier === 0 || palier === 'event')) ? 'events' : (palier ? 'P' + palier : '');
    const tp = tier ? tier + '/' : '';
    switch (category) {
      case 'arme':        return `../img/compendium/textures/weapons/${tp}${id}.png`;
      case 'armure':      return `../img/compendium/textures/armors/${tp}${id}.png`;
      case 'accessoire':  return `../img/compendium/textures/trinkets/${tp}${id}.png`;
      case 'outils':      return `../img/compendium/textures/gears/${tp}${id}.png`;
      case 'materiaux':   return `../img/compendium/textures/items/Material/${tp}${id}.png`;
      case 'ressources':  return `../img/compendium/textures/items/Ressources/${tp}${id}.png`;
      case 'consommable': return `../img/compendium/textures/items/Consommable/${tp}${id}.png`;
      case 'nourriture':  return `../img/compendium/textures/items/Nourriture/${tp}${id}.png`;
      case 'parchemin':   return `../img/compendium/textures/items/Parchemins/${tp}${id}.png`;
      case 'rune':        return `../img/compendium/textures/items/Runes/${tp}${id}.png`;
      case 'quete':       return `../img/compendium/textures/items/Quest/${tp}${id}.png`;
      case 'donjon':      return `../img/compendium/textures/items/Donjon/${tp}${id}.png`;
      case 'monnaie':     return `../img/compendium/textures/items/Monnaie/${tp}${id}.png`;
      default:            return null;
    }
  }
  window._atelierSensibleImg = _sensibleImg;

  async function _trySensibleLookup(rawName) {
    const q = normalize(rawName);
    if (!q || q.length < 3) return;
    if (_sensibleTried.has(q)) return;
    _sensibleTried.add(q);
    const api = window.VCL_DB;
    if (!api || !api.getHiddenByName) return;
    try {
      const hits = await api.getHiddenByName(api.COL.itemsHidden, rawName);
      if (!hits || !hits.length) return;
      for (const hit of hits) {
        if (!_hiddenCache.has(hit.id)) {
          if (hit.id && api.getSecretById) {
            const secret = await api.getSecretById(api.COL.itemsSecret, hit.id);
            if (secret) Object.assign(hit, secret);
          }
          if (!hit.images?.length && !hit.image && !hit.img) {
            const builtImg = _sensibleImg(hit.category || hit.cat, hit.id, hit.palier, hit.event);
            if (builtImg) { hit.img = builtImg; hit.images = [builtImg]; }
          }
          _hiddenCache.set(hit.id, hit);
        }
      }
      // Ne re-render que si la recherche courante correspond encore (nom exact)
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
    // Re-read active slot from meta on every call (handles preview, _exitPreview, normal reload)
    try {
      const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
      activeBuildIndex = meta.active ?? 0;
      window._vclActiveBuildIndex = activeBuildIndex;
    } catch {}

    // Reset build state so old equipped items don't bleed into new slot
    equipped        = {};
    equippedRunes   = {};
    activeSlot      = null;
    activeRuneSlot  = null;
    activeRuneSlotId = null;
    buildLevel      = 1;
    activeClass     = null;
    skillNodes      = [];
    activeTitre = null;

    if (!RUNES_BY_ID.size) {
      ITEMS.filter(function(i) { return i.cat === 'rune' || i.category === 'rune'; }).forEach(function(r) {
        const rid = getItemId(r); if (rid) RUNES_BY_ID.set(rid, r);
      });
    }
    buildSetTooltip();
    buildClassPicker();
    buildGrid();
    buildFilters();
	  buildTierFilter();
    buildEquipFilter();
    buildStatsUI();

    const _slotArea = document.body;
    _slotArea.addEventListener('mouseover', function(e) {
      if (e.target.closest('.rune-orb')) { hideSetTooltip(); return; }
      const slot = e.target.closest('.slot.filled');
      const item = slot && equipped[slot.dataset.slotId];
      if (item) showSlotTooltip(e, item); else if (slot || e.target.closest('#col-left,#col-right,#row-bot')) hideSetTooltip();
    });
    _slotArea.addEventListener('mousemove', function(e) {
      const tooltip = document.getElementById('set-tooltip');
      if (tooltip && tooltip.classList.contains('visible') && e.target.closest('.slot.filled')) positionTooltip(e, tooltip);
    });
    ['col-left', 'col-right', 'row-bot'].forEach(function(id) {
      document.getElementById(id).addEventListener('mouseleave', hideSetTooltip);
    });

    document.getElementById('items-list').addEventListener('mouseover', function(e) {
      const row = e.target.closest('.item-row');
      if (!row) { hideSetTooltip(); return; }
      const badge = row.querySelector('[data-set-id]');
      if (badge) showSetTooltip(e, badge.dataset.setId);
      else hideSetTooltip();
    });
    document.getElementById('items-list').addEventListener('mousemove', function(e) {
      const tooltip = document.getElementById('set-tooltip');
      if (tooltip && tooltip.classList.contains('visible')) positionTooltip(e, tooltip);
    });
    document.getElementById('items-list').addEventListener('mouseleave', function() {
      hideSetTooltip();
    });

    buildLevelPanel();

    try {
      const raw = localStorage.getItem(getBuildKey(activeBuildIndex));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.sig === SIG && (parsed.v === 1 || parsed.v === 2) && parsed.slots) {

          const sensiblePending = []; // { slotId, name, id } à résoudre en async

          Object.entries(parsed.slots).forEach(function(e) {
            const slotId = e[0];
            const entry  = e[1];
            // Compat v1 (string) et v2 ({ id, name })
            const itemId   = typeof entry === 'string' ? entry : entry.id;
            const itemName = typeof entry === 'string' ? null  : entry.name;
            const item = ITEMS.find(function(i) { return i.id === _rid(itemId); });
            if (item) {
              equipped[slotId] = item;
            } else if (itemName) {
              // Item non trouvé dans ITEMS → potentiellement sensible
              sensiblePending.push({ slotId: slotId, name: itemName, id: itemId });
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
          _setSkillNodes(parsed.skillNodes);
          _setTitre(parsed.titre);

          buildGrid();
          buildLevelPanel();

          // Restauration asynchrone des items sensibles
          if (sensiblePending.length) {
            sensiblePending.forEach(function(pending) {
              (function(slotId, rawName, savedId) {
                var api = window.VCL_DB;
                if (!api || !api.getHiddenByName) return;
                // getHiddenByName = getDoc par hash (fonctionne pour non-contribs)
                const fetchHidden = api.getHiddenByName(api.COL.itemsHidden, rawName)
                  .then(function(hits) { return hits && hits[0] || null; });
                fetchHidden.then(async function(hit) {
                  if (!hit) return;
                  if (!_hiddenCache.has(hit.id)) {
                    if (hit.id && api.getSecretById) {
                      const secret = await api.getSecretById(api.COL.itemsSecret, hit.id);
                      if (secret) Object.assign(hit, secret);
                    }
                    if (!hit.images?.length && !hit.image && !hit.img) {
                      const builtImg = _sensibleImg(hit.category || hit.cat, hit.id, hit.palier, hit.event);
                      if (builtImg) { hit.img = builtImg; hit.images = [builtImg]; }
                    }
                    _hiddenCache.set(hit.id, hit);
                  }
                  equipped[slotId] = _hiddenCache.get(hit.id);
                  buildGrid();
                  renderStats();
                  renderPickerInfo();
                }).catch(function() {});
              })(pending.slotId, pending.name, pending.id);
            });
          }
        }
      }
    } catch(e) { }

    renderStats();
    renderPickerInfo();
    renderItemList();
    updateBuildTabs();
    requestAnimationFrame(function() { fitGrid(); requestAnimationFrame(fitGrid); });
    if (!window._vclResizeObserverSet && window.ResizeObserver) {
      window._vclResizeObserverSet = true;
      new ResizeObserver(fitGrid).observe(document.querySelector('.site-header'));
    }
  }

  window._pageInit = init;
  window._atelierRefreshPicker = function() { renderItemList(); };
  window._atelierComputeStats  = computeStats;
  window._atelierSIG           = SIG;

})();

(function () {
  'use strict';

  let checkedKeys = {};
  let haveQty     = {};

  const SIG = '🌙VCL_DRAWER_v2';
  /* Ancien ID d'un item renommé → nouvel ID (même helper que l'IIFE principale, hors de portée ici) */
  function _rid(id) { return window._vclResolveItemId ? window._vclResolveItemId(id) : id; }
  /* Lookup partagé — ALL_SLOTS vient de Compendium/data.js */
  const SLOTS_BY_ID = new Map(ALL_SLOTS.map(s => [s.id, s]));

  /* ══ ORDRE D'AFFICHAGE DES SLOTS ══ */
  const SLOT_ORDER = [
    'casque', 'plastron', 'jambieres', 'bottes',
    'arme_pr', 'arme_sec',
    'anneau1', 'anneau2', 'amulette', 'bracelet', 'gants',
    'artefact1', 'artefact2', 'artefact3',
  ];

  function getCraftKey(idx) {
    const i = idx !== undefined ? idx : (window._vclActiveBuildIndex !== undefined ? window._vclActiveBuildIndex : 0);
    return 'vcl_craft_v2_' + i;
  }

  function loadState(idx) {
    try {
      const raw = localStorage.getItem(getCraftKey(idx));
      if (!raw) return null;
      const p = JSON.parse(raw);
      return p.sig === SIG ? p : null;
    } catch (e) { return null; }
  }

  function getEquippedCraftItems() {
      if (typeof ITEMS === 'undefined') return [];
      const results = [];
      try {
        const idx = window._vclActiveBuildIndex !== undefined ? window._vclActiveBuildIndex : 0;
        const raw = localStorage.getItem(window._vclGetBuildKey(idx));
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
        const item = ITEMS.find(function (i) { return i.id === _rid(itemId); });
        if (!item) return;
        if (!item.craft || !Array.isArray(item.craft) || !item.craft.length) return;
        results.push({ slotId: slotId, item: item });
      });
    } catch (e) {}
    return results;
  }

  function saveState() {
    const idx = window._vclActiveBuildIndex !== undefined ? window._vclActiveBuildIndex : 0;
    try {
      localStorage.setItem(getCraftKey(idx), JSON.stringify({
        sig: SIG,
        checked: checkedKeys,
        qty: haveQty,
      }));
    } catch(e) {}
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
    if (drawer.classList.contains('open')) {
      if (window._vclActiveBuildIndex === undefined) {
        window._vclActiveBuildIndex = 0;
      }
      refresh();
    }
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
    const idx = window._vclActiveBuildIndex !== undefined ? window._vclActiveBuildIndex : 0;
    const saved = loadState(idx);
    checkedKeys = saved ? (saved.checked || {}) : {};
    haveQty     = saved ? (saved.qty    || {}) : {};
    if (drawer.classList.contains('open')) refresh();
    else updateProgress(computeAll());
  });

  function init() {
    const idx = window._vclActiveBuildIndex !== undefined ? window._vclActiveBuildIndex : 0;
    const saved = loadState(idx);
    if (saved) {
      checkedKeys = saved.checked || {};
      haveQty     = saved.qty    || {};
    } else {
      checkedKeys = {};
      haveQty     = {};
    }
    updateProgress(computeAll());
  }

  if (window._vclActiveBuildIndex !== undefined) {
    init();
  } else {
    window.addEventListener('vcl:stuffChanged', function onFirstLoad() {
      window.removeEventListener('vcl:stuffChanged', onFirstLoad);
      init();
    });
  }

})();

/* Tiroir stats */
const statsDrawer  = document.getElementById('stats-drawer');
const statsTab     = document.getElementById('stats-drawer-tab');
const statsClose   = document.getElementById('stats-drawer-close');

function setStatsOpen(open) {
  statsDrawer.classList.toggle('open', open);
  document.querySelector('.body').classList.toggle('stats-open', open);
  window.dispatchEvent(new Event('resize'));
  setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 260);
}

statsTab.addEventListener('click', function() {
  setStatsOpen(!statsDrawer.classList.contains('open'));
});
statsClose.addEventListener('click', function() {
  setStatsOpen(false);
});

/* ══ MOBILE SIDEBAR TOGGLES ══ */
(function() {
  const sidebarLeft    = document.querySelector('.sidebar-left');
  const sidebarRight   = document.querySelector('.sidebar-right');
  const backdrop       = document.getElementById('atelier-backdrop');
  const leftToggleBtn  = document.getElementById('atelier-left-toggle');
  const pickerCloseBtn = document.getElementById('atelier-picker-close');

  function isMobile() { return window.innerWidth <= 768; }

  function lockScroll()   { document.body.style.overflow = 'hidden'; }
  function unlockScroll() { document.body.style.overflow = ''; }

  function openLeft()  { sidebarLeft.classList.add('open');    lockScroll(); }
  function closeLeft() { sidebarLeft.classList.remove('open'); unlockScroll(); }
  function openPicker()  { sidebarRight.classList.add('picker-open'); }
  function closePicker() { sidebarRight.classList.remove('picker-open'); }
  function closeAll() {
    sidebarLeft.classList.remove('open');
    sidebarRight.classList.remove('picker-open');
    unlockScroll();
  }

  leftToggleBtn?.addEventListener('click', function() {
    if (sidebarLeft.classList.contains('open')) closeLeft();
    else openLeft();
  });
  pickerCloseBtn?.addEventListener('click', closePicker);
  backdrop?.addEventListener('click', closeAll);

  document.addEventListener('atelier:slotSelected', function(e) {
    if (!isMobile()) return;
    if (e.detail.active) openPicker();
    else closePicker();
  });

  // Clic sur zone centrale : ferme les overlays ouverts
  document.querySelector('.center')?.addEventListener('click', function(e) {
    if (!isMobile()) return;
    if (e.target.closest('.slot')) return;               // slot → selectSlot gère
    if (e.target.closest('#atelier-left-toggle')) return; // toggle → leftToggleBtn gère
    if (e.target.closest('.craft-drawer')) return;        // dans le tiroir craft → ignore
    if (sidebarRight.classList.contains('picker-open')) {
      closePicker();
      document.dispatchEvent(new CustomEvent('atelier:deselectSlot'));
    }
    if (sidebarLeft.classList.contains('open')) closeLeft();
    const craftDrawer = document.getElementById('craft-drawer');
    if (craftDrawer?.classList.contains('open')) craftDrawer.classList.remove('open');
  });

  window.addEventListener('resize', function() {
    if (!isMobile()) closeAll();
  });
})();
