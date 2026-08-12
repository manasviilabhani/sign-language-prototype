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

function drawTorso(ctx, C, breath) {
  ctx.save();
  ctx.translate(0, breath * 1.2);

  // shirt — sloped shoulders, so the arm root at y=224 sits inside the torso
  ctx.beginPath();
  ctx.moveTo(94, 520);
  ctx.lineTo(100, 296);
  ctx.quadraticCurveTo(106, 214, 158, 202);
  ctx.quadraticCurveTo(200, 194, 242, 202);
  ctx.quadraticCurveTo(294, 214, 300, 296);
  ctx.lineTo(306, 520);
  ctx.closePath();
  ctx.fillStyle = C.shirt;
  ctx.fill();

  // collar
  ctx.beginPath();
  ctx.moveTo(177, 199);
  ctx.quadraticCurveTo(200, 228, 223, 199);
  ctx.quadraticCurveTo(200, 213, 177, 199);
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
  ctx.lineTo(180, 210);
  ctx.lineTo(220, 210);
  ctx.lineTo(218, 144);
  ctx.closePath();
  ctx.fillStyle = C.skinShade;
  ctx.fill();
  ctx.restore();
}

function drawEye(ctx, C, cx, cy, f, open) {
  const ry = EYE.ry * clamp(open, 0, 1.45) * (1 - f.squint * 0.45);
  if (ry < 1.1) {
    // closed: a soft lash line
    ctx.strokeStyle = C.line;
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - EYE.rx, cy);
    ctx.quadraticCurveTo(cx, cy + 3.2, cx + EYE.rx, cy);
    ctx.stroke();
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, EYE.rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.sclera;
  ctx.fill();
  ctx.clip();

  const ix = cx + f.gazeX * 4.5;
  const iy = cy + f.gazeY * 3.2;
  ctx.beginPath();
  ctx.arc(ix, iy, 5.4, 0, Math.PI * 2);
  ctx.fillStyle = C.iris;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix, iy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = C.pupil;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(ix - 2, iy - 2.2, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fill();
  ctx.restore();

  ctx.beginPath();
  ctx.ellipse(cx, cy, EYE.rx, ry, 0, 0, Math.PI * 2);
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawBrow(ctx, C, cx, cy, innerSign, f) {
  // innerSign: +1 if the inner end is at +x, -1 if at -x
  const lift = -f.brow * 8;
  const inner = f.browTilt * 6.5;   // +ve pulls the inner end down
  const x0 = cx - EYE.rx - 2;
  const x1 = cx + EYE.rx + 2;
  const yInner = cy + lift + inner;
  const yOuter = cy + lift - inner * 0.35;
  const yL = innerSign > 0 ? yOuter : yInner;
  const yR = innerSign > 0 ? yInner : yOuter;
  const arch = -3 - f.brow * 2.5 + f.browTilt * 2;

  ctx.strokeStyle = C.brow;
  ctx.lineWidth = 4.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, yL);
  ctx.quadraticCurveTo(cx, (yL + yR) / 2 + arch, x1, yR);
  ctx.stroke();
}

function drawMouth(ctx, C, cx, cy, f) {
  const open = clamp(f.mouthOpen, 0, 1);
  const w = 16 * (1 + f.mouthWide * 0.45) * (1 - open * 0.12);
  const h = 1.6 + open * 14;
  const smile = f.smile * 7;

  ctx.beginPath();
  ctx.moveTo(cx - w, cy - smile * 0.45);
  ctx.quadraticCurveTo(cx, cy - h * 0.45 - smile * 0.9, cx + w, cy - smile * 0.45);
  ctx.quadraticCurveTo(cx, cy + h + smile * 0.55, cx - w, cy - smile * 0.45);
  ctx.closePath();
  ctx.fillStyle = open > 0.12 ? C.mouthInner : C.mouth;
  ctx.fill();
  ctx.strokeStyle = C.mouth;
  ctx.lineWidth = 2.2;
  ctx.lineJoin = 'round';
  ctx.stroke();

  if (open > 0.28) {
    // teeth
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx - w, cy - smile * 0.45);
    ctx.quadraticCurveTo(cx, cy - h * 0.45 - smile * 0.9, cx + w, cy - smile * 0.45);
    ctx.quadraticCurveTo(cx, cy + h + smile * 0.55, cx - w, cy - smile * 0.45);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = C.teeth;
    ctx.fillRect(cx - w, cy - smile * 0.45 - h * 0.5, w * 2, h * 0.55);
    ctx.restore();
  }

  if (f.tongue > 0.4) {
    ctx.beginPath();
    ctx.ellipse(cx, cy + h * 0.35, w * 0.42, 4.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = C.tongue;
    ctx.fill();
  }
}

function drawHead(ctx, C, f, breath) {
  const turn = clamp(f.headTurn, -1, 1);
  const nod = clamp(f.headNod, -1, 1);
  const shift = turn * 9;          // feature parallax
  const drop = nod * 7;

  ctx.save();
  ctx.translate(NECK_PIVOT.x, NECK_PIVOT.y + breath * 1.2);
  ctx.rotate(rad(f.headTilt * 13));
  ctx.translate(-NECK_PIVOT.x, -NECK_PIVOT.y);
  ctx.translate(turn * 5, drop * 0.7);

  const hx = HEAD.x;
  const hy = HEAD.y;

  // ears
  ctx.fillStyle = C.skinShade;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(hx + s * (HEAD.rx - 2), hy + 6, 7, 11, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // hair behind the head
  ctx.beginPath();
  ctx.ellipse(hx, hy - 6, HEAD.rx + 5, HEAD.ry + 4, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.hair;
  ctx.fill();

  // face
  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx, HEAD.ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = C.skin;
  ctx.fill();

  // fringe
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(hx, hy, HEAD.rx + 1, HEAD.ry + 1, 0, 0, Math.PI * 2);
  ctx.clip();
  ctx.beginPath();
  ctx.moveTo(hx - HEAD.rx - 2, hy - 12);
  ctx.quadraticCurveTo(hx - HEAD.rx * 0.5 + shift * 0.4, hy - 40, hx + shift * 0.5, hy - 34);
  ctx.quadraticCurveTo(hx + HEAD.rx * 0.75 + shift * 0.4, hy - 28, hx + HEAD.rx + 2, hy - 6);
  ctx.lineTo(hx + HEAD.rx + 2, hy - HEAD.ry - 4);
  ctx.lineTo(hx - HEAD.rx - 2, hy - HEAD.ry - 4);
  ctx.closePath();
  ctx.fillStyle = C.hair;
  ctx.fill();
  ctx.restore();

  const fx = hx + shift;
  const fy = hy + drop * 0.5;

  // brows
  drawBrow(ctx, C, fx - EYE.dx, fy + BROW.dy, +1, f);
  drawBrow(ctx, C, fx + EYE.dx, fy + BROW.dy, -1, f);

  // eyes
  drawEye(ctx, C, fx - EYE.dx, fy + EYE.dy, f, f.eyeOpen);
  drawEye(ctx, C, fx + EYE.dx, fy + EYE.dy, f, f.eyeOpen);

  // nose
  ctx.strokeStyle = C.line;
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(fx + 1, fy + 6);
  ctx.quadraticCurveTo(fx + 4, fy + 14, fx - 1, fy + 15);
  ctx.stroke();

  // cheeks
  if (f.cheek > 0.05) {
    ctx.fillStyle = C.blush;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(fx + s * 27, fy + 16, 9 * f.cheek + 4, 6 * f.cheek + 3, 0, 0, Math.PI * 2);
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
