/* ═══════════════════════════════════════════════════════
   DONNÉES — quetes_data.js
   Veilleurs au Clair de Lune
═══════════════════════════════════════════════════════ */

const QUETES = [

  /* ── PRINCIPALES ── */
  //#region Palier 1
  //#region Palier 1 > Quêtes Principale
  {
    id: 'p1_un_nouveau_depart', type: 'main', palier: 1,
    titre: "1 - Un nouveau départ",
    zone: "Ville de Départ",
    npc: 'Abraham',
    desc: 'Commencer votre aventure en prouvant votre force en tuant les sangliers corrompus aux abbords de la Ville de Départ.',
    objectifs: [
      { texte: 'Résolter 12 Peaux de Sanglier'},
      { texte: 'Parler à Abraham'},
    ],
    recompenses: [
      { type: 'exp',   label: '420 XP' },
      { type: 'cols', label: '50 Cols' },
    ],
    statut: 'todo',
  },
  {
    id: 'p1_la_vielle_mara', type: 'main', palier: 1,
    titre: "2 - La Vielle Mara",
    zone: "Hanaka",
    npc: 'Vielle Mara',
    desc: 'Allez à la rencontre de la vielle Mara pour qu\'elle vous parle de ses visions et de l\'arriver de la corruption sur l\'Aincrad.',
    objectifs: [
      { texte: 'Parler à la Vielle Mara'},
    ],
    recompenses: [
      { type: 'exp',   label: '100 XP' },
    ],
    statut: 'todo',
  },
	{
    id: 'p1_la_corruption', type: 'main', palier: 1,
    titre: "3 - La Corruption",
    zone: "Marécage Putride",
    npc: '',
    desc: 'Soyez temoins des visions de la Vielle Mara.',
    objectifs: [
      { texte: 'Trouver la source des visions de Mara'},
    ],
    recompenses: [
      { type: 'exp',   label: '351 XP' },
			{ type: 'items',   label: 'Rune Étrange' },
    ],
    statut: 'todo',
  },
	{
    id: 'p1_revenir_plus_fort', type: 'main', palier: 1,
    titre: "4 - Revenir plus fort",
    zone: "Ville de Départ",
    npc: 'Maître Épéiste',
    desc: 'Après avoir obverser la corruption de vos propres yeux, entrainez vous et parlez en au Maître Épéiste.',
    objectifs: [
      { texte: 'Atteindre le niveau 4'},
			{ texte: 'Parler au Maître Épéiste'},
    ],
    recompenses: [
      { type: 'exp',   label: '200 XP' },
    ],
    statut: 'todo',
  },
	{
    id: 'p1_l_aventure_commence', type: 'main', palier: 1,
    titre: "5 - L'Aventure commence",
    zone: "Mizunari",
    npc: '',
    desc: 'Après avoir rapporter ce que vous avez vu au Maître Épéiste, dirigez vous vers Mizunari afin decontinuer votre périple.',
    objectifs: [
      { texte: 'Aller à Mizunari'},
			{ texte: 'Fabriquer la Clé du Donjon Mine de Geldorak'},
    ],
    recompenses: [
    ],
    statut: 'todo',
  },
	{
    id: 'p1_le_ravage_des_nephentes', type: 'main', palier: 1,
    titre: "6 - Le ravage des Nephentes",
    zone: "Mizunari",
    npc: '',
    desc: 'Elma a perdu son mari, qui pourrait vous être utile afin de contrer la corruption. Allez le retrouver.',
    objectifs: [
      { texte: 'Trouver le Mari d\'Elma'},
			{ texte: 'Sauver Harrold en tuant les Nephentes'},
			{ texte: 'Récupérer des Spores Corrompus'},
			{ texte: 'Parler à Harrold'},
			{ texte: 'Retourner voir le Maître Épéiste'},
    ],
    recompenses: [
    ],
    statut: 'todo',
  },
	//#endregion Palier 1 > Quêtes Principale
	//#region Palier 1 > Quêtes Secondaire
  {
    id: 'quetes_2', type: 'sec', palier: 1,
    titre: "Test",
    zone: "Ville de Départ",
    npc: 'drabiot',
    desc: 'Prouvez votre valeur en traversant la première forêt et en rejoignant le Bastion des Veilleurs.',
    objectifs: [
      { texte: 'Larp'},
      { texte: 'JJK'},
      { texte: "HAhahaa"},
    ],
    recompenses: [
      { type: 'expérience',   label: '420 XP' },
      { type: 'cols', label: '50' },
      { type: 'item', label: 'Insigne de Novice' },
    ],
    statut: 'todo',
  },
	//#endregion Palier 1 > Quêtes Secondaire
	//#endregion Palier 1
	//#region Palier 2
	{
    id: 'quetes_3', type: 'ter', palier: 2,
    titre: "Test",
    zone: "Ville de Départ",
    npc: 'drabiot',
    desc: 'Prouvez votre valeur en traversant la première forêt et en rejoignant le Bastion des Veilleurs.',
    objectifs: [
      { texte: 'Larp'},
      { texte: 'JJK'},
      { texte: "HAhahaa"},
    ],
    recompenses: [
      { type: 'expérience',   label: '420 XP' },
      { type: 'cols', label: '50' },
      { type: 'item', label: 'Insigne de Novice' },
    ],
    statut: 'todo',
  },
	//#endregion Palier 2
]

/* ── Labels ── */
const TYPE_LABELS  = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const TYPE_ICONS   = { main: '🔥', sec: '💬', ter: '❓' };
const STATUT_LABELS = { todo: 'À faire', done: 'Terminée' };
