/**
 * Email delivery via Resend.
 *
 * Why Resend: tiny REST API (one HTTP call, no SDK needed), generous
 * free tier (3K emails/month), modern DKIM/SPF setup. Easy to swap
 * later — only the `sendEmail` function below talks to the provider,
 * so SendGrid / Postmark / SES can be dropped in by editing this file.
 *
 * Required env vars:
 *   RESEND_API_KEY    re_xxx token from resend.com
 *   FROM_EMAIL        verified sender (e.g. "Yolo Rollo <hi@yolorollo.com>")
 *
 * In dev/preview you can leave these blank and `sendEmail` will return
 * `{ ok: false, reason: "not-configured" }` instead of throwing — the
 * feedback path keeps working without the reward email.
 */

interface SendArgs {
  to: string;
  subject: string;
  html: string;
}

export interface SendResult {
  ok: boolean;
  /** Resend message id on success. */
  id?: string;
  /** Failure reason — short enough to log + surface to admin. */
  reason?: string;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.FROM_EMAIL;
  if (!key || !from) return { ok: false, reason: "not-configured" };

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: args.to,
        subject: args.subject,
        html: args.html,
      }),
    });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      return { ok: false, reason: `Resend ${r.status}: ${body.slice(0, 200)}` };
    }
    const data = (await r.json()) as { id?: string };
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/**
 * Renders the gift card email body. Inline styles only — most email
 * clients strip <style> blocks.
 *
 * Two variants of the body depending on whether this is a real Clover
 * gift card (`isCloverCard: true` — includes a security code, behaves
 * like an actual gift card at the POS) or a custom $1-off code
 * (`isCloverCard: false` — staff applies a manual discount).
 */
export function renderGiftCardEmail(args: {
  cardNumber: string;
  securityCode?: string;
  amountCents: number;
  customerName?: string;
  isCloverCard?: boolean;
}): { subject: string; html: string } {
  const amount = (args.amountCents / 100).toFixed(2);
  // Link the QR from a hosted endpoint — Gmail blocks inline `data:`
  // images, so an embedded data URL shows as a broken image. Override the
  // base host via EMAIL_ASSET_BASE_URL if the production domain changes.
  const assetBase =
    process.env.EMAIL_ASSET_BASE_URL ?? "https://yolo-rollo-feedback.vercel.app";
  const qrUrl = `${assetBase}/api/qr?code=${encodeURIComponent(args.cardNumber)}`;
  const hello = args.customerName ? `Hey ${escape(args.customerName)},` : "Hey,";
  const subject = `Your $${amount} Yolo Rollo gift card 🍓`;

  // Body copy + redemption instructions diverge based on card type.
  const intro = args.isCloverCard
    ? `Here's a $${amount} Yolo Rollo gift card. Show this QR at the counter on your next visit — staff will scan it like any gift card.`
    : `Here's $${amount} off your next visit — show this QR (or read the code) to staff at the counter.`;

  const valueLabel = args.isCloverCard
    ? `Balance: <strong style="color:#EC1E79;">$${amount}</strong> · Use once`
    : `Value: <strong style="color:#EC1E79;">$${amount} off</strong> · Use once · Expires in 60 days`;

  // SCV block for real Clover cards — needed at redemption alongside the
  // card number (it's the gift card's "security code").
  const scvBlock =
    args.isCloverCard && args.securityCode
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px solid rgba(42,23,34,0.10);">
           <div style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(42,23,34,0.40);">Security code</div>
           <div style="font-family:'Geist Mono',monospace;font-size:18px;letter-spacing:3px;color:#2A1722;font-weight:600;margin-top:4px;">${escape(args.securityCode)}</div>
         </div>`
      : "";

  const footer = args.isCloverCard
    ? `Can't scan? Read the card number + security code to staff and they'll punch it in.`
    : `Can't scan? Read the code aloud and staff will type it in.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FBE4ED;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#2A1722;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
      <div style="font-family:'Bagel Fat One',sans-serif;font-size:32px;color:#EC1E79;line-height:1;">yolo rollo</div>
      <h1 style="font-size:24px;font-weight:800;margin:24px 0 8px;">${hello}</h1>
      <p style="font-size:16px;line-height:1.5;color:rgba(42,23,34,0.62);margin:0 0 24px;">
        Thanks for the feedback. ${intro}
      </p>
      <div style="background:#FFFFFF;border-radius:22px;padding:24px;text-align:center;box-shadow:0 6px 18px -10px rgba(184,21,96,0.18);">
        <img src="${qrUrl}" alt="$${amount} reward QR" width="240" height="240" style="width:240px;height:240px;display:block;margin:0 auto;" />
        <div style="margin-top:16px;font-family:'Geist Mono',monospace;font-size:18px;letter-spacing:2px;color:#2A1722;font-weight:600;">
          ${escape(args.cardNumber)}
        </div>
        ${scvBlock}
        <div style="margin-top:12px;font-size:13px;color:rgba(42,23,34,0.40);">
          ${valueLabel}
        </div>
      </div>
      <p style="font-size:13px;line-height:1.5;color:rgba(42,23,34,0.40);margin-top:24px;text-align:center;">
        ${footer}
      </p>
    </div>
  </body>
</html>`;
  return { subject, html };
}

function escape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
