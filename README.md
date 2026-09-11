# WIGO Admin — WhatsApp integration + admin dashboard

WIGO Phase 1 pilot. This is the **admin dashboard rebuilt against a real backend**, plus
the **integration layer** for WhatsApp Business API (login + messaging) and N1CO payments.

The previous vendor delivered a frontend-only admin with hardcoded mock data and no
backend. This repo replaces that: a real API, real auth, real RBAC, and an integration
layer built on ports/adapters so it runs end-to-end on deterministic **fakes** today and
flips to the **live** WhatsApp/N1CO providers with an environment variable when their
credentials land — no code change.

## Layout

```
server/   Express + TypeScript API (auth, RBAC, audit, KPIs, ports/adapters)
web/      React + Vite + TypeScript admin dashboard
scripts/  smoke test + secret scanner
```

## Quick start

```bash
npm install
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:5173 (proxies /api to the server)
```

Sign in on the web app with a seeded number, e.g. `+5215500000001` (super_admin). On the
fake WhatsApp adapter the OTP request returns a **dev code** shown on the login screen, so
you can complete the flow without a live WhatsApp number. Password login also works with
the seeded demo password.

## What's implemented

- **WhatsApp-OTP + password auth.** JWT access + refresh; the role claim is carried
  through refresh so a refreshed session never loses its role.
- **RBAC on every route.** 7-role model, enforced by the server (the UI only hides
  controls it can't use — the server is the boundary).
- **Ports/adapters integration layer.**
  - `NotificationsPort` → WhatsApp Business API. Fake + live adapters, templates, retry/
    backoff, inbound + delivery-receipt webhooks (with signature verification in live mode).
  - `PaymentsPort` → N1CO. Fake + live adapters, idempotent top-ups.
  - Selected by `WHATSAPP_DRIVER` / `N1CO_DRIVER` (`fake` | `live`).
- **Admin modules.** Dashboard KPIs, Riders, Applications (Buy/Rent, null-safe sort),
  Document Review (approve/reject + reason codes), Payments/Deposits, Notifications /
  Messaging Center, Audit Log (append-only, timestamp-cast date ranges), Admin Users,
  global search.
- **A/B testing.** Deterministic server-side experiment assignment with a `useExperiment`
  hook driving dashboard layout and review-queue density variants.

## Verify

```bash
npm run secret-scan   # scan tracked files for committed secrets
npm run typecheck     # tsc across both packages
npm run test          # unit tests (server + web)
npm run build         # production build of both packages
npm run smoke         # boot the server on fakes and run the critical paths
npm run verify        # all of the above, in order
```

## Security notes

- No secrets in source. All credentials come from the environment; only `.env.example`
  files are committed, and a pre-push secret scan enforces it.
- `helmet`, a CORS allowlist, request-size limits, and rate limiting on the auth surface.
- Passwords are bcrypt-hashed and never serialized. Webhook payloads are verified against
  Meta's `X-Hub-Signature-256` when an app secret is configured.
- Production boot refuses to start on dev/default JWT secrets or a live driver missing its
  credentials.
- `npm audit` shows a few advisories in **dev tooling only** (vite dev server, vitest
  runner/UI, esbuild dev server). None of that code is present in the shipped artifacts —
  the built Express server and the static web bundle — and the vitest UI is never started
  (`vitest run` only). Runtime dependencies are kept clean (react-router is on the patched
  v7). These dev advisories can't be resolved without adopting pre-release majors, which
  would trade a real, verified build for an unverified one.
