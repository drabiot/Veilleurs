// ══════════════════════════════════════════════════════
// SENSIBLE — liste et bascule public/sensible (items, mobs, PNJ ; admin)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { db, COL, collection, getDocs, doc, setDoc, deleteDoc, hashName, getItemGameplayKeys, sanitizeForFirestore, desanitizeFromFirestore, toast, modal, store, escHtml, setHash: _setHash, showPanel: _showPanel, cachedDocs, invalidateModCache } = ctx;
const _sensState = {
  itemsHidden: [],          // docs de items_hidden (_id = hash)
  itemsSecretById: new Map(), // id original → doc items_secret
  itemsPublic: [],          // docs de items
  mobsSecret: [],           // docs de mobs_secret
  mobsPublic: [],           // docs de mobs
  pnjSecret: [],            // docs de pnj_secret
  pnjPublic: [],            // docs de personnages
};

function _sensEsc(s) {
  return String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

// Formule d'image identique à creator.js / atelier.js (source de vérité partagée)
function _sensComputeImg(category, id, palier, isEvent) {
  if (!id) return null;
  const tier = (isEvent || (palier === 0 || palier === 'event')) ? 'events' : (palier ? 'P' + palier : '');
  const tp = tier ? tier + '/' : '';
  switch (category) {
    case 'arme':        return `../img/compendium/textures/weapons/${tp}${id}.png`;
    case 'armure':      return `../img/compendium/textures/armors/${tp}${id}.png`;
    case 'accessoire':  return `../img/compendium/textures/trinkets/${tp}${id}.png`;
    case 'outils':      return `../img/compendium/textures/gears/${tp}${id}.png`;
    case 'materiaux':   return `../img/compendium/textures/items/Material/${tp}${id}.png`;
    case 'ressources':  return `../img/compendium/textures/items/Ressources/${tp}${id}.png`;
    case 'consommable': return `../img/compendium/textures/items/Consommable/${tp}${id}.png`;
    case 'nourriture':  return `../img/compendium/textures/items/Nourriture/${tp}${id}.png`;
    case 'rune':        return `../img/compendium/textures/items/Runes/${tp}${id}.png`;
    case 'parchemin':   return `../img/compendium/textures/items/Parchemins/${tp}${id}.png`;
    case 'quete':       return `../img/compendium/textures/items/Quest/${tp}${id}.png`;
    case 'donjon':      return `../img/compendium/textures/items/Donjon/${tp}${id}.png`;
    case 'monnaie':     return `../img/compendium/textures/items/Monnaie/${tp}${id}.png`;
    default:            return null;
  }
}


window.sensReload = async () => {
  document.getElementById('sens-loading').style.display = '';
  document.getElementById('sens-loading').textContent = 'Chargement…';
  document.getElementById('sens-content').style.display = 'none';
  try {
    const [ih, is, ip, ms, mp, ps, pp] = await Promise.all([
      getDocs(collection(db, COL.itemsHidden)),
      getDocs(collection(db, COL.itemsSecret)),
      getDocs(collection(db, COL.items)),
      getDocs(collection(db, COL.mobsSecret)),
      getDocs(collection(db, COL.mobs)),
      getDocs(collection(db, COL.pnjSecret)),
      getDocs(collection(db, COL.pnj)),
    ]);
    // Déduplication par champ 'id' : si deux docs ont le même item (ancienne clé + nameHash), garder le plus récent (nameHash)
    const _ihAll = ih.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    const _ihById = new Map();
    for (const item of _ihAll) {
      const key = String(item.id || item._id || '');
      const existing = _ihById.get(key);
      // Préférer le doc dont la clé est le nameHash (pas un id numérique)
      if (!existing || /^[0-9]+$/.test(existing._id)) _ihById.set(key, item);
    }
    _sensState.itemsHidden = [..._ihById.values()];
    _sensState.itemsSecretById = new Map(
      is.docs.map(d => [d.id, desanitizeFromFirestore({ _id: d.id, ...d.data() })])
    );
    _sensState.itemsPublic = ip.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsSecret = ms.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.mobsPublic = mp.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.pnjSecret = ps.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));
    _sensState.pnjPublic = pp.docs.map(d => desanitizeFromFirestore({ _id: d.id, ...d.data() }));

    // Sort alphabétique pour confort
    const byName = (a, b) => normalize(a.name || a._id).localeCompare(normalize(b.name || b._id), 'fr');
    _sensState.itemsHidden.sort(byName);
    _sensState.itemsPublic.sort(byName);
    _sensState.mobsSecret.sort(byName);
    _sensState.mobsPublic.sort(byName);
    _sensState.pnjSecret.sort(byName);
    _sensState.pnjPublic.sort(byName);

    _sensRenderAll();
    document.getElementById('sens-loading').style.display = 'none';
    document.getElementById('sens-content').style.display = '';
  } catch (err) {
    document.getElementById('sens-loading').textContent = 'Erreur : ' + err.message;
    console.error(err);
  }
};

function _sensRenderAll() {
  _sensRenderItemsHidden();
  _sensRenderItemsPublic();
  _sensRenderMobsHidden();
  _sensRenderMobsPublic();
  _sensRenderPnjHidden();
  _sensRenderPnjPublic();
}

// ─── Rendu ───────────────────────────────────────────────

function _sensItemRow(item, btnHtml) {
  const id = _sensEsc(item.id || item._id);
  const name = _sensEsc(item.name || item._id);
  const rar  = _sensEsc(item.rarity || '—');
  const pal  = item.palier != null ? 'P' + _sensEsc(item.palier) : '—';
  const lvl  = item.lvl != null ? 'lvl ' + _sensEsc(item.lvl) : '';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${rar} · ${pal} ${lvl}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensMobRow(mob, btnHtml) {
  const id = _sensEsc(mob.id || mob._id);
  const name = _sensEsc(mob.name || mob._id);
  const type = _sensEsc(mob.type || '—');
  const pal  = mob.palier != null ? 'P' + _sensEsc(mob.palier) : '—';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${type} · ${pal}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensRenderItemsHidden() {
  const list = _sensState.itemsHidden;
  document.getElementById('sens-items-hidden-count').textContent = list.length + ' item(s)';
  const el = document.getElementById('sens-items-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun item sensible.</div>';
    return;
  }
  el.innerHTML = list.map(item => {
    const h = _sensEsc(item._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditItem('${h}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensItemToPublic('${h}')" style="font-size:11px;padding:3px 10px;">🔓 Public</button>`;
    return _sensItemRow(item, btns);
  }).join('');
}

window.sensEditItem = async function(hashId) {
  const hidden = _sensState.itemsHidden.find(x => x._id === hashId);
  if (!hidden) return;
  const secret = hidden.id ? (_sensState.itemsSecretById.get(String(hidden.id)) || {}) : {};
  // Fusionner hidden + secret en un seul objet éditable (sans méta _id)
  const merged = {};
  for (const [k, v] of Object.entries(hidden))  { if (k !== '_id') merged[k] = v; }
  for (const [k, v] of Object.entries(secret))  { if (k !== '_id') merged[k] = v; }
  await showEditor('items_sensible', hashId, merged, 'migration');
};

window.sensEditMob = async function(mobId) {
  const mob = _sensState.mobsSecret.find(x => x._id === mobId);
  if (!mob) return;
  const data = {};
  for (const [k, v] of Object.entries(mob)) { if (k !== '_id') data[k] = v; }
  await showEditor('mobs_secret', mobId, data, 'migration');
};

window.sensEditPnj = async function(pnjId) {
  const pnj = _sensState.pnjSecret.find(x => x._id === pnjId);
  if (!pnj) return;
  const data = {};
  for (const [k, v] of Object.entries(pnj)) { if (k !== '_id') data[k] = v; }
  await showEditor('pnj_secret', pnjId, data, 'migration');
};

function _sensRenderItemsPublic() {
  const list = _sensState.itemsPublic;
  document.getElementById('sens-items-public-count').textContent = list.length + ' item(s)';
  window.sensFilterItemsPublic();
}

window.sensFilterItemsPublic = function() {
  const q = normalize(document.getElementById('sens-items-search').value.trim());
  const el = document.getElementById('sens-items-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.itemsPublic.filter(item =>
    normalize(item.name || '').includes(q) || normalize(item._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(item => {
    const btn = `<button class="btn btn-ghost" onclick="sensItemToSensible('${_sensEsc(item._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensItemRow(item, btn);
  }).join('');
};

function _sensRenderMobsHidden() {
  const list = _sensState.mobsSecret;
  document.getElementById('sens-mobs-hidden-count').textContent = list.length + ' mob(s)';
  const el = document.getElementById('sens-mobs-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun mob sensible.</div>';
    return;
  }
  el.innerHTML = list.map(mob => {
    const id = _sensEsc(mob._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditMob('${id}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensMobToPublic('${id}')" style="font-size:11px;padding:3px 10px;">🔓 Rendre public</button>`;
    return _sensMobRow(mob, btns);
  }).join('');
}

function _sensRenderMobsPublic() {
  const list = _sensState.mobsPublic;
  document.getElementById('sens-mobs-public-count').textContent = list.length + ' mob(s)';
  window.sensFilterMobsPublic();
}

window.sensFilterMobsPublic = function() {
  const q = normalize(document.getElementById('sens-mobs-search').value.trim());
  const el = document.getElementById('sens-mobs-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.mobsPublic.filter(mob =>
    normalize(mob.name || '').includes(q) || normalize(mob._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(mob => {
    const btn = `<button class="btn btn-ghost" onclick="sensMobToSensible('${_sensEsc(mob._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensMobRow(mob, btn);
  }).join('');
};

// ─── Toggles ─────────────────────────────────────────────

// Item public → sensible : split gameplay/secret + hash + cibles + delete source
window.sensItemToSensible = async (sourceId) => {
  const item = _sensState.itemsPublic.find(x => x._id === sourceId);
  if (!item) { toast('Item introuvable.', 'info'); return; }
  if (!item.name) { toast('Item sans name, impossible de hasher.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${item.name}" sensible ?\n\nIl disparaîtra des pages publiques et ne sera accessible via l'atelier qu'en tapant son nom exact.`)) return;
  try {
    const gameplayKeys = await getItemGameplayKeys();
    const allKeys = Object.keys(item).filter(k => k !== '_id');
    const gameplay = {};
    for (const k of allKeys) if (gameplayKeys.includes(k)) gameplay[k] = item[k];
    const secret = {};
    for (const k of allKeys) if (!gameplayKeys.includes(k) && k !== 'sensible') secret[k] = item[k];

    const hash = await hashName(item.name);
    if (!hash) throw new Error('hash vide');

    await setDoc(doc(db, COL.itemsHidden, hash), sanitizeForFirestore({ ...gameplay, sensible: true }));
    if (Object.keys(secret).length) {
      await setDoc(doc(db, COL.itemsSecret, sourceId), sanitizeForFirestore({ ...secret, sensible: true }));
    }
    await deleteDoc(doc(db, COL.items, sourceId));

    store.invalidate('items');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Item sensible → public : merge hidden+secret, write to items, delete cibles
window.sensItemToPublic = async (hashId) => {
  const hidden = _sensState.itemsHidden.find(x => x._id === hashId);
  if (!hidden) { toast('Hidden item introuvable.', 'info'); return; }
  const origId = hidden.id;
  if (!origId) { toast('Hidden item sans champ id — impossible de déterminer l\'id cible.', 'error'); return; }
  if (!await modal.confirm(`Rendre "${hidden.name || origId}" public ?\n\nIl redeviendra visible dans le compendium et l'atelier normalement.`)) return;
  try {
    const secret = _sensState.itemsSecretById.get(origId) || null;
    // Merge : gameplay d'abord (source de vérité pour stats), puis secret (flavor)
    const merged = {};
    for (const [k, v] of Object.entries(hidden)) if (k !== '_id') merged[k] = v;
    if (secret) {
      for (const [k, v] of Object.entries(secret)) if (k !== '_id') merged[k] = v;
    }
    // Recalcul de l'image depuis la formule (on ne la stocke pas dans hidden)
    const _sensImg = _sensComputeImg(merged.category, merged.id, merged.palier, merged.event);
    merged.images = _sensImg ? [_sensImg] : [];
    delete merged.img;
    // Pas de flag sensible dans le doc public
    delete merged.sensible;

    await setDoc(doc(db, COL.items, origId), sanitizeForFirestore(merged));
    await deleteDoc(doc(db, COL.itemsHidden, hashId));
    if (secret) {
      await deleteDoc(doc(db, COL.itemsSecret, origId));
    }

    store.invalidate('items');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Mob public → sensible : doc entier vers mobs_secret
window.sensMobToSensible = async (sourceId) => {
  const mob = _sensState.mobsPublic.find(x => x._id === sourceId);
  if (!mob) { toast('Mob introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${mob.name || sourceId}" sensible ?\n\nIl disparaîtra complètement des pages publiques.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(mob)) if (k !== '_id') payload[k] = v;
    payload.sensible = true;

    await setDoc(doc(db, COL.mobsSecret, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.mobs, sourceId));

    store.invalidate('mobs');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// Mob sensible → public : doc entier vers mobs
window.sensMobToPublic = async (sourceId) => {
  const mob = _sensState.mobsSecret.find(x => x._id === sourceId);
  if (!mob) { toast('Mob sensible introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${mob.name || sourceId}" public ?\n\nIl redeviendra visible dans le bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(mob)) if (k !== '_id') payload[k] = v;
    delete payload.sensible;

    await setDoc(doc(db, COL.mobs, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.mobsSecret, sourceId));

    store.invalidate('mobs');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

function _sensPnjRow(pnj, btnHtml) {
  const id  = _sensEsc(pnj.id || pnj._id);
  const name = _sensEsc(pnj.name || pnj._id);
  const type = _sensEsc(pnj.type || pnj.tag || '—');
  const pal  = pnj.palier != null ? 'P' + _sensEsc(pnj.palier) : '—';
  return `<div style="display:flex;align-items:center;gap:10px;padding:6px 8px;border-bottom:1px solid var(--border);font-size:12px;">
    <div style="flex:1;min-width:0;">
      <div style="color:var(--text);font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</div>
      <div style="color:var(--muted);font-size:11px;">${id} · ${type} · ${pal}</div>
    </div>
    ${btnHtml}
  </div>`;
}

function _sensRenderPnjHidden() {
  const list = _sensState.pnjSecret;
  document.getElementById('sens-pnj-hidden-count').textContent = list.length + ' PNJ';
  const el = document.getElementById('sens-pnj-hidden-list');
  if (!list.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;">Aucun PNJ sensible.</div>';
    return;
  }
  el.innerHTML = list.map(pnj => {
    const id = _sensEsc(pnj._id);
    const btns = `
      <button class="btn btn-ghost" onclick="sensEditPnj('${id}')" style="font-size:11px;padding:3px 10px;">✏️ Éditer</button>
      <button class="btn btn-ghost" onclick="sensPnjToPublic('${id}')" style="font-size:11px;padding:3px 10px;">🔓 Rendre public</button>`;
    return _sensPnjRow(pnj, btns);
  }).join('');
}

function _sensRenderPnjPublic() {
  const list = _sensState.pnjPublic;
  document.getElementById('sens-pnj-public-count').textContent = list.length + ' PNJ';
  window.sensFilterPnjPublic();
}

window.sensFilterPnjPublic = function() {
  const q = normalize(document.getElementById('sens-pnj-search').value.trim());
  const el = document.getElementById('sens-pnj-public-list');
  if (!q) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Tape un nom pour filtrer…</div>';
    return;
  }
  const matches = _sensState.pnjPublic.filter(pnj =>
    normalize(pnj.name || '').includes(q) || normalize(pnj._id || '').includes(q)
  ).slice(0, 30);
  if (!matches.length) {
    el.innerHTML = '<div style="color:var(--muted);padding:6px 0;font-size:12px;">Aucun résultat.</div>';
    return;
  }
  el.innerHTML = matches.map(pnj => {
    const btn = `<button class="btn btn-ghost" onclick="sensPnjToSensible('${_sensEsc(pnj._id)}')" style="font-size:11px;padding:3px 10px;color:var(--danger);border-color:var(--danger);">🔒 Rendre sensible</button>`;
    return _sensPnjRow(pnj, btn);
  }).join('');
};

// PNJ public → sensible : doc entier vers pnj_secret
window.sensPnjToSensible = async (sourceId) => {
  const pnj = _sensState.pnjPublic.find(x => x._id === sourceId);
  if (!pnj) { toast('PNJ introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${pnj.name || sourceId}" sensible ?\n\nIl disparaîtra complètement du bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(pnj)) if (k !== '_id') payload[k] = v;
    payload.sensible = true;

    await setDoc(doc(db, COL.pnjSecret, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.pnj, sourceId));

    store.invalidate('pnj');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};

// PNJ sensible → public : doc entier vers personnages
window.sensPnjToPublic = async (sourceId) => {
  const pnj = _sensState.pnjSecret.find(x => x._id === sourceId);
  if (!pnj) { toast('PNJ sensible introuvable.', 'info'); return; }
  if (!await modal.confirm(`Rendre "${pnj.name || sourceId}" public ?\n\nIl redeviendra visible dans le bestiaire.`)) return;
  try {
    const payload = {};
    for (const [k, v] of Object.entries(pnj)) if (k !== '_id') payload[k] = v;
    delete payload.sensible;

    await setDoc(doc(db, COL.pnj, sourceId), sanitizeForFirestore(payload));
    await deleteDoc(doc(db, COL.pnjSecret, sourceId));

    store.invalidate('pnj');
    await sensReload();
  } catch (err) {
    toast('Erreur : ' + err.message, 'error');
    console.error(err);
  }
};


// Lu par l'éditeur de données (mise à jour en mémoire après sauvegarde d'une fiche sensible)
ctx.shared.sens = { state: _sensState };
}
