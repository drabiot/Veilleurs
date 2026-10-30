/* ══════════════════════════════════════════════
   BOT — Card renderer (port of card-renderer.js for node-canvas)
   Key changes vs browser version:
     - createCanvas() instead of document.createElement('canvas')
     - loadImage() from node-canvas (resolves local file paths)
     - registerFont() instead of document.fonts.ready
     - canvas.toBuffer('image/png') instead of canvas.toBlob()
     - Constants loaded via new Function() from Compendium/data.js
══════════════════════════════════════════════ */

const { createCanvas, loadImage: _nodeLoadImage, GlobalFonts } = require('@napi-rs/canvas');
const fs   = require('fs');
const path = require('path');

const WIKI_ROOT = process.env.WIKI_ROOT || path.join(__dirname, '..');

// ── Register fonts at module load ────────────────────────────────
// Uses @fontsource npm packages (WOFF2) — no manual font download needed.
// Falls back to bot/fonts/ TTF files if present.
function reg(filePath, family) {
  if (fs.existsSync(filePath)) GlobalFonts.registerFromPath(filePath, family);
}
function fontsource(pkg, file) {
  return path.join(WIKI_ROOT, 'node_modules', '@fontsource', pkg, 'files', file);
}
function localTtf(file) {
  return path.join(__dirname, 'fonts', file);
}

// Cinzel
['600','700','900'].forEach(w => {
  reg(fontsource('cinzel', `cinzel-latin-${w}-normal.woff2`), 'Cinzel');
  reg(localTtf(`Cinzel-${w === '600' ? 'SemiBold' : w === '700' ? 'Bold' : 'Black'}.ttf`), 'Cinzel');
});
// JetBrains Mono
[['300','Light'],['400','Regular'],['500','Medium'],['700','Bold']].forEach(([w, label]) => {
  reg(fontsource('jetbrains-mono', `jetbrains-mono-latin-${w}-normal.woff2`), 'JetBrains Mono');
  reg(localTtf(`JetBrainsMono-${label}.ttf`), 'JetBrains Mono');
});
// Emoji : toutes les polices de la carte citent « Segoe UI Emoji ». Windows : la vraie police ; Linux (GitHub Actions) : Noto Color Emoji
// (paquet fonts-noto-color-emoji, installé par discord-bot.yml) enregistrée sous ce même nom ; sans elle les emojis s'affichent en carrés.
for (const p of ['C:/Windows/Fonts/seguiemj.ttf', '/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf', '/usr/share/fonts/noto/NotoColorEmoji.ttf', '/usr/share/fonts/google-noto-emoji/NotoColorEmoji.ttf']) {
  if (fs.existsSync(p)) { reg(p, 'Segoe UI Emoji'); break; }
}

// ── Load constants from Compendium/data.js ───────────────────────
let STAT_GROUPS = [], CATEGORIES = {}, EFFECT_META = {}, CLASSES = [], ALL_SLOTS = [];
let CURRENCIES = {};
let resolveObtain = s => s; // [obtain:forge] → texte (même fonction que le site, voir OBTAIN_TEXTS de data.js)
try {
  const code = fs.readFileSync(path.join(WIKI_ROOT, 'Compendium', 'data.js'), 'utf8');
  const result = new Function(`${code}\nreturn { STAT_GROUPS, CATEGORIES, EFFECT_META, CLASSES, ALL_SLOTS, resolveObtain, CURRENCIES };`)();
  ({ STAT_GROUPS, CATEGORIES, EFFECT_META, CLASSES, ALL_SLOTS, resolveObtain, CURRENCIES } = result);
} catch (e) {
  console.error('[card] Failed to load Compendium/data.js constants:', e.message);
}

const ALL_STATS = STAT_GROUPS.flatMap(g => g.stats || []);
const STAT_MAP  = Object.fromEntries(ALL_STATS.map(s => [s.id, s]));
const CLASS_MAP = Object.fromEntries(CLASSES.map(c => [c.id, c]));

const CAT_TO_SLOT = {};
for (const slot of ALL_SLOTS) {
  for (const cat of (slot.cats || [])) {
    if (!CAT_TO_SLOT[cat]) CAT_TO_SLOT[cat] = slot.label.replace(/\s+[IVX]+$/i, '').trim();
  }
}

const CAT_SUBTITLE = {
  arme:       ['slot', 'lvl', 'twoHanded', 'classes'],
  armure:     ['slot', 'lvl', 'classes', 'set'],
  accessoire: ['slot', 'lvl', 'set'],
};

const RARITIES = {
  commun:     '#59d059', rare:    '#2a5fa8', epique:     '#6a3daa',
  legendaire: '#d7af5f', mythique:'#f5b5e4', godlike:    '#a83020', event: '#ebebeb',
};
function getRarityColor(key) { return RARITIES[key] || '#888'; }

const C = {
  bg: '#0e0c0a', deep: '#13100d', surface: '#191410',
  rim: '#2e2418', rim2: '#3d3020', muted: '#6b5a45',
  text: '#c9b99a', bright: '#ede0c8', gold: '#E0AC60', goldDim: '#9a7040',
};

const CARD_W = 750;

// ── Image loading ────────────────────────────────────────────────
async function loadImage(url) {
  if (!url) return null;
  try {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      const res = await fetch(url);
      if (!res.ok) return null;
      const buf = Buffer.from(await res.arrayBuffer());
      return await _nodeLoadImage(buf);
    }
    const absPath = path.isAbsolute(url)
      ? url
      : path.join(WIKI_ROOT, url.replace(/\.\.\//g, ''));
    return await _nodeLoadImage(absPath);
  } catch {
    return null;
  }
}

// ── Parsers ──────────────────────────────────────────────────────
function parseObtainData(raw) {
  if (!raw) return [];
  raw = resolveObtain(raw);
  raw = raw.replace(/(Obtenable pendant l'Event )\[([^\]]+)\]/g, '$1$2'); // crochets = syntaxe de stockage, pas d'affichage (même règle que le Compendium)
  return raw.split('\n').map(line => {
    let l = line.trim().replace(/^Autre source — /, '');
    if (!l) return null;
    const npcIds = [];
    const npcRe = /\[npc:([^\]|]+)(?:\|[^\]]+)?\]/g;
    let m;
    while ((m = npcRe.exec(l)) !== null) npcIds.push(m[1].trim());
    l = l.replace(/^[-*•◆]\s*/, '');
    // point final auto (comme le Compendium), sauf ponctuation finale ou simple entrée de drop « [mob|Nom][taux] »
    const addDot = !/[.!?…:;,]$/.test(l) && !/\[\d+(?:[.,]\d+)?\]$/.test(l) && !/^\[[^\]|]+\|[^\]]*\]$/.test(l);
    l = l.replace(/\[(?:[a-zA-Z]+:)?[^\]|]+\|([^\]]+)\]/g, '$1');
    l = l.replace(/\[(\d+(?:[.,]\d+)?)\]/g, ' ($1%)');
    l = l.replace(/\s+/g, ' ').trim();
    if (addDot && l) l += '.';
    return l ? { text: l, npcIds } : null;
  }).filter(Boolean);
}

function parseCraftData(item, allItems, pnjMap) {
  const craftList = item.craft;
  if (!craftList?.length) return null;
  const isNew = typeof craftList[0] === 'object' && 'items' in craftList[0];
  const recipe = isNew ? craftList[0] : { name: null, npcId: null, items: craftList };
  const npc = recipe.name
    || (recipe.npcId && pnjMap[recipe.npcId]?.name)
    || (recipe.npcId ? recipe.npcId.replace(/_/g, ' ') : null);
  const ingredients = (recipe.items || []).map(ci => {
    const cur = CURRENCIES[ci.id]; // monnaie (Cols…) : pas un item, emoji + libellé comme sur le Compendium
    if (cur) return { name: cur.label, id: ci.id, qty: ci.qty, item: null, currency: cur };
    const found = allItems.find(a => a.id === ci.id);
    return { name: found?.name || ci.id.replace(/_/g, ' '), id: ci.id, qty: ci.qty, item: found || { id: ci.id } };
  });
  if (!npc && !ingredients.length) return null;
  return { npc, ingredients };
}

// ── Texture URL resolution ───────────────────────────────────────
function resolveIconUrl(item) {
  const fix = p => String(p || '').replace(/^\.\.\//,'');
  if (item.images?.length) return fix(item.images[0]);
  if (item.image)          return fix(item.image);
  if (item.img)            return fix(item.img);

  const id  = item.id;
  const cat = item.category || item.cat;
  if (!id || !cat) return null;

  const tier = (item.event || item.palier === 0) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  const base = 'img/compendium/textures/';
  const MAP  = {
    arme:        base + 'weapons/'          + tp + id + '.png',
    armure:      base + 'armors/'           + tp + id + '.png',
    accessoire:  base + 'trinkets/'         + tp + id + '.png',
    outils:      base + 'gears/'            + tp + id + '.png',
    rune:        base + 'items/Runes/'      + tp + id + '.png',
    materiaux:   base + 'items/Material/'   + tp + id + '.png',
    ressources:  base + 'items/Ressources/' + tp + id + '.png',
    consommable: base + 'items/Consommable/'+ tp + id + '.png',
    nourriture:  base + 'items/Nourriture/' + tp + id + '.png',
    quete:       base + 'items/Quest/'      + tp + id + '.png',
    donjon:      base + 'items/Donjon/'     + tp + id + '.png',
    monnaie:     base + 'items/Monnaie/'    + tp + id + '.png',
  };
  return MAP[cat] || null;
}

// ── Canvas helpers ───────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + r, y,     r);
  ctx.closePath();
}

function trunc(str, max) {
  const s = String(str || '');
  return s.length > max ? s.slice(0, max - 1) + '…' : s;
}

function drawFrame(ctx, x, y, w, h, title, color, titleH = 22) {
  ctx.fillStyle = C.surface;
  roundRect(ctx, x, y, w, h, 5); ctx.fill();
  ctx.strokeStyle = color + '35'; ctx.lineWidth = 1;
  roundRect(ctx, x, y, w, h, 5); ctx.stroke();
  ctx.fillStyle = color + '18';
  ctx.beginPath();
  ctx.moveTo(x + 5, y); ctx.lineTo(x + w - 5, y);
  ctx.arcTo(x + w, y, x + w, y + 5, 5);
  ctx.lineTo(x + w, y + titleH); ctx.lineTo(x, y + titleH);
  ctx.lineTo(x, y + 5); ctx.arcTo(x, y, x + 5, y, 5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = color + '30'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(x + 1, y + titleH); ctx.lineTo(x + w - 1, y + titleH); ctx.stroke();
  ctx.font = '700 9px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = color;
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(title, x + 8, y + titleH / 2);
}

// ── Card height estimator ────────────────────────────────────────
function estimateCardHeight(item, compact, panoplieData, allItems, pnjMap) {
  const F_GAP   = compact ? 5  : 6;
  const F_TITLE = compact ? 20 : 22;
  const F_ROW   = compact ? 15 : 18;
  const F_PADV  = compact ? 4  : 5;

  let infoH = 44 + 34 + 27;
  const hasSet = !!(item.set && (CAT_SUBTITLE[item.category] || []).includes('set'));
  if (hasSet) {
    const setDef   = panoplieData[item.set];
    const bonusLen = setDef?.bonuses ? Object.keys(setDef.bonuses).length : 3;
    infoH += 5 + 16 + bonusLen * 14;
  }
  const topH = Math.max(infoH, 44 + 140 + 10);

  let framesH = 0;
  const statsCount = item.stats ? Object.values(item.stats).filter(v => v !== 0 && v != null).length : 0;
  const efxCount   = item.effects?.length || 0;
  if (statsCount || efxCount) {
    const rows = Math.min(Math.max(statsCount, efxCount), 8);
    framesH += F_TITLE + F_PADV + rows * F_ROW + F_PADV + F_GAP;
  }
  const obtainData = parseObtainData(item.obtain).slice(0, 5);
  const craftData  = parseCraftData(item, allItems, pnjMap);
  if (obtainData.length) {
    framesH += F_TITLE + F_PADV + obtainData.length * F_ROW + F_PADV + F_GAP;
  }
  if (craftData) {
    const cRows = (craftData.npc ? 2 : 0) + craftData.ingredients.length;
    framesH += F_TITLE + F_PADV + cRows * F_ROW + F_PADV + F_GAP;
  }
  return Math.max(topH + framesH + 34, 260);
}

// ── Main draw function ───────────────────────────────────────────
async function drawItemCard(canvas, item, exportScale = null, maps = {}) {
  const { panoplieData = {}, panoplieMap = {}, pnjMap = {}, allItems = [] } = maps;

  let CARD_H = estimateCardHeight(item, false, panoplieData, allItems, pnjMap);
  const compact = CARD_H > 450;
  if (compact) CARD_H = estimateCardHeight(item, true, panoplieData, allItems, pnjMap);
  const ZOOM  = Math.min(440 / CARD_H, 1.3);
  const SCALE = (exportScale ?? 2) * ZOOM;

  canvas.width  = Math.round(CARD_W * SCALE);
  canvas.height = Math.round(CARD_H * SCALE);

  const ctx = canvas.getContext('2d');
  ctx.scale(SCALE, SCALE);

  const IX     = 162;
  const RMAX   = CARD_W - 12;
  const ICON_X = 10, ICON_Y = 44, ICON_S = 140;

  const rColor  = getRarityColor(item.rarity || 'commun');
  const rLabel  = (RARITIES[item.rarity] ? item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1) : 'Commun');
  const catInfo = CATEGORIES[item.category] || { label: item.category || '?', emoji: '' };
  const isEvent = item.event || item.palier === 0;

  // Fond
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0,   'rgba(255,200,100,0.025)');
  bgGrad.addColorStop(0.5, 'transparent');
  bgGrad.addColorStop(1,   'rgba(0,0,0,0.15)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const vigGrad = ctx.createRadialGradient(
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, 0,
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, CARD_W * 0.75
  );
  vigGrad.addColorStop(0,   rColor + '14');
  vigGrad.addColorStop(0.5, rColor + '07');
  vigGrad.addColorStop(1,   'transparent');
  ctx.fillStyle = vigGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Bordures rareté
  ctx.fillStyle = rColor;
  ctx.fillRect(0, 0, CARD_W, 4);
  ctx.fillRect(0, 0, 2, CARD_H);
  ctx.fillRect(CARD_W - 2, 0, 2, CARD_H);
  ctx.fillRect(0, CARD_H - 4, CARD_W, 4);

  // Header band
  ctx.fillStyle = C.surface;
  ctx.fillRect(2, 4, CARD_W - 4, 34);

  ctx.font = '500 10px "JetBrains Mono", "Segoe UI Emoji"';
  ctx.fillStyle = C.muted;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  const catStr = catInfo.emoji ? `${catInfo.emoji}  ${catInfo.label.toUpperCase()}` : (catInfo.label || '').toUpperCase();
  ctx.fillText(catStr, 14, 21);

  ctx.font = '700 10px "JetBrains Mono", "Segoe UI Emoji"';
  const badgeTxt  = rLabel.toUpperCase();
  const badgePad  = 12, badgeH = 20, badgeY = 9;
  const txtW      = ctx.measureText(badgeTxt).width;
  const badgeW    = txtW + badgePad * 2;
  const badgeRightX = CARD_W - 12;
  const badgeX    = badgeRightX - badgeW;

  ctx.fillStyle = rColor + '40';
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3); ctx.fill();
  ctx.strokeStyle = rColor + 'aa'; ctx.lineWidth = 1;
  roundRect(ctx, badgeX, badgeY, badgeW, badgeH, 3); ctx.stroke();

  ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(badgeX + 5, badgeY + 1);
  ctx.lineTo(badgeX + badgeW - 5, badgeY + 1);
  ctx.stroke();

  ctx.fillStyle = rColor;
  ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
  ctx.fillText(badgeTxt, badgeRightX - badgePad, badgeY + badgeH / 2);

  ctx.strokeStyle = C.rim; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(2, 38); ctx.lineTo(CARD_W - 2, 38); ctx.stroke();

  // Zone icône
  ctx.fillStyle = C.deep;
  ctx.fillRect(ICON_X, ICON_Y, ICON_S, ICON_S);
  ctx.strokeStyle = rColor + '60'; ctx.lineWidth = 1;
  ctx.strokeRect(ICON_X + 0.5, ICON_Y + 0.5, ICON_S - 1, ICON_S - 1);

  ctx.fillStyle = rColor;
  ctx.fillRect(ICON_X - 3, ICON_Y, 3, ICON_S);

  const grad = ctx.createRadialGradient(
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, 0,
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, ICON_S * 0.55
  );
  grad.addColorStop(0,   rColor + '35');
  grad.addColorStop(0.6, rColor + '12');
  grad.addColorStop(1,   'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(ICON_X, ICON_Y, ICON_S, ICON_S);

  const iconImg = await loadImage(resolveIconUrl(item));
  if (iconImg) {
    const pad   = 10;
    const areaW = ICON_S - pad * 2, areaH = ICON_S - pad * 2;
    const scale = Math.min(areaW / iconImg.width, areaH / iconImg.height);
    const dw = iconImg.width * scale, dh = iconImg.height * scale;
    const dx = ICON_X + pad + (areaW - dw) / 2;
    const dy = ICON_Y + pad + (areaH - dh) / 2;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(iconImg, dx, dy, dw, dh);
    ctx.imageSmoothingEnabled = true;
  } else {
    const cx = ICON_X + ICON_S / 2, cy = ICON_Y + ICON_S / 2;
    ctx.beginPath(); ctx.arc(cx, cy, 32, 0, Math.PI * 2);
    ctx.strokeStyle = C.rim2; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = C.surface; ctx.fill();
    ctx.font = 'bold 28px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.muted;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + 1);
  }

  // Nom
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const nameMaxW = RMAX - IX;
  let nameSize = 28;
  ctx.font = `bold ${nameSize}px "Cinzel", "Segoe UI Emoji"`;
  while (ctx.measureText(item.name || '?').width > nameMaxW && nameSize > 11) {
    nameSize--;
    ctx.font = `bold ${nameSize}px "Cinzel", "Segoe UI Emoji"`;
  }
  const NAME_Y = ICON_Y + 3 + nameSize;
  ctx.save();
  ctx.shadowColor = rColor; ctx.shadowBlur = 18;
  ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  ctx.fillStyle = rColor;
  ctx.fillText(item.name || '?', IX, NAME_Y);
  ctx.restore();

  // Badges
  const subFields  = CAT_SUBTITLE[item.category] || ['slot', 'lvl'];
  const infoBadges = [];
  if (isEvent) {
    infoBadges.push({ label: '✦ EVENT', color: rColor });
  } else if (item.palier) {
    infoBadges.push({ label: `P${item.palier}`, color: C.gold });
  }
  if (subFields.includes('slot') && item.cat) {
    const sl = CAT_TO_SLOT[item.cat];
    if (sl) infoBadges.push({ label: sl.toUpperCase(), color: C.text });
  }
  if (subFields.includes('lvl') && item.lvl) {
    infoBadges.push({ label: `NIV. ${item.lvl}`, color: '#7db3d4' });
  }
  if (subFields.includes('twoHanded') && item.twoHanded) {
    infoBadges.push({ label: 'DEUX MAINS', color: C.muted });
  }
  if (subFields.includes('classes') && item.classes?.length) {
    for (const c of item.classes.slice(0, 3)) {
      infoBadges.push({ label: (CLASS_MAP[c] || { label: c }).label.toUpperCase(), color: C.goldDim });
    }
  }

  const BH = 21, BPAD = 9, BGAP = 6;
  const BY = NAME_Y + 10 + BH / 2;
  ctx.font = '500 10px "JetBrains Mono", "Segoe UI Emoji"';
  ctx.textBaseline = 'middle';
  let bx = IX;
  for (const badge of infoBadges) {
    if (bx >= RMAX - 40) break;
    const tw = ctx.measureText(badge.label).width;
    const bw = tw + BPAD * 2;
    ctx.fillStyle = badge.color + '22';
    roundRect(ctx, bx, BY - BH / 2, bw, BH, 3); ctx.fill();
    ctx.strokeStyle = badge.color + '70'; ctx.lineWidth = 1;
    roundRect(ctx, bx, BY - BH / 2, bw, BH, 3); ctx.stroke();
    ctx.fillStyle = badge.color; ctx.textAlign = 'center';
    ctx.fillText(badge.label, bx + bw / 2, BY);
    bx += bw + BGAP;
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  const showSet = !!(item.set && subFields.includes('set'));
  let curY = BY + BH / 2 + 6;

  // Panoplie inline
  if (showSet) {
    curY += 5;
    const setPan   = panoplieData[item.set];
    const setLabel = panoplieMap[item.set] || item.set.replace(/_/g, ' ');
    const setMaxW  = RMAX - IX;

    let setNameSz = 11;
    ctx.font = `500 ${setNameSz}px "JetBrains Mono", "Segoe UI Emoji"`;
    while (ctx.measureText(`o ${setLabel}`).width > setMaxW && setNameSz > 9) {
      setNameSz--;
      ctx.font = `500 ${setNameSz}px "JetBrains Mono", "Segoe UI Emoji"`;
    }
    ctx.fillStyle = C.goldDim; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillText(`🧩 ${setLabel}`, IX, curY); // emoji (⬡ n'existe dans aucune police : carré)
    curY += setNameSz + 5;

    const bonusEntries = setPan?.bonuses
      ? Object.entries(setPan.bonuses).sort((a, b) => +a[0] - +b[0])
      : [];
    for (const [piecesStr, bonusStats] of bonusEntries) {
      const n      = parseInt(piecesStr) || 0;
      const pcsTxt = `${n}* `;
      ctx.font = '700 9.5px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.gold;
      ctx.fillText(pcsTxt, IX, curY);
      const pcW = ctx.measureText(pcsTxt).width;
      const statStrs = Object.entries(bonusStats || {}).map(([sid, v]) => {
        const sm = STAT_MAP[sid]; if (!sm) return null;
        return `+${v}${sm.unit || ''} ${sm.label}`;
      }).filter(Boolean).join('  ');
      ctx.font = '400 9.5px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.text;
      const bonusMaxW = setMaxW - pcW;
      let bonusOut = statStrs;
      if (ctx.measureText(bonusOut).width > bonusMaxW) {
        while (ctx.measureText(bonusOut + '…').width > bonusMaxW && bonusOut.length > 1)
          bonusOut = bonusOut.slice(0, -1);
        bonusOut += '…';
      }
      ctx.fillText(bonusOut, IX + pcW, curY);
      curY += 14;
    }
  }

  // Frames
  const F_GAP   = compact ? 5  : 6;
  const F_MAR   = 12;
  const F_TITLE = compact ? 20 : 22;
  const F_ROW   = compact ? 15 : 18;
  const F_PADH  = 10;
  const F_PADV  = compact ? 4  : 5;
  const rowFont   = compact ? '400 9.5px "JetBrains Mono", "Segoe UI Emoji"' : '400 10.5px "JetBrains Mono", "Segoe UI Emoji"';
  const rowFontBd = compact ? '700 9.5px "JetBrains Mono", "Segoe UI Emoji"' : '700 10.5px "JetBrains Mono", "Segoe UI Emoji"';
  const FRAME_X = F_MAR, FRAME_W = CARD_W - F_MAR * 2;
  let frameY = Math.max(curY + 10, ICON_Y + ICON_S + 10);

  const stats   = item.stats ? Object.entries(item.stats).filter(([, v]) => v !== 0 && v != null) : [];
  const effects = item.effects || [];

  function drawStatsCol(x, w, fY, rows, truncLen) {
    stats.slice(0, rows).forEach(([statId, val], i) => {
      const meta = STAT_MAP[statId]; if (!meta) return;
      const cy   = fY + F_TITLE + F_PADV + i * F_ROW + F_ROW / 2;
      const unit = meta.unit || '';
      const normVal = Array.isArray(val) ? val
        : (val !== null && typeof val === 'object') ? [val.min ?? val.value ?? 0, val.max ?? val.value ?? 0]
        : val;
      const disp = Array.isArray(normVal)
        ? (normVal[0] === normVal[1] ? `${normVal[0]}${unit}` : `${normVal[0]}-${normVal[1]}${unit}`)
        : `${normVal}${unit}`;
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(x + 1, cy - F_ROW / 2 + 1, w - 2, F_ROW - 1);
      }
      ctx.font = '13px "Segoe UI Emoji", sans-serif'; ctx.fillStyle = C.muted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(meta.icon || '.', x + F_PADH, cy);
      ctx.font = rowFont; ctx.fillStyle = C.muted;
      const labelTxt = trunc(meta.label, truncLen);
      ctx.fillText(labelTxt, x + F_PADH + 18, cy);
      const labelRight = x + F_PADH + 18 + ctx.measureText(labelTxt).width + 4;
      ctx.font = rowFontBd;
      const valueLeft = x + w - F_PADH - ctx.measureText(disp).width - 4;
      ctx.font = rowFont; ctx.fillStyle = C.rim2;
      const dotW = ctx.measureText('. ').width;
      for (let dx = labelRight; dx + dotW <= valueLeft; dx += dotW) ctx.fillText('.', dx, cy);
      ctx.font = rowFontBd; ctx.fillStyle = C.bright;
      ctx.textAlign = 'right';
      ctx.fillText(disp, x + w - F_PADH, cy);
      ctx.textAlign = 'left';
    });
    if (stats.length > rows) {
      const cy = fY + F_TITLE + F_PADV + rows * F_ROW + F_ROW / 2;
      ctx.font = '400 9px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.muted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`+${stats.length - rows} autres...`, x + F_PADH, cy);
    }
  }

  function drawEffectsCol(x, w, fY, rows, truncLen) {
    effects.slice(0, rows).forEach((efx, i) => {
      const meta  = EFFECT_META[efx.type] || {};
      const cy    = fY + F_TITLE + F_PADV + i * F_ROW + F_ROW / 2;
      const icon  = efx.icon  || meta.icon  || '.';
      const color = efx.color || meta.color || C.text;
      const prefix = efx.prefix || meta.prefix || '';
      const unit   = efx.unit || '';
      const val    = efx.value !== undefined ? efx.value : '';
      const dur    = efx.duration ? ` (${efx.duration})` : '';
      let display = '';
      if (prefix && val !== '') display = trunc(`${prefix}${val}${unit}${dur}`, truncLen);
      else if (val !== '')      display = trunc(`${val}${unit}${dur}`, truncLen);
      else                      display = trunc(efx.label || meta.label || efx.type || '', truncLen);
      if (i % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.018)';
        ctx.fillRect(x + 1, cy - F_ROW / 2 + 1, w - 2, F_ROW - 1);
      }
      ctx.font = '13px "Segoe UI Emoji", sans-serif'; ctx.fillStyle = color;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(icon, x + F_PADH, cy);
      ctx.font = rowFont; ctx.fillStyle = color;
      ctx.fillText(display, x + F_PADH + 18, cy);
    });
    if (effects.length > rows) {
      const cy = fY + F_TITLE + F_PADV + rows * F_ROW + F_ROW / 2;
      ctx.font = '400 9px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.muted;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(`+${effects.length - rows} autres...`, x + F_PADH, cy);
    }
  }

  const sW = Math.floor((FRAME_W - F_GAP) / 2);
  const eX = FRAME_X + sW + F_GAP;
  const eW = FRAME_W - sW - F_GAP;

  if (stats.length || effects.length) {
    const maxR = Math.min(Math.max(stats.length, effects.length), 8);
    const fH   = F_TITLE + F_PADV + maxR * F_ROW + F_PADV;
    const both = stats.length > 0 && effects.length > 0;
    if (stats.length) {
      const sx = FRAME_X, sw2 = both ? sW : FRAME_W;
      drawFrame(ctx, sx, frameY, sw2, fH, 'STATISTIQUES', C.gold, F_TITLE);
      drawStatsCol(sx, sw2, frameY, Math.min(stats.length, 8), both ? 14 : 22);
    }
    if (effects.length) {
      const ex2 = both ? eX : FRAME_X, ew2 = both ? eW : FRAME_W;
      drawFrame(ctx, ex2, frameY, ew2, fH, 'EFFETS', C.gold, F_TITLE);
      drawEffectsCol(ex2, ew2, frameY, Math.min(effects.length, 8), both ? 14 : 22);
    }
    frameY += fH + F_GAP;
  }

  // Obtenir / Craft
  const obtainData = parseObtainData(item.obtain).slice(0, 5);
  const craftData  = parseCraftData(item, allItems, pnjMap);

  if (obtainData.length) {
    const oH = F_TITLE + F_PADV + obtainData.length * F_ROW + F_PADV;
    drawFrame(ctx, FRAME_X, frameY, FRAME_W, oH, 'OBTENIR', '#7db3d4', F_TITLE);
    obtainData.forEach((line, i) => {
      const cy = frameY + F_TITLE + F_PADV + i * F_ROW + F_ROW / 2;
      const coordStr = null; // pas de badge « Pin X Z » : les coordonnées sont déjà écrites dans le texte
      const bPad = 6, bGap = 6, bH = 14;
      ctx.font = '700 9px "JetBrains Mono", "Segoe UI Emoji"';
      const bW    = coordStr ? ctx.measureText(coordStr).width + bPad * 2 : 0;
      const maxTW = FRAME_W - F_PADH * 2 - (coordStr ? bW + bGap : 0);
      ctx.font = rowFont;
      let txt = line.text;
      if (ctx.measureText(txt).width > maxTW) {
        while (ctx.measureText(txt + '…').width > maxTW && txt.length > 1) txt = txt.slice(0, -1);
        txt += '…';
      }
      ctx.fillStyle = C.text; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(txt, FRAME_X + F_PADH, cy);
      if (coordStr) {
        const bX = FRAME_X + F_PADH + ctx.measureText(txt).width + bGap;
        const bY = cy - bH / 2;
        roundRect(ctx, bX, bY, bW, bH, 3);
        ctx.fillStyle = C.goldDim + '28'; ctx.fill();
        ctx.strokeStyle = C.goldDim + 'cc'; ctx.lineWidth = 1;
        roundRect(ctx, bX, bY, bW, bH, 3); ctx.stroke();
        ctx.font = '700 9px "JetBrains Mono", "Segoe UI Emoji"'; ctx.fillStyle = C.gold;
        ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
        ctx.fillText(coordStr, bX + bPad, cy);
      }
    });
    frameY += F_TITLE + F_PADV + obtainData.length * F_ROW + F_PADV + F_GAP;
  }

  if (craftData) {
    const cRows = (craftData.npc ? 1 : 0) + craftData.ingredients.length;
    const crH = F_TITLE + F_PADV + cRows * F_ROW + F_PADV;
    drawFrame(ctx, FRAME_X, frameY, FRAME_W, crH, 'CRAFT', '#7db3d4', F_TITLE);
    let craftY = frameY + F_TITLE + F_PADV;
    if (craftData.npc) {
      ctx.font = rowFont; ctx.fillStyle = C.goldDim;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('Craft  ' + craftData.npc, FRAME_X + F_PADH, craftY + F_ROW / 2);
      craftY += F_ROW;
    }
    const ingIcons = await Promise.all(
      craftData.ingredients.map(ing => (ing.currency ? null : loadImage(resolveIconUrl(ing.item))))
    );
    for (let i = 0; i < craftData.ingredients.length; i++) {
      const ing = craftData.ingredients[i], ico = ingIcons[i];
      const cy  = craftY + F_ROW / 2;
      const isz = 14;
      if (ing.currency) {
        ctx.font = '12px "Segoe UI Emoji", sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillStyle = C.text;
        ctx.fillText(ing.currency.emoji, FRAME_X + F_PADH, cy);
      } else if (ico) {
        const s  = Math.min(isz / ico.width, isz / ico.height);
        const dw = ico.width * s, dh = ico.height * s;
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(ico, FRAME_X + F_PADH + (isz - dw) / 2, cy - isz / 2 + (isz - dh) / 2, dw, dh);
        ctx.imageSmoothingEnabled = true;
      }
      ctx.font = rowFont; ctx.fillStyle = C.text;
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const qtyStr   = `  x${ing.qty}`;
      const qtyW     = ctx.measureText(qtyStr).width;
      const nameMaxW = FRAME_W - F_PADH * 2 - isz - 5 - qtyW;
      let ingName = ing.name;
      if (ctx.measureText(ingName).width > nameMaxW) {
        while (ctx.measureText(ingName + '…').width > nameMaxW && ingName.length > 1) ingName = ingName.slice(0, -1);
        ingName += '…';
      }
      const nameColor = ing.currency ? ing.currency.color : (ing.item?.rarity ? getRarityColor(ing.item.rarity) : C.text);
      ctx.fillStyle = nameColor;
      ctx.fillText(ingName, FRAME_X + F_PADH + isz + 5, cy);
      ctx.fillStyle = C.muted;
      ctx.fillText(qtyStr, FRAME_X + F_PADH + isz + 5 + ctx.measureText(ingName).width, cy);
      craftY += F_ROW;
    }
    frameY += crH + F_GAP;
  }

  // Footer
  const FOOT_SEP = frameY + 4;
  ctx.strokeStyle = C.goldDim + '60'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(2, FOOT_SEP); ctx.lineTo(CARD_W - 2, FOOT_SEP); ctx.stroke();

  ctx.fillStyle = C.deep;
  ctx.fillRect(2, FOOT_SEP + 1, CARD_W - 4, 29);

  ctx.font = '400 10px "JetBrains Mono", "Segoe UI Emoji"';
  ctx.fillStyle = C.muted;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('Veilleurs au Clair de Lune', CARD_W / 2, FOOT_SEP + 17);
}

// ── Public API ───────────────────────────────────────────────────
async function generateCardBuffer(item, maps = {}, scale = 3) {
  const canvas = createCanvas(1, 1);
  await drawItemCard(canvas, item, scale, maps);
  return canvas.encode('png');
}

/** Texture de l'item en grand format net (pixels non lissés) sur fond sombre : sert de miniature au post (Discord prend la 1re image du message). null si pas de texture. */
async function generateIconBuffer(item, size = 160) {
  const img = await loadImage(resolveIconUrl(item));
  if (!img) return null;
  const c = createCanvas(size, size), ctx = c.getContext('2d');
  ctx.fillStyle = '#191410'; ctx.fillRect(0, 0, size, size);
  ctx.imageSmoothingEnabled = false;
  const k = Math.min(size * 0.86 / img.width, size * 0.86 / img.height);
  const w = img.width * k, h = img.height * k;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
  return c.toBuffer('image/png');
}

module.exports = { generateCardBuffer, generateIconBuffer };
