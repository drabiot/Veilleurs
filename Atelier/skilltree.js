/* ============================================================
   ARBRE DE COMPÉTENCES
   - 1 point par niveau à partir du niveau 2 (niveau N → N-1 points)
   - la case centrale est offerte
   - une case est prenable si elle touche une case possédée
   - les 4 grosses cases (keystones) exigent leurs 4 petites cases voisines
   - effets par classe et par numéro de case : skilltree-effects.js
   ============================================================ */
(function () {
  'use strict';

  var STEP = 57;
  var CENTER = '0,0';

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
    [[-4,-1],[-5,0],[-4,1],[-4,2],[-4,3]],
    [[-3,0],[-2,1],[-1,0]],
    [[-2,1],[-2,2],[-2,3],[-1,3],[-1,2],[-2,1]],
    [[-2,1],[-3,2],[-2,2],[-1,2]],
    [[-3,2],[-2,3]],
    [[-1,2],[0,1]],
    [[-1,2],[0,3],[0,4]],
    [[0,3],[1,2]],
    [[-3,4],[-2,3]],
    [[-2,4],[-2,5]],
    [[-1,4],[0,5],[1,4]],
    [[1,-3],[1,-2],[2,-1],[1,0],[0,0]],
    [[1,-2],[2,-2],[3,-2],[2,-1],[3,0]],
    [[1,-3],[2,-3],[2,-2]],
    [[2,-3],[3,-2]],
    [[4,-3],[4,-2]],
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

  // Liaisons présentes dans le tracé mais absentes de l'arbre réel
  var REMOVED = { '-5,-2|-4,-3': 1, '-3,4|-2,5': 1, '5,2|4,3': 1 };

  var GRAPH = (function () {
    var nodes = {}, edges = {}, adj = {};
    EXPANDED.forEach(function (c) {
      for (var i = 0; i < c.length; i++) {
        var a = c[i].join(',');
        nodes[a] = c[i];
        adj[a] = adj[a] || {};
        if (i === 0) continue;
        var b = c[i - 1].join(',');
        var ek = a < b ? a + '|' + b : b + '|' + a;
        if (REMOVED[ek] || REMOVED[b + '|' + a] || REMOVED[a + '|' + b]) continue;
        edges[ek] = [c[i - 1], c[i]];
        adj[b] = adj[b] || {};
        adj[a][b] = 1; adj[b][a] = 1;
      }
    });
    return { nodes: nodes, edges: edges, adj: adj };
  })();

  // Numéro stable par case (0 = centre), du centre vers l'extérieur puis dans le sens horaire.
  var NUMBERS = (function () {
    var keys = Object.keys(GRAPH.nodes).sort(function (a, b) {
      var A = GRAPH.nodes[a], B = GRAPH.nodes[b];
      var da = Math.abs(A[0]) + Math.abs(A[1]), db = Math.abs(B[0]) + Math.abs(B[1]);
      if (da !== db) return da - db;
      var aa = (Math.atan2(A[1], A[0]) + 2.5 * Math.PI) % (2 * Math.PI);
      var ab = (Math.atan2(B[1], B[0]) + 2.5 * Math.PI) % (2 * Math.PI);
      return aa - ab || A[0] - B[0];
    });
    var map = {};
    keys.forEach(function (k, i) { map[k] = i; });
    return map;
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

  // Effet d'une case pour une classe : { name, stats, bonus } ou null
  function effectOf(key, classe) {
    var all = window.VCL_SKILL_EFFECTS;
    var byClass = all && classe && all[classe];
    return (byClass && byClass[NUMBERS[key]]) || null;
  }

  // Modifications admin (config/skilltree) : { classe: { numéro: {name, stats, bonus} | {none:true} } }
  var overrides = {};
  function applyOverrides(obj) {
    overrides = obj || {};
    var all = window.VCL_SKILL_EFFECTS = window.VCL_SKILL_EFFECTS || {};
    Object.keys(overrides).forEach(function (c) {
      all[c] = all[c] || {};
      Object.keys(overrides[c]).forEach(function (n) {
        var v = overrides[c][n];
        if (v && v.none) delete all[c][n];
        else if (v) all[c][n] = { name: v.name, stats: v.stats, bonus: v.bonus };
      });
    });
    window.dispatchEvent(new CustomEvent('vcl:skilltree-effects'));
  }

  function statsFor(nodes, classe) {
    var total = {};
    [CENTER].concat(nodes || []).forEach(function (k) {
      var fx = effectOf(k, classe);
      if (fx) total[fx.stats] = (total[fx.stats] || 0) + fx.bonus;
    });
    return total;
  }

  function effectText(fx) {
    var def = typeof ALL_STATS !== 'undefined' && ALL_STATS.find(function (x) { return x.id === fx.stats; });
    var label = def ? def.label : fx.stats, unit = def ? def.unit : '';
    return fx.name + ' — +' + fx.bonus + unit + ' ' + label;
  }

  window.VCLSkillTree = { graph: GRAPH, numbers: NUMBERS, sanitize: sanitize, statsFor: statsFor, maxPoints: maxPoints, applyOverrides: applyOverrides };

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
  var src = null, readOnly = false;
  var editing = false, editSnap = null, changed = {};

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

  function statDef(id) {
    return typeof ALL_STATS !== 'undefined' ? ALL_STATS.find(function (x) { return x.id === id; }) : null;
  }
  function escapeHtml(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function showTip(g) {
    var k = g.getAttribute('data-k'), classe = src && src.getClass();
    var fx = classe ? effectOf(k, classe) : null;
    var html;
    if (k === CENTER) {
      var cls = classe && typeof CLASSES !== 'undefined' && CLASSES.find(function (c) { return c.id === classe; });
      var lbl = cls ? cls.label : '';
      var voie = lbl ? 'Voie ' + (/^[aeiouyéèêàâîô]/i.test(lbl) ? 'de l’' : 'du ') + lbl : 'Case de départ';
      html = '<div class="st-tip-name st-tip-solo">' + escapeHtml(voie) + '</div>';
    } else {
      var cl = classe && typeof CLASSES !== 'undefined' && CLASSES.find(function (c) { return c.id === classe; });
      var title = fx ? fx.name : (KEYSTONES[k] ? 'Case majeure' : 'Compétence');
      html = '<div class="st-tip-name">' + escapeHtml(title) + '</div>' +
        '<div class="st-tip-class">' + escapeHtml(cl ? cl.label : 'Toutes classes') + '</div>' +
        '<div class="st-tip-sep"></div>';
      if (fx) {
        var d = statDef(fx.stats), unit = d ? d.unit : '';
        html += '<div class="st-tip-stat"><span class="st-tip-ico">' + (d ? d.icon : '') + '</span>' +
          escapeHtml(d ? d.label : fx.stats) + ' +' + fx.bonus + unit + '</div>';
      } else {
        html += '<div class="st-tip-stat st-tip-dim">' + (classe ? 'Aucun effet' : 'Choisis une classe pour voir les effets') + '</div>';
      }
      if (!readOnly) {
        var nodes = src.getNodes(), ownedMap = { '0,0': 1 };
        nodes.forEach(function (n) { ownedMap[n] = 1; });
        var left = maxPoints(src.getLevel()) - nodes.length, hint;
        if (ownedMap[k]) hint = '<span class="st-tip-ok">Compétence débloquée.</span> Clique pour la retirer.';
        else if (left <= 0) hint = 'Plus de points de compétence.';
        else if (canTake(k, ownedMap)) hint = '<span class="st-tip-act">Clique pour débloquer</span> cette compétence.<br>Coût : 1 point de compétence <span class="st-tip-pt"></span>';
        else hint = KEYSTONES[k] ? 'Il faut avoir débloqué les 4 compétences voisines.' : 'Il faut d’abord débloquer une compétence voisine.';
        html += '<div class="st-tip-sep"></div><div class="st-tip-hint">' + hint + '</div>';
      }
    }
    ui.tip.innerHTML = html;
    ui.tip.classList.add('show');
    var pr = ui.panel.getBoundingClientRect(), nr = g.getBoundingClientRect();
    var half = ui.tip.offsetWidth / 2 + 8;
    var x = Math.min(Math.max(nr.left + nr.width / 2 - pr.left, half), pr.width - half);
    ui.tip.style.left = x + 'px';
    var below = nr.top - pr.top - 10 < ui.tip.offsetHeight + 4;
    ui.tip.classList.toggle('below', below);
    ui.tip.style.top = (below ? nr.bottom - pr.top + 10 : nr.top - pr.top - 10) + 'px';
  }
  function hideTip() { if (ui.tip) ui.tip.classList.remove('show'); }

  function render() {
    var A = src;
    var nodes = A.getNodes(), owned = {};
    owned[CENTER] = 1;
    nodes.forEach(function (k) { owned[k] = 1; });
    var max = maxPoints(A.getLevel());
    var left = max - nodes.length;

    hideTip();
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
      var avail = !readOnly && !isOwned && left > 0 && canTake(k, owned);
      var cls = 'st-node' + (isCenter ? ' st-center' : '') + (isKey ? ' st-key' : '') +
                (isOwned ? ' st-owned' : avail ? ' st-avail' : '');
      var g = el('g', { class: cls, transform: 'translate(' + n[0] * STEP + ',' + n[1] * STEP + ')', 'data-k': k }, svg);
      var r = isCenter ? 15 : isKey ? 12 : 9;
      if (isCenter) diamond(g, r + 5, 'st-ring');
      diamond(g, r, 'st-shape');
      if (editing && !isCenter) {
        var num = el('text', { class: 'st-num', y: r + 15 }, g);
        num.textContent = NUMBERS[k];
      }
      if (isCenter || isKey) {
        el('rect', { x: -9, y: -9, width: 18, height: 18, mask: 'url(#st-icon-mask)', fill: 'currentColor',
                     transform: 'scale(' + (r * 1.4 / 18) + ')', class: 'st-glyph' }, g);
      } else {
        el('use', { href: '#st-glyph', x: -9, y: -9, width: 18, height: 18, transform: 'scale(' + (r / 11) + ')', class: 'st-glyph' }, g);
      }
    });
    ui.points.textContent = readOnly ? nodes.length + ' / ' + max : left + ' / ' + max;
    ui.points.classList.toggle('empty', !readOnly && left <= 0);
  }

  function setInfo(msg) { ui.info.textContent = msg || ''; }

  function onNodeClick(k) {
    if (editing) { selectForEdit(k); return; }
    if (readOnly) return;
    var A = src;
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
    setInfo(null);
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
      var nw = Math.min(8 * FULL, Math.max(240, view.w * f)), k = nw / view.w;
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
      hideTip();
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
      if (g && !(drag && drag.moved)) showTip(g);
    });
    svg.addEventListener('mouseout', function (e) {
      var g = e.target.closest && e.target.closest('.st-node');
      if (g && !(e.relatedTarget && g.contains(e.relatedTarget))) hideTip();
    });
  }

  /* ── Mode édition (admin) ── */
  function isAdmin() { return window._vcl_base_role === 'admin'; }

  function setEffect(classe, num, fx) {
    var all = window.VCL_SKILL_EFFECTS = window.VCL_SKILL_EFFECTS || {};
    all[classe] = all[classe] || {};
    changed[classe] = changed[classe] || {};
    if (fx) { all[classe][num] = fx; changed[classe][num] = fx; }
    else { delete all[classe][num]; changed[classe][num] = { none: true }; }
    window.dispatchEvent(new CustomEvent('vcl:skilltree-effects'));
  }

  // Effets existants (toutes classes confondues), dédoublonnés par nom + stat
  function effectOptions(classe) {
    var all = window.VCL_SKILL_EFFECTS || {}, seen = {}, list = [];
    (window.VCL_SKILL_CATALOG || []).forEach(function (e) {
      var key = e.name + '|' + e.stats;
      if (!seen[key]) { seen[key] = 1; list.push({ key: key, name: e.name, stats: e.stats, bonus: e.bonus }); }
    });
    [classe].concat(Object.keys(all)).forEach(function (c) {
      Object.keys(all[c] || {}).forEach(function (n) {
        var e = all[c][n], key = e.name + '|' + e.stats;
        if (!seen[key]) { seen[key] = 1; list.push({ key: key, name: e.name, stats: e.stats, bonus: e.bonus }); }
      });
    });
    return list.sort(function (a, b) { return a.name.localeCompare(b.name, 'fr'); });
  }

  function selectForEdit(k) {
    var classe = src.getClass();
    if (k === CENTER || !classe) return;
    var num = NUMBERS[k], cur = effectOf(k, classe), opts = effectOptions(classe);
    var html = '<div class="st-ed-title">Case n°' + num + '</div>' +
      '<select class="st-ed-sel"><option value="">— Aucun effet —</option>' +
      opts.map(function (o, i) {
        var d = statDef(o.stats);
        return '<option value="' + i + '"' + (cur && cur.name + '|' + cur.stats === o.key ? ' selected' : '') + '>' +
          escapeHtml(o.name) + ' (' + escapeHtml(d ? d.label : o.stats) + ')</option>';
      }).join('') + '</select>' +
      '<label class="st-ed-val">Valeur <input type="number" step="any" class="st-ed-num" value="' + (cur ? cur.bonus : '') + '"' + (cur ? '' : ' disabled') + ' /></label>';
    ui.editor.innerHTML = html;
    ui.editor.hidden = false;
    var sel = ui.editor.querySelector('.st-ed-sel'), inp = ui.editor.querySelector('.st-ed-num');
    function apply() {
      if (sel.value === '') { setEffect(classe, num, null); inp.disabled = true; inp.value = ''; return; }
      var o = opts[+sel.value], b = parseFloat(inp.value);
      inp.disabled = false;
      setEffect(classe, num, { name: o.name, stats: o.stats, bonus: isNaN(b) ? o.bonus : b });
    }
    sel.addEventListener('change', function () {
      if (sel.value !== '') { inp.value = opts[+sel.value].bonus; }
      apply();
    });
    inp.addEventListener('input', function () { if (sel.value !== '' && inp.value !== '') apply(); });
    ui.info.textContent = '';
  }

  function startEdit() {
    var classe = src.getClass();
    if (!classe) { ui.info.textContent = 'Choisis une classe pour modifier ses cases.'; return; }
    editing = true; changed = {};
    editSnap = JSON.parse(JSON.stringify((window.VCL_SKILL_EFFECTS || {})[classe] || {}));
    ui.editBtn.hidden = true; ui.editActions.hidden = false;
    ui.info.textContent = 'Mode édition : clique une case pour changer son effet.';
    render();
  }

  function endEdit() {
    editing = false; changed = {}; editSnap = null;
    ui.editor.hidden = true; ui.editActions.hidden = true; ui.editBtn.hidden = false;
    render();
  }

  function cancelEdit() {
    if (!editing) return;
    var classe = src.getClass();
    if (classe) window.VCL_SKILL_EFFECTS[classe] = editSnap;
    window.dispatchEvent(new CustomEvent('vcl:skilltree-effects'));
    endEdit();
    ui.info.textContent = 'Modifications annulées.';
  }

  function confirmEdit() {
    if (!editing) return;
    var next = JSON.parse(JSON.stringify(overrides));
    Object.keys(changed).forEach(function (c) {
      next[c] = next[c] || {};
      Object.keys(changed[c]).forEach(function (n) { next[c][n] = changed[c][n]; });
    });
    if (!window.VCLSkillSync) { ui.info.textContent = 'Synchronisation indisponible.'; return; }
    ui.info.textContent = 'Enregistrement…';
    window.VCLSkillSync.save(next).then(function () {
      overrides = next;
      endEdit();
      ui.info.textContent = 'Modifications enregistrées.';
    }).catch(function (e) {
      ui.info.textContent = 'Échec de l’enregistrement : ' + (e && e.message || e);
    });
  }

  var OVERLAY_HTML =
    '<div class="st-panel">' +
      '<div class="st-stars" aria-hidden="true"></div>' +
      '<div class="st-tip"></div>' +
      '<button class="st-close" aria-label="Fermer" title="Fermer (Échap)">✕</button>' +
      '<svg class="st-svg" xmlns="http://www.w3.org/2000/svg">' +
        '<defs>' +
          '<symbol id="st-glyph" viewBox="-9 -9 18 18" overflow="visible">' +
            '<rect x="-2.6" y="-2.6" width="5.2" height="5.2" transform="rotate(45)" fill="currentColor"/>' +
          '</symbol>' +
          '<mask id="st-icon-mask" maskUnits="userSpaceOnUse" x="-9" y="-9" width="18" height="18">' +
            '<image href="../img/skilltree-icon.png" x="-9" y="-9" width="18" height="18" />' +
          '</mask>' +
        '</defs>' +
        '<g class="st-world"></g>' +
      '</svg>' +
      '<aside class="st-side">' +
        '<div class="st-title">Arbre de compétences</div>' +
        '<div class="st-points">' +
          '<span class="st-points-lbl">Points restants</span>' +
          '<span class="st-points-val">0 / 0</span>' +
        '</div>' +
        '<div class="st-info"></div>' +
        '<div class="st-editor" hidden></div>' +
        '<div class="st-admin" hidden>' +
          '<button class="st-edit">✎ Modifier</button>' +
          '<div class="st-edit-actions" hidden>' +
            '<button class="st-confirm">✓ Confirmer</button>' +
            '<button class="st-cancel">Annuler</button>' +
          '</div>' +
        '</div>' +
        '<button class="st-reset">⟳ Réinitialiser l’arbre</button>' +
      '</aside>' +
    '</div>';

  function ensureOverlay() {
    if (ui.overlay) return ui.overlay;
    var overlay = document.createElement('div');
    overlay.id = 'skilltree-overlay';
    overlay.className = 'skilltree-overlay';
    overlay.innerHTML = OVERLAY_HTML;
    document.body.appendChild(overlay);
    ui.overlay = overlay;
    ui.panel = overlay.querySelector('.st-panel');
    ui.tip = overlay.querySelector('.st-tip');
    ui.svg = overlay.querySelector('.st-svg');
    ui.info = overlay.querySelector('.st-info');
    ui.points = overlay.querySelector('.st-points-val');
    ui.pointsLbl = overlay.querySelector('.st-points-lbl');
    ui.reset = overlay.querySelector('.st-reset');
    ui.admin = overlay.querySelector('.st-admin');
    ui.editor = overlay.querySelector('.st-editor');
    ui.editBtn = overlay.querySelector('.st-edit');
    ui.editActions = overlay.querySelector('.st-edit-actions');
    ui.world = ui.svg.querySelector('.st-world');
    makeStars(overlay.querySelector('.st-stars'));
    bindPanZoom();

    function close() { overlay.classList.remove('open'); }
    overlay.querySelector('.st-close').addEventListener('click', function () { if (editing) cancelEdit(); close(); });
    ui.editBtn.addEventListener('click', startEdit);
    overlay.querySelector('.st-confirm').addEventListener('click', confirmEdit);
    overlay.querySelector('.st-cancel').addEventListener('click', cancelEdit);
    ui.reset.addEventListener('click', function () {
      if (readOnly) return;
      src.setNodes([]);
      render();
    });
    overlay.addEventListener('mousedown', function (e) { if (e.target === overlay) close(); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('open')) close();
    });
    window.addEventListener('resize', function () { if (overlay.classList.contains('open')) fitView(); });
    return overlay;
  }

  function open(source, ro) {
    var overlay = ensureOverlay();
    src = source; readOnly = !!ro;
    overlay.setAttribute('data-class', src.getClass() || 'none');
    ui.reset.style.display = readOnly ? 'none' : '';
    ui.pointsLbl.textContent = readOnly ? 'Points dépensés' : 'Points restants';
    editing = false; ui.editor.hidden = true; ui.editActions.hidden = true; ui.editBtn.hidden = false;
    ui.admin.hidden = !isAdmin();
    overlay.classList.add('open');
    fitView();
    render();
    setInfo(null);
  }

  // Lecture seule : { nodes, level, classe } (ex. build publié)
  function openReadOnly(build) {
    var level = build.level || 1;
    var nodes = sanitize(build.nodes || [], maxPoints(level));
    open({
      getNodes: function () { return nodes; },
      getLevel: function () { return level; },
      getClass: function () { return build.classe || null; },
      setNodes: function () {}
    }, true);
  }

  window.VCLSkillTree.open = open;
  window.VCLSkillTree.openReadOnly = openReadOnly;

  function init() {
    var btn = document.getElementById('btn-skilltree');
    if (btn) btn.addEventListener('click', function () { open(window._atelierSkills, false); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
