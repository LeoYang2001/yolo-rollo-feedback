/**
 * PIN-gated session tokens for the admin dashboard. Same HMAC pattern
 * as the ordering app's KDS — keeps it stateless (no DB hit per
 * request) and survives across redeploys.
 *
 * Token format: `<expiryUnixSeconds>.<hex-hmac>`
 *
 * Required env vars:
 *   FEEDBACK_ADMIN_PIN          e.g. 808080
 *   FEEDBACK_SESSION_SECRET     random ≥32-char string; rotate to log everyone out
 */
import crypto from "node:crypto";
import type { VercelRequest } from "@vercel/node";

const TTL_HOURS = 12;

function secret(): string {
  const s = process.env.FEEDBACK_SESSION_SECRET;
  if (!s) throw new Error("FEEDBACK_SESSION_SECRET env var not set");
  return s;
}

export function issueToken(): string {
  const exp = Math.floor(Date.now() / 1000) + TTL_HOURS * 3600;
  const sig = crypto
    .createHmac("sha256", secret())
    .update(String(exp))
    .digest("hex");
  return `${exp}.${sig}`;
}

export function verifyToken(token: string | null | undefined): boolean {
  if (!token || !token.includes(".")) return false;
  const [expStr, sig] = token.split(".");
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  let expected: string;
  try {
    expected = crypto
      .createHmac("sha256", secret())
      .update(String(exp))
      .digest("hex");
  } catch {
    return false;
  }
  // Constant-time compare to avoid leaking timing info.
  const a = Buffer.from(sig, "hex");
  const b = Buffer.from(expected, "hex");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function tokenFromRequest(req: VercelRequest): string | null {
  const h = req.headers.authorization ?? "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return null;
}

export function pinMatches(pin: string): boolean {
  const expected = process.env.FEEDBACK_ADMIN_PIN ?? "";
  return !!expected && pin === expected;
}
