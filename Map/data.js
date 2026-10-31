const FLOOR_COUNT = 100;

var FLOOR_NAMES = { // var pour permettre la mise à jour depuis Firestore (config/paliers)
  1: 'Villes Européennes',
  2: 'Désert Aride',
  3: 'Forêt Elfique'
};

const FLOOR_DATA = {
  1: { hasUnderground: true, hasDungeon: false },
  2: { hasUnderground: true, hasDungeon: false },
  3: { hasUnderground: true, hasDungeon: false },
};

const MAP_CALIBRATION = {
  1: {
    // Image 4952 px (source SAO-MC-Interactive-Map) = ancienne image 5000 px recadrée en (39,21), échelle 1:1.
    // Repère de jeu inchangé : les marqueurs existants restent exactement au même endroit.
    centerPixel: { x: 447.274, y: 450.545 },
    centerGame:  { x: 2545.6, y: 2550 },
    radiusPixel: 450,
    radiusGame:  2474.118,
  },
  2: {
    centerPixel: { x: 450,  y: 450 },
    centerGame:  { x: -1.3, y: 0.8 },
    radiusPixel: 450,
    radiusGame:  1072.5,
  },
  3: {
    centerPixel: { x: 450,  y: 450 },
    centerGame:  { x: 597, y: 771 },
    radiusPixel: 450,
    radiusGame:  850,
  },
};