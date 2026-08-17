# Deploy DONE to Netlify

A start-to-finish guide for hosting DONE on Netlify with a Postgres database.
Everything here matches the repo. Budget ~30 minutes.

Netlify runs serverless functions, so **SQLite won't work** — DONE uses Postgres
in production. This repo already handles that: `npm run build:netlify` builds
against an auto-generated Postgres schema; your local SQLite and tests are
untouched.

---

## Step 0 — What you'll create

1. A **Neon** Postgres database (free tier is fine).
2. A **Google Cloud** OAuth client (for Gmail + Calendar).
3. An **Anthropic** API key (for the AI).
4. A **Netlify** site connected to your Git repo.

---

## Step 1 — Push the code to GitHub

Netlify deploys from a Git repo.

```bash
# from C:\Users\pc\done
git remote add origin https://github.com/<you>/done.git   # your repo
git push -u origin feat/real-connectors-elevation:main     # push current branch as main
```

(Or merge the branch to `master`/`main` first, then push.)

---

## Step 2 — Create the Postgres database (Neon)

1. Go to <https://neon.tech> → sign up → **Create project** (name it `done`).
2. Copy the **connection string** (looks like
   `postgresql://user:pass@ep-xxx.region.aws.neon.tech/neondb?sslmode=require`).
   Keep it — it's your `DATABASE_URL`.

## Step 3 — Create the schema in Neon (one time, from your PC)

```bash
# from C:\Users\pc\done — point at Neon just for this command
#   PowerShell:  $env:DATABASE_URL="postgresql://...sslmode=require"; npm run db:push:prod
#   bash/git:    DATABASE_URL="postgresql://...sslmode=require" npm run db:push:prod
```

This creates all DONE's tables in Neon. You'll see "Your database is now in sync".

---

## Step 4 — Get your AI key (Anthropic)

1. <https://console.anthropic.com> → sign up → **API Keys → Create Key**.
2. Copy it (starts with `sk-ant-`). That's `ANTHROPIC_API_KEY`.

---

## Step 5 — Get your Google key (Gmail + Calendar OAuth)

You need your Netlify URL first for the redirect. If you don't have a custom
domain yet, Netlify gives you `https://<your-site>.netlify.app` in Step 6 —
you can come back and fill the redirect URI after that. Steps:

1. Go to <https://console.cloud.google.com> and sign in with **nehmar55@gmail.com**.
2. Top bar → project dropdown → **New Project** → name `DONE` → **Create**.
3. **APIs & Services → Library** → search and **Enable**:
   - **Gmail API**
   - **Google Calendar API**
4. **APIs & Services → OAuth consent screen**:
   - User type: **External** → **Create**.
   - App name: `DONE`. User support email: **nehmar55@gmail.com**.
   - Developer contact: **nehmar55@gmail.com** → **Save and continue**.
   - Scopes: skip (Save and continue).
   - **Test users → Add users → nehmar55@gmail.com** → Save.
     (Testing mode works immediately for you; no Google review needed.)
5. **APIs & Services → Credentials → Create Credentials → OAuth client ID**:
   - Application type: **Web application**.
   - Name: `DONE Web`.
   - **Authorized redirect URIs → Add URI** (exact):
     ```
     https://<your-site>.netlify.app/api/integrations/google/callback
     ```
   - **Create**.
6. Copy the **Client ID** → `GOOGLE_CLIENT_ID`.
   Copy the **Client secret** → `GOOGLE_CLIENT_SECRET`.

The scopes DONE will request (least privilege): Gmail read, Gmail send, Gmail
modify (labels), Calendar events. Google may warn the app is "unverified"
because it's in Testing — click **Advanced → Go to DONE** with your test-user
account.

---

## Step 6 — Create the Netlify site

1. <https://app.netlify.com> → **Add new site → Import an existing project**.
2. Connect your Git provider → pick the `done` repo.
3. Netlify auto-detects Next.js. Confirm:
   - **Build command:** `npm run build:netlify`  (from netlify.toml — leave as is)
   - **Publish directory:** `.next`
4. **Don't deploy yet** — add environment variables first (Step 7).

Your site URL appears as `https://<your-site>.netlify.app`. Go back to **Step 5.5**
and set the Google redirect URI to that exact URL if you hadn't.

---

## Step 7 — Set environment variables in Netlify

**Site configuration → Environment variables → Add a variable** (add each):

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_URL` | `https://<your-site>.netlify.app` |
| `DATABASE_URL` | your Neon connection string (`...sslmode=require`) |
| `SESSION_SECRET` | generate below |
| `ENCRYPTION_KEY` | generate below (different value) |
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `GOOGLE_CLIENT_ID` | from Step 5 |
| `GOOGLE_CLIENT_SECRET` | from Step 5 |
| `PLATFORM_ADMIN_EMAIL` | `nehmar55@gmail.com` |

Generate the two secrets on your PC:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Run it twice — one value for `SESSION_SECRET`, one for `ENCRYPTION_KEY`.

> These must be set **before** the build — the app refuses to boot in production
> without them.

---

## Step 8 — Deploy

**Deploys → Trigger deploy → Deploy site.** Watch the log:
`npm run build:netlify` → Postgres schema generated → Prisma client → Next build.

When it's green, open `https://<your-site>.netlify.app`.

---

## Step 9 — Make yourself admin

1. In the deployed app, **Sign up** with `nehmar55@gmail.com`.
2. From your PC, grant admin (pointing at Neon):

   ```bash
   # bash/git:  DATABASE_URL="postgresql://...sslmode=require" npm run admin:create nehmar55@gmail.com
   ```

3. Visit `https://<your-site>.netlify.app/admin/system` — every subsystem should
   show **configured** / **healthy**.

---

## Step 10 — Connect Gmail + Calendar & test

1. In the app → **Connections → Connect** on Gmail (approve on Google's screen),
   then Calendar.
2. From another email, send a message to your connected inbox.
3. **Inbox → Sync & handle** (or **Autopilot → I'M LAZY**).
4. DONE reads it, creates a lead, and drafts a reply / approval. Approve it and
   check your real Gmail Sent folder.

You're live. 🎉

---

## Notes & gotchas

- **`redirect_uri_mismatch`** → the Google redirect URI must equal
  `https://<your-site>.netlify.app/api/integrations/google/callback` exactly
  (https, no trailing slash). Update it in Google if you change domains.
- **Custom domain later** → add it in Netlify, then update `APP_URL` and the
  Google redirect URI to the new domain.
- **Background processing** → DONE processes when you open Inbox/Autopilot. For
  hands-off runs, add a Netlify **Scheduled Function** that calls the sync
  endpoint. Not required to launch.
- **Not wired in this build** (see PRODUCTION_SETUP.md): payments (Stripe) and
  transactional email. You can onboard and operate; you just can't charge cards
  through the app yet.
- **Health checks:** `https://<your-site>.netlify.app/api/health/ready`.
