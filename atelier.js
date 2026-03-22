(() => {
  'use strict';

  /* ══ RARETÉS ══ */
  const RARITIES = {
    commun:     { label:'Commun',     color:'#59d059' },
    rare:       { label:'Rare',       color:'#4a80d4' },
    epique:     { label:'Épique',     color:'#9a5de8' },
    legendaire: { label:'Légendaire', color:'#d7af5f' },
    mythique:   { label:'Mythique',   color:'#e898cc' },
    godlike:    { label:'Godlike',    color:'#c03828' },
  };

  /* ══ CLASSES ══ */
  const CLASSES = [
    { id:'guerrier', label:'Guerrier', ico:'🛡️'  },
    { id:'assassin', label:'Assassin', ico:'⚔️'  },
    { id:'archer',   label:'Archer',   ico:'🏹'  },
    { id:'mage',     label:'Mage',     ico:'📖'  },
    { id:'shaman',   label:'Shaman',   ico:'🌿'  },
  ];

  /* ══ DÉFINITION DES STATS ══ */
  const STAT_GROUPS = [
    {
      label: 'Offensif',
      stats: [
        { id:'degats',              label:'Dégâts',                          icon:'🗡️',  unit:'',   max:500  },
        { id:'degats_arme',         label:'Dégâts d\'Arme',                  icon:'⚔️',  unit:'%',  max:300  },
        { id:'degats_magique',      label:'Dégâts Magiques',                 icon:'📖',  unit:'%',  max:300  },
        { id:'degats_capacite',     label:'Dégâts de Capacité',              icon:'💥',  unit:'',   max:300  },
        { id:'degats_projectile',   label:'Dégâts de Projectile',            icon:'🏹',  unit:'',   max:300  },
        { id:'vitesse_attaque',     label:'Vitesse d\'Attaque',              icon:'💨',  unit:'',   max:200  },
        { id:'crit_chance',         label:'Chance Coups Critiques',          icon:'🎯',  unit:'%',  max:100  },
        { id:'crit_degats',         label:'Dégâts Coups Critiques',          icon:'💢',  unit:'%',  max:500  },
        { id:'crit_comp_chance',    label:'Chance Critique Compétence',      icon:'🎯',  unit:'%',  max:100  },
        { id:'crit_comp_degats',    label:'Dégâts Critique Compétence',      icon:'💢',  unit:'%',  max:500  },
      ]
    },
    {
      label: 'Défensif',
      stats: [
        { id:'defense',             label:'Défense',                         icon:'🛡️',  unit:'',   max:1000 },
        { id:'sante',               label:'Santé',                           icon:'❤️',  unit:'',   max:2000 },
        { id:'esquive',             label:'Esquive',                         icon:'💨',  unit:'%',  max:100  },
        { id:'reduction_degats',    label:'Réduction de Dégâts',             icon:'🔰',  unit:'%',  max:100  },
        { id:'tenacite',            label:'Ténacité',                        icon:'🏋️',  unit:'%',  max:100  },
      ]
    },
    {
      label: 'Mobilité & Ressources',
      stats: [
        { id:'hate',                label:'Hâte',                            icon:'🌀',  unit:'%',  max:100  },
        { id:'vitesse_deplacement', label:'Vitesse de Déplacement',          icon:'💨',  unit:'/s', max:100  },
        { id:'mana',                label:'Mana',                            icon:'💧',  unit:'',   max:1000 },
        { id:'stamina',             label:'Stamina',                         icon:'👟',  unit:'',   max:1000 },
      ]
    },
    {
      label: 'Régénération & Soutien',
      stats: [
        { id:'soin_bonus',          label:'Soin Bonus',                      icon:'✳️',  unit:'',   max:500  },
        { id:'regen_sante',         label:'Régénération Santé',              icon:'💓',  unit:'/s', max:200  },
        { id:'regen_mana',          label:'Régénération Mana',               icon:'💦',  unit:'/s', max:200  },
        { id:'regen_stamina',       label:'Régénération Stamina',            icon:'👟',  unit:'/s', max:200  },
      ]
    },
  ];

  const ALL_STATS = STAT_GROUPS.flatMap(g => g.stats);

  /* ══ HELPERS FOURCHETTES ══ */
  function getMin(val) { return Array.isArray(val) ? val[0] : val; }
  function getMax(val) { return Array.isArray(val) ? val[1] : val; }

  const ITEMS = [
    { id:'dague_entr',    name:"Dague d'Entrainement",   rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_dentrainement.png",            stats:{degats:7, vitesse_attaque:1.2} },
    { id:'epee_entr',     name:"Épée d'Entrainement",    rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_dentrainement.png",             stats:{degats:12, vitesse_attaque:1}, classes:['guerrier'] },
    { id:'boucl_paco',    name:"Bouclier de Pacotille",  rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_de_pacotille.png",          stats:{sante:5}, classes:['guerrier'] },
    { id:'dague_dela',    name:"Dague Délabrée",         rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_delabree.png",                 stats:{degats:13.5, vitesse_attaque:1.1}, classes:['assassin'] },
    { id:'arc_courbe',    name:"Arc Courbé",             rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_courbe.png",                     stats:{degats:3, vitesse_attaque:1}, classes:['archer'] },
    { id:'baton_med_mag', name:"Bâton Médiocre",         rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_mediocre_mage.png",            stats:{degats:6.5, vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_med_sha', name:"Bâton Médiocre",         rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_mediocre_shaman.png",          stats:{degats:6.2, vitesse_attaque:1, soin_bonus:1}, classes:['shaman'] },
    { id:'epee_fer',      name:"Épée en Fer",            rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_en_fer.png",                    stats:{degats:[14,16], vitesse_attaque:1}, classes:['guerrier'] },
    { id:'boucl_ika',     name:"Bouclier d'Ika",         rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_dika.png",                  stats:{sante:[8,12], defense:[1,1.5]}, classes:['guerrier'] },
    { id:'boucl_bois',    name:"Bouclier Pointu Bois",   rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_pointu_en_bois.png",        stats:{sante:[4,6], defense:[0.5,0.8], degats:0.5}, classes:['guerrier'] },
    { id:'dague_int',     name:"Dague Intermédiaire",    rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_intermediaire.png",            stats:{degats:[17,20], vitesse_attaque:[1.1,1.2]}, classes:['assassin'] },
    { id:'hache_fer',     name:"Hache Double en Fer",    rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/hache_double_en_fer.png",            stats:{degats:[17,19], vitesse_attaque:0.9}, classes:['guerrier'] },
    { id:'arc_sylv',      name:"Arc Sylvestre",          rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_sylvestre.png",                  stats:{degats:[4,6], vitesse_attaque:1}, classes:['archer'] },
    { id:'baton_sylv_mag',name:"Bâton Sylvestre",        rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_sylvestre_mage.png",           stats:{degats:[12,13], vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_sylv_sha',name:"Bâton Sylvestre",        rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_sylvestre_shaman.png",           stats:{degats:[8,10], vitesse_attaque:1, soin_bonus:[1,2]}, classes:['shaman'] },
    { id:'grim_delie',    name:"Grimoire Delié",         rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_delie-sauvage.png",         stats:{degats_magique:2, mana:5}, classes:['mage'] },
    { id:'grim_sauvage',  name:"Grimoire Sauvage",       rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_delie-sauvage.png",         stats:{regen_mana:0.1, mana:5}, classes:['shaman'] },
    { id:'grim_sylv',     name:"Grimoire Sylvestre",     rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_sylvestre.png",             stats:{degats_magique:2.5, mana:7.5}, classes:['mage'] },
    { id:'grim_best',     name:"Grimoire Bestial",       rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_bestial.png",               stats:{regen_mana:0.15, mana:7.5}, classes:['shaman'] },
    { id:'grim_mag',      name:"Grimoire du Magicien",   rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_du_magicien.png",           stats:{degats_magique:3.5, mana:10}, classes:['mage'] },
    { id:'grim_sor',      name:"Grimoire du Sorcier",    rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_du_sorcier.png",            stats:{regen_mana:0.25, mana:10}, classes:['shaman'] },
    { id:'grim_obsc',     name:"Grimoire Obscur",   rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_obscur.png",           stats:{degats_magique:4, mana:12.5}, classes:['mage'] },
    { id:'grim_fant',     name:"Grimoire Fantomatique",    rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_fantome.png",            stats:{regen_mana:0.3, mana:12.5}, classes:['shaman'] },
    { id:'boucl_syl',     name:"Bouclier Sylvestre",     rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_sylvestre.png",             stats:{sante:15, defense:1.7}, classes:['guerrier'] },
    { id:'marteau_col',   name:"Marteau du Colosse",     rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/marteau_du_colosse.png",             stats:{degats:23, vitesse_attaque:0.8}, classes:['guerrier'] },
    { id:'epee_oss',      name:"Épée Osseuse",           rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_osseuse.png",                   stats:{degats:17.5, vitesse_attaque:1}, classes:['guerrier'] },
    { id:'baton_sque_mag',name:"Bâton de Squelette",     rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_squelettique.png",             stats:{degats:15, vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_sque_sha',name:"Bâton de Squelette",     rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_squelettique.png",             stats:{degats:12, vitesse_attaque:1, soin_bonus:2.5}, classes:['shaman'] },
    { id:'baton_maudit_m',name:"Bâton Squelette Maudit", rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_de_squelette_maudit_mage.png", stats:{degats:18, vitesse_attaque:1.1, degats_competence:2.5, sante:-10, mana:-5}, classes:['mage'] },
    { id:'baton_maudit_s',name:"Bâton Squelette Maudit", rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_de_squelette_maudit_shaman.png",stats:{degats:14, vitesse_attaque:1.1, soin_bonus:3.5, regen_mana:0.2, sante:-20}, classes:['shaman'] },
    { id:'arbalete',      name:"Arbalète de Bandit",     rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arbalete_de_bandit.png",             stats:{degats:12, vitesse_attaque:0.7}, classes:['archer'] },
    { id:'dague_band',    name:"Dague de Bandit",        rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_de_bandit.png",                stats:{degats:25, vitesse_attaque:1.2}, classes:['assassin'] },
    { id:'epee_mag',      name:"Épée Magique",           rarity:'',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_magique.png",                   stats:{degats:[18,20], vitesse_attaque:1.1}, classes:['guerrier'] },
    { id:'epee_gard',     name:"Épée du Gardien",        rarity:'',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_du_gardien.png",                   stats:{degats:[20,24], vitesse_attaque:1.1, crit_chance:[8,12]}, classes:['guerrier'] },
    { id:'nodachi',       name:"Nodachi",                rarity:'mythique',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/nodachi.png",                   stats:{degats:45, vitesse_attaque:1.2, crit_chance:10, crit_degats:10}, classes:['guerrier'] },
    { id:'boucl_res',     name:"Bouclier Résistant de Tolbana",   rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_resistant_de_tolbana.png",        stats:{sante:[16,20], defense:[1.9,2.1]}, classes:['guerrier'] },
    { id:'boucl_pui',     name:"Bouclier Puissant de Tolbana",   rarity:'',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_puissant_de_tolbana.png",        stats:{sante:[8,12], defense:[1.2,1.4], degats:2}, classes:['guerrier'] },
    { id:'boucl_ill',     name:"Bouclier de Illfang",   rarity:'mythique',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_de_illfang.png",        stats:{sante:45, defense:5}, classes:['guerrier'] },

    { id:'anneau_pumba',  name:"Anneau de Pumba",        rarity:'legendaire',cat:'anneau',  tier:1, img:"img/compendium/textures/trinkets/P1/Anneau de Pumba.png",            stats:{sante:10, defense:1} },
  ];

  /* ══ SLOTS ══ */
  const SLOTS_LEFT = [
    { id:'amulette',  label:'Amulette',        ico:'📿', cats:['amulette'] },
    { id:'anneau1',   label:'Anneau I',        ico:'💍', cats:['anneau'] },
    { id:'anneau2',   label:'Anneau II',       ico:'💍', cats:['anneau'] },
    { id:'bracelet',  label:'Bracelet',        ico:'⭕', cats:['bracelet'] },
    { id:'gants',     label:'Gants',           ico:'🧤', cats:['gants'] },
  ];
  const SLOTS_RIGHT = [
    { id:'casque',    label:'Casque',          ico:'🧢', cats:['casque'] },
    { id:'plastron',  label:'Plastron',        ico:'👔', cats:['plastron'] },
    { id:'jambieres', label:'Jambières',       ico:'👖', cats:['jambière'] },
    { id:'bottes',    label:'Bottes',          ico:'👢', cats:['bottes'] },
    { id:'arme_pr',   label:'Arme Principale', ico:'⚔️', cats:['arme_p'] },
  ];
  const SLOTS_BOT = [
    { id:'artefact1', label:'Artefact I',      ico:'🔮', cats:['artefact'] },
    { id:'artefact2', label:'Artefact II',     ico:'🔮', cats:['artefact'] },
    { id:'artefact3', label:'Artefact III',    ico:'🔮', cats:['artefact'] },
    { id:'arme_sec',  label:'Arme Secondaire', ico:'🛡️', cats:['arme_s'] },
  ];
  const ALL_SLOTS = [...SLOTS_LEFT, ...SLOTS_RIGHT, ...SLOTS_BOT];
  /* ══ ÉTAT ══ */
  let equipped    = {};
  let activeSlot  = null;
  let filterQ     = '';
  let filterRar   = null;
  let activeClass = null;   /* null = toutes classes */

  /* ══ SÉLECTEUR DE CLASSE ══ */
  function buildClassPicker() {
    const wrap = document.getElementById('class-picker');
    if (!wrap) return;
    wrap.innerHTML = '';

    /* Bouton "Toutes" */
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
      activeClass = btn.dataset.c || null;
      wrap.querySelectorAll('.class-btn').forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
      /* Vider les slots dont l'item n'est plus compatible */
      Object.keys(equipped).forEach(function(slotId) {
        const item = equipped[slotId];
        if (item && !itemAllowedForClass(item, activeClass)) {
          delete equipped[slotId];
          redrawSlot(slotId);
        }
      });
      renderStats();
      renderItemList();
    });
  }

  /* Retourne true si l'item est utilisable par la classe donnée */
  function itemAllowedForClass(item, classId) {
    if (!classId) return true;                          /* toutes classes sélectionnées */
    if (!item.classes || item.classes.length === 0) return true; /* pas de restriction */
    return item.classes.includes(classId);
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
    el.classList.remove('filled','active');
    if (slotDef.id === activeSlot) el.classList.add('active');

    const btnDel = document.createElement('button');
    btnDel.className = 'slot-del'; btnDel.textContent = '✕';
    btnDel.addEventListener('click', e => { e.stopPropagation(); clearSlot(slotDef.id); });
    el.appendChild(btnDel);

    if (item) {
      el.classList.add('filled');
      const col = (RARITIES[item.rarity]||{color:'#888'}).color;
      const dot = document.createElement('span');
      dot.className = 'slot-dot'; dot.style.background = col;
      el.appendChild(dot);
      if (item.img) {
        const img = document.createElement('img');
        img.src = item.img; img.alt = item.name; img.className = 'slot-img';
        el.appendChild(img);
      } else {
        appendDiv(el, 'slot-icon', slotDef.ico);
      }
      appendDiv(el, 'slot-name', item.name);
    } else {
      appendDiv(el, 'slot-icon', slotDef.ico);
      appendDiv(el, 'slot-label', slotDef.label);
    }
  }

  function appendDiv(parent, cls, text) {
    const d = document.createElement('div');
    d.className = cls; d.textContent = text;
    parent.appendChild(d);
  }

  function redrawSlot(slotId) {
    const def = ALL_SLOTS.find(s => s.id === slotId);
    const el  = document.querySelector('.slot[data-slot-id="' + slotId + '"]');
    if (def && el) drawSlot(el, def);
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
      });
    });
  }

  function computeStats() {
    const mins = {};
    const maxs = {};
    ALL_STATS.forEach(s => { mins[s.id] = 0; maxs[s.id] = 0; });

    Object.values(equipped).forEach(item => {
      if (!item || !item.stats) return;
      Object.entries(item.stats).forEach(function(entry) {
        const key = entry[0]; const val = entry[1];
        if (!(key in mins)) return;
        mins[key] += getMin(val);
        maxs[key] += getMax(val);
      });
    });
    return { mins: mins, maxs: maxs };
  }

  function renderStats() {
    const result = computeStats();
    const mins = result.mins; const maxs = result.maxs;
    ALL_STATS.forEach(function(stat) {
      const valEl = document.getElementById('sv-' + stat.id);
      const barEl = document.getElementById('sb-' + stat.id);
      if (!valEl || !barEl) return;

      const lo = mins[stat.id] || 0;
      const hi = maxs[stat.id] || 0;

      if (hi === 0) {
        valEl.innerHTML = '—';
        valEl.className = 'stat-value';
      } else if (lo === hi) {
        valEl.innerHTML = lo + stat.unit;
        valEl.className = 'stat-value nonzero';
      } else {
        valEl.innerHTML =
          '<span class="sv-hi">' + hi + stat.unit + '</span>' +
          '<span class="sv-lo">' + lo + stat.unit + '</span>';
        valEl.className = 'stat-value nonzero has-range';
      }

      const pct = Math.min(100, Math.round((hi / stat.max) * 100));
      barEl.style.width = pct + '%';
      if      (pct >= 75) barEl.style.background = '#d7af5f';
      else if (pct >= 40) barEl.style.background = '#9a7040';
      else                barEl.style.background = 'rgba(255,255,255,.12)';
    });
  }

  /* ══ SÉLECTION ══ */
  function selectSlot(slotId) {
    activeSlot = slotId;
    document.querySelectorAll('.slot').forEach(function(el) {
      el.classList.toggle('active', el.dataset.slotId === slotId);
    });
    renderPickerInfo();
    renderItemList();
  }

  function renderPickerInfo() {
    const box = document.getElementById('picker-info');
    if (!activeSlot) { box.innerHTML = '<div class="psi-hint">Cliquez sur un emplacement</div>'; return; }
    const s = ALL_SLOTS.find(function(x) { return x.id === activeSlot; });
    box.innerHTML = '<div class="psi-label">Emplacement sélectionné</div><div class="psi-name">' + s.ico + ' ' + s.label + '</div>';
  }

  function clearSlot(slotId) {
    delete equipped[slotId];
    redrawSlot(slotId);
    renderStats();
    if (activeSlot === slotId) renderItemList();
  }

  /* ══ PICKER ══ */
  function buildFilters() {
    const wrap = document.getElementById('filters-wrap');
    wrap.innerHTML = '';
    const all = document.createElement('button');
    all.className = 'rarity-chip active'; all.textContent = 'Tout'; all.dataset.r = '';
    wrap.appendChild(all);
    Object.entries(RARITIES).forEach(function(entry) {
      const k = entry[0]; const v = entry[1];
      const btn = document.createElement('button');
      btn.className = 'rarity-chip'; btn.dataset.r = k; btn.textContent = v.label;
      btn.style.borderColor = v.color + '60';
      wrap.appendChild(btn);
    });
    wrap.addEventListener('click', function(e) {
      const chip = e.target.closest('.rarity-chip'); if (!chip) return;
      filterRar = chip.dataset.r || null;
      wrap.querySelectorAll('.rarity-chip').forEach(function(c) { c.classList.remove('active'); });
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
      return (Array.isArray(e[1]) ? e[1][1] : e[1]) > 0;
    });
    if (!entries.length) return '';

    const lines = entries.map(function(e) {
      const key = e[0]; const val = e[1];
      const statDef = ALL_STATS.find(function(s) { return s.id === key; });
      const label = statDef ? statDef.label : key;
      const unit  = statDef ? statDef.unit  : '';
      const icon  = statDef ? statDef.icon  : '';
      return '<div class="istat-row">' +
             '<span class="istat-icon">' + icon + '</span>' +
             '<span class="istat-label">' + label + '</span>' +
             '<span class="istat-val">' + formatStatValue(val, unit) + '</span>' +
             '</div>';
    }).join('');

    return '<div class="istat-block">' + lines + '</div>';
  }

  /* Badge classes affiché dans le picker */
  function buildClassBadgesHTML(item) {
    if (!item.classes || item.classes.length === 0) return '';
    const badges = item.classes.map(function(cid) {
      const cls = CLASSES.find(function(c) { return c.id === cid; });
      if (!cls) return '';
      return '<span class="item-class-badge">' + cls.ico + ' ' + cls.label + '</span>';
    }).join('');
    return '<div class="item-class-badges">' + badges + '</div>';
  }

  function renderItemList() {
    const list = document.getElementById('items-list');
    if (!activeSlot) { list.innerHTML = '<div class="picker-empty-msg">Sélectionnez un emplacement</div>'; return; }
    const slot = ALL_SLOTS.find(function(s) { return s.id === activeSlot; });
    const norm = function(str) { return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); };
    const q    = norm(filterQ);
    const visible = ITEMS.filter(function(item) {
      return slot.cats.includes(item.cat) &&
             itemAllowedForClass(item, activeClass) &&
             (!filterRar || item.rarity === filterRar) &&
             (!q || norm(item.name).includes(q));
    });
    if (!visible.length) { list.innerHTML = '<div class="picker-empty-msg">Aucun item compatible</div>'; return; }
    list.innerHTML = '';
    visible.forEach(function(item) {
      const row = document.createElement('div');
      row.className = 'item-row';
      if (equipped[activeSlot] && equipped[activeSlot].id === item.id) row.classList.add('active');
      const rarColor = (RARITIES[item.rarity]||{color:'#888'}).color;
      const rarLabel = (RARITIES[item.rarity]||{label:item.rarity}).label;
      row.innerHTML =
        '<div class="item-thumb">' +
          (item.img ? '<img src="' + item.img + '" alt="' + item.name + '">' : '<span>📦</span>') +
          '<div class="item-thumb-bar" style="background:' + rarColor + '"></div>' +
        '</div>' +
        '<div class="item-meta">' +
          '<div class="item-meta-name">' + item.name + '</div>' +
          '<div class="item-meta-rarity" style="color:' + rarColor + '">' + rarLabel + ' · Palier ' + item.tier + '</div>' +
          buildClassBadgesHTML(item) +
          buildItemStatsHTML(item) +
        '</div>';
      row.addEventListener('click', function() {
        equipped[activeSlot] = item;
        redrawSlot(activeSlot);
        renderStats();
        renderItemList();
      });
      list.appendChild(row);
    });
  }

  /* ══ BOUTONS ══ */
  document.getElementById('btn-export').addEventListener('click', function() {
    const name = document.getElementById('inp-name').value.trim() || 'Mon Stuff';
    const cls  = activeClass ? (CLASSES.find(function(c) { return c.id === activeClass; }) || {label:'?'}).label : 'Toutes classes';
    let txt = '══════════════════════════\n  ' + name + '\n  Classe : ' + cls + '\n  Veilleurs au Clair de Lune\n══════════════════════════\n\n';
    ALL_SLOTS.forEach(function(s) {
      const it = equipped[s.id];
      txt += s.label.padEnd(20) + ': ' + (it ? it.name + ' [' + ((RARITIES[it.rarity]||{label:''}).label) + ']' : '—') + '\n';
    });
    txt += '\n── Stats totales ──\n';
    const result = computeStats();
    const mins = result.mins; const maxs = result.maxs;
    ALL_STATS.forEach(function(s) {
      const lo = mins[s.id]; const hi = maxs[s.id];
      if (hi > 0) {
        const val = lo === hi ? (hi + s.unit) : (lo + s.unit + ' – ' + hi + s.unit);
        txt += s.label.padEnd(35) + ': ' + val + '\n';
      }
    });
    document.getElementById('modal-ta').value = txt;
    document.getElementById('modal').classList.add('open');
  });

  document.getElementById('btn-import').addEventListener('click', function() {
    const raw = prompt('Collez le JSON de votre stuff :');
    if (!raw) return;
    try { equipped = JSON.parse(raw); buildGrid(); renderStats(); renderPickerInfo(); renderItemList(); }
    catch(e) { alert('JSON invalide.'); }
  });

  document.getElementById('btn-reset').addEventListener('click', function() {
    if (!confirm('Réinitialiser ?')) return;
    equipped = {}; activeSlot = null;
    buildGrid(); renderStats(); renderPickerInfo(); renderItemList();
  });

  document.getElementById('btn-copy').addEventListener('click', function() {
    document.getElementById('modal-ta').select();
    document.execCommand('copy');
    const b = document.getElementById('btn-copy');
    b.textContent = '✓ Copié !';
    setTimeout(function() { b.textContent = '◈ Copier'; }, 1600);
  });

  function closeModal() { document.getElementById('modal').classList.remove('open'); }
  document.getElementById('btn-modal-close').addEventListener('click',  closeModal);
  document.getElementById('btn-modal-close2').addEventListener('click', closeModal);
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === document.getElementById('modal')) closeModal();
  });

  document.getElementById('inp-search').addEventListener('input', function(e) {
    filterQ = e.target.value.trim(); renderItemList();
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

    const skin = document.getElementById('mq-skin');
    if (skin) { skin.style.width = W + 'px'; skin.style.height = colH + 'px'; }

    const totalW = 2 * S + W + 2 * G;
    const rowBot = document.getElementById('row-bot');
    if (rowBot) rowBot.style.width = totalW + 'px';

    mq.style.width = totalW + 'px';
  }

  window.addEventListener('resize', fitGrid);

  function init() {
    buildClassPicker();
    buildGrid();
    buildFilters();
    buildStatsUI();
    renderStats();
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