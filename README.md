# Postiz patched — dauerhafte Container-Fixes

Eigenes Image auf Basis des offiziellen `gitroomhq/postiz-app`, das die ephemeren Container-FS-Patches
(dotenv-Hang, Orchestrator-stdout-Backpressure, SSRF-Selbstblock durch absolute Medien-URLs) beim Build
einbrennt. Jeder Patch wird verifiziert — schlägt etwas fehl, failt der Build statt ein stilles kaputtes
Image zu liefern.

## Patches (session-verifiziert auf apollo, 2026-08-17)

1. **dotenv-Wrapper entfernen** — `dotenv -e ../../.env -- ` aus `start`/`dev` in
   `/app/apps/{backend,orchestrator,frontend}/package.json` (Backend hängt sonst still nach Restart,
   wenn `.env` fehlt/leer ist)
2. **Orchestrator-stdout umleiten** — `> /tmp/orchestrator.log 2>&1` ans `start`-Script des
   Orchestrators (Webpack-Bundle-Output blockiert pm2-Socket-stdout → Workflow-Tasks werden nie abgeholt)
3. **Medien-Pfade relativ** (backend **und** orchestrator dist):
   - `local.storage.js`: `process.env.FRONTEND_URL + '/uploads' + publicPath` → `'/uploads' + publicPath`
     (SSRF-Guard blockt die eigene Tailscale-IP 100.64/10 → „Blocked IP")
   - `posts.service.js` (`updateMedia`): `process.env.UPLOAD_DIRECTORY + m.path` → `m.path` und
     `process.env.UPLOAD_DIRECTORY + path` → `path` (verhindert `/uploads/uploads/…`-Doppelpräfix)
4. **Belt-and-braces**: `/app/.env` wird im Image angelegt (falls doch etwas versucht, es zu lesen)

## Build

`.github/workflows/build.yml` baut bei Push auf `main` und per `workflow_dispatch` (optional mit
`postiz-tag`-Input) und pusht nach `ghcr.io/lum1nat0r/postiz-patched`.

```bash
# lokal testen
docker build --build-arg POSTIZ_TAG=v2.23.0 -t postiz-patched:test .
```

## Deployment (apollo/unRAID)

- unRAID-Template `my-Postiz.xml`: Repository-Feld auf `ghcr.io/lum1nat0r/postiz-patched:latest` stellen
- Daten (Postgres `postiz`, `/uploads`-Mount, Env) bleiben unangetastet
- Nach Umstellung: Recreate → Backend 401 (`curl localhost:5100/api/user/self`), Orchestrator-Port 3002,
  ein Test-Post im UPLOAD-Modus
