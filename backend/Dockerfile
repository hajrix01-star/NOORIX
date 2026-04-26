# Noorix Backend — Dockerfile للنشر على Railway
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# مرحلة الإنتاج
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY package*.json ./
RUN npm ci --omit=dev

# مرفقات وOCR/HR: ربط volume خارجي بـ /app/uploads في الإنتاج وإلا تُفقد عند إعادة النشر
RUN mkdir -p /app/uploads
VOLUME ["/app/uploads"]

ENV NODE_ENV=production

EXPOSE 3000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
