import type { VercelRequest, VercelResponse } from "@vercel/node";
import { issueToken, pinMatches } from "../_session.js";

/**
 * POST /api/admin/auth   { pin: "808080" }
 *
 * Validates the PIN and returns a 12-hour HMAC session token used by
 * the dashboard's subsequent GET /api/feedback calls.
 *
 * No rate limiting on purpose (low-stakes feedback admin), but DO set a
 * strong PIN. To rotate access, change FEEDBACK_SESSION_SECRET in Vercel
 * and redeploy — every existing token instantly becomes invalid.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const pin = String((req.body as { pin?: string } | undefined)?.pin ?? "");
  if (!pinMatches(pin)) {
    return res.status(401).json({ error: "Invalid PIN" });
  }
  try {
    return res.status(200).json({ token: issueToken() });
  } catch (err) {
    console.error("[admin/auth]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
