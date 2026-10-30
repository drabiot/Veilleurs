/* ══ guild-onboarding.js — Inscription des serveurs Discord tiers (page Discord/discord.html) ══
   Importé par cloudflare-worker.js. Réglages d'un serveur = un document `discord_guilds/<guildId>` dans la table `docs` de D1.

   1. Connexion Discord (scope `identify guilds`) : GET /discord/callback (state m = 'guilds') garde les serveurs où la personne
      a « Gérer le serveur » / « Administrateur » / est propriétaire, les range dans KV (WIKI_CACHE, clé gs:<session>, 2 h) et
      renvoie un identifiant de session au navigateur (fragment #vcl-guild=…). Le jeton OAuth Discord n'est jamais conservé.
   2. POST /guild/api { session, action, … } : tout passe par la session ci-dessus ; chaque action revérifie que la personne gère bien
      guildId. Le navigateur public n'a donc jamais ADMIN_SECRET. Actions : me, inspect, save, create_channels, set_paused, purge, uninstall.
   3. POST /guild/bot { secret: ADMIN_SECRET, action } : réservé au processus Node permanent (bot/discord-guilds.js) :
      list (tous les serveurs), report (compte rendu d'envoi), ack_remove (fin de désinstallation).

   Statut (`status`, modifié uniquement par la modération du wiki ou le worker) : pending → approved | refused | suspended ; removing (désinstallation demandée).
   `paused` est le réglage du chef de serveur. L'envoi n'a lieu que si status = approved ET paused = false. */

const API = 'https://discord.com/api/v10';
const DEFAULT_CLIENT_ID = '1499589814624845936';
const INVITE_PERMS = '326686067728'; // voir/écrire/créer fils/joindre fichiers/gérer salons/gérer rôles

const P = { VIEW: 1n << 10n, SEND: 1n << 11n, EMBED: 1n << 14n, ATTACH: 1n << 15n, HISTORY: 1n << 16n,
  PUB_THREADS: 1n << 35n, PRIV_THREADS: 1n << 36n, SEND_THREADS: 1n << 38n, MANAGE_THREADS: 1n << 34n };
const READ_ONLY_DENY = P.SEND | P.PUB_THREADS | P.PRIV_THREADS | P.SEND_THREADS;
const BOT_ALLOW = P.VIEW | P.SEND | P.EMBED | P.ATTACH | P.HISTORY | P.MANAGE_THREADS | P.PUB_THREADS | P.SEND_THREADS;

export const ITEM_CATS = ['arme', 'armure', 'accessoire', 'outils', 'rune', 'consommable', 'nourriture', 'materiaux', 'ressources', 'parchemin', 'quete', 'donjon', 'monnaie'];
const SNOW = /^\d{15,25}$/;
const MAX_CHANNELS = 60;
const CREATE_BUDGET = 12; // créations Discord par appel (limite de sous-requêtes d'un Worker)

const jparse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

// ── Documents D1 (même schéma que worker-store.js : révision globale incrémentée à chaque écriture) ──
async function dgGet(env, id) {
  const r = await env.DB.prepare("SELECT data, deleted FROM docs WHERE col = 'discord_guilds' AND id = ?").bind(id).first();
  return r && !r.deleted ? jparse(r.data) : null;
}
async function dgPut(env, id, data) {
  await env.DB.batch([
    env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
    env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('discord_guilds', ?, ?, (SELECT v FROM meta WHERE k = 'rev'), 0, 0)
      ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`).bind(id, JSON.stringify(data)),
  ]);
}
async function dgDelete(env, id) {
  await env.DB.batch([
    env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
    env.DB.prepare("UPDATE docs SET deleted = 1, updated_at = (SELECT v FROM meta WHERE k = 'rev') WHERE col = 'discord_guilds' AND id = ?").bind(id),
  ]);
}

// ── Historique des actions réellement faites (doc.log, 60 dernières), lu dans la modération ──
const pushLog = (doc, msg) => { (doc.log ||= []).push({ t: Date.now(), m: String(msg).slice(0, 240) }); doc.log = doc.log.slice(-60); };
const TRIGGER_LABEL = { started: 'Bot lancé à la demande (les envois commencent dans ~20 s)', 'no-token': 'Lancement automatique indisponible (pas de jeton GitHub) : prochain passage planifié (10 min)', throttled: 'Bot déjà lancé il y a moins d\'une minute' };
const triggerText = r => TRIGGER_LABEL[r] || ('Lancement du bot refusé par GitHub (' + r + ')');

// ── Appels Discord avec le jeton du bot ──
async function dc(env, method, path, body) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(API + path, {
      method, headers: { Authorization: `Bot ${env.BOT_TOKEN}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, // Discord refuse un DELETE qui annonce du JSON sans corps
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (r.status === 429 && attempt === 0) { // limite de débit : une seule attente courte
      const wait = Math.min(3, (await r.json().catch(() => ({}))).retry_after || 1);
      await new Promise(res => setTimeout(res, wait * 1000));
      continue;
    }
    const data = r.status === 204 ? {} : await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  }
}

let _botGuilds = null; // { at, ids } 20 s
async function botGuildIds(env) {
  if (_botGuilds && Date.now() - _botGuilds.at < 20000) return _botGuilds.ids;
  const ids = new Set();
  let after = '';
  for (let i = 0; i < 5; i++) { // 200 serveurs par page
    const r = await dc(env, 'GET', `/users/@me/guilds?limit=200${after ? '&after=' + after : ''}`);
    if (!r.ok || !Array.isArray(r.data)) break;
    r.data.forEach(g => ids.add(g.id));
    if (r.data.length < 200) break;
    after = r.data[r.data.length - 1].id;
  }
  _botGuilds = { at: Date.now(), ids };
  return ids;
}

// ── Lancer le bot tout de suite (GitHub Actions, workflow discord-bot.yml) au lieu d'attendre le prochain passage de 10 min ──
// Secret du worker GITHUB_DISPATCH_TOKEN : jeton GitHub « fine-grained » limité au dépôt, permission Actions = lecture et écriture.
// Au plus un lancement par minute (KV) ; sans jeton, rien ne se passe et le passage planifié fait le travail.
const GH_REPO = 'drabiot/Veilleurs';
export async function triggerBot(env) {
  if (!env.GITHUB_DISPATCH_TOKEN) return 'no-token';
  try {
    if (env.WIKI_CACHE) {
      if (await env.WIKI_CACHE.get('bot_trigger')) return 'throttled';
      await env.WIKI_CACHE.put('bot_trigger', '1', { expirationTtl: 60 });
    }
    const r = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/discord-bot.yml/dispatches`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'veilleurs-worker', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: 'main' }),
    });
    return r.status === 204 ? 'started' : 'error-' + r.status;
  } catch { return 'error'; }
}

/** Appelé par le cron Cloudflare : ne lance le bot que s'il y a quelque chose à faire (items du wiki modifiés depuis le dernier lancement,
 *  envoi ou nettoyage en cours sur un serveur) ou, au plus, toutes les heures par sécurité. Évite des exécutions GitHub inutiles. */
export async function maybeTriggerBot(env) {
  if (!env.GITHUB_DISPATCH_TOKEN || !env.DB) return 'no-token';
  const rev = String((await env.DB.prepare("SELECT MAX(updated_at) AS m FROM docs WHERE col = 'items'").first())?.m ?? 0);
  const busy = await env.DB.prepare("SELECT 1 AS x FROM docs WHERE col = 'discord_guilds' AND deleted = 0 AND (COALESCE(json_extract(data, '$.pending'), 0) > 0 OR json_extract(data, '$.status') = 'removing' OR json_extract(data, '$.purge') = 1) LIMIT 1").first();
  const lastRev = env.WIKI_CACHE ? await env.WIKI_CACHE.get('bot_items_rev') : null;
  const lastAt = env.WIKI_CACHE ? parseInt(await env.WIKI_CACHE.get('bot_last_cron') || '0', 10) : 0;
  const due = rev !== lastRev || !!busy || Date.now() - lastAt > 3600000;
  if (!due) return 'skipped';
  const r = await triggerBot(env);
  if (env.WIKI_CACHE && (r === 'started' || r === 'throttled')) { await env.WIKI_CACHE.put('bot_items_rev', rev); await env.WIKI_CACHE.put('bot_last_cron', String(Date.now())); }
  return r;
}

// ══ Connexion : fin du flux OAuth (appelée par handleDiscordCallback quand state.m === 'guilds') ══
export async function finishGuildOauth(env, accessToken) {
  const bearer = { Authorization: `Bearer ${accessToken}` };
  const me = await (await fetch(`${API}/users/@me`, { headers: bearer })).json();
  if (!me.id) throw new Error('Profil Discord introuvable.');
  const gr = await fetch(`${API}/users/@me/guilds`, { headers: bearer });
  const all = gr.ok ? await gr.json() : [];
  const guilds = (Array.isArray(all) ? all : []).filter(g => {
    const perms = BigInt(g.permissions || '0');
    return g.owner || (perms & 0x20n) || (perms & 0x8n); // Gérer le serveur ou Administrateur
  }).slice(0, 90).map(g => ({ id: g.id, name: g.name, icon: g.icon || '', owner: !!g.owner }));
  if (!env.WIKI_CACHE) throw new Error('KV WIKI_CACHE absent : session impossible.');
  const sid = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
  await env.WIKI_CACHE.put('gs:' + sid, JSON.stringify({ user: { id: me.id, name: me.global_name || me.username, avatar: me.avatar || '' }, guilds }), { expirationTtl: 7200 });
  return sid;
}

// ══ POST /guild/api ══
function sanitizeName(s, max) { return String(s || '').replace(/[\u0000-\u001f<>@#`]/g, '').trim().slice(0, max); }
// Même règle que la modération : emojis et lettres Unicode « grasses » conservés (Discord met en minuscules les lettres ASCII d'un salon)
const slug = n => String(n || '').trim().replace(/\s+/g, '-').replace(/[\\/#@:*?"<>|`\u0000-\u001f]/g, '').slice(0, 100);
// Clé de comparaison pour retrouver un salon / une catégorie existants (NFKC ramène 𝗔𝗿𝗺𝗲𝘀 à « armes », sans emoji ni séparateurs)
const nkey = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüœ]/g, '');
const strList = (a, re, max) => (Array.isArray(a) ? a : []).map(String).filter(x => re.test(x)).slice(0, max);

/** Réglages envoyés par le navigateur → réglages acceptés (tout est revalidé ici). */
function cleanConfig(c, stored, realIds) {
  const one = (v, list, d) => (list.includes(v) ? v : d);
  const out = {
    mode: one(c.mode, ['existing', 'create'], 'create'),
    structure: one(c.structure, ['default', 'single', 'custom'], 'default'),
    prefix: sanitizeName(c.prefix, 20),
    access: one(c.access, ['everyone', 'roles', 'admins'], 'everyone'),
    roleIds: strList(c.roleIds, SNOW, 20),
    itemCats: strList(c.itemCats, /^[a-z]{3,20}$/, ITEM_CATS.length).filter(x => ITEM_CATS.includes(x)),
    paliers: strList(c.paliers, /^[\w\-]{1,30}$/, 30),
    initial: one(c.initial, ['all', 'new'], 'new'),
    forum: c.forum !== false,
    hideThreshold: Math.max(0, Math.min(1000, parseInt(c.hideThreshold, 10) || 0)),
    replace: c.replace !== false,
    eventTags: c.eventTags === true, // tag de forum par événement (Noël, Halloween…), créé et appliqué par le bot
    groupSets: c.groupSets === true, // un seul post par set (nom du set), au lieu d'un post par item
    channels: [],
  };
  const prev = new Map((stored?.channels || []).filter(x => x.id).map(x => [x.id, x]));
  for (const ch of (Array.isArray(c.channels) ? c.channels : []).slice(0, MAX_CHANNELS)) {
    const id = SNOW.test(String(ch.id || '')) ? String(ch.id) : '';
    if (id && realIds && !realIds.has(id)) throw new Error(`Salon introuvable sur le serveur : ${id}`);
    const name = slug(ch.name);
    if (!id && !name) continue;
    out.channels.push({
      name, type: ch.type === 'text' ? 'text' : 'forum', categoryName: sanitizeName(ch.categoryName, 100),
      id, itemCats: strList(ch.itemCats, /^[a-z]{3,20}$/, ITEM_CATS.length).filter(x => ITEM_CATS.includes(x)),
      paliers: strList(ch.paliers, /^[\w\-]{1,30}$/, 30),
      created: !!(id && prev.get(id)?.created), // posé uniquement par le worker (jamais par le navigateur)
      subscribed: ch.subscribed !== false && ch.skip !== true, // inscrit = activé : le salon est créé si besoin et reçoit les items
    });
  }
  return out;
}

/** Droits d'accès des salons créés : lecture seule pour le public voulu, le bot garde la main. */
function overwrites(env, guildId, cfg) {
  const ov = (id, type, allow, deny) => ({ id, type, allow: String(allow), deny: String(deny) });
  const list = [ov(env.DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID, 1, BOT_ALLOW, 0)];
  const see = P.VIEW | P.HISTORY;
  if (cfg.access === 'everyone') list.push(ov(guildId, 0, see, READ_ONLY_DENY));
  else {
    list.push(ov(guildId, 0, 0, P.VIEW | READ_ONLY_DENY));
    if (cfg.access === 'roles') for (const r of cfg.roleIds) list.push(ov(r, 0, see, READ_ONLY_DENY));
  }
  return list;
}

/** Supprime tous les posts du bot sur le serveur (par paquets de 40 appels Discord : la page rappelle jusqu'à done) et remet l'état à zéro.
 *  resend = « tout recommencer » : renvoie ensuite TOUS les items (réglage « tous » forcé, envoi repris, bot lancé). Sinon l'envoi reste en pause. */
async function purgeStep(env, guildId, doc, json, resend) {
  const stateKey = 'guild_' + guildId;
  if (!doc.purging) { // on met en pause d'abord pour que le bot n'ajoute pas de posts pendant le nettoyage
    doc.purging = true; doc.paused = true; doc.updatedAt = Date.now();
    pushLog(doc, resend ? 'Tout recommencer demandé : suppression de tous les posts puis renvoi complet' : 'Suppression de tous les posts demandée (envoi mis en pause)');
    await dgPut(env, guildId, doc);
  }
  const row = await env.DB.prepare("SELECT data FROM docs WHERE col = 'bot_state' AND id = ? AND deleted = 0").bind(stateKey).first();
  const st = jparse(row?.data) || {};
  const posts = st.posts || {};
  let budget = 40, deleted = 0;
  for (const [key, e] of Object.entries(posts)) {
    const calls = e.threadId ? [`/channels/${e.threadId}`] : (e.messageIds?.length ? e.messageIds : [e.messageId]).filter(Boolean).map(m => `/channels/${e.channelId}/messages/${m}`);
    if (budget < calls.length) break;
    for (const p of calls) { await dc(env, 'DELETE', p); budget--; }
    delete posts[key]; deleted++;
  }
  const left = Object.keys(posts).length;
  const next = left ? { ...st, posts } : { ...st, posts: {}, seen: {}, baselined: false, rev: 0, pending: 0, sig: '' }; // plus rien : le bot repartira de zéro
  await env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('bot_state', ?, ?, 0, 0, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, deleted = 0`).bind(stateKey, JSON.stringify(next)).run();
  if (left) return json({ ok: true, progress: true, left, deleted });
  doc.purging = false; doc.purge = false; doc.posted = 0; doc.pending = 0; doc.lastError = ''; doc.updatedAt = Date.now();
  if (resend) {
    doc.initial = 'all'; doc.paused = false;
    pushLog(doc, 'Posts supprimés : renvoi de tous les items demandé');
    if (doc.status === 'approved') pushLog(doc, triggerText(await triggerBot(env)));
  } else pushLog(doc, 'Tous les posts sont supprimés (envoi en pause : « Reprendre » renverra tout si le réglage est « tous les items »)');
  await dgPut(env, guildId, doc);
  return json({ ok: true, done: true, config: doc });
}

/** Supprime les posts du bot dans UN salon (par paquets de 40 appels) ; leurs items sont notés « déjà vus » pour ne pas être renvoyés tout de suite. */
async function clearChannelStep(env, guildId, doc, c, json) {
  const stateKey = 'guild_' + guildId;
  const row = await env.DB.prepare("SELECT data FROM docs WHERE col = 'bot_state' AND id = ? AND deleted = 0").bind(stateKey).first();
  const st = jparse(row?.data) || {};
  const posts = st.posts || {}; st.seen ||= {};
  let budget = 40, deleted = 0;
  for (const [key, e] of Object.entries(posts)) {
    if (e.channelId !== c.id) continue;
    const calls = e.threadId ? [`/channels/${e.threadId}`] : (e.messageIds?.length ? e.messageIds : [e.messageId]).filter(Boolean).map(m => `/channels/${e.channelId}/messages/${m}`);
    if (budget < calls.length) break;
    for (const p of calls) { await dc(env, 'DELETE', p); budget--; }
    for (const id of (e.ids || [key])) st.seen[id] = 1;
    delete posts[key]; deleted++;
  }
  const left = Object.values(posts).filter(e => e.channelId === c.id).length;
  await env.DB.prepare("INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('bot_state', ?, ?, 0, 0, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, deleted = 0").bind(stateKey, JSON.stringify({ ...st, posts })).run();
  if (left) return json({ ok: true, progress: true, left, deleted });
  doc.posted = Object.keys(posts).length; doc.updatedAt = Date.now();
  pushLog(doc, `« ${c.name} » vidé : ses posts sont supprimés`);
  await dgPut(env, guildId, doc);
  return json({ ok: true, done: true, config: doc });
}

/** Désinstallation d'un serveur : par paquets (budget d'appels Discord d'un Worker) ; l'appelant rappelle tant que la réponse n'est pas done.
 *  Utilisée par la page d'inscription (chef de serveur) et par la modération (action « uninstall » de /guild/bot). */
async function uninstallStep(env, guildId, doc, body, json) {
  const stateKey = 'guild_' + guildId;
  const dropState = () => env.DB.prepare("UPDATE docs SET deleted = 1 WHERE col = 'bot_state' AND id = ?").bind(stateKey).run();
  const present = (await botGuildIds(env)).has(guildId);
  if (!present) { if (doc) { await dgDelete(env, guildId); await dropState(); } return json({ ok: true, done: true }); }
  if (!doc) { await dc(env, 'DELETE', `/users/@me/guilds/${guildId}`); _botGuilds = null; return json({ ok: true, done: true }); }
  if (doc.status !== 'removing') { doc.status = 'removing'; doc.removal = { deleteChannels: !!body.deleteChannels, deletePosts: !!body.deletePosts }; }
  doc.updatedAt = Date.now();
  if (!doc.log?.some(x => x.m.startsWith('Désinstallation demandée'))) pushLog(doc, `Désinstallation demandée (salons créés : ${doc.removal?.deleteChannels ? 'supprimés' : 'conservés'}, posts : ${doc.removal?.deletePosts || doc.removal?.deleteChannels ? 'supprimés' : 'conservés'})`);
  const rm = doc.removal || {};
  let budget = 40;
  const gone = r => r.ok || [404, 403].includes(r.status); // déjà supprimé / plus accessible : on oublie
  const more = async (left) => { await dgPut(env, guildId, doc); return json({ ok: true, done: false, progress: true, left }); };

  if (rm.deletePosts && !rm.deleteChannels) { // posts suivis par le bot (état D1) : supprimés ici
    const row = await env.DB.prepare("SELECT data FROM docs WHERE col = 'bot_state' AND id = ? AND deleted = 0").bind(stateKey).first();
    const st = jparse(row?.data) || {};
    const posts = st.posts || {};
    for (const [key, e] of Object.entries(posts)) {
      const calls = e.threadId ? [`/channels/${e.threadId}`] : (e.messageIds?.length ? e.messageIds : [e.messageId]).filter(Boolean).map(m => `/channels/${e.channelId}/messages/${m}`);
      if (budget < calls.length) break;
      for (const p of calls) { await dc(env, 'DELETE', p); budget--; }
      delete posts[key];
    }
    const left = Object.keys(posts).length;
    await env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('bot_state', ?, ?, 0, 0, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, deleted = 0`).bind(stateKey, JSON.stringify({ ...st, posts })).run();
    if (left) return more(left);
  }

  if (rm.deleteChannels) { // salons créés par le bot, puis catégories créées par le bot et devenues vides
    for (const c of doc.channels || []) {
      if (!(c.created && c.id)) continue;
      if (budget <= 0) break;
      const r = await dc(env, 'DELETE', `/channels/${c.id}`); budget--;
      if (gone(r)) { c.id = ''; c.created = false; }
    }
    const left = (doc.channels || []).filter(c => c.created && c.id).length;
    if (left) return more(left);
    if ((doc.createdCategories || []).length && budget > 2) {
      const all = await dc(env, 'GET', `/guilds/${guildId}/channels`); budget--;
      for (const cid of [...doc.createdCategories]) {
        if (budget <= 0) break;
        if (Array.isArray(all.data) && all.data.some(x => x.parent_id === cid)) { doc.createdCategories = doc.createdCategories.filter(x => x !== cid); continue; } // contient autre chose : on la garde
        const r = await dc(env, 'DELETE', `/channels/${cid}`); budget--;
        if (gone(r)) doc.createdCategories = doc.createdCategories.filter(x => x !== cid);
      }
      if (doc.createdCategories.length) return more(doc.createdCategories.length);
    }
  }

  await dc(env, 'DELETE', `/users/@me/guilds/${guildId}`); // le bot quitte le serveur
  _botGuilds = null;
  await dgDelete(env, guildId); await dropState();
  return json({ ok: true, done: true });
}

export async function handleGuildApi(request, env, deps) {
  const { json } = deps;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  const sess = env.WIKI_CACHE && /^[0-9a-f]{48}$/.test(String(body.session || ''))
    ? jparse(await env.WIKI_CACHE.get('gs:' + body.session)) : null;
  if (!sess) return json({ error: 'Session expirée : reconnecte-toi avec Discord.', expired: true }, 401);

  const action = body.action;
  const clientId = env.DISCORD_CLIENT_ID || DEFAULT_CLIENT_ID;
  const invite = gid => `https://discord.com/oauth2/authorize?${new URLSearchParams({ client_id: clientId, permissions: INVITE_PERMS, scope: 'bot', ...(gid ? { guild_id: gid, disable_guild_select: 'true' } : {}) })}`;

  if (action === 'me') {
    const ids = sess.guilds.map(g => g.id);
    const [present, rows] = await Promise.all([botGuildIds(env),
      ids.length ? env.DB.prepare(`SELECT id, data FROM docs WHERE col = 'discord_guilds' AND deleted = 0 AND id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all() : { results: [] }]);
    const regs = new Map(rows.results.map(r => [r.id, jparse(r.data) || {}]));
    return json({ user: sess.user, guilds: sess.guilds.map(g => ({ ...g, botPresent: present.has(g.id),
      status: regs.get(g.id)?.status || null, paused: !!regs.get(g.id)?.paused })), inviteUrls: Object.fromEntries(ids.map(i => [i, invite(i)])) });
  }

  // Toutes les autres actions visent un serveur que la personne gère
  const guildId = String(body.guildId || '');
  if (!SNOW.test(guildId) || !sess.guilds.some(g => g.id === guildId)) return json({ error: 'Tu ne gères pas ce serveur (ou la session est trop ancienne : reconnecte-toi).' }, 403);
  const guildName = sess.guilds.find(g => g.id === guildId).name;
  let doc = await dgGet(env, guildId);

  if (action === 'uninstall') return uninstallStep(env, guildId, doc, body, json);

  const present = (await botGuildIds(env)).has(guildId);
  if (!present) return json({ botPresent: false, inviteUrl: invite(guildId) });
  if (doc?.status === 'removing') return json({ error: 'Désinstallation en cours.', removing: true }, 409);

  if (action === 'inspect') {
    const [chs, roles, g] = await Promise.all([dc(env, 'GET', `/guilds/${guildId}/channels`), dc(env, 'GET', `/guilds/${guildId}/roles`), dc(env, 'GET', `/guilds/${guildId}`)]);
    if (!chs.ok) return json({ error: 'Serveur illisible par le bot (permissions ?).', detail: chs.data?.message }, 502);
    return json({ botPresent: true, community: !!g.data?.features?.includes('COMMUNITY'),
      channels: chs.data.filter(c => [0, 4, 5, 15].includes(c.type)).map(c => ({ id: c.id, name: c.name, type: c.type, parent_id: c.parent_id || null, position: c.position })),
      roles: (roles.data || []).filter(r => r.id !== guildId && !r.managed).sort((a, b) => b.position - a.position).map(r => ({ id: r.id, name: r.name, color: r.color })),
      config: doc });
  }

  if (action === 'save') {
    const c = body.config || {};
    const chs = await dc(env, 'GET', `/guilds/${guildId}/channels`);
    if (!chs.ok) return json({ error: 'Serveur illisible par le bot.' }, 502);
    const real = new Set(chs.data.filter(x => x.type !== 4).map(x => x.id));
    let cfg;
    try { cfg = cleanConfig(c, doc, real); } catch (e) { return json({ error: e.message }, 400); }
    if (cfg.mode === 'existing' && !cfg.channels.some(x => x.id)) return json({ error: 'Choisis au moins un salon existant.' }, 400);
    if (cfg.mode === 'create' && !cfg.channels.length) return json({ error: 'Le plan de salons est vide.' }, 400);
    if (cfg.access === 'roles' && !cfg.roleIds.length) return json({ error: 'Choisis au moins un rôle (ou un autre accès).' }, 400);
    const now = Date.now(), isNew = !doc, wasApproved = doc?.status === 'approved';
    doc = { ...(doc || {}), ...cfg, guildId, guildName, ownerId: doc?.ownerId || sess.user.id, ownerName: doc?.ownerName || sess.user.name,
      status: doc?.status || 'pending', paused: doc ? !!doc.paused : false, createdAt: doc?.createdAt || now, updatedAt: now,
      createdCategories: doc?.createdCategories || [] };
    pushLog(doc, isNew ? `Inscription enregistrée par ${sess.user.name} (${cfg.channels.length} salon(s), ${cfg.mode === 'create' ? 'à créer' : 'existants'}) : en attente de validation` : `Réglages modifiés par ${sess.user.name} (${cfg.channels.length} salon(s))`);
    if (wasApproved) { doc.modifiedAfterApproval = true; pushLog(doc, 'Modification appliquée tout de suite (serveur déjà validé, pas de nouvelle validation) : à vérifier par la modération'); }
    if (doc.status === 'approved' && !doc.paused) pushLog(doc, triggerText(await triggerBot(env)));
    await dgPut(env, guildId, doc);
    return json({ ok: true, config: doc });
  }

  if (!doc) return json({ error: "Ce serveur n'est pas encore inscrit : enregistre d'abord les réglages." }, 404);

  if (action === 'set_paused') {
    doc.paused = !!body.paused; doc.updatedAt = Date.now();
    pushLog(doc, doc.paused ? 'Envoi mis en pause par le chef de serveur' : 'Envoi repris par le chef de serveur');
    if (doc.status === 'approved' && !doc.paused) pushLog(doc, triggerText(await triggerBot(env)));
    await dgPut(env, guildId, doc);
    return json({ ok: true, config: doc });
  }

  if (action === 'purge' || action === 'restart') return purgeStep(env, guildId, doc, json, action === 'restart');

  // ── Gestion salon par salon (écran de gestion de la page) ──
  if (action === 'update_channel' || action === 'remove_channel' || action === 'add_channel') {
    doc.channels ||= [];
    const i = parseInt(body.index, 10), c = doc.channels[i];
    if (action === 'add_channel') {
      if (doc.channels.length >= MAX_CHANNELS) return json({ error: 'Trop de salons dans le plan.' }, 400);
      const n = slug(body.channel?.name);
      if (!n) return json({ error: 'Nom de salon requis.' }, 400);
      doc.channels.push({ name: n, type: body.channel?.type === 'text' ? 'text' : 'forum', categoryName: sanitizeName(body.channel?.categoryName, 100), id: '', itemCats: strList(body.channel?.itemCats, /^[a-z]{3,20}$/, ITEM_CATS.length).filter(x => ITEM_CATS.includes(x)), paliers: strList(body.channel?.paliers, /^[\w\-]{1,30}$/, 30), created: false, subscribed: true });
      pushLog(doc, `Salon « ${n} » ajouté au plan`);
    } else if (!c) return json({ error: 'Salon introuvable dans le plan.' }, 404);
    else if (action === 'remove_channel') { doc.channels.splice(i, 1); pushLog(doc, `Salon « ${c.name} » retiré du plan (le salon Discord n'est pas supprimé)`); }
    else {
      const p = body.patch || {};
      if ('subscribed' in p) { c.subscribed = !!p.subscribed; delete c.skip; pushLog(doc, `« ${c.name} » : ${c.subscribed ? 'inscrit (salon activé : il reçoit les items)' : 'pas inscrit (rien n\'est envoyé dans ce salon)'}`); }
      if (typeof p.name === 'string' && slug(p.name) && slug(p.name) !== c.name) {
        const nn = slug(p.name);
        if (c.id && c.created) { const r = await dc(env, 'PATCH', `/channels/${c.id}`, { name: nn }); if (!r.ok) return json({ error: 'Renommage refusé par Discord : ' + (r.data?.message || r.status) }, 502); } // salons créés par le bot : renommés aussi sur Discord
        pushLog(doc, `Salon « ${c.name} » renommé « ${nn} »`); c.name = nn;
      }
      if (typeof p.categoryName === 'string' && !c.id) c.categoryName = sanitizeName(p.categoryName, 100);
      if (Array.isArray(p.itemCats)) c.itemCats = strList(p.itemCats, /^[a-z]{3,20}$/, ITEM_CATS.length).filter(x => ITEM_CATS.includes(x));
      if (Array.isArray(p.paliers)) c.paliers = strList(p.paliers, /^[\w\-]{1,30}$/, 30);
      if (p.type && !c.id) c.type = p.type === 'text' ? 'text' : 'forum';
    }
    doc.updatedAt = Date.now();
    await dgPut(env, guildId, doc);
    return json({ ok: true, config: doc });
  }

  // envoi à la demande pour un salon : traité par le bot (cartes dessinées côté Node)
  if (action === 'send_request') {
    const c = (doc.channels || [])[parseInt(body.index, 10)];
    if (!c || !c.id) return json({ error: "Ce salon n'existe pas encore : crée-le d'abord." }, 400);
    const mode = body.mode === 'missing' ? 'missing' : 'all';
    doc.requests = [...(doc.requests || []).filter(r => r.id !== c.id), { id: c.id, mode, at: Date.now() }].slice(-30);
    doc.updatedAt = Date.now();
    pushLog(doc, `« ${c.name} » : ${mode === 'all' ? 'renvoi de toute la data demandé' : 'envoi des items manquants demandé'}`);
    if (doc.status === 'approved' && !doc.paused) pushLog(doc, triggerText(await triggerBot(env)));
    else pushLog(doc, 'Envoi en attente : ' + (doc.status !== 'approved' ? 'le serveur doit d\'abord être validé' : 'l\'envoi est en pause'));
    await dgPut(env, guildId, doc);
    return json({ ok: true, config: doc });
  }

  // vider un salon : suppression immédiate de ses posts (par paquets), sans renvoi automatique
  if (action === 'clear_channel') {
    const c = (doc.channels || [])[parseInt(body.index, 10)];
    if (!c || !c.id) return json({ error: 'Salon introuvable.' }, 404);
    return clearChannelStep(env, guildId, doc, c, json);
  }

  if (action === 'create_channels') {
    if (doc.mode !== 'create') return json({ error: 'Ce serveur utilise des salons existants.' }, 400);
    const chs = await dc(env, 'GET', `/guilds/${guildId}/channels`);
    if (!chs.ok) return json({ error: 'Serveur illisible par le bot.' }, 502);
    const all = chs.data;
    const ow = overwrites(env, guildId, doc);
    let budget = CREATE_BUDGET, madeNow = 0, failure = null;
    doc.createdCategories ||= [];
    for (const [ci, c] of doc.channels.entries()) {
      if (c.subscribed === false || c.skip || (Number.isInteger(body.only) && body.only !== ci)) continue; // pas inscrit : jamais créé ; ou création d'un seul salon
      if (c.id && all.some(x => x.id === c.id)) continue;
      c.id = '';
      if (!c.name) continue;
      if (budget <= 0) break;
      const typeNum = c.type === 'text' ? 0 : 15;
      // catégorie : retrouvée par nom (sans tenir compte de la casse) ou créée
      let parentId;
      const catName = [doc.prefix, c.categoryName].filter(Boolean).join(' ').slice(0, 100); // préfixe seul = une catégorie unique
      if (catName) {
        let cat = all.find(x => x.type === 4 && nkey(x.name) === nkey(catName));
        if (!cat) {
          if (budget < 2) break;
          const r = await dc(env, 'POST', `/guilds/${guildId}/channels`, { name: catName, type: 4, permission_overwrites: ow });
          budget--;
          if (!r.ok) { failure = r.data?.message || ('Discord ' + r.status); break; }
          cat = r.data; all.push(cat); doc.createdCategories.push(cat.id); madeNow++;
        }
        parentId = cat.id;
      }
      const existing = all.find(x => x.type === typeNum && nkey(x.name) === nkey(c.name) && (x.parent_id || undefined) === parentId);
      if (existing) { c.id = existing.id; continue; }
      const r = await dc(env, 'POST', `/guilds/${guildId}/channels`, { name: c.name, type: typeNum, parent_id: parentId, permission_overwrites: ow });
      budget--;
      if (!r.ok) { failure = r.data?.message || ('Discord ' + r.status); break; }
      all.push(r.data); c.id = r.data.id; c.created = true; madeNow++;
    }
    doc.updatedAt = Date.now();
    const remaining = doc.channels.filter(c => c.name && !c.id && c.subscribed !== false && !c.skip).length;
    pushLog(doc, failure ? `Création de salons : échec (${failure})` : `Création de salons : ${madeNow} créé(s) sur Discord, ${remaining} restant(s)`);
    await dgPut(env, guildId, doc);
    return json({ ok: !failure, error: failure ? failure + (/community|forum/i.test(failure) ? ' (les forums demandent le mode Communauté : choisis « salons texte »)' : ' (le bot a-t-il « Gérer les salons » ?)') : undefined, created: madeNow, remaining, config: doc });
  }

  return json({ error: 'Action inconnue' }, 400);
}

// ══ POST /guild/bot ══ (processus Node permanent)
const REPORT_KEYS = ['lastSentAt', 'lastError', 'posted', 'pending', 'initialDone', 'purge', 'paused'];

export async function handleGuildBot(request, env, deps) {
  const { json } = deps;
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);

  if (body.action === 'trigger') {
    const result = await triggerBot(env);
    const gid = String(body.guildId || '');
    if (SNOW.test(gid)) { const d = await dgGet(env, gid); if (d) { pushLog(d, triggerText(result)); await dgPut(env, gid, d); } }
    return json({ ok: true, result });
  }
  // Serveur principal (plan de la modération, config/discord_routes) : posts déjà faits depuis le navigateur, et ids des salons créés par le bot
  if (body.action === 'main_posts') {
    const rows = (await env.DB.prepare("SELECT data FROM docs WHERE col = 'discord_posts' AND deleted = 0").all()).results;
    return json({ posts: rows.map(r => jparse(r.data)).filter(d => d && d.itemId && d.channelId).map(d => ({ itemId: String(d.itemId), channelId: String(d.channelId), threadId: d.threadId || null, messageId: d.messageId || null })) });
  }
  if (body.action === 'main_patch') {
    const row = await env.DB.prepare("SELECT data FROM docs WHERE col = 'config' AND id = 'discord_routes' AND deleted = 0").bind().first();
    const cfg = jparse(row?.data);
    if (!cfg) return json({ error: 'config/discord_routes absente' }, 404);
    let n = 0;
    for (const u of (Array.isArray(body.updates) ? body.updates : []).slice(0, 60)) {
      if (!SNOW.test(String(u.id || ''))) continue;
      const c = (cfg.channels || []).find(x => x.name === u.name && (x.categoryName || '') === (u.categoryName || '') && !x.id);
      if (!c) continue;
      c.id = String(u.id); if (SNOW.test(String(u.categoryId || ''))) c.categoryId = String(u.categoryId); n++;
      const mine = ((cfg.createdByBot ||= {})[cfg.guildId] ||= { channels: [], categories: [] });
      if (!mine.channels.includes(c.id)) mine.channels.push(c.id);
      if (u.newCategory && SNOW.test(String(u.categoryId || '')) && !mine.categories.includes(u.categoryId)) mine.categories.push(String(u.categoryId));
    }
    if (n) {
      if (cfg.guildId) (cfg.plans ||= {})[cfg.guildId] = cfg.channels;
      await env.DB.batch([
        env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"),
        env.DB.prepare("INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('config', 'discord_routes', ?, (SELECT v FROM meta WHERE k = 'rev'), 0, 0) ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0").bind(JSON.stringify(cfg)),
      ]);
    }
    return json({ ok: true, updated: n });
  }
  if (body.action === 'list') {
    const rows = (await env.DB.prepare("SELECT id, data FROM docs WHERE col = 'discord_guilds' AND deleted = 0").all()).results;
    return json({ guilds: rows.map(r => ({ id: r.id, ...jparse(r.data) })) });
  }
  // État du bot (le bot tourne dans GitHub Actions, sans disque persistant) : docs col 'bot_state', illisible / non inscriptible via /db/*
  if (body.action === 'state_get' || body.action === 'state_set') {
    const key = String(body.key || '');
    if (!/^(main|guild_\d{15,25})$/.test(key)) return json({ error: 'clé invalide' }, 400);
    if (body.action === 'state_get') {
      const r = await env.DB.prepare("SELECT data FROM docs WHERE col = 'bot_state' AND id = ? AND deleted = 0").bind(key).first();
      return json({ value: r ? jparse(r.data) : null });
    }
    const raw = JSON.stringify(body.value ?? null);
    if (raw.length > 900000) return json({ error: 'état trop gros' }, 413);
    await env.DB.batch(body.value == null ? [
      env.DB.prepare("UPDATE docs SET deleted = 1 WHERE col = 'bot_state' AND id = ?").bind(key),
    ] : [env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES ('bot_state', ?, ?, 0, 0, 0)
      ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, deleted = 0`).bind(key, raw)]);
    return json({ ok: true });
  }
  const id = String(body.guildId || '');
  if (!SNOW.test(id)) return json({ error: 'guildId invalide' }, 400);
  if (body.action === 'uninstall') return uninstallStep(env, id, await dgGet(env, id), body, json); // retrait demandé par la modération
  if (body.action === 'ack_remove') { await dgDelete(env, id); return json({ ok: true }); }
  if (body.action === 'report') {
    const doc = await dgGet(env, id);
    if (!doc) return json({ ok: true, gone: true });
    for (const k of REPORT_KEYS) if (body.patch && k in body.patch) doc[k] = body.patch[k];
    if (Array.isArray(body.patch?.log)) body.patch.log.slice(0, 10).forEach(m => pushLog(doc, m));
    if (Array.isArray(body.patch?.requestsDone)) doc.requests = (doc.requests || []).filter(r => !body.patch.requestsDone.includes(r.id));
    // salon supprimé sur Discord : en mode « créé par le bot », on oublie son id pour que la page propose de le recréer
    for (const cid of (Array.isArray(body.patch?.badChannels) ? body.patch.badChannels : []).slice(0, 20)) {
      const c = (doc.channels || []).find(x => x.id === cid);
      if (!c) continue;
      pushLog(doc, `Salon « ${c.name || cid} » introuvable sur Discord (supprimé ?)` + (doc.mode === 'create' ? ' : à recréer avec « Créer les salons manquants » sur la page de statut' : ' : choisis un autre salon dans « Modifier les réglages »'));
      if (doc.mode === 'create') { c.id = ''; c.created = false; }
    }
    if (typeof doc.lastError === 'string') doc.lastError = doc.lastError.slice(0, 300);
    await dgPut(env, id, doc);
    return json({ ok: true });
  }
  return json({ error: 'Action inconnue' }, 400);
}
