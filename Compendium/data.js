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
      { id:'vitesse_attaque',     label:'Vitesse d\'Attaque',              icon:'💨',  unit:'',   max:100  },
      { id:'crit_chance',         label:'Chance Coups Critiques',          icon:'🎯',  unit:'%',  max:100  },
      { id:'crit_degats',         label:'Dégâts Coups Critiques',          icon:'💢',  unit:'%',  max:100  },
      { id:'crit_comp_chance',    label:'Chance Critique Compétence',      icon:'🎯',  unit:'%',  max:100  },
      { id:'crit_comp_degats',    label:'Dégâts Critique Compétence',      icon:'💢',  unit:'%',  max:100  },
    ]
  },
  {
    label: 'Défensif',
    stats: [
      { id:'defense',             label:'Défense',                         icon:'🛡️',  unit:'',   max:200 },
	  	{ id:'maitrise_bloc',       label:'Maîtrise de Blocage',             icon:'🧱',  unit:'%',   max:100 },
	  	{ id:'puissance_bloc',      label:'Puissance de Blocage',            icon:'💪',  unit:'%',   max:100 },
      { id:'sante',               label:'Santé',                           icon:'❤️',  unit:'',   max:1000 },
      { id:'esquive',             label:'Esquive',                         icon:'💨',  unit:'%',  max:100  },
      { id:'reduction_degats',    label:'Réduction de Dégâts',             icon:'🔰',  unit:'%',  max:100  },
      { id:'reduction_chutes',    label:'Réduction de Chutes',             icon:'🦘',  unit:'%',  max:100  },
      { id:'tenacite',            label:'Ténacité',                        icon:'🏋️',  unit:'%',  max:100  },
      { id:'res_recul',           label:'Résistance au Recul',             icon:'🔒',  unit:'%',  max:100  },
      { id:'chance_parade',       label:'Chance de Parade',                icon:'⚜️',  unit:'%',  max:100  },
    ]
  },
  {
    label: 'Mobilité & Ressources',
    stats: [
      { id:'hate',                label:'Hâte',                            icon:'🌀',  unit:'%',  max:100  },
      { id:'vitesse_deplacement', label:'Vitesse de Déplacement',          icon:'💨',  unit:'%',  max:100  },
      { id:'vitesse_accroupi',    label:'Vitesse Accroupi',                icon:'🐾',  unit:'',   max:250   },
      { id:'mana',                label:'Mana',                            icon:'💧',  unit:'',   max:1000 },
      { id:'stamina',             label:'Stamina',                         icon:'👟',  unit:'',   max:1000 },
    ]
  },
  {
    label: 'Régénération & Soutien',
    stats: [
      { id:'vol_vie',             label:'Vol de Vie',                      icon:'🩸',  unit:'%',   max:100  },
      { id:'omnivamp',            label:'Omnivampirisme',                  icon:'👄',  unit:'%',   max:100  },
      { id:'soin_bonus',          label:'Soin Bonus',                      icon:'✳️',  unit:'',   max:100  },
      { id:'puissance_soin',      label:'Puissance de Soin',               icon:'💚',  unit:'',   max:100  },
      { id:'regen_sante',         label:'Régénération Santé',              icon:'💓',  unit:'/s', max:100  },
      { id:'regen_mana',          label:'Régénération Mana',               icon:'💦',  unit:'/s', max:100  },
      { id:'regen_stamina',       label:'Régénération Stamina',            icon:'👟',  unit:'/s', max:100  },
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

//#region CURRENCIES
const CURRENCIES = {
  cols: { label: 'Cols', emoji: '🪙', color: '#c9a84c' },
};

//#endregion CURRENCIES
//#region MAX_LEVEL
var MAX_LEVEL = 18; // var pour permettre la surcharge depuis Firestore (config/game)

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
  heal:     						{ icon: '❤️',  	color: '#e05252', label: 'Points de vie',    		prefix: '+' },
	regen:   	 						{ icon: '💓',  	color: '#ce7b7b', label: 'Régénération',     		prefix: 'Régénération ' },

  mana:     						{ icon: '💧', 	 color: '#5b8dee', label: 'Mana',            		 prefix: '+' },
  stamina:  						{ icon: '👟', 	color: '#f4d745', label: 'Stamina',          		prefix: '+' },
	degats_attaque:    		{ icon: '⚔️',  	color: '#e7d189', label: 'Force Accrue',     		prefix: 'Boost les Dégâts d\'Attaque de ' },
	degats_physique:    	{ icon: '💪',  	color: '#eebe22', label: 'Force Accrue',     		prefix: 'Boost les Dégâts Physique de ' },
	degats_armes:    			{ icon: '⚔️',  	color: '#f36d14', label: 'Force Accrue',     		prefix: 'Boost les Dégâts d\'Armes de ' },
	degats_arcane:   			{ icon: '🔮',  	color: '#c24cda', label: 'Puissance Arcanique',  prefix: 'Boost les Dégâts Magique de ' },
  boost_sante:    			{ icon: '❤️',  	color: '#d83c3c', label: 'Santé Accrue',     		prefix: 'Boost la Santé Max de ' },
  boost_regen_vie:    	{ icon: '💓',  	color: '#e07171', label: 'Régénération de Santé Accrue',     		prefix: 'Boost la Régénération de Santé Max de ' },
	boost_mana:    				{ icon: '💧',  	color: '#3676ac', label: 'Mana Accrue',     		prefix: 'Boost le Mana Max de ' },
  boost_regen_mana:    	{ icon: '💦',  	color: '#89c4fb', label: 'Régénération de Mana Accrue',     		prefix: 'Boost la Régénération de Mana Max de ' },
	boost_stamina:    		{ icon: '👟',  	color: '#ddb225', label: 'Endurance Accrue',     		prefix: 'Boost la Stamina Max de ' },
  boost_regen_stamina:  { icon: '💨',  	color: '#ffe188', label: 'Régénération de Stamina Accrue',     		prefix: 'Boost la Régénération de Stamina Max de ' },
	coups_critique:				{ icon: '🎯',  	color: '#d3b327', label: 'Coûp Critique',  			prefix: 'Boost les Chances Crtique de ' },
	degats_critique:			{ icon: '💢',  	color: '#e4c84b', label: 'Dégât Critique',  			prefix: 'Boost les Dégâts Critique de ' },
	comp_coups_critique:	{ icon: '🎯',  	color: '#d663cd', label: 'Coûp Critique de Compétence',  			prefix: 'Boost les Chances Crtique de Compétence de ' },
	comp_degats_critique:	{ icon: '💢',  	color: '#b14299', label: 'Dégât Critique de Compétence',  			prefix: 'Boost les Dégâts Critique de Compétence de ' },
	vol_vie:							{ icon: '🩸',  	color: '#db2727', label: 'Soif de Sang',  				prefix: 'Boost le Vol de Vie de ' },
  vitesse_deplacement:	{ icon: '🏃',  	color: '#5f89fd', label: 'Vitesse de Déplacement',  				prefix: 'Boost la Vitesse de Déplacement de ' },
  agilite:	            { icon: '💨',  	color: '#b8c8f4', label: 'Agilité',  				prefix: 'Boost les chances d\'Esquive de ' },
  resistance_recul:	    { icon: '💨',  	color: '#b8c8f4', label: 'Résistance au Recul',  				prefix: 'Boost la résistance au recul de ' },
  maitrise_blocage:	    { icon: '🛡️',  	color: '#cdc0d6', label: 'Maîtrise du Blocage',  				prefix: 'Boost la maîtrise du blocage de ' },
  puissance_blocage :	  { icon: '💪',  	color: '#e06c95', label: 'Puissance du Blocage',  				prefix: 'Boost la puissance du blocage de ' },
	

	health_heal:  				{ icon: '💓',  	color: '#a01212', label: 'Healing',  						prefix: 'Vous rends ' },
	mana_heal:						{ icon: '💦',  	color: '#247ca5', label: 'Mana',  								prefix: 'Vous rends ' },
	stamina_heal:					{ icon: '💨',  	color: '#e4c84b', label: 'Stamina',  						prefix: 'Vous rends ' },

	dexterite_attribut:		{ icon: '🏹',  	color: '#e3cb5f', label: 'Augmentation Dextérité',       prefix: 'Augmente votre attribut de Dextérité de ' },
	force_attribut:				{ icon: '⚔️',  	color: '#d97f43', label: 'Augmentation Force',       		prefix: 'Augmente votre attribut de Force de ' },
	esprit_attribut:			{ icon: '🌿',  	color: '#62d435', label: 'Augmentation Esprit',       		prefix: 'Augmente votre attribut d\'Esprit de ' },
	intelligence_attribut:{ icon: '🔮',  	color: '#a152a8', label: 'Augmentation Intelligence',    prefix: 'Augmente votre attribut d\'Intelligence de ' },
	vitalite_attribut:		{ icon: '❤️',  	color: '#e91b1b', label: 'Augmentation Vitalité',       	prefix: 'Augmente votre attribut de Vitalité de ' },
	defense_attribut:			{ icon: '🛡️',  	color: '#c7c7c7', label: 'Augmentation Défense',       	prefix: 'Augmente votre attribut de Défense de ' },

	resurection:					{ icon: '✳️',  	color: '#4faa39', label: 'Ressurection',  				prefix: 'Vous permet de réanimer un camarade au combat dans les ' },

	feed:     						{ icon: '🍖',  	color: '#8d520b', label: 'Nourriture',       		prefix: 'Restaure ' },
	saturation:     			{ icon: '🍖',  	color: '#cc4c11', label: 'Saturation',       		prefix: 'Offre ' },
  cooldown: 						{ icon: '⏱️',  	color: '#888888', label: 'Cooldown',        		 	prefix: ''  },
	use: 									{ icon: '🧪',  	color: '#7db0ca', label: 'Utilisations',     		prefix: ''  },
	level: 								{ icon: '❓',  	color: '#c43c28', label: 'Niveau Requis',   		  prefix: 'Niveau '  },
  reparation: 					{ icon: '⚒️',  	color: '#f0c137', label: 'Réparation',   		  prefix: 'Réparation '  },
  durabilite: 					{ icon: '⛏️',  	color: '#5ad18a', label: 'Durabilité',   		  prefix: 'Durabilité '  },
  puissance_recolte: 		{ icon: '💪',  	color: '#e86652', label: 'Puissance de Récolte',   		  prefix: 'Puissance de Récolte '  }
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
  // Fallback : générer le chemin depuis la catégorie + id
  const id  = item.id ?? item._id;
  const cat = item.category || item.cat;
  if (!id || !cat) return [];
  const tier = (item.event || item.palier === 0) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  const base = '../img/compendium/textures/';
  const paths = {
    arme:        base + 'weapons/'                 + tp + id + '.png',
    armure:      base + 'armors/'                  + tp + id + '.png',
    accessoire:  base + 'trinkets/'                + tp + id + '.png',
    outils:      base + 'gears/'                   + tp + id + '.png',
    rune:        base + 'items/Runes/'             + tp + id + '.png',
    materiaux:   base + 'items/Material/'          + tp + id + '.png',
    ressources:  base + 'items/Ressources/'        + tp + id + '.png',
    consommable: base + 'items/Consommable/'       + tp + id + '.png',
    nourriture:  base + 'items/Nourriture/'        + tp + id + '.png',
    quete:       base + 'items/Quest/'             + tp + id + '.png',
    donjon:      base + 'items/Donjon/'            + tp + id + '.png',
    monnaie:     base + 'items/Monnaie/'           + tp + id + '.png',
  };
  return paths[cat] ? [paths[cat]] : [];
}
function getItemImg(item) {
  const imgs = getItemImages(item);
  return imgs.length ? imgs[0] : null;
}

//#endregion CONSTANTES

var ITEMS = [];

