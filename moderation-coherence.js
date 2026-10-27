// ══════════════════════════════════════════════════════
// COHÉRENCE DES ITEMS — valeurs qui n'existent pas dans le jeu (stat, panoplie, classe, effet, rareté…)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// Les autres contrôles (liens morts, IDs fantômes, champs requis…) ont leurs propres onglets.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, setHash: _setHash, showPanel: _showPanel, COL, escHtml } = ctx;

const RARITY_TAG = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique', godlike: 'Godlike', event: 'Event' };
const PALIER_TAG = { 1: 'Palier 1', 2: 'Palier 2', 3: 'Palier 3' };
const SLOTS_BY_CAT = {
  arme:       ['arme_p', 'arme_s'],
  armure:     ['casque', 'plastron', 'jambières', 'bottes'],
  accessoire: ['anneau', 'amulette', 'bracelet', 'artefact', 'gants'],
};
const HAS_LVL = ['arme', 'armure', 'accessoire'];

// Les référentiels (stats, classes, effets, raretés, catégories) viennent des scripts de données chargés par la page
const keysOf = o => new Set(Object.keys(o || {}));
const idsOf = a => new Set((a || []).map(x => x.id));

/** Règles : { label, sev, items: [{ id, name, msg }] } — « error » = valeur inexistante, « warn » = suspect. */
function analyse(items, sets) {
  const rarities = keysOf(typeof RARITIES !== 'undefined' ? RARITIES : null);
  const categories = keysOf(typeof CATEGORIES !== 'undefined' ? CATEGORIES : null);
  const stats = idsOf(typeof ALL_STATS !== 'undefined' ? ALL_STATS : null);
  const classes = idsOf(typeof CLASSES !== 'undefined' ? CLASSES : null);
  const effects = keysOf(typeof EFFECT_META !== 'undefined' ? EFFECT_META : null);
  const maxLvl = typeof MAX_LEVEL !== 'undefined' ? MAX_LEVEL : 999;
  const setIds = new Set(sets.map(s => s.id));

  const R = {
    rarity:   { label: 'Rareté inconnue',                  sev: 'error', items: [] },
    category: { label: 'Catégorie inconnue',               sev: 'error', items: [] },
    slot:     { label: 'Slot incohérent avec la catégorie', sev: 'error', items: [] },
    stat:     { label: 'Stat inconnue',                    sev: 'error', items: [] },
    range:    { label: 'Fourchette de stat invalide',      sev: 'error', items: [] },
    set:      { label: 'Panoplie inexistante',             sev: 'error', items: [] },
    classes:  { label: 'Classe inconnue',                  sev: 'error', items: [] },
    effect:   { label: 'Effet inconnu',                    sev: 'error', items: [] },
    lvl:      { label: `Niveau hors de [1, ${maxLvl}]`,    sev: 'warn',  items: [] },
    tagRar:   { label: 'Tag de rareté ≠ rareté',           sev: 'warn',  items: [] },
    tagPal:   { label: 'Tag de palier ≠ palier',           sev: 'warn',  items: [] },
    tagTypo:  { label: 'Tag au pluriel (« Armes »…)',      sev: 'warn',  items: [] },
  };
  const add = (k, it, msg) => R[k].items.push({ id: it.id, name: it.name || '', msg });

  for (const it of items) {
    if (it.rarity && rarities.size && !rarities.has(it.rarity)) add('rarity', it, `« ${it.rarity} »`);
    if (it.category && categories.size && !categories.has(it.category)) add('category', it, `« ${it.category} »`);
    if (it.cat && SLOTS_BY_CAT[it.category] && !SLOTS_BY_CAT[it.category].includes(it.cat)) add('slot', it, `${it.cat} pour ${it.category}`);
    for (const [k, v] of Object.entries(it.stats || {})) {
      if (stats.size && !stats.has(k)) add('stat', it, k);
      if (Array.isArray(v) && (v.length !== 2 || v[0] >= v[1])) add('range', it, `${k} : [${v.join(', ')}]`);
    }
    if (it.set && !setIds.has(it.set)) add('set', it, it.set);
    for (const c of it.classes || []) if (classes.size && !classes.has(c)) add('classes', it, c);
    for (const e of it.effects || []) if (e.type && effects.size && !effects.has(e.type)) add('effect', it, e.type);
    if (HAS_LVL.includes(it.category) && it.lvl != null && (it.lvl <= 0 || it.lvl > maxLvl)) add('lvl', it, `lvl ${it.lvl}`);

    const tags = it.tags || [];
    const rt = RARITY_TAG[it.rarity];
    if (rt && Object.values(RARITY_TAG).some(t => tags.includes(t)) && !tags.includes(rt)) {
      add('tagRar', it, `${Object.values(RARITY_TAG).filter(t => tags.includes(t)).join(', ')} au lieu de ${rt}`);
    }
    const pt = PALIER_TAG[it.palier];
    if (pt && Object.values(PALIER_TAG).some(t => tags.includes(t)) && !tags.includes(pt)) {
      add('tagPal', it, `${Object.values(PALIER_TAG).filter(t => tags.includes(t)).join(', ')} au lieu de ${pt}`);
    }
    const typo = tags.filter(t => ['Armes', 'Armures', 'Accessoires'].includes(t));
    if (typo.length) add('tagTypo', it, typo.join(', '));
  }
  return R;
}

function render(R, count) {
  const sections = Object.values(R).filter(r => r.items.length);
  const errors = Object.values(R).filter(r => r.sev === 'error').reduce((n, r) => n + r.items.length, 0);
  const warns = Object.values(R).filter(r => r.sev === 'warn').reduce((n, r) => n + r.items.length, 0);
  const head = `<div style="font-size:12px;color:var(--muted);margin-bottom:12px;">${count} items analysés — `
    + `<b style="color:${errors ? 'var(--danger)' : 'var(--success, #4ade80)'}">${errors} erreur${errors > 1 ? 's' : ''}</b>, ${warns} avertissement${warns > 1 ? 's' : ''}</div>`;
  if (!sections.length) return head + '<div class="empty">✓ Aucune incohérence détectée.</div>';
  return head + sections.map(r => `<details ${r.sev === 'error' ? 'open' : ''} style="margin-bottom:10px;">
      <summary style="cursor:pointer;font-weight:700;font-size:13px;color:${r.sev === 'error' ? 'var(--danger)' : '#e8d44a'};">
        ${r.sev === 'error' ? '❌' : '⚠️'} ${escHtml(r.label)} <span style="opacity:.7;font-weight:400;">(${r.items.length})</span></summary>
      <div style="margin-top:6px;">${r.items.map(i => `<div style="display:flex;gap:10px;padding:5px 10px;border-bottom:1px solid var(--border);font-size:12px;">
        <a href="Compendium/compendium.html#${encodeURIComponent(i.id)}" target="_blank" rel="noopener" style="min-width:230px;color:var(--accent);">${escHtml(i.name || i.id)}</a>
        <span style="color:var(--muted);">${escHtml(i.msg)}</span></div>`).join('')}</div>
    </details>`).join('');
}

window.showCoherence = async function showCoherence() {
  _setHash('coherence');
  _showPanel('coherence-panel', 'btn-coherence');
  await window.loadCoherence();
};

window.loadCoherence = async function loadCoherence() {
  const box = document.getElementById('coherence-list');
  if (!box) return;
  box.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [items, sets] = await Promise.all([cachedDocs(COL.items), cachedDocs(COL.panoplies)]);
    const R = analyse(items, sets);
    box.innerHTML = render(R, items.length);
    const n = Object.values(R).filter(r => r.sev === 'error').reduce((a, r) => a + r.items.length, 0);
    const badge = document.getElementById('count-coherence');
    if (badge) { badge.textContent = n; badge.style.display = n ? '' : 'none'; }
  } catch (e) {
    box.innerHTML = `<div class="empty" style="color:var(--danger)">Erreur : ${escHtml(e.message)}</div>`;
  }
};
}
