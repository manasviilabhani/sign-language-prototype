/* hand.js — procedural hand renderer + animation timeline
 *
 * Everything is drawn in a virtual 400 x 520 stage and scaled to the canvas,
 * so poses and anchors in signs.js are resolution independent.
 */

(function () {
'use strict';

const STAGE_W = 400;
const STAGE_H = 520;

/* ---------------------------------------------------------------- *
 * Hand geometry (hand-local units: wrist at origin, fingers point up)
 * ---------------------------------------------------------------- */

const GEO = {
  palmW: 74,
  palmH: 84,
  fingers: [
    { bx: 25, by: -80, len: [32, 22, 16], w: [15, 13.5, 11.5] }, // index
    { bx: 7, by: -86, len: [35, 24, 17], w: [15.5, 14, 12] },    // middle
    { bx: -11, by: -83, len: [32, 22, 16], w: [14.5, 13, 11] },  // ring
    { bx: -28, by: -73, len: [25, 17, 13], w: [13, 11.5, 10] },  // pinky
  ],
  thumb: { bx: 33, by: -14, len: [30, 24], w: [19, 16] },
};

const HAND_SCALE = 0.62;  // hand units -> stage units, sized against the head
const BEND_RATE = 0.78;   // how much finger flexion becomes in-plane rotation
const THUMB_RATE = 0.62;
const SHORTEN = 0.3;      // foreshortening applied to a fully flexed segment
// Thumb spread below which the thumb lies against the hand, so nothing of it
// shows from behind. See the same constant in flat.js.
const THUMB_ABDUCTED = 20;

const rad = (d) => (d * Math.PI) / 180;

/* ---------------------------------------------------------------- *
 * Pose <-> flat vector, so poses can be interpolated numerically
 * ---------------------------------------------------------------- */

const POSE_LEN = 19; // 12 finger joints + 4 spreads + 2 thumb joints + 1 thumb spread

function poseToVec(p) {
  const v = [];
  for (let i = 0; i < 4; i++) v.push(p.f[i][0], p.f[i][1], p.f[i][2]);
  for (let i = 0; i < 4; i++) v.push(p.s[i]);
  v.push(p.th[0], p.th[1], p.ts);
  return v;
}

function vecToPose(v) {
  return {
    f: [
      [v[0], v[1], v[2]],
      [v[3], v[4], v[5]],
      [v[6], v[7], v[8]],
      [v[9], v[10], v[11]],
    ],
    s: [v[12], v[13], v[14], v[15]],
    th: [v[16], v[17]],
    ts: v[18],
  };
}

function lerpVec(a, b, t) {
  const out = new Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = a[i] + (b[i] - a[i]) * t;
  return out;
}

const smootherstep = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);

/* Per-digit timing.
 *
 * Every number in the pose vector used to share one interpolation parameter,
 * so all four fingers and the thumb arrived at the new handshape on exactly
 * the same frame. That is the single thing that made the signing read as
 * mechanical: real hands do not move in lockstep, the digits arrive in a
 * ripple. Each finger now gets its own slice of the transition — index first,
 * pinky last — so a handshape assembles instead of snapping into place.
 *
 * The spread angle travels with its own finger rather than with the group,
 * which is what makes a hand opening to 5 splay outwards progressively.
 */
const DIGIT_LEAD = [0, 0.05, 0.10, 0.15, 0.07];  // index, middle, ring, pinky, thumb
const LEAD_MAX = 0.15;

// A stroke is faster than the recovery that follows it — a signer drives to
// the shape and eases out of it, rather than moving symmetrically.
const ARC = 0.055;       // perpendicular bulge, as a fraction of travel
const STROKE_BIAS = 0.42;
const biased = (t) => (t < STROKE_BIAS
  ? smootherstep(t / STROKE_BIAS) * 0.55
  : 0.55 + smootherstep((t - STROKE_BIAS) / (1 - STROKE_BIAS)) * 0.45);

function digitEases(raw) {
  const out = [];
  for (let i = 0; i < 5; i++) {
    out.push(biased(clamp01((raw - DIGIT_LEAD[i]) / (1 - LEAD_MAX))));
  }
  return out;
}

/* Interpolate one hand's 19 numbers with a separate ease per digit. Layout is
 * 4 fingers x 3 joints, then 4 spreads, then 2 thumb joints and a thumb
 * spread — see POSE_LEN. */
function lerpHand(a, b, out, off, te) {
  for (let f = 0; f < 4; f++) {
    const t = te[f];
    for (let j = 0; j < 3; j++) {
      const k = off + f * 3 + j;
      out[k] = a[k] + (b[k] - a[k]) * t;
    }
    const s = off + 12 + f;
    out[s] = a[s] + (b[s] - a[s]) * t;
  }
  for (let k = off + 16; k < off + 19; k++) {
    out[k] = a[k] + (b[k] - a[k]) * te[4];
  }
}
// Slight overshoot on arrival, so a sign settles rather than stopping dead.
const OVER = 1.05;
const easeOutBack = (t) => 1 + (OVER + 1) * Math.pow(t - 1, 3) + OVER * Math.pow(t - 1, 2);
// Rotation lags translation by a fraction of the transition.
const easeLag = (t) => smootherstep(Math.max(0, Math.min(1, (t - 0.18) / 0.82)));

/* ---------------------------------------------------------------- *
 * Two-bone arm IK — keeps the wrist attached to a shoulder
 * ---------------------------------------------------------------- */

const SHOULDER = { x: 143, y: 224 };          // dominant (signer's right)
const SHOULDER_L = { x: 257, y: 224 };        // passive, rests at the side
const REST_HAND_ROT = 168;   // a hand hanging at the side points down
const UPPER = 96;
const FORE = 100;

/* Anchors put the wrist 35–60 units from the shoulder while the arm is 196
 * units of bone, so rigid bones reach them only by folding to a right angle.
 * Picking between the two mirror solutions by "whichever is lower on screen"
 * then threw that fold across the torso at face height and flipped it
 * mid-transition — the inverted elbow. Instead the bones foreshorten on a
 * short reach (a real arm angles toward the viewer when the hand comes to the
 * signer's own face), and the elbow is placed by angle from a rest direction
 * rather than picked from two branches, so there is nothing left to swap. */
const CENTRE = 200;      // torso midline; the elbow stays on its own side of it
const MAX_BOW = 36;      // furthest the elbow sits off the shoulder→wrist line
const POLE_OUT = 0.15;   // outward lean of the elbow's rest direction
const POLE_CUT = 2.35;   // reach angle past which the arm straightens out

function solveArm(sh, wx, wy) {
  const dx = wx - sh.x;
  const dy = wy - sh.y;
  const raw = Math.hypot(dx, dy) || 0.001;
  const dist = Math.min(UPPER + FORE - 4, raw);

  // Where the elbow wants to sit: down, and away from the body.
  const out = sh.x < CENTRE ? -1 : 1;
  const pole = Math.atan2(1, POLE_OUT * out);
  const theta = Math.atan2(dy, dx);
  let d = pole - theta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;

  // Reaching straight back along the rest direction leaves no side to bend
  // towards, so the arm straightens as it approaches that: the two ways to
  // bend meet instead of swapping, which is what keeps the motion smooth.
  const taper = Math.max(0, Math.min(1, (Math.PI - Math.abs(d)) / (Math.PI - POLE_CUT)));
  const bow = MAX_BOW * taper;
  const mean = (UPPER + FORE) / 2;
  const s = Math.min(1, Math.sqrt(bow * bow + dist * dist / 4) / mean);
  const up = UPPER * s;
  const fo = FORE * s;

  // Swing no further from the rest direction than reaching the wrist requires.
  let c = (dist * dist + up * up - fo * fo) / (2 * dist * up);
  c = Math.max(-1, Math.min(1, c));
  const spread = Math.acos(c);
  const phi = theta + Math.max(-spread, Math.min(spread, d));
  return { x: sh.x + Math.cos(phi) * up, y: sh.y + Math.sin(phi) * up };
}

/* ---------------------------------------------------------------- *
 * Drawing
 * ---------------------------------------------------------------- */

// Soft shadow pass: draw the same geometry blurred and offset underneath, so
// hands read as sitting in front of the body rather than pasted onto it.
const CAN_BLUR = (function () {
  try {
    const c = document.createElement('canvas').getContext('2d');
    c.filter = 'blur(2px)';
    return c.filter === 'blur(2px)';
  } catch (e) { return false; }
})();

function shadowed(ctx, dx, dy, blur, alpha, draw) {
  ctx.save();
  if (CAN_BLUR) ctx.filter = 'blur(' + blur + 'px)';
  ctx.globalAlpha = alpha;
  ctx.translate(dx, dy);
  draw(ctx, { skin: '#000', skinEdge: '#000', skinLight: '#000', shirt: '#000',
              shirtDark: '#000', skinShade: '#000' });
  ctx.restore();
}

function armGeom(ctx, C, shoulder, e, wx, wy) {
  ctx.lineCap = 'round';
  const bones = [
    [shoulder, e, 31, C.shirtDark, 27, C.shirt],
    [e, { x: wx, y: wy }, 25, C.skinShade, 21, C.skin],
  ];
  for (const [a, b, wOut, cOut, wIn, cIn] of bones) {
    for (const [w, col] of [[wOut, cOut], [wIn, cIn]]) {
      ctx.strokeStyle = col;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.arc(e.x, e.y, 10.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawArm(ctx, C, wx, wy, sh) {
  const shoulder = sh || SHOULDER;
  const e = solveArm(shoulder, wx, wy);
  shadowed(ctx, 5, 11, 7, 0.22, (c, K) => armGeom(c, K, shoulder, e, wx, wy));

  ctx.save();
  armGeom(ctx, C, shoulder, e, wx, wy);

  // forearm highlight along the top edge gives the limb volume
  const ang = Math.atan2(wy - e.y, wx - e.x);
  const nx = Math.sin(ang) * 5.5;
  const ny = -Math.cos(ang) * 5.5;
  ctx.strokeStyle = C.skinLight;
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(e.x + nx, e.y + ny);
  ctx.lineTo(wx + nx, wy + ny);
  ctx.stroke();
  ctx.restore();
}

// One finger: tapered segments with joint creases and a lit top edge.
function drawChain(ctx, C, x, y, baseAngle, flex, lens, widths, rate, detail) {
  let cx = x;
  let cy = y;
  let a = baseAngle;
  const pts = [{ x: cx, y: cy }];
  const angs = [];
  for (let i = 0; i < lens.length; i++) {
    a += rad(flex[i] * rate);
    const shorten = 1 - SHORTEN * Math.min(1, Math.abs(flex[i]) / 95);
    const L = lens[i] * shorten;
    cx += Math.sin(a) * L;
    cy -= Math.cos(a) * L;
    pts.push({ x: cx, y: cy });
    angs.push(a);
  }

  ctx.lineCap = 'round';
  // rim
  ctx.strokeStyle = C.skinEdge;
  for (let i = 0; i < lens.length; i++) {
    ctx.lineWidth = widths[i] + 3;
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    ctx.stroke();
  }
  // body, tapering toward the tip
  for (let i = 0; i < lens.length; i++) {
    const g = ctx.createLinearGradient(pts[i].x - 6, pts[i].y, pts[i].x + 8, pts[i].y);
    g.addColorStop(0, C.skinLight);
    g.addColorStop(0.55, C.skin);
    g.addColorStop(1, C.skinShade);
    ctx.strokeStyle = g;
    ctx.lineWidth = widths[i];
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    ctx.stroke();
  }

  if (detail !== false) {
    // knuckle creases
    ctx.strokeStyle = C.crease;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.4;
    for (let i = 1; i < pts.length - 1; i++) {
      const w = widths[i] * 0.42;
      const p = pts[i];
      const pa = angs[i - 1];
      ctx.beginPath();
      ctx.moveTo(p.x - Math.cos(pa) * w, p.y - Math.sin(pa) * w);
      ctx.lineTo(p.x + Math.cos(pa) * w, p.y + Math.sin(pa) * w);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
  return pts[pts.length - 1];
}

function handGeom(ctx, C, pose, detail, back) {
  const halfW = GEO.palmW / 2;
  const t = GEO.thumb;
  const thumb = () => drawChain(ctx, C, t.bx, t.by, rad(pose.ts),
    [-pose.th[0], -pose.th[1]], t.len, t.w, THUMB_RATE, detail);

  // Seen from behind, the thumb is on the far side of the hand: it goes down
  // first so the palm covers all but the part that clears the silhouette —
  // and a thumb that is not spread away from the hand clears nothing, so it
  // is not drawn at all.
  if (back && pose.ts >= THUMB_ABDUCTED) thumb();

  ctx.beginPath();
  ctx.moveTo(-halfW + 4, 6);
  ctx.quadraticCurveTo(-halfW - 4, -30, -halfW + 2, -GEO.palmH + 8);
  ctx.quadraticCurveTo(-halfW + 6, -GEO.palmH - 2, -halfW + 20, -GEO.palmH - 1);
  ctx.lineTo(halfW - 14, -GEO.palmH + 4);
  ctx.quadraticCurveTo(halfW + 4, -GEO.palmH + 12, halfW + 2, -34);
  ctx.quadraticCurveTo(halfW + 2, 4, halfW - 14, 10);
  ctx.closePath();

  const pg = ctx.createLinearGradient(-halfW, -GEO.palmH, halfW, 10);
  pg.addColorStop(0, C.skinLight);
  pg.addColorStop(0.5, C.skin);
  pg.addColorStop(1, C.skinShade);
  ctx.fillStyle = pg;
  ctx.strokeStyle = C.skinEdge;
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();

  if (detail !== false && !back) {
    // palm creases and the thenar pad — palm-side detail, so not from behind
    ctx.save();
    ctx.globalAlpha = 0.32;
    ctx.strokeStyle = C.crease;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(halfW - 26, -GEO.palmH + 22);
    ctx.quadraticCurveTo(0, -GEO.palmH + 34, -halfW + 14, -GEO.palmH + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(halfW - 14, -22);
    ctx.quadraticCurveTo(halfW - 30, -6, -halfW + 16, -2);
    ctx.stroke();
    ctx.restore();
  }

  for (let i = 3; i >= 0; i--) {
    const g = GEO.fingers[i];
    drawChain(ctx, C, g.bx, g.by, rad(pose.s[i]), pose.f[i], g.len, g.w, BEND_RATE, detail);
  }

  if (!back) thumb();

  ctx.beginPath();
  ctx.ellipse(0, 10, halfW - 12, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.skinEdge;
  ctx.fill();
}

// `mirror` draws the same pose data as a left hand.
// The geometry is the signer's RIGHT hand seen from the BACK (thumb at +x).
// Handedness and palm facing are one degree of freedom in a flat drawing, so
// both are supplied: `mirror` marks the non-dominant hand, `palm` is +1 facing
// the viewer and -1 facing the signer, and their product is the chirality.
function drawHand(ctx, C, pose, x, y, rot, scale, mirror, palm) {
  const pf = palm === undefined ? 1 : palm;
  const place = (c) => {
    c.translate(x, y);
    c.rotate(rad(mirror ? -rot : rot));
    c.scale((mirror ? 1 : -1) * pf * scale, scale);
  };

  const back = pf < 0;
  shadowed(ctx, 6, 13, 8, 0.26, (c, K) => { place(c); handGeom(c, K, pose, false, back); });

  ctx.save();
  place(ctx);
  handGeom(ctx, C, pose, true, back);
  ctx.restore();
}

function palette() {
  const cs = getComputedStyle(document.documentElement);
  const g = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
  return {
    skin: g('--skin', '#e9b78e'),
    skinEdge: g('--skin-edge', '#9b6136'),
    skinShade: g('--skin-shade', '#d29a6f'),
    skinLight: g('--skin-light', '#f7d3b2'),
    crease: g('--crease', '#8a5230'),
    shirt: g('--shirt', '#6366f1'),
    shirtDark: g('--shirt-dark', '#4338ca'),
    hair: g('--hair', '#3b2a24'),
    hairLight: g('--hair-light', '#5c443a'),
    hairDark: g('--hair-dark', '#241812'),
    shirtLight: g('--shirt-light', '#8b8ef7'),
    skinDeep: g('--skin-deep', '#7d4526'),
    lash: g('--lash', '#3a2a22'),
    irisLight: g('--iris-light', '#9a7350'),
    lipTop: g('--lip-top', '#7d3b36'),
    lipBottom: g('--lip-bottom', '#c4756c'),
    brow: g('--brow', '#3b2a24'),
    line: g('--line', '#6b4a33'),
    sclera: g('--sclera', '#ffffff'),
    iris: g('--iris', '#5b4636'),
    pupil: g('--pupil', '#1c1411'),
    mouth: g('--mouth', '#8f4a44'),
    mouthInner: g('--mouth-inner', '#6d2f2c'),
    teeth: g('--teeth', '#fbf7f4'),
    tongue: g('--tongue', '#c2606a'),
    blush: g('--blush', 'rgba(226,120,110,0.35)'),
};
}

/* ---------------------------------------------------------------- *
 * Timeline
 * ---------------------------------------------------------------- */

/* Travel time between two held keyframes, scaled by how far the hand actually
 * goes. A single flat figure made a two-inch move look sluggish and a
 * cross-body sweep look teleported — distance is most of what makes timing
 * read as physical. */
const TRANS_MIN = 90;
const TRANS_MAX = 260;
const TRANS_PER_UNIT = 1.1;

class Timeline {
  constructor() {
    this.keys = [];
    this.duration = 0;
    this.items = []; // { label, kind, t0, t1 }
  }

  // `defaultFace` is the resolved non-manual marker for the whole item, either
  // a name or a composed face object; individual frames may override it via
  // `fc` (a head shake has to alternate within one sign).
  add(frames, label, kind, defaultFace, faceLabel, defaultPalm) {
    const t0 = this.duration;
    const F = window.SLFace;
    const basePalm = window.SL.facing(defaultPalm, window.SL.PALM_DEFAULT);
    const base = typeof defaultFace === 'object' && defaultFace !== null
      ? defaultFace
      : F.FACES[defaultFace] || F.FACES.neutral;
    const A = window.SL.A_;
    for (const f of frames) {
      const p = window.SL.POSES[f.p] || window.SL.POSES.REST;
      // Non-dominant hand: falls back to resting at the side when a sign is
      // one-handed, so it interpolates down naturally instead of snapping.
      const p2 = window.SL.POSES[f.p2] || window.SL.POSES.REST;
      const x2 = f.x2 === undefined ? A.rest2[0] : f.x2;
      const y2 = f.y2 === undefined ? A.rest2[1] : f.y2;
      const z2 = f.z2 === undefined ? A.rest2[2] : f.z2;
      const r2 = f.r2 === undefined ? REST_HAND_ROT : f.r2;
      const fc = f.fc ? F.FACES[f.fc] || base : base;
      const v = poseToVec(p).concat(poseToVec(p2), F.faceToVec(fc));
      let trans = 0;
      if (this.keys.length) {
        const prev = this.keys[this.keys.length - 1];
        const d = Math.hypot(f.x - prev.x, f.y - prev.y);
        trans = Math.min(TRANS_MAX, TRANS_MIN + d * TRANS_PER_UNIT);
      }
      const start = this.keys.length ? this.duration + trans : 0;
      // Palm facing rides alongside the wrist rather than inside the pose
      // vector: it is a property of how the hand is turned, not of its shape.
      const pf = f.pm === undefined ? basePalm : f.pm;
      // A hand that the sign never places is resting at the side, so it keeps
      // the neutral facing rather than taking the signing hand's.
      const pf2 = f.pm2 !== undefined ? f.pm2
        : (f.x2 === undefined ? window.SL.PALM_REST : pf);
      const k = { v, x: f.x, y: f.y, z: f.z, r: f.r, x2, y2, z2, r2, pf, pf2 };
      this.keys.push(Object.assign({ t: start }, k));
      this.keys.push(Object.assign({ t: start + f.d }, k));
      this.duration = start + f.d;
    }
    this.items.push({ label, kind, t0, t1: this.duration, face: faceLabel || '' });
  }

  sample(t) {
    const k = this.keys;
    if (!k.length) return null;
    if (t <= k[0].t) return k[0];
    const last = k[k.length - 1];
    if (t >= last.t) return last;

    let lo = 0;
    let hi = k.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (k[mid].t <= t) lo = mid;
      else hi = mid;
    }
    const a = k[lo];
    const b = k[hi];
    const span = b.t - a.t;
    const u = span <= 0 ? 0 : smootherstep((t - a.t) / span);
    const raw = span <= 0 ? 0 : (t - a.t) / span;
    const uPos = easeOutBack(raw);
    const uRot = easeLag(raw);
    const mix = (p, e) => a[p] + (b[p] - a[p]) * e;
    // Digits ripple; the face keeps the plain ease, since expression is not
    // articulated the way a hand is.
    const te = digitEases(raw);
    const v = lerpVec(a.v, b.v, u);
    lerpHand(a.v, b.v, v, 0, te);
    lerpHand(a.v, b.v, v, POSE_LEN, te);

    /* Hands travel in arcs, not straight lines. Bulge the path perpendicular
     * to the direction of travel, peaking mid-move and scaled to how far the
     * hand is going, so short moves stay direct and long ones sweep. */
    const arc = Math.sin(Math.PI * clamp01(raw)) * ARC;
    const bow = (kx, ky) => {
      const dx = b[kx] - a[kx];
      const dy = b[ky] - a[ky];
      const d = Math.hypot(dx, dy);
      // Below a few units the "travel" is a hold or a tremor, not a path.
      if (d < 24) return [0, 0];
      const s = arc * Math.min(d, 180);
      return [-(dy / d) * s, (dx / d) * s];
    };
    const bowR = bow('x', 'y');
    const bowL = bow('x2', 'y2');

    return {
      v,
      x: mix('x', uPos) + bowR[0], y: mix('y', uPos) + bowR[1],
      z: mix('z', uPos), r: mix('r', uRot),
      x2: mix('x2', uPos) - bowL[0], y2: mix('y2', uPos) + bowL[1],
      z2: mix('z2', uPos), r2: mix('r2', uRot),
      // Crossing zero narrows the hand to its edge and opens it the other way,
      // which is what turning the palm over actually looks like from the front.
      pf: mix('pf', uRot), pf2: mix('pf2', uRot),
    };
  }

  itemAt(t) {
    for (let i = 0; i < this.items.length; i++) {
      if (t >= this.items[i].t0 && t < this.items[i].t1) return i;
    }
    return t >= this.duration ? -1 : 0;
  }
}

/* ---------------------------------------------------------------- *
 * Player
 * ---------------------------------------------------------------- */

class Player {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = null;      // set by scene3d.js once WebGL is up
    this.timeline = new Timeline();
    this.t = 0;
    this.speed = 1;
    this.playing = false;
    this.onItem = null;
    this.onEnd = null;
    this._lastItem = null;
    this._raf = null;
    this._prev = 0;
    this._nextBlink = 1200;
    this._blinkStart = -1e9;
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (this.renderer && this.renderer.resize) {
      this.renderer.resize(rect.width || 400, rect.height || 520);
    }
    this.draw();
  }

  attach(renderer) {
    this.renderer = renderer;
    this.resize();
    this.start();
  }

  setTimeline(tl) {
    this.timeline = tl;
    this.t = 0;
    this._lastItem = null;
  }

  // One always-on loop: the avatar keeps blinking and breathing between
  // utterances, which is most of the time.
  start() {
    if (this._raf) return;
    this._prev = performance.now();
    const step = (now) => {
      const dt = Math.min(64, now - this._prev);
      this._prev = now;
      if (this.playing) {
        this.t += dt * this.speed;
        const idx = this.timeline.itemAt(this.t);
        if (idx !== this._lastItem) {
          this._lastItem = idx;
          if (this.onItem) this.onItem(idx, this.timeline.items[idx]);
        }
        if (this.t >= this.timeline.duration + 200) {
          this.playing = false;
          if (this.onEnd) this.onEnd();
        }
      }
      this.draw(now);
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  play() {
    this.playing = true;
    this.start();
  }

  pause() {
    this.playing = false;
  }

  seek(t) {
    this.t = t;
    this.draw();
  }

  colors() {
    return palette();
  }

  // Blinks and breathing are procedural: they are not linguistic, so they must
  // not live on the sign timeline.
  idle(now) {
    if (now > this._nextBlink) {
      this._blinkStart = now;
      this._nextBlink = now + 2600 + Math.random() * 3400;
    }
    const dt = now - this._blinkStart;
    const BLINK = 130;
    const blink = dt >= 0 && dt < BLINK ? 1 - Math.abs(dt / (BLINK / 2) - 1) : 0;
    return {
      blink,
      breath: Math.sin(now / 1900),
      swayX: Math.sin(now / 1450) * 0.9 + Math.sin(now / 610) * 0.4,
      swayY: Math.cos(now / 1180) * 0.8,
      gaze: Math.sin(now / 2600) * 0.12,
    };
  }

  draw(now) {
    if (!this.renderer) return;
    const F = window.SLFace;
    const time = now === undefined ? performance.now() : now;
    const idle = this.idle(time);

    const s = this.timeline.sample(this.t) || {
      v: poseToVec(window.SL.POSES.REST)
        .concat(poseToVec(window.SL.POSES.REST), F.faceToVec(F.FACES.neutral)),
      x: window.SL.A_.rest[0], y: window.SL.A_.rest[1], z: window.SL.A_.rest[2],
      r: REST_HAND_ROT,
      x2: window.SL.A_.rest2[0], y2: window.SL.A_.rest2[1], z2: window.SL.A_.rest2[2],
      r2: REST_HAND_ROT,
      pf: window.SL.PALM_REST, pf2: window.SL.PALM_REST,
    };

    const face = F.vecToFace(s.v.slice(POSE_LEN * 2));
    face.eyeOpen *= 1 - idle.blink;
    face.gazeX += idle.gaze;

    this.renderer.frame({
      poseR: vecToPose(s.v.slice(0, POSE_LEN)),
      poseL: vecToPose(s.v.slice(POSE_LEN, POSE_LEN * 2)),
      wristR: { x: s.x + idle.swayX, y: s.y + idle.swayY, z: s.z, rot: s.r,
                palm: s.pf === undefined ? window.SL.PALM_DEFAULT : s.pf },
      wristL: { x: s.x2 - idle.swayX, y: s.y2 + idle.swayY, z: s.z2, rot: s.r2,
                palm: s.pf2 === undefined ? window.SL.PALM_DEFAULT : s.pf2 },
      face,
      breath: idle.breath,
      colors: palette(),
    });
  }

}

window.SLPlayer = {
  Player, Timeline, STAGE_W, STAGE_H, HAND_SCALE, POSE_LEN,
  drawHand, drawArm, poseToVec, vecToPose, palette,
};

})();
