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
ADD --checksum=sha256:9383272c93569afeabedb16923a94a6dc8a5bd7a2f9f83bf326af4ee68434629 https://repo.maven.apache.org/maven2/commons-fileupload/commons-fileupload/1.6.0/commons-fileupload-1.6.0.jar /fileupload/commons-fileupload-1.6.0.jar
ADD --checksum=sha256:2af190b300cbb0b35e248ccf5f4a06b6072030aeb3da7a98ec73abe5b4cb371f https://repo.maven.apache.org/maven2/org/bouncycastle/bcprov-jdk18on/1.86/bcprov-jdk18on-1.86.jar /bouncycastle/bcprov-jdk18on-1.86.jar
ADD --checksum=sha256:8d8b41a4b149bdae8d331f059a578870954d1e3ff29f8269a9eb3ee19a7e4ef7 https://repo.maven.apache.org/maven2/org/bouncycastle/bcpkix-jdk18on/1.86/bcpkix-jdk18on-1.86.jar /bouncycastle/bcpkix-jdk18on-1.86.jar
ADD --checksum=sha256:1c268e15f785aafb1e4670d8d6e5f856f69475e96c162dadcd1ff9b350e9139f https://repo.maven.apache.org/maven2/org/bouncycastle/bcutil-jdk18on/1.86/bcutil-jdk18on-1.86.jar /bouncycastle/bcutil-jdk18on-1.86.jar
ADD --checksum=sha256:2e194eba45a67dee19a4e272f4a04b18de8054e9f598b094382f6dae0b0e4b5e https://repo.maven.apache.org/maven2/org/yaml/snakeyaml/2.7/snakeyaml-2.7.jar /yaml/snakeyaml-2.7.jar
ADD --checksum=sha256:aa706e4f749982c0bae5fa637433c44c24f0fff5d16dc41deea6d30c3dfa7c85 https://repo.maven.apache.org/maven2/org/springframework/spring-aop/5.3.39/spring-aop-5.3.39.jar /spring/spring-aop-5.3.39.jar
ADD --checksum=sha256:61debd1d90e89967b1bb8e35da8669e981a3438478fc015df31a6b90cea1a20e https://repo.maven.apache.org/maven2/org/springframework/spring-aspects/5.3.39/spring-aspects-5.3.39.jar /spring/spring-aspects-5.3.39.jar
ADD --checksum=sha256:b6697a5d8facb81aa75e5a46d959d4256da9ce3b40d33f3b5bbd42a8b1ed5722 https://repo.maven.apache.org/maven2/org/springframework/spring-beans/5.3.39/spring-beans-5.3.39.jar /spring/spring-beans-5.3.39.jar
ADD --checksum=sha256:9e644fc33bece9a9cb82538167a1b9640ae7b7d80252e893d89b8926a2f81633 https://repo.maven.apache.org/maven2/org/springframework/spring-context/5.3.39/spring-context-5.3.39.jar /spring/spring-context-5.3.39.jar
ADD --checksum=sha256:f57a73ce3d33bf84d2cad726c1e3077fa8f3c3df05d3065ea7c3d72977e13b16 https://repo.maven.apache.org/maven2/org/springframework/spring-context-support/5.3.39/spring-context-support-5.3.39.jar /spring/spring-context-support-5.3.39.jar
ADD --checksum=sha256:3a1ddcf05420a9181bd9cacb6062a3edc493e14d555961ad50e1a6360eb1e75f https://repo.maven.apache.org/maven2/org/springframework/spring-core/5.3.39/spring-core-5.3.39.jar /spring/spring-core-5.3.39.jar
ADD --checksum=sha256:d5337774d889fcdc9c08b0c8b8aaa1018d4c95b9b441db0118f7ae4d328f2810 https://repo.maven.apache.org/maven2/org/springframework/spring-expression/5.3.39/spring-expression-5.3.39.jar /spring/spring-expression-5.3.39.jar
ADD --checksum=sha256:adbe656fc622e2457fefa09529d4b7c1126a3c4ff1c9306907764fcc93f1b725 https://repo.maven.apache.org/maven2/org/springframework/spring-jcl/5.3.39/spring-jcl-5.3.39.jar /spring/spring-jcl-5.3.39.jar
ADD --checksum=sha256:f314077e4196a4199a1d7b252db644f39fa6541bb7dc6e92bbb9001d6714d7d9 https://repo.maven.apache.org/maven2/org/springframework/spring-jdbc/5.3.39/spring-jdbc-5.3.39.jar /spring/spring-jdbc-5.3.39.jar
ADD --checksum=sha256:defdd2e72eb88729e40bc6773c6860d3c52136c46861d27806379562ffc4b21b https://repo.maven.apache.org/maven2/org/springframework/spring-tx/5.3.39/spring-tx-5.3.39.jar /spring/spring-tx-5.3.39.jar
ADD --checksum=sha256:444f243b936119b5488029f2d9399a3980855c60b493b9e2811464c6433a2b71 https://repo.maven.apache.org/maven2/org/springframework/spring-web/5.3.39/spring-web-5.3.39.jar /spring/spring-web-5.3.39.jar

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
