// scenery.js — the valley's dressing beyond the rim: low-poly cloud
// clusters drifting at flying altitude, and a ring of distant grey
// peaks with pale snow caps standing in the haze beyond the valley
// wall. Pure decoration — nothing here touches the flight model —
// placed from the seeded RNG so the sky is the same on every load.

import { SEED } from './config.js';
import { mulberry32 } from './random.js';

export class Scenery {
  constructor(scene) {
    this.clouds = new THREE.Group();
    this.buildClouds();
    scene.add(this.clouds);
    this.buildPeaks(scene);
  }

  buildClouds() {
    // Each cloud is a raft of flattened icosahedrons: bright tops in
    // near-white, the lower puffs tinted warm by the low sun, so a
    // cluster reads as one lit mass instead of grey lumps.
    const rng = mulberry32(SEED + 505);
    const topMat = new THREE.MeshLambertMaterial({ color: 0xfff8ee });
    const underMat = new THREE.MeshLambertMaterial({ color: 0xffd2a0 });
    const puffGeo = new THREE.IcosahedronGeometry(1, 0);
    for (let i = 0; i < 17; i++) {
      const cl = new THREE.Group();
      const puffs = 5 + Math.floor(rng() * 3);
      for (let j = 0; j < puffs; j++) {
        const lower = j > puffs - 3;
        const m = new THREE.Mesh(puffGeo, lower ? underMat : topMat);
        m.position.set(
          (j - (puffs - 1) / 2) * (20 + rng() * 14) + (rng() - 0.5) * 16,
          lower ? -4 - rng() * 3 : (rng() - 0.5) * 5,
          (rng() - 0.5) * 30);
        m.scale.set(26 + rng() * 30, 8 + rng() * 6, 18 + rng() * 14);
        m.rotation.y = rng() * Math.PI;
        cl.add(m);
      }
      const a = rng() * Math.PI * 2;
      const r = 350 + rng() * 1550;
      cl.position.set(Math.cos(a) * r, 255 + rng() * 165, Math.sin(a) * r);
      cl.rotation.y = rng() * Math.PI;
      this.clouds.add(cl);
    }
  }

  buildPeaks(scene) {
    // A broken ring of far peaks just inside the sky dome. Fog does
    // most of the work: at this range they stand as warm-hazed
    // silhouettes with snow catching the last of the light.
    const rng = mulberry32(SEED + 606);
    const rockMat = new THREE.MeshLambertMaterial({ color: 0x6f6a72 });
    const snowMat = new THREE.MeshLambertMaterial({ color: 0xf6efe4 });
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2 + (rng() - 0.5) * 0.4;
      const dist = 2950 + rng() * 350;
      const hgt = 640 + rng() * 420;
      const rad = 400 + rng() * 220;
      const g = new THREE.Group();
      const peak = new THREE.Mesh(new THREE.ConeGeometry(rad, hgt, 6), rockMat);
      peak.position.y = hgt / 2 - 30;
      peak.rotation.y = rng() * Math.PI;
      g.add(peak);
      const capH = hgt * 0.36;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(rad * 0.37, capH, 6), snowMat);
      cap.position.y = hgt - 30 - capH / 2 + 6;
      cap.rotation.y = peak.rotation.y;
      g.add(cap);
      g.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
      scene.add(g);
    }
  }

  update(dt) {
    // The clusters drift with the evening flow and wrap at the rim.
    for (const cl of this.clouds.children) {
      cl.position.x += dt * 1.4;
      if (cl.position.x > 2500) cl.position.x = -2500;
    }
  }
}
