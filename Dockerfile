# Stage 1: Build the NestJS application
FROM node:26-alpine3.24 AS builder

WORKDIR /usr/src/app

# Install build tools needed for native packages (bcrypt, farmhash)
RUN apk add --no-cache python3 make g++

# Copy package files for npm
COPY package.json package-lock.json ./ 

# 1. Install dependencies (including devDependencies needed for build) without running postinstall scripts yet
RUN npm ci --ignore-scripts

# 2. Copy your source code (needed for your scripts to work)
COPY . .

# 3. Generate Prisma client & execute the custom dicebear setup scripts
RUN npx prisma generate && npm run generate:dicebear
# RUN npx prisma generate
# RUN npm run generate:dicebear

# 4. Run the final production build, 
# Webpack now copies the assets into dist/ during this step
RUN npm run build

# Stage 2: Production image
FROM node:26-alpine3.24 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Production stage also requires build tools to compile bcrypt/farmhash dependencies
RUN apk add --no-cache python3 make g++

# Copy package files and the compiled dist folder
COPY package.json package-lock.json ./
COPY --from=builder /usr/src/app/dist ./dist

# 🟢 CRITICAL FIX for Custom Output Paths: 
# Copy the generated client folder (which contains the binary engines Webpack needs to execute)
COPY --from=builder /usr/src/app/src/generated/prisma ./src/generated/prisma
COPY --from=builder /usr/src/app/prisma ./prisma

# Install only production assets while bypassing hooks
RUN npm ci --only=production --ignore-scripts

EXPOSE 3000

# Generate production Prisma Client bindings
# 🛑 REMOVED: "RUN npx prisma generate" is no longer needed here because 
# the compiled engine binaries are cleanly copied from the builder stage above.
# RUN npx prisma generate

# Execute natively. Northflank will handle secret injection!
CMD ["node", "dist/main"]