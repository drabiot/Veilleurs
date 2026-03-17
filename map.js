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
};

const FLOOR_NAMES = {
  1: 'Forêt',
  2: 'Désert',
};

const FLOOR_ZONES = {
  1: [
    {
      id: 'z1',
      name: 'Vallée des Loups',
      regionName: 'Vallée des Loups',
      color: '#e0ac60',
      emoji: '🐺',
      monsters: [
        { name: 'Loup Sinitre Blanc', level: 2, difficulty: '⭐',   emoji: '🐺', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallee-des-loups/loups-sinistres' },
        { name: 'Loup Sinitre Noir',  level: 2, difficulty: '⭐',   emoji: '🐺', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallee-des-loups/loups-sinistres' },
        { name: 'Albal',              level: 2, difficulty: '⭐⭐', emoji: '🐺', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallee-des-loups/albal' },
      ],
      points: [
        { gx: 2356, gy: 4026 }, { gx: 2270, gy: 3943 }, { gx: 2306, gy: 3784 },
        { gx: 2400, gy: 3651 }, { gx: 2583, gy: 3667 }, { gx: 2628, gy: 3849 },
        { gx: 2571, gy: 3982 },
      ],
    },
    {
      id: 'z2',
      name: 'Zone des Sangliers',
      regionName: 'Zone des Sangliers',
      color: '#644d58',
      emoji: '🐗',
      monsters: [
        { name: 'Sanglier Corrompu', level: 2, difficulty: '⭐',   emoji: '🐗', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/zone-sanglier/sanglier-corrompu' },
        { name: 'Pumba',             level: 2, difficulty: '⭐⭐', emoji: '🐗', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/zone-sanglier/pumba' },
      ],
      points: [
        { gx: 1537, gy: 3620 }, { gx: 1707, gy: 3344 }, { gx: 1912, gy: 3339 },
        { gx: 2060, gy: 3470 }, { gx: 2057, gy: 3713 }, { gx: 1783, gy: 3619 },
      ],
    },
    {
      id: 'z3',
      name: 'Champs de Mizunari',
      color: '#82e753',
      emoji: '🌾',
      monsters: [
        { name: 'Nephentes', level: 4, difficulty: '⭐⭐', emoji: '🥬', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/mizunari/nephentes' },
      ],
      points: [
        { gx: 3232, gy: 3731 }, { gx: 3286, gy: 3708 }, { gx: 3349, gy: 3771 },
        { gx: 3292, gy: 3828 }, { gx: 3252, gy: 3786 },
      ],
    },
    {
      id: 'z4',
      name: 'Marécage Putride',
      regionName: 'Marécage Putride',
      color: '#ee7560',
      emoji: '🍄',
      monsters: [
        { name: 'Mini Tréant',       level: 3, difficulty: '⭐⭐',   emoji: '🌿', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/hanaka/mini-treant' },
        { name: 'Guerrier Tréant',   level: 3, difficulty: '⭐⭐',   emoji: '🛡️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/hanaka/guerrier-treant' },
        { name: "Tréant d'Élite",    level: 3, difficulty: '⭐⭐',   emoji: '🏹', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/hanaka/treant-elite' },
        { name: 'Mage Sylvestre',    level: 3, difficulty: '⭐⭐',   emoji: '🧙', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/hanaka/mage-sylvestre' },
        { name: 'Gardien Colossal',  level: 3, difficulty: '⭐⭐⭐', emoji: '🌳', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/hanaka/gardien-colossal' },
      ],
      points: [
        { gx: 1589, gy: 3261 }, { gx: 1432, gy: 3269 }, { gx: 989, gy: 3272 },
        { gx: 954, gy: 3146 },  { gx: 1003, gy: 2934 }, { gx: 1328, gy: 2938 },
        { gx: 1519, gy: 2831 }, { gx: 1668, gy: 3084 },
      ],
    },
    {
      id: 'z5',
      name: 'Vallhat',
      regionName: 'Vallhat',
      color: '#74ce50',
      emoji: '🌳',
      monsters: [
        { name: 'Petit Slime',      level: 3, difficulty: '⭐⭐',    emoji: '🟢', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallhat/petit-slime' },
        { name: 'Guerrier Slime',   level: 3, difficulty: '⭐⭐',    emoji: '⚔️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallhat/guerrier-slime' },
        { name: 'Slime Soigneur',   level: 3, difficulty: '⭐⭐⭐',  emoji: '⛑️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallhat/slime-soigneur' },
        { name: 'Slime Magicien',   level: 3, difficulty: '⭐⭐⭐',  emoji: '🧙', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallhat/slime-magicien' },
        { name: 'Gorbel',           level: 3, difficulty: '⭐⭐⭐⭐',emoji: '👑', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/vallhat/gorbel' },
      ],
      points: [
        { gx: 515, gy: 3184 }, { gx: 387, gy: 3378 }, { gx: 238, gy: 3398 },
        { gx: 129, gy: 3104 }, { gx: 90, gy: 2795 },   { gx: 266, gy: 2693 },
        { gx: 498, gy: 2796 }, { gx: 595, gy: 3025 },
      ],
    },
    {
      id: 'z6',
      name: 'Ruines Maudites',
      color: '#eecf21',
      emoji: '💀',
      monsters: [
        { name: 'Squelette Épéiste',      level: 3, difficulty: '⭐⭐',   emoji: '💀', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/ruines-maudites/squelette-epeiste' },
        { name: 'Guerrier Squelette',     level: 3, difficulty: '⭐⭐⭐', emoji: '⚔️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/ruines-maudites/guerrier-squelette' },
        { name: 'Squelette Hallebardier', level: 3, difficulty: '⭐⭐⭐', emoji: '🔨', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/ruines-maudites/squelette-hallbardier' },
      ],
      points: [
        { gx: 2692, gy: 4371 }, { gx: 2757, gy: 4375 }, { gx: 2815, gy: 4427 },
        { gx: 2808, gy: 4497 }, { gx: 2693, gy: 4470 },
      ],
    },
    {
      id: 'z7',
      name: 'Mine de Geldorak',
      regionName: 'Mine de Geldorak',
      color: '#75bdcf',
      emoji: '⛰️',
      monsters: [
        { name: 'Bandit Archer',   level: 3, difficulty: '⭐⭐', emoji: '🏹', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/mine-de-geldorak/bandit-archer' },
        { name: 'Bandit Assassin', level: 3, difficulty: '⭐⭐', emoji: '🗡️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/mine-de-geldorak/bandit-assassin' },
        { name: 'Bandit Robuste',  level: 3, difficulty: '⭐⭐', emoji: '💪', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/mine-de-geldorak/bandit-robuste' },
      ],
      points: [
        { gx: 3922, gy: 3824 }, { gx: 4081, gy: 3834 }, { gx: 4201, gy: 3880 },
        { gx: 4083, gy: 3985 }, { gx: 3994, gy: 4036 }, { gx: 3916, gy: 3971 },
        { gx: 3907, gy: 3887 },
      ],
    },
    {
      id: 'z8',
      name: "Archipel d'Ika",
      regionName: "Archipel d'Ika",
      color: '#3e9db4',
      emoji: '🏝️',
      monsters: [
        { name: 'Ika', level: 3, difficulty: '⭐⭐⭐', emoji: '🐢', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/archipel-dika/ika' },
      ],
      points: [
        { gx: 3130, gy: 4055 }, { gx: 3163, gy: 4008 }, { gx: 3243, gy: 4010 },
        { gx: 3320, gy: 4084 }, { gx: 3321, gy: 4143 }, { gx: 3268, gy: 4185 },
        { gx: 3142, gy: 4180 }, { gx: 3113, gy: 4084 },
      ],
    },
    {
      id: 'z9',
      name: "Arakh'Nol",
      regionName: "Arakh'Nol",
      color: '#8bbeca',
      emoji: '🕸️',
      monsters: [
        { name: 'Araignée des Forêts', level: 7, difficulty: '⭐⭐⭐⭐', emoji: '🕷️', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/arakhnol/araignees-des-forets' },
      ],
      points: [
        { gx: 1394, gy: 1186 }, { gx: 1472, gy: 1451 }, { gx: 1358, gy: 1489 },
        { gx: 1332, gy: 1581 }, { gx: 1152, gy: 1701 }, { gx: 1029, gy: 1743 },
        { gx: 990, gy: 1710 },  { gx: 1096, gy: 1512 }, { gx: 1085, gy: 1395 },
        { gx: 1138, gy: 1309 }, { gx: 989, gy: 1207 },  { gx: 1032, gy: 1146 },
        { gx: 1247, gy: 1210 },
      ],
    },
    {
      id: 'z10',
      name: 'Montagnes de Tolbana',
      color: '#ddb04e',
      emoji: '🏔️',
      monsters: [
        { name: 'Cerf des Montagnes', level: 7, difficulty: '⭐⭐⭐', emoji: '🦌', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/tolbana/cerf-des-montagnes' },
      ],
      points: [
        { gx: 3945, gy: 1203 }, { gx: 4027, gy: 1066 }, { gx: 4187, gy: 1082 },
        { gx: 4115, gy: 1196 }, { gx: 4119, gy: 1280 }, { gx: 3998, gy: 1261 },
      ],
    },
    {
      id: 'z11a',
      name: 'Citadelle des Neiges',
      regionName: 'Citadelle des Neiges',
      color: '#224ba5',
      emoji: '❄️',
      monsters: [
        { name: 'Golem de Glace',   level: 7, difficulty: '⭐⭐⭐',    emoji: '🧊', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/citadelle-des-neiges/golem-de-glace' },
        { name: 'Spirite de Glace', level: 7, difficulty: '⭐⭐⭐',    emoji: '🦋', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/citadelle-des-neiges/spirite-de-glace' },
        { name: 'Ours de Glace',    level: 7, difficulty: '⭐⭐⭐⭐⭐',emoji: '🐻', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/citadelle-des-neiges/ours-de-glace' },
      ],
      points: [
        { gx: 3969, gy: 2013 }, { gx: 3967, gy: 2039 }, { gx: 3943, gy: 2048 },
        { gx: 3886, gy: 2045 }, { gx: 3886, gy: 2007 }, { gx: 3907, gy: 1998 },
        { gx: 3945, gy: 1999 },
      ],
    },
    {
      id: 'z11b',
      name: 'Lac de Virelune',
      regionName: 'Antre de Aepep',
      color: '#bde3f1',
      emoji: '🎣',
      monsters: [
        { name: 'Poisson Requin', level: 7, difficulty: '⭐⭐⭐',    emoji: '🦈', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/virelune/poisson-requin' },
        { name: 'Nymbréa',        level: 7, difficulty: '⭐⭐⭐⭐⭐',emoji: '🐟', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-nord/virelune/nymbrea' },
      ],
      points: [
        { gx: 1399, gy: 2022 }, { gx: 1397, gy: 2105 }, { gx: 1336, gy: 2141 },
        { gx: 1270, gy: 2106 }, { gx: 1256, gy: 2042 }, { gx: 1316, gy: 1986 },
        { gx: 1369, gy: 1999 },
      ],
    },
    {
      id: 'z12',
      name: 'Prairie des Sangliers',
      color: '#644d58',
      emoji: '🐗',
      monsters: [
        { name: 'Sanglier Corrompu', level: 2, difficulty: '⭐', emoji: '🐗', link: 'https://guilde-sao.gitbook.io/watchers/paliers/monstres/carte-du-sud/zone-sanglier/sanglier-corrompu' },
      ],
      points: [
        { gx: 2610, gy: 2304 }, { gx: 2492, gy: 2220 }, { gx: 2521, gy: 2015 },
        { gx: 2739, gy: 2117 }, { gx: 2650, gy: 2259 },
      ],
    },
  ],
  2: [],
};

const FLOOR_MARKERS = {
  1: [
    { id: 'm1',  type: 'donjon',  gx: 3334, gy: 1038, name: "Raid Tour du Kobold",          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-kokolb' },
    { id: 'm2',  type: 'donjon',  gx: 2709, gy: 4408, name: 'Sous-Donjon Nasgul',           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-squelette' },
    { id: 'm3',  type: 'donjon',  gx: 4210, gy: 3895, name: 'Donjon Mine de Geldorak',      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-geldorak' },
    { id: 'm4',  type: 'donjon',  gx: 2300, gy: 2400, name: "Donjon Labyrinthe des Déchus", desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-labyrinthe-des-dechus' },
    { id: 'm5',  type: 'donjon',  gx: 955,  gy: 1212, name: "Donjon Xal'Zirith",            desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-xalzirith' },

    { id: 'm6',  type: 'région',  gx: 1737, gy: 4300, name: 'Ville de Départ',        desc: "La ville de départ est un havre paisible dans un monde virtuel encore inconnu. C'est ici que chaque aventure commence", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/ville-de-depart' },
    { id: 'm7',  type: 'région',  gx: 1395, gy: 3450, name: 'Hanaka',                 desc: "Un hameau boisé niché entre les collines où les sangliers rôdent à la lisière. Berceau des premiers affrontements", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/hanaka' },
    { id: 'm8',  type: 'région',  gx: 2450, gy: 3853, name: 'Vallée des Loups',       desc: "Un vallon brumeux où résonnent encore les hurlements.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-loups' },
    { id: 'm9',  type: 'région',  gx: 1213, gy: 3108, name: 'Marécage Putride',       desc: "Un marais dense et hostile, où la brume empoisonne l'air.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/marecage-putride' },
    { id: 'm10', type: 'région',  gx: 1800, gy: 3500, name: 'Zone des Sangliers',     desc: "Un territoire sauvage où les sangliers règnent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/zone-sanglier' },
    { id: 'm11', type: 'région',  gx: 948,  gy: 4189, name: 'Vallée des Pétales',     desc: "Une vallée enchantée où les pétales dansent au vent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-petales' },
    { id: 'm12', type: 'région',  gx: 2764, gy: 4680, name: 'Château Abandonné',      desc: "Les ruines d'un château oublié, rongé par le temps.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/chateau-abandonne' },
    { id: 'm13', type: 'région',  gx: 3054, gy: 3684, name: 'Mizunari',               desc: "Petit village paisible niché au bord d'un lac clair.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mizunari' },
    { id: 'm14', type: 'région',  gx: 3221, gy: 4097, name: "Archipel d'Ika",         desc: "Un archipel tropical où les tortues géantes se rassemblent.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/archipel-dika' },
    { id: 'm15', type: 'région',  gx: 2249, gy: 3210, name: 'Quartier OG',            desc: "Le bastion de la Guilde OG, réputée et redoutée.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/quartier-og' },
    { id: 'm16', type: 'région',  gx: 935,  gy: 3580, name: 'Cyclorim',               desc: "Une arène antique taillée dans la roche rouge.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cyclorim' },
    { id: 'm17', type: 'région',  gx: 3978, gy: 3909, name: 'Mine de Geldorak',       desc: "Creusée au coeur de la montagne.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-geldorak' },
    { id: 'm18', type: 'région',  gx: 2778, gy: 2998, name: 'CastelBrume',            desc: "Perché au sommet d'une crête oubliée.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/castelbrume' },
    { id: 'm19', type: 'région',  gx: 390,  gy: 3041, name: 'Vallhat',                desc: "Perchée au sommet d'un massif venteux.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallhat' },
    { id: 'm20', type: 'région',  gx: 3937, gy: 2031, name: 'Citadelle des Neiges',   desc: "Autrefois bastion imprenable.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/citadelle-des-neiges' },
    { id: 'm21', type: 'région',  gx: 313,  gy: 2455, name: 'Jardin des Géants',      desc: "Un lieu oublié où la nature a repris ses droits.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/jardin-des-geants' },
    { id: 'm22', type: 'région',  gx: 2454, gy: 2840, name: 'Le Lac des Nénuphars',   desc: "Calme et mystère entourent ses eaux troubles...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/le-lac-des-nenuphars' },
    { id: 'm23', type: 'région',  gx: 3212, gy: 1639, name: 'Tolbana',                desc: "Érigé à flanc de montagne.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tolbana' },
    { id: 'm24', type: 'région',  gx: 1325, gy: 2068, name: 'Antre de Aepep',         desc: "Au cœur d'une caverne oubliée dort un serpent ancien.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/antre-de-aepep' },
    { id: 'm25', type: 'région',  gx: 1490, gy: 1982, name: 'Virelune',               desc: "Niché au bord d'un gouffre marin insondable.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/virelune' },
    { id: 'm26', type: 'région',  gx: 1852, gy: 735,  name: 'Candelia',               desc: "Blotti entre les pics abrupts.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/candelia' },
    { id: 'm27', type: 'région',  gx: 3334, gy: 1038, name: 'Tour du Kobold',         desc: "Une ancienne tour en ruine.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tour-du-kobold' },
    { id: 'm28', type: 'région',  gx: 2343, gy: 1702, name: 'Mine de Pic de Cristal', desc: "Cette ancienne mine renferme des cristaux.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-pic-de-cristal' },
    { id: 'm29', type: 'région',  gx: 2969, gy: 1217, name: 'Cristal de Tolbana',     desc: "Des cristaux luminescents aux propriétés mystérieuses.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cristal-de-tolbana' },
    { id: 'm30', type: 'région',  gx: 1232, gy: 1400, name: "Arakh'Nol",              desc: "Dans les profondeurs d'Arakh'Nol, la lumière peine à percer.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/arakhnol' },
    { id: 'm31', type: 'région',  gx: 4676, gy: 2438, name: 'Guilde Marchande',       desc: "Le Quartier général de la Guilde des Marchands.", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/guilde-marchande' },

    { id: 'm32',  type: 'ressource', emoji: '🌾', gx: 2263, gy: 3706, name: 'Allium',              desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#alliums' },
    { id: 'm35',  type: 'ressource', emoji: '🌾', gx: 2288, gy: 3653, name: 'Blé',                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#ble' },
    { id: 'm36',  type: 'ressource', emoji: '🌳', gx: 2846, gy: 3517, name: 'Chêne de Forêt',      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm38',  type: 'ressource', emoji: '🌳', gx: 2357, gy: 4301, name: 'Chêne Proche',        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm39',  type: 'ressource', emoji: '🌳', gx: 1707, gy: 1207, name: 'Bouleau',             desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#bouleau' },
    { id: 'm40',  type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Charbon Petite Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm41',  type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Cuivre Petite Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm42',  type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Fer Petite Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },
    { id: 'm43',  type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Charbon Grande Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm44',  type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Cuivre Grande Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm45',  type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Fer Grande Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },

    { id: 'm46',  type: 'artisant', gx: 1703, gy: 4125, name: "Forgeron d'Armes",                 desc: "Forgeron des Armes pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme' },
    { id: 'm47',  type: 'artisant', gx: 1703, gy: 4125, name: "Forgeron d'Armures",               desc: "Forgeron des Armures pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure' },
    { id: 'm48',  type: 'artisant', gx: 1703, gy: 4125, name: "Forgeron d'Accessoires",           desc: "Forgeron des Accessoires pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-base' },
    { id: 'm49',  type: 'artisant', gx: 1721, gy: 4605, name: 'Marchand Étrange',                 desc: "Marchand suspect trainant derrière la Cathédrale", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#marchand-etrange' },
    { id: 'm50',  type: 'artisant', gx: 1725, gy: 4672, name: "Forgeron d'Accessoires en Cuivre", desc: "Forgeron des Accessoires en Cuivre pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-cuivre' },
    { id: 'm51',  type: 'artisant', gx: 1725, gy: 4672, name: "Forgeron d'Accessoires en Fer",    desc: "Forgeron des Accessoires en Fer pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-fer' },
    { id: 'm52',  type: 'artisant', gx: 1725, gy: 4672, name: 'Refaçonneur',                      desc: "Permet la fabrication de ficelle en tout genre", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/refaconneurs#ville-de-depart' },
    { id: 'm53',  type: 'artisant', gx: 2322, gy: 3560, name: 'Forgeron de Lingots',              desc: "Forgeron de Lingots de Cuivre et de Fer", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#lingots' },
    { id: 'm54a', type: 'artisant', gx: 3193, gy: 1474, name: "Forgeron d'Armes",                 desc: "Forgeron des Armes pour Confirmés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme-1' },
    { id: 'm54b', type: 'artisant', gx: 3193, gy: 1474, name: "Forgeron d'Armures",               desc: "Forgeron des Armures pour Confirmés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure-1' },
    { id: 'm55',  type: 'artisant', gx: 2355, gy: 2412, name: "Forgeron d'Armes",                 desc: "Forgeron d'Armes du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme-2' },
    { id: 'm56',  type: 'artisant', gx: 2355, gy: 2412, name: "Forgeron d'Armures",               desc: "Forgeron d'Armures du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure-2' },
    { id: 'm57',  type: 'artisant', gx: 2394, gy: 4293, name: 'Bucheron',                         desc: "Bucheron permettant la Réalisation de Planches", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/bucherons#ville-de-depart' },
    { id: 'm58',  type: 'artisant', gx: 1712, gy: 4091, name: 'Alchimiste',                       desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/alchimistes#ville-de-depart' },
    { id: 'm125', type: 'artisant', gx: 3257, gy: 1626, name: 'Alchimiste',                       desc: "Alchimiste de Tolbana", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/alchimistes#tolbana' },

    { id: 'm59',  type: 'repreneur_butin', gx: 1720, gy: 4170, name: 'Repreneur des Débutants',       desc: "Achète des ressources digne d'un Débutant", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#ville-de-depart' },
    { id: 'm60',  type: 'repreneur_butin', gx: 1446, gy: 3415, name: 'Repreneur de la Forêt',         desc: "Achète des ressources de la Forêt", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#hanaka' },
    { id: 'm61',  type: 'repreneur_butin', gx: 3074, gy: 3678, name: 'Repreneur Champêtre',           desc: "Achète des ressources des Champs", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#mizunari' },
    { id: 'm62',  type: 'repreneur_butin', gx: 363,  gy: 3092, name: 'Repreneur des Maraicages',      desc: "Achète des ressources Gluantes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#vallaht' },
    { id: 'm63',  type: 'repreneur_butin', gx: 1541, gy: 1983, name: 'Repreneur des Mers',            desc: "Achète des ressources Maritimes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#virelune' },
    { id: 'm64',  type: 'repreneur_butin', gx: 2764, gy: 4680, name: 'Repreneur de Squelette',        desc: "Achète des ressources venant des Morts", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#chateau-abandonne' },
    { id: 'm124', type: 'repreneur_butin', gx: 3217, gy: 1645, name: 'Repreneur Agguerie de Tolbana', desc: "Achète des ressources digne d'un Combattant Agguerie", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#tolbana' },

    { id: 'm65a', type: 'marchand', gx: 1720, gy: 4147, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#ville-de-depart' },
    { id: 'm66',  type: 'marchand', gx: 1447, gy: 3390, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#hanaka' },
    { id: 'm123', type: 'marchand', gx: 438,  gy: 3077, name: "Marchand d'Accessoires",   desc: "Vends des Accessoires Gluants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#vallhat' },
    { id: 'm67',  type: 'marchand', gx: 3241, gy: 1626, name: "Marchand d'Accessoires",   desc: "Vends des Accessoires Résistants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-1' },
    { id: 'm68a', type: 'marchand', gx: 1750, gy: 4147, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#ville-de-depart-1' },
    { id: 'm69a', type: 'marchand', gx: 1537, gy: 1958, name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#virelune' },
    { id: 'm69b', type: 'marchand', gx: 1940, gy: 843,  name: "Marchand d'Outils",        desc: "Vends des outils pour récolter des matières premières", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-3' },
    { id: 'm70',  type: 'marchand', gx: 3230, gy: 1658, name: "Marchand de Consommables", desc: "Vends des Utilitaires comme des Potions ou des Parchemins", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-2' },
    { id: 'm65b', type: 'marchand', gx: 3240, gy: 1658, name: "Marchand d'Équipement",    desc: "Vends des Armes et objets", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana' },
    { id: 'm68b', type: 'marchand', gx: 3257, gy: 1638, name: "Marchand d'Outils",        desc: "Vends des outils de Candelia", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#candelia' },

    { id: 'm71', type: 'clef', emoji: '🗝️', gx: 1750, gy: 4170, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#ville-de-depart' },
    { id: 'm72', type: 'clef', emoji: '🗝️', gx: 4210, gy: 3895, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#mine-de-geldorak' },
    { id: 'm73', type: 'clef', emoji: '🗝️', gx: 2314, gy: 2435, name: 'Clef du Donjon Labyrinthe des Déchus', desc: "Clef permettant d'ouvrir la porte du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#labyrinthe-des-dechus' },
    { id: 'm74', type: 'clef', emoji: '🗝️', gx: 955,  gy: 1212, name: "Clef du Donjon Xal'Zirith",            desc: "Clef permettant d'ouvrir la porte du Donjon Xal'Zirith",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#xalzirith' },
    { id: 'm75', type: 'clef', emoji: '🗝️', gx: 1936, gy: 835,  name: "Clef du Donjon Xal'Zirith",            desc: "Clef permettant d'ouvrir la porte du Donjon Xal'Zirith",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#candelia' },
    { id: 'm76', type: 'clef', emoji: '💍', gx: 4128, gy: 1823, name: "Fabricant Secret de l'Ours",            desc: "Permet la confection Secrète du Bracelet de Glace",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#citadelle-des-neiges' },
    { id: 'm77', type: 'clef', emoji: '💍', gx: 1267, gy: 2140, name: 'Fabricant Secret du Léviathan',         desc: "Permet la confection Secrète de l'Anneau du Léviathan", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#antre-de-aepep' },
    { id: 'm78', type: 'clef', emoji: '💍', gx: 387,  gy: 3097, name: 'Fabricant Secret des Slimes',           desc: "Permet la confection Secrète de l'Anneau Gluant",       link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#vallhat' },
    { id: 'm79', type: 'clef', emoji: '💍', gx: 1092, gy: 1193, name: "Fabricant Secret des Araignées",        desc: "Permet la confection Secrète du Collier d'Aragorn",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#arakhnol' },

    { id: 'm80',  type: 'quête_secondaire', gx: 1819, gy: 4002, name: "Tilda",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/tilda' },
    { id: 'm81',  type: 'quête_secondaire', gx: 1817, gy: 3971, name: "Lila",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/lila' },
    { id: 'm82',  type: 'quête_secondaire', gx: 2000, gy: 4280, name: "Varn",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/varn' },
    { id: 'm83',  type: 'quête_secondaire', gx: 1682, gy: 4720, name: "Orin",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/ori' },
    { id: 'm84',  type: 'quête_secondaire', gx: 1682, gy: 4720, name: "Inari",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/inari' },
    { id: 'm85',  type: 'quête_secondaire', gx: 1210, gy: 4296, name: "Meiko",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/meiko' },
    { id: 'm86',  type: 'quête_secondaire', gx: 1214, gy: 4313, name: "Saria",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/saria' },
    { id: 'm87',  type: 'quête_secondaire', gx: 1493, gy: 4306, name: "Rikyu",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/rikyu' },
    { id: 'm88',  type: 'quête_secondaire', gx: 1473, gy: 4321, name: "Bunta",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/bunta' },
    { id: 'm89',  type: 'quête_secondaire', gx: 1579, gy: 4037, name: "Nacht",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/nacht' },
    { id: 'm90',  type: 'quête_secondaire', gx: 2143, gy: 4177, name: "Millia",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/millia' },
    { id: 'm91',  type: 'quête_secondaire', gx: 1475, gy: 3373, name: "Genzo",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/genzo' },
    { id: 'm92',  type: 'quête_secondaire', gx: 1462, gy: 3373, name: "Bartok",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/bartok' },
    { id: 'm93',  type: 'quête_secondaire', gx: 1377, gy: 3406, name: "Greta",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/greta' },
    { id: 'm94',  type: 'quête_secondaire', gx: 1351, gy: 3433, name: "Soeur Therra", desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/soeur-therra' },
    { id: 'm95',  type: 'quête_secondaire', gx: 1435, gy: 3532, name: "Rina",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/rina' },
    { id: 'm96',  type: 'quête_secondaire', gx: 1446, gy: 3560, name: "Maya",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/maya' },
    { id: 'm97',  type: 'quête_secondaire', gx: 1296, gy: 3438, name: "Toban",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/toban' },
    { id: 'm98',  type: 'quête_secondaire', gx: 3317, gy: 2954, name: "Fira",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/fira' },
    { id: 'm99',  type: 'quête_secondaire', gx: 3216, gy: 2913, name: "Corentin",   desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/corentin' },
    { id: 'm100', type: 'quête_secondaire', gx: 3146, gy: 2898, name: "Jean",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/jean' },
    { id: 'm101', type: 'quête_secondaire', gx: 3011, gy: 1918, name: "Horace",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/tolbana/horace' },
    { id: 'm102', type: 'quête_secondaire', gx: 1807, gy: 2127, name: "Haruto",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/haruto' },
    { id: 'm103', type: 'quête_secondaire', gx: 1838, gy: 2019, name: "Sam",        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/sam' },
    { id: 'm104', type: 'quête_secondaire', gx: 1506, gy: 1980, name: "Juliette",   desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/juliette' },
    { id: 'm105', type: 'quête_secondaire', gx: 1500, gy: 2015, name: "Monique",    desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/monique' },
    { id: 'm106', type: 'quête_secondaire', gx: 1565, gy: 1860, name: "Luc",        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/luc' },
    { id: 'm107', type: 'quête_secondaire', gx: 1645, gy: 1042, name: "Gilbert",    desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilbert' },
    { id: 'm108', type: 'quête_secondaire', gx: 1958, gy: 901,  name: "Pierre",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/pierre' },
    { id: 'm109', type: 'quête_secondaire', gx: 1952, gy: 859,  name: "Yannis",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/yannis' },
    { id: 'm110', type: 'quête_secondaire', gx: 1927, gy: 863,  name: "Roméo",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/roméo' },
    { id: 'm111', type: 'quête_secondaire', gx: 1895, gy: 848,  name: "Tomoko",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/tomoko' },
    { id: 'm112', type: 'quête_secondaire', gx: 1891, gy: 814,  name: "Gilmar",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilmar' },
    { id: 'm113', type: 'quête_secondaire', gx: 1815, gy: 777,  name: "Émilie",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/emilie' },
    { id: 'm114', type: 'quête_secondaire', gx: 3077, gy: 3711, name: "Phares",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/phares' },
    { id: 'm115', type: 'quête_secondaire', gx: 3060, gy: 3692, name: "Louise",     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/louise' },
    { id: 'm116', type: 'quête_secondaire', gx: 3038, gy: 3699, name: "Elwyn",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/elwyn' },
    { id: 'm117', type: 'quête_secondaire', gx: 3050, gy: 3661, name: "Michelle",   desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/michelle' },
    { id: 'm118', type: 'quête_secondaire', gx: 3069, gy: 3668, name: "Martine",    desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/martine' },
    { id: 'm119', type: 'quête_secondaire', gx: 455,  gy: 3066, name: "Par les Branches des Anciens", desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/par-les-branches-des-anciens' },
    { id: 'm120', type: 'quête_secondaire', gx: 442,  gy: 3029, name: "Saya",       desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/saya' },
    { id: 'm121', type: 'quête_secondaire', gx: 416,  gy: 3008, name: "Ayaka",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/ayaka' },
    { id: 'm122', type: 'quête_secondaire', gx: 382,  gy: 3046, name: "Daiki",      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/daiki' },
  ],
  2: [],
};

const MAP_CALIBRATION = {
  1: {
    centerPixel: { x: 450,    y: 450  },
    centerGame:  { x: 2474.5, y: 2570 },
    radiusPixel: 450,
    radiusGame:  2474.5,
  },
  2: {
    centerPixel: { x: 450, y: 450 },
    centerGame:  { x: 0,   y: 0   },
    radiusPixel: 450,
    radiusGame:  1000,
  }
};

/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
const MAP_SIZE          = 900;
let   currentFloor      = 1;
let   zoomLevel         = 1;
const ZOOM_MIN          = 0.4;
const ZOOM_MAX          = 10;
const ZOOM_FACTOR       = 1.15;
const ITEM_HEIGHT       = 32;
const CLUSTER_RADIUS_PX = 30;

let isPanning      = false;
let panLastX       = 0;
let panLastY       = 0;
let panOffset      = { x: 0, y: 0 };
let _searchFocusId = null;

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const floorInput    = document.getElementById('floor-input');
const floorDisplay  = document.getElementById('floor-display');
const floorNameDisp = document.getElementById('floor-name-display');
const floorInfoNum  = document.getElementById('floor-info-num');
const wheelTrack    = document.getElementById('wheel-track');
const markersLayer  = document.getElementById('markers-layer');
const tooltip       = document.getElementById('map-tooltip');
const tooltipType   = document.getElementById('tooltip-type');
const tooltipName   = document.getElementById('tooltip-name');
const tooltipDesc   = document.getElementById('tooltip-desc');
const tooltipLink   = document.getElementById('tooltip-link');
const mapCanvas     = document.getElementById('map-canvas');
const mapViewport   = document.getElementById('map-viewport');
const zoomLevelEl   = document.getElementById('zoom-level');

/* ══════════════════════════════════
   POSITION VIEWPORT
══════════════════════════════════ */
let _vpLeft = 0, _vpTop = 0, _vpW = 0, _vpH = 0;

function updateVpBounds() {
  const r = mapViewport.getBoundingClientRect();
  _vpLeft = Math.round(r.left);
  _vpTop  = Math.round(r.top);
  _vpW    = Math.round(r.width);
  _vpH    = Math.round(r.height);
}
function clientToVp(cx, cy) { return { x: cx - _vpLeft, y: cy - _vpTop }; }

/* ══════════════════════════════════
   CONVERSIONS COORDONNÉES
══════════════════════════════════ */
function pixelToGame(px, py) {
  const c = MAP_CALIBRATION[currentFloor];
  if (!c) return { x: '?', y: '?' };
  const scale = c.radiusGame / c.radiusPixel;
  return {
    x: Math.round(c.centerGame.x + (px - c.centerPixel.x) * scale),
    y: Math.round(c.centerGame.y + (py - c.centerPixel.y) * scale),
  };
}
function gameToPixel(gx, gy) {
  const c = MAP_CALIBRATION[currentFloor];
  if (!c) return { x: 0, y: 0 };
  const scale = c.radiusPixel / c.radiusGame;
  return {
    x: c.centerPixel.x + (gx - c.centerGame.x) * scale,
    y: c.centerPixel.y + (gy - c.centerGame.y) * scale,
  };
}
function imageToScreen(imgX, imgY) {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  return { x: cx + (imgX - MAP_SIZE / 2) * zoomLevel, y: cy + (imgY - MAP_SIZE / 2) * zoomLevel };
}
function screenToImage(sx, sy) {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  return { x: (sx - cx) / zoomLevel + MAP_SIZE / 2, y: (sy - cy) / zoomLevel + MAP_SIZE / 2 };
}

/* ══════════════════════════════════
   HELPER
══════════════════════════════════ */
function isZoneFilterEnabled() {
  const cb = document.querySelector('.marker-filter[data-type="zone_monstre"]');
  return cb ? cb.checked : false;
}

function cleanupAllZones() {
  if (window._zoneLeaveTimer) {
    clearTimeout(window._zoneLeaveTimer);
    window._zoneLeaveTimer = null;
  }
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  if (!isZoneFilterEnabled()) {
    document.querySelectorAll('.monster-pin-static').forEach(p => p.remove());
  }
  const zt = document.getElementById('zone-tooltip');
  if (zt) zt.classList.add('hidden');
  const svgEl = document.getElementById('zones-layer');
  if (svgEl) {
    const zoneOn = isZoneFilterEnabled();
    svgEl.querySelectorAll('polygon').forEach(poly => {
      poly.style.opacity = zoneOn ? '1' : '0';
    });
    svgEl.querySelectorAll('text').forEach(t => {
      t.style.opacity = zoneOn ? '1' : '0';
    });
  }
  const zones = FLOOR_ZONES[currentFloor] || [];
  if (!isZoneFilterEnabled()) {
    zones.forEach(zone => {
      const regionName = zone.regionName || zone.name;
      const markerData = (FLOOR_MARKERS[currentFloor] || []).find(m =>
        m.type === 'région' && m.name === regionName
      );
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '1'; pin.style.pointerEvents = ''; pin.style.cursor = ''; }
      }
    });
  }
  window._zoneCleanup = null;
}

/* ══════════════════════════════════
   MOLETTE ÉTAGES
══════════════════════════════════ */
function buildWheel() {
  wheelTrack.innerHTML = '';
  for (let i = 1; i <= FLOOR_COUNT; i++) {
    const el = document.createElement('div');
    el.className   = 'wheel-num' + (i === currentFloor ? ' wheel-active' : '');
    el.textContent = String(i).padStart(2, '0');
    el.dataset.floor = i;
    el.addEventListener('click', () => goToFloor(i));
    wheelTrack.appendChild(el);
  }
  scrollWheelTo(currentFloor);

  const coordDisplay = document.createElement('div');
  coordDisplay.id        = 'coord-display';
  coordDisplay.className = 'coord-display hidden';
  coordDisplay.innerHTML = '<span id="coord-zone"></span><span id="coord-xy"></span>';
  document.querySelector('.map-main').appendChild(coordDisplay);

  mapViewport.addEventListener('mousemove', (e) => {
    const c = MAP_CALIBRATION[currentFloor];
    if (!c) return;
    const vp   = clientToVp(e.clientX, e.clientY);
    const img  = screenToImage(vp.x, vp.y);
    const game = pixelToGame(img.x, img.y);
    document.getElementById('coord-zone').textContent = FLOOR_NAMES[currentFloor] || `Étage ${currentFloor}`;
    document.getElementById('coord-xy').textContent   = `X: ${game.x}  Y: ${game.y}`;
    coordDisplay.classList.remove('hidden');
  });
  mapViewport.addEventListener('mouseleave', () => {
    coordDisplay.classList.add('hidden');
    window._zonePinActive = false;
    cleanupAllZones();
  });
}

function scrollWheelTo(floor) {
  const display   = document.querySelector('.wheel-display');
  const midHeight = display.offsetHeight / 2;
  const offset    = -(floor - 1) * ITEM_HEIGHT + midHeight - ITEM_HEIGHT / 2;
  wheelTrack.style.transform = `translateY(${offset}px)`;
  document.querySelectorAll('.wheel-num').forEach(el => {
    el.classList.toggle('wheel-active', parseInt(el.dataset.floor) === floor);
  });
}

/* ══════════════════════════════════
   CHANGEMENT D'ÉTAGE
══════════════════════════════════ */
function goToFloor(n) {
  n = Math.max(1, Math.min(FLOOR_COUNT, n));
  currentFloor = n;
  floorInput.value          = n;
  floorDisplay.textContent  = String(n).padStart(2, '0');
  floorInfoNum.textContent  = n;
  floorNameDisp.textContent = FLOOR_NAMES[n] || `Étage ${n}`;

  const mapImg = document.getElementById('map-svg');
  mapImg.style.opacity = '0';
  mapImg.src = `img/maps/floor-${n}.png`;
  mapImg.onload  = () => { mapImg.style.opacity = '1'; mapImg.removeAttribute('data-missing'); };
  mapImg.onerror = () => { mapImg.src = ''; mapImg.setAttribute('data-missing', 'true'); mapImg.style.opacity = '0'; };

  scrollWheelTo(n);
  renderMarkers();
  hideTooltip();
}

/* ══════════════════════════════════
   CLUSTERING
══════════════════════════════════ */
function clusterMarkers(markers) {
  const positioned = markers.map(m => {
    const img = gameToPixel(m.gx, m.gy);
    const s   = imageToScreen(img.x, img.y);
    return { ...m, sx: s.x, sy: s.y };
  });
  const clusters = [];
  const used = new Set();
  positioned.forEach((m, i) => {
    if (used.has(i)) return;
    const group = [m];
    used.add(i);
    positioned.forEach((other, j) => {
      if (used.has(j)) return;
      if (Math.hypot(m.sx - other.sx, m.sy - other.sy) < CLUSTER_RADIUS_PX) {
        group.push(other); used.add(j);
      }
    });
    clusters.push(group);
  });
  return clusters;
}

/* ══════════════════════════════════
   PINS MONSTRES AU HOVER
══════════════════════════════════ */
function spawnMonsterPinsStatic(zone) {
  if (!zone.monsters || zone.monsters.length === 0) return;

  const cx  = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
  const cy  = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
  const imgC = gameToPixel(cx, cy);
  const sC   = imageToScreen(imgC.x, imgC.y);
  const count = zone.monsters.length;
  const radius = 52;
  const startAngle  = -150 * (Math.PI / 180);
  const endAngle    = -30  * (Math.PI / 180);
  const step        = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
  const offsetAngle = count === 1 ? (startAngle + endAngle) / 2 : startAngle;

  zone.monsters.forEach((monster, i) => {
    const angle = offsetAngle + i * step;
    const sx = sC.x + Math.cos(angle) * radius;
    const sy = sC.y + Math.sin(angle) * radius;

    const pin = document.createElement('div');
    pin.className    = 'marker monster-pin-static';
    pin.dataset.type = 'monster-static';
    pin.style.left   = sx + 'px';
    pin.style.top    = sy + 'px';
    pin.style.zIndex = '10';
    if (monster.link) pin.style.cursor = 'pointer';

    const icon = document.createElement('div');
    icon.className        = 'marker-icon';
    icon.textContent      = monster.emoji || '💀';
    icon.style.background = zone.color;
    icon.style.boxShadow  = `0 2px 12px ${zone.color}88`;
    pin.appendChild(icon);

    pin.addEventListener('mouseenter', () => showTooltip({
      type: 'zone_monstre',
      name: monster.name,
      desc: `Niveau ${monster.level} · ${monster.difficulty}`,
      link: monster.link,
    }));
    pin.addEventListener('mouseleave', hideTooltip);
    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (monster.link) window.open(monster.link, '_blank');
    });

    markersLayer.appendChild(pin);
  });
}

function spawnMonsterPins(zone) {
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  if (!zone.monsters || zone.monsters.length === 0) return;

  const cx      = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
  const cy      = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
  const imgC    = gameToPixel(cx, cy);
  const sC      = imageToScreen(imgC.x, imgC.y);
  const count   = zone.monsters.length;
  const radius  = 52;
  const startAngle  = -150 * (Math.PI / 180);
  const endAngle    = -30  * (Math.PI / 180);
  const step        = count > 1 ? (endAngle - startAngle) / (count - 1) : 0;
  const offsetAngle = count === 1 ? (startAngle + endAngle) / 2 : startAngle;

  zone.monsters.forEach((monster, i) => {
    const angle = offsetAngle + i * step;
    const sx    = sC.x + Math.cos(angle) * radius;
    const sy    = sC.y + Math.sin(angle) * radius;

    const pin = document.createElement('div');
    pin.className    = 'marker monster-pin-hover';
    pin.dataset.type = 'zone_monstre';
    pin.style.left   = sx + 'px';
    pin.style.top    = sy + 'px';
    pin.style.zIndex = '10';
    if (monster.link) pin.style.cursor = 'pointer';

    const icon = document.createElement('div');
    icon.className        = 'marker-icon';
    icon.textContent      = monster.emoji || '💀';
    icon.style.background = zone.color;
    icon.style.boxShadow  = `0 2px 12px ${zone.color}88`;
    icon.style.color      = zone.color;
    pin.appendChild(icon);

  pin.addEventListener('mouseenter', () => {
    if (window._zoneLeaveTimer) {
      clearTimeout(window._zoneLeaveTimer);
      window._zoneLeaveTimer = null;
    }
    window._zonePinActive = true;
    const zt = document.getElementById('zone-tooltip');
    if (zt) zt.classList.remove('hidden');

    tooltipType.textContent = 'Monstre';
    tooltipName.textContent = monster.name;
    tooltipDesc.textContent = `Niveau ${monster.level} · ${monster.difficulty}`;
    if (monster.link) {
      tooltipLink.href   = monster.link;
      tooltipLink.target = '_blank';
      tooltipLink.rel    = 'noopener noreferrer';
      tooltipLink.classList.remove('hidden');
    } else {
      tooltipLink.classList.add('hidden');
    }
    tooltip.classList.remove('hidden');
  });

    pin.addEventListener('mouseleave', (e) => {
      if (pin.contains(e.relatedTarget)) return;
      window._zonePinActive = false;
      window._zoneLeaveTimer = setTimeout(() => {
        if (!window._zonePinActive) {
          hideTooltip();
          window._zoneCleanup && window._zoneCleanup();
        }
      }, 400);
    });

    pin.addEventListener('click', (e) => {
      e.stopPropagation();
      if (monster.link) window.open(monster.link, '_blank');
    });

    markersLayer.appendChild(pin);
  });
}

/* ══════════════════════════════════
   RENDU ZONES
══════════════════════════════════ */
function isZoneHoverEnabled() {
  const cb = document.getElementById('zone-hover-toggle');
  return cb ? cb.checked : true;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].gx, yi = points[i].gy;
    const xj = points[j].gx, yj = points[j].gy;
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

function renderZones() {
  let svgEl = document.getElementById('zones-layer');
  if (!svgEl) {
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.id = 'zones-layer';
    svgEl.style.cssText = `
      position:absolute; top:0; left:0;
      width:100%; height:100%;
      pointer-events:none;
      z-index:1;
      overflow:visible;
    `;
    markersLayer.parentElement.insertBefore(svgEl, markersLayer);
  }
  svgEl.innerHTML = '';

  if (window._zoneLeaveTimer) { clearTimeout(window._zoneLeaveTimer); window._zoneLeaveTimer = null; }
  if (window._zoneHoverHandler) { mapViewport.removeEventListener('mousemove', window._zoneHoverHandler); window._zoneHoverHandler = null; }
  document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
  window._zoneCleanup   = null;
  window._activeZoneId  = null;

  let zoneTooltip = document.getElementById('zone-tooltip');
  if (!zoneTooltip) {
    zoneTooltip = document.createElement('div');
    zoneTooltip.id        = 'zone-tooltip';
    zoneTooltip.className = 'zone-tooltip hidden';
    document.querySelector('.map-main').appendChild(zoneTooltip);
  }
  zoneTooltip.classList.add('hidden');

  const zoneOn = isZoneFilterEnabled();
  const zones  = FLOOR_ZONES[currentFloor] || [];

  zones.forEach(zone => {
    const pointsStr = zone.points.map(p => {
      const img = gameToPixel(p.gx, p.gy);
      const s   = imageToScreen(img.x, img.y);
      return `${s.x},${s.y}`;
    }).join(' ');

    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.style.pointerEvents = 'none';

    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points',           pointsStr);
    poly.setAttribute('stroke',           zone.color);
    poly.setAttribute('stroke-width',     '2');
    poly.setAttribute('stroke-dasharray', '6 3');
    poly.setAttribute('fill',             zoneOn ? zone.color + '55' : zone.color + '2a');
    poly.style.transition    = 'opacity .25s ease';
    poly.style.opacity       = zoneOn ? '1' : '0';
    poly.style.pointerEvents = 'none';

    const cx   = zone.points.reduce((s, p) => s + p.gx, 0) / zone.points.length;
    const cy   = zone.points.reduce((s, p) => s + p.gy, 0) / zone.points.length;
    const imgC = gameToPixel(cx, cy);
    const sC   = imageToScreen(imgC.x, imgC.y);

    const emojiText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    emojiText.setAttribute('x',                 sC.x);
    emojiText.setAttribute('y',                 sC.y - 10);
    emojiText.setAttribute('text-anchor',       'middle');
    emojiText.setAttribute('dominant-baseline', 'middle');
    emojiText.setAttribute('font-size',         '22');
    emojiText.style.transition    = 'opacity .25s ease';
    emojiText.style.opacity       = zoneOn ? '1' : '0';
    emojiText.style.pointerEvents = 'none';
    emojiText.textContent = zone.emoji || '❓';

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x',                 sC.x);
    label.setAttribute('y',                 sC.y + 16);
    label.setAttribute('text-anchor',       'middle');
    label.setAttribute('dominant-baseline', 'middle');
    label.setAttribute('fill',              zone.color);
    label.setAttribute('font-family',       'JetBrains Mono, monospace');
    label.setAttribute('font-size',         '13');
    label.setAttribute('font-weight',       '700');
    label.setAttribute('stroke',            'rgba(0,0,0,0.9)');
    label.setAttribute('stroke-width',      '4');
    label.setAttribute('paint-order',       'stroke fill');
    label.setAttribute('letter-spacing',    '1');
    label.style.transition    = 'opacity .25s ease';
    label.style.opacity       = zoneOn ? '1' : '0';
    label.style.pointerEvents = 'none';
    label.textContent = zone.name;

    zone._cleanup = () => {
      const stillOn = isZoneFilterEnabled();
      poly.style.opacity      = stillOn ? '1' : '0';
      poly.setAttribute('fill', stillOn ? zone.color + '55' : zone.color + '2a');
      emojiText.style.opacity = stillOn ? '1' : '0';
      label.style.opacity     = stillOn ? '1' : '0';
      zoneTooltip.classList.add('hidden');
      document.querySelectorAll('.monster-pin-hover').forEach(p => p.remove());
      const regionName = zone.regionName || zone.name;
      const markerData = (FLOOR_MARKERS[currentFloor] || []).find(m => m.type === 'région' && m.name === regionName);
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '1'; pin.style.pointerEvents = ''; pin.style.cursor = ''; }
      }
      window._activeZoneId = null;
      window._zoneCleanup  = null;
    };

    zone._activate = () => {
      window._zoneCleanup     = zone._cleanup;
      poly.style.opacity      = '1';
      poly.setAttribute('fill', zone.color + '55');
      emojiText.style.opacity = '1';
      label.style.opacity     = '1';
      const regionName = zone.regionName || zone.name;
      const markerData = (FLOOR_MARKERS[currentFloor] || []).find(m => m.type === 'région' && m.name === regionName);
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '0'; pin.style.pointerEvents = 'none'; pin.style.cursor = 'default'; }
      }
      if (zone.monsters && zone.monsters.length > 0) {
        const monstersHtml = zone.monsters.map(m => `
          <div class="zone-tooltip-monster">
            <span class="zone-tooltip-monster-emoji">${m.emoji}</span>
            <span class="zone-tooltip-monster-name">${m.name}</span>
            <span class="zone-tooltip-monster-level">Niv. ${m.level}</span>
            <span class="zone-tooltip-monster-diff">${m.difficulty}</span>
          </div>`).join('');
        zoneTooltip.innerHTML = `
          <div class="zone-tooltip-header">
            <span class="zone-tooltip-emoji">${zone.emoji || '❓'}</span>
            <span class="zone-tooltip-name" style="color:${zone.color}">${zone.name}</span>
          </div>
          <div class="zone-tooltip-sep"></div>
          <div class="zone-tooltip-monsters">${monstersHtml}</div>`;
        zoneTooltip.classList.remove('hidden');
      }
      spawnMonsterPins(zone);
    };

    g.appendChild(poly);
    g.appendChild(emojiText);
    g.appendChild(label);
    svgEl.appendChild(g);
  });

  window._zoneHoverHandler = (e) => {
    if (!isZoneHoverEnabled()) return;
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    const hasPriorityPin = els.some(el => {
      const marker = el.closest('.marker');
      return marker &&
             marker.dataset.type !== 'zone_monstre' &&
             marker.dataset.type !== 'monster-static' &&
             !marker.classList.contains('monster-pin-hover') &&
             !marker.classList.contains('monster-pin-static');
    });
    if (hasPriorityPin) {
      if (window._zoneCleanup) { window._zoneCleanup(); }
      return;
    }

    const vp  = clientToVp(e.clientX, e.clientY);
    const img = screenToImage(vp.x, vp.y);
    const gp  = pixelToGame(img.x, img.y);
    const hitZone = zones.find(z => pointInPolygon(gp.x, gp.y, z.points));

    if (!hitZone) {
      if (window._zoneCleanup && !window._zoneLeaveTimer) {
        window._zoneLeaveTimer = setTimeout(() => {
          if (window._zoneCleanup) window._zoneCleanup();
          window._zoneLeaveTimer = null;
        }, 400);
      }
      return;
    }

    if (window._zoneLeaveTimer) { clearTimeout(window._zoneLeaveTimer); window._zoneLeaveTimer = null; }

    if (window._activeZoneId === hitZone.id) return;

    if (window._zoneCleanup) window._zoneCleanup();
    window._activeZoneId = hitZone.id;
    hitZone._activate();
  };

  mapViewport.addEventListener('mousemove', window._zoneHoverHandler);

  if (zoneOn) {
    zones.forEach(zone => {
      const regionName = zone.regionName || zone.name;
      const markerData = (FLOOR_MARKERS[currentFloor] || []).find(m =>
        m.type === 'région' && m.name === regionName
      );
      if (markerData) {
        const pin = markersLayer.querySelector(`.marker[data-id="${markerData.id}"]`);
        if (pin) { pin.style.opacity = '0'; pin.style.pointerEvents = 'none'; pin.style.cursor = 'default'; }
      }
      spawnMonsterPinsStatic(zone);
    });
  }
}

/* ══════════════════════════════════
   RENDU MARQUEURS
══════════════════════════════════ */
function renderMarkers() {
  markersLayer.innerHTML = '';
  document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());

  const markers = FLOOR_MARKERS[currentFloor] || [];
  const focused = _searchFocusId ? markers.find(m => m.id === _searchFocusId) : null;

  const visible = markers.filter(m => {
    if (m.id === _searchFocusId) return false;
    const cb = document.querySelector(`.marker-filter[data-type="${m.type}"]`);
    return !cb || cb.checked;
  });

  clusterMarkers(visible).forEach(group => {
    if (group.length === 1) renderSingleMarker(group[0]);
    else                    renderCluster(group);
  });

  if (_searchFocusId) {
    markersLayer.querySelectorAll('.marker').forEach(el => el.classList.add('marker-dimmed'));
  }
  if (focused) {
    const img = gameToPixel(focused.gx, focused.gy);
    const s   = imageToScreen(img.x, img.y);
    renderSingleMarker({ ...focused, sx: s.x, sy: s.y });
    const el = markersLayer.querySelector(`.marker[data-id="${focused.id}"]`);
    if (el) el.classList.remove('marker-dimmed');
  }

  renderZones();
}

function renderSingleMarker(m) {
  const el = document.createElement('div');
  el.className    = 'marker';
  el.dataset.type = m.type;
  el.dataset.id   = m.id;
  el.style.left   = m.sx + 'px';
  el.style.top    = m.sy + 'px';

  if (m.colorLeft && m.colorRight) {
    const icon  = document.createElement('div');
    icon.className = 'marker-icon-split';
    const left  = document.createElement('div');
    left.className        = 'split-left';
    left.style.background = m.colorLeft;
    left.textContent      = m.emojiLeft || '';
    const right = document.createElement('div');
    right.className        = 'split-right';
    right.style.background = m.colorRight;
    right.textContent      = m.emojiRight || '';
    icon.appendChild(left);
    icon.appendChild(right);
    el.appendChild(icon);
  } else {
    const icon = document.createElement('div');
    icon.className   = 'marker-icon';
    icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';
    el.appendChild(icon);
  }

  el.addEventListener('mouseenter', () => showTooltip(m));
  el.addEventListener('mouseleave', hideTooltip);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    pinTooltip(m);
    if (m.link) window.open(m.link, '_blank');
  });
  markersLayer.appendChild(el);
}

function renderCluster(group) {
  const sx = group.reduce((s, m) => s + m.sx, 0) / group.length;
  const sy = group.reduce((s, m) => s + m.sy, 0) / group.length;

  const el = document.createElement('div');
  el.className  = 'marker cluster-marker';
  el.style.left = sx + 'px';
  el.style.top  = sy + 'px';
  el.innerHTML  = `<div class="cluster-dot" data-count="${group.length}">⚙️</div>`;

  let isExpanded = false;

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());
    if (isExpanded) {
      isExpanded = false;
      markersLayer.querySelectorAll('.marker').forEach(m => m.classList.remove('marker-dimmed'));
      return;
    }
    isExpanded = true;
    markersLayer.querySelectorAll('.marker').forEach(m => { if (m !== el) m.classList.add('marker-dimmed'); });

    const expanded      = document.createElement('div');
    expanded.className  = 'cluster-expanded';
    expanded.style.left = sx + 'px';
    expanded.style.top  = sy + 'px';

    const angleStep    = (2 * Math.PI) / group.length;
    const deployRadius = Math.max(50, group.length * 12);

    group.forEach((m, i) => {
      const angle = i * angleStep - Math.PI / 2;
      const mx    = Math.round(Math.cos(angle) * deployRadius);
      const my    = Math.round(Math.sin(angle) * deployRadius);

      const line = document.createElement('div');
      line.className = 'cluster-line';
      const len = Math.hypot(mx, my);
      const ang = Math.atan2(my, mx) * 180 / Math.PI;
      line.style.cssText = `width:${len}px;transform:rotate(${ang}deg);transform-origin:0 50%;left:0;top:-16px;position:absolute;`;
      expanded.appendChild(line);

      const sub = document.createElement('div');
      sub.className    = 'marker cluster-sub';
      sub.dataset.type = m.type;
      sub.style.left   = mx + 'px';
      sub.style.top    = (my - 16) + 'px';

      const icon = document.createElement('div');
      icon.className   = 'marker-icon marker-icon-sm';
      icon.textContent = m.emoji || MARKER_EMOJI[m.type] || '📍';
      sub.appendChild(icon);

      sub.addEventListener('mouseenter', () => showTooltip(m));
      sub.addEventListener('mouseleave', hideTooltip);
      sub.addEventListener('click', (e) => {
        e.stopPropagation();
        pinTooltip(m);
        if (m.link) window.open(m.link, '_blank');
      });
      expanded.appendChild(sub);
    });

    markersLayer.appendChild(expanded);
    setTimeout(() => {
      document.addEventListener('click', () => {
        expanded.remove();
        isExpanded = false;
        markersLayer.querySelectorAll('.marker').forEach(m => m.classList.remove('marker-dimmed'));
      }, { once: true });
    }, 10);
  });

  el.addEventListener('mouseenter', () => {
    tooltipType.textContent = `${group.length} éléments`;
    tooltipName.textContent = group.map(m => m.name).join(', ');
    tooltipDesc.textContent = 'Cliquez pour déployer';
    tooltipLink.classList.add('hidden');
    tooltip.classList.remove('hidden');
  });
  el.addEventListener('mouseleave', hideTooltip);
  markersLayer.appendChild(el);
}

/* ══════════════════════════════════
   TOOLTIP
══════════════════════════════════ */
const TYPE_LABELS = {
  donjon:           'Donjon',
  région:           'Région',
  ressource:        'Ressource',
  marchand:         'Marchand',
  artisant:         'Artisant',
  repreneur_butin:  'Repreneur de Butin',
  quête_principale: 'Quête Principale',
  quête_secondaire: 'Quête Secondaire',
  clef:             'Clef',
  obj_special:      'Objet Spécial',
};

let _pinnedTooltip    = false;
let _tooltipHideTimer = null;

function showTooltip(marker) {
  clearTimeout(_tooltipHideTimer);
  tooltipType.textContent = TYPE_LABELS[marker.type] || marker.type;
  tooltipName.textContent = marker.name;
  tooltipDesc.textContent = marker.desc;
  if (marker.link) {
    tooltipLink.href   = marker.link;
    tooltipLink.target = '_blank';
    tooltipLink.rel    = 'noopener noreferrer';
    tooltipLink.classList.remove('hidden');
  } else {
    tooltipLink.classList.add('hidden');
  }
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  if (_pinnedTooltip) return;
  if (window._zonePinActive) return;
  _tooltipHideTimer = setTimeout(() => tooltip.classList.add('hidden'), 150);
}

function pinTooltip(marker) {
  _pinnedTooltip = true;
  showTooltip(marker);
  setTimeout(() => {
    document.addEventListener('click', function onClickOutside(e) {
      if (!tooltip.contains(e.target) && !e.target.closest('.marker')) {
        _pinnedTooltip = false;
        tooltip.classList.add('hidden');
        document.removeEventListener('click', onClickOutside);
      }
    });
  }, 0);
}

/* ══════════════════════════════════
   FILTRES
══════════════════════════════════ */
const toggleAll = document.getElementById('toggle-all-filters');

toggleAll.addEventListener('change', () => {
  const checked = toggleAll.checked;
  document.querySelectorAll('.marker-filter').forEach(cb => { cb.checked = checked; });
  renderMarkers();
});

document.querySelectorAll('.marker-filter').forEach(cb => {
  cb.addEventListener('change', () => {
    const all   = document.querySelectorAll('.marker-filter');
    const allOn = [...all].every(c => c.checked);
    const none  = [...all].every(c => !c.checked);
    toggleAll.checked       = allOn;
    toggleAll.indeterminate = !allOn && !none;
    renderMarkers();
  });
});

tooltip.addEventListener('mouseenter', () => clearTimeout(_tooltipHideTimer));
tooltip.addEventListener('mouseleave', () => hideTooltip());

/* ══════════════════════════════════
   ZOOM & PAN
══════════════════════════════════ */
function applyTransform() {
  mapCanvas.style.transform = `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoomLevel})`;
  zoomLevelEl.textContent   = Math.round(zoomLevel * 100) + '%';
  renderMarkers();
}

function zoomFromPoint(vpX, vpY, factor) {
  const oldZoom = zoomLevel;
  zoomLevel = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * factor));
  const ratio = zoomLevel / oldZoom;
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  panOffset.x -= (vpX - cx) * (ratio - 1);
  panOffset.y -= (vpY - cy) * (ratio - 1);
  applyTransform();
}

document.getElementById('zoom-in').addEventListener('click',    () => zoomFromPoint(_vpW / 2, _vpH / 2, ZOOM_FACTOR));
document.getElementById('zoom-out').addEventListener('click',   () => zoomFromPoint(_vpW / 2, _vpH / 2, 1 / ZOOM_FACTOR));
document.getElementById('zoom-reset').addEventListener('click', () => { zoomLevel = 1; panOffset = { x: 0, y: 0 }; applyTransform(); });

mapViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const vp = clientToVp(e.clientX, e.clientY);
  zoomFromPoint(vp.x, vp.y, e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR);
}, { passive: false });

mapViewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.marker')) return;
  isPanning = true; panLastX = e.clientX; panLastY = e.clientY;
  mapViewport.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panOffset.x += e.clientX - panLastX;
  panOffset.y += e.clientY - panLastY;
  panLastX = e.clientX; panLastY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', () => { isPanning = false; mapViewport.style.cursor = 'grab'; });

mapViewport.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; isPanning = true; panLastX = t.clientX; panLastY = t.clientY;
}, { passive: true });
mapViewport.addEventListener('touchmove', (e) => {
  if (!isPanning) return;
  const t = e.touches[0];
  panOffset.x += t.clientX - panLastX; panOffset.y += t.clientY - panLastY;
  panLastX = t.clientX; panLastY = t.clientY;
  applyTransform();
}, { passive: true });
mapViewport.addEventListener('touchend', () => { isPanning = false; });

/* ══════════════════════════════════
   CONTRÔLES MOLETTE ÉTAGES
══════════════════════════════════ */
document.getElementById('wheel-up').addEventListener('click',   () => goToFloor(currentFloor - 1));
document.getElementById('wheel-down').addEventListener('click', () => goToFloor(currentFloor + 1));

document.querySelector('.wheel-display').addEventListener('wheel', (e) => {
  e.preventDefault();
  goToFloor(currentFloor + (e.deltaY > 0 ? -1 : 1));
}, { passive: false });

let wheelDragging = false, wheelDragStartY = 0, wheelDragFloor = 1;
const WHEEL_DRAG_SENSITIVITY = 18;
const wheelDisplay = document.querySelector('.wheel-display');

wheelDisplay.addEventListener('mousedown', (e) => {
  wheelDragging = true; wheelDragStartY = e.clientY; wheelDragFloor = currentFloor;
  wheelDisplay.style.cursor = 'grabbing'; e.preventDefault();
});
window.addEventListener('mousemove', (e) => {
  if (!wheelDragging) return;
  const target = Math.max(1, Math.min(FLOOR_COUNT,
    wheelDragFloor - Math.round((e.clientY - wheelDragStartY) / WHEEL_DRAG_SENSITIVITY)));
  if (target !== currentFloor) goToFloor(target);
});
window.addEventListener('mouseup', () => {
  if (!wheelDragging) return; wheelDragging = false; wheelDisplay.style.cursor = 'grab';
});
wheelDisplay.addEventListener('touchstart', (e) => {
  const t = e.touches[0]; wheelDragging = true; wheelDragStartY = t.clientY; wheelDragFloor = currentFloor;
}, { passive: true });
wheelDisplay.addEventListener('touchmove', (e) => {
  if (!wheelDragging) return;
  const t = e.touches[0];
  const target = Math.max(1, Math.min(FLOOR_COUNT,
    wheelDragFloor - Math.round((t.clientY - wheelDragStartY) / WHEEL_DRAG_SENSITIVITY)));
  if (target !== currentFloor) goToFloor(target);
}, { passive: true });
wheelDisplay.addEventListener('touchend', () => { wheelDragging = false; });

floorInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { const v = parseInt(floorInput.value); if (!isNaN(v)) goToFloor(v); }
});
floorInput.addEventListener('blur', () => {
  const v = parseInt(floorInput.value);
  if (!isNaN(v)) goToFloor(v); else floorInput.value = currentFloor;
});
document.addEventListener('keydown', (e) => {
  if (document.activeElement === floorInput) return;
  if (e.key === 'ArrowUp')   goToFloor(currentFloor + 1);
  if (e.key === 'ArrowDown') goToFloor(currentFloor - 1);
});

window.addEventListener('resize', () => { updateVpBounds(); renderMarkers(); });

/* ══════════════════════════════════
   BARRE DE RECHERCHE
══════════════════════════════════ */
const searchInput   = document.getElementById('search-input');
const searchResults = document.getElementById('search-results');

function getAllMarkers() {
  const all = [];
  Object.entries(FLOOR_MARKERS).forEach(([floor, markers]) => {
    markers.forEach(m => all.push({ ...m, floor: parseInt(floor) }));
  });
  return all;
}

function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

searchInput.addEventListener('input', () => {
  const query = searchInput.value.trim();
  if (query.length < 2) { searchResults.classList.add('hidden'); return; }

  const norm    = normalize(query);
  const matches = getAllMarkers().filter(m =>
    normalize(m.name).includes(norm) ||
    normalize(m.desc || '').includes(norm) ||
    normalize(TYPE_LABELS[m.type] || m.type).includes(norm)
  ).slice(0, 12);

  searchResults.innerHTML = '';
  if (matches.length === 0) {
    searchResults.innerHTML = '<div class="search-result-empty">Aucun résultat</div>';
  } else {
    matches.forEach(m => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <span class="search-result-emoji">${m.emoji || MARKER_EMOJI[m.type] || '📍'}</span>
        <div class="search-result-info">
          <span class="search-result-name">${m.name}</span>
          <span class="search-result-meta">${TYPE_LABELS[m.type] || m.type} · Étage ${m.floor}</span>
        </div>`;
      item.addEventListener('click', () => {
        if (m.floor !== currentFloor) goToFloor(m.floor);
        const img = gameToPixel(m.gx, m.gy);
        panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
        panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);
        _searchFocusId = m.id;
        applyTransform();
        showTooltip(m);
        searchResults.classList.add('hidden');
        searchInput.value = '';
      });
      searchResults.appendChild(item);
    });
  }
  searchResults.classList.remove('hidden');
});

mapViewport.addEventListener('click', (e) => {
  if (!e.target.closest('.marker') && !e.target.closest('.map-searchbar')) {
    _searchFocusId = null;
    renderMarkers();
  }
});
document.addEventListener('click', (e) => {
  if (!e.target.closest('.map-searchbar')) searchResults.classList.add('hidden');
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    searchResults.classList.add('hidden');
    searchInput.value = '';
    _searchFocusId = null;
    renderMarkers();
  }
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
updateVpBounds();
requestAnimationFrame(() => { updateVpBounds(); renderMarkers(); });
buildWheel();
goToFloor(1);