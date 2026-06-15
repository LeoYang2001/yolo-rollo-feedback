import type { VercelRequest, VercelResponse } from "@vercel/node";
import qrcode from "qrcode";

/**
 * GET /api/qr?code=YR-XXXX-XXXX
 *
 * Renders a reward code as a QR PNG. The gift-card email links to this
 * instead of inlining a `data:` URI — Gmail (and several other clients)
 * block `data:` image URIs and show a broken image. A hosted https URL
 * renders everywhere. The /thanks page still uses the inline data URL,
 * which is fine in a browser.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = String(req.query.code ?? "").trim();
  // Reward codes are YR-XXXX-XXXX (custom) or digits (Clover) — keep it
  // tight so this can't be turned into an arbitrary-content QR renderer.
  if (!code || code.length > 64 || !/^[A-Za-z0-9_-]+$/.test(code)) {
    return res.status(400).send("Invalid code");
  }
  try {
    const png = await qrcode.toBuffer(code, {
      width: 480,
      margin: 1,
      color: { dark: "#2A1722", light: "#FFFFFF" },
    });
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.status(200).send(png);
  } catch (e) {
    console.error("[qr]", (e as Error).message);
    return res.status(500).send("QR generation failed");
  }
}
