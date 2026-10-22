/* ============================================================
   ARBRE DE COMPÉTENCES — structure placeholder
   Les effets de chaque case seront définis plus tard : renseigner
   `effect` dans NODE_EFFECTS (clé "x,y", centre = "0,0").
   ============================================================ */
(function () {
  'use strict';

  var STEP = 57;
  var NODE_EFFECTS = {
    // '2,0': { name: '…', desc: '…' },
  };

  // Un quadrant, mirroré par symétrie D4 (axes + diagonales)
  var BASE_EDGES = [
    [[0,0],[2,0]], [[0,0],[1,1]], [[2,0],[1,1]],
    [[2,0],[3,1]], [[1,1],[2,2]], [[2,2],[3,1]],
    [[3,1],[4,0]], [[3,1],[3,3]], [[2,2],[3,3]],
    [[4,0],[5,1]], [[3,3],[4,4]]
  ];

  function transforms(p) {
    var x = p[0], y = p[1], out = [];
    [[x, y], [y, x]].forEach(function (q) {
      [1, -1].forEach(function (sx) {
        [1, -1].forEach(function (sy) { out.push([q[0] * sx, q[1] * sy]); });
      });
    });
    return out;
  }

  function build() {
    var nodes = {}, edges = {};
    BASE_EDGES.forEach(function (e) {
      var a = transforms(e[0]), b = transforms(e[1]);
      for (var i = 0; i < a.length; i++) {
        var ka = a[i].join(','), kb = b[i].join(',');
        nodes[ka] = a[i]; nodes[kb] = b[i];
        edges[ka < kb ? ka + '|' + kb : kb + '|' + ka] = [a[i], b[i]];
      }
    });
    return { nodes: nodes, edges: edges };
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  function render(svg, info) {
    var g = build(), R = 5 * STEP + 40;
    svg.setAttribute('viewBox', [-R, -R, 2 * R, 2 * R].join(' '));
    svg.innerHTML = '';
    Object.keys(g.edges).forEach(function (k) {
      var e = g.edges[k];
      el('line', {
        x1: e[0][0] * STEP, y1: e[0][1] * STEP, x2: e[1][0] * STEP, y2: e[1][1] * STEP,
        class: 'st-edge'
      }, svg);
    });
    Object.keys(g.nodes).forEach(function (k) {
      var n = g.nodes[k], center = k === '0,0';
      var size = center ? 17 : 8;
      var node = el('g', {
        class: 'st-node' + (center ? ' st-active' : ''),
        transform: 'translate(' + n[0] * STEP + ',' + n[1] * STEP + ')',
        tabindex: 0
      }, svg);
      el('rect', { x: -size, y: -size, width: size * 2, height: size * 2,
                   transform: 'rotate(45)', class: 'st-shape' }, node);
      if (center) {
        el('rect', { x: -size - 6, y: -size - 6, width: (size + 6) * 2, height: (size + 6) * 2,
                     transform: 'rotate(45)', class: 'st-ring' }, node);
      }
      function show() {
        var fx = NODE_EFFECTS[k];
        info.textContent = center ? 'Origine' :
          (fx ? fx.name + ' — ' + fx.desc : 'Effet à définir');
      }
      node.addEventListener('mouseenter', show);
      node.addEventListener('focus', show);
      node.addEventListener('click', show);
    });
  }

  function init() {
    var btn = document.getElementById('btn-skilltree');
    var overlay = document.getElementById('skilltree-overlay');
    if (!btn || !overlay) return;
    var svg = overlay.querySelector('.st-svg');
    var info = overlay.querySelector('.st-info');
    function open()  { render(svg, info); overlay.classList.add('open'); }
    function close() { overlay.classList.remove('open'); }
    btn.addEventListener('click', open);
    overlay.querySelector('.st-close').addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
