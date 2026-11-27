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
hint.textContent = 'Drag to look • Click a control to use it • A/D bank • W/S pitch • R/F throttle • SPACE speedbrakes • G gear • C tail cam • −/= sim speed • P pause • M mute';

// ---------- Flight progress + sim gears (bottom-left card) ----------
const SIM_GEARS = [1, 2, 4];
const progressCard = makeDiv({
  position: 'fixed', left: '16px', bottom: '16px', width: '308px', zIndex: 5,
  background: 'rgba(6,10,16,0.68)', border: '1px solid rgba(255,255,255,0.16)',
  borderRadius: '10px', padding: '10px 12px', color: '#dfe6ee', fontFamily: FONT,
  display: 'none', textAlign: 'left',
});
const progHead = makeDiv({ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, letterSpacing: '1px' }, progressCard);
const progTitle = document.createElement('span');
progTitle.textContent = '✈ PROGRESS — RWY 27';
const progDist = document.createElement('span');
progHead.append(progTitle, progDist);
const progTrack = makeDiv({
  position: 'relative', height: '8px', background: '#26303c', borderRadius: '4px', margin: '9px 0 4px',
}, progressCard);
const progFill = makeDiv({
  position: 'absolute', left: '0', top: '0', bottom: '0', width: '0%',
  background: '#2ea8ba', borderRadius: '4px',
}, progTrack);
const progPlane = makeDiv({
  position: 'absolute', top: '-9px', left: '0%', fontSize: '15px', transform: 'translateX(-50%)',
}, progTrack);
progPlane.textContent = '✈';
const progProfile = makeDiv({ fontSize: '13px', fontWeight: 700, marginTop: '5px' }, progressCard);
const progEta = makeDiv({ fontSize: '12px', color: '#9fb2c3', marginTop: '2px' }, progressCard);
const progGearRow = makeDiv({
  display: 'flex', alignItems: 'center', gap: '8px', marginTop: '9px', fontSize: '12px', fontWeight: 800, letterSpacing: '1px',
}, progressCard);
const progGearLabel = document.createElement('span');
progGearLabel.textContent = 'SIM GEAR';
const progRate = document.createElement('span');
progRate.style.minWidth = '34px';
progRate.style.textAlign = 'center';
progRate.style.fontSize = '14px';
function gearButton(label, dir) {
  const button = document.createElement('button');
  button.textContent = label;
  Object.assign(button.style, {
    fontSize: '15px', fontWeight: 800, padding: '2px 12px', borderRadius: '6px',
    border: '1px solid rgba(255,255,255,0.25)', background: '#1b2634', color: '#dfe6ee', cursor: 'pointer',
  });
  button.addEventListener('click', () => {
    audio.init();
    cycleSimRate(dir);
  });
  return button;
}
progGearRow.append(progGearLabel, gearButton('−', -1), progRate, gearButton('+', 1));
const progWarn = document.createElement('span');
progWarn.style.color = '#e8b13a';
progGearRow.appendChild(progWarn);

function cycleSimRate(dir) {
  const idx = SIM_GEARS.indexOf(s.simRate || 1);
  const next = SIM_GEARS[Math.max(0, Math.min(SIM_GEARS.length - 1, idx + dir))];
  if (next !== s.simRate) {
    s.simRate = next;
    audio.click();
    promptFlash(next >= 4
      ? 'SIM ×4 — time flies. So does the weather, if you linger…'
      : `SIM ×${next}`);
  }
}

let progUiTimer = 0;
function updateProgressUI(dt) {
  const flying = ['calm', 'crisis', 'approach'].includes(s.phase);
  progressCard.style.display = flying ? 'block' : 'none';
  if (!flying) return;
  progUiTimer += dt;
  if (progUiTimer < 0.12) return;
  progUiTimer = 0;
  const total = DESCENT.startDistanceM;
  const frac = Math.max(0, Math.min(1, 1 - s.distanceM / total));
  progFill.style.width = `${(frac * 100).toFixed(1)}%`;
  progPlane.style.left = `${(frac * 100).toFixed(1)}%`;
  progDist.textContent = s.distanceM > 0 ? `${(s.distanceM / 1000).toFixed(1)} km` : 'THRESHOLD';
  const ideal = DESCENT.startAltitudeFt * Math.max(0, s.distanceM / total);
  const diff = Math.round(s.altFt - ideal);
  if (Math.abs(diff) <= 300) {
    progProfile.textContent = '● ON PROFILE';
    progProfile.style.color = '#7fe7a0';
  } else if (diff > 0) {
    progProfile.textContent = `▲ ABOVE PROFILE +${diff} ft — she will float long`;
    progProfile.style.color = '#e8b13a';
  } else {
    progProfile.textContent = `▼ BELOW PROFILE ${diff} ft — the bay is down there`;
    progProfile.style.color = '#ff8a75';
  }
  const gs = Math.max(20, s.speedKt * 0.5144);
  const eta = s.distanceM > 0 ? Math.max(0, Math.round(s.distanceM / gs)) : 0;
  progEta.textContent = `ALT ${Math.round(s.altFt)} ft • SPD ${Math.round(s.speedKt)} kt • ETA ${Math.floor(eta / 60)}:${String(eta % 60).padStart(2, '0')}`;
  progRate.textContent = `×${s.simRate || 1}`;
  progWarn.textContent = (s.simRate || 1) >= 4 && !s.event ? '⚠ rough air ahead…' : '';
}
const overlay = makeDiv({
  position: 'fixed', inset: '0', display: 'flex', flexDirection: 'column',
  alignItems: 'center', justifyContent: 'flex-start', background: 'rgba(4,8,14,0.72)',
  color: '#eef1f5', fontFamily: FONT, zIndex: 10, textAlign: 'center', padding: '5vh 24px 40px',
  overflowY: 'auto', boxSizing: 'border-box',
});
const overlayTitle = makeDiv({ fontSize: '54px', fontWeight: 900, letterSpacing: '3px' }, overlay);
const overlayBody = makeDiv({ fontSize: '19px', lineHeight: 1.55, maxWidth: '640px', marginTop: '14px', whiteSpace: 'pre-line' }, overlay);
const overlayButtons = makeDiv({
  display: 'flex', gap: '12px', marginTop: '26px', flexWrap: 'wrap', justifyContent: 'center',
}, overlay);

function makeButton({ label, fn, disabled = false }) {
  const button = document.createElement('button');
  button.textContent = label;
  Object.assign(button.style, {
    fontSize: '19px', fontWeight: 700, padding: '12px 28px', borderRadius: '10px',
    border: '0', background: disabled ? '#3a4149' : '#0e7d8a',
    color: disabled ? '#8b93a3' : '#fff', cursor: disabled ? 'default' : 'pointer',
  });
  if (!disabled) {
    button.addEventListener('click', () => {
      audio.init();
      audio.click();
      fn();
    });
  }
  return button;
}

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
    pitchSmooth: 0,
    glideSmooth: DESCENT.glideDegBothEngines,
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
    captainSlump: 1,
    simRate: 1,
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
let fastTimer = 0;
let turbulenceCooldown = 0;
let turbulenceCalm = 0;
let calmAnnounced = false;
let tailCam = false;
let muted = false;
let paused = false;
let saveTimer = 0;

function announce(text) {
  statusLine.textContent = text;
}

function setBanner(text, seconds = 0) {
  banner.textContent = text;
  if (seconds > 0) setTimeout(() => { if (banner.textContent === text) banner.textContent = ''; }, seconds * 1000);
}

// ---------- The cutscene: the captain goes down ----------
const subtitle = makeDiv({
  position: 'fixed', left: '50%', bottom: '13%', transform: 'translateX(-50%)',
  color: '#fff', fontFamily: FONT, fontSize: '21px', fontWeight: 600, lineHeight: 1.45,
  textShadow: '0 2px 8px #000', pointerEvents: 'none', zIndex: 6,
  textAlign: 'center', maxWidth: '760px', display: 'none', whiteSpace: 'pre-line',
});
const cutsceneBar = makeDiv({
  position: 'fixed', right: '18px', bottom: '18px', display: 'none', gap: '10px', zIndex: 7,
});
function cutsceneButton(label, fn) {
  const button = document.createElement('button');
  button.textContent = label;
  Object.assign(button.style, {
    fontSize: '16px', fontWeight: 700, padding: '10px 22px', borderRadius: '9px',
    border: '0', background: '#0e7d8a', color: '#fff', cursor: 'pointer',
  });
  button.addEventListener('click', () => {
    audio.init();
    fn();
  });
  cutsceneBar.appendChild(button);
  return button;
}
const skipButton = cutsceneButton('SKIP ▸', () => {
  if (cutscene) {
    cutscene.t = Math.max(cutscene.t, 12);
    s.captainSlump = 1;
  }
});
const takeControlButton = cutsceneButton('TAKE CONTROL', () => {
  cutscene = null;
  cutsceneBar.style.display = 'none';
  subtitle.style.display = 'none';
  startGame();
});
takeControlButton.style.background = '#c0271b';
let cutscene = null;
let cutsceneWarned = false;

function startCutscene() {
  audio.init();
  s = freshState();
  s.phase = 'cutscene';
  s.captainSlump = 0;
  input.look.yawDeg = 0;
  input.look.pitchDeg = 0;
  cutscene = { t: 0 };
  cutsceneWarned = false;
  hideOverlay();
  subtitle.style.display = 'block';
  cutsceneBar.style.display = 'flex';
  takeControlButton.style.display = 'none';
  skipButton.style.display = 'block';
  announce('The captain is flying. Port Alba Approach is on the radio.');
}

const CUTSCENE_LINES = [
  { until: 3.5, text: '📻 "Port Alba Approach, Meridian 207 descending through one-zero thousand.\nRunway 27 in use, wind calm. You are cleared for the approach."', yaw: -12, pitch: 2 },
  { until: 6.5, text: 'The captain presses one hand flat against his chest.\n"I… I don\'t feel—"', yaw: -40, pitch: -8 },
  { until: 10, text: 'He folds forward over the yoke.\nThe autopilot lets go with a soft, terrible chime.', yaw: -40, pitch: -10 },
  { until: 12.5, text: 'There is nobody else.\nYou are in the right seat. Fly.', yaw: 0, pitch: 0 },
];

function runCutscene(dt) {
  cutscene.t += dt;
  const t = cutscene.t;
  const line = CUTSCENE_LINES.find((l) => t < l.until) || CUTSCENE_LINES[CUTSCENE_LINES.length - 1];
  subtitle.textContent = t >= 12.5
    ? 'Drag to look around the cockpit. Click a control to use it.\nShe is descending, and she is yours.'
    : line.text;
  const ease = Math.min(1, dt * 2.2);
  input.look.yawDeg += (line.yaw - input.look.yawDeg) * ease;
  input.look.pitchDeg += (line.pitch - input.look.pitchDeg) * ease;
  // The slump itself, between seconds 6.5 and 9.5.
  const slumpT = Math.max(0, Math.min(1, (t - 6.5) / 3));
  s.captainSlump = slumpT * slumpT * (3 - 2 * slumpT);
  if (t >= 6.5 && !cutsceneWarned) {
    cutsceneWarned = true;
    audio.masterWarning();
  }
  if (t >= 12.5) {
    takeControlButton.style.display = 'block';
    skipButton.style.display = 'none';
  }
}

function startGame() {
  audio.init();
  clearSave();
  s = freshState();
  s.phase = 'crisis';
  s.captainSlump = 1;
  eventQueue = ['engineFire', ...shuffled(random, ['electrical', 'hydraulic', 'pressure'])];
  gapTimer = 6;
  calmAnnounced = true;
  hideOverlay();
  subtitle.style.display = 'none';
  cutsceneBar.style.display = 'none';
  setBanner('THE CAPTAIN IS DOWN.\nShe is yours — watch the screens.', 4);
  s.checklist = ['The captain is down. First failure is coming — watch the EICAS.'];
  announce('Flight started. The captain is down; the first failure is coming.');
  // First-flight tutorial hints, once ever.
  try {
    if (!localStorage.getItem(HINTS_KEY)) {
      localStorage.setItem(HINTS_KEY, '1');
      hintQueue = [
        { at: 2, text: 'Drag the mouse to look around — your controls are all in this cockpit' },
        { at: 10, text: 'The right screen (EICAS) names every failure and its fix' },
        { at: 20, text: 'Press C for the tail camera • SPACE is your speedbrake • G is the gear' },
      ];
    }
  } catch { /* ignore */ }
}
let hintQueue = [];

function showOverlay(title, body, buttons) {
  overlayTitle.textContent = title;
  overlayBody.textContent = body;
  overlayButtons.replaceChildren(...buttons.map(makeButton));
  overlay.style.display = 'flex';
  crosshair.style.display = 'none';
}

function hideOverlay() {
  overlay.style.display = 'none';
  crosshair.style.display = 'block';
}

// ---------- Saving: a flight in progress can be continued ----------
const SAVE_KEY = 'dead-stick.save.v1';
const HINTS_KEY = 'dead-stick.hints-seen';

function hasSave() {
  try {
    return !!localStorage.getItem(SAVE_KEY);
  } catch {
    return false;
  }
}

function saveGame() {
  if (!['crisis', 'approach'].includes(s.phase)) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      phase: s.phase, time: s.time, altFt: s.altFt, speedKt: s.speedKt,
      distanceM: s.distanceM, lateralM: s.lateralM, hull: s.hull,
      fuelPct: s.fuelPct, throttle: s.throttle, gearDown: s.gearDown,
      speedbrake: s.speedbrake, simRate: s.simRate || 1, engLeft: s.engLeft === 'fire' ? 'out' : s.engLeft,
      power: s.power, breakers: s.breakers, oxygenDeployed: s.oxygenDeployed,
      crossfeedOpen: s.crossfeedOpen, maydaySent: s.maydaySent, queue: eventQueue,
    }));
  } catch { /* private mode: no save, no problem */ }
}

function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}

function continueGame() {
  let save = null;
  try {
    save = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
  } catch { /* ignore */ }
  if (!save) return;
  s = freshState();
  Object.assign(s, {
    phase: save.phase, time: save.time || 0, altFt: save.altFt, speedKt: save.speedKt,
    distanceM: save.distanceM, lateralM: save.lateralM || 0, hull: save.hull,
    fuelPct: save.fuelPct, throttle: save.throttle, gearDown: !!save.gearDown,
    speedbrake: !!save.speedbrake, simRate: save.simRate || 1, engLeft: save.engLeft || 'ok', power: save.power || 'normal',
    breakers: save.breakers || [true, true, true, true],
    oxygenDeployed: !!save.oxygenDeployed, crossfeedOpen: !!save.crossfeedOpen,
    maydaySent: !!save.maydaySent, captainSlump: 1,
  });
  eventQueue = Array.isArray(save.queue) ? save.queue : [];
  gapTimer = 8;
  s.checklist = s.phase === 'approach'
    ? ['Welcome back. Runway ahead — gear, speed, centreline.']
    : ['Welcome back. The captain is still down; watch the screens.'];
  hideOverlay();
  setBanner('FLIGHT RESUMED', 2);
  announce('Flight resumed.');
}

// ---------- The menu, the tutorial, and the way out ----------
function showMenu() {
  s.phase = 'title';
  showOverlay(
    'DEAD STICK',
    `${FLIGHT.airline} flight 207, a ${FLIGHT.aircraft} on descent into ${FLIGHT.destination}.\n` +
      'The captain will pass out in the left seat — and you are in the right one.\n' +
      'Fix what breaks from the seat. Then land her yourself.',
    [
      { label: '▶ NEW GAME', fn: () => startCutscene() },
      { label: '⏵ CONTINUE', fn: () => continueGame(), disabled: !hasSave() },
      { label: 'HOW TO PLAY', fn: () => showHowTo() },
      { label: 'EXIT', fn: () => showExit() },
    ],
  );
}

function showHowTo() {
  showOverlay(
    'HOW TO PLAY',
    'THE SITUATION\n' +
      'You are a passenger in the right seat. The captain is unconscious; the plane is descending into Port Alba and systems will fail one at a time. Each failure is fixed from the seat, on the real cockpit controls — the EICAS screen (right) always tells you what broke and what to click.\n\n' +
      'CONTROLS\n' +
      'Drag the mouse to look around • Click a control to use it • A/D bank • W/S pitch (trade speed for glide) • R/F throttle • SPACE speedbrakes • G gear • C tail camera • P pause • M mute\n' +
      'The card at bottom-left tracks your progress to the runway: distance, whether you are above or below the descent profile, and your ETA. Time runs at ×1, ×2 or ×4: use the − / = keys, the card buttons, or click the two black SIM GEAR levers beside the throttles — but linger at ×4 and the air itself turns rough.\n\n' +
      'THE EMERGENCIES\n' +
      '🔥 Engine fire — pull the red FIRE handle left of the screens, then press RESTART\n' +
      '⚡ Electrical — look UP, click the tripped (yellow) breakers back in\n' +
      '🌀 Hydraulics — hold A/D against the roll, keep her level for 5 seconds\n' +
      '😮‍💨 Cabin pressure — click OXY MASK, then X-FEED\n' +
      '🌪️ Turbulence — your own fault for living at SIM ×4: drop back to ×1 and ride it out\n' +
      'Leave one burning and the HULL bar drains. At zero, she comes apart.\n\n' +
      'THE LANDING\n' +
      'Gear DOWN (3 green lights), line up on runway 27 with A/D, use speedbrakes and pitch to fly the descent, and cross the fence at 105–165 kt with wings level. The clipboard on your yoke has it all in short form.',
    [{ label: '← BACK TO MENU', fn: () => showMenu() }],
  );
}

function showExit() {
  showOverlay(
    'EXIT',
    'Thanks for flying Meridian Air.\nThe tab is yours to close whenever you are ready — Port Alba will keep the runway lights on.',
    [{ label: '← BACK TO MENU', fn: () => showMenu() }],
  );
}

// ---------- Emergencies ----------
const EVENT_TITLES = {
  engineFire: '🔥 ENGINE 1 FIRE',
  electrical: '⚡ ELECTRICAL FAILURE',
  hydraulic: '🌀 HYDRAULIC LOSS — SHE IS ROLLING',
  pressure: '😮‍💨 CABIN PRESSURE FALLING',
  turbulence: '🌪️ TURBULENCE — ROUGH AIR',
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
  } else if (type === 'turbulence') {
    turbulenceCalm = 0;
    s.checklist = ['TURBULENCE — the air is throwing her around', 'Drop to SIM ×1 (key − or the GEAR buttons) and ride it out'];
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
  if (type === 'turbulence') s.checklist = ['Air is smooth again. Lesson learned about the fast gear.'];
}

function endGame(wonGame, reason) {
  s.phase = wonGame ? 'won' : 'crashed';
  s.endReason = reason;
  // A won flight is finished; a crashed one keeps its autosave, so
  // Continue becomes the rewind it was always meant to be.
  if (wonGame) clearSave();
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
      [
        { label: '↻ FLY HER AGAIN', fn: () => startCutscene() },
        { label: 'BACK TO MENU', fn: () => showMenu() },
        { label: 'EXIT', fn: () => showExit() },
      ],
    );
  } else {
    audio.crash();
    showOverlay('💥 DEAD STICK', `${reason}\n\nThe investigation will note that a passenger held a burning twinjet together for ${Math.floor(s.time)} seconds — and very nearly landed her.`, [
      { label: '↻ TRY AGAIN', fn: () => startCutscene() },
      { label: 'BACK TO MENU', fn: () => showMenu() },
      { label: 'EXIT GAME', fn: () => showExit() },
    ]);
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
    s.breakers[i] = !s.breakers[i];
    if (ev && ev.type === 'electrical') {
      if (s.breakers.every(Boolean)) {
        s.power = 'normal';
        fixEvent();
      }
    } else if (s.breakers.every(Boolean)) {
      if (s.power !== 'normal') {
        s.power = 'normal';
        promptFlash('All breakers in — full power is back.');
      }
    } else {
      if (s.power === 'normal') {
        s.power = 'emergency';
        promptFlash('Breaker OUT — the screens drop to emergency power. Push it back in to restore.');
      }
    }
  } else if (action === 'oxygen') {
    if (ev && ev.type === 'pressure' && ev.step === 0) {
      s.oxygenDeployed = true;
      ev.step = 1;
      s.checklist = ['Masks on. Now open the X-FEED valve beside it'];
    } else if (!s.oxygenDeployed) {
      s.oxygenDeployed = true;
      promptFlash('Masks dropped. (No emergency — the cabin crew will sigh.) Click again to stow them.');
    } else if (ev && ev.type === 'pressure') {
      promptFlash('Keep them on — the cabin still needs them!');
    } else {
      s.oxygenDeployed = false;
      promptFlash('Masks stowed.');
    }
  } else if (action === 'crossfeed') {
    if (ev && ev.type === 'pressure' && ev.step === 1) {
      s.crossfeedOpen = true;
      s.cabinOk = true;
      fixEvent();
    } else if (!s.crossfeedOpen) {
      s.crossfeedOpen = true;
      promptFlash('Crossfeed open. Click again to close it.');
    } else {
      s.crossfeedOpen = false;
      promptFlash('Crossfeed closed.');
    }
  } else if (action === 'gear') {
    toggleGear();
  } else if (action === 'simDown') {
    cycleSimRate(-1);
  } else if (action === 'simUp') {
    cycleSimRate(1);
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
    if (ev.type === 'turbulence') {
      if (s.simRate <= 1) {
        turbulenceCalm += dt;
        s.checklist = [`Riding it out at SIM ×1 — ${turbulenceCalm.toFixed(1)} / 3 s`];
        if (turbulenceCalm >= 3) fixEvent();
      } else {
        turbulenceCalm = 0;
        s.checklist = ['TURBULENCE — the air is throwing her around', 'Drop to SIM ×1 (key − or the GEAR buttons) and ride it out'];
      }
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
  // Pitch is flown through a smoothing lag, the way a real airframe
  // answers the yoke: the nose, the glide angle and the speed all ease
  // toward the commanded value instead of snapping in one step, which
  // is what made the up-and-down motion feel notchy.
  s.pitchSmooth += (pitchHeld - s.pitchSmooth) * Math.min(1, dt * 4.6);
  if (Math.abs(s.pitchSmooth) < 0.001 && pitchHeld === 0) s.pitchSmooth = 0;
  s.pitchInput = s.pitchSmooth;
  if (held(input, 'KeyR')) s.throttle = Math.min(1, s.throttle + dt * 0.45);
  if (held(input, 'KeyF')) s.throttle = Math.max(0, s.throttle - dt * 0.45);
  // Linger at the top sim gear and the air itself turns on you.
  turbulenceCooldown = Math.max(0, turbulenceCooldown - dt);
  if (s.simRate >= 4 && (s.phase === 'crisis' || s.phase === 'approach')) {
    // Clear-board time at the fast gear accumulates toward rough air;
    // an active emergency freezes the count, it does not forgive it.
    if (!ev) {
      fastTimer += dt;
      if (fastTimer > 10 && turbulenceCooldown <= 0) {
        fastTimer = 0;
        turbulenceCooldown = 50;
        startEvent('turbulence');
      }
    }
  } else {
    fastTimer = Math.max(0, fastTimer - dt * 2);
  }

  let bankTarget = bankInput * 32;
  if (ev && ev.type === 'hydraulic') bankTarget += 34; // she wants to roll right
  if (ev && ev.type === 'turbulence') bankTarget += Math.sin(s.time * 6.1) * 13 + Math.sin(s.time * 15.7) * 6; // rough air shoves her around
  s.bankDeg += (bankTarget - s.bankDeg) * Math.min(1, dt * 2.4);
  s.lateralM += s.bankDeg * 2.1 * dt * (s.phase === 'approach' ? 1.6 : 1);
  s.headingDeg = 270 + s.bankDeg * 0.25;
  s.pitchDeg = s.pitchSmooth * 4 - 2;

  // Engines, speed, sink.
  const enginesAlive = (s.engLeft === 'ok' ? 1 : 0) + 1; // engine 2 never fails: mercy
  const thrust = enginesAlive / 2;
  const targetSpeed = (105 + s.throttle * 175 * (0.45 + 0.55 * thrust)) * (s.speedbrake ? 0.92 : 1);
  s.speedKt += (targetSpeed - s.speedKt) * Math.min(1, dt * 0.5);
  // Pitch is an energy trade: nose up bleeds speed hard, nose down
  // buys it back. That is what makes the yoke feel alive.
  s.speedKt -= s.pitchSmooth * (s.pitchSmooth > 0 ? 13 : 11) * dt;
  // The glide angle is the whole descent model: engines set the base,
  // drag (gear, speedbrakes) steepens it, and the yoke trades angle
  // against speed — pitch down to dive at the runway, pitch up to
  // stretch the glide and pay for it in knots.
  const baseGlideDeg = enginesAlive === 2 ? DESCENT.glideDegBothEngines : DESCENT.glideDegOneEngine;
  // Near the stall the nose stops answering: authority fades out.
  const pitchEff = Math.max(0.35, Math.min(1, (s.speedKt - 85) / 35));
  const glideTarget = baseGlideDeg
    + (s.gearDown ? DESCENT.dragDegGear : 0)
    + (s.speedbrake ? DESCENT.dragDegSpeedbrake : 0)
    - s.pitchSmooth * DESCENT.pitchAuthorityDeg * pitchEff;
  // The glide itself eases too: gear and speedbrakes bite over a
  // second or so, they do not teleport the descent rate.
  s.glideSmooth += (glideTarget - s.glideSmooth) * Math.min(1, dt * 2.4);
  // The glide may go negative: with both engines turning and the nose
  // up, she can genuinely climb — the speed bleed above is the price.
  let sink = s.speedKt * 0.5144 * Math.tan((Math.max(-2.2, s.glideSmooth) * Math.PI) / 180) * 196.85;
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
  // Refresh the plane's matrix BEFORE placing the camera from it.
  // Reading a stale matrixWorld here trailed the camera one frame
  // behind the aircraft: invisible at SIM ×1, but at ×2/×4 the trail
  // grew to a metre of vertical drift — the camera floated up out of
  // its seat and clipped the cockpit during turbulence shake.
  plane.updateMatrixWorld(true);
  world.update(dt, DESCENT.startDistanceM - s.distanceM);
  world.setGear(s.gearDown);

  const shake = s.event && s.event.type === 'turbulence' ? 0.05
    : s.event && (s.event.type === 'engineFire' || s.event.type === 'hydraulic') ? 0.012 : 0;
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

  // One-shot keys, drained from the press queue so a tap shorter
  // than a frame is never dropped.
  const pressedCodes = input.pressed.slice();
  input.pressed.length = 0;
  const taps = new Set(pressedCodes);
  if (taps.has('KeyG')) { if (s.phase !== 'title') toggleGear(); }
  if (taps.has('Space')) { if (s.phase !== 'title') doAction('speedbrake'); }
  if (taps.has('KeyC')) { tailCam = !tailCam; }
  // Gears count every tap, even two inside one frame.
  for (const code of pressedCodes) {
    if (code === 'Minus') cycleSimRate(-1);
    if (code === 'Equal') cycleSimRate(1);
  }
  if (taps.has('KeyM')) { muted = audio.toggleMute(); promptFlash(muted ? 'Sound off.' : 'Sound on.'); }
  if ((taps.has('KeyP') || taps.has('Escape')) && ['calm', 'crisis', 'approach'].includes(s.phase)) {
    paused = !paused;
    if (paused) {
      showOverlay('PAUSED', 'She holds her descent where you left her.', [
        { label: '⏵ RESUME', fn: () => { paused = false; hideOverlay(); } },
        { label: '↻ RESTART', fn: () => { paused = false; startCutscene(); } },
        { label: 'BACK TO MENU', fn: () => { paused = false; showMenu(); } },
      ]);
    } else {
      hideOverlay();
    }
  }

  // Background music follows the story.
  audio.setMusic(
    s.phase === 'title' || s.phase === 'cutscene' || s.phase === 'won' ? 'menu'
      : s.phase === 'crashed' ? 'off'
        : paused ? 'calm'
          : s.event ? 'crisis'
            : s.phase === 'approach' ? 'approach' : 'calm',
  );

  if (cutscene) runCutscene(dt);

  if (!cutscene && !paused && ['calm', 'crisis', 'approach'].includes(s.phase)) {
    let acc = Math.min(0.3, dt * (s.simRate || 1));
    while (acc > 0) {
      const h = Math.min(STEP, acc);
      step(h);
      acc -= h;
      if (s.phase === 'won' || s.phase === 'crashed') break;
    }
    while (hintQueue.length > 0 && s.time >= hintQueue[0].at) {
      promptFlash(hintQueue.shift().text);
    }
    saveTimer += dt;
    if (saveTimer > 5) {
      saveTimer = 0;
      saveGame();
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
      if (hit) {
        // The click found its control: the press was work, not a
        // look, so hand the camera back to where the press began.
        if (typeof click.lookYaw === 'number') {
          input.look.yawDeg = click.lookYaw;
          input.look.pitchDeg = click.lookPitch;
        }
        doAction(hit.action);
      }
    }
  } else {
    promptLine.textContent = tailCam ? 'TAIL CAMERA — press C to return to the seat' : '';
    input.clicks.length = 0;
  }

  updateProgressUI(dt);
  renderer.render(scene, camera);
}

// A small handle for automated playtests: start the flight, drive the
// controls, and run the simulation forward without waiting for frames.
window.__deadStick = {
  state: () => s,
  start: startGame,
  action: doAction,
  camera: () => camera,
  plane: () => world.planeGroup,
  look: () => input.look,
  startEvent,
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
  showMenu();
  requestAnimationFrame(frame);
}
