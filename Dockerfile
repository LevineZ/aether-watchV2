FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY packages/field/package.json packages/field/package.json
COPY packages/particles/package.json packages/particles/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm generate && pnpm --filter @aether/web build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8765 HOST=0.0.0.0
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/apps/web/server.mjs ./apps/web/server.mjs
# server.mjs imports ../../scripts/field-cache/http.mjs — required at runtime
COPY --from=build /app/scripts/field-cache ./scripts/field-cache
EXPOSE 8765
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=8 \
  CMD node -e "fetch('http://127.0.0.1:8765/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/web/server.mjs"]
