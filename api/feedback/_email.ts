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
 */
export function renderGiftCardEmail(args: {
  cardNumber: string;
  amountCents: number;
  qrDataUrl: string;
  customerName?: string;
}): { subject: string; html: string } {
  const amount = (args.amountCents / 100).toFixed(2);
  const hello = args.customerName ? `Hey ${escape(args.customerName)},` : "Hey,";
  const subject = `Your $${amount} Yolo Rollo thank-you 🍓`;
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#FBE4ED;font-family:'Plus Jakarta Sans',system-ui,sans-serif;color:#2A1722;">
    <div style="max-width:480px;margin:0 auto;padding:32px 20px;">
      <div style="font-family:'Bagel Fat One',sans-serif;font-size:32px;color:#EC1E79;line-height:1;">yolo rollo</div>
      <h1 style="font-size:24px;font-weight:800;margin:24px 0 8px;">${hello}</h1>
      <p style="font-size:16px;line-height:1.5;color:rgba(42,23,34,0.62);margin:0 0 24px;">
        Thanks for the feedback. Here's a $${amount} gift card on us — show this QR at the counter on your next visit.
      </p>
      <div style="background:#FFFFFF;border-radius:22px;padding:24px;text-align:center;box-shadow:0 6px 18px -10px rgba(184,21,96,0.18);">
        <img src="${args.qrDataUrl}" alt="Gift card QR" style="width:240px;height:240px;display:block;margin:0 auto;" />
        <div style="margin-top:16px;font-family:'Geist Mono',monospace;font-size:14px;letter-spacing:2px;color:rgba(42,23,34,0.62);">
          ${escape(args.cardNumber)}
        </div>
        <div style="margin-top:8px;font-size:13px;color:rgba(42,23,34,0.40);">
          Value: <strong style="color:#EC1E79;">$${amount}</strong> · Use once
        </div>
      </div>
      <p style="font-size:13px;line-height:1.5;color:rgba(42,23,34,0.40);margin-top:24px;text-align:center;">
        Can't scan? Show the card number to staff and we'll punch it in manually.
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
