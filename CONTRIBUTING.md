# Contributing

## Branches

`main` is the default and production branch. `stg` is the staging branch. `dev` is the integration branch for active development.

Create short-lived branches from `dev` using one of these prefixes:

- `feature/` for product work
- `fix/` for defect fixes
- `chore/` for tooling or maintenance
- `docs/` for documentation-only changes

Open pull requests to `dev`. Promote a tested `dev` revision to `stg`, then promote the approved staging revision to `main`. Do not commit directly to `main` or `stg`.

## Code boundaries

- The browser application calls only the public platform BFF under `/api/v1`.
- Presentation code does not inject `HttpClient` for feature behavior.
- Features own their domain, application, infrastructure, and presentation code.
- Infrastructure adapters implement feature ports; mocks emulate BFF contracts rather than internal services.
- Do not put feature-specific components in `shared/`.
- Do not store infrastructure secrets, tokens, passwords, or sensitive payloads in the repository, browser storage, or logs.

## Quality checks

Run these before opening a pull request:

```bash
pnpm format:check
pnpm lint
pnpm test:ci
pnpm build
```

Use `pnpm format` to apply formatting. The pre-commit hook formats staged files and runs ESLint fixes for TypeScript.

## Commits and pull requests

Use Conventional Commits, for example:

```text
feat(authentication): add password recovery entry point
fix(appointments): preserve the idempotency key on retry
chore(ci): validate production builds
```

Keep pull requests focused. Include the user-facing impact, relevant tests, and any BFF/OpenAPI contract dependency. A feature that changes a documented architectural boundary requires an approved decision before implementation.
