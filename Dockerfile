# ============================================================================
# DaliBackup-OSS (Open Source Software Edition)
# Developed by: Bastien LANGUEDOC (Daliranas)
# Official Website: https://daliranas.fr
# Copyright (c) 2026 Bastien LANGUEDOC. All rights reserved.
# ============================================================================

# Stage 1: Build & TypeScript Compilation
FROM node:22-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package*.json tsconfig.json ./
RUN npm ci

# Copy source code and compile TypeScript
COPY src ./src
RUN npm run build

# Stage 2: Production Lightweight Runtime
FROM node:22-alpine AS runner

LABEL maintainer="Bastien LANGUEDOC (Daliranas) <contact@daliranas.fr>"
LABEL org.opencontainers.image.title="DaliBackup-OSS"
LABEL org.opencontainers.image.description="Sovereign Backup & Disaster Recovery Engine for Microsoft Hyper-V, Proxmox VE and IMAP Mailboxes"
LABEL org.opencontainers.image.url="https://daliranas.fr"
LABEL org.opencontainers.image.source="https://github.com/daliranas/DaliBackup-OSS"
LABEL org.opencontainers.image.version="1.0.0"

WORKDIR /app

# Install curl for container health check
RUN apk add --no-cache curl tzdata

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy compiled artifacts, UI assets, and hypervisor agents
COPY --from=builder /app/dist ./dist
COPY public ./public
COPY agents ./agents
COPY LICENSE NOTICE README.md ./

# Create persistent storage directories
RUN mkdir -p /app/data /var/backups/dalibackup

# Expose HTTP (3000) and HTTPS (3443) ports
EXPOSE 3000 3443

# Production Environment Settings
ENV NODE_ENV=production
ENV PORT=3000
ENV SSL_PORT=3443
ENV HOST=0.0.0.0
ENV DATABASE_FILE=/app/data/dalibackup.db
ENV DEFAULT_LOCAL_STORAGE_PATH=/var/backups/dalibackup

# Healthcheck probe (checks API status every 30s)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start Server
CMD ["node", "dist/server.js"]
