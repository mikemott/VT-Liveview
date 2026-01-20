# VT-LiveView Backend Dockerfile
# Node 20 Alpine for minimal image size

FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install all dependencies (including dev for TypeScript build)
RUN npm ci

# Build stage - compile TypeScript
FROM deps AS builder
WORKDIR /app

# Copy source code and TypeScript config
COPY src ./src
COPY tsconfig.json ./

# Build TypeScript
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nodejs

# Install wget for healthcheck (not in base alpine image)
RUN apk add --no-cache wget

# Copy package files and install production deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy compiled JavaScript from builder
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Copy GraphQL schema (needed at runtime)
COPY --chown=nodejs:nodejs src/schema.graphql ./dist/

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Start the server
CMD ["node", "dist/server.js"]
