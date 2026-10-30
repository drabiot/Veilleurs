/* ══════════════════════════════════════════════
   BOT — Envoi multi-serveurs (serveurs inscrits via Discord/discord.html).
   Lancé toutes les 10 min par GitHub Actions (.github/workflows/discord-bot.yml) via discord-watch.js --once.
   Lit dans le worker (POST /guild/bot, secret ADMIN_SECRET) la configuration de tous les serveurs ;
   n'envoie que pour status = approved ET paused = false.

   État par serveur, gardé dans le worker (D1, docs col 'bot_state', clé guild_<id>) — pas de fichier local :
     { posts: { <itemId>: { channelId, threadId, messageId, h } }, seen: { <itemId>: 1 }, baselined, locks }
   - posts : ce que le bot a posté (pour supprimer / remplacer) ; h = empreinte de l'item au moment du post.
   - seen : items déjà dans le wiki à l'inscription quand « seulement les nouveaux » (jamais postés tant qu'ils ne reçoivent pas de post).
   - locks : droits d'origine des salons masqués pendant un gros envoi (rétablis au passage suivant même après un plantage).
   Mise à jour d'un item = suppression de l'ancien post puis nouveau post (si « remplacer » est actif).
   Débit : DISCORD_GUILD_BATCH posts max par serveur et par passage (40), 1,5 s entre deux posts, discord.js gère les 429 ;
   le passage s'arrête proprement après RUN_MINUTES (12) : le reste est repris au passage suivant.
   Au-delà de 100 serveurs, Discord exige la vérification du bot.
══════════════════════════════════════════════ */
const crypto = require('crypto');
const dp = require('./discord-post.js');

const VIEW = 1n << 10n;
const BOT_ALLOW = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 34n) | (1n << 35n) | (1n << 38n);
const BATCH = parseInt(process.env.DISCORD_GUILD_BATCH, 10) || 40;
const log = (...a) => console.log(`[discord-guilds ${new Date().toISOString().slice(11, 19)}]`, ...a);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const has = (l, v) => (l || []).map(String).includes(String(v));

const DEADLINE = () => pass.deadline;
const timeUp = () => Date.now() > DEADLINE();
const loadGuildState = async id => { const v = (await workerBot('state_get', { key: 'guild_' + id })).value; return { posts: {}, seen: {}, baselined: false, locks: {}, ...(v || {}) }; };
const saveGuildState = (id, st) => workerBot('state_set', { key: 'guild_' + id, value: st });

async function workerBot(action, extra = {}) {
  const r = await fetch(`${dp.WORKER}/guild/bot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: process.env.ADMIN_SECRET, action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('worker ' + r.status));
  return j;
}

// ── Items du wiki, gardés en mémoire (synchro incrémentale) ──
const items = new Map();
let itemsRev = 0;
async function refreshItems() {
  const j = await dp.sync('items', itemsRev);
  if (j.error) throw new Error('items : ' + j.error);
  for (const x of j.docs) items.set(x.id, { _id: x.id, ...x.d });
  for (const id of j.deleted || []) items.delete(id);
  itemsRev = j.rev;
}
const hashOf = it => crypto.createHash('sha1').update(JSON.stringify(it)).digest('base64').slice(0, 12);

/** Salon d'un serveur qui reçoit cet item (le plus précis gagne) ; null = non concerné. */
function route(cfg, it) {
  if (!it.category || it.palier == null) return null;
  const fits = (list, v) => !(list || []).length || has(list, v);
  if (!fits(cfg.itemCats, it.category) || !fits(cfg.paliers, it.palier)) return null;
  if (Number(it.palier) === -1 && !has(cfg.paliers, '-1')) return null; // l'archive n'est postée que si elle est choisie
  const spec = c => ((c.itemCats || []).length > 0) + ((c.paliers || []).length > 0);
  return (cfg.channels || []).filter(c => c.id && fits(c.itemCats, it.category) && fits(c.paliers, it.palier)).sort((a, b) => spec(b) - spec(a))[0] || null;
}

/** Travail à faire pour un serveur : { todo: [{ it, ch, old?, h }], hashFix: [[itemId, h]] , gone: [itemId] }. Pur (testé). */
function plan(cfg, st, itemMap) {
  const todo = [], hashFix = [], gone = [];
  for (const [id, it] of itemMap) {
    const ch = route(cfg, it);
    if (!ch) continue;
    const h = hashOf(it), e = st.posts[id];
    if (!e) { if (!st.seen[id]) todo.push({ it, ch, h }); continue; }
    if (e.channelId !== ch.id) todo.push({ it, ch, h, old: e });           // règle changée : déplacé
    else if (e.h !== h) { if (cfg.replace !== false) todo.push({ it, ch, h, old: e }); else hashFix.push([id, h]); }
  }
  for (const id of Object.keys(st.posts)) if (!itemMap.has(id)) gone.push(id); // item supprimé du wiki
  const pal = p => (p == null ? 999 : isNaN(Number(p)) ? 500 : Number(p));
  todo.sort((a, b) => pal(a.it.palier) - pal(b.it.palier) || String(a.it.category).localeCompare(b.it.category));
  return { todo, hashFix, gone };
}

// ── Suppression d'un post suivi ──
async function deletePost(rest, e) {
  try {
    if (e.threadId) await rest.delete(`/channels/${e.threadId}`);
    else if (e.messageId) await rest.delete(`/channels/${e.channelId}/messages/${e.messageId}`);
  } catch (err) { if (![404, 403, 10003, 10008].includes(err.status) && ![10003, 10008, 50001].includes(err.code)) throw err; } // déjà supprimé / plus accessible : on oublie
}

// ── Masquage anti-ping pendant un gros envoi ──
let botId = null;
async function lock(rest, st, channelId) {
  const ch = await rest.get(`/channels/${channelId}`);
  const guildId = ch.guild_id, ovs = ch.permission_overwrites || [];
  botId ??= (await rest.get('/users/@me')).id;
  if (!st.locks[channelId]) {
    const ev = ovs.find(o => o.id === guildId);
    const targets = [{ id: guildId, type: 0, existed: !!ev, allow: ev?.allow || '0', deny: ev?.deny || '0' }];
    for (const o of ovs) if (o.id !== guildId && o.id !== botId && (BigInt(o.allow) & VIEW)) targets.push({ id: o.id, type: o.type, existed: true, allow: o.allow, deny: o.deny });
    st.locks[channelId] = targets; await saveGuildState(st._id, st);
  }
  await rest.put(`/channels/${channelId}/permissions/${botId}`, { body: { type: 1, allow: BOT_ALLOW.toString(), deny: '0' } }); // le bot garde l'accès
  for (const t of st.locks[channelId]) await rest.put(`/channels/${channelId}/permissions/${t.id}`, { body: { type: t.type, allow: (BigInt(t.allow) & ~VIEW).toString(), deny: (BigInt(t.deny) | VIEW).toString() } });
}
async function unlock(rest, st, channelId) {
  for (const t of st.locks[channelId] || []) {
    try {
      if (t.existed) await rest.put(`/channels/${channelId}/permissions/${t.id}`, { body: { type: t.type, allow: t.allow, deny: t.deny } });
      else await rest.delete(`/channels/${channelId}/permissions/${t.id}`);
    } catch (e) { if (e.status !== 404) throw e; }
  }
  delete st.locks[channelId]; await saveGuildState(st._id, st);
}

// ── Purge / désinstallation ──
async function purgePosts(rest, st) {
  let n = 0;
  for (const [id, e] of Object.entries(st.posts)) { await deletePost(rest, e); delete st.posts[id]; n++; await sleep(500); }
  st.seen = {}; st.baselined = false;
  return n;
}
async function uninstall(rest, g, st) {
  const rm = g.removal || {};
  if (rm.deleteChannels) {
    for (const c of g.channels || []) if (c.created && c.id) { try { await rest.delete(`/channels/${c.id}`); } catch (e) { if (e.status !== 404) log('suppression salon', c.id, e.message); } await sleep(500); }
    let all = []; try { all = await rest.get(`/guilds/${g.id}/channels`); } catch { /* serveur déjà quitté */ }
    for (const cid of g.createdCategories || []) { // catégorie créée par le bot : supprimée seulement si elle est vide
      if (all.some(x => x.parent_id === cid)) continue;
      try { await rest.delete(`/channels/${cid}`); } catch (e) { if (e.status !== 404) log('suppression catégorie', cid, e.message); }
      await sleep(500);
    }
  } else if (rm.deletePosts) await purgePosts(rest, st);
  for (const chId of Object.keys(st.locks)) { try { await unlock(rest, st, chId); } catch { /* salon supprimé */ } }
  try { await rest.delete(`/users/@me/guilds/${g.id}`); } catch (e) { if (e.status !== 404) log('quitter', g.id, e.message); }
}

// ── Un passage sur un serveur ──
async function guildPass(rest, g, st, getCtx) {
  const cfg = g;
  for (const chId of Object.keys(st.locks)) { try { await unlock(rest, st, chId); } catch { delete st.locks[chId]; } } // verrou resté après un plantage
  if (g.purge) {
    const n = await purgePosts(rest, st);
    log(`${g.guildName} : ${n} post(s) supprimé(s) sur demande.`);
    await workerBot('report', { guildId: g.id, patch: { purge: false, posted: 0, pending: 0, lastError: '' } });
    return;
  }
  if (g.status !== 'approved' || g.paused || !items.size) return;

  if (!st.baselined) { // « seulement les nouveaux » : les items déjà dans le wiki sont notés comme vus
    if (cfg.initial !== 'all') for (const [id, it] of items) if (route(cfg, it)) st.seen[id] = 1;
    st.baselined = true;
  }
  const { todo, hashFix, gone } = plan(cfg, st, items);
  for (const [id, h] of hashFix) st.posts[id].h = h;
  let error = '', sent = 0;
  for (const id of gone) { try { await deletePost(rest, st.posts[id]); delete st.posts[id]; await sleep(500); } catch (e) { error = e.message; } }

  const batch = todo.slice(0, BATCH);
  if (batch.length) {
    const ctx = await getCtx();
    const counts = new Map();
    batch.forEach(b => counts.set(b.ch.id, (counts.get(b.ch.id) || 0) + 1));
    const threshold = Number.isFinite(cfg.hideThreshold) ? cfg.hideThreshold : 10;
    const locked = [];
    const chInfo = new Map();
    try {
      if (threshold > 0) for (const [chId, n] of counts) if (n > threshold) { try { await lock(rest, st, chId); locked.push(chId); } catch (e) { log(`${g.guildName} : masquage impossible (${e.message}), envoi quand même`); } }
      for (const b of batch) {
        if (timeUp()) break;
        try {
          if (!chInfo.has(b.ch.id)) chInfo.set(b.ch.id, await rest.get(`/channels/${b.ch.id}`));
          if (b.old) { await deletePost(rest, b.old); delete st.posts[b.it._id]; }
          const r = await dp.postItem(rest, b.ch.id, b.it, ctx, chInfo.get(b.ch.id));
          st.posts[b.it._id] = { channelId: b.ch.id, threadId: r.threadId, messageId: r.messageId, h: b.h };
          sent++;
          await saveGuildState(g.id, st);
          await sleep(1500);
        } catch (e) {
          error = `${b.it.name} : ${e.message}`;
          log(`${g.guildName} : échec ${error}`);
          if ([10003, 50001, 50013].includes(e.code) || [403, 404].includes(e.status)) break; // salon supprimé / droits retirés : inutile d'insister ce passage
        }
      }
    } finally {
      for (const chId of locked) { try { await unlock(rest, st, chId); } catch (e) { log(`⚠️ visibilité non rétablie (${chId}) : ${e.message}`); error = 'visibilité non rétablie sur un salon'; } }
    }
  }
  const pending = Math.max(0, todo.length - sent);
  const patch = { posted: Object.keys(st.posts).length, pending, initialDone: pending === 0 };
  if (sent) patch.lastSentAt = Date.now();
  if (error || g.lastError) patch.lastError = error;
  if (sent || error || g.lastError || g.posted !== patch.posted || g.pending !== pending) await workerBot('report', { guildId: g.id, patch });
  if (sent) log(`${g.guildName} : ${sent} post(s) envoyé(s), ${pending} restant(s).`);
}

/** Passage complet sur tous les serveurs inscrits. */
async function pass(rest) {
  if (!process.env.ADMIN_SECRET) { if (!pass.warned) { pass.warned = true; log('ADMIN_SECRET absent : envoi multi-serveurs désactivé.'); } return; }
  pass.deadline = Date.now() + (parseFloat(process.env.RUN_MINUTES) || 12) * 60e3;
  const { guilds } = await workerBot('list');
  const active = guilds.filter(g => g.status === 'removing' || g.purge || (g.status === 'approved' && !g.paused));
  let ctxP = null;
  const getCtx = () => (ctxP ??= dp.buildContext());
  if (active.some(g => g.status === 'approved' && !g.paused)) await refreshItems();
  for (const g of active) {
    if (timeUp()) { log('Durée maximale atteinte : suite au prochain passage.'); break; }
    const st = await loadGuildState(g.id); st._id = g.id;
    try {
      if (g.status === 'removing') {
        await uninstall(rest, g, st);
        await workerBot('ack_remove', { guildId: g.id });
        await workerBot('state_set', { key: 'guild_' + g.id, value: null });
        log(`${g.guildName || g.id} : désinstallé.`);
        continue;
      }
      await guildPass(rest, g, st, getCtx);
    } catch (e) {
      log(`${g.guildName || g.id} : erreur ${e.message}`);
      try { await workerBot('report', { guildId: g.id, patch: { lastError: String(e.message).slice(0, 300) } }); } catch { /* worker injoignable */ }
    }
    await saveGuildState(g.id, st);
  }
}

module.exports = { pass, route, plan, hashOf };
