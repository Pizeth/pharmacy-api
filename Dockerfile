# Stage 1: Build the NestJS application
FROM node:24.0-alpine AS builder

WORKDIR /usr/src/app

COPY package*.json package-lock.json ./ 
RUN yarn install --frozen-lockfile # or npm ci

COPY . .

# RUN yarn build # This runs `nest build` which creates the `dist` folder
RUN yarn build && ls -al /usr/src/app/dist

# Stage 2: Production image
FROM node:24.0-alpine AS production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

# Copy only the necessary files from the builder stage
COPY --from=builder /usr/src/app/package*.json ./
COPY --from=builder /usr/src/app/dist ./dist

# Install only production dependencies
RUN yarn install --production --frozen-lockfile # or npm ci --only=production

EXPOSE 3000

CMD ["node", "dist/main"]