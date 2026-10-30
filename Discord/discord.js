/* Page d'inscription des serveurs Discord (Discord/discord.html).
   Tout passe par le worker (/guild/api) avec une session obtenue après la connexion Discord ; aucun secret ici. */
(function () {
'use strict';
const WORKER = 'https://veilleurs.veilleurs-wiki.workers.dev';
const SESSION_KEY = 'vcl_guild_session';

// Catégories d'items : [id, libellé, nom de salon] (mêmes que l'onglet « Discord » de la modération)
const CATS = [['arme', '⚔️ Armes', 'armes'], ['armure', '🛡️ Armures', 'armures'], ['accessoire', '💍 Accessoires', 'accessoires'], ['outils', '🛠️ Outils', 'outils'], ['rune', '🔮 Runes', 'runes'],
  ['consommable', '🧪 Consommables', 'consommables'], ['nourriture', '🍖 Nourriture', 'nourriture'], ['materiaux', '🧱 Matériaux', 'materiaux'], ['ressources', '⛏️ Ressources', 'ressources'],
  ['parchemin', '📃 Parchemins', 'parchemins'], ['quete', '📜 Quête', 'quete'], ['donjon', '🏰 Donjon', 'donjon'], ['monnaie', '🪙 Monnaie', 'monnaie']];
const FALLBACK_PALIERS = [{ id: '1', label: 'Palier 1' }, { id: '2', label: 'Palier 2' }, { id: '3', label: 'Palier 3' }, { id: 'event', label: 'Event' }, { id: 'worldboss', label: 'World Boss' }];
const ARCHIVE = { id: '-1', label: 'Archive' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const slug = n => String(n || '').trim().replace(/\s+/g, '-').replace(/[\\/#@:*?"<>|`\u0000-\u001f]/g, '').slice(0, 100);
const has = (l, v) => (l || []).map(String).includes(String(v));
const toggle = (l, v) => (has(l, v) ? l.filter(x => String(x) !== String(v)) : [...l, String(v)]);

// Style « Veilleurs » (même que la modération) : salon = emoji・𝗡𝗼𝗺 (lettres grasses Unicode : Discord met les salons en minuscules) ; catégorie = emoji NOM EN MAJUSCULES
const PAL_EMOJI = { '1': '🌱', '2': '🔥', '3': '🌲', event: '🎉', worldboss: '🌍', '-1': '📦' };
const fancy = text => [...String(text).normalize('NFD')].map(ch => {
  const c = ch.codePointAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D5D4 + c - 65);
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D5EE + c - 97);
  if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7EC + c - 48);
  return ch;
}).join('');
const cap = t => String(t).replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toUpperCase());
const styleChannel = (emoji, name) => (emoji ? emoji + '・' : '') + fancy(cap(name));
const styleCategory = (id, label) => (PAL_EMOJI[String(id)] || '📁') + ' ' + String(label).toUpperCase();
const catStyled = c => { const x = CATS.find(q => q[0] === c); if (!x) return c; const [emoji, ...w] = x[1].split(' '); return styleChannel(emoji, w.join(' ')); };

/** Plan de salons à créer. combos = [[catégorie, palier]] présents dans le wiki (ou tous si inconnu). */
function buildPlan(structure, o) {
  const { combos, cats, paliers, palierLabel, forum, styled = true } = o;
  const chName = c => (styled ? catStyled(c) : (CATS.find(x => x[0] === c) || [0, 0, c])[2]);
  const catName = p => (styled ? styleCategory(p, palierLabel(p)) : palierLabel(p)); // cats/paliers : filtres choisis (vide = tout)
  const type = forum ? 'forum' : 'text';
  const fitsCat = c => !cats.length || cats.includes(c);
  const fitsPal = p => (paliers.length ? paliers.map(String).includes(String(p)) : String(p) !== '-1'); // l'archive n'est envoyée que si elle est choisie
  if (structure === 'single') return [{ name: styled ? styleChannel('📜', 'Items') : 'items-veilleurs', type, categoryName: '', id: '', itemCats: [], paliers: [] }];
  const order = (arr, v) => { const i = arr.indexOf(String(v)); return i < 0 ? 999 : i; };
  const palOrder = o.paliers_all.map(p => String(p.id));
  // Un palier coché explicitement reçoit ses salons même s'il n'a pas encore d'items (pour les futurs items) : on complète avec toutes les catégories voulues
  const exist = new Set(combos.map(([c, p]) => c + '|' + p));
  const wantedCats = cats.length ? cats : [...new Set(combos.map(x => x[0]))];
  const extra = [];
  for (const p of paliers) for (const c of wantedCats) if (!exist.has(c + '|' + p)) extra.push([c, String(p)]);
  const list = [...combos, ...extra].filter(([c, p]) => fitsCat(c) && fitsPal(p))
    .sort((a, b) => order(palOrder, a[1]) - order(palOrder, b[1]) || CATS.findIndex(x => x[0] === a[0]) - CATS.findIndex(x => x[0] === b[0]));
  return list.map(([c, p]) => ({ name: chName(c), type, categoryName: catName(p), id: '', itemCats: [c], paliers: [String(p)] }));
}

if (typeof document === 'undefined') { module.exports = { buildPlan, slug, styleChannel, styleCategory }; return; }

// ═══ État ═══
const S = { session: sessionStorage.getItem(SESSION_KEY) || '', me: null, guild: null, info: null, cfg: null, doc: null,
  paliers: FALLBACK_PALIERS, combos: null, itemCount: null, step: 'login', busy: false, msg: '', err: '', poll: null };
const app = document.getElementById('dg-app');

async function api(action, extra = {}) {
  const r = await fetch(WORKER + '/guild/api', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ session: S.session, action, ...extra }) });
  const j = await r.json().catch(() => ({}));
  if (j.expired) { sessionStorage.removeItem(SESSION_KEY); S.session = ''; S.step = 'login'; render(); }
  if (!r.ok) throw new Error(j.error || ('Erreur ' + r.status));
  return j;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ═══ Connexion ═══
async function login() {
  try {
    const r = await fetch(WORKER + '/discord/start', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'guilds', origin: location.origin, redirect: true, path: location.pathname }) });
    const d = await r.json();
    if (!d.url) throw new Error(d.error || 'Connexion Discord indisponible.');
    location.href = d.url;
  } catch (e) { S.err = e.message; render(); }
}
function logout() { sessionStorage.removeItem(SESSION_KEY); S.session = ''; S.me = null; S.step = 'login'; render(); }

// ═══ Données du wiki (paliers et combinaisons catégorie/palier existantes) ═══
async function loadWikiMeta() {
  try {
    const r = await (await fetch(WORKER + '/db/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ col: 'config', id: 'paliers' }) })).json();
    const p = r.doc?.d?.paliers;
    if (Array.isArray(p) && p.length) S.paliers = p.map(x => ({ id: String(x.id), label: x.label || String(x.id) }));
  } catch { /* palier par défaut */ }
  if (!S.paliers.some(p => p.id === 'event')) S.paliers.push({ id: 'event', label: 'Event' });
  if (!S.paliers.some(p => p.id === 'worldboss')) S.paliers.push({ id: 'worldboss', label: 'World Boss' });
  if (!S.paliers.some(p => p.id === '-1')) S.paliers.push(ARCHIVE);
}
async function loadCombos() {
  if (S.combos) return;
  try {
    const j = await (await fetch(`${WORKER}/db/sync?col=items&since=0`)).json();
    const m = new Map(); let n = 0;
    (j.docs || []).forEach(x => { const c = x.d.category, p = x.d.palier; if (!c || p == null) return; n++; m.set(`${c}|${p}`, [c, String(p)]); });
    S.combos = [...m.values()]; S.itemCount = n;
    S.counts = {}; (j.docs || []).forEach(x => { const k = `${x.d.category}|${x.d.palier}`; S.counts[k] = (S.counts[k] || 0) + 1; });
  } catch { S.combos = CATS.flatMap(c => ['1', '2', '3', 'event', 'worldboss'].map(p => [c[0], p])); S.itemCount = null; S.counts = {}; }
}
const palierLabel = id => (S.paliers.find(p => p.id === String(id)) || {}).label || String(id);
function estimate(cfg) { // nombre d'items concernés par les filtres généraux
  if (!S.counts) return null;
  let n = 0;
  for (const [k, v] of Object.entries(S.counts)) {
    const [c, p] = k.split('|');
    if ((cfg.itemCats.length && !has(cfg.itemCats, c)) || (cfg.paliers.length ? !has(cfg.paliers, p) : p === '-1')) continue;
    n += v;
  }
  return n;
}

// ═══ Configuration par défaut ═══
function defaultCfg() {
  return { mode: 'create', structure: 'default', prefix: '', access: 'everyone', roleIds: [], itemCats: [], paliers: [], initial: 'new', forum: true, hideThreshold: 10, replace: true, groupSets: false, eventTags: true, styled: true, channels: [] };
}
function regenPlan() {
  const c = S.cfg;
  if (c.mode !== 'create' || c.structure === 'custom') return;
  c.channels = buildPlan(c.structure, { combos: S.combos || [], cats: c.itemCats, paliers: c.paliers, paliers_all: S.paliers, palierLabel, forum: c.forum, styled: c.styled !== false });
}

// ═══ Rendu ═══
const STEPS = [['login', '1 · Connexion'], ['guild', '2 · Serveur'], ['bot', '3 · Bot'], ['form', '4 · Réglages'], ['recap', '5 · Confirmation']];
const stepsBar = () => `<div class="dg-steps">${STEPS.map(([k, l], i) => {
  const cur = STEPS.findIndex(s => s[0] === (S.step === 'status' ? 'recap' : S.step)); return `<span class="${i === cur ? 'on' : i < cur ? 'done' : ''}">${l}</span>`; }).join('')}</div>`;
const msgs = () => (S.err ? `<div class="dg-err">⛔ ${esc(S.err)}</div>` : '') + (S.msg ? `<div class="dg-ok">${esc(S.msg)}</div>` : '');
const chip = (on, label, fn) => `<button type="button" class="dg-chip ${on ? 'on' : ''}" onclick="${fn}">${label}</button>`;
const iconUrl = g => g.icon ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.png?size=64` : '';

function statusBadge(g) {
  if (g.status === 'removing') return '<span class="dg-badge warn">désinstallation…</span>';
  if (!g.status) return g.botPresent ? '<span class="dg-badge">bot présent, non configuré</span>' : '<span class="dg-badge">bot absent</span>';
  if (g.status === 'refused') return '<span class="dg-badge bad">refusé</span>';
  if (g.status === 'suspended') return '<span class="dg-badge bad">suspendu</span>';
  if (g.status === 'pending') return '<span class="dg-badge warn">en attente de validation</span>';
  return g.paused ? '<span class="dg-badge warn">en pause</span>' : '<span class="dg-badge ok">actif</span>';
}

function watchProgress() {
  clearInterval(S.prog);
  if (S.step !== 'status' || !S.doc?.pending || S.doc.status !== 'approved') return;
  S.prog = setInterval(async () => {
    if (S.step !== 'status') return clearInterval(S.prog);
    try { const j = await api('inspect', { guildId: S.guild.id }); if (j.config) { S.doc = j.config; render(); } } catch { /* au prochain tour */ }
  }, 10000);
}

function render() {
  const u = document.getElementById('dg-user');
  u.innerHTML = S.me ? `${esc(S.me.user.name)} <button class="dg-btn" onclick="DG.logout()" style="padding:3px 10px;font-size:11px;">Déconnexion</button>` : '';
  const f = ({ login: rLogin, guild: rGuild, bot: rBot, form: rForm, recap: rRecap, status: rStatus })[S.step] || rLogin;
  // Le rendu remplace tout le contenu : on garde la position de défilement (style.css a scroll-behavior: smooth, d'où « instant »)
  const y = window.scrollY, step = render.lastStep;
  app.innerHTML = stepsBar() + f();
  render.lastStep = S.step;
  window.scrollTo({ top: step === S.step ? y : 0, behavior: 'instant' });
  watchProgress();
}

function rLogin() {
  return `<div class="dg-card"><h2>Se connecter</h2>
    <p>Connecte-toi avec Discord pour choisir le serveur à configurer. Seuls les serveurs où tu as la permission <strong>Gérer le serveur</strong> (ou dont tu es propriétaire) seront proposés.</p>
    <div class="dg-row"><button class="dg-btn discord" onclick="DG.login()">Se connecter avec Discord</button></div>${msgs()}</div>`;
}

function rGuild() {
  const gs = S.me.guilds;
  return `<div class="dg-card"><h2>Choisis ton serveur</h2>
    ${gs.length ? `<div class="dg-guilds">${gs.map(g => `<div class="dg-guild">${iconUrl(g) ? `<img src="${iconUrl(g)}" alt="">` : `<div class="ph">${esc(g.name[0])}</div>`}
      <div class="name">${esc(g.name)}</div>${statusBadge(g)}<button class="dg-btn primary" onclick="DG.pick('${g.id}')">${g.status ? 'Voir / modifier' : 'Configurer'}</button></div>`).join('')}</div>`
      : '<p>Aucun serveur trouvé où tu peux gérer le serveur. Demande à un administrateur, ou vérifie ton compte Discord.</p>'}${msgs()}</div>`;
}

function rBot() {
  const g = S.guild;
  return `<div class="dg-card"><h2>Invite le bot sur « ${esc(g.name)} »</h2>
    <p>Le bot a besoin de : voir et écrire dans les salons, créer des fils, joindre des fichiers, gérer les salons (créer ceux de ton plan) et gérer les rôles (masquer un salon pendant un gros envoi). Tu peux ensuite lui retirer des droits dans les réglages de ton serveur.</p>
    <div class="dg-row"><a class="dg-btn discord" href="${esc(S.invite)}" target="_blank" rel="noopener" onclick="DG.watchBot()">Inviter le bot</a>
    <button class="dg-btn" onclick="DG.checkBot()">J'ai invité le bot : vérifier</button>
    <button class="dg-btn" onclick="DG.back()">← Autre serveur</button></div>
    <p class="dg-hint" style="margin-top:12px">La détection est automatique dès que le bot est sur le serveur.</p>${msgs()}</div>`;
}

const optRadio = (name, val, cur, title, sub, fn) => `<label class="dg-opt ${cur === val ? 'on' : ''}"><input type="radio" name="${name}" ${cur === val ? 'checked' : ''} onchange="${fn}"><span>${title}${sub ? `<small>${sub}</small>` : ''}</span></label>`;
const chanOptions = (sel) => {
  const chs = S.info.channels, cats = chs.filter(c => c.type === 4);
  const real = chs.filter(c => c.type !== 4).sort((a, b) => a.position - b.position);
  const ico = t => t === 15 ? '🗂' : t === 5 ? '📢' : '#';
  const opt = c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${ico(c.type)} ${esc(c.name)}</option>`;
  return `<option value="">— choisir un salon —</option>` + cats.map(k => `<optgroup label="${esc(k.name)}">${real.filter(c => c.parent_id === k.id).map(opt).join('')}</optgroup>`).join('')
    + (real.some(c => !c.parent_id) ? `<optgroup label="Sans catégorie">${real.filter(c => !c.parent_id).map(opt).join('')}</optgroup>` : '');
};

function rForm() {
  const c = S.cfg, creating = c.mode === 'create';
  const catChips = CATS.map(([k, l]) => chip(has(c.itemCats, k), l, `DG.tgl('itemCats','${k}')`)).join('');
  const palChips = S.paliers.map(p => chip(has(c.paliers, p.id), esc(p.label), `DG.tgl('paliers','${esc(p.id)}')`)).join('');
  const roleChips = (S.info.roles || []).map(r => chip(has(c.roleIds, r.id), esc(r.name), `DG.tgl('roleIds','${r.id}')`)).join('');
  const compact = creating && c.structure !== 'custom';
  const routes = compact ? '' : c.channels.map((ch, i) => `<div class="dg-route" style="${creating && outOfFilter(ch) ? 'opacity:.4' : ''}"><div class="top">${creating && outOfFilter(ch) ? '<span class="dg-badge warn" title="Hors de tes filtres « Quoi envoyer » : ce salon ne sera pas créé">hors filtres : non créé</span>' : ''}
      ${creating ? `<input type="text" value="${esc(ch.name)}" placeholder="nom-du-salon" onchange="DG.setCh(${i},'name',this.value)" style="width:190px;font-weight:700">
        <input type="text" value="${esc(ch.categoryName)}" placeholder="catégorie Discord" onchange="DG.setCh(${i},'categoryName',this.value)" style="width:170px">`
      : `<select onchange="DG.setCh(${i},'id',this.value)" style="min-width:230px">${chanOptions(ch.id)}</select>`}
      ${c.structure === 'custom' || !creating ? `<button class="dg-btn danger" style="padding:3px 9px" onclick="DG.delCh(${i})" title="Retirer">🗑</button>` : ''}</div>
    ${c.structure === 'custom' || !creating ? `<div class="dg-hint">Catégories d'items (aucune = toutes)</div><div class="dg-chips">${CATS.map(([k, l]) => chip(has(ch.itemCats, k), l, `DG.tglCh(${i},'itemCats','${k}')`)).join('')}</div>
      <div class="dg-hint">Paliers (aucun = tous)</div><div class="dg-chips">${S.paliers.map(p => chip(has(ch.paliers, p.id), esc(p.label), `DG.tglCh(${i},'paliers','${esc(p.id)}')`)).join('')}</div>`
      : `<div class="dg-hint">${ch.itemCats.map(k => (CATS.find(x => x[0] === k) || [0, k])[1]).join(', ') || 'Tout'} · ${ch.paliers.map(palierLabel).join(', ') || 'tous les paliers'}</div>`}</div>`).join('');
  const n = estimate(c);
  return `<div class="dg-card"><h2>Réglages pour « ${esc(S.guild.name)} »</h2>
    <h3>① Quoi envoyer ?</h3>
    <div class="dg-hint">Catégories d'items (aucune sélection = toutes)</div><div class="dg-chips">${catChips}</div>
    <div class="dg-hint">Paliers (aucune sélection = tous sauf l'Archive ; Event et World Boss sont des paliers comme les autres)</div><div class="dg-chips">${palChips}</div>
    ${optRadio('in', 'new', c.initial, 'Seulement les nouveaux items', 'Les items déjà dans le wiki ne sont pas envoyés.', "DG.set('initial','new')")}
    ${optRadio('in', 'all', c.initial, 'Envoyer tous les items maintenant', n != null ? `Environ ${n} items : l'envoi peut durer plusieurs heures (le bot respecte les limites de Discord).` : 'L\'envoi peut durer plusieurs heures.', "DG.set('initial','all')")}


    <h3>② Où envoyer ?</h3>
    ${optRadio('mode', 'create', c.mode, 'Crée les salons pour moi', 'Le bot crée catégories et salons (tu pourras les renommer ensuite).', "DG.set('mode','create')")}
    ${optRadio('mode', 'existing', c.mode, "J'ai déjà mes salons", 'Tu choisis, pour chaque catégorie d\'items / palier, un salon existant.', "DG.set('mode','existing')")}
    ${creating ? `<h3>Structure</h3>
      ${optRadio('st', 'default', c.structure, 'Recommandé : une catégorie Discord par palier + un salon par catégorie d\'items', 'Ex. « Palier 1 » → #armes, #armures… (seulement les combinaisons qui existent dans le wiki).', "DG.set('structure','default')")}
      ${optRadio('st', 'single', c.structure, 'Un seul salon', 'Tous les items dans un seul salon.', "DG.set('structure','single')")}
      ${optRadio('st', 'custom', c.structure, 'Personnalisé', 'Pars du plan recommandé puis ajoute, retire, renomme, regroupe.', "DG.set('structure','custom')")}
      <label class="dg-opt ${c.styled !== false ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" ${c.styled !== false ? 'checked' : ''} onchange="DG.set('styled',this.checked)"><span>Style Veilleurs (emojis, majuscules, lettres stylisées)<small>Ex. « 🌱 PALIER 1 » / « ⚔️・𝗔𝗿𝗺𝗲𝘀 ». Décoche pour des noms simples (armes, armures…) ; remet le plan à zéro.</small></span></label>
      <div class="dg-row"><label class="dg-hint">Préfixe de catégorie (facultatif) <input type="text" maxlength="20" value="${esc(c.prefix)}" placeholder="VCL" onchange="DG.set('prefix',this.value)" style="width:120px"></label></div>` : ''}
    ${compact ? compactPlan() : ''}
    <div style="margin-top:10px">${compact ? '' : routes || '<div class="dg-hint">Aucun salon dans le plan.</div>'}
      ${c.structure === 'custom' || !creating ? `<button class="dg-btn" onclick="DG.addCh()">➕ Ajouter un salon / une règle</button>` : ''}
      ${!creating && c.channels.length > 0 ? '' : ''}</div>

    <h3>③ Qui voit les salons créés ?</h3>
    ${optRadio('ac', 'everyone', c.access, 'Tout le monde', 'Lecture seule : personne d\'autre que le bot ne peut écrire.', "DG.set('access','everyone')")}
    ${optRadio('ac', 'roles', c.access, 'Certains rôles', '', "DG.set('access','roles')")}
    ${c.access === 'roles' ? `<div class="dg-chips" style="margin:4px 0 8px 26px">${roleChips || '<span class="dg-hint">Aucun rôle trouvé.</span>'}</div>` : ''}
    ${optRadio('ac', 'admins', c.access, 'Administrateurs seulement', '', "DG.set('access','admins')")}
    <div class="dg-hint">${creating ? 'S\'applique aux salons créés par le bot. Pour tes salons existants, tes propres réglages de droits restent inchangés.' : 'Ignoré : tes salons existants gardent leurs droits.'}</div>

    <h3>④ Options</h3>
    ${optRadio('fo', '1', c.forum ? '1' : '0', 'Forum : un post (fil) par item', S.info.community ? '' : '⚠️ Les forums demandent le mode Communauté sur ton serveur.', "DG.set('forum',true)")}
    ${optRadio('fo', '0', c.forum ? '1' : '0', 'Salon texte : un message par item', '', "DG.set('forum',false)")}
    <div class="dg-row"><label class="dg-hint">🤫 Masquer un salon pendant un envoi de plus de <input type="number" min="0" max="1000" value="${c.hideThreshold}" onchange="DG.set('hideThreshold',this.value)" style="width:70px"> items (0 = jamais) — évite que tout le monde soit notifié par une rafale ; le bot rétablit la visibilité ensuite.</label></div>
    ${c.forum ? `<label class="dg-opt ${c.eventTags ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" ${c.eventTags ? 'checked' : ''} onchange="DG.set('eventTags',this.checked)"><span>Un tag par événement (Noël, Halloween…)<small>Le bot crée les tags dans tes forums (20 maximum par forum) et applique automatiquement le bon tag aux items d'un événement, avec son emoji. Permet de filtrer par événement.</small></span></label>` : ''}
    <label class="dg-opt ${c.groupSets ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" ${c.groupSets ? 'checked' : ''} onchange="DG.set('groupSets',this.checked)"><span>Grouper les items d'un même set dans un seul post<small>Par exemple tous les accessoires d'un set ensemble ; le post porte le nom du set (jusqu'à 10 cartes par message, la suite dans des messages suivants). Si tu changes cette option plus tard, le bot supprime ses anciens posts et les reposte autrement.</small></span></label>
    <label class="dg-opt ${c.replace ? 'on' : ''}" style="margin-top:8px"><input type="checkbox" ${c.replace ? 'checked' : ''} onchange="DG.set('replace',this.checked)"><span>Remplacer l'ancien post quand un item est mis à jour<small>Sinon, l'ancien post reste tel quel.</small></span></label>

    <div class="dg-row"><button class="dg-btn" onclick="DG.back()">← Autre serveur</button><button class="dg-btn primary" onclick="DG.toRecap()">Récapitulatif →</button></div>${msgs()}</div>`;
}

/** Plan « recommandé » / « un seul salon » : arbre compact ; on peut renommer ou décocher un salon (décoché = non créé). */
function compactPlan() {
  const c = S.cfg;
  const groups = [];
  c.channels.forEach((ch, i) => { let g = groups.find(x => x.cat === ch.categoryName); if (!g) groups.push(g = { cat: ch.categoryName, rows: [] }); g.rows.push([ch, i]); });
  const kept = finalCfg().channels.length;
  return `<div class="dg-hint" style="margin-top:12px">Salons qui seront créés : <strong>${kept}</strong> sur ${c.channels.length}. Décoche ceux dont tu n'as pas besoin, clique sur un nom pour le changer. Ils sont créés vides : le bot n'y poste que les items qui existent.</div>
    <div class="dg-route" style="max-height:420px;overflow:auto">${groups.map((g, gi) => `
      ${g.cat ? `<div class="top" style="margin:6px 0 4px"><span class="dg-hint">📁</span><input type="text" value="${esc(g.cat)}" onchange="DG.setCat(${gi}, this.value)" style="width:230px;font-weight:700"></div>` : ''}
      ${g.rows.map(([ch, i]) => `<div class="top" style="margin:2px 0 2px 22px;opacity:${ch.skip ? .45 : 1}"><input type="checkbox" ${ch.skip ? '' : 'checked'} onchange="DG.skipCh(${i},!this.checked)" title="Créer ce salon">
        <input type="text" value="${esc(ch.name)}" onchange="DG.setCh(${i},'name',this.value)" style="width:240px">
        <span class="dg-hint">${ch.itemCats.map(k => (CATS.find(x => x[0] === k) || [0, k])[1]).join(', ') || 'tout'}${itemsIn(ch)}</span></div>`).join('')}`).join('')}</div>`;
}

/** « · N items » / « · aucun item pour l'instant » pour un salon qui vise une catégorie et un palier précis. */
function itemsIn(ch) {
  if (!S.counts || ch.itemCats.length !== 1 || ch.paliers.length !== 1) return '';
  const n = S.counts[ch.itemCats[0] + '|' + ch.paliers[0]] || 0;
  return n ? ` · ${n} item${n > 1 ? 's' : ''}` : ' · aucun item pour l\'instant';
}

/** Réglages envoyés : les salons décochés ne sont pas créés. */
// Un salon dont les catégories (ou paliers) ne recoupent pas les filtres « Quoi envoyer » ne recevrait jamais rien : on ne le crée pas (mode personnalisé : plan non régénéré)
const outOfFilter = ch => {
  const c = S.cfg, miss = (mine, global) => mine.length && global.length && !mine.some(x => has(global, x));
  return miss(ch.itemCats || [], c.itemCats) || miss(ch.paliers || [], c.paliers);
};
const finalCfg = () => ({ ...S.cfg, channels: S.cfg.channels.filter(x => !x.skip && !(S.cfg.mode === 'create' && outOfFilter(x))) });

function rRecap() {
  const c = finalCfg(), creating = c.mode === 'create', n = estimate(c);
  const catLbl = k => (CATS.find(x => x[0] === k) || [0, k])[1];
  const lines = c.channels.map(ch => `${creating ? `<strong>${esc(ch.categoryName ? [c.prefix, ch.categoryName].filter(Boolean).join(' ') + ' / ' : c.prefix ? esc(c.prefix) + ' / ' : '')}${esc(ch.name)}</strong>` : `<strong>#${esc((S.info.channels.find(x => x.id === ch.id) || {}).name || '?')}</strong>`} ← ${ch.itemCats.map(catLbl).join(', ') || 'tout'} · ${ch.paliers.map(palierLabel).join(', ') || 'tous paliers'}`);
  return `<div class="dg-card"><h2>Récapitulatif</h2><dl class="dg-recap">
    <dt>Serveur</dt><dd>${esc(S.guild.name)}</dd>
    <dt>Salons (${c.channels.length})</dt><dd>${creating ? 'créés par le bot' : 'existants'} — ${lines.map(l => `<div>${l}</div>`).join('')}</dd>
    <dt>Accès</dt><dd>${{ everyone: 'tout le monde (lecture seule)', roles: 'rôles : ' + c.roleIds.map(id => esc((S.info.roles.find(r => r.id === id) || {}).name || id)).join(', '), admins: 'administrateurs seulement' }[c.access]}</dd>
    <dt>Envoi</dt><dd>${c.itemCats.map(catLbl).join(', ') || 'toutes les catégories'} · ${c.paliers.map(palierLabel).join(', ') || 'tous les paliers'} · ${c.initial === 'all' ? 'tous les items existants' + (n != null ? ' (~' + n + ')' : '') : 'nouveaux items seulement'}</dd>
    <dt>Options</dt><dd>${c.forum ? 'forum' : 'salon texte'} · ${c.groupSets ? 'items groupés par set (un post par set)' : 'un post par item'}${c.forum && c.eventTags ? ' · tags par événement' : ''} · masquage au-delà de ${c.hideThreshold || '∞ (jamais)'} items · ${c.replace ? "remplacement de l'ancien post" : 'ancien post conservé'}</dd></dl>
    <p class="dg-hint" style="margin-top:12px">${S.doc?.status === 'approved' ? '<strong>Ce serveur est déjà validé : tes modifications sont appliquées tout de suite, sans nouvelle validation.</strong> L\'équipe du wiki est prévenue de la modification et peut suspendre le serveur si besoin.' : S.doc?.status === 'pending' ? 'Ton inscription est toujours en attente de validation : tes modifications sont prises en compte, rien n\'est envoyé avant la validation.' : S.doc?.status === 'refused' || S.doc?.status === 'suspended' ? 'Ce serveur est refusé ou suspendu par l\'équipe du wiki : tes modifications sont enregistrées mais rien n\'est envoyé.' : 'En confirmant, tu inscris ce serveur : l\'équipe du wiki doit le valider avant tout envoi (rien n\'est envoyé avant). Tu pourras modifier, mettre en pause ou tout désinstaller à cette même adresse.'}</p>
    <div class="dg-row"><button class="dg-btn" onclick="DG.step('form')">← Modifier</button><button class="dg-btn primary" id="dg-confirm" onclick="DG.confirm()" ${S.busy ? 'disabled' : ''}>${S.doc ? 'Enregistrer les modifications' : "Confirmer l'inscription"}</button></div>
    <div class="dg-bar" id="dg-bar" style="display:none"><i></i></div>${msgs()}</div>`;
}

function rStatus() {
  const d = S.doc, g = S.guild, st = d.status;
  const txt = { pending: '⏳ En attente de validation par l\'équipe du wiki. Rien n\'est envoyé tant que ce n\'est pas validé.', approved: d.paused ? '⏸ En pause : rien n\'est envoyé.' : '🟢 Actif : le bot envoie les items.',
    refused: '⛔ Inscription refusée par l\'équipe du wiki.', suspended: '⏸ Suspendu par l\'équipe du wiki.', removing: '🧹 Désinstallation en cours (quelques minutes) : le bot nettoie puis quitte le serveur.' }[st] || st;
  const when = t => t ? new Date(t).toLocaleString('fr-FR') : '—';
  const missing = d.mode === 'create' && d.channels.some(c => c.name && !c.id);
  return `<div class="dg-card"><h2>« ${esc(g.name)} » — statut</h2><p style="font-size:14px">${txt}</p>
    <dl class="dg-recap"><dt>Posts envoyés</dt><dd>${d.posted ?? 0}${d.pending ? ` · restants : ${d.pending}` : ''}
      ${d.pending ? `<div class="dg-bar"><i style="width:${Math.round(100 * (d.posted || 0) / ((d.posted || 0) + d.pending))}%"></i></div><div class="dg-hint">${Math.round(100 * (d.posted || 0) / ((d.posted || 0) + d.pending))} % — ${d.posted || 0} sur ${(d.posted || 0) + d.pending}</div>` : ''}</dd><dt>Dernier envoi</dt><dd>${when(d.lastSentAt)}</dd>
    ${d.lastError ? `<dt>Dernière erreur du bot</dt><dd style="color:var(--removed)">${esc(d.lastError)}</dd>` : ''}${d.purge ? '<dt>En cours</dt><dd>suppression des posts…</dd>' : ''}</dl>
    ${missing ? '<p class="dg-err">Certains salons du plan ne sont pas encore créés. <button class="dg-btn" onclick="DG.makeChannels()">Créer les salons manquants</button></p>' : ''}
    ${st === 'removing' ? '' : `<div class="dg-row">
      <button class="dg-btn" onclick="DG.edit()">✏️ Modifier les réglages</button>
      ${st === 'approved' || st === 'pending' ? `<button class="dg-btn" onclick="DG.pause(${!d.paused})">${d.paused ? '▶ Reprendre' : '⏸ Mettre en pause'}</button>` : ''}
      <button class="dg-btn danger" onclick="DG.purge()">🗑 Supprimer tous les posts</button>
      <button class="dg-btn danger" onclick="DG.uninstallDlg()">Désinstaller</button>
      <button class="dg-btn" onclick="DG.back()">← Mes serveurs</button></div>`}
    <div class="dg-bar" id="dg-bar" style="display:none"><i></i></div>${msgs()}</div>`;
}

// ═══ Actions ═══
const DG = window.DG = {
  login, logout,
  step(s) { S.step = s; S.err = S.msg = ''; render(); },
  back() { clearInterval(S.poll); S.guild = null; S.doc = null; S.err = S.msg = ''; S.step = 'guild'; refreshMe().then(render); },
  async pick(id) {
    S.guild = S.me.guilds.find(g => g.id === id); S.err = S.msg = '';
    S.invite = S.me.inviteUrls[id];
    S.step = 'bot'; render();
    await DG.checkBot();
  },
  watchBot() { clearInterval(S.poll); S.poll = setInterval(() => DG.checkBot(true), 4000); },
  async checkBot(quiet) {
    try {
      const j = await api('inspect', { guildId: S.guild.id });
      if (!j.botPresent) { if (!quiet) { S.err = 'Le bot n\'est pas encore sur ce serveur.'; render(); } return; }
      clearInterval(S.poll); S.err = '';
      S.info = j; S.doc = j.config;
      if (j.config) { S.cfg = { ...defaultCfg(), ...j.config }; S.step = 'status'; }
      else { await loadCombos(); S.cfg = defaultCfg(); S.cfg.forum = !!j.community; regenPlan(); S.step = 'form'; }
      render();
    } catch (e) {
      clearInterval(S.poll);
      // désinstallation en cours : écran de statut plutôt qu'une erreur sur l'écran d'invitation
      if (/Désinstallation en cours/.test(e.message)) { S.doc = { status: 'removing', channels: [], mode: 'existing', paused: false }; S.step = 'status'; S.err = ''; }
      else S.err = e.message;
      render();
    }
  },
  async edit() { await loadCombos(); S.cfg = { ...defaultCfg(), ...S.doc }; S.cfg.channels = JSON.parse(JSON.stringify(S.doc.channels || [])); S.step = 'form'; render(); },
  set(k, v) {
    const c = S.cfg;
    if (k === 'hideThreshold') v = Math.max(0, parseInt(v, 10) || 0);
    c[k] = v;
    if (k === 'mode') { c.channels = []; c.structure = 'default'; if (v === 'existing') c.channels = [{ name: '', type: 'text', categoryName: '', id: '', itemCats: [], paliers: [] }]; }
    if (['mode', 'structure', 'forum'].includes(k)) { if (k === 'structure' && v === 'custom') { c.structure = 'default'; regenPlan(); c.structure = 'custom'; } else regenPlan(); }
    render();
  },
  tgl(k, v) { S.cfg[k] = toggle(S.cfg[k], v); regenPlan(); render(); },
  setCh(i, k, v) {
    const ch = S.cfg.channels[i]; ch[k] = k === 'name' ? slug(v) : v;
    if (k === 'id') { const real = S.info.channels.find(x => x.id === v); if (real) { ch.name = real.name; ch.type = real.type === 15 ? 'forum' : 'text'; } }
    render();
  },
  skipCh(i, v) { S.cfg.channels[i].skip = v; render(); },
  setCat(gi, v) {
    const cats = [...new Set(S.cfg.channels.map(ch => ch.categoryName))], old = cats[gi];
    S.cfg.channels.forEach(ch => { if (ch.categoryName === old) ch.categoryName = String(v).trim().slice(0, 100); }); render();
  },
  tglCh(i, k, v) { S.cfg.channels[i][k] = toggle(S.cfg.channels[i][k], v); render(); },
  delCh(i) { S.cfg.channels.splice(i, 1); render(); },
  addCh() { S.cfg.channels.push({ name: S.cfg.mode === 'create' ? 'nouveau-salon' : '', type: S.cfg.forum ? 'forum' : 'text', categoryName: '', id: '', itemCats: [], paliers: [] }); render(); },
  toRecap() {
    const c = finalCfg(); S.err = '';
    if (c.mode === 'existing' && !c.channels.some(x => x.id)) S.err = 'Choisis au moins un salon existant.';
    else if (c.mode === 'create' && !c.channels.length) S.err = 'Le plan est vide : aucune combinaison ne correspond à tes filtres.';
    else if (c.mode === 'create' && c.channels.some(x => !slug(x.name))) S.err = 'Chaque salon doit avoir un nom.';
    else if (c.access === 'roles' && !c.roleIds.length) S.err = 'Choisis au moins un rôle (ou un autre accès).';
    if (S.err) { render(); return; }
    S.step = 'recap'; render();
  },
  async confirm() {
    S.busy = true; S.err = S.msg = ''; render();
    try {
      const j = await api('save', { guildId: S.guild.id, config: finalCfg() });
      S.doc = j.config;
      if (S.doc.mode === 'create' && S.doc.channels.some(c => c.name && !c.id)) await DG.makeChannels(true);
      S.msg = S.doc.status === 'pending' ? 'Inscription enregistrée. Elle doit être validée par l\'équipe du wiki.' : S.doc.status === 'approved' ? 'Modifications enregistrées et appliquées tout de suite (serveur déjà validé).' : 'Réglages enregistrés.';
      S.step = 'status';
    } catch (e) { S.err = e.message; }
    S.busy = false; render();
  },
  async makeChannels(inner) {
    const bar = () => document.getElementById('dg-bar');
    try {
      let total = null;
      for (let i = 0; i < 20; i++) {
        const j = await api('create_channels', { guildId: S.guild.id });
        S.doc = j.config;
        total ??= j.remaining + j.created;
        const b = bar(); if (b) { b.style.display = 'block'; b.firstElementChild.style.width = Math.round(100 * (1 - j.remaining / Math.max(1, total))) + '%'; }
        if (j.error) throw new Error(j.error);
        if (!j.remaining) break;
        await sleep(600);
      }
      if (!inner) { S.msg = 'Salons créés.'; render(); }
    } catch (e) { S.err = 'Création des salons : ' + e.message + ' Tu peux réessayer depuis la page de statut.'; if (!inner) render(); else throw e; }
  },
  async pause(p) { try { const j = await api('set_paused', { guildId: S.guild.id, paused: p }); S.doc = j.config; S.msg = p ? 'Envoi mis en pause.' : 'Envoi repris.'; S.err = ''; } catch (e) { S.err = e.message; } render(); },
  async purge() {
    if (!confirm('Supprimer TOUS les posts envoyés par le bot sur ce serveur ?\n\nL\'envoi est mis en pause ensuite (reprends-le quand tu veux : tout sera renvoyé si tu as choisi « tous les items »).')) return;
    try { const j = await api('purge', { guildId: S.guild.id }); S.doc = j.config; S.msg = 'Suppression demandée : le bot s\'en occupe sous quelques minutes.'; S.err = ''; } catch (e) { S.err = e.message; } render();
  },
  uninstallDlg() {
    const m = document.createElement('div'); m.className = 'dg-modal';
    m.innerHTML = `<div class="box"><h2>Désinstaller « ${esc(S.guild.name)} »</h2>
      <p>Le bot cesse d'envoyer, quitte le serveur et tes réglages sont effacés de notre base.</p>
      <label class="dg-opt"><input type="checkbox" id="un-ch"><span>Supprimer aussi les salons et catégories créés par le bot<small>Leurs posts disparaissent avec eux.</small></span></label>
      <label class="dg-opt"><input type="checkbox" id="un-po"><span>Supprimer tous les posts du bot (si les salons sont conservés)</span></label>
      <div class="dg-row"><button class="dg-btn" id="un-no">Annuler</button><button class="dg-btn danger" id="un-ok">Désinstaller</button></div></div>`;
    document.body.appendChild(m);
    m.querySelector('#un-no').onclick = () => m.remove();
    m.querySelector('#un-ok').onclick = async () => {
      const deleteChannels = m.querySelector('#un-ch').checked, deletePosts = m.querySelector('#un-po').checked; m.remove();
      try {
        S.msg = 'Désinstallation en cours…'; S.err = ''; render();
        let j;
        for (let i = 0; i < 60; i++) { // le worker travaille par paquets : on rappelle jusqu'à la fin
          j = await api('uninstall', { guildId: S.guild.id, deleteChannels, deletePosts });
          if (j.done || !j.progress) break;
          S.msg = `Désinstallation en cours… (reste ${j.left})`; render();
          await sleep(800);
        }
        if (j.done) { S.msg = 'Désinstallé : le bot a quitté le serveur.'; S.doc = null; S.guild = null; await refreshMe(); S.step = 'guild'; }
        else { S.msg = 'Désinstallation partiellement faite : relance « Désinstaller » pour terminer.'; S.doc = { ...S.doc, status: 'removing' }; }
      } catch (e) { S.err = e.message; }
      render();
    };
  },
};

async function refreshMe() { try { S.me = await api('me'); } catch (e) { S.err = e.message; } }

// ═══ Démarrage ═══
(async function init() {
  const h = new URLSearchParams(location.hash.slice(1));
  if (h.get('vcl-guild')) { S.session = h.get('vcl-guild'); sessionStorage.setItem(SESSION_KEY, S.session); history.replaceState(null, '', location.pathname + location.search); }
  await loadWikiMeta();
  if (!S.session) { render(); return; }
  await refreshMe();
  S.step = S.me ? 'guild' : 'login';
  render();
})();
})();
