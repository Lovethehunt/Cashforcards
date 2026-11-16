# cashforcards.app

Landing page and intake system for buying trading cards (Pokémon, sports, Magic: The Gathering and more), as singles or bulk.

## What's here

| Path | What it does |
| --- | --- |
| `index.html` | Landing page and sell form |
| `privacy.html` | Privacy policy (served at `/privacy`) |
| `admin.html` | Password-protected submissions dashboard (served at `/admin`) |
| `assets/` | Styles, scripts, favicon |
| `api/photo.js` | Receives one photo at a time and stores it in Vercel Blob |
| `api/submit.js` | Validates a submission, saves it to Postgres, emails you |
| `api/submissions.js` | Admin list (GET) and update (PATCH) |
| `api/_lib/` | Shared database, email and helper code |

There's no build step. The database table is created automatically on the first submission.

## How a submission flows

1. The seller fills out the form. The browser shrinks each photo (longest side 2000 px) and uploads it to `/api/photo`.
2. The form posts to `/api/submit` with the photo URLs.
3. The submission is saved to the database, and you get an email with the details and photos.
4. You work it from `/admin`: set the status, record your offer and keep notes. "Sent to partner" is only allowed when the seller checked the partner-sharing box.

## Setup on Vercel

1. **Import the repo:** vercel.com → Add New → Project → import `cashforcards`. Leave Framework Preset as **Other**, then click Deploy.
2. **Photo storage:** Project → Storage → Create → **Blob** → connect it to the project. This adds `BLOB_READ_WRITE_TOKEN`.
3. **Database:** Project → Storage → Create → **Neon (Postgres)** → connect it to the project. This adds `DATABASE_URL`.
4. **Email alerts:** create a free account at resend.com and make an API key.
5. **Environment variables:** Project → Settings → Environment Variables. Add these:
   - `ADMIN_PASSWORD`: a long password for `/admin`.
   - `RESEND_API_KEY`: from step 4.
   - `NOTIFY_EMAIL`: where new-submission alerts go. Until your domain is verified in Resend, this must be the email you signed up to Resend with.
   - `FROM_EMAIL`: `onboarding@resend.dev` for now.
6. **Redeploy:** Deployments → ⋯ → Redeploy, so the new variables take effect.
7. **Domain:** Project → Settings → Domains → add `cashforcards.app`, then follow the DNS instructions at your registrar.
8. **Later: email sellers a receipt.** In Resend, verify `cashforcards.app`. Then set `FROM_EMAIL` to `Cash for Cards <offers@cashforcards.app>` and `SEND_SELLER_CONFIRMATION` to `true`.

## Before launch

- Replace `[CONTACT EMAIL]` and `[24]` (the retention period) in `privacy.html`.
- Have the privacy policy reviewed. It covers sharing with partner buyers.
- Submit a test card on the live site and check that it shows up in `/admin`.
