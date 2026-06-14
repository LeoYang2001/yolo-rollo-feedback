/**
 * Reward minting — Clover Ecommerce Gift Card API with custom-code fallback.
 *
 * Path 1 (preferred): real Clover virtual gift card via the Ecommerce
 *   Gift Card API. Customer redeems at the Clover POS like any other
 *   gift card — POS deducts the balance, Clover tracks remaining
 *   value.
 *
 *   Endpoint:  POST <base>/v1/activate
 *   Auth:      Bearer <CLOVER_ECOMM_API_TOKEN>  (the Ecommerce API
 *              token / "PAKMS" private key — DIFFERENT from the REST
 *              API token used elsewhere)
 *   Body:      { promotion_code, amount, currency }
 *   Response:  { id, amount, gift_card: { number, security_card_value, ... } }
 *
 * Path 2 (fallback): generate a custom YR-XXXX-XXXX code, recorded in
 *   Firestore. Staff applies a $1-off discount manually in Clover. Used
 *   when CLOVER_ECOMM_* env vars aren't set OR when the activation call
 *   fails (gracefully degrades — customer still gets a redeemable reward).
 *
 * The fallback lets you flip between modes by toggling env vars without
 * any redeploy, and lets you ship today even before all the Clover
 * dashboard configuration is in place.
 */

import crypto from "node:crypto";

const REWARD_AMOUNT_CENTS = Number(process.env.REWARD_AMOUNT_CENTS ?? 100);

// Ecommerce API base. Note this is a DIFFERENT host than the regular
// REST API (api.clover.com). The ecommerce host pattern:
//   Production: https://scl.clover.com
//   Sandbox:    https://scl-sandbox.dev.clover.com
const ECOMM_BASE =
  process.env.CLOVER_ECOMM_API_BASE ?? "https://scl.clover.com";
const ECOMM_TOKEN = process.env.CLOVER_ECOMM_API_TOKEN ?? "";
const PROMO_CODE = process.env.CLOVER_GIFT_CARD_PROMO_CODE ?? "";

// 32-char alphabet without ambiguous glyphs (0/O, 1/I/L) for the
// fallback YR-XXXX-XXXX codes. Powers-of-2 size = unbiased bitmask.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ_";

export interface IssuedGiftCard {
  /** Firestore doc id (filled in by caller). */
  id: string;
  /** The card number staff enters at Clover POS, OR our custom code. */
  cardNumber: string;
  /** Security code (4-8 digits) — only set when it's a real Clover card. */
  securityCode?: string;
  /** Expiration ISO date — only set for real Clover cards. */
  expiresAt?: string;
  /** Cents the customer gets off. */
  amount: number;
  /** How the card was minted, for downstream redemption logic. */
  source: "clover" | "custom";
  createdAt: string;
}

/** Distinct error so callers can fall back instead of bailing. */
export class GiftCardServiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiftCardServiceUnavailable";
  }
}

/** Shape of the Clover activation response we care about. */
interface CloverActivationResponse {
  id?: string;
  amount?: number;
  status?: string;
  outcome?: { type?: string; network_status?: string };
  gift_card?: {
    number?: string;
    security_card_value?: string;
    expiration_date?: string;
    new_balance?: number;
  };
  error?: { message?: string; code?: string };
}

export async function issueGiftCard(): Promise<IssuedGiftCard> {
  // Try real Clover first if both required env vars are present.
  if (ECOMM_TOKEN && PROMO_CODE) {
    try {
      return await activateCloverGiftCard();
    } catch (e) {
      // Log + fall through to custom code. Surfacing it loudly so we
      // can spot misconfiguration in Vercel logs.
      console.warn(
        "[giftcard] Clover activation failed, falling back to custom code:",
        (e as Error).message,
      );
    }
  }
  return generateCustomCode();
}

async function activateCloverGiftCard(): Promise<IssuedGiftCard> {
  const url = `${ECOMM_BASE}/v1/activate`;
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ECOMM_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      promotion_code: PROMO_CODE,
      amount: REWARD_AMOUNT_CENTS,
      currency: "usd",
    }),
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    if (r.status === 401 || r.status === 403 || r.status === 404) {
      throw new GiftCardServiceUnavailable(
        `Clover ecomm gift card API ${r.status}: ${body.slice(0, 200)}`,
      );
    }
    throw new Error(`Clover ecomm activation ${r.status}: ${body.slice(0, 200)}`);
  }
  const data = (await r.json()) as CloverActivationResponse;
  if (data.status && data.status !== "succeeded") {
    throw new Error(`Clover activation status=${data.status}`);
  }
  const number = data.gift_card?.number;
  if (!number) {
    throw new Error(
      `Clover returned no gift_card.number: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  return {
    id: "",
    cardNumber: number,
    securityCode: data.gift_card?.security_card_value,
    expiresAt: data.gift_card?.expiration_date,
    amount: data.amount ?? REWARD_AMOUNT_CENTS,
    source: "clover",
    createdAt: new Date().toISOString(),
  };
}

function generateCustomCode(): IssuedGiftCard {
  const bytes = crypto.randomBytes(8);
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) chars.push(ALPHABET[bytes[i] & 0x1f]);
  return {
    id: "",
    cardNumber: `YR-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`,
    amount: REWARD_AMOUNT_CENTS,
    source: "custom",
    createdAt: new Date().toISOString(),
  };
}

export const REWARD_AMOUNT = REWARD_AMOUNT_CENTS;
