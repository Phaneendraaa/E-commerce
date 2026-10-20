# ── Build ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci -w backend --include-workspace-root=false
COPY backend backend
RUN npm run build -w backend

# ── Run ────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY backend/package.json backend/
RUN npm ci -w backend --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
COPY backend/drizzle backend/drizzle
WORKDIR /app/backend
EXPOSE 4000
# Apply pending migrations, then start the API
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/server.js"]
