// ══════════════════════════════════════════════════════
// DATA ALL PANEL (vue complète des données publiées)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, escHtml, setHash: _setHash, db, COL, collection, doc, deleteDoc, toast, modal } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
let _dataAllLoaded  = false;
let _dataAllData    = [];
let _dataAllFlagSet = new Set();

const _DATA_ALL_COLS = {
  item:     { col: 'items',       nameKey: 'name',  label: '⚔️' },
  mob:      { col: 'mobs',        nameKey: 'name',  label: '👾' },
  pnj:      { col: 'personnages', nameKey: 'name',  label: '🧑' },
  region:   { col: 'regions',     nameKey: 'name',  label: '📍' },
  quest:    { col: 'quetes',      nameKey: 'titre', label: '📜' },
  panoplie: { col: 'panoplies',   nameKey: 'label', label: '🔗' },
};

const _DATA_ALL_FLAGS = [
  { key: 'evolutif',   label: '🔄 Évolutif',      types: ['item'],                            filter: d => d.evolutif === true },
  { key: 'event',      label: '🎊 Event',          types: ['item'],                            filter: d => d.palier === 'event' },
  { key: 'sensible',   label: '🔒 Sensible',       types: ['item','mob','pnj'],                filter: d => d.sensible === true },
  { key: 'boss',       label: '💀 Boss',           types: ['mob'],                             filter: d => d.type === 'boss' },
  { key: 'miniboss',   label: '⚔️ Mini-Boss',     types: ['mob'],                             filter: d => d.type === 'miniboss' },
  { key: 'codex',      label: '📖 Codex',          types: ['mob','region'],                    filter: d => d.codex === true },
  { key: 'sans_lore',  label: '📖 Sans lore',      types: ['item','mob'],                      filter: d => !d.lore },
  { key: 'avec_craft', label: '🔨 Avec craft',     types: ['item'],                            filter: d => Array.isArray(d.craft) && d.craft.length > 0 },
  { key: 'avec_evo',   label: '🔀 Avec évolutions',types: ['item'],                            filter: d => Array.isArray(d.evolutions) && d.evolutions.length > 0 },
  { key: 'no_palier',  label: '❓ Sans palier',    types: ['item','mob','pnj','region','quest'],filter: d => !d.palier },
  { key: 'sans_image', label: '🖼️ Sans image',    types: ['item','mob'],                      filter: d => !d.images?.length },
  { key: 'sans_obtain',label: '📍 Sans obtention', types: ['item'],                            filter: d => !d.obtain },
  { key: 'sans_stats', label: '📊 Sans stats',     types: ['item'],                            filter: d => !d.stats },
  { key: 'avec_set',   label: '◈ Avec set',        types: ['item'],                            filter: d => !!d.set },
  { key: 'unique',     label: '✦ Unique',          types: ['item'],                            filter: d => !!d.unique },
  { key: 'deux_mains', label: '⚔️⚔️ 2 mains',    types: ['item'],                            filter: d => !!d.twoHanded },
  { key: 'avec_effets',label: '✨ Avec effets',    types: ['item','mob'],                      filter: d => Array.isArray(d.effects) && d.effects.length > 0 },
];

window.showDataAll = async function() {
  _setHash('data-all');
  document.getElementById('data-all-panel').style.display = '';
  document.getElementById('btn-data-all').classList.add('active');
  _buildDataAllChips();
  if (!_dataAllLoaded) await loadDataAll();
  else renderDataAll();
};

let _loadDataAllInFlight = null;
window.loadDataAll = async function() {
  // Garde anti-réentrance : si un load est déjà en cours, on retourne sa promesse
  // → évite que deux clics rapides (ou hash routing + bouton) doublent _dataAllData
  if (_loadDataAllInFlight) return _loadDataAllInFlight;
  _loadDataAllInFlight = (async () => {
    _dataAllLoaded = false;
    _dataAllData   = [];
    const listEl = document.getElementById('data-all-list');
    if (listEl) listEl.innerHTML = '<div class="empty">Chargement…</div>';

    try {
      for (const [type, conf] of Object.entries(_DATA_ALL_COLS)) {
        const docs = await cachedDocs(conf.col);
        for (const d of docs) {
          _dataAllData.push({
            _type:  type,
            _col:   conf.col,
            _icon:  conf.label,
            _docKey: d._docKey,
            id:     d.id,
            name:   d[conf.nameKey] || d.name || d.id,
            ...d
          });
        }
      }
      // Ajouter les items sensibles (items_hidden + compléments items_secret)
      // Dédupliquer par id logique : ne pas ajouter si un item avec le même id est déjà dans la liste
      try {
        const existingItemIds = new Set(
          _dataAllData.filter(d => d._type === 'item').map(d => String(d.id))
        );
        const hiddenDocs = await cachedDocs(COL.itemsHidden);
        const secretDocs = await cachedDocs(COL.itemsSecret).catch(() => []);
        const secretMap  = new Map(secretDocs.map(d => [String(d.id || d._id || ''), d]));
        for (const d of hiddenDocs) {
          if (existingItemIds.has(String(d.id))) continue;
          const sec = secretMap.get(String(d.id || '')) || {};
          _dataAllData.push({
            _type: 'item', _col: COL.itemsHidden, _icon: '⚔️',
            _docKey: d._docKey,                      // hash réel (clé Firestore)
            id: d.id, name: d.name || d.id,
            sensible: true,
            ...d, ...sec,
            _docKey: d._docKey,                      // re-protéger après spread (sec.id ne doit pas écraser)
          });
        }
      } catch {}

      // Mobs sensibles
      try {
        const existingMobIds = new Set(_dataAllData.filter(d => d._type === 'mob').map(d => String(d.id)));
        const secretMobs = await cachedDocs(COL.mobsSecret).catch(() => []);
        for (const d of secretMobs) {
          if (existingMobIds.has(String(d.id))) continue;
          _dataAllData.push({
            _type: 'mob', _col: COL.mobsSecret, _icon: '👾',
            _docKey: d._docKey, id: d.id, name: d.name || d.id,
            sensible: true, ...d, _docKey: d._docKey,
          });
        }
      } catch {}

      // PNJ sensibles
      try {
        const existingPnjIds = new Set(_dataAllData.filter(d => d._type === 'pnj').map(d => String(d.id)));
        const secretPnjs = await cachedDocs(COL.pnjSecret).catch(() => []);
        for (const d of secretPnjs) {
          if (existingPnjIds.has(String(d.id))) continue;
          _dataAllData.push({
            _type: 'pnj', _col: COL.pnjSecret, _icon: '🧑',
            _docKey: d._docKey, id: d.id, name: d.name || d.id,
            sensible: true, ...d, _docKey: d._docKey,
          });
        }
      } catch {}

      // Filet de sécurité : dédup finale par (collection, clé Firestore réelle)
      const _seen = new Set();
      _dataAllData = _dataAllData.filter(d => {
        const k = `${d._col}::${d._docKey || d.id}`;
        if (_seen.has(k)) return false;
        _seen.add(k);
        return true;
      });

      _dataAllLoaded = true;
      renderDataAll();
    } catch(e) {
      if (listEl) listEl.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
    }
  })();
  try { await _loadDataAllInFlight; }
  finally { _loadDataAllInFlight = null; }
};

window.onDataAllTypeChange = function() {
  _dataAllFlagSet = new Set();
  _buildDataAllChips();
  const typeVal    = document.getElementById('data-all-type')?.value || '';
  const catSel     = document.getElementById('data-all-category');
  const raritySel  = document.getElementById('data-all-rarity');
  if (catSel)    catSel.style.display    = (typeVal === 'item') ? '' : 'none';
  if (raritySel) raritySel.style.display = (typeVal === 'item') ? '' : 'none';
  renderDataAll();
};

function _buildDataAllChips() {
  const chipsEl = document.getElementById('data-all-chips');
  if (!chipsEl) return;
  const selectedType = document.getElementById('data-all-type')?.value || '';
  chipsEl.innerHTML = '';

  _DATA_ALL_FLAGS
    .filter(f => !selectedType || f.types.includes(selectedType))
    .forEach(f => {
      const chip = document.createElement('button');
      chip.className = 'filter-btn';
      chip.style.cssText = 'font-size:11px;padding:2px 10px;border-radius:20px;';
      chip.textContent = f.label;
      if (_dataAllFlagSet.has(f.key)) chip.classList.add('active');
      chip.onclick = () => {
        if (_dataAllFlagSet.has(f.key)) _dataAllFlagSet.delete(f.key);
        else _dataAllFlagSet.add(f.key);
        chip.classList.toggle('active');
        renderDataAll();
      };
      chipsEl.appendChild(chip);
    });
}

// Tri « Ancien palier » : proposé uniquement quand le filtre est sur le palier Archive (-1)
// et qu'il reste des items archivés ; l'option disparaît d'elle-même une fois l'archive vidée.
function _daSyncOldPalierSort(palierFilter) {
  const sel = document.getElementById('data-all-sort');
  if (!sel) return;
  const available = palierFilter === '-1' && _dataAllData.some(d => d.palier == -1 && d._oldPalier != null);
  const opt = sel.querySelector('option[value="old"]');
  if (available && !opt) {
    const o = document.createElement('option');
    o.value = 'old';
    o.textContent = 'Ancien palier (archive)';
    sel.appendChild(o);
  } else if (!available && opt) {
    if (sel.value === 'old') sel.value = 'name';
    opt.remove();
  }
}

// Filtre « Ex-palier » : items de l'archive (palier -1) selon leur ancien palier (ex-P1, ex-P2…).
// Le menu n'apparaît que s'il reste des items archivés ; il disparaît de lui-même une fois l'archive vidée.
let _exPalierSel = ''; // ancien palier sélectionné ('' = aucun) ; une seule pastille active à la fois
function _daSyncExPalierFilter() {
  const box = document.getElementById('data-all-expalier');
  if (!box) return '';
  const olds = [...new Set(_dataAllData.filter(d => d.palier == -1 && d._oldPalier != null).map(d => String(d._oldPalier)))]
    .sort((a, b) => (Number(a) || 98) - (Number(b) || 98));
  if (!olds.includes(_exPalierSel)) _exPalierSel = '';
  box.innerHTML = '';
  olds.forEach(o => {
    const n = _dataAllData.filter(d => d.palier == -1 && String(d._oldPalier) === o).length;
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'filter-btn' + (o === _exPalierSel ? ' active' : '');
    chip.style.cssText = 'font-size:11px;padding:3px 10px;border-radius:20px;';
    chip.title = `Équipements de l'archive qui étaient en palier ${o} (cliquer de nouveau pour retirer le filtre)`;
    chip.textContent = `ex-P${o} (${n})`;
    chip.onclick = () => { _exPalierSel = (_exPalierSel === o) ? '' : o; renderDataAll(); };
    box.appendChild(chip);
  });
  box.style.display = olds.length ? 'inline-flex' : 'none';
  return _exPalierSel;
}

window.renderDataAll = function() {
  if (!_dataAllLoaded) return;
  const listEl    = document.getElementById('data-all-list');
  const countEl   = document.getElementById('data-all-count');
  if (!listEl) return;

  const searchQ      = normalize((document.getElementById('data-all-search')?.value || '').trim());
  const typeFilter   = document.getElementById('data-all-type')?.value    || '';
  const palierFilter = document.getElementById('data-all-palier')?.value  || '';
  const catFilter    = document.getElementById('data-all-category')?.value || '';
  const rarityFilter = document.getElementById('data-all-rarity')?.value  || '';
  _daSyncOldPalierSort(palierFilter);
  const sortBy       = document.getElementById('data-all-sort')?.value    || 'name';

  let results = _dataAllData;

  if (typeFilter)   results = results.filter(d => d._type === typeFilter);
  if (palierFilter) results = results.filter(d => String(d.palier) === palierFilter);
  const exPalier = _daSyncExPalierFilter();
  if (exPalier) results = results.filter(d => d.palier == -1 && String(d._oldPalier) === exPalier);
  if (catFilter)    results = results.filter(d => d.category === catFilter);
  if (rarityFilter) results = results.filter(d => d._type === 'item' && d.rarity === rarityFilter);
  if (searchQ)      results = results.filter(d =>
    fuzzyMatch(searchQ, d.name || '') ||
    fuzzyMatch(searchQ, d.id   || '') ||
    (d.tags || []).some(t => fuzzyMatch(searchQ, t)) ||
    (d.set  && fuzzyMatch(searchQ, d.set))
  );

  for (const flagKey of _dataAllFlagSet) {
    const def = _DATA_ALL_FLAGS.find(f => f.key === flagKey);
    if (def) results = results.filter(d => def.filter(d));
  }

  // Sort
  results = [...results];
  if (sortBy === 'name')   results.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  else if (sortBy === 'palier') results.sort((a, b) => (a.palier || 9) - (b.palier || 9) || (a.name || '').localeCompare(b.name || '', 'fr'));
  else if (sortBy === 'old') {
    const oldRank = d => { const n = Number(d._oldPalier); return Number.isFinite(n) ? n : 98; };
    results.sort((a, b) => oldRank(a) - oldRank(b) || (a.name || '').localeCompare(b.name || '', 'fr'));
  }
  else if (sortBy === 'type')  results.sort((a, b) => a._type.localeCompare(b._type) || (a.name || '').localeCompare(b.name || '', 'fr'));

  if (countEl) countEl.textContent = `${results.length} résultat${results.length !== 1 ? 's' : ''}`;

  if (!results.length) {
    listEl.innerHTML = '<div class="empty">Aucun résultat</div>';
    return;
  }

  listEl.innerHTML = '';
  const COL_MAP = { item:'items', mob:'mobs', pnj:'personnages', region:'regions', quest:'quetes', panoplie:'panoplies' };

  results.forEach(d => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);';

    const nameEl = document.createElement('span');
    nameEl.style.cssText = 'flex:1;font-size:13px;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    nameEl.innerHTML = `${d._icon} <b>${escHtml(d.name || d.id)}</b>`;

    const idEl = document.createElement('code');
    idEl.style.cssText = 'font-size:10px;color:var(--muted);flex-shrink:0;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
    idEl.textContent = d.id;

    const badgesEl = document.createElement('span');
    badgesEl.style.cssText = 'display:flex;gap:3px;flex-shrink:0;flex-wrap:nowrap;';

    if (d.palier) _daAddBadge(badgesEl, d.palier == -1 ? 'Archive' : 'P'+d.palier, 'var(--accent)', 'rgba(224,172,96,.15)');
    if (d.palier == -1 && d._oldPalier != null) _daAddBadge(badgesEl, 'ex-P' + d._oldPalier, '#60a5fa', 'rgba(96,165,250,.12)');
    if (d.category) _daAddBadge(badgesEl, d.category, 'var(--muted)', 'transparent');
    if (d.rarity && d._type === 'item') {
      const _RC = { commun:'#aaa', rare:'#4da6ff', epique:'#c47aff', legendaire:'#ffb830', mythique:'#ff6060', godlike:'#ff3aba', event:'#60e8b0' };
      const rc = _RC[d.rarity] || '#aaa';
      _daAddBadge(badgesEl, d.rarity, rc, rc + '22');
    }
    if (d.set)                 _daAddBadge(badgesEl, '◈ ' + d.set, 'var(--muted)', 'rgba(255,255,255,.04)');
    if (d.evolutif)            _daAddBadge(badgesEl, '🔄', '#60a5fa', 'rgba(96,165,250,.1)');
    if (d.palier === 'event')  _daAddBadge(badgesEl, '🎊', '#a855f7', 'rgba(168,85,247,.1)');
    if (d.sensible)            _daAddBadge(badgesEl, '🔒', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'boss')     _daAddBadge(badgesEl, 'Boss', '#f87171', 'rgba(248,113,113,.1)');
    if (d.type === 'miniboss') _daAddBadge(badgesEl, 'Mini', '#f59e0b', 'rgba(245,158,11,.1)');
    if (d.codex)               _daAddBadge(badgesEl, 'Codex', '#4ade80', 'rgba(74,222,128,.1)');

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;';
    editBtn.textContent = '✏️';
    editBtn.title = 'Éditer dans le panneau';
    editBtn.onclick = () => {
      let col;
      if (d.sensible && d._type === 'item') col = 'items_sensible';
      else if (d.sensible && d._type === 'mob') col = 'mobs_secret';
      else if (d.sensible && d._type === 'pnj') col = 'pnj_secret';
      else col = d._col || COL_MAP[d._type] || d._type;
      showEditor(col, d.sensible ? (d._docKey || d.id) : d.id, d, 'data-all');
    };

    const compUrl = d._type === 'item'
      ? `Compendium/compendium.html#${encodeURIComponent(d.id)}`
      : d._type === 'mob'
        ? `Bestiaire/bestiaire.html#monstres/${encodeURIComponent(d.id)}`
        : d._type === 'pnj'
          ? `Bestiaire/bestiaire.html#personnages/${encodeURIComponent(d.id)}`
          : null;
    row.appendChild(nameEl);
    row.appendChild(idEl);
    row.appendChild(badgesEl);
    row.appendChild(editBtn);

    if (compUrl) {
      const compBtn = document.createElement('a');
      compBtn.className = 'btn btn-ghost';
      compBtn.style.cssText = 'font-size:11px;padding:3px 8px;flex-shrink:0;text-decoration:none;';
      compBtn.textContent = '📖';
      compBtn.title = 'Voir dans le Compendium / Bestiaire';
      compBtn.href = compUrl;
      compBtn.target = '_blank';
      compBtn.setAttribute('draggable', 'false');
      compBtn.addEventListener('click', e => e.stopPropagation());
      row.appendChild(compBtn);
    }

    listEl.appendChild(row);
  });
};

window.deleteDataDuplicates = async function() {
  if (!_dataAllLoaded || !_dataAllData.length) {
    toast('⚠️ Chargez d\'abord les données (🔄 Rafraîchir)', 'warning');
    return;
  }
  // Trouver les doublons : même id dans la même collection
  const seen = new Map(); // `col:id` → first entry
  const dupes = [];
  for (const d of _dataAllData) {
    const key = `${d._col}:${d.id}`;
    if (seen.has(key)) {
      dupes.push(d);
    } else {
      seen.set(key, d);
    }
  }
  if (!dupes.length) { toast('✓ Aucun doublon détecté.', 'success'); return; }
  const list = dupes.map(d => `  • ${d._col}/${d.id} — ${d.name || '—'}`).join('\n');
  if (!await modal.confirm(`${dupes.length} doublon(s) détecté(s) :\n\n${list}\n\nSupprimer ces entrées ?`)) return;
  let deleted = 0;
  for (const d of dupes) {
    try {
      await deleteDoc(doc(db, d._col, d.id));
      _dataAllData = _dataAllData.filter(x => !(x.id === d.id && x._col === d._col && x !== seen.get(`${d._col}:${d.id}`)));
      localStorage.removeItem(`vcl_cache_v2_${d._col}`);
      localStorage.removeItem(`vcl_cache_meta_v2_${d._col}`);
      invalidateModCache(d._col);
      deleted++;
    } catch(e) {
      toast(`⛔ Erreur ${d.id} : ${e.message}`, 'error');
    }
  }
  toast(`✓ ${deleted} doublon(s) supprimé(s)`, 'success');
  _dataAllLoaded = false;
  renderDataAll();
};

function _daAddBadge(container, text, color, bg) {
  const b = document.createElement('span');
  b.style.cssText = `font-size:10px;padding:1px 5px;border-radius:8px;color:${color};background:${bg};border:1px solid ${color}40;white-space:nowrap;flex-shrink:0;`;
  b.textContent = text;
  container.appendChild(b);
}
}
