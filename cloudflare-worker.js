// ══════════════════════════════════════════════════════════════
//  VCL Discord Bot — Cloudflare Worker
//  Handles two concerns:
//    1. Discord slash commands (/wiki) via Interactions Endpoint
//    2. Admin Discord proxy (existing — post_thread, delete_thread, etc.)
//
//  Env vars to add in Cloudflare dashboard:
//    DISCORD_PUBLIC_KEY  → Discord Dev Portal → App → General Info → Public Key
//    BOT_TOKEN           → already set
//    ADMIN_SECRET        → already set
// ══════════════════════════════════════════════════════════════

// ── Project constants ──────────────────────────────────────────
const PROJECT_ID     = 'veilleurs-a13b3';
const FIREBASE_KEY   = 'AIzaSyBdeKmmEFxmGt7_37PF9uWhm5nz-6eaKq0';
const WIKI_PAGES     = 'https://drabiot.github.io/Veilleurs';
const USERS_CRON = '7 */6 * * *'; // recopie des comptes Firestore → D1 (voir wrangler.toml)
const WIKI_COMMAND_ENABLED = false; // commande Discord /wiki (lit Firestore à chaque recherche)
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

// ── Sources d'obtention prédéfinies ([obtain:id]) — relues depuis Compendium/data.js ──
let OBTAIN_TEXTS = null;
async function loadObtainTexts() {
  if (OBTAIN_TEXTS) return;
  OBTAIN_TEXTS = {};
  try {
    const src = await (await fetch(`${WIKI_PAGES}/Compendium/data.js`)).text();
    const m = src.match(/const OBTAIN_TEXTS = (\{[\s\S]*?\n\});/);
    if (m) OBTAIN_TEXTS = JSON.parse(m[1].replace(/,(\s*\})/, '$1'));
  } catch {}
}
function resolveObtain(str) {
  return String(str).replace(/\[obtain:([\w-]+)\]/g, (_, id) => (OBTAIN_TEXTS && OBTAIN_TEXTS[id]) || id)
    .replace(/(Obtenable pendant l'Event )\[([^\]]+)\]/g, '$1$2')
    .replace(/^Autre source — /gm, '');
}

// ── Rarity colors (hex integers for Discord embeds) ───────────
const RARITY_COLORS = {
  commun:     0x59d059, rare:       0x2a5fa8,
  epique:     0x6a3daa, legendaire: 0xd7af5f,
  mythique:   0xf5b5e4, godlike:    0xa83020,
  event:      0xebebeb,
};
const RARITY_LABELS = {
  commun: 'Commun', rare: 'Rare', epique: 'Épique',
  legendaire: 'Légendaire', mythique: 'Mythique', godlike: 'Godlike', event: 'Event',
};


const CATEGORIES = {
  armure: { label: 'Armures', emoji: '🛡️' }, arme: { label: 'Armes', emoji: '⚔️' },
  accessoire: { label: 'Accessoires', emoji: '💍' }, rune: { label: 'Runes', emoji: '🔮' },
  outils: { label: 'Outils', emoji: '🛠️' }, nourriture: { label: 'Nourriture', emoji: '🍖' },
  consommable: { label: 'Consommables', emoji: '🧪' }, materiaux: { label: 'Matériaux', emoji: '🧱' },
  quete: { label: 'Objets de Quête', emoji: '📜' }, ressources: { label: 'Ressources', emoji: '⛏️' },
  donjon: { label: 'Donjon', emoji: '🏰' }, monnaie: { label: 'Monnaie', emoji: '🪙' },
};

const STAT_MAP = {
  degats: { label: 'Dégâts', unit: '' }, degats_physique: { label: 'Dég. Physique', unit: '%' },
  degats_arme: { label: 'Dég. d\'Arme', unit: '%' }, degats_magique: { label: 'Dég. Magiques', unit: '%' },
  degats_competence: { label: 'Dég. Compétence', unit: '%' }, degats_projectile: { label: 'Dég. Projectile', unit: '%' },
  vitesse_attaque: { label: 'Vitesse Attaque', unit: '' }, crit_chance: { label: 'Chance Critique', unit: '%' },
  crit_degats: { label: 'Dégâts Critique', unit: '%' }, crit_comp_chance: { label: 'Crit. Compétence', unit: '%' },
  crit_comp_degats: { label: 'Dég. Crit. Comp.', unit: '%' }, defense: { label: 'Défense', unit: '' },
  blocage: { label: 'Blocage', unit: '%' },  maitrise_bloc: { label: 'Maîtrise Blocage', unit: '%' }, puissance_bloc: { label: 'Puissance Bloc', unit: '%' },
  sante: { label: 'Santé', unit: '' }, esquive: { label: 'Esquive', unit: '%' },
  reduction_degats: { label: 'Réduction Dégâts', unit: '%' }, tenacite: { label: 'Ténacité', unit: '%' },
  hate: { label: 'Hâte', unit: '%' }, vitesse_deplacement: { label: 'Vitesse Déplacement', unit: '%' },
  mana: { label: 'Mana', unit: '' }, stamina: { label: 'Stamina', unit: '' },
  vol_vie: { label: 'Vol de Vie', unit: '%' }, omnivamp: { label: 'Vampirisme de sort', unit: '%' },
  regen_sante: { label: 'Régén. Santé', unit: '/s' }, regen_mana: { label: 'Régén. Mana', unit: '/s' },
  regen_stamina: { label: 'Régén. Stamina', unit: '/s' }, soin_bonus: { label: 'Soin Bonus', unit: '' },
};

const MOB_TYPE_LABELS = { boss: 'Boss', mini_boss: 'Mini-Boss', monstre: 'Monstre', sbire: 'Sbire' };
const MOB_TYPE_COLORS = { boss: 0xB42828, mini_boss: 0xD45F3C, monstre: 0xA05014, sbire: 0x323246 };
const MOB_BEHAVIOR_LABELS = { passif: 'Passif', neutre: 'Neutre', agressif: 'Agressif' };
const MOB_DIFF_LABELS = ['', 'Très facile', 'Facile', 'Moyen', 'Difficile', 'Très difficile'];
const QUEST_TYPE_LABELS = { main: 'Principale', sec: 'Secondaire', ter: 'Tertiaire' };
const QUEST_TYPE_ICONS  = { main: '🔥', sec: '💬', ter: '❓' };
const QUEST_TYPE_COLORS = { main: 0xE06030, sec: 0x5899E0, ter: 0x888888 };


// ══════════════════════════════════════════════════════════════
//  IN-MEMORY CACHE (survives across requests in same isolate)
// ══════════════════════════════════════════════════════════════

const _mem = new Map(); // key → { data, ts }
const MEM_TTL = 5 * 60 * 1000;

function memGet(key) {
  const e = _mem.get(key);
  if (!e) return null;
  if (Date.now() - e.ts > MEM_TTL) { _mem.delete(key); return null; }
  return e.data;
}
function memSet(key, data) { _mem.set(key, { data, ts: Date.now() }); }


// ══════════════════════════════════════════════════════════════
//  FIRESTORE REST API
// ══════════════════════════════════════════════════════════════

function parseValue(v) {
  if (!v || typeof v !== 'object') return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('integerValue' in v) return Number(v.integerValue);
  if ('doubleValue'  in v) return Number(v.doubleValue);
  if ('booleanValue' in v) return v.booleanValue;
  if ('nullValue'    in v) return null;
  if ('arrayValue'   in v) return (v.arrayValue.values || []).map(parseValue);
  if ('mapValue' in v) {
    const fields = v.mapValue.fields || {};
    const keys = Object.keys(fields);
    // Desanitize: {min, max} → [min, max]
    if (keys.length === 2 && 'min' in fields && 'max' in fields) {
      const mn = parseValue(fields.min), mx = parseValue(fields.max);
      if (typeof mn === 'number' && typeof mx === 'number') return [mn, mx];
    }
    // Desanitize: {"0":…,"1":…} → array
    if (keys.length > 0 && keys.every((k, i) => k === String(i)))
      return keys.map(k => parseValue(fields[k]));
    const obj = {};
    for (const [k, val] of Object.entries(fields)) obj[k] = parseValue(val);
    return obj;
  }
  return null;
}

function parseDoc(doc) {
  const obj = { _id: doc.name.split('/').pop() };
  for (const [k, v] of Object.entries(doc.fields || {})) obj[k] = parseValue(v);
  return obj;
}

async function fetchCollection(colName) {
  const memKey = `col:${colName}`;
  const hit = memGet(memKey);
  if (hit) return hit;

  const docs = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${colName}?key=${FIREBASE_KEY}&pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.documents) docs.push(...data.documents.map(parseDoc));
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  memSet(memKey, docs);
  return docs;
}

const KV_TTL = 6 * 60 * 60; // 6h en secondes

async function fetchSearchIndex(colName, env) {
  const kvKey  = `idx:${colName}`;
  const memKey = `idx:${colName}`;

  // L1 : mémoire isolate
  const memHit = memGet(memKey);
  if (memHit) return memHit;

  // L2 : KV persistant
  if (env?.WIKI_CACHE) {
    const kvHit = await env.WIKI_CACHE.get(kvKey);
    if (kvHit) {
      const docs = JSON.parse(kvHit);
      memSet(memKey, docs);
      return docs;
    }
  }

  // L3 : Firestore
  const docs = [];
  let pageToken = null;
  do {
    const url = `${FIRESTORE_BASE}/${colName}?key=${FIREBASE_KEY}&pageSize=300&mask.fieldPaths=name${pageToken ? `&pageToken=${pageToken}` : ''}`;
    const r = await fetch(url);
    const data = await r.json();
    if (data.documents) {
      docs.push(...data.documents.map(d => ({
        _id: d.name.split('/').pop(),
        name: d.fields?.name ? parseValue(d.fields.name) : null,
      })));
    }
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  memSet(memKey, docs);
  if (env?.WIKI_CACHE) {
    env.WIKI_CACHE.put(kvKey, JSON.stringify(docs), { expirationTtl: KV_TTL });
  }
  return docs;
}


// ══════════════════════════════════════════════════════════════
//  SEARCH
// ══════════════════════════════════════════════════════════════

function normalize(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function editDist(a, b) {
  if (Math.abs(a.length - b.length) > 4) return 99;
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    [i, ...Array(b.length).fill(0)]
  );
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

function fuzzyMatch(query, target) {
  const nq = normalize(query).replace(/\s+/g, ' ').trim();
  const nt = normalize(target).replace(/\s+/g, ' ').trim();
  if (!nq) return true;
  if (nt.includes(nq)) return true;
  const tokens = nq.split(' ').filter(t => t.length >= 2);
  if (!tokens.length) return false;
  const words = nt.split(' ');
  return tokens.every(t =>
    nt.includes(t) || words.some(w => editDist(t, w) <= (t.length <= 5 ? 1 : t.length <= 8 ? 2 : 3))
  );
}

function withTimeout(promise, ms) {
  return Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(null), ms))]);
}

async function searchAll(query, categorie = null, env = null) {
  if (!query || query.trim().length < 1) return [];

  const allCols = [
    { col: 'items',       type: 'item'   },
    { col: 'mobs',        type: 'mob'    },
    { col: 'personnages', type: 'pnj'    },
    { col: 'quetes',      type: 'quete'  },
    { col: 'regions',     type: 'zone'   },
    { col: 'donjons',     type: 'donjon' },
  ];

  const cols = categorie ? allCols.filter(c => c.type === categorie) : allCols;

  const settled = await Promise.allSettled(
    cols.map(({ col }) => withTimeout(fetchSearchIndex(col, env), 2400))
  );

  const results = [];
  settled.forEach((res, i) => {
    const docs = res.status === 'fulfilled' && res.value ? res.value : [];
    const { type } = cols[i];
    docs.forEach(item => {
      if (item.name && item._id && fuzzyMatch(query, item.name))
        results.push({ name: item.name.slice(0, 100), value: `${type}:${item._id}`.slice(0, 100) });
    });
  });

  return results.slice(0, 25);
}

async function getById(type, docId) {
  const colMap = {
    item: 'items', mob: 'mobs', pnj: 'personnages',
    quete: 'quetes', zone: 'regions', donjon: 'donjons',
  };
  const col = colMap[type];
  if (!col) return null;
  // Direct single-document GET — O(1), no collection scan
  const url = `${FIRESTORE_BASE}/${col}/${encodeURIComponent(docId)}?key=${FIREBASE_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const doc = await r.json();
  if (!doc.fields) return null;
  return parseDoc(doc);
}


// ══════════════════════════════════════════════════════════════
//  EMBED BUILDERS
// ══════════════════════════════════════════════════════════════

function resolveImageUrl(item) {
  const fix = p => WIKI_PAGES + '/' + String(p || '').replace(/^\.\.\//, '');
  if (item.images?.length) return fix(item.images[0]);
  if (item.image) return fix(item.image);
  if (item.img)   return fix(item.img);
  const id  = item.id;
  const cat = item.category || item.cat;
  if (!id || !cat) return null;
  const tier = (item.event || (item.palier === 0 || item.palier === 'event')) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  const base = WIKI_PAGES + '/img/compendium/textures/';
  const MAP  = {
    arme: base + 'weapons/' + tp + id + '.png', armure: base + 'armors/' + tp + id + '.png',
    accessoire: base + 'trinkets/' + tp + id + '.png', outils: base + 'gears/' + tp + id + '.png',
    rune: base + 'items/Runes/' + tp + id + '.png', materiaux: base + 'items/Material/' + tp + id + '.png',
    ressources: base + 'items/Ressources/' + tp + id + '.png',
    consommable: base + 'items/Consommable/' + tp + id + '.png',
    nourriture: base + 'items/Nourriture/' + tp + id + '.png',
  };
  return MAP[cat] || null;
}

function formatStatValue(val, unit) {
  if (Array.isArray(val)) {
    return val[0] === val[1] ? `${val[0]}${unit}` : `${val[0]}–${val[1]}${unit}`;
  }
  return `${val}${unit}`;
}

function buildItemEmbed(item) {
  const rarity  = item.rarity || 'commun';
  const color   = RARITY_COLORS[rarity] || 0x888888;
  const catInfo = CATEGORIES[item.category] || { label: item.category || '?', emoji: '' };
  const imgUrl  = resolveImageUrl(item);
  const isEvent = item.event || (item.palier === 0 || item.palier === 'event');

  const embed = {
    title: item.name || 'Item inconnu',
    color,
    url: `${WIKI_PAGES}/Compendium/compendium.html#${item.id || item._id}`,
    thumbnail: imgUrl ? { url: imgUrl } : undefined,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };

  // Info badges row
  const badges = [];
  badges.push(`${catInfo.emoji || ''} ${catInfo.label}`.trim());
  badges.push(RARITY_LABELS[rarity] || rarity);
  if (isEvent) badges.push('✦ Event');
  else if (item.palier) badges.push(`Palier ${item.palier}`);
  if (item.lvl) badges.push(`Niv. ${item.lvl}`);
  embed.fields.push({ name: '​', value: badges.join('  ·  '), inline: false });

  // Stats
  const stats = item.stats
    ? Object.entries(item.stats).filter(([, v]) => v !== 0 && v != null).slice(0, 6)
    : [];
  if (stats.length) {
    const lines = stats.map(([id, val]) => {
      const meta = STAT_MAP[id] || { label: id.replace(/_/g, ' '), unit: '' };
      return `\`${formatStatValue(val, meta.unit)}\` ${meta.label}`;
    });
    embed.fields.push({ name: '📊 Statistiques', value: lines.join('\n'), inline: true });
  }

  // Effects
  const effects = item.effects?.slice(0, 4) || [];
  if (effects.length) {
    const lines = effects.map(e => {
      const prefix = e.prefix || '';
      const val    = e.value !== undefined ? e.value : '';
      const unit   = e.unit || '';
      const dur    = e.duration ? ` (${e.duration})` : '';
      const label  = e.label || e.type || '';
      const display = prefix && val !== '' ? `${prefix}${val}${unit}${dur}` : val !== '' ? `${val}${unit}${dur}` : label;
      const icon   = e.icon || '✦';
      return `${icon} ${String(display).slice(0, 60)}`;
    });
    embed.fields.push({ name: '✨ Effets', value: lines.join('\n'), inline: true });
  }

  // Obtain (first line)
  if (item.obtain) {
    const firstLine = resolveObtain(item.obtain).split('\n')
      .map(l => l.replace(/\[(?:[a-zA-Z]+:)?[^\]|]+\|([^\]]+)\]/g, '$1').replace(/\[npc:[^\]]+\]/g, '').trim())
      .find(l => l.length > 0);
    if (firstLine) embed.fields.push({ name: '📍 Obtention', value: firstLine.slice(0, 256), inline: false });
  }

  return embed;
}

function buildMobEmbed(mob) {
  const color = MOB_TYPE_COLORS[mob.type] || 0x323246;
  const diff  = mob.difficulty ? '★'.repeat(mob.difficulty) + '☆'.repeat(Math.max(0, 5 - mob.difficulty)) : '';
  const embed = {
    title: mob.name || 'Mob inconnu',
    color,
    url: `${WIKI_PAGES}/Bestiaire/bestiaire.html`,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };
  const f = embed.fields;
  if (mob.type)     f.push({ name: 'Type',         value: MOB_TYPE_LABELS[mob.type] || mob.type,         inline: true });
  if (mob.behavior) f.push({ name: 'Comportement', value: MOB_BEHAVIOR_LABELS[mob.behavior] || mob.behavior, inline: true });
  if (diff)         f.push({ name: 'Difficulté',   value: `${diff} ${MOB_DIFF_LABELS[mob.difficulty] || ''}`.trim(), inline: true });
  if (mob.zone || mob.region) f.push({ name: 'Zone', value: mob.zone || mob.region, inline: true });
  if (mob.palier)   f.push({ name: 'Palier', value: String(mob.palier), inline: true });
  if (mob.hp)       f.push({ name: 'PV',     value: String(mob.hp),     inline: true });
  if (mob.loot?.length) {
    f.push({ name: 'Loot', value: mob.loot.slice(0, 6).map(l => l.name || l.id || String(l)).join('\n'), inline: false });
  }
  if (mob.description) embed.description = String(mob.description).slice(0, 300);
  return embed;
}

function buildPnjEmbed(pnj) {
  const PNJ_TAGS = {
    forgeron_armes: "Forgeron d'Armes", forgeron_armures: "Forgeron d'Armures",
    marchand_equipement: "Marchand d'Équipement", marchand_consommable: "Marchand de Consommable",
    artisan_runes: "Artisan de Runes", alchimiste: "Alchimiste",
    marchand_itinerant: "Marchand Itinérant", quetes: "Quêtes", autre: "Autre",
  };
  const embed = {
    title: pnj.name || 'PNJ inconnu',
    color: 0xC9A84C,
    url: `${WIKI_PAGES}/Bestiaire/bestiaire.html`,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };
  const tags = (pnj.tags || []).map(t => PNJ_TAGS[t] || t).join(', ');
  if (tags) embed.fields.push({ name: 'Rôle', value: tags, inline: false });
  if (pnj.zone || pnj.region) embed.fields.push({ name: 'Zone', value: pnj.zone || pnj.region, inline: true });
  const coords = pnj.coords;
  if (coords) {
    const parts = [];
    if (coords.x != null) parts.push(`X: ${coords.x}`);
    if (coords.z != null) parts.push(`Z: ${coords.z}`);
    if (parts.length) embed.fields.push({ name: 'Coords', value: parts.join('  '), inline: true });
  }
  if (pnj.description) embed.description = String(pnj.description).slice(0, 300);
  return embed;
}

function buildQueteEmbed(quete) {
  const icon  = QUEST_TYPE_ICONS[quete.type]  || '❓';
  const color = QUEST_TYPE_COLORS[quete.type] || 0x888888;
  const embed = {
    title: `${icon} ${quete.name || 'Quête inconnue'}`,
    color,
    url: `${WIKI_PAGES}/Quetes/quetes.html`,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };
  embed.fields.push({ name: 'Type', value: QUEST_TYPE_LABELS[quete.type] || quete.type || '?', inline: true });
  if (quete.zone || quete.region) embed.fields.push({ name: 'Zone', value: quete.zone || quete.region, inline: true });
  if (quete.palier) embed.fields.push({ name: 'Palier', value: String(quete.palier), inline: true });
  if (quete.objectives?.length) {
    const txt = quete.objectives.slice(0, 5).map((o, i) => `${i + 1}. ${o.text || o}`).join('\n');
    embed.fields.push({ name: 'Objectifs', value: txt.slice(0, 1024), inline: false });
  } else if (quete.description) {
    embed.description = String(quete.description).slice(0, 400);
  }
  if (quete.rewards?.length) {
    embed.fields.push({
      name: 'Récompenses',
      value: quete.rewards.slice(0, 5).map(r => r.name || r.id || String(r)).join('\n').slice(0, 1024),
      inline: false,
    });
  }
  return embed;
}

function buildZoneEmbed(zone) {
  const embed = {
    title: zone.name || 'Zone inconnue',
    color: 0x3DA7C8,
    url: `${WIKI_PAGES}/Map/map.html`,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };
  if (zone.palier) embed.fields.push({ name: 'Palier', value: String(zone.palier), inline: true });
  if (zone.floor)  embed.fields.push({ name: 'Floor',  value: String(zone.floor),  inline: true });
  if (zone.description) embed.description = String(zone.description).slice(0, 400);
  return embed;
}

function buildDonjonEmbed(donjon) {
  const embed = {
    title: `🏰 ${donjon.name || 'Donjon inconnu'}`,
    color: 0x8B3C00,
    url: `${WIKI_PAGES}/Map/map.html`,
    fields: [],
    footer: { text: 'Veilleurs au Clair de Lune 🌙' },
  };
  if (donjon.palier) embed.fields.push({ name: 'Palier', value: String(donjon.palier), inline: true });
  if (donjon.zone || donjon.region) embed.fields.push({ name: 'Zone', value: donjon.zone || donjon.region, inline: true });
  if (donjon.description) embed.description = String(donjon.description).slice(0, 400);
  return embed;
}

function embedFromEntry(type, entry) {
  switch (type) {
    case 'item':   return buildItemEmbed(entry);
    case 'mob':    return buildMobEmbed(entry);
    case 'pnj':    return buildPnjEmbed(entry);
    case 'quete':  return buildQueteEmbed(entry);
    case 'zone':   return buildZoneEmbed(entry);
    case 'donjon': return buildDonjonEmbed(entry);
    default: return { title: 'Type inconnu', color: 0x888888, description: type };
  }
}


// ══════════════════════════════════════════════════════════════
//  DISCORD SIGNATURE VERIFICATION (Ed25519 / Web Crypto API)
// ══════════════════════════════════════════════════════════════

function hexToUint8(hex) {
  const arr = new Uint8Array(hex.length / 2);
  for (let i = 0; i < arr.length; i++)
    arr[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return arr;
}

async function verifyDiscordSignature(publicKey, signature, timestamp, body) {
  const key = await crypto.subtle.importKey(
    'raw', hexToUint8(publicKey),
    { name: 'Ed25519', namedCurve: 'Ed25519' },
    false, ['verify']
  );
  return crypto.subtle.verify(
    { name: 'Ed25519' },
    key,
    hexToUint8(signature),
    new TextEncoder().encode(timestamp + body)
  );
}


// ══════════════════════════════════════════════════════════════
//  DISCORD INTERACTION HANDLER
// ══════════════════════════════════════════════════════════════

function iResponse(data) {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleInteraction(rawBody, env) {
  const interaction = JSON.parse(rawBody);

  // PING → PONG (Discord vérifie l'endpoint avec ça : à garder même commande éteinte)
  if (interaction.type === 1) return iResponse({ type: 1 });

  // Commande /wiki éteinte : plus de lecture Firestore. Passer WIKI_COMMAND_ENABLED à true pour la rallumer.
  if (!WIKI_COMMAND_ENABLED) {
    if (interaction.type === 4) return iResponse({ type: 8, data: { choices: [] } });
    return iResponse({ type: 4, data: { content: 'La commande /wiki est désactivée.', flags: 64 } });
  }

  await loadObtainTexts();

  // AUTOCOMPLETE (type 4)
  if (interaction.type === 4) {
    const opts      = interaction.data?.options || [];
    const catOpt    = opts.find(o => o.name === 'categorie');
    const rechOpt   = opts.find(o => o.name === 'recherche' && o.focused);
    const query     = rechOpt?.value || '';
    const categorie = catOpt?.value || null;
    try {
      const choices = await searchAll(query, categorie, env);
      return iResponse({ type: 8, data: { choices } });
    } catch {
      return iResponse({ type: 8, data: { choices: [] } });
    }
  }

  // APPLICATION_COMMAND (type 2)
  if (interaction.type === 2 && interaction.data?.name === 'wiki') {
    const opts      = interaction.data?.options || [];
    const value     = opts.find(o => o.name === 'recherche')?.value || '';
    const colonIdx  = value.indexOf(':');

    if (colonIdx === -1) {
      return iResponse({
        type: 4,
        data: { content: 'Sélectionne un résultat dans la liste de suggestions.', flags: 64 },
      });
    }

    const type = value.slice(0, colonIdx);
    const id   = value.slice(colonIdx + 1);

    try {
      const entry = await getById(type, id);
      if (!entry) {
        return iResponse({ type: 4, data: { content: `Aucun résultat pour \`${id}\`.`, flags: 64 } });
      }
      const embed = embedFromEntry(type, entry);
      return iResponse({ type: 4, data: { embeds: [embed] } });
    } catch (err) {
      console.error('[wiki]', err);
      return iResponse({ type: 4, data: { content: 'Erreur lors de la récupération des données.', flags: 64 } });
    }
  }

  return iResponse({ type: 4, data: { content: 'Commande inconnue.', flags: 64 } });
}


// ══════════════════════════════════════════════════════════════
//  MAIN FETCH HANDLER
// ══════════════════════════════════════════════════════════════

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (event.cron === USERS_CRON) { await pullUsersAndCfg(env).catch(() => {}); await flushUsers(env, 10).catch(() => {}); }
      else { await syncContent(env).catch(() => {}); await flushUsers(env).catch(() => {}); }
    })());
  },

  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    const _path = new URL(request.url).pathname;
    if (_path === '/discord/callback' && request.method === 'GET') return handleDiscordCallback(request, env);
    if (_path === '/discord/start' && request.method === 'POST') return handleDiscordStart(request, env);
    if (_path === '/db/sync' && request.method === 'GET') return handleDbSync(new URL(request.url), env);
    if (_path === '/db/refresh' && request.method === 'POST') return handleDbRefresh(request, env, ctx);
    if (_path === '/db/resync' && request.method === 'POST') return handleDbResync(request, env);
    if (_path === '/me' && request.method === 'POST') return handleMe(request, env);
    if (_path === '/track' && request.method === 'POST') return handleTrack(request, env);
    if (_path === '/stats' && request.method === 'POST') return handleStats(request, env);
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // ── Route: Discord Interaction (signature header present) ──
    const sigHeader = request.headers.get('X-Signature-Ed25519');
    const tsHeader  = request.headers.get('X-Signature-Timestamp');

    if (sigHeader && tsHeader) {
      const rawBody = await request.text();
      const valid = await verifyDiscordSignature(env.DISCORD_PUBLIC_KEY, sigHeader, tsHeader, rawBody);
      if (!valid) return new Response('Unauthorized', { status: 401 });
      return handleInteraction(rawBody, env);
    }

    // ── Route: existing admin proxy ────────────────────────────
    try {
      const url = new URL(request.url);
      const queryAction = url.searchParams.get('action');

      // Multipart: post_thread
      if (queryAction === 'post_thread') {
        const fd = await request.formData();
        if (fd.get('secret') !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);

        const channelId = fd.get('channelId');
        const thread    = JSON.parse(fd.get('thread') || '{}');
        const file      = fd.get('file');
        const fileName  = fd.get('fileName');

        const outFd = new FormData();
        outFd.append('payload_json', JSON.stringify(thread));
        if (file && fileName) outFd.append('files[0]', file, fileName);

        const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/threads`, {
          method: 'POST',
          headers: { 'Authorization': `Bot ${env.BOT_TOKEN}` },
          body: outFd,
        });
        const data = await r.json();
        return json(data, r.ok ? 200 : r.status);
      }

      // JSON actions
      let body;
      try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
      if (body.secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);

      const action = body.action || 'delete_thread';
      const botHdr = { 'Authorization': `Bot ${env.BOT_TOKEN}`, 'Content-Type': 'application/json' };

      if (action === 'delete_thread') {
        const r = await fetch(`https://discord.com/api/v10/channels/${body.threadId}`, {
          method: 'DELETE', headers: { 'Authorization': `Bot ${env.BOT_TOKEN}` },
        });
        return json({ status: r.status });
      }

      if (action === 'get_guild_roles') {
        const r = await fetch(`https://discord.com/api/v10/guilds/${env.DISCORD_GUILD_ID}/roles`, { headers: botHdr });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'get_channel') {
        const r = await fetch(`https://discord.com/api/v10/channels/${body.channelId}`, { headers: botHdr });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'patch_channel') {
        const r = await fetch(`https://discord.com/api/v10/channels/${body.channelId}`, {
          method: 'PATCH', headers: botHdr, body: JSON.stringify(body.patch),
        });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'get_webhook') {
        const r = await fetch(`https://discord.com/api/v10/webhooks/${body.webhookId}/${body.webhookToken}`);
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      return json({ error: 'Unknown action' }, 400);

    } catch(e) {
      return json({ error: 'Worker error', message: e.message }, 500);
    }
  }
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}


// ══════════════════════════════════════════════════════════════
//  CONNEXION DISCORD (OAuth2 → custom token Firebase)
//
//  Env vars / secrets à ajouter dans Cloudflare :
//    DISCORD_CLIENT_ID      → Dev Portal → OAuth2 → Client ID
//    DISCORD_CLIENT_SECRET  → Dev Portal → OAuth2 → Client Secret
//    DISCORD_GUILD_ID       → id du serveur Discord (mode développeur → clic droit)
//    FIREBASE_SA            → contenu JSON du service account Firebase (secret)
//    DISCORD_INVITE_URL     → lien d'invitation permanent du serveur (proposé aux non-membres)
//  Redirect URI à déclarer côté Discord : <URL du worker>/discord/callback
//
//  Flux : POST /discord/start → URL d'autorisation ; Discord redirige vers
//  GET /discord/callback → vérifie l'appartenance au serveur, synchronise le rôle
//  (config/discordRoles), renvoie un custom token à la fenêtre appelante (postMessage).
// ══════════════════════════════════════════════════════════════

const DISCORD_API    = 'https://discord.com/api/v10';
const BASE_ROLES     = ['visiteur', 'membre', 'contributeur', 'admin'];
const SITE_ORIGIN    = 'https://drabiot.github.io';
const ALLOWED_ORIGIN = /^(https:\/\/drabiot\.github\.io|http:\/\/(localhost|127\.0\.0\.1)(:\d+)?)$/;

const b64u = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64uStr = s => b64u(new TextEncoder().encode(s));
const b64uDec = s => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

// ── State signé (HMAC, clé = ADMIN_SECRET) ────────────────────
async function hmacKey(env) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(env.ADMIN_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}
async function signState(payload, env) {
  const body = b64uStr(JSON.stringify(payload));
  const sig  = await crypto.subtle.sign('HMAC', await hmacKey(env), new TextEncoder().encode(body));
  return `${body}.${b64u(sig)}`;
}
async function readState(state, env) {
  const [body, sig] = String(state || '').split('.');
  if (!body || !sig) return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), b64uDec(sig), new TextEncoder().encode(body));
  if (!ok) return null;
  const p = JSON.parse(new TextDecoder().decode(b64uDec(body)));
  return p.exp > Date.now() ? p : null;
}

// ── Service account Google (token OAuth Firestore + custom token Auth) ──
async function signJwt(sa, claims) {
  const head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64uStr(JSON.stringify(claims));
  const pem  = sa.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key  = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

const _saTokens = {}; // scope → { token, exp }
async function saAccessToken(env, scope = 'https://www.googleapis.com/auth/datastore') {
  const cached = _saTokens[scope];
  if (cached && cached.exp > Date.now() + 60000) return cached.token;
  const sa  = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  const jwt = await signJwt(sa, {
    iss: sa.client_email, scope,
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  });
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('service account token refusé');
  _saTokens[scope] = { token: d.access_token, exp: Date.now() + d.expires_in * 1000 };
  return d.access_token;
}

async function firebaseCustomToken(uid, env) {
  const sa  = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  return signJwt(sa, {
    iss: sa.client_email, sub: sa.client_email, uid, iat: now, exp: now + 3600,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
  });
}

// ── Firestore (écritures admin, contournent les rules) ────────
const toFs = v => v === null ? { nullValue: null }
  : typeof v === 'boolean' ? { booleanValue: v }
  : typeof v === 'number'  ? { integerValue: String(v) }
  : { stringValue: String(v) };

async function fsReq(env, path, init = {}) {
  const r = await fetch(`${FIRESTORE_BASE}${path}`, {
    ...init, headers: { Authorization: `Bearer ${await saAccessToken(env)}`, 'Content-Type': 'application/json' },
  });
  if (r.status === 404) return null;
  const d = await r.json();
  if (!r.ok) throw new Error(`Firestore ${r.status}: ${d.error?.message || ''}`);
  return d;
}
const fsGetDoc = async (env, path) => { const d = await fsReq(env, `/${path}`); return d ? parseDoc(d) : null; };

async function fsFindUser(env, field, value) {
  const d = await fsReq(env, ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery: {
    from: [{ collectionId: 'users' }],
    where: { fieldFilter: { field: { fieldPath: field }, op: 'EQUAL', value: toFs(value) } }, limit: 1,
  } }) });
  const hit = (d || []).find(x => x.document);
  return hit ? parseDoc(hit.document) : null;
}

async function fsPatchUser(env, uid, data) {
  const keys = Object.keys(data);
  const mask = keys.map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`).join('&');
  const fields = Object.fromEntries(keys.map(k => [k, toFs(data[k])]));
  return fsReq(env, `/users/${uid}?${mask}`, { method: 'PATCH', body: JSON.stringify({ fields }) });
}

// Journal de connexion (alimente « Connexions récentes » des stats) ; jamais bloquant, admins exclus.
async function fsLogLogin(env, uid, pseudo, role) {
  if (role === 'admin') return;
  if (env.DB) {
    try { await env.DB.prepare('INSERT INTO login_log (uid, pseudo, ts) VALUES (?, ?, ?)').bind(uid, pseudo || '', Date.now()).run(); } catch { /* idem */ }
    return;
  }
  try {
    await fsReq(env, '/audit_log', { method: 'POST', body: JSON.stringify({ fields: {
      action: toFs('login'), actorUid: toFs(uid), actorPseudo: toFs(pseudo || ''),
      targetType: toFs('session'), targetId: toFs(uid), targetName: toFs(pseudo || ''),
      metadata: { mapValue: { fields: { via: toFs('discord') } } },
      createdAt: { timestampValue: new Date().toISOString() },
    } }) });
  } catch { /* le journal ne doit jamais empêcher la connexion */ }
}

// ── Rôle site déduit des rôles Discord (config/discordRoles) ──
let _roleCfgCache = null; // { at, cfg, custom } : 5 min, économise 2 lectures Firestore par connexion
async function resolveSiteRole(env, discordRoleIds) {
  if (!_roleCfgCache || Date.now() - _roleCfgCache.at > 5 * 60000) {
    const [c, cu] = await Promise.all([cfgGet(env, 'config/discordRoles'), cfgGet(env, 'config/customRoles')]);
    _roleCfgCache = { at: Date.now(), cfg: c, custom: cu };
  }
  const { cfg, custom } = _roleCfgCache;
  const map = cfg?.map || {};
  const tier = role => BASE_ROLES.includes(role) ? BASE_ROLES.indexOf(role)
    : BASE_ROLES.indexOf((custom?.roles || []).find(r => r.id === role)?.baseTier || 'visiteur');
  let best = cfg?.defaultRole || 'membre';
  for (const rid of discordRoleIds) {
    const role = map[rid];
    if (role && tier(role) > tier(best)) best = role;
  }
  return best;
}

async function uniquePseudo(env, wanted, discordId) {
  let p = String(wanted || '').replace(/[^\p{L}\p{N}_\- \[\]]/gu, '').trim().slice(0, 32);
  if (p.length < 2) p = `Veilleur${discordId.slice(-4)}`;
  if (!(await userFind(env, 'pseudo', p))) return p;
  return `${p.slice(0, 27)}_${discordId.slice(-4)}`;
}

// ── Routes ────────────────────────────────────────────────────
async function handleDiscordStart(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!ALLOWED_ORIGIN.test(body.origin || '')) return json({ error: 'Origine refusée' }, 400);

  let uid = null;
  if (body.mode === 'link') {
    const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: body.idToken }),
    });
    uid = (await r.json()).users?.[0]?.localId;
    if (!uid) return json({ error: 'Session invalide, reconnecte-toi.' }, 401);
  }
  const state = await signState({ m: body.mode === 'link' ? 'link' : 'login', uid, o: body.origin, exp: Date.now() + 10 * 60000,
    r: body.redirect ? 1 : 0, p: /^\/[\w\-./]*$/.test(body.path || '') ? body.path : '/' }, env);
  const url = `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: 'code', scope: 'identify',
    redirect_uri: `${new URL(request.url).origin}/discord/callback`, state,
  })}`;
  return json({ url });
}

function popupResult(origin, payload, invite, back) {
  const msg = JSON.stringify({ type: 'vcl-discord', ...payload }).replace(/</g, '\\u003c');
  const label = payload.error ? '⛔ ' + payload.error.replace(/[<&]/g, '') : 'Connecté, tu peux fermer cette fenêtre.';
  const join  = invite && /^https:\/\/discord\.(gg|com)\//.test(invite)
    ? `<p><a href="${invite}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#5865F2;color:#fff;text-decoration:none;font-weight:600">Rejoindre le serveur Discord</a></p><p style="font-size:13px;color:#999">Puis reconnecte-toi sur le site.</p>`
    : '';
  const backLink = back ? `<p><a href="${back}" style="color:#E0AC60">← Retour au site</a></p>` : '';
  return new Response(`<!doctype html><meta charset="utf-8"><title>Discord</title>
<body style="font-family:sans-serif;background:#111;color:#ddd;text-align:center;padding-top:30vh">${label}${join}${backLink}
<script>try{window.opener.postMessage(${msg},${JSON.stringify(origin)})}catch(e){}${payload.error ? '' : ';window.close()'}</script>`,
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

// Mode redirection (popups bloquées) : le token revient dans le fragment de la page d'origine.
function redirectResult(state, payload, invite) {
  const back = state.o + (state.p || '/');
  if (payload.error) return popupResult(state.o, payload, invite, back);
  const frag = new URLSearchParams({ 'vcl-discord': payload.token, pseudo: payload.pseudo || '' });
  return new Response(null, { status: 302, headers: { Location: `${back}#${frag}`, 'Cache-Control': 'no-store' } });
}

async function handleDiscordCallback(request, env) {
  const url   = new URL(request.url);
  const state = await readState(url.searchParams.get('state'), env);
  if (!state) return popupResult(SITE_ORIGIN, { error: 'Lien expiré, réessaie.' });
  const out   = (payload, invite) => state.r ? redirectResult(state, payload, invite) : popupResult(state.o, payload, invite);
  const fail = error => out({ error });

  const code = url.searchParams.get('code');
  if (!code) return fail('Connexion Discord annulée.');
  try {
    const tr = await fetch(`${DISCORD_API}/oauth2/token`, {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.DISCORD_CLIENT_ID, client_secret: env.DISCORD_CLIENT_SECRET, grant_type: 'authorization_code',
        code, redirect_uri: `${url.origin}/discord/callback`,
      }),
    });
    const tok = await tr.json();
    if (!tok.access_token) return fail("Échec de l'authentification Discord.");
    const me = await (await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${tok.access_token}` } })).json();
    if (!me.id) return fail('Profil Discord introuvable.');

    // Appartenance + rôles via le bot (pas besoin du scope guilds.members.read)
    const mr = await fetch(`${DISCORD_API}/guilds/${env.DISCORD_GUILD_ID}/members/${me.id}`, { headers: { Authorization: `Bot ${env.BOT_TOKEN}` } });
    if (mr.status === 404) return out({ error: 'Tu dois être membre du serveur Discord pour te connecter.' }, env.DISCORD_INVITE_URL);
    if (!mr.ok) return fail("Impossible de vérifier ton appartenance au serveur.");
    const member = await mr.json();

    const owner = await userFind(env, 'discordId', me.id);
    let uid, existing;
    if (state.m === 'link') {
      uid = state.uid;
      existing = await userGet(env, uid);
      if (existing?.discordId && existing.discordId !== me.id) return fail('Ce compte est déjà lié à un autre Discord.');
      if (owner && owner._id !== uid) {
        if (!owner._id.startsWith('discord_')) return fail('Ce Discord est déjà lié à un autre compte.');
        // compte auto-créé par une connexion Discord antérieure : on le désarme au profit de l'ancien
        await userPatch(env, owner._id, { discordId: null, mergedInto: uid });
      }
    } else if (owner) {
      uid = owner._id; existing = owner;
    } else {
      uid = `discord_${me.id}`; existing = await userGet(env, uid);
    }

    const data = {
      discordId: me.id,
      discordName: me.global_name || me.username,
      discordAvatar: me.avatar || '',
    };
    if (!existing) data.pseudo = await uniquePseudo(env, member.nick || me.global_name || me.username, me.id);
    // admin / roleLocked : jamais écrasé par la synchro Discord
    if (!existing || (existing.role !== 'admin' && !existing.roleLocked)) {
      data.role = await resolveSiteRole(env, member.roles || []);
    }
    await userPatch(env, uid, data);
    await fsLogLogin(env, uid, data.pseudo || existing?.pseudo, data.role || existing?.role);

    return out({ token: await firebaseCustomToken(uid, env), pseudo: data.pseudo || existing?.pseudo || '' });
  } catch (e) {
    // Quota Firestore (offre gratuite) atteint : message clair plutôt qu'une erreur technique
    if (/Firestore 429|quota|RESOURCE_EXHAUSTED/i.test(e.message)) return fail('Le site a atteint sa limite quotidienne de lectures : la connexion est indisponible pour le moment. Réessaie demain matin (remise à zéro vers 9h).');
    return fail('Erreur serveur : ' + e.message);
  }
}


// ══════════════════════════════════════════════════════════════
//  TRACKING & STATS (D1, binding `DB` — schéma dans d1/schema.sql)
//
//  POST /track  public : { ops: [{ col, id, set?: {clé: valeur}, inc?: {clé: 1..20} }] }
//               équivalent de setDoc(…, {merge:true}) + increment(1) sur les 4 collections de stats.
//  POST /stats  admin   : { secret, action: 'summary' (défaut) | 'user' | 'reset' | 'quota' } — agrégats calculés en SQL ; même secret que le proxy Discord.
// ══════════════════════════════════════════════════════════════

const TRACK_COLS    = new Set(['page_views', 'user_visits', 'item_views', 'search_logs']);
const TRACK_ID_RE   = /^[A-Za-z0-9_\-]{1,120}$/;
const TRACK_KEY_RE  = /^[A-Za-z0-9_.\-]{1,120}$/;
const TRACK_MAX_OPS = 12;
const TRACK_MAX_KEYS = 40;

/** Valide une opération de tracking ; renvoie null si elle est refusée. */
function cleanTrackOp(op) {
  if (!op || !TRACK_COLS.has(op.col) || !TRACK_ID_RE.test(String(op.id))) return null;
  const set = {}, inc = {};
  for (const [k, v] of Object.entries(op.set || {})) {
    if (!TRACK_KEY_RE.test(k)) return null;
    if (typeof v === 'string') set[k] = v.slice(0, 150);
    else if (typeof v === 'boolean' || (typeof v === 'number' && Number.isFinite(v))) set[k] = v;
    else return null;
  }
  for (const [k, v] of Object.entries(op.inc || {})) {
    if (!TRACK_KEY_RE.test(k) || !Number.isInteger(v) || v < 1 || v > 20) return null;
    inc[k] = v;
  }
  if (Object.keys(set).length + Object.keys(inc).length > TRACK_MAX_KEYS) return null;
  return { col: op.col, id: String(op.id), set, inc };
}

async function handleTrack(request, env) {
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  let body;
  try {
    const raw = await request.text();
    if (raw.length > 16000) return json({ error: 'Trop gros' }, 413);
    body = JSON.parse(raw);
  } catch { return json({ error: 'Bad JSON' }, 400); }
  const ops = (Array.isArray(body?.ops) ? body.ops : []).slice(0, TRACK_MAX_OPS).map(cleanTrackOp);
  if (!ops.length || ops.some(o => !o)) return json({ error: 'Opération invalide' }, 400);

  const now = Date.now();
  const stmts = [];
  for (const o of ops) {
    stmts.push(env.DB.prepare("INSERT OR IGNORE INTO track_docs (col, id, data, updated_at) VALUES (?, ?, '{}', ?)").bind(o.col, o.id, now));
    // json_set(data, chemin, valeur, …) : une seule écriture par document
    const parts = [], args = [];
    for (const [k, v] of Object.entries(o.set)) { parts.push('?, json(?)'); args.push(`$."${k}"`, JSON.stringify(v)); }
    for (const [k, n] of Object.entries(o.inc)) { parts.push('?, COALESCE(json_extract(data, ?), 0) + ?'); args.push(`$."${k}"`, `$."${k}"`, n); }
    if (parts.length) {
      stmts.push(env.DB.prepare(`UPDATE track_docs SET data = json_set(data, ${parts.join(', ')}), updated_at = ? WHERE col = ? AND id = ?`)
        .bind(...args, now, o.col, o.id));
    }
  }
  try { await env.DB.batch(stmts); } catch (e) { return json({ error: 'Écriture impossible' }, 500); }
  return json({ ok: true });
}

// Visiteur anonyme : doc sans isAnonymous dont l'id commence par « anon_ » (écriture partielle de profondeur de session)
const UV_ANON = "COALESCE(json_extract(track_docs.data, '$.isAnonymous'), substr(track_docs.id, 1, 5) = 'anon_')";
const UV_TOTAL = "COALESCE(json_extract(track_docs.data, '$.total'), 0)";

// Clés plates de user_visits (« sections.map », « item_names.arc ») → objets, comme la page stats les lit
const UV_GROUPS = { sections: 'sections', devices: 'devices', items: 'items', item_names: 'itemNames', mobs: 'mobs',
  mob_names: 'mobNames', pnj: 'pnj', npcs: 'pnj', pnj_names: 'pnjNames', npc_names: 'pnjNames', quetes: 'quetes',
  quete_names: 'queteNames', searches: 'searches' };
function uvGroups(d) {
  const out = {};
  for (const [k, v] of Object.entries(d)) {
    const i = k.indexOf('.');
    const g = i > 0 && UV_GROUPS[k.slice(0, i)];
    if (g) (out[g] ??= {})[k.slice(i + 1)] = v;
  }
  return out;
}

async function handleStats(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (body.action === 'quota') return json(await quotaReport(env));
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);

  if (body.action === 'reset') {
    const n = (await q("SELECT COUNT(*) n FROM track_docs").first()).n;
    await env.DB.batch([q('DELETE FROM track_docs'), q('DELETE FROM login_log')]);
    return json({ ok: true, deleted: n });
  }

  // Détail d'un visiteur (clic sur une ligne du tableau)
  if (body.action === 'user') {
    const row = await q("SELECT data FROM track_docs WHERE col = 'user_visits' AND id = ?", String(body.id || '')).first();
    if (!row) return json({ user: null });
    const d = JSON.parse(row.data);
    const { isAnonymous, pseudo, total, totalSessions, firstSeen, lastSeen } = d;
    return json({ user: { id: body.id, isAnonymous, pseudo, total, totalSessions, firstSeen, lastSeen, ...uvGroups(d) } });
  }

  // Résumé : tout est agrégé ici, la page n'a plus à télécharger ni à parcourir chaque profil
  const date7 = String(body.date7 || ''), date30 = String(body.date30 || '');
  const dayStart = Number(body.dayStart) || 0, weekStart = Number(body.weekStart) || 0;
  const TOP_ANON = 40;

  const [pv, uvAgg, uvSec, members, anons, anonAgg, anonSec, items, searches, lgRecent, lgToday, lgWeek] = await Promise.all([
    q("SELECT id, data FROM track_docs WHERE col = 'page_views'").all(),
    q(`SELECT COUNT(*) n, SUM(${UV_ANON}) anons,
         SUM(json_extract(data, '$."devices.mobile"')) mobile, SUM(json_extract(data, '$."devices.desktop"')) desktop,
         SUM(json_extract(data, '$.totalSessions')) sessions, SUM(json_extract(data, '$.totalSectionVisits')) sectionVisits,
         SUM(json_extract(data, '$.lastSeen') >= ?) active7, SUM(json_extract(data, '$.lastSeen') >= ?) active30,
         SUM(json_extract(data, '$.firstSeen') >= ?) new7, SUM(${UV_TOTAL} <= 1) oneVisit
       FROM track_docs WHERE col = 'user_visits'`, date7, date30, date7).first(),
    q("SELECT substr(key, 10) s, SUM(value) v FROM track_docs, json_each(track_docs.data) WHERE col = 'user_visits' AND key LIKE 'sections.%' GROUP BY s").all(),
    q(`SELECT id, data FROM track_docs WHERE col = 'user_visits' AND NOT ${UV_ANON} ORDER BY ${UV_TOTAL} DESC LIMIT 300`).all(),
    q(`SELECT id, data FROM track_docs WHERE col = 'user_visits' AND ${UV_ANON} ORDER BY ${UV_TOTAL} DESC LIMIT ${TOP_ANON}`).all(),
    q(`SELECT COUNT(*) n, SUM(${UV_TOTAL}) total, MAX(json_extract(data, '$.lastSeen')) lastSeen FROM track_docs WHERE col = 'user_visits' AND ${UV_ANON}`).first(),
    q(`SELECT substr(key, 10) s, SUM(value) v FROM track_docs, json_each(track_docs.data) WHERE col = 'user_visits' AND ${UV_ANON} AND key LIKE 'sections.%' GROUP BY s`).all(),
    q("SELECT json_extract(data, '$.itemId') id, MAX(json_extract(data, '$.name')) name, SUM(json_extract(data, '$.count')) count FROM track_docs WHERE col = 'item_views' GROUP BY id ORDER BY count DESC LIMIT 10").all(),
    q("SELECT json_extract(data, '$.term') term, SUM(json_extract(data, '$.count')) count FROM track_docs WHERE col = 'search_logs' GROUP BY term ORDER BY count DESC LIMIT 15").all(),
    q('SELECT pseudo, ts FROM login_log ORDER BY ts DESC LIMIT 20').all(),
    q('SELECT COUNT(*) n, COUNT(DISTINCT uid) u FROM login_log WHERE ts >= ?', dayStart).first(),
    q('SELECT COUNT(*) n, COUNT(DISTINCT uid) u FROM login_log WHERE ts >= ?', weekStart).first(),
  ]);

  // Visites par jour : un doc « site » par jour (format actuel) ; à défaut, somme des anciens docs par section
  const days = {};
  const hours = Array(24).fill(0);
  for (const r of pv.results) {
    let d; try { d = JSON.parse(r.data); } catch { continue; }
    if (!d.date) continue;
    const day = (days[d.date] ??= { site: null, legacy: 0 });
    if (d.section === 'site') day.site = d; else day.legacy += d.count || 0;
  }
  const daily = Object.entries(days).sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, { site, legacy }]) => {
    if (site) {
      for (const [k, v] of Object.entries(site)) { // « hours.9 » (clés plates) ou hours: { 9: n } (anciens docs)
        if (k.startsWith('hours.')) hours[+k.slice(6)] += v || 0;
      }
      if (site.hours && typeof site.hours === 'object') for (let h = 0; h < 24; h++) hours[h] += site.hours[h] || 0;
    }
    return { d: date, c: site ? site.count || 0 : legacy, u: site?.uniques || 0 };
  });

  const slim = r => {
    const d = JSON.parse(r.data);
    return { id: r.id, pseudo: d.pseudo, isAnonymous: !!(d.isAnonymous ?? r.id.startsWith('anon_')), total: d.total || 0,
      lastSeen: d.lastSeen || '', sections: uvGroups(d).sections || {} };
  };
  const memberRows = members.results.map(slim);
  const anonRows = anons.results.map(slim);
  const restSections = Object.fromEntries(anonSec.results.map(r => [r.s, r.v]));
  for (const a of anonRows) for (const [s, v] of Object.entries(a.sections)) restSections[s] = (restSections[s] || 0) - v;
  const restN = Math.max(0, (anonAgg.n || 0) - anonRows.length);

  return json({
    daily, hours,
    users: { total: uvAgg.n || 0, anons: uvAgg.anons || 0, members: (uvAgg.n || 0) - (uvAgg.anons || 0),
      mobile: uvAgg.mobile || 0, desktop: uvAgg.desktop || 0, sessions: uvAgg.sessions || 0, sectionVisits: uvAgg.sectionVisits || 0,
      active7: uvAgg.active7 || 0, active30: uvAgg.active30 || 0, new7: uvAgg.new7 || 0, oneVisit: uvAgg.oneVisit || 0 },
    sections: Object.fromEntries(uvSec.results.map(r => [r.s, r.v])),
    members: [...memberRows, ...anonRows],
    anonRest: restN ? { n: restN, total: (anonAgg.total || 0) - anonRows.reduce((s, a) => s + a.total, 0),
      lastSeen: anonAgg.lastSeen || '', sections: Object.fromEntries(Object.entries(restSections).filter(([, v]) => v > 0)) } : null,
    topItems: items.results.filter(r => r.id), topSearches: searches.results.filter(r => r.term),
    logins: { recent: lgRecent.results.map(l => ({ pseudo: l.pseudo, ts: l.ts })), today: lgToday.n, todayUniq: lgToday.u, week: lgWeek.n, weekUniq: lgWeek.u },
  });
}


// ══════════════════════════════════════════════════════════════
//  CONTENU PUBLIC : copie Firestore → D1 (étape 2 de la migration)
//
//  Firestore reste la source d'écriture. Le worker en tire les changements (delta sur _updatedAt +
//  tombstones, comme le cache client) et les range dans D1 ; les visiteurs lisent D1 via GET /db/sync.
//  Déclencheurs : cron (toutes les 15 min), POST /db/refresh (appelé par le site après une écriture,
//  utilisateur connecté, 1 fois / 15 s), POST /db/resync (admin, resynchronisation complète).
//  Chaque lot est atomique et prend un nouveau numéro de révision (meta.rev) : un client ne rate rien.
// ══════════════════════════════════════════════════════════════

const D1_SYNC_COLS = ['items', 'mobs', 'personnages', 'regions', 'quetes', 'panoplies', 'map_markers', 'zones', 'donjons'];
const SYNC_CHUNK   = 300;
const SYNC_BUDGET  = 40;   // requêtes par exécution (limite 50 sur l'offre gratuite) ; le reste reprend au tour suivant
const DOC_BASE     = `projects/${PROJECT_ID}/databases/(default)/documents`;
const REV_SQL      = "(SELECT v FROM meta WHERE k = 'rev')";

class BudgetOut extends Error {}

function newBudget() {
  let left = SYNC_BUDGET;
  return { take(n = 1) { if (left < n) throw new BudgetOut(); left -= n; } };
}

async function fsRunQuery(env, b, structuredQuery) {
  b.take();
  const d = await fsReq(env, ':runQuery', { method: 'POST', body: JSON.stringify({ structuredQuery }) });
  return (d || []).filter(x => x.document).map(x => x.document);
}

const lastSeg = name => name.split('/').pop();
const tsMs = f => (f?.timestampValue ? Date.parse(f.timestampValue) : 0);
const orderTsName = field => [
  { field: { fieldPath: field }, direction: 'ASCENDING' },
  { field: { fieldPath: '__name__' }, direction: 'ASCENDING' },
];
const startAfter = (ts, col, name) => (ts && name)
  ? { values: [{ timestampValue: new Date(ts).toISOString() }, { referenceValue: `${DOC_BASE}/${col}/${name}` }], before: false }
  : undefined;

/** Synchronise Firestore → D1. Renvoie { done, docs, deleted } ; done=false tant qu'une passe complète reste à finir. */
async function syncContent(env, { cols = D1_SYNC_COLS, reset = false } = {}) {
  const stat = { done: false, docs: 0, deleted: 0 };
  if (!env.DB) return { ...stat, done: true };
  const b = newBudget();
  const run = async stmts => { b.take(); await env.DB.batch(stmts); };
  const setMeta = (k, v) => env.DB.prepare('INSERT OR REPLACE INTO meta (k, v) VALUES (?, ?)').bind(k, v);
  const bump = () => env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'");
  try {
    b.take();
    const m = Object.fromEntries((await env.DB.prepare('SELECT k, v FROM meta').all()).results.map(r => [r.k, r.v]));

    // Époque : bumpée dans config/sync pour forcer un rechargement complet → on repart de zéro (avec balayage des disparus)
    b.take();
    const epoch = (await fsGetDoc(env, 'config/sync'))?.epoch || 0;
    if (reset || epoch !== m.epoch) {
      const gen = Date.now();
      await run([
        setMeta('gen', gen), setMeta('epoch', epoch),
        ...D1_SYNC_COLS.flatMap(c => [setMeta('cur:' + c, 0), setMeta('curname:' + c, ''), setMeta('full:' + c, 1)]),
      ]);
      Object.assign(m, { gen, epoch });
      for (const c of D1_SYNC_COLS) Object.assign(m, { ['cur:' + c]: 0, ['curname:' + c]: '', ['full:' + c]: 1 });
    }

    // 1. Suppressions (tombstones) d'abord, pour qu'un doc recréé ensuite repasse bien en « présent »
    for (;;) {
      const tombs = await fsRunQuery(env, b, {
        from: [{ collectionId: 'tombstones' }], orderBy: orderTsName('ts'), limit: SYNC_CHUNK,
        startAt: startAfter(m.tomb || 0, 'tombstones', m.tombname || ''),
      });
      if (!tombs.length) break;
      const stmts = [bump()];
      let ts = m.tomb || 0, name = m.tombname || '';
      for (const t of tombs) {
        const f = t.fields || {};
        ts = tsMs(f.ts) || ts; name = lastSeg(t.name);
        const col = f.col?.stringValue, id = f.id?.stringValue;
        if (!D1_SYNC_COLS.includes(col) || !id) continue;
        stmts.push(env.DB.prepare(`UPDATE docs SET deleted = 1, updated_at = ${REV_SQL} WHERE col = ? AND id = ? AND deleted = 0`).bind(col, id));
        stat.deleted++;
      }
      stmts.push(setMeta('tomb', ts), setMeta('tombname', name));
      await run(stmts);
      m.tomb = ts; m.tombname = name;
      if (tombs.length < SYNC_CHUNK) break;
    }

    // 2. Créations / modifications, collection par collection
    for (const col of cols) {
      if (!D1_SYNC_COLS.includes(col)) continue;
      for (;;) {
        const docs = await fsRunQuery(env, b, {
          from: [{ collectionId: col }], orderBy: orderTsName('_updatedAt'), limit: SYNC_CHUNK,
          startAt: startAfter(m['cur:' + col] || 0, col, m['curname:' + col] || ''),
        });
        const full = m['full:' + col] === 1, last = docs.length < SYNC_CHUNK;
        const stmts = [bump()];
        let ts = m['cur:' + col] || 0, name = m['curname:' + col] || '';
        for (const d of docs) {
          ts = tsMs(d.fields?._updatedAt) || ts; name = lastSeg(d.name);
          const { _id, _updatedAt, ...data } = parseDoc(d);
          // passe complète : on réécrit tout et on marque la génération (sert au balayage) ; sinon uniquement si ça a changé
          stmts.push(env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES (?, ?, ?, ${REV_SQL}, 0, ?)
            ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0, gen = excluded.gen
            ${full ? '' : 'WHERE docs.data != excluded.data OR docs.deleted = 1'}`).bind(col, _id, JSON.stringify(data), m.gen));
          stat.docs++;
        }
        if (last && full) { // fin de la passe complète : ce que Firestore n'a pas renvoyé n'existe plus
          stmts.push(env.DB.prepare(`UPDATE docs SET deleted = 1, updated_at = ${REV_SQL} WHERE col = ? AND deleted = 0 AND gen != ?`).bind(col, m.gen));
          stmts.push(setMeta('full:' + col, 0));
        }
        stmts.push(setMeta('cur:' + col, ts), setMeta('curname:' + col, name));
        if (docs.length || (last && full)) await run(stmts);
        m['cur:' + col] = ts; m['curname:' + col] = name;
        if (last) { if (full) m['full:' + col] = 0; break; }
      }
    }
    stat.done = D1_SYNC_COLS.every(c => m['full:' + c] !== 1);
  } catch (e) {
    if (!(e instanceof BudgetOut)) throw e;
  }
  return stat;
}

/** GET /db/sync?col=items&since=N → { rev, epoch, docs: [{id, d}], deleted: [id] } */
async function handleDbSync(url, env) {
  const col = url.searchParams.get('col');
  const since = parseInt(url.searchParams.get('since') || '0') || 0;
  if (!env.DB || !D1_SYNC_COLS.includes(col)) return json({ error: 'Collection inconnue' }, 400);
  const meta = (await env.DB.prepare("SELECT k, v FROM meta WHERE k IN ('rev', 'epoch') OR k = ?").bind('full:' + col).all()).results;
  const m = Object.fromEntries(meta.map(r => [r.k, r.v]));
  if (!m.rev || m['full:' + col] !== 0) return json({ error: 'Pas encore synchronisé' }, 503); // le client retombe sur Firestore
  const rows = (since > 0
    ? await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND updated_at > ?').bind(col, since).all()
    : await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND deleted = 0').bind(col).all()).results;
  const docs = rows.filter(r => !r.deleted).map(r => `{"id":${JSON.stringify(r.id)},"d":${r.data}}`).join(',');
  const deleted = JSON.stringify(rows.filter(r => r.deleted).map(r => r.id));
  return new Response(`{"rev":${m.rev},"epoch":${m.epoch},"docs":[${docs}],"deleted":${deleted}}`, {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

/** POST /db/refresh { idToken, cols? } : le site signale une écriture ; utilisateur connecté, 1 synchro / 15 s. */
async function handleDbRefresh(request, env, ctx) {
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: String(body.idToken || '') }),
  });
  if (!r.ok) return json({ error: 'Non connecté' }, 401);
  const now = Date.now();
  const res = await env.DB.prepare("UPDATE meta SET v = ? WHERE k = 'lastrefresh' AND v < ?").bind(now, now - 15000).run();
  if (!res.meta.changes) return json({ ok: true, throttled: true });
  const cols = (Array.isArray(body.cols) ? body.cols : []).filter(c => D1_SYNC_COLS.includes(c));
  ctx.waitUntil(syncContent(env, { cols: cols.length ? cols : D1_SYNC_COLS }).catch(() => {}));
  return json({ ok: true });
}

/** POST /db/resync { secret, reset? } : synchronisation admin ; rappeler jusqu'à done = true. */
async function handleDbResync(request, env) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
  try { return json(await syncContent(env, { reset: !!body.reset })); }
  catch (e) { return json({ error: e.message }, 500); }
}


// ══════════════════════════════════════════════════════════════
//  COMPTES : copie D1 — la connexion Discord ne dépend plus du quota Firestore
//
//  Firestore reste la source de vérité (règles de sécurité, modération). D1 (tables users, cfg) en garde une copie :
//   - lecture  : Firestore d'abord (données à jour) ; si Firestore échoue (quota, panne), la copie D1 ;
//   - écriture : D1 d'abord (`pending` = champs restant à reporter), puis report dans Firestore dès que possible
//                (tout de suite, sinon par le cron via flushUsers).
//  La copie est remplie à chaque lecture réussie, par pullUsersAndCfg (cron 6 h) et par Save/seed-users-d1.js.
// ══════════════════════════════════════════════════════════════

const jparse = s => { try { return JSON.parse(s); } catch { return null; } };

async function d1UserRow(env, field, value) {
  const col = field === 'discordId' ? 'discord_id' : field === 'pseudo' ? 'pseudo' : 'uid';
  return env.DB.prepare(`SELECT uid, data, pending FROM users WHERE ${col} = ? LIMIT 1`).bind(value).first();
}
const rowToUser = r => (r ? { _id: r.uid, ...(jparse(r.data) || {}), ...(jparse(r.pending) || {}) } : null);

function d1SaveUser(env, uid, data, pending) {
  return env.DB.prepare(`INSERT INTO users (uid, data, discord_id, pseudo, pending) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (uid) DO UPDATE SET data = excluded.data, discord_id = excluded.discord_id, pseudo = excluded.pseudo, pending = excluded.pending`)
    .bind(uid, JSON.stringify(data), data.discordId ?? null, data.pseudo ?? null, pending ? JSON.stringify(pending) : null).run();
}

/** Compte trouvé par pseudo / discordId / uid ; null s'il n'existe pas. */
async function userLookup(env, field, value) {
  const row = await d1UserRow(env, field, value).catch(() => null);
  let fsUser, ok = false;
  try { fsUser = field === 'uid' ? await fsGetDoc(env, `users/${value}`) : await fsFindUser(env, field, value); ok = true; } catch { /* quota / panne */ }
  if (!ok) return rowToUser(row);
  if (!fsUser) return row?.pending ? rowToUser(row) : null; // créé pendant une panne, pas encore reporté
  const { _id, ...data } = fsUser;
  await d1SaveUser(env, _id, data, jparse(row?.pending)).catch(() => {});
  return { ...fsUser, ...(jparse(row?.pending) || {}) };
}
const userFind = (env, field, value) => userLookup(env, field, value);
const userGet  = (env, uid) => userLookup(env, 'uid', uid);

/** Enregistre un patch de compte : D1 d'abord, puis Firestore (reporté plus tard s'il échoue). */
async function userPatch(env, uid, patch) {
  const row = await d1UserRow(env, 'uid', uid).catch(() => null);
  const data = { ...(jparse(row?.data) || {}), ...patch };
  const pending = { ...(jparse(row?.pending) || {}), ...patch };
  await d1SaveUser(env, uid, data, pending);
  try { await fsPatchUser(env, uid, pending); await d1SaveUser(env, uid, data, null); } catch { /* flushUsers s'en chargera */ }
}

/** Reporte dans Firestore les patchs restés en attente (quota épuisé au moment de la connexion). */
async function flushUsers(env, max = 3) {
  if (!env.DB) return;
  const { results } = await env.DB.prepare('SELECT uid, data, pending FROM users WHERE pending IS NOT NULL LIMIT ?').bind(max).all();
  for (const r of results) {
    try { await fsPatchUser(env, r.uid, jparse(r.pending) || {}); await d1SaveUser(env, r.uid, jparse(r.data) || {}, null); } catch { return; }
  }
}

/** Config Firestore (rôles Discord…) avec copie D1 en secours. */
async function cfgGet(env, path) {
  try {
    const d = await fsGetDoc(env, path);
    if (env.DB) await env.DB.prepare('INSERT OR REPLACE INTO cfg (k, v) VALUES (?, ?)').bind(path, JSON.stringify(d)).run().catch(() => {});
    return d;
  } catch (e) {
    const r = env.DB ? await env.DB.prepare('SELECT v FROM cfg WHERE k = ?').bind(path).first().catch(() => null) : null;
    if (r) return jparse(r.v);
    throw e;
  }
}

/** Recopie tous les comptes et la config de rôles de Firestore vers D1 (cron 6 h). Ne touche pas aux patchs en attente. */
async function pullUsersAndCfg(env) {
  if (!env.DB) return;
  const seen = new Set(), stmts = [];
  let pageToken = '';
  do {
    const d = await fsReq(env, `/users?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`);
    for (const doc of d?.documents || []) {
      const { _id, ...data } = parseDoc(doc);
      seen.add(_id);
      stmts.push(env.DB.prepare(`INSERT INTO users (uid, data, discord_id, pseudo, pending) VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT (uid) DO UPDATE SET data = excluded.data, discord_id = excluded.discord_id, pseudo = excluded.pseudo WHERE users.pending IS NULL`)
        .bind(_id, JSON.stringify(data), data.discordId ?? null, data.pseudo ?? null));
    }
    pageToken = d?.nextPageToken || '';
  } while (pageToken);
  const old = (await env.DB.prepare('SELECT uid FROM users WHERE pending IS NULL').all()).results;
  for (const r of old) if (!seen.has(r.uid)) stmts.push(env.DB.prepare('DELETE FROM users WHERE uid = ? AND pending IS NULL').bind(r.uid));
  for (const path of ['config/discordRoles', 'config/customRoles']) {
    const c = await fsGetDoc(env, path);
    stmts.push(env.DB.prepare('INSERT OR REPLACE INTO cfg (k, v) VALUES (?, ?)').bind(path, JSON.stringify(c)));
  }
  for (let i = 0; i < stmts.length; i += 50) await env.DB.batch(stmts.slice(i, i + 50));
}

/** POST /me { idToken } : rôle et avatar du compte connecté, lus dans D1 (le site s'en sert si Firestore refuse la lecture). */
async function handleMe(request, env) {
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: String(body.idToken || '') }),
  });
  const uid = (await r.json().catch(() => ({}))).users?.[0]?.localId;
  if (!uid) return json({ error: 'Non connecté' }, 401);
  const row = await d1UserRow(env, 'uid', uid).catch(() => null);
  const u = rowToUser(row);
  return json({ uid, role: u?.role ?? 'membre', pseudo: u?.pseudo ?? null, discordId: u?.discordId ?? null, discordAvatar: u?.discordAvatar ?? null });
}


// ══════════════════════════════════════════════════════════════
//  QUOTA FIRESTORE DU JOUR (Cloud Monitoring) — POST /stats { action: 'quota' }
//  Le compte de service doit avoir le rôle « Lecteur Monitoring » (monitoring.viewer) sur le projet.
//  Offre gratuite : 50 000 lectures, 20 000 écritures, 20 000 suppressions par jour, remis à zéro à minuit (heure du Pacifique).
// ══════════════════════════════════════════════════════════════

const FS_LIMITS = { read: 50000, write: 20000, delete: 20000 };
const HOUR = 3600000;

/** Début (ms) du jour courant à Los Angeles, c.-à-d. la dernière remise à zéro du quota. */
function laDayStart(date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map(x => [x.type, x.value]));
  const elapsed = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Date.UTC(+p.year, +p.month - 1, +p.day);
  return Math.floor(date.getTime() / 1000) * 1000 - elapsed; // à la seconde près : le jour commence pile à minuit
}

async function quotaReport(env) {
  const sa = JSON.parse(env.FIREBASE_SA);
  const token = await saAccessToken(env, 'https://www.googleapis.com/auth/monitoring.read');
  const now = Date.now();
  const dayStart = laDayStart(new Date(now));
  const prevStart = laDayStart(new Date(dayStart - HOUR)); // veille (gère le changement d'heure)
  const hourFloor = Math.floor(now / HOUR) * HOUR;

  // Une série horaire pleine [veille 0 h → heure pleine] + un seul seau pour l'heure en cours
  const series = async (metric, start, end, periodSec) => {
    const u = 'https://monitoring.googleapis.com/v3/projects/' + PROJECT_ID + '/timeSeries?' + new URLSearchParams({
      filter: `metric.type="firestore.googleapis.com/document/${metric}_count"`,
      'interval.startTime': new Date(start).toISOString(), 'interval.endTime': new Date(end).toISOString(),
      'aggregation.alignmentPeriod': periodSec + 's', 'aggregation.perSeriesAligner': 'ALIGN_SUM',
      'aggregation.crossSeriesReducer': 'REDUCE_SUM',
    });
    const r = await fetch(u, { headers: { Authorization: `Bearer ${token}` } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const e = new Error(j.error?.message || `Monitoring ${r.status}`); e.status = r.status; throw e; }
    return (j.timeSeries?.[0]?.points || []).map(p => ({
      end: Date.parse(p.interval.endTime), v: Number(p.value.int64Value ?? p.value.doubleValue ?? 0),
    }));
  };

  const hours = {}; // début d'heure (ms) → { read, write, delete }
  try {
    for (const m of ['read', 'write', 'delete']) {
      const full = await series(m, prevStart, hourFloor, 3600);
      for (const p of full) (hours[p.end - HOUR] ??= { read: 0, write: 0, delete: 0 })[m] += p.v;
      if (now - hourFloor >= 60000) {
        const cur = await series(m, hourFloor, now, Math.round((now - hourFloor) / 1000));
        for (const p of cur) (hours[hourFloor] ??= { read: 0, write: 0, delete: 0 })[m] += p.v;
      }
    }
  } catch (e) {
    if (/billing/i.test(e.message)) return { error: 'billing', projectId: PROJECT_ID, message: e.message };
    if (e.status === 403 || e.status === 401) {
      return { error: 'permission', saEmail: sa.client_email, projectId: PROJECT_ID, message: e.message };
    }
    return { error: 'api', message: e.message };
  }

  const sum = (from, to) => {
    const t = { read: 0, write: 0, delete: 0 };
    for (const [h, v] of Object.entries(hours)) if (+h >= from && +h < to) for (const k in t) t[k] += v[k];
    return t;
  };
  return {
    limits: FS_LIMITS, now, dayStart, resetAt: dayStart + 86400000,
    today: sum(dayStart, Infinity), yesterday: sum(prevStart, dayStart),
    hourly: Object.entries(hours).filter(([h]) => +h >= dayStart).sort((a, b) => a[0] - b[0]).map(([h, v]) => ({ h: +h, ...v })),
  };
}
