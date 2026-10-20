# ── Build ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
RUN npm ci -w frontend --include-workspace-root=false
COPY frontend frontend
# The API must be reachable at build time only for pre-rendering; pages
# fall back gracefully and revalidate at runtime if it isn't.
ARG API_URL=http://api:4000
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID=
ENV API_URL=$API_URL NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
RUN npm run build -w frontend

# ── Run ────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
RUN npm ci -w frontend --include-workspace-root=false --omit=dev && npm cache clean --force
COPY --from=build /app/frontend/.next frontend/.next
COPY frontend/public frontend/public
COPY frontend/next.config.ts frontend/
WORKDIR /app/frontend
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
