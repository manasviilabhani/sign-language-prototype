/* face.js — avatar body + face rig (non-manual markers)
 *
 * In ASL the face is grammar, not decoration: brow position alone separates a
 * WH-question from a statement, and negation is carried by a head shake. The
 * rig below exposes those as continuous parameters so they interpolate on the
 * same timeline as the hand.
 */

(function () {
'use strict';

/* ---------------------------------------------------------------- *
 * Face parameters
 * ---------------------------------------------------------------- */

const FACE_KEYS = [
  'brow',      // -1 furrowed/down .. +1 raised
  'browTilt',  // -1 inner ends up (sad) .. +1 inner ends down (angry)
  'eyeOpen',   // 0 shut .. 1 normal .. 1.4 wide
  'squint',    // 0 .. 1
  'gazeX',     // -1 viewer-left .. +1 viewer-right
  'gazeY',     // -1 up .. +1 down
  'mouthOpen', // 0 .. 1
  'mouthWide', // -1 pursed .. +1 spread
  'smile',     // -1 frown .. +1 smile
  'cheek',     // 0 .. 1 puffed
  'tongue',    // 0 .. 1 visible
  'headTurn',  // -1 .. +1 yaw
  'headTilt',  // -1 .. +1 roll
  'headNod',   // -1 back .. +1 forward/down
];

const FACE_DEFAULT = {
  brow: 0, browTilt: 0, eyeOpen: 1, squint: 0, gazeX: 0, gazeY: 0,
  mouthOpen: 0, mouthWide: 0, smile: 0.15, cheek: 0, tongue: 0,
  headTurn: 0, headTilt: 0, headNod: 0,
};

function face(o) {
  return Object.assign({}, FACE_DEFAULT, o || {});
}

/* Named non-manual markers. The grammatical ones (wh, yn, neg, topic) matter
 * more than the emotional ones — they change what a sentence means. */
const FACES = {
  neutral: face({}),

  // Grammatical markers
  wh: face({ brow: -0.85, browTilt: 0.45, squint: 0.3, headNod: 0.3, smile: -0.05, mouthWide: 0.2 }),
  yn: face({ brow: 0.95, eyeOpen: 1.18, headNod: 0.32, smile: 0.25 }),
  neg: face({ brow: -0.5, browTilt: 0.35, smile: -0.35, squint: 0.15 }),
  aff: face({ brow: 0.3, smile: 0.4 }),
  // Alternating poses that make the head shake / nod carrying the marker
  negL: face({ brow: -0.5, browTilt: 0.35, smile: -0.35, squint: 0.15, headTurn: -0.6 }),
  negR: face({ brow: -0.5, browTilt: 0.35, smile: -0.35, squint: 0.15, headTurn: 0.6 }),
  affDown: face({ brow: 0.3, smile: 0.4, headNod: 0.6 }),
  affUp: face({ brow: 0.35, smile: 0.4, headNod: -0.15 }),
  topic: face({ brow: 0.9, eyeOpen: 1.1, headNod: -0.15 }),

  // Mouth morphemes
  mm: face({ mouthWide: -0.3, mouthOpen: 0.12, smile: 0 }),
  oo: face({ mouthWide: -0.85, mouthOpen: 0.5, smile: 0 }),
  cha: face({ mouthOpen: 0.7, mouthWide: 0.35, smile: 0.2 }),
  th: face({ tongue: 1, mouthOpen: 0.32, mouthWide: 0.1 }),
  pah: face({ mouthOpen: 0.85, mouthWide: 0.5, brow: 0.6, eyeOpen: 1.2 }),

  // Affect
  smile: face({ smile: 0.8, eyeOpen: 0.92, squint: 0.16, brow: 0.15 }),
  happy: face({ smile: 1, eyeOpen: 0.85, squint: 0.35, brow: 0.35, mouthOpen: 0.25 }),
  sad: face({ smile: -0.8, brow: 0.45, browTilt: -0.6, eyeOpen: 0.8, gazeY: 0.3, headTilt: -0.12 }),
  angry: face({ brow: -1, browTilt: 0.8, squint: 0.5, smile: -0.5, mouthWide: -0.2 }),
  sleepy: face({ eyeOpen: 0.22, brow: -0.1, smile: -0.15, gazeY: 0.25, headTilt: 0.12 }),
  sorry: face({ brow: 0.4, browTilt: -0.5, smile: -0.3, headTilt: -0.12, eyeOpen: 0.9 }),
  polite: face({ smile: 0.55, brow: 0.35, headTilt: -0.08 }),
  aha: face({ brow: 0.8, eyeOpen: 1.1, smile: 0.5, mouthOpen: 0.2 }),
  surprise: face({ brow: 1, eyeOpen: 1.4, mouthOpen: 0.6 }),
};

// Human-readable descriptions for the UI, so the marker is legible to someone
// who can't read it off the face yet.
const FACE_LABELS = {
  neutral: '', wh: 'brows down — WH-question', yn: 'brows up — yes/no question',
  neg: 'negation', aff: 'affirmation', topic: 'topic marker',
  mm: 'mouth "mm"', oo: 'mouth "oo"', cha: 'mouth "cha"', th: 'mouth "th"', pah: 'mouth "pah"',
  smile: 'smile', happy: 'happy', sad: 'sad', angry: 'angry', sleepy: 'drowsy',
  sorry: 'regret', polite: 'polite', aha: 'realization', surprise: 'surprise',
};

/* Brows/head carry clause-level grammar; mouth and affect belong to the
 * individual sign. They co-occur on a real signer, so compose them by channel
 * rather than letting one replace the other. */
const GRAMMAR_CHANNEL = ['brow', 'browTilt', 'squint', 'headNod', 'eyeOpen'];

function compose(clause, sign) {
  const c = FACES[clause];
  const s = FACES[sign];
  const label = (n) => FACE_LABELS[n] || '';
  if (!c && !s) return { face: FACES.neutral, label: '' };
  if (!c) return { face: s, label: label(sign) };
  if (!s || sign === 'neutral' || sign === clause) return { face: c, label: label(clause) };

  const f = Object.assign({}, s);
  for (const k of GRAMMAR_CHANNEL) f[k] = c[k];
  return { face: f, label: [label(clause), label(sign)].filter(Boolean).join(' + ') };
}

function faceToVec(f) {
  return FACE_KEYS.map((k) => f[k]);
}

function vecToFace(v) {
  const o = {};
  FACE_KEYS.forEach((k, i) => { o[k] = v[i]; });
  return o;
}

/* ---------------------------------------------------------------- *
 * Avatar geometry (stage space, 400 x 520)
 * ---------------------------------------------------------------- */

const HEAD = { x: 200, y: 116, rx: 47, ry: 57 };
const NECK_PIVOT = { x: 200, y: 186 };
const EYE = { dx: 18, dy: -6, rx: 11, ry: 7.5 };
const BROW = { dx: 18, dy: -25, w: 13 };
const MOUTH = { dy: 30 };

const rad = (d) => (d * Math.PI) / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------------------------------------------------------------- *
 * Drawing
 * ---------------------------------------------------------------- */

function shade(ctx, x0, y0, x1, y1, stops) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const st of stops) g.addColorStop(st[0], st[1]);
  return g;
}

function drawTorso(ctx, C, breath) {
  ctx.save();
  ctx.translate(0, breath * 1.2);

  ctx.beginPath();
  ctx.moveTo(118, 520);
  ctx.lineTo(124, 300);
  ctx.quadraticCurveTo(130, 216, 168, 204);
  ctx.quadraticCurveTo(200, 197, 232, 204);
  ctx.quadraticCurveTo(270, 216, 276, 300);
  ctx.lineTo(282, 520);
  ctx.closePath();
  ctx.fillStyle = shade(ctx, 118, 200, 282, 460, [
    [0, C.shirtDark], [0.22, C.shirt], [0.62, C.shirtLight], [1, C.shirtDark],
  ]);
  ctx.fill();

  // shoulder seams and a soft fold under each arm give the shirt some form
  ctx.save();
  ctx.globalAlpha = 0.28;
  ctx.strokeStyle = C.shirtDark;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(160, 212);
  ctx.quadraticCurveTo(148, 250, 145, 300);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(240, 212);
  ctx.quadraticCurveTo(252, 250, 255, 300);
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.moveTo(177, 199);
  ctx.quadraticCurveTo(200, 230, 223, 199);
  ctx.quadraticCurveTo(200, 214, 177, 199);
  ctx.closePath();
  ctx.fillStyle = C.shirtDark;
  ctx.fill();
  ctx.restore();
}

function drawNeck(ctx, C, f, breath) {
  ctx.save();
  ctx.translate(f.headTurn * 3, breath * 1.2);
  ctx.beginPath();
  ctx.moveTo(182, 144);
  ctx.lineTo(180, 212);
  ctx.lineTo(220, 212);
  ctx.lineTo(218, 144);
  ctx.closePath();
  ctx.fillStyle = shade(ctx, 178, 0, 222, 0, [
    [0, C.skinShade], [0.4, C.skin], [1, C.skinShade],
  ]);
  ctx.fill();

  // shadow the jaw casts on the neck - the single biggest depth cue on a face
  ctx.clip();
  ctx.globalAlpha = 0.42;
  ctx.fillStyle = C.skinDeep;
  ctx.beginPath();
  ctx.ellipse(200, 140, 40, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEye(ctx, C, cx, cy, f, open) {
  const rx = EYE.rx;
  const ry = EYE.ry;
  const lidDrop = (1 - clamp(open, 0, 1.25)) * ry * 2;
  const lowerLift = f.squint * ry * 0.75;

  if (lidDrop >= ry * 1.85) {
    ctx.strokeStyle = C.lash;
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - rx, cy - 1);
    ctx.quadraticCurveTo(cx, cy + 3.6, cx + rx, cy - 1);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.clip();

  ctx.fillStyle = C.sclera;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

  ctx.globalAlpha = 0.18;
  ctx.fillStyle = C.skinDeep;
  ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 0.55);
  ctx.globalAlpha = 1;

  const ix = cx + f.gazeX * 4.5;
  const iy = cy + f.gazeY * 3.2;
  const ig = ctx.createRadialGradient(ix - 1.5, iy - 2, 1, ix, iy, 5.8);
  ig.addColorStop(0, C.irisLight);
  ig.addColorStop(1, C.iris);
  ctx.fillStyle = ig;
  ctx.beginPath();
  ctx.arc(ix, iy, 5.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.arc(ix, iy, 5.6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = C.pupil;
  ctx.beginPath();
  ctx.arc(ix, iy, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.beginPath();
  ctx.arc(ix - 2.1, iy - 2.3, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(ix + 2.2, iy + 2, 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  // eyelids close over the eye instead of the eye shrinking
  ctx.fillStyle = C.skinShade;
  ctx.fillRect(cx - rx, cy - ry - 1, rx * 2, lidDrop);
  if (lowerLift > 0.4) ctx.fillRect(cx - rx, cy + ry - lowerLift, rx * 2, lowerLift + 1);
  ctx.restore();

  ctx.strokeStyle = C.lash;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - rx, cy - ry + lidDrop + 1);
  ctx.quadraticCurveTo(cx, cy - ry + lidDrop - 2.6, cx + rx, cy - ry + lidDrop + 1);
  ctx.stroke();

  ctx.strokeStyle = C.line;
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawBrow(ctx, C, cx, cy, innerSign, f) {
  const lift = -f.brow * 8;
  const inner = f.browTilt * 6.5;
  const x0 = cx - EYE.rx - 3;
  const x1 = cx + EYE.rx + 3;
  const yInner = cy + lift + inner;
  const yOuter = cy + lift - inner * 0.35;
  const yL = innerSign > 0 ? yOuter : yInner;
  const yR = innerSign > 0 ? yInner : yOuter;
  const arch = -3 - f.brow * 2.5 + f.browTilt * 2;
  const midY = (yL + yR) / 2 + arch;

  // tapered shape rather than a uniform stroke
  ctx.beginPath();
  ctx.moveTo(x0, yL + 1.5);
  ctx.quadraticCurveTo(cx, midY - 2.6, x1, yR);
  ctx.quadraticCurveTo(cx, midY + 3.4, x0, yL + 3.6);
  ctx.closePath();
  ctx.fillStyle = C.brow;
  ctx.fill();
}

function drawMouth(ctx, C, cx, cy, f) {
  const open = clamp(f.mouthOpen, 0, 1);
  const w = 16 * (1 + f.mouthWide * 0.45) * (1 - open * 0.12);
  const h = 1.6 + open * 14;
  const smile = f.smile * 7;
  const topY = cy - smile * 0.45;

  const lip = function () {
    ctx.beginPath();
    ctx.moveTo(cx - w, topY);
    ctx.quadraticCurveTo(cx, cy - h * 0.45 - smile * 0.9, cx + w, topY);
    ctx.quadraticCurveTo(cx, cy + h + smile * 0.55, cx - w, topY);
    ctx.closePath();
  };

  if (open > 0.12) {
    lip();
    ctx.fillStyle = C.mouthInner;
    ctx.fill();
    ctx.save();
    lip();
    ctx.clip();
    ctx.fillStyle = C.teeth;
    ctx.fillRect(cx - w, topY - h * 0.5, w * 2, h * 0.6);
    if (f.tongue > 0.4) {
      ctx.fillStyle = C.tongue;
      ctx.beginPath();
      ctx.ellipse(cx, cy + h * 0.55, w * 0.5, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  } else {
    lip();
    ctx.fillStyle = shade(ctx, cx, topY - 4, cx, cy + h + 4,
      [[0, C.lipTop], [0.5, C.mouth], [1, C.lipBottom]]);
    ctx.fill();
  }

  ctx.strokeStyle = C.lipTop;
  ctx.lineWidth = 1.6;
  ctx.globalAlpha = 0.8;
  lip();
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - w * 0.45, cy + h * 0.5 + smile * 0.2);
  ctx.quadraticCurveTo(cx, cy + h * 0.75 + smile * 0.3, cx + w * 0.45, cy + h * 0.5 + smile * 0.2);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawHead(ctx, C, f, breath) {
  const turn = clamp(f.headTurn, -1, 1);
  const nod = clamp(f.headNod, -1, 1);
  const shift = turn * 9;
  const drop = nod * 7;

  ctx.save();
  ctx.translate(NECK_PIVOT.x, NECK_PIVOT.y + breath * 1.2);
  ctx.rotate(rad(f.headTilt * 13));
  ctx.translate(-NECK_PIVOT.x, -NECK_PIVOT.y);
  ctx.translate(turn * 5, drop * 0.7);

  const hx = HEAD.x;
  const hy = HEAD.y;

  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + s * (HEAD.rx - 2), hy + 6, 7.5, 12, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.skinShade;
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx + s * (HEAD.rx - 1), hy + 6, 3.4, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.skinDeep;
    ctx.globalAlpha = 0.5;
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.beginPath();
  ctx.ellipse(hx, hy - 7, HEAD.rx + 6, HEAD.ry + 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = shade(ctx, hx - 40, hy - 60, hx + 40, hy + 20,
    [[0, C.hairLight], [0.55, C.hair], [1, C.hairDark]]);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2);
  const fg = ctx.createRadialGradient(hx - 18, hy - 26, 6, hx, hy + 6, HEAD.ry + 16);
  fg.addColorStop(0, C.skinLight);
  fg.addColorStop(0.55, C.skin);
  fg.addColorStop(1, C.skinShade);
  ctx.fillStyle = fg;
  ctx.fill();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2);
  ctx.clip();
  const sg = ctx.createLinearGradient(hx + 6, hy, hx + HEAD.rx, hy);
  sg.addColorStop(0, 'rgba(0,0,0,0)');
  sg.addColorStop(1, C.skinDeep);
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = sg;
  ctx.fillRect(hx, hy - HEAD.ry, HEAD.rx, HEAD.ry * 2);
  const jg = ctx.createLinearGradient(0, hy + HEAD.ry - 26, 0, hy + HEAD.ry);
  jg.addColorStop(0, 'rgba(0,0,0,0)');
  jg.addColorStop(1, C.skinDeep);
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = jg;
  ctx.fillRect(hx - HEAD.rx, hy + HEAD.ry - 26, HEAD.rx * 2, 26);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx + 1, HEAD.ry + 1, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(hx - HEAD.rx - 2, hy - 10);
  ctx.quadraticCurveTo(hx - HEAD.rx * 0.5 + shift * 0.4, hy - 42, hx + shift * 0.5, hy - 35);
  ctx.quadraticCurveTo(hx + HEAD.rx * 0.75 + shift * 0.4, hy - 29, hx + HEAD.rx + 2, hy - 4);
  ctx.lineTo(hx + HEAD.rx + 2, hy - HEAD.ry - 6);
  ctx.lineTo(hx - HEAD.rx - 2, hy - HEAD.ry - 6);
  ctx.closePath();
  ctx.fillStyle = shade(ctx, hx - 40, hy - 60, hx + 30, hy - 10,
    [[0, C.hair], [0.6, C.hairDark], [1, C.hair]]);
  ctx.fill();
  ctx.globalAlpha = 0.22;
  ctx.strokeStyle = C.hairLight;
  ctx.lineWidth = 2.6;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(hx - 22 + i * 15, hy - HEAD.ry - 4);
    ctx.quadraticCurveTo(hx - 16 + i * 17, hy - 52, hx - 26 + i * 19, hy - 40);
    ctx.stroke();
  }
  ctx.restore();

  const fx = hx + shift;
  const fy = hy + drop * 0.5;

  drawBrow(ctx, C, fx - EYE.dx, fy + BROW.dy, +1, f);
  drawBrow(ctx, C, fx + EYE.dx, fy + BROW.dy, -1, f);

  drawEye(ctx, C, fx - EYE.dx, fy + EYE.dy, f, f.eyeOpen);
  drawEye(ctx, C, fx + EYE.dx, fy + EYE.dy, f, f.eyeOpen);

  ctx.save();
  const ng = ctx.createRadialGradient(fx + 2, fy + 9, 1, fx + 3, fy + 10, 12);
  ng.addColorStop(0, C.skinDeep);
  ng.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = ng;
  ctx.beginPath();
  ctx.ellipse(fx + 3, fy + 10, 12, 14, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = C.skinDeep;
  ctx.globalAlpha = 0.42;
  ctx.beginPath();
  ctx.ellipse(fx - 3.4, fy + 16.5, 2.1, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(fx + 4.2, fy + 16.5, 2.1, 1.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx + 1, fy + 5);
  ctx.quadraticCurveTo(fx + 5, fy + 14, fx - 0.5, fy + 15.5);
  ctx.stroke();
  ctx.globalAlpha = 1;

  if (f.cheek > 0.05) {
    ctx.fillStyle = C.blush;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(fx + s * 27, fy + 16, 9 * f.cheek + 5, 6 * f.cheek + 3.5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawMouth(ctx, C, fx, fy + MOUTH.dy, f);

  ctx.restore();
}

function drawAvatar(ctx, C, f, breath) {
  drawTorso(ctx, C, breath);
  drawNeck(ctx, C, f, breath);
  drawHead(ctx, C, f, breath);
}

window.SLFace = {
  FACE_KEYS, FACES, FACE_LABELS, FACE_DEFAULT,
  face, compose, faceToVec, vecToFace, drawAvatar, HEAD, NECK_PIVOT,
};

})();
