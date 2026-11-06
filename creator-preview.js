/* Creator — aperçus « comme dans le wiki ».
   Remplace les rendus de creator.js (renderPreview, renderMobPreview, …) par des fiches construites
   avec les MÊMES classes que le compendium / le bestiaire (CSS généré : creator-wiki.css, scope `.wiki`).
   Les données viennent toujours des builders de creator.js (_buildLevelObj, buildMobObj, …). */
(function () {
  'use strict';
  if (typeof window.renderPreview !== 'function') return;

  const esc = s => (typeof escHtml === 'function' ? escHtml(String(s ?? '')) : String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  const wrap = () => document.getElementById('preview-wrap');
  const itemById = id => (typeof ITEMS !== 'undefined' ? ITEMS.find(i => i.id === id) : null);
  const imgOf = o => (o && o.images && o.images[0]) ? String(o.images[0]).replace(/^\.\.\//, '') : '';
  const paliers = () => window._vcl_paliers || (typeof _DEFAULT_PALIERS !== 'undefined' ? _DEFAULT_PALIERS : []);
  const palierLabel = p => { const f = paliers().find(x => String(x.id) === String(p)); return f ? f.label : (p === 'event' ? 'Event' : p === 'worldboss' ? 'World Boss' : p == -1 ? 'Archive' : 'Palier ' + p); };
  const nl = s => esc(s).replace(/\n/g, '<br>');
  const STAR_PATH = 'M12 2.4l2.95 6.2 6.75.85-4.95 4.7 1.25 6.7L12 17.4l-6 3.45 1.25-6.7L2.3 9.45l6.75-.85z';

  function emptyState(html) { wrap().innerHTML = html ? '<div class="wiki">' + html + '</div>' : ''; }
  const section = (title, body, color) => `<div class="item-section-title"${color ? ` style="color:${color}"` : ''}>${title}</div>${body}`;
  const metaBadge = (k, v, cls) => `<span class="item-meta-badge${cls ? ' ' + cls : ''}">${k ? `<span class="imb-key">${esc(k)}</span>` : ''}<span class="imb-val">${esc(v)}</span></span>`;
  const palierBadge = p => { const l = palierLabel(p), m = String(l).match(/^Palier\s+(.+)$/i); return metaBadge(m ? 'Palier' : '', m ? m[1] : l); };
  const chip = (txt, color) => `<span class="item-set-badge" style="color:${color};border-color:${color}55;margin:0">${esc(txt)}</span>`;

  /* ── ITEM ─────────────────────────────────────────────── */
  function statsHtml(obj) {
    const stats = obj.stats || {};
    const reqs = [];
    if (obj.twoHanded) reqs.push('<span class="stat-req-badge">⚔️ Deux mains</span>');
    if (obj.rune_slots) reqs.push(`<span class="stat-req-badge">🔮 ${esc(obj.rune_slots)} rune${obj.rune_slots > 1 ? 's' : ''}</span>`);
    (typeof selClasses !== 'undefined' ? selClasses : []).forEach(c => reqs.push(`<span class="stat-req-badge stat-req-class">${esc(c)}</span>`));
    let rows = '';
    const GROUP_COLORS = ['#e0795a', '#6aa8d8', '#8fcf8a', '#c79af0'];
    const GROUPS = typeof STAT_GROUPS !== 'undefined' ? STAT_GROUPS : (typeof STAT_DEFS !== 'undefined' ? STAT_DEFS : []);
    GROUPS.forEach(({ stats: defs }, gi) => {
      defs.forEach(s => {
        const v = stats[s.id]; if (v == null) return;
        const vs = Array.isArray(v) ? `${v[0]} – ${v[1]}` : String(v);
        rows += `<div class="stat-row" style="--sc:${GROUP_COLORS[gi % 4]}"><span class="stat-row-icon">${esc(s.icon || '')}</span><span class="stat-row-label">${esc(s.label)}</span><span class="stat-row-value">${esc(vs)}${s.unit ? esc(s.unit) : ''}</span></div>`;
      });
    });
    if (!reqs.length && !rows) return '';
    return `<div class="item-stats-panel">${reqs.length ? `<div class="stat-reqs-bar">${reqs.join('')}</div>` : ''}${rows ? `<div class="stat-rows">${rows}</div>` : ''}</div>`;
  }

  function effectsHtml(obj) {
    if (!obj.effects || !obj.effects.length) return '';
    const rows = obj.effects.map(eff => {
      const m = (typeof EFFECT_META !== 'undefined' && EFFECT_META[eff.type]) || { icon: '◆', color: '#aaa', label: eff.type, prefix: '' };
      const color = eff.color || m.color, label = eff.label || m.label, pre = eff.prefix ?? m.prefix ?? '';
      const val = eff.value !== undefined ? `${pre}${eff.value}${eff.unit ? ' ' + eff.unit : ''}` : label;
      const dur = eff.instant ? 'Instantané' : eff.duration ? String(eff.duration) : '';
      return `<div class="effect-row"><div class="effect-icon" style="color:${color}">${esc(eff.icon || m.icon)}</div><div class="effect-body"><div class="effect-label">${esc(label)}</div><div class="effect-value" style="color:${color}">${esc(val)}</div></div>${dur ? `<div class="effect-duration">${esc(dur)}</div>` : ''}</div>`;
    }).join('');
    return `<div class="item-obtain effects-panel">${rows}</div>`;
  }

  function tile(id, qty) {
    const it = itemById(id);
    const color = it ? ((typeof RARITY_COLORS !== 'undefined' && RARITY_COLORS[it.rarity]) || '#666') : '#666';
    const src = imgOf(it);
    const emo = it ? ((typeof CAT_ICONS !== 'undefined' && CAT_ICONS[it.category]) || '📦') : '❓';
    const icon = src ? `<img class="craft-ingredient-img" src="${esc(src)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'craft-ingredient-emoji',textContent:'${emo}'}))">` : `<span class="craft-ingredient-emoji">${emo}</span>`;
    return `<div class="craft-tile"><span class="craft-tile-icon" style="--rc:${color}">${icon}${qty ? `<span class="craft-tile-qty">×${esc(qty)}</span>` : ''}</span><span class="craft-ingredient-name" style="color:${it ? color : '#888'}">${esc(it ? it.name : id)}</span></div>`;
  }

  function craftHtml(obj) {
    if (!obj.craft || !obj.craft.length) return '';
    const color = (typeof RARITY_COLORS !== 'undefined' && RARITY_COLORS[obj.rarity]) || '#666';
    const result = `<div class="craft-arrow"><span>Fabrique</span></div><div class="craft-tile craft-result"><span class="craft-tile-icon" style="--rc:${color}"><span class="craft-ingredient-emoji">${(typeof CAT_ICONS !== 'undefined' && CAT_ICONS[obj.category]) || '📦'}</span>${+obj.craft_qty > 1 ? `<span class="craft-tile-qty">×${+obj.craft_qty}</span>` : ''}</span><span class="craft-ingredient-name" style="color:${color}">${esc(obj.name || '')}</span></div>`;
    return `<div class="item-obtain"><div class="craft-flow"><div class="craft-tiles">${obj.craft.map(c => tile(c.id, c.qty)).join('')}</div>${result}</div></div>`;
  }

  function setHtml(obj) {
    const def = obj.set && typeof SETS !== 'undefined' ? SETS[obj.set] : null;
    if (!def) return '';
    const color = def.color || '#888';
    const lookup = {};
    (typeof STAT_GROUPS !== 'undefined' ? STAT_GROUPS : (typeof STAT_DEFS !== 'undefined' ? STAT_DEFS : [])).forEach(g => g.stats.forEach(s => { lookup[s.id] = s; }));
    const rows = Object.entries(def.bonuses || {}).sort((a, b) => +a[0] - +b[0]).map(([n, st]) => {
      const inner = Object.entries(st || {}).map(([k, v]) => { const sd = lookup[k]; return `<div>${esc(sd ? sd.label : k)} <span class="set-bonus-val" style="color:${color}">${+v < 0 ? v : '+' + v}${sd && sd.unit ? esc(sd.unit) : ''}</span></div>`; }).join('');
      return `<tr><td class="set-bonus-pieces" style="color:${color}">${n} pièces</td><td class="set-bonus-stat">${inner}</td></tr>`;
    }).join('');
    return `<div class="item-sep"></div><div class="item-section-title" style="color:${color}">◈ ${esc(def.label)}</div><div class="item-set-section">${rows ? `<table class="set-bonuses-table">${rows}</table>` : ''}</div>`;
  }

  function itemSheet() {
    const obj = _buildLevelObj();
    if (!obj.id && !obj.name) return '';
    const color = (typeof RARITY_COLORS !== 'undefined' && RARITY_COLORS[obj.rarity]) || '#7a7a90';
    const rl = (typeof RARITY_LABELS !== 'undefined' && RARITY_LABELS[obj.rarity]) || obj.rarity || '';
    const emo = (typeof CAT_ICONS !== 'undefined' && CAT_ICONS[obj.category]) || '📦';
    const src = imgOf(obj);
    const lvl = (typeof starLocked !== 'undefined' && starLocked && starLevel > 0) ? starLevel : (obj.star || 0);
    const stars = lvl > 0 ? `<div class="item-stars">${[1, 2, 3, 4, 5].map(i => `<span class="item-star${i <= lvl ? ' lit' : ''}${i === lvl ? ' active' : ''}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${STAR_PATH}"/></svg></span>`).join('')}</div>` : '';
    const setDef = obj.set && typeof SETS !== 'undefined' ? SETS[obj.set] : null;
    const metas = (obj.palier != null ? palierBadge(obj.palier) : '') + (obj.lvl ? metaBadge('Niveau', obj.lvl, 'imb-lvl') : '');
    const statsBlock = statsHtml(obj), fxBlock = effectsHtml(obj), craftBlock = craftHtml(obj);
    let obtain = '';
    if (obj.obtain && typeof renderObtainHtml === 'function') obtain = renderObtainHtml(resolveObtain(obj.obtain));

    return `<div class="item-sheet" style="--rc:${color}">
      <div class="item-header">
        <div class="item-image-wrap" style="color:${color};border-color:${color}">
          <div class="item-image-bg" style="background:${color}"></div>
          <div class="item-image-border" style="border-color:${color}"></div>
          <div class="item-image-inner">${src
            ? `<img src="${esc(src)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'item-image-placeholder',textContent:'${emo}'}))">`
            : `<span class="item-image-placeholder">${emo}</span>`}</div>
        </div>
        <div class="item-info">
          <div class="item-title-row"><h2 class="item-name">${esc(obj.name || '…')}</h2>${stars}</div>
          ${obj.rarity ? `<div class="item-rarity-badge" style="color:${color};border-color:${color}"><span class="item-rarity-dot" style="background:${color}"></span>${esc(rl)}</div>` : ''}
          ${metas ? `<div class="item-meta-badges">${metas}</div>` : ''}
          ${setDef ? `<div class="item-set-badge" style="color:${setDef.color || '#888'};border-color:${(setDef.color || '#888')}40">◈ ${esc(setDef.label)}</div>` : ''}
          ${obj.lore ? `<blockquote class="item-lore">${nl(obj.lore)}</blockquote>` : ''}
        </div>
      </div>
      ${obtain ? `<div class="item-sep"></div>${section('Comment obtenir cet item', `<div class="item-obtain">${obtain}</div>`)}` : ''}
      ${fxBlock ? section('Effets', fxBlock) : ''}
      ${craftBlock ? section('Craft' + (+obj.craft_qty > 1 ? ' · ×' + +obj.craft_qty : ''), craftBlock) : ''}
      ${statsBlock ? section('Statistiques', statsBlock) : ''}
      ${setHtml(obj)}
      ${obj.tags && obj.tags.length ? `<div class="item-tags">${obj.tags.map(t => `<span class="item-tag">${esc(t)}</span>`).join('')}</div>` : ''}
    </div>`;
  }

  /* ── MOB (bestiaire) ──────────────────────────────────── */
  const TYPE_ACCENT = { boss: '#e05555', worldboss: '#38bdf8', mini_boss: '#b45fd6', miniboss: '#b45fd6', monstre: '#e09050', sbire: '#8090c0' };
  const TYPE_LABEL = { monstre: 'Monstre', miniboss: 'Mini-Boss', mini_boss: 'Mini-Boss', boss: 'Boss', sbire: 'Sbire', worldboss: 'World Boss' };
  const BEH = { passif: ['Passif', '#62b0df'], neutre: ['Neutre', '#d4c07a'], agressif: ['Agressif', '#df6262'] };
  const DIFF_COLORS = ['', '#5fbf7a', '#a3c45c', '#e0ac60', '#e0763c', '#d84a4a'];
  const DIFF_LABELS = ['', 'Facile', 'Simple', 'Moyen', 'Difficile', 'Extrême'];
  const ICO_PIN = '<svg class="mh-ico" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true"><path d="M8 14.6s4.6-4.3 4.6-8A4.6 4.6 0 0 0 3.4 6.6c0 3.7 4.6 8 4.6 8z"/><circle cx="8" cy="6.6" r="1.7"/></svg>';
  const ICO_CLOCK = '<svg class="mh-ico" viewBox="0 0 16 16" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.6V8l2.3 1.5"/></svg>';
  const dropColor = c => (c >= 70 ? '#7fdf62' : c >= 30 ? '#c9a84c' : '#c0392b');
  const regionName = id => ((typeof _allMobRegions !== 'undefined' && _allMobRegions.find(r => r.id === id)) || {}).name || id || '';

  function emblem(p) {
    const e = p === 'event' ? ['★', 'Event'] : p === 'worldboss' ? ['☠', 'World Boss'] : p == -1 ? ['A', 'Archive'] : [String(p), 'Palier'];
    return `<div class="mh-hex"><div class="mh-hex-in"><span class="mh-hex-k">${esc(e[1])}</span><span class="mh-hex-v">${esc(e[0])}</span></div></div>`;
  }

  function mobSheet() {
    const obj = buildMobObj();
    if (!obj.id && !obj.name) return '';
    const accent = TYPE_ACCENT[obj.type] || '#9a7040';
    const src = imgOf(obj) || (obj.img || '');
    const beh = BEH[obj.behavior];
    const diff = Number(obj.difficulty) || 0;
    const tiles = [];
    if (diff) tiles.push(`<div class="mh-tile mh-diff" style="--dc:${DIFF_COLORS[diff]}"><span class="mh-k">Difficulté</span><div class="mh-pips">${[1, 2, 3, 4, 5].map(i => `<i class="mh-pip${i <= diff ? ' on' : ''}" style="--pc:${DIFF_COLORS[i]}"></i>`).join('')}</div><span class="mh-v">${DIFF_LABELS[diff]}</span></div>`);
    if (obj.region) tiles.push(`<div class="mh-tile">${ICO_PIN}<span class="mh-tile-txt"><span class="mh-k">Région</span><span class="mh-v">${esc(regionName(obj.region))}</span></span></div>`);
    if (obj.spawnTime) tiles.push(`<div class="mh-tile mh-time">${ICO_CLOCK}<span class="mh-tile-txt"><span class="mh-k">Temps de spawn</span><span class="mh-v">${esc(obj.spawnTime)}</span></span></div>`);

    const loot = (obj.loot || []).map(l => {
      const it = itemById(l.id);
      const color = it ? ((typeof RARITY_COLORS !== 'undefined' && RARITY_COLORS[it.rarity]) || '#8c8c8c') : '#8c8c8c';
      const pct = l.chance === '?' ? 0 : Math.max(0, Math.min(100, Number(l.chance) || 0)), rc = dropColor(pct);
      const s = imgOf(it);
      return `<div class="loot-row-wrap"><div class="loot-row loot-row-bar" style="--p:${pct}%;--rc:${rc}">${s ? `<div class="loot-img-wrap"><img src="${esc(s)}" alt="" onerror="this.style.display='none'"></div>` : `<span class="loot-dot" style="background:${color}"></span>`}<span class="loot-name" style="color:${color}">${esc(it ? it.name : (l.name || l.id))}</span><span class="loot-drop-rate" style="color:${rc};border-color:${rc}33">${esc(l.chance ?? '?')}${l.chance === '?' ? '' : '%'}</span></div></div>`;
    }).join('');
    const attacks = (obj.attacks || []).map((a, i) => `<div class="mob-attack-row"><span class="attack-n">${i + 1}</span><div class="attack-body"><div class="attack-name">${esc(a.name)}${a.dmg && a.dmg !== '—' && a.dmg !== '?' ? `<span class="attack-dmg">${esc(a.dmg)}</span>` : ''}</div>${a.desc ? `<div class="attack-desc">${esc(a.desc)}</div>` : ''}</div></div>`).join('');

    return `<div class="mob-sheet is-mob" style="--tc:${accent}">
      <div class="mh-hero">
        <div class="mh-portrait">${obj.palier != null && obj.palier !== '' ? emblem(obj.palier) : ''}
          <div class="mob-image-inner">${src ? `<img class="mh-still" src="${esc(src)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">` : ''}<span class="mob-img-placeholder"${src ? ' style="display:none"' : ''}><span class="ph-q">?</span></span></div>
        </div>
        <div class="mh-info">
          <div class="mh-badges">
            ${obj.type ? `<span class="mob-type-badge" style="background:${accent}22;color:${accent};border:1px solid ${accent}55">${esc(TYPE_LABEL[obj.type] || obj.type)}</span>` : ''}
            ${beh ? `<span class="mob-behavior-badge" style="--bc:${beh[1]}"><i></i>${beh[0]}</span>` : ''}
          </div>
          <h2 class="mob-name">${esc(obj.name || '…')}</h2>
          ${tiles.length ? `<div class="mh-stats">${tiles.join('')}</div>` : ''}
        </div>
      </div>
      <div class="mob-body-grid">
        ${attacks ? `<div class="mob-section full-width"><div class="mob-section-title">Attaques<span class="mh-count">${obj.attacks.length}</span></div><div class="mob-attacks-list">${attacks}</div></div>` : ''}
        ${loot ? `<div class="mob-section full-width"><div class="mob-section-title">Butin<span class="mh-count">${obj.loot.length}</span></div><div class="mob-loot-list">${loot}</div></div>` : ''}
        ${obj.lore ? `<div class="mob-section full-width"><div class="mob-section-title">Lore</div><blockquote class="mob-lore">${nl(obj.lore)}</blockquote></div>` : ''}
      </div>
    </div>`;
  }

  /* ── Fiches « génériques » (PNJ, région, quête, panoplie) : même charte, sans image ── */
  function plainSheet({ accent, kicker, name, badges, lore, body }) {
    return `<div class="item-sheet plain-sheet" style="--rc:${accent}">
      <div class="item-header" style="grid-template-columns:1fr;margin-bottom:18px">
        <div class="item-info">
          ${kicker ? `<div class="item-rarity-badge" style="color:${accent};border-color:${accent}">${esc(kicker)}</div>` : ''}
          <h2 class="item-name">${esc(name || '…')}</h2>
          ${badges ? `<div class="item-meta-badges">${badges}</div>` : ''}
          ${lore ? `<blockquote class="item-lore">${nl(lore)}</blockquote>` : ''}
        </div>
      </div>${body || ''}</div>`;
  }
  const row = (name, right, color) => `<div class="loot-row-wrap"><div class="loot-row"><span class="loot-dot" style="background:${color || 'var(--gold)'}"></span><span class="loot-name">${esc(name)}</span>${right ? `<span class="loot-drop-rate" style="color:var(--gold);border-color:rgba(224,172,96,.25)">${esc(right)}</span>` : ''}</div></div>`;
  const itemName = id => { const it = itemById(id); return it ? it.name : id; };
  const coordsBadge = c => c && c.x != null ? metaBadge('XYZ', `${c.x} ${c.y ?? ''} ${c.z}`.replace('  ', ' ')) : '';

  function pnjSheet() {
    const obj = buildPnjObj();
    if (!obj.id && !obj.name) return '';
    let body = '';
    if (obj.sells && obj.sells.length) body += section(`Ventes <span class="mh-count">${obj.sells.length}</span>`, `<div class="mob-loot-list">${obj.sells.map(s => row(itemName(s.id), s.buy != null ? s.buy + ' ⚙' : '')).join('')}</div>`);
    if (obj.craft && obj.craft.length) body += section(`Craft <span class="mh-count">${obj.craft.length}</span>`, obj.craft.map(c => `<div class="item-obtain" style="margin-bottom:8px"><div class="craft-flow"><div class="craft-tiles">${(c.ingredients || []).map(i => tile(i.id, i.qty)).join('')}</div><div class="craft-arrow"><span>Fabrique</span></div>${tile(c.id, '')}</div></div>`).join(''));
    if (obj.recycle && obj.recycle.length) body += section(`Recyclage <span class="mh-count">${obj.recycle.length}</span>`, `<div class="mob-loot-list">${obj.recycle.map(r => row(itemName(r.id), `×${r.qty} → ${r.reward ?? '?'}${r.time ? ' · ' + r.time : ''}`)).join('')}</div>`);
    const badges = (obj.palier ? palierBadge(obj.palier) : '') + (obj.region ? metaBadge('Région', regionName(obj.region)) : '') + coordsBadge(obj.coords);
    const pretty = s => String(s || '').replace(/_/g, ' ').replace(/^[a-z]/, c => c.toUpperCase());
    return plainSheet({ accent: '#7aaccc', kicker: 'PNJ', name: obj.name || pretty(obj.id), badges, lore: obj.instructions, body });
  }

  function regionSheet() {
    const obj = buildRegionObj();
    if (!obj.id && !obj.name) return '';
    const tags = [];
    if (obj.inCodex) tags.push(chip('Codex', '#7db87a'));
    if (obj.canTp === true) tags.push(chip('Téléportation', '#7aaccc'));
    if (obj.canTp === false) tags.push(chip('Sans téléportation', '#9ca3af'));
    const badges = (obj.palier ? palierBadge(obj.palier) : '') + coordsBadge(obj.coords) + tags.join('');
    return plainSheet({ accent: '#7db87a', kicker: 'Région', name: obj.name, badges, lore: obj.lore });
  }

  const QTYPE = { main: ['Quête principale', '#e0ac60'], sec: ['Quête secondaire', '#7aaccc'], fu: ['Fractured Underworld', '#b45fd6'] };
  function questSheet(obj) {
    if (!obj) return '';
    const q = QTYPE[obj.type] || [obj.type || 'Quête', '#9a7040'];
    let objs = '';
    (obj.objectifs || []).forEach((o, i, arr) => {
      const subs = [];
      (o.items || []).forEach(it => subs.push(`${itemName(it.id || it.itemId)}${it.quality ? ' ✦' : ''} ×${it.qte || 1}`));
      (o.mobs || []).forEach(m => { const mb = typeof MOBS !== 'undefined' ? MOBS.find(x => x.id === (m.id || m.mobId)) : null; subs.push(`${mb ? mb.name : (m.id || m.mobId)} ×${m.qte || 1}`); });
      objs += `<div class="mob-attack-row"><span class="attack-n">${i + 1}</span><div class="attack-body"><div class="attack-name">${esc(o.texte)}</div>${subs.length ? `<div class="attack-desc">${subs.map(esc).join(' · ')}</div>` : ''}</div></div>${o.next && i < arr.length - 1 ? '<div style="text-align:center;color:var(--gold);opacity:.6;line-height:1;margin:-2px 0">↓</div>' : ''}`;
    });
    const rew = (obj.recompenses || []).map(r => {
      const icon = r.type === 'exp' ? '⭐' : r.type === 'cols' ? '🪙' : '🎁';
      let l = r.type === 'exp' ? (r.xp ?? r.value ?? '?') : r.type === 'cols' ? (r.cols ?? r.value ?? '?') : (r.label || r.itemId || '?');
      if (r.type === 'items' && r.qte > 1) l += ' ×' + r.qte;
      return metaBadge(icon, String(l));
    }).join('');
    const badges = (obj.palier ? palierBadge(obj.palier) : '') + (obj.zone ? metaBadge('Zone', obj.zone) : '') + (obj.npc ? metaBadge('PNJ', obj.npc) : '')
      + (obj.coords && obj.coords.x != null ? coordsBadge(obj.coords) : '<span class="item-meta-badge" style="border-color:rgba(223,98,98,.5)"><span class="imb-val" style="color:#df6262">Coordonnées manquantes</span></span>');
    const body = (objs ? section('Objectifs', `<div class="mob-attacks-list">${objs}</div>`) : '') + (rew ? section('Récompenses', `<div class="item-meta-badges">${rew}</div>`) : '');
    return plainSheet({ accent: q[1], kicker: q[0], name: obj.titre, badges, lore: obj.desc, body });
  }

  function panoplieSheet() {
    const obj = buildPanoplieObj();
    if (!obj.id && !obj.label) return '';
    const color = obj.color || '#b87333';
    const lookup = {};
    if (typeof panopStatChoices === 'function') panopStatChoices().forEach(s => { lookup[s.id] = s; });
    const rows = Object.entries(obj.bonuses || {}).sort((a, b) => +a[0] - +b[0]).map(([n, st]) => {
      const inner = Object.entries(st).map(([k, v]) => { const sd = lookup[k]; return `<div>${esc(sd ? sd.label : k)} <span class="set-bonus-val" style="color:${color}">${+v < 0 ? v : '+' + v}${sd && sd.unit ? esc(sd.unit) : ''}</span></div>`; }).join('');
      return `<tr><td class="set-bonus-pieces" style="color:${color}">${n} pièces</td><td class="set-bonus-stat">${inner}</td></tr>`;
    }).join('');
    const body = rows ? `<div class="item-section-title" style="color:${color}">Bonus de panoplie</div><div class="item-set-section"><table class="set-bonuses-table">${rows}</table></div>` : '';
    return plainSheet({ accent: color, kicker: 'Panoplie', name: obj.label, body });
  }

  /* ── Branchement : on remplace les rendus de creator.js ── */
  window.renderPreview = () => emptyState(itemSheet());
  window.renderMobPreview = () => emptyState(mobSheet());
  window.renderPnjPreview = () => emptyState(pnjSheet());
  window.renderRegionPreview = () => emptyState(regionSheet());
  window.renderPanopliePreview = () => emptyState(panoplieSheet());
  window.renderQuestPreview = obj => emptyState(questSheet(obj));
  if (typeof update === 'function') update();
})();
