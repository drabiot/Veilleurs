const FLOOR_COUNT = 100;

const MARKER_EMOJI = {
  région:           '📍',
  zone_monstre:     '💀',
  quête_principale: '💬',
  quête_secondaire: '❓',
  repreneur_butin:  '🛒',
  marchand:         '💰',
  artisant:         '⚒️',
  clef:             '🗝️',
  ressource:        '🌿',
  donjon:           '⚔️',
	autre:						'🦠',
};

const FLOOR_NAMES = {
  1: 'Forêt',
  2: 'Désert',
};

const FLOOR_DATA = {
  1: { hasUnderground: true  },
  2: { hasUnderground: true }
};

const FLOOR_ZONES = {
	//#region P1 Zones
  1: [
    {
      id: 'm1z1',
      name: 'Vallée des Loups',
      regionName: 'Vallée des Loups',
      color: '#e0ac60',
      emoji: '🐺',
      monsters: [
        { name: 'Loup Sinitre Blanc', level: 2, difficulty: '⭐',   emoji: '🐺', link: '../Bestiaire/bestiaire.html#monstres/loup_sinistre_blanc' },
        { name: 'Loup Sinitre Noir',  level: 2, difficulty: '⭐',   emoji: '🐺', link: '../Bestiaire/bestiaire.html#monstres/loup_sinistre_noir' },
      ],
      points: [
        { gx: 2430, gy: 4026 }, { gx: 2344, gy: 3943 }, { gx: 2380, gy: 3784 },
        { gx: 2474, gy: 3651 }, { gx: 2657, gy: 3667 }, { gx: 2702, gy: 3849 },
        { gx: 2645, gy: 3982 },
      ],
    },
    {
      id: 'm1z2',
      name: 'Zone des Sangliers',
      regionName: 'Zone des Sangliers',
      color: '#644d58',
      emoji: '🐗',
      monsters: [
        { name: 'Sanglier Corrompu', level: 2, difficulty: '⭐',   emoji: '🐗', link: '../Bestiaire/bestiaire.html#monstres/sanglier_corrompu' },
      ],
      points: [
        { gx: 1611, gy: 3620 }, { gx: 1781, gy: 3344 }, { gx: 1986, gy: 3339 },
        { gx: 2134, gy: 3470 }, { gx: 2131, gy: 3713 }, { gx: 1857, gy: 3619 },
      ],
    },
    {
      id: 'm1z3',
      name: 'Champs de Mizunari',
      color: '#82e753',
      emoji: '🌾',
      monsters: [
        { name: 'Nephentes', level: 4, difficulty: '⭐⭐', emoji: '🥬', link: '../Bestiaire/bestiaire.html#monstres/nephentes' },
      ],
      points: [
        { gx: 3306, gy: 3721 }, { gx: 3360, gy: 3698 }, { gx: 3423, gy: 3761 },
        { gx: 3366, gy: 3818 }, { gx: 3326, gy: 3776 },
      ],
    },
    {
      id: 'm1z4',
      name: 'Marécage Putride',
      regionName: 'Marécage Putride',
      color: '#ee7560',
      emoji: '🍄',
      monsters: [
        { name: 'Mini Tréant',       level: 3, difficulty: '⭐⭐',   emoji: '🌿', link: '../Bestiaire/bestiaire.html#monstres/mini_treant' },
        { name: 'Guerrier Tréant',   level: 3, difficulty: '⭐⭐',   emoji: '🛡️', link: '../Bestiaire/bestiaire.html#monstres/guerrier_treant' },
        { name: "Tréant d'Élite",    level: 3, difficulty: '⭐⭐',   emoji: '🏹', link: '../Bestiaire/bestiaire.html#monstres/treant_elite' },
        { name: 'Mage Sylvestre',    level: 3, difficulty: '⭐⭐',   emoji: '🧙', link: '../Bestiaire/bestiaire.html#monstres/mage_sylvestre' },
      ],
      points: [
        { gx: 1643, gy: 3261 }, { gx: 1486, gy: 3269 }, { gx: 1043, gy: 3272 },
        { gx: 1008, gy: 3146 }, { gx: 1057, gy: 2934 }, { gx: 1382, gy: 2938 },
        { gx: 1573, gy: 2831 }, { gx: 1722, gy: 3084 },
      ],
    },
    {
      id: 'm1z5',
      name: 'Vallhat',
      regionName: 'Vallhat',
      color: '#74ce50',
      emoji: '🌳',
      monsters: [
        { name: 'Petit Slime',      level: 3, difficulty: '⭐⭐',    emoji: '🟢', link: '../Bestiaire/bestiaire.html#monstres/petit_slime' },
        { name: 'Guerrier Slime',   level: 3, difficulty: '⭐⭐',    emoji: '⚔️', link: '../Bestiaire/bestiaire.html#monstres/guerrier_slime' },
        { name: 'Slime Soigneur',   level: 3, difficulty: '⭐⭐⭐',  emoji: '⛑️', link: '../Bestiaire/bestiaire.html#monstres/slime_soigneur' },
        { name: 'Slime Magicien',   level: 3, difficulty: '⭐⭐⭐',  emoji: '🧙', link: '../Bestiaire/bestiaire.html#monstres/slime_magicien' },
      ],
      points: [
        { gx: 549, gy: 3154 }, { gx: 421, gy: 3348 }, { gx: 272, gy: 3368 },
        { gx: 163, gy: 3074 }, { gx: 124, gy: 2765 }, { gx: 300, gy: 2663 },
        { gx: 532, gy: 2766 }, { gx: 600, gy: 3195 },
      ],
    },
    {
      id: 'm1z6',
      name: 'Ruines Maudites',
      color: '#eecf21',
      emoji: '💀',
      monsters: [
        { name: 'Squelette Épéiste',      level: 3, difficulty: '⭐⭐',   emoji: '💀', link: '../Bestiaire/bestiaire.html#monstres/squelette_epeiste' },
        { name: 'Guerrier Squelette',     level: 3, difficulty: '⭐⭐⭐', emoji: '⚔️', link: '../Bestiaire/bestiaire.html#monstres/guerrier_squelette' },
        { name: 'Squelette Hallebardier', level: 3, difficulty: '⭐⭐⭐', emoji: '🔨', link: '../Bestiaire/bestiaire.html#monstres/squelette_hallebardier' },
      ],
      points: [
        { gx: 2766, gy: 4371 }, { gx: 2831, gy: 4375 }, { gx: 2889, gy: 4427 },
        { gx: 2882, gy: 4497 }, { gx: 2767, gy: 4470 },
      ],
    },
    {
      id: 'm1z7',
      name: 'Mine de Geldorak',
      regionName: 'Mine de Geldorak',
      color: '#75bdcf',
      emoji: '⛰️',
      monsters: [
        { name: 'Bandit Archer',   level: 3, difficulty: '⭐⭐', emoji: '🏹', link: '../Bestiaire/bestiaire.html#monstres/bandit_archer' },
        { name: 'Bandit Assassin', level: 3, difficulty: '⭐⭐', emoji: '🗡️', link: '../Bestiaire/bestiaire.html#monstres/bandit_assassin' },
        { name: 'Bandit Robuste',  level: 3, difficulty: '⭐⭐', emoji: '💪', link: '../Bestiaire/bestiaire.html#monstres/bandit_robuste' },
      ],
      points: [
        { gx: 3996, gy: 3804 }, { gx: 4155, gy: 3814 }, { gx: 4275, gy: 3860 },
        { gx: 4157, gy: 3965 }, { gx: 4068, gy: 4016 }, { gx: 3990, gy: 3951 },
        { gx: 3981, gy: 3867 },
      ],
    },
    {
      id: 'm1z8',
      name: "Archipel d'Ika",
      regionName: "Archipel d'Ika",
      color: '#3e9db4',
      emoji: '🏝️',
      monsters: [
        { name: 'Ika', level: 3, difficulty: '⭐⭐⭐', emoji: '🐢', link: '../Bestiaire/bestiaire.html#monstres/ika' },
      ],
      points: [
        { gx: 3204, gy: 4045 }, { gx: 3237, gy: 3998 }, { gx: 3317, gy: 4000 },
        { gx: 3365, gy: 4021 }, { gx: 3394, gy: 4074 }, { gx: 3395, gy: 4133 }, 
        { gx: 3342, gy: 4175 }, { gx: 3216, gy: 4170 }, { gx: 3187, gy: 4074 },
      ],
    },
    {
      id: 'm1z9',
      name: "Arakh'Nol",
      regionName: "Arakh'Nol",
      color: '#8bbeca',
      emoji: '🕸️',
      monsters: [
        { name: 'Araignée des Forêts', level: 7, difficulty: '⭐⭐⭐⭐', emoji: '🕷️', link: '../Bestiaire/bestiaire.html#monstres/araignee_foret' },
      ],
      points: [
        { gx: 1448, gy: 1146 }, { gx: 1526, gy: 1411 }, { gx: 1412, gy: 1449 },
				{ gx: 1386, gy: 1541 }, { gx: 1206, gy: 1661 }, { gx: 1083, gy: 1703 },
				{ gx: 1044, gy: 1670 }, { gx: 1150, gy: 1472 }, { gx: 1139, gy: 1355 },
				{ gx: 1192, gy: 1269 }, { gx: 1043, gy: 1167 }, { gx: 1086, gy: 1106 }, { gx: 1301, gy: 1170 },
      ],
    },
    {
      id: 'm1z10',
      name: 'Montagnes de Tolbana',
      color: '#ddb04e',
      emoji: '🏔️',
      monsters: [
        { name: 'Cerf des Montagnes', level: 7, difficulty: '⭐⭐⭐', emoji: '🦌', link: '../Bestiaire/bestiaire.html#monstres/cerf_montagnes' },
      ],
      points: [
        { gx: 4019, gy: 1143 }, { gx: 4101, gy: 1026 }, { gx: 4261, gy: 1022 },
        { gx: 4189, gy: 1136 }, { gx: 4193, gy: 1220 }, { gx: 4072, gy: 1201 },
      ],
    },
    {
      id: 'm1z11',
      name: 'Citadelle des Neiges',
      regionName: 'Citadelle des Neiges',
      color: '#224ba5',
      emoji: '❄️',
      monsters: [
        { name: 'Golem de Glace',   level: 7, difficulty: '⭐⭐⭐',    emoji: '🧊', link: '../Bestiaire/bestiaire.html#monstres/golem_glace' },
        { name: 'Spirite de Glace', level: 7, difficulty: '⭐⭐⭐',    emoji: '🦋', link: '../Bestiaire/bestiaire.html#monstres/spirite_glace' },
      ],
      points: [
        { gx: 4053, gy: 1988 }, { gx: 4051, gy: 2014 }, { gx: 4027, gy: 2023 },
				{ gx: 3970, gy: 2020 }, { gx: 3970, gy: 1982 }, { gx: 3991, gy: 1973 }, { gx: 4029, gy: 1974 },
      ],
    },
    {
      id: 'm1z12',
      name: 'Lac de Virelune',
      regionName: 'Antre de Aepep',
      color: '#bde3f1',
      emoji: '🎣',
      monsters: [
        { name: 'Poisson Requin', level: 7, difficulty: '⭐⭐⭐',    emoji: '🐟', link: '../Bestiaire/bestiaire.html#monstres/poisson_requin' },
      ],
      points: [
        { gx: 1473, gy: 1992 }, { gx: 1471, gy: 2075 }, { gx: 1410, gy: 2111 },
        { gx: 1324, gy: 2076 }, { gx: 1310, gy: 2012 }, { gx: 1370, gy: 1956 },
        { gx: 1443, gy: 1969 },
      ],
    },
    {
      id: 'm1z13',
      name: 'Prairie des Sangliers',
      color: '#644d58',
      emoji: '🐗',
      monsters: [
        { name: 'Sanglier Corrompu', level: 2, difficulty: '⭐', emoji: '🐗', link: '../Bestiaire/bestiaire.html#monstres/sanglier_corrompu' },
      ],
      points: [
        { gx: 2693, gy: 2133 }, { gx: 2566, gy: 2170 }, { gx: 2595, gy: 1965 },
				{ gx: 2813, gy: 2067 }, { gx: 2724, gy: 2115 },
      ],
    },
  ],
	//#endregion P1 Zones
	//#region P2 Zones
	2: [
    {
      id: 'm2z1',
      name: 'Lac des Taureaux',
      regionName: 'Lac des Taureaux',
      color: '#39494e',
      emoji: '🐂',
      monsters: [
        { name: 'Taureau', level: 10, difficulty: '⭐', emoji: '🐃', link: '../Bestiaire/bestiaire.html#monstres/taureau' },
        { name: 'Taureau Monstrueux', level: 10, difficulty: '⭐', emoji: '🐃', link: '../Bestiaire/bestiaire.html#monstres/taureau_monstrueux' },
      ],
      points: [
        { gx: 151, gy: -135 }, { gx: 200, gy: -81 }, { gx: 175, gy: -9 },
        { gx: 92, gy: 4 },     { gx: 20, gy: -75 },  { gx: 36, gy: -118 },
      ],
    },
    {
      id: 'm2z2',
      name: 'Forêt Sucrée',
      regionName: 'Forêt Sucrée',
      color: '#53cb38',
      emoji: '🍯',
      monsters: [
        { name: 'Ours de la Forêt', level: 11, difficulty: '⭐', emoji: '🐻', link: '../Bestiaire/bestiaire.html#monstres/ours_foret' },
      ],
      points: [
        { gx: 324, gy: -665 }, { gx: 364, gy: -749 }, { gx: 571, gy: -759 },
        { gx: 591, gy: -600 }, { gx: 485, gy: -584 }, { gx: 416, gy: -624 }, { gx: 362, gy: -603 },
      ],
    },
    {
      id: 'm2z3',
      name: 'Désert des Crocs Argentés',
      regionName: 'Désert des Crocs Argentés',
      color: '#f3c26f',
      emoji: '🐺',
      monsters: [
        { name: 'Loups des Montagnes', level: 10, difficulty: '⭐⭐', emoji: '🐺', link: '../Bestiaire/bestiaire.html#monstres/loup_montagnes' },
        { name: 'Loups des Savanes', level: 10, difficulty: '⭐⭐', emoji: '🐺', link: '../Bestiaire/bestiaire.html#monstres/loup_savanes' },
      ],
      points: [
        { gx: -207, gy: -643 }, { gx: -263, gy: -531 }, { gx: -528, gy: -445 },
        { gx: -561, gy: -526 }, { gx: -529, gy: -592 }, { gx: -372, gy: -618 },
      ],
    },
    {
      id: 'm2z4',
      name: "Forêt des Ailes d'Émeraude",
      regionName: "Forêt des Ailes d'Émeraude",
      color: '#53cb38',
      emoji: '🍃',
      monsters: [
        { name: 'Harpie de Terre', level: 12, difficulty: '⭐⭐', emoji: '🦅', link: '../Bestiaire/bestiaire.html#monstres/harpie_terre' },
      ],
      points: [
        { gx: -633, gy: 405 }, { gx: -618, gy: 394 }, { gx: -581, gy: 430 },
        { gx: -544, gy: 414 }, { gx: -526, gy: 492 }, { gx: -565, gy: 548 }, { gx: -603, gy: 521 }, { gx: -588, gy: 471 }, { gx: -601, gy: 441 },
      ],
    },
    {
      id: 'm2z5',
      name: 'Baie des Monstres Ondoyante',
      regionName: 'Baie des Monstres Ondoyante',
      color: '#6363d7',
      emoji: '🌊',
      monsters: [
        { name: 'Harpie de Foudre', level: 12, difficulty: '⭐⭐', emoji: '🦅', link: '../Bestiaire/bestiaire.html#monstres/harpie_foudre' },
        { name: 'Poisson Fulgurant', level: 12, difficulty: '⭐', emoji: '🐟', link: '../Bestiaire/bestiaire.html#monstres/poisson_fulgurant' },
      ],
      points: [
        { gx: -559, gy: -48 }, { gx: -492, gy: 76 },  { gx: -573, gy: 193 },
        { gx: -761, gy: 220 }, { gx: -806, gy: 266 }, { gx: -879, gy: 211 }, { gx: -794, gy: 48 }, { gx: -715, gy: 54 },
      ],
    },
    {
      id: 'm2z6',
      name: 'Sanctuaire de Khesûn',
      regionName: 'Sanctuaire de Khesûn',
      color: '#e0e02c',
      emoji: '🛕',
      monsters: [
        { name: 'Squelette du Sanctuaire - Archer', level: 13, difficulty: '⭐⭐', emoji: '🏹', link: '../Bestiaire/bestiaire.html#monstres/squelette_sanctuaire_archer' },
        { name: 'Squelette du Sanctuaire - Shaman', level: 13, difficulty: '⭐⭐', emoji: '🌿', link: '../Bestiaire/bestiaire.html#monstres/squelette_sanctuaire_shaman' },
        { name: 'Squelette du Sanctuaire - Guerrier', level: 13, difficulty: '⭐⭐⭐', emoji: '⚔️', link: '../Bestiaire/bestiaire.html#monstres/squelette_sanctuaire_guerrier' },
        { name: 'Minion du Gardien', level: 13, difficulty: '⭐', emoji: '🦴', link: '../Bestiaire/bestiaire.html#monstres/minion_gardien' },
      ],
      points: [
        { gx: -18, gy: 133 }, { gx: 14, gy: 137 }, { gx: 36, gy: 182 },
        { gx: 36, gy: 210 },  { gx: -23, gy: 233 }, { gx: -47, gy: 228 }, { gx: -47, gy: 201 },
      ],
    },
  ],
	//#endregion P2 Zones
};

const FLOOR_ZONES_UNDERGROUND = {
	//#region P1 Zones Underground
	1: [
		{
				id: 'm1z15',	
				name: 'Donjon Squelette',
				color: '#b86cbe',
				emoji: '💀',
				monsters: [
					{ name: 'Archer Squelette', level: 2, difficulty: '⭐', emoji: '🏹', link: '../Bestiaire/bestiaire.html#monstres/archer_squelette' },
					{ name: 'Tank Squelette', level: 2, difficulty: '⭐⭐', emoji: '🛡️', link: '../Bestiaire/bestiaire.html#monstres/tank_squelette' },
					{ name: 'Squelette Mage', level: 2, difficulty: '⭐⭐⭐', emoji: '🔮', link: '../Bestiaire/bestiaire.html#monstres/squelette_mage' },
				],
				points: [
					{ gx: 2780, gy: 4380 }, { gx: 2849, gy: 4380 }, { gx: 2849, gy: 4340 },
					{ gx: 2874, gy: 4340 }, { gx: 2874, gy: 4361 }, { gx: 2937, gy: 4361 },
					{ gx: 2937, gy: 4300 }, { gx: 2874, gy: 4300 }, { gx: 2874, gy: 4321 },
					{ gx: 2849, gy: 4321 }, { gx: 2849, gy: 4204 }, { gx: 2778, gy: 4204 },
					{ gx: 2778, gy: 4321 }, { gx: 2719, gy: 4301 }, { gx: 2694, gy: 4330 },
					{ gx: 2720, gy: 4356 }, { gx: 2749, gy: 4337 }, { gx: 2780, gy: 4337 },
				],
			},
			{
				id: 'm1z16',	
				name: 'Donjon Mine de Geldorak',
				color: '#84d840',
				emoji: '⛏️',
				monsters: [
					{ name: 'Tréant de la Forêt', level: 4, difficulty: '⭐', emoji: '🪵', link: '../Bestiaire/bestiaire.html#monstres/treant_foret' },
					{ name: 'Tréant de la Forêt', level: 4, difficulty: '⭐', emoji: '🌲', link: '../Bestiaire/bestiaire.html#monstres/treant_mal_foret' },
					{ name: 'Plante Décoreuse', level: 4, difficulty: '⭐', emoji: '🌷', link: '../Bestiaire/bestiaire.html#monstres/plante_devoreuse' },
					{ name: 'Brute de la Forêt', level: 4, difficulty: '⭐⭐', emoji: '🌳', link: '../Bestiaire/bestiaire.html#monstres/brute_foret' },
				],
				points: [
					{ gx: 4349, gy: 3838 }, { gx: 4344, gy: 3904 }, { gx: 4306, gy: 3921 },
					{ gx: 4326, gy: 3941 }, { gx: 4309, gy: 3984 }, { gx: 4309, gy: 4013 },
					{ gx: 4333, gy: 4011 }, { gx: 4329, gy: 4032 }, { gx: 4307, gy: 4038 },
					{ gx: 4325, gy: 4056 }, { gx: 4334, gy: 4058 }, { gx: 4334, gy: 4087 },
					{ gx: 4311, gy: 4122 }, { gx: 4319, gy: 4133 }, { gx: 4320, gy: 4177 },
					{ gx: 4291, gy: 4177 }, { gx: 4291, gy: 4120 }, { gx: 4276, gy: 4118 },
					{ gx: 4276, gy: 4055 }, { gx: 4296, gy: 4057 }, { gx: 4296, gy: 4034 },
					{ gx: 4277, gy: 4029 }, { gx: 4283, gy: 4013 }, { gx: 4295, gy: 4017 },
					{ gx: 4297, gy: 3982 }, { gx: 4256, gy: 3944 }, { gx: 4269, gy: 3922 },
					{ gx: 4223, gy: 3867 }, { gx: 4231, gy: 3838 }, { gx: 4302, gy: 3833 },
				],
			},
			{
				id: 'm1z17',	
				name: 'Donjon Sanctuaire de Xal\'Zirith',
				color: '#8750e0',
				emoji: '🕷️',
				monsters: [
					{ name: 'Araignée de Chasse', level: 7, difficulty: '⭐⭐', emoji: '🕷️', link: '../Bestiaire/bestiaire.html#monstres/araignee_chasse' },
					{ name: 'Araignée Venimeuse', level: 7, difficulty: '⭐⭐⭐', emoji: '🧪', link: '../Bestiaire/bestiaire.html#monstres/araignee_venimeuse' },
					{ name: 'Araignée Étrangleuse', level: 7, difficulty: '⭐⭐⭐', emoji: '🕸️', link: '../Bestiaire/bestiaire.html#monstres/araignee_etrangleuse' },
				],
				points: [
					{ gx: 1002, gy: 1186 }, { gx: 1010, gy: 1150 }, { gx: 1076, gy: 1139 },
					{ gx: 993,  gy: 1113 }, { gx: 989,  gy: 1070 }, { gx: 1023, gy: 1064 },
					{ gx: 1076, gy: 1084 }, { gx: 1102, gy: 1133 }, { gx: 1126, gy: 1137 },
					{ gx: 1126, gy: 1083 }, { gx: 1240, gy: 1082 }, { gx: 1275, gy: 1113 },
					{ gx: 1364, gy: 1117 }, { gx: 1396, gy: 1166 }, { gx: 1383, gy: 1227 },
					{ gx: 1311, gy: 1263 }, { gx: 1121, gy: 1197 }, { gx: 1116, gy: 1240 },
					{ gx: 1113, gy: 1295 }, { gx: 1093, gy: 1340 }, { gx: 1167, gy: 1375 },
					{ gx: 1211, gy: 1366 }, { gx: 1230, gy: 1386 }, { gx: 1218, gy: 1438 },
					{ gx: 1156, gy: 1437 }, { gx: 1069, gy: 1358 }, { gx: 1047, gy: 1303 },
					{ gx: 985,  gy: 1314 }, { gx: 954,  gy: 1236 }, { gx: 1019, gy: 1224 },
					{ gx: 1025, gy: 1259 }, { gx: 1000, gy: 1288 }, { gx: 1066, gy: 1253 }, { gx: 1062, gy: 1202 },
				],
			},
		],
		
	//#endregion P1 Zones Underground
	//#region P2 Zones Underground
  2: [
    {
      id: 'm2z1u1',
      name: 'Nid de Brasier',
      regionName: 'Nid de Brasier',
      color: '#df6c42',
      emoji: '🔥',
      monsters: [
        { name: 'Harpie de Feu', level: 12, difficulty: '⭐⭐', emoji: '🦅', link: '../Bestiaire/bestiaire.html#monstres/harpie_feu' },
      ],
      points: [
        { gx: -461, gy: 217 }, { gx: -536, gy: 342 }, { gx: -679, gy: 257 },
        { gx: -710, gy: 256 }, { gx: -717, gy: 246 }, { gx: -707, gy: 233 }, { gx: -656, gy: 204 }, { gx: -568, gy: 177 },
      ],
    },
    {
      id: 'm2z2u1',
      name: 'Les Veines de Sablemor',
      regionName: 'Les Veines de Sablemor',
      color: '#ded26b',
      emoji: '🕳️',
      monsters: [
        { name: 'Golem de Pierre', level: 13, difficulty: '⭐⭐⭐', emoji: '🗿', link: '../Bestiaire/bestiaire.html#monstres/golem_pierre' },
      ],
      points: [
        { gx: 246, gy: 366 }, { gx: 186, gy: 352 }, { gx: 174, gy: 323 },
        { gx: 176, gy: 294 }, { gx: 201, gy: 259 }, { gx: 258, gy: 259 }, { gx: 287, gy: 292 }, { gx: 276, gy: 351 },
      ],
    },
  ],
	//#endregion P2 Zones Underground
};

const FLOOR_MARKERS = {
	//#region P1 Markers
  1: [
		//#region P1 Markers > Donjon
    { id: 'm1d2',  type: 'donjon',  gx: 2785, gy: 4420, spawnGx: 2813, spawnGy: 4389, spawnLayer: 'underground', name: 'Sous-Donjon Nasgul',                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-squelette' },
    { id: 'm1d3',  type: 'donjon',  gx: 4300, gy: 3890, name: 'Donjon Mine de Geldorak',            desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-geldorak' },
    { id: 'm1d4',  type: 'donjon',  gx: 2383, gy: 2410, name: "Donjon Labyrinthe des Déchus",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-labyrinthe-des-dechus' },
    { id: 'm1d5',  type: 'donjon',  gx: 1008,  gy: 1184, name: "Donjon Xal'Zirith",                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-xalzirith' },
		{ id: 'm1d6', type: 'donjon',  gx: 3412, gy: 953, name: 'Tour du Kobold',  					desc: "", link: '' },
		//#endregion P1 Markers > Donjon
		//#region P1 Markers > Régions
    { id: 'm1r1',  type: 'région',  gx: 1801, gy: 4284, name: 'Ville de Départ',                    desc: "La ville de départ est un havre paisible dans un monde virtuel encore inconnu. C'est ici que chaque aventure commence", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/ville-de-depart' },
    { id: 'm1r2',  type: 'région',  gx: 1542, gy: 3432, name: 'Hanaka',                             desc: "Un hameau boisé niché entre les collines où les sangliers rôdent à la lisière. Berceau des premiers affrontements", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/hanaka' },
    { id: 'm1r3',  type: 'région',  gx: 2550, gy: 3811, name: 'Vallée des Loups',                   desc: "Un vallon brumeux où résonnent encore les hurlements.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-loups' },
    { id: 'm1r4',  type: 'région',  gx: 1339, gy: 3064, name: 'Marécage Putride',                   desc: "Un marais dense et hostile, où la brume empoisonne l'air.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/marecage-putride' },
    { id: 'm1r5',  type: 'région',  gx: 1840, gy: 3543, name: 'Zone des Sangliers',                 desc: "Un territoire sauvage où les sangliers règnent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/zone-sanglier' },
    { id: 'm1r6',  type: 'région',  gx: 948,  gy: 4189, name: 'Vallée des Pétales',                 desc: "Une vallée enchantée où les pétales dansent au vent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-petales' },
    { id: 'm1r7',  type: 'région',  gx: 2839, gy: 4686, name: 'Château Abandonné',                  desc: "Les ruines d'un château oublié, rongé par le temps.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/chateau-abandonne' },
    { id: 'm1r8',  type: 'région',  gx: 3135, gy: 3676, name: 'Mizunari',                           desc: "Petit village paisible niché au bord d'un lac clair.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mizunari' },
    { id: 'm1r9',  type: 'région',  gx: 3305, gy: 4079, name: "Archipel d'Ika",                     desc: "Un archipel tropical où les tortues géantes se rassemblent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/archipel-dika' },
    { id: 'm1r10', type: 'région',  gx: 2311.5, gy: 3200, name: 'Quartier OG',                        desc: "Le bastion de la Guilde OG, réputée et redoutée.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/quartier-og' },
    { id: 'm1r11', type: 'région',  gx: 1166,  gy: 3531, name: 'Cyclorim',                           desc: "Une arène antique taillée dans la roche rouge.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cyclorim' },
    { id: 'm1r12', type: 'région',  gx: 4134, gy: 3891, name: 'Mine de Geldorak',                   desc: "Creusée au coeur de la montagne.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-geldorak' },
    { id: 'm1r13', type: 'région',  gx: 2863, gy: 2972, name: 'CastelBrume',                        desc: "Perché au sommet d'une crête oubliée.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/castelbrume' },
    { id: 'm1r14', type: 'région',  gx: 438,  gy: 3038, name: 'Vallhat',                            desc: "Perchée au sommet d'un massif venteux.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallhat' },
    { id: 'm1r15', type: 'région',  gx: 4027, gy: 1991, name: 'Citadelle des Neiges',               desc: "Autrefois bastion imprenable.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/citadelle-des-neiges' },
    { id: 'm1r16', type: 'région',  gx: 364,  gy: 2431, name: 'Jardin des Géants',                  desc: "Un lieu oublié où la nature a repris ses droits.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/jardin-des-geants' },
    { id: 'm1r17', type: 'région',  gx: 2560, gy: 2811, name: 'Le Lac des Nénuphars',               desc: "Calme et mystère entourent ses eaux troubles...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/le-lac-des-nenuphars' },
    { id: 'm1r18', type: 'région',  gx: 3314, gy: 1605, name: 'Tolbana',                            desc: "Érigé à flanc de montagne.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tolbana' },
    { id: 'm1r20', type: 'région',  gx: 1571, gy: 1959, name: 'Virelune',                           desc: "Niché au bord d'un gouffre marin insondable.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/virelune' },
    { id: 'm1r21', type: 'région',  gx: 2000, gy: 761,  name: 'Candelia',                           desc: "Blotti entre les pics abrupts.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/candelia' },
    { id: 'm1r22', type: 'région',  gx: 3412, gy: 953, name: 'Tour du Kobold',                     desc: "Une ancienne tour en ruine.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tour-du-kobold' },
    { id: 'm1r23', type: 'région',  gx: 2465, gy: 1709, name: 'Mine de Pic de Cristal',             desc: "Cette ancienne mine renferme des cristaux.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-pic-de-cristal' },
    { id: 'm1r24', type: 'région',  gx: 3047, gy: 1174, name: 'Cristal de Tolbana',                 desc: "Des cristaux luminescents aux propriétés mystérieuses.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cristal-de-tolbana' },
    { id: 'm1r25', type: 'région',  gx: 1232, gy: 1400, name: "Arakh'Nol",                          desc: "Dans les profondeurs d'Arakh'Nol, la lumière peine à percer.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/arakhnol' },
    { id: 'm1r26', type: 'région',  gx: 4771, gy: 2399, name: 'Guilde Marchande',                   desc: "Le Quartier général de la Guilde des Marchands.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/guilde-marchande' },
		//#endregion P1 Markers > Régions
		//#region P1 Markers > Ressources
    { id: 'm1t1',  type: 'ressource', emoji: '🌾', gx: 2348, gy: 3686, name: 'Allium',              desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#alliums' },
		{ id: 'm1t1',  type: 'ressource', emoji: '🌾', gx: 2302, gy: 3679, name: 'Allium',              desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#alliums' },
		{ id: 'm1t1',  type: 'ressource', emoji: '🌾', gx: 2325, gy: 3618, name: 'Allium',              desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#alliums' },
    { id: 'm1t2',  type: 'ressource', emoji: '🌾', gx: 2371, gy: 3633, name: 'Blé',                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#ble' },
    { id: 'm1t3',  type: 'ressource', emoji: '🌳', gx: 2458, gy: 4289, name: 'Chêne de Forêt',      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm1t4',  type: 'ressource', emoji: '🌳', gx: 2997, gy: 3488, name: 'Chêne Proche',        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm1t5',  type: 'ressource', emoji: '🌳', gx: 1794, gy: 1155, name: 'Bouleau',             desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#bouleau' },
		//#endregion P1 Markers > Ressources
		//#region P1 Markers > Artisant
    { id: 'm1a1',  type: 'artisant', gx: 1772, gy: 4135, name: "Forgeron d'Armes",                  desc: "Forgeron des Armes pour Débutants", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armes_vdp' },
    { id: 'm1a2',  type: 'artisant', gx: 1760, gy: 4145, name: "Forgeron d'Armures",                desc: "Forgeron des Armures pour Débutants", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armures_vdp' },
    { id: 'm1a3',  type: 'artisant', gx: 1767, gy: 4126, name: "Forgeron d'Accessoires",            desc: "Forgeron des Accessoires pour Débutants", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_vdp' },
    { id: 'm1a4',  type: 'artisant', gx: 1789, gy: 4609, name: 'Marchand Étrange',                  desc: "Marchand suspect trainant derrière la Cathédrale", link: '../Bestiaire/bestiaire.html#personnages/marchand_etrange_vdp' },
    { id: 'm1a5',  type: 'artisant', gx: 1787, gy: 4697, name: "Forgeron d'Accessoires en Cuivre",  desc: "Forgeron des Accessoires en Cuivre pour Débutants", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_cuivre_vdp' },
    { id: 'm1a6',  type: 'artisant', gx: 1776, gy: 4684, name: "Forgeron d'Accessoires en Fer",     desc: "Forgeron des Accessoires en Fer pour Débutants", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_fer_vdp' },
    { id: 'm1a7',  type: 'artisant', emoji: '🪛', gx: 1776, gy: 4693, name: 'Refaçonneur',                       desc: "Permet la fabrication de ficelle en tout genre", link: '../Bestiaire/bestiaire.html#personnages/refaconneur_vdp' },
    { id: 'm1a8',  type: 'artisant', gx: 2397, gy: 3568, name: 'Forgeron de Lingots Cuivre & Fer',  desc: "Forgeron de Lingots de Cuivre et de Fer", link: '../Bestiaire/bestiaire.html#personnages/forgeron_lingot_vdp' },
    { id: 'm1a13', type: 'artisant', emoji: '🪓', gx: 2467, gy: 4289, name: 'Bucheron',                          desc: "Bucheron permettant la Réalisation de Planches", link: '../Bestiaire/bestiaire.html#personnages/bucheron_vdp' },
    { id: 'm1a14', type: 'artisant', emoji: '⚗️', gx: 1771, gy: 4096, name: 'Alchimiste',                        desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: '../Bestiaire/bestiaire.html#personnages/alchimiste_vdp' },
    { id: 'm1a15', type: 'artisant', emoji: '⚗️',  gx: 3335, gy: 1613, name: 'Alchimiste',                        desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: '../Bestiaire/bestiaire.html#personnages/alchimiste_tolbana' },
		//#endregion P1 Markers > Artisant
		//#region P1 Markers > Repreneur Butin
    { id: 'm1b1',  type: 'repreneur_butin', gx: 1788, gy: 4179, name: 'Repreneur des Débutants',       desc: "Achète des ressources digne d'un Débutant", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_vdp' },
    { id: 'm1b2',  type: 'repreneur_butin', gx: 1509, gy: 3415, name: 'Repreneur de la Forêt',         desc: "Achète des ressources de la Forêt", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_hanaka' },
    { id: 'm1b3',  type: 'repreneur_butin', gx: 3155, gy: 3690, name: 'Repreneur Champêtre',           desc: "Achète des ressources des Champs", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_mizunari' },
    { id: 'm1b4',  type: 'repreneur_butin', gx: 413,  gy: 3089, name: 'Repreneur des Marécages',      desc: "Achète des ressources Gluantes", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_vallhat' },
    { id: 'm1b5',  type: 'repreneur_butin', gx: 1598, gy: 1947, name: 'Repreneur des Mers',            desc: "Achète des ressources Maritimes", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_virelune' },
    { id: 'm1b6',  type: 'repreneur_butin', gx: 2832, gy: 4709, name: 'Repreneur de Squelette',        desc: "Achète des ressources venant des Morts", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_chateau_abandonne' },
    { id: 'm1b7',  type: 'repreneur_butin', gx: 3295, gy: 1629, name: 'Repreneur Agguerie de Tolbana', desc: "Achète des ressources digne d'un Combattant Agguerie", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_tolbana' },
	  { id: 'm1b8',  type: 'repreneur_butin', gx: 1488, gy: 3403, name: 'Repreneur d\'Armes', desc: "Achète des Armes de niveau 5", link: '../Bestiaire/bestiaire.html#personnages/repreneur_arme_hanaka' },
		//#endregion P1 Markers > Repreneur Butin
		//#region P1 Markers > Marchand
    { id: 'm1m1',  type: 'marchand', emoji: '⚔️', gx: 1788, gy: 4162, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: '../Bestiaire/bestiaire.html#personnages/repreneur_equipement_vdp' },
    { id: 'm1m2',  type: 'marchand', emoji: '⚔️', gx: 1503, gy: 3391, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: '../Bestiaire/bestiaire.html#personnages/repreneur_equipement_hanaka' },
    { id: 'm1m3',  type: 'marchand', gx: 485,  gy: 3058, name: "Marchand d'Accessoires Gluant",   desc: "Vends des Accessoires Gluants", link: '../Bestiaire/bestiaire.html#personnages/marchand_accessoire_vallhat' },
    { id: 'm1m4',  type: 'marchand', gx: 3320, gy: 1605, name: "Marchand d'Accessoires Tolbana",   desc: "Vends des Accessoires Résistants", link: '../Bestiaire/bestiaire.html#personnages/marchand_accessoire_tolbana' },
    { id: 'm1m5',  type: 'marchand', emoji: '⛏️', gx: 1813, gy: 4162, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_vdp' },
    { id: 'm1m6',  type: 'marchand', emoji: '⛏️', gx: 1587, gy: 1985, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_virelune' },
    { id: 'm1m7',  type: 'marchand', emoji: '⛏️', gx: 3335, gy: 1621,  name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_tolbana' },
    { id: 'm1m8',  type: 'marchand', gx: 3309, gy: 1642, name: "Marchand de Consommables", desc: "Vends des Utilitaires comme des Potions ou des Parchemins", link: '../Bestiaire/bestiaire.html#personnages/marchand_consommable_tolbana' },
    { id: 'm1m9',  type: 'marchand', emoji: '⚔️', gx: 3316, gy: 1642, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: '../Bestiaire/bestiaire.html#personnages/repreneur_equipement_tolbana' },
    { id: 'm1m10', type: 'marchand', emoji: '⛏️', gx: 2002, gy: 822, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_candelia' },
    { id: 'm1m11', type: 'marchand', emoji: '⛏️', gx: 3150, gy: 3702, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_mizunari' },
		{ id: 'm1m12', type: 'marchand', emoji: '💵', gx: 1457, gy: 1145, name: "Marchand Itinérant",        desc: "Vends & Achète à Arakh'Nol nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_candelia' },
    { id: 'm1m13', type: 'marchand', emoji: '💵', gx: 3484, gy: 1332, name: "Marchand Itinérant",        desc: "Vends & Achète à Tolbana nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_tolbana' },
    { id: 'm1m14', type: 'marchand', emoji: '💵', gx: 3600, gy: 3400, name: "Marchand Itinérant",        desc: "Vends & Achète à Mizunari nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_mizunari' },
    { id: 'm1m15', type: 'marchand', emoji: '💵', gx: 1415, gy: 2976, name: "Marchand Itinérant",        desc: "Vends & Achète Au Marécage Putride nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_hanaka' },
    { id: 'm1m16', type: 'marchand', emoji: '💵', gx: 582, gy: 3189, name: "Marchand Itinérant",        desc: "Vends & Achète à Vallhat nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_vallhat' },
    { id: 'm1m17', type: 'marchand', emoji: '💵', gx: 1205, gy: 2100, name: "Marchand Itinérant",        desc: "Vends & Achète à Virelune nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_virelune' },
    { id: 'm1m18', type: 'marchand', emoji: '💵', gx: 2080, gy: 3765, name: "Marchand Itinérant",        desc: "Vends & Achète à la Zone des Sangliers nombreux objets locaux et originaire du Palier 1", link: '../Bestiaire/bestiaire.html#personnages/marchand_itinerant_vdp' },
		{ id: 'm1m19', type: 'marchand', emoji: '👻', gx: 2391, gy: 989, name: "Marchand Kazor",       			 desc: "Vends des Armes, Accessoires & autre en échange de quelques Pièces de Kazor", link: '../Bestiaire/bestiaire.html#personnages/marchand_kazor' },
		//#endregion P1 Markers > Marchand
		//#region P1 Markers > Clé
    { id: 'm1c1', type: 'clef', emoji: '🗝️', gx: 1812, gy: 4180, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: '../Bestiaire/bestiaire.html#personnages/cle_vdp' },
    { id: 'm1c2', type: 'clef', emoji: '🗝️', gx: 4287, gy: 3893, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: '../Bestiaire/bestiaire.html#personnages/cle_mine_geldorak' },
    { id: 'm1c3', type: 'clef', emoji: '🗝️', gx: 2388, gy: 2421, name: 'Clef du Donjon Labyrinthe des Déchus', desc: "Clef permettant d'ouvrir la porte du Donjon du Labyrinthe des Déchus", link: '../Bestiaire/bestiaire.html#personnages/cle_labyrinthe' },
    { id: 'm1c4', type: 'clef', emoji: '🗝️', gx: 1014,  gy: 1189, name: "Clef du Donjon Xal'Zirith",            desc: "Clef permettant d'ouvrir la porte du Donjon Xal'Zirith",                link: '../Bestiaire/bestiaire.html#personnages/cle_xal' },
    { id: 'm1c6', type: 'clef', emoji: '💍', gx: 4216, gy: 1801, name: "Fabricant Secret de l'Ours",           desc: "Permet la confection Secrète du Bracelet de Glace",     link: '../Bestiaire/bestiaire.html#personnages/secret_citadelle_neiges' },
    { id: 'm1c8', type: 'clef', emoji: '💍', gx: 391,  gy: 3065, name: 'Fabricant Secret des Slimes',          desc: "Permet la confection Secrète de l'Anneau Gluant",       link: '../Bestiaire/bestiaire.html#personnages/secret_vallaht' },
    { id: 'm1c9', type: 'clef', emoji: '💍', gx: 1114, gy: 1172, name: "Fabricant Secret des Araignées",       desc: "Permet la confection Secrète du Collier d'Aragorn",     link: '../Bestiaire/bestiaire.html#personnages/secret_arakh\'nol' },
    { id: 'm1c11', type: 'clef', emoji: '💍', gx: 2494, gy: 3701, name: "Fabricant Secret des Loups",       desc: "Permet la confection Secrète des Gants des Loups",     link: '../Bestiaire/bestiaire.html#personnages/secret_loups' },
    { id: 'm1c12', type: 'clef', emoji: '💍', gx: 1160, gy: 3545, name: "Fabricant Secret des Squelettes",       desc: "Permet la confection Secrète du Crâne de Squelette",     link: '../Bestiaire/bestiaire.html#personnages/secret_cyclorim' },
    { id: 'm1c13', type: 'clef', emoji: '🩸', gx: 867, gy: 4028, name: "Marchand Occulte Capuche Robe Crâne",       desc: "Permet l'achat de la Capuche, de la Robe et du Crâne Occulte",     link: 'https://drabiot.github.io/Veilleurs/Bestiaire/bestiaire.html#personnages/occulte_pecheur' },
    { id: 'm1c14', type: 'clef', emoji: '🩸', gx: 3348, gy: 1634, name: "Marchand Occulte Bracelet",       desc: "Permet l'achat du Bracelet Occulte",     link: 'https://drabiot.github.io/Veilleurs/Bestiaire/bestiaire.html#personnages/occulte_bracelet_p1' },
    { id: 'm1c15', type: 'clef', emoji: '🩸', gx: 3371, gy: 1698, name: "Marchand Occulte Gants",       desc: "Permet l'achat des Gants Occultes",     link: 'https://drabiot.github.io/Veilleurs/Bestiaire/bestiaire.html#personnages/occulte_gants_p1' },
    { id: 'm1c16', type: 'clef', emoji: '🩸', gx: 3319, gy: 1722, name: "Marchand Occulte Amulette",       desc: "Permet l'achat de l'Amulette Occulte",     link: 'https://drabiot.github.io/Veilleurs/Bestiaire/bestiaire.html#personnages/occulte_amulette_p1' },
    { id: 'm1c17', type: 'clef', emoji: '🩸', gx: 3320, gy: 1665, name: "Marchand Occulte Anneau",       desc: "Permet l'achat de l'Anneau Occulte",     link: 'https://drabiot.github.io/Veilleurs/Bestiaire/bestiaire.html#personnages/occulte_anneau_p1' },
    //#endregion P1 Markers > Clé
		//#region P1 Markers > Quête Secondaire
    { id: 'm1s1',  type: 'quête_secondaire',  gx: 1877, gy: 3991, name: "Tilda",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/tilda' },
    { id: 'm1s2',  type: 'quête_secondaire',  gx: 1885, gy: 4009, name: "Lila",                          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/lila' },
    { id: 'm1s3',  type: 'quête_secondaire',  gx: 2069, gy: 4291, name: "Varn",                          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/varn' },
    { id: 'm1s4',  type: 'quête_secondaire',  gx: 1745, gy: 4724, name: "Orin",                          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/ori' },
    { id: 'm1s5',  type: 'quête_secondaire',  gx: 1753, gy: 4730, name: "Inari",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/inari' },
    { id: 'm1s6',  type: 'quête_secondaire',  gx: 1269, gy: 4308, name: "Meiko",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/meiko' },
    { id: 'm1s7',  type: 'quête_secondaire',  gx: 1271, gy: 4317, name: "Saria",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/saria' },
    { id: 'm1s8',  type: 'quête_secondaire',  gx: 1556, gy: 4316, name: "Rikyu",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/rikyu' },
    { id: 'm1s9',  type: 'quête_secondaire',  gx: 1534, gy: 4329, name: "Bunta",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/bunta' },
    { id: 'm1s10',  type: 'quête_secondaire', gx: 1635, gy: 4039, name: "Nacht",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/nacht' },
    { id: 'm1s11',  type: 'quête_secondaire', gx: 2207, gy: 4187, name: "Milla",                       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/milla' },
    { id: 'm1s12',  type: 'quête_secondaire', gx: 1532, gy: 3376, name: "Genzo",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/genzo' },
    { id: 'm1s13',  type: 'quête_secondaire', gx: 1526, gy: 3377, name: "Bartok",                       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/bartok' },
    { id: 'm1s14',  type: 'quête_secondaire', gx: 1438, gy: 3400, name: "Greta",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/greta' },
    { id: 'm1s15',  type: 'quête_secondaire', gx: 1407, gy: 3436, name: "Soeur Therra",                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/soeur-therra' },
    { id: 'm1s16',  type: 'quête_secondaire', gx: 1502, gy: 3532, name: "Rina",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/rina' },
    { id: 'm1s17',  type: 'quête_secondaire', gx: 1502, gy: 3559, name: "Maya",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/maya' },
    { id: 'm1s18',  type: 'quête_secondaire', gx: 1357, gy: 3441, name: "Toban",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/toban' },
    { id: 'm1s19',  type: 'quête_secondaire', gx: 3396, gy: 2947, name: "Fira",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/fira' },
    { id: 'm1s20',  type: 'quête_secondaire', gx: 3291, gy: 2907, name: "Corentin",                     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/corentin' },
    { id: 'm1s21', type: 'quête_secondaire',  gx: 3224, gy: 2891, name: "Jean",                          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/jean' },
    { id: 'm1s22', type: 'quête_secondaire',  gx: 3084, gy: 1913, name: "Horace",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/tolbana/horace' },
    { id: 'm1s23', type: 'quête_secondaire',  gx: 1868, gy: 2113, name: "Haruto",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/haruto' },
    { id: 'm1s24', type: 'quête_secondaire',  gx: 1600, gy: 2006, name: "Sam",                           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/sam' },
    { id: 'm1s25', type: 'quête_secondaire',  gx: 1565, gy: 1968, name: "Juliette",                      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/juliette' },
    { id: 'm1s26', type: 'quête_secondaire',  gx: 1562, gy: 2000, name: "Monique",                       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/monique' },
    { id: 'm1s27', type: 'quête_secondaire',  gx: 1624, gy: 1854, name: "Luc",                           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/luc' },
    { id: 'm1s28', type: 'quête_secondaire',  gx: 1700, gy: 1018, name: "Gilbert",                       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilbert' },
    { id: 'm1s29', type: 'quête_secondaire',  gx: 2019, gy: 877,  name: "Pierre",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/pierre' },
    { id: 'm1s30', type: 'quête_secondaire',  gx: 2015, gy: 834,  name: "Yannis",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/yannis' },
    { id: 'm1s31', type: 'quête_secondaire',  gx: 1992, gy: 833,  name: "Roméo",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/roméo' },
    { id: 'm1s32', type: 'quête_secondaire',  gx: 1957, gy: 815,  name: "Tomoko",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/tomoko' },
    { id: 'm1s33', type: 'quête_secondaire',  gx: 1957, gy: 793,  name: "Gilmar",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilmar' },
    { id: 'm1s34', type: 'quête_secondaire',  gx: 1984, gy: 753,  name: "Émilie",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/emilie' },
    { id: 'm1s35', type: 'quête_secondaire',  gx: 3150, gy: 3712, name: "Phares",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/phares' },
    { id: 'm1s36', type: 'quête_secondaire',  gx: 3139, gy: 3696, name: "Louise",                        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/louise' },
    { id: 'm1s37', type: 'quête_secondaire',  gx: 3113, gy: 3702, name: "Elwyn",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/elwyn' },
    { id: 'm1s38', type: 'quête_secondaire',  gx: 3130, gy: 3666, name: "Michelle",                      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/michelle' },
    { id: 'm1s39', type: 'quête_secondaire',  gx: 3151, gy: 3671, name: "Martine",                       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/martine' },
    { id: 'm1s40', type: 'quête_secondaire',  gx: 511,  gy: 3042, name: "Par les Branches des Anciens",  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/par-les-branches-des-anciens' },
    { id: 'm1s41', type: 'quête_secondaire',  gx: 492,  gy: 3028, name: "Saya",                          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/saya' },
    { id: 'm1s42', type: 'quête_secondaire',  gx: 479,  gy: 3013, name: "Ayaka",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/ayaka' },
    { id: 'm1s43', type: 'quête_secondaire',  gx: 429,  gy: 3046, name: "Daiki",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/daiki' },
		//#endregion P1 Markers > Quête Secondaire
		//#region P1 Markers > Quête Principale
    { id: 'm1p1',  type: 'quête_principale', gx: 1808,  gy: 3650, name: "1 - Un nouveau départ",             desc: "Parlez à Abraham et éliminez des Sangliers corrompues", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/un-nouveau-depart' },
    { id: 'm1p2',  type: 'quête_principale', gx: 1562,  gy: 3410, name: "2 - La vieille Mara",               desc: "Parlez à Mara pour y entendre ses visions", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/la-vieille-mara' },
    { id: 'm1p3',  type: 'quête_principale', gx: 1421,  gy: 3091, name: "3 - La Corruption",                 desc: "Trouvez l'origine des visions de la Vielle Mara", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/la-corruption' },
    { id: 'm1p4',  type: 'quête_principale', gx: 1839,  gy: 4530, name: "4 - Revenir plus Fort",             desc: "Entrainez vous et allez à la rencontre du Maître Épéiste", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/revenir-plus-fort' },
    { id: 'm1p5',  type: 'quête_principale', gx: 3133,  gy: 3665, name: "5 - L'Aventure Commence",           desc: "Dirigez vous à Mizunari afin de compléter vos premiers exploits en tant qu'aventurier", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/laventure-commence' },
    { id: 'm1p6',  type: 'quête_principale', gx: 3324,  gy: 3784, name: "6 - Le ravage des Nephentes",       desc: "Trouvez Harrold le mari d'Elma", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/le-ravage-des-nephentes' },
    { id: 'm1p7',  type: 'quête_principale', gx: 2844,  gy: 2994, name: "7 - Velka",                         desc: "Allez à la rencontre de Velka", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/velka' },
    { id: 'm1p8',  type: 'quête_principale', gx: 2862,  gy: 4490, name: "8 - Les Ruines Maudites",           desc: "Cherchez Erik qui vous a été recommandé par Velka", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/les-ruines-maudites' },
    { id: 'm1p9',  type: 'quête_principale', gx: 2780,  gy: 4428, name: "9 - Le Donjon des Ruines Maudites", desc: "Récupérez de quoi rentrer dans le Sous-Donjon Nasgul", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/le-donjon-des-ruines-maudites' },
    { id: 'm1p10', type: 'quête_principale', gx: 2780,  gy: 4428, name: "10 - Nasgul: Protecteur Maudit",    desc: "Cherchez le Spectre Archiviste qui vous expliquera comment défaire le Maître du Donjon, et vennez en à bout!", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/nasgul-protecteur-maudit' },
    { id: 'm1p11', type: 'quête_principale', gx: 4274,  gy: 3890, name: "11 - Donjon: Mine de Geldorak",     desc: "Venez à bout du Donjon Geldorak", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/donjon-mine-de-geldorak' },
    { id: 'm1p12', type: 'quête_principale', gx: 1839,  gy: 4530, name: "12 - Retour à la Cathédrale",       desc: "Retournez voir le Maître Épéiste", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/retour-a-la-cathedrale' },
    { id: 'm1p13', type: 'quête_principale', gx: 422,   gy: 3058, name: "13 - L'Homme à capuche",            desc: "Demandez aux habitants de Vallhat si ils savent où se trouve un mystérieux homme à capuche", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/lhomme-a-capuche' },
    { id: 'm1p14', type: 'quête_principale', gx: 319,   gy: 3190, name: "14 - Gorbel: Slime Imposant",       desc: "Venez à bout du terrible slime et fouillez l'homme à capuche", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/gorbel-slime-imposant' },
    { id: 'm1p15', type: 'quête_principale', gx: 1839,  gy: 4530, name: "15 - De Retour à la Cathédrale",    desc: "Allez une nouvelle fois raconter vos péripéties au Maître Épéiste", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/de-retour-a-la-cathedrale' },
    { id: 'm1p16', type: 'quête_principale', gx: 2384,  gy: 2417, name: "16 - Le Sceau des Anciens",         desc: "Allez voir Catherine, qui vous permettra de reconstruire le Sceau des Anciens", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/le-sceau-des-anciens' },
    { id: 'm1p17', type: 'quête_principale', gx: 2380,  gy: 2411, name: "17 - Wali",                         desc: "Parlez à Wali", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/wali' },
    { id: 'm1p18', type: 'quête_principale', gx: 3203,  gy: 1455, name: "18 - Méphisto",                     desc: "Parlez au Maître de Wali", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/mephisto' },
    { id: 'm1p19', type: 'quête_principale', gx: 3234,  gy: 1484, name: "19 - Wali l'Apprenti",              desc: "Donnez à Wali les informations donné de Méphisto afin de continuer votre aventure", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/wali-lapprenti' },
    { id: 'm1p20', type: 'quête_principale', gx: 3234,  gy: 1484, name: "20 - La Base du Parchemin",         desc: "Ramenez à Émy les matériaux pour concevoir la Base du Parchemin permettant l'ouverture de la Tour du Kobold", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/la-base-du-parchemin' },
    { id: 'm1p21', type: 'quête_principale', gx: 1573,  gy: 1986, name: "21 - Ramoon",                       desc: "Parlez à Ramoon", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/ramoon' },
    { id: 'm1p22', type: 'quête_principale', gx: 1573,  gy: 1986, name: "22 - Chasse aux Poissons Requin",   desc: "Parlez à Malrik qui vous demandera de tuer des Poissons Requin à Virelune", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/chasse-aux-poissons-requin' },
    { id: 'm1p23', type: 'quête_principale', gx: 1420,  gy: 1985, name: "23 - Nymbréa: l'Ombre du Lac",      desc: "Tuer le Léviathan Nymbréa", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/nymbrea-lombre-du-lac' },
    { id: 'm1p24', type: 'quête_principale', gx: 1007,   gy: 1180, name: "24 - Sanctuaire de Xal'Zirith",     desc: "Parlez à Silrix", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/sanctuaire-de-xalzirith' },
    { id: 'm1p25', type: 'quête_principale', gx: 3234,  gy: 1484, name: "25 - Retour à Tolbana",             desc: "Retournez voir Émy pour qu'elle améliore votre Parchemin avec tout vos nouveaux matériaux", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/retour-a-tolbana' },
    { id: 'm1p26', type: 'quête_principale', gx: 3203,  gy: 1455, name: "26 - Le Parchemin de Sceau",        desc: "Retournez voir Méphisto", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/le-parchemin-de-sceau' },
    { id: 'm1p27', type: 'quête_principale', gx: 3260,  gy: 1389, name: "27 - Le Tombeau des Harald",        desc: "Allez voir le Roi de Tolbana, afin qu'il vous donne accès à la tombe de ses ancêtres et bénissent votre Parchemin pour ouvrir les Portes de la Tour du Kobold", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/e-tombeau-des-harald' },
    { id: 'm1p28', type: 'quête_principale', gx: 3260,  gy: 1389, name: "28 - Donjon: Le Kobold",            desc: "Retournez voir le roi Harald et menez une expédition punitive, afin de défaire le roi Kobold: Illfang", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-principales/donjon-le-kobold' },
		//#endregion P1 Markers > Quête Principale
		//#region P1 Markers > Boss
		{ id: 'm1boss1', type: 'boss', emoji: '🐗', name: "Pumba Corrompu", desc: "Une bête sauvage issue des forêts du premier palier. Il charge sans relâche, animé d'une rage primitive", link: '../Bestiaire/bestiaire.html#monstres/pumba_corrompu', coords: [
			{ gx: 1760, gy: 3525 },
			{ gx: 1925, gy: 3525 },
			{ gx: 1985, gy: 3635 },
		]},
		{ id: 'm1boss2', type: 'boss', emoji: '🐺', name: "Albal", desc: "Un loup solitaire aux yeux d'argent glacés. Son passage laisse une brume et le silence", link: '../Bestiaire/bestiaire.html#monstres/albal', coords: [
			{ gx: 2617, gy: 3836 },
			{ gx: 2388, gy: 3834 },
			{ gx: 2510, gy: 3964 },
		]},
		{ id: 'm1boss3', type: 'boss', emoji: '🌳', name: "Gardien Colossal", desc: "Forgé dans la pierre et éveillé par la magie ancienne, il garde les terres oubliées contre toute intrusion. Ses pas seuls font trembler la forêt...", link: '../Bestiaire/bestiaire.html#monstres/gardien_colossal', coords: [
			{ gx: 1288, gy: 3157 },
			{ gx: 1069, gy: 3252 },
			{ gx: 1246, gy: 2974 },
		]},
		{ id: 'm1boss4', type: 'boss', emoji: '👑', name: "Gorbel", desc: "Un colosse gélatineux, maître des essaims de slimes. Il écrase tout sur son passage, lentement mais sûrement", link: '../Bestiaire/bestiaire.html#monstres/gorbel', coords: [
			{ gx: 300, gy: 3200 },
		]},
		{ id: 'm1boss5', type: 'boss', emoji: '🐻', name: "Ours de Glace", desc: "Né dans les cavernes les plus froides des montagnes, l'Ours de Glace incarne la force brute du Nord. Son rugissement fait frissonner l'air, et son souffle glacé fige tout sur son passage", link: '../Bestiaire/bestiaire.html#monstres/ours_glace', coords: [
			{ gx: 4000, gy: 2010 },
		]},
		{ id: 'm1bosskazor', type: 'boss', emoji: '⛏️', name: "Kazor", desc: "Terrible World Boss du Palier 1 qui déverse le Labyrinthe des Déchus sur l'Étage", link: '../Bestiaire/bestiaire.html#monstres/kazor', coords: [
			{ gx: 2438, gy: 959 },
		]},
		//#endregion P1 Markers > Boss
		//#region P1 Markers > Autre
		{ id: 'm1other1',  type: 'autre', emoji: '💎', gx: 1781, gy: 4138, name: "Maître des Runes",    desc: "Donne des Quêtes Quotidiennes permettant le gains de Cols & de Runes", link: '../Bestiaire/bestiaire.html#personnages/maitre_des_runes' },
		{ id: 'm1other2',  type: 'autre', gx: 1807, gy: 4295, name: "David Goodenough Palier 1",    desc: "Permet d'être au bon niveau suite à des Bugs de Gain d'Exp au Palier 1", link: '../Bestiaire/bestiaire.html#personnages/david_goodenough1' },
		//#endregion P1 Markers > Autre
	],
	//#endregion P1 Markers
  2: [
		//#region P2 Markers > Donjon
    { id: 'm2d1',  type: 'donjon',  gx: 506, gy: -724, name: 'Donjon Ruche de Melliona',                  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/donjons/donjon-ruche-de-melliona' },
		//#endregion P2 Markers > Donjon
		//#region P2 Markers > Régions
    { id: 'm2r1',  type: 'région',  gx: 118, gy: -68, name: 'Lac des Taureaux',                           desc: "Un lac asséché, dont le sol craquelé est parcouru des taureaux errants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/monstres/carte/lac-des-taureaux' },
    { id: 'm2r2',  type: 'région',  gx: 64, gy: -348, name: 'Urbus',                                      desc: "Ville marchande prospère, garde l'entrée du palier avec ses étals animés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/monstres/carte/urbus' },
    { id: 'm2r3',  type: 'région',  gx: -583, gy: -264, name: 'Kaelor',                                   desc: "Ville fortifié, imprenable et dévouée au Dieu de la Guerre", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/monstres/carte/kaelor' },
    { id: 'm2r4',  type: 'région',  gx: -372, gy: -556, name: 'Désert des Crocs Argentés',                desc: "Un désert impitoyable où rodent des loups aux crocs argentés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/monstres/carte/desert_des_crocs_argentes' },
    { id: 'm2r5',  type: 'région',  gx: 484, gy: -665, name: 'Forêt Sucrée',                              desc: "Une forêt parfumée de miel, habitée par des ours et le bourdonnement des abeilles", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/foret-sucree' },
    { id: 'm2r6',  type: 'région',  gx: 506, gy: -724, name: 'Ruche de Melliona',                         desc: "Une ruche géante et bourdonnante, royaume de Melliona et ses abeilles", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/ruche-de-melliona' },
    { id: 'm2r7',  type: 'région',  gx: -550, gy: 476, name: 'Forêt des Ailes d\'Émeraude',               desc: "Une forêt luxuriante, refuge des harpies aux ailes vertes émeraude", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/foret-des-ailes-demeraude' },
    { id: 'm2r8',  type: 'région',  gx: -780, gy: 171, name: 'Baie des Monstres Ondoyante',               desc: "Un marais tourbillonnant habité par des harpies de foudre aux cris perçants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/baie-des-monstres-ondoyante' },
    { id: 'm2r9',  type: 'région',  gx: -6, gy: 181, name: 'Sanctuaire de Khesûn',                        desc: "Un sanctuaire abandonné dans le désert, peuplé de squelettes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/sanctuaire-de-khesun' },
    { id: 'm2r10',  type: 'région',  gx: 798, gy: 253, name: 'Oasis Secret',                              desc: "Une oasis secrète où des pécheurs vivent au rythme de l'eau et du silence", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/oasis-secret' },
    { id: 'm2r11',  type: 'région',  gx: -88, gy: -92, name: 'Baobab Millénaire',                         desc: "Un baobab millénaire aux racines géantes, gardien silencieux du temps et des légendes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/baobab-millenaire' },
    { id: 'm2r12',  type: 'région',  gx: 570, gy: -470, name: 'Autel des Deux Lunes',                     desc: "Personne ne détient d'information liée à ce lieu. Simplement deux autels ^portant une lune chacune...", link: 'http://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/autel-des-deux-lunes' },
    { id: 'm2r13',  type: 'région',  gx: -427, gy: 272, name: 'Taran',                                    desc: "Ville abandonné dans un caillou", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/taran' },
    { id: 'm2r14',  type: 'région',  gx: 721, gy: -281, name: 'Marome',                                   desc: "Petit village de marchands autosuffisant, uni par les prières à la déesse maternelle", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/marome' },
    { id: 'm2r15',  type: 'région',  gx: -430, gy: -428, name: 'Maisons des Ngangas',                     desc: "Maisons de Kwabeno et Kwabena, deux ermites perdus des montagnes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/maisons-des-ngangas' },
    { id: 'm2r16',  type: 'région',  gx: -160, gy: 795, name: 'Tour de Taurus',                           desc: "Une tour massive où résonnent les pas de Taurus, le Roi taureau redoutable", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/tour-de-taurus' },
		//#endregion P2 Markers > Régions
		//#region P2 Markers > Ressource
    { id: 'm2t1',  type: 'ressource', emoji: '🌳', gx: -88, gy: -92, name: 'Acacia',                      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/bucheron#acacia' },
    { id: 'm2t2',  type: 'ressource', emoji: '🌾', gx: -432, gy: 308, name: 'Sépal d\'Ambre',             desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/herboriste#sepal-dambre' },
    { id: 'm2t3',  type: 'ressource', emoji: '🌾', gx: -462, gy: 322, name: 'Épine d\'Oracile',           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/herboriste#epine-doracile' },
    { id: 'm2t3',  type: 'ressource', emoji: '🌾', gx: 84, gy: 248, name: 'Épine d\'Oracile',             desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/herboriste#epine-doracile' },
    { id: 'm2t3',  type: 'ressource', emoji: '🌾', gx: 491, gy: -97, name: 'Épine d\'Oracile',            desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/herboriste#epine-doracile' },
		//#endregion P2 Markers > Ressource
		//#region P2 Markers > Repreneur Butin
    { id: 'm2b1',  type: 'repreneur_butin', gx: 68, gy: -344, name: 'Repreneur des Ressources aux abords de Urbus',          desc: "Achète des ressources digne d'un Débutant", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_urbus' },
    { id: 'm2b2',  type: 'repreneur_butin', gx: -570, gy: -250, name: 'Repreneur des Ressources des Harpies',                desc: "Achète des ressources digne d'un Débutant", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_kaelor' },
    { id: 'm2b3',  type: 'repreneur_butin', gx: 708, gy: -277, name: 'Repreneur des Ressources du Sanctuaire de Khesûn',     desc: "Achète des ressources digne d'un Débutant", link: '../Bestiaire/bestiaire.html#personnages/repreneur_butin_marome' },
		//#endregion P2 Markers > Repreneur Butin
		//#region P2 Markers > Clé
    { id: 'm2c1', type: 'clef', emoji: '🗝️', gx: 162, gy: -315,  name: "Clef du Donjon Ruche de Melliona",                  desc: "Clef permettant d'ouvrir la porte du Donjon Ruche de Melliona",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#urbus-melliona' },
    { id: 'm2c1', type: 'clef', emoji: '🗝️', gx: 159, gy: -312,  name: "Clef du Donjon Tombeau du Nécromancien",            desc: "Clef permettant d'ouvrir la porte du Donjon Tombeau du Nécromancien",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#urbus-tombeau-du-necromancien' },
    { id: 'm2c3', type: 'clef', emoji: '💍', gx: 78, gy: -71, name: "Fabricant Secret des Taureaux",                         desc: "Permet la confection Secrète du Talisman Féroce",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#lac-des-taureaux' },
    { id: 'm2c4', type: 'clef', emoji: '💍', gx: -818, gy: 98, name: "Fabricant Secret de la Harpie Noyé",                   desc: "Permet la confection Secrète de l'Anneau de la Harpie Noyée",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#baie-des-monstres-ondoyante' },
    { id: 'm2c5', type: 'clef', emoji: '💍', gx: -618, gy: 529, name: "Fabricant Secret de la Harpie Écrasée",               desc: "Permet la confection Secrète de l'Anneau de la Harpie Écrasée",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#foret-des-ailes-demeraude' },
    { id: 'm2c5', type: 'clef', emoji: '💍', gx: -37, gy: 199, name: "Fabricant Secret du Sanctuaire",                       desc: "Permet la confection Secrète du Collier Runique",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#sanctuaire-de-khesun' },
		{ id: 'm2c6', type: 'clef', emoji: '💍', gx: -713, gy: -92, name: "Fabricant Secret de la Corruption",                    desc: "Permet la confection Secrète du très puissant Masque Corrompu",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/~/changes/107/carte/personnages/fabricants-clefs-et-secrets#corruption' },
		//#endregion P2 Markers > Clé
		//#region P2 Markers > Marchand
    { id: 'm2m1',  type: 'marchand', emoji: '⚔️', gx: -573, gy: -287, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: '../Bestiaire/bestiaire.html#personnages/marchand_equipement_kaelor' },
    { id: 'm2m2',  type: 'marchand', gx: -570, gy: -287, name: "Marchand d'Accessoires",   desc: "Vends des Accessoires de la faune du Palier 2", link: '../Bestiaire/bestiaire.html#personnages/marchand_accessoires_kaelor' },
    { id: 'm2m3',  type: 'marchand', emoji: '⛏️', gx: -583, gy: -284, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: '../Bestiaire/bestiaire.html#personnages/marchand_outils_kaelor' },
		//#endregion P2 Markers > Marchand
		//#region P2 Markers > Artisant
    { id: 'm2a1', type: 'artisant', emoji: '⚗️',  gx: -570, gy: -293, name: 'Alchimiste',               desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: '../Bestiaire/bestiaire.html#personnages/alchimiste_kaelor' },
    { id: 'm2a2', type: 'artisant', emoji: '🪓',  gx: -573, gy: -294, name: 'Bucheron',                 desc: "Bucheron permettant la Réalisation de Planches", link: '../Bestiaire/bestiaire.html#personnages/bucheron_kaelor' },
    { id: 'm2a3', type: 'artisant', emoji: '🪛',   gx: 2,    gy: -357, name: 'Refaçonneur',              desc: "Permet la fabrication de ficelle en tout genre", link: '../Bestiaire/bestiaire.html#personnages/refaconneur_urbus' },
    { id: 'm2a4', type: 'artisant',  gx: 115,  gy: -415, name: 'Forgeron d\'Accessoires Puissant',  desc: "Permet la fabrication d'Accessoires puissant", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_urbus' },
    { id: 'm2a5', type: 'artisant',  gx: 124,  gy: -385, name: 'Forgeron de Lingots Bauxite & Onyx Impur',      desc: "Permet la fabrication de lingots de Bauxite et d'Onyx Impur", link: '../Bestiaire/bestiaire.html#personnages/forgeron_lingots_urbus' },
    { id: 'm2a6', type: 'artisant',  gx: 867, gy: -293, name: 'Forgeron de Lingots Onyx Pur',      desc: "Permet la fabrication de lingots d'Onyx Pur", link: '../Bestiaire/bestiaire.html#personnages/forgeron_lingots_marome' },
    { id: 'm2a7', type: 'artisant',  gx: -602, gy: -284, name: 'Forgeron d\'Accessoires',  desc: "Permet la fabrication d'Accessoires des Ours et du Taureau", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_kaelor' },
    { id: 'm2a8', type: 'artisant',  gx: -776, gy: 18,   name: 'Forgeron d\'Accessoires',  desc: "Permet la fabrication d'Accessoires de Feraille", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_ferraille' },
    { id: 'm2a9', type: 'artisant',  gx: -194, gy: 20,   name: 'Forgeron d\'Accessoires',  desc: "Permet la fabrication d'Accessoires de Bauxite", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_bauxite' },
    { id: 'm2a10',type: 'artisant',  gx: -502, gy: 336,   name: 'Forgeron d\'Accessoires',  desc: "Permet la fabrication d'Accessoires d'Onyx Impur", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_onyx_impur' },
		//#endregion P2 Markers > Artisant
		//#region P2 Markers > Quête Secondaire
    { id: 'm2s1',  type: 'quête_secondaire',  gx: 112, gy: -391, name: "L'Art des Plumes",                         desc: "Ramenez 4 plumes de chaque Harpies à Ifa", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/urbus/lart-des-plumes' },
    { id: 'm2s2',  type: 'quête_secondaire',  gx: 105, gy: -392, name: "L'Art des Peaux",                         desc: "Ramenez différentes peaux de monstres à Ife", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/urbus/lart-des-peaux' },
    { id: 'm2s3',  type: 'quête_secondaire',  gx: 16, gy: -305, name: "Ma première Arme",                         desc: "Ramenez de quoi confectionner une épée à Charles", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/urbus/ma-premiere-arme' },
    { id: 'm2s4',  type: 'quête_secondaire',  gx: -202, gy: -688, name: "L'Épreuve du Chasseur",                         desc: "Montrer à Typpe de quoi vous êtres capable et défaire tout les Boss du Palier 2", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/urbus/lepreuve-du-chasseur' },
    { id: 'm2s5',  type: 'quête_secondaire',  gx: -553, gy: -264, name: "Le chat Relax",                         desc: "Retrouver le chat Relax et donnez le à Itami", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/kaelor/le-chat-relax' },
    { id: 'm2s6',  type: 'quête_secondaire',  gx: -610, gy: -245, name: "Aider Yûko",                         desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/kaelor/aider-yuko' },
    { id: 'm2s7',  type: 'quête_secondaire',  gx: -563, gy: -255, name: "Aider à la Cuisine",                         desc: "Aidez Mansa pour sa cuisine", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/kaelor/aide-a-la-cuisine' },
    { id: 'm2s8',  type: 'quête_secondaire',  gx: -585, gy: -245, name: "Le Clocher de la Sombre Messagère",                         desc: "Aidez Nora", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/kaelor/le-clocher-de-la-sombre-messagere' },
    { id: 'm2s9',  type: 'quête_secondaire',  gx: -577, gy: -256, name: "Ça pique, mais ça fait du bien",                         desc: "Ramenez du Miel à Baraka", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/kaelor/ca-pique-mais-ca-fait-du-bien' },
    { id: 'm2s10', type: 'quête_secondaire',  gx: 639, gy: -263, name: "Les Bases d'une Cabane",                         desc: "Ramenez de quoi commencer la cabane de Bronn", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/marome/les-bases-dune-cabane' },
    { id: 'm2s11', type: 'quête_secondaire',  gx: 639, gy: -263, name: "Les Murs d'une Cabane",                         desc: "Ramenez de quoi continuer la cabane de Bronn", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/marome/les-murs-dune-cabane' },
    { id: 'm2s12', type: 'quête_secondaire',  gx: 639, gy: -263, name: "Le Toit d'une Cabane",                         desc: "Ramenez de quoi finir la cabane de Bronn", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/marome/le-toit-dune-cabane' },
    { id: 'm2s13', type: 'quête_secondaire',  gx: 696, gy: -277, name: "Non, c'est de la Sape!",                         desc: "Aidez Minutaire à confectionner des vêtements", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/marome/non-cest-de-la-sape' },
    { id: 'm2s14', type: 'quête_secondaire',  gx: 724, gy: -301, name: "L'Onyx du Savoir",                         desc: "Aidez Shii à faire sa potion", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/marome/lonyx-du-savoir' },
    { id: 'm2s15', type: 'quête_secondaire',  gx: 620, gy: -567, name: "L'empreinte des Seas",                         desc: "Aidez Elyenn à retrouvez ses affaires", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/autel-des-deux-lunes/lempreinte-des-seas' },
    { id: 'm2s16', type: 'quête_secondaire',  gx: -159, gy: 10, name: "Un bon petit Repas",                         desc: "Aidez Havca à cuisiner un ragoût parfumé", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/sanctuaire-de-khesun/un-bon-petit-repas' },
    { id: 'm2s17', type: 'quête_secondaire',  gx: -41, gy: 205, name: "La Philosophie de Bushi",                         desc: "Aidez SamaelTVS à vaincre des Squelettes du Sanctuaire", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/sanctuaire-de-khesun/la-philosophie-de-bushi' },
    { id: 'm2s18', type: 'quête_secondaire',  gx: -448, gy: 267, name: "Un peu de chaque",                         desc: "Aidez Frank à vaincre les 3 types de Harpie", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/taran/un-peu-de-chaque' },
    { id: 'm2s19', type: 'quête_secondaire',  gx: -431, gy: 279, name: "Hater du Vert",                         desc: "Aidez Proris à vainbcre des Harpies de Terre", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/taran/hater-du-vert' },
    { id: 'm2s20', type: 'quête_secondaire',  gx: -432, gy: 272, name: "Nettoyer les cieux de Taran",                         desc: "Aidez Sissou à vaincre des Harpies de Feu ou de Foudre", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-secondaires/taran/nettoyer-les-cieux-de-taran' },
		//#endregion P2 Markers > Quête Secondaire
		//#region P2 Markers > Quête Principale
    { id: 'm2p1',  type: 'quête_principale', gx: -28,  gy: -886, name: "1 - Le Pallier 2...",             desc: "Parlez au Maître d'Armes et Sautez dans le lac", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/le-palier-2...' },
    { id: 'm2p2',  type: 'quête_principale', gx: 13,  gy: -665, name: "2 - Parler à la femme étrange",             desc: "Parlez à la femme étrange au bord du Lac", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/parler-a-la-femme-etrange' },
    { id: 'm2p3',  type: 'quête_principale', gx: 135,  gy: -374, name: "3 - Chemin vers Urbus",             desc: "Trouvez Arteron afin de parler de la corruption", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/chemin-vers-urbus' },
    { id: 'm2p4',  type: 'quête_principale', gx: -585,  gy: -255, name: "4 - À la recherche des Ngangas",             desc: "Parler à Bantu", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/a-la-recherche-des-ngangas' },
		{ id: 'm2p5',  type: 'quête_principale', gx: -436, gy: -442, name: "5 - Un joueur doit faire ses preuves",             desc: "Allez à la rencontre des Ngangas", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/un-joueur-doit-faire-ses-preuves' },
		{ id: 'm2p6',  type: 'quête_principale', gx: 743, gy: -257, name: "6 - Communication avec Yaa",             desc: "Communiquer avec une des 3 statues Divine du Palier 2 pour qu'elle vous aide a luter contre la corruption", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/communication-avec-yaa' },
		{ id: 'm2p7',  type: 'quête_principale', gx: 162, gy: -316, name: "7 - Façonneur de Clé I",             desc: "Réalisez le Donjon Ruche de Melliona", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/faconneur-de-cle-i' },
		{ id: 'm2p8',  type: 'quête_principale', gx: 62, gy: -428, name: "8 - Retour a Urbus",             desc: "Allez à la rencontre de la deuxième statue divine après avoir informer le Maître Épéiste de votre avancé", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/retour-a-urbus' },
		{ id: 'm2p9',  type: 'quête_principale', gx: 162, gy: -316, name: "9 - Donjon: Le Tombeau Oublié",             desc: "Réalisez le Donjon Tombeau du Nécromancien", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/donjon-le-tombeau-oublie' },
		{ id: 'm2p10', type: 'quête_principale', gx: -629, gy: -296, name: "10 - Le Tribut avant le Verdict",             desc: "Convoquez la dernière statue divine afin qu'elle vous aide", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/le-tribut-avant-le-verdict' },
		{ id: 'm2p11', type: 'quête_principale', gx: 62, gy: -428, name: "11 - La Facette de la Réalité",             desc: "Faites votre rapport au Maître Épéiste sur la corruption", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/la-facette-de-la-realite' },
		{ id: 'm2p12', type: 'quête_principale', gx: -509, gy: -58, name: "12 - Le Rituel de Purification",             desc: "C'est le grand moment, invoquez les 3 statues divine afin qu'elle vous donne de quoi affronter le puissant Astérius!", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/quetes/quetes-principales/le-rituel-de-purification' },
		//#endregion P2 Markers > Quête Principale
		{ id: 'm2boss1', type: 'boss', emoji: '🐻', name: "Winnie, le meilleur Ami de l'Homme", desc: "Maître des sous-bois de la Forêt Sucrée, puissant mais placide... jusqu'à provocation. Ses griffes peuvent mettre à terre même les mieux protégés", link: '../Bestiaire/bestiaire.html#monstres/winnie', coords: [
			{ gx: 578, gy: -774 },

		]},
		{ id: 'm2boss7', type: 'boss', emoji: '🐂', name: "Rugibœuf, Le Gardien", desc: "Seigneur du labyrinthe, hurle avant de charger pour briser les rangs. Frappe en arcs larges et repouse violemment ses adversaires", link: '../Bestiaire/bestiaire.html#monstres/rugiboeuf', coords: [
			{ gx: -155, gy: 571 },

		]},
	],
  
};

const FLOOR_MARKERS_UNDERGROUND = {
	1: [
		//#region P1 Markers Underground > Région
		{ id: 'm1r19', type: 'région',  gx: 1388, gy: 2022, name: 'Antre de Aepep',                     desc: "Au cœur d'une caverne oubliée dort un serpent ancien.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/antre-de-aepep' },
		//#endregion P1 Markers Underground > Région
		//#region P1 Markers Underground > Ressource
		{ id: 'm1t6',  type: 'ressource', emoji: '⛏️', gx: 2412, gy: 3503, name: 'Charbon Petite Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm1t7',  type: 'ressource', emoji: '⛏️', gx: 2412, gy: 3503, name: 'Cuivre Petite Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm1t8',  type: 'ressource', emoji: '⛏️', gx: 2412, gy: 3503, name: 'Fer Petite Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },
    { id: 'm1t9',  type: 'ressource', emoji: '⛏️', gx: 910,  gy: 3516, name: 'Charbon Grande Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm1t10', type: 'ressource', emoji: '⛏️', gx: 910,  gy: 3516, name: 'Cuivre Grande Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm1t11', type: 'ressource', emoji: '⛏️', gx: 910,  gy: 3516, name: 'Fer Grande Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },
		//#endregion P1 Markers Underground > Ressource
		//#region P1 Markers Underground > Clé
		{ id: 'm1c7', type: 'clef', emoji: '💍', gx: 1326, gy: 2107, name: 'Fabricant Secret du Léviathan',        desc: "Permet la confection Secrète de l'Anneau du Léviathan", link: '../Bestiaire/bestiaire.html#personnages/secret_antre_aepep' },
    { id: 'm1c10', type: 'clef', emoji: '💍', gx: 3650, gy: 1331, name: "Fabricant Secret des Cerfs",       desc: "Permet la confection Secrète de la Ceinture des Cerfs",     link: '../Bestiaire/bestiaire.html#personnages/secret_cerfs' },
		//#endregion P1 Markers Underground > Clé
		//#region P1 Markers Underground > Artisant
		{ id: 'm1a9',  type: 'artisant', gx: 3235, gy: 1482, name: "Forgeron d'Armes",                  desc: "Forgeron des Armes pour Confirmés", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armes_tolbana' },
    { id: 'm1a10', type: 'artisant', gx: 3237, gy: 1477, name: "Forgeron d'Armures",                desc: "Forgeron des Armures pour Confirmés", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armures_tolbana' },
    { id: 'm1a11', type: 'artisant', gx: 2415, gy: 2373, name: "Forgeron d'Armes",                  desc: "Forgeron d'Armes du Donjon du Labyrinthe des Déchus", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armes_labyrinthe' },
    { id: 'm1a12', type: 'artisant', gx: 2415, gy: 2373, name: "Forgeron d'Armures",                desc: "Forgeron d'Armures du Donjon du Labyrinthe des Déchus", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armures_labyrinthe' },
		//#endregion P1 Markers Underground > Artisant
		//#region P1 Markers Underground > Repreneur Butin
		{ id: 'm1b9',  type: 'repreneur_butin', gx: 2415, gy: 2373, name: 'Repreneur du Donjon des Déchus', desc: "Achète des ressources provenant du Donjon du Labyrinthe des Déchus", link: '../Bestiaire/bestiaire.html#personnages/repreneur_labyrinthe' },
		//#endregion P1 Markers Underground > Repreneur Butin
		//#region P1 Markers Underground > Boss
		{ id: 'm1boss6', type: 'boss', emoji: '🦈', name: "Nymbréa", desc: "Serpent mythique glissant entre les courants profonds, Nymbréa incarne la grâce et la traîtrise des eaux calmes. Ses écailles scintillent comme des perles maudites, et son regard hypnotique attire les imprudents vers les abysses", link: '../Bestiaire/bestiaire.html#monstres/nymbrea', coords: [
			{ gx: 1410, gy: 2140 },
		]},
		{ id: 'm1boss7', type: 'boss', emoji: '☠️', name: "Narax", desc: "Ancien général d'une armée déchue, Narax fut ressuscité par une magie interdite. Son armure brisée résonne encore de ses exploits d'antan, hantant les terres maudites. On dit que son regard vide perce jusqu'à l'âme", link: '../Bestiaire/bestiaire.html#monstres/narax', coords: [
			{ gx: 2721, gy: 4330 },
		]},
		{ id: 'm1boss8', type: 'boss', emoji: '🏇', name: "Nasgul", desc: "Entité maudite surgie des ténèbres anciennes, il rôde, invisible, prêt à déchirer l'âme des vivants", link: '../Bestiaire/bestiaire.html#monstres/nasgul', coords: [
			{ gx: 2818, gy: 4234 },
		]},
		{ id: 'm1boss9', type: 'boss', emoji: '🌺', name: "Vyrmos", desc: "Entité rampante née des mines de Geldorak, Vyrmos s'imprègne des spores et de la terre humide. Sa peau est couverte de mousse vivante, et son souffle corrompt tout ce qu'il touche", link: '../Bestiaire/bestiaire.html#monstres/vyrmos', coords: [
			{ gx: 4247, gy: 3852 },
		]},
		{ id: 'm1boss10', type: 'boss', emoji: '🪾', name: "Tornak", desc: "Massive et sauvage, cette créature veille sur la forêt. Elle repousse les intrus à coups de poings dévastateurs. Aucune parole, seulement la force brute de la nature", link: '../Bestiaire/bestiaire.html#monstres/tornak', coords: [
			{ gx: 4302, gy: 3969 },
		]},
		{ id: 'm1boss11', type: 'boss', emoji: '🛡️', name: "Déchu", desc: "", link: '../Bestiaire/bestiaire.html#monstres/', coords: [
			{ gx: 4305, gy: 4085 },
		]},
		{ id: 'm1boss12', type: 'boss', emoji: '🫧', name: "Kamila", desc: "Silencieuse au cœur du donjon, Kamilia tisse des pièges invisibles dans l'ombre. Sa morsure injecte un venin paralysant, laissant ses proies conscientes, mais incapables de fuir", link: '../Bestiaire/bestiaire.html#monstres/kamila', coords: [
			{ gx: 986, gy: 1245 },
		]},
		{ id: 'm1boss13', type: 'boss', emoji: '🧪', name: "Jira", desc: "Créature silencieuse tapie entre les toiles, Jira surveille chaque recoin du donjon. Plus rapide que l'éclair, elle frappe sans prévenir, ne laissant derrière elle que le silence... et des toiles sanglantes", link: '../Bestiaire/bestiaire.html#monstres/kamila', coords: [
			{ gx: 1190, gy: 1400 },
		]},
		{ id: 'm1boss14', type: 'boss', emoji: '🔥', name: "Pricilia", desc: "Créature ancienne et rusée, Pricilia tisse ses toiles dans les recoins oubliés des forêts les plus sombre. Ses proies ne voient jamais la mort... seulement ses yeux luisants", link: '../Bestiaire/bestiaire.html#monstres/pricilia', coords: [
			{ gx: 1230, gy: 1100 },
		]},
		{ id: 'm1boss15', type: 'boss', emoji: '❄️', name: "Yula", desc: "Tapis dans l'obscurité humide du donjon, Yula est une araignée redoutée par les aventuriers. Ses pattes tranchantes et ses yeux luisants inspirent la terreur à quiconque croise son chemin", link: '../Bestiaire/bestiaire.html#monstres/yula', coords: [
			{ gx: 1100, gy: 1222 },
		]},
		{ id: 'm1boss16', type: 'boss', emoji: '🕷️', name: "Boss Xal", desc: "", link: '../Bestiaire/bestiaire.html#monstres/', coords: [
			{ gx: 1313, gy: 1183 },
		]},
		//#endregion P1 Markers Underground > Boss
	],
  2: [
		//#region P2 Markers Underground > Donjon
    { id: 'm2d1u1',  type: 'donjon',  gx: 721, gy: 244, name: 'Donjon Tombeau du Nécromancien',           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/donjons/donjon-tombeau-du-necromancien' },
		//#endregion P2 Markers Underground > Donjon
		//#region P2 Markers Underground > Région
    { id: 'm2r1u1',  type: 'région',  gx: -581, gy: 234, name: 'Nid de Brasier',                          desc: "Un nid enflammé, refuge des harpies de feu au cœur de terres brûlantes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/nid-de-brasier' },
    { id: 'm2r2u1',  type: 'région',  gx: 225, gy: 295, name: 'Les Veines de Sablemor',                   desc: "Des veines de sable profondes, sombres et étroites, cachant Magnus, le redoutable boss", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/les-veines-de-sablemor' },
    { id: 'm2r3u1',  type: 'région',  gx: -316, gy: -94, name: 'Grotte de Taran',                         desc: "Grotte remplie de minéraux impressionnants et de mystères", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/grotte-de-taran' },
    { id: 'm2r4u1',  type: 'région',  gx: 721, gy: 244, name: 'Tombeau du Nécromancien',                  desc: "Un nécromancien repose dans un tombeau secret, enfoui au cœur d'un labyrinthe désertique", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/regions/tombeau-du-necromancien' },
		//#endregion P2 Markers Underground > Région
		//#region P2 Markers Underground > Ressource
    { id: 'm2t1u1', type: 'ressource', emoji: '⛏️', gx: -388,  gy: -35, name: 'Onyx',                     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/mineur#onyx' },
    { id: 'm2t2u1', type: 'ressource', emoji: '⛏️', gx: -206,  gy: -185, name: 'Bauxite',                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/ressources/mineur#bauxite' },
		//#endregion P2 Markers Underground > Ressource
		//#region P2 Markers Underground > Clé
    { id: 'm2c1u1', type: 'clef', emoji: '💍', gx: -694, gy: 205, name: "Fabricant Secret de la Harpie Enflammée",                     desc: "Permet la confection Secrète de l'Anneau de la Harpie Enflammée",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/palier-2/carte/personnages/fabricants-clefs-et-secrets#nid-de-brasier' },
		//#endregion P2 Markers Underground > Clé
		//#region P2 Markers Underground > Artisant
    { id: 'm2a1u1',type: 'artisant',  gx: 339, gy: 509,   name: 'Forgeron d\'Accessoires',                 desc: "Permet la fabrication d'Accessoires d'Onyx Pur", link: '../Bestiaire/bestiaire.html#personnages/forgeron_accessoires_onyx_pur' },
		{ id: 'm2a2u1',type: 'artisant',  gx: 591, gy: -700,   name: 'Forgeron d\'Armes de la Ruche',                 desc: "Permet la fabrication d'Armes issue de la Ruche de Melliona", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armes_abeille' },
		{ id: 'm2a3u1',type: 'artisant',  gx: 591, gy: -675,   name: 'Forgeron d\'Armures de la Ruche',                 desc: "Permet la fabrication d'Armures issue de la Ruche de Melliona", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armures_abeille' },
		{ id: 'm2a4u1',type: 'artisant',  gx: 725, gy: 262,   name: 'Forgeron d\'Armes du Tombeau',                 desc: "Permet la fabrication d'Armes issue du Tombeau Oublié du Nécromancien", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armes_necromancien' },
		{ id: 'm2a5u1',type: 'artisant',  gx: 725, gy: 262,   name: 'Forgeron d\'Armures du Tombeau',                 desc: "Permet la fabrication d'Armures issue du Tombeau Oublié du Nécromancien", link: '../Bestiaire/bestiaire.html#personnages/forgeron_armures_necromancien' },
		//#endregion P2 Markers Underground > Artisant
		//#endregion P2 Markers Underground > Artisant
		{ id: 'm2boss2', type: 'boss', emoji: '☠️', name: "Gardien du Sanctuaire", desc: "Sentinelle antique guidée par une volonté oubliée. Insensible à la peur, terrasse les intrus d'un seul revers", link: '../Bestiaire/bestiaire.html#monstres/gardien_sanctuaire', coords: [
			{ gx: 0, gy: 190 },

		]},
		{ id: 'm2boss3', type: 'boss', emoji: '🧙‍♀️', name: "Velindra la Tisseuse", desc: "Enchanteresse perfide tissant maléfices et toiles alchimiques. Empoisonne, affaiblit puis s'achève d'un éclat de rire", link: '../Bestiaire/bestiaire.html#monstres/velindra', coords: [
			{ gx: 800, gy: 300 },

		]},
		{ id: 'm2boss4', type: 'boss', emoji: '🐝', name: "Melisara, Souveraine de la Ruche", desc: "Matriarche vénérée, chef d'ochestre des essaims et gardienne du miel. Ses ordres galvanisent les abeilles et laissent peu de répit aux intrus", link: '../Bestiaire/bestiaire.html#monstres/melisara', coords: [
			{ gx: 175, gy: -409 },

		]},
		{ id: 'm2boss5', type: 'boss', emoji: '📖', name: "Morverth l'Écorcheur d'Âmes", desc: "Maître nécromant dont les malédictions drainent la vitalité. Commande des légions d'ossements et frappe par vagues d'ombres", link: '../Bestiaire/bestiaire.html#monstres/morveth', coords: [
			{ gx: 583, gy: -187 },

		]},
		{ id: 'm2boss6', type: 'boss', emoji: '🛡️', name: "Magnus, Colosse des Veines", desc: "Titan antique sculpté par la sédimentation et la pression du temps. Ses coups fracturent la garde et projettent des nuées de poussière", link: '../Bestiaire/bestiaire.html#monstres/magnus', coords: [
			{ gx: 228, gy: 316 },

		]},
	],
};

const MAP_CALIBRATION = {
  1: {
    centerPixel: { x: 450,    y: 450   },
    centerGame:  { x: 2545.6, y: 2550 },
    radiusPixel: 450,
    radiusGame:  2498.1,
  },
  2: {
  centerPixel: { x: 450,  y: 450 },
  centerGame:  { x: -1.3, y: 0.8 },
  radiusPixel: 450,
  radiusGame:  1072.5,
},
};