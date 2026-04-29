const FLOOR_COUNT = 100;

const FLOOR_NAMES = {
  1: 'Villes Européennes',
  2: 'Désert Aride',
  3: 'Forêt Elfique'
};

const FLOOR_DATA = {
  1: { hasUnderground: true  },
  2: { hasUnderground: true },
  3: { hasUnderground: false },
};

const MAP_CALIBRATION = {
  1: {
    centerPixel: { x: 450,    y: 450   },
    centerGame:  { x: 2545.6, y: 2550 },
    radiusPixel: 450,
    radiusGame:  2498.1,
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