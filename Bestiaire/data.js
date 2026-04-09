/* ══════════════════════════════════
   DONNÉES — PERSONNAGES
   (data chargée depuis Firestore en production)
══════════════════════════════════ */
var PERSONNAGES = [];

const PNJ_TAG_LABELS = {
  forgeron_armes:       "Forgeron d'Armes",
  forgeron_armures:     "Forgeron d'Armures",
  forgeron_accessoires: "Forgeron d'Accessoires",
  forgeron_lingots:     "Forgeron de Lingots",
  fabricant_cles:       "Fabricant de Clés",
  fabricant_secrets:    "Fabricant Secrets",
  refaconneur:          "Refaçonneur",
  marchand_equipement:  "Marchand d'Équipement",
  marchand_consommable: "Marchand de Consommable",
  marchand_outils:      "Marchand d'Outils",
  marchand_accessoires: "Marchand d'Accessoires",
	marchand_itinerant: 	"Marchand Itinérant",
  repreneur_butin:      "Repreneur de Butin",
  bucheron:             "Bûcheron",
  alchimiste:           "Alchimiste",
  quetes:               "Quêtes",
  autre:                "Autre",
};
const PNJ_TAG_COLORS = {
  forgeron_armes:       '#c8783c',
  forgeron_armures:     '#f15e1a',
  forgeron_accessoires: '#f1b586',
  forgeron_lingots:     '#eed4a4',
  fabricant_cles:       '#f5ac4d',
  fabricant_secrets:    '#8b3c00',
  refaconneur:          '#6e543f',
  marchand_equipement:  '#c9a84c',
  marchand_consommable: '#b19b5f',
  marchand_outils:      '#a09472',
  marchand_accessoires: '#a8b34c',
	marchand_itinerant: 	'#1b4d1f',
  repreneur_butin:      '#8eb155',
  bucheron:             '#5aad64',
  alchimiste:           '#9b6bc9',
  quetes:               '#5899e0',
  autre:                '#7888a0',
};

const TYPE_LABELS     = { boss: 'Boss', mini_boss: 'Mini-Boss', monstre: 'Monstre', sbire: 'Sbire' };
const BEHAVIOR_LABELS = { passif: 'Passif', neutre: 'Neutre', agressif: 'Agressif' };
const DIFF_LABELS     = ['', 'Très facile', 'Facile', 'Moyen', 'Difficile', 'Très difficile'];

const TYPE_COLORS = {
  boss:    { bg: 'rgba(180,40,40,.85)',  text: '#ffc8c8', border: '#c0404055' },
  mini_boss:    { bg: 'rgba(212, 95, 60, 0.85)',  text: '#ffc8c8', border: '#c0404055' },
  monstre: { bg: 'rgba(160,80,20,.85)', text: '#ffd9a0', border: '#c06c2055' },
  sbire:   { bg: 'rgba(50,50,70,.85)',  text: '#b0b8d0', border: '#5055a055' },
};
const BEHAVIOR_COLORS = {
  passif:   '#346f2e',
  neutre:   '#d4c07a',
  agressif: '#df6262',
};
