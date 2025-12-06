# Backend Dockerfile for TypeScript
FROM node:18-alpine AS builder

# Update package index and install build dependencies for native modules
RUN apk update && apk add --no-cache sqlite python3 make gcc g++ musl-dev

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install all dependencies (including dev dependencies for building)
RUN npm ci

# Copy source code
COPY src ./src

# Build TypeScript to JavaScript
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Update package index and install SQLite, python, make and g++ for native modules
RUN apk update && apk add --no-cache sqlite python3 make gcc g++ musl-dev curl

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S backend -u 1001

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy built application from builder stage
COPY --from=builder /app/dist ./dist

# Copy tsconfig-paths bootstrap for path mapping
COPY tsconfig-paths-bootstrap.js ./

# Create necessary directories
RUN mkdir -p uploads data logs
RUN chown -R backend:nodejs /app

# Switch to non-root user
USER backend

# Expose port
EXPOSE 3001

# Health check - increased start period for database initialization
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD "curl -f http://localhost:3001/api/health"

# Start the server
CMD ["npm", "start"]
