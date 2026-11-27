// config.js — every constant the game tunes by: world, flight, colours.
// One place to change the feel of Goldenhour Airmail.

export const SEED = 20261126;

export const WORLD = {
  size: 4200,          // the valley is a square this many metres across
  segments: 128,       // heightfield resolution
  waterLevel: 4.5,     // river and lake surface height
  fogNear: 800,
  fogFar: 4300,
};

// The runway at Kestrel Field: a flat plateau strip running north-south.
export const RUNWAY = {
  x: 620,              // centreline x
  z: -1650,            // centre z
  length: 340,         // metres, along z
  width: 30,
  height: 26,          // plateau height the terrain flattens to
  heading: 0,          // take off toward -z (north)
};

export const FLIGHT = {
  maxThrottleSpeed: 68,   // m/s at full throttle, level
  idleSpeed: 0,
  accel: 14,              // m/s^2 of thrust at full throttle
  drag: 0.0035,           // quadratic drag coefficient
  stallSpeed: 17,         // below this the wing stops holding you up
  rotateSpeed: 19,        // speed where a ground roll can lift off
  maxPitchRate: 0.9,      // rad/s of elevator authority
  maxRollRate: 1.6,       // rad/s of aileron authority
  turnPerRoll: 0.55,      // heading change per radian of bank at speed
  fuelStart: 100,
  fuelBurnCruise: 0.55,   // units per second at 60% throttle
  fuelBurnFull: 1.6,      // units per second at full throttle
  gravitySink: 9.0,       // extra sink when fully stalled
  groundFriction: 0.6,
  brakeDecel: 10,
};

// The valley wind: a steady flow that veers slowly, with gusts riding on
// it. Speeds in m/s; the flight model drifts and lifts on it, the HUD
// reads it out, and a stiff crosswind on final is a real decision.
export const WIND = {
  baseSpeed: 4.5,        // the valley's usual evening flow
  gustAmp: 3.2,          // gusts add up to this much on top
  gustFreq: 0.11,        // gust swell rate, rad/s of sim time
  veerDeg: 38,           // the direction wanders this far either side
  veerFreq: 0.021,       // veer rate, rad/s of sim time
  homeDeg: 255,          // prevailing flow: out of the west-southwest
};

export const COLORS = {
  sky: 0xffb36b,
  skyLow: 0xff8c4a,
  fog: 0xf7a55c,
  sun: 0xffd9a0,
  water: 0x1778c9,
  sand: 0xd2b264,
  grass: 0x58902f,
  grassDry: 0xa8903c,
  forest: 0x2e5c24,
  rock: 0x776c60,
  snow: 0xf3e9dc,
  fuselage: 0xf3e6cf,   // cream
  trim: 0xc23b2a,       // red
  ring: 0xffc93c,
  ringDone: 0x7dd87d,
  target: 0xff5340,
};

export const MISSION_TITLES = [
  'Sortie 1 — Ring Run',
  'Sortie 2 — Mail Drop',
  'Sortie 3 — Home for Supper',
];
