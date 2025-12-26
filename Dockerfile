FROM oven/bun:canary-debian

WORKDIR /project

# Copy dependency files first for better caching
COPY package.json bun.lock turbo.json ./

# Copy all packages and apps
COPY packages ./packages
COPY apps ./apps

# Install dependencies (use --frozen-lockfile for production)
RUN bun install --frozen-lockfile

# Set DATABASE_URL for Prisma config (prisma.config.ts needs this)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

# Generate Prisma Client (uses prisma.config.ts which reads DATABASE_URL from env)
RUN cd apps/backend && bun prisma generate

# Unset the dummy URL (real one will come from runtime env)
ENV DATABASE_URL=""

# Build all applications
RUN bun run build

# Expose backend port
EXPOSE 8000

# Note: CMD will be overridden by docker-compose
CMD ["bun", "run", "start"]



