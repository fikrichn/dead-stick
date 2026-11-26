// DEAD STICK — every tuning number, name and colour in one place.
// A cockpit survival flight game: Meridian Air flight MA-207, a Kestrel K-200
// twinjet on final descent into Port Alba, and the captain has just passed
// out in the left seat. You are in the right seat. You cannot get up.
// Fix what breaks, then land her yourself — a dead-stick landing if the
// engines do not come back.
//
// The simulation runs on a fixed step so no rule below depends on the
// display's frame rate, and the whole world is procedural: no external
// asset is ever loaded, so the game plays fully offline.

/** The simulation's fixed step, in seconds: 60 updates a second. */
export const STEP = 1 / 60;

/** Flight identity, shown on the cockpit placard and the start screen. */
export const FLIGHT = {
  airline: 'Meridian Air',
  callsign: 'MERIDIAN 207',
  aircraft: 'Kestrel K-200',
  destination: 'Port Alba',
  runway: '27',
};

/**
 * The descent the whole game is timed against. The session starts at
 * 12,000 ft already descending (a believable place for an emergency:
 * low enough to reach the field in minutes, high enough to fear it),
 * and the runway threshold is DISTANCE_M metres ahead on the nose.
 */
export const DESCENT = {
  startAltitudeFt: 9800,
  startSpeedKt: 250,
  startDistanceM: 30000,
  /**
   * The descent is flown as a glide angle, so the sink rate scales with
   * speed the way a real airframe's does: at 250 kt a 3.4° powered
   * descent is about 1,500 ft/min, and losing an engine steepens the
   * angle to 5.6° — a 10-to-1 glide that can still reach the field
   * from anywhere on the route, but only just. That "only just" is
   * the game: altitude spent stalling or wallowing is gone for good.
   */
  glideDegBothEngines: 3.4,
  glideDegOneEngine: 5.6,
  /** Extra glide angle from drag: gear down, and the speedbrakes. */
  dragDegGear: 1.2,
  dragDegSpeedbrake: 4.0,
  /** How much glide angle the yoke's pitch buys or sells, nose-down positive. */
  pitchAuthorityDeg: 6.5,
};

/** The landing envelope: touch down inside all three, or it is a crash. */
export const LANDING = {
  maxTouchdownSpeedKt: 165,
  minTouchdownSpeedKt: 105,
  maxBankDeg: 10,
  maxLateralOffsetM: 24,
  gearMustBeDown: true,
};

/** Emergency events: one every EVENT_GAP seconds of crisis phase. */
export const CRISIS = {
  /** Seconds of calm cruise before the captain goes down. */
  calmSeconds: 14,
  /** Seconds between one event clearing and the next one firing. */
  gapMinSeconds: 10,
  gapMaxSeconds: 16,
  /** Seconds the player gets to fix an event before it starts costing hull. */
  fixWindowSeconds: 30,
  /** Hull lost per second while an unfixed event burns on, after a grace
   *  period that covers the mandatory waits (extinguisher discharge,
   *  engine spool-up) a correct fix already has to sit through. */
  hullDrainPerSecond: 1.2,
  hullGraceSeconds: 12,
  startHull: 100,
};

/** Camera: drag to look around the cockpit from the pilot seat. */
export const LOOK = {
  yawMinDeg: -118,
  yawMaxDeg: 118,
  pitchMinDeg: -62,
  pitchMaxDeg: 34,
  /** Drag sensitivity, degrees of look per pixel dragged. */
  degPerPixel: 0.16,
  /** Press C for the tail camera: the one outside view, for screenshots. */
  tailCameraKey: 'KeyC',
};

export const PALETTE = {
  panel: '#232830',
  panelEdge: '#12151a',
  screenGlow: '#7fe7c4',
  amber: '#ffb43a',
  warningRed: '#ff3b30',
  goodGreen: '#35e08a',
  skyDay: '#8fc7e8',
  skyStorm: '#3d4a5c',
  sea: '#1d5f7a',
  land: '#4d7c4f',
  sand: '#d9c58f',
  runway: '#33373d',
  runwayLight: '#ffd76a',
};

/** Where the best landing score is kept between visits (this browser only). */
export const BEST_KEY = 'dead-stick.best';
