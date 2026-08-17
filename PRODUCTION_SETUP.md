# DONE — Production Setup

The single source of truth for taking DONE from a clone to serving real
customers. Everything here matches the actual code — routes, commands, and
environment variables were verified against the repository.

> **Scope note (honest):** This build implements auth, multi-tenancy, the AI
> orchestrator (DONE Loop, I'M LAZY, Autopilot), Business Brain, **real Gmail +
> Google Calendar**, plans/entitlements/usage limits, admin, audit logs, rate
> limits, and encryption. It does **not** include a wired payment provider
> (Stripe), a transactional-email provider, Redis/queues/workers, object
> storage, or Sentry. Those are called out where relevant so nothing is assumed.

---

## 1. Production Keys & Credentials

You (the platform operator) configure these **once**. Customers never provide
any of them — they just sign up and click "Connect".

| Variable | Required? | Service | Where to get it | Purpose |
|---|---|---|---|---|
| `APP_URL` | Yes (prod) | — | Your domain | Base URL for links & OAuth redirects |
| `NODE_ENV` | Yes | — | Set to `production` | Enables production guards |
| `DATABASE_URL` | Yes | PostgreSQL host | Neon / Supabase / RDS / self-host | Application database |
| `SESSION_SECRET` | Yes | — | `openssl rand -base64 32` | Signs session cookies |
| `ENCRYPTION_KEY` | Yes (prod) | — | `openssl rand -base64 32` | AES-256-GCM for OAuth tokens at rest |
| `ANTHROPIC_API_KEY` | Yes* | Anthropic | console.anthropic.com → API Keys | AI generation & orchestration |
| `ANTHROPIC_MODEL` | No | Anthropic | — | Defaults to `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | No* | OpenAI | platform.openai.com → API Keys | Alternative AI provider |
| `GOOGLE_CLIENT_ID` | Yes | Google Cloud | APIs & Services → Credentials | Gmail/Calendar OAuth |
| `GOOGLE_CLIENT_SECRET` | Yes | Google Cloud | APIs & Services → Credentials | Gmail/Calendar OAuth |
| `GOOGLE_REDIRECT_BASE` | No | — | Defaults to `APP_URL` | Override OAuth redirect host |
| `PLATFORM_ADMIN_EMAIL` | No | — | Your email | Convenience for `admin:create` |

\* At least one AI provider (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or
`OLLAMA_BASE_URL`) must be set, or DONE runs in the deterministic **offline**
fallback (fine for demos, not for production quality).

Generate secrets:

```bash
openssl rand -base64 32   # run twice → SESSION_SECRET and ENCRYPTION_KEY
```

---

## 2. Platform keys vs. customer connections

**Keys YOU configure once (this document):** Database, `SESSION_SECRET`,
`ENCRYPTION_KEY`, AI key, Google OAuth client, `APP_URL`.

**Connections customers authorize themselves (no keys):** their own Gmail and
Google Calendar, via the in-app "Connect" button → Google consent screen.

Customers do **not** create a Google project, an AI key, or any infrastructure.

---

## 3. Accounts you need to create

1. **A host for the app** (Vercel, Render, Fly.io, a VPS — anything that runs Node 20+).
2. **A PostgreSQL database** (Neon, Supabase, RDS, or self-hosted).
3. **An Anthropic account** (or OpenAI) for the AI key.
4. **A Google Cloud project** for Gmail/Calendar OAuth.
5. **A domain** with HTTPS.

That's the full list. No Redis, no S3, no email vendor, no Stripe required to run.

---

## 4. Exact setup order (0 → production)

```
0. Provision a Postgres database and a domain with HTTPS.
1. Clone the repo and `npm install`.
2. Create the Google Cloud OAuth client (Section 6).
3. Get an Anthropic API key (Section 7).
4. Fill .env (Section 5) with real values.
5. Point schema.prisma at PostgreSQL and push the schema (Section 8).
6. npm run production:check          # must pass
7. npm run build && npm run start
8. Sign up in the app, then `npm run admin:create you@domain.com`.
9. Connect Gmail + Calendar in the app (Section 9).
10. Run the first-customer test (Section 11).
```

---

## 5. Exact production `.env`

```dotenv
NODE_ENV=production
APP_URL=https://app.yourdomain.com

DATABASE_URL=postgresql://USER:PASSWORD@HOST:5432/done?schema=public&sslmode=require

SESSION_SECRET=<openssl rand -base64 32>
ENCRYPTION_KEY=<openssl rand -base64 32>

ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-sonnet-4-6

GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
# GOOGLE_REDIRECT_BASE=   # only if different from APP_URL

PLATFORM_ADMIN_EMAIL=you@yourdomain.com
```

Never commit `.env`. `.env.example` documents every variable the code reads.

---

## 6. Google setup (Gmail + Calendar)

Full walkthrough is in **[SETUP-GOOGLE.md](./SETUP-GOOGLE.md)**. Summary:

1. console.cloud.google.com → **New Project**.
2. **APIs & Services → Library** → enable **Gmail API** and **Google Calendar API**.
3. **OAuth consent screen** → External → add yourself under **Test users**
   (Testing mode works for up to 100 users without Google verification).
4. **Credentials → Create OAuth client ID → Web application**.
5. **Authorized redirect URI** (exact, from the code):

   ```
   {APP_URL}/api/integrations/google/callback
   ```

   e.g. `https://app.yourdomain.com/api/integrations/google/callback`
6. Copy the Client ID and Client Secret into `.env`.

**Scopes DONE requests (least privilege for what's implemented):**

| Scope | Plain English |
|---|---|
| `gmail.readonly` | Read inbox messages to understand what's happening |
| `gmail.send` | Send replies you approve |
| `gmail.modify` | Apply labels / mark threads |
| `calendar.events` | Read availability and create/update events |

> Drive is listed in the connector catalog but **not enabled** — no Drive scope
> is requested, so you don't need the Drive API.

---

## 7. AI setup

- **Provider:** Anthropic is the default. DONE auto-selects the first configured
  provider (`ANTHROPIC_API_KEY` → `OPENAI_API_KEY` → `OLLAMA_BASE_URL`), else
  falls back to a deterministic **offline** mode.
- **Model:** centralized in `src/lib/config.ts` (`ANTHROPIC_MODEL`, default
  `claude-sonnet-4-6`). Change the env var to change models — no scattered model
  strings in the codebase.
- **Where the key goes:** `ANTHROPIC_API_KEY` in `.env`.
- Get a key: console.anthropic.com → **API Keys**.

---

## 8. Database setup

**Development** (default, zero setup): SQLite.

```bash
npm run db:push      # syncs schema to ./dev.db
```

**Production** (PostgreSQL):

1. Edit `prisma/schema.prisma` datasource:

   ```prisma
   datasource db {
     provider = "postgresql"   // was "sqlite"
     url      = env("DATABASE_URL")
   }
   ```
2. Set `DATABASE_URL` to your Postgres connection string (include
   `sslmode=require` for hosted Postgres).
3. Create the schema:

   ```bash
   npm run db:generate      # prisma generate
   npm run db:push          # create/sync tables (no versioned migrations)
   ```

   To adopt **versioned migrations** instead, run once to create a baseline:
   `npx prisma migrate dev --name init`, then use `npm run db:deploy`
   (`prisma migrate deploy`) on each release.

**Do not seed demo data in production.** (`npm run db:seed` is dev-only.)

---

## 9. Customer connection flow (after deploy)

1. Customer signs into DONE.
2. Opens **Connections**.
3. Clicks **Connect** on Gmail (and Calendar).
4. Google's real consent screen appears → they choose their account.
5. They approve the requested permissions.
6. Google redirects to `{APP_URL}/api/integrations/google/callback`.
7. Tokens are exchanged and stored **encrypted** (AES-256-GCM); they never reach
   the browser.
8. Connections shows **Connected** with last-sync time.
9. DONE begins reading their inbox/calendar on the next sync.

---

## 10. How to start DONE

**Local:**

```bash
git clone <repo> && cd done
npm install
cp .env.example .env      # then fill in values
npm run db:push
npm run dev               # http://localhost:3000
```

**Production:**

```bash
npm install
npm run db:generate && npm run db:push   # (or db:deploy with migrations)
npm run production:check                  # must pass
npm run build
npm run start                             # respects PORT (default 3000)
```

**Workers / scheduler:** There are none — and none are required. The DONE Loop
runs **in-process** when triggered:

- **Inbox sync + handling:** `POST /api/inbox/sync` (called from the Inbox page's
  "Sync & handle").
- **Autopilot sweep:** `POST /api/autopilot/run` (I'M LAZY / Autopilot).

For **unattended** periodic processing, point an external scheduler (Vercel Cron,
a system cron, or an uptime pinger) at those endpoints on an authenticated
session. There is intentionally no unauthenticated background worker.

**Services that must be running in production:**

| Service | Purpose | Start | Health |
|---|---|---|---|
| DONE Web | App + API + in-process loop | `npm run start` | `GET /api/health/live` |
| PostgreSQL | Data | (managed/host) | `GET /api/health/ready` |

---

## 11. How to verify DONE is working

```bash
npm run production:check              # config/readiness (exits non-zero on failure)
npm run production:test-connections   # DB + AI auth + Google config (safe, read-only)
```

Health endpoints:

| Route | Meaning | Healthy response |
|---|---|---|
| `GET /api/health/live` | Process is up | `200 {"status":"ok"}` |
| `GET /api/health/ready` | DB reachable | `200 {"status":"ready"}` (else `503`) |
| `GET /api/health` | Overall | `200 {"status":"ok"}` |

Admin **System** page (`/admin/system`) shows Configured/Missing/Healthy per
subsystem — no secrets.

Full local verification:

```bash
npm run verify   # typecheck → tests → production build
```

---

## 12. First customer test

1. Open the production URL → **Register**.
2. Complete **Business Brain**.
3. Run `npm run admin:create you@domain.com` if you want admin access.
4. **Connect Gmail** and **Connect Calendar**.
5. From another account, send a test email to the connected inbox.
6. Open **Inbox → Sync & handle** (or **Autopilot → I'M LAZY**).
7. Confirm DONE detects the email, creates a lead, and either sends a reply
   (Autopilot) or creates an **Approval**.
8. Approve the reply → confirm it appears in the real Gmail Sent folder.
9. Confirm a follow-up is scheduled and shows in **Activity**.

---

## 13. Domain & HTTPS

1. Choose a domain, point DNS at your host.
2. Enable HTTPS (most hosts do this automatically).
3. Set `APP_URL=https://your-domain`.
4. Update the **Google** Authorized redirect URI to
   `{APP_URL}/api/integrations/google/callback`.

`production:check` **rejects** localhost/HTTP `APP_URL` when `NODE_ENV=production`.

---

## 14. Backups & restore (PostgreSQL)

Use your provider's automated backups (Neon/Supabase/RDS all offer them). Manual:

```bash
# Backup
pg_dump "$DATABASE_URL" > done-backup-$(date +%F).sql
# Restore (into an empty database)
psql "$DATABASE_URL" < done-backup-YYYY-MM-DD.sql
```

Take a backup **before every deploy that runs schema changes.**

---

## 15. Deploying a new version

```
1. Back up the database.
2. Pull/build the new release:  npm install && npm run build
3. Apply schema changes:        npm run db:push   (or db:deploy)
4. Restart the web process.
5. Check GET /api/health/ready returns 200.
6. Watch logs for errors.
```

Never reset the database. Rollback = redeploy the previous build; if a schema
change caused the failure, restore the pre-deploy backup.

---

## 16. Troubleshooting

**Gmail shows disconnected** → check `GOOGLE_CLIENT_ID/SECRET`, that the redirect
URI matches exactly, and that the user is a Test user on the consent screen.
"Reconnect required" means the refresh token was revoked — reconnect.

**AI isn't responding** → check `ANTHROPIC_API_KEY`, the model id, and rate
limits. `npm run production:test-connections` verifies auth.

**Follow-ups / handling don't run on their own** → expected: processing is
triggered by the Inbox/Autopilot endpoints. Wire an external scheduler (Section
10) for unattended operation.

**"Google OAuth isn't configured"** → the credentials aren't set, or the server
wasn't restarted after editing `.env`.

**Billing** → plans/entitlements are enforced, but there is no payment provider
wired in this build; subscriptions are created via internal records, not a
checkout. See "Scope note" at the top.
