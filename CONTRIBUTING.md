# Contributing to Rancho Platform

[English](CONTRIBUTING.md) | [Português (Brasil)](docs/pt-BR/contributing.md)

Rancho is an independent community initiative for Rancher 1.6 Docker/Cattle. The roadmap tracks remaining work for the community alpha. Preparing a PR does not authorize public release, production changes or merge.

## Start with the current scope

Read the relevant [roadmap](docs/en/roadmap.md) task, [architecture](docs/en/architecture.md) and [testing guide](docs/en/testing.md). Discuss a concrete trigger and expected result; keep unrelated changes separate. Use a fork if you do not have write access to the repository.

Requirements: Git, Python 3, Node 24 and Linux-container Docker for lab/backend work. PowerShell 7 is used by the lab bootstrap. Install only tools relevant to the change.

```sh
git clone https://github.com/lucaspaulukx/rancho-platform.git
cd rancho-platform
git fetch origin
git switch -c feat/my-change origin/main
git config core.hooksPath .githooks
python scripts/upstream.py apply
cd console
npm ci
```

Preserve existing user edits and credentials. Use a separate checkout when needed; never reset or delete an existing lab to make a test pass. Before initializing a lab, inspect `Start-Lab.ps1 -PlanOnly` and the migration guide. Do not connect tests to production data or agents.

## Implementation practices

- Keep new UI work in `console/`; classic Ember is unchanged. Reuse the shell, navigation, theme tokens, fields, tables, menus and drawers. Preserve environment/stack/service/container context and Rancher attribution alongside Rancho identity.
- Current resource schemas/actions and backend permissions are authoritative. Revalidate scope/contracts before mutation. Menu visibility and feature flags do not grant authorization. Preserve drafts on errors and unknown data; client snapshots are not atomic server CAS.
- New behavior needs explicit defaults, off behavior, dependencies and rollback/compatibility documentation. Additive flags default off when absent. Do not silently migrate direct grants, enable access for new users or change existing workloads.
- Keep secrets out of source, browser storage, screenshots, logs and PRs. Do not commit `.env`, realms, dumps, fixture manifests, session captures, dependencies or generated evidence. Reports should contain sanitized checks/counts, not payloads or tokens.
- For backend work, edit pinned upstream checkouts, run relevant native contracts, then `python scripts/upstream.py export` and `python scripts/upstream.py check`. Commit patches/tests/docs, not the consultation clones. Preserve upstream and dependency licenses/NOTICE; final license/security review remains a release gate.

## Validation and documentation

Inside `console/`, run the checks appropriate to the change:

```sh
npm test
npm run build
npm run format:check
```

Run meaningful targeted tests while iterating, then the required complete gate once the change is ready. Avoid tests that merely restate implementation or unnecessary repeated full runs. A UI mock, successful build or source CI does not prove native traffic, Docker effects, live authorization, HA or recovery. When claiming runtime effects, use owned sandbox fixtures with explicit markers, positive/negative controls and exact cleanup; verify prior configurations/data remain intact. Record failures and untested cases honestly.

Update the affected pt-BR and English documents together when both exist. Preserve command/flag/API identifiers and recorded evidence verbatim. Do not call an abridged summary a full translation or silently mark a stale translation reviewed. The inventory and review process are maintained in the [documentation guide](docs/en/documentation.md); all active guides must be covered before public release.

## Commits and review

Use a focused `feat/`, `fix/`, `test/`, `docs/` or `ci/` branch and descriptive commits. Stage explicit paths and review the diff. Preserve history; do not force-push a shared branch or squash unrelated work.

From the repository root:

```sh
python scripts/check_repository.py
python scripts/check_public_history.py
git diff --cached --check
```

The first scanner checks staged content; the second checks reachable history. Local private policy/known credentials are available only in the maintainer lab. Neither scanner replaces a complete secret or license audit. Hooks can be bypassed and are not an authorization boundary.

Push the branch/open a PR within the current task authorization. Normally target `main`; for stacked work, state the parent PR and use its branch as the base until integration is reviewed. Use the PR template and explain:

1. The concrete problem and resulting behavior.
2. Scope, roadmap task, flags/defaults and compatibility.
3. Commands, actual outcomes and evidence boundaries: unit/build/browser/native/remote CI.
4. pt-BR/English documentation changes and remaining translation work.
5. Risks, untested cases, migration impact, recovery/rollback and stacked dependencies.

For multiline text, write a local body file and pass `gh pr create --body-file`, rather than constructing escaped shell text. Never include private data in that file. Reviewers should be able to assess the result without reading the chat. Keep PR title/body aligned with the final implementation. Do not merge automatically, change visibility or publish a release as a consequence of checks passing.

Replace the example path/branch and fill the local PR body with your actual results. The PowerShell example uses version7. If you prefer the GitHub web UI, create a PR from the pushed branch, check its base and fill the same template. See [GitHub’s PR guide](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request).

```sh
git status --short
git diff
git add -- path/to/changed-file
git diff --cached
python scripts/check_repository.py
python scripts/check_public_history.py
git diff --cached --check
git commit -m "Describe the actual change"
git push -u origin feat/my-change
```

```powershell
$prBodyPath = git rev-parse --git-path PR-body.md
@'
Describe the behavior, tests, limits and rollback.
'@ | Set-Content -LiteralPath $prBodyPath -Encoding utf8NoBOM
gh pr create --repo lucaspaulukx/rancho-platform --base main --head feat/my-change --title "Describe the actual change" --body-file $prBodyPath
```

## AI-assisted contributions

Use [AGENTS.md](AGENTS.md) as the shared guidance. Repository adapters for Claude, Gemini, Copilot and Cursor refer to that file. The optional [rancho-contribute skill](.agents/skills/rancho-contribute/SKILL.md) helps prepare a scoped change and reviewable PR; it does not authenticate accounts or authorize external actions. Authors remain responsible for checking generated code, claims, licenses and validation. AI tools are optional; ordinary Git contributions follow the same process.

Client integration details vary; check the official instructions for [Claude](https://code.claude.com/docs/en/memory), [Gemini CLI](https://geminicli.com/docs/cli/gemini-md/), [GitHub Copilot](https://docs.github.com/en/copilot/concepts/prompting-and-context/custom-instructions?tool=vscode) and [Cursor](https://prod.cursor.com/docs/rules). Verify that your tool actually reads the repository guidance; supplying files does not prove that every client is configured.
