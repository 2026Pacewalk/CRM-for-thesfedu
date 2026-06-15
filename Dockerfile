# Production image for the theSFedu CRM (VPS deploy).
# Builds against PostgreSQL (see docker-compose.yml).
FROM node:20-alpine

# Prisma needs OpenSSL on Alpine.
RUN apk add --no-cache openssl libc6-compat

WORKDIR /app

# Install dependencies (cached unless package files change).
COPY package.json package-lock.json* ./
RUN npm ci

# Copy source and build against PostgreSQL.
COPY . .
RUN node scripts/set-db-provider.mjs postgres \
  && npm run build

ENV NODE_ENV=production
EXPOSE 3000

# On start: sync the schema to the database, then run the server.
# (Demo data is seeded once, manually — see DEPLOYMENT.md.)
CMD ["sh", "-c", "npx prisma db push --skip-generate && npx next start -p 3000"]
