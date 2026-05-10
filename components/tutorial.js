(function () {
  'use strict';

  // Capture hash BEFORE creator.js DOMContentLoaded changes anything
  var _initialHash = location.hash.replace('#', '');
  var _validModes  = ['item', 'mob', 'pnj', 'region', 'quest', 'panoplie'];

  // ── TUTORIAL DATA ──────────────────────────────────────────────────────────

  var TUTORIALS = {
    quickstart: {
      steps: [
        {
          selector: null,
          title: 'Bienvenue dans le Creator !',
          body: 'Cet outil permet de soumettre du contenu wiki (items, mobs, PNJ, régions, quêtes, panoplies) à la modération. Ce guide te montrera les étapes essentielles.',
          position: 'center',
        },
        {
          selector: '.header-right',
          title: 'Identification',
          body: 'Entre ton pseudo dans le champ 👤, ou connecte-toi avec 🔑 Connexion pour des soumissions trackées. Les comptes ont accès à plus de fonctionnalités.',
          position: 'bottom',
        },
        {
          selector: '.mode-selector',
          title: 'Type de contenu',
          body: 'Sélectionne ici le type de contenu à soumettre : Item, Mob, PNJ, Région, Quête ou Panoplie. Chaque mode a son formulaire dédié.',
          position: 'bottom',
        },
        {
          selector: '#formPanel',
          title: 'Le formulaire',
          body: 'Les sections sont dépliables — clique sur un en-tête pour l\'ouvrir ou fermer. Les champs marqués * sont obligatoires.',
          position: 'right',
        },
        {
          selector: '.out-panel',
          title: 'Aperçu en temps réel',
          body: 'Ce panneau montre une prévisualisation de ta soumission en direct. L\'onglet Historique liste les soumissions de la session.',
          position: 'left',
        },
        {
          selector: '#btn-submit-discord',
          title: 'Soumettre',
          body: 'Quand le formulaire est prêt, clique ici pour envoyer ta soumission à la modération. Elle sera vérifiée avant d\'être publiée sur le wiki.',
          position: 'bottom',
        },
      ],
    },
    item: {
      mode: 'item',
      steps: [
        {
          selector: '.mode-btn[data-mode="item"]',
          title: '⚔️ Mode Item',
          body: 'Active le mode Item pour soumettre armes, armures, consommables et autres objets du jeu.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('item'); },
        },
        {
          selector: '#screens-drop-zone',
          title: '📸 Screenshots',
          body: 'Colle (Ctrl+V), glisse ou clique pour ajouter des captures. Une infobulle + un sprite permettent aux modérateurs de valider rapidement ta soumission.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="item-identity"]'); },
        },
        {
          selector: '[data-tuto="item-identity"]',
          title: '📋 Identité',
          body: 'Le nom génère l\'ID unique automatiquement. Choisis la rareté, la catégorie, le slot et le palier. Les champs * sont obligatoires.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="item-identity"]'); },
        },
        {
          selector: '#stats-section',
          title: '📊 Stats',
          body: 'Ajoute les statistiques de l\'item. Min seul = valeur fixe. Min + Max = plage aléatoire. Les stats sont groupées par catégorie (offensif, défensif…).',
          position: 'right',
          onEnter: function () {
            var el = document.getElementById('stats-section');
            if (el) el.style.display = 'flex';
            forceShowSection('#stats-section');
          },
        },
        {
          selector: '#craft-section',
          title: '🔨 Craft',
          body: 'Si l\'item se craft, liste les ingrédients et leurs quantités. Les IDs non encore existants sont acceptés — ils apparaissent en "drop orphelin".',
          position: 'right',
          onEnter: function () { forceShowSection('#craft-section'); },
        },
        {
          selector: '[data-tuto="item-lore"]',
          title: '📖 Lore & Obtention',
          body: 'Ajoute le lore (texte narratif) et les sources d\'obtention : drops de mobs, donjons, PNJ marchands, quêtes, ressources récoltables.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="item-lore"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Prêt ? Clique pour envoyer l\'item à la modération. Une note optionnelle peut être ajoutée en bas de page avant de soumettre.',
          position: 'bottom',
        },
      ],
    },
    mob: {
      mode: 'mob',
      steps: [
        {
          selector: '.mode-btn[data-mode="mob"]',
          title: '👾 Mode Mob',
          body: 'Pour soumettre un ennemi : monstre standard, mini-boss, boss ou sbire.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('mob'); },
        },
        {
          selector: '[data-tuto="mob-identity"]',
          title: '👾 Identité',
          body: 'Nom, type (Monstre/Mini-Boss/Boss/Sbire), comportement (Agressif/Neutre/Passif). Coche "Codex" si ce mob a une entrée — le lore devient alors obligatoire.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="mob-identity"]'); },
        },
        {
          selector: '[data-tuto="mob-loot"]',
          title: '🎁 Loot',
          body: 'Ajoute les items droppés et leur taux de drop (0–100 %). Tu peux mettre "?" si le taux est inconnu. Les IDs fantômes sont signalés et acceptés.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="mob-loot"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Envoie le mob à la modération. Indique la région et les coordonnées pour les boss et mini-boss.',
          position: 'bottom',
        },
      ],
    },
    pnj: {
      mode: 'pnj',
      steps: [
        {
          selector: '.mode-btn[data-mode="pnj"]',
          title: '🧑 Mode PNJ',
          body: 'Pour soumettre un personnage non-joueur : marchand, artisan, donneur de quêtes, etc.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('pnj'); },
        },
        {
          selector: '[data-tuto="pnj-identity"]',
          title: '🧑 Identité',
          body: 'Choisis la catégorie (Craft, Artisans, Commerce…) puis le type spécifique. Renseigne les coordonnées et la région pour le placer sur la carte.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="pnj-identity"]'); },
        },
        {
          selector: '[data-tuto="pnj-ventes"]',
          title: '🛒 Ventes',
          body: 'Si le PNJ vend des items, liste-les avec leur prix d\'achat et de rachat. Recherche les items par nom dans la liste existante.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="pnj-ventes"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Envoie le PNJ à la modération.',
          position: 'bottom',
        },
      ],
    },
    region: {
      mode: 'region',
      steps: [
        {
          selector: '.mode-btn[data-mode="region"]',
          title: '📍 Mode Région',
          body: 'Pour soumettre une zone ou région du jeu.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('region'); },
        },
        {
          selector: '[data-tuto="region-identity"]',
          title: '📍 Identité',
          body: 'Nom, palier et coordonnées. Coche "Codex" si elle apparaît dans le codex — le lore devient obligatoire. Coche "Téléportation" si accessible via le téléporteur.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="region-identity"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Envoie la région à la modération.',
          position: 'bottom',
        },
      ],
    },
    quete: {
      mode: 'quest',
      steps: [
        {
          selector: '.mode-btn[data-mode="quest"]',
          title: '📜 Mode Quête',
          body: 'Pour soumettre une quête principale, secondaire ou tertiaire.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('quest'); },
        },
        {
          selector: '[data-tuto="quest-identity"]',
          title: '📜 Identité',
          body: 'Titre, type (Principale/Secondaire/Tertiaire), palier, zone et PNJ donneur. Les coordonnées de départ localisent le point de départ sur la carte.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="quest-identity"]'); },
        },
        {
          selector: '[data-tuto="quest-objectives"]',
          title: '🎯 Objectifs',
          body: 'Liste les étapes de la quête. Chaque objectif peut être chaîné au suivant pour indiquer une progression logique.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="quest-objectives"]'); },
        },
        {
          selector: '[data-tuto="quest-rewards"]',
          title: '🏆 Récompenses',
          body: 'Items, XP et monnaie obtenus à la fin de la quête.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="quest-rewards"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Envoie la quête à la modération.',
          position: 'bottom',
        },
      ],
    },
    panoplie: {
      mode: 'panoplie',
      steps: [
        {
          selector: '.mode-btn[data-mode="panoplie"]',
          title: '🔗 Mode Panoplie',
          body: 'Pour soumettre un set d\'équipement avec des bonus liés au nombre de pièces équipées.',
          position: 'bottom',
          onEnter: function () { if (typeof switchMode === 'function') switchMode('panoplie'); },
        },
        {
          selector: '[data-tuto="panoplie-identity"]',
          title: '🔗 Identité',
          body: 'Nom du set — l\'ID est généré automatiquement. Les items portant cet ID de set seront liés à cette panoplie.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="panoplie-identity"]'); },
        },
        {
          selector: '[data-tuto="panoplie-bonus"]',
          title: '✨ Bonus par pièces',
          body: 'Définis les bonus actifs selon le nombre de pièces équipées. Ex : +5 Force à 2 pièces, +10 Force à 4 pièces.',
          position: 'right',
          onEnter: function () { forceShowSection('[data-tuto="panoplie-bonus"]'); },
        },
        {
          selector: '#btn-submit-discord',
          title: '◈ Soumettre',
          body: 'Envoie la panoplie à la modération.',
          position: 'bottom',
        },
      ],
    },
  };

  // ── HELPERS ────────────────────────────────────────────────────────────────

  function forceShowSection(selector) {
    var sec = document.querySelector(selector);
    if (!sec) return;
    // Show the section itself if hidden by display:none
    if (sec.style.display === 'none' || getComputedStyle(sec).display === 'none') {
      sec.style.display = 'flex';
    }
    // Expand sec-body if collapsed
    var body = sec.querySelector('.sec-body');
    var head = sec.querySelector('.sec-head');
    if (body && body.classList.contains('hidden')) {
      body.classList.remove('hidden');
      if (head) head.classList.remove('collapsed');
    }
  }

  // ── ENGINE ─────────────────────────────────────────────────────────────────

  var steps        = [];
  var idx          = 0;
  var overlayDarkEl = null; // full-screen dark bg for no-target steps
  var spotlightEl  = null;  // transparent fixed div — box-shadow IS the overlay
  var cardEl       = null;
  var keyHandler   = null;
  var docClickHandler = null;
  var resizeTimer  = null;

  function start(key) {
    var tuto = TUTORIALS[key];
    if (!tuto) return;
    steps = tuto.steps;
    idx = 0;
    buildDOM();
    renderStep(0);
  }

  function buildDOM() {
    cleanup();

    // Full-dark backdrop for steps with no target element
    overlayDarkEl = document.createElement('div');
    overlayDarkEl.className = 'tuto-overlay-dark';
    overlayDarkEl.style.display = 'none';
    overlayDarkEl.addEventListener('click', function () { end(); });

    // Spotlight: transparent box whose box-shadow creates the surrounding dark area
    spotlightEl = document.createElement('div');
    spotlightEl.className = 'tuto-spotlight';
    spotlightEl.style.display = 'none';

    // Tutorial card
    cardEl = document.createElement('div');
    cardEl.className = 'tuto-card';
    cardEl.addEventListener('click', function (e) { e.stopPropagation(); });

    document.body.appendChild(overlayDarkEl);
    document.body.appendChild(spotlightEl);
    document.body.appendChild(cardEl);

    // Close when clicking outside card AND outside spotlight
    docClickHandler = function (e) {
      if (cardEl && cardEl.contains(e.target)) return;
      if (spotlightEl && spotlightEl.style.display !== 'none') {
        var r = spotlightEl.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right &&
            e.clientY >= r.top  && e.clientY <= r.bottom) return;
      }
      end();
    };
    document.addEventListener('click', docClickHandler, true);

    keyHandler = function (e) { if (e.key === 'Escape') end(); };
    document.addEventListener('keydown', keyHandler);
    window.addEventListener('resize', onResize);
  }

  function renderStep(i) {
    var step = steps[i];
    if (!step) return;

    if (step.onEnter) step.onEnter();

    var targetEl = step.selector ? document.querySelector(step.selector) : null;

    if (targetEl) {
      overlayDarkEl.style.display = 'none';
      setTimeout(function () {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
      positionSpotlight(targetEl);
    } else {
      // No target: full dark backdrop, hide spotlight
      overlayDarkEl.style.display = '';
      spotlightEl.style.display   = 'none';
    }

    var isFirst  = i === 0;
    var isLast   = i === steps.length - 1;
    var progress = 'Étape ' + (i + 1) + ' / ' + steps.length;

    cardEl.innerHTML =
      '<div class="tuto-title">' + step.title + '</div>' +
      '<div class="tuto-body">' + step.body + '</div>' +
      '<div class="tuto-nav">' +
        '<button class="tuto-btn-skip" onclick="window.tutorial.end()">✕ Fermer</button>' +
        '<div style="display:flex;gap:6px;">' +
          (!isFirst ? '<button class="tuto-btn-nav" onclick="window.tutorial.prev()">← Préc.</button>' : '') +
          (!isLast
            ? '<button class="tuto-btn-nav tuto-btn-primary" onclick="window.tutorial.next()">Suivant →</button>'
            : '<button class="tuto-btn-nav tuto-btn-primary" onclick="window.tutorial.end()">✓ Terminer</button>') +
        '</div>' +
      '</div>' +
      '<div class="tuto-progress">' + progress + '</div>';

    positionCard(targetEl, step.position || 'bottom');
  }

  var PAD = 8; // padding around spotlight rect

  function positionSpotlight(targetEl) {
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = targetEl.getBoundingClientRect();
        spotlightEl.style.display  = '';
        spotlightEl.style.top      = (rect.top    - PAD) + 'px';
        spotlightEl.style.left     = (rect.left   - PAD) + 'px';
        spotlightEl.style.width    = (rect.width  + PAD * 2) + 'px';
        spotlightEl.style.height   = (rect.height + PAD * 2) + 'px';
      });
    });
  }

  function positionCard(targetEl, position) {
    cardEl.style.top       = '';
    cardEl.style.left      = '';
    cardEl.style.transform = '';

    if (!targetEl || position === 'center') {
      cardEl.style.top       = '50%';
      cardEl.style.left      = '50%';
      cardEl.style.transform = 'translate(-50%,-50%)';
      return;
    }

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var rect = targetEl.getBoundingClientRect();
        var cW   = cardEl.offsetWidth  || 300;
        var cH   = cardEl.offsetHeight || 160;
        var vW   = window.innerWidth;
        var vH   = window.innerHeight;
        var GAP  = 14;
        var top, left;

        if (position === 'bottom') {
          top  = rect.bottom + PAD + GAP;
          left = rect.left + rect.width / 2 - cW / 2;
        } else if (position === 'top') {
          top  = rect.top - PAD - cH - GAP;
          left = rect.left + rect.width / 2 - cW / 2;
        } else if (position === 'right') {
          top  = rect.top + rect.height / 2 - cH / 2;
          left = rect.right + PAD + GAP;
        } else { // left
          top  = rect.top + rect.height / 2 - cH / 2;
          left = rect.left - PAD - cW - GAP;
        }

        left = Math.max(GAP, Math.min(left, vW - cW - GAP));
        top  = Math.max(GAP, Math.min(top,  vH - cH - GAP));

        cardEl.style.left = left + 'px';
        cardEl.style.top  = top  + 'px';
      });
    });
  }

  function next() { if (idx < steps.length - 1) { idx++; renderStep(idx); } else end(); }
  function prev() { if (idx > 0) { idx--; renderStep(idx); } }

  function end() {
    cleanup();
    closeGuideMenu();
  }

  function cleanup() {
    if (overlayDarkEl)    { overlayDarkEl.remove();  overlayDarkEl    = null; }
    if (spotlightEl)      { spotlightEl.remove();    spotlightEl      = null; }
    if (cardEl)           { cardEl.remove();          cardEl           = null; }
    if (keyHandler)       { document.removeEventListener('keydown', keyHandler); keyHandler = null; }
    if (docClickHandler)  { document.removeEventListener('click', docClickHandler, true); docClickHandler = null; }
    window.removeEventListener('resize', onResize);
    clearTimeout(resizeTimer);
  }

  function onResize() {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (!cardEl || !steps[idx]) return;
      var step = steps[idx];
      var targetEl = step.selector ? document.querySelector(step.selector) : null;
      if (targetEl) positionSpotlight(targetEl);
      positionCard(targetEl, step.position || 'bottom');
    }, 100);
  }

  window.tutorial = { start: start, next: next, prev: prev, end: end };

  // ── GUIDE MENU ─────────────────────────────────────────────────────────────

  window.openGuideMenu = function () {
    var existing = document.getElementById('guide-menu');
    if (existing) { closeGuideMenu(); return; }

    var menu = document.createElement('div');
    menu.id = 'guide-menu';
    menu.className = 'guide-menu';
    menu.innerHTML =
      '<div class="guide-menu-title">✦ Tutoriels</div>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'quickstart\');closeGuideMenu()">▸ Quick Start</button>' +
      '<div class="guide-menu-sep"></div>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'item\');closeGuideMenu()">▸ Créer un Item</button>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'mob\');closeGuideMenu()">▸ Créer un Mob</button>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'pnj\');closeGuideMenu()">▸ Créer un PNJ</button>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'region\');closeGuideMenu()">▸ Créer une Région</button>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'quete\');closeGuideMenu()">▸ Créer une Quête</button>' +
      '<button class="guide-menu-item" onclick="tutorial.start(\'panoplie\');closeGuideMenu()">▸ Créer une Panoplie</button>';

    document.body.appendChild(menu);

    var btn = document.getElementById('btn-guide');
    if (btn) {
      var rect = btn.getBoundingClientRect();
      menu.style.top   = (rect.bottom + 6) + 'px';
      menu.style.right = (window.innerWidth - rect.right) + 'px';
    }

    setTimeout(function () {
      document.addEventListener('click', outsideHandler);
    }, 0);
  };

  function outsideHandler(e) {
    var menu = document.getElementById('guide-menu');
    if (!menu) { document.removeEventListener('click', outsideHandler); return; }
    if (!menu.contains(e.target) && e.target.id !== 'btn-guide') {
      closeGuideMenu();
      document.removeEventListener('click', outsideHandler);
    }
  }

  window.closeGuideMenu = function () {
    var menu = document.getElementById('guide-menu');
    if (menu) menu.remove();
  };

  // ── HASH ROUTING ───────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    // Apply initial hash (runs after creator.js DOMContentLoaded since tutorial.js loads last)
    // Don't override if coming from moderation.html (session mode)
    if (!window._vcl_sessionMode && _initialHash && _validModes.indexOf(_initialHash) !== -1) {
      if (typeof window.switchMode === 'function') {
        window.switchMode(_initialHash);
      }
    }

    // Patch switchMode to keep hash in sync on future user switches
    var _orig = window.switchMode;
    window.switchMode = function (mode) {
      if (typeof _orig === 'function') _orig.call(window, mode);
      history.replaceState(null, '', '#' + mode);
    };
  });

})();
