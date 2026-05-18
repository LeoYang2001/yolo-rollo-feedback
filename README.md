# Yolo Rollo — Flavor Feedback

A small companion app to the Yolo Rollo ordering site. Customers leave
quick post-visit feedback; staff browse it on a PIN-gated dashboard.

## Routes

- `/` — customer form. With `?orderId=<clover-id>`, pre-fills which categories to ask about. Without, shows a "what did you have today?" picker.
- `/thanks` — confirmation after submit (also shows reward status).
- `/admin` — PIN-gated dashboard with filters by category, rating band, and date range.
- `/redeem` — PIN-gated camera scanner for verifying gift card QRs at the counter.

### Redemption workflow

1. Customer opens the email on their phone, shows the QR at the counter.
2. Staff opens `/redeem` on the KDS tablet, enters the PIN.
3. Tap "Start scanning" → point at the customer's QR.
4. Page shows the card number + status (first scan / previously scanned).
5. Staff types the card number into the Clover POS as a normal gift card.

`/redeem` doesn't redeem the card itself — Clover tracks gift card balance. The page just verifies we issued the QR and audits scans into the `rewards` collection (each scan stamps `scannedAt` + increments `scanCount`).

## Stack

Same as the ordering site so design/patterns transfer cleanly:

- Vite + React 18 + TypeScript + Tailwind (Rollo "Sweet Sundae" palette)
- Vercel serverless functions for API
- Firebase Admin SDK → writes into the **same** Firebase project as ordering, in a new `feedback` collection
- Clover REST API (read-only, just to look up order categories)

## Setup

```bash
npm install
cp .env.example .env.local      # fill in real values for local dev
npm run vercel-dev               # or `npm run dev` if you don't need API routes locally
```

## Deploy

1. Push to a new GitHub repo named `yolo-rollo-feedback`.
2. Import the repo in Vercel → "Add New Project".
3. Add all env vars from `.env.example` (use the same values as the ordering project's vars).
4. Deploy.

## Reward path

After a customer submits feedback with their email:

1. `_eligibility.ts` checks the `rewards` collection for the same email in the last 30 days + that today's daily cap (`REWARD_DAILY_CAP`, default 50) hasn't been hit.
2. `_clover-giftcard.ts` calls `POST /v3/merchants/{mId}/gift_cards` to mint a $1 card (`REWARD_AMOUNT_CENTS`, default 100). Requires Clover's Gift Card service to be active on the merchant + `GIFTCARDS_W` permission on the API token.
3. `qrcode` package generates a 480px QR PNG as a data URL.
4. `_email.ts` sends the QR + card number via Resend.
5. The reward outcome is returned in the `/api/feedback` response so `/thanks` can show the right copy.

**Disabling the reward** without redeploying: set `REWARD_DAILY_CAP=0` in Vercel. Feedback writes keep working; customers get a neutral "thanks" page.

**Domain verification for email**: Resend requires a verified domain before you can send from `@yourdomain.com`. Quickest path: add a CNAME + TXT record per Resend's onboarding, takes ~10 min.

## Architecture notes

- **Same Firebase project** — credentials are reused from the ordering app; new collection `feedback` keeps writes isolated from `tickets`.
- **No Firestore composite indexes needed** — `/api/feedback` orders by `createdAt` then filters in JS.
- **PIN auth** is stateless HMAC, same pattern as the KDS. Rotate `FEEDBACK_SESSION_SECRET` to invalidate every active token.
- **Order category detection** is pure regex on item names (see `api/order/[orderId]/categories.ts`). Tune the regexes when you add new product categories.

## Wiring the confirmation-page link

In the ordering app's order-confirmation page, add:

```jsx
<a href={`https://feedback.yolorollo.com/?orderId=${orderId}`}>
  Rate your flavors →
</a>
```

(Replace the host with whatever Vercel domain this app deploys to.)
