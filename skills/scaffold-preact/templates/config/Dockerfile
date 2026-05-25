# Multi-stage: build with Node, serve static with nginx.
# Build context MUST be the project root, e.g.:
#   docker build -f config/Dockerfile -t app .

FROM node:22-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml* package-lock.json* yarn.lock* ./
RUN if [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile; \
    elif [ -f yarn.lock ]; then yarn install --frozen-lockfile; \
    else npm ci; fi
COPY . .
RUN if [ -f pnpm-lock.yaml ]; then pnpm build; \
    elif [ -f yarn.lock ]; then yarn build; \
    else npm run build; fi

FROM nginx:1.27-alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
# SPA fallback: serve index.html for unknown routes.
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
