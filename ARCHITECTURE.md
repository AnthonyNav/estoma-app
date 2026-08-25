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

- Development selects mock BFF adapters through dependency injection.
- Staging and production select HTTP adapters.
- The executable BFF OpenAPI contract replaces provisional HTTP paths and DTOs.
- `202 Accepted` operations are monitored through `OperationTrackerService` until a terminal status is returned.
- The service worker caches application shell and static assets only. It must not cache authentication, secrets, or mutable business operations.
- Browser guards improve navigation only. Authorization remains server-side.

## Environments

`development`, `staging`, and `production` are build configurations. They differ only in public runtime/build configuration and adapter selection; they never embed infrastructure secrets.
