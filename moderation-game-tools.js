// ══════════════════════════════════════════════════════
// OUTILS ÉVÉNEMENTS / DONJONS / TITRES / EFFETS (menus de l'Atelier et du Creator)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { getWorkerSecret, WORKER_URL, setHash: _setHash, showPanel: _showPanel, escHtml, db, COL, collection, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, serverTimestamp, writeBatch, sanitizeForFirestore, loadEventNames, toast, modal } = ctx;
const { normalize } = window.VCL;
const _EFFECT_SEED_TYPES = [
  { id:'heal',                 icon:'❤️',  color:'#e05252', label:'Points de vie',                        prefix:'+' },
  { id:'regen',                icon:'💓',  color:'#ce7b7b', label:'Régénération',                         prefix:'Régénération ' },
  { id:'mana',                 icon:'💧',  color:'#5b8dee', label:'Mana',                                 prefix:'+' },
  { id:'stamina',              icon:'👟',  color:'#f4d745', label:'Stamina',                              prefix:'+' },
  { id:'degats_attaque',       icon:'⚔️',  color:'#e7d189', label:'Force Accrue',                         prefix:"Boost les Dégâts d'Attaque de " },
  { id:'degats_physique',      icon:'💪',  color:'#eebe22', label:'Force Accrue',                         prefix:'Boost les Dégâts Physique de ' },
  { id:'degats_armes',         icon:'⚔️',  color:'#f36d14', label:'Force Accrue',                         prefix:"Boost les Dégâts d'Armes de " },
  { id:'degats_arcane',        icon:'🔮',  color:'#c24cda', label:'Puissance Arcanique',                  prefix:'Boost vos dégâts magiques de ' },
  { id:'boost_sante',          icon:'❤️',  color:'#d83c3c', label:'Santé Accrue',                         prefix:'Boost votre santé maximale de ' },
  { id:'boost_regen_vie',      icon:'💓',  color:'#e07171', label:'Régénération de Santé Accrue',         prefix:'Boost votre régénération de santé de ' },
  { id:'boost_mana',           icon:'💧',  color:'#3676ac', label:'Mana Accrue',                          prefix:'Boost votre mana maximale de ' },
  { id:'boost_regen_mana',     icon:'💦',  color:'#89c4fb', label:'Régénération de Mana Accrue',          prefix:'Boost votre régénération de mana de ' },
  { id:'boost_stamina',        icon:'👟',  color:'#ddb225', label:'Endurance Accrue',                     prefix:'Boost votre endurance maximale de ' },
  { id:'boost_regen_stamina',  icon:'💨',  color:'#ffe188', label:'Régénération de Stamina Accrue',       prefix:'Boost votre régénération de stamina de ' },
  { id:'coups_critique',       icon:'🎯',  color:'#d3b327', label:'Coup Critique',                        prefix:'Boost les Chances Critique de ' },
  { id:'degats_critique',      icon:'💢',  color:'#e4c84b', label:'Dégât Critique',                       prefix:'Boost vos dégâts critiques de ' },
  { id:'comp_coups_critique',  icon:'🎯',  color:'#d663cd', label:'Coup Critique de Compétence',          prefix:'Boost les Chances Critique de Compétence de ' },
  { id:'comp_degats_critique', icon:'💢',  color:'#b14299', label:'Dégât Critique de Compétence',         prefix:'Boost vos dégâts critiques de compétences de ' },
  { id:'vol_vie',              icon:'🩸',  color:'#db2727', label:'Soif de Sang',                         prefix:'Boost le Vol de Vie de ' },
  { id:'vitesse_deplacement',  icon:'🏃',  color:'#5f89fd', label:'Vitesse de Déplacement',               prefix:'Boost votre vitesse de ' },
  { id:'agilite',              icon:'💨',  color:'#b8c8f4', label:'Agilité',                              prefix:"Boost les chances d'Esquive de " },
  { id:'resistance_recul',     icon:'💨',  color:'#b8c8f4', label:'Résistance au Recul',                  prefix:'Boost votre résistance au recul de ' },
  { id:'blocage',     		   icon:'🛡️',  color:'#cdc0d6', label:'Blocage',                 				prefix:'Boost votre chance de blocage de ' },
  { id:'puissance_blocage',    icon:'💪',  color:'#e06c95', label:'Puissance du Blocage',                 prefix:'Boost votre puissance de blocage de ' },
  { id:'health_heal',          icon:'💓',  color:'#a01212', label:'Healing',                              prefix:'Vous rend ' },
  { id:'mana_heal',            icon:'💦',  color:'#247ca5', label:'Mana',                                 prefix:'Vous rend ' },
  { id:'stamina_heal',         icon:'💨',  color:'#e4c84b', label:'Stamina',                              prefix:'Vous rend ' },
  { id:'dexterite_attribut',   icon:'🏹',  color:'#e3cb5f', label:'Augmentation Dextérité',               prefix:"Augmente votre attribut de Dextérité de " },
  { id:'force_attribut',       icon:'⚔️',  color:'#d97f43', label:'Augmentation Force',                   prefix:"Augmente votre attribut de Force de " },
  { id:'esprit_attribut',      icon:'🌿',  color:'#62d435', label:"Augmentation Esprit",                  prefix:"Augmente votre attribut d'Esprit de " },
  { id:'intelligence_attribut',icon:'🔮',  color:'#a152a8', label:'Augmentation Intelligence',            prefix:"Augmente votre attribut d'Intelligence de " },
  { id:'vitalite_attribut',    icon:'❤️',  color:'#e91b1b', label:'Augmentation Vitalité',                prefix:"Augmente votre attribut de Vitalité de " },
  { id:'defense_attribut',     icon:'🛡️',  color:'#c7c7c7', label:'Augmentation Défense',                prefix:"Augmente votre attribut de Défense de " },
  { id:'resurection',          icon:'✳️',  color:'#4faa39', label:'Résurrection',                         prefix:'Vous permet de réanimer un camarade au combat dans les ' },
  { id:'feed',                 icon:'🍖',  color:'#8d520b', label:'Nourriture',                           prefix:'Restaure ' },
  { id:'saturation',           icon:'🍖',  color:'#cc4c11', label:'Saturation',                           prefix:'Offre ' },
  { id:'cooldown',             icon:'⏱️',  color:'#888888', label:'Cooldown',                             prefix:'' },
  { id:'use',                  icon:'🧪',  color:'#7db0ca', label:'Utilisations',                         prefix:'' },
  { id:'level',                icon:'❓',  color:'#c43c28', label:'Niveau Requis',                        prefix:'Niveau ' },
  { id:'reparation',           icon:'⚒️',  color:'#f0c137', label:'Réparation',                           prefix:'Réparation ' },
  { id:'durabilite',           icon:'⛏️',  color:'#5ad18a', label:'Durabilité',                           prefix:'Durabilité ' },
  { id:'puissance_recolte',    icon:'💪',  color:'#e86652', label:'Puissance de Récolte',                 prefix:'Puissance de Récolte ' },
];

const _EFFECT_SEED_TEMPLATES = [
  { label:'🍖 Nourriture',               effects:[{type:'feed',value:5}] },
  { label:'❤️ Potion de Soin',            effects:[{type:'level',value:1},{type:'heal',value:10,unit:'PV'},{type:'cooldown',value:15,unit:'s'},{type:'use',value:1}] },
  { label:'💧 Potion de Mana',            effects:[{type:'level',value:1},{type:'mana',value:10,unit:'Mana'},{type:'cooldown',value:15,unit:'s'},{type:'use',value:1}] },
  { label:'👟 Potion de Stamina',         effects:[{type:'level',value:1},{type:'stamina',value:5,unit:'Stamina'},{type:'cooldown',value:15,unit:'s'},{type:'use',value:1}] },
  { label:"💨 Fortifiant d'Endurance",    effects:[{type:'level',value:8},{type:'vitesse_deplacement',value:0.025,duration:900},{type:'boost_mana',value:5,duration:900},{type:'boost_stamina',value:2.5,duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
  { label:'📚 Fortifiant de Connaissance',effects:[{type:'level',value:8},{type:'degats_arcane',value:2,unit:'%',duration:900},{type:'comp_degats_critique',value:2,unit:'%',duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
  { label:'⚔️ Fortifiant de Férocité',   effects:[{type:'level',value:8},{type:'degats_attaque',value:2,unit:'%',duration:900},{type:'degats_critique',value:2,unit:'%',duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
  { label:'💓 Fortifiant de Vitalité',   effects:[{type:'level',value:8},{type:'boost_sante',value:10,duration:900},{type:'boost_regen_vie',value:0.2,unit:'/s',duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
  { label:'⏳ Fortifiant de Patience',   effects:[{type:'level',value:8},{type:'agilite',value:2,unit:'%',duration:900},{type:'boost_regen_mana',value:0.2,unit:'/s',duration:900},{type:'boost_regen_stamina',value:0.1,unit:'/s',duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
  { label:'🛡️ Fortifiant de Résistance', effects:[{type:'level',value:8},{type:'resistance_recul',value:2,unit:'%',duration:900},{type:'blocage',value:2,unit:'%',duration:900},{type:'puissance_blocage',value:2,unit:'%',duration:900},{type:'cooldown',value:3600,unit:'s'},{type:'use',value:1}] },
];

// ── EVENTS TOOL ──────────────────────────────────────
window.showEventsTool = async function() {
  _setHash('events-tool');
  _showPanel('events-tool-panel', 'btn-events-tool');
  await _loadEventsList();
};

async function _loadEventsList() {
  const list = document.getElementById('events-list');
  if (!list) return;
  list.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const docs = await _sortedEventDocs();
    if (!docs.length) {
      list.innerHTML = '<div class="empty" style="color:var(--muted);">Aucun event. Créez-en un ci-dessus.</div>';
      return;
    }
    list.innerHTML = docs.map((d, i) => {
      const ev = d.data();
      const safeName = escHtml(ev.name || d.id);
      return `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;">
        <span style="font-size:13px;display:flex;align-items:center;gap:8px;">
          <input type="text" value="${escHtml(ev.emoji || '')}" placeholder="🎊" title="Emoji affiché dans le Compendium (vide = 🎊)" onchange="setVclEventEmoji('${d.id}', this.value)" style="width:44px;height:30px;text-align:center;font-size:16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);outline:none;" />
          ${safeName}
        </span>
        <span style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost btn-sm" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="moveVclEvent('${d.id}',-1)" style="font-size:12px;">▲</button>
          <button class="btn btn-ghost btn-sm" title="Descendre" ${i === docs.length - 1 ? 'disabled' : ''} onclick="moveVclEvent('${d.id}',1)" style="font-size:12px;">▼</button>
        <button class="btn btn-danger btn-sm" onclick="deleteVclEvent('${d.id}','${safeName.replace(/'/g, '\\\'')}')" style="font-size:12px;">🗑️ Supprimer</button>
        </span>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

// Events triés comme EVENT_NAMES : `ordre` puis date de création
async function _sortedEventDocs() {
  const snap = await getDocs(collection(db, COL.events));
  const ts = d => d.data().createdAt?.seconds ?? 0;
  return [...snap.docs].sort((a, b) => (a.data().ordre ?? 1e9) - (b.data().ordre ?? 1e9) || ts(a) - ts(b));
}

window.moveVclEvent = async function(id, dir) {
  try {
    const docs = await _sortedEventDocs();
    const i = docs.findIndex(d => d.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= docs.length) return;
    [docs[i], docs[j]] = [docs[j], docs[i]];
    const batch = writeBatch(db);
    docs.forEach((d, k) => { if (d.data().ordre !== k + 1) batch.update(d.ref, { ordre: k + 1 }); });
    await batch.commit();
    await loadEventNames();
    await _loadEventsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// Ordre d'affichage d'un nouvel event (après les existants) ; EVENT_NAMES est rechargé après chaque création/suppression
async function _nextEventOrdre() {
  const snap = await getDocs(collection(db, COL.events));
  return snap.docs.reduce((m, d) => Math.max(m, d.data().ordre ?? 0), 0) + 1;
}

// Emoji d'un event (Compendium) : on ne garde que le 1er caractère « visuel » saisi ; vide = emoji par défaut
window.setVclEventEmoji = async function(id, value) {
  const v = (value || '').trim();
  const emoji = v ? ([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)][0]?.segment || '') : '';
  try {
    const batch = writeBatch(db);
    batch.update(doc(db, COL.events, id), { emoji });
    await batch.commit();
    toast(emoji ? `Emoji : ${emoji}` : 'Emoji par défaut (🎊)', 'success');
    await loadEventNames();
    await _loadEventsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// ── WORLDBOSS TOOL : emoji de chaque world boss (config/worldboss_emojis : { nom: emoji }, lu par le Compendium) ──
const _WB_EMOJI_REF = () => doc(db, 'config', 'worldboss_emojis');
const _readWbEmojis = async () => { const s = await getDoc(_WB_EMOJI_REF()); return s.exists() ? s.data() : {}; };

window.showWorldbossTool = async function() {
  _setHash('worldboss-tool');
  _showPanel('worldboss-tool-panel', 'btn-worldboss-tool');
  await _loadWorldbossList();
};

async function _loadWorldbossList() {
  const list = document.getElementById('worldboss-list');
  if (!list) return;
  list.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap, emojis] = await Promise.all([getDocs(collection(db, COL.mobs)), _readWbEmojis()]);
    const names = [...new Set(snap.docs.map(d => d.data()).filter(m => String(m.type || '').toLowerCase() === 'worldboss' && m.name).map(m => m.name))]
      .sort((a, b) => a.localeCompare(b, 'fr'));
    if (!names.length) {
      list.innerHTML = '<div class="empty" style="color:var(--muted);">Aucun world boss. Crée un mob de type WorldBoss dans le Creator.</div>';
      return;
    }
    list.innerHTML = names.map(n => {
      const safe = escHtml(n);
      return `<div style="display:flex;align-items:center;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;">
        <span style="font-size:13px;display:flex;align-items:center;gap:8px;">
          <input type="text" value="${escHtml(emojis[n] || '')}" placeholder="☠️" title="Emoji affiché dans le Compendium (vide = ☠️)" data-name="${safe}" onchange="setVclWorldbossEmoji(this.dataset.name, this.value)" style="width:44px;height:30px;text-align:center;font-size:16px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);outline:none;" />
          ${safe}
        </span>
      </div>`;
    }).join('');
  } catch(e) {
    list.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

window.setVclWorldbossEmoji = async function(name, value) {
  const v = (value || '').trim();
  const emoji = v ? ([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(v)][0]?.segment || '') : '';
  try {
    const emojis = await _readWbEmojis();
    if (emoji) emojis[name] = emoji; else delete emojis[name];
    await setDoc(_WB_EMOJI_REF(), emojis);
    toast(emoji ? `Emoji : ${emoji}` : 'Emoji par défaut (☠️)', 'success');
    await loadEventNames();
    await _loadWorldbossList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// ── FORGERONS SECRETS TOOL : config/secret_forgerons { hidden, pnj: [ids], items: [ids], revealedPnj: [ids], revealedItems: [ids] } (absent = position cachée ; lu par store.js) ──
// revealedPnj / revealedItems = PNJ / items révélés un par un (visibles même quand le secret global est actif).
// pnj / items = ajouts manuels : en plus des PNJ détectés par tag/type, ces PNJ sont cachés et l'obtain de ces items est remplacé.
const _SF_REF = () => doc(db, 'config', 'secret_forgerons');
const _sfAuto = p => ['fabricant_secrets', 'fabricant_secret', 'forgeron_items_secrets'].includes(p.tag)
  || ["forgeron d'items secrets", 'fabricant secret'].includes(String(p.type || '').toLowerCase());
const _sf = { cfg: { hidden: true, pnj: [], items: [], revealedPnj: [], revealedItems: [] }, pnj: [], items: [] };
const _sfList = (c, k) => Array.isArray(c[k]) ? c[k] : [];

async function _sfSave(patch) {
  const next = { ..._sf.cfg, ...patch };
  await setDoc(_SF_REF(), { hidden: next.hidden !== false, pnj: next.pnj || [], items: next.items || [], revealedPnj: next.revealedPnj || [], revealedItems: next.revealedItems || [] });
  _sf.cfg = next;
}

window.showSecretForgerons = async function() {
  _setHash('secret-forgerons');
  _showPanel('secret-forgerons-panel', 'btn-secret-forgerons');
  await _loadSecretForgerons();
};

async function _loadSecretForgerons() {
  const body = document.getElementById('secret-forgerons-body');
  if (!body) return;
  body.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [pSnap, iSnap, cfg] = await Promise.all([getDocs(collection(db, COL.pnj)), getDocs(collection(db, COL.items)), getDoc(_SF_REF())]);
    const c = cfg.exists() ? cfg.data() : {};
    _sf.cfg = { hidden: c.hidden !== false, pnj: _sfList(c, 'pnj'), items: _sfList(c, 'items'), revealedPnj: _sfList(c, 'revealedPnj'), revealedItems: _sfList(c, 'revealedItems') };
    _sf.pnj = pSnap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));
    _sf.items = iSnap.docs.map(d => ({ ...d.data(), id: d.data().id ?? d.id }));
    _renderSecretForgerons();
  } catch (e) {
    body.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

const _sfRow = (label, sub, btn) => `<div style="padding:8px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:13px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
    <span>${label}</span><span style="display:flex;align-items:center;gap:10px;color:var(--muted);font-size:12px;">${sub}${btn}</span></div>`;
const _sfRevealBtn = (kind, id) => {
  const revealed = _sf.cfg[kind === 'pnj' ? 'revealedPnj' : 'revealedItems'].includes(id);
  return `<button class="btn btn-ghost" data-id="${escHtml(id)}" onclick="sfToggleReveal('${kind}', this.dataset.id)" style="font-size:11px;padding:2px 8px;${revealed ? 'color:var(--success, #4caf50);border-color:var(--success, #4caf50);' : ''}" title="${revealed ? 'Visible — cliquer pour recacher' : 'Caché — cliquer pour révéler'}">${revealed ? '🔓 Révélé' : '🔒 Révéler'}</button>`;
};
const _sfRemoveBtn = (kind, id) => `<button class="btn btn-ghost" data-id="${escHtml(id)}" onclick="sfRemove('${kind}', this.dataset.id)" style="font-size:11px;padding:2px 8px;" title="Retirer de la liste secrète">✕</button>`;
const _sfSearchBox = (kind, ph) => `<input type="text" id="sf-search-${kind}" oninput="sfSearch('${kind}')" placeholder="${ph}" style="width:100%;box-sizing:border-box;margin:8px 0 4px;padding:8px 10px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);outline:none;font-size:13px;" /><div id="sf-results-${kind}" style="display:flex;flex-direction:column;gap:4px;"></div>`;

function _renderSecretForgerons() {
  const body = document.getElementById('secret-forgerons-body');
  if (!body) return;
  const hidden = _sf.cfg.hidden !== false;
  const manualPnj = new Set(_sf.cfg.pnj);
  const auto = _sf.pnj.filter(p => _sfAuto(p) && !manualPnj.has(p.id)).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
  const byId = (list, ids) => ids.map(id => list.find(x => x.id === id) || { id, name: id + ' (introuvable)' });
  const region = p => escHtml(String(p.region || '').replace(/_/g, ' '));
  const pnjRows = [
    ...auto.map(p => _sfRow(escHtml(p.name || p.id), `${region(p)} · auto (tag/type)`, _sfRevealBtn('pnj', p.id))),
    ...byId(_sf.pnj, _sf.cfg.pnj).map(p => _sfRow(escHtml(p.name || p.id), `${region(p)} · ajouté`, _sfRevealBtn('pnj', p.id) + _sfRemoveBtn('pnj', p.id))),
  ].join('') || '<div class="empty" style="color:var(--muted);">Aucun PNJ.</div>';
  const itemRows = byId(_sf.items, _sf.cfg.items).map(i => _sfRow(escHtml(i.name || i.id), escHtml(i.id), _sfRevealBtn('items', i.id) + _sfRemoveBtn('items', i.id))).join('')
    || '<div class="empty" style="color:var(--muted);">Aucun item ajouté.</div>';
  const kept = k => document.getElementById('sf-search-' + k)?.value || '';
  const [sp, si] = [kept('pnj'), kept('items')];
  body.innerHTML = `<div style="display:flex;align-items:center;gap:12px;margin-bottom:18px;">
      <span style="font-size:14px;font-weight:700;color:${hidden ? 'var(--danger)' : 'var(--success, #4caf50)'};">${hidden ? '🔒 Secret actif — positions cachées' : '🔓 Secret levé — positions visibles'}</span>
      <button class="btn ${hidden ? 'btn-primary' : 'btn-ghost'}" onclick="setSecretForgeronsHidden(${!hidden})" style="font-size:12px;">${hidden ? '🔓 Révéler les forgerons' : '🔒 Réactiver le secret'}</button>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:6px;">🧑 PNJ secrets <span style="color:var(--muted);font-weight:400;">— cachés de la carte et du bestiaire ; leur obtain est remplacé</span></div>
    <div style="display:flex;flex-direction:column;gap:6px;">${pnjRows}</div>
    ${_sfSearchBox('pnj', 'Ajouter un PNJ (nom)…')}
    <div style="font-size:13px;font-weight:700;margin:20px 0 6px;">📦 Items secrets <span style="color:var(--muted);font-weight:400;">— leur obtain est remplacé par « Forgeron d'items secret - Position cachée pour l'instant »</span></div>
    <div style="display:flex;flex-direction:column;gap:6px;">${itemRows}</div>
    ${_sfSearchBox('items', 'Ajouter un item (nom)…')}`;
  document.getElementById('sf-search-pnj').value = sp;
  document.getElementById('sf-search-items').value = si;
  window.sfSearch('pnj'); window.sfSearch('items');
}

window.sfSearch = function(kind) {
  const q = normalize(document.getElementById('sf-search-' + kind)?.value.trim() || '');
  const el = document.getElementById('sf-results-' + kind);
  if (!el) return;
  if (!q) { el.innerHTML = ''; return; }
  const taken = new Set(kind === 'pnj' ? _sf.cfg.pnj : _sf.cfg.items);
  const matches = (kind === 'pnj' ? _sf.pnj : _sf.items)
    .filter(x => !taken.has(x.id) && !(kind === 'pnj' && _sfAuto(x)) && (normalize(x.name || '').includes(q) || normalize(x.id || '').includes(q)))
    .slice(0, 12);
  el.innerHTML = matches.map(x => _sfRow(escHtml(x.name || x.id), kind === 'pnj' ? escHtml(String(x.region || '').replace(/_/g, ' ')) : escHtml(x.id),
    `<button class="btn btn-ghost" data-id="${escHtml(x.id)}" onclick="sfAdd('${kind}', this.dataset.id)" style="font-size:11px;padding:2px 8px;color:var(--danger);border-color:var(--danger);">🔒 Rendre secret</button>`)).join('')
    || '<div class="empty" style="color:var(--muted);font-size:12px;">Aucun résultat.</div>';
};

window.sfAdd = async function(kind, id) {
  const key = kind === 'pnj' ? 'pnj' : 'items';
  if (_sf.cfg[key].includes(id)) return;
  try {
    await _sfSave({ [key]: [..._sf.cfg[key], id] });
    toast('Ajouté à la liste secrète.', 'success');
    _renderSecretForgerons();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.sfToggleReveal = async function(kind, id) {
  const key = kind === 'pnj' ? 'revealedPnj' : 'revealedItems';
  const on = _sf.cfg[key].includes(id);
  try {
    await _sfSave({ [key]: on ? _sf.cfg[key].filter(x => x !== id) : [..._sf.cfg[key], id] });
    toast(on ? 'Recaché.' : 'Révélé.', 'success');
    _renderSecretForgerons();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.sfRemove = async function(kind, id) {
  const key = kind === 'pnj' ? 'pnj' : 'items';
  try {
    await _sfSave({ [key]: _sf.cfg[key].filter(x => x !== id) });
    toast('Retiré de la liste secrète.', 'success');
    _renderSecretForgerons();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.setSecretForgeronsHidden = async function(hidden) {
  if (!hidden && !await modal.confirm('Révéler les forgerons d\'items secrets ?\n\nIls réapparaissent sur la carte et dans le bestiaire, et leur position est de nouveau affichée dans l\'obtain.')) return;
  try {
    await _sfSave({ hidden: !!hidden });
    toast(hidden ? 'Secret actif : positions cachées.' : 'Secret levé : positions visibles.', 'success');
    _renderSecretForgerons();
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

// ── DISCORD TOOL : serveur, salons, quoi poster (config/discord_routes) ──
//   { enabled, hideThreshold, guildId, plans: { <serveur>: [salons] }, channels: [salons du serveur actif] }
//   salon = { name, type: 'forum'|'text', categoryId?, categoryName?, id?, itemCats: [catégories d'items], paliers: [paliers] }
// Un salon reçoit les items dont la catégorie ET le palier correspondent (liste vide = tous) ; le plus précis gagne.
// « Créer / répertorier » : pour chaque salon du plan, retrouve la catégorie / le salon existant sur le serveur (par nom) ou le crée, et mémorise son ID.
const _DR_REF = () => doc(db, 'config', 'discord_routes');
const _DR_CATS = [['arme', '⚔️ Armes', 'armes'], ['armure', '🛡️ Armures', 'armures'], ['accessoire', '💍 Accessoires', 'accessoires'], ['outils', '🛠️ Outils', 'outils'], ['rune', '🔮 Runes', 'runes'], ['consommable', '🧪 Consommables', 'consommables'],
  ['nourriture', '🍖 Nourriture', 'nourriture'], ['materiaux', '🧱 Matériaux', 'materiaux'], ['ressources', '⛏️ Ressources', 'ressources'], ['parchemin', '📃 Parchemins', 'parchemins'], ['quete', '📜 Quête', 'quete'], ['donjon', '🏰 Donjon', 'donjon'], ['monnaie', '🪙 Monnaie', 'monnaie']];
let _dr = { enabled: true, hideThreshold: 10, guildId: '', plans: {}, channels: [], createdByBot: {} };
let _drItems = [], _drPaliers = [], _drGuilds = [], _drGuildChans = [], _drGuildErr = '', _drPostCounts = {}, _drBusyMsg = '';

async function _drCall(action, payload = {}) {
  const r = await fetch(WORKER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: await getWorkerSecret(), action, guildId: _dr.guildId || undefined, ...payload }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.message || j.error || ('Discord ' + r.status));
  return j;
}
async function _drDel(id) {
  const r = await _drCall('delete_thread', { threadId: id });
  if (r && r.status && ![200, 204, 404].includes(r.status)) throw new Error('Discord ' + r.status);
}
const _drNoteCreated = (kind, id) => {
  const g = (_dr.createdByBot[_dr.guildId] ??= { channels: [], categories: [] });
  if (!g[kind].includes(id)) g[kind].push(id);
};
const _drSleep = ms => new Promise(r => setTimeout(r, ms));

window.showDiscordRoutes = async function() {
  _setHash('discord-routes');
  _showPanel('discord-routes-panel', 'btn-discord-routes');
  const body = document.getElementById('discord-routes-body');
  body.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [cfg, pal] = await Promise.all([getDoc(_DR_REF()), getDoc(doc(db, 'config', 'paliers'))]);
    const c = cfg.exists() ? cfg.data() : {};
    // actif par défaut ; migration unique (autoDefaultApplied) pour un envoi automatique laissé désactivé avant ce changement
    _dr = { enabled: c.enabled !== false || c.autoDefaultApplied !== true, hideThreshold: Number.isFinite(c.hideThreshold) ? c.hideThreshold : 10, guildId: c.guildId || '', plans: c.plans && typeof c.plans === 'object' ? c.plans : {}, channels: Array.isArray(c.channels) ? c.channels : [], createdByBot: c.createdByBot && typeof c.createdByBot === 'object' ? c.createdByBot : {} };
    _drPaliers = (pal.exists() && Array.isArray(pal.data().paliers) ? pal.data().paliers : []);
    if (c.autoDefaultApplied !== true) await _drPersist(); // migration unique : l'envoi automatique est actif par défaut (le bot lit cette valeur)
    if (!_drPaliers.length) _drPaliers = [{ id: 1, label: 'Palier 1' }, { id: 2, label: 'Palier 2' }, { id: 3, label: 'Palier 3' }, { id: 'event', label: 'Event' }, { id: 'worldboss', label: 'World Boss' }];
    try { _drItems = (await getDocs(collection(db, COL.items))).docs.map(d => d.data()); } catch { _drItems = []; }
    try { _drGuilds = await _drCall('get_bot_guilds'); _drGuildErr = ''; } catch (e) { _drGuilds = []; _drGuildErr = e.message; }
    await _drLoadGuildChans();
    _renderDiscordRoutes();
    window.discordRenderSync(); // actions manuelles (module Discord chargé à la demande)
    window.dgLoadGuilds();
  } catch (e) { body.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`; }
};

let _drAccess = {}; // id de salon → true (utilisable) / message d'erreur
async function _drLoadGuildChans() {
  _drGuildChans = [];
  _drAccess = {};
  if (!_dr.guildId) return;
  try {
    _drGuildChans = await _drCall('get_guild_channels');
    _drGuildErr = '';
  } catch (e) { _drGuildErr = e.message; }
  // Salons déjà présents sur le serveur (créés par le formulaire d'inscription, à la main…) mais pas encore liés au plan : reconnus par nom, type et catégorie, sans rien créer
  if (_drGuildChans.length) {
    const used = new Set(_dr.channels.map(c => c.id).filter(Boolean));
    let linked = 0;
    for (const c of _dr.channels) {
      if (c.id && _drGuildChans.some(x => x.id === c.id)) continue;
      const name = _drSlug(c.name); if (!name) continue;
      const wantCat = c.categoryName ? _drCats().find(k => _drKey(k.name) === _drKey(c.categoryName)) : null;
      if (c.categoryName && !wantCat) continue; // la catégorie n'existe pas : le salon non plus
      const ex = _drGuildChans.find(x => x.type === _drTypeNum(c) && !used.has(x.id) && _drKey(x.name) === _drKey(name) && (!wantCat || x.parent_id === wantCat.id));
      if (ex) { c.id = ex.id; if (wantCat) c.categoryId = wantCat.id; used.add(ex.id); linked++; }
    }
    if (linked) { try { await _drSave(); toast(`${linked} salon(s) déjà présent(s) sur le serveur reconnu(s) et lié(s) au plan.`, 'success', 6000); } catch { /* sera relié au prochain chargement */ } }
  }
  const toCheck = _dr.channels.filter(c => c.id && _drGuildChans.some(x => x.id === c.id)).map(c => c.id);
  for (let i = 0; i < toCheck.length; i += 5) { // 5 à la fois
    await Promise.all(toCheck.slice(i, i + 5).map(async id => {
      try { const ch = await _drCall('get_channel', { channelId: id }); _drAccess[id] = ch && ch.id ? true : 'réponse vide'; }
      catch (e) { _drAccess[id] = e.message || 'inaccessible'; }
    }));
  }
  try {
    const snap = await getDocs(collection(db, 'discord_posts'));
    _drPostCounts = {};
    snap.docs.forEach(d => { const ch = d.data().channelId; if (ch) _drPostCounts[ch] = (_drPostCounts[ch] || 0) + 1; });
  } catch { _drPostCounts = {}; }
}

const _drSave = () => { if (_dr.guildId) _dr.plans[_dr.guildId] = _dr.channels; return setDoc(_DR_REF(), { autoDefaultApplied: true, enabled: _dr.enabled, hideThreshold: _dr.hideThreshold, guildId: _dr.guildId, plans: _dr.plans, channels: _dr.channels, createdByBot: _dr.createdByBot }); };
const _drPersist = async () => { try { await _drSave(); } catch (e) { toast('Erreur : ' + e.message, 'error'); } };
const _drField = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:12px;outline:none;';
const _drChip = (on, label, onclick) => `<button type="button" onclick="${onclick}" style="font-size:11px;padding:3px 9px;border-radius:12px;cursor:pointer;border:1px solid ${on ? 'var(--accent)' : 'var(--border)'};background:${on ? 'rgba(224,172,96,.18)' : 'var(--surface2)'};color:${on ? 'var(--accent)' : 'var(--muted)'};">${label}</button>`;
// Salon réellement présent sur le serveur ? Si la liste des salons n'a pas pu être lue, on ne contredit pas l'id mémorisé.
const _drAlive = c => !!c.id && ((_drGuildErr && !_drGuildChans.length) || (_drGuildChans.some(x => x.id === c.id) && _drAccess[c.id] !== undefined && _drAccess[c.id] === true));
// raison quand ce n'est pas « en place » (pour l'infobulle et le texte)
const _drWhy = c => !c.id ? 'pas encore créé' : !_drGuildChans.some(x => x.id === c.id) ? 'introuvable sur le serveur (supprimé ?)' : _drAccess[c.id] === true ? '' : 'le bot ne peut pas ouvrir ce salon (' + (_drAccess[c.id] || 'accès non vérifié') + ')';
const _drCats = () => _drGuildChans.filter(x => x.type === 4).sort((a, b) => a.position - b.position);
// Nom envoyé à Discord : espaces -> tirets, caractères interdits retirés. Discord met en minuscules les lettres ASCII d'un salon (pas celles d'une catégorie) :
// les majuscules des salons passent par des lettres Unicode « grasses » (𝗔𝗿𝗺𝗲𝘀), comme le nom d'un serveur en police spéciale.
const _drSlug = n => String(n || '').trim().replace(/\s+/g, '-').replace(/[\\/#@:*?"<>|`]/g, '');
// Clé de comparaison (retrouver un salon / une catégorie existants) : NFKC ramène 𝗔𝗿𝗺𝗲𝘀 à « armes », sans emoji ni séparateurs
const _drKey = n => String(n || '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9àâäçéèêëîïôöùûüœ]/g, '');
const _drFancy = text => [...String(text).normalize('NFD')].map(ch => {
  const c = ch.codePointAt(0);
  if (c >= 65 && c <= 90) return String.fromCodePoint(0x1D5D4 + c - 65);
  if (c >= 97 && c <= 122) return String.fromCodePoint(0x1D5EE + c - 97);
  if (c >= 48 && c <= 57) return String.fromCodePoint(0x1D7EC + c - 48);
  return ch;
}).join('');
const _drCap = t => String(t).replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toUpperCase());
const _DR_PAL_EMOJI = { '1': '🌱', '2': '🔥', '3': '🌲', event: '🎉', worldboss: '🌍', '-1': '📦' };
// Style « Veilleurs » : salon = emoji・𝗡𝗼𝗺 ; catégorie = emoji NOM EN MAJUSCULES
const _drStyleChannel = (emoji, name) => `${emoji ? emoji + '・' : ''}${_drFancy(_drCap(name))}`;
const _drStyleCategory = palier => `${_DR_PAL_EMOJI[String(palier)] || '📁'} ${_drPalLabel(palier).toUpperCase()}`;
const _drTypeNum = c => c.type === 'text' ? 0 : 15;
const _drPalLabel = id => (_drPaliers.find(p => String(p.id) === String(id)) || {}).label || String(id);

function _drTree() {
  if (!_dr.guildId) return '';
  if (_drGuildErr && !_drGuildChans.length) return `<div style="font-size:12px;color:var(--danger);margin-bottom:10px;">Serveur illisible (${escHtml(_drGuildErr)}). Le worker est-il redéployé et le bot présent sur ce serveur ?</div>`;
  const linked = new Set(_dr.channels.map(c => c.id).filter(Boolean));
  const icon = t => t === 15 ? '🗂' : t === 0 ? '#' : t === 5 ? '📢' : '•';
  const chip = x => `<span style="display:inline-block;margin:2px 4px 2px 0;padding:2px 8px;border-radius:10px;font-size:11px;background:var(--surface2);border:1px solid ${linked.has(x.id) ? 'var(--success, #4caf50)' : 'var(--border)'};color:${linked.has(x.id) ? 'var(--success, #4caf50)' : 'var(--muted)'};" title="${linked.has(x.id) ? 'Répertorié dans le plan' : 'Non répertorié'}">${icon(x.type)} ${escHtml(x.name)}${_drPostCounts[x.id] ? ` · ${_drPostCounts[x.id]} posts` : ''}${linked.has(x.id) ? ' ✓' : ''}</span>`;
  const real = _drGuildChans.filter(x => x.type !== 4);
  const cats = _drCats();
  const rows = cats.map(k => `<div style="margin-bottom:4px;"><strong style="font-size:12px;">📁 ${escHtml(k.name)}</strong> ${real.filter(x => x.parent_id === k.id).sort((a, b) => a.position - b.position).map(chip).join('') || '<span style="color:var(--muted);font-size:11px;">vide</span>'}</div>`).join('');
  const orphans = real.filter(x => !x.parent_id || !cats.some(k => k.id === x.parent_id));
  return `<div style="border:1px solid var(--border);border-radius:8px;padding:10px 14px;margin-bottom:14px;background:var(--surface);">
    <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Sur le serveur <span style="color:var(--muted);font-weight:400;">(${cats.length} catégorie(s), ${real.length} salon(s) — vert = répertorié)</span></div>
    ${rows || ''}${orphans.length ? `<div><strong style="font-size:12px;">Sans catégorie</strong> ${orphans.map(chip).join('')}</div>` : ''}
    ${!cats.length && !orphans.length ? '<div style="color:var(--muted);font-size:12px;">Serveur vide.</div>' : ''}</div>`;
}

const _drCount = c => {
  const cats = c.itemCats || [], pal = (c.paliers || []).map(String);
  return _drItems.filter(i => (!cats.length || cats.includes(i.category)) && (!pal.length || pal.includes(String(i.palier))) && !(Number(i.palier) === -1 && !pal.includes('-1'))).length;
};
const _drStep = (n, title, sub) => `<div style="display:flex;align-items:baseline;gap:10px;margin:26px 0 10px;"><span style="display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:50%;background:var(--accent);color:#1a1208;font-weight:800;font-size:13px;flex-shrink:0;">${n}</span><span style="font-size:15px;font-weight:700;">${title}</span><span style="font-size:12px;color:var(--muted);">${sub || ''}</span></div>`;
const _drBtn = (label, fn, kind = '') => {
  const style = kind === 'primary' ? 'border-color:var(--accent);color:var(--accent);font-weight:700;' : kind === 'danger' ? 'color:var(--danger);border-color:var(--danger);' : '';
  return `<button class="btn btn-ghost" onclick="${fn}" style="font-size:12px;padding:6px 12px;${style}">${label}</button>`;
};

// Liste des salons du plan : groupée par catégorie Discord (repliée), une ligne compacte par salon ; réglages détaillés dans « ⚙️ » (dépliable)
let _drOpenRows = new Set(), _drOpenGroups = new Set(), _drView = { pal: '', todo: false };
const _drGroupKey = c => c.categoryName || (c.categoryId && (_drCats().find(k => k.id === c.categoryId) || {}).name) || '— sans catégorie —';

function _drDetail(c, i) { // réglages détaillés d'un salon (type, catégorie, quoi envoyer)
  const cats = _drCats();
  const catSel = `<select onchange="drSetCategory(${i}, this.value)" title="Catégorie Discord où ranger ce salon" style="${_drField}">
      <option value="">📁 sans catégorie</option>
      ${cats.map(k => `<option value="id:${escHtml(k.id)}" ${c.categoryId === k.id ? 'selected' : ''}>📁 ${escHtml(k.name)}</option>`).join('')}
      ${c.categoryName && !c.categoryId ? `<option value="__new__" selected>📁 ${escHtml(c.categoryName)} (sera créée)</option>` : ''}
      <option value="__prompt__">➕ Nouvelle catégorie…</option></select>`;
  const group = (title, key, options) => `<div style="flex:1;min-width:260px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-bottom:5px;"><span>${title}</span><a href="#" onclick="drClear(${i}, '${key}');return false;" style="color:var(--muted);">tout effacer</a></div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">${options}</div></div>`;
  const itemChips = _DR_CATS.map(([k, l]) => _drChip((c.itemCats || []).includes(k), l, `drToggle(${i}, 'itemCats', '${k}')`)).join(' ');
  const palChips = _drPaliers.map(p => _drChip((c.paliers || []).map(String).includes(String(p.id)), escHtml(p.label || String(p.id)), `drToggle(${i}, 'paliers', '${escHtml(String(p.id))}')`)).join(' ');
  return `<div style="margin:4px 0 10px 26px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface2);">
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
      <select onchange="drSet(${i}, 'type', this.value)" style="${_drField}" ${c.id ? 'disabled title="Le type ne peut pas changer après la création"' : ''}><option value="forum" ${c.type !== 'text' ? 'selected' : ''}>🗂 Forum (un fil par item)</option><option value="text" ${c.type === 'text' ? 'selected' : ''}># Salon texte</option></select>
      ${catSel}
      ${_drAlive(c) ? '' : `<input type="text" inputmode="numeric" placeholder="ou colle l'ID d'un salon existant" onchange="drLink(${i}, this.value)" style="${_drField}width:230px;font-family:monospace;">`}
    </div>
    <div style="display:flex;gap:18px;flex-wrap:wrap;">
      ${group('Catégories d\'items <em>(aucune = toutes)</em>', 'itemCats', itemChips)}
      ${group('Paliers <em>(aucun = tous)</em>', 'paliers', palChips)}
    </div></div>`;
}

function _drRow(c, i) {
  const alive = _drAlive(c);
  const catLabels = (c.itemCats || []).map(k => (_DR_CATS.find(q => q[0] === k) || [0, k])[1]);
  const palLabels = (c.paliers || []).map(_drPalLabel);
  const n = _drCount(c);
  const ib = (icon, title, fn, danger) => `<button class="btn btn-ghost" title="${title}" onclick="${fn}" style="padding:2px 8px;font-size:12px;${danger ? 'color:var(--danger);border-color:var(--danger);' : ''}">${icon}</button>`;
  const skipped = !!c.skip && !alive;
  const actions = (skipped
    ? ib('↩️', 'Réactiver ce salon (il redevient « à traiter »)', `drSkip(${i}, false)`)
    : alive
    ? ib('📤', 'Envoyer toute la data de ce salon', `drSendChannel(${i}, 'all')`) + ib('➕', 'Envoyer seulement les manquants', `drSendChannel(${i}, 'missing')`) + ib('🧹', 'Vider ce salon (supprime ses posts)', `drClearChannel(${i})`, true)
    : ib(c.id ? '🔁' : '✨', c.id ? 'Recréer ce salon (introuvable sur Discord)' : 'Créer ce salon', `drCreate(${i})`) + ib('🚫', 'Ignorer : je ne veux pas de ce salon (non créé, plus compté « à traiter »)', `drSkip(${i}, true)`))
    + ib('⚙️', 'Réglages de ce salon', `drToggleRow(${i})`) + ib('🗑', 'Retirer du plan', `drRemove(${i})`);
  return `<div style="display:flex;align-items:center;gap:8px;padding:3px 0;">
      <span title="${alive ? 'En place : le bot peut utiliser ce salon' : skipped ? 'Ignoré (non voulu)' : escHtml(_drWhy(c))}">${alive ? '🟢' : skipped ? '⚪' : '🟠'}</span>
      <input type="text" value="${escHtml(c.name || '')}" placeholder="nom-du-salon" onchange="drSet(${i}, 'name', this.value)" style="${_drField}width:190px;font-weight:700;">
      <span style="flex:1;min-width:0;font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${escHtml(catLabels.join(', ') + ' · ' + palLabels.join(', '))}">${catLabels.length ? catLabels.join(', ') : 'toutes catégories'} · ${palLabels.length ? palLabels.join(', ') : 'tous paliers'} · <strong style="color:var(--accent);">${n} item${n > 1 ? 's' : ''}</strong>${alive && _drPostCounts[c.id] ? ` · ${_drPostCounts[c.id]} posts` : ''}${skipped ? ' · <span style="color:var(--muted);">ignoré (non voulu)</span>' : !alive ? ` · <span style="color:#e0a24c;">${escHtml(_drWhy(c))}</span>` : ''}</span>
      <span style="display:flex;gap:4px;flex:none;">${actions}</span>
    </div>${_drOpenRows.has(i) ? _drDetail(c, i) : ''}`;
}

function _drList() {
  if (!_dr.channels.length) return '<div class="empty" style="color:var(--muted);">Aucun salon dans le plan. « Proposer un plan » en crée un à partir des items (une catégorie par palier, un forum par type d\'item).</div>';
  const palIds = [...new Set(_dr.channels.flatMap(c => (c.paliers || []).map(String)))];
  const view = _drView;
  const filterRow = `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;"><span style="font-size:11px;color:var(--muted);">Afficher :</span>
      ${_drChip(!view.pal && !view.todo, 'Tout', 'drView(\'\', false)')}
      ${palIds.map(p => _drChip(view.pal === p, escHtml(_drPalLabel(p)), `drView('${escHtml(p)}', false)`)).join('')}
      ${_drChip(view.todo, '⚠️ À traiter (pas en place)', 'drView(\'\', true)')}</div>`;
  const idx = _dr.channels.map((c, i) => i).filter(i => { const c = _dr.channels[i]; return !(view.todo && (_drAlive(c) || c.skip)) && !(view.pal && !(c.paliers || []).map(String).includes(view.pal)); });
  const groups = new Map();
  idx.forEach(i => { const k = _drGroupKey(_dr.channels[i]); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); });
  if (!idx.length) return filterRow + '<div class="empty" style="color:var(--muted);">Aucun salon ne correspond à ce filtre.</div>';
  return filterRow + [...groups].map(([k, list]) => {
    const alive = list.filter(i => _drAlive(_dr.channels[i])).length, ign = list.filter(i => _dr.channels[i].skip && !_drAlive(_dr.channels[i])).length, todo = list.length - alive - ign;
    return `<details data-k="${escHtml(k)}" ontoggle="drGroupToggled(this)" ${_drOpenGroups.has(k) || view.todo || view.pal ? 'open' : ''} style="border:1px solid var(--border);border-radius:8px;margin-bottom:8px;background:var(--surface);">
      <summary style="cursor:pointer;padding:8px 12px;font-size:13px;font-weight:700;">${escHtml(k)} <span style="font-weight:400;font-size:12px;color:var(--muted);">— ${list.length} salon${list.length > 1 ? 's' : ''} · ${alive} en place${todo ? ` · <span style="color:#e0a24c;">${todo} à traiter</span>` : ''}${ign ? ` · ${ign} ignoré${ign > 1 ? 's' : ''}` : ''}</span></summary>
      <div style="padding:2px 12px 8px;">${list.map(i => _drRow(_dr.channels[i], i)).join('')}</div></details>`;
  }).join('');
}
window.drSkip = async (i, v) => { _dr.channels[i].skip = !!v; await _drPersist(); _renderDiscordRoutes(); };
window.drToggleRow = i => { _drOpenRows.has(i) ? _drOpenRows.delete(i) : _drOpenRows.add(i); _renderDiscordRoutes(); };
window.drView = (pal, todo) => { _drView = { pal, todo }; _renderDiscordRoutes(); };
window.drGroupToggled = el => { const k = el.dataset.k; if (el.open) _drOpenGroups.add(k); else _drOpenGroups.delete(k); };

function _renderDiscordRoutes() {
  const body = document.getElementById('discord-routes-body');
  const guildSel = `<select onchange="drSetGuild(this.value)" style="${_drField}min-width:280px;font-weight:700;font-size:14px;">
      <option value="">— choisis un serveur Discord —</option>
      ${_drGuilds.map(g => `<option value="${escHtml(g.id)}" ${g.id === _dr.guildId ? 'selected' : ''}>${escHtml(g.name)}</option>`).join('')}</select>`;
  const intro = `<div style="font-size:12px;color:var(--muted);line-height:1.6;margin-bottom:6px;">Le bot poste chaque item du wiki dans un salon Discord, avec sa carte image. Choisis le serveur, prépare les salons, puis envoie. Ensuite, chaque item approuvé est posté (ou remplacé) tout seul si l'envoi automatique est actif.</div>`;
  let html = intro + _drStep(1, 'Serveur', 'où le bot doit poster') + `<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">${guildSel}
      ${_drGuildErr && !_drGuilds.length ? `<span style="font-size:12px;color:var(--danger);">Serveurs illisibles (${escHtml(_drGuildErr)}) — le worker est-il à jour ?</span>` : ''}</div>`;
  if (!_dr.guildId) { body.innerHTML = html + '<div class="empty" style="color:var(--muted);margin-top:14px;">Choisis un serveur pour voir ce qui y est déjà en place et le configurer.</div>'; return; }

  const real = _drGuildChans.filter(x => x.type !== 4).length, ncat = _drCats().length;
  const ready = _dr.channels.filter(_drAlive).length, ignored = _dr.channels.filter(c => c.skip && !_drAlive(c)).length;
  html += `<details style="margin-top:12px;"><summary style="cursor:pointer;font-size:12px;color:var(--accent);">👀 Voir ce qui existe déjà sur ce serveur (${ncat} catégories, ${real} salons)</summary><div style="margin-top:8px;">${_drTree()}</div></details>`;
  html += _drStep(2, 'Salons', `${_dr.channels.length - ignored} dans le plan · ${ready} en place${ignored ? ` · ${ignored} ignoré${ignored > 1 ? 's' : ''}` : ''}`);
  html += `<div id="discord-setup-msg" style="font-size:12px;color:var(--accent);min-height:18px;margin-bottom:8px;">${escHtml(_drBusyMsg)}</div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      ${_drBtn('📋 Proposer un plan', 'drDefaultPlan()')}
      ${_drBtn('🎨 Style Veilleurs (majuscules + emojis)', 'drRestyle()')}
      ${_drBtn('➕ Ajouter un salon', 'drAdd()')}
      ${_drBtn('✨ Créer tous les salons manquants', 'drReconcile()', 'primary')}
    </div>
    ${_drList()}`;
  html += _drStep(3, 'Envoi', 'poster les items dans leurs salons') + `
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;">
      ${_drBtn('🚀 Tout mettre en place (salons + envoi)', 'drSetupAll()', 'primary')}
      ${_drBtn('📤 Envoyer les items manquants (tous salons)', 'discordSendMissing()')}
    </div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface);">
      <span style="font-size:14px;font-weight:700;color:${_dr.enabled ? 'var(--success, #4caf50)' : 'var(--muted)'};">${_dr.enabled ? '🟢 Envoi automatique actif' : '⚪ Envoi automatique désactivé'}</span>
      <button class="btn ${_dr.enabled ? 'btn-ghost' : 'btn-primary'}" onclick="setDiscordEnabled(${!_dr.enabled})" style="font-size:12px;">${_dr.enabled ? '⏸ Désactiver' : '▶ Activer'}</button>
      <span style="font-size:12px;color:var(--muted);">Quand un item est approuvé, il est posté (ou remplacé) dans son salon.</span>
    </div>
    <div style="font-size:12px;margin-top:12px;">🤫 Avant un envoi de plus de <input type="text" inputmode="numeric" value="${_dr.hideThreshold}" onchange="drSetThreshold(this.value)" style="${_drField}width:56px;text-align:center;"> items dans un salon, le masquer aux membres (évite les pings), puis le rétablir. <span style="color:var(--muted);">0 = jamais · nécessite « Gérer les rôles ».</span></div>`;
  html += `<details style="margin-top:30px;border:1px solid var(--danger);border-radius:8px;padding:10px 14px;"><summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--danger);">🧨 Zone de danger — désinstaller sur ce serveur</summary>
      <div style="font-size:12px;color:var(--muted);margin:10px 0;line-height:1.5;">Supprime tous les posts du bot sur ce serveur, <strong>uniquement les salons et catégories que le bot a lui-même créés</strong> (les salons existants seulement « répertoriés » ne sont jamais supprimés ; une catégorie créée par le bot n'est supprimée que si elle est vide ensuite), efface le plan de ce serveur, puis fait <strong>quitter le serveur au bot</strong>. Irréversible.</div>
      ${_drBtn('🧨 Tout supprimer et quitter le serveur', 'drUninstall()', 'danger')}</details>`;
  body.innerHTML = html;
}

window.drClear = async (i, k) => { _dr.channels[i][k] = []; await _drPersist(); _renderDiscordRoutes(); };
window.drSendChannel = async (i, mode) => {
  const c = _dr.channels[i];
  if (!c.id) { toast('Crée d\'abord le salon.', 'warning'); return; }
  if (mode === 'missing') await window.discordSendMissing(c.id); else await window.discordResendChannel(c.id);
  await _drLoadGuildChans(); _renderDiscordRoutes();
};
window.drClearChannel = async (i) => { await window.discordDeleteChannelPosts(_dr.channels[i].id); await _drLoadGuildChans(); _renderDiscordRoutes(); };

// ── SERVEURS INSCRITS (page publique Discord/discord.html) : collection discord_guilds ──
// Rien ne s'envoie avant « Valider » ; le chef de serveur peut mettre en pause / désinstaller de son côté. Le bot (bot/discord-guilds.js) lit cette collection via le worker.
const _DG_STATUS = { pending: ['⏳ En attente', 'var(--accent)'], approved: ['🟢 Validé', 'var(--success, #4caf50)'], refused: ['⛔ Refusé', 'var(--danger)'], suspended: ['⏸ Suspendu', 'var(--danger)'], removing: ['🧹 Désinstallation', 'var(--muted)'] };
window.dgLoadGuilds = async () => {
  const el = document.getElementById('discord-guilds-body');
  if (!el) return;
  try {
    const snap = await getDocs(collection(db, 'discord_guilds'));
    const list = snap.docs.map(d => ({ _id: d.id, ...d.data() })).sort((a, b) => (a.status === 'pending' ? 0 : 1) - (b.status === 'pending' ? 0 : 1) || String(a.guildName).localeCompare(String(b.guildName), 'fr'));
    const b = (label, fn, extra = '') => `<button class="btn btn-ghost" data-id="${escHtml(label[1])}" onclick="${fn}" style="font-size:11px;padding:2px 8px;${extra}">${label[0]}</button>`;
    el.innerHTML = `<div style="font-size:15px;font-weight:700;margin-bottom:4px;">🌐 Serveurs inscrits (${list.length}) <span style="font-size:11px;color:var(--muted);font-weight:400;">· au-delà de 100 serveurs Discord exige la vérification du bot</span></div>
      <p style="font-size:12px;color:var(--muted);margin-bottom:10px;">Ils s'inscrivent eux-mêmes sur la page <a href="Discord/discord.html" target="_blank" style="color:var(--accent);">Discord/discord.html</a>. Aucun envoi avant validation. Le chef de serveur garde sa pause / sa désinstallation.</p>
      ${list.map(g => { const [lbl, col] = _DG_STATUS[g.status] || [g.status, 'var(--muted)']; const id = g._id;
        return `<div data-row="${escHtml(id)}" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 12px;margin-bottom:6px;background:var(--surface);border:1px solid var(--border);border-radius:8px;font-size:12px;">
          <strong style="min-width:180px;">${escHtml(g.guildName || id)}</strong><span style="color:${col};">${lbl}${g.paused ? ' · en pause (chef)' : ''}</span>${g.modifiedAfterApproval ? ' <span style="color:var(--accent);border:1px solid var(--accent);border-radius:10px;padding:1px 8px;" title="Le chef de serveur a changé ses réglages depuis ta validation (appliqué tout de suite). Ouvre l\'historique pour voir.">✏️ modifié après validation</span>' : ''}
          <span style="color:var(--muted);">par ${escHtml(g.ownerName || '?')} · ${g.channels?.length || 0} salon(s) · ${g.mode === 'create' ? 'salons créés' : 'salons existants'} · ${g.posted || 0} post(s)${g.pending ? ' (+' + g.pending + ' en attente)' : ''}</span>
          ${g.pending ? `<span title="${g.posted || 0} envoyés sur ${(g.posted || 0) + g.pending}" style="display:inline-block;width:140px;height:8px;background:var(--surface2);border:1px solid var(--border);border-radius:4px;overflow:hidden;vertical-align:middle;"><i style="display:block;height:100%;width:${Math.round(100 * (g.posted || 0) / ((g.posted || 0) + g.pending))}%;background:var(--accent);"></i></span><span style="color:var(--muted);">${Math.round(100 * (g.posted || 0) / ((g.posted || 0) + g.pending))}% · ${g.posted || 0}/${(g.posted || 0) + g.pending}</span>` : ''}
          ${g.lastError ? `<span style="color:var(--danger);" title="${escHtml(g.lastError)}">⚠️ erreur</span>` : ''}
          <span style="margin-left:auto;display:flex;gap:6px;">
          ${g.status !== 'approved' && g.status !== 'removing' ? b(['✅ Valider', id], `dgSetStatus(this.dataset.id,'approved')`) : ''}
          ${g.status === 'pending' ? b(['⛔ Refuser', id], `dgSetStatus(this.dataset.id,'refused')`, 'color:var(--danger);border-color:var(--danger);') : ''}
          ${g.status === 'approved' ? b(['⏸ Suspendre', id], `dgSetStatus(this.dataset.id,'suspended')`) : ''}
          ${g.modifiedAfterApproval ? b(['👍 Vu', id], 'dgAck(this.dataset.id)') : ''}
          ${b(['📜 Historique', id], 'dgToggleLog(this.dataset.id)')}
          ${g.status === 'removing' ? b(['🧽 Effacer la fiche', id], 'dgForgetGuild(this.dataset.id)', 'color:var(--danger);border-color:var(--danger);') : b(['🗑 Retirer', id], 'dgRemoveGuild(this.dataset.id)', 'color:var(--danger);border-color:var(--danger);')}</span></div>`; }).join('') || '<div style="color:var(--muted);font-size:12px;">Aucun serveur inscrit.</div>'}`;
    // envoi en cours : la liste se rafraîchit toute seule (barre de progression)
    clearTimeout(window._dgTimer);
    if (list.some(g => g.pending > 0 && g.status === 'approved') && document.getElementById('discord-guilds-body')) window._dgTimer = setTimeout(() => { if (!document.querySelector('[id^="dg-log-"]')) window.dgLoadGuilds(); }, 10000);
  } catch (e) { el.innerHTML = `<div style="color:var(--danger);font-size:12px;">Serveurs inscrits illisibles : ${escHtml(e.message)}</div>`; }
};
// Historique d'un serveur : actions réellement faites (worker, bot, modération)
window.dgToggleLog = async (id) => {
  const box = document.getElementById('dg-log-' + id);
  if (box) { box.remove(); return; }
  const row = document.querySelector(`[data-row="${id}"]`);
  if (!row) return;
  const s = await getDoc(doc(db, 'discord_guilds', id));
  const d = s.exists() ? s.data() : {};
  const fmt = t => new Date(t).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const lines = (d.log || []).slice().reverse().map(x => `<div><span style="color:var(--muted);">${fmt(x.t)}</span> ${escHtml(x.m)}</div>`).join('') || '<div style="color:var(--muted);">Aucune action enregistrée pour l\'instant.</div>';
  row.insertAdjacentHTML('afterend', `<div id="dg-log-${escHtml(id)}" style="margin:-2px 0 8px 12px;padding:8px 12px;font-size:11px;line-height:1.7;background:var(--surface2);border:1px solid var(--border);border-radius:8px;max-height:260px;overflow:auto;">
    ${(d.posted || 0) + (d.pending || 0) ? (() => { const tot = (d.posted || 0) + (d.pending || 0), pct = Math.round(100 * (d.posted || 0) / tot); return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;margin-bottom:3px;"><span>Envoi : ${d.posted || 0} / ${tot} posts</span><span>${pct} %</span></div><div style="height:8px;background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden;"><i style="display:block;height:100%;width:${pct}%;background:var(--accent);"></i></div></div>`; })() : ''}
    ${d.lastError ? `<div style="color:var(--danger);">Dernière erreur : ${escHtml(d.lastError)}</div>` : ''}${lines}</div>`);
};
window.dgAck = async (id) => {
  try {
    const s = await getDoc(doc(db, 'discord_guilds', id));
    if (s.exists()) await setDoc(doc(db, 'discord_guilds', id), _dgLogAdd({ ...s.data(), modifiedAfterApproval: false }, 'Modification vue par la modération'));
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  window.dgLoadGuilds();
};
const _dgLogAdd = (d, m) => ({ ...d, log: [...(d.log || []), { t: Date.now(), m }].slice(-60) });
window.dgSetStatus = async (id, status) => {
  try {
    const s = await getDoc(doc(db, 'discord_guilds', id));
    if (!s.exists()) throw new Error('serveur introuvable');
    await setDoc(doc(db, 'discord_guilds', id), _dgLogAdd({ ...s.data(), status, modifiedAfterApproval: false }, { approved: 'Validé par la modération', refused: 'Refusé par la modération', suspended: 'Suspendu par la modération' }[status] || ('Statut : ' + status)));
    if (status === 'approved') {
      // lance le bot tout de suite (sinon : prochain passage, 10 min au plus)
      let res = '';
      try { res = (await (await fetch(WORKER_URL + '/guild/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: await getWorkerSecret(), action: 'trigger', guildId: id }) })).json()).result; } catch { /* prochain passage */ }
      toast(res === 'started' ? 'Serveur validé : le bot est lancé, les envois commencent dans ~20 s.' : 'Serveur validé : le bot enverra au prochain passage (10 min au plus).', 'success');
    } else toast('Statut mis à jour.', 'success');
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  window.dgLoadGuilds();
};
// Désinstallation restée bloquée (ancienne demande jamais traitée) : efface seulement la fiche ; le bot reste sur le serveur tant qu'il n'est pas retiré
window.dgForgetGuild = async (id) => {
  if (!await modal.confirm('Effacer la fiche de ce serveur ?\n\nLe bot ne nettoie rien et ne quitte pas le serveur (à faire à la main si besoin).')) return;
  try { await deleteDoc(doc(db, 'discord_guilds', id)); toast('Fiche effacée.', 'success'); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  window.dgLoadGuilds();
};
// « Retirer » : désinstallation immédiate faite par le worker (paquets de 40 appels Discord, on rappelle jusqu'à la fin) :
// posts supprimés, salons créés par le bot supprimés si demandé, le bot quitte le serveur, la fiche est effacée.
window.dgRemoveGuild = async (id) => {
  if (!await modal.confirm('Retirer ce serveur ?\n\nLe bot supprime ses posts, quitte le serveur et la fiche est effacée.')) return;
  const deleteChannels = await modal.confirm('Supprimer aussi les salons et catégories créés par le bot ?\n\nOK = oui, Annuler = les garder.');
  const bar = document.getElementById('discord-guilds-body');
  try {
    let j;
    for (let i = 0; i < 60; i++) {
      j = await (await fetch(WORKER_URL + '/guild/bot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: await getWorkerSecret(), action: 'uninstall', guildId: id, deleteChannels, deletePosts: true }) })).json();
      if (j.error) throw new Error(j.error);
      if (j.done || !j.progress) break;
      toast('Désinstallation en cours… (reste ' + j.left + ')', 'info', 1500);
      await _drSleep(800);
    }
    toast(j.done ? 'Serveur retiré : le bot a quitté le serveur.' : 'Retrait partiel : relance « Retirer » pour terminer.', j.done ? 'success' : 'warning');
  } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  window.dgLoadGuilds();
};

const _drMsg = t => { _drBusyMsg = t; const el = document.getElementById('discord-setup-msg'); if (el) el.textContent = t; };

window.drSetGuild = async (id) => {
  if (_dr.guildId) _dr.plans[_dr.guildId] = _dr.channels; // le plan de l'ancien serveur est conservé
  _dr.guildId = id;
  _dr.channels = id && Array.isArray(_dr.plans[id]) ? _dr.plans[id] : [];
  await _drPersist();
  _drMsg('Lecture du serveur…');
  await _drLoadGuildChans();
  _drMsg('');
  _renderDiscordRoutes();
  window.discordRenderSync();
};
window.drSetThreshold = async (v) => { const n = parseInt(v, 10); _dr.hideThreshold = Number.isFinite(n) && n >= 0 ? n : 10; await _drPersist(); _renderDiscordRoutes(); };
window.drAdd = async () => { _dr.channels.push({ name: '', type: 'forum', itemCats: [], paliers: [] }); await _drPersist(); _renderDiscordRoutes(); };
window.drSet = async (i, k, v) => {
  const c = _dr.channels[i];
  c[k] = String(v).trim();
  if (k === 'name' && c.id && c.name) {
    try { await _drCall('patch_channel', { channelId: c.id, patch: { name: _drSlug(c.name) } }); toast('Salon renommé sur Discord.', 'success'); }
    catch (e) { toast('Renommage Discord impossible : ' + e.message, 'error', 8000); }
  }
  await _drPersist(); _renderDiscordRoutes();
};

// Remet au style Veilleurs les salons du plan pas encore créés (un seul type d'item et un seul palier)
window.drRestyle = async () => {
  let n = 0;
  for (const c of _dr.channels) {
    if (c.id || (c.itemCats || []).length !== 1) continue;
    const [, label] = _DR_CATS.find(q => q[0] === c.itemCats[0]) || [0, '📦 ' + c.itemCats[0]];
    const [emoji, ...words] = label.split(' ');
    c.name = _drStyleChannel(emoji, words.join(' '));
    if (!c.categoryId && (c.paliers || []).length === 1) c.categoryName = _drStyleCategory(c.paliers[0]);
    n++;
  }
  await _drPersist(); _renderDiscordRoutes();
  toast(n ? `${n} salon(s) mis au style Veilleurs (majuscules + emojis). Les salons déjà créés ne changent pas.` : 'Aucun salon à restyler (les salons déjà créés ne changent pas).', n ? 'success' : 'info', 7000);
};
window.drSetCategory = async (i, v) => {
  const c = _dr.channels[i];
  if (v === '__prompt__') { const n = (prompt('Nom de la nouvelle catégorie Discord :') || '').trim(); if (!n) { _renderDiscordRoutes(); return; } c.categoryId = ''; c.categoryName = n; }
  else if (v.startsWith('id:')) { c.categoryId = v.slice(3); c.categoryName = ''; }
  else if (v === '__new__') { /* inchangé */ }
  else { c.categoryId = ''; c.categoryName = ''; }
  await _drPersist(); _renderDiscordRoutes();
};
window.drToggle = async (i, k, v) => {
  const list = (_dr.channels[i][k] || []).map(String);
  _dr.channels[i][k] = list.includes(v) ? list.filter(x => x !== v) : [...list, v];
  await _drPersist(); _renderDiscordRoutes();
};
window.drLink = async (i, v) => {
  v = String(v).trim();
  if (!/^\d{15,25}$/.test(v)) { toast('ID invalide (chiffres : clic droit sur le salon → Copier l\'identifiant).', 'error'); return; }
  _dr.channels[i].id = v; await _drPersist(); _renderDiscordRoutes();
};
window.drRemove = async (i) => {
  if (!await modal.confirm('Retirer ce salon du plan ?\n\nLe salon Discord et ses posts ne sont pas supprimés.')) return;
  _dr.channels.splice(i, 1); await _drPersist(); _renderDiscordRoutes(); window.discordRenderSync();
};

// Plan par défaut : une catégorie Discord par palier, un forum par catégorie d'items qui a des items à ce palier (l'archive est exclue)
window.drDefaultPlan = async () => {
  const snap = await getDocs(collection(db, COL.items));
  const combos = new Map();
  snap.docs.forEach(d => { const x = d.data(); if (!x.category || x.palier == null || Number(x.palier) === -1) return; combos.set(`${x.category}|${x.palier}`, [x.category, String(x.palier)]); });
  const palierOrder = p => { const i = _drPaliers.findIndex(q => String(q.id) === p); return i < 0 ? 999 : i; };
  const catOrder = c => { const i = _DR_CATS.findIndex(q => q[0] === c); return i < 0 ? 999 : i; };
  const wanted = [...combos.values()].sort((a, b) => palierOrder(a[1]) - palierOrder(b[1]) || catOrder(a[0]) - catOrder(b[0]));
  let added = 0;
  for (const [cat, pal] of wanted) {
    if (_dr.channels.some(c => (c.itemCats || []).join() === cat && (c.paliers || []).map(String).join() === pal)) continue;
    const [, label] = _DR_CATS.find(q => q[0] === cat) || [0, '📦 ' + cat];
    const [emoji, ...words] = label.split(' ');
    _dr.channels.push({ name: _drStyleChannel(emoji, words.join(' ')), type: 'forum', categoryName: _drStyleCategory(pal), itemCats: [cat], paliers: [pal] });
    added++;
  }
  await _drPersist(); _renderDiscordRoutes();
  toast(added ? `${added} salon(s) ajouté(s) au plan (une catégorie par palier). Retire ou modifie ce que tu ne veux pas, puis « Créer / répertorier ».` : 'Le plan couvre déjà tous les items.', added ? 'success' : 'info', 8000);
};

// Retrouve (par nom) ou crée la catégorie puis le salon d'une entrée du plan, et mémorise leur ID
async function _drEnsure(c) {
  const byId = new Map(_drGuildChans.map(x => [x.id, x]));
  if (c.id && !byId.has(c.id)) c.id = ''; // supprimé sur Discord : on le recrée
  if (c.id) return false;
  const name = _drSlug(c.name);
  if (!name) throw new Error('nom de salon requis');
  let parentId = c.categoryId && byId.has(c.categoryId) ? c.categoryId : '';
  if (!parentId && c.categoryName) {
    const known = _drCats().find(k => _drKey(k.name) === _drKey(c.categoryName));
    if (known) parentId = known.id;
    else { const k = await _drCall('create_channel', { name: c.categoryName, type: 4 }); _drGuildChans.push(k); parentId = k.id; _drNoteCreated('categories', k.id); await _drSleep(400); }
  }
  c.categoryId = parentId;
  const type = _drTypeNum(c);
  const existing = _drGuildChans.find(x => x.type === type && _drKey(x.name) === _drKey(name) && (x.parent_id || '') === parentId)
    || (!parentId ? _drGuildChans.find(x => x.type === type && _drKey(x.name) === _drKey(name)) : null);
  if (existing) { c.id = existing.id; return 'adopté'; }
  const ch = await _drCall('create_channel', { name, type, parentId: parentId || undefined });
  _drGuildChans.push(ch); c.id = ch.id; _drNoteCreated('channels', ch.id);
  await _drSleep(400);
  return 'créé';
}

window.drReconcile = async () => {
  if (!_dr.guildId) { toast('Choisis un serveur.', 'warning'); return false; }
  const todo = _dr.channels.filter(c => c.name && !(c.skip && !_drAlive(c)));
  if (!todo.length) { toast('Le plan est vide : « Plan par défaut » ou « Ajouter un salon ».', 'warning'); return false; }
  _drMsg('Lecture du serveur…');
  await _drLoadGuildChans();
  let made = 0, adopted = 0, failed = 0;
  for (const [n, c] of todo.entries()) {
    _drMsg(`Salons : ${n + 1}/${todo.length} (${c.name})…`);
    try { const r = await _drEnsure(c); if (r === 'créé') made++; else if (r === 'adopté') adopted++; await _drSave(); }
    catch (e) { failed++; toast(`« ${c.name} » : ${e.message} (le bot a-t-il « Gérer les salons » ?)`, 'error', 9000); }
  }
  await _drLoadGuildChans();
  _drMsg(`Salons : ${made} créé(s), ${adopted} retrouvé(s), ${failed} échec(s).`);
  _renderDiscordRoutes();
  window.discordRenderSync();
  return failed === 0;
};

window.drSetupAll = async () => {
  if (!_dr.guildId) { toast('Choisis d\'abord un serveur.', 'warning'); return; }
  const gname = (_drGuilds.find(g => g.id === _dr.guildId) || {}).name || _dr.guildId;
  const planned = _dr.channels.length;
  if (!await modal.confirm(`Tout mettre en place sur « ${gname} » ?\n\n1. ${planned ? `${planned} salon(s) du plan` : 'plan par défaut (une catégorie par palier, un forum par catégorie d\'items)'} : catégories et salons créés s'ils n'existent pas, retrouvés sinon\n2. envoi de tous les items qui n'ont pas encore de post\n\nL'envoi peut durer longtemps (garde cet onglet ouvert, tu peux l'arrêter).`)) return;
  if (!_dr.channels.length) await window.drDefaultPlan();
  if (!await window.drReconcile()) { toast('Création des salons incomplète : envoi des items annulé.', 'warning'); return; }
  await window.discordSendMissing();
};

window.drCreate = async (i) => {
  try { await _drLoadGuildChans(); const r = await _drEnsure(_dr.channels[i]); await _drSave(); toast(r ? `Salon « ${_dr.channels[i].name} » ${r}.` : 'Déjà répertorié.', 'success'); }
  catch (e) { toast('Création impossible : ' + e.message + ' (le bot a-t-il « Gérer les salons » ?)', 'error', 8000); }
  await _drLoadGuildChans(); _renderDiscordRoutes(); window.discordRenderSync();
};

window.drUninstall = async () => {
  if (!_dr.guildId) { toast('Choisis un serveur.', 'warning'); return; }
  const gname = (_drGuilds.find(g => g.id === _dr.guildId) || {}).name || _dr.guildId;
  await _drLoadGuildChans();
  const inGuild = new Set(_drGuildChans.map(x => x.id));
  const mine = _dr.createdByBot[_dr.guildId] || { channels: [], categories: [] };
  const delChannels = mine.channels.filter(id => inGuild.has(id));
  const delCats = mine.categories.filter(id => inGuild.has(id));
  const snap = await getDocs(collection(db, 'discord_posts'));
  const posts = snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(p => inGuild.has(p.channelId));
  const survivors = posts.filter(p => !delChannels.includes(p.channelId)); // posts dans des salons conservés : supprimés un par un
  if (!await modal.confirm(`Désinstaller sur « ${gname} » ? Seront supprimés : ${posts.length} post(s) du bot, ${delChannels.length} salon(s) créé(s) par le bot, ${delCats.length} catégorie(s) créée(s) par le bot (si elles sont vides). Le plan de ce serveur sera effacé et le bot quittera le serveur. Les autres salons ne sont pas touchés. Irréversible.`)) return;
  const typed = (prompt(`Serveur : ${gname}\n\nPour confirmer la suppression, tape le mot SUPPRIMER :`) || '').trim();
  if (typed.toUpperCase() !== 'SUPPRIMER') { toast('Mot de confirmation différent : désinstallation annulée.', 'warning'); return; }
  const fails = [];
  try {
    for (const [n, p] of survivors.entries()) {
      _drMsg(`Suppression des posts : ${n + 1}/${survivors.length}…`);
      try { if (p.threadId) await _drDel(p.threadId); await deleteDoc(doc(db, 'discord_posts', p._id)); } catch (e) { fails.push('post ' + (p.itemName || p._id)); }
      await _drSleep(500);
    }
    for (const [n, id] of delChannels.entries()) {
      _drMsg(`Suppression des salons : ${n + 1}/${delChannels.length}…`);
      try { await _drDel(id); } catch (e) { fails.push('salon ' + id); }
      await _drSleep(500);
    }
    for (const p of posts.filter(p => delChannels.includes(p.channelId))) { try { await deleteDoc(doc(db, 'discord_posts', p._id)); } catch {} } // suivi des posts partis avec leurs salons
    await _drLoadGuildChans(); // catégories créées par le bot : supprimées seulement si vides
    for (const id of delCats) {
      if (_drGuildChans.some(x => x.parent_id === id)) { fails.push('catégorie non vide conservée'); continue; }
      try { await _drDel(id); } catch (e) { fails.push('catégorie ' + id); }
      await _drSleep(500);
    }
    _drMsg('Le bot quitte le serveur…');
    await _drCall('leave_guild', { guildId: _dr.guildId });
  } catch (e) { fails.push(e.message); }
  delete _dr.createdByBot[_dr.guildId];
  delete _dr.plans[_dr.guildId];
  _dr.channels = []; _dr.guildId = '';
  await _drPersist();
  try { _drGuilds = await _drCall('get_bot_guilds'); } catch { _drGuilds = []; }
  _drGuildChans = []; _drMsg('');
  toast(fails.length ? `Désinstallé avec ${fails.length} souci(s) : ${fails.slice(0, 3).join(', ')}` : 'Désinstallé : posts, salons et catégories du bot supprimés, le bot a quitté le serveur.', fails.length ? 'warning' : 'success', 10000);
  _renderDiscordRoutes(); window.discordRenderSync();
};

window.setDiscordEnabled = async function(on) {
  if (on && !await modal.confirm('Activer l\'envoi automatique ?\n\nChaque item approuvé en soumission sera posté (ou remplacé) dans son salon, avec sa carte. Les items déjà publiés ne sont pas envoyés (utilise « Envoyer les items manquants »).')) return;
  _dr.enabled = !!on;
  await _drPersist();
  toast(on ? 'Envoi automatique activé.' : 'Envoi automatique désactivé.', 'success');
  _renderDiscordRoutes();
};

window.createVclEvent = async function() {
  const inp = document.getElementById('event-name-input');
  const name = inp?.value?.trim();
  if (!name) { toast('Nom de l\'event requis.', 'error'); return; }
  const data = { name, createdAt: serverTimestamp(), ordre: await _nextEventOrdre() };
  try {
    await addDoc(collection(db, COL.events), data);
    if (inp) inp.value = '';
    toast(`Event créé : ${name}`, 'success');
    await loadEventNames();
    await _loadEventsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.deleteVclEvent = async function(id, name) {
  const ok = await modal.confirm(`Supprimer l'event "${name}" ?`, { danger: true, confirmLabel: 'Supprimer' });
  if (!ok) return;
  try {
    await deleteDoc(doc(db, COL.events, id));
    toast('Event supprimé.', 'success');
    await loadEventNames();
    await _loadEventsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// ── DONJONS TOOL (sources d'obtention « Donjon » du Creator) ──
// Stockés dans config/donjons_loot : { list: [{ id, name }] } (l'ordre du tableau = ordre d'affichage).
const _DONJONS_REF = () => doc(db, 'config', 'donjons_loot');

async function _readDonjonsLoot() {
  const snap = await getDoc(_DONJONS_REF());
  return snap.exists() ? (snap.data().list || []).filter(d => d?.id && d?.name) : [];
}
const _writeDonjonsLoot = list => setDoc(_DONJONS_REF(), { list });

window.showDonjonsTool = async function() {
  _setHash('donjons-tool');
  _showPanel('donjons-tool-panel', 'btn-donjons-tool');
  await _loadDonjonsList();
};

async function _loadDonjonsList() {
  const el = document.getElementById('donjons-list');
  if (!el) return;
  el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const list = await _readDonjonsLoot();
    if (!list.length) {
      el.innerHTML = '<div class="empty" style="color:var(--muted);">Aucun donjon. Créez-en un ci-dessus.</div>';
      return;
    }
    el.innerHTML = list.map((d, i) => `<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;">
        <span style="font-size:13px;">🏰 ${escHtml(d.name)} <code style="font-size:10px;color:var(--muted);margin-left:6px;">${escHtml(d.id)}</code></span>
        <span style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost btn-sm" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="moveVclDonjon('${escHtml(d.id)}',-1)" style="font-size:12px;">▲</button>
          <button class="btn btn-ghost btn-sm" title="Descendre" ${i === list.length - 1 ? 'disabled' : ''} onclick="moveVclDonjon('${escHtml(d.id)}',1)" style="font-size:12px;">▼</button>
          <button class="btn btn-danger btn-sm" onclick="deleteVclDonjon('${escHtml(d.id)}')" style="font-size:12px;">🗑️ Supprimer</button>
        </span>
      </div>`).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

window.createVclDonjon = async function() {
  const inp = document.getElementById('donjon-name-input');
  const name = inp?.value?.trim();
  if (!name) { toast('Nom du donjon requis.', 'error'); return; }
  try {
    const list = await _readDonjonsLoot();
    const base = normalize(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'donjon';
    let id = base, n = 1;
    while (list.some(d => d.id === id)) id = `${base}_${++n}`;
    await _writeDonjonsLoot([...list, { id, name }]);
    if (inp) inp.value = '';
    toast(`Donjon créé : ${name}`, 'success');
    await _loadDonjonsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.moveVclDonjon = async function(id, dir) {
  try {
    const list = await _readDonjonsLoot();
    const i = list.findIndex(d => d.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await _writeDonjonsLoot(list);
    await _loadDonjonsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

window.deleteVclDonjon = async function(id) {
  try {
    const list = await _readDonjonsLoot();
    const d = list.find(x => x.id === id);
    if (!d) return;
    const ok = await modal.confirm(`Supprimer le donjon "${d.name}" ? Les items qui l'utilisent gardent leur texte d'obtention.`, { danger: true, confirmLabel: 'Supprimer' });
    if (!ok) return;
    await _writeDonjonsLoot(list.filter(x => x.id !== id));
    toast('Donjon supprimé.', 'success');
    await _loadDonjonsList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

// ── TITRES TOOL (menu « Titre » de l'Atelier : chaque titre donne des stats) ──
// Stockés dans config/titres : { list: [{ id, name, stats: { <stat>: <valeur> } }] } (l'ordre du tableau = ordre d'affichage).
const _TITRES_REF = () => doc(db, 'config', 'titres');

async function _readTitres() {
  const snap = await getDoc(_TITRES_REF());
  return snap.exists() ? (snap.data().list || []).filter(t => t?.id && t?.name).map(t => ({ ...t, stats: t.stats || {} })) : [];
}
const _writeTitres = list => setDoc(_TITRES_REF(), { list });
const _titreStatDefs = () => (typeof ALL_STATS !== 'undefined' ? ALL_STATS : []);
const _titreStatLabel = id => _titreStatDefs().find(s => s.id === id)?.label || id;
const _titreStatUnit  = id => _titreStatDefs().find(s => s.id === id)?.unit || '';

window.showTitresTool = async function() {
  _setHash('titres-tool');
  _showPanel('titres-tool-panel', 'btn-titres-tool');
  await _loadTitresList();
};

async function _loadTitresList() {
  const el = document.getElementById('titres-list');
  if (!el) return;
  el.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const list = await _readTitres();
    if (!list.length) {
      el.innerHTML = '<div class="empty" style="color:var(--muted);">Aucun titre. Créez-en un ci-dessus.</div>';
      return;
    }
    // Liste de stats consultable : champ de recherche + datalist (taper « crit » filtre les stats ; la valeur est le nom de la stat)
    const statList = `<datalist id="titre-stat-list">${_titreStatDefs().map(s => `<option value="${escHtml(s.label)}">${escHtml((s.icon || '') + ' ' + s.id)}</option>`).join('')}</datalist>`;
    el.innerHTML = statList + list.map((t, i) => {
      const id = escHtml(t.id);
      const chips = Object.entries(t.stats).map(([k, v]) =>
        `<span style="display:inline-flex;align-items:center;gap:6px;padding:3px 8px;background:var(--surface);border:1px solid var(--border);border-radius:12px;font-size:11px;">${escHtml(_titreStatLabel(k))} <b style="color:var(--accent);">${v > 0 ? '+' : ''}${v}${escHtml(_titreStatUnit(k))}</b>
          <button class="btn btn-ghost btn-sm" title="Retirer cette stat" onclick="removeVclTitreStat('${id}','${escHtml(k)}')" style="padding:0 4px;font-size:11px;line-height:1.4;">✕</button></span>`).join('') || '<span style="font-size:11px;color:var(--muted);">Aucune stat : ce titre ne donne rien pour l\'instant.</span>';
      return `<div style="padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;display:flex;flex-direction:column;gap:8px;">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:13px;">🏅 ${escHtml(t.name)} <code style="font-size:10px;color:var(--muted);margin-left:6px;">${id}</code></span>
          <span style="display:flex;gap:6px;align-items:center;">
            <button class="btn btn-ghost btn-sm" title="Renommer" onclick="renameVclTitre('${id}')" style="font-size:12px;">✏️</button>
            <button class="btn btn-ghost btn-sm" title="Monter" ${i === 0 ? 'disabled' : ''} onclick="moveVclTitre('${id}',-1)" style="font-size:12px;">▲</button>
            <button class="btn btn-ghost btn-sm" title="Descendre" ${i === list.length - 1 ? 'disabled' : ''} onclick="moveVclTitre('${id}',1)" style="font-size:12px;">▼</button>
            <button class="btn btn-danger btn-sm" onclick="deleteVclTitre('${id}')" style="font-size:12px;">🗑️ Supprimer</button>
          </span>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${chips}</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input type="text" id="titre-stat-${id}" list="titre-stat-list" autocomplete="off" placeholder="🔍 Rechercher une stat…" style="height:30px;flex:1;min-width:0;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:0 8px;font-family:inherit;font-size:12px;" onkeydown="if(event.key==='Enter'){event.preventDefault();document.getElementById('titre-val-${id}').focus();}">
          <input type="number" step="any" id="titre-val-${id}" placeholder="valeur" style="height:30px;width:90px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:0 8px;font-family:inherit;font-size:12px;" onkeydown="if(event.key==='Enter')addVclTitreStat('${id}')">
          <button class="btn btn-primary btn-sm" onclick="addVclTitreStat('${id}')" style="font-size:12px;white-space:nowrap;">+ Stat</button>
        </div>
      </div>`;
    }).join('');
  } catch(e) {
    el.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`;
  }
}

window.createVclTitre = async function() {
  const inp = document.getElementById('titre-name-input');
  const name = inp?.value?.trim();
  if (!name) { toast('Nom du titre requis.', 'error'); return; }
  try {
    const list = await _readTitres();
    const base = normalize(name).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'titre';
    let id = base, n = 1;
    while (list.some(t => t.id === id)) id = `${base}_${++n}`;
    await _writeTitres([...list, { id, name, stats: {} }]);
    if (inp) inp.value = '';
    toast(`Titre créé : ${name}. Ajoutez-lui des stats.`, 'success');
    await _loadTitresList();
  } catch(e) {
    toast('Erreur : ' + e.message, 'error');
  }
};

async function _updateTitre(id, fn) {
  const list = await _readTitres();
  const t = list.find(x => x.id === id);
  if (!t) return;
  fn(t);
  await _writeTitres(list);
  await _loadTitresList();
}

// Retrouve l'id d'une stat à partir de ce qui est tapé : nom exact, id, ou nom partiel s'il n'y a qu'une seule correspondance.
function _resolveTitreStat(txt) {
  const q = normalize(String(txt || '').trim());
  if (!q) return null;
  const defs = _titreStatDefs();
  const exact = defs.find(d => normalize(d.label) === q || d.id === String(txt).trim());
  if (exact) return exact.id;
  const part = defs.filter(d => normalize(d.label).includes(q));
  return part.length === 1 ? part[0].id : null;
}

window.addVclTitreStat = async function(id) {
  const raw = document.getElementById('titre-stat-' + id)?.value;
  const stat = _resolveTitreStat(raw);
  const val = parseFloat(document.getElementById('titre-val-' + id)?.value);
  if (!stat) { toast(raw?.trim() ? `Stat inconnue ou ambiguë : « ${raw.trim()} ». Choisis-en une dans la liste.` : 'Choisis une stat.', 'error'); return; }
  if (isNaN(val)) { toast('Indique une valeur.', 'error'); return; }
  try { await _updateTitre(id, t => { t.stats[stat] = val; }); }
  catch(e) { toast('Erreur : ' + e.message, 'error'); }
};

window.removeVclTitreStat = async function(id, stat) {
  try { await _updateTitre(id, t => { delete t.stats[stat]; }); }
  catch(e) { toast('Erreur : ' + e.message, 'error'); }
};

window.renameVclTitre = async function(id) {
  try {
    const list = await _readTitres();
    const t = list.find(x => x.id === id);
    if (!t) return;
    const name = (await modal.prompt?.('Nouveau nom du titre', { defaultValue: t.name }) ?? window.prompt('Nouveau nom du titre', t.name))?.trim();
    if (!name || name === t.name) return;
    await _updateTitre(id, x => { x.name = name; });
  } catch(e) { toast('Erreur : ' + e.message, 'error'); }
};

window.moveVclTitre = async function(id, dir) {
  try {
    const list = await _readTitres();
    const i = list.findIndex(t => t.id === id), j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    await _writeTitres(list);
    await _loadTitresList();
  } catch(e) { toast('Erreur : ' + e.message, 'error'); }
};

window.deleteVclTitre = async function(id) {
  try {
    const list = await _readTitres();
    const t = list.find(x => x.id === id);
    if (!t) return;
    const ok = await modal.confirm(`Supprimer le titre "${t.name}" ? Les builds qui l'utilisent n'auront plus de titre.`, { danger: true, confirmLabel: 'Supprimer' });
    if (!ok) return;
    await _writeTitres(list.filter(x => x.id !== id));
    toast('Titre supprimé.', 'success');
    await _loadTitresList();
  } catch(e) { toast('Erreur : ' + e.message, 'error'); }
};

let _effectsData = { types: [], templates: [] };
let _effectsDirty = false;

window.showEffectsTool = async () => {
  _setHash('effects-tool');
  document.getElementById('effects-tool-panel').style.display = '';
  document.getElementById('btn-effects-tool').classList.add('active');
  await loadEffectTypes();
};

async function loadEffectTypes() {
  try {
    const snap = await getDoc(doc(db, 'config', 'effect_types'));
    if (snap.exists()) {
      const d = snap.data();
      _effectsData = {
        types:     (d.types     || []).map(t => ({ ...t })),
        templates: (d.templates || []).map(t => ({ ...t })),
      };
    } else {
      await seedEffectTypes(false);
    }
  } catch(e) {
    toast(`⛔ Erreur chargement effets : ${e.message}`, 'error');
  }
  renderEffectTypes();
}

window.seedEffectTypes = async function seedEffectTypes(confirm = true) {
  if (confirm) {
    const yes = await modal.confirm('Réinitialiser les types d\'effets depuis le code ? Les modifications Firestore seront écrasées.');
    if (!yes) return;
  }
  _effectsData = {
    types:     _EFFECT_SEED_TYPES.map(t => ({ ...t })),
    templates: _EFFECT_SEED_TEMPLATES.map(t => ({ label: t.label, effects: JSON.parse(JSON.stringify(t.effects)) })),
  };
  _effectsDirty = true;
  document.getElementById('btn-save-effects').disabled = false;
  renderEffectTypes();
  toast('Types réinitialisés depuis le code — n\'oublie pas de sauvegarder.', 'info');
};

window.saveEffectTypes = async function saveEffectTypes() {
  const btn = document.getElementById('btn-save-effects');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    await setDoc(doc(db, 'config', 'effect_types'), sanitizeForFirestore({
      types:     _effectsData.types,
      templates: _effectsData.templates,
    }));
    _effectsDirty = false;
    btn.textContent = '💾 Sauvegarder';
    toast('✓ Effets sauvegardés', 'success');
  } catch(e) {
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    toast(`⛔ Erreur : ${e.message}`, 'error');
  }
};

window.switchEffectsTab = function switchEffectsTab(tab) {
  document.getElementById('effects-types-tab').style.display     = tab === 'types'     ? '' : 'none';
  document.getElementById('effects-templates-tab').style.display = tab === 'templates' ? '' : 'none';
  document.getElementById('effects-tab-types').style.background     = tab === 'types'     ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('effects-tab-templates').style.background = tab === 'templates' ? 'var(--accent)' : 'var(--surface2)';
  document.getElementById('effects-tab-types').style.color     = tab === 'types'     ? '#fff' : 'var(--text)';
  document.getElementById('effects-tab-templates').style.color = tab === 'templates' ? '#fff' : 'var(--text)';
};

function _markEffectsDirty() {
  _effectsDirty = true;
  document.getElementById('btn-save-effects').disabled = false;
}

function renderEffectTypes() {
  // ── Types ──
  const listEl = document.getElementById('effects-type-list');
  listEl.innerHTML = '';
  if (!_effectsData.types.length) {
    listEl.innerHTML = '<div class="empty">Aucun type. Cliquer "Réinitialiser depuis le code".</div>';
  } else {
    const tbl = document.createElement('table');
    tbl.style.cssText = 'width:100%;border-collapse:collapse;font-size:12px;';
    tbl.innerHTML = `<thead><tr style="color:var(--muted);font-size:10px;text-transform:uppercase;">
      <th style="padding:4px 6px;text-align:left;">ID</th>
      <th style="padding:4px 6px;text-align:left;">Icône</th>
      <th style="padding:4px 6px;text-align:left;">Couleur</th>
      <th style="padding:4px 6px;text-align:left;width:160px;">Label</th>
      <th style="padding:4px 6px;text-align:left;">Préfixe</th>
      <th style="padding:4px 2px;"></th>
    </tr></thead>`;
    const tbody = document.createElement('tbody');
    _effectsData.types.forEach((t, i) => {
      const tr = document.createElement('tr');
      tr.style.cssText = 'border-top:1px solid var(--border);';
      tr.innerHTML = `
        <td style="padding:4px 6px;color:var(--muted);font-family:monospace;">${escHtml(t.id)}</td>
        <td style="padding:4px 6px;">
          <input type="text" value="${escHtml(t.icon||'')}" maxlength="4"
            style="width:44px;background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-size:14px;text-align:center;"
            data-field="icon" data-idx="${i}">
        </td>
        <td style="padding:4px 6px;">
          <div style="display:flex;align-items:center;gap:4px;">
            <div style="width:14px;height:14px;border-radius:3px;background:${escHtml(t.color||'#888')};flex-shrink:0;"></div>
            <input type="text" value="${escHtml(t.color||'')}" maxlength="9"
              style="width:80px;background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-size:12px;font-family:monospace;"
              data-field="color" data-idx="${i}">
          </div>
        </td>
        <td style="padding:4px 6px;">
          <input type="text" value="${escHtml(t.label||'')}"
            style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-size:12px;"
            data-field="label" data-idx="${i}">
        </td>
        <td style="padding:4px 6px;">
          <input type="text" value="${escHtml(t.prefix||'')}"
            style="width:100%;background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:3px 5px;font-size:12px;"
            data-field="prefix" data-idx="${i}">
        </td>
        <td style="padding:4px 2px;text-align:right;">
          <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;color:var(--danger);" data-del="${i}">✕</button>
        </td>`;
      // Events
      tr.querySelectorAll('input[data-field]').forEach(inp => {
        inp.addEventListener('input', () => {
          const idx = +inp.dataset.idx;
          const field = inp.dataset.field;
          _effectsData.types[idx][field] = inp.value;
          if (field === 'color') {
            const swatch = tr.querySelector('div[style*="border-radius:3px"]');
            if (swatch) swatch.style.background = inp.value;
          }
          _markEffectsDirty();
        });
      });
      tr.querySelector('[data-del]').addEventListener('click', () => {
        _effectsData.types.splice(i, 1);
        _markEffectsDirty();
        renderEffectTypes();
      });
      tbody.appendChild(tr);
    });
    tbl.appendChild(tbody);
    listEl.appendChild(tbl);
  }

  // ── Templates ──
  const tplEl = document.getElementById('effects-template-list');
  tplEl.innerHTML = '';
  _effectsData.templates.forEach((tpl, ti) => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;background:var(--surface2);border-radius:6px;margin-bottom:4px;';
    row.innerHTML = `
      <input type="text" value="${escHtml(tpl.label)}" placeholder="Label template"
        style="flex:1;background:var(--surface3);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:4px 8px;font-size:12px;">
      <span style="font-size:11px;color:var(--muted);">${tpl.effects.length} effet(s)</span>
      <button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px;color:var(--danger);" data-del-tpl="${ti}">✕</button>`;
    row.querySelector('input').addEventListener('input', e => {
      _effectsData.templates[ti].label = e.target.value;
      _markEffectsDirty();
    });
    row.querySelector('[data-del-tpl]').addEventListener('click', () => {
      _effectsData.templates.splice(ti, 1);
      _markEffectsDirty();
      renderEffectTypes();
    });
    tplEl.appendChild(row);
  });
}

window.addEffectType = function addEffectType() {
  const id     = document.getElementById('new-effect-id').value.trim();
  const icon   = document.getElementById('new-effect-icon').value.trim();
  const color  = document.getElementById('new-effect-color').value.trim();
  const label  = document.getElementById('new-effect-label').value.trim();
  const prefix = document.getElementById('new-effect-prefix').value.trim();
  if (!id) { toast('ID obligatoire', 'warning'); return; }
  if (_effectsData.types.some(t => t.id === id)) { toast('ID déjà existant', 'warning'); return; }
  _effectsData.types.push({ id, icon, color, label, prefix });
  _markEffectsDirty();
  document.getElementById('new-effect-id').value = '';
  document.getElementById('new-effect-icon').value = '';
  document.getElementById('new-effect-color').value = '';
  document.getElementById('new-effect-label').value = '';
  document.getElementById('new-effect-prefix').value = '';
  renderEffectTypes();
};

window.addEffectTemplate = function addEffectTemplate() {
  _effectsData.templates.push({ label: 'Nouveau template', effects: [] });
  _markEffectsDirty();
  renderEffectTypes();
  switchEffectsTab('templates');
};
}
