# ---------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------
FROM node:26-alpine3.24 AS builder

WORKDIR /usr/src/app

# Native build toolchain.
#
# Required only while dependencies/native addons are being prepared.
RUN apk add --no-cache python3 make g++

# ---------------------------------------------------------------
# Dependencies
# ---------------------------------------------------------------
COPY package.json package-lock.json ./ 

# TEMPORARY:
#
# --legacy-peer-deps is currently required because several ecosystem
# packages have not widened their peer ranges to NestJS 12 yet:
#
#   @nestjs/throttler
#   nestjs-cls
#   @thallesp/nestjs-better-auth
#   nestjs-zod
#
# Remove this when those packages officially support Nest 12.
RUN npm ci --legacy-peer-deps

# ---------------------------------------------------------------
# Application source
# ---------------------------------------------------------------

COPY . .

# ---------------------------------------------------------------
# Prisma generation
# ---------------------------------------------------------------
#
# Prisma Client is generated before the application bundle so Rspack
# can compile the generated client together with the rest of src/.
RUN npx prisma generate

# ---------------------------------------------------------------
# Production application build
# ---------------------------------------------------------------
#
# package.json prebuild automatically executes:
#
#   npm run generate:dicebear
#
# followed by our NestJS 12 + Rspack build.
RUN npm run build

# ---------------------------------------------------------------
# Remove development dependencies
# ---------------------------------------------------------------
#
# The production image can reuse this node_modules tree because both
# stages use exactly the same Node + Alpine base.
#
# --ignore-scripts prevents package lifecycle scripts from executing a
# second time while pruning.
RUN npm prune --omit=dev --ignore-scripts --legacy-peer-deps

# ---------------------------------------------------------------
# Stage 2: Runtime
# ---------------------------------------------------------------
FROM node:26-alpine3.24 AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

# ---------------------------------------------------------------
# Runtime application
# ---------------------------------------------------------------

COPY package.json package-lock.json ./

# Reuse production-only dependencies prepared in the builder.
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Compiled NestJS application.
COPY --from=builder /usr/src/app/dist ./dist

# ---------------------------------------------------------------
# Prisma generated client
# ---------------------------------------------------------------
#    
#🟢 CRITICAL FIX for Custom Output Paths: 
#
# Keep this for now because Prisma Client uses a custom source output directory.
#
# Depending on exactly how much Rspack bundles, we may later confirm
# that this copy is redundant, but there is no need to remove it during
# the NestJS migration.
COPY --from=builder /usr/src/app/src/generated/prisma ./src/generated/prisma


# ---------------------------------------------------------------
# Networking
# ---------------------------------------------------------------
EXPOSE 3000

# ---------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------
#
# Northflank injects secrets/runtime configuration into process.env.
#
# No Infisical CLI or secret-fetching process is required inside this
# image when using the Northflank secret sync.
CMD ["node", "--enable-source-maps", "dist/main.js"]