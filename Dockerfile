# Postiz patched — baut auf das offizielle Image (GHCR, NICHT Docker Hub!) und brennt die Container-Fixes ein.
# Offizielles Image liegt unter ghcr.io/gitroomhq/postiz-app — Tags sind NUR latest + Timestamps (keine v-Tags!).
ARG POSTIZ_TAG=latest
FROM ghcr.io/gitroomhq/postiz-app:${POSTIZ_TAG}

# Patch-Skript + Verifikation: apply.js wirft bei jedem nicht-gefundenen Muster → Build failt
COPY patches/apply.js /tmp/apply.js
RUN node /tmp/apply.js && rm -f /tmp/apply.js

# Belt-and-braces: falls doch ein Bestandteil .env lesen will (dotenv-Wrapper ist entfernt)
RUN touch /app/.env
