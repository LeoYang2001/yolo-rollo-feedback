import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cloverRest } from "../../_clover.js";

/**
 * GET /api/order/{orderId}/categories
 *
 * Public — read-only. Given a Clover order id (from a confirmation
 * page link), figure out which question sets to show: rolled, boba, or
 * both. Also returns the raw item names so the form can pre-fill the
 * "which flavor(s) did you try?" inputs.
 *
 * Heuristic-based classification (no LLM call) so it's cheap and
 * deterministic. Adjust the regexes if you add new product lines.
 */

interface CloverLineItem {
  name?: string;
}
interface CloverOrder {
  id?: string;
  customers?: { elements?: { firstName?: string; lastName?: string }[] };
  lineItems?: { elements?: CloverLineItem[] };
  note?: string;
}

// Item-name patterns. Case-insensitive. Order matters — boba check
// runs first so "Strawberry Bubble Tea" doesn't match the rolled regex.
const BOBA_RE =
  /\b(bubble\s*tea|boba|milk\s*tea|fruit\s*tea|smoothie|popping)\b/i;
const ROLLED_RE =
  /\b(rolled|ice\s*cream|signature|yolo signature|gelato)\b/i;

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  const { orderId } = req.query as { orderId?: string };
  if (!orderId || typeof orderId !== "string") {
    return res.status(400).json({ error: "orderId required" });
  }
  res.setHeader("Cache-Control", "public, max-age=60");
  try {
    const order = await cloverRest<CloverOrder>(
      `/orders/${encodeURIComponent(orderId)}?expand=lineItems,customers`,
    );
    const items = order.lineItems?.elements ?? [];

    const rolledItems: string[] = [];
    const bobaItems: string[] = [];
    for (const li of items) {
      const name = (li.name ?? "").trim();
      if (!name) continue;
      if (BOBA_RE.test(name)) {
        bobaItems.push(name);
      } else if (ROLLED_RE.test(name)) {
        rolledItems.push(name);
      } else {
        // Unknown items default to rolled — most Yolo Rollo SKUs are
        // ice cream variants without an explicit keyword.
        rolledItems.push(name);
      }
    }

    const categories: ("rolled" | "boba")[] = [];
    if (rolledItems.length) categories.push("rolled");
    if (bobaItems.length) categories.push("boba");

    const c = order.customers?.elements?.[0];
    const customerName =
      [c?.firstName, c?.lastName].filter(Boolean).join(" ").trim() ||
      undefined;

    return res.status(200).json({
      orderId,
      categories,
      customerName,
      rolledItems,
      bobaItems,
    });
  } catch (err) {
    console.error("[order/categories]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}
