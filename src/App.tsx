import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type {
  BobaFeedback,
  Category,
  FeedbackPayload,
  RolledFeedback,
  SubmitResponse,
} from "./lib/types";
import CategoryPicker from "./components/CategoryPicker";
import RolledForm from "./components/RolledForm";
import BobaForm from "./components/BobaForm";
import StarRating from "./components/StarRating";

/**
 * Customer-facing review form — standalone (not wired to ordering).
 *
 * Flow: a "what did you have today?" picker first, then the matching
 * category question sets, then submit. On submit we mint a $1 reward
 * (if they leave an email) and, for high ratings, nudge them to leave a
 * Google review before showing their reward.
 */
export default function App() {
  const navigate = useNavigate();

  // `null` = still on the picker step; an array = which categories to ask.
  const [categories, setCategories] = useState<Category[] | null>(null);

  if (!categories) {
    return <CategoryPicker onContinue={(picked) => setCategories(picked)} />;
  }

  return (
    <FeedbackForm
      categories={categories}
      onSubmitted={(data, highRating) =>
        // High raters get routed through the Google-review prompt first;
        // everyone lands on /thanks (which shows the reward). The reward
        // outcome rides along in router state so the next page doesn't
        // need to re-call the API.
        navigate(highRating ? "/review" : "/thanks", {
          state: { reward: data.reward },
        })
      }
    />
  );
}

/* ─── Inner form ─────────────────────────────────────────────────── */

function FeedbackForm({
  categories,
  onSubmitted,
}: {
  categories: Category[];
  onSubmitted: (data: SubmitResponse, highRating: boolean) => void;
}) {
  const [rolled, setRolled] = useState<RolledFeedback>({
    flavorRating: 0,
    texture: "just-right",
    portion: "right",
    flavorsTried: "",
  });
  const [boba, setBoba] = useState<BobaFeedback>({
    flavorRating: 0,
    sweetness: "right",
    bobaTexture: "chewy",
    drinksTried: "",
  });
  const [flavorWish, setFlavorWish] = useState("");
  const [name, setName] = useState("");
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

  // Average of the flavor star ratings across the rated categories.
  // "Above 4.5" → with whole-star ratings this is effectively all-5s.
  // Drives the Google-review nudge (high raters only).
  function isHighRating(): boolean {
    const ratings: number[] = [];
    if (wantsRolled) ratings.push(rolled.flavorRating);
    if (wantsBoba) ratings.push(boba.flavorRating);
    if (!ratings.length) return false;
    const avg = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    return avg > 4.5;
  }

  async function submit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload: FeedbackPayload = {
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
      onSubmitted(data, isHighRating());
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
        {wantsRolled && <RolledForm value={rolled} onChange={setRolled} />}
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
                Drop your email and we'll show your $1-off code on the next
                screen and email you a copy. One per customer.
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
            We'll only use your email for your gift card — no marketing spam, no
            list-selling.
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
            {submitting ? "Sending…" : "Submit review"}
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

// Re-export StarRating to keep imports tidy for caller pages. Forms use
// it directly via ./components/StarRating.
export { StarRating };
