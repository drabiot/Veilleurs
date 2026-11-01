/* ══════════════════════════════════════════════
   BOT — Surveillant : poste dans Discord (avec la carte image) chaque NOUVEL item du wiki,
   dans le salon réglé dans la modération (onglet « Discord », config/discord_routes), puis traite les serveurs inscrits
   via la page Discord/discord.html (voir discord-guilds.js).

   Lancé toutes les 10 min par GitHub Actions (.github/workflows/discord-bot.yml) :
     node bot/discord-watch.js --once     # un seul passage (mode des Actions)
     node bot/discord-watch.js            # boucle locale (toutes les 5 min, DISCORD_WATCH_MINUTES pour changer)
   Variables : BOT_TOKEN, ADMIN_SECRET (secrets GitHub ; en local dans bot/.env). DISCORD_MULTI=0 désactive les serveurs inscrits.

   - Premier lancement : tous les items existants sont notés comme « déjà vus » (rien n'est posté).
   - Salon = routes[`${catégorie}_${palier}`], sinon le salon par défaut ; aucun salon => rien n'est posté pour cet item.
   - « Envoi automatique » désactivé : les nouveaux items sont notés sans rien poster (pas de rafale à la réactivation).
   - Un échec d'envoi est retenté au passage suivant.
   - État (révision lue + items déjà postés) : gardé dans le worker (D1, clé « main »), plus dans un fichier local.
══════════════════════════════════════════════ */
require('dotenv').config({ path: __dirname + '/.env' });
const { REST } = require('discord.js');
const dp = require('./discord-post.js');
const guilds = require('./discord-guilds.js');

const rest = new REST({ version: '10' }).setToken(process.env.BOT_TOKEN);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const log = (...a) => console.log(`[discord-watch ${new Date().toISOString().slice(11, 19)}]`, ...a);

async function stateCall(action, extra = {}) {
  const r = await fetch(`${dp.WORKER}/guild/bot`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: process.env.ADMIN_SECRET, action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || ('worker ' + r.status));
  return j;
}
const loadState = async () => (await stateCall('state_get', { key: 'main' })).value;
const saveState = s => stateCall('state_set', { key: 'main', value: s });

/** Renvois demandés depuis la modération (config/discord_resend) : l'ancien post est déjà supprimé par la modération, on poste ici l'item au format du bot.
 *  Salon du plan de la modération (le plus précis gagne), sinon route / salon par défaut. Le post est noté dans discord_posts (la modération l'affiche) et, si le salon est « inscrit », dans l'état du serveur principal (sinon doublon à la modification suivante). */
const RESEND_MAX = 40; // posts par passage (le workflow se relance s'il en reste)
async function resendPass(stopAt) {
  const q = (await dp.readConfig('discord_resend')).items || {};
  const ids = Object.keys(q);
  if (!ids.length) return;
  await stateCall('resend_done', { done: {} }); // le worker doit connaître les nouvelles actions (sinon la file ne se vide pas et tout serait reposté à chaque passage) : erreur = on ne poste rien
  const cfg = await dp.readConfig('discord_routes');
  const ctx = await dp.buildContext();
  const byId = new Map(ctx.maps.allItems.map(i => [String(i.id), i]));
  const has = (l, v) => (l || []).map(String).includes(String(v));
  const fits = (l, v) => !(l || []).length || has(l, v);
  const chanOf = it => (cfg.channels || []).filter(c => c.id && fits(c.itemCats, it.category) && fits(c.paliers, it.palier))
    .sort((a, b) => ((b.itemCats || []).length > 0) + ((b.paliers || []).length > 0) - (((a.itemCats || []).length > 0) + ((a.paliers || []).length > 0)))[0];
  const done = {}, tracked = [], chCache = new Map();
  let st = null; const stKey = cfg.guildId ? 'guild_' + cfg.guildId : null, stDirty = [];
  let n = 0;
  for (const id of ids) {
    const it = byId.get(String(id));
    const c = it && chanOf(it);
    const channelId = c ? c.id : (it && (((cfg.routes || {})[`${it.category}_${it.palier}`]) || cfg.default)) || '';
    if (!it || !channelId) { done[id] = q[id]; log(`Renvoi ignoré : ${id} (${it ? 'aucun salon' : 'item introuvable'})`); continue; }
    if (n >= RESEND_MAX || Date.now() > stopAt) break;
    try {
      if (!chCache.has(channelId)) chCache.set(channelId, await rest.get(`/channels/${channelId}`));
      const ch = chCache.get(channelId);
      const ev = dp.eventOf(it);
      if (ev) { try { await dp.ensureEventTags(rest, channelId, ch, [ev]); } catch (e) { log('Tags d\'événement :', e.message); } }
      const r = await dp.postItem(rest, channelId, it, ctx, ch, { eventTags: true });
      done[id] = q[id]; n++;
      tracked.push({ docId: `${it.category}_${it.palier}_item_${it.id}`, itemId: it.id, itemName: it.name, key: `${it.category}_${it.palier}`, channelId, threadId: r.threadId, messageId: r.messageId });
      if (c && c.subscribed && stKey) {
        st ||= (await stateCall('state_get', { key: stKey })).value || false;
        if (st) { st.posts ||= {}; st.seen ||= {}; st.posts[it.id] = { channelId, threadId: r.threadId, messageId: r.messageId, ...(r.messageIds ? { messageIds: r.messageIds } : {}), h: guilds.hashOf(it) }; st.seen[it.id] = 1; stDirty.push(it.id); }
      }
      log(`Renvoi posté : ${it.name} -> ${ch.name}`);
      await sleep(1500);
    } catch (e) { log(`Échec renvoi ${it.name} : ${e.message} (retenté au prochain passage)`); }
  }
  if (tracked.length) await stateCall('main_post_set', { posts: tracked });
  if (stDirty.length) await stateCall('state_set', { key: stKey, value: st });
  if (Object.keys(done).length) await stateCall('resend_done', { done });
  if (Object.keys(done).length < ids.length && process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, 'more=true\n'); // il en reste : le workflow se relance
}

async function pass() {
  let state = await loadState();
  if (!state) {
    const j = await dp.sync('items', 0);
    state = { rev: j.rev, posted: j.docs.map(x => x.id) };
    await saveState(state);
    log(`Premier lancement : ${state.posted.length} items existants notés, rien posté.`);
    return;
  }
  const j = await dp.sync('items', state.rev);
  const seen = new Set(state.posted);
  const fresh = dp.rows(j).filter(i => !seen.has(i._id));
  if (!fresh.length) { if (state.rev !== j.rev) { state.rev = j.rev; await saveState(state); } return; }

  const cfg = await dp.readConfig('discord_routes');
  const routes = cfg.routes || {};
  const planOwns = !!cfg.guildId && (Array.isArray(cfg.channels) ? cfg.channels : []).some(c => c.subscribed && !c.skip); // salons inscrits : mainPass poste, sinon doublon
  const ctx = cfg.enabled !== false ? await dp.buildContext() : null;
  const chCache = new Map();
  const failed = new Set();
  for (const item of fresh) {
    const id = item._id;
    const channelId = routes[`${item.category}_${item.palier}`] || cfg.default || '';
    if (cfg.enabled === false || !channelId || planOwns) { seen.add(id); continue; }
    try {
      if (!chCache.has(channelId)) chCache.set(channelId, await rest.get(`/channels/${channelId}`));
      await dp.postItem(rest, channelId, item, ctx, chCache.get(channelId));
      seen.add(id);
      log(`Posté : ${item.name} -> ${chCache.get(channelId).name}`);
      await sleep(1500);
    } catch (e) { failed.add(id); log(`Échec ${item.name} : ${e.message} (retenté au prochain passage)`); }
  }
  // Les items en échec gardent la révision en arrière : ils reviennent au passage suivant
  state.posted = [...seen];
  state.rev = failed.size ? state.rev : j.rev;
  await saveState(state);
}

(async () => {
  const once = process.argv.includes('--once');
  const every = (parseFloat(process.env.DISCORD_WATCH_MINUTES) || 5) * 60e3;
  if (!process.env.ADMIN_SECRET) { log('ADMIN_SECRET manquant : arrêt.'); process.exit(1); }
  log(`Démarré (${once ? 'un passage' : 'toutes les ' + every / 60e3 + ' min'}).`);
  let failed = false;
  do {
    try { await resendPass(Date.now() + (parseFloat(process.env.RUN_MINUTES) || 12) * 30e3); } catch (e) { failed = true; log('Renvois :', e.message); } // avant mainPass : l'état du serveur principal est à jour pour lui
    try { await guilds.mainPass(rest); } catch (e) { failed = true; log('Serveur principal :', e.message); } // salons « inscrits » du plan de la modération
    // Serveurs inscrits via Discord/discord.html : état propre à chaque serveur, désactivable avec DISCORD_MULTI=0
    if (process.env.DISCORD_MULTI !== '0') { try { await guilds.pass(rest); } catch (e) { failed = true; log('Multi-serveurs :', e.message); } }
    if (!once) await sleep(every);
  } while (!once);
  // Envoi en cours mais pas fini : le workflow se relance aussitôt (sinon il attendrait le prochain passage planifié)
  if (guilds.pass.more && process.env.GITHUB_OUTPUT) require('fs').appendFileSync(process.env.GITHUB_OUTPUT, 'more=true\n');
  if (failed) process.exitCode = 1; // le passage échoué apparaît en rouge dans l'onglet Actions
})();
