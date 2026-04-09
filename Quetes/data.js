/* ═══════════════════════════════════════════════════════
   DONNÉES — quetes_data.js
   Veilleurs au Clair de Lune
═══════════════════════════════════════════════════════ */

const QUETES = [

  /* ── PRINCIPALES ── */
  {
    id: 'quetes_1', type: 'main', palier: 1,
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
]

/* ── Labels ── */
const TYPE_LABELS  = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const TYPE_ICONS   = { main: '🔥', sec: '💬', ter: '❓' };
const STATUT_LABELS = { todo: 'À faire', done: 'Terminée' };
