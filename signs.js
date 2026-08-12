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
  spell: [126, 258, 0.30],   // neutral window, kept clear of the face
  forehead: [156, 158, 0.13],
  temple: [150, 176, 0.13],
  eye: [162, 184, 0.14],
  nose: [178, 206, 0.15],
  chin: [176, 240, 0.15],
  mouth: [176, 222, 0.15],
  cheek: [148, 212, 0.13],
  neck: [176, 256, 0.17],
  chest: [172, 302, 0.18],
  belly: [176, 350, 0.19],
  side: [110, 330, 0.22],
  out: [88, 260, 0.42],
  rest: [126, 402, 0.10],
  rest2: [274, 402, 0.10],   // non-dominant hand at rest
};
const DEFAULT_Z = 0.26;

/* Palm facing. ASL distinguishes signs by which way the palm points, and a
 * flat drawing can only express that as the hand's chirality: the same
 * outline read as a palm or as the back of a hand. So it has to be carried,
 * not assumed. `out` faces the addressee — the whole manual alphabet is
 * signed this way — and `in` faces the signer, which is most signs that
 * contact the body: THANK-YOU leaves the chin with the palm inwards, so the
 * viewer sees the back of the hand.
 *
 * Real signs also use palm-up, palm-down and every angle between, and this
 * renderer has no way to show those; they fall on whichever side of the
 * flip is closer. See the palm-orientation caveat in the README. */
const PALM = { out: 1, in: -1 };
const PALM_DEFAULT = PALM.out;   // fingerspelling, and anything unmarked
/* Hands hanging at the sides are a case the two facings cannot actually
 * describe: the palms face the thighs and the thumbs point forwards, straight
 * at the viewer, which is neither. With the fingers curled there is nothing to
 * tell the two apart anyway except which side the thumb falls on, so this is
 * chosen for that: it tucks the thumbs towards the body, where a thumb
 * pointing forwards reads. The other facing splays them outwards and the arms
 * look put on backwards. */
const PALM_REST = PALM.out;

function facing(v, fallback) {
  if (v === undefined || v === null) return fallback;
  if (typeof v === 'number') return v < 0 ? PALM.in : PALM.out;
  return PALM[v] === undefined ? fallback : PALM[v];
}

// keyframe: pose name, wrist [x, y], wrist rotation, hold ms, optional face
// override (used when a marker has to alternate inside one sign, e.g. a shake),
// optional palm facing for this frame alone (a sign that turns the hand over)
function kf(p, xy, r, d, fc, pm) {
  return {
    p, x: xy[0], y: xy[1], z: xy[2] === undefined ? DEFAULT_Z : xy[2],
    r: r || 0, d: d === undefined ? 260 : d, fc,
    pm: facing(pm, undefined),
  };
}
function at(anchor, dx, dy, dz) {
  const a = A_[anchor];
  return [a[0] + (dx || 0), a[1] + (dy || 0), (a[2] === undefined ? DEFAULT_Z : a[2]) + (dz || 0)];
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
  I: { frames: [kf('POINT', at('chest', 22, -20), 66, 170), kf('POINT', at('chest', 6, -4), 74, 400)] },
  ME: { alias: 'I' },
  MY: { frames: [kf('FLAT', at('chest', 26, -22), 68, 170), kf('FLAT', at('chest', 4, -2), 76, 400)] },
  MINE: { alias: 'MY' },
  YOU: { frames: [kf('POINT', at('spell', 8, -2), -6, 160), kf('POINT', at('spell', 34, -6), -6, 400)] },
  YOUR: { frames: [kf('FLAT', at('spell', 6, -2), -6, 160), kf('FLAT', at('spell', 34, -6), -6, 400)] },
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
  // FINISH turns the hands over — they start facing the signer and flip out.
  // That flip is the sign, so the palm is set per keyframe rather than once.
  FINISH: { face: 'mm',
    two: true,
    frames: [
      kf('OPEN', at('chest', 10, -34), -40, 190, undefined, 'in'),
      kf('OPEN', at('chest', -4, -26), 34, 180, undefined, 'out'),
      kf('OPEN', at('chest', 10, -34), -40, 180, undefined, 'in'),
      kf('OPEN', at('chest', -4, -26), 34, 220, undefined, 'out'),
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

/* Which of these signs are made with the palm towards the signer, so the
 * viewer sees the back of the hand. Anything not listed faces the addressee,
 * which is also what fingerspelling does.
 *
 * Read this list as "the nearer of two options", not as a description. A lot
 * of these signs are really palm-up, palm-down, or edge-on to the viewer —
 * WATER taps the chin with the palm facing sideways, HELP rests on an upturned
 * base hand — and a flat renderer has only the two facings to put them in.
 * Aliases inherit from their target and are not repeated. Sourced from the
 * same grammar references as the rest, and unverified by a Deaf signer. */
const PALM_IN_SIGNS = `
  THANK PLEASE SORRY I ME MY WE NAME HELP LOVE GOOD BAD HAPPY SAD ANGRY TIRED
  HUNGRY EAT FOOD DRINK WATER MORE COME HOME SCHOOL FRIEND WHO WHY HOW NOW
  TODAY TOMORROW YESTERDAY SLEEP LEARN UNDERSTAND KNOW WANT DEAF NOT FUTURE SEE
`.trim().split(/\s+/);

for (const name of PALM_IN_SIGNS) {
  if (!VOCAB[name]) throw new Error('palm facing set for unknown sign: ' + name);
  VOCAB[name].palm = 'in';
}


/* ---------------------------------------------------------------- *
 * Sign construction
 *
 * ASL signs decompose into handshape, location, movement and orientation
 * (the Stokoe parameters). Building them from those primitives means a new
 * word is one line instead of a hand-tuned keyframe list.
 *
 * Signs built this way are marked `gen` and are APPROXIMATIONS of the
 * documented form — the parameters are right, the fine detail is not.
 * ---------------------------------------------------------------- */

const MIRROR = (x) => 2 * 200 - x;

/* A sign made against the body or face is performed with the palm turned
 * towards the signer far more often than not — the hand has to face the place
 * it contacts. Signs out in neutral space face the addressee. That is the
 * default; `o.palm` overrides it for the signs that go the other way. */
const BODY_ANCHORS = new Set(['forehead', 'temple', 'eye', 'nose', 'chin',
                              'mouth', 'cheek', 'neck', 'chest', 'belly']);

// shape: 'B' or 'C>S' (start > end handshape)
// mv: hold tap down up out in fwd circle shake twist rep arc alt wiggle
// o: { two: 'mirror'|'base'|'alt', rot, dx, dy, dur, face, baseShape, baseRot,
//      palm: 'in'|'out', palm2 }
function mk(shape, loc, mv, o) {
  o = o || {};
  const pm = facing(o.palm, BODY_ANCHORS.has(loc) ? PALM.in : PALM.out);
  const pm2 = facing(o.palm2, pm);
  const parts = String(shape).split('>');
  const h1 = parts[0];
  const h2 = parts[1] || parts[0];
  const anchor = at(loc, o.dx || 0, o.dy || 0);
  const bx = anchor[0];
  const by = anchor[1];
  const R = o.rot === undefined ? -6 : o.rot;
  const D = o.dur || 230;

  // [handshape, dx, dy, drot, duration]
  let steps;
  switch (mv) {
    case 'tap':
      steps = [[h1, 0, -13, 0, D * 0.7], [h1, 0, 2, 0, D * 0.6],
               [h1, 0, -13, 0, D * 0.6], [h2, 0, 2, 0, D * 0.8]]; break;
    case 'down':
      steps = [[h1, 0, -22, 0, D], [h2, 0, 26, 7, D]]; break;
    case 'up':
      steps = [[h1, 0, 26, 0, D], [h2, 0, -22, -7, D]]; break;
    case 'out':
      steps = [[h1, 0, 0, 0, D], [h2, -44, -12, -15, D]]; break;
    case 'in':
      steps = [[h1, -44, -12, -15, D], [h2, 0, 0, 0, D]]; break;
    case 'fwd':
      steps = [[h1, 14, 8, 8, D], [h2, -22, -6, -6, D]]; break;
    case 'circle':
      steps = [[h1, 0, -17, 0, D * 0.7], [h1, 19, 0, 0, D * 0.55],
               [h1, 0, 19, 0, D * 0.55], [h1, -17, 0, 0, D * 0.55],
               [h2, 0, -15, 0, D * 0.75]]; break;
    case 'shake':
      steps = [[h1, 13, 0, 7, D * 0.6], [h1, -13, 0, -7, D * 0.55],
               [h1, 13, 0, 7, D * 0.55], [h2, -13, 0, -7, D * 0.7]]; break;
    case 'twist':
      steps = [[h1, 0, 0, -40, D], [h2, 0, -4, 34, D]]; break;
    case 'rep':
      steps = [[h1, 0, 0, 0, D * 0.75], [h2, 0, 0, 0, D * 0.7],
               [h1, 0, 0, 0, D * 0.7], [h2, 0, 0, 0, D * 0.85]]; break;
    case 'arc':
      steps = [[h1, 24, 10, 12, D], [h2, -28, -16, -16, D]]; break;
    case 'alt':
      steps = [[h1, 0, -19, 0, D * 0.8], [h1, 0, 17, 0, D * 0.7],
               [h1, 0, -19, 0, D * 0.7], [h2, 0, 17, 0, D * 0.85]]; break;
    case 'wiggle':
      steps = [[h1, 6, -4, 9, D * 0.5], [h2, -6, 4, -9, D * 0.45],
               [h1, 6, -4, 9, D * 0.45], [h2, -6, 4, -9, D * 0.6]]; break;
    case 'hold':
    default:
      // Even a held sign is *placed*. A single frozen keyframe has no arrival
      // and no settle, so it reads as a paused video rather than a signer
      // holding a shape: the hand comes in slightly high and drops onto it.
      steps = [[h1, 0, -11, -4, D * 0.55], [h2, 0, 0, 0, D * 1.15]];
  }

  return steps.map(function (st, i) {
    const x = bx + st[1];
    const y = by + st[2];
    const r = R + st[3];
    const f = { p: st[0], x: x, y: y, z: anchor[2], r: r, d: st[4], pm: pm };
    if (o.two) f.pm2 = pm2;
    if (o.two === 'mirror') {
      // Same shape and path, reflected about the midline.
      f.p2 = st[0]; f.x2 = MIRROR(x); f.y2 = y; f.z2 = anchor[2]; f.r2 = r;
    } else if (o.two === 'base') {
      // Non-dominant hand holds a static base the dominant hand acts on.
      f.p2 = o.baseShape || 'FLAT';
      f.x2 = 200 + (200 - bx) * 0.42;
      f.y2 = by + 26;
      f.z2 = anchor[2] + 0.03;
      f.r2 = o.baseRot === undefined ? 62 : o.baseRot;
    } else if (o.two === 'alt') {
      // Hands in opposite phase.
      f.p2 = st[0]; f.x2 = MIRROR(x); f.y2 = by - st[2]; f.z2 = anchor[2]; f.r2 = r;
    }
    return f;
  });
}

/* ---------------------------------------------------------------- *
 * Core vocabulary — [handshape, location, movement, options]
 * ---------------------------------------------------------------- */

const BUILT = {
  /* people & family */
  MOTHER: ['OPEN', 'chin', 'tap', { rot: -22 }],
  FATHER: ['OPEN', 'forehead', 'tap', { rot: -22 }],
  PARENT: ['OPEN', 'chin', 'up', { rot: -22 }],
  SISTER: ['L', 'cheek', 'down', { two: 'mirror' }],
  BROTHER: ['L', 'forehead', 'down', { two: 'mirror' }],
  BABY: ['FLAT', 'belly', 'shake', { two: 'mirror', rot: 70 }],
  CHILD: ['FLAT', 'belly', 'tap', { rot: 84 }],
  CHILDREN: ['FLAT', 'belly', 'shake', { rot: 84 }],
  SON: ['OPEN', 'forehead', 'down'],
  DAUGHTER: ['OPEN', 'chin', 'down'],
  GRANDMOTHER: ['OPEN', 'chin', 'arc', { rot: -22 }],
  GRANDFATHER: ['OPEN', 'forehead', 'arc', { rot: -22 }],
  AUNT: ['A', 'cheek', 'shake'],
  UNCLE: ['U', 'temple', 'shake'],
  MAN: ['OPEN', 'forehead', 'down', { rot: -22 }],
  WOMAN: ['OPEN', 'chin', 'down', { rot: -22 }],
  BOY: ['C>O', 'forehead', 'rep'],
  GIRL: ['A', 'cheek', 'down'],
  HUSBAND: ['C>S', 'forehead', 'down', { two: 'base' }],
  WIFE: ['C>S', 'chin', 'down', { two: 'base' }],
  PERSON: ['FLAT', 'chest', 'down', { two: 'mirror', rot: 160 }],
  TEACHER: ['O', 'forehead', 'out', { two: 'mirror' }],
  STUDENT: ['CLAW>O', 'chest', 'up', { two: 'mirror' }],
  DOCTOR: ['M', 'spell', 'tap', { dx: 40 }],
  NURSE: ['N', 'spell', 'tap', { dx: 40 }],
  BOSS: ['CLAW', 'temple', 'tap', { dx: -34 }],
  NEIGHBOR: ['FLAT', 'chest', 'fwd', { two: 'base' }],

  /* pronouns & reference */
  HE: ['POINT', 'out', 'hold', { rot: -74 }],
  SHE: ['POINT', 'out', 'hold', { rot: -74 }],
  IT: ['POINT', 'out', 'hold', { rot: -74 }],
  THEY: ['POINT', 'out', 'arc', { rot: -74 }],
  THEM: ['POINT', 'out', 'arc', { rot: -74 }],
  US: ['POINT', 'chest', 'arc', { rot: 40 }],
  OUR: ['FLAT', 'chest', 'arc', { rot: 60 }],
  THIS: ['POINT', 'chest', 'tap', { rot: 150, two: 'base' }],
  THAT: ['Y', 'chest', 'down', { two: 'base' }],
  HERE: ['FLAT', 'chest', 'circle', { two: 'mirror', rot: 150 }],
  THERE: ['POINT', 'out', 'hold', { rot: -60 }],

  /* time */
  TIME: ['POINT', 'spell', 'tap', { dx: 44, rot: 30 }],
  DAY: ['POINT', 'forehead', 'arc', { two: 'base' }],
  WEEK: ['POINT', 'chest', 'out', { two: 'base' }],
  MONTH: ['POINT', 'chest', 'down', { two: 'base' }],
  YEAR: ['S', 'chest', 'circle', { two: 'base', baseShape: 'S' }],
  MORNING: ['FLAT', 'belly', 'up', { two: 'base' }],
  AFTERNOON: ['FLAT', 'chest', 'fwd', { two: 'base' }],
  EVENING: ['FLAT', 'chest', 'down', { two: 'base' }],
  NIGHT: ['FLAT', 'chest', 'down', { two: 'base', rot: 150 }],
  TONIGHT: ['FLAT', 'chest', 'down', { two: 'base', rot: 150 }],
  HOUR: ['POINT', 'chest', 'circle', { two: 'base' }],
  MINUTE: ['POINT', 'chest', 'tap', { two: 'base' }],
  LATER: ['L', 'chest', 'twist', { two: 'base' }],
  BEFORE: ['FLAT', 'chest', 'in'],
  AFTER: ['FLAT', 'chest', 'out'],
  ALWAYS: ['POINT', 'spell', 'circle'],
  NEVER: ['FLAT', 'spell', 'arc', { face: 'neg' }],
  SOMETIMES: ['POINT', 'chest', 'tap', { two: 'base' }],
  OFTEN: ['FLAT', 'chest', 'rep', { two: 'base' }],
  SOON: ['F', 'chin', 'tap'],
  LATE: ['FLAT', 'side', 'shake'],
  EARLY: ['CLAW', 'chest', 'out', { two: 'base' }],
  AGAIN: ['CLAW', 'chest', 'in', { two: 'base' }],
  NEXT: ['FLAT', 'chest', 'arc', { two: 'base' }],
  LAST: ['I', 'chest', 'tap', { two: 'base' }],

  /* places */
  HOUSE: ['FLAT', 'forehead', 'arc', { two: 'mirror' }],
  ROOM: ['FLAT', 'chest', 'out', { two: 'mirror', rot: 60 }],
  OFFICE: ['O', 'chest', 'out', { two: 'mirror' }],
  STORE: ['O', 'chest', 'rep', { two: 'mirror', rot: 150 }],
  CITY: ['FLAT', 'spell', 'rep', { two: 'mirror' }],
  TOWN: ['FLAT', 'spell', 'rep', { two: 'mirror' }],
  HOSPITAL: ['H', 'side', 'tap', { dx: 56 }],
  CHURCH: ['C', 'chest', 'tap', { two: 'base' }],
  RESTAURANT: ['R', 'chin', 'shake'],
  BATHROOM: ['T', 'spell', 'shake'],
  LIBRARY: ['L', 'spell', 'circle'],
  PARK: ['P', 'chest', 'arc', { two: 'base' }],
  STREET: ['FLAT', 'chest', 'out', { two: 'mirror', rot: 60 }],
  COUNTRY: ['Y', 'spell', 'circle', { dx: 40 }],
  WORLD: ['W', 'chest', 'circle', { two: 'base', baseShape: 'W' }],
  PLACE: ['P', 'chest', 'circle', { two: 'mirror' }],

  /* food & drink */
  MILK: ['C>S', 'chest', 'rep'],
  COFFEE: ['S', 'chest', 'circle', { two: 'base', baseShape: 'S' }],
  TEA: ['F', 'chest', 'circle', { two: 'base', baseShape: 'O' }],
  BREAD: ['FLAT', 'chest', 'rep', { two: 'base' }],
  RICE: ['R', 'chest', 'up', { two: 'base' }],
  APPLE: ['X', 'cheek', 'twist'],
  BANANA: ['POINT>O', 'spell', 'down', { two: 'base' }],
  EGG: ['U', 'chest', 'down', { two: 'mirror' }],
  MEAT: ['F', 'chest', 'tap', { two: 'base' }],
  FISH: ['FLAT', 'spell', 'shake', { rot: -70 }],
  CHICKEN: ['G', 'mouth', 'rep'],
  CHEESE: ['FLAT', 'chest', 'twist', { two: 'base' }],
  SOUP: ['U', 'chest', 'up', { two: 'base' }],
  CAKE: ['CLAW', 'chest', 'out', { two: 'base' }],
  CANDY: ['POINT', 'cheek', 'twist'],
  PIZZA: ['V', 'spell', 'arc'],
  BREAKFAST: ['FLAT', 'mouth', 'tap'],
  LUNCH: ['FLAT', 'mouth', 'tap'],
  DINNER: ['FLAT', 'mouth', 'tap'],
  THIRSTY: ['POINT', 'neck', 'down'],
  COOK: ['FLAT', 'chest', 'twist', { two: 'base' }],
  SUGAR: ['U', 'chin', 'rep'],
  SALT: ['U', 'spell', 'tap', { two: 'base' }],

  /* animals */
  DOG: ['OPEN', 'side', 'tap'],
  CAT: ['F', 'cheek', 'out'],
  BIRD: ['G', 'mouth', 'rep'],
  HORSE: ['U', 'temple', 'rep'],
  COW: ['Y', 'temple', 'twist'],
  PIG: ['FLAT', 'chin', 'rep'],
  BEAR: ['CLAW', 'chest', 'tap', { two: 'mirror' }],
  MOUSE: ['POINT', 'nose', 'shake'],
  ANIMAL: ['CLAW', 'chest', 'rep', { two: 'mirror' }],

  /* verbs */
  NEED: ['X', 'chest', 'down', { face: 'mm' }],
  LIKE: ['OPEN>F', 'chest', 'out', { face: 'smile' }],
  HATE: ['OPEN', 'chest', 'out', { face: 'angry' }],
  THINK: ['POINT', 'forehead', 'circle'],
  FEEL: ['OPEN', 'chest', 'up'],
  LOOK: ['V', 'eye', 'out'],
  WATCH: ['V', 'eye', 'out'],
  HEAR: ['POINT', 'eye', 'hold', { dx: -30, dy: 10 }],
  LISTEN: ['CLAW', 'eye', 'hold', { dx: -30, dy: 10 }],
  SAY: ['POINT', 'mouth', 'circle'],
  TELL: ['POINT', 'chin', 'out'],
  TALK: ['4', 'chin', 'rep'],
  SPEAK: ['4', 'chin', 'rep'],
  ASK: ['POINT>X', 'chest', 'in'],
  ANSWER: ['POINT', 'chin', 'out', { two: 'mirror' }],
  READ: ['V', 'chest', 'down', { two: 'base' }],
  WRITE: ['F', 'chest', 'out', { two: 'base' }],
  TEACH: ['O', 'forehead', 'out', { two: 'mirror' }],
  STUDY: ['OPEN', 'chest', 'wiggle', { two: 'base' }],
  PLAY: ['Y', 'chest', 'twist', { two: 'mirror' }],
  MAKE: ['S', 'chest', 'twist', { two: 'base', baseShape: 'S' }],
  GIVE: ['O', 'chest', 'out'],
  TAKE: ['OPEN>S', 'chest', 'in'],
  GET: ['OPEN>S', 'chest', 'in'],
  BUY: ['O', 'chest', 'out', { two: 'base' }],
  SELL: ['O', 'chest', 'shake', { two: 'mirror' }],
  PAY: ['POINT', 'chest', 'out', { two: 'base' }],
  DRIVE: ['S', 'chest', 'shake', { two: 'mirror' }],
  WALK: ['FLAT', 'belly', 'alt', { two: 'alt', rot: 150 }],
  RUN: ['L', 'chest', 'out', { two: 'mirror' }],
  SIT: ['U', 'chest', 'down', { two: 'base' }],
  STAND: ['V', 'chest', 'down', { two: 'base', rot: 150 }],
  WAKE: ['O>L', 'eye', 'rep', { two: 'mirror' }],
  WAIT: ['OPEN', 'chest', 'wiggle', { two: 'mirror' }],
  START: ['POINT', 'chest', 'twist', { two: 'base' }],
  BEGIN: ['POINT', 'chest', 'twist', { two: 'base' }],
  OPEN: ['B', 'chest', 'out', { two: 'mirror' }],
  CLOSE: ['B', 'chest', 'in', { two: 'mirror' }],
  MEET: ['POINT', 'chest', 'in', { two: 'mirror' }],
  LEAVE: ['OPEN>S', 'chest', 'out', { two: 'mirror' }],
  ARRIVE: ['FLAT', 'chest', 'in', { two: 'base' }],
  LIVE: ['A', 'belly', 'up', { two: 'mirror' }],
  MOVE: ['O', 'chest', 'arc', { two: 'mirror' }],
  CHANGE: ['X', 'chest', 'twist', { two: 'base', baseShape: 'X' }],
  TRY: ['S', 'chest', 'fwd', { two: 'mirror' }],
  PRACTICE: ['A', 'chest', 'shake', { two: 'base' }],
  REMEMBER: ['A', 'forehead', 'down', { two: 'base', baseShape: 'A' }],
  FORGET: ['OPEN>A', 'forehead', 'out'],
  EXPLAIN: ['F', 'chest', 'rep', { two: 'alt' }],
  SHOW: ['POINT', 'chest', 'fwd', { two: 'base' }],
  FIND: ['OPEN>F', 'chest', 'up'],
  LOSE: ['O>OPEN', 'chest', 'down', { two: 'mirror' }],
  WIN: ['OPEN>S', 'chest', 'up', { two: 'mirror' }],
  CALL: ['H', 'chest', 'out', { two: 'base' }],
  SEND: ['FLAT', 'chest', 'out', { two: 'base' }],
  BRING: ['FLAT', 'chest', 'in', { two: 'mirror', rot: 60 }],
  USE: ['U', 'chest', 'circle', { two: 'base' }],
  CLEAN: ['FLAT', 'chest', 'out', { two: 'base' }],
  WASH: ['A', 'chest', 'rep', { two: 'base', baseShape: 'A' }],
  DANCE: ['V', 'chest', 'shake', { two: 'base' }],
  SING: ['FLAT', 'chest', 'shake', { two: 'base' }],
  SWIM: ['FLAT', 'chest', 'out', { two: 'mirror' }],
  DRAW: ['I', 'chest', 'down', { two: 'base' }],
  BUILD: ['FLAT', 'chest', 'alt', { two: 'alt' }],
  FIX: ['O', 'chest', 'rep', { two: 'alt' }],
  BREAK: ['S', 'chest', 'twist', { two: 'mirror' }],
  CUT: ['V', 'chest', 'rep', { rot: -70 }],
  PUSH: ['FLAT', 'chest', 'out', { two: 'mirror' }],
  PULL: ['S', 'chest', 'in', { two: 'mirror' }],
  CARRY: ['FLAT', 'chest', 'arc', { two: 'mirror' }],
  HOLD: ['S', 'chest', 'hold', { two: 'mirror' }],
  TOUCH: ['POINT', 'chest', 'tap', { two: 'base' }],
  HUG: ['S', 'chest', 'in', { two: 'mirror', face: 'smile' }],
  SMILE: ['POINT', 'mouth', 'out', { face: 'happy' }],
  LAUGH: ['L', 'mouth', 'rep', { face: 'happy' }],
  CRY: ['POINT', 'eye', 'down', { two: 'alt', face: 'sad' }],
  DRINK2: ['C', 'mouth', 'twist'],

  /* adjectives */
  BIG: ['L', 'chest', 'out', { two: 'mirror' }],
  SMALL: ['FLAT', 'chest', 'in', { two: 'mirror' }],
  LITTLE: ['FLAT', 'chest', 'in', { two: 'mirror' }],
  TALL: ['POINT', 'chest', 'up', { two: 'base' }],
  SHORT: ['H', 'chest', 'down', { two: 'base' }],
  LONG: ['POINT', 'chest', 'up', { two: 'base' }],
  HOT: ['CLAW', 'mouth', 'out', { face: 'cha' }],
  COLD: ['S', 'chest', 'shake', { two: 'mirror', face: 'mm' }],
  WARM: ['A>OPEN', 'mouth', 'up'],
  NEW: ['FLAT', 'chest', 'in', { two: 'base' }],
  OLD: ['S', 'chin', 'down'],
  YOUNG: ['CLAW', 'chest', 'up', { two: 'mirror' }],
  BEAUTIFUL: ['OPEN>O', 'forehead', 'circle', { face: 'smile' }],
  PRETTY: ['OPEN>O', 'forehead', 'circle', { face: 'smile' }],
  UGLY: ['X', 'nose', 'out', { face: 'angry' }],
  EASY: ['U', 'chest', 'up', { two: 'base' }],
  HARD: ['V', 'chest', 'tap', { two: 'base', baseShape: 'V' }],
  DIFFICULT: ['V', 'chest', 'tap', { two: 'base', baseShape: 'V' }],
  FAST: ['L>S', 'chest', 'in', { two: 'mirror' }],
  SLOW: ['FLAT', 'chest', 'in', { two: 'base' }],
  LOUD: ['POINT', 'eye', 'out', { two: 'mirror', dx: -30, dy: 10 }],
  QUIET: ['FLAT', 'mouth', 'down', { two: 'mirror', face: 'mm' }],
  DIRTY: ['OPEN', 'chin', 'wiggle', { rot: 150 }],
  FULL: ['FLAT', 'chest', 'out', { two: 'base' }],
  SICK: ['CLAW', 'forehead', 'tap', { face: 'sad' }],
  HEALTHY: ['OPEN>S', 'chest', 'out', { two: 'mirror' }],
  STRONG: ['S', 'chest', 'out', { two: 'mirror' }],
  WEAK: ['CLAW', 'chest', 'down', { two: 'base' }],
  RICH: ['OPEN>S', 'chest', 'up', { two: 'base' }],
  POOR: ['CLAW>O', 'chest', 'down'],
  SCARED: ['OPEN', 'chest', 'in', { two: 'mirror', face: 'surprise' }],
  AFRAID: ['OPEN', 'chest', 'in', { two: 'mirror', face: 'surprise' }],
  EXCITED: ['I', 'chest', 'alt', { two: 'alt', face: 'happy' }],
  BORED: ['POINT', 'nose', 'twist', { face: 'sleepy' }],
  FUNNY: ['U', 'nose', 'rep', { face: 'happy' }],
  NICE: ['FLAT', 'chest', 'out', { two: 'base', face: 'smile' }],
  SMART: ['POINT', 'forehead', 'out'],
  RIGHT: ['POINT', 'chest', 'down', { two: 'base', baseShape: 'POINT' }],
  CORRECT: ['POINT', 'chest', 'down', { two: 'base', baseShape: 'POINT' }],
  WRONG: ['Y', 'chin', 'tap', { face: 'neg' }],
  TRUE: ['POINT', 'mouth', 'out'],
  SAME: ['Y', 'chest', 'shake', { rot: 60 }],
  DIFFERENT: ['POINT', 'chest', 'out', { two: 'mirror' }],
  IMPORTANT: ['F', 'chest', 'up', { two: 'mirror' }],
  READY: ['R', 'chest', 'out', { two: 'mirror' }],
  BUSY: ['B', 'chest', 'shake', { two: 'base' }],
  SAFE: ['S', 'chest', 'out', { two: 'mirror' }],

  /* things */
  BOOK: ['FLAT', 'chest', 'twist', { two: 'mirror' }],
  PAPER: ['FLAT', 'chest', 'rep', { two: 'base' }],
  PEN: ['F', 'chest', 'out', { two: 'base' }],
  PENCIL: ['F', 'chin', 'out', { two: 'base' }],
  COMPUTER: ['C', 'spell', 'arc', { dx: 30 }],
  PHONE: ['Y', 'cheek', 'hold', { rot: -20 }],
  MONEY: ['FLAT', 'chest', 'tap', { two: 'base' }],
  JOB: ['J', 'chest', 'hold'],
  CLASS: ['C', 'chest', 'arc', { two: 'mirror' }],
  TEST: ['POINT>CLAW', 'chest', 'down', { two: 'mirror' }],
  HOMEWORK: ['FLAT', 'forehead', 'down', { two: 'base' }],
  CAR: ['S', 'chest', 'alt', { two: 'alt' }],
  BUS: ['B', 'spell', 'out'],
  TRAIN: ['U', 'chest', 'rep', { two: 'base', baseShape: 'U' }],
  PLANE: ['Y', 'chest', 'out'],
  BIKE: ['S', 'belly', 'alt', { two: 'alt' }],
  DOOR: ['B', 'chest', 'twist', { two: 'mirror' }],
  WINDOW: ['FLAT', 'chest', 'down', { two: 'base' }],
  TABLE: ['FLAT', 'chest', 'tap', { two: 'base' }],
  CHAIR: ['U', 'chest', 'tap', { two: 'base', baseShape: 'U' }],
  BED: ['FLAT', 'cheek', 'hold', { rot: -30 }],
  CLOTHES: ['OPEN', 'chest', 'down', { two: 'mirror' }],
  SHOES: ['S', 'chest', 'tap', { two: 'mirror' }],
  SHIRT: ['F', 'chest', 'rep'],
  HAT: ['FLAT', 'forehead', 'tap'],
  BAG: ['CLAW', 'side', 'hold'],
  KEY: ['X', 'chest', 'twist', { two: 'base' }],
  LIGHT: ['O>OPEN', 'forehead', 'down'],
  MUSIC: ['FLAT', 'chest', 'shake', { two: 'base' }],
  MOVIE: ['OPEN', 'chest', 'shake', { two: 'base' }],
  GAME: ['A', 'chest', 'tap', { two: 'mirror' }],
  STORY: ['F', 'chest', 'out', { two: 'mirror' }],
  WORD: ['G', 'spell', 'tap', { two: 'base' }],
  QUESTION: ['POINT', 'spell', 'twist'],
  PROBLEM: ['X', 'chest', 'rep', { two: 'mirror' }],
  IDEA: ['I', 'forehead', 'up'],
  REASON: ['R', 'forehead', 'circle'],
  LIFE: ['L', 'belly', 'up', { two: 'mirror' }],
  WEATHER: ['W', 'spell', 'twist', { two: 'mirror' }],
  RAIN: ['CLAW', 'forehead', 'alt', { two: 'mirror', rot: 150 }],
  SNOW: ['OPEN', 'forehead', 'down', { two: 'mirror', rot: 150 }],
  SUN: ['C', 'forehead', 'out', { dx: -30, dy: -30 }],
  MOON: ['C', 'forehead', 'out', { dx: -20, dy: -34 }],
  STAR: ['POINT', 'forehead', 'alt', { two: 'alt' }],
  TREE: ['OPEN', 'chest', 'twist', { two: 'base', rot: 0 }],
  FLOWER: ['O', 'nose', 'shake'],
  FIRE: ['OPEN', 'chest', 'up', { two: 'mirror' }],

  /* connectives & quantity */
  WITH: ['A', 'chest', 'in', { two: 'mirror' }],
  WITHOUT: ['A>OPEN', 'chest', 'out', { two: 'mirror' }],
  FOR: ['POINT', 'forehead', 'out'],
  ABOUT: ['POINT', 'chest', 'circle', { two: 'base', baseShape: 'O' }],
  IF: ['F', 'eye', 'shake'],
  BUT: ['POINT', 'chest', 'out', { two: 'mirror' }],
  BECAUSE: ['POINT>A', 'forehead', 'out'],
  ALSO: ['POINT', 'chest', 'out', { two: 'mirror' }],
  OR: ['L', 'chest', 'shake'],
  THAN: ['FLAT', 'chest', 'down', { two: 'base' }],
  VERY: ['V', 'chest', 'out', { two: 'mirror' }],
  MOST: ['A', 'chest', 'up', { two: 'base', baseShape: 'A' }],
  LESS: ['FLAT', 'chest', 'down', { two: 'base' }],
  MANY: ['S>OPEN', 'chest', 'rep', { two: 'mirror' }],
  FEW: ['A>OPEN', 'chest', 'out'],
  ALL: ['FLAT', 'chest', 'circle', { two: 'base' }],
  SOME: ['FLAT', 'chest', 'out', { two: 'base' }],
  EVERY: ['A', 'chest', 'down', { two: 'base', baseShape: 'A' }],
  ANY: ['A', 'chest', 'arc'],
  NOTHING: ['O', 'chin', 'out', { face: 'neg' }],
  SOMETHING: ['POINT', 'chest', 'shake'],
  EVERYTHING: ['FLAT', 'chest', 'circle', { two: 'base' }],
  ONLY: ['POINT', 'chest', 'circle'],
  MAYBE: ['FLAT', 'chest', 'alt', { two: 'alt' }],
  MUST: ['X', 'chest', 'down'],
  SHOULD: ['X', 'chest', 'down'],
  CAN: ['S', 'chest', 'down', { two: 'mirror' }],
  ABLE: ['S', 'chest', 'down', { two: 'mirror' }],
  AND: ['OPEN>O', 'chest', 'out'],
  TOGETHER: ['A', 'chest', 'circle', { two: 'mirror' }],
  ALONE: ['POINT', 'chest', 'circle'],
  AGREE: ['POINT', 'forehead', 'down', { two: 'mirror' }],
  BETTER: ['FLAT', 'chin', 'arc'],
  BEST: ['FLAT', 'chin', 'up'],
  FAVORITE: ['I', 'chin', 'tap'],
  WELCOME: ['FLAT', 'chest', 'in', { face: 'smile' }],
  EXCUSE: ['FLAT', 'chest', 'out', { two: 'base' }],
  CONGRATULATIONS: ['S', 'chest', 'shake', { two: 'mirror', face: 'happy' }],
};

for (const w of Object.keys(BUILT)) {
  if (VOCAB[w]) continue;                       // hand-authored wins
  const spec = BUILT[w];
  const o = spec[3] || {};
  VOCAB[w] = {
    frames: mk(spec[0], spec[1], spec[2], o),
    two: !!o.two,
    face: o.face,
    gen: true,                                  // built from primitives, approximate
  };
}

/* Legacy two-handed entries were authored before the second hand was animated:
 * mirror the dominant track onto the non-dominant one. */
for (const w of Object.keys(VOCAB)) {
  const e = VOCAB[w];
  if (!e.frames || e.two !== true) continue;
  if (e.frames.some((f) => f.p2)) continue;
  e.frames = e.frames.map((f) => Object.assign({}, f, {
    p2: f.p, x2: MIRROR(f.x), y2: f.y, z2: f.z, r2: f.r,
  }));
}

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

window.SL = { POSES, VOCAB, A_, FINGERSPELL_MOTION, NUMBER_WORDS, kf, at,
              PALM, PALM_DEFAULT, PALM_REST, facing };

})();
