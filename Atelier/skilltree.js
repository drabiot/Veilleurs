/* ============================================================
   ARBRE DE COMPÉTENCES
   - 1 point par niveau à partir du niveau 2 (niveau N → N-1 points)
   - la case centrale est offerte
   - une case est prenable si elle touche une case possédée
   - les 4 grosses cases (keystones) exigent leurs 4 petites cases voisines
   - effets : renseigner NODE_EFFECTS (clé "x,y", centre = "0,0")
       '2,0': { name: '…', desc: '…', stats: { statId: valeur } }
   ============================================================ */
(function () {
  'use strict';

  var STEP = 57;
  var CENTER = '0,0';
  var NODE_EFFECTS = {};

  // Polylignes en coordonnées de grille [x, y] (y vers le bas)
  var CHAINS = [
    [[3,-4],[4,-3],[5,-2],[7,0],[5,2],[3,4],[2,5],[0,7],[-2,5],[-3,4],[-4,3],[-5,2],[-7,0],
     [-5,-2],[-4,-3],[-3,-4],[-2,-5],[0,-7],[2,-5],[2,-4]],
    [[-3,-4],[-2,-4],[-1,-4],[0,-5],[1,-4]],
    [[0,-4],[0,-3]],
    [[-1,-2],[0,-3],[1,-2]],
    [[-1,-2],[0,-1],[1,-2]],
    [[0,-1],[0,0],[0,1]],
    [[-5,-2],[-4,-2]],
    [[-4,-3],[-3,-2]],
    [[-2,-3],[-2,-2],[-2,-1],[-3,-1],[-3,-2],[-2,-3],[-1,-2],[-2,-1],[-1,0],[0,0]],
    [[-3,-2],[-2,-2],[-1,-2]],
    [[-2,-1],[-3,0],[-4,0]],
    [[-4,-1],[-3,-2]],
    [[-4,-1],[-5,0],[-4,1],[-4,2],[-4,3]],
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
    [[1,-3],[1,-2],[2,-1],[1,0],[0,0]],
    [[1,-2],[2,-2],[3,-2],[2,-1],[3,0]],
    [[1,-3],[2,-3],[2,-2]],
    [[2,-3],[3,-2],[4,-2],[4,-3]],
    [[2,-3],[3,-4]],
    [[4,-2],[4,-1],[5,0],[4,1]],
    [[0,0],[1,0],[2,1],[3,0],[4,0]],
    [[2,1],[3,1],[3,2],[2,3],[1,2],[2,1],[2,2],[2,3]],
    [[1,2],[2,2],[3,2],[4,3],[3,4]],
    [[4,2],[5,2]],
    [[1,4],[2,4],[3,4]],
    [[0,1],[1,2]]
  ];
  var KEYSTONES = { '-2,-2': 1, '2,-2': 1, '-2,2': 1, '2,2': 1 };

  // Un trait long qui passe sur une case existante relie en fait cette case
  // (ex. contour (5,2)→(3,4) via (4,3)) : on le découpe aux cases intermédiaires.
  var EXPANDED = (function () {
    var known = {};
    CHAINS.forEach(function (c) { c.forEach(function (p) { known[p.join(',')] = 1; }); });
    function gcd(a, b) { return b ? gcd(b, a % b) : Math.abs(a); }
    return CHAINS.map(function (c) {
      var out = [c[0]];
      for (var i = 1; i < c.length; i++) {
        var a = c[i - 1], b = c[i];
        var dx = b[0] - a[0], dy = b[1] - a[1], n = gcd(dx, dy);
        if (n > 1 && (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) {
          var sx = dx / n, sy = dy / n;
          for (var k = 1; k < n; k++) {
            var p = [a[0] + sx * k, a[1] + sy * k];
            if (known[p.join(',')]) out.push(p);
          }
        }
        out.push(b);
      }
      return out;
    });
  })();

  var GRAPH = (function () {
    var nodes = {}, edges = {}, adj = {};
    EXPANDED.forEach(function (c) {
      for (var i = 0; i < c.length; i++) {
        var a = c[i].join(',');
        nodes[a] = c[i];
        adj[a] = adj[a] || {};
        if (i === 0) continue;
        var b = c[i - 1].join(',');
        edges[a < b ? a + '|' + b : b + '|' + a] = [c[i - 1], c[i]];
        adj[b] = adj[b] || {};
        adj[a][b] = 1; adj[b][a] = 1;
      }
    });
    return { nodes: nodes, edges: edges, adj: adj };
  })();

  /* ── Règles ── */
  function maxPoints(level) { return Math.max(0, (level || 1) - 1); }

  function canTake(key, owned) {
    if (owned[key] || key === CENTER || !GRAPH.nodes[key]) return false;
    var nb = Object.keys(GRAPH.adj[key]);
    if (KEYSTONES[key]) return nb.every(function (n) { return owned[n]; });
    return nb.some(function (n) { return owned[n]; });
  }

  // Garde les cases valides (connectées au centre, keystones complets) dans un ordre
  // de construction valide, plafonné à `max` cases.
  function sanitize(nodes, max) {
    var pending = [], seen = {};
    (nodes || []).forEach(function (k) {
      if (typeof k === 'string' && k !== CENTER && GRAPH.nodes[k] && !seen[k]) { seen[k] = 1; pending.push(k); }
    });
    var owned = {}; owned[CENTER] = 1;
    var out = [], progress = true;
    while (progress && out.length < max) {
      progress = false;
      for (var i = 0; i < pending.length && out.length < max; i++) {
        if (canTake(pending[i], owned)) {
          owned[pending[i]] = 1; out.push(pending[i]);
          pending.splice(i--, 1); progress = true;
        }
      }
    }
    return out;
  }

  function canRemove(key, nodes) {
    var rest = nodes.filter(function (k) { return k !== key; });
    return sanitize(rest, rest.length).length === rest.length;
  }

  function statsFor(nodes) {
    var total = {};
    [CENTER].concat(nodes || []).forEach(function (k) {
      var fx = NODE_EFFECTS[k];
      if (!fx || !fx.stats) return;
      Object.keys(fx.stats).forEach(function (s) { total[s] = (total[s] || 0) + fx.stats[s]; });
    });
    return total;
  }

  window.VCLSkillTree = { sanitize: sanitize, statsFor: statsFor, maxPoints: maxPoints, NODE_EFFECTS: NODE_EFFECTS };

  /* ── Rendu ── */
  var SVG_NS = 'http://www.w3.org/2000/svg';
  function el(name, attrs, parent) {
    var n = document.createElementNS(SVG_NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function diamond(parent, r, cls) {
    return el('rect', { x: -r, y: -r, width: r * 2, height: r * 2, transform: 'rotate(45)', class: cls }, parent);
  }

  var FULL = 7 * STEP + 36;
  var view = { x: 0, y: 0, w: 1, h: 1 };
  var ui = {};

  function applyView() {
    ui.svg.setAttribute('viewBox', [view.x, view.y, view.w, view.h].join(' '));
  }
  function fitView() {
    var r = ui.svg.getBoundingClientRect();
    var aspect = r.width && r.height ? r.width / r.height : 1;
    var h = 2 * FULL, w = h * aspect;
    if (w < 2 * FULL) { w = 2 * FULL; h = w / aspect; }
    view = { x: -w / 2, y: -h / 2, w: w, h: h };
    applyView();
  }

  function nodeLabel(k) {
    if (k === CENTER) return 'Origine — offerte';
    var fx = NODE_EFFECTS[k];
    var base = KEYSTONES[k] ? 'Case majeure · ' : '';
    return base + (fx ? fx.name + ' — ' + fx.desc : 'Effet à définir');
  }

  function render() {
    var A = window._atelierSkills;
    var nodes = A.getNodes(), owned = {};
    owned[CENTER] = 1;
    nodes.forEach(function (k) { owned[k] = 1; });
    var max = maxPoints(A.getLevel());
    var left = max - nodes.length;

    var svg = ui.world;
    svg.innerHTML = '';
    Object.keys(GRAPH.edges).forEach(function (k) {
      var e = GRAPH.edges[k], ks = k.split('|');
      var lit = owned[ks[0]] && owned[ks[1]];
      el('line', {
        x1: e[0][0] * STEP, y1: e[0][1] * STEP, x2: e[1][0] * STEP, y2: e[1][1] * STEP,
        class: 'st-edge' + (lit ? ' st-lit' : '')
      }, svg);
    });
    Object.keys(GRAPH.nodes).forEach(function (k) {
      var n = GRAPH.nodes[k];
      var isCenter = k === CENTER, isKey = !!KEYSTONES[k], isOwned = !!owned[k];
      var avail = !isOwned && left > 0 && canTake(k, owned);
      var cls = 'st-node' + (isCenter ? ' st-center' : '') + (isKey ? ' st-key' : '') +
                (isOwned ? ' st-owned' : avail ? ' st-avail' : '');
      var g = el('g', { class: cls, transform: 'translate(' + n[0] * STEP + ',' + n[1] * STEP + ')', 'data-k': k }, svg);
      var r = isCenter ? 15 : isKey ? 12 : 9;
      if (isCenter) diamond(g, r + 5, 'st-ring');
      diamond(g, r, 'st-shape');
      el('use', { href: '#st-glyph', x: -9, y: -9, width: 18, height: 18, transform: 'scale(' + (r / 11) + ')', class: 'st-glyph' }, g);
    });
    ui.points.textContent = left + ' / ' + max;
    ui.points.classList.toggle('empty', left <= 0);
  }

  function setInfo(k) { ui.info.textContent = k ? nodeLabel(k) : 'Survolez une case pour voir son effet.'; }

  function onNodeClick(k) {
    var A = window._atelierSkills;
    var nodes = A.getNodes();
    if (k === CENTER) return;
    if (nodes.indexOf(k) >= 0) {
      if (canRemove(k, nodes)) A.setNodes(nodes.filter(function (n) { return n !== k; }));
      else ui.info.textContent = 'Impossible : d’autres cases en dépendent.';
      if (nodes.indexOf(k) >= 0 && !canRemove(k, nodes)) return;
    } else {
      var owned = { '0,0': 1 };
      nodes.forEach(function (n) { owned[n] = 1; });
      if (nodes.length >= maxPoints(A.getLevel())) { ui.info.textContent = 'Plus de points de compétence.'; return; }
      if (!canTake(k, owned)) {
        ui.info.textContent = KEYSTONES[k] ? 'Il faut avoir pris les 4 cases autour.' : 'Il faut une case voisine déjà prise.';
        return;
      }
      A.setNodes(nodes.concat(k));
    }
    render();
    setInfo(k);
  }

  function makeStars(host) {
    var html = '', seed = 7;
    function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647; }
    for (var i = 0; i < 90; i++) {
      var s = (rnd() * 1.6 + .5).toFixed(1);
      html += '<i style="left:' + (rnd() * 100).toFixed(1) + '%;top:' + (rnd() * 100).toFixed(1) +
              '%;width:' + s + 'px;height:' + s + 'px;opacity:' + (rnd() * .5 + .15).toFixed(2) +
              ';animation-delay:' + (rnd() * 6).toFixed(1) + 's"></i>';
    }
    for (var j = 0; j < 8; j++) {
      html += '<b style="left:' + (rnd() * 96 + 2).toFixed(1) + '%;top:' + (rnd() * 92 + 4).toFixed(1) +
              '%;animation-delay:' + (rnd() * 5).toFixed(1) + 's;transform:scale(' + (rnd() * .7 + .5).toFixed(2) + ')"></b>';
    }
    host.innerHTML = html;
  }

  function bindPanZoom() {
    var svg = ui.svg, drag = null;
    svg.addEventListener('wheel', function (e) {
      e.preventDefault();
      var f = e.deltaY > 0 ? 1.12 : 1 / 1.12;
      var nw = Math.min(2.4 * FULL, Math.max(240, view.w * f)), k = nw / view.w;
      var r = svg.getBoundingClientRect();
      var px = view.x + (e.clientX - r.left) * view.w / r.width;
      var py = view.y + (e.clientY - r.top) * view.h / r.height;
      view = { x: px - (px - view.x) * k, y: py - (py - view.y) * k, w: nw, h: view.h * k };
      applyView();
    }, { passive: false });
    svg.addEventListener('pointerdown', function (e) {
      drag = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    });
    window.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) < 5) return;
      drag.moved = true;
      svg.classList.add('dragging');
      var r = svg.getBoundingClientRect();
      view.x = drag.vx - dx * view.w / r.width;
      view.y = drag.vy - dy * view.h / r.height;
      applyView();
    });
    window.addEventListener('pointerup', function () {
      svg.classList.remove('dragging');
      setTimeout(function () { drag = null; }, 0);
    });
    svg.addEventListener('click', function (e) {
      if (drag && drag.moved) return;
      var g = e.target.closest && e.target.closest('.st-node');
      if (g) onNodeClick(g.getAttribute('data-k'));
    });
    svg.addEventListener('mouseover', function (e) {
      var g = e.target.closest && e.target.closest('.st-node');
      if (g) setInfo(g.getAttribute('data-k'));
    });
  }

  function init() {
    var btn = document.getElementById('btn-skilltree');
    var overlay = document.getElementById('skilltree-overlay');
    if (!btn || !overlay) return;
    ui.overlay = overlay;
    ui.svg = overlay.querySelector('.st-svg');
    ui.info = overlay.querySelector('.st-info');
    ui.points = overlay.querySelector('.st-points-val');
    ui.world = ui.svg.querySelector('.st-world');
    makeStars(overlay.querySelector('.st-stars'));
    bindPanZoom();

    function open() {
      overlay.setAttribute('data-class', window._atelierSkills.getClass() || 'none');
      overlay.classList.add('open');
      fitView();
      render();
      setInfo(null);
    }
    function close() { overlay.classList.remove('open'); }
    btn.addEventListener('click', open);
    overlay.querySelector('.st-close').addEventListener('click', close);
    overlay.querySelector('.st-reset').addEventListener('click', function () {
      window._atelierSkills.setNodes([]);
      render();
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
    window.addEventListener('resize', function () { if (overlay.classList.contains('open')) fitView(); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
