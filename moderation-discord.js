// ══════════════════════════════════════════════════════
// DISCORD — webhooks, constructeur d'embeds, publication des soumissions, forums
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { desanitizeFromFirestore, generateCardBlob, getWorkerSecret: _getWorkerSecret, WORKER_URL, cachedDocs, setHash: _setHash, db, COL, collection, getDocs, getDoc, doc, updateDoc, setDoc, deleteDoc, limit, toast, modal, escHtml } = ctx;
const _ee = escHtml;
// ── Discord Webhooks ──────────────────────────────────
let _dwConfig = null;
const DW_CATEGORIES = [
  { id: 'arme',       label: '⚔️ Arme' },
  { id: 'armure',     label: '🛡️ Armure' },
  { id: 'accessoire', label: '💍 Accessoire' },
];

const EMBED_FIELDS = [
  { id:'identity', label:'🏷️ Identité',   desc:'Rareté · Catégorie · Palier · Niveau' },
  { id:'classes',  label:'⚔️ Classes',    desc:'Classes requises' },
  { id:'lore',     label:'📖 Lore',       desc:'Texte de lore en italique' },
  { id:'stats',    label:'📊 Stats',      desc:'Stats + emplacements de runes' },
  { id:'obtain',   label:'📍 Obtention',  desc:"Méthode d'obtention" },
  { id:'craft',    label:'🔨 Craft',      desc:'Recette de craft' },
  { id:'effects',  label:'✨ Effets',     desc:'Effets spéciaux' },
  { id:'bonuses',  label:'🔗 Bonus pano', desc:'Bonus de panoplie' },
];


let _dwPublishItems = [];
let _dwActivetab = 'webhooks';

window.showDiscordWebhooks = async () => {
  _setHash('webhooks');
  document.getElementById('discord-webhooks-panel').style.display = '';
  document.getElementById('btn-discord-webhooks').classList.add('active');
  document.querySelector('.sidebar').classList.add('in-order-panel');
  await loadDiscordWebhooks();
};

window.loadDiscordWebhooks = async function loadDiscordWebhooks() {
  const loading = document.getElementById('dw-loading');
  const content = document.getElementById('dw-content');
  loading.style.display = '';
  loading.textContent   = 'Chargement…';
  content.style.display = 'none';
  try {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};

    // Migrate: array format (v1) → object format (v2)
    if (Array.isArray(_dwConfig.tagRules)) {
      const oldRules = _dwConfig.tagRules;
      _dwConfig.tagRules = {};
      for (const cat of DW_CATEGORIES) {
        for (const p of ctx.creatorPaliers) {
          const key = `${cat.id}_${p}`;
          if (_dwConfig[key]) _dwConfig.tagRules[key] = oldRules.map(r => ({...r}));
        }
      }
    }
    // Migrate: legacy flat tags → tagRules object (very old format)
    if (_dwConfig.tags && !_dwConfig.tagRules) {
      _dwConfig.tagRules = {};
      const rules = Object.entries(_dwConfig.tags).map(([k, v]) => {
        const isCategory = ['arme','armure','accessoire'].includes(k);
        return { field: isCategory ? 'category' : 'rarity', op: 'eq', value: k, tagId: v };
      }).filter(r => r.tagId);
      for (const cat of DW_CATEGORIES) {
        for (const p of ctx.creatorPaliers) {
          const key = `${cat.id}_${p}`;
          if (_dwConfig[key]) _dwConfig.tagRules[key] = rules.map(r => ({...r}));
        }
      }
    }
    if (!_dwConfig.tagRules) _dwConfig.tagRules = {};

    _renderDiscordWebhooks();
    document.getElementById('dw-template').value = _dwConfig.template || '';
    switchDwTab(_dwActivetab || 'webhooks');
    loading.style.display = 'none';
    content.style.display = '';
  } catch(e) {
    loading.textContent = `Erreur : ${e.message}`;
  }
};

function _renderDiscordWebhooks() {
  const list = document.getElementById('dw-list');
  list.innerHTML = '';

  // ── Webhook "Nouveaux ajouts" ──────────────────────────
  const newSubSection = document.createElement('div');
  newSubSection.style.cssText = 'margin-bottom:24px;padding:12px 14px;background:rgba(74,222,128,.05);border:1px solid rgba(74,222,128,.2);border-radius:8px;';
  newSubSection.innerHTML = `
    <div style="font-size:11px;font-weight:700;color:var(--success);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px;">📬 Nouvelles soumissions</div>
    <p style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5;">
      Webhook envoyé automatiquement quand un contributeur soumet un ajout ou une modification. Contient toute la data.
    </p>
    <div style="display:flex;align-items:center;gap:8px;">
      <input type="text" id="dw-new-submission" placeholder="https://discord.com/api/webhooks/…"
        value="${_dwConfig?.new_submission || ''}"
        style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:11px;outline:none;font-family:monospace;transition:border-color .15s;"
        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">
      <button class="btn btn-ghost" style="font-size:11px;padding:5px 10px;flex-shrink:0;" onclick="testNewSubmissionWebhook()">🧪 Test</button>
    </div>
  `;
  list.appendChild(newSubSection);

  for (const cat of DW_CATEGORIES) {
    const section = document.createElement('div');
    section.style.cssText = 'margin-bottom:20px;';

    const header = document.createElement('div');
    header.style.cssText = 'font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:10px;';
    header.textContent = cat.label;
    section.appendChild(header);

    for (const p of ctx.creatorPaliers) {
      const key = `${cat.id}_${p}`;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
      const input = document.createElement('input');
      input.type        = 'text';
      input.id          = `dw-${key}`;
      input.placeholder = 'ID du channel Discord (forum)';
      input.value       = _dwConfig[key] || '';
      input.style.cssText = 'flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:11px;outline:none;font-family:monospace;transition:border-color .15s;';
      input.addEventListener('focus', () => { input.style.borderColor = 'var(--accent)'; });
      input.addEventListener('blur',  () => { input.style.borderColor = 'var(--border)'; });

      const label = document.createElement('span');
      label.textContent = `Palier ${p}`;
      label.style.cssText = 'font-size:12px;width:58px;flex-shrink:0;color:var(--text);';

      const delBtn = document.createElement('button');
      delBtn.className = 'btn btn-ghost';
      delBtn.title = 'Supprimer tous les posts Discord de ce channel';
      delBtn.style.cssText = 'font-size:11px;padding:5px 8px;flex-shrink:0;color:var(--danger);';
      delBtn.textContent = '🗑️';
      delBtn.addEventListener('click', () => deleteChannelPosts(key));

      row.appendChild(label);
      row.appendChild(input);
      row.appendChild(delBtn);
      section.appendChild(row);
    }
    list.appendChild(section);
  }
}

window.deleteChannelPosts = async function deleteChannelPosts(key) {
  if (!await modal.confirm(`Supprimer tous les posts Discord pour « ${key} » ?\n(supprime uniquement les messages sur Discord, les données Firestore sont conservées)`)) return;

  const snap = await getDocs(collection(db, 'discord_posts'));
  const posts = snap.docs.map(d => ({ _id: d.id, ...d.data() })).filter(p => p.webhookKey === key);

  if (!posts.length) {
    toast('Aucun post tracké pour ce channel.', 'warning');
    return;
  }

  const WORKER_SECRET = await _getWorkerSecret();
  let deleted = 0, failed = 0;
  for (const post of posts) {
    try {
      if (post.threadId) {
        const rt = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ secret: WORKER_SECRET, action: 'delete_thread', threadId: post.threadId }),
        });
        if (!rt.ok) { console.warn('[deleteChannelPosts] thread delete failed', rt.status); failed++; continue; }
      }
      await deleteDoc(doc(db, 'discord_posts', post._id)).catch(() => {});
      deleted++;
    } catch(e) { console.error('[deleteChannelPosts] error', e); failed++; }
  }
  toast(`${deleted} post(s) supprimé(s)${failed ? `, ${failed} échec(s) — voir console` : ''}.`, deleted ? 'success' : 'error');
};

window.saveDiscordWebhooks = async function saveDiscordWebhooks() {
  const btn = document.getElementById('dw-save-btn');
  btn.disabled = true; btn.textContent = '⏳';
  try {
    const data = {};
    for (const cat of DW_CATEGORIES) {
      for (const p of ctx.creatorPaliers) {
        const key = `${cat.id}_${p}`;
        const val = document.getElementById(`dw-${key}`)?.value?.trim() || '';
        if (val) data[key] = val;
      }
    }
    const tpl = document.getElementById('dw-template')?.value?.trim() || '';
    if (tpl) data.template = tpl;
    const newSub = document.getElementById('dw-new-submission')?.value?.trim() || '';
    if (newSub) data.new_submission = newSub;
    // Persist embedFields from in-memory config
    if (_dwConfig?.embedFields) data.embedFields = _dwConfig.embedFields;

    // Persist tagRules object (keyed by channel, skip empty arrays)
    if (_dwConfig?.tagRules && !Array.isArray(_dwConfig.tagRules)) {
      const cleaned = {};
      for (const [k, v] of Object.entries(_dwConfig.tagRules)) {
        if (Array.isArray(v) && v.length > 0) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length) data.tagRules = cleaned;
    }

    // Preserve set cache
    if (_dwConfig?._setCache) data._setCache = _dwConfig._setCache;

    await setDoc(doc(db, 'config', 'discord_webhooks'), data);
    _dwConfig = data;
    btn.textContent = '✓ Sauvegardé';
    setTimeout(() => { btn.disabled = false; btn.textContent = '💾 Sauvegarder'; }, 2000);
  } catch(e) {
    toast(`⛔ Erreur sauvegarde webhooks : ${e.message}`, "error");
    btn.disabled = false; btn.textContent = '💾 Sauvegarder';
  }
};

// ── Tab switcher ──────────────────────────────────────
window.switchDwTab = function switchDwTab(name) {
  _dwActivetab = name;
  const tabs = ['webhooks', 'embed', 'publish'];
  for (const t of tabs) {
    const tab = document.getElementById(`dw-tab-${t}`);
    const btn = document.getElementById(`dw-tab-btn-${t}`);
    if (!tab || !btn) continue;
    const active = t === name;
    tab.style.display = active ? '' : 'none';
    btn.style.background = active ? 'var(--accent)' : 'transparent';
    btn.style.color = active ? '#fff' : 'var(--muted)';
  }
  if (name === 'embed')   _renderEmbedBuilder();
  if (name === 'publish') _renderPublishPanel();
};

// ── Embed Builder ─────────────────────────────────────
function _renderEmbedBuilder() {
  const activeEl   = document.getElementById('dw-embed-active');
  const inactiveEl = document.getElementById('dw-embed-inactive');
  if (!activeEl || !inactiveEl) return;

  const allIds   = EMBED_FIELDS.map(f => f.id);
  const activeIds = (_dwConfig?.embedFields) ? [..._dwConfig.embedFields] : [...allIds];
  const inactiveIds = allIds.filter(id => !activeIds.includes(id));

  const INPUT_STYLE = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--text);outline:none;';
  const BTN_GHOST   = 'background:transparent;border:1px solid var(--border);border-radius:5px;color:var(--muted);cursor:pointer;font-size:11px;padding:3px 7px;';

  function rebuildActiveDOM() {
    activeEl.innerHTML = '';
    const ids = (_dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id));
    for (let i = 0; i < ids.length; i++) {
      const fid = ids[i];
      const fd  = EMBED_FIELDS.find(f => f.id === fid);
      if (!fd) continue;
      const row = document.createElement('div');
      row.dataset.id = fid;
      row.draggable  = true;
      row.style.cssText = 'display:flex;align-items:center;gap:6px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;cursor:grab;user-select:none;transition:opacity .15s;';
      row.innerHTML = `
        <span style="color:var(--muted);font-size:14px;flex-shrink:0;">≡</span>
        <span style="flex:1;font-size:12px;font-weight:600;">${fd.label}</span>
        <span style="font-size:11px;color:var(--muted);">${fd.desc}</span>
        <button style="${BTN_GHOST}" title="Désactiver" onclick="dwEmbedRemove('${fid}')">✕</button>
      `;
      row.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', fid); row.style.opacity = '.4'; });
      row.addEventListener('dragend',   () => { row.style.opacity = '1'; });
      row.addEventListener('dragover',  e => { e.preventDefault(); row.style.borderColor = 'var(--accent)'; });
      row.addEventListener('dragleave', () => { row.style.borderColor = 'var(--border)'; });
      row.addEventListener('drop',      e => {
        e.preventDefault();
        row.style.borderColor = 'var(--border)';
        const srcId = e.dataTransfer.getData('text/plain');
        if (srcId === fid) return;
        const arr = _dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id);
        const si = arr.indexOf(srcId), di = arr.indexOf(fid);
        if (si < 0 || di < 0) return;
        arr.splice(di, 0, arr.splice(si, 1)[0]);
        _dwConfig.embedFields = arr;
        rebuildActiveDOM(); _renderEmbedPreview();
      });
      activeEl.appendChild(row);
    }
  }

  function rebuildInactiveDOM() {
    inactiveEl.innerHTML = '';
    const activeIds2 = _dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id);
    const inactive = EMBED_FIELDS.filter(f => !activeIds2.includes(f.id));
    if (!inactive.length) {
      inactiveEl.innerHTML = '<div style="font-size:12px;color:var(--muted);font-style:italic;">Tous les blocs sont actifs.</div>';
      return;
    }
    for (const fd of inactive) {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:7px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:7px;opacity:.6;';
      row.innerHTML = `
        <span style="flex:1;font-size:12px;">${fd.label} <span style="color:var(--muted);font-size:11px;">· ${fd.desc}</span></span>
        <button style="${BTN_GHOST};color:var(--accent);" onclick="dwEmbedAdd('${fd.id}')">＋</button>
      `;
      inactiveEl.appendChild(row);
    }
  }

  if (!_dwConfig.embedFields) _dwConfig.embedFields = EMBED_FIELDS.map(f => f.id);
  rebuildActiveDOM();
  rebuildInactiveDOM();
  _renderEmbedPreview();

  window.dwEmbedRemove = function(fid) {
    _dwConfig.embedFields = (_dwConfig.embedFields || EMBED_FIELDS.map(f=>f.id)).filter(id => id !== fid);
    rebuildActiveDOM(); rebuildInactiveDOM(); _renderEmbedPreview();
  };
  window.dwEmbedAdd = function(fid) {
    if (!_dwConfig.embedFields) _dwConfig.embedFields = EMBED_FIELDS.map(f=>f.id);
    if (!_dwConfig.embedFields.includes(fid)) _dwConfig.embedFields.push(fid);
    rebuildActiveDOM(); rebuildInactiveDOM(); _renderEmbedPreview();
  };
}

// ── Tag Rules ─────────────────────────────────────────
function _dwAllChannelKeys() {
  const standard = [];
  for (const cat of DW_CATEGORIES) {
    for (const p of [...ctx.creatorPaliers, 'event']) standard.push(`${cat.id}_${p}`);
  }
  const extra = Object.keys(_dwConfig.tagRules || {}).filter(k => !standard.includes(k));
  return [...standard, ...extra];
}

function _dwChannelLabel(key) {
  const parts  = key.split('_');
  const catId  = parts.slice(0, -1).join('_');
  const palier = parts[parts.length - 1];
  const cat    = DW_CATEGORIES.find(c => c.id === catId);
  if (!cat) return key;
  return palier === 'event' ? `${cat.label} · Event` : `${cat.label} · Palier ${palier}`;
}


// ── Publish Panel ─────────────────────────────────────
function _renderUnsentSection() {
  const section = document.getElementById('dw-unsent-section');
  if (!section) return;
  const unsent = ctx.allSubs.filter(s =>
    s.status === 'approved' &&
    s.type === 'item' &&
    s.discord_sent === false &&
    ['arme', 'armure', 'accessoire'].includes(s.data?.category) &&
    s.data?.palier
  );
  const RARITY_ICON = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const CAT_ICON    = { arme:'⚔️', armure:'🛡️', accessoire:'💍' };
  let body = '';
  if (!unsent.length) {
    body = `<div style="padding:12px 14px;font-size:12px;color:var(--muted);font-style:italic;">Aucune approval en attente d'envoi.</div>`;
  } else {
    let rows = '';
    for (const sub of unsent) {
      const it = sub.data || {};
      rows += `<div style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;transition:background .1s;"
        onmouseenter="this.style.background='var(--surface2)'" onmouseleave="this.style.background=''">
        <input type="checkbox" class="dw-unsent-check" data-subid="${_ee(sub._id)}" checked
          style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0;cursor:pointer;">
        <span style="flex:1;font-size:13px;font-weight:500;">${_ee(it.name||'—')}</span>
        <span style="font-size:11px;color:var(--muted);">
          ${CAT_ICON[it.category]||''} ${_ee(it.category||'')} · P${_ee(String(it.palier||'?'))} · ${RARITY_ICON[it.rarity]||''} ${_ee(it.rarity||'')}
        </span>
        <button onclick="dwUnsentDelete('${_ee(sub._id)}')" title="Retirer de la file d'envoi Discord"
          style="background:none;border:none;cursor:pointer;color:var(--danger,#f87171);font-size:14px;padding:2px 6px;border-radius:4px;flex-shrink:0;"
          onmouseenter="this.style.background='rgba(248,113,113,.15)'" onmouseleave="this.style.background='none'">🗑️</button>
      </div>`;
    }
    body = `<div style="padding:8px 10px;display:flex;flex-direction:column;gap:2px;">${rows}</div>`;
  }
  section.style.display = '';
  section.innerHTML = `
    <div style="border:1px solid var(--accent);border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <div style="padding:10px 14px;background:rgba(224,172,96,.1);border-bottom:1px solid var(--accent);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;">
        <span style="font-size:13px;font-weight:700;color:var(--accent);">🆕 Nouvelles approvals${unsent.length ? ` — ${unsent.length} non envoyée${unsent.length>1?'s':''}` : ''}</span>
        ${unsent.length ? `<div style="display:flex;gap:6px;align-items:center;">
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(true)"  style="font-size:11px;padding:4px 10px;">✅ Tout cocher</button>
          <button class="btn btn-ghost" onclick="dwUnsentCheckAll(false)" style="font-size:11px;padding:4px 10px;">☐ Tout décocher</button>
          <button id="dw-unsent-send-btn" class="btn" onclick="dwPublishUnsentSend()"
            style="background:var(--accent);color:var(--on-accent);font-size:12px;">📤 Envoyer la file</button>
        </div>` : ''}
      </div>
      ${body}
    </div>`;
}

window.dwUnsentCheckAll = function(state) {
  document.querySelectorAll('.dw-unsent-check').forEach(cb => { cb.checked = state; });
};

window.dwUnsentDelete = async function(subId) {
  if (!await modal.confirm('Retirer cet item de la file d\'envoi Discord ? (il restera approuvé mais ne sera plus proposé à l\'envoi)')) return;
  try {
    await updateDoc(doc(db, 'submissions', subId), { discord_sent: true });
    const sub = ctx.allSubs.find(s => s._id === subId);
    if (sub) sub.discord_sent = true;
    _renderUnsentSection();
    toast('✓ Item retiré de la file d\'envoi.', 'success');
  } catch(e) {
    toast('⛔ Erreur : ' + e.message, 'error');
  }
};

window.dwPublishUnsentSend = async function() {
  const checks = [...document.querySelectorAll('.dw-unsent-check:checked')];
  if (!checks.length) { toast('⚠️ Aucun item sélectionné.', 'warning'); return; }
  const btn = document.getElementById('dw-unsent-send-btn');
  if (btn) btn.disabled = true;
  const ids  = checks.map(c => c.dataset.subid);
  const subs = ctx.allSubs.filter(s => ids.includes(s._id));

  let done = 0, failed = 0;
  const total = subs.length;

  for (const sub of subs) {
    try {
      await sendApprovalWebhook(sub);
      await updateDoc(doc(db, 'submissions', sub._id), { discord_sent: true });
      sub.discord_sent = true;
      done++;
    } catch(e) {
      toast(`⛔ Erreur « ${sub.data?.name || sub._id} » : ${e.message}`, 'error');
      failed++;
    }
    if (done + failed < total) await new Promise(r => setTimeout(r, 2500));
  }

  if (done) toast(`✓ ${done} envoi${done>1?'s':''} réussi${done>1?'s':''}`, 'success');
  if (btn) btn.disabled = false;
  _renderUnsentSection();
};

async function _renderPublishPanel() {
  _renderUnsentSection();
  const listEl = document.getElementById('dw-pub-list');
  if (!listEl) return;
  listEl.innerHTML = '<div style="color:var(--muted);font-size:13px;">Chargement des items…</div>';
  try {
    const [items, hiddenItems] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    _dwPublishItems = [...items, ...hiddenItems].filter(it => it.category && it.palier);
    _dwPublishItems.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'fr'));
    dwPublishFilter();
  } catch(e) {
    listEl.innerHTML = `<div style="color:var(--muted);font-size:13px;">Erreur : ${_ee(e.message)}</div>`;
  }
}

window.dwPublishFilter = function() {
  const cat    = document.getElementById('dw-pub-cat')?.value    || '';
  const palier = document.getElementById('dw-pub-palier')?.value || '';
  const q      = (document.getElementById('dw-pub-search')?.value || '').toLowerCase();
  const listEl = document.getElementById('dw-pub-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  const RARITY_ICON = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const CAT_ICON    = { arme:'⚔️', armure:'🛡️', accessoire:'💍' };

  const filtered = _dwPublishItems.filter(it => {
    if (cat    && it.category !== cat) return false;
    if (palier && String(it.palier) !== palier) return false;
    if (q      && !(it.name||'').toLowerCase().includes(q)) return false;
    return true;
  });

  if (!filtered.length) {
    listEl.innerHTML = '<div style="font-size:13px;color:var(--muted);font-style:italic;padding:12px 0;">Aucun item trouvé.</div>';
    return;
  }

  for (const it of filtered) {
    const id  = it._id || it.id;
    const row = document.createElement('label');
    row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:7px;cursor:pointer;transition:background .1s;';
    row.onmouseenter = () => { row.style.background = 'var(--surface2)'; };
    row.onmouseleave = () => { row.style.background = ''; };
    row.innerHTML = `
      <input type="checkbox" class="dw-pub-check" data-id="${_ee(id)}" style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0;">
      <span style="flex:1;font-size:13px;font-weight:500;">${_ee(it.name||'—')}</span>
      <span style="font-size:11px;color:var(--muted);">
        ${CAT_ICON[it.category]||''} ${it.category||''} · P${it.palier||'?'} · ${RARITY_ICON[it.rarity]||''} ${it.rarity||''}
        ${it.sensible ? '<span style="color:#f87171;margin-left:4px;">🔞</span>' : ''}
      </span>
    `;
    listEl.appendChild(row);
  }
};

window.dwPublishCheckAll = function(state) {
  document.querySelectorAll('.dw-pub-check').forEach(cb => { cb.checked = state; });
};

window.dwPublishSelected = async function() {
  const checks = [...document.querySelectorAll('.dw-pub-check:checked')];
  if (!checks.length) { toast('⚠️ Aucun item sélectionné.', 'warning'); return; }

  const btn = document.getElementById('dw-pub-send-btn');
  const prog = document.getElementById('dw-pub-progress');
  const progText = document.getElementById('dw-pub-progress-text');
  const progBar  = document.getElementById('dw-pub-progress-bar');
  btn.disabled = true;
  prog.style.display = '';

  const ids   = checks.map(c => c.dataset.id);
  const items = _dwPublishItems.filter(it => ids.includes(it._id || it.id));

  const total = items.length;
  let done = 0;

  for (const item of items) {
    progText.textContent = `Envoi ${done + 1} / ${total} — ${item.name || ''}…`;
    progBar.style.width  = `${Math.round(done / total * 100)}%`;
    try {
      await _sendSingleItemDiscord(item);
    } catch(e) {
      toast(`⛔ Erreur pour « ${item.name} » : ${e.message}`, 'error');
    }
    done++;
    if (done < total) await new Promise(r => setTimeout(r, 2500));
  }

  progBar.style.width  = '100%';
  progText.textContent = `✓ ${done} envoi${done>1?'s':''} réussi${done>1?'s':''} !`;
  setTimeout(() => { prog.style.display = 'none'; btn.disabled = false; }, 3000);
};

// ── Helpers Discord bot (via Cloudflare Worker — évite CORS) ─────────

async function _workerCall(action, payload) {
  const secret = await _getWorkerSecret();
  const r = await fetch(WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret, action, ...payload }),
  });
  if (!r.ok) { const t = await r.text().catch(() => ''); console.warn('[worker]', action, r.status, t.slice(0, 200)); _workerCall.lastError = { status: r.status, text: t }; return null; }
  return r.json();
}


async function _postBotForumThread(channelId, threadName, content, fileBlob, fileName, tagIds) {
  const secret = await _getWorkerSecret();
  const message = {};
  if (content) message.content = content;
  message.attachments = [{ id: 0, filename: fileName }];
  const thread = { name: threadName, message };
  if (tagIds?.length) thread.applied_tags = tagIds;

  const fd = new FormData();
  fd.append('secret', secret);
  fd.append('action', 'post_thread');
  fd.append('channelId', channelId);
  fd.append('thread', JSON.stringify(thread));
  if (fileBlob && fileName) fd.append('file', fileBlob, fileName);
  fd.append('fileName', fileName);

  try {
    let r = await fetch(`${WORKER_URL}?action=post_thread`, { method: 'POST', body: fd });
    if (r.status === 429) {
      const err = await r.json().catch(() => ({}));
      const wait = Math.ceil((err.retry_after || 5) * 1000) + 500;
      console.warn(`[botPost] rate limit — attente ${Math.ceil(wait/1000)}s`);
      await new Promise(res => setTimeout(res, wait));
      r = await fetch(`${WORKER_URL}?action=post_thread`, { method: 'POST', body: fd });
    }
    if (!r.ok) { const t = await r.text().catch(() => ''); console.warn('[botPost]', r.status, t.slice(0, 200)); return null; }
    const data = await r.json();
    return { threadId: data.id, messageId: data.message?.id || data.id, raw: data };
  } catch(e) { console.error('[botPost]', e); return null; }
}

async function _getChannelId(key) {
  const r = await _routes(); // salons réglés dans l'onglet « 📣 Discord » (config/discord_routes) ; sinon salon par défaut
  const val = r.routes?.[key] || r.default || _dwConfig?.[key];
  if (!val) return null;
  // Migration : si valeur = URL webhook, dériver le channel ID automatiquement
  if (val.startsWith('http')) {
    const m = val.match(/\/webhooks\/(\d+)\/([^?/]+)/);
    if (!m) return null;
    const data = await _workerCall('get_webhook', { webhookId: m[1], webhookToken: m[2] });
    const channelId = data?.channel_id || null;
    if (channelId) _dwConfig[key] = channelId; // mise à jour en mémoire
    return channelId;
  }
  return val;
}

// Priorité pour l'ordre d'affichage des tags dans le channel
const TAG_TYPE_PRIORITY = { rarity: 0, slot: 1, set: 2, class: 3 };

async function _ensureTag(channelId, tagName, emoji = null, type = 'class') {
  if (!channelId || !tagName) return null;
  const name = tagName.slice(0, 20);
  if (!_dwConfig._tagCache)     _dwConfig._tagCache     = {};
  if (!_dwConfig._tagTypeCache) _dwConfig._tagTypeCache = {};
  const cacheKey = `${channelId}::${name}`;
  if (_dwConfig._tagCache[cacheKey]) {
    console.log(`[ensureTag] cache hit: "${name}" type=${type} id=${_dwConfig._tagCache[cacheKey]}`);
    return _dwConfig._tagCache[cacheKey];
  }

  const chan = await _workerCall('get_channel', { channelId });
  if (!chan) return null;
  const existing = (chan.available_tags || []).find(t => t.name === name);
  if (existing) {
    _dwConfig._tagCache[cacheKey]        = existing.id;
    _dwConfig._tagTypeCache[existing.id] = type;
    console.log(`[ensureTag] existing: "${name}" type=${type} id=${existing.id}`);
    return existing.id;
  }

  const newTag = { name, moderated: false };
  if (emoji) newTag.emoji_name = emoji;
  const updated = await _workerCall('patch_channel', {
    channelId,
    patch: { available_tags: [...(chan.available_tags || []), newTag] },
  });
  const created = (updated?.available_tags || []).find(t => t.name === name);
  if (created) {
    _dwConfig._tagCache[cacheKey]        = created.id;
    _dwConfig._tagTypeCache[created.id]  = type;
    console.log(`[ensureTag] created: "${name}" type=${type} id=${created.id}`);
    return created.id;
  }
  console.warn(`[ensureTag] FAILED to create tag "${name}"`);
  return null;
}

// Réordonne available_tags du channel selon rareté → set → classe
async function _reorderChannelTags(channelId) {
  if (!channelId) return;
  const chan = await _workerCall('get_channel', { channelId });
  if (!chan?.available_tags?.length) return;

  const typeCache = _dwConfig._tagTypeCache || {};
  const rarityNames = new Set(Object.values(window.VCL.RARITIES || {}).map(r => r.label));
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const classNames = new Set(CLASSES.map(c => c.label));
  const slotNames = new Set([...Object.values(SLOT_TAG_INFO).map(s => s.label), 'Deux mains']);

  const sorted = [...chan.available_tags].sort((a, b) => {
    const typeOf = t => rarityNames.has(t.name) ? 0 : slotNames.has(t.name) ? 1 : classNames.has(t.name) ? 3 : 2;
    const pa = typeCache[a.id] !== undefined ? TAG_TYPE_PRIORITY[typeCache[a.id]] : typeOf(a);
    const pb = typeCache[b.id] !== undefined ? TAG_TYPE_PRIORITY[typeCache[b.id]] : typeOf(b);
    if (pa !== pb) return pa - pb;
    // Sous-tri : raretés par ordre défini, classes par ordre CLASSES
    if (pa === 0) {
      const rar = Object.keys(window.VCL.RARITIES || {});
      const ia  = rar.findIndex(k => window.VCL.RARITIES[k].label === a.name);
      const ib  = rar.findIndex(k => window.VCL.RARITIES[k].label === b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    if (pa === 3) {
      const ia = CLASSES.findIndex(c => c.label === a.name);
      const ib = CLASSES.findIndex(c => c.label === b.name);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    }
    return a.name.localeCompare(b.name);
  });

  const changed = sorted.some((t, i) => t.id !== chan.available_tags[i].id);
  console.log('[reorder] avant:', chan.available_tags.map(t => t.name), '→ après:', sorted.map(t => t.name), 'changed:', changed);
  if (!changed) return;

  const result = await _workerCall('patch_channel', { channelId, patch: { available_tags: sorted } });
  console.log('[reorder] patch result available_tags:', result?.available_tags?.map(t => t.name));
}

window.reorderAllChannelTags = async function reorderAllChannelTags() {
  const btn = document.getElementById('btn-reorder-tags');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Réorganisation…'; }

  const seen = new Set();
  let ok = 0, skipped = 0, failed = 0;

  for (const cat of DW_CATEGORIES) {
    for (const p of ctx.creatorPaliers) {
      const key = `${cat.id}_${p}`;
      const channelId = await _getChannelId(key).catch(() => null);
      if (!channelId || seen.has(channelId)) { skipped++; continue; }
      seen.add(channelId);
      try {
        await _reorderChannelTags(channelId);
        ok++;
      } catch(e) {
        console.warn('[reorderAll] failed for', key, e);
        failed++;
      }
    }
  }

  console.log(`[reorderAll] done — ${ok} channels réorganisés, ${skipped} vides, ${failed} erreurs`);
  if (btn) {
    btn.textContent = failed ? `✗ ${failed} erreur(s)` : `✓ ${ok} channel(s) réorganisé(s)`;
    setTimeout(() => { btn.disabled = false; btn.textContent = '🔃 Réorganiser les tags'; }, 3000);
  }
}

function _buildCardMaps(panList, pnjList) {
  const panoplieData = {}, panoplieMap = {};
  for (const pan of panList) {
    const id = pan._id || pan.id;
    panoplieMap[id] = pan.label || id;
    panoplieData[id] = pan;
  }
  const pnjMap = {};
  for (const pnj of pnjList) {
    pnjMap[pnj._id || pnj.id] = pnj;
    if (pnj.id && pnj.id !== pnj._id) pnjMap[pnj.id] = pnj;
  }
  return { panoplieData, panoplieMap, pnjMap };
}

const RARITY_EMOJI = {
  commun:     '🌿',
  rare:       '💎',
  epique:     '💜',
  legendaire: '⭐',
  mythique:   '🌸',
  godlike:    '🔥',
  event:      '🎉',
};

const SLOT_TAG_INFO = {
  amulette:   { label: 'Amulette',         ico: '📿' },
  anneau:     { label: 'Anneau',            ico: '💍' },
  bracelet:   { label: 'Bracelet',         ico: '⭕' },
  gants:      { label: 'Gants',            ico: '🧤' },
  casque:     { label: 'Casque',           ico: '🧢' },
  plastron:   { label: 'Plastron',         ico: '👔' },
  'jambières':{ label: 'Jambières',        ico: '👖' },
  bottes:     { label: 'Bottes',           ico: '👢' },
  arme_p:     { label: 'Arme Principale',  ico: '⚔️' },
  arme_s:     { label: 'Arme Secondaire',  ico: '🛡️' },
  artefact:   { label: 'Artefact',         ico: '🔮' },
};

async function _ensureSlotTag(channelId, category, twoHanded) {
  if (twoHanded) return _ensureTag(channelId, 'Deux mains', '⚔️', 'slot');
  const info = SLOT_TAG_INFO[category];
  if (!info) return null;
  return _ensureTag(channelId, info.label, info.ico.replace(/️/g, ''), 'slot');
}

async function _deleteExistingDiscordPost(docId) {
  try {
    const snap = await getDoc(doc(db, 'discord_posts', docId));
    if (!snap.exists()) return;
    const { threadId } = snap.data();
    if (threadId) await _workerCall('delete_thread', { threadId });
    await deleteDoc(doc(db, 'discord_posts', docId));
  } catch(e) { console.warn('[deletePost]', e); }
}

async function _sendSingleItemDiscord(item) {
  item = await _maskSecret(item);
  const cat    = item.category;
  const palier = item.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = `${cat}_${palier}`;
  const channelId0 = await _channelOfItem(item);
  if (!channelId0) throw new Error(`Aucun channel configuré pour ${key}`);

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const cardBlob  = await generateCardBlob(item, maps, 3);
  const cardFname = `${item.id || item._id || 'item'}_card.png`;

  const itemId   = item._id || item.id;
  const wikiUrl  = itemId ? `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${itemId}` : null;
  const content  = wikiUrl ? `↗ [Lien vers le Wiki](<${wikiUrl}>)` : '';

  const channelId = channelId0;
  const postDocId = itemId ? `${key}_item_${itemId}` : null;

  // Supprimer le post existant avant de recréer
  if (postDocId) await _deleteExistingDiscordPost(postDocId);

  const tags = [];
  if (item.rarity) {
    const rarLabel = window.VCL.RARITIES?.[item.rarity]?.label || item.rarity;
    const rarEmoji = RARITY_EMOJI[item.rarity] || null;
    const tagId = await _ensureTag(channelId, rarLabel, rarEmoji, 'rarity');
    if (tagId) tags.push(tagId);
  }
  const slotTagId = await _ensureSlotTag(channelId, item.cat, item.twoHanded);
  if (slotTagId && !tags.includes(slotTagId)) tags.push(slotTagId);
  if (item.set) {
    const setLabel = panList.find(p => (p._id || p.id) === item.set)?.label || item.set.replace(/_/g, ' ');
    const tagId = await _ensureTag(channelId, setLabel, '✨', 'set');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const sortedClasses = [...(item.classes || [])].sort((a, b) => {
    const ai = CLASSES.findIndex(c => c.id === a);
    const bi = CLASSES.findIndex(c => c.id === b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  for (const cls of sortedClasses) {
    const clsData = CLASSES.find(c => c.id === cls);
    const label = clsData?.label || cls;
    const emoji = clsData?.ico?.replace(/️/g, '') || null;
    const tagId = await _ensureTag(channelId, label, emoji, 'class');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  await _reorderChannelTags(channelId);

  console.log('[send] applied_tags order:', tags);
  const res = await _postBotForumThread(channelId, item.name || 'Item', content, cardBlob, cardFname, tags);
  if (!res) throw new Error('Échec de l\'envoi bot Discord');

  if (postDocId) {
    try {
      await setDoc(doc(db, 'discord_posts', postDocId), {
        itemId: String(itemId), itemName: item.name || '', webhookKey: key, channelId,
        messageId: res.messageId, threadId: res.threadId,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

window.testNewSubmissionWebhook = async function() {
  const url = document.getElementById('dw-new-submission')?.value?.trim();
  if (!url) { toast('⚠️ Aucun webhook configuré.', 'warning'); return; }
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: '🧪 **Test webhook** · Nouvelles soumissions · VCL Wiki Modération' })
    });
    if (resp.ok || resp.status === 204) toast('✓ Message de test envoyé !', 'success');
    else { const t = await resp.text().catch(() => String(resp.status)); toast(`⛔ Erreur Discord ${resp.status} : ${t.slice(0,200)}`, 'error'); }
  } catch(e) { toast(`⛔ Erreur réseau : ${e.message}`, 'error'); }
};

window.testDiscordWebhook = async function testDiscordWebhook(key) {
  const url = document.getElementById(`dw-${key}`)?.value?.trim();
  if (!url) { toast('⚠️ Aucun webhook configuré pour cette combinaison.', 'warning'); return; }
  const parts = key.split('_');
  const catId = parts.slice(0, -1).join('_');
  const palier = parts[parts.length - 1];
  const catLabel = DW_CATEGORIES.find(c => c.id === catId)?.label || catId;
  const palierLabel = palier === 'event' ? 'Event' : `Palier ${palier}`;
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_name: `🧪 Test · ${catLabel} · ${palierLabel}`, content: `🧪 **Test webhook** · ${catLabel} · ${palierLabel} · VCL Wiki Modération` })
    });
    if (resp.ok || resp.status === 204) {
      toast('✓ Message de test envoyé !', 'success');
    } else {
      const text = await resp.text().catch(() => String(resp.status));
      toast(`⛔ Erreur Discord ${resp.status} :\n${text.slice(0, 300)}`, "error");
    }
  } catch(e) {
    toast(`⛔ Erreur réseau : ${e.message}`, "error");
  }
};


async function _extractSubBlob(sub) {
  if (sub.forum_image) {
    try {
      const dataUrl = sub.forum_image;
      const mime    = dataUrl.match(/^data:([^;]+);/)?.[1] || 'image/png';
      const extMap  = { 'image/png':'png','image/jpeg':'jpg','image/gif':'gif','image/webp':'webp' };
      const fname   = `image.${extMap[mime] || 'png'}`;
      const b64  = dataUrl.split(',')[1];
      const bin  = atob(b64);
      const arr  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return { blob: new Blob([arr], { type: mime }), fname };
    } catch {}
  }
  return _fetchItemImgBlob(sub.data);
}

async function sendApprovalWebhook(sub) {
  console.log('[saw] called, type:', sub.type, 'cat:', sub.data?.category, 'palier:', sub.data?.palier);
  if (sub.type !== 'item') return;
  const cat = sub.data?.category;
  if (!['arme', 'armure', 'accessoire'].includes(cat)) return;
  const palier = sub.data?.palier;
  if (!palier) return;
  const key = `${cat}_${palier}`;

  if (!_dwConfig) {
    try {
      const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
      _dwConfig = snap.exists() ? snap.data() : {};
    } catch { return; }
  }

  const channelId = await _getChannelId(key);
  if (!channelId) return;

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const cardBlob  = await generateCardBlob(sub.data, maps, 3);
  const cardFname = `${sub.data.id || sub.data._id || 'item'}_card.png`;

  const subItemId = sub.data.id || sub.data._id;
  const wikiUrl   = subItemId ? `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${subItemId}` : null;
  const content   = wikiUrl ? `↗ [Lien vers le Wiki](<${wikiUrl}>)` : '';

  const postDocId = `${key}_${sub._id}`;
  await _deleteExistingDiscordPost(postDocId);

  const tags = [];
  if (sub.data.rarity) {
    const rarLabel = window.VCL.RARITIES?.[sub.data.rarity]?.label || sub.data.rarity;
    const rarEmoji = RARITY_EMOJI[sub.data.rarity] || null;
    const tagId = await _ensureTag(channelId, rarLabel, rarEmoji, 'rarity');
    if (tagId) tags.push(tagId);
  }
  const slotTagId = await _ensureSlotTag(channelId, sub.data.cat, sub.data.twoHanded);
  if (slotTagId && !tags.includes(slotTagId)) tags.push(slotTagId);
  if (sub.data.set) {
    const setLabel = panList.find(p => (p._id || p.id) === sub.data.set)?.label || sub.data.set.replace(/_/g, ' ');
    const tagId = await _ensureTag(channelId, setLabel, '✨', 'set');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  const CLASSES = window._VCL_DATA?.CLASSES || [];
  const sortedClasses = [...(sub.data.classes || [])].sort((a, b) => {
    const ai = CLASSES.findIndex(c => c.id === a);
    const bi = CLASSES.findIndex(c => c.id === b);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
  for (const cls of sortedClasses) {
    const clsData = CLASSES.find(c => c.id === cls);
    const label = clsData?.label || cls;
    const emoji = clsData?.ico?.replace(/️/g, '') || null;
    const tagId = await _ensureTag(channelId, label, emoji, 'class');
    if (tagId && !tags.includes(tagId)) tags.push(tagId);
  }
  await _reorderChannelTags(channelId);

  const res = await _postBotForumThread(channelId, sub.data.name || 'Item', content, cardBlob, cardFname, tags);
  if (!res) { console.error('[saw] bot post failed'); return; }

  try {
    await setDoc(doc(db, 'discord_posts', postDocId), {
      subId: sub._id, subName: sub.data.name || '', webhookKey: key, channelId,
      messageId: res.messageId, threadId: res.threadId,
      sentAt: new Date().toISOString(),
    });
  } catch(e) { console.warn('[saw] discord_posts save failed:', e); }
}

// ── Envoi groupé d'un set (plusieurs embeds dans un seul post) ──
async function _sendSetGroupDiscord(subs) {
  console.log('[sgd] called, subs:', subs.length);
  if (!subs.length) return;
  if (!_dwConfig) {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};
  }

  // Webhook du premier item du set
  const first  = subs[0];
  const cat    = first.data?.category;
  const palier = first.data?.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = first.data.rarity === 'event' ? `${cat}_event` : `${cat}_${palier}`;
  const url = _dwConfig[key];
  if (!url) throw new Error(`Aucun webhook configuré pour ${key}`);

  // Nom du thread = label du set
  const setId = first.data.set;
  let threadName = setId;
  if (_dwConfig._setCache?.[setId]) {
    threadName = _dwConfig._setCache[setId];
  } else {
    try {
      const snap = await getDoc(doc(db, 'panoplies', setId));
      if (snap.exists()) {
        threadName = snap.data().label || setId;
        if (!_dwConfig._setCache) _dwConfig._setCache = {};
        _dwConfig._setCache[setId] = threadName;
      }
    } catch {}
  }

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const files = []; // { blob, fname }

  for (let i = 0; i < subs.length; i++) {
    const sub = subs[i];
    const cardBlob  = await generateCardBlob(sub.data, maps, 3);
    const cardFname = `${sub.data.id || sub.data._id || `item_${i}`}_card.png`;
    files.push({ blob: cardBlob, fname: cardFname });
  }

  // Embed minimal : liens wiki pour chaque item du set
  const wikiLinks = subs.map(sub => {
    const id = sub.data.id || sub.data._id;
    return id ? `[🌐 ${sub.data.name || id}](<https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${id}>)` : null;
  }).filter(Boolean).join('\n');
  const setEmbed = wikiLinks ? { description: wikiLinks } : null;

  // Vérifier si un thread Discord existe déjà pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  // Discord : max 10 fichiers par message
  let fetchUrl, payload;
  if (existingThreadId) {
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = {};
  } else {
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first.data, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }
  if (setEmbed) payload.embeds = [setEmbed];

  let discordRes = null;
  if (files.length) {
    const filesSlice = files.slice(0, 10);
    const p  = { ...payload, attachments: filesSlice.map((f, i) => ({ id: i, filename: f.fname })) };
    const fd = new FormData();
    fd.append('payload_json', JSON.stringify(p));
    filesSlice.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
    const r = await fetch(fetchUrl, { method: 'POST', body: fd });
    if (r.ok) discordRes = await r.json();
  } else {
    const r = await fetch(fetchUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (r.ok) discordRes = await r.json();
  }

  // Sauvegarder dans discord_posts seulement si nouveau thread créé
  if (!existingThreadId && discordRes?.id) {
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_${setId}`), {
        setId, setName: threadName, webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

// Variante de _sendSetGroupDiscord pour items déjà publiés (pas des submissions)
async function _sendSetGroupItemsDiscord(items) {
  if (!items.length) return;
  if (!_dwConfig) {
    const snap = await getDoc(doc(db, 'config', 'discord_webhooks'));
    _dwConfig = snap.exists() ? snap.data() : {};
  }

  const first  = items[0];
  const cat    = first.category;
  const palier = first.palier;
  if (!cat || !palier) throw new Error('Catégorie ou palier manquant');
  const key = first.rarity === 'event' ? `${cat}_event` : `${cat}_${palier}`;
  const url = _dwConfig[key];
  if (!url) throw new Error(`Aucun webhook configuré pour ${key}`);

  const setId = first.set;
  let threadName = setId;
  if (_dwConfig._setCache?.[setId]) {
    threadName = _dwConfig._setCache[setId];
  } else {
    try {
      const snap = await getDoc(doc(db, 'panoplies', setId));
      if (snap.exists()) {
        threadName = snap.data().label || setId;
        if (!_dwConfig._setCache) _dwConfig._setCache = {};
        _dwConfig._setCache[setId] = threadName;
      }
    } catch {}
  }

  const [panList, pnjList] = await Promise.all([
    cachedDocs(COL.panoplies).catch(() => []),
    cachedDocs(COL.pnj).catch(() => []),
  ]);
  const allItemsList = await cachedDocs(COL.items).catch(() => []);
  const maps = { ..._buildCardMaps(panList, pnjList), allItems: allItemsList };

  const files = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const cardBlob  = await generateCardBlob(item, maps, 3);
    const cardFname = `${item.id || item._id || `item_${i}`}_card.png`;
    files.push({ blob: cardBlob, fname: cardFname });
  }

  // Embed minimal : liens wiki pour chaque item du set
  const wikiLinks = items.map(item => {
    const id = item.id || item._id;
    return id ? `[🌐 ${item.name || id}](<https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${id}>)` : null;
  }).filter(Boolean).join('\n');
  const setEmbed = wikiLinks ? { description: wikiLinks } : null;

  // Vérifier si thread existant pour ce set
  let existingThreadId = null;
  try {
    const existingSnap = await getDoc(doc(db, 'discord_posts', `${key}_${setId}`));
    if (existingSnap.exists()) existingThreadId = existingSnap.data().threadId || null;
  } catch {}

  let fetchUrl, payload;
  if (existingThreadId) {
    fetchUrl = `${url}?thread_id=${existingThreadId}&wait=true`;
    payload  = {};
  } else {
    fetchUrl = `${url}?wait=true`;
    payload  = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) payload.applied_tags = appliedTags;
  }
  if (setEmbed) payload.embeds = [setEmbed];

  const _doFetch = async (fUrl, fPayload) => {
    if (files.length) {
      const filesSlice = files.slice(0, 10);
      const p  = { ...fPayload, attachments: filesSlice.map((f, i) => ({ id: i, filename: f.fname })) };
      const fd = new FormData();
      fd.append('payload_json', JSON.stringify(p));
      filesSlice.forEach((f, i) => fd.append(`files[${i}]`, f.blob, f.fname));
      return fetch(fUrl, { method: 'POST', body: fd });
    }
    return fetch(fUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fPayload) });
  };

  let discordRes = null;
  let usedExistingThread = !!existingThreadId;
  let r = await _doFetch(fetchUrl, payload);

  if (!r.ok && existingThreadId) {
    // Thread probablement archivé — recréer un nouveau thread
    console.warn(`[dwPublish] thread ${existingThreadId} inaccessible (${r.status}), tentative de recréation…`);
    const fallbackUrl     = `${url}?wait=true`;
    const fallbackPayload = { thread_name: threadName };
    const appliedTags = _resolveTagRules(first, (_dwConfig.tagRules || {})[key] || []);
    if (appliedTags.length) fallbackPayload.applied_tags = appliedTags;
    if (setEmbed) fallbackPayload.embeds = [setEmbed];
    r = await _doFetch(fallbackUrl, fallbackPayload);
    usedExistingThread = false;
  }

  if (r.ok) {
    discordRes = await r.json();
  } else {
    const body = await r.text().catch(() => '');
    throw new Error(`Discord ${r.status} : ${body.slice(0, 200)}`);
  }

  if (!usedExistingThread && discordRes?.id) {
    try {
      await setDoc(doc(db, 'discord_posts', `${key}_${setId}`), {
        setId, setName: threadName, webhookKey: key, webhookUrl: url,
        messageId: discordRes.id,
        threadId: discordRes.channel_id || null,
        sentAt: new Date().toISOString(),
      });
    } catch(e) { console.warn('discord_posts save failed:', e); }
  }
}

// ── Item names cache (for craft display) ──────────────
let _itemNamesCache = null;
async function _getItemNamesCache() {
  if (_itemNamesCache) return _itemNamesCache;
  try {
    const [items, hidden] = await Promise.all([
      cachedDocs('items'),
      cachedDocs('items_hidden').catch(() => []),
    ]);
    _itemNamesCache = new Map();
    for (const it of [...items, ...hidden]) {
      const id = it._id || it.id;
      if (id && it.name) _itemNamesCache.set(id, it.name);
    }
  } catch { _itemNamesCache = new Map(); }
  return _itemNamesCache;
}

function _resolveTagRules(item, rules = []) {
  const tags = [];
  for (const r of rules) {
    if (!r.tagId) continue;
    const val = item[r.field];
    let match = false;
    if (r.op === 'eq')          match = String(val) == String(r.value) || val == r.value;
    if (r.op === 'contains')    match = Array.isArray(val) && val.includes(r.value);
    if (r.op === 'not_contains')match = Array.isArray(val) && !val.includes(r.value);
    if (r.op === 'gte')         match = Number(val) >= Number(r.value);
    if (r.op === 'lte')         match = Number(val) <= Number(r.value);
    if (match) tags.push(r.tagId);
  }
  return tags;
}

// ── Item image fetch (attach as file, not URL reference) ─
function _itemImgSrc(obj) {
  const base = new URL('.', window.location.href).href;
  const imgVal = (Array.isArray(obj.images) && obj.images[0]) || obj.img;
  if (imgVal) {
    const rel = imgVal.replace(/^(\.\.\/)+/, '');
    return base + rel;
  }
  if (!obj.id) return null;
  const { id, category, palier, event: isEvent } = obj;
  const tier = (isEvent || (palier === 0 || palier === 'event')) ? 'events' : (palier ? 'P' + palier : '');
  const tp   = tier ? tier + '/' : '';
  switch (category) {
    case 'arme':        return `${base}img/compendium/textures/weapons/${tp}${id}.png`;
    case 'armure':      return `${base}img/compendium/textures/armors/${tp}${id}.png`;
    case 'accessoire':  return `${base}img/compendium/textures/trinkets/${tp}${id}.png`;
    case 'outils':      return `${base}img/compendium/textures/gears/${tp}${id}.png`;
    case 'materiaux':   return `${base}img/compendium/textures/items/Material/${tp}${id}.png`;
    case 'ressources':  return `${base}img/compendium/textures/items/Ressources/${tp}${id}.png`;
    case 'consommable': return `${base}img/compendium/textures/items/Consommable/${tp}${id}.png`;
    case 'nourriture':  return `${base}img/compendium/textures/items/Nourriture/${tp}${id}.png`;
    case 'rune':        return `${base}img/compendium/textures/items/Runes/${tp}${id}.png`;
    case 'parchemin':   return `${base}img/compendium/textures/items/Parchemins/${tp}${id}.png`;
    case 'quete':       return `${base}img/compendium/textures/items/Quest/${tp}${id}.png`;
    case 'donjon':      return `${base}img/compendium/textures/items/Donjon/${tp}${id}.png`;
    case 'monnaie':     return `${base}img/compendium/textures/items/Monnaie/${tp}${id}.png`;
    default:            return null;
  }
}

async function _fetchItemImgBlob(obj) {
  const src = _itemImgSrc(obj);
  if (!src) return { blob: null, fname: null };
  try {
    const resp = await fetch(src);
    if (!resp.ok) return { blob: null, fname: null };
    const blob = await resp.blob();
    const ext  = src.split('.').pop().split('?')[0].toLowerCase() || 'png';
    return { blob, fname: `item.${ext}` };
  } catch {
    return { blob: null, fname: null };
  }
}

// ── Stat helpers ──────────────────────────────────────
const DW_STAT_LABELS = {
  // Offensif
  degats:              '🗡️ Dégâts',
  degats_physique:     '💥 Dég. Physique',
  degats_arme:         '⚔️ Dég. d\'Arme',
  degats_magique:      '📖 Dég. Magiques',
  degats_competence:   '✨ Dég. Compétence',
  degats_projectile:   '🏹 Dég. Projectile',
  vitesse_attaque:     '💨 Vitesse Attaque',
  crit_chance:         '🎯 Chance Critique',
  crit_degats:         '💢 Dégâts Critique',
  crit_comp_chance:    '🎯 Crit. Compétence',
  crit_comp_degats:    '💢 Crit Dégâts Compétence',
  // Défensif
  defense:             '🛡️ Défense',
  durabilite_garde:    '🛡️ Durabilité de la Garde',
  blocage:             '🧱 Blocage',
  puissance_bloc:      '💪 Puis. de Blocage',
  sante:               '❤️ Santé',
  esquive:             '💨 Esquive',
  reduction_degats:    '🔰 Réd. de Dégâts',
  reduction_chutes:    '🦘 Réd. de Chutes',
  tenacite:            '🏋️ Ténacité',
  res_recul:           '🔒 Rés. au Recul',
  // Mobilité & Ressources
  hate:                '🌀 Hâte',
  vitesse_deplacement: '💨 Vit. Déplacement',
  mana:                '💧 Mana',
  stamina:             '👟 Stamina',
  // Soutien
  vol_vie:             '🩸 Vol de Vie',
  omnivamp:            '👄 Vampirisme de sort',
  soin_bonus:          '✳️ Soin Bonus',
  regen_sante:         '💓 Rég. Santé',
  regen_mana:          '💦 Rég. Mana',
  regen_stamina:       '👟 Rég. Stamina',
};

function _fmtStatVal(v) {
  if (v === null || v === undefined) return '—';
  if (Array.isArray(v)) return v[0] === v[1] ? String(v[0]) : `${v[0]}–${v[1]}`;
  if (typeof v === 'object') {
    const { min, max } = v;
    if (min !== undefined && max !== undefined) return min === max ? String(min) : `${min}–${max}`;
    return JSON.stringify(v);
  }
  return String(v);
}

const _SP = '\u200B'; // Discord spacer

function _enrichObtainWithPnjCoords(obtain, pnjs) {
  if (!obtain || !pnjs?.length) return obtain;
  const pnjById   = new Map();
  const pnjByName = new Map();
  for (const pnj of pnjs) {
    if (!pnj.coords || pnj.coords.x == null) continue;
    if (pnj.id) pnjById.set(pnj.id, pnj.coords);
    const n = (pnj.name || pnj.nom || '').trim().toLowerCase();
    if (n) pnjByName.set(n, pnj.coords);
  }
  const fmtCoords = c => `\n\`x:${c.x}\` \`y:${c.y}\` \`z:${c.z}\``;
  // New bracket format: [npc:id|Name]
  let result = obtain.replace(/\[npc:([^\]|]+)\|([^\]]+)\]/g, (match, pnjId, name) => {
    const c = pnjById.get(pnjId) || pnjByName.get(name.trim().toLowerCase());
    return c ? `[npc:${pnjId}|${name} ${fmtCoords(c)}]` : match;
  });
  // Old format: npc:text (no bracket, no ID) — negative lookbehind avoids re-matching inside [npc:...|...]
  const namesSorted = [...pnjByName.keys()].sort((a, b) => b.length - a.length);
  result = result.replace(/(?<!\[)npc:([^\n\[]+)/g, (match, text) => {
    const textLow = text.trim().toLowerCase();
    const found   = namesSorted.find(n => textLow.includes(n));
    if (!found) return match;
    const c = pnjByName.get(found);
    return `npc:${text.trim()} ${fmtCoords(c)}`;
  });
  return result;
}

function _enrichObtainWithMobChances(obtain, itemId, mobs) {
  if (!obtain || !itemId || !mobs?.length) return obtain;
  const chanceMap = new Map();
  for (const mob of mobs) {
    const loot = (mob.loot || []).find(l => l.id === itemId);
    if (loot) {
      const c = loot.chance === '?' ? '?' : parseFloat(loot.chance);
      if (c === '?' || !isNaN(c)) chanceMap.set(mob.id, c);
    }
  }
  return obtain.replace(/\[([^\]|:]+)\|([^\]]+)\](\[\?\]|(?!\[))/g, (match, mobId, name) => {
    const chance = chanceMap.get(mobId);
    return chance != null ? `[${mobId}|${name}][${chance}]` : match;
  });
}

function _buildApprovalEmbed(obj, imageFilename, activeFields = null, itemNames = null, contributorName = null) {
  const RARITY_LABEL  = { commun:'Commun', rare:'Rare', epique:'Épique', legendaire:'Légendaire', mythique:'Mythique', godlike:'Godlike', event:'Évènement' };
  const RARITY_ICON   = { commun:'🟢', rare:'🔵', epique:'🟣', legendaire:'🟡', mythique:'🌸', godlike:'🔴', event:'⚪' };
  const RARITY_COLORS = { commun:0x59d059, rare:0x2a5fa8, epique:0x6a3daa, legendaire:0xd7af5f, mythique:0xf5b5e4, godlike:0xa83020, event:0xdedede };
  const CAT_LABEL     = { arme:'⚔️ Arme', armure:'🛡️ Armure', accessoire:'💍 Accessoire' };
  const CLS_LABEL     = { guerrier:'⚔️ Guerrier', assassin:'🗡️ Assassin', archer:'🏹 Archer', mage:'📖 Mage', shaman:'🌿 Shaman' };

  const active = activeFields ?? EMBED_FIELDS.map(f => f.id);
  const has    = id => active.includes(id);

  const rarIcon  = RARITY_ICON[obj.rarity]  || '▪️';
  const rarLabel = RARITY_LABEL[obj.rarity] || obj.rarity || '—';
  const catLabel = CAT_LABEL[obj.category]  || obj.category || '—';
  const color    = RARITY_COLORS[obj.rarity] || 0x7a7a90;

  // ── Description ──────────────────────────────────────
  const descParts = [];

  if (has('identity')) {
    descParts.push([
      `${rarIcon} **${rarLabel}**`,
      catLabel,
      obj.palier    ? `Palier ${obj.palier}` : null,
      obj.lvl       ? `Niveau : ${obj.lvl}`  : null,
      obj.twoHanded ? '🤲 Deux mains'         : null,
      obj.sensible  ? '🤫 Sensible'           : null,
    ].filter(Boolean).join('\n'));
  }

  if (has('classes') && obj.classes?.length) {
    descParts.push(obj.classes.map(c => CLS_LABEL[c] || c).join('  ·  '));
  }

  if (has('lore') && obj.lore) {
    descParts.push(`\n> *${obj.lore.slice(0, 300)}*`);
  }

  // ── Fields ───────────────────────────────────────────
  const embedFields = [];
  const mainParts = [];

  if (has('stats')) {
    const statEntries = obj.stats ? Object.entries(obj.stats) : [];
    if (statEntries.length || obj.rune_slots) {
      const lines = statEntries.map(([k, v]) => `${DW_STAT_LABELS[k] || k}  \`${_fmtStatVal(v)}\``);
      if (obj.rune_slots) lines.push(`🔮 Empl. Runes  \`${obj.rune_slots}\``);
      mainParts.push('📊 **Stats**\n' + lines.join('\n'));
    }
  }

  if (has('obtain')) {
    const raw   = resolveObtain(obj.obtain || '');
    const clean = raw
      .replace(/\[npc:[^\]|]+\|([^\]]+)\]/g, (_, content) => {
        const [namePart, coordsPart] = content.split('\n');
        const name   = namePart.trim();
        const coords = coordsPart?.trim() || '';
        return coords ? `**${name}**\n${coords}` : `**${name}**`;
      })
      .replace(/\[[^\]|:]+\|([^\]]+)\]/g, (_, name) => `**${name.split('\n')[0].trim()}**`)
      .replace(/\[(\d+(?:[.,]\d+)?)\]/g, ' [$1%]')
      .replace(/\[\?\]/g, ' [?%]')
      .replace(/\bnpc:/g, '')
      || '—';
    mainParts.push('📍 **Obtention**\n' + clean);
  }

  if (has('craft') && obj.craft?.length) {
    const lines = obj.craft.map(c => {
      const name = itemNames?.get(c.id) || c.name || c.id.replace(/_/g, ' ');
      return `\`${c.qty}×\`  **${name}**`;
    });
    mainParts.push('🔨 **Craft**\n' + lines.join('\n'));
  }

  if (mainParts.length) {
    embedFields.push({ name: _SP, value: mainParts.join('\n\n').slice(0, 1024), inline: false });
  }

  if (has('effects') && obj.effects?.length) {
    const lines = obj.effects.map(e => `▸ ${e.label || e.id || JSON.stringify(e)}`);
    embedFields.push({ name: '✨ Effets spéciaux', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  if (has('bonuses') && obj.bonuses?.length) {
    const lines = obj.bonuses.map(b => {
      const thresh = b.count ? `**(×${b.count})** ` : '';
      return `${thresh}${b.bonus || b.label || JSON.stringify(b)}`;
    });
    embedFields.push({ name: '🔗 Bonus de panoplie', value: lines.join('\n').slice(0, 1024), inline: false });
  }

  // ── Lien wiki ────────────────────────────────────────
  const itemId = obj.id || obj._id || obj._docId;
  if (itemId) {
    const wikiUrl = `https://drabiot.github.io/Veilleurs/Compendium/compendium.html#${itemId}`;
    embedFields.push({ name: _SP, value: `[🌐 Voir la fiche sur le wiki](${wikiUrl})`, inline: false });
  }

  // ── Embed object ─────────────────────────────────────
  const footerText = contributorName
    ? `🌙 Veilleurs au Clair de Lune — ${contributorName}`
    : '🌙 Veilleurs au Clair de Lune';
  const embed = {
    title:       obj.name,
    description: descParts.join('\n').slice(0, 4096) || undefined,
    color,
    fields:      embedFields,
    footer:      { text: footerText },
  };

  if (imageFilename) embed.thumbnail = { url: `attachment://${imageFilename}` };

  return embed;
}

// ── Embed Preview ─────────────────────────────────────
const _PREVIEW_ITEM = {
  name: 'Épée de Cristal',
  id:   'epee_cristal',
  rarity: 'legendaire',
  category: 'arme',
  palier: 2,
  lvl: 35,
  twoHanded: true,
  classes: ['guerrier', 'assassin'],
  lore: "Forgée dans les profondeurs des mines de Cristalith, cette lame légendaire vibre d'une énergie ancienne.",
  stats: {
    degats:      { min: 280, max: 350 },
    crit_chance: { min: 15, max: 15  },
    defense:     { min: 40,  max: 60  },
    sante:       { min: 800, max: 800 },
  },
  obtain: 'Obtenu en battant le [boss:gardien|Gardien de Cristal] dans le [region:mines|Donjon des Mines].',
  craft: [
    { qty: 3, id: 'cristal_pur' },
    { qty: 1, id: 'fil_argent'  },
  ],
  rune_slots: 2,
  effects: [{ label: 'Chaque coup critique inflige +20% de dégâts bonus pendant 3s.' }],
};

function _renderEmbedPreview() {
  const el = document.getElementById('dw-embed-preview');
  if (!el) return;

  const embed = _buildApprovalEmbed(_PREVIEW_ITEM, null, _dwConfig?.embedFields || null);

  const RARITY_COLORS_CSS = {
    legendaire: '#d7af5f', commun: '#59d059', rare: '#2a5fa8',
    epique: '#6a3daa', mythique: '#f5b5e4', godlike: '#a83020', event: '#dedede',
  };
  const accentColor = RARITY_COLORS_CSS[_PREVIEW_ITEM.rarity] || '#7a7a90';

  const escP = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  // Minimal markdown → HTML (bold, italic, code, blockquote)
  function mdToHtml(text) {
    if (!text) return '';
    return escP(text)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code style="background:rgba(255,255,255,.1);border-radius:3px;padding:1px 5px;font-family:monospace;font-size:11px;">$1</code>')
      .replace(/^&gt;\s?(.+)$/gm, '<span style="border-left:3px solid rgba(255,255,255,.2);padding-left:8px;display:block;color:rgba(255,255,255,.7);font-style:italic;">$1</span>')
      .replace(/\n/g, '<br>');
  }

  let fieldsHtml = '';
  for (const f of (embed.fields || [])) {
    if (f.name === _SP || f.value === _SP) {
      fieldsHtml += '<div style="height:6px;"></div>';
      continue;
    }
    fieldsHtml += `
      <div style="margin-bottom:2px;">
        <div style="font-size:11px;font-weight:700;color:#fff;margin-bottom:3px;">${escP(f.name)}</div>
        <div style="font-size:12px;color:rgba(255,255,255,.85);line-height:1.5;">${mdToHtml(f.value)}</div>
      </div>`;
  }

  // Preview uses the real URL (not attachment://) for display
  const thumbUrl = _itemImgSrc(_PREVIEW_ITEM) || '';

  el.innerHTML = `
    <div style="display:inline-flex;max-width:520px;width:100%;border-radius:8px;overflow:hidden;background:#2b2d31;font-family:sans-serif;">
      <div style="width:4px;flex-shrink:0;background:${accentColor};"></div>
      <div style="flex:1;padding:14px 16px;min-width:0;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <div style="flex:1;min-width:0;">
            <div style="font-size:15px;font-weight:700;color:${accentColor};margin-bottom:6px;">${escP(embed.title || '')}</div>
            ${embed.description ? `<div style="font-size:13px;color:rgba(255,255,255,.85);margin-bottom:10px;line-height:1.5;">${mdToHtml(embed.description)}</div>` : ''}
          </div>
          ${thumbUrl ? `<img src="${escP(thumbUrl)}" style="width:60px;height:60px;object-fit:contain;border-radius:6px;flex-shrink:0;background:rgba(0,0,0,.3);" onerror="this.style.display='none'">` : ''}
        </div>
        ${fieldsHtml ? `<div style="display:flex;flex-direction:column;gap:4px;">${fieldsHtml}</div>` : ''}
        <div style="margin-top:12px;padding-top:8px;border-top:1px solid rgba(255,255,255,.07);display:flex;justify-content:space-between;align-items:center;">
          <span style="font-size:10px;color:rgba(255,255,255,.35);">VCL Wiki</span>
          <span style="font-size:10px;color:rgba(255,255,255,.35);">${new Date().toLocaleDateString('fr-FR')}</span>
        </div>
      </div>
    </div>
    <p style="font-size:11px;color:var(--muted);margin-top:8px;font-style:italic;">Aperçu avec un item fictif — image non chargée en local, visible en production.</p>
  `;
}
const { normalize } = window.VCL;

// ══════════════════════════════════════════════════════
// SYNCHRO DISCORD — envoi / mise à jour / suppression des posts d'items (salons : config/discord_routes ; suivi : discord_posts)
// Automatique : un item approuvé en soumission est (re)posté dans son salon, l'ancienne version est supprimée.
// Manuel : onglet « 📣 Discord » (supprimer un post / tous / ceux d'un salon, renvoyer un item / tous / ceux d'un salon, créer un salon).
// ══════════════════════════════════════════════════════
let _drCfg = null;
async function _routes(force) {
  if (!_drCfg || force) { const s = await getDoc(doc(db, 'config', 'discord_routes')); _drCfg = s.exists() ? s.data() : {}; }
  return _drCfg;
}
const _itemKey = it => `${it.category}_${it.palier}`;
async function _channelOfItem(it, { auto = false } = {}) {
  const r = await _routes();
  const fits = (c, k, v) => !(c[k] || []).length || c[k].map(String).includes(String(v));
  const spec = c => ((c.itemCats || []).length > 0) + ((c.paliers || []).length > 0);
  const c = (r.channels || []).filter(c => c.id && fits(c, 'itemCats', it.category) && fits(c, 'paliers', it.palier)).sort((x, y) => spec(y) - spec(x))[0];
  if (!c) return null;
  if (auto && c.subscribed) return null; // salon inscrit : c'est le bot (GitHub Actions) qui envoie, sinon doublon
  if (auto && Number(it.palier) === -1 && !(c.paliers || []).map(String).includes('-1')) return null; // l'archive n'est pas postée sans salon dédié
  return c.id;
}

// Forgerons / items secrets : la carte ne montre ni leur nom ni leur lieu (outil « Forgerons secrets »)
async function _maskSecret(item) {
  const SECRET = "Forgeron d'items secret - Position cachée pour l'instant";
  let sf = {};
  try { const s = await getDoc(doc(db, 'config', 'secret_forgerons')); sf = s.exists() ? s.data() : {}; } catch {}
  if (sf.hidden === false) return item;
  const id = item.id ?? item._id;
  if ((sf.items || []).includes(id) && !(sf.revealedItems || []).includes(id)) return { ...item, obtain: SECRET };
  if (typeof item.obtain !== 'string') return item;
  const pnj = await cachedDocs(COL.pnj).catch(() => []);
  const secretIds = pnj.filter(p => !(sf.revealedPnj || []).includes(p.id ?? p._id) && (
    ['fabricant_secrets', 'fabricant_secret', 'forgeron_items_secrets'].includes(p.tag)
    || ["forgeron d'items secrets", 'fabricant secret'].includes(String(p.type || '').toLowerCase())
    || (sf.pnj || []).includes(p.id ?? p._id))).map(p => p.id ?? p._id);
  const obtain = item.obtain.split('\n').map(l => secretIds.some(s => l.includes(`[npc:${s}|`) || l.includes(`[npc:${s}]`)) ? SECRET : l).join('\n');
  return { ...item, obtain };
}

let _postsCache = null;
async function _allPosts(force) {
  if (_postsCache && !force) return _postsCache; // gardé le temps d'un lot (réinitialisé au début et à la fin)
  const snap = await getDocs(collection(db, 'discord_posts'));
  const list = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
  if (_drBusy) _postsCache = list;
  return list;
}
// Salons du serveur sélectionné (config/discord_routes.guildId) : les actions de masse ne touchent que les posts de ce serveur
let _gset = null;
async function _guildSet(force) {
  const r = await _routes();
  if (!r.guildId) return null;
  if (!force && _gset && _gset.g === r.guildId && Date.now() - _gset.at < 60000) return _gset.ids;
  try {
    const chans = await _workerCall('get_guild_channels', { guildId: r.guildId });
    if (Array.isArray(chans)) { _gset = { g: r.guildId, at: Date.now(), ids: new Set(chans.map(c => c.id)) }; return _gset.ids; }
  } catch {}
  return null;
}
/** Posts suivis dans les salons du serveur sélectionné ; null si aucun serveur n'est choisi ou lisible (on ne supprime alors rien en masse). */
async function _scopedPosts(force) {
  const [posts, set] = await Promise.all([_allPosts(force), _guildSet(force)]);
  return set ? posts.filter(p => set.has(p.channelId)) : null;
}
async function _deletePost(post) {
  if (post.threadId) {
    const r = await _workerCall('delete_thread', { threadId: post.threadId });
    // 404 / 403 : le fil n'existe plus (ou vit sur un serveur / salon que le bot ne voit plus) : on oublie simplement le suivi
    if (!r || (r.status && ![200, 204, 403, 404].includes(r.status))) throw new Error('suppression Discord refusée (' + (r?.status ?? '?') + ')');
  }
  await deleteDoc(doc(db, 'discord_posts', post._id));
  if (_postsCache) _postsCache = _postsCache.filter(p => p._id !== post._id);
}
async function _deleteItemPosts(itemId) {
  for (const p of ((await _scopedPosts()) || []).filter(p => String(p.itemId) === String(itemId))) await _deletePost(p); // seulement sur le serveur sélectionné
}

async function _loadItem(id) {
  const snap = await getDoc(doc(db, 'items', String(id)));
  if (!snap.exists()) throw new Error('Item introuvable : ' + id);
  return desanitizeFromFirestore({ _id: snap.id, id: snap.id, ...snap.data() });
}

/** Reposte l'item dans son salon (supprime d'abord toute ancienne version). `auto` : ne fait rien si l'envoi automatique est désactivé. */
window.discordSyncItem = async function(id, opts = {}) {
  const r = await _routes(true);
  if (opts.auto && r.enabled === false) return false; // actif par défaut : seul un « false » explicite le coupe
  const item = await _loadItem(id);
  const channel = await _channelOfItem(item, { auto: !!opts.auto });
  if (!channel) { if (opts.auto) return false; throw new Error(`Aucun salon pour ${_itemKey(item)} (ni salon par défaut)`); }
  await _deleteItemPosts(item._id);
  await _sendSingleItemDiscord(item);
  return true;
};

// Appelé par l'approbation d'une soumission d'item : jamais bloquant, jamais d'erreur remontée au modérateur
window.discordAutoSync = async function(id) {
  try {
    if (await window.discordSyncItem(id, { auto: true })) toast('📣 Item posté / mis à jour sur Discord.', 'success');
  } catch (e) { console.warn('[discord auto]', e); toast('📣 Discord : ' + e.message, 'warning', 7000); }
};

// ── Opérations en lot (avec arrêt possible) ──
let _drCancel = false, _drBusy = false;
const _drSleep = ms => new Promise(r => setTimeout(r, ms));
function _drProgress(txt, busy) {
  const el = document.getElementById('discord-sync-progress');
  if (el) el.innerHTML = txt ? `${escHtml(txt)} ${busy ? '<button class="btn btn-ghost" onclick="discordCancelBulk()" style="font-size:11px;padding:2px 8px;margin-left:8px;">⏹ Arrêter</button>' : ''}` : '';
}
window.discordCancelBulk = () => { _drCancel = true; };
async function _bulk(label, list, fn, delay = 1500) {
  if (_drBusy) { toast('Une opération est déjà en cours.', 'warning'); return; }
  _drBusy = true; _drCancel = false; _postsCache = null;
  await _allPosts(true);
  let ok = 0, fail = 0;
  for (const [i, x] of list.entries()) {
    if (_drCancel) break;
    _drProgress(`${label} : ${i + 1}/${list.length} (échecs : ${fail})`, true);
    try { await fn(x); ok++; } catch (e) { fail++; console.warn('[discord bulk]', e); }
    if (i + 1 < list.length) await _drSleep(delay);
  }
  const stopped = _drCancel;
  _drBusy = false; _drCancel = false; _postsCache = null;
  _drProgress(`${label} terminé${stopped ? ' (arrêté)' : ''} : ${ok} ok, ${fail} échec(s).`, false);
  toast(`${label} : ${ok} ok, ${fail} échec(s).`, fail ? 'warning' : 'success');
  await window.discordRenderSync();
}

async function _itemsForChannel(channelId) {
  const items = (await cachedDocs(COL.items).catch(() => [])).map(i => ({ ...i, id: i.id ?? i._id }));
  const out = [];
  for (const it of items) {
    if (!it.category || it.palier == null) continue;
    const ch = await _channelOfItem(it, { auto: true });
    if (ch && (!channelId || ch === channelId)) out.push(it);
  }
  return out;
}

window.discordResendAll = async function() {
  const list = await _itemsForChannel(null);
  if (!list.length) { toast('Aucun item à envoyer (aucun salon réglé).', 'warning'); return; }
  if (!await modal.confirm(`Renvoyer ${list.length} item(s) ?\n\nChaque ancien post est supprimé puis recréé (environ ${Math.ceil(list.length * 2.5 / 60)} min).`)) return;
  await _withHidden(await Promise.all(list.map(it => _channelOfItem(it, { auto: true }))), () => _bulk('Renvoi', list, it => window.discordSyncItem(it.id)));
};
window.discordResendChannel = async function(channelId) {
  const list = await _itemsForChannel(channelId);
  if (!list.length) { toast('Aucun item pour ce salon.', 'warning'); return; }
  if (!await modal.confirm(`Renvoyer les ${list.length} item(s) du salon ${channelId} ?`)) return;
  await _withHidden(list.map(() => channelId), () => _bulk('Renvoi', list, it => window.discordSyncItem(it.id)));
};
// Envoie les items qui n'ont pas encore de post dans leur salon actuel (premier envoi, ou reprise après un arrêt)
window.discordSendMissing = async function(onlyChannel) {
  const [posts, all] = await Promise.all([_allPosts(true), _itemsForChannel(null)]);
  const hasPost = new Set(posts.map(p => String(p.itemId) + '|' + p.channelId));
  const list = [];
  for (const it of all) { const ch = await _channelOfItem(it, { auto: true }); if (ch && (!onlyChannel || ch === onlyChannel) && !hasPost.has(String(it.id) + '|' + ch)) list.push({ it, ch }); }
  if (!list.length) { toast('Tous les items ont déjà leur post.', 'success'); return; }
  if (!await modal.confirm(`Envoyer ${list.length} item(s) sans post ?\n\nDurée estimée : ${Math.ceil(list.length * 5 / 60)} min environ. Garde cet onglet ouvert (tu peux arrêter et reprendre : seuls les manquants sont envoyés).`)) return;
  await _withHidden(list.map(x => x.ch), () => _bulk('Envoi', list, x => window.discordSyncItem(x.it.id), 1200));
};
window.discordResendItem = async function(id) {
  try { await window.discordSyncItem(id); toast('Item renvoyé.', 'success'); await window.discordRenderSync(); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};
window.discordDeletePost = async function(docId) {
  try { const p = (await _allPosts()).find(x => x._id === docId); if (p) await _deletePost(p); toast('Post supprimé.', 'success'); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
  await window.discordRenderSync();
};
window.discordDeleteAllPosts = async function() {
  const posts = await _scopedPosts(true);
  if (!posts) { toast('Choisis un serveur (et vérifie que le worker est à jour) : sans ça, aucune suppression en masse.', 'warning'); return; }
  if (!posts.length) { toast('Aucun post suivi sur ce serveur.', 'warning'); return; }
  if (!await modal.confirm(`Supprimer les ${posts.length} posts Discord de ce serveur ?\n\n(Les posts des autres serveurs et les items du wiki ne sont pas touchés.)`)) return;
  await _bulk('Suppression', posts, _deletePost, 600);
};
window.discordDeleteChannelPosts = async function(channelId) {
  const posts = (await _allPosts(true)).filter(p => p.channelId === channelId);
  if (!posts.length) { toast('Aucun post suivi dans ce salon.', 'warning'); return; }
  if (!await modal.confirm(`Supprimer les ${posts.length} posts du salon ${channelId} ?`)) return;
  await _bulk('Suppression', posts, _deletePost, 600);
};

let _drItems = [], _drPosts = [];
window.discordSearchItems = function() {
  const q = normalize(document.getElementById('discord-resend-search')?.value.trim() || '');
  const el = document.getElementById('discord-resend-results');
  if (!el) return;
  if (!q) { el.innerHTML = ''; return; }
  el.innerHTML = _drItems.filter(i => normalize(i.name || '').includes(q)).slice(0, 8).map(i =>
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;">
       <span>${escHtml(i.name)} <span style="color:var(--muted);">· ${escHtml(i.category || '')} P${escHtml(String(i.palier))}</span></span>
       <button class="btn btn-ghost" data-id="${escHtml(i.id)}" onclick="discordResendItem(this.dataset.id)" style="font-size:11px;padding:2px 8px;">🔄 Envoyer / renvoyer</button></div>`).join('')
    || '<div style="color:var(--muted);font-size:12px;">Aucun résultat.</div>';
};
window.discordFilterPosts = function() {
  const q = normalize(document.getElementById('discord-posts-filter')?.value.trim() || '');
  const el = document.getElementById('discord-posts-list');
  if (!el) return;
  const list = _drPosts.filter(p => !q || normalize(p.itemName || '').includes(q)).slice(0, 100);
  el.innerHTML = list.map(p =>
    `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:5px 10px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;">
       <span>${escHtml(p.itemName || p.itemId)} <span style="color:var(--muted);">· ${escHtml(p.webhookKey || '')} · salon ${escHtml(String(p.channelId || '?'))}</span></span>
       <span style="display:flex;gap:6px;">
         <button class="btn btn-ghost" data-id="${escHtml(String(p.itemId))}" onclick="discordResendItem(this.dataset.id)" style="font-size:11px;padding:2px 8px;" title="Supprimer et reposter">🔄</button>
         <button class="btn btn-ghost" data-id="${escHtml(p._id)}" onclick="discordDeletePost(this.dataset.id)" style="font-size:11px;padding:2px 8px;color:var(--danger);border-color:var(--danger);" title="Supprimer ce post">🗑</button>
       </span></div>`).join('') || '<div style="color:var(--muted);font-size:12px;">Aucun post.</div>';
};

window.discordRenderSync = async function() {
  const el = document.getElementById('discord-sync-body');
  if (!el) return;
  try {
    const [r, scoped, items] = await Promise.all([_routes(true), _scopedPosts(true), cachedDocs(COL.items).catch(() => [])]);
    const posts = scoped || [];
    _drPosts = posts.sort((a, b) => String(a.itemName).localeCompare(String(b.itemName), 'fr'));
    _drItems = items.map(i => ({ ...i, id: i.id ?? i._id }));
    const chInfo = new Map((r.channels || []).filter(c => c.id).map(c => [c.id, c.name]));
    const channels = [...chInfo.keys()];
    const perChannel = channels.map(c => `<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:12px;margin-bottom:6px;">
        <strong style="min-width:170px;">#${escHtml(chInfo.get(c) || c)}</strong><span style="color:var(--muted);">${posts.filter(p => p.channelId === c).length} post(s)</span>
        <button class="btn btn-ghost" data-id="${escHtml(c)}" onclick="discordResendChannel(this.dataset.id)" style="font-size:11px;padding:2px 8px;">🔄 Renvoyer ses items</button>
        <button class="btn btn-ghost" data-id="${escHtml(c)}" onclick="discordDeleteChannelPosts(this.dataset.id)" style="font-size:11px;padding:2px 8px;color:var(--danger);border-color:var(--danger);">🗑 Supprimer ses posts</button></div>`).join('')
      || '<div style="color:var(--muted);font-size:12px;">Aucun salon réglé.</div>';
    const field = 'background:var(--surface2);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:7px 10px;font-size:12px;outline:none;';
    el.innerHTML = `
      <div id="discord-sync-progress" style="font-size:12px;color:var(--accent);min-height:18px;margin-bottom:8px;"></div>
      <div style="font-size:14px;font-weight:700;margin:6px 0 8px;">🛠 Actions manuelles</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <button class="btn btn-ghost" onclick="discordResendAll()" style="font-size:12px;">🔄 Renvoyer tous les items</button>
        <button class="btn btn-ghost" onclick="discordDeleteAllPosts()" style="font-size:12px;color:var(--danger);border-color:var(--danger);">🗑 Supprimer tous les posts de ce serveur (${posts.length})</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;font-size:12px;margin-bottom:12px;color:var(--muted);">🤫 Masquage anti-ping : réglé plus haut. <button class="btn btn-ghost" onclick="discordRestoreVisibility()" style="font-size:11px;padding:2px 8px;">🔓 Rétablir la visibilité</button></div>
      <div style="font-size:12px;font-weight:700;margin-bottom:6px;">Par salon</div>${perChannel}
      <div style="font-size:12px;font-weight:700;margin:14px 0 6px;">Envoyer / renvoyer un item</div>
      <input type="text" id="discord-resend-search" oninput="discordSearchItems()" placeholder="Nom de l'item…" style="${field}width:100%;box-sizing:border-box;">
      <div id="discord-resend-results" style="display:flex;flex-direction:column;gap:4px;margin-top:6px;"></div>
      <div style="font-size:12px;font-weight:700;margin:14px 0 6px;">Posts existants sur ce serveur (${posts.length})${scoped ? '' : ' <span style="color:var(--danger);font-weight:400;">— choisis un serveur pour les voir</span>'}</div>
      <input type="text" id="discord-posts-filter" oninput="discordFilterPosts()" placeholder="Filtrer par nom…" style="${field}width:100%;box-sizing:border-box;margin-bottom:6px;">
      <div id="discord-posts-list" style="display:flex;flex-direction:column;gap:4px;max-height:360px;overflow:auto;"></div>
`;
    window.discordFilterPosts();
  } catch (e) { el.innerHTML = `<div class="empty" style="color:var(--danger);">Erreur : ${escHtml(e.message)}</div>`; }
};

async function _ow(action, p) { const r = await _workerCall(action, p); if (!r) throw new Error('permissions Discord refusées (le bot a-t-il « Gérer les rôles » ?)'); return r; }

// ── Masquer un salon pendant un envoi en lot (évite les pings) ──
// @everyone perd « Voir le salon » le temps de l'envoi ; l'état d'origine est noté dans config/discord_lock pour pouvoir le rétablir même après un plantage.
const _VIEW = 1n << 10n;
const _BOT_ALLOW = (1n << 10n) | (1n << 11n) | (1n << 14n) | (1n << 15n) | (1n << 16n) | (1n << 34n) | (1n << 35n) | (1n << 38n); // voir, écrire, liens, fichiers, historique, gérer/créer fils, écrire dans les fils
const _LOCK_REF = () => doc(db, 'config', 'discord_lock');
let _botId = null;

async function _lockChannel(channelId) {
  const ch = await _workerCall('get_channel', { channelId });
  if (!ch?.id) { // raison réelle renvoyée par Discord : 404 = salon supprimé, 403 = le bot n'a pas accès au salon (permissions)
    const le = _workerCall.lastError || {};
    let msg = ''; try { msg = JSON.parse(le.text || '{}').message || ''; } catch { /* texte brut */ }
    throw new Error(`salon ${channelId} inaccessible (${le.status || '?'}${msg ? ' ' + msg : ''})` + (le.status === 403 ? ' : le bot ne voit pas ce salon, vérifie ses permissions « Voir le salon »' : le.status === 404 ? ' : salon supprimé sur Discord' : ''));
  }
  const guildId = ch.guild_id;
  const orig = (ch.permission_overwrites || []).find(o => o.id === guildId);
  const snap = await getDoc(_LOCK_REF());
  const saved = snap.exists() ? snap.data() : {};
  if (!saved[channelId]) { // ne jamais écraser un état d'origine déjà noté (verrou resté après un plantage)
    saved[channelId] = { guildId, existed: !!orig, allow: orig?.allow || '0', deny: orig?.deny || '0' };
    await setDoc(_LOCK_REF(), saved);
  }
  _botId ??= (await _workerCall('get_bot_user', {}))?.id;
  if (_botId) await _ow('set_overwrite', { channelId, overwriteId: _botId, type: 1, allow: _BOT_ALLOW.toString(), deny: '0' }); // le bot garde l'accès
  const o = saved[channelId];
  await _ow('set_overwrite', { channelId, overwriteId: guildId, type: 0, allow: (BigInt(o.allow) & ~_VIEW).toString(), deny: (BigInt(o.deny) | _VIEW).toString() });
}
async function _unlockChannel(channelId, saved) {
  const o = saved[channelId];
  if (!o) return;
  if (o.existed) await _ow('set_overwrite', { channelId, overwriteId: o.guildId, type: 0, allow: o.allow, deny: o.deny });
  else await _ow('delete_overwrite', { channelId, overwriteId: o.guildId });
}
async function _restoreLocked(ids) {
  const snap = await getDoc(_LOCK_REF());
  const saved = snap.exists() ? snap.data() : {};
  for (const id of (ids || Object.keys(saved))) { await _unlockChannel(id, saved); delete saved[id]; }
  await setDoc(_LOCK_REF(), saved);
}
/** Exécute fn avec les salons masqués AVANT l'envoi, puis les rétablit quoi qu'il arrive.
 *  channelIds = un salon par item à envoyer ; seuls les salons qui reçoivent plus de config/discord_routes.hideThreshold items
 *  (10 par défaut, 0 = ne jamais masquer) sont masqués. */
async function _withHidden(channelIds, fn) {
  const cfg = await _routes(true);
  const threshold = Number.isFinite(cfg.hideThreshold) ? cfg.hideThreshold : 10;
  const hide = threshold > 0;
  const counts = new Map();
  channelIds.filter(Boolean).forEach(id => counts.set(id, (counts.get(id) || 0) + 1));
  const ids = [...counts].filter(([, n]) => n > threshold).map(([id]) => id);
  const locked = [];
  try {
    if (hide) for (const id of ids) { try { await _lockChannel(id); locked.push(id); } catch (e) { toast('Masquage impossible pour ' + id + ' : ' + e.message + ' (envoi quand même)', 'warning', 7000); } }
    return await fn();
  } finally {
    if (locked.length) { try { await _restoreLocked(locked); } catch (e) { toast('⚠️ Visibilité non rétablie : utilise « Rétablir la visibilité ». ' + e.message, 'error', 12000); } }
  }
}
window.discordRestoreVisibility = async function() {
  try { await _restoreLocked(); toast('Visibilité des salons rétablie.', 'success'); } catch (e) { toast('Erreur : ' + e.message, 'error'); }
};

}
