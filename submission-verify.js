/* Vérification automatique des soumissions : lit les captures d'écran (OCR dans le navigateur du modérateur, gratuit, aucune donnée envoyée)
   et compare le texte lu aux champs saisis. Aide à la modération uniquement : ne valide ni ne refuse jamais. */
(function () {
  const TESS_URL = 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js';
  let _tessPromise = null, _worker = null;

  const SG = () => (typeof STAT_GROUPS !== 'undefined' ? STAT_GROUPS : []); // const globale de Compendium/data.js (pas sur window)
  const norm = s => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%,.+\-\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = s => norm(s).replace(/[%,.+\-]/g, ' ').split(' ').filter(Boolean);

  function loadTesseract() {
    if (window.Tesseract) return Promise.resolve(window.Tesseract);
    if (!_tessPromise) _tessPromise = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = TESS_URL; s.onload = () => res(window.Tesseract); s.onerror = () => { _tessPromise = null; rej(new Error('Tesseract.js non chargé (réseau ?)')); };
      document.head.appendChild(s);
    });
    return _tessPromise;
  }
  async function getWorker(onStatus) {
    if (_worker) return _worker;
    const T = await loadTesseract();
    onStatus?.('Chargement du moteur de lecture (1re fois : ~15 Mo)…');
    _worker = await T.createWorker('fra');
    return _worker;
  }

  // Agrandit, passe en niveaux de gris et force un fond sombre → texte clair (les captures du jeu sont claires sur fond sombre).
  function prepare(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.max(1, Math.min(3, 1800 / img.width));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        const x = c.getContext('2d'); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, c.width, c.height);
        const d = x.getImageData(0, 0, c.width, c.height), p = d.data; let sum = 0;
        for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; sum += g; }
        const dark = sum / (p.length / 4) < 128;
        for (let i = 0; i < p.length; i += 4) { let g = p[i]; g = dark ? 255 - g : g; g = g > 150 ? 255 : g < 90 ? 0 : g; p[i] = p[i + 1] = p[i + 2] = g; }
        x.putImageData(d, 0, 0); res(c);
      };
      img.onerror = () => rej(new Error('Image illisible'));
      img.src = src;
    });
  }

  // distance d'édition bornée (OCR : une lettre fausse ne doit pas tout casser)
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 3;
    const m = [...Array(a.length + 1)].map((_, i) => [i]);
    for (let j = 1; j <= b.length; j++) m[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++)
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    return m[a.length][b.length];
  }
  const tokenIn = (tok, tokens) => tokens.some(t => t === tok || (tok.length > 4 && lev(tok, t) <= 1) || (tok.length >= 3 && t.length >= 3 && (t.startsWith(tok.slice(0, 3)) && tok.slice(0, 3).length === 3 && Math.min(t.length, tok.length) <= 4)));

  function nameCheck(name, lines, allTokens) {
    const wn = words(name).filter(w => w.length > 1);
    if (!wn.length) return null;
    const hit = wn.filter(w => tokenIn(w, allTokens)).length;
    const ratio = hit / wn.length;
    return { label: 'Nom', expected: name, status: ratio === 1 ? 'ok' : ratio >= 0.5 ? 'warn' : 'miss', note: ratio === 1 ? '' : `${hit}/${wn.length} mots retrouvés` };
  }

  function statLabels(id) {
    const out = [];
    try { for (const g of SG()) for (const s of g.stats) if (s.id === id) out.push(s.label, ...(s.aliases || [])); } catch {}
    const extra = {
      sante: ['vie', 'sante', 'pv'], degats: ['degats', 'attaque'], defense: ['defense'], mana: ['mana'], stamina: ['endurance', 'stamina'],
      vitesse_attaque: ['vitesse', 'attaque'], vitesse_deplacement: ['deplacement', 'vitesse'], crit_chance: ['critique', 'crit'], crit_degats: ['critique', 'crit'],
      crit_comp_chance: ['crit', 'capacites', 'competence'], crit_comp_degats: ['crit', 'capacites', 'competence'], degats_competence: ['capacites', 'competence'],
      esquive: ['esquive'], blocage: ['blocage'], vol_vie: ['vol'], regen_sante: ['regen'], regen_stamina: ['regen'], soins_recus: ['soin']
    };
    if (extra[id]) out.push(...extra[id]);
    return [...new Set(out.flatMap(l => words(l)).filter(w => w.length > 2))];
  }

  const numRe = n => { const s = String(n).replace('.', '[.,]'); return new RegExp('(^|[^0-9])\\+?' + s + '(?![0-9])'); };

  function statChecks(stats, lines, allText) {
    const arr = Array.isArray(stats) ? stats.map(s => [s.id || s.stat, s.value]) : Object.entries(stats || {});
    return arr.filter(([id, v]) => id && v != null && v !== '').map(([id, v]) => {
      const labels = statLabels(id);
      const re = numRe(v);
      const sameLine = lines.some(l => re.test(l.raw) && labels.some(w => tokenIn(w, l.tokens)));
      const numAny = re.test(allText);
      const labelAny = lines.some(l => labels.some(w => tokenIn(w, l.tokens)));
      return {
        label: SG().flatMap(g => g.stats).find(s => s.id === id)?.label || id, expected: String(v),
        status: sameLine ? 'ok' : (numAny && labelAny) ? 'warn' : numAny ? 'warn' : 'miss',
        note: sameLine ? '' : numAny ? 'valeur vue, mais pas à côté du nom de la stat' : labelAny ? 'stat vue, valeur absente ou différente' : 'ni la stat ni la valeur'
      };
    });
  }

  async function runOCR(srcs, onStatus) {
    const w = await getWorker(onStatus);
    let text = '';
    for (let i = 0; i < srcs.length; i++) {
      onStatus?.(`Lecture de la capture ${i + 1}/${srcs.length}…`);
      const canvas = await prepare(srcs[i]);
      const r = await w.recognize(canvas);
      text += '\n' + r.data.text;
    }
    return text;
  }

  function check(sub, text) {
    const d = sub.data || {};
    const lines = text.split('\n').map(l => ({ raw: norm(l), tokens: words(l) })).filter(l => l.raw);
    const allText = lines.map(l => l.raw).join('\n');
    const allTokens = lines.flatMap(l => l.tokens);
    const rows = [];
    const nm = nameCheck(d.name || d.titre || d.label, lines, allTokens); if (nm) rows.push(nm);
    if (sub.type === 'item') {
      rows.push(...statChecks(d.stats, lines, allText));
      if (d.rarity) { const r = norm(d.rarity); rows.push({ label: 'Rareté', expected: d.rarity, status: allTokens.some(t => tokenIn(r.split(' ')[0], [t])) ? 'ok' : 'miss', note: '' }); }
      if (d.palier != null && d.palier !== '') rows.push({ label: 'Palier', expected: String(d.palier), status: /palier\s*[:\-]?\s*p?-?\s*0?/.test(allText) ? (new RegExp('palier\\s*[:\\-]?\\s*p?\\s*' + d.palier + '(?![0-9])').test(allText) ? 'ok' : 'warn') : 'miss', note: '' });
    }
    return { rows, lines: lines.length };
  }

  const ICON = { ok: '✅', warn: '⚠️', miss: '❓' };
  function render(box, res, text) {
    const ok = res.rows.filter(r => r.status === 'ok').length;
    const bad = res.rows.filter(r => r.status !== 'ok').length;
    box.innerHTML = `
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">🔍 Vérification automatique : ${ok}/${res.rows.length} champ(s) retrouvé(s) sur la capture${bad ? ` — ${bad} à contrôler` : ' — tout concorde'}</div>
      <table style="width:100%;border-collapse:collapse;font-size:12px;">
        ${res.rows.map(r => `<tr style="border-top:1px solid var(--border);"><td style="padding:3px 6px;width:24px;">${ICON[r.status]}</td><td style="padding:3px 6px;">${window.VCL?.escHtml ? window.VCL.escHtml(r.label) : r.label}</td><td style="padding:3px 6px;font-family:monospace;">${window.VCL?.escHtml ? window.VCL.escHtml(r.expected) : r.expected}</td><td style="padding:3px 6px;color:var(--muted);">${r.note || ''}</td></tr>`).join('')}
      </table>
      <div style="font-size:10px;color:var(--muted);margin-top:6px;">Lecture automatique imparfaite (police pixel) : ⚠️ / ❓ = à vérifier à l'œil, pas forcément une erreur.</div>
      <details style="margin-top:4px;"><summary style="font-size:11px;cursor:pointer;color:var(--muted);">Texte lu sur la capture</summary><pre style="white-space:pre-wrap;font-size:11px;max-height:160px;overflow:auto;">${(window.VCL?.escHtml ? window.VCL.escHtml(text) : text).trim()}</pre></details>`;
  }

  window.verifySubmission = async function (subId) {
    const sub = (window._allSubsForVerify ? window._allSubsForVerify() : []).find(s => s._id === subId);
    const card = document.getElementById('btn-verify-' + subId)?.closest('.sub-card, .card, [data-sub-id]') || document.getElementById('screens-' + subId)?.parentElement;
    let box = document.getElementById('verify-' + subId);
    if (!box) {
      box = document.createElement('div'); box.id = 'verify-' + subId;
      box.style.cssText = 'margin-top:8px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;';
      (document.getElementById('screens-' + subId) || card)?.after(box);
    }
    const srcs = sub?.screenshots?.length ? sub.screenshots : sub?.forum_image ? [sub.forum_image] : [];
    if (!sub) { box.textContent = 'Soumission introuvable.'; return; }
    if (!srcs.length) { box.innerHTML = '⚠️ Aucune capture jointe : rien à vérifier.'; return; }
    const btn = document.getElementById('btn-verify-' + subId); if (btn) btn.disabled = true;
    const status = t => { box.textContent = '⏳ ' + t; };
    try {
      status('Préparation…');
      const text = await runOCR(srcs, status);
      render(box, check(sub, text), text);
    } catch (e) { box.textContent = '⛔ Vérification impossible : ' + e.message; }
    if (btn) btn.disabled = false;
  };
})();
