// Desktop input for DEAD STICK: keyboard flight controls, drag-to-look
// from the pilot seat, and clicks that land on cockpit controls.
// The bounty is judged on desktop Chrome with keyboard and mouse, so
// every action in the game is reachable with those two alone.

import { LOOK } from './config.js';

/**
 * Creates the input state the game loop reads each frame:
 * - keys: a Set of KeyboardEvent codes currently held down
 * - look: { yawDeg, pitchDeg } where the pilot's head is turned
 * - clicks: queued pointer positions {x, y} in client pixels; a press
 *   that barely moved was aimed at a control, not a look-drag
 */
export function createInput(canvas) {
  const keys = new Set();
  const pressed = [];
  const look = { yawDeg: 0, pitchDeg: 0 };
  const clicks = [];
  let dragging = false;
  let dragMoved = 0;
  let lastX = 0;
  let lastY = 0;
  let lookAtPress = null;

  window.addEventListener('keydown', (event) => {
    keys.add(event.code);
    // One-shot actions queue here too: a tap shorter than one frame
    // (a slow machine, a heavy scene) must not be lost between the
    // keydown and the keyup.
    if (!event.repeat) pressed.push(event.code);
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    dragMoved = 0;
    lastX = event.clientX;
    lastY = event.clientY;
    lookAtPress = { yawDeg: look.yawDeg, pitchDeg: look.pitchDeg };
    canvas.setPointerCapture(event.pointerId);
  });

  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const dx = event.clientX - lastX;
    const dy = event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
    dragMoved += Math.abs(dx) + Math.abs(dy);
    look.yawDeg -= dx * LOOK.degPerPixel;
    look.pitchDeg -= dy * LOOK.degPerPixel;
    look.yawDeg = Math.max(LOOK.yawMinDeg, Math.min(LOOK.yawMaxDeg, look.yawDeg));
    look.pitchDeg = Math.max(LOOK.pitchMinDeg, Math.min(LOOK.pitchMaxDeg, look.pitchDeg));
  });

  canvas.addEventListener('pointerup', (event) => {
    dragging = false;
    if (dragMoved < 6) {
      // A click is not a look: give the camera back to where the
      // press began, so working a lever never walks the view away.
      if (lookAtPress) {
        look.yawDeg = lookAtPress.yawDeg;
        look.pitchDeg = lookAtPress.pitchDeg;
      }
      clicks.push({ x: event.clientX, y: event.clientY });
    }
    lookAtPress = null;
  });

  return { keys, pressed, look, clicks };
}

/** True while any of the given key codes is held. */
export function held(input, ...codes) {
  return codes.some((code) => input.keys.has(code));
}
