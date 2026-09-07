# Frontend image and develop deployment

Build from an exact reviewed commit with `docker build --build-arg VCS_REF=<commit> -t ghcr.io/anthonynav/estoma-app:develop-<short-sha> .`.
Run `sh scripts/deploy/test-image.sh <image>` before publication. This test uses an isolated Docker network, a synthetic BFF and the actual frontend image; it checks SPA routing, camera/security headers, cache policy, API statuses, header/body preservation and no automatic POST retry. It contacts no real BFF or accounts.

Nginx listens unprivileged on8080 and proxies `/api/` to `platform-bff.develop.svc.cluster.local:80`, preserving URI. `/healthz` checks the static server; `/version.json` identifies the source commit. Angular production uses real HTTP adapters and `/api/v1` on the same origin. Browser TLS terminates at the chosen trusted ingress/tunnel; no hostname or credentials are embedded in the bundle. API errors never become SPA responses.

Woodpecker validates the source and publishes a commit tag only on push to `dev` or the explicitly authorized initial deployment branch `deploy/frontend-argo`, using repository/organization GHCR credentials. PRs do not run publication. Verify that the repository is enabled in Woodpecker and that credential scopes permit this package; do not copy secret values into Git. This patch does not merge the upstream Lavado PR automatically.

Promote the tested image through a separate estoma-infra PR updating the estoma-app develop overlay to its tag/digest. Argo owns the Deployment and Service. Do not promote a placeholder or mutable latest/develop tag; confirm registry availability before merge. Revert the infrastructure image reference to roll back. Check service-worker upgrades/old tabs as part of browser acceptance.

The frontend service initially stays private. Domain/TLS exposure is separate from deploying it. A frontend rollout does not activate backend QR, candidates, unclassified rejection or direct-completion flags, nor provision synthetic accounts.
