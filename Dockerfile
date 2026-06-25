# Stage 1: Build the NestJS application
FROM node:26-alpine3.24 AS builder

WORKDIR /usr/src/app

# Copy package files for npm
COPY package.json package-lock.json ./ 

# Install all dependencies (including devDependencies needed for build)
RUN npm ci

COPY . .

RUN npm run build

# Stage 2: Production image
FROM node:26-alpine3.24 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Copy package files and the compiled dist folder
COPY package.json package-lock.json ./
COPY --from=builder /usr/src/app/dist ./dist

# Install only production dependencies
RUN npm ci --only=production

EXPOSE 3000

CMD ["node", "dist/main"]