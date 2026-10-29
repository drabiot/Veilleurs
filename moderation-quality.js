// ══════════════════════════════════════════════════════
// QUALITÉ DES DONNÉES — Tableau de chasse (complétion), champs requis du Creator, images cassées
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, escHtml, _SUB_COL_MAP, setHash: _setHash, showPanel: _showPanel, db, hasRole, COL, getDoc, doc, updateDoc, setDoc, toast, modal, collection, getDocs } = ctx;
const _dqSort = p => window._dqSort?.(p) ?? 'default', _dqRank = p => window._dqRank?.(p) ?? 3000;
// ── Completion panel ───────────────────────────────────

// Définitions des champs pour les inputs guidés
// Clé = fieldId, ou "mode:fieldId" pour une surcharge par mode
const _CF_DEFS = {
  palier:      { type:'select',    get opts() { return ctx.paliersOpts ?? [[1,'Palier 1'],[2,'Palier 2'],[3,'Palier 3'],['event','Event'],[-1,'Palier Archive']]; } },
  difficulty:  { type:'number',    min:1, max:5, placeholder:'1–5' },
  lvl:         { type:'number',    min:1, placeholder:'Niveau requis' },
  lore:        { type:'textarea',  placeholder:'Texte de lore…' },
  obtain:      { type:'textarea',  placeholder:"Description de l'obtention…" },
  desc:        { type:'textarea',  placeholder:'Description…' },
  objectifs:   { type:'textarea',  placeholder:'Objectifs (un par ligne)' },
  recompenses: { type:'textarea',  placeholder:'Récompenses' },
  name:        { type:'text',      placeholder:'Nom affiché' },
  label:       { type:'text',      placeholder:'Nom affiché' },
  titre:       { type:'text',      placeholder:'Titre' },
  images:      { type:'text',      placeholder:'URL image (https://…)' },
  color:       { type:'colortext', placeholder:'#a07ae8' },
  npc:         { type:'text',      placeholder:'ID ou nom du PNJ donneur' },
  zone:        { type:'text',      placeholder:'ID région' },
  // Surcharges par mode
  'items:event':     { type:'select', get opts() { return (typeof EVENT_NAMES !== 'undefined' ? EVENT_NAMES : []).map(n => [n, n]); } },
  'items:rarity':    { type:'select', opts:[['commun','Commun'],['rare','Rare'],['epique','Épique'],['legendaire','Légendaire'],['mythique','Mythique'],['godlike','Godlike'],['event','Évènement']] },
  'items:category':  { type:'select', opts:[['arme','⚔️ Arme'],['armure','🛡️ Armure'],['accessoire','💍 Accessoire'],['materiaux','🧱 Matériau'],['ressources','⛏️ Ressource'],['consommable','🧪 Consommable'],['nourriture','🍖 Nourriture'],['outils','🔧 Outil'],['rune','🔮 Rune'],['parchemin','📃 Parchemin'],['quete','📜 Objet Quête'],['donjon','🏰 Donjon']] },
  'items:classes':   { type:'multicheckbox', opts:[['guerrier','⚔️ Guerrier'],['assassin','🗡️ Assassin'],['archer','🏹 Archer'],['mage','📖 Mage'],['shaman','🌿 Shaman']] },
  'mobs:type':       { type:'select', opts:[['monstre','👹 Monstre'],['sbire','💀 Sbire'],['mini_boss','⚡ Mini-Boss'],['worldboss','🌍 WorldBoss'],['boss','🔥 Boss']] },
  'mobs:region':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'quetes:type':     { type:'select', opts:[['main','⚔️ Principale'],['sec','🗺️ Secondaire'],['fu','📋 Fractured Underworld']] },
  'quetes:zone':     { type:'dbselect', colName:'regions', labelKey:'name' },
  'pnj:type':        { type:'select', opts:[['marchand','🛒 Marchand'],['donneur_quete','📜 Donneur quête'],['forgeron','⚒️ Forgeron'],['aubergiste','🍺 Aubergiste'],['instructeur','📚 Instructeur'],['autre','❓ Autre']] },
  'pnj:region':      { type:'dbselect', colName:'regions', labelKey:'name' },
  craft_cd:          { type:'text', placeholder:'ex: 24h, aucun' },
};

const _NUMERIC_CF_FIELDS = new Set(['palier','lvl','difficulty','rune_slots','ordre']);

// Construit un input guidé pour un champ manquant
function _buildCompletionInput(fieldId, mode, currentValue) {
  const def = _CF_DEFS[`${mode}:${fieldId}`] || _CF_DEFS[fieldId];
  const BASE_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:13px;outline:none;';

  if (!def || def.type === 'text') {
    const el = document.createElement('input');
    el.type = 'text'; el.dataset.field = fieldId;
    el.placeholder = def?.placeholder || fieldId;
    el.style.cssText = BASE_STYLE;
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'number') {
    const el = document.createElement('input');
    el.type = 'number'; el.dataset.field = fieldId;
    if (def.min != null) el.min = def.min;
    if (def.max != null) el.max = def.max;
    el.placeholder = def.placeholder || fieldId;
    el.style.cssText = BASE_STYLE + 'width:80px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'select') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:140px;cursor:pointer;';
    el.innerHTML = '<option value="">— choisir —</option>' +
      def.opts.map(([v, l]) =>
        `<option value="${escHtml(String(v))}"${String(v) === String(currentValue) ? ' selected' : ''}>${escHtml(l || String(v))}</option>`
      ).join('');
    return el;
  }

  if (def.type === 'textarea') {
    const el = document.createElement('textarea');
    el.dataset.field = fieldId;
    el.placeholder = def.placeholder || fieldId;
    el.rows = 3;
    el.style.cssText = BASE_STYLE + 'width:300px;max-width:100%;resize:vertical;font-family:inherit;font-size:12px;';
    if (currentValue != null) el.value = currentValue;
    return el;
  }

  if (def.type === 'colortext') {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:6px;';
    const colorPicker = document.createElement('input');
    colorPicker.type = 'color';
    colorPicker.style.cssText = 'width:36px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;flex-shrink:0;';
    const textEl = document.createElement('input');
    textEl.type = 'text'; textEl.dataset.field = fieldId;
    textEl.placeholder = def.placeholder || '#a07ae8';
    textEl.style.cssText = BASE_STYLE + 'width:120px;font-family:monospace;';
    if (currentValue) { textEl.value = currentValue; try { colorPicker.value = currentValue; } catch {} }
    colorPicker.addEventListener('input', () => { textEl.value = colorPicker.value; });
    textEl.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(textEl.value)) try { colorPicker.value = textEl.value; } catch {} });
    wrap.appendChild(colorPicker);
    wrap.appendChild(textEl);
    return wrap;
  }

  if (def.type === 'multicheckbox') {
    const wrap = document.createElement('div');
    wrap.dataset.field = fieldId;
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:center;';
    const current = Array.isArray(currentValue) ? currentValue : [];
    def.opts.forEach(([v, l]) => {
      const label = document.createElement('label');
      label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:12px;cursor:pointer;padding:4px 8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;white-space:nowrap;';
      const cb = document.createElement('input');
      cb.type = 'checkbox'; cb.value = v; cb.checked = current.includes(v);
      label.appendChild(cb);
      label.appendChild(document.createTextNode(l || v));
      wrap.appendChild(label);
    });
    return wrap;
  }

  if (def.type === 'dbselect') {
    const el = document.createElement('select');
    el.dataset.field = fieldId;
    el.style.cssText = BASE_STYLE + 'min-width:160px;cursor:pointer;';
    el.innerHTML = '<option value="">Chargement…</option>';
    cachedDocs(def.colName).then(docs => {
      docs = [...docs].sort((a, b) => (a[def.labelKey]||a.id||'').localeCompare(b[def.labelKey]||b.id||'', 'fr'));
      el.innerHTML = '<option value="">— choisir —</option>' +
        docs.map(d => `<option value="${escHtml(d.id||'')}"${d.id === String(currentValue||'') ? ' selected' : ''}>${escHtml(d[def.labelKey]||d.id||'')}</option>`).join('');
    }).catch(() => { el.innerHTML = '<option value="">Erreur</option>'; });
    return el;
  }

  // Fallback
  const el = document.createElement('input');
  el.type = 'text'; el.dataset.field = fieldId;
  el.placeholder = fieldId;
  el.style.cssText = BASE_STYLE;
  if (currentValue != null) el.value = currentValue;
  return el;
}

const REQUIRED_ADMIN_FIELDS = {
  mob:    ['difficulty'],
  region: ['color'],
};

let _completionResults = [];
let _tdcData = {};
let _completionIgnored = null;
let _subsByDoc = {}; // { [colName~docId]: submission } — dernière sub par doc // { [mode]: Set<string> } — null = non chargé

async function _loadCompletionIgnored() {
  if (_completionIgnored !== null) return;
  _completionIgnored = {};
  try {
    const snap = await getDoc(doc(db, 'config', 'completion_ignored'));
    if (snap.exists()) {
      for (const [mode, ids] of Object.entries(snap.data())) {
        _completionIgnored[mode] = new Set(Array.isArray(ids) ? ids : []);
      }
    }
  } catch {}
  for (const mode of Object.keys(QUALITY_COL_MAP)) {
    if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  }
}

async function _saveCompletionIgnored() {
  const payload = {};
  for (const [m, ids] of Object.entries(_completionIgnored || {})) {
    if (ids.size) payload[m] = [...ids];
  }
  await setDoc(doc(db, 'config', 'completion_ignored'), payload);
}

window.showCompletion = async () => {
  _setHash('completion');
  document.getElementById('completion-panel').style.display = '';
  document.getElementById('btn-completion').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCompletion();
};

window.loadCompletion = async () => {
  const list = document.getElementById('completion-list');
  list.innerHTML = '<div class="empty">Chargement…</div>';
  _completionIgnored = null; // forcer rechargement
  await _loadCompletionIgnored();

  // Charger quality standards depuis Firestore
  let standards = {};
  try {
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        const normReq = [...new Set((cfg.required || []).map(_normF))];
        const normByCat = {};
        for (const [sc, scfg] of Object.entries(cfg.byCategory || {})) {
          normByCat[sc] = { required: [...new Set((scfg.required || []).map(_normF))] };
        }
        standards[mode] = { required: normReq, byCategory: normByCat };
      }
    }
  } catch {}

  // Fusionner les champs admin obligatoires (required_admin_fields ou fallback)
  let adminFields = REQUIRED_ADMIN_FIELDS;
  try {
    const snap = await getDoc(doc(db, 'config', 'required_admin_fields'));
    if (snap.exists()) adminFields = snap.data();
  } catch {}
  const _adminColMap = { mob:'mobs', quete:'quetes', region:'regions' };
  for (const [type, fields] of Object.entries(adminFields)) {
    const mode = _adminColMap[type] || type;
    if (!standards[mode]) standards[mode] = { required: [], byCategory: {} };
    for (const f of fields) {
      if (!standards[mode].required.includes(f)) standards[mode].required.push(f);
    }
  }

  if (!Object.keys(standards).length) {
    list.innerHTML = '<div class="empty">Aucune configuration définie. Définissez les champs requis dans ⚙️ Champs requis.</div>';
    const badge = document.getElementById('count-incomplete');
    if (badge) badge.style.display = 'none';
    return;
  }

  _completionResults = [];
  try {
    for (const [mode, std] of Object.entries(standards)) {
      const colName = QUALITY_COL_MAP[mode];
      if (!colName) continue;
      const disc    = QUALITY_DISCRIMINANT[mode];
      const hasByCat = disc && Object.keys(std.byCategory || {}).length > 0;
      let docs = [];
      try { docs = await cachedDocs(colName); } catch { continue; }
      for (const _d of docs) {
        const d = (!_d.images?.length && (_d.img || _d.image))
          ? { ..._d, images: [_d.img || _d.image].filter(Boolean) }
          : _d;
        const missing = (std.required || []).filter(f => _fieldEmpty(d, f));
        const discVal = disc ? (d[disc] || null) : null;
        if (hasByCat && !discVal) {
          if (!missing.includes(disc)) missing.push(disc);
        } else if (discVal && std.byCategory?.[discVal]) {
          for (const f of (std.byCategory[discVal].required || [])) {
            if (!missing.includes(f) && _fieldEmpty(d, f)) missing.push(f);
          }
        }
        if (missing.length) _completionResults.push({ mode, colName, doc: d, missing, discVal });
      }
    }
  } catch(e) {
    list.innerHTML = `<div class="empty">Erreur : ${e.message}</div>`;
    return;
  }

  // Quêtes sans description (vérification systématique, indépendante des standards)
  try {
    const questDocs = await cachedDocs('quetes');
    // Ajouter 'desc' aux quêtes déjà dans les résultats qui n'ont pas de description
    for (const r of _completionResults) {
      if (r.colName === 'quetes' && (!r.doc.desc || !r.doc.desc.trim())) {
        if (!r.missing.includes('desc')) r.missing.push('desc');
      }
    }
    const coveredQuestIds = new Set(_completionResults.filter(r => r.colName === 'quetes').map(r => r.doc.id || r.doc._id));
    for (const q of questDocs) {
      const qid = q.id || q._id;
      if (coveredQuestIds.has(qid)) continue;
      if (!q.desc || !q.desc.trim()) {
        _completionResults.push({ mode: 'quetes', colName: 'quetes', doc: q, missing: ['desc'], discVal: null });
      }
    }
  } catch {}

  // craft_cd — requis seulement si l'item a des ingrédients de craft
  try {
    const itemDocs = await cachedDocs(COL.items);
    for (const r of _completionResults) {
      if (r.colName === COL.items && Array.isArray(r.doc.craft) && r.doc.craft.length > 0
          && (!r.doc.craft_cd || !String(r.doc.craft_cd).trim())) {
        if (!r.missing.includes('craft_cd')) r.missing.push('craft_cd');
      }
    }
    const coveredItemIds = new Set(
      _completionResults.filter(r => r.colName === COL.items).map(r => r.doc.id || r.doc._id)
    );
    for (const item of itemDocs) {
      const iid = item.id || item._id;
      if (coveredItemIds.has(iid)) continue;
      if (Array.isArray(item.craft) && item.craft.length > 0
          && (!item.craft_cd || !String(item.craft_cd).trim())) {
        _completionResults.push({
          mode: 'items', colName: COL.items, doc: item,
          missing: ['craft_cd'], discVal: item.category || null,
        });
      }
    }
  } catch {}

  // Badge sidebar (exclut les ignorés)
  const _activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
  const badge = document.getElementById('count-incomplete');
  if (badge) { badge.textContent = _activeCount; badge.style.display = _activeCount ? '' : 'none'; }

  // Filtre dynamique : uniquement les champs qui ont au moins un manquant
  const allMissingFields = [...new Set(_completionResults.flatMap(r => r.missing))].sort();
  const filterBar = document.getElementById('completion-filter-bar');
  const filterSel = document.getElementById('completion-filter-field');
  if (filterSel) {
    const prev = filterSel.value;
    filterSel.innerHTML = '<option value="">Tous les problèmes</option>' +
      allMissingFields.map(f => `<option value="${escHtml(f)}"${f === prev ? ' selected' : ''}>${escHtml(f)}</option>`).join('');
    if (filterBar) filterBar.style.display = allMissingFields.length > 1 ? 'flex' : 'none';
  }

  // Charger la sélection du tableau de chasse
  try {
    const tdcSnap = await getDoc(doc(db, 'config', 'tableau_de_chasse'));
    _tdcData = tdcSnap.exists() ? tdcSnap.data() : {};
  } catch { _tdcData = {}; }

  // Construire lookup soumissions par doc (depuis ctx.allSubs global)
  _subsByDoc = {};
  for (const sub of (window.allSubs || [])) {
    const colName = _SUB_COL_MAP[sub.type];
    const id = sub.data?.id;
    if (!colName || !id) continue;
    const key = colName + '~' + id;
    const existing = _subsByDoc[key];
    // Garder la plus récente (par submittedAt)
    if (!existing || (sub.submittedAt?.seconds || 0) > (existing.submittedAt?.seconds || 0)) {
      _subsByDoc[key] = sub;
    }
  }

  // Auto-retirer du TDC : items complets (plus dans _completionResults) OU submission approuvée
  const _incompleteKeys = new Set(_completionResults.map(r => r.mode + '~' + (r.doc.id || '')));
  let _tdcModified = false;
  for (const [mode, ids] of Object.entries(_tdcData)) {
    if (!Array.isArray(ids)) continue;
    const colName = QUALITY_COL_MAP[mode];
    const filtered = ids.filter(id => {
      if (!_incompleteKeys.has(mode + '~' + id)) return false; // plus de champs manquants
      const sub = _subsByDoc[colName + '~' + id];
      if (sub?.status === 'approved') return false; // submission acceptée
      return true;
    });
    if (filtered.length !== ids.length) { _tdcData[mode] = filtered; _tdcModified = true; }
  }
  if (_tdcModified) {
    try { await setDoc(doc(db, 'config', 'tableau_de_chasse'), _tdcData); } catch {}
  }

  renderCompletion(); // inclut _appendBrokenImagesSection en fin
};

function _buildCompletionCard(mode, colName, d, missing, discVal, { ignored = false } = {}) {
  const safeId    = (d.id || '').replace(/[^a-zA-Z0-9_-]/g, '_') || Math.random().toString(36).slice(2);
  const subcatLbl = discVal ? _subcatLabel(mode, discVal) : null;
  const docId     = d.id || '';
  const sub       = _subsByDoc[(QUALITY_COL_MAP[mode] || colName) + '~' + docId];
  const hasPending = !ignored && (sub?.status === 'pending' || sub?.status === 'changes_requested');

  const card = document.createElement('div');
  card.style.cssText = `background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:10px;${ignored ? 'opacity:.55;' : ''}${hasPending ? 'border-left:3px solid var(--warn);' : ''}`;

  const headRow = document.createElement('div');
  headRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;';
  headRow.innerHTML = `
    ${!ignored ? `<label class="tdc-check" title="Ajouter au tableau de chasse"><input type="checkbox" data-mode="${escHtml(mode)}" data-id="${escHtml(docId)}"${(_tdcData[mode]||[]).includes(docId) ? ' checked' : ''} onchange="saveTableauDeChasse()">🎯</label>` : ''}
    <span style="font-size:10px;font-weight:700;text-transform:uppercase;padding:2px 8px;border-radius:8px;background:var(--surface3);color:var(--muted);flex-shrink:0;">${escHtml(mode)}</span>
    ${subcatLbl ? `<span style="font-size:11px;font-weight:600;padding:2px 7px;border-radius:10px;background:rgba(224,172,96,.12);color:var(--accent);border:1px solid rgba(224,172,96,.25);flex-shrink:0;">${escHtml(subcatLbl)}</span>` : ''}
    ${d.palier != null ? `<span class="dq-pal">${d.palier === 'event' ? 'Event' : d.palier < 0 ? 'Archive' : 'P' + escHtml(String(d.palier))}</span>` : ''}
    <span style="font-size:14px;font-weight:700;">${escHtml(d.name||d.titre||d.label||docId||'—')}</span>
    <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(docId)}</span>
    ${hasPending
      ? `<span style="font-size:11px;color:var(--warn);font-weight:600;flex:1;min-width:0;">⏳ Vérification en cours — soumission en attente de modération</span>`
      : `<span style="font-size:11px;color:var(--muted);flex:1;min-width:0;">${ignored ? '🚫 Ignoré · ' : ''}Manque : ${missing.map(f => `<code style="background:var(--surface2);padding:1px 4px;border-radius:3px;">${escHtml(f)}</code>`).join(' ')}</span>`
    }
    ${!ignored && !hasPending ? `<button class="btn btn-ghost btn-sm" onclick="showEditor('${escHtml(colName)}','${escHtml(docId)}',null,'completion')" style="font-size:11px;flex-shrink:0;">✏️ Éditer</button>` : ''}
    ${!ignored && !hasPending && mode === 'items' ? `<button class="btn btn-ghost btn-sm" onclick="openCompletionInCreator('${escHtml(colName)}','${escHtml(docId)}')" style="font-size:11px;flex-shrink:0;" title="Ouvrir dans le Creator">⚙️ Creator</button>` : ''}
    ${!ignored
      ? `<button class="btn btn-ghost btn-sm" onclick="window.ignoreCompletionDoc('${escHtml(mode)}','${escHtml(docId)}',this)" style="font-size:11px;flex-shrink:0;color:var(--muted);" title="Marquer comme exception — ne plus afficher dans Tableau de Chasse">🚫 Ignorer</button>`
      : `<button class="btn btn-ghost btn-sm" onclick="window.unignoreCompletionDoc('${escHtml(mode)}','${escHtml(docId)}',this)" style="font-size:11px;flex-shrink:0;" title="Réintégrer dans Tableau de Chasse">↩️ Réactiver</button>`
    }
  `;
  card.appendChild(headRow);

  if (!ignored && !hasPending) {
    const fieldsWrap = document.createElement('div');
    fieldsWrap.id = `completion-fields-${safeId}`;
    fieldsWrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end;';
    for (const f of missing) {
      const wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const lbl = document.createElement('label');
      lbl.style.cssText = 'font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;';
      lbl.textContent = f;
      wrap.appendChild(lbl);
      wrap.appendChild(_buildCompletionInput(f, mode, d[f] != null ? d[f] : undefined));
      fieldsWrap.appendChild(wrap);
    }
    card.appendChild(fieldsWrap);

    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'margin-top:10px;display:flex;align-items:center;gap:8px;';
    const saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-ghost btn-sm';
    saveBtn.style.cssText = 'font-size:12px;';
    saveBtn.textContent = '💾 Sauvegarder';
    saveBtn.setAttribute('onclick', `saveCompletionFields('${escHtml(mode)}','${escHtml(docId)}',this)`);
    const statusEl = document.createElement('span');
    statusEl.id = `completion-status-${safeId}`;
    statusEl.style.cssText = 'font-size:11px;';
    saveRow.appendChild(saveBtn);
    saveRow.appendChild(statusEl);
    card.appendChild(saveRow);
  }

  return card;
}

window.renderCompletion = function renderCompletion() {
  const list        = document.getElementById('completion-list');
  const filterField = document.getElementById('completion-filter-field')?.value || '';

  const isIgnored = r => _completionIgnored?.[r.mode]?.has(r.doc.id || '');
  let results = _completionResults.filter(r => !isIgnored(r));
  if (filterField) results = results.filter(r => r.missing.includes(filterField));
  if (_dqSort('completion-panel') === 'palier') results = [...results].sort((a, b) => window._dqRank(a.doc.palier) - window._dqRank(b.doc.palier));

  list.innerHTML = '';

  if (!results.length) {
    list.innerHTML = filterField
      ? '<div class="empty">Aucun document incomplet pour ce critère. ✓</div>'
      : '<div class="empty">Aucun document à compléter. ✓</div>';
    _appendBrokenImagesSection();
    return;
  }

  const byMode = {};
  for (const r of results) {
    if (!byMode[r.mode]) byMode[r.mode] = [];
    byMode[r.mode].push(r);
  }

  for (const [mode, rows] of Object.entries(byMode)) {
    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:12px;';
    header.textContent = `${QUALITY_MODE_LABELS[mode] || mode} — ${rows.length} incomplet${rows.length > 1 ? 's' : ''}`;
    list.appendChild(header);
    for (const { colName, doc: d, missing, discVal } of rows) {
      list.appendChild(_buildCompletionCard(mode, colName, d, missing, discVal));
    }
  }

  _appendBrokenImagesSection();
};

function _appendIgnoredSection() {
  const list = document.getElementById('completion-list');
  if (!list) return;
  const ignoredRows = _completionResults.filter(r => _completionIgnored?.[r.mode]?.has(r.doc.id || ''));
  if (!ignoredRows.length) return;

  const header = document.createElement('div');
  header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;cursor:pointer;display:flex;align-items:center;gap:6px;';
  header.innerHTML = `<span id="ignored-chevron">▶</span> 🚫 Ignorés — ${ignoredRows.length} exception${ignoredRows.length > 1 ? 's' : ''}`;
  list.appendChild(header);

  const body = document.createElement('div');
  body.id = 'ignored-section-body';
  body.style.display = 'none';
  list.appendChild(body);

  header.onclick = () => {
    const open = body.style.display !== 'none';
    body.style.display = open ? 'none' : '';
    document.getElementById('ignored-chevron').textContent = open ? '▶' : '▼';
  };

  for (const { colName, doc: d, missing, discVal, mode } of ignoredRows) {
    body.appendChild(_buildCompletionCard(mode, colName, d, missing, discVal, { ignored: true }));
  }
}

window.ignoreCompletionDoc = async (mode, docId, btn) => {
  if (!_completionIgnored) _completionIgnored = {};
  if (!_completionIgnored[mode]) _completionIgnored[mode] = new Set();
  _completionIgnored[mode].add(docId);
  if (btn) btn.disabled = true;
  try {
    await _saveCompletionIgnored();
    const activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
    const badge = document.getElementById('count-incomplete');
    if (badge) { badge.textContent = activeCount; badge.style.display = activeCount ? '' : 'none'; }
    renderCompletion();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
    _completionIgnored[mode].delete(docId);
    if (btn) btn.disabled = false;
  }
};

window.unignoreCompletionDoc = async (mode, docId, btn) => {
  _completionIgnored?.[mode]?.delete(docId);
  if (btn) btn.disabled = true;
  try {
    await _saveCompletionIgnored();
    const activeCount = _completionResults.filter(r => !_completionIgnored?.[r.mode]?.has(r.doc.id || '')).length;
    const badge = document.getElementById('count-incomplete');
    if (badge) { badge.textContent = activeCount; badge.style.display = activeCount ? '' : 'none'; }
    renderCompletion();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.saveTableauDeChasse = async function() {
  const result = { items: [], mobs: [], pnj: [], regions: [], quetes: [], panoplies: [] };
  document.querySelectorAll('#completion-list input[type=checkbox][data-mode]').forEach(cb => {
    const m = cb.dataset.mode;
    if (cb.checked && result[m] !== undefined) result[m].push(cb.dataset.id);
  });
  try {
    await setDoc(doc(db, 'config', 'tableau_de_chasse'), result);
    _tdcData = result;
  } catch(e) {
    toast('⛔ Tableau de chasse : ' + e.message, 'error');
  }
};

async function _appendBrokenImagesSection() {
  const list = document.getElementById('completion-list');
  if (!list) return;
  const imgHeader = document.createElement('div');
  imgHeader.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding:6px 0 8px;border-bottom:1px solid var(--border);margin-bottom:10px;margin-top:16px;';
  imgHeader.textContent = '🖼️ Images — vérification en cours…';
  list.appendChild(imgHeader);
  try {
    const itemDocs = await _loadItemDocsForImageCheck();
    const broken = await _checkBrokenImages(itemDocs, (done, total) => {
      imgHeader.textContent = `🖼️ Images — ${done} / ${total} vérifiées…`;
    });
    if (!broken.length) {
      imgHeader.textContent = '🖼️ Images — toutes accessibles ✓';
    } else {
      imgHeader.textContent = `🖼️ Images cassées — ${broken.length} item${broken.length > 1 ? 's' : ''}`;
      for (const { doc: d, brokenUrls } of broken) {
        const sens = d._sensible === true;
        const editKey = sens ? (d._docKey || '') : (d.id || '');
        const card = document.createElement('div');
        card.style.cssText = 'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:10px;flex-wrap:wrap;';
        card.innerHTML = `
          <span style="font-size:13px;font-weight:700;flex:1;min-width:120px;">${escHtml(d.name||d.id||'—')}${sens ? ' <span style="font-size:9px;padding:1px 5px;border-radius:8px;background:rgba(248,113,113,.15);border:1px solid rgba(248,113,113,.3);color:#f87171;vertical-align:middle;">🔒 Sensible</span>' : ''}</span>
          <span style="font-size:11px;color:var(--muted);font-family:monospace;">${escHtml(d.id||'')}</span>
          <div style="width:100%;display:flex;flex-direction:column;gap:3px;">
            ${brokenUrls.map(u => `<span style="font-size:11px;color:var(--danger);font-family:monospace;word-break:break-all;">⛔ ${escHtml(u)}</span>`).join('')}
          </div>
          <button class="btn btn-ghost btn-sm" onclick="_openItemForCompletion('${escHtml(editKey)}',${sens},'completion')" style="font-size:11px;">✏️ Éditer</button>
        `;
        list.appendChild(card);
      }
    }
  } catch {
    imgHeader.textContent = '🖼️ Images — erreur lors de la vérification';
  }
  _appendIgnoredSection();
}

window.saveCompletionFields = async (mode, docId, btn) => {
  const colName = QUALITY_COL_MAP[mode] || ({ mob:'mobs', quete:'quetes', region:'regions' }[mode]) || mode;
  if (!hasRole(ctx.role, 'contributeur')) { toast('⛔ Accès refusé', 'error'); return; }
  const safeDocId  = docId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const fieldsWrap = document.getElementById(`completion-fields-${safeDocId}`);
  const status     = document.getElementById(`completion-status-${safeDocId}`);
  if (!fieldsWrap) return;

  const patch = {};

  // input / select / textarea avec data-field (hors checkbox et color picker)
  for (const el of fieldsWrap.querySelectorAll('input[data-field]:not([type=checkbox]):not([type=color]), select[data-field], textarea[data-field]')) {
    const f = el.dataset.field;
    const v = el.value.trim();
    if (!v) continue;
    patch[f] = _NUMERIC_CF_FIELDS.has(f) && !isNaN(Number(v)) ? Number(v) : v;
  }

  // div[data-field] = multicheckbox
  for (const wrap of fieldsWrap.querySelectorAll('div[data-field]')) {
    const f       = wrap.dataset.field;
    const checked = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map(cb => cb.value);
    if (checked.length) patch[f] = checked;
  }

  if (!Object.keys(patch).length) { toast('⚠️ Aucun champ rempli', 'warning'); return; }
  try {
    if (btn) btn.disabled = true;
    await updateDoc(doc(db, colName, docId), patch);
    invalidateModCache(colName);
    await loadCompletion();
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
    if (btn) btn.disabled = false;
  }
};

window.openCompletionInCreator = async function(colName, docId) {
  let data = null;
  try {
    const snap = await getDoc(doc(db, colName, docId));
    if (snap.exists()) data = { id: snap.id, ...snap.data() };
  } catch(e) {
    toast('⛔ Impossible de charger le document : ' + e.message, 'error');
    return;
  }
  if (!data) { toast('⛔ Document introuvable.', 'error'); return; }
  const typeMap = { items:'item', mobs:'mob', personnages:'pnj', regions:'region', quetes:'quest', panoplies:'panoplie' };
  const type = typeMap[colName] || 'item';
  sessionStorage.setItem('editSub', JSON.stringify({ type, data }));
  window.open('creator.html', '_blank');
};

// ── Creator Validation Config (Champs requis) ──────────
const QUALITY_FIELD_SCHEMA = {
  items: [
    { id: 'name',     label: 'Nom affiché' },
    { id: 'rarity',   label: 'Rareté' },
    { id: 'category', label: 'Catégorie' },
    { id: 'palier',   label: 'Palier' },
    { id: 'event',    label: 'Évènement (palier Event uniquement)' },
    { id: 'lvl',      label: 'Niveau requis' },
    { id: 'images',   label: 'Image' },
    { id: 'lore',     label: 'Lore' },
    { id: 'obtain',   label: 'Obtention' },
    { id: 'stats',    label: 'Stats' },
    { id: 'effects',  label: 'Effets' },
    { id: 'cat',      label: 'Slot interne' },
    { id: 'craft_cd', label: 'CD de craft' },
  ],
  mobs: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'palier', label: 'Palier' },
    { id: 'region', label: 'Région' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'loot',   label: 'Loot' },
  ],
  pnj: [
    { id: 'name',   label: 'Nom' },
    { id: 'type',   label: 'Type' },
    { id: 'coords', label: 'Coordonnées' },
    { id: 'region', label: 'Région' },
    { id: 'palier', label: 'Palier' },
  ],
  regions: [
    { id: 'name',   label: 'Nom' },
    { id: 'palier', label: 'Palier' },
    { id: 'lore',   label: 'Lore (Codex)' },
    { id: 'images', label: 'Image' },
  ],
  quetes: [
    { id: 'titre',      label: 'Titre' },
    { id: 'type',       label: 'Type' },
    { id: 'palier',     label: 'Palier' },
    { id: 'zone',       label: 'Zone' },
    { id: 'npc',        label: 'PNJ donneur' },
    { id: 'desc',       label: 'Description' },
    { id: 'objectifs',  label: 'Objectifs' },
    { id: 'recompenses',label: 'Récompenses' },
  ],
  panoplies: [
    { id: 'label',   label: 'Nom' },
    { id: 'bonuses', label: 'Bonus' },
    { id: 'images',  label: 'Image' },
  ],
};

const QUALITY_COL_MAP = {
  items: COL.items, mobs: COL.mobs, pnj: COL.pnj,
  regions: COL.regions, quetes: COL.quetes, panoplies: COL.panoplies,
};

const QUALITY_MODE_LABELS = {
  items:     '⚔️ Items',
  mobs:      '👾 Mobs',
  pnj:       '🧑 PNJ',
  regions:   '📍 Régions',
  quetes:    '📜 Quêtes',
  panoplies: '🔗 Panoplies',
};

// Champ discriminant par mode (détermine la sous-catégorie d'un doc)
const QUALITY_DISCRIMINANT = {
  items:  'category',
  mobs:   'type',
  quetes: 'type',
};

// Sous-catégories connues par mode (UI + règles byCategory)
const QUALITY_SUBCATEGORIES = {
  items: [
    { id: 'arme',        label: '⚔️ Arme' },
    { id: 'armure',      label: '🛡️ Armure' },
    { id: 'accessoire',  label: '💍 Accessoire' },
    { id: 'materiaux',   label: '🧱 Matériau' },
    { id: 'ressources',  label: '⛏️ Ressource' },
    { id: 'consommable', label: '🧪 Consommable' },
    { id: 'nourriture',  label: '🍖 Nourriture' },
    { id: 'outils',      label: '🔧 Outil' },
    { id: 'rune',        label: '🔮 Rune' },
    { id: 'parchemin',   label: '📃 Parchemin' },
    { id: 'quete',       label: '📜 Objet Quête' },
    { id: 'donjon',      label: '🏰 Donjon' },
  ],
  mobs: [
    { id: 'monstre',   label: '👹 Monstre' },
    { id: 'sbire',     label: '💀 Sbire' },
    { id: 'mini_boss', label: '⚡ Mini-Boss' },
    { id: 'worldboss', label: '🌍 WorldBoss' },
    { id: 'boss',      label: '🔥 Boss' },
  ],
  quetes: [
    { id: 'main', label: '⚔️ Principale' },
    { id: 'sec',  label: '🗺️ Secondaire' },
    { id: 'fu',  label: '📋 Fractured Underworld' },
  ],
};

// _cvData: { [mode]: { required: Set<string>, byCategory: { [subcat]: Set<string> } } }
let _cvData    = {};
let _cvMode    = 'items';
let _cvSubMode = {}; // mode → sous-catégorie sélectionnée dans l'UI
let _cvDirty   = false;
let _cvStats   = {}; // { [mode]: { [fieldId]: count } } — nb docs manquant ce champ

function _cvModeData(mode) {
  if (!_cvData[mode]) _cvData[mode] = { required: new Set(), byCategory: {} };
  return _cvData[mode];
}
function _cvSubData(mode, subcat) {
  const md = _cvModeData(mode);
  if (!md.byCategory[subcat]) md.byCategory[subcat] = new Set();
  return md.byCategory[subcat];
}

window.showCreatorValidation = async () => {
  if (ctx.role !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _cvStats = {};
  _setHash('creator-validation');
  document.getElementById('creator-validation-panel').style.display = '';
  document.getElementById('btn-creator-validation').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadCreatorValidation();
};

window.loadCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  try {
    const snap = await getDoc(doc(db, 'config', 'data_quality_standards'));
    const _normF = f => (f === 'img' || f === 'image') ? 'images' : f;
    _cvData = {};
    if (snap.exists()) {
      for (const [mode, cfg] of Object.entries(snap.data())) {
        _cvData[mode] = { required: new Set((cfg.required || []).map(_normF)), byCategory: {} };
        for (const [subcat, scfg] of Object.entries(cfg.byCategory || {})) {
          _cvData[mode].byCategory[subcat] = new Set((scfg.required || []).map(_normF));
        }
      }
    }
    _renderCvUI();
    if (status) status.style.display = 'none';
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  }
};

async function _computeCvStats(mode) {
  if (_cvStats[mode]) return;
  const col = QUALITY_COL_MAP[mode];
  if (!col) return;
  await _loadCompletionIgnored();
  const allDocs = await cachedDocs(col);
  const ignoredSet = _completionIgnored?.[mode] || new Set();
  const docs = allDocs.filter(d => !ignoredSet.has(d.id || ''));
  const fields = QUALITY_FIELD_SCHEMA[mode] || [];
  const discriminant = QUALITY_DISCRIMINANT[mode];
  const subCats = QUALITY_SUBCATEGORIES[mode] || [];

  // global counts (ignorés exclus)
  const global = {};
  for (const f of fields) global[f.id] = docs.filter(d => _fieldEmpty(d, f.id)).length;

  // per-subcategory counts
  const byCategory = {};
  if (discriminant && subCats.length) {
    for (const sc of subCats) {
      const subset = docs.filter(d => d[discriminant] === sc.id);
      const counts = {};
      for (const f of fields) counts[f.id] = subset.filter(d => _fieldEmpty(d, f.id)).length;
      byCategory[sc.id] = counts;
    }
  }

  _cvStats[mode] = { global, byCategory };
}

function _renderCvFieldGrid(fields, reqSet, scope, subcat) {
  const subcatAttr = subcat ? ` data-subcat="${subcat}"` : '';
  const modeStats = _cvStats[_cvMode] || {};
  return fields.map(f => {
    const counts = scope === 'bycat' && subcat
      ? modeStats.byCategory?.[subcat]
      : modeStats.global;
    const count = counts?.[f.id];
    const impactHtml = count != null
      ? `<span class="cv-field-impact${count > 0 ? ' has-missing' : ''}" title="${count} doc${count !== 1 ? 's' : ''} manquant ce champ">${count}</span>`
      : `<span class="cv-field-impact">—</span>`;
    return `<div class="cv-field-row">
      <span class="cv-field-label">${f.label || f.id}</span>
      ${impactHtml}
      <div class="cv-field-toggle-wrap">
        <button class="perm-toggle ${reqSet.has(f.id) ? 'on' : 'off'}"
          data-mode="${_cvMode}" data-scope="${scope}" data-field="${f.id}"${subcatAttr}
          onclick="window._onCvToggle(this)" title="${reqSet.has(f.id) ? 'Requis' : 'Optionnel'}">
        </button>
      </div>
    </div>`;
  }).join('');
}

function _renderCvUI() {
  const tabsEl = document.getElementById('cv-tabs');
  if (!tabsEl) return;

  tabsEl.innerHTML = Object.entries(QUALITY_MODE_LABELS).map(([m, lbl]) => {
    const reqCount = _cvData[m]?.required?.size || 0;
    return `<button class="cv-mode-tab${m === _cvMode ? ' active' : ''}" onclick="window._setCvMode('${m}')">
      ${lbl} <span class="cv-mode-req-count">${reqCount}</span>
    </button>`;
  }).join('');

  const grid    = document.getElementById('cv-grid');
  const fields  = QUALITY_FIELD_SCHEMA[_cvMode] || [];
  const md      = _cvModeData(_cvMode);
  const subCats = QUALITY_SUBCATEGORIES[_cvMode] || [];
  const globalCount = md.required.size;

  let html = `<div class="cv-section">
    <div class="cv-section-header">
      <span class="cv-section-title">Toujours requis</span>
      ${globalCount ? `<span class="cv-section-count">${globalCount} champ${globalCount > 1 ? 's' : ''}</span>` : ''}
    </div>
    ${_renderCvFieldGrid(fields, md.required, 'global', null)}
  </div>`;

  if (subCats.length) {
    const selSub = _cvSubMode[_cvMode] || subCats[0].id;
    if (!_cvSubMode[_cvMode]) _cvSubMode[_cvMode] = selSub;
    const subReq = _cvSubData(_cvMode, selSub);
    const subCount = subReq.size;

    html += `<div class="cv-section">
      <div class="cv-section-header">
        <span class="cv-section-title">Par catégorie</span>
        ${subCount ? `<span class="cv-section-count">${subCount} champ${subCount > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="cv-subcat-bar">
        ${subCats.map(sc => `<button class="cv-subcat-btn${sc.id === selSub ? ' active' : ''}"
          onclick="window._setCvSubMode('${sc.id}')">${sc.label}</button>`).join('')}
      </div>
      ${_renderCvFieldGrid(fields, subReq, 'bycat', selSub)}
    </div>`;
  }

  grid.innerHTML = html;

  if (!_cvStats[_cvMode]) {
    _computeCvStats(_cvMode).then(() => _renderCvUI());
  }
}

window._setCvMode    = (m)  => { _cvMode = m; _renderCvUI(); };
window._setCvSubMode = (sc) => { _cvSubMode[_cvMode] = sc; _renderCvUI(); };
window._onCvToggle   = (btn) => {
  const { mode, scope, field, subcat } = btn.dataset;
  const isOn = btn.classList.contains('on');
  btn.classList.toggle('on', !isOn);
  btn.classList.toggle('off', isOn);
  btn.title = !isOn ? 'Requis' : 'Optionnel';
  if (scope === 'global') {
    const req = _cvModeData(mode).required;
    !isOn ? req.add(field) : req.delete(field);
  } else {
    const req = _cvSubData(mode, subcat);
    !isOn ? req.add(field) : req.delete(field);
  }
  _cvDirty = true;
  const saveBtn = document.getElementById('btn-save-creator-validation');
  if (saveBtn) saveBtn.classList.add('cv-save-dirty');
  _renderCvUI();
};

window.saveCreatorValidation = async () => {
  const status = document.getElementById('cv-status');
  const btn    = document.getElementById('btn-save-creator-validation');
  const payload = {};
  for (const [mode, md] of Object.entries(_cvData)) {
    const entry = {};
    if (md.required?.size) entry.required = [...md.required];
    const byCat = {};
    for (const [subcat, req] of Object.entries(md.byCategory || {})) {
      if (req.size) byCat[subcat] = { required: [...req] };
    }
    if (Object.keys(byCat).length) entry.byCategory = byCat;
    if (Object.keys(entry).length) payload[mode] = entry;
  }
  try {
    if (btn) btn.disabled = true;
    await setDoc(doc(db, 'config', 'data_quality_standards'), payload);
    if (status) { status.textContent = '✓ Sauvegardé'; status.style.color = 'var(--success)'; status.style.display = ''; }
    toast('✓ Champs requis sauvegardés', 'success');
    _cvDirty = false;
    if (btn) { btn.classList.remove('cv-save-dirty'); }
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; status.style.display = ''; }
  } finally {
    if (btn) btn.disabled = false;
  }
};

// ── Data Incomplète ───────────────────────────────────
function _testImageUrl(url) {
  return new Promise(resolve => {
    if (!url || typeof url !== 'string' || url.startsWith('data:')) { resolve(true); return; }
    const img = new Image();
    const t = setTimeout(() => { img.src = ''; resolve(false); }, 8000);
    img.onload  = () => { clearTimeout(t); resolve(true); };
    img.onerror = () => { clearTimeout(t); resolve(false); };
    img.src = url;
  });
}

function _normalizeUrlForModeration(url) {
  if (!url || typeof url !== 'string') return url;
  let u = url;
  while (u.startsWith('../')) u = u.slice(3);
  return u;
}

async function _checkBrokenImages(docs, onProgress) {
  const BATCH = 8;
  const broken = [];
  const entries = docs.map(d => {
    const urls = [];
    if (d.img   && typeof d.img   === 'string' && !d.img.startsWith('data:'))   urls.push(_normalizeUrlForModeration(d.img));
    if (d.image && typeof d.image === 'string' && !d.image.startsWith('data:')) urls.push(_normalizeUrlForModeration(d.image));
    if (Array.isArray(d.images)) d.images.forEach(u => { if (u && typeof u === 'string' && !u.startsWith('data:')) urls.push(_normalizeUrlForModeration(u)); });
    return { doc: d, urls };
  }).filter(e => e.urls.length > 0);

  let done = 0;
  for (let i = 0; i < entries.length; i += BATCH) {
    await Promise.all(entries.slice(i, i + BATCH).map(async ({ doc: d, urls }) => {
      const ok = await Promise.all(urls.map(_testImageUrl));
      const bad = urls.filter((_, j) => !ok[j]);
      if (bad.length) broken.push({ doc: d, brokenUrls: bad });
    }));
    done = Math.min(i + BATCH, entries.length);
    if (onProgress) onProgress(done, entries.length);
  }
  return broken;
}

// Charge tous les items à vérifier : publics + (admin) sensibles fusionnés.
// Les images d'un item sensible peuvent vivre dans items_hidden OU items_secret selon le split gameplay/secret.
async function _loadItemDocsForImageCheck() {
  const pub = await cachedDocs('items').catch(() => []);
  if (ctx.role !== 'admin') return pub;
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const secretById = new Map(secret.map(s => [String(s.id), s]));
  const seen = new Set();
  const sensible = [];
  for (const h of hidden) {
    const s = h.id ? (secretById.get(String(h.id)) || {}) : {};
    sensible.push({ ...h, ...s, _docKey: h._docKey, _sensible: true });
    if (h.id) seen.add(String(h.id));
  }
  for (const s of secret) {
    if (!seen.has(String(s.id))) sensible.push({ ...s, _sensible: true });
  }
  return [...pub, ...sensible];
}

// Ouvre le bon éditeur pour un item public ou sensible depuis la liste "Tableau de chasse".
window._openItemForCompletion = async function(key, sensible, origin) {
  if (!sensible) { showEditor('items', key, null, origin || 'completion'); return; }
  const [hidden, secret] = await Promise.all([
    cachedDocs(COL.itemsHidden).catch(() => []),
    cachedDocs(COL.itemsSecret).catch(() => []),
  ]);
  const h = hidden.find(x => x._docKey === key);
  if (!h) { toast('⛔ Item sensible introuvable.', 'error'); return; }
  const s = h.id ? (secret.find(x => String(x._docKey) === String(h.id)) || {}) : {};
  const merged = {};
  for (const [k, v] of Object.entries(h)) { if (k !== '_docKey') merged[k] = v; }
  for (const [k, v] of Object.entries(s)) { if (k !== '_docKey') merged[k] = v; }
  showEditor('items_sensible', key, merged, origin || 'completion');
};

function _fieldEmpty(d, fieldId) {
  // L'évènement n'est requis que pour les items du palier Event
  if (fieldId === 'event') return d.palier === 'event' && !(typeof d.event === 'string' && d.event);
  if (fieldId === 'coords') return !d.coords || d.coords.x == null;
  // img et images sont interchangeables : si l'un est rempli, l'autre n'est pas manquant
  if (fieldId === 'img' || fieldId === 'images' || fieldId === 'image') {
    const hasImg    = d.img   != null && d.img   !== '';
    const hasImage  = d.image != null && d.image !== '';
    const hasImages = Array.isArray(d.images) && d.images.length > 0 && d.images.some(x => x != null && x !== '');
    return !hasImg && !hasImage && !hasImages;
  }
  const v = d[fieldId];
  if (v == null || v === '') return true;
  if (Array.isArray(v) && v.length === 0) return true;
  return false;
}

function _subcatLabel(mode, subcatId) {
  return (QUALITY_SUBCATEGORIES[mode] || []).find(s => s.id === subcatId)?.label || subcatId || null;
}
}
