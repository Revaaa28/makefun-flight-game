// aircraft.js — the Kestrel K-1: a cream-and-red high-wing prop plane built
// from primitives, and the lift-and-stall flight model that flies it.
// The model is deliberately honest: below the stall speed the wing lets go,
// banking bleeds height, and the ground is judged by sink rate and speed —
// a gentle arrival is a landing, a hard one is a crash.

import { FLIGHT, RUNWAY, COLORS } from './config.js';
import { heightAt } from './terrain.js';

function mat(color) { return new THREE.MeshLambertMaterial({ color }); }
function part(geo, color, x, y, z) {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z); m.castShadow = true;
  return m;
}

export function buildKestrel() {
  const g = new THREE.Group();
  const cream = COLORS.fuselage, red = COLORS.trim;
  // Fuselage: a slimmer tapered box body plus a rounded nose. The body
  // is narrower than before and the tail cone tapers much harder (0.62
  // at the body down to 0.16 at the tail) and runs longer, so from
  // behind the fuselage reads as a tapering shape, not a slab.
  const body = part(new THREE.BoxGeometry(1.4, 1.45, 7.6), cream, 0, 0, 0.4); g.add(body);
  const nose = part(new THREE.CylinderGeometry(0.7, 0.74, 1.6, 10), red, 0, 0, -3.9);
  nose.rotation.x = Math.PI / 2; g.add(nose);
  const tailCone = part(new THREE.CylinderGeometry(0.16, 0.62, 3.8, 8), cream, 0, 0.3, 5.5);
  tailCone.rotation.x = Math.PI / 2; g.add(tailCone);
  // Livery: a red cheatline swept down each side of the fuselage, a
  // matching band around the tail cone, and a thin gold pinstripe under
  // it — paint is what turns a cream box into an aeroplane with an owner.
  for (const s of [-1, 1]) {
    const cheat = part(new THREE.BoxGeometry(0.04, 0.34, 6.9), red, s * 0.72, 0.12, 0.55);
    cheat.rotation.x = 0.035; g.add(cheat);
    const pin = part(new THREE.BoxGeometry(0.04, 0.09, 6.9), 0xd9a441, s * 0.72, -0.12, 0.55);
    pin.rotation.x = 0.035; g.add(pin);
    const tailBand = part(new THREE.BoxGeometry(0.04, 0.5, 0.9), red, s * 0.47, 0.34, 4.6);
    tailBand.rotation.x = 0.1; g.add(tailBand);
  }
  // Cabin glass: lower-profile (0.5 tall, sunk into the body), now a
  // dark glossy tint — Phong with a bright sky specular, so the canopy
  // throws a highlight like real perspex instead of reading as paint.
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.5, 2.0),
    new THREE.MeshPhongMaterial({ color: 0x18242f, specular: 0xbfd9ee, shininess: 90 }));
  glass.position.set(0, 0.82, -0.7); glass.castShadow = true; g.add(glass);
  // High wing with red tips and visible taper + dihedral via two
  // panels per side: a wide-chord inner panel and a narrower-chord,
  // thinner outer panel set higher, so the wing steps down in chord
  // toward the tip instead of reading as one flat tabletop. The wing
  // pieces ride in one subgroup so the cockpit camera can hide them:
  // from the pilot's seat of a high-wing ship the wing sits above and
  // behind the pilot's head, never across the instrument panel.
  const wingGroup = new THREE.Group();
  g.add(wingGroup);
  g.userData.wing = wingGroup;
  for (const s of [-1, 1]) {
    const wing = part(new THREE.BoxGeometry(3.4, 0.18, 1.9), cream, s * 1.95, 1.15, -0.6);
    wing.rotation.z = s * 0.07; wingGroup.add(wing);
    const outer = part(new THREE.BoxGeometry(2.6, 0.13, 1.35), cream, s * 4.85, 1.42, -0.6);
    outer.rotation.z = s * 0.11; wingGroup.add(outer);
    const tip = part(new THREE.BoxGeometry(0.8, 0.15, 1.3), red, s * 6.35, 1.62, -0.6); wingGroup.add(tip);
    const strut = part(new THREE.BoxGeometry(0.12, 1.3, 0.12), red, s * 1.15, 0.45, -0.6);
    strut.rotation.z = s * 0.5; wingGroup.add(strut);
  }
  // Tail feathers. The fin is smaller and thinner than the old solid
  // red wedge, cream like the fuselage, with just a red tip cap.
  const hstab = part(new THREE.BoxGeometry(3.4, 0.13, 1.1), cream, 0, 0.6, 6.9); g.add(hstab);
  const fin = part(new THREE.BoxGeometry(0.1, 1.25, 1.15), cream, 0, 1.05, 6.9); g.add(fin);
  const finTip = part(new THREE.BoxGeometry(0.11, 0.32, 1.0), red, 0, 1.78, 6.9); g.add(finTip);
  // Fixed gear with cream spats.
  for (const s of [-1, 1]) {
    const leg = part(new THREE.BoxGeometry(0.16, 1.1, 0.16), 0x555555, s * 0.85, -1.15, -1.6); g.add(leg);
    const wheel = part(new THREE.CylinderGeometry(0.52, 0.52, 0.34, 10), 0x222222, s * 0.85, -1.75, -1.6);
    wheel.rotation.z = Math.PI / 2; g.add(wheel);
    const spat = part(new THREE.BoxGeometry(0.5, 0.55, 1.3), cream, s * 0.85, -1.62, -1.6); g.add(spat);
  }
  const tailWheel = part(new THREE.CylinderGeometry(0.26, 0.26, 0.2, 8), 0x222222, 0, -0.55, 6.4);
  tailWheel.rotation.z = Math.PI / 2; g.add(tailWheel);
  // Small fittings a real airframe carries, each one a glint in a photo:
  // wingtip navigation lights (port red, starboard green, steady so they
  // read in a still), a white tail light, a red beacon on the fin,
  // a cabin-top antenna mast with its wire run to the fin, a pitot tube
  // under the port wing and a stub exhaust on the nose's right cheek.
  const lamp = (color, x, y, z, r = 0.13) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 8, 8),
      new THREE.MeshBasicMaterial({ color }));
    m.position.set(x, y, z); g.add(m); return m;
  };
  const navPort = lamp(0xff2a1a, -6.78, 1.62, -0.6);   // port
  wingGroup.add(navPort);
  const navStbd = lamp(0x2aff5a, 6.78, 1.62, -0.6);    // starboard
  wingGroup.add(navStbd);
  lamp(0xfff6dd, 0, 0.62, 7.55, 0.1);         // tail
  lamp(0xff3524, 0, 1.98, 6.9, 0.09);         // fin beacon
  const mast = part(new THREE.CylinderGeometry(0.035, 0.05, 0.55, 6), 0x333333, 0, 1.32, -0.5); g.add(mast);
  const wire = part(new THREE.BoxGeometry(0.02, 0.02, 7.3), 0x222222, 0, 1.85, 3.1);
  wire.rotation.x = 0.075; g.add(wire);
  const pitot = part(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 6), 0x999999, -3.4, 0.95, -1.15);
  pitot.rotation.x = Math.PI / 2; g.add(pitot);
  const exhaust = part(new THREE.CylinderGeometry(0.09, 0.11, 0.55, 6), 0x4a3a30, 0.62, -0.42, -3.6);
  exhaust.rotation.x = Math.PI / 2 - 0.35; g.add(exhaust);
  const lander = part(new THREE.CircleGeometry(0.16, 10), 0xfff2c0, -2.6, 1.13, -1.56);
  lander.rotation.y = Math.PI;               // face the lamp forward, down the nose line
  g.add(lander);
  // The propeller: two blades and a spinner, spun by the engine in update.
  const prop = new THREE.Group();
  const blade = part(new THREE.BoxGeometry(0.28, 3.4, 0.08), 0x3a2e24, 0, 0, 0); prop.add(blade);
  const spinner = part(new THREE.ConeGeometry(0.34, 0.8, 8), red, 0, 0, -0.3);
  spinner.rotation.x = -Math.PI / 2; prop.add(spinner);
  // The blur disc a running prop actually shows: a faint dark glass of
  // a circle at the blade plane, so a still of the Kestrel under power
  // reads as an engine turning, not a parked cross.
  const blur = new THREE.Mesh(new THREE.CircleGeometry(1.72, 28),
    new THREE.MeshBasicMaterial({
      color: 0x35302a, transparent: true, opacity: 0.16,
      side: THREE.DoubleSide, depthWrite: false,
    }));
  blur.position.z = 0.03; prop.add(blur);
  prop.position.set(0, 0, -4.85);
  g.add(prop);
  g.userData.prop = prop;
  return g;
}

export class Aircraft {
  constructor(scene) {
    this.mesh = buildKestrel();
    scene.add(this.mesh);
    this.resetToRunway();
  }

  resetToRunway() {
    this.pos = new THREE.Vector3(RUNWAY.x, RUNWAY.height + 1.95, RUNWAY.z + RUNWAY.length / 2 - 30);
    this.heading = 0;               // facing -z, down the strip
    this.pitch = 0; this.roll = 0;
    this.speed = 0;
    this.vy = 0;
    this.throttle = 0;
    this.fuel = FLIGHT.fuelStart;
    this.damage = 0;
    this.onGround = true;
    this.crashed = false;
    this.stalled = false;
    this.touchdown = null;          // filled in by step() on the landing frame
    this.wasAirborne = false;
    this.syncMesh();
  }

  // Place the plane mid-air for a sortie start or a shot scene.
  placeAirborne(x, y, z, heading, speed) {
    this.pos.set(x, y, z);
    this.heading = heading; this.pitch = 0; this.roll = 0;
    this.speed = speed; this.vy = 0;
    this.throttle = 0.62;
    this.onGround = false; this.wasAirborne = true;
    this.crashed = false; this.touchdown = null;
    this.syncMesh();
  }

  forward() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(
      Math.sin(this.heading) * cp, Math.sin(this.pitch), -Math.cos(this.heading) * cp);
  }

  // One physics step. controls: {pitch, roll, throttleDelta, brake} in -1..1.
  // wind, when given, is a sampled Wind: the air mass itself moves, so a
  // headwind lifts the wing before the ground says you are fast, a
  // tailwind steals that lift, a crosswind drifts the airframe sideways
  // over the ground, and gusts worry the roll a little.
  // Returns events that happened this step: {landed, crashed}.
  step(dt, controls, terrainFn = heightAt, wind = null) {
    const events = {};
    if (this.crashed) return events;
    // Throttle and fuel.
    this.throttle = Math.max(0, Math.min(1, this.throttle + controls.throttleDelta * dt));
    const burn = this.throttle > 0.85
      ? FLIGHT.fuelBurnFull
      : FLIGHT.fuelBurnCruise * (0.35 + this.throttle);
    this.fuel = Math.max(0, this.fuel - burn * dt);
    if (this.fuel <= 0) this.throttle = Math.max(0, this.throttle - dt * 0.5); // engine starves
    const groundY = terrainFn(this.pos.x, this.pos.z) + 1.95;
    this.onGround = this.pos.y <= groundY + 0.05 && this.vy <= 0.5;

    if (this.onGround) {
      this.pos.y = groundY;
      // On the ground the wing already feels the wind: a headwind lets
      // her rotate early, a tailwind keeps her rolling.
      const groundAir = wind ? this.speed + wind.components(this.heading).head : this.speed;
      // Ground roll: thrust accelerates, drag and brakes slow.
      const thrust = this.throttle * FLIGHT.accel;
      this.speed += (thrust - FLIGHT.drag * this.speed * this.speed) * dt;
      if (controls.brake) this.speed -= FLIGHT.brakeDecel * dt;
      this.speed -= this.speed * FLIGHT.groundFriction * dt * 0.35;
      this.speed = Math.max(0, this.speed);
      // Steering on the ground comes from the roll keys (rudder pedals):
      // positive roll steers right, and heading grows toward the east.
      this.heading += controls.roll * dt * Math.min(0.5, this.speed / 40);
      this.roll *= Math.pow(0.0001, dt);
      // Pitch: only able to rotate once fast enough.
      if (controls.pitch > 0 && groundAir > FLIGHT.rotateSpeed) {
        this.pitch = Math.min(0.22, this.pitch + controls.pitch * FLIGHT.maxPitchRate * dt);
      } else {
        this.pitch = Math.max(0, this.pitch - dt * 1.4);
      }
      this.vy = 0;
      if (this.pitch > 0.03 && groundAir > FLIGHT.rotateSpeed) {
        // Liftoff: give the plane a real climb and a step off the surface,
        // so the ground check at the top of the next step cannot mistake
        // it for still rolling (vy 0 at ground height reads as landed).
        this.onGround = false; this.wasAirborne = true;
        this.vy = 2.6;
        this.pos.y = groundY + 0.35;
      }
    } else {
      // Attitude: pitch and roll chase the pilot's inputs.
      this.pitch += controls.pitch * FLIGHT.maxPitchRate * dt;
      this.pitch = Math.max(-0.65, Math.min(0.6, this.pitch));
      // The nose settles toward level when hands-off.
      this.pitch -= this.pitch * dt * 0.35;
      const targetRoll = controls.roll * 1.05;
      this.roll += (targetRoll - this.roll) * Math.min(1, dt * 5.5);
      // Gusts worry the roll: a slow worry, phased by where the plane is,
      // so crossing the valley in rough air is a small fight for level.
      if (wind) {
        this.roll += wind.turbulence()
          * Math.sin(this.pos.x * 0.045 + this.pos.z * 0.03) * dt * 0.5;
      }
      // Bank turns the plane; turn rate grows with speed up to cruise.
      // Sign check: banking right (roll > 0) must swing the nose toward
      // +x when facing north, and forward.x is sin(heading) — so heading
      // grows with positive roll.
      this.heading += Math.sin(this.roll) * FLIGHT.turnPerRoll * dt * Math.min(1, this.speed / 30);
      // Speed: thrust against drag, plus gravity trading height for speed.
      const thrust = this.throttle * FLIGHT.accel;
      this.speed += (thrust - FLIGHT.drag * this.speed * this.speed - Math.sin(this.pitch) * 11) * dt;
      this.speed = Math.max(0, this.speed);
      // Lift: full at and above the stall speed, fading below it. The
      // wing feels AIRspeed — ground speed plus the headwind part — so a
      // stiff headwind holds her up at a crawl over the ground and a
      // tailwind drops her sooner than the dial suggests.
      const airSpeed = wind
        ? Math.max(0, this.speed + wind.components(this.heading).head)
        : this.speed;
      const lift = Math.min(1, airSpeed / FLIGHT.stallSpeed);
      this.stalled = lift < 0.999;
      const fwd = this.forward();
      const climb = fwd.y * airSpeed * (0.35 + 0.65 * lift);
      const stallSink = (1 - lift) * FLIGHT.gravitySink;
      const bankSink = (1 - Math.cos(this.roll)) * this.speed * 0.22;
      this.vy = climb - stallSink - bankSink;
      // Travel along the nose for the horizontal path, but let vy — which
      // already folds in lift, stall sink and bank sink — own the height.
      this.pos.x += fwd.x * this.speed * dt;
      this.pos.z += fwd.z * this.speed * dt;
      this.pos.y += this.vy * dt;
      // The air mass itself moves over the ground: the wind drifts her.
      if (wind) {
        this.pos.x += wind.vec.x * dt;
        this.pos.z += wind.vec.z * dt;
      }
    }

    if (!this.onGround) {
      // Terrain contact while airborne: judge the arrival.
      const gy = terrainFn(this.pos.x, this.pos.z) + 1.95;
      if (this.pos.y <= gy) {
        this.pos.y = gy;
        const sink = -this.vy;
        const overRunway = Math.abs(this.pos.x - RUNWAY.x) <= RUNWAY.width / 2 + 3 &&
          Math.abs(this.pos.z - RUNWAY.z) <= RUNWAY.length / 2;
        events.landed = { sink, speed: this.speed, overRunway };
        this.touchdown = events.landed;
        if (sink > 7.5 || this.speed > 46 || !overRunway && sink > 4.5) {
          this.crashed = true; this.damage = 100;
          events.crashed = true;
        } else {
          if (sink > 4.5) this.damage = Math.min(85, this.damage + (sink - 4.5) * 16);
          this.onGround = true; this.vy = 0;
          this.pitch = Math.max(0, this.pitch);
        }
      }
    }
    // Keep the plane inside the world.
    const lim = 2050;
    this.pos.x = Math.max(-lim, Math.min(lim, this.pos.x));
    this.pos.z = Math.max(-lim, Math.min(lim, this.pos.z));
    if (this.pos.y > 620) this.pos.y = 620;
    this.syncMesh();
    return events;
  }

  syncMesh() {
    this.mesh.position.copy(this.pos);
    this.mesh.rotation.set(0, 0, 0);
    this.mesh.rotateY(-this.heading);
    this.mesh.rotateX(-this.pitch);
    // The model faces -z, so a positive (right) bank is a negative z-turn.
    this.mesh.rotateZ(-this.roll);
    const prop = this.mesh.userData.prop;
    if (prop) prop.rotation.z += (2 + this.throttle * 55) * 0.35;
  }

  // Compass heading in degrees, 0 = north (-z), clockwise.
  headingDeg() {
    let d = THREE.MathUtils.radToDeg(Math.atan2(
      Math.sin(this.heading), Math.cos(this.heading)));
    d = (d + 360) % 360;
    return d;
  }
}
