FROM oven/bun:canary-debian

WORKDIR /project

# Copy dependency files first for better caching
COPY package.json bun.lock turbo.json ./

# Copy all packages and apps
COPY packages ./packages
COPY apps ./apps

# Install dependencies (use --frozen-lockfile for production)
RUN bun install --frozen-lockfile

# Generate Prisma Client
RUN cd apps/backend && bun prisma generate

# Build all applications
RUN bun run build

# Expose backend port
EXPOSE 8000

# Note: CMD will be overridden by docker-compose
CMD ["bun", "run", "start"]



