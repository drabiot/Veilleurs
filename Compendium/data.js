/* ══════════════════════════════════
   CONFIGURATION — RARETÉS
══════════════════════════════════ */
const RARITIES = {
  'commun':     { label: 'Commun',      color: '#59d059' },
  'rare':       { label: 'Rare',        color: '#2a5fa8' },
  'epique':     { label: 'Épique',      color: '#6a3daa' },
  'legendaire': { label: 'Légendaire',  color: '#d7af5f' },
  'mythique':   { label: 'Mythique',    color: '#f5b5e4' },
  'godlike':    { label: 'Godlike',     color: '#a83020' },
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
	anneau_dechu: {
    label: 'Set Anneau Déchu',
    color: '#7930d8',
    bonuses: {
      2: { hate:10 },
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
  taureau: {
    label: 'Set des Taureaux',
    color: 'rgb(196, 126, 104)',
    bonuses: {
      2: { crit_degats:1.5, defense:1 },
      3: { crit_degats:2.5, defense:1.5 },
      4: { crit_degats:2, defense:1, crit_chance:1 }
    }
  },
  ours: {
    label: 'Set des Ours',
    color: 'rgb(109, 51, 34)',
    bonuses: {
      2: { crit_comp_chance:0.5, crit_comp_degats:1 },
      3: { crit_comp_chance:1, crit_comp_degats:2 },
      4: { crit_comp_chance:1.5, defense:1 }
    }
  },
  ferraille: {
    label: 'Set de Ferraille',
    color: 'rgb(150, 150, 150)',
    bonuses: {
      2: { degats:2 },
      3: { sante:5, defense:1.5 },
      4: { degats:2, crit_chance:2.5 },
	  5: { sante:5, defense:2 }
    }
  },
  bauxite: {
    label: 'Set de Bauxite',
    color: 'rgb(230, 24, 24)',
    bonuses: {
      2: { degats:2.5 },
      3: { sante:10, defense:2 },
      4: { degats:2, crit_chance:5 },
	  5: { sante:10, defense:2.5 }
    }
  },
  onyx_impur: {
    label: 'Set d\'Onyx Impur',
    color: 'rgb(51, 28, 54)',
    bonuses: {
      2: { degats:3 },
      3: { sante:15, defense:2.5 },
      4: { degats:2.5, crit_chance:6 },
	  5: { sante:10, defense:3, vitesse_deplacement:0.5 }
    }
  },
  onyx_pur: {
    label: 'Set d\'Onyx Pur',
    color: 'rgb(255, 255, 255)',
    bonuses: {
      2: { degats:3.5 },
      3: { sante:20, defense:3 },
      4: { degats:3, crit_chance:7 },
	  5: { sante:15, defense:3.5, vitesse_deplacement:0.75 }
    }
  },
  faible_corru: {
    label: 'Set Faible Corruption',
    color: 'rgb(173, 91, 221)',
    bonuses: {
      2: { stamina:5, regen_stamina:0.1 },
      3: { reduction_degats:5.5 },
      4: { defense:4, sante:10 },
    }
  },
  abeille_guer: {
    label: 'Set Abeille Guerrier',
    color: 'rgb(236, 140, 49)',
    bonuses: {
      2: { stamina:5, regen_stamina:0.1 },
      3: { reduction_degats:5.5 },
      4: { defense:4, sante:10 },
    }
  },
  abeille_assa: {
    label: 'Set Abeille Feroce',
    color: 'rgb(223, 100, 29)',
    bonuses: {
      2: { crit_chance:5, crit_degats:15 },
      3: { vitesse_deplacement:0.5 },
      4: { degats:8 },
    }
  },
  abeille_arch: {
    label: 'Set Abeille Mystique',
    color: 'rgb(238, 200, 97)',
    bonuses: {
      2: { crit_chance:15, crit_degats:5 },
      3: { vitesse_deplacement:0.75 },
      4: { degats:7 },
    }
  },
  abeille_mage: {
    label: 'Set Abeille Magique',
    color: 'rgb(246, 136, 250)',
    bonuses: {
      2: { crit_comp_chance:2.5, mana:30 },
      3: { hate:6 },
      4: { degats_magique:6 },
    }
  },
  abeille_sham: {
    label: 'Set Abeille Merveilleuse',
    color: 'rgb(161, 233, 79)',
    bonuses: {
      2: { regen_mana:0.1, mana:30 },
      3: { hate:6.5 },
      4: { soin_bonus:2 },
    }
  },
  necro_guer: {
    label: 'Set Necromancien Guerrier',
    color: 'rgb(245, 75, 75)',
    bonuses: {
      2: { stamina:6, regen_stamina:0.2 },
      3: { reduction_degats:6 },
      4: { defense:5.5, sante:20 },
    }
  },
  necro_assa: {
    label: 'Set Necromancien Feroce',
    color: 'rgb(126, 10, 35)',
    bonuses: {
      2: { crit_chance:10, crit_degats:20 },
      3: { vitesse_deplacement:0.6 },
      4: { degats:10 },
    }
  },
  necro_arch: {
    label: 'Set Necromancien Mystique',
    color: 'rgb(248, 69, 93)',
    bonuses: {
      2: { crit_chance:20, crit_degats:10 },
      3: { vitesse_deplacement:0.85 },
      4: { degats:8 },
    }
  },
  necro_mage: {
    label: 'Set Necromancien Magique',
    color: 'rgb(202, 36, 128)',
    bonuses: {
      2: { crit_comp_chance:3.5, mana:35 },
      3: { hate:7 },
      4: { degats_magique:7 },
    }
  },
  necro_sham: {
    label: 'Set Necromancien Sauvage',
    color: 'rgb(58, 87, 26)',
    bonuses: {
      2: { regen_mana:0.2, mana:35 },
      3: { hate:8 },
      4: { soin_bonus:3 },
    }
  },
};


/* ══ DÉFINITION DES STATS ══ */
const STAT_GROUPS = [
  {
    label: 'Offensif',
    stats: [
      { id:'degats',              label:'Dégâts',                          icon:'🗡️',  unit:'',   max:500  },
	  { id:'degats_physique',     label:'Dégâts Physique',                 icon:'💥',  unit:'%',  max:100  },
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
	  { id:'maitrise_bloc',       label:'Maîtrise de Blocage',             icon:'🧱',  unit:'%',   max:100 },
	  { id:'puissance_bloc',      label:'Puissance de Blocage',            icon:'💪',  unit:'%',   max:100 },
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
  { id:'noel',     name:'Rune de Noël',         color:'#e03a3a', stats:{ vol_vie:2, omnivamp:2.5, sante:5, mana:5, stamina:2.5 } },
  { id:'st_val',   name:'Rune de Teddy Bear',   color:'#f4acbc', stats:{ vitesse_attaque:0.2, crit_comp_chance:20, crit_comp_degats:10, defense:2, sante:20 } },
  { id:'lunaire',  name:'Rune Lunaire',         color:'#ecd783', stats:{ crit_chance:7, crit_degats:12, crit_comp_chance:7, crit_comp_degats:12, sante:5 } },
  { id:'dragon',   name:'Rune du Dragon',       color:'#e35f48', stats:{ crit_chance:8, crit_degats:13, crit_comp_chance:8, crit_comp_degats:13, sante:10, vitesse_deplacement:0.15 } },
];

/* ══ SYSTÈME DE NIVEAU ══ */
const MAX_LEVEL = 14;

/* ══ CARACTÉRISTIQUES ══ */
const CARACTERISTIQUES = [
	  {
		  id:'force',
		  label:'Force',
		  icon:'⚔️',
		  color:'#e07a35',
		  desc:'Augmente les Dégâts physiques infligés.',
		  stats:{ degats: 1, crit_degats:0.75 }
	  },
	  {
		  id:'intelligence',
		  label:'Intelligence',
		  icon:'📖',
		  color:'#9a5de8',
		  desc:'Amplifie la puissance des sorts et des compétences magiques',
		  stats:{ degats_magique: 1, crit_comp_chance:0.75 }
		},
		{
			id:'dexterite',
			label:'Dextérité',
			icon:'🏹',
			color:'#e0c840',
			desc:'Améliore l\'Agilité et les chances de coups critique',
			stats:{ crit_chance: 0.75, esquive: 0.3 }
		},
		{
			id:'esprit',
			label:'Esprit',
			icon:'🌿',
			color:'#59d059',
			desc:'Augmente la Régénération de Santé et d\'Énergie',
			stats:{ regen_sante: 0.15, regen_mana: 0.1, regen_stamina: 0.05 }
		},
		{
		  id:'vitalite',
		  label:'Vitalité',
		  icon:'❤️',
		  color:'#e05555',
		  desc:'Augmente la Santé maximale',
		  stats:{ sante: 3 }
		},
		{
		  id:'defense_car',
		  label:'Défense',
		  icon:'🛡️',
		  color:'#5588e0',
		  desc:'Réduit les dégâts subis en augmentant la Défense',
		  stats:{ defense: 0.4 }
		},
	];
	
/* Niveau actuel et points alloués */
let buildLevel = 1;
let caracterPoints = { vitalite: 0, defense_car: 0, intelligence: 0, force: 0, esprit: 0, dexterite: 0 };

function getAvailablePoints() {
	const spent = Object.values(caracterPoints).reduce((a, b) => a + b, 0);
	return buildLevel - spent;
}

/* ══ HELPERS FOURCHETTES ══ */
function getMin(val) { return Array.isArray(val) ? val[0] : val; }
function getMax(val) { return Array.isArray(val) ? val[1] : val; }

/* ══════════════════════════════════
   CONFIGURATION — CATÉGORIES
══════════════════════════════════ */
const CATEGORIES = {
  materiaux:       { label: 'Matériaux',          emoji: '🧱' },
  quete:           { label: 'Objets de Quête',    emoji: '📜' },
  minerais:        { label: 'Minerais',           emoji: '⛏️' },
  nourriture:      { label: 'Nourriture',         emoji: '🍖' },
  consommable:     { label: 'Consommables',       emoji: '🧪' },
  arme:            { label: 'Armes',              emoji: '⚔️'  },
  armure:          { label: 'Armures',            emoji: '🛡️'  },
  accessoire:      { label: 'Accessoires',        emoji: '💍'  },
  outils:          { label: 'Outils',             emoji: '🛠️' },
  clef:            { label: 'Clefs',              emoji: '🗝️'  },
  rune:            { label: 'Runes',              emoji: '🔮'  },
};

const ITEMS = [
/* ── PALIER 1 ── */
	/* ══ Armes ══ */
  {
		id:				'dague_entrainement',
		name:			"Dague d'Entrainement",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/dague_dentrainement.png",
		stats:			{degats:7, vitesse_attaque:1.2},
		lore:     "Forgée pour ceux qui n'ont encore rien prouvé.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Obtenable dans le tutoriel"
	},
  /* ══ Guerrier ══ */
  /* ══ Épées ══ */
  {
		id:				'epee_entrainement',
		name:			"Épée d'Entrainement",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/epee_dentrainement.png",
		stats:		{degats:12, vitesse_attaque:1},
		classes:	['guerrier'],
		lore:     "Petite épée un peu rouillée parfaite pour s'entraîner ou pour démarrer son aventure.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},	
  {
		id:				'epee_fer',
		name:			"Épée en Fer",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/epee_en_fer.png",
		stats:		{degats:[14,16], vitesse_attaque:1},
		classes:	['guerrier'],
		lore:     "Épée en fer créée grâce aux loups de la vallée et avec un autre ingrédient.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'epee_osseuse',
		name:			"Épée Osseuse",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/epee_osseuse.png",
		stats:		{degats:17.5, vitesse_attaque:1},
		classes:	['guerrier'],
		lore:     "Taillé dans les os d'un ancien guerrier tombé en disgrâce.",
    tags:     ['Armes', 'Épée', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes"
	},
  {
		id:				'epee_magique',
		name:			"Épée Magique",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/epee_magique.png",
		stats:		{degats:[18,20], vitesse_attaque:1.1},
		classes:	['guerrier'],
		lore:     "Épée dont la magie a été imprégnée des monstres de la citadelle des neiges.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'epee_gardien',
		name:			"Épée du Gardien",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/epee_du_gardien.png",
		stats:		{degats:[20,24], vitesse_attaque:1.1, crit_chance:[8,12]},
		classes:	['guerrier'],
		lore:     "Tout juste sortie de la forge, cette lame incarne l'idéal du protecteur.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'nodachi',
		name:			"Nodachi",
		rarity:		'mythique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/nodachi.png",
		stats:		{degats:45, vitesse_attaque:1.2, crit_chance:10, crit_degats:10},
		classes:	['guerrier'],
		lore:     "Longue épée ayant appartenu à Illfang the Kobold Lord. Ce n'est toutefois qu'une relique mythique.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'epee_dard_tranchant',
		name:			"Épée du Dard Tranchant",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/epee_dard_tranchant.png",
		stats:		{degats:[26.01,29.99], vitesse_attaque:1.2},
		classes:	['guerrier'],
		lore:     "Lame tranchante, percante, et puissante comme le dard d'une abeille en colère.",
    tags:     ['Arme', 'Épée', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:				'epee_necromancien',
		name:			"Épée du Nécromancien",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/epee_necromancien.png",
		stats:		{degats:[30,35], vitesse_attaque:1.2, crit_chance:[10,15]},
		classes:	['guerrier'],
		lore:     "Lame tranchante, percante, et puissante comme le sort d'un nécromancien en colère.",
    tags:     ['Arme', 'Épée', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Boucliers ══ */
  {
		id:				'bouclier_pacotille',
		name:			"Bouclier de Pacotille",
		rarity:		'commun',
		at:				'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/bouclier_de_pacotille.png",
		stats:{sante:5},
		classes:['guerrier'],
		lore:     "Un vieux bouclier. Il bloque encore à peu près.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'bouclier_ika',
		name:			"Bouclier d'Ika",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/bouclier_dika.png",
		stats:		{sante:[8,12], defense:[1,1.5]},
		classes:	['guerrier'],
		lore:     "Forgé dans la carapace des tortues d'Ika. Idéal pour encaisser sans broncher.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'bouclier_pointu_bois',
		name:			"Bouclier Pointu Bois",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/bouclier_pointu_en_bois.png",
		stats:		{sante:[4,6], defense:[0.5,0.8], degats:0.5},
		classes:	['guerrier'],
		lore:     "Ce bouclier fait de bois possède une pointe en son centre. Il peut encaisser quelques coups aussi.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'bouclier_sylestre',
		name:			"Bouclier Sylvestre",
		rarity:		'rare',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/bouclier_sylvestre.png",
		stats:		{sante:15, defense:1.7},
		classes:	['guerrier'],
		lore:     "Grand bouclier en bois qui peut seulement être obtenu par un Guerrier Tréant.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Guerriers Tréants"
	},
  {
		id:				'bouclier_resistant_tolbana',
		name:			"Bouclier Résistant de Tolbana",
		rarity:		'rare',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/bouclier_resistant_de_tolbana.png",
		stats:		{sante:[16,20], defense:[1.9,2.1]},
		classes:	['guerrier'],
		lore:     "Le bouclier le plus résistant que Tolbana puisse offrir.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'bouclier_puissant_tolbana',
		name:			"Bouclier Puissant de Tolbana",
		rarity:		'rare',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/bouclier_puissant_de_tolbana.png",
		stats:		{sante:[8,12], defense:[1.2,1.4], degats:2},
		classes:	['guerrier'],
		lore:     "La version équilibrée parmi tous les boucliers de Tolbana.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'bouclier_illfang',
		name:			"Bouclier de Illfang",
		rarity:		'mythique',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/bouclier_de_illfang.png",
		stats:		{sante:45, defense:5},
		classes:	['guerrier'],
		lore:     "Érodé par le temps et la poussière, ce bouclier était perdu à travers le temps et les dimensions.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'bouclier_maudit',
		name:			"Bouclier Maudit",
		rarity:		'epique',
		cat:			'arme_s',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/bouclier_maudit.png",
		stats:		{sante:[25.71,34.29], defense:[3,4]},
		classes:	['guerrier'],
		lore:     "Solide et résistant, il protège la malédiction qui pèse sur son porteur, ainsi absorbant les assauts.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Hast ══ */
  {
		id:				'hache_double_fer',
		name:			"Hache Double en Fer",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/hache_double_en_fer.png",
		stats:		{degats:[17,19], vitesse_attaque:0.9},
		classes:	['guerrier'],
		lore:     "Double hache en fer créée grâce aux loups de la vallée et avec un autre ingrédient.",
    tags:     ['Arme', 'Hache Double', 'Deux Mains', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'marteau_colosse',
		name:			"Marteau du Colosse",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/marteau_du_colosse.png",
		stats:		{degats:23, vitesse_attaque:0.8},
		classes:	['guerrier'],
		lore:     "Arme de destruction du Gardien Colossal. Ce marteau est puissant mais lourd.",
    tags:     ['Arme', 'Marteau', 'Deux Mains', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Gardiens Colossaux"
	},
  {
		id:				'marteau_magique',
		name:			"Marteau Magique",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/marteau_magique.png",
		stats:		{degats:[25,30], vitesse_attaque:0.8},
		classes:	['guerrier'],
		lore:     "Marteau dont la magie a été imprégnée des monstres de la citadelle des neiges.",
    tags:     ['Arme', 'Marteau', 'Deux Mains', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'hallebarde_royale',
		name:			"Hallebarde Royale",
		rarity:		'legendaire',
		cat:			'arme_p',
		category:	'arme',
		palier:1,
		lvl:10,
		img:			"../img/compendium/textures/weapons/hallebarde_royale.png",
		stats:		{degats:35, vitesse_attaque:0.7},
		classes:	['guerrier'],
		lore:     "Hallebarde d'un seigneur déchu anciennement grand guerrier dans l'Aincrad et dans tout The Seed.",
    tags:     ['Arme', 'Hallebarde', 'Deux Mains', 'Palier 1', 'Légendaire'],
    obtain:   "Obtenable en tuant:\n- Smough, Dévastateur Déchu"
	},
  {
		id:				'hache_illfang',
		name:			"Hache de Illfang",
		rarity:		'legendaire',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/hache_de_illfang.png",
		stats:		{degats:60, vitesse_attaque:0.7},
		classes:	['guerrier'],
		lore:     "Longue et lourde hache du puissant boss palier : Illfang the Kobold Lord !",
    tags:     ['Arme', 'Hache', 'Deux Mains', 'Palier 1', 'Légendaire'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'marteau_dard_ecrasant',
		name:			"Marteau du Dard Écrasant",
		rarity:		'rare',
		cat:			'arme_p',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/marteau_dard_ecrasant.png",
		stats:		{degats:[35,40], vitesse_attaque:0.8},
		classes:	['guerrier'],
		lore:     "Poids écrasant, frappant, assommant comme le dard d'une abeille en colère.",
    tags:     ['Arme', 'Marteau', 'Deux Mains', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:				'marteau_necromancien',
		name:			"Marteau du Nécromancien",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/marteau_necromancien.png",
		stats:		{degats:[45,50], vitesse_attaque:0.8},
		classes:	['guerrier'],
		lore:     "Poids écrasant, frappant, assommant comme le sort d'un nécromancien en colère.",
    tags:     ['Arme', 'Marteau', 'Deux Mains', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Assassin ══ */
  {
		id:				'dague_delabree',
		name:			"Dague Délabrée",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/dague_delabree.png",
		stats:		{degats:13.5, vitesse_attaque:1.1},
		classes:	['assassin'],
    lore:     "Dague bien délabrée, même un coup sur du bois et l'épée peut être détruite.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'dague_intermedaire',
		name:			"Dague Intermédiaire",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/dague_intermediaire.png",
		stats:		{degats:[17,20], vitesse_attaque:[1.1,1.2]},
		classes:	['assassin'],
    lore:     "Standard des nouvelles recrues. Facile à manier, légère et très fiable.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'dague_bandit',
		name:			"Dague de Bandit",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/dague_de_bandit.png",
		stats:		{degats:25, vitesse_attaque:1.2},
		classes:	['assassin'],
    lore:     "Dague émoussé d'un bandit après tous ces combats sanglants.",
    tags:     ['Armes', 'Dague', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Bandits Assassins"
	},
  {
		id:				'dague_sombre',
		name:			"Dague Sombre",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/dague_sombre.png",
		stats:		{degats:[27,31], vitesse_attaque:1.2},
		classes:	['assassin'],
    lore:     "Petite dague Sombre, forgé avec des éclats magiques et d'autres loot. Elle en devient redoutable.",
    tags:     ['Armes', 'Dague', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'longue_dague_sombre',
		name:			"Longue Dague Sombre",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/longue_dague_sombre.png",
		stats:		{degats:[35,40], vitesse_attaque:[0.8,0.9]},
		classes:	['assassin'],
    lore:     "Une longue dague Sombre, forgé avec des éclats magiques et d'autres loot. Elle en devient redoutable.",
    tags:     ['Armes', 'Longue Dague', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'dague_heroique',
		name:			"Dague Héroïque",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/dague_heroique.png",
		stats:		{degats:[31,35], vitesse_attaque:[1.3,1.5]},
		classes:	['assassin'],
    lore:     "Dague très puissante fait à partir de métal enchanté et d'âme, légère et facile à manier.",
    tags:     ['Armes', 'Dague', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'katana_heroique',
		name:			"Katana Héroïque",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/katana_heroique.png",
		stats:		{degats:[40,44.98], vitesse_attaque:[0.7,0.9]},
		classes:	['assassin'],
    lore:     "Katana très puissant fait à partir de métal enchanté et d'âme, tranchant et facile à manier.",
    tags:     ['Armes', 'Katana', 'Deux Mains', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'dague_nodachi',
		name:			"Dague Nodachi",
		rarity:		'mythique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/dague_nodachi.png",
		stats:		{degats:55, vitesse_attaque:1.8, vol_vie:3.5, vitesse_deplacement:1},
		classes:	['assassin'],
    lore:     "Une belle dague forgée à l'aide de fragments de véritable Nodachi. Ce n'est toutefois plus qu'une relique pour le moment.",
    tags:     ['Armes', 'Dague', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'serpe_assassine',
		name:			"Serpe Assassine",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/serpe_assassine.png",
		stats:		{degats:[34,38], vitesse_attaque:[1.4,1.5]},
		classes:	['assassin'],
    lore:     "Une Serpe fine aux teintes dorées et noires, dont la lame effilée évoque le dard mortel d'une abeille.",
    tags:     ['Armes', 'Serpe', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:				'faux_assassine',
		name:			"Faux Assassine",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/faux_assassine.png",
		stats:		{degats:[46,50], vitesse_attaque:0.8},
		classes:	['assassin'],
    lore:     "Une faux fine aux lignes acérées, décorée de motifs d'alvéoles, évoquant la précision et la menace d'un insecte prédateur.",
    tags:     ['Armes', 'Faux', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:				'serpe_necromancienne',
		name:			"Serpe Nécromancienne",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/serpe_necromancienne.png",
		stats:		{degats:[39,43.99], vitesse_attaque:[1.4,1.5]},
		classes:	['assassin'],
    lore:     "Une Serpe sombre aux gravures funéraires, dont la lame courbe semble liée aux arts interdits..",
    tags:     ['Armes', 'Serpe', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  {
		id:				'faux_necromancienne',
		name:			"Faux Nécromancienne",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/faux_necromancienne.png",
		stats:		{degats:[51,57], vitesse_attaque:0.8},
		classes:	['assassin'],
    lore:     "Une faux austère aux runes sépulcrales dont la lame noire évoque les rites anciens et les forces d'outre-tombe.",
    tags:     ['Armes', 'Faux', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Archer ══ */
  /* ══ Arcs ══ */
  {
		id:				'arc_courbe',
		name:			"Arc Courbé",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/arc_courbe.png",
		stats:		{degats:3, vitesse_attaque:1},
		classes:	['archer'],
    lore:     "Un arc rudimentaire utilisé par les premiers tireurs.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'arc_sylvestre',
		name:			"Arc Sylvestre",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/arc_sylvestre.png",
		stats:		{degats:[4,6], vitesse_attaque:1},
		classes:	['archer'],
    lore:     "Arc construit avec l'aide des Tréants du Palier 1 de l'Aincrad.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Tréants d'Élites\nFabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'arc_chasse',
		name:			"Arc de Chasse",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/arc_de_chasse.png",
		stats:		{degats:[10,13], vitesse_attaque:1},
		classes:	['archer'],
    lore:     "Arc pour chasser les puissants monstres du Palier 1.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'arc_fallen',
		name:			"Arc du Fallen",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/arc_du_fallen.png",
		stats:		{degats:[14,16], vitesse_attaque:[1,1.1]},
		classes:	['archer'],
    lore:     "Arc puissant qui appartenait à l'un des Fallen du Labyrinthe.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'arc_nodachi',
		name:			"Arc Nodachi",
		rarity:		'mythique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/arc_nodachi.png",
		stats:		{degats:23.5, vitesse_attaque:1.3, crit_chance:10, crit_degats:5},
		classes:	['archer'],
    lore:     "Arc créé à l'aide de fragments et de minerais de Nodachite. Puissant, mais ce n'est toutefois plus qu'une relique pour le moment.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'arc_abeille_traqueuse',
		name:			"Arc de l'Abeille Traqueuse",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/arc_abeille_traqueuse.png",
		stats:		{degats:[17,19], vitesse_attaque:[1,1.2]},
		classes:	['archer'],
    lore:     "Arc agile, conçu pour les chasseurs patients et mortels.",
    tags:     ['Arme', 'Arc', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:'arc_necropole',
		name:"Arc de la Nécropole",
		rarity:'epique',
		cat:'arme_p',
		category:	'arme',
		palier:2,
		lvl:13,
		img:"../img/compendium/textures/weapons/arc_necropole.png",
		stats:{degats:[20,22], vitesse_attaque:[1,1.3]},
		classes:['archer'],
    lore:     "Un arc sombre aux gravures funéraires, dont les branches semblent façonnées par une magie d'outre-tombe.",
    tags:     ['Arme', 'Arc', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Arbalètes ══ */
  {
		id:				'arbalete_bandit',
		name:			"Arbalète de Bandit",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/arbalete_de_bandit.png",
		stats:		{degats:12, vitesse_attaque:0.7},
		classes:	['archer'],
    lore:     "Arbalète d'un bandit qui devient presque inutilisable après tous ces combats.",
    tags:     ['Armes', 'Arbalète', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Bandits Archer"
	},
  {
		id:				'arbalete_chasse',
		name:			"Arbalète de Chasse",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/arbalete_de_chasse.png",
		stats:		{degats:[15,19], vitesse_attaque:0.7},
		classes:	['archer'],
    lore:     "Arbalète pour chasser les puissants monstres du Palier 1.",
    tags:     ['Armes', 'Arbalète', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'arbalete_cendre',
		name:			"Arbalète de Cendre",
		rarity:		'legendaire',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/arbalete_de_cendre.png",
		stats:		{degats:23.5, vitesse_attaque:0.7},
		classes:	['archer'],
    lore:     "Forgé dans les ruines d'un ancien fort de guerre, elle tremble encore de ces anciens combats.",
    tags:     ['Armes', 'Arbalète', 'Palier 1', 'Légendaire'],
    obtain:   "Obtenable en récompense du Donjon Labyrinthe des Déchus"
	},
  {
		id:				'arbalete_abeille_fer',
		name:			"Arbalète de l'Abeille de fer",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/weapons/arbalete_de_labeille_de_fer.png",
		stats:		{degats:[23.5,25.26], vitesse_attaque:[0.7,0.8]},
		classes:	['archer'],
    lore:     "Une arme fiable pour frapper même les ennemis les plus résistants.",
    tags:     ['Armes', 'Arbalète', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron du Donjon Melliona"
	},
  {
		id:				'arbalete_necropole',
		name:			"Arbalète de la Nécropole",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/weapons/arbalete_necropole.png",
		stats:		{degats:[27,29], vitesse_attaque:[0.7,0.8]},
		classes:	['archer'],
    lore:     "Une arbalète austère aux ornements sépulcraux, imprégnée d'une présence silencieuse venue d'outre-tombe.",
    tags:     ['Armes', 'Arbalète', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon Tombeau du Nécromancien"
	},
  /* ══ Mage - Shaman ══ */
  /* ══ Bâtons ══ */
  {
		id:				'baton_mediocre_mag',
		name:			"Bâton Médiocre Mage",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/baton_mediocre_mage.png",
		stats:		{degats:6.5, vitesse_attaque:1},
		classes:	['mage'],
    lore:     "Un bâton d'apprentissage magique inoffensif, mais porteur d'énergie.",
    tags:     ['Arme', 'Bâton', 'Mage', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'baton_mediocre_sha',
		name:			"Bâton Médiocre Shaman",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/baton_mediocre_shaman.png",
		stats:		{degats:6.2, vitesse_attaque:1, soin_bonus:1},
		classes:	['shaman'],
    lore:     "Un bâton d'apprentissage magique inoffensif, mais porteur d'énergie.",
    tags:     ['Arme', 'Bâton', 'Shaman', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'baton_sylvestre_mag',
		name:			"Bâton Sylvestre Mage",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/baton_sylvestre_mage.png",
		stats:		{degats:[12,13], vitesse_attaque:1},
		classes:	['mage'],
    lore:     "Grâce aux Cœurs de Bois et à des Brindilles Enchantées, un bâton est né.",
    tags:     ['Arme', 'Bâton', 'Mage', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres\nFabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'baton_sylvestre_sha',
		name:			"Bâton Sylvestre Shaman",
		rarity:		'commun',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/baton_sylvestre_shaman.png",
		stats:		{degats:[8,10], vitesse_attaque:1, soin_bonus:[1,2]},
		classes:	['shaman'],
    lore:     "Grâce aux Cœurs de Bois et à des Brindilles Enchantées, un bâton est né.",
    tags:     ['Arme', 'Bâton', 'Shaman', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres\nFabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'baton_squelette_mag',
		name:			"Bâton de Squelette Mage",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/baton_squelettique.png",
		stats:		{degats:15, vitesse_attaque:1},
		classes:	['mage'],
    lore:     "Bâton ancien des ruines maudites, encore vivant de la flamme des morts.",
    tags:     ['Armes', 'Bâton', 'Mage', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Squelettes Mages"
	},
  {
		id:				'baton_squelette_sha',
		name:			"Bâton de Squelette Shaman",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/baton_squelettique.png",
		stats:		{degats:12, vitesse_attaque:1, soin_bonus:2.5},
		classes:	['shaman'],
    lore:     "Bâton ancien des ruines maudites, encore vivant de la flamme des morts.",
    tags:     ['Armes', 'Bâton', 'Shaman', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Squelettes Mages"
	},
  {
		id:				'baton_squelette_maudit_mag',
		name:			"Bâton Squelette Maudit",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/baton_de_squelette_maudit_mage.png",
		stats:		{degats:18, vitesse_attaque:1.1, degats_competence:2.5, sante:-10, mana:-5},
		classes:	['mage'],
    lore:     "Bâton encore imprégné de sa magie après la mort de son propriétaire.",
    tags:     ['Armes', 'Bâton Puissant', 'Mage', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Narax Squelette Maudit"
	},
  {
		id:				'baton_squelette_maudit_sha',
		name:			"Bâton Squelette Maudit",
		rarity:		'rare',
		cat:			'arme_p',category:
		'arme',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/weapons/baton_de_squelette_maudit_shaman.png",
		stats:		{degats:14, vitesse_attaque:1.1, soin_bonus:3.5, regen_mana:0.2, sante:-20},
		classes:	['shaman'],
    lore:     "Bâton encore imprégné de sa magie après la mort de son propriétaire.",
    tags:     ['Armes', 'Bâton Puissant', 'Shaman', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Narax Squelette Maudit"
	},
  {
		id:				'baton_magicien',
		name:			"Bâton du Magicien",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/baton_tolbana.png",
		stats:		{degats:[18,21], vitesse_attaque:1},
		classes:	['mage'],
    lore:     "Forgé au cœur d'un orage silencieux. Ce bâton vibre d'une énergie céleste et puissante.",
    tags:     ['Armes', 'Bâton', 'Mage', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'baton_sorcier',
		name:			"Bâton du Sorcier",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/baton_tolbana.png",
		stats:		{degats:[16,18], vitesse_attaque:1, soin_bonus:[2.5,3.5]},
		classes:	['shaman'],
    lore:     "Forgé au cœur d'un orage silencieux. Ce bâton vibre d'une énergie céleste et puissante.",
    tags:     ['Armes', 'Bâton', 'Shaman', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'baton_magicien_puissant',
		name:			"Bâton du Magicien Puissant",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/baton_tolbana_puissant.png",
		stats:		{degats:[20,22], vitesse_attaque:1.1, degats_competence:3, sante:-15, mana:-10},
		classes:	['mage'],
    lore:     "Ce bâton est une version puissante et concentrée d'énergie, contrairement à l'autre, plus sûre et moins puissante.",
    tags:     ['Armes', 'Bâton Puissant', 'Mage', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'baton_sorcier_puissant',
		name:			"Bâton du Sorcier Puissant",
		rarity:		'rare',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/baton_tolbana_puissant.png",
		stats:		{degats:[18,20], vitesse_attaque:1.1, soin_bonus:[3.5,4.5], regen_mana:0.2, sante:-30},
		classes:	['shaman'],
    lore:     "Ce bâton est une version puissante et concentrée d'énergie, contrairement à l'autre, plus sûre et moins puissante.",
    tags:     ['Armes', 'Bâton Puissant', 'Shaman', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'baton_obscur_mag',
		name:			"Bâton Obscur Mage",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/baton_obscur_mage.png",
		stats:		{degats:[21.5,24.5], vitesse_attaque:1},
		classes:	['mage'],
    lore:     "Bâton fait à partir d'enchantements et de métaux. Parfait pour infliger d'incroyables dégâts.",
    tags:     ['Armes', 'Bâton', 'Mage', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'baton_obscur_sha',
		name:			"Bâton Obscur Shaman",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/baton_obscur_shaman.png",
		stats:		{degats:[19,22], vitesse_attaque:1, soin_bonus:[3,4]},
		classes:	['shaman'],
    lore:     "Bâton fait à partir d'enchantements et de métaux. Parfait pour infliger d'incroyables dégâts.",
    tags:     ['Armes', 'Bâton', 'Shaman', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'baton_obscur_puissant_mag',
		name:			"Bâton Obscur Puissant Mage",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/baton_obscur_mage.png",
		stats:		{degats:[23,27], vitesse_attaque:1.1, degats_competence:4, sante:-20, mana:-15},
		classes:	['mage'],
    lore:     "Bâton fait à partir d'enchantements et de métaux. Parfait pour infliger d'incroyables dégâts.",
    tags:     ['Armes', 'Bâton Puissant', 'Mage', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'baton_obscur_puissant_sha',
		name:			"Bâton Obscur Puissant Shaman",
		rarity:		'epique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/baton_obscur_shaman.png",
		stats:		{degats:[21,22], vitesse_attaque:1.1, soin_bonus:[4.5,5.5], regen_mana:0.3, sante:-40},
		classes:	['shaman'],
    lore:     "Bâton fait à partir d'enchantements et de métaux. Parfait pour infliger d'incroyables dégâts.",
    tags:     ['Armes', 'Bâton Puissant', 'Shaman', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'baton_nodachi_mag',
		name:			"Bâton Nodachi Mage",
		rarity:		'mythique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/baton_nodachi.png",
		stats:		{degats:50, vitesse_attaque:1, crit_comp_chance:15},
		classes:	['mage'],
    lore:     "Bâton très puissant, forgé grâce à la puissance d'Illfang et à des minerais rares. Ce n'est toutefois plus qu'une relique pour le moment.",
    tags:     ['Armes', 'Bâton', 'Mage', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'baton_nodachi_sha',
		name:			"Bâton Nodachi Shaman",
		rarity:		'mythique',
		cat:			'arme_p',
		category:	'arme',
		palier:		1,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/baton_nodachi.png",
		stats:		{degats:35, vitesse_attaque:1.2, soin_bonus:10, regen_sante:0.3, regen_mana:0.3},
		classes:	['shaman'],
    lore:     "Bâton très puissant, forgé grâce à la puissance d'Illfang et à des minerais rares. Ce n'est toutefois plus qu'une relique pour le moment.",
    tags:     ['Armes', 'Bâton', 'Shaman', 'Palier 1', 'Mythique'],
    obtain:   "Obtenable en récompense du Donjon Tour du Kobold"
	},
  {
		id:				'spectre_hivernal_sha',
		name:			"Scpetre Hivernale Shaman",
		rarity:		'',
		cat:			'arme_p',
		category:	'arme',
		palier:		0,
		lvl:			10,
		img:			"../img/compendium/textures/weapons/events/staff_christmas.png",
		stats:		{degats:25, vitesse_attaque:1, soin_bonus:6},
		classes:	['shaman'],
    lore:     "Déborde d'une énergie hivernale qui gèle l'air ambiant. Quiconque le porte est condamné à offrir le bonheur aux enfants.",
    tags:     ['Armes', 'Bâton', 'Shaman', 'Palier 1', 'Event', 'Noël'],
    obtain:   "Obtenable dans les lootboxs de l'Événement Noël"
	},
  /* ══ Catalyseurs ══ */
  {
		id:				'grimoire_delie',
		name:			"Grimoire Delié",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/grimoire_delie-sauvage.png",
		stats:		{degats_magique:2, mana:5},
		classes:	['mage'],
    lore:     "Un livre incomplet débordant de magie.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Mage', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'grimoire_sauvage',
		name:			"Grimoire Sauvage",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			1,
		img:			"../img/compendium/textures/weapons/grimoire_delie-sauvage.png",
		stats:		{regen_mana:0.1, mana:5},
		classes:	['shaman'],
    lore:     "Un livre incomplet débordant de magie.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Shaman', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
	},
  {
		id:				'grimoire_sylvestre',
		name:			"Grimoire Sylvestre",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/grimoire_sylvestre.png",
		stats:		{degats_magique:2.5, mana:7.5},
		classes:	['mage'],
    lore:     "Un livre forgé par des matériaux venant d'un marécage putride et ancien. Il renferme une magie élémentaire.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Mage', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'grimoire_bestial',
		name:			"Grimoire Bestial",
		rarity:		'commun',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/weapons/grimoire_bestial.png",
		stats:		{regen_mana:0.15, mana:7.5},
		classes:	['shaman'],
    lore:     "Un livre forgé par des matériaux venant d'un marécage putride et ancien. Il renferme une magie bestiale.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Shaman', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
	},
  {
		id:				'grimoire_magicien',
		name:			"Grimoire du Magicien",
		rarity:		'rare',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/grimoire_du_magicien.png",
		stats:		{degats_magique:3.5, mana:10},
		classes:	['mage'],
    lore:     "Ce livre a été forgé par le biais de puissants matériaux du Palier 1. Il incarne la puissance d'un magicien.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Mage', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'grimoire_sorcier',
		name:			"Grimoire du Sorcier",
		rarity:		'rare',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/weapons/grimoire_du_sorcier.png",
		stats:		{regen_mana:0.25, mana:10},
		classes:	['shaman'],
    lore:     "Ce livre a été forgé par le biais de puissants matériaux du Palier 1. Il incarne la puissance d'un sorcier.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Shaman', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Armes de Tolbana"
	},
  {
		id:				'grimoire_obscur',
		name:			"Grimoire Obscur",
		rarity:		'epique',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/grimoire_obscur.png",
		stats:		{degats_magique:4, mana:12.5},
		classes:	['mage'],
    lore:     "Un mélange obscur d'anciens matériaux perdu dans un grand labyrinthe. Il pourrait être le grimoire d'un faucheur.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Mage', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  {
		id:				'grimoire_fantomatique',
		name:			"Grimoire Fantomatique",
		rarity:		'epique',
		cat:			'arme_s',
		category:	'arme',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/weapons/grimoire_fantome.png",
		stats:		{regen_mana:0.3, mana:12.5},
		classes:	['shaman'],
    lore:     "Un mélange obscur d'anciens matériaux perdu dans un grand labyrinthe. Il pourrait être le grimoire d'un fantôme.",
    tags:     ['Arme', 'Catalyseur', 'Grimoire', 'Shaman', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Armes à l'extérieur du Donjon du Labyrinthe des Déchus"
	},
  
  /* ══ Accessoires ══ */
  /* ══ Anneaux ══ */
  /* ══ Palier 1 ══ */
  {
		id:				'anneau_cuivre',
		name:			"Anneau de Cuivre",
		set:			'cuivre',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/trinkets/P1/Set de Cuivre/Anneau de Cuivre.png",
		stats:		{sante:5},
    lore:     "Forgé dans un cuivre légèrement poli, cet anneau se distingue par sa conductivité et sa légèreté.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Accessoires de la Ville de Départ\nFabricable au Forgeron d'Accessoires de Cuivre de la Ville de Départ, au Sud, derrière la Cathédrale"
	},
  {
		id:				'anneau_pumba',
		name:			"Anneau de Pumba",
		rarity:		'legendaire',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			3,
		img:			"../img/compendium/textures/trinkets/P1/Anneau de Pumba.png",
		stats:		{sante:10, defense:1},
    lore:     "Taillé dans un métal épais et marqué par une rayure rouge, cet anneau est inspiré du célèbre sanglier massif.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Légendaire'],
    obtain:   "Obtenable en tuant:\n- Pumba"
	},
  {
		id:				'anneau_fer',
		name:			"Anneau de Fer",
		set:			'fer',
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/trinkets/P1/Set de Fer/Anneau de Fer.png",
		stats:		{defense:0.5},
    lore:     "Taillé dans un fer brut, cet anneau est apprécié pour sa solidité plus que son apparence.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Accessoires de la Ville de Départ\nFabricable au Forgeron d'Accessoires de Fer de la Ville de Départ, au Sud, derrière la Cathédrale"
	},
  {
		id:				'bague_gluante',
		name:			"Bague Gluante",
		set:			'slime',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			5,
		img:			"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bague Gluante.png",
		stats:		{sante:2.5, regen_sante:0.1},
    lore:     "Taillé dans un alliage de métal et de gelée, cet anneau est visqueux et solide au toucher.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Commun'],
    obtain:   "Achetale au Marchand d'Accessoires de Vallhat"
	},
  {
		id:				'bague_squelette',
		name:			"Bague de Squelette",
		set:			'squelette',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Bague de Squelette.png",
		stats:		{degats_competence:1, sante:2.5},
    lore:     "Bague forgé par les ossements des squelettes errants des ruines maudites.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Commun'],
    obtain:   "Achetale au Marchand d'Accessoires de Tolbana"
	},
  {
		id:				'anneau_sylvestre',
		name:			"Anneau Sylvestre",
		set:			'sylve',
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			7,
		img:			"../img/compendium/textures/trinkets/P1/Set de la Sylve/Anneau Sylvestre.png",
		stats:		{soin_bonus:1, mana:1, stamina:0.5, regen_sante:0.2},
    lore:     "Taillé dans du bois de chêne, renforcé par du bois magique et enchanté d'allium.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Accessoires de la Ville de Départ"
	},
  {
		id:				'anneau_gluant',
		name:			"Anneau Gluant",
		set:			'slime',
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Anneau Gluant.png",
		stats:		{tenacite:15, sante:20, regen_sante:0.5},
    lore:     "Un anneau étrange, recouverte d'une fine couche visqueuse. Peu élégant, mais il pulse d'une énergie insolite.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret de Vallhat"
	},
  {
		id:				'anneau_leviathan',
		name:			"Anneau de Léviathan",
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		1,
		lvl:			9,
		img:			"../img/compendium/textures/trinkets/P1/Anneau de Léviathan.png",
		stats:		{defense:2.5},
    lore:     "Anneau forgé dans les abysses, portant la marque du Léviathan. Il inspire puissance et crainte.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 1', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret de l'Antre d'Aepep, à côté de Virelune"
	},
	{
    id:       'anneau_faucheuse',
    name:     "Anneau de la Faucheuse",
		set:			'anneau_dechu',
    rarity:   "legendaire",
		cat:			'anneau',
    category: 'accessoire',
    palier:   1,
		lvl:			9,
    image:    "", //NULL
		stats:		{mana:20, stamina:10},
    lore:     "Anneau qui appartenait à la faucheuse. À son départ il est tombé par terre, encore imprégné de sa grande magie.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', "Légendaire"],
    obtain:   "Obtenable en tuant : Faucheuse Déchue"
  },
  /* ══ Palier 2 ══ */
  {
		id:				'bague_bouleau',
		name:			"Bague de Bouleau",
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Bague de Bouleau.png",
		stats:		{defense:1, sante:10},
    lore:     "Une bague façonnée dans un bois de bouleau clair, serti d'une pierre de fer brute au cœur sombre et métallique.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Urbus"
	},
  {
		id:				'anneau_acacia',
		name:			"Anneau d'Acacia",
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Anneau d'Acacia.png",
		stats:		{degats:2, crit_chance:2.5, sante:5},
    lore:     "Un anneau sculpté dans le bois chaud d'acacia, orné d'une pierre de cuivre aux reflets rougeoyants.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Urbus"
	},
  {
		id:				'anneau_mielleux',
		name:			"Anneau Mielleux",
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Anneau Mielleux.png",
		stats:		{soin_bonus:1, sante:10},
    lore:     "Un anneau doré aux reflets ambrés, dont la surface lisse rappelle l'éclat du miel fraîchement coulé.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Commun'],
    obtain:   "Achetable au Marchand d'Accessoires de Kaelor"
	},
  {
		id:				'anneau_taureau',
		name:			"Anneau du Taureau",
		set:			'taureau',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Set des Taureaux/Anneau du Taureau.png",
		stats:		{degats:2, sante:10},
    lore:     "Forgé dans un métal lourd et brut, il porte la marque du taureau sauvage. Force brute et résistance sans faille.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Kaelor"
	},
  {
		id:				'anneau_ours',
		name:			"Anneau de l'Ours",
		set:			'ours',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Set des Ours/Anneau de l'Ours.png",
		stats:		{crit_comp_degats:1, defense:0.5, sante:5},
    lore:     "Forgé dans un métal lourd et brut, il porte la marque de l'ours sauvage. Force brute et résistance sans faille.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Kaelor"
	},
  {
		id:				'anneau_ferraille',
		name:			"Anneau de Ferraille",
		set:			'ferraille',
		rarity:		'commun',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			11,
		img:			"../img/compendium/textures/trinkets/P2/Set de Ferraille/Anneau de Ferraille.png",
		stats:		{defense:0.5, sante:10},
    lore:     "Forgé dans une ferraille rustique, cet anneau se distingue par sa couleur clair et sa solidité.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Ferraille, au Nord-Est de la Baie des Monstres Ondoyante"
	},
  {
		id:				'anneau_bauxite',
		name:			"Anneau de Bauxite",
		set:			'bauxite',
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			12,
		img:			"../img/compendium/textures/trinkets/P2/Set de Bauxite/Anneau de Bauxite.png",
		stats:		{defense:1, sante:10},
    lore:     "Forgé dans de la bauxite éclatant, cet anneau se distingue par puissance, sa couleur claire et sa solidité.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Rare'],
    obtain:   "Fabricable au Forgeron d'Accessoires de Bauxite, au Sud du Baobab Millénaire"
	},
  {
		id:				'anneau_aventurier',
		name:			"Anneau de l'Aventurier",
		rarity:		'rare',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"", //NULL
		stats:		{vitesse_attaque:0.1, crit_comp_degats:1, defense:1, soin_bonus:1, sante:1, mana:1, stamina:1, regen_sante:0.1, regen_mana:0.1, regen_stamina:0.1},
    lore:     "Forgé il y a longtemps, cet anneau porte la marque des plus grands aventuriers du royaume.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Rare'],
    obtain:   "Récupérable une fois fini la Quête Secondaire «L'Épreuve du Chasseur», donné par Typpe"
	},
  {
		id:				'anneau_harpie_enflammee',
		name:			"Anneau de la Harpie Enflammée",
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Enflammée.png",
		stats:		{degat_arme:7.5, vol_vie:2, sante:15},
    lore:     "La légende raconte que cet anneau est encore imprégné de la soif de sang de la Harpie dont il provient.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret du Nid de Brasier"
	},
  {
		id:				'anneau_harpie_ecrasee',
		name:			"Anneau de la Harpie Écrasée",
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Écrasée.png",
		stats:		{defense:2.5, reduction_degats:2.5, maitrise_bloc:5, puissance_bloc:1},
    lore:     "Un anneau léger sculpté dans une serre de Harpie des Forêts. Sa couleur verte semble se fondre parfaitement dans le feuillage.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret de la Forêt des Ailes d'Émeraude"
	},
  {
		id:				'anneau_harpie_noyee',
		name:			"Anneau de la Harpie Noyée",
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Noyée.png",
		stats:		{degats_competence:7.5, omnivamp:1.5, mana:10, stamina:5},
    lore:     "Une griffe de harpie parcourue de courants électrique haute tension. Elle ne blesse pas le porteur, mais canalise son flux magique vers ses extrémités.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret de la Baie des Monstres Ondoyante"
	},
  {
		id:				'anneau_onyx_impur',
		name:			"Anneau d'Onyx Impur",
		set:			'onyx_impur',
		rarity:		'epique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/trinkets/P2/Set d'Onyx Impur/Anneau d'Onyx Impur.png",
		stats:		{crit_chance:1, defense:1.5, sante:10},
    lore:     "Forgé grâce à de l'onyx impur cet anneau est incomplet mais semble très puissant malgré tout.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Épique'],
    obtain:   "Fabricable au Forgeron d'Accessoires d'Onyx Impur, au Sud de Taran"
	},
  {
		id:				'anneau_winnie',
		name:			"Anneau de Winnie",
		set:			'ours',
		rarity:		'mythique',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			13,
		img:			"../img/compendium/textures/trinkets/P2/Set des Ours/Bague de Winnie.png",
		stats:		{crit_chance:5, crit_comp_chance:5, reduction_degats:2.5, sante:10},
    lore:     "Une fine bague aux reflets bronzés, ornée d'un petit cristal jaune lumineux rappelant la chaleur et la bienveillance de son ancienne propriétaire.",
    tags:     ['Accessoire', 'Anneau', 'Secret', 'Palier 2', 'Mythique'],
    obtain:   "Fabricable au Forgeron d'Accessoires Secret de la Forêt Sucrée, dans l'Antre du Boss Winnie"
	},
  {
		id:				'anneau_onyx_pur',
		name:			"Anneau d'Onyx Pur",
		set:			'onyx_pur',
		rarity:		'legendaire',
		cat:			'anneau',
		category:	'accessoire',
		palier:		2,
		lvl:			14,
		img:			"../img/compendium/textures/trinkets/P2/Set d'Onyx Pur/Anneau d'Onyx Pur.png",
		stats:		{crit_chance:2, crit_degats:1, defense:1, sante:20},
    lore:     "Forgé grâce à de l'onyx pur cet anneau est complet et est très puissant.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Légendaire'],
    obtain:   "Fabricable au Forgeron d'Accessoires d'Onyx Pur, situé dans les grottes de la Faille au Sud-Est du Palier 2"
	},
  /* ══ Events ══ */
  {
		id:				'anneau_amour',
		name:			"Anneau d'Amour",
		rarity:		'',
		cat:			'anneau',
		category:	'accessoire',
		palier:		0,
		lvl:			10,
		img:			"../img/compendium/textures/trinkets/Valentin/Anneau d'Amour.png",
		stats:		{crit_chance:5, crit_degats:5, crit_comp_chance:5, crit_comp_degats:5, sante:15},
    lore:     "Un anneau délicatement gravé aux reflets chalereux, symbole d'un lien précieux.",
    tags:     ['Accessoire', 'Anneau', 'Palier 2', 'Event', 'Saint Valentin'],
    obtain:   "..."
	},
  /* ══ Amulettes ══ */
  /* ══ Palier 1 ══ */
  {
		id:'amulette_cuivre', 				name:"Amulette de Cuivre",     			set:'cuivre',    	rarity:'commun',    cat:'amulette',  	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Amulette de Cuivre.png",                      	stats:{sante:5} },
  {
		id:'amulette_bois',   				name:"Amulette des Bois",       		set:'sylve',     	rarity:'commun',    cat:'amulette',  	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Amulette des Bois.png",                     	stats:{degats_competence:2.5, mana:2.5, stamina:1.5} },
  {
		id:'collier_albal',   				name:"Collier de Albal",        		set:'loup',      	rarity:'rare',      cat:'amulette',  	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set Loup Faiblard/Collier d'Albal.png",                    		stats:{crit_chance:5, vitesse_deplacement:0.25} },
  {
		id:'amulette_gluante',   			name:"Amulette Gluante",        		set:'slime',     	rarity:'commun',    cat:'amulette',  	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Amulette Gluante.png",           		stats:{soin_bonus:1, regen_sante:0.1} },
  {
		id:'amulette_fer',    				name:"Amulette de Fer",          		set:'fer',       	rarity:'rare',      cat:'amulette',  	palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Amulette de Fer.png",                           		stats:{defense:1, sante:5} },
  {
		id:'amulette_squelletique',  		name:"Amulette Squelettique",   		set:'squelette', 	rarity:'rare',      cat:'amulette',  	palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Amulette Squelettique.png",      		stats:{degats_competence:1, mana:4, stamina:2} },
  /* ══ Palier 2 ══ */
  {
		id:'collier_acamiel',  				name:"Collier Acamiel",   			 						rarity:'rare',      cat:'amulette',  	palier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Collier Acamiel.png",      									stats:{vitesse_attaque:0.1, soin_bonus:1} },
  {
		id:'amulette_ferraille',  			name:"Amulette de Ferraille",  			set:'ferraille', 	rarity:'commun',    cat:'amulette',  	palier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Amulette de Ferraille.png",      				stats:{defense:1, sante:10} },
  {
		id:'amulette_bauxite',  			name:"Amulette de Bauxite",  			set:'bauxite', 		rarity:'rare',    	cat:'amulette',  	palier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Amulette de Bauxite.png",      					stats:{defense:1.5, sante:10} },
  {
		id:'collier_tricolore',  			name:"Collier Tricolore",  									rarity:'rare',    	cat:'amulette',  	palier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Collier Tricolore.png",      									stats:{degats_arme:10, degats_competence:5, vol_vie:1, omnivamp:2, defense:1, maitrise_bloc:2.5, puissance_bloc:0.5, sante:5, mana:5, stamina:2.5} },
  {
		id:'collier_taureaux',  			name:"Collier des Taureaux",  			set:'taureau', 		rarity:'rare',    	cat:'amulette',  	palier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Set des Taureaux/Collier des Taureaux.png",      				stats:{crit_chance:2.5, degats_physique:2.5, sante:5} },
  {
		id:'collier_runique', 	 			name:"Collier Runique", 	 			set:'squelette', 	rarity:'epique',    cat:'amulette',  	palier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Collier Runique.png",      									stats:{defense:2.5, sante:15} },
  {
		id:'amulette_onyx_impur', 	 		name:"Amulette d'Onyx Impur", 	 		set:'onyx_impur', 	rarity:'epique',    cat:'amulette',  	palier:2, lvl:13,  img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Impur/Amulette d'Onyx Impur.png",      				stats:{defense:2, sante:15} },
  {
		id:'amulette_onyx_pur', 	 		name:"Amulette d'Onyx Pur", 	 		set:'onyx_pur', 	rarity:'legendaire',cat:'amulette',  	palier:2, lvl:14,  img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Pur/Amulette d'Onyx Pur.png",      					stats:{defense:2, sante:20} },
  /* ══ Events ══ */
  {
		id:'collier_amour',    				name:"Collier d'Amour",          			    			rarity:'',   	 	cat:'amulette',     palier:0, lvl:10, img:"",                        		stats:{sante:5, mana:5, stamina:5} },
  /* ══ Gants ══ */
  /* ══ Palier 1 ══ */
  {
		id:'gants_cuivre',    				name:"Gants de Cuivre",          		set:'cuivre',    	rarity:'commun',    cat:'gants',     	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Gants de Cuivre.png",                        		stats:{degats:1} },
  {
		id:'gants_cerfs',     				name:"Gants des Cerfs",          		set:'cerf',      	rarity:'commun',    cat:'gants',     	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Gants des Cerfs.png",              		stats:{degats_competence:2} },
  {
		id:'gants_bandit',    				name:"Gants de Bandit",                           			rarity:'commun',    cat:'gants',     	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Gants de Bandit.png",                                      		stats:{vitesse_attaque:0.1} },
  {
		id:'gants_osseux',        			name:"Gants Osseux",              		set:'squelette', 	rarity:'rare',      cat:'gants',     	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Gants Osseux.png",              		stats:{defense:0.5} },
  {
		id:'gants_fer',       				name:"Gants de Fer",              		set:'fer',       	rarity:'rare',      cat:'gants',     	palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Gants de Fer.png",                             		stats:{degats:1.5} },
  /* ══ Palier 2 ══ */
  {
		id:'gants_taureaux',       			name:"Gants des Taureaux",              set:'taureau',      rarity:'commun',    cat:'gants',     	palier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Set des Taureaux/Gants des Taureaux.png",                      stats:{degats_physique:1.5, defense:0.5, mana:5, stamina:2.5} },
  {
		id:'gants_ours',       				name:"Gants des Ours",              				    	rarity:'rare',    	cat:'gants',     	palier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Set des Ours/Gants des Ours.png",                      		stats:{defense:1, regen_mana:0.6, regen_stamina:0.3} },
  {
		id:'gants_ferraille',       		name:"Gants de Ferraille",             	set:'ferraille',	rarity:'commun',   	cat:'gants',     	palier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Gants de Ferraille.png",                     	stats:{degats:2, crit_chance:2.5} },
  {
		id:'gants_bauxite',       			name:"Gants de Bauxite",             	set:'bauxite',		rarity:'rare',   	cat:'gants',     	palier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Gants de Bauxite.png",                     		stats:{degats:2.5, crit_chance:3, defense:1} },
  {
		id:'gants_onyx_impur',       		name:"Gants d'Onyx Impur",             	set:'onyx_impur',	rarity:'epique',   	cat:'gants',     	palier:2, lvl:13,  img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Impur/Gants d'Onyx Impur.png",                     	stats:{degats:2.5, crit_chance:3, defense:1} },
  {
		id:'gants_onyx_pur',       			name:"Gants d'Onyx Pur",             	set:'onyx_pur',		rarity:'legendaire',cat:'gants',     	palier:2, lvl:14,  img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Pur/Gants d'Onyx Pur.png",                     		stats:{degats:2.5, crit_chance:3, defense:1} },
  /* ══ Events ══ */
  {
		id:'moufles_noel_vertes',    		name:"Moufles de Noël Vertes",          			    	rarity:'',   	 	cat:'gants',     	palier:0, lvl:10, img:"../img/compendium/textures/trinkets/Christmas/gants_noel_vert.png",                        			stats:{esquive:10, soin_bonus:5, sante:5, regen_sante:0.3, regen_mana:0.4, regen_stamina:0.2} },
  /* ══ Bracelets ══ */
  /* ══ Palier 1 ══ */
  {
		id:'bracelet_cuivre', 				name:"Bracelet de Cuivre",        		set:'cuivre',    	rarity:'commun',    cat:'bracelet',  	palier:1, lvl:3,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Bracelet de Cuivre.png",                    		stats:{sante:5} },
  {
		id:'bracelet_fer',    				name:"Bracelet de Fer",            		set:'fer',       	rarity:'rare',      cat:'bracelet', 	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Bracelet de Fer.png",                         		stats:{sante:5, defense:1} },
  {
		id:'bracelet_sylvestre',   			name:"Bracelet Sylvestre",         		set:'sylve',     	rarity:'commun',    cat:'bracelet', 	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Bracelet Sylvestre.png",                 		stats:{regen_sante:0.2, regen_mana:0.2, regen_stamina:0.2} },
  {
		id:'bracelet_araignee',   			name:"Bracelet d'Araignée",                         		rarity:'rare',      cat:'bracelet', 	palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Bracelet d'Araignée.png",                               		stats:{esquive:2.5, vitesse_deplacement:0.5} },
  {
		id:'bracelet_gluant',   			name:"Bracelet Gluant",            		set:'slime',     	rarity:'rare',      cat:'bracelet', 	palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bracelet Gluant.png",         		stats:{soin_bonus:1, sante:5, regen_sante:0.1} },
  {
		id:'bracelet_cerf',   				name:"Bracelet des Cerfs",          	set:'cerf',      	rarity:'rare',      cat:'bracelet',		palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Bracelet des Cerfs.png",        		stats:{mana:2, stamina:1, regen_mana:0.2, regen_stamina:0.2} },
  {
		id:'bracelet_glace',  				name:"Bracelet de Glace",                            		rarity:'epique',    cat:'bracelet',		palier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Bracelet de Glace.png",                                 		stats:{degats_competence:5, regen_mana:0.3, regen_stamina:0.2} },
  /* ══ Palier 2 ══ */
  {
		id:'bracelet_loups',  				name:"Bracelet des Loups",              set:'loup',         rarity:'commun',    cat:'bracelet',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set Loup Faiblard/Bracelet des Loups.png",                      stats:{degats:2, vitesse_attaque:0.1, defense:0.5} },
  {
		id:'bracelet_mielleux',  			name:"Bracelet Mielleux",              				        rarity:'rare',    	cat:'bracelet',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Bracelet Mielleux.png",                      					stats:{hate:2.5, soin_bonus:2, sante:5, mana:2.5} },
  {
		id:'bracelet_runimiel',  			name:"Bracelet Runimiel",              				        rarity:'rare',    	cat:'bracelet',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Bracelet Runimiel.png",                      					stats:{soin_bonus:5, sante:-10, mana:-10} },
  {
		id:'bracelet_ferraille',  			name:"Bracelet de Ferraille",           set:'ferraille',    rarity:'commun',    cat:'bracelet',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Bracelet de Ferraille.png",                    stats:{defense:1, sante:10} },
  {
		id:'bracelet_bauxite',  			name:"Bracelet de Bauxite",          	set:'bauxite',    	rarity:'rare',    	cat:'bracelet',		palier:2, lvl:12, img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Bracelet de Bauxite.png",                    	stats:{defense:2, sante:10} },
  {
		id:'bracelet_onyx_impur',  			name:"Bracelet d'Onyx Impur",          	set:'onyx_impur',   rarity:'epique',    cat:'bracelet',		palier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Impur/Bracelet d'Onyx Impur.png",                    stats:{defense:2, sante:15, regen_sante:0.1} },
  {
		id:'bracelet_onyx_pur',  			name:"Bracelet d'Onyx Pur",          	set:'onyx_pur',    	rarity:'legendaire',cat:'bracelet',		palier:2, lvl:14, img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Pur/Bracelet d'Onyx Pur.png",                    	stats:{defense:2, sante:20, regen_sante:0.2} },
  /* ══ Events ══ */
  {
		id:'bracelet_yuleck',    			name:"Bracelet de Yuleck",          			    		rarity:'',   	 	cat:'bracelet',     palier:0, lvl:10, img:"../img/compendium/textures/trinkets/Christmas/bracelet_yuleck.png",                        			stats:{soin_bonus:2, sante:7, regen_sante:0.3, vitesse_deplacement:-0.5} },
  /* ══ Artefacts ══ */
  {
		id:'manteau_vole',    				name:"Manteau Volé",                                  		rarity:'commun',    cat:'artefact',		palier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Manteau Volé.png",                                    			stats:{defense:1.5, sante:10} },
  {
		id:'lien_sylve',      				name:"Lien de la Sylve",            	set:'sylve',     	rarity:'legendaire',cat:'artefact',		palier:1, lvl:5, 	img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Lien de la Sylve.png",                 			stats:{sante:10, mana:10, stamina:5} },
  {
		id:'piece_cuivre',    				name:"Pièce de Cuivre",              	set:'cuivre',    	rarity:'commun',    cat:'artefact',		palier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Pièce de Cuivre.png",                   			stats:{defense:1} },
  {
		id:'piece_fer',       				name:"Pièce de Fer",                  	set:'fer',       	rarity:'rare',      cat:'artefact',		palier:1, lvl:9,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Pièce de Fer.png",                        			stats:{defense:1, sante:5} },
  {
		id:'collier_aragorn', 				name:"Collier d'Aragorn",                              		rarity:'epique',    cat:'artefact',		palier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Collier de Aragorn.png",                             			stats:{reduction_degats:3, reduction_chutes:25, esquive:3} },
  {
		id:'manteau_minuit',  				name:"Manteau de Minuit",                              		rarity:'godlike',   cat:'artefact',		palier:1, lvl:10, img:"../img/compendium/textures/trinkets/P1/Manteau de Minuit.png",                              			stats:{degats:5, esquive:15, mana:25, stamina:15, vitesse:2} },
  /* ══ Palier 2 ══ */
  {
		id:'simple_ceinture',  				name:"Simple Ceinture",                              		rarity:'commun',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Simple Ceinture.png",                              				stats:{defense:1, sante:5, mana:3, stamina:1.5} },
  {
		id:'ceinture_taureau',  			name:"Ceinture du Taureau",             set:'taureau',      rarity:'rare',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set des Taureaux/Ceinture du Taureau.png",                      stats:{crit_degats:3.5, defense:0.5, sante:10} },
  {
		id:'ceinture_ours',  				name:"Ceinture de l'Ours",              set:'ours',         rarity:'rare',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set des Ours/Ceinture de l'Ours.png",                           stats:{crit_comp_degats:2.5, defense:1.5, sante:5} },
  {
		id:'piece_ferraille',  				name:"Pièce de Ferraille",              set:'ferraille',    rarity:'commun',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Pièce de Ferraille.png",                       stats:{defense:2, sante:5} },
  {
		id:'plume_flamboyante',  			name:"Plume Flamboyante",                              		rarity:'rare',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Plume Flamboyante.png",                              			stats:{degats_arme:3, vol_vie:1.7, sante:7} },
  {
		id:'plume_ecarlate',  				name:"Plume Écarlate",                              		rarity:'rare',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Plume Écarlate.png",                              				stats:{defense:1, reduction_degats:1, maitrise_bloc:2.5, puissance_bloc:0.5} },
  {
		id:'plume_azur',  					name:"Plume Azur",                              			rarity:'rare',   	cat:'artefact',		palier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Plume Azur.png",                              					stats:{degats_competence:3, omnivamp:1, mana:5, stamina:2.5} },
  {
		id:'piece_bauxite',  				name:"Pièce de Bauxite",              	set:'bauxite',    	rarity:'rare',   	cat:'artefact',		palier:2, lvl:12, img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Pièce de Bauxite.png",                       	stats:{crit_chance:2.5, defense:2, sante:10} },
  {
		id:'piece_onyx_impur',  			name:"Pièce d'Onyx Impur",             	set:'onyx_impur',   rarity:'epique',   	cat:'artefact',		palier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Impur/Pièce d'Onyx Impur.png",                       stats:{crit_chance:3, crit_degats:1.5, defense:2.5, sante:13} },
  {
		id:'talisman_feroce',  				name:"Talisman Féroce",              	set:'taureau',    	rarity:'epique',   	cat:'artefact',		palier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Set des Taureaux/Talisman Féroce.png",                       	stats:{crit_chance:3.5, degats_arme:10, defense:1} },
  {
		id:'piece_onyx_pur',  				name:"Pièce d'Onyx Pur",              	set:'onyx_pur',    	rarity:'legendaire',cat:'artefact',		palier:2, lvl:14, img:"../img/compendium/textures/trinkets/P2/Set d'Onyx Pur/Pièce d'Onyx Pur.png",                       	stats:{crit_chance:4, crit_degats:2, defense:3, sante:15} },
  {
		id:'masque_corrompu',  				name:"Masque Corrompu",              	set:'faible_corru', rarity:'godlike',	cat:'artefact',		palier:2, lvl:14, img:"../img/compendium/textures/trinkets/P2/Masque Corrompu.png",                       					stats:{crit_chance:10, crit_degats:10, crit_comp_chance:10, crit_comp_degats:10, degats_arme:10, degats_competence:10, sante:-50} },
  /* ══ Events ══ */
  {
		id:'bracelet_rafales',    			name:"Bracelet des Rafales",          			    		rarity:'',   	 	cat:'artefact',     palier:0, lvl:10, img:"",                        		stats:{esquive:2.5, sante:5, mana:5, stamina:5, vitesse_deplacement:0.5} },
  {
		id:'couronne_solstice',    			name:"Couronne du Solstice",          			    		rarity:'',   	 	cat:'artefact',     palier:0, lvl:10, img:"",                        		stats:{hate:5, mana:5, stamina:2.5} },

  /* ══ Armures ══ */
  {
		id:'tunique_debutant',     			name:"Tunique du Débutant",                            		rarity:'commun',    cat:'plastron',  	palier:1, lvl:1,  img:"../img/compendium/textures/armors/chestplate_debutant.png", 						stats:{sante:[12,15]} },
  {
		id:'jambieres_debutamt',   			name:"Jambières du Débutant",                          		rarity:'commun',    cat:'jambières', 	palier:1, lvl:1,  img:"../img/compendium/textures/armors/leggings_debutant.png", 							stats:{sante:[7,10]} },
  {
		id:'bottes_debutant',      			name:"Bottes du Débutant",                             		rarity:'commun',    cat:'bottes',    	palier:1, lvl:1,  img:"../img/compendium/textures/armors/boots_debutant.png", 							stats:{sante:[5,7]} },
  /* ══ Guerrier ══ */
  /* ══ Palier 1 ══ */
  {
		id:'tunique_ika',     				name:"Tunique d'Ika",          			set:'ika',          rarity:'commun',    cat:'plastron',  	palier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_ika.png", 							stats:{sante:[23,25.99], defense:[0.7,1.2]}, classes:['guerrier'] },
  {
		id:'jambieres_ika',   				name:"Jambières d'Ika",        			set:'ika',          rarity:'commun',    cat:'jambières', 	palier:1, lvl:3,  img:"../img/compendium/textures/armors/leggings_ika.png", 								stats:{sante:[20,25], defense:[0.6,1]}, classes:['guerrier'] },
  {
		id:'bottes_ika',      				name:"Bottes d'Ika",            		set:'ika',          rarity:'commun',    cat:'bottes',    	palier:1, lvl:3,  img:"../img/compendium/textures/armors/boots_ika.png", 									stats:{sante:[17,20], defense:[0.4,0.8]}, classes:['guerrier'] },
  {
		id:'casque_titan',    				name:"Casque du Titan",          		set:'titan',        rarity:'rare',      cat:'casque',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/helmet_titan.png",        						stats:{sante:[30,35], defense:[1.2,1.6]}, classes:['guerrier'] },
  {
		id:'plastron_titan',  				name:"Plastron du Titan",        		set:'titan',        rarity:'rare',      cat:'plastron',  	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_titan.png",    						stats:{sante:[34,38.99], defense:[3.2,3.7]}, classes:['guerrier'] },
  {
		id:'jambieres_titan', 				name:"Jambières du Titan",       		set:'titan',        rarity:'rare',      cat:'jambières', 	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_titan.png",      						stats:{sante:[32,37], defense:[1.4,1.92]}, classes:['guerrier'] },
  {
		id:'bottes_titan',    				name:"Bottes du Titan",           		set:'titan',        rarity:'rare',      cat:'bottes',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_titan.png",          						stats:{sante:[27,31], defense:[0.9,1.4]}, classes:['guerrier'] },
  {
		id:'casque_gardien',     			name:"Casque du Gardien",         		set:'gardien',      rarity:'epique',    cat:'casque',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_gardien.png", 							stats:{sante:[30,35], defense:[2,2.5]}, classes:['guerrier'] },
  {
		id:'plastron_gardien',   			name:"Plastron du Gardien",       		set:'gardien',      rarity:'epique',    cat:'plastron',  	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_gardien.png", 						stats:{sante:[34,40], defense:[3.5,4], 'Emplacement de Runes':2}, classes:['guerrier'] },
  {
		id:'jambieres_gardien',   			name:"Jambières du Gardien",      		set:'gardien',      rarity:'epique',    cat:'jambières', 	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_gardien.png", 							stats:{sante:[32,37], defense:[3,3.5]}, classes:['guerrier'] },
  {
		id:'bottes_gardien',     			name:"Bottes du Gardien",          		set:'gardien',      rarity:'epique',    cat:'bottes',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_gardien.png", 								stats:{sante:[28,33], defense:[1.6,2]}, classes:['guerrier'] },
  /* ══ Palier 2 ══ */
  {
		id:'casque_ruche',     				name:"Casque de la Ruche",         		set:'abeille_guer', rarity:'rare',    	cat:'casque',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/helmet_abeille.png", 							stats:{sante:[35,41], defense:[3,3.5]}, classes:['guerrier'] },
  {
		id:'plastron_ruche',   				name:"Plastron de la Ruche",       		set:'abeille_guer', rarity:'rare',    	cat:'plastron',  	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/chestplate_abeille.png", 						stats:{sante:[40.01,49.99], defense:[4,5], 'Emplacement de Runes':1}, classes:['guerrier'] },
  {
		id:'jambieres_ruche',   			name:"Jambières de la Ruche",      		set:'abeille_guer', rarity:'rare',    	cat:'jambières', 	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/leggings_abeille.png", 							stats:{sante:[37,45], defense:[3.5,3.9]}, classes:['guerrier'] },
  {
		id:'bottes_ruche',     				name:"Bottes de la Ruche",          	set:'abeille_guer', rarity:'rare',    	cat:'bottes',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/boots_abeille.png", 								stats:{sante:[33,38.99], defense:[2,2.5]}, classes:['guerrier'] },
  {
		id:'casque_necro_guer',     		name:"Casque du Nécromancien",         	set:'necro_guer', 	rarity:'epique',    cat:'casque',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/helmet_necromancien.png", 							stats:{sante:[43,50], defense:[4,4.5]}, classes:['guerrier'] },
  {
		id:'plastron_necro_guer',   		name:"Plastron du Nécromancien",       	set:'necro_guer', 	rarity:'epique',    cat:'plastron',  	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/chestplate_necromancien.png", 						stats:{sante:[47,57], defense:[6,7], 'Emplacement de Runes':2}, classes:['guerrier'] },
  {
		id:'jambieres_necro_guer',   		name:"Jambières du Nécromancien",      	set:'necro_guer', 	rarity:'epique',    cat:'jambières', 	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/leggings_necromancien.png", 							stats:{sante:[45,51.98], defense:[4.5,5]}, classes:['guerrier'] },
  {
		id:'bottes_necro_guer',     		name:"Bottes du Nécromancien",          set:'necro_guer', 	rarity:'epique',    cat:'bottes',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/boots_necromancien.png", 								stats:{sante:[41.01,46.99], defense:[3,3.5]}, classes:['guerrier'] },
  /* ══ Assassin - Archer ══ */
  /* ══ Palier 1 ══ */
  {
		id:'tunique_tactiaque',   			name:"Tunique Tactique",           		set:'tactique',     rarity:'commun',    cat:'plastron',  	palier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_tactique.png",  						stats:{sante:[21,25], defense:0.4}, classes:['assassin','archer'] },
  {
		id:'jambieres_tactique', 			name:"Jambières Tactique",         		set:'tactique',     rarity:'commun',    cat:'jambières', 	palier:1, lvl:3,  img:"../img/compendium/textures/armors/leggings_tactique.png",    						stats:{sante:[17,21], defense:0.4}, classes:['assassin','archer'] },
  {
		id:'bottes_tactique',    			name:"Bottes Tactique",             	set:'tactique',     rarity:'commun',    cat:'bottes',    	palier:1, lvl:3,  img:"../img/compendium/textures/armors/boots_tactique.png",        						stats:{sante:[15,18], defense:0.3}, classes:['assassin','archer'] },
  {
		id:'tunique_ninja',   				name:"Tunique du Ninja",            	set:'ninja',        rarity:'rare',      cat:'plastron',  	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_ninja.png",     						stats:{sante:[29,34], defense:[1.5,2.3]}, classes:['assassin'] },
  {
		id:'jambieres_ninja', 				name:"Jambières du Ninja",          	set:'ninja',        rarity:'rare',      cat:'jambières', 	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_ninja.png",       						stats:{sante:[23,27], defense:[0.9,1.4]}, classes:['assassin'] },
  {
		id:'bottes_ninja',    				name:"Bottines du Ninja",            	set:'ninja',        rarity:'rare',      cat:'bottes',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_ninja.png",           						stats:{sante:[18,23], defense:[0.8,1]}, classes:['assassin'] },
  {
		id:'tunique_chasseur',   			name:"Plastron du Chasseur",         	set:'chasseur',     rarity:'rare',      cat:'plastron',  	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_chasseur.png",  						stats:{sante:[25,30], defense:[1.3,2]}, classes:['archer'] },
  {
		id:'jambieres_chasseur', 			name:"Jambières du Chasseur",        	set:'chasseur',     rarity:'rare',      cat:'jambières', 	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_chasseur.png",    						stats:{sante:[20,24], defense:[0.7,1.2]}, classes:['archer'] },
  {
		id:'bottes_chasseur',    			name:"Bottines du Chasseur",          	set:'chasseur',     rarity:'rare',      cat:'bottes',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_chasseur.png",        						stats:{sante:[16,20], defense:[0.7,0.9]}, classes:['archer'] },
  {
		id:'casque_heraut',      			name:"Casque du Héraut",              	set:'heraut',       rarity:'epique',    cat:'casque',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_heraut.png", 								stats:{sante:[26,31], defense:[2.7,3.2]}, classes:['assassin','archer'] },
  {
		id:'plastron_heraut',    			name:"Plastron du Héraut",            	set:'heraut',       rarity:'epique',    cat:'plastron',  	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_heraut.png", 							stats:{sante:[32,37], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['assassin','archer'] },
  {
		id:'jambieres_heraut',   			name:"Jambières du Héraut",           	set:'heraut',       rarity:'epique',    cat:'jambières', 	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_heraut.png", 							stats:{sante:[23,27], defense:[2.9,3.4]}, classes:['assassin','archer'] },
  {
		id:'bottes_heraut',      			name:"Bottes du Héraut",               	set:'heraut',       rarity:'epique',    cat:'bottes',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_heraut.png", 								stats:{sante:[18,23], defense:[2.8,3]}, classes:['assassin','archer'] },
  /* ══ Palier 2 ══ */
  {
		id:'casque_assassin',     			name:"Casque de l'assassin",         	set:'abeille_assa', rarity:'rare',    	cat:'casque',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/helmet_abeille.png", 							stats:{sante:[26,31], defense:[3.3,3.6]}, classes:['assassin'] },
  {
		id:'plastron_assassin',   			name:"Plastron de l'assassin",       	set:'abeille_assa', rarity:'rare',    	cat:'plastron',  	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/chestplate_abeille.png", 						stats:{sante:[37,42], defense:[4.3,4.7], 'Emplacement de Runes':1}, classes:['assassin'] },
  {
		id:'jambieres_assassin',   			name:"Jambières de l'assassin",      	set:'abeille_assa', rarity:'rare',    	cat:'jambières', 	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/leggings_abeille.png", 							stats:{sante:[27,31.06], defense:[3.4,3.7]}, classes:['assassin'] },
  {
		id:'bottes_assassin',     			name:"Bottes de l'assassin",          	set:'abeille_assa', rarity:'rare',    	cat:'bottes',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/boots_abeille.png", 								stats:{sante:[23.01,38.99], defense:[3,3.4]}, classes:['assassin'] },
  {
		id:'casque_necro_assa',     		name:"Casque du Nécromancien",         	set:'necro_assa', 	rarity:'epique',    cat:'casque',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/helmet_necromancien.png", 							stats:{sante:[32,37], defense:[3.7,4]}, classes:['assassin'] },
  {
		id:'plastron_necro_assa',   		name:"Plastron du Nécromancien",       	set:'necro_assa', 	rarity:'epique',    cat:'plastron',  	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/chestplate_necromancien.png", 						stats:{sante:[35,41.15], defense:[4.27,4.5], 'Emplacement de Runes':2}, classes:['assassin'] },
  {
		id:'jambieres_necro_assa',   		name:"Jambières du Nécromancien",      	set:'necro_assa', 	rarity:'epique',    cat:'jambières', 	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/leggings_necromancien.png", 							stats:{sante:[33,37.2], defense:[3.8,4.2]}, classes:['assassin'] },
  {
		id:'bottes_necro_assa',     		name:"Bottes du Nécromancien",          set:'necro_assa', 	rarity:'epique',    cat:'bottes',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/boots_necromancien.png", 								stats:{sante:[30,35.42], defense:3.5}, classes:['assassin'] },
  {
		id:'casque_chasseuse',     			name:"Casque de la chasseuse",         	set:'abeille_arch', rarity:'rare',    	cat:'casque',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/helmet_abeille.png", 							stats:{sante:[26,31], defense:[3.2,3.5]}, classes:['archer'] },
  {
		id:'plastron_chasseuse',   			name:"Plastron de la chasseuse",       	set:'abeille_arch', rarity:'rare',    	cat:'plastron',  	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/chestplate_abeille.png", 						stats:{sante:[35,40], defense:[4.1,4.5], 'Emplacement de Runes':1}, classes:['archer'] },
  {
		id:'jambieres_chasseuse',   		name:"Jambières de la chasseuse",      	set:'abeille_arch', rarity:'rare',    	cat:'jambières', 	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/leggings_abeille.png", 							stats:{sante:[26.01,29.99], defense:[3.2,3.5]}, classes:['archer'] },
  {
		id:'bottes_chasseuse',     			name:"Bottes de la chasseuse",          set:'abeille_arch', rarity:'rare',    	cat:'bottes',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/boots_abeille.png", 								stats:{sante:[21,27], defense:[2.8,3.2]}, classes:['archer'] },
  {
		id:'casque_necro_arch',     		name:"Casque du Nécromancien",         	set:'necro_arch', 	rarity:'epique',    cat:'casque',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/helmet_necromancien.png", 							stats:{sante:[29,32], defense:[3.13,3.37]}, classes:['archer'] },
  {
		id:'plastron_necro_arch',   		name:"Plastron du Nécromancien",       	set:'necro_arch', 	rarity:'epique',    cat:'plastron',  	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/chestplate_necromancien.png", 						stats:{sante:[41,44], defense:[4.6,5.06], 'Emplacement de Runes':2}, classes:['archer'] },
  {
		id:'jambieres_necro_arch',   		name:"Jambières du Nécromancien",      	set:'necro_arch', 	rarity:'epique',    cat:'jambières', 	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/leggings_necromancien.png", 							stats:{sante:[31,34], defense:[3.6,3.9]}, classes:['archer'] },
  {
		id:'bottes_necro_arch',     		name:"Bottes du Nécromancien",          set:'necro_arch', 	rarity:'epique',    cat:'bottes',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/boots_necromancien.png", 								stats:{sante:[28,31], defense:[3.3,3.6]}, classes:['archer'] },
  /* ══ Mage - Shaman ══ */
  /* ══ Palier 1 ══ */
  {
		id:'tunique_spectral',   			name:"Tunique Spectral",               	set:'spectral',     rarity:'commun',    cat:'plastron',  	palier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_spectral.png", 						stats:{sante:[15,19], defense:0.4}, classes:['mage','shaman'] },
  {
		id:'jambieres_spectral', 			name:"Jambières Spectral",             	set:'spectral',     rarity:'commun',    cat:'jambières', 	palier:1, lvl:3, 	img:"../img/compendium/textures/armors/leggings_spectral.png", 							stats:{sante:[13,17], defense:0.4}, classes:['mage','shaman'] },
  {
		id:'bottes_spectral',    			name:"Bottes Spectral",                 set:'spectral',     rarity:'commun',    cat:'bottes',    	palier:1, lvl:3, 	img:"../img/compendium/textures/armors/boots_spectral.png", 							stats:{sante:[10,13], defense:0.3}, classes:['mage','shaman'] },
  {
		id:'robe_sorcier',       			name:"Robe du Sorcier",                 set:'sorcier',      rarity:'rare',      cat:'plastron',  	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_sorcier.png", 						stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['mage'] },
  {
		id:'pantalon_sorcier',   			name:"Pantalon du Sorcier",             set:'sorcier',      rarity:'rare',      cat:'jambières', 	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_sorcier.png", 							stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['mage'] },
  {
		id:'sandales_sorcier',   			name:"Sandales du Sorcier",             set:'sorcier',      rarity:'rare',      cat:'bottes',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_sorcier.png", 								stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['mage'] },
  {
		id:'robe_magicien',      			name:"Robe du Magicien",                set:'magicien',     rarity:'rare',      cat:'plastron',  	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_magicien.png", 						stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['shaman'] },
  {
		id:'pantalon_magicien',  			name:"Pantalon du Magicien",            set:'magicien',     rarity:'rare',      cat:'jambières', 	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_magicien.png",   						stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['shaman'] },
  {
		id:'sandales_magicien',  			name:"Sandales du Magicien",            set:'magicien',     rarity:'rare',      cat:'bottes',    	palier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_magicien.png",       						stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['shaman'] },
  {
		id:'casque_faucheuse',      		name:"Casque de la Faucheuse",          set:'faucheuse',    rarity:'epique',    cat:'casque',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_faucheuse.png", 							stats:{sante:[16,20], defense:[2.8,3.4]}, classes:['mage','shaman'] },
  {
		id:'plastron_faucheuse',    		name:"Plastron de la Faucheuse",        set:'faucheuse',    rarity:'epique',    cat:'plastron',  	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_faucheuse.png", 						stats:{sante:[27,32], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['mage','shaman'] },
  {
		id:'jambieres_faucheuse',   		name:"Jambières de la Faucheuse",       set:'faucheuse',    rarity:'epique',    cat:'jambières', 	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_faucheuse.png", 						stats:{sante:[20,24], defense:[2.9,3.4]}, classes:['mage','shaman'] },
  {
		id:'bottes_faucheuse',      		name:"Bottes de la Faucheuse",          set:'faucheuse',    rarity:'epique',    cat:'bottes',    	palier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_faucheuse.png", 							stats:{sante:[10.2,13.8], defense:[2.7,2.9]}, classes:['mage','shaman'] },
  /* ══ Palier 2 ══ */
  {
		id:'casque_miel_cr',     			name:"Casque en Miel Cristallisé",      set:'abeille_mage', rarity:'rare',    	cat:'casque',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/helmet_abeille.png", 							stats:{sante:[26,31], defense:[3.2,3.5]}, classes:['mage'] },
  {
		id:'plastron_miel_cr',   			name:"Plastron en Miel Cristallisé",    set:'abeille_mage', rarity:'rare',    	cat:'plastron',  	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/chestplate_abeille.png", 						stats:{sante:[35,40], defense:[4.1,4.5], 'Emplacement de Runes':1}, classes:['mage'] },
  {
		id:'jambieres_miel_cr',   			name:"Jambières en Miel Cristallisé",   set:'abeille_mage', rarity:'rare',    	cat:'jambières', 	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/leggings_abeille.png", 							stats:{sante:[26.01,29.99], defense:[3.2,3.5]}, classes:['mage'] },
  {
		id:'bottes_miel_cr',     			name:"Bottes en Miel Cristallisé",      set:'abeille_mage', rarity:'rare',    	cat:'bottes',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/boots_abeille.png", 								stats:{sante:[21,27], defense:[2.8,3.2]}, classes:['mage'] },
  {
		id:'casque_necro_mage',     		name:"Casque du Nécromancien",         	set:'necro_mage', 	rarity:'epique',    cat:'casque',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/helmet_necromancien.png", 							stats:{sante:[29,32], defense:[3.13,3.37]}, classes:['mage'] },
  {
		id:'plastron_necro_mage',   		name:"Plastron du Nécromancien",       	set:'necro_mage', 	rarity:'epique',    cat:'plastron',  	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/chestplate_necromancien.png", 						stats:{sante:[41,44], defense:[4.6,5.06], 'Emplacement de Runes':2}, classes:['mage'] },
  {
		id:'jambieres_necro_mage',   		name:"Jambières du Nécromancien",      	set:'necro_mage', 	rarity:'epique',    cat:'jambières', 	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/leggings_necromancien.png", 							stats:{sante:[31,34], defense:[3.6,3.9]}, classes:['mage'] },
  {
		id:'bottes_necro_mage',     		name:"Bottes du Nécromancien",          set:'necro_mage', 	rarity:'epique',    cat:'bottes',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/boots_necromancien.png", 								stats:{sante:[28,31], defense:[3.3,3.6]}, classes:['mage'] },
  {
		id:'casque_miel_my',     			name:"Casque de la Miel Mysticisé",     set:'abeille_sham', rarity:'rare',    	cat:'casque',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/helmet_abeille.png", 							stats:{sante:[26,31], defense:[3.2,3.5]}, classes:['shaman'] },
  {
		id:'plastron_miel_my',   			name:"Plastron de la Miel Mysticisé",   set:'abeille_sham', rarity:'rare',    	cat:'plastron',  	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/chestplate_abeille.png", 						stats:{sante:[35,40], defense:[4.1,4.5], 'Emplacement de Runes':1}, classes:['shaman'] },
  {
		id:'jambieres_miel_my',   			name:"Jambières de la Miel Mysticisé",  set:'abeille_sham', rarity:'rare',    	cat:'jambières', 	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/leggings_abeille.png", 							stats:{sante:[26.01,29.99], defense:[3.2,3.5]}, classes:['shaman'] },
  {
		id:'bottes_miel_my',     			name:"Bottes de la Miel Mysticisé",     set:'abeille_sham', rarity:'rare',    	cat:'bottes',    	palier:2, lvl:11, 	img:"../img/compendium/textures/armors/boots_abeille.png", 								stats:{sante:[21,27], defense:[2.8,3.2]}, classes:['shaman'] },
  {
		id:'casque_necro_sham',     		name:"Casque du Nécromancien",         	set:'necro_sham', 	rarity:'epique',    cat:'casque',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/helmet_necromancien.png", 							stats:{sante:[29,32], defense:[3.13,3.37]}, classes:['shaman'] },
  {
		id:'plastron_necro_sham',   		name:"Plastron du Nécromancien",       	set:'necro_sham', 	rarity:'epique',    cat:'plastron',  	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/chestplate_necromancien.png", 						stats:{sante:[41,44], defense:[4.6,5.06], 'Emplacement de Runes':2}, classes:['shaman'] },
  {
		id:'jambieres_necro_sham',   		name:"Jambières du Nécromancien",      	set:'necro_sham', 	rarity:'epique',    cat:'jambières', 	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/leggings_necromancien.png", 							stats:{sante:[31,34], defense:[3.6,3.9]}, classes:['shaman'] },
  {
		id:'bottes_necro_sham',     		name:"Bottes du Nécromancien",          set:'necro_sham', 	rarity:'epique',    cat:'bottes',    	palier:2, lvl:13, 	img:"../img/compendium/textures/armors/boots_necromancien.png", 								stats:{sante:[28,31], defense:[3.3,3.6]}, classes:['shaman'] },
  /* ══ Other ══ */
  {
		id:'bottes_revenant',      			name:"Bottes du Revenant",                                  rarity:'legendaire',cat:'bottes',    	palier:1, lvl:5, 	img:"../img/compendium/textures/armors/bottes_du_revenant.png",   						stats:{vitesse_deplacement:5} },
  {
		id:'bottes_ecume',      			name:"Bottes de l'Écume",                                   rarity:'legendaire',cat:'bottes',    	palier:1, lvl:5, 	img:"../img/compendium/textures/armors/bottes_decume.png",         						stats:{'Agilité Aquatique':10} },

  {
    id:       'viande_de_sanglier',
    name:     "Viande de Sanglier",
    rarity:   'commun',
    category: 'nourriture',
    palier:   1,
    image:    "../img/compendium/textures/items/viande_de_sanglier.png",
    lore:     "Cette belle viande de sanglier, bien juteuse, peut vous donner encore plus envie de manger !",
    tags:     ['Nourriture', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Sangliers Corrompus\n- Pumba"
  },
  {
    id:       'peau_de_sanglier',
    name:     "Peau de Sanglier",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/peau_de_sanglier.png",
    lore:     "Utilisable pour de la tannerie basique.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Sangliers Corrompus\n- Pumba"
  },
  {
    id:       'cristal_corrompu',
    name:     "Cristal Corrompu",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    "../img/compendium/textures/items/cristal_corrompu.png",
    lore:     "Des traces de corruptions émanent de cet objet.",
    tags:     ['Quête', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Sangliers Corrompus\n- Pumba"
  },
  {
    id:       'fourrure_de_loup',
    name:     "Fourrure de Loup",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/fourrure_de_loup.png",
    lore:     "Une fourrure souple et légère, utilisée pour fabriquer des armures.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Loups Sinistre (Blancs & Noirs)\n- Albal"
  },
  {
    id:       'crocs_de_loup',
    name:     "Crocs de Loup",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/crocs_de_loup.png",
    lore:     "Une dent longue et acérée, prisée de certains artisans.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Loups Sinistre (Blancs & Noirs)\n- Albal"
  },
  {
    id:       'crocs_de_albal',
    name:     "Crocs de Albal",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/crocs_de_albal.gif",
    lore:     "Un croc massif imprégné de sa rage sauvage. Son essence est utilisée pour concoter des potions de force redoutable.",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Albal"
  },
  {
    id:       'spore_corrompu',
    name:     "Spore Corrompu",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    "../img/compendium/textures/items/spore_corrompu.png",
    lore:     "Un spore étrange imprégné de corruption...",
    tags:     ['Quête', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Nephentes"
  },
  {
    id:       'fragment_de_feuille',
    name:     "Fragment de Feuille",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/fragment_de_feuille.png",
    lore:     "Des restes végétaux porteurs d'une étrange énergie naturelle.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Nephentes"
  },
  {
    id:       'pousse_de_sylve',
    name:     "Pousse de Sylve",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/pousse_de_sylve.png",
    lore:     "Petite pousse dans un bol très utile dans la confection de potion de vie.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Minis Tréants"
  },
  {
    id:       'éclat_de_bois_magique',
    name:     "Éclat de Bois Magique",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/eclat_de_bois_magique.png",
    lore:     "Fragment d'un ancien Tréant. Même détaché de celui-ci il conserve encore de la magie à l'intérieur.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Minis Tréants"
  },
  {
    id:       'écorce_de_titan',
    name:     "Écorce de Titan",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/ecorce_de_titan.png",
    lore:     "Ressource très dure presque incassable, les Guerriers pourront se protéger avec.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Guerriers Tréants"
  },
  {
    id:       'racine_ancestrale',
    name:     "Racine Ancestrale",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un loot assez rare du Guerrier Tréant. Utile si vous avez besoin de fabriquer des potions.",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Guerriers Tréants"
  },
  {
    id:       'écorce_sylvestre',
    name:     "Écorce Sylvestre",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Matériau de la nature, utilisé principalement pour des armures légères et rapides.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Tréants d'Élites"
  },
  {
    id:       'corde_darc_sylvestre',
    name:     "Corde d'Arc Sylvestre",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/corde_darc_sylvestre.png",
    lore:     "Longue et tendue, cette corde robuste est idéale pour confectionner un nouvel arc.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Tréants d'Élites"
  },
  {
    id:       'brindille_enchantée',
    name:     "Brindille Enchantée",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/brindille_enchantee.png",
    lore:     "Brindille du Mage Sylvestre, ce bâton peutêtre utilisé comme basepour une arme magique.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres"
  },
  {
    id:       'coeur_de_bois',
    name:     "Cœur de Bois",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/coeur_de_bois.png",
    lore:     "Cœur imprégné de magie, si vous l'utilisez avec précaution une arme très redoutable peut être créée.",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres"
  },
  {
    id:       'tissu_spectral',
    name:     "Tissu Spectral",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/tissu_spectral.png",
    lore:     "Un tissu imprégné de magie noire et de malédictions.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres"
  },
  {
    id:       'mycelium_magique',
    name:     "Mycélium Magique",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/mycelium_magique.png",
    lore:     "Ingrédient assez rare pour de la haute alchimie ou pour autre chose ?",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Gardiens Colossaux"
  },
  {
    id:       'gelée_de_slime',
    name:     "Gelée de Slime",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une petite et belle gelée gluante qui colle à vos mains pendant longtemps.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Petits Slimes\n- Guerriers Slimes\n- Slimes Soigneurs\n- Slimes Magiciens\n- Gorbel"
  },
  {
    id:       'noyau_de_slime',
    name:     "Noyau de Slime",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/noyau_de_slime.png",
    lore:     "Noyau imprégné de la magie des slimes. Utilisé dasn la confection d'accessoires magiques.",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Slimes Soigneurs\n- Slimes Magiciens\n- Gorbel"
  },
  {
    id:       'essence_de_gorbel',
    name:     "Essence de Gorbel",
    rarity:   'epique',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/essence_de_gorbel.png",
    lore:     "Essence d'un slime qui a atteint son plus haut potentiel.",
    tags:     ['Matériaux', 'Palier 1', 'Épique'],
    obtain:   "Obtenable en tuant:\n- Gorbel"
  },
  {
    id:       'os_de_squelette',
    name:     "Os de Squelette",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/os_de_squelette.png",
    lore:     "Petit os que l'on trouve sur des squelettes de bas rang. Sûrement utile pour certaines confections.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes\n- Squelettes Hallebardiers\n- Squelettes Mages"
  },
  {
    id:       'poussière_dos',
    name:     "Poussière d'Os",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Résidu d'os réduit en poudre. Sert de catalyseur pour des potions de vie.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes\n- Squelettes Hallebardiers\n- Archers Squelettes\n- Tanks Squelettes\n- Squelettes Mages"
  },
  {
    id:       'os_de_squelette_renforcé',
    name:     "Os de Squelette Renforcé",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Contrairement au petit os, ces os sont plus résistants et sûrement utiles aussi dans certaines confections.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Hallebardiers\n- Archers Squelettes\n- Tanks Squelettes"
  },
  {
    id:       'ames_des_ruines',
    name:     "Âmes des Ruines",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/ames_des_ruines.png",
    lore:     "Âme de squelette abreuvé de corruption.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes\n- Squelettes Hallebardiers\n- Archers Squelettes"
  },
  {
    id:       'tissu_maudit',
    name:     "Tissu Maudit",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    "../img/compendium/textures/items/tissu_maudit.png",
    lore:     "Les forces obscures devorent ce tissu.",
    tags:     ['Quête', 'Palier 1', 'commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes"
  },
  {
    id:       'coeur_putréfié',
    name:     "Cœur Putréfié",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    "../img/compendium/textures/items/coeur_putrefie.png",
    lore:     "La putréfaction ronge peu à peu ce cœur.",
    tags:     ['Quête', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Narax Squelette Maudit"
  },
  {
    id:       'morceau_de_crinière_spectrale',
    name:     "Morceau de Crinière Spectrale",
    rarity:   'legendaire',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/morceau_de_criniere_spectrale.png",
    lore:     "Une mèche de crinière éthérée, arrachée a une monture spectrale. Elle palpite encore d'une énergie rapide.",
    tags:     ['Matériaux', 'Palier 1', 'Legendaire'],
    obtain:   "Obtenable en tuant:\n- Nasgul"
  },
  {
    id:       'éclat_du_sabot_maudit',
    name:     "Éclat du Sabot Maudit",
    rarity:   'legendaire',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/eclat_du_sabot_maudit.png",
    lore:     "Fragment arraché au sabot d'une créature maudite. Il renferme une énergie sombre qui confère à son porteur une vitesse surnaturelle.",
    tags:     ['Matériaux', 'Palier 1', 'Legendaire'],
    obtain:   "Obtenable en tuant:\n- Nasgul"
  },
  {
    id:       'cuir_usé',
    name:     "Cuir Usé",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    "../img/compendium/textures/items/cuir_use.png",
    lore:     "Un morceau de cuir abîmé autrefois portépar des Bandits. Il reste utilisable.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Bandits Archer\n- Bandits Assassins\n- Bandits Robustes"
  },
  {
    id:       'petite_bourse',
    name:     "Petite Bourse",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un petit sac en tissu, parfait pour y glisser des pièces.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Bandits Archer\n- Bandits Assassins\n- Bandits Robustes"
  },
  {
    id:       'carapace_dika',
    name:     "Carapace de d'Ika",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un morceau épais de carapace issu d'une tortue d'Ika abattue.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Ika"
  },
  {
    id:       'pièce_métal_enchanté',
    name:     "Pièce de Métal Enchanté",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Petite ferraille de métal, avec d'autres ingrédients il est possible d'en faire des Lingôts de Métal Enchanté.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Soldat Déchu\n- Guerrier Déchu"
  },
  {
    id:       'pièce_âme_métal',
    name:     "Pièce d'Âme de Métal",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Petite ferraille de métal, avec d'autres ingrédients il est possible d'en faire des Lingôts d'Âme de Métal.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant: Guerrier Déchu"
  },
  {
    id:       'artefact_fallen',
    name:     "Artéfact des Fallen",
    rarity:   null,
    category: 'quete',
    palier:   1,
    image:    null,
    lore:     null,
    tags:     ['Objets de Quête', 'Palier 1', null],
    obtain:   "Obtenable en tuant:\n- Gardien Déchu\n- Héraut Déchu\n- Faucheuse Déchu"
  },
  {
    id:       'âme_warden',
    name:     "Âme du Warden",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une âme est contenue dans cet objet. Il peut être obtenu en tuant son possesseur ou en le fabriquant au forgeron.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant: Gardien Déchu"
  },
  {
    id:       'âme_herald',
    name:     "Âme de l'Herald",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une âme est contenue dans cet objet. Il peut être obtenu en tuant son possesseur ou en le fabriquant au forgeron.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant: Héraut Déchu"
  },
  {
    id:       'âme_reaper',
    name:     "Âme du Reaper",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une âme est contenue dans cet objet. Il peut être obtenu en tuant son possesseur ou en le fabriquant au forgeron.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant: Faucheuse Déchue"
  },
  {
    id:       'tissu_araignée',
    name:     "Tissu d'Araignée",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un tissu fin, mais incroyablement résistant. Idéal pour des équipements légers ou enchantés.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant : Araignée des Forêts"
  },
  {
    id:       'fil_araignée',
    name:     "Fil d'Araignée",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Petit fil très fragile il peut se casser à tout moment.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant : Araignée des Forêts"
  },
  {
    id:       'peau_cerf_montagnes',
    name:     "Peau de Cerf des Montagnes",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un morceau de peau épaisse, rigide, utile pour des armures robustes.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant : Cerf des Montagnes"
  },
  {
    id:       'peau_dur_glacial',
    name:     "Peau Dur Glacial",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une plaque de givre solidifiée, aussi dur que de la pierre.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant : Golem de Glace"
  },
  {
    id:       'poussière_givre',
    name:     "Poussière de Givre",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une fine poudre glaciale récoltée sur des créatures de glace.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Golem de Glace\n- Spirite de Glace\n- Ours de Glace"
  },
  {
    id:       'éclat_magique_glacial',
    name:     "Éclat Magique Glacial",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Un fragment cristallin baigné de magie ancienne. Il est prisé pour forger des armures mystiques.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant : Spirite de Glace"
  },
  {
    id:       'fragment_âme_ours',
    name:     "Fragment de l'Âme de l'Ours",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "L'âme de l'Ours repose dans ce fragment. Utilisez-le avec sagesse, car son pouvoir est colossal.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant : Ours de Glace"
  },
  {
    id:       'carapace_requin',
    name:     "Carapace de Requin",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Une plaque de carapace très dure, arrachée à un poisson-requin. Solide et résistante parfaite pour une certaine armure lourdre.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant : Poisson Requin"
  },
  {
    id:       'cœur_nymbréa',
    name:     "Cœur de Nymbréa",
    rarity:   'rare',
    category: 'quete',
    palier:   1,
    image:    null,
    lore:     "Encore brûlant et chargé de magie aquatique, ce cœur scintille d'une énergie ancienne.",
    tags:     ['Matériaux', 'Palier 1', 'rare'],
    obtain:   "Obtenable en tuant : Nymbréa"
  },
  {
    id:       'peau_épaisse',
    name:     "Peau Épaisse",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une peau robuste et résistante, capable d'absorber de lourds impacts.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Taureau Monstrueux"
  },
  {
    id:       'corne_taureau',
    name:     "Corne de Taureau",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Solide et acérée, cette corne témoigne de la force brutale de l'animal.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Taureau"
  },
  {
    id:       'peau_ours',
    name:     "Peau d'Ours",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une épaisse fourrure tannée, capable de résister aux assauts et d'offrir une chaleur inégalée.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Ours de la Forêt"
  },
  {
    id:       'griffe_ours',
    name:     "Griffe d'Ours",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Tranchante et recourbée, elle témoigne de la férocité et de la force d'un prédateur redoutable.",
    tags:     ['Matériaux', 'Palier 2','commun'],
    obtain:   "Obtenable en tuant : Ours de la Forêt"
  },
  {
    id:       'graisse_ours',
    name:     "Graisse d'Ours",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Utilisée pour l'entretien du cuir ou comme combustible, cette graisse dégage une forte odeur sauvage.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Ours de la Forêt"
  },
  {
    id:       'résidu_miel',
    name:     "Résidu de Miel",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Restes collants et sucrés, souvent imprégnés de pollen et de senteurs florales.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Ours de la Forêt"
  },
  {
    id:       'fourrure_loup',
    name:     "Fourrure de Loup",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Chaud et souple, ce pelage protège efficacement du froid. Parfait pour créer des armures légères.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant:\n- Loups des Montagnes\n- Loups des Savanes"
  },
  {
    id:       'dard',
    name:     "Dard",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Pointu et redoutable, ce dard d'abeille géante est un matériau de choix pour fabriquer des équipements perforants.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant:\n- Ouvrière\n- Dardroyal\n- Melisara, Souveraine de la Ruche"
  },
  {
    id:       'miel',
    name:     "Miel",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Doux mais étonnement visqueux, ce miel concentré est utilisé pour enduire certaines armures.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant:\n- Ouvrière\n- Melisara, Souveraine de la Ruche"
  },
  {
    id:       'carapace_abeille',
    name:     "Carapace d'Abeille",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Épaisse et segmentée, cette carapace protège efficacement contre les assauts. Parfaite pour façonner des équipements.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant:\n- Dardroyal\n- Melisara, Souveraine de la Ruche"
  },
  {
    id:       'plume_enflammée',
    name:     "Plume Enflammée",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une plume incandescente, vibrant d'énergie magique. Utilisée par les artisans.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Harpie de Feu"
  },
  {
    id:       'plume_terreuse',
    name:     "Plume Terreuse",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une plume dense et résistante, imprégnée de force tellurique parfaite.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Harpie de Terre"
  },
  {
    id:       'plume_ondoyante',
    name:     "Plume Ondoyante",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une plume souple et scintillante, gorgée d'essence aquatique.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Harpie de Foudre"
  },
  {
    id:       'œuf_harpie_eau',
    name:     "Œuf de Harpie d'Eau",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Un œuf provenant d'une harpie... Cache-t-il peut-être un nouveau-né ?",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant : Harpie de Foudre"
  },
  {
    id:       'écaille_fulgurante',
    name:     "Écaille Fulgurante",
    rarity:   'rare',
    category: 'quete',
    palier:   2,
    image:    null,
    lore:     "Une des trois écorces utilisées comme offrande à l'un des dieux présents au Palier 2 !",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Poisson Fulgurant"
  },
  {
    id:       'pierre_runique',
    name:     "Pierre Runique",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Gravée d'inscriptions anciennes, elle ne s'active qu'en présence d'un second composant.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant:\n- Squelette du Sanctuaire - Archer\n- Squelette du Sanctuaire - Shaman\n- Squelette du Sanctuaire - Guerrier\n- Gardien du Sanctuaire"
  },
  {
    id:       'chaîne_spectrale',
    name:     "Chaîne Spectrale",
    rarity:   'commun',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Gravée d'inscriptions anciennes, elle ne s'active qu'en présence d'un second composant.",
    tags:     ['Matériaux', 'Palier 2', 'commun'],
    obtain:   "Obtenable en tuant:\n- Squelette du Sanctuaire - Archer\n- Squelette du Sanctuaire - Shaman\n- Squelette du Sanctuaire - Guerrier"
  },
  {
    id:       'vêtement_déchiré',
    name:     "Vêtement Déchiré",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Un vêtement déchiré appartenant à un ancien humain, devenu squelette protégeant son domaine.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant:\n- Squelette du Sanctuaire - Archer\n- Squelette du Sanctuaire - Guerrier"
  },
  {
    id:       'poudre_moelle',
    name:     "Poudre de Moelle",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Une belle poudre blanchâtre à l'odeur minérale, possiblement utilisé dans certains rituels.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Squelette du Sanctuaire - Shaman"
  },
  {
    id:       'morceau_ferraille',
    name:     "Morceau de Ferraille",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Morceau de feraille, solide malgré son état. Idéal pour expérimenter la forge ou tester des recettes alchimiques.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant : Golem de Pierre"
  },
  {
    id:       'pierre_osseuse_noire',
    name:     "Pierre Osseuse Noire",
    rarity:   'rare',
    category: 'materiaux',
    palier:   2,
    image:    null,
    lore:     "Un fragment d'os dur et sombre, marqué par le temps et par la mort.",
    tags:     ['Matériaux', 'Palier 2', 'rare'],
    obtain:   "Obtenable en tuant:\n- ??\n- Morveth l'Écorcheur d'Âmes"
  },

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
