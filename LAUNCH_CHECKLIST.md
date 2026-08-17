# DONE — Launch Checklist

Print this. Tick every box before onboarding a paying customer.
Full instructions: **PRODUCTION_SETUP.md**.

## Infrastructure
- [ ] Domain chosen and DNS pointed at the host
- [ ] HTTPS active (valid certificate)
- [ ] `APP_URL` set to the https domain
- [ ] PostgreSQL database provisioned
- [ ] `prisma/schema.prisma` datasource switched to `postgresql`
- [ ] Schema pushed (`npm run db:push`) — tables exist

## Platform keys (you configure once)
- [ ] `SESSION_SECRET` generated (`openssl rand -base64 32`)
- [ ] `ENCRYPTION_KEY` generated (separate value)
- [ ] `DATABASE_URL` set (with `sslmode=require`)
- [ ] AI key set (`ANTHROPIC_API_KEY` recommended)

## Google (Gmail + Calendar)
- [ ] Google Cloud project created
- [ ] Gmail API enabled
- [ ] Google Calendar API enabled
- [ ] OAuth consent screen configured (you added as Test user)
- [ ] OAuth Web client created
- [ ] Redirect URI = `{APP_URL}/api/integrations/google/callback`
- [ ] `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` set

## Security
- [ ] No default/insecure secrets (verified by `production:check`)
- [ ] `ENCRYPTION_KEY` is a dedicated value, not the session fallback
- [ ] `.env` is not committed
- [ ] `NODE_ENV=production`

## Verification
- [ ] `npm run production:check` → **PASSED**
- [ ] `npm run production:test-connections` → DB + AI OK
- [ ] `npm run verify` → typecheck + tests + build green
- [ ] `GET /api/health/ready` → 200
- [ ] `/admin/system` shows everything configured

## Launch
- [ ] First admin created (`npm run admin:create you@domain.com`)
- [ ] Gmail + Calendar connected in-app
- [ ] First-customer test passed (PRODUCTION_SETUP.md §12)
- [ ] Database backup taken

## Known gaps (decide before charging customers)
- [ ] Payments: no Stripe/checkout wired — entitlements enforced, but no way to
      collect payment yet. Add before monetizing.
- [ ] Transactional email: not wired — no signup-verification / reset emails.
- [ ] Unattended processing: wire an external scheduler to hit the sync
      endpoints if you want the loop to run without a user present.
