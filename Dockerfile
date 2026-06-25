# Stage 1: Build the NestJS application
FROM node:26-alpine3.24 AS builder

WORKDIR /usr/src/app

# CRITICAL: Copy yarn.lock if you are using Yarn!
COPY package.json yarn.lock ./ 

RUN yarn install --frozen-lockfile

COPY . .

RUN yarn build

# Stage 2: Production image
FROM node:26-alpine3.24 AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Copy package files AND yarn.lock for production install
COPY package.json yarn.lock ./
COPY --from=builder /usr/src/app/dist ./dist

# Install only production dependencies
RUN yarn install --production --frozen-lockfile

EXPOSE 3000

CMD ["node", "dist/main"]