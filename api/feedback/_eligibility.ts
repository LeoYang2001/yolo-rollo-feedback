/**
 * Reward eligibility gating.
 *
 * Two checks before we hand out a $1 gift card:
 *   1. 30-day dedupe — same email/phone hasn't already claimed one.
 *   2. Daily cap   — total rewards issued today < REWARD_DAILY_CAP.
 *
 * Both checks read from the `rewards` collection (Firestore). Each
 * issued gift card creates one doc there, with `email`, `phone` (if
 * provided), and a server timestamp. Cheap: typical shop won't break
 * 50 docs/day, so a single .where() + .count() is trivial.
 */
import { firestore } from "../_firebase.js";

const DAILY_CAP = Number(process.env.REWARD_DAILY_CAP ?? 50);
const DEDUPE_DAYS = 30;

export interface EligibilityCheck {
  eligible: boolean;
  /** Reason customers see if not eligible. Friendly + non-revealing. */
  reason?:
    | "no-contact"
    | "already-rewarded"
    | "daily-cap-reached"
    | "disabled";
}

/**
 * Normalize email + phone so superficial variations (case, +1 prefix,
 * trailing whitespace) still dedupe correctly.
 */
function normEmail(s?: string): string | undefined {
  if (!s) return undefined;
  const t = s.trim().toLowerCase();
  return t || undefined;
}
function normPhone(s?: string): string | undefined {
  if (!s) return undefined;
  const digits = s.replace(/\D/g, "");
  // Strip a leading "1" so +1 (901) 555-... matches 901-555-... .
  const stripped = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  return stripped || undefined;
}

export async function checkEligibility(args: {
  email?: string;
  phone?: string;
}): Promise<EligibilityCheck> {
  // Reward path can be toggled off via env without redeploy by setting
  // REWARD_DAILY_CAP=0. Useful when you're running low on Clover gift
  // card balance or troubleshooting.
  if (DAILY_CAP <= 0) return { eligible: false, reason: "disabled" };

  const email = normEmail(args.email);
  const phone = normPhone(args.phone);
  if (!email && !phone) return { eligible: false, reason: "no-contact" };

  const db = firestore();

  // ── Dedupe (30 days) ──────────────────────────────────────────────
  const cutoffMs = Date.now() - DEDUPE_DAYS * 24 * 3600 * 1000;
  const cutoff = new Date(cutoffMs);

  if (email) {
    const dup = await db
      .collection("rewards")
      .where("email", "==", email)
      .where("createdAt", ">=", cutoff)
      .limit(1)
      .get();
    if (!dup.empty) return { eligible: false, reason: "already-rewarded" };
  }
  if (phone) {
    const dup = await db
      .collection("rewards")
      .where("phone", "==", phone)
      .where("createdAt", ">=", cutoff)
      .limit(1)
      .get();
    if (!dup.empty) return { eligible: false, reason: "already-rewarded" };
  }

  // ── Daily cap ────────────────────────────────────────────────────
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const todays = await db
    .collection("rewards")
    .where("createdAt", ">=", dayStart)
    .count()
    .get();
  if (todays.data().count >= DAILY_CAP) {
    return { eligible: false, reason: "daily-cap-reached" };
  }

  return { eligible: true };
}

export const REWARD_CONFIG = { DAILY_CAP, DEDUPE_DAYS };
