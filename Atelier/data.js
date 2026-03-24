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
      2: { hate:10 },
      3: { vitesse_deplacement:0.5 },
      4: { esquive:4 },
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

const ITEMS = [
  /* ══ Armes ══ */
  { id:'dague_entrainement',      		name:"Dague d'Entrainement",          	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/dague_dentrainement.png",            	stats:{degats:7, vitesse_attaque:1.2} },
  { id:'epee_entrainement',       		name:"Épée d'Entrainement",           	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/epee_dentrainement.png",             	stats:{degats:12, vitesse_attaque:1}, classes:['guerrier'] },
  { id:'bouclier_pacotille',      		name:"Bouclier de Pacotille",         	rarity:'commun',    cat:'arme_s',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/bouclier_de_pacotille.png",          	stats:{sante:5}, classes:['guerrier'] },
  { id:'dague_delabree',      			name:"Dague Délabrée",                	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/dague_delabree.png",                 	stats:{degats:13.5, vitesse_attaque:1.1}, classes:['assassin'] },
  { id:'arc_courbe',      				name:"Arc Courbé",                    	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/arc_courbe.png",                     	stats:{degats:3, vitesse_attaque:1}, classes:['archer'] },
  { id:'baton_mediocre_mag',   			name:"Bâton Médiocre",                	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/baton_mediocre_mage.png",            	stats:{degats:6.5, vitesse_attaque:1}, classes:['mage'] },
  { id:'baton_mediocre_sha',  			name:"Bâton Médiocre",                	rarity:'commun',    cat:'arme_p',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/baton_mediocre_shaman.png",          	stats:{degats:6.2, vitesse_attaque:1, soin_bonus:1}, classes:['shaman'] },
  { id:'epee_fer',        				name:"Épée en Fer",                   	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/epee_en_fer.png",                    	stats:{degats:[14,16], vitesse_attaque:1}, classes:['guerrier'] },
  { id:'bouclier_ika',       			name:"Bouclier d'Ika",                	rarity:'commun',    cat:'arme_s',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/bouclier_dika.png",                  	stats:{sante:[8,12], defense:[1,1.5]}, classes:['guerrier'] },
  { id:'bouclier_pointu_bois',      	name:"Bouclier Pointu Bois",          	rarity:'commun',    cat:'arme_s',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/bouclier_pointu_en_bois.png",        	stats:{sante:[4,6], defense:[0.5,0.8], degats:0.5}, classes:['guerrier'] },
  { id:'dague_intermedaire',       		name:"Dague Intermédiaire",           	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/dague_intermediaire.png",            	stats:{degats:[17,20], vitesse_attaque:[1.1,1.2]}, classes:['assassin'] },
  { id:'hache_double_fer',       		name:"Hache Double en Fer",           	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/hache_double_en_fer.png",            	stats:{degats:[17,19], vitesse_attaque:0.9}, classes:['guerrier'] },
  { id:'arc_sylvestre',        			name:"Arc Sylvestre",                 	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/arc_sylvestre.png",                  	stats:{degats:[4,6], vitesse_attaque:1}, classes:['archer'] },
  { id:'baton_sylvestre_mag',  			name:"Bâton Sylvestre",               	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/baton_sylvestre_mage.png",           	stats:{degats:[12,13], vitesse_attaque:1}, classes:['mage'] },
  { id:'baton_sylvestre_sha',  			name:"Bâton Sylvestre",               	rarity:'commun',    cat:'arme_p',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/baton_sylvestre_shaman.png",         	stats:{degats:[8,10], vitesse_attaque:1, soin_bonus:[1,2]}, classes:['shaman'] },
  { id:'grimoire_delie',      			name:"Grimoire Delié",                	rarity:'commun',    cat:'arme_s',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/grimoire_delie-sauvage.png",         	stats:{degats_magique:2, mana:5}, classes:['mage'] },
  { id:'grimoire_sauvage',    			name:"Grimoire Sauvage",              	rarity:'commun',    cat:'arme_s',  tier:1, lvl:1,  img:"../img/compendium/textures/weapons/grimoire_delie-sauvage.png",         	stats:{regen_mana:0.1, mana:5}, classes:['shaman'] },
  { id:'grimoire_sylvestre',       		name:"Grimoire Sylvestre",            	rarity:'commun',    cat:'arme_s',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/grimoire_sylvestre.png",             	stats:{degats_magique:2.5, mana:7.5}, classes:['mage'] },
  { id:'grimoire_bestial',       		name:"Grimoire Bestial",              	rarity:'commun',    cat:'arme_s',  tier:1, lvl:3,  img:"../img/compendium/textures/weapons/grimoire_bestial.png",               	stats:{regen_mana:0.15, mana:7.5}, classes:['shaman'] },
  { id:'grimoire_magicien',        		name:"Grimoire du Magicien",          	rarity:'rare',      cat:'arme_s',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/grimoire_du_magicien.png",           	stats:{degats_magique:3.5, mana:10}, classes:['mage'] },
  { id:'grimoire_sorier',        		name:"Grimoire du Sorcier",           	rarity:'rare',      cat:'arme_s',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/grimoire_du_sorcier.png",            	stats:{regen_mana:0.25, mana:10}, classes:['shaman'] },
  { id:'grimoire_obsc',       			name:"Grimoire Obscur",               	rarity:'rare',      cat:'arme_s',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/grimoire_obscur.png",                	stats:{degats_magique:4, mana:12.5}, classes:['mage'] },
  { id:'grimoire_fant',       			name:"Grimoire Fantomatique",         	rarity:'rare',      cat:'arme_s',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/grimoire_fantome.png",               	stats:{regen_mana:0.3, mana:12.5}, classes:['shaman'] },
  { id:'bouclier_sylestre',       		name:"Bouclier Sylvestre",            	rarity:'rare',      cat:'arme_s',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/bouclier_sylvestre.png",             	stats:{sante:15, defense:1.7}, classes:['guerrier'] },
  { id:'marteau_colosse',     			name:"Marteau du Colosse",            	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/marteau_du_colosse.png",             	stats:{degats:23, vitesse_attaque:0.8}, classes:['guerrier'] },
  { id:'epee_osseuse',        			name:"Épée Osseuse",                  	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/epee_osseuse.png",                   	stats:{degats:17.5, vitesse_attaque:1}, classes:['guerrier'] },
  { id:'baton_squelette_mag',  			name:"Bâton de Squelette",            	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/baton_squelettique.png",             	stats:{degats:15, vitesse_attaque:1}, classes:['mage'] },
  { id:'baton_squelette_sha',  			name:"Bâton de Squelette",            	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/baton_squelettique.png",             	stats:{degats:12, vitesse_attaque:1, soin_bonus:2.5}, classes:['shaman'] },
  { id:'baton_squelette_maudit_mag',  	name:"Bâton Squelette Maudit",        	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/baton_de_squelette_maudit_mage.png", 	stats:{degats:18, vitesse_attaque:1.1, degats_competence:2.5, sante:-10, mana:-5}, classes:['mage'] },
  { id:'baton_squelette_maudit_sha',  	name:"Bâton Squelette Maudit",        	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/baton_de_squelette_maudit_shaman.png",	stats:{degats:14, vitesse_attaque:1.1, soin_bonus:3.5, regen_mana:0.2, sante:-20}, classes:['shaman'] },
  { id:'arbalete_bandit',        		name:"Arbalète de Bandit",            	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/arbalete_de_bandit.png",             	stats:{degats:12, vitesse_attaque:0.7}, classes:['archer'] },
  { id:'dague_bandit',      			name:"Dague de Bandit",               	rarity:'rare',      cat:'arme_p',  tier:1, lvl:5,  img:"../img/compendium/textures/weapons/dague_de_bandit.png",                	stats:{degats:25, vitesse_attaque:1.2}, classes:['assassin'] },
  { id:'epee_magique',        			name:"Épée Magique",                  	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/epee_magique.png",                   	stats:{degats:[18,20], vitesse_attaque:1.1}, classes:['guerrier'] },
  { id:'marteau_magique',     			name:"Marteau Magique",               	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/marteau_magique.png",                	stats:{degats:[25,30], vitesse_attaque:0.8}, classes:['guerrier'] },
  { id:'epee_gardien',       			name:"Épée du Gardien",               	rarity:'rare',      cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/epee_du_gardien.png",                	stats:{degats:[20,24], vitesse_attaque:1.1, crit_chance:[8,12]}, classes:['guerrier'] },
  { id:'hallebarde_royale',  			name:"Hallebarde Royale",             	rarity:'legendaire',cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/hallebarde_royale.png",              	stats:{degats:35, vitesse_attaque:0.7}, classes:['guerrier'] },
  { id:'hache_illfang',       			name:"Hache de Illfang",              	rarity:'legendaire',cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/hache_de_illfang.png",               	stats:{degats:60, vitesse_attaque:0.7}, classes:['guerrier'] },
  { id:'nodachi',         				name:"Nodachi",                       	rarity:'mythique',  cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/nodachi.png",                        	stats:{degats:45, vitesse_attaque:1.2, crit_chance:10, crit_degats:10}, classes:['guerrier'] },
  { id:'boucl_resistant_tolbana',       name:"Bouclier Résistant de Tolbana", 	rarity:'rare',      cat:'arme_s',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/bouclier_resistant_de_tolbana.png",  	stats:{sante:[16,20], defense:[1.9,2.1]}, classes:['guerrier'] },
  { id:'boucl_puissant_tolbana',       	name:"Bouclier Puissant de Tolbana",  	rarity:'rare',      cat:'arme_s',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/bouclier_puissant_de_tolbana.png",   	stats:{sante:[8,12], defense:[1.2,1.4], degats:2}, classes:['guerrier'] },
  { id:'boucl_illfang',       			name:"Bouclier de Illfang",           	rarity:'mythique',  cat:'arme_s',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/bouclier_de_illfang.png",            	stats:{sante:45, defense:5}, classes:['guerrier'] },
  { id:'baton_magicien',  				name:"Bâton du Magicien",             	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/baton_tolbana.png",                  	stats:{degats:[18,21], vitesse_attaque:1}, classes:['mage'] },
  { id:'baton_sorcier',   				name:"Bâton du Sorcier",              	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/baton_tolbana.png",                  	stats:{degats:[16,18], vitesse_attaque:1, soin_bonus:[2.5,3.5]}, classes:['shaman'] },
  { id:'baton_magicien_puissant',		name:"Bâton du Magicien Puissant",    	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/baton_tolbana_puissant.png",         	stats:{degats:[20,22], vitesse_attaque:1.1, degats_competence:3, sante:-15, mana:-10}, classes:['mage'] },
  { id:'baton_sorcier_puissant', 		name:"Bâton du Sorcier Puissant",     	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/baton_tolbana_puissant.png",         	stats:{degats:[18,20], vitesse_attaque:1.1, soin_bonus:[3.5,4.5], regen_mana:0.2, sante:-30}, classes:['shaman'] },
  { id:'baton_obscur_mag',  			name:"Bâton Obscur",                  	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/baton_obscur_mage.png",              	stats:{degats:[21.5,24.5], vitesse_attaque:1}, classes:['mage'] },
  { id:'baton_obscur_sha',  			name:"Bâton Obscur",                  	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/baton_obscur_shaman.png",            	stats:{degats:[19,22], vitesse_attaque:1, soin_bonus:[3,4]}, classes:['shaman'] },
  { id:'baton_obscur_puissant_mag',		name:"Bâton Obscur Puissant",         	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/baton_obscur_mage.png",              	stats:{degats:[23,27], vitesse_attaque:1.1, degats_competence:4, sante:-20, mana:-15}, classes:['mage'] },
  { id:'baton_obscur_puissant_sha',		name:"Bâton Obscur Puissant",         	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/baton_obscur_shaman.png",            	stats:{degats:[21,22], vitesse_attaque:1.1, soin_bonus:[4.5,5.5], regen_mana:0.3, sante:-40}, classes:['shaman'] },
  { id:'baton_nodachi_mag', 			name:"Bâton Nodachi",                 	rarity:'mythique',  cat:'arme_p',  tier:1, lvl:11, img:"../img/compendium/textures/weapons/baton_nodachi.png",                  	stats:{degats:50, vitesse_attaque:1, crit_comp_chance:15}, classes:['mage'] },
  { id:'baton_nodachi_sha', 			name:"Bâton Nodachi",                 	rarity:'mythique',  cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/baton_nodachi.png",                  	stats:{degats:35, vitesse_attaque:1.2, soin_bonus:10, regen_sante:0.3, regen_mana:0.3}, classes:['shaman'] },
  { id:'dague_sombre',    				name:"Dague Sombre",                  	rarity:'epique',    cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/dague_sombre.png",                   	stats:{degats:[27,31], vitesse_attaque:1.2}, classes:['assassin'] },
  { id:'longue_dague_sombre',  			name:"Longue Dague Sombre",           	rarity:'epique',    cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/longue_dague_sombre.png",            	stats:{degats:[35,40], vitesse_attaque:[0.8,0.9]}, classes:['assassin'] },
  { id:'dague_heroique',      			name:"Dague Héroïque",                	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/dague_heroique.png",                 	stats:{degats:[31,35], vitesse_attaque:[1.3,1.5]}, classes:['assassin'] },
  { id:'katana_heroique',     			name:"Katana Héroïque",               	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/katana_heroique.png",                	stats:{degats:[40,44.98], vitesse_attaque:[0.7,0.9]}, classes:['assassin'] },
  { id:'arc_chasse',      				name:"Arc de Chasse",                 	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/arc_de_chasse.png",                  	stats:{degats:[10,13], vitesse_attaque:1}, classes:['archer'] },
  { id:'arc_fallen',      				name:"Arc du Fallen",                 	rarity:'epique',    cat:'arme_p',  tier:1, lvl:9,  img:"../img/compendium/textures/weapons/arc_du_fallen.png",                  	stats:{degats:[14,16], vitesse_attaque:[1,1.1]}, classes:['archer'] },
  { id:'arbalete_chasse', 				name:"Arbalète de Chasse",            	rarity:'rare',      cat:'arme_p',  tier:1, lvl:7,  img:"../img/compendium/textures/weapons/arbalete_de_chasse.png",             	stats:{degats:[15,19], vitesse_attaque:0.7}, classes:['archer'] },
  { id:'arbalete_cendre', 				name:"Arbalète de Cendre",            	rarity:'legendaire',cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/arbalete_de_cendre.png",             	stats:{degats:23.5, vitesse_attaque:0.7}, classes:['archer'] },
  { id:'arc_nodachi',     				name:"Arc Nodachi",            			rarity:'mythique',  cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/arc_nodachi.png",             			stats:{degats:23.5, vitesse_attaque:1.3, crit_chance:10, crit_degats:5}, classes:['archer'] },
  { id:'dague_nodachi',   				name:"Dague Nodachi",            		rarity:'mythique',  cat:'arme_p',  tier:1, lvl:10, img:"../img/compendium/textures/weapons/dague_nodachi.png",             			stats:{degats:55, vitesse_attaque:1.8, vol_vie:3.5, vitesse_deplacement:1}, classes:['assassin'] },
  { id:'spectre_hivernal_sha', 			name:"Scpetre Hivernale",               rarity:'',  		cat:'arme_p',  tier:0, lvl:10, img:"",                  					stats:{degats:25, vitesse_attaque:1, soin_bonus:6}, classes:['shaman'] },
  
  /* ══ Accessoires ══ */
  /* ══ Anneaux ══ */
  /* ══ Palier 1 ══ */
  { id:'anneau_cuivre',   				name:"Anneau de Cuivre",				set:'cuivre',    	rarity:'commun',    cat:'anneau',    	tier:1, lvl:3,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Anneau de Cuivre.png",                         	stats:{sante:5} },
  { id:'anneau_pumba',    				name:"Anneau de Pumba",                        				rarity:'legendaire',cat:'anneau',    	tier:1, lvl:3, 	img:"../img/compendium/textures/trinkets/P1/Anneau de Pumba.png",                                        	stats:{sante:10, defense:1} },
  { id:'anneau_fer',      				name:"Anneau de Fer",					set:'fer',       	rarity:'rare',      cat:'anneau',    	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Anneau de Fer.png",                               	stats:{defense:0.5} },
  { id:'bague_gluante',      			name:"Bague Gluante",       			set:'slime',     	rarity:'commun',    cat:'anneau',    	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bague Gluante.png",               	stats:{sante:2.5, regen_sante:0.1} },
  { id:'bague_squelette',      			name:"Bague de Squelette",  			set:'squelette', 	rarity:'commun',    cat:'anneau',    	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Bague de Squelette.png",          	stats:{degats_competence:1, sante:2.5} },
  { id:'anneau_sylvestre',     			name:"Anneau Sylvestre",    			set:'sylve',     	rarity:'rare',      cat:'anneau',    	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Anneau Sylvestre.png",                      	stats:{soin_bonus:1, mana:1, stamina:0.5, regen_sante:0.2} },
  { id:'anneau_gluant',     			name:"Anneau Gluant",       			set:'slime',     	rarity:'epique',    cat:'anneau',    	tier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Anneau Gluant.png",               	stats:{tenacite:15, sante:20, regen_sante:0.5} },
  { id:'anneau_leviathan',     			name:"Anneau de Léviathan",                      			rarity:'epique',    cat:'anneau',    	tier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Anneau de Léviathan.png",                                   	stats:{defense:2.5} },
  /* ══ Palier 2 ══ */
  { id:'bague_bouleau',     			name:"Bague de Bouleau",                      				rarity:'rare',    	cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Bague de Bouleau.png",                                   		stats:{defense:1, sante:10} },
  { id:'anneau_acacia',     			name:"Anneau d'Acacia",                      				rarity:'rare',    	cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Anneau d'Acacia.png",                                   		stats:{degats:2, crit_chance:2.5, sante:5} },
  { id:'anneau_mielleux',     			name:"Anneau Mielleux",                      				rarity:'commun',    cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Anneau Mielleux.png",                                   		stats:{soin_bonus:1, sante:10} },
  { id:'anneau_taureau',     			name:"Anneau du Taureau",              	set:'taureau',      rarity:'commun',    cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set des Taureaux/Anneau du Taureau.png",                        stats:{degats:2, sante:10} },
  { id:'anneau_ours',     				name:"Anneau de l'Ours",              	set:'ours',        	rarity:'commun',    cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set des Ours/Anneau de l'Ours.png",                             stats:{crit_comp_degats:1, defense:0.5, sante:5} },
  { id:'anneau_ferraille',     			name:"Anneau de Ferraille",             set:'ferraille',    rarity:'commun',    cat:'anneau',    	tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Anneau de Ferraille.png",                      stats:{defense:0.5, sante:10} },
  { id:'anneau_bauxite',     			name:"Anneau de Bauxite",            	set:'bauxite',    	rarity:'rare',    	cat:'anneau',    	tier:2, lvl:12, img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Anneau de Bauxite.png",                      	stats:{defense:1, sante:10} },
  { id:'anneau_aventurier',     		name:"Anneau de l'Aventurier",           			    	rarity:'rare',    	cat:'anneau',    	tier:2, lvl:13, img:"",                      	stats:{vitesse_attaque:0.1, crit_comp_degats:1, defense:1, soin_bonus:1, sante:1, mana:1, stamina:1, regen_sante:0.1, regen_mana:0.1, regen_stamina:0.1} },
  { id:'anneau_harpie_enflammee',     	name:"Anneau de la Harpie Enflammée",  				    	rarity:'epique',    cat:'anneau',    	tier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Enflammée.png",                      		stats:{degat_arme:7.5, vol_vie:2, sante:15} },
  { id:'anneau_harpie_ecrasee',     	name:"Anneau de la Harpie Écrasée",  				    	rarity:'epique',    cat:'anneau',    	tier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Écrasée.png",                      			stats:{defense:2.5, reduction_degats:2.5, maitrise_bloc:5, puissance_bloc:1} },
  { id:'anneau_harpie_noyee',     		name:"Anneau de la Harpie Noyée",  				    		rarity:'epique',    cat:'anneau',    	tier:2, lvl:13, img:"../img/compendium/textures/trinkets/P2/Anneau de la Harpie Noyée.png",                      			stats:{degats_competence:7.5, omnivamp:1.5, mana:10, stamina:5} },
  { id:'anneau_onyx_impur',     		name:"Anneau d'Onyx Impur'",            set:'onyx_impur',   rarity:'epique',   	cat:'anneau',    	tier:2, lvl:13, img:"",                     stats:{crit_chance:1, defense:1.5, sante:10} },
  { id:'anneau_onyx_pur',     			name:"Anneau d'Onyx Pur'",            	set:'onyx_pur',   	rarity:'legendaire',cat:'anneau',    	tier:2, lvl:14, img:"",                     	stats:{crit_chance:2, crit_degats:1, defense:1, sante:20} },
  /* ══ Events ══ */
  { id:'anneau_amour',    				name:"Anneau d'Amour",          			    			rarity:'',   	 	cat:'anneau',     	tier:0, lvl:10, img:"",                        		stats:{crit_chance:5, crit_degats:5, crit_comp_chance:5, crit_comp_degats:5, sante:15} },
  /* ══ Amulettes ══ */
  /* ══ Palier 1 ══ */
  { id:'amulette_cuivre', 				name:"Amulette de Cuivre",     			set:'cuivre',    	rarity:'commun',    cat:'amulette',  	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Amulette de Cuivre.png",                      	stats:{sante:5} },
  { id:'amulette_bois',   				name:"Amulette des Bois",       		set:'sylve',     	rarity:'commun',    cat:'amulette',  	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Amulette des Bois.png",                     	stats:{degats_competence:2.5, mana:2.5, stamina:1.5} },
  { id:'collier_albal',   				name:"Collier de Albal",        		set:'loup',      	rarity:'rare',      cat:'amulette',  	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set Loup Faiblard/Collier d'Albal.png",                    		stats:{crit_chance:5, vitesse_deplacement:0.25} },
  { id:'amulette_gluante',   			name:"Amulette Gluante",        		set:'slime',     	rarity:'commun',    cat:'amulette',  	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Amulette Gluante.png",           		stats:{soin_bonus:1, regen_sante:0.1} },
  { id:'amulette_fer',    				name:"Amulette de Fer",          		set:'fer',       	rarity:'rare',      cat:'amulette',  	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Amulette de Fer.png",                           		stats:{defense:1, sante:5} },
  { id:'amulette_squelletique',  		name:"Amulette Squelettique",   		set:'squelette', 	rarity:'rare',      cat:'amulette',  	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Amulette Squelettique.png",      		stats:{degats_competence:1, mana:4, stamina:2} },
  /* ══ Palier 2 ══ */
  { id:'collier_acamiel',  				name:"Collier Acamiel",   			 						rarity:'rare',      cat:'amulette',  	tier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Collier Acamiel.png",      									stats:{vitesse_attaque:0.1, soin_bonus:1} },
  { id:'amulette_ferraille',  			name:"Amulette de Ferraille",  			set:'ferraille', 	rarity:'commun',    cat:'amulette',  	tier:2, lvl:11,  img:"../img/compendium/textures/trinkets/P2/Set de Ferraille/Amulette de Ferraille.png",      				stats:{defense:1, sante:10} },
  { id:'amulette_bauxite',  			name:"Amulette de Bauxite",  			set:'bauxite', 		rarity:'rare',    	cat:'amulette',  	tier:2, lvl:12,  img:"../img/compendium/textures/trinkets/P2/Set de Bauxite/Amulette de Bauxite.png",      				stats:{defense:1.5, sante:10} },
  /* ══ Events ══ */
  { id:'collier_amour',    				name:"Collier d'Amour",          			    			rarity:'',   	 	cat:'amulette',     tier:0, lvl:10, img:"",                        		stats:{sante:15, mana:5, stamina:5} },
  /* ══ Gants ══ */
  /* ══ Palier 1 ══ */
  { id:'gants_cuivre',    				name:"Gants de Cuivre",          		set:'cuivre',    	rarity:'commun',    cat:'gants',     	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Gants de Cuivre.png",                        		stats:{degats:1} },
  { id:'gants_cerfs',     				name:"Gants des Cerfs",          		set:'cerf',      	rarity:'commun',    cat:'gants',     	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Gants des Cerfs.png",              		stats:{degats_competence:2} },
  { id:'gants_bandit',    				name:"Gants de Bandit",                           			rarity:'commun',    cat:'gants',     	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Gants de Bandit.png",                                      		stats:{vitesse_attaque:0.1} },
  { id:'gants_osseux',        			name:"Gants Osseux",              		set:'squelette', 	rarity:'rare',      cat:'gants',     	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set Squelette Poussiéreux/Gants Osseux.png",              		stats:{defense:0.5} },
  { id:'gants_fer',       				name:"Gants de Fer",              		set:'fer',       	rarity:'rare',      cat:'gants',     	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Gants de Fer.png",                             		stats:{degats:1.5} },
  /* ══ Palier 2 ══ */
  /* ══ Events ══ */
  { id:'moufles_noel_vertes',    		name:"Moufles de Noël Vertes",          			    	rarity:'',   	 	cat:'gants',     	tier:0, lvl:10, img:"",                        		stats:{esquive:10, soin_bonus:5, sante:5, regen_sante:0.3, regen_mana:0.4, regen_stamina:0.2} },
  /* ══ Bracelets ══ */
  /* ══ Palier 1 ══ */
  { id:'bracelet_cuivre', 				name:"Bracelet de Cuivre",        		set:'cuivre',    	rarity:'commun',    cat:'bracelet',  	tier:1, lvl:3,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Bracelet de Cuivre.png",                    		stats:{sante:5} },
  { id:'bracelet_fer',    				name:"Bracelet de Fer",            		set:'fer',       	rarity:'rare',      cat:'bracelet', 	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Bracelet de Fer.png",                         		stats:{sante:5, defense:1} },
  { id:'bracelet_sylvestre',   			name:"Bracelet Sylvestre",         		set:'sylve',     	rarity:'commun',    cat:'bracelet', 	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Bracelet Sylvestre.png",                 		stats:{regen_sante:0.2, regen_mana:0.2, regen_stamina:0.2} },
  { id:'bracelet_araignee',   			name:"Bracelet d'Araignée",                         		rarity:'rare',      cat:'bracelet', 	tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Bracelet d'Araignée.png",                               		stats:{esquive:2.5, vitesse_deplacement:0.5} },
  { id:'bracelet_gluant',   			name:"Bracelet Gluant",            		set:'slime',     	rarity:'rare',      cat:'bracelet', 	tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Bracelet Gluant.png",         		stats:{soin_bonus:1, sante:5, regen_sante:0.1} },
  { id:'bracelet_cerf',   				name:"Bracelet des Cerfs",          	set:'cerf',      	rarity:'rare',      cat:'bracelet',		tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set des Cerfs Paisibles/Bracelet des Cerfs.png",        		stats:{mana:2, stamina:1, regen_mana:0.2, regen_stamina:0.2} },
  { id:'bracelet_glace',  				name:"Bracelet de Glace",                            		rarity:'epique',    cat:'bracelet',		tier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Bracelet de Glace.png",                                 		stats:{degats_competence:5, regen_mana:0.3, regen_stamina:0.2} },
  /* ══ Palier 2 ══ */
  /* ══ Events ══ */
  { id:'bracelet_yuleck',    			name:"Bracelet de Yuleck",          			    		rarity:'',   	 	cat:'bracelet',     tier:0, lvl:10, img:"",                        		stats:{soin_bonus:2, sante:7, regen_sante:0.3, vitesse_deplacement:-0.5} },
  /* ══ Artefacts ══ */
  { id:'manteau_vole',    				name:"Manteau Volé",                                  		rarity:'commun',    cat:'artefact',		tier:1, lvl:5,  img:"../img/compendium/textures/trinkets/P1/Manteau Volé.png",                                    			stats:{defense:1.5, sante:10} },
  { id:'lien_sylve',      				name:"Lien de la Sylve",            	set:'sylve',     	rarity:'legendaire',cat:'artefact',		tier:1, lvl:5, 	img:"../img/compendium/textures/trinkets/P1/Set de la Sylve/Lien de la Sylve.png",                 			stats:{sante:10, mana:10, stamina:5} },
  { id:'piece_cuivre',    				name:"Pièce de Cuivre",              	set:'cuivre',    	rarity:'commun',    cat:'artefact',		tier:1, lvl:7,  img:"../img/compendium/textures/trinkets/P1/Set de Cuivre/Pièce de Cuivre.png",                   			stats:{defense:1} },
  { id:'piece_fer',       				name:"Pièce de Fer",                  	set:'fer',       	rarity:'rare',      cat:'artefact',		tier:1, lvl:9,  img:"../img/compendium/textures/trinkets/P1/Set de Fer/Pièce de Fer.png",                        			stats:{defense:1, sante:5} },
  { id:'collier_aragorn', 				name:"Collier d'Aragorn",                              		rarity:'epique',    cat:'artefact',		tier:1, lvl:9, 	img:"../img/compendium/textures/trinkets/P1/Collier de Aragorn.png",                             			stats:{reduction_degats:3, reduction_chutes:25, esquive:3} },
  { id:'manteau_minuit',  				name:"Manteau de Minuit",                              		rarity:'godlike',   cat:'artefact',		tier:1, lvl:10, img:"../img/compendium/textures/trinkets/P1/Manteau de Minuit.png",                              			stats:{degats:5, esquive:15, mana:25, stamina:15, vitesse:2} },
  /* ══ Palier 2 ══ */
  { id:'plume_azur',  					name:"Plume Azur",                              			rarity:'rare',   	cat:'artefact',		tier:2, lvl:11, img:"../img/compendium/textures/trinkets/P2/Plume Azur.png",                              					stats:{degats_competence:3, omnivamp:1, mana:5, stamina:2.5} },
  /* ══ Events ══ */
  { id:'bracelet_rafales',    			name:"Bracelet des Rafales",          			    		rarity:'',   	 	cat:'artefact',     tier:0, lvl:10, img:"",                        		stats:{esquive:2.5, sante:5, mana:5, stamina:5, vitesse_deplacement:0.5} },
  { id:'couronne_solstice',    			name:"Couronne du Solstice",          			    		rarity:'',   	 	cat:'artefact',     tier:0, lvl:10, img:"",                        		stats:{hate:5, mana:5, stamina:2.5} },

  /* ══ Armures ══ */
  { id:'tunique_deb',     				name:"Tunique du Débutant",                            		rarity:'commun',    cat:'plastron',  	tier:1, lvl:1,  img:"../img/compendium/textures/armors/chestplate_debutant.png", 						stats:{sante:[12,15]} },
  { id:'jambieres_deb',   				name:"Jambières du Débutant",                          		rarity:'commun',    cat:'jambières', 	tier:1, lvl:1,  img:"../img/compendium/textures/armors/leggings_debutant.png", 							stats:{sante:[7,10]} },
  { id:'bottes_deb',      				name:"Bottes du Débutant",                             		rarity:'commun',    cat:'bottes',    	tier:1, lvl:1,  img:"../img/compendium/textures/armors/boots_debutant.png", 							stats:{sante:[5,7]} },
  { id:'tunique_ika',     				name:"Tunique d'Ika",          			set:'ika',          rarity:'commun',    cat:'plastron',  	tier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_ika.png", 							stats:{sante:[23,25.99], defense:[0.7,1.2]}, classes:['guerrier'] },
  { id:'jambieres_ika',   				name:"Jambières d'Ika",        			set:'ika',          rarity:'commun',    cat:'jambières', 	tier:1, lvl:3,  img:"../img/compendium/textures/armors/leggings_ika.png", 								stats:{sante:[20,25], defense:[0.6,1]}, classes:['guerrier'] },
  { id:'bottes_ika',      				name:"Bottes d'Ika",            		set:'ika',          rarity:'commun',    cat:'bottes',    	tier:1, lvl:3,  img:"../img/compendium/textures/armors/boots_ika.png", 									stats:{sante:[17,20], defense:[0.4,0.8]}, classes:['guerrier'] },
  { id:'casque_titan',    				name:"Casque du Titan",          		set:'titan',        rarity:'rare',      cat:'casque',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/helmet_titan.png",        						stats:{sante:[30,35], defense:[1.2,1.6]}, classes:['guerrier'] },
  { id:'plastron_titan',  				name:"Plastron du Titan",        		set:'titan',        rarity:'rare',      cat:'plastron',  	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_titan.png",    						stats:{sante:[34,38.99], defense:[3.2,3.7]}, classes:['guerrier'] },
  { id:'jambieres_titan', 				name:"Jambières du Titan",       		set:'titan',        rarity:'rare',      cat:'jambières', 	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_titan.png",      						stats:{sante:[32,37], defense:[1.4,1.92]}, classes:['guerrier'] },
  { id:'bottes_titan',    				name:"Bottes du Titan",           		set:'titan',        rarity:'rare',      cat:'bottes',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_titan.png",          						stats:{sante:[27,31], defense:[0.9,1.4]}, classes:['guerrier'] },
  { id:'casque_gard',     				name:"Casque du Gardien",         		set:'gardien',      rarity:'epique',    cat:'casque',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_gardien.png", 							stats:{sante:[30,35], defense:[2,2.5]}, classes:['guerrier'] },
  { id:'plastron_gard',   				name:"Plastron du Gardien",       		set:'gardien',      rarity:'epique',    cat:'plastron',  	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_gardien.png", 						stats:{sante:[34,40], defense:[3.5,4], 'Emplacement de Runes':2}, classes:['guerrier'] },
  { id:'jambieres_gar',   				name:"Jambières du Gardien",      		set:'gardien',      rarity:'epique',    cat:'jambières', 	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_gardien.png", 							stats:{sante:[32,37], defense:[3,3.5]}, classes:['guerrier'] },
  { id:'bottes_gard',     				name:"Bottes du Gardien",          		set:'gardien',      rarity:'epique',    cat:'bottes',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_gardien.png", 								stats:{sante:[28,33], defense:[1.6,2]}, classes:['guerrier'] },
  { id:'tunique_tacti',   				name:"Tunique Tactique",           		set:'tactique',     rarity:'commun',    cat:'plastron',  	tier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_tactique.png",  						stats:{sante:[21,25], defense:0.4}, classes:['assassin','archer'] },
  { id:'jambieres_tacti', 				name:"Jambières Tactique",         		set:'tactique',     rarity:'commun',    cat:'jambières', 	tier:1, lvl:3,  img:"../img/compendium/textures/armors/leggings_tactique.png",    						stats:{sante:[17,21], defense:0.4}, classes:['assassin','archer'] },
  { id:'bottes_tacti',    				name:"Bottes Tactique",             	set:'tactique',     rarity:'commun',    cat:'bottes',    	tier:1, lvl:3,  img:"../img/compendium/textures/armors/boots_tactique.png",        						stats:{sante:[15,18], defense:0.3}, classes:['assassin','archer'] },
  { id:'tunique_ninja',   				name:"Tunique du Ninja",            	set:'ninja',        rarity:'rare',      cat:'plastron',  	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_ninja.png",     						stats:{sante:[29,34], defense:[1.5,2.3]}, classes:['assassin'] },
  { id:'jambieres_ninja', 				name:"Jambières du Ninja",          	set:'ninja',        rarity:'rare',      cat:'jambières', 	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_ninja.png",       						stats:{sante:[23,27], defense:[0.9,1.4]}, classes:['assassin'] },
  { id:'bottes_ninja',    				name:"Bottines du Ninja",            	set:'ninja',        rarity:'rare',      cat:'bottes',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_ninja.png",           						stats:{sante:[18,23], defense:[0.8,1]}, classes:['assassin'] },
  { id:'tunique_chass',   				name:"Plastron du Chasseur",         	set:'chasseur',     rarity:'rare',      cat:'plastron',  	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_chasseur.png",  						stats:{sante:[25,30], defense:[1.3,2]}, classes:['archer'] },
  { id:'jambieres_chass', 				name:"Jambières du Chasseur",        	set:'chasseur',     rarity:'rare',      cat:'jambières', 	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_chasseur.png",    						stats:{sante:[20,24], defense:[0.7,1.2]}, classes:['archer'] },
  { id:'bottes_chass',    				name:"Bottines du Chasseur",          	set:'chasseur',     rarity:'rare',      cat:'bottes',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_chasseur.png",        						stats:{sante:[16,20], defense:[0.7,0.9]}, classes:['archer'] },
  { id:'casque_her',      				name:"Casque du Héraut",              	set:'heraut',       rarity:'epique',    cat:'casque',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_heraut.png", 								stats:{sante:[26,31], defense:[2.7,3.2]}, classes:['assassin','archer'] },
  { id:'plastron_her',    				name:"Plastron du Héraut",            	set:'heraut',       rarity:'epique',    cat:'plastron',  	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_heraut.png", 							stats:{sante:[32,37], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['assassin','archer'] },
  { id:'jambieres_her',   				name:"Jambières du Héraut",           	set:'heraut',       rarity:'epique',    cat:'jambières', 	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_heraut.png", 							stats:{sante:[23,27], defense:[2.9,3.4]}, classes:['assassin','archer'] },
  { id:'bottes_her',      				name:"Bottes du Héraut",               	set:'heraut',       rarity:'epique',    cat:'bottes',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_heraut.png", 								stats:{sante:[18,23], defense:[2.8,3]}, classes:['assassin','archer'] },
  { id:'tunique_spect',   				name:"Tunique Spectral",               	set:'spectral',     rarity:'commun',    cat:'plastron',  	tier:1, lvl:3,  img:"../img/compendium/textures/armors/chestplate_spectral.png", 						stats:{sante:[15,19], defense:0.4}, classes:['mage','shaman'] },
  { id:'jambieres_spect', 				name:"Jambières Spectral",             	set:'spectral',     rarity:'commun',    cat:'jambières', 	tier:1, lvl:3, 	img:"../img/compendium/textures/armors/leggings_spectral.png", 							stats:{sante:[13,17], defense:0.4}, classes:['mage','shaman'] },
  { id:'bottes_spect',    				name:"Bottes Spectral",                 set:'spectral',     rarity:'commun',    cat:'bottes',    	tier:1, lvl:3, 	img:"../img/compendium/textures/armors/boots_spectral.png", 							stats:{sante:[10,13], defense:0.3}, classes:['mage','shaman'] },
  { id:'robe_sorc',       				name:"Robe du Sorcier",                 set:'sorcier',      rarity:'rare',      cat:'plastron',  	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_sorcier.png", 						stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['mage'] },
  { id:'pantalon_sorc',   				name:"Pantalon du Sorcier",             set:'sorcier',      rarity:'rare',      cat:'jambières', 	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_sorcier.png", 							stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['mage'] },
  { id:'sandales_sorc',   				name:"Sandales du Sorcier",             set:'sorcier',      rarity:'rare',      cat:'bottes',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_sorcier.png", 								stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['mage'] },
  { id:'robe_magic',      				name:"Robe du Magicien",                set:'magicien',     rarity:'rare',      cat:'plastron',  	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/chestplate_magicien.png", 						stats:{sante:[27,32], defense:[1.5,2.3]}, classes:['shaman'] },
  { id:'pantalon_magic',  				name:"Pantalon du Magicien",            set:'magicien',     rarity:'rare',      cat:'jambières', 	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/leggings_magicien.png",   						stats:{sante:[20,24], defense:[0.9,1.4]}, classes:['shaman'] },
  { id:'sandales_magic',  				name:"Sandales du Magicien",            set:'magicien',     rarity:'rare',      cat:'bottes',    	tier:1, lvl:7, 	img:"../img/compendium/textures/armors/boots_magicien.png",       						stats:{sante:[14,18.72], defense:[0.7,0.9]}, classes:['shaman'] },
  { id:'casque_fau',      				name:"Casque de la Faucheuse",          set:'faucheuse',    rarity:'epique',    cat:'casque',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/helmet_faucheuse.png", 							stats:{sante:[16,20], defense:[2.8,3.4]}, classes:['mage','shaman'] },
  { id:'plastron_fau',    				name:"Plastron de la Faucheuse",        set:'faucheuse',    rarity:'epique',    cat:'plastron',  	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/chestplate_faucheuse.png", 						stats:{sante:[27,32], defense:[3.5,4.3], 'Emplacement de Runes':2}, classes:['mage','shaman'] },
  { id:'jambieres_fau',   				name:"Jambières de la Faucheuse",       set:'faucheuse',    rarity:'epique',    cat:'jambières', 	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/leggings_faucheuse.png", 						stats:{sante:[20,24], defense:[2.9,3.4]}, classes:['mage','shaman'] },
  { id:'bottes_fau',      				name:"Bottes de la Faucheuse",          set:'faucheuse',    rarity:'epique',    cat:'bottes',    	tier:1, lvl:9, 	img:"../img/compendium/textures/armors/boots_faucheuse.png", 							stats:{sante:[10.2,13.8], defense:[2.7,2.9]}, classes:['mage','shaman'] },
  { id:'bottes_rev',      				name:"Bottes du Revenant",                                  rarity:'legendaire',cat:'bottes',    	tier:1, lvl:5, 	img:"../img/compendium/textures/armors/bottes_du_revenant.png",   						stats:{vitesse_deplacement:5} },
  { id:'bottes_ecu',      				name:"Bottes de l'Écume",                                   rarity:'legendaire',cat:'bottes',    	tier:1, lvl:5, 	img:"../img/compendium/textures/armors/bottes_decume.png",         						stats:{'Agilité Aquatique':10} },
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