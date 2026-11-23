# Contributing

This is an independent community console for Rancher1.6 Docker/Cattle. The project is under development; passing tests for one feature does not establish complete compatibility.

1. Read `docs/48-master-roadmap.md` and `docs/71-community-release-plan.md`.
2. Run `python scripts/upstream.py apply` to obtain the pinned backend sources. Existing changes are never reset. Keep new UI development in `console/`.
3. Install console dependencies with `npm ci`; run `npm test`, `npm run build` and `npm run format:check` inside `console/`.
4. For backend changes, edit `cattle/`, run the relevant contracts/integration tests, then run `python scripts/upstream.py export` and `python scripts/upstream.py check`. Commit the patch together with tests and documentation.
5. Use a local isolated lab for physical tests. Never include passwords, SQL dumps, fixture manifests, captured sessions or corporate data in commits.
6. Commit each validated change with a descriptive message. Do not squash unrelated work or replace historical evidence with unverified claims.

Preserve upstream licenses and attribution. Project branding uses Rancher identifiers and an optional Community Console signature; it does not imply official endorsement.
