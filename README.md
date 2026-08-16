# DONE

**Your business. DONE.** — an AI business assistant for small businesses.

Tell DONE what your business does once (your *Business Brain*), then press **I'M LAZY**
and it decides and creates the highest-value marketing work for you: campaigns,
content, replies, follow-ups and weekly plans.

> Philosophy: **Less prompting. More DONE.**

---

## Contents
- [What DONE is](#what-done-is)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [AI configuration](#ai-configuration)
- [Database & migrations](#database--migrations)
- [Tests](#tests)
- [Production build & deployment](#production-build--deployment)
- [Stripe & email](#stripe--email)
- [Admin bootstrap](#admin-bootstrap)
- [Backups & restore](#backups--restore)
- [Health checks](#health-checks)
- [Security notes](#security-notes)
- [Troubleshooting](#troubleshooting)
- [Project status](#project-status)

## What DONE is
A multi-tenant SaaS built with Next.js (App Router) + TypeScript. Each customer gets a
**workspace** (tenant). All data access is authorized server-side against workspace
membership — one customer can never read another's data.

Core features implemented and verified end-to-end:
- Email/password auth with DB-backed, signed, http-only sessions
- Multi-tenant workspaces with a single server-side authorization choke point
- Onboarding wizard → **Business Brain**
- Server-side **AI provider abstraction** (Anthropic / OpenAI / Ollama / offline)
- **I'M LAZY** engine: planner → schema-validated generation → persistence → usage → notification
- Campaigns, Content, Replies, Leads & AI follow-ups, Weekly plan
- Centralized **entitlements** + server-authoritative **usage tracking**
- Protected **admin** panel with real platform metrics
- Rate limiting, audit logging, structured errors, health endpoint
- Account/workspace deletion with explicit confirmation

## Architecture
```
src/
  app/
    (app)/          authenticated pages (dashboard, campaigns, content, replies, leads, brain, settings)
    admin/          platform-admin panel (separate guard)
    api/            route handlers (auth, onboarding, lazy, campaigns, content, replies, leads, brain, health)
    login, signup, onboarding, privacy, terms, page.tsx (landing)
  components/       UI + client components (lazy-button, auth-form, wizard, ...)
  lib/
    ai/             provider abstraction, context builder, planner, generators, offline, schemas
    auth/           password hashing, sessions
    workspace/      tenant context + authorization + provisioning
    entitlements.ts usage.ts config.ts crypto.ts errors.ts http.ts rate-limit.ts audit.ts validation.ts industries.ts
prisma/             schema.prisma + seed.ts
scripts/            setup.mjs, create-admin.mjs
```

The AI pipeline mirrors the intended design:
`AIProvider → BusinessContextBuilder → TaskPlanner → Generator → Validator (zod) → Persistence`.

## Prerequisites
- Node.js 20+ (tested on 22)
- Local dev needs nothing else — it uses **SQLite**.
- Production: **PostgreSQL** (and optionally Docker).

## Quick start (local)
```bash
npm install
npm run setup      # creates .env with a real SESSION_SECRET, generates client, pushes schema, seeds plans
npm run dev        # http://localhost:3000
```
Then: sign up → complete onboarding → press **I'M LAZY**.

With no AI keys, DONE runs in **offline mode** — it still produces genuinely
personalized output from your Business Brain, clearly labelled "offline mode".
It is never presented as live AI.

## Environment variables
See [`.env.example`](./.env.example) for the full, documented list. Key ones:

| Variable | Purpose |
|---|---|
| `APP_URL` | Public base URL |
| `SESSION_SECRET` | HMAC secret for signed session cookies (required in prod) |
| `DATABASE_URL` | SQLite file (dev) or PostgreSQL URL (prod) |
| `AI_PROVIDER` | Force a provider, or leave blank to auto-detect |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OLLAMA_BASE_URL` | AI providers (optional) |
| `PLATFORM_ADMIN_EMAIL` | Email auto-granted admin on signup |
| `STRIPE_*`, `EMAIL_*` | Billing & email (optional; feature-flagged) |

## AI configuration
Provider is auto-selected by `resolveAiProvider()` in this order: forced `AI_PROVIDER`
→ Anthropic key → OpenAI key → Ollama URL → **offline**.

- **Anthropic / OpenAI**: set the API key + model. Keys stay server-side only.
- **Ollama (free, local)**: install Ollama, `ollama pull llama3.1`, set `OLLAMA_BASE_URL=http://localhost:11434`.
- **Offline**: no config — deterministic, context-aware fallback so the product always works.

All AI responses are validated against zod schemas; invalid output is retried once, then fails safely.

## Database & migrations
Local dev uses `prisma db push` (SQLite). For production with PostgreSQL:
1. In `prisma/schema.prisma`, change `datasource db { provider = "postgresql" }`.
2. Set `DATABASE_URL` to your PostgreSQL connection string.
3. Create the first migration and deploy:
   ```bash
   npx prisma migrate dev --name init     # once, in a dev/staging env
   npx prisma migrate deploy              # in production (idempotent)
   ```
Seed **plans and feature flags only** (never fake customer data):
```bash
npm run db:seed
```

## Tests
```bash
npm run test        # vitest unit tests (entitlements, crypto/sessions, AI schema + planner)
npm run typecheck   # tsc --noEmit
```
The end-to-end journey (signup → onboarding → I'M LAZY → persistence → tenant isolation)
was verified against the running server; see `Project status`.

## Production build & deployment
```bash
npm run build       # prisma generate + next build (standalone output)
npm run start       # or: node .next/standalone/server.js
```
Do **not** run `next dev` in production.

### Docker
```bash
# Set a strong secret first:
export SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")
docker compose up --build
```
`docker-compose.yml` runs PostgreSQL + the app; the container runs `prisma migrate deploy`
before starting. Put a reverse proxy (Caddy/Nginx) in front for TLS. Behind a proxy,
`secure` cookies are enabled automatically when `NODE_ENV=production`.

### Deployment checklist
- [ ] `SESSION_SECRET` set to a long random value
- [ ] `DATABASE_URL` points to PostgreSQL; schema provider switched to `postgresql`
- [ ] `npx prisma migrate deploy` run
- [ ] `APP_URL` set to the public URL
- [ ] AI provider key set (or intentionally offline)
- [ ] First admin promoted (see below)
- [ ] `/api/health` returns 200

## Stripe & email
Billing and transactional email are **abstracted and feature-flagged off** until configured
— they are not faked. When you add `STRIPE_*` keys and enable the `billing` flag, wire the
webhook to update `Subscription` server-side (never trust client subscription state).
Email defaults to `EMAIL_PROVIDER=console` (logs to server) until a provider is set.

## Admin bootstrap
No hard-coded admin password. Either set `PLATFORM_ADMIN_EMAIL` before signing up (that account
becomes admin automatically), or promote an existing user:
```bash
node scripts/create-admin.mjs you@example.com
```
Platform-admin is distinct from workspace roles and is enforced server-side on all `/admin` routes.

## Backups & restore
**PostgreSQL:**
```bash
# Backup
pg_dump "$DATABASE_URL" -Fc -f done-$(date +%F).dump
# Restore (into an empty database)
pg_restore --clean --if-exists -d "$DATABASE_URL" done-YYYY-MM-DD.dump
```
Test restores regularly into a scratch database — a backup you haven't restored isn't a backup.
Uploaded files (when object storage is enabled) should be backed up via your bucket's
versioning/replication. Keep `.env` secrets in a secrets manager, not in backups.

## Health checks
- `GET /api/health` → `{ status, checks: { database } }`, 200 healthy / 503 degraded.
  Public and safe — it exposes no internals.

## Security notes
- Passwords hashed with bcrypt (cost 12); raw tokens never stored (sha-256 only).
- Sessions: signed http-only cookies, DB-backed, revocable, 30-day expiry.
- Every workspace-scoped query goes through `requireWorkspaceContext()` — server-side authz.
- Rate limiting on auth, AI generation and I'M LAZY; audit logging on security events.
- Input validation with zod; security headers set in `next.config.mjs`.
- Idempotency keys on I'M LAZY runs prevent duplicate work/cost.

## Troubleshooting
- **`prisma` not found / wrong version**: ensure dev dependencies installed (`npm install --include=dev`), then `npx prisma generate`.
- **Blank AI output labelled "offline mode"**: no AI key configured — expected. Add a key or run Ollama.
- **Cookie/login issues in production**: confirm `APP_URL` and that the app is served over HTTPS.

## Project status
Delivered as a **working vertical slice** (verified end-to-end): auth, multi-tenancy,
Business Brain, AI abstraction + I'M LAZY, campaigns/content/replies/leads/plan,
entitlements/usage, admin, health, tests, Docker.

Not yet implemented (clearly stubbed/flagged, not faked): live Stripe billing, transactional
email delivery, team invitations UI, background job queue, social publishing integrations.
See inline notes and feature flags. These are the next milestones.
