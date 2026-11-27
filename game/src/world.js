// The world outside the windows of DEAD STICK: a procedural heightmap
// coastline — rolling hills that rise out of the bay, a cratered
// volcano, an island with a lighthouse, farmland patches, the lit
// streets of Port Alba — and at the end of it, runway 27 with its
// approach lights. The terrain is one displaced plane whose height
// function is shared: buildings, the lighthouse and every scattered
// tree and stone sit on the same ground the pilot sees. Terrain
// technique follows the threejs-landscape skill: the hill noise is
// domain-warped before its octaves are layered (plain fBm reads as
// crumpled paper), a ridged layer folds crests into the hills, the
// ground is coloured by height, slope and moisture rather than a
// texture, and scatter is rejection-sampled against that one height
// function so nothing floats or sinks. The player's own Kestrel K-200
// is built here too: nose, wings and engines visible from the seat,
// and the whole aircraft for the tail camera. No model or texture
// file is loaded.

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
    // Domain warp (threejs-landscape): bend the position the hills
    // are sampled at with a low-frequency noise field before layering
    // the octaves, so the landforms read as eroded instead of
    // crumpled paper. Only the hills are warped — the coast, volcano,
    // island and airfield masks below stay on true coordinates, so
    // the geography the game is balanced around does not move.
    const wx = x + (noise(x, z, 6800) - 0.5) * 3400;
    const wz = z + (noise(x + 31000, z - 17000, 6800) - 0.5) * 3400;
    // Rolling hills in three octaves, growing as you go inland.
    const base = noise(wx, wz, 5200) * 0.5 + noise(wx, wz, 2100) * 0.27 + noise(wx, wz, 820) * 0.13;
    // A ridged layer: fold the noise over so its crests sharpen into
    // ridge lines instead of more soft bumps.
    const fold = 1 - Math.abs(noise(wx, wz, 2600) * 2 - 1);
    const hills = base + fold * fold * 0.1;
    let h = land * (hills * 215 - 24);
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
  wetSand: new THREE.Color('#b39b6d'),
  grassA: new THREE.Color('#6f9a52'),
  grassB: new THREE.Color('#4d7c4f'),
  lush: new THREE.Color('#3e7a41'),
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
  const moistNoise = makeNoise(random);

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
      // Colour by what the ground is doing (threejs-landscape): a
      // moisture field decides lush green against dry olive, worked
      // farmland breaks the green into gold patches on the lowland,
      // and every height band blends into the next with noise-wobbled
      // edges so nothing bands. Slope rock blends in afterwards.
      const patch = patchNoise(x, z, 2600);
      const moist = moistNoise(x, z, 8500);
      const he = h + (patchNoise(x, z, 1500) - 0.5) * 30;
      if (h < -3) {
        tmp.copy(COLOR.seabed).lerp(COLOR.wetSand, smoothstep(-3, 0.5, h));
      } else {
        tmp.copy(COLOR.wetSand).lerp(COLOR.sand, smoothstep(0.5, 4, he));
        const ground = COLOR.dry.clone().lerp(COLOR.lush, smoothstep(0.32, 0.72, moist));
        ground.lerp(COLOR.fieldGold, smoothstep(0.6, 0.72, patch) * (1 - smoothstep(45, 70, he)) * 0.85);
        tmp.lerp(ground, smoothstep(3, 9, he));
        tmp.lerp(COLOR.grassB, smoothstep(55, 130, he) * 0.45);
        tmp.lerp(COLOR.rock, smoothstep(185, 470, he));
        tmp.lerp(COLOR.ash, smoothstep(640, 1000, he));
        tmp.lerp(COLOR.snow, smoothstep(1010, 1210, he));
      }
      colors[i * 3] = tmp.r;
      colors[i * 3 + 1] = tmp.g;
      colors[i * 3 + 2] = tmp.b;
    }
    terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    // Steep faces turn to rock, whatever their height — blended by
    // how steep they are, so cliffs weather into the hillsides
    // instead of switching to grey in one hard step.
    const normals = terrainGeo.attributes.normal;
    for (let i = 0; i < pos.count; i++) {
      const steep = smoothstep(0.88, 0.6, normals.getY(i)) * 0.85;
      if (steep > 0 && pos.getY(i) > 3) {
        colors[i * 3] += (COLOR.rock.r - colors[i * 3]) * steep;
        colors[i * 3 + 1] += (COLOR.rock.g - colors[i * 3 + 1]) * steep;
        colors[i * 3 + 2] += (COLOR.rock.b - colors[i * 3 + 2]) * steep;
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

  // --- Scatter: trees and stones off the same height function ---
  // (threejs-landscape: rejection-sample against height and slope,
  // then setMatrixAt on InstancedMeshes — three draw calls dress the
  // whole landscape. Nothing is planted in the city grid, on the
  // graded airfield, or in the lighthouse clearing, and the stones
  // are flattened and sunk so they read as embedded, not dropped.)
  const slopeAt = (x, z) => {
    const e = 16;
    return Math.hypot(heightAt(x + e, z) - heightAt(x - e, z), heightAt(x, z + e) - heightAt(x, z - e)) / (2 * e);
  };
  const inCity = (x, z) => Math.abs(x) < 5900 && z < -25200 && z > -40300;
  const inField = (x, z) => Math.abs(x) < 3000 && z > runwayZ - 6600 && z < runwayZ + 7000;
  const dummy = new THREE.Object3D();
  const tint = new THREE.Color();

  const TREE_N = 950;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(1.1, 1.8, 10, 5), M.flat('#6b4a2f'), TREE_N);
  const canopies = new THREE.InstancedMesh(new THREE.ConeGeometry(7.5, 22, 7), new THREE.MeshLambertMaterial({ color: '#ffffff' }), TREE_N);
  let trees = 0;
  for (let tries = 0; tries < TREE_N * 6 && trees < TREE_N; tries++) {
    const x = range(random, -19000, 19000);
    const z = range(random, -44000, -12000);
    const h = heightAt(x, z);
    if (h < 4 || h > 175) continue;
    if (slopeAt(x, z) > 0.5) continue;
    if (inCity(x, z) || inField(x, z)) continue;
    if (Math.hypot(x - VOLCANO.x, z - VOLCANO.z) < 2600) continue;
    if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < 260) continue;
    // Trees gather where the moisture runs high; dry ground stays open.
    if (random() > 0.25 + moistNoise(x, z, 8500) * 0.85) continue;
    const s = range(random, 0.75, 1.8);
    dummy.rotation.set(0, random() * Math.PI * 2, 0);
    dummy.scale.setScalar(s);
    dummy.position.set(x, h - 0.5 + 5 * s, z);
    dummy.updateMatrix();
    trunks.setMatrixAt(trees, dummy.matrix);
    dummy.position.y = h - 0.5 + 17 * s;
    dummy.updateMatrix();
    canopies.setMatrixAt(trees, dummy.matrix);
    canopies.setColorAt(trees, tint.setHSL(0.29 + random() * 0.05, 0.42, 0.24 + random() * 0.12));
    trees++;
  }
  trunks.count = trees;
  canopies.count = trees;
  route.add(trunks);
  route.add(canopies);

  const STONE_N = 420;
  const stoneGeo = new THREE.IcosahedronGeometry(3.4, 0);
  stoneGeo.scale(1, 0.62, 1);
  const stones = new THREE.InstancedMesh(stoneGeo, M.flat('#7d7a72'), STONE_N);
  let rocks = 0;
  for (let tries = 0; tries < STONE_N * 6 && rocks < STONE_N; tries++) {
    const x = range(random, -20000, 20000);
    const z = range(random, -45000, -11000);
    const h = heightAt(x, z);
    if (h < 1.5 || h > 950) continue;
    if (inCity(x, z) || inField(x, z)) continue;
    const s = range(random, 0.5, 2.8);
    dummy.position.set(x, h - 0.7 * s, z);
    dummy.rotation.set(random() * 0.6, random() * Math.PI * 2, random() * 0.6);
    dummy.scale.set(s, s * range(random, 0.7, 1), s);
    dummy.updateMatrix();
    stones.setMatrixAt(rocks, dummy.matrix);
    rocks++;
  }
  stones.count = rocks;
  route.add(stones);

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
  // Modelled after the 3d-high-poly-models skill's order of work:
  // silhouette first (a lathed fuselage profile and extruded,
  // bevelled wing planforms instead of a plain tube and slab wings),
  // surface form next (shaped fin, pylons buried into the wing,
  // intake lips), and the microdetail — window rows, doors, titles —
  // carried by a canvas texture, not geometry.
  const livery = '#eef1f2';
  const teal = '#0e7d8a';

  /** Canvas livery for the lathe: cheatline, windows, doors, titles.
   * Lathe UVs run u around the body (sides at u .25 and .75) and v
   * along it (0 at the nose, 1 at the tail); the constant-radius
   * midsection spans v .14–.62, which is where the details live. */
  function liveryTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 512;
    const g = canvas.getContext('2d');
    g.fillStyle = livery;
    g.fillRect(0, 0, 1024, 512);
    const yOf = (v) => (1 - v) * 512;
    for (const side of [0.25, 0.75]) {
      const cx = side * 1024;
      // Cheatline stripe along the window line.
      g.fillStyle = teal;
      g.fillRect(cx - 26, yOf(0.6), 52, yOf(0.16) - yOf(0.6));
      // Passenger windows: a dotted row down the midsection.
      g.fillStyle = '#223140';
      for (let v = 0.2; v <= 0.58; v += 0.027) {
        g.beginPath();
        g.ellipse(cx, yOf(v), 7.5, 5, 0, 0, Math.PI * 2);
        g.fill();
      }
      // Door outlines fore and aft.
      g.strokeStyle = '#9aa4ab';
      g.lineWidth = 2.5;
      for (const v of [0.155, 0.575]) g.strokeRect(cx - 17, yOf(v) - 26, 34, 52);
      // Airline titles by the nose, reading nose-to-tail.
      g.save();
      g.translate(cx - 44, yOf(0.3));
      g.rotate(-Math.PI / 2);
      g.fillStyle = teal;
      g.font = 'bold 44px system-ui, sans-serif';
      g.textAlign = 'center';
      g.fillText('MERIDIAN', 0, 0);
      g.restore();
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  // The fuselage as one lathed profile: rounded nose, constant
  // midsection, upswept tail cone — a silhouette, not a tube.
  const profile = [
    [0.12, 0], [0.75, 0.8], [1.35, 2.0], [1.8, 3.6], [2.0, 5.5],
    [2.0, 24], [1.82, 30], [1.45, 34], [1.0, 37], [0.55, 38.4], [0.16, 38.8],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const fuselageGeo = new THREE.LatheGeometry(profile, 28);
  fuselageGeo.rotateX(Math.PI / 2); // lathe axis Y -> body axis Z, nose at 0
  const fuselage = new THREE.Mesh(fuselageGeo, new THREE.MeshLambertMaterial({ map: liveryTexture() }));
  fuselage.scale.y = 0.85; // a jet's body is a little squashed, and the
  // lower crown keeps the nose out of the pilot's sightline
  fuselage.position.set(0, -0.1, -19);
  planeGroup.add(fuselage);
  // The flight-deck windows as the outside world sees them: a dark band
  // high on the nose (the interior cockpit hides itself for this view).
  const windowBand = box(2.3, 0.55, 1.4, '#18222c', 0, -0.35, -13.6, planeGroup);
  windowBand.rotation.x = -0.35;

  /** A wing from its planform: swept, tapered, thinly extruded with a
   * bevelled edge so the rim catches the light. One shape serves the
   * main wing and, scaled, the tailplane. */
  function wingGeometry(span, rootChord, tipChord, sweep) {
    const shape = new THREE.Shape();
    shape.moveTo(0, -rootChord / 2);
    shape.lineTo(span, -rootChord / 2 + sweep);
    shape.lineTo(span, -rootChord / 2 + sweep + tipChord);
    shape.lineTo(0, rootChord / 2);
    shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.3, bevelEnabled: true, bevelThickness: 0.07, bevelSize: 0.07, bevelSegments: 1,
    });
    geo.rotateX(Math.PI / 2); // shape plane -> plan view, depth -> thickness
    return geo;
  }
  const wingMat = M.flat(livery);
  const wingR = new THREE.Mesh(wingGeometry(17, 5.4, 2.2, 2.2), wingMat);
  wingR.position.set(0.4, -1.05, 0.6);
  planeGroup.add(wingR);
  const wingL = new THREE.Mesh(wingR.geometry, wingMat);
  wingL.scale.x = -1;
  wingL.position.copy(wingR.position);
  planeGroup.add(wingL);
  // Winglets: small teal fins standing on the tips.
  for (const side of [-1, 1]) {
    const winglet = box(0.16, 1.5, 1.7, teal, side * 17.2, -0.35, 2.6, planeGroup);
    winglet.rotation.z = side * -0.18;
    winglet.rotation.y = side * 0.32;
  }
  // The tail fin from its side profile, and a scaled wing as tailplane.
  const finShape = new THREE.Shape();
  finShape.moveTo(-3.4, 0);
  finShape.lineTo(0.4, 4.6);
  finShape.lineTo(3.0, 4.6);
  finShape.lineTo(3.8, 0);
  finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, {
    depth: 0.26, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 1,
  });
  const tailFin = new THREE.Mesh(finGeo, M.flat(teal));
  tailFin.position.set(-0.13, 0.9, 17.6);
  planeGroup.add(tailFin);
  const tailR = new THREE.Mesh(wingGeometry(6.8, 3.4, 1.5, 1.2), wingMat);
  tailR.position.set(0.2, 0.95, 18.4);
  planeGroup.add(tailR);
  const tailL = new THREE.Mesh(tailR.geometry, wingMat);
  tailL.scale.x = -1;
  tailL.position.copy(tailR.position);
  planeGroup.add(tailL);

  function engine(x) {
    const group = new THREE.Group();
    // Pylon first, buried up into the wing so the join has no gap.
    const pylon = box(0.24, 1.7, 2.6, '#c9ced1', 0, 1.15, -0.2, group);
    pylon.rotation.x = 0.12;
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(1.12, 1.0, 4.6, 18), M.flat('#d7dbdd'));
    nacelle.rotation.x = Math.PI / 2;
    group.add(nacelle);
    // Intake: a rounded lip ring around a dark fan disc.
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.98, 0.16, 8, 20), M.flat('#e8ebec'));
    lip.position.z = -2.3;
    group.add(lip);
    const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.95, 0.24, 18), M.basic('#14181c'));
    intake.rotation.x = Math.PI / 2;
    intake.position.z = -2.25;
    group.add(intake);
    // Exhaust cone tapering out of the back.
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.82, 1.3, 14), M.flat('#8f9599'));
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.z = 2.7;
    group.add(exhaust);
    group.position.set(x, -2.2, -0.6);
    planeGroup.add(group);
    return group;
  }
  const engineLeft = engine(-6.4);
  engine(6.4);

  // Landing gear, shown only when it is down (setGear): a nose leg
  // and two main legs, struts with simple wheels.
  const gearGroup = new THREE.Group();
  function gearLeg(x, z, twin) {
    const leg = new THREE.Group();
    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 2.6, 8), M.flat('#c9ced1'));
    strut.position.y = -1.3;
    leg.add(strut);
    const wheelGeo = new THREE.CylinderGeometry(0.52, 0.52, 0.34, 12);
    for (const off of twin ? [-0.24, 0.24] : [0]) {
      const wheel = new THREE.Mesh(wheelGeo, M.flat('#1c1f22'));
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(off, -2.75, 0);
      leg.add(wheel);
    }
    leg.position.set(x, -1.6, z);
    gearGroup.add(leg);
  }
  gearLeg(0, -11.5, true);
  gearLeg(-3.4, 1.8, true);
  gearLeg(3.4, 1.8, true);
  gearGroup.visible = false;
  planeGroup.add(gearGroup);

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
    /** The exterior gear legs follow the gear state. */
    setGear(down) {
      gearGroup.visible = down;
    },
    /** Smoke alone, after the fire is out but before the restart. */
    setEngineSmoke(on) {
      smokeTrail.points.visible = on;
      if (on) fire.points.visible = false;
      fireOn = on;
    },
  };
}
