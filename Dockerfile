FROM node:20-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build \
 && npm prune --omit=dev

FROM base AS runner
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Install the claude CLI inside the image so the import service can shell out
# to it. Credentials come from a bind-mounted ~/.claude at runtime.
RUN npm install -g @anthropic-ai/claude-code \
 && claude --version

# Run as the host user (uid 1000) so bind-mounted ~/.claude and ./data are
# readable/writable without chown gymnastics. docker-compose.yml pins the
# uid; this just creates a matching account for $HOME resolution.
RUN groupadd --system --gid 1000 app \
 && useradd  --system --uid 1000 --gid app --create-home --home-dir /home/app app

COPY --from=builder --chown=app:app /app/package.json /app/package-lock.json ./
COPY --from=builder --chown=app:app /app/.next ./.next
COPY --from=builder --chown=app:app /app/public ./public
COPY --from=builder --chown=app:app /app/node_modules ./node_modules
COPY --from=builder --chown=app:app /app/next.config.mjs ./

RUN mkdir -p /app/data && chown -R app:app /app/data
VOLUME ["/app/data"]
ENV DATABASE_URL=/app/data/personalcrm.sqlite
ENV HOME=/home/app

USER app
EXPOSE 3000
CMD ["npm", "start"]
