import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type {
  BobaFeedback,
  Category,
  FeedbackPayload,
  OrderCategoriesResponse,
  RolledFeedback,
  SubmitResponse,
} from "./lib/types";
import CategoryPicker from "./components/CategoryPicker";
import RolledForm from "./components/RolledForm";
import BobaForm from "./components/BobaForm";
import StarRating from "./components/StarRating";

/**
 * Customer-facing feedback form.
 *
 * Two entry paths:
 *   1. `/?orderId=XYZ` — came from the order-confirmation page. We hit
 *      `/api/order/{id}/categories` to figure out what they ordered and
 *      pre-select the matching question sets. Pre-fills item names so
 *      the customer doesn't have to retype.
 *   2. `/` (no orderId) — anonymous QR-code scan. They get a "what did
 *      you have today?" multiselect first, then category-specific
 *      question sets in sequence.
 */
export default function App() {
  const [params] = useSearchParams();
  const orderId = params.get("orderId") ?? undefined;
  const navigate = useNavigate();

  const [bootstrap, setBootstrap] = useState<OrderCategoriesResponse | null>(
    null,
  );
  const [bootstrapErr, setBootstrapErr] = useState<string | null>(null);
  const [bootstrapLoading, setBootstrapLoading] = useState(!!orderId);

  // If we have an orderId, fetch the order categories so we can skip
  // the "what did you have today?" step.
  useEffect(() => {
    if (!orderId) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/order/${encodeURIComponent(orderId)}/categories`,
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const data: OrderCategoriesResponse = await r.json();
        if (!cancelled) setBootstrap(data);
      } catch (e) {
        // Non-fatal — fall through to the manual picker. We still
        // record the orderId on the submission so we can join later.
        if (!cancelled) setBootstrapErr((e as Error).message);
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  // Once we know which categories apply, kick the form into "filling"
  // mode. `null` means we're still on the picker step.
  const [categories, setCategories] = useState<Category[] | null>(null);
  useEffect(() => {
    if (bootstrap && bootstrap.categories.length > 0) {
      setCategories(bootstrap.categories);
    }
  }, [bootstrap]);

  const initialRolledItems = useMemo(
    () => bootstrap?.rolledItems?.join(", ") ?? "",
    [bootstrap],
  );
  const initialBobaItems = useMemo(
    () => bootstrap?.bobaItems?.join(", ") ?? "",
    [bootstrap],
  );

  if (bootstrapLoading) {
    return <CenteredSpinner label="Looking up your order…" />;
  }

  if (!categories) {
    return (
      <CategoryPicker
        bootstrapErr={bootstrapErr}
        onContinue={(picked) => setCategories(picked)}
      />
    );
  }

  return (
    <FeedbackForm
      orderId={orderId}
      categories={categories}
      initialRolledItems={initialRolledItems}
      initialBobaItems={initialBobaItems}
      customerName={bootstrap?.customerName}
      onSubmitted={(data) =>
        // Pass the reward outcome through react-router state so /thanks
        // can render the right success/fallback message. Falls back
        // gracefully if some older path navigates without state.
        navigate("/thanks", { state: { reward: data.reward } })
      }
    />
  );
}

/* ─── Inner form ─────────────────────────────────────────────────── */

function FeedbackForm({
  orderId,
  categories,
  initialRolledItems,
  initialBobaItems,
  customerName,
  onSubmitted,
}: {
  orderId?: string;
  categories: Category[];
  initialRolledItems: string;
  initialBobaItems: string;
  customerName?: string;
  onSubmitted: (data: SubmitResponse) => void;
}) {
  const [rolled, setRolled] = useState<RolledFeedback>({
    flavorRating: 0,
    texture: "just-right",
    portion: "right",
    flavorsTried: initialRolledItems,
  });
  const [boba, setBoba] = useState<BobaFeedback>({
    flavorRating: 0,
    sweetness: "right",
    bobaTexture: "chewy",
    drinksTried: initialBobaItems,
  });
  const [flavorWish, setFlavorWish] = useState("");
  const [name, setName] = useState(customerName ?? "");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wantsRolled = categories.includes("rolled");
  const wantsBoba = categories.includes("boba");

  // Form is valid once every category they're rating has at least the
  // flavor rating set (everything else has defaults).
  const valid =
    (!wantsRolled || rolled.flavorRating > 0) &&
    (!wantsBoba || boba.flavorRating > 0);

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: FeedbackPayload = {
        orderId,
        categories,
        rolled: wantsRolled ? rolled : undefined,
        boba: wantsBoba ? boba : undefined,
        flavorWish: flavorWish.trim() || undefined,
        name: name.trim() || undefined,
        email: email.trim() || undefined,
      };
      const r = await fetch("/api/feedback/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as SubmitResponse;
      onSubmitted(data);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-rollo-paper">
      <Header />
      <main className="mx-auto max-w-xl px-5 pb-32 pt-4 space-y-5">
        {wantsRolled && (
          <RolledForm value={rolled} onChange={setRolled} />
        )}
        {wantsBoba && <BobaForm value={boba} onChange={setBoba} />}

        {/* "Anything else?" — generic block shown for every submission */}
        <section className="rollo-card space-y-4">
          <h2 className="font-display text-xl font-bold text-rollo-ink">
            One more thing
          </h2>
          <div>
            <label className="rollo-label">
              Any flavor you wish we'd add?
            </label>
            <input
              className="rollo-input"
              placeholder="e.g. Pistachio, Matcha Mochi…"
              value={flavorWish}
              onChange={(e) => setFlavorWish(e.target.value)}
            />
          </div>
        </section>

        {/* Reward block — visually distinct so customers don't skip it */}
        <section className="rounded-rollo-card p-5 bg-gradient-to-br from-rollo-pink-soft to-rollo-paper-warm border border-rollo-pink-rose/40 space-y-4">
          <div className="flex items-start gap-3">
            <div className="text-3xl" aria-hidden>
              🎁
            </div>
            <div>
              <h2 className="font-display text-xl font-bold text-rollo-ink leading-tight">
                Get $1 off your next visit
              </h2>
              <p className="text-rollo-ink-soft text-sm mt-1">
                Drop your email and we'll send a $1-off code you can use on
                your next visit. One per customer.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="rollo-label">Name (optional)</label>
              <input
                className="rollo-input"
                placeholder="Maria"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="rollo-label">Email</label>
              <input
                className="rollo-input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-rollo-ink-muted">
            We'll only email your gift card — no marketing spam, no list-selling.
          </p>
        </section>

        {error && (
          <div className="rounded-2xl bg-rollo-pink-soft text-rollo-pink-deep px-4 py-3 text-sm">
            Couldn't submit: {error}
          </div>
        )}
      </main>

      {/* Sticky submit bar — easier on mobile than a button at the bottom
       *  of a long scroll. */}
      <div className="fixed inset-x-0 bottom-0 bg-rollo-paper/90 backdrop-blur border-t border-rollo-ink-line px-5 py-3">
        <div className="mx-auto max-w-xl flex items-center justify-between gap-3">
          <SubmitHint
            wantsRolled={wantsRolled}
            wantsBoba={wantsBoba}
            rolledOk={rolled.flavorRating > 0}
            bobaOk={boba.flavorRating > 0}
          />
          <button
            className="rollo-btn-primary"
            onClick={submit}
            disabled={!valid || submitting}
          >
            {submitting ? "Sending…" : "Submit feedback"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Small bits ─────────────────────────────────────────────────── */

function Header() {
  return (
    <header className="px-5 pt-7 pb-3">
      <div className="mx-auto max-w-xl">
        <div className="font-brand text-3xl text-rollo-pink leading-none">
          yolo rollo
        </div>
        <div className="text-rollo-ink-soft text-sm mt-1">
          Quick taste check — takes ~30 seconds.
        </div>
      </div>
    </header>
  );
}

function SubmitHint({
  wantsRolled,
  wantsBoba,
  rolledOk,
  bobaOk,
}: {
  wantsRolled: boolean;
  wantsBoba: boolean;
  rolledOk: boolean;
  bobaOk: boolean;
}) {
  const missing: string[] = [];
  if (wantsRolled && !rolledOk) missing.push("rolled ice cream");
  if (wantsBoba && !bobaOk) missing.push("boba / smoothie");
  if (missing.length === 0) {
    return (
      <span className="text-rollo-green-deep text-sm font-semibold">
        Ready to send ✓
      </span>
    );
  }
  return (
    <span className="text-rollo-ink-muted text-xs">
      Rate {missing.join(" + ")} above
    </span>
  );
}

function CenteredSpinner({ label }: { label: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center text-rollo-ink-soft">
      <div className="space-y-3 text-center">
        <div className="w-8 h-8 mx-auto rounded-full border-2 border-rollo-pink border-t-transparent animate-spin" />
        <div className="text-sm">{label}</div>
      </div>
    </div>
  );
}

// Re-export StarRating to keep imports tidy for caller pages. Forms use
// it directly via ./components/StarRating.
export { StarRating };
