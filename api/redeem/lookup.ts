import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import { firestore } from "../_firebase.js";
import { tokenFromRequest, verifyToken } from "../_session.js";

/**
 * POST /api/redeem/lookup    { cardNumber: "1234..." }
 *
 * Staff-only — same PIN session token as /admin. Given a card number
 * (decoded from a customer's QR scan), looks it up in the `rewards`
 * collection and returns the record so staff can verify it's real
 * before applying it at the Clover POS.
 *
 * Also stamps a `scannedAt` timestamp + `scanCount` so we have an audit
 * trail. The actual gift card balance is managed by Clover — we don't
 * try to dual-track it, just confirm the card we issued matches what
 * the customer is showing.
 *
 * Returns 404 if no matching reward exists. That's the "fake QR"
 * signal staff should refuse to honor.
 */

interface LookupBody {
  cardNumber?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (!verifyToken(tokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const body = (req.body ?? {}) as LookupBody;
  const cardNumber = (body.cardNumber ?? "").trim();
  if (!cardNumber) {
    return res.status(400).json({ error: "cardNumber required" });
  }
  res.setHeader("Cache-Control", "no-store");

  try {
    const db = firestore();
    const snap = await db
      .collection("rewards")
      .where("cardNumber", "==", cardNumber)
      .limit(1)
      .get();
    if (snap.empty) {
      // Either the scan misread, the customer fabricated a code, or a
      // card was issued before we started recording rewards. Either
      // way we don't honor it without a record.
      return res.status(404).json({ error: "No matching reward issued" });
    }
    const doc = snap.docs[0];
    const data = doc.data();

    // Stamp the scan event. Useful for "did staff see this?" audits and
    // for spotting weird re-scans. We don't BLOCK on prior scans —
    // Clover is the source of truth for balance, so re-scanning a card
    // that's already been redeemed should just show $0 there.
    await doc.ref.set(
      {
        scannedAt: FieldValue.serverTimestamp(),
        scanCount: FieldValue.increment(1),
      },
      { merge: true },
    );

    const tsToMs = (v: unknown): number | undefined => {
      if (
        v &&
        typeof v === "object" &&
        typeof (v as { toMillis?: () => number }).toMillis === "function"
      ) {
        return (v as { toMillis: () => number }).toMillis();
      }
      return undefined;
    };

    return res.status(200).json({
      cardNumber: data.cardNumber,
      amountCents: data.amountCents,
      email: data.email,
      issuedAtMs: tsToMs(data.createdAt),
      scanCount: ((data.scanCount as number) ?? 0) + 1,
      // Surface if this is a repeat scan so staff can double-check
      // before applying it twice.
      previouslyScanned: typeof data.scanCount === "number" && data.scanCount > 0,
    });
  } catch (err) {
    console.error("[redeem/lookup]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
