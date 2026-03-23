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
    { id:'guerrier', label:'Guerrier', ico:'⚔️'  },
    { id:'assassin', label:'Assassin', ico:'🗡️'  },
    { id:'archer',   label:'Archer',   ico:'🏹'  },
    { id:'mage',     label:'Mage',     ico:'📖'  },
    { id:'shaman',   label:'Shaman',   ico:'🌿'  },
  ];

  /* ══ PANOPLIES ══ */
  const SETS = {
    cuivre: {
      label: 'Set de Cuivre',
      color: '#b87333',
      bonuses: {
        2: { degats:1 },
        3: { defense:1 },
        4: { degats:1 },
        5: { sante:5 }
      }
    },
    fer: {
      label: 'Set de Fer',
      color: '#cfcfcf',
      bonuses: {
        2: { degats:1.5 },
        3: { sante:10 },
        4: { degats:2 },
        5: { defense:1.5 }
      }
    },
    loup: {
      label: 'Set de Loup Faiblard',
      color: '#e6c146',
      bonuses: {
        2: { vitesse_deplacement:0.25 },
        3: { vitesse_attaque:0.1 },
      }
    },
    slime: {
      label: 'Set des Slimes Gélatineux',
      color: '#7ec850',
      bonuses: {
        2: { regen_sante: 0.1, sante:2.5 },
        3: { regen_sante: 0.1, tenacite: 5 },
        4: { sante: 30, tenacite: 10, regen_sante: 0.3 },
      }
    },
    squelette: {
      label: 'Set Squelette Poussiéreux',
      color: '#8e5bbd',
      bonuses: {
        2: { reduction_degats:5 },
        3: { hate:5 },
        4: { defense:3 },
      }
    },
    sylve: {
      label: 'Set de la Sylve',
      color: '#60e292',
      bonuses: {
        2: { regen_mana:0.1, regen_stamina:0.05 },
        3: { regen_sante:0.05, soin_bonus:1 },
        4: { sante:5, mana:0.5, stamina:0.5 },
      }
    },
    cerf: {
      label: 'Set des Cerfs Paisibles',
      color: '#88653a',
      bonuses: {
        2: { sante:5, degats_competence:1.5 },
        3: { crit_comp_chance:2.5, crit_comp_degats:1.5 },
      }
    },
    ika: {
      label: 'Set d\'Ika',
      color: '#2f572f',
      bonuses: {
        3: { sante:10 },
      }
    },
    titan: {
      label: 'Set du Titan',
      color: '#ac61b8',
      bonuses: {
        3: { defense:2.5 },
        4: { reduction_degats:2 },
      }
    },
    gardien: {
      label: 'Set du Gardien',
      color: '#dd3e3e',
      bonuses: {
        2: { crit_degats:25 },
        3: { defense:4 },
        4: { reduction_degats:5 },
      }
    },
    tactique: {
      label: 'Set Tactique',
      color: '#e5ce4c',
      bonuses: {
        3: { degats:2.5 },
      }
    },
    ninja: {
      label: 'Set du Ninja',
      color: '#191919',
      bonuses: {
        2: { esquive:1.5 },
        3: { esquive:2.5 },
      }
    },
    chasseur: {
      label: 'Set du Chasseur',
      color: '#d4823a',
      bonuses: {
        2: { crit_chance:1.5 },
        3: { crit_chance:2.5 },
      }
    },
    heraut: {
      label: 'Set du Héraut',
      color: '#fcda2d',
      bonuses: {
        2: { crit_chance:15 },
        3: { esquive:4 },
        4: { degats:5 },
      }
    },
    spectral: {
      label: 'Set Spectral',
      color: 'rgb(205, 149, 240)',
      bonuses: {
        3: { degats_magique:5, mana:15 },
      }
    },
    sorcier: {
      label: 'Set du Sorcier',
      color: 'rgb(232, 166, 51)',
      bonuses: {
        2: { mana:15 },
        3: { degats_magique:4 },
      }
    },
    magicien: {
      label: 'Set du Magicien',
      color: 'rgb(228, 200, 153)',
      bonuses: {
        2: { mana:15 },
        3: { hate:4 },
      }
    },
    faucheuse: {
      label: 'Set de la Faucheuse',
      color: 'rgb(86, 31, 161)',
      bonuses: {
        2: { mana:25 },
        3: { degats_magique:5 },
        4: { hate:5 }
      }
    },
  };

  /* ══ DÉFINITION DES STATS ══ */
  const STAT_GROUPS = [
    {
      label: 'Offensif',
      stats: [
        { id:'degats',              label:'Dégâts',                          icon:'🗡️',  unit:'',   max:500  },
        { id:'degats_arme',         label:'Dégâts d\'Arme',                  icon:'⚔️',  unit:'%',  max:100  },
        { id:'degats_magique',      label:'Dégâts Magiques',                 icon:'📖',  unit:'%',  max:100  },
        { id:'degats_competence',   label:'Dégâts de Compétence',            icon:'✨',  unit:'%',  max:100  },
        { id:'degats_projectile',   label:'Dégâts de Projectile',            icon:'🏹',  unit:'%',  max:100  },
        { id:'vitesse_attaque',     label:'Vitesse d\'Attaque',              icon:'💨',  unit:'',   max:200  },
        { id:'crit_chance',         label:'Chance Coups Critiques',          icon:'🎯',  unit:'%',  max:100  },
        { id:'crit_degats',         label:'Dégâts Coups Critiques',          icon:'💢',  unit:'%',  max:100  },
        { id:'crit_comp_chance',    label:'Chance Critique Compétence',      icon:'🎯',  unit:'%',  max:100  },
        { id:'crit_comp_degats',    label:'Dégâts Critique Compétence',      icon:'💢',  unit:'%',  max:100  },
      ]
    },
    {
      label: 'Défensif',
      stats: [
        { id:'defense',             label:'Défense',                         icon:'🛡️',  unit:'',   max:1000 },
        { id:'sante',               label:'Santé',                           icon:'❤️',  unit:'',   max:2000 },
        { id:'esquive',             label:'Esquive',                         icon:'💨',  unit:'%',  max:100  },
        { id:'reduction_degats',    label:'Réduction de Dégâts',             icon:'🔰',  unit:'%',  max:100  },
        { id:'reduction_chutes',    label:'Réduction de Chutes',             icon:'🦘',  unit:'%',  max:100  },
        { id:'tenacite',            label:'Ténacité',                        icon:'🏋️',  unit:'%',  max:100  },
        { id:'res_recul',           label:'Résistance au Recul',             icon:'🔒',  unit:'%',  max:100  },
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
        { id:'vol_vie',             label:'Vol de Vie',                      icon:'🩸',  unit:'%',   max:100  },
        { id:'omnivamp',            label:'Omnivampirisme',                  icon:'👄',  unit:'%',   max:100  },
        { id:'soin_bonus',          label:'Soin Bonus',                      icon:'✳️',  unit:'',   max:500  },
        { id:'regen_sante',         label:'Régénération Santé',              icon:'💓',  unit:'/s', max:200  },
        { id:'regen_mana',          label:'Régénération Mana',               icon:'💦',  unit:'/s', max:200  },
        { id:'regen_stamina',       label:'Régénération Stamina',            icon:'👟',  unit:'/s', max:200  },
      ]
    },
  ];

  const ALL_STATS = STAT_GROUPS.flatMap(g => g.stats);

  /* ══ RUNES ══ */
  const RUNES = [
    { id:'noel',     name:'Rune de Noël',        color:'#e03a3a', stats:{ vol_vie:2, omnivamp:2.5, sante:20, mana:5, stamina:2.5 } },
    { id:'st_val',   name:'Rune de Teddy Bear',  color:'#f4acbc', stats:{ vitesse_attaque:0.2, crit_comp_chance:20, crit_comp_degats:10, defense:2, sante:20 } },
    { id:'lunaire',  name:'Rune Lunaire',        color:'#ecd783', stats:{ crit_chance:7, crit_degats:12, crit_comp_chance:7, crit_comp_degats:12, sante:5 } },
    { id:'dragon',   name:'Rune du Dragon',      color:'#e35f48', stats:{ crit_chance:8, crit_degats:13, crit_comp_chance:8, crit_comp_degats:13, sante:10, vitesse_deplacement:0.15 } },
  ];

  /* ══ HELPERS FOURCHETTES ══ */
  function getMin(val) { return Array.isArray(val) ? val[0] : val; }
  function getMax(val) { return Array.isArray(val) ? val[1] : val; }

  const ITEMS = [
    { id:'dague_entr',      name:"Dague d'Entrainement",          rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_dentrainement.png",            stats:{degats:7, vitesse_attaque:1.2} },
    { id:'epee_entr',       name:"Épée d'Entrainement",           rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_dentrainement.png",             stats:{degats:12, vitesse_attaque:1}, classes:['guerrier'] },
    { id:'boucl_paco',      name:"Bouclier de Pacotille",         rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_de_pacotille.png",          stats:{sante:5}, classes:['guerrier'] },
    { id:'dague_dela',      name:"Dague Délabrée",                rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_delabree.png",                 stats:{degats:13.5, vitesse_attaque:1.1}, classes:['assassin'] },
    { id:'arc_courbe',      name:"Arc Courbé",                    rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_courbe.png",                     stats:{degats:3, vitesse_attaque:1}, classes:['archer'] },
    { id:'baton_med_mag',   name:"Bâton Médiocre",                rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_mediocre_mage.png",            stats:{degats:6.5, vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_med_sha',   name:"Bâton Médiocre",                rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_mediocre_shaman.png",          stats:{degats:6.2, vitesse_attaque:1, soin_bonus:1}, classes:['shaman'] },
    { id:'epee_fer',        name:"Épée en Fer",                   rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_en_fer.png",                    stats:{degats:[14,16], vitesse_attaque:1}, classes:['guerrier'] },
    { id:'boucl_ika',       name:"Bouclier d'Ika",                rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_dika.png",                  stats:{sante:[8,12], defense:[1,1.5]}, classes:['guerrier'] },
    { id:'boucl_bois',      name:"Bouclier Pointu Bois",          rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_pointu_en_bois.png",        stats:{sante:[4,6], defense:[0.5,0.8], degats:0.5}, classes:['guerrier'] },
    { id:'dague_int',       name:"Dague Intermédiaire",           rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_intermediaire.png",            stats:{degats:[17,20], vitesse_attaque:[1.1,1.2]}, classes:['assassin'] },
    { id:'hache_fer',       name:"Hache Double en Fer",           rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/hache_double_en_fer.png",            stats:{degats:[17,19], vitesse_attaque:0.9}, classes:['guerrier'] },
    { id:'arc_sylv',        name:"Arc Sylvestre",                 rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_sylvestre.png",                  stats:{degats:[4,6], vitesse_attaque:1}, classes:['archer'] },
    { id:'baton_sylv_mag',  name:"Bâton Sylvestre",               rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_sylvestre_mage.png",           stats:{degats:[12,13], vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_sylv_sha',  name:"Bâton Sylvestre",               rarity:'commun',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_sylvestre_shaman.png",         stats:{degats:[8,10], vitesse_attaque:1, soin_bonus:[1,2]}, classes:['shaman'] },
    { id:'grim_delie',      name:"Grimoire Delié",                rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_delie-sauvage.png",         stats:{degats_magique:2, mana:5}, classes:['mage'] },
    { id:'grim_sauvage',    name:"Grimoire Sauvage",              rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_delie-sauvage.png",         stats:{regen_mana:0.1, mana:5}, classes:['shaman'] },
    { id:'grim_sylv',       name:"Grimoire Sylvestre",            rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_sylvestre.png",             stats:{degats_magique:2.5, mana:7.5}, classes:['mage'] },
    { id:'grim_best',       name:"Grimoire Bestial",              rarity:'commun',    cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_bestial.png",               stats:{regen_mana:0.15, mana:7.5}, classes:['shaman'] },
    { id:'grim_mag',        name:"Grimoire du Magicien",          rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_du_magicien.png",           stats:{degats_magique:3.5, mana:10}, classes:['mage'] },
    { id:'grim_sor',        name:"Grimoire du Sorcier",           rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_du_sorcier.png",            stats:{regen_mana:0.25, mana:10}, classes:['shaman'] },
    { id:'grim_obsc',       name:"Grimoire Obscur",               rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_obscur.png",                stats:{degats_magique:4, mana:12.5}, classes:['mage'] },
    { id:'grim_fant',       name:"Grimoire Fantomatique",         rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/grimoire_fantome.png",               stats:{regen_mana:0.3, mana:12.5}, classes:['shaman'] },
    { id:'boucl_syl',       name:"Bouclier Sylvestre",            rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_sylvestre.png",             stats:{sante:15, defense:1.7}, classes:['guerrier'] },
    { id:'marteau_col',     name:"Marteau du Colosse",            rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/marteau_du_colosse.png",             stats:{degats:23, vitesse_attaque:0.8}, classes:['guerrier'] },
    { id:'epee_oss',        name:"Épée Osseuse",                  rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_osseuse.png",                   stats:{degats:17.5, vitesse_attaque:1}, classes:['guerrier'] },
    { id:'baton_sque_mag',  name:"Bâton de Squelette",            rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_squelettique.png",             stats:{degats:15, vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_sque_sha',  name:"Bâton de Squelette",            rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_squelettique.png",             stats:{degats:12, vitesse_attaque:1, soin_bonus:2.5}, classes:['shaman'] },
    { id:'baton_maudit_m',  name:"Bâton Squelette Maudit",        rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_de_squelette_maudit_mage.png", stats:{degats:18, vitesse_attaque:1.1, degats_competence:2.5, sante:-10, mana:-5}, classes:['mage'] },
    { id:'baton_maudit_s',  name:"Bâton Squelette Maudit",        rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_de_squelette_maudit_shaman.png",stats:{degats:14, vitesse_attaque:1.1, soin_bonus:3.5, regen_mana:0.2, sante:-20}, classes:['shaman'] },
    { id:'arbalete',        name:"Arbalète de Bandit",            rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arbalete_de_bandit.png",             stats:{degats:12, vitesse_attaque:0.7}, classes:['archer'] },
    { id:'dague_band',      name:"Dague de Bandit",               rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_de_bandit.png",                stats:{degats:25, vitesse_attaque:1.2}, classes:['assassin'] },
    { id:'epee_mag',        name:"Épée Magique",                  rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_magique.png",                   stats:{degats:[18,20], vitesse_attaque:1.1}, classes:['guerrier'] },
    { id:'marteau_mag',     name:"Marteau Magique",               rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/marteau_magique.png",                stats:{degats:[25,30], vitesse_attaque:0.8}, classes:['guerrier'] },
    { id:'epee_gard',       name:"Épée du Gardien",               rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/epee_du_gardien.png",                stats:{degats:[20,24], vitesse_attaque:1.1, crit_chance:[8,12]}, classes:['guerrier'] },
    { id:'hallebarde_roy',  name:"Hallebarde Royale",             rarity:'legendaire',cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/hallebarde_royale.png",              stats:{degats:35, vitesse_attaque:0.7}, classes:['guerrier'] },
    { id:'hache_ill',       name:"Hache de Illfang",              rarity:'legendaire',cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/hache_de_illfang.png",               stats:{degats:60, vitesse_attaque:0.7}, classes:['guerrier'] },
    { id:'nodachi',         name:"Nodachi",                       rarity:'mythique',  cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/nodachi.png",                        stats:{degats:45, vitesse_attaque:1.2, crit_chance:10, crit_degats:10}, classes:['guerrier'] },
    { id:'boucl_res',       name:"Bouclier Résistant de Tolbana", rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_resistant_de_tolbana.png",  stats:{sante:[16,20], defense:[1.9,2.1]}, classes:['guerrier'] },
    { id:'boucl_pui',       name:"Bouclier Puissant de Tolbana",  rarity:'rare',      cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_puissant_de_tolbana.png",   stats:{sante:[8,12], defense:[1.2,1.4], degats:2}, classes:['guerrier'] },
    { id:'boucl_ill',       name:"Bouclier de Illfang",           rarity:'mythique',  cat:'arme_s',  tier:1, img:"img/compendium/textures/weapons/bouclier_de_illfang.png",            stats:{sante:45, defense:5}, classes:['guerrier'] },
    { id:'baton_magicien',  name:"Bâton du Magicien",             rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_tolbana.png",                  stats:{degats:[18,21], vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_sorcier',   name:"Bâton du Sorcier",              rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_tolbana.png",                  stats:{degats:[16,18], vitesse_attaque:1, soin_bonus:[2.5,3.5]}, classes:['shaman'] },
    { id:'baton_magicien_p',name:"Bâton du Magicien Puissant",    rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_tolbana_puissant.png",          stats:{degats:[20,22], vitesse_attaque:1.1, degats_competence:3, sante:-15, mana:-10}, classes:['mage'] },
    { id:'baton_sorcier_p', name:"Bâton du Sorcier Puissant",     rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_tolbana_puissant.png",          stats:{degats:[18,20], vitesse_attaque:1.1, soin_bonus:[3.5,4.5], regen_mana:0.2, sante:-30}, classes:['shaman'] },
    { id:'baton_obscur_m',  name:"Bâton Obscur",                  rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_obscur_mage.png",              stats:{degats:[21.5,24.5], vitesse_attaque:1}, classes:['mage'] },
    { id:'baton_obscur_s',  name:"Bâton Obscur",                  rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_obscur_shaman.png",            stats:{degats:[19,22], vitesse_attaque:1, soin_bonus:[3,4]}, classes:['shaman'] },
    { id:'baton_obscur_m_p',name:"Bâton Obscur Puissant",         rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_obscur_mage.png",              stats:{degats:[23,27], vitesse_attaque:1.1, degats_competence:4, sante:-20, mana:-15}, classes:['mage'] },
    { id:'baton_obscur_s_p',name:"Bâton Obscur Puissant",         rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_obscur_shaman.png",            stats:{degats:[21,22], vitesse_attaque:1.1, soin_bonus:[4.5,5.5], regen_mana:0.3, sante:-40}, classes:['shaman'] },
    { id:'baton_nodachi_m', name:"Bâton Nodachi",                 rarity:'mythique',  cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_nodachi.png",                  stats:{degats:50, vitesse_attaque:1, crit_comp_chance:15}, classes:['mage'] },
    { id:'baton_nodachi_s', name:"Bâton Nodachi",                 rarity:'mythique',  cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/baton_nodachi.png",                  stats:{degats:35, vitesse_attaque:1.2, soin_bonus:10, regen_sante:0.3, regen_mana:0.3}, classes:['shaman'] },
    { id:'dague_sombre',    name:"Dague Sombre",                  rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_sombre.png",                   stats:{degats:[27,31], vitesse_attaque:1.2}, classes:['assassin'] },
    { id:'l_dague_sombre',  name:"Longue Dague Sombre",           rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/longue_dague_sombre.png",            stats:{degats:[35,40], vitesse_attaque:[0.8,0.9]}, classes:['assassin'] },
    { id:'dague_hero',      name:"Dague Héroïque",                rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/dague_heroique.png",                 stats:{degats:[31,35], vitesse_attaque:[1.3,1.5]}, classes:['assassin'] },
    { id:'katana_hero',     name:"Katana Héroïque",               rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/katana_heroique.png",                stats:{degats:[40,44.98], vitesse_attaque:[0.7,0.9]}, classes:['assassin'] },
    { id:'arc_chasse',      name:"Arc de Chasse",                 rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_de_chasse.png",                  stats:{degats:[10,13], vitesse_attaque:1}, classes:['archer'] },
    { id:'arc_fallen',      name:"Arc du Fallen",                 rarity:'epique',    cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arc_du_fallen.png",                  stats:{degats:[14,16], vitesse_attaque:[1,1.1]}, classes:['archer'] },
    { id:'arbalete_chasse', name:"Arbalète de Chasse",            rarity:'rare',      cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arbalete_de_chasse.png",             stats:{degats:[15,19], vitesse_attaque:0.7}, classes:['archer'] },
    { id:'arbalete_cendre', name:"Arbalète de Cendre",            rarity:'legendaire',cat:'arme_p',  tier:1, img:"img/compendium/textures/weapons/arbalete_de_cendre.png",             stats:{degats:23.5, vitesse_attaque:0.7}, classes:['archer'] },

    { id:'anneau_cuivre',   name:"Anneau de Cuivre",      set:'cuivre',    rarity:'commun',    cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set de Cuivre/Anneau de Cuivre.png",                         stats:{sante:5} },
    { id:'anneau_pumba',    name:"Anneau de Pumba",                        rarity:'legendaire',cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Anneau de Pumba.png",                                        stats:{sante:10, defense:1} },
    { id:'anneau_fer',      name:"Anneau de Fer",          set:'fer',       rarity:'rare',      cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set de Fer/Anneau de Fer.png",                               stats:{defense:0.5} },
    { id:'bague_glue',      name:"Bague Gluante",          set:'slime',     rarity:'commun',    cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bague Gluante.png",               stats:{sante:2.5, regen_sante:0.1} },
    { id:'bague_sque',      name:"Bague de Squelette",     set:'squelette', rarity:'commun',    cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Bague de Squelette.png",          stats:{degats_competence:1, sante:2.5} },
    { id:'anneau_sylv',     name:"Anneau Sylvestre",        set:'sylve',     rarity:'rare',      cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set de la Sylve/Anneau Sylvestre.png",                      stats:{soin_bonus:1, mana:1, stamina:0.5, regen_sante:0.2} },
    { id:'anneau_glue',     name:"Anneau Gluant",           set:'slime',     rarity:'epique',    cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Anneau Gluant.png",               stats:{tenacite:15, sante:20, regen_sante:0.5} },
    { id:'anneau_levi',     name:"Anneau de Léviathan",                      rarity:'epique',    cat:'anneau',    tier:1, img:"img/compendium/textures/trinkets/P1/Anneau de Léviathan.png",                                   stats:{defense:2.5} },
    { id:'amulette_cuivre', name:"Amulette de Cuivre",     set:'cuivre',    rarity:'commun',    cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Cuivre/Amulette de Cuivre.png",                      stats:{sante:5} },
    { id:'amulette_bois',   name:"Amulette des Bois",       set:'sylve',     rarity:'commun',    cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de la Sylve/Amulette des Bois.png",                     stats:{degats_competence:2.5, mana:2.5, stamina:1.5} },
    { id:'collier_albal',   name:"Collier de Albal",        set:'loup',      rarity:'rare',      cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set Loup Faiblard/Collier d'Albal.png",                    stats:{crit_chance:5, vitesse_deplacement:0.25} },
    { id:'amulette_glue',   name:"Amulette Gluante",        set:'slime',     rarity:'commun',    cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Amulette Gluante.png",           stats:{soin_bonus:1, regen_sante:0.1} },
    { id:'amulette_fer',    name:"Amulette de Fer",          set:'fer',       rarity:'rare',      cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Fer/Amulette de Fer.png",                           stats:{defense:1, sante:5} },
    { id:'amulette_squel',  name:"Amulette Squelettique",   set:'squelette', rarity:'rare',      cat:'amulette',  tier:1, img:"img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Amulette Squelettique.png",      stats:{degats_competence:1, mana:4, stamina:2} },
    { id:'gants_cuivre',    name:"Gants de Cuivre",          set:'cuivre',    rarity:'commun',    cat:'gants',     tier:1, img:"img/compendium/textures/trinkets/P1/Set de Cuivre/Gants de Cuivre.png",                        stats:{degats:1} },
    { id:'gants_cerfs',     name:"Gants des Cerfs",          set:'cerf',      rarity:'commun',    cat:'gants',     tier:1, img:"img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Gants des Cerfs.png",              stats:{degats_competence:2} },
    { id:'gants_bandit',    name:"Gants de Bandit",                           rarity:'commun',    cat:'gants',     tier:1, img:"img/compendium/textures/trinkets/P1/Gants de Bandit.png",                                      stats:{vitesse_attaque:0.1} },
    { id:'gants_os',        name:"Gants Osseux",              set:'squelette', rarity:'rare',      cat:'gants',     tier:1, img:"img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Gants Osseux.png",              stats:{defense:0.5} },
    { id:'gants_fer',       name:"Gants de Fer",              set:'fer',       rarity:'rare',      cat:'gants',     tier:1, img:"img/compendium/textures/trinkets/P1/Set de Fer/Gants de Fer.png",                             stats:{degats:1.5} },
    { id:'bracelet_cuivre', name:"Bracelet de Cuivre",        set:'cuivre',    rarity:'commun',    cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Cuivre/Bracelet de Cuivre.png",                    stats:{sante:5} },
    { id:'bracelet_fer',    name:"Bracelet de Fer",            set:'fer',       rarity:'rare',      cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Fer/Bracelet de Fer.png",                         stats:{sante:5, defense:1} },
    { id:'bracelet_sylv',   name:"Bracelet Sylvestre",         set:'sylve',     rarity:'commun',    cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de la Sylve/Bracelet Sylvestre.png",                 stats:{regen_sante:0.2, regen_mana:0.2, regen_stamina:0.2} },
    { id:'bracelet_arai',   name:"Bracelet d'Araignée",                         rarity:'rare',      cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Bracelet d'Araignée.png",                               stats:{esquive:2.5, vitesse_deplacement:0.5} },
    { id:'bracelet_glue',   name:"Bracelet Gluant",            set:'slime',     rarity:'rare',      cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bracelet Gluant.png",         stats:{soin_bonus:1, sante:5, regen_sante:0.1} },
    { id:'bracelet_cerf',   name:"Bracelet des Cerfs",          set:'cerf',      rarity:'rare',      cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Bracelet des Cerfs.png",        stats:{mana:2, stamina:1, regen_mana:0.2, regen_stamina:0.2} },
    { id:'bracelet_glace',  name:"Bracelet de Glace",                            rarity:'epique',    cat:'bracelet',  tier:1, img:"img/compendium/textures/trinkets/P1/Bracelet de Glace.png",                                 stats:{degats_competence:5, regen_mana:0.3, regen_stamina:0.2} },
    { id:'manteau_vole',    name:"Manteau Volé",                                  rarity:'commun',    cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Manteau Volé.png",                                    stats:{defense:1.5, sante:10} },
    { id:'lien_sylve',      name:"Lien de la Sylve",            set:'sylve',     rarity:'legendaire',cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de la Sylve/Lien de la Sylve.png",                 stats:{sante:10, mana:10, stamina:5} },
    { id:'piece_cuivre',    name:"Pièce de Cuivre",              set:'cuivre',    rarity:'commun',    cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Cuivre/Pièce de Cuivre.png",                   stats:{defense:1} },
    { id:'piece_fer',       name:"Pièce de Fer",                  set:'fer',       rarity:'rare',      cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Set de Fer/Pièce de Fer.png",                        stats:{defense:1, sante:5} },
    { id:'collier_aragorn', name:"Collier d'Aragorn",                              rarity:'epique',    cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Collier de Aragorn.png",                             stats:{reduction_degats:3, reduction_chutes:25, esquive:3} },
    { id:'manteau_minuit',  name:"Manteau de Minuit",                              rarity:'godlike',   cat:'artefact',  tier:1, img:"img/compendium/textures/trinkets/P1/Manteau de Minuit.png",                              stats:{degats:5, esquive:15, mana:25, stamina:15, vitesse:2} },

    { id:'tunique_deb',     name:"Tunique du Débutant",                            rarity:'commun',    cat:'plastron',  tier:1, img:"", stats:{sante:[12,15]} },
    { id:'jambieres_deb',   name:"Jambières du Débutant",                          rarity:'commun',    cat:'jambières', tier:1, img:"", stats:{sante:[7,10]} },
    { id:'bottes_deb',      name:"Bottes du Débutant",                             rarity:'commun',    cat:'bottes',    tier:1, img:"", stats:{sante:[5,7]} },
    { id:'tunique_ika',     name:"Tunique d'Ika",          set:'ika',              rarity:'commun',    cat:'plastron',  tier:1, img:"", stats:{sante:[23,25.99], defense:[0.7,1.2]}, classes:['guerrier'] },
    { id:'jambieres_ika',   name:"Jambières d'Ika",        set:'ika',              rarity:'commun',    cat:'jambières', tier:1, img:"", stats:{sante:[20,25], defense:[0.6,1]}, classes:['guerrier'] },
    { id:'bottes_ika',      name:"Bottes d'Ika",            set:'ika',              rarity:'commun',    cat:'bottes',    tier:1, img:"", stats:{sante:[17,20], defense:[0.4,0.8]}, classes:['guerrier'] },
    { id:'casque_titan',    name:"Casque du Titan",          set:'titan',           rarity:'rare',      cat:'casque',    tier:1, img:"img/compendium/textures/armors/helmet_titan.png",        stats:{sante:[30,35], defense:[1.2,1.6]}, classes:['guerrier'] },
    { id:'plastron_titan',  name:"Plastron du Titan",        set:'titan',           rarity:'rare',      cat:'plastron',  tier:1, img:"img/compendium/textures/armors/chestplate_titan.png",    stats:{sante:[34,38.99], defense:[3.2,3.7]}, classes:['guerrier'] },
    { id:'jambieres_titan', name:"Jambières du Titan",       set:'titan',           rarity:'rare',      cat:'jambières', tier:1, img:"img/compendium/textures/armors/leggings_titan.png",      stats:{sante:[32,37], defense:[1.4,1.92]}, classes:['guerrier'] },
    { id:'bottes_titan',    name:"Bottes du Titan",           set:'titan',           rarity:'rare',      cat:'bottes',    tier:1, img:"img/compendium/textures/armors/boots_titan.png",          stats:{sante:[27,31], defense:[0.9,1.4]}, classes:['guerrier'] },
    { id:'casque_gard',     name:"Casque du Gardien",         set:'gardien',         rarity:'epique',    cat:'casque',    tier:1, img:"", stats:{sante:[30,35], defense:[2,2.5]}, classes:['guerrier'] },
    { id:'plastron_gard',   name:"Plastron du Gardien",       set:'gardien',         rarity:'epique',    cat:'plastron',  tier:1, img:"", stats:{sante:[34,40], defense:[3.5,4], 'Emplacement de Runes':2}, classes:['guerrier'] },
    { id:'jambieres_gar',   name:"Jambières du Gardien",      set:'gardien',         rarity:'epique',    cat:'jambières', tier:1, img:"", stats:{sante:[32,37], defense:[3,3.5]}, classes:['guerrier'] },
    { id:'bottes_gard',     name:"Bottes du Gardien",          set:'gardien',         rarity:'epique',    cat:'bottes',    tier:1, img:"", stats:{sante:[28,33], defense:[1.6,2]}, classes:['guerrier'] },
    { id:'tunique_tacti',   name:"Tunique Tactique",           set:'tactique',        rarity:'commun',    cat:'plastron',  tier:1, img:"img/compendium/textures/armors/chestplate_tactique.png",  stats:{sante:[21,25], defense:0.4}, classes:['assassin','archer'] },
    { id:'jambieres_tacti', name:"Jambières Tactique",         set:'tactique',        rarity:'commun',    cat:'jambières', tier:1, img:"img/compendium/textures/armors/leggings_tactique.png",    stats:{sante:[17,21], defense:0.4}, classes:['assassin','archer'] },
    { id:'bottes_tacti',    name:"Bottes Tactique",             set:'tactique',        rarity:'commun',    cat:'bottes',    tier:1, img:"img/compendium/textures/armors/boots_tactique.png",        stats:{sante:[15,18], defense:0.3}, classes:['assassin','archer'] },
    { id:'tunique_ninja',   name:"Tunique du Ninja",            set:'ninja',           rarity:'rare',      cat:'plastron',  tier:1, img:"img/compendium/textures/armors/chestplate_ninja.png",     stats:{sante:[29,34], defense:[1.5,2.3]}, classes:['assassin'] },
    { id:'jambieres_ninja', name:"Jambières du Ninja",          set:'ninja',           rarity:'rare',      cat:'jambières', tier:1, img:"img/compendium/textures/armors/leggings_ninja.png",       stats:{sante:[23,27], defense:[0.9,1.4]}, classes:['assassin'] },
    { id:'bottes_ninja',    name:"Bottines du Ninja",            set:'ninja',           rarity:'rare',      cat:'bottes',    tier:1, img:"img/compendium/textures/armors/boots_ninja.png",           stats:{sante:[18,23], defense:[0.8,1]}, classes:['assassin'] },
    { id:'tunique_chass',   name:"Plastron du Chasseur",         set:'chasseur',        rarity:'rare',      cat:'plastron',  tier:1, img:"img/compendium/textures/armors/chestplate_chasseur.png",  stats:{sante:[25,30], defense:[1.3,2]}, classes:['archer'] },
    { id:'jambieres_chass', name:"Jambières du Chasseur",        set:'chasseur',        rarity:'rare',      cat:'jambières', tier:1, img:"img/compendium/textures/armors/leggings_chasseur.png",    stats:{sante:[20,24], defense:[0.7,1.2]}, classes:['archer'] },
    { id:'bottes_chass',    name:"Bottines du Chasseur",          set:'chasseur',        rarity:'rare',      cat:'bottes',    tier:1, img:"img/compendium/textures/armors/boots_chasseur.png",        stats:{sante:[16,20], defense:[0.7,0.9]}, classes:['archer'] },
    { id:'casque_her',      name:"Casque du Héraut",              set:'heraut',          rarity:'epique',    cat:'casque',    tier:1, img:"", stats:{sante:[26,31], defense:[2.7,3.2]}, classes:['assassin','archer'] },
    { id:'plastron_her',    name:"Plastron du Héraut",            set:'heraut',          rarity:'epique',    cat:'plastron',  tier:1, img:"", stats:{sante:[32,37], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['assassin','archer'] },
    { id:'jambieres_her',   name:"Jambières du Héraut",           set:'heraut',          rarity:'epique',    cat:'jambières', tier:1, img:"", stats:{sante:[23,27], defense:[2.9,3.4]}, classes:['assassin','archer'] },
    { id:'bottes_her',      name:"Bottes du Héraut",               set:'heraut',          rarity:'epique',    cat:'bottes',    tier:1, img:"", stats:{sante:[18,23], defense:[2.8,3]}, classes:['assassin','archer'] },
    { id:'tunique_spect',   name:"Tunique Spectral",               set:'spectral',        rarity:'commun',    cat:'plastron',  tier:1, img:"", stats:{sante:[15,19], defense:0.4}, classes:['mage','shaman'] },
    { id:'jambieres_spect', name:"Jambières Spectral",             set:'spectral',        rarity:'commun',    cat:'jambières', tier:1, img:"", stats:{sante:[13,17], defense:0.4}, classes:['mage','shaman'] },
    { id:'bottes_spect',    name:"Bottes Spectral",                 set:'spectral',        rarity:'commun',    cat:'bottes',    tier:1, img:"", stats:{sante:[10,13], defense:0.3}, classes:['mage','shaman'] },
    { id:'robe_sorc',       name:"Robe du Sorcier",                 set:'sorcier',         rarity:'rare',      cat:'plastron',  tier:1, img:"", stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['mage'] },
    { id:'pantalon_sorc',   name:"Pantalon du Sorcier",             set:'sorcier',         rarity:'rare',      cat:'jambières', tier:1, img:"", stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['mage'] },
    { id:'sandales_sorc',   name:"Sandales du Sorcier",             set:'sorcier',         rarity:'rare',      cat:'bottes',    tier:1, img:"", stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['mage'] },
    { id:'robe_magic',      name:"Robe du Magicien",                set:'magicien',        rarity:'rare',      cat:'plastron',  tier:1, img:"img/compendium/textures/armors/chestplate_magicien.png", stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['shaman'] },
    { id:'pantalon_magic',  name:"Pantalon du Magicien",            set:'magicien',        rarity:'rare',      cat:'jambières', tier:1, img:"img/compendium/textures/armors/leggings_magicien.png",   stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['shaman'] },
    { id:'sandales_magic',  name:"Sandales du Magicien",            set:'magicien',        rarity:'rare',      cat:'bottes',    tier:1, img:"img/compendium/textures/armors/boots_magicien.png",       stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['shaman'] },
    { id:'casque_fau',      name:"Casque de la Faucheuse",          set:'faucheuse',       rarity:'epique',    cat:'casque',    tier:1, img:"", stats:{sante:[16,20], defense:[2.8,3.4]}, classes:['mage','shaman'] },
    { id:'plastron_fau',    name:"Plastron de la Faucheuse",        set:'faucheuse',       rarity:'epique',    cat:'plastron',  tier:1, img:"", stats:{sante:[27,32], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['mage','shaman'] },
    { id:'jambieres_fau',   name:"Jambières de la Faucheuse",       set:'faucheuse',       rarity:'epique',    cat:'jambières', tier:1, img:"", stats:{sante:[20,24], defense:[2.9,3.4]}, classes:['mage','shaman'] },
    { id:'bottes_fau',      name:"Bottes de la Faucheuse",          set:'faucheuse',       rarity:'epique',    cat:'bottes',    tier:1, img:"", stats:{sante:[10.2,13.8], defense:[2.7,2.9]}, classes:['mage','shaman'] },
    { id:'bottes_rev',      name:"Bottes du Revenant",                                     rarity:'legendaire',cat:'bottes',    tier:1, img:"img/compendium/textures/armors/bottes_du_revenant.png",   stats:{vitesse_deplacement:5} },
    { id:'bottes_ecu',      name:"Bottes de l'Écume",                                      rarity:'legendaire',cat:'bottes',    tier:1, img:"img/compendium/textures/armors/bottes_decume.png",         stats:{'Agilité Aquatique':10} },
  ];

  /* ══ SLOTS ══ */
  const SLOTS_LEFT = [
    { id:'amulette',  label:'Amulette',        ico:'📿', cats:['amulette'] },
    { id:'anneau1',   label:'Anneau I',         ico:'💍', cats:['anneau'] },
    { id:'anneau2',   label:'Anneau II',        ico:'💍', cats:['anneau'] },
    { id:'bracelet',  label:'Bracelet',         ico:'⭕', cats:['bracelet'] },
    { id:'gants',     label:'Gants',            ico:'🧤', cats:['gants'] },
  ];
  const SLOTS_RIGHT = [
    { id:'casque',    label:'Casque',           ico:'🧢', cats:['casque'] },
    { id:'plastron',  label:'Plastron',         ico:'👔', cats:['plastron'] },
    { id:'jambieres', label:'Jambières',        ico:'👖', cats:['jambières'] },
    { id:'bottes',    label:'Bottes',           ico:'👢', cats:['bottes'] },
    { id:'arme_pr',   label:'Arme Principale',  ico:'⚔️', cats:['arme_p'] },
  ];
  const SLOTS_BOT = [
    { id:'artefact1', label:'Artefact I',       ico:'🔮', cats:['artefact'] },
    { id:'artefact2', label:'Artefact II',      ico:'🔮', cats:['artefact'] },
    { id:'artefact3', label:'Artefact III',     ico:'🔮', cats:['artefact'] },
    { id:'arme_sec',  label:'Arme Secondaire',  ico:'🛡️', cats:['arme_s'] },
  ];
  const ALL_SLOTS = [...SLOTS_LEFT, ...SLOTS_RIGHT, ...SLOTS_BOT];

  /* ══ ÉTAT ══ */
  let equipped      = {};
  let equippedRunes = {};
  let activeSlot    = null;
  let filterQ       = '';
  let filterRar     = null;
  let activeClass   = null;

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
          delete equipped[slotId];
          clearRunesForSlot(slotId);
          redrawSlot(slotId);
        });
        renderStats();
        renderItemList();
        saveToStorage();
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

      ['export', 'import', 'reset', 'confirm-class'].forEach(function(m) {
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
    el.classList.remove('filled', 'active');
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

      /* ══ BOULES DE RUNES ══ */
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
    /* Ferme le picker existant si même orbe */
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

    /* Titre */
    const title = document.createElement('div');
    title.className = 'rune-picker-title';
    const orbIdx = parseInt(runeKey.split('_rune_')[1]) + 1;
    title.textContent = 'Emplacement de Rune ' + orbIdx;
    popup.appendChild(title);

    /* Liste des runes */
    RUNES.forEach(function(rune) {
      const item = document.createElement('div');
      item.className = 'rune-picker-item' + (currentRuneId === rune.id ? ' active' : '');

      const pip = document.createElement('span');
      pip.className = 'rune-pip';
      pip.style.background = rune.color;

      const name = document.createElement('span');
      name.className = 'rune-picker-name';
      name.textContent = rune.name;

      const statsStr = Object.entries(rune.stats).map(function(e) {
        const statDef = ALL_STATS.find(function(s) { return s.id === e[0]; });
        return '+' + e[1] + '\u202f' + (statDef ? statDef.label : e[0]);
      }).join(' · ');
      const stats = document.createElement('span');
      stats.className = 'rune-picker-stats';
      stats.textContent = statsStr;

      item.appendChild(pip);
      item.appendChild(name);
      item.appendChild(stats);

      item.addEventListener('click', function(e) {
        e.stopPropagation();
        equippedRunes[runeKey] = rune.id;
        popup.remove();
        redrawSlot(slotId);
        renderStats();
        saveToStorage();
      });

      popup.appendChild(item);
    });

    /* Retirer */
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

    /* Positionnement */
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

    /* Fermeture au clic extérieur */
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

  /* Supprime toutes les runes associées à un slot */
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
      });
    });
  }

  function computeSetCounts() {
    const counts = {};
    Object.values(equipped).forEach(function(item) {
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

    /* Stats des items équipés */
    Object.values(equipped).forEach(item => {
      if (!item || !item.stats) return;
      Object.entries(item.stats).forEach(function(entry) {
        const key = entry[0]; const val = entry[1];
        if (!(key in mins)) return;
        mins[key] += getMin(val);
        maxs[key] += getMax(val);
      });
    });

    /* Stats des panoplies */
    const setCounts = computeSetCounts();
    const sb = computeSetBonuses(setCounts);
    ALL_STATS.forEach(function(s) {
      mins[s.id] += sb.bonusMins[s.id];
      maxs[s.id] += sb.bonusMaxs[s.id];
    });

    /* Stats des runes */
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
    return Math.ceil(n * 100) / 100;
  }

  function renderStats() {
    const result = computeStats();
    const mins = result.mins; const maxs = result.maxs;
    renderSetBonuses(result.setCounts);
    ALL_STATS.forEach(function(stat) {
      const valEl = document.getElementById('sv-' + stat.id);
      const barEl = document.getElementById('sb-' + stat.id);
      if (!valEl || !barEl) return;

      const lo = roundUp2(mins[stat.id] || 0);
      const hi = roundUp2(maxs[stat.id] || 0);

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

  /* ══ SÉLECTION DE SLOT ══ */
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
    delete equipped[slotId];
    clearRunesForSlot(slotId);
    saveToStorage();
    redrawSlot(slotId);
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
      return '<div class="istat-row">' +
             '<span class="istat-icon">' + icon + '</span>' +
             '<span class="istat-label">' + label + '</span>' +
             '<span class="istat-val">' + formatStatValue(val, unit) + '</span>' +
             '</div>';
    }).join('');

    return '<div class="istat-block">' + lines + '</div>';
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
             (!filterRar || item.rarity === filterRar) &&
             (!q || norm(item.name).includes(q));
    });
    if (!visible.length) {
      list.innerHTML = '<div class="picker-empty-msg">Aucun item compatible</div>';
      return;
    }
    list.innerHTML = '';
    visible.forEach(function(item) {
      const row = document.createElement('div');
      row.className = 'item-row';
      if (equipped[activeSlot] && equipped[activeSlot].id === item.id) row.classList.add('active');
      const rarColor = (RARITIES[item.rarity] || { color: '#888' }).color;
      const rarLabel = (RARITIES[item.rarity] || { label: item.rarity }).label;
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
        /* Si on remplace un item avec des runes, on nettoie les runes de l'ancien */
        clearRunesForSlot(activeSlot);
        equipped[activeSlot] = item;
        saveToStorage();
        redrawSlot(activeSlot);
        renderStats();
        renderItemList();
      });
      list.appendChild(row);
    });
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
        v: 1,
        sig: SIG,
        name: document.getElementById('inp-name').value.trim(),
        classe: activeClass || '',
        slots: equippedIds,
        runes: equippedRunes,
      }));
    } catch(e) { /* quota dépassé ou mode privé */ }
  }

  /* ══ MODALES ══ */
  function openModal(mode) {
    const modal = document.getElementById('modal');
    modal.dataset.mode = mode;
    const errEl = document.getElementById('modal-error');
    if (errEl) { errEl.textContent = ''; errEl.style.display = 'none'; }
    ['export', 'import', 'reset'].forEach(function(m) {
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
      slots: equippedIds,
      runes: equippedRunes,
    };
    const ta = document.getElementById('modal-ta-export');
    if (ta) ta.value = JSON.stringify(payload, null, 2);
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
    const errEl = document.getElementById('modal-error');

    if (!raw) {
      if (errEl) { errEl.textContent = '⚠ Collez un JSON valide avant d\'importer.'; errEl.style.display = 'block'; }
      return;
    }

    try {
      const parsed = JSON.parse(raw);

      if (parsed.sig !== SIG) {
        throw new Error('Signature invalide');
      }

      if (parsed.v === 1 && parsed.slots) {
        equipped = {};
        equippedRunes = {};
        Object.entries(parsed.slots).forEach(function(e) {
          const slotId = e[0]; const itemId = e[1];
          const item = ITEMS.find(function(i) { return i.id === itemId; });
          if (item) equipped[slotId] = item;
        });
        if (parsed.runes && typeof parsed.runes === 'object') {
          Object.entries(parsed.runes).forEach(function(e) {
            const runeKey = e[0]; const runeId = e[1];
            if (RUNES.find(function(r) { return r.id === runeId; })) {
              equippedRunes[runeKey] = runeId;
            }
          });
        }
        if (parsed.name) document.getElementById('inp-name').value = parsed.name;
        if (parsed.classe) {
          activeClass = parsed.classe || null;
          buildClassPicker();
        }
      }
      else if (typeof parsed === 'object' && !Array.isArray(parsed)) {
        equipped = parsed;
        equippedRunes = {};
      } else {
        throw new Error('Format non reconnu');
      }

      buildGrid();
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
    localStorage.removeItem(STORAGE_KEY);
    buildGrid();
    renderStats();
    renderPickerInfo();
    renderItemList();
    closeModal();
  });

  /* ══ FERMETURE MODALE ══ */
  document.getElementById('btn-modal-close').addEventListener('click',   closeModal);
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

    const skin = document.getElementById('mq-skin');
    if (skin) { skin.style.width = W + 'px'; skin.style.height = colH + 'px'; }

    const totalW = 2 * S + W + 2 * G;
    const rowBot = document.getElementById('row-bot');
    if (rowBot) rowBot.style.width = totalW + 'px';

    mq.style.width = totalW + 'px';
  }

  window.addEventListener('resize', fitGrid);

  /* ══ INIT ══ */
  function init() {
    buildClassPicker();
    buildGrid();
    buildFilters();
    buildStatsUI();

    /* Restauration depuis localStorage */
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
              if (RUNES.find(function(r) { return r.id === runeId; })) {
                equippedRunes[runeKey] = runeId;
              }
            });
          }
          if (parsed.name) document.getElementById('inp-name').value = parsed.name;
          if (parsed.classe) {
            activeClass = parsed.classe;
            buildClassPicker();
          }
          buildGrid();
        }
      }
    } catch(e) { /* storage corrompu */ }

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