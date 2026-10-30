/* ══════════════════════════════════════════════════════
   STORE — Source unique de données (remplace db-loader.js + compendium-init.js)

   Usage dans chaque page :
     import { store } from '../store.js';       // ou './store.js' depuis la racine
     await store.load(['items', 'mobs']);
     console.log(store.items);                  // tableau désanitisé

   Après une écriture en modération :
     store.invalidate('items');                 // force re-fetch au prochain load()
══════════════════════════════════════════════════════ */

import { loadCollection, loadEventNames, invalidateCache, COL, db, doc, getDoc, onSnapshot } from './firebase.js';
import { loader } from './components/page-loader.js';

// Correspondance nom logique → nom collection Firestore
const COL_MAP = {
  items:      COL.items,
  mobs:       COL.mobs,
  pnj:        COL.pnj,
  regions:    COL.regions,
  quetes:     COL.quetes,
  panoplies:  COL.panoplies,
  mapMarkers: COL.mapMarkers,
  zones:      COL.zones,
  donjons:    COL.donjons,
};

// Config des paliers (libellés « Palier 1 », « World Boss »…) lue par vclPalierLabel() (Compendium/data.js).
window._vcl_paliers = window._vcl_paliers || [];
async function _loadPalierLabels() {
  try {
    const snap = await getDoc(doc(db, 'config', 'paliers'));
    const list = snap.exists() && snap.data().paliers;
    if (Array.isArray(list) && list.length) window._vcl_paliers = list;
  } catch (e) { console.warn('[store] config/paliers :', e.message); }
}

// Forgerons d'items secrets : leur position reste cachée (carte, bestiaire, localisation dans l'obtain) tant que
// config/secret_forgerons.hidden n'est pas false (outil modération « Forgerons secrets »). Masqué par défaut.
window._vcl_secret_forgerons_hidden = true;
const _SECRET_FORGERON_TAGS  = ['fabricant_secrets', 'fabricant_secret', 'forgeron_items_secrets'];
const _SECRET_FORGERON_TYPES = ["forgeron d'items secrets", 'fabricant secret'];
// Ajouts manuels (outil modération) : config/secret_forgerons.pnj = ids de PNJ, .items = ids d'items dont l'obtain est caché
window._vcl_secret_pnj_ids = new Set();
window._vcl_secret_item_ids = new Set();
// Révélations individuelles : .revealedPnj / .revealedItems = ids visibles même quand le secret global est actif
window._vcl_revealed_pnj_ids = new Set();
window._vcl_revealed_item_ids = new Set();
const _secretish = p => { const n = v => String(v || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); return n(p.tag).includes('secret') || n(p.type).includes('secret') || /secret|occulte/.test(n(p.name)); }; // forgeron / marchand d'items secrets : détecté tout seul (tag, type ou nom)
window.vclIsSecretForgeron = p => !!p && (_SECRET_FORGERON_TAGS.includes(p.tag) || _SECRET_FORGERON_TYPES.includes(String(p.type || '').toLowerCase()) || _secretish(p) || window._vcl_secret_pnj_ids.has(p.id ?? p._id));
window.vclIsSecretPnj = p => window._vcl_secret_forgerons_hidden !== false && window.vclIsSecretForgeron(p) && !window._vcl_revealed_pnj_ids.has(p.id ?? p._id);
window.vclIsSecretItem = it => window._vcl_secret_forgerons_hidden !== false && !!it && window._vcl_secret_item_ids.has(it.id ?? it._id) && !window._vcl_revealed_item_ids.has(it.id ?? it._id);
async function _loadSecretForgerons() {
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'config', 'secret_forgerons')),
      new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 4000)),
    ]);
    const cfg = snap.exists() ? snap.data() : {};
    window._vcl_secret_forgerons_hidden = cfg.hidden !== false;
    window._vcl_secret_pnj_ids = new Set(Array.isArray(cfg.pnj) ? cfg.pnj : []);
    window._vcl_secret_item_ids = new Set(Array.isArray(cfg.items) ? cfg.items : []);
    window._vcl_revealed_pnj_ids = new Set(Array.isArray(cfg.revealedPnj) ? cfg.revealedPnj : []);
    window._vcl_revealed_item_ids = new Set(Array.isArray(cfg.revealedItems) ? cfg.revealedItems : []);
  } catch (e) { console.warn('[store] config/secret_forgerons :', e.message); }
}

const _data    = {};
let _ready     = false;
let _callbacks = [];

export const store = {
  // ── Accesseurs ──────────────────────────────────────
  get items()      { return _data.items      ?? []; },
  get mobs()       { return _data.mobs       ?? []; },
  get pnj()        { return _data.pnj        ?? []; },
  get regions()    { return _data.regions    ?? []; },
  get quetes()     { return _data.quetes     ?? []; },
  get panoplies()  { return _data.panoplies  ?? []; },
  get mapMarkers() { return _data.mapMarkers ?? []; },
  get zones()      { return _data.zones      ?? []; },
  get donjons()    { return _data.donjons    ?? []; },
  /** Panoplies indexées par id — compatible avec le global SETS des pages legacy */
  get sets()      { return _data.sets      ?? {}; },

  // ── Chargement ──────────────────────────────────────

  /**
   * Charge les collections demandées en parallèle depuis Firestore (avec cache TTL 1h).
   * Affiche l'écran de chargement si ça traîne (sauf `silent`, pour les rechargements en arrière-plan).
   * @param {string[]} cols  ex. ['items', 'mobs', 'panoplies']
   * @param {{silent?: boolean}} [opts]
   */
  async load(cols, opts = {}) {
    const toLoad = [...new Set(cols)];
    const progress = opts.silent ? null : loader.begin(toLoad.length);
    let results;
    try {
      const [res] = await Promise.all([
        Promise.all(toLoad.map(c => loadCollection(COL_MAP[c] ?? c).catch(() => []).finally(() => progress?.step()))),
        _loadPalierLabels(),
        _loadSecretForgerons(),
      ]);
      results = res;
    } finally { progress?.end(); }
    toLoad.forEach((c, i) => { _data[c] = results[i]; });

    // Fusion panoplies → SETS (miroir de la logique db-loader.js)
    if (_data.panoplies) {
      const sets = {};
      for (const p of _data.panoplies) {
        const key = p.id || p._id;
        if (!key) continue;
        const bonuses = {};
        if (p.bonuses && typeof p.bonuses === 'object') {
          for (const [k, v] of Object.entries(p.bonuses)) bonuses[k] = v;
        }
        sets[key] = { label: p.label ?? key, color: p.color ?? '#888', bonuses, ordre: p.ordre ?? 999 };
      }
      _data.sets = sets;
    }

    await loadEventNames(); // EVENT_NAMES = collection `events` (no-op si la page n'a pas Compendium/data.js)

    _ready = true;
    const cbs = _callbacks.splice(0);
    cbs.forEach(fn => fn());
  },

  /**
   * Enregistre un callback à appeler dès que load() se résout.
   * Si déjà résolu, appel immédiat.
   */
  onReady(callback) {
    if (_ready) { callback(); return; }
    _callbacks.push(callback);
  },

  // ── Cache ────────────────────────────────────────────

  /**
   * Invalide le cache d'une collection.
   * Le prochain appel à store.load() re-fetche depuis Firestore.
   * À appeler après une écriture en modération.
   * @param {string} colName  ex. 'items'
   */
  invalidate(colName) {
    invalidateCache(COL_MAP[colName] ?? colName);
    delete _data[colName];
    if (colName === 'panoplies') delete _data.sets;
  },

  // ── Temps réel ───────────────────────────────────────

  /**
   * Écoute config/wiki_version et appelle callback({collection}) à chaque bump.
   * Retourne la fonction unsubscribe.
   */
  listenForUpdates(callback) {
    return onSnapshot(doc(db, 'config', 'wiki_version'), snap => {
      if (snap.exists()) callback(snap.data());
    });
  },

  // ── Compat legacy ────────────────────────────────────

  /**
   * Peuple les variables globales utilisées par les scripts classiques non encore migrés.
   * Appeler après store.load() si la page utilise encore ITEMS, MOBS, PERSONNAGES, SETS.
   * `hideSecretPnj` : n'inclut pas les forgerons d'items secrets (bestiaire) tant qu'ils sont masqués.
   */
  populateGlobals({ hideSecretPnj = false } = {}) {
    if (typeof ITEMS       !== 'undefined') ITEMS.push(...(_data.items     ?? []));
    if (typeof MOBS        !== 'undefined') MOBS.push(...(_data.mobs      ?? []));
    if (typeof PERSONNAGES !== 'undefined') PERSONNAGES.push(...(_data.pnj ?? []).filter(p => !(hideSecretPnj && window.vclIsSecretPnj(p))));
    if (typeof SETS        !== 'undefined' && _data.sets) Object.assign(SETS, _data.sets);
  },
};
