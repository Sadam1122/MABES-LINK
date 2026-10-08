FROM node:22-alpine AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma.config.ts ./
COPY prisma ./prisma
COPY scripts/load-env.ts ./scripts/load-env.ts
COPY lib/database-url.ts ./lib/database-url.ts
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund --fetch-retries=5

FROM dependencies AS build
COPY . .
ARG NEXT_PUBLIC_MAP_TILE_URL=https://tile.openstreetmap.org/{z}/{x}/{y}.png
ARG NEXT_PUBLIC_MAP_ATTRIBUTION=OpenStreetMap_contributors
ARG NEXT_PUBLIC_MAP_MAX_ZOOM=19
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build
ENV NEXT_PUBLIC_MAP_TILE_URL=$NEXT_PUBLIC_MAP_TILE_URL
ENV NEXT_PUBLIC_MAP_ATTRIBUTION=$NEXT_PUBLIC_MAP_ATTRIBUTION
ENV NEXT_PUBLIC_MAP_MAX_ZOOM=$NEXT_PUBLIC_MAP_MAX_ZOOM
ENV NEXT_TELEMETRY_DISABLED=1
RUN BETTER_AUTH_SECRET=build-only-not-a-runtime-secret-000000 BETTER_AUTH_URL=http://localhost:3000 sh -c 'npx prisma generate && npm run build'

FROM dependencies AS production-dependencies
RUN npm prune --omit=dev --no-audit --no-fund && npx prisma generate

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --chown=node:node --from=production-dependencies /app/node_modules ./node_modules
COPY --chown=node:node --from=build /app/.next ./.next
COPY --chown=node:node --from=build /app/app ./app
COPY --chown=node:node --from=build /app/components ./components
COPY --chown=node:node --from=build /app/lib ./lib
COPY --chown=node:node --from=build /app/public ./public
COPY --chown=node:node --from=build /app/worker ./worker
COPY --chown=node:node --from=build /app/scripts ./scripts
COPY --chown=node:node --from=build /app/prisma ./prisma
COPY --chown=node:node --from=build /app/package.json /app/package-lock.json /app/prisma.config.ts /app/next.config.ts /app/tsconfig.json ./
RUN mkdir -p /data/uploads && chown -R node:node /data
USER node
EXPOSE 3000
CMD ["node", "node_modules/next/dist/bin/next", "start", "--hostname", "0.0.0.0"]
