// DEAD STICK — boot, the flight simulation, the crisis, and the landing.
//
// Meridian Air 207 is descending into Port Alba when the captain passes
// out in the left seat. The autopilot holds her for a few seconds of
// calm; then the failures start, one at a time, and every one of them is
// fixed from the seat: pull the fire handle, reset the breakers, fight
// the hydraulics with the yoke, drop the oxygen masks. Survive the
// crisis and the last job is the hardest — put a twinjet on runway 27
// with whatever the emergencies left you.
//
// ?seed=N fixes the crisis order. ?shot=start|fire|approach|tail stages
// that scene for a screenshot and sets window.__shotReady.

import { CRISIS, DESCENT, FLIGHT, LANDING, STEP, BEST_KEY } from './config.js';
import { makeRandom, range, shuffled } from './random.js';
import { createInput, held } from './input.js';
import { createAudio } from './audio.js';
import { createWorld } from './world.js';
import { createCockpit } from './render.js';
import { stageShot } from './shots.js';

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 20727;
const random = makeRandom(seed);

const canvas = document.getElementById('game');
const statusLine = document.getElementById('status');
const input = createInput(canvas);
const audio = createAudio();

// ---------- DOM furniture: crosshair, prompt, banner, title, endings ----------
function makeDiv(styles, parent = document.body) {
  const div = document.createElement('div');
  Object.assign(div.style, styles);
  parent.appendChild(div);
  return div;
}
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const crosshair = makeDiv({
  position: 'fixed', left: '50%', top: '50%', width: '6px', height: '6px',
  marginLeft: '-3px', marginTop: '-3px', borderRadius: '50%',
  background: 'rgba(255,255,255,0.85)', boxShadow: '0 0 4px rgba(0,0,0,0.8)',
  pointerEvents: 'none', zIndex: 5, fontFamily: FONT,
});
const promptLine = makeDiv({
  position: 'fixed', left: '50%', bottom: '9%', transform: 'translateX(-50%)',
  color: '#ffe9a8', fontFamily: FONT, fontSize: '19px', fontWeight: 600,
  textShadow: '0 1px 4px #000', pointerEvents: 'none', zIndex: 5, textAlign: 'center',
});
const banner = makeDiv({
  position: 'fixed', left: '50%', top: '12%', transform: 'translateX(-50%)',
  color: '#fff', fontFamily: FONT, fontSize: '26px', fontWeight: 800,
  letterSpacing: '1px', textShadow: '0 2px 8px #000', pointerEvents: 'none',
  zIndex: 5, textAlign: 'center', whiteSpace: 'pre-line',
});
const hint = makeDiv({
  position: 'fixed', right: '14px', top: '10px', color: 'rgba(255,255,255,0.75)',
  fontFamily: FONT, fontSize: '13px', textShadow: '0 1px 3px #000',
  pointerEvents: 'none', zIndex: 5, textAlign: 'right',
  textContent: '',
});
hint.textContent = 'Drag to look • Click a control to use it • A/D bank • W/S pitch • R/F throttle • SPACE speedbrakes • G gear • C tail cam • M mute';
const overlay = makeDiv({
  position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'center', background: 'rgba(4,8,14,0.72)',
  color: '#eef1f5', fontFamily: FONT, zIndex: 10, textAlign: 'center', padding: '24px',
});
const overlayTitle = makeDiv({ fontSize: '54px', fontWeight: 900, letterSpacing: '3px' }, overlay);
const overlayBody = makeDiv({ fontSize: '19px', lineHeight: 1.55, maxWidth: '640px', marginTop: '14px', whiteSpace: 'pre-line' }, overlay);
const overlayButton = document.createElement('button');
Object.assign(overlayButton.style, {
  marginTop: '26px', fontSize: '20px', fontWeight: 700, padding: '13px 34px',
  borderRadius: '10px', border: '0', background: '#0e7d8a', color: '#fff', cursor: 'pointer',
});
overlay.appendChild(overlayButton);

// ---------- Three.js scene ----------
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x8fc7e8);
scene.fog = new THREE.Fog(0xa8c8dd, 6000, 46000);
scene.add(new THREE.HemisphereLight(0xcfe8ff, 0x3a4a3a, 0.95));
const sun = new THREE.DirectionalLight(0xfff2d0, 1.1);
sun.position.set(-0.4, 1, 0.35);
scene.add(sun);

const world = createWorld(random);
scene.add(world.route);
scene.add(world.planeGroup);
const cockpit = createCockpit();
world.planeGroup.add(cockpit.group);

const camera = new THREE.PerspectiveCamera(66, 1, 0.05, 90000);
scene.add(camera);

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// ---------- The simulation state (the shape render.js draws) ----------
function freshState() {
  return {
    phase: 'title',
    time: 0,
    altFt: DESCENT.startAltitudeFt,
    speedKt: DESCENT.startSpeedKt,
    headingDeg: 270,
    bankDeg: 0,
    pitchDeg: 0,
    pitchInput: 0,
    sinkFtMin: 1500,
    throttle: 0.55,
    distanceM: DESCENT.startDistanceM,
    lateralM: 0,
    hull: CRISIS.startHull,
    fuelPct: 62,
    cabinOk: true,
    power: 'normal',
    engLeft: 'ok',
    engRight: 'ok',
    fireDischarged: false,
    oxygenDeployed: false,
    crossfeedOpen: false,
    maydaySent: false,
    gearDown: false,
    gearTransit: false,
    speedbrake: false,
    breakers: [true, true, true, true],
    event: null,
    checklist: ['Cruise is quiet. The captain is flying.'],
    score: 0,
    endReason: '',
  };
}
let s = freshState();
let eventQueue = [];
let gapTimer = 0;
let gearTimer = 0;
let fireOutTimer = -1;
let restartTimer = -1;
let hydraulicHold = 0;
let calmAnnounced = false;
let tailCam = false;
let muted = false;

function announce(text) {
  statusLine.textContent = text;
}

function setBanner(text, seconds = 0) {
  banner.textContent = text;
  if (seconds > 0) setTimeout(() => { if (banner.textContent === text) banner.textContent = ''; }, seconds * 1000);
}

function startGame() {
  audio.init();
  s = freshState();
  s.phase = 'calm';
  eventQueue = shuffled(random, ['electrical', 'hydraulic', 'pressure']);
  gapTimer = CRISIS.calmSeconds;
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
  setBanner('MERIDIAN 207 — DESCENDING INTO PORT ALBA', 4);
  announce('Flight started. The captain is flying; the descent is quiet.');
}

function showOverlay(title, body, button) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlayButton.textContent = button;
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
}
showOverlay(
  'DEAD STICK',
  `${FLIGHT.airline} flight 207, a ${FLIGHT.aircraft} on descent into ${FLIGHT.destination}.\n` +
    'Thirty seconds from now the captain will pass out in the left seat — and you are in the right one.\n' +
    'Fix what breaks from the seat. Then land her yourself.\n\n' +
    'Drag to look around the cockpit. Click the glowing controls to use them.\nA/D bank • W/S pitch • R/F throttle • G landing gear • C tail camera',
  'TAKE THE RIGHT SEAT',
);
overlayButton.addEventListener('click', () => {
  if (s.phase === 'title' || s.phase === 'won' || s.phase === 'crashed') startGame();
});

// ---------- Emergencies ----------
const EVENT_TITLES = {
  engineFire: '🔥 ENGINE 1 FIRE',
  electrical: '⚡ ELECTRICAL FAILURE',
  hydraulic: '🌀 HYDRAULIC LOSS — SHE IS ROLLING',
  pressure: '😮‍💨 CABIN PRESSURE FALLING',
};

function startEvent(type) {
  s.event = { type, elapsed: 0, step: 0 };
  audio.masterWarning();
  setBanner(`${EVENT_TITLES[type]}\nThe captain is down — it is you now.`, 3.5);
  announce(EVENT_TITLES[type]);
  if (type === 'engineFire') {
    s.engLeft = 'fire';
    s.fireDischarged = false;
    world.setEngineFire(true);
    audio.fireBell();
    s.checklist = ['1. PULL the red ENG 1 FIRE handle (left of the screens)', '2. Then press ENG 1 RESTART below it'];
  } else if (type === 'electrical') {
    s.power = 'emergency';
    const tripped = shuffled(random, [0, 1, 2, 3]).slice(0, 3);
    s.breakers = s.breakers.map((on, i) => (tripped.includes(i) ? false : on));
    s.checklist = ['Look UP at the overhead panel', 'Click every breaker that has dropped (yellow)'];
  } else if (type === 'hydraulic') {
    hydraulicHold = 0;
    s.checklist = ['Hold her level with A / D against the roll', 'Keep the wings level for 5 seconds in total'];
  } else if (type === 'pressure') {
    s.cabinOk = false;
    s.checklist = ['1. Click OXY MASK (right of the screens)', '2. Then open the X-FEED valve beside it'];
  }
}

function fixEvent() {
  const type = s.event.type;
  s.event = null;
  gapTimer = range(random, CRISIS.gapMinSeconds, CRISIS.gapMaxSeconds);
  audio.fixed();
  setBanner('✓ SYSTEM RESTORED', 2.2);
  announce(`${EVENT_TITLES[type]} fixed.`);
  if (type === 'engineFire') s.checklist = ['Both engines turning. Breathe.'];
  if (type === 'electrical') s.checklist = ['Power is back. Instruments alive.'];
  if (type === 'hydraulic') s.checklist = ['Hydraulics holding. She answers the yoke again.'];
  if (type === 'pressure') s.checklist = ['Cabin pressure steady. Masks away.'];
}

function endGame(wonGame, reason) {
  s.phase = wonGame ? 'won' : 'crashed';
  s.endReason = reason;
  if (wonGame) {
    audio.touchdown();
    const alignBonus = Math.max(0, 300 - Math.abs(s.lateralM) * 10);
    const speedBonus = Math.max(0, 300 - Math.abs(s.speedKt - 135) * 8);
    s.score = Math.round(1000 + s.hull * 10 + alignBonus + speedBonus + (s.maydaySent ? 100 : 0));
    let best = 0;
    try {
      best = Number(localStorage.getItem(BEST_KEY) || 0);
      if (s.score > best) localStorage.setItem(BEST_KEY, String(s.score));
    } catch { /* private mode: no best score, no problem */ }
    showOverlay(
      '🛬 SHE IS DOWN. EVERYONE WALKS AWAY.',
      `${reason}\n\nScore ${s.score} — hull ${Math.round(s.hull)}%, ` +
        `touchdown at ${Math.round(s.speedKt)} kt, ${Math.abs(Math.round(s.lateralM))} m off the centreline.` +
        `${s.score >= best && best > 0 ? '\n★ NEW BEST' : ''}\nThe captain wakes up in the ambulance and asks who landed his plane.`,
      'FLY HER AGAIN',
    );
  } else {
    audio.crash();
    showOverlay('💥 DEAD STICK', `${reason}\n\nThe investigation will note that a passenger held a burning twinjet together for ${Math.floor(s.time)} seconds — and very nearly landed her.`, 'TRY AGAIN');
  }
  announce(reason);
}

// ---------- Cockpit actions ----------
function doAction(action) {
  audio.init();
  audio.click();
  const ev = s.event;
  if (action === 'fireExt') {
    if (ev && ev.type === 'engineFire' && ev.step === 0) {
      s.fireDischarged = true;
      ev.step = 1;
      fireOutTimer = 3;
      s.checklist = ['Extinguisher discharging… watch the fire die', 'Then press ENG 1 RESTART'];
    } else if (s.engLeft === 'fire') {
      promptFlash('Pull it during the fire — it is already out!');
    } else {
      promptFlash('No fire. The handle stays put.');
    }
  } else if (action === 'restart') {
    if (ev && ev.type === 'engineFire' && ev.step === 1 && s.engLeft === 'out') {
      s.engLeft = 'restarting';
      restartTimer = 4;
      s.checklist = ['Engine 1 spooling up…'];
    } else {
      promptFlash(s.engLeft === 'ok' ? 'Engine 1 is already running.' : 'Nothing to restart yet.');
    }
  } else if (action.startsWith('breaker')) {
    const i = Number(action.slice(7));
    if (!s.breakers[i]) {
      s.breakers[i] = true;
      if (ev && ev.type === 'electrical' && s.breakers.every(Boolean)) {
        s.power = 'normal';
        fixEvent();
      }
    } else {
      promptFlash('That breaker is already in.');
    }
  } else if (action === 'oxygen') {
    if (ev && ev.type === 'pressure' && ev.step === 0) {
      s.oxygenDeployed = true;
      ev.step = 1;
      s.checklist = ['Masks on. Now open the X-FEED valve beside it'];
    } else if (!s.oxygenDeployed) {
      s.oxygenDeployed = true;
      promptFlash('Masks dropped. (No emergency — the cabin crew will sigh.)');
    } else {
      promptFlash('Masks are already down.');
    }
  } else if (action === 'crossfeed') {
    if (ev && ev.type === 'pressure' && ev.step === 1) {
      s.crossfeedOpen = true;
      s.cabinOk = true;
      fixEvent();
    } else if (!s.crossfeedOpen) {
      s.crossfeedOpen = true;
      promptFlash('Crossfeed open.');
    } else {
      promptFlash('Crossfeed is already open.');
    }
  } else if (action === 'gear') {
    toggleGear();
  } else if (action === 'speedbrake') {
    s.speedbrake = !s.speedbrake;
    promptFlash(s.speedbrake ? 'Speedbrakes OUT — she steepens and slows.' : 'Speedbrakes in.');
  } else if (action === 'mayday') {
    if (!s.maydaySent) {
      s.maydaySent = true;
      setBanner('📻 "MAYDAY MAYDAY — MERIDIAN 207, CAPTAIN INCAPACITATED,\nPASSENGER FLYING, REQUESTING STRAIGHT-IN RUNWAY 27"', 4);
      if (s.phase === 'approach') s.checklist = ['Tower clears you straight in. Line her up.'];
    } else {
      promptFlash('Tower already knows. Fly the plane.');
    }
  } else if (action === 'master') {
    if (s.event) setBanner(EVENT_TITLES[s.event.type], 2);
  }
}

function toggleGear() {
  if (s.gearTransit) return;
  s.gearTransit = true;
  gearTimer = 2.5;
  audio.gear();
}

let promptFlashUntil = 0;
function promptFlash(text) {
  promptLine.textContent = text;
  promptFlashUntil = performance.now() + 1800;
}

// ---------- One fixed step of simulation ----------
function step(dt) {
  s.time += dt;
  const ev = s.event;

  // Phase flow: calm -> crisis (captain down + first fire) -> approach.
  if (s.phase === 'calm' || s.phase === 'crisis') {
    if (!ev) {
      gapTimer -= dt;
      if (gapTimer <= 0) {
        if (s.phase === 'calm') {
          s.phase = 'crisis';
          if (!calmAnnounced) {
            calmAnnounced = true;
            setBanner('THE CAPTAIN HAS PASSED OUT.\nThe autopilot lets go. She is yours.', 4);
          }
          startEvent('engineFire');
        } else if (eventQueue.length > 0) {
          startEvent(eventQueue.shift());
        }
      }
    }
  }
  // The approach begins when the field is genuinely close: 7 km out,
  // or low enough that landing is the only idea left. The descent
  // profile is built so a normally flown crisis arrives at 7 km with
  // several thousand feet in hand — altitude thrown away on stalls
  // and wallowing is the player's to answer for.
  if ((s.distanceM <= 7000 || s.altFt <= 1600) && (s.phase === 'calm' || s.phase === 'crisis')) {
    s.phase = 'approach';
    s.event = null;
    world.setEngineFire(false);
    if (s.engLeft === 'fire') s.engLeft = 'out';
    setBanner('FINAL APPROACH — PORT ALBA RUNWAY 27', 3.5);
    s.checklist = [
      s.gearDown ? 'Gear is DOWN ✓' : 'Press G (or click the GEAR lever) to lower the gear',
      'A/D line up • W/S pitch • SPACE speedbrakes to steepen • 105–165 kt at the fence',
    ];
    announce('Final approach. Runway 27 ahead.');
  }

  // Event timers and consequences.
  if (ev) {
    ev.elapsed += dt;
    if (ev.elapsed > CRISIS.hullGraceSeconds) s.hull -= CRISIS.hullDrainPerSecond * dt;
    if (ev.type === 'engineFire') {
      if (fireOutTimer > 0) {
        fireOutTimer -= dt;
        if (fireOutTimer <= 0 && s.engLeft === 'fire') {
          s.engLeft = 'out';
          world.setEngineFire(false);
          world.setEngineSmoke(true);
          s.checklist = ['Fire is OUT. Now press ENG 1 RESTART below the handle'];
          ev.step = 1;
        }
      }
      if (restartTimer > 0) {
        restartTimer -= dt;
        if (restartTimer <= 0 && s.engLeft === 'restarting') {
          s.engLeft = 'ok';
          world.setEngineSmoke(false);
          fixEvent();
        }
      }
    }
    if (ev.type === 'hydraulic') {
      if (Math.abs(s.bankDeg) < 6) hydraulicHold += dt;
      s.checklist = [`Hold her level with A / D — steady for ${hydraulicHold.toFixed(1)} / 5 s`];
      if (hydraulicHold >= 5) fixEvent();
    }
    if (ev.type === 'pressure' && ev.step === 0) s.fuelPct = Math.max(0, s.fuelPct);
  }
  if (gearTimer > 0) {
    gearTimer -= dt;
    if (gearTimer <= 0) {
      s.gearDown = !s.gearDown;
      s.gearTransit = false;
    }
  }

  // Flight controls.
  const bankInput = (held(input, 'ArrowLeft', 'KeyA') ? -1 : 0) + (held(input, 'ArrowRight', 'KeyD') ? 1 : 0);
  const pitchHeld = (held(input, 'ArrowUp', 'KeyW') ? 1 : 0) + (held(input, 'ArrowDown', 'KeyS') ? -1 : 0);
  s.pitchInput = pitchHeld;
  if (held(input, 'KeyR')) s.throttle = Math.min(1, s.throttle + dt * 0.45);
  if (held(input, 'KeyF')) s.throttle = Math.max(0, s.throttle - dt * 0.45);
  let bankTarget = bankInput * 32;
  if (ev && ev.type === 'hydraulic') bankTarget += 34; // she wants to roll right
  s.bankDeg += (bankTarget - s.bankDeg) * Math.min(1, dt * 2.4);
  s.lateralM += s.bankDeg * 2.1 * dt * (s.phase === 'approach' ? 1.6 : 1);
  s.headingDeg = 270 + s.bankDeg * 0.25;
  s.pitchDeg = pitchHeld * 4 - 2;

  // Engines, speed, sink.
  const enginesAlive = (s.engLeft === 'ok' ? 1 : 0) + 1; // engine 2 never fails: mercy
  const thrust = enginesAlive / 2;
  const targetSpeed = (105 + s.throttle * 175 * (0.45 + 0.55 * thrust)) * (s.speedbrake ? 0.92 : 1);
  s.speedKt += (targetSpeed - s.speedKt) * Math.min(1, dt * 0.35);
  s.speedKt -= pitchHeld * 9 * dt;
  // The glide angle is the whole descent model: engines set the base,
  // drag (gear, speedbrakes) steepens it, and the yoke trades angle
  // against speed — pitch down to dive at the runway, pitch up to
  // stretch the glide and pay for it in knots.
  const baseGlideDeg = enginesAlive === 2 ? DESCENT.glideDegBothEngines : DESCENT.glideDegOneEngine;
  const glideDeg = baseGlideDeg
    + (s.gearDown ? DESCENT.dragDegGear : 0)
    + (s.speedbrake ? DESCENT.dragDegSpeedbrake : 0)
    - pitchHeld * DESCENT.pitchAuthorityDeg;
  let sink = s.speedKt * 0.5144 * Math.tan((Math.max(0.5, glideDeg) * Math.PI) / 180) * 196.85;
  if (s.speedKt < 105) sink += (105 - s.speedKt) * 26; // the stall bites
  s.sinkFtMin = sink;
  s.altFt -= (sink / 60) * dt;
  s.distanceM -= s.speedKt * 0.5144 * dt;
  s.fuelPct = Math.max(0, s.fuelPct - dt * 0.11);
  audio.setEngine(thrust * s.throttle + 0.15);

  // Endings.
  if (s.hull <= 0) {
    endGame(false, 'The airframe came apart at altitude — too many emergencies burned unfixed for too long.');
    return;
  }
  if (s.altFt <= 0) {
    if (s.distanceM > 250) {
      endGame(false, `She came down ${(s.distanceM / 1000).toFixed(1)} km short of Port Alba, in the dark water of the bay.`);
      return;
    }
    if (s.distanceM < -2900) {
      endGame(false, 'She floated past the far end of the runway and ran out of world.');
      return;
    }
    if (!s.gearDown) {
      endGame(false, 'Belly landing: the gear was still up. The runway wins that argument every time.');
      return;
    }
    if (s.speedKt > LANDING.maxTouchdownSpeedKt) {
      endGame(false, `Touchdown at ${Math.round(s.speedKt)} kt — far too fast. The tyres, then the gear, then everything else, let go.`);
      return;
    }
    if (s.speedKt < LANDING.minTouchdownSpeedKt) {
      endGame(false, `She stalled onto the runway at ${Math.round(s.speedKt)} kt and dropped the last feet like a stone.`);
      return;
    }
    if (Math.abs(s.bankDeg) > LANDING.maxBankDeg) {
      endGame(false, `A wingtip touched first at ${Math.abs(Math.round(s.bankDeg))}° of bank, and the runway cartwheeled her.`);
      return;
    }
    if (Math.abs(s.lateralM) > LANDING.maxLateralOffsetM * 6) {
      endGame(false, 'She touched down beside the runway, in the grass and the mud of Port Alba.');
      return;
    }
    endGame(true, `Wheels on runway ${FLIGHT.runway} at Port Alba, ${Math.abs(Math.round(s.lateralM))} metres off the centreline.`);
  }
}

// ---------- Per-frame: cameras, raycast prompts, clicks, keys ----------
const raycaster = new THREE.Raycaster();
const centerNdc = new THREE.Vector2(0, 0);
let hoverLabel = '';

function actionAt(ndc) {
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObjects(cockpit.interactables.map((i) => i.mesh), false);
  if (hits.length === 0) return null;
  const action = hits[0].object.userData.action;
  return cockpit.interactables.find((i) => i.action === action) || null;
}

const camPos = new THREE.Vector3();
const camTarget = new THREE.Vector3();
function updateCamera(dt) {
  const plane = world.planeGroup;
  plane.position.set(s.lateralM * 0.4, Math.max(0, s.altFt) * 0.3048, 0);
  plane.rotation.z = (-s.bankDeg * Math.PI) / 180;
  plane.rotation.x = (s.pitchDeg * Math.PI) / 180 * 0.6;
  world.update(dt, DESCENT.startDistanceM - s.distanceM);

  const shake = s.event && (s.event.type === 'engineFire' || s.event.type === 'hydraulic') ? 0.012 : 0;
  const shX = shake ? (Math.random() - 0.5) * shake : 0;
  const shY = shake ? (Math.random() - 0.5) * shake : 0;

  cockpit.group.visible = !tailCam;
  if (tailCam) {
    camPos.set(-13, 6.5, 34).applyMatrix4(plane.matrixWorld);
    camera.position.copy(camPos);
    camTarget.set(0, 0, -6).applyMatrix4(plane.matrixWorld);
    camera.lookAt(camTarget);
  } else {
    camPos.set(0.55 + shX, 0.92 + shY, -6.25).applyMatrix4(plane.matrixWorld);
    camera.position.copy(camPos);
    camera.quaternion.copy(plane.quaternion);
    const lookQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(
      THREE.MathUtils.degToRad(input.look.pitchDeg),
      THREE.MathUtils.degToRad(input.look.yawDeg),
      0,
      'YXZ',
    ));
    camera.quaternion.multiply(lookQ);
  }
  plane.updateMatrixWorld();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
  frame.last = now;

  // One-shot keys.
  if (input.keys.has('KeyG')) { input.keys.delete('KeyG'); if (s.phase !== 'title') toggleGear(); }
  if (input.keys.has('Space')) { input.keys.delete('Space'); if (s.phase !== 'title') doAction('speedbrake'); }
  if (input.keys.has('KeyC')) { input.keys.delete('KeyC'); tailCam = !tailCam; }
  if (input.keys.has('KeyM')) { input.keys.delete('KeyM'); muted = audio.toggleMute(); promptFlash(muted ? 'Sound off.' : 'Sound on.'); }

  if (s.phase !== 'title' && s.phase !== 'won' && s.phase !== 'crashed') {
    let acc = dt;
    while (acc > 0) {
      const h = Math.min(STEP, acc);
      step(h);
      acc -= h;
      if (s.phase === 'won' || s.phase === 'crashed') break;
    }
  }

  updateCamera(dt);
  cockpit.update(dt, s);

  // Hover prompt from the crosshair, and clicks from the pointer.
  if (!tailCam && s.phase !== 'title') {
    const hovered = actionAt(centerNdc);
    hoverLabel = hovered ? `[ CLICK ] ${hovered.label}` : '';
    if (performance.now() > promptFlashUntil) {
      promptLine.textContent = hoverLabel || (s.event ? s.checklist[0] || '' : s.phase === 'approach' ? s.checklist.join('  •  ') : '');
    }
    while (input.clicks.length > 0) {
      const click = input.clicks.shift();
      const ndc = new THREE.Vector2(
        (click.x / window.innerWidth) * 2 - 1,
        -(click.y / window.innerHeight) * 2 + 1,
      );
      const hit = actionAt(ndc) || hovered;
      if (hit) doAction(hit.action);
    }
  } else {
    promptLine.textContent = tailCam ? 'TAIL CAMERA — press C to return to the seat' : '';
    input.clicks.length = 0;
  }

  renderer.render(scene, camera);
}

// A small handle for automated playtests: start the flight, drive the
// controls, and run the simulation forward without waiting for frames.
window.__deadStick = {
  state: () => s,
  start: startGame,
  action: doAction,
  advance(seconds) {
    const steps = Math.round(seconds / STEP);
    for (let i = 0; i < steps; i++) {
      if (s.phase === 'won' || s.phase === 'crashed' || s.phase === 'title') break;
      step(STEP);
    }
  },
};

// ---------- Screenshot staging ----------
if (shot) {
  overlay.style.display = 'none';
  const ctx = {
    s, input, world,
    setTail(value) { tailCam = value; },
    startEvent,
    setChecklist(lines) { s.checklist = lines; },
  };
  stageShot(shot, ctx);
  // Settle the world before the frame: thirty small updates spread the
  // engine-fire particles along their trail instead of a single blob.
  for (let i = 0; i < 30; i++) updateCamera(0.05);
  updateCamera(0.016);
  cockpit.update(0.3, s);
  renderer.render(scene, camera);
  requestAnimationFrame(() => {
    updateCamera(0.016);
    cockpit.update(0.3, s);
    renderer.render(scene, camera);
    window.__shotReady = true;
  });
} else {
  requestAnimationFrame(frame);
}
