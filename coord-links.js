/* ══ coord-links.js — transforme les coordonnées écrites dans un texte en lien cliquable qui pose un pin sur la carte ══
   Formats reconnus : [coords:X,Z]  ·  (X, Z)  ·  (X, Y, Z) (Y = hauteur, ignorée par la carte 2D mais gardée dans le nom du pin).
   Chargé tôt par sw-register.js (présent sur toutes les pages) et par auth-widget.js (tickets « Nous contacter » compris) ; observe le DOM pour les textes ajoutés plus tard.
   Le lien ouvre la carte en overlay (map-overlay.js) ; Ctrl / clic milieu = nouvel onglet.
   Palier : celui du plus proche ancêtre portant data-floor, sinon 1. Un texte peut être exclu avec data-no-coords. */
import './map-overlay.js';

const MAP_URL = new URL('Map/map.html', import.meta.url).href;
const RE = /\[\s*coords?\s*:\s*(-?\d+)\s*,\s*(-?\d+)\s*\]|\(\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(-?\d+))?\s*\)/gi;
const SKIP = 'a,script,style,textarea,input,select,button,code,pre,[contenteditable],[data-no-coords],.coord-badge,#vcl-map-ov';

function make(m, floor) {
  let x, y = null, z;
  if (m[1] != null) { x = m[1]; z = m[2]; }
  else if (m[5] != null) { x = m[3]; y = m[4]; z = m[5]; }
  else {
    x = m[3]; z = m[4];
    // « (2, 3) » : trop petit pour être une position, on laisse le texte tel quel
    if (Math.max(Math.abs(+x), Math.abs(+z)) < 100) return null;
  }
  const name = `Position · ${y != null ? `X:${x} Y:${y} Z:${z}` : `X:${x} Z:${z}`}`;
  const a = document.createElement('a');
  a.className = 'coord-badge coord-badge-link';
  a.href = `${MAP_URL}?ghost_gx=${x}&ghost_gz=${z}&ghost_floor=${floor}&ghost_name=${encodeURIComponent(name)}#floor-${floor}-surface`;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.mapTitle = name;
  a.setAttribute('data-no-i18n', '');
  a.textContent = y != null ? `(${x},${y},${z})` : `(${x},${z})`;   // [coords:X,Z] s'affiche comme (X,Z)
  a.style.cssText = 'color:#e0ac60;text-decoration:underline dotted;text-underline-offset:3px;cursor:pointer';
  return a;
}

function linkify(node) {
  const text = node.nodeValue;
  RE.lastIndex = 0;
  if (!RE.test(text)) return;
  const floor = parseInt(node.parentElement.closest('[data-floor]')?.dataset.floor) || 1;
  const frag = document.createDocumentFragment();
  let last = 0, changed = false;
  RE.lastIndex = 0;
  for (let m; (m = RE.exec(text));) {
    const a = make(m, floor);
    if (!a) continue;
    frag.append(text.slice(last, m.index), a);
    last = m.index + m[0].length;
    changed = true;
  }
  if (!changed) return;
  frag.append(text.slice(last));
  node.replaceWith(frag);
}

function scan(root) {
  if (root.nodeType === 3) { if (!root.parentElement?.closest(SKIP)) linkify(root); return; }
  if (root.nodeType !== 1 || root.closest(SKIP)) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.parentElement.closest(SKIP) || !/[\[(]/.test(n.nodeValue) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  nodes.forEach(linkify);
}

function start() {
  scan(document.body);
  // synchrone (micro-tâche, avant le rendu) : pas de flash du texte brut « [coords:…] »
  new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') scan(m.target);
      else m.addedNodes.forEach(n => { if (n.nodeType === 1 || n.nodeType === 3) scan(n); });
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}

if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
