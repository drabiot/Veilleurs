/* Champs numériques : pas de flèches de la souris ni de molette (source de clics et de changements accidentels).
   Le clavier (↑ ↓) et les boutons − / + propres à chaque formulaire continuent de fonctionner. */
(function () {
  const st = document.createElement('style');
  st.textContent = 'input[type=number]{-moz-appearance:textfield;appearance:textfield}' +
    'input[type=number]::-webkit-inner-spin-button,input[type=number]::-webkit-outer-spin-button{-webkit-appearance:none;margin:0;display:none}';
  document.head.appendChild(st);
  document.addEventListener('wheel', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'number' && document.activeElement === t) t.blur();
  }, { passive: true, capture: true });
})();
