/* ══════════════════════════════════════════════════════
   DRAG-ORDER — Réordonnancement drag-and-drop générique
   Remplace les ~6 implémentations dupliquées dans les panels de modération.

   Usage :
     import { DragOrder } from '../components/drag-order.js';

     const dnd = DragOrder.create(containerEl, items, {
       renderRow: (item, index) => `<strong>${item.name}</strong>`,
       onReorder: (newItems) => console.log(newItems),
       idKey:     '_id',     // défaut: '_id'
       orderKey:  'ordre',   // défaut: 'ordre'
     });

     dnd.getOrder();          // → [{ _id, ordre }, ...]
     dnd.setItems(newItems);  // remplace les données et re-render
     dnd.filter('loup');      // filtre visuel (cache les lignes non-matching)
══════════════════════════════════════════════════════ */

function _norm(s) {
  return String(s ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function ensureStyles() {
  if (document.getElementById('vcl-do-style')) return;
  const s = document.createElement('style');
  s.id = 'vcl-do-style';
  s.textContent = `
    .vcl-do-row {
      display:flex; align-items:center; gap:10px;
      padding:8px 10px; border-radius:6px; margin-bottom:4px;
      background:var(--surface2,#2a2a3a); border:1px solid transparent;
      cursor:grab; user-select:none; transition:border-color .1s, opacity .1s;
      font-family:'JetBrains Mono',monospace; font-size:13px; color:var(--text,#ddd);
    }
    .vcl-do-row:active  { cursor:grabbing; }
    .vcl-do-row.dragging { opacity:.45; }
    .vcl-do-row.over    { border-color:var(--accent,#7c5cbf); background:var(--surface,#1e1e2e); }
    .vcl-do-grip        { color:var(--muted,#888); font-size:14px; flex-shrink:0; line-height:1; }
    .vcl-do-content     { flex:1; min-width:0; }
  `;
  document.head.appendChild(s);
}

export class DragOrder {
  /**
   * @param {HTMLElement} container
   * @param {object[]} items
   * @param {{ renderRow?: function, onReorder?: function, idKey?: string, orderKey?: string }} opts
   */
  static create(container, items, opts = {}) {
    return new DragOrder(container, items, opts);
  }

  constructor(container, items, opts = {}) {
    ensureStyles();
    this._container = container;
    this._items     = [...items];
    this._opts      = {
      renderRow: (item) => `<span>${item.name ?? item._id ?? '?'}</span>`,
      onReorder: null,
      idKey:     '_id',
      orderKey:  'ordre',
      ...opts,
    };
    this._dragSrcIdx = null;
    this._render();
  }

  _render() {
    this._container.innerHTML = '';
    this._items.forEach((item, i) => this._renderRow(item, i));
  }

  _renderRow(item, i) {
    const row = document.createElement('div');
    row.className = 'vcl-do-row';
    row.draggable = true;
    row.dataset.idx = i;

    const grip = document.createElement('span');
    grip.className = 'vcl-do-grip';
    grip.textContent = '⠿';
    grip.title = 'Glisser pour réordonner';

    const content = document.createElement('div');
    content.className = 'vcl-do-content';
    content.innerHTML = this._opts.renderRow(item, i);

    row.appendChild(grip);
    row.appendChild(content);
    this._container.appendChild(row);

    row.addEventListener('dragstart', e => {
      this._dragSrcIdx = i;
      row.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
    });
    row.addEventListener('dragend', () => {
      row.classList.remove('dragging');
      this._container.querySelectorAll('.vcl-do-row').forEach(r => r.classList.remove('over'));
    });
    row.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this._container.querySelectorAll('.vcl-do-row').forEach(r => r.classList.remove('over'));
      row.classList.add('over');
    });
    row.addEventListener('dragleave', () => row.classList.remove('over'));
    row.addEventListener('drop', e => {
      e.preventDefault();
      const src = this._dragSrcIdx;
      const dst = parseInt(row.dataset.idx, 10);
      if (src === null || src === dst) return;
      const [moved] = this._items.splice(src, 1);
      this._items.splice(dst, 0, moved);
      this._render();
      this._opts.onReorder?.(this._items);
    });
  }

  // ── API publique ─────────────────────────────────────

  /**
   * Retourne l'ordre courant sous forme de liste plate.
   * @returns {{ [idKey]: string, [orderKey]: number }[]}
   */
  getOrder() {
    return this._items.map((item, i) => ({
      [this._opts.idKey]:    item[this._opts.idKey] ?? item._id,
      [this._opts.orderKey]: i + 1,
    }));
  }

  /** Remplace les données et re-render */
  setItems(items) {
    this._items = [...items];
    this._render();
  }

  /** Filtre visuel : cache les lignes qui ne matchent pas la query */
  filter(query) {
    const q = _norm(query);
    this._container.querySelectorAll('.vcl-do-row').forEach((row, i) => {
      const item  = this._items[i];
      const label = _norm(item?.name ?? item?.[this._opts.idKey] ?? '');
      row.style.display = (!q || label.includes(q)) ? '' : 'none';
    });
  }

  /** Réinitialise le filtre visuel */
  clearFilter() { this.filter(''); }
}
