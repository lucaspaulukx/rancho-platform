FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS stream-proxy
ENV GO111MODULE=off GOPATH=/go
WORKDIR /go/src/github.com/rancher/websocket-proxy
COPY websocket-proxy .
RUN --network=none go test -vet=off -count=1 -tags=test ./proxy ./backend ./proxy/... && \
    go test -race -vet=off -count=1 -tags=test ./proxy -run 'TestHostStream' && \
    CGO_ENABLED=0 go build -buildvcs=false -trimpath -o /out/websocket-proxy . && \
    mkdir -p /out/licenses && \
    find . -type f \( -iname '*license*' -o -iname 'notice*' -o -iname 'copying*' -o -iname 'patents*' \) -exec cp --parents '{}' /out/licenses/ \;

FROM rancher/server:v1.6.30@sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91
COPY --from=stream-proxy /out/websocket-proxy /usr/bin/websocket-proxy
COPY --from=stream-proxy /out/licenses /usr/share/doc/community-websocket-proxy
ENV RANCHER_HOST_STREAM_PROXY_PROTOCOL=1
COPY cattle /lab/cattle
COPY legacy-ui /lab/web
COPY build-overlay.sh /lab/build-overlay.sh
COPY migration/sql/001-local-groups.sql /lab/schema/001-local-groups.sql
RUN bash /lab/build-overlay.sh
ENV CATTLE_PROJECT_CREATE_DEFAULT=true
ENV DEFAULT_CATTLE_PROJECT_CREATE_DEFAULT=true
ENV CATTLE_JAVA_OPTS="-Xms128m -Xmx1536m"
ENV DEFAULT_CATTLE_CATALOG_EXECUTE=true
ENV DEFAULT_CATTLE_API_UI_INDEX=local
