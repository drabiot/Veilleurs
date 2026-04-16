/* ══════════════════════════════════════════════════════
   LINKS — URLs inter-pages canoniques
   Source unique de vérité pour tous les liens entre pages.

   Usage (module ES) :
     import { LINKS } from '../links.js';
     anchor.href = LINKS.mob('loup_sinistre_blanc');

   La racine est dérivée automatiquement depuis l'URL de ce fichier,
   ce qui fonctionne aussi bien en dev (file://) qu'en production.
══════════════════════════════════════════════════════ */

// URL racine du wiki (ex. https://drabiot.github.io/Veilleurs/)
const ROOT = new URL('.', import.meta.url).href;

export const LINKS = {
  /** Fiche item dans le Compendium */
  item:   (id) => `${ROOT}Compendium/compendium.html#item/${id}`,

  /** Fiche mob dans le Bestiaire */
  mob:    (id) => `${ROOT}Bestiaire/bestiaire.html#monstres/${id}`,

  /** Fiche PNJ dans le Bestiaire */
  pnj:    (id) => `${ROOT}Bestiaire/bestiaire.html#personnages/${id}`,

  /** Fiche quête */
  quest:  (id) => `${ROOT}Quetes/quetes.html#${id}`,

  /** Région sur la carte */
  region: (id) => `${ROOT}Map/map.html#region/${id}`,
};
