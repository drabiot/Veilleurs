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
    const { renderStats, statsDay } = await import('./stats-page.js?v=1f2ad0eb');
    const midnight = new Date(); midnight.setHours(0, 0, 0, 0);
    const [summary, repSnap, items] = await Promise.all([
      _fetchStats('summary', {
        date7: statsDay(-6), date30: statsDay(-29), date35: statsDay(-34),
        dayStart: midnight.getTime(), weekStart: midnight.getTime() - 6 * 86400000,
      }),
      getDocs(query(collection(db, 'reports'), orderBy('createdAt', 'desc'), limit(10))).catch(() => ({ docs: [] })),
      cachedDocs(COL.items).catch(() => []),
    ]);
    const reports = repSnap.docs.map(d => { const r = d.data(); return { pseudo: r.pseudo, page: r.page, text: r.text, ficheType: r.ficheType, ficheId: r.ficheId, ficheName: r.ficheName, ts: r.createdAt?.toMillis?.() ?? 0 }; });
    renderStats(container, summary, { items, reports, anonName }, {
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

window.showMigration = async () => {
  if (ctx.role !== 'admin') return;
  _setHash('migration');
  document.getElementById('migration-panel').style.display = '';
  document.getElementById('btn-migration').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await sensReload();
};

// Migration one-shot : re-keyer items_hidden de item.id → nameHash + supprimer doublons
window.sensRunKeyMigration = async () => {
  if (ctx.role !== 'admin') return;
  const log = document.getElementById('sens-migration-log');
  if (log) log.textContent = '';
  const print = (msg) => { if (log) log.textContent += msg + '\n'; console.log('[sensMigration]', msg); };

  print('Chargement items_hidden…');
  let docs;
  try {
    const snap = await getDocs(collection(db, COL.itemsHidden));
    docs = snap.docs;
  } catch (e) {
    print('Erreur : ' + e.message); return;
  }

  print(`${docs.length} doc(s) trouvé(s).`);

  // Grouper par champ 'id' (item ID original) pour détecter les doublons
  const byItemId = new Map(); // itemId → [{docKey, data}]
  for (const d of docs) {
    const data = d.data();
    const itemId = String(data.id || '');
    if (!itemId) { print(`  SKIP ${d.id} — pas de champ id`); continue; }
    if (!byItemId.has(itemId)) byItemId.set(itemId, []);
    byItemId.get(itemId).push({ docKey: d.id, data });
  }

  let migrated = 0, cleaned = 0, skipped = 0, errors = 0;

  for (const [itemId, entries] of byItemId) {
    const name = entries[0].data.name || '';
    const expectedHash = name ? await hashName(name).catch(() => '') : '';
    if (!expectedHash) { print(`  SKIP ${itemId} — hash vide (name="${name}")`); skipped++; continue; }

    // Identifier les docs correctement keyés et les orphelins
    const correct = entries.filter(e => e.docKey === expectedHash);
    const orphans = entries.filter(e => e.docKey !== expectedHash);

    if (correct.length === 0) {
      // Aucun doc avec la bonne clé → migrer le premier, supprimer les autres
      const [toKeep, ...toDelete] = orphans;
      print(`  Migre ${toKeep.docKey} → ${expectedHash} (${name})`);
      try {
        const batch = writeBatch(db);
        batch.set(doc(db, COL.itemsHidden, expectedHash), { ...toKeep.data, nameHash: expectedHash });
        batch.delete(doc(db, COL.itemsHidden, toKeep.docKey));
        for (const o of toDelete) batch.delete(doc(db, COL.itemsHidden, o.docKey));
        await batch.commit();
        migrated++;
        cleaned += toDelete.length;
      } catch (e) { print(`  ERREUR : ${e.message}`); errors++; }
    } else if (orphans.length > 0) {
      // Doc correct existe + orphelins → supprimer les orphelins
      print(`  Nettoie ${orphans.length} orphelin(s) pour "${name}"`);
      try {
        const batch = writeBatch(db);
        for (const o of orphans) {
          print(`    Supprime orphelin ${o.docKey}`);
          batch.delete(doc(db, COL.itemsHidden, o.docKey));
        }
        await batch.commit();
        cleaned += orphans.length;
      } catch (e) { print(`  ERREUR nettoyage : ${e.message}`); errors++; }
    } else {
      skipped++; // déjà correct, un seul doc
    }
  }

  print(`\nTerminé : ${migrated} migré(s), ${cleaned} orphelin(s) supprimé(s), ${skipped} déjà correct(s), ${errors} erreur(s).`);

  invalidateModCache(COL.itemsHidden);
  await sensReload();
};
}
