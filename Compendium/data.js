//#region CONSTANTES
//#region RARITIES
const RARITIES = {
  'commun':     { label: 'Commun',      color: '#59d059' },
  'rare':       { label: 'Rare',        color: '#2a5fa8' },
  'epique':     { label: 'Épique',      color: '#6a3daa' },
  'legendaire': { label: 'Légendaire',  color: '#d7af5f' },
  'mythique':   { label: 'Mythique',    color: '#f5b5e4' },
  'godlike':    { label: 'Godlike',     color: '#a83020' },
	'event':    	{ label: 'Event',     	color: '#ebebeb' },
};

//#endregion RARITIES
//#region CLASSES
const CLASSES = [
  { id:'guerrier', label:'Guerrier', ico:'⚔️'  },
  { id:'assassin', label:'Assassin', ico:'🗡️'  },
  { id:'archer',   label:'Archer',   ico:'🏹'  },
  { id:'mage',     label:'Mage',     ico:'📖'  },
  { id:'shaman',   label:'Shaman',   ico:'🌿'  },
];

//#endregion CLASSES
//#region SETS — Panoplies
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
  faible_corruption: {
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


//#endregion SETS — Panoplies
//#region STAT_GROUPS
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

const TWO_HANDED_PAIRS = {
  'arme_p': 'arme_s'
};

//#endregion STAT_GROUPS
//#region TWO_HANDED_PAIRS
const ALL_STATS = STAT_GROUPS.flatMap(g => g.stats);

//#endregion TWO_HANDED_PAIRS
//#region RUNES
const RUNES = [
	{
		id:			'vitalite_1',
		name:		'Rune de Vitalité I',
		color:	'#e03a3a',
		stats:	{sante:5},
	},
	{
		id:			'precision_1',
		name:		'Rune de Précision I',
		color:	'#62f2f4',
		stats:	{crit_chance:2.5},
	},
	{
		id:			'sorcellerie_1',
		name:		'Rune de Sorcellerie I',
		color:	'#b856c5',
		stats:	{degats_competence:5}
	},
	{
		id:			'agilite_1',
		name:		'Rune d\'Agilité I',
		color:	'#3fa147',
		stats:	{vitesse_deplacement:1}
	},
	{
		id:			'temporelle_1',
		name:		'Rune Temporelle I',
		color:	'#33b380',
		stats:	{hate:2.5}
	},
  {
		id:			'noel',
		name:		'Rune de Noël',
		color:	'#7fe0dc',
		stats:	{vol_vie:2, omnivamp:2.5, sante:5, mana:5, stamina:2.5}
	},
  {
		id:			'st_val',
		name:		'Rune de Teddy Bear',
		color:	'#f4acbc',
		stats:	{vitesse_attaque:0.2, crit_comp_chance:20, crit_comp_degats:10, defense:2, sante:20}
	},
  {
		id:			'lunaire',
		name:		'Rune Lunaire',
		color:	'#ecd783',
		stats:	{crit_chance:7, crit_degats:12, crit_comp_chance:7, crit_comp_degats:12, sante:5}
	},
  {
		id:			'dragon',
		name:		'Rune du Dragon',
		color:	'#e35f48',
		stats:	{crit_chance:8, crit_degats:13, crit_comp_chance:8, crit_comp_degats:13, sante:10, vitesse_deplacement:0.15}
	},
	{
		id:			'kazor',
		name:		'Rune de Kazor',
		color:	'#45a076',
		stats:	{maitrise_bloc:5, puissance_bloc:2.5, soin_bonus:2, sante:10},
		buff:		{esprit:1},
	},
];

//#endregion RUNES
//#region CURRENCIES
const CURRENCIES = {
  cols: { label: 'Cols', emoji: '🪙', color: '#c9a84c' },
};

//#endregion CURRENCIES
//#region MAX_LEVEL
const MAX_LEVEL = 14;

//#endregion MAX_LEVEL
//#region CARACTERISTIQUES
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
			id:'dexterite',
			label:'Dextérité',
			icon:'🏹',
			color:'#e0c840',
			desc:'Améliore l\'Agilité et les chances de coups critique',
			stats:{ crit_chance: 0.75, esquive: 0.3 }
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
			id:'esprit',
			label:'Esprit',
			icon:'🌿',
			color:'#59d059',
			desc:'Augmente la Régénération de Santé et d\'Énergie',
			stats:{ regen_sante: 0.15, regen_mana: 0.1, regen_stamina: 0.05 }
		},
		{
			id:'defense_car',
		  label:'Défense',
		  icon:'🛡️',
		  color:'#5588e0',
		  desc:'Réduit les dégâts subis en augmentant la Défense',
		  stats:{ defense: 0.4 }
		},
		{
			id:'vitalite',
			label:'Vitalité',
			icon:'❤️',
			color:'#e05555',
			desc:'Augmente la Santé maximale',
			stats:{ sante: 3 }
		},
	];
	
/* Niveau actuel et points alloués */
let buildLevel = 1;
let caracterPoints = { vitalite: 0, defense_car: 0, intelligence: 0, force: 0, esprit: 0, dexterite: 0 };

function getAvailablePoints() {
	const spent = Object.values(caracterPoints).reduce((a, b) => a + b, 0);
	return buildLevel - spent;
}

function getMin(val) { return Array.isArray(val) ? val[0] : val; }
function getMax(val) { return Array.isArray(val) ? val[1] : val; }

//#endregion CARACTERISTIQUES
//#region CATEGORIES
const CATEGORIES = {
  materiaux:       { label: 'Matériaux',          emoji: '🧱' },
  quete:           { label: 'Objets de Quête',    emoji: '📜' },
  ressources:      { label: 'Ressources',         emoji: '⛏️' },
  nourriture:      { label: 'Nourriture',         emoji: '🍖' },
  consommable:     { label: 'Consommables',       emoji: '🧪' },
  arme:            { label: 'Armes',              emoji: '⚔️' },
  armure:          { label: 'Armures',            emoji: '🛡️' },
  accessoire:      { label: 'Accessoires',        emoji: '💍' },
  outils:          { label: 'Outils',             emoji: '🛠️' },
  rune:            { label: 'Runes',              emoji: '🔮' },
	donjon:          { label: 'Donjon',             emoji: '🏰' },
	monnaie:         { label: 'Monnaie',            emoji: '🪙' },
};

//#endregion CATEGORIES
//#region EFFECT_META
const EFFECT_META = {
  heal:     { icon: '❤️',  	color: '#e05252', label: 'Points de vie',    prefix: '+' },
	regen:     { icon: '💓',  	color: '#ce7b7b', label: 'Régénération',    prefix: 'Régénération ' },
  mana:     { icon: '💧', 	 color: '#5b8dee', label: 'Mana',             prefix: '+' },
  stamina:  { icon: '👟', 	color: '#f4d745', label: 'Stamina',          prefix: '+' },
  buff:     { icon: '💪',  	color: '#d4a017', label: 'Bonus',            prefix: '+' },
	feed:     { icon: '🍖',  	color: '#8d520b', label: 'Nourriture',       prefix: 'Restaure ' },
  debuff:   { icon: '☠️',  	color: '#9b59b6', label: 'Malus',            prefix: ''  }, 
  cooldown: { icon: '⏱️',  	color: '#888888', label: 'Cooldown',         prefix: ''  },
	use: 			{ icon: '🧪',  	color: '#7db0ca', label: 'Utilisations',     prefix: ''  },
	level: 		{ icon: '❓',  	color: '#c43c28', label: 'Niveau Requis',     prefix: 'Niveau '  }
};

//#endregion EFFECT_META
//#region SLOTS
const SLOTS_LEFT = [
  { id:'amulette',  label:'Amulette',        	ico:'📿', cats:['amulette'] },
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
//#endregion SLOTS
//#endregion CONSTANTES

var ITEMS = [];

