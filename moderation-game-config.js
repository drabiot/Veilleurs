// ══════════════════════════════════════════════════════
// CONFIG JEU (paliers + niveau max)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { setHash: _setHash, showPanel: _showPanel, escHtml, db, COL, doc, getDoc, setDoc, toast, populateAllPalierSelects, modal } = ctx;
// ── Config Jeu (paliers + MAX_LEVEL) ────────────────────
let _gcPaliers  = [];
let _gcMaxLevel = 18;

window.showGameConfig = async () => {
  if (ctx.role !== 'admin') { toast('⛔ Réservé aux admins', 'error'); return; }
  _setHash('game-config');
  document.getElementById('game-config-panel').style.display = '';
  document.getElementById('btn-game-config').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await _loadGameConfigData();
};

async function _loadGameConfigData() {
  const content = document.getElementById('gc-content');
  content.innerHTML = '<div style="color:var(--muted);font-size:13px;">Chargement…</div>';
  try {
    const [snapP, snapG] = await Promise.all([
      getDoc(doc(db, 'config', 'paliers')),
      getDoc(doc(db, 'config', 'game')),
    ]);
    _gcPaliers  = snapP.exists() && Array.isArray(snapP.data().paliers) && snapP.data().paliers.length
      ? snapP.data().paliers.map(p => ({ ...p }))
      : [{ id:1, label:'Palier 1', color:'#4ade80', floorName:'Villes Européennes' },
         { id:2, label:'Palier 2', color:'#f59e0b', floorName:'Désert Aride' },
         { id:3, label:'Palier 3', color:'#f87171', floorName:'Forêt Elfique' }];
    _gcMaxLevel = snapG.exists() && typeof snapG.data().maxLevel === 'number'
      ? snapG.data().maxLevel : 18;
    _renderGameConfig();
  } catch(e) {
    content.innerHTML = `<div style="color:var(--danger);">Erreur chargement : ${e.message}</div>`;
  }
}

function _renderGameConfig() {
  const content = document.getElementById('gc-content');
  const S = {
    section:  'margin-bottom:28px;',
    h:        'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:12px;',
    row:      'display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;margin-bottom:8px;',
    inp:      'background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:13px;outline:none;',
    label:    'font-size:11px;color:var(--muted);width:70px;flex-shrink:0;',
  };

  let html = `
    <div style="${S.section}">
      <div style="${S.h}">Paliers</div>
      <div id="gc-paliers-list">`;

  for (let i = 0; i < _gcPaliers.length; i++) {
    const p = _gcPaliers[i];
    html += `
        <div style="${S.row}" id="gc-palier-row-${i}">
          <span style="${S.label}">ID</span>
          <input type="text" value="${escHtml(String(p.id))}" placeholder="ex : 4 ou event" title="Nombre (4, -1…) ou texte (event, archive…) : lettres, chiffres, _ et - uniquement" style="${S.inp}width:110px;"
            data-gc="id" data-idx="${i}" oninput="gcSetPalierId(${i},this)">
          <span style="${S.label}">Label</span>
          <input type="text" value="${p.label}" style="${S.inp}flex:1;"
            data-gc="label" data-idx="${i}" oninput="gcUpdatePalier(${i},'label',this.value)">
          <span style="${S.label}">Couleur</span>
          <input type="color" value="${p.color || '#888888'}" style="width:40px;height:32px;border:none;background:none;cursor:pointer;border-radius:4px;padding:0;"
            data-gc="color" data-idx="${i}" oninput="gcUpdatePalier(${i},'color',this.value)">
          <span style="${S.label}">Zone</span>
          <input type="text" value="${p.floorName || ''}" placeholder="Nom de la zone" style="${S.inp}flex:1;"
            data-gc="floorName" data-idx="${i}" oninput="gcUpdatePalier(${i},'floorName',this.value)">
          <button class="btn btn-ghost" style="color:var(--danger);font-size:12px;padding:5px 8px;flex-shrink:0;"
            onclick="gcRemovePalier(${i})" title="Supprimer ce palier">🗑️</button>
        </div>`;
  }

  html += `
      </div>
      <button class="btn btn-ghost" onclick="gcAddPalier()" style="font-size:12px;margin-top:4px;">+ Ajouter un palier</button>
    </div>

    <div style="${S.section}">
      <div style="${S.h}">Paramètres de jeu</div>
      <div style="${S.row}">
        <span style="${S.label}">Niveau max</span>
        <input type="number" id="gc-maxlevel" min="1" max="99" value="${_gcMaxLevel}"
          style="${S.inp}width:110px;" oninput="_gcMaxLevel=+this.value">
        <span style="font-size:12px;color:var(--muted);">Niveau maximum des items et personnages</span>
      </div>
    </div>`;

  content.innerHTML = html;
}

window.gcUpdatePalier = (idx, field, val) => { _gcPaliers[idx][field] = val; };
// ID de palier : nombre (4, -1) ou texte libre (event, archive…) ; un ID purement numérique est stocké en nombre
window.gcSetPalierId = (idx, inp) => {
  const v = inp.value.replace(/[^\w-]+/g, '');
  if (v !== inp.value) inp.value = v;
  _gcPaliers[idx].id = /^-?\d+$/.test(v) ? Number(v) : v;
};

window.gcAddPalier = () => {
  const maxId = _gcPaliers.reduce((m, p) => Math.max(m, Number.isFinite(Number(p.id)) ? Number(p.id) : 0), 0);
  _gcPaliers.push({ id: maxId + 1, label: `Palier ${maxId + 1}`, color: '#a78bfa', floorName: '' });
  _renderGameConfig();
};

window.gcRemovePalier = async (idx) => {
  const p = _gcPaliers[idx];
  if (_gcPaliers.length <= 1) { toast('⚠️ Impossible de supprimer le dernier palier', 'warning'); return; }
  if (!await modal.confirm(`Supprimer "${p.label}" ?\nLes données existantes qui référencent ce palier ne seront pas affectées.`)) return;
  _gcPaliers.splice(idx, 1);
  _renderGameConfig();
};

window.saveGameConfig = async () => {
  const btn = document.getElementById('gc-save-btn');
  btn.disabled = true; btn.textContent = '⏳';

  // Validation
  const ids = _gcPaliers.map(p => p.id);
  if (ids.some(id => String(id) === '' || id == null)) {
    toast('⚠️ Chaque palier doit avoir un ID', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }
  if (new Set(ids.map(String)).size !== ids.length) {
    toast('⚠️ Les IDs de palier doivent être uniques', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }
  if (_gcPaliers.some(p => !p.label?.trim())) {
    toast('⚠️ Tous les paliers doivent avoir un label', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }
  const maxLv = +document.getElementById('gc-maxlevel').value;
  if (!maxLv || maxLv < 1 || maxLv > 99) {
    toast('⚠️ Niveau max invalide (1–99)', 'warning');
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    return;
  }

  try {
    const newPalierIds = ids.filter(id => !ctx.creatorPaliers.includes(id));

    await Promise.all([
      setDoc(doc(db, 'config', 'paliers'), { paliers: _gcPaliers }),
      setDoc(doc(db, 'config', 'game'),    { maxLevel: maxLv }),
    ]);

    // Mettre à jour l'état en mémoire
    ctx.applyPaliers(_gcPaliers.map(p => ({ ...p })));
    populateAllPalierSelects();

    toast('✓ Configuration sauvegardée', 'success');
  } catch(e) {
    toast(`⛔ Erreur : ${e.message}`, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
  }
};
}
