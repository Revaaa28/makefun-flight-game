// input.js — keyboard and mouse state, translated each frame into the
// control surface deflections the flight model consumes.

export class Input {
  constructor(canvas) {
    this.keys = new Set();
    this.mouseDown = false;
    this.mouseX = 0; this.mouseY = 0;   // -1..1 from screen centre
    this.pressed = new Set();          // keys that went down this frame
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseDown = false; });
    canvas.addEventListener('mousedown', () => { this.mouseDown = true; });
    window.addEventListener('mouseup', () => { this.mouseDown = false; });
    window.addEventListener('mousemove', (e) => {
      this.mouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseY = (e.clientY / window.innerHeight) * 2 - 1;
    });
  }

  down(code) { return this.keys.has(code); }

  // True once per physical press; the game polls this after reading controls.
  justPressed(code) { return this.pressed.has(code); }
  clearPressed() { this.pressed.clear(); }

  // Build the controls object for the flight model.
  // pitch: +1 nose up. roll: +1 bank right. throttleDelta per second.
  controls() {
    let pitch = 0, roll = 0;
    if (this.down('ArrowUp') || this.down('KeyW')) pitch -= 1;   // stick forward = nose down, like a real yoke push... 
    if (this.down('ArrowDown') || this.down('KeyS')) pitch += 1;
    if (this.down('ArrowLeft') || this.down('KeyA')) roll -= 1;
    if (this.down('ArrowRight') || this.down('KeyD')) roll += 1;
    if (this.mouseDown) {
      // Hold the mouse to steer toward the pointer: up on screen climbs.
      pitch += -this.mouseY * 1.4;
      roll += this.mouseX * 1.4;
    }
    let throttleDelta = 0;
    if (this.down('ShiftLeft') || this.down('ShiftRight')) throttleDelta += 0.55;
    if (this.down('ControlLeft') || this.down('ControlRight')) throttleDelta -= 0.55;
    return {
      pitch: Math.max(-1, Math.min(1, pitch)),
      roll: Math.max(-1, Math.min(1, roll)),
      throttleDelta,
      brake: this.down('Space'),
    };
  }
}
