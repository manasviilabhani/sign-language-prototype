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

/* ---------------------------------------------------------------- *
 * Two-bone arm IK — keeps the wrist attached to a shoulder
 * ---------------------------------------------------------------- */

const SHOULDER = { x: 143, y: 224 };          // dominant (signer's right)
const SHOULDER_L = { x: 257, y: 224 };        // passive, rests at the side
const REST_HAND_ROT = 168;   // a hand hanging at the side points down
const UPPER = 96;
const FORE = 100;

// `side` picks which way the elbow swings: away from the body on each side.
function solveArm(sh, wx, wy, side) {
  const dx = wx - sh.x;
  const dy = wy - sh.y;
  const raw = Math.hypot(dx, dy) || 0.001;

  // Clamp the reach into the range the two bones can actually span, keeping
  // the direction intact — scaling only `dist` desyncs it from (dx, dy) and
  // throws the elbow far off the shoulder-wrist line.
  const max = UPPER + FORE - 4;
  const min = Math.abs(UPPER - FORE) + 26;
  const dist = Math.min(max, Math.max(min, raw));
  const ux = dx / raw;
  const uy = dy / raw;

  const a = (UPPER * UPPER - FORE * FORE + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  const mx = sh.x + ux * a;
  const my = sh.y + uy * a;
  return { x: mx - side * uy * h, y: my + side * ux * h };
}

/* ---------------------------------------------------------------- *
 * Drawing
 * ---------------------------------------------------------------- */

function drawArm(ctx, C, wx, wy, sh, side) {
  const shoulder = sh || SHOULDER;
  const e = solveArm(shoulder, wx, wy, side === undefined ? 1 : side);
  ctx.save();
  ctx.lineCap = 'round';
  // Each bone is its own stroke: a single polyline with a round join spikes
  // into a wedge when the elbow angle gets sharp.
  // Sleeve to the elbow, bare forearm below it.
  const bones = [
    [shoulder, e, 30, C.shirtDark, 26, C.shirt],
    [e, { x: wx, y: wy }, 24, C.skinShade, 20, C.skin],
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
  ctx.arc(e.x, e.y, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawChain(ctx, C, x, y, baseAngle, flex, lens, widths, rate) {
  let cx = x;
  let cy = y;
  let a = baseAngle;
  let acc = 0;
  const pts = [{ x: cx, y: cy }];
  for (let i = 0; i < lens.length; i++) {
    acc += Math.abs(flex[i]);
    a += rad(flex[i] * rate);
    const shorten = 1 - SHORTEN * Math.min(1, Math.abs(flex[i]) / 95);
    const L = lens[i] * shorten;
    cx += Math.sin(a) * L;
    cy -= Math.cos(a) * L;
    pts.push({ x: cx, y: cy });
  }

  // outline pass then fill pass, so joints read as one solid digit
  for (const pass of [0, 1]) {
    ctx.strokeStyle = pass === 0 ? C.skinEdge : C.skin;
    for (let i = 0; i < lens.length; i++) {
      ctx.lineWidth = widths[i] + (pass === 0 ? 3.5 : 0);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
  }
  return pts[pts.length - 1];
}

// `mirror` draws the same pose data as a left hand.
function drawHand(ctx, C, pose, x, y, rot, scale, mirror) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(mirror ? -rot : rot));
  ctx.scale(mirror ? -scale : scale, scale);

  const halfW = GEO.palmW / 2;

  // palm
  ctx.beginPath();
  ctx.moveTo(-halfW + 4, 6);
  ctx.quadraticCurveTo(-halfW - 4, -30, -halfW + 2, -GEO.palmH + 8);
  ctx.quadraticCurveTo(-halfW + 6, -GEO.palmH - 2, -halfW + 20, -GEO.palmH - 1);
  ctx.lineTo(halfW - 14, -GEO.palmH + 4);
  ctx.quadraticCurveTo(halfW + 4, -GEO.palmH + 12, halfW + 2, -34);
  ctx.quadraticCurveTo(halfW + 2, 4, halfW - 14, 10);
  ctx.closePath();
  ctx.fillStyle = C.skin;
  ctx.strokeStyle = C.skinEdge;
  ctx.lineWidth = 3.5;
  ctx.fill();
  ctx.stroke();

  // fingers, pinky first so the index reads on top
  for (let i = 3; i >= 0; i--) {
    const g = GEO.fingers[i];
    drawChain(ctx, C, g.bx, g.by, rad(pose.s[i]), pose.f[i], g.len, g.w, BEND_RATE);
  }

  // thumb: base angle swings out from the palm, flexion folds it back in
  const t = GEO.thumb;
  drawChain(ctx, C, t.bx, t.by, rad(pose.ts), [-pose.th[0], -pose.th[1]], t.len, t.w, THUMB_RATE);

  // wrist cuff
  ctx.beginPath();
  ctx.ellipse(0, 10, halfW - 12, 9, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.skinEdge;
  ctx.fill();

  ctx.restore();
}

/* ---------------------------------------------------------------- *
 * Timeline
 * ---------------------------------------------------------------- */

const TRANS = 150; // ms of travel between two held keyframes

class Timeline {
  constructor() {
    this.keys = [];
    this.duration = 0;
    this.items = []; // { label, kind, t0, t1 }
  }

  // `defaultFace` is the resolved non-manual marker for the whole item, either
  // a name or a composed face object; individual frames may override it via
  // `fc` (a head shake has to alternate within one sign).
  add(frames, label, kind, defaultFace, faceLabel) {
    const t0 = this.duration;
    const F = window.SLFace;
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
      const r2 = f.r2 === undefined ? REST_HAND_ROT : f.r2;
      const fc = f.fc ? F.FACES[f.fc] || base : base;
      const v = poseToVec(p).concat(poseToVec(p2), F.faceToVec(fc));
      const start = this.keys.length ? this.duration + TRANS : 0;
      const k = { v, x: f.x, y: f.y, r: f.r, x2, y2, r2 };
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
    const mix = (p) => a[p] + (b[p] - a[p]) * u;
    return {
      v: lerpVec(a.v, b.v, u),
      x: mix('x'), y: mix('y'), r: mix('r'),
      x2: mix('x2'), y2: mix('y2'), r2: mix('r2'),
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
    this.ctx = canvas.getContext('2d');
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
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const w = rect.width || 400;
    const h = rect.height || 520;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.scale = Math.min(w / STAGE_W, h / STAGE_H);
    this.offX = (w - STAGE_W * this.scale) / 2;
    this.offY = (h - STAGE_H * this.scale) / 2;
    this.dpr = dpr;
    this.draw();
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
    const cs = getComputedStyle(document.documentElement);
    const g = (n, f) => (cs.getPropertyValue(n) || '').trim() || f;
    return {
      skin: g('--skin', '#e9b78e'),
      skinEdge: g('--skin-edge', '#9b6136'),
      skinShade: g('--skin-shade', '#d29a6f'),
      shirt: g('--shirt', '#6366f1'),
      shirtDark: g('--shirt-dark', '#4338ca'),
      hair: g('--hair', '#3b2a24'),
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
    return { blink, breath: Math.sin(now / 1900) };
  }

  draw(now) {
    const ctx = this.ctx;
    const C = this.colors();
    const F = window.SLFace;
    const time = now === undefined ? performance.now() : now;
    const { blink, breath } = this.idle(time);

    ctx.save();
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.translate(this.offX, this.offY);
    ctx.scale(this.scale, this.scale);

    const s = this.timeline.sample(this.t) || {
      v: poseToVec(window.SL.POSES.REST)
        .concat(poseToVec(window.SL.POSES.REST), F.faceToVec(F.FACES.neutral)),
      x: window.SL.A_.rest[0],
      y: window.SL.A_.rest[1],
      r: REST_HAND_ROT,
      x2: window.SL.A_.rest2[0],
      y2: window.SL.A_.rest2[1],
      r2: REST_HAND_ROT,
    };
    const hv = s.v.slice(0, POSE_LEN);
    const hv2 = s.v.slice(POSE_LEN, POSE_LEN * 2);
    const fc = F.vecToFace(s.v.slice(POSE_LEN * 2));
    fc.eyeOpen *= 1 - blink;

    F.drawAvatar(ctx, C, fc, breath);

    // Non-dominant hand first so the dominant one reads on top.
    const y2 = s.y2 + breath * 1.2;
    drawArm(ctx, C, s.x2, y2, SHOULDER_L, -1);
    drawHand(ctx, C, vecToPose(hv2), s.x2, y2, s.r2, HAND_SCALE, true);
    drawArm(ctx, C, s.x, s.y);
    drawHand(ctx, C, vecToPose(hv), s.x, s.y, s.r, HAND_SCALE);

    ctx.restore();
  }
}

window.SLPlayer = {
  Player, Timeline, STAGE_W, STAGE_H, HAND_SCALE, POSE_LEN,
  drawHand, drawArm, poseToVec, vecToPose,
};

})();
