// ══════════════════════════════════════════════════════
// TAGS — Règles automatiques de tags sur items
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { escHtml, setHash: _setHash, db, collection, getDocs, getDoc, doc, updateDoc, setDoc, toast } = ctx;
const ITEM_TAG_FIELDS = [
  { id: 'category', label: 'Catégorie', values: ['arme','armure','accessoire','consommable','nourriture','materiaux','ressources','outils','rune','parchemin','quete','donjon','monnaie'] },
  { id: 'rarity',   label: 'Rareté',   values: ['commun','rare','epique','legendaire','mythique','godlike','event'] },
  { id: 'classes',  label: 'Classe',   values: ['guerrier','assassin','archer','mage','shaman'] },
  { id: 'palier',   label: 'Palier',   values: ['1','2','3','4','5','6','7','8','9','10'] },
  { id: 'cat',      label: 'Cat/Slot', values: [] },
  { id: 'type',     label: 'Type',     values: [] },
  { id: 'slot',     label: 'Slot',     values: [] },
  { id: 'sensible',  label: 'Sensible',  values: ['true','false'] },
  { id: 'twoHanded', label: 'Deux mains', values: ['true','false'] },
];

const SEL_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:12px;outline:none;';

let _tagRules = [];

window.showTagsPanel = function() {
  _setHash('tags');
  document.getElementById('tags-panel').style.display = '';
  document.getElementById('btn-tags')?.classList.add('active');
  _initTagRuleForm();
  loadTagRules();
};

function _initTagRuleForm() {
  const fieldSel = document.getElementById('tag-rule-field');
  if (!fieldSel || fieldSel.options.length > 0) return;
  ITEM_TAG_FIELDS.forEach(f => {
    const opt = document.createElement('option');
    opt.value = f.id;
    opt.textContent = f.label;
    fieldSel.appendChild(opt);
  });
  updateTagRuleValueOptions();
}

window.updateTagRuleValueOptions = function() {
  const fieldEl = document.getElementById('tag-rule-field');
  const wrap    = document.getElementById('tag-rule-value-wrap');
  if (!fieldEl || !wrap) return;
  const field = ITEM_TAG_FIELDS.find(f => f.id === fieldEl.value);
  const label = wrap.querySelector('label');
  wrap.innerHTML = '';
  if (label) wrap.appendChild(label); else {
    const l = document.createElement('label');
    l.style.cssText = 'font-size:11px;color:var(--muted);';
    l.textContent = 'Valeur';
    wrap.appendChild(l);
  }
  if (field && field.values.length > 0) {
    const sel = document.createElement('select');
    sel.id = 'tag-rule-value';
    sel.style.cssText = SEL_STYLE + 'width:150px;';
    field.values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
    wrap.appendChild(sel);
  } else {
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.id = 'tag-rule-value';
    inp.placeholder = 'valeur…';
    inp.style.cssText = SEL_STYLE + 'width:140px;';
    wrap.appendChild(inp);
  }
};

window.loadTagRules = async function() {
  try {
    const snap = await getDoc(doc(db, 'config', 'tag_rules'));
    _tagRules = snap.exists() ? (snap.data().rules || []) : [];
  } catch { _tagRules = []; }
  renderTagRulesList();
};

function renderTagRulesList() {
  const listEl = document.getElementById('tag-rules-list');
  if (!listEl) return;
  if (!_tagRules.length) {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--muted);">Aucune règle définie.</div>';
    return;
  }
  listEl.innerHTML = '';
  _tagRules.forEach((rule, i) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:6px 12px;border-bottom:1px solid var(--border);font-size:12px;';
    const fieldLabel = ITEM_TAG_FIELDS.find(f => f.id === rule.field)?.label || rule.field;
    row.innerHTML = `
      <span style="color:var(--muted);min-width:80px;">${escHtml(fieldLabel)}</span>
      <span style="color:var(--text);">=</span>
      <span style="font-weight:600;min-width:80px;">${escHtml(String(rule.value))}</span>
      <span style="color:var(--muted);">→ 🏷️</span>
      <span style="color:var(--accent);font-weight:600;">${escHtml(rule.tag)}</span>
      <button class="btn btn-ghost" onclick="deleteTagRule(${i})" style="font-size:11px;padding:2px 8px;margin-left:auto;">✕</button>
    `;
    listEl.appendChild(row);
  });
}

window.addTagRule = async function() {
  const field = document.getElementById('tag-rule-field')?.value;
  const value = (document.getElementById('tag-rule-value')?.value || '').trim();
  const tag   = (document.getElementById('tag-rule-tag')?.value  || '').trim();
  if (!field || !value || !tag) { toast('Remplis tous les champs.', 'warning'); return; }
  _tagRules.push({ field, value, tag });
  await _saveTagRules();
  renderTagRulesList();
  if (document.getElementById('tag-rule-value')) document.getElementById('tag-rule-value').value = '';
  if (document.getElementById('tag-rule-tag'))   document.getElementById('tag-rule-tag').value   = '';
};

window.deleteTagRule = async function(index) {
  _tagRules.splice(index, 1);
  await _saveTagRules();
  renderTagRulesList();
};

async function _saveTagRules() {
  await setDoc(doc(db, 'config', 'tag_rules'), { rules: _tagRules });
}

window.seedDefaultTagRules = async function() {
  const defaults = [
    // Rareté
    { field: 'rarity', value: 'commun',     tag: 'Commun' },
    { field: 'rarity', value: 'rare',       tag: 'Rare' },
    { field: 'rarity', value: 'epique',     tag: 'Épique' },
    { field: 'rarity', value: 'legendaire', tag: 'Légendaire' },
    { field: 'rarity', value: 'mythique',   tag: 'Mythique' },
    { field: 'rarity', value: 'godlike',    tag: 'Godlike' },
    { field: 'rarity', value: 'event',      tag: 'Event' },
    // Classe
    { field: 'classes', value: 'guerrier',  tag: 'Guerrier' },
    { field: 'classes', value: 'assassin',  tag: 'Assassin' },
    { field: 'classes', value: 'archer',    tag: 'Archer' },
    { field: 'classes', value: 'mage',      tag: 'Mage' },
    { field: 'classes', value: 'shaman',    tag: 'Shaman' },
    // Slot
    { field: 'category', value: 'anneau',   tag: 'Anneau' },
    { field: 'category', value: 'amulette', tag: 'Amulette' },
    { field: 'category', value: 'bracelet', tag: 'Bracelet' },
    { field: 'category', value: 'artefact', tag: 'Artefact' },
    { field: 'category', value: 'casque',   tag: 'Casque' },
    { field: 'category', value: 'plastron', tag: 'Plastron' },
    { field: 'category', value: 'jambières',tag: 'Jambières' },
    { field: 'category', value: 'bottes',   tag: 'Bottes' },
    { field: 'category', value: 'gants',    tag: 'Gants' },
    { field: 'category', value: 'arme_s',   tag: 'Bouclier' },
    // Catégorie item
    { field: 'cat', value: 'materiaux',     tag: 'Matériau' },
    { field: 'cat', value: 'ressources',    tag: 'Ressource' },
    { field: 'cat', value: 'consommable',   tag: 'Consommable' },
    { field: 'cat', value: 'nourriture',    tag: 'Nourriture' },
    { field: 'cat', value: 'outils',        tag: 'Outil' },
    { field: 'cat', value: 'rune',          tag: 'Rune' },
    { field: 'cat', value: 'parchemin',     tag: 'Parchemin' },
    { field: 'cat', value: 'quete',         tag: 'Quête' },
    { field: 'cat', value: 'donjon',        tag: 'Donjon' },
    // Palier
    { field: 'palier', value: '1',  tag: 'Palier 1' },
    { field: 'palier', value: '2',  tag: 'Palier 2' },
    { field: 'palier', value: '3',  tag: 'Palier 3' },
    { field: 'palier', value: '4',  tag: 'Palier 4' },
    { field: 'palier', value: '5',  tag: 'Palier 5' },
    { field: 'palier', value: '6',  tag: 'Palier 6' },
    { field: 'palier', value: '7',  tag: 'Palier 7' },
    { field: 'palier', value: '8',  tag: 'Palier 8' },
    { field: 'palier', value: '9',  tag: 'Palier 9' },
    { field: 'palier', value: '10', tag: 'Palier 10' },
  ];
  // merge: keep existing rules not in defaults, add defaults not already present
  const existing = _tagRules.filter(r => !defaults.some(d => d.field === r.field && d.value === r.value && d.tag === r.tag));
  _tagRules = [...existing, ...defaults];
  await _saveTagRules();
  renderTagRulesList();
  toast(`✅ ${defaults.length} règles par défaut chargées.`, 'success');
};

window.applyTagRules = async function() {
  const statusEl = document.getElementById('tag-apply-status');
  if (statusEl) statusEl.textContent = '⏳ Application en cours…';
  let updated = 0, errors = 0;
  for (const col of ['items', 'items_secret']) {
    try {
      const snap = await getDocs(collection(db, col));
      for (const d of snap.docs) {
        const data = d.data();
        const currentTags = Array.isArray(data.tags) ? [...data.tags] : [];
        const newTags = [...currentTags];
        for (const rule of _tagRules) {
          const val = data[rule.field];
          const match = Array.isArray(val)
            ? val.map(String).includes(String(rule.value))
            : String(val) === String(rule.value);
          if (match && !newTags.includes(rule.tag)) newTags.push(rule.tag);
        }
        if (newTags.length !== currentTags.length || newTags.some((t, i) => t !== currentTags[i])) {
          try {
            await updateDoc(doc(db, col, d.id), { tags: newTags });
            updated++;
          } catch { errors++; }
        }
      }
    } catch { errors++; }
  }
  if (statusEl) statusEl.textContent = `✅ ${updated} item(s) mis à jour.${errors ? ` ${errors} erreur(s).` : ''}`;
};
}
