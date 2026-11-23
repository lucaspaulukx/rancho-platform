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
ADD --checksum=sha256:73914527305a40cce504b0d3d90b23caf565136912d607ae8ae7c5895512332c https://repo.maven.apache.org/maven2/org/postgresql/postgresql/42.7.14/postgresql-42.7.14.jar /postgresql/postgresql-42.7.14.jar
ADD --checksum=sha256:e1522945218456f3649a39bc4afd70ce4bd466221519dba7d378f2141a4642ca https://repo.maven.apache.org/maven2/org/apache/commons/commons-compress/1.28.0/commons-compress-1.28.0.jar /commons-archive/commons-compress-1.28.0.jar
ADD --checksum=sha256:df90bba0fe3cb586b7f164e78fe8f8f4da3f2dd5c27fa645f888100ccc25dd72 https://repo.maven.apache.org/maven2/commons-io/commons-io/2.20.0/commons-io-2.20.0.jar /commons-archive/commons-io-2.20.0.jar
ADD --checksum=sha256:4eeeae8d20c078abb64b015ec158add383ac581571cddc45c68f0c9ae0230720 https://repo.maven.apache.org/maven2/org/apache/commons/commons-lang3/3.18.0/commons-lang3-3.18.0.jar /commons-archive/commons-lang3-3.18.0.jar
ADD --checksum=sha256:5c3881e4f556855e9c532927ee0c9dfde94cc66760d5805c031a59887070af5f https://repo.maven.apache.org/maven2/commons-codec/commons-codec/1.19.0/commons-codec-1.19.0.jar /commons-archive/commons-codec-1.19.0.jar
ADD --checksum=sha256:ef5aadd0e7456bee48828b5e4655645ac306f937a7ec47e31e3fa3507c29b846 https://repo.maven.apache.org/maven2/org/hsqldb/hsqldb/2.7.4/hsqldb-2.7.4-jdk8.jar /hsqldb/hsqldb-2.7.4-jdk8.jar
ADD --checksum=sha256:9e44ba68ec9a3f21286fa2a8bbb003b735c0f69101bb43144b79f4f8aaa74709 https://repo.maven.apache.org/maven2/commons-beanutils/commons-beanutils/1.11.0/commons-beanutils-1.11.0.jar /beanutils/commons-beanutils-1.11.0.jar
ADD --checksum=sha256:6d7a744e4027649fbb50895df9497d109f98c766a637062fe8d2eabbb3140ba4 https://repo.maven.apache.org/maven2/commons-logging/commons-logging/1.3.5/commons-logging-1.3.5.jar /beanutils/commons-logging-1.3.5.jar
ADD --checksum=sha256:5a1ac2b5bbb8321a027e0615ca6dd1e8ba05e4ca063ac795572d676325c7fcdf https://repo.maven.apache.org/maven2/org/liquibase/liquibase-core/4.8.0/liquibase-core-4.8.0.jar /liquibase/liquibase-core-4.8.0.jar

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
