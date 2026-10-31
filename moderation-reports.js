// ══════════════════════════════════════════════════════
// RETOURS — signalements des joueurs (bug / suggestion / erreur sur une fiche), sous forme de conversations
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// Chaque signalement arrive aussi dans le salon Discord des retours (worker-store.js). Un signalement = le texte d'origine puis `messages`
// [{ from: 'user'|'admin', text, at }] ; écrire ici ajoute un message des admins et pose unreadUser : une bulle « Nouveau message » apparaît
// chez le joueur (report-chat.js), qui peut répondre (le worker prévient alors le salon Discord). `closedAt` : conversation close tant que le
// joueur n'écrit pas de nouveau. Seuls les signalements envoyés par un joueur connecté (submittedBy) peuvent recevoir une réponse.
// ══════════════════════════════════════════════════════

import { arrayUnion } from './d1db.js';

export function init(ctx) {
const { db, collection, getDocs, doc, updateDoc, deleteDoc, deleteField, query, orderBy, limit, toast, modal, setHash, showPanel, escHtml, writeAudit } = ctx;
const S = { all: [], filter: 'todo' };

const FICHE_LABELS = { item: 'Item', mob: 'Monstre', pnj: 'PNJ', quete: 'Quête', build: 'Build' };
function ficheUrl(type, id) {
  const e = encodeURIComponent(id);
  switch (type) {
    case 'item':  return `Compendium/compendium.html#${e}`;
    case 'mob':   return `Bestiaire/bestiaire.html#monstres/${e}`;
    case 'pnj':   return `Bestiaire/bestiaire.html#personnages/${e}`;
    case 'quete': return `Quetes/quetes.html#${e}`;
    case 'build': return `Builds/builds.html?id=${e}`;
    default:      return null;
  }
}
const ms = t => t?.toMillis?.() ?? t?.__ts ?? (typeof t === 'number' ? t : 0);
const fmt = t => t ? new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '';
function thread(r) {
  const out = [{ from: 'user', text: r.text || '', at: ms(r.createdAt) }];
  if (r.reply) out.push({ from: 'admin', text: r.reply, at: ms(r.replyAt) });   // ancien format : une seule réponse
  return out.concat(r.messages || []);
}
// todo = le dernier mot est au joueur ; wait = les admins ont répondu ; closed = close depuis le dernier message
function state(r) {
  const t = thread(r), last = t[t.length - 1];
  if (r.closedAt && (last.at || 0) <= r.closedAt) return 'closed';
  return last.from === 'admin' ? 'wait' : 'todo';
}
const FILTERS = { todo: 'À traiter', wait: 'Attente du joueur', closed: 'Clos', all: 'Tous' };
const inFilter = r => S.filter === 'all' || state(r) === S.filter;

window.showReports = async function showReports() {
  setHash('reports');
  showPanel('reports-panel', 'btn-reports');
  await window._loadReports();
};

window._loadReports = async function _loadReports() {
  const box = document.getElementById('reports-list');
  if (!box) return;
  box.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const snap = await getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(300)));
    S.all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch (e) {
    box.innerHTML = '<div class="empty">Erreur de chargement.</div>';
    console.error('[reports]', e);
  }
};

function render() {
  const box = document.getElementById('reports-list'); if (!box) return;
  const count = st => S.all.filter(r => state(r) === st).length;
  const todo = count('todo');
  const badge = document.getElementById('count-reports-panel');
  if (badge) { badge.textContent = todo; badge.style.display = todo ? '' : 'none'; }
  const bar = document.getElementById('reports-filters');
  if (bar) bar.innerHTML = Object.entries(FILTERS).map(([k, label]) =>
    `<button class="btn ${S.filter === k ? 'btn-primary' : 'btn-ghost'}" style="font-size:12px;" onclick="repFilter('${k}')">${label}${k === 'todo' ? ` (${todo})` : ''}</button>`).join('');
  const rows = S.all.filter(inFilter);
  if (!rows.length) { box.innerHTML = '<div class="empty">Aucun signalement.</div>'; return; }
  box.innerHTML = rows.map(r => {
    const url = r.ficheId ? ficheUrl(r.ficheType, r.ficheId) : null;
    const label = r.ficheId ? `${FICHE_LABELS[r.ficheType] || r.ficheType || 'Fiche'} · ${r.ficheName || r.ficheId}` : '';
    const fiche = label ? `<div style="font-size:11px;margin:3px 0;">${url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--gold,#e8b84b);">🔗 ${escHtml(label)}</a>` : escHtml(label)}</div>` : '';
    const id = escHtml(r.id), st = state(r);
    const msgs = thread(r).map(m => {
      const admin = m.from === 'admin';
      return `<div style="max-width:88%;align-self:${admin ? 'flex-end' : 'flex-start'};background:${admin ? 'rgba(232,184,75,.12)' : 'var(--surface)'};border:1px solid ${admin ? 'rgba(232,184,75,.4)' : 'var(--border)'};border-radius:8px;padding:6px 10px;">
        <div style="font-size:10px;color:var(--muted);margin-bottom:2px;">${admin ? 'Admins' : escHtml(r.pseudo || 'Anonyme')} · ${fmt(m.at)}</div>
        <div style="font-size:13px;white-space:pre-wrap;word-break:break-word;">${escHtml(m.text)}</div></div>`;
    }).join('');
    const unread = r.unreadUser === true || (!!r.reply && !r.replySeen && r.unreadUser !== false);
    const lastAdmin = thread(r).at(-1).from === 'admin';
    const seen = lastAdmin && r.submittedBy ? `<div style="font-size:10px;color:var(--muted);align-self:flex-end;">${unread ? '⏳ pas encore lu par le joueur' : '✅ lu par le joueur'}</div>` : '';
    const stLabel = { todo: '🔴 À traiter', wait: '🟡 Attente du joueur', closed: '⚪ Clos' }[st];
    let reply;
    if (!r.submittedBy) reply = '<div style="font-size:11px;color:var(--muted);">Envoyé sans compte : pas de réponse possible.</div>';
    else reply = `<textarea id="rep-text-${id}" rows="2" maxlength="2000" placeholder="Répondre au joueur (bulle « Nouveau message » à sa prochaine visite)…" style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:12px;outline:none;resize:vertical;font-family:inherit;"></textarea>
      <button class="btn" style="margin-top:6px;background:var(--accent);color:var(--on-accent);font-size:12px;" onclick="repReply('${id}')">Envoyer</button>`;
    const closeBtn = `<button class="btn btn-ghost" style="margin-top:6px;font-size:12px;" onclick="repClose('${id}', ${st === 'closed' ? 'false' : 'true'})">${st === 'closed' ? '↩ Rouvrir' : '✔ Clore'}</button>`;
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;font-size:12px;">
        <div><b>${escHtml(r.pseudo || 'Anonyme')}</b> <span style="color:var(--muted);">· ${escHtml(r.page || '')} · ${stLabel}</span></div>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--danger);" onclick="repDelete('${id}')" title="Supprimer">🗑️</button>
      </div>
      ${fiche}
      <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0 10px;">${msgs}${seen}</div>
      ${reply} ${closeBtn}
    </div>`;
  }).join('');
}

window.repFilter = k => { S.filter = k; render(); };

window.repReply = async function repReply(id) {
  const r = S.all.find(x => x.id === id);
  const text = document.getElementById('rep-text-' + id)?.value.trim();
  if (!r || !text) { toast('Écris une réponse', 'warning'); return; }
  try {
    await updateDoc(doc(db, 'reports', id), { messages: arrayUnion({ from: 'admin', text: text.slice(0, 2000), at: Date.now() }), unreadUser: true });
    await writeAudit('update', 'report', id, r.pseudo || 'Anonyme', { reply: true });
    toast('Message envoyé : le joueur le verra à sa prochaine visite', 'success');
    await window._loadReports();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.repClose = async function repClose(id, close) {
  try {
    await updateDoc(doc(db, 'reports', id), { closedAt: close ? Date.now() : deleteField() });
    await window._loadReports();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.repDelete = async function repDelete(id) {
  const ok = await modal.confirm('Supprimer ce signalement ?', 'Cette action est irréversible.');
  if (!ok) return;
  try {
    await deleteDoc(doc(db, 'reports', id));
    toast('Signalement supprimé', 'success');
    await window._loadReports();
  } catch (e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

}
