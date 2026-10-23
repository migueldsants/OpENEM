# Imagem do nginx com o site público (landing + documentação) na raiz e o app
# (PWA) em /app/ (issue #88). O contexto de build é a RAIZ do repositório: o
# site importa o CSS, o boot do tema e o catálogo de redações do app.
#   docker build -f openem_frontend/Dockerfile .
# O que entra no contexto está em Dockerfile.dockerignore, ao lado deste.

# ---- Builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /repo

# Dependências primeiro, para o cache das camadas sobreviver a mudança de código.
COPY openem_frontend/package*.json openem_frontend/
RUN cd openem_frontend && npm ci
COPY openem_site/package*.json openem_site/
RUN cd openem_site && npm ci

COPY openem_frontend/ openem_frontend/
COPY openem_site/ openem_site/

RUN cd openem_frontend && npm run build

# Domínio da instalação (ex.: https://openem.exemplo), para o sitemap e as URLs
# absolutas do Open Graph. Vazio: sem sitemap, URLs relativas.
ARG SITE_URL=
RUN cd openem_site && SITE_URL="$SITE_URL" npm run build && npm run check:links

# ---- Runner (nginx servindo os estáticos) ----
FROM nginx:1.27-alpine AS runner
COPY openem_frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /repo/openem_site/dist /usr/share/nginx/html
COPY --from=builder /repo/openem_frontend/dist /usr/share/nginx/html/app
EXPOSE 80
