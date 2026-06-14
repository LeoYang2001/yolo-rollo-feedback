import { Link, useLocation, useNavigate } from "react-router-dom";
import type { RewardResponse } from "../lib/types";

/**
 * Google-review nudge — shown ONLY to high raters (avg > 4.5/5) right
 * after they submit, before /thanks. The reward outcome rides in via
 * router state and is passed straight through to /thanks so the gift
 * card is revealed as a follow-up once they've had the chance to leave
 * a public review.
 *
 * The destination is configured via VITE_GOOGLE_REVIEW_URL (build-time
 * env). If it isn't set we gracefully skip the CTA and just let them
 * continue to their reward.
 */

interface LocationState {
  reward?: RewardResponse;
}

const GOOGLE_REVIEW_URL = (
  import.meta.env.VITE_GOOGLE_REVIEW_URL as string | undefined
)?.trim();

export default function ReviewPrompt() {
  const loc = useLocation();
  const navigate = useNavigate();
  const reward = (loc.state as LocationState | null)?.reward;

  function goToReward() {
    // Preserve the reward state so /thanks can render the card without
    // re-calling the API. Replace so Back doesn't bounce here again.
    navigate("/thanks", { state: { reward }, replace: true });
  }

  const continueLabel = reward?.issued
    ? "Continue to your $1 reward →"
    : "Continue →";

  return (
    <div className="min-h-screen bg-rollo-paper flex flex-col items-center justify-center px-5 text-center">
      <div className="font-brand text-4xl text-rollo-pink leading-none">
        yolo rollo
      </div>

      <div className="text-6xl mt-8" aria-hidden>
        ⭐️
      </div>
      <h1 className="font-display text-3xl font-bold mt-6 text-rollo-ink">
        You loved it — would you tell Google?
      </h1>
      <p className="text-rollo-ink-soft mt-3 max-w-sm">
        Thanks for the glowing review! A quick rating on Google helps other
        dessert lovers find us. It takes about 20 seconds.
      </p>

      <div className="mt-8 w-full max-w-sm space-y-3">
        {GOOGLE_REVIEW_URL ? (
          <a
            href={GOOGLE_REVIEW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rollo-btn-primary w-full"
          >
            ⭐ Leave a Google review
          </a>
        ) : (
          <button className="rollo-btn-primary w-full" disabled>
            Google review link not set
          </button>
        )}

        <button className="rollo-btn-secondary w-full" onClick={goToReward}>
          {continueLabel}
        </button>
      </div>

      <p className="text-xs text-rollo-ink-muted mt-6 max-w-sm">
        Already left one? Just tap “{continueLabel.replace(/\s*→$/, "")}”.
      </p>

      <Link to="/" className="text-rollo-ink-muted text-sm mt-8 underline">
        Back to start
      </Link>
    </div>
  );
}
