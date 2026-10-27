// ══════════════════════════════════════════════════════
// OBTENTIONS LIBRES (non structurées)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { cachedDocs, invalidateModCache, setHash: _setHash, showPanel: _showPanel, COL, doc, escHtml } = ctx;
// Patterns reconnus par le builder structuré (y compris anciens formats pour compatibilité)
const OBTAIN_STRUCTURED_PATTERNS = [
  /^Obtenable en tuant:$/,
  /^Obtenable en finissant le donjon:$/,
  /^-\s*\[([^|]+)\|([^\]]+)\]\[([^\]]+)\]$/,
  /^Obtenable en récompense du \[npc:[^|]+\|[^\]]+\]$/,
  /^Fabricable au \[npc:[^|]+\|[^\]]+\]$/,
  /^\[obtain:[\w-]+\]$/,
  /^Fabricable à la Forge( du Fractured Underworld)?$/,
  /^Achetable au \[npc:[^|]+\|[^\]]+\]$/,
  /^Récompense de la quête \[quest:[^|]+\|[^\]]+\]$/,
  /^Récompenses des quêtes\s*:$/,
  /^-\s*\[quest:[^|]+\|[^\]]+\]$/,
  /^Récoltable dans \[region:[^|]+\|[^\]]+\]$/,
  /^Autre source — .+$/,
  /^Récoltable dans \[region:[^|]+\|[^\]]+\]\s*\[coords:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]$/,
  /^Récoltable aux coordonnées \[coords:-?\d+(?:\.\d+)?,-?\d+(?:\.\d+)?\]$/,
  /^Obtenable pendant l'Event \[.+\]$/,
  // Anciens formats (compatibilité)
  /^Trouvable dans un coffre — .+$/,
  /^Récompense d'événement — .+$/,
  /^Trouvable en exploration — .+$/,
];

function _isObtainStructured(obtain) {
  if (!obtain || !obtain.trim()) return true;
  for (const line of obtain.split('\n')) {
    const t = line.trim();
    if (!t) continue;
    if (!OBTAIN_STRUCTURED_PATTERNS.some(rx => rx.test(t))) return false;
  }
  return true;
}

let _obtainLegacyAll  = [];
let _obtainLegacyShown = [];

window.showObtainLegacy = async function() {
  _setHash('obtain-legacy');
  _showPanel('obtain-legacy-panel', 'btn-obtain-legacy');
  await loadObtainLegacy();
};

window.loadObtainLegacy = async function() {
  const listEl = document.getElementById('obtain-legacy-list');
  listEl.innerHTML = '<div class="empty">Chargement…</div>';
  _obtainLegacyAll = [];

  // Invalider le cache pour avoir des données fraîches
  invalidateModCache('items');
  invalidateModCache(COL.itemsSecret);
  invalidateModCache(COL.itemsHidden);

  try {
    const [publicItems, secretItems, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs(COL.itemsSecret).catch(() => []),
      cachedDocs(COL.itemsHidden).catch(() => []),
    ]);

    // Map id → hidden doc (name, rarity, category) pour enrichir les items sensibles
    const hiddenById = new Map(hiddenItems.map(h => [String(h.id), h]));

    const sensibleItems = secretItems
      .filter(s => s.obtain)
      .map(s => {
        const h = hiddenById.get(String(s.id)) || {};
        return { ...h, ...s, _isSensible: true };
      });

    _obtainLegacyAll = [...publicItems, ...sensibleItems]
      .filter(i => i.obtain && !_isObtainStructured(i.obtain));
  } catch(e) {
    listEl.innerHTML = '<div class="empty">Erreur : ' + e.message + '</div>';
    return;
  }

  const badge = document.getElementById('count-obtain-legacy');
  if (badge) {
    badge.textContent = _obtainLegacyAll.length;
    badge.style.display = _obtainLegacyAll.length ? '' : 'none';
  }

  filterObtainLegacy();
};

window.filterObtainLegacy = function() {
  const q   = (document.getElementById('obtain-legacy-search')?.value || '').toLowerCase();
  const cat = document.getElementById('obtain-legacy-cat')?.value || '';
  _obtainLegacyShown = _obtainLegacyAll.filter(i => {
    if (cat && i.category !== cat) return false;
    if (q && !((i.name || '').toLowerCase().includes(q)) && !((i.obtain || '').toLowerCase().includes(q))) return false;
    return true;
  });
  _renderObtainLegacy();
};

function _renderObtainLegacy() {
  const listEl = document.getElementById('obtain-legacy-list');
  if (!_obtainLegacyShown.length) {
    listEl.innerHTML = '<div class="empty">' + (_obtainLegacyAll.length ? 'Aucun résultat pour ce filtre.' : '✓ Aucun item avec obtention libre — tout est structuré !') + '</div>';
    return;
  }

  const RARITY_COLORS = { commun:'#aaa', rare:'#4da6ff', epique:'#c47aff', legendaire:'#ffb830', mythique:'#ff6060', godlike:'#ff3aba', event:'#60e8b0' };
  const CAT_ICONS = { arme:'⚔️', armure:'🛡️', accessoire:'💍', consommable:'🧪', nourriture:'🍖', parchemin:'📃', materiaux:'🧱', ressources:'⛏️', outils:'🛠️', rune:'🔮', quete:'📜', donjon:'🏰', monnaie:'🪙' };

  listEl.innerHTML = '';
  listEl.dataset.dqList = '1';
  for (const item of _obtainLegacyShown) {
    const row = document.createElement('div');
    row.dataset.dqKey = String(item.id || item.name || '');
    row.dataset.dqId = String(item.id || '');
    row.style.cssText = 'display:flex;align-items:flex-start;gap:12px;padding:10px 14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);margin-bottom:6px;';

    const rarColor = RARITY_COLORS[item.rarity] || '#aaa';
    const catIcon  = CAT_ICONS[item.category] || '📦';

    const left = document.createElement('div');
    left.style.cssText = 'flex:1;min-width:0;';
    left.innerHTML =
      `<div data-dq-badge="1" style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">` +
        `<span style="font-size:12px;">${catIcon}</span>` +
        `<span style="font-size:14px;font-weight:700;color:${rarColor};">${item.name || '(sans nom)'}</span>` +
        `<span style="font-size:10px;color:var(--muted);font-family:monospace;">${item.id || ''}</span>` +
        (item.rarity ? `<span style="font-size:10px;padding:1px 7px;border-radius:8px;border:1px solid ${rarColor}40;color:${rarColor};background:${rarColor}12;">${item.rarity}</span>` : '') +
      `</div>` +
      `<div style="font-size:11px;color:var(--muted);font-family:monospace;white-space:pre-wrap;background:rgba(0,0,0,.2);border-radius:4px;padding:5px 8px;border-left:2px solid var(--border);">${(item.obtain || '').replace(/</g,'&lt;')}</div>`;

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-ghost';
    editBtn.style.cssText = 'flex-shrink:0;font-size:11px;padding:5px 11px;white-space:nowrap;';
    editBtn.innerHTML = '✏️ Éditer';
    editBtn.onclick = () => {
      sessionStorage.setItem('editSub', JSON.stringify({ type: 'item', data: item }));
      window.open('creator.html', '_blank');
    };

    row.appendChild(left);
    row.appendChild(editBtn);
    listEl.appendChild(row);
  }

  const summary = document.createElement('div');
  summary.style.cssText = 'font-size:11px;color:var(--muted);text-align:right;margin-top:4px;';
  summary.textContent = _obtainLegacyShown.length + ' item' + (_obtainLegacyShown.length > 1 ? 's' : '');
  listEl.appendChild(summary);
}
}
