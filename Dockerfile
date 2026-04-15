# ----- Stage 1: Build -----
FROM node:18-alpine AS builder

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies including devDependencies for build
RUN npm install

# Copy source code and config
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the app
RUN npm run build

# ----- Stage 2: Productive Runtime -----
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies only
RUN npm install --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist
# Copy prisma schema for runtime generation if needed (though usually client is enough)
COPY --from=builder /app/prisma ./prisma
# Copy the node_modules/.prisma because the client depends on it
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set environment to production
ENV NODE_ENV=production

# Expose the API port
EXPOSE 4000

# Start command
CMD ["node", "dist/main.js"]
