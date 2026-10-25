/* ══════════════════════════════════════════════════════
   CARD GENERATOR — UI + data loading, délègue le rendu à card-renderer.js
══════════════════════════════════════════════════════ */

import { db, COL, loadCollection }                from './firebase.js'
import { doc, getDoc }                            from './d1db.js'
import { drawItemCard, generateCardBlob }          from './card-renderer.js'

// ── Data constants (bridgés depuis data.js via window._VCL_DATA) ─────
const { CATEGORIES = [] } = window._VCL_DATA || {}

// ── État ─────────────────────────────────────────────────────────────
let allItems      = []
let panoplieMap   = {}
let panoplieData  = {}
let pnjMap        = {}
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

  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))

  try {
    const [itemsList, panList, pnjList, chasseSnap] = await Promise.race([
      Promise.all([
        loadCollection(COL.items),
        loadCollection(COL.panoplies).catch(() => []),
        loadCollection(COL.pnj).catch(() => []),
        getDoc(doc(db, 'config', 'tableau_de_chasse')).catch(() => null),
      ]),
      timeout,
    ])

    allItems = itemsList

    for (const pan of panList) {
      panoplieMap[pan._id]  = pan.label || pan._id
      panoplieData[pan._id] = pan
    }

    for (const pnj of pnjList) {
      pnjMap[pnj._id] = pnj
      if (pnj.id && pnj.id !== pnj._id) pnjMap[pnj.id] = pnj
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

function getMaps() {
  return { panoplieData, panoplieMap, pnjMap, allItems }
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
  await drawItemCard(canvas, selectedItem, null, getMaps())

  document.getElementById('btn-download').disabled = false
  document.getElementById('btn-discord').disabled  = false
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

    try {
      const blob    = await generateCardBlob(selectedItem, getMaps(), 3)
      const file    = new File([blob], `${selectedItem.id}_card.png`, { type: 'image/png' })
      const wikiUrl = `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${selectedItem.id}`
      const payload = { content: `↗ [Lien vers le Wiki](<${wikiUrl}>)` }
      const res = await window.VCL.postDiscord(webhookUrl, payload, file, file.name)
      btn.textContent = res.ok ? '✓ Envoyé !' : `✗ Erreur ${res.status}`
      if (!res.ok) console.error('Discord webhook:', await res.json().catch(() => ({})))
    } catch (e) {
      btn.textContent = '✗ Réseau'
      console.error(e)
    } finally {
      setTimeout(() => { btn.textContent = '🔗 Post Discord'; btn.disabled = false }, 2500)
    }
  })

  document.getElementById('btn-reset-webhook').addEventListener('click', () => {
    localStorage.removeItem('vcl_card_webhook')
    const btn = document.getElementById('btn-reset-webhook')
    btn.textContent = '✓ Réinitialisé'
    setTimeout(() => { btn.textContent = '↺ Webhook' }, 1500)
  })
}
