// The world outside the windows of DEAD STICK, built procedurally with
// Three.js primitives: a coastline you can recognise at a glance — sea,
// a smoking volcano, an island, patchwork fields, the lit streets of
// Port Alba — and at the end of it, runway 27 with its approach lights.
// The player's own Kestrel K-200 is built here too: nose, wings and
// engines that the pilot can see from the seat, and the whole aircraft
// for the tail camera. No model or texture file is ever loaded.

import { DESCENT, PALETTE } from './config.js';
import { range } from './random.js';

const M = {
  basic: (color) => new THREE.MeshBasicMaterial({ color }),
  flat: (color) => new THREE.MeshLambertMaterial({ color }),
};

function box(w, h, d, color, x, y, z, parent) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M.flat(color));
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Canvas texture for the runway: threshold bars, centreline, big 27. */
function runwayTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 1024;
  const g = canvas.getContext('2d');
  g.fillStyle = PALETTE.runway;
  g.fillRect(0, 0, 256, 1024);
  g.fillStyle = '#e8e8e8';
  for (let i = 0; i < 8; i++) g.fillRect(20 + i * 28, 12, 14, 90); // threshold piano keys
  for (let z = 160; z < 1000; z += 90) g.fillRect(122, z, 12, 52); // centreline dashes
  g.font = 'bold 90px system-ui, sans-serif';
  g.textAlign = 'center';
  g.fillText('27', 128, 250);
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  return texture;
}

export function createWorld(random) {
  const route = new THREE.Group(); // scenery; slides toward the aircraft
  const planeGroup = new THREE.Group(); // the aircraft, cockpit rides in it

  // --- Terrain: sea first, then the coast the approach crosses ---
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(60000, 70000), M.flat(PALETTE.sea));
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, -2, -26000);
  route.add(sea);

  const land = new THREE.Mesh(new THREE.PlaneGeometry(60000, 26000), M.flat(PALETTE.land));
  land.rotation.x = -Math.PI / 2;
  land.position.set(0, -1, -38500);
  route.add(land);

  const beach = new THREE.Mesh(new THREE.PlaneGeometry(60000, 500), M.flat(PALETTE.sand));
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, -0.5, -25750);
  route.add(beach);

  // Patchwork fields on the land side, a chequer a judge can read at once.
  const fieldColors = ['#5d8a4a', '#79a24f', '#c9b458', '#6f9455', '#a8bf62'];
  for (let i = 0; i < 42; i++) {
    const w = range(random, 500, 1300);
    const d = range(random, 500, 1300);
    const field = new THREE.Mesh(
      new THREE.PlaneGeometry(w, d),
      M.flat(fieldColors[i % fieldColors.length]),
    );
    field.rotation.x = -Math.PI / 2;
    field.position.set(range(random, -9000, 9000), 0.2, range(random, -48000, -27000));
    route.add(field);
  }

  // An island with a lighthouse, passed on the left during the crisis.
  const island = new THREE.Mesh(new THREE.CylinderGeometry(900, 1200, 60, 24), M.flat(PALETTE.sand));
  island.position.set(-3400, 10, -15000);
  route.add(island);
  const islandTop = new THREE.Mesh(new THREE.CylinderGeometry(820, 900, 66, 24), M.flat(PALETTE.land));
  islandTop.position.set(-3400, 14, -15000);
  route.add(islandTop);
  box(40, 190, 40, '#e8e4da', -3400, 140, -15000, route);
  box(46, 26, 46, '#c33', -3400, 245, -15000, route);

  // The volcano: a grey cone with a snow cap and a lazy smoke column.
  const volcano = new THREE.Mesh(new THREE.ConeGeometry(2100, 1500, 24), M.flat('#6d6a63'));
  volcano.position.set(6200, 740, -22500);
  route.add(volcano);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(620, 460, 24), M.flat('#eef2f2'));
  cap.position.set(6200, 1270, -22500);
  route.add(cap);
  const smoke = [];
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(range(random, 90, 200), 8, 6),
      new THREE.MeshLambertMaterial({ color: '#cfd4d6', transparent: true, opacity: 0.5 }),
    );
    puff.position.set(6200 + range(random, -120, 120), 1600 + i * 160, -22500 + range(random, -60, 60));
    route.add(puff);
    smoke.push(puff);
  }

  // Port Alba: a grid of lit blocks around the airfield.
  for (let i = 0; i < 110; i++) {
    const h = range(random, 25, 130);
    const building = box(
      range(random, 60, 150), h, range(random, 60, 150),
      i % 5 === 0 ? '#8a8f96' : '#767c85',
      range(random, -5200, 5200), h / 2, range(random, -39000, -26500),
      route,
    );
    building.material = new THREE.MeshLambertMaterial({
      color: building.material.color,
      emissive: '#2f2a1a',
    });
  }

  // --- Runway 27 at Port Alba, threshold at z = -DESCENT.startDistanceM ---
  const runwayZ = -DESCENT.startDistanceM;
  const runway = new THREE.Mesh(
    new THREE.BoxGeometry(45, 1, 3200),
    new THREE.MeshBasicMaterial({ map: runwayTexture() }),
  );
  runway.position.set(0, 0.5, runwayZ - 1600 + 300);
  route.add(runway);

  // Approach light gantries: a ladder of white bars flying toward you.
  const approachLights = new THREE.Group();
  for (let i = 0; i < 10; i++) {
    const z = runwayZ + 120 + i * 90;
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(18, 1.2, 1.2),
      new THREE.MeshBasicMaterial({ color: PALETTE.runwayLight }),
    );
    bar.position.set(0, 2, z);
    approachLights.add(bar);
  }
  route.add(approachLights);
  // Runway edge lights.
  for (let z = runwayZ + 300; z > runwayZ - 2900; z -= 120) {
    for (const x of [-24, 24]) {
      const lamp = new THREE.Mesh(
        new THREE.SphereGeometry(1.6, 6, 5),
        new THREE.MeshBasicMaterial({ color: PALETTE.runwayLight }),
      );
      lamp.position.set(x, 1.6, z);
      route.add(lamp);
    }
  }
  // A simple terminal and tower so the field reads as an airport.
  box(300, 36, 80, '#9aa0a6', -260, 18, runwayZ - 500, route);
  box(24, 95, 24, '#b9bec4', -190, 47, runwayZ - 420, route);
  box(40, 14, 40, '#5b7d8a', -190, 100, runwayZ - 420, route);

  // --- Clouds: flat white slabs the descent falls through ---
  const clouds = new THREE.Group();
  for (let i = 0; i < 70; i++) {
    const cloud = new THREE.Mesh(
      new THREE.BoxGeometry(range(random, 300, 900), range(random, 24, 60), range(random, 200, 500)),
      new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.82 }),
    );
    cloud.position.set(range(random, -9000, 9000), range(random, 500, 3900), range(random, -34000, 4000));
    clouds.add(cloud);
  }
  route.add(clouds);

  // --- The aircraft itself (tail-cam body; nose/wings/engines for the seat) ---
  const livery = '#eef1f2';
  const teal = '#0e7d8a';
  const fuselage = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 34, 20), M.flat(livery));
  fuselage.rotation.x = Math.PI / 2;
  fuselage.position.set(0, 0, 2);
  planeGroup.add(fuselage);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2, 20, 14), M.flat(livery));
  nose.scale.set(1, 0.6, 1.9);
  nose.position.set(0, -1.55, -15.2);
  planeGroup.add(nose);
  // The flight-deck windows as the outside world sees them: a dark band
  // high on the nose (the interior cockpit hides itself for this view).
  const windowBand = box(2.3, 0.55, 1.4, '#18222c', 0, -0.4, -13.4, planeGroup);
  windowBand.rotation.x = -0.35;
  // Livery cheatline: two thin strips down the fuselage sides, so the
  // band never crosses the cockpit's own view out of the windshield.
  box(0.05, 0.34, 20, teal, -2.0, 0.15, -2, planeGroup);
  box(0.05, 0.34, 20, teal, 2.0, 0.15, -2, planeGroup);
  const wing = box(34, 0.28, 4.6, livery, 0, -1.1, 0.5, planeGroup);
  wing.rotation.z = 0.03;
  const tailFin = box(0.35, 3.6, 4.2, teal, 0, 2.9, 17.6, planeGroup);
  tailFin.rotation.x = -0.25;
  box(13, 0.24, 3.2, livery, 0, 1.2, 18.2, planeGroup);

  function engine(x) {
    const group = new THREE.Group();
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.15, 4.4, 14), M.flat('#d7dbdd'));
    nacelle.rotation.x = Math.PI / 2;
    group.add(nacelle);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.3, 14), M.basic('#14181c'));
    intake.rotation.x = Math.PI / 2;
    intake.position.z = -2.2;
    group.add(intake);
    group.position.set(x, -2.2, -0.6);
    planeGroup.add(group);
    return group;
  }
  const engineLeft = engine(-6.4);
  const engineRight = engine(6.4);

  // Fire and smoke for the left engine: two recycled point clouds.
  function makeParticles(count, color, size, opacity) {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color, size, transparent: true, opacity, depthWrite: false,
    });
    const points = new THREE.Points(geometry, material);
    points.visible = false;
    planeGroup.add(points);
    return { points, positions, count, ages: new Float32Array(count) };
  }
  const fire = makeParticles(90, '#ff7a26', 1.5, 0.9);
  const smokeTrail = makeParticles(110, '#555b60', 2.6, 0.45);

  function updateParticles(p, dt, origin, spread, rise, back) {
    const pos = p.positions;
    for (let i = 0; i < p.count; i++) {
      p.ages[i] += dt;
      if (p.ages[i] > 1) {
        p.ages[i] = Math.random() * 0.3;
        pos[i * 3] = origin.x + (Math.random() - 0.5) * spread;
        pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
        pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
      }
      pos[i * 3 + 1] += rise * dt;
      pos[i * 3 + 2] += back * dt;
      pos[i * 3] += Math.sin(p.ages[i] * 9 + i) * dt * 0.7;
    }
    p.points.geometry.attributes.position.needsUpdate = true;
  }

  let fireOn = false;
  return {
    route,
    planeGroup,
    /** Slides the world toward the aircraft and animates fire and smoke. */
    update(dt, distanceTravelled) {
      route.position.z = distanceTravelled;
      if (fireOn) {
        updateParticles(fire, dt, { x: -6.4, y: -2.2, z: 1.6 }, 0.9, 1.6, 16);
        updateParticles(smokeTrail, dt, { x: -6.4, y: -1.8, z: 2.4 }, 1.2, 3.2, 22);
      }
    },
    setEngineFire(on) {
      fireOn = on;
      fire.points.visible = on;
      smokeTrail.points.visible = on;
      engineLeft.visible = true;
    },
    /** Smoke alone, after the fire is out but before the restart. */
    setEngineSmoke(on) {
      smokeTrail.points.visible = on;
      if (on) fire.points.visible = false;
      fireOn = on;
    },
  };
}
