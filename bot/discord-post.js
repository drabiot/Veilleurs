/* ══════════════════════════════════════════════
   BOT — Envoi d'items (avec leur carte image) dans un salon Discord par son ID, sans webhook.
   Utilisé par discord-watch.js (automatique) et Save/discord-send.js (manuel).
══════════════════════════════════════════════ */
const path = require('path');
process.env.WIKI_ROOT ??= path.join(__dirname, '..'); // dépôt du site (Compendium/data.js lu par card.js)
const card = require('./card.js');

const WORKER = 'https://veilleurs.veilleurs-wiki.workers.dev';
const WIKI   = 'https://drabiot.github.io/Veilleurs';
const RAR    = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique', godlike: 'Godlike', event: 'Event' };
const SECRET_OBTAIN = "Forgeron d'items secret - Position cachée pour l'instant";

const sync = async (col, since = 0) => (await fetch(`${WORKER}/db/sync?col=${col}&since=${since}`)).json();
const rows = j => j.docs.map(x => ({ _id: x.id, ...x.d }));
async function readConfig(id) {
  try {
    const r = await (await fetch(`${WORKER}/db/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ col: 'config', id }) })).json();
    return r.doc?.d || {};
  } catch { return {}; }
}

/** Données nécessaires au dessin des cartes + liste des forgerons / items secrets à masquer (voir moderation « Forgerons secrets »). */
async function buildContext() {
  const [items, panoplies, pnj, sf] = await Promise.all([sync('items').then(rows), sync('panoplies').then(rows), sync('personnages').then(rows), readConfig('secret_forgerons')]);
  const maps = { panoplieData: {}, panoplieMap: {}, pnjMap: {}, allItems: items.map(i => ({ ...i, id: i.id ?? i._id })) };
  panoplies.forEach(p => { const id = p.id ?? p._id; maps.panoplieData[id] = p; maps.panoplieMap[id] = p.label || p.name || id; }); // le nom d'un set est dans « label » (comme sur le site)
  pnj.forEach(p => { maps.pnjMap[p.id ?? p._id] = p; });
  const hidden = sf.hidden !== false;
  const revealedPnj = new Set(sf.revealedPnj || []), revealedItems = new Set(sf.revealedItems || []);
  const secretPnj = new Set(pnj.filter(p => hidden && (['fabricant_secrets', 'fabricant_secret', 'forgeron_items_secrets'].includes(p.tag)
    || ["forgeron d'items secrets", 'fabricant secret'].includes(String(p.type || '').toLowerCase()) || (sf.pnj || []).includes(p.id ?? p._id)) && !revealedPnj.has(p.id ?? p._id)).map(p => p.id ?? p._id));
  const secretItems = new Set(hidden ? (sf.items || []).filter(i => !revealedItems.has(i)) : []);
  return { maps, secretPnj, secretItems };
}

/** Item prêt à dessiner : l'obtain ne révèle ni nom ni lieu d'un forgeron secret. */
function publicItem(item, ctx) {
  const id = item.id ?? item._id;
  let obtain = item.obtain;
  if (ctx.secretItems.has(id)) obtain = SECRET_OBTAIN;
  else if (typeof obtain === 'string') obtain = obtain.split('\n').map(l => [...ctx.secretPnj].some(p => l.includes(`[npc:${p}|`) || l.includes(`[npc:${p}]`)) ? SECRET_OBTAIN : l).join('\n');
  return { ...item, id, obtain };
}

// ── Tags de forum par événement (Noël 2025, Halloween 2025…) ──
// Un tag par événement : créé dans le forum s'il manque (20 tags max par forum), puis appliqué au fil. Emoji = celui de l'événement dans la modération.
const normTag = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüœ]/g, '');
/** Nom de tag Discord : 20 caractères max (on retire l'année si le nom est trop long). */
const tagName = n => { let t = String(n).trim(); if (t.length > 20) t = t.replace(/\s+20\d\d$/, ''); return t.slice(0, 20); };
let _events = null;
async function loadEvents() {
  if (_events) return _events;
  try {
    const r = await (await fetch(`${WORKER}/db/read`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ col: 'events' }) })).json();
    _events = (r.docs || []).map(x => ({ name: x.d.name, emoji: x.d.emoji || '🎊' })).filter(e => e.name);
  } catch { _events = []; }
  return _events;
}
/** Événement d'un item (nom exact du champ item.event), seulement pour les items du palier Event. */
const eventOf = it => (String(it.palier) === 'event' && typeof it.event === 'string' && it.event.trim() ? it.event.trim() : null);
/** S'assure que les tags des événements voulus existent dans le forum ; met à jour ch.available_tags. Une seule modification du salon par appel (Discord limite ces modifications). */
async function ensureEventTags(rest, channelId, ch, eventNames) {
  if (!(ch.type === 15 || ch.type === 16) || !eventNames.length) return;
  const events = await loadEvents();
  const have = ch.available_tags || [];
  const missing = [...new Set(eventNames)].filter(n => !have.some(t => normTag(t.name) === normTag(tagName(n))));
  if (!missing.length) return;
  const keep = have.map(t => ({ id: t.id, name: t.name, moderated: !!t.moderated, emoji_id: t.emoji_id || null, emoji_name: t.emoji_name || null }));
  const add = missing.slice(0, Math.max(0, 20 - have.length)).map(n => ({ name: tagName(n), emoji_name: (events.find(e => e.name === n) || {}).emoji || null }));
  if (!add.length) return;
  const updated = await rest.patch(`/channels/${channelId}`, { body: { available_tags: [...keep, ...add] } });
  ch.available_tags = updated.available_tags || ch.available_tags;
}
const tagIdFor = (ch, eventName) => eventName ? (ch.available_tags || []).find(t => normTag(t.name) === normTag(tagName(eventName)))?.id : undefined;

/** Poste un message de tête (texte + texture = miniature du post) puis chaque carte dans SON propre message, à la chaîne (pas de grille d'images empilées).
 *  Forum : un fil (le message de tête en est le premier message) ; salon texte : messages à la suite. Renvoie les ids pour pouvoir tout supprimer / remplacer. */
async function postChain(rest, channelId, ch, title, content, icon, cards, tagIds = []) {
  const forum = ch.type === 15 || ch.type === 16;
  const queue = [...cards];
  const head = icon ? [icon] : [queue.shift()]; // sans texture, la première carte ouvre le post
  const body = (files, text) => ({ content: text, attachments: files.map((x, i) => ({ id: i, filename: x.name })) });
  let threadId = null; const ids = [];
  if (forum) {
    const t = await rest.post(`/channels/${channelId}/threads`, { body: { name: String(title).slice(0, 100), message: body(head, content), ...(tagIds.length ? { applied_tags: tagIds.slice(0, 5) } : {}) }, files: head });
    threadId = t.id; ids.push(t.message?.id || null);
  } else {
    const m = await rest.post(`/channels/${channelId}/messages`, { body: body(head, content), files: head });
    ids.push(m.id);
  }
  const target = forum ? threadId : channelId;
  for (const card1 of queue) {
    const m = await rest.post(`/channels/${target}/messages`, { body: body([card1], ''), files: [card1] });
    ids.push(m.id);
  }
  return { threadId, messageId: ids[0], messageIds: ids.filter(Boolean) };
}

/** Poste l'item dans le salon : un fil par item (forum) ou des messages (salon texte). */
async function postItem(rest, channelId, item, ctx, channelInfo, opts = {}) {
  const it = publicItem(item, ctx);
  const ch = channelInfo || await rest.get(`/channels/${channelId}`);
  const cardFile = { name: `${it.id}.png`, data: await card.generateCardBuffer(it, ctx.maps, 3) };
  const icon = await card.generateIconBuffer(it, 160).catch(() => null); // texture : 1re image du fil = miniature dans la liste du forum
  const content = `**${it.name}** · ${RAR[it.rarity] || it.rarity || ''}\n[Voir sur le wiki](<${WIKI}/Compendium/compendium.html#${it.id}>)`;
  return postChain(rest, channelId, ch, it.name, content, icon && { name: `${it.id}_texture.png`, data: icon }, [cardFile], opts.eventTags ? [tagIdFor(ch, eventOf(it))].filter(Boolean) : []);
}

/** Poste tous les items d'un set dans UN post au nom du set : liste de liens nommés, texture du premier item en miniature, puis une carte par message. */
async function postSet(rest, channelId, setName, items, ctx, channelInfo, opts = {}) {
  const ch = channelInfo || await rest.get(`/channels/${channelId}`);
  const sorted = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  const links = sorted.map(i => `[${i.name}](<${WIKI}/Compendium/compendium.html#${i.id ?? i._id}>)`).join('\n');
  const cards = [];
  for (const item of sorted) {
    const it = publicItem(item, ctx);
    cards.push({ name: `${it.id}.png`, data: await card.generateCardBuffer(it, ctx.maps, 3) });
  }
  const first = publicItem(sorted[0], ctx);
  const icon = await card.generateIconBuffer(first, 160).catch(() => null);
  return postChain(rest, channelId, ch, setName, `**${setName}**\n${links}`.slice(0, 2000), icon && { name: `${first.id ?? first._id}_texture.png`, data: icon }, cards, opts.eventTags ? [tagIdFor(ch, sorted.map(eventOf).find(Boolean))].filter(Boolean) : []);
}

module.exports = { ensureEventTags, eventOf, postSet, WORKER, sync, rows, readConfig, buildContext, publicItem, postItem };
