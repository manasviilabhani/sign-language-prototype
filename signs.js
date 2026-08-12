/* signs.js — hand pose vocabulary
 *
 * A pose describes one static hand shape:
 *   f  : [index, middle, ring, pinky] each [mcp, pip, dip] flexion in degrees (0 = straight)
 *   s  : [index, middle, ring, pinky] spread in degrees, + = toward the thumb side of the screen
 *   th : [cmc, ip] thumb flexion in degrees
 *   ts : thumb abduction in degrees (higher = thumb further from the palm)
 *
 * The signer faces the viewer, so the dominant (right) hand appears on the
 * viewer's LEFT and the palm generally faces the viewer.
 */

(function () {
'use strict';

const ST = [0, 0, 0]; // straight
const FIST = [92, 100, 72]; // fully folded
const HALF = [72, 88, 44]; // folded to touch the thumb
const CURL = [36, 36, 22]; // relaxed C curve
const HOOK = [14, 92, 62]; // straight knuckle, bent tip
const CLAW = [26, 52, 34];

const DEFAULT_SPREAD = [7, 2, -3, -9];

function pose(o) {
  const p = {
    f: o.f,
    s: o.s || DEFAULT_SPREAD,
    th: o.th || [46, 34],
    ts: o.ts === undefined ? -6 : o.ts,
  };
  // Some letters are only correct at a specific wrist orientation.
  if (o.r !== undefined) p.r = o.r;
  return p;
}

/* ---------------------------------------------------------------- *
 * ASL manual alphabet + digits
 * ---------------------------------------------------------------- */

const POSES = {
  REST: pose({ f: [CURL, CURL, CURL, CURL], th: [22, 16], ts: 16 }),
  OPEN: pose({ f: [ST, ST, ST, ST], s: [16, 5, -6, -17], th: [4, 2], ts: 52 }),
  FLAT: pose({ f: [ST, ST, ST, ST], s: [3, 1, -2, -5], th: [40, 18], ts: -18 }),
  CLAW: pose({ f: [CLAW, CLAW, CLAW, CLAW], s: [14, 4, -5, -15], th: [18, 22], ts: 34 }),
  POINT: pose({ f: [ST, FIST, FIST, FIST], th: [54, 40], ts: -14 }),

  A: pose({ f: [FIST, FIST, FIST, FIST], th: [8, 4], ts: 6 }),
  B: pose({ f: [ST, ST, ST, ST], s: [3, 1, -2, -5], th: [66, 44], ts: -30 }),
  C: pose({ f: [CURL, CURL, CURL, CURL], s: [8, 3, -3, -9], th: [24, 20], ts: 28 }),
  D: pose({ f: [ST, HALF, HALF, HALF], s: [2, 6, -2, -9], th: [34, 26], ts: 20 }),
  E: pose({ f: [HALF, HALF, HALF, HALF], s: [4, 1, -2, -6], th: [62, 52], ts: -4 }),
  F: pose({ f: [[44, 54, 30], ST, ST, ST], s: [10, 4, -4, -12], th: [44, 30], ts: 24 }),
  G: pose({ f: [ST, FIST, FIST, FIST], th: [6, 2], ts: 58, r: -78 }),
  H: pose({ f: [ST, ST, FIST, FIST], s: [2, -1, -4, -10], th: [58, 44], ts: -16, r: -78 }),
  I: pose({ f: [FIST, FIST, FIST, ST], s: [6, 2, -3, -6], th: [58, 44], ts: -18 }),
  J: pose({ f: [FIST, FIST, FIST, ST], s: [6, 2, -3, -6], th: [58, 44], ts: -18 }),
  K: pose({ f: [ST, ST, FIST, FIST], s: [16, -3, -4, -10], th: [16, 8], ts: 10 }),
  L: pose({ f: [ST, FIST, FIST, FIST], th: [2, 0], ts: 78 }),
  M: pose({ f: [[80, 94, 54], [80, 94, 54], [80, 94, 54], FIST], th: [58, 46], ts: -16 }),
  N: pose({ f: [[80, 94, 54], [80, 94, 54], FIST, FIST], th: [58, 46], ts: -14 }),
  O: pose({ f: [[48, 54, 40], [48, 54, 40], [48, 54, 40], [48, 54, 40]], s: [8, 3, -3, -9], th: [40, 36], ts: 32 }),
  P: pose({ f: [ST, ST, FIST, FIST], s: [16, -3, -4, -10], th: [16, 8], ts: 10, r: 152 }),
  Q: pose({ f: [ST, FIST, FIST, FIST], th: [6, 2], ts: 58, r: 158 }),
  R: pose({ f: [[6, 3, 0], [8, 5, 0], FIST, FIST], s: [-11, 12, -4, -10], th: [58, 44], ts: -16 }),
  S: pose({ f: [FIST, FIST, FIST, FIST], th: [64, 58], ts: -22 }),
  T: pose({ f: [[76, 94, 58], FIST, FIST, FIST], th: [38, 18], ts: 4 }),
  U: pose({ f: [ST, ST, FIST, FIST], s: [2, -2, -4, -10], th: [58, 44], ts: -16 }),
  V: pose({ f: [ST, ST, FIST, FIST], s: [15, -9, -4, -10], th: [58, 44], ts: -16 }),
  W: pose({ f: [ST, ST, ST, FIST], s: [18, 1, -16, -8], th: [56, 46], ts: -12 }),
  X: pose({ f: [HOOK, FIST, FIST, FIST], th: [58, 44], ts: -16 }),
  Y: pose({ f: [FIST, FIST, FIST, ST], s: [6, 2, -3, -16], th: [2, 0], ts: 82 }),
  Z: pose({ f: [ST, FIST, FIST, FIST], th: [54, 40], ts: -14 }),

  '0': pose({ f: [[48, 54, 40], [48, 54, 40], [48, 54, 40], [48, 54, 40]], th: [40, 36], ts: 32 }),
  '1': pose({ f: [ST, FIST, FIST, FIST], th: [54, 40], ts: -14 }),
  '2': pose({ f: [ST, ST, FIST, FIST], s: [15, -9, -4, -10], th: [58, 44], ts: -16 }),
  '3': pose({ f: [ST, ST, FIST, FIST], s: [15, -9, -4, -10], th: [2, 0], ts: 74 }),
  '4': pose({ f: [ST, ST, ST, ST], s: [14, 4, -5, -15], th: [64, 50], ts: -24 }),
  '5': pose({ f: [ST, ST, ST, ST], s: [16, 5, -6, -17], th: [4, 2], ts: 52 }),
  '6': pose({ f: [ST, ST, ST, [50, 44, 26]], s: [14, 4, -5, -13], th: [40, 34], ts: 26 }),
  '7': pose({ f: [ST, ST, [50, 44, 26], ST], s: [14, 4, -6, -14], th: [40, 34], ts: 24 }),
  '8': pose({ f: [ST, [50, 44, 26], ST, ST], s: [14, 4, -5, -15], th: [42, 34], ts: 22 }),
  '9': pose({ f: [[44, 54, 30], ST, ST, ST], s: [10, 4, -4, -12], th: [44, 30], ts: 24 }),
};

/* ---------------------------------------------------------------- *
 * Stage anchors — virtual 400 x 520 space, signer facing the viewer
 * ---------------------------------------------------------------- */

/* Anchors are WRIST positions, not contact points: the hand is drawn extending
 * roughly 95 stage-units up from the wrist, so a sign that touches the chin
 * puts the wrist down around the collarbone. */
const A_ = {
  spell: [126, 258],   // neutral window, kept clear of the face
  forehead: [156, 158],
  temple: [150, 176],
  eye: [162, 184],
  nose: [178, 206],
  chin: [176, 240],
  mouth: [176, 222],
  cheek: [148, 212],
  neck: [176, 256],
  chest: [172, 302],
  belly: [176, 350],
  side: [110, 330],
  out: [88, 260],
  rest: [140, 416],
};

// keyframe: pose name, wrist [x, y], wrist rotation, hold ms, optional face
// override (used when a marker has to alternate inside one sign, e.g. a shake)
function kf(p, xy, r, d, fc) {
  return { p, x: xy[0], y: xy[1], r: r || 0, d: d === undefined ? 260 : d, fc };
}
function at(anchor, dx, dy) {
  return [A_[anchor][0] + (dx || 0), A_[anchor][1] + (dy || 0)];
}

/* ---------------------------------------------------------------- *
 * Word signs
 *
 * These are readable approximations of real ASL signs rendered with a
 * single dominant hand. Two-handed signs are marked and shown with the
 * dominant hand only — see the note in the UI.
 * ---------------------------------------------------------------- */

const VOCAB = {
  HELLO: { face: 'smile', frames: [kf('B', at('forehead', 10, 4), -18, 220), kf('B', at('forehead', -46, -6), -34, 240)] },
  HI: { alias: 'HELLO' },
  BYE: { face: 'smile',
    frames: [
      kf('OPEN', at('temple', -30, -10), -10, 160),
      kf('FLAT', at('temple', -30, -10), -10, 140),
      kf('OPEN', at('temple', -30, -10), -10, 140),
      kf('FLAT', at('temple', -30, -10), -10, 200),
    ],
  },
  GOODBYE: { alias: 'BYE' },
  THANK: { face: 'smile',
    frames: [kf('FLAT', at('chin', 4, 2), 6, 240), kf('FLAT', at('chin', -20, 52), 22, 260)],
  },
  THANKS: { alias: 'THANK' },
  'THANK-YOU': { alias: 'THANK' },
  'SIGN-LANGUAGE': { alias: 'LANGUAGE' },
  'GOOD-BYE': { alias: 'BYE' },
  PLEASE: { face: 'polite',
    two: false,
    frames: [
      kf('FLAT', at('chest', 0, -14), 8, 180),
      kf('FLAT', at('chest', 22, 6), 8, 160),
      kf('FLAT', at('chest', 0, 24), 8, 160),
      kf('FLAT', at('chest', -20, 4), 8, 160),
      kf('FLAT', at('chest', 0, -12), 8, 200),
    ],
  },
  SORRY: { face: 'sorry',
    frames: [
      kf('A', at('chest', 0, -16), 6, 180),
      kf('A', at('chest', 20, 4), 6, 150),
      kf('A', at('chest', 0, 22), 6, 150),
      kf('A', at('chest', -18, 2), 6, 150),
      kf('A', at('chest', 0, -14), 6, 200),
    ],
  },
  YES: { face: 'aff',
    frames: [
      kf('S', at('spell', 10, -12), -6, 180, 'affUp'),
      kf('S', at('spell', 10, -4), 30, 170, 'affDown'),
      kf('S', at('spell', 10, -12), -6, 170, 'affUp'),
      kf('S', at('spell', 10, -4), 30, 200, 'affDown'),
    ],
  },
  NO: { face: 'neg',
    frames: [
      kf('V', at('spell', 8, -8), -4, 200, 'negL'),
      kf('O', at('spell', 8, -8), -4, 200, 'negR'),
      kf('V', at('spell', 8, -8), -4, 180, 'negL'),
      kf('O', at('spell', 8, -8), -4, 220, 'negR'),
    ],
  },
  I: { frames: [kf('POINT', at('chest', 6, -4), 74, 420)] },
  ME: { alias: 'I' },
  MY: { frames: [kf('FLAT', at('chest', 4, -2), 76, 420)] },
  MINE: { alias: 'MY' },
  YOU: { frames: [kf('POINT', at('spell', 34, -6), -6, 420)] },
  YOUR: { frames: [kf('FLAT', at('spell', 34, -6), -6, 420)] },
  WE: {
    frames: [kf('POINT', at('chest', 26, -30), 40, 200), kf('POINT', at('chest', -26, -30), -40, 260)],
  },
  NAME: {
    two: true,
    frames: [
      kf('U', at('chest', 0, -46), 22, 190),
      kf('U', at('chest', 0, -34), 22, 170),
      kf('U', at('chest', 0, -46), 22, 170),
      kf('U', at('chest', 0, -34), 22, 200),
    ],
  },
  HELP: { face: 'polite',
    two: true,
    frames: [kf('A', at('chest', 0, 24), 0, 220), kf('A', at('chest', 0, -18), 0, 280)],
  },
  LOVE: { face: 'smile',
    two: true,
    frames: [kf('S', at('chest', 24, -20), -30, 200), kf('S', at('chest', 2, -6), -30, 380)],
  },
  GOOD: { face: 'smile',
    frames: [kf('FLAT', at('chin', 2, -4), 8, 220), kf('FLAT', at('chin', -8, 60), 14, 260)],
  },
  BAD: { face: 'sad',
    frames: [kf('FLAT', at('chin', 2, -4), 8, 220), kf('FLAT', at('chin', -14, 74), 168, 260)],
  },
  HAPPY: { face: 'happy',
    frames: [
      kf('FLAT', at('chest', 0, 22), -22, 170),
      kf('FLAT', at('chest', 6, -18), -22, 170),
      kf('FLAT', at('chest', 0, 22), -22, 170),
      kf('FLAT', at('chest', 6, -18), -22, 220),
    ],
  },
  SAD: { face: 'sad',
    frames: [kf('OPEN', at('eye', 6, -28), 4, 220), kf('OPEN', at('eye', 0, 46), 4, 300)],
  },
  ANGRY: { face: 'angry',
    frames: [kf('CLAW', at('belly', 0, -34), 4, 220), kf('CLAW', at('chest', -6, -46), 4, 300)],
  },
  TIRED: { face: 'sleepy',
    frames: [kf('CLAW', at('chest', 4, -34), -14, 240), kf('CLAW', at('chest', -4, 6), 18, 300)],
  },
  HUNGRY: { face: 'mm',
    frames: [kf('C', at('neck', -2, -10), 4, 220), kf('C', at('chest', -4, 34), 4, 320)],
  },
  EAT: { face: 'mm',
    frames: [
      kf('O', at('mouth', 34, 26), -14, 180),
      kf('O', at('mouth', 4, 2), -14, 170),
      kf('O', at('mouth', 34, 26), -14, 170),
      kf('O', at('mouth', 4, 2), -14, 200),
    ],
  },
  FOOD: { alias: 'EAT' },
  DRINK: { face: 'oo',
    frames: [kf('C', at('mouth', 26, 30), -10, 220), kf('C', at('mouth', 4, 6), -40, 280)],
  },
  WATER: { face: 'mm',
    frames: [
      kf('W', at('chin', 6, -6), -6, 190),
      kf('W', at('chin', 6, 8), -6, 160),
      kf('W', at('chin', 6, -6), -6, 160),
      kf('W', at('chin', 6, 8), -6, 200),
    ],
  },
  MORE: { face: 'mm',
    two: true,
    frames: [kf('O', at('chest', 30, -30), -18, 200), kf('O', at('chest', 4, -22), -18, 200), kf('O', at('chest', 30, -30), -18, 240)],
  },
  STOP: { face: 'neg',
    two: true,
    frames: [kf('FLAT', at('chest', -14, -60), -4, 200), kf('FLAT', at('chest', -6, -6), -4, 300)],
  },
  GO: {
    frames: [kf('POINT', at('chest', 34, -50), 30, 200), kf('POINT', at('chest', -34, -20), 46, 280)],
  },
  COME: {
    frames: [kf('POINT', at('chest', -30, -50), -40, 200), kf('POINT', at('chest', 26, -16), -10, 280)],
  },
  HOME: { face: 'smile',
    frames: [kf('O', at('mouth', 20, 14), -14, 240), kf('O', at('cheek', -12, -14), -14, 280)],
  },
  SCHOOL: {
    two: true,
    frames: [kf('FLAT', at('chest', 0, -50), -30, 190), kf('FLAT', at('chest', 0, -14), -6, 170), kf('FLAT', at('chest', 0, -50), -30, 170), kf('FLAT', at('chest', 0, -14), -6, 200)],
  },
  WORK: { face: 'mm',
    two: true,
    frames: [kf('S', at('chest', -4, -50), 12, 190), kf('S', at('chest', -4, -16), 12, 170), kf('S', at('chest', -4, -50), 12, 170), kf('S', at('chest', -4, -16), 12, 200)],
  },
  FRIEND: { face: 'smile',
    two: true,
    frames: [kf('X', at('chest', 4, -40), 30, 240), kf('X', at('chest', 4, -40), 150, 300)],
  },
  FAMILY: { face: 'smile',
    two: true,
    frames: [kf('F', at('chest', 30, -50), -10, 200), kf('F', at('chest', -18, -30), -10, 300)],
  },
  WHAT: { face: 'wh',
    frames: [kf('POINT', at('chest', 40, -40), -12, 190), kf('POINT', at('chest', -20, -34), -12, 190), kf('POINT', at('chest', 40, -40), -12, 220)],
  },
  WHERE: { face: 'wh',
    frames: [
      kf('POINT', at('spell', 18, -14), -14, 160),
      kf('POINT', at('spell', -12, -14), 14, 150),
      kf('POINT', at('spell', 18, -14), -14, 150),
      kf('POINT', at('spell', -12, -14), 14, 190),
    ],
  },
  WHO: { face: 'wh',
    frames: [kf('L', at('chin', 10, 4), -20, 200), kf('L', at('chin', 2, 12), -6, 200), kf('L', at('chin', 10, 4), -20, 220)],
  },
  WHY: { face: 'wh',
    frames: [kf('POINT', at('forehead', 8, 10), -16, 220), kf('Y', at('forehead', -18, 56), -30, 280)],
  },
  WHEN: { face: 'wh',
    frames: [kf('POINT', at('spell', 24, -14), -10, 200), kf('POINT', at('spell', -2, -30), -10, 180), kf('POINT', at('spell', -2, -4), -10, 220)],
  },
  HOW: { face: 'wh',
    two: true,
    frames: [kf('A', at('chest', 0, -30), 160, 220), kf('FLAT', at('chest', 0, -34), 100, 280)],
  },
  NOW: {
    two: true,
    frames: [kf('Y', at('chest', 0, -60), 4, 200), kf('Y', at('chest', 0, -18), 4, 280)],
  },
  TODAY: { alias: 'NOW' },
  TOMORROW: {
    frames: [kf('A', at('chin', 22, 2), 12, 220), kf('A', at('chin', 10, -22), -22, 280)],
  },
  YESTERDAY: {
    frames: [kf('A', at('chin', 16, 6), 10, 220), kf('A', at('cheek', -6, -18), 10, 280)],
  },
  SLEEP: { face: 'sleepy',
    frames: [kf('OPEN', at('eye', 8, -30), 4, 220), kf('O', at('chin', -4, 6), 4, 300)],
  },
  LEARN: { face: 'mm',
    two: true,
    frames: [kf('CLAW', at('chest', 4, 10), -4, 200), kf('O', at('forehead', -6, 24), -10, 300)],
  },
  UNDERSTAND: { face: 'aha',
    frames: [kf('S', at('forehead', 4, 12), -8, 220), kf('POINT', at('forehead', 4, 4), -8, 280)],
  },
  KNOW: {
    frames: [kf('FLAT', at('forehead', 24, 30), -34, 200), kf('FLAT', at('forehead', 6, 14), -34, 280)],
  },
  WANT: { face: 'mm',
    two: true,
    frames: [kf('CLAW', at('chest', -22, -34), -4, 220), kf('CLAW', at('chest', 14, -22), -4, 300)],
  },
  SIGN: {
    two: true,
    frames: [
      kf('POINT', at('chest', 26, -54), -20, 180),
      kf('POINT', at('chest', -6, -22), 20, 180),
      kf('POINT', at('chest', 26, -54), -20, 180),
      kf('POINT', at('chest', -6, -22), 20, 210),
    ],
  },
  LANGUAGE: {
    two: true,
    frames: [kf('L', at('chest', 22, -40), -10, 200), kf('L', at('chest', -18, -26), -10, 300)],
  },
  DEAF: {
    frames: [kf('POINT', at('eye', 4, 6), -10, 220), kf('POINT', at('chin', -6, 6), -10, 260)],
  },
  PEOPLE: {
    two: true,
    frames: [kf('P', at('chest', 12, -50), 160, 200), kf('P', at('chest', 12, -14), 160, 200), kf('P', at('chest', 12, -50), 160, 240)],
  },
  OK: { face: 'smile', frames: [kf('O', at('spell', 10, -30), -8, 200), kf('K', at('spell', 10, -30), -8, 260)] },

  // Grammatical signs the gloss layer inserts
  NOT: { face: 'neg',
    frames: [kf('A', at('chin', 8, -2), 4, 200), kf('A', at('chin', -14, 44), -16, 260)],
  },
  FINISH: { face: 'mm',
    two: true,
    frames: [
      kf('OPEN', at('chest', 10, -34), -40, 190),
      kf('OPEN', at('chest', -4, -26), 34, 180),
      kf('OPEN', at('chest', 10, -34), -40, 180),
      kf('OPEN', at('chest', -4, -26), 34, 220),
    ],
  },
  FINISHED: { alias: 'FINISH' },
  FUTURE: {
    frames: [kf('FLAT', at('cheek', 10, -4), -6, 200), kf('FLAT', at('cheek', -30, -22), -22, 250)],
  },
  SEE: {
    frames: [kf('V', at('eye', 10, 12), -8, 200), kf('V', at('eye', -22, -4), -8, 280)],
  },
};

// Alias resolution
for (const k of Object.keys(VOCAB)) {
  if (VOCAB[k].alias) VOCAB[k] = VOCAB[VOCAB[k].alias];
}

const FINGERSPELL_MOTION = {
  // Letters that carry motion in real ASL; extra keyframes are appended.
  J: [
    kf('J', at('spell', 6, -20), -6, 150),
    kf('J', at('spell', 6, 6), 6, 140),
    kf('J', at('spell', -14, 16), 34, 180),
  ],
  Z: [
    kf('Z', at('spell', -12, -30), -6, 120),
    kf('Z', at('spell', 16, -30), -6, 110),
    kf('Z', at('spell', -12, 2), -6, 110),
    kf('Z', at('spell', 16, 2), -6, 160),
  ],
};

const NUMBER_WORDS = {
  ZERO: '0', ONE: '1', TWO: '2', THREE: '3', FOUR: '4',
  FIVE: '5', SIX: '6', SEVEN: '7', EIGHT: '8', NINE: '9',
};

window.SL = { POSES, VOCAB, A_, FINGERSPELL_MOTION, NUMBER_WORDS, kf, at };

})();
