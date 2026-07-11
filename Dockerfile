# Container for the standalone GrowEasy backend (server/index.mjs).
# The frontend is deployed separately (e.g. Vercel); this image is the Node API.
FROM node:20-alpine

WORKDIR /app

# Install only what the backend needs. It shares the repo's dependencies
# (@next/env for env loading, zod for validation), so we install from the
# root manifest with a reproducible, production-only install.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Backend code + the shared extraction logic it imports.
COPY server ./server
COPY src/lib ./src/lib

ENV NODE_ENV=production
ENV BACKEND_PORT=4000
EXPOSE 4000

# Basic liveness check against the /health endpoint.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.BACKEND_PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server/index.mjs"]
