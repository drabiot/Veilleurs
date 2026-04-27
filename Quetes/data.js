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

function getMapUrl(zone) {
  return zone ? `../Map/map.html` : null;
}

const QUETES = [
  /* Toutes les quêtes sont chargées depuis Firestore (collection 'quetes'). */
];