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

/** Poste l'item dans le salon : un fil par item (forum) ou un message (salon texte). */
async function postItem(rest, channelId, item, ctx, channelInfo) {
  const it = publicItem(item, ctx);
  const png = await card.generateCardBuffer(it, ctx.maps, 3);
  const name = `${it.id}.png`;
  const content = `**${it.name}** · ${RAR[it.rarity] || it.rarity || ''}\n${WIKI}/Compendium/compendium.html#${it.id}`;
  const icon = await card.generateIconBuffer(it, 160).catch(() => null); // texture : 1re image du message = miniature du post dans la liste du forum
  const files = [...(icon ? [{ name: `${it.id}_texture.png`, data: icon }] : []), { name, data: png }];
  const ch = channelInfo || await rest.get(`/channels/${channelId}`);
  const message = { content, attachments: files.map((f, i) => ({ id: i, filename: f.name })) };
  if (ch.type === 15 || ch.type === 16) { const t = await rest.post(`/channels/${channelId}/threads`, { body: { name: String(it.name).slice(0, 100), message }, files }); return { threadId: t.id, messageId: t.message?.id || null }; }
  const m = await rest.post(`/channels/${channelId}/messages`, { body: message, files });
  return { threadId: null, messageId: m.id };
}

/** Poste tous les items d'un set dans UN post : fil de forum (ou message) au nom du set, une carte par item (10 images par message, la suite en messages suivants). */
async function postSet(rest, channelId, setName, items, ctx, channelInfo) {
  const ch = channelInfo || await rest.get(`/channels/${channelId}`);
  const sorted = [...items].sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
  const links = sorted.map(i => `[${i.name}](<${WIKI}/Compendium/compendium.html#${i.id ?? i._id}>)`).join('\n');
  const files = [];
  for (const item of sorted) {
    const it = publicItem(item, ctx);
    files.push({ name: `${it.id}.png`, data: await card.generateCardBuffer(it, ctx.maps, 3) });
  }
  const icon = await card.generateIconBuffer(publicItem(sorted[0], ctx), 160).catch(() => null);
  if (icon) files.unshift({ name: `${sorted[0].id ?? sorted[0]._id}_texture.png`, data: icon }); // 1re image du message = miniature du post
  const chunks = []; for (let i = 0; i < files.length; i += 10) chunks.push(files.slice(i, i + 10));
  const msgBody = (chunk, first) => ({ content: first ? `**${setName}**\n${links}`.slice(0, 2000) : '', attachments: chunk.map((f, i) => ({ id: i, filename: f.name })) });
  const forum = ch.type === 15 || ch.type === 16;
  let threadId = null; const messageIds = [];
  for (const [n, chunk] of chunks.entries()) {
    if (n === 0 && forum) {
      const t = await rest.post(`/channels/${channelId}/threads`, { body: { name: String(setName).slice(0, 100), message: msgBody(chunk, true) }, files: chunk });
      threadId = t.id; messageIds.push(t.message?.id || null);
    } else {
      const m = await rest.post(`/channels/${forum ? threadId : channelId}/messages`, { body: msgBody(chunk, n === 0), files: chunk });
      messageIds.push(m.id);
    }
  }
  return { threadId, messageId: messageIds[0], messageIds: messageIds.filter(Boolean) };
}

module.exports = { postSet, WORKER, sync, rows, readConfig, buildContext, publicItem, postItem };
