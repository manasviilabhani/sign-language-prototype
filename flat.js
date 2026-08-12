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

const HAND_SCALE = 0.60;

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

function solveArm(sx, sy, wxp, wyp, side) {
  const dx = wxp - sx;
  const dy = wyp - sy;
  const raw = Math.hypot(dx, dy) || 0.001;
  const max = UPPER + FORE - 4;
  const min = Math.abs(UPPER - FORE) + 26;
  const dist = Math.min(max, Math.max(min, raw));
  const ux = dx / raw;
  const uy = dy / raw;
  const a = (UPPER * UPPER - FORE * FORE + dist * dist) / (2 * dist);
  const h = Math.sqrt(Math.max(0, UPPER * UPPER - a * a));
  const mx = sx + ux * a;
  const my = sy + uy * a;
  const e1 = { x: mx - uy * h, y: my + ux * h };
  const e2 = { x: mx + uy * h, y: my - ux * h };
  // elbows hang; ties break away from the body
  if (Math.abs(e1.y - e2.y) < 12) return (e1.x - sx) * side > (e2.x - sx) * side ? e2 : e1;
  return e1.y > e2.y ? e1 : e2;
}

/* ---------------------------------------------------------------- *
 * Hand — flat fills, no creases or gradients
 * ---------------------------------------------------------------- */

function chain(ctx, x, y, baseAngle, flex, lens, widths, rate, color) {
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
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  for (let i = 0; i < lens.length; i++) {
    ctx.lineWidth = widths[i];
    ctx.beginPath();
    ctx.moveTo(pts[i].x, pts[i].y);
    ctx.lineTo(pts[i + 1].x, pts[i + 1].y);
    ctx.stroke();
  }
}

function drawHand(ctx, pose, x, y, rot, scale, mirror) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rad(mirror ? -rot : rot));
  ctx.scale(mirror ? -scale : scale, scale);

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

  for (let i = 3; i >= 0; i--) {
    const g = GEO.fingers[i];
    chain(ctx, g.bx, g.by, rad(pose.s[i]), pose.f[i], g.len, g.w, BEND_RATE, C.skin);
  }
  const t = GEO.thumb;
  chain(ctx, t.bx, t.by, rad(pose.ts), [-pose.th[0], -pose.th[1]], t.len, t.w, THUMB_RATE, C.skin);

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

  ctx.fillStyle = C.shirt;
  ctx.beginPath();
  ctx.moveTo(200 - SHOULDER_X - 8, HIP_Y + 12);
  ctx.lineTo(200 - SHOULDER_X - 4, 260);
  ctx.quadraticCurveTo(200 - SHOULDER_X - 2, SHOULDER_Y - 8, 200 - 30, 196);
  ctx.quadraticCurveTo(200, 188, 200 + 30, 196);
  ctx.quadraticCurveTo(200 + SHOULDER_X + 2, SHOULDER_Y - 8, 200 + SHOULDER_X + 4, 260);
  ctx.lineTo(200 + SHOULDER_X + 8, HIP_Y + 12);
  ctx.closePath();
  ctx.fill();

  // one soft shade band gives form without breaking the flat look
  ctx.fillStyle = C.shirtShade;
  ctx.beginPath();
  ctx.moveTo(200 + 16, 196);
  ctx.quadraticCurveTo(200 + SHOULDER_X + 2, SHOULDER_Y - 6, 200 + SHOULDER_X + 4, 262);
  ctx.lineTo(200 + SHOULDER_X + 8, HIP_Y + 12);
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
  const e = solveArm(sx, sy + breath * 1.1, wxp, wyp, side);
  roundedLimb(ctx, sx, sy + breath * 1.1, e.x, e.y, 32, C.shirt);
  roundedLimb(ctx, e.x, e.y, wxp, wyp, 24, C.skin);
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
      drawHand(ctx, state.poseL, L.x, L.y, L.rot, dz(L.z), true);

      const R = state.wristR;
      drawArm(ctx, 200 - SHOULDER_X, SHOULDER_Y, R.x, R.y, -1, b);
      drawHand(ctx, state.poseR, R.x, R.y, R.rot, dz(R.z), false);

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
