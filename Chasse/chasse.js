// ══════════════════════════════════════════════════════
// CHASSE AU CLAIR DE LUNE — ce qui manque aux joueurs
// Trois sortes d'avis, stockés dans config/tableau_de_chasse :
//   🌓 fields  → { items:[id…], mobs:[…], … }   fiche existante, champs requis vides (calculés, comme l'ancien tableau de chasse)
//   🌑 create  → avis[] { kind:'create', mode, name }   nom connu, fiche inexistante (se ferme seule quand la fiche apparaît)
//   🌘 update  → avis[] { kind:'update', mode, id, name, note }   fiche complète mais à raviver (fermée à la main)
// ══════════════════════════════════════════════════════
import { store } from '../store.js';
import { db, getCurrentUser, hasRole, doc, getDoc, setDoc, logPageView, logReport, collection, getDocs, query, where } from '../firebase.js';

const WORKER = 'https://veilleurs.veilleurs-wiki.workers.dev';
const SENT_KEY = 'vcl_chasse_sent'; // infos déjà envoyées par ce navigateur (visiteurs sans compte)

const MODES = [
  { key: 'items',     cre: 'item',     label: 'Items',     icon: '⚔️', disc: 'category' },
  { key: 'mobs',      cre: 'mob',      label: 'Mobs',      icon: '👾', disc: 'type' },
  { key: 'pnj',       cre: 'pnj',      label: 'PNJ',       icon: '🧑', disc: null },
  { key: 'regions',   cre: 'region',   label: 'Régions',   icon: '📍', disc: null },
  { key: 'quetes',    cre: 'quest',    label: 'Quêtes',    icon: '📜', disc: 'type' },
  { key: 'panoplies', cre: 'panoplie', label: 'Panoplies', icon: '🔗', disc: null },
];
const MODE = Object.fromEntries(MODES.map(m => [m.key, m]));

const KINDS = {
  create: { moon: '🌑', label: 'Fiche à créer',     short: 'Fiches à créer',     sub: 'Nom connu, fiche absente', cta: 'Créer la fiche →' },
  fields: { moon: '🌓', label: 'Champs manquants',  short: 'Champs manquants',   sub: 'Fiche à compléter',        cta: 'Compléter →' },
  update: { moon: '🌘', label: 'À raviver',         short: 'À raviver',          sub: 'Données à mettre à jour',  cta: 'Mettre à jour →' },
};

const FIELD_LABELS = {
  name: 'Nom', titre: 'Titre', label: 'Nom', lore: 'Lore', desc: 'Description', images: 'Image', img: 'Image', image: 'Image',
  rarity: 'Rareté', category: 'Catégorie', palier: 'Palier', lvl: 'Niveau requis', obtain: "Obtention", stats: 'Stats',
  effects: 'Effets', craft: 'Craft', craft_cd: 'Délai de craft', classes: 'Classes', event: 'Évènement', type: 'Type',
  region: 'Région', zone: 'Zone', coords: 'Coordonnées', difficulty: 'Difficulté', color: 'Couleur', npc: 'PNJ donneur',
  objectifs: 'Objectifs', recompenses: 'Récompenses', rune_slots: 'Emplacements de rune', ordre: 'Ordre',
};

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const $ = id => document.getElementById(id);

const state = { kind: '', mode: '', q: '', palier: '', sort: 'prio', avis: [], lit: 0, admin: false, tdc: {}, docs: {}, user: null, pending: [], sent: new Set() };

// Clé d'un avis pour le suivi des « infos envoyées » : la fiche (id) ou, pour une fiche à créer, son nom
const infoKey = a => `${a.mode}:${a.kind === 'create' ? norm(a.name) : (a.id || norm(a.name))}`;
const sentKeyOf = c => `${c.mode}:${c.kind === 'create' ? norm(c.name) : (c.id || norm(c.name))}`;

// ── Détection des champs vides (miroir de creator.js:_chasseFieldEmpty) ──
function fieldEmpty(d, f) {
  if (f === 'coords') return !d.coords || d.coords.x == null;
  if (f === 'img' || f === 'images' || f === 'image') {
    const ok = v => v != null && v !== '';
    return !(ok(d.img) || ok(d.image) || (Array.isArray(d.images) && d.images.some(ok)));
  }
  const v = d[f];
  return v == null || v === '' || (Array.isArray(v) && v.length === 0);
}

const normField = f => (f === 'img' || f === 'image') ? 'images' : f;

function missingFor(mode, d, std) {
  const disc = MODE[mode].disc;
  const missing = (std.required || []).filter(f => fieldEmpty(d, f));
  const dv = disc ? (d[disc] || null) : null;
  if (disc && !dv && Object.keys(std.byCategory || {}).length) {
    if (!missing.includes(disc)) missing.push(disc);
  } else if (dv && std.byCategory?.[dv]) {
    for (const f of (std.byCategory[dv].required || [])) if (!missing.includes(f) && fieldEmpty(d, f)) missing.push(f);
  }
  if (mode === 'items' && Array.isArray(d.craft) && d.craft.length && !d.craft_cd && !missing.includes('craft_cd')) missing.push('craft_cd');
  return missing;
}

const docName = d => d.name || d.titre || d.label || d.id || '';
const docId = d => d.id || d._id;

// ── Données ──────────────────────────────────────────────
async function loadAll() {
  await store.load(['items', 'mobs', 'pnj', 'regions', 'quetes', 'panoplies']);
  state.docs = { items: store.items, mobs: store.mobs, pnj: store.pnj, regions: store.regions, quetes: store.quetes, panoplies: store.panoplies };

  let tdc = {}, standards = {};
  try {
    const [t, s] = await Promise.all([getDoc(doc(db, 'config', 'tableau_de_chasse')), getDoc(doc(db, 'config', 'data_quality_standards'))]);
    tdc = t.exists() ? t.data() : {};
    if (s.exists()) {
      for (const [mode, cfg] of Object.entries(s.data())) {
        const byCategory = {};
        for (const [sc, scfg] of Object.entries(cfg.byCategory || {})) byCategory[sc] = { required: [...new Set((scfg.required || []).map(normField))] };
        standards[mode] = { required: [...new Set((cfg.required || []).map(normField))], byCategory };
      }
    }
  } catch (e) { console.warn('[Chasse] config illisible', e); }
  state.tdc = tdc;
  buildAvis(tdc, standards);
  await Promise.all([loadPending(), loadSent()]);
}

// Propositions déjà envoyées depuis la Chasse et en attente de relecture (endpoint public du worker, sans détail)
async function loadPending() {
  try {
    const r = await fetch(WORKER + '/chasse/pending');
    state.pending = r.ok ? await r.json() : [];
  } catch { state.pending = []; }
}
function pendingFor(a) {
  const cre = MODE[a.mode].cre;
  return state.pending.find(p => p.type === cre && ((a.id && p.id === a.id) || (p.name && norm(p.name) === norm(a.name)))) || null;
}

// Infos que ce visiteur a déjà envoyées (compte : ses tickets « chasse » ; sans compte : mémoire du navigateur)
async function loadSent() {
  const keys = new Set();
  try { JSON.parse(localStorage.getItem(SENT_KEY) || '[]').forEach(k => keys.add(k)); } catch {}
  if (state.user) {
    try {
      const snap = await getDocs(query(collection(db, 'reports'), where('submittedBy', '==', state.user.uid)));
      snap.docs.forEach(d => { const c = d.data(); if (c.category === 'chasse' && c.chasse) keys.add(sentKeyOf(c.chasse)); });
    } catch {}
  }
  state.sent = keys;
}

function buildAvis(tdc, standards) {
  const out = [];
  let lit = 0;

  // 🌓 champs manquants — ids cochés par les admins, champs recalculés en direct
  for (const m of MODES) {
    const docs = state.docs[m.key] || [];
    for (const id of (tdc[m.key] || []).filter(Boolean)) {
      const d = docs.find(x => docId(x) === id);
      if (!d) continue;
      const nd = (!d.images?.length && (d.img || d.image)) ? { ...d, images: [d.img || d.image].filter(Boolean) } : d;
      const missing = missingFor(m.key, nd, standards[m.key] || { required: [], byCategory: {} });
      if (!missing.length) { lit++; continue; }
      out.push({ key: `f:${m.key}:${id}`, kind: 'fields', mode: m.key, id, name: docName(d), fields: missing, palier: d.palier, doc: d, urgent: false });
    }
  }

  // 🌑 / 🌘 — avis saisis à la main
  for (const a of (Array.isArray(tdc.avis) ? tdc.avis : [])) {
    if (!MODE[a.mode] || !a.name) continue;
    const docs = state.docs[a.mode] || [];
    if (a.kind === 'create') {
      const found = docs.find(x => norm(docName(x)) === norm(a.name));
      if (found) { lit++; continue; } // la fiche existe désormais : l'ombre est dissipée
      out.push({ key: `a:${a.id}`, avisId: a.id, kind: 'create', mode: a.mode, name: a.name, note: a.note || '', palier: a.palier ?? null, urgent: !!a.urgent });
    } else if (a.kind === 'update') {
      const found = docs.find(x => docId(x) === a.docId) || docs.find(x => norm(docName(x)) === norm(a.name));
      if (!found) continue;
      out.push({ key: `a:${a.id}`, avisId: a.id, kind: 'update', mode: a.mode, id: docId(found), name: docName(found), note: a.note || '', palier: found.palier ?? a.palier ?? null, doc: found, urgent: !!a.urgent });
    }
  }
  state.avis = out;
  state.lit = lit;
}

// ── Filtres / rendu ──────────────────────────────────────
const palierKey = p => p == null || p === '' ? '' : String(p);
const palierRank = p => { const k = palierKey(p); if (k === '') return 9000; if (k === 'event') return 4000; const n = Number(k); return n < 0 ? 8000 : n; };
const palierLabel = p => { const k = palierKey(p); return k === '' ? '' : k === 'event' ? 'Event' : Number(k) < 0 ? 'Archive' : 'Palier ' + k; };

function visible({ ignoreKind = false, ignoreMode = false } = {}) {
  const q = norm(state.q);
  return state.avis.filter(a =>
    (ignoreKind || !state.kind || a.kind === state.kind) &&
    (ignoreMode || !state.mode || a.mode === state.mode) &&
    (!state.palier || palierKey(a.palier) === state.palier) &&
    (!q || norm(a.name).includes(q) || norm(a.note).includes(q) || norm(a.id).includes(q))
  );
}

function renderPhases() {
  const base = visible({ ignoreKind: true });
  const cnt = k => base.filter(a => a.kind === k).length;
  const tile = (kind, moon, label, sub, n) => `
    <button type="button" class="phase${state.kind === kind ? ' active' : ''}" data-kind="${kind}">
      <div class="phase-moon">${moon}</div>
      <div class="phase-count">${n}</div>
      <div class="phase-label">${esc(label)}</div>
      <div class="phase-sub">${esc(sub)}</div>
    </button>`;
  $('phases').innerHTML =
    tile('', '🌕', 'Toutes les ombres', 'Tout ce qui manque', base.length) +
    Object.entries(KINDS).map(([k, v]) => tile(k, v.moon, v.short, v.sub, cnt(k))).join('');
}

function renderChips() {
  const base = visible({ ignoreMode: true });
  const n = k => base.filter(a => a.mode === k).length;
  $('chips').innerHTML =
    `<button type="button" class="chip${state.mode ? '' : ' active'}" data-mode="">Tout<span class="n">${base.length}</span></button>` +
    MODES.map(m => `<button type="button" class="chip${state.mode === m.key ? ' active' : ''}" data-mode="${m.key}">${m.icon} ${esc(m.label)}<span class="n">${n(m.key)}</span></button>`).join('');
}

function sorted(list) {
  const byName = (a, b) => a.name.localeCompare(b.name, 'fr');
  const arr = [...list];
  if (state.sort === 'az') return arr.sort(byName);
  if (state.sort === 'palier') return arr.sort((a, b) => palierRank(a.palier) - palierRank(b.palier) || byName(a, b));
  const wait = a => (pendingFor(a) ? 1 : 0); // les avis déjà proposés (en attente des admins) passent après les autres
  return arr.sort((a, b) => (wait(a) - wait(b)) || (b.urgent - a.urgent) || palierRank(a.palier) - palierRank(b.palier) || byName(a, b));
}

function cardHtml(a) {
  const K = KINDS[a.kind], M = MODE[a.mode];
  let body = '';
  if (a.kind === 'fields') {
    body = `<div class="miss">${a.fields.map(f => `<span>${esc(FIELD_LABELS[f] || f)}</span>`).join('')}</div>`;
  } else if (a.kind === 'create') {
    body = `<div class="avis-body">${a.note ? esc(a.note) : 'Ce nom est connu, mais la fiche n’existe pas encore sur le wiki.'}</div>`;
  } else {
    body = `<div class="avis-body">${a.note ? `<b>À vérifier :</b> ${esc(a.note)}` : 'Cette fiche est à mettre à jour.'}</div>`;
  }
  const pal = palierLabel(a.palier);
  const pend = pendingFor(a);
  const sent = state.sent.has(infoKey(a));
  const wait = pend ? `
    <div class="wait" role="status">
      <span class="wait-moon" aria-hidden="true">☾</span>
      <span class="wait-txt"><b>${pend.status === 'changes_requested' ? 'Corrections demandées' : 'En attente des admins'}</b>
      <small>${pend.status === 'changes_requested' ? 'Les admins ont renvoyé la proposition à son auteur.' : 'Une proposition est en cours de relecture.'}</small></span>
    </div>` : '';
  return `
  <article class="avis${a.urgent ? ' urgent' : ''}${pend ? ' is-pending' : ''}" data-kind="${a.kind}" data-key="${esc(a.key)}">
    <div class="avis-top">
      <span class="avis-kind"><span class="moon-g">${K.moon}</span>${esc(K.label)}</span>
      ${a.urgent ? '<span class="avis-flame">🔥 Urgent</span>' : ''}
    </div>
    <h3 class="avis-name">${esc(a.name)}</h3>
    <div class="avis-meta">
      <span class="pill">${M.icon} ${esc(M.label)}</span>
      ${pal ? `<span class="pill pal">${esc(pal)}</span>` : ''}
    </div>
    ${body}
    ${wait}
    <div class="avis-foot">
      ${pend ? '' : `<button type="button" class="btn-hunt" data-act="hunt">${esc(K.cta)}</button>`}
      <button type="button" class="btn-info${sent ? ' done' : ''}" data-act="info" title="Tu sais quelque chose ? Dis-le aux admins, sans passer par le Creator">${sent ? '✓ Infos envoyées' : '💬 J’ai des infos'}</button>
      ${state.admin ? `<button type="button" class="btn-x" data-act="close" title="${a.kind === 'fields' ? 'Retirer de la chasse' : 'Marquer comme éclairé'}">✕</button>` : ''}
    </div>
  </article>`;
}

function renderList() {
  const list = sorted(visible());
  const el = $('list');
  if (!list.length) {
    el.innerHTML = state.avis.length
      ? '<div class="chasse-state" style="grid-column:1/-1"><div class="big">🌫️</div><p>Aucune ombre ne correspond à ces filtres.</p></div>'
      : '<div class="chasse-state" style="grid-column:1/-1"><div class="big">🌕</div><p>Pleine lune : le wiki est entièrement éclairé.</p></div>';
  } else {
    el.innerHTML = list.map(cardHtml).join('');
  }
  $('lit-count').textContent = state.lit ? `☾ ${state.lit} ombre${state.lit > 1 ? 's' : ''} déjà dissipée${state.lit > 1 ? 's' : ''}` : '';
}

function render() { renderPhases(); renderChips(); renderList(); }

// ── Actions ──────────────────────────────────────────────
function hunt(a) {
  const M = MODE[a.mode];
  try {
    if (a.kind === 'create') {
      sessionStorage.setItem('chasseNew', JSON.stringify({ type: M.cre, name: a.name }));
      location.href = `../creator.html?mode=${M.cre}`;
    } else {
      sessionStorage.setItem('editSub', JSON.stringify({ type: M.cre, data: a.doc }));
      sessionStorage.setItem('chasseOrigin', JSON.stringify({ mode: a.mode, id: a.id, name: a.name, missing: a.kind === 'fields' ? a.fields : [], note: a.note || '' }));
      location.href = '../creator.html';
    }
  } catch { location.href = `../creator.html?mode=${M.cre}`; }
}

// Relit le document juste avant d'écrire, pour ne pas écraser le travail d'un autre admin.
async function mutateTdc(fn) {
  const ref = doc(db, 'config', 'tableau_de_chasse');
  const snap = await getDoc(ref);
  const data = snap.exists() ? snap.data() : {};
  fn(data);
  await setDoc(ref, data);
  state.tdc = data;
}

async function closeAvis(a) {
  const verb = a.kind === 'fields' ? 'Retirer' : 'Marquer comme éclairé';
  if (!confirm(`${verb} « ${a.name} » ?`)) return;
  try {
    await mutateTdc(d => {
      if (a.kind === 'fields') d[a.mode] = (d[a.mode] || []).filter(x => x !== a.id);
      else d.avis = (d.avis || []).filter(x => x.id !== a.avisId);
    });
    state.avis = state.avis.filter(x => x.key !== a.key);
    render();
  } catch (e) { alert('Échec : ' + e.message); }
}

// ── Composeur d'avis (admin) ─────────────────────────────
function composerHtml() {
  return `
    <h3>☾ Lancer un avis</h3>
    <div class="cf-kinds">
      <label class="cf-kind on" data-k="create"><input type="radio" name="cf-kind" value="create" checked>🌑 Fiche à créer</label>
      <label class="cf-kind" data-k="update"><input type="radio" name="cf-kind" value="update">🌘 À raviver</label>
    </div>
    <p style="font-size:.74rem;color:var(--muted);margin:-4px 0 12px;">Les champs manquants se lancent depuis la modération (🎯 sur « Documents à compléter »).</p>
    <div class="cf-grid">
      <select class="cf-input" id="cf-mode">${MODES.map(m => `<option value="${m.key}">${m.icon} ${esc(m.label)}</option>`).join('')}</select>
      <input class="cf-input" id="cf-name" list="cf-names" placeholder="Nom de la fiche" autocomplete="off">
      <select class="cf-input" id="cf-palier"><option value="">Palier ?</option><option value="1">Palier 1</option><option value="2">Palier 2</option><option value="3">Palier 3</option><option value="event">Event</option></select>
    </div>
    <datalist id="cf-names"></datalist>
    <textarea class="cf-input" id="cf-note" placeholder="Indice ou raison (ex : « drop du boss de la mine », « stats changées au patch 1.4 »)"></textarea>
    <div class="cf-row">
      <label class="cf-check"><input type="checkbox" id="cf-urgent"> 🔥 Urgent</label>
      <span class="cf-msg" id="cf-msg"></span>
      <div class="cf-actions">
        <button type="button" class="btn-ghost" id="cf-cancel">Annuler</button>
        <button type="button" class="btn-gold" id="cf-save">Publier l'avis</button>
      </div>
    </div>`;
}

function refreshNames() {
  const mode = $('cf-mode').value;
  const kind = document.querySelector('input[name="cf-kind"]:checked').value;
  $('cf-names').innerHTML = kind === 'update'
    ? (state.docs[mode] || []).map(d => `<option value="${esc(docName(d))}">`).join('')
    : '';
}

function initComposer() {
  const box = $('composer');
  box.innerHTML = composerHtml();
  $('btn-avis').hidden = false;
  $('btn-avis').onclick = () => { box.classList.toggle('open'); if (box.classList.contains('open')) $('cf-name').focus(); };
  $('cf-cancel').onclick = () => box.classList.remove('open');
  box.querySelectorAll('input[name="cf-kind"]').forEach(r => r.addEventListener('change', () => {
    box.querySelectorAll('.cf-kind').forEach(l => l.classList.toggle('on', l.querySelector('input').checked));
    refreshNames();
  }));
  $('cf-mode').onchange = refreshNames;
  refreshNames();

  $('cf-save').onclick = async () => {
    const kind = document.querySelector('input[name="cf-kind"]:checked').value;
    const mode = $('cf-mode').value;
    const name = $('cf-name').value.trim();
    const msg = $('cf-msg');
    msg.textContent = '';
    if (!name) { msg.textContent = 'Donne un nom.'; return; }
    const docs = state.docs[mode] || [];
    const found = docs.find(x => norm(docName(x)) === norm(name));
    if (kind === 'create' && found) { msg.textContent = 'Une fiche porte déjà ce nom.'; return; }
    if (kind === 'update' && !found) { msg.textContent = 'Fiche introuvable : choisis un nom dans la liste.'; return; }
    if (state.avis.some(a => a.kind === kind && a.mode === mode && norm(a.name) === norm(name))) { msg.textContent = 'Cet avis existe déjà.'; return; }
    const pal = $('cf-palier').value;
    const entry = {
      id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), // identifiant de l'avis
      kind, mode, name: found ? docName(found) : name,
      ...(kind === 'update' ? { docId: docId(found) } : {}), // fiche visée
      note: $('cf-note').value.trim(),
      urgent: $('cf-urgent').checked,
      ...(pal ? { palier: pal === 'event' ? 'event' : Number(pal) } : {}),
      ts: Date.now(),
    };
    $('cf-save').disabled = true;
    try {
      await mutateTdc(d => { d.avis = [...(d.avis || []), entry]; });
      await loadAll();
      $('cf-name').value = ''; $('cf-note').value = ''; $('cf-urgent').checked = false;
      box.classList.remove('open');
      render();
    } catch (e) { msg.textContent = 'Échec : ' + e.message; }
    $('cf-save').disabled = false;
  };
}

// ── Init ─────────────────────────────────────────────────
function bind() {
  $('phases').addEventListener('click', e => { const b = e.target.closest('.phase'); if (!b) return; state.kind = b.dataset.kind; render(); });
  $('chips').addEventListener('click', e => { const b = e.target.closest('.chip'); if (!b) return; state.mode = b.dataset.mode; render(); });
  $('q').addEventListener('input', e => { state.q = e.target.value; render(); });
  $('palier').addEventListener('change', e => { state.palier = e.target.value; render(); });
  $('sort').addEventListener('change', e => { state.sort = e.target.value; renderList(); });
  $('list').addEventListener('click', e => {
    const btn = e.target.closest('[data-act]'); if (!btn) return;
    const a = state.avis.find(x => x.key === btn.closest('.avis').dataset.key); if (!a) return;
    if (btn.dataset.act === 'hunt') hunt(a); else if (btn.dataset.act === 'info') openInfo(a); else closeAvis(a);
  });
  $('info-cancel').onclick = closeInfo;
  $('info-modal').addEventListener('click', e => { if (e.target === $('info-modal')) closeInfo(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeInfo(); });
  $('info-send').onclick = sendInfo;
}

// ── « J'ai des informations » : même circuit que les tickets (collection reports), mais rangé dans la Chasse ──
let infoTarget = null;
function openInfo(a) {
  infoTarget = a;
  $('info-name').textContent = a.name;
  $('info-kind').textContent = KINDS[a.kind].moon + ' ' + KINDS[a.kind].label + ' · ' + MODE[a.mode].label;
  $('info-text').value = '';
  $('info-status').textContent = '';
  $('info-login').hidden = !!state.user;
  $('info-modal').hidden = false;
  $('info-text').focus();
}
function closeInfo() { $('info-modal').hidden = true; infoTarget = null; }

async function sendInfo() {
  const a = infoTarget, text = $('info-text').value.trim();
  const status = $('info-status');
  if (!a) return;
  if (text.length < 5) { status.textContent = 'Écris au moins quelques mots.'; return; }
  const btn = $('info-send'); btn.disabled = true; status.textContent = 'Envoi…';
  try {
    const pseudo = (state.user && document.getElementById('vcl-user-pseudo')?.textContent?.trim()) || (state.user ? 'Utilisateur' : 'Anonyme');
    const head = `🎯 Chasse — ${a.name} (${MODE[a.mode].label}, ${KINDS[a.kind].label})\n\n`;
    const ok = await logReport(pseudo, 'chasse.html', head + text.slice(0, 1800), null, 'chasse', { mode: a.mode, id: a.id || '', name: a.name, kind: a.kind });
    if (!ok) throw new Error('envoi refusé, réessaie plus tard');
    const k = infoKey(a);
    state.sent.add(k);
    try { const l = JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); l.push(k); localStorage.setItem(SENT_KEY, JSON.stringify(l.slice(-200))); } catch {}
    status.textContent = 'Merci ! Les admins ont reçu tes informations.';
    renderList();
    setTimeout(closeInfo, 1100);
  } catch (e) { status.textContent = 'Erreur : ' + e.message; }
  btn.disabled = false;
}

(async function init() {
  try { logPageView('chasse'); } catch {}
  bind();
  try { state.user = await getCurrentUser(); } catch {}
  try {
    await loadAll();
  } catch (e) {
    console.error('[Chasse]', e);
    $('list').innerHTML = '<div class="chasse-state" style="grid-column:1/-1"><div class="big">⚠️</div><p>Impossible de charger les données.</p></div>';
    return;
  }
  render();
  if (state.user && hasRole(state.user.role, 'admin')) { state.admin = true; initComposer(); render(); }
})();
