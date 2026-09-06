# Estoma Web/PWA

The Angular client for the Estomatology platform. It communicates exclusively with the public platform BFF.

## Prerequisites

- Node.js 22
- Corepack enabled (`corepack enable`)
- pnpm 10 (pinned by `packageManager`)

## Development

```bash
pnpm install
pnpm start
```

The development build uses simulated BFF responses. Open `http://localhost:4200` and use `202257019` with any non-empty synthetic password to exercise authentication. See [authentication fixtures](docs/auth-fixtures.md) for scenarios, session behavior, scope, and the prepared `pnpm start:auth` backend integration mode.
See [the fixtures guide](docs/fixtures.md) to exercise the Wash flow and its error states without a backend.

## Commands

```bash
pnpm format:check
pnpm lint
pnpm test:ci
pnpm build
pnpm build --configuration staging
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for boundaries, feature layout, runtime rules, and environment behavior. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch workflow and collaboration rules.
See [the BFF contract analysis](docs/bff-contract-analysis.md) for the canonical integration reference, current flows, and gaps to resolve before connecting them.

## Delivery

The production build is a static PWA served through Nginx. Woodpecker validates formatting, linting, tests, and the production build. Deployment manifests and environment-specific infrastructure belong to `estoma-infra`, where Argo CD reconciles the desired state.
