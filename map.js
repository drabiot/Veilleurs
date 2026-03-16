/* ═══════════════════════════════════════════════
   Veilleurs au Clair de Lune — map.js
═══════════════════════════════════════════════ */

const FLOOR_COUNT = 100;

const MARKER_EMOJI = {
  région:           '📍',
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

const FLOOR_MARKERS = {
  1: [
    { id: 'm1',  type: 'donjon',    gx: 3334, gy: 1038, name: "Raid Tour du Kobold",          desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-kokolb' },
    { id: 'm2',  type: 'donjon',    gx: 2709, gy: 4408, name: 'Sous-Donjon Nasgul',           desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-squelette' },
    { id: 'm3',  type: 'donjon',    gx: 4210, gy: 3895, name: 'Donjon Mine de Geldorak',      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-geldorak' },
    { id: 'm4',  type: 'donjon',    gx: 2300, gy: 2400, name: "Donjon Labyrinthe des Déchus", desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-labyrinthe-des-dechus' },
    { id: 'm5',  type: 'donjon',    gx: 955,  gy: 1212, name: "Donjon Xal'Zirith",            desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/donjons/donjon-xalzirith' },

    { id: 'm6',  type: 'région',    gx: 1737, gy: 4300, name: 'Ville de Départ',              desc: "La ville de départ est un havre paisible dans un monde virtuel encore inconnu. C'est ici que chaque aventure commence", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/ville-de-depart' },
    { id: 'm7',  type: 'région',    gx: 1395, gy: 3450, name: 'Hanaka',                       desc: "Un hameau boisé niché entre les collines où les sangliers rôdent à la lisière. Berceau des premiers affrontements", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/hanaka' },
    { id: 'm8',  type: 'région',    gx: 2445, gy: 3970, name: 'Vallée des Loups',             desc: "Un vallon brumeux où résonnent encore les hurlements. On raconte qu'aucun loup n'y chasse seul... Leurs ombres veillent depuis les hauteurs", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-loups' },
    { id: 'm9',  type: 'région',    gx: 1213, gy: 3108, name: 'Marécage Putride',             desc: "Un marais dense et hostile, où la brume empoisonne l'air et masque les dangers. Peu en ressortent indemnes...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/marecage-putride' },
    { id: 'm10', type: 'région',    gx: 1800, gy: 3500, name: 'Zone des Sangliers',           desc: "Un territoire sauvage où les sangliers règnent. Leurs grognements résonnent entre les arbres, et seuls les plus braves osent s'y aventurer", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/zone-sanglier' },
    { id: 'm11', type: 'région',    gx: 948,  gy: 4189, name: 'Vallée des Pétales',           desc: "Une vallée enchantée où les pétales dansent au vent. Le parfum des fleurs apaise l'âme des voyageurs. Mais derrière la beauté... sommeille un ancien secret", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallee-des-petales' },
    { id: 'm12', type: 'région',    gx: 2764, gy: 4680, name: 'Château Abandonné',            desc: "Les ruines d'un château oublié, rongé par le temps. Ses murs effondrés murmurent encore les échos d'antan. Un lieu que même la lumière semble fuir", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/chateau-abandonne' },
    { id: 'm13', type: 'région',    gx: 3054, gy: 3684, name: 'Mizunari',                     desc: "Petit village paisible niché au bord d'un lac clair. Les habitants vivent au rythme des vagues et du vent. Un lieu parfait pour souffler entre deux batailles", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mizunari' },
    { id: 'm14', type: 'région',    gx: 3221, gy: 4097, name: "Archipel d'Ika",               desc: "Un archipel tropical où les tortues géantes se rassemblent. Chaque île cache des mystères anciens et une faune unique. Le calme n'est qu'une façade…", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/archipel-dika' },
    { id: 'm15', type: 'région',    gx: 2249, gy: 3210, name: 'Quartier OG',                  desc: "Le bastion de la Guilde OG, réputée et redoutée. Un lieu stratégique réservé aux vétérans d'élite. Les murs transpirent la gloire et les victoires passées", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/quartier-og' },
    { id: 'm16', type: 'région',    gx: 935,  gy: 3580, name: 'Cyclorim',                     desc: "Une arène antique taillée dans la roche rouge. On raconte qu'un oeil unique y veille encore, prêt à juger les intrus par la force brute", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cyclorim' },
    { id: 'm17', type: 'région',    gx: 3978, gy: 3909, name: 'Mine de Geldorak',             desc: "Creusée au coeur de la montagne, la mine de Geldorak abritait autrefois une colonie de mineurs renommés. Mais un jour, un cri retentit dans les galeries... Depuis, les couloirs sont scellés et personne n'ose plus y descendre", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-geldorak' },
    { id: 'm18', type: 'région',    gx: 2778, gy: 2998, name: 'CastelBrume',                  desc: "Perché au sommet d'une crête oubliée, le hameau de CastelBrume veille sur la vallée. Ses moulins hurlent dans la brume glacée, comme un appel aux âmes perdues...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/castelbrume' },
    { id: 'm19', type: 'région',    gx: 390,  gy: 3041, name: 'Vallhat',                      desc: "Perchée au sommet d'un massif venteux, Vallhat veille, silencieuse et isolée. Ses hauteurs cachent bien des secrets", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/vallhat' },
    { id: 'm20', type: 'région',    gx: 3937, gy: 2031, name: 'Citadelle des Neiges',         desc: "Autrefois bastion imprenable, la Citadelle des Neiges fut le théâtre d'un siège oublié, perdu dans les flocons du temps. Ses remparts, figés dans la glace, gardent les cicatrices. Aujourd'hui, seuls les plus téméraires osent franchir ses portes...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/citadelle-des-neiges' },
    { id: 'm21', type: 'région',    gx: 313,  gy: 2455, name: 'Jardin des Géants',            desc: "Un lieu oublié où la nature a repris ses droits. Certains disent y entendre des voix murmurées dans le vent, comme si les géants veillaient encore. Une oasis paisible... en apparence seulement", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/jardin-des-geants' },
    { id: 'm22', type: 'région',    gx: 2454, gy: 2840, name: 'Le Lac des Nénuphars',         desc: "Calme et mystère entourent ses eaux troubles... Un lieu de méditation, mais aussi de disparition", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/le-lac-des-nenuphars' },
    { id: 'm23', type: 'région',    gx: 3212, gy: 1639, name: 'Tolbana',                      desc: "Érigé à flanc de montagne, Tolbana abrite les plus grandes bibliothèques magique du monde connu. Ses ruelles vibrent d'énergie, et ses tours résonnent de l'écho des incantations millénaires", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tolbana' },
    { id: 'm24', type: 'région',    gx: 1325, gy: 2068, name: 'Antre de Aepep',               desc: "Au cœur d'une caverne oubliée dort un serpent ancien : Aepep. Nul ne sait s'il veille... ou rêve encore. Son corps gigantesque aurait façonné les galeries", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/antre-de-aepep' },
    { id: 'm25', type: 'région',    gx: 1490, gy: 1982, name: 'Virelune',                     desc: "Niché au bord d'un gouffre marin insondable, le village de Virelune vit au rythme des marées lunaire. Les pêcheurs disent voir deux lunes se refléter dans les eaux... Mais l'une d'elles ne suit jamais le ciel", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/virelune' },
    { id: 'm26', type: 'région',    gx: 1852, gy: 735,  name: 'Candelia',                     desc: "Blotti entre les pics abrupts, Candelia semble figé dans le temps. Ses lanternes vacillent sans vent, et les champs ne flétrissent jamais. Les anciens disent que les âmes y murmurent encore à la tombée du soir...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/candelia' },
    { id: 'm27', type: 'région',    gx: 3334, gy: 1038, name: 'Tour du Kobold',               desc: "Une ancienne tour en ruine, repaire d'Ilfang le seigneur Kobold. De sombres murmures montent depuis ses profondeurs", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/tour-du-kobold' },
    { id: 'm28', type: 'région',    gx: 2343, gy: 1702, name: 'Mine de Pic de Cristal',       desc: "Cette ancienne mine renferme des cristaux d'une pureté exceptionnelle. On raconte que leur éclat est lié aux émotions humaines... Mais certains mineurs, fascinés, s'y sont perdu à jamais", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/mine-de-pic-de-cristal' },
    { id: 'm29', type: 'région',    gx: 2969, gy: 1217, name: 'Cristal de Tolbana',           desc: "Des cristaux luminescents aux propriétés mystérieuses. Protégés par les mages de Tolbana...", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/cristal-de-tolbana' },
    { id: 'm30', type: 'région',    gx: 1232, gy: 1400, name: "Arakh'Nol",                    desc: "Dans les profondeurs d'Arakh'Nol, la lumière peine à percer. Chaque arbre est noué de toiles épaisses et vivante. Les murmures du vent cachent les chuchotements d'anciens esprits, et ceux qui s'y égarent devinent rarement des récits qu'on raconte. Une entité oublié y tisse plus que des pièges", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/arakhnol' },
    { id: 'm31', type: 'région',    gx: 4676, gy: 2438, name: 'Guilde Marchande',             desc: "Le Quartier général de la Guilde des Marchands, un lieu animé où s'échangent richesses et secrets. Les ruelles fourmillent d'activités et de négociation", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/regions/guilde-marchande' },

    { id: 'm32', type: 'ressource', emoji: '🌾', gx: 2263, gy: 3706, name: 'Allium',              desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#alliums' },
    { id: 'm35', type: 'ressource', emoji: '🌾', gx: 2288, gy: 3653, name: 'Blé',                 desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/herboriste#ble' },
    { id: 'm36', type: 'ressource', emoji: '🌳', gx: 2846, gy: 3517, name: 'Chêne de Forêt',      desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm38', type: 'ressource', emoji: '🌳', gx: 2357, gy: 4301, name: 'Chêne Proche',        desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#chene' },
    { id: 'm39', type: 'ressource', emoji: '🌳', gx: 1707, gy: 1207, name: 'Bouleau',             desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/bucheron#bouleau' },
    { id: 'm40', type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Charbon Petite Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm41', type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Cuivre Petite Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm42', type: 'ressource', emoji: '⛏️', gx: 2309, gy: 3509, name: 'Fer Petite Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },
    { id: 'm43', type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Charbon Grande Cave', desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#charbon' },
    { id: 'm44', type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Cuivre Grande Cave',  desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#cuivre' },
    { id: 'm45', type: 'ressource', emoji: '⛏️', gx: 903,  gy: 3448, name: 'Fer Grande Cave',     desc: "", link: 'https://guilde-sao.gitbook.io/watchers/paliers/ressources/mineur#fer' },

    { id: 'm46', type: 'artisant',  gx: 1703, gy: 4125, name: "Forgeron d'Armes",                 desc: "Forgeron des Armes pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme' },
    { id: 'm47', type: 'artisant',  gx: 1703, gy: 4125, name: "Forgeron d'Armures",               desc: "Forgeron des Armures pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure' },
    { id: 'm48', type: 'artisant',  gx: 1703, gy: 4125, name: "Forgeron d'Accessoires",           desc: "Forgeron des Accessoires pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-base' },
    { id: 'm49', type: 'artisant',  gx: 1721, gy: 4605, name: 'Marchand Étrange',                 desc: "Marchand suspect trainant derrière la Cathédrale", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#marchand-etrange' },
    { id: 'm50', type: 'artisant',  gx: 1725, gy: 4672, name: "Forgeron d'Accessoires en Cuivre", desc: "Forgeron des Accessoires en Cuivre pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-cuivre' },
    { id: 'm51', type: 'artisant',  gx: 1725, gy: 4672, name: "Forgeron d'Accessoires en Fer",    desc: "Forgeron des Accessoires en Fer pour Débutants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#accessoires-fer' },
    { id: 'm52', type: 'artisant',  gx: 1725, gy: 4672, name: 'Refaçonneur',                      desc: "Permet la fabrication de ficelle en tout genre et tout type de matériaux", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/refaconneurs#ville-de-depart' },
    { id: 'm53', type: 'artisant',  gx: 2322, gy: 3560, name: 'Forgeron de Lingots',              desc: "Forgeron de Lingots de Cuivre et de Fer", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#lingots' },
    { id: 'm54', type: 'artisant',  gx: 3193, gy: 1474, name: "Forgeron d'Armes",                 desc: "Forgeron des Armes pour Confirmés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme-1' },
    { id: 'm54', type: 'artisant',  gx: 3193, gy: 1474, name: "Forgeron d'Armures",                 desc: "Forgeron des Armures pour Confirmés", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure-1' },
    { id: 'm55', type: 'artisant',  gx: 2355, gy: 2412, name: "Forgeron d'Armes",                 desc: "Forgeron d'Armes du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#arme-2' },
    { id: 'm56', type: 'artisant',  gx: 2355, gy: 2412, name: "Forgeron d'Armures",               desc: "Forgeron d'Armures situé à l'intérieur du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/forgerons#armure-2' },
    { id: 'm57', type: 'artisant',  gx: 2394, gy: 4293, name: 'Bucheron',                         desc: "Bucheron permettant la Réalisation de Planches ou de Poudre de différents type de Bois", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/bucherons#ville-de-depart' },
    { id: 'm58', type: 'artisant',  gx: 1712, gy: 4091, name: 'Alchimiste',                       desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/alchimistes#ville-de-depart' },
    { id: 'm125', type: 'artisant',  gx: 3257, gy: 1626, name: 'Alchimiste',                       desc: "Alchimiste permettant la Réalisation de Potions et Cristaux", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/alchimistes#tolbana' },

    { id: 'm59', type: 'repreneur_butin', gx: 1720, gy: 4170, name: 'Repreneur des Débutants',  desc: "Achète des ressources digne d'un Débutant", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#ville-de-depart' },
    { id: 'm60', type: 'repreneur_butin', gx: 1446, gy: 3415, name: 'Repreneur de la Forêt',    desc: "Achète des ressources de la Forêt", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#hanaka' },
    { id: 'm61', type: 'repreneur_butin', gx: 3074, gy: 3678, name: 'Repreneur Champêtre',      desc: "Achète des ressources des Champs", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#mizunari' },
    { id: 'm62', type: 'repreneur_butin', gx: 363,  gy: 3092, name: 'Repreneur des Maraicages', desc: "Achète des ressources Gluantes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#vallaht' },
    { id: 'm63', type: 'repreneur_butin', gx: 1541, gy: 1983, name: 'Repreneur des Mers',       desc: "Achète des ressources Maritimes", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#virelune' },
    { id: 'm64', type: 'repreneur_butin', gx: 2764, gy: 4680, name: 'Repreneur de Squelette',   desc: "Achète des ressources venant des Morts", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#chateau-abandonne' },
    { id: 'm124', type: 'repreneur_butin', gx: 3217, gy: 1645, name: 'Repreneur Agguerie de Tolbana',   desc: "Achète des ressources digne d'un Combattant Agguerie", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/repreneurs-de-butins#tolbana' },

    { id: 'm65', type: 'marchand', gx: 1720, gy: 4147, name: "Marchand d'Équipement", desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#ville-de-depart' },
    { id: 'm66', type: 'marchand', gx: 1447, gy: 3390, name: "Marchand d'Équipement", desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#hanaka' },
    { id: 'm123', type: 'marchand', gx: 438,  gy: 3077, name: "Marchand d'Accessoires", desc: "Vends des Accessoires Gluants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#vallhat' },
    { id: 'm67', type: 'marchand', gx: 3241, gy: 1626, name: "Marchand d'Accessoires", desc: "Vends des Accessoires Résistants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-1' },
    { id: 'm68', type: 'marchand', gx: 1750, gy: 4147, name: "Marchand d'Outils",      desc: "Vends des outils pour récolter des matières premières pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#ville-de-depart-1' },
    { id: 'm69', type: 'marchand', gx: 1537, gy: 1958, name: "Marchand d'Outils",      desc: "Vends des outils pour récolter des matières premières pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#virelune' },
    { id: 'm69', type: 'marchand', gx: 1940, gy: 843, name: "Marchand d'Outils",      desc: "Vends des outils pour récolter des matières premières pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-3' },
    { id: 'm70', type: 'marchand', gx: 3230, gy: 1658, name: "Marchand de Consommables",      desc: "Vends des Utilitaires comme des Potions ou des Parchemins", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana-2' },
    { id: 'm65', type: 'marchand', gx: 3240, gy: 1658, name: "Marchand d'Équipement", desc: "Vends des Armes et objets pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#tolbana' },
    { id: 'm68', type: 'marchand', gx: 3257, gy: 1638, name: "Marchand d'Outils",      desc: "Vends des outils pour récolter des matières premières pour les Nouveaux Arrivants", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/marchands#candelia' },

    { id: 'm71', type: 'clef', emoji: '🗝️', gx: 1750, gy: 4170, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#ville-de-depart' },
    { id: 'm72', type: 'clef', emoji: '🗝️', gx: 4210, gy: 3895, name: 'Clef du Donjon Mine de Geldorak',      desc: "Clef permettant d'ouvrir la porte du Donjon des Mines de Geldorak",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#mine-de-geldorak' },
    { id: 'm73', type: 'clef', emoji: '🗝️', gx: 2314, gy: 2435, name: 'Clef du Donjon Labyrinthe des Déchus', desc: "Clef permettant d'ouvrir la porte du Donjon du Labyrinthe des Déchus", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#labyrinthe-des-dechus' },
    { id: 'm74', type: 'clef', emoji: '🗝️', gx: 955,  gy: 1212, name: "Clef du Donjon Xal'Zirith",            desc: "Clef permettant d'ouvrir la porte du Donjon Xal'Zirith",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#xalzirith' },
    { id: 'm75', type: 'clef', emoji: '🗝️', gx: 1936, gy: 835,  name: "Clef du Donjon Xal'Zirith",            desc: "Clef permettant d'ouvrir la porte du Donjon Xal'Zirith",                link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#candelia' },

    { id: 'm76', type: 'clef', emoji: '💍', gx: 4128, gy: 1823, name: "Fabricant Secret de l'Ours",      desc: "Permet la confection Secrète du Bracelet de Glace",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#citadelle-des-neiges' },
    { id: 'm77', type: 'clef', emoji: '💍', gx: 1267, gy: 2140, name: 'Fabricant Secret du Léviathan',   desc: "Permet la confection Secrète de l'Anneau du Léviathan", link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#antre-de-aepep' },
    { id: 'm78', type: 'clef', emoji: '💍', gx: 387,  gy: 3097, name: 'Fabricant Secret des Slimes',     desc: "Permet la confection Secrète de l'Anneau Gluant",       link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#vallhat' },
    { id: 'm79', type: 'clef', emoji: '💍', gx: 1092, gy: 1193, name: "Fabricant Secret des Araignées",  desc: "Permet la confection Secrète du Collier d'Aragorn",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/carte/personnages/fabricants-clefs-et-secret#arakhnol' },

    { id: 'm80', type: 'quête_secondaire', gx: 1819, gy: 4002, name: "Tilda",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/tilda' },
    { id: 'm81', type: 'quête_secondaire', gx: 1817, gy: 3971, name: "Lila",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/lila' },
    { id: 'm82', type: 'quête_secondaire', gx: 2000, gy: 4280, name: "Varn",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/varn' },
    { id: 'm83', type: 'quête_secondaire', gx: 1682, gy: 4720, name: "Orin",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/ori' },
    { id: 'm84', type: 'quête_secondaire', gx: 1682, gy: 4720, name: "Inari",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/inari' },
    { id: 'm85', type: 'quête_secondaire', gx: 1210, gy: 4296, name: "Meiko",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/meiko' },
    { id: 'm86', type: 'quête_secondaire', gx: 1214, gy: 4313, name: "Saria",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/saria' },
    { id: 'm87', type: 'quête_secondaire', gx: 1493, gy: 4306, name: "Rikyu",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/rikyu' },
    { id: 'm88', type: 'quête_secondaire', gx: 1473, gy: 4321, name: "Bunta",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/bunta' },
    { id: 'm89', type: 'quête_secondaire', gx: 1579, gy: 4037, name: "Nacht",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/nacht' },
    { id: 'm90', type: 'quête_secondaire', gx: 2143, gy: 4177, name: "Millia",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/ville-de-depart/millia' },
    { id: 'm91', type: 'quête_secondaire', gx: 1475, gy: 3373, name: "Genzo",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/genzo' },
    { id: 'm92', type: 'quête_secondaire', gx: 1462, gy: 3373, name: "Bartok",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/bartok' },
    { id: 'm93', type: 'quête_secondaire', gx: 1377, gy: 3406, name: "Greta",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/greta' },
    { id: 'm94', type: 'quête_secondaire', gx: 1351, gy: 3433, name: "Soeur Therra",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/soeur-therra' },
    { id: 'm95', type: 'quête_secondaire', gx: 1435, gy: 3532, name: "Rina",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/rina' },
    { id: 'm96', type: 'quête_secondaire', gx: 1446, gy: 3560, name: "Maya",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/maya' },
    { id: 'm97', type: 'quête_secondaire', gx: 1296, gy: 3438, name: "Toban",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/hanaka/toban' },
    { id: 'm98', type: 'quête_secondaire', gx: 3317, gy: 2954, name: "Fira",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/fira' },
    { id: 'm99', type: 'quête_secondaire', gx: 3216, gy: 2913, name: "Corentin",   desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/corentin' },
    { id: 'm100', type: 'quête_secondaire', gx: 3146, gy: 2898, name: "Jean",       desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/camp-militaire/jean' },
    { id: 'm101', type: 'quête_secondaire', gx: 3011, gy: 1918, name: "Horace",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/tolbana/horace' },
    { id: 'm102', type: 'quête_secondaire', gx: 1807, gy: 2127, name: "Haruto",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/haruto' },
    { id: 'm103', type: 'quête_secondaire', gx: 1838, gy: 2019, name: "Sam",        desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/sam' },
    { id: 'm104', type: 'quête_secondaire', gx: 1506, gy: 1980, name: "Juliette",   desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/juliette' },
    { id: 'm105', type: 'quête_secondaire', gx: 1500, gy: 2015, name: "Monique",    desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/monique' },
    { id: 'm106', type: 'quête_secondaire', gx: 1565, gy: 1860, name: "Luc",        desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/virelune/luc' },
    { id: 'm107', type: 'quête_secondaire', gx: 1645, gy: 1042, name: "Gilbert",    desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilbert' },
    { id: 'm108', type: 'quête_secondaire', gx: 1958, gy: 901,  name: "Pierre",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/pierre' },
    { id: 'm109', type: 'quête_secondaire', gx: 1952, gy: 859,  name: "Yannis",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/yannis' },
    { id: 'm110', type: 'quête_secondaire', gx: 1927, gy: 863,  name: "Roméo",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/roméo' },
    { id: 'm111', type: 'quête_secondaire', gx: 1895, gy: 848,  name: "Tomoko",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/tomoko' },
    { id: 'm112', type: 'quête_secondaire', gx: 1891, gy: 814,  name: "Gilmar",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/gilmar' },
    { id: 'm113', type: 'quête_secondaire', gx: 1815, gy: 777,  name: "Émilie",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/candelia/emilie' },
    { id: 'm114', type: 'quête_secondaire', gx: 3077, gy: 3711, name: "Phares",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/phares' },
    { id: 'm115', type: 'quête_secondaire', gx: 3060, gy: 3692, name: "Louise",     desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/louise' },
    { id: 'm116', type: 'quête_secondaire', gx: 3038, gy: 3699, name: "Elwyn",      desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/elwyn' },
    { id: 'm117', type: 'quête_secondaire', gx: 3050, gy: 3661, name: "Michelle",   desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/michelle' },
    { id: 'm118', type: 'quête_secondaire', gx: 3069, gy: 3668, name: "Martine",    desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/mizunari/martine' },
    { id: 'm119', type: 'quête_secondaire', gx: 455,  gy: 3066, name: "Par les Branches des Anciens", desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/par-les-branches-des-anciens' },
    { id: 'm120', type: 'quête_secondaire', gx: 442,  gy: 3029, name: "Saya", desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/saya' },
    { id: 'm121', type: 'quête_secondaire', gx: 416,  gy: 3008, name: "Ayaka", desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/ayaka' },
    { id: 'm122', type: 'quête_secondaire', gx: 382,  gy: 3046, name: "Daiki", desc: "",     link: 'https://guilde-sao.gitbook.io/watchers/paliers/quetes/quetes-secondaires/vallhat/daiki' },
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
    centerPixel: { x: 450,    y: 450  },
    centerGame:  { x: 0, y: 0 },
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

let isPanning     = false;
let panLastX      = 0;
let panLastY      = 0;
let panOffset     = { x: 0, y: 0 };
let _searchFocusId = null; // id du marqueur isolé par la recherche, null = aucun

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
let _vpLeft = 0;
let _vpTop  = 0;
let _vpW    = 0;
let _vpH    = 0;

function updateVpBounds() {
  const r  = mapViewport.getBoundingClientRect();
  _vpLeft = Math.round(r.left);
  _vpTop  = Math.round(r.top);
  _vpW    = Math.round(r.width);
  _vpH    = Math.round(r.height);
}

function clientToVp(cx, cy) {
  return { x: cx - _vpLeft, y: cy - _vpTop };
}

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
  return {
    x: cx + (imgX - MAP_SIZE / 2) * zoomLevel,
    y: cy + (imgY - MAP_SIZE / 2) * zoomLevel,
  };
}

function screenToImage(sx, sy) {
  const cx = _vpW / 2 + panOffset.x;
  const cy = _vpH / 2 + panOffset.y;
  return {
    x: (sx - cx) / zoomLevel + MAP_SIZE / 2,
    y: (sy - cy) / zoomLevel + MAP_SIZE / 2,
  };
}

/* ══════════════════════════════════
   MOLETTE ÉTAGES
══════════════════════════════════ */
function buildWheel() {
  wheelTrack.innerHTML = '';
  for (let i = 1; i <= FLOOR_COUNT; i++) {
    const el = document.createElement('div');
    el.className = 'wheel-num' + (i === currentFloor ? ' wheel-active' : '');
    el.textContent = String(i).padStart(2, '0');
    el.dataset.floor = i;
    el.addEventListener('click', () => goToFloor(i));
    wheelTrack.appendChild(el);
  }
  scrollWheelTo(currentFloor);

  const coordDisplay = document.createElement('div');
  coordDisplay.id = 'coord-display';
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
        group.push(other);
        used.add(j);
      }
    });
    clusters.push(group);
  });

  return clusters;
}

/* ══════════════════════════════════
   RENDU MARQUEURS
══════════════════════════════════ */
function renderMarkers() {
  markersLayer.innerHTML = '';
  document.querySelectorAll('.cluster-expanded').forEach(n => n.remove());

  const markers = FLOOR_MARKERS[currentFloor] || [];

  // Marker ciblé par la recherche — traité séparément pour bypasser les filtres
  const focused = _searchFocusId ? markers.find(m => m.id === _searchFocusId) : null;

  const visible = markers.filter(m => {
    if (m.id === _searchFocusId) return false; // rendu à part ci-dessous
    const cb = document.querySelector(`.marker-filter[data-type="${m.type}"]`);
    return !cb || cb.checked;
  });

  // Rendu des markers normaux
  clusterMarkers(visible).forEach(group => {
    if (group.length === 1) renderSingleMarker(group[0]);
    else                    renderCluster(group);
  });

  // Si un focus est actif, grise tout ce qui vient d'être rendu
  if (_searchFocusId) {
    markersLayer.querySelectorAll('.marker').forEach(el => el.classList.add('marker-dimmed'));
  }

  // Rendu du marker ciblé par-dessus, toujours visible
  if (focused) {
    const img = gameToPixel(focused.gx, focused.gy);
    const s   = imageToScreen(img.x, img.y);
    renderSingleMarker({ ...focused, sx: s.x, sy: s.y });
    // Le dernier marker ajouté est le focused — on retire le dimmed s'il a été ajouté
    const el = markersLayer.querySelector(`.marker[data-id="${focused.id}"]`);
    if (el) el.classList.remove('marker-dimmed');
  }
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
    left.className  = 'split-left';
    left.style.background = m.colorLeft;
    left.textContent = m.emojiLeft || '';
    const right = document.createElement('div');
    right.className = 'split-right';
    right.style.background = m.colorRight;
    right.textContent = m.emojiRight || '';
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

    markersLayer.querySelectorAll('.marker').forEach(m => {
      if (m !== el) m.classList.add('marker-dimmed');
    });

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
    tooltipLink.href = marker.link;
    tooltipLink.target = '_blank';
    tooltipLink.rel = 'noopener noreferrer';
    tooltipLink.classList.remove('hidden');
  } else {
    tooltipLink.classList.add('hidden');
  }
  tooltip.classList.remove('hidden');
}

function hideTooltip() {
  if (_pinnedTooltip) return;
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
  mapCanvas.style.transform =
    `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoomLevel})`;
  zoomLevelEl.textContent = Math.round(zoomLevel * 100) + '%';
  renderMarkers();
}

function zoomFromPoint(vpX, vpY, factor) {
  const oldZoom = zoomLevel;
  zoomLevel     = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * factor));
  const ratio   = zoomLevel / oldZoom;
  const cx      = _vpW / 2 + panOffset.x;
  const cy      = _vpH / 2 + panOffset.y;
  panOffset.x  -= (vpX - cx) * (ratio - 1);
  panOffset.y  -= (vpY - cy) * (ratio - 1);
  applyTransform();
}

document.getElementById('zoom-in').addEventListener('click', () => {
  zoomFromPoint(_vpW / 2, _vpH / 2, ZOOM_FACTOR);
});
document.getElementById('zoom-out').addEventListener('click', () => {
  zoomFromPoint(_vpW / 2, _vpH / 2, 1 / ZOOM_FACTOR);
});
document.getElementById('zoom-reset').addEventListener('click', () => {
  zoomLevel = 1; panOffset = { x: 0, y: 0 }; applyTransform();
});

mapViewport.addEventListener('wheel', (e) => {
  e.preventDefault();
  const vp = clientToVp(e.clientX, e.clientY);
  zoomFromPoint(vp.x, vp.y, e.deltaY > 0 ? 1 / ZOOM_FACTOR : ZOOM_FACTOR);
}, { passive: false });

mapViewport.addEventListener('mousedown', (e) => {
  if (e.target.closest('.marker')) return;
  isPanning = true;
  panLastX  = e.clientX;
  panLastY  = e.clientY;
  mapViewport.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', (e) => {
  if (!isPanning) return;
  panOffset.x += e.clientX - panLastX;
  panOffset.y += e.clientY - panLastY;
  panLastX = e.clientX;
  panLastY = e.clientY;
  applyTransform();
});
window.addEventListener('mouseup', () => { isPanning = false; mapViewport.style.cursor = 'grab'; });

mapViewport.addEventListener('touchstart', (e) => {
  const t  = e.touches[0];
  isPanning = true;
  panLastX  = t.clientX;
  panLastY  = t.clientY;
}, { passive: true });
mapViewport.addEventListener('touchmove', (e) => {
  if (!isPanning) return;
  const t = e.touches[0];
  panOffset.x += t.clientX - panLastX;
  panOffset.y += t.clientY - panLastY;
  panLastX = t.clientX;
  panLastY = t.clientY;
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

let wheelDragging            = false;
let wheelDragStartY          = 0;
let wheelDragFloor           = 1;
const WHEEL_DRAG_SENSITIVITY = 18;
const wheelDisplay           = document.querySelector('.wheel-display');

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

        // Centre la vue sur le marker
        const img = gameToPixel(m.gx, m.gy);
        panOffset.x = -((img.x - MAP_SIZE / 2) * zoomLevel);
        panOffset.y = -((img.y - MAP_SIZE / 2) * zoomLevel);

        // Active le focus puis re-render (applyTransform appelle renderMarkers)
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

// Clic sur la carte = annule le focus recherche
mapViewport.addEventListener('click', (e) => {
  if (!e.target.closest('.marker') && !e.target.closest('.map-searchbar')) {
    _searchFocusId = null;
    renderMarkers();
  }
});

// Ferme les résultats si clic en dehors
document.addEventListener('click', (e) => {
  if (!e.target.closest('.map-searchbar')) searchResults.classList.add('hidden');
});

// Échap : ferme et annule le focus
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
requestAnimationFrame(() => {
  updateVpBounds();
  renderMarkers();
});
buildWheel();
goToFloor(1);
