# ---- Builder ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app

# Instala dependências com cache eficiente
COPY package*.json ./
RUN npm ci

# Gera o Prisma Client (precisa do schema antes do restante do código)
COPY prisma ./prisma
RUN npx prisma generate

# Compila a aplicação
COPY . .
RUN npm run build

# Remove as dependências de desenvolvimento (jest, stryker, ts-node, eslint…):
# a imagem final não as precisa e cada pacote a mais é superfície a mais. O
# CLI do Prisma fica, porque o `migrate deploy` do CMD roda a partir dele.
RUN npm prune --omit=dev

# ---- Runner ----
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Diretório do volume das imagens do ENEM (/data/enem-media), com posse do
# usuário não-root `node`. O banco é o serviço `db` (PostgreSQL) do compose.
RUN mkdir -p /data && chown -R node:node /data

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000
USER node

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"

# Aplica migrations pendentes e sobe a API.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
