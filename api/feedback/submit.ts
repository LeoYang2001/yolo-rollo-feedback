import type { VercelRequest, VercelResponse } from "@vercel/node";
import { FieldValue } from "firebase-admin/firestore";
import qrcode from "qrcode";
import { firestore, type FeedbackDoc } from "../_firebase.js";
import { checkEligibility } from "./_eligibility.js";
import {
  GiftCardServiceUnavailable,
  issueGiftCard,
  REWARD_AMOUNT,
} from "./_clover-giftcard.js";
import { renderGiftCardEmail, sendEmail } from "./_email.js";

/**
 * POST /api/feedback
 *
 * Public — no auth (this is the customer form endpoint).
 *
 * Flow:
 *   1. Validate + write feedback doc to Firestore.
 *   2. If the customer left an email, check reward eligibility
 *      (30-day dedupe + daily cap).
 *   3. If eligible, mint a $1 Clover gift card, render a QR PNG,
 *      email it via Resend, and record a row in `rewards` for dedupe.
 *   4. Return a `reward` object describing what happened — the client
 *      uses this to display the right message on /thanks.
 *
 * If ANY step in 2–4 fails, we keep the feedback doc and tell the
 * client the reward wasn't issued (with a short reason). Feedback >
 * reward.
 */

interface RewardResponse {
  issued: boolean;
  /** Friendly status shown on /thanks. */
  status:
    | "emailed"
    | "no-email"
    | "already-rewarded"
    | "daily-cap-reached"
    | "disabled"
    | "service-unavailable"
    | "email-failed"
    | "error";
  /** Visible only on success — masked card number for confirmation. */
  cardLast4?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const body = req.body as Partial<FeedbackDoc> & {
      phone?: string;
    };

    // ── Validation ─────────────────────────────────────────────────
    if (!body || typeof body !== "object") {
      return res.status(400).json({ error: "Body required" });
    }
    const categories = Array.isArray(body.categories) ? body.categories : [];
    const okCategories = categories.filter(
      (c): c is "rolled" | "boba" => c === "rolled" || c === "boba",
    );
    if (okCategories.length === 0) {
      return res.status(400).json({ error: "Pick at least one category" });
    }
    if (okCategories.includes("rolled")) {
      if (!body.rolled || typeof body.rolled.flavorRating !== "number") {
        return res
          .status(400)
          .json({ error: "Rolled feedback requires a flavor rating" });
      }
    }
    if (okCategories.includes("boba")) {
      if (!body.boba || typeof body.boba.flavorRating !== "number") {
        return res
          .status(400)
          .json({ error: "Boba feedback requires a flavor rating" });
      }
    }

    const trim = (s?: string, max = 2000) =>
      typeof s === "string" ? s.slice(0, max) : undefined;

    const doc: FeedbackDoc = {
      orderId: typeof body.orderId === "string" ? body.orderId : undefined,
      categories: okCategories,
      rolled: body.rolled
        ? {
            flavorRating: clamp(body.rolled.flavorRating, 1, 5),
            texture: body.rolled.texture ?? "just-right",
            portion: body.rolled.portion ?? "right",
            flavorsTried: trim(body.rolled.flavorsTried, 500),
            mixinsRating:
              typeof body.rolled.mixinsRating === "number"
                ? clamp(body.rolled.mixinsRating, 0, 5)
                : undefined,
            comment: trim(body.rolled.comment),
          }
        : undefined,
      boba: body.boba
        ? {
            flavorRating: clamp(body.boba.flavorRating, 1, 5),
            sweetness: body.boba.sweetness ?? "right",
            bobaTexture: body.boba.bobaTexture ?? "chewy",
            drinksTried: trim(body.boba.drinksTried, 500),
            comment: trim(body.boba.comment),
          }
        : undefined,
      flavorWish: trim(body.flavorWish, 500),
      name: trim(body.name, 100),
      email: trim(body.email, 200),
      createdAt: FieldValue.serverTimestamp(),
      userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300),
      ip: String(
        req.headers["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "",
      ).slice(0, 100),
    };

    const db = firestore();
    const ref = await db.collection("feedback").add(doc);

    // ── Reward path ────────────────────────────────────────────────
    // Always fall through gracefully — never block the feedback write.
    const reward = await tryIssueReward({
      email: doc.email,
      phone: trim(body.phone, 30),
      customerName: doc.name,
      feedbackId: ref.id,
    });

    return res.status(200).json({ ok: true, id: ref.id, reward });
  } catch (err) {
    console.error("[feedback/submit]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

async function tryIssueReward(args: {
  email?: string;
  phone?: string;
  customerName?: string;
  feedbackId: string;
}): Promise<RewardResponse> {
  // No email = no delivery channel. We could SMS via Twilio later, but
  // for now email is the only path.
  if (!args.email) return { issued: false, status: "no-email" };

  let elig;
  try {
    elig = await checkEligibility({ email: args.email, phone: args.phone });
  } catch (e) {
    console.warn("[reward] eligibility check failed:", (e as Error).message);
    return { issued: false, status: "error" };
  }
  if (!elig.eligible) {
    if (elig.reason === "already-rewarded")
      return { issued: false, status: "already-rewarded" };
    if (elig.reason === "daily-cap-reached")
      return { issued: false, status: "daily-cap-reached" };
    if (elig.reason === "disabled")
      return { issued: false, status: "disabled" };
    return { issued: false, status: "no-email" };
  }

  let card;
  try {
    card = await issueGiftCard();
  } catch (e) {
    if (e instanceof GiftCardServiceUnavailable) {
      console.warn("[reward] gift card service unavailable:", e.message);
      return { issued: false, status: "service-unavailable" };
    }
    console.error("[reward] gift card creation failed:", (e as Error).message);
    return { issued: false, status: "error" };
  }

  // Generate the QR PNG as a data: URL we can embed straight into the
  // email HTML. The encoded value is the gift card number — same thing
  // staff would type into the POS to redeem.
  let qrDataUrl: string;
  try {
    qrDataUrl = await qrcode.toDataURL(card.cardNumber, {
      width: 480,
      margin: 1,
      color: { dark: "#2A1722", light: "#FFFFFF" },
    });
  } catch (e) {
    console.error("[reward] QR generation failed:", (e as Error).message);
    return { issued: false, status: "error" };
  }

  // Record the reward BEFORE the email — that way if the customer
  // hits Submit twice we won't accidentally mint two cards.
  try {
    await firestore()
      .collection("rewards")
      .add({
        feedbackId: args.feedbackId,
        email: args.email.trim().toLowerCase(),
        phone: args.phone,
        cardId: card.id,
        cardNumber: card.cardNumber,
        amountCents: card.amount,
        createdAt: FieldValue.serverTimestamp(),
      });
  } catch (e) {
    // Log + continue — we'd rather email them the card we just minted
    // than swallow the whole thing because dedupe row failed to write.
    console.error("[reward] rewards-doc write failed:", (e as Error).message);
  }

  const { subject, html } = renderGiftCardEmail({
    cardNumber: card.cardNumber,
    amountCents: card.amount,
    qrDataUrl,
    customerName: args.customerName,
  });
  const sent = await sendEmail({ to: args.email, subject, html });
  if (!sent.ok) {
    console.warn("[reward] email send failed:", sent.reason);
    return {
      issued: true, // card was minted; just delivery failed
      status: "email-failed",
      cardLast4: card.cardNumber.slice(-4),
    };
  }

  return {
    issued: true,
    status: "emailed",
    cardLast4: card.cardNumber.slice(-4),
  };
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

export const REWARD_AMOUNT_EXPORT = REWARD_AMOUNT;
