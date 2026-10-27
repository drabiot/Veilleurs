// ══════════════════════════════════════════════════════
// INTÉGRITÉ DES DONNÉES — IDs fantômes, crafts circulaires, liens morts, IDs/régions/mobs orphelins
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, writeAudit: _writeAudit, renderSubs, escHtml, setHash: _setHash, db, collection, getDocs, getDoc, doc, updateDoc, writeBatch, where, query, sanitizeForFirestore, toast, modal, showPanel: _showPanel } = ctx;
const { normalize } = window.VCL;
// ── Ghost ID tracker ─────────────────────────────────
window.showGhostIds = async () => {
  _setHash('ghost-ids');
  document.getElementById('ghost-id-panel').style.display = '';
  document.getElementById('btn-ghost-ids').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadGhostIds();
};

// ══════════════════════════════════════════════════════
// LIENS MORTS (données publiées → IDs inexistants)
// ══════════════════════════════════════════════════════
// CRAFTS CIRCULAIRES (item se contient dans son propre craft)
// ══════════════════════════════════════════════════════
window.showSelfCraft = async () => {
  _setHash('self-craft');
  document.getElementById('self-craft-panel').style.display = '';
  document.getElementById('btn-self-craft').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadSelfCraft();
};

async function loadSelfCraft() {
  const listEl = document.getElementById('self-craft-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const items = await cachedDocs('items');
    const bugs = [];

    for (const item of items) {
      if (!item.craft || !Array.isArray(item.craft) || !item.id) continue;
      let selfRef = false;
      outer: for (const c of item.craft) {
        if (c.id === item.id) { selfRef = true; break; }
        if (Array.isArray(c.items)) {
          for (const ing of c.items) {
            if (ing.id === item.id) { selfRef = true; break outer; }
          }
        }
      }
      if (selfRef) bugs.push(item);
    }

    listEl.innerHTML = '';
    if (!bugs.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun craft circulaire trouvé.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${bugs.length} item${bugs.length > 1 ? 's' : ''} avec craft circulaire`;
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Item</th><th>ID</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const item of bugs) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight:500;">${escHtml(item.name || item.id)}</td>
        <td><span class="ghost-id">${escHtml(item.id)}</span></td>
        <td style="white-space:nowrap;"></td>`;

      const actTd = tr.querySelector('td:last-child');

      // Bouton ouvrir dans le Creator
      const histBtn = document.createElement('button');
      histBtn.className = 'btn btn-ghost';
      histBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-right:4px;';
      histBtn.textContent = '⚙️ Creator';
      histBtn.onclick = () => {
        sessionStorage.setItem('editSub', JSON.stringify({ type: 'item', data: item }));
        window.open('creator.html', '_blank');
      };

      // Bouton retirer l'ingrédient fautif
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-ghost';
      fixBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
      fixBtn.textContent = '🗑️ Retirer';

      fixBtn.onclick = async () => {
        fixBtn.disabled = true;
        fixBtn.textContent = '…';
        try {
          const newCraft = item.craft
            .map(c => {
              if (c.id === item.id) return null;
              if (Array.isArray(c.items)) return { ...c, items: c.items.filter(ing => ing.id !== item.id) };
              return c;
            })
            .filter(Boolean);

          await updateDoc(doc(db, 'items', item.id), { craft: sanitizeForFirestore(newCraft) });
          invalidateModCache('items');
          await _writeAudit('fix_self_craft', 'item', item.id, item.name || item.id, {});
          tr.style.opacity = '0.4';
          fixBtn.textContent = '✓ Retiré';
        } catch (e) {
          fixBtn.disabled = false;
          fixBtn.textContent = '🗑️ Retirer';
          alert('Erreur : ' + e.message);
        }
      };

      actTd.appendChild(histBtn);
      actTd.appendChild(fixBtn);
      tbody.appendChild(tr);
    }

    table.appendChild(tbody);
    listEl.appendChild(table);
  } catch (e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

// ══════════════════════════════════════════════════════
let _deadLinksSnapshot = null; // { deduped, ENTITY_POOL }
window.showDeadLinks = async () => {
  _setHash('dead-links');
  document.getElementById('dead-links-panel').style.display = '';
  document.getElementById('btn-dead-links').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadDeadLinks();
};

async function loadDeadLinks() {
  const listEl = document.getElementById('dead-links-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [items, hiddenItems, mobs, pnjs, quetes, panoplies] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
      cachedDocs('mobs'),
      cachedDocs('personnages'),
      cachedDocs('quetes'),
      cachedDocs('panoplies'),
    ]);

    const itemIds     = new Set([...items.map(i => i.id), ...hiddenItems.map(h => h.id).filter(Boolean)]);
    const mobIds      = new Set(mobs.map(m => m.id));
    const pnjIds      = new Set(pnjs.map(p => p.id));
    const questIds    = new Set(quetes.map(q => q.id));
    const panoplieIds = new Set(panoplies.map(p => p.id));

    const EXCLUDED_IDS = new Set(['cols']);

    const itemNameMap = new Map();
    for (const i of [...items, ...hiddenItems]) {
      if (i.id && i.name) itemNameMap.set(i.id, i.name);
    }

    // Pool d'entités par type cible pour la recherche de correction
    const ENTITY_POOL = {
      item:      [...items, ...hiddenItems].filter(i => i.id).map(i => ({ id: i.id, name: i.name || i.id })),
      mob:       mobs.map(m => ({ id: m.id, name: m.name || m.id })),
      pnj:       pnjs.map(p => {
        const name = p.nom || p.name || p.id;
        const allIds = [];
        // craft[] (format Firestore) : c.id = résultat
        const craftArr = Array.isArray(p.craft) ? p.craft
          : p.craft && typeof p.craft === 'object' ? Object.values(p.craft) : [];
        for (const c of craftArr) { if (c.id) allIds.push(c.id); }
        // crafts[] (format submission) : c.resultId = résultat
        for (const c of (p.crafts || [])) {
          if (c.resultId) allIds.push(c.resultId);
          else if (c.id)  allIds.push(c.id);
        }
        // sells[] : items vendus par le marchand
        for (const s of (p.sells || [])) { if (s.id) allIds.push(s.id); }
        const itemNames = [...new Set(allIds)]
          .map(id => itemNameMap.get(id) || id.replace(/_/g, ' ')).filter(Boolean).join(' ');
        const extra = p.instructions || '';
        return { id: p.id, name, search: normalize(name + ' ' + itemNames + ' ' + extra) };
      }),
      'quête':   quetes.map(q => ({ id: q.id, name: q.titre || q.name || q.id })),
      panoplie:  panoplies.map(p => ({ id: p.id, name: p.label || p.id })),
    };

    // { srcType, srcId, srcName, field, refId, targetType }
    const broken = [];

    function addBroken(srcType, srcId, srcName, field, refId, targetType) {
      broken.push({ srcType, srcId, srcName, field, refId, targetType });
    }

    // ── Items ──────────────────────────────────────────
    for (const item of items) {
      const name = item.name || item.id;

      // craft (flat: [{id,qty}], new format: [{name, npcId, items:[{id,qty}]}])
      for (const c of (item.craft || [])) {
        if (c.id && !itemIds.has(c.id) && !EXCLUDED_IDS.has(c.id))
          addBroken('item', item.id, name, 'craft', c.id, 'item');
        for (const ing of (c.items || [])) {
          if (ing.id && !itemIds.has(ing.id) && !EXCLUDED_IDS.has(ing.id))
            addBroken('item', item.id, name, 'craft', ing.id, 'item');
        }
      }

      // obtain — format [ref|label] où ref = "type:id" ou juste "id"
      if (item.obtain) {
        const reObtain = /\[([^\]|]+)\|[^\]]+\]/g;
        let mo;
        while ((mo = reObtain.exec(item.obtain)) !== null) {
          const ref = mo[1];
          const colonIdx = ref.indexOf(':');
          let type, id;
          if (colonIdx !== -1) { type = ref.slice(0, colonIdx); id = ref.slice(colonIdx + 1); }
          else { type = null; id = ref; }
          if (!id) continue;
          if (type === 'donjon') continue;
          if (type === 'npc') {
            if (!pnjIds.has(id)) addBroken('item', item.id, name, 'obtain (npc)', id, 'pnj');
          } else if (type === 'quest') {
            if (!questIds.has(id)) addBroken('item', item.id, name, 'obtain (quête)', id, 'quête');
          } else if (type === 'item') {
            if (!itemIds.has(id) && !EXCLUDED_IDS.has(id)) addBroken('item', item.id, name, 'obtain (item)', id, 'item');
          } else {
            if (!itemIds.has(id) && !mobIds.has(id) && !EXCLUDED_IDS.has(id))
              addBroken('item', item.id, name, 'obtain (mob)', id, 'mob');
          }
        }
      }

      for (const evId of (item.evolutions || [])) {
        if (!itemIds.has(evId)) addBroken('item', item.id, name, 'evolutions', evId, 'item');
      }
      for (const fId of (item.evolvedFrom || [])) {
        if (!itemIds.has(fId)) addBroken('item', item.id, name, 'evolvedFrom', fId, 'item');
      }
      if (item.set && !panoplieIds.has(item.set))
        addBroken('item', item.id, name, 'set', item.set, 'panoplie');
    }

    // ── Mobs ───────────────────────────────────────────
    for (const mob of mobs) {
      const name = mob.name || mob.id;
      for (const loot of (mob.loot || [])) {
        if (loot.id && !itemIds.has(loot.id) && !EXCLUDED_IDS.has(loot.id))
          addBroken('mob', mob.id, name, 'loot', loot.id, 'item');
      }
    }

    // ── PNJ ────────────────────────────────────────────
    for (const pnj of pnjs) {
      const name = pnj.nom || pnj.name || pnj.id;
      for (const s of (pnj.sells || [])) {
        if (s.id && !itemIds.has(s.id) && !EXCLUDED_IDS.has(s.id))
          addBroken('pnj', pnj.id, name, 'sells', s.id, 'item');
      }
      const craftArr = Array.isArray(pnj.craft) ? pnj.craft
        : (pnj.craft && typeof pnj.craft === 'object') ? Object.values(pnj.craft) : [];
      for (const c of craftArr) {
        if (c.id && !itemIds.has(c.id) && !EXCLUDED_IDS.has(c.id))
          addBroken('pnj', pnj.id, name, 'craft', c.id, 'item');
        for (const ing of (c.ingredients || [])) {
          if (ing.id && !itemIds.has(ing.id) && !EXCLUDED_IDS.has(ing.id))
            addBroken('pnj', pnj.id, name, 'craft.ingredient', ing.id, 'item');
        }
      }
    }

    // ── Quêtes ─────────────────────────────────────────
    for (const q of quetes) {
      const name = q.titre || q.name || q.id;
      for (const obj of (q.objectifs || [])) {
        for (const it of (obj.items || [])) {
          const id = it.id || it.itemId;
          if (id && !itemIds.has(id) && !EXCLUDED_IDS.has(id))
            addBroken('quête', q.id, name, 'objectif.items', id, 'item');
        }
        for (const mb of (obj.mobs || [])) {
          const id = mb.id || mb.mobId;
          if (id && !mobIds.has(id))
            addBroken('quête', q.id, name, 'objectif.mobs', id, 'mob');
        }
      }
      for (const r of (q.recompenses || [])) {
        if (r.itemId && !itemIds.has(r.itemId) && !EXCLUDED_IDS.has(r.itemId))
          addBroken('quête', q.id, name, 'recompense.item', r.itemId, 'item');
      }
    }

    // Dédoublonnage exact
    const seen = new Set();
    const deduped = broken.filter(b => {
      const key = `${b.srcType}|${b.srcId}|${b.field}|${b.refId}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Map "srcType|srcId" → palier (number) pour la désambiguïsation auto
    const SRC_PALIER = new Map();
    for (const e of [...items, ...hiddenItems]) if (e.id) SRC_PALIER.set(`item|${e.id}`, e.palier || 1);
    for (const e of mobs)   if (e.id) SRC_PALIER.set(`mob|${e.id}`,   e.palier || 1);
    for (const e of pnjs)   if (e.id) SRC_PALIER.set(`pnj|${e.id}`,   e.palier || 1);
    for (const e of quetes) if (e.id) SRC_PALIER.set(`quête|${e.id}`, e.palier || 1);

    _deadLinksSnapshot = { deduped, ENTITY_POOL, SRC_PALIER };

    // corrections en attente dont le lien n'est plus mort (corrigé ailleurs) : on les oublie
    const liveKeys = new Set(deduped.map(_dlKey));
    for (const k of [..._dlStaged.keys()]) if (!liveKeys.has(k)) _dlStaged.delete(k);
    _dlUpdateSendBar();

    listEl.innerHTML = '';
    if (!deduped.length) {
      _deadLinksSnapshot = null;
      listEl.innerHTML = '<div class="empty">✓ Aucun lien mort — toutes les références sont valides.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${deduped.length} lien${deduped.length > 1 ? 's' : ''} mort${deduped.length > 1 ? 's' : ''} trouvé${deduped.length > 1 ? 's' : ''}`;
    listEl.appendChild(summary);

    const TYPE_EMOJI = { item: '⚔️', mob: '👾', pnj: '🧑', 'quête': '📜', panoplie: '🔗' };

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Source</th><th>Champ</th><th>ID manquant</th><th>Cible</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const b of deduped) {
      const srcEmoji = TYPE_EMOJI[b.srcType] || '📄';
      const tgtEmoji = TYPE_EMOJI[b.targetType] || '📄';

      // ── Ligne principale ────────────────────────────
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>
          <span style="font-size:10px;color:var(--muted);">${srcEmoji} ${escHtml(b.srcType)}</span><br>
          <span style="font-weight:500;">${escHtml(b.srcName)}</span><br>
          <span class="ghost-id" style="font-size:10px;">${escHtml(b.srcId)}</span>
        </td>
        <td><code style="font-size:11px;color:var(--accent);">${escHtml(b.field)}</code></td>
        <td><span class="ghost-id">${escHtml(b.refId)}</span></td>
        <td><span style="font-size:11px;">${tgtEmoji} ${escHtml(b.targetType)}</span></td>
        <td style="white-space:nowrap;"></td>`;

      const actTd = tr.querySelector('td:last-child');
      const fixBtn = document.createElement('button');
      fixBtn.className = 'btn btn-ghost';
      fixBtn.style.cssText = 'font-size:11px;padding:4px 10px;';
      fixBtn.textContent = '✏️ Corriger';
      const undoBtn = document.createElement('button');
      undoBtn.className = 'btn btn-ghost';
      undoBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-left:4px;display:none;';
      undoBtn.textContent = '↩ Annuler';

      // ── Ligne de correction (masquée par défaut) ────
      const fixTr = document.createElement('tr');
      fixTr.style.cssText = 'display:none;background:rgba(224,172,96,.04);';
      const fixTd = document.createElement('td');
      fixTd.colSpan = 5;
      fixTd.style.cssText = 'padding:8px 12px;border-top:none;';

      // Recherche dans le pool de la cible
      const pool = ENTITY_POOL[b.targetType] || [];
      let selectedId = null;
      const chips = [];
      const suggestions = _dlSuggest(b, pool, SRC_PALIER.get(`${b.srcType}|${b.srcId}`));

      const label = document.createElement('span');
      label.style.cssText = 'font-size:12px;color:var(--muted);margin-right:6px;';
      label.textContent = 'Remplacer par :';

      const searchWrap = document.createElement('div');
      searchWrap.style.cssText = 'position:relative;display:inline-block;';

      const searchInput = document.createElement('input');
      searchInput.type = 'text';
      searchInput.placeholder = `🔍 ${tgtEmoji} Chercher…`;
      searchInput.style.cssText = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:5px 10px;font-size:12px;outline:none;width:240px;';

      const dropdown = document.createElement('div');
      dropdown.style.cssText = 'display:none;position:absolute;top:100%;left:0;z-index:200;width:320px;max-height:180px;overflow-y:auto;border:1px solid var(--border);border-radius:6px;background:var(--surface);box-shadow:0 4px 16px rgba(0,0,0,.3);';

      const applyBtn = document.createElement('button');
      applyBtn.className = 'btn';
      applyBtn.style.cssText = 'background:var(--accent);color:var(--on-accent);font-size:11px;padding:4px 12px;margin-left:6px;opacity:.4;cursor:not-allowed;';
      applyBtn.textContent = '✓ Valider';
      applyBtn.title = 'Mettre cette correction en attente (envoi groupé)';
      applyBtn.disabled = true;

      const cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-ghost';
      cancelBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-left:4px;';
      cancelBtn.textContent = '✕';

      function selectEntity(e) {
        selectedId = e.id;
        searchInput.value = `${e.name}  [${e.id}]`;
        dropdown.style.display = 'none';
        for (const c of chips) c.el.style.borderColor = c.id === e.id ? 'var(--accent)' : '';
        applyBtn.disabled = false;
        applyBtn.style.opacity = '1';
        applyBtn.style.cursor = '';
      }

      function renderDropdown(q) {
        const norm = normalize(q);
        const results = norm
          ? pool.filter(e => normalize(e.search || e.name).includes(norm) || normalize(e.id).includes(norm))
          : [...suggestions.map(s => s.e), ...pool.filter(e => !suggestions.some(s => s.e.id === e.id))].slice(0, 40);
        dropdown.innerHTML = '';
        if (!results.length) {
          const empty = document.createElement('div');
          empty.style.cssText = 'padding:8px 12px;font-size:12px;color:var(--muted);';
          empty.textContent = 'Aucun résultat';
          dropdown.appendChild(empty);
        } else {
          for (const e of results.slice(0, 60)) {
            const row = document.createElement('div');
            row.style.cssText = 'padding:6px 12px;font-size:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);';
            row.innerHTML = `<span style="font-weight:500;">${escHtml(e.name)}</span><span style="font-size:10px;color:var(--muted);font-family:monospace;">${escHtml(e.id)}</span>`;
            row.addEventListener('mouseenter', () => { row.style.background = 'var(--surface2)'; });
            row.addEventListener('mouseleave', () => { row.style.background = ''; });
            row.addEventListener('mousedown', ev => { ev.preventDefault(); selectEntity(e); });
            dropdown.appendChild(row);
          }
        }
        dropdown.style.display = '';
      }

      searchInput.addEventListener('focus', () => renderDropdown(searchInput.value));
      searchInput.addEventListener('input', () => {
        selectedId = null;
        applyBtn.disabled = true;
        applyBtn.style.opacity = '.4';
        applyBtn.style.cursor = 'not-allowed';
        renderDropdown(searchInput.value);
      });
      searchInput.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

      // Valider = mettre la correction en attente (rien n'est écrit) ; tout part avec « Envoyer les corrections »
      const stKey = _dlKey(b);
      const idCell = tr.children[2];
      fixBtn._label = () => _dlStaged.has(stKey) ? '✏️ Modifier' : '✏️ Corriger';
      function refreshStaged() {
        const st = _dlStaged.get(stKey);
        idCell.querySelector('.dl-staged-new')?.remove();
        tr.style.opacity = st ? '.65' : '';
        if (st) {
          const s = document.createElement('div');
          s.className = 'dl-staged-new';
          s.style.cssText = 'font-size:11px;color:var(--success);margin-top:2px;word-break:break-all;';
          s.textContent = `→ ${st.newId}`;
          idCell.appendChild(s);
        }
        fixBtn.textContent = fixBtn._label();
        undoBtn.style.display = st ? '' : 'none';
      }
      applyBtn.addEventListener('click', () => {
        if (!selectedId) return;
        if (b.srcType === b.targetType && selectedId === b.srcId) { toast('⛔ Un élément ne peut pas se référencer lui-même', 'error'); return; }
        _dlStaged.set(stKey, { b, newId: selectedId });
        fixTr.style.display = 'none';
        refreshStaged();
        _dlUpdateSendBar();
      });
      undoBtn.addEventListener('click', () => {
        _dlStaged.delete(stKey);
        refreshStaged();
        _dlUpdateSendBar();
      });

      cancelBtn.addEventListener('click', () => {
        fixTr.style.display = 'none';
        fixBtn.textContent = fixBtn._label();
      });

      fixBtn.addEventListener('click', () => {
        const open = fixTr.style.display !== 'none';
        if (open) { fixTr.style.display = 'none'; fixBtn.textContent = fixBtn._label(); }
        else {
          // Fermer les autres fix rows ouverts
          tbody.querySelectorAll('tr[data-fix-row]').forEach(r => { r.style.display = 'none'; });
          tbody.querySelectorAll('button[data-fix-btn]').forEach(b => { b.textContent = b._label ? b._label() : '✏️ Corriger'; });
          fixTr.style.display = '';
          fixBtn.textContent = '▲ Fermer';
          // rien n'est présélectionné : on choisit une suggestion ou on cherche
          selectedId = null;
          searchInput.value = '';
          applyBtn.disabled = true;
          applyBtn.style.opacity = '.4';
          applyBtn.style.cursor = 'not-allowed';
          for (const c of chips) c.el.style.borderColor = '';
        }
      });
      fixBtn.dataset.fixBtn = '1';
      fixTr.dataset.fixRow = '1';

      searchWrap.appendChild(searchInput);
      searchWrap.appendChild(dropdown);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;flex-wrap:wrap;gap:4px;';
      row.appendChild(label);
      row.appendChild(searchWrap);
      row.appendChild(applyBtn);
      row.appendChild(cancelBtn);
      // Suggestions : l'utilisateur clique celle qui convient, puis « Appliquer »
      const sugWrap = document.createElement('div');
      sugWrap.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin-bottom:6px;';
      const sugLabel = document.createElement('span');
      sugLabel.style.cssText = 'font-size:12px;color:var(--muted);margin-right:2px;';
      sugLabel.textContent = suggestions.length ? 'Suggestions (un clic valide) :' : 'Aucune suggestion — utilise la recherche.';
      sugWrap.appendChild(sugLabel);
      for (const { e } of suggestions) {
        const chip = document.createElement('button');
        chip.className = 'btn btn-ghost';
        chip.style.cssText = 'font-size:11px;padding:3px 8px;';
        chip.title = e.id;
        chip.textContent = e.name && e.name !== e.id ? `${e.name} · ${e.id}` : e.id;
        chip.title = `Choisir : ${e.id}`;
        chip.addEventListener('click', () => { selectEntity(e); applyBtn.click(); }); // un clic = choisi et mis en attente
        chips.push({ id: e.id, el: chip });
        sugWrap.appendChild(chip);
      }

      fixTd.appendChild(sugWrap);
      fixTd.appendChild(row);
      fixTr.appendChild(fixTd);

      // Ouvre la donnée qui porte le lien mort dans l'éditeur de la modération (liste de ses champs) ; « Fermer » revient ici
      const _colOf = { item: 'items', mob: 'mobs', pnj: 'personnages', 'quête': 'quetes', panoplie: 'panoplies' }[b.srcType];
      if (_colOf) {
        const openBtn = document.createElement('button');
        openBtn.className = 'btn btn-ghost';
        openBtn.style.cssText = 'font-size:11px;padding:4px 10px;margin-right:4px;';
        openBtn.textContent = '📂 Ouvrir';
        openBtn.title = 'Ouvre cette donnée dans l\'éditeur (liste des champs)';
        openBtn.addEventListener('click', async () => {
          try {
            const snap = await getDoc(doc(db, _colOf, String(b.srcId)));
            if (!snap.exists()) { toast('Donnée introuvable : ' + b.srcId, 'error'); return; }
            const data = { id: snap.id, ...snap.data() };
            showEditor(_colOf, String(b.srcId), data, 'dead-links');
          } catch (e) { toast('Erreur : ' + e.message, 'error'); }
        });
        actTd.appendChild(openBtn);
      }
      actTd.appendChild(fixBtn);
      actTd.appendChild(undoBtn);
      tbody.appendChild(tr);
      tbody.appendChild(fixTr);
      refreshStaged();   // retrouve l'état « en attente » après un rafraîchissement
    }

    table.appendChild(tbody);
    listEl.appendChild(table);

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
}

const _DEAD_LINK_COL = { item: 'items', mob: 'mobs', 'quête': 'quetes', pnj: 'personnages' };

// Applique UN fix sur data (mutates) — pur, sans I/O
function _applyPatchToData(data, b, newId) {
  if (b.field === 'craft') {
    // PNJ craft peut être un objet {0:{…},1:{…}} au lieu d'un array
    const craftRaw = data.craft;
    const isObj = craftRaw && !Array.isArray(craftRaw) && typeof craftRaw === 'object';
    const craftArr = JSON.parse(JSON.stringify(isObj ? Object.values(craftRaw) : (craftRaw || [])));
    for (const c of craftArr) {
      if (c.id === b.refId) c.id = newId;
      // items = format item/quête, ingredients = format PNJ
      for (const ing of [...(c.items || []), ...(c.ingredients || [])]) if (ing.id === b.refId) ing.id = newId;
    }
    data.craft = isObj ? Object.fromEntries(craftArr.map((c, i) => [String(i), c])) : craftArr;

  } else if (b.field === 'craft.ingredient') {
    const craftRaw = data.craft;
    const isObj = craftRaw && !Array.isArray(craftRaw) && typeof craftRaw === 'object';
    const craftArr = JSON.parse(JSON.stringify(isObj ? Object.values(craftRaw) : (craftRaw || [])));
    for (const c of craftArr)
      for (const ing of (c.ingredients || [])) if (ing.id === b.refId) ing.id = newId;
    data.craft = isObj ? Object.fromEntries(craftArr.map((c, i) => [String(i), c])) : craftArr;

  } else if (b.field === 'sells') {
    data.sells = (data.sells || []).map(s => s.id === b.refId ? { ...s, id: newId } : s);

  } else if (b.field.startsWith('obtain')) {
    data.obtain = (data.obtain || '').replace(/\[([^\]|]+)\|([^\]]+)\]/g, (match, ref, lbl) => {
      const colonIdx = ref.indexOf(':');
      const id = colonIdx !== -1 ? ref.slice(colonIdx + 1) : ref;
      if (id !== b.refId) return match;
      return `[${colonIdx !== -1 ? ref.slice(0, colonIdx + 1) : ''}${newId}|${lbl}]`;
    });

  } else if (b.field === 'evolutions') {
    data.evolutions = (data.evolutions || []).map(id => id === b.refId ? newId : id);

  } else if (b.field === 'evolvedFrom') {
    data.evolvedFrom = (data.evolvedFrom || []).map(id => id === b.refId ? newId : id);

  } else if (b.field === 'set') {
    data.set = newId;

  } else if (b.field === 'loot') {
    data.loot = (data.loot || []).map(l => l.id === b.refId ? { ...l, id: newId } : l);

  } else if (b.field === 'npc') {
    data.npc = newId;

  } else if (b.field === 'objectif.items') {
    const objectifs = JSON.parse(JSON.stringify(data.objectifs || []));
    for (const obj of objectifs)
      for (const it of (obj.items || []))
        if ((it.id || it.itemId) === b.refId) { it.id = newId; if ('itemId' in it) it.itemId = newId; }
    data.objectifs = objectifs;

  } else if (b.field === 'objectif.mobs') {
    const objectifs = JSON.parse(JSON.stringify(data.objectifs || []));
    for (const obj of objectifs)
      for (const mb of (obj.mobs || []))
        if ((mb.id || mb.mobId) === b.refId) { mb.id = newId; if ('mobId' in mb) mb.mobId = newId; }
    data.objectifs = objectifs;

  } else if (b.field === 'recompense.item') {
    const recompenses = JSON.parse(JSON.stringify(data.recompenses || []));
    for (const r of recompenses) if (r.itemId === b.refId) r.itemId = newId;
    data.recompenses = recompenses;

  } else {
    throw new Error('Champ non supporté : ' + b.field);
  }
}

// ── Corrections en attente : rien n'est écrit avant « Envoyer les corrections » ──
const _dlStaged = new Map();   // clé du lien mort -> { b, newId }
const _dlKey = b => [b.srcType, b.srcId, b.field, b.refId].join('|');

function _dlUpdateSendBar() {
  const list = document.getElementById('dead-links-list');
  if (!list) return;
  let bar = document.getElementById('dl-send-bar');
  const n = _dlStaged.size;
  if (!n) { bar?.remove(); return; }
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'dl-send-bar';
    bar.className = 'dl-send-bar';
    list.before(bar);
  }
  bar.innerHTML = `<span><b>${n}</b> correction${n > 1 ? 's' : ''} en attente</span>
    <button class="btn" id="dl-send-btn" style="background:var(--accent);color:var(--on-accent);">📤 Envoyer les corrections</button>
    <button class="btn btn-ghost" id="dl-cancel-btn">Tout annuler</button>`;
  bar.querySelector('#dl-send-btn').onclick = _dlSendStaged;
  bar.querySelector('#dl-cancel-btn').onclick = () => { _dlStaged.clear(); loadDeadLinks(); };
}

async function _dlSendStaged() {
  const entries = [..._dlStaged.values()];
  if (!entries.length) return;
  const btn = document.getElementById('dl-send-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Envoi…'; }
  try {
    // regrouper par document source : un seul chargement et une seule écriture par document
    const byDoc = new Map();
    for (const e of entries) {
      const col = _DEAD_LINK_COL[e.b.srcType];
      if (!col) continue;
      const k = col + '/' + e.b.srcId;
      if (!byDoc.has(k)) byDoc.set(k, []);
      byDoc.get(k).push(e);
    }
    const snaps = await Promise.all([...byDoc.keys()].map(async k => {
      const [col, id] = k.split('/');
      return { k, col, id, snap: await getDoc(doc(db, col, id)) };
    }));
    const writes = [], done = [], failed = [];
    for (const { k, col, id, snap } of snaps) {
      if (!snap.exists()) { failed.push(...byDoc.get(k)); continue; }
      const before = snap.data();
      const data = { ...before };
      for (const e of byDoc.get(k)) {
        try { _applyPatchToData(data, e.b, e.newId); done.push(e); } catch { failed.push(e); }
      }
      // on n'écrit que les champs réellement modifiés
      const patch = {};
      for (const key of Object.keys(data)) if (JSON.stringify(data[key]) !== JSON.stringify(before[key])) patch[key] = data[key];
      if (Object.keys(patch).length) writes.push({ col, id, patch });
    }
    for (let i = 0; i < writes.length; i += 400) {
      const batch = writeBatch(db);
      for (const w of writes.slice(i, i + 400)) batch.update(doc(db, w.col, w.id), sanitizeForFirestore(w.patch));
      await batch.commit();
    }
    for (const col of new Set(writes.map(w => w.col))) invalidateModCache(col);
    await Promise.all(done.map(e => _writeAudit('dead_link_fix', e.b.srcType, e.b.srcId, e.b.srcName, { field: e.b.field, oldRef: e.b.refId, newRef: e.newId })));
    done.forEach(e => _dlStaged.delete(_dlKey(e.b)));
    toast(`✓ ${done.length} correction${done.length > 1 ? 's' : ''} envoyée${done.length > 1 ? 's' : ''}` + (failed.length ? ` — ${failed.length} échec${failed.length > 1 ? 's' : ''} (document introuvable ou champ non supporté, conservé${failed.length > 1 ? 'es' : 'e'} en attente)` : ''), failed.length ? 'info' : 'success');
    await loadDeadLinks();
  } catch (e) {
    toast('⛔ ' + e.message, 'error');
    _dlUpdateSendBar();
  }
}

// ── Suggestions d'IDs pour un lien mort ──────────────
// Proposées à l'utilisateur, jamais appliquées automatiquement : c'est lui qui choisit.
// Score 100 : ID identique ; 90/80 : même ID + suffixe court (_p1…) dans un sens ou dans l'autre ;
// 70/60 : suffixe jusqu'à 8 caractères ; 30 : sous-chaîne ; sinon recouvrement des mots (ID + nom).
function _dlIdScore(normDeadId, normPoolId) {
  if (normDeadId === normPoolId) return 100;
  if (normPoolId.startsWith(normDeadId + '_')) {
    const sfx = normPoolId.slice(normDeadId.length + 1);
    if (sfx.length <= 3) return 90;
    if (sfx.length <= 8) return 70;
    return 0;
  }
  if (normDeadId.startsWith(normPoolId + '_') && normPoolId.length >= 4) {
    const sfx = normDeadId.slice(normPoolId.length + 1);
    if (sfx.length <= 3) return 80;
    if (sfx.length <= 8) return 60;
    return 0;
  }
  if (normDeadId.length >= 6 && normPoolId.length >= 6 && normPoolId.includes(normDeadId)) return 30;
  return 0;
}

const _dlTokens = s => normalize(String(s || '')).split(/[s_]+/).filter(t => t && !/^pd+$/.test(t));

function _dlSuggest(b, pool, srcPalier) {
  const dead = normalize(b.refId);
  const deadTok = _dlTokens(b.refId);
  const out = [];
  for (const e of pool) {
    if (b.srcType === b.targetType && e.id === b.srcId) continue; // jamais l'entité elle-même
    const ne = normalize(e.id);
    let score = _dlIdScore(dead, ne);
    if (deadTok.length) {
      const tok = new Set([..._dlTokens(e.id), ..._dlTokens(e.name)]);
      const common = deadTok.filter(t => tok.has(t)).length;
      if (common) score = Math.max(score, Math.round(55 * common / deadTok.length) + (common === deadTok.length ? 5 : 0));
    }
    if (score < 25) continue;
    if (srcPalier != null && ne.endsWith('_p' + srcPalier)) score += 3;
    out.push({ e, score });
  }
  return out.sort((x, y) => y.score - x.score || x.e.id.length - y.e.id.length).slice(0, 8);
}

// ══════════════════════════════════════════════════════
// IDs ORPHELINS (soumissions pending → IDs rejetés)
// ══════════════════════════════════════════════════════
window.showOrphanIds = async () => {
  _setHash('orphan-ids');
  document.getElementById('orphan-ids-panel').style.display = '';
  document.getElementById('btn-orphan-ids').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadOrphanIds();
};

async function loadOrphanIds() {
  const listEl = document.getElementById('orphan-ids-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [rejectedSnap, pendingSnap] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
    ]);

    // Map rejectedId → submission doc info
    const rejectedMap = new Map();
    for (const d of rejectedSnap.docs) {
      const data = d.data();
      const rid = data?.data?.id;
      if (rid) rejectedMap.set(rid, { subId: d.id, name: data?.data?.name || rid, type: data?.type || '?' });
    }

    if (rejectedMap.size === 0) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID orphelin détecté.</div>';
      _updateOrphanBadge(0);
      return;
    }

    // Orphans: { orphanId → [{ pendingSubId, pendingName, context, rejectedName }] }
    const orphans = {};

    for (const d of pendingSnap.docs) {
      const sub = d.data();
      const subName = sub.data?.name || sub.data?.id || '(soumission)';
      const check = (id, ctx) => {
        if (!id || !rejectedMap.has(id)) return;
        (orphans[id] ??= []).push({
          pendingSubId: d.id,
          pendingName: subName,
          pendingType: sub.type,
          context: ctx,
          rejectedName: rejectedMap.get(id).name,
          rejectedSubId: rejectedMap.get(id).subId,
        });
      };
      for (const c of (sub.data?.craft || []))       check(c.id, 'Craft');
      for (const ev of (sub.data?.evolutions || []))  check(ev,   'Évolution');
      for (const fv of (sub.data?.evolvedFrom || [])) check(fv,   'Évolué de');
      if (sub.data?.obtain) {
        const re = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
        let mo;
        while ((mo = re.exec(sub.data.obtain)) !== null) check(mo[1], 'Obtention');
      }
    }

    const orphanIds = Object.keys(orphans).sort();
    _updateOrphanBadge(orphanIds.length);

    if (!orphanIds.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID orphelin détecté.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${orphanIds.length} ID${orphanIds.length > 1 ? 's' : ''} orphelin${orphanIds.length > 1 ? 's' : ''} — soumissions en attente avec références invalides`;
    listEl.innerHTML = '';
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>ID orphelin</th><th>Soumission en attente</th><th>Contexte</th><th>Soumission rejetée</th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const id of orphanIds) {
      for (const entry of orphans[id]) {
        const tr = document.createElement('tr');
        tr.style.cssText = 'background:rgba(248,113,113,.05);';
        tr.innerHTML = `
          <td><span class="ghost-id">${escHtml(id)}</span></td>
          <td>
            <span style="font-size:11px;">${escHtml(entry.pendingName)}</span>
            <a href="#" onclick="event.preventDefault();_goToSubmission(${JSON.stringify(entry.pendingSubId)})"
               style="display:block;font-size:10px;color:var(--accent);">voir soumission →</a>
          </td>
          <td><span style="font-size:11px;color:var(--muted);">${escHtml(entry.context)}</span></td>
          <td>
            <span style="font-size:11px;color:#f87171;">${escHtml(entry.rejectedName)}</span>
            <span style="display:block;font-size:10px;color:var(--muted);">rejetée</span>
          </td>`;
        tbody.appendChild(tr);
      }
    }
    table.appendChild(tbody);
    listEl.appendChild(table);
  } catch(e) {
    listEl.innerHTML = `<div class="empty">Erreur : ${escHtml(e.message)}</div>`;
  }
}

async function _refreshOrphanCount() {
  try {
    const [rejSnap, pendSnap] = await Promise.all([
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
      getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
    ]);
    const rejectedIds = new Set(rejSnap.docs.map(d => d.data()?.data?.id).filter(Boolean));
    if (!rejectedIds.size) { _updateOrphanBadge(0); return; }
    const orphanIds = new Set();
    for (const d of pendSnap.docs) {
      const sub = d.data();
      for (const c of (sub.data?.craft || []))       if (rejectedIds.has(c.id))  orphanIds.add(c.id);
      for (const ev of (sub.data?.evolutions || []))  if (rejectedIds.has(ev))    orphanIds.add(ev);
      for (const fv of (sub.data?.evolvedFrom || [])) if (rejectedIds.has(fv))    orphanIds.add(fv);
      if (sub.data?.obtain) {
        const re = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
        let mo;
        while ((mo = re.exec(sub.data.obtain)) !== null) if (rejectedIds.has(mo[1])) orphanIds.add(mo[1]);
      }
    }
    _updateOrphanBadge(orphanIds.size);
  } catch {}
}

function _updateOrphanBadge(count) {
  const badge = document.getElementById('count-orphan-ids');
  if (!badge) return;
  if (count > 0) { badge.textContent = count; badge.style.display = ''; }
  else badge.style.display = 'none';
}

window._goToSubmission = function(subId) {
  setFilter('status', 'pending');
  renderSubs();
  setTimeout(() => {
    const card = document.getElementById('card-' + subId);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 150);
};

// ══════════════════════════════════════════════════════
// RÉGIONS ORPHELINES
// ══════════════════════════════════════════════════════
window.showRegionOrphans = async () => {
  _setHash('region-orphans');
  document.getElementById('region-orphan-panel').style.display = '';
  document.getElementById('btn-region-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadRegionOrphans();
};

// ── Système ignore (localStorage) ───────────────────
const IGNORE_KEY = 'vcl_orphan_ignored';
function _getIgnored() {
  try { return JSON.parse(localStorage.getItem(IGNORE_KEY) || '{}'); } catch { return {}; }
}
function _isIgnored(cat, id) { const d = _getIgnored(); return !!(d[cat] && d[cat].includes(id)); }
function _addIgnored(cat, id) {
  const d = _getIgnored(); d[cat] = [...new Set([...(d[cat]||[]), id])];
  localStorage.setItem(IGNORE_KEY, JSON.stringify(d));
}
function _removeIgnored(cat, id) {
  const d = _getIgnored(); d[cat] = (d[cat]||[]).filter(x => x !== id);
  localStorage.setItem(IGNORE_KEY, JSON.stringify(d));
}

// ── Helpers communs ──────────────────────────────────
function _orphanSubHead(text, activeCount, ignoredCount) {
  const d = document.createElement('div');
  d.style.cssText = 'font-size:13px;font-weight:700;color:var(--text);margin:16px 0 8px;padding-bottom:6px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;';
  d.innerHTML = `${text} <span style="font-size:11px;font-weight:400;color:var(--muted);">${activeCount} trouvé${activeCount>1?'s':''}</span>`
    + (ignoredCount ? `<span style="font-size:11px;font-weight:400;color:var(--muted);margin-left:auto;">${ignoredCount} ignoré${ignoredCount>1?'s':''}</span>` : '');
  return d;
}

function _orphanIgnoredToggle(container, rows) {
  // rows = [{tr, restore}] already built
  if (!rows.length) return;
  const wrap = document.createElement('div');
  wrap.style.cssText = 'margin-top:4px;';
  const tog = document.createElement('button');
  tog.className = 'btn btn-ghost';
  tog.style.cssText = 'font-size:11px;padding:3px 8px;opacity:.6;';
  tog.textContent = `▶ Afficher les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`;
  let open = false;
  const table = document.createElement('table');
  table.className = 'ghost-table';
  table.style.display = 'none';
  table.style.marginTop = '6px';
  const tbody = document.createElement('tbody');
  rows.forEach(({ tr }) => tbody.appendChild(tr));
  table.appendChild(tbody);
  tog.addEventListener('click', () => {
    open = !open;
    table.style.display = open ? '' : 'none';
    tog.textContent = open
      ? `▼ Masquer les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`
      : `▶ Afficher les ${rows.length} entrée${rows.length>1?'s':''} ignorée${rows.length>1?'s':''}`;
  });
  wrap.appendChild(tog);
  wrap.appendChild(table);
  container.appendChild(wrap);
}

window.loadRegionOrphans = async function loadRegionOrphans() {
  const listEl = document.getElementById('region-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [regions, mobs] = await Promise.all([
      cachedDocs('regions'),
      cachedDocs('mobs'),
    ]);

    const regionIds = new Set(regions.map(r => r.id));
    const mobsWithBadRegion = mobs.filter(m => m.region && !regionIds.has(m.region));

    listEl.innerHTML = '';

    // ── Section 1 : mobs avec région invalide ────────────
    const active1   = mobsWithBadRegion.filter(m => !_isIgnored('region-bad-mob', m.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','fr'));
    const ignored1  = mobsWithBadRegion.filter(m =>  _isIgnored('region-bad-mob', m.id)).sort((a,b)=>(a.name||'').localeCompare(b.name||'','fr'));
    listEl.appendChild(_orphanSubHead('🔴 Mobs avec région non reconnue', active1.length, ignored1.length));

    if (!active1.length && !ignored1.length) {
      const ok = document.createElement('div'); ok.style.cssText='font-size:12px;color:var(--success);padding:6px 0;'; ok.textContent='✓ Aucun mob avec une région invalide.'; listEl.appendChild(ok);
    } else if (active1.length) {
      // Map nom normalisé → ID de région (pour auto-correction)
      const regionByName = new Map(regions.map(r => [r.name?.trim().toLowerCase(), r.id]));
      const autoFixable = active1.filter(m => regionByName.has(m.region?.trim().toLowerCase()));

      if (autoFixable.length) {
        const autoBar = document.createElement('div');
        autoBar.style.cssText = 'display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;';
        autoBar.innerHTML = `<span style="color:var(--success);">🔧 <b>${autoFixable.length}</b> mob${autoFixable.length>1?'s':''} peut être corrigé automatiquement (nom exact trouvé dans les régions)</span>`;
        const autoBtn = document.createElement('button');
        autoBtn.className = 'btn btn-ghost';
        autoBtn.style.cssText = 'font-size:11px;padding:4px 12px;margin-left:auto;';
        autoBtn.textContent = `🔧 Tout auto-corriger (${autoFixable.length})`;
        autoBtn.addEventListener('click', async () => {
          autoBtn.disabled = true; autoBtn.textContent = 'Correction en cours…';
          let done = 0, failed = 0;
          for (const mob of autoFixable) {
            const rid = regionByName.get(mob.region?.trim().toLowerCase());
            if (!rid) { failed++; continue; }
            try {
              await updateDoc(doc(db, 'mobs', mob.id), { region: rid });
              invalidateModCache('mobs');
              done++;
            } catch(e) { failed++; }
          }
          autoBtn.textContent = `✓ ${done} corrigé${done>1?'s':''}${failed?` · ${failed} échec${failed>1?'s':''}` : ''}`;
          setTimeout(() => loadRegionOrphans(), 800);
        });
        autoBar.appendChild(autoBtn);
        listEl.appendChild(autoBar);
      }

      const table = document.createElement('table'); table.className='ghost-table';
      table.innerHTML=`<thead><tr><th>Mob</th><th>ID mob</th><th>Valeur région (texte libre)</th><th>→ Région détectée</th><th></th></tr></thead>`;
      const tbody = document.createElement('tbody');
      for (const mob of active1) {
        const matchedId = regionByName.get(mob.region?.trim().toLowerCase());
        const matchedRegion = matchedId ? regions.find(r => r.id === matchedId) : null;
        const detectedCell = matchedRegion
          ? `<span style="color:var(--success);font-family:monospace;font-size:12px;">${escHtml(matchedRegion.name)} <span style="opacity:.6;">(${escHtml(matchedId)})</span></span>`
          : `<span style="color:var(--muted);font-size:11px;">—</span>`;
        const tr = document.createElement('tr');
        tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="color:var(--warn);font-family:monospace;font-size:12px;">${escHtml(mob.region)}</span></td><td>${detectedCell}</td><td style="white-space:nowrap;display:flex;gap:6px;"></td>`;
        const td = tr.querySelector('td:last-child');
        if (matchedId) {
          const fixBtn = document.createElement('button'); fixBtn.className='btn btn-ghost'; fixBtn.style.cssText='font-size:11px;padding:4px 10px;color:var(--success);'; fixBtn.textContent='🔧 Corriger';
          fixBtn.addEventListener('click', async () => {
            fixBtn.disabled = true; fixBtn.textContent = '…';
            await updateDoc(doc(db, 'mobs', mob.id), { region: matchedId });
            invalidateModCache('mobs');
            loadRegionOrphans();
          });
          td.appendChild(fixBtn);
        }
        const editBtn = document.createElement('button'); editBtn.className='btn btn-ghost'; editBtn.style.cssText='font-size:11px;padding:4px 10px;'; editBtn.textContent='✏️ Éditer';
        editBtn.addEventListener('click', () => showEditor('mobs', mob.id, mob, 'region-orphan'));
        const ignBtn = document.createElement('button'); ignBtn.className='btn btn-ghost'; ignBtn.style.cssText='font-size:11px;padding:4px 10px;opacity:.7;'; ignBtn.textContent='✓ C\'est normal';
        ignBtn.addEventListener('click', () => { _addIgnored('region-bad-mob', mob.id); loadRegionOrphans(); });
        td.appendChild(editBtn); td.appendChild(ignBtn);
        tbody.appendChild(tr);
      }
      table.appendChild(tbody); listEl.appendChild(table);
    }
    if (ignored1.length) {
      const rows = ignored1.map(mob => {
        const tr = document.createElement('tr');
        tr.style.opacity='.5';
        tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-family:monospace;font-size:12px;">${escHtml(mob.region)}</span></td><td></td>`;
        const restBtn = document.createElement('button'); restBtn.className='btn btn-ghost'; restBtn.style.cssText='font-size:11px;padding:4px 10px;'; restBtn.textContent='↩ Restaurer';
        restBtn.addEventListener('click', () => { _removeIgnored('region-bad-mob', mob.id); loadRegionOrphans(); });
        tr.querySelector('td:last-child').appendChild(restBtn);
        return { tr };
      });
      _orphanIgnoredToggle(listEl, rows);
    }

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

// ══════════════════════════════════════════════════════
// MOBS ORPHELINS
// ══════════════════════════════════════════════════════
window.showMobOrphans = async () => {
  _setHash('mob-orphans');
  document.getElementById('mob-orphan-panel').style.display = '';
  document.getElementById('btn-mob-orphans').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadMobOrphans();
};

window.loadMobOrphans = async function loadMobOrphans() {
  const listEl = document.getElementById('mob-orphan-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [mobs, items, regions] = await Promise.all([
      cachedDocs('mobs'),
      cachedDocs('items'),
      cachedDocs('regions'),
    ]);

    const regionIds = new Set(regions.map(r => r.id));

    // Section 1 : mobs sans région du tout (les mobs avec région invalide sont dans "Région Orphelins")
    const mobsNoValidRegion = mobs.filter(m => !m.region);

    listEl.innerHTML = '';

    const makeMobSection = (cat, headText, list, extraCol) => {
      const active  = list.filter(m => !_isIgnored(cat, m.id)).sort((a,b)=>(a.palier||1)-(b.palier||1)||(a.name||'').localeCompare(b.name||'','fr'));
      const ignored = list.filter(m =>  _isIgnored(cat, m.id)).sort((a,b)=>(a.palier||1)-(b.palier||1)||(a.name||'').localeCompare(b.name||'','fr'));
      listEl.appendChild(_orphanSubHead(headText, active.length, ignored.length));

      if (!active.length && !ignored.length) {
        const ok = document.createElement('div'); ok.style.cssText='font-size:12px;color:var(--success);padding:6px 0;'; ok.textContent='✓ Aucun.'; listEl.appendChild(ok); return;
      }

      if (active.length) {
        const hasExtra = !!extraCol;
        const table = document.createElement('table'); table.className='ghost-table';
        table.innerHTML=`<thead><tr><th>Mob</th><th>ID</th><th>Type</th>${hasExtra?`<th>${escHtml(extraCol.head)}</th>`:''}<th></th></tr></thead>`;
        const tbody = document.createElement('tbody');
        for (const mob of active) {
          const typeLabel = `P${mob.palier||'?'} ${mob.type||'—'}`;
          const extraCell = hasExtra ? `<td><span style="font-family:monospace;font-size:11px;color:var(--warn);">${escHtml(extraCol.val(mob)||'—')}</span></td>` : '';
          const tr = document.createElement('tr');
          tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-size:11px;color:var(--muted);">${escHtml(typeLabel)}</span></td>${extraCell}<td style="white-space:nowrap;display:flex;gap:6px;"></td>`;
          const td = tr.querySelector('td:last-child');
          const editBtn = document.createElement('button'); editBtn.className='btn btn-ghost'; editBtn.style.cssText='font-size:11px;padding:4px 10px;'; editBtn.textContent='✏️ Corriger';
          editBtn.addEventListener('click', () => showEditor('mobs', mob.id, mob, 'mob-orphan'));
          const ignBtn = document.createElement('button'); ignBtn.className='btn btn-ghost'; ignBtn.style.cssText='font-size:11px;padding:4px 10px;opacity:.7;'; ignBtn.textContent="✓ C'est normal";
          ignBtn.addEventListener('click', () => { _addIgnored(cat, mob.id); loadMobOrphans(); });
          td.appendChild(editBtn); td.appendChild(ignBtn);
          tbody.appendChild(tr);
        }
        table.appendChild(tbody); listEl.appendChild(table);
      }

      if (ignored.length) {
        const rows = ignored.map(mob => {
          const typeLabel = `P${mob.palier||'?'} ${mob.type||'—'}`;
          const tr = document.createElement('tr'); tr.style.opacity='.5';
          tr.innerHTML=`<td>${escHtml(mob.name||mob.id)}</td><td><span class="ghost-id">${escHtml(mob.id)}</span></td><td><span style="font-size:11px;color:var(--muted);">${escHtml(typeLabel)}</span></td><td></td>`;
          const restBtn = document.createElement('button'); restBtn.className='btn btn-ghost'; restBtn.style.cssText='font-size:11px;padding:4px 10px;'; restBtn.textContent='↩ Restaurer';
          restBtn.addEventListener('click', () => { _removeIgnored(cat, mob.id); loadMobOrphans(); });
          tr.querySelector('td:last-child').appendChild(restBtn);
          return { tr };
        });
        _orphanIgnoredToggle(listEl, rows);
      }
    };

    makeMobSection(
      'mob-region',
      '🔴 Mobs sans région',
      mobsNoValidRegion,
      { head: 'Valeur actuelle', val: m => m.region || '' }
    );

  } catch(e) {
    listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};

// ══════════════════════════════════════════════════════
// IDs FANTÔMES (items)
// ══════════════════════════════════════════════════════
async function loadGhostIds() {
  const listEl = document.getElementById('ghost-id-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [items, mobs, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('mobs'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    const definedItemIds = new Set([
      ...items.map(i => i.id),
      ...hiddenItems.map(h => h.id).filter(Boolean),
    ]);
    const definedMobIds  = new Set(mobs.map(m => m.id));

    // ghostId → [{ label, type }]
    // type: 'craft' | 'drop' | 'mob-obtain'
    const refs = {};

    const EXCLUDED_IDS = new Set(['cols']); // IDs spéciaux (monnaie, etc.) jamais dans items

    // 1. Ingrédients de craft référençant un item inexistant
    for (const item of items) {
      for (const c of (item.craft || [])) {
        if (c.id && !definedItemIds.has(c.id) && !EXCLUDED_IDS.has(c.id)) {
          (refs[c.id] ??= []).push({ label: `Craft : ${item.name || item.id}`, type: 'craft' });
        }
      }
    }

    // 2. Loot de mobs référençant un item inexistant
    for (const mob of mobs) {
      for (const loot of (mob.loot || [])) {
        if (loot.id && !definedItemIds.has(loot.id) && !EXCLUDED_IDS.has(loot.id)) {
          const pct = loot.chance != null ? `${loot.chance}%` : '?%';
          (refs[loot.id] ??= []).push({ label: `Drop : ${mob.name || mob.id} (${pct})`, type: 'drop' });
        }
      }
    }

    // 3. Mobs référencés dans item.obtain mais absents de la collection mobs
    // Format : [mobId|MobName][chance] — on exclut [npc:xxx|...] qui sont des PNJ
    const reMobRef = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
    for (const item of items) {
      if (!item.obtain) continue;
      let m;
      reMobRef.lastIndex = 0;
      while ((m = reMobRef.exec(item.obtain)) !== null) {
        const mobId = m[1];
        if (!definedMobIds.has(mobId)) {
          (refs[mobId] ??= []).push({ label: `Obtain (mob) : ${item.name || item.id}`, type: 'mob-obtain' });
        }
      }
    }

    // 4. IDs de soumissions rejetées référencés dans des soumissions en attente
    try {
      const [rejectedSnap, pendingSnap] = await Promise.all([
        getDocs(query(collection(db, 'submissions'), where('status', '==', 'rejected'))),
        getDocs(query(collection(db, 'submissions'), where('status', '==', 'pending'))),
      ]);
      const rejectedIds = new Set(
        rejectedSnap.docs.map(d => d.data()?.data?.id).filter(Boolean)
      );
      if (rejectedIds.size > 0) {
        for (const d of pendingSnap.docs) {
          const sub = d.data();
          const subName = sub.data?.name || sub.data?.id || '(soumission)';
          // craft ingredients
          for (const c of (sub.data?.craft || [])) {
            if (c.id && rejectedIds.has(c.id) && !definedItemIds.has(c.id)) {
              (refs[c.id] ??= []).push({ label: `Craft (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // evolutions
          for (const evId of (sub.data?.evolutions || [])) {
            if (rejectedIds.has(evId) && !definedItemIds.has(evId)) {
              (refs[evId] ??= []).push({ label: `Évolution (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // evolvedFrom
          for (const fId of (sub.data?.evolvedFrom || [])) {
            if (rejectedIds.has(fId) && !definedItemIds.has(fId)) {
              (refs[fId] ??= []).push({ label: `Évolué de (soumission en attente) : ${subName}`, type: 'rejected' });
            }
          }
          // obtain string — mob refs
          if (sub.data?.obtain) {
            const reObt = /\[(?!npc:)([\w]+)\|[^\]]*\]\[/g;
            let mo;
            while ((mo = reObt.exec(sub.data.obtain)) !== null) {
              const mobId = mo[1];
              if (rejectedIds.has(mobId) && !definedMobIds.has(mobId)) {
                (refs[mobId] ??= []).push({ label: `Obtention (soumission en attente) : ${subName}`, type: 'rejected' });
              }
            }
          }
        }
      }
    } catch(e) { console.warn('[loadGhostIds] rejected scan error', e); }

    const ghostIds = Object.keys(refs).sort();
    listEl.innerHTML = '';

    if (!ghostIds.length) {
      listEl.innerHTML = '<div class="empty">✓ Aucun ID fantôme — tout est défini.</div>';
      return;
    }

    const summary = document.createElement('div');
    summary.style.cssText = 'font-size:12px;color:var(--muted);margin-bottom:12px;';
    summary.textContent = `${ghostIds.length} ID${ghostIds.length > 1 ? 's' : ''} fantôme${ghostIds.length > 1 ? 's' : ''} trouvé${ghostIds.length > 1 ? 's' : ''}`;
    listEl.appendChild(summary);

    const table = document.createElement('table');
    table.className = 'ghost-table';
    table.innerHTML = `<thead><tr><th>Type</th><th>ID fantôme</th><th>Référencé dans</th><th></th></tr></thead>`;
    const tbody = document.createElement('tbody');

    for (const id of ghostIds) {
      const entries = refs[id];
      // Un ID est un mob fantôme si toutes ses références viennent de mob-obtain ou rejected mob
      const isMob = entries.every(e => e.type === 'mob-obtain' || (e.type === 'rejected' && e.label.includes('Obtention')));
      const isRejected = entries.some(e => e.type === 'rejected');
      const tr = document.createElement('tr');
      if (isRejected) tr.style.cssText = 'background:rgba(248,113,113,.05);';
      const refsHtml = entries.map(e =>
        `<span class="ghost-type-${e.type}">${escHtml(e.label)}</span>`
      ).join('<br>');
      const typeCell = isRejected
        ? `<span style="font-size:10px;font-weight:700;color:#f87171;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);border-radius:8px;padding:2px 7px;">🚫 Rejet</span>`
        : isMob
          ? `<span style="font-size:10px;font-weight:700;color:var(--warn);background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:2px 7px;">Mob</span>`
          : `<span style="font-size:10px;font-weight:700;color:var(--accent);background:rgba(224,172,96,.1);border:1px solid rgba(224,172,96,.3);border-radius:8px;padding:2px 7px;">Item</span>`;
      const actionCell = isRejected
        ? `<span style="font-size:11px;color:var(--muted);">Soumission rejetée — à corriger</span>`
        : isMob
          ? `<a href="creator.html?ghostid=${encodeURIComponent(id)}&ghosttype=mob" target="_blank"
               class="btn btn-ghost" style="font-size:11px;padding:4px 10px;text-decoration:none;">👾 Créer le mob</a>`
          : `<a href="creator.html?ghostid=${encodeURIComponent(id)}" target="_blank"
               class="btn btn-ghost" style="font-size:11px;padding:4px 10px;text-decoration:none;">✏️ Créer l'item</a>`;
      tr.innerHTML = `
        <td>${typeCell}</td>
        <td><span class="ghost-id">${escHtml(id)}</span></td>
        <td><span class="ghost-refs">${refsHtml}</span></td>
        <td style="white-space:nowrap;">${actionCell}</td>`;
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    listEl.appendChild(table);

  } catch(e) {
    listEl.innerHTML = `<div class="empty">Erreur : ${escHtml(e.message)}</div>`;
  }
}

Object.assign(window, { loadDeadLinks, loadOrphanIds, _refreshOrphanCount, loadGhostIds });
}
