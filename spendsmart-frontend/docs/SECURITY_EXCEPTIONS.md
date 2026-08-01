# Temporary security exception

## React Router RSC-mode CSRF advisory

- **Advisory:** [GHSA-qwww-vcr4-c8h2](https://github.com/advisories/GHSA-qwww-vcr4-c8h2)
- **Affected package:** `react-router` through `react-router-dom`
- **Pinned version:** `7.18.2`
- **Decision date:** 31 July 2026
- **Review no later than:** 31 August 2026
- **Status:** Temporarily accepted for this client-only application

### Decision

The registry audit identifies React Router versions `>=7.12.0 <8.3.0` as
affected by a CSRF bypass in React Server Components mode. At the decision date,
`7.18.2` is the latest stable `react-router-dom` release and no unaffected newer
stable release is available.

SpendSmart uses Vite, `createBrowserRouter`, and `RouterProvider` as a
client-rendered SPA. It does not use React Server Components, server actions,
router actions, SSR, or prerendered router responses. The affected execution
path is therefore not present in this application.

The registry's forced fix proposes `7.11.0`. A compatibility experiment showed
that this version reintroduces several older advisories, including client-facing
open-redirect/XSS and denial-of-service findings. Downgrading would increase the
application's relevant risk, so `7.18.2` remains pinned.

### Compensating controls

- No RSC, SSR, server-action, or router-action entry points are configured.
- Application writes go through the FastAPI JSON API rather than React Router
  actions.
- The API restricts browser origins and validates trusted origins for refresh
  and logout cookie operations.
- The access token remains in memory and private query data is cleared when a
  session ends or the account changes.
- Dependency audit output is reviewed before releases.

### Removal criteria

Remove this exception and upgrade when an unaffected stable React Router release
compatible with the application is published. Re-run TypeScript, lint, build,
the complete browser regression flow, backend tests, and `npm audit` after the
upgrade.

Review immediately, before the deadline, if SpendSmart adopts SSR, React Server
Components, server actions, router actions, or prerendering.
