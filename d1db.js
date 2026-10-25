/* ══ d1db.js — Remplaçant de firebase-firestore.js : même API, mais les données vivent dans Cloudflare D1 ══
   Exporte les mêmes noms que le SDK Firestore (doc, collection, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
   query, where, orderBy, limit, startAfter, writeBatch, onSnapshot, serverTimestamp, increment, deleteField, arrayUnion,
   arrayRemove, Timestamp) : le reste du site n'a qu'à changer l'URL d'import.
   Les droits sont vérifiés par le worker (POST /db/read, /db/write) avec le jeton Firebase Auth de l'utilisateur. */

const WORKER = 'https://veilleurs.veilleurs-wiki.workers.dev';

let _tokenProvider = async () => null;
/** firebase.js branche ici la récupération du jeton Firebase Auth (auth.currentUser.getIdToken()). */
export function setTokenProvider(fn) { _tokenProvider = fn; }

async function call(path, body) {
  const idToken = await Promise.resolve(_tokenProvider()).catch(() => null);
  let r;
  try {
    r = await fetch(WORKER + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, idToken }) });
  } catch (e) { const err = new Error('Base de données injoignable'); err.code = 'unavailable'; throw err; }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const err = new Error(j.error || ('HTTP ' + r.status));
    err.code = r.status === 403 ? 'permission-denied' : r.status === 404 ? 'not-found' : 'unavailable';
    throw err;
  }
  return j;
}

/* ── Timestamp ── */
export class Timestamp {
  constructor(seconds, nanoseconds = 0) { this.seconds = seconds; this.nanoseconds = nanoseconds; }
  toMillis() { return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6); }
  toDate() { return new Date(this.toMillis()); }
  isEqual(o) { return o && o.seconds === this.seconds && o.nanoseconds === this.nanoseconds; }
  valueOf() { return this.toMillis(); }
  static fromMillis(ms) { return new Timestamp(Math.floor(ms / 1000), (ms % 1000) * 1e6); }
  static fromDate(d) { return Timestamp.fromMillis(d.getTime()); }
  static now() { return Timestamp.fromMillis(Date.now()); }
}

/* ── Valeurs spéciales ── */
class FieldValue { constructor(o) { this.o = o; } }
export const serverTimestamp = () => new FieldValue({ __op: 'serverTimestamp' });
export const increment       = n => new FieldValue({ __op: 'increment', n });
export const deleteField     = () => new FieldValue({ __op: 'deleteField' });
export const arrayUnion      = (...v) => new FieldValue({ __op: 'arrayUnion', v });
export const arrayRemove     = (...v) => new FieldValue({ __op: 'arrayRemove', v });

/* JS → JSON de transport */
function enc(v) {
  if (v instanceof FieldValue) return v.o;
  if (v instanceof Timestamp) return { __ts: v.toMillis() };
  if (v instanceof Date) return { __ts: v.getTime() };
  if (Array.isArray(v)) return v.map(x => enc(x === undefined ? null : x));
  if (v && typeof v === 'object') {
    const o = {};
    for (const [k, x] of Object.entries(v)) if (x !== undefined) o[k] = enc(x);
    return o;
  }
  return v;
}
/* JSON de transport → JS (les {__ts} redeviennent des Timestamp) */
function revive(v) {
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === 'object') {
    if (Object.keys(v).length === 1 && '__ts' in v) return Timestamp.fromMillis(v.__ts);
    const o = {};
    for (const [k, x] of Object.entries(v)) o[k] = revive(x);
    return o;
  }
  return v;
}

/* ── Références ── */
export const db = { __d1: true };
export const getFirestore = () => db;

class DocRef {
  constructor(col, id) { this.type = 'document'; this.col = col; this.id = id; this.path = col + '/' + id; this.firestore = db; }
  get parent() { return new CollRef(this.col); }
}
class CollRef {
  constructor(col) { this.type = 'collection'; this.col = col; this.path = col; this.id = col.split('/').pop(); this.firestore = db; }
}
const autoId = () => { const a = crypto.getRandomValues(new Uint8Array(15)); return [...a].map(b => 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'[b % 62]).join(''); };

export function collection(base, ...segs) {
  const parts = base instanceof CollRef ? [base.col, ...segs] : base instanceof DocRef ? [base.path, ...segs] : segs;
  return new CollRef(parts.join('/'));
}
export function doc(base, ...segs) {
  if (base instanceof CollRef) return new DocRef(base.col, segs[0] ?? autoId());
  const parts = base instanceof DocRef ? [base.path, ...segs] : segs;
  const id = parts.pop();
  return new DocRef(parts.join('/'), id);
}

/* ── Snapshots ── */
class DocSnap {
  constructor(col, id, raw) { this.id = id; this.ref = new DocRef(col, id); this._raw = raw; this.metadata = { fromCache: false, hasPendingWrites: false }; }
  exists() { return this._raw != null; }
  data() { return this._raw == null ? undefined : revive(JSON.parse(JSON.stringify(this._raw))); }
  get(field) { const d = this.data(); return field.split('.').reduce((a, k) => (a == null ? undefined : a[k]), d); }
}
class QuerySnap {
  constructor(col, rows) {
    this.docs = rows.map(r => new DocSnap(col, r.id, r.d));
    this.size = this.docs.length; this.empty = !this.docs.length; this.metadata = { fromCache: false };
  }
  forEach(fn) { this.docs.forEach(fn); }
  docChanges() { return this.docs.map(d => ({ type: 'added', doc: d })); }
}

/* ── Requêtes ── */
class Query {
  constructor(col, c = {}) { this.type = 'query'; this.col = col; this.c = { where: [], orderBy: [], limit: null, startAfter: null, ...c }; this.firestore = db; }
}
export const where   = (f, op, v) => ({ k: 'where', v: [f, op, v] });
export const orderBy = (f, dir = 'asc') => ({ k: 'orderBy', v: [f, dir] });
export const limit   = n => ({ k: 'limit', v: n });
export const startAfter = (...a) => ({ k: 'startAfter', v: a });
export function query(base, ...cons) {
  const q = new Query(base.col, base instanceof Query ? JSON.parse(JSON.stringify(base.c)) : {});
  for (const x of cons) {
    if (x.k === 'where') q.c.where.push(enc(x.v));
    else if (x.k === 'orderBy') q.c.orderBy.push(x.v);
    else if (x.k === 'limit') q.c.limit = x.v;
    else if (x.k === 'startAfter') q.c.startAfter = x.v;
  }
  return q;
}

/* ── Lecture ── */
const _inflight = new Map();
function dedupe(key, fn) {
  const hit = _inflight.get(key);
  if (hit) return hit;
  const p = fn().finally(() => _inflight.delete(key)); // uniquement les appels simultanés identiques : jamais de résultat périmé après une écriture
  _inflight.set(key, p);
  return p;
}

export async function getDoc(ref) {
  const j = await dedupe('d:' + ref.path, () => call('/db/read', { col: ref.col, id: ref.id }));
  return new DocSnap(ref.col, ref.id, j.doc ? j.doc.d : null);
}

export async function getDocs(src) {
  const q = src instanceof Query ? src : new Query(src.col);
  const body = { col: q.col, where: q.c.where, orderBy: q.c.orderBy, limit: q.c.limit };
  if (q.c.startAfter && q.c.startAfter.length) {
    const s = q.c.startAfter[0];
    if (s instanceof DocSnap) { const f = q.c.orderBy[0]?.[0]; body.startAfter = [f ? enc(s.get(f)) : s.id, s.id]; }
    else body.startAfter = [enc(s), ''];
  }
  const j = await dedupe('q:' + JSON.stringify(body), () => call('/db/read', body));
  return new QuerySnap(q.col, j.docs || []);
}

/** « Temps réel » : relecture toutes les 15 s tant que l'onglet est visible (D1 n'a pas de push). */
export function onSnapshot(src, onNext, onError) {
  let stop = false, last = '';
  const tick = async () => {
    if (stop) return;
    try {
      const snap = src instanceof DocRef ? await getDoc(src) : await getDocs(src);
      const sig = JSON.stringify(src instanceof DocRef ? snap._raw : snap.docs.map(d => [d.id, d._raw]));
      if (sig !== last) { last = sig; onNext(snap); }
    } catch (e) { if (onError) onError(e); }
  };
  tick();
  const t = setInterval(() => { if (!document.hidden) tick(); }, 15000);
  return () => { stop = true; clearInterval(t); };
}

/* ── Écriture ── */
export async function setDoc(ref, data, opts) {
  const j = await call('/db/write', { ops: [{ op: 'set', col: ref.col, id: ref.id, data: enc(data), merge: !!(opts && opts.merge) }] });
  return j;
}
export async function addDoc(colRef, data) {
  const j = await call('/db/write', { ops: [{ op: 'add', col: colRef.col, data: enc(data) }] });
  return new DocRef(colRef.col, j.ids[0]);
}
export async function updateDoc(ref, data) {
  return call('/db/write', { ops: [{ op: 'update', col: ref.col, id: ref.id, data: enc(data) }] });
}
export async function deleteDoc(ref) {
  return call('/db/write', { ops: [{ op: 'delete', col: ref.col, id: ref.id }] });
}
export function writeBatch() {
  const ops = [];
  const b = {
    set(ref, data, opts) { ops.push({ op: 'set', col: ref.col, id: ref.id, data: enc(data), merge: !!(opts && opts.merge) }); return b; },
    update(ref, data) { ops.push({ op: 'update', col: ref.col, id: ref.id, data: enc(data) }); return b; },
    delete(ref) { ops.push({ op: 'delete', col: ref.col, id: ref.id }); return b; },
    async commit() {
      for (let i = 0; i < ops.length; i += 200) await call('/db/write', { ops: ops.slice(i, i + 200) });
    },
  };
  return b;
}
