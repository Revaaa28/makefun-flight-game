// screens.js — the full-screen states drawn over the 3D view on the same
// canvas as the HUD: the title, the pre-sortie briefing, sortie complete,
// the crash report and the campaign-complete supper table. Each screen
// says what happens next and which key does it.

export class Screens {
  constructor(hud) { this.hud = hud; }

  dim(alpha = 0.55) {
    const c = this.hud.ctx;
    c.fillStyle = `rgba(20,10,4,${alpha})`;
    c.fillRect(0, 0, this.hud.w, this.hud.h);
  }

  card(w, h) {
    const { hud } = this;
    const x = hud.w / 2 - w / 2, y = hud.h / 2 - h / 2;
    hud.panel(x, y, w, h, 0.88);
    return { x, y, w, h, cx: hud.w / 2 };
  }

  title() {
    const { hud } = this;
    this.dim(0.35);
    hud.text('GOLDENHOUR AIRMAIL', hud.w / 2, hud.h * 0.3, 54, '#ffc46b', 'center');
    hud.text('Fly the Kestrel K-1 over Amber Valley at last light.', hud.w / 2, hud.h * 0.3 + 46, 18, '#fff3d6', 'center', false);
    hud.text('Thread the rings. Drop the mail. Be home for supper.', hud.w / 2, hud.h * 0.3 + 74, 18, '#fff3d6', 'center', false);
    hud.text('Press ENTER to take off', hud.w / 2, hud.h * 0.62, 22, '#7dd87d', 'center');
    hud.text('Arrows / WASD fly · Shift & Ctrl throttle · F drops mail · Space brake · C camera', hud.w / 2, hud.h * 0.62 + 38, 14, '#d8c9a8', 'center', false);
  }

  briefing(sortie, score) {
    const { hud } = this;
    this.dim(0.45);
    const { cx } = this.card(560, 300);
    const cy = hud.h / 2;
    const titles = ['SORTIE 1 — RING RUN', 'SORTIE 2 — MAIL DROP', 'SORTIE 3 — HOME FOR SUPPER'];
    const bodies = [
      ['Nine gold rings hang down the valley, following the river.',
       'Fly through each one in order — the lit ring is next.',
       'Each ring threaded scores 120.'],
      ['Three mail bags, three pads: the village, the camp,',
       'and the lighthouse point. Fly low and steady over a pad',
       'and press F to release. Closer to the centre pays more.'],
      ['The light is going. Bring the Kestrel home to Kestrel Field',
       'and land on the runway: touchdown in the zone, sink gently,',
       'stay on the centreline. Score so far: ' + score],
    ];
    hud.text(titles[sortie], cx, cy - 108, 24, '#ffc46b', 'center');
    bodies[sortie].forEach((line, i) => hud.text(line, cx, cy - 58 + i * 26, 15.5, '#fff3d6', 'center', false));
    hud.text('Press ENTER when ready', cx, cy + 108, 17, '#7dd87d', 'center');
  }

  sortieComplete(sortie, score) {
    const { hud } = this;
    this.dim(0.45);
    const { cx } = this.card(520, 240);
    const cy = hud.h / 2;
    hud.text('SORTIE COMPLETE', cx, cy - 70, 28, '#7dd87d', 'center');
    hud.text(`Campaign score: ${score}`, cx, cy - 24, 18, '#fff3d6', 'center', false);
    hud.text('Press ENTER for the next sortie', cx, cy + 60, 17, '#ffc46b', 'center');
  }

  crashed(damage) {
    const { hud } = this;
    this.dim(0.6);
    const { cx } = this.card(540, 250);
    const cy = hud.h / 2;
    hud.text('THE KESTREL IS DOWN', cx, cy - 74, 28, '#ff8a70', 'center');
    hud.text('Too fast, too steep, or the wrong piece of valley.', cx, cy - 30, 15.5, '#fff3d6', 'center', false);
    hud.text(`Airframe damage ${Math.round(damage)}%. The valley is unforgiving at dusk.`, cx, cy - 4, 15.5, '#fff3d6', 'center', false);
    hud.text('Press ENTER to mend her and fly the sortie again', cx, cy + 66, 16.5, '#7dd87d', 'center');
  }

  campaignComplete(missions) {
    const { hud } = this;
    this.dim(0.5);
    const { cx } = this.card(580, 330);
    const cy = hud.h / 2;
    hud.text('HOME FOR SUPPER', cx, cy - 128, 30, '#ffc46b', 'center');
    const lr = missions.landingResult;
    if (lr) {
      hud.text(`Touchdown ${lr.along} m in · sink ${lr.sink} m/s · ${lr.centre} m off centreline`, cx, cy - 82, 15.5, '#fff3d6', 'center', false);
      hud.text(`Landing score ${lr.total}`, cx, cy - 54, 17, '#7dd87d', 'center');
    }
    const drops = missions.targets.map((t) => `${t.name}: ${t.done ? t.score : 'undelivered'}`).join('   ·   ');
    hud.text(drops, cx, cy - 14, 14, '#d8c9a8', 'center', false);
    hud.text(`FINAL SCORE  ${missions.score}`, cx, cy + 34, 26, '#ffe9c4', 'center');
    hud.text(missions.score >= 1900 ? 'The whole valley eats well tonight. Fine flying.'
      : missions.score >= 1200 ? 'Supper is warm and the mail got through.'
        : 'Supper is late — but you are home, and so is the Kestrel.', cx, cy + 74, 15.5, '#fff3d6', 'center', false);
    hud.text('Press ENTER to fly the campaign again', cx, cy + 122, 16, '#7dd87d', 'center');
  }
}
