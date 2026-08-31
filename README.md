# Estoma Web/PWA

The Angular client for the Estomatology platform. It communicates exclusively with the public platform BFF.

## Prerequisites

- Node.js 22.22.2 (defined in `.nvmrc`)
- Corepack enabled (`corepack enable`)
- pnpm 10 (pinned by `packageManager`)

## Development

```bash
pnpm install
pnpm start
```

The development build uses mock BFF adapters. Open `http://localhost:4200` and use any non-empty identifier and password in the authentication pilot.
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

## Delivery

The production build is a static PWA served through Nginx. Woodpecker validates formatting, linting, tests, and the production build. Deployment manifests and environment-specific infrastructure belong to `estoma-infra`, where Argo CD reconciles the desired state.
