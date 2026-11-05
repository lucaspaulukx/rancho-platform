# Contributing

Rancho Platform is an independent community console for Rancher1.6 Docker/Cattle. The project is under development; passing tests for one feature does not establish complete compatibility.

1. Read `docs/48-master-roadmap.md` and `docs/71-community-release-plan.md`.
2. Run `python scripts/upstream.py apply` to obtain the pinned backend sources. Existing changes are never reset. Keep new UI development in `console/`.
3. Install console dependencies with `npm ci`; run `npm test`, `npm run build` and `npm run format:check` inside `console/`.
4. For backend changes, edit `cattle/`, run the relevant contracts/integration tests, then run `python scripts/upstream.py export` and `python scripts/upstream.py check`. Commit the patch together with tests and documentation.
5. Use a local isolated lab for physical tests. Never include passwords, SQL dumps, fixture manifests, captured sessions or corporate data in commits.
6. Commit each validated change with a descriptive message. Do not squash unrelated work or replace historical evidence with unverified claims.

Preserve upstream licenses and attribution. Project branding uses Rancher identifiers and an optional Community Console signature; it does not imply official endorsement.

## Git workflow

The canonical repository is https://github.com/lucaspaulukx/rancho-platform. Preserve existing history. Work on a focused `feat/`, `fix/`, `docs/` or `test/` branch; commit related implementation, tests and documentation together with a descriptive message. Use pull requests into `main` for review. Do not force-push shared history or include generated dependencies, local lab state, credentials or reports.

Before committing, stage explicit paths and run `python scripts/check_repository.py`. Before pushing, also run `python scripts/check_public_history.py`; this checks reachable history against configured sensitive values and retired identities, and complements a full secret audit. Record which relevant tests passed and which gates remain open. Features awaiting physical acceptance stay disabled. See [repository workflow](docs/86-repository-workflow.md).

Enable the repository hooks once per checkout with `git config core.hooksPath .githooks`. The pre-commit hook checks staged contents and local backend patches; pre-push checks reachable history. Hooks complement review and can be bypassed by Git, so they are not an authorization boundary.

The source/console workflow checks publication content/history, scanner tests, locked installation, formatting, frontend tests and TypeScript/Vite on GitHub. It has no lab credentials and does not run physical or migration acceptance; document those separately in the PR. See [CI validation](docs/89-pull-request-validation.md).
