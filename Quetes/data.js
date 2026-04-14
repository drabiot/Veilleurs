/* ══════════════════════════════════════════════════════════════
   DATA — Veilleurs au Clair de Lune
   data.js
══════════════════════════════════════════════════════════════ */

/* ── Labels / icônes ── */
const TYPE_LABELS   = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const TYPE_ICONS    = { main: '🔥', sec: '💬', ter: '❓' };

/* RARITIES + rarityColor → définis dans /utils.js (source unique) */
const rarityColor = getRarityColor;

/* ── DB_ITEMS peuplé depuis Firestore par le module inline de quetes.html ── */
const DB_ITEMS = [];
let _dbItemsIndex = null;
let _dbItemsIndexSize = -1;
function dbItem(id) {
  if (!_dbItemsIndex || _dbItemsIndexSize !== DB_ITEMS.length) {
    _dbItemsIndex = new Map(DB_ITEMS.map(i => [i.id, i]));
    _dbItemsIndexSize = DB_ITEMS.length;
  }
  return _dbItemsIndex.get(id) || null;
}

/* ── DB_MOBS peuplé depuis Firestore par le module inline de quetes.html ── */
const DB_MOBS = [];
let _dbMobsIndex = null;
let _dbMobsIndexSize = -1;
function dbMob(id) {
  if (!_dbMobsIndex || _dbMobsIndexSize !== DB_MOBS.length) {
    _dbMobsIndex = new Map(DB_MOBS.map(m => [m.id, m]));
    _dbMobsIndexSize = DB_MOBS.length;
  }
  return _dbMobsIndex.get(id) || null;
}

/* ── Helpers images (champ canonique : images[]) ── */
function getItemImages(item) {
  if (item.images && item.images.length) return item.images;
  if (item.image) return [item.image];
  if (item.img)   return [item.img];
  return [];
}
function getItemImg(item) {
  const imgs = getItemImages(item);
  return imgs.length ? imgs[0] : null;
}

/* ── Couleurs par zone (régions du palier 1) ── */
const ZONE_COLORS = {
  'Ville de Départ'         : { color: '#e0a050', dim: 'rgba(224,160,80,.35)',  glow: 'rgba(224,160,80,.08)'  },
  'Hanaka'                  : { color: '#82c470', dim: 'rgba(130,196,112,.35)', glow: 'rgba(130,196,112,.08)' },
  'Vallée des Loups'        : { color: '#a0b8d0', dim: 'rgba(160,184,208,.35)', glow: 'rgba(160,184,208,.08)' },
  'Marécage Putride'        : { color: '#6aaad4', dim: 'rgba(106,170,212,.35)', glow: 'rgba(106,170,212,.08)' },
  'Zone des Sangliers'      : { color: '#b87040', dim: 'rgba(184,112,64,.35)',  glow: 'rgba(184,112,64,.08)'  },
  'Vallée des Pétales'      : { color: '#e080b0', dim: 'rgba(224,128,176,.35)', glow: 'rgba(224,128,176,.08)' },
  'Château Abandonné'       : { color: '#b0a8c0', dim: 'rgba(176,168,192,.35)', glow: 'rgba(176,168,192,.08)' },
  'Mizunari'                : { color: '#70c8a0', dim: 'rgba(112,200,160,.35)', glow: 'rgba(112,200,160,.08)' },
  "Archipel d'Ika"          : { color: '#40c0e0', dim: 'rgba(64,192,224,.35)',  glow: 'rgba(64,192,224,.08)'  },
  'Quartier OG'             : { color: '#d06060', dim: 'rgba(208,96,96,.35)',   glow: 'rgba(208,96,96,.08)'   },
  'Cyclorim'                : { color: '#e07c50', dim: 'rgba(224,124,80,.35)',  glow: 'rgba(224,124,80,.08)'  },
  'Mine de Geldorak'        : { color: '#a08060', dim: 'rgba(160,128,96,.35)',  glow: 'rgba(160,128,96,.08)'  },
  'CastelBrume'             : { color: '#8090b0', dim: 'rgba(128,144,176,.35)', glow: 'rgba(128,144,176,.08)' },
  'Vallhat'                 : { color: '#c0b060', dim: 'rgba(192,176,96,.35)',  glow: 'rgba(192,176,96,.08)'  },
  'Citadelle des Neiges'    : { color: '#c0d8f0', dim: 'rgba(192,216,240,.35)', glow: 'rgba(192,216,240,.08)' },
  'Jardin des Géants'       : { color: '#60c060', dim: 'rgba(96,192,96,.35)',   glow: 'rgba(96,192,96,.08)'   },
  'Le Lac des Nénuphars'    : { color: '#4090d0', dim: 'rgba(64,144,208,.35)',  glow: 'rgba(64,144,208,.08)'  },
  'Tolbana'                 : { color: '#d0a030', dim: 'rgba(208,160,48,.35)',  glow: 'rgba(208,160,48,.08)'  },
  'Virelune'                : { color: '#7060c0', dim: 'rgba(112,96,192,.35)',  glow: 'rgba(112,96,192,.08)'  },
  'Candelia'                : { color: '#e0c080', dim: 'rgba(224,192,128,.35)', glow: 'rgba(224,192,128,.08)' },
  'Tour du Kobold'          : { color: '#906060', dim: 'rgba(144,96,96,.35)',   glow: 'rgba(144,96,96,.08)'   },
  'Mine de Pic de Cristal'  : { color: '#80c0e0', dim: 'rgba(128,192,224,.35)', glow: 'rgba(128,192,224,.08)' },
  'Cristal de Tolbana'      : { color: '#90d0f0', dim: 'rgba(144,208,240,.35)', glow: 'rgba(144,208,240,.08)' },
  "Arakh'Nol"               : { color: '#805070', dim: 'rgba(128,80,112,.35)',  glow: 'rgba(128,80,112,.08)'  },
  'Guilde Marchande'        : { color: '#d0b040', dim: 'rgba(208,176,64,.35)',  glow: 'rgba(208,176,64,.08)'  },
};
function getZoneStyle(zone) {
  return ZONE_COLORS[zone] || { color: '#888', dim: 'rgba(136,136,136,.3)', glow: 'rgba(136,136,136,.05)' };
}

/* ── Correspondance zone → ancre carte ── */
const ZONE_MAP_IDS = {
  'Ville de Départ'         : 'm1r1',
  'Hanaka'                  : 'm1r2',
  'Vallée des Loups'        : 'm1r3',
  'Marécage Putride'        : 'm1r4',
  'Zone des Sangliers'      : 'm1r5',
  'Vallée des Pétales'      : 'm1r6',
  'Château Abandonné'       : 'm1r7',
  'Mizunari'                : 'm1r8',
  "Archipel d'Ika"          : 'm1r9',
  'Quartier OG'             : 'm1r10',
  'Cyclorim'                : 'm1r11',
  'Mine de Geldorak'        : 'm1r12',
  'CastelBrume'             : 'm1r13',
  'Vallhat'                 : 'm1r14',
  'Citadelle des Neiges'    : 'm1r15',
  'Jardin des Géants'       : 'm1r16',
  'Le Lac des Nénuphars'    : 'm1r17',
  'Tolbana'                 : 'm1r18',
  'Virelune'                : 'm1r20',
  'Candelia'                : 'm1r21',
  'Tour du Kobold'          : 'm1r22',
  'Mine de Pic de Cristal'  : 'm1r23',
  'Cristal de Tolbana'      : 'm1r24',
  "Arakh'Nol"               : 'm1r25',
  'Guilde Marchande'        : 'm1r26',
};

function getMapUrl(mapId, zone) {
  const id = mapId || (zone && ZONE_MAP_IDS[zone]);
  if (!id) return null;
  return `../Map/map.html#${id}`;
}

const QUETES = [
  /* Toutes les quêtes sont chargées depuis Firestore (collection 'quetes'). */
];