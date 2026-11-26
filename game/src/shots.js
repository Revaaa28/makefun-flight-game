// shots.js — the ?shot= scenes used for the game's screenshots. Each one
// resets the world with the fixed seed, then steps the REAL simulation —
// the same aircraft step and mission update the game loop runs — under a
// small autopilot aimed at the scene's objective, for a fixed number of
// fixed-length steps. The frame it stops on is a genuine composed moment
// of play (HUD lit, rings live, bag falling), and main.js then freezes it.

import { heightAt } from './terrain.js';

const DT = 1 / 30;

function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

// Autopilot: bank toward the target, pitch for its altitude, hold a
// throttle setting. Returns a controls object in the flight model's terms.
export function autopilot(plane, target, throttle) {
  const dx = target.x - plane.pos.x, dz = target.z - plane.pos.z;
  const dy = target.y - plane.pos.y;
  const dist = Math.max(20, Math.hypot(dx, dz));
  const desiredHeading = Math.atan2(dx, -dz);
  const dh = wrapAngle(desiredHeading - plane.heading);
  const roll = clamp(dh * 1.35, -0.85, 0.85);
  const desiredPitch = clamp(Math.atan2(dy, dist), -0.32, 0.34);
  const pitch = clamp((desiredPitch - plane.pitch) * 3.0, -1, 1);
  plane.throttle = throttle;
  return { pitch, roll, throttleDelta: 0, brake: false };
}

function stepN(ctx, n, controlFn) {
  const { plane, missions, sound } = ctx;
  for (let i = 0; i < n; i++) {
    const controls = controlFn(i);
    const events = plane.step(DT, controls);
    missions.update(DT, plane, events, sound);
    if (plane.crashed) break;
  }
}

export function shotName() {
  return new URLSearchParams(window.location.search).get('shot');
}

// Pose one named scene. Returns true when the name was a known shot.
export function poseShot(name, ctx) {
  const { plane, missions } = ctx;
  const { RUNWAY } = ctx.constants;
  if (name === 'takeoff') {
    missions.beginSortie(0);
    plane.resetToRunway();
    plane.throttle = 1;
    // Freeze ON the moment, not long after it: roll at full throttle,
    // and stop ~1 s after liftoff while the Kestrel is still LOW over
    // the strip, runway visible behind/below in the chase frame.
    let airborneSteps = 0;
    for (let i = 0; i < 240 && airborneSteps < 30; i++) {
      const wasAirborne = plane.wasAirborne && !plane.onGround;
      const events = plane.step(DT, {
        pitch: plane.speed > 20 ? 0.65 : 0, roll: 0, throttleDelta: 0, brake: false,
      });
      missions.update(DT, plane, events, ctx.sound);
      if (wasAirborne || (!plane.onGround && plane.wasAirborne)) airborneSteps++;
      if (plane.crashed) break;
    }
    return true;
  }
  if (name === 'rings') {
    missions.beginSortie(0);
    // Two rings already threaded, the third dead ahead down the valley.
    missions.ringIndex = 2; missions.score = 240; missions.paintRings();
    const ring = missions.rings[2];
    const start = ring.clone(); start.z += 210; start.y += 16; start.x += 26;
    const heading = Math.atan2(ring.x - start.x, -(ring.z - start.z));
    plane.placeAirborne(start.x, start.y, start.z, heading, 33);
    // Fly the real sim until the plane is ~35 m out — about a second
    // from threading it — so the ring hangs LARGE in the centre of the
    // frame with the Kestrel big in the lower-centre foreground.
    for (let i = 0; i < 260; i++) {
      const controls = autopilot(plane, ring, 0.66);
      const events = plane.step(DT, controls);
      missions.update(DT, plane, events, ctx.sound);
      if (plane.crashed) break;
      if (plane.pos.distanceTo(ring) < 36) break;
    }
    return true;
  }
  if (name === 'drop') {
    missions.beginSortie(1);
    const t = missions.targets[0];
    // Lower run-in than before (+38 m start, aiming +28 m over the pad
    // instead of +58/+52) so the village houses and pad read bigger in
    // the lower frame. Still well above the rooftops/terrain on the
    // approach, and the release trigger (horizontal distance only) is
    // unchanged.
    const start = t.pos.clone(); start.z += 330; start.x -= 40; start.y += 38;
    const heading = Math.atan2(t.pos.x - start.x, -(t.pos.z - start.z));
    plane.placeAirborne(start.x, start.y, start.z, heading, 29);
    // Fly the real sim in, release the bag over the pad, then freeze
    // ~25 steps (~0.8 s) later: plane large in frame, the bag visibly
    // HANGING below the plane, the village pad still in frame below.
    let dropped = false;
    let sinceDrop = 0;
    for (let i = 0; i < 420; i++) {
      const aim = t.pos.clone(); aim.y += 28;
      const controls = autopilot(plane, aim, 0.5);
      const d = Math.hypot(plane.pos.x - t.pos.x, plane.pos.z - t.pos.z);
      if (!dropped && d < 55) { missions.dropBag(plane); dropped = true; }
      const events = plane.step(DT, controls);
      missions.update(DT, plane, events, ctx.sound);
      if (plane.crashed) break;
      if (dropped && ++sinceDrop >= 25) break;
    }
    return true;
  }
  if (name === 'landing') {
    missions.beginSortie(2);
    missions.score = 1240;
    // Composed SHORT FINAL, computed from the runway's actual
    // constants (config.js / terrain.js): RUNWAY.x is the centreline,
    // RUNWAY.z is the strip's centre, RUNWAY.length runs along z and
    // heading 0 flies toward -z, so the approach threshold is the
    // SOUTH end, thresholdZ = RUNWAY.z + RUNWAY.length / 2
    // (= -1650 + 170 = -1480). Place the Kestrel ON that centreline
    // ~120 m short of the threshold, at approach speed, then freeze
    // EARLY — 36 steps at DT = 1/30 is ~1.2 s, ~29 m of travel at
    // 24 m/s — while it is still airborne on final, ~90 m short, with
    // the runway filling the lower frame. Freezing this early
    // guarantees no touchdown / landing logic can trigger first
    // (the previous 240 m / 36 m / 90-step pose ended ON THE GROUND
    // off-runway on grass).
    // The start altitude MUST come from the terrain itself, not from
    // RUNWAY.height: the placement point sits beyond the runway
    // plateau's feathered edge, where the analytic terrain height is
    // much higher than the plateau constant — starting from that
    // constant put the plane BELOW the terrain surface, so the sim
    // grounded it instantly on grass.
    const thresholdZ = RUNWAY.z + RUNWAY.length / 2;
    const placedX = RUNWAY.x;
    const placedZ = thresholdZ + 120;
    const start = new THREE.Vector3(placedX, heightAt(placedX, placedZ) + 22, placedZ);
    plane.placeAirborne(start.x, start.y, start.z, 0, 24);
    plane.throttle = 0.3;
    const aim = new THREE.Vector3(RUNWAY.x, RUNWAY.height + 1, thresholdZ - 60);
    stepN(ctx, 36, () => autopilot(plane, aim, 0.3));
    return true;
  }
  return false;
}
