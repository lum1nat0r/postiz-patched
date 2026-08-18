# Postiz patched — baut auf das offizielle Image und brennt die Container-Fixes ein.
# POSTIZ_TAG pinned (Default: v2.23.0 = Release auf apollo); Update = Tag bumpen.
ARG POSTIZ_TAG=v2.23.0
FROM gitroomhq/postiz-app:${POSTIZ_TAG}

# Patch-Skript + Verifikation: apply.js wirft bei jedem nicht-gefundenen Muster → Build failt
COPY patches/apply.js /tmp/apply.js
RUN node /tmp/apply.js && rm -f /tmp/apply.js

# Belt-and-braces: falls doch ein Bestandteil .env lesen will (dotenv-Wrapper ist entfernt)
RUN touch /app/.env
