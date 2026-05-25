# Multi-stage NestJS build. Build context must be the project root:
#   docker build -f config/Dockerfile -t app .

# ── Deps (full) ────────────────────────────────────────────────────────
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; else npm ci; fi

# ── Build ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm build; else npm run build; fi

# Prune dev deps
RUN if [ -f pnpm-lock.yaml ]; then pnpm prune --prod; else npm prune --production; fi

# ── Runtime ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
EXPOSE 3000
USER node
CMD ["node", "dist/main"]
