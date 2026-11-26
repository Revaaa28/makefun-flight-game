// camera.js — the two ways to see Amber Valley: a smooth chase camera that
// trails the Kestrel, and a cockpit camera sitting in the pilot's seat with
// a lit 3D instrument panel (airspeed, altimeter, attitude ball) whose
// needles are driven by the real flight state. C key swaps between them.

export class CameraRig {
  constructor(scene, camera) {
    this.camera = camera;
    this.mode = 'chase';           // 'chase' | 'cockpit'
    this.smoothed = new THREE.Vector3(0, 60, 300);
    this.lookAt = new THREE.Vector3();
    this.buildPanel(scene);
  }

  toggle() { this.mode = this.mode === 'chase' ? 'cockpit' : 'chase'; }

  buildPanel(scene) {
    // The panel rides with the camera: parented to it, visible only in
    // cockpit mode. Gauges are cylinders with needle boxes pivoted at centre.
    const panel = new THREE.Group();
    const dash = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.78, 0.16),
      new THREE.MeshLambertMaterial({ color: 0x2a2320 }));
    dash.position.set(0, -0.52, -1.15);
    dash.rotation.x = 0.22;
    panel.add(dash);
    // The cowling in front, cream like the nose.
    const cowl = new THREE.Mesh(
      new THREE.BoxGeometry(2.4, 0.34, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xf3e6cf }));
    cowl.position.set(0, -0.78, -1.9);
    panel.add(cowl);
    this.needles = {};
    const gaugeAt = (x, key, faceColor) => {
      const face = new THREE.Mesh(
        new THREE.CylinderGeometry(0.155, 0.155, 0.03, 18),
        new THREE.MeshBasicMaterial({ color: faceColor }));
      face.rotation.x = Math.PI / 2 + 0.22;
      face.position.set(x, -0.48, -1.06);
      panel.add(face);
      const pivot = new THREE.Group();
      pivot.position.copy(face.position).z -= 0.03;
      const needle = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.13, 0.012),
        new THREE.MeshBasicMaterial({ color: 0xffd76b }));
      needle.position.y = 0.055;
      pivot.add(needle);
      panel.add(pivot);
      this.needles[key] = pivot;
    };
    gaugeAt(-0.62, 'speed', 0x1d2b1d);
    gaugeAt(0, 'attitude', 0x274b63);
    gaugeAt(0.62, 'alt', 0x2b2118);
    // A yoke that banks with the plane.
    this.yoke = new THREE.Group();
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(0.07, 0.4, 0.07),
      new THREE.MeshLambertMaterial({ color: 0x191919 }));
    column.position.y = -0.2; this.yoke.add(column);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.07, 0.07),
      new THREE.MeshLambertMaterial({ color: 0x191919 }));
    this.yoke.add(bar);
    this.yoke.position.set(0, -0.78, -0.95);
    panel.add(this.yoke);
    panel.visible = false;
    this.panel = panel;
    scene.add(this.camera);
    this.camera.add(panel);
  }

  update(dt, plane) {
    const fwd = plane.forward();
    if (this.mode === 'cockpit') {
      this.panel.visible = true;
      const eye = plane.pos.clone()
        .add(new THREE.Vector3(0, 1.55, 0))
        .addScaledVector(fwd, 0.4);
      this.camera.position.copy(eye);
      const look = eye.clone().addScaledVector(fwd, 30);
      look.y += -plane.pitch * 6;
      this.camera.lookAt(look);
      this.camera.rotation.z += plane.roll * 0.55; // the world banks around you
      // Drive the gauges: speed 0..70 m/s sweeps 240 degrees, altitude
      // 0..600 m likewise, attitude needle shows bank.
      this.needles.speed.rotation.z = 2.1 - Math.min(1, plane.speed / 70) * 4.2;
      this.needles.alt.rotation.z = 2.1 - Math.min(1, plane.pos.y / 600) * 4.2;
      this.needles.attitude.rotation.z = plane.roll;
      this.yoke.rotation.z = -plane.roll * 0.8;
      return;
    }
    this.panel.visible = false;
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
    this.camera.position.copy(this.smoothed);
    // Look at a point at the plane's centre and slightly ahead of it,
    // so the plane sits low in the frame with the world opening up
    // in front of it.
    this.lookAt.copy(plane.pos).addScaledVector(fwd, 3);
    this.lookAt.y += 0.4;
    this.camera.lookAt(this.lookAt);
  }
}

// Shot camera for the takeoff and landing scenes: positioned from the
// plane's HEADING ONLY — never its pitch or roll — so a steep rotation
// or climb cannot swing the frame down into the plane's belly/tail.
// Set directly every frame while active, with no smoothing lag.
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
