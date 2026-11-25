FROM node:24-alpine@sha256:44fce696f38ba8c987c4db89954051000bbd05ffd8d8659ba15ed4a8602e937f AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run check:locales && npm run check:ui-literals
RUN npm test
RUN npm run build

FROM nginx:1.30.7-alpine-slim@sha256:8c950211a641ec5b23f265450517001f6bcca533666120ebe36cb4cff3d00a55
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY security-headers.conf /etc/nginx/snippets/console-security.conf
COPY --from=build /app/dist /usr/share/nginx/html/console
COPY retain-assets.sh /docker-entrypoint.d/20-console-assets.sh
COPY licenses/runtime/nginx-1.30.7-LICENSE.txt /usr/share/licenses/nginx/UPSTREAM-LICENSE.txt
RUN --network=none chmod +x /docker-entrypoint.d/20-console-assets.sh \
    && test "$(nginx -v 2>&1)" = 'nginx version: nginx/1.30.7' \
    && echo '08845fe39e06b51dad7685c28140ab49577a86e947523e16b536a46caf89ad5c  /usr/share/licenses/nginx/UPSTREAM-LICENSE.txt' | sha256sum -c -
EXPOSE 8080
