/* ══════════════════════════════════════════════════════════════
   DATA — Veilleurs au Clair de Lune
   data.js
══════════════════════════════════════════════════════════════ */

/* ── Labels / icônes ── */
const TYPE_LABELS   = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const TYPE_ICONS    = { main: '🔥', sec: '💬', ter: '❓' };

/* ── Couleurs de rareté ── */
const RARITIES = {
  'commun':     { label: 'Commun',      color: '#59d059' },
  'rare':       { label: 'Rare',        color: '#2a5fa8' },
  'epique':     { label: 'Épique',      color: '#6a3daa' },
  'legendaire': { label: 'Légendaire',  color: '#d7af5f' },
  'mythique':   { label: 'Mythique',    color: '#f5b5e4' },
  'godlike':    { label: 'Godlike',     color: '#a83020' },
	'event':    	{ label: 'Event',     	color: '#ebebeb' },
};
function rarityColor(key) {
  return (RARITIES[key] || { color: '#888' }).color;
}

/* ── DB_ITEMS peuplé par quetes-loader.js depuis Firestore ── */
const DB_ITEMS = [];
function dbItem(id) { return DB_ITEMS.find(i => i.id === id) || null; }

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

function getMapUrl(mapId) {
  if (!mapId) return null;
  return `../Map/map.html#${mapId}`;
}

const QUETES = [

  /* ─── PRINCIPALES ─── */
  {
    id: 'p1_un_nouveau_depart',
    type: 'main', palier: 1,
    titre: '1 - Un Nouveau Départ',
    zone: 'Ville de Départ',
    mapId: 'm1p1',
    npc: 'Abraham',
    desc: "Prouvez votre force en éliminant les sangliers corrompus aux abords de la Ville de Départ et rapportez leurs peaux à Abraham.",
    objectifs: [
      { texte: 'Récolter des Peaux de Sanglier', items: [{ id: 'peau_de_sanglier', qte: 12 }] },
      { texte: 'Parler à Abraham (1808, 3650)' },
    ],
    recompenses: [
      { type: 'exp',  xp: 50 },
      { type: 'cols', cols: 90 },
    ],
  },

  {
    id: 'p1_la_vielle_mara',
    type: 'main', palier: 1,
    titre: '2 - La vielle Mara',
    zone: 'Hanaka',
    mapId: 'm1p2',
    npc: 'Vielle Mara',
    desc: "Après avoir fait vos preuves auprés Maître Épéiste, il vous dira d'aller à la rencontre de la vielle Mara, afin qu'elle vous parle de ses visions.",
    objectifs: [
      { texte: "Parler à la vielle Mara (1562, 3410)" },
    ],
    recompenses: [
      { type: 'exp',   xp: 100 },
    ],
  },

  /* ─── SECONDAIRES ─── */
  {
    id: 'p1_lila',
    type: 'sec', palier: 1,
    titre: "Lila",
    zone: 'Ville de Départ',
    mapId: 'm1s2',
    npc: 'Lila',
    desc: "...",
    objectifs: [
      { texte: 'Donner', items: [{ id: 'coeur_de_bois', qte: 1 }] },
    ],
    recompenses: [
      { type: 'exp',   xp: 292 },
      { type: 'cols',  cols: 150 },
    ],
  },
  {
    id: 'p1_tilda',
    type: 'sec', palier: 1,
    titre: "Tilda",
    zone: 'Ville de Départ',
    mapId: 'm1s1',
    npc: 'Tilda',
    desc: "...",
    objectifs: [
      { texte: 'Donner', items: [{ id: 'arc_courbe', qte: 1 }] },
    ],
    recompenses: [
      { type: 'exp',   xp: 291 },
      { type: 'cols',  cols: 200 },
    ],
  },

  /* ─── TERTIAIRES ─── */

];