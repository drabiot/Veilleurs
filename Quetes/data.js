/* ══════════════════════════════════════════════════════════════
   DATA — Veilleurs au Clair de Lune
   data.js
   DB_ITEMS est peuplé depuis Firestore dans quetes-loader.js
══════════════════════════════════════════════════════════════ */

/* ── Labels / icônes ── */
const TYPE_LABELS   = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const TYPE_ICONS    = { main: '🔥', sec: '💬', ter: '❓' };
const STATUT_LABELS = { todo: 'À faire', done: 'Terminée' };

/* ── Couleurs de rareté (identique au compendium) ── */
const RARITIES = {
  commun     : { label: 'Commun',     color: '#9d9d9d' },
  rare       : { label: 'Rare',       color: '#0070dd' },
  epique     : { label: 'Épique',     color: '#a335ee' },
  legendaire : { label: 'Légendaire', color: '#ff8000' },
  mythique   : { label: 'Mythique',   color: '#e5cc80' },
  godlike    : { label: 'Godlike',    color: '#e268a8' },
  event      : { label: 'Événement',  color: '#1eff00' },
};
function rarityColor(key) {
  return (RARITIES[key] || { color: '#888' }).color;
}

/* ── DB_ITEMS : tableau global peuplé par quetes-loader.js ── */
/* Chaque item Firestore a au minimum : id, name, rarity, img/image, category */
const DB_ITEMS = [];

/* Lookup rapide par id */
function dbItem(id) {
  return DB_ITEMS.find(i => i.id === id) || null;
}

/* ── Couleurs par zone ── */
const ZONE_COLORS = {
  'Ville de Départ'   : { color: '#e0a050', dim: 'rgba(224,160,80,.35)',  glow: 'rgba(224,160,80,.08)'  },
  'Forêt Ombreuse'    : { color: '#82c470', dim: 'rgba(130,196,112,.35)', glow: 'rgba(130,196,112,.08)' },
  'Marais de Kaëlth'  : { color: '#6aaad4', dim: 'rgba(106,170,212,.35)', glow: 'rgba(106,170,212,.08)' },
  'Plaines Grises'    : { color: '#b0a8c0', dim: 'rgba(176,168,192,.35)', glow: 'rgba(176,168,192,.08)' },
  'Mines de Cendres'  : { color: '#e07c50', dim: 'rgba(224,124,80,.35)',  glow: 'rgba(224,124,80,.08)'  },
  'Citadelle Lunaire' : { color: '#c0a0dc', dim: 'rgba(192,160,220,.35)', glow: 'rgba(192,160,220,.08)' },
};
function getZoneStyle(zone) {
  return ZONE_COLORS[zone] || { color: '#888', dim: 'rgba(136,136,136,.3)', glow: 'rgba(136,136,136,.05)' };
}

/* ── URLs carte ── */
const ZONE_MAP_URLS = {
  'Ville de Départ'   : '../Map/map.html?zone=ville-depart',
  'Forêt Ombreuse'    : '../Map/map.html?zone=foret-ombreuse',
  'Marais de Kaëlth'  : '../Map/map.html?zone=marais-kaelth',
  'Plaines Grises'    : '../Map/map.html?zone=plaines-grises',
  'Mines de Cendres'  : '../Map/map.html?zone=mines-cendres',
  'Citadelle Lunaire' : '../Map/map.html?zone=citadelle-lunaire',
};

/* ══════════════════════════════════
   QUÊTES
   objectifs :
     - { texte, items? }         → objectif simple
     - [ {texte}, ... ]          → séquence (étapes groupées)
   items dans un objectif :
     - [ { id: 'firestore_id', qte: N } ]
   recompenses :
     - { type:'exp'|'cols'|'items', label, itemId? }
══════════════════════════════════ */
const QUETES = [

  /* ─── PRINCIPALES ─── */
  {
    id: 'p1_un_nouveau_depart',
    type: 'main', palier: 1,
    titre: '1 - Un Nouveau Départ',
    zone: 'Ville de Départ',
    npc: 'Abraham',
    desc: 'Prouvez votre force en éliminant les sangliers corrompus aux abords de la Ville de Départ et rapportez leurs peaux à Abraham.',
    objectifs: [
      { texte: 'Récolter 12 Peaux de Sanglier', items: [{ id: 'peau_de_sanglier', qte: 12 }] },
      { texte: 'Parler à Abraham' },
    ],
    recompenses: [
      { type: 'exp',  label: '420 XP' },
      { type: 'cols', label: '50 Cols' },
    ],
    statut: 'todo',
  },

  {
    id: 'p1_la_menace_des_ombres',
    type: 'main', palier: 1,
    titre: '2 - La Menace des Ombres',
    zone: 'Forêt Ombreuse',
    npc: 'Séraphine',
    desc: "Une présence maléfique s'est installée dans la Forêt Ombreuse. Séraphine vous demande d'enquêter et d'éliminer la source.",
    objectifs: [
      [
        { texte: "Trouver les traces d'ombre dans la forêt" },
        { texte: "Suivre les traces jusqu'à la clairière maudite" },
      ],
      { texte: 'Éliminer 6 Loups des Ombres', items: [{ id: 'dent_loup', qte: 6 }] },
      { texte: 'Rapporter à Séraphine' },
    ],
    recompenses: [
      { type: 'exp',   label: '780 XP' },
      { type: 'cols',  label: '120 Cols' },
      { type: 'items', label: 'Amulette du Voyageur', itemId: null },
    ],
    statut: 'todo',
  },

  {
    id: 'p2_le_sceau_brise',
    type: 'main', palier: 2,
    titre: '3 - Le Sceau Brisé',
    zone: 'Marais de Kaëlth',
    npc: 'Veilleur Aldric',
    desc: "Le sceau qui retenait les esprits du marais s'est brisé. Collectez les cristaux vaseux pour recréer le rituel de fermeture.",
    objectifs: [
      { texte: 'Collecter 8 Cristaux Vaseux', items: [{ id: 'cristal_vase', qte: 8 }] },
      [
        { texte: "Trouver l'autel ancien au centre du marais" },
        { texte: "Placer les cristaux sur l'autel" },
        { texte: "Réciter l'incantation du Veilleur" },
      ],
      { texte: 'Retourner voir Aldric' },
    ],
    recompenses: [
      { type: 'exp',   label: '1 200 XP' },
      { type: 'cols',  label: '200 Cols' },
      { type: 'items', label: 'Rune de Liaison', itemId: 'rune_oubliee' },
    ],
    statut: 'todo',
  },

  {
    id: 'p2_les_mines_maudites',
    type: 'main', palier: 2,
    titre: '4 - Les Mines Maudites',
    zone: 'Mines de Cendres',
    npc: 'Forgeron Grunth',
    desc: "Les mines de cendres ont été envahies par des créatures nées des profondeurs. Le Forgeron Grunth a besoin de fragments d'obsidienne pour forger une arme.",
    objectifs: [
      { texte: "Extraire 15 Fragments d'Obsidienne", items: [{ id: 'fragment_obsidienne', qte: 15 }] },
      { texte: "Récolter 5 Cendres d'Âme",           items: [{ id: 'cendre_ame',          qte: 5  }] },
      { texte: 'Apporter les matériaux à Grunth' },
      [
        { texte: "Attendre que l'arme soit forgée (voyage rapide autorisé)" },
        { texte: "Récupérer l'arme forgée" },
      ],
    ],
    recompenses: [
      { type: 'exp',   label: '1 500 XP' },
      { type: 'cols',  label: '250 Cols' },
      { type: 'items', label: 'Marteau de Cendres', itemId: null },
    ],
    statut: 'todo',
  },

  /* ─── SECONDAIRES ─── */
  {
    id: 's1_herboriste_en_danger',
    type: 'sec', palier: 1,
    titre: "L'Herboriste en Détresse",
    zone: 'Plaines Grises',
    npc: 'Mireille',
    desc: "Mireille a épuisé ses réserves d'herbes médicinales. Elle vous demande d'en récolter dans les plaines avant que ses patients ne souffrent.",
    objectifs: [
      { texte: 'Récolter 10 Herbes de Lumière', items: [{ id: 'herbe_lumiere', qte: 10 }] },
      { texte: 'Rapporter à Mireille' },
    ],
    recompenses: [
      { type: 'exp',   label: '320 XP' },
      { type: 'cols',  label: '40 Cols' },
      { type: 'items', label: '3× Potion Mineure', itemId: 'potion_mineur' },
    ],
    statut: 'todo',
  },

  {
    id: 's1_le_bois_tordu',
    type: 'sec', palier: 1,
    titre: 'Le Bois Tordu',
    zone: 'Forêt Ombreuse',
    npc: 'Charpentier Olen',
    desc: "Olen recherche du bois tordu, que l'on ne trouve qu'au cœur de la forêt corrompue.",
    objectifs: [
      { texte: 'Collecter 8 Bois Tordu',          items: [{ id: 'bois_tordu', qte: 8 }] },
      { texte: 'Éviter ou éliminer les gardes-arbres (×3)' },
      { texte: 'Livrer le bois à Olen' },
    ],
    recompenses: [
      { type: 'exp',  label: '280 XP' },
      { type: 'cols', label: '60 Cols' },
    ],
    statut: 'done',
  },

  {
    id: 's2_les_ravens',
    type: 'sec', palier: 2,
    titre: 'Les Corbeaux du Crépuscule',
    zone: 'Citadelle Lunaire',
    npc: 'Archiviste Noa',
    desc: 'Noa étudie les corbeaux qui nichent dans les tours de la Citadelle. Elle a besoin de plumes intactes pour ses recherches sur la magie lunaire.',
    objectifs: [
      { texte: 'Obtenir 5 Plumes de Corbeau', items: [{ id: 'plume_corbeau', qte: 5 }] },
      [
        { texte: 'Observer les corbeaux au coucher de lune' },
        { texte: 'Noter leurs patterns dans le journal de Noa' },
      ],
      { texte: 'Remettre les plumes et le journal à Noa' },
    ],
    recompenses: [
      { type: 'exp',   label: '560 XP' },
      { type: 'cols',  label: '80 Cols' },
      { type: 'items', label: 'Rune Oubliée', itemId: 'rune_oubliee' },
    ],
    statut: 'todo',
  },

  /* ─── TERTIAIRES ─── */
  {
    id: 't1_le_chasseur',
    type: 'ter', palier: 1,
    titre: 'Le Vieux Chasseur',
    zone: 'Forêt Ombreuse',
    npc: 'Vieux Bram',
    desc: 'Bram ne peut plus chasser à cause de sa jambe. Il vous demande simplement de lui ramener quelque chose à manger.',
    objectifs: [
      { texte: 'Rapporter 3 Peaux de Sanglier à Bram', items: [{ id: 'peau_sanglier', qte: 3 }] },
    ],
    recompenses: [
      { type: 'exp',  label: '80 XP' },
      { type: 'cols', label: '15 Cols' },
    ],
    statut: 'todo',
  },

  {
    id: 't1_la_potion_perdue',
    type: 'ter', palier: 1,
    titre: 'La Potion Perdue',
    zone: 'Ville de Départ',
    npc: 'Petit Léo',
    desc: 'Léo a perdu la potion de sa mère quelque part dans la ville. Il pleure. Peut-être pouvez-vous l\'aider ?',
    objectifs: [
      { texte: 'Trouver la Potion Mineure perdue (fouiller le marché)' },
      { texte: 'Rendre la potion à Léo' },
    ],
    recompenses: [
      { type: 'exp',  label: '50 XP' },
      { type: 'cols', label: '5 Cols' },
    ],
    statut: 'done',
  },

  {
    id: 't2_runes_oubliees',
    type: 'ter', palier: 2,
    titre: 'Runes Oubliées',
    zone: 'Marais de Kaëlth',
    npc: 'Esprit Errant',
    desc: 'Un esprit errant dans le marais vous supplie de retrouver ses runes perdues, dispersées lors d\'une ancienne bataille.',
    objectifs: [
      { texte: 'Trouver 3 Runes Oubliées dispersées dans le marais', items: [{ id: 'rune_oubliee', qte: 3 }] },
      { texte: "Les remettre à l'esprit" },
    ],
    recompenses: [
      { type: 'exp',   label: '200 XP' },
      { type: 'items', label: 'Potion Mineure ×2', itemId: 'potion_mineur' },
    ],
    statut: 'todo',
  },

];