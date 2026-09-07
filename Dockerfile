FROM node:22-alpine AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
ARG VCS_REF=unknown
RUN pnpm build && printf '{"commit":"%s"}\n' "$VCS_REF" > /app/dist/estoma-app/browser/version.json

FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist/estoma-app/browser /usr/share/nginx/html

ARG VCS_REF=unknown
LABEL org.opencontainers.image.source="https://github.com/AnthonyNav/estoma-app"
LABEL org.opencontainers.image.revision=$VCS_REF

EXPOSE 8080
