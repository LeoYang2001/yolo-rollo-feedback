/**
 * Tiny Clover REST helper — only what we need to read a single order
 * and figure out which categories its line items fall into.
 *
 * Required env vars (same as ordering app):
 *   CLOVER_API_BASE       e.g. https://apisandbox.dev.clover.com  or  https://api.clover.com
 *   CLOVER_MERCHANT_ID    your merchant id
 *   CLOVER_API_TOKEN      private REST token
 */

const BASE = process.env.CLOVER_API_BASE ?? "https://api.clover.com";
const MID = process.env.CLOVER_MERCHANT_ID ?? "";
const TOKEN = process.env.CLOVER_API_TOKEN ?? "";

export async function cloverRest<T>(path: string): Promise<T> {
  if (!MID || !TOKEN) {
    throw new Error(
      "Clover env vars missing — need CLOVER_MERCHANT_ID + CLOVER_API_TOKEN",
    );
  }
  const url = `${BASE}/v3/merchants/${MID}${path}`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  if (!r.ok) {
    const body = await r.text().catch(() => "");
    throw new Error(`Clover ${r.status} ${path} — ${body.slice(0, 200)}`);
  }
  return (await r.json()) as T;
}
