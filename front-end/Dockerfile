# Front-end em produção (RNF09): build do Vite + Caddy servindo o dist/.
#
# O Caddy também faz o proxy das rotas da API (mesmo domínio, sem prefixo, por
# causa do cookie de refresh com path=/auth) e obtém o certificado HTTPS
# sozinho (Let's Encrypt) para o domínio definido em DOMINIO.

# --- Etapa 1: build ---
FROM node:26-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Vazio = a API é chamada no mesmo endereço do front (ex.: /auth/login).
ARG VITE_API_URL=""
RUN VITE_API_URL="$VITE_API_URL" npm run build

# --- Etapa 2: servidor ---
FROM caddy:2-alpine
COPY Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
EXPOSE 80 443 443/udp
