// main.js — boot and the game loop. Builds the renderer, the golden-hour
// sky and light, wires terrain + aircraft + missions + camera + HUD +
// screens together, and runs the state machine:
//   title -> briefing -> flying -> sortie-complete -> ... -> campaign
// Shot mode (?shot=...) poses one frozen scene instead of starting play.

import { WORLD, COLORS, RUNWAY } from './config.js';
import { Terrain, heightAt } from './terrain.js';
import { Aircraft } from './aircraft.js';
import { Missions } from './missions.js';
import { CameraRig, applyShotCamera } from './camera.js';
import { Input } from './input.js';
import { SoundEngine } from './audio.js';
import { Hud } from './hud.js';
import { Screens } from './screens.js';
import { Wind } from './wind.js';
import { shotName, poseShot } from './shots.js';

const canvas3d = document.getElementById('view');
const canvasHud = document.getElementById('hud');
const renderer = new THREE.WebGLRenderer({ canvas: canvas3d, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(COLORS.fog, WORLD.fogNear, WORLD.fogFar);
const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 9000);

// Sky dome: a big sphere with vertex colours — dusty blue up top melting
// into the warm band of the golden hour at the horizon.
{
  const geo = new THREE.SphereGeometry(4200, 24, 14);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(0x51689c), mid = new THREE.Color(COLORS.sky), low = new THREE.Color(COLORS.skyLow);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(0, Math.min(1, pos.getY(i) / 4200 + 0.12));
    if (t < 0.35) c.copy(low).lerp(mid, t / 0.35);
    else c.copy(mid).lerp(top, (t - 0.35) / 0.65);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sky = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false }));
  scene.add(sky);
  // The low sun itself: a bright disc hanging over the western ridge.
  const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(150, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff0bc, fog: false }));
  sunDisc.position.set(-3300, 620, -1400);
  sunDisc.lookAt(0, 300, 0);
  scene.add(sunDisc);
}

// Light: a warm low sun with shadows, a brighter sky fill than the
// first cut (the valley read murky in stills), and amber ambience.
const sun = new THREE.DirectionalLight(COLORS.sun, 1.3);
sun.position.set(-900, 620, -420);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -950; sun.shadow.camera.right = 950;
sun.shadow.camera.top = 950; sun.shadow.camera.bottom = -950;
sun.shadow.camera.far = 4200;
sun.shadow.bias = -0.0006;
scene.add(sun); scene.add(sun.target);
scene.add(new THREE.HemisphereLight(0xffd9b0, 0x4a3826, 0.52));
scene.add(new THREE.AmbientLight(0xff9a50, 0.13));

// A handful of flat golden clouds, drifting very slowly.
const clouds = new THREE.Group();
{
  const mat = new THREE.MeshLambertMaterial({ color: 0xffe3c2, transparent: true, opacity: 0.85 });
  const puff = new THREE.SphereGeometry(1, 7, 6);
  const spots = [[-700, 260, -900], [500, 300, -300], [100, 240, 800], [-300, 285, 1500], [900, 265, 1100]];
  for (const [x, y, z] of spots) {
    const cl = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(puff, mat);
      m.position.set(i * 26 - 40, (i % 2) * 6, (i % 3) * 10);
      m.scale.set(30 + (i % 3) * 12, 7.5, 16);
      cl.add(m);
    }
    cl.position.set(x, y, z);
    clouds.add(cl);
  }
  scene.add(clouds);
}

const terrain = new Terrain(scene);
const plane = new Aircraft(scene);
const missions = new Missions(scene);
const wind = new Wind();
const rig = new CameraRig(scene, camera);
const input = new Input(canvas3d);
const sound = new SoundEngine();
const hud = new Hud(canvasHud);
const screens = new Screens(hud);

let mode = 'title';            // title | briefing | flying | sortie-complete | crashed | campaign-complete
let frozen = false;            // shot mode: pose once, render forever
const shot = shotName();

// Heading-only shot camera params for the landing-flare scene, whose
// pitch would otherwise swing the chase camera into the plane. The
// cockpit, rings and drop scenes keep the normal rigs.
const SHOT_CAMERA_PARAMS = {
  landing: { dist: 16, height: 5.5, side: 4 },
};

const HINTS = [
  'Shift throttle up · Arrows/WASD fly · C camera',
  'F releases a mail bag over the pad · C camera',
  'Space is the wheel brake · land in the zone, sink gently',
];

function startSortie(n) {
  missions.beginSortie(n);
  plane.fuel = 100;
  plane.damage = 0;
  plane.crashed = false;
  if (n === 2) {
    // Home for supper starts airborne over the valley, nose pointed home.
    const x = 60, z = -350;
    plane.placeAirborne(x, heightAt(x, z) + 95, z, Math.atan2(RUNWAY.x - x, -(RUNWAY.z - z)), 34);
  } else {
    plane.resetToRunway();
  }
  mode = 'briefing';
}

function onEnter() {
  sound.start();
  if (mode === 'title') startSortie(0);
  else if (mode === 'briefing') mode = 'flying';
  else if (mode === 'sortie-complete') startSortie(missions.sortie + 1);
  else if (mode === 'crashed') startSortie(missions.sortie);
  else if (mode === 'campaign-complete') { missions.score = 0; startSortie(0); }
}

if (shot) {
  const ok = poseShot(shot, { plane, missions, sound, wind, rig, constants: { RUNWAY } });
  if (ok) {
    mode = 'flying'; frozen = true;
    // Shot mode only: suppress the big centre-screen sortie title card
    // (the missions message, e.g. "Sortie 3 — Home for Supper", drawn
    // by the HUD at centre screen) so it does not draw over the posed
    // action. The HUD top banner and all instruments are drawn from
    // other state and stay untouched.
    missions.messageT = 0;
    missions.message = '';
  }
}

let last = performance.now();
let stallBeep = 0;
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t = now / 1000;

  if (!frozen) {
    wind.sampleAt(t);
    if (input.justPressed('Enter')) onEnter();
    if (input.justPressed('KeyC')) rig.toggle();
    if (mode === 'flying') {
      if (input.justPressed('KeyF') && missions.dropBag(plane)) sound.dropThud();
      const controls = input.controls();
      const events = plane.step(dt, controls, heightAt, wind);
      if (events.landed && !events.crashed) sound.touchdown();
      const result = missions.update(dt, plane, events, sound);
      sound.update(plane.throttle, plane.speed, plane.onGround);
      if (plane.stalled && !plane.onGround && t > stallBeep) { sound.stallWarning(); stallBeep = t + 0.4; }
      if (result === 'sortie-complete') mode = 'sortie-complete';
      else if (result === 'campaign-complete') mode = 'campaign-complete';
      else if (result === 'crashed' || events.crashed) { sound.crash(); mode = 'crashed'; }
    } else {
      // Menus still idle the engine sound down and tick the message timer.
      missions.messageT = Math.max(0, missions.messageT - dt);
      sound.update(0, 0, true);
    }
    input.clearPressed();
  }

  terrain.update(dt, t);
  clouds.children.forEach((cl, i) => { cl.position.x += dt * (1.1 + i * 0.22); if (cl.position.x > 2400) cl.position.x = -2400; });
  sun.target.position.copy(plane.pos);
  if (frozen && shot === 'landing') {
    applyShotCamera(camera, plane, SHOT_CAMERA_PARAMS[shot]);
  } else {
    rig.update(frozen ? 0.016 : dt, plane);
  }
  renderer.render(scene, camera);

  hud.draw({ plane, missions, mode, cameraMode: rig.mode, wind, hint: HINTS[missions.sortie] });
  if (!frozen) {
    if (mode === 'title') screens.title();
    else if (mode === 'briefing') screens.briefing(missions.sortie, missions.score);
    else if (mode === 'sortie-complete') screens.sortieComplete(missions.sortie, missions.score);
    else if (mode === 'crashed') screens.crashed(plane.damage);
    else if (mode === 'campaign-complete') screens.campaignComplete(missions);
  }
}
requestAnimationFrame(loop);
