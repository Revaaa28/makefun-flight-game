// cockpit.js — the Kestrel's instrument panel, the one the pilot sits
// behind in cockpit view: gauge faces drawn on canvas (tick rings,
// numerals, coloured arcs — faces that look flown, not drawn), an
// attitude ball redrawn from the flight state every frame, a compass
// rose that turns with the heading, a throttle quadrant whose lever
// follows the throttle, and a yoke that banks and pulls with the plane.
// CameraRig parents the panel to the camera and calls update() with the
// live flight state; nothing here knows about the chase view.

import { mulberry32 } from './random.js';

const SWEEP0 = 2.1;          // needle rotation.z at value zero
const SWEEP = 4.2;           // radians of sweep from zero to full scale

function needleAngle(frac) { return SWEEP0 - frac * SWEEP; }

// Canvas point for a value on the standard sweep: the needle at
// rotation.z = needleAngle(f) points along (-sin, cos) in panel space,
// and canvas y runs the other way.
function sweepPoint(g, cx, cy, frac, r) {
  const a = needleAngle(frac);
  return [cx - Math.sin(a) * r, cy - Math.cos(a) * r];
}

function makeCanvas(w, h) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  return [cv, cv.getContext('2d')];
}

// The shared face furniture: dark dial, rim ring, dealer's choice of
// label lines at the bottom.
function baseFace(g, size, label, sub) {
  const c = size / 2;
  g.fillStyle = '#101216'; g.fillRect(0, 0, size, size);
  g.strokeStyle = '#454b52'; g.lineWidth = 5;
  g.beginPath(); g.arc(c, c, size * 0.47, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,240,214,0.14)'; g.lineWidth = 2;
  g.beginPath(); g.arc(c, c, size * 0.40, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#cbbd97'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `700 ${size * 0.075}px "Segoe UI", system-ui, sans-serif`;
  g.fillText(label, c, c + size * 0.21);
  g.font = `400 ${size * 0.058}px "Segoe UI", system-ui, sans-serif`;
  g.fillStyle = '#8f8672';
  g.fillText(sub, c, c + size * 0.30);
}

function tickRing(g, size, majors, minorsPer, numeralEvery, numeralText, fontScale = 0.115) {
  const c = size / 2;
  for (let i = 0; i <= minorsPer * majors; i++) {
    const f = i / (minorsPer * majors);
    const major = i % minorsPer === 0;
    const [x1, y1] = sweepPoint(g, c, c, f, size * (major ? 0.375 : 0.395));
    const [x2, y2] = sweepPoint(g, c, c, f, size * 0.445);
    g.strokeStyle = major ? '#f2e7c8' : 'rgba(242,231,200,0.55)';
    g.lineWidth = major ? 4 : 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    if (major && numeralEvery > 0 && (i / minorsPer) % numeralEvery === 0) {
      const [nx, ny] = sweepPoint(g, c, c, f, size * 0.285);
      g.fillStyle = '#f2e7c8'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 ${size * fontScale}px "Segoe UI", system-ui, sans-serif`;
      g.fillText(numeralText(i / minorsPer), nx, ny);
    }
  }
}

function arcBand(g, size, f0, f1, color, r = 0.415, w = 0.045) {
  const c = size / 2;
  g.strokeStyle = color; g.lineWidth = size * w;
  g.beginPath();
  for (let f = f0; f <= f1 + 0.001; f += 0.01) {
    const [x, y] = sweepPoint(g, c, c, f, size * r);
    if (f === f0) g.moveTo(x, y); else g.lineTo(x, y);
  }
  g.stroke();
}

function airspeedFace() {
  const [cv, g] = makeCanvas(256, 256);
  baseFace(g, 256, 'AIRSPEED', 'KNOTS');
  arcBand(g, 256, 45 / 140, 105 / 140, '#57b24a');        // green arc
  arcBand(g, 256, 105 / 140, 125 / 140, '#e8c33a');       // yellow arc
  arcBand(g, 256, 130 / 140, 131 / 140, '#d8402e', 0.415, 0.06); // red line
  tickRing(g, 256, 14, 2, 2, (i) => String(i * 10));
  return new THREE.CanvasTexture(cv);
}

// The brushed-metal plate the gauges sit in: near-black with a faint
// vertical grain (seeded, so the panel is the same on every load) and a
// screw in each corner.
function panelPlateTexture() {
  const [cv, g] = makeCanvas(1024, 384);
  const rng = mulberry32(7);
  g.fillStyle = '#27231f'; g.fillRect(0, 0, 1024, 384);
  // A soft sheen falling from the top edge, like light off brushed
  // metal, over a denser grain of pale and dark vertical strokes.
  const sheen = g.createLinearGradient(0, 0, 0, 384);
  sheen.addColorStop(0, 'rgba(255,236,200,0.07)');
  sheen.addColorStop(0.45, 'rgba(255,236,200,0.015)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.10)');
  g.fillStyle = sheen; g.fillRect(0, 0, 1024, 384);
  for (let i = 0; i < 1700; i++) {
    const x = rng() * 1024;
    g.strokeStyle = rng() > 0.42
      ? `rgba(255,255,255,${0.02 + rng() * 0.05})`
      : `rgba(0,0,0,${0.03 + rng() * 0.05})`;
    g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 384); g.stroke();
  }
  for (const [x, y] of [[26, 26], [998, 26], [26, 358], [998, 358]]) {
    g.fillStyle = '#0c0b0a';
    g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#5a5348'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x - 7, y); g.lineTo(x + 7, y); g.stroke();
  }
  return new THREE.CanvasTexture(cv);
}

function darkMetal(color = 0x17181a) {
  return new THREE.MeshLambertMaterial({ color });
}

// One gauge: bezel ring, textured face, a needle on a pivot (or, for the
// compass, the face itself rides the pivot and a fixed lubber marks it).
function buildGauge(radius, faceTexture, withNeedle = true) {
  const grp = new THREE.Group();
  const bezel = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.14, radius * 1.14, 0.045, 26),
    darkMetal(0x4b4f55));
  bezel.rotation.x = Math.PI / 2;
  grp.add(bezel);
  const pivot = new THREE.Group();
  pivot.position.z = 0.028;
  if (withNeedle) {
    const face = new THREE.Mesh(new THREE.CircleGeometry(radius, 26),
      new THREE.MeshBasicMaterial({ map: faceTexture }));
    face.position.z = 0.024;
    grp.add(face);
    const needle = new THREE.Mesh(new THREE.BoxGeometry(0.02, radius * 0.86, 0.012),
      new THREE.MeshBasicMaterial({ color: 0xffd76b }));
    needle.position.y = radius * 0.30;
    pivot.add(needle);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.03, radius * 0.3, 0.012),
      new THREE.MeshBasicMaterial({ color: 0xffd76b }));
    tail.position.y = -radius * 0.18;
    pivot.add(tail);
    const cap = new THREE.Mesh(new THREE.CircleGeometry(radius * 0.13, 14),
      new THREE.MeshBasicMaterial({ color: 0x0c0b0a }));
    cap.position.z = 0.006;
    pivot.add(cap);
  } else {
    const rose = new THREE.Mesh(new THREE.CircleGeometry(radius, 26),
      new THREE.MeshBasicMaterial({ map: faceTexture }));
    pivot.add(rose);
    const lubber = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.06, 4),
      new THREE.MeshBasicMaterial({ color: 0xffc46b }));
    lubber.position.set(0, radius * 1.14 + 0.035, 0.028);
    lubber.rotation.x = Math.PI;             // point down at the rose's top
    lubber.rotation.y = Math.PI / 4;
    grp.add(lubber);
  }
  grp.add(pivot);
  return { grp, pivot };
}

export class CockpitPanel {
  constructor() {
    this.group = new THREE.Group();
    this.buildDash();
    this.buildAttitude();
    this.buildQuadrantAndYoke();
    this.group.visible = false;
  }

  buildDash() {
    // The dash tilts back like a real panel; gauges live in its plane.
    // It is scaled and set back so the whole panel — both gauge rows —
    // sits in the lower frame with the windscreen open above it.
    const tilt = new THREE.Group();
    tilt.position.set(0, -0.47, -1.35);
    tilt.rotation.x = 0.20;
    tilt.scale.setScalar(0.62);
    this.group.add(tilt);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.06, 0.14), darkMetal(0x1b1917));
    tilt.add(dash);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.97),
      new THREE.MeshBasicMaterial({ map: panelPlateTexture() }));
    plate.position.z = 0.075;
    tilt.add(plate);
    const place = (gauge, x, y) => { gauge.grp.position.set(x, y, 0.085); tilt.add(gauge.grp); return gauge; };
    this.asi = place(buildGauge(0.175, airspeedFace()), -0.68, 0.17);
    this.alt = place(buildGauge(0.175, altimeterFace()), 0.68, 0.17);
    this.hdg = place(buildGauge(0.125, compassRose(), false), -0.68, -0.31);
    this.vsi = place(buildGauge(0.125, verticalSpeedFace()), 0, -0.31);
    this.fuel = place(buildGauge(0.125, fuelFace()), 0.68, -0.31);
    // The glareshield lip over the top of the dash.
    const shield = new THREE.Mesh(new THREE.BoxGeometry(2.74, 0.07, 0.4), darkMetal(0x141210));
    shield.position.set(0, 0.58, 0.1);
    tilt.add(shield);
    // Windscreen pillars at the frame's edges — the pilot is IN a cabin.
    // Kept slim and near-vertical: a hard inward lean swings the top of
    // the post into the windscreen as a black sail.
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1.5, 0.07), darkMetal(0x141210));
      post.position.set(s * 1.48, 0.42, -1.25);
      post.rotation.z = -s * 0.12;
      post.rotation.x = 0.10;
      this.group.add(post);
    }
    // The cowling the pilot looks over, cream like the nose outside:
    // low and far enough to read as the nose deck under the panel.
    const cowl = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.26, 1.1),
      new THREE.MeshLambertMaterial({ color: 0xf3e6cf }));
    cowl.position.set(0, -1.04, -2.05);
    this.group.add(cowl);
  }

  buildAttitude() {
    // The attitude ball is a canvas redrawn from the flight state: a
    // horizon that rolls against the bank and slides with the pitch.
    const [cv, g] = makeCanvas(256, 256);
    this.attCanvas = cv; this.attCtx = g;
    this.attTexture = new THREE.CanvasTexture(cv);
    const gauge = buildGauge(0.20, this.attTexture);
    gauge.grp.position.set(0, 0.19, 0.085);
    // Reparent into the dash tilt group (the first child of this.group).
    this.group.children[0].add(gauge.grp);
    this.attPivot = gauge.pivot;             // unused: the ball is the face
    this.drawAttitude(0, 0);
  }

  drawAttitude(roll, pitch) {
    const g = this.attCtx, S = 256, c = S / 2;
    g.fillStyle = '#101216'; g.fillRect(0, 0, S, S);
    g.save();
    g.translate(c, c);
    g.rotate(-roll);
    const p = pitch * 150;                    // horizon slides with pitch
    g.fillStyle = '#6fa8cf'; g.fillRect(-S, -S * 1.6 + p, S * 2, S * 1.6);
    g.fillStyle = '#7d5f36'; g.fillRect(-S, p, S * 2, S * 1.6);
    g.strokeStyle = '#f5efdd'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(-S, p); g.lineTo(S, p); g.stroke();
    g.lineWidth = 2; g.strokeStyle = 'rgba(245,239,221,0.75)';
    for (const off of [-56, -28, 28, 56]) {
      const w = off % 56 === 0 ? 34 : 54;
      g.beginPath(); g.moveTo(-w, p + off); g.lineTo(w, p + off); g.stroke();
    }
    g.restore();
    // The fixed aeroplane symbol and the roll pointer, unrotated.
    g.strokeStyle = '#ffc46b'; g.lineWidth = 6;
    g.beginPath();
    g.moveTo(c - 58, c); g.lineTo(c - 16, c); g.lineTo(c, c + 12);
    g.lineTo(c + 16, c); g.lineTo(c + 58, c);
    g.stroke();
    g.fillStyle = '#ffc46b';
    g.beginPath(); g.moveTo(c, 14); g.lineTo(c - 8, 30); g.lineTo(c + 8, 30); g.closePath(); g.fill();
    g.fillStyle = '#cbbd97'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 19px "Segoe UI", system-ui, sans-serif';
    g.fillText('ATTITUDE', c, c + 62);
    this.attTexture.needsUpdate = true;
  }

  buildQuadrantAndYoke() {
    const tilt = this.group.children[0];
    // Throttle quadrant on the panel's right: a slotted cheek, a lever
    // on a pivot, a black knob. The lever follows the throttle.
    const quad = new THREE.Group();
    quad.position.set(1.08, -0.30, 0.10);
    const cheek = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.36, 0.1), darkMetal());
    quad.add(cheek);
    this.lever = new THREE.Group();
    this.lever.position.set(0, -0.10, 0.05);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.032, 0.3, 0.032), darkMetal(0x2c2c2e));
    arm.position.y = 0.13;
    this.lever.add(arm);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshBasicMaterial({ color: 0x0c0b0a }));
    knob.position.y = 0.30;
    this.lever.add(knob);
    quad.add(this.lever);
    const mix = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.05, 10),
      new THREE.MeshBasicMaterial({ color: 0xc23b2a }));
    mix.rotation.x = Math.PI / 2;
    mix.position.set(-0.02, -0.34, 0.06);
    quad.add(mix);
    tilt.add(quad);
    // The yoke, closer to the pilot than the dash: a column and a bar
    // with grips, banking with the plane and pulling with the pitch.
    this.yoke = new THREE.Group();
    const column = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.36, 0.06), darkMetal(0x191919));
    column.position.y = -0.15;
    this.yoke.add(column);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.06, 0.06), darkMetal(0x191919));
    this.yoke.add(bar);
    for (const s of [-1, 1]) {
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.17, 0.06), darkMetal(0x191919));
      grip.position.set(s * 0.26, -0.07, 0);
      this.yoke.add(grip);
    }
    this.yoke.position.set(0, -0.98, -1.02);
    this.group.add(this.yoke);
  }

  // Drive every instrument from the live flight state.
  update(plane) {
    const knots = plane.speed * 1.944;
    this.asi.pivot.rotation.z = needleAngle(Math.max(0, Math.min(1, knots / 140)));
    const altThousands = (plane.pos.y * 3.281 / 1000) % 10;
    this.alt.pivot.rotation.z = needleAngle(altThousands / 10);
    const vsFrac = Math.max(0, Math.min(1, (plane.vy * 196.85 + 2000) / 4000));
    this.vsi.pivot.rotation.z = needleAngle(vsFrac);
    this.fuel.pivot.rotation.z = needleAngle(Math.max(0, Math.min(1, plane.fuel / 100)));
    this.hdg.pivot.rotation.z = plane.heading;
    this.drawAttitude(plane.roll, plane.pitch);
    this.lever.rotation.x = 0.55 - plane.throttle * 1.05;
    this.yoke.rotation.z = -plane.roll * 0.8;
    this.yoke.position.z = -1.02 + plane.pitch * 0.09;
    this.yoke.position.y = -0.98 - plane.pitch * 0.03;
  }
}


function altimeterFace() {
  const [cv, g] = makeCanvas(256, 256);
  baseFace(g, 256, 'ALTIMETER', 'FEET × 1000');
  // Fifty ticks (200 ft each), a numeral every thousand; the top of the
  // dial is 0 and 10 at once, so the 10 is left blank.
  tickRing(g, 256, 50, 1, 5, (i) => (i >= 50 ? '' : String(i / 5)), 0.13);
  return new THREE.CanvasTexture(cv);
}

function verticalSpeedFace() {
  const [cv, g] = makeCanvas(256, 256);
  baseFace(g, 256, 'VERT SPEED', 'FT/MIN × 1000');
  // Zero sits at the top (frac 0.5); numerals count thousands out to ±2.
  tickRing(g, 256, 8, 2, 2, (i) => String(Math.abs(i - 4) / 2), 0.12);
  return new THREE.CanvasTexture(cv);
}

function fuelFace() {
  const [cv, g] = makeCanvas(256, 256);
  baseFace(g, 256, 'FUEL', 'PERCENT');
  arcBand(g, 256, 0, 0.25, '#d8402e');
  tickRing(g, 256, 4, 2, 1, (i) => ['E', '25', '50', '75', 'F'][i], 0.105);
  return new THREE.CanvasTexture(cv);
}

// The compass rose is drawn once and the whole disc turns: N at the top
// of the texture, bearings clockwise, cardinals as letters.
function compassRose() {
  const [cv, g] = makeCanvas(256, 256);
  const c = 128;
  g.fillStyle = '#101216'; g.fillRect(0, 0, 256, 256);
  g.strokeStyle = '#454b52'; g.lineWidth = 5;
  g.beginPath(); g.arc(c, c, 120, 0, Math.PI * 2); g.stroke();
  const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
  for (let b = 0; b < 360; b += 10) {
    const a = b * Math.PI / 180;
    const major = b % 30 === 0;
    const r1 = major ? 92 : 102, r2 = 114;
    g.strokeStyle = major ? '#f2e7c8' : 'rgba(242,231,200,0.5)';
    g.lineWidth = major ? 4 : 2;
    g.beginPath();
    g.moveTo(c + Math.sin(a) * r1, c - Math.cos(a) * r1);
    g.lineTo(c + Math.sin(a) * r2, c - Math.cos(a) * r2);
    g.stroke();
    if (major) {
      const label = names[b] || String(b / 10);
      g.fillStyle = b === 0 ? '#ff9a5c' : '#f2e7c8';
      g.font = `700 ${names[b] ? 34 : 25}px "Segoe UI", system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, c + Math.sin(a) * 68, c - Math.cos(a) * 68);
    }
  }
  return new THREE.CanvasTexture(cv);
}
