/* flat.js — flat vector character renderer
 *
 * Implements the same frame(state) interface as scene3d.js, so the timeline,
 * gloss layer and pose data are untouched: only the drawing changes.
 *
 * Style: flat pastel fills, no outlines, stylised hair silhouette, simple
 * dot eyes, blush. The one deliberate departure from the reference art is the
 * hands — flat character art usually uses mittens, but in ASL the handshape
 * IS the phoneme, so the fingers stay fully articulated.
 */

(function () {
'use strict';

const STAGE_W = 400;
// Visible window into the figure: wider than the body so there is margin, and
// deep enough to show the character down to mid-thigh.
const VIEW = { x: -62, y: -12, w: 524, h: 700 };

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------------------- *
 * Character palette — the character's own colours, constant across themes
 * ---------------------------------------------------------------- */

const C = {
  skin: '#f4cba8',
  skinShade: '#e7b48c',
  skinDeep: '#d89b74',
  hair: '#d4622a',
  hairDark: '#b44e1f',
  shirt: '#f7f2e7',
  shirtShade: '#e7dfcd',
  collar: '#ffffff',
  pants: '#6d4d3a',
  pantsShade: '#5a3e2e',
  shoe: '#36363f',
  ink: '#2f2a33',
  mouth: '#b4574a',
  mouthDark: '#8d3f36',
  blush: 'rgba(233,138,118,0.38)',
  shadow: 'rgba(28,20,16,0.10)',
};

/* ---------------------------------------------------------------- *
 * Figure geometry (stage units) — anchors in signs.js are unchanged,
 * so the body must keep the same landmark positions.
 * ---------------------------------------------------------------- */

const HEAD = { x: 200, y: 112, rx: 47, ry: 55 };
const NECK_Y = 168;
const SHOULDER_Y = 214;
const SHOULDER_X = 56;
const HIP_Y = 424;
const UPPER = 96;
const FORE = 100;

const HAND_SCALE = 0.54;

const GEO = {
  palmW: 74,
  palmH: 84,
  fingers: [
    { bx: 25, by: -80, len: [32, 22, 16], w: [15, 13.5, 11.5] },
    { bx: 7, by: -86, len: [35, 24, 17], w: [15.5, 14, 12] },
    { bx: -11, by: -83, len: [32, 22, 16], w: [14.5, 13, 11] },
    { bx: -28, by: -73, len: [25, 17, 13], w: [13, 11.5, 10] },
  ],
  thumb: { bx: 33, by: -14, len: [30, 24], w: [19, 16] },
};
const BEND_RATE = 0.78;
const THUMB_RATE = 0.62;
const SHORTEN = 0.3;
const EDGE = 2.4;        // darker rim that keeps touching digits apart
/* Thumb spread, in degrees, below which the thumb lies against the hand
 * rather than out to the side of it. Under that it is hidden entirely when the
 * back is towards the viewer: a folded thumb is behind the hand from there and
 * nothing of it should show. Above it — L, C, OPEN, G — the thumb clears the
 * outline and is genuinely visible from behind. */
const THUMB_ABDUCTED = 20;

/* ---------------------------------------------------------------- *
 * Drawing helpers
 * ---------------------------------------------------------------- */

function roundedLimb(ctx, x0, y0, x1, y1, w, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

/* Elbow placement.
 *
 * Most anchors sit 35–60 units from the shoulder while the arm is 196 units of
 * bone, so rigid bones can only reach them by folding to a right angle — a
 * ~95-unit bow. Choosing between the two mirror solutions by "whichever is
 * lower on screen" then sent that bow across the torso for anything at face
 * height, and flipped it mid-transition, which is what read as an inverted
 * elbow. Two changes:
 *
 *   1. The bones foreshorten on a short reach, the way a real arm angles
 *      toward the viewer when the hand comes to the signer's own face.
 *   2. The elbow is placed by angle rather than picked from two branches: it
 *      rests down and slightly outward, and rotates away from that rest
 *      direction only as far as the forearm needs to reach. There is no branch
 *      to swap, so the elbow cannot pop.
 */
const CENTRE = 200;      // torso midline; the elbow stays on its own side of it
const MAX_BOW = 36;      // furthest the elbow sits off the shoulder→wrist line
const POLE_OUT = 0.15;   // outward lean of the elbow's rest direction
const POLE_CUT = 2.35;   // reach angle past which the arm straightens out

function solveArm(sx, sy, wxp, wyp) {
  const dx = wxp - sx;
  const dy = wyp - sy;
  const raw = Math.hypot(dx, dy) || 0.001;
  const dist = Math.min(UPPER + FORE - 4, raw);

  // Where the elbow wants to sit: down, and away from the body.
  const out = sx < CENTRE ? -1 : 1;
  const pole = Math.atan2(1, POLE_OUT * out);
  const theta = Math.atan2(dy, dx);
  let d = pole - theta;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;

  // Reaching straight back along the elbow's rest direction leaves no side to
  // bend towards, so the arm straightens as it approaches that: the two ways
  // to bend meet instead of swapping, which is what keeps the motion smooth.
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
  return { x: sx + Math.cos(phi) * up, y: sy + Math.sin(phi) * up };
}

/* ---------------------------------------------------------------- *
 * Hand — flat fills, no creases or gradients
 * ---------------------------------------------------------------- */

/* Digits are drawn back to front, and on the palm side each gets a darker rim
 * before its fill, so a finger's rim cuts a line into the one behind it —
 * without that, four same-coloured strokes side by side merge into one mitten
 * and the handshape, which is the phoneme, stops being readable.
 *
 * From the back of the hand the rim is dropped. There the fingers run
 * continuously out of the hand rather than sitting on top of it, and outlining
 * each one makes them read as separate strips laid over the back. The joint
 * pips still mark where a finger bends. */
function chain(ctx, x, y, baseAngle, flex, lens, widths, rate, color, rim) {
  let cx = x;
  let cy = y;
  let a = baseAngle;
  const pts = [{ x: cx, y: cy }];
  for (let i = 0; i < lens.length; i++) {
    a += rad(flex[i] * rate);
    const L = lens[i] * (1 - SHORTEN * Math.min(1, Math.abs(flex[i]) / 95));
    cx += Math.sin(a) * L;
    cy -= Math.cos(a) * L;
    pts.push({ x: cx, y: cy });
  }
  ctx.lineCap = 'round';
  for (const pass of (rim === false ? [false] : [true, false])) {
    ctx.strokeStyle = pass ? C.skinDeep : color;
    for (let i = 0; i < lens.length; i++) {
      ctx.lineWidth = widths[i] + (pass ? EDGE * 2 : 0);
      ctx.beginPath();
      ctx.moveTo(pts[i].x, pts[i].y);
      ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
      ctx.stroke();
    }
    // A knuckle pip at each joint keeps a bent finger from reading as a
    // straight one that happens to be short.
    if (!pass) {
      for (let i = 1; i < pts.length - 1; i++) {
        if (Math.abs(flex[i]) < 22) continue;
        ctx.fillStyle = C.skinShade;
        ctx.globalAlpha = 0.55;
        ctx.beginPath();
        ctx.arc(pts[i].x, pts[i].y, widths[i] * 0.30, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }
}

/* The geometry above is the signer's RIGHT hand seen from the BACK: fingers
 * run index→pinky along descending `bx` with the thumb out at +x, and a right
 * hand turned palm-inwards puts its thumb on the viewer's right.
 *
 * In a flat drawing, which hand it is and which way the palm points are the
 * same degree of freedom — mirroring the outline either swaps hands or turns
 * the palm over, and nothing in the picture says which. So both have to be
 * supplied: `mirror` marks the non-dominant hand, `palm` is +1 facing the
 * viewer and -1 facing the signer, and their product is the chirality. A
 * `palm` between the two narrows the hand towards its edge, which is what a
 * hand turning over looks like from the front.
 *
 * Rotation is untouched by either, so a positive `rot` still turns the
 * dominant hand clockwise and the two hands still mirror through a symmetric
 * two-handed sign. */
function drawHand(ctx, pose, x, y, rot, scale, mirror, palm) {
  const pf = palm === undefined ? 1 : palm;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(mirror ? -rot : rot));
  ctx.scale((mirror ? 1 : -1) * pf * scale, scale);

  const backToViewer = pf < 0;
  const rim = !backToViewer;
  const t = GEO.thumb;
  const drawThumb = () => chain(ctx, t.bx, t.by, rad(pose.ts),
    [-pose.th[0], -pose.th[1]], t.len, t.w, THUMB_RATE, C.skin, rim);
  const drawPalm = () => {
    const halfW = GEO.palmW / 2;
    ctx.fillStyle = C.skin;
    ctx.beginPath();
    ctx.moveTo(-halfW + 4, 8);
    ctx.quadraticCurveTo(-halfW - 4, -30, -halfW + 2, -GEO.palmH + 8);
    ctx.quadraticCurveTo(-halfW + 6, -GEO.palmH - 2, -halfW + 20, -GEO.palmH - 1);
    ctx.lineTo(halfW - 14, -GEO.palmH + 4);
    ctx.quadraticCurveTo(halfW + 4, -GEO.palmH + 12, halfW + 2, -34);
    ctx.quadraticCurveTo(halfW + 2, 6, halfW - 16, 12);
    ctx.closePath();
    ctx.fill();
    // No rim on the palm. The digits need one to stay apart from each other,
    // but outlining the palm too draws a hard edge across the wrist, and the
    // hand reads as a flipper stuck on the end of an un-outlined arm.
  };

  /* The thumb sits on one side of the hand, and which side is towards the
   * viewer is the whole difference between seeing a palm and seeing the back.
   * Chirality alone does not carry that: a thumb laid over the front of the
   * hand reads as a palm no matter which way round the outline is, which is
   * why THANK-YOU still looked palm-forward. So it is drawn behind the palm
   * when the back is towards the viewer — only the part that clears the
   * silhouette shows, the way a thumb does from behind — and over the palm
   * when the palm is towards the viewer. */
  if (backToViewer && pose.ts >= THUMB_ABDUCTED) drawThumb();
  drawPalm();

  for (let i = 3; i >= 0; i--) {
    const g = GEO.fingers[i];
    chain(ctx, g.bx, g.by, rad(pose.s[i]), pose.f[i], g.len, g.w, BEND_RATE, C.skin, rim);
  }
  if (!backToViewer) drawThumb();

  ctx.restore();
}

/* ---------------------------------------------------------------- *
 * Body
 * ---------------------------------------------------------------- */

function drawLegsAndShoes(ctx) {
  // Drawn in full even though the view crops at the waist, so the figure is
  // a whole character rather than a bust.
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.ellipse(200, 872, 78, 13, 0, 0, Math.PI * 2);
  ctx.fill();

  // hips read as one shape, legs separate below
  ctx.fillStyle = C.pants;
  ctx.beginPath();
  ctx.moveTo(200 - 62, HIP_Y - 6);
  ctx.lineTo(200 + 62, HIP_Y - 6);
  ctx.lineTo(200 + 56, HIP_Y + 78);
  ctx.lineTo(200 - 56, HIP_Y + 78);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = C.pants;
  ctx.lineCap = 'butt';
  ctx.lineWidth = 44;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(200 + s * 30, HIP_Y + 60);
    ctx.lineTo(200 + s * 34, 858);
    ctx.stroke();
  }
  // notch between the legs
  ctx.fillStyle = C.shadow;
  ctx.beginPath();
  ctx.moveTo(200, HIP_Y + 62);
  ctx.lineTo(200 + 7, 858);
  ctx.lineTo(200 - 7, 858);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.shoe;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(200 + s * 34, 862, 30, 16, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(200 + s * 34 - 30, 858, 60, 14);
  }
}

function drawTorso(ctx, breath) {
  ctx.save();
  ctx.translate(0, breath * 1.1);

  /* Shoulders slope. The line runs from the neck out and down to the joint
   * before it turns for the side of the body, rather than reaching full width
   * almost immediately — that near-square corner was what made the figure read
   * as a doll. The shoulder tip lands where the arm is rooted (SHOULDER_X,
   * SHOULDER_Y), so the sleeve continues the line instead of sitting on it. */
  ctx.fillStyle = C.shirt;
  ctx.beginPath();
  ctx.moveTo(200 - SHOULDER_X - 6, HIP_Y + 12);
  ctx.lineTo(200 - SHOULDER_X - 4, 264);
  ctx.quadraticCurveTo(200 - SHOULDER_X - 5, 226, 200 - SHOULDER_X + 4, 199);
  ctx.quadraticCurveTo(200 - 44, 192, 200 - 33, 190);
  ctx.quadraticCurveTo(200, 183, 200 + 33, 190);
  ctx.quadraticCurveTo(200 + 44, 192, 200 + SHOULDER_X - 4, 199);
  ctx.quadraticCurveTo(200 + SHOULDER_X + 5, 226, 200 + SHOULDER_X + 4, 264);
  ctx.lineTo(200 + SHOULDER_X + 6, HIP_Y + 12);
  ctx.closePath();
  ctx.fill();

  // one soft shade band gives form without breaking the flat look
  ctx.fillStyle = C.shirtShade;
  ctx.beginPath();
  ctx.moveTo(200 + 18, 192);
  ctx.quadraticCurveTo(200 + 44, 192, 200 + SHOULDER_X - 4, 199);
  ctx.quadraticCurveTo(200 + SHOULDER_X + 5, 226, 200 + SHOULDER_X + 4, 264);
  ctx.lineTo(200 + SHOULDER_X + 6, HIP_Y + 12);
  ctx.lineTo(200 + 22, HIP_Y + 12);
  ctx.closePath();
  ctx.fill();

  // collar
  ctx.fillStyle = C.collar;
  ctx.beginPath();
  ctx.moveTo(200 - 30, 194);
  ctx.quadraticCurveTo(200 - 16, 190, 200 - 6, 196);
  ctx.lineTo(200, 226);
  ctx.lineTo(200 - 24, 206);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(200 + 30, 194);
  ctx.quadraticCurveTo(200 + 16, 190, 200 + 6, 196);
  ctx.lineTo(200, 226);
  ctx.lineTo(200 + 24, 206);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawNeck(ctx, f, breath) {
  ctx.save();
  ctx.translate(f.headTurn * 3, breath * 1.1);
  ctx.fillStyle = C.skinShade;
  ctx.beginPath();
  ctx.moveTo(200 - 17, 140);
  ctx.lineTo(200 - 15, 202);
  ctx.lineTo(200 + 15, 202);
  ctx.lineTo(200 + 17, 140);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawFace(ctx, f, breath) {
  const turn = clamp(f.headTurn, -1, 1);
  const nod = clamp(f.headNod, -1, 1);
  const shift = turn * 9;
  const drop = nod * 6;

  ctx.save();
  ctx.translate(200, NECK_Y + breath * 1.1);
  ctx.rotate(rad(f.headTilt * 11));
  ctx.translate(-200, -NECK_Y);
  ctx.translate(turn * 5, drop * 0.6);

  const hx = HEAD.x;
  const hy = HEAD.y;

  // ears
  ctx.fillStyle = C.skinShade;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + s * (HEAD.rx - 3), hy + 10, 8, 12, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // head
  ctx.fillStyle = C.skin;
  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2);
  ctx.fill();

  // stylised swept hair: one silhouette shape with a couple of points
  ctx.fillStyle = C.hair;
  ctx.beginPath();
  ctx.moveTo(hx - HEAD.rx - 2, hy + 6);
  ctx.quadraticCurveTo(hx - HEAD.rx - 6, hy - 44, hx - 22, hy - HEAD.ry - 4);
  ctx.quadraticCurveTo(hx + 6, hy - HEAD.ry - 16, hx + 30, hy - HEAD.ry + 2);
  ctx.lineTo(hx + 52, hy - HEAD.ry - 10);
  ctx.quadraticCurveTo(hx + 50, hy - 40, hx + HEAD.rx + 2, hy - 18);
  ctx.quadraticCurveTo(hx + HEAD.rx - 2, hy - 34, hx + 22, hy - 34);
  ctx.quadraticCurveTo(hx - 12, hy - 30, hx - 24, hy - 8);
  ctx.quadraticCurveTo(hx - 34, hy + 6, hx - HEAD.rx - 2, hy + 6);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = C.hairDark;
  ctx.beginPath();
  ctx.moveTo(hx + 22, hy - 34);
  ctx.quadraticCurveTo(hx + 46, hy - 40, hx + 52, hy - HEAD.ry - 10);
  ctx.quadraticCurveTo(hx + 50, hy - 34, hx + HEAD.rx + 2, hy - 18);
  ctx.quadraticCurveTo(hx + 44, hy - 26, hx + 22, hy - 30);
  ctx.closePath();
  ctx.fill();

  const fx = hx + shift;
  const fy = hy + drop * 0.5;

  // blush
  ctx.fillStyle = C.blush;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(fx + s * 28, fy + 16, 11, 7.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // brows — simple thick strokes
  ctx.strokeStyle = C.ink;
  ctx.lineCap = 'round';
  ctx.lineWidth = 5;
  for (const s of [-1, 1]) {
    const lift = -f.brow * 7;
    const tilt = f.browTilt * 5.5 * (s < 0 ? 1 : -1);
    const bx = fx + s * 17;
    const by = fy - 19 + lift;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by + tilt * (s < 0 ? -1 : 1) + 1);
    ctx.quadraticCurveTo(bx, by - 3.5, bx + 10, by - tilt * (s < 0 ? -1 : 1) + 1);
    ctx.stroke();
  }

  // eyes — flat dark ovals, lids close by scaling height
  const open = clamp(f.eyeOpen, 0, 1.3) * (1 - f.squint * 0.4);
  ctx.fillStyle = C.ink;
  for (const s of [-1, 1]) {
    const ex = fx + s * 17 + f.gazeX * 2.2;
    const ey = fy - 3 + f.gazeY * 1.6;
    const h = 7.4 * open;
    if (h < 1.1) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = C.ink;
      ctx.beginPath();
      ctx.moveTo(ex - 6, ey);
      ctx.quadraticCurveTo(ex, ey + 2.6, ex + 6, ey);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.ellipse(ex, ey, 5.4, h, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // nose — a soft wedge, barely there
  ctx.fillStyle = C.skinDeep;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.moveTo(fx - 1, fy + 6);
  ctx.quadraticCurveTo(fx + 5, fy + 13, fx - 2, fy + 14);
  ctx.closePath();
  ctx.fill();
  ctx.globalAlpha = 1;

  // mouth
  const mOpen = clamp(f.mouthOpen, 0, 1);
  const mw = 9 * (1 + f.mouthWide * 0.5);
  const my = fy + 27;
  ctx.fillStyle = C.mouthDark;
  if (mOpen > 0.12) {
    ctx.beginPath();
    ctx.ellipse(fx, my + mOpen * 2, mw, 2.5 + mOpen * 8, 0, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.strokeStyle = C.mouth;
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    const curve = f.smile * 6;
    ctx.moveTo(fx - mw, my - curve * 0.3);
    ctx.quadraticCurveTo(fx, my + curve + 1.5, fx + mw, my - curve * 0.3);
    ctx.stroke();
  }

  ctx.restore();
}

function drawArm(ctx, sx, sy, wxp, wyp, side, breath) {
  const y0 = sy + breath * 1.1;
  const e = solveArm(sx, y0, wxp, wyp);

  // bare arm, shoulder to wrist
  roundedLimb(ctx, sx, y0, e.x, e.y, 27, C.skin);
  roundedLimb(ctx, e.x, e.y, wxp, wyp, 23, C.skin);

  /* Cap sleeve down the top of the upper arm. Its length is held between a
   * floor and a ceiling rather than taken as a fraction of the arm: on a sign
   * made at the signer's own face the upper arm foreshortens to almost
   * nothing, and a proportional sleeve collapsed into a ball sitting on the
   * shoulder. It also hangs from just below the shoulder line, so the round
   * cap does not dome up over the seam. */
  const dx = e.x - sx;
  const dy = e.y - y0;
  const len = Math.hypot(dx, dy) || 1;
  // Straight down and a little outwards when the arm is too short to aim it.
  const ux = len < 12 ? side * 0.28 : dx / len;
  const uy = len < 12 ? 0.96 : dy / len;
  const sleeve = Math.max(30, Math.min(58, len * 0.55));
  const y1 = y0 + 1;
  const ex = sx + ux * sleeve;
  const ey = y1 + uy * sleeve;
  roundedLimb(ctx, sx, y1, ex, ey, 34, C.shirt);
  ctx.save();
  ctx.globalAlpha = 0.5;
  roundedLimb(ctx, sx + side * 8, y1 + 2, ex + side * 5, ey, 11, C.shirtShade);
  ctx.restore();
}

/* ---------------------------------------------------------------- *
 * Renderer
 * ---------------------------------------------------------------- */

function create(canvas) {
  const ctx = canvas.getContext('2d');
  let W = 400;
  let H = 560;
  let dpr = 1;
  let scale = 1;
  let offX = 0;
  let offY = 0;

  return {
    resize(w, h) {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, w);
      H = Math.max(1, h);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      scale = Math.min(W / VIEW.w, H / VIEW.h);
      offX = (W - VIEW.w * scale) / 2 - VIEW.x * scale;
      offY = (H - VIEW.h * scale) / 2 - VIEW.y * scale;
    },
    frame(state) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(offX, offY);
      ctx.scale(scale, scale);

      const f = state.face;
      const b = state.breath;

      drawLegsAndShoes(ctx);
      drawTorso(ctx, b);
      drawNeck(ctx, f, b);
      drawFace(ctx, f, b);

      // depth cue: a hand held further forward reads slightly larger
      const dz = (z) => HAND_SCALE * (1 + (z - 0.2) * 0.30);

      const L = state.wristL;
      drawArm(ctx, 200 + SHOULDER_X, SHOULDER_Y, L.x, L.y, 1, b);
      drawHand(ctx, state.poseL, L.x, L.y, L.rot, dz(L.z), true, L.palm);

      const R = state.wristR;
      drawArm(ctx, 200 - SHOULDER_X, SHOULDER_Y, R.x, R.y, -1, b);
      drawHand(ctx, state.poseR, R.x, R.y, R.rot, dz(R.z), false, R.palm);

      ctx.restore();
    },
  };
}

window.SLFlat = { create, VIEW, STAGE_W, C };

// Attach unless the 3D scene was explicitly requested with ?3d
if (!/[?&]3d\b/.test(location.search) && window.SLApp && window.SLApp.player) {
  window.SLApp.player.attach(create(document.getElementById('stage')));
}

})();
