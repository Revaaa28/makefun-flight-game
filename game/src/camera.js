// camera.js — the two ways to see Amber Valley: a smooth chase camera
// that trails the Kestrel, and a cockpit camera sitting in the pilot's
// seat, looking over the nose past the instrument panel that cockpit.js
// builds and drives. C key swaps between them.

import { CockpitPanel } from './cockpit.js';
import { heightAt } from './terrain.js';

export class CameraRig {
  constructor(scene, camera) {
    this.camera = camera;
    this.mode = 'chase';           // 'chase' | 'cockpit'
    this.smoothed = new THREE.Vector3(0, 60, 300);
    this.lookAt = new THREE.Vector3();
    // The panel rides with the camera, visible only in cockpit mode.
    this.cockpit = new CockpitPanel();
    scene.add(this.camera);
    this.camera.add(this.cockpit.group);
  }

  toggle() { this.mode = this.mode === 'chase' ? 'cockpit' : 'chase'; }

  update(dt, plane) {
    const fwd = plane.forward();
    if (this.mode === 'cockpit') {
      this.cockpit.group.visible = true;
      // The pilot never sees his own high wing — hide it in this view.
      if (plane.mesh && plane.mesh.userData.wing) plane.mesh.userData.wing.visible = false;
      // The pilot's eye: above the wing line and ahead of the cabin,
      // so the nose deck and the world read over the panel.
      const eye = plane.pos.clone()
        .add(new THREE.Vector3(0, 1.9, 0))
        .addScaledVector(fwd, 0.8);
      this.camera.position.copy(eye);
      const look = eye.clone().addScaledVector(fwd, 30);
      look.y += -plane.pitch * 6;
      this.camera.lookAt(look);
      this.camera.rotation.z += plane.roll * 0.55; // the world banks around you
      this.cockpit.update(plane);
      return;
    }
    this.cockpit.group.visible = false;
    if (plane.mesh && plane.mesh.userData.wing) plane.mesh.userData.wing.visible = true;
    // Chase: a THREE-QUARTER rear view, not dead-astern. Dead astern at
    // tail height on a high-wing plane fills the frame with flat wing
    // and tail fin; offsetting to one side and lifting the camera lets
    // the wing, tapered fuselage, canopy and tail all read at once.
    // Sit ~10 m behind, ~3.5 m above and ~2.5 m to the right of the
    // tail, easing toward the ideal spot so fast manoeuvres swing the
    // view instead of snapping it.
    const right = new THREE.Vector3(Math.cos(plane.heading), 0, Math.sin(plane.heading));
    const ideal = plane.pos.clone()
      .addScaledVector(fwd, -10)
      .add(new THREE.Vector3(0, 3.5, 0))
      .addScaledVector(right, 2.5);
    const k = 1 - Math.pow(0.0015, dt);
    // After a teleport (sortie start, shot pose) snap straight to the
    // ideal spot instead of swooping in from the previous scene.
    if (this.smoothed.distanceTo(ideal) > 60) this.smoothed.copy(ideal);
    else this.smoothed.lerp(ideal, Math.min(1, k));
    // Never let the camera sink under the hillside it is crossing.
    const floor = heightAt(this.smoothed.x, this.smoothed.z) + 1.4;
    if (this.smoothed.y < floor) this.smoothed.y = floor;
    this.camera.position.copy(this.smoothed);
    // Look at a point at the plane's centre and slightly ahead of it,
    // so the plane sits low in the frame with the world opening up
    // in front of it.
    this.lookAt.copy(plane.pos).addScaledVector(fwd, 3);
    this.lookAt.y += 0.4;
    this.camera.lookAt(this.lookAt);
  }
}

// Shot camera for the landing-flare scene: positioned from the plane's
// HEADING ONLY — never its pitch or roll — so a steep rotation or climb
// cannot swing the frame down into the plane's belly/tail. Set directly
// every frame while active, with no smoothing lag.
//   camera position = plane position - headingForward * dist
//                     + (0, height, 0) + headingRight * side
//   look-at         = plane position + headingForward * 10 + (0, 1, 0)
export function applyShotCamera(camera, plane, { dist, height, side }) {
  const headingForward = new THREE.Vector3(
    Math.sin(plane.heading), 0, -Math.cos(plane.heading));
  const headingRight = new THREE.Vector3(
    Math.cos(plane.heading), 0, Math.sin(plane.heading));
  camera.position.copy(plane.pos)
    .addScaledVector(headingForward, -dist)
    .add(new THREE.Vector3(0, height, 0))
    .addScaledVector(headingRight, side);
  const lookAt = plane.pos.clone()
    .addScaledVector(headingForward, 10)
    .add(new THREE.Vector3(0, 1, 0));
  camera.lookAt(lookAt);
}
