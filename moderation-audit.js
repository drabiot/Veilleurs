// ══════════════════════════════════════════════════════
// JOURNAL D'AUDIT
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export const AUDIT_ACTION_LABELS = {
  approve:           '✅ Approbation',
  rename_id:         '🔁 ID renommé',
  reject:            '✕ Rejet',
  changes_requested: '💬 Modifs demandées',
  delete:            '🗑️ Suppression',
  bulk_delete:       '🗑️ Suppression groupée',
  role_change:       '🔑 Changement de rôle',
  suspend:           '🚫 Suspension',
  unsuspend:         '✓ Levée de suspension',
  login:             '🔐 Connexion',
};

export function init(ctx) {
const { escHtml, setHash: _setHash, db, collection, getDocs, orderBy, query, limit, toast } = ctx;
let _auditAll   = [];
let _auditLimit = 50;


window.showAuditLog = async () => {
  if (ctx.role !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _setHash('audit-log');
  document.getElementById('audit-log-panel').style.display = '';
  document.getElementById('btn-audit-log').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadAuditLog();
};

window.loadAuditLog = async function loadAuditLog() {
  const listEl = document.getElementById('audit-log-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const q = query(collection(db, 'audit_log'), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    _auditAll = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    _auditLimit = 50;
    renderAuditLog();
  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.renderAuditLog = function() {
  const listEl    = document.getElementById('audit-log-list');
  const moreEl    = document.getElementById('audit-log-more');
  const actionF   = document.getElementById('audit-filter-action')?.value || '';
  const actorF    = (document.getElementById('audit-filter-actor')?.value || '').trim().toLowerCase();

  let rows = _auditAll;
  if (actionF) rows = rows.filter(r => r.action === actionF);
  if (actorF)  rows = rows.filter(r => (r.actorPseudo || '').toLowerCase().includes(actorF));

  if (!rows.length) { listEl.innerHTML = '<div class="empty">Aucune entrée.</div>'; if (moreEl) moreEl.style.display = 'none'; return; }

  const shown = rows.slice(0, _auditLimit);
  if (moreEl) moreEl.style.display = rows.length > _auditLimit ? '' : 'none';

  listEl.innerHTML = '';
  for (const entry of shown) {
    const ts = entry.createdAt?.toDate?.()?.toLocaleString('fr-FR') || '—';
    const actionLabel = AUDIT_ACTION_LABELS[entry.action] || entry.action;
    const metaStr = entry.action === 'role_change'
      ? `${entry.metadata?.prevRole || '?'} → <b>${escHtml(entry.metadata?.newRole || '?')}</b>`
      : entry.metadata?.comment
        ? `<span style="color:var(--muted);font-style:italic;">"${escHtml(entry.metadata.comment)}"</span>`
        : entry.metadata?.type ? escHtml(entry.metadata.type) : '';

    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:10px;padding:8px 12px;border-bottom:1px solid var(--border);font-size:12px;flex-wrap:wrap;';
    row.innerHTML = `
      <span style="color:var(--muted);white-space:nowrap;flex-shrink:0;min-width:130px;">${escHtml(ts)}</span>
      <span style="font-weight:700;flex-shrink:0;min-width:150px;">${actionLabel}</span>
      <span style="flex:1;min-width:120px;">${escHtml(entry.targetName || entry.targetId || '—')}</span>
      <span style="color:var(--accent);flex-shrink:0;">${escHtml(entry.actorPseudo || '—')}</span>
      ${metaStr ? `<span style="width:100%;padding-left:142px;">${metaStr}</span>` : ''}
    `;
    listEl.appendChild(row);
  }
};

window.loadAuditLogMore = function() {
  _auditLimit += 50;
  renderAuditLog();
};

}
