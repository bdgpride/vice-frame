// Vice Frame — this repository's entry for gta6-cover-art-01 (Node 22, standard library only).
//
// The app itself lives in app/: a fully offline, static cover maker that arranges a user's
// photos into a multi-panel layout in the style of a GTA poster, applies canvas colour
// grades (sunset, neon, noir and more), and frames the result with bundled display fonts
// and graphic ornaments. It loads straight from app/index.html in a desktop browser — no
// build step, no libraries fetched, no network calls — and exports the finished cover as
// a PNG in a choice of post sizes.
//
// This file is just the delivery plumbing. When it runs, it copies app/ and screenshots/
// into the output directory and writes dossier.json there, assembled with the vendored
// helper in vendor/makefun-app.ts, so the judge can review the app and the screenshots
// that show it off.
//
// To try the app yourself: `node serve.ts`, then visit http://localhost:8080.
// When you run outside the grader's container, point MAKEFUN_OUTPUT_DIR at a scratch
// directory to stand in for /output, e.g.:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'app'), join(out, 'app'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in app/ or 48 MiB of app
// files, in all, or a path under app/ over 1000 bytes: app/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    app_max_files: 993,
    app_max_bytes: 50331648,
    app_path_max_bytes: 1000,
  }),
);
