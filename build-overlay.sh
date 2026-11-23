#!/bin/bash
set -eu
ROOT=/lab/cattle
AUTH=$ROOT/code/iaas/auth-logic/src/main/java
APP=$ROOT/code/packaging/app-config
WAR=/usr/share/cattle/war
LIB="$WAR/WEB-INF/lib"
# Replace the matching runtime family together so the classpath has one version per artifact.
for artifact in jackson-annotations-2.5.3 jackson-core-2.5.3 jackson-databind-2.5.3 \
    jackson-module-jaxb-annotations-2.5.3 jackson-jaxrs-json-provider-2.1.2; do
    test -f "$LIB/$artifact.jar"
    rm "$LIB/$artifact.jar"
done
install -m 0644 /lab/jackson/*.jar "$LIB/"
mkdir -p /lab/classes
find "$AUTH/io/cattle/platform/iaas/api/auth/localrbac" -name '*.java' > /lab/sources
printf '%s\n' "$AUTH/io/cattle/platform/iaas/api/auth/dao/impl/AuthDaoImpl.java" "$AUTH/io/cattle/platform/iaas/api/auth/projects/ProjectResourceManager.java" "$AUTH/io/cattle/platform/iaas/api/auth/integration/local/LocalAuthTokenCreator.java" "$APP/src/main/java/io/cattle/platform/app/IaasApiConfig.java" "$APP/src/main/java/io/cattle/platform/app/ApiServerConfig.java" >> /lab/sources
printf '%s\n' "$AUTH/io/cattle/platform/iaas/api/auth/AbstractTokenUtil.java" "$AUTH/io/cattle/platform/iaas/api/auth/integration/local/LocalAuthTokenUtils.java" >> /lab/sources
printf '%s\n' "$ROOT/code/iaas/api-logic/src/main/java/io/cattle/platform/iaas/api/request/handler/GenericWhitelistedProxy.java" >> /lab/sources
printf '%s\n' "$ROOT/code/implementation/host-api/src/main/java/io/cattle/platform/host/service/impl/HostApiServiceImpl.java" "$ROOT/code/implementation/docker/machine/src/main/java/io/cattle/platform/docker/machine/launch/WebsocketProxyLauncher.java" >> /lab/sources
printf '%s\n' "$ROOT/code/implementation/host-stats/src/main/java/io/cattle/platform/host/stats/api/ServiceContainerStatsLinkHandler.java" >> /lab/sources
for file in StatsAccess StatsPayloadTransport ContainerStatsLinkHandler HostStatsLinkHandler; do
    printf '%s\n' "$ROOT/code/implementation/host-stats/src/main/java/io/cattle/platform/host/stats/api/$file.java" >> /lab/sources
done
printf '%s\n' "$ROOT/code/framework/auditing/src/main/java/io/cattle/platform/iaas/api/auditing/AuditServiceImpl.java" "$ROOT/code/framework/auditing/src/main/java/io/cattle/platform/iaas/api/auditing/AuditCredentialRedactor.java" "$ROOT/code/framework/auditing/src/main/java/io/cattle/platform/iaas/api/auditing/AuditLogOutPutFilter.java" >> /lab/sources
/usr/lib/jvm/zulu-8-amd64/bin/javac -encoding UTF-8 -source 8 -target 8 -cp "$WAR/WEB-INF/lib/*:$WAR/WEB-INF/jetty/*" -d /lab/classes @/lab/sources
cd /lab/classes
mkdir -p io/cattle/platform/iaas/api/auth/localrbac/migrations
cp /lab/schema/001-local-groups.sql io/cattle/platform/iaas/api/auth/localrbac/migrations/001-local-groups.sql
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-iaas-auth-logic-0.5.0-SNAPSHOT.jar" io/cattle/platform/iaas/api/auth
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-app-config-0.5.0-SNAPSHOT.jar" io/cattle/platform/app
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-iaas-api-logic-0.5.0-SNAPSHOT.jar" io/cattle/platform/iaas/api/request/handler/GenericWhitelistedProxy*.class
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-host-api-0.5.0-SNAPSHOT.jar" io/cattle/platform/host/service/impl/HostApiServiceImpl*.class
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-host-stats-0.5.0-SNAPSHOT.jar" io/cattle/platform/host/stats/api
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-docker-machine-0.5.0-SNAPSHOT.jar" io/cattle/platform/docker/machine/launch/WebsocketProxyLauncher*.class
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-framework-auditing-0.5.0-SNAPSHOT.jar" io/cattle/platform/iaas/api/auditing
cd "$APP/src/main/resources"
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-app-config-0.5.0-SNAPSHOT.jar" META-INF/cattle/iaas-api/defaults.properties META-INF/cattle/api-server/defaults.properties
cd "$ROOT/resources/content"
/usr/lib/jvm/zulu-8-amd64/bin/jar uf "$WAR/WEB-INF/lib/cattle-resources-0.5.0-SNAPSHOT.jar" schema/admin/admin-auth.json schema/user/user-auth.json schema/base/localGroup.json schema/base/localGroupAudit.json schema/base/localAccessReport.json
cp /lab/web/* "$WAR/"
for xml in "$WAR/WEB-INF/web.xml" "$WAR/WEB-INF/content/WEB-INF/web.xml"; do
    [ ! -f "$xml" ] || sed -i 's@</web-app>@<servlet><servlet-name>LocalOidc</servlet-name><servlet-class>io.cattle.platform.iaas.api.auth.localrbac.OidcServlet</servlet-class></servlet><servlet-mapping><servlet-name>LocalOidc</servlet-name><url-pattern>/oidc/*</url-pattern></servlet-mapping></web-app>@' "$xml"
    [ ! -f "$xml" ] || sed -i 's@</web-app>@<servlet><servlet-name>HostStreamGuard</servlet-name><servlet-class>io.cattle.platform.iaas.api.auth.localrbac.HostStreamGuardServlet</servlet-class></servlet><servlet-mapping><servlet-name>HostStreamGuard</servlet-name><url-pattern>/host-stream-session/*</url-pattern></servlet-mapping></web-app>@' "$xml"
    [ ! -f "$xml" ] || sed -i 's@/static,/ping,/healthcheck@/static,/ping,/healthcheck,/oidc,/host-stream-session,/local-,/no-access.@' "$xml"
done
sed -i 's@<script src="/assets/ui-@<script src="/local-rbac-templates.js"></script><script src="/native-routes.js"></script><script src="/local-rbac-extension.js"></script><script src="/assets/ui-@' "$WAR/index.html"
