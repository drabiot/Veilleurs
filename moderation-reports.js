// ══════════════════════════════════════════════════════
// RETOURS — signalements des joueurs (bug / suggestion / erreur sur une fiche)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// Chaque signalement arrive aussi dans le salon Discord des retours (worker-store.js). Une réponse écrite ici est stockée sur le document
// (reply, replyBy, replyAt) : au prochain passage du joueur sur le site, auth-widget.js l'affiche dans un popup puis pose replySeen.
// Seuls les signalements envoyés par un joueur connecté (submittedBy) peuvent recevoir une réponse.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { db, collection, getDocs, doc, updateDoc, deleteDoc, deleteField, serverTimestamp, query, orderBy, limit, toast, modal, setHash, showPanel, escHtml, writeAudit } = ctx;
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
const when = t => { const ms = t?.toMillis?.() ?? t?.__ts; return ms ? new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''; };
const FILTERS = { todo: 'À traiter', done: 'Répondus', all: 'Tous' };
const inFilter = r => S.filter === 'all' || (S.filter === 'done' ? !!r.reply : !r.reply);

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
  const todo = S.all.filter(r => !r.reply).length;
  const badge = document.getElementById('count-reports-panel');
  if (badge) { badge.textContent = todo; badge.style.display = todo ? '' : 'none'; }
  const bar = document.getElementById('reports-filters');
  if (bar) bar.innerHTML = Object.entries(FILTERS).map(([k, label]) =>
    `<button class="btn ${S.filter === k ? 'btn-primary' : 'btn-ghost'}" style="font-size:12px;" onclick="repFilter('${k}')">${label}</button>`).join('');
  const rows = S.all.filter(inFilter);
  if (!rows.length) { box.innerHTML = '<div class="empty">Aucun signalement.</div>'; return; }
  box.innerHTML = rows.map(r => {
    const url = r.ficheId ? ficheUrl(r.ficheType, r.ficheId) : null;
    const label = r.ficheId ? `${FICHE_LABELS[r.ficheType] || r.ficheType || 'Fiche'} · ${r.ficheName || r.ficheId}` : '';
    const fiche = label ? `<div style="font-size:11px;margin:3px 0;">${url ? `<a href="${escHtml(url)}" target="_blank" rel="noopener" style="color:var(--gold,#e8b84b);">🔗 ${escHtml(label)}</a>` : escHtml(label)}</div>` : '';
    const id = escHtml(r.id);
    let reply;
    if (!r.submittedBy) reply = '<div style="font-size:11px;color:var(--muted);">Envoyé sans compte : pas de réponse possible.</div>';
    else reply = (r.reply
        ? `<div style="font-size:12px;border-left:3px solid var(--accent);padding:4px 10px;margin-bottom:8px;white-space:pre-wrap;word-break:break-word;"><div style="font-size:10px;color:var(--muted);margin-bottom:2px;">Réponse de ${escHtml(r.replyBy || 'admin')} · ${when(r.replyAt)} · ${r.replySeen ? '✅ lue par le joueur' : '⏳ pas encore lue'}</div>${escHtml(r.reply)}</div>`
        : '')
      + `<textarea id="rep-text-${id}" rows="2" placeholder="${r.reply ? 'Modifier la réponse…' : 'Répondre au joueur (popup à sa prochaine visite)…'}" style="width:100%;box-sizing:border-box;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 9px;font-size:12px;outline:none;resize:vertical;font-family:inherit;"></textarea>`
      + `<button class="btn" style="margin-top:6px;background:var(--accent);color:var(--on-accent);font-size:12px;" onclick="repReply('${id}')">${r.reply ? 'Remplacer la réponse' : 'Répondre'}</button>`;
    return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;font-size:12px;">
        <div><b>${escHtml(r.pseudo || 'Anonyme')}</b> <span style="color:var(--muted);">· ${escHtml(r.page || '')} · ${when(r.createdAt)}</span></div>
        <button class="btn btn-ghost" style="font-size:11px;padding:3px 8px;color:var(--danger);" onclick="repDelete('${id}')" title="Supprimer">🗑️</button>
      </div>
      ${fiche}
      <div style="font-size:13px;margin:6px 0 10px;white-space:pre-wrap;word-break:break-word;">${escHtml(r.text || '')}</div>
      ${reply}
    </div>`;
  }).join('');
}

window.repFilter = k => { S.filter = k; render(); };

window.repReply = async function repReply(id) {
  const r = S.all.find(x => x.id === id);
  const text = document.getElementById('rep-text-' + id)?.value.trim();
  if (!r || !text) { toast('Écris une réponse', 'warning'); return; }
  try {
    await updateDoc(doc(db, 'reports', id), { reply: text.slice(0, 2000), replyBy: 'Les admins', replyAt: serverTimestamp(), replySeen: deleteField() });
    await writeAudit('update', 'report', id, r.pseudo || 'Anonyme', { reply: true });
    toast('Réponse enregistrée : le joueur la verra à sa prochaine visite', 'success');
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
