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
//#region STATS DE BASE
// Stats d'une classe au niveau 1, sans aucun équipement (clés = id de stat, voir STAT_GROUPS). Ajoutées dans l'Atelier quelle que soit le niveau.
// Archer (fiche en jeu, niveau 3 sans équipement, moins 2 niveaux de gains) : 22 de vie = 20 + 2 × 1 ; 1,5 % de crit = 1 + 2 × 0,25.
const CLASS_BASE_STATS = {
  archer: {
    sante: 20, mana: 20, stamina: 20,
    degats: 1, // (la Dég. projectile de la fiche vient des cases de l'arbre de compétences, pas de la base)
    vitesse_attaque: 12.5,
    crit_chance: 1, crit_degats: 200, crit_comp_chance: 1, crit_comp_degats: 200,
    vitesse_deplacement: 16, esquive: 5,
  },
};
//#endregion STATS DE BASE
//#region ORDRE D'AFFICHAGE DES STATS
// Ordre du panneau « Statistiques » en jeu (Vie, Dég. d'attaque, Défense, Dég. projectile, Mana, Vit. d'attaque, Chance crit., Dég. critiques,
// Crit. capacités, Dég. crit. capacités, Endurance, Délai capacités, Vit. déplac., Soin bonus, Dég. capacités, Esquive, Réduc. dégâts, Dég. magiques, Ténacité).
// Les stats absentes de la fiche du jeu sont placées à côté de celles auxquelles elles se rattachent. « Délai capacités » = Hâte.
const STAT_DISPLAY_ORDER = [
  'sante', 'regen_sante',
  'degats', 'degats_physique', 'degats_arme',
  'defense', 'durabilite_garde', 'blocage', 'puissance_bloc', 'chance_parade',
  'degats_projectile',
  'mana', 'regen_mana',
  'vitesse_attaque', 'crit_chance', 'crit_degats', 'crit_comp_chance', 'crit_comp_degats',
  'stamina', 'regen_stamina',
  'hate',
  'vitesse_deplacement', 'vitesse_accroupi',
  'soin_bonus', 'puissance_soin', 'soins_recus',
  'degats_competence', 'vol_vie', 'omnivamp',
  'esquive', 'reduction_degats', 'reduction_chutes',
  'degats_magique',
  'tenacite', 'res_recul',
];
//#endregion ORDRE D'AFFICHAGE DES STATS
//#region GAINS PAR NIVEAU
// Stats gagnées à CHAQUE montée de niveau (message « Niveau supérieur — vous gagnez : » en jeu).
// Un build de niveau N a franchi N-1 niveaux : l'Atelier ajoute (N-1) × ces valeurs (clés = id de stat, voir STAT_GROUPS).
const CLASS_LEVEL_GAINS = {
  archer:   { sante: 1,   crit_chance: 0.25, regen_sante: 0.1, regen_stamina: 0.1 },
  guerrier: { sante: 1.5, blocage: 0.25,     regen_sante: 0.1, regen_stamina: 0.1 },
};
//#endregion GAINS PAR NIVEAU
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
      { id:'degats',              label:"Dégâts d'Attaque",                        icon:'🗡️',  unit:'',   max:500  },
	  	{ id:'degats_physique',     label:'Dégâts Physique',                 icon:'💥',  unit:'%',  max:100  },
      { id:'degats_arme',         label:'Dégâts d\'Arme',                  icon:'⚔️',  unit:'%',  max:100  },
      { id:'degats_magique',      label:'Dégâts Magiques',                 icon:'📖',  unit:'%',  max:100  },
      { id:'degats_competence',   label:'Dégâts de Compétence',            icon:'✨',  unit:'%',  max:100  },
      { id:'degats_projectile',   label:'Dégâts de Projectile',            icon:'🏹',  unit:'%',  max:100  },
      { id:'vitesse_attaque',     label:'Vitesse d\'Attaque',              icon:'💨',  unit:'/s',   max:100  },
      { id:'crit_chance',         label:'Chance Coups Critiques',          icon:'🎯',  unit:'%',  max:100  },
      { id:'crit_degats',         label:'Dégâts Coups Critiques',          icon:'💢',  unit:'%',  max:100  },
      { id:'crit_comp_chance',    label:'Chance Critique Compétence',      icon:'🎯',  unit:'%',  max:100  },
      { id:'crit_comp_degats',    label:'Crit Dégâts Compétence',           icon:'💢',  unit:'%',  max:100  },
    ]
  },
  {
    label: 'Défensif',
    stats: [
      { id:'defense',             label:'Défense',                         icon:'🛡️',  unit:'',   max:200 },
	  { id:'durabilite_garde',       label:'Durabilité de la Garde',             icon:'🛡️',  unit:'',   max:100 },
      { id:'blocage',             label:'Blocage',                       icon:'🧱',  unit:'%',   max:100 },
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
      { id:'omnivamp',            label:'Vampirisme de sort',                  icon:'👄',  unit:'%',   max:100  },
      { id:'soin_bonus',          label:'Soin Bonus',                      icon:'✳️',  unit:'',   max:100  },
      { id:'puissance_soin',      label:'Puissance de Soin',               icon:'💚',  unit:'',   max:100  },
      { id:'soins_recus',          label:'Soins Reçus',                     icon:'🩹',  unit:'%',  max:100  },
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
  pieces_recyclage: { label: 'Pièces de Recyclage', emoji: '♻️', color: '#6fc4b8' },
};

//#endregion CURRENCIES
//#region MAX_LEVEL
var MAX_LEVEL = 18; // var pour permettre la surcharge depuis Firestore (config/game)

//#endregion MAX_LEVEL
//#region BUILD LEVEL
/* Niveau actuel du build */
let buildLevel = 1;

function getMin(val) { return Array.isArray(val) ? val[0] : val; }
function getMax(val) { return Array.isArray(val) ? val[1] : val; }

//#endregion BUILD LEVEL
//#region OBTAIN AUTOMATIQUE (PNJ)
/* Sources d'obtention déduites des PNJ : un PNJ qui a l'item dans sa liste `craft` le fabrique, un PNJ qui l'a dans `sells` le vend.
   Elles s'ajoutent au texte `obtain` de l'item à l'affichage, sans doublon avec ce qui est déjà écrit ; rien n'est stocké. */
// Suffixe de localisation d'un PNJ dans une ligne d'obtain : " de Hanaka (x, y, z)". Vide pour un PNJ sensible.
function npcLocSuffix(p, regionName) {
  if (!p || p.sensible) return '';
  let region = regionName || (p.region && window._regionIndex && window._regionIndex.get(p.region)) || '';
  if (!region && p.region) region = String(p.region).replace(/_/g, ' ').replace(/(^|\s)\S/g, c => c.toUpperCase());
  const c = p.coords;
  const hasC = c && c.x != null && c.y != null && c.z != null;
  return (region ? ` de ${region}` : '') + (hasC ? ` (${c.x},${c.y},${c.z})` : '');
}
function autoObtainLines(item) {
  if (typeof PERSONNAGES === 'undefined' || !Array.isArray(PERSONNAGES) || !item) return [];
  const id = item.id ?? item._id;
  if (!id) return [];
  const lines = [];
  for (const p of PERSONNAGES) {
    const pid = p.id ?? p._id;
    if (!pid || !p.name) continue;
    const has = list => Array.isArray(list) && list.some(e => e && (e.id === id || e.itemId === id));
    if (has(p.craft))      lines.push({ pid, line: `Fabricable au [npc:${pid}|${p.name}]${npcLocSuffix(p)}` });
    else if (has(p.sells)) lines.push({ pid, line: `Achetable au [npc:${pid}|${p.name}]${npcLocSuffix(p)}` });
  }
  return lines;
}
// Mobs qui lootent l'item (loot du mob = source de vérité) : lignes « - [mob|Nom][chance] » du bloc « Obtenable en tuant: »
function autoMobLootLines(item) {
  const mobs = (typeof window !== 'undefined' && Array.isArray(window.VCL_MOBS)) ? window.VCL_MOBS : [];
  const id = item && (item.id ?? item._id);
  if (!id) return [];
  const out = [];
  for (const m of mobs) {
    const mid = m.id ?? m._id;
    const l = mid && Array.isArray(m.loot) ? m.loot.find(x => x && x.id === id) : null;
    if (l) out.push({ mid, line: `- [${mid}|${m.name || mid}][${l.chance != null ? l.chance : '?'}]` });
  }
  return out;
}
function withAutoObtain(item, text) {
  let base = typeof text === 'string' ? text : '';
  const extra = autoObtainLines(item).filter(l => !base.includes(`[npc:${l.pid}|`) && !base.includes(`[npc:${l.pid}]`)).map(l => l.line);
  const mobExtra = autoMobLootLines(item).filter(l => !base.includes(`[${l.mid}|`)).map(l => l.line);
  if (mobExtra.length) {
    const lines = base.split('\n');
    let last = -1, inBlock = false;
    lines.forEach((l, i) => {
      if (/^\s*Obtenable en tuant/i.test(l)) { inBlock = true; last = i; }
      else if (inBlock && /^\s*-\s*\[[^|\]]+\|[^\]]*\]\[[^\]]*\]\s*$/.test(l)) last = i;
      else if (l.trim() && !/^\s*-/.test(l)) inBlock = false;
    });
    if (last >= 0) { lines.splice(last + 1, 0, ...mobExtra); base = lines.join('\n'); }
    else base = (base.trim() ? base.replace(/\s+$/, '') + '\n' : '') + 'Obtenable en tuant:\n' + mobExtra.join('\n');
  }
  if (!extra.length) return base;
  return base.trim() ? base.replace(/\s+$/, '') + '\n' + extra.join('\n') : extra.join('\n');
}
//#endregion OBTAIN AUTOMATIQUE (PNJ)
//#region OBTAIN_TEXTS
/* Sources d'obtention prédéfinies : une ligne [obtain:<id>] dans item.obtain est remplacée par ce texte.
   Modifier le texte d'un id met à jour tous les items qui l'utilisent.
   (Garder l'objet sur plusieurs lignes, clés entre guillemets : le Worker Cloudflare le relit tel quel.) */
const OBTAIN_TEXTS = {
  "forge": "Fabricable à la Forge du Fractured Underworld",
  "altar": "Fabricable à l'Altar de Rulid dans le Fractured Underworld (187,71,234)",
};
function resolveObtain(str) {
	if (typeof str !== 'string') return str;
	// « Autre source — » est un préfixe de stockage : à l'affichage, seul le texte saisi apparaît
	return str.replace(/\[obtain:([\w-]+)\]/g, (m, id) => OBTAIN_TEXTS[id] ?? id).replace(/^Autre source — /gm, '').replace(/\((-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\)/g, '($1,$2,$3)');
}
//#endregion OBTAIN_TEXTS
//#region EVENT_NAMES
/* Évènements possibles pour le champ `event` des items du palier « Event » (ordre d'affichage).
   Source réelle : collection Firestore `events` (outil modération « Events »), chargée par db-loader ; cette liste n'est qu'un repli. */
const EVENT_NAMES = ['Noël 2025', 'Saint-Valentin 2026', 'Nouvel An Lunaire 2026', 'Halloween 2025', 'Earth Leveling 2026']; // repli : remplacé au chargement par la collection `events`
//#endregion EVENT_NAMES
//#region CATEGORIES
const CATEGORIES = {
  armure:          { label: 'Armures',         emoji: '🛡️',  ordre: 1 },
  arme:            { label: 'Armes',           emoji: '⚔️',  ordre: 2 },
  accessoire:      { label: 'Accessoires',     emoji: '💍',  ordre: 3 },
  rune:            { label: 'Runes',           emoji: '🔮',  ordre: 4 },
  parchemin:       { label: 'Parchemins',      emoji: '📃',  ordre: 4.5 },
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
	degats_attaque:    		{ icon: '⚔️',  	color: '#e7d189', label: 'Force Accrue',     		prefix: 'Boost vos dégâts d\'attaque de ' },
	degats_physique:    	{ icon: '💪',  	color: '#eebe22', label: 'Force Accrue',     		prefix: 'Boost vos dégâts physiques de ' },
	degats_armes:    			{ icon: '⚔️',  	color: '#f36d14', label: 'Force Accrue',     		prefix: 'Boost vos dégâts d\'armes de ' },
	degats_arcane:   			{ icon: '🔮',  	color: '#c24cda', label: 'Puissance Arcanique',  prefix: 'Boost vos dégâts magiques de ' },
  boost_sante:    			{ icon: '❤️',  	color: '#d83c3c', label: 'Santé Accrue',     		prefix: 'Boost votre santé maximale de ' },
  boost_regen_vie:    	{ icon: '💓',  	color: '#e07171', label: 'Régénération de Santé Accrue',     		prefix: 'Boost votre régénération de santé de ' },
	boost_mana:    				{ icon: '💧',  	color: '#3676ac', label: 'Mana Accrue',     		prefix: 'Boost votre mana maximale de ' },
  boost_regen_mana:    	{ icon: '💦',  	color: '#89c4fb', label: 'Régénération de Mana Accrue',     		prefix: 'Boost votre régénération de mana de ' },
	boost_stamina:    		{ icon: '👟',  	color: '#ddb225', label: 'Endurance Accrue',     		prefix: 'Boost votre endurance maximale de ' },
  boost_regen_stamina:  { icon: '💨',  	color: '#ffe188', label: 'Régénération de Stamina Accrue',     		prefix: 'Boost votre régénération de stamina de ' },
	coups_critique:				{ icon: '🎯',  	color: '#d3b327', label: 'Coûp Critique',  			prefix: 'Boost vos chances de critique de ' },
	degats_critique:			{ icon: '💢',  	color: '#e4c84b', label: 'Dégât Critique',  			prefix: 'Boost vos dégâts critiques de ' },
	comp_coups_critique:	{ icon: '🎯',  	color: '#d663cd', label: 'Coûp Critique de Compétence',  			prefix: 'Boost vos chances de critique de compétences de ' },
	comp_degats_critique:	{ icon: '💢',  	color: '#b14299', label: 'Dégât Critique de Compétence',  			prefix: 'Boost vos dégâts critiques de compétences de ' },
	vol_vie:							{ icon: '🩸',  	color: '#db2727', label: 'Soif de Sang',  				prefix: 'Boost votre vol de vie de ' },
  vitesse_deplacement:	{ icon: '🏃',  	color: '#5f89fd', label: 'Vitesse de Déplacement',  				prefix: 'Boost votre vitesse de ' },
  agilite:	            { icon: '💨',  	color: '#b8c8f4', label: 'Agilité',  				prefix: 'Boost votre chance d\'esquive de ' },
  resistance_recul:	    { icon: '💨',  	color: '#b8c8f4', label: 'Résistance au Recul',  				prefix: 'Boost votre résistance au recul de ' },
  blocage:	    { icon: '🛡️',  	color: '#cdc0d6', label: 'Chance de Blocage',  				prefix: 'Boost votre chance de blocage de ' },
  puissance_blocage :	  { icon: '💪',  	color: '#e06c95', label: 'Puissance du Blocage',  				prefix: 'Boost votre puissance de blocage de ' },
	

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
  const tier = (item.event || (item.palier === 0 || item.palier === 'event')) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  const base = '../img/compendium/textures/';
  const paths = {
    arme:        base + 'weapons/'                 + tp + id + '.png',
    armure:      base + 'armors/'                  + tp + id + '.png',
    accessoire:  base + 'trinkets/'                + tp + id + '.png',
    outils:      base + 'gears/'                   + tp + id + '.png',
    rune:        base + 'items/Runes/'             + tp + id + '.png',
    parchemin:   base + 'items/Parchemins/'        + tp + id + '.png',
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

