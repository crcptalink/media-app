# syntax=docker/dockerfile:1
# CRC Media image, sized for the church PC (Core i3-550, 3.2 GiB RAM).
# Stages are a single chain so BuildKit does not run npm ci and `next build`
# at the same time. The runtime image is the Next.js standalone server plus
# the Prisma CLI (migrations) and tsx (npm run seed).

FROM node:20-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates tzdata \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# Cache the npm tarball store across builds. Lifecycle scripts (prisma generate)
# run in the foreground so they are not a second heavy process beside npm.
RUN --mount=type=cache,target=/root/.npm \
    npm ci --no-audit --no-fund --foreground-scripts

FROM deps AS build
COPY . .
ENV NODE_OPTIONS="--max-old-space-size=1536" \
    UV_THREADPOOL_SIZE=1
# Drop any Next cache that arrived with the sources so the compile cannot reuse a stale .next.
RUN rm -rf .next && npm run build && node docker/stage-runtime-deps.mjs

FROM base AS run
ENV NODE_ENV=production \
    TZ=Africa/Johannesburg \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_OPTIONS="--max-old-space-size=384"
COPY --from=build /app/public ./public
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/src ./src
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/scripts/notify-deploy.js ./scripts/notify-deploy.js
COPY --from=build /app/scripts/import-link-2026.js ./scripts/import-link-2026.js
COPY --from=build /app/scripts/tidy-live.js ./scripts/tidy-live.js
COPY --from=build /opt/extra/node_modules ./node_modules
COPY docker/entrypoint.sh ./docker/entrypoint.sh
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "docker/entrypoint.sh"]
