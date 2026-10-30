// Envoi des propositions de traduction à la modération (onglet « Traduction »).
// Partagé par review.html et compare.html. Une proposition = un document de `translation_proposals` ;
// son id est stable (auteur + texte français), donc renvoyer une proposition encore en attente la met à jour.
import { auth, db } from '../firebase.js';
import { doc, getDoc, setDoc, serverTimestamp } from '../d1db.js';

const squash = s => String(s).replace(/\s+/g, ' ').trim();
const hash = s => { let h = 2166136261; for (const c of s) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };

/** Corrections déjà validées par la modération (config/i18n_en) : à fusionner dans le dictionnaire de l'outil. */
export async function loadOverrides() {
  try { const s = await getDoc(doc(db, 'config', 'i18n_en')); return (s.exists() ? s.data().map : null) || {}; } catch { return {}; }
}

/** Ce qui reste à envoyer : corrections, nouveaux textes, doutes / remarques (hors ce qui a déjà été envoyé tel quel). */
export function pendingItems(draft, dict) {
  const sent = draft.sent || {}, out = [];
  const push = it => { it.sig = JSON.stringify([it.kind, it.en, it.note, it.doubt]); if (sent[it.fr] !== it.sig) out.push(it); };
  const keys = new Set();
  for (const [fr, en] of Object.entries(draft.edits || {})) {
    if (en === dict[fr] || !String(en).trim()) continue;
    keys.add(fr); push({ fr, en, oldEn: dict[fr] ?? null, kind: 'edit', note: draft.notes?.[fr] || '', doubt: draft.status?.[fr] === 'doubt' });
  }
  for (const a of draft.added || []) {
    keys.add(a.fr); push({ fr: a.fr, en: a.en, oldEn: null, kind: 'new', note: draft.notes?.[a.fr] || '', doubt: draft.status?.[a.fr] === 'doubt' });
  }
  const flagged = new Set([...Object.keys(draft.notes || {}), ...Object.entries(draft.status || {}).filter(([, s]) => s === 'doubt').map(([k]) => k)]);
  for (const fr of flagged) {
    if (keys.has(fr)) continue;
    push({ fr, en: dict[fr] || '—', oldEn: dict[fr] ?? null, kind: 'flag', note: draft.notes?.[fr] || '', doubt: draft.status?.[fr] === 'doubt' });
  }
  return out;
}

/** Envoie les propositions ; marque draft.sent pour celles qui sont parties. Renvoie { sent, failed, error }. */
export async function sendProposals(draft, items, name) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not signed in.');
  draft.sent ||= {};
  let sent = 0, failed = 0, error = '';
  const one = async it => {
    const base = `${user.uid}_${hash(squash(it.fr))}`;
    const data = { fr: it.fr, en: it.en, oldEn: it.oldEn, kind: it.kind, note: it.note || '', doubt: !!it.doubt, status: 'pending', submittedBy: user.uid, submitterName: (name || user.displayName || 'translator').slice(0, 80), at: serverTimestamp() };
    try { await setDoc(doc(db, 'translation_proposals', base), data); }
    catch (e) {
      if (!/Droits|denied|403/i.test(String(e.message || e))) throw e;
      await setDoc(doc(db, 'translation_proposals', base + '_' + Date.now().toString(36)), data);   // l'ancienne proposition est déjà traitée : on en ouvre une nouvelle
    }
    draft.sent[it.fr] = it.sig;
  };
  for (let i = 0; i < items.length; i += 5) {
    const res = await Promise.allSettled(items.slice(i, i + 5).map(one));
    for (const r of res) { if (r.status === 'fulfilled') sent++; else { failed++; error = String(r.reason?.message || r.reason); } }
  }
  return { sent, failed, error };
}
