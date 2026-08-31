# ---------------------------------------------------------------
# Stage 1: Build
# ---------------------------------------------------------------
FROM node:26-alpine3.24 AS builder

WORKDIR /usr/src/app

# ---------------------------------------------------------------
# Native build dependencies
# ---------------------------------------------------------------
#
# Required while installing/building native dependencies such as
# bcrypt/farmhash.
RUN apk add --no-cache python3 make g++

# ---------------------------------------------------------------
# Dependency installation
# ---------------------------------------------------------------
#
# Copy only package manifests first so Docker can cache this layer.
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
#
# Source must exist before application-specific generation scripts run.
COPY . .

# ---------------------------------------------------------------
# Prisma Client generation
# ---------------------------------------------------------------
#
# Prisma Client is generated before the application bundle under src/generated/prisma, 
# so Rspack can compile the generated client together with the rest of src/.
RUN npx prisma generate

# ---------------------------------------------------------------
# Production application build
# ---------------------------------------------------------------
#
# package.json contains:
#
#   "prebuild": "npm run generate:dicebear"
#
# Therefore this command performs:
#
#   DiceBear generation
#       ↓
#   NestJS 12 / Rspack build
#
# Do NOT run generate:dicebear separately here.
RUN npm run build

# ---------------------------------------------------------------
# Remove development dependencies
# ---------------------------------------------------------------
# 
#Remove development dependencies before copying node_modules into
# the final runtime image.
#
# The production image can reuse this node_modules tree because both
# stages use exactly the same Node + Alpine base.
#
# --ignore-scripts prevents package lifecycle scripts from executing a
# second time while pruning.
RUN npm prune --omit=dev --ignore-scripts --legacy-peer-deps

# ---------------------------------------------------------------
# Stage 2: Production  Runtime
# ---------------------------------------------------------------
FROM node:26-alpine3.24 AS production

ENV NODE_ENV=production

WORKDIR /usr/src/app

# ---------------------------------------------------------------
# Runtime package metadata
# ---------------------------------------------------------------
COPY package.json package-lock.json ./

# ---------------------------------------------------------------
# Production dependencies
# ---------------------------------------------------------------
#
# Both stages use the same Node/Alpine environment, so native
# dependencies are ABI-compatible.
COPY --from=builder /usr/src/app/node_modules ./node_modules

# ---------------------------------------------------------------
# Compiled NestJS application
# ---------------------------------------------------------------
COPY --from=builder /usr/src/app/dist ./dist

# ---------------------------------------------------------------
# Generated Prisma Client
# ---------------------------------------------------------------
#    
#🟢 CRITICAL FIX for Custom Output Paths: 
#
# Keep this while the application imports Prisma from the custom:
#
#   src/generated/prisma
#
# output location.
COPY --from=builder /usr/src/app/src/generated/prisma ./src/generated/prisma


# ---------------------------------------------------------------
# Networking
# ---------------------------------------------------------------
EXPOSE 3000

# ---------------------------------------------------------------
# Runtime
# ---------------------------------------------------------------
#
# Northflank / Infisical provides configuration through process.env.
#
# No HMR, watcher, Nest CLI, TypeScript compiler, Prisma CLI, or
# secret-fetching process is required in production.
CMD ["node", "--enable-source-maps", "dist/main.js"]