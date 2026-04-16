/* ══════════════════════════════════════════════════════
   SEARCH-DROP — Autocomplete dropdown générique
   Remplace les ~6 implémentations dupliquées dans creator et modération.

   Usage :
     import { SearchDrop } from '../components/search-drop.js';

     const sd = SearchDrop.create(containerEl, {
       data:        store.mobs,         // tableau d'objets
       labelKey:    'name',             // clé affichée (défaut: 'name')
       valueKey:    '_id',              // clé utilisée comme identifiant (défaut: '_id')
       placeholder: 'Chercher un mob…',
       onSelect:    (item) => { ... },  // appelé quand l'utilisateur sélectionne
     });

     sd.getValue();        // → item sélectionné ou null
     sd.setValue(item);    // sélectionne programmatiquement
     sd.clear();           // réinitialise
     sd.setData(newData);  // mise à jour des données (ex. après chargement)
     sd.destroy();         // nettoie les event listeners, vide le container
══════════════════════════════════════════════════════ */

function _norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ensureStyles() {
  if (document.getElementById('vcl-sd-style')) return;
  const s = document.createElement('style');
  s.id = 'vcl-sd-style';
  s.textContent = `
    .vcl-sd-wrap { position:relative; }
    .vcl-sd-input {
      width:100%; box-sizing:border-box;
      background:var(--surface2,#2a2a3a); border:1px solid var(--border,#333);
      border-radius:6px; color:var(--text,#ddd);
      padding:6px 10px; font-size:13px;
      font-family:'JetBrains Mono',monospace;
      outline:none; transition:border-color .15s;
    }
    .vcl-sd-input:focus { border-color:var(--accent,#7c5cbf); }
    .vcl-sd-dropdown {
      position:absolute; left:0; right:0; top:calc(100% + 2px);
      background:var(--surface,#1e1e2e); border:1px solid var(--border,#333);
      border-radius:6px; max-height:220px; overflow-y:auto;
      z-index:1000; display:none;
    }
    .vcl-sd-item {
      padding:7px 10px; cursor:pointer; font-size:13px;
      font-family:'JetBrains Mono',monospace;
      color:var(--text,#ddd); border-bottom:1px solid var(--border,#222);
      transition:background .1s;
    }
    .vcl-sd-item:last-child { border-bottom:none; }
    .vcl-sd-item:hover, .vcl-sd-item.active { background:var(--surface2,#2a2a3a); }
    .vcl-sd-empty { padding:8px 10px; font-size:12px; color:var(--muted,#888); font-family:'JetBrains Mono',monospace; }
  `;
  document.head.appendChild(s);
}

export class SearchDrop {
  /**
   * @param {HTMLElement} container
   * @param {{ data?: object[], labelKey?: string, valueKey?: string, placeholder?: string,
   *           filterFn?: function, onSelect?: function, maxResults?: number }} opts
   */
  static create(container, opts = {}) {
    return new SearchDrop(container, opts);
  }

  constructor(container, opts = {}) {
    ensureStyles();
    this._container = container;
    this._opts = {
      labelKey:   'name',
      valueKey:   '_id',
      placeholder: 'Rechercher…',
      maxResults: 25,
      filterFn:   null,
      onSelect:   null,
      ...opts,
    };
    this._data   = opts.data ?? [];
    this._value  = null;
    this._active = -1;
    this._build();
  }

  _build() {
    this._container.classList.add('vcl-sd-wrap');

    this._input = document.createElement('input');
    this._input.type = 'text';
    this._input.className = 'vcl-sd-input';
    this._input.placeholder = this._opts.placeholder;

    this._drop = document.createElement('div');
    this._drop.className = 'vcl-sd-dropdown';

    this._container.appendChild(this._input);
    this._container.appendChild(this._drop);

    this._input.addEventListener('input',   () => this._update());
    this._input.addEventListener('focus',   () => this._update());
    this._input.addEventListener('keydown', e  => this._onKey(e));

    this._onDocClick = e => {
      if (!this._container.contains(e.target)) this._close();
    };
    document.addEventListener('click', this._onDocClick);
  }

  _update() {
    const q = this._input.value;
    const results = this._getResults(q);
    this._active = -1;

    if (!results.length) {
      this._drop.innerHTML = q
        ? `<div class="vcl-sd-empty">Aucun résultat pour « ${q} »</div>`
        : '';
      this._drop.style.display = q ? 'block' : 'none';
      return;
    }

    this._results = results;
    this._drop.innerHTML = results.map((item, i) => {
      const label = item[this._opts.labelKey] ?? '?';
      const id    = item[this._opts.valueKey] ?? '';
      return `<div class="vcl-sd-item" data-i="${i}" data-id="${id}">${label}</div>`;
    }).join('');
    this._drop.style.display = 'block';

    this._drop.querySelectorAll('.vcl-sd-item').forEach(el => {
      el.addEventListener('mousedown', e => {
        e.preventDefault(); // évite que onblur ferme avant le clic
        const idx = parseInt(el.dataset.i, 10);
        this._select(this._results[idx]);
      });
    });
  }

  _getResults(q) {
    const nq = _norm(q);
    if (!nq) return [];
    if (this._opts.filterFn) return this._opts.filterFn(this._data, nq).slice(0, this._opts.maxResults);
    return this._data
      .filter(item => _norm(item[this._opts.labelKey]).includes(nq))
      .slice(0, this._opts.maxResults);
  }

  _select(item) {
    this._value = item ?? null;
    this._input.value = item ? (item[this._opts.labelKey] ?? '') : '';
    this._close();
    this._opts.onSelect?.(item);
  }

  _close() {
    this._drop.style.display = 'none';
    this._active = -1;
  }

  _onKey(e) {
    const items = this._drop.querySelectorAll('.vcl-sd-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this._active = Math.min(this._active + 1, items.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this._active = Math.max(this._active - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (this._active >= 0 && this._results?.[this._active]) {
        this._select(this._results[this._active]);
      }
      return;
    } else if (e.key === 'Escape') {
      this._close(); return;
    }
    items.forEach((el, i) => el.classList.toggle('active', i === this._active));
    items[this._active]?.scrollIntoView({ block: 'nearest' });
  }

  // ── API publique ─────────────────────────────────────

  /** Item actuellement sélectionné, ou null */
  getValue() { return this._value; }

  /** Sélectionne programmatiquement un item (met à jour l'input) */
  setValue(item) {
    this._value = item ?? null;
    this._input.value = item ? (item[this._opts.labelKey] ?? '') : '';
  }

  /** Réinitialise la sélection et l'input */
  clear() { this._value = null; this._input.value = ''; this._close(); }

  /** Remplace les données de recherche */
  setData(data) { this._data = data ?? []; }

  /** Supprime les listeners et vide le container */
  destroy() {
    document.removeEventListener('click', this._onDocClick);
    this._container.innerHTML = '';
    this._container.classList.remove('vcl-sd-wrap');
  }
}
