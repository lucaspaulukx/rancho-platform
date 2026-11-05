FROM rancher/server:v1.6.30@sha256:95b55603122c28baea4e8d94663aa34ad770bbc624a9ed6ef986fb3ea5224d91
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
