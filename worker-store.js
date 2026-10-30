/* ══ worker-store.js — Base de données du site dans Cloudflare D1 (remplace Firestore) ══
   Importé par cloudflare-worker.js. Tout est stocké dans la table `docs` (col, id, data JSON, updated_at = révision globale).

   POST /db/read   { idToken?, col, id? | where?, orderBy?, limit?, startAfter?, since? }
   POST /db/write  { idToken?, ops: [{ op: 'set'|'update'|'delete'|'add', col, id?, data?, merge? }] }

   Valeurs spéciales dans `data` (envoyées par le client sous forme de marqueurs) :
     { __op: 'serverTimestamp' } · { __op: 'increment', n } · { __op: 'deleteField' } · { __op: 'arrayUnion'|'arrayRemove', v: [...] }
   Les dates sont stockées {"__ts": millisecondes}. Les clés pointées d'un `update` (« a.b.c ») visent des champs imbriqués.

   Droits : reprise des règles Firestore (Save/firestore.rules.local-copy), évaluées ici côté serveur avec le rôle lu dans `users`. */

const BASE_TIERS = ['visiteur', 'membre', 'contributeur', 'admin'];
const TIER = { public: 0, visiteur: 0, membre: 1, contributeur: 2, admin: 3 };
const FIREBASE_KEY = 'AIzaSyBdeKmmEFxmGt7_37PF9uWhm5nz-6eaKq0';

const json = (data, status = 200, cors = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', ...cors } });
const jparse = s => { try { return s ? JSON.parse(s) : null; } catch { return null; } };

/* ── Droits par défaut (défauts de moderation.js FIRESTORE_COLLECTIONS ; surchargés par config/permissions.collections) ── */
const COL_DEFAULTS = {
  items:         { read: 'public',       write: 'contributeur' },
  mobs:          { read: 'public',       write: 'contributeur' },
  personnages:   { read: 'public',       write: 'contributeur' },
  regions:       { read: 'public',       write: 'contributeur' },
  quetes:        { read: 'public',       write: 'contributeur' },
  panoplies:     { read: 'public',       write: 'admin' },
  map_markers:   { read: 'public',       write: 'contributeur' },
  donjons:       { read: 'public',       write: 'contributeur' },
  zones:         { read: 'public',       write: 'contributeur' },
  trash:         { read: 'contributeur', write: 'contributeur' },
  discord_posts: { read: 'admin',        write: 'admin' },
  secrets:       { read: 'admin',        write: 'admin' },
  discord_guilds: { read: 'admin',       write: 'admin' }, // serveurs Discord inscrits (page Discord/discord.html) ; écrits par le worker après vérification OAuth
  audit_log:     { read: 'admin',        write: 'contributeur', noUpdate: true, deleteTier: 'admin' },
  events:        { read: 'public',       write: 'admin' },
  known_bugs:    { read: 'public',       write: 'contributeur' },
  config:        { read: 'public',       write: 'admin' },
  reports:       { read: 'contributeur', write: 'contributeur', createTier: 'public' },
};
const HIDDEN_CONFIG_DOCS = new Set(['discord_webhooks']); // lisible par l'admin uniquement

/* ── Auth : jeton Firebase → uid (mémoire 5 min) → rôle lu dans D1 ── */
const _tokCache = new Map();
export async function authUid(idToken, env) {
  if (!idToken) return null;
  // Tests locaux uniquement : actif seulement si la variable TEST_AUTH_SECRET existe (jamais définie en production)
  if (env && env.TEST_AUTH_SECRET && idToken.startsWith('test:' + env.TEST_AUTH_SECRET + ':')) return idToken.split(':')[2] || null;
  const hit = _tokCache.get(idToken);
  if (hit && Date.now() - hit.at < 5 * 60000) return hit.uid;
  const r = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${FIREBASE_KEY}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }),
  }).catch(() => null);
  const uid = r && r.ok ? (await r.json().catch(() => ({}))).users?.[0]?.localId : null;
  if (uid) {
    if (_tokCache.size > 500) _tokCache.clear();
    _tokCache.set(idToken, { uid, at: Date.now() });
  }
  return uid || null;
}

// La collection `users` vit dans la table `users` (index sur discord_id / pseudo, utilisée par la connexion Discord)
async function getDocRow(env, col, id) {
  if (col === 'users') {
    const u = await env.DB.prepare('SELECT data, pending FROM users WHERE uid = ?').bind(id).first();
    return u ? { ...(jparse(u.data) || {}), ...(jparse(u.pending) || {}) } : null;
  }
  const r = await env.DB.prepare('SELECT data, deleted FROM docs WHERE col = ? AND id = ?').bind(col, id).first();
  return r && !r.deleted ? jparse(r.data) : null;
}

async function loadCtx(env, idToken) {
  const uid = await authUid(idToken, env);
  let role = 'visiteur';
  if (uid) {
    const u = await env.DB.prepare('SELECT data FROM users WHERE uid = ?').bind(uid).first();
    role = jparse(u?.data)?.role || 'membre'; // comme les règles : compte connecté sans document = « membre » à la création
    if (!u) role = 'visiteur';
  }
  const [custom, perms, creator] = await Promise.all([
    getDocRow(env, 'config', 'customRoles'), getDocRow(env, 'config', 'permissions'), getDocRow(env, 'config', 'creator'),
  ]);
  const tierOf = r => BASE_TIERS.includes(r) ? BASE_TIERS.indexOf(r)
    : BASE_TIERS.indexOf((custom?.roles || []).find(x => x.id === r)?.baseTier || 'visiteur');
  const tier = uid ? tierOf(role) : 0;
  return { uid, role, tier, perms: perms?.collections || {}, creator };
}

const need = (ctx, level) => level === 'public' || ctx.tier >= TIER[level];

function colRule(ctx, col) {
  const d = COL_DEFAULTS[col];
  if (!d) return null;
  const o = ctx.perms[col] || {};
  return { ...d, read: o.read || d.read, write: o.write || d.write };
}

/* Lecture d'un document autorisée ? (data = contenu) */
function canRead(ctx, col, id, data, listing) {
  const top = col.split('/')[0];
  const isAdmin = ctx.tier >= 3, isContrib = ctx.tier >= 2;
  switch (top) {
    case 'users': return isAdmin || (!listing && ctx.uid === id) || (listing && !!ctx.uid && listing.limit != null && listing.limit <= 2);
    case 'config': return id === 'wiki_version' || (HIDDEN_CONFIG_DOCS.has(id) ? isAdmin : need(ctx, (colRule(ctx, 'config') || {}).read));
    case 'items_hidden': return listing ? isContrib : true;
    case 'builds_published':
      if (col !== 'builds_published') return true; // sous-collection favoritedBy : lecture publique
      return data?.visibility === 'public' || (!!ctx.uid && data?.authorUid === ctx.uid) || isAdmin;
    case 'user_favorites': return !!ctx.uid && data?.uid === ctx.uid;
    case 'builds_sensible': return isContrib;
    case 'submissions': return isAdmin || (isContrib && data?.status === 'pending') || (!!ctx.uid && data?.submittedBy === ctx.uid);
    case 'reports': return isContrib;
    default: { const r = colRule(ctx, col); return !!r && need(ctx, r.read); }
  }
}

/* Écriture autorisée ? (old = document existant ou null, neu = document résultant) */
function canWrite(ctx, op, col, id, old, neu) {
  const top = col.split('/')[0];
  const isAdmin = ctx.tier >= 3, isContrib = ctx.tier >= 2, isMembre = ctx.tier >= 1, authed = !!ctx.uid;
  const changed = (a, b) => { const k = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]); return [...k].filter(x => JSON.stringify(a?.[x]) !== JSON.stringify(b?.[x])); };
  switch (top) {
    case 'users':
      if (op === 'delete') return isAdmin;
      if (isAdmin) return true;
      if (!authed || ctx.uid !== id) return false;
      if (op === 'create') return neu?.role === 'membre' && Object.keys(neu).every(k => ['pseudo', 'role', 'email'].includes(k));
      return changed(old, neu).every(k => ['pseudo', 'email'].includes(k)) && typeof neu?.pseudo === 'string';
    case 'config':
      if (id === 'wiki_version') return isContrib;
      if (id === 'pseudos') {
        if (op === 'delete') return isAdmin;
        return authed && changed(old, neu).every(k => k === ctx.uid);
      }
      return isAdmin;
    case 'builds_published':
      if (col !== 'builds_published') { // favoritedBy/{uid}
        const uidDoc = id; return isMembre && ctx.uid === uidDoc && op !== 'update';
      }
      if (op === 'create') return isMembre && neu?.authorUid === ctx.uid && typeof neu?.name === 'string' && neu.name.length >= 1 && neu.name.length <= 60
        && ['public', 'unlisted'].includes(neu?.visibility) && neu?.previewCount === 0 && neu?.favoriteCount === 0;
      if (op === 'delete') return isAdmin || (authed && old?.authorUid === ctx.uid);
      if (isAdmin) return true;
      { const ch = changed(old, neu);
        const bump = f => Math.abs((neu?.[f] || 0) - (old?.[f] || 0)) === 1;
        if (authed && old?.authorUid === ctx.uid && ch.every(k => ['name', 'visibility', 'updatedAt', 'slots', 'runes', 'skillNodes', 'statsSnapshot', 'classe', 'level', 'slotImages', 'sensibleSlots', 'runeNames', 'titre'].includes(k))) return true;
        if (authed && ch.length === 1 && ch[0] === 'previewCount' && bump('previewCount')) return true;
        if (authed && ch.length === 1 && ch[0] === 'favoriteCount' && bump('favoriteCount')) return true;
        return false; }
    case 'user_favorites':
      if (op === 'create') return isMembre && neu?.uid === ctx.uid;
      if (op === 'delete') return isMembre && old?.uid === ctx.uid;
      return false;
    case 'builds_sensible':
      if (op === 'create') return isMembre && neu?.authorUid === ctx.uid;
      if (op === 'delete') return isAdmin || (authed && old?.authorUid === ctx.uid);
      return false;
    case 'submissions': {
      if (op === 'create') {
        const t = neu?.type;
        return typeof neu?.submitterName === 'string' && neu.submitterName.length >= 2 && neu.submitterName.length <= 80
          && ['item', 'mob', 'pnj', 'region', 'quest', 'panoplie'].includes(t) && neu?.status === 'pending' && Object.keys(neu).length <= 30
          && (isContrib || ctx.creator?.tools?.[t] !== false);
      }
      if (op === 'delete') return isAdmin;
      return isAdmin || ((isContrib || (authed && old?.submittedBy === ctx.uid)) && old?.status === 'pending' && neu?.status === 'pending');
    }
    case 'reports': return op === 'create' ? Object.keys(neu || {}).length <= 20 : isContrib;
    
    default: {
      const r = colRule(ctx, top);
      if (!r) return false;
      if (op === 'create' && r.createTier) return need(ctx, r.createTier);
      if (op === 'update' && r.noUpdate) return false;
      if (op === 'delete' && r.deleteTier) return need(ctx, r.deleteTier);
      return need(ctx, r.write);
    }
  }
}

/* ── Valeurs spéciales ── */
const getPath = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
function setPath(o, p, v) {
  const ks = p.split('.'); let cur = o;
  ks.slice(0, -1).forEach(k => { if (typeof cur[k] !== 'object' || cur[k] === null || Array.isArray(cur[k])) cur[k] = {}; cur = cur[k]; });
  v === undefined ? delete cur[ks[ks.length - 1]] : (cur[ks[ks.length - 1]] = v);
}
function resolveValue(v, prev, now) {
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    if (v.__op === 'serverTimestamp') return { __ts: now };
    if (v.__op === 'increment') return (typeof prev === 'number' ? prev : 0) + (+v.n || 0);
    if (v.__op === 'deleteField') return undefined;
    if (v.__op === 'arrayUnion') { const a = Array.isArray(prev) ? [...prev] : []; (v.v || []).forEach(x => { if (!a.some(y => JSON.stringify(y) === JSON.stringify(x))) a.push(x); }); return a; }
    if (v.__op === 'arrayRemove') return (Array.isArray(prev) ? prev : []).filter(y => !(v.v || []).some(x => JSON.stringify(x) === JSON.stringify(y)));
    if ('__ts' in v) return v;
    const out = {};
    for (const [k, x] of Object.entries(v)) { const r = resolveValue(x, prev?.[k], now); if (r !== undefined) out[k] = r; }
    return out;
  }
  if (Array.isArray(v)) return v.map(x => resolveValue(x, undefined, now)).filter(x => x !== undefined);
  return v;
}

function applyOp(old, op, data, merge, now) {
  if (op.op === 'set' && !merge) return resolveValue(data || {}, undefined, now);
  const base = JSON.parse(JSON.stringify(old || {}));
  for (const [k, v] of Object.entries(data || {})) {
    if (op.op === 'set') { const r = resolveValue(v, base[k], now); r === undefined ? delete base[k] : (base[k] = r); continue; }
    const r = resolveValue(v, getPath(base, k), now);
    setPath(base, k, r);
  }
  return base;
}

const newId = () => { const a = new Uint8Array(15); crypto.getRandomValues(a); return [...a].map(b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join(''); };
const VALID_COL = /^[A-Za-z0-9_]+(\/[A-Za-z0-9_\-]{1,120}\/[A-Za-z0-9_]+)*$/;
const VALID_ID  = /^[^\/]{1,400}$/;

/* ── POST /db/write ── */
export async function handleStoreWrite(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400, cors); }
  const ops = Array.isArray(body.ops) ? body.ops : [];
  if (!ops.length || ops.length > 200) return json({ error: 'ops invalide' }, 400, cors);
  const ctx = await loadCtx(env, body.idToken);
  const now = Date.now();
  const stmts = [], ids = [], cache = new Map(); // cache : état des documents au fil du lot
  const key = (c, i) => c + '\u0000' + i;
  for (const op of ops) {
    const { col } = op;
    if (!VALID_COL.test(col || '') || !['set', 'update', 'delete', 'add'].includes(op.op)) return json({ error: 'op invalide' }, 400, cors);
    const id = op.op === 'add' ? newId() : String(op.id || '');
    if (!VALID_ID.test(id)) return json({ error: 'id invalide' }, 400, cors);
    const k = key(col, id);
    const old = cache.has(k) ? cache.get(k) : await getDocRow(env, col, id);
    let neu = null, kind;
    if (op.op === 'delete') { kind = 'delete'; }
    else {
      if (op.op === 'update' && !old) return json({ error: `Document introuvable : ${col}/${id}` }, 404, cors);
      kind = old ? 'update' : 'create';
      neu = applyOp(old, op, op.data, !!op.merge, now);
    }
    if (!canWrite(ctx, kind, col, id, old, neu)) return json({ error: `Droits insuffisants (${col})`, denied: true }, 403, cors);
    cache.set(k, neu);
    ids.push(id);
    if (col === 'users') {
      if (op.op === 'delete') stmts.push(env.DB.prepare('DELETE FROM users WHERE uid = ?').bind(id));
      else stmts.push(env.DB.prepare(`INSERT INTO users (uid, data, discord_id, pseudo, pending) VALUES (?, ?, ?, ?, NULL)
        ON CONFLICT (uid) DO UPDATE SET data = excluded.data, discord_id = excluded.discord_id, pseudo = excluded.pseudo, pending = NULL`)
        .bind(id, JSON.stringify(neu), neu.discordId ?? null, neu.pseudo ?? null));
    }
    else if (op.op === 'delete') stmts.push(env.DB.prepare("UPDATE docs SET deleted = 1, updated_at = (SELECT v FROM meta WHERE k = 'rev') WHERE col = ? AND id = ?").bind(col, id));
    else stmts.push(env.DB.prepare(`INSERT INTO docs (col, id, data, updated_at, deleted, gen) VALUES (?, ?, ?, (SELECT v FROM meta WHERE k = 'rev'), 0, 0)
      ON CONFLICT (col, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = 0`).bind(col, id, JSON.stringify(neu)));
  }
  // une seule révision pour tout le lot : incrément d'abord, puis les écritures la lisent
  await env.DB.batch([env.DB.prepare("UPDATE meta SET v = v + 1 WHERE k = 'rev'"), ...stmts]);
  const rev = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'").first())?.v;
  return json({ ok: true, rev, ids }, 200, cors);
}

/* ── Évaluation d'une requête (where / orderBy / limit / startAfter) ── */
function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
const tsVal = v => (v && typeof v === 'object' && '__ts' in v ? v.__ts : v);
function matchWhere(doc, id, [field, op, val]) {
  const v = tsVal(field === '__name__' ? id : getPath(doc, field)); const x = tsVal(val);
  switch (op) {
    case '==': return JSON.stringify(v) === JSON.stringify(x);
    case '!=': return JSON.stringify(v) !== JSON.stringify(x);
    case '<': return v != null && v < x; case '<=': return v != null && v <= x;
    case '>': return v != null && v > x; case '>=': return v != null && v >= x;
    case 'in': return Array.isArray(x) && x.some(y => JSON.stringify(y) === JSON.stringify(v));
    case 'not-in': return Array.isArray(x) && !x.some(y => JSON.stringify(y) === JSON.stringify(v));
    case 'array-contains': return Array.isArray(v) && v.some(y => JSON.stringify(y) === JSON.stringify(x));
    case 'array-contains-any': return Array.isArray(v) && Array.isArray(x) && v.some(y => x.some(z => JSON.stringify(z) === JSON.stringify(y)));
    default: return false;
  }
}

/* ── POST /db/read ── */
export async function handleStoreRead(request, env, cors) {
  let body;
  try { body = await request.json(); } catch { return json({ error: 'Bad JSON' }, 400, cors); }
  const col = String(body.col || '');
  if (!VALID_COL.test(col)) return json({ error: 'col invalide' }, 400, cors);
  const ctx = await loadCtx(env, body.idToken);
  const rev = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'rev'").first())?.v;
  const epoch = (await env.DB.prepare("SELECT v FROM meta WHERE k = 'epoch'").first())?.v;

  if (body.id != null) { // lecture à l'unité
    const data = await getDocRow(env, col, String(body.id));
    if (data && !canRead(ctx, col, String(body.id), data, null)) return json({ error: 'Droits insuffisants', denied: true }, 403, cors);
    return json({ rev, doc: data ? { id: String(body.id), d: data } : null }, 200, cors);
  }

  // liste / requête : lecture de la collection puis filtre (les collections privées ne renvoient que les documents autorisés)
  const where = Array.isArray(body.where) ? body.where : [];
  const listing = { limit: body.limit ?? null };
  const since = parseInt(body.since) || 0;
  const rows = col === 'users'
    ? (await env.DB.prepare('SELECT uid AS id, data, 0 AS deleted FROM users').all()).results
    : (since > 0
      ? await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND updated_at > ?').bind(col, since).all()
      : await env.DB.prepare('SELECT id, data, deleted FROM docs WHERE col = ? AND deleted = 0').bind(col).all()).results;
  const deleted = rows.filter(r => r.deleted).map(r => r.id);
  let docs = rows.filter(r => !r.deleted).map(r => ({ id: r.id, d: jparse(r.data) || {} }));
  const top = col.split('/')[0];
  const coarse = (COL_DEFAULTS[top] && !['items_hidden', 'users', 'config', 'reports'].includes(top)) ? colRule(ctx, top) : null;
  if (coarse && !need(ctx, coarse.read)) return json({ error: 'Droits insuffisants', denied: true }, 403, cors);
  docs = docs.filter(x => canRead(ctx, col, x.id, x.d, listing));
  docs = docs.filter(x => where.every(w => matchWhere(x.d, x.id, w)));
  const order = Array.isArray(body.orderBy) ? body.orderBy : [];
  if (order.length) docs.sort((a, b) => { for (const [f, dir] of order) { const c = cmp(tsVal(f === '__name__' ? a.id : getPath(a.d, f)) ?? null, tsVal(f === '__name__' ? b.id : getPath(b.d, f)) ?? null); if (c) return dir === 'desc' ? -c : c; } return cmp(a.id, b.id); });
  else docs.sort((a, b) => cmp(a.id, b.id));
  if (Array.isArray(body.startAfter) && body.startAfter.length) {
    const [sv, sid] = body.startAfter; const [f, dir] = order[0] || ['__name__', 'asc'];
    docs = docs.filter(x => { const v = tsVal(f === '__name__' ? x.id : getPath(x.d, f)); const c = cmp(v ?? null, tsVal(sv) ?? null) || cmp(x.id, sid); return dir === 'desc' ? c < 0 : c > 0; });
  }
  if (body.limit > 0) docs = docs.slice(0, body.limit);
  return json({ rev, epoch, docs, deleted }, 200, cors);
}
