/**
 * Clover Gift Card creation.
 *
 * Calls Clover's first-party Gift Cards API to mint a fresh card with
 * the configured reward amount (default 100¢ = $1.00). Returns the
 * card details we need to render a QR.
 *
 * IMPORTANT: This requires the merchant to have Clover's Gift Card
 * service activated AND the REST API token to include the GIFTCARDS_W
 * permission. If either is missing, the call returns HTTP 401/403 or
 * 404 and we surface that as a typed error so the caller can fall back
 * gracefully (no reward issued, feedback still saved).
 *
 * The Clover docs for this API live under "Gift Cards" in the REST
 * reference. Endpoint pattern observed in production:
 *   POST /v3/merchants/{mId}/gift_cards
 *   Body: { amount: <cents> }
 *   Response: { id, cardNumber, balance, ... }
 *
 * If your account's gift card vendor differs (Valutec / SVS), the
 * endpoint may be different — check your Clover dashboard's API tab.
 * Adjust the `endpoint` constant below if needed.
 */

const ENDPOINT = "/gift_cards";
const REWARD_AMOUNT_CENTS = Number(
  process.env.REWARD_AMOUNT_CENTS ?? 100, // default $1.00
);

const BASE = process.env.CLOVER_API_BASE ?? "https://api.clover.com";
const MID = process.env.CLOVER_MERCHANT_ID ?? "";
const TOKEN = process.env.CLOVER_API_TOKEN ?? "";

export interface IssuedGiftCard {
  id: string;
  cardNumber: string;
  /** Cents. */
  amount: number;
  /** ISO string when the card was created. */
  createdAt: string;
}

export class GiftCardServiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiftCardServiceUnavailable";
  }
}

interface CloverGiftCardResponse {
  id?: string;
  cardNumber?: string;
  number?: string; // some versions use `number` instead of `cardNumber`
  balance?: number;
  createdTime?: number;
}

export async function issueGiftCard(): Promise<IssuedGiftCard> {
  if (!MID || !TOKEN) {
    throw new GiftCardServiceUnavailable(
      "Missing CLOVER_MERCHANT_ID or CLOVER_API_TOKEN",
    );
  }

  const url = `${BASE}/v3/merchants/${MID}${ENDPOINT}`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount: REWARD_AMOUNT_CENTS }),
  });

  // 401/403/404 all suggest the gift card service isn't wired up for
  // this merchant/token. Surface as a distinct error so the caller can
  // continue without breaking the feedback path.
  if (r.status === 401 || r.status === 403 || r.status === 404) {
    const body = await r.text().catch(() => "");
    throw new GiftCardServiceUnavailable(
      `Clover gift card API ${r.status}: ${body.slice(0, 200)}`,
    );
  }
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Clover gift card API ${r.status}: ${body.slice(0, 200)}`);
  }
  const data = (await r.json()) as CloverGiftCardResponse;
  const cardNumber = data.cardNumber ?? data.number;
  if (!data.id || !cardNumber) {
    throw new Error(
      `Clover returned malformed gift card: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return {
    id: data.id,
    cardNumber,
    amount: REWARD_AMOUNT_CENTS,
    createdAt: new Date(data.createdTime ?? Date.now()).toISOString(),
  };
}

export const REWARD_AMOUNT = REWARD_AMOUNT_CENTS;
