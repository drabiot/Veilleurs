/* ══════════════════════════════════════════════════════
   STORE — Source unique de données (remplace db-loader.js + compendium-init.js)

   Usage dans chaque page :
     import { store } from '../store.js';       // ou './store.js' depuis la racine
     await store.load(['items', 'mobs']);
     console.log(store.items);                  // tableau désanitisé

   Après une écriture en modération :
     store.invalidate('items');                 // force re-fetch au prochain load()
══════════════════════════════════════════════════════ */

import { loadCollection, invalidateCache, COL } from './firebase.js';

// Correspondance nom logique → nom collection Firestore
const COL_MAP = {
  items:      COL.items,
  mobs:       COL.mobs,
  pnj:        COL.pnj,
  regions:    COL.regions,
  quetes:     COL.quetes,
  panoplies:  COL.panoplies,
  mapMarkers: COL.mapMarkers,
};

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
  /** Panoplies indexées par id — compatible avec le global SETS des pages legacy */
  get sets()      { return _data.sets      ?? {}; },

  // ── Chargement ──────────────────────────────────────

  /**
   * Charge les collections demandées en parallèle depuis Firestore (avec cache TTL 1h).
   * @param {string[]} cols  ex. ['items', 'mobs', 'panoplies']
   */
  async load(cols) {
    const toLoad = [...new Set(cols)];
    const results = await Promise.all(
      toLoad.map(c => loadCollection(COL_MAP[c] ?? c).catch(() => []))
    );
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

  // ── Compat legacy ────────────────────────────────────

  /**
   * Peuple les variables globales utilisées par les scripts classiques non encore migrés.
   * Appeler après store.load() si la page utilise encore ITEMS, MOBS, PERSONNAGES, SETS.
   */
  populateGlobals() {
    if (typeof ITEMS       !== 'undefined') ITEMS.push(...(_data.items     ?? []));
    if (typeof MOBS        !== 'undefined') MOBS.push(...(_data.mobs      ?? []));
    if (typeof PERSONNAGES !== 'undefined') PERSONNAGES.push(...(_data.pnj  ?? []));
    if (typeof SETS        !== 'undefined' && _data.sets) Object.assign(SETS, _data.sets);
  },
};
