/* ══════════════════════════════════════════════════════════════
   BESTIAIRE — Veilleurs au Clair de Lune
══════════════════════════════════════════════════════════════ */

/* ══════════════════════════════════
   DONNÉES — MONSTRES
══════════════════════════════════ */
const MOBS = [
  {
    id: 'sanglier_corrompu',
    name: 'Sanglier Corrompu',
    type: 'monstre',
    behavior: 'neutre',
    palier: 1,
    difficulty: 1,
    region: 'Zone des Sangliers',
    regionId: 'zone_sanglier',
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
    palier: 1,
    difficulty: 2,
    region: 'Zone des Sangliers',
    regionId: 'zone_sanglier',
    img: '../img/mobs/P1/sanglier_corrompu.png',
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
  },
  {
    id: 'loup_sinistre_blanc',
    name: 'Loup Sinistre Blanc',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 1,
    region: 'Vallée des Loups',
    regionId: 'vallee_loup',
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
    palier: 1,
    difficulty: 1,
    region: 'Vallée des Loups',
    regionId: 'vallee_loup',
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
    palier: 1,
    difficulty: 2,
    region: 'Vallée des Loups',
    regionId: 'vallee_loup',
    img: '../img/mobs/P1/albal.png',
    lore: "Un loup solitaire aux yeux d'argent glacés. Son passage laisse une brume et le silence.",
    attacks: [
    ],
    loot: [
      { id: 'fourrure_de_loup', chance: 100 },
      { id: 'crocs_de_loup', chance: 70 },
	  { id: 'crocs_de_albal', chance: 20 },
    ],
  },
  {
    id: 'nephentes',
    name: 'Nephentes',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Champs de Mizunari',
    regionId: 'champs_mizunari',
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
    palier: 1,
    difficulty: 1,
    region: 'Maréage Putride',
    regionId: 'marecage_putride',
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
    palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'marecage_putride',
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
    palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'marecage_putride',
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
    palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'marecage_putride',
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
    palier: 1,
    difficulty: 2,
    region: 'Maréage Putride',
    regionId: 'marecage_putride',
    img: '../img/mobs/P1/gardien_colossal.png',
    lore: "Forgé dans la pierre et éveillé par la magie ancienne, il garde les terres oubliées contre toute intrusion. Ses pas seuls font trembler la forêt...",
    attacks: [
      { name: 'Ruée de la Forêt',   desc: 'Fonce sur sa cible de toute ses forces.', dmg: '?' },
    ],
    loot: [
      { id: 'mycelium_magique', chance: 20 },
      { id: 'marteau_colosse' },
    ],
  },
  {
    id: 'petit_slime',
    name: 'Petit Slime',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 1,
    region: 'Vallhat',
    regionId: 'vallhat',
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
    palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'vallhat',
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
    palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'vallhat',
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
    palier: 1,
    difficulty: 2,
    region: 'Vallhat',
    regionId: 'vallhat',
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
    palier: 1,
    difficulty: 3,
    region: 'Vallhat',
    regionId: 'vallhat',
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
  },
  {
    id: 'squelette_epeiste',
    name: 'Squelette Épéiste',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'ruines_maudites',
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
    palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'ruines_maudites',
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
    palier: 1,
    difficulty: 2,
    region: 'Ruines Maudites',
    regionId: 'ruines_maudites',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'donjon_squelette',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'donjon_squelette',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Squelette',
    regionId: 'donjon_squelette',
    img: '../img/mobs/P1/squelette_mage.png',
    lore: "Un revenant rachitique, mais animé par une magie ancienne et instable. Ses os craquent à chaque incantation, libérant une énergie spectrale dangereuse.",
    attacks: [
		{ name: 'Protection Squelettique',   desc: 'Rend invinsible un allié proche.' },
		{ name: '"Fire Ball"',   desc: 'Utilise toute la puissance de D&D pour lancer une terrible "Fire Ball".', dmg:'?' },
    ],
    loot: [
      { id: 'os_de_squelette_renforce', chance: 40 },
	  { id: 'poussiere_dos', chance: 30 },
    ],
  },
  {
    id: 'narax',
    name: 'Narax Squelette Maudit',
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Squelette',
    regionId: 'donjon_squelette',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Squelette',
    regionId: 'donjon_squelette',
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
    palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'mine_geldorak',
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
  },
  {
    id: 'bandit_robuste',
    name: 'Bandit Robuste',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
    img: '../img/mobs/P1/plante_devoreuse.png',
    lore: "Discrète sous ses feuilles luxuriantes, le danger rôde au moindre faux pas... Ses racines enserrent ses proies, lentement, avant de les engloutir sans laisser de trace.",
    attacks: [
    ],
  },
  {
    id: 'vyrmos',
    name: 'Vyrmos',
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
    img: '../img/mobs/P1/brute_foret.png',	
    lore: "Massive et sauvage, cette créature veille sur la forêt. Elle repousse les intrus à coups de poings dévastateurs. Aucune parole, seulement la force brute de la nature.",
    attacks: [
    ],
  },
  {
    id: 'tornak',
    name: 'Tornak',
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Donjon Mine de Geldorak',
    regionId: 'donjon_mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Mine de Geldorak',
    regionId: 'mine_geldorak',
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
    palier: 1,
    difficulty: 2,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Labyrinthe des Déchus',
    regionId: 'donjon_labyrinthe_dechus',
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
    palier: 1,
    difficulty: 3,
    region: 'Arakh\'Nol',
    regionId: 'arakh\'nol',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    type: 'boss',
    behavior: 'agressif',
    palier: 1,
    difficulty: 3,
    region: 'Donjon Sanctuaire de Xal\'Zirith',
    regionId: 'donjon_sanctuaire_xal\'zirith',
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
    palier: 1,
    difficulty: 2,
    region: 'Montagnes de Tolbana',
    regionId: 'montagne_tolbana',
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
    palier: 1,
    difficulty: 2,
    region: 'Citadelle des Neiges',
    regionId: 'citadelle_neige',
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
    palier: 1,
    difficulty: 2,
    region: 'Citadelle des Neiges',
    regionId: 'citadelle_neige',
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
    palier: 1,
    difficulty: 3,
    region: 'Citadelle des Neiges',
    regionId: 'citadelle_neige',
    img: '../img/mobs/P1/ours_glace.png',
    lore: "Né dans les cavernes les plus froides des montagnes, l'Ours de Glace incarne la force brute du Nord. Son rugissement fait frissonner l'air, et son souffle glacé fige tout sur son passage.",
    attacks: [
    ],
    loot: [
	  { id: 'fragment_ame_ours', chance: 5 },
	  { id: 'poussiere_givre', chance: 80, qty:'1-3' },
    ],
  },
  {
    id: 'poisson_requin',
    name: 'Poisson Requin',
    type: 'monstre',
    behavior: 'agressif',
    palier: 1,
    difficulty: 2,
    region: 'Lac de Virelune',
    regionId: 'lac_virelune',
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
    palier: 1,
    difficulty: 4,
    region: 'Antre de Aepep',
    regionId: 'antre_aepep	',
    img: '../img/mobs/P1/nymbrea.png',
    lore: "Serpent mythique glissant entre les courants profonds, Nymbréa incarne la grâce et la traîtrise des eaux calmes. Ses écailles scintillent comme des perles maudites, et son regard hypnotique attire les imprudents vers les abysses.",
    attacks: [
    ],
    loot: [
	  { id: 'coeur_nymbrea' },
    ],
  },
];

/* ══════════════════════════════════
   DONNÉES — PERSONNAGES
══════════════════════════════════ */
const PERSONNAGES = [
  {
    id: 'marchand_equipement',
    name: "Marchand d'Équipement",
    role: 'Vendeur',
    palier: 1,
    region: 'Ville de Départ',
    img: '',
    lore: "Tient la boutique principale de la Ville de Départ. Il vend les équipements de base aux aventuriers débutants.",
    sells: [
      { id: 'epee_entrainement',  price: 75 },
      { id: 'dague_entrainement', price: 50 },
    ],
  },
  {
    id: 'forgeron_armes',
    name: "Forgeron d'Armes",
    role: 'Artisan',
    palier: 1,
    region: 'Ville de Départ',
    img: '',
    lore: "Maître forgeron installé dans la forge du centre-ville. Fabrique des armes sur commande moyennant les bons matériaux.",
    sells: [
      { id: 'epee_fer', price: null },
    ],
  },
];

/* ══════════════════════════════════
   CONSTANTES D'AFFICHAGE
══════════════════════════════════ */
const TYPE_LABELS     = { boss: 'Boss', monstre: 'Monstre', sbire: 'Sbire' };
const BEHAVIOR_LABELS = { passif: 'Passif', neutre: 'Neutre', agressif: 'Agressif' };
const DIFF_LABELS     = ['', 'Très facile', 'Facile', 'Moyen', 'Difficile', 'Très difficile'];

const TYPE_COLORS = {
  boss:    { bg: 'rgba(180,40,40,.85)',  text: '#ffc8c8', border: '#c0404055' },
  monstre: { bg: 'rgba(160,80,20,.85)', text: '#ffd9a0', border: '#c06c2055' },
  sbire:   { bg: 'rgba(50,50,70,.85)',  text: '#b0b8d0', border: '#5055a055' },
};
const BEHAVIOR_COLORS = {
  passif:   '#346f2e',
  neutre:   '#d4c07a',
  agressif: '#df6262',
};

/* ══════════════════════════════════
   ÉTAT
══════════════════════════════════ */
let activeTab    = 'monstres';
let activePalier = 'all';
let activeTypes  = new Set(['boss', 'monstre', 'sbire']);
let searchQuery  = '';

/* ══════════════════════════════════
   DOM
══════════════════════════════════ */
const searchInput   = document.getElementById('sidebar-search');
const palierFilters = document.getElementById('palier-filters');
const entityGrid    = document.getElementById('entity-grid');
const gridEmpty     = document.getElementById('grid-empty');
const resultCount   = document.getElementById('result-count');
const mainTitle     = document.getElementById('main-title');
const mainSubtitle  = document.getElementById('main-subtitle');
const modalOverlay  = document.getElementById('mob-modal-overlay');
const modalContent  = document.getElementById('mob-modal-content');
const modalCloseBtn = document.getElementById('modal-close-btn');
const typeSection   = document.getElementById('type-block');

/* ══════════════════════════════════
   HELPERS
══════════════════════════════════ */
function normalize(str) {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
function getRarityColor(key) {
  if (typeof RARITIES !== 'undefined' && RARITIES[key]) return RARITIES[key].color;
  return { commun:'#8c8c8c', peu_commun:'#2dc44e', rare:'#4e96e8', epique:'#a135db', legendaire:'#e0ac60' }[key] || '#8c8c8c';
}
function findItem(id) {
  return (typeof ITEMS !== 'undefined') ? ITEMS.find(i => i.id === id) || null : null;
}
function dropRateColor(chance) {
  if (chance >= 70) return '#7fdf62';
  if (chance >= 30) return '#c9a84c';
  return '#c0392b';
}
function diffStarsHTML(diff) {
  return Array.from({length:5}, (_,i) =>
    `<span class="diff-star ${i < diff ? 'filled' : 'empty'}">◆</span>`
  ).join('');
}

function pushHash(tab, entityId = null) {
  const hash = entityId ? `#${tab}/${entityId}` : `#${tab}`;
  history.pushState({ tab, entityId }, '', hash);
}

function applyHash() {
  const raw = location.hash.slice(1);
  if (!raw) return;

  const [tab, entityId] = raw.split('/');

  if ((tab === 'monstres' || tab === 'personnages') && tab !== activeTab) {
    activeTab    = tab;
    activePalier = 'all';
    document.querySelectorAll('.sort-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    refreshAll();
  }

  if (entityId) {
    const list   = activeTab === 'monstres' ? MOBS : PERSONNAGES;
    const entity = list.find(e => e.id === entityId);
    if (entity) openModal(entity, /* pushHistory = */ false);
  }
}

window.addEventListener('popstate', (e) => {
  const state = e.state;

  if (!state) {
    _closeModalDOM();
    return;
  }

  if (!state.entityId) {
    _closeModalDOM();
    if (state.tab && state.tab !== activeTab) {
      activeTab    = state.tab;
      activePalier = 'all';
      document.querySelectorAll('.sort-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.tab === state.tab);
      });
      refreshAll();
    }
    return;
  }

  const list   = (state.tab === 'monstres' ? MOBS : PERSONNAGES);
  const entity = list.find(e => e.id === state.entityId);
  if (entity) openModal(entity, false);
});

/* ══════════════════════════════════
   FILTRAGE
══════════════════════════════════ */
function getList() { return activeTab === 'monstres' ? MOBS : PERSONNAGES; }

function getFiltered() {
  const q = normalize(searchQuery);
  return getList().filter(e => {
    if (q && !normalize(e.name).includes(q) && !normalize(e.region||'').includes(q) && !normalize(e.lore||'').includes(q)) return false;
    if (activePalier !== 'all' && e.palier !== activePalier) return false;
    if (activeTab === 'monstres') {
      if (!activeTypes.has(e.type)) return false;
    }
    return true;
  });
}

/* ══════════════════════════════════
   COMPTEURS SIDEBAR
══════════════════════════════════ */
function updateCounts() {
  if (activeTab !== 'monstres') return;

  const list = MOBS.filter(e => activePalier === 'all' || e.palier === activePalier);
  const q    = normalize(searchQuery);
  const filtered = q ? list.filter(e =>
    normalize(e.name).includes(q) || normalize(e.region||'').includes(q)
  ) : list;

  ['boss','monstre','sbire'].forEach(t => {
    const el = document.getElementById(`count-${t}`);
    if (el) el.textContent = filtered.filter(e => e.type === t).length;
  });
}

/* ══════════════════════════════════
   SIDEBAR — BLOCS COLLAPSE
══════════════════════════════════ */
function initCollapsible(headerId, bodyId) {
  const header = document.getElementById(headerId);
  const body   = document.getElementById(bodyId);
  if (!header || !body) return;
  header.addEventListener('click', () => {
    header.classList.toggle('open');
    body.classList.toggle('open');
  });
}
initCollapsible('palier-block-header', 'palier-block-body');
initCollapsible('type-block-header',   'type-block-body');

/* ══════════════════════════════════
   CONSTRUCTION FILTRES PALIER
══════════════════════════════════ */
function buildPalierFilters() {
  const list   = getList();
  const paliers = [...new Set(list.map(e => e.palier))].sort((a,b)=>a-b);
  palierFilters.innerHTML = '';

  const allBtn = document.createElement('button');
  allBtn.className = `palier-filter-btn${activePalier==='all' ? ' active' : ''}`;
  allBtn.innerHTML = `<span>⬡ Tous</span><span class="palier-count">${list.length}</span>`;
  allBtn.addEventListener('click', () => { activePalier = 'all'; refreshAll(); });
  palierFilters.appendChild(allBtn);

  paliers.forEach(p => {
    const count = list.filter(e => e.palier === p).length;
    const btn = document.createElement('button');
    btn.className = `palier-filter-btn${activePalier===p ? ' active' : ''}`;
    btn.innerHTML = `<span>⬡ Palier ${p}</span><span class="palier-count">${count}</span>`;
    btn.addEventListener('click', () => { activePalier = p; refreshAll(); });
    palierFilters.appendChild(btn);
  });
}

function updateSidebarSections() {
  typeSection.style.display = activeTab === 'monstres' ? '' : 'none';
}

/* ══════════════════════════════════
   GRILLE
══════════════════════════════════ */
function buildGrid() {
  const entities = getFiltered();
  entityGrid.innerHTML = '';

  if (entities.length === 0) {
    gridEmpty.style.display = 'flex';
    entityGrid.style.display = 'none';
    resultCount.textContent = '0 résultat';
    return;
  }
  gridEmpty.style.display = 'none';
  entityGrid.style.display = 'grid';
  resultCount.textContent = `${entities.length} entrée${entities.length>1?'s':''}`;

  entities.forEach((e, idx) => {
    const card = document.createElement('div');
    card.className = 'entity-card';
    card.dataset.id = e.id;
    card.style.animationDelay = `${idx * 0.025}s`;

    const isMob = activeTab === 'monstres';

    const imgHTML = e.img
      ? `<img src="${e.img}" alt="${e.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'">`
      : '';
    const phStyle = e.img ? 'style="display:none"' : '';
    const ph = `<span class="card-img-placeholder" ${phStyle}>${isMob ? '👾' : '🧑'}</span>`;

    const typeKey   = isMob ? e.type : 'pnj';
    const typeLabel = isMob ? (TYPE_LABELS[e.type]||e.type) : (e.role||'PNJ');
    const typeBadge = `<span class="card-type-badge badge-${typeKey}">${typeLabel}</span>`;
    const palierBadge = `<span class="card-palier-badge">P${e.palier}</span>`;

    let behaviorHTML = '';
    if (isMob) {
      behaviorHTML = `
        <div class="card-behavior-row">
          <span class="card-behavior-dot cdot-${e.behavior}"></span>
          <span class="card-behavior-text">${BEHAVIOR_LABELS[e.behavior]||e.behavior}</span>
        </div>`;
    } else {
      behaviorHTML = `
        <div class="card-behavior-row">
          <span class="card-behavior-text" style="color:var(--muted)">${e.region||''}</span>
        </div>`;
    }

    card.innerHTML = `
      <div class="card-img-wrap">
        ${imgHTML}${ph}
        ${typeBadge}
        ${palierBadge}
      </div>
      <div class="card-info">
        <div class="card-name">${e.name}</div>
        ${behaviorHTML}
      </div>`;

    card.addEventListener('click', () => openModal(e));
    entityGrid.appendChild(card);
  });
}

/* ══════════════════════════════════
   MODAL
══════════════════════════════════ */

/**
 * @param {object}  entity
 * @param {boolean} pushHistory
 */
function openModal(entity, pushHistory = true) {
  modalContent.innerHTML = '';
  if (activeTab === 'monstres') renderMobSheet(entity);
  else                          renderPNJSheet(entity);

  modalOverlay.classList.add('open');

  if (pushHistory) {
    pushHash(activeTab, entity.id);
  }
}

function _closeModalDOM() {
  modalOverlay.classList.remove('open');
}

function closeModal() {
  _closeModalDOM();
  history.replaceState({ tab: activeTab, entityId: null }, '', `#${activeTab}`);
}

modalCloseBtn.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ── Fiche Monstre ── */
function renderMobSheet(mob) {
  const tc = TYPE_COLORS[mob.type] || { bg:'#333', text:'#aaa', border:'#44444455' };

  const imgContent = mob.img
    ? `<img src="${mob.img}" alt="${mob.name}" onerror="this.style.display='none';this.nextElementSibling.style.display='block'"><span class="mob-img-placeholder" style="display:none">👾</span>`
    : `<span class="mob-img-placeholder">👾</span>`;

  let attacksHTML = '';
  if (mob.attacks && mob.attacks.length > 0) {
    attacksHTML = `
      <div class="mob-section">
        <div class="mob-section-title">Attaques</div>
        <div class="mob-attacks-list">
          ${mob.attacks.map(a => `
            <div class="mob-attack-row">
              <div class="attack-name">${a.name}${a.dmg && a.dmg!=='—' ? ` <span class="attack-dmg">[ ${a.dmg} ]</span>` : ''}</div>
              ${a.desc ? `<div class="attack-desc">${a.desc}</div>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  }

  let lootHTML = '';
  if (mob.loot && mob.loot.length > 0) {
    const rows = mob.loot.map(l => {
      const item  = findItem(l.id);
      const name  = item ? item.name : (l.name || l.id);
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item?.img || item?.image || '';
      const rc    = dropRateColor(l.chance);
      const href  = item ? `../Compendium/compendium.html#${item.id}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img src="${img}" alt="${name}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      return `
        <a class="loot-row" href="${href}" ${!item?'style="pointer-events:none"':''}>
          ${imgPart}
          <span class="loot-name" style="color:${color}">${name}</span>
          ${l.qty ? `<span class="loot-drop-rate" style="color:#888;border-color:#88888833">×${l.qty}</span>` : ''}
          <span class="loot-drop-rate" style="color:${rc};border-color:${rc}33">${l.chance}%</span>
        </a>`;
    }).join('');
    lootHTML = `
      <div class="mob-section">
        <div class="mob-section-title">Butin</div>
        <div class="mob-loot-list">${rows}</div>
      </div>`;
  }

  const loreHTML = mob.lore ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">Lore</div>
      <blockquote class="mob-lore">${mob.lore}</blockquote>
    </div>` : '';

  const bcolor = BEHAVIOR_COLORS[mob.behavior] || '#888';

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:${tc.text};border-color:${tc.border};">
          <div class="mob-image-bg" style="background:${tc.bg};"></div>
          <div class="mob-image-border" style="border-color:${tc.border};"></div>
          <div class="mob-image-inner">${imgContent}</div>
        </div>
        <div class="mob-header-info">
          <div class="mob-name">${mob.name}</div>
          <div class="mob-badge-row">
            <span class="mob-type-badge" style="background:${tc.bg};color:${tc.text};border:1px solid ${tc.border};">${TYPE_LABELS[mob.type]||mob.type}</span>
            <span class="mob-behavior-badge" style="color:${bcolor};border-color:${bcolor}44;">${BEHAVIOR_LABELS[mob.behavior]||mob.behavior}</span>
          </div>
          <div class="mob-meta-row">
            <div class="mob-meta-item">
              <span class="mob-meta-key">Palier</span>
              <span class="mob-meta-val">⬡ ${mob.palier}</span>
            </div>
            <div class="mob-meta-item">
              <span class="mob-meta-key">Difficulté</span>
              <span class="mob-meta-val">
                <span class="difficulty-stars">${diffStarsHTML(mob.difficulty)}</span>
                <span style="font-size:9px;color:var(--muted);margin-left:6px;letter-spacing:.08em">${DIFF_LABELS[mob.difficulty]||''}</span>
              </span>
            </div>
            ${mob.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">
                ${mob.region}
                ${mob.regionId ? `<a class="region-link" href="../Map/map.html#${mob.regionId}">→ Carte</a>` : ''}
              </span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${attacksHTML}
        ${lootHTML}
        ${loreHTML}
      </div>
    </div>`;
}

/* ── Fiche PNJ ── */
function renderPNJSheet(pnj) {
  let sellsHTML = '';
  if (pnj.sells && pnj.sells.length > 0) {
    const rows = pnj.sells.map(s => {
      const item  = findItem(s.id);
      const name  = item ? item.name : s.id;
      const color = item ? getRarityColor(item.rarity) : '#8c8c8c';
      const img   = item?.img || item?.image || '';
      const href  = item ? `../Compendium/compendium.html#${item.id}` : '#';
      const imgPart = img
        ? `<div class="loot-img-wrap"><img src="${img}" alt="${name}" onerror="this.style.display='none'"></div>`
        : `<span class="loot-dot" style="background:${color}"></span>`;
      return `
        <a class="loot-row" href="${href}">
          ${imgPart}
          <span class="loot-name" style="color:${color}">${name}</span>
          ${s.price ? `<span class="loot-drop-rate" style="color:#c9a84c;border-color:#c9a84c33">${s.price} cols</span>`
                    : `<span class="loot-drop-rate" style="color:#888;border-color:#88888833">Craft</span>`}
        </a>`;
    }).join('');
    sellsHTML = `
      <div class="mob-section full-width">
        <div class="mob-section-title">Vend</div>
        <div class="mob-loot-list">${rows}</div>
      </div>`;
  }

  const loreHTML = pnj.lore ? `
    <div class="mob-section full-width">
      <div class="mob-section-title">Description</div>
      <blockquote class="mob-lore">${pnj.lore}</blockquote>
    </div>` : '';

  modalContent.innerHTML = `
    <div class="mob-sheet">
      <div class="mob-header">
        <div class="mob-image-wrap" style="color:#ffd9a0;border-color:#c06c2055;">
          <div class="mob-image-bg" style="background:rgba(100,80,30,.85);"></div>
          <div class="mob-image-border" style="border-color:#c06c2055;"></div>
          <div class="mob-image-inner">
            ${pnj.img ? `<img src="${pnj.img}" alt="${pnj.name}">` : '<span class="mob-img-placeholder">🧑</span>'}
          </div>
        </div>
        <div class="mob-header-info">
          <div class="mob-name">${pnj.name}</div>
          <div class="mob-badge-row">
            <span class="mob-type-badge" style="background:rgba(100,80,30,.85);color:#ffd9a0;border:1px solid #c06c2055;">${pnj.role||'PNJ'}</span>
          </div>
          <div class="mob-meta-row">
            <div class="mob-meta-item">
              <span class="mob-meta-key">Palier</span>
              <span class="mob-meta-val">⬡ ${pnj.palier}</span>
            </div>
            ${pnj.region ? `
            <div class="mob-meta-item">
              <span class="mob-meta-key">Région</span>
              <span class="mob-meta-val">${pnj.region}</span>
            </div>` : ''}
          </div>
        </div>
      </div>
      <div class="mob-body-grid">
        ${sellsHTML}
        ${loreHTML}
      </div>
    </div>`;
}

/* ══════════════════════════════════
   HEADER TITRE
══════════════════════════════════ */
function updateHeader() {
  if (activeTab === 'monstres') {
    mainTitle.textContent    = 'Bestiaire';
    mainSubtitle.textContent = '// MONSTRES · VEILLEURS AU CLAIR DE LUNE';
  } else {
    mainTitle.textContent    = 'Personnages';
    mainSubtitle.textContent = '// PNJ & VENDEURS · VEILLEURS AU CLAIR DE LUNE';
  }
}

/* ══════════════════════════════════
   REFRESH GLOBAL
══════════════════════════════════ */
function refreshAll() {
  updateHeader();
  updateSidebarSections();
  buildPalierFilters();
  updateCounts();
  buildGrid();
}

/* ══════════════════════════════════
   ÉVÉNEMENTS
══════════════════════════════════ */

// Onglets
document.querySelectorAll('.sort-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    activeTab    = btn.dataset.tab;
    activePalier = 'all';
    pushHash(activeTab);
    refreshAll();
  });
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value.trim();
  updateCounts();
  buildGrid();
});

document.querySelectorAll('.type-filter-cb').forEach(cb => {
  cb.addEventListener('change', () => {
    if (cb.checked) activeTypes.add(cb.value);
    else            activeTypes.delete(cb.value);
    updateCounts();
    buildGrid();
  });
});

/* ══════════════════════════════════
   INIT
══════════════════════════════════ */

function setLayout() {
  const header = document.querySelector('.site-header');
  const layout = document.querySelector('.bestiaire-layout');
  if (header && layout) {
    layout.style.top = header.getBoundingClientRect().height + 'px';
  }
}
setLayout();
window.addEventListener('resize', setLayout);

history.replaceState({ tab: activeTab, entityId: null }, '', location.hash || `#${activeTab}`);
refreshAll();
applyHash();