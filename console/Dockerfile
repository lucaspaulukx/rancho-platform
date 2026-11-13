FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run check:locales
RUN npm test
RUN npm run build

FROM nginx:1.30.6-alpine-slim@sha256:e2355aa95529a7999dad94ddcb45a8768abf6fb0b204c93b1a3ffce477d7b893
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/console-security.conf
COPY --from=build /app/dist /usr/share/nginx/html/console
COPY retain-assets.sh /docker-entrypoint.d/20-console-assets.sh
RUN chmod +x /docker-entrypoint.d/20-console-assets.sh
EXPOSE 8080
