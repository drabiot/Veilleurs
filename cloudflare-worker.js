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
  return String(str).replace(/\[obtain:([\w-]+)\]/g, (_, id) => (OBTAIN_TEXTS && OBTAIN_TEXTS[id]) || id);
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
  await loadObtainTexts();

  // PING → PONG
  if (interaction.type === 1) return iResponse({ type: 1 });

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
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
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
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}
