// ══════════════════════════════════════════════════════
// TRADUCTION — propositions des traducteurs (i18n/review.html, i18n/compare.html)
// Chargé à la demande par moderation.js (_lazyPanel) ; init(ctx) définit les window.* du panneau.
// Une proposition = un document de `translation_proposals` : { fr, en, oldEn, kind: edit|new|flag, status, note, submitterName… }.
// Valider = écrire la traduction dans `config/i18n_en` ({ map: { texte français: anglais } }) : i18n.js la charge avant le fichier du dépôt,
// donc elle est visible sur le site tout de suite. « Reporter dans en.json » exporte ce qui n'y est pas encore (tools/i18n-apply.js).
// ══════════════════════════════════════════════════════

export function init(ctx) {
const { db, collection, getDocs, getDoc, doc, setDoc, updateDoc, writeBatch, serverTimestamp, query, orderBy, toast, modal, setHash, showPanel, escHtml, writeAudit } = ctx;
const squash = s => String(s).replace(/\s+/g, ' ').trim();
const vars = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const KIND = { edit: '✎ Correction', new: '＋ Nouveau texte', flag: '⚠ Doute signalé' };
const S = { all: [], dict: {}, over: {}, status: 'pending', q: '', busy: false };

const when = p => { const ms = p.at?.toMillis?.() ?? p.at?.__ts; return ms ? new Date(ms).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : ''; };
const current = fr => (fr in S.over ? S.over[fr] : (S.dict[fr] ?? null));   // ce que voient les visiteurs maintenant

function warnings(fr, en) {
  const w = [];
  if (!en.trim()) w.push('Traduction vide.');
  if (vars(fr) !== vars(en)) w.push(`Variables différentes : français {${vars(fr) || '—'}}, anglais {${vars(en) || '—'}}.`);
  return w;
}

window.showTranslations = async function showTranslations() {
  setHash('translations');
  showPanel('translations-panel', 'btn-translations');
  await window._loadTranslations();
};

window._loadTranslations = async function _loadTranslations() {
  const box = document.getElementById('tr-list');
  if (!box) return;
  box.innerHTML = '<div class="empty">Chargement…</div>';
  try {
    const [snap, dictRes, ovSnap] = await Promise.all([
      getDocs(query(collection(db, 'translation_proposals'), orderBy('at', 'desc'))),
      fetch('./i18n/en.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({})),
      getDoc(doc(db, 'config', 'i18n_en')),
    ]);
    S.all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    S.dict = Object.fromEntries(Object.entries(dictRes).filter(([k, v]) => !k.startsWith('_') && typeof v === 'string'));
    S.over = (ovSnap.exists() ? ovSnap.data().map : null) || {};
    render();
  } catch (e) {
    box.innerHTML = '<div class="empty">Erreur de chargement.</div>';
    console.error('[translations]', e);
  }
};

function render() {
  const box = document.getElementById('tr-list'); if (!box) return;
  const count = st => S.all.filter(p => p.status === st).length;
  for (const st of ['pending', 'accepted', 'rejected']) { const el = document.getElementById('tr-n-' + st); if (el) el.textContent = count(st); }
  const badge = document.getElementById('count-translations');
  if (badge) { badge.textContent = count('pending'); badge.style.display = count('pending') ? '' : 'none'; }
  document.querySelectorAll('#translations-panel [data-trst]').forEach(b => b.classList.toggle('active', b.dataset.trst === S.status));
  const q = S.q.toLowerCase();
  const list = S.all.filter(p => p.status === S.status && (!q || (p.fr + ' ' + p.en + ' ' + (p.submitterName || '')).toLowerCase().includes(q)));
  if (!list.length) { box.innerHTML = '<div class="empty">Aucune proposition.</div>'; return; }
  box.innerHTML = list.map(p => card(p)).join('');
}

function card(p) {
  const cur = current(p.fr), pending = p.status === 'pending';
  const w = warnings(p.fr, p.en);
  const kind = KIND[p.kind] || p.kind;
  const head = `<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;font-size:11px;color:var(--muted);margin-bottom:8px;">
      <span class="filter-count" style="background:var(--surface);">${kind}</span><span>${escHtml(p.submitterName || '?')}</span><span>${when(p)}</span>
      ${p.doubt ? '<span style="color:var(--gold);">⚠ le traducteur hésite</span>' : ''}
      ${p.status !== 'pending' ? `<span style="color:${p.status === 'accepted' ? 'var(--added)' : 'var(--removed)'};">${p.status === 'accepted' ? '✔ Validée' : '✕ Refusée'}${p.reviewNote ? ' — ' + escHtml(p.reviewNote) : ''}</span>` : ''}</div>`;
  const cols = `<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;">
      <div><div class="tr-lbl">🇫🇷 Français</div><div class="tr-box" style="white-space:pre-wrap;">${escHtml(p.fr)}</div></div>
      <div><div class="tr-lbl">🇬🇧 Version actuelle</div><div class="tr-box" style="white-space:pre-wrap;${cur == null ? 'color:var(--muted);font-style:italic;' : ''}">${cur == null ? '(pas encore de traduction)' : escHtml(cur)}</div></div>
      <div><div class="tr-lbl">✎ Proposition</div>${pending
        ? `<textarea class="tr-box tr-en" data-id="${escHtml(p.id)}" rows="3" style="width:100%;resize:vertical;font-family:inherit;">${escHtml(p.en)}</textarea>`
        : `<div class="tr-box" style="white-space:pre-wrap;">${escHtml(p.en)}</div>`}</div></div>`;
  const note = p.note ? `<div style="margin-top:8px;font-size:12px;background:var(--surface);border-left:3px solid var(--gold);padding:5px 9px;border-radius:4px;">💬 ${escHtml(p.note)}</div>` : '';
  const warn = w.length ? `<div style="margin-top:6px;color:var(--removed);font-size:12px;">${w.map(escHtml).join(' ')}</div>` : '';
  const act = pending ? `<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
      <button class="btn btn-primary" onclick="trDecide('${escHtml(p.id)}','accepted')">✔ ${p.kind === 'flag' ? 'Traité' : 'Valider'}</button>
      <button class="btn btn-ghost" onclick="trDecide('${escHtml(p.id)}','rejected')">✕ Refuser</button>
      <input class="tr-reason" data-id="${escHtml(p.id)}" type="text" placeholder="Remarque pour le traducteur (facultatif)" style="flex:1;min-width:180px;background:var(--surface);border:1px solid var(--border);border-radius:6px;color:var(--text);padding:6px 9px;font-size:12px;">
    </div>` : '';
  return `<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:12px;">${head}${cols}${note}${warn}${act}</div>`;
}

/** Écrit les traductions validées dans config/i18n_en (lecture à neuf puis écriture, pour ne pas écraser une autre validation). */
async function writeOverrides(entries) {
  const snap = await getDoc(doc(db, 'config', 'i18n_en'));
  const map = { ...((snap.exists() ? snap.data().map : null) || {}) };
  for (const [fr, en] of entries) map[fr] = en;
  await setDoc(doc(db, 'config', 'i18n_en'), { map, count: Object.keys(map).length, updatedAt: serverTimestamp() });
  S.over = map;
}

window.trDecide = async function trDecide(id, status) {
  const p = S.all.find(x => x.id === id); if (!p || S.busy) return;
  const ta = document.querySelector(`.tr-en[data-id="${CSS.escape(id)}"]`), reason = document.querySelector(`.tr-reason[data-id="${CSS.escape(id)}"]`);
  const en = ta ? ta.value.trim() : p.en, note = reason ? reason.value.trim() : '';
  if (status === 'accepted') {
    const w = warnings(p.fr, en);
    if (w.length && !(await modal.confirm('⚠️ ' + w.join(' ') + '\n\nValider quand même ?', { danger: true }))) return;
  }
  S.busy = true;
  try {
    const changed = status === 'accepted' && en && en !== current(p.fr);
    if (changed) await writeOverrides([[p.fr, en]]);
    await updateDoc(doc(db, 'translation_proposals', id), { status, finalEn: status === 'accepted' ? en : null, reviewNote: note || null, reviewedBy: ctx.user?.uid || null, reviewedAt: serverTimestamp() });
    Object.assign(p, { status, finalEn: en, reviewNote: note });
    writeAudit?.('translation_' + status, 'translation', id, p.fr.slice(0, 80), { en });
    toast(status === 'accepted' ? (changed ? '✔ Traduction validée : visible sur le site.' : '✔ Marquée comme traitée.') : '✕ Proposition refusée.', 'success');
    render();
  } catch (e) { toast('Erreur : ' + (e.message || e), 'error'); }
  S.busy = false;
};

window.trAcceptAll = async function trAcceptAll() {
  const list = S.all.filter(p => p.status === 'pending' && p.kind !== 'flag' && !warnings(p.fr, p.en).length);
  if (!list.length) return toast('Aucune proposition sans avertissement à valider.', 'info');
  if (!(await modal.confirm(`Valider les ${list.length} propositions en attente (sans avertissement) telles quelles ?`))) return;
  S.busy = true;
  try {
    await writeOverrides(list.map(p => [p.fr, p.en]));
    const b = writeBatch();
    for (const p of list) b.update(doc(db, 'translation_proposals', p.id), { status: 'accepted', finalEn: p.en, reviewNote: null, reviewedBy: ctx.user?.uid || null, reviewedAt: serverTimestamp() });
    await b.commit();
    list.forEach(p => Object.assign(p, { status: 'accepted', finalEn: p.en }));
    writeAudit?.('translation_accept_all', 'translation', 'bulk', `${list.length} traductions`, {});
    toast(`✔ ${list.length} traductions validées.`, 'success');
    render();
  } catch (e) { toast('Erreur : ' + (e.message || e), 'error'); }
  S.busy = false;
};

window.trSetStatus = function trSetStatus(st) { S.status = st; render(); };
window.trSearch = function trSearch(v) { S.q = v || ''; render(); };

/** Ce que la base contient en plus du dépôt → fichier au format de tools/i18n-apply.js (node tools/i18n-apply.js fichier.json). */
window.trExport = function trExport() {
  const edits = {}, added = [];
  for (const [fr, en] of Object.entries(S.over)) { if (fr in S.dict) { if (S.dict[fr] !== en) edits[fr] = en; } else added.push({ fr, en }); }
  if (!Object.keys(edits).length && !added.length) return toast('Rien à reporter : le dépôt est à jour.', 'info');
  const out = { format: 'vcl-i18n-review/1', reviewer: 'modération', date: new Date().toISOString(), edits, status: {}, notes: {}, added };
  for (const k of [...Object.keys(edits), ...added.map(a => a.fr)]) out.status[k] = 'ok';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' }));
  a.download = `i18n-valide-${out.date.slice(0, 10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(`${Object.keys(edits).length + added.length} textes exportés. Ensuite : node tools/i18n-apply.js <fichier>, commit, puis « Nettoyer la base ».`, 'info');
};

/** Retire de la base les corrections déjà présentes dans en.json (après report + mise en ligne). */
window.trClean = async function trClean() {
  const dead = Object.keys(S.over).filter(k => S.dict[k] === S.over[k]);
  if (!dead.length) return toast('Rien à nettoyer.', 'info');
  if (!(await modal.confirm(`Retirer de la base ${dead.length} corrections déjà présentes dans en.json ?`))) return;
  try {
    const snap = await getDoc(doc(db, 'config', 'i18n_en'));
    const map = { ...((snap.exists() ? snap.data().map : null) || {}) };
    dead.forEach(k => delete map[k]);
    await setDoc(doc(db, 'config', 'i18n_en'), { map, count: Object.keys(map).length, updatedAt: serverTimestamp() });
    S.over = map; toast(`🧹 ${dead.length} corrections retirées de la base.`, 'success'); render();
  } catch (e) { toast('Erreur : ' + (e.message || e), 'error'); }
};
}
