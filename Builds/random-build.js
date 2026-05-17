/* ══ random-build.js — Générateur de build aléatoire ══
   ES module importé dynamiquement depuis atelier.js
   Retourne un objet { slots: { slotId: itemObject } }
   conforme aux contraintes niveau/classe de l'atelier courant.
*/

const RARITY_WEIGHTS = {
  commun:    1,
  rare:      3,
  epique:    5,
  legendaire: 7,
  mythique:  6,
  godlike:   5,
  event:     3,
};

/**
 * Génère un build aléatoire pondéré par rareté.
 * @param {Array}   items    - tableau global ITEMS
 * @param {number}  level    - niveau actuel du joueur
 * @param {string|null} classId - id de classe actif, ou null
 * @returns {{ slots: { slotId: item } }}
 */
export function generateRandomBuild(items, level, classId) {
  const result = { slots: {} };

  // ALL_SLOTS est un global de Compendium/data.js
  const slots = window.ALL_SLOTS || [];

  slots.forEach(function(slot) {
    const candidates = items.filter(function(item) {
      // Catégorie du slot
      const cats = slot.cats || [];
      const itemCat = item.cat || item.category || '';
      if (!cats.includes(itemCat)) return false;

      // Contrainte niveau
      const reqLvl = item.lvl || 1;
      if (reqLvl > level) return false;

      // Ne pas inclure les runes dans les slots d'équipement
      if (itemCat === 'rune') return false;

      // Contrainte classe
      if (classId) {
        const classes = item.classes || item.class || [];
        if (Array.isArray(classes) && classes.length > 0 && !classes.includes(classId)) return false;
      }

      // Ignorer les items avec threshold attribut (trop complex à valider sans UI)
      if (item.threshold && Object.keys(item.threshold).length > 0) return false;

      return true;
    });

    if (!candidates.length) return;

    // Weighted random par rareté
    const totalWeight = candidates.reduce(function(sum, item) {
      return sum + (RARITY_WEIGHTS[item.rarity] || 1);
    }, 0);

    let r = Math.random() * totalWeight;
    let picked = candidates[0];
    for (let i = 0; i < candidates.length; i++) {
      r -= (RARITY_WEIGHTS[candidates[i].rarity] || 1);
      if (r <= 0) { picked = candidates[i]; break; }
    }

    result.slots[slot.id] = picked;
  });

  return result;
}
