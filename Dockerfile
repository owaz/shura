# ============ Stage 1: Build Frontend ============
FROM node:24-alpine AS frontend-build

# Declare build-time vars so Vite can bake them in at build time
ARG VITE_AUTH0_DOMAIN
ARG VITE_AUTH0_CLIENT_ID
ARG VITE_AUTH0_AUDIENCE
ARG VITE_API_URL
ARG VITE_WS_URL

ENV VITE_AUTH0_DOMAIN=$VITE_AUTH0_DOMAIN
ENV VITE_AUTH0_CLIENT_ID=$VITE_AUTH0_CLIENT_ID
ENV VITE_AUTH0_AUDIENCE=$VITE_AUTH0_AUDIENCE
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

WORKDIR /app/frontend
COPY shura-frontend/package*.json ./
RUN npm ci
COPY shura-frontend/ ./
RUN npm run build

# ============ Stage 2: Production Image ============
FROM node:24-alpine AS production
WORKDIR /app

# Install backend dependencies
COPY shura-backend/package*.json ./
RUN npm ci --omit=dev

# Copy backend source
COPY shura-backend/ ./

# Copy built frontend into backend's public directory
COPY --from=frontend-build /app/frontend/dist ./public

ENV NODE_ENV=production
ENV PORT=5001

EXPOSE 5001

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:5001/api/health || exit 1

CMD ["node", "server.js"]
