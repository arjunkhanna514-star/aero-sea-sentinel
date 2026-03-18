# docker/frontend/Dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
ARG VITE_API_URL=http://localhost:4000/api/v1
ARG VITE_WS_URL=ws://localhost:4000/ws/telemetry
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY ../docker/frontend/nginx-spa.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=3 \
  CMD curl -fs http://localhost:80 || exit 1
CMD ["nginx", "-g", "daemon off;"]
