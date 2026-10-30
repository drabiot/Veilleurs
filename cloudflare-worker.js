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

// ── Constantes ──────────────────────────────────────────────
import { handleStoreRead, handleStoreWrite, authUid } from './worker-store.js';
import { handleGuildApi, handleGuildBot, finishGuildOauth } from './guild-onboarding.js';

const FIREBASE_KEY   = 'AIzaSyBdeKmmEFxmGt7_37PF9uWhm5nz-6eaKq0';
const CF_ACCOUNT_ID  = 'db3d4d15175ddbfbd2720490acc8fb53'; // identifiant public du compte Cloudflare (pas un secret)
const CF_D1_ID       = '8deed6e8-1a17-4339-86ef-fad656a886a9';

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

async function handleInteraction(rawBody) {
  const interaction = JSON.parse(rawBody);

  // PING → PONG (Discord vérifie l'endpoint avec ça)
  if (interaction.type === 1) return iResponse({ type: 1 });

  // La commande /wiki est supprimée (elle lisait Firestore) : aucune suggestion, message d'information.
  if (interaction.type === 4) return iResponse({ type: 8, data: { choices: [] } });
  return iResponse({ type: 4, data: { content: 'La commande /wiki est désactivée.', flags: 64 } });
}


// ══════════════════════════════════════════════════════════════
//  MAIN FETCH HANDLER
// ══════════════════════════════════════════════════════════════

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders() });
    }
    const _path = new URL(request.url).pathname;
    if (_path === '/discord/callback' && request.method === 'GET') return handleDiscordCallback(request, env);
    if (_path === '/discord/start' && request.method === 'POST') return handleDiscordStart(request, env);
    if (_path === '/guild/api' && request.method === 'POST') return handleGuildApi(request, env, { json });
    if (_path === '/guild/bot' && request.method === 'POST') return handleGuildBot(request, env, { json });
    if (_path === '/db/sync' && request.method === 'GET') return handleDbSync(new URL(request.url), env);
    if (_path === '/db/read' && request.method === 'POST') return handleStoreRead(request, env, corsHeaders());
    if (_path === '/db/write' && request.method === 'POST') return handleStoreWrite(request, env, corsHeaders(), ctx);
    if (_path === '/db/refresh' && request.method === 'POST') return handleDbRefresh(request, env, ctx);
    if (_path === '/db/resync' && request.method === 'POST') return handleDbResync(request, env);
    if (_path === '/me' && request.method === 'POST') return handleMe(request, env);
    if (_path === '/track' && request.method === 'POST') return handleTrack(request, env);
    if (_path === '/track/merge' && request.method === 'POST') return handleTrackMerge(request, env);
    if (_path === '/stats' && request.method === 'POST') return handleStats(request, env);
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

    // ── Route: Discord Interaction (signature header present) ──
    const sigHeader = request.headers.get('X-Signature-Ed25519');
    const tsHeader  = request.headers.get('X-Signature-Timestamp');

    if (sigHeader && tsHeader) {
      const rawBody = await request.text();
      const valid = await verifyDiscordSignature(env.DISCORD_PUBLIC_KEY, sigHeader, tsHeader, rawBody);
      if (!valid) return new Response('Unauthorized', { status: 401 });
      return handleInteraction(rawBody);
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
        // 1er fichier = miniature du post dans le forum (texture), 2e = carte : le fichier d'index 0 est la 1re image du message
        const file2 = fd.get('file2'), fileName2 = fd.get('fileName2');
        if (file && fileName) outFd.append('files[0]', file, fileName);
        if (file2 && fileName2) outFd.append('files[1]', file2, fileName2);

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

      if (action === 'get_bot_guilds') {
        const r = await fetch('https://discord.com/api/v10/users/@me/guilds', { headers: botHdr });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'leave_guild') { // le bot quitte le serveur (irréversible : il faut le réinviter pour revenir)
        const r = await fetch(`https://discord.com/api/v10/users/@me/guilds/${body.guildId}`, { method: 'DELETE', headers: { 'Authorization': `Bot ${env.BOT_TOKEN}` } }); // pas de Content-Type sans corps (Discord répond « invalid JSON »)
        return r.ok ? json({ status: r.status }) : json(await r.json().catch(() => ({})), r.status);
      }

      if (action === 'get_guild_channels') {
        const r = await fetch(`https://discord.com/api/v10/guilds/${body.guildId || env.DISCORD_GUILD_ID}/channels`, { headers: botHdr });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'create_channel') { // salon dans le serveur (forum = 15, texte = 0, catégorie = 4) ; le bot doit avoir « Gérer les salons »
        const r = await fetch(`https://discord.com/api/v10/guilds/${body.guildId || env.DISCORD_GUILD_ID}/channels`, {
          method: 'POST', headers: botHdr, body: JSON.stringify({ name: String(body.name || '').slice(0, 100), type: [0, 4, 15].includes(body.type) ? body.type : 15, parent_id: body.parentId || undefined }),
        });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      if (action === 'get_bot_user') {
        const r = await fetch('https://discord.com/api/v10/users/@me', { headers: botHdr });
        return json(await r.json(), r.ok ? 200 : r.status);
      }

      // Droits d'un rôle / membre sur un salon (masquer un salon pendant un envoi en lot) : le bot doit avoir « Gérer les rôles »
      if (action === 'set_overwrite') {
        const r = await fetch(`https://discord.com/api/v10/channels/${body.channelId}/permissions/${body.overwriteId}`, {
          method: 'PUT', headers: botHdr, body: JSON.stringify({ type: body.type === 1 ? 1 : 0, allow: String(body.allow || '0'), deny: String(body.deny || '0') }),
        });
        return r.ok ? json({ status: r.status }) : json(await r.json().catch(() => ({})), r.status);
      }

      if (action === 'delete_overwrite') {
        const r = await fetch(`https://discord.com/api/v10/channels/${body.channelId}/permissions/${body.overwriteId}`, { method: 'DELETE', headers: { 'Authorization': `Bot ${env.BOT_TOKEN}` } });
        return r.ok ? json({ status: r.status }) : json(await r.json().catch(() => ({})), r.status);
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

// ── Service account Google (custom token Firebase Auth) ──
async function signJwt(sa, claims) {
  const head = b64uStr(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const body = b64uStr(JSON.stringify(claims));
  const pem  = sa.private_key.replace(/-----[^-]+-----|\s/g, '');
  const key  = await crypto.subtle.importKey('pkcs8', Uint8Array.from(atob(pem), c => c.charCodeAt(0)),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig  = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${head}.${body}`));
  return `${head}.${body}.${b64u(sig)}`;
}

async function firebaseCustomToken(uid, env) {
  const sa  = JSON.parse(env.FIREBASE_SA);
  const now = Math.floor(Date.now() / 1000);
  return signJwt(sa, {
    iss: sa.client_email, sub: sa.client_email, uid, iat: now, exp: now + 3600,
    aud: 'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit',
  });
}

// Journal de connexion (alimente « Connexions récentes » des stats) ; jamais bloquant, admins exclus.
async function logLogin(env, uid, pseudo, role) {
  if (role === 'admin' || !env.DB) return;
  try { await env.DB.prepare('INSERT INTO login_log (uid, pseudo, ts) VALUES (?, ?, ?)').bind(uid, pseudo || '', Date.now()).run(); } catch { /* le journal ne doit jamais empêcher la connexion */ }
}

// ── Rôle site déduit des rôles Discord (config/discordRoles) ──
let _roleCfgCache = null; // { at, cfg, custom } : 5 min, économise 2 lectures D1 par connexion
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

// `wanted` : un nom ou une liste de noms par ordre de préférence (pseudo serveur, nom affiché, identifiant Discord) ; le premier qui reste lisible une fois nettoyé est pris
async function uniquePseudo(env, wanted, discordId) {
  const clean = w => String(w || '').replace(/[^\p{L}\p{N}_\- \[\]]/gu, '').trim().slice(0, 32);
  let p = [].concat(wanted).map(clean).find(c => c.length >= 2) || '';
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
  const guilds = body.mode === 'guilds'; // inscription d'un serveur : scope `guilds`, retour en redirection plein écran
  const state = await signState({ m: guilds ? 'guilds' : body.mode === 'link' ? 'link' : 'login', uid, o: body.origin, exp: Date.now() + 10 * 60000,
    r: guilds || body.redirect ? 1 : 0, p: /^\/[\w\-./]*$/.test(body.path || '') ? body.path : '/' }, env);
  const url = `https://discord.com/oauth2/authorize?${new URLSearchParams({
    client_id: env.DISCORD_CLIENT_ID, response_type: 'code', scope: guilds ? 'identify guilds' : 'identify',
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
    if (state.m === 'guilds') { // inscription d'un serveur (guild-onboarding.js) : pas de compte du site, juste une session
      const sid = await finishGuildOauth(env, tok.access_token);
      return new Response(null, { status: 302, headers: { Location: `${state.o}${state.p || '/'}#${new URLSearchParams({ 'vcl-guild': sid })}`, 'Cache-Control': 'no-store' } });
    }
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
    // pseudo du site : créé à la 1re connexion, et refait pour les comptes restés sur le pseudo de secours « VeilleurNNNN »
    if (!existing || /^Veilleur\d{4}$/.test(existing.pseudo || '')) {
      const p = await uniquePseudo(env, [member.nick, me.global_name, me.username], me.id);
      if (!existing || !/^Veilleur\d{4}$/.test(p)) data.pseudo = p;
    }
    // admin / roleLocked : jamais écrasé par la synchro Discord
    if (!existing || (existing.role !== 'admin' && !existing.roleLocked)) {
      data.role = await resolveSiteRole(env, member.roles || []);
    }
    await userPatch(env, uid, data);
    await logLogin(env, uid, data.discordName || data.pseudo || existing?.pseudo, data.role || existing?.role);

    return out({ token: await firebaseCustomToken(uid, env), pseudo: data.pseudo || existing?.pseudo || '' });
  } catch (e) {
    // Limite quotidienne Cloudflare (offre gratuite) atteinte : message clair plutôt qu'une erreur technique
    if (/D1|quota|limit|exceeded/i.test(e.message)) return fail('Le site a atteint sa limite quotidienne : la connexion est indisponible pour le moment. Réessaie demain matin (remise à zéro à 01h00, heure de Paris).');
    return fail('Erreur serveur : ' + e.message);
  }
}


// ══════════════════════════════════════════════════════════════
//  TRACKING & STATS (D1, binding `DB` — schéma dans d1/schema.sql)
//
//  POST /track  public : { ops: [{ col, id, set?: {clé: valeur}, inc?: {clé: 1..20} }] }
//               équivalent de setDoc(…, {merge:true}) + increment(1) sur les 4 collections de stats.
//  POST /stats  admin   : { secret, action: 'summary' (défaut) | 'user' | 'reset' } — agrégats calculés en SQL ; même secret que le proxy Discord.
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

/** POST /track/merge { idToken, anonId } : à la connexion, les stats du profil anonyme `anon_…` de ce navigateur
 *  sont additionnées à celles du compte, puis le profil anonyme est supprimé (donc idempotent : un 2e appel ne fait rien). */
async function handleTrackMerge(request, env) {
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400); }
  const anonId = String(body?.anonId || '');
  if (!/^anon_[A-Za-z0-9_\-]{1,100}$/.test(anonId)) return json({ error: 'anonId invalide' }, 400);
  const uid = await authUid(String(body.idToken || ''), env);
  if (!uid || !TRACK_ID_RE.test(uid)) return json({ error: 'Non connecté' }, 401);

  const get = id => env.DB.prepare("SELECT data FROM track_docs WHERE col = 'user_visits' AND id = ?").bind(id).first();
  const [a, m] = await Promise.all([get(anonId), get(uid)]);
  if (!a) return json({ ok: true, merged: false });
  const anon = JSON.parse(a.data), mem = m ? JSON.parse(m.data) : {};
  const out = { ...mem };
  for (const [k, v] of Object.entries(anon)) {
    if (k === 'isAnonymous' || k === 'pseudo') continue;           // l'identité du compte prime
    if (typeof v === 'number') out[k] = (typeof out[k] === 'number' ? out[k] : 0) + v;
    else if (k === 'firstSeen') out[k] = out[k] && out[k] < v ? out[k] : v;
    else if (k === 'lastSeen') out[k] = out[k] && out[k] > v ? out[k] : v;
    else if (out[k] === undefined) out[k] = v;                      // noms d'items, etc.
  }
  out.isAnonymous = false;
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO track_docs (col, id, data, updated_at) VALUES ('user_visits', ?, ?, ?) ON CONFLICT(col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at")
      .bind(uid, JSON.stringify(out), now),
    env.DB.prepare("DELETE FROM track_docs WHERE col = 'user_visits' AND id = ?").bind(anonId),
  ]);
  return json({ ok: true, merged: true });
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
  if (!env.DB) return json({ error: 'D1 non configurée' }, 503);
  const q = (sql, ...args) => env.DB.prepare(sql).bind(...args);

  // Consommation Cloudflare (requêtes du worker, lectures / écritures D1) sur 7 jours, via l'API GraphQL Analytics.
  // Nécessite le secret CF_API_TOKEN (jeton « Account Analytics : Read ») ; sinon on répond configured:false.
  if (body.action === 'cloudflare') {
    if (!env.CF_API_TOKEN) return json({ configured: false });
    const acc = env.CF_ACCOUNT_ID || CF_ACCOUNT_ID, now = new Date();
    const day = d => d.toISOString().slice(0, 10);
    const gql = `query($acc:String!,$since:Time!,$until:Time!,$a:Date!,$b:Date!){viewer{accounts(filter:{accountTag:$acc}){
      w: workersInvocationsAdaptive(limit:500, filter:{scriptName:"veilleurs", datetime_geq:$since, datetime_leq:$until}, orderBy:[datetimeHour_ASC]){ dimensions{datetimeHour} sum{requests errors subrequests} }
      d: d1AnalyticsAdaptiveGroups(limit:20, filter:{date_geq:$a, date_leq:$b, databaseId:"${CF_D1_ID}"}, orderBy:[date_ASC]){ dimensions{date} sum{readQueries writeQueries rowsRead rowsWritten} }
    }}}`;
    const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
      method: 'POST', headers: { Authorization: `Bearer ${env.CF_API_TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: gql, variables: { acc, since: new Date(now - 7 * 864e5).toISOString(), until: now.toISOString(), a: day(new Date(now - 6 * 864e5)), b: day(now) } }),
    });
    const g = await r.json().catch(() => ({}));
    if (!r.ok || g.errors?.length) {
      const t = String(env.CF_API_TOKEN); // diagnostic sans révéler le jeton : sa forme seulement
      return json({ configured: true, error: (g.errors?.[0]?.message || ('HTTP ' + r.status)) + ` — jeton enregistré : ${t.length} caractères` + (/\s/.test(t) ? ', contient des espaces/retours à la ligne' : '') + (/^Bearer\s/i.test(t) ? ', commence par « Bearer »' : '') + ' (un jeton Cloudflare valide fait 40 caractères)' }, 502);
    }
    const a0 = g.data?.viewer?.accounts?.[0] || {};
    const days = {};
    const slot = k => (days[k] ??= { date: k, requests: 0, errors: 0, subrequests: 0, d1Reads: 0, d1Writes: 0, rowsRead: 0, rowsWritten: 0 });
    for (const x of a0.w || []) { const o = slot(x.dimensions.datetimeHour.slice(0, 10)); o.requests += x.sum.requests; o.errors += x.sum.errors; o.subrequests += x.sum.subrequests; }
    for (const x of a0.d || []) { const o = slot(x.dimensions.date); o.d1Reads = x.sum.readQueries; o.d1Writes = x.sum.writeQueries; o.rowsRead = x.sum.rowsRead; o.rowsWritten = x.sum.rowsWritten; }
    return json({ configured: true, days: Object.values(days).sort((x, y) => x.date < y.date ? -1 : 1),
      limits: { requests: 100000, rowsRead: 5000000, rowsWritten: 100000 } });
  }

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
  const date7 = String(body.date7 || ''), date30 = String(body.date30 || ''), date35 = String(body.date35 || '');
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
    q("SELECT CASE WHEN json_extract(u.data, '$.discordName') GLOB '*[A-Za-z0-9]*[A-Za-z0-9]*' THEN json_extract(u.data, '$.discordName') ELSE COALESCE(u.pseudo, l.pseudo) END AS pseudo, l.ts FROM login_log l LEFT JOIN users u ON u.uid = l.uid ORDER BY l.ts DESC LIMIT 20").all(),
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
    // Visites des 35 derniers jours : { 'YYYY-MM-DD': { section: n } } (clés plates « dsec.DATE.section »), pour filtrer par période
    const days = {};
    for (const [k, v] of Object.entries(d)) {
      if (!k.startsWith('dsec.') || k.length < 17 || k.slice(5, 15) < date35) continue;
      (days[k.slice(5, 15)] ??= {})[k.slice(16)] = v;
    }
    return { id: r.id, pseudo: d.pseudo, isAnonymous: !!(d.isAnonymous ?? r.id.startsWith('anon_')), total: d.total || 0,
      lastSeen: d.lastSeen || '', sections: uvGroups(d).sections || {}, days };
  };
  const memberRows = members.results.map(slim);
  // Les docs de visites gardent le nom connu au moment du tracking (souvent l'uid) : on affiche le nom actuel du compte (même règle que le journal de connexions)
  if (memberRows.length) {
    const names = await q(`SELECT track_docs.id id, CASE WHEN json_extract(u.data, '$.discordName') GLOB '*[A-Za-z0-9]*[A-Za-z0-9]*' THEN json_extract(u.data, '$.discordName') ELSE u.pseudo END AS name
      FROM track_docs JOIN users u ON u.uid = track_docs.id WHERE track_docs.col = 'user_visits' AND NOT ${UV_ANON} ORDER BY ${UV_TOTAL} DESC LIMIT 300`).all();
    const byId = new Map(names.results.filter(r => r.name).map(r => [r.id, r.name]));
    for (const m of memberRows) if (byId.has(m.id)) m.pseudo = byId.get(m.id);
  }
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


const D1_SYNC_COLS = ['items', 'mobs', 'personnages', 'regions', 'quetes', 'panoplies', 'map_markers', 'zones', 'donjons'];

/** GET /db/sync?col=items&since=N → { rev, epoch, docs: [{id, d}], deleted: [id] } */
async function handleDbSync(url, env) {
  const col = url.searchParams.get('col');
  const since = parseInt(url.searchParams.get('since') || '0') || 0;
  if (!env.DB || !D1_SYNC_COLS.includes(col)) return json({ error: 'Collection inconnue' }, 400);
  const meta = (await env.DB.prepare("SELECT k, v FROM meta WHERE k IN ('rev', 'epoch') OR k = ?").bind('full:' + col).all()).results;
  const m = Object.fromEntries(meta.map(r => [r.k, r.v]));
  if (!m.rev || m['full:' + col] !== 0) return json({ error: 'Pas encore synchronisé' }, 503); // le client garde son cache local
  const rows = (since > 0
    ? await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND updated_at > ?').bind(col, since).all()
    : await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND deleted = 0').bind(col).all()).results;
  const docs = rows.filter(r => !r.deleted).map(r => `{"id":${JSON.stringify(r.id)},"d":${r.data}}`).join(',');
  const deleted = JSON.stringify(rows.filter(r => r.deleted).map(r => r.id));
  return new Response(`{"rev":${m.rev},"epoch":${m.epoch},"docs":[${docs}],"deleted":${deleted}}`, {
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

/** POST /db/refresh et /db/resync : anciens points d'entrée de la synchro Firestore → D1, désormais sans objet. */
const handleDbRefresh = async () => json({ ok: true, disabled: true });
const handleDbResync  = async () => json({ ok: true, disabled: true });

async function d1UserRow(env, field, value) {
  const col = field === 'discordId' ? 'discord_id' : field === 'pseudo' ? 'pseudo' : 'uid';
  return env.DB.prepare(`SELECT uid, data, pending FROM users WHERE ${col} = ? LIMIT 1`).bind(value).first();
}
const jparse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const rowToUser = r => (r ? { _id: r.uid, ...(jparse(r.data) || {}), ...(jparse(r.pending) || {}) } : null);

function d1SaveUser(env, uid, data, pending) {
  return env.DB.prepare(`INSERT INTO users (uid, data, discord_id, pseudo, pending) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (uid) DO UPDATE SET data = excluded.data, discord_id = excluded.discord_id, pseudo = excluded.pseudo, pending = excluded.pending`)
    .bind(uid, JSON.stringify(data), data.discordId ?? null, data.pseudo ?? null, pending ? JSON.stringify(pending) : null).run();
}

/** Compte trouvé par pseudo / discordId / uid ; null s'il n'existe pas (la table `users` de D1 est la source de vérité). */
async function userLookup(env, field, value) {
  return rowToUser(await d1UserRow(env, field, value));
}
const userFind = (env, field, value) => userLookup(env, field, value);
const userGet  = (env, uid) => userLookup(env, 'uid', uid);

/** Enregistre un patch de compte dans D1. */
async function userPatch(env, uid, patch) {
  const row = await d1UserRow(env, 'uid', uid);
  await d1SaveUser(env, uid, { ...(jparse(row?.data) || {}), ...(jparse(row?.pending) || {}), ...patch }, null);
}

/** Documents de config (rôles Discord…) : stockés dans `docs` (col 'config'). */
async function cfgGet(env, path) {
  const id = String(path).replace(/^config\//, '');
  const r = await env.DB.prepare("SELECT data FROM docs WHERE col = 'config' AND id = ? AND deleted = 0").bind(id).first();
  return r ? jparse(r.data) : null;
}

/** POST /me { idToken } : rôle et avatar du compte connecté, lus dans D1 (rôle et avatar du compte connecté). */
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
