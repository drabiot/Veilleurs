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
    img: '../img/mobs/P1/sanglier_corrompu.png',
    lore: "Une bête sauvage issue des forêts du premier palier. Il charge sans relâche, animé d'une rage primitive.",
    attacks: [
      { name: 'Charge du Sanglier',   desc: 'Fonce sur la cible et les pousse.', dmg: '?' },
    ],
    loot: [
      { id: 'viande_de_sanglier', chance: 100, qty:'1-3'  },
      { id: 'peau_de_sanglier', chance: 60 },
      { id: 'cristal_corrompu', chance: 50 },
    ],
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
    img: '../img/mobs/P1/sanglier_corrompu.png',
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
		spawnTime: '1m 30s'
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
    img: '../img/mobs/P1/loup_sinistre_blanc.png',
    lore: "Gardiens de la Vallée des Loups. Leurs hurlements glacent le sang et donnent des frissons.",
    attacks: [
      { name: 'Saut Lupin',   desc: 'Saute sur sa cible pour la mordre violemment.', dmg: '?' },
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 60 },
      { id: 'crocs_de_loup', chance: 30 },
    ],
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
    img: '../img/mobs/P1/loup_sinistre_noir.png',
    lore: "Gardiens de la Vallée des Loups. Leurs hurlements glacent le sang et donnent des frissons.",
    attacks: [
      { name: 'Saut Lupin',   desc: 'Saute sur sa cible pour la mordre violemment.', dmg: '?' },
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 60 },
      { id: 'crocs_de_loup', chance: 30 },
    ],
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
    img: '../img/mobs/P1/albal.png',
    spawnTime: null,
    lore: "Un loup solitaire aux yeux d'argent glacés. Son passage laisse une brume et le silence.",
    attacks: [
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 100 },
      { id: 'crocs_de_loup', chance: 70 },
	  { id: 'crocs_de_albal', chance: 20 },
    ],
		spawnTime: '4m'
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
    img: '../img/mobs/P1/mini_treant.png',
    lore: "Petit gardien de la forêt, il défend les lieux sacrés avec hargne. Sous ses racines courtes dort une volonté de fer.",
    attacks: [
      { name: 'Morsure Tréante',   desc: 'Mord violemment sa cible avec ses écorces.', dmg: '?' },
    ],
    loot: [
      { id: 'pousse_de_sylve', chance: 40 },
      { id: 'eclat_de_bois_magique', chance: 30 },
    ],
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
    img: '../img/mobs/P1/guerrier_treant.png',
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
    img: '../img/mobs/P1/treant_elite.png',
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
    img: '../img/mobs/P1/gardien_colossal.png',
    lore: "Forgé dans la pierre et éveillé par la magie ancienne, il garde les terres oubliées contre toute intrusion. Ses pas seuls font trembler la forêt...",
    attacks: [
      { name: 'Ruée de la Forêt',   desc: 'Fonce sur sa cible de toute ses forces.', dmg: '?' },
    ],
    loot: [
      { id: 'mycelium_magique', chance: 20 },
      { id: 'marteau_colosse' },
    ],
		spawnTime: '3m'
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
    img: '../img/mobs/P1/petit_slime.png',
    lore: "Malgré sa petite taille, il bondit sans peur. Inoffensif en apparence, mais têtu comme pas deux. Certains disent qu'il garde un secret au cœur mou.",
    attacks: [
      { name: 'Bond Gluant',   desc: 'Bondit sur sa cible pour lui infliger des dégâts.', dmg: '?' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
    ],
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
    img: '../img/mobs/P1/guerrier_slime.png',
    lore: "Né d'un amas magique de gelée ancienne, il a appris à manier l'arme comme un vrai guerrier. Il défend son territoire avec une rage inattendue.",
    attacks: [
      { name: 'Bond Tranchant',   desc: 'Bondit sur sa cible pour lui infliger des dégâts avec son épée tranchante.', dmg: '?' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
    ],
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
    img: '../img/mobs/P1/slime_soigneur.png',
    lore: "Ce slime irradie une énergie apaisante. Blessures mineures se referment à son passage. Il fuit le combat, mais sauve les siens dans l'ombre.",
    attacks: [
      { name: 'Soint Gluant',   desc: 'Génère une zone de soin qui soigne les Slimes en zone.' },
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
	  { id: 'noyau_de_slime', chance: 5 },
    ],
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
    img: '../img/mobs/P1/slime_magicien.png',
    lore: "Un slime imprégné d'énergies arcaniques anciennes. Ses attaques lancent des sorts chaotiques et imprévisibles.",
    attacks: [
    ],
    loot: [
      { id: 'gelee_de_slime', chance: 30 },
	  { id: 'noyau_de_slime', chance: 5 },
    ],
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
    img: '../img/mobs/P1/gorbel.png',
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
		spawnTime: '10m'
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
    img: '../img/mobs/P1/bandit_assassin.png',
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
      position: [0, 0, 0],     // offset X Y Z par rapport à l'origine
      rotation: [0, 0, 0],     // rotation en radians sur X Y Z
      scale: 1                  // échelle globale du morceau
    },
    {
      fichier: '../img/compendium/modelengine/models/em_bandit_a1/hip.json',
      position: [0, 0, 0],     // offset X Y Z par rapport à l'origine
      rotation: [0, 0, 0],     // rotation en radians sur X Y Z
      scale: 1                  // échelle globale du morceau
    },
  ],
  camera: {
    distance: 4,   // distance de la caméra (plus grand = plus loin)
    hauteur: 0.5   // hauteur du point de regard (0 = centre, + = plus haut)
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
    behavior: 'agressif',
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
  },
	{
    id: 'loup_savanes',
    name: 'Loup des Savanes',
    type: 'monstre',
    behavior: 'agressif',
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
    lore: ".",
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
    lore: ".",
    attacks: [
    ],
    loot: [
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
    lore: ".",
    attacks: [
    ],
    loot: [
    ],
  },
	//#endregion Palier 2
];

/* ══════════════════════════════════
   DONNÉES — PERSONNAGES
══════════════════════════════════ */

const PERSONNAGES = [
  //#region Ville de Départ
  {
    id: 'repreneur_butin_vdp',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1b1',
    img: '../img/compendium/montages/butin_vdp.png',
    lore: "Reprends des ingrédient basique trouvable aux abbords de la Ville de Départ, ainsi que des bourses d'argent.",
    sells: [
      { id: 'viande_de_sanglier',  price: 0.1 },
      { id: 'peau_de_sanglier', price: 2.5 },
	  	{ id: 'cristal_corrompu', price: 1.5 },
	  	{ id: 'fourrure_de_loup', price: 3 },
	  	{ id: 'crocs_de_loup', price: 4 },
	  	{ id: 'petite_bourse', price: 5 },
    ],
  },
  {
    id: 'repreneur_equipement_vdp',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1m1',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
  },
  {
    id: 'marchand_etrange_vdp',
    name: "Marchand Étrange",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a4',
    img: '../img/compendium/textures/trinkets/P1/Manteau Volé.png',
    lore: "Échange un étrange manteau contre quelques petites bourses.",
    craft: [
			{ 
				id: 'manteau_vole', time: '10m',
				ingredients: [
					{ id: 'petite_bourse', qty: 128 },
				]
			}
		]
  },
	{
    id: 'marchand_outils_vdp',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1m5',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
    ],
  },
	{
    id: 'alchimiste_vdp',
    name: "Alchimiste",
    tag: 'alchimiste',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a14',
    img: '../img/compendium/textures/items/Consommable/strengthpot_3.png',
    lore: "Concocte des Potions et des Cristaux.",
    craft: [
      { id: 'potion_vie_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_vie_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_vie_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_soin', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_mana_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_mana_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_mana_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_mana', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_stamina_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_stamina_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_stamina_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_stamina', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'cristal_puissance', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
    ],
  },
	{
    id: 'bucheron_vdp',
    name: "Bucheron",
    tag: 'bucheron',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a13',
    img: '../img/compendium/textures/items/Ressources/planche_chene.png',
    lore: "Réalise des Planches de Bois et de la Poudre de Bois.",
    craft: [
      { id: 'planche_chene', time: '15s',
				ingredients: [
					{ id: 'chene', qty: 2 },
				]
			},
			{ id: 'planche_bouleau', time: '15s',
				ingredients: [
					{ id: 'bouleau', qty: 2 },
				]
			},
			{ id: 'planche_acacia', time: '15s',
				ingredients: [
					{ id: 'acacia', qty: 2 },
				]
			},
			{ id: 'planche_sapin', time: '15s',
				ingredients: [
					{ id: 'sapin', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_chene', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_bouleau', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_acacia', qty: 2 },
				]
			},
			{ id: 'poudre_bois', time: '15s',
				ingredients: [
					{ id: 'planche_sapin', qty: 2 },
				]
			},
		]
  },
	{
    id: 'refaconneur_vdp',
    name: "Refaçonneur",
    tag: 'refaconneur',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a7',
    img: '../img/compendium/montages/refaconneur_vdp.png',
    lore: "Transforme des Ressources et des Fils d'Araignées pour réaliser des ficelles utile dans la confection d'Accessoires.",
    craft: [
			{ 
				id: 'ficelle_chene', time: '1m',
				ingredients: [
					{ id: 'chene', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_bouleau', time: '1m',
				ingredients: [
					{ id: 'bouleau', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			},
			{ 
				id: 'ficelle_cuivre', time: '1m',
				ingredients: [
					{ id: 'cuivre', qty: 4 },
					{ id: 'fil_araignee', qty: 4 },
				]
			}
		]
  },
	{
    id: 'forgeron_armes_vdp',
    name: "Forgeron d'Armes",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a1',
    img: '../img/compendium/montages/armes_vdp.png',
    lore: "Permet le fabrication d'armes rudimentaires pour les novices.",
    craft: [
			{ 
				id: 'epee_fer', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 5 },
					{ id: 'lingot_cuivre', qty: 10 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'bouclier_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 12 },
					{ id: 'ecorce_de_titan', qty: 7 },
				]
			},
			{ 
				id: 'hache_double_fer', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 5 },
					{ id: 'lingot_cuivre', qty: 10 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'bouclier_pointu_bois', time: '10s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 8 },
					{ id: 'ecorce_de_titan', qty: 7 },
				]
			},
			{ 
				id: 'arc_sylvestre', time: '10s',
				ingredients: [
					{ id: 'corde_darc_sylvestre', qty: 12 },
					{ id: 'chene', qty: 8 },
				]
			},
			{ 
				id: 'dague_intermediaire', time: '10s',
				ingredients: [
					{ id: 'crocs_de_loup', qty: 8 },
					{ id: 'lingot_cuivre', qty: 12 },
				]
			},
			{ 
				id: 'poing_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 999 },
					{ id: 'brindille_enchantee', qty: 999 },
				]
			},
			{ 
				id: 'baton_sylvestre_mage', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 15 },
					{ id: 'coeur_de_bois', qty: 1 },
				]
			},
			{ 
				id: 'grimoire_sylvestre', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 4 },
					{ id: 'fourrure_de_loup', qty: 12 },
				]
			},
			{ 
				id: 'baton_sylvestre_shaman', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 15 },
					{ id: 'coeur_de_bois', qty: 1 },
				]
			},
			{ 
				id: 'grimoire_bestial', time: '10s',
				ingredients: [
					{ id: 'brindille_enchantee', qty: 4 },
					{ id: 'fourrure_de_loup', qty: 12 },
				]
			}
		]
  },
	{
    id: 'forgeron_armures_vdp',
    name: "Forgeron d'Armures",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a2',
    img: '../img/compendium/textures/armors/chestplate_tactique.png',
    lore: "Permet le fabrication d'armures rudimentaires pour les novices.",
    craft: [
			{ 
				id: 'lingot_cuivre', time: '10s',
				ingredients: [
					{ id: 'cuivre', qty: 3 },
					{ id: 'charbon', qty: 2 },
				]
			},
			{ 
				id: 'tunique_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 12 },
					{ id: 'lingot_cuivre', qty: 4 },
				]
			},
			{ 
				id: 'jambieres_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 8 },
					{ id: 'lingot_cuivre', qty: 4 },
				]
			},
			{ 
				id: 'bottes_debutant', time: '10s',
				ingredients: [
					{ id: 'peau_de_sanglier', qty: 5 },
					{ id: 'lingot_cuivre', qty: 2 },
				]
			},
			{ 
				id: 'tunique_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 18 },
					{ id: 'ecorce_sylvestre', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 15 },
					{ id: 'ecorce_sylvestre', qty: 8 },
				]
			},
			{ 
				id: 'bottes_tactique', time: '10s',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 10 },
					{ id: 'ecorce_sylvestre', qty: 5 },
				]
			},
			{ 
				id: 'tunique_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 18 },
					{ id: 'tissu_spectral', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 15 },
					{ id: 'tissu_spectral', qty: 8 },
				]
			},
			{ 
				id: 'bottes_spectral', time: '10s',
				ingredients: [
					{ id: 'cuir_use', qty: 10 },
					{ id: 'tissu_spectral', qty: 5 },
				]
			},
			{ 
				id: 'tunique_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 18 },
					{ id: 'gelee_de_slime', qty: 10 },
				]
			},
			{ 
				id: 'jambieres_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 15 },
					{ id: 'gelee_de_slime', qty: 8 },
				]
			},
			{ 
				id: 'bottes_ika', time: '10s',
				ingredients: [
					{ id: 'carapace_dika', qty: 10 },
					{ id: 'gelee_de_slime', qty: 5 },
				]
			},
			{ 
				id: 'bottes_revenant', time: '10s',
				ingredients: [
					{ id: 'eclat_du_sabot_maudit', qty: 1 },
					{ id: 'carapace_dika', qty: 64 },
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fourrure_de_loup', qty: 64 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_vdp',
    name: "Forgeron d'Accessoires de Base",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a3',
    img: '../img/compendium/textures/trinkets/P1/Set Loup Faiblard/Collier d\'Albal.png',
    lore: "Permet le fabrication d'accessoires de base.",
    craft: [
			{ 
				id: 'anneau_cuivre', time: '1m',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'anneau_fer', time: '1m',
				ingredients: [
					{ id: 'lingot_fer', qty: 16 },
				]
			},
			{ 
				id: 'collier_albal', time: '1m',
				ingredients: [
					{ id: 'fourrure_de_loup', qty: 96 },
					{ id: 'crocs_de_albal', qty: 5 },
				]
			},
			{ 
				id: 'amulette_bois', time: '1m',
				ingredients: [
					{ id: 'coeur_de_bois', qty: 32 },
					{ id: 'bouleau', qty: 64 },
				]
			},
			{ 
				id: 'gants_bandit', time: '1m',
				ingredients: [
					{ id: 'cuir_use', qty: 96 },
					{ id: 'racine_ancestrale', qty: 8 },
				]
			},
			{ 
				id: 'gants_osseux', time: '1m',
				ingredients: [
					{ id: 'poussiere_dos', qty: 64 },
					{ id: 'os_de_squelette', qty: 64 },
					{ id: 'os_de_squelette_renforce', qty: 32 },
				]
			},
			{ 
				id: 'bracelet_sylvestre', time: '1m',
				ingredients: [
					{ id: 'ecorce_de_titan', qty: 64 },
					{ id: 'brindille_enchantee', qty: 64 },
				]
			},
			{ 
				id: 'bracelet_araignee', time: '1m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 64 },
					{ id: 'spore_corrompu', qty: 64 },
				]
			},
			{ 
				id: 'gants_cerfs', time: '1m',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 32 },
				]
			},
			{ 
				id: 'bracelet_gluant', time: '1m',
				ingredients: [
					{ id: 'lingot_fer', qty: 8 },
					{ id: 'gelee_de_slime', qty: 64 },
					{ id: 'noyau_de_slime', qty: 8 },
				]
			}
		]
  },
	{
    id: 'forgeron_accessoires_cuivre_vdp',
    name: "Forgeron d'Accessoires de Cuivre",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a5',
    img: '../img/compendium/textures/trinkets/P1/Set de Cuivre/Anneau de Cuivre.png',
    lore: "Permet le fabrication d'accessoires en Cuivre.",
    craft: [
			{ 
				id: 'anneau_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'bracelet_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
			{ 
				id: 'gants_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
			{ 
				id: 'amulette_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 16 },
				]
			},
			{ 
				id: 'piece_cuivre', time: '2m30s',
				ingredients: [
					{ id: 'lingot_cuivre', qty: 24 },
				]
			},
		]
  },
	{
    id: 'forgeron_accessoires_fer_vdp',
    name: "Forgeron d'Accessoires de Fer",
    tag: 'forgeron_accessoires',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a6',
    img: '../img/compendium/textures/trinkets/P1/Set de Fer/Anneau de Fer.png',
    lore: "Permet le fabrication d'accessoires en Fer.",
    craft: [
			{ 
				id: 'anneau_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 12 },
				]
			},
			{ 
				id: 'bracelet_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
			{ 
				id: 'gants_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
			{ 
				id: 'amulette_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 12 },
				]
			},
			{ 
				id: 'piece_fer', time: '2m30s',
				ingredients: [
					{ id: 'lingot_fer', qty: 18 },
				]
			},
		]
  },
	{
    id: 'forgeron_lingot_vdp',
    name: "Forgeron de Lingots de Cuivre & de Fer",
    tag: 'forgeron_lingots',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1a8',
    img: '../img/compendium/montages/lingots.png',
    lore: "Permet le fabrication de Lingots de Cuivre et de Lingots de Fer.",
    craft: [
			{ 
				id: 'lingot_cuivre', time: '10s',
				ingredients: [
					{ id: 'cuivre', qty: 3 },
					{ id: 'charbon', qty: 2 },
				]
			},
			{ 
				id: 'lingot_fer', time: '15s',
				ingredients: [
					{ id: 'fer', qty: 4 },
					{ id: 'charbon', qty: 2 },
				]
			}
		]
  },
	{
    id: 'cle_vdp',
    name: "Fabicant de Clef du Donjon Mine de Geldorak",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Ville de Départ',
    regionId: 'm1c1',
    img: '../img/compendium/textures/items/Donjon/key_geldo.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Mine de Geldorak.",
    craft: [
			{ 
				id: 'cle_foret', time: '3m',
				ingredients: [
					{ id: 'ecorce_sylvestre', qty: 15 },
					{ id: 'coeur_de_bois', qty: 4 },
					{ id: 'mycelium_magique', qty: 1 },
				]
			}
		]
  },
	//#endregion Ville de Départ
	//#region Hanaka
  {
    id: 'repreneur_butin_hanaka',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1b2',
    img: '../img/compendium/montages/butin_hanaka.png',
    lore: "Reprends des ingrédient forêstié trouvable aux abbords de Hanaka, dans les Marécages Putrides.",
    sells: [
      { id: 'pousse_de_sylve',  price: 3 },
      { id: 'eclat_de_bois_magique', price: 4 },
			{ id: 'racine_ancestrale', price: 150 },
			{ id: 'ecorce_de_titan', price: 5 },
			{ id: 'ecorce_sylvestre', price: 4 },
			{ id: 'corde_darc_sylvestre', price: 5 },
			{ id: 'brindille_enchantee', price: 4 },
			{ id: 'coeur_de_bois', price: 10 },
			{ id: 'tissu_spectral', price: 4 },
			{ id: 'mycelium_magique', price: 300 },
    ],
  },
  {
    id: 'marchand_equipement_hanaka',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1m2',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
  },
  {
    id: 'repreneur_arme_hanaka',
    name: "Repreneur d'Armes Niveau 5",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Hanaka',
    regionId: 'm1b8',
    img: '../img/compendium/montages/revendeur_armes_hanaka.png',
    lore: "Reprends les Armes de Niveau 5 obtenable sur les monstres du Palier 1.",
    sells: [
      { id: 'bouclier_sylvestre',  price: 50 },
			{ id: 'marteau_colosse', price: 50 },
			{ id: 'epee_osseuse', price: 50 },
			{ id: 'dague_bandit', price: 50 },
			{ id: 'arbalete_bandit', price: 50 },
			{ id: 'baton_squelette_mage', price: 50 },
			{ id: 'baton_squelette_shaman', price: 50 },
			{ id: 'baton_squelette_maudit_mage', price: 150 },
			{ id: 'baton_squelette_maudit_shaman', price: 150 },
    ],
  },
	//#endregion Hanaka
	//#region Mizunari
  {
    id: 'repreneur_butin_mizunari',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Mizunari',
		regionId: 'm1b3',
    img: '../img/compendium/montages/butin_mizunari.png',
    lore: "Reprends des ingrédient champêtre trouvable dans les champs à l'Est de Mizunari.",
    sells: [
      { id: 'cuir_use',  price: 5 },
      { id: 'carapace_dika', price: 6 },
			{ id: 'spore_corrompu', price: 5 },
			{ id: 'fragment_de_feuille', price: 6 },
    ],
  },
	{
    id: 'marchand_outils_mizunari',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Mizunari',
    regionId: 'm1m11',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
    ],
  },
	//#endregion Mizunari
	//#region Mine de Geldorak
	{
    id: 'cle_mine_geldorak',
    name: "Fabicant de Clef du Donjon Mine de Geldorak",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Mine de Geldorak',
    regionId: 'm1c2',
    img: '../img/compendium/textures/items/Donjon/key_geldo.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Mine de Geldorak.",
    craft: [
			{ 
				id: 'cle_foret', time: '3m',
				ingredients: [
					{ id: 'ecorce_sylvestre', qty: 15 },
					{ id: 'coeur_de_bois', qty: 4 },
					{ id: 'mycelium_magique', qty: 1 },
				]
			}
		]
  },
	//#endregion Mine de Geldorak
	//#region Vallhat
  {
    id: 'repreneur_butin_vallhat',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Vallhat',
		regionId: 'm1b4',
    img: '../img/compendium/montages/butin_vallhat.png',
    lore: "Reprends des ingrédient gluant trouvable dans les marécages en bas de Vallhat.",
    sells: [
      { id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 10 },
			{ id: 'potion_stamina_1',  buy: 10 },
      { id: 'pousse_de_sylve',  price: 3 },
      { id: 'eclat_de_bois_magique', price: 4 },
			{ id: 'racine_ancestrale', price: 150 },
			{ id: 'ecorce_de_titan', price: 5 },
			{ id: 'ecorce_sylvestre', price: 4 },
			{ id: 'corde_darc_sylvestre', price: 5 },
			{ id: 'brindille_enchantee', price: 4 },
			{ id: 'coeur_de_bois', price: 10 },
			{ id: 'tissu_spectral', price: 4 },
			{ id: 'mycelium_magique', price: 300 },
			{ id: 'gelee_de_slime', price: 5 },
			{ id: 'noyau_de_slime', price: 100 },
			{ id: 'essence_de_gorbel', price: 1500 },
    ],
  },
  {
    id: 'marchand_accessoire_vallhat',
    name: "Marchand d'Accessoires",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Vallhat',
    regionId: 'm1m3',
    img: '../img/compendium/montages/accessoires_vallhat.png',
    lore: "Vends des Accessoires à base de slime de Vallhat.",
    sells: [
      { id: 'bague_gluante',  price: 1000 },
      { id: 'amulette_gluante', price: 1000 },
    ],
  },
	{
    id: 'secret_vallaht',
    name: "Fabicant de l'Anneau Gluant",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Vallhat',
    regionId: 'm1c8',
    img: '../img/compendium/textures/trinkets/P1/Set des Slimes Gélatineux/Anneau Gluant.png',
    lore: "Permet le fabrication de l'Accessoires Anneau Gluant.",
    craft: [
			{ 
				id: 'anneau_gluant', time: '30m',
				ingredients: [
					{ id: 'gelee_de_slime', qty: 40 },
					{ id: 'noyau_de_slime', qty: 32 },
					{ id: 'essence_de_gorbel', qty: 1 },
				]
			}
		]
  },
	//#endregion Vallhat
	//#region Chateau Abandonne
  {
    id: 'repreneur_butin_chateau_abandonne',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Château Abandonné',
		regionId: 'm1b5',
    img: '../img/compendium/montages/butin_chateau.png',
    lore: "Reprends des ingrédient des Squelettes trouvable dans les Ruines Maudites et son Donjon.",
    sells: [
      { id: 'os_de_squelette',  price: 4.5 },
      { id: 'poussiere_dos', price: 4 },
			{ id: 'os_de_squelette_renforce', price: 5 },
			{ id: 'tissu_maudit', price: 6 },
			{ id: 'morceau_de_criniere_spectrale', price: 5000 },
			{ id: 'coeur_putrefie', price: 50 },
    ],
  },
	//#endregion Chateau Abandonne
	//#region Virelune
  {
    id: 'repreneur_butin_virelune',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Virelune',
		regionId: 'm1b6',
    img: '../img/compendium/montages/butin_virelune.png',
    lore: "Reprends des ingrédient d'Arachnides et du Lac environant.",
    sells: [
      { id: 'fil_araignee',  price: 7 },
      { id: 'tissu_araignee', price: 6 },
			{ id: 'carapace_requin', price: 6.5 },
			{ id: 'coeur_nymbrea', price: 500 },
			{ id: 'venin_araignee', price: 750 },
    ],
  },
	{
    id: 'marchand_outils_virelune',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Virelune',
    regionId: 'm1m6',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
    ],
  },
	{
    id: 'secret_antre_aepep',
    name: "Fabicant de l'Anneau de Léviathan",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Antre de Aepep',
    regionId: 'm1c7',
    img: '../img/compendium/textures/trinkets/P1/Anneau de Léviathan.png',
    lore: "Permet le fabrication de l'Accessoires Anneau de Léviathan.",
    craft: [
			{ 
				id: 'anneau_leviathan', time: '30m',
				ingredients: [
					{ id: 'carapace_requin', qty: 96 },
					{ id: 'coeur_nymbrea', qty: 5 },
				]
			}
		]
  },
	//#endregion Virelune
	//#region Tolbana
  {
    id: 'repreneur_butin_tolbana',
    name: "Repreneur de Butin",
    tag: 'repreneur_butin',
    palier: 1,
    region: 'Tolbana',
		regionId: 'm1b7',
    img: '../img/compendium/montages/butin_tolbana.png',
    lore: "Reprends des gelés et de la faune locale.",
    sells: [
      { id: 'peau_dur_glacial',  price: 10 },
      { id: 'eclat_magique_glacial', price: 8 },
			{ id: 'poussiere_givre', price: 6 },
			{ id: 'carapace_requin', price: 6.5 },
			{ id: 'fil_araignee', price: 6 },
			{ id: 'tissu_araignee', price: 7 },
			{ id: 'peau_cerf_montagnes', price: 6 },
			{ id: 'fragment_ame_ours', price: 3500 },
    ],
  },
  {
    id: 'marchand_equipement_tolbana',
    name: "Marchand d'Équipement",
    tag: 'marchand_equipement',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m9',
    img: '../img/compendium/montages/equipement.png',
    lore: "Vends des Armes et des Consommables pour les nouveaux arrivants.",
    sells: [
      { id: 'epee_entrainement',  buy: 75, price: 4 },
			{ id: 'bouclier_pacotille',  buy: 75, price: 4 },
			{ id: 'arc_courbe',  buy: 100, price: 4 },
			{ id: 'dague_delabree',  buy: 100, price: 4 },
			{ id: 'baton_mediocre_mage',  buy: 75, price: 4 },
			{ id: 'grimoire_delie',  buy: 25, price: 4 },
			{ id: 'baton_mediocre_shaman',  buy: 75, price: 4 },
			{ id: 'grimoire_sauvage',  buy: 25, price: 4 },
			{ id: 'potion_vie_1',  buy: 20 },
			{ id: 'potion_mana_1',  buy: 20 },
			{ id: 'potion_stamina_1',  buy: 20 },
			{ id: 'viande_de_sanglier',  buy: 0.1 },
			{ id: 'parchemin_changement',  buy: 1500 },
			{ id: 'parchemin_reallocation',  buy: 750 },
			{ id: 'parchemin_maitrise',  buy: 750 },
    ],
  },
  {
    id: 'marchand_accessoire_tolbana',
    name: "Marchand d'Accessoires",
    tag: 'marchand_accessoires',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m4',
    img: '../img/compendium/montages/accessoires_tolbana.png',
    lore: "Vends des Accessoires pour aventuriers agguéris.",
    sells: [
      { id: 'bague_squelette',  price: 1000 },
      { id: 'bracelet_cerf', price: 2500 },
    ],
  },
	{
    id: 'marchand_consommable_tolbana',
    name: "Marchand de Consommable",
    tag: 'marchand_consommable',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m4',
    img: '../img/compendium/textures/items/Consommable/strengthpot_1.png',
    lore: "Vends des Consommable pour Aventuriers.",
    sells: [
      { id: 'potion_vie_1',  price: 20 },
      { id: 'potion_vie_2',  price: 40 },
			{ id: 'potion_mana_1',  price: 20 },
      { id: 'potion_mana_2',  price: 40 },
			{ id: 'potion_stamina_1',  price: 20 },
      { id: 'potion_stamina_2',  price: 40 },
			{ id: 'parchemin_changement',  price: 1500 },
			{ id: 'parchemin_reallocation',  price: 750 },
			{ id: 'parchemin_maitrise',  price: 750 },
    ],
  },
	{
    id: 'alchimiste_tolbana',
    name: "Alchimiste",
    tag: 'alchimiste',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a15',
    img: '../img/compendium/textures/items/Consommable/strengthpot_3.png',
    lore: "Concocte des Potions et des Cristaux.",
    craft: [
      { id: 'potion_vie_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_vie_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_vie_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_soin', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_mana_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_mana_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_mana_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_mana', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'potion_stamina_1', time: '10s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 6 },
					{ id: 'poudre_bois', qty: 4 },
					{ id: 'pousse_de_sylve', qty: 4 },
				]
			},
			{ id: 'potion_stamina_2', time: '15s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 8 },
					{ id: 'pousse_de_sylve', qty: 7 },
					{ id: 'poussiere_dos', qty: 4 },
					{ id: 'eclat_de_bois_magique', qty: 5 },
				]
			},
			{ id: 'potion_stamina_3', time: '20s', quality:true,
				ingredients: [
					{ id: 'allium', qty: 10 },
					{ id: 'poussiere_dos', qty: 7 },
					{ id: 'racine_ancestrale', qty: 3 },
				]
			},
			{ id: 'cristal_stamina', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
			{ id: 'cristal_puissance', time: '1m',
				ingredients: [
					{ id: 'essence_de_gorbel', qty: 1 },
					{ id: 'racine_ancestrale', qty: 10 },
					{ id: 'eclat_de_bois_magique', qty: 25 },
					{ id: 'mycelium_magique', qty: 10 },
				]
			},
    ],
  },
	{
    id: 'marchand_outils_tolbana',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1m7',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
    ],
  },
	{
    id: 'forgeron_armes_tolbana',
    name: "Forgeron d'Armes de Tolbana",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a9',
    img: '../img/compendium/montages/armes_tolbana.png',
    lore: "Permet le fabrication d'armes pour les aventuriers aggueris.",
    craft: [
      { id: 'epee_magique', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'marteau_magique', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'bouclier_resistant_tolbana', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 24 },
					{ id: 'peau_dur_glacial', qty: 30 },
				]
			},
			{ id: 'bouclier_puissant_tolbana', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 24 },
					{ id: 'peau_dur_glacial', qty: 30 },
				]
			},
			{ id: 'dague_sombre', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 24 },
				]
			},
			{ id: 'longue_dague_sombre', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 24 },
				]
			},
			{ id: 'arc_chasse', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'arbalete_chasse', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 24 },
				]
			},
			{ id: 'baton_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'baton_magicien_puissant', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'grimoire_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 20 },
					{ id: 'poussiere_givre', qty: 20 },
				]
			},
			{ id: 'baton_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'baton_sorcier_puissant', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 24 },
				]
			},
			{ id: 'grimoire_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 20 },
					{ id: 'poussiere_givre', qty: 20 },
				]
			},
    ],
  },
	{
    id: 'forgeron_armures_tolbana',
    name: "Forgeron d'Armures de Tolbana",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Tolbana',
    regionId: 'm1a10',
    img: '../img/compendium/textures/armors/helmet_titan.png',
    lore: "Permet le fabrication d'armures pour les aventuriers aggueris.",
    craft: [
      { id: 'tunique_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_chasseur', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 12 },
				]
			},
			{ id: 'robe_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 20 },
				]
			},
			{ id: 'pantalon_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 15 },
				]
			},
			{ id: 'sandales_sorcier', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 12 },
				]
			},
			{ id: 'casque_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 15 },
					{ id: 'peau_dur_glacial', qty: 25 },
				]
			},
			{ id: 'plastron_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_titan', time: '10s',
				ingredients: [
					{ id: 'carapace_requin', qty: 18 },
					{ id: 'peau_dur_glacial', qty: 12 },
				]
			},
			{ id: 'robe_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 20 },
				]
			},
			{ id: 'pantalon_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 15 },
				]
			},
			{ id: 'sandales_magicien', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'tissu_araignee', qty: 12 },
				]
			},
			{ id: 'tunique_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 20 },
				]
			},
			{ id: 'jambieres_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 15 },
				]
			},
			{ id: 'bottes_ninja', time: '10s',
				ingredients: [
					{ id: 'peau_cerf_montagnes', qty: 18 },
					{ id: 'eclat_magique_glacial', qty: 12 },
				]
			},
    ],
  },
	//#endregion Tolbana
	//#region Candelia
	{
    id: 'marchand_outils_candelia',
    name: "Marchand d'Outils",
    tag: 'marchand_outils',
    palier: 1,
    region: 'Candelia',
    regionId: 'm1m10',
    img: '../img/compendium/montages/outils_p1.png',
    lore: "Vends des Outils pour que les Aventuriers récoltent des ressources pour leur aventure.",
    sells: [
      { id: 'pioche_felee',  buy: 20, price: 4 },
			{ id: 'hache_ebrechee',  buy: 20, price: 4 },
			{ id: 'serpe_tordue',  buy: 20, price: 4 },
			{ id: 'canne_a_peche_en_bois',  buy: 20, price: 4 },
    ],
  },
	{
    id: 'cle_candelia',
    name: "Fabicant de Clef du Donjon Sanctuaire de Xal'Zirith",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Candelia',
    regionId: 'm1c5',
    img: '../img/compendium/textures/items/Donjon/key_xal.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Sanctuaire de Xal'Zirtih.",
    craft: [
			{ 
				id: 'cle_xal', time: '3m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 20 },
					{ id: 'fil_araignee', qty: 25 },
				]
			}
		]
  },
	{
    id: 'cle_xal',
    name: "Fabicant de Clef du Donjon Sanctuaire de Xal'Zirith",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Sanctuaire de Xal\'Zirith',
    regionId: 'm1c4',
    img: '../img/compendium/textures/items/Donjon/key_xal.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Sanctuaire de Xal'Zirtih.",
    craft: [
			{ 
				id: 'cle_xal', time: '3m',
				ingredients: [
					{ id: 'tissu_araignee', qty: 20 },
					{ id: 'fil_araignee', qty: 25 },
				]
			}
		]
  },
	{
    id: 'secret_citadelle_neiges',
    name: "Fabricant du Bracelet de Glace",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Citdelle des Neiges',
    regionId: 'm1c6',
    img: '../img/compendium/textures/trinkets/P1/Bracelet de Glace.png',
    lore: "Permet le fabrication de l'Accessoires Bracelet de Glace.",
    craft: [
			{ 
				id: 'bracelet_glace', time: '30m',
				ingredients: [
					{ id: 'poussiere_givre', qty: 32 },
					{ id: 'eclat_magique_glacial', qty: 32 },
					{ id: 'peau_dur_glacial', qty: 32 },
					{ id: 'fragment_ame_ours', qty: 1 },
				]
			}
		]
  },
	{
    id: 'secret_arakh\'nol',
    name: "Fabicant du Collier d'Aragorn",
    tag: 'fabricant_secrets',
    palier: 1,
    region: 'Forêt d\'Arakh\'Nol',
    regionId: 'm1c9',
    img: '../img/compendium/textures/trinkets/P1/Collier de Aragorn.png',
    lore: "Permet le fabrication de l'Accessoires Bracelet de Glace.",
    craft: [
			{ 
				id: 'collier_aragorn', time: '30m',
				ingredients: [
					{ id: 'fil_araignee', qty: 64 },
					{ id: 'fil_araignee_renforce', qty: 32 },
					{ id: 'venin_araignee', qty: 1 },
				]
			}
		]
  },
	//#endregion Candelia
	//#region Labyrinthe des Déchus
	{
    id: 'forgeron_armes_labyrinthe',
    name: "Forgeron d'Armes du Labyrinthe",
    tag: 'forgeron_armes',
    palier: 1,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1a11',
    img: '../img/compendium/montages/armes_labyrinthe.png',
    lore: "Permet le fabrication d'armes pour les aventuriers expérimentés.",
    craft: [
      { id: 'lingot_ame_metal', time: '10s',
				ingredients: [
					{ id: 'piece_ame_metal', qty: 10 },
					{ id: 'fer', qty: 5 },
					{ id: 'charbon', qty: 3 },
				]
			},
			{ id: 'lingot_metal_enchante', time: '10s',
				ingredients: [
					{ id: 'piece_metal_enchante', qty: 10 },
					{ id: 'fer', qty: 5 },
					{ id: 'charbon', qty: 3 },
				]
			},
			{ id: 'fil_araignee_renforce', time: '10s',
				ingredients: [
					{ id: 'fil_araignee', qty: 3 },
					{ id: 'piece_metal_enchante', qty: 6 },
				]
			},
			{ id: 'ame_reaper', time: '3m',
				ingredients: [
					{ id: 'eclat_fusionne', qty: 3 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'ame_warden', time: '3m',
				ingredients: [
					{ id: 'fragment_casse_rouge', qty: 25 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'ame_herald', time: '3m',
				ingredients: [
					{ id: 'fragment_casse_jaune', qty: 25 },
					{ id: 'charbon', qty: 32 },
				]
			},
			{ id: 'pioche_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'hache_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 22 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'houe_metal', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'brindille_enchantee', qty: 10 },
				]
			},
			{ id: 'epee_gardien', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_jaune', qty: 30 },
					{ id: 'ame_herald', qty: 1 },
				]
			},
			{ id: 'dague_heroique', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_violet', qty: 21 },
					{ id: 'lingot_ame_metal', qty: 5 },
				]
			},
			{ id: 'katana_heroique', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 25 },
					{ id: 'fragment_casse_violet', qty: 21 },
					{ id: 'lingot_ame_metal', qty: 5 },
				]
			},
			{ id: 'arc_fallen', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 12 },
					{ id: 'fil_araignee_renforce', qty: 7 },
				]
			},
			{ id: 'baton_obscur_mage', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'baton_obscur_puissant_mage', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'grimoire_obscur', time: '5m',
				ingredients: [
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fragment_casse_violet', qty: 12 },
					{ id: 'brindille_enchantee', qty: 16 },
				]
			},
			{ id: 'baton_obscur_shaman', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'baton_obscur_puissant_shaman', time: '5m',
				ingredients: [
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_violet', qty: 26 },
					{ id: 'brindille_enchantee', qty: 6 },
				]
			},
			{ id: 'grimoire_fantomatique', time: '5m',
				ingredients: [
					{ id: 'cuir_use', qty: 64 },
					{ id: 'fragment_casse_violet', qty: 12 },
					{ id: 'brindille_enchantee', qty: 16 },
				]
			},
    ],
  },
	{
    id: 'forgeron_armures_labyrinthe',
    name: "Forgeron d'Armures du Labyrinthe",
    tag: 'forgeron_armures',
    palier: 1,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'm1a12',
    img: '../img/compendium/textures/armors/helmet_gardien.png',
    lore: "Permet le fabrication d'armures pour les aventuriers expérimentés.",
    craft: [
			{ id: 'eclat_fusionne', time: '10s',
				ingredients: [
					{ id: 'fragment_casse_violet', qty: 5 },
				]
			},
			{ id: 'casque_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 10 },
				]
			},
			{ id: 'plastron_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 24 },
					{ id: 'fragment_casse_rouge', qty: 14 },
				]
			},
      { id: 'jambieres_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 10 },
				]
			},
			{ id: 'bottes_gardien', time: '10s',
				ingredients: [
					{ id: 'ame_warden', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_rouge', qty: 9 },
				]
			},

			{ id: 'casque_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 10 },
				]
			},
			{ id: 'plastron_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 24 },
					{ id: 'fragment_casse_jaune', qty: 14 },
				]
			},
      { id: 'jambieres_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 10 },
				]
			},
			{ id: 'bottes_heraut', time: '10s',
				ingredients: [
					{ id: 'ame_herald', qty: 1 },
					{ id: 'lingot_metal_enchante', qty: 20 },
					{ id: 'fragment_casse_jaune', qty: 9 },
				]
			},

			{ id: 'casque_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 3 },
				]
			},
			{ id: 'plastron_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 24 },
					{ id: 'eclat_fusionne', qty: 6 },
				]
			},
      { id: 'jambieres_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 4 },
				]
			},
			{ id: 'bottes_faucheuse', time: '10s',
				ingredients: [
					{ id: 'ame_reaper', qty: 1 },
					{ id: 'lingot_ame_metal', qty: 20 },
					{ id: 'eclat_fusionne', qty: 5 },
				]
			},
    ],
  },
	{
    id: 'cle_labyrinthe',
    name: "Fabicant de Clef du Donjon Labyrinthe des Déchus",
    tag: 'fabricant_cles',
    palier: 1,
    region: 'Labyrinthe des Déchus',
    regionId: 'm1c3',
    img: '../img/compendium/textures/items/Donjon/key_laby.png',
    lore: "Permet le fabrication d'une clef menant au Donjon Labyrinthe des Déchus.",
    craft: [
			{ 
				id: 'cle_dechu', time: '3m',
				ingredients: [
					{ id: 'fragment_de_feuille', qty: 20 },
					{ id: 'tissu_maudit', qty: 15 },
					{ id: 'ames_des_ruines', qty: 10 },
				]
			}
		]
  },
	//#endregion Labyrinthe des Déchus
];

/* ══════════════════════════════════
   CONSTANTES D'AFFICHAGE
══════════════════════════════════ */
const PNJ_TAG_LABELS = {
  forgeron_armes:       "Forgeron d'Armes",
  forgeron_armures:     "Forgeron d'Armures",
  forgeron_accessoires: "Forgeron d'Accessoires",
  forgeron_lingots:     "Forgeron de Lingots",
  fabricant_cles:       "Fabricant de Clés",
  fabricant_secrets:    "Fabricant Secrets",
  refaconneur:          "Refaçonneur",
  marchand_equipement:  "Marchand d'Équipement",
  marchand_consommable: "Marchand de Consommable",
  marchand_outils:      "Marchand d'Outils",
  marchand_accessoires: "Marchand d'Accessoires",
  repreneur_butin:      "Repreneur de Butin",
  bucheron:             "Bûcheron",
  alchimiste:           "Alchimiste",
  quetes:               "Quêtes",
  autre:                "Autre",
};
const PNJ_TAG_COLORS = {
  forgeron_armes:       '#c8783c',
  forgeron_armures:     '#f15e1a',
  forgeron_accessoires: '#f1b586',
  forgeron_lingots:     '#eed4a4',
  fabricant_cles:       '#f5ac4d',
  fabricant_secrets:    '#8b3c00',
  refaconneur:          '#6e543f',
  marchand_equipement:  '#c9a84c',
  marchand_consommable: '#b19b5f',
  marchand_outils:      '#a09472',
  marchand_accessoires: '#a8b34c',
  repreneur_butin:      '#8eb155',
  bucheron:             '#5aad64',
  alchimiste:           '#9b6bc9',
  quetes:               '#5899e0',
  autre:                '#7888a0',
};

const TYPE_LABELS     = { boss: 'Boss', mini_boss: 'Mini-Boss', monstre: 'Monstre', sbire: 'Sbire' };
const BEHAVIOR_LABELS = { passif: 'Passif', neutre: 'Neutre', agressif: 'Agressif' };
const DIFF_LABELS     = ['', 'Très facile', 'Facile', 'Moyen', 'Difficile', 'Très difficile'];

const TYPE_COLORS = {
  boss:    { bg: 'rgba(180,40,40,.85)',  text: '#ffc8c8', border: '#c0404055' },
  mini_boss:    { bg: 'rgba(212, 95, 60, 0.85)',  text: '#ffc8c8', border: '#c0404055' },
  monstre: { bg: 'rgba(160,80,20,.85)', text: '#ffd9a0', border: '#c06c2055' },
  sbire:   { bg: 'rgba(50,50,70,.85)',  text: '#b0b8d0', border: '#5055a055' },
};
const BEHAVIOR_COLORS = {
  passif:   '#346f2e',
  neutre:   '#d4c07a',
  agressif: '#df6262',
};
