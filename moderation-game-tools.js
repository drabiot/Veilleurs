// ══════════════════════════════════════════════════════
// OUTILS ÉVÉNEMENTS / DONJONS / TITRES / EFFETS (menus de l'Atelier et du Creator)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { setHash: _setHash, showPanel: _showPanel, escHtml, db, COL, collection, getDocs, getDoc, doc, setDoc, addDoc, deleteDoc, serverTimestamp, writeBatch, sanitizeForFirestore, loadEventNames, toast, modal } = ctx;
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

// ── DISCORD TOOL : où le bot poste les nouveaux items (config/discord_routes { enabled, default, routes: { "<catégorie>_<palier>": "<id salon>" } }) ──
// Lu par bot/discord-watch.js : chaque nouvel item est posté (avec sa carte) dans routes[catégorie_palier], sinon dans le salon par défaut.
const _DR_REF = () => doc(db, 'config', 'discord_routes');
const _DR_CATS = [['arme', '⚔️ Armes'], ['armure', '🛡️ Armures'], ['accessoire', '💍 Accessoires'], ['outils', '🛠️ Outils'], ['rune', '🔮 Runes'], ['consommable', '🧪 Consommables'],
  ['nourriture', '🍖 Nourriture'], ['materiaux', '🧱 Matériaux'], ['ressources', '⛏️ Ressources'], ['parchemin', '📃 Parchemins'], ['quete', '📜 Quête'], ['donjon', '🏰 Donjon'], ['monnaie', '🪙 Monnaie']];
let _dr = { enabled: false, default: '', routes: {} }, _drPaliers = [];

window.showDiscordRoutes = async function() {
  _setHash('discord-routes');
  _showPanel('discord-routes-panel', 'btn-discord-routes');
  const body = document.getElementById('discord-routes-body');
  body.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [cfg, pal] = await Promise.all([getDoc(_DR_REF()), getDoc(doc(db, 'config', 'paliers'))]);
    const c = cfg.exists() ? cfg.data() : {};
    _dr = { enabled: c.enabled === true, default: c.default || '', routes: c.routes && typeof c.routes === 'object' ? c.routes : {} };
    _drPaliers = (pal.exists() && Array.isArray(pal.data().paliers) ? pal.data().paliers : []).filter(p => p.id !== -1);
    if (!_drPaliers.length) _drPaliers = [{ id: 1, label: 'Palier 1' }, { id: 2, label: 'Palier 2' }, { id: 3, label: 'Palier 3' }, { id: 'event', label: 'Event' }, { id: 'worldboss', label: 'World Boss' }];
    _renderDiscordRoutes();
    window.discordRenderSync(); // actions manuelles (module Discord chargé à la demande)
  } catch (e) { body.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`; }
};

function _renderDiscordRoutes() {
  const inp = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 8px;font-size:11px;outline:none;font-family:monospace;';
  const head = _drPaliers.map(p => `<th style="text-align:left;padding:4px 6px;font-size:11px;color:var(--muted);">${escHtml(p.label || String(p.id))}</th>`).join('');
  const rows = _DR_CATS.map(([cat, label]) => `<tr><td style="padding:4px 10px 4px 0;font-size:12px;white-space:nowrap;">${label}</td>${_drPaliers.map(p => {
    const key = `${cat}_${p.id}`;
    return `<td style="padding:3px 6px;"><input type="text" inputmode="numeric" data-key="${escHtml(key)}" value="${escHtml(_dr.routes[key] || '')}" placeholder="ID du salon" onchange="setDiscordRoute(this.dataset.key, this.value)" style="${inp}"></td>`;
  }).join('')}</tr>`).join('');
  document.getElementById('discord-routes-body').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap;">
      <span style="font-size:14px;font-weight:700;color:${_dr.enabled ? 'var(--success, #4caf50)' : 'var(--muted)'};">${_dr.enabled ? '🟢 Envoi automatique actif' : '⚪ Envoi automatique désactivé'}</span>
      <button class="btn ${_dr.enabled ? 'btn-ghost' : 'btn-primary'}" onclick="setDiscordEnabled(${!_dr.enabled})" style="font-size:12px;">${_dr.enabled ? '⏸ Désactiver' : '▶ Activer'}</button>
    </div>
    <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Salon par défaut</div>
    <div style="max-width:320px;margin-bottom:18px;"><input type="text" inputmode="numeric" value="${escHtml(_dr.default)}" placeholder="ID du salon (utilisé si aucune case ci-dessous)" onchange="setDiscordRoute('default', this.value)" style="${inp}"></div>
    <div style="font-size:13px;font-weight:700;margin-bottom:4px;">Salon par catégorie et palier <span style="color:var(--muted);font-weight:400;">— vide = salon par défaut</span></div>
    <div style="overflow-x:auto;"><table style="border-collapse:collapse;min-width:640px;"><thead><tr><th></th>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

const _drSave = async () => setDoc(_DR_REF(), { enabled: _dr.enabled, default: _dr.default, routes: _dr.routes });

window.setDiscordRoute = async function(key, value) {
  const v = String(value || '').trim();
  if (v && !/^\d{15,25}$/.test(v)) { toast('ID de salon invalide (chiffres uniquement : clic droit sur le salon → Copier l\'identifiant).', 'error'); _renderDiscordRoutes(); return; }
  if (key === 'default') _dr.default = v; else if (v) _dr.routes[key] = v; else delete _dr.routes[key];
  try { await _drSave(); toast(v ? 'Salon enregistré.' : 'Salon retiré.', 'success'); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

window.setDiscordEnabled = async function(on) {
  if (on && !await modal.confirm('Activer l\'envoi automatique ?\n\nChaque NOUVEL item publié sera posté dans le salon réglé ici (avec sa carte). Les items déjà existants ne sont pas envoyés. Le bot (bot/discord-watch.js) doit tourner.')) return;
  _dr.enabled = !!on;
  try { await _drSave(); toast(on ? 'Envoi automatique activé.' : 'Envoi automatique désactivé.', 'success'); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
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
