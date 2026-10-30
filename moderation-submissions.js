// ══════════════════════════════════════════════════════
// SOUMISSIONS — liste, filtres, cartes, diff, approbation/rejet, actions groupées
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { modCache: _modCache, cachedDocs, invalidateModCache, writeAudit: _writeAudit, ed: _ed, st: _st, _slugName, _renamedItemId, _renameImagePaths, _toastImageRenames, _syncPnjObtain, _syncMobObtain, _syncItemObtain, _recordItemRename, _renameItemReferences, _regionName, escHtml, _SUB_COL_MAP, addCreatorBtn: _addCreatorBtn, _readContribs, _mergeContributors, db, COL, collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, serverTimestamp, orderBy, query, hashName, getItemGameplayKeys, sanitizeForFirestore, loadCollection, toast, modal, desanitizeFromFirestore, store, setHash: _setHash, showPanel: _showPanel } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
// ── Load submissions ──────────────────────────────────
async function fetchUserNames(uids) {
  await Promise.all(uids.map(async uid => {
    if (ctx.userNames.has(uid)) return;
    try {
      const snap = await getDoc(doc(db, 'users', uid));
      ctx.userNames.set(uid, snap.exists() ? (snap.data().pseudo || snap.data().displayName || null) : null);
    } catch { ctx.userNames.set(uid, null); }
  }));
}

function userName(uid, fallback) {
  // Pas de compte → "pseudo (invité)"
  if (!uid) return fallback ? `${fallback} (invité)` : '— (invité)';
  if (fallback) return fallback;
  const name = ctx.userNames.get(uid);
  return name || uid.slice(0, 8) + '…';
}

window.loadSubmissions = async () => {
  document.getElementById('submissions-list').innerHTML = '<div class="empty">Chargement…</div>';
  try {
    let snap;
    try {
      const q = query(collection(db, 'submissions'), orderBy('submittedAt', 'desc'));
      snap = await getDocs(q);
    } catch {
      // Fallback sans orderBy (en cas d'index manquant ou de docs sans submittedAt)
      snap = await getDocs(collection(db, 'submissions'));
    }
    _st.all = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
    // Trier côté client par submittedAt desc (robuste si certains docs n'ont pas le champ)
    _st.all.sort((a, b) => {
      const ta = a.submittedAt?.toMillis?.() ?? a.submittedAt ?? 0;
      const tb = b.submittedAt?.toMillis?.() ?? b.submittedAt ?? 0;
      if (tb !== ta) return tb - ta;
      return a._id < b._id ? -1 : a._id > b._id ? 1 : 0; // tiebreaker stable
    });
    // Pré-charger les pseudos et les panoplies (pour labels sets dans résumé)
    const uids = [...new Set(_st.all.flatMap(s => [s.submittedBy, s.reviewedBy].filter(Boolean)))];
    await Promise.all([
      fetchUserNames(uids).catch(() => {}),
      cachedDocs('panoplies').catch(() => {}),
      // noms et icônes des items cités dans les résumés (cache différentiel : quasi gratuit après la 1re fois)
      _modCache['regions'] ? null : loadCollection(COL.regions).then(arr => { _modCache['regions'] ??= arr.map(d => ({ _docKey: d._id, ...d, id: d.id ?? d._id })); }).catch(() => {}),
      _modCache['items'] ? null : loadCollection(COL.items).then(arr => { _modCache['items'] ??= arr.map(d => ({ _docKey: d._id, ...d, id: d.id ?? d._id })); }).catch(() => {}),
    ]);
    updateCounts();
    renderSubs();
  } catch(e) {
    document.getElementById('submissions-list').innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
  }
};

function updateCounts() {
  const nPending = _st.all.filter(s => s.status === 'pending').length;
  document.getElementById('count-all').textContent      = _st.all.length;
  document.getElementById('count-pending').textContent  = nPending;
  document.getElementById('count-approved').textContent = _st.all.filter(s => s.status === 'approved').length;
  // Title badge
  document.title = nPending > 0 ? `(${nPending}) Modération — VCL` : 'Modération — VCL';
  document.getElementById('count-rejected').textContent           = _st.all.filter(s => s.status === 'rejected').length;
  document.getElementById('count-changes-requested').textContent  = _st.all.filter(s => s.status === 'changes_requested').length;
}

// ── Filters ───────────────────────────────────────────
window.setFilter = (key, val) => {
  showSubmissions();
  if (key === 'status') {
    _st.status = val;
    document.querySelectorAll('.filter-btn[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === val));
  } else {
    _st.type = val;
    const sel = document.getElementById('filter-type-select');
    if (sel) sel.value = val;
  }
  renderSubs();
};

function _buildStatsBar() {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); weekAgo.setHours(0, 0, 0, 0);
  const toDate = ts => { if (!ts) return null; return ts.toDate ? ts.toDate() : new Date(ts); };

  const approvedToday = _st.all.filter(s => { const d = toDate(s.reviewedAt); return s.status === 'approved' && d && d >= today; }).length;
  const approvedWeek  = _st.all.filter(s => { const d = toDate(s.reviewedAt); return s.status === 'approved' && d && d >= weekAgo; }).length;
  const nPending = _st.all.filter(s => s.status === 'pending').length;

  const TYPE_LABELS = { item: 'Items', mob: 'Mobs', pnj: 'PNJ', region: 'Régions', quest: 'Quêtes', panoplie: 'Panoplies' };
  const typeCounts = {};
  for (const s of _st.all.filter(s => s.status === 'pending')) typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  const typeParts = Object.entries(typeCounts).filter(([, n]) => n > 0).map(([t, n]) => `${TYPE_LABELS[t] || t} ${n}`).join(' · ');

  const bar = document.createElement('div');
  bar.style.cssText = 'display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin-bottom:14px;padding:10px 14px;background:var(--surface2,#2a2a3e);border-radius:6px;font-size:12px;color:var(--text-muted,#aaa);border:1px solid var(--border,#333);';
  bar.innerHTML = `<span>📥 En attente : <strong style="color:var(--warn,#f59e0b)">${nPending}</strong></span><span>✅ Approuvées aujourd'hui : <strong style="color:var(--success,#4ade80)">${approvedToday}</strong></span><span>📅 Cette semaine : <strong style="color:var(--success,#4ade80)">${approvedWeek}</strong></span>${typeParts ? `<span style="margin-left:auto;opacity:.75">⏳ ${typeParts}</span>` : ''}`;
  return bar;
}

function renderSubs() {
  const list = document.getElementById('submissions-list');
  let subs = _st.all;
  if (_st.status !== 'all') subs = subs.filter(s => s.status === _st.status);
  if (_st.type   !== 'all') subs = subs.filter(s => s.type === _st.type);
  if (_st.search) {
    const q = normalize(_st.search);
    subs = subs.filter(s =>
      fuzzyMatch(q, s.data?.name || s.data?.titre || s.data?.label || '') ||
      fuzzyMatch(q, s.data?.id || '')
    );
  }

  list.innerHTML = '';
  list.appendChild(_buildStatsBar());

  if (!subs.length) {
    list.insertAdjacentHTML('beforeend', '<div class="empty">Aucune soumission dans cette catégorie.</div>');
    return;
  }

  const bulkBar = document.createElement('div');
  bulkBar.style.cssText = 'display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;';

  if (_st.status === 'pending') {
    const approveAllBtn = document.createElement('button');
    approveAllBtn.className = 'btn';
    approveAllBtn.style.cssText = 'font-size:12px;background:var(--success,#4ade80);color:#111;';
    approveAllBtn.textContent = `✅ Tout approuver (${subs.length})`;
    approveAllBtn.addEventListener('click', () => bulkApproveSubs());
    bulkBar.appendChild(approveAllBtn);
  }

  if (_st.status === 'approved' || _st.status === 'rejected') {
    const bulkBtn = document.createElement('button');
    bulkBtn.className = 'btn btn-danger';
    bulkBtn.style.cssText = 'font-size:12px;';
    bulkBtn.textContent = `🗑️ Tout supprimer (${subs.length})`;
    bulkBtn.addEventListener('click', () => bulkDeleteSubs(_st.status));
    bulkBar.appendChild(bulkBtn);
  }

  if (bulkBar.children.length) list.appendChild(bulkBar);

  for (const sub of subs) {
    list.appendChild(buildCard(sub));
  }
}

window.setFilterSearch = (val) => {
  _st.search = val.trim();
  showSubmissions();
  renderSubs();
};

// Ordre canonique des champs pour un affichage stable
const FIELD_ORDER = ['id','name','rarity','category','cat','palier','lvl','twoHanded','sensible',
  'classes','tags','lore','obtain','stats','bonuses','craft','effects','images','inCodex',
  'type','mobType','region','zones','loot','drops','ordre'];

function sortedEntries(obj) {
  const entries = Object.entries(obj);
  entries.sort(([a], [b]) => {
    const ia = FIELD_ORDER.indexOf(a), ib = FIELD_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });
  return entries;
}

function toJSStr(obj, depth = 0) {
  const T = '\t', pad = T.repeat(depth), pad2 = T.repeat(depth + 1);
  if (Array.isArray(obj)) {
    if (!obj.length) return '[]';
    if (obj.every(v => typeof v !== 'object' || v === null)) return '[' + obj.map(v => JSON.stringify(v)).join(', ') + ']';
    return '[\n' + obj.map(v => pad2 + toJSStr(v, depth+1)).join(',\n') + '\n' + pad + ']';
  }
  if (obj !== null && typeof obj === 'object') {
    const entries = sortedEntries(obj);
    if (!entries.length) return '{}';
    const allPrim = entries.every(([,v]) => typeof v !== 'object');
    if (allPrim && entries.length <= 6 && depth > 0) return '{' + entries.map(([k,v]) => `${k}:${JSON.stringify(v)}`).join(', ') + '}';
    return '{\n' + entries.map(([k,v]) => `${pad2}${k}:\t\t${toJSStr(v, depth+1)}`).join(',\n') + '\n' + pad + '}';
  }
  return JSON.stringify(obj);
}

// ── Résumé lisible d'une soumission : champs connus mis en forme à la main, puis TOUS les autres champs ──
const _PRETTY_SKIP = new Set(['_order', 'ordre', '_contributor', '_ts', '_updatedAt', '_id', 'nameHash', 'images', 'image', 'img', 'screenshots']);
const _PRETTY_SHOWN = {
  item:     ['id', 'name', 'quality', 'rarity', 'category', 'palier', 'lvl', 'cat', 'classes', 'set', 'sensible', 'event', 'evolutif', 'stats', 'effects', 'cooldown_apply', 'craft', 'craft_cd', 'craft_qty', 'obtain', 'lore', 'competence', 'tags', 'skill_name', 'skill_rarity'],
  mob:      ['type', 'palier', 'region', 'behavior', 'lore', 'loot'],
  pnj:      ['id', 'name', 'tag', 'type', 'palier', 'region', 'coords', 'craft', 'sells', 'lore', 'instructions', 'underground', 'sensible'],
  region:   ['palier', 'coords', 'inCodex', 'lore'],
  quest:    ['type', 'palier', 'npc', 'zone', 'coords', 'desc', 'objectifs'],
  panoplie: ['bonuses'],
};
const _PRETTY_LABELS = { id: 'ID', name: 'Nom', label: 'Nom', titre: 'Titre', craft: 'Craft', ingredients: 'Ingrédients', tag: 'Type', coords: 'Coords', desc: 'Description', lore: 'Lore', dialogue: 'Dialogue', dialogues: 'Dialogues' };

// id → nom lisible, d'après les collections déjà chargées par la modération
function _prettyName(id) {
  for (const col of ['items', 'mobs', 'personnages', 'quetes', 'panoplies', 'regions']) {
    const hit = (_modCache[col] || []).find(x => (x.id || x._id) === id);
    if (hit) return hit.name || hit.label || hit.titre || null;
  }
  return null;
}
function _prettyId(id, esc) {
  const n = _prettyName(id);
  const code = `<code style="font-size:10px;color:var(--muted);background:rgba(255,255,255,.05);border-radius:3px;padding:1px 5px;">${esc(String(id))}</code>`;
  return n && n !== id ? `${esc(n)} ${code}` : esc(String(id));
}
function _prettyVal(v, esc, depth = 0) {
  if (v == null || v === '' || v === false) return '';
  if (v === true) return '✓';
  if (typeof v !== 'object') return esc(String(v)).replace(/\n/g, '<br>');
  if (Array.isArray(v)) {
    const items = v.filter(x => x != null && x !== '' && x !== false);
    if (!items.length) return '';
    if (items.every(x => typeof x !== 'object')) {
      return items.map(x => `<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 5px;">${esc(String(x))}</span>`).join(' ');
    }
    const chip = depth > 0; // listes imbriquées (ex. ingrédients) : en pastilles ; listes de premier niveau : une ligne par entrée
    return `<div style="display:flex;${chip ? 'flex-wrap:wrap;' : 'flex-direction:column;'}gap:3px;">${items.map(x =>
      `<div style="${chip ? 'background:var(--surface3);border-radius:4px;padding:1px 6px;font-size:11px;' : ''}">${_prettyVal(x, esc, depth + 1)}</div>`).join('')}</div>`;
  }
  const parts = [];
  const qty = v.qty ?? v.qte;
  if (typeof v.id === 'string') parts.push((qty != null ? `<b>×${esc(String(qty))}</b> ` : '') + _prettyId(v.id, esc));
  for (const [k, x] of Object.entries(v)) {
    if (_PRETTY_SKIP.has(k) || k === 'qty' || k === 'qte' || (k === 'id' && typeof x === 'string')) continue;
    const s = _prettyVal(x, esc, depth + 1);
    if (s) parts.push(`<span style="color:var(--muted);font-size:10px;">${esc(_PRETTY_LABELS[k] || k.replace(/_/g, ' '))}</span> ${s}`);
  }
  return parts.join(' <span style="color:var(--muted);">·</span> ');
}

// ── Fiche PNJ « comme sur le wiki » : en-tête, Fabrique, Marchande, Description, Accès ──
function _wikiItem(id, esc, right = '') {
  if (id === 'cols') { // la monnaie n'est pas un item
    return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;"><span style="width:22px;text-align:center;flex-shrink:0;">🪙</span><span style="color:#d7af5f;font-weight:600;">Cols</span>${right}</div>`;
  }
  const it =(_modCache['items'] || []).find(x => (x.id || x._id) === id) || null;
  const name = it?.name || id;
  const color = it && typeof getRarityColor === 'function' ? getRarityColor(it.rarity) : '#8c8c8c';
  const img = it && typeof getItemImg === 'function' ? getItemImg(it) : null;
  const icon = img
    ? `<img src="${esc(img)}" alt="" style="width:22px;height:22px;object-fit:contain;flex-shrink:0;" onerror="this.style.display='none'">`
    : `<span style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;margin:0 7px;"></span>`;
  const unknown = it ? '' : ' <span title="Item introuvable dans le wiki" style="font-size:10px;color:#f59e0b;">⚠</span>';
  return `<div style="display:flex;align-items:center;gap:8px;padding:2px 0;font-size:12px;">${icon}<span style="color:${color};font-weight:600;">${esc(name)}</span>${unknown}${right}</div>`;
}


function _pnjWikiSummary(d, esc) {
  const section = (title, body) => `<div style="margin-top:10px;"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border);padding-bottom:3px;margin-bottom:4px;">${title}</div>${body}</div>`;
  const chip = (txt, color) => `<span style="font-size:11px;background:var(--surface3);border:1px solid var(--border);border-radius:12px;padding:2px 9px;${color ? `color:${color};` : ''}">${txt}</span>`;
  const badge = (txt, color) => `<span style="margin-left:auto;font-size:11px;font-weight:700;color:${color};border:1px solid ${color}55;border-radius:10px;padding:0 8px;">${txt}</span>`;

  const typeLabel = d.type || (d.tag ? String(d.tag).replace(/_/g, ' ') : '');
  let html = `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:7px;">
    <span style="font-size:15px;font-weight:700;color:var(--accent);">${esc(d.name || d.id || '—')}</span>
    ${typeLabel ? chip('🧑 ' + esc(typeLabel)) : ''}
    ${d.palier != null && d.palier !== '' ? chip('Palier ' + (d.palier == -1 ? 'Archive' : d.palier)) : ''}
    ${d.region ? chip('📍 ' + esc(_regionName(d.region))) : ''}
    ${d.coords ? chip(`X ${esc(d.coords.x)} · Y ${esc(d.coords.y)} · Z ${esc(d.coords.z)}`) : ''}
    ${d.underground ? chip('⛏️ Souterrain') : ''}
    ${d.sensible ? chip('🔒 Sensible', '#f87171') : ''}
    ${d.id ? `<code style="font-size:10px;color:var(--muted);margin-left:auto;">${esc(d.id)}</code>` : ''}
  </div>`;

  if (Array.isArray(d.craft) && d.craft.length) {
    const rows = d.craft.map(r => {
      const timer = r.time ? badge('⏱ ' + esc(String(r.time)), 'var(--muted)') : '';
      const star = r.quality ? ' <span title="Version qualité" style="color:#d7af5f;">✦</span>' : '';
      const ings = (r.ingredients || []).map(i => _wikiItem(i.id, esc, badge('×' + esc(String(i.qty ?? 1)), '#8c8c8c'))).join('');
      return `<div style="display:grid;grid-template-columns:minmax(190px,1fr) 2fr;gap:12px;padding:6px 0;border-bottom:1px solid var(--border);">
        <div>${_wikiItem(r.id, esc, star + timer)}</div>
        <div style="border-left:2px solid var(--border);padding-left:10px;">${ings || '<i style="color:var(--muted);font-size:11px;">Aucun ingrédient</i>'}</div>
      </div>`;
    }).join('');
    html += section('Fabrique', rows);
  }

  if (Array.isArray(d.sells) && d.sells.length) {
    const rows = d.sells.map(s => {
      const price = s.price != null ? badge('Vente ' + esc(String(s.price)) + ' cols', '#4ade80') : '';
      const buy = s.buy != null ? badge('Achat ' + esc(String(s.buy)) + ' cols', '#60a5fa') : '';
      return _wikiItem(s.id, esc, (s.quality ? ' <span style="color:#d7af5f;">✦</span>' : '') + price + buy);
    }).join('');
    html += section('Marchande', rows);
  }

  if (d.lore) html += section('Description', `<div style="font-style:italic;color:var(--muted);font-size:12px;line-height:1.5;">${esc(d.lore).replace(/\n/g, '<br>')}</div>`);
  if (d.instructions) html += section('📍 Accès', `<div style="font-size:12px;line-height:1.5;">${esc(d.instructions).replace(/\n/g, '<br>')}</div>`);
  return html;
}

function _buildPrettySummary(data, type) {
  const esc = window.VCL.escHtml;
  const RARITY_COLORS = { commun:'#4ade80', rare:'#60a5fa', epique:'#a78bfa', legendaire:'#e8d44a', mythique:'#f5b5e4', godlike:'#f87171', event:'#e2e8f0' };
  const RARITY_LABELS = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Event' };
  const CAT_LABELS    = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire', consommable:'🧪 Consommable', nourriture:'🍖 Nourriture', parchemin:'📃 Parchemin', materiaux:'🧱 Matériaux', ressources:'⛏️ Ressources', outils:'🛠️ Outils', rune:'🔮 Rune', quete:'📜 Quête', donjon:'🏰 Donjon', monnaie:'🪙 Monnaie' };

  const rows = [];
  const field = (label, val, color) => {
    if (val == null || val === '' || val === false) return;
    rows.push(`<div style="display:flex;gap:6px;align-items:baseline;font-size:12px;padding:2px 0;">
      <span style="color:var(--muted);min-width:90px;flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;">${esc(label)}</span>
      <span style="color:${color||'var(--text)'};word-break:break-word;">${val}</span>
    </div>`);
  };

  // Ligne « id caché │ valeur affichée » : l'id n'est montré que s'il diffère de la valeur affichée
  const idCode = id => `<code style="font-size:10px;color:var(--muted);background:rgba(255,255,255,.05);border-radius:3px;padding:1px 5px;">${esc(String(id))}</code>`;
  const idPair = (id, shown) => {
    const plain = String(shown).replace(/<[^>]*>/g, '').trim();
    if (id == null || id === '' || plain === String(id).trim()) return shown;
    return `${idCode(id)}<span style="color:var(--rim2);margin:0 6px;">│</span>${shown}`;
  };
  const SLOT_LABELS = { arme_p:'Arme Principale', arme_s:'Arme Secondaire / Bouclier', anneau:'Anneau', amulette:'Amulette', bracelet:'Bracelet', artefact:'Artefact', gants:'Gants', casque:'Casque', plastron:'Plastron', 'jambières':'Jambières', bottes:'Bottes' };
  const statDef  = id => (typeof ALL_STATS !== 'undefined' ? ALL_STATS.find(x => x.id === id) : null);
  const itemName = id => ((_modCache['items'] || []).find(i => (i.id || i._id) === id) || {}).name;

  if (type === 'item') {
    const rarColor = RARITY_COLORS[data.rarity] || 'var(--muted)';
    if (data.name) field('Nom', `<b style="font-size:13px;">${esc(data.name)}</b>${data.quality ? ' <span style="font-size:10px;font-weight:700;color:#34d399;border:1px solid rgba(52,211,153,.4);border-radius:10px;padding:1px 7px;">✦ Qualité</span>' : ''}${data.id ? ' ' + idCode(data.id) : ''}`, rarColor);
    if (data.rarity)   field('Rareté',   idPair(data.rarity, `<span style="font-weight:700;">${RARITY_LABELS[data.rarity]||data.rarity}</span>`), rarColor);
    if (data.category) field('Catégorie', idPair(data.category, esc(CAT_LABELS[data.category]||data.category)));
    if (data.palier != null && data.palier !== '') field('Palier',   idPair(data.palier, data.palier == 'event' ? 'Event' : 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier)));
    if (data.lvl)      field('Niveau',   idPair(data.lvl, 'Niveau ≥ ' + data.lvl));
    if (data.cat)      field('Slot',     idPair(data.cat, esc(SLOT_LABELS[data.cat] || data.cat)));
    if (data.classes?.length) field('Classes', data.classes.map(c => idPair(c, esc((typeof CLASSES !== 'undefined' && CLASSES.find(x => x.id === c)?.label) || c))).join(' &nbsp; '));
    if (data.set) {
      const pano = (_modCache['panoplies'] || []).find(p => p.id === data.set);
      field('Set', idPair(data.set, esc(pano?.label || data.set)), '#d7af5f');
    }
    if (data.sensible) field('', '🔒 Sensible', '#f87171');
    // Le champ « event » (quel évènement) n'a de sens que dans le palier Event
    if (data.palier === 'event') field('Évènement', typeof data.event === 'string' && data.event ? esc(data.event) : '<i style="color:var(--muted)">non renseigné</i>', '#a855f7');
    if (data.evolutif) field('', '🔄 Évolutif', '#60a5fa');
    if (data.stats && Object.keys(data.stats).length) {
      const statLines = Object.entries(data.stats).map(([k, v]) => {
        const val = Array.isArray(v) ? `${v[0]}–${v[1]}` : v;
        const d = statDef(k), unit = d ? d.unit : '';
        return `<span style="background:rgba(224,172,96,.12);border:1px solid rgba(224,172,96,.2);border-radius:4px;padding:1px 6px;font-size:11px;">${idPair(k, esc(d ? d.label : k))} <b>${val}${esc(unit)}</b></span>`;
      }).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Stats</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${statLines}</div>`);
    }
    // Effets (consommables) : une ligne par effet, comme sur le wiki ; recharge et utilisations regroupées dans « Utilisation »
    if (Array.isArray(data.effects) && data.effects.length) {
      const fmtDur = sec => { const n = +sec; if (!isFinite(n) || n <= 0) return ''; if (n % 3600 === 0) return (n / 3600) + ' h'; if (n % 60 === 0) return (n / 60) + ' min'; return n + ' s'; };
      const meta = t => (typeof EFFECT_META !== 'undefined' && EFFECT_META[t]) || { icon: '◆', color: '#aaa', label: t, prefix: '' };
      const real = data.effects.filter(e => e && !['cooldown', 'use', 'level'].includes(e.type));
      const cd = data.effects.find(e => e && e.type === 'cooldown'), use = data.effects.find(e => e && e.type === 'use');
      if (real.length) {
        const eff = real.map(e => {
          const m = meta(e.type), col = e.color || m.color;
          const val = `${e.prefix ?? m.prefix ?? ''}${e.value ?? ''}${e.unit ? ' ' + String(e.unit).trim() : ''}`;
          const dur = e.instant ? 'Instantané' : fmtDur(e.duration);
          return `<div style="display:flex;align-items:center;gap:8px;font-size:12px;padding:2px 0;"><span style="width:20px;text-align:center;">${esc(e.icon || m.icon)}</span><span style="color:${col};font-weight:600;">${esc(val)}</span>${dur ? `<span style="font-size:10px;color:var(--muted);background:var(--surface3);border-radius:10px;padding:1px 7px;">⏳ ${esc(dur)}</span>` : ''}<span style="font-size:10px;color:var(--muted);">${idCode(e.type)}</span></div>`;
        }).join('');
        rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Effets</div><div style="margin-bottom:2px;">${eff}</div>`);
      }
      const ac = data.cooldown_apply;
      if (cd || use || (ac && ac.value > 0)) {
        const chips = [];
        if (cd) chips.push(`<span style="background:rgba(244,114,182,.12);border:1px solid rgba(244,114,182,.3);color:#f472b6;border-radius:4px;padding:1px 7px;font-size:11px;">⏱ Recharge <b>${esc(fmtDur(cd.value) || cd.value + ' s')}</b></span>`);
        if (use) chips.push(`<span style="background:var(--surface3);border-radius:4px;padding:1px 7px;font-size:11px;">🧪 <b>${esc(String(use.value))}</b> utilisation${use.value > 1 ? 's' : ''}</span>`);
        const apply = (ac && ac.value > 0) ? `<div style="font-size:11px;color:var(--muted);margin-top:3px;">↳ ${esc(ac.lead || 'À la consommation, applique')} <b style="color:#f0a030;">${esc(fmtDur(ac.value))}</b> de recharge sur ${esc(ac.target || 'les objets du même type')}</div>` : '';
        rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Utilisation</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${chips.join('')}</div>${apply}`);
      }
    }
    if (data.craft?.length) {
      const craftLines = data.craft.map(c => c && c.id === 'cols'
        ? `<span style="background:rgba(201,168,76,.12);border:1px solid rgba(201,168,76,.3);color:#c9a84c;border-radius:4px;padding:1px 6px;font-size:11px;">🪙 <b>${esc(String(c.qty))}</b> cols</span>`
        : `<span style="background:var(--surface3);border-radius:4px;padding:1px 6px;font-size:11px;"><b>×${c.qty}</b> ${idPair(c.id, esc(itemName(c.id) || c.id))}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Craft${data.craft_qty > 1 ? ` <span style="text-transform:none;letter-spacing:0;font-weight:400;">· ×${esc(String(data.craft_qty))} par craft</span>` : ''}${data.craft_cd ? ` <span style="text-transform:none;letter-spacing:0;font-weight:400;">· ⏱ ${esc(String(data.craft_cd))}</span>` : ''}</div><div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:2px;">${craftLines}</div>`);
    }
    {
      const raw = data.obtain || '';
      const resolved = resolveObtain(raw);
      field('Obtention', raw
        ? idPair(raw.replace(/\n/g, ' ⏎ '), esc(resolved).replace(/\n/g, '<br>'))
        : '<i style="color:var(--muted)">Aucune source renseignée</i>');
    }
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.competence) field('Compétence', esc(data.competence).replace(/\n/g,'<br>'));
    if (data.tags?.length) field('Tags', data.tags.map(t=>`<span style="font-size:10px;background:var(--surface3);border-radius:3px;padding:1px 5px;">${esc(t)}</span>`).join(' '));
  } else if (type === 'mob') {
    if (data.type)    field('Type',     data.type);
    if (data.palier)  field('Palier',   'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.region)  field('Région',   esc(_regionName(data.region)));
    if (data.behavior)field('Comportement', data.behavior);
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
    if (data.loot?.length) {
      const lootLines = data.loot.map(l => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${esc(l.id)} <b style="color:var(--success)">${l.chance}%</b></span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Loot</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${lootLines}</div>`);
    }
  } else if (type === 'pnj') {
    rows.push(_pnjWikiSummary(data, esc));
  } else if (type === 'region') {
    if (data.palier)  field('Palier', 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.inCodex) field('Codex',  '✓ Dans le Codex', 'var(--success)');
    if (data.lore)    field('Lore', `<i style="color:var(--muted)">${esc(data.lore).slice(0,200)}${data.lore.length>200?'…':''}</i>`);
  } else if (type === 'quest') {
    const QUEST_TYPE_LABELS = { main:'⚔️ Principale', sec:'🗺️ Secondaire', fu:'📋 Fractured Underworld' };
    if (data.type)    field('Type',   QUEST_TYPE_LABELS[data.type]||data.type);
    if (data.palier)  field('Palier', 'Palier ' + (data.palier == -1 ? 'Archive' : data.palier));
    if (data.npc)     field('PNJ',    data.npc);
    if (data.zone)    field('Zone',   data.zone);
    if (data.coords)  field('Coords', `X:${data.coords.x} Y:${data.coords.y} Z:${data.coords.z}`);
    if (data.desc)    field('Desc',   `<i style="color:var(--muted)">${esc(data.desc).slice(0,200)}</i>`);
    if (data.objectifs?.length) {
      const objLines = data.objectifs.map(o => {
        let line = `<div style="font-size:11px;display:flex;gap:5px;"><span style="color:var(--accent);">◻</span><span>${esc(o.texte||'—')}</span></div>`;
        if (o.location?.x != null || o.location?.z != null) line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">📍 X ${o.location?.x ?? '?'} · Z ${o.location?.z ?? '?'}</div>`;
        if (o.items?.length) o.items.forEach(it => { line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">→ item: <code>${esc(it.id||it.itemId||'?')}</code> ×${it.qte||1}</div>`; });
        if (o.mobs?.length)  o.mobs.forEach(m  => { line += `<div style="font-size:10px;color:var(--muted);padding-left:14px;">→ mob: <code>${esc(m.id||m.mobId||'?')}</code> ×${m.qte||1}</div>`; });
        return line;
      }).join('');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Objectifs</div><div style="display:flex;flex-direction:column;gap:1px;">${objLines}</div>`);
    }
  } else if (type === 'panoplie') {
    if (data.bonuses?.length) {
      const bonLines = data.bonuses.map(b => `<span style="font-size:11px;background:var(--surface3);border-radius:4px;padding:1px 6px;">${b.pieces}×: ${esc(b.stat)} +${b.value}</span>`).join(' ');
      rows.push(`<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-top:4px;">Bonus</div><div style="display:flex;flex-wrap:wrap;gap:4px;">${bonLines}</div>`);
    }
  }

  // Tous les autres champs de la soumission, tels quels (ids résolus en noms quand on les connaît)
  const shown = new Set(_PRETTY_SHOWN[type] || []);
  const n0 = rows.length;
  for (const [k, v] of Object.entries(data || {})) {
    if (shown.has(k) || _PRETTY_SKIP.has(k)) continue;
    const s = _prettyVal(v, esc);
    if (s) field(_PRETTY_LABELS[k] || k.replace(/_/g, ' '), s);
  }
  if (rows.length > n0 && n0 > 0) {
    rows.splice(n0, 0, '<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin:8px 0 2px;border-top:1px solid var(--border);padding-top:6px;">Autres informations</div>');
  }

  if (!rows.length) return '';
  return `<div style="padding:8px 10px;background:var(--surface2);border-radius:6px;border:1px solid var(--border);">${rows.join('')}</div>`;
}

function buildCard(sub) {
  const card = document.createElement('div');
  card.className = `sub-card status-${sub.status}`;
  card.id = `card-${sub._id}`;

  const typeLabels = { item:'⚔️ Item', mob:'👾 Mob', pnj:'🧑 PNJ', region:'📍 Région', quest:'📜 Quête', panoplie:'🔗 Panoplie' };
  const name = sub.data?.titre || sub.data?.name || sub.data?.label || sub._id;
  const ts   = sub.submittedAt?.toDate ? sub.submittedAt.toDate().toLocaleString('fr-FR') : '—';
  const code = toJSStr(sub.data || {}, 0) + ',';

  const statusLabel = { pending:'⏳ En attente', approved:'✓ Approuvé', rejected:'✕ Rejeté', changes_requested:'💬 Modif. demandées' }[sub.status] || sub.status;

  let actionsHtml = '';
  let editorHtml  = '';
  if (sub.status === 'pending' || sub.status === 'changes_requested') {
    editorHtml = `
      <div class="sub-editor" id="editor-${sub._id}">
        <textarea class="sub-editor-ta" id="editor-ta-${sub._id}" spellcheck="false" oninput="onEditorInput('${sub._id}')"></textarea>
        <div class="sub-editor-err" id="editor-err-${sub._id}"></div>
        <div class="sub-editor-status" id="editor-status-${sub._id}"></div>
      </div>
    `;
    const changeNotice = sub.status === 'changes_requested' && sub.changeRequestComment
      ? `<div style="margin-bottom:6px;padding:8px 10px;background:rgba(245,158,11,.12);border-left:3px solid var(--warn,#f59e0b);border-radius:4px;font-size:12px;color:var(--warn,#f59e0b);">💬 ${escHtml(sub.changeRequestComment)}</div>`
      : '';
    actionsHtml = `
      ${changeNotice}
      <input type="text" class="sub-comment" id="comment-${sub._id}" placeholder="Commentaire (optionnel)">
      <button class="btn btn-ghost"   id="btn-edit-${sub._id}" onclick="toggleEdit('${sub._id}')" style="font-size:12px;">✏️ Modifier</button>
      <button class="btn btn-ghost"   onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre cette soumission dans le Creator pour l'éditer">⚙️ Creator</button>
      <button class="btn btn-ghost"   id="btn-verify-${sub._id}" onclick="verifySubmission('${sub._id}')" style="font-size:12px;" title="Lit les captures jointes (gratuit, dans ton navigateur) et compare avec les champs saisis">🔍 Vérifier</button>
      <button class="btn btn-ghost"   onclick="requestChanges('${sub._id}')" style="font-size:12px;color:var(--warn,#f59e0b);">💬 Demander modifs</button>
      <button class="btn btn-approve" onclick="approve('${sub._id}')">✓ Approuver</button>
      <button class="btn btn-reject"  onclick="reject('${sub._id}')">✕ Rejeter</button>
    `;
  } else if (sub.status === 'rejected') {
    actionsHtml = `
      ${sub.comment ? `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>` : ''}
      <button class="btn btn-ghost" onclick="restorePending('${sub._id}')" style="font-size:12px;">🔄 Remettre en attente</button>
      <button class="btn btn-ghost" onclick="openInCreator('${sub._id}')" style="font-size:12px;" title="Ouvre dans le Creator pour corriger">⚙️ Creator</button>
    `;
  } else if (sub.comment) {
    actionsHtml = `<div class="review-comment">💬 ${escHtml(sub.comment)}</div>`;
  }

  const modBadge = sub.isModification
    ? `<span class="sub-type" style="background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);">✏️ Modif</span>`
    : `<span class="sub-type" style="background:rgba(74,222,128,.12);color:var(--success);border:1px solid rgba(74,222,128,.3);">✨ Ajout</span>`;
  const chasseBadge = sub.fromTableauDeChasse
    ? `<span class="sub-type" style="background:rgba(215,175,95,.12);color:#d7af5f;border:1px solid rgba(215,175,95,.3);" title="Soumission issue du tableau de chasse">🎯 Chasse</span>`
    : '';

  const preservedHtml = '';

  const playerCommentHtml = sub.submitter_comment
    ? `<div style="margin:4px 0 6px;padding:6px 10px;background:rgba(215,175,95,.08);border:1px solid rgba(215,175,95,.25);border-radius:6px;font-size:12px;color:#d7af5f;">💬 ${escHtml(sub.submitter_comment)}</div>`
    : '';

  card.innerHTML = `
    <div class="sub-head">
      <span class="sub-type">${typeLabels[sub.type] || sub.type}</span>
      ${modBadge}
      ${chasseBadge}
      <span class="sub-name">${escHtml(name)}</span>
      <span class="sub-meta">${ts}</span>
      <span class="sub-meta">par <b>${escHtml(userName(sub.submittedBy, sub.submitterName))}</b></span>
      <span class="sub-status ${sub.status}">${statusLabel}</span>
    </div>
    ${preservedHtml}
    ${playerCommentHtml}
    <div class="sub-body">
      <div class="sub-actions">
        ${actionsHtml}
        <button class="btn btn-copy" onclick="copyCode('${sub._id}')">📋 Copier</button>
        <button class="btn-toggle" onclick="toggleDetails('${sub._id}', this)">▾ Voir</button>
      </div>
      <div class="sub-details" id="details-${sub._id}">
        ${sub.data?.id ? `<div id="diff-${sub._id}" style="margin-bottom:10px;"><button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="loadSubDiff('${sub._id}','${sub.type}','${String(sub.data?.id||'')}')">${sub.isModification ? '🔍 Voir les changements' : '🔍 Comparer avec item existant'}</button></div>` : ''}
        <div id="pretty-${sub._id}">${_buildPrettySummary(sub.data || {}, sub.type)}</div>
        <div id="screens-${sub._id}"></div>
        <details style="margin-top:6px;">
          <summary style="font-size:10px;color:var(--muted);cursor:pointer;user-select:none;padding:3px 0;">⟨⟩ JSON brut</summary>
          <div class="sub-code" id="code-${sub._id}">${escHtml(code)}</div>
        </details>
        ${editorHtml}
      </div>
    </div>
  `;

  // Afficher les screenshots soumis (nouveau: sub.screenshots[], legacy: sub.forum_image)
  const allScreens = sub.screenshots?.length ? sub.screenshots
    : sub.forum_image ? [sub.forum_image]
    : [];
  if (allScreens.length) {
    const wrap = card.querySelector(`#screens-${sub._id}`);
    if (wrap) {
      wrap.style.cssText = 'margin-top:8px;display:flex;flex-wrap:wrap;gap:8px;';
      allScreens.forEach(src => {
        const img = document.createElement('img');
        img.style.cssText = 'max-height:180px;max-width:100%;border-radius:6px;border:1px solid var(--border);cursor:zoom-in;object-fit:contain;background:var(--surface2);';
        img.src = src;
        img.onclick = e => { e.stopPropagation(); openLightbox(src); };
        wrap.appendChild(img);
      });
    }
  }

  return card;
}


// Collections de fallback pour les documents sensibles (fusionnées si plusieurs)
const _SUB_FALLBACK_COLS = { item: ['items_hidden', 'items_secret'], mob: ['mobs_secret'], pnj: ['pnj_secret'] };
const _diffDataStore = new Map(); // subId → { current, proposed }

// Champs dont l'ordre de tableau est non significatif
const _UNORDERED_ARRAY_FIELDS = new Set(['stats','craft','effects','bonuses','tags','classes','images','loot','drops','zones','objectifs','recompenses']);
// Champs à ignorer dans le diff (régénérés ou gérés en interne lors de l'approbation)
const _DIFF_SKIP_FIELDS = new Set(['_order','ordre','_contributor','_ts','images','image','img','nameHash']);

function _diffValue(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v, null, 1);
  return String(v);
}

// Sérialisation canonique : trie les clés d'objets (insensible à l'ordre des clés),
// préserve l'ordre des éléments d'un tableau (sauf si on l'appelle via _canonicalArr).
function _canonicalJSON(v) {
  if (Array.isArray(v)) return '[' + v.map(_canonicalJSON).join(',') + ']';
  if (v !== null && typeof v === 'object') {
    const entries = Object.entries(v).sort(([a], [b]) => a.localeCompare(b));
    return '{' + entries.map(([k, val]) => JSON.stringify(k) + ':' + _canonicalJSON(val)).join(',') + '}';
  }
  return JSON.stringify(v);
}

// Pour les champs de type tableau non-ordonné : trie aussi les éléments du tableau.
function _canonicalArr(arr) {
  return [...arr].map(_canonicalJSON).sort().join('\x00');
}

function _renderDiffView(subId, current, proposed) {
  const allKeys = new Set([...Object.keys(current), ...Object.keys(proposed)]);
  const sorted = [...allKeys].sort((a, b) => {
    const ia = FIELD_ORDER.indexOf(a), ib = FIELD_ORDER.indexOf(b);
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    return a.localeCompare(b);
  });

  const rows = [];
  for (const k of sorted) {
    if (k.startsWith('_') || _DIFF_SKIP_FIELDS.has(k)) continue;
    const hasOld = k in current, hasNew = k in proposed;
    let equal = false;
    if (hasOld && hasNew) {
      if (_UNORDERED_ARRAY_FIELDS.has(k) && Array.isArray(current[k]) && Array.isArray(proposed[k])) {
        // Tableau non-ordonné : compare sans tenir compte de l'ordre des éléments
        equal = _canonicalArr(current[k]) === _canonicalArr(proposed[k]);
      } else {
        // Comparaison canonique : insensible à l'ordre des clés d'objets
        equal = _canonicalJSON(current[k]) === _canonicalJSON(proposed[k]);
      }
    }
    if (!hasOld && hasNew)      rows.push({ k, kind:'added',   old:null,       new:proposed[k] });
    else if (hasOld && !hasNew) rows.push({ k, kind:'removed', old:current[k], new:null });
    else if (!equal)            rows.push({ k, kind:'changed', old:current[k], new:proposed[k] });
  }

  if (!rows.length) return '<div style="font-size:12px;color:var(--muted);padding:6px 0;">Aucune différence détectée entre la version actuelle et la proposition.</div>';

  const pal = {
    added:   { bg:'rgba(74,222,128,.08)',  bd:'rgba(74,222,128,.35)',  ic:'✚', col:'var(--success)' },
    removed: { bg:'rgba(248,113,113,.08)', bd:'rgba(248,113,113,.35)', ic:'✕', col:'var(--danger)'  },
    changed: { bg:'rgba(245,158,11,.08)',  bd:'rgba(245,158,11,.35)',  ic:'~', col:'#f59e0b'         },
  };

  const safe = subId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const rowsHtml = rows.map((r, ri) => {
    const p = pal[r.kind];
    let content;
    if (r.kind === 'changed') {
      content = `<span style="color:var(--danger);text-decoration:line-through;opacity:.7;word-break:break-all;">${escHtml(_diffValue(r.old))}</span>
                 <span style="color:var(--muted);margin:0 4px;">→</span>
                 <span style="color:var(--success);word-break:break-all;">${escHtml(_diffValue(r.new))}</span>`;
    } else if (r.kind === 'added') {
      content = `<span style="color:var(--success);word-break:break-all;">${escHtml(_diffValue(r.new))}</span>`;
    } else {
      content = `<span style="color:var(--danger);opacity:.8;word-break:break-all;">${escHtml(_diffValue(r.old))}</span>`;
    }
    return `<div data-diff-key="${escHtml(r.k)}" data-diff-kind="${r.kind}" style="display:flex;gap:8px;padding:5px 10px;background:${p.bg};border-left:3px solid ${p.bd};margin-bottom:3px;border-radius:0 4px 4px 0;align-items:center;flex-wrap:wrap;">
      <input type="checkbox" id="diffck-${safe}-${ri}" checked title="Cocher = accepter ce changement" style="flex-shrink:0;cursor:pointer;width:14px;height:14px;accent-color:var(--accent);">
      <span style="font-size:12px;font-weight:700;color:${p.col};width:14px;text-align:center;flex-shrink:0;">${p.ic}</span>
      <span style="font-size:11px;font-weight:700;color:var(--muted);min-width:70px;flex-shrink:0;">${escHtml(r.k)}</span>
      <span style="font-size:12px;flex:1;min-width:0;">${content}</span>
    </div>`;
  }).join('');

  return `<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;" id="diff-view-${safe}">
    <div style="padding:6px 10px;background:var(--surface2);font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:flex;align-items:center;gap:10px;">
      <span>${rows.length} champ${rows.length > 1 ? 's' : ''} modifié${rows.length > 1 ? 's' : ''}</span>
      <span style="font-weight:400;">
        <span style="color:var(--success);">✚</span> ajouté ·
        <span style="color:#f59e0b;">~</span> modifié ·
        <span style="color:var(--danger);">✕</span> supprimé
      </span>
      <span style="font-size:10px;color:var(--muted);font-weight:400;">☑ = accepter le changement</span>
    </div>
    <div style="padding:8px;">${rowsHtml}</div>
    <div style="padding:6px 10px;background:var(--surface2);border-top:1px solid var(--border);display:flex;gap:8px;align-items:center;">
      <button class="btn btn-ghost btn-sm" style="font-size:11px;" onclick="applyDiffSelection('${subId}')">✔ Appliquer la sélection à la soumission</button>
      <span style="font-size:11px;color:var(--muted);">Les changements non cochés seront revertés à la valeur actuelle.</span>
    </div>
  </div>`;
}

window.loadSubDiff = async function(subId, type, docId) {
  const el = document.getElementById(`diff-${subId}`);
  if (!el) return;
  el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Chargement du diff…</div>';
  const colName = _SUB_COL_MAP[type];
  if (!colName || !docId) {
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Impossible de charger le diff (ID ou type manquant).</div>';
    return;
  }
  try {
    const snap = await getDoc(doc(db, colName, String(docId)));
    let current = snap.exists() ? snap.data() : null;

    if (!current) {
      // Fallback : collections sensibles (items_hidden + items_secret, mobs_secret, pnj_secret)
      const fallbacks = _SUB_FALLBACK_COLS[type] || [];
      for (const fbCol of fallbacks) {
        const fb = await getDoc(doc(db, fbCol, String(docId)));
        if (fb.exists()) current = current ? { ...current, ...fb.data() } : fb.data();
      }
    }

    if (!current) {
      el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:4px 0;">Document original introuvable — traité comme ajout.</div>';
      return;
    }
    const sub = _st.all.find(s => s._id === subId);
    if (!sub) return;
    let proposed = sub.data || {};
    // Modification d'item sensible : les champs items_secret absents de la soumission
    // seront préservés à l'approbation → les refléter dans le proposed du diff
    if (sub.isModification && type === 'item' && sub.data?.sensible) {
      const gameplayKeys = await getItemGameplayKeys().catch(() => []);
      const merged = { ...proposed };
      for (const [k, v] of Object.entries(current)) {
        if (k.startsWith('_') || k === 'sensible' || k === 'nameHash') continue;
        if (gameplayKeys.includes(k)) continue; // gameplay : pas de merge (soumission fait foi)
        if (!(k in merged)) merged[k] = v;
      }
      proposed = merged;
    }
    _diffDataStore.set(subId, { current, proposed });
    el.innerHTML = _renderDiffView(subId, current, proposed);
  } catch(e) {
    el.innerHTML = `<div style="font-size:12px;color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
};

window.applyDiffSelection = async function(subId) {
    const stored = _diffDataStore.get(subId);
    if (!stored) { toast('Erreur: Diff non chargé', 'error'); return; }

    const { current, proposed } = stored;
    
    // On clone la proposition (qui contient tes onglets base + quality)
    let merged = JSON.parse(JSON.stringify(proposed));

    // On applique les modifs des cases à cocher
    const diffEl = document.getElementById(`diff-${subId}`);
    if (diffEl) {
        const rows = diffEl.querySelectorAll('[data-diff-key]');
        rows.forEach(row => {
            const k = row.dataset.diffKey;
            const cb = row.querySelector('input[type=checkbox]');
            if (cb && !cb.checked) {
                // Si décoché, on remet la valeur de 'current'
                merged[k] = current[k];
                if (current[k] === undefined) delete merged[k];
            }
        });
    }

    // Sécurité Coordonnées / ID
    if (current.coords && !merged.coords) merged.coords = current.coords;
    if (current.id && !merged.id) merged.id = current.id;

    try {
        const cleaned = sanitizeForFirestore(merged);
        await updateDoc(doc(db, 'submissions', subId), { data: cleaned });
        
        // Mise à jour de la liste locale pour que tes onglets reflètent le changement
        const idx = _st.all.findIndex(s => s._id === subId);
        if (idx !== -1) _st.all[idx].data = merged;

        toast('✓ Sauvegardé avec succès !');
        renderSubs(); // Rafraîchit l'affichage
    } catch (e) {
        console.error(e);
        toast('Erreur save: ' + e.message, 'error');
    }
};

// ── Copier le code ────────────────────────────────────
// ── Image soumission : voir / changer ─────────────────
async function _applyModImage(id, file) {
  if (!file || !file.type.startsWith('image/')) return;
  const sub = _st.all.find(s => s._id === id);
  if (!sub) return;

  const base64 = await new Promise((res, rej) => {
    const r = new FileReader();
    r.onload  = e => res(e.target.result);
    r.onerror = () => rej();
    r.readAsDataURL(file);
  });

  sub.forum_image = base64;

  const zone        = document.getElementById(`mod-img-zone-${id}`);
  const preview     = document.getElementById(`mod-img-preview-${id}`);
  const placeholder = document.getElementById(`mod-img-placeholder-${id}`);
  const clearBtn    = document.getElementById(`mod-img-clear-${id}`);
  if (zone)        zone.classList.add('has-img');
  if (preview)     {
    preview.src = base64;
    preview.style.display = 'block';
    preview.onclick = e => { e.stopPropagation(); openLightbox(base64); };
  }
  if (placeholder) placeholder.style.display = 'none';
  if (clearBtn)    clearBtn.style.display = '';
}

function openLightbox(src) {
  const lb = document.getElementById('img-lightbox');
  document.getElementById('img-lightbox-img').src = src;
  lb.classList.add('open');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') document.getElementById('img-lightbox')?.classList.remove('open');
});

window.modImgFile = (id, file) => _applyModImage(id, file);

window.modImgDrop = (id, e) => {
  e.preventDefault();
  document.getElementById(`mod-img-zone-${id}`)?.classList.remove('drag-over');
  const file = e.dataTransfer?.files?.[0];
  if (file) _applyModImage(id, file);
};

window.modImgClear = (id) => {
  const sub = _st.all.find(s => s._id === id);
  if (sub) sub.forum_image = null;
  const zone        = document.getElementById(`mod-img-zone-${id}`);
  const preview     = document.getElementById(`mod-img-preview-${id}`);
  const placeholder = document.getElementById(`mod-img-placeholder-${id}`);
  const clearBtn    = document.getElementById(`mod-img-clear-${id}`);
  const input       = document.getElementById(`mod-img-input-${id}`);
  if (zone)        zone.classList.remove('has-img');
  if (preview)     { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (clearBtn)    clearBtn.style.display = 'none';
  if (input)       input.value = '';
};

window.modImgPaste = async (id) => {
  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const mime = item.types.find(t => t.startsWith('image/'));
      if (mime) {
        const blob = await item.getType(mime);
        const ext  = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' }[mime] || 'png';
        await _applyModImage(id, new File([blob], `image.${ext}`, { type: mime }));
        return;
      }
    }
    toast('Pas d\'image dans le presse-papiers.', 'warning');
  } catch(e) {
    toast('Impossible de lire le presse-papiers : ' + e.message, 'error');
  }
};

window.copyCode = (id) => {
  const sub  = _st.all.find(s => s._id === id);
  if (!sub) return;
  const code = toJSStr(sub.data || {}, 0) + ',';
  navigator.clipboard.writeText(code);
};

// ── Toggle détails (code + éditeur) ──────────────────
window.toggleDetails = (id, btn) => {
  const details = document.getElementById(`details-${id}`);
  if (!details) return;
  const open = details.classList.toggle('open');
  btn.textContent = open ? '▴ Masquer' : '▾ Voir';
};

// ── Toggle éditeur inline ─────────────────────────────
window.toggleEdit = async (id) => {
  // S'assurer que les détails sont ouverts avant d'éditer
  const details = document.getElementById(`details-${id}`);
  const toggleBtn = document.querySelector(`#card-${id} .btn-toggle`);
  if (details && !details.classList.contains('open')) {
    details.classList.add('open');
    if (toggleBtn) toggleBtn.textContent = '▴ Masquer';
  }
  const sub     = _st.all.find(s => s._id === id);
  const editor  = document.getElementById(`editor-${id}`);
  const ta      = document.getElementById(`editor-ta-${id}`);
  const codeDiv = document.getElementById(`code-${id}`);
  const btn     = document.getElementById(`btn-edit-${id}`);
  const errDiv  = document.getElementById(`editor-err-${id}`);
  if (!editor || !ta) return;

  const isOpen = editor.classList.contains('open');
  if (isOpen) {
    // Fermer : valider le JSON
    const errMsg = tryParseEdit(id);
    if (errMsg) { errDiv.textContent = errMsg; errDiv.style.display = ''; return; }
    errDiv.style.display = 'none';
    // Mettre à jour l'aperçu
    codeDiv.textContent = toJSStr(sub.data, 0) + ',';
    const prettyDiv = document.getElementById(`pretty-${id}`);
    if (prettyDiv) prettyDiv.innerHTML = _buildPrettySummary(sub.data || {}, sub.type);
    editor.classList.remove('open');
    if (codeDiv) codeDiv.style.display = '';
    btn.textContent = '✏️ Modifier';
    btn.style.background = '';
    // Persister en Firestore pour survivre à un refresh
    try {
      btn.disabled = true;
      await updateDoc(doc(db, 'submissions', id), { data: sub.data });
      const statusEl = document.getElementById(`editor-status-${id}`);
      if (statusEl) { statusEl.textContent = '💾 Sauvegardé'; statusEl.className = 'sub-editor-status ok'; statusEl.style.display = ''; }
    } catch(e) {
      toast('Erreur sauvegarde : ' + e.message, 'error');
    } finally {
      btn.disabled = false;
    }
  } else {
    // Ouvrir : pre-fill JSON
    // L'éditeur prend la place du bloc « JSON brut » déjà déroulé, avec le même format
    const det = codeDiv?.closest('details'); if (det) det.open = true;
    ta.value = toJSStr(sub.data || {}, 0);
    if (codeDiv) { codeDiv.parentNode.insertBefore(editor, codeDiv); codeDiv.style.display = 'none'; }
    editor.classList.add('open');
    ta.style.height = Math.min(Math.max(ta.scrollHeight, 200), 700) + 'px';
    btn.textContent = '✔ Valider';
    btn.style.background = 'rgba(224,172,96,.25)';
    ta.focus();
  }
};

// Accepte le format affiché dans « JSON brut » ({id:"x", sells:[…],}) comme du JSON classique : clés sans guillemets et virgules finales tolérées.
function _parseObjectLiteral(src) {
  let out = '', i = 0, str = false;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (str) {
      out += ch;
      if (ch === '\\') { out += src[i + 1] ?? ''; i += 2; continue; }
      if (ch === '"') str = false;
      i++; continue;
    }
    if (ch === '"') { str = true; out += ch; i++; continue; }
    if (/[A-Za-z_$]/.test(ch)) {                       // identifiant hors chaîne : clé à mettre entre guillemets (sauf true / false / null)
      let j = i; while (j < n && /[\w$]/.test(src[j])) j++;
      const word = src.slice(i, j); let k = j; while (k < n && /\s/.test(src[k])) k++;
      out += (src[k] === ':' && !['true', 'false', 'null'].includes(word)) ? '"' + word + '"' : word;
      i = j; continue;
    }
    out += ch; i++;
  }
  out = out.replace(/,\s*([}\]])/g, '$1').replace(/,\s*$/, '');   // virgules finales (hors chaînes : une virgule suivie de } ou ] n'existe pas dans un texte entre guillemets sans être déjà protégée)
  return JSON.parse(out);
}

function tryParseEdit(id) {
  const sub = _st.all.find(s => s._id === id);
  const ta  = document.getElementById(`editor-ta-${id}`);
  if (!sub || !ta) return null;
  try {
    const parsed = _parseObjectLiteral(ta.value);
    if (typeof parsed !== 'object' || parsed === null) return 'Objet attendu.';
    sub.data = parsed; // mutate in-place → approve() lira la version modifiée
    return null;
  } catch(e) {
    return 'Syntaxe invalide : ' + e.message;
  }
}

// ── Live JSON validation dans l'éditeur inline ────────
window.onEditorInput = (id) => {
  const ta     = document.getElementById(`editor-ta-${id}`);
  const status = document.getElementById(`editor-status-${id}`);
  if (!ta) return;
  try {
    _parseObjectLiteral(ta.value);
    ta.classList.add('json-valid');
    ta.classList.remove('json-invalid');
    if (status) { status.textContent = '✓ Syntaxe valide'; status.className = 'sub-editor-status ok'; }
  } catch(e) {
    ta.classList.add('json-invalid');
    ta.classList.remove('json-valid');
    if (status) { status.textContent = '✕ ' + e.message; status.className = 'sub-editor-status err'; }
  }
};

// ── Ouvrir dans Creator ────────────────────────────────
window.openInCreator = (id) => {
  const sub = _st.all.find(s => s._id === id);
  if (!sub || !['pending', 'changes_requested', 'rejected'].includes(sub.status)) return;
  sessionStorage.setItem('editSub', JSON.stringify({ type: sub.type, data: sub.data }));
  window.open('creator.html');
};

// Ouvre l'item actuellement dans l'éditeur dans le Creator
window.openEditorInCreator = function() {
  const COL_TO_TYPE = {
    'items':'item', 'items_sensible':'item',
    'mobs':'mob', 'mobs_secret':'mob',
    'personnages':'pnj', 'pnj_secret':'pnj',
    'regions':'region',
    'quetes':'quest',
    'panoplies':'panoplie',
  };
  const type = COL_TO_TYPE[_ed.collection];
  if (!type || !_ed.origData) return;
  sessionStorage.setItem('editSub', JSON.stringify({ type, data: _ed.origData }));
  window.open('creator.html');
};


// Champs que le Creator sait produire, par type de soumission (= ce que build*Obj() renvoie).
// Tout autre champ d'un document existant est conservé quand une modification est approuvée.
const _CREATOR_MANAGED_KEYS = {
  item:     new Set(['cat','category','classes','competence','cooldown_apply','craft','craft_cd','craft_qty','effects','event','evolutif','evolutions','evolvedFrom','id','images','lore','lvl','name','obtain','occulte','palier','quality','rarity','rune_slots','sensible','set','skill_name','skill_rarity','stats','tags','twoHanded','unique']),
  mob:      new Set(['id','name','type','behavior','palier','region','images','inCodex','sensible','lore','spawnTime','coords','coords_more','loot']),
  pnj:      new Set(['coords','craft','id','images','instructions','is_underground','name','palier','region','sells','sensible','tag','type']),
  region:   new Set(['canTp','coords','id','images','inCodex','lore','name','palier']),
  quest:    new Set(['id','type','palier','zone','npc','desc','coords','titre','objectifs','recompenses','statut']),
  panoplie: new Set(['bonuses','id','label']),
};

// ── Approve ───────────────────────────────────────────
window.approve = async (id) => {
  const sub     = _st.all.find(s => s._id === id);
  if (!sub) return;

  // Si l'éditeur est ouvert, valider d'abord
  const editor = document.getElementById(`editor-${id}`);
  if (editor?.classList.contains('open')) {
    const errMsg = tryParseEdit(id);
    if (errMsg) {
      const errDiv = document.getElementById(`editor-err-${id}`);
      if (errDiv) { errDiv.textContent = errMsg; errDiv.style.display = ''; }
      return;
    }
    editor.classList.remove('open');
  }

  const comment = document.getElementById(`comment-${id}`)?.value?.trim() || '';
  const btn     = document.querySelector(`#card-${id} .btn-approve`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    const colMap = { item: 'items', mob: 'mobs', pnj: 'personnages', region: 'regions', quest: 'quetes', panoplie: 'panoplies' };
    const target = colMap[sub.type];
    if (!target) throw new Error('Type inconnu : ' + sub.type);

    let dataId = sub.data?.id;
    if (!dataId) throw new Error('Pas d\'ID dans les données');

    if (sub.data?.sensible === true) throw new Error('Les items / mobs / PNJ sensibles ne sont plus gérés : décoche « sensible » dans la soumission.');
    const _contribName  = sub.submitterName || ctx.userNames.get(sub.submittedBy) || 'Inconnu';
    const _contribField = { uid: sub.submittedBy || null, name: _contribName };

    // Nouveau PNJ : l'ID par défaut est NOM + palier + lieu. Une soumission qui porte encore l'ancien format (type + palier + lieu) est convertie,
    // et un ID déjà pris reçoit un _2, _3… : un nouvel ajout n'écrase jamais un PNJ existant.
    if (sub.type === 'pnj' && !sub.isModification) {
      const taken = async id => (await getDoc(doc(db, 'personnages', String(id)))).exists();
      const old = String(dataId);
      const nameSlug = _slugName(sub.data.name || '');
      const typeSlug = _slugName(sub.data.type || '');
      let nid = old;
      if (nameSlug && typeSlug && old.startsWith(typeSlug + '_') && !old.startsWith(nameSlug + '_')) nid = nameSlug + old.slice(typeSlug.length); // ancien format
      let base = nid, n = 2;
      while (await taken(nid)) nid = `${base}_${n++}`;
      if (nid !== old) {
        toast(`ID du PNJ : ${old} → ${nid}`, 'info', 6000);
        dataId = nid;
        sub.data = { ...sub.data, id: nid };
        if (Array.isArray(sub.data.images)) sub.data.images = sub.data.images.map(p => typeof p === 'string' ? p.split(old).join(nid) : p);
      }
    }

    // Modification d'item avec un nouveau nom : l'ID suit le nom (les références sont mises à jour après l'écriture)
    let _renameFrom = null;
    if (sub.type === 'item' && sub.isModification) {
      const exSnap = await getDoc(doc(db, 'items', String(dataId))).catch(() => null);
      if (exSnap?.exists() && sub.data.name && exSnap.data().name && sub.data.name !== exSnap.data().name) {
        const nid = _renamedItemId(String(dataId), exSnap.data().name, sub.data.name);
        if (nid) {
          const clash = await getDoc(doc(db, 'items', nid));
          if (clash.exists()) throw new Error(`Renommage impossible : un item avec l'ID « ${nid} » existe déjà.`);
          _renameFrom = String(dataId);
          dataId = nid;
          sub.data = { ...sub.data, id: nid };
        }
      }
    }

    {
      // Flux standard
      let dataToWrite = { _order: Date.now(), ...sub.data };
      // Panoplie : couleur par défaut si absente (définie par la modération côté liste)
      if (sub.type === 'panoplie' && !dataToWrite.color) dataToWrite.color = '#b87333';

      // Pour une modification : préserver l'ordre, les images et les contributeurs existants
      let _stdExistContribs = [];
      if (sub.isModification) {
        try {
          const existingSnap = await getDoc(doc(db, target, String(_renameFrom || dataId)));
          if (existingSnap.exists()) {
            const existing = existingSnap.data();
            if (existing._order != null) dataToWrite._order = existing._order;
            if (existing.ordre  != null) dataToWrite.ordre  = existing.ordre;
            if (existing.images?.length) dataToWrite.images = existing.images;
            else if (existing.image)     dataToWrite.image  = existing.image;
            // setDoc remplace le document : on reporte les champs que le Creator ne sait pas produire
            // (threshold, camera, morceaux, color…), sinon ils seraient effacés à l'approbation.
            const _managed = _CREATOR_MANAGED_KEYS[sub.type];
            if (_managed) {
              for (const [k, v] of Object.entries(existing)) {
                if (k in dataToWrite || _managed.has(k) || ['_order', '_contributor', '_updatedAt', 'ordre', 'images', 'image'].includes(k)) continue;
                dataToWrite[k] = v;
              }
              // palier Archive (-1) non sélectionnable dans le Creator : une soumission sans palier ne doit pas le faire disparaître
              if (!('palier' in dataToWrite) && existing.palier != null) dataToWrite.palier = existing.palier;
            }
            _stdExistContribs = _readContribs(existing);
          } else {
            toast(`⚠️ Modification approuvée comme nouvel ajout — "${dataId}" n'existait pas encore.`, 'warning', 6000);
          }
        } catch {}
      }
      dataToWrite._contributor = _mergeContributors(_stdExistContribs, _contribField, !!sub.isModification);

      let _imgPairs = [];
      if (_renameFrom && dataToWrite.images?.length) { const r = _renameImagePaths(dataToWrite.images, _renameFrom, String(dataId)); dataToWrite.images = r.images; _imgPairs = r.pairs; }

      await setDoc(doc(db, target, String(dataId)), dataToWrite);

      if (_renameFrom) { // ancien document supprimé, puis toutes les références pointent vers le nouvel ID
        await deleteDoc(doc(db, target, _renameFrom));
        try {
          const n = await _renameItemReferences(_renameFrom, String(dataId));
          await _recordItemRename(_renameFrom, String(dataId));
          toast(`ID renommé : ${_renameFrom} → ${dataId} (${n} document${n !== 1 ? 's' : ''} mis à jour)`, 'success', 7000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
        _writeAudit('rename_id', 'item', String(dataId), sub.data?.name || String(dataId), { from: _renameFrom, to: String(dataId) });
        _toastImageRenames(_imgPairs);
      }

      // Si l'entité était précédemment sensible, nettoyer les collections cachées
      if (sub.type === 'item') {
        // items_hidden est keyé par nameHash (pas item.id) — calculer le hash pour la suppression
        const cleanHash = await hashName(sub.data?.name || '').catch(() => '');
        try { await deleteDoc(doc(db, COL.itemsSecret, String(dataId))); } catch {}
        if (cleanHash) try { await deleteDoc(doc(db, COL.itemsHidden, cleanHash)); } catch {}
        // Fallback : si l'item avait été approuvé avec l'ancien système (clé = item.id)
        try { await deleteDoc(doc(db, COL.itemsHidden, String(dataId))); } catch {}
      } else if (sub.type === 'mob') {
        try { await deleteDoc(doc(db, COL.mobsSecret, String(dataId))); } catch {}
      } else if (sub.type === 'pnj') {
        try { await deleteDoc(doc(db, COL.pnjSecret, String(dataId))); } catch {}
      }

      // Invalider le store (cache + mémoire) pour forcer un re-fetch sur les pages de lecture
      const storeKey = { item:'items', mob:'mobs', pnj:'pnj', region:'regions', quest:'quetes', panoplie:'panoplies' }[sub.type];
      if (storeKey) {
        store.invalidate(storeKey);
        // Bump wiki_version pour notifier les autres onglets/pages
        setDoc(doc(db, 'config', 'wiki_version'), { lastUpdated: serverTimestamp(), collection: storeKey }, { merge: true }).catch(() => {});
      }

      // PNJ approuvé : ses items fabriqués / vendus reçoivent la source d'obtention correspondante
      if (sub.type === 'pnj') {
        _syncPnjObtain({ ...dataToWrite, id: String(dataId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain PNJ]', e));
      }

      // Mob approuvé : les items de son loot reçoivent / mettent à jour la ligne « Obtenable en tuant »
      if (sub.type === 'mob') {
        _syncMobObtain({ ...dataToWrite, id: String(dataId) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain mob]', e));
      }

      // Item approuvé : les PNJ qui le fabriquent / vendent déjà y écrivent leur source d'obtention
      if (sub.type === 'item') {
        window.discordAutoSync(String(dataId)); // post Discord créé / remplacé (si l'envoi automatique est actif)
        _syncItemObtain(String(dataId)).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain item]', e));
      }

      // Si PNJ approuvé et panneau d'ordre ouvert, le recharger
      if (sub.type === 'pnj') {
        invalidateModCache('personnages');
        if (document.getElementById('pnj-order-panel')?.style.display !== 'none') {
          loadPnjOrder().catch(() => {});
        }
      }
    }

    // Mettre à jour la soumission
    const subUpdate = {
      status:     'approved',
      reviewedBy: ctx.user.uid,
      reviewedAt: serverTimestamp(),
      comment,
    };
    await updateDoc(doc(db, 'submissions', id), subUpdate);

    sub.status     = 'approved';
    sub.comment    = comment;
    sub.reviewedBy = ctx.user.uid;
    _writeAudit('approve', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type, comment });
    updateCounts();
    renderSubs();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✓ Approuver'; }
  }
};

// ── Reject ────────────────────────────────────────────
window.reject = async (id) => {
  const sub     = _st.all.find(s => s._id === id);
  if (!sub) return;
  const comment = document.getElementById(`comment-${id}`)?.value?.trim() || '';
  const btn     = document.querySelector(`#card-${id} .btn-reject`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    await updateDoc(doc(db, 'submissions', id), {
      status:     'rejected',
      reviewedBy: ctx.user.uid,
      reviewedAt: serverTimestamp(),
      comment,
    });

    sub.status     = 'rejected';
    sub.comment    = comment;
    sub.reviewedBy = ctx.user.uid;
    _writeAudit('reject', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type, comment });
    updateCounts();
    renderSubs();

    // Avertissement si d'autres soumissions en attente référencent cet élément
    const rejectedId = sub.data?.id;
    if (rejectedId) {
      const refs = _st.all.filter(s => s._id !== id && s.status === 'pending' && (
        s.data?.region === rejectedId ||
        s.data?.craft?.some?.(c => c.id === rejectedId) ||
        s.data?.loot?.some?.(l => l.id === rejectedId)
      ));
      if (refs.length) {
        toast(`⚠️ ${refs.length} soumission(s) en attente référencent cet élément.`, 'warning', 6000);
      }
    }
    _refreshOrphanCount();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
    if (btn) { btn.disabled = false; btn.textContent = '✕ Rejeter'; }
  }
};

// ── Restore to pending ────────────────────────────────
window.restorePending = async (id) => {
  const sub = _st.all.find(s => s._id === id);
  if (!sub) return;
  try {
    await updateDoc(doc(db, 'submissions', id), {
      status:     'pending',
      reviewedBy: null,
      reviewedAt: null,
      comment:    null,
    });
    sub.status     = 'pending';
    sub.reviewedBy = null;
    sub.reviewedAt = null;
    sub.comment    = null;
    _writeAudit('restore_pending', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { type: sub.type });
    updateCounts();
    renderSubs();
    toast('🔄 Soumission remise en attente.', 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ── Request changes ───────────────────────────────────
window.requestChanges = async (id) => {
  const sub = _st.all.find(s => s._id === id);
  if (!sub) return;

  const sharedComment = document.getElementById(`comment-${id}`)?.value?.trim() || '';

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;z-index:10000;';
  overlay.innerHTML = `
    <div style="background:var(--surface,#1e1e2e);border:1px solid var(--border,#333);border-radius:8px;padding:22px 20px 18px;max-width:420px;width:90%;font-family:'JetBrains Mono',monospace;">
      <div style="font-size:13px;color:var(--text,#ddd);margin-bottom:12px;">💬 Indiquer les modifications demandées :</div>
      <textarea id="_vcl-cr-ta" style="width:100%;min-height:80px;box-sizing:border-box;background:var(--surface2,#2a2a3e);border:1px solid var(--border,#444);border-radius:4px;color:var(--text,#ddd);font-size:12px;padding:8px;resize:vertical;" placeholder="Ex : merci d'ajouter le lore et l'image…"></textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px;">
        <button class="btn btn-ghost" id="_vcl-cr-cancel" style="font-size:12px;">Annuler</button>
        <button class="btn" id="_vcl-cr-ok" style="font-size:12px;background:var(--warn,#f59e0b);color:#111;">💬 Envoyer</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  if (sharedComment) overlay.querySelector('#_vcl-cr-ta').value = sharedComment;

  await new Promise(resolve => {
    overlay.querySelector('#_vcl-cr-cancel').addEventListener('click', () => { overlay.remove(); resolve(); });
    overlay.addEventListener('click', e => { if (e.target === overlay) { overlay.remove(); resolve(); } });
    overlay.querySelector('#_vcl-cr-ok').addEventListener('click', async () => {
      const comment = overlay.querySelector('#_vcl-cr-ta').value.trim();
      if (!comment) { overlay.querySelector('#_vcl-cr-ta').style.border = '1px solid var(--danger,#e74c3c)'; return; }
      overlay.querySelector('#_vcl-cr-ok').disabled = true;
      try {
        await updateDoc(doc(db, 'submissions', id), {
          status: 'changes_requested',
          changeRequestComment: comment,
          comment,
          reviewedBy: ctx.user.uid,
          reviewedAt: serverTimestamp(),
        });
        sub.status = 'changes_requested';
        sub.changeRequestComment = comment;
        sub.comment = comment;
        sub.reviewedBy = ctx.user.uid;
        _writeAudit('changes_requested', 'submission', id, sub.data?.name || sub.data?.titre || sub.data?.id || id, { comment });
        updateCounts();
        renderSubs();
        toast('💬 Modifications demandées', 'info');
      } catch(e) { toast('⛔ Erreur : ' + e.message, 'error'); }
      overlay.remove();
      resolve();
    });
  });
};


// ── Bulk delete submissions ───────────────────────────
window.bulkDeleteSubs = async (status) => {
  const targets = _st.all.filter(s => s.status === status);
  if (!targets.length) return;
  const label = status === 'approved' ? 'approuvées' : 'rejetées';
  if (!await modal.confirm(`Supprimer définitivement les ${targets.length} soumissions ${label} ?`)) return;
  try {
    await Promise.all(targets.map(s => deleteDoc(doc(db, 'submissions', s._id))));
    const ids = new Set(targets.map(s => s._id));
    _st.all = _st.all.filter(s => !ids.has(s._id));
    updateCounts();
    renderSubs();
    toast(`✓ ${targets.length} soumission${targets.length > 1 ? 's' : ''} supprimée${targets.length > 1 ? 's' : ''}.`, 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// ── Bulk approve submissions ──────────────────────────
window.bulkApproveSubs = async () => {
  let targets = _st.all.filter(s => s.status === 'pending');
  if (_st.type   !== 'all') targets = targets.filter(s => s.type === _st.type);
  if (_st.search) {
    const q = normalize(_st.search);
    targets = targets.filter(s =>
      fuzzyMatch(q, s.data?.name || s.data?.titre || s.data?.label || '') ||
      fuzzyMatch(q, s.data?.id || '')
    );
  }
  if (!targets.length) return;
  if (!await modal.confirm(
    `Approuver <b>${targets.length}</b> soumission${targets.length > 1 ? 's' : ''} en attente ?<br>` +
    `Chaque soumission sera publiée dans la base de données.`,
    { confirmLabel: `✅ Approuver les ${targets.length}` }
  )) return;

  let done = 0, errors = 0;
  for (const sub of [...targets]) {
    try {
      await window.approve(sub._id);
      done++;
    } catch(e) {
      errors++;
      console.error('[bulkApprove]', sub._id, e);
    }
  }
  toast(
    errors ? `⚠️ ${done} approuvées, ${errors} erreur${errors > 1 ? 's' : ''}.` :
             `✅ ${done} soumission${done > 1 ? 's' : ''} approuvée${done > 1 ? 's' : ''}.`,
    errors ? 'warning' : 'success'
  );
};

// ── Delete submission ─────────────────────────────────
window.deleteSub = async (id) => {
  const sub = _st.all.find(s => s._id === id);
  if (ctx.role !== 'admin' && sub && sub.status !== 'pending') {
    toast('⛔ Seuls les admins peuvent supprimer les soumissions approuvées/rejetées.', 'error');
    return;
  }
  if (!await modal.confirm('Supprimer définitivement cette soumission ?')) return;
  try {
    await deleteDoc(doc(db, 'submissions', id));
    _st.all = _st.all.filter(s => s._id !== id);
    updateCounts();
    renderSubs();
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

// Appelés par les autres panneaux / le noyau (rafraîchissement de la liste)
Object.assign(window, { renderSubs, updateCounts });
}
