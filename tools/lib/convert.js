/**
 * lib/convert.js — conversion item API SAO -> format wiki (partagé par convert_items.js et sync_api_items.js)
 */
const API_HOST = 'https://api.saominecraft.com';

// ─── Normalisation ───────────────────────────────────────────────────────────
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '_');

// ─── Tables de correspondance (déduites des 696 items déjà présents des deux côtés) ──
const RARITY = { c: 'commun', b: 'rare', a: 'epique', s: 'legendaire', splus: 'mythique', ss: 'mythique', splusplus: 'godlike' };
const RARITY_LABEL = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique', godlike: 'Godlike', event: 'Event' };

// category API -> { category, cat, classes }
const CATEGORY = {
  sword: { category: 'arme', cat: 'arme_p', classes: ['guerrier'] },
  dagger: { category: 'arme', cat: 'arme_p', classes: ['assassin'] },
  bow: { category: 'arme', cat: 'arme_p', classes: ['archer'] },
  crossbow: { category: 'arme', cat: 'arme_p', classes: ['archer'] },
  staff_mage: { category: 'arme', cat: 'arme_p', classes: ['mage'] },
  staff_shaman: { category: 'arme', cat: 'arme_p', classes: ['shaman'] },
  shield: { category: 'arme', cat: 'arme_s' },
  catalyst: { category: 'arme', cat: 'arme_s' },
  armor: { category: 'armure' },            // cat (casque/plastron/jambières/bottes) deviné au nom
  amulet: { category: 'accessoire', cat: 'amulette' },
  ring: { category: 'accessoire', cat: 'anneau' },
  bracelet: { category: 'accessoire', cat: 'bracelet' },
  gloves: { category: 'accessoire', cat: 'gants' },
  artifact: { category: 'accessoire', cat: 'artefact' },
  gem_stone: { category: 'rune', cat: 'rune' },
  material: { category: 'materiaux' },
  miner_job: { category: 'ressources' },
  farmer_job: { category: 'ressources' },
  lumberjack_job: { category: 'ressources' },
  fishing_job: { category: 'ressources' },
  tool: { category: 'outils' },
  consumable: { category: 'consommable' },
  consumable_item: { category: 'consommable' },
  potion_stamina: { category: 'consommable' },
  potion_heal: { category: 'consommable' },
  crystal: { category: 'consommable' },
  fortifier: { category: 'consommable' },
  food: { category: 'nourriture' },
  dungeon_key: { category: 'donjon' },
  key_crate: { category: 'donjon' },
  lunar: { category: 'monnaie' },
  // événements : rareté forcée à "event", catégorie wiki à trier à la main
  halloween: { category: null, event: 'Halloween' },
  noel2025: { category: null, event: 'Noël' },
  saint_valentin: { category: null, event: 'Saint Valentin' },
};
const CATEGORY_LABEL = {
  arme: 'Arme', armure: 'Armure', accessoire: 'Accessoire', materiaux: 'Matériaux', ressources: 'Ressource',
  outils: 'Outil', consommable: 'Consommable', nourriture: 'Nourriture', donjon: 'Donjon', monnaie: 'Monnaie', rune: 'Rune',
};
const ARMOR_CAT = [[/casque|heaume|capuche|chapeau|couronne|masque/, 'casque'], [/plastron|armure|tunique|cuirasse|robe|veste/, 'plastron'],
  [/jambi[eè]res?|pantalon|jambes/, 'jambières'], [/bottes?|chaussures|sandales/, 'bottes']];

// identifications API -> stats wiki
const STAT = {
  'Max Health': 'sante', 'Defense': 'defense', 'Physical Damage': 'degats_physique', 'Magic Damage': 'degats_magique',
  'Projectile Damage': 'degats_projectile', 'Skill Damage': 'degats_competence', 'Weapon Damage': 'degats_arme',
  'Max Stamina': 'stamina', 'Max Mana': 'mana', 'Mana Regeneration': 'regen_mana', 'Stamina Regeneration': 'regen_stamina',
  'Health Regeneration': 'regen_sante', 'Attack Speed': 'vitesse_attaque', 'Movement Speed': 'vitesse_deplacement',
  'Movement_speed': 'vitesse_deplacement', 'Sneaking Speed': 'vitesse_accroupi', 'Heal Bonus': 'soin_bonus',
  'HEAL_BONUS': 'soin_bonus', 'HEAL BONUS': 'soin_bonus', 'Critical Strike Chance': 'crit_chance',
  'Critical Strike Power': 'crit_degats', 'Skill Critical Strike Chance': 'crit_comp_chance',
  'Skill Critical Strike Power': 'crit_comp_degats', 'Lifesteal': 'vol_vie', 'Spell Vampirism': 'omnivamp',
  'Damage Reduction': 'reduction_degats', 'Block Power': 'puissance_bloc', 'Block Rating': 'bloc',
  'Dodge Rating': 'esquive', 'Knockback Resistance': 'tenacite', 'Cooldown Reduction': 'hate',
  'Fall Damage Reduction': 'reduction_chutes',
};
// échelle API -> wiki (mesurée sur les items présents des deux côtés : ratio constant)
const SCALE = { vitesse_deplacement: 1000, tenacite: 100, vitesse_accroupi: 100 };
// identifications consommables -> effects wiki
const EFFECT = {
  'Restore Health': { type: 'heal', unit: 'PV' }, 'Restore Mana': { type: 'mana', unit: 'Mana' },
  'Restore Stamina': { type: 'stamina', unit: 'Stamina' }, 'Restore Food': { type: 'feed', unit: 'Nourriture' },
  'Restore Saturation': { type: 'saturation', unit: 'Saturation' }, 'Item Cooldown': { type: 'cooldown', unit: 's' },
};
// identifications purement techniques (Minecraft / plugin MMO) : ignorées, pas du contenu wiki
const IGNORED = new Set(['Disable Crafting', 'Disable Smelting', 'Disable Interaction', 'Disable Droping', 'Disable Attack Passive',
  'Disable Smithing', 'Disable Repairing', 'Disable Enchanting', 'Disable Right Click Consume', 'Hide Enchants', 'Hide Dye',
  'Max Stack Size', 'Max Item Damage', 'Max Consume', 'Inedible', 'Random Unsocket', 'Durability Bar', 'Classe requise', 'Arme à deux mains']);

// niveau -> palier (déduit des matchs ; ambigu à 1 et 13/14 : on marque la confiance)
function guessPalier(level) {
  if (level == null) return { palier: null, conf: 'none' };
  if (level === 1) return { palier: null, conf: 'none' };
  if (level <= 10) return { palier: 1, conf: 'high' };
  if (level <= 12) return { palier: 2, conf: 'high' };
  if (level === 13) return { palier: 2, conf: 'low' };
  if (level === 14) return { palier: 3, conf: 'low' };
  return { palier: 3, conf: 'high' };
}

const num = v => (v == null || v === '' || isNaN(Number(v))) ? null : Number(v);
const clean = s => String(s || '').replace(/\s*\n\s*/g, ' ').trim();

// Le lore de l'API mélange parfois la compétence de l'arme et la description :
//   "Compétence: GLACIAL_IMPALEMENT\n💥150 dmg | ⌚15s\n\nChaque carreau libère un\nsouffle glaçant…"
// 1er paragraphe = compétence ; 2e = vrai lore ; paragraphes suivants = précisions sur la compétence.
function splitLore(raw) {
  const paras = String(raw || '').split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (!paras.length || !/^Comp[ée]tence\s*:/i.test(paras[0])) return { lore: clean(raw), competence: '' };
  const [head, ...rest] = paras[0].split('\n').map(l => l.trim()).filter(Boolean);
  const nom = head.replace(/^Comp[ée]tence\s*:\s*/i, '').trim();
  const pretty = /^[A-Z0-9_]+$/.test(nom) ? nom.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : nom;
  const [lore = '', ...notes] = paras.slice(1);
  const competence = [pretty, ...rest, ...notes.map(clean)].filter(Boolean).join(' | ');
  return { lore: clean(lore), competence };
}

// ─── Conversion d'un item ────────────────────────────────────────────────────
function convert(x) {
  const map = CATEGORY[x.category] || {};
  const idents = x.identifications || {};
  const flags = [];

  let rarity = RARITY[x.rarity];
  if (!rarity) flags.push(`rareté inconnue "${x.rarity}"`);
  if (map.event) rarity = 'event';
  if (map.category === null) flags.push('catégorie wiki à choisir (item événementiel)');
  if (!CATEGORY[x.category]) flags.push(`catégorie API inconnue "${x.category}"`);

  let cat = map.cat;
  if (x.category === 'armor') {
    const n = norm(x.name);
    const hit = ARMOR_CAT.find(([re]) => re.test(n));
    cat = hit ? hit[1] : undefined;
    if (!cat) flags.push('type d\'armure (casque/plastron/jambières/bottes) non déduit');
  }

  // classes : Classe requise > catégorie d'arme
  let classes = map.classes;
  if (idents['Classe requise']) {
    classes = String(idents['Classe requise']).split(',').map(s => s.trim().toLowerCase())
      .filter(c => ['archer', 'mage', 'shaman', 'assassin', 'guerrier'].includes(c));
  }

  const stats = {}; const effects = []; const unmapped = {};
  for (const [k, v] of Object.entries(idents)) {
    if (STAT[k]) stats[STAT[k]] = SCALE[STAT[k]] && typeof v === 'number' ? +(v * SCALE[STAT[k]]).toFixed(4) : v;
    else if (EFFECT[k]) effects.push({ ...EFFECT[k], value: v });
    else if (!IGNORED.has(k)) unmapped[k] = v;
  }
  // colonnes dédiées de l'API
  const dmg = String(x.damage ?? '');
  if (dmg && map.category === 'arme') {
    const m = dmg.match(/^(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)$/);
    stats.degats = m ? { min: +m[1], max: +m[2] } : num(dmg);
  }
  if (num(x.health) != null) stats.sante = num(x.health);
  if (num(x.defense) != null) stats.defense = num(x.defense);

  const { palier, conf } = guessPalier(x.level);
  if (conf === 'none') flags.push('palier inconnu (niveau 1/absent)');
  else if (conf === 'low') flags.push(`palier déduit du niveau ${x.level} (peu fiable)`);

  const split = splitLore(x.lore);
  const base = slug(x.name);
  const doc = {
    id: palier ? `${base}_p${palier}` : base,
    name: String(x.name).replace(/[’‘]/g, "'").trim(),
    category: map.category || null,
    ...(cat ? { cat } : {}),
    rarity: rarity || null,
    palier,
    ...(x.level != null && x.level > 1 ? { lvl: x.level } : {}),
    ...(classes && classes.length ? { classes } : {}),
    lore: split.lore,
    ...(split.competence ? { competence: split.competence } : {}),
    ...(Object.keys(stats).length ? { stats } : {}),
    ...(effects.length ? { effects } : {}),
    ...(idents['Arme à deux mains'] ? { twoHanded: true } : {}),
    ...(map.event ? { event: true } : {}),
    tags: [RARITY_LABEL[rarity], CATEGORY_LABEL[map.category], palier ? `Palier ${palier}` : null, map.event].filter(Boolean),
    images: [],
    obtain: '',
    _import: {
      source: 'saominecraft-api',
      apiId: x.id,
      mmoKey: x.mmo_key || null,
      apiCategory: x.category,
      apiRarity: x.rarity,
      apiLevel: x.level,
      imageUrl: x.image_url ? (x.image_url.startsWith('http') ? x.image_url : API_HOST + x.image_url) : null,
      apiUpdatedAt: x.updated_at || null,
      ...(Object.keys(unmapped).length ? { unmapped } : {}),
    },
  };
  return { doc, flags };
}

module.exports = { norm, slug, convert, API_HOST, RARITY, CATEGORY };
