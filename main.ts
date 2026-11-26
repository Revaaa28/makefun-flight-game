// main.ts — the hand-in program for Goldenhour Airmail.
//
// It takes the finished game (the game/ folder beside this file) and the
// four screenshots (screenshots/ beside this file) and assembles the entry
// directory the bounty scores: both folders copied into the output
// directory, plus a dossier.json describing them, written with the kit
// library's buildDossier under this bounty's caps.
//
// The output directory comes from the MAKEFUN_OUTPUT_DIR environment
// variable, defaulting to /output. Run it with:  node main.ts

import { cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(`Goldenhour Airmail entry written to ${out} (dossier ${dossier.length} bytes)`);
