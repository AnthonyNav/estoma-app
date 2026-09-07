# Frontend Architecture

## Scope

Estoma is an Angular Web/PWA client. It communicates only with the public platform BFF over HTTPS and does not access platform microservices, RabbitMQ, databases, or infrastructure directly.

## Structure

```text
src/app/
├── core/                 # application-wide technical concerns
├── shared/               # reusable, domain-neutral UI and utilities
└── features/
    └── <feature>/
        ├── domain/       # models and ports
        ├── application/  # use cases
        ├── infrastructure/ # HTTP and mock adapters
        └── presentation/ # pages, components, local state
```

The feature is the main unit of modularity. Use all four layers when the boundary protects a meaningful business concern; avoid ceremonial layers for trivial display-only code.

## Runtime rules

- Development selects mock BFF adapters through dependency injection. Authentication always uses its HTTP adapter, with a development-only interceptor backed by JSON responses; see [authentication fixtures](docs/testing/authentication.md). Production and staging exclude that interceptor.
- Staging and production select HTTP adapters.
- The user-supplied Estoma Platform BFF API v1 document (OpenAPI 3.1.1) is the canonical integration reference. See [the contract index](docs/contracts/README.md) for provenance, known gaps, and migration work. Existing provisional adapters and mocks are not authoritative.
- `202 Accepted` operations are monitored through `OperationTrackerService` until a terminal status is returned.
- The service worker caches application shell and static assets only. It must not cache authentication, secrets, or mutable business operations.
- Browser guards improve navigation only. Authorization remains server-side.

## Environments

`development`, `staging`, and `production` are build configurations. They differ only in public runtime/build configuration and adapter selection; they never embed infrastructure secrets.

## Documentation governance

Use the [documentation index](docs/README.md), [confirmed contracts](docs/contracts/README.md) and [integration status](docs/integration/status.md). Mocks and historical proposals are not authoritative; deployment, activation and certification are tracked separately.
