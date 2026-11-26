// The world outside the windows of DEAD STICK: a procedural heightmap
// coastline — rolling hills that rise out of the bay, a cratered
// volcano, an island with a lighthouse, farmland patches, the lit
// streets of Port Alba — and at the end of it, runway 27 with its
// approach lights. The terrain is one displaced plane whose height
// function is shared: buildings and the lighthouse sit on the same
// ground the pilot sees. The player's own Kestrel K-200 is built here
// too: nose, wings and engines visible from the seat, and the whole
// aircraft for the tail camera. No model or texture file is loaded.

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

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Seeded value noise: soft hills from a random grid, bilinearly eased. */
function makeNoise(random) {
  const G = 128;
  const grid = new Float32Array(G * G);
  for (let i = 0; i < grid.length; i++) grid[i] = random();
  const at = (ix, iz) => grid[(((iz % G) + G) % G) * G + (((ix % G) + G) % G)];
  return function noise(x, z, cell) {
    const gx = x / cell;
    const gz = z / cell;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    const fx = gx - ix;
    const fz = gz - iz;
    const sx = fx * fx * (3 - 2 * fx);
    const sz = fz * fz * (3 - 2 * fz);
    const a = at(ix, iz);
    const b = at(ix + 1, iz);
    const c = at(ix, iz + 1);
    const d = at(ix + 1, iz + 1);
    return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
  };
}

/**
 * The ground truth of Port Alba bay, in metres, route coordinates
 * (the runway threshold is at z = -DESCENT.startDistanceM, x = 0).
 * Sea floor sits at -25; the coast waves around z ≈ -24,500; the
 * volcano rises 1,280 m over the bay; the airfield is graded flat.
 */
export function makeHeightFunction(random) {
  const noise = makeNoise(random);
  const VOLCANO = { x: 6200, z: -22500 };
  const ISLAND = { x: -3400, z: -15000 };
  const runwayZ = -DESCENT.startDistanceM;

  function heightAt(x, z) {
    // Wavy coastline: open sea ahead, land behind the surf line.
    const coastZ = -24500 + (noise(x, 0, 9000) - 0.5) * 5000;
    const land = smoothstep(coastZ + 1600, coastZ - 2600, z);
    // Rolling hills in three octaves, growing as you go inland.
    const hills = noise(x, z, 5200) * 0.55 + noise(x, z, 2100) * 0.3 + noise(x, z, 820) * 0.15;
    let h = land * (hills * 210 - 24);
    // The volcano: a broad cone with a crater bitten out of the top.
    const dv = Math.hypot(x - VOLCANO.x, z - VOLCANO.z);
    h += 1280 * Math.exp(-((dv / 2100) ** 2)) - 170 * Math.exp(-((dv / 430) ** 2));
    // The lighthouse island.
    const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
    h += 78 * Math.exp(-((di / 1250) ** 2));
    // The city sits on gentler ground.
    if (Math.abs(x) < 5800 && z < -25500 && z > -40000) h *= 0.35;
    // The airfield is graded dead flat: a smooth-edged plateau at 0.
    const flatX = 1 - smoothstep(750, 2300, Math.abs(x));
    const flatZ = smoothstep(runwayZ - 5600, runwayZ - 3800, z) * (1 - smoothstep(runwayZ + 4200, runwayZ + 6000, z));
    const flat = flatX * flatZ;
    h = h * (1 - flat);
    // Under water, the floor falls away.
    if (land < 0.05 && dv > 2600 && di > 1200) h = Math.min(h, -25 + hills * 8);
    return h;
  }
  return { heightAt, VOLCANO, ISLAND };
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

const COLOR = {
  sand: new THREE.Color('#d9c58f'),
  grassA: new THREE.Color('#6f9a52'),
  grassB: new THREE.Color('#4d7c4f'),
  fieldGold: new THREE.Color('#c9b458'),
  dry: new THREE.Color('#8a9455'),
  rock: new THREE.Color('#7d7a72'),
  ash: new THREE.Color('#a49e93'),
  snow: new THREE.Color('#eef2f2'),
  seabed: new THREE.Color('#275d70'),
};

export function createWorld(random) {
  const route = new THREE.Group(); // scenery; slides toward the aircraft
  const planeGroup = new THREE.Group(); // the aircraft, cockpit rides in it
  const { heightAt, VOLCANO, ISLAND } = makeHeightFunction(random);
  const patchNoise = makeNoise(random);

  // --- The heightmap terrain, coloured by height, slope and patch ---
  const TERRAIN_W = 56000;
  const TERRAIN_D = 72000;
  const terrainGeo = new THREE.PlaneGeometry(TERRAIN_W, TERRAIN_D, 200, 250);
  terrainGeo.rotateX(-Math.PI / 2);
  {
    const pos = terrainGeo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i) - 26000;
      const h = heightAt(x, z);
      pos.setY(i, h);
      pos.setZ(i, z);
      // Colour: seabed and beach at the waterline, a patchwork of
      // greens and gold inland, rock on the heights, ash at the top.
      const patch = patchNoise(x, z, 2600);
      if (h < -3) tmp.copy(COLOR.seabed);
      else if (h < 2.5) tmp.copy(COLOR.sand);
      else if (h < 55) tmp.copy(patch > 0.62 ? COLOR.fieldGold : COLOR.grassA).lerp(COLOR.grassB, patchNoise(x, z, 900) * 0.6);
      else if (h < 190) tmp.copy(COLOR.grassB).lerp(COLOR.dry, Math.min(1, (h - 55) / 160));
      else if (h < 640) tmp.copy(COLOR.dry).lerp(COLOR.rock, Math.min(1, (h - 190) / 320));
      else if (h < 1010) tmp.copy(COLOR.rock).lerp(COLOR.ash, Math.min(1, (h - 640) / 370));
      else tmp.copy(COLOR.ash).lerp(COLOR.snow, Math.min(1, (h - 1010) / 200));
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    // Steep faces read as rock, whatever their height.
    const normals = terrainGeo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      if (normals.getY(i) < 0.8 && pos.getY(i) > 3) {
        colors[i * 3] = COLOR.rock.r;
        colors[i * 3 + 1] = COLOR.rock.g;
        colors[i * 3 + 2] = COLOR.rock.b;
      }
    }
  }
  const terrain = new THREE.Mesh(terrainGeo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  route.add(terrain);

  // The sea itself: one shining sheet at y = 0 over everything low.
  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(90000, 100000),
    new THREE.MeshLambertMaterial({ color: PALETTE.sea, transparent: true, opacity: 0.94 }),
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.set(0, 0, -26000);
  route.add(sea);

  // The volcano's lazy smoke column, over the heightmap summit.
  const summitY = heightAt(VOLCANO.x, VOLCANO.z);
  for (let i = 0; i < 7; i++) {
    const puff = new THREE.Mesh(
      new THREE.SphereGeometry(range(random, 90, 200), 8, 6),
      new THREE.MeshLambertMaterial({ color: '#cfd4d6', transparent: true, opacity: 0.5 }),
    );
    puff.position.set(VOLCANO.x + range(random, -120, 120), summitY + 120 + i * 160, VOLCANO.z + range(random, -60, 60));
    route.add(puff);
  }

  // The lighthouse on its island, standing on the same heightmap.
  const islandY = heightAt(ISLAND.x, ISLAND.z);
  box(40, 190, 40, '#e8e4da', ISLAND.x, islandY + 90, ISLAND.z, route);
  box(46, 26, 46, '#c33', ISLAND.x, islandY + 195, ISLAND.z, route);

  // Port Alba: a grid of lit blocks, each planted on the terrain.
  for (let i = 0; i < 110; i++) {
    const bx = range(random, -5200, 5200);
    const bz = range(random, -39000, -26500);
    const h = range(random, 25, 130);
    const ground = heightAt(bx, bz);
    const building = box(range(random, 60, 150), h, range(random, 60, 150),
      i % 5 === 0 ? '#8a8f96' : '#767c85', bx, ground + h / 2 - 2, bz, route);
    building.material = new THREE.MeshLambertMaterial({ color: building.material.color, emissive: '#2f2a1a' });
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
  for (let i = 0; i < 10; i++) {
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(18, 1.2, 1.2),
      new THREE.MeshBasicMaterial({ color: PALETTE.runwayLight }),
    );
    bar.position.set(0, 2, runwayZ + 120 + i * 90);
    route.add(bar);
  }
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
      new THREE.MeshLambertMaterial({ color: '#ffffff', transparent: true, opacity: 0.68 }),
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
  engine(6.4);

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
