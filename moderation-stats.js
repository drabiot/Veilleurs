// ══════════════════════════════════════════════════════
// STATISTIQUES + migration clés sensibles (worker D1 POST /stats)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { getWorkerSecret: _getWorkerSecret, WORKER_URL, cachedDocs, invalidateModCache, escHtml, setHash: _setHash, db, COL, collection, getDocs, doc, writeBatch, orderBy, where, query, limit, hashName, anonName, toast, modal } = ctx;
// ══════════════════════════════════════════════════════
// STATISTIQUES — données de tracking dans Cloudflare D1 (worker POST /stats, même secret que le proxy Discord)
async function _fetchStats(action = 'summary', extra = {}) {
  const r = await fetch(WORKER_URL + '/stats', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: await _getWorkerSecret(), action, ...extra }),
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || ('Stats HTTP ' + r.status));
  return d;
}
window.resetStatistiques = async function() {
  if (ctx.role !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  const ok = await modal.confirm('Supprimer toutes les données de statistiques (visites, profils, items consultés, recherches) ? Cette action est irréversible.', { confirmLabel: 'Supprimer', danger: true });
  if (!ok) return;
  try {
    const total = (await _fetchStats('reset')).deleted || 0;
    toast(`✓ ${total} document${total !== 1 ? 's' : ''} supprimé${total !== 1 ? 's' : ''}`, 'success');
    loadStatistiques();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

// ══════════════════════════════════════════════════════
window.showStatistiques = function() {
  if (ctx.role !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _setHash('statistiques');
  document.getElementById('panel-statistiques').style.display = '';
  document.getElementById('btn-statistiques').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  loadStatistiques();
};

window.loadStatistiques = async function loadStatistiques() {
  const container = document.getElementById('stats-content');
  container.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const { renderStats, statsDay } = await import('./stats-page.js?v=1c7d5448');
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const [summary, items] = await Promise.all([
      _fetchStats('summary', {
        date7: statsDay(-6), date30: statsDay(-29), date35: statsDay(-34),
        dayStart: midnight.getTime(), weekStart: midnight.getTime() - 6 * 86400000,
      }),
      cachedDocs(COL.items).catch(() => []),
    ]);
    renderStats(container, summary, { items, anonName }, {
      escHtml,
      loadUser: id => _fetchStats('user', { id }).then(r => r.user),
      loadCloudflare: () => _fetchStats('cloudflare'),
      loadAudit: async uid => {
        const { AUDIT_ACTION_LABELS } = await import('./moderation-audit.js?v=24907cd5');
        const snap = await getDocs(query(collection(db, 'audit_log'),
          where('actorUid', '==', uid), orderBy('createdAt', 'desc'), limit(50)));
        return snap.docs.map(d => {
          const a = d.data();
          return { label: AUDIT_ACTION_LABELS[a.action] || a.action, target: a.targetName || a.targetId || '', ts: a.createdAt?.toMillis?.() ?? 0 };
        });
      },
    });
  } catch (e) {
    container.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};
}
