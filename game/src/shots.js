// shots.js — the ?shot= scenes used for the game's screenshots. Each one
// resets the world with the fixed seed, then steps the REAL simulation —
// the same aircraft step (wind included) and mission update the game
// loop runs — under a small autopilot aimed at the scene's objective,
// for a fixed number of fixed-length steps. The frame it stops on is a
// genuine composed moment of play (HUD lit, rings live, bag falling),
// and main.js then freezes it.

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

// One stepped second of shot time starts at this offset into the wind's
// cycle, so the scenes fly in the valley's typical evening flow rather
// than the calm at t = 0.
const SHOT_WIND_T0 = 40;

// Step the sim once, sampling the wind at the scene's own clock so the
// pose is reproducible to the frame.
function stepOnce(ctx, controls) {
  const { plane, missions, sound, wind } = ctx;
  ctx.shotT = (ctx.shotT || 0) + DT;
  if (wind) wind.sampleAt(SHOT_WIND_T0 + ctx.shotT);
  const events = plane.step(DT, controls, heightAt, wind || null);
  missions.update(DT, plane, events, sound);
  return events;
}

function stepN(ctx, n, controlFn) {
  for (let i = 0; i < n; i++) {
    stepOnce(ctx, controlFn(i));
    if (ctx.plane.crashed) break;
  }
}

export function shotName() {
  return new URLSearchParams(window.location.search).get('shot');
}

// Pose one named scene. Returns true when the name was a known shot.
export function poseShot(name, ctx) {
  const { plane, missions } = ctx;
  const { RUNWAY } = ctx.constants;
  if (name === 'cockpit') {
    missions.beginSortie(2);
    missions.score = 1240;
    if (ctx.rig) ctx.rig.mode = 'cockpit';
    // The cover: the takeoff roll at full throttle, from the pilot's
    // seat. Kestrel Field is a shelf carved into high ground, so an
    // approach shot dives off a cliff edge — but the roll is honest
    // geography: the strip runs ahead under the nose, the panel is
    // alive (ASI winding up, throttle lever full forward), and the
    // saddle hills frame the far threshold. No pitch input: the frame
    // freezes a breath before rotation, while the runway still fills
    // the windscreen — the moment rotation starts, the nose hides it.
    plane.placeAirborne(RUNWAY.x + 3, RUNWAY.height + 1.95, RUNWAY.z - 160, Math.PI, 23);
    plane.throttle = 1;
    // v3: let the roll run long — 150 steps at full throttle winds the
    // ASI up to ~SPD 078 (the ground-roll model's terminal is ~40 m/s)
    // so the panel reads FLOWN, a breath from rotation, instead of
    // parked at 46 kt. Still no pitch input: the runway stays framed.
    stepN(ctx, 150, () => ({ pitch: 0, roll: 0, throttleDelta: 0, brake: false }));
    return true;
  }
  if (name === 'rings') {
    missions.beginSortie(0);
    // v3: tighten the lens (62° → 54°) so the Kestrel fills clearly
    // more of the frame at contact-sheet size; the nested-rings
    // composition is unchanged. (48° was tried first and cropped
    // both plane and ring — 54° is the widest tightening that keeps
    // the ring whole.)
    if (ctx.rig && ctx.rig.camera) {
      ctx.rig.camera.fov = 54;
      ctx.rig.camera.updateProjectionMatrix();
    }
    // Two rings already threaded, the third dead ahead down the valley.
    missions.ringIndex = 2; missions.score = 240; missions.paintRings();
    const ring = missions.rings[2];
    const start = ring.clone(); start.z += 210; start.y += 16; start.x += 18;
    const heading = Math.atan2(ring.x - start.x, -(ring.z - start.z));
    plane.placeAirborne(start.x, start.y, start.z, heading, 33);
    // Fly the real sim until the plane is ~50 m out — the ring large in
    // the centre of the frame but whole, its halo a hint instead of a
    // wash, the Kestrel big in the lower-centre foreground.
    for (let i = 0; i < 260; i++) {
      const controls = autopilot(plane, ring, 0.66);
      stepOnce(ctx, controls);
      if (plane.crashed) break;
      if (plane.pos.distanceTo(ring) < 50) break;
    }
    return true;
  }
  if (name === 'drop') {
    missions.beginSortie(1);
    // v3: same tighter lens as the rings scene — plane and falling
    // bag both read bigger in the small contact-sheet cell.
    if (ctx.rig && ctx.rig.camera) {
      ctx.rig.camera.fov = 48;
      ctx.rig.camera.updateProjectionMatrix();
    }
    const t = missions.targets[0];
    // A low run-in (+38 m start, aiming +28 m over the pad) so the
    // village houses and pad read big in the lower frame, still well
    // above the rooftops on the approach.
    const start = t.pos.clone(); start.z += 330; start.x -= 40; start.y += 38;
    const heading = Math.atan2(t.pos.x - start.x, -(t.pos.z - start.z));
    plane.placeAirborne(start.x, start.y, start.z, heading, 29);
    // Fly the real sim in, release the bag over the pad, then freeze
    // just 12 steps (~0.4 s) later — v3: the bag is still close under
    // the plane and LARGE in frame, the pad still below, and the
    // objective line up top already reads "bags 2". (No centre-screen
    // message: main.js deliberately clears missions.message in shot
    // mode, so the falling bag itself tells the story.)
    let dropped = false;
    let sinceDrop = 0;
    for (let i = 0; i < 420; i++) {
      const aim = t.pos.clone(); aim.y += 28;
      const controls = autopilot(plane, aim, 0.5);
      const d = Math.hypot(plane.pos.x - t.pos.x, plane.pos.z - t.pos.z);
      if (!dropped && d < 55) { missions.dropBag(plane); dropped = true; }
      stepOnce(ctx, controls);
      if (plane.crashed) break;
      if (dropped && ++sinceDrop >= 12) break;
    }
    return true;
  }
  if (name === 'landing') {
    missions.beginSortie(2);
    missions.score = 1240;
    // Short final, southbound: the autopilot flies her down the last
    // hundred metres to a touchdown point a third along the strip —
    // gear down, sink on, the whole valley opening beyond the far
    // threshold, instead of the old frame that dived at the northern
    // rim wall. (Hand-holding the nose up balloons her into a climb
    // in this flight model; the honest flare lives in the touchdown
    // the sim is about to make, not in a posed pitch.)
    const start = new THREE.Vector3(RUNWAY.x - 4, RUNWAY.height + 16, RUNWAY.z - 120);
    plane.placeAirborne(start.x, start.y, start.z, Math.PI, 24);
    const aim = new THREE.Vector3(RUNWAY.x, RUNWAY.height + 1, RUNWAY.z + 60);
    stepN(ctx, 26, () => autopilot(plane, aim, 0.25));
    return true;
  }
  return false;
}
