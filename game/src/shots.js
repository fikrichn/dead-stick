// The screenshot scenes behind ?shot=start|fire|approach|tail.
// Each one stages the real game state — same cockpit, same screens,
// same world — at the moment that tells that part of the story:
// the quiet before, the fire, the final approach, and the one outside
// view of the aircraft over the coast of Port Alba.

export function stageShot(name, ctx) {
  const { s, input, world } = ctx;

  if (name === 'start') {
    // The calm: full tanks of altitude, both engines turning, the
    // volcano and the island ahead, the captain already slumped.
    s.phase = 'calm';
    s.altFt = 9200;
    s.speedKt = 246;
    s.distanceM = 26500;
    s.checklist = ['Cruise is quiet. The captain is flying.'];
    input.look.yawDeg = 18;
    input.look.pitchDeg = -8;
    return;
  }

  if (name === 'fire') {
    // Ninety seconds later: engine 1 is burning, the master warning is
    // lit, and the pilot's eyes are on the red handle that fixes it.
    s.phase = 'crisis';
    s.altFt = 8100;
    s.speedKt = 228;
    s.distanceM = 22400;
    s.throttle = 0.5;
    ctx.startEvent('engineFire');
    input.look.yawDeg = 26;
    input.look.pitchDeg = 3;
    return;
  }

  if (name === 'approach') {
    // The last mile: gear down and three green lights, the runway
    // filling the windshield, speed in the green band.
    s.phase = 'approach';
    s.altFt = 210;
    s.speedKt = 138;
    s.distanceM = 850;
    s.lateralM = 6;
    s.throttle = 0.34;
    s.gearDown = true;
    s.maydaySent = true;
    s.hull = 78;
    s.checklist = ['Gear DOWN — 3 green ✓', 'Touch down 105–165 kt, wings level, on the centreline'];
    input.look.yawDeg = 0;
    input.look.pitchDeg = -2;
    return;
  }

  if (name === 'tail') {
    // The outside view: the whole Kestrel over the bay, island and
    // lighthouse below, Port Alba and its runway on the horizon.
    s.phase = 'crisis';
    s.altFt = 6100;
    s.speedKt = 246;
    s.distanceM = 19800;
    s.bankDeg = -11;
    s.throttle = 0.6;
    ctx.startEvent('engineFire');
    ctx.setTail(true);
    return;
  }

  if (name === 'hills') {
    // A low pass over the inland hills in the outside view: the
    // check that the warped terrain, its moisture colours and the
    // scattered trees and stones read from the air. Not one of the
    // four shipped screenshots — a builder's scene.
    s.phase = 'calm';
    s.altFt = 800;
    s.speedKt = 200;
    s.distanceM = 4500;
    s.bankDeg = -6;
    s.throttle = 0.55;
    ctx.setTail(true);
    return;
  }

  // Unknown scene: fall back to the calm.
  stageShot('start', ctx);
}
