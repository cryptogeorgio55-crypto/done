# Connecting DONE to your real Gmail & Google Calendar

DONE now talks to your **real** Google account — there is no sandbox/simulated
mode anymore. To connect, you (the account owner) create a Google OAuth client
once and drop three values into your `.env`. This is the one part of "the real
deal" that only you can do, because it's tied to your own Google account.

Takes about 10 minutes.

---

## 1. Create a Google Cloud project

1. Go to <https://console.cloud.google.com>.
2. Top bar → project dropdown → **New Project**. Name it `DONE` → **Create**.

## 2. Enable the APIs DONE uses

In the project, open **APIs & Services → Library** and enable both:

- **Gmail API**
- **Google Calendar API**

## 3. Configure the OAuth consent screen

1. **APIs & Services → OAuth consent screen**.
2. User type: **External** → **Create**.
3. Fill app name (`DONE`), your support email, developer email → **Save and continue**.
4. **Scopes** — you can leave this blank here; DONE requests the scopes it needs at
   connect time. (For reference they are: `gmail.readonly`, `gmail.send`,
   `gmail.modify`, `calendar.events`.)
5. **Test users** → **Add users** → add the Google address you'll connect
   (your own). → **Save and continue**.

> Leaving the app in **Testing** status is fine for personal use — it works
> immediately for up to 100 test users. You only need Google's full
> verification if you later open DONE to outside customers with these scopes.

## 4. Create the OAuth client ID

1. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
2. Application type: **Web application**.
3. **Authorized redirect URIs → Add URI** — this must match exactly:

   ```
   http://localhost:3000/api/integrations/google/callback
   ```

   For a deployed site, use your real domain instead of `http://localhost:3000`
   (and set `APP_URL` / `GOOGLE_REDIRECT_BASE` to match).
4. **Create**. Copy the **Client ID** and **Client secret**.

## 5. Put the values in your `.env`

```dotenv
APP_URL="http://localhost:3000"
GOOGLE_CLIENT_ID="xxxxxxxx.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="xxxxxxxx"
# GOOGLE_REDIRECT_BASE=""   # only needed if it differs from APP_URL

# Recommended in production so OAuth tokens are encrypted with a dedicated key:
# ENCRYPTION_KEY="<64 hex chars>"   # node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Restart the dev server after editing `.env`.

## 6. Connect inside DONE

1. Open DONE → **Connections**.
2. Click **Connect** on **Gmail** (and **Google Calendar**).
3. You'll be sent to Google's real consent screen. Approve.
4. Google may warn the app is "unverified" — because it's in Testing. Click
   **Advanced → Go to DONE (unsafe)** to proceed with your own test-user account.
5. You're returned to DONE, now connected to your real inbox.

---

## What DONE does once connected

- **Gmail** — polls your inbox (`in:inbox newer_than:2d`), understands each
  message, drafts/sends replies, and applies labels. Sends only happen under your
  autonomy level / approvals — nothing goes out silently that policy forbids.
- **Calendar** — syncs your upcoming events into DONE, reads availability, and
  creates/updates events on your real calendar.

Tokens are stored **encrypted at rest** (AES-256-GCM) and never reach the browser.

## Troubleshooting

- **"Google OAuth isn't configured"** — `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`
  missing or server not restarted after editing `.env`.
- **`redirect_uri_mismatch`** — the Authorized redirect URI in Google must match
  `{APP_URL}/api/integrations/google/callback` character-for-character.
- **`access_denied`** — the Google account you used isn't listed under
  **Test users** on the consent screen.
- **"Reconnect required"** — refresh token expired/revoked; click Connect again.
