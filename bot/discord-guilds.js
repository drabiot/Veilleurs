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
   Débit : jusqu'à DISCORD_GUILD_BATCH (400) posts par serveur et par passage, 0,8 s entre deux posts, discord.js gère les 429 ;
   le passage s'arrête proprement après RUN_MINUTES (14) ; s'il reste des posts et que ça avance, le workflow se relance aussitôt (voir discord-bot.yml).
   Au-delà de 100 serveurs, Discord exige la vérification du bot.
══════════════════════════════════════════════ */
const crypto = require('crypto');
const dp = require('./discord-post.js');

const VIEW = 1n << 10n;
const BOT_ALLOW = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 34n) | (1n << 35n) | (1n << 38n);
const BATCH = parseInt(process.env.DISCORD_GUILD_BATCH, 10) || 400; // posts max par serveur et par passage (le passage s'arrête de toute façon à RUN_MINUTES)
const CONCURRENCY = parseInt(process.env.DISCORD_CONCURRENCY, 10) || 4; // salons traités en parallèle
const POST_DELAY = parseInt(process.env.DISCORD_POST_DELAY_MS, 10) || 800; // pause entre deux posts d'un même salon ; discord.js gère les 429 en plus
const sigOf = g => [g.updatedAt || 0, g.status, !!g.paused, g.initial, !!g.groupSets, !!g.eventTags, g.replace !== false].join('|');
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

// ── Items du wiki : seulement ce qui a changé depuis la révision la plus ancienne des serveurs actifs ──
// Lecture complète (since = 0) seulement si un serveur en a besoin : premier passage, envoi en cours, réglages modifiés.
const items = new Map();
const fetched = { rev: 0, full: false, deleted: [] };
async function refreshItems(since) {
  const j = await dp.sync('items', since);
  if (j.error) throw new Error('items : ' + j.error);
  items.clear();
  for (const x of j.docs) items.set(x.id, { _id: x.id, ...x.d });
  Object.assign(fetched, { rev: j.rev, full: since === 0, deleted: j.deleted || [] });
}
// Empreinte stable : clés triées, sans identifiants (un même item lu de deux façons donne la même empreinte)
const stable = it => JSON.stringify(Object.fromEntries(Object.entries(it).filter(([k]) => k !== '_id' && k !== 'id').sort(([a], [b]) => (a < b ? -1 : 1))));
const hashOf = x => crypto.createHash('sha1').update(Array.isArray(x) ? x.map(stable).join('|') : stable(x)).digest('base64').slice(0, 12);

/** Salon d'un serveur qui reçoit cet item (le plus précis gagne) ; null = non concerné. */
function route(cfg, it) {
  if (!it.category || it.palier == null) return null;
  const fits = (list, v) => !(list || []).length || has(list, v);
  if (!fits(cfg.itemCats, it.category) || !fits(cfg.paliers, it.palier)) return null;
  if (Number(it.palier) === -1 && !has(cfg.paliers, '-1')) return null; // l'archive n'est postée que si elle est choisie
  const spec = c => ((c.itemCats || []).length > 0) + ((c.paliers || []).length > 0);
  return (cfg.channels || []).filter(c => c.id && fits(c.itemCats, it.category) && fits(c.paliers, it.palier)).sort((a, b) => spec(b) - spec(a))[0] || null;
}

/** L'item concerne-t-il ce salon du plan (même si le salon n'est pas encore créé) ? */
function fitsChannel(cfg, c, it) {
  if (!it.category || it.palier == null) return false;
  const fits = (list, v) => !(list || []).length || has(list, v);
  if (!fits(cfg.itemCats, it.category) || !fits(cfg.paliers, it.palier) || !fits(c.itemCats, it.category) || !fits(c.paliers, it.palier)) return false;
  return !(Number(it.palier) === -1 && !has(c.paliers, '-1') && !has(cfg.paliers, '-1'));
}

/** Travail à faire pour un serveur. Pur (testé).
 *  Unité de publication = un item, ou (option « grouper les sets ») tous les items d'un même set d'un même salon (clé « set:<set>|<salon> »).
 *  → { todo: [{ key, it, items, ch, h, old? }], hashFix: [[clé, h]], gone: [clé] } */
function plan(cfg, st, itemMap, full = true, deleted = [], gate = null) {
  const approved = i => !!gate && gate.q[i._id] > (st.ap?.[i._id] || 0); // soumission approuvée depuis le dernier envoi de cet item
  const units = new Map();
  for (const [id, it] of itemMap) {
    const ch = route(cfg, it);
    if (!ch) continue;
    if (cfg.groupSets && it.set) {
      const key = `set:${it.set}|${ch.id}`;
      if (!units.has(key)) units.set(key, { key, set: it.set, items: [], ch });
      units.get(key).items.push({ ...it, _id: it._id ?? id });
    } else units.set(id, { key: id, items: [{ ...it, _id: it._id ?? id }], ch });
  }
  const todo = [], hashFix = [], gone = [];
  for (const u of units.values()) {
    u.items.sort((a, b) => (a._id < b._id ? -1 : 1));
    u.it = u.items[0];
    u.h = u.set ? hashOf(u.items) : hashOf(u.it);
    const e = st.posts[u.key];
    if (!e) { if (u.items.some(i => !st.seen[i._id] || approved(i))) todo.push({ ...u }); continue; }
    if (e.channelId !== u.ch.id) todo.push({ ...u, old: e });          // règle changée : déplacé
    else if (e.h !== u.h) { if (cfg.replace !== false && (!gate || u.items.some(approved))) todo.push({ ...u, old: e }); else hashFix.push([u.key, u.h]); } // avec le filtre : un item modifié sans passer par une soumission approuvée n'est pas renvoyé
  }
  // supprimé du wiki : tous les items du post absents de la lecture complète, ou tous listés comme supprimés (lecture incrémentale)
  for (const [key, e] of Object.entries(st.posts)) {
    if (units.has(key)) continue;
    const ids = e.ids || [key];
    if (full ? ids.every(i => !itemMap.has(i)) : ids.every(i => deleted.includes(i))) gone.push(key);
  }
  const pal = p => (p == null ? 999 : isNaN(Number(p)) ? 500 : Number(p));
  todo.sort((a, b) => pal(a.it.palier) - pal(b.it.palier) || String(a.it.category).localeCompare(b.it.category));
  return { todo, hashFix, gone };
}

// ── Suppression d'un post suivi ──
const SNOWF = /^\d{15,25}$/;
async function deletePost(rest, e) {
  if ([e.threadId, e.messageId, ...(e.messageIds || [])].filter(Boolean).some(x => !SNOWF.test(String(x))) || (e.channelId && !SNOWF.test(String(e.channelId)))) return; // identifiant suspect : on n'appelle pas Discord
  try {
    if (e.threadId) await rest.delete(`/channels/${e.threadId}`);
    else if (e.messageIds?.length) for (const m of e.messageIds) await rest.delete(`/channels/${e.channelId}/messages/${m}`);
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
    for (const c of g.channels || []) if (c.created && c.id && SNOWF.test(String(c.id))) { try { await rest.delete(`/channels/${c.id}`); } catch (e) { if (e.status !== 404) log('suppression salon', c.id, e.message); } await sleep(500); }
    let all = []; try { all = await rest.get(`/guilds/${g.id}/channels`); } catch { /* serveur déjà quitté */ }
    for (const cid of g.createdCategories || []) { // catégorie créée par le bot : supprimée seulement si elle est vide
      if (!SNOWF.test(String(cid)) || all.some(x => x.parent_id === cid)) continue;
      try { await rest.delete(`/channels/${cid}`); } catch (e) { if (e.status !== 404) log('suppression catégorie', cid, e.message); }
      await sleep(500);
    }
  } else if (rm.deletePosts) await purgePosts(rest, st);
  for (const chId of Object.keys(st.locks)) { try { await unlock(rest, st, chId); } catch { /* salon supprimé */ } }
  try { await rest.delete(`/users/@me/guilds/${g.id}`); } catch (e) { if (e.status !== 404) log('quitter', g.id, e.message); }
}

const setLabel = (ctx, id) => { const p = ctx.maps.panoplieData?.[id]; return p?.label || p?.name || String(id).replace(/_/g, ' '); };

// ── Un passage sur un serveur ──
async function guildPass(rest, g, st, getCtx) {
  st.subs ||= {}; // salons dont les items déjà présents dans le wiki ont été notés « vus » à l'inscription
  const eligible = (g.channels || []).filter(c => c.subscribed !== false && !c.skip);
  const cfg = { ...g, channels: eligible };
  const doneReq = []; // demandes d'envoi à la demande traitées
  const doneItems = []; // demandes « renvoyer cet item » traitées
  const logs = []; // entrées d'historique visibles dans la modération
  const badCh = new Set(); // salons introuvables (supprimés sur Discord)
  for (const chId of Object.keys(st.locks)) { try { await unlock(rest, st, chId); } catch { delete st.locks[chId]; } } // verrou resté après un plantage
  if (g.purge) {
    const n = await purgePosts(rest, st);
    log(`${g.guildName} : ${n} post(s) supprimé(s) sur demande.`);
    await workerBot('report', { guildId: g.id, patch: { purge: false, posted: 0, pending: 0, lastError: '', log: [`Bot : ${n} post(s) supprimé(s) sur demande`] } });
    return;
  }
  if (g.status !== 'approved' || g.paused || (fetched.full && !items.size)) return;

  if (!!st.groupSets !== !!cfg.groupSets) {
    for (const [key, e] of Object.entries(st.posts)) { if (timeUp()) return; await deletePost(rest, e); delete st.posts[key]; await sleep(500); }
    st.groupSets = !!cfg.groupSets;
    st.rev = 0; // lecture complète
    return; // le repost se fait au passage suivant (lecture complète)
  }
  if (st.baselined && cfg.initial === 'all' && st.initial !== 'all') { // passage de « nouveaux seulement » à « tous » : les items notés comme vus doivent maintenant partir
    const n = Object.keys(st.seen).length;
    st.seen = {};
    logs.push(`Bot : « tous les items » activé, ${n} item(s) ignorés jusque-là vont partir`);
  }
  st.initial = cfg.initial;
  if (!st.baselined) { // « seulement les nouveaux » : les items déjà dans le wiki sont notés comme vus
    const matching = [...items.values()].filter(it => (cfg.channels || []).some(c => fitsChannel(cfg, c, it)));
    const concerned = [...items.values()].filter(it => it.category && it.palier != null);
    if (cfg.initial !== 'all') for (const it of matching) st.seen[it._id] = 1;
    st.baselined = true;
    if (cfg._main) await mergeBrowserPosts(rest, cfg, st); // posts déjà faits depuis la modération : suivis (remplacés si l'item change ensuite)
    logs.push(`Bot : ${matching.length} item(s) concerné(s) sur ${items.size}. ` + (cfg.initial !== 'all' ? 'Mode « nouveaux seulement » : rien envoyé, seuls les prochains items le seront.' : `Envoi de tous : ${matching.length} post(s).`) + (matching.length === 0 && concerned.length ? ' Aucun ne correspond : vérifie filtres et salons.' : ''));
  }
  // Mode « nouveaux seulement » : seuls les items ACCEPTÉS (soumission approuvée, file config/discord_approved écrite par la modération) partent tout seuls.
  // Un item arrivé autrement dans le wiki est noté « vu » sans poster ; un renvoi demandé (salon / item) passe par st.force et part quand même.
  st.ap ||= {}; st.force ||= {};
  const gate = cfg.initial !== 'all' ? { q: (await dp.readConfig('discord_approved')).items || {} } : null;
  if (gate) for (const id of items.keys()) if (!st.seen[id] && !st.posts[id] && !st.force[id] && !(gate.q[id] > (st.ap[id] || 0))) st.seen[id] = 1;
  // Demandes d'un chef de serveur sur un salon (page de gestion) : « tout renvoyer » ou « seulement les manquants »
  for (const r of g.requests || []) {
    const ch = eligible.find(c => c.id === r.id);
    if (!ch) { doneReq.push(r.id); continue; }
    if (timeUp()) break;
    if (r.mode === 'all') for (const [key, e] of Object.entries(st.posts)) if (e.channelId === ch.id) { await deletePost(rest, e); delete st.posts[key]; await sleep(300); }
    for (const it of items.values()) if (fitsChannel(g, ch, it)) { delete st.seen[it._id]; st.force[it._id] = 1; } // redevient « à envoyer »
    doneReq.push(r.id);
    logs.push(`Bot : « ${ch.name} » — ${r.mode === 'all' ? 'renvoi de toute la data' : 'envoi des items manquants'} pris en compte`);
  }
  // Renvoi d'un item précis demandé par le chef de serveur : ancien post supprimé, l'item redevient « à envoyer » (salon inscrit qui le reçoit)
  for (const r of g.itemRequests || []) {
    if (timeUp()) break;
    const it = items.get(r.id);
    if (!it) { logs.push(`Bot : item « ${r.id} » introuvable dans le wiki`); doneItems.push(r.id); continue; }
    if (!eligible.some(c => c.id && fitsChannel(g, c, it))) { logs.push(`Bot : « ${it.name} » : aucun salon inscrit ne reçoit cet item (inscris-toi au salon qui lui correspond)`); doneItems.push(r.id); continue; }
    for (const [key, e] of Object.entries(st.posts)) if (key === r.id || (e.ids || []).includes(r.id)) { await deletePost(rest, e); delete st.posts[key]; await sleep(300); }
    delete st.seen[r.id]; st.force[r.id] = 1;
    logs.push(`Bot : « ${it.name} » : renvoi en cours`);
    doneItems.push(r.id);
  }
  // Inscription à un salon après coup : ses items déjà présents sont notés « vus » (sauf mode « tous ») pour ne pas tout renvoyer ; états antérieurs : migration silencieuse
  if (!st.subs._m) { st.subs._m = 1; if (st.baselined) eligible.forEach(c => { if (c.id) st.subs[c.id] = true; }); }
  for (const c of eligible) {
    if (!c.id || st.subs[c.id]) continue;
    if (g.initial !== 'all') for (const it of items.values()) if (fitsChannel(g, c, it)) st.seen[it._id] = 1;
    st.subs[c.id] = true;
  }
  if (cfg._main) { await mergeBrowserPosts(rest, cfg, st); await ensureMainChannels(rest, cfg, st, logs); }
  // Lecture incrémentale + sets groupés : on complète avec les autres items des sets modifiés (tous les items viennent avec le contexte des cartes)
  let map = items;
  if (cfg.groupSets && !fetched.full) {
    const sets = new Set([...items.values()].filter(i => i.set && route(cfg, i)).map(i => i.set));
    if (sets.size) { const ctx = await getCtx(); map = new Map(items); for (const it of ctx.maps.allItems) if (sets.has(it.set)) map.set(it.id ?? it._id, { _id: it.id ?? it._id, ...it }); }
  }
  const { todo, hashFix, gone } = plan(cfg, st, map, fetched.full, fetched.deleted, gate);
  // réglages ou statut changés depuis le dernier passage : on écrit toujours le résultat, même s'il n'y a rien à envoyer (sinon l'historique reste muet)
  if (st.sig !== undefined && st.sig !== sigOf(g) && fetched.full) {
    const concerned = [...map.values()].filter(it => route(cfg, it)).length;
    logs.push(`Bot : passage effectué — ${concerned} item(s) concerné(s), ${Object.keys(st.posts).length} déjà envoyé(s), ${todo.length} à envoyer${todo.length ? '' : ' : tout est à jour'}`);
  }
  for (const [id, h] of hashFix) st.posts[id].h = h;
  let error = '', sent = 0;
  for (const id of gone) { try { await deletePost(rest, st.posts[id]); delete st.posts[id]; await sleep(500); } catch (e) { error = e.message; } }

  const batch = todo.slice(0, BATCH);
  if (todo.length && (g.pending !== todo.length)) { try { await workerBot('report', { guildId: g.id, patch: { posted: Object.keys(st.posts).length, pending: todo.length } }); } catch { /* indicatif */ } } // la barre de progression apparaît dès le début
  if (batch.length) {
    const ctx = await getCtx();
    const counts = new Map();
    batch.forEach(b => counts.set(b.ch.id, (counts.get(b.ch.id) || 0) + 1));
    const threshold = Number.isFinite(cfg.hideThreshold) ? cfg.hideThreshold : 10;
    const locked = [];
    const chInfo = new Map();
    try {
      if (cfg.eventTags) { // tags d'événement : créés une fois par forum pour tous les événements du lot
        const byCh = new Map();
        for (const b of batch) { const ev = b.items.map(dp.eventOf).find(Boolean); if (ev) byCh.set(b.ch.id, [...(byCh.get(b.ch.id) || []), ev]); }
        for (const [chId, evs] of byCh) {
          try { if (!chInfo.has(chId)) chInfo.set(chId, await rest.get(`/channels/${chId}`)); await dp.ensureEventTags(rest, chId, chInfo.get(chId), evs); }
          catch (e) { logs.push(`Bot : tags d'événement impossibles dans ce forum (${e.message})`); }
        }
      }
      if (threshold > 0) for (const [chId, n] of counts) if (n > threshold) { try { await lock(rest, st, chId); locked.push(chId); } catch (e) { log(`${g.guildName} : masquage impossible (${e.message}), envoi quand même`); } }
      // Un salon à la fois dans l'ordre (limites de débit par salon), mais plusieurs salons en parallèle : bien plus rapide quand il y a plusieurs salons
      const queue = [...batch.reduce((m, x) => m.set(x.ch.id, [...(m.get(x.ch.id) || []), x]), new Map()).values()];
      const doGroup = async list => {
        for (const b of list) {
          if (timeUp()) break;
          try {
            if (!chInfo.has(b.ch.id)) chInfo.set(b.ch.id, await rest.get(`/channels/${b.ch.id}`));
            if (b.old) { await deletePost(rest, b.old); delete st.posts[b.key]; }
            const r = b.set
              ? await dp.postSet(rest, b.ch.id, setLabel(ctx, b.set), b.items, ctx, chInfo.get(b.ch.id), { eventTags: !!cfg.eventTags })
              : await dp.postItem(rest, b.ch.id, b.it, ctx, chInfo.get(b.ch.id), { eventTags: !!cfg.eventTags });
            st.posts[b.key] = { channelId: b.ch.id, threadId: r.threadId, messageId: r.messageId, ...(r.messageIds ? { messageIds: r.messageIds } : {}), ...(b.set ? { ids: b.items.map(i => i._id) } : {}), h: b.h };
            sent++;
            for (const i of b.items) { delete st.force[i._id]; if (gate && gate.q[i._id]) st.ap[i._id] = gate.q[i._id]; }
            if (sent % 25 === 0) { try { await workerBot('report', { guildId: g.id, patch: { posted: Object.keys(st.posts).length, pending: Math.max(0, todo.length - sent), lastSentAt: Date.now() } }); } catch { /* indicatif */ } } // progression visible en cours d'envoi
            if (sent % 5 === 0) await saveGuildState(g.id, st); // état sauvegardé tous les 5 posts (au pire quelques doublons après un plantage)
            await sleep(POST_DELAY);
          } catch (e) {
            error = `${b.it.name} : ${e.message}`;
            if (e.code === 10003) badCh.add(b.ch.id);
            log(`${g.guildName} : échec ${error}`);
            if ([10003, 50001, 50013].includes(e.code) || [403, 404].includes(e.status)) break; // salon supprimé / droits retirés : inutile d'insister ce passage
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => { while (queue.length) await doGroup(queue.shift()); }));
    } finally {
      for (const chId of locked) { try { await unlock(rest, st, chId); } catch (e) { log(`⚠️ visibilité non rétablie (${chId}) : ${e.message}`); error = 'visibilité non rétablie sur un salon'; } }
    }
  }
  const pending = Math.max(0, todo.length - sent);
  st.pending = pending; st.sig = sigOf(g);
  if (pending === 0 && !error) st.rev = fetched.rev; // sinon : lecture complète au prochain passage
  const patch = { posted: Object.keys(st.posts).length, pending, initialDone: pending === 0 };
  if (sent) { patch.lastSentAt = Date.now(); logs.push(`Bot : ${sent} post(s) envoyé(s), ${pending} restant(s)`); }
  if (error && error !== g.lastError) logs.push(`Bot : erreur — ${error}`);
  if (gone.length) logs.push(`Bot : ${gone.length} post(s) supprimé(s) (items retirés du wiki)`);
  if (logs.length) patch.log = logs;
  patch.channelPosts = {}; // posts par salon (la modération montre ce que chaque serveur a reçu)
  for (const e of Object.values(st.posts)) patch.channelPosts[e.channelId] = (patch.channelPosts[e.channelId] || 0) + (e.ids ? e.ids.length : 1);
  if (doneReq.length) patch.requestsDone = doneReq;
  if (doneItems.length) patch.itemRequestsDone = doneItems;
  if (badCh.size) patch.badChannels = [...badCh];
  if (error || g.lastError) patch.lastError = error;
  if (sent || error || logs.length || doneReq.length || doneItems.length || g.lastError || g.posted !== patch.posted || g.pending !== pending) await workerBot('report', { guildId: g.id, patch });
  if (sent) log(`${g.guildName} : ${sent} post(s) envoyé(s), ${pending} restant(s).`);
  return { sent, pending };
}

// ── Serveur principal : plan de la modération (config/discord_routes), salons « inscrits » ──
// Un salon inscrit reçoit automatiquement les nouveaux items qui le concernent ; s'il n'existe pas encore, le bot le crée (avec sa catégorie) au premier item.
// Les posts faits à la main depuis la modération sont suivis (donc remplacés si l'item change) ; l'envoi navigateur saute les salons inscrits.
async function mergeBrowserPosts(rest, g, st) {
  const { posts } = await workerBot('main_posts');
  const chIds = new Set((g.channels || []).map(c => c.id).filter(Boolean));
  // Fiche supprimée : son post fait depuis la modération disparaît aussi (même dans un salon non inscrit), puis son suivi est effacé
  const planIds = g._allChannelIds || chIds, dropped = [];
  for (const p of posts) {
    if (!planIds.has(p.channelId) || st.posts[p.itemId] || items.has(p.itemId)) continue;
    if (fetched.full ? !items.size : !fetched.deleted.includes(p.itemId)) continue; // lecture incrémentale : seulement si l'item est listé supprimé
    if (timeUp()) break;
    try { await deletePost(rest, p); dropped.push(p.itemId); await sleep(300); } catch (e) { log('Serveur principal : suppression du post de', p.itemId, e.message); }
  }
  if (dropped.length) { await workerBot('main_posts_drop', { itemIds: dropped }); log(`Serveur principal : ${dropped.length} post(s) supprimé(s) (fiches retirées du wiki)`); }
  for (const p of posts) {
    if (!chIds.has(p.channelId) || st.posts[p.itemId]) continue;
    const it = items.get(p.itemId);
    if (!it) continue; // lecture incrémentale : l'item n'a pas changé, rien à faire
    st.posts[p.itemId] = { channelId: p.channelId, threadId: p.threadId, messageId: p.messageId, h: hashOf(it) };
  }
}
async function ensureMainChannels(rest, g, st, logs) {
  const todo = (g.channels || []).filter(c => !c.id && c.name && [...items.values()].some(it => fitsChannel(g, c, it) && !st.seen[it._id] && !st.posts[it._id]));
  if (!todo.length) return;
  const all = await rest.get(`/guilds/${g.id}/channels`);
  const key = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüœ]/g, '');
  const updates = [];
  for (const c of todo.slice(0, 8)) {
    try {
      let parent = null, newCategory = false;
      if (c.categoryName) {
        parent = all.find(x => x.type === 4 && key(x.name) === key(c.categoryName));
        if (!parent) { parent = await rest.post(`/guilds/${g.id}/channels`, { body: { name: c.categoryName.slice(0, 100), type: 4 } }); all.push(parent); newCategory = true; await sleep(400); }
      }
      const type = c.type === 'text' ? 0 : 15;
      let ch = all.find(x => x.type === type && key(x.name) === key(c.name) && (x.parent_id || '') === (parent?.id || ''));
      if (!ch) { ch = await rest.post(`/guilds/${g.id}/channels`, { body: { name: c.name.slice(0, 100), type, parent_id: parent?.id } }); all.push(ch); await sleep(400); }
      c.id = ch.id; if (parent) c.categoryId = parent.id; st.subs[ch.id] = true;
      updates.push({ name: c.name, categoryName: c.categoryName || '', id: ch.id, categoryId: parent?.id || '', newCategory });
      logs.push(`Bot : salon « ${c.name} » créé automatiquement (nouvel item à envoyer)`);
    } catch (e) { logs.push(`Bot : création du salon « ${c.name} » impossible (${e.message})`); }
  }
  if (updates.length) await workerBot('main_patch', { updates }); // mémorise les ids dans le plan de la modération
}
async function mainPass(rest) {
  if (!process.env.ADMIN_SECRET) return;
  const cfg = await dp.readConfig('discord_routes');
  if (!cfg || !cfg.guildId || cfg.enabled === false) return;
  const subs = (Array.isArray(cfg.channels) ? cfg.channels : []).filter(c => c.subscribed && !c.skip);
  if (!subs.length) return;
  pass.deadline = Date.now() + (parseFloat(process.env.RUN_MINUTES) || 12) * 60e3;
  pass.more = pass.more || false;
  const g = { id: cfg.guildId, guildName: 'Serveur principal', status: 'approved', paused: false, initial: 'new', replace: true, groupSets: false, eventTags: false, hideThreshold: Number.isFinite(cfg.hideThreshold) ? cfg.hideThreshold : 10,
    itemCats: [], paliers: [], channels: subs, _allChannelIds: new Set((Array.isArray(cfg.channels) ? cfg.channels : []).map(c => c.id).filter(Boolean)), updatedAt: [...subs.map(c => [c.name, c.id || '', (c.itemCats || []).join(), (c.paliers || []).join()].join('/'))].join('|'), _main: true };
  const st = await loadGuildState(g.id); st._id = g.id;
  const needFull = !st.baselined || st.pending > 0 || !st.rev || st.sig !== sigOf(g);
  await refreshItems(needFull ? 0 : st.rev);
  let ctxP = null;
  try { const r = await guildPass(rest, g, st, () => (ctxP ??= dp.buildContext())); if (r && r.sent > 0 && r.pending > 0) pass.more = true; }
  catch (e) { log(`Serveur principal : erreur ${e.message}`); }
  await saveGuildState(g.id, st);
}

/** Passage complet sur tous les serveurs inscrits. */
async function pass(rest) {
  if (!process.env.ADMIN_SECRET) { if (!pass.warned) { pass.warned = true; log('ADMIN_SECRET absent : envoi multi-serveurs désactivé.'); } return; }
  pass.more = false; // vrai si un envoi avance mais n'est pas fini : le workflow se relance tout de suite
  pass.deadline = Date.now() + (parseFloat(process.env.RUN_MINUTES) || 12) * 60e3;
  const { guilds } = await workerBot('list');
  const active = guilds.filter(g => g.status === 'removing' || g.purge || (g.status === 'approved' && !g.paused));
  let ctxP = null;
  const getCtx = () => (ctxP ??= dp.buildContext());
  const sending = active.filter(g => g.status === 'approved' && !g.paused);
  const states = new Map();
  for (const g of active) { const st = await loadGuildState(g.id); st._id = g.id; states.set(g.id, st); }
  if (sending.length) {
    // lecture complète si un serveur n'a jamais été lu, a un envoi en cours, des items en échec, ou des réglages modifiés ; sinon seulement les changements
    const needFull = sending.some(g => { const st = states.get(g.id); return !st.baselined || st.pending > 0 || !st.rev || st.sig !== sigOf(g) || (g.requests || []).length > 0 || (g.itemRequests || []).length > 0 || (g.channels || []).some(c => c.id && c.subscribed !== false && !c.skip && !st.subs?.[c.id]); });
    await refreshItems(needFull ? 0 : Math.min(...sending.map(g => states.get(g.id).rev)));
  }
  for (const g of active) {
    if (timeUp()) { log('Durée maximale atteinte : suite au prochain passage.'); break; }
    const st = states.get(g.id);
    try {
      if (g.status === 'removing') {
        await uninstall(rest, g, st);
        await workerBot('ack_remove', { guildId: g.id });
        await workerBot('state_set', { key: 'guild_' + g.id, value: null });
        log(`${g.guildName || g.id} : désinstallé.`);
        continue;
      }
      const r = await guildPass(rest, g, st, getCtx);
      if (r && r.sent > 0 && r.pending > 0) pass.more = true;
    } catch (e) {
      log(`${g.guildName || g.id} : erreur ${e.message}`);
      try { await workerBot('report', { guildId: g.id, patch: { lastError: String(e.message).slice(0, 300) } }); } catch { /* worker injoignable */ }
    }
    await saveGuildState(g.id, st);
  }
}

module.exports = { pass, mainPass, route, plan, hashOf, fitsChannel };
