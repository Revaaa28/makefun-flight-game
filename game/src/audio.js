// audio.js — every sound in the game is synthesized with WebAudio: a
// two-oscillator engine whose pitch follows RPM, filtered noise for wind,
// and little one-shot voices for the chime, the drop and the touchdown.
// No audio files, nothing fetched.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
  }

  // Browsers only let audio start after a gesture; main calls this on the
  // first key press or click, and shot mode calls it directly.
  start() {
    if (this.started) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.ctx = ctx;
      // Engine: sawtooth + square detuned, through a lowpass.
      this.engineOsc = ctx.createOscillator(); this.engineOsc.type = 'sawtooth';
      this.engineOsc2 = ctx.createOscillator(); this.engineOsc2.type = 'square';
      this.engineFilter = ctx.createBiquadFilter(); this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 420;
      this.engineGain = ctx.createGain(); this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineFilter); this.engineOsc2.connect(this.engineFilter);
      this.engineFilter.connect(this.engineGain); this.engineGain.connect(ctx.destination);
      this.engineOsc.start(); this.engineOsc2.start();
      // Wind: looped noise through a bandpass.
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
      this.windSrc = ctx.createBufferSource(); this.windSrc.buffer = buf; this.windSrc.loop = true;
      this.windFilter = ctx.createBiquadFilter(); this.windFilter.type = 'bandpass'; this.windFilter.frequency.value = 600; this.windFilter.Q.value = 0.6;
      this.windGain = ctx.createGain(); this.windGain.gain.value = 0;
      this.windSrc.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(ctx.destination);
      this.windSrc.start();
      this.started = true;
    } catch (err) {
      this.ctx = null; // headless or blocked: the game simply runs silent
    }
  }

  // Continuous voices, driven from the flight state every frame.
  update(throttle, speed, onGround) {
    if (!this.started || !this.ctx) return;
    const t = this.ctx.currentTime;
    const rpm = 55 + throttle * 95 + speed * 0.25;
    this.engineOsc.frequency.setTargetAtTime(rpm, t, 0.08);
    this.engineOsc2.frequency.setTargetAtTime(rpm * 0.5 + 1.5, t, 0.08);
    this.engineFilter.frequency.setTargetAtTime(300 + throttle * 700, t, 0.1);
    this.engineGain.gain.setTargetAtTime(0.015 + throttle * 0.05, t, 0.1);
    const wind = Math.min(0.16, (speed / 70) * 0.16) * (onGround ? 0.4 : 1);
    this.windGain.gain.setTargetAtTime(wind, t, 0.15);
    this.windFilter.frequency.setTargetAtTime(350 + speed * 14, t, 0.15);
  }

  blip(freq, dur, type, gain, when = 0, slideTo = null) {
    if (!this.started || !this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + when;
    const osc = ctx.createOscillator(); osc.type = type; osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(ctx.destination);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  ringChime() { this.blip(880, 0.16, 'sine', 0.14); this.blip(1318, 0.3, 'sine', 0.12, 0.09); }
  dropThud() { this.blip(140, 0.25, 'sine', 0.22, 0, 45); }
  touchdown() { this.blip(220, 0.12, 'triangle', 0.16, 0, 90); this.blip(1250, 0.06, 'square', 0.03, 0.01, 700); }
  stallWarning() { this.blip(440, 0.09, 'square', 0.05); }
  crash() { this.blip(120, 0.7, 'sawtooth', 0.25, 0, 30); this.blip(70, 0.9, 'sine', 0.3, 0, 24); }
  fanfare() { [523, 659, 784, 1046].forEach((f, i) => this.blip(f, 0.28, 'triangle', 0.12, i * 0.13)); }
}
