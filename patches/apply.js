// Postiz-Patch-Set fürs Image (statt ephemerer Container-Patches)
//  1) dotenv-Wrapper raus aus start/dev (backend+orchestrator+frontend) — Backend hängt sonst still
//  2) Backend- und Orchestrator-stdout in Dateien umleiten (pm2-Socket-Backpressure)
//  3) Medien-Pfade relativ in backend- UND orchestrator-dist (SSRF-Selbstblock + Doppelpräfix)
//  4) /app/.env wird im Dockerfile angelegt (Belt-and-braces)
// JEDER Patch wird verifiziert: Muster nicht gefunden → throw → Build failt (kein stilles kaputtes Image).
// Basis: gitroomhq/postiz-app v2.23.0 (2026-08-04, Release auf apollo)
const fs = require('fs');

const FAIL = [];
const LOG = [];

function patchFile(file, label, replaces, mustFind) {
  if (!fs.existsSync(file)) { FAIL.push(`FEHLT: ${file}`); return; }
  let src = fs.readFileSync(file, 'utf8');
  let changed = 0;
  for (const [from, to] of replaces) {
    const re = new RegExp(from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    const hits = src.match(re);
    if (hits) { changed += hits.length; src = src.replace(re, to); }
    else if (mustFind) { FAIL.push(`${label}: Muster fehlt in ${file}: ${from}`); }
  }
  if (changed > 0) {
    fs.writeFileSync(file, src);
    LOG.push(`${label}: ${file} (${changed} Stellen)`);
  } else {
    LOG.push(`${label}: keine Änderung nötig: ${file}`);
  }
}

const dotenv = [['dotenv -e ../../.env -- ', '']];
// package.json (start+dev-Skripte, beide dist-Bäume sind dist-Referenzen; nur package.json patchen)
patchFile('/app/apps/backend/package.json', 'dotenv', dotenv, true);
patchFile('/app/apps/frontend/package.json', 'dotenv', dotenv, true);
patchFile('/app/apps/orchestrator/package.json', 'dotenv', dotenv, true);
// Backend und Orchestrator: stdout nicht über den pm2-Socket leiten.
// Nach einem unRAID-Recreate blieb der Backend-Start sonst ohne Fehlerausgabe vor :3000 hängen.
patchFile('/app/apps/backend/package.json', 'backend-stdout', [
  ['node --experimental-require-module ./dist/apps/backend/src/main.js',
   'node --experimental-require-module ./dist/apps/backend/src/main.js > /tmp/backend.log 2>&1'],
], true);
// Der Orchestrator schreibt beim Start zusätzlich den Webpack-Bundle-Output.
patchFile('/app/apps/orchestrator/package.json', 'orchestrator-stdout', [
  ['node --experimental-require-module ./dist/apps/orchestrator/src/main.js',
   'node --experimental-require-module ./dist/apps/orchestrator/src/main.js > /tmp/orchestrator.log 2>&1'],
], true);
// Medien-Pfade: beide dist-Bäume (backend UND orchestrator — Activities laufen im Orchestrator)
const storage = [['process.env.FRONTEND_URL + \'/uploads\' + publicPath', '\'/uploads\' + publicPath']];
const posts = [
  ['process.env.UPLOAD_DIRECTORY + m.path', 'm.path'],
  ['process.env.UPLOAD_DIRECTORY + path', 'path'],
];
for (const app of ['backend', 'orchestrator']) {
  patchFile(`/app/apps/${app}/dist/libraries/nestjs-libraries/src/upload/local.storage.js`,
    'local.storage', storage, true);
  patchFile(`/app/apps/${app}/dist/libraries/nestjs-libraries/src/database/prisma/posts/posts.service.js`,
    'posts.service', posts, true);
  // youtubepartner is a Content-ID/CMS-partner scope and blocks normal channel OAuth.
  // Postiz does not use it for channel uploads or analytics, so omit it in both runtime bundles.
  patchFile(`/app/apps/${app}/dist/libraries/nestjs-libraries/src/integrations/social/youtube.provider.js`,
    'youtube-oauth-scope', [["            'https://www.googleapis.com/auth/youtubepartner',\n", '']], true);
}

console.log(LOG.join('\n'));
if (FAIL.length) {
  console.error('\nPATCH-FEHLER:');
  console.error(FAIL.join('\n'));
  process.exit(1);
}
console.log('\nAlle Patches OK ✔');
