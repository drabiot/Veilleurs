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

  // Agrandit ×3 sans lissage (la police pixel reste nette) ; 2 variantes lues puis fusionnées : couleurs d'origine, et niveaux de gris inversés.
  // (Un seuillage noir/blanc a été essayé : il abîme les petits textes colorés des infobulles.)
  function prepare(src) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const k = Math.max(1, Math.min(3, 3200 / img.width));
        const mk = invert => {
          const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(img, 0, 0, c.width, c.height);
          if (invert) {
            const d = x.getImageData(0, 0, c.width, c.height), p = d.data;
            for (let i = 0; i < p.length; i += 4) { const g = 255 - (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]); p[i] = p[i + 1] = p[i + 2] = g; }
            x.putImageData(d, 0, 0);
          }
          return c;
        };
        res([() => mk(false), () => mk(true)]); // créées à la demande : deux grands canvas en mémoire font échouer la lecture
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
      for (const make of await prepare(srcs[i])) {
        const r = await w.recognize(make());
        text += '\n' + r.data.text;
      }
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
      // Classe : « Classe : mage » sur la capture
      const cls = Array.isArray(d.classes) ? d.classes : [];
      if (cls.length) {
        const lab = id => (typeof CLASSES !== 'undefined' ? CLASSES.find(c => c.id === id)?.label : '') || id;
        const miss = cls.filter(id => !words(lab(id)).every(w => tokenIn(w, allTokens)));
        rows.push({ label: 'Classe', expected: cls.map(lab).join(', '), status: miss.length === 0 ? 'ok' : miss.length < cls.length ? 'warn' : 'miss', note: miss.length ? 'non retrouvée : ' + miss.map(lab).join(', ') : '' });
      }
      // Niveau : « Niveau Minimum : 9 » (le début du mot est souvent mal lu : on cherche la fin « …veau »)
      if (d.lvl != null && d.lvl !== '') {
        // On repère la ligne « …iveau Minimum : N » (début de mot souvent mal lu : « Hiveau », « Miveau », « Mininun »…) puis on lit le chiffre
        const lv = lines.find(l => /(veau|iveau|mini[mn]|minin)/.test(l.raw) && /[0-9]/.test(l.raw));
        const nums = lv ? (lv.raw.match(/[0-9]+/g) || []) : [];
        const okN = nums.includes(String(d.lvl)) || numRe(d.lvl).test(allText) && !!lv;
        rows.push({ label: 'Niveau', expected: String(d.lvl), status: okN ? 'ok' : lv ? 'warn' : 'miss', note: okN ? '' : lv ? `lu sur la capture : ${nums.join(', ')}` : 'ligne « Niveau » non retrouvée' });
      }
      // Lore : les mots de la description doivent se retrouver
      const lw = words(d.lore || '').filter(w => w.length > 3);
      if (lw.length) {
        const hit = lw.filter(w => tokenIn(w, allTokens)).length, ratio = hit / lw.length;
        rows.push({ label: 'Lore', expected: String(d.lore).replace(/\s+/g, ' ').slice(0, 70) + (String(d.lore).length > 70 ? '…' : ''), status: ratio >= 0.75 ? 'ok' : ratio >= 0.4 ? 'warn' : 'miss', note: ratio >= 0.75 ? '' : `${hit}/${lw.length} mots retrouvés` });
      }
      // Rareté (couleur du fond) et palier (non écrit sur la capture) : non vérifiables par lecture de texte.
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
      <div style="font-size:10px;color:var(--muted);margin-top:6px;">Lecture automatique imparfaite : ⚠️ / ❓ = à vérifier à l'œil, pas forcément une erreur. Rareté (couleur du fond) et palier ne sont pas vérifiés.</div>
      <details style="margin-top:4px;"><summary style="font-size:11px;cursor:pointer;color:var(--muted);">Texte lu sur la capture</summary><pre style="white-space:pre-wrap;font-size:11px;max-height:160px;overflow:auto;">${(window.VCL?.escHtml ? window.VCL.escHtml(text) : text).trim()}</pre></details>`;
  }

  window._verifyInternals = { runOCR, check, prepare }; // diagnostic
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
    } catch (e) { console.error('[verify]', e); box.textContent = '⛔ Vérification impossible : ' + (e && e.message || e); }
    if (btn) btn.disabled = false;
  };
})();
