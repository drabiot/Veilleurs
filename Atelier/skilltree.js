/* ============================================================
   ARBRE DE COMPÉTENCES — structure placeholder
   Les effets de chaque case seront définis plus tard : renseigner
   NODE_EFFECTS (clé "x,y", centre = "0,0").
   ============================================================ */
(function () {
  'use strict';

  var STEP = 57;
  var NODE_EFFECTS = {
    // '2,0': { name: '…', desc: '…' },
  };

  // Polylignes en coordonnées de grille [x, y] (y vers le bas)
  var CHAINS = [
    // contour extérieur
    [[3,-4],[4,-3],[5,-2],[7,0],[5,2],[3,4],[2,5],[0,7],[-2,5],[-3,4],[-4,3],[-5,2],[-7,0],
     [-5,-2],[-4,-3],[-3,-4],[-2,-5],[0,-7],[2,-5],[2,-4]],
    // haut
    [[-3,-4],[-2,-4],[-1,-4],[0,-5],[1,-4]],
    [[0,-4],[0,-3]],
    [[-1,-2],[0,-3],[1,-2]],
    [[-1,-2],[0,-1],[1,-2]],
    [[0,-1],[0,0],[0,1]],
    // gauche haut
    [[-5,-2],[-4,-2]],
    [[-4,-3],[-3,-2]],
    [[-2,-3],[-2,-2],[-2,-1],[-3,-1],[-3,-2],[-2,-3],[-1,-2],[-2,-1],[-1,0],[0,0]],
    [[-3,-2],[-2,-2],[-1,-2]],
    [[-2,-1],[-3,0],[-4,0]],
    [[-4,-1],[-3,-2]],
    [[-4,-1],[-5,0],[-4,1],[-4,2],[-4,3]],
    // gauche bas
    [[-3,0],[-2,1],[-1,0]],
    [[-2,1],[-2,2],[-2,3],[-1,3],[-1,2],[-2,1]],
    [[-2,1],[-3,2],[-2,2],[-1,2]],
    [[-3,2],[-4,3]],
    [[-1,2],[0,1]],
    [[-1,2],[0,3],[0,4]],
    [[0,3],[1,2]],
    [[-3,4],[-2,3]],
    [[-2,4],[-2,5]],
    [[-1,4],[0,5],[1,4]],
    // droite haut
    [[1,-3],[1,-2],[2,-1],[1,0],[0,0]],
    [[1,-2],[2,-2],[3,-2],[2,-1],[3,0]],
    [[1,-3],[2,-3],[2,-2]],
    [[2,-3],[3,-2],[4,-2],[4,-3]],
    [[2,-3],[3,-4]],
    [[4,-2],[4,-1],[5,0],[4,1]],
    // droite bas
    [[0,0],[1,0],[2,1],[3,0],[4,0]],
    [[2,1],[3,1],[3,2],[2,3],[1,2],[2,1],[2,2],[2,3]],
    [[1,2],[2,2],[3,2],[4,3],[3,4]],
    [[4,2],[5,2]],
    [[1,4],[2,4],[3,4]],
    [[0,1],[1,2]]
  ];
  var KEYSTONES = { '-2,-2': 1, '2,-2': 1, '-2,2': 1, '2,2': 1 };

  function build() {
    var nodes = {}, edges = {}, adj = {};
    CHAINS.forEach(function (c) {
      for (var i = 0; i < c.length; i++) {
        var a = c[i].join(',');
        nodes[a] = c[i];
        if (i === 0) continue;
        var b = c[i - 1].join(',');
        edges[a < b ? a + '|' + b : b + '|' + a] = [c[i - 1], c[i]];
        (adj[a] = adj[a] || {})[b] = 1;
        (adj[b] = adj[b] || {})[a] = 1;
      }
    });
    return { nodes: nodes, edges: edges, adj: adj };
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function diamond(parent, r, cls) {
    return el('rect', { x: -r, y: -r, width: r * 2, height: r * 2,
                        transform: 'rotate(45)', class: cls }, parent);
  }

  var FULL = 7 * STEP + 30;
  var view = { x: -FULL, y: -FULL, w: 2 * FULL, h: 2 * FULL };

  function applyView(svg) {
    svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].join(' '));
  }

  function render(svg, info) {
    var g = build();
    svg.innerHTML = '';
    var active = '0,0';
    Object.keys(g.edges).forEach(function (k) {
      var e = g.edges[k], ks = k.split('|');
      el('line', {
        x1: e[0][0] * STEP, y1: e[0][1] * STEP, x2: e[1][0] * STEP, y2: e[1][1] * STEP,
        class: 'st-edge' + (ks.indexOf(active) >= 0 ? ' st-lit' : '')
      }, svg);
    });
    Object.keys(g.nodes).forEach(function (k) {
      var n = g.nodes[k];
      var isActive = k === active, isKey = !!KEYSTONES[k], isAvail = !!(g.adj[active] && g.adj[active][k]);
      var cls = 'st-node' + (isActive ? ' st-active' : '') + (isKey ? ' st-key' : '') + (isAvail ? ' st-avail' : '');
      var node = el('g', { class: cls, transform: 'translate(' + n[0] * STEP + ',' + n[1] * STEP + ')', tabindex: 0 }, svg);
      var r = isActive ? 14 : isKey ? 11 : 8;
      if (isActive || isKey) diamond(node, r + 5, 'st-ring');
      diamond(node, r, 'st-shape');
      diamond(node, isActive ? 4 : 2.2, 'st-dot');
      function show() {
        var fx = NODE_EFFECTS[k];
        info.textContent = isActive ? 'Origine' : (fx ? fx.name + ' — ' + fx.desc : 'Effet à définir');
      }
      node.addEventListener('mouseenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('click', show);
    });
  }

  function bindPanZoom(svg) {
    var drag = null;
    function scale() { return view.w / svg.getBoundingClientRect().width; }
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      var nw = Math.min(2 * FULL, Math.max(260, view.w * f)), k = nw / view.w;
      var r = svg.getBoundingClientRect();
      var px = view.x + (e.clientX - r.left) * view.w / r.width;
      var py = view.y + (e.clientY - r.top) * view.h / r.height;
      view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w: nw, h: view.h * k };
      applyView(svg);
    }, { passive: false });
    svg.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
      svg.classList.add('dragging');
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var s = scale();
      view.x = drag.vx - (e.clientX - drag.x) * s;
      view.y = drag.vy - (e.clientY - drag.y) * s;
      applyView(svg);
    });
    window.addEventListener('pointerup', function () { drag = null; svg.classList.remove('dragging'); });
  }

  function init() {
    var btn = document.getElementById('btn-skilltree');
    var overlay = document.getElementById('skilltree-overlay');
    if (!btn || !overlay) return;
    var svg = overlay.querySelector('.st-svg');
    var info = overlay.querySelector('.st-info');
    bindPanZoom(svg);
    function open() {
      view = { x: -FULL, y: -FULL, w: 2 * FULL, h: 2 * FULL };
      applyView(svg);
      render(svg, info);
      info.textContent = 'Molette pour zoomer · glisser pour déplacer';
      overlay.classList.add('open');
    }
    function close() { overlay.classList.remove('open'); }
    btn.addEventListener('click', open);
    overlay.querySelector('.st-close').addEventListener('click', close);
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
