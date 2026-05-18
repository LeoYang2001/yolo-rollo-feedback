/**
 * Reward code generator (not actually a Clover gift card any more).
 *
 * We tried calling Clover's `/v3/merchants/{mId}/gift_cards` POST to
 * mint real gift cards programmatically — Clover returned 405 because
 * that endpoint is read-only. Programmatic creation of Clover gift
 * cards requires either a POS-side sale or a vendor-specific API
 * (Valutec, SVS, etc.) that we don't have access to.
 *
 * Instead, we generate a unique short code per reward. The customer's
 * email shows the QR + code; staff scans it on `/redeem`, validates
 * (not expired, not already used), then manually applies the
 * configured `REWARD_AMOUNT_CENTS` (default $1) off the order at the
 * Clover POS — same workflow as a paper coupon, but trackable.
 *
 * Format: "YR-XXXX-XXXX" (10 chars + separators) using a 32-char
 * alphabet that drops ambiguous glyphs (0/O, 1/I/L) so customers can
 * read it aloud cleanly if the QR fails to scan.
 *
 * The filename + exported symbols are kept identical to the old
 * Clover-backed version so the surrounding code (submit.ts) doesn't
 * need to change.
 */

import crypto from "node:crypto";

const REWARD_AMOUNT_CENTS = Number(
  process.env.REWARD_AMOUNT_CENTS ?? 100, // default $1.00
);

// 32 characters, no 0/O/1/I/L. Powers of 2 size makes mapping bytes
// → chars an unbiased bitmask.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ_";

export interface IssuedGiftCard {
  /** Firestore doc id (filled in by the caller after .add()). Left
   *  empty here since the code doesn't know about Firestore. */
  id: string;
  /** The redemption code itself. Customer shows this; staff scans on /redeem. */
  cardNumber: string;
  /** Cents the customer gets off. */
  amount: number;
  /** ISO when the code was minted. */
  createdAt: string;
}

/**
 * Kept exported so existing imports in submit.ts still compile. We
 * never throw this any more (the code generator can't fail under
 * normal conditions) but the type is referenced as `instanceof` in
 * the caller's catch block.
 */
export class GiftCardServiceUnavailable extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GiftCardServiceUnavailable";
  }
}

export async function issueGiftCard(): Promise<IssuedGiftCard> {
  return {
    id: "", // populated by caller after Firestore.add()
    cardNumber: generateCode(),
    amount: REWARD_AMOUNT_CENTS,
    createdAt: new Date().toISOString(),
  };
}

function generateCode(): string {
  // 8 random characters from ALPHABET — gives 32^8 ≈ 1 trillion codes.
  // Plenty of headroom even if we hand out 1K/day for years.
  const bytes = crypto.randomBytes(8);
  const chars: string[] = [];
  for (let i = 0; i < 8; i++) {
    chars.push(ALPHABET[bytes[i] & 0x1f]); // mod 32
  }
  return `YR-${chars.slice(0, 4).join("")}-${chars.slice(4).join("")}`;
}

export const REWARD_AMOUNT = REWARD_AMOUNT_CENTS;
