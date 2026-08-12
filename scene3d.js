/* scene3d.js — WebGL avatar
 *
 * Replaces the 2D canvas renderer. The pose data is unchanged: the same joint
 * flexion angles that drove the flat drawing now drive real 3D joint
 * rotations, which is what makes palm orientation and depth of movement
 * actually expressible.
 *
 * Stage coordinates (400 x 520, y down) are mapped to world metres here so
 * signs.js can stay in the space it was authored in.
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
 * ---------------------------------------------------------------- */

const P = {
  headR: 0.105,
  neckY: 1.455,
  shoulderY: 1.40,
  shoulderX: 0.163,
  upperArm: 0.29,
  foreArm: 0.26,
  chestY: 1.22,
};

/* ---------------------------------------------------------------- *
 * Hand rig
 *
 * Local space: +Y along the fingers, +Z out of the palm, +X toward the thumb.
 * Flexion is a rotation about X (curling into the palm), spread about Z.
 * ---------------------------------------------------------------- */

const FINGERS = [
  { name: 'index',  x: 0.021,  y: 0.046, len: [0.040, 0.026, 0.020], r: 0.0092 },
  { name: 'middle', x: 0.007,  y: 0.049, len: [0.044, 0.029, 0.021], r: 0.0095 },
  { name: 'ring',   x: -0.008, y: 0.047, len: [0.041, 0.027, 0.020], r: 0.0089 },
  { name: 'pinky',  x: -0.022, y: 0.042, len: [0.031, 0.020, 0.017], r: 0.0078 },
];
const THUMB = { x: 0.026, y: 0.006, len: [0.036, 0.030], r: 0.0108 };

function segment(mat, len, r0, r1) {
  const g = new THREE.CylinderGeometry(r1, r0, len, 12, 1, false);
  g.translate(0, len / 2, 0);
  const m = new THREE.Mesh(g, mat);
  m.castShadow = true;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(r1, 12, 8), mat);
  cap.position.y = len;
  cap.castShadow = true;
  m.add(cap);
  return m;
}

function buildHand(mat, mirror) {
  const root = new THREE.Group();
  const side = mirror ? -1 : 1;

  // palm
  const palm = new THREE.Mesh(new THREE.SphereGeometry(0.044, 20, 14), mat);
  palm.scale.set(0.86, 1.02, 0.30);
  palm.position.y = 0.016;
  palm.castShadow = true;
  root.add(palm);
  const heel = new THREE.Mesh(new THREE.SphereGeometry(0.034, 16, 12), mat);
  heel.scale.set(0.95, 0.80, 0.36);
  heel.position.y = -0.012;
  heel.castShadow = true;
  root.add(heel);

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
      j.add(segment(mat, f.len[i], f.r * (1 - i * 0.13), f.r * (1 - (i + 1) * 0.13)));
      chain.push(j);
      parent = j;
    }
    joints.push(chain.slice(1));
  }

  // thumb sits on the side of the palm, rotated out of the finger plane
  const tBase = new THREE.Group();
  tBase.position.set(THUMB.x * side, THUMB.y, 0.008);
  root.add(tBase);
  const tChain = [];
  let tp = tBase;
  for (let i = 0; i < 2; i++) {
    const j = new THREE.Group();
    if (i > 0) j.position.y = THUMB.len[i - 1];
    tp.add(j);
    j.add(segment(mat, THUMB.len[i], THUMB.r * (1 - i * 0.15), THUMB.r * (1 - (i + 1) * 0.15)));
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
  // thumb: abduction swings it away from the palm, flexion folds it back
  hand.tBase.rotation.z = deg((pose.ts + 32) * side);
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
  const camera = new THREE.PerspectiveCamera(21, 1, 0.1, 20);
  camera.position.set(0, 1.40, 2.30);
  camera.lookAt(0, 1.33, 0);
  // ?cam=head frames the face for checking expressions
  if (typeof location !== 'undefined' && /[?&]cam=head/.test(location.search)) {
    camera.fov = 20;
    camera.position.set(0, 1.585, 0.92);
    camera.lookAt(0, 1.575, 0);
  }

  scene.add(new THREE.HemisphereLight(0xdfe6ff, 0x2a2438, 0.85));
  const key = new THREE.DirectionalLight(0xfff2e2, 1.5);
  key.position.set(-1.4, 2.6, 2.2);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 7;
  key.shadow.camera.left = -1.2;
  key.shadow.camera.right = 1.2;
  key.shadow.camera.top = 2.4;
  key.shadow.camera.bottom = 0.2;
  key.shadow.bias = -0.0015;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9fb4ff, 0.5);
  fill.position.set(2.2, 1.2, 1.4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffd7b0, 0.7);
  rim.position.set(0.6, 1.8, -2.2);
  scene.add(rim);

  const M = {
    skin: new THREE.MeshStandardMaterial({ color: 0xefc09b, roughness: 0.66, metalness: 0 }),
    shirt: new THREE.MeshStandardMaterial({ color: 0x5b5fd6, roughness: 0.86 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x2f211b, roughness: 0.78 }),
    // Not pure white. A bright white ball in a face reads as a googly eye;
    // real sclera is warm and slightly shaded by the socket.
    sclera: new THREE.MeshStandardMaterial({ color: 0xefe8de, roughness: 0.22 }),
    iris: new THREE.MeshStandardMaterial({ color: 0x6b4a2f, roughness: 0.18 }),
    limbal: new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.4 }),
    lash: new THREE.MeshStandardMaterial({ color: 0x2a1d17, roughness: 0.85 }),
    pupil: new THREE.MeshStandardMaterial({ color: 0x140f0c, roughness: 0.3 }),
    brow: new THREE.MeshStandardMaterial({ color: 0x33241d, roughness: 0.8 }),
    lip: new THREE.MeshStandardMaterial({ color: 0xa85f57, roughness: 0.52 }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x54211f, roughness: 0.7 }),
  };

  const avatar = new THREE.Group();
  scene.add(avatar);

  /* torso */
  const profile = [
    [0.020, 0.90], [0.130, 0.93], [0.150, 1.02], [0.156, 1.14],
    [0.163, 1.26], [0.176, 1.345], [0.168, 1.385], [0.120, 1.418],
    [0.062, 1.437], [0.030, 1.445],
  ].map((p) => new THREE.Vector2(p[0], p[1]));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(profile, 40), M.shirt);
  torso.scale.z = 0.68;
  torso.castShadow = true;
  torso.receiveShadow = true;
  avatar.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.043, 0.052, 0.10, 16), M.skin);
  neck.position.y = 1.45;
  neck.castShadow = true;
  neck.receiveShadow = true;
  avatar.add(neck);

  /* head */
  const head = new THREE.Group();
  head.position.y = P.neckY + 0.045;
  avatar.add(head);

  const skull = new THREE.Mesh(new THREE.SphereGeometry(P.headR, 48, 32), M.skin);
  skull.scale.set(0.84, 1.14, 0.95);
  skull.position.y = 0.075;
  skull.castShadow = true;
  skull.receiveShadow = true;
  head.add(skull);

  // Jaw: narrows the lower face so the head is not a plain ovoid.
  const jaw = new THREE.Mesh(new THREE.SphereGeometry(P.headR * 0.80, 32, 24), M.skin);
  jaw.scale.set(0.82, 0.86, 0.92);
  jaw.position.y = 0.030;
  jaw.castShadow = true;
  head.add(jaw);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(P.headR * 1.05, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.38), M.hair);
  hair.scale.set(0.90, 1.16, 1.03);
  hair.position.y = 0.075;
  hair.castShadow = true;
  head.add(hair);


  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), M.skin);
    ear.scale.set(0.45, 1.05, 0.75);
    ear.position.set(s * P.headR * 0.80, 0.062, -0.004);
    head.add(ear);
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.032, 12), M.skin);
  nose.rotation.x = deg(104);
  nose.position.set(0, 0.058, 0.0905);
  head.add(nose);

  /* Eyes.
   *
   * The eyeball used to sit 5mm proud of the skull surface — a white sphere
   * stuck on the front of the face, which is exactly what reads as googly.
   * It is now smaller and set back inside the socket, so only the aperture
   * between the lids shows, and it carries the three things that actually
   * make a drawn eye look like an eye: a dark limbal ring around the iris, a
   * lash line along the upper lid, and a catchlight. */
  const eyes = [];
  /* The skull is a solid sphere with no sockets cut into it, so an eye can
   * only be seen where it stands proud of the surface. The surface sits at
   * z=0.0921 here, so the ball is set just 2mm out — enough for the aperture
   * between the lids to read, where the old 5mm made a ball stuck on a face.
   * Bury it any deeper and the eye disappears inside the head entirely. */
  const EYE_Z = 0.0803;
  const EYE_R = 0.0138;
  for (const s of [-1, 1]) {
    const g = new THREE.Group();
    g.position.set(s * 0.0328, 0.0862, EYE_Z);
    head.add(g);

    const ball = new THREE.Mesh(new THREE.SphereGeometry(EYE_R, 28, 20), M.sclera);
    ball.scale.set(1, 0.95, 0.9);
    g.add(ball);

    // Limbal ring: the dark boundary of the iris. Eyes look dead without it.
    const limbal = new THREE.Mesh(new THREE.SphereGeometry(0.0064, 20, 16), M.limbal);
    limbal.position.z = 0.0118;
    limbal.scale.z = 0.5;
    ball.add(limbal);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.0054, 20, 16), M.iris);
    iris.position.z = 0.0012;
    iris.scale.z = 1;
    limbal.add(iris);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0024, 16, 12), M.pupil);
    pupil.position.z = 0.0030;
    pupil.scale.z = 0.7;
    iris.add(pupil);
    // Catchlight — a real eye always has one, and it is most of the liveliness.
    const spark = new THREE.Mesh(new THREE.SphereGeometry(0.0013, 10, 8), M.sclera);
    spark.position.set(-s * 0.0019, 0.0021, 0.0044);
    iris.add(spark);

    // Lids are spherical caps that rotate down over the eyeball.
    const lidGeo = new THREE.SphereGeometry(EYE_R * 1.10, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.5);
    const upper = new THREE.Mesh(lidGeo, M.skin);
    g.add(upper);
    const lower = new THREE.Mesh(lidGeo, M.skin);
    lower.rotation.x = Math.PI;
    g.add(lower);

    // Lash line, carried by the upper lid so it tracks blinks.
    const lash = new THREE.Mesh(
      new THREE.TorusGeometry(EYE_R * 1.06, 0.0016, 6, 20, Math.PI * 0.92), M.lash);
    lash.rotation.set(deg(90), 0, deg(4));
    lash.position.y = -0.0004;
    upper.add(lash);

    const browGeo = new THREE.TorusGeometry(0.0182, 0.0032, 8, 20, Math.PI * 0.66);
    const brow = new THREE.Mesh(browGeo, M.brow);
    brow.position.set(s * 0.0328, 0.1022, 0.0910);
    brow.rotation.set(deg(-18), 0, deg(90) - Math.PI * 0.33);
    brow.scale.set(1, 0.68, 0.6);
    head.add(brow);

    eyes.push({ g, ball, upper, lower, brow, side: s });
  }

  /* mouth */
  const mouthG = new THREE.Group();
  mouthG.position.set(0, 0.020, 0.0870);
  head.add(mouthG);
  const cavity = new THREE.Mesh(new THREE.SphereGeometry(0.021, 18, 12), M.mouth);
  cavity.scale.set(1, 0.35, 0.4);
  mouthG.add(cavity);
  const lipTop = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0038, 10, 24, Math.PI), M.lip);
  lipTop.scale.z = 0.5;
  mouthG.add(lipTop);
  const lipBot = new THREE.Mesh(new THREE.TorusGeometry(0.0185, 0.0046, 10, 24, Math.PI), M.lip);
  lipBot.rotation.z = Math.PI;
  lipBot.scale.z = 0.5;
  mouthG.add(lipBot);

  /* arms + hands */
  function makeArm(side, mirror) {
    const shoulder = new THREE.Vector3(side * P.shoulderX, P.shoulderY, 0.01);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.040, 0.034, 1, 14), M.shirt);
    upper.geometry.translate(0, 0.5, 0);
    upper.userData.baseLen = 1;
    upper.castShadow = true;
    avatar.add(upper);
    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.028, 1, 14), M.skin);
    fore.geometry.translate(0, 0.5, 0);
    fore.userData.baseLen = 1;
    fore.castShadow = true;
    avatar.add(fore);
    const elbowBall = new THREE.Mesh(new THREE.SphereGeometry(0.033, 16, 12), M.skin);
    elbowBall.castShadow = true;
    avatar.add(elbowBall);
    const shoulderBall = new THREE.Mesh(new THREE.SphereGeometry(0.040, 18, 14), M.shirt);
    shoulderBall.position.copy(shoulder);
    shoulderBall.castShadow = true;
    avatar.add(shoulderBall);

    const hand = buildHand(M.skin, mirror);
    avatar.add(hand.root);
    return { shoulder, upper, fore, elbowBall, hand, side };
  }
  const armR = makeArm(-1, false);  // signer's right hand, on the viewer's left
  const armL = makeArm(1, true);

  const pole = new THREE.Vector3();
  const target = new THREE.Vector3();

  function placeArm(arm, wrist) {
    target.set(wx(wrist.x), wy(wrist.y), wrist.z);
    // elbow hangs down and swings away from the body
    pole.set(arm.side * 0.30, -1, 0.42).normalize();
    const elbow = solveElbow(arm.shoulder, target, pole, P.upperArm, P.foreArm);
    aimBone(arm.upper, arm.shoulder, elbow);
    aimBone(arm.fore, elbow, target);
    arm.elbowBall.position.copy(elbow);

    arm.hand.root.position.copy(target);
    // `rot` is the authored on-screen roll; apply it about the view axis and
    // let the forearm just meet the wrist.
    arm.hand.root.rotation.set(0, deg(arm.side * 14), deg(-wrist.rot * arm.hand.side));
  }

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  function applyFace(f) {
    head.rotation.set(
      deg(f.headNod * 13),
      deg(-f.headTurn * 22),
      deg(f.headTilt * 12)
    );
    for (const e of eyes) {
      const open = clamp(f.eyeOpen, 0, 1.3);
      e.upper.rotation.x = deg(-49 + (1 - open) * 80);
      e.lower.rotation.x = Math.PI + deg(52 - f.squint * 58);
      e.ball.rotation.y = deg(f.gazeX * 22);
      e.ball.rotation.x = deg(f.gazeY * 16);
      e.brow.position.y = 0.1022 + f.brow * 0.010;
      e.brow.rotation.z = deg(90) - Math.PI * 0.33 - deg(e.side * (f.browTilt * 16 - f.brow * 4));
      e.brow.position.z = 0.0910 + f.brow * 0.002;
    }
    const open = clamp(f.mouthOpen, 0, 1);
    const wide = 1 + f.mouthWide * 0.30;
    mouthG.scale.set(wide, 1, 1);
    cavity.scale.set(1, 0.22 + open * 1.5, 0.4);
    lipTop.position.y = 0.001 + open * 0.010;
    lipBot.position.y = -0.001 - open * 0.012;
    // smile lifts the corners by rolling the lip arcs in the face plane
    lipTop.rotation.z = deg(f.smile * 10);
    lipBot.rotation.z = Math.PI + deg(f.smile * 10);
    mouthG.position.y = 0.020 - open * 0.004;
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
        M.shirt.color.set(c.shirt);
        M.hair.color.set(c.hair);
        M.iris.color.set(c.iris);
        M.brow.color.set(c.brow);
        M.lip.color.set(c.mouth);
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
