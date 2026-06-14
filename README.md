# Yolo Rollo — Flavor Feedback

A standalone product-review web form for Yolo Rollo. Customers leave a
quick review; if they rate us highly (avg > 4.5/5) we nudge them to post
a public Google review, and anyone who leaves an email gets a $1-off
Clover reward. Staff browse reviews on a PIN-gated dashboard.

> **Not wired to ordering.** This app no longer talks to the online
> ordering / Clover order system — it's a self-contained form. (The old
> `?orderId=` pre-fill path and the `/api/order/*` lookup were removed.)

## Routes

- `/` — customer review form. Shows a "what did you have today?" picker, then the matching question sets.
- `/review` — Google-review nudge, shown only to high raters (avg > 4.5/5) right before `/thanks`.
- `/thanks` — confirmation after submit. Shows the $1 reward (code + QR) **on screen**, and emails a copy.
- `/admin` — PIN-gated dashboard with filters by category, rating band, and date range.
- `/redeem` — PIN-gated camera scanner for verifying gift card QRs at the counter.

### Rating → Google review gate

On submit the client averages the flavor star ratings across the
categories reviewed. If that average is **> 4.5** (with whole-star
ratings, effectively all 5s) the customer is routed through `/review`
first — a full-screen "leave us a Google review" prompt — and then on to
`/thanks` for their reward. Everyone at or below 4.5 goes straight to
`/thanks`. The destination link is `VITE_GOOGLE_REVIEW_URL` (build-time);
leave it blank to disable the nudge.

### Redemption workflow

1. Customer opens the email on their phone, shows the QR at the counter.
2. Staff opens `/redeem` on the KDS tablet, enters the PIN.
3. Tap "Start scanning" → point at the customer's QR.
4. Page shows the card number + status (first scan / previously scanned).
5. Staff types the card number into the Clover POS as a normal gift card.

`/redeem` doesn't redeem the card itself — Clover tracks gift card balance. The page just verifies we issued the QR and audits scans into the `rewards` collection (each scan stamps `scannedAt` + increments `scanCount`).

## Stack

Shares the ordering site's design system so patterns transfer cleanly:

- Vite + React 18 + TypeScript + Tailwind (Rollo "Sweet Sundae" palette)
- Vercel serverless functions for API
- Firebase Admin SDK → writes into the **same** Firebase project as ordering, in a separate `feedback` collection
- Clover Ecommerce Gift Card API for the $1 reward (with a custom-code fallback — see Reward path)

## Setup

```bash
npm install
cp .env.example .env             # fill in real values (see note below)
npm run dev:full                 # Vite UI (:5174) + vercel dev API (:3001) together
```

Then open http://localhost:5174.

> **Use `.env`, not `.env.local`.** The `/api` functions run under
> `vercel dev`, which reads **`.env`** and does *not* read `.env.local`.
> Vite reads both, so a single `.env` covers the whole app. Both are
> gitignored.

**Local dev runs two servers** (wired together by `npm run dev:full`):
Vite serves the frontend on `:5174` and proxies `/api/*` to a `vercel
dev` instance on `:3001` that runs the serverless functions. This avoids
a `vercel dev`/Vite conflict — the SPA rewrite in `vercel.json` (needed
in production) otherwise intercepts Vite's dev module requests. Run the
halves separately with `npm run dev` (UI only) and `npm run api` (API
only) if you prefer.

> First `npm run api` (or `dev:full`) auto-links the repo to a Vercel
> project and creates a gitignored `.vercel/`. Requires `vercel login`.

## Deploy

1. Push to a new GitHub repo named `yolo-rollo-feedback`.
2. Import the repo in Vercel → "Add New Project".
3. Add the env vars from `.env.example` (Firebase creds can be copied from the ordering project; set `VITE_GOOGLE_REVIEW_URL` and the reward/Resend vars for this app).
4. Deploy.

## Reward path

After a customer submits a review with their email:

1. `_eligibility.ts` checks the `rewards` collection for the same email in the last 30 days + that today's daily cap (`REWARD_DAILY_CAP`, default 50) hasn't been hit. Uses single-field `where` queries (no composite indexes required).
2. `_clover-giftcard.ts` mints the reward. **Path 1 (preferred):** if `CLOVER_ECOMM_API_TOKEN` + `CLOVER_GIFT_CARD_PROMO_CODE` are set, it activates a real Clover virtual gift card via the Ecommerce `POST /v1/activate` endpoint. **Path 2 (fallback):** otherwise (or if that call fails) it generates a custom `YR-XXXX-XXXX` code with `crypto.randomBytes`; the alphabet excludes ambiguous glyphs (0/O, 1/I/L) so it can be read aloud if the QR won't scan.
3. `qrcode` generates a 480px QR PNG (encoding the card number / code) as a data URL.
4. `_email.ts` sends the QR + code via Resend with a "$1 off your next visit" subject.
5. The reward — **including the full code + QR** — is returned in the `/api/feedback/submit` response so `/thanks` can render it **on screen** (and the right status copy). The full value is only ever shown to the customer who just earned it.

**Why the fallback exists.** Clover's *REST* `gift_cards` endpoint is read-only (`POST` returns 405), so real cards must go through the separate *Ecommerce* Gift Card API, which needs dashboard setup (enable gift-card payments, create a promo code, mint an Ecommerce token). Until that's in place — or if it errors — the custom `YR-` code gives you a redeemable reward today with a clean Firestore audit trail. Flip between modes purely by setting/unsetting the `CLOVER_ECOMM_*` env vars; no redeploy.

**Redemption at the counter** is via `/redeem` (see below). Staff scans → page validates code is valid + first-scan → staff manually applies $1 off in Clover (one-tap discount line). The reward code is stamped `scannedAt + scanCount` in Firestore so a second scan flags as a re-use.

**Disabling the reward** without redeploying: set `REWARD_DAILY_CAP=0` in Vercel. Feedback writes keep working; customers get a neutral "thanks" page.

**Domain verification for email**: Resend requires a verified domain before you can send from `@yourdomain.com`. Quickest path: add a CNAME + TXT record per Resend's onboarding, takes ~10 min.

## Architecture notes

- **Same Firebase project** — credentials are reused from the ordering app; the `feedback` collection keeps writes isolated from `tickets`.
- **No Firestore composite indexes needed** — `/api/feedback/list` orders by `createdAt` then filters in JS.
- **PIN auth** is stateless HMAC, same pattern as the KDS. Rotate `FEEDBACK_SESSION_SECRET` to invalidate every active token.
- **Standalone** — there's no dependency on the ordering app at runtime; share the form's URL via QR code, a link in the menu, a receipt footer, etc.

## Configuring the Google review link

Set `VITE_GOOGLE_REVIEW_URL` (build-time, so re-deploy after changing it). Grab the link from your Google Business Profile → **Ask for reviews** — it looks like `https://g.page/r/<place-id>/review`. Leave it blank to disable the high-rating Google nudge entirely (high raters then just go straight to `/thanks`).
