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

/* ── Couleurs par zone ── */
const ZONE_COLORS_BY_ID   = new Map();
const ZONE_COLORS_BY_NAME = new Map();
const ZONE_META_BY_NAME   = new Map();

function populateZoneColors(regions) {
  ZONE_COLORS_BY_ID.clear();
  ZONE_COLORS_BY_NAME.clear();
  ZONE_META_BY_NAME.clear();
  regions.forEach(r => {
    if (r.name) ZONE_META_BY_NAME.set(r.name, { palier: r.palier ?? 99, ordre: r.ordre ?? 99 });
    if (!r.color) return;
    const c = { color: r.color.color, dim: r.color.dim, glow: r.color.glow };
    if (r.id)   ZONE_COLORS_BY_ID.set(r.id, c);
    if (r.name) ZONE_COLORS_BY_NAME.set(r.name, c);
  });
}

const FALLBACK_ZONE_STYLE = { color: '#888', dim: 'rgba(136,136,136,.3)', glow: 'rgba(136,136,136,.05)' };

function getZoneStyle(zone) {
  return ZONE_COLORS_BY_NAME.get(zone)
      || ZONE_COLORS_BY_ID.get(zone)
      || FALLBACK_ZONE_STYLE;
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