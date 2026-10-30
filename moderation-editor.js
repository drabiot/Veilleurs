// ══════════════════════════════════════════════════════
// ÉDITEUR DE DONNÉES — formulaire générique, sélecteur de couleur, sauvegarde, suppression
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { invalidateModCache, writeAudit: _writeAudit, _regionName, escHtml, _readContribs, ed: _ed, _COL_LABELS, edCache: _edCache, shared: _shared, orderData: _orderData, db, COL, collection, getDocs, getDoc, doc, updateDoc, setDoc, addDoc, deleteDoc, deleteField, serverTimestamp, writeBatch, hashName, getItemGameplayKeys, sanitizeForFirestore, desanitizeFromFirestore, toast, modal, cachedDocs, setHash: _setHash, showPanel: _showPanel, _slugName, _renamedItemId, _renameImagePaths, _toastImageRenames, _syncPnjObtain, _syncMobObtain, _syncItemObtain, _recordItemRename, _renameItemReferences } = ctx;
const { normalize } = window.VCL;
async function _loadRegionsForEditor() {
  if (_edCache.regions) return _edCache.regions;
  try {
    const docs = await cachedDocs('regions');
    _edCache.regions = [...docs].sort((a, b) => (a.ordre ?? 9999) - (b.ordre ?? 9999));
  } catch { _edCache.regions = []; }
  return _edCache.regions;
}

async function _populateSetDatalist() {
  const dl = document.getElementById('ed-dl-sets');
  if (!dl) return;
  if (_edCache.sets === null) {
    let items = _orderData('itemOrder').length ? _orderData('itemOrder') : null;
    if (!items) {
      try {
        items = await cachedDocs('items');
      } catch { items = []; }
    }
    _edCache.sets = [...new Set(items.map(i => i.set).filter(Boolean))].sort((a,b) => a.localeCompare(b,'fr'));
  }
  dl.innerHTML = _edCache.sets.map(s => `<option value="${_ee(s)}">`).join('');
}

// ── Éditeur générique ────────────────────────────────

const _ee = escHtml;

function _typeOf(val) {
  if (val === null || val === undefined) return 'null';
  if (typeof val === 'boolean') return 'bool';
  if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float';
  if (typeof val === 'string') return 'string';
  if (Array.isArray(val)) return 'array';
  return 'map';
}
function _typeColor(t) {
  return { bool:'#7dd3fc', int:'#86efac', float:'#a5f3c4', string:'#fcd34d', array:'#c084fc', map:'#f472b6', null:'var(--muted)' }[t] || 'var(--muted)';
}
function _typeLabel(t) {
  return { bool:'bool', int:'int', float:'float', string:'str', array:'array', map:'map', null:'null' }[t] || t;
}

const _GEN_FIELD_ORDER = [
  'id','name','titre','type','palier','zone','npc','rarity','category','cat','lvl','set','behavior','difficulty',
  'region','tag','inCodex','color','sensible','twoHanded','rune_slots',
  'images','lore','obtain','respawnDelay','spawnTime',
  'stats','classes','tags','effects','craft','loot','sells','zones','drops','morceaux','camera','attacks',
  'ordre','_order'
];

// ── Color Picker complet (HSV) ────────────────────
let _cpState = {};   // { [pickerId]: { h, s, v } }
let _cpDrag  = null; // { id, type: 'sv'|'hue' }

function _cpHsvToRgb(h, s, v) {
  s /= 100; v /= 100;
  const c = v * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if      (h <  60) { r=c; g=x; }
  else if (h < 120) { r=x; g=c; }
  else if (h < 180) {      g=c; b=x; }
  else if (h < 240) {      g=x; b=c; }
  else if (h < 300) { r=x;      b=c; }
  else              { r=c;      b=x; }
  return [Math.round((r+m)*255), Math.round((g+m)*255), Math.round((b+m)*255)];
}
function _cpRgbToHsv(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b), d = max - min;
  let h = 0;
  if (d > 0) {
    if      (max === r) h = ((g-b)/d + (g<b?6:0)) * 60;
    else if (max === g) h = ((b-r)/d + 2) * 60;
    else                h = ((r-g)/d + 4) * 60;
  }
  return [h, max===0 ? 0 : d/max*100, max*100];
}
function _cpHexToRgb(hex) {
  return [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
}
function _cpRgbToHex(r,g,b) {
  return '#' + [r,g,b].map(v => Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
}
function _makeColorObj(hex) {
  const [r,g,b] = _cpHexToRgb(hex);
  return { color: hex, dim: `rgba(${r},${g},${b},.35)`, glow: `rgba(${r},${g},${b},.08)` };
}

function isQualityOnly(data) {
  if (!data.quality) return false;
  // Un item "qualité uniquement" n'a aucun champ de contenu hors quality, id, et métadonnées
  const CONTENT_FIELDS = ['lore', 'obtain', 'craft', 'effects', 'images'];
  return !CONTENT_FIELDS.some(f => f in data && data[f] != null && data[f] !== '' && !(Array.isArray(data[f]) && data[f].length === 0));
}

function _cpUpdate(id, h, s, v) {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s));
  v = Math.max(0, Math.min(100, v));
  _cpState[id] = { h, s, v };

  const [r,g,b] = _cpHsvToRgb(h, s, v);
  const hex     = _cpRgbToHex(r, g, b);
  const wrap    = document.getElementById(id);
  if (!wrap) return;

  // Carré SV — couleur de fond = teinte pure
  const pureHex = _cpRgbToHex(..._cpHsvToRgb(h, 100, 100));
  const svBg = wrap.querySelector('.ed-cp-sv-bg');
  if (svBg) svBg.style.background = pureHex;

  // Curseur SV
  const cur = wrap.querySelector('.ed-cp-cursor');
  if (cur) { cur.style.left = s+'%'; cur.style.top = (100-v)+'%'; cur.style.background = hex; }

  // Thumb teinte
  const hThumb = wrap.querySelector('.ed-cp-hue-thumb');
  if (hThumb) { hThumb.style.left = (h/360*100)+'%'; hThumb.style.background = pureHex; }

  // Input hex
  const hexIn = wrap.querySelector('.ed-cp-hex-in');
  if (hexIn && document.activeElement !== hexIn) hexIn.value = hex;

  // Inputs RGB
  const rgbIns = wrap.querySelectorAll('.ed-cp-rgb-in');
  if (rgbIns[0] && document.activeElement !== rgbIns[0]) rgbIns[0].value = r;
  if (rgbIns[1] && document.activeElement !== rgbIns[1]) rgbIns[1].value = g;
  if (rgbIns[2] && document.activeElement !== rgbIns[2]) rgbIns[2].value = b;

  // Swatches + labels
  const colorObj = _makeColorObj(hex);
  const sw = wrap.querySelector('.ed-cp-swatch'), swd = wrap.querySelector('.ed-cp-swatch-dim');
  if (sw)  sw.style.background  = hex;
  if (swd) swd.style.background = colorObj.dim;
  const hs = wrap.querySelector('.ed-cp-hex-lbl'), ds = wrap.querySelector('.ed-cp-dim-lbl'), gs = wrap.querySelector('.ed-cp-glow-lbl');
  if (hs) hs.textContent = hex;
  if (ds) ds.textContent = colorObj.dim;
  if (gs) gs.textContent = colorObj.glow;

  // Valeur sérialisée collectée par _collectGenericForm (JSON objet pour régions, hex pour panoplies)
  const mode = wrap.dataset.cpMode || 'object';
  const out  = wrap.querySelector('.ed-cp-out');
  if (out) out.value = mode === 'hex' ? hex : JSON.stringify(colorObj);

  // Palette — marquer la pastille active
  wrap.querySelectorAll('.ed-cp-preset').forEach(p => {
    p.style.outline       = p.dataset.hex === hex ? '2px solid #fff' : 'none';
    p.style.outlineOffset = '1px';
  });
}

document.addEventListener('mousemove', e => {
  if (!_cpDrag) return;
  const wrap = document.getElementById(_cpDrag.id);
  if (!wrap) { _cpDrag = null; return; }
  const st = _cpState[_cpDrag.id] || { h:0, s:100, v:100 };
  if (_cpDrag.type === 'sv') {
    const rect = wrap.querySelector('.ed-cp-sv').getBoundingClientRect();
    _cpUpdate(_cpDrag.id, st.h,
      Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),
      Math.max(0,Math.min(100,100-(e.clientY-rect.top)/rect.height*100)));
  } else {
    const rect = wrap.querySelector('.ed-cp-hue').getBoundingClientRect();
    _cpUpdate(_cpDrag.id, Math.max(0,Math.min(360,(e.clientX-rect.left)/rect.width*360)), st.s, st.v);
  }
});
document.addEventListener('mouseup', () => { _cpDrag = null; });

window.cpSvDown = function(e, id) {
  e.preventDefault(); _cpDrag = { id, type:'sv' };
  const rect = e.currentTarget.getBoundingClientRect(), st = _cpState[id]||{h:0,s:100,v:100};
  _cpUpdate(id, st.h,
    Math.max(0,Math.min(100,(e.clientX-rect.left)/rect.width*100)),
    Math.max(0,Math.min(100,100-(e.clientY-rect.top)/rect.height*100)));
};
window.cpHueDown = function(e, id) {
  e.preventDefault(); _cpDrag = { id, type:'hue' };
  const rect = e.currentTarget.getBoundingClientRect(), st = _cpState[id]||{h:0,s:100,v:100};
  _cpUpdate(id, Math.max(0,Math.min(360,(e.clientX-rect.left)/rect.width*360)), st.s, st.v);
};
window.cpHexInput = function(input, id) {
  const hex = input.value.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return;
  const [r,g,b] = _cpHexToRgb(hex); const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(id, h, s, v);
};
window.cpRgbInput = function(input, id) {
  const wrap = document.getElementById(id); if (!wrap) return;
  const ins = wrap.querySelectorAll('.ed-cp-rgb-in');
  const r = Math.max(0,Math.min(255,parseInt(ins[0]?.value)||0));
  const g = Math.max(0,Math.min(255,parseInt(ins[1]?.value)||0));
  const b = Math.max(0,Math.min(255,parseInt(ins[2]?.value)||0));
  const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(id, h, s, v);
};
window.edPickPreset = function(swatch) {
  const wrap = swatch.closest('.ed-color-picker'); if (!wrap) return;
  const [r,g,b] = _cpHexToRgb(swatch.dataset.hex);
  const [h,s,v] = _cpRgbToHsv(r,g,b);
  _cpUpdate(wrap.id, h, s, v);
};

function _genValueHtml(key, val, col) {
  const t = _typeOf(val);
  const isInternal = key === '_order';
  const isReadonly = isInternal;

  if (isReadonly) {
    return `<input class="ed-input" value="${_ee(String(val ?? ''))}" readonly style="opacity:.4;cursor:default;font-family:monospace;">`;
  }

  if (t === 'bool') {
    return `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0;">
      <input type="checkbox" data-gf-type="bool"${val ? ' checked' : ''} style="accent-color:var(--accent);width:15px;height:15px;cursor:pointer;">
      <span class="ed-gen-bool-txt" style="font-size:12px;color:var(--muted);">${val ? 'true' : 'false'}</span>
    </label>`;
  }

  if (t === 'int' || t === 'float') {
    return `<input class="ed-input" type="number" step="${t === 'float' ? 'any' : '1'}" data-gf-type="number" value="${_ee(String(val ?? ''))}">`;
  }

  // Color picker complet pour le champ color des régions & panoplies
  if (key === 'color' && (col === 'regions' || col === 'panoplies')) {
    const mode = col === 'panoplies' ? 'hex' : 'object';
    const hex  = mode === 'hex'
      ? (typeof val === 'string' && /^#[0-9a-f]{6}$/i.test(val) ? val : '#b87333')
      : ((val && typeof val === 'object' && val.color) ? val.color : '#9a9ab0');
    const obj = _makeColorObj(hex);
    const CP  = 'ed-cp-reg';  // ID fixe (un seul éditeur ouvert à la fois)

    const PRESETS = [
      { label:'Naturel',  colors:['#4ade80','#22c55e','#86efac','#a3e635','#34d399'] },
      { label:'Chaud',    colors:['#fbbf24','#f59e0b','#e0a050','#fb923c','#f97316'] },
      { label:'Feu',      colors:['#f87171','#ef4444','#f43f5e','#fb7185','#dc2626'] },
      { label:'Froid',    colors:['#60a5fa','#38bdf8','#7dd3fc','#a5f3fc','#818cf8'] },
      { label:'Mystique', colors:['#c084fc','#a855f7','#e879f9','#f0abfc','#d946ef'] },
      { label:'Neutre',   colors:['#9a9ab0','#94a3b8','#6b7280','#d4d4d8','#a1a1aa'] },
    ];
    const paletteHtml = PRESETS.map(g => `
      <div style="display:contents;">
        <span style="font-size:10px;color:var(--muted);grid-column:1;align-self:center;white-space:nowrap;">${_ee(g.label)}</span>
        ${g.colors.map(c => `<div class="ed-cp-preset" data-hex="${_ee(c)}" onclick="edPickPreset(this)"
          style="width:20px;height:20px;border-radius:4px;background:${_ee(c)};cursor:pointer;border:1px solid rgba(255,255,255,.15);transition:transform .12s;"
          onmouseover="this.style.transform='scale(1.25)'" onmouseout="this.style.transform=''"></div>`).join('')}
      </div>`).join('');

    return `<div class="ed-color-picker" id="${_ee(CP)}" data-init-hex="${_ee(hex)}" data-cp-mode="${mode}"
      style="display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--surface2);border:1px solid var(--border);border-radius:8px;max-width:320px;">

      <!-- Carré Saturation / Valeur -->
      <div class="ed-cp-sv" style="position:relative;width:100%;height:180px;border-radius:5px;cursor:crosshair;user-select:none;flex-shrink:0;"
           onmousedown="cpSvDown(event,'${_ee(CP)}')">
        <div class="ed-cp-sv-bg" style="position:absolute;inset:0;border-radius:5px;"></div>
        <div style="position:absolute;inset:0;border-radius:5px;background:linear-gradient(to right,#fff,transparent);"></div>
        <div style="position:absolute;inset:0;border-radius:5px;background:linear-gradient(to bottom,transparent,#000);"></div>
        <div class="ed-cp-cursor" style="position:absolute;width:13px;height:13px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.4),0 2px 6px rgba(0,0,0,.6);transform:translate(-50%,-50%);pointer-events:none;"></div>
      </div>

      <!-- Slider Teinte -->
      <div class="ed-cp-hue" style="position:relative;height:14px;border-radius:7px;cursor:pointer;user-select:none;
           background:linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00);"
           onmousedown="cpHueDown(event,'${_ee(CP)}')">
        <div class="ed-cp-hue-thumb" style="position:absolute;top:50%;width:16px;height:16px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,.3),0 2px 4px rgba(0,0,0,.5);transform:translate(-50%,-50%);pointer-events:none;"></div>
      </div>

      <!-- Swatches + labels -->
      <div style="display:flex;align-items:center;gap:8px;">
        <div class="ed-cp-swatch"     style="width:32px;height:32px;border-radius:5px;flex-shrink:0;border:1px solid rgba(255,255,255,.2);" title="color"></div>
        <div class="ed-cp-swatch-dim" style="width:32px;height:32px;border-radius:5px;flex-shrink:0;border:1px solid rgba(255,255,255,.1);" title="dim (opacité 35%)"></div>
        <div style="font-family:monospace;font-size:11px;display:flex;flex-direction:column;gap:1px;min-width:0;overflow:hidden;">
          <span class="ed-cp-hex-lbl"  style="color:var(--text);font-weight:600;"></span>
          <span class="ed-cp-dim-lbl"  style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
          <span class="ed-cp-glow-lbl" style="color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></span>
        </div>
      </div>

      <!-- Inputs Hex + RGB -->
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;">
        <span style="font-size:11px;color:var(--muted);width:20px;">#</span>
        <input class="ed-input ed-cp-hex-in" type="text" maxlength="7"
               style="font-family:monospace;width:76px;padding:4px 6px;font-size:13px;"
               oninput="cpHexInput(this,'${_ee(CP)}')" spellcheck="false" autocomplete="off">
        <span style="font-size:11px;color:var(--muted);">R</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
        <span style="font-size:11px;color:var(--muted);">G</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
        <span style="font-size:11px;color:var(--muted);">B</span>
        <input class="ed-input ed-cp-rgb-in" type="number" min=0 max=255 style="width:44px;padding:4px;" oninput="cpRgbInput(this,'${_ee(CP)}')">
      </div>

      <!-- Palette de présélections -->
      <div style="display:grid;grid-template-columns:52px repeat(5,20px);gap:4px 6px;align-items:center;padding-top:4px;border-top:1px solid var(--border);">
        ${paletteHtml}
      </div>

      <!-- Valeur sérialisée (lue par _collectGenericForm) -->
      ${mode === 'hex'
        ? `<input class="ed-cp-out" data-gf-type="string" type="hidden" value="${_ee(hex)}">`
        : `<textarea class="ed-cp-out ed-json-ta" data-gf-type="json" spellcheck="false" style="display:none;">${_ee(JSON.stringify(obj))}</textarea>`}
    </div>`;
  }

  if (t === 'array' || t === 'map') {
    return `<textarea class="ed-json-ta" data-gf-type="json" spellcheck="false">${_ee(JSON.stringify(val, null, 2))}</textarea>`;
  }

  if (t === 'null') {
    return `<input class="ed-input" data-gf-type="string" value="" placeholder="(null)">`;
  }

  // Champ coords sur les PNJ → 3 inputs X/Y/Z
  if (key === 'coords' && col === 'personnages') {
    const c = (val && typeof val === 'object') ? val : { x: null, y: null, z: null };
    const xv = c.x ?? '';
    const yv = c.y ?? '';
    const zv = c.z ?? '';
    return `<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        X <input class="ed-input" type="number" step="any" data-gf-type="coords-x" value="${_ee(String(xv))}" style="width:76px;" placeholder="—">
      </label>
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        Z <input class="ed-input" type="number" step="any" data-gf-type="coords-z" value="${_ee(String(zv))}" style="width:76px;" placeholder="—">
      </label>
      <label style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:4px;">
        Y <input class="ed-input" type="number" step="any" data-gf-type="coords-y" value="${_ee(String(yv))}" style="width:76px;" placeholder="—">
      </label>
    </div>`;
  }

  // Champ region sur les mobs et PNJ → dropdown searchable groupé par palier/codex
  if (key === 'region' && (col === 'mobs' || col === 'personnages')) {
    const regions = _edCache.regions || [];
    const known = new Set(regions.map(r => r.id));
    const currentName = regions.find(r => r.id === val)?.name || (val && !known.has(val) ? `⚠️ ${val} (non reconnu)` : '');
    const paliers = [...new Set(regions.map(r => r.palier || 1))].sort((a,b) => a-b);

    let itemsHtml = `<div data-reg-id="" data-reg-name=""
      style="padding:7px 14px;cursor:pointer;font-size:13px;color:var(--muted);font-style:italic;"
      onmousedown="edSelectRegion(event,this)"
      onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">— aucune —</div>`;

    for (const p of paliers) {
      const groups = [
        { label: `Palier ${p} — Codex`,      items: regions.filter(r => (r.palier||1)===p && r.inCodex!==false) },
        { label: `Palier ${p} — Hors Codex`, items: regions.filter(r => (r.palier||1)===p && r.inCodex===false) },
      ].filter(g => g.items.length);
      for (const { label, items } of groups) {
        itemsHtml += `<div data-reg-group style="padding:4px 10px 2px;font-size:10px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.06em;pointer-events:none;">${_ee(label)}</div>`;
        itemsHtml += items.map(r => `<div data-reg-id="${_ee(r.id)}" data-reg-name="${_ee(r.name||r.id)}"
          style="padding:6px 14px 6px 20px;cursor:pointer;font-size:13px;color:var(--text);"
          onmousedown="edSelectRegion(event,this)"
          onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">${_ee(r.name||r.id)}</div>`).join('');
      }
    }
    if (val && !known.has(val)) {
      itemsHtml += `<div data-reg-id="${_ee(val)}" data-reg-name="${_ee(val)}"
        style="padding:6px 14px;cursor:pointer;font-size:13px;color:var(--warn);"
        onmousedown="edSelectRegion(event,this)"
        onmouseover="this.style.background='var(--surface3)'" onmouseout="this.style.background=''">⚠️ ${_ee(val)} (conserver tel quel)</div>`;
    }

    return `<div style="position:relative;">
      <input type="text" class="ed-input" placeholder="🔍 Rechercher une région…"
             value="${_ee(currentName)}" autocomplete="off"
             oninput="edFilterRegions(this)" onfocus="edOpenRegions(this)"
             onblur="setTimeout(()=>edCloseRegions(this),150)">
      <input type="hidden" data-gf-type="string" value="${_ee(val||'')}">
      <div data-reg-dropdown style="display:none;position:absolute;top:100%;left:0;right:0;z-index:300;
           max-height:240px;overflow-y:auto;background:var(--surface2);border:1px solid var(--accent);
           border-top:none;border-radius:0 0 6px 6px;box-shadow:0 4px 12px rgba(0,0,0,.5);">
        ${itemsHtml}
      </div>
    </div>`;
  }

  // string
  const str = String(val ?? '');
  const listAttr = key === 'set' ? ' list="ed-dl-sets"' : '';
  if (key !== 'set') {
    return `<textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string">${_ee(str)}</textarea>`;
  }
  return `<input class="ed-input" data-gf-type="string" value="${_ee(str)}"${listAttr} autocomplete="off">`;
}

//here

const QUALITY_FIELDS = ['lore', 'obtain', 'craft', 'effects', 'images', 'name'];

function _renderFormFields(data, col, ns) {
  const entries = Object.entries(data).sort(([ak, av], [bk, bv]) => {
    const ia = _GEN_FIELD_ORDER.indexOf(ak), ib = _GEN_FIELD_ORDER.indexOf(bk);
    const ta = _typeOf(av), tb = _typeOf(bv);
    const cxa = ta === 'array' || ta === 'map', cxb = tb === 'array' || tb === 'map';
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    if (cxa && !cxb) return 1;
    if (!cxa && cxb) return -1;
    return ak.localeCompare(bk);
  });

  return entries.map(([key, val]) => {
    const t = _typeOf(val);
    const isFixed = key === '_order' || key === 'id';
    const nsAttr  = ns ? `data-gf-ns="${ns}"` : '';
    return `<div class="ed-gen-row" data-gf-orig-key="${_ee(key)}" ${nsAttr}>
      <div class="ed-gen-keycell">
        ${isFixed
          ? `<span class="ed-gen-keylbl" style="cursor:default;color:var(--muted);">${_ee(key)}</span>`
          : `<span class="ed-gen-keylbl" title="Clic pour renommer" onclick="edRenameField(this)">${_ee(key)}</span>`}
      </div>
      <span class="ed-gen-type" style="color:${_typeColor(t)};">${_typeLabel(t)}</span>
      <div class="ed-gen-val">${_genValueHtml(key, val, col)}</div>
      ${isFixed ? '<span></span>' : `<button type="button" class="ed-gen-delbtn" onclick="edDelGenRow(this)" title="Supprimer">✕</button>`}
    </div>`;
  }).join('');
}

window.edSwitchTab = function(tab) {
  document.querySelectorAll('.ed-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.getElementById('ed-tab-base').style.display = tab === 'base' ? '' : 'none';
  document.querySelectorAll(`#ed-tab-base .ed-json-ta, #ed-tab-base .ed-textarea`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  });
};

window.edAddGenField = function() {
  // Toujours cibler le panneau BASE, jamais quality
  const container = document.getElementById('ed-gen-fields');
  if (!container) return;
  const row = document.createElement('div');
  row.className = 'ed-gen-row ed-gen-newrow';
  row.dataset.gfNs = 'base';  // ← ajout important
  row.innerHTML = `
    <input class="ed-gen-new-key ed-input" placeholder="nom_du_champ" style="font-family:monospace;font-size:12px;">
    <select class="ed-gen-new-type ed-input" style="font-size:11px;padding:5px 4px;">
      <option value="string">str</option>
      <option value="number">int</option>
      <option value="bool">bool</option>
      <option value="json">array/map</option>
    </select>
    <div class="ed-gen-val">
      <textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string" placeholder="valeur…"></textarea>
    </div>
    <button type="button" class="ed-gen-delbtn" onclick="edDelGenRow(this)" title="Annuler">✕</button>`;

  const typeSelect = row.querySelector('.ed-gen-new-type');
  const valDiv     = row.querySelector('.ed-gen-val');
  typeSelect.addEventListener('change', () => {
    const t = typeSelect.value;
    if (t === 'bool') {
      valDiv.innerHTML = `<label style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:6px 0;">
        <input type="checkbox" data-gf-type="bool" style="accent-color:var(--accent);width:15px;height:15px;">
        <span class="ed-gen-bool-txt" style="font-size:12px;color:var(--muted);">false</span>
      </label>`;
      valDiv.querySelector('input').addEventListener('change', function() {
        this.closest('label').querySelector('.ed-gen-bool-txt').textContent = this.checked ? 'true' : 'false';
      });
    } else if (t === 'json') {
      valDiv.innerHTML = `<textarea class="ed-json-ta" data-gf-type="json" spellcheck="false" placeholder="[] ou {}" style="min-height:50px;"></textarea>`;
    } else if (t === 'number') {
      valDiv.innerHTML = `<input class="ed-input" type="number" data-gf-type="number" placeholder="0">`;
    } else {
      valDiv.innerHTML = `<textarea class="ed-textarea ed-textarea-s" rows="1" data-gf-type="string" placeholder="valeur…"></textarea>`;
    }
  });

  container.appendChild(row);
  row.querySelector('.ed-gen-new-key').focus();
};

function _initFormExtras(scope = '#editor-form') {
  document.querySelectorAll(`${scope} .ed-json-ta`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => { 
      ta.style.height = 'auto'; 
      ta.style.height = ta.scrollHeight + 'px'; 
    });
  });
  document.querySelectorAll(`${scope} .ed-textarea`).forEach(ta => {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
    ta.addEventListener('input', () => { 
      ta.style.height = 'auto'; 
      ta.style.height = ta.scrollHeight + 'px'; 
    });
  });
  document.querySelectorAll(`${scope} [data-gf-type="bool"]`).forEach(cb => {
    cb.addEventListener('change', function () {
      const lbl = this.closest('label')?.querySelector('.ed-gen-bool-txt');
      if (lbl) lbl.textContent = this.checked ? 'true' : 'false';
    });
  });
}

function _buildGenericForm(data, col) {
  // Normaliser img / image → images
  if ('img' in data || 'image' in data) {
    const existing = data.images?.length ? data.images : null;
    if (!existing) {
      const src = data.img || data.image;
      data = { ...data, images: src ? [src] : [] };
    }
    const { img, image, ...rest } = data;
    data = rest;
  }

  // Injections auto (inchangées)
  if (col === 'regions'     && !('color'  in data)) data = { ...data, color: _makeColorObj('#9a9ab0') };
  if (col === 'panoplies'   && !('color'  in data)) data = { ...data, color: '#b87333' };
  if (col === 'items'       && !('obtain' in data)) data = { ...data, obtain: '' };
  if (col === 'personnages') {
    const c = data.coords;
    if (c == null || typeof c === 'string') data = { ...data, coords: { x: null, y: null, z: null } };
  }
  if (col === 'items' && !('stats' in data) && ['arme','armure','accessoire','rune'].includes(data.category)) {
    data = { ...data, stats: {} };
  }

  _ed.origData = { ...data };

  const { quality: _qualityData, ...baseData } = data;

  return `
    <div id="ed-tab-base" class="ed-tab-panel">
      <div id="ed-gen-fields" style="display:flex;flex-direction:column;gap:4px;">
        ${_renderFormFields(baseData, col, '')}
      </div>
      <datalist id="ed-dl-sets"></datalist>
      <button type="button" onclick="edAddGenField()" class="btn btn-ghost"
              style="font-size:12px;padding:6px 14px;margin-top:10px;">＋ Ajouter un champ</button>
    </div>`;
}

function _collectGenericForm() {
  // On repart de l'original (indispensable pour les panoplies et PNJ)
  const result = { ...(_ed.origData || {}) };
  
  // 1. On ramasse TOUT ce qui est Base / Dynamique
  // On cible tous les champs qui ne sont PAS dans l'onglet qualité
  const allRows = document.querySelectorAll('.ed-gen-row, .ed-gen-newrow');
  const _criticalFields = new Set(['palier', 'region', 'category', 'rarity']);
  allRows.forEach(row => {
    const data = _innerExtract(row);
    if (data) {
      if (_criticalFields.has(data.key) && (data.value === null || data.value === '') && _ed.origData?.[data.key] != null) {
        result[data.key] = _ed.origData[data.key];
      } else {
        result[data.key] = data.value;
      }
    }
  });

  return result;
}

function _innerExtract(row) {
  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const keyIn  = row.querySelector('.ed-gen-key-input');
  const newKey = row.querySelector('.ed-gen-new-key');
  
  let key = (keyIn ? keyIn.value : (keyLbl ? keyLbl.textContent : '')).trim();
  key = key.replace(/\(hérité\)/g, '').trim();
  const effectiveKey = newKey ? newKey.value.trim() : key;
  
  if (!effectiveKey) return null;

  const t = el.dataset.gfType;
  let val;
  if (t === 'bool') val = el.checked;
  else if (t === 'number') val = el.value === '' ? null : Number(el.value);
  else if (t === 'json') {
    try { val = el.value.trim() ? JSON.parse(el.value) : null; }
    catch(e) { val = null; }
  }
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    val = { x: x===''?null:Number(x), y: y===''?null:Number(y), z: z===''?null:Number(z) };
  }
  else { val = el.value; }

  return { key: effectiveKey, value: val };
}


// Fonction utilitaire pour extraire la valeur d'une ligne (Base ou Qualité)
function _extractDataFromRow(row) {
  const keyInput = row.querySelector('.ed-gen-key-input');
  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const newKeyEl = row.querySelector('.ed-gen-new-key');
  
  const key = (keyInput ? keyInput.value.trim() : (keyLbl ? keyLbl.textContent.replace(/\(hérité\)/g,'').trim() : ''));
  const effectiveKey = newKeyEl ? newKeyEl.value.trim() : key;
  
  if (!effectiveKey) return null;

  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const t = el.dataset.gfType;
  let val;

  if (t === 'bool') val = el.checked;
  else if (t === 'number') val = el.value === '' ? null : +el.value;
  else if (t === 'json') {
    try { val = el.value.trim() ? JSON.parse(el.value) : null; } 
    catch(e) { val = null; }
  } 
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    val = { x: x===''?null:+x, y: y===''?null:+y, z: z===''?null:+z };
  }
  else {
    val = el.value;
  }

  return { key: effectiveKey, value: val };
}

// Fonction helper pour éviter la répétition et les erreurs de parsing
function _extractValueFromRow(row) {
  const keyInput = row.querySelector('.ed-gen-key-input');
  const keyLbl = row.querySelector('.ed-gen-keylbl');
  const newKeyEl = row.querySelector('.ed-gen-new-key');
  
  const key = (keyInput ? keyInput.value.trim() : (keyLbl ? keyLbl.textContent.replace(/\(hérité\)/g,'').trim() : ''));
  const effectiveKey = newKeyEl ? newKeyEl.value.trim() : key;
  
  if (!effectiveKey) return null;

  const el = row.querySelector('[data-gf-type]');
  if (!el) return null;

  const t = el.dataset.gfType;
  let value;

  if (t === 'bool') value = el.checked;
  else if (t === 'number') value = el.value === '' ? null : +el.value;
  else if (t === 'json') {
    try { value = el.value.trim() ? JSON.parse(el.value) : null; } 
    catch(e) { value = null; }
  } 
  else if (t === 'coords-x') {
    const x = row.querySelector('[data-gf-type="coords-x"]')?.value;
    const y = row.querySelector('[data-gf-type="coords-y"]')?.value;
    const z = row.querySelector('[data-gf-type="coords-z"]')?.value;
    value = { x: x===''?null:+x, y: y===''?null:+y, z: z===''?null:+z };
  }
  else {
    value = el.value;
  }

  return { key: effectiveKey, value: value };
}

window.edRenameField = function(lbl) {
  const currentKey = lbl.textContent.trim();
  const input = document.createElement('input');
  input.className = 'ed-gen-key-input ed-input';
  input.value = currentKey;
  input.title = 'Renommer ce champ — appuyez sur Entrée pour valider';
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
  input.addEventListener('blur', () => {
    const newKey = input.value.trim();
    if (!newKey) { input.replaceWith(lbl); return; }
    if (newKey !== currentKey) {
      const row = input.closest('.ed-gen-row');
      if (row) row.dataset.gfOrigKey = currentKey; // keep original for diff
      lbl.textContent = newKey;
    }
    input.replaceWith(lbl);
  });
  lbl.replaceWith(input);
  input.focus(); input.select();
};

window.edDelGenRow = function(btn) {
  btn.closest('.ed-gen-row').remove();
};

// ── Region dropdown (éditeur) ────────────────────────
window.edOpenRegions = function(input) {
  const dd = input.closest('div[style*="position:relative"]').querySelector('[data-reg-dropdown]');
  if (dd) { dd.style.display = ''; edFilterRegions(input); }
};
window.edCloseRegions = function(input) {
  const wrap = input.closest('div[style*="position:relative"]');
  if (!wrap) return;
  const dd = wrap.querySelector('[data-reg-dropdown]');
  if (dd) dd.style.display = 'none';
  // Restaure le nom affiché depuis la valeur cachée
  const hidden = wrap.querySelector('input[type="hidden"]');
  if (hidden) {
    const cached = (_edCache.regions || []).find(r => r.id === hidden.value);
    input.value = cached ? (cached.name || cached.id) : (hidden.value || '');
  }
};
window.edFilterRegions = function(input) {
  const dd = input.closest('div[style*="position:relative"]').querySelector('[data-reg-dropdown]');
  if (!dd) return;
  dd.style.display = '';
  const q = normalize(input.value.trim());
  let lastGroup = null;
  Array.from(dd.children).forEach(el => {
    if (el.hasAttribute('data-reg-group')) {
      lastGroup = el; el.style.display = 'none'; return;
    }
    if (!el.hasAttribute('data-reg-id') && !el.hasAttribute('data-reg-name')) return;
    const name = normalize(el.dataset.regName || '');
    const id   = (el.dataset.regId   || '').toLowerCase();
    const show = !q || name.includes(q) || id.includes(q);
    el.style.display = show ? '' : 'none';
    if (show && lastGroup) { lastGroup.style.display = ''; lastGroup = null; }
  });
};
window.edSelectRegion = function(e, el) {
  e.preventDefault();
  const wrap   = el.closest('div[style*="position:relative"]');
  const textIn = wrap.querySelector('input[type="text"]');
  const hidden = wrap.querySelector('input[type="hidden"]');
  const id     = el.dataset.regId;
  const name   = el.dataset.regName;
  if (hidden) hidden.value = id;
  if (textIn) textIn.value = name || '';
  const dd = wrap.querySelector('[data-reg-dropdown]');
  if (dd) dd.style.display = 'none';
};


window.showEditor = async function(collection, id, data, origin) {
  document.querySelectorAll('.main').forEach(el => el.style.display = 'none');
  document.getElementById('editor-panel').style.display = '';
  document.getElementById('btn-mob-order').classList.remove('active');
  document.getElementById('btn-item-order').classList.remove('active');
  document.getElementById('btn-pnj-order').classList.remove('active');
  document.getElementById('btn-ghost-ids').classList.remove('active');
  document.getElementById('btn-region-order').classList.remove('active');
  document.getElementById('btn-quest-order').classList.remove('active');
  document.getElementById('btn-region-orphans').classList.remove('active');
  document.getElementById('btn-mob-orphans').classList.remove('active');
  document.getElementById('btn-quest-orphans').classList.remove('active');

  document.querySelector('.sidebar').classList.add('in-order-panel');

  _ed.collection = collection;
  _ed.id         = id;
  _ed.origin     = origin;

  // Fetch data from Firestore when not provided (e.g. called from the completion panel)
  if (!data) {
    document.getElementById('editor-title').textContent            = '✏️  Chargement…';
    document.getElementById('editor-collection-badge').textContent = _COL_LABELS[collection] || collection;
    document.getElementById('ed-error').style.display              = 'none';
    document.getElementById('editor-form').innerHTML               = '<div class="empty">Chargement…</div>';
    const btnL = document.getElementById('btn-save-editor');
    btnL.textContent = '💾 Sauvegarder'; btnL.disabled = false;
    btnL.style.background = 'var(--accent)'; btnL.style.color = '#fff';
    try {
      const snap = await getDoc(doc(db, collection, id));
      data = snap.exists() ? desanitizeFromFirestore({ id: snap.id, ...snap.data() }) : { id };
    } catch(e) {
      document.getElementById('ed-error').textContent = `Erreur lors du chargement : ${e.message}`;
      document.getElementById('ed-error').style.display = '';
      return;
    }
  }

  document.getElementById('editor-title').textContent            = `✏️  ${data.name || id}`;
  document.getElementById('editor-collection-badge').textContent = _COL_LABELS[collection] || collection;
  document.getElementById('ed-error').style.display              = 'none';
  const btn = document.getElementById('btn-save-editor');
  btn.textContent = '💾 Sauvegarder'; btn.disabled = false;
  btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
  const btnDel = document.getElementById('btn-delete-editor');
  if (btnDel) { btnDel.disabled = false; btnDel.textContent = '🗑️ Supprimer'; }

  // Charger les régions si besoin (pour la datalist)
  if (collection === 'mobs' || collection === 'personnages' || collection === 'regions' ||
      collection === 'mobs_secret' || collection === 'pnj_secret') {
    await _loadRegionsForEditor();
  }

  // Construire le formulaire générique (variantes sensibles traitées comme leur collection publique)
  const _colAlias = { items_sensible: 'items', mobs_secret: 'mobs', pnj_secret: 'personnages' };
  const formCollection = _colAlias[collection] ?? collection;
  document.getElementById('editor-form').innerHTML = _buildGenericForm(data, formCollection);


  // Basculer sur l'onglet qualité si l'item n'a pas de version normale
  if (isQualityOnly(data)) {
    edSwitchTab('quality');
  }

  // Initialiser le color picker si présent (régions)
  const cpEl = document.querySelector('#editor-form .ed-color-picker[data-init-hex]');
  if (cpEl) {
    const initHex    = cpEl.dataset.initHex || '#9a9ab0';
    const [ir,ig,ib] = _cpHexToRgb(initHex);
    const [ih,is,iv] = _cpRgbToHsv(ir, ig, ib);
    _cpUpdate(cpEl.id, ih, is, iv);
  }

  // Peupler la datalist des sets (items et items_sensible)
  if (collection === 'items' || collection === 'items_sensible') await _populateSetDatalist();

  _initFormExtras('#editor-form');
};

window.editorGoBack = function() {
  if (_ed.origin === 'mob')            { showMobOrder();       return; }
  if (_ed.origin === 'item')           { showItemOrder();      return; }
  if (_ed.origin === 'pnj')            { showPnjOrder();       return; }
  if (_ed.origin === 'region')         { showRegionOrder();    return; }
  if (_ed.origin === 'panoplie')       { showPanoplieOrder();  return; }
  if (_ed.origin === 'quest')          { showQuestOrder();     return; }
  if (_ed.origin === 'region-orphan')  { showRegionOrphans(); return; }
  if (_ed.origin === 'mob-orphan')     { showMobOrphans();    return; }
  if (_ed.origin === 'quest-orphan')  { showQuestOrphans();  return; }
  if (_ed.origin === 'completion')      { showCompletion(); return; }
  if (_ed.origin === 'allpins')         { showMapPanel(); switchMapTab('allpins'); return; }
  if (_ed.origin === 'data-all')        { showDataAll();        return; }
  if (_ed.origin === 'dead-links')      { showDeadLinks();      return; }
  showSubmissions();
};

// ID attendu pour un palier : quêtes « pN_titre », items « nom_pN » (suffixe éventuel « _2 » conservé). null = pas de règle.
function _idForPalier(col, id, palier) {
  const p = Number(palier);
  if (!id || !Number.isInteger(p) || p < 1) return null;   // Event / Archive / vide : on ne touche pas
  if (col === 'quetes') return /^p\d+_/.test(id) ? id.replace(/^p\d+_/, `p${p}_`) : null;
  if (col === 'items')  return /_p\d+(?:_\d+)?$/.test(id) ? id.replace(/_p\d+((?:_\d+)?)$/, `_p${p}$1`) : null;
  return null;
}

// ── Save (générique) ─────────────────────────────────
window.saveEditor = async function() {
  const btn    = document.getElementById('btn-save-editor');
  const errDiv = document.getElementById('ed-error');
  errDiv.style.display = 'none';
  btn.disabled = true; btn.textContent = '⏳ Sauvegarde…';

  try {
    const newData = _collectGenericForm();

    // ── Cas spécial : item sensible (items_hidden + items_secret) ──────────
    if (_ed.collection === 'items_sensible') {
      const gameplayKeys = await getItemGameplayKeys();
      const gameplay = {};
      const secret   = {};
      for (const [k, v] of Object.entries(newData)) {
        if (k === 'sensible') continue;
        if (gameplayKeys.includes(k)) gameplay[k] = v;
        else                          secret[k]   = v;
      }
      const nameHash = await hashName(newData.name);
      if (!nameHash) throw new Error('Nom manquant pour hash');
      const itemId    = String(newData.id || '');
      const oldItemId = String(_ed.origData?.id || _ed.id || '');
      // items_hidden est TOUJOURS keyé par hash du nom (jamais par item.id)
      const newHiddenDocId = nameHash;
      if (newHiddenDocId !== _ed.id) {
        try { await deleteDoc(doc(db, COL.itemsHidden, _ed.id)); } catch {}
      }
      await setDoc(doc(db, COL.itemsHidden, newHiddenDocId), sanitizeForFirestore({ ...gameplay, nameHash, sensible: true }));
      // Si le publicId a changé, supprimer l'ancien doc items_secret (keyé par publicId) → évite l'orphelin
      if (oldItemId && oldItemId !== itemId) {
        try { await deleteDoc(doc(db, COL.itemsSecret, oldItemId)); } catch {}
      }
      if (itemId) {
        if (Object.keys(secret).length) {
          await setDoc(doc(db, COL.itemsSecret, itemId), sanitizeForFirestore({ ...secret, sensible: true }));
        } else {
          try { await deleteDoc(doc(db, COL.itemsSecret, itemId)); } catch {}
        }
      }
      invalidateModCache(COL.itemsHidden);
      invalidateModCache(COL.itemsSecret);
      // Mettre à jour ctx.sensState en mémoire
      const merged = { ...gameplay, ...secret };
      const idx = ctx.sensState.itemsHidden.findIndex(x => x._id === _ed.id);
      if (idx >= 0) ctx.sensState.itemsHidden[idx] = { _id: newHiddenDocId, ...merged };
      else ctx.sensState.itemsHidden.push({ _id: newHiddenDocId, ...merged });
      _ed.id = newHiddenDocId;
      _ed.origData = { ...newData };
      // Forcer rechargement propre du panel data-all (sinon affiche encore l'ancien hash)
      window._dataAllInvalidate?.();
      btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
      setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; btn.style.background = 'var(--accent)'; btn.style.color = '#fff'; }, 2500);
      return;
    }

    // L'ID suit le palier (quêtes : pN_…, items : …_pN) : un palier corrigé après coup corrige aussi l'ID, donc la clé du document
    // (sauf si l'ID a été modifié à la main dans le formulaire)
    {
      const synced = _idForPalier(_ed.collection, String(newData.id ?? ''), newData.palier);
      if (synced && synced !== String(newData.id) && String(newData.id) === String(_ed.id)) {
        toast(`ID aligné sur le palier : ${newData.id} → ${synced}`, 'info');
        newData.id = synced;
        const idRow = [...document.querySelectorAll('.ed-gen-row')].find(r => r.querySelector('.ed-gen-keylbl')?.textContent.trim() === 'id');
        const idInput = idRow?.querySelector('[data-gf-type]');
        if (idInput) idInput.value = synced;
      }
    }

    // Item renommé dans le formulaire : l'ID suit le nom (sauf si l'ID a été modifié à la main)
    if (_ed.collection === 'items' && newData.name && _ed.origData?.name && newData.name !== _ed.origData.name
        && String(newData.id ?? '') === String(_ed.id)) {
      const nid = _renamedItemId(String(_ed.id), _ed.origData.name, newData.name);
      if (nid) {
        toast(`ID aligné sur le nom : ${newData.id} → ${nid}`, 'info');
        newData.id = nid;
        const idRow = [...document.querySelectorAll('.ed-gen-row')].find(r => r.querySelector('.ed-gen-keylbl')?.textContent.trim() === 'id');
        const idInput = idRow?.querySelector('[data-gf-type]');
        if (idInput) idInput.value = nid;
      }
    }

    // Renommage d'ID → recréer le document (toutes collections)
    const rawNewId = (newData.id != null ? String(newData.id).trim() : '');
    const newDocId = rawNewId || _ed.id;

    const _editorContribs = _readContribs(_ed.origData);
    const _selfContrib = ctx.user
      ? { uid: ctx.user.uid, name: ctx.userNames.get(ctx.user.uid) || ctx.user.displayName || ctx.user.email || 'Inconnu' }
      : null;

    if (newDocId !== _ed.id) {
      // Vérifier qu'aucun document n'existe déjà avec cet ID
      const clashSnap = await getDoc(doc(db, _ed.collection, newDocId));
      if (clashSnap.exists()) {
        throw new Error(`Un document avec l'ID "${newDocId}" existe déjà dans ${_ed.collection}.`);
      }
      const currentSnap = await getDoc(doc(db, _ed.collection, _ed.id));
      const existing = currentSnap.exists() ? currentSnap.data() : {};
      const existContribs = _readContribs(existing);
      const contribs = existContribs.length ? existContribs : _editorContribs;
      const _merged = { ...existing, ...newData, id: newDocId, ...(contribs.length ? { _contributor: contribs } : {}) };
      let _edImgPairs = [];
      if (_ed.collection === 'items' && _merged.images?.length) { const r = _renameImagePaths(_merged.images, _ed.id, newDocId); _merged.images = r.images; _edImgPairs = r.pairs; newData.images = r.images; }
      await setDoc(doc(db, _ed.collection, newDocId), _merged);
      await deleteDoc(doc(db, _ed.collection, _ed.id));
      if (_ed.collection === 'personnages') { // quêtes, textes d'obtention [npc:id|nom], soumissions en attente…
        try {
          const n = await _renameItemReferences(_ed.id, newDocId, { npcText: true });
          toast(`Références au PNJ mises à jour : ${n} document${n !== 1 ? 's' : ''}`, 'success', 6000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
      }
      if (_ed.collection === 'items') { // toutes les références à l'ancien ID suivent
        try {
          const n = await _renameItemReferences(_ed.id, newDocId);
          await _recordItemRename(_ed.id, newDocId);
          toast(`Références mises à jour : ${n} document${n !== 1 ? 's' : ''}`, 'success', 6000);
        } catch (e) {
          toast(`⚠️ ID renommé, mais certaines références n'ont pas pu être mises à jour : ${e.message}`, 'warning', 9000);
        }
        _writeAudit('rename_id', 'item', newDocId, newData.name || newDocId, { from: _ed.id, to: newDocId });
        _toastImageRenames(_edImgPairs);
      }
      _editorCacheRename(_ed.collection, _ed.id, newDocId, newData);
      _ed.id = newDocId;
    } else {
      // On prépare le patch à partir de newData
      const patch = { ...newData };

      // Suppression UNIQUEMENT des champs qui ont réellement disparu du formulaire
      // On ignore 'quality' ici car il est géré globalement dans newData
      Object.keys(_ed.origData).forEach(k => {
        if (!(k in newData) && k !== '_order') {
          patch[k] = deleteField();
        }
      });

      if (!_editorContribs.length && _selfContrib) {
        patch._contributor = [_selfContrib];
      } else if (_editorContribs.length) {
        patch._contributor = _editorContribs; // préserver sans ajouter l'éditeur admin
      }

      // Nettoyage pour Firestore (évite les undefined/null selon tes besoins)
      await updateDoc(doc(db, _ed.collection, _ed.id), sanitizeForFirestore(patch));
    }

    if (_ed.collection === 'items') {
      _syncItemObtain(String(_ed.id)).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain item]', e));
    }

    if (_ed.collection === 'mobs') {
      _syncMobObtain({ ...newData, id: String(newData.id ?? _ed.id) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain mob]', e));
    }

    if (_ed.collection === 'personnages') {
      _syncPnjObtain({ ...newData, id: String(newData.id ?? _ed.id) }).then(n => { if (n.length) toast(`Obtain mis à jour : ${n.slice(0, 4).join(', ')}${n.length > 4 ? ` (+${n.length - 4})` : ''}`, 'success', 6000); }).catch(e => console.warn('[obtain PNJ]', e));
    }

    // Invalider les caches localStorage et session
    localStorage.removeItem(`vcl_cache_v2_${_ed.collection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_ed.collection}`);
    invalidateModCache(_ed.collection);
    if (_ed.collection === 'regions') _edCache.regions = null;
    if (_ed.collection === 'items')   _edCache.sets    = null;

    // Mettre à jour le cache mémoire
    _editorCacheUpdate(_ed.collection, _ed.id, newData);
    if (_ed.collection === 'mobs_secret') {
      const idx = ctx.sensState.mobsSecret.findIndex(x => x._id === _ed.id);
      if (idx >= 0) Object.assign(ctx.sensState.mobsSecret[idx], newData);
    } else if (_ed.collection === 'pnj_secret') {
      const idx = ctx.sensState.pnjSecret.findIndex(x => x._id === _ed.id);
      if (idx >= 0) Object.assign(ctx.sensState.pnjSecret[idx], newData);
    }
    _ed.origData = { ...newData };
    // Mettre à jour le cache data-all (force rechargement propre)
    window._dataAllInvalidate?.();

    btn.textContent = '✔ Sauvegardé'; btn.style.background = '#14532d'; btn.style.color = 'var(--success)';
    setTimeout(() => {
      btn.disabled = false; btn.textContent = '💾 Sauvegarder';
      btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
    }, 2500);

  } catch(e) {
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
    btn.style.background = 'var(--accent)'; btn.style.color = '#fff';
    errDiv.textContent = '⛔ ' + e.message;
    errDiv.style.display = '';
  }
};

function _editorCacheRename(col, oldId, newId, newData) {
  const renameIn = (obj) => {
    obj.id = newId;
    Object.keys(obj).forEach(k => { if (k !== '_order' && !(k in newData)) delete obj[k]; });
    Object.entries(newData).forEach(([k, v]) => { if (k !== '_order' || !(k in obj)) obj[k] = v; });
  };
  if      (col === 'items')       { const it = _orderData('itemOrder').find(i => i.id === oldId); if (it) renameIn(it); }
  else if (col === 'mobs')        { const m  = _orderData('mobOrder').find(m => m.id === oldId);   if (m)  renameIn(m); }
  else if (col === 'personnages') { _orderData('pnjRegions').forEach(r => { const p = r.pnjs.find(p => p.id === oldId); if (p) renameIn(p); }); }
  else if (col === 'regions')     { const r  = _orderData('regionOrder').find(r => r.id === oldId); if (r) renameIn(r); }
  else if (col === 'quetes')      { const qt = _orderData('questOrder').find(q => q.id === oldId);  if (qt) renameIn(qt); }
}

function _editorCacheUpdate(col, id, newData) {
  const applyTo = (obj) => {
    // Supprimer les clés qui ne sont plus présentes (sauf internes)
    Object.keys(obj).forEach(k => { if (k !== '_order' && !(k in newData)) delete obj[k]; });
    Object.entries(newData).forEach(([k, v]) => { if (k !== '_order' || !(k in obj)) obj[k] = v; });
  };
  if      (col === 'items')       { const it = _orderData('itemOrder').find(i => i.id === id); if (it) applyTo(it); }
  else if (col === 'mobs')        { const m  = _orderData('mobOrder').find(m => m.id === id);   if (m)  applyTo(m); }
  else if (col === 'personnages') { _orderData('pnjRegions').forEach(r => { const p = r.pnjs.find(p => p.id === id); if (p) applyTo(p); }); }
  else if (col === 'regions')     { const r  = _orderData('regionOrder').find(r => r.id === id); if (r) applyTo(r); }
  else if (col === 'quetes')      { const qt = _orderData('questOrder').find(q => q.id === id);  if (qt) applyTo(qt); }
}

// ── Delete entry (depuis l'éditeur) ──────────────────
window.deleteCurrentEntry = async function() {
  const typeName = _COL_LABELS[_ed.collection] || _ed.collection;
  if (!await modal.confirm(`Supprimer ce ${typeName} "${_ed.id}" ?\n\nL'entrée sera placée en corbeille (restaurable depuis l'onglet Admin > Corbeille).`)) return;
  const btn = document.getElementById('btn-delete-editor');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    // Sauvegarder en corbeille avant suppression
    const trashPayload = {
      originalCollection: _ed.collection,
      originalId: _ed.id,
      deletedAt: serverTimestamp(),
      deletedBy: ctx.user?.uid || null,
      deletedByName: ctx.userNames.get(ctx.user?.uid) || ctx.user?.email || 'Inconnu',
      data: sanitizeForFirestore(_ed.origData || {})
    };
    try { await addDoc(collection(db, 'trash'), trashPayload); } catch(te) { console.warn('[Trash] Sauvegarde corbeille échouée:', te); }

    if (_ed.collection === 'items_sensible') {
      // items_hidden keyé par nameHash (_ed.id = hash), items_secret keyé par item.id
      const itemId = String(_ed.origData?.id || '');
      const delBatch = writeBatch(db);
      delBatch.delete(doc(db, COL.itemsHidden, _ed.id));
      if (itemId) delBatch.delete(doc(db, COL.itemsSecret, itemId));
      await delBatch.commit();
      invalidateModCache(COL.itemsHidden);
      invalidateModCache(COL.itemsSecret);
      ctx.sensState.itemsHidden = ctx.sensState.itemsHidden.filter(x => x._id !== _ed.id);
      window._dataAllRemove?.(d => d._col === COL.itemsHidden && d._docKey === _ed.id);
      editorGoBack();
      return;
    }
    await deleteDoc(doc(db, _ed.collection, _ed.id));
    // Invalider les caches localStorage
    localStorage.removeItem(`vcl_cache_v2_${_ed.collection}`);
    localStorage.removeItem(`vcl_cache_meta_v2_${_ed.collection}`);
    invalidateModCache(_ed.collection);
    // Retirer de la liste locale (évite d'avoir à recharger le panneau)
    if      (_ed.collection === 'mobs')        { if (_shared.mobOrder) _shared.mobOrder.data = _shared.mobOrder.data.filter(m => m.id !== _ed.id); }
    else if (_ed.collection === 'items')        { if (_shared.itemOrder) _shared.itemOrder.data = _shared.itemOrder.data.filter(i => i.id !== _ed.id); }
    else if (_ed.collection === 'personnages')  { _orderData('pnjRegions').forEach(r => { r.pnjs = r.pnjs.filter(p => p.id !== _ed.id); }); }
    else if (_ed.collection === 'regions')      { if (_shared.regionOrder) _shared.regionOrder.data = _shared.regionOrder.data.filter(r => r.id !== _ed.id); }
    else if (_ed.collection === 'quetes')       { if (_shared.questOrder) _shared.questOrder.data = _shared.questOrder.data.filter(q => q.id !== _ed.id); }
    // Retirer aussi du cache data-all (suppression en chaîne sans reload)
    const _delId = _ed.id;
    const _delCol = _ed.collection;
    window._dataAllRemove?.(d => d.id === _delId && d._col === _delCol);
    editorGoBack();
  } catch(e) {
    btn.disabled = false; btn.textContent = '🗑️ Supprimer';
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};
}
