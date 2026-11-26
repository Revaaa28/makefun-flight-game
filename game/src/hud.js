// hud.js — the 2D instrument overlay drawn on a canvas above the 3D view:
// digital ALT / SPD / HDG readouts, an attitude indicator, airspeed and
// altitude tapes, a compass strip, throttle and fuel bars, vertical speed,
// a course-dot guide to the objective, the mission banner and messages.
// It is drawn in every state — title, flight and shot scenes alike — so a
// screenshot of the game always shows a lit cockpit.

export class Hud {
  constructor(canvas) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    this.cv.width = window.innerWidth;
    this.cv.height = window.innerHeight;
    this.w = this.cv.width; this.h = this.cv.height;
  }

  text(str, x, y, size, color, align = 'left', bold = true) {
    const c = this.ctx;
    c.font = `${bold ? '700' : '400'} ${size}px "Segoe UI", system-ui, sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle';
    c.fillStyle = color;
    c.fillText(str, x, y);
  }

  panel(x, y, w, h, alpha = 0.55) {
    const c = this.ctx;
    c.fillStyle = `rgba(24,16,10,${alpha})`;
    c.beginPath();
    c.roundRect(x, y, w, h, 10);
    c.fill();
    c.strokeStyle = 'rgba(255,196,107,0.5)';
    c.lineWidth = 1;
    c.stroke();
  }

  // A vertical tape (airspeed or altitude): a window of values scrolling
  // past a fixed caret, with the digital value boxed at the centre.
  tape(x, y, h, value, step, label, unit) {
    const c = this.ctx;
    this.panel(x, y, 74, h, 0.5);
    c.save();
    c.beginPath(); c.rect(x, y, 74, h); c.clip();
    const midY = y + h / 2;
    const pxPer = h / (step * 6);
    const first = Math.floor(value / step) - 3;
    for (let i = 0; i <= 7; i++) {
      const v = (first + i) * step;
      if (v < 0) continue;
      const yy = midY + (value - v) * pxPer;
      c.strokeStyle = 'rgba(255,240,214,0.8)';
      c.beginPath(); c.moveTo(x + 52, yy); c.lineTo(x + 66, yy); c.stroke();
      this.text(String(v), x + 46, yy, 13, '#ffe9c4', 'right');
    }
    c.restore();
    c.fillStyle = '#ffc46b';
    c.beginPath();
    c.moveTo(x + 66, midY - 7); c.lineTo(x + 74, midY); c.lineTo(x + 66, midY + 7);
    c.closePath(); c.fill();
    this.text(label, x + 37, y - 12, 12, '#ffc46b', 'center');
    this.text(unit, x + 37, y + h + 12, 11, '#d8c9a8', 'center');
  }

  bar(x, y, w, frac, color, label) {
    const c = this.ctx;
    this.text(label, x, y - 11, 11, '#ffe9c4', 'left');
    c.fillStyle = 'rgba(0,0,0,0.55)';
    c.beginPath(); c.roundRect(x, y, w, 12, 5); c.fill();
    c.fillStyle = color;
    if (frac > 0.01) { c.beginPath(); c.roundRect(x, y, w * Math.min(1, frac), 12, 5); c.fill(); }
  }

  draw(state) {
    const { plane, missions, mode, cameraMode } = state;
    const c = this.ctx, W = this.w, H = this.h;
    c.clearRect(0, 0, W, H);
    const knots = Math.round(plane.speed * 1.944);
    const altFt = Math.max(0, Math.round((plane.pos.y) * 3.281));
    const hdg = Math.round(plane.headingDeg());
    const vs = plane.vy * 196.85; // ft/min

    // Mission banner across the top.
    this.panel(W / 2 - 250, 14, 500, 58, 0.5);
    this.text(missions ? missionTitle(missions) : 'GOLDENHOUR AIRMAIL', W / 2, 34, 17, '#ffc46b', 'center');
    this.text(missions ? missions.objectiveLabel() : '', W / 2, 57, 13.5, '#fff3d6', 'center', false);
    this.text(`SCORE ${missions ? missions.score : 0}`, W - 24, 30, 17, '#ffe9c4', 'right');
    this.text(cameraMode === 'cockpit' ? 'COCKPIT VIEW' : 'CHASE VIEW', W - 24, 54, 11, '#d8c9a8', 'right', false);

    // Tapes: airspeed left, altitude right.
    this.tape(22, H / 2 - 110, 220, knots, 10, 'AIRSPEED', 'kt');
    this.tape(W - 96, H / 2 - 110, 220, altFt, 100, 'ALTITUDE', 'ft');

    // Digital readouts, bottom left cluster.
    this.panel(22, H - 118, 252, 96, 0.55);
    this.text(`SPD ${String(knots).padStart(3, '0')} kt`, 38, H - 92, 16, '#fff3d6');
    this.text(`ALT ${String(altFt).padStart(4, '0')} ft`, 38, H - 66, 16, '#fff3d6');
    this.text(`HDG ${String(hdg).padStart(3, '0')}°`, 158, H - 92, 16, '#fff3d6');
    this.text(`V/S ${vs >= 0 ? '+' : ''}${Math.round(vs)}`, 158, H - 66, 16, vs < -600 ? '#ff8a70' : '#fff3d6');
    if (plane.stalled && !plane.onGround) this.text('STALL', 96, H - 38, 15, '#ff5340', 'center');
    else if (plane.onGround) this.text('ON GROUND', 96, H - 38, 12, '#b7e3a8', 'center', false);
    else this.text('AIRBORNE', 96, H - 38, 12, '#b7e3a8', 'center', false);

    // Throttle and fuel bars, bottom right.
    this.bar(W - 240, H - 84, 200, plane.throttle, '#ffc46b', `THROTTLE ${Math.round(plane.throttle * 100)}%`);
    this.bar(W - 240, H - 44, 200, plane.fuel / 100, plane.fuel < 25 ? '#ff5340' : '#7dd87d', `FUEL ${Math.round(plane.fuel)}%`);
    if (plane.damage > 0) this.bar(W - 240, H - 124, 200, 1 - plane.damage / 100, '#ff8a70', `AIRFRAME ${Math.round(100 - plane.damage)}%`);

    this.attitude(W / 2, H - 124, plane);
    this.compass(W / 2, 96, hdg);
    if (missions) this.courseDots(W / 2, 128, state);
    if (missions && missions.messageT > 0) {
      this.text(missions.message, W / 2, H * 0.3, 21, '#ffe9c4', 'center');
    }
    if (mode === 'flying' && state.hint) this.text(state.hint, W / 2, H - 13, 12, 'rgba(255,243,214,0.85)', 'center', false);
  }

  // Artificial horizon: a disc whose sky/ground split rolls and pitches
  // with the plane, with a fixed aircraft symbol in the middle.
  attitude(cx, cy, plane) {
    const c = this.ctx, r = 44;
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.clip();
    // The ball stays earth-fixed: banking right rolls the horizon the
    // other way on the dial, so it counter-rotates against the bank.
    c.translate(cx, cy); c.rotate(-plane.roll);
    const lift = plane.pitch * 90;
    c.fillStyle = '#7fb2d9'; c.fillRect(-r * 1.5, -r * 1.5 + lift, r * 3, r * 1.5);
    c.fillStyle = '#8a6b42'; c.fillRect(-r * 1.5, lift, r * 3, r * 1.5);
    c.strokeStyle = '#fff3d6'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(-r * 1.5, lift); c.lineTo(r * 1.5, lift); c.stroke();
    c.restore();
    c.strokeStyle = 'rgba(255,196,107,0.8)'; c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = '#ffc46b'; c.lineWidth = 3;
    c.beginPath();
    c.moveTo(cx - 22, cy); c.lineTo(cx - 7, cy); c.lineTo(cx, cy + 6); c.lineTo(cx + 7, cy); c.lineTo(cx + 22, cy);
    c.stroke();
    this.text('ATT', cx, cy + r + 13, 10.5, '#d8c9a8', 'center', false);
  }

  compass(cx, y, hdg) {
    const c = this.ctx, w = 320;
    this.panel(cx - w / 2, y - 14, w, 28, 0.45);
    c.save();
    c.beginPath(); c.rect(cx - w / 2 + 4, y - 14, w - 8, 28); c.clip();
    const names = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
    for (let d = -60; d <= 60; d += 15) {
      const deg = ((Math.round(hdg / 15) * 15 + d) % 360 + 360) % 360;
      // 2.3 px per degree keeps the ±60° end labels (W / NE and friends)
      // fully inside the strip instead of clipping at its edges.
      const x = cx + (deg - hdg + (Math.abs(deg - hdg) > 180 ? (deg > hdg ? -360 : 360) : 0)) * 2.3;
      if (x < cx - w / 2 + 14 || x > cx + w / 2 - 14) continue;
      const label = names[deg] || String(deg / 10).padStart(2, '0');
      this.text(label, x, y, deg % 45 === 0 ? 11.5 : 9.5, deg === 0 ? '#ff8a70' : '#ffe9c4', 'center');
    }
    c.restore();
    c.fillStyle = '#ffc46b';
    c.beginPath(); c.moveTo(cx - 6, y - 16); c.lineTo(cx + 6, y - 16); c.lineTo(cx, y - 8); c.closePath(); c.fill();
  }

  // A row of dots for the sortie's waypoints: filled as each is done, and
  // a bearing tick showing where the current objective sits relative to
  // the nose.
  courseDots(cx, y, state) {
    const { plane, missions } = state;
    const c = this.ctx;
    let total = 0, done = 0;
    if (missions.sortie === 0) { total = 9; done = missions.ringIndex; }
    else if (missions.sortie === 1) { total = 3; done = missions.targets.filter((t) => t.done).length; }
    else { total = 1; done = missions.landingResult ? 1 : 0; }
    for (let i = 0; i < total; i++) {
      const x = cx + (i - (total - 1) / 2) * 22;
      c.beginPath(); c.arc(x, y, 6, 0, Math.PI * 2);
      c.fillStyle = i < done ? '#7dd87d' : i === done ? '#ffc46b' : 'rgba(255,243,214,0.3)';
      c.fill();
    }
    const obj = missions.currentObjective();
    if (obj && !plane.onGround) {
      const dx = obj.x - plane.pos.x, dz = obj.z - plane.pos.z;
      const bearing = (Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360;
      let rel = bearing - plane.headingDeg();
      while (rel > 180) rel -= 360; while (rel < -180) rel += 360;
      const dist = Math.round(Math.hypot(dx, dz));
      const tx = cx + Math.max(-150, Math.min(150, rel * 1.6));
      c.fillStyle = '#ffc46b';
      c.beginPath(); c.moveTo(tx, y + 14); c.lineTo(tx - 6, y + 24); c.lineTo(tx + 6, y + 24); c.closePath(); c.fill();
      this.text(`${dist} m`, cx, y + 36, 11.5, '#ffe9c4', 'center', false);
    }
  }
}

function missionTitle(m) {
  return ['SORTIE 1 · RING RUN', 'SORTIE 2 · MAIL DROP', 'SORTIE 3 · HOME FOR SUPPER'][m.sortie] || '';
}
