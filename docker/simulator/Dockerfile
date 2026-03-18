# docker/simulator/Dockerfile
FROM node:20-alpine
RUN apk add --no-cache curl
WORKDIR /app
COPY package.json ./
RUN npm install
COPY simulator.js .
CMD ["node", "simulator.js"]
