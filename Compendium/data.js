//#region CONSTANTES
// RARITIES → défini dans /utils.js (source unique)
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
// Les panoplies sont désormais stockées dans Firestore (collection `panoplies`).
// Ce bloc ne sert plus que de container vide : les pages qui ont besoin des sets
// attendent la fusion par db-loader.js (Compendium/Atelier) ou le module creator.
let SETS = {};
if (typeof window !== 'undefined') window.SETS = SETS;

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
  armure:          { label: 'Armures',         emoji: '🛡️',  ordre: 1 },
  arme:            { label: 'Armes',           emoji: '⚔️',  ordre: 2 },
  accessoire:      { label: 'Accessoires',     emoji: '💍',  ordre: 3 },
  rune:            { label: 'Runes',           emoji: '🔮',  ordre: 4 },
  outils:           { label: 'Outils',          emoji: '🛠️',  ordre: 5 },
  nourriture:       { label: 'Nourriture',      emoji: '🍖',  ordre: 6 },
  consommable:     { label: 'Consommables',    emoji: '🧪',  ordre: 7 },
  materiaux:        { label: 'Matériaux',       emoji: '🧱',  ordre: 8 },
  quete:  { label: 'Objets de Quête', emoji: '📜',  ordre: 9 },
  ressources:       { label: 'Ressources',      emoji: '⛏️',  ordre: 10 },
  donjon:           { label: 'Donjon',          emoji: '🏰',  ordre: 11 },
  monnaie:          { label: 'Monnaie',         emoji: '🪙',  ordre: 12 },
};

//#endregion CATEGORIES
//#region EFFECT_META
const EFFECT_META = {
  heal:     { icon: '❤️',  	color: '#e05252', label: 'Points de vie',    		prefix: '+' },
	regen:    { icon: '💓',  	color: '#ce7b7b', label: 'Régénération',     		prefix: 'Régénération ' },
  mana:     { icon: '💧', 	 color: '#5b8dee', label: 'Mana',            		prefix: '+' },
  stamina:  { icon: '👟', 	color: '#f4d745', label: 'Stamina',          		prefix: '+' },
  buff:     { icon: '💪',  	color: '#d4a017', label: 'Bonus',           		 	prefix: '+' },
	force:    { icon: '💪',  	color: '#f36d14', label: 'Force Accrue',     		prefix: 'Boost les Dégâts d\'Armes de ' },
	arcane:   { icon: '🔮',  	color: '#c24cda', label: 'Puissance Arcanique',  prefix: 'Boost les Dégâts Magique de ' },
	healing:  { icon: '💓',  	color: '#a01212', label: 'Healing',  						prefix: 'Vous rends ' },
	mana_heal:{ icon: '💦',  	color: '#247ca5', label: 'Mana',  								prefix: 'Vous rends ' },
	stam_heal:{ icon: '💨',  	color: '#e4c84b', label: 'Stamina',  						prefix: 'Vous rends ' },
	crit_c:		{ icon: '🎯',  	color: '#d3b327', label: 'Coûp Critique',  			prefix: 'Boost les Chances Crtique de ' },
	crit_d:		{ icon: '💢',  	color: '#e4c84b', label: 'Dégât Critique',  			prefix: 'Boost les Dégâts Critique de ' },
	res:			{ icon: '✳️',  	color: '#4faa39', label: 'Ressurection',  				prefix: 'Vous permet de réanimer un camarade au combat dans les ' },
	feed:     { icon: '🍖',  	color: '#8d520b', label: 'Nourriture',       		prefix: 'Restaure ' },
  debuff:   { icon: '☠️',  	color: '#9b59b6', label: 'Malus',            		prefix: ''  }, 
  cooldown: { icon: '⏱️',  	color: '#888888', label: 'Cooldown',        		 	prefix: ''  },
	use: 			{ icon: '🧪',  	color: '#7db0ca', label: 'Utilisations',     		prefix: ''  },
	level: 		{ icon: '❓',  	color: '#c43c28', label: 'Niveau Requis',   		 prefix: 'Niveau '  }
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

/* ══ HELPERS IMAGES ══
   Champ canonique : images (tableau de chemins).
   Rétrocompat : image (string), img (string).              */
function getItemImages(item) {
  if (item.images && item.images.length) return item.images;
  if (item.image) return [item.image];
  if (item.img)   return [item.img];
  return [];
}
function getItemImg(item) {
  const imgs = getItemImages(item);
  return imgs.length ? imgs[0] : null;
}

//#endregion CONSTANTES

var ITEMS = [];

