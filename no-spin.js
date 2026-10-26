/* Champs numériques : pas de flèches de la souris ni de molette (source de clics et de changements accidentels).
   À la place, chaque champ reçoit des boutons − / + (comme dans le Creator). Le clavier (↑ ↓) continue de fonctionner.
   Pour exclure un champ : attribut data-nostep. */
(function () {
  const st = document.createElement('style');
  st.textContent =
    'input[type=number]{-moz-appearance:textfield;appearance:textfield}' +
    'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;display:none}' +
    '.vcl-step{display:inline-flex;align-items:stretch;min-width:0;max-width:100%}' +
    '.vcl-step>input[type=number]{flex:1 1 auto;min-width:36px;width:auto;border-radius:0!important;border-left:0!important;border-right:0!important}' +
    '.vcl-step-btn{flex:0 0 26px;padding:0;cursor:pointer;font-size:15px;line-height:1;font-family:inherit;background:var(--surface2,#1f1b15);color:var(--text,#e8dcc0);border:1px solid var(--border,#3a3126);transition:background .12s,color .12s,border-color .12s}' +
    '.vcl-step-btn:first-child{border-radius:6px 0 0 6px}.vcl-step-btn:last-child{border-radius:0 6px 6px 0}' +
    '.vcl-step-btn:hover{background:var(--surface,#14110d);color:var(--accent,#c9a84c);border-color:var(--accent,#c9a84c)}' +
    '.vcl-step-btn:active{transform:translateY(1px)}';
  document.head.appendChild(st);

  document.addEventListener('wheel', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'number' && document.activeElement === t) t.blur();
  }, { passive: true, capture: true });

  function step(input, dir) {
    const stp = parseFloat(input.step) > 0 ? parseFloat(input.step) : 1;
    const min = input.min !== '' ? parseFloat(input.min) : -Infinity;
    const max = input.max !== '' ? parseFloat(input.max) : Infinity;
    const cur = parseFloat(input.value);
    let v = isNaN(cur) ? (dir > 0 ? Math.max(min, 0) + (min > 0 ? 0 : stp) : Math.min(max, min === -Infinity ? 0 : min)) : cur + dir * stp;
    v = Math.min(max, Math.max(min, v));
    input.value = String(Math.round(v * 1e6) / 1e6);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function wrap(input) {
    if (input.dataset.nostep !== undefined || input.dataset.stepped || input.closest('.qty-stepper, .vcl-step')) return;
    if (input.type !== 'number' || !input.parentNode) return;
    input.dataset.stepped = '1';
    const w = document.createElement('span');
    w.className = 'vcl-step';
    const cs = getComputedStyle(input);
    // le wrapper reprend la place du champ dans la mise en page (largeur, flex, grille)
    if (input.style.width) w.style.width = input.style.width;
    else if (cs.display !== 'inline' && cs.display !== 'inline-block') w.style.width = '100%';
    if (input.style.flex || cs.flexGrow !== '0') w.style.flex = cs.flex;
    if (input.style.gridColumn) w.style.gridColumn = input.style.gridColumn;
    if (cs.display === 'none') w.style.display = 'none';
    const mk = (t, d, title) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'vcl-step-btn'; b.textContent = t; b.title = title; b.tabIndex = -1;
      b.addEventListener('mousedown', e => e.preventDefault());
      b.addEventListener('click', e => { e.stopPropagation(); if (!input.disabled && !input.readOnly) step(input, d); });
      return b;
    };
    input.parentNode.insertBefore(w, input);
    w.appendChild(mk('−', -1, 'Diminuer'));
    w.appendChild(input);
    w.appendChild(mk('+', 1, 'Augmenter'));
  }

  // Pas de propositions d'autocomplétion du navigateur (valeurs déjà tapées, adresses…) : elles masquent les champs et n'ont aucun sens ici.
  const ADDR = /region|adresse|address|ville|city|pays|country|zip|postal|tel|phone|mail|name|nom|code|user|pseudo/i;
  function noFill(el) {
    if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLFormElement)) return;
    if (el instanceof HTMLInputElement && /^(password|checkbox|radio|file|hidden|button|submit|range|color)$/.test(el.type)) return;
    if (el.dataset.autofill !== undefined) return;
    if (['modal-email', 'modal-password', 'reg-pseudo', 'reg-email'].includes(el.id)) return; // connexion : le navigateur peut proposer l'identifiant
    const hint = (el.id || '') + ' ' + (el.name || '') + ' ' + (el.getAttribute('placeholder') || '');
    el.setAttribute('autocomplete', ADDR.test(hint) ? 'off-' + Math.random().toString(36).slice(2, 8) : 'off'); // valeur inconnue : Chrome / Brave ignorent « off » pour les champs qui ressemblent à une adresse
    if (el instanceof HTMLInputElement && el.type === 'search') el.setAttribute('autocomplete', 'off');
  }

  function scan(root) {
    if (root.nodeType === 1) noFill(root);
    root.querySelectorAll && root.querySelectorAll('input,textarea,form').forEach(noFill);
    if (root.nodeType !== 1 && root.nodeType !== 11) return;
    if (root.matches && root.matches('input[type=number]')) wrap(root);
    root.querySelectorAll && root.querySelectorAll('input[type=number]').forEach(wrap);
  }
  function start() {
    scan(document.body);
    new MutationObserver(ms => { for (const m of ms) m.addedNodes.forEach(scan); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
