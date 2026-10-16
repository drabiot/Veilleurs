// ══════════════════════════════════════════════════════
//  ONGLET « API » — items de l'API SAO vs items du wiki
//  Source : data/api-items.json (snapshot statique, rafraîchi par tools/sync_api_items.js / GitHub Action).
//  Le navigateur ne peut pas appeler l'API directement (pas de CORS), d'où le snapshot.
//  Écrit uniquement dans la collection `items` (flux public) + config/api_sync (décisions).
// ══════════════════════════════════════════════════════

const RARITY_COLOR = { commun: '#59d059', rare: '#2a5fa8', epique: '#6a3daa', legendaire: '#d7af5f', mythique: '#f5b5e4', godlike: '#a83020', event: '#ebebeb' };
const RARITY_LABEL = { commun: 'Commun', rare: 'Rare', epique: 'Épique', legendaire: 'Légendaire', mythique: 'Mythique', godlike: 'Godlike', event: 'Event' };
const CATEGORY_LABEL = {
  arme: 'Arme', armure: 'Armure', accessoire: 'Accessoire', materiaux: 'Matériaux', ressources: 'Ressource', outils: 'Outil',
  consommable: 'Consommable', nourriture: 'Nourriture', donjon: 'Donjon', monnaie: 'Monnaie', rune: 'Rune', quete: 'Quête',
};
const CAT_OPTIONS = {
  arme: ['arme_p', 'arme_s'], armure: ['casque', 'plastron', 'jambières', 'bottes'],
  accessoire: ['amulette', 'anneau', 'bracelet', 'gants', 'artefact'], rune: ['rune'],
};
const STAT_LABEL = {
  sante: 'Santé', defense: 'Défense', degats: 'Dégâts', degats_physique: 'Dégâts physiques', degats_magique: 'Dégâts magiques',
  degats_projectile: 'Dégâts projectile', degats_competence: 'Dégâts compétence', degats_arme: 'Dégâts d\'arme', stamina: 'Stamina',
  mana: 'Mana', regen_mana: 'Régén. mana', regen_stamina: 'Régén. stamina', regen_sante: 'Régén. santé', vitesse_attaque: 'Vitesse d\'attaque',
  vitesse_deplacement: 'Vitesse de déplacement', vitesse_accroupi: 'Vitesse accroupi', soin_bonus: 'Bonus de soin', crit_chance: 'Chance crit.',
  crit_degats: 'Dégâts crit.', crit_comp_chance: 'Chance crit. comp.', crit_comp_degats: 'Dégâts crit. comp.', vol_vie: 'Vol de vie',
  omnivamp: 'Omnivamp', reduction_degats: 'Réduction dégâts', blocage: 'Blocage %', puissance_bloc: 'Puissance de blocage', maitrise_bloc: 'Maîtrise de blocage',
  esquive: 'Esquive', tenacite: 'Ténacité', hate: 'Hâte', reduction_chutes: 'Réduction chutes',
  vitalite: 'Vitalité', force: 'Force', intelligence: 'Intelligence', esprit: 'Esprit', dexterite: 'Dextérité', defense_car: 'Défense (req.)',
};
const STATUS_INFO = {
  new:     { label: 'Nouveau',           color: '#3ecf8e' },
  diff:    { label: 'Différences',       color: '#f5a623' },
  same:    { label: 'Identique',         color: '#6b7280' },
  variant: { label: 'À vérifier', color: '#9b72cf' },
  done:    { label: 'Traité',            color: '#4f8ef7' },
  dup:     { label: 'Doublon API',       color: '#e05c5c' },
  absent:  { label: 'Absents',           color: '#d97757' },
  queued:  { label: 'En attente',        color: '#4f8ef7' },
};
const PAGE = 80;

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’‘`´]/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
const slug = s => norm(s).replace(/ /g, '_');
// Nom "souple" : ignore articles, pluriel, accord (e final), œ/oe, "1000Cols"/"1000 Cols".
// "Âme des ruines" ≈ "Âmes des Ruines", "Bottes de l'Héraut" ≈ "Bottes du Héraut".
const STOP = new Set(['de', 'des', 'du', 'la', 'le', 'les', 'l', 'd', 'un', 'une', 'et', 'en', 'au', 'aux', 'a']);
const looseTok = t => { t = t.length > 3 && /[sx]$/.test(t) ? t.slice(0, -1) : t; return t.length > 4 && t.endsWith('e') ? t.slice(0, -1) : t; };
const loose = s => norm(String(s || '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae').replace(/(\d)([a-zA-Z])/g, '$1 $2'))
  .replace(/'/g, ' ').split(' ').filter(t => t && !STOP.has(t)).map(looseTok).join(' ');
function lev(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}
const similarity = (a, b) => 1 - lev(a, b) / Math.max(a.length, b.length, 1);
const imgSrc = p => !p ? '' : /^https?:/.test(p) ? p : String(p).replace(/^(\.\.\/)+/, './');
const getPath = (o, path) => path.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const nrm = v => (typeof v === 'string' ? norm(v) : v); // accents/ponctuation/casse ignorés (lore surtout)

function fmt(v) {
  if (v === undefined || v === null || v === '') return '—';
  if (Array.isArray(v)) return v.join(', ') || '—';
  if (typeof v === 'object') return ('min' in v || 'max' in v) ? `${v.min}–${v.max}` : JSON.stringify(v);
  return String(v);
}
function same(api, wiki) {
  if (api === undefined) return true;           // l'API ne dit rien : pas une différence
  if (wiki === undefined || wiki === null) return false;
  if (typeof wiki === 'object' && !Array.isArray(wiki) && 'min' in wiki && typeof api === 'number') return api >= wiki.min && api <= wiki.max;
  if (Array.isArray(api) && Array.isArray(wiki)) return JSON.stringify([...api].sort()) === JSON.stringify([...wiki].sort());
  return JSON.stringify(nrm(api)) === JSON.stringify(nrm(wiki));
}
// Lore qui ne diffère que par l'orthographe (faute de frappe, accord, pluriel, œ/oe, accents) :
// même nombre de mots, et chaque mot différent est « le même mot » à quelques lettres près.
// Dans ce cas le wiki est la version corrigée : on le garde. Un mot vraiment différent laisse le choix.
const wordsOf = s => norm(String(s || '').replace(/œ/gi, 'oe').replace(/æ/gi, 'ae')).split(' ').filter(Boolean);
function sameWord(a, b) {
  if (a === b) return true;
  const L = Math.max(a.length, b.length);
  if (L <= 6) return ['s', 'e', 'es', 'x'].some(suf => a + suf === b || b + suf === a);   // pur/pure, de/des, certain/certaine
  if (L === 7) return lev(a, b) <= 1;
  return lev(a, b) <= 2 && similarity(a, b) >= 0.8;
}
// Sens de la correction : 'wiki' (faute côté API → on garde le wiki), 'api' (faute côté wiki → on prend l'API), sinon null.
// On ne tranche que pour une vraie faute : un mot RARE dans tout le corpus (≤ 2 occurrences) face à sa version COURANTE
// (≥ 5). Les variantes grammaticales (pur/pure, de/des, fait/faits…) dépendent du contexte : le choix reste à toi.
function loreOrthoDir(apiLore, wikiLore, freq) {
  const a = wordsOf(apiLore), w = wordsOf(wikiLore);
  if (!a.length || a.length !== w.length) return null;
  const dirs = new Set();
  for (let i = 0; i < a.length; i++) {
    if (a[i] === w[i]) continue;
    if (!sameWord(a[i], w[i])) return null;                       // vrai mot différent → choix
    const fa = freq.get(a[i]) || 0, fw = freq.get(w[i]) || 0;
    if (fa <= 2 && fw >= 5) dirs.add('wiki');
    else if (fw <= 2 && fa >= 5) dirs.add('api');
    else return null;                                              // ambigu → choix
  }
  return dirs.size === 1 ? [...dirs][0] : null;
}

// Lore identique au point final près : l'API a « …texte. » et le wiki « …texte ». On garde l'API pour le lore.
// (La comparaison générale ignore déjà la ponctuation : ce cas n'apparaît pas comme différence, mais on peut l'aligner.)
const trimEnd = t => String(t || '').replace(/\s+/g, ' ').trim();
const stripEnd = t => trimEnd(t).replace(/[.…!?\s]+$/u, '');
const loreOnlyEnding = (apiLore, wikiLore) => {
  const a = trimEnd(apiLore), w = trimEnd(wikiLore);
  return !!a && !!w && a !== w && stripEnd(a) === stripEnd(w) && /[.…!?]$/u.test(a) && !/[.…!?]$/u.test(w);
};
const labelOf = path => {
  const [g, k] = path.split('.');
  if (!k) return { rarity: 'Rareté', category: 'Catégorie', cat: 'Sous-type', lvl: 'Niveau', classes: 'Classes', lore: 'Lore', competence: 'Compétence' }[g] || g;
  return (g === 'threshold' ? 'Req. ' : '') + (STAT_LABEL[k] || k);
};

// champs comparables : fixes + stats.* + threshold.* (union des deux côtés)
function fieldPaths(a, w) {
  const out = ['rarity', 'category', 'cat', 'lvl', 'classes', 'lore', 'competence'];
  for (const g of ['stats', 'threshold']) {
    const keys = new Set([...Object.keys(a?.[g] || {}), ...Object.keys(w?.[g] || {})]);
    keys.forEach(k => out.push(`${g}.${k}`));
  }
  return out;
}

export function createApiItemsTool(ctx) {
  const { db, doc, setDoc, updateDoc, getDoc, writeBatch, serverTimestamp, cachedDocs, invalidateModCache, store, COL,
    writeAudit, toast, modal, getUser, mergeContributors, readContribs } = ctx;

  let snap = null;            // { generatedAt, count, items }
  let wiki = [];              // items publics + cachés
  let decided = {};           // { apiId: { action, at, by } }
  let entries = [];           // entrées enrichies
  let absents = [];           // items du wiki absents de l'API
  let wordFreq = new Map();   // mot -> occurrences dans tous les lores
  const ui = { status: 'new', cat: '', q: '', limit: PAGE, open: null, onlyFresh: false };
  let root = null;
  let loading = false;

  // ── Chargement ─────────────────────────────────────
  async function load(force = false) {
    root = document.getElementById('api-items-body');
    if (!root || loading) return;
    loading = true;
    root.innerHTML = '<div class="empty">Chargement…</div>';
    try {
      if (force) { invalidateModCache('items'); invalidateModCache(COL.itemsHidden); }
      const [s, pub, hid, dec] = await Promise.all([
        fetch(`./data/api-items.json?t=${Date.now()}`).then(r => { if (!r.ok) throw new Error('data/api-items.json introuvable (lance tools/sync_api_items.js)'); return r.json(); }),
        cachedDocs('items'),
        cachedDocs(COL.itemsHidden).catch(() => []),
        getDoc(doc(db, 'config', 'api_sync')).then(d => (d.exists() ? d.data().decided || {} : {})).catch(() => ({})),
      ]);
      snap = s; decided = dec;
      wiki = [...pub, ...hid.map(h => ({ ...h, _hidden: true }))];
      build();
      restoreQueue();
      render();
      const last = Number(safeLs('get', 'apiItemsLastCount') || 0);
      if (last && snap.count > last) toast(`🔌 ${snap.count - last} nouvel(s) item(s) dans l'API depuis ta dernière visite`, 'info', 6000);
      safeLs('set', 'apiItemsLastCount', String(snap.count));
    } catch (e) {
      console.error('[api-items]', e);
      root.innerHTML = `<div class="empty">Erreur : ${esc(e.message)}</div>`;
    } finally { loading = false; }
  }
  function safeLs(op, k, v) { try { return op === 'get' ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch { return null; } }

  // ── Rapprochement API ↔ wiki ───────────────────────
  function build() {
    const byApiId = new Map(), byName = new Map(), byLoose = new Map();
    const add = (m, k, w) => { if (!m.has(k)) m.set(k, []); m.get(k).push(w); };
    const named = [];
    for (const w of wiki) {
      if (w._import?.apiId != null) byApiId.set(String(w._import.apiId), w);
      if (!w.name) continue;
      add(byName, norm(w.name), w); add(byLoose, loose(w.name), w);
      named.push({ w, k: loose(w.name) });
    }
    // fréquence des mots dans tous les lores (wiki + API) : sert à repérer qui a la faute
    wordFreq = new Map();
    const addWords = t => wordsOf(t).forEach(x => wordFreq.set(x, (wordFreq.get(x) || 0) + 1));
    wiki.forEach(w => { addWords(w.lore); addWords(w.name); });
    snap.items.forEach(i => { addWords(i.api.lore); addWords(i.api.name); });
    const lastSeen = Number(safeLs('get', 'apiItemsLastSeenAt') || 0);
    // départage par classe quand plusieurs variantes (paliers / classes) portent le même nom
    const pick = (cands, cls) => {
      if (cands.length === 1) return cands[0];
      const byClass = cands.filter(w => !cls || !w.classes || cls.some(c => w.classes.includes(c)));
      return byClass.length === 1 ? byClass[0] : null;
    };
    entries = snap.items.map(it => {
      const e = { ...it, id: it.api.id, match: null, matchKind: null, cands: [], fresh: new Date(it.api.created_at).getTime() > lastSeen && lastSeen > 0 };
      const cls = it.wiki.classes;
      const linked = byApiId.get(String(it.api.id));
      if (linked) { e.match = linked; e.matchKind = 'link'; }
      else {
        const exact = byName.get(norm(it.api.name)) || [];
        const soft = byLoose.get(loose(it.api.name)) || [];
        const m1 = exact.length ? pick(exact, cls) : null;
        const m2 = !exact.length && soft.length ? pick(soft, cls) : null;
        if (m1) { e.match = m1; e.matchKind = 'exact'; }
        else if (m2) { e.match = m2; e.matchKind = 'loose'; }
        else if (exact.length || soft.length) e.cands = exact.length ? exact : soft;
        else {
          // noms proches (fautes de frappe, genre, mot différent) : proposés, jamais liés automatiquement
          const k = loose(it.api.name);
          // même nombres (« 150 Cols » ≠ « 100 Cols ») et même début de nom (« Faux » ≠ « Dague »)
          const nums = t => (t.match(/\d+/g) || []).join(','), first = t => t.split(' ')[0];
          e.cands = named.filter(n => nums(n.k) === nums(k) && similarity(first(k), first(n.k)) >= 0.75)
            .map(n => ({ w: n.w, r: similarity(k, n.k) })).filter(x => x.r >= 0.85).sort((a, b) => b.r - a.r).slice(0, 4).map(x => x.w);
          e.near = e.cands.length > 0;
        }
      }
      // lore : faute d'orthographe d'un côté ? ('wiki' = faute dans l'API → wiki gardé ; 'api' = faute dans le wiki → API prise)
      e.loreOrtho = e.match ? loreOrthoDir(it.wiki.lore, e.match.lore, wordFreq) : null;
      e.diffs = e.match ? fieldPaths(it.wiki, e.match).filter(p => !same(getPath(it.wiki, p), getPath(e.match, p)) && !(p === 'lore' && e.loreOrtho)) : [];
      e.loreFix = !!e.match && !e.match._hidden && (loreOnlyEnding(it.wiki.lore, e.match.lore) || e.loreOrtho === 'api');
      e.status = it.dupOf ? 'dup' : decided[it.api.id] ? 'done' : e.match ? (e.diffs.length ? 'diff' : 'same') : e.cands.length ? 'variant' : 'new';
      return e;
    });
    // Absents : items du wiki qu'aucun item de l'API ne rejoint (ni lien, ni nom, ni nom proche en « à vérifier »).
    // Les items qui ne sont qu'un candidat d'un item API à vérifier ne comptent pas comme absents (ils peuvent être le même).
    const used = new Set();
    for (const e of entries) {
      if (e.match) used.add(e.match._docKey || e.match.id);
      e.cands.forEach(w => used.add(w._docKey || w.id));
    }
    absents = wiki.filter(w => w.name && !used.has(w._docKey || w.id));
  }

  // ── Rendu liste ────────────────────────────────────
  function counts() {
    const c = { new: 0, diff: 0, same: 0, variant: 0, done: 0, dup: 0, absent: absents.length, queued: queue.size };
    entries.forEach(e => c[e.status]++);
    return c;
  }
  function filtered() {
    const q = norm(ui.q);
    if (ui.status === 'queued') return entries.filter(e => queue.has(e.id) && (!q || norm(e.api.name).includes(q)));
    if (ui.status === 'absent') {
      return absents.filter(w => (!ui.cat || w.category === ui.cat || (ui.cat === '_none' && !w.category)) && (!q || norm(w.name).includes(q)))
        .sort((a, b) => String(a.name).localeCompare(String(b.name), 'fr'));
    }
    return entries.filter(e => (ui.status === 'all' || e.status === ui.status)
      && (!ui.cat || e.wiki.category === ui.cat || (ui.cat === '_none' && !e.wiki.category))
      && (!ui.onlyFresh || e.fresh)
      && (!q || norm(e.api.name).includes(q)));
  }
  // Entrées dont le lore ne diffère que par le point final (et pas déjà traitées / en attente)
  function loreFixList() { return entries.filter(e => e.loreFix && !queue.has(e.id) && !decided[e.id] && !e.dupOf); }
  function queueLoreFixes() {
    const list = loreFixList();
    for (const e of list) {
      const m = e.match;
      queue.set(e.id, { kind: 'apply', docKey: m._docKey || m.id, fields: ['lore'], name: m.name,
        payload: { lore: e.wiki.lore, _import: { ...(m._import || {}), ...importMeta(e) }, _contributor: mergeContributors(readContribs(m), contrib()) } });
    }
    persistQueue(); render();
    toast(list.length ? `${list.length} lores alignés sur l'API mis en attente — « Valider tout » pour écrire` : 'Rien à aligner', list.length ? 'success' : 'info', 4000);
  }
  function readyEntries() { return entries.filter(e => e.status === 'new' && !e.flags.length); }

  function render() {
    if (!root || !snap) return;
    const c = counts();
    const list = filtered();
    const cats = [...new Set(entries.map(e => e.wiki.category).filter(Boolean))].sort();
    const age = Math.round((Date.now() - new Date(snap.generatedAt)) / 3600000);
    const fresh = entries.filter(e => e.fresh).length;
    root.innerHTML = `
      <div class="api-meta">Snapshot API : <b>${snap.count}</b> items · généré il y a ${age < 1 ? '< 1' : age} h (${esc(new Date(snap.generatedAt).toLocaleString('fr-FR'))})
        ${age > 48 ? '<span style="color:var(--warn);">⚠️ ancien — relance <code>node repo/tools/sync_api_items.js</code></span>' : ''}
        · <a href="#" data-act="reload">↻ Recharger</a>
        · <a href="#" data-act="seen">${fresh ? `${fresh} récents — ` : ''}marquer tout comme vu</a></div>
      <div class="api-chips">
        ${(queue.size ? ['queued'] : []).concat(['new', 'diff', 'variant', 'same', 'done', 'dup', 'absent']).map(s =>`<button class="api-chip${ui.status === s ? ' on' : ''}" data-act="status" data-v="${s}" style="--c:${STATUS_INFO[s].color}">${STATUS_INFO[s].label} <b>${c[s]}</b></button>`).join('')}
        <button class="api-chip${ui.status === 'all' ? ' on' : ''}" data-act="status" data-v="all" style="--c:#aaa">Tous <b>${entries.length}</b></button>
      </div>
      <div class="api-bar">
        <input type="search" id="api-q" placeholder="🔍 Nom…" value="${esc(ui.q)}">
        <select id="api-cat"><option value="">Toutes catégories</option>${cats.map(k => `<option value="${k}"${ui.cat === k ? ' selected' : ''}>${CATEGORY_LABEL[k] || k}</option>`).join('')}<option value="_none"${ui.cat === '_none' ? ' selected' : ''}>(à choisir)</option></select>
        <label style="font-size:12px;color:var(--muted);display:flex;gap:4px;align-items:center;"><input type="checkbox" id="api-fresh"${ui.onlyFresh ? ' checked' : ''}> récents seulement</label>
        <span style="flex:1"></span>
        ${loreFixList().length ? `<button class="btn btn-ghost" data-act="lorefix" style="font-size:12px;" title="Lore identique au point final près, ou faute d'orthographe dans le wiki : on prend le lore de l'API">✏️ Lore de l'API pour ${loreFixList().length} (point final / faute du wiki)</button>` : ''}
        <button class="btn" data-act="bulk" style="background:var(--accent);color:#fff;font-size:12px;"${readyEntries().filter(e => !queue.has(e.id)).length ? '' : ' disabled'} title="Les met en attente, rien n'est écrit avant « Valider tout »">⏳ Mettre les ${readyEntries().filter(e => !queue.has(e.id)).length} prêts en attente</button>
      </div>
      ${ui.status === 'absent' ? '<p style="font-size:12px;color:var(--muted);margin:0 0 10px;">Items présents sur le wiki mais introuvables dans l\'API (supprimés, renommés côté jeu, ou créés uniquement sur le wiki).</p>' : ''}
      <div class="api-list">${list.slice(0, ui.limit).map(ui.status === 'absent' ? absentRowHtml : rowHtml).join('') || '<div class="empty">Aucun item.</div>'}</div>
      ${list.length > ui.limit ? `<div style="text-align:center;margin:12px;"><button class="btn btn-ghost" data-act="more">Afficher plus (${list.length - ui.limit} restants)</button></div>` : ''}
      ${queue.size ? queueBarHtml() : ''}`;
  }

  function queueBarHtml() {
    const n = k => [...queue.values()].filter(d => d.kind === k).length;
    const parts = ['import', 'apply', 'link', 'keep'].filter(k => n(k)).map(k => `${n(k)} ${KIND_LABEL[k].toLowerCase()}`).join(' · ');
    return `<div class="api-queue"><span>⏳ <b>${queue.size}</b> décision${queue.size > 1 ? 's' : ''} en attente <span style="color:var(--muted)">(${parts})</span></span>
      <span style="flex:1"></span>
      <button class="btn btn-ghost" data-act="showq" style="font-size:12px;">👁 Voir</button>
      <button class="btn btn-ghost" data-act="clearq" style="font-size:12px;color:var(--danger)">🗑 Vider</button>
      <button class="btn" data-act="commit" style="background:#3ecf8e;color:#000;font-weight:700;font-size:13px;">✅ Valider tout (${queue.size})</button>
    </div>`;
  }

  function rowHtml(e) {
    const st = STATUS_INFO[e.status];
    const w = e.wiki, open = ui.open === e.id;
    return `<div class="api-row${open ? ' open' : ''}" id="api-row-${e.id}">
      <div class="api-head" data-act="toggle" data-id="${e.id}">
        <img class="api-ico" loading="lazy" src="${esc(e.image || '')}" onerror="this.style.visibility='hidden'">
        <div style="min-width:0;flex:1">
          <div class="api-name">${esc(e.api.name)} ${e.fresh ? '<span class="api-new">NEW</span>' : ''}</div>
          <div class="api-sub"><span style="color:${RARITY_COLOR[w.rarity] || '#aaa'}">●</span> ${esc(RARITY_LABEL[w.rarity] || w.rarity || '?')} · ${esc(CATEGORY_LABEL[w.category] || w.category || api(e).apiCategory)} · niv. ${e.api.level ?? '—'}${e.match ? ` · wiki: <code>${esc(e.match._docKey || e.match.id)}</code>${e.matchKind === 'loose' ? ` <span title="nom proche : ${esc(e.match.name)}" style="color:#9b72cf">≈ ${esc(e.match.name)}</span>` : ''}` : ''}${e.diffs.length ? ` · <b>${e.diffs.length} diff.</b>` : ''}</div>
        </div>
        ${queue.has(e.id) ? `<span class="api-st api-qchip" data-act="unqueue" data-id="${e.id}" title="Retirer de la file" style="--c:${STATUS_INFO.queued.color}">⏳ ${KIND_LABEL[queue.get(e.id).kind]} ✕</span>` : ''}
        <span class="api-st" style="--c:${st.color}">${st.label}</span>
      </div>
      ${open ? detailHtml(e) : ''}
    </div>`;
  }
  const api = e => e.wiki._import || {};

  function absentRowHtml(w) {
    const key = w._docKey || w.id, img = imgSrc(w.images?.[0] || w.image);
    return `<div class="api-row"><div class="api-head" style="cursor:default">
      <img class="api-ico" loading="lazy" src="${esc(img)}" onerror="this.style.visibility='hidden'">
      <div style="min-width:0;flex:1">
        <div class="api-name">${esc(w.name)}${w._hidden ? ' 🔒' : ''}</div>
        <div class="api-sub"><span style="color:${RARITY_COLOR[w.rarity] || '#aaa'}">●</span> ${esc(RARITY_LABEL[w.rarity] || w.rarity || '?')} · ${esc(CATEGORY_LABEL[w.category] || w.category || '?')}${w.palier ? ` · P${w.palier}` : ''}${w.lvl ? ` · niv. ${w.lvl}` : ''} · <a href="./Compendium/compendium.html#${esc(key)}" target="_blank" rel="noopener"><code>${esc(key)}</code></a></div>
      </div>
      <span class="api-st" style="--c:${STATUS_INFO.absent.color}">${STATUS_INFO.absent.label}</span>
    </div></div>`;
  }

  // ── Détail : deux colonnes + choix ─────────────────
  function sideHtml(title, item, other, e, isApi) {
    const paths = fieldPaths(e.wiki, e.match || {}).filter(p => getPath(item, p) !== undefined || getPath(other, p) !== undefined);
    const rows = paths.map(p => {
      const v = getPath(item, p), o = getPath(other, p);
      const diff = !(isApi ? same(v, o) : same(o, v)) && getPath(e.wiki, p) !== undefined;
      return `<tr class="${diff ? 'df' : ''}"><td>${esc(labelOf(p))}</td><td>${esc(fmt(v))}</td></tr>`;
    }).join('');
    const img = isApi ? e.image : imgSrc(item?.images?.[0] || item?.image);
    return `<div class="api-col"><h4>${title}</h4>
      ${img ? `<img class="api-big" src="${esc(img)}" onerror="this.style.visibility='hidden'">` : '<div class="api-big none">pas d\'image</div>'}
      <table class="api-tbl">${rows || '<tr><td colspan="2">—</td></tr>'}</table></div>`;
  }

  function detailHtml(e) {
    const a = e.wiki;                         // version convertie de l'API
    const raw = e.api;
    const idents = Object.entries(raw.identifications || {}).map(([k, v]) => `${esc(k)}: ${esc(v)}`).join('<br>');
    const flags = e.flags.length && !e.match ? `<div class="api-flags">⚠️ ${e.flags.map(esc).join(' · ')}</div>` : '';
    const dec = decided[e.id] ? `<div class="api-flags" style="border-color:#4f8ef7;color:#4f8ef7">Traité (${esc(decided[e.id].action)}) par ${esc(decided[e.id].by || '?')} le ${esc(new Date(decided[e.id].at).toLocaleDateString('fr-FR'))} — <a href="#" data-act="undecide" data-id="${e.id}">annuler</a></div>` : '';
    const rawBlock = `<details class="api-raw"><summary>Données brutes API</summary>
      <div>id API <b>${raw.id}</b> · mmo <code>${esc(raw.mmo_key)}</code> · ${esc(raw.category)} · rareté ${esc(raw.rarity)}${e.imageSource ? ` · image: ${e.imageSource === 'pack' ? 'resource pack' : 'API'}` : ''}</div>
      <div style="margin-top:6px;">${idents || '—'}</div><div style="margin-top:6px;color:var(--muted)">${esc(raw.lore || '')}</div></details>`;

    // ─ Nouveau / variante : formulaire d'import
    if (!e.match) {
      const cands = e.cands.length ? `<div class="api-flags" style="border-color:#9b72cf;color:#9b72cf">${e.near ? 'Noms proches sur le wiki (à vérifier — peut être le même item avec une faute ou un autre accord)' : 'Même nom sur le wiki'} : ${e.cands.map(w => `<b>${esc(w.name)}</b> <code>${esc(w._docKey || w.id)}</code> (P${w.palier ?? '?'}${w.classes ? ' ' + w.classes.join('/') : ''})`).join(', ')}.
        Si c'est le même item, <b>lie-le</b> ; sinon importe-le comme item distinct.
        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${e.cands.filter(w => !w._hidden).map(w => `<button class="btn btn-ghost" style="font-size:11px" data-act="link" data-id="${e.id}" data-to="${esc(w._docKey || w.id)}">🔗 Lier à ${esc(w._docKey || w.id)}</button>`).join('')}</div></div>` : '';
      const catSel = Object.keys(CATEGORY_LABEL);
      return `<div class="api-detail">${flags}${cands}${dec}
        <div class="api-cols">${sideHtml('API', a, {}, e, true)}
          <div class="api-col"><h4>Importer sur le wiki</h4>
            <div class="api-form" data-id="${e.id}">
              <label>Catégorie<select data-f="category"><option value="">— choisir —</option>${catSel.map(k => `<option value="${k}"${a.category === k ? ' selected' : ''}>${CATEGORY_LABEL[k]}</option>`).join('')}</select></label>
              <label>Sous-type<select data-f="cat"><option value="">—</option>${[...new Set(Object.values(CAT_OPTIONS).flat())].map(k => `<option value="${k}"${a.cat === k ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
              <label>Rareté<select data-f="rarity">${Object.keys(RARITY_LABEL).map(k => `<option value="${k}"${a.rarity === k ? ' selected' : ''}>${RARITY_LABEL[k]}</option>`).join('')}</select></label>
              <label>Palier<select data-f="palier"><option value="">— choisir —</option>${[1, 2, 3].map(p => `<option value="${p}"${a.palier === p ? ' selected' : ''}>Palier ${p}</option>`).join('')}</select></label>
              <label>ID wiki<input data-f="id" value="${esc(a.id)}"></label>
              <button class="btn" data-act="import" data-id="${e.id}" style="background:var(--accent);color:#fff;">⬇️ Importer cet item</button>
            </div>
          </div></div>${rawBlock}</div>`;
    }

    // ─ Existant : choix champ par champ
    const m = e.match, hidden = !!m._hidden;
    const rows = fieldPaths(a, m).filter(p => getPath(a, p) !== undefined || getPath(m, p) !== undefined).map(p => {
      const av = getPath(a, p), wv = getPath(m, p);
      const diff = !same(av, wv);
      const loreFix = p === 'lore' && e.loreFix;   // point final seul, ou faute dans le wiki : on prend l'API par défaut
      const orthoWiki = p === 'lore' && e.loreOrtho === 'wiki';   // faute dans l'API : wiki gardé par défaut
      const def = wv === undefined || wv === null || loreFix ? 'api' : 'wiki';
      const note = loreFix ? (e.loreOrtho === 'api' ? 'faute dans le wiki : API' : 'point final : API')
        : orthoWiki ? 'faute dans l\'API : wiki gardé' : '';
      return `<tr class="${diff || loreFix || orthoWiki ? 'df' : ''}"><td>${esc(labelOf(p))}${note ? ` <span title="${esc(note)}" style="color:#9b72cf">(${esc(note)})</span>` : ''}</td>
        <td>${esc(fmt(av))}</td><td>${esc(fmt(wv))}</td>
        <td class="ch">${(diff || loreFix) && av !== undefined && !hidden ? `<label><input type="radio" name="pick-${e.id}-${p}" data-p="${p}" value="api"${def === 'api' ? ' checked' : ''}>API</label> <label><input type="radio" name="pick-${e.id}-${p}" data-p="${p}" value="wiki"${def === 'wiki' ? ' checked' : ''}>Wiki</label>` : ''}</td></tr>`;
    }).join('');
    const wImg = imgSrc(m.images?.[0] || m.image);
    const imgChoice = e.image && (!wImg || wImg !== e.image) && !hidden
      ? `<label class="api-imgpick"><input type="checkbox" id="api-useimg-${e.id}"${wImg ? '' : ' checked'}> Utiliser l'image de l'API <img src="${esc(e.image)}" style="height:28px;vertical-align:middle"></label>` : '';
    return `<div class="api-detail">${flags}${dec}
      ${hidden ? '<div class="api-flags">🔒 Item sensible (items_hidden) — lecture seule ici.</div>' : ''}
      <div class="api-cols2">
        <div class="api-imgs"><div><div class="api-cap">API</div>${e.image ? `<img class="api-big" src="${esc(e.image)}">` : '<div class="api-big none">—</div>'}</div>
          <div><div class="api-cap">Wiki</div>${wImg ? `<img class="api-big" src="${esc(wImg)}" onerror="this.style.visibility='hidden'">` : '<div class="api-big none">—</div>'}</div></div>
        <table class="api-tbl wide"><thead><tr><th>Champ</th><th>API</th><th>Wiki</th><th>Choix</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
      ${imgChoice}
      <div class="api-actions">
        <button class="btn" data-act="apply" data-id="${e.id}" style="background:var(--accent);color:#fff;"${hidden ? ' disabled' : ''}>✅ Appliquer mes choix au wiki</button>
        <button class="btn btn-ghost" data-act="allapi" data-id="${e.id}"${hidden ? ' disabled' : ''}>Tout prendre depuis l'API</button>
        <button class="btn btn-ghost" data-act="keep" data-id="${e.id}">Garder le wiki (marquer traité)</button>
      </div>${rawBlock}</div>`;
  }

  // ── Décisions en attente (panier) ──────────────────
  // Rien n'est écrit au clic : chaque choix (importer, corriger, garder, lier) est mis en attente,
  // puis « Valider tout » écrit l'ensemble en une fois (par lots) et recharge une seule fois.
  const queue = new Map();            // apiId -> décision
  const QUEUE_KEY = 'apiItemsQueue';
  const KIND_LABEL = { import: 'Importer', apply: 'Corriger', keep: 'Garder le wiki', link: 'Lier' };

  const persistQueue = () => safeLs('set', QUEUE_KEY, JSON.stringify([...queue.entries()]));
  function restoreQueue() {
    queue.clear();
    try {
      for (const [k, d] of JSON.parse(safeLs('get', QUEUE_KEY) || '[]')) {
        const id = Number(k);
        if (!decided[id] && entries.some(e => e.id === id)) queue.set(id, d);   // déjà traité entre-temps : on abandonne
      }
    } catch { /* file corrompue : on repart de zéro */ }
    persistQueue();
  }

  const contrib = () => { const u = getUser(); return { uid: u.uid || null, name: u.name || 'API sync' }; };
  const importMeta = e => ({ apiId: e.api.id, mmoKey: e.api.mmo_key || null, syncedAt: new Date().toISOString() });
  const bump = () => setDoc(doc(db, 'config', 'wiki_version'), { lastUpdated: serverTimestamp(), collection: 'items' }, { merge: true }).catch(() => {});
  const refreshAfterWrite = async () => { invalidateModCache('items'); store.invalidate('items'); await load(); };

  function tagsFor(d) {
    return [RARITY_LABEL[d.rarity], CATEGORY_LABEL[d.category], d.palier ? `Palier ${d.palier}` : null, d.event ? 'Event' : null].filter(Boolean);
  }
  function payloadFor(e, over = {}) {
    const d = { ...e.wiki, ...over };
    delete d._flags;
    d.palier = d.palier ? Number(d.palier) : null;
    d.tags = tagsFor(d);
    d._import = { ...(e.wiki._import || {}), ...importMeta(e) };
    Object.keys(d).forEach(k => { if (d[k] === null || d[k] === '' || d[k] === undefined) delete d[k]; });
    d._order = Date.now();
    d._contributor = mergeContributors([], contrib());
    return d;
  }
  const idTaken = (id, exceptApiId) => wiki.some(w => (w._docKey || w.id) === id)
    || [...queue.entries()].some(([k, d]) => d.kind === 'import' && d.docId === id && k !== exceptApiId);

  function enqueue(id, d, msg) {
    queue.set(id, d);
    persistQueue();
    ui.open = null;
    render();
    toast(`${msg || KIND_LABEL[d.kind]} · ${queue.size} en attente`, 'info', 1800);
  }
  function unqueue(id) { queue.delete(id); persistQueue(); render(); }

  function importOne(id) {
    const e = entries.find(x => x.id === id);
    const form = root.querySelector(`.api-form[data-id="${id}"]`);
    const v = f => form.querySelector(`[data-f="${f}"]`).value.trim();
    if (!v('category')) return toast('Choisis une catégorie', 'warning');
    if (!v('palier')) return toast('Choisis un palier', 'warning');
    const over = { category: v('category'), rarity: v('rarity'), palier: Number(v('palier')), id: slug(v('id')) };
    if (v('cat')) over.cat = v('cat'); else delete e.wiki.cat;
    if (!over.id) return toast('ID invalide', 'warning');
    if (idTaken(over.id, id)) return toast(`L'ID "${over.id}" existe déjà (wiki ou file d'attente)`, 'error');
    enqueue(id, { kind: 'import', docId: over.id, payload: payloadFor(e, over), name: e.api.name });
  }

  function bulkImport() {
    const ready = readyEntries().filter(e => e.wiki.category && e.wiki.palier && !queue.has(e.id));
    let n = 0;
    for (const e of ready) {
      if (idTaken(e.wiki.id, e.id)) continue;
      queue.set(e.id, { kind: 'import', docId: e.wiki.id, payload: payloadFor(e), name: e.api.name });
      n++;
    }
    persistQueue(); render();
    toast(n ? `${n} imports mis en attente (${ready.length - n} ignoré(s) : ID déjà pris) — vérifie puis « Valider tout »` : 'Rien à mettre en attente', n ? 'success' : 'info', 4000);
  }

  function applyChoices(id, all = false) {
    const e = entries.find(x => x.id === id);
    const m = e.match;
    const payload = {};
    if (all) {
      e.diffs.forEach(p => { if (getPath(e.wiki, p) !== undefined) payload[p] = getPath(e.wiki, p); });
      if (e.loreFix && e.wiki.lore) payload.lore = e.wiki.lore;   // point final / faute du wiki
    }
    else root.querySelectorAll(`#api-row-${id} input[type=radio][value=api]:checked`).forEach(r => { payload[r.dataset.p] = getPath(e.wiki, r.dataset.p); });
    if (all || document.getElementById(`api-useimg-${id}`)?.checked) {
      if (e.image) payload.images = [`../${e.image}`];
    }
    if (!Object.keys(payload).length) return toast('Aucun champ à modifier', 'info');
    const fields = Object.keys(payload);
    const merged = { ...m, ...payload };
    if ('rarity' in payload || 'category' in payload) payload.tags = tagsFor(merged);
    payload._import = { ...(m._import || {}), ...importMeta(e) };
    payload._contributor = mergeContributors(readContribs(m), contrib());
    enqueue(id, { kind: 'apply', docKey: m._docKey || m.id, payload, fields, name: m.name });
  }

  function link(id, to) {
    const e = entries.find(x => x.id === id);
    const target = wiki.find(w => (w._docKey || w.id) === to);
    if (!target) return;
    enqueue(id, { kind: 'link', docKey: to, payload: { _import: { ...(target._import || {}), ...importMeta(e) } }, name: target.name }, `Lier à ${to}`);
  }

  async function commitQueue() {
    if (!queue.size) return;
    const items = [...queue.entries()];
    const by = k => items.filter(([, d]) => d.kind === k).length;
    const ok = await modal.confirm(`Valider ${items.length} décision(s) ?`,
      `${by('import')} import(s), ${by('apply')} correction(s), ${by('link')} lien(s), ${by('keep')} « garder le wiki ». Tout est écrit maintenant, en une fois.`);
    if (!ok) return;
    const btn = root.querySelector('[data-act="commit"]');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Écriture…'; }
    const done = [];                       // apiIds réellement écrits
    try {
      const writes = items.filter(([, d]) => d.kind !== 'keep');
      for (let i = 0; i < writes.length; i += 400) {
        const chunk = writes.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const [, d] of chunk) {
          const ref = doc(db, 'items', d.kind === 'import' ? d.docId : d.docKey);
          if (d.kind === 'import') batch.set(ref, d.payload); else batch.update(ref, d.payload);
        }
        await batch.commit();
        chunk.forEach(([k]) => done.push(k));
      }
      items.filter(([, d]) => d.kind === 'keep').forEach(([k]) => done.push(k));
      const dec = {};
      for (const [k, d] of items) dec[k] = { action: { import: 'imported', apply: 'applied', link: 'linked', keep: 'kept-wiki' }[d.kind], at: Date.now(), by: getUser().name || '?' };
      Object.assign(decided, dec);
      await setDoc(doc(db, 'config', 'api_sync'), { decided: dec }, { merge: true });
      const names = k => items.filter(([, d]) => d.kind === k).map(([, d]) => d.name).slice(0, 25);
      if (by('import')) await writeAudit('create', 'item', '', `${by('import')} items`, { source: 'api-sync-batch', names: names('import') });
      if (by('apply')) await writeAudit('update', 'item', '', `${by('apply')} items`, { source: 'api-sync-batch', names: names('apply') });
      if (by('link')) await writeAudit('update', 'item', '', `${by('link')} liens API`, { source: 'api-sync-batch', names: names('link') });
      bump();
      queue.clear(); persistQueue();
      toast(`✅ ${items.length} décisions validées`, 'success');
      await refreshAfterWrite();
    } catch (err) {
      done.forEach(k => queue.delete(k)); persistQueue();      // ce qui est déjà écrit ne reste pas en attente
      toast(`Erreur : ${err.message} — ${done.length} écrit(s), ${queue.size} restent en attente`, 'error', 8000);
      render();
    }
  }

  async function markDecided(id, action) {
    decided[id] = { action, at: Date.now(), by: getUser().name || '?' };
    await setDoc(doc(db, 'config', 'api_sync'), { decided: { [id]: decided[id] } }, { merge: true });
  }

  // ── Événements ─────────────────────────────────────
  function bind(panel) {
    if (panel._apiBound) return;
    panel._apiBound = true;
    panel.addEventListener('click', async ev => {
      const t = ev.target.closest('[data-act]');
      if (!t) return;
      const act = t.dataset.act, id = Number(t.dataset.id);
      if (['reload', 'seen', 'undecide'].includes(act)) ev.preventDefault();
      if (act === 'status') { ui.status = t.dataset.v; ui.limit = PAGE; ui.open = null; render(); }
      else if (act === 'toggle') { ui.open = ui.open === id ? null : id; render(); document.getElementById(`api-row-${id}`)?.scrollIntoView({ block: 'nearest' }); }
      else if (act === 'more') { ui.limit += PAGE; render(); }
      else if (act === 'reload') load(true);
      else if (act === 'seen') { safeLs('set', 'apiItemsLastSeenAt', String(Date.now())); build(); render(); toast('Marqué comme vu', 'success'); }
      else if (act === 'import') importOne(id);
      else if (act === 'bulk') bulkImport();
      else if (act === 'lorefix') queueLoreFixes();
      else if (act === 'apply') applyChoices(id);
      else if (act === 'allapi') applyChoices(id, true);
      else if (act === 'link') link(id, t.dataset.to);
      else if (act === 'keep') { const e = entries.find(x => x.id === id); enqueue(id, { kind: 'keep', name: e.match?.name || e.api.name }); }
      else if (act === 'unqueue') { ev.stopPropagation(); unqueue(id); }
      else if (act === 'commit') commitQueue();
      else if (act === 'showq') { ui.status = 'queued'; ui.limit = PAGE; ui.open = null; render(); }
      else if (act === 'clearq') {
        if (await modal.confirm('Vider la file d\'attente ?', `Les ${queue.size} décisions en attente sont abandonnées (rien n'a été écrit).`)) { queue.clear(); persistQueue(); if (ui.status === 'queued') ui.status = 'new'; render(); }
      } else if (act === 'undecide') {
        try { delete decided[id]; await updateDoc(doc(db, 'config', 'api_sync'), { [`decided.${id}`]: ctx.deleteField() }); build(); render(); } catch (err) { toast('Erreur : ' + err.message, 'error'); }
      }
    });
    panel.addEventListener('input', ev => { if (ev.target.id === 'api-q') { ui.q = ev.target.value; ui.limit = PAGE; const pos = ev.target.selectionStart; render(); const i = document.getElementById('api-q'); i.focus(); i.setSelectionRange(pos, pos); } });
    panel.addEventListener('change', ev => {
      if (ev.target.id === 'api-cat') { ui.cat = ev.target.value; ui.limit = PAGE; render(); }
      else if (ev.target.id === 'api-fresh') { ui.onlyFresh = ev.target.checked; render(); }
    });
  }

  injectCss();
  return {
    async show() { const p = document.getElementById('api-items-panel'); if (p) bind(p); await load(); },
  };
}

function injectCss() {
  if (document.getElementById('api-items-css')) return;
  const s = document.createElement('style');
  s.id = 'api-items-css';
  s.textContent = `
  #api-items-panel .api-meta{font-size:12px;color:var(--muted);margin-bottom:10px}
  #api-items-panel .api-meta a{color:var(--accent)}
  #api-items-panel .api-chips{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
  #api-items-panel .api-chip{background:var(--surface2);border:1px solid var(--border);border-radius:99px;color:var(--text);padding:4px 12px;font-size:12px;cursor:pointer}
  #api-items-panel .api-chip b{color:var(--c);margin-left:4px}
  #api-items-panel .api-chip.on{border-color:var(--c);box-shadow:0 0 0 1px var(--c) inset}
  #api-items-panel .api-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px}
  #api-items-panel .api-bar input[type=search],#api-items-panel .api-bar select{background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 9px;font-size:12px;outline:none}
  #api-items-panel .api-bar input[type=search]{min-width:200px}
  #api-items-panel .api-row{background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:6px}
  #api-items-panel .api-row.open{border-color:var(--accent)}
  #api-items-panel .api-head{display:flex;gap:10px;align-items:center;padding:8px 12px;cursor:pointer}
  #api-items-panel .api-ico{width:34px;height:34px;object-fit:contain;image-rendering:pixelated;flex-shrink:0}
  #api-items-panel .api-name{font-size:13px;font-weight:600}
  #api-items-panel .api-sub{font-size:11px;color:var(--muted)}
  #api-items-panel .api-new{background:#3ecf8e;color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:99px;margin-left:4px}
  #api-items-panel .api-st{font-size:11px;font-weight:600;color:var(--c);border:1px solid var(--c);border-radius:99px;padding:2px 9px;white-space:nowrap}
  #api-items-panel .api-detail{border-top:1px solid var(--border);padding:12px}
  #api-items-panel .api-cols{display:grid;grid-template-columns:1fr 1fr;gap:14px}
  #api-items-panel .api-cols2{display:flex;gap:14px;align-items:flex-start;flex-wrap:wrap}
  #api-items-panel .api-imgs{display:flex;gap:10px}
  #api-items-panel .api-cap{font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:3px}
  #api-items-panel .api-big{width:72px;height:72px;object-fit:contain;image-rendering:pixelated;background:var(--surface);border:1px solid var(--border);border-radius:6px}
  #api-items-panel .api-big.none{display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted)}
  #api-items-panel .api-col h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;color:var(--muted)}
  #api-items-panel .api-tbl{border-collapse:collapse;font-size:12px;margin-top:8px}
  #api-items-panel .api-tbl.wide{flex:1;min-width:420px;margin-top:0}
  #api-items-panel .api-tbl th{text-align:left;font-size:10px;color:var(--muted);text-transform:uppercase;padding:3px 8px}
  #api-items-panel .api-tbl td{padding:3px 8px;border-top:1px solid var(--border);vertical-align:top;max-width:340px;overflow-wrap:anywhere}
  #api-items-panel .api-tbl tr.df td{background:rgba(245,166,35,.10)}
  #api-items-panel .api-tbl td.ch label{margin-right:8px;font-size:11px;white-space:nowrap}
  #api-items-panel .api-form{display:grid;gap:8px}
  #api-items-panel .api-form label{display:grid;gap:3px;font-size:11px;color:var(--muted)}
  #api-items-panel .api-form select,#api-items-panel .api-form input{background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none}
  #api-items-panel .api-flags{border:1px solid var(--warn);color:var(--warn);border-radius:6px;padding:6px 10px;font-size:12px;margin-bottom:10px}
  #api-items-panel .api-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
  #api-items-panel .api-imgpick{display:block;margin-top:10px;font-size:12px}
  #api-items-panel .api-queue{position:sticky;bottom:8px;z-index:5;display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:14px;padding:10px 14px;background:var(--surface);border:1px solid #4f8ef7;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.45);font-size:13px}
  #api-items-panel .api-qchip{cursor:pointer;margin-right:6px}
  #api-items-panel .api-row .api-head{flex-wrap:wrap}
  #api-items-panel .api-raw{margin-top:12px;font-size:11px;color:var(--muted)}
  @media (max-width:800px){#api-items-panel .api-cols{grid-template-columns:1fr}}`;
  document.head.appendChild(s);
}
