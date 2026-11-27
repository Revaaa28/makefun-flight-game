// terrain.js — Amber Valley itself: an analytic heightfield (so heightAt()
// always agrees with the mesh), a winding river, a lake, a stone bridge,
// terraced fields, a village, a lighthouse, wind turbines and the runway.
// Everything is placed from the seeded RNG, so the valley is identical on
// every load.

import { WORLD, RUNWAY, COLORS, SEED } from './config.js';
import { mulberry32, fbm } from './random.js';

// The river's centreline: a lazy S-curve running the length of the valley.
export function riverX(z) {
  return Math.sin(z * 0.0016) * 260 + Math.sin(z * 0.0007 + 1.3) * 120;
}

export const LAKE = { x: -760, z: 920, r: 300 };
export const LIGHTHOUSE = { x: -618, z: 760 };
export const VILLAGE = { x: 210, z: 620 };
export const CAMP = { x: -420, z: -560 };

function clamp01(v) { return Math.max(0, Math.min(1, v)); }
function smoothstep(a, b, v) { const t = clamp01((v - a) / (b - a)); return t * t * (3 - 2 * t); }
function lerp(a, b, t) { return a + (b - a) * t; }

// The one true height function. The terrain mesh samples it; the flight
// model collides with it; the landmarks sit on it.
export function heightAt(x, z) {
  const half = WORLD.size / 2;
  const edge = Math.max(Math.abs(x), Math.abs(z)) / half;      // 0 centre -> 1 rim
  const dRiver = Math.abs(x - riverX(z));
  // Valley floor near the river, hills climbing away from it.
  let h = 7 + Math.pow(Math.min(dRiver / 950, 1), 1.7) * 165;
  h += (fbm(x, z, SEED) - 0.5) * 46 * smoothstep(60, 420, dRiver);
  h += (fbm(x + 900, z - 700, SEED + 31) - 0.5) * 14;
  // Rim mountains so the world has a horizon wall.
  h += Math.pow(smoothstep(0.62, 1.0, edge), 2) * 320;
  // The river cuts a shallow channel.
  h -= (1 - smoothstep(0, 55, dRiver)) * 6;
  // The lake basin.
  const dLake = Math.hypot(x - LAKE.x, z - LAKE.z);
  h = lerp(1.5, h, smoothstep(LAKE.r * 0.55, LAKE.r, dLake));
  // The runway plateau: dead flat inside, feathered at the edges.
  const dxr = Math.abs(x - RUNWAY.x), dzr = Math.abs(z - RUNWAY.z);
  const inX = 1 - smoothstep(RUNWAY.width / 2 + 26, RUNWAY.width / 2 + 95, dxr);
  const inZ = 1 - smoothstep(RUNWAY.length / 2 + 26, RUNWAY.length / 2 + 95, dzr);
  h = lerp(h, RUNWAY.height, Math.min(inX, inZ));
  return h;
}

function vertexColor(x, z, h, out) {
  const dRiver = Math.abs(x - riverX(z));
  if (h < WORLD.waterLevel + 0.7) out.set(COLORS.sand);
  else if (dRiver < 70) out.set(COLORS.grass);
  else {
    const n = fbm(x * 1.7, z * 1.7, SEED + 77);
    if (h > 150) out.set(COLORS.rock);
    else if (h > 68 && n > 0.52) out.set(COLORS.forest);
    else if (n > 0.62) out.set(COLORS.grassDry);
    else out.set(COLORS.grass);
    if (h > 235) out.set(COLORS.snow);
  }
  // Slight per-vertex jitter so the flats read as low-poly facets.
  const j = 0.94 + fbm(x * 3.1, z * 3.1, SEED + 5) * 0.12;
  out.multiplyScalar(j);
  return out;
}

function box(w, h, d, color, x, y, z, ry = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color }));
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

export class Terrain {
  constructor(scene) {
    this.scene = scene;
    this.turbines = [];
    this.buildGround(scene);
    this.buildWater(scene);
    this.buildBridge(scene);
    this.buildRunway(scene);
    this.buildVillage(scene);
    this.buildLighthouse(scene);
    this.buildTurbines(scene);
    this.buildVegetation(scene);
    this.buildFields(scene);
    this.buildRoads(scene);
  }

  buildGround(scene) {
    const { size, segments } = WORLD;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = heightAt(x, z);
      pos.setY(i, h);
      vertexColor(x, z, h, c);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  buildWater(scene) {
    const mat = new THREE.MeshLambertMaterial({ color: COLORS.water, transparent: true, opacity: 0.94 });
    // The river: a ribbon of quads following the centreline at water level.
    const pts = [];
    for (let z = -WORLD.size / 2; z <= WORLD.size / 2; z += 40) pts.push(z);
    const verts = [], idx = [];
    pts.forEach((z, i) => {
      const cx = riverX(z);
      verts.push(cx - 42, WORLD.waterLevel, z, cx + 42, WORLD.waterLevel, z);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    scene.add(new THREE.Mesh(geo, mat));
    // The lake: a simple disc at the same level.
    const lake = new THREE.Mesh(new THREE.CircleGeometry(LAKE.r * 0.92, 28), mat);
    lake.rotation.x = -Math.PI / 2;
    lake.position.set(LAKE.x, WORLD.waterLevel, LAKE.z);
    scene.add(lake);
  }

  buildBridge(scene) {
    // A stone arch bridge where the valley road crosses the river at z=300.
    const z = 300, cx = riverX(z), y = heightAt(cx + 90, z);
    const g = new THREE.Group();
    const deck = box(190, 5, 16, 0x9a8d7c, 0, 7, 0);
    g.add(deck);
    for (const s of [-1, 1]) {
      g.add(box(10, 12, 14, 0x8a7d68, s * 42, 0, 0));       // piers
      g.add(box(70, 3, 3, 0x7c6f5c, s * 0, 10.5, -6.5));    // parapets
      g.add(box(70, 3, 3, 0x7c6f5c, 0, 10.5, 6.5));
    }
    g.position.set(cx, y - 2, z);
    scene.add(g);
  }

  buildRunway(scene) {
    const g = new THREE.Group();
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
      new THREE.MeshLambertMaterial({ color: 0x4c4a48 }));
    strip.rotation.x = -Math.PI / 2; strip.receiveShadow = true;
    g.add(strip);
    // Centreline dashes and threshold bars, as thin white boxes.
    const dashMat = new THREE.MeshBasicMaterial({ color: 0xf5efdd });
    for (let z = -RUNWAY.length / 2 + 24; z < RUNWAY.length / 2 - 20; z += 34) {
      const dash = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 15), dashMat);
      dash.position.set(0, 0.05, z); g.add(dash);
    }
    for (const end of [-1, 1]) for (let i = -2; i <= 2; i++) {
      if (i === 0) continue;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 9), dashMat);
      bar.position.set(i * 3.1, 0.05, end * (RUNWAY.length / 2 - 8)); g.add(bar);
    }
    // Edge lights: little emissive amber posts.
    const lightMat = new THREE.MeshBasicMaterial({ color: 0xffc46b });
    for (let z = -RUNWAY.length / 2; z <= RUNWAY.length / 2; z += 42) {
      for (const s of [-1, 1]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.7, 0.7), lightMat);
        p.position.set(s * (RUNWAY.width / 2 + 2.5), 0.4, z); g.add(p);
      }
    }
    // A small hangar and windsock beside the strip.
    g.add(box(26, 9, 18, 0xb0503c, 46, 4.5, -40));
    g.add(box(28, 2, 20, 0x6e4634, 46, 9.6, -40));
    const sockPole = box(0.4, 11, 0.4, 0xdddddd, -30, 5.5, 60); g.add(sockPole);
    const sock = box(4.5, 1.1, 1.1, 0xff7a2a, -27.5, 10.4, 60); g.add(sock);
    g.position.set(RUNWAY.x, RUNWAY.height + 0.06, RUNWAY.z);
    scene.add(g);
  }

  buildVillage(scene) {
    const rng = mulberry32(SEED + 101);
    const g = new THREE.Group();
    const roofCols = [0xb0503c, 0x8a5a34, 0x707a52, 0x9c4a2f];
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, r = 18 + rng() * 85;
      const x = VILLAGE.x + Math.cos(a) * r, z = VILLAGE.z + Math.sin(a) * r * 0.8;
      const y = heightAt(x, z);
      if (y < WORLD.waterLevel + 1) continue;
      const w = 7 + rng() * 5, d = 6 + rng() * 5, hgt = 3.6 + rng() * 2;
      const house = new THREE.Group();
      house.add(box(w, hgt, d, 0xe8dcc2, 0, hgt / 2, 0));
      const roof = new THREE.Mesh(
        new THREE.ConeGeometry(Math.max(w, d) * 0.78, 2.6, 4),
        new THREE.MeshLambertMaterial({ color: roofCols[i % roofCols.length] }));
      roof.position.y = hgt + 1.3; roof.rotation.y = Math.PI / 4;
      roof.castShadow = true;
      house.add(roof);
      house.position.set(x, y, z);
      house.rotation.y = rng() * Math.PI;
      g.add(house);
    }
    // The camp: three tents and a fire pit west of the river.
    for (let i = 0; i < 3; i++) {
      const x = CAMP.x + i * 14 - 12, z = CAMP.z + (i % 2) * 10;
      const tent = new THREE.Mesh(
        new THREE.ConeGeometry(4.4, 3.6, 4),
        new THREE.MeshLambertMaterial({ color: 0xd9822b }));
      tent.position.set(x, heightAt(x, z) + 1.8, z);
      tent.rotation.y = Math.PI / 4; tent.castShadow = true;
      g.add(tent);
    }
    scene.add(g);
  }

  buildLighthouse(scene) {
    const { x, z } = LIGHTHOUSE;
    const y = heightAt(x, z);
    const g = new THREE.Group();
    const tower = new THREE.Mesh(
      new THREE.CylinderGeometry(2.6, 3.6, 17, 10),
      new THREE.MeshLambertMaterial({ color: 0xf1ead8 }));
    tower.position.y = 8.5; tower.castShadow = true; g.add(tower);
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(3.05, 3.3, 3.4, 10),
      new THREE.MeshLambertMaterial({ color: COLORS.trim }));
    band.position.y = 10.5; g.add(band);
    const lamp = new THREE.Mesh(
      new THREE.CylinderGeometry(1.9, 1.9, 2.6, 8),
      new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.y = 18.2; g.add(lamp);
    const cap = new THREE.Mesh(
      new THREE.ConeGeometry(2.6, 2, 8),
      new THREE.MeshLambertMaterial({ color: 0x503a30 }));
    cap.position.y = 20.4; g.add(cap);
    const glow = new THREE.PointLight(0xffd9a0, 1.1, 190);
    glow.position.y = 18.2; g.add(glow);
    this.lighthouseGlow = glow;
    g.position.set(x, y, z);
    scene.add(g);
  }

  buildTurbines(scene) {
    // Three turbines on the eastern ridge, blades turning in update().
    const spots = [[980, -240], [1120, 60], [1010, 380]];
    for (const [x, z] of spots) {
      const y = heightAt(x, z);
      const g = new THREE.Group();
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(1.1, 1.8, 34, 8),
        new THREE.MeshLambertMaterial({ color: 0xe9e4da }));
      mast.position.y = 17; mast.castShadow = true; g.add(mast);
      const hub = new THREE.Group(); hub.position.set(0, 34, 1.6);
      for (let i = 0; i < 3; i++) {
        const blade = box(0.8, 13, 0.25, 0xf3efe6, 0, 6.5, 0);
        const holder = new THREE.Group();
        holder.rotation.z = (i / 3) * Math.PI * 2;
        holder.add(blade); hub.add(holder);
      }
      g.add(hub);
      g.position.set(x, y, z);
      g.rotation.y = -0.7;
      scene.add(g);
      this.turbines.push(hub);
    }
  }

  buildFields(scene) {
    // The valley's patchwork: two clusters of big, saturated plots —
    // rice green, young rice, ripe gold, fresh-ploughed brown — each on
    // a slightly larger dark border quad so the plots read as worked
    // land with edges, not confetti. One cluster terraces the west
    // slope; the other surrounds the village.
    const rng = mulberry32(SEED + 202);
    const cols = [0x77b13c, 0x9cc24a, 0xc9a227, 0x8a5a30, 0x5da244];
    const borderMat = new THREE.MeshLambertMaterial({ color: 0x44542a });
    const mats = cols.map((c) => new THREE.MeshLambertMaterial({ color: c }));
    const clusters = [
      { x0: -640, x1: -240, z0: -320, z1: 620, n: 20 },
      { x0: 40, x1: 460, z0: 360, z1: 940, n: 18 },
    ];
    for (const cl of clusters) {
      for (let i = 0; i < cl.n; i++) {
        const x = cl.x0 + rng() * (cl.x1 - cl.x0);
        const z = cl.z0 + rng() * (cl.z1 - cl.z0);
        const w = 55 + rng() * 60, d = 24 + rng() * 22;
        const y = heightAt(x, z);
        if (y < WORLD.waterLevel + 2 || y > 95) continue;
        if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < 70) continue;
        const rot = [0, 0.14, -0.12, Math.PI / 2, Math.PI / 2 + 0.1][Math.floor(rng() * 5)];
        const border = new THREE.Mesh(new THREE.PlaneGeometry(w * 1.06, d * 1.1), borderMat);
        border.rotation.x = -Math.PI / 2; border.rotation.z = rot;
        border.position.set(x, y + 0.18, z);
        border.receiveShadow = true;
        scene.add(border);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats[Math.floor(rng() * mats.length)]);
        f.rotation.x = -Math.PI / 2; f.rotation.z = rot;
        f.position.set(x, y + 0.32, z);
        f.receiveShadow = true;
        scene.add(f);
      }
    }
  }

  // A dirt ribbon over the ground: a triangle strip whose edges sit on
  // the terrain, wide enough to read from altitude as a track.
  ribbon(scene, points, width, color, lift = 0.3) {
    const verts = [], idx = [];
    const mat = new THREE.MeshLambertMaterial({ color });
    points.forEach(([x, z], i) => {
      const [nx, nz] = points[Math.min(i + 1, points.length - 1)];
      const [px, pz] = points[Math.max(i - 1, 0)];
      let dx = nx - px, dz = nz - pz;
      const len = Math.max(1, Math.hypot(dx, dz));
      dx /= len; dz /= len;
      const ox = -dz * width / 2, oz = dx * width / 2;
      verts.push(
        x + ox, heightAt(x + ox, z + oz) + lift, z + oz,
        x - ox, heightAt(x - ox, z - oz) + lift, z - oz);
      if (i > 0) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(verts), 3));
    geo.setIndex(idx); geo.computeVertexNormals();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  buildRoads(scene) {
    // Dirt roads give the valley its map: a track down the river's east
    // bank, the bridge crossing to the village, and the long connector
    // from the village up to Kestrel Field's threshold — the route the
    // mail actually travels when the Kestrel cannot fly.
    const bank = [];
    for (let z = -2050; z <= 2050; z += 50) bank.push([riverX(z) + 64, z]);
    this.ribbon(scene, bank, 7.5, 0x9a7d55);
    const sample = (waypoints, step) => {
      const out = [];
      for (let i = 0; i < waypoints.length - 1; i++) {
        const [ax, az] = waypoints[i], [bx, bz] = waypoints[i + 1];
        const n = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / step));
        for (let j = (i === 0 ? 0 : 1); j <= n; j++) {
          out.push([ax + (bx - ax) * j / n, az + (bz - az) * j / n]);
        }
      }
      return out;
    };
    const bridgeX = riverX(300);
    this.ribbon(scene, sample([
      [bridgeX + 60, 300], [bridgeX - 30, 380], [268, 500], [VILLAGE.x + 8, VILLAGE.z - 6],
    ], 26), 7, 0x9a7d55);
    this.ribbon(scene, sample([
      [VILLAGE.x + 8, VILLAGE.z - 6], [330, 240], [468, -360], [556, -960],
      [606, -1300], [RUNWAY.x, RUNWAY.z + RUNWAY.length / 2 + 6],
    ], 30), 7, 0x8f7350);
  }

  buildVegetation(scene) {
    // Low-poly pines scattered by the seeded RNG, kept out of the river,
    // the lake, the fields' valley floor and the runway plateau.
    const rng = mulberry32(SEED + 303);
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.5, 2.6, 5);
    const crownGeo = new THREE.ConeGeometry(2.6, 7.5, 6);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2e });
    const crownMat = new THREE.MeshLambertMaterial({ color: COLORS.forest });
    for (let i = 0; i < 420; i++) {
      const x = (rng() - 0.5) * (WORLD.size - 160);
      const z = (rng() - 0.5) * (WORLD.size - 160);
      const h = heightAt(x, z);
      if (h < WORLD.waterLevel + 1.2 || h > 165) continue;
      if (Math.abs(x - riverX(z)) < 60) continue;
      if (Math.hypot(x - LAKE.x, z - LAKE.z) < LAKE.r) continue;
      if (Math.abs(x - RUNWAY.x) < 90 && Math.abs(z - RUNWAY.z) < RUNWAY.length) continue;
      const s = 0.8 + rng() * 0.9;
      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat); trunk.position.y = 1.3;
      const crown = new THREE.Mesh(crownGeo, crownMat); crown.position.y = 6; crown.castShadow = true;
      tree.add(trunk); tree.add(crown);
      tree.scale.setScalar(s);
      tree.position.set(x, h - 0.2, z);
      tree.rotation.y = rng() * Math.PI;
      scene.add(tree);
    }
  }

  update(dt, t) {
    for (let i = 0; i < this.turbines.length; i++) {
      this.turbines[i].rotation.z += dt * (0.7 + i * 0.13);
    }
    if (this.lighthouseGlow) this.lighthouseGlow.intensity = 0.9 + Math.sin(t * 2.2) * 0.35;
  }
}
