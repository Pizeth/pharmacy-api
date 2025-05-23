# Use an official Node.js runtime as a parent image
FROM node:24.0-alpine As development

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm install --only=development

COPY . .

RUN npm run build

FROM node:24.0-alpine as production

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --only=production

COPY --from=development /usr/src/app/dist ./dist

# Your application's default port (NestJS often uses 3000)
EXPOSE 3000

# Command to run your application
CMD ["node", "dist/main"]