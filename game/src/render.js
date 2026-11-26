// The cockpit of DEAD STICK, drawn with Three.js primitives around the
// pilot's seat: a main panel with two live glass screens (canvas
// textures), a yoke and throttles that move with the controls, an
// overhead breaker panel, the engine-fire handle, the gear lever — and
// the captain, slumped in the left seat, who is the whole reason you
// are flying. Every control is a real mesh with an invisible, slightly
// enlarged hitbox, so a mouse click lands on it first try.

import { FLIGHT, PALETTE } from './config.js';

const flat = (color) => new THREE.MeshLambertMaterial({ color });
const basic = (color) => new THREE.MeshBasicMaterial({ color });

function box(w, h, d, color, x, y, z, parent, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material || flat(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

function canvasTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d'), texture: new THREE.CanvasTexture(canvas) };
}

function labelPlane(text, width, height, fg = '#cfd6dd', bg = '#1a1e24', fontPx = 44) {
  const { canvas, ctx, texture } = canvasTexture(512, 128);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 512, 128);
  ctx.fillStyle = fg;
  ctx.font = `bold ${fontPx}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 256, 68);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, height),
    new THREE.MeshBasicMaterial({ map: texture }),
  );
  return mesh;
}

export function createCockpit() {
  const group = new THREE.Group();
  // The flight deck sits at the FRONT of the airframe, a few metres
  // behind the radome — not in the middle of the tube. Shifting the
  // whole cockpit forward in the aircraft is what lets the pilot see
  // the runway over a nose that falls away below the eye line.
  group.position.z = -13.5;
  // Pictograms drawn on canvas: a picture is faster than a word when
  // the cockpit is shaking. Each control gets its own little glyph.
  function iconPlane(size, draw) {
    const { ctx, texture } = canvasTexture(128, 128);
    draw(ctx);
    texture.needsUpdate = true;
    return new THREE.Mesh(
      new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: texture, transparent: true }),
    );
  }
  const drawFlame = (g) => {
    g.fillStyle = '#ff7a26';
    g.beginPath();
    g.moveTo(64, 8);
    g.bezierCurveTo(96, 52, 104, 70, 104, 88);
    g.bezierCurveTo(104, 110, 86, 122, 64, 122);
    g.bezierCurveTo(42, 122, 24, 110, 24, 88);
    g.bezierCurveTo(24, 70, 36, 54, 48, 40);
    g.bezierCurveTo(46, 56, 52, 64, 58, 68);
    g.bezierCurveTo(56, 44, 58, 24, 64, 8);
    g.fill();
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.ellipse(64, 94, 15, 22, 0, 0, Math.PI * 2);
    g.fill();
  };
  const drawMask = (g) => {
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 7;
    g.beginPath();
    g.moveTo(14, 30);
    g.lineTo(40, 48);
    g.moveTo(114, 30);
    g.lineTo(88, 48);
    g.stroke();
    g.fillStyle = '#dfe5ea';
    g.beginPath();
    g.moveTo(40, 44);
    g.bezierCurveTo(40, 30, 88, 30, 88, 44);
    g.bezierCurveTo(88, 84, 78, 104, 64, 104);
    g.bezierCurveTo(50, 104, 40, 84, 40, 44);
    g.fill();
    g.strokeStyle = '#8a97a3';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(64, 104);
    g.bezierCurveTo(64, 118, 52, 120, 50, 126);
    g.stroke();
    g.fillStyle = '#31435a';
    g.fillRect(50, 58, 28, 7);
  };
  const drawCrossfeed = (g) => {
    g.fillStyle = '#a9c4e0';
    g.beginPath();
    g.moveTo(14, 44);
    g.lineTo(74, 44);
    g.lineTo(74, 30);
    g.lineTo(104, 54);
    g.lineTo(74, 78);
    g.lineTo(74, 64);
    g.lineTo(14, 64);
    g.fill();
    g.fillStyle = '#5b7d8a';
    g.beginPath();
    g.moveTo(114, 84);
    g.lineTo(54, 84);
    g.lineTo(54, 70);
    g.lineTo(24, 94);
    g.lineTo(54, 118);
    g.lineTo(54, 104);
    g.lineTo(114, 104);
    g.fill();
  };
  const drawRadio = (g) => {
    g.strokeStyle = '#ff9a8a';
    g.lineWidth = 8;
    for (const r of [26, 44, 62]) {
      g.beginPath();
      g.arc(64, 78, r, -2.35, -0.79);
      g.stroke();
    }
    g.fillStyle = '#ff9a8a';
    g.beginPath();
    g.ellipse(64, 82, 13, 13, 0, 0, Math.PI * 2);
    g.fill();
    g.fillRect(58, 88, 12, 30);
  };
  const drawRestart = (g) => {
    g.strokeStyle = '#e8e8e8';
    g.lineWidth = 11;
    g.beginPath();
    g.arc(64, 64, 40, 0.7, 5.5);
    g.stroke();
    g.fillStyle = '#e8e8e8';
    g.beginPath();
    g.moveTo(104, 40);
    g.lineTo(106, 76);
    g.lineTo(74, 58);
    g.fill();
  };
  const drawWheel = (g) => {
    g.fillStyle = '#20262e';
    g.beginPath();
    g.ellipse(64, 64, 46, 46, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8ccd0';
    g.beginPath();
    g.ellipse(64, 64, 19, 19, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#c8ccd0';
    g.lineWidth = 8;
    for (const a of [0, 2.1, 4.2]) {
      g.beginPath();
      g.moveTo(64, 64);
      g.lineTo(64 + Math.cos(a) * 40, 64 + Math.sin(a) * 40);
      g.stroke();
    }
  };
  const drawBolt = (g) => {
    g.fillStyle = '#ffd23e';
    g.beginPath();
    g.moveTo(72, 6);
    g.lineTo(30, 74);
    g.lineTo(56, 74);
    g.lineTo(44, 122);
    g.lineTo(98, 50);
    g.lineTo(70, 50);
    g.fill();
  };

  const interactables = [];
  const PANEL = '#232830';
  const DARK = '#14171c';

  function hitbox(action, label, w, h, d, x, y, z, parent) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
    );
    mesh.position.set(x, y, z);
    mesh.userData.action = action;
    (parent || group).add(mesh);
    interactables.push({ mesh, action, label });
    return mesh;
  }

  // --- Shell: floor, walls with window bands, roof, windshield frames ---
  box(3.9, 0.12, 6.4, DARK, 0, -1.18, 5.4, group);
  box(3.9, 0.14, 6.4, '#1b1f26', 0, 2.12, 5.4, group); // roof
  for (const side of [-1, 1]) {
    box(0.12, 1.5, 6.4, PANEL, side * 1.92, -0.42, 5.4, group); // below windows
    box(0.12, 0.55, 6.4, PANEL, side * 1.92, 1.85, 5.4, group); // above windows
    box(0.12, 2.7, 0.18, PANEL, side * 1.92, 0.75, 4.15, group); // front pillar
    box(0.12, 2.7, 0.18, PANEL, side * 1.92, 0.75, 6.6, group); // rear pillar
  }
  // Windshield: two faint panes and their frames, low over the panel.
  for (const side of [-1, 1]) {
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.72, 1.25),
      new THREE.MeshBasicMaterial({ color: '#bcd9ea', transparent: true, opacity: 0.07, depthWrite: false }),
    );
    pane.position.set(side * 0.88, 1.18, 4.32);
    pane.rotation.x = -0.32;
    pane.rotation.y = side * -0.1;
    group.add(pane);
  }
  box(0.09, 1.5, 0.09, PANEL, 0, 1.16, 4.28, group); // centre post

  // --- Main instrument panel and glareshield ---
  const panel = box(3.7, 1.3, 0.2, PANEL, 0, -0.12, 4.62, group);
  panel.rotation.x = -0.06;
  box(3.7, 0.1, 0.62, DARK, 0, 0.56, 4.78, group); // glareshield
  box(3.7, 0.45, 0.16, DARK, 0, -0.95, 4.66, group); // knee bolster closes the under-panel gap

  // --- The two glass screens ---
  const pfd = canvasTexture(512, 400);
  const pfdMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.67), new THREE.MeshBasicMaterial({ map: pfd.texture }));
  pfdMesh.position.set(-0.55, 0.02, 4.735);
  group.add(pfdMesh);
  const eicas = canvasTexture(512, 400);
  const eicasMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.67), new THREE.MeshBasicMaterial({ map: eicas.texture }));
  eicasMesh.position.set(0.48, 0.02, 4.735);
  group.add(eicasMesh);
  const placard = labelPlane(`${FLIGHT.callsign}  •  ${FLIGHT.aircraft}`, 0.86, 0.2, '#8fa3ad', '#10131a', 40);
  placard.position.set(0.48, 0.4, 4.735);
  group.add(placard);

  // --- Engine fire handle and restart button (left of the PFD) ---
  const fireLabel = labelPlane('ENG 1 FIRE', 0.44, 0.11, '#ff8a7a', '#2a1210', 46);
  fireLabel.position.set(-1.32, 0.46, 4.735);
  group.add(fireLabel);
  const fireHandleMat = basic('#c0271b');
  const fireHandle = box(0.3, 0.15, 0.12, '#c0271b', -1.32, 0.28, 4.78, group, fireHandleMat);
  hitbox('fireExt', 'Pull the ENG 1 fire handle — discharge the extinguisher', 0.5, 0.36, 0.4, -1.32, 0.28, 4.7);
  const fireIcon = iconPlane(0.15, drawFlame);
  fireIcon.position.set(-1.32, 0.57, 4.73);
  group.add(fireIcon);
  const restartMat = basic('#3a4a3a');
  const restartBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.07, 16), restartMat);
  restartBtn.rotation.x = Math.PI / 2;
  restartBtn.position.set(-1.32, -0.02, 4.78);
  group.add(restartBtn);
  const restartLabel = labelPlane('RESTART', 0.4, 0.1, '#b9c9b9', '#141a14', 46);
  restartLabel.position.set(-1.32, -0.2, 4.735);
  group.add(restartLabel);
  hitbox('restart', 'Press ENG 1 RESTART', 0.44, 0.4, 0.4, -1.32, -0.02, 4.7);
  const restartIcon = iconPlane(0.13, drawRestart);
  restartIcon.position.set(-1.58, -0.02, 4.73);
  group.add(restartIcon);

  // --- Standby horizon: a little ball between the screens that rolls
  // with the aircraft when everything else has gone dark ---
  const standby = canvasTexture(128, 128);
  {
    const g = standby.ctx;
    g.fillStyle = '#2e7fc2';
    g.fillRect(0, 0, 128, 64);
    g.fillStyle = '#7a5230';
    g.fillRect(0, 64, 128, 64);
    g.fillStyle = '#fff';
    g.fillRect(0, 62, 128, 4);
    g.strokeStyle = '#e8c832';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(24, 64);
    g.lineTo(52, 64);
    g.lineTo(64, 76);
    g.lineTo(76, 64);
    g.lineTo(104, 64);
    g.stroke();
    standby.texture.needsUpdate = true;
  }
  const standbyMesh = new THREE.Mesh(
    new THREE.CircleGeometry(0.078, 24),
    new THREE.MeshBasicMaterial({ map: standby.texture }),
  );
  standbyMesh.position.set(-0.035, 0.02, 4.745);
  group.add(standbyMesh);
  const standbyRing = new THREE.Mesh(new THREE.TorusGeometry(0.082, 0.012, 8, 24), flat('#0c0e11'));
  standbyRing.position.copy(standbyMesh.position);
  group.add(standbyRing);

  // --- Master warning button, front and centre ---
  const masterMat = basic('#571512');
  box(0.4, 0.17, 0.1, '#571512', -0.62, 0.44, 4.78, group, masterMat);
  hitbox('master', 'Master warning — check the systems screen', 0.56, 0.34, 0.4, -0.62, 0.44, 4.7);

  // --- Gear lever and its three green lights (right of the EICAS) ---
  const gearLabel = labelPlane('GEAR', 0.4, 0.11, '#cfd6dd', '#1a1e24', 48);
  gearLabel.position.set(1.38, 0.46, 4.735);
  group.add(gearLabel);
  const gearLights = [];
  for (let i = 0; i < 3; i++) {
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), basic('#274435'));
    light.position.set(1.24 + i * 0.14, 0.32, 4.76);
    group.add(light);
    gearLights.push(light);
  }
  const gearLever = new THREE.Group();
  const gearArm = box(0.07, 0.42, 0.07, '#c8ccd0', 0, 0.16, 0, gearLever);
  gearArm.rotation.x = 0.2;
  const gearKnob = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), basic('#e8e8e8'));
  gearKnob.position.set(0, 0.36, 0.04);
  gearLever.add(gearKnob);
  gearLever.position.set(1.38, -0.24, 4.8);
  group.add(gearLever);
  hitbox('gear', 'Landing gear lever — click to lower or raise the gear (or press G)', 0.3, 0.55, 0.34, 1.38, -0.05, 4.74);
  const gearIcon = iconPlane(0.13, drawWheel);
  gearIcon.position.set(1.05, 0.46, 4.73);
  group.add(gearIcon);

  // --- Oxygen and crossfeed (below the gear) ---
  const oxyMat = basic('#8a6a1c');
  box(0.2, 0.13, 0.09, '#8a6a1c', 1.12, -0.24, 4.78, group, oxyMat);
  const oxyLabel = labelPlane('OXY MASK', 0.42, 0.1, '#e8cf8a', '#1f1a10', 42);
  oxyLabel.position.set(1.12, -0.42, 4.735);
  group.add(oxyLabel);
  hitbox('oxygen', 'Deploy the oxygen masks', 0.34, 0.3, 0.3, 1.12, -0.26, 4.74);
  const oxyIcon = iconPlane(0.11, drawMask);
  oxyIcon.position.set(1.12, -0.24, 4.845);
  group.add(oxyIcon);
  const crossMat = basic('#31435a');
  box(0.2, 0.13, 0.09, '#31435a', 1.62, -0.24, 4.78, group, crossMat);
  const crossLabel = labelPlane('X-FEED', 0.42, 0.1, '#a9c4e0', '#10161f', 42);
  crossLabel.position.set(1.62, -0.42, 4.735);
  group.add(crossLabel);
  hitbox('crossfeed', 'Open the fuel crossfeed valve', 0.34, 0.3, 0.3, 1.62, -0.26, 4.74);
  const crossIcon = iconPlane(0.11, drawCrossfeed);
  crossIcon.position.set(1.62, -0.24, 4.845);
  group.add(crossIcon);

  // --- Overhead panel: four circuit breakers ---
  const overhead = new THREE.Group();
  const ohPanel = box(2.3, 0.85, 0.14, '#1d2129', 0, 0, 0, overhead);
  ohPanel.rotation.x = 0.5;
  overhead.position.set(0, 2.18, 6.0);
  overhead.rotation.x = 0.55;
  group.add(overhead);
  const ohLabel = labelPlane('CIRCUIT BREAKERS', 0.9, 0.14, '#cfd6dd', '#14171c', 40);
  ohLabel.position.set(0, 0.28, 0.1);
  ohLabel.rotation.x = -0.5;
  overhead.add(ohLabel);
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 7; i++) {
      box(0.05, 0.09, 0.05, '#aeb6bd', -0.78 + i * 0.26, 0.02 + r * 0.16, 0.09, overhead);
    }
  }
  const boltIcon = iconPlane(0.17, drawBolt);
  boltIcon.position.set(0, 0.3, 0.1);
  overhead.add(boltIcon);
  const breakerMeshes = [];
  const breakerNames = ['PFD', 'HYD', 'CABIN', 'FUEL'];
  for (let i = 0; i < 4; i++) {
    const breaker = box(0.1, 0.15, 0.08, '#d8b93a', -0.66 + i * 0.44, -0.12, 0.1, overhead, basic('#d8b93a'));
    breakerMeshes.push(breaker);
    const bl = labelPlane(breakerNames[i], 0.34, 0.09, '#9aa4ad', '#14171c', 44);
    bl.position.set(-0.66 + i * 0.44, -0.3, 0.1);
    bl.rotation.x = -0.5;
    overhead.add(bl);
    const hb = hitbox(`breaker${i}`, `Reset the ${breakerNames[i]} circuit breaker`, 0.4, 0.44, 0.4, 0, 0, 0, overhead);
    hb.position.set(-0.66 + i * 0.44, -0.12, 0.12);
  }

  // --- Yokes: yours moves with the controls; his hangs where it fell ---
  function yoke(x, z) {
    const g = new THREE.Group();
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.75, 10), flat('#2c313a'));
    column.rotation.x = 1.1;
    column.position.set(0, -0.1, 0.25);
    g.add(column);
    const bar = box(0.52, 0.07, 0.09, '#191d23', 0, 0.14, 0, g);
    void bar;
    for (const s of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 8), flat('#191d23'));
      grip.position.set(s * 0.26, 0.05, 0);
      g.add(grip);
    }
    g.position.set(x, -0.28, z);
    group.add(g);
    return g;
  }
  const yokeMine = yoke(0.55, 5.35);
  const yokeHis = yoke(-0.62, 5.35);
  yokeHis.rotation.z = 0.5;
  yokeHis.position.y = -0.42;

  // The emergency checklist, clipped to my yoke where a shaking hand
  // can read it: the whole game on one card.
  const card = canvasTexture(256, 192);
  {
    const g = card.ctx;
    g.fillStyle = '#e8e2d2';
    g.fillRect(0, 0, 256, 192);
    g.fillStyle = '#7a1710';
    g.font = 'bold 21px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('EMERGENCY', 14, 30);
    g.fillStyle = '#22252a';
    g.font = '16px system-ui, sans-serif';
    g.fillText('FIRE ..... PULL, then RESTART', 14, 62);
    g.fillText('ELEC ..... BREAKERS back IN', 14, 88);
    g.fillText('HYD ...... HOLD HER LEVEL', 14, 114);
    g.fillText('PRESS .... MASK, then X-FEED', 14, 140);
    g.fillText('LAND ..... GEAR, 105-165 kt', 14, 166);
    card.texture.needsUpdate = true;
  }
  const clipboard = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.225),
    new THREE.MeshBasicMaterial({ map: card.texture }),
  );
  clipboard.position.set(0, 0.3, -0.05);
  clipboard.rotation.x = -0.25;
  yokeMine.add(clipboard);

  // --- Centre pedestal and throttle levers ---
  box(0.62, 0.75, 1.9, '#1d2129', 0, -0.85, 5.9, group);
  const throttleLevers = [];
  for (const dx of [-0.12, 0.12]) {
    const lever = new THREE.Group();
    const arm = box(0.06, 0.42, 0.06, '#c8ccd0', 0, 0.2, 0, lever);
    void arm;
    const knob = box(0.11, 0.09, 0.16, '#101216', 0, 0.42, 0, lever);
    void knob;
    lever.position.set(dx, -0.52, 6.15);
    group.add(lever);
    throttleLevers.push(lever);
  }
  // The two black levers are the SIM GEAR quadrant: the left one
  // steps time down, the right one steps it up (x1, x2, x4). They sit
  // where a throttle quadrant would, because that is where a hand
  // already expects the speed of the world to be decided.
  const simLabel = labelPlane('SIM GEAR', 0.4, 0.1, '#b9c2c9', '#14171c', 42);
  simLabel.position.set(0, -0.27, 5.86);
  simLabel.rotation.x = -0.9;
  group.add(simLabel);
  const simMinus = labelPlane('−', 0.13, 0.13, '#ffffff', '#14171c', 72);
  simMinus.position.set(-0.1, -0.26, 5.9);
  simMinus.rotation.x = -0.9;
  group.add(simMinus);
  const simPlus = labelPlane('+', 0.13, 0.13, '#ffffff', '#14171c', 72);
  simPlus.position.set(0.14, -0.26, 5.9);
  simPlus.rotation.x = -0.9;
  group.add(simPlus);
  hitbox('simDown', 'SIM GEAR down — time steps slower (or press −)', 0.26, 0.5, 0.4, -0.1, -0.35, 6.12);
  hitbox('simUp', 'SIM GEAR up — time steps faster (or press =). Linger at x4 and the air turns rough', 0.26, 0.5, 0.4, 0.14, -0.35, 6.12);

  // The speedbrake lever, left of the throttles: pull it and she
  // steepens like a brick — the only way down from a high approach.
  const speedbrakeLever = new THREE.Group();
  const sbArm = box(0.06, 0.36, 0.06, '#c8ccd0', 0, 0.17, 0, speedbrakeLever);
  void sbArm;
  const sbKnob = box(0.13, 0.08, 0.14, '#8a2f1b', 0, 0.37, 0, speedbrakeLever);
  void sbKnob;
  speedbrakeLever.position.set(-0.32, -0.52, 6.15);
  group.add(speedbrakeLever);
  const sbLabel = labelPlane('SPOILERS', 0.36, 0.1, '#e0a58f', '#1c130e', 42);
  sbLabel.position.set(-0.32, -0.3, 5.9);
  sbLabel.rotation.x = -0.9;
  group.add(sbLabel);
  hitbox('speedbrake', 'Speedbrake lever — steepen the descent (or press SPACE)', 0.3, 0.5, 0.4, -0.34, -0.35, 6.12);

  const trimWheel = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.028, 8, 20), flat('#101216'));
  trimWheel.position.set(0.34, -0.62, 6.0);
  trimWheel.rotation.y = Math.PI / 2;
  group.add(trimWheel);
  const flapLever = new THREE.Group();
  const flapArm = box(0.05, 0.3, 0.05, '#c8ccd0', 0, 0.14, 0, flapLever);
  void flapArm;
  const flapKnob = box(0.12, 0.07, 0.1, '#e8e8e8', 0, 0.3, 0, flapLever);
  void flapKnob;
  flapLever.position.set(0.3, -0.52, 6.42);
  flapLever.rotation.x = 0.35;
  group.add(flapLever);
  const flapLabel = labelPlane('FLAP', 0.26, 0.09, '#b9c2c9', '#14171c', 44);
  flapLabel.position.set(0.3, -0.32, 6.3);
  flapLabel.rotation.x = -0.9;
  group.add(flapLabel);
  for (const px of [0.28, 0.82]) {
    const pedal = box(0.17, 0.24, 0.05, '#191d23', px, -1.0, 5.05, group);
    pedal.rotation.x = -0.5;
  }

  const maydayMat = basic('#7a1710');
  box(0.34, 0.12, 0.3, '#7a1710', 0, -0.42, 5.55, group, maydayMat);
  const maydayLabel = labelPlane('MAYDAY', 0.36, 0.1, '#ff9a8a', '#200d0b', 46);
  maydayLabel.position.set(0, -0.3, 5.5);
  maydayLabel.rotation.x = -0.9;
  group.add(maydayLabel);
  hitbox('mayday', 'Press the MAYDAY radio — tell Port Alba you are coming in', 0.4, 0.22, 0.36, 0, -0.42, 5.55);
  const radioIcon = iconPlane(0.17, drawRadio);
  radioIcon.position.set(0, -0.29, 5.32);
  radioIcon.rotation.x = -0.9;
  group.add(radioIcon);

  // --- Seats and the captain ---
  function seat(x) {
    box(0.62, 0.14, 0.6, '#2a3242', x, -0.78, 7.0, group);
    const back = box(0.62, 1.25, 0.14, '#2a3242', x, -0.1, 7.32, group);
    back.rotation.x = 0.12;
    box(0.4, 0.3, 0.1, '#39445c', x, 0.62, 7.42, group);
  }
  seat(0.55);
  seat(-0.62);
  const captain = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.26, 0.72, 10), flat('#22304d'));
  torso.position.y = 0.36;
  captain.add(torso);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), flat('#d9a37e'));
  head.position.set(0, 0.82, 0.1);
  captain.add(head);
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.07, 12), flat('#16233c'));
  capTop.position.set(0, 0.94, 0.1);
  captain.add(capTop);
  for (const s of [-1, 1]) {
    const armMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.05, 0.6, 8), flat('#22304d'));
    armMesh.position.set(s * 0.3, 0.3, 0.12);
    armMesh.rotation.z = s * 0.5;
    armMesh.rotation.x = 0.7;
    captain.add(armMesh);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.55, 8), flat('#1a2438'));
    leg.position.set(s * 0.13, -0.05, -0.3);
    leg.rotation.x = Math.PI / 2.3;
    captain.add(leg);
  }
  for (const s of [-1, 1]) {
    box(0.1, 0.025, 0.06, '#d8b93a', s * 0.17, 0.7, 0, captain); // epaulettes
    const belt = box(0.05, 0.5, 0.02, '#101216', s * 0.1, 0.38, 0.24, captain);
    belt.rotation.x = 0.2;
    belt.rotation.z = s * 0.35;
  }
  const headset = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 8, 20, Math.PI), flat('#14171c'));
  headset.position.set(0, 0.86, 0.1);
  headset.rotation.z = 0.15;
  captain.add(headset);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), flat('#14171c'));
  mic.position.set(0.1, 0.74, 0.22);
  mic.rotation.z = 1.1;
  mic.rotation.x = 0.5;
  captain.add(mic);
  captain.position.set(-0.62, -0.72, 6.85);
  group.add(captain);

  // --- Oxygen masks: stowed above, they drop when deployed ---
  const masks = new THREE.Group();
  for (const x of [-0.62, 0.55]) {
    const cup = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.14, 10), basic('#e8c832'));
    cup.position.set(x, 0, 6.3);
    masks.add(cup);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 6), flat('#888'));
    tube.position.set(x, 0.3, 6.3);
    masks.add(tube);
  }
  masks.position.y = 1.95;
  masks.visible = false;
  group.add(masks);

  // --- Cabin light: warm in health, red and dim on emergency power ---
  const cabinLight = new THREE.PointLight(0xfff1d6, 0.85, 9);
  cabinLight.position.set(0, 1.9, 6.3);
  group.add(cabinLight);

  // ---------- The two glass screens ----------
  function drawPFD(s) {
    const g = pfd.ctx;
    const W = 512;
    const H = 400;
    g.fillStyle = s.power === 'emergency' ? '#160d0d' : '#0a1620';
    g.fillRect(0, 0, W, H);
    // Attitude ball: sky and ground that roll and slide with the aircraft.
    g.save();
    g.beginPath();
    g.rect(56, 40, 250, 250);
    g.clip();
    g.translate(181, 165);
    g.rotate((-s.bankDeg * Math.PI) / 180);
    g.translate(0, s.pitchDeg * 3.2);
    g.fillStyle = '#2e7fc2';
    g.fillRect(-260, -260, 520, 260);
    g.fillStyle = '#7a5230';
    g.fillRect(-260, 0, 520, 260);
    g.fillStyle = '#fff';
    g.fillRect(-260, -2, 520, 4);
    g.restore();
    g.strokeStyle = '#e8c832';
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(121, 165);
    g.lineTo(161, 165);
    g.lineTo(181, 182);
    g.lineTo(201, 165);
    g.lineTo(241, 165);
    g.stroke();
    // Digital readouts: the numbers the bounty asks the HUD to show.
    g.fillStyle = '#0e2231';
    g.fillRect(330, 40, 160, 250);
    g.fillStyle = PALETTE.screenGlow;
    g.font = 'bold 30px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText('ALT ft', 344, 84);
    g.font = 'bold 52px system-ui, sans-serif';
    g.fillText(String(Math.max(0, Math.round(s.altFt))), 344, 140);
    g.font = 'bold 30px system-ui, sans-serif';
    g.fillText('SPD kt', 344, 196);
    g.font = 'bold 52px system-ui, sans-serif';
    g.fillStyle = s.speedKt > 165 && s.altFt < 3000 ? '#ff5a4a' : PALETTE.screenGlow;
    g.fillText(String(Math.round(s.speedKt)), 344, 252);
    g.fillStyle = '#0e2231';
    g.fillRect(56, 312, 434, 62);
    g.fillStyle = PALETTE.screenGlow;
    g.font = 'bold 40px system-ui, sans-serif';
    g.textAlign = 'center';
    g.fillText(`HDG ${String(Math.round(s.headingDeg)).padStart(3, '0')}°`, 181, 356);
    g.font = 'bold 30px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillText(`VS ${Math.round(s.sinkFtMin)}`, 330, 356);
    pfd.texture.needsUpdate = true;
  }

  function drawEICAS(s) {
    const g = eicas.ctx;
    const W = 512;
    const H = 400;
    g.fillStyle = s.power === 'emergency' ? '#170d0d' : '#0a141d';
    g.fillRect(0, 0, W, H);
    g.font = 'bold 27px system-ui, sans-serif';
    g.textAlign = 'left';
    g.fillStyle = '#9fd8c9';
    g.fillText(`${FLIGHT.callsign} — SYSTEMS`, 22, 40);
    const engText = (e) => (e === 'fire' ? 'FIRE' : e === 'out' ? 'OUT' : e === 'restarting' ? 'SPOOL…' : 'RUNNING');
    const engColor = (e) => (e === 'fire' ? '#ff5a4a' : e === 'out' ? '#ffb43a' : '#35e08a');
    g.font = 'bold 30px system-ui, sans-serif';
    g.fillStyle = '#cfd6dd';
    g.fillText('ENG 1', 22, 92);
    g.fillStyle = engColor(s.engLeft);
    g.fillText(engText(s.engLeft), 150, 92);
    g.fillStyle = '#cfd6dd';
    g.fillText('ENG 2', 22, 134);
    g.fillStyle = engColor(s.engRight);
    g.fillText(engText(s.engRight), 150, 134);
    g.fillStyle = '#cfd6dd';
    g.fillText('GEAR', 22, 176);
    g.fillStyle = s.gearDown ? '#35e08a' : '#ff5a4a';
    g.fillText(s.gearDown ? 'DOWN — 3 GREEN' : 'UP', 150, 176);
    g.fillStyle = '#cfd6dd';
    g.fillText('SPLR', 330, 176);
    g.fillStyle = s.speedbrake ? '#ffb43a' : '#5a6a72';
    g.fillText(s.speedbrake ? 'OUT' : 'IN', 425, 176);
    g.fillStyle = '#cfd6dd';
    g.fillText('FUEL', 22, 218);
    g.fillStyle = s.fuelPct < 25 ? '#ffb43a' : '#35e08a';
    g.fillText(`${Math.round(s.fuelPct)}%`, 150, 218);
    g.fillStyle = '#cfd6dd';
    g.fillText('CABIN', 280, 218);
    g.fillStyle = s.cabinOk ? '#35e08a' : '#ff5a4a';
    g.fillText(s.cabinOk ? 'OK' : 'PRESS!', 390, 218);
    // Hull integrity bar: the price of leaving an emergency unfixed.
    g.fillStyle = '#cfd6dd';
    g.fillText('HULL', 22, 262);
    g.fillStyle = '#26303a';
    g.fillRect(150, 240, 320, 26);
    g.fillStyle = s.hull > 50 ? '#35e08a' : s.hull > 25 ? '#ffb43a' : '#ff5a4a';
    g.fillRect(150, 240, Math.max(0, s.hull) * 3.2, 26);
    // Distance home and the live instruction line.
    g.fillStyle = '#9fd8c9';
    g.font = 'bold 26px system-ui, sans-serif';
    g.fillText(`PORT ALBA RWY ${FLIGHT.runway}: ${(Math.max(0, s.distanceM) / 1000).toFixed(1)} km`, 22, 306);
    g.fillStyle = '#ffd76a';
    g.font = 'bold 25px system-ui, sans-serif';
    const lines = (s.checklist || []).slice(0, 2);
    lines.forEach((line, i) => g.fillText(line, 22, 344 + i * 30));
    eicas.texture.needsUpdate = true;
  }

  let screenTimer = 0;
  let blinkTimer = 0;
  let maskDrop = 0;

  return {
    group,
    interactables,
    update(dt, s) {
      blinkTimer += dt;
      const alarm = !!s.event;
      masterMat.color.setHex(alarm && blinkTimer % 0.7 < 0.38 ? 0xff3b30 : 0x571512);
      fireHandleMat.color.setHex(s.engLeft === 'fire' && blinkTimer % 0.5 < 0.28 ? 0xff5a3c : 0xc0271b);
      fireHandle.position.z = s.fireDischarged ? 4.64 : 4.78;
      restartMat.color.setHex(s.engLeft === 'restarting' ? 0xd8b93a : s.engLeft === 'ok' ? 0x35e08a : 0x3a4a3a);
      oxyMat.color.setHex(s.oxygenDeployed ? 0x35e08a : 0x8a6a1c);
      crossMat.color.setHex(s.crossfeedOpen ? 0x35e08a : 0x31435a);
      maydayMat.color.setHex(s.maydaySent ? 0x35e08a : 0x7a1710);
      gearLever.rotation.x = s.gearDown ? 0.55 : -0.15;
      gearLights.forEach((light, i) => {
        light.material.color.setHex(s.gearDown ? 0x35e08a : s.gearTransit ? 0xffb43a : 0x274435);
        void i;
      });
      breakerMeshes.forEach((breaker, i) => {
        const on = s.breakers[i];
        breaker.position.z = on ? 0.1 : 0.02;
        breaker.material.color.setHex(on ? 0x4a7a5f : 0xd8b93a);
      });
      const slump = s.captainSlump ?? 1;
      captain.rotation.x = 0.52 * slump;
      captain.rotation.z = 0.18 * slump;
      captain.position.y = -0.72 - 0.06 * slump;
      standbyMesh.rotation.z = (s.bankDeg * Math.PI) / 180;
      trimWheel.rotation.x = (s.pitchInput || 0) * 1.4;
      yokeMine.rotation.z = (-s.bankDeg * Math.PI) / 180 * 0.9;
      yokeMine.position.z = 5.35 + s.pitchInput * 0.09;
      const gearIndex = [1, 2, 4].indexOf(s.simRate || 1);
      for (const lever of throttleLevers) lever.rotation.x = -0.08 - gearIndex * 0.3;
      speedbrakeLever.rotation.x = s.speedbrake ? 0.55 : -0.15;
      // Oxygen masks swing down in front of the seats once deployed.
      maskDrop = Math.max(0, Math.min(1, maskDrop + (s.oxygenDeployed ? dt * 1.6 : -dt * 3)));
      masks.visible = maskDrop > 0.02;
      masks.position.y = 1.95 - maskDrop * 0.95;
      masks.rotation.x = Math.sin(maskDrop * Math.PI) * 0.2;
      cabinLight.intensity = s.power === 'emergency' ? 0.32 : 0.85;
      cabinLight.color.setHex(s.power === 'emergency' ? 0xff9a7a : 0xfff1d6);
      screenTimer += dt;
      if (screenTimer > 0.12) {
        screenTimer = 0;
        drawPFD(s);
        drawEICAS(s);
      }
    },
  };
}
