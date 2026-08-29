FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json tsconfig.json ./
RUN npm install
COPY src ./src
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist
COPY public ./public
COPY agents ./agents

RUN mkdir -p /app/data /var/backups/dalibackup

EXPOSE 3000

ENV NODE_ENV=production
ENV DATABASE_FILE=/app/data/dalibackup.db

CMD ["node", "dist/server.js"]
