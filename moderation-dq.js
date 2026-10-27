// ══════════════════════════════════════════════════════
// QUALITÉ DES DONNÉES — tri par palier et « mettre de côté » sur les onglets-listes (chargé au démarrage)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { modCache: _modCache } = ctx;
// Couche commune posée sur les onglets-listes du hub. Elle observe chaque panneau et, après chaque rendu :
//  - ajoute un badge de palier à chaque ligne et permet de trier par palier ;
//  - (aside: true) ajoute « ⏸ Mettre de côté » : la ligne descend tout en bas, sous un séparateur.
// Les onglets qui ont déjà leur propre « ignorer » (orphelins, Tableau de Chasse) gardent le leur et gagnent le tri.
// Préférences (tri, lignes mises de côté) : localStorage, propres à chaque navigateur.
const DQ_PANELS = [
  { panel: 'dead-links-panel',    aside: true },
  { panel: 'ghost-id-panel',      aside: true },
  { panel: 'orphan-ids-panel',    aside: true },
  { panel: 'self-craft-panel',    aside: true },
  { panel: 'obtain-legacy-panel', aside: true },
  { panel: 'region-orphan-panel', aside: false },
  { panel: 'mob-orphan-panel',    aside: false },
  { panel: 'quest-orphan-panel',  aside: false },
  { panel: 'completion-panel',    aside: false, onSort: () => window.renderCompletion?.() },
];
const _DQ_ASIDE = 'vcl_dq_aside', _DQ_SORT = 'vcl_dq_sort';
const _dqLoad = k => { try { return JSON.parse(localStorage.getItem(k) || '{}'); } catch { return {}; } };
const _dqSave = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
const _dqAside = p => new Set(_dqLoad(_DQ_ASIDE)[p] || []);
function _dqToggleAside(p, key) {
  const d = _dqLoad(_DQ_ASIDE), s = new Set(d[p] || []);
  s.has(key) ? s.delete(key) : s.add(key);
  d[p] = [...s]; _dqSave(_DQ_ASIDE, d);
}
const _dqSort = p => _dqLoad(_DQ_SORT)[p] || 'default';
function _dqRank(p) {
  if (p == null || p === '') return 3000;
  if (p === 'event') return 1000;
  const n = Number(p);
  return Number.isNaN(n) ? 3000 : n < 0 ? 2000 : n;
}
function _dqLabel(p) {
  if (p == null || p === '') return '—';
  if (p === 'event') return 'Event';
  const n = Number(p);
  return Number.isNaN(n) ? '—' : n < 0 ? 'Archive' : 'P' + n;
}
window._dqRank = _dqRank;
window._dqSort = _dqSort;

// Paliers connus : uniquement depuis le cache déjà chargé par les onglets (aucune lecture Firestore en plus).
function _dqPalierMap() {
  const m = new Map();
  for (const col of ['items', 'items_hidden', 'mobs', 'personnages', 'quetes', 'regions'])
    for (const d of (_modCache[col] || [])) if (d.id && d.palier != null) m.set(d.id, d.palier);
  return m;
}
function _dqPalierOf(ids, map) {
  for (const id of ids) {
    if (map.has(id)) return map.get(id);
    const m = id.match(/_p(\d+)(?:_\d+)?$/);
    if (m) return +m[1];
  }
  return null;
}

function _dqBar(cfg) {
  const panel = document.getElementById(cfg.panel);
  if (!panel) return null;
  let bar = panel.querySelector(':scope > .dq-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.className = 'dq-bar';
    bar.innerHTML = `<span class="dq-bar-label">Trier</span>
      <button class="diag-tab" data-dq-sort="default">Ordre d'origine</button>
      <button class="diag-tab" data-dq-sort="palier">Par palier</button>
      <span class="dq-bar-aside" style="display:none;"></span>`;
    bar.addEventListener('click', e => {
      const s = e.target.closest('[data-dq-sort]');
      if (s) {
        const d = _dqLoad(_DQ_SORT); d[cfg.panel] = s.dataset.dqSort; _dqSave(_DQ_SORT, d);
        cfg.onSort ? cfg.onSort() : _dqEnhance(cfg);
        _dqBarState(cfg, bar._asideCount || 0);
      } else if (e.target.closest('[data-dq-clear]')) {
        const d = _dqLoad(_DQ_ASIDE); delete d[cfg.panel]; _dqSave(_DQ_ASIDE, d);
        _dqEnhance(cfg);
      }
    });
    const tabs = panel.querySelector(':scope > .diag-tabs');
    tabs ? tabs.after(bar) : panel.prepend(bar);
  }
  return bar;
}
function _dqBarState(cfg, asideCount = 0) {
  const bar = _dqBar(cfg);
  if (!bar) return;
  bar._asideCount = asideCount;
  const mode = _dqSort(cfg.panel);
  bar.querySelectorAll('[data-dq-sort]').forEach(b => b.classList.toggle('active', b.dataset.dqSort === mode));
  const a = bar.querySelector('.dq-bar-aside');
  if (a) {
    a.style.display = cfg.aside && asideCount ? '' : 'none';
    a.innerHTML = `⏸ ${asideCount} mis de côté <button class="diag-tab" data-dq-clear="1">Tout remettre</button>`;
  }
}

const _dqObs = new Map();
async function _dqEnhance(cfg) {
  const panel = document.getElementById(cfg.panel);
  if (!panel) return;
  const findGroups = () => [...panel.querySelectorAll('table.ghost-table > tbody')].map(box => ({ box, tr: true }))
    .concat([...panel.querySelectorAll('[data-dq-list]')].map(box => ({ box, tr: false })));
  if (!findGroups().length) return;   // rien à traiter : on ne lit rien dans Firestore
  const map = _dqPalierMap();
  const obs = _dqObs.get(cfg.panel);
  obs?.disconnect();   // nos propres modifications du DOM ne doivent pas relancer le traitement
  try {
    const aside = cfg.aside ? _dqAside(cfg.panel) : new Set();
    const mode = _dqSort(cfg.panel);
    let asideTotal = 0;
    const groups = findGroups();
    for (const g of groups) {
      const units = [];
      for (const el of [...g.box.children]) {
        if (el.classList.contains('dq-sep')) continue;
        if (g.tr && el.dataset.fixRow && units.length) { units[units.length - 1].els.push(el); continue; }
        if (!g.tr && el.dataset.dqKey === undefined) continue;
        units.push({ els: [el], idx: units.length });
      }
      for (const u of units) {
        const head = u.els[0];
        if (head.dataset.dqDone === undefined) {
          const cells = g.tr ? [...head.children] : [];
          if (g.tr) head.dataset.dqKey = cells.slice(0, Math.max(1, cells.length - 1)).map(c => {
            const t = c.cloneNode(true);
            t.querySelectorAll('.dl-staged-new, .dq-pal').forEach(n => n.remove());   // l'état « en attente » ne fait pas partie de l'identité de la ligne
            return t.textContent.replace(/\s+/g, ' ').trim();
          }).join('|');
          const ids = [...head.querySelectorAll('.ghost-id')].map(s => s.textContent.trim());
          if (head.dataset.dqId) ids.unshift(head.dataset.dqId);
          head.dataset.dqPal = _dqPalierOf(ids, map) ?? '';
          head.dataset.dqIdx = u.idx;
          const badge = document.createElement('span');
          badge.className = 'dq-pal';
          badge.textContent = _dqLabel(head.dataset.dqPal === '' ? null : head.dataset.dqPal);
          (g.tr ? cells[0] : (head.querySelector('[data-dq-badge]') || head)).prepend(badge);
          if (cfg.aside) {
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost dq-aside-btn';
            btn.addEventListener('click', () => { _dqToggleAside(cfg.panel, head.dataset.dqKey); _dqEnhance(cfg); });
            (g.tr ? cells[cells.length - 1] : head).appendChild(btn);
          }
          head.dataset.dqDone = '1';
        }
        u.key = head.dataset.dqKey;
        u.pal = head.dataset.dqPal === '' ? null : head.dataset.dqPal;
        u.aside = aside.has(u.key);
        u.idx = +head.dataset.dqIdx;
        const btn = head.querySelector('.dq-aside-btn');
        if (btn) { btn.textContent = u.aside ? '↩ Remettre' : '⏸ Mettre de côté'; btn.title = u.aside ? 'Remettre dans la liste' : 'Mettre de côté : la ligne descend tout en bas'; }
        u.els.forEach(e => { e.style.opacity = u.aside ? '.5' : ''; });
        if (u.aside) asideTotal++;
      }
      units.sort((a, b) => (a.aside - b.aside) || (mode === 'palier' ? _dqRank(a.pal) - _dqRank(b.pal) : 0) || a.idx - b.idx);
      const tail = g.tr ? null : [...g.box.children].find(c => c.dataset.dqKey === undefined && !c.classList.contains('dq-sep'));
      let sep = [...g.box.children].find(c => c.classList.contains('dq-sep'));
      const wantSep = units.some(u => u.aside);
      if (!wantSep && sep) { sep.remove(); sep = null; }
      if (wantSep && !sep) {
        sep = document.createElement(g.tr ? 'tr' : 'div');
        sep.className = 'dq-sep';
        const label = '⏸ Mis de côté';
        if (g.tr) sep.innerHTML = `<td colspan="${g.box.closest('table').querySelectorAll('thead th').length || 5}">${label}</td>`;
        else sep.textContent = label;
      }
      const desired = [];
      for (const u of units) {
        if (u.aside && sep && !desired.includes(sep)) desired.push(sep);
        desired.push(...u.els);
      }
      // On ne déplace rien si l'ordre est déjà bon : déplacer un nœud fait perdre le focus d'un champ de saisie qu'il contient
      const current = [...g.box.children].filter(c => desired.includes(c));
      if (desired.some((e, i) => current[i] !== e)) desired.forEach(e => g.box.insertBefore(e, tail));
    }
    _dqBarState(cfg, asideTotal);
  } finally {
    obs?.observe(panel, { childList: true, subtree: true });
  }
}

function _dqInit() {
  for (const cfg of DQ_PANELS) {
    const panel = document.getElementById(cfg.panel);
    if (!panel) continue;
    _dqBarState(cfg);
    let t = null;
    // On ignore ce qui se passe dans les lignes d'édition (saisie, menus déroulants) : seule la liste elle-même nous concerne
    const obs = new MutationObserver(recs => {
      if (recs.every(r => r.target.closest?.('[data-fix-row], .dq-bar'))) return;
      clearTimeout(t); t = setTimeout(() => _dqEnhance(cfg), 80);
    });
    _dqObs.set(cfg.panel, obs);
    obs.observe(panel, { childList: true, subtree: true });
  }
}
_dqInit();
}
