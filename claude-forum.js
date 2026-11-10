// ══════════════════════════════════════════════════════════════
//  Forum « demandes » ↔ Claude (côté worker)
//  /claude dans un fil du forum → le worker répond tout de suite « réfléchit… » (réponse différée de Discord,
//  visible dans le fil), puis lance l'Action GitHub forum-claude.yml qui fait tourner Claude (lecture seule du dépôt)
//  et remplace ce message par sa réponse (bot/forum-claude-run.js).
//
//  Réglages (variables du worker, tous facultatifs) :
//    FORUM_CLAUDE_FORUM   id du forum            (défaut 1569760135994150993)
//    FORUM_CLAUDE_USERS   ids Discord autorisés, séparés par des virgules (défaut drabiot + radvak)
//  Secrets déjà présents : GITHUB_DISPATCH_TOKEN (Actions : lecture/écriture), ADMIN_SECRET. KV : WIKI_CACHE.
//  Le jeton de l'interaction (valable 15 min) n'est jamais mis dans l'URL ni dans les entrées du workflow (publiques) :
//  il est gardé en KV et l'Action le récupère avec ADMIN_SECRET (POST /claude/job).
// ══════════════════════════════════════════════════════════════

const GH_REPO = 'drabiot/Veilleurs';
const DEFAULT_FORUM = '1569760135994150993';
const DEFAULT_USERS = '420919709421010945,460847188327661568';
const THREAD_TYPES = new Set([10, 11, 12]);

const reply = (content, flags = 64) => new Response(JSON.stringify({ type: 4, data: { content, flags, allowed_mentions: { parse: [] } } }), { headers: { 'Content-Type': 'application/json' } });

/** Interaction `/claude` (type 2). Renvoie la Response pour Discord (dans les 3 s). */
export async function handleClaudeInteraction(interaction, env, ctx) {
  const userId = interaction.member?.user?.id || interaction.user?.id;
  const users = new Set((env.FORUM_CLAUDE_USERS || DEFAULT_USERS).split(',').map(s => s.trim()).filter(Boolean));
  if (!users.has(userId)) return reply('⛔ Tu n\'es pas autorisé à utiliser cette commande.');
  const ch = interaction.channel || {};
  const forum = env.FORUM_CLAUDE_FORUM || DEFAULT_FORUM;
  if (!THREAD_TYPES.has(ch.type) || ch.parent_id !== forum) return reply('Utilise `/claude` dans un fil du forum des demandes.');
  if (!env.GITHUB_DISPATCH_TOKEN || !env.WIKI_CACHE) return reply('⚠️ Configuration incomplète côté worker (GITHUB_DISPATCH_TOKEN / KV).');

  const busyKey = `claude_busy:${ch.id}`;
  if (await env.WIKI_CACHE.get(busyKey)) return reply('⏳ Claude est déjà en train de travailler sur ce fil.');
  await env.WIKI_CACHE.put(busyKey, '1', { expirationTtl: 60 });

  const note = String((interaction.data?.options || []).find(o => o.name === 'message')?.value || '').slice(0, 1500);
  const job = crypto.randomUUID();
  await env.WIKI_CACHE.put(`claude_job:${job}`, JSON.stringify({
    token: interaction.token, appId: interaction.application_id, threadId: ch.id, threadName: ch.name || '', userId, note, forum,
  }), { expirationTtl: 900 });

  const r = await fetch(`https://api.github.com/repos/${GH_REPO}/actions/workflows/forum-claude.yml/dispatches`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.GITHUB_DISPATCH_TOKEN}`, Accept: 'application/vnd.github+json', 'User-Agent': 'veilleurs-worker', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main', inputs: { job } }),
  }).catch(() => null);
  if (!r || r.status !== 204) {
    await env.WIKI_CACHE.delete(busyKey); await env.WIKI_CACHE.delete(`claude_job:${job}`);
    return reply(`⚠️ Impossible de lancer Claude (GitHub ${r ? r.status : 'injoignable'}).`);
  }
  // Réponse différée : Discord affiche « <bot> réfléchit… » dans le fil jusqu'à ce que l'Action édite le message
  return new Response(JSON.stringify({ type: 5, data: { allowed_mentions: { parse: [] } } }), { headers: { 'Content-Type': 'application/json' } });
}

/** POST /claude/job { secret, id } → les infos du travail (une seule lecture). Réservé à l'Action (ADMIN_SECRET). */
export async function handleClaudeJob(request, env, { json }) {
  const body = await request.json().catch(() => ({}));
  if (!env.ADMIN_SECRET || body.secret !== env.ADMIN_SECRET) return json({ error: 'Unauthorized' }, 401);
  if (!env.WIKI_CACHE || !/^[0-9a-f-]{36}$/.test(String(body.id || ''))) return json({ error: 'bad request' }, 400);
  const raw = await env.WIKI_CACHE.get(`claude_job:${body.id}`);
  if (!raw) return json({ error: 'expired' }, 404);
  const job = JSON.parse(raw);
  if (body.done) { await env.WIKI_CACHE.delete(`claude_busy:${job.threadId}`); await env.WIKI_CACHE.delete(`claude_job:${body.id}`); return json({ ok: true }); }
  return json(job);
}
