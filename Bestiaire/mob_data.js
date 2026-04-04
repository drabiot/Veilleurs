/* ══════════════════════════════════
   DONNÉES — MONSTRES
══════════════════════════════════ */
const MOBS = [
	//#region Palier 1
  {
    id: 'sanglier_corrompu',
    name: 'Sanglier Corrompu',
    type: 'monstre',
    behavior: 'neutre',
		inCodex: true,
    palier: 1,
    difficulty: 1,
    region: 'Zone des Sangliers',
    regionId: 'm1z2',
    img: '',
    lore: "Une bête sauvage issue des forêts du premier palier. Il charge sans relâche, animé d'une rage primitive.",
    attacks: [
      { name: 'Charge du Sanglier',   desc: 'Fonce sur la cible et les pousse.', dmg: '?' },
    ],
    loot: [
      { id: 'viande_de_sanglier', chance: 100, qty:'1-3'  },
      { id: 'peau_de_sanglier', chance: 60 },
      { id: 'cristal_corrompu', chance: 50 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/head.json',
				position: [0.5117, -0.0797, 0.8892],
				rotation: [0.2793, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/body.json',
				position: [0.5019, -0.3871, 0.3977],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/jaw.json',
				position: [0.508, -0.1923, 1.322],
				rotation: [0.0524, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_back_leg.json',
				position: [-0.0401, -0.3559, -0.47],
				rotation: [0.7156, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_ear.json',
				position: [-0.1708, 0.2346, 1.2138],
				rotation: [0, 3.1416, 0.3491],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_eye.json',
				position: [0.7074, -0.1535, 1.2661],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_front_leg.json',
				position: [0.9368, -0.0746, 0.6592],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/neck.json',
				position: [0.4984, 0.7619, 1.3353],
				rotation: [-0.9338, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_back_leg.json',
				position: [0.9606, 0.2633, 0.1216],
				rotation: [-0.6021, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_ear.json',
				position: [1.127, 0.5687, 1.2134],
				rotation: [0, 3.1416, -0.3491],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_eye.json',
				position: [0.3094, -0.1535, 1.2647],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_front_leg.json',
				position: [0.0668, 0.1709, 0.8881],
				rotation: [-0.384, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/tail.json',
				position: [0.5006, -0.0419, -0.3206],
				rotation: [0, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 3.7,
			hauteur: 0,
    	"capture": { "theta": 0.52, "phi": 1.22 }
		}
  },
  {
    id: 'pumba_corrompu',
    name: 'Pumba Corrompu',
    type: 'boss',
    behavior: 'neutre',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Zone des Sangliers',
    regionId: 'm1boss1',
    img: '',
    spawnTime: null,
    lore: "Une bête sauvage issue des forêts du premier palier. Il charge sans relâche, animé d'une rage primitive.",
    attacks: [
      { name: 'Charge du Sanglier',   desc: 'Fonce sur la cible et les pousse.', dmg: '?' },
    ],
    loot: [
      { id: 'viande_de_sanglier', chance: 100, qty:'1-3'  },
      { id: 'peau_de_sanglier', chance: 100 },
      { id: 'cristal_corrompu', chance: 100 },
	  { id: 'anneau_pumba'},
    ],
		spawnTime: '1m 30s',
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/head.json',
				position: [0.5117, -0.0797, 0.8892],
				rotation: [0.2793, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/body.json',
				position: [0.5019, -0.3871, 0.3977],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/jaw.json',
				position: [0.508, -0.1923, 1.322],
				rotation: [0.0524, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_back_leg.json',
				position: [-0.0401, -0.3559, -0.47],
				rotation: [0.7156, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_ear.json',
				position: [-0.1708, 0.2346, 1.2138],
				rotation: [0, 3.1416, 0.3491],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_eye_combat.json',
				position: [0.7074, -0.1535, 1.2661],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/left_front_leg.json',
				position: [0.9368, -0.0746, 0.6592],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/neck.json',
				position: [0.4984, 0.7619, 1.3353],
				rotation: [-0.9338, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_back_leg.json',
				position: [0.9606, 0.2633, 0.1216],
				rotation: [-0.6021, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_ear.json',
				position: [1.127, 0.5687, 1.2134],
				rotation: [0, 3.1416, -0.3491],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_eye_combat.json',
				position: [0.3094, -0.1535, 1.2647],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/right_front_leg.json',
				position: [0.0668, 0.1709, 0.8881],
				rotation: [-0.384, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/frenzied_boar/tail.json',
				position: [0.5006, -0.0419, -0.3206],
				rotation: [0, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 2.9,
			hauteur: 0,
    	"capture": { "theta": 0.52, "phi": 1.22 }
		}
  },
  {
    id: 'loup_sinistre_blanc',
    name: 'Loup Sinistre Blanc',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 1,
    region: 'Vallée des Loups',
    regionId: 'm1z1',
    img: '',
    lore: "Gardiens de la Vallée des Loups. Leurs hurlements glacent le sang et donnent des frissons.",
    attacks: [
      { name: 'Saut Lupin',   desc: 'Saute sur sa cible pour la mordre violemment.', dmg: '?' },
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 60 },
      { id: 'crocs_de_loup', chance: 30 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/head.json',
				position: [0.462, 0.405, 0.9796],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/torso.json',
				position: [0.4647, 0.2426, 0.0745],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/yaw.json',
				position: [0.4614, 0.0793, 1.0066],
				rotation: [0.384, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/leftarm.json',
				position: [0.6441, 0.3143, 0.5971],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/leftarm_low.json',
				position: [0.7224, 0.0175, 0.5656],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/leftleg.json',
				position: [0.6532, 0.3154, 0.1443],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/leftleg_low.json',
				position: [0.2989, -0.1332, 0.0859],
				rotation: [0.1047, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/rightarm.json',
				position: [0.3168, 0.2633, 0.5549],
				rotation: [0.1396, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/rightarm_low.json',
				position: [0.2263, 0.0175, 0.4958],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/rightleg.json',
				position: [0.3248, 0.3154, 0.1057],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/rightleg_low.json',
				position: [0.6305, -0.1332, 0.0302],
				rotation: [0.1047, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/whitewolf/tail.json',
				position: [0.4505, 0.1278, -0.4807],
				rotation: [0.829, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 3,
			hauteur: 0,
			"capture": { "theta": -0.52, "phi": 1.22 }
		}
  },
  {
    id: 'loup_sinistre_noir',
    name: 'Loup Sinistre Noir',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 1,
    region: 'Vallée des Loups',
    regionId: 'm1z1',
    img: '',
    lore: "Gardiens de la Vallée des Loups. Leurs hurlements glacent le sang et donnent des frissons.",
    attacks: [
      { name: 'Saut Lupin',   desc: 'Saute sur sa cible pour la mordre violemment.', dmg: '?' },
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 60 },
      { id: 'crocs_de_loup', chance: 30 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/head.json',
				position: [0.462, 0.405, 0.9796],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/torso.json',
				position: [0.4647, 0.2426, 0.0745],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/yaw.json',
				position: [0.4614, 0.0793, 1.0066],
				rotation: [0.384, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/leftarm.json',
				position: [0.6441, 0.3143, 0.5971],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/leftarm_low.json',
				position: [0.7224, 0.0175, 0.5656],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/leftleg.json',
				position: [0.6532, 0.3154, 0.1443],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/leftleg_low.json',
				position: [0.2989, -0.1332, 0.0859],
				rotation: [0.1047, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/rightarm.json',
				position: [0.3168, 0.2633, 0.5549],
				rotation: [0.1396, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/rightarm_low.json',
				position: [0.2263, 0.0175, 0.4958],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/rightleg.json',
				position: [0.3248, 0.3154, 0.1057],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/rightleg_low.json',
				position: [0.6305, -0.1332, 0.0302],
				rotation: [0.1047, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/blackwolf/tail.json',
				position: [0.4505, 0.1278, -0.4807],
				rotation: [0.829, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 3,
			hauteur: 0,
			"capture": { "theta": 0.52, "phi": 1.22 }
		}
  },
  {
    id: 'albal',
    name: 'Albal',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Vallée des Loups',
    regionId: 'm1boss2',
    img: '',
    spawnTime: null,
    lore: "Un loup solitaire aux yeux d'argent glacés. Son passage laisse une brume et le silence.",
    attacks: [
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 100 },
      { id: 'crocs_de_loup', chance: 70 },
	  { id: 'crocs_de_albal', chance: 20 },
    ],
		spawnTime: '4m',
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/head.json',
				position: [0.462, 0.405, 0.9796],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/torso.json',
				position: [0.4647, 0.2426, 0.0745],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/yaw.json',
				position: [0.4614, 0.0793, 1.0066],
				rotation: [0.384, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/leftarm.json',
				position: [0.6441, 0.3143, 0.5971],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/leftarm_low.json',
				position: [0.7224, 0.0175, 0.5656],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/leftleg.json',
				position: [0.6532, 0.3154, 0.1443],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/leftleg_low.json',
				position: [0.2989, -0.1332, 0.0859],
				rotation: [0.1047, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/rightarm.json',
				position: [0.3168, 0.2633, 0.5549],
				rotation: [0.1396, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/rightarm_low.json',
				position: [0.2263, 0.0175, 0.4958],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/rightleg.json',
				position: [0.3248, 0.3154, 0.1057],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/rightleg_low.json',
				position: [0.6305, -0.1332, 0.0302],
				rotation: [0.1047, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/evilwolf/tail.json',
				position: [0.4505, 0.1278, -0.4807],
				rotation: [0.829, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 2.3,
			hauteur: 0
		}
  },
  {
    id: 'nephentes',
    name: 'Nephentes',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Champs de Mizunari',
    regionId: 'm1z3',
    img: '../img/mobs/P1/nephentes.png',
    lore: "Cette plante carnivore géante se nourrit de chair et de sang. Ses lianes s'enroulent sans bruit, avant de refermer son piège mortel. Même les aventuriers aguerris évitent ses racines traînantes.",
    attacks: [
    ],
    loot: [
      { id: 'spore_corrompu', chance: 50 },
      { id: 'fragment_de_feuille', chance: 45 },
    ],
  },
  {
    id: 'mini_treant',
    name: 'Mini Tréant',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 1,
    region: 'Maréage Putride',
    regionId: 'm1z4',
    img: '',
    lore: "Petit gardien de la forêt, il défend les lieux sacrés avec hargne. Sous ses racines courtes dort une volonté de fer.",
    attacks: [
      { name: 'Morsure Tréante',   desc: 'Mord violemment sa cible avec ses écorces.', dmg: '?' },
    ],
    loot: [
      { id: 'pousse_de_sylve', chance: 40 },
      { id: 'eclat_de_bois_magique', chance: 30 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/head.json',
				position: [0.5062, -0.2792, 0.1669],
				rotation: [0.2793, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/jaw.json',
				position: [0.4899, -0.0225, 0.2199],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/left_eye.json',
				position: [0.321, -0.142, 0.728],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/left_leg.json',
				position: [0.9123, -0.1516, -0.4196],
				rotation: [0.384, -1.1606, 0.7156],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/right_eye.json',
				position: [0.6378, -0.142, 0.728],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_entling/right_leg.json',
				position: [0.0315, 0.0476, 0.9191],
				rotation: [-0.4974, 3.1416, 0.2793],
				scale: 1
			}
		],
		camera: {
			distance: 3.3,
			hauteur: 0
		}
  },
  {
    id: 'guerrier_treant',
    name: 'Guerrier Tréant',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'm1z4',
    img: '',
    lore: "Forgé dans l'écorce et la magie, ce tréant veille sur les bois sacrés. Il frappe avec la force d'un vieux chêne, et la colère de la forêt.",
    attacks: [
      { name: 'Soin Sylvain',   desc: 'Se soigne pour chaque coup qu\'il se prends.' },
	  	{ name: 'Coups de Ronce',   desc: 'Abat son épée roncière pour endommager sa cible.', dmg: '?' },
    ],
    loot: [
      { id: 'ecorce_de_titan', chance: 40 },
      { id: 'racine_ancestrale', chance: 30 },
	  	{ id: 'bouclier_sylvestre', chance: 3 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/head.json',
				position: [0.5451, 1.1333, 0.3265],
				rotation: [0.2793, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/bone.json',
				position: [1.421, 1.211, -0.142],
				rotation: [-2.2602, 3.1416, -0.9338],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/jaw.json',
				position: [0.5112, 1.0993, 0.365],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/left_eye.json',
				position: [0.313, 1.239, 0.854],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/left_leg.json',
				position: [0.2745, 0.4231, 0.2828],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/left_arm.json',
				position: [-0.1546, 1.1554, 0.4128],
				rotation: [-0.2793, -3.1416, 0.0524],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/right_eye.json',
				position: [0.717, 1.239, 0.854],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/right_leg.json',
				position: [0.7045, 0.4231, 0.2337],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/right_arm.json',
				position: [1.1603, 1.201, 0.36],
				rotation: [-0.4974, 3.1416, 0.0524],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_warrior/only_body.json',
				position: [0.4866, 0.3601, 0.3176],
				rotation: [0, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 4,
			hauteur: 0,
			"capture": { "theta": 0.52, "phi": 1.22 }
		}
  },
  {
    id: 'treant_elite',
    name: 'Tréant d\'Élite',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'm1z4',
    img: '',
    lore: "Ancien protecteur des forêts oubliées, ce tréant détient une puissance redoutable.",
    attacks: [
      { name: 'Pièges de Ronce',   desc: 'Pose des Pièges immobilisant sa cible si elle marche dessus.' },
	  	{ name: 'Sniper Sylvain',   desc: 'Décoche ses flèches à longue distance de sa cible.', dmg: '?' },
    ],
    loot: [
      { id: 'ecorce_sylvestre', chance: 40 },
      { id: 'corde_darc_sylvestre', chance: 25 },
	  	{ id: 'arc_sylvestre', chance: 2 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/head.json',
				position: [0.5451, 1.1333, 0.3265],
				rotation: [0.2793, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/arrow.json',
				position: [0.1736, 1.3316, 1.6916],
				rotation: [-1.2654, 3.1416, 0.0524],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/jaw.json',
				position: [0.5112, 1.0993, 0.365],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/left_eye.json',
				position: [0.313, 1.239, 0.854],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/left_leg.json',
				position: [0.2745, 0.4231, 0.2828],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/left_arm.json',
				position: [0.9149, 0.4194, 0.8838],
				rotation: [-1.3788, -1.8151, 0],
				scale: 2
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/right_eye.json',
				position: [0.717, 1.239, 0.854],
				rotation: [0.2793, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/right_leg.json',
				position: [0.7045, 0.421, 0.2337],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/right_arm.json',
				position: [0.9687, 1.5551, 0.6757],
				rotation: [-1.1606, 3.1416, 0.384],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/only_body.json',
				position: [0.4884, 0.3601, 0.3753],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_archer/quiver.json',
				position: [0.187, 0.6581, 0.0026],
				rotation: [0, 3.1416, 0.4974],
				scale: 1
			},
		],
		camera: {
			distance: 4,
			hauteur: 0,
			"capture": { "theta": -0.52, "phi": 1.22 }
		}
  },
  {
    id: 'mage_sylvestre',
    name: 'Mage Sylvestre',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'm1z4',
    img: '../img/mobs/P1/mage_sylvestre.png',
    lore: "Il canalise la magie des arbres anciens. Ses enchantements font fleurir ou pourrir tout ce qu'il touche.",
    attacks: [
      { name: 'Tornade de Feuilles',   desc: 'Fait apparaitre une tornade en dessous de sa cible pour l\'envoyer dans les airs.' },
    ],
    loot: [
      { id: 'brindille_enchantee', chance: 30 },
      { id: 'coeur_de_bois', chance: 20 },
			{ id: 'tissu_spectral', chance: 30 },
			{ id: 'baton_sylvestre_mage', chance: 2 },
			{ id: 'baton_sylvestre_shaman', chance: 2 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/head.json',
				position: [0.5376, 1.6947, 0.4788],
				rotation: [-0.4974, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/bone.json',
				position: [1.4376, 1.719, 1.6084],
				rotation: [-1.2654, 3.1416, -0.2793],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/jaw.json',
				position: [0.5112, 1.4828, 0.365],
				rotation: [-0.0524, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/left_eye.json',
				position: [0.313, 2.158, 0.776],
				rotation: [-0.4974, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/left_leg.json',
				position: [0.2745, 0.4231, 0.2828],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/left_arm.json',
				position: [0.4665, 2.4459, 1.0685],
				rotation: [-1.7104, -2.81, 0.1658],
				scale: 2
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/right_eye.json',
				position: [0.717, 2.158, 0.776],
				rotation: [-0.4974, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/right_leg.json',
				position: [0.7045, 0.421, 0.2337],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/right_arm.json',
				position: [1.1345, 1.7896, 0.2137],
				rotation: [-1.3788, 3.1416, -0.2793],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/only_body.json',
				position: [0.4884, 0.4744, 0.3753],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/rune.json',
				position: [0.5038, 2.3813, 0.655],
				rotation: [-0.4974, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_sage/shine.json',
				position: [0.2543, 3.3185, 1.5242],
				rotation: [-2.042, -2.6965, 0.0524],
				scale: 1
			}
		],
		camera: {
			distance: 4.7,
			hauteur: 0
		}
  },
  {
    id: 'gardien_colossal',
    name: 'Gardien Colossal',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'm1boss3',
    img: '',
    lore: "Forgé dans la pierre et éveillé par la magie ancienne, il garde les terres oubliées contre toute intrusion. Ses pas seuls font trembler la forêt...",
    attacks: [
      { name: 'Ruée de la Forêt',   desc: 'Fonce sur sa cible de toute ses forces.', dmg: '?' },
    ],
    loot: [
      { id: 'mycelium_magique', chance: 20 },
      { id: 'marteau_colosse' },
    ],
		spawnTime: '3m',
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/head.json',
				position: [0.5391, 1.3631, 0.7198],
				rotation: [0.384, 2.81, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/axe.json',
				position: [3.1228, 0.7149, 1.5497],
				rotation: [0.829, -3.0281, -1.1606],
				scale: 2
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/jaw.json',
				position: [0.5035, 1.4268, 0.6686],
				rotation: [0.384, 2.81, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/left_eye.json',
				position: [0.158, 1.526, 1.211],
				rotation: [0.384, 2.81, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/left_leg.json',
				position: [0.194, 0.474, 0.3751],
				rotation: [0.2793, 3.1416, 0.1658],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/left_arm.json',
				position: [0.906, 1.3655, 0.4376],
				rotation: [-1.9286, -0.0524, 0.829],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/right_eye.json',
				position: [0.514, 1.484, 1.31],
				rotation: [0.384, 2.81, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/right_leg.json',
				position: [0.9228, 0.8751, 0.5547],
				rotation: [-0.2793, 3.1416, -0.1658],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/right_arm.json',
				position: [-0.7966, 0.722, -0.0491],
				rotation: [-2.4784, 0.1658, -2.3736],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/only_body.json',
				position: [1.2736, 0.0015, 0.6948],
				rotation: [0, -2.9234, 0],
				scale: 2
			},
			{
				fichier: '../img/compendium/modelengine/models/mob_ent_brute/hammer.json',
				position: [-1.1773, 0.198, -0.1546],
				rotation: [1.1606, 3.1416, 0.0524],
				scale: 1
			}
		],
		camera: {
			distance: 6,
			hauteur: 0,
			"capture": { "theta": -0.52, "phi": 1.22 }
		}
  },
  {
    id: 'petit_slime',
    name: 'Petit Slime',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 1,
    region: 'Vallhat',
    regionId: 'm1z5',
    img: '',
    lore: "Malgré sa petite taille, il bondit sans peur. Inoffensif en apparence, mais têtu comme pas deux. Certains disent qu'il garde un secret au cœur mou.",
    attacks: [
      { name: 'Bond Gluant',   desc: 'Bondit sur sa cible pour lui infliger des dégâts.', dmg: '?' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
    ],
		morceaux: [
    {
      fichier: '../img/compendium/modelengine/models/slime_common/head.json',
      position: [0.5013, -0.4313, 0.6805],
      rotation: [0, -3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_common/body.json',
      position: [0.5, -0.3871, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    }
  ],
  camera: {
    distance: 3,
    hauteur: 0,
		"capture": { "theta": 0.52, "phi": 1.22 }
  }
  },
  {
    id: 'guerrier_slime',
    name: 'Guerrier Slime',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'm1z5',
    img: '',
    lore: "Né d'un amas magique de gelée ancienne, il a appris à manier l'arme comme un vrai guerrier. Il défend son territoire avec une rage inattendue.",
    attacks: [
      { name: 'Bond Tranchant',   desc: 'Bondit sur sa cible pour lui infliger des dégâts avec son épée tranchante.', dmg: '?' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
    ],
		morceaux: [
    {
      fichier: '../img/compendium/modelengine/models/slime_warrior/head.json',
      position: [0.5013, -0.4313, 0.6805],
      rotation: [0, -3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_warrior/body.json',
      position: [0.5, -0.3871, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_warrior/arm.json',
      position: [0.0323, -0.1952, 0.4807],
      rotation: [0, 3.1416, 0],
      scale: 1
    }
  ],
  camera: {
    distance: 3,
    hauteur: 0,
		"capture": { "theta": 0.52, "phi": 1.22 }
  }
  },
  {
    id: 'slime_soigneur',
    name: 'Slime Soigneur',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'm1z5',
    img: '',
    lore: "Ce slime irradie une énergie apaisante. Blessures mineures se referment à son passage. Il fuit le combat, mais sauve les siens dans l'ombre.",
    attacks: [
      { name: 'Soint Gluant',   desc: 'Génère une zone de soin qui soigne les Slimes en zone.' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
	  { id: 'noyau_de_slime', chance: 5 },
    ],
		morceaux: [
    {
      fichier: '../img/compendium/modelengine/models/slime_healer/head.json',
      position: [0.5013, -0.4313, 0.6805],
      rotation: [0, -3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_healer/body.json',
      position: [0.5, -0.3871, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    }
  ],
  camera: {
    distance: 3,
    hauteur: 0,
		"capture": { "theta": 0.52, "phi": 1.22 }
  }
  },
  {
    id: 'slime_magicien',
    name: 'Slime Magicien',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'm1z5',
    img: '',
    lore: "Un slime imprégné d'énergies arcaniques anciennes. Ses attaques lancent des sorts chaotiques et imprévisibles.",
    attacks: [
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
	  { id: 'noyau_de_slime', chance: 5 },
    ],
		morceaux: [
    {
      fichier: '../img/compendium/modelengine/models/slime_mage/head.json',
      position: [0.5013, -0.4313, 0.6805],
      rotation: [0, -3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_mage/body.json',
      position: [0.5, -0.3871, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_mage/arm.json',
      position: [0.0323, -0.1952, 0.4807],
      rotation: [0, 3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_mage/hat.json',
      position: [0.4925, 0.1361, 0.428],
      rotation: [0, 3.1416, 0],
      scale: 1
    }
  ],
  camera: {
    distance: 3,
    hauteur: 0,
		"capture": { "theta": 0.52, "phi": 1.22 }
  }
  },
  {
    id: 'gorbel',
    name: 'Gorbel',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Vallhat',
    regionId: 'm1boss4',
    img: '',
    lore: "Un colosse gélatineux, maître des essaims de slimes. Il écrase tout sur son passage, lentement mais sûrement.",
    attacks: [
		{ name: 'Appétit de Rimuru',   desc: 'Mange sa cible et la rend inerte, tout en se déplaçant.' },
		{ name: 'Roi Slime',   desc: 'Invoque des Petits Slimes pour l\'aider au combat.' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
	  { id: 'noyau_de_slime', chance: 5 },
	  { id: 'essence_de_gorbel', chance: 5 },
    ],
		spawnTime: '10m',
		morceaux: [
    {
      fichier: '../img/compendium/modelengine/models/slime_king/head.json',
      position: [0.5216, 0.491, 0.5821],
      rotation: [0, -3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_king/body.json',
      position: [0.5, -0.3871, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_king/crown.json',
      position: [0.2757, 1.6533, 0.3466],
      rotation: [0, 3.1416, 0],
      scale: 0.44
    },
    {
      fichier: '../img/compendium/modelengine/models/slime_king/stomach.json',
      position: [0.5, -0.2815, 0.5],
      rotation: [0, 3.1416, 0],
      scale: 1
    }
  ],
  camera: {
    distance: 4.2,
    hauteur: 0
  }
  },
  {
    id: 'squelette_epeiste',
    name: 'Squelette Épéiste',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'm1z6',
    img: '../img/mobs/P1/squelette_epeiste.png',
    lore: "Un guerrier tombé jadis au champ d'honneur… Ranimé par magie, il défend éternellement sa lame.",
    attacks: [
		{ name: 'Coup d\'Épée',   desc: 'Asséne un coup d\'épée à sa cible, le ralentissant.', dmg:'?' },
    ],
    loot: [
      { id: 'os_de_squelette', chance: 45 },
	  { id: 'ames_des_ruines', chance: 40 },
	  { id: 'poussiere_dos', chance: 35 },
	  { id: 'epee_osseuse', chance: 5 },
    ],
  },
  {
    id: 'guerrier_squelette',
    name: 'Guerrier Squelette',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'm1z6',
    img: '../img/mobs/P1/guerrier_squelette.png',
    lore: "Ancien soldat revenu d'entre les morts… Il marche sans repos, guidé par une volonté oubliée.",
    attacks: [
		{ name: 'Coup d\'Épée',   desc: 'Asséne un coup d\'épée à sa cible, le ralentissant.', dmg:'?' },
    ],
    loot: [
      { id: 'os_de_squelette', chance: 40 },
	  { id: 'ames_des_ruines', chance: 40 },
	  { id: 'poussiere_dos', chance: 30 },
	  { id: 'epee_osseuse', chance: 7 },
    ],
  },
  {
    id: 'squelette_hallebardier',
    name: 'Squelette Hallebardier',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'm1z6',
    img: '../img/mobs/P1/squelette_hallebardier.png',
    lore: "Un serviteur osseux maniant la hallebarde avec précision. Il garde l'accès à d'anciennes cryptes oubliées.",
    attacks: [
    ],
    loot: [
      { id: 'os_de_squelette', chance: 45 },
	  { id: 'ames_des_ruines', chance: 40 },
	  { id: 'poussiere_dos', chance: 35 },
	  { id: 'os_de_squelette_renforce' },
    ],
  },
  {
    id: 'archer_squelette',
    name: 'Archer Squelette',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'm1d2',
    img: '../img/mobs/P1/archer_squelette.png',
    lore: "Un squelette agile, archer silencieux des couloirs hantés. Ses flèches sifflent dans l'ombre, prêtes à faucher les intrus.",
    attacks: [
		{ name: 'Flêche Cinglante',   desc: 'Avec son arc, décoche une flêche puissante.', dmg:'?' },
    ],
    loot: [
      { id: 'os_de_squelette_renforce', chance: 30 },
	  { id: 'ames_des_ruines', chance: 40 },
	  { id: 'poussiere_dos', chance: 20 },
    ],
  },
  {
    id: 'tank_squelette',
    name: 'Tank Squelette',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'm1d2',
    img: '../img/mobs/P1/tank_squelette.png',
    lore: "Un colosse d'os armé d'un bouclier cabossé. Il avance lentement, mais rien ne semble pouvoir l'arrêter.",
    attacks: [
    ],
    loot: [
      { id: 'os_de_squelette_renforce', chance: 40 },
	  { id: 'poussiere_dos', chance: 30 },
    ],
  },
  {
    id: 'squelette_mage',
    name: 'Squelette Mage',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'm1d2',
    img: '../img/mobs/P1/squelette_mage.png',
    lore: "Un revenant rachitique, mais animé par une magie ancienne et instable. Ses os craquent à chaque incantation, libérant une énergie spectrale dangereuse.",
    attacks: [
		{ name: 'Protection Squelettique',   desc: 'Rend invinsible un allié proche.' },
		{ name: '"Fire Ball"',   desc: 'Utilise toute la puissance de D&D pour lancer une terrible "Fire Ball".', dmg:'?' },
    ],
    loot: [
      { id: 'os_de_squelette_renforce', chance: 40 },
	  { id: 'poussiere_dos', chance: 30 },
	  { id: 'tissu_maudit', chance: 50 },
	  { id: 'baton_squelette_mage' },
	  { id: 'baton_squelette_shaman' },
    ],
  },
  {
    id: 'narax',
    name: 'Narax Squelette Maudit',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Squelette',
    regionId: 'm1d2',
    img: '../img/mobs/P1/narax.png',
    lore: "Ancien général d'une armée déchue, Narax fut ressuscité par une magie interdite. Son armure brisée résonne encore de ses exploits d'antan, hantant les terres maudites. On dit que son regard vide perce jusqu'à l'âme.",
    attacks: [
    ],
    loot: [
      { id: 'coeur_putrefie', chance: 70 },
	  { id: 'baton_squelette_maudit_mage' },
	  { id: 'baton_squelette_maudit_shaman' },
    ],
  },
  {
    id: 'nasgul',
    name: 'Nasgul',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Squelette',
    regionId: 'm1d2',
    img: '../img/mobs/P1/nasgul.png',
    lore: "Entité maudite surgie des ténèbres anciennes, il rôde, invisible, prêt à déchirer l'âme des vivants.",
    attacks: [
			{ name: 'Phase 1 - Général Squelette',   desc: 'Combat à dos de son cheval.'},
			{ name: 'Phase 2 - Champion Squelette',   desc: 'Son cheval défait, il continue le combat à pied.'},
    ],
    loot: [
      { id: 'morceau_de_criniere_spectrale', chance: 2.5 },
	  	{ id: 'eclat_du_sabot_maudit', chance: 1 },
    ],
  },
  {
    id: 'bandit_archer',
    name: 'Bandit Archer',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'm1z7',
    img: '../img/mobs/P1/bandit_archer.png',
    lore: "Un hors-la-loi habile qui préfère frapper de loin.",
    attacks: [
			{ name: 'Flèche Fourbe',   desc: 'Décoche ses flèches sur ses ennemis de façon discrète.', dmg:'?' },
    ],
    loot: [
      { id: 'cuir_use', chance: 40 },
	  	{ id: 'petite_bourse', chance: 25 },
	  	{ id: 'arbalete_bandit' },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/head.json',
				position: [0.7034, 1.2403, 0.1781],
				rotation: [0, -2.6965, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/hip.json',
				position: [0.5, 0.5, 0.5],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/left_arm3.json',
				position: [0.9103, 1.9124, 0.4882],
				rotation: [-1.0821, 3.1416, -0.2618],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/left_leg.json',
				position: [0.7754, 0.6154, 0.4347],
				rotation: [0.1658, 3.1416, -0.384],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/right_arm_1.json',
				position: [0.1517, 1.0057, 0.345],
				rotation: [-0.2793, -2.3736, 0.7156],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_c1/right_leg.json',
				position: [0.055, 0.0901, 0.194],
				rotation: [0.4974, 3.1416, 0.4974],
				scale: 1
			}
		],
		camera: {
			distance: 3.3,
			hauteur: 0 
		}
  },
  {
    id: 'bandit_assassin',
    name: 'Bandit Assassin',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'm1z7',
    img: '',
    lore: "Maître de l'ombre et des lames silencieuses, il ne laisse derrière lui que le vide… et une cible tombée.",
    attacks: [
			{ name: 'Dague Fourbe',   desc: 'Utilise sa dague pour assassiner ses proies dans le dos.', dmg:'?' },
    ],
    loot: [
      { id: 'cuir_use', chance: 30 },
			{ id: 'petite_bourse', chance: 35 },
			{ id: 'dague_bandit' },
		],
    morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/head.json',
				position: [0.3533, 1.131, 0.6397],
				rotation: [0, 2.8362, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/hip.json',
				position: [0.5, 0.5, 0.5],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/left_arm.json',
				position: [0.8735, 0.836, -0.0633],
				rotation: [0.7767, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/right_arm.json',
				position: [0.0357, 1.525, 0.7681],
				rotation: [-0.9774, 3.1416, 0.3578],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/left_leg.json',
				position: [0.343, 0.4, 0.5015],
				rotation: [0, 3.1416, 0.0524],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_a1/right_leg.json',
				position: [0.7388, 0.4, 0.3966],
				rotation: [0.2618, 3.1416, -0.1571],
				scale: 1
			}
		],
		camera: {
			distance: 3,
			hauteur: 0
		}
  },
  {
    id: 'bandit_robuste',
    name: 'Bandit Robuste',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'm1z7',
    img: '../img/mobs/P1/bandit_robuste.png',
    lore: "Ce bandit à la carrure massive bloque les chemins isolés, utilisant sa force brute pour dépouiller les voyageurs.",
    attacks: [
			{ name: 'Force Brute',   desc: 'Manie une batte cloutte pour broyer le crâne de ses victimes.', dmg:'?' },
    ],
    loot: [
      { id: 'cuir_use', chance: 80 },
	 		{ id: 'petite_bourse', chance: 40 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/head.json',
				position: [0.5246, 1.2403, 0.4275],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/hip.json',
				position: [0.5, 0.5, 0.5],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/left_arm.json',
				position: [1.0468, 1.9124, 0.4455],
				rotation: [-1.0821, 3.1416, -0.2618],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/right_arm.json',
				position: [0.4816, 0.3294, 0.2813],
				rotation: [-0.2618, -1.8064, 0.672],
				scale: 1.93
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/left_leg.json',
				position: [0.2226, 0.4734, 0.647],
				rotation: [-0.1571, 3.1416, 0.1571],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/em_bandit_b1/right_leg.json',
				position: [0.7242, 0.4, 0.3878],
				rotation: [0.2618, 3.1416, -0.1571],
				scale: 1
			}
		],
		camera: {
			distance: 3.3,
			hauteur: 0
		}
  },
  {
    id: 'treant_foret',
    name: 'Tréant de la Forêt',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/treant_foret.png',
    lore: "Gardien séculaire enraciné au cœur de la mine de Geldorak. N'approchez qu'en paix, ou affrontez sa colère sylvestre.",
    attacks: [
    ],
  },
  {
    id: 'treant_mal_foret',
    name: 'Tréant Mal de la Forêt',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/treant_mal_foret.png',
    lore: "Gardien séculaire enraciné au cœur de la mine de Geldorak. N'approchez qu'en paix, ou affrontez sa colère sylvestre.",
    attacks: [
    ],
  },
  {
    id: 'plante_devoreuse',
    name: 'Plante Dévoreuse',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/plante_devoreuse.png',
    lore: "Discrète sous ses feuilles luxuriantes, le danger rôde au moindre faux pas... Ses racines enserrent ses proies, lentement, avant de les engloutir sans laisser de trace.",
    attacks: [
    ],
  },
  {
    id: 'vyrmos',
    name: 'Vyrmos',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/vyrmos.png',
    lore: "Entité rampante née des mines de Geldorak, Vyrmos s'imprègne des spores et de la terre humide. Sa peau est couverte de mousse vivante, et son souffle corrompt tout ce qu'il touche.",
    attacks: [
    ],
  },
  {
    id: 'brute_foret',
    name: 'Brute de la Forêt',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/brute_foret.png',	
    lore: "Massive et sauvage, cette créature veille sur la forêt. Elle repousse les intrus à coups de poings dévastateurs. Aucune parole, seulement la force brute de la nature.",
    attacks: [
    ],
  },
  {
    id: 'tornak',
    name: 'Tornak',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'm1d3',
    img: '../img/mobs/P1/tornak.png',
    lore: "Massive et sauvage, cette créature veille sur la forêt. Elle repousse les intrus à coups de poings dévastateurs. Aucune parole, seulement la force brute de la nature.",
    attacks: [
    ],
  },
  {
    id: 'ika',
    name: 'Ika',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'm1z7',
    img: '../img/mobs/P1/ika.png',
    lore: "Cette tortue ancienne erre lentement dans les recoins oubliés du monde. Sa carapace recèle les secrets d'âges passés.",
    attacks: [
		{ name: 'Machoire Béante',   desc: 'Ouvre sa machoire et la ferme à une vitesse éclair quand une proie est sur son passage.', dmg:'?' },
    ],
    loot: [
      { id: 'carapace_dika', chance: 80 },
    ],
  },
  {
    id: 'soldat_dechu',
    name: 'Soldat Déchu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/soldat_dechu.png',
    lore: "Ancien guerrier tombé dans l'oubli, il erre désormais sans but, consumé par la haine. Son armure rouillée résonne au rythme des ses regrets.",
    attacks: [
		{ name: 'Épée Fantomatique',   desc: 'Attaque ses ennemis avec son épée fantomatique.', dmg:'?' },
    ],
    loot: [
      { id: 'piece_metal_enchante', chance: 20 },
    ],
  },
  {
    id: 'guerrier_dechu',
    name: 'Guerrier Déchu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/guerrier_dechu.png',
    lore: "Combattant redoutable autrefois honoré, il fut trahi par les siens et maudit pour l'éternité. Sa lame résonne encore des cris de la trahison.",
    attacks: [
			{ name: 'Vengeance',   desc: 'Se déplace rapidement afin d\'asséner des coups mortels à ses ennemis.'},
			{ name: 'Épée Fantomatique',   desc: 'Attaque ses ennemis avec son épée fantomatique.', dmg:'?' },
    ],
    loot: [
      { id: 'piece_metal_enchante', chance: 20 },
			{ id: 'piece_ame_metal', chance: 25 },
    ],
  },
  {
    id: 'gardien_dechu',
    name: 'Gardien Déchu',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/gardien_dechu.png',
    lore: "Gardien d'un sanctuaire oublié, il a succombé à une force impie corrompant sa volonté. Aujourd'hui, il veille encore... mais pour de mauvaises raisons.",
    attacks: [
    ],
    loot: [
      { id: 'artefact_fallen', chance: 100 },
			{ id: 'ame_warden', chance: 30 },
    ],
  },
  {
    id: 'heraut_dechu',
    name: 'Héraut Déchu',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/heraut_dechu.png',
    lore: "Il proclamait jadis les messages des rois et des dieux. Mais les mots sacrés ont disparu, remplacés par des murmures impies. Le Héraut Déchu annonce désormais l'effondrement des empires.",
    attacks: [
    ],
    loot: [
      { id: 'artefact_fallen', chance: 100 },
			{ id: 'ame_herald', chance: 30 },
    ],
  },
  {
    id: 'faucheuse_dechu',
    name: 'Faucheuse Déchu',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/faucheuse_dechu.png',
    lore: "Messagère de la fin, jadis au service des anciens dieux, elle fut rejetée pour avoir défié l'ordre naturel. Désormais, elle erre entre les mondes, incomplète... affamée.",
    attacks: [
    ],
    loot: [
      { id: 'artefact_fallen', chance: 100 },
			{ id: 'ame_reaper', chance: 30 },
			{ id: 'anneau_faucheuse', chance: 3 },
    ],
  },
  {
    id: 'ornstein',
    name: 'Ornstein, Dévastateur Déchu',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/ornstein.png',
    lore: "Il semait le chaos sur les champs de guerre, jusqu'à ce que son appétit de destruction consume son âme. Désormais vidé de tout but, il dévaste sans raison... ni fin.",
    attacks: [
    ],
    loot: [
			{ id: 'bouclier_oublie', chance: 1 },
    ],
  },
  {
    id: 'smough',
    name: 'Smough, Dévastateur Déchu',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1d4',
    img: '../img/mobs/P1/smough.png',
    lore: "Chevalier brutal à la force inégalée, Smough écrasait les ennemis au nom d'un empire disparu.",
    attacks: [
    ],
    loot: [
			{ id: 'hallebarde_royale', chance: 1 },
    ],
  },
  {
    id: 'araignee_foret',
    name: 'Araignée des Forêts',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Arakh\'Nol',
    regionId: 'm1z9',
    img: '../img/mobs/P1/araignee_foret.png',
    lore: "Tapie entre les feuillages épais et les racines noueuses, elle guette silencieusement les voyageurs imprudents. Nombreux sont ceux qui ont senti son souffle... trop tard.",
    attacks: [
    ],
    loot: [
	  { id: 'tissu_araignee', chance: 40 },
	  { id: 'fil_araignee', chance: 50 },
    ],
  },
  {
    id: 'araignee_chasse',
    name: 'Araignée de Chasse',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/araignee_chasse.png',
    lore: "Plus petite que ses congénères, mais bien plus agile, l'Araignée de Chasse bondit sur ses proies sans avertissements. Son poison est discret... mais mortellement précis.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'araignee_venimeuse',
    name: 'Araignée Venimeuse',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/araignee_venimeuse.png',
    lore: "Nichée dans l'obscurité, elle injecte son venin avant même qu'on ne sente ses crochets. Les rares survivants parlent d'une brûlure lente... et d'un regard vide.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'araignee_etrangleuse',
    name: 'Araignée Étrangleuse',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/araignee_etrangleuse.png',
    lore: "Elle ne chasse pas... elle attend. Ses pattes glissent dans l'ombre en silence, et quand vous sentez son emprise, il est déjà trop tard.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'pricilia',
    name: 'Pricilia',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/pricilia.png',
    lore: "Créature ancienne et rusée, Pricilia tisse ses toiles dans les recoins oubliés des forêts les plus sombre. Ses proies ne voient jamais la mort... seulement ses yeux luisants.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'yula',
    name: 'Yula',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/yula.png',
    lore: "Tapis dans l'obscurité humide du donjon, Yula est une araignée redoutée par les aventuriers. Ses pattes tranchantes et ses yeux luisants inspirent la terreur à quiconque croise son chemin.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'jira',
    name: 'Jira',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/jira.png',
    lore: "Créature silencieuse tapie entre les toiles, Jira surveille chaque recoin du donjon. Plus rapide que l'éclair, elle frappe sans prévenir, ne laissant derrière elle que le silence... et des toiles sanglantes.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'kamilia',
    name: 'Kamilia',
    type: 'mini_boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'm1d5',
    img: '../img/mobs/P1/kamilia.png',
    lore: "Silencieuse au cœur du donjon, Kamilia tisse des pièges invisibles dans l'ombre. Sa morsure injecte un venin paralysant, laissant ses proies conscientes, mais incapables de fuir.",
    attacks: [
    ],
    loot: [
    ],
  },
  {
    id: 'cerf_montagnes',
    name: 'Cerf des Montagnes',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Montagnes de Tolbana',
    regionId: 'm1z10',
    img: '../img/mobs/P1/cerf_montagnes.png',
    lore: "Majestueux et insaisissable, le Cerf des Montagnes habite les hauteurs glacées et les forêts enneigées. On raconte qu'il apparaît aux âmes pures, guidant les voyageurs égarés vers la sécurité.",
    attacks: [
    ],
    loot: [
	  { id: 'peau_cerf_montagnes', chance: 45 },
    ],
  },
  {
    id: 'golem_glace',
    name: 'Golem de Glace',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Citadelle des Neiges',
    regionId: 'm1z11',
    img: '../img/mobs/P1/golem_glace.png',
    lore: "Forgé dans les profondeurs d'un glacier ancien, le Golem de Glace est une sentinelle implacable. Son corps de cristal givré repousse toute chaleur, et ses coups peuvent figer le sang en un instant.",
    attacks: [
    ],
    loot: [
	  { id: 'peau_dur_glacial', chance: 30 },
	  { id: 'poussiere_givre', chance: 40 },
    ],
  },
  {
    id: 'spirite_glace',
    name: 'Spirite de Glace',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Citadelle des Neiges',
    regionId: 'm1z11',
    img: '../img/mobs/P1/spirite_glace.png',
    lore: "Âme ancienne née des tempêtes hivernales, la Spirite de Glace veille sur les terres gelées. Elle murmure aux vents et glace les intrus, protégeant les secrets oubliés du givre éternel.",
    attacks: [
    ],
    loot: [
	  { id: 'eclat_magique_glacial', chance: 35 },
	  { id: 'poussiere_givre', chance: 45 },
    ],
  },
  {
    id: 'ours_glace',
    name: 'Ours de Glace',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 3,
    region: 'Citadelle des Neiges',
    regionId: 'm1boss5',
    img: '../img/mobs/P1/ours_glace.png',
    lore: "Né dans les cavernes les plus froides des montagnes, l'Ours de Glace incarne la force brute du Nord. Son rugissement fait frissonner l'air, et son souffle glacé fige tout sur son passage.",
    attacks: [
    ],
    loot: [
	  { id: 'fragment_ame_ours', chance: 5 },
	  { id: 'poussiere_givre', chance: 80, qty:'1-3' },
    ],
		spawnTime: '5m'
  },
  {
    id: 'poisson_requin',
    name: 'Poisson Requin',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 2,
    region: 'Lac de Virelune',
    regionId: 'm1z12',
    img: '../img/mobs/P1/poisson_requin.png',
    lore: "Prédateur implacable des eaux profondes, le Poisson Requin traque silencieusement ses proies. Ses dents acérées peuvent trancher l'acier, et son instinct ne connaît ni pitié ni repos.",
    attacks: [
    ],
    loot: [
	  { id: 'carapace_requin', chance: 40 },
    ],
  },
  {
    id: 'nymbrea',
    name: 'Nymbréa',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 1,
    difficulty: 4,
    region: 'Antre de Aepep',
    regionId: 'm1boss6',
    img: '../img/mobs/P1/nymbrea.png',
    lore: "Serpent mythique glissant entre les courants profonds, Nymbréa incarne la grâce et la traîtrise des eaux calmes. Ses écailles scintillent comme des perles maudites, et son regard hypnotique attire les imprudents vers les abysses.",
    attacks: [
    ],
    loot: [
	  { id: 'coeur_nymbrea' },
    ],
		spawnTime: '10m'
  },
	//#endregion Palier 1
	//#region Palier 2
	{
    id: 'taureau_monstrueux',
    name: 'Taureau Monstrueux',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Lac des Taureaux',
    regionId: 'm2z1',
    img: '',
    lore: "Colosse agressif qui hante les rives du Lac des Taureaux. Ses Charges martèlent le sol et renversent les imprudents.",
    attacks: [
    ],
    loot: [
			{ id: 'peau_epaisse', chance:40 },
    ],
  },
	{
    id: 'taureau',
    name: 'Taureau',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Lac des Taureaux',
    regionId: 'm2z1',
    img: '',
    lore: "Bête territoriale du Lac des Taureaux, connue pour ses coups de cornes. Plus endurant, il devient dangereux en mêlée prolongée.",
    attacks: [
    ],
    loot: [
			{ id: 'corne_taureau', chance:40 },
    ],
  },
	{
    id: 'ours_foret',
    name: 'Ours de la Forêt',
    type: 'monstre',
    behavior: 'neutre',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Forêt Sucrée',
    regionId: 'm2z2',
    img: '../img/mobs/P2/ours_foret.png',
    lore: "Maître des sous-bois de la Forêt Sucrée, puissant mais placide... jusqu'à provocation. Ses griffes peuvent mettre à terre même les mieux protégés.",
    attacks: [
    ],
    loot: [
			{ id: 'peau_ours', chance:50 },
			{ id: 'griffe_ours', chance:45 },
			{ id: 'graisse_ours', chance:5 },
			{ id: 'residu_miel', chance:60 },
    ],
  },
	{
    id: 'winnie',
    name: 'Winnie, le meilleur Ami de l\'Homme',
    type: 'boss',
    behavior: 'neutre',
		palier: 2,
    difficulty: 3,
    region: 'Forêt Sucrée',
    regionId: 'm2z2',
    img: '',
    lore: "Maître des sous-bois de la Forêt Sucrée, puissant mais placide... jusqu'à provocation. Ses griffes peuvent mettre à terre même les mieux protégés.",
    attacks: [
    ],
    loot: [
			{ id: 'peau_ours' },
			{ id: 'griffe_ours' },
			{ id: 'graisse_ours' },
			{ id: 'residu_miel' },
    ],
  },
	{
    id: 'loup_montagnes',
    name: 'Loup des Montagnes',
    type: 'monstre',
    behavior: 'neutre',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Désert des Crocs Argentés',
    regionId: 'm2z3',
    img: '',
    lore: "Prédateur vif qui arpente les dunes du Désert des Crocs Argenté. Ses meutes harcèlent puis achèvent leurs cibles.",
    attacks: [
    ],
    loot: [
			{ id: 'fourrure_loup_p2', chance:40 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/graywolf/head.json',
				position: [0.462, 0.405, 0.9796],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/torso.json',
				position: [0.4647, 0.2426, 0.0745],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/yaw.json',
				position: [0.4614, 0.0793, 1.0066],
				rotation: [0.384, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/leftarm.json',
				position: [0.6441, 0.3143, 0.5971],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/leftarm_low.json',
				position: [0.7224, 0.0175, 0.5656],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/leftleg.json',
				position: [0.6532, 0.3154, 0.1443],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/leftleg_low.json',
				position: [0.2989, -0.1332, 0.0859],
				rotation: [0.1047, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/rightarm.json',
				position: [0.3168, 0.2633, 0.5549],
				rotation: [0.1396, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/rightarm_low.json',
				position: [0.2263, 0.0175, 0.4958],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/rightleg.json',
				position: [0.3248, 0.3154, 0.1057],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/rightleg_low.json',
				position: [0.6305, -0.1332, 0.0302],
				rotation: [0.1047, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/graywolf/tail.json',
				position: [0.4505, 0.1278, -0.4807],
				rotation: [0.829, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 3,
			hauteur: 0,
			"capture": { "theta": -0.52, "phi": 1.22 }
		}
  },
	{
    id: 'loup_savanes',
    name: 'Loup des Savanes',
    type: 'monstre',
    behavior: 'neutre',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Désert des Crocs Argentés',
    regionId: 'm2z3',
    img: '',
    lore: "Chasseur rapide du Désert des Crocs Argentés, reconnaissable à son pelage roux. Frappe en meute et se replie aussitôt.",
    attacks: [
    ],
    loot: [
			{ id: 'fourrure_loup_p2', chance:50 },
    ],
		morceaux: [
			{
				fichier: '../img/compendium/modelengine/models/redwolf/head.json',
				position: [0.462, 0.405, 0.9796],
				rotation: [0, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/torso.json',
				position: [0.4647, 0.2426, 0.0745],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/yaw.json',
				position: [0.4614, 0.0793, 1.0066],
				rotation: [0.384, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/leftarm.json',
				position: [0.6441, 0.3143, 0.5971],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/leftarm_low.json',
				position: [0.7224, 0.0175, 0.5656],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/leftleg.json',
				position: [0.6532, 0.3154, 0.1443],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/leftleg_low.json',
				position: [0.2989, -0.1332, 0.0859],
				rotation: [0.1047, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/rightarm.json',
				position: [0.3168, 0.2633, 0.5549],
				rotation: [0.1396, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/rightarm_low.json',
				position: [0.2263, 0.0175, 0.4958],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/rightleg.json',
				position: [0.3248, 0.3154, 0.1057],
				rotation: [0, 3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/rightleg_low.json',
				position: [0.6305, -0.1332, 0.0302],
				rotation: [0.1047, -3.1416, 0],
				scale: 1
			},
			{
				fichier: '../img/compendium/modelengine/models/redwolf/tail.json',
				position: [0.4505, 0.1278, -0.4807],
				rotation: [0.829, 3.1416, 0],
				scale: 1
			}
		],
		camera: {
			distance: 3,
			hauteur: 0,
			"capture": { "theta": 0.52, "phi": 1.22 }
		}
  },
	{
    id: 'ouvriere',
    name: 'Ouvrière',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 1,
    region: 'Donjon Ruche de Melliona',
    regionId: '',
    img: '',
    lore: "Travailleuse infatigable qui défend la Ruche quand l'alerte retentit. En groupe, elles submergent les intrus par vagues successives.",
    attacks: [
    ],
    loot: [
			{ id: 'dard', chance:30 },
			{ id: 'miel', chance:30 },
    ],
  },
	{
    id: 'dardroyal',
    name: 'Dardroyal',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 1,
    region: 'Donjon Ruche de Melliona',
    regionId: '',
    img: '',
    lore: "Guerrier d'élite de la Ruche, patrouille autour de la Souveraine. Charge sans prévenir et perce les défenses avec son dard renforcé.",
    attacks: [
    ],
    loot: [
			{ id: 'dard', chance:35 },
			{ id: 'carapace_abeille', chance:30 },
    ],
  },
	{
    id: 'melisara',
    name: 'Melisara, Souveraine de la Ruche',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Donjon Ruche de Melliona',
    regionId: '',
    img: '',
    lore: "Matriarche vénérée, chef d'ochestre des essaims et gardienne du miel. Ses ordres galvanisent les abeilles et laissent peu de répit aux intrus.",
    attacks: [
    ],
    loot: [
			{ id: 'dard', chance:90, qty:'1-3' },	
			{ id: 'miel', chance:100, qty:'1-3' },
			{ id: 'carapace_abeille', chance:80, qty:'1-2' },
    ],
  },
	{
    id: 'harpie_feu',
    name: 'Harpie de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Nid de Brasier',
    regionId: 'm2z1u1',
    img: '../img/mobs/P2/harpie_feu.png',
    lore: "Rapace Humanoïde des falaises ardentes, ses serres brûlent au contact. Plonge depuis les courants chauds pour frapper puis remonter.",
    attacks: [
    ],
    loot: [
			{ id: 'plume_enflammee', chance:50 },	
			{ id: 'plume_flamboyante' },
    ],
  },
	{
    id: 'harpie_terre',
    name: 'Harpie de Terre',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Forêt des Ailes d\'Émeraude',
    regionId: 'm2z4',
    img: '../img/mobs/P2/harpie_terre.png',
    lore: "Affinité tellurique : ses coups soulèvent des éclats empoisonnés. Attaque en rase-mottes entre les frondaisons d'émeraude.",
    attacks: [
    ],
    loot: [
			{ id: 'plume_terreuse', chance:50 },	
			{ id: 'plume_ecarlate' },
    ],
  },
	{
    id: 'harpie_foudre',
    name: 'Harpie de Foudre',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Baie des Monstres Ondoyante',
    regionId: 'm2z5',
    img: '../img/mobs/P2/harpie_foudre.png',
    lore: "Rapide et imprévisible, elle sillone les cieux chargés d'embruns. Ses coups crepitent et désorientent les adversaires au contact.",
    attacks: [
    ],
    loot: [
			{ id: 'plume_ondoyante', chance:50 },
			{ id: 'oeuf_harpie_eau', chance:25 },
			{ id: 'plume_azur' },
    ],
  },
	{
    id: 'poisson_fulgurant',
    name: 'Poisson Fulgurant',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Baie des Monstres Ondoyante',
    regionId: 'm2z5',
    img: '',
    lore: "Prédateur nerveux qui frappe en éclairs fulgurants. Bondit hors de l'eau pour surprendre puis disparaît aussitôt.",
    attacks: [
    ],
    loot: [
			{ id: 'ecaille_fulgurante', chance:40},
    ],
  },
	{
    id: 'squelette_sanctuaire_archer',
    name: 'Squelette du Sanctuaire - Archer',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Sanctuaire de Khesûn',
    regionId: 'm2z6',
    img: '../img/mobs/P2/squelette_sanctuaire_archer.png',
    lore: "Guette les intrus depuis les colonnades, flèches imprégnées d'énergie spectrale. Tire en salves, puis se replie derrière les piliers.",
    attacks: [
    ],
    loot: [
			{ id: 'pierre_runique', chance:5 },
			{ id: 'chaine_spectrale', chance:35 },
			{ id: 'vetement_dechire', chance:30 },
    ],
  },
	{
    id: 'squelette_sanctuaire_shaman',
    name: 'Squelette du Sanctuaire - Shaman',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Sanctuaire de Khesûn',
    regionId: 'm2z6',
    img: '../img/mobs/P2/squelette_sanctuaire_shaman.png',
    lore: "Nécromancien du sanctuaire, tisse des malédictions au cœur des ruines. Peut affaiblir ses cibles avant l'assaut des gardes.",
    attacks: [
    ],
    loot: [
			{ id: 'pierre_runique', chance:5 },
			{ id: 'chaine_spectrale', chance:35 },
			{ id: 'poudre_moelle', chance:20 },
    ],
  },
	{
    id: 'squelette_sanctuaire_guerrier',
    name: 'Squelette du Sanctuaire - Guerrier',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Sanctuaire de Khesûn',
    regionId: 'm2z6',
    img: '../img/mobs/P2/squelette_sanctuaire_guerrier.png',
    lore: "Garde lourdement armé, maintient la ligne dans les salles sacrées. Frappe sèchement et brise la garde des aventuriers imprudents.",
    attacks: [
    ],
    loot: [
			{ id: 'pierre_runique', chance:7 },
			{ id: 'chaine_spectrale', chance:30 },
			{ id: 'vetement_dechire', chance:30 },
    ],
  },
	{
    id: 'gardien_sanctuaire',
    name: 'Gardien du Sanctuaire',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 5,
    region: 'Sanctuaire de Khesûn',
    regionId: 'm2z6',
    img: '',
    lore: "Sentinelle antique guidée par une volonté oubliée. Insensible à la peur, terrasse les intrus d'un seul revers.",
    attacks: [
    ],
    loot: [
			{ id: 'pierre_runique', chance:40 },
			{ id: 'collier_gardien', chance:1 },
    ],
  },
	{
    id: 'minion_gardien',
    name: 'Minion du Gardien',
    type: 'sbire',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 1,
    region: 'Sanctuaire de Khesûn',
    regionId: 'm2z6',
    img: '',
    lore: "Éclat d'os invoqué par le Gardien pour noyer l'ennemi sous le nombre. Fragile seul, dangereux en essaim autour de son maître.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'golem_pierre',
    name: 'Golem de Pierre',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Veines de Sablemor',
    regionId: 'm2z2u1',
    img: '',
    lore: "Colosse minéral, ses pas font vibrer le sol. Projette des éclats rocheux en heurtant le terrain.",
    attacks: [
    ],
    loot: [
			{ id: 'morceau_ferraille', chance:40 },
    ],
  },
	{
    id: 'magnus',
    name: 'Magnus, Colosse des Veines',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 5,
    region: 'Veines de Sablemor',
    regionId: 'm2z2u1',
    img: '',
    lore: "Titan antique sculpté par la sédimentation et la pression du temps. Ses coups fracturent la garde et projettent des nuées de poussière.",
    attacks: [
			{ name: 'Pour Démacia',   desc: 'Donne un violent coup de pied, suivi d\'un coup d\'épée.', dmg:'?' },
			{ name: 'Démacia marche comme un seul Homme',   desc: 'Se protège avec son immense Bouclier contre toutes attaques frontales.'},
			{ name: 'Spin to Win',   desc: 'Tourne sur lui même, épée en main afin d\'asséner des coups dévastateurs.', dmg:'?' },
			{ name: 'Justice de Démacia',   desc: 'Se propulse en l\'air après avoir scintillé et s\'écrase sur sa cible.', dmg:'?' },
    ],
    loot: [
    ],
  },
	{
    id: 'velindra',
    name: 'Velindra Tisseuse',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Oasis Secret',
    regionId: 'm2z7',
    img: '',
    lore: "Enchanteresse perfide tissant maléfices et toiles alchimiques. Empoisonne, affaiblit puis s'achève d'un éclat de rire.",
    attacks: [
    ],
    loot: [
      { id: 'potion_sorciere', chance:15},
    ],
  },
	{
    id: 'squelette_archer_feu',
    name: 'Squelette Archer de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Sentinelle embrasée du tombeau, décoche des flèches incendiaires depuis les corniches. Reste mobile et harcèle à distance.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'squelette_sorcier_feu',
    name: 'Squelette Sorcier de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Nécromancien ardent : invoque des orbes brûlantes et des cônes de flammes. Vulnérable au corps-à-corps si interrompu.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'squelette_tank_feu',
    name: 'Squelette Tank de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Bélier crépitant, cuirasse embrasée et coups lourds. Progresse lentement mais encaisse énormément.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'squelette_lancier_feu',
    name: 'Squelette Lancier de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Manie une pique incandescente et maintient la distance. Percées rapides suivies d'un repli derrière les lignes.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'squelette_feu',
    name: 'Squelette de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Fantassin embrasé forme le gros des troupes du tombeau. Frappe régulière, dangereuse en groupe.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'squelette_epeiste_feu',
    name: 'Squelette Épéiste de Feu',
    type: 'monstre',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Guerrier ardent maniant une lame chauffée à blanc. Brise-garde en combos rapides puis recule d'un pas.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'ame_squelette',
    name: 'Âme Squelette',
    type: 'sbire',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Spectre d'ossements, flotte entre les tombes en gémissant. Fragile seul, souvent invoqué en renfort.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'brute_morte-vivante',
    name: 'Brute Morte-Vivante',
    type: 'sbire',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Masse titubante, invoquée pour encaisser les coups à la place des maîtres Lente mais agressive lorsqu'elle est regroupée.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'gargouille_morte-vivante',
    name: 'Gargouille Morte-Vivante',
    type: 'sbire',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Statue animée, s'abat depuis les corniches sur les intrus. Ses griffes éraflent l'armure et empoisonnent la garde.",
    attacks: [
    ],
    loot: [
    ],
  },
	{
    id: 'morveth',
    name: 'Morverth l\'Écorcheur d\'Âmes',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 3,
    region: 'Donjon Tombeau du Nécromancien',
    regionId: '',
    img: '',
    lore: "Maître nécromant dont les malédictions drainent la vitalité. Commande des légions d'ossements et frappe par vagues d'ombres.",
    attacks: [
			{ name: 'Supernova',   desc: 'Canalise son Grimoire et prépare un immense sort, caractérisé par sa couleur bleu, qui fera de lourds dégâts quand la bulle éclatera.', dmg:'?' },
			{ name: 'Erect!',   desc: 'Invoque des Sbires pour l\'aider au combat.' },
			{ name: 'Spooky Scary Skeletons',   desc: 'Invoque un salve de Crânes squelettique volant à tête chercheuse.', dmg:'?' },
			{ name: 'Téléportation',   desc: 'Se déplace instantanement vers une autre position, proche du point de départ.' },
    ],
    loot: [
			{ id: 'pierre_osseuse_noire', chance:100, qty:'2' },
    ],
  },
	{
    id: 'rugiboeuf',
    name: 'Rugibœuf, Le Gardien',
    type: 'boss',
    behavior: 'agressif',
		inCodex: true,
		palier: 2,
    difficulty: 2,
    region: 'Tour de Taurus',
    regionId: '',
    img: '',
    lore: "Seigneur du labyrinthe, hurle avant de charger pour briser les rangs. Frappe en arcs larges et repouse violemment ses adversaires.",
    attacks: [
    ],
    loot: [
      { id: 'corne_rugiboeuf' },
    ],
  },
	//#endregion Palier 2
];