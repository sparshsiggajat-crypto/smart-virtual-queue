FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_FILE=/data/data.json
COPY --from=build /app/dist ./dist
COPY server.mjs package.json ./
RUN mkdir -p /data
EXPOSE 3001
CMD ["node", "server.mjs"]
