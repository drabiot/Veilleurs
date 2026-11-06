/* Creator v2 — couche UI : rail d'étapes, pastille de validation, stats compactes, icônes.
   Ne touche à aucune logique : lit le DOM de creator.js (ids inchangés). */
(function () {
  'use strict';

  const FORM_IDS = ['item-form', 'mob-form', 'pnj-form', 'region-form', 'quest-form', 'panoplie-form'];
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const EMOJI_LEAD = /^[\p{Extended_Pictographic}️‍\s]+/u;
  const val = id => (document.getElementById(id)?.value || '').trim();

  const layout = $('#main-layout');
  const panel = $('#formPanel');
  if (!layout || !panel) return;

  // Les emojis (onglets, titres, boutons) sont conservés : on privilégie l'emoji aux icônes SVG.
  function decorate() {
    // textes explicatifs inline très longs
    $$('.sec-head > span, .field > label > span, .coords-label span').forEach(sp => {
      if (sp.classList.contains('chev') || sp.classList.contains('sec-tag') || sp.classList.contains('req') || sp.id || sp.dataset.v2) return;
      if (sp.textContent.trim().length > 22) { sp.dataset.v2 = '1'; sp.style.display = 'none'; }
    });
    const q = $('#stat-search'); if (q && !q.dataset.v2) { q.dataset.v2 = '1'; q.placeholder = 'Ajouter une stat…'; }
    const modeBar = $('.mode-selector');
    if (modeBar) document.documentElement.style.setProperty('--mode-h', modeBar.offsetHeight + 'px');
  }

  // ── Stats : seules les stats utilisées sont visibles, la recherche ajoute ──
  function statsCompact() {
    const box = $('#stats-container'); if (!box) return;
    box.classList.add('compact');
    let total = 0;
    $$('.stat-row', box).forEach(r => {
      if (!r.querySelector('.srow-x')) { // ✕ : retire la ligne (vide les valeurs, la masque)
        const x = document.createElement('button');
        x.type = 'button'; x.className = 'srow-x'; x.title = 'Retirer cette stat'; x.setAttribute('aria-label', 'Retirer cette stat'); x.textContent = '✕';
        x.onclick = () => {
          $$('input', r).forEach(i => { if (i.value !== '') { i.value = ''; i.dispatchEvent(new Event('input', { bubbles: true })); } });
          r.classList.remove('v2-pin', 'v2-used', 'has-val');
          schedule();
        };
        r.appendChild(x);
      }
      const u = $$('input', r).some(i => i.value !== '');
      r.classList.toggle('v2-used', u);
      if (u || r.classList.contains('v2-pin')) total++;
    });
    $$('.stat-group-label', box).forEach(g => {
      let n = g.nextElementSibling, any = false;
      while (n && !n.classList.contains('stat-group-label')) { if (n.classList.contains('v2-used') || n.classList.contains('v2-pin')) any = true; n = n.nextElementSibling; }
      g.classList.toggle('v2-empty', !any);
    });
    const head = box.previousElementSibling; // en-tête « Stat / Min / Max »
    if (head) head.style.display = total ? 'grid' : 'none';
  }

  // Recherche de stat : liste déroulante (noms seulement). ↑↓ + Entrée / clic = ajoute la stat, curseur sur sa valeur.
  const statSearch = $('#stat-search');
  const pinRow = r => r.classList.add('v2-pin');
  let statDrop = null, statHits = [], statIdx = 0;
  if (statSearch) {
    statSearch.parentNode.classList.add('stat-searchbar');
    statDrop = document.createElement('div');
    statDrop.id = 'stat-drop'; statDrop.hidden = true;
    statSearch.parentNode.appendChild(statDrop);
  }
  const closeStatDrop = () => { if (statDrop) { statDrop.hidden = true; statHits = []; } };
  function pickStat(row) {
    pinRow(row);
    closeStatDrop();
    statSearch.value = '';
    statSearch.dispatchEvent(new Event('input', { bubbles: true })); // filterStats() remet à zéro
    statsCompact();
    // le curseur reste dans la recherche : on peut enchaîner les stats, puis remplir les valeurs à la main
    row.classList.add('v2-flash'); setTimeout(() => row.classList.remove('v2-flash'), 900);
    statSearch.focus();
  }
  function paintStatDrop() {
    statDrop.innerHTML = '';
    statHits.forEach((h, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sd-item' + (i === statIdx ? ' on' : '') + (h.added ? ' added' : '');
      b.innerHTML = '<span class="sd-name"></span><span class="sd-group"></span>';
      const nm = $('.sd-name', b); nm.textContent = h.label; if (h.color) nm.style.color = h.color;
      $('.sd-group', b).textContent = h.added ? 'ajoutée' : h.group;
      b.onmousedown = e => { e.preventDefault(); pickStat(h.row); };
      statDrop.appendChild(b);
    });
    statDrop.hidden = !statHits.length;
    const on = $('.sd-item.on', statDrop); if (on) on.scrollIntoView({ block: 'nearest' });
  }
  function searchStats() {
    const q = statSearch.value.trim().toLowerCase();
    if (!q) { closeStatDrop(); return; }
    statDrop.style.width = statSearch.offsetWidth + 'px';
    const fm = typeof fuzzyMatch === 'function' ? fuzzyMatch : (a, b) => b.includes(a);
    statHits = [];
    $$('#stats-container .stat-row').forEach(row => {
      const lab = $('label', row); if (!lab) return;
      if (!fm(q, lab.textContent.toLowerCase())) return;
      let g = row.previousElementSibling; while (g && !g.classList.contains('stat-group-label')) g = g.previousElementSibling;
      statHits.push({ row, label: lab.textContent.trim(), color: lab.style.color, group: g ? g.textContent.trim() : '', added: row.classList.contains('v2-used') || row.classList.contains('v2-pin') });
    });
    statHits.sort((a, b) => a.added - b.added); // non ajoutées d'abord
    statIdx = 0;
    paintStatDrop();
  }
  if (statSearch) {
    statSearch.addEventListener('input', searchStats);
    statSearch.addEventListener('blur', () => setTimeout(closeStatDrop, 120));
    statSearch.addEventListener('keydown', e => {
      if (!statHits.length) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); statIdx = (statIdx + 1) % statHits.length; paintStatDrop(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); statIdx = (statIdx - 1 + statHits.length) % statHits.length; paintStatDrop(); }
      else if (e.key === 'Enter') { e.preventDefault(); pickStat(statHits[statIdx].row); }
      else if (e.key === 'Escape') { e.stopPropagation(); closeStatDrop(); }
    });
  }
  // les stats ajoutées restent affichées (même vides) jusqu'à « Vider »
  const origClear = window.clearStats;
  if (typeof origClear === 'function') window.clearStats = function () {
    $$('#stats-container .stat-row.v2-pin').forEach(r => r.classList.remove('v2-pin'));
    return origClear.apply(this, arguments);
  };

  // ── Rail ──────────────────────────────────────────────────
  const rail = document.createElement('aside');
  rail.id = 'step-rail';
  rail.innerHTML = '<div class="rail-title">Étapes</div><div class="rail-progress"><i></i></div><div class="rail-steps"></div>';
  layout.insertBefore(rail, layout.firstChild);
  const stepsBox = $('.rail-steps', rail);
  const bar = $('.rail-progress > i', rail);

  function activeForm() {
    return FORM_IDS.map(id => document.getElementById(id)).find(f => f && getComputedStyle(f).display !== 'none');
  }
  const modeOf = f => (f ? f.id.replace('-form', '') : '');

  function headTitle(head) {
    const c = head.cloneNode(true);
    $$('.chev, .sec-tag, [id$="badge"]', c).forEach(n => n.remove());
    $$('span', c).forEach(n => { if (n.textContent.trim().length > 18) n.remove(); });
    return c.textContent.replace(EMOJI_LEAD, '').replace(/\s+/g, ' ').trim();
  }

  // Champs obligatoires par mode (ceux que la validation / la soumission exigent)
  const coords = (a, b, c) => ({ el: document.getElementById(a), ok: () => !!(val(a) && val(b) && val(c)) });
  const field = id => ({ el: document.getElementById(id), ok: () => !!val(id) });
  function requirements(mode) {
    switch (mode) {
      case 'item': {
        const r = [field('f-name'), field('f-category'), field('f-palier'),
          { el: $('#rarity-field'), ok: () => !!$('#rarity-field .r-btn.active') },
          { el: document.getElementById('f-lore'), ok: () => !!val('f-lore') || ['consommable', 'nourriture'].includes(val('f-category')) }];
        if (['event', 'worldboss'].includes(val('f-palier'))) r.push(field('f-event-name'));
        return r;
      }
      case 'mob':      return [field('mob-name'), field('mob-palier')];
      case 'pnj':      return [field('pnj-type'), coords('pnj-x', 'pnj-y', 'pnj-z'), field('pnj-palier')];
      case 'region':   return [field('reg-name'), field('reg-palier'), coords('reg-x', 'reg-y', 'reg-z'), field('reg-lore')];
      case 'quest':    return [field('quest-titre'), field('quest-type'), coords('quest-cx', 'quest-cy', 'quest-cz')];
      case 'panoplie': return [field('panop-label'), { el: $('#panop-bonuses-list'), ok: () => $$('#panop-bonuses-list input').some(i => i.type !== 'hidden' && i.value.trim() !== '') }];
    }
    return [];
  }

  function isFilled(sec) {
    if (sec.classList.contains('has-items')) return true;
    if (sec.querySelector('.r-btn.active, .cls-btn.active, .p-tag.active, .stat-row.v2-used, .stat-row.has-val')) return true;
    if (sec.querySelector('#screens-preview-list > *')) return true;   // (les lignes vides ne comptent pas : seules les valeurs saisies)
    return $$('input, textarea, select', sec).some(el => {
      if (el.type === 'hidden' || el.readOnly || el.id === 'stat-search') return false;
      if (el.closest('.stat-row')) return false;
      if (el.tagName === 'SELECT') return el.selectedIndex > 0 && el.value !== '';
      return (el.value || '').trim() !== '';
    });
  }

  let sections = [];
  function buildRail() {
    const form = activeForm();
    sections = form ? $$('.section', form).filter(s => !s.classList.contains('loader') && getComputedStyle(s).display !== 'none') : [];
    const prev = $$('.step', stepsBox).map(b => b.dataset.k);
    const keys = sections.map((s, i) => (form.id + ':' + (s.id || headTitle($('.sec-head', s)) || i)));
    if (keys.join('|') !== prev.join('|')) {
      stepsBox.innerHTML = '';
      sections.forEach((s, i) => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'step'; b.dataset.k = keys[i];
        b.innerHTML = '<span class="sdot"></span><span class="slabel"></span><span class="sreq" title="Obligatoire"></span>';
        $('.slabel', b).textContent = headTitle($('.sec-head', s));
        b.onclick = () => {
          const head = $('.sec-head', s);
          if (head && head.classList.contains('collapsed')) head.click();
          s.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
        stepsBox.appendChild(b);
      });
    }
    refreshStatus(form);
  }

  function refreshStatus(form) {
    const btns = $$('.step', stepsBox);
    const reqs = requirements(modeOf(form));
    let done = 0;
    sections.forEach((s, i) => {
      const b = btns[i]; if (!b) return;
      const mine = reqs.filter(r => r.el && r.el.closest('.section') === s);
      let state;
      if (mine.length) {
        const ok = mine.filter(r => r.ok()).length;
        state = ok === mine.length ? 'done' : ok > 0 || isFilled(s) ? 'part' : 'todo';
      } else state = isFilled(s) ? 'done' : 'empty';
      b.classList.toggle('done', state === 'done');
      b.classList.toggle('part', state === 'part');
      b.classList.toggle('todo', state === 'todo' || state === 'part');
      $('.sreq', b).style.display = mine.length && state !== 'done' ? '' : 'none';
      if (state === 'done') done++;
    });
    bar.style.width = (sections.length ? Math.round(done / sections.length * 100) : 0) + '%';
    spy();
  }

  function spy() {
    const btns = $$('.step', stepsBox);
    const top = panel.getBoundingClientRect().top + 130;
    let cur = 0;
    sections.forEach((s, i) => { if (s.getBoundingClientRect().top <= top) cur = i; });
    btns.forEach((b, i) => b.classList.toggle('current', i === cur));
  }

  // ── Validation : pastille + liste déroulante + alertes sous les champs ──
  const chip = $('#validation-chip'), chipTxt = $('#vchip-text'), vpanel = $('#validation-panel'), vpop = $('#vpop');
  const MSG_FIELD = [
    [/Nom affiché/, 'f-name'], [/Catégorie/, 'f-category'], [/Rareté/, 'rarity-field'], [/Lore/, 'f-lore'],
    [/Slot/, 'f-cat'], [/[ÉE]v[èe]nement|World Boss/i, 'f-event-name'], [/Palier/, 'f-palier'],
    [/Niveau requis/, 'f-lvl'], [/CD de craft/, 'f-craft-cd'],
  ];
  function targetOf(id) {
    const el = document.getElementById(id); if (!el) return null;
    if (el.tagName === 'SELECT' && el.parentNode.classList.contains('custom-sel-wrap')) return $('.custom-sel-trigger', el.parentNode) || el;
    return el;
  }
  let lastSig = '';
  function readIssues() {
    const shown = vpanel && vpanel.style.display !== 'none';
    const rows = shown ? $$(':scope > div', vpanel) : [];
    return rows.map(r => {
      const t = r.textContent.trim();
      const kind = t.startsWith('✕') ? 'err' : 'warn';
      const msg = t.replace(/^[✕⚠]\s*/, '');
      const hit = MSG_FIELD.find(([re]) => re.test(msg));
      return { kind, msg, field: hit ? hit[1] : null };
    });
  }
  function refreshChip() {
    if (!chip) return;
    const issues = readIssues();
    const errs = issues.filter(i => i.kind === 'err').length, warns = issues.length - errs;
    chip.className = 'vchip ' + (errs ? 'err' : warns ? 'warn' : 'ok');
    chipTxt.textContent = errs ? (errs + (errs > 1 ? ' champs à compléter' : ' champ à compléter'))
      : warns ? (warns + (warns > 1 ? ' conseils' : ' conseil')) : 'Prêt à soumettre';

    const sig = issues.map(i => i.kind + i.msg).join('|');
    if (sig === lastSig) return;
    lastSig = sig;

    vpop.innerHTML = '';
    issues.forEach(i => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vitem ' + i.kind;
      b.innerHTML = '<span class="vdot"></span><span></span>'; b.lastChild.textContent = i.msg;
      b.onclick = () => {
        vpop.hidden = true;
        const t = i.field === 'rarity-field' ? $('#rarity-field') : targetOf(i.field);
        if (t) { t.scrollIntoView({ behavior: 'smooth', block: 'center' }); setTimeout(() => t.focus && t.focus(), 350); }
      };
      vpop.appendChild(b);
    });
    if (!issues.length) vpop.hidden = true;
  }
  if (chip) chip.addEventListener('click', e => { e.stopPropagation(); if (vpop.children.length) vpop.hidden = !vpop.hidden; });
  document.addEventListener('click', e => { if (vpop && !vpop.hidden && !vpop.contains(e.target)) vpop.hidden = true; });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && vpop) vpop.hidden = true; });

  // ── Champs numériques : jamais de lettres (e, +…) ; coordonnées = entiers (et « - ») ──
  const isCoord = el => !!(el.closest('.coord-field, .coords-row') || /^obtain-res-/.test(el.id));
  document.addEventListener('keydown', e => {
    const t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'number') return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return; // touches de contrôle, flèches, etc.
    if (!(isCoord(t) ? /[0-9-]/ : /[0-9.,-]/).test(e.key)) e.preventDefault();
  }, true);
  document.addEventListener('paste', e => {
    const t = e.target;
    if (!t || t.tagName !== 'INPUT' || t.type !== 'number') return;
    const txt = (e.clipboardData && e.clipboardData.getData('text') || '').trim();
    if (!(isCoord(t) ? /^-?\d+$/ : /^-?\d+([.,]\d+)?$/).test(txt)) e.preventDefault();
  }, true);

  // Taux de drop de l'ajout manuel : même saisie que le loot (chiffres, 0-100), Entrée ajoute
  const manualChance = $('#obtain-manual-chance');
  if (manualChance) {
    manualChance.addEventListener('input', () => {
      let v = manualChance.value.replace(',', '.').replace(/[^\d.]/g, '');
      const i = v.indexOf('.'); if (i >= 0) v = v.slice(0, i + 1) + v.slice(i + 1).replace(/\./g, '');
      if (v !== '' && +v > 100) v = '100';
      if (v !== manualChance.value) manualChance.value = v;
    });
    manualChance.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); $('.lp-manual .btn').click(); } });
  }

  // bouton flottant « Aperçu » (écrans étroits)
  const fab = document.createElement('button');
  fab.type = 'button'; fab.className = 'fab-preview'; fab.textContent = 'Aperçu';
  fab.onclick = () => $('.out-panel').scrollIntoView({ behavior: 'smooth' });
  document.body.appendChild(fab);

  // ── Câblage ───────────────────────────────────────────────
  let t = 0;
  const run = () => { decorate(); statsCompact(); buildRail(); refreshChip(); };
  const schedule = () => { clearTimeout(t); t = setTimeout(run, 120); };

  ['input', 'change', 'click'].forEach(ev => panel.addEventListener(ev, schedule, true));
  panel.addEventListener('scroll', spy, { passive: true });
  new MutationObserver(schedule).observe(panel, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
  if (vpanel) new MutationObserver(refreshChip).observe(vpanel, { childList: true, attributes: true, attributeFilter: ['style'] });

  const wrap = name => {
    const orig = window[name];
    if (typeof orig !== 'function') return;
    window[name] = function () { const r = orig.apply(this, arguments); schedule(); return r; };
  };
  wrap('update');
  const origSwitch = window.switchMode;
  if (typeof origSwitch === 'function') {
    window.switchMode = function () { const r = origSwitch.apply(this, arguments); panel.scrollTop = 0; schedule(); return r; };
  }
  window.addEventListener('resize', schedule);
  run();
  setTimeout(schedule, 800);
  setTimeout(schedule, 2500);
})();
