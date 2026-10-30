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
  panoplies.forEach(p => { const id = p.id ?? p._id; maps.panoplieData[id] = p; maps.panoplieMap[id] = p.name || id; });
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

/** Poste un message de tête (texte + texture = miniature du post) puis chaque carte dans SON propre message, à la chaîne (pas de grille d'images empilées).
 *  Forum : un fil (le message de tête en est le premier message) ; salon texte : messages à la suite. Renvoie les ids pour pouvoir tout supprimer / remplacer. */
async function postChain(rest, channelId, ch, title, content, icon, cards) {
  const forum = ch.type === 15 || ch.type === 16;
  const queue = [...cards];
  const head = icon ? [icon] : [queue.shift()]; // sans texture, la première carte ouvre le post
  const body = (files, text) => ({ content: text, attachments: files.map((x, i) => ({ id: i, filename: x.name })) });
  let threadId = null; const ids = [];
  if (forum) {
    const t = await rest.post(`/channels/${channelId}/threads`, { body: { name: String(title).slice(0, 100), message: body(head, content) }, files: head });
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
async function postItem(rest, channelId, item, ctx, channelInfo) {
  const it = publicItem(item, ctx);
  const ch = channelInfo || await rest.get(`/channels/${channelId}`);
  const cardFile = { name: `${it.id}.png`, data: await card.generateCardBuffer(it, ctx.maps, 3) };
  const icon = await card.generateIconBuffer(it, 160).catch(() => null); // texture : 1re image du fil = miniature dans la liste du forum
  const content = `**${it.name}** · ${RAR[it.rarity] || it.rarity || ''}\n[Voir sur le wiki](<${WIKI}/Compendium/compendium.html#${it.id}>)`;
  return postChain(rest, channelId, ch, it.name, content, icon && { name: `${it.id}_texture.png`, data: icon }, [cardFile]);
}

/** Poste tous les items d'un set dans UN post au nom du set : liste de liens nommés, texture du premier item en miniature, puis une carte par message. */
async function postSet(rest, channelId, setName, items, ctx, channelInfo) {
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
  return postChain(rest, channelId, ch, setName, `**${setName}**\n${links}`.slice(0, 2000), icon && { name: `${first.id ?? first._id}_texture.png`, data: icon }, cards);
}

module.exports = { postSet, WORKER, sync, rows, readConfig, buildContext, publicItem, postItem };
