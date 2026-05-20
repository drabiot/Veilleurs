/* ══════════════════════════════════════════════════════
   CARD GENERATOR — Génération de cartes PNG stylisées VCL
   Outil standalone : fetch Firestore → draw Canvas → export / Discord
══════════════════════════════════════════════════════ */

import { db, COL, loadCollection }                from './firebase.js'
import { collection, doc, getDoc }               from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js'

// ── Data constants (bridgés depuis data.js via window._VCL_DATA) ─────
const { STAT_GROUPS = [], CATEGORIES = {}, EFFECT_META = {}, CLASSES = [], ALL_SLOTS = [] } = window._VCL_DATA || {}
const ALL_STATS = STAT_GROUPS.flatMap(g => g.stats)
const STAT_MAP  = Object.fromEntries(ALL_STATS.map(s => [s.id, s]))
const CLASS_MAP = Object.fromEntries(CLASSES.map(c => [c.id, c]))

// cat slug → label sans ordinal (ex. 'anneau' → 'Anneau', 'arme_p' → 'Arme Principale')
const CAT_TO_SLOT = {}
for (const slot of ALL_SLOTS) {
  for (const cat of (slot.cats || [])) {
    if (!CAT_TO_SLOT[cat]) {
      CAT_TO_SLOT[cat] = slot.label.replace(/\s+[IVX]+$/i, '').trim()
    }
  }
}

// Champs sous-titre par catégorie
const CAT_SUBTITLE = {
  arme:      ['slot', 'lvl', 'twoHanded', 'classes'],
  armure:    ['slot', 'lvl', 'classes', 'set'],
  accessoire:['slot', 'lvl', 'set'],
}

// ── Palette canvas ────────────────────────────────────────────────────
const C = {
  bg:      '#0e0c0a',
  deep:    '#13100d',
  surface: '#191410',
  rim:     '#2e2418',
  rim2:    '#3d3020',
  muted:   '#6b5a45',
  text:    '#c9b99a',
  bright:  '#ede0c8',
  gold:    '#E0AC60',
  goldDim: '#9a7040',
}

const CARD_W = 900    // largeur logique — hauteur calculée dynamiquement
const SCALE  = 2      // PNG 2× pour netteté

// ── État ─────────────────────────────────────────────────────────────
let allItems     = []
let panoplieMap  = {}
let chasseIds    = new Set()
let selectedItem = null

// ── Init ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  setupSearch()
  setupButtons()
  loadData()
})

async function loadData() {
  const inp = document.getElementById('search-input')
  inp.placeholder = 'Chargement…'

  // Timeout 15s pour ne pas bloquer indéfiniment
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))

  try {
    const [itemsList, panList, chasseSnap] = await Promise.race([
      Promise.all([
        loadCollection(COL.items),
        loadCollection(COL.panoplies).catch(() => []),
        getDoc(doc(db, 'config', 'tableau_de_chasse')).catch(() => null),
      ]),
      timeout,
    ])

    allItems = itemsList

    for (const pan of panList) {
      panoplieMap[pan._id] = pan.label || pan._id
    }

    if (chasseSnap?.exists()) {
      ;(chasseSnap.data().items || []).forEach(id => chasseIds.add(id))
    }

    inp.disabled    = false
    inp.placeholder = `${allItems.length - chasseIds.size} items — rechercher…`
  } catch (e) {
    console.error('Erreur chargement:', e)
    inp.placeholder = e.message === 'timeout' ? 'Timeout — recharger la page' : 'Erreur de chargement'
  }
}

// ── Recherche ─────────────────────────────────────────────────────────
function setupSearch() {
  const input    = document.getElementById('search-input')
  const dropdown = document.getElementById('search-dropdown')

  input.addEventListener('input', () => {
    const q = input.value.trim()
    if (q.length < 2) { dropdown.classList.add('hidden'); return }
    const results = filterItems(q)
    if (!results.length) { dropdown.classList.add('hidden'); return }

    dropdown.innerHTML = results.map(item => {
      const cat = (CATEGORIES[item.category] || {}).label || item.category || '?'
      const pal = item.palier ? `P${item.palier}` : ''
      return `<div class="search-result" data-id="${item.id}">
        <span class="sr-name" style="color:${window.VCL.getRarityColor(item.rarity)}">${escHtml(item.name)}</span>
        <span class="sr-meta">${escHtml(cat)}${pal ? ' · ' + pal : ''}</span>
      </div>`
    }).join('')

    dropdown.classList.remove('hidden')
    dropdown.querySelectorAll('.search-result').forEach(el => {
      el.addEventListener('click', () => {
        const found = allItems.find(i => i.id === el.dataset.id)
        if (found) input.value = found.name
        dropdown.classList.add('hidden')
        selectItem(el.dataset.id)
      })
    })
  })

  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrapper')) dropdown.classList.add('hidden')
  })
}

function filterItems(q) {
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  const nq = norm(q)
  return allItems
    .filter(item => item.name
      && !chasseIds.has(item.id)
      && (norm(item.name).includes(nq) || window.VCL.fuzzyMatch(q, item.name)))
    .slice(0, 8)
}

function escHtml(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Sélection item ────────────────────────────────────────────────────
async function selectItem(id) {
  const item = allItems.find(i => i.id === id)
  if (!item) return

  selectedItem = { ...item }

  const canvas  = document.getElementById('card-canvas')
  const emptyEl = document.getElementById('empty-state')
  emptyEl.style.display = 'none'
  canvas.style.display  = 'block'

  await drawItemCard(canvas, selectedItem)

  document.getElementById('btn-download').disabled = false
  document.getElementById('btn-discord').disabled  = false
}

// ── Parsers obtain / craft ────────────────────────────────────────────

/**
 * Transforme le texte obtain (avec syntaxe wiki) en lignes lisibles.
 * [type:id|Nom] → Nom   |   [50] → (50%)   |   -/*/◆ → retiré
 */
function parseObtainLines(raw) {
  if (!raw) return []
  return raw.split('\n')
    .map(line => {
      let l = line.trim()
      if (!l) return null
      // retirer marqueur de liste
      l = l.replace(/^[-*•◆]\s*/, '')
      // [type:id|Label] → Label
      l = l.replace(/\[(?:[a-zA-Z]+:)?[^\]|]+\|([^\]]+)\]/g, '$1')
      // [50] ou [50.5] → (50%)
      l = l.replace(/\[(\d+(?:[.,]\d+)?)\]/g, '($1%)')
      // nettoyer espaces multiples
      l = l.replace(/\s+/g, ' ').trim()
      return l || null
    })
    .filter(Boolean)
}

/**
 * Retourne la string craft lisible, ou null si pas de craft.
 * Gère ancien format [{qty,id}] et nouveau format [{name?,npcId?,items:[{qty,id}]}].
 */
function parseCraft(item) {
  const craftList = item.craft
  if (!craftList?.length) return null

  // Détection : nouveau format si craftList[0] a une clé 'items'
  const isNew = typeof craftList[0] === 'object' && 'items' in craftList[0]

  let recipe
  if (isNew) {
    recipe = craftList[0]  // {name?, npcId?, items:[{qty,id}]}
  } else {
    // Ancien format : craftList est directement [{qty,id}, ...]
    recipe = { name: null, npcId: null, items: craftList }
  }

  const npc  = recipe.name || recipe.npcId
  const ingr = (recipe.items || []).map(ci => {
    const found = allItems.find(a => a.id === ci.id)
    return `${found?.name || ci.id} ×${ci.qty}`
  }).join(' + ')

  if (npc && ingr) return `${npc} — ${ingr}`
  if (npc)         return npc
  if (ingr)        return ingr
  return null
}

// ── Résolution URL texture ────────────────────────────────────────────
function resolveIconUrl(item) {
  const fix = p => String(p || '').replace(/^\.\.\//,'')
  if (item.images?.length) return fix(item.images[0])
  if (item.image)          return fix(item.image)
  if (item.img)            return fix(item.img)

  const id  = item.id
  const cat = item.category || item.cat
  if (!id || !cat) return null

  const tier = (item.event || item.palier === 0) ? 'events' : (item.palier ? 'P' + item.palier : '')
  const tp   = tier ? tier + '/' : ''
  const base = 'img/compendium/textures/'
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
  }
  return MAP[cat] || null
}

function loadImage(url) {
  return new Promise(resolve => {
    if (!url) return resolve(null)
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = url
  })
}

// ── Calcul de la hauteur de la carte ─────────────────────────────────
function estimateCardHeight(item) {
  const ROW_H  = 20
  const LORE_H = 19

  let h = 58  // header (52) + gap (6)
  h += 34     // name (28px baseline ~y=90)
  h += 16     // palier
  h += 16     // subtitle
  if (item.lore) h += LORE_H * 2 + 8   // lore (2 lignes max)
  h += 20     // divider + section header
  const statsCount = item.stats ? Object.values(item.stats).filter(v => v !== 0 && v != null).length : 0
  const efxCount   = item.effects?.length || 0
  h += Math.min(Math.max(statsCount, efxCount), 8) * ROW_H + 14
  // obtain
  const obtainLines = parseObtainLines(item.obtain).slice(0, 5)
  if (obtainLines.length) h += 20 + obtainLines.length * LORE_H
  // craft
  const craftStr = parseCraft(item)
  if (craftStr) h += 22
  h += 60  // footer + bas
  return Math.max(h, 440)
}

// ── Helpers canvas ────────────────────────────────────────────────────
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y,     x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x,     y + h, r)
  ctx.arcTo(x,     y + h, x,     y,     r)
  ctx.arcTo(x,     y,     x + w, y,     r)
  ctx.closePath()
}

function trunc(str, max) {
  const s = String(str || '')
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/** Dessine du texte avec retour à la ligne. Retourne le y après la dernière ligne. */
function wrapText(ctx, text, x, y, maxW, lineH, maxLines = 2) {
  const words = text.split(' ')
  const lines = []
  let cur = ''
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w
    if (ctx.measureText(test).width > maxW && cur) {
      lines.push(cur)
      cur = w
      if (lines.length >= maxLines) break
    } else { cur = test }
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (lines.length === maxLines && cur !== lines[lines.length - 1]) {
    let last = lines[lines.length - 1]
    while (ctx.measureText(last + '…').width > maxW && last.length > 0) last = last.slice(0, -1)
    lines[lines.length - 1] = last + '…'
  }
  for (const line of lines) { ctx.fillText(line, x, y); y += lineH }
  return y
}

// ── Dessin de la carte ────────────────────────────────────────────────
async function drawItemCard(canvas, item) {
  await document.fonts.ready
  const CARD_H = estimateCardHeight(item)

  canvas.width        = CARD_W * SCALE
  canvas.height       = CARD_H * SCALE
  canvas.style.width  = CARD_W + 'px'
  canvas.style.height = CARD_H + 'px'

  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)

  // ── Constantes de layout ────────────────────────────────
  const IX    = 210    // info zone left
  const RMAX  = CARD_W - 18  // info zone right
  const ICON_X = 14, ICON_Y = 58, ICON_S = 180   // icône

  const rColor  = window.VCL.getRarityColor(item.rarity || 'commun')
  const rLabel  = (window.VCL.RARITIES[item.rarity] || { label: 'Commun' }).label
  const catInfo = CATEGORIES[item.category] || { label: item.category || '?', emoji: '❓' }
  const isEvent = item.event || item.palier === 0

  // ── Fond ──────────────────────────────────────────────
  ctx.fillStyle = C.bg
  ctx.fillRect(0, 0, CARD_W, CARD_H)

  // ── Bordures rareté ────────────────────────────────────
  ctx.fillStyle = rColor
  ctx.fillRect(0,          0,          CARD_W, 4)
  ctx.fillRect(0,          0,          2,      CARD_H)
  ctx.fillRect(CARD_W - 2, 0,          2,      CARD_H)
  ctx.fillRect(0,          CARD_H - 4, CARD_W, 4)

  // ── Header band ────────────────────────────────────────
  ctx.fillStyle = C.surface
  ctx.fillRect(2, 4, CARD_W - 4, 48)

  // Catégorie (gauche)
  ctx.font = '500 11px "JetBrains Mono"'
  ctx.fillStyle    = C.muted
  ctx.textBaseline = 'middle'
  ctx.textAlign    = 'left'
  const catStr = catInfo.emoji ? `${catInfo.emoji}  ${catInfo.label.toUpperCase()}` : catInfo.label.toUpperCase()
  ctx.fillText(catStr, 18, 28)

  // Badge rareté (droite, right-aligné)
  ctx.font = '700 10px "JetBrains Mono"'
  const badgeTxt    = rLabel.toUpperCase()
  const badgePad    = 12
  const txtW        = ctx.measureText(badgeTxt).width
  const badgeW      = txtW + badgePad * 2
  const badgeRightX = CARD_W - 18
  const badgeX      = badgeRightX - badgeW

  ctx.fillStyle = rColor + '28'
  roundRect(ctx, badgeX, 14, badgeW, 26, 3)
  ctx.fill()
  ctx.strokeStyle = rColor + '80'
  ctx.lineWidth   = 1
  roundRect(ctx, badgeX, 14, badgeW, 26, 3)
  ctx.stroke()

  ctx.fillStyle = rColor
  ctx.textAlign = 'right'
  ctx.fillText(badgeTxt, badgeRightX - badgePad, 28)

  // Séparateur header
  ctx.strokeStyle = C.rim
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(2, 52); ctx.lineTo(CARD_W - 2, 52); ctx.stroke()

  // ── Zone icône ─────────────────────────────────────────
  ctx.fillStyle = C.deep
  ctx.fillRect(ICON_X, ICON_Y, ICON_S, ICON_S)
  ctx.strokeStyle = C.rim
  ctx.lineWidth   = 1
  ctx.strokeRect(ICON_X + 0.5, ICON_Y + 0.5, ICON_S - 1, ICON_S - 1)

  // Glow rareté dans zone icône
  const grad = ctx.createRadialGradient(
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, 18,
    ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2, 90
  )
  grad.addColorStop(0, rColor + '22')
  grad.addColorStop(1, 'transparent')
  ctx.fillStyle = grad
  ctx.fillRect(ICON_X, ICON_Y, ICON_S, ICON_S)

  // Icône (pixel art — pas de smoothing)
  const iconImg = await loadImage(resolveIconUrl(item))
  if (iconImg) {
    ctx.imageSmoothingEnabled = false
    const pad = 20
    ctx.drawImage(iconImg, ICON_X + pad, ICON_Y + pad, ICON_S - pad * 2, ICON_S - pad * 2)
    ctx.imageSmoothingEnabled = true
  } else {
    ctx.font = '64px serif'
    ctx.textAlign    = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle    = C.muted
    ctx.fillText(catInfo.emoji || '❓', ICON_X + ICON_S / 2, ICON_Y + ICON_S / 2)
  }

  // ── Infos (layout dynamique en curY) ───────────────────
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'alphabetic'

  // Nom
  ctx.font      = 'bold 28px "Cinzel"'
  ctx.fillStyle = rColor
  ctx.fillText(trunc(item.name || '?', 30), IX, 92)

  // Palier
  if (item.palier || isEvent) {
    ctx.font      = '500 11px "JetBrains Mono"'
    ctx.fillStyle = isEvent ? rColor : C.goldDim
    ctx.fillText(isEvent ? '✦ EVENT' : `Palier ${item.palier}`, IX, 108)
  }

  // Sous-titre (slot · niveau · classes · set selon catégorie)
  const subFields = CAT_SUBTITLE[item.category] || ['slot', 'lvl']
  const subParts  = []

  if (subFields.includes('slot') && item.cat) {
    const sl = CAT_TO_SLOT[item.cat]
    if (sl) subParts.push(sl)
  }
  if (subFields.includes('lvl')       && item.lvl)        subParts.push(`Niv. ${item.lvl}`)
  if (subFields.includes('twoHanded') && item.twoHanded)  subParts.push('Deux mains')
  if (subFields.includes('classes')   && item.classes?.length) {
    subParts.push(item.classes.map(c => (CLASS_MAP[c] || { label: c }).label).join('/'))
  }
  if (subFields.includes('set')       && item.set) {
    subParts.push(panoplieMap[item.set] || item.set.replace(/_/g, ' '))
  }

  ctx.font      = '400 13px "JetBrains Mono"'
  ctx.fillStyle = C.muted
  ctx.fillText(trunc(subParts.join('  ·  ') || catInfo.label, 55), IX, 124)

  // Curseur Y courant pour layout dynamique
  let curY = 134

  // Lore
  if (item.lore) {
    curY += 8
    ctx.font         = '400 12px "JetBrains Mono"'
    ctx.fillStyle    = C.muted
    ctx.textBaseline = 'alphabetic'
    curY = wrapText(ctx, `« ${item.lore} »`, IX, curY, RMAX - IX, 19, 2)
    curY += 2
  }

  // ── Séparateur stats ───────────────────────────────────
  const divY = curY + 8
  ctx.strokeStyle = C.rim
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(IX, divY); ctx.lineTo(RMAX, divY); ctx.stroke()

  // ── Stats / Effets ─────────────────────────────────────
  const STATS_X  = IX
  const DIV_X    = 558   // séparateur vertical stats|effets
  const EFX_X    = DIV_X + 14
  const SEC_Y    = divY + 16
  const ROW_Y0   = SEC_Y + 16
  const ROW_STEP = 20

  const stats   = item.stats
    ? Object.entries(item.stats).filter(([, v]) => v !== 0 && v != null)
    : []
  const effects = item.effects || []

  if (stats.length && effects.length) {
    ctx.strokeStyle = C.rim
    ctx.lineWidth   = 1
    const vertEnd = ROW_Y0 + Math.min(Math.max(stats.length, effects.length), 8) * ROW_STEP
    ctx.beginPath(); ctx.moveTo(DIV_X, SEC_Y - 4); ctx.lineTo(DIV_X, vertEnd); ctx.stroke()
  }

  if (stats.length) {
    ctx.font = '700 11px "JetBrains Mono"'
    ctx.fillStyle    = C.gold
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('STATISTIQUES', STATS_X, SEC_Y)
  }
  if (effects.length) {
    ctx.font = '700 11px "JetBrains Mono"'
    ctx.fillStyle    = C.gold
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('EFFETS', EFX_X, SEC_Y)
  }

  const maxRows = 8
  stats.slice(0, maxRows).forEach(([statId, val], i) => {
    const meta = STAT_MAP[statId]
    if (!meta) return
    const y    = ROW_Y0 + i * ROW_STEP
    const unit = meta.unit || ''
    const disp = Array.isArray(val)
      ? (val[0] === val[1] ? `${val[0]}${unit}` : `${val[0]}–${val[1]}${unit}`)
      : `${val}${unit}`

    // Icône
    ctx.font = '13px serif'
    ctx.fillStyle    = C.muted
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(meta.icon || '·', STATS_X, y)

    // Label
    ctx.font      = '400 11px "JetBrains Mono"'
    ctx.fillStyle = C.muted
    ctx.fillText(trunc(meta.label, 24), STATS_X + 20, y)

    // Valeur (right-aligned dans col stats)
    ctx.font      = '700 11px "JetBrains Mono"'
    ctx.fillStyle = C.text
    ctx.textAlign = 'right'
    ctx.fillText(disp, DIV_X - 10, y)
    ctx.textAlign = 'left'
  })

  if (stats.length > maxRows) {
    ctx.font = '400 10px "JetBrains Mono"'
    ctx.fillStyle    = C.muted
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${stats.length - maxRows} autres…`, STATS_X, ROW_Y0 + maxRows * ROW_STEP)
  }

  effects.slice(0, maxRows).forEach((efx, i) => {
    const meta   = EFFECT_META[efx.type] || {}
    const y      = ROW_Y0 + i * ROW_STEP
    const icon   = efx.icon  || meta.icon  || '·'
    const color  = efx.color || meta.color || C.text
    const prefix = efx.prefix || meta.prefix || ''
    const unit   = efx.unit || ''
    const val    = efx.value !== undefined ? efx.value : ''
    const dur    = efx.duration ? ` (${efx.duration})` : ''

    let display = ''
    if (prefix && val !== '') display = trunc(`${prefix}${val}${unit}${dur}`, 28)
    else if (val !== '')      display = trunc(`${val}${unit}${dur}`, 28)
    else                      display = trunc(efx.label || meta.label || efx.type || '', 28)

    ctx.font = '13px serif'
    ctx.fillStyle    = color
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(icon, EFX_X, y)

    ctx.font      = '400 11px "JetBrains Mono"'
    ctx.fillStyle = color
    ctx.fillText(display, EFX_X + 20, y)
  })

  if (effects.length > maxRows) {
    ctx.font = '400 10px "JetBrains Mono"'
    ctx.fillStyle    = C.muted
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(`+${effects.length - maxRows} autres…`, EFX_X, ROW_Y0 + maxRows * ROW_STEP)
  }

  // ── Obtenir / Craft ────────────────────────────────────
  const rows       = Math.min(Math.max(stats.length, effects.length), maxRows)
  const BOT_DIV    = Math.max(ROW_Y0 + rows * ROW_STEP + 14, divY + 90)

  ctx.strokeStyle = C.rim
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(IX, BOT_DIV); ctx.lineTo(RMAX, BOT_DIV); ctx.stroke()

  let botY = BOT_DIV + 18

  // Obtenir — multi-lignes parsées
  const obtainLines = parseObtainLines(item.obtain).slice(0, 5)
  if (obtainLines.length) {
    ctx.font = '700 11px "JetBrains Mono"'
    ctx.fillStyle    = C.gold
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('OBTENIR', IX, botY)

    ctx.font      = '400 12px "JetBrains Mono"'
    ctx.fillStyle = C.text
    // Première ligne sur la même rangée que le label
    ctx.fillText(trunc(obtainLines[0], 68), IX + 80, botY)

    // Lignes suivantes décalées en dessous
    for (let i = 1; i < obtainLines.length; i++) {
      botY += 19
      ctx.fillText(trunc(obtainLines[i], 80), IX + 10, botY)
    }
    botY += 22
  }

  // Craft
  const craftStr = parseCraft(item)
  if (craftStr) {
    ctx.font = '700 11px "JetBrains Mono"'
    ctx.fillStyle    = C.gold
    ctx.textAlign    = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText('CRAFT', IX, botY)

    ctx.font      = '400 12px "JetBrains Mono"'
    ctx.fillStyle = C.text
    ctx.fillText(trunc(craftStr, 70), IX + 80, botY)
  }

  // ── Footer ─────────────────────────────────────────────
  const FOOT_SEP = CARD_H - 34
  ctx.strokeStyle = C.rim
  ctx.lineWidth   = 1
  ctx.beginPath(); ctx.moveTo(2, FOOT_SEP); ctx.lineTo(CARD_W - 2, FOOT_SEP); ctx.stroke()

  ctx.fillStyle = C.deep
  ctx.fillRect(2, FOOT_SEP + 1, CARD_W - 4, 29)

  ctx.font = '400 11px "JetBrains Mono"'
  ctx.fillStyle    = C.rim2
  ctx.textAlign    = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText('https://drabiot.github.io/Veilleurs', 18, FOOT_SEP + 15)
}

// ── Boutons ───────────────────────────────────────────────────────────
function setupButtons() {
  document.getElementById('btn-download').addEventListener('click', () => {
    if (!selectedItem) return
    document.getElementById('card-canvas').toBlob(blob => {
      const url = URL.createObjectURL(blob)
      const a   = document.createElement('a')
      a.href     = url
      a.download = `${selectedItem.id}_card.png`
      a.click()
      URL.revokeObjectURL(url)
    }, 'image/png')
  })

  document.getElementById('btn-discord').addEventListener('click', async () => {
    if (!selectedItem) return

    let webhookUrl = localStorage.getItem('vcl_card_webhook')
    if (!webhookUrl) {
      webhookUrl = prompt('URL du webhook Discord :')
      if (!webhookUrl?.trim()) return
      localStorage.setItem('vcl_card_webhook', webhookUrl.trim())
      webhookUrl = webhookUrl.trim()
    }

    const btn = document.getElementById('btn-discord')
    btn.disabled    = true
    btn.textContent = '⏳ Envoi…'

    document.getElementById('card-canvas').toBlob(async blob => {
      try {
        const file = new File([blob], `${selectedItem.id}_card.png`, { type: 'image/png' })
        const res  = await window.VCL.postDiscord(webhookUrl, { content: '' }, file, file.name)
        btn.textContent = res.ok ? '✓ Envoyé !' : `✗ Erreur ${res.status}`
        if (!res.ok) console.error('Discord webhook:', await res.json().catch(() => ({})))
      } catch (e) {
        btn.textContent = '✗ Réseau'
        console.error(e)
      } finally {
        setTimeout(() => { btn.textContent = '🔗 Post Discord'; btn.disabled = false }, 2500)
      }
    }, 'image/png')
  })

  document.getElementById('btn-reset-webhook').addEventListener('click', () => {
    localStorage.removeItem('vcl_card_webhook')
    const btn = document.getElementById('btn-reset-webhook')
    btn.textContent = '✓ Réinitialisé'
    setTimeout(() => { btn.textContent = '↺ Webhook' }, 1500)
  })
}
