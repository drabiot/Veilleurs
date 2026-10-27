// ══════════════════════════════════════════════════════
// OUTIL IMAGES (texture pack, normalisation, calibrateur, sprites)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { loadExternalScript: _loadExternalScript, cachedDocs, invalidateModCache, escHtml, setHash: _setHash, showPanel: _showPanel, db, COL, getDoc, doc, updateDoc, setDoc, hashName, toast , modal } = ctx;
const { normalize, fuzzyMatch } = window.VCL;
let _imgConfig = null; // { token, repo, branch, templates }
let _imgSelectedItem = null;
let _imgFile = null;
let _imgResize = 256;
let _imgActiveTab = 'upload';

// Templates de référence — format web (préfixe ../ requis pour les pages en sous-dossier).
// L'upload GitHub strip le ../ avant d'envoyer au repo.
const IMG_DEFAULT_TEMPLATES = {
  arme:        '../img/compendium/textures/weapons/{tier}/{id}.png',
  armure:      '../img/compendium/textures/armors/{tier}/{id}.png',
  accessoire:  '../img/compendium/textures/trinkets/{tier}/{id}.png',
  outils:      '../img/compendium/textures/gears/{tier}/{id}.png',
  materiaux:   '../img/compendium/textures/items/Material/{tier}/{id}.png',
  ressources:  '../img/compendium/textures/items/Ressources/{tier}/{id}.png',
  consommable: '../img/compendium/textures/items/Consommable/{tier}/{id}.png',
  nourriture:  '../img/compendium/textures/items/Nourriture/{tier}/{id}.png',
  rune:        '../img/compendium/textures/items/Runes/{tier}/{id}.png',
  parchemin:   '../img/compendium/textures/items/Parchemins/{tier}/{id}.png',
  quete:       '../img/compendium/textures/items/Quest/{tier}/{id}.png',
  donjon:      '../img/compendium/textures/items/Donjon/{tier}/{id}.png',
  monnaie:     '../img/compendium/textures/items/Monnaie/{tier}/{id}.png',
};

function _imgResizeToCanvas(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(b => b ? resolve(b) : reject(new Error('toBlob failed')), 'image/png');
    };
    img.onerror = reject;
    img.src = url;
  });
}

function _imgComputePath(item) {
  const tpl = _imgConfig?.templates?.[item.category] || IMG_DEFAULT_TEMPLATES[item.category];
  if (!tpl) return null;
  const tier = (item.event || (item.palier === 0 || item.palier === 'event')) ? 'events' : (item.palier ? 'P' + item.palier : '');
  const tp   = tier ? tier + '/' : '';
  return tpl
    .replace(/\{tier\}\//g, tp)    // "{tier}/" → "P1/" ou "" (évite le double slash)
    .replace(/\{tier\}/g,   tier)  // "{tier}" seul → "P1" ou ""
    .replace(/\{id\}/g,     item.id || '')
    .replace(/\{palier\}/g, item.palier ?? '')
    .replace(/\{cat\}/g,    item.cat || '');
}

window.showImagesTool = async function() {
  _setHash('images');
  _showPanel('images-tool-panel', 'btn-images-tool');
  await loadImagesTool();
};

window.loadImagesTool = async function() {
  try {
    const snap = await getDoc(doc(db, 'config', 'image_paths'));
    _imgConfig = snap.exists() ? snap.data() : {};
    if (!_imgConfig.templates) _imgConfig.templates = { ...IMG_DEFAULT_TEMPLATES };
    // Migrer les vieux templates (sans ../ ou avec le bug P{palier}')
    for (const [cat, def] of Object.entries(IMG_DEFAULT_TEMPLATES)) {
      const tpl = _imgConfig.templates[cat];
      if (!tpl || !tpl.startsWith('../') || tpl.includes("'")) {
        _imgConfig.templates[cat] = def;
      }
    }
    // Remplir les champs config
    const t = document.getElementById('img-config-token');
    const r = document.getElementById('img-config-repo');
    const b = document.getElementById('img-config-branch');
    if (t) t.value = _imgConfig.token || '';
    if (r) r.value = _imgConfig.repo  || '';
    if (b) b.value = _imgConfig.branch || 'main';
    const s = document.getElementById('img-config-resize');
    if (s) s.value = _imgConfig.resizeSize ?? 256;
    _imgResize = _imgConfig.resizeSize ?? 256;
    _renderImgTemplates();
    _buildImgItemSearch();
  } catch(e) {
    toast('⛔ Erreur chargement config images : ' + e.message, 'error');
  }
};

window.saveImagesConfig = async function() {
  const token      = document.getElementById('img-config-token')?.value?.trim() || '';
  const repo       = document.getElementById('img-config-repo')?.value?.trim()  || '';
  const branch     = document.getElementById('img-config-branch')?.value?.trim() || 'main';
  const resizeSize = parseInt(document.getElementById('img-config-resize')?.value || '256', 10) || 256;
  // Collecter les templates
  const templates = {};
  document.querySelectorAll('.img-tpl-input').forEach(inp => {
    const cat = inp.dataset.cat;
    if (cat) templates[cat] = inp.value.trim() || IMG_DEFAULT_TEMPLATES[cat];
  });
  _imgConfig = { ..._imgConfig, token, repo, branch, templates, resizeSize };
  _imgResize = resizeSize;
  try {
    await setDoc(doc(db, 'config', 'image_paths'), _imgConfig);
    toast('✓ Config images sauvegardée', 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

function _renderImgTemplates() {
  const listEl = document.getElementById('img-templates-list');
  if (!listEl) return;
  listEl.innerHTML = '';
  const cats = Object.keys(IMG_DEFAULT_TEMPLATES);
  for (const cat of cats) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;align-items:center;';
    row.innerHTML = `
      <span style="font-size:12px;min-width:90px;flex-shrink:0;color:var(--text);">${cat}</span>
      <input type="text" class="img-tpl-input" data-cat="${cat}"
        value="${escHtml(_imgConfig?.templates?.[cat] || IMG_DEFAULT_TEMPLATES[cat])}"
        style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 10px;font-size:11px;font-family:monospace;outline:none;">
      <button class="btn btn-ghost" style="font-size:10px;padding:3px 8px;flex-shrink:0;" onclick="this.previousElementSibling.value='${IMG_DEFAULT_TEMPLATES[cat].replace(/'/g,"\\'")}'">↺</button>
    `;
    listEl.appendChild(row);
  }
}

let _imgAllItems = [];

function _buildImgItemSearch() {
  const wrap = document.getElementById('img-item-search-wrap');
  if (!wrap) return;
  wrap.innerHTML = '<div style="font-size:11px;color:var(--muted);">Chargement…</div>';
  Promise.all([
    cachedDocs(COL.items),
    cachedDocs(COL.itemsHidden).catch(() => []),
  ]).then(([docs, hidden]) => {
    _imgAllItems = [
      ...docs.map(d => ({ ...d })),
      ...hidden.map(d => ({ ...d, sensible: true })),
    ];
    wrap.innerHTML = '';
    const inp = document.createElement('input');
    inp.type = 'search'; inp.placeholder = '🔍 Rechercher un item…';
    inp.style.cssText = 'width:100%;box-sizing:border-box;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:8px 10px;font-size:13px;outline:none;';
    const list = document.createElement('div');
    list.style.cssText = 'max-height:200px;overflow-y:auto;background:var(--surface);border:1px solid var(--border);border-radius:6px;display:none;margin-top:2px;';
    wrap.appendChild(inp); wrap.appendChild(list);

    const renderList = (q) => {
      const norm = window.VCL.normalize(q);
      const hits = _imgAllItems.filter(d =>
        window.VCL.fuzzyMatch(norm, d.name||'') || window.VCL.fuzzyMatch(norm, d.id||'')
      ).slice(0, 30);
      list.innerHTML = '';
      if (!hits.length) { list.style.display = 'none'; return; }
      list.style.display = '';
      hits.forEach(d => {
        const row = document.createElement('div');
        row.style.cssText = 'padding:7px 10px;cursor:pointer;font-size:13px;border-bottom:1px solid var(--border);';
        row.innerHTML = `<b>${escHtml(d.name||d.id)}</b> <span style="font-size:10px;color:var(--muted);">${d.category||''} ${d.palier?'P'+d.palier:''} ${d.sensible?'🔒':''}</span>`;
        row.addEventListener('mousedown', e => { e.preventDefault(); inp.value = d.name||d.id; list.style.display='none'; _imgSelectItem(d); });
        list.appendChild(row);
      });
    };
    inp.addEventListener('input', () => renderList(inp.value.trim()));
    inp.addEventListener('focus', () => { if (inp.value.trim()) renderList(inp.value.trim()); });
    inp.addEventListener('blur', () => setTimeout(() => { list.style.display = 'none'; }, 200));
  }).catch(() => { wrap.innerHTML = '<div style="font-size:11px;color:var(--danger);">Erreur chargement items</div>'; });
}

function _imgSelectItem(item) {
  _imgSelectedItem = item;
  const infoEl = document.getElementById('img-item-info');
  const detailEl = document.getElementById('img-item-detail');
  const pathEl  = document.getElementById('img-computed-path');
  const uploadBtn = document.getElementById('img-upload-btn');
  if (!item) {
    if (infoEl) infoEl.style.display = 'none';
    if (uploadBtn) uploadBtn.disabled = true;
    return;
  }
  if (detailEl) detailEl.innerHTML = `<b>${escHtml(item.name || item.id)}</b> · <code>${item.id}</code> · ${item.category || '?'} · ${item.palier ? 'P'+item.palier : '—'}`;
  const path = _imgComputePath(item);
  if (pathEl) pathEl.textContent = path || '(pas de template pour cette catégorie)';
  if (infoEl) infoEl.style.display = '';
  if (uploadBtn) uploadBtn.disabled = !_imgFile || !path;
}

window.imgFileDrop = function(e) {
  e.preventDefault();
  const zone = document.getElementById('img-drop-zone');
  if (zone) zone.style.borderColor = 'var(--border)';
  const file = e.dataTransfer?.files?.[0];
  if (file) _imgSetFile(file);
};

window.imgFileSelect = function(file) { if (file) _imgSetFile(file); };

function _imgSetFile(file) {
  if (!file.type.startsWith('image/')) { toast('⚠️ Fichier image uniquement', 'warning'); return; }
  const size = _imgResize || 256;
  const preview = document.getElementById('img-drop-preview');
  const placeholder = document.getElementById('img-drop-placeholder');
  const sizeInfo = document.getElementById('img-resize-info');
  if (preview) { preview.src = URL.createObjectURL(file); preview.style.display = ''; }
  if (placeholder) placeholder.style.display = 'none';
  if (sizeInfo) { sizeInfo.textContent = '⏳ Redimensionnement…'; sizeInfo.style.color = 'var(--muted)'; }
  _imgResizeToCanvas(file, size).then(blob => {
    _imgFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
    if (preview) preview.src = URL.createObjectURL(blob);
    if (sizeInfo) { sizeInfo.textContent = `✓ Redimensionné : ${size}×${size} px`; sizeInfo.style.color = 'var(--success)'; }
    const uploadBtn = document.getElementById('img-upload-btn');
    if (uploadBtn) uploadBtn.disabled = !_imgSelectedItem || !_imgComputePath(_imgSelectedItem);
  }).catch(() => {
    _imgFile = file;
    if (sizeInfo) { sizeInfo.textContent = '⚠️ Redimensionnement échoué'; sizeInfo.style.color = 'var(--warn)'; }
    const uploadBtn = document.getElementById('img-upload-btn');
    if (uploadBtn) uploadBtn.disabled = !_imgSelectedItem || !_imgComputePath(_imgSelectedItem);
  });
}

window.imgUploadToGithub = async function() {
  if (!_imgSelectedItem || !_imgFile) return;
  const path = _imgComputePath(_imgSelectedItem);
  if (!path) { toast('⚠️ Pas de template configuré pour cette catégorie', 'warning'); return; }
  const token  = _imgConfig?.token  || '';
  const repo   = _imgConfig?.repo   || '';
  const branch = _imgConfig?.branch || 'main';
  if (!token || !repo) { toast('⚠️ Configure le token GitHub et le repo dans l\'onglet Config', 'warning'); switchImgTab('config'); return; }

  const btn    = document.getElementById('img-upload-btn');
  const status = document.getElementById('img-upload-status');
  btn.disabled = true; btn.textContent = '⏳ Envoi…';
  if (status) status.textContent = '';

  try {
    // Lire le fichier en base64
    const base64 = await new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = e => res(e.target.result.split(',')[1]);
      r.onerror = rej;
      r.readAsDataURL(_imgFile);
    });

    // _imgComputePath retourne un path web (../img/...) ; GitHub attend un path repo (img/...)
    const githubPath = path.replace(/^(\.\.\/)+/, '');
    // Vérifier si le fichier existe déjà (pour récupérer son SHA)
    const apiBase = `https://api.github.com/repos/${repo}/contents/${githubPath}`;
    let sha = null;
    try {
      const existing = await fetch(apiBase + `?ref=${branch}`, { headers: { Authorization: `token ${token}` } });
      if (existing.ok) { const j = await existing.json(); sha = j.sha; }
    } catch {}

    const body = { message: `🖼️ Image : ${_imgSelectedItem.name || _imgSelectedItem.id}`, content: base64, branch };
    if (sha) body.sha = sha;

    const resp = await fetch(apiBase, {
      method: 'PUT',
      headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ message: String(resp.status) }));
      const msg = resp.status === 404
        ? 'Repo introuvable ou accès refusé — vérifiez le repo et le token dans Config'
        : (err.message || String(resp.status));
      throw new Error(msg);
    }

    // Mettre à jour le champ images dans Firestore
    if (_imgSelectedItem.sensible) {
      // items_hidden keyé par nameHash — mettre à jour pour que non-contribs voient l'image
      const imgHash = await hashName(_imgSelectedItem.name || '').catch(() => '');
      if (imgHash) try { await updateDoc(doc(db, COL.itemsHidden, imgHash), { images: [path] }); } catch {}
      // Aussi dans items_secret (keyé par item.id) pour les contribs
      const secretId = String(_imgSelectedItem.id || _imgSelectedItem._id || '');
      if (secretId) try { await updateDoc(doc(db, COL.itemsSecret, secretId), { images: [path] }); } catch {}
    } else {
      const docId = String(_imgSelectedItem.id || '');
      if (docId) try { await updateDoc(doc(db, COL.items, docId), { images: [path] }); } catch {}
    }

    if (status) { status.textContent = `✓ Envoyé : ${path}`; status.style.color = 'var(--success)'; }
    toast(`✓ Image envoyée sur GitHub : ${path}`, 'success');
  } catch(e) {
    if (status) { status.textContent = '⛔ ' + e.message; status.style.color = 'var(--danger)'; }
    toast('⛔ Erreur upload : ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '📤 Envoyer sur GitHub';
  }
};

window.resetImagesTool = async function() {
  _imgSelectedItem = null;
  _imgFile = null;
  const preview     = document.getElementById('img-drop-preview');
  const placeholder = document.getElementById('img-drop-placeholder');
  const sizeInfo    = document.getElementById('img-resize-info');
  const itemInfo    = document.getElementById('img-item-info');
  const fileInput   = document.getElementById('img-file-input');
  if (preview)     { preview.src = ''; preview.style.display = 'none'; }
  if (placeholder) placeholder.style.display = '';
  if (sizeInfo)    sizeInfo.textContent = '';
  if (itemInfo)    itemInfo.style.display = 'none';
  if (fileInput)   fileInput.value = '';
  const uploadBtn = document.getElementById('img-upload-btn');
  if (uploadBtn)   uploadBtn.disabled = true;
  const status = document.getElementById('img-upload-status');
  if (status)      status.textContent = '';
  switchImgTab('upload');
  await loadImagesTool();
};

window.switchImgTab = function(name) {
  _imgActiveTab = name;
  const tabs = ['upload', 'textures', 'config'];
  for (const t of tabs) {
    const panel = document.getElementById(`img-tab-${t}`);
    const btn   = document.getElementById(`img-tab-btn-${t}`);
    if (!panel || !btn) continue;
    const active = t === name;
    panel.style.display = active ? '' : 'none';
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
  }
};

// ── Lightbox ──────────────────────────────────────────────────────────────────

let _lbScale = 1, _lbTx = 0, _lbTy = 0;
let _lbDrag = false, _lbDragX = 0, _lbDragY = 0;
let _lbUseCanvas = false;
let _lbSpriteInterval = null, _lbSpriteFrame = 0, _lbSpriteFrames = 0;
let _lbSpriteW = 0, _lbSpriteH = 0, _lbSpriteVert = true, _lbSpriteImg = null;

function _lbActiveEl() {
  return document.getElementById(_lbUseCanvas ? 'tpk-lb-canvas' : 'tpk-lb-img');
}
function _lbSetCursor(c) {
  const img = document.getElementById('tpk-lb-img');
  const cvs = document.getElementById('tpk-lb-canvas');
  if (img) img.style.cursor = c;
  if (cvs) cvs.style.cursor = c;
}


// ── Dessin face avant skin (partagé lightbox + thumbnails) ───────────────────
// Dessine la face avant du personnage dans cvs (adapté à toute taille de canvas)
function _drawSkinFront(img, cvs, W, H) {
  const CW = cvs.width, CH = cvs.height;
  const sc = Math.min(CW / 16, CH / 32);
  const ox = ((CW - 16 * sc) / 2) | 0;
  const oy = ((CH - 32 * sc) / 2) | 0;
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const b = (sx,sy,sw,sh,dx,dy) =>
    ctx.drawImage(img, sx, sy, sw, sh, ox+dx*sc, oy+dy*sc, sw*sc, sh*sc);
  const bf = (sx,sy,sw,sh,dx,dy) => {
    ctx.save();
    ctx.translate(ox+(dx+sw)*sc, oy+dy*sc);
    ctx.scale(-1,1);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw*sc, sh*sc);
    ctx.restore();
  };
  b(8,8,8,8,4,0); b(20,20,8,12,4,8); b(44,20,4,12,0,8); b(4,20,4,12,4,20);
  if (H >= 64) { b(36,52,4,12,12,8); b(20,52,4,12,8,20); }
  else         { bf(44,20,4,12,12,8); bf(4,20,4,12,8,20); }
  b(40,8,8,8,4,0); b(20,36,8,12,4,8); b(44,36,4,12,0,8); b(4,36,4,12,4,20);
  if (H >= 64) { b(52,52,4,12,12,8); b(4,52,4,12,8,20); }
}

function _lbDrawSkin(img, cvs, W, H) {
  cvs.width = 128; cvs.height = 256; // 8× scale for lightbox
  const ctx = cvs.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#18181f';
  ctx.fillRect(0, 0, cvs.width, cvs.height);
  _drawSkinFront(img, cvs, W, H);
}

function _lbDrawSpriteFrame() {
  const cvs = document.getElementById('tpk-lb-canvas');
  if (!cvs || !_lbSpriteImg) return;
  const ctx = cvs.getContext('2d');
  ctx.clearRect(0, 0, cvs.width, cvs.height);
  if (_lbSpriteVert) {
    ctx.drawImage(_lbSpriteImg, 0, _lbSpriteFrame * _lbSpriteH, _lbSpriteW, _lbSpriteH, 0, 0, _lbSpriteW, _lbSpriteH);
  } else {
    ctx.drawImage(_lbSpriteImg, _lbSpriteFrame * _lbSpriteW, 0, _lbSpriteW, _lbSpriteH, 0, 0, _lbSpriteW, _lbSpriteH);
  }
}

// fullPath optionnel — chemin ZIP ou GitHub complet, utilisé pour détecter les skins
window.tpkOpenLightbox = function(url, name, fullPath) {
  const lb    = document.getElementById('tpk-lightbox');
  const img   = document.getElementById('tpk-lb-img');
  const cvs   = document.getElementById('tpk-lb-canvas');
  const nm    = document.getElementById('tpk-lb-name');
  const badge = document.getElementById('tpk-lb-badge');
  if (!lb || !img) return;
  _lbTx = 0; _lbTy = 0; _lbScale = 1; _lbUseCanvas = false;
  if (_lbSpriteInterval) { clearInterval(_lbSpriteInterval); _lbSpriteInterval = null; }
  img.style.display = ''; if (cvs) cvs.style.display = 'none';
  if (badge) { badge.textContent = ''; badge.style.display = 'none'; }
  img.src = '';
  img.onload = () => {
    const W = img.naturalWidth, H = img.naturalHeight;
    const isVertStrip  = H >= W * 2 && H % W === 0;
    const isHorizStrip = W >= H * 2 && W % H === 0;
    // Skin MC : 64×64 ou 64×32 ET chemin contient un indicateur connu
    const pathLow = (fullPath || name || '').toLowerCase();
    const isSkin = W === 64 && (H === 64 || H === 32)
      && /skin|player|steve|alex|char(?:_|$)|humanoid|entity\/player/.test(pathLow);
    if (isSkin && cvs) {
      _lbUseCanvas = true;
      img.style.display = 'none';
      _lbDrawSkin(img, cvs, W, H);
      cvs.style.display = '';
      if (badge) { badge.textContent = `🧑 Skin MC (${W}×${H})`; badge.style.display = ''; }
    } else if ((isVertStrip || isHorizStrip) && cvs) {
      _lbUseCanvas = true;
      img.style.display = 'none';
      _lbSpriteImg = img;
      _lbSpriteVert = isVertStrip;
      if (isVertStrip) { _lbSpriteW = W; _lbSpriteH = W; _lbSpriteFrames = H / W; }
      else             { _lbSpriteW = H; _lbSpriteH = H; _lbSpriteFrames = W / H; }
      _lbSpriteFrame = 0;
      cvs.width = _lbSpriteW; cvs.height = _lbSpriteH;
      cvs.style.display = '';
      _lbDrawSpriteFrame();
      _lbSpriteInterval = setInterval(() => {
        _lbSpriteFrame = (_lbSpriteFrame + 1) % _lbSpriteFrames;
        _lbDrawSpriteFrame();
      }, 80);
      if (badge) { badge.textContent = `🎞️ Spritesheet — ${_lbSpriteFrames} frames`; badge.style.display = ''; }
    }
    const ew = _lbUseCanvas ? (cvs?.width  || W) : W;
    const eh = _lbUseCanvas ? (cvs?.height || H) : H;
    const fit = Math.min(window.innerWidth, window.innerHeight) * 0.65;
    _lbScale = Math.max(1, Math.round(fit / Math.max(ew, eh)));
    _lbUpdate();
  };
  img.src = url;
  if (nm) nm.textContent = name || '';
  lb.style.display = '';
};

window.tpkLbClose = function() {
  const lb = document.getElementById('tpk-lightbox');
  if (lb) lb.style.display = 'none';
  if (_lbSpriteInterval) { clearInterval(_lbSpriteInterval); _lbSpriteInterval = null; }
};

window.tpkLbBgDown = function(e) {
  if (e.target === document.getElementById('tpk-lightbox') ||
      e.target === document.getElementById('tpk-lb-wrap')) tpkLbClose();
};

function _lbUpdate() {
  const el = _lbActiveEl();
  if (el) el.style.transform = `translate(calc(-50% + ${_lbTx}px), calc(-50% + ${_lbTy}px)) scale(${_lbScale})`;
}

// Drag
document.addEventListener('mousedown', e => {
  const el = _lbActiveEl();
  if (e.target !== el) return;
  _lbDrag = true;
  _lbDragX = e.clientX - _lbTx;
  _lbDragY = e.clientY - _lbTy;
  _lbSetCursor('grabbing');
  e.preventDefault();
});
document.addEventListener('mousemove', e => {
  if (!_lbDrag) return;
  _lbTx = e.clientX - _lbDragX;
  _lbTy = e.clientY - _lbDragY;
  _lbUpdate();
});
document.addEventListener('mouseup', () => {
  if (_lbDrag) {
    _lbDrag = false;
    _lbSetCursor('grab');
  }
});

// Zoom molette (centré sur le curseur)
document.addEventListener('wheel', e => {
  const lb = document.getElementById('tpk-lightbox');
  if (!lb || lb.style.display === 'none') return;
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
  const prevScale = _lbScale;
  _lbScale = Math.max(0.25, Math.min(40, _lbScale * factor));
  // Ajuster la translation pour zoomer vers le curseur
  const wrap = document.getElementById('tpk-lb-wrap');
  if (wrap) {
    const rect = wrap.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width  / 2;
    const cy = e.clientY - rect.top  - rect.height / 2;
    _lbTx += cx * (1 - _lbScale / prevScale);
    _lbTy += cy * (1 - _lbScale / prevScale);
  }
  _lbUpdate();
}, { passive: false });

// ESC
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    const lb = document.getElementById('tpk-lightbox');
    if (lb && lb.style.display !== 'none') tpkLbClose();
  }
});

// ── Texture Pack ──────────────────────────────────────────────────────────────

const TPK_REF_KEY        = 'tpk_reference_filenames';
const TPK_LINKS_KEY      = 'tpk_manual_links';
const TPK_VFOLDERS_KEY   = 'vcl_tpk_vfolders';
const TPK_VFLIST_KEY     = 'vcl_tpk_vfolder_list';
const TPK_PAGE           = 60;

let _tpkFiles     = []; // { path, basename, url, isNew, githubPath, matchType }
let _tpkGhFiles   = []; // all github image paths (sorted)
let _tpkGhMap     = new Map(); // lowercase basename → github path (last wins, kept for compat)
let _tpkGhMapAll  = new Map(); // lowercase basename → [github path, ...] (all matches)
let _tpkGhSha     = new Map(); // github path → sha (for blob API)
let _tpkGhInverse = new Map(); // github path → { url, matchType, tpkFile }
let _tpkManual    = new Map(); // tpk path → github path (manual links)
let _tpkLinkSrc   = null;     // tpk file being linked
let _tpkLeftVis   = [];
let _tpkLeftPage  = 0;        // index (pas page) dans _tpkLeftVis
let _tpkFolders   = {};       // folderPath → collapsed bool (panel droit)
let _tpkLeftFolders = {};     // folderPath → collapsed bool (panel gauche)
let _tpkVFolders    = {};     // basename → virtual folder name
let _tpkVFolderList = [];     // ordered list of virtual folder names (always includes 'inutile', 'illisible')
const TPK_PERMANENT = ['inutile', 'illisible'];
function _tpkVFolderIcon(name) { return name === 'inutile' ? '🚫' : name === 'illisible' ? '❓' : '📁'; }
let _tpkVFCollapsed = {};     // virtual folder name → collapsed bool
let _tpkModelMap    = {};     // basename → 'block3d' (has 3D model)
let _tpkSelected    = new Set(); // basenames selected for bulk action

// ── Persistance liens manuels ────────────────────────────────────────────────

function _tpkLoadManual() {
  try {
    const raw = JSON.parse(localStorage.getItem(TPK_LINKS_KEY) || '{}');
    _tpkManual = new Map();
    for (const [k, v] of Object.entries(raw)) {
      // Normalise les anciennes clés (full path) vers basename
      const base = k.includes('/') ? k.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase() : k;
      if (!_tpkManual.has(base)) _tpkManual.set(base, v);
    }
  } catch { _tpkManual = new Map(); }
}
function _tpkSaveManual() {
  localStorage.setItem(TPK_LINKS_KEY, JSON.stringify(Object.fromEntries(_tpkManual)));
}

function _tpkLoadVFolders() {
  try {
    _tpkVFolders = JSON.parse(localStorage.getItem(TPK_VFOLDERS_KEY) || '{}');
    const raw = JSON.parse(localStorage.getItem(TPK_VFLIST_KEY) || '[]');
    _tpkVFolderList = Array.isArray(raw) ? raw : [];
    for (const p of [...TPK_PERMANENT].reverse()) {
      if (!_tpkVFolderList.includes(p)) _tpkVFolderList.unshift(p);
    }
  } catch { _tpkVFolders = {}; _tpkVFolderList = [...TPK_PERMANENT]; }
}
function _tpkSaveVFolders() {
  localStorage.setItem(TPK_VFOLDERS_KEY, JSON.stringify(_tpkVFolders));
  localStorage.setItem(TPK_VFLIST_KEY, JSON.stringify(_tpkVFolderList));
}

// ── Chargement ZIP ───────────────────────────────────────────────────────────

window.tpkLoadZip = async function(file) {
  if (!file) return;
  const statsEl = document.getElementById('tpk-stats');
  if (statsEl) statsEl.textContent = '⏳ Lecture du ZIP…';
  _tpkLinkSrc = null;
  _tpkLoadManual();
  _tpkLoadVFolders();
  try {
    if (typeof JSZip === 'undefined') await _loadExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
    const zip  = await JSZip.loadAsync(file);
    const ref  = new Set(JSON.parse(localStorage.getItem(TPK_REF_KEY) || '[]'));
    const tasks = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir) return;
      const low = relPath.toLowerCase();
      if (!low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.jpeg')) return;
      tasks.push(entry.async('blob').then(blob => ({
        path: relPath,
        basename: relPath.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase(),
        url: URL.createObjectURL(blob),
        isNew: ref.size > 0 && !ref.has(relPath),
        githubPath: null, matchType: null,
      })));
    });
    _tpkFiles = await Promise.all(tasks);
    _tpkFiles.sort((a, b) => a.path.localeCompare(b.path));

    // Parse JSON model files to detect 3D block models
    _tpkModelMap = {};
    _tpkSelected.clear();
    const modelTasks = [];
    zip.forEach((relPath, entry) => {
      if (entry.dir || !relPath.toLowerCase().endsWith('.json')) return;
      modelTasks.push(entry.async('string').then(text => ({ relPath, text })));
    });
    const modelRaws = await Promise.all(modelTasks);
    for (const { relPath, text } of modelRaws) {
      try {
        const data = JSON.parse(text);
        const texs = data.textures || {};
        const has3d = !!data.elements ||
          /block\/(cube|orientable|column|slab|stairs|fence|wall|door|trapdoor)/.test(data.parent || '') ||
          relPath.toLowerCase().includes('/models/block/');
        for (const texRef of Object.values(texs)) {
          const bname = String(texRef).split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
          if (has3d && !_tpkModelMap[bname]) _tpkModelMap[bname] = 'block3d';
        }
      } catch {}
    }
    // Also treat any texture in textures/block/ as 3D
    for (const f of _tpkFiles) {
      if (f.path.toLowerCase().includes('/textures/block/') || f.path.toLowerCase().startsWith('textures/block/')) {
        if (!_tpkModelMap[f.basename]) _tpkModelMap[f.basename] = 'block3d';
      }
    }
    document.getElementById('tpk-save-ref-btn').disabled = false;
    const vBtn = document.getElementById('tpk-visual-btn');
    if (vBtn) vBtn.disabled = false;
    if (_tpkGhMap.size === 0) await _tpkFetchGhTree();
    _tpkApplyMatch();
    tpkRender();
  } catch(e) {
    if (statsEl) statsEl.textContent = '⛔ ' + e.message;
    toast('⛔ Erreur ZIP : ' + e.message, 'error');
  }
};

// ── GitHub tree ──────────────────────────────────────────────────────────────

async function _tpkFetchGhTree() {
  const token  = _imgConfig?.token  || '';
  const repo   = _imgConfig?.repo   || '';
  const branch = _imgConfig?.branch || 'main';
  if (!token || !repo) return;
  const ghBtn = document.getElementById('tpk-gh-btn');
  if (ghBtn) { ghBtn.disabled = true; ghBtn.textContent = '⏳…'; }
  try {
    const resp = await fetch(
      `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`,
      { headers: { Authorization: `token ${token}` } }
    );
    if (!resp.ok) throw new Error(resp.status);
    const data = await resp.json();
    _tpkGhMap.clear(); _tpkGhMapAll.clear(); _tpkGhFiles = []; _tpkGhSha.clear();
    (data.tree || []).forEach(node => {
      if (node.type !== 'blob') return;
      const low = node.path.toLowerCase();
      if (!low.endsWith('.png') && !low.endsWith('.jpg') && !low.endsWith('.jpeg')) return;
      const base = node.path.split('/').pop().replace(/\.[^.]+$/, '').toLowerCase();
      _tpkGhMap.set(base, node.path);
      if (!_tpkGhMapAll.has(base)) _tpkGhMapAll.set(base, []);
      _tpkGhMapAll.get(base).push(node.path);
      _tpkGhSha.set(node.path, node.sha);
      _tpkGhFiles.push(node.path);
    });
    _tpkGhFiles.sort();
    if (ghBtn) { ghBtn.disabled = false; ghBtn.textContent = '🔄 GitHub'; }
    toast(`✓ ${_tpkGhFiles.length} fichiers GitHub`, 'success');
  } catch(e) {
    if (ghBtn) { ghBtn.disabled = false; ghBtn.textContent = '🔄 GitHub'; }
    toast('⛔ Erreur GitHub : ' + e.message, 'error');
  }
}

window.tpkRefreshGithub = async function() {
  _tpkGhMap.clear(); _tpkGhMapAll.clear(); _tpkGhFiles = [];
  await _tpkFetchGhTree();
  _tpkApplyMatch();
  tpkRender();
};

// ── Matching (auto + manuel) ─────────────────────────────────────────────────

function _tpkPathScore(zipPath, ghPath) {
  const z = zipPath.toLowerCase().split('/').slice(0, -1).reverse();
  const g = ghPath.toLowerCase().split('/').slice(0, -1).reverse();
  let score = 0;
  for (let i = 0; i < Math.min(z.length, g.length); i++) {
    if (z[i] === g[i]) score++;
    else break;
  }
  return score;
}

function _tpkBestGhPath(zipFile, candidates) {
  if (!candidates || !candidates.length) return null;
  if (candidates.length === 1) return candidates[0];
  return candidates.reduce((best, p) =>
    _tpkPathScore(zipFile.path, p) > _tpkPathScore(zipFile.path, best) ? p : best,
    candidates[0]
  );
}

function _tpkApplyMatch() {
  _tpkGhInverse.clear();
  for (const f of _tpkFiles) {
    const manual     = _tpkManual.get(f.basename);
    const candidates = _tpkGhMapAll.get(f.basename) || [];
    if (manual === '__none__') {
      f.githubPath = null; f.matchType = null;
    } else if (manual) {
      f.githubPath = manual; f.matchType = 'manual';
      _tpkGhInverse.set(manual, { url: f.url, matchType: 'manual', tpkFile: f });
    } else {
      // Pick the GitHub path that best matches this ZIP file's folder structure
      const available = candidates.filter(p => !_tpkGhInverse.has(p));
      const auto = _tpkBestGhPath(f, available);
      if (auto) {
        f.githubPath = auto; f.matchType = 'auto';
        _tpkGhInverse.set(auto, { url: f.url, matchType: 'auto', tpkFile: f });
      } else {
        f.githubPath = null; f.matchType = null;
      }
    }
  }
}

// ── Animation thumbnails (boucle RAF partagée) ───────────────────────────────

let _tpkAnimCells = []; // { type, cvs, img/imgs, w, h, vert, frames, frame, interval, lastTick }
let _tpkAnimRAF   = null;
let _tpkScrollObs = null; // IntersectionObserver for infinite scroll

function _tpkStartAnimLoop() {
  if (_tpkAnimRAF) return;
  function loop(ts) {
    _tpkAnimRAF = requestAnimationFrame(loop);
    let alive = false;
    for (const a of _tpkAnimCells) {
      if (!a.cvs.isConnected) continue;
      alive = true;
      if (ts - (a.lastTick || 0) < a.interval) continue;
      a.lastTick = ts;
      a.frame = (a.frame + 1) % a.frames;
      const ctx = a.cvs.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, a.cvs.width, a.cvs.height);
      if (a.type === 'sprite') {
        if (a.vert) ctx.drawImage(a.img, 0, a.frame*a.h, a.w, a.h, 0, 0, a.cvs.width, a.cvs.height);
        else        ctx.drawImage(a.img, a.frame*a.w, 0, a.w, a.h, 0, 0, a.cvs.width, a.cvs.height);
      } else if (a.type === 'pair') {
        ctx.drawImage(a.imgs[a.frame], 0, 0, a.cvs.width, a.cvs.height);
      }
    }
    if (!alive) { cancelAnimationFrame(_tpkAnimRAF); _tpkAnimRAF = null; _tpkAnimCells = []; }
  }
  _tpkAnimRAF = requestAnimationFrame(loop);
}

function _tpkStopAnimLoop() {
  if (_tpkAnimRAF) { cancelAnimationFrame(_tpkAnimRAF); _tpkAnimRAF = null; }
  _tpkAnimCells = [];
}

// ── Sélection multiple ───────────────────────────────────────────────────────

function _tpkUpdateSelBar() {
  const bar   = document.getElementById('tpk-sel-bar');
  const count = document.getElementById('tpk-sel-count');
  if (!bar) return;
  const n = _tpkSelected.size;
  bar.style.display = n > 0 ? 'flex' : 'none';
  if (count) count.textContent = `${n} sélectionné${n > 1 ? 's' : ''}`;
}

function _tpkSetChk(chk, sel) {
  chk.style.borderColor = sel ? 'var(--accent)' : 'rgba(255,255,255,0.35)';
  chk.style.background  = sel ? 'var(--accent)' : 'rgba(0,0,0,0.45)';
  chk.innerHTML = sel ? '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>' : '';
}

function _tpkSelMoveTo(targetFolder) {
  if (!_tpkSelected.size) return;
  const panel = document.getElementById('images-tool-panel');
  const scrollTop = panel ? panel.scrollTop : 0;
  for (const bn of _tpkSelected) _tpkVFolders[bn] = targetFolder;
  _tpkSelected.clear();
  _tpkSaveVFolders();
  tpkRender();
  if (panel) panel.scrollTop = scrollTop;
}
window.tpkSelToInutile   = () => _tpkSelMoveTo('inutile');
window.tpkSelToIllisible = () => _tpkSelMoveTo('illisible');

window.tpkSelClear = function() {
  _tpkSelected.clear();
  document.querySelectorAll('.tpk-cell-chk').forEach(chk => _tpkSetChk(chk, false));
  document.querySelectorAll('.tpk-cell').forEach(c => { c.style.outline = ''; });
  _tpkUpdateSelBar();
};

function _tpkBuildRawEntries(files) {
  const baseMap = new Map(files.map(f => [f.basename, f]));
  const paired  = new Set();
  const entries = [];
  for (const f of files) {
    if (paired.has(f)) continue;
    const eFile = baseMap.get(f.basename + '_e');
    if (eFile && !paired.has(eFile)) {
      paired.add(f); paired.add(eFile);
      entries.push({ pair: [f, eFile] });
    } else if (f.basename.endsWith('_e')) {
      const base = baseMap.get(f.basename.slice(0, -2));
      if (base && !paired.has(base)) {
        paired.add(f); paired.add(base);
        entries.push({ pair: [base, f] });
      } else { entries.push({ single: f }); }
    } else { entries.push({ single: f }); }
  }
  return entries;
}

// ── Rendu gauche (grille) ────────────────────────────────────────────────────

window.tpkRender = function() {
  _tpkStopAnimLoop();
  const q = (document.getElementById('tpk-search')?.value || '').toLowerCase();
  const unmatchedAll = _tpkFiles.filter(f => !f.githubPath && (!q || f.path.toLowerCase().includes(q)));
  const unmatched = unmatchedAll.filter(f => !_tpkVFolders[f.basename]);
  unmatched.sort((a, b) => a.path.localeCompare(b.path));
  // Clean up selection: remove items no longer in unmatched
  const unmatchedSet = new Set(unmatched.map(f => f.basename));
  for (const bn of [..._tpkSelected]) { if (!unmatchedSet.has(bn)) _tpkSelected.delete(bn); }
  _tpkUpdateSelBar();

  // Séparer nouveau vs existant
  const newFiles     = unmatched.filter(f => f.isNew);
  const regularFiles = unmatched.filter(f => !f.isNew);

  _tpkLeftVis = [];

  // ── Section NOUVEAU ──
  if (newFiles.length > 0) {
    const newCollapsed = _tpkLeftFolders['__new__'] ?? false;
    _tpkLeftVis.push({ newSection: true, count: newFiles.length, collapsed: newCollapsed });
    if (!newCollapsed) _tpkLeftVis.push(..._tpkBuildRawEntries(newFiles));
  }

  // ── Dossiers ZIP (fichiers existants) ──
  const byFolder = new Map();
  for (const entry of _tpkBuildRawEntries(regularFiles)) {
    const f = entry.pair ? entry.pair[0] : entry.single;
    const parts = f.path.split('/');
    const folder = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
    if (!byFolder.has(folder)) byFolder.set(folder, []);
    byFolder.get(folder).push(entry);
  }
  for (const [folder, entries] of [...byFolder.entries()].sort()) {
    const collapsed = _tpkLeftFolders[folder] ?? false;
    if (folder) _tpkLeftVis.push({ folder, count: entries.length, collapsed });
    if (!collapsed) _tpkLeftVis.push(...entries);
  }

  const newCount     = _tpkFiles.filter(f => f.isNew && !f.githubPath).length;
  const manualCount  = [..._tpkManual.values()].filter(v => v !== '__none__').length;
  const vfolderCount = unmatchedAll.length - unmatched.length;
  const statsEl = document.getElementById('tpk-stats');
  if (statsEl) statsEl.textContent = [
    `${_tpkFiles.length} textures`,
    `${_tpkGhInverse.size} matchées`,
    `${unmatched.length} à trier`,
    vfolderCount  ? `${vfolderCount} en dossiers` : '',
    newCount      ? `${newCount} nouvelles`        : '',
    manualCount   ? `${manualCount} liens manuels` : '',
  ].filter(Boolean).join(' · ');

  const lc = document.getElementById('tpk-left-count');
  const rc = document.getElementById('tpk-right-count');
  if (lc) lc.textContent = `(${unmatched.length})`;
  if (rc) rc.textContent = `(${_tpkGhInverse.size}/${_tpkGhFiles.length})`;

  const banner = document.getElementById('tpk-link-banner');
  if (banner) {
    if (_tpkLinkSrc) {
      banner.style.display = '';
      banner.textContent = `🔗 Mode liaison actif — clique sur le "?" correspondant à droite pour lier "${_tpkLinkSrc.path.split('/').pop()}" · reclique sur la texture pour annuler`;
    } else {
      banner.style.display = 'none';
    }
  }

  if (_tpkScrollObs) { _tpkScrollObs.disconnect(); _tpkScrollObs = null; }
  const leftEl = document.getElementById('tpk-left');
  if (leftEl) leftEl.innerHTML = '';
  _tpkLeftPage = 0;
  tpkLeftMore();
  _tpkRenderTree(q);
  _tpkRenderVFolders();
};

window.tpkLeftMore = function() {
  const el = document.getElementById('tpk-left');
  if (!el) return;
  let shown = 0;
  while (_tpkLeftPage < _tpkLeftVis.length && shown < TPK_PAGE) {
    const entry = _tpkLeftVis[_tpkLeftPage++];
    if (entry.newSection) {
      el.appendChild(_tpkMakeNewSectionHeader(entry));
    } else if (entry.folder !== undefined) {
      el.appendChild(_tpkMakeFolderHeaderLeft(entry));
    } else {
      el.appendChild(entry.pair ? _tpkMakePairCell(entry.pair[0], entry.pair[1]) : _tpkMakeLeftCell(entry.single));
      shown++;
    }
  }
  if (_tpkLeftPage < _tpkLeftVis.length) {
    const sentinel = document.createElement('div');
    sentinel.style.cssText = 'height:4px;grid-column:1/-1;';
    el.appendChild(sentinel);
    if (_tpkScrollObs) _tpkScrollObs.disconnect();
    _tpkScrollObs = new IntersectionObserver(entries => {
      if (!entries[0].isIntersecting) return;
      _tpkScrollObs.disconnect(); _tpkScrollObs = null;
      sentinel.remove();
      tpkLeftMore();
    }, { root: document.getElementById('images-tool-panel'), rootMargin: '300px', threshold: 0 });
    _tpkScrollObs.observe(sentinel);
  }
};

function _tpkMakeNewSectionHeader(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:6px;padding:6px 4px 4px;margin-top:2px;border-top:2px solid var(--accent);font-size:11px;font-weight:700;color:var(--accent);cursor:pointer;user-select:none;';
  div.innerHTML = `<span style="font-size:9px;opacity:.7;">${entry.collapsed ? '▶' : '▼'}</span><span>✨ NOUVEAU</span><span style="font-size:10px;font-weight:400;opacity:.7;">(${entry.count})</span>`;
  div.addEventListener('click', () => {
    _tpkLeftFolders['__new__'] = !entry.collapsed;
    tpkRender();
  });
  // Checkbox sélection globale section NOUVEAU
  const newFiles = _tpkFiles.filter(f => f.isNew && !f.githubPath && !_tpkVFolders[f.basename]);
  const allSel = newFiles.length > 0 && newFiles.every(f => _tpkSelected.has(f.basename));
  const chk = document.createElement('div');
  chk.style.cssText = `width:12px;height:12px;border:2px solid ${allSel?'var(--accent)':'rgba(200,200,200,0.35)'};border-radius:2px;background:${allSel?'var(--accent)':'rgba(0,0,0,0.35)'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;
  if (allSel) chk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  chk.addEventListener('click', e => {
    e.stopPropagation();
    const files = _tpkFiles.filter(f => f.isNew && !f.githubPath && !_tpkVFolders[f.basename]);
    const nowAll = files.length > 0 && files.every(f => _tpkSelected.has(f.basename));
    const basenames = new Set(files.map(f => f.basename));
    for (const f of files) { if (nowAll) _tpkSelected.delete(f.basename); else _tpkSelected.add(f.basename); }
    const newSel = !nowAll;
    document.querySelectorAll('.tpk-cell-chk').forEach(c => {
      if (basenames.has(c.dataset.basename)) {
        _tpkSetChk(c, newSel);
        const cell = c.closest('.tpk-cell');
        if (cell) cell.style.outline = newSel ? '2px solid var(--accent)' : '';
      }
    });
    _tpkSetChk(chk, newSel);
    _tpkUpdateSelBar();
  });
  div.insertBefore(chk, div.firstChild);
  return div;
}

function _tpkMakeFolderHeaderLeft(entry) {
  const div = document.createElement('div');
  div.style.cssText = 'grid-column:1/-1;display:flex;align-items:center;gap:5px;padding:5px 3px 3px;margin-top:4px;border-top:1px solid var(--border);font-size:10px;color:var(--muted);cursor:pointer;user-select:none;';
  div.innerHTML = `<span style="font-size:9px;opacity:.55;">${entry.collapsed ? '▶' : '▼'}</span><span>📁 ${escHtml(entry.folder)}</span><span style="opacity:.4;">(${entry.count})</span>`;
  div.addEventListener('click', () => {
    _tpkLeftFolders[entry.folder] = !entry.collapsed;
    tpkRender();
  });
  // Checkbox sélection dossier
  const folderFiles = _tpkFiles.filter(f => !f.githubPath && !_tpkVFolders[f.basename] && f.path.startsWith(entry.folder + '/'));
  const allSel = folderFiles.length > 0 && folderFiles.every(f => _tpkSelected.has(f.basename));
  const folderChk = document.createElement('div');
  folderChk.style.cssText = `width:12px;height:12px;border:2px solid ${allSel?'var(--accent)':'rgba(200,200,200,0.35)'};border-radius:2px;background:${allSel?'var(--accent)':'rgba(0,0,0,0.35)'};cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;`;
  if (allSel) folderChk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  folderChk.addEventListener('click', e => {
    e.stopPropagation();
    const files = _tpkFiles.filter(f => !f.githubPath && !_tpkVFolders[f.basename] && f.path.startsWith(entry.folder + '/'));
    const nowAllSel = files.length > 0 && files.every(f => _tpkSelected.has(f.basename));
    const basenames = new Set(files.map(f => f.basename));
    for (const f of files) { if (nowAllSel) _tpkSelected.delete(f.basename); else _tpkSelected.add(f.basename); }
    const newSel = !nowAllSel;
    // Update visible cell checkboxes for this folder
    document.querySelectorAll('.tpk-cell-chk').forEach(chk => {
      if (basenames.has(chk.dataset.basename)) {
        _tpkSetChk(chk, newSel);
        const c = chk.closest('.tpk-cell');
        if (c) { c.style.outline = newSel ? '2px solid var(--accent)' : ''; }
      }
    });
    _tpkSetChk(folderChk, newSel);
    _tpkUpdateSelBar();
  });
  div.insertBefore(folderChk, div.firstChild);
  const inutileBtn = document.createElement('button');
  inutileBtn.textContent = '🚫';
  inutileBtn.title = 'Tout mettre dans "inutile"';
  inutileBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:10px;padding:0 3px;opacity:.5;line-height:1;flex-shrink:0;';
  inutileBtn.addEventListener('click', e => {
    e.stopPropagation();
    const panel = document.getElementById('images-tool-panel');
    const scrollTop = panel ? panel.scrollTop : 0;
    const prefix = entry.folder + '/';
    const affected = _tpkFiles.filter(f => !f.githubPath && f.path.startsWith(prefix));
    for (const f of affected) _tpkVFolders[f.basename] = 'inutile';
    _tpkSaveVFolders();
    tpkRender();
    if (panel) panel.scrollTop = scrollTop;
  });
  div.appendChild(inutileBtn);
  return div;
}

// ── Dossiers virtuels (local, non-GitHub) ───────────────────────────────────

function _tpkRenderVFolders() {
  const el = document.getElementById('tpk-left-vfolders');
  if (!el) return;
  el.innerHTML = '';
  if (!_tpkVFolderList.length) return;
  const q = (document.getElementById('tpk-search')?.value || '').toLowerCase();

  for (const folderName of _tpkVFolderList) {
    const folderFiles = _tpkFiles.filter(f =>
      !f.githubPath &&
      _tpkVFolders[f.basename] === folderName &&
      (!q || f.path.toLowerCase().includes(q))
    );

    const collapsed = _tpkVFCollapsed[folderName] ?? true;
    const section   = document.createElement('div');
    section.style.cssText = 'margin-top:10px;';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:5px;padding:5px 3px;border-top:1px solid var(--border);font-size:11px;font-weight:700;cursor:pointer;user-select:none;';
    const icon = _tpkVFolderIcon(folderName);
    header.innerHTML = `<span style="font-size:9px;opacity:.55;">${collapsed ? '▶' : '▼'}</span><span>${icon} ${escHtml(folderName)}</span><span style="font-size:10px;font-weight:400;color:var(--muted);">(${folderFiles.length})</span>`;
    header.addEventListener('click', () => {
      _tpkVFCollapsed[folderName] = !collapsed;
      _tpkRenderVFolders();
    });

    if (!TPK_PERMANENT.includes(folderName)) {
      const delBtn = document.createElement('button');
      delBtn.textContent = '🗑️';
      delBtn.title = 'Supprimer ce dossier (les textures retournent à "À trier")';
      delBtn.style.cssText = 'margin-left:auto;background:none;border:none;cursor:pointer;font-size:11px;padding:0 4px;opacity:.45;';
      delBtn.addEventListener('click', e => { e.stopPropagation(); tpkDeleteVFolder(folderName); });
      header.appendChild(delBtn);
    }
    section.appendChild(header);

    if (!collapsed) {
      if (folderFiles.length === 0) {
        const empty = document.createElement('div');
        empty.style.cssText = 'font-size:11px;color:var(--muted);padding:8px 4px;text-align:center;opacity:.5;';
        empty.textContent = 'Vide';
        section.appendChild(empty);
      } else {
        const grid = document.createElement('div');
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(72px,1fr));gap:5px;padding-top:6px;';
        for (const f of folderFiles) grid.appendChild(_tpkMakeLeftCell(f));
        section.appendChild(grid);
      }
    }
    el.appendChild(section);
  }
}

function _tpkShowVFolderMenu(e, f) {
  document.querySelectorAll('.tpk-ctx-menu').forEach(m => m.remove());
  const current = _tpkVFolders[f.basename];
  const menu    = document.createElement('div');
  menu.className = 'tpk-ctx-menu';
  const left = Math.min(e.clientX, window.innerWidth  - 180);
  const top  = Math.min(e.clientY, window.innerHeight - 200);
  menu.style.cssText = `position:fixed;left:${left}px;top:${top}px;background:var(--surface);border:1px solid var(--border);border-radius:7px;z-index:9999;padding:4px 0;min-width:160px;box-shadow:0 4px 18px rgba(0,0,0,.4);`;

  const addItem = (html, onClick, color) => {
    const item = document.createElement('div');
    item.innerHTML = html;
    item.style.cssText = `padding:6px 12px;font-size:12px;cursor:pointer;color:${color || 'var(--text)'};white-space:nowrap;`;
    item.addEventListener('mouseenter', () => item.style.background = 'var(--surface2)');
    item.addEventListener('mouseleave', () => item.style.background = '');
    item.addEventListener('mousedown', ev => { ev.stopPropagation(); menu.remove(); onClick(); });
    menu.appendChild(item);
  };
  const addSep = () => { const s = document.createElement('div'); s.style.cssText = 'height:1px;background:var(--border);margin:3px 0;'; menu.appendChild(s); };

  if (current) {
    addItem(`✕ Retirer de <b>${escHtml(current)}</b>`, () => {
      delete _tpkVFolders[f.basename];
      _tpkSaveVFolders();
      tpkRender();
    }, 'var(--danger)');
    addSep();
  }

  for (const name of _tpkVFolderList) {
    if (name === current) continue;
    const icon = _tpkVFolderIcon(name);
    addItem(`${icon} ${escHtml(name)}`, () => {
      _tpkVFolders[f.basename] = name;
      _tpkSaveVFolders();
      tpkRender();
    });
  }

  document.body.appendChild(menu);
  const close = ev => { if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('mousedown', close); } };
  setTimeout(() => document.addEventListener('mousedown', close), 0);
}

window.tpkCreateVFolder = function() {
  const name = window.prompt('Nom du nouveau dossier :', '');
  if (!name || !name.trim()) return;
  const clean = name.trim().toLowerCase();
  if (_tpkVFolderList.includes(clean)) { toast('Ce dossier existe déjà', 'warning'); return; }
  _tpkVFolderList.push(clean);
  _tpkVFCollapsed[clean] = false;
  _tpkSaveVFolders();
  _tpkRenderVFolders();
};

window.tpkDeleteVFolder = function(folderName) {
  if (TPK_PERMANENT.includes(folderName)) return;
  for (const k of Object.keys(_tpkVFolders)) {
    if (_tpkVFolders[k] === folderName) delete _tpkVFolders[k];
  }
  _tpkVFolderList = _tpkVFolderList.filter(n => n !== folderName);
  _tpkSaveVFolders();
  tpkRender();
};

window.tpkCollapseAll = function(val) {
  // Section NOUVEAU
  _tpkLeftFolders['__new__'] = val;
  // Left ZIP panel — direct parent folders of all unmatched files
  for (const f of _tpkFiles) {
    const parts = f.path.split('/');
    if (parts.length > 1) _tpkLeftFolders[parts.slice(0, -1).join('/')] = val;
  }
  // Right GitHub panel — all folder paths in tree
  for (const p of _tpkGhFiles) {
    const parts = p.split('/');
    for (let i = 1; i < parts.length; i++) {
      _tpkFolders[parts.slice(0, i).join('/')] = val;
    }
  }
  // Virtual folders
  for (const name of _tpkVFolderList) _tpkVFCollapsed[name] = val;
  tpkRender();
};

// Détecte le type de texture d'un fichier pour le rendu dans la grille
function _tpkDetectType(f) {
  const W = f._w, H = f._h;
  if (!W || !H) return 'normal';
  if (_tpkModelMap[f.basename]) return 'model3d';
  if (W === 64 && (H === 64 || H === 32) &&
      /skin|player|steve|alex|char(?:_|$)|humanoid|entity\/player/.test(f.path.toLowerCase())) return 'skin';
  if (H >= W * 2 && H % W === 0) return 'sprite-vert';
  if (W >= H * 2 && W % H === 0) return 'sprite-horiz';
  return 'normal';
}

function _tpkMakeThumbCanvas(f, size) {
  const cvs = document.createElement('canvas');
  cvs.width = size; cvs.height = size;
  cvs.style.cssText = `width:${size}px;height:${size}px;image-rendering:pixelated;cursor:zoom-in;display:block;`;
  cvs.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(f.url, f.path.split('/').pop(), f.path); });
  const tmpImg = new Image();
  tmpImg.src = f.url;
  tmpImg.onload = () => {
    f._w = tmpImg.naturalWidth; f._h = tmpImg.naturalHeight;
    const type = _tpkDetectType(f);
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, size, size);
    if (type === 'skin') {
      ctx.fillStyle = '#18181f'; ctx.fillRect(0, 0, size, size);
      _drawSkinFront(tmpImg, cvs, f._w, f._h);
    } else if (type === 'model3d') {
      ctx.drawImage(tmpImg, 0, 0, size, size);
      // Badge 3D overlay
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, size - 11, size, 11);
      ctx.fillStyle = '#7ecfff';
      ctx.font = `bold ${Math.max(7, size/7.5)|0}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('3D', size/2, size - 5.5);
      ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic';
    } else if (type === 'sprite-vert' || type === 'sprite-horiz') {
      const vert   = type === 'sprite-vert';
      const fw = vert ? f._w : f._h;
      const fh = vert ? f._w : f._h;
      const frames = vert ? f._h / f._w : f._w / f._h;
      ctx.drawImage(tmpImg, 0, 0, fw, fh, 0, 0, size, size);
      _tpkAnimCells.push({ type:'sprite', cvs, img:tmpImg, w:fw, h:fh, vert, frames, frame:0, interval:80, lastTick:0 });
      _tpkStartAnimLoop();
    } else {
      ctx.drawImage(tmpImg, 0, 0, size, size);
    }
  };
  return cvs;
}


function _tpkMakeLeftCell(f) {
  const name     = f.path.split('/').pop();
  const linking  = _tpkLinkSrc === f;
  const isSel    = _tpkSelected.has(f.basename);
  const border   = linking ? 'var(--warn)' : isSel ? 'var(--accent)' : f.isNew ? 'var(--accent)' : 'var(--border)';
  const bg       = linking ? 'color-mix(in srgb,var(--warn) 15%,var(--surface2))'
                 : isSel   ? 'color-mix(in srgb,var(--accent) 18%,var(--surface2))'
                 : f.isNew ? 'color-mix(in srgb,var(--accent) 10%,var(--surface2))' : 'var(--surface2)';
  const cell = document.createElement('div');
  cell.className = 'tpk-cell';
  cell.title = f.path;
  cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:6px;border:2px solid ${border};background:${bg};position:relative;${isSel ? 'outline:2px solid var(--accent);outline-offset:1px;' : ''}`;
  cell.appendChild(_tpkMakeThumbCanvas(f, 52));
  cell.insertAdjacentHTML('beforeend', `
    <span style="font-size:9px;color:var(--muted);word-break:break-all;text-align:center;line-height:1.2;max-width:68px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(name)}</span>
    ${f.isNew ? '<span style="font-size:8px;color:var(--accent);font-weight:700;">NEW</span>' : ''}`);
  // Checkbox sélection (top-left)
  const chk = document.createElement('div');
  chk.className = 'tpk-cell-chk';
  chk.dataset.basename = f.basename;
  chk.style.cssText = `position:absolute;top:2px;left:2px;width:13px;height:13px;border:2px solid ${isSel?'var(--accent)':'rgba(255,255,255,0.35)'};border-radius:3px;background:${isSel?'var(--accent)':'rgba(0,0,0,0.45)'};cursor:pointer;z-index:2;display:flex;align-items:center;justify-content:center;flex-shrink:0;`;
  if (isSel) chk.innerHTML = '<span style="color:#fff;font-size:8px;line-height:1;font-weight:700;">✓</span>';
  chk.addEventListener('click', e => {
    e.stopPropagation();
    const now = !_tpkSelected.has(f.basename);
    if (now) _tpkSelected.add(f.basename); else _tpkSelected.delete(f.basename);
    _tpkSetChk(chk, now);
    cell.style.outline = now ? '2px solid var(--accent)' : '';
    cell.style.background = now ? 'color-mix(in srgb,var(--accent) 18%,var(--surface2))' : bg;
    _tpkUpdateSelBar();
  });
  cell.appendChild(chk);
  // Bouton liaison (top-right)
  const linkBtn = document.createElement('button');
  linkBtn.textContent = '🔗';
  linkBtn.title = linking ? 'Annuler liaison' : 'Lier manuellement à un fichier GitHub';
  linkBtn.style.cssText = `position:absolute;top:2px;right:2px;background:${linking ? 'var(--warn)' : 'rgba(0,0,0,.35)'};border:none;border-radius:3px;color:#fff;font-size:9px;padding:1px 3px;cursor:pointer;line-height:1.4;`;
  linkBtn.addEventListener('click', e => { e.stopPropagation(); _tpkLinkSrc = _tpkLinkSrc === f ? null : f; tpkRender(); });
  cell.appendChild(linkBtn);
  cell.addEventListener('contextmenu', e => { e.preventDefault(); _tpkShowVFolderMenu(e, f); });
  return cell;
}

function _tpkMakePairCell(fb, fe) {
  const cell = document.createElement('div');
  cell.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 3px;border-radius:6px;border:2px solid var(--accent);background:color-mix(in srgb,var(--accent) 8%,var(--surface2));position:relative;';
  cell.title = fb.path + '\n+ ' + fe.path;

  // Canvas animé base ↔ emissive (une frame par seconde)
  const cvs = document.createElement('canvas');
  cvs.width = 52; cvs.height = 52;
  cvs.style.cssText = 'width:52px;height:52px;image-rendering:pixelated;cursor:zoom-in;display:block;';
  cvs.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(fb.url, fb.path.split('/').pop(), fb.path); });

  let imgB = null, imgE = null;
  const tryReg = () => {
    if (!imgB || !imgE) return;
    const ctx = cvs.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, 52, 52);
    ctx.drawImage(imgB, 0, 0, 52, 52);
    _tpkAnimCells.push({ type:'pair', cvs, imgs:[imgB, imgE], frames:2, frame:0, interval:1000, lastTick:0 });
    _tpkStartAnimLoop();
  };
  const lb = new Image(); lb.src = fb.url; lb.onload = () => { imgB = lb; tryReg(); };
  const le = new Image(); le.src = fe.url; le.onload = () => { imgE = le; tryReg(); };

  cell.appendChild(cvs);
  const nm = fb.path.split('/').pop().replace(/\.[^.]+$/, '');
  cell.insertAdjacentHTML('beforeend', `
    <span style="font-size:9px;color:var(--muted);text-align:center;overflow:hidden;max-width:68px;white-space:nowrap;text-overflow:ellipsis;">${escHtml(nm)}</span>
    <span style="font-size:7px;color:var(--accent);">+_e</span>`);
  const lnkRow = document.createElement('div');
  lnkRow.style.cssText = 'display:flex;gap:3px;';
  const makeLnk = f => {
    const sel = _tpkLinkSrc === f;
    const b = document.createElement('button');
    b.textContent = '🔗';
    b.title = (sel ? 'Annuler' : 'Lier') + ' ' + f.path.split('/').pop();
    b.style.cssText = `background:${sel?'var(--warn)':'rgba(0,0,0,.35)'};border:none;border-radius:3px;color:#fff;font-size:9px;padding:1px 4px;cursor:pointer;`;
    b.addEventListener('click', e => { e.stopPropagation(); _tpkLinkSrc = _tpkLinkSrc === f ? null : f; tpkRender(); });
    return b;
  };
  lnkRow.appendChild(makeLnk(fb));
  lnkRow.appendChild(makeLnk(fe));
  cell.appendChild(lnkRow);
  return cell;
}

// ── Rendu droit (arbre dossiers GitHub) ─────────────────────────────────────

function _tpkBuildNode(paths) {
  const root = {};
  for (const p of paths) {
    const parts = p.split('/');
    let cur = root;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]]) cur[parts[i]] = { __files: [] };
      cur = cur[parts[i]];
    }
    if (!cur.__files) cur.__files = [];
    cur.__files.push(p);
  }
  return root;
}

function _tpkRenderTree(q) {
  const el = document.getElementById('tpk-right');
  if (!el) return;
  el.innerHTML = '';
  if (!_tpkGhFiles.length) {
    el.innerHTML = '<div style="font-size:11px;color:var(--muted);padding:6px;">Configure le token GitHub puis charge un ZIP.</div>';
    return;
  }
  const files = q ? _tpkGhFiles.filter(p => p.toLowerCase().includes(q)) : _tpkGhFiles;
  _tpkRenderNode(_tpkBuildNode(files), '', el, 0, !!q);
}

function _tpkRenderNode(node, prefix, container, depth, forceExpand) {
  const indent = depth * 16;
  for (const [key, child] of Object.entries(node)) {
    if (key === '__files') continue;
    const fp = prefix ? `${prefix}/${key}` : key;
    const collapsed = forceExpand ? false : (_tpkFolders[fp] ?? (depth >= 1));
    const wrap = document.createElement('div');
    const header = document.createElement('div');
    header.style.cssText = `display:flex;align-items:center;gap:4px;padding:2px 4px 2px ${indent + 2}px;cursor:pointer;border-radius:4px;font-size:11px;color:var(--text);user-select:none;`;
    header.innerHTML = `<span style="font-size:9px;opacity:.5;">${collapsed ? '▶' : '▼'}</span><span>📁</span><span>${escHtml(key)}</span>`;
    header.addEventListener('click', () => {
      _tpkFolders[fp] = !(_tpkFolders[fp] ?? (depth >= 1));
      _tpkRenderTree((document.getElementById('tpk-search')?.value || '').toLowerCase());
    });
    wrap.appendChild(header);
    if (!collapsed) {
      const inner = document.createElement('div');
      _tpkRenderNode(child, fp, inner, depth + 1, forceExpand);
      wrap.appendChild(inner);
    }
    container.appendChild(wrap);
  }
  const files = node.__files || [];
  if (!files.length) return;
  const row = document.createElement('div');
  row.style.cssText = `padding-left:${indent + 18}px;display:flex;flex-wrap:wrap;gap:4px;margin:2px 0 6px;`;
  files.forEach(ghPath => row.appendChild(_tpkMakeGhCell(ghPath)));
  container.appendChild(row);
}

function _tpkMakeGhCell(ghPath) {
  const match    = _tpkGhInverse.get(ghPath);
  const name     = ghPath.split('/').pop();
  const isTarget = _tpkLinkSrc !== null && !match;
  const cell     = document.createElement('div');
  cell.title = match
    ? `${ghPath}\n← ${match.tpkFile.path}${match.matchType === 'manual' ? '\n(lien manuel)' : ' (auto)'}`
    : ghPath;
  const border  = match ? (match.matchType === 'manual' ? 'var(--warn)' : 'var(--border)')
                        : isTarget ? 'var(--accent)' : 'var(--border)';
  const bg      = isTarget ? 'color-mix(in srgb,var(--accent) 8%,var(--surface2))' : 'var(--surface2)';
  const opacity = match ? '1' : isTarget ? '1' : '0.4';
  cell.style.cssText = `display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px 3px;border-radius:5px;cursor:${isTarget ? 'crosshair' : match ? 'pointer' : 'default'};border:1px solid ${border};background:${bg};opacity:${opacity};width:58px;flex-shrink:0;position:relative;`;
  const badge = match?.matchType === 'manual' ? '<span style="font-size:7px;color:var(--warn);font-weight:700;">MANUEL</span>' : '';
  cell.innerHTML = `<span style="font-size:8px;color:var(--muted);word-break:break-all;text-align:center;line-height:1.2;max-width:56px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escHtml(name)}</span>${badge}`;
  if (match) {
    const img = document.createElement('img');
    img.src = match.url;
    img.style.cssText = 'width:44px;height:44px;object-fit:contain;image-rendering:pixelated;cursor:zoom-in;display:block;';
    img.addEventListener('click', e => { e.stopPropagation(); tpkOpenLightbox(match.url, name, ghPath); });
    cell.insertBefore(img, cell.firstChild);
    cell.addEventListener('click', () => navigator.clipboard?.writeText(ghPath).then(() => toast(`📋 ${ghPath}`, 'success')));
    // Bouton delink visible (✕)
    const delBtn = document.createElement('button');
    delBtn.textContent = '✕';
    delBtn.title = match.matchType === 'manual' ? 'Supprimer lien manuel' : 'Exclure du match auto';
    delBtn.style.cssText = 'position:absolute;top:1px;left:1px;background:rgba(180,0,0,.75);border:none;border-radius:3px;color:#fff;font-size:8px;padding:0 3px;cursor:pointer;line-height:1.6;z-index:1;';
    delBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (match.matchType === 'manual') {
        _tpkManual.delete(match.tpkFile.basename);
      } else {
        _tpkManual.set(match.tpkFile.basename, '__none__');
      }
      _tpkSaveManual();
      _tpkApplyMatch();
      tpkRender();
      toast('✗ Lien supprimé', 'success');
    });
    cell.appendChild(delBtn);
    if (match.matchType === 'manual') {
      cell.addEventListener('contextmenu', e => {
        e.preventDefault();
        _tpkManual.delete(match.tpkFile.basename);
        _tpkSaveManual();
        _tpkApplyMatch();
        tpkRender();
        toast('✗ Lien manuel supprimé', 'success');
      });
    }
  } else {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = 'width:44px;height:44px;background:var(--surface2);border-radius:3px;border:1px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--muted);';
    placeholder.textContent = '?';
    cell.insertBefore(placeholder, cell.firstChild);
    if (isTarget) {
      cell.addEventListener('click', () => {
        _tpkManual.set(_tpkLinkSrc.basename, ghPath);
        _tpkSaveManual();
        _tpkLinkSrc = null;
        _tpkApplyMatch();
        tpkRender();
        toast(`✓ Lié : ${name}`, 'success');
      });
    }
  }
  return cell;
}

// ── Perceptual hashing (dHash 16×16 = 256 bits) ──────────────────────────────

function _tpkHash(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const W = 17, H = 16;
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, W, H);
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, W, H);
        const px = ctx.getImageData(0, 0, W, H).data;
        const hash = new Uint8Array(32); // 256 bits
        let bit = 0;
        for (let y = 0; y < H; y++) {
          for (let x = 0; x < W - 1; x++) {
            const i = (y * W + x) * 4;
            const g1 = px[i] * 0.299 + px[i+1] * 0.587 + px[i+2] * 0.114;
            const g2 = px[i+4] * 0.299 + px[i+5] * 0.587 + px[i+6] * 0.114;
            if (g1 > g2) hash[bit >> 3] |= 1 << (bit & 7);
            bit++;
          }
        }
        resolve(hash);
      } catch(e) { reject(e); }
    };
    img.onerror = reject;
    img.src = url;
  });
}

function _tpkHamming(h1, h2) {
  let d = 0;
  for (let i = 0; i < h1.length; i++) {
    let x = h1[i] ^ h2[i];
    while (x) { d += x & 1; x >>>= 1; }
  }
  return d;
}

let _tpkMatchCandidates = []; // { tpkFile, ghPath, tpkUrl, ghUrl, dist, remove }

window.tpkVisualMatch = async function() {
  const autoMatched = _tpkFiles.filter(f => f.matchType === 'auto');
  const unmatched   = _tpkFiles.filter(f => !f.githubPath);
  const allTpk      = [...autoMatched, ...unmatched];
  if (!allTpk.length) { toast('Rien à analyser', 'info'); return; }

  const token   = _imgConfig?.token || '';
  const repo    = _imgConfig?.repo  || '';
  const statsEl = document.getElementById('tpk-stats');
  const btn     = document.getElementById('tpk-visual-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳…'; }

  try {
    // 1. Hash texture pack
    if (statsEl) statsEl.textContent = `⏳ Hash textures (${allTpk.length})…`;
    const tpkHashes = new Map();
    for (const f of allTpk) {
      try { tpkHashes.set(f, await _tpkHash(f.url)); } catch {}
    }

    // 2. Télécharger images GitHub nécessaires
    const ghToFetch = new Set([
      ..._tpkGhFiles.filter(p => !_tpkGhInverse.has(p)),
      ...autoMatched.map(f => f.githubPath).filter(Boolean),
    ]);
    const ghHashes  = new Map();
    const ghBlobUrl = new Map(); // pour affichage dans le modal
    const ghPaths   = [...ghToFetch];
    const BATCH     = 8;
    for (let i = 0; i < ghPaths.length; i += BATCH) {
      if (statsEl) statsEl.textContent = `⏳ GitHub (${i}/${ghPaths.length})…`;
      await Promise.all(ghPaths.slice(i, i + BATCH).map(async ghPath => {
        try {
          const sha  = _tpkGhSha.get(ghPath);
          if (!sha) return;
          const resp = await fetch(
            `https://api.github.com/repos/${repo}/git/blobs/${sha}`,
            { headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.raw' } }
          );
          if (!resp.ok) return;
          const blob    = await resp.blob();
          const blobUrl = URL.createObjectURL(blob);
          ghBlobUrl.set(ghPath, blobUrl);
          ghHashes.set(ghPath, await _tpkHash(blobUrl));
        } catch {}
      }));
    }

    // 3. Construire les candidats à confirmer
    _tpkMatchCandidates = [];

    // Faux positifs auto (à retirer)
    for (const f of autoMatched) {
      const th = tpkHashes.get(f);
      const gh = ghHashes.get(f.githubPath);
      if (!th || !gh) continue;
      const dist = _tpkHamming(th, gh);
      if (dist > 10) { // probable faux positif → proposer la suppression
        _tpkMatchCandidates.push({ tpkFile: f, ghPath: f.githubPath, tpkUrl: f.url, ghUrl: ghBlobUrl.get(f.githubPath), dist, remove: true });
      }
    }

    // Nouveaux matchs potentiels
    _tpkApplyMatch();
    const stillUnmatched = _tpkFiles.filter(f => !f.githubPath);
    const stillFreeGh    = _tpkGhFiles.filter(p => !_tpkGhInverse.has(p) && ghHashes.has(p));
    const pairs = [];
    for (const f of stillUnmatched) {
      const th = tpkHashes.get(f);
      if (!th) continue;
      for (const ghPath of stillFreeGh) {
        const gh = ghHashes.get(ghPath);
        if (!gh) continue;
        pairs.push({ f, ghPath, dist: _tpkHamming(th, gh) });
      }
    }
    pairs.sort((a, b) => a.dist - b.dist);
    const usedGh  = new Set();
    const usedTpk = new Set();
    for (const { f, ghPath, dist } of pairs) {
      if (dist > 8) break;
      if (usedTpk.has(f) || usedGh.has(ghPath)) continue;
      _tpkMatchCandidates.push({ tpkFile: f, ghPath, tpkUrl: f.url, ghUrl: ghBlobUrl.get(ghPath), dist, remove: false });
      usedTpk.add(f); usedGh.add(ghPath);
    }

    if (!_tpkMatchCandidates.length) {
      toast('Aucune correspondance trouvée', 'info');
      return;
    }
    _tpkShowMatchModal();
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '🔍 Match visuel'; }
  }
};

function _tpkShowMatchModal() {
  const grid  = document.getElementById('tpk-match-grid');
  const modal = document.getElementById('tpk-match-modal');
  if (!grid || !modal) return;
  grid.innerHTML = '';

  _tpkMatchCandidates.forEach((c, i) => {
    const tpkName = c.tpkFile.path.split('/').pop();
    const ghName  = c.ghPath.split('/').pop();
    const card    = document.createElement('label');
    card.style.cssText = `display:flex;gap:10px;align-items:center;padding:10px;border-radius:8px;border:2px solid ${c.remove ? 'var(--danger,#e55)' : 'var(--border)'};background:var(--surface2);cursor:pointer;`;
    card.innerHTML = `
      <input type="checkbox" data-idx="${i}" ${c.remove ? '' : 'checked'} onchange="tpkMatchUpdateCount()" style="accent-color:var(--accent);width:16px;height:16px;flex-shrink:0;">
      <img src="${c.tpkUrl}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;" title="${c.tpkFile.path}">
      <span style="font-size:16px;color:var(--muted);">${c.remove ? '✕' : '→'}</span>
      <img src="${c.ghUrl || ''}" style="width:48px;height:48px;object-fit:contain;image-rendering:pixelated;flex-shrink:0;${!c.ghUrl ? 'opacity:.3' : ''}" title="${c.ghPath}">
      <div style="flex:1;min-width:0;">
        <div style="font-size:9px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.tpkFile.path}">${tpkName}</div>
        <div style="font-size:9px;color:var(--accent);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${c.ghPath}">${c.remove ? '✕ ' : '→ '}${ghName}</div>
        <div style="font-size:8px;color:var(--muted);opacity:.6;">dist: ${c.dist}/64${c.remove ? ' · faux positif ?' : ''}</div>
      </div>`;
    grid.appendChild(card);
  });

  tpkMatchUpdateCount();
  modal.style.display = '';
}

window.tpkMatchUpdateCount = function() {
  const checked = document.querySelectorAll('#tpk-match-grid input[type=checkbox]:checked').length;
  const el = document.getElementById('tpk-match-apply-count');
  if (el) el.textContent = `(${checked})`;
};

window.tpkMatchSelectAll = function(val) {
  document.querySelectorAll('#tpk-match-grid input[type=checkbox]').forEach(cb => { cb.checked = val; });
  tpkMatchUpdateCount();
};

window.tpkMatchApply = function() {
  document.querySelectorAll('#tpk-match-grid input[type=checkbox]:checked').forEach(cb => {
    const c = _tpkMatchCandidates[+cb.dataset.idx];
    if (!c) return;
    if (c.remove) _tpkManual.set(c.tpkFile.basename, '__none__');
    else          _tpkManual.set(c.tpkFile.basename, c.ghPath);
  });
  _tpkSaveManual();
  _tpkApplyMatch();
  tpkRender();
  document.getElementById('tpk-match-modal').style.display = 'none';
  toast(`✓ Correspondances appliquées`, 'success');
};

window.tpkSaveReference = function() {
  const paths = _tpkFiles.map(f => f.path);
  localStorage.setItem(TPK_REF_KEY, JSON.stringify(paths));
  _tpkFiles.forEach(f => { f.isNew = false; });
  tpkRender();
  toast(`✓ Référence sauvegardée (${paths.length} textures)`, 'success');
};

window.previewNormalize = async function() {
  const cat = document.getElementById('img-norm-type')?.value || '';
  const previewEl = document.getElementById('img-norm-preview');
  if (!previewEl) return;
  previewEl.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const docs = await cachedDocs(COL.items);
    const filtered = docs.filter(d => !cat || d.category === cat);
    const rows = filtered.slice(0, 50).map(item => {
      const expected = _imgComputePath(item);
      const current  = (item.images?.[0] || item.image || item.img || '');
      const ok = expected && current === expected;
      return `<div style="display:flex;gap:6px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border);align-items:baseline;">
        <span style="min-width:140px;flex-shrink:0;color:${ok?'var(--success)':'var(--text)'};">${escHtml(item.name||item.id)}</span>
        <span style="color:${ok?'var(--success)':'var(--danger)'};font-family:monospace;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
          ${current ? escHtml(current) : '<i style="opacity:.5">—</i>'} ${!ok && expected ? '→ ' + escHtml(expected) : ''}
        </span>
      </div>`;
    }).join('');
    const total = filtered.length;
    const toFix = filtered.filter(item => {
      const expected = _imgComputePath(item);
      const current  = item.images?.[0] || item.image || item.img || '';
      return expected && current !== expected;
    }).length;
    previewEl.innerHTML = `<div style="font-size:12px;color:var(--muted);margin-bottom:8px;">${total} items · <b style="color:var(--warn);">${toFix} à corriger</b></div>${rows}${total > 50 ? `<div style="font-size:11px;color:var(--muted);margin-top:6px;">… ${total-50} autres</div>` : ''}`;
  } catch(e) {
    previewEl.innerHTML = `<div class="empty" style="color:var(--danger)">${escHtml(e.message)}</div>`;
  }
};

window.runNormalize = async function() {
  if (!await modal.confirm('Met à jour le champ "images" de tous les items selon les templates configurés.\n\nCette opération modifie Firestore. Continuer ?')) return;
  const cat = document.getElementById('img-norm-type')?.value || '';
  const previewEl = document.getElementById('img-norm-preview');
  if (previewEl) previewEl.innerHTML = '<div class="empty">Normalisation en cours…</div>';
  try {
    const docs = await cachedDocs(COL.items);
    const filtered = docs.filter(d => !cat || d.category === cat);
    let updated = 0;
    for (const item of filtered) {
      const expected = _imgComputePath(item);
      if (!expected) continue;
      const current = item.images?.[0] || item.image || item.img || '';
      if (current === expected) continue;
      try {
        await updateDoc(doc(db, COL.items, item.id), { images: [expected] });
        invalidateModCache(COL.items);
        updated++;
      } catch {}
    }
    if (previewEl) previewEl.innerHTML = `<div style="font-size:13px;color:var(--success);padding:12px 0;">✓ ${updated} item(s) mis à jour</div>`;
    toast(`✓ ${updated} chemins d'images normalisés`, 'success');
  } catch(e) {
    toast('⛔ ' + e.message, 'error');
  }
};

// ── Migration IDs Occultes ─────────────────────────

// ── Outils modération ──────────────────────────────
window.showCalibrateur = function() {
  _setHash('calibrateur');
  _showPanel('calibrateur-panel', 'btn-calibrateur');
  const iframe = document.getElementById('calibrateur-iframe');
  if (!iframe.src || iframe.src === 'about:blank') {
    iframe.src = 'Bestiaire/calibrateur.html';
  }
};

window.showCaptureSprites = function() {
  _setHash('capture-sprites');
  _showPanel('capture-panel', 'btn-capture-sprites');
  const iframe = document.getElementById('capture-iframe');
  if (!iframe.src || iframe.src === 'about:blank') {
    iframe.src = 'capture-sprites.html';
  }
};
}
