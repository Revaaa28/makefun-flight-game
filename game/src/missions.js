// missions.js — the three sorties of Goldenhour Airmail and their scoring:
// thread nine rings down the valley, drop three mail bags on their pads,
// then come home and land like you mean it. Owns the ring and target
// meshes, the falling mail bags, and every score the campaign adds up.

import { COLORS, RUNWAY, MISSION_TITLES } from './config.js';
import { heightAt, riverX, VILLAGE, CAMP, LIGHTHOUSE } from './terrain.js';

const RING_RADIUS = 14;

// A soft radial-gradient texture for the rings' additive glow billboards,
// built once so each ring can carry a halo that reads from far away.
let glowTexture = null;
function ringGlowTexture() {
  if (glowTexture) return glowTexture;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,214,110,0.85)');
  grad.addColorStop(0.35, 'rgba(255,180,60,0.38)');
  grad.addColorStop(1, 'rgba(255,160,40,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(cv);
  return glowTexture;
}

export function ringPositions() {
  // Nine rings strung down the valley, following the river's S-curve.
  const out = [];
  for (let i = 0; i < 9; i++) {
    const z = -1250 + i * 265;
    const x = riverX(z) + Math.sin(i * 1.7) * 55;
    out.push(new THREE.Vector3(x, heightAt(x, z) + 34 + (i % 3) * 7, z));
  }
  return out;
}

export function dropTargets() {
  const mk = (name, x, z) => {
    const y = heightAt(x, z);
    return { name, pos: new THREE.Vector3(x, y, z), done: false, score: 0 };
  };
  return [
    mk('Village pad', VILLAGE.x + 46, VILLAGE.z + 30),
    mk('Camp pad', CAMP.x + 6, CAMP.z - 26),
    mk('Lighthouse pad', LIGHTHOUSE.x + 34, LIGHTHOUSE.z + 18),
  ];
}

// Score one landing: touchdown zone along the strip, sink rate, centreline.
export function scoreLanding(plane) {
  const along = (RUNWAY.z + RUNWAY.length / 2) - plane.pos.z; // metres past the near threshold
  const centre = Math.abs(plane.pos.x - RUNWAY.x);
  const sink = plane.touchdown ? plane.touchdown.sink : 99;
  let score = 400;
  // Zone: the sweet spot is 40–140 m in; too early or too late bleeds points.
  if (along < 15) score -= 190;
  else if (along < 40) score -= (40 - along) * 3;
  else if (along > 200) score -= Math.min(190, (along - 200) * 2.2);
  // Sink: greased under 1.5 m/s, firm to 3.5, punishing above.
  score -= Math.max(0, sink - 1.2) * 46;
  // Centreline: every metre off costs.
  score -= centre * 9;
  // Rolling out long or fast is untidy airmanship.
  score -= Math.max(0, plane.speed - 30) * 2;
  return {
    total: Math.max(0, Math.round(score)),
    along: Math.round(along), centre: centre.toFixed(1), sink: sink.toFixed(1),
  };
}

export class Missions {
  constructor(scene) {
    this.scene = scene;
    this.sortie = 0;              // 0 rings, 1 mail, 2 landing
    this.score = 0;
    this.message = '';
    this.messageT = 0;
    this.buildRings(scene);
    this.buildTargets(scene);
    this.bags = [];
    this.bagMeshes = [];
    this.bagsLeft = 3;
    this.landingResult = null;
  }

  buildRings(scene) {
    this.rings = ringPositions();
    this.ringGlows = [];
    this.ringMeshes = this.rings.map((p, i) => {
      // The torus with a warm emissive gold so the gate itself glows,
      // not just its paint — held under the halo's old glare, so the
      // ring reads as a ring and not a blob of light.
      const m = new THREE.Mesh(
        new THREE.TorusGeometry(RING_RADIUS, 1.9, 12, 30),
        new THREE.MeshLambertMaterial({
          color: i === 0 ? COLORS.ring : 0xb98a4a,
          emissive: 0xff9d00, emissiveIntensity: 0.7,
        }));
      m.position.copy(p);
      scene.add(m);
      // A bright core at the centre so the ring reads from far away.
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(2.1, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 }));
      core.position.copy(p);
      scene.add(core);
      this.ringGlows.push(core);
      // An additive glow billboard halo around the ring, wide enough to
      // spot down the valley but kept faint — a hint of light, not a
      // second sun: the torus and its bright core do the reading.
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({
        map: ringGlowTexture(), color: 0xffc95e, transparent: true,
        opacity: 0.26, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      halo.scale.setScalar(RING_RADIUS * 2.2);
      halo.position.copy(p);
      scene.add(halo);
      this.ringGlows.push(halo);
      return m;
    });
    this.ringIndex = 0;
  }

  buildTargets(scene) {
    this.targets = dropTargets();
    this.targetMeshes = this.targets.map((t) => {
      const g = new THREE.Group();
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(13, 22),
        new THREE.MeshBasicMaterial({ color: COLORS.target }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.3; g.add(disc);
      const inner = new THREE.Mesh(
        new THREE.CircleGeometry(5.5, 18),
        new THREE.MeshBasicMaterial({ color: 0xfff3d6 }));
      inner.rotation.x = -Math.PI / 2; inner.position.y = 0.45; g.add(inner);
      g.position.copy(t.pos);
      g.visible = false;
      scene.add(g);
      return g;
    });
  }

  // Called when a sortie begins: set up its furniture and banner.
  beginSortie(n) {
    this.sortie = n;
    this.ringMeshes.forEach((m) => { m.visible = n === 0; });
    if (this.ringGlows) this.ringGlows.forEach((g) => { g.visible = n === 0; });
    this.targetMeshes.forEach((m, i) => { m.visible = n === 1 && !this.targets[i].done; });
    if (n === 0) { this.ringIndex = 0; this.paintRings(); }
    if (n === 1) { this.bagsLeft = 3; this.targetIndex = 0; }
    this.say(MISSION_TITLES[n], 4);
  }

  paintRings() {
    this.ringMeshes.forEach((m, i) => {
      m.material.color.set(i < this.ringIndex ? COLORS.ringDone
        : i === this.ringIndex ? COLORS.ring : 0xb98a4a);
    });
  }

  say(text, seconds = 3) { this.message = text; this.messageT = seconds; }

  currentObjective() {
    if (this.sortie === 0 && this.ringIndex < this.rings.length) return this.rings[this.ringIndex];
    if (this.sortie === 1) {
      const t = this.targets.find((x) => !x.done);
      if (t) return t.pos;
    }
    if (this.sortie === 2) return new THREE.Vector3(RUNWAY.x, RUNWAY.height + 12, RUNWAY.z);
    return null;
  }

  objectiveLabel() {
    if (this.sortie === 0) return `Ring ${Math.min(this.ringIndex + 1, 9)} of 9`;
    if (this.sortie === 1) {
      const t = this.targets.find((x) => !x.done);
      return t ? `Drop: ${t.name} — bags ${this.bagsLeft}` : 'All mail delivered';
    }
    return 'Land on the runway at Kestrel Field';
  }

  // Release a mail bag from the plane (F key). Returns true if one went.
  dropBag(plane) {
    if (this.sortie !== 1 || this.bagsLeft <= 0) return false;
    const fwd = plane.forward();
    const bag = {
      pos: plane.pos.clone().add(new THREE.Vector3(0, -2, 0)),
      vel: fwd.multiplyScalar(plane.speed).add(new THREE.Vector3(0, plane.vy, 0)),
      landed: false,
    };
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.8, 1.4),
      new THREE.MeshLambertMaterial({ color: 0xc9a86a }));
    mesh.castShadow = true;
    mesh.position.copy(bag.pos);
    this.scene.add(mesh);
    this.bags.push(bag); this.bagMeshes.push(mesh);
    this.bagsLeft--;
    return true;
  }

  // Advance the mission state. events: from the aircraft step.
  // Returns a state word when a sortie ends: 'sortie-complete' | 'campaign-complete' | null.
  update(dt, plane, events, sound) {
    this.messageT = Math.max(0, this.messageT - dt);
    // Ring pulsing so the next gate shimmers.
    if (this.sortie === 0 && this.ringIndex < this.ringMeshes.length) {
      const m = this.ringMeshes[this.ringIndex];
      const s = 1 + Math.sin(performance.now() * 0.005) * 0.05;
      m.scale.setScalar(s);
    }
    // Ring threading.
    if (this.sortie === 0 && this.ringIndex < this.rings.length && !plane.onGround) {
      const c = this.rings[this.ringIndex];
      if (plane.pos.distanceTo(c) < RING_RADIUS + 3) {
        this.ringIndex++;
        const gained = 120;
        this.score += gained;
        sound.ringChime();
        this.paintRings();
        if (this.ringIndex >= this.rings.length) {
          this.say('Ring Run complete! The valley is yours.', 4);
          return 'sortie-complete';
        }
        this.say(`Ring ${this.ringIndex} threaded  +${gained}`, 2);
      }
    }
    // Falling mail bags.
    for (let i = 0; i < this.bags.length; i++) {
      const bag = this.bags[i];
      if (bag.landed) continue;
      bag.vel.y -= 22 * dt;
      bag.vel.multiplyScalar(1 - 0.12 * dt);
      bag.pos.addScaledVector(bag.vel, dt);
      this.bagMeshes[i].position.copy(bag.pos);
      const gy = heightAt(bag.pos.x, bag.pos.z) + 0.5;
      if (bag.pos.y <= gy) {
        bag.pos.y = gy; bag.landed = true;
        sound.dropThud();
        const t = this.targets.find((x) => !x.done);
        if (t && this.sortie === 1) {
          const d = Math.hypot(bag.pos.x - t.pos.x, bag.pos.z - t.pos.z);
          if (d < 46) {
            t.done = true;
            t.score = Math.max(40, Math.round(300 - d * 5.5));
            this.score += t.score;
            this.targetMeshes[this.targets.indexOf(t)].visible = false;
            this.say(`${t.name}: delivered at ${d.toFixed(0)} m  +${t.score}`, 3.5);
            if (this.targets.every((x) => x.done)) return 'sortie-complete';
          } else {
            this.say(`Bag down ${d.toFixed(0)} m from the pad — no score`, 3);
            if (this.bagsLeft <= 0 && !this.bags.some((b) => !b.landed)) {
              // Out of bags with pads unserved: the sortie ends short.
              if (this.targets.some((x) => !x.done)) return 'sortie-complete';
            }
          }
        }
      }
    }
    // The landing sortie is judged on the touchdown event.
    if (this.sortie === 2 && events.landed && !events.crashed) {
      if (events.landed.overRunway) {
        this.landingResult = scoreLanding(plane);
        this.score += this.landingResult.total;
        sound.fanfare();
        return 'campaign-complete';
      }
      this.say('That was not the runway — go around and try again.', 3.5);
    }
    if (events.crashed) return 'crashed';
    return null;
  }
}
