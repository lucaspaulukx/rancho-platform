FROM golang:1.27.3-bookworm@sha256:d9b6a1beb9474adc2a1ce842573639b44b2a0dd49b6669f51d3821baf9ec37c9 AS stream-proxy
ENV GO111MODULE=off GOPATH=/go
WORKDIR /go/src/github.com/rancher/websocket-proxy
COPY websocket-proxy .
RUN --network=none go test -vet=off -count=1 -tags=test ./proxy ./backend ./proxy/... && \
    go test -race -vet=off -count=1 -tags=test ./proxy -run 'TestHostStream' && \
    CGO_ENABLED=0 go build -buildvcs=false -trimpath -o /out/websocket-proxy . && \
    mkdir -p /out/licenses && \
    find . -type f \( -iname '*license*' -o -iname 'notice*' -o -iname 'copying*' -o -iname 'patents*' \) -exec cp --parents '{}' /out/licenses/ \;

FROM scratch AS runtime-jars
ADD --checksum=sha256:53ca085f4a150f703f49e1aabd935bd03b43e1ea3d55d135438292af22cef56b https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.21/jackson-annotations-2.21.jar /jackson/jackson-annotations-2.21.jar
ADD --checksum=sha256:604ef7765013daf5cde192e40bc4c8412c4ca93f4aaf7bf8e9a62fad1e1026bb https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-core/2.21.8/jackson-core-2.21.8.jar /jackson/jackson-core-2.21.8.jar
ADD --checksum=sha256:ad77f2285717e2f34c319d988b7c85783a47d0b33f33a501d1fcbf196e61bbaa https://repo.maven.apache.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.21.8/jackson-databind-2.21.8.jar /jackson/jackson-databind-2.21.8.jar
ADD --checksum=sha256:424325e2cf21246bff27f8c30659a6c2da90b7f8b7d138cf7d04535df051c6c1 https://repo.maven.apache.org/maven2/com/fasterxml/jackson/jaxrs/jackson-jaxrs-base/2.21.8/jackson-jaxrs-base-2.21.8.jar /jackson/jackson-jaxrs-base-2.21.8.jar
ADD --checksum=sha256:cd9e9b2c25f0f309d05eadef1f6d50eb0dada930396128274470dc0845a6314c https://repo.maven.apache.org/maven2/com/fasterxml/jackson/jaxrs/jackson-jaxrs-json-provider/2.21.8/jackson-jaxrs-json-provider-2.21.8.jar /jackson/jackson-jaxrs-json-provider-2.21.8.jar
ADD --checksum=sha256:32a3b1ac114a3547c3ceb6e5a48091372de097e5fb6f87d660b18a2665405c36 https://repo.maven.apache.org/maven2/com/fasterxml/jackson/module/jackson-module-jaxb-annotations/2.21.8/jackson-module-jaxb-annotations-2.21.8.jar /jackson/jackson-module-jaxb-annotations-2.21.8.jar
ADD --checksum=sha256:0fac87dddd78f1223139e8ef88e819c7f483c0a3835cdf5982ad5e4576d1d896 https://repo.maven.apache.org/maven2/org/freemarker/freemarker/2.3.35/freemarker-2.3.35.jar /freemarker/freemarker-2.3.35.jar
ADD --checksum=sha256:8fcf4a978bbee7548e8dee6e0528bc85b0ffa84c0f8517c94dd29e590e459449 https://repo.maven.apache.org/maven2/com/nimbusds/nimbus-jose-jwt/9.37.4/nimbus-jose-jwt-9.37.4.jar /nimbus/nimbus-jose-jwt-9.37.4.jar

FROM rancher/server:v1.6.30@sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91
COPY --from=stream-proxy /out/websocket-proxy /usr/bin/websocket-proxy
COPY --from=stream-proxy /out/licenses /usr/share/doc/community-websocket-proxy
ENV RANCHER_HOST_STREAM_PROXY_PROTOCOL=1
ENV RANCHER_METRICS_PAYLOAD_PROXY_PROTOCOL=1
ENV RANCHER_API_KEY_STREAM_PROXY_PROTOCOL=1
COPY cattle /lab/cattle
COPY legacy-ui /lab/web
COPY build-overlay.sh /lab/build-overlay.sh
COPY migration/sql/001-local-groups.sql /lab/schema/001-local-groups.sql
RUN --mount=from=runtime-jars,target=/lab/runtime-jars bash /lab/build-overlay.sh
ENV CATTLE_PROJECT_CREATE_DEFAULT=true
ENV DEFAULT_CATTLE_PROJECT_CREATE_DEFAULT=true
ENV CATTLE_JAVA_OPTS="-Xms128m -Xmx1536m"
ENV DEFAULT_CATTLE_CATALOG_EXECUTE=true
ENV DEFAULT_CATTLE_API_UI_INDEX=local
