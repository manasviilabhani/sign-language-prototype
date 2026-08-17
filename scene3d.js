/* scene3d.js — WebGL avatar
 *
 * Replaces the 2D canvas renderer. The pose data is unchanged: the same joint
 * flexion angles that drove the flat drawing now drive real 3D joint
 * rotations, which is what makes palm orientation and depth of movement
 * actually expressible.
 *
 * Stage coordinates (400 x 520, y down) are mapped to world metres here so
 * signs.js can stay in the space it was authored in.
 *
 * The figure is drawn in a chibi style — a head as wide as the body, huge
 * eyes, chubby limbs. That look is a constraint problem, not a free choice:
 * every one of the ~385 signs places its wrist against a stage anchor, and
 * those anchors are calibrated to where this face's features sit. So the head
 * grows *upward and outward* only. The cranium and hair balloon above the
 * hairline and out to the sides, while the brow, eye, nose, mouth and chin
 * stay in the same world band they have always occupied. That is also exactly
 * what chibi proportions are — features clustered low on an oversized skull —
 * so the style and the rig want the same thing.
 */

import * as THREE from './vendor/three.module.min.js';

/* ---------------------------------------------------------------- *
 * Stage -> world
 * ---------------------------------------------------------------- */

const S = 0.0019;            // metres per stage unit
const HEAD_Y_STAGE = 116;
const HEAD_Y_WORLD = 1.60;

const wx = (sx) => (sx - 200) * S;
const wy = (sy) => HEAD_Y_WORLD + (HEAD_Y_STAGE - sy) * S;

const deg = (d) => (d * Math.PI) / 180;

/* ---------------------------------------------------------------- *
 * Body proportions (metres)
 *
 * The figure stands from y=0.866 to about y=1.83 — roughly 2.8 head-heights,
 * which is what puts it in chibi territory. Landmarks that signs depend on are
 * marked; those are not free to move.
 * ---------------------------------------------------------------- */

const P = {
  headBase: 1.475,     // head pivots on the neck, just above the chin
  shoulderY: 1.408,
  shoulderX: 0.144,
  /* Not free numbers. Sampling every keyframe of all 388 signs, the furthest
   * any wrist gets from its shoulder is 0.436 m (the sign THEY; fingerspelling
   * only ever needs 0.312). Past upperArm + foreArm the IK cannot reach and
   * `aimBone` stretches the forearm mesh to meet the wrist, which looks far
   * worse than a long arm — so the total has to stay above that, and 0.446
   * leaves room for the idle sway on top.
   *
   * The *split* is free, though, and that is what fixes a forearm that looks
   * stretched: weight the total toward the upper arm, which is the longer bone
   * on a real arm anyway. The forearm is 16% shorter than it was at the same
   * total reach. */
  upperArm: 0.266,
  foreArm: 0.180,
  hipY: 1.175,
  footY: 0.906,
};

/* Skull semi-axes and centre. The chin is pinned at 1.470 by the sign anchors,
 * so the only way to grow the head — and head size is the whole style — is
 * upward: a taller cranium with the centre riding up to match. That is why the
 * centre sits above the middle of the face rather than in it. */
/* HEAD_SCALE grows the entire head as one uniform scale on the head group,
 * rather than by re-deriving forty constants. That is the safe way to resize it,
 * because the head is the one part that cannot be resized freely: the face
 * landmarks are pinned to the sign anchors, so growing the skull drags them.
 *
 * Scaling happens about the skull centre, so features — which all sit below it —
 * drift downward by up to 14 mm at this scale. HEAD_C is nudged up by 10 mm to
 * put the mid-face back, which lands every landmark within about 10 mm of where
 * its anchor expects it; the depth clamp handles the z side. Uniform scale also
 * commutes with the head's rotation, so nod/turn/tilt are unaffected. */
const HEAD_SCALE = 1.10;
const HEAD_C = 1.675;
/* Authored skull semi-axes, in head-local space (i.e. before HEAD_SCALE). */
const SK = { a: 0.178, b: 0.195, c: 0.164 };
/* The same ellipsoid in world units. Anything reasoning about the head from
 * outside the head group — the hand depth clamp — must use these. */
const SKW = { a: SK.a * HEAD_SCALE, b: SK.b * HEAD_SCALE, c: SK.c * HEAD_SCALE };

const _n = new THREE.Vector3();
const _fwd = new THREE.Vector3(0, 0, 1);

/* A group sitting on the surface of an ellipsoid at (x, y), oriented so its +Z
 * is the outward surface normal; `sink` pushes it inward along that normal.
 * Used for the face and for the hair locks, so each part is authored in a flat
 * local frame and still hugs whatever it is sitting on. */
function onShell(a, b, c, x, y, sink = 0) {
  const t = 1 - (x * x) / (a * a) - (y * y) / (b * b);
  const z = c * Math.sqrt(Math.max(0.04, t));
  _n.set(x / (a * a), y / (b * b), z / (c * c)).normalize();
  const g = new THREE.Group();
  g.position.set(x, y, z).addScaledVector(_n, -sink);
  g.quaternion.setFromUnitVectors(_fwd, _n);
  return g;
}

/* Everything on the face — eyes, brows, nose, mouth, blush — hangs off one of
 * these, on a head whose size has now changed three times. */
const onSkull = (x, y, sink = 0) => onShell(SK.a, SK.b, SK.c, x, y, sink);

/* Face landmarks. Declared as world heights because that is what the sign
 * anchors in signs.js are calibrated against — a sign that contacts the mouth
 * puts its wrist where it does because the mouth is at 1.522 — and then
 * converted to head-local offsets. Changing the skull size may not move these. */
const Y_BROW = 1.644;        // close over the eye, not up on the forehead
const Y_EYE = 1.598;
const Y_NOSE = 1.558;
const Y_MOUTH = 1.522;

const F_BROW = Y_BROW - HEAD_C;
const F_EYE = Y_EYE - HEAD_C;
const F_NOSE = Y_NOSE - HEAD_C;
const F_MOUTH = Y_MOUTH - HEAD_C;

const EYE_R = 0.040;         // ~22% of head width, which is the chibi tell
const EYE_X = 0.064;
/* Arc of the brow stroke, and the roll that centres it over the eye. Shared
 * with applyFace, which rolls it further for browTilt. */
const BROW_ARC = Math.PI * 0.46;
const BROW_ROT0 = Math.PI * 0.5 - BROW_ARC / 2;

/* Keeping hands out of the face.
 *
 * The anchor depths in signs.js were authored against a smaller skull. Growing
 * the head for this style pushed the face surface out from z=0.1455 to z=0.164
 * and swallowed them: at the forehead anchor the fingertips end up about 4 mm
 * *behind* the surface, so UNDERSTAND flicks its finger inside the head. The
 * nose, chin and mouth anchors crossed from outside to inside as well.
 *
 * Rather than edit anchors the flat renderer also depends on, any wrist target
 * whose hand would enter the skull is pushed forward along +Z until it clears.
 * The test has to be against the *fingertips*, not the wrist — at the forehead
 * the wrist is already well clear and only the fingers are buried. */
const TIP_REACH = 0.085;     // wrist to fingertip, near enough
/* Clearance left in front of the skin. Generous, because it is free: the sign
 * that sets the reach limit (THEY) is nowhere near the face, so measuring every
 * sign with the clamp applied gives the same 7 mm of IK headroom at any pad from
 * 0.014 to 0.036. Face signs sit well inside the arm's range either way, so this
 * buys clearly-readable separation between hand and face at no cost. */
const FACE_PAD = 0.026;

function skullPush(x, y, z, pad) {
  const u = x / SKW.a;                        // world-scale skull, not authored
  const v = (y - HEAD_C) / SKW.b;
  const r = 1 - u * u - v * v;
  if (r <= 0) return 0;                       // clear of the head's footprint
  const surf = SKW.c * Math.sqrt(r) + pad;
  return z < surf ? surf - z : 0;
}

/* ---------------------------------------------------------------- *
 * Hand rig
 *
 * Local space: +Y along the fingers, +Z out of the palm, +X toward the thumb.
 * Flexion is a rotation about X (curling into the palm), spread about Z.
 *
 * Fingers are deliberately fat and barely tapered — toddler hands — but they
 * keep their full length and all three joints. In ASL the handshape is the
 * phoneme, so legibility of the shape outranks the styling: mitten hands, the
 * usual shortcut for this art style, are not available here.
 * ---------------------------------------------------------------- */

/* Spacing has to be *just under* the combined radii of neighbouring fingers —
 * they should touch, sharing a soft crease, and no more.
 *
 * This was previously 0.017 against combined radii of 0.030, so every pair
 * interpenetrated by 43% of its own width and all four fingers melted into one
 * mass: the clubbed fist. Erring the other way (spacing wider than the fingers)
 * looks splayed instead, because the taper then opens a visible gap toward the
 * tips. A ~2 mm overlap at the knuckles is the window that reads as a hand.
 *
 * Radii came down to buy that spacing without the hand growing wider than the
 * palm can carry: half-width is now 0.0507 against the palm's 0.054. */
/* Lengths cut ~16% while the radii stay put, which is the whole trick for a
 * stubby toddler hand: the middle finger is now about 2.8 times its own width,
 * where a spidery finger is 4 or more. Contact points shift down by a couple of
 * millimetres as a result — a sign that touches the chin now lands a shade
 * lower — which is within the slop the anchors already carry. */
const FINGERS = [
  { name: 'index',  x: 0.0375, y: 0.050, len: [0.036, 0.023, 0.019], r: 0.0132 },
  { name: 'middle', x: 0.0125, y: 0.054, len: [0.039, 0.026, 0.020], r: 0.0136 },
  { name: 'ring',   x: -0.0125, y: 0.051, len: [0.037, 0.024, 0.019], r: 0.0128 },
  { name: 'pinky',  x: -0.0375, y: 0.045, len: [0.029, 0.019, 0.017], r: 0.0112 },
];
/* Thumb base pushed out past the edge of the palm. At 0.033 it sat inside the
 * palm sphere and was simply swallowed by it. */
const THUMB = { x: 0.046, y: 0.004, len: [0.033, 0.028], r: 0.0158 };
/* Per joint. Toddler fingers barely narrow, and more than this opens visible
 * gaps between the fingertips that read as a splayed, broken hand. */
const TAPER = 0.09;

/* How far the hand leans toward the forearm axis instead of holding the roll
 * the sign authored. See placeArm. Kept low: authored wrist orientation is
 * linguistic information in ASL, so IK only softens the joint, never owns it. */
const WRIST_FOLLOW = 0.30;

/* One phalanx: a gently tapered barrel with a rounded tip and a soft knuckle at
 * its base. The knuckle is the point of it — plain cylinders butted end to end
 * give a finger no joint definition, so a curled hand reads as a bent tube. It
 * is only fractionally wider than the barrel, though: any more and a finger
 * becomes a string of beads. */
function segment(mat, len, r0, r1) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 16, 1, false);
  g.translate(0, len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  const knuckle = new THREE.Mesh(new THREE.SphereGeometry(r0, 14, 10), mat);
  knuckle.scale.set(1, 0.80, 1);
  knuckle.castShadow = true;
  m.add(knuckle);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(r1, 14, 12), mat);
  tip.position.y = len;
  tip.castShadow = true;
  m.add(tip);
  return m;
}

function buildHand(mat, mirror) {
  const root = new THREE.Group();
  const side = mirror ? -1 : 1;

  // palm
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.056, 26, 20), mat);
  palm.scale.set(0.96, 1.00, 0.52);
  palm.position.y = 0.018;
  palm.castShadow = true;
  root.add(palm);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.049, 22, 16), mat);
  heel.scale.set(0.96, 0.86, 0.58);
  heel.position.y = -0.015;
  heel.castShadow = true;
  root.add(heel);
  /* No wrist ball here. It used to hang off the hand at y=-0.040, but the hand
   * is rotated by the sign's roll *and* the resting pronation, which swung that
   * ball off the forearm's axis and left it poking out of the side of the wrist
   * as a separate bulge. It now lives in arm space instead — see makeArm — where
   * it stays on the joint whatever the hand does. */

  const joints = [];
  for (const f of FINGERS) {
    const base = new THREE.Group();
    base.position.set(f.x * side, f.y, 0);
    root.add(base);

    const chain = [base];
    let parent = base;
    for (let i = 0; i < 3; i++) {
      const j = new THREE.Group();
      if (i > 0) j.position.y = f.len[i - 1];
      parent.add(j);
      j.add(segment(mat, f.len[i], f.r * (1 - i * TAPER), f.r * (1 - (i + 1) * TAPER)));
      chain.push(j);
      parent = j;
    }
    joints.push(chain.slice(1));
  }

  // thumb sits on the side of the palm, rotated out of the finger plane
  const tBase = new THREE.Group();
  tBase.position.set(THUMB.x * side, THUMB.y, 0.014);
  root.add(tBase);
  const tChain = [];
  let tp = tBase;
  for (let i = 0; i < 2; i++) {
    const j = new THREE.Group();
    if (i > 0) j.position.y = THUMB.len[i - 1];
    tp.add(j);
    j.add(segment(mat, THUMB.len[i], THUMB.r * (1 - i * 0.10), THUMB.r * (1 - (i + 1) * 0.10)));
    tChain.push(j);
    tp = j;
  }

  return { root, joints, thumb: tChain, tBase, side };
}

function applyHandPose(hand, pose) {
  const side = hand.side;
  for (let i = 0; i < 4; i++) {
    const chain = hand.joints[i];
    const flex = pose.f[i];
    for (let k = 0; k < 3; k++) {
      chain[k].rotation.x = deg(flex[k]);
      chain[k].rotation.z = k === 0 ? deg(-pose.s[i] * side) : 0;
    }
  }
  /* Thumb: abduction swings it away from the fingers, flexion folds it back.
   *
   * The abduction sign was inverted. +X is the thumb side of the hand, and a
   * positive rotation about Z tilts the thumb toward -X — so every handshape
   * swung its thumb *across* the palm toward the pinky instead of out from the
   * index, which is why the thumb looked broken and overlapped the fingers. It
   * is worst exactly where abduction is largest: OPEN (ts=52) threw the thumb
   * a full 84 degrees the wrong way over the palm. */
  hand.tBase.rotation.z = deg(-(pose.ts + 32) * side);
  hand.tBase.rotation.y = deg(-38 * side);
  hand.thumb[0].rotation.x = deg(pose.th[0] * 0.7);
  hand.thumb[1].rotation.x = deg(pose.th[1] * 0.9);
}

/* ---------------------------------------------------------------- *
 * Two-bone arm IK
 * ---------------------------------------------------------------- */

const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);
const _lerp = new THREE.Vector3();

function aimBone(mesh, from, to) {
  _a.copy(to).sub(from);
  const len = _a.length();
  mesh.position.copy(from);
  mesh.quaternion.setFromUnitVectors(_up, _a.normalize());
  mesh.scale.y = len / mesh.userData.baseLen;
}

function solveElbow(shoulder, wrist, poleDir, upper, fore) {
  _a.copy(wrist).sub(shoulder);
  let d = _a.length();
  const max = (upper + fore) * 0.999;
  if (d > max) { _a.multiplyScalar(max / d); d = max; }
  if (d < 0.05) d = 0.05;
  const a = (upper * upper - fore * fore + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, upper * upper - a * a));
  const dir = _b.copy(_a).normalize();
  // pole component perpendicular to the bone axis
  _c.copy(poleDir).addScaledVector(dir, -poleDir.dot(dir));
  // If the arm is near-vertical the down component cancels out entirely and
  // the elbow would fly out sideways; fall back to forward-and-out.
  if (_c.lengthSq() < 0.02) {
    _c.set(poleDir.x * 0.4, -0.15, 1).addScaledVector(dir, 0);
    _c.addScaledVector(dir, -_c.dot(dir));
  }
  _c.normalize();
  return new THREE.Vector3()
    .copy(shoulder)
    .addScaledVector(dir, a)
    .addScaledVector(_c, h);
}

/* ---------------------------------------------------------------- *
 * Scene
 * ---------------------------------------------------------------- */

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  /* Framing: the figure spans y=0.87 to y=1.83, so the camera looks at its
   * middle from far enough back that a 30-degree vertical field covers the
   * whole of it with a little air top and bottom. */
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 1.415, 2.30);
  camera.lookAt(0, 1.395, 0);
  // ?cam=head frames the face for checking expressions
  if (typeof location !== 'undefined' && /[?&]cam=head/.test(location.search)) {
    camera.fov = 20;
    camera.position.set(0, 1.650, 1.18);
    camera.lookAt(0, 1.632, 0);
  }

  /* Bright, soft and slightly warm. The style wants no deep shadow anywhere —
   * the key is strong but the hemisphere and fill are lifted high enough that
   * nothing on the face goes dark. */
  /* Warm and soft, keyed from above and slightly to the side. Four lights, and
   * each one is doing a specific job:
   *
   * The hemisphere is the ambient, warm above and warm-neutral below, so no
   * surface is ever unlit. The key is high and forward — a top-down key is what
   * puts the highlight on the forehead and the cheeks. The bounce comes from
   * below-front at low intensity: that is what turns flat plastic shading into
   * a gradient down the cheek and under the chin, and it is doing most of the
   * work of the "soft gradient" skin. The rim separates the hair from the
   * background. */
  scene.add(new THREE.HemisphereLight(0xfff4e6, 0xb8a898, 1.05));
  const key = new THREE.DirectionalLight(0xfff2dc, 1.55);
  key.position.set(-0.9, 3.2, 1.9);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 7;
  key.shadow.camera.left = -1.0;
  key.shadow.camera.right = 1.0;
  key.shadow.camera.top = 2.4;
  key.shadow.camera.bottom = 0.6;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0012;
  scene.add(key);
  const bounce = new THREE.DirectionalLight(0xffd9c0, 0.46);
  bounce.position.set(0.4, -0.9, 2.2);
  scene.add(bounce);
  const fill = new THREE.DirectionalLight(0xffe8d4, 0.58);
  fill.position.set(2.3, 1.5, 1.5);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffe0bd, 0.70);
  rim.position.set(0.5, 2.0, -2.1);
  scene.add(rim);

  const M = {
    /* Warm peach. The faint warm emissive is deliberate: it lifts the shadow
     * side just enough that skin falls off into colour rather than into grey,
     * which together with the bounce light is what gives the soft gradient
     * instead of the flat plastic look. */
    skin: new THREE.MeshStandardMaterial({
      color: 0xffd3ac, roughness: 0.62, metalness: 0,
      emissive: 0x6b2f14, emissiveIntensity: 0.13,
    }),
    /* Pink tee under blue denim dungarees. `tee` is the CSS --shirt colour, so
     * the two renderers stay in step; the collar is derived from it in frame(). */
    tee: new THREE.MeshStandardMaterial({ color: 0xf2879f, roughness: 0.74 }),
    collar: new THREE.MeshStandardMaterial({ color: 0xd9738b, roughness: 0.74 }),
    denim: new THREE.MeshStandardMaterial({ color: 0x7d97b8, roughness: 0.86 }),
    denimDark: new THREE.MeshStandardMaterial({ color: 0x67809f, roughness: 0.86 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc9932f, roughness: 0.34, metalness: 0.55 }),
    shoe: new THREE.MeshStandardMaterial({ color: 0x8a5a3c, roughness: 0.58 }),
    sole: new THREE.MeshStandardMaterial({ color: 0xfbf4e8, roughness: 0.78 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x4a2c18, roughness: 0.54 }),
    hairDark: new THREE.MeshStandardMaterial({ color: 0x36200f, roughness: 0.58 }),
    // Not pure white. A bright white ball in a face reads as a googly eye;
    // real sclera is warm and slightly shaded by the socket.
    sclera: new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.16 }),
    iris: new THREE.MeshStandardMaterial({ color: 0x55331c, roughness: 0.16 }),
    limbal: new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 0.38 }),
    lash: new THREE.MeshStandardMaterial({ color: 0x2d1b10, roughness: 0.82 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x150d07, roughness: 0.28 }),
    /* Catchlights are specular reflections, not lit surfaces. Shading them
     * makes them grey out on the shadow side, which is the difference between
     * a glossy eye and a dead one — so they are unlit. */
    gloss: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    brow: new THREE.MeshStandardMaterial({ color: 0x5b3620, roughness: 0.78 }),
    lip: new THREE.MeshStandardMaterial({ color: 0xc4665c, roughness: 0.50 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x7d2f2e, roughness: 0.68 }),
    teeth: new THREE.MeshStandardMaterial({ color: 0xfffaf4, roughness: 0.30 }),
    tongue: new THREE.MeshStandardMaterial({ color: 0xd4726f, roughness: 0.52 }),
    /* Cheek blush. Transparent and depth-write-off so it reads as colour on
     * the cheek rather than a disc floating in front of it. */
    /* Unlit, and that is not laziness. Shaded, the flattened dome's pole shades
     * differently from its rim and prints a visible diamond on the cheek
     * through the translucency — raising the tessellation does not remove it,
     * because the artifact is the normals converging, not the silhouette.
     * Blush is subsurface redness rather than a lit surface anyway, so flat
     * colour is both correct and free of the artifact. */
    blush: new THREE.MeshBasicMaterial({
      color: 0xe8776b, transparent: true, opacity: 0.30, depthWrite: false,
    }),
  };

  const avatar = new THREE.Group();
  scene.add(avatar);

  /* ---- torso: yellow tee ---- */
  /* Short and barrel-shaped. A toddler torso is about as wide as it is tall and
   * has essentially no waist, so this is nearly a straight-sided tub. */
  const teeProfile = [
    [0.038, 1.164], [0.125, 1.174], [0.146, 1.208], [0.155, 1.252],
    [0.159, 1.298], [0.160, 1.340], [0.155, 1.382], [0.130, 1.418],
    [0.076, 1.446], [0.034, 1.458],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(teeProfile, 44), M.tee);
  torso.scale.z = 0.84;
  torso.castShadow = true;
  torso.receiveShadow = true;
  avatar.add(torso);

  /* ---- dungarees ----
   * The denim wraps the hips and belly all the way round, which is what
   * dungarees actually do; only the bib climbs the chest, and only at the
   * front. So the wrap is a lathe a few millimetres outside the tee, and the
   * bib is a separate rounded slab sunk into the chest. */
  const denimProfile = [
    [0.157, 1.148], [0.161, 1.196], [0.165, 1.248],
    [0.166, 1.296], [0.164, 1.330], [0.159, 1.352],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const dungarees = new THREE.Mesh(new THREE.LatheGeometry(denimProfile, 44), M.denim);
  dungarees.scale.z = 0.86;
  dungarees.castShadow = true;
  dungarees.receiveShadow = true;
  avatar.add(dungarees);

  const bib = new THREE.Mesh(new THREE.SphereGeometry(0.081, 28, 20), M.denim);
  bib.scale.set(0.95, 0.76, 0.30);
  bib.position.set(0, 1.360, 0.116);
  bib.castShadow = true;
  avatar.add(bib);

  const pocket = new THREE.Mesh(new THREE.SphereGeometry(0.043, 24, 18), M.denimDark);
  pocket.scale.set(1.05, 0.80, 0.16);
  pocket.position.set(0, 1.338, 0.137);
  avatar.add(pocket);
  const stitch = new THREE.Mesh(new THREE.BoxGeometry(0.065, 0.004, 0.004), M.denim);
  stitch.position.set(0, 1.358, 0.149);
  avatar.add(stitch);

  for (const sd of [-1, 1]) {
    /* Strap over the shoulder and down the back. A curve through five points
     * keeps it lying on the body instead of cutting the corner at the
     * shoulder, which a straight tube between bib and back would do. */
    /* Points taken off the measured torso and shoulder-ball surfaces.
     *
     * Deliberately near-vertical rather than splayed outward. The camera sits at
     * shoulder height, so the part of the strap that actually crosses the top of
     * the shoulder is edge-on and invisible; a path that swung wide left only an
     * outward-curving stub ending in mid-air, which read as a horn. Rising close
     * to the chest instead means the visible portion is unmistakably a strap, and
     * it disappears where the sleeve occludes it — which is what going over a
     * shoulder looks like from the front.
     *
     * Previously taken off the narrow torso. They were set
     * against the old narrower lathe and, once the body broadened, the straps
     * ran inside the shoulder and read as floating in front of it. */
    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(sd * 0.056, 1.382, 0.128),
      new THREE.Vector3(sd * 0.062, 1.400, 0.110),
      new THREE.Vector3(sd * 0.070, 1.418, 0.086),
      new THREE.Vector3(sd * 0.078, 1.438, 0.048),
      new THREE.Vector3(sd * 0.088, 1.456, 0.018),
      new THREE.Vector3(sd * 0.092, 1.459, -0.020),
      new THREE.Vector3(sd * 0.086, 1.430, -0.062),
      new THREE.Vector3(sd * 0.076, 1.398, -0.090),
    ]);
    const strap = new THREE.Mesh(new THREE.TubeGeometry(path, 34, 0.0142, 12, false), M.denim);
    strap.castShadow = true;
    avatar.add(strap);

    /* Round brass button where the strap meets the bib. A domed sphere rather
     * than a disc — a flat cylinder end catches no highlight and disappears. */
    const button = new THREE.Mesh(new THREE.SphereGeometry(0.0151, 20, 16), M.brass);
    button.scale.set(1, 1, 0.55);
    button.position.set(sd * 0.056, 1.394, 0.140);
    avatar.add(button);

    /* ---- stubby legs, turned-up cuffs, chunky shoes ----
     * Set wide enough apart to leave daylight between them; closer together and
     * the denim merges with the hips into one solid blue block. */
    /* Legs kept short — with the head at ~40% of total height the whole figure
     * below the chest has to be compact, or the ratio slips back. */
    const hipX = sd * 0.076;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.070, 0.064, 0.150, 22), M.denim);
    leg.position.set(hipX, 1.108, 0.004);
    leg.castShadow = true;
    avatar.add(leg);

    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.077, 0.048, 24), M.denimDark);
    cuff.position.set(hipX, 1.030, 0.004);
    cuff.castShadow = true;
    avatar.add(cuff);

    /* Ankle, then shoe. The shoe used to start below where the cuff ended and
     * read as floating; this overlaps both, so the leg runs continuously into
     * the foot. Ankle first so the shoe's rounded top has something to meet. */
    const ankle = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.056, 0.048, 22), M.skin);
    ankle.position.set(hipX, 0.998, 0.008);
    ankle.castShadow = true;
    avatar.add(ankle);

    const shoe = new THREE.Mesh(new THREE.SphereGeometry(0.078, 28, 22), M.shoe);
    shoe.scale.set(0.94, 0.74, 1.40);
    shoe.position.set(hipX, 0.972, 0.030);
    shoe.castShadow = true;
    avatar.add(shoe);

    const sole = new THREE.Mesh(new THREE.CylinderGeometry(0.069, 0.069, 0.022, 24), M.sole);
    sole.scale.set(1, 1, 1.40);
    sole.position.set(hipX, 0.930, 0.030);
    avatar.add(sole);
  }

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.057, 0.018, 12, 30), M.collar);
  collar.rotation.x = deg(90);
  collar.scale.set(1, 0.82, 1);
  collar.position.y = 1.450;
  collar.castShadow = true;
  avatar.add(collar);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.057, 0.062, 20), M.skin);
  neck.position.y = 1.452;
  neck.castShadow = true;
  neck.receiveShadow = true;
  avatar.add(neck);

  /* ---------------------------------------------------------------- *
   * Head
   *
   * Two groups, not one. `headPivot` sits at the base of the skull and carries
   * the nod/turn/tilt, because a head this size rotated about its own centre
   * swings the chin through the chest. `head` holds the geometry, centred on
   * the skull so face landmarks are offsets from the middle of the face.
   * ---------------------------------------------------------------- */
  const headPivot = new THREE.Group();
  headPivot.position.y = P.headBase;
  avatar.add(headPivot);
  const head = new THREE.Group();
  head.position.y = HEAD_C - P.headBase;
  head.scale.setScalar(HEAD_SCALE);
  headPivot.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 36), M.skin);
  skull.scale.set(SK.a, SK.b, SK.c);
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  /* ---- hair ----
   *
   * One mass, and the two rules that make it read as one.
   *
   * First: every piece is the same material. The back of the head used to be
   * `hairDark`, and a colour change along an intersection curve is exactly what
   * the eye reads as a seam between two separate shells — the "lumps on the
   * sides". Same colour, and an intersection becomes invisible.
   *
   * Second: detail pieces live only at the front. Lobes out at the temples had
   * nothing to merge into sideways, so each one ended as its own blob on the
   * silhouette. The sides and back are now carried entirely by the two big
   * volumes below, and the fringe only breaks the outline where hair actually
   * parts — at the face.
   */
  const hairCap = new THREE.Mesh(
    new THREE.SphereGeometry(1, 56, 36, 0, Math.PI * 2, 0, Math.PI * 0.40), M.hair);
  hairCap.scale.set(SK.a * 1.08, SK.b * 1.10, SK.c * 1.09);
  hairCap.position.set(0, 0.006, -0.004);
  hairCap.castShadow = true;
  head.add(hairCap);

  /* Carries the sides and the back, and covers the cap's lower rim — which is a
   * hard circle at constant latitude and would otherwise draw a line right
   * round the head. Sized to stop above the jaw so this stays short hair rather
   * than a bob, and kept just inside the ears so they still show. */
  const hairBack = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), M.hair);
  hairBack.scale.set(SK.a * 1.02, SK.b * 0.84, SK.c * 0.95);
  hairBack.position.set(0, 0.008, -0.030);
  hairBack.castShadow = true;
  head.add(hairBack);

  /* Length, as chains of shrinking rounded lobes rather than three big ones.
   *
   * The previous version was one slab per side plus one down the back, and that
   * is what read as a flat helmet with hard straight edges: a single scaled
   * sphere is an ellipsoid, so its silhouette is a smooth arc that ends abruptly
   * wherever the shape stops. Hair does not end abruptly.
   *
   * A chain fixes both complaints at once. Each lobe is slightly smaller and
   * slightly further down than the one above, so the mass narrows as it falls
   * and the last small lobe *is* the taper — no hard cut where hair meets the
   * shoulder. Overlapping lobes of differing size also give the surface bumps,
   * which is the lock definition that one smooth ellipsoid cannot have.
   *
   * All of it is parented to `head`, so the hair swings with a head turn, and
   * all of it stays behind the plane of the chest (negative z) so the arms pass
   * in front rather than slicing through — there is no cloth simulation here. */
  // x, y, z, radius, sx, sy, sz
  const BACK_FALL = [
    [0.000, -0.045, -0.068, 0.150, 1.04, 0.60, 0.42],
    [0.004, -0.140, -0.078, 0.138, 1.00, 0.60, 0.40],
    [-0.006, -0.228, -0.076, 0.116, 0.94, 0.58, 0.38],
    [0.008, -0.302, -0.070, 0.088, 0.84, 0.56, 0.36],
    [0.000, -0.358, -0.064, 0.060, 0.74, 0.52, 0.34],
    [0.004, -0.394, -0.058, 0.036, 0.64, 0.48, 0.32],
  ];
  /* Half a chain; mirrored for the other side.
   *
   * Set wider and longer than the fall alone needs, because the widened torso
   * and the shoulder balls sit in front of this hair and were swallowing it: at
   * x=0.148 the chain ran inside the torso's silhouette and the "long" hair
   * vanished into a bob. It now hangs just outside the body's widest point and
   * carries on well below the shoulder, which is the part that actually reads.
   * Still all behind the chest plane, so the arms pass in front. */
  // x, y, z, radius, sx, sy, sz
  const SIDE_FALL = [
    [0.170, -0.070, -0.014, 0.066, 0.90, 1.00, 0.86],
    [0.176, -0.150, -0.014, 0.060, 0.88, 1.00, 0.86],
    [0.176, -0.228, -0.014, 0.052, 0.86, 1.00, 0.84],
    [0.172, -0.300, -0.014, 0.044, 0.82, 0.98, 0.82],
    [0.166, -0.362, -0.014, 0.034, 0.78, 0.94, 0.78],
    [0.158, -0.412, -0.014, 0.024, 0.72, 0.88, 0.72],
    [0.150, -0.446, -0.014, 0.016, 0.66, 0.82, 0.66],
  ];
  const fall = (l, mirror) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(l[3], 32, 24), M.hair);
    m.scale.set(l[4], l[5], l[6]);
    m.position.set(l[0] * (mirror ? -1 : 1), l[1], l[2]);
    m.castShadow = true;
    m.receiveShadow = true;
    head.add(m);
  };
  for (const l of BACK_FALL) fall(l, false);
  for (const l of SIDE_FALL) { fall(l, false); fall(l, true); }

  /* Lock definition over the crown. Placed on the cap's own surface via onShell
   * and sunk most of the way into it, so each one shows as a soft raised ridge
   * a few millimetres proud rather than as a blob sitting on top of the head. */
  const CAP_A = SK.a * 1.08, CAP_B = SK.b * 1.10, CAP_C = SK.c * 1.09;
  // x, y, sx, sy, roll
  const CAP_LOCKS = [
    [0.072, 0.104, 1.30, 0.34, -36],
    [0.016, 0.138, 1.25, 0.32, -14],
    [-0.058, 0.122, 1.20, 0.32, 20],
    [0.120, 0.050, 1.05, 0.38, -58],
    [-0.124, 0.056, 1.05, 0.38, 54],
    [0.044, 0.060, 1.10, 0.30, -48],
  ];
  for (const l of CAP_LOCKS) {
    const g = onShell(CAP_A, CAP_B, CAP_C, l[0], l[1], 0.017);
    head.add(g);
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.052, 26, 20), M.hair);
    m.scale.set(l[2], l[3], 0.42);
    m.rotation.z = deg(l[4]);
    m.castShadow = true;
    g.add(m);
  }

  // Front only, large and heavily overlapping. x, y, z, sx, sy, sz, roll
  const FRINGE = [
    [0.058, 0.076, 0.100, 1.45, 0.62, 0.70, -28],
    [0.010, 0.090, 0.108, 1.40, 0.58, 0.72, -16],
    [-0.040, 0.086, 0.104, 1.35, 0.56, 0.70, -2],
    [-0.086, 0.070, 0.086, 1.15, 0.58, 0.64, 18],
  ];
  for (const l of FRINGE) {
    const lock = new THREE.Mesh(new THREE.SphereGeometry(0.060, 28, 22), M.hair);
    lock.scale.set(l[3], l[4], l[5]);
    lock.position.set(l[0], l[1], l[2]);
    lock.rotation.z = deg(l[6]);
    lock.castShadow = true;
    head.add(lock);
  }

  /* Flyaway wisps, at the fringe only.
   *
   * Two earlier versions failed as a group rather than individually: five fat
   * cones read as rhino horns, and nine thin ones evenly spaced round the crown
   * read as a mohawk. A strand only looks stray if its neighbours are not doing
   * the same thing, so these are few, thin, and swept forward over the fringe
   * rather than standing up off the crown.
   */
  /* Sat at y=0.15 and z=0.08 before, which is mid-cap: the cap surface is
   * further out than that there, so all three were entirely inside the hair and
   * contributed nothing. They belong down at the hairline, pitched forward so
   * the tips clear the fringe. */
  // x, y, z, radius, length, roll, pitch
  const STRANDS = [
    [0.048, 0.106, 0.136, 0.0080, 0.052, -50, 52],
    [0.006, 0.118, 0.140, 0.0085, 0.058, -28, 56],
    [-0.048, 0.110, 0.130, 0.0075, 0.050, 26, 50],
  ];
  for (const t of STRANDS) {
    const strand = new THREE.Mesh(new THREE.ConeGeometry(t[3], t[4], 10), M.hair);
    strand.position.set(t[0], t[1], t[2]);
    strand.rotation.set(deg(t[6]), 0, deg(t[5]));
    strand.castShadow = true;
    head.add(strand);
  }

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0145, 18, 14), M.skin);
  nose.scale.set(1.15, 0.82, 0.95);
  const noseAt = onSkull(0, F_NOSE, 0.004);
  noseAt.add(nose);
  head.add(noseAt);

  /* ---------------------------------------------------------------- *
   * Eyes
   *
   * Drawn on the face, not built out from it.
   *
   * Two earlier attempts failed in opposite directions. A small ball sunk into
   * the skull showed only the sliver standing proud of the surface, which is a
   * slit, not an eye. Enlarging it and centring it on the surface gave the
   * width but made each eye a ball stuck to the face, ringed by the hard edge
   * where the two spheres intersected — poached eggs.
   *
   * The fix is the trick stylised characters actually use: the eye is a decal.
   * Each part is a very shallow dome whose *rim sits inside the skull*, so no
   * intersection edge is ever visible and the whole width reads. Only the
   * curvature has to be right — flatter than the head and it floats at the
   * edges, rounder and it bulges.
   *
   * Blinking then cannot be a rotating lid, because there is no eyeball for a
   * lid to rotate over. It is a vertical squash of the whole assembly, which is
   * how a drawn blink works anyway, and it collapses to the lash line.
   * ---------------------------------------------------------------- */
  const eyes = [];
  for (const s of [-1, 1]) {
    /* Sunk by 4 mm: enough to bury the rim of every dome below, which is the
     * entire reason there is no hard outline around the eye. */
    const g = onSkull(s * EYE_X, F_EYE, 0.004);
    head.add(g);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 32, 24), M.sclera);
    ball.scale.set(1, 1, 0.16);
    g.add(ball);

    /* Iris assembly in its own group, slid across the sclera for gaze. On a
     * dome this shallow, rotating about the centre would barely move it at all,
     * and sliding is what a drawn eye does. Each layer sits just in front of
     * the one behind, following its curve. */
    const irisG = new THREE.Group();
    g.add(irisG);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0270, 28, 20), M.iris);
    iris.scale.set(1, 1, 0.22);
    iris.position.z = 0.0062;
    irisG.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0128, 20, 16), M.pupil);
    pupil.scale.set(1, 1, 0.25);
    pupil.position.z = 0.0108;
    irisG.add(pupil);
    // Big highlight up and out, small one down and in. The pair is what makes
    // the eye look wet; a single centred dot looks like a printed dot.
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.0110, 16, 14), M.gloss);
    spark.scale.set(1, 0.92, 0.20);
    spark.position.set(-s * 0.0100, 0.0104, 0.0128);
    irisG.add(spark);
    const spark2 = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 12, 10), M.gloss);
    spark2.scale.set(1, 0.92, 0.20);
    spark2.position.set(s * 0.0098, -0.0118, 0.0126);
    irisG.add(spark2);

    /* Upper lash line: a thick arc across the top of the eye, and the eye's top
     * edge. It squashes with the assembly, so a shut eye is this line alone. */
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(EYE_R * 0.86, 0.0056, 8, 28, Math.PI * 0.66), M.lash);
    lash.rotation.z = Math.PI * 0.5 - Math.PI * 0.33;
    lash.scale.set(1, 0.90, 0.34);
    lash.position.z = 0.0048;
    g.add(lash);

    /* Brow: a fine arched stroke sitting close over the eye.
     *
     * The y-scale is what controls the arch, and flattening it to 0.66 was what
     * made these read as one heavy straight bar high on the forehead. At 0.95
     * the torus keeps its curve, and with a thinner tube it is a stroke rather
     * than a slab. */
    const browG = onSkull(s * EYE_X, F_BROW, 0.002);
    head.add(browG);
    const brow = new THREE.Mesh(
      new THREE.TorusGeometry(0.034, 0.0032, 8, 30, BROW_ARC), M.brow);
    brow.rotation.z = BROW_ROT0;
    brow.scale.set(1, 0.95, 0.35);
    browG.add(brow);

    /* Blush, by the same buried-rim rule as the eye.
     *
     * A chubby cheek sphere used to sit here with the blush parented to it, and
     * it went wrong twice over: the extra sphere left a seam across the face,
     * and the blush picked up the cheek's non-uniform scale on top of its own,
     * bending the disc into a hook. Flattening it further only turned the hook
     * into a pair of crescents, because a disc that shallow grazes the skull
     * instead of crossing it. A proper shallow dome, rim buried, is a soft
     * round patch of colour and nothing else. */
    const blushG = onSkull(s * 0.098, -0.106, 0.004);
    head.add(blushG);
    /* A cap, not a flattened ball. A full sphere has surface both in front of
     * and behind the cheek, and with depthWrite off the two translucent layers
     * accumulate where they overlap and print a darker diamond in the middle of
     * the blush — which is why neither more segments nor an unlit material shed
     * it. A single-surface cap cannot overlap itself. Its pole is rotated from
     * +Y to +Z to face out along the group's surface normal. */
    const blushGeo = new THREE.SphereGeometry(
      0.042, 36, 18, 0, Math.PI * 2, 0, Math.PI * 0.5);
    blushGeo.rotateX(Math.PI / 2);
    blushGeo.scale(1.0, 0.94, 0.30);
    const blush = new THREE.Mesh(blushGeo, M.blush);
    blushG.add(blush);

    // Forward of the hair mass so it is not swallowed by it.
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 18, 14), M.skin);
    ear.scale.set(0.40, 1.05, 0.78);
    ear.position.set(s * 0.172, -0.048, 0.022);
    ear.castShadow = true;
    head.add(ear);

    eyes.push({ g, gY0: g.position.y, ball, irisG, lash, brow, browG,
                browY0: browG.position.y, blush, side: s });
  }

  /* ---------------------------------------------------------------- *
   * Mouth
   *
   * One dark opening plus a band of upper teeth, and no lip line at all.
   *
   * The lips were a pair of half-torus arcs, which at this size closed into a
   * visible ring around the mouth — a drawn-on doll mouth. The style has no lip
   * line: the mouth is the dark shape, and the teeth band along its top is what
   * makes it read as a grin rather than a hole. Tongue is here for the `th`
   * mouth morpheme, which the old build ignored.
   * ---------------------------------------------------------------- */
  const mouthAt = onSkull(0, F_MOUTH, 0.004);
  head.add(mouthAt);
  const mouthG = new THREE.Group();
  mouthAt.add(mouthG);

  const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.032, 24, 18), M.mouth);
  cavity.scale.set(1, 0.34, 0.30);
  mouthG.add(cavity);
  const teeth = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 14), M.teeth);
  teeth.scale.set(1.0, 0.24, 0.20);
  mouthG.add(teeth);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.012, 14, 12), M.tongue);
  tongue.scale.set(1.2, 0.6, 0.8);
  tongue.position.set(0, -0.009, 0.002);
  mouthG.add(tongue);

  /* ---------------------------------------------------------------- *
   * Arms + hands
   *
   * Short sleeves, so the upper arm is bare skin and the sleeve is its own
   * stubby cylinder covering the top of it. Both are chunky: at this scale a
   * thin arm reads as an insect leg next to the head.
   * ---------------------------------------------------------------- */
  function makeArm(side, mirror) {
    const shoulder = new THREE.Vector3(side * P.shoulderX, P.shoulderY, 0.01);
    /* aimBone points each bone's +Y from the joint it starts at toward the next
     * one, so CylinderGeometry's *first* radius is the far end. Both bones had
     * their radii the wrong way round and so were fattest at the elbow and
     * wrist — the step at every joint in the first render. Thick end first. */
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.061, 1, 30), M.skin);
    upper.geometry.translate(0, 0.5, 0);
    upper.userData.baseLen = 1;
    upper.castShadow = true;
    avatar.add(upper);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.060, 0.070, 1, 30), M.tee);
    sleeve.geometry.translate(0, 0.5, 0);
    sleeve.userData.baseLen = 1;
    sleeve.castShadow = true;
    avatar.add(sleeve);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.053, 1, 30), M.skin);
    fore.geometry.translate(0, 0.5, 0);
    fore.userData.baseLen = 1;
    fore.castShadow = true;
    avatar.add(fore);
    // Larger than both bones it joins, so the elbow is a bulge, not a notch.
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.055, 22, 18), M.skin);
    elbowBall.castShadow = true;
    avatar.add(elbowBall);
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.074, 24, 18), M.tee);
    shoulderBall.position.copy(shoulder);
    shoulderBall.castShadow = true;
    avatar.add(shoulderBall);

    /* Wrist joint, in arm space and centred exactly on the wrist point, so it
     * caps the forearm cleanly no matter how the hand is rotated. Slightly
     * wider than the forearm's wrist end (0.045) so the joint reads as a bulge
     * rather than a step, and slightly flattened so it does not balloon. */
    const wristBall = new THREE.Mesh(new THREE.SphereGeometry(0.047, 24, 18), M.skin);
    wristBall.scale.set(1, 1, 0.92);
    wristBall.castShadow = true;
    avatar.add(wristBall);

    const hand = buildHand(M.skin, mirror);
    avatar.add(hand.root);
    return { shoulder, upper, sleeve, fore, elbowBall, wristBall, hand, side };
  }
  const armR = makeArm(-1, false);  // signer's right hand, on the viewer's left
  const armL = makeArm(1, true);

  const pole = new THREE.Vector3();
  const target = new THREE.Vector3();
  const _qAuth = new THREE.Quaternion();
  const _qAlign = new THREE.Quaternion();
  const _qLean = new THREE.Quaternion();
  const _qTwist = new THREE.Quaternion();
  const _eAuth = new THREE.Euler();
  const _yAxis = new THREE.Vector3();
  const _fore = new THREE.Vector3();

  function placeArm(arm, wrist) {
    target.set(wx(wrist.x), wy(wrist.y), wrist.z);

    /* The authored roll is needed here, before the IK, because it gives the
     * direction the fingers point — and that is what decides whether this hand
     * would be inside the head. See skullPush. */
    _qAuth.setFromEuler(_eAuth.set(0, deg(arm.side * 14), deg(-wrist.rot * arm.hand.side)));
    _yAxis.set(0, 1, 0).applyQuaternion(_qAuth);
    target.z += Math.max(
      skullPush(target.x, target.y, target.z, FACE_PAD),
      skullPush(
        target.x + _yAxis.x * TIP_REACH,
        target.y + _yAxis.y * TIP_REACH,
        target.z + _yAxis.z * TIP_REACH, FACE_PAD));

    // elbow hangs down and swings away from the body
    pole.set(arm.side * 0.30, -1, 0.42).normalize();
    const elbow = solveElbow(arm.shoulder, target, pole, P.upperArm, P.foreArm);
    aimBone(arm.upper, arm.shoulder, elbow);
    aimBone(arm.fore, elbow, target);
    // sleeve hem lands partway down the upper arm
    _lerp.copy(arm.shoulder).lerp(elbow, 0.45);
    aimBone(arm.sleeve, arm.shoulder, _lerp);
    arm.elbowBall.position.copy(elbow);
    arm.wristBall.position.copy(target);

    arm.hand.root.position.copy(target);

    /* Wrist orientation.
     *
     * `rot` is an on-screen roll authored for the flat renderer, and it used to
     * be the whole story: the hand took that angle and nothing else, so it had
     * no relationship to the forearm arriving at it and the wrist read as bent
     * the wrong way or snapped off.
     *
     * The fix cannot be to simply align the hand to the forearm, because the
     * forearm's direction comes from IK while `rot` carries the author's intent
     * about which way the handshape faces — and in ASL that orientation is part
     * of the sign, not decoration. So this leans the hand partway toward the
     * forearm axis and leaves the authored roll dominant. WRIST_FOLLOW is the
     * dial: 0 restores the old detached behaviour, 1 would let IK overrule the
     * authored orientation entirely. (_qAuth and _yAxis are already computed
     * above, since the depth clamp needs the finger direction.) */
    _fore.copy(target).sub(elbow).normalize();
    _qAlign.setFromUnitVectors(_yAxis, _fore);
    _qLean.identity().slerp(_qAlign, WRIST_FOLLOW);

    /* Palm facing — which this renderer used to throw away entirely.
     *
     * signs.js records for every sign whether the palm faces the addressee or
     * the signer, because in ASL that distinction is part of the sign. The flat
     * renderer consumes it to pick the hand's chirality; nothing here consumed
     * it at all, so every handshape came out palm-forward and palm was
     * indistinguishable from back of hand.
     *
     * Then, on top of the authored facing, a hanging arm pronates: the further
     * down the fingers point, the more the palm rolls in toward the thigh. That
     * is what makes a resting hand present its back rather than its palm, and
     * deriving it from how far down the hand points means "rest" needs no
     * special case here and the shared PALM_REST value stays untouched — it is
     * chosen for the flat renderer's chirality trick and must not move. */
    const facing = wrist.palm !== undefined && wrist.palm < 0 ? -1 : 1;
    const hang = clamp(-_yAxis.y, 0, 1);
    /* 80 degrees, which is a deliberate compromise and worth naming.
     *
     * Fingers curl toward the palm. So the squarer the back of the hand faces
     * the camera, the more completely the curled fingers hide behind it — at
     * 105 degrees the resting hand was a smooth stump. Wanting both the back of
     * the hand *and* clearly separated fingers on a hand that hangs and curls is
     * asking for two things that trade off against each other.
     *
     * Just short of edge-on resolves it the way a real hanging hand reads: the
     * outer edge and back of the hand face the viewer, and the fingers curl
     * across the view where their separation is visible, rather than straight
     * away from it. Raise this toward 180 for more back-of-hand and less finger.
     */
    _qTwist.setFromAxisAngle(
      _up, (facing < 0 ? Math.PI : 0) + hang * deg(80) * arm.hand.side);
    arm.hand.root.quaternion.copy(_qLean).multiply(_qAuth).multiply(_qTwist);
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function applyFace(f) {
    headPivot.rotation.set(
      deg(f.headNod * 12),
      deg(-f.headTurn * 20),
      deg(f.headTilt * 11)
    );
    const smile = clamp(f.smile, -1, 1);
    const grin = Math.max(0, smile);
    for (const e of eyes) {
      /* Blink and squint are a vertical squash of the whole eye, anchored so it
       * closes from the top down. `eyeOpen` above 1 genuinely widens it. */
      const open = clamp(f.eyeOpen, 0, 1.35) * (1 - f.squint * 0.42);
      e.g.scale.y = Math.max(0.02, open);
      e.g.position.y = e.gY0 - (1 - Math.min(open, 1)) * 0.006;
      e.irisG.position.x = f.gazeX * 0.0085;
      e.irisG.position.y = -f.gazeY * 0.0065;
      e.browG.position.y = e.browY0 + f.brow * 0.016;
      e.brow.rotation.z = BROW_ROT0 - deg(e.side * (f.browTilt * 15 - f.brow * 4));
      // Scale is baked into the cap's geometry, so cheek puff scales uniformly.
      e.blush.scale.setScalar(1 + f.cheek * 0.15);
    }
    // A grin flushes the cheeks. Cheap, and it is most of what sells the mood.
    M.blush.opacity = 0.30 + grin * 0.12;

    /* In this style a smile opens the mouth on its own — a grin with the lips
     * shut reads as a smirk — so `smile` contributes to the opening too. At rest
     * the opening collapses to a thin dark curve, which is the closed mouth. */
    const o = clamp(clamp(f.mouthOpen, 0, 1) + grin * 0.55, 0, 1.2);
    const sy = 0.16 + o * 1.30;
    const wide = 1 + f.mouthWide * 0.26 + grin * 0.22;
    mouthG.scale.set(wide, 1, 1);
    cavity.scale.set(1, sy, 0.30);
    teeth.visible = o > 0.16;
    teeth.position.set(0, 0.032 * sy - 0.007, 0.002);
    tongue.visible = f.tongue > 0.05;
    tongue.scale.set(1.2 * (0.6 + f.tongue * 0.5), 0.6, 0.8);
    mouthG.position.y = -o * 0.004;
  }

  let W = 400;
  let H = 520;

  const api = {
    resize(w, h) {
      W = Math.max(1, w);
      H = Math.max(1, h);
      renderer.setSize(W, H, false);
      camera.aspect = W / H;
      camera.updateProjectionMatrix();
    },
    frame(state) {
      const c = state.colors;
      if (c) {
        M.skin.color.set(c.skin);
        M.tee.color.set(c.shirt);
        M.hair.color.set(c.hair);
        M.iris.color.set(c.iris);
        M.brow.color.set(c.brow);
        M.lip.color.set(c.mouth);
        // Shades are derived rather than themed separately, so the CSS
        // variables stay the one place a colour is chosen.
        M.hairDark.color.set(c.hair).multiplyScalar(0.76);
        M.collar.color.set(c.shirt).multiplyScalar(0.90);
      }
      avatar.position.y = state.breath * 0.004;
      applyFace(state.face);
      applyHandPose(armR.hand, state.poseR);
      applyHandPose(armL.hand, state.poseL);
      placeArm(armR, state.wristR);
      placeArm(armL, state.wristL);
      renderer.render(scene, camera);
    },
  };
  return api;
}

/* ---------------------------------------------------------------- *
 * Boot — classic scripts have already run by the time a module executes.
 * ---------------------------------------------------------------- */

const canvas = document.getElementById('stage');
if (canvas && window.SLApp && window.SLApp.player && !/[?&]2d\b/.test(location.search)) {
  const scene = createScene(canvas);
  window.SLApp.player.attach(scene);
  window.SL3D = scene;
  document.documentElement.setAttribute('data-3d', 'ready');
}
