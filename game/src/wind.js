// wind.js — the valley's evening wind, one system the whole game reads:
// a prevailing flow out of the west-southwest that veers slowly, with a
// gust swell riding on it. The flight model takes the vector from here,
// the HUD reads out its direction and strength, and the cockpit's job is
// easier when the pilot minds it on final.
//
// The wind is a pure function of sim time — no state, no randomness — so
// a replayed second always blows the same, and the shot scenes can pose
// against exactly the wind the player would meet.

import { WIND } from './config.js';

function degToRad(d) { return d * Math.PI / 180; }

export class Wind {
  constructor() {
    // The vector the wind blows TOWARD, in world metres per second:
    // +x east, +z south. Filled by sampleAt().
    this.vec = new THREE.Vector3(WIND.baseSpeed, 0, 0);
    this.speed = WIND.baseSpeed;      // m/s, gusts included
    this.fromDeg = WIND.homeDeg;      // compass direction it blows FROM
    this.gust = 0;                     // the gust part alone, m/s
  }

  // Sample the wind at sim time t (seconds). Returns this, for chaining.
  sampleAt(t) {
    const veer = Math.sin(t * WIND.veerFreq) * WIND.veerDeg
      + Math.sin(t * WIND.veerFreq * 2.7 + 1.7) * WIND.veerDeg * 0.3;
    this.fromDeg = (WIND.homeDeg + veer + 360) % 360;
    // Gusts: two swells beating against each other, floored at zero so
    // the flow lulls instead of reversing.
    const swell = Math.sin(t * WIND.gustFreq) * 0.6
      + Math.sin(t * WIND.gustFreq * 2.33 + 0.9) * 0.4;
    this.gust = Math.max(0, swell) * WIND.gustAmp;
    this.speed = WIND.baseSpeed + this.gust;
    // FROM compass to a TOWARD vector: a wind from 255 deg blows toward
    // 75 deg; compass bearings run clockwise from north (-z).
    const toward = degToRad(this.fromDeg + 180);
    this.vec.set(Math.sin(toward) * this.speed, 0, -Math.cos(toward) * this.speed);
    return this;
  }

  // Knots, for the HUD readout.
  speedKt() { return this.speed * 1.944; }

  // The parts of the wind a pilot feels, against a heading: headwind
  // positive when the flow meets the nose, crosswind positive when it
  // pushes toward the plane's right.
  components(heading) {
    const fx = Math.sin(heading), fz = -Math.cos(heading);   // nose direction
    const rx = Math.cos(heading), rz = Math.sin(heading);    // right direction
    const head = -(this.vec.x * fx + this.vec.z * fz);
    const cross = this.vec.x * rx + this.vec.z * rz;
    return { head, cross };
  }

  // Where the wind comes FROM, relative to the nose, in degrees:
  // 0 = on the nose, +90 = from the right, 180 = a tailwind. The HUD
  // draws its little arrow from this.
  relativeDeg(headingDeg) {
    let rel = this.fromDeg - headingDeg;
    while (rel > 180) rel -= 360;
    while (rel < -180) rel += 360;
    return rel;
  }

  // How rough the air is right now, 0..1: the gust part against the
  // whole flow. The flight model rolls the plane a little with it, so a
  // gusty evening feels different from a calm one in the hands.
  turbulence() {
    return this.speed > 0 ? this.gust / this.speed : 0;
  }
}
