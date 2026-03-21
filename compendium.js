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
  {
    id:       'dague_dentrainement',
    name:     "Dague d'Entrainement",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Forgée pour ceux qui n'ont encore rien prouvé.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Obtenable dans le tutoriel"
  },
  {
    id:       'épée_dentrainement',
    name:     "Épée d'Entrainement",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Petite épée un peu rouillée parfaite pour s'entraîner ou pour démarrer son aventure.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'bouclier_de_pacotille',
    name:     "Bouclier de Pacotille",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un vieux bouclier. Il bloque encore à peu près.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'dague_délabrée',
    name:     "Épée d'Entrainement",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Dague bien délabrée, même un coup sur du bois et l'épée peut être détruite.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'arc_courbé',
    name:     "Arc Courbé",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un arc rudimentaire utilisé par les premiers tireurs.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'bâton_médiocre',
    name:     "Bâton Médiocre",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un bâton d'apprentissage magique inoffensif, mais porteur d'énergie.",
    tags:     ['Arme', 'Bâton', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'grimoire_délié',
    name:     "Grimoire Délié",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un livre incomplet débordant de magie.",
    tags:     ['Arme', 'Catalyseur', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'grimoire_sauvage',
    name:     "Grimoire Sauvage",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un livre incomplet débordant de magie.",
    tags:     ['Arme', 'Catalyseur', 'Palier 1', 'Commun'],
    obtain:   "Obtenable par les Marchands d'Équipement"
  },
  {
    id:       'épée_en_fer',
    name:     "Épée en Fer",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Épée en fer créée grâce aux loups de la vallée et avec un autre ingrédient.",
    tags:     ['Arme', 'Épée', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'bouclier_dika',
    name:     "Bouclier d'Ika",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Forgé dans la carapace des tortues d'Ika. Idéal pour encaisser sans broncher.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'bouclier_pointu_en_bois',
    name:     "Bouclier Pointu en Bois",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Ce bouclier fait de bois possède une pointe en son centre. Il peut encaisser quelques coups aussi.",
    tags:     ['Arme', 'Bouclier', 'Rondache', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'dague_intermediaire',
    name:     "Dague Intermédiaire",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Standard des nouvelles recrues. Facile à manier, légère et très fiable.",
    tags:     ['Arme', 'Dague', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'hache_double_en_fer',
    name:     "Hache Double en Fer",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Double hache en fer créée grâce aux loups de la vallée et avec un autre ingrédient.",
    tags:     ['Arme', 'Hache', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'viande_de_sanglier',
    name:     "Viande de Sanglier",
    rarity:   'commun',
    category: 'nourriture',
    palier:   1,
    image:    null,
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
    image:    null,
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
    image:    null,
    lore:     "Des traces de corruptions émanent de cet objet.",
    tags:     ['Quête', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Sangliers Corrompus\n- Pumba"
  },
  {
    id:       'anneau_de_pumba',
    name:     "Anneau de Pumba",
    rarity:   'legendaire',
    category: 'accessoire',
    palier:   1,
    image:    null,
    lore:     "Taillé dans un métal épais et marqué par une rayure rouge, cet anneau est inspiré du célèbre sanglier massif.",
    tags:     ['Accessoire', 'Anneau', 'Palier 1', 'Légendaire'],
    obtain:   "Obtenable en tuant:\n- Pumba"
  },
  {
    id:       'fourrure_de_loup',
    name:     "Fourrure de Loup",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    id:       'bouclier_sylvestre',
    name:     "Bouclier Sylvestre",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Grand bouclier en bois qui peut seulement être obtenu par un Guerrier Tréant.",
    tags:     ['Arme', 'Bouclier', 'Pavois', 'Palier 1', 'Rare'],
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
    image:    null,
    lore:     "Longue et tendue, cette corde robuste est idéale pour confectionner un nouvel arc.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Tréants d'Élites"
  },
  {
    id:       'arc_sylvestre',
    name:     "Arc Sylvestre",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Arc construitavec l'aidees Tréants du Palier 1 de l'Aincrad.",
    tags:     ['Arme', 'Arc', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Tréants d'Élites\nFabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'brindille_enchantée',
    name:     "Brindille Enchantée",
    rarity:   'commun',
    category: 'materiaux',
    palier:   1,
    image:    null,
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
    image:    null,
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
    image:    null,
    lore:     "Un tissu imprégné de magie noire et de malédictions.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Mages Sylvestres"
  },
  {
    id:       'bâton_sylvestre',
    name:     "Bâton Sylvestre",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un livre forgé par des matériaux venant d'un marécage putride et ancien. Il renferme une magie élémentaire.",
    tags:     ['Arme', 'Catalyseur', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'grimoire_sylvestre',
    name:     "Grimoire Sylvestre",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un livre forgé par des matériaux venant d'un marécage putride et ancien. Il renferme une magie élémentaire.",
    tags:     ['Arme', 'Catalyseur', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'grimoire_bestial',
    name:     "Grimoire Bestial",
    rarity:   'commun',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Un livre forgé par des matériaux venant d'un marécage putride et ancien. Il renferme une magie bestiale.",
    tags:     ['Arme', 'Catalyseur', 'Palier 1', 'Commun'],
    obtain:   "Fabricable au Forgeron d'Armes de la Ville de Départ"
  },
  {
    id:       'mycelium_magique',
    name:     "Mycélium Magique",
    rarity:   'rare',
    category: 'materiaux',
    palier:   1,
    image:    null,
    lore:     "Ingrédient assez rare pour de la haute alchimie ou pour autre chose ?",
    tags:     ['Matériaux', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Gardiens Colossaux"
  },
  {
    id:       'marteau_du_colosse',
    name:     "Marteau du Colosse",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Arme de destruction du Gardien Colossal. Ce marteau est puissant mais lourd.",
    tags:     ['Arme', 'Marteau', 'Palier 1', 'Rare'],
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
    image:    null,
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
    image:    null,
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
    image:    null,
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
    image:    null,
    lore:     "Âme de squelette abreuvé de corruption.",
    tags:     ['Matériaux', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes\n- Squelettes Hallebardiers\n- Archers Squelettes"
  },
  {
    id:       'épée_osseuse',
    name:     "Épée Osseuse",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Taillé dans les os d'un ancien guerrier tombé en disgrâce.",
    tags:     ['Armes', 'Épée', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes"
  },
  {
    id:       'tissu_maudit',
    name:     "Tissu Maudit",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    null,
    lore:     "Les forces obscures devorent ce tissu.",
    tags:     ['Quête', 'Palier 1', 'commun'],
    obtain:   "Obtenable en tuant:\n- Squelettes Épéiste\n- Guerriers Squelettes"
  },
  {
    id:       'bâton_de_squelette',
    name:     "Bâton de Squelette",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Bâton ancien des ruines maudites, encore vivant de la flamme des morts.",
    tags:     ['Armes', 'Bâton', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Squelettes Mages"
  },
  {
    id:       'coeur_putréfié',
    name:     "Cœur Putréfié",
    rarity:   'commun',
    category: 'quete',
    palier:   1,
    image:    null,
    lore:     "La putréfaction ronge peu à peu ce cœur.",
    tags:     ['Quête', 'Palier 1', 'Commun'],
    obtain:   "Obtenable en tuant:\n- Narax Squelette Maudit"
  },
  {
    id:       'bâton_de_squelette_maudit',
    name:     "Bâton de Squelette Maudit",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Bâton encore imprégné de sa magie après la mort de son propriétaire.",
    tags:     ['Armes', 'Bâton', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Narax Squelette Maudit"
  },
  {
    id:       'morceau_de_crinière_spectrale',
    name:     "Morceau de Crinière Spectrale",
    rarity:   'legendaire',
    category: 'materiaux',
    palier:   1,
    image:    null,
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
    image:    null,
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
    image:    null,
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
    id:       'arbalète_de_bandit',
    name:     "Arbalète de Bandit",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Arbalète d'un bandit qui devient presque inutilisable après tous ces combats.",
    tags:     ['Armes', 'Arbalète', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Bandits Archer"
  },
  {
    id:       'dague_de_bandit',
    name:     "Dague de Bandit",
    rarity:   'rare',
    category: 'arme',
    palier:   1,
    image:    null,
    lore:     "Dague émoussé d'un bandit après tous ces combats sanglants.",
    tags:     ['Armes', 'Dague', 'Palier 1', 'Rare'],
    obtain:   "Obtenable en tuant:\n- Bandits Assassins"
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

];

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const sidebarTree   = document.getElementById('sidebar-tree');
const searchInput   = document.getElementById('sidebar-search');
const placeholder   = document.getElementById('glossary-placeholder');
const itemDisplay   = document.getElementById('item-display');
const sortPalierBtn = document.getElementById('sort-palier');
const sortAlphaBtn  = document.getElementById('sort-alpha');
 
/* ══════════════════════════════════
   ÉTAT TRI
══════════════════════════════════ */
let currentSort = 'palier'; // 'palier' | 'alpha'
 
sortPalierBtn.addEventListener('click', () => {
  currentSort = 'palier';
  sortPalierBtn.classList.add('active');
  sortAlphaBtn.classList.remove('active');
  buildSidebar(currentItems());
});
 
sortAlphaBtn.addEventListener('click', () => {
  currentSort = 'alpha';
  sortAlphaBtn.classList.add('active');
  sortPalierBtn.classList.remove('active');
  buildSidebar(currentItems());
});
 
/* Renvoie la liste filtrée/triée selon l'état courant */
function currentItems() {
  const q = searchInput.value.trim();
  const norm = normalize(q);
  const filtered = q.length >= 1
    ? ITEMS.filter(item =>
        normalize(item.name).includes(norm) ||
        normalize(item.lore || '').includes(norm) ||
        normalize(catData(item.category).label).includes(norm) ||
        (item.tags || []).some(t => normalize(t).includes(norm))
      )
    : [...ITEMS];
  return filtered;
}
 
/* Construit une sidebar à plat A→Z (sans paliers/catégories) */
function buildSidebarAlpha(items) {
  sidebarTree.innerHTML = '';
  const sorted = [...items].sort((a, b) =>
    normalize(a.name).localeCompare(normalize(b.name))
  );
 
  if (sorted.length === 0) {
    sidebarTree.innerHTML = '<div class="sidebar-empty">Aucun résultat</div>';
    return;
  }
 
  sorted.forEach(item => {
    const link = document.createElement('a');
    link.className  = 'sidebar-item sidebar-item-flat';
    link.href       = `#${item.id}`;
    link.dataset.id = item.id;
    const color = rarityColor(item.rarity);
    link.innerHTML = `
      <span class="sidebar-item-dot" style="background:${color}"></span>
      ${item.name}`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showItem(item.id);
      history.pushState({ item: item.id }, '', `#${item.id}`);
    });
    sidebarTree.appendChild(link);
  });
 
  /* Remettre l'item actif */
  const activeId = window.location.hash.replace('#', '');
  if (activeId) {
    sidebarTree.querySelector(`.sidebar-item[data-id="${activeId}"]`)?.classList.add('active');
  }
}
 
/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function normalize(str) {
  return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
 
function rarityColor(rarityKey) {
  return (RARITIES[rarityKey] || { color: '#666' }).color;
}
 
function rarityLabel(rarityKey) {
  return (RARITIES[rarityKey] || { label: rarityKey }).label;
}
 
function catData(categoryKey) {
  return CATEGORIES[categoryKey] || { label: categoryKey, emoji: '📦' };
}
 
/*
  parseText — mini convertisseur pour les champs lore et obtain.
  Supporte :
    - Sauts de ligne (\n) → <br> ou liste si c'est des tirets
    - Lignes commençant par - ou * → <ul><li>…</li></ul>
    - **gras** → <strong>
*/
function parseText(str) {
  if (!str) return '';
 
  const lines = str.split('\n');
  let html    = '';
  let inList  = false;
 
  lines.forEach(raw => {
    const line = raw.trim();
 
    if (line.match(/^[-*]\s+/)) {
      // Ligne de liste
      if (!inList) { html += '<ul class="item-list">'; inList = true; }
      html += `<li>${inlineMd(line.replace(/^[-*]\s+/, ''))}</li>`;
    } else {
      if (inList) { html += '</ul>'; inList = false; }
      if (line === '') {
        html += '<br>';
      } else {
        html += `<span>${inlineMd(line)}</span><br>`;
      }
    }
  });
 
  if (inList) html += '</ul>';
 
  // Nettoyer les <br> superflus en fin
  html = html.replace(/(<br>)+$/, '');
 
  return html;
}
 
/* Gère le **gras** inline */
function inlineMd(str) {
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
 
/* Regroupe les items par palier puis par catégorie */
function groupItems(items) {
  const grouped = {};
  items.forEach(item => {
    const p = item.palier || 1;
    if (!grouped[p]) grouped[p] = {};
    if (!grouped[p][item.category]) grouped[p][item.category] = [];
    grouped[p][item.category].push(item);
  });
  return grouped;
}
 
/* ══════════════════════════════════
   CONSTRUCTION SIDEBAR
══════════════════════════════════ */
function buildSidebar(items, expandAll = false) {
  if (currentSort === 'alpha') { buildSidebarAlpha(items); return; }
  sidebarTree.innerHTML = '';
  const grouped = groupItems(items);
 
  Object.keys(grouped)
    .sort((a, b) => a - b)
    .forEach(palier => {
 
      /* ── Bloc Palier ── */
      const palierBlock = document.createElement('div');
      palierBlock.className = 'palier-block';
 
      const ph = document.createElement('div');
      ph.className = 'palier-header' + (expandAll ? ' open' : '');
      ph.innerHTML = `<span class="palier-label">⬡ Palier ${palier}</span><span class="palier-arrow">▶</span>`;
 
      const pb = document.createElement('div');
      pb.className = 'palier-body' + (expandAll ? ' open' : '');
 
      ph.addEventListener('click', () => {
        ph.classList.toggle('open');
        pb.classList.toggle('open');
      });
 
      /* ── Blocs Catégorie ── */
      Object.keys(grouped[palier]).forEach(cat => {
        const catItems  = grouped[palier][cat];
        const cat_data  = catData(cat);
 
        const cb = document.createElement('div');
        cb.className = 'categorie-block';
 
        const ch = document.createElement('div');
        ch.className = 'categorie-header' + (expandAll ? ' open' : '');
        ch.innerHTML = `
          <span class="categorie-label">
            <span class="categorie-emoji">${cat_data.emoji}</span>
            ${cat_data.label}
            <span class="categorie-count">${catItems.length}</span>
          </span>
          <span class="categorie-arrow">▶</span>`;
 
        const cbody = document.createElement('div');
        cbody.className = 'categorie-body' + (expandAll ? ' open' : '');
 
        ch.addEventListener('click', () => {
          ch.classList.toggle('open');
          cbody.classList.toggle('open');
        });
 
        /* ── Items ── */
        catItems.forEach(item => {
          const link = document.createElement('a');
          link.className  = 'sidebar-item';
          link.href       = `#${item.id}`;
          link.dataset.id = item.id;
 
          const color = rarityColor(item.rarity);
          link.innerHTML = `
            <span class="sidebar-item-dot" style="background:${color}"></span>
            ${item.name}`;
 
          link.addEventListener('click', (e) => {
            e.preventDefault();
            showItem(item.id);
            history.pushState({ item: item.id }, '', `#${item.id}`);
          });
 
          cbody.appendChild(link);
        });
 
        cb.appendChild(ch);
        cb.appendChild(cbody);
        pb.appendChild(cb);
      });
 
      palierBlock.appendChild(ph);
      palierBlock.appendChild(pb);
      sidebarTree.appendChild(palierBlock);
    });
}
 
/* ══════════════════════════════════
   AFFICHAGE FICHE ITEM
══════════════════════════════════ */
function showItem(id) {
  const item = ITEMS.find(i => i.id === id);
  if (!item) return;
 
  /* Masquer le placeholder */
  placeholder.style.display = 'none';
 
  /* Marquer actif dans la sidebar */
  document.querySelectorAll('.sidebar-item').forEach(el => {
    el.classList.toggle('active', el.dataset.id === id);
  });
 
  const color   = rarityColor(item.rarity);
  const rlabel  = rarityLabel(item.rarity);
  const cdata   = catData(item.category);
 
  itemDisplay.innerHTML = `
    <div class="item-sheet">
 
      <div class="item-header">
 
        <!-- Image -->
        <div class="item-image-wrap" style="color:${color}; border-color:${color};">
          <div class="item-image-bg" style="background:${color};"></div>
          <div class="item-image-border" style="border-color:${color};"></div>
          <div class="item-image-inner">
            ${item.image
              ? `<img src="${item.image}" alt="${item.name}" />`
              : `<span class="item-image-placeholder">${cdata.emoji}</span>`
            }
          </div>
        </div>
 
        <!-- Infos -->
        <div class="item-info">
          <h2 class="item-name">${item.name}</h2>
 
          <div class="item-rarity-badge" style="color:${color}; border-color:${color};">
            <span class="item-rarity-dot" style="background:${color};"></span>
            ${rlabel}
          </div>
 
          <blockquote class="item-lore">${parseText(item.lore)}</blockquote>
        </div>
 
      </div><!-- /.item-header -->
 
      <div class="item-sep"></div>
 
      <div class="item-tags">
        ${(item.tags || []).map(t => `<span class="item-tag">${t}</span>`).join('')}
      </div>
 
      <div class="item-sep"></div>
 
      <div class="item-section-title">Comment obtenir cet item</div>
      <div class="item-obtain">${parseText(item.obtain)}</div>
 
    </div>`;
}
 
/* ══════════════════════════════════
   RECHERCHE
══════════════════════════════════ */
searchInput.addEventListener('input', () => {
  const expandAll = currentSort === 'palier';
  buildSidebar(currentItems(), expandAll);
});
 
/* ══════════════════════════════════
   NAVIGATION PAR HASH
══════════════════════════════════ */
window.addEventListener('popstate', () => {
  const id = window.location.hash.replace('#', '');
  if (id) showItem(id);
  else {
    placeholder.style.display = '';
    itemDisplay.innerHTML = '';
    document.querySelectorAll('.sidebar-item').forEach(el => el.classList.remove('active'));
  }
});
 
/* ══════════════════════════════════
   INIT
══════════════════════════════════ */
buildSidebar(ITEMS);
 
/* Si un hash est déjà dans l'URL, ouvrir l'accordéon correspondant et afficher l'item */
const initId = window.location.hash.replace('#', '');
if (initId) {
  const target = ITEMS.find(i => i.id === initId);
  if (target) {
    /* Ouvrir le bon palier + catégorie */
    buildSidebar(ITEMS);
    requestAnimationFrame(() => {
      const link = sidebarTree.querySelector(`.sidebar-item[data-id="${initId}"]`);
      if (link) {
        link.closest('.palier-body')?.classList.add('open');
        link.closest('.palier-body')?.previousElementSibling?.classList.add('open');
        link.closest('.categorie-body')?.classList.add('open');
        link.closest('.categorie-body')?.previousElementSibling?.classList.add('open');
      }
      showItem(initId);
    });
  }
}
