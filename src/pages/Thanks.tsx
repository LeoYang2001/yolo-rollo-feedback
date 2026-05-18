import { Link, useLocation } from "react-router-dom";
import type { RewardResponse } from "../lib/types";

/**
 * Thanks page — shows different copy depending on whether the customer
 * got a gift card emailed, was skipped (no email, dedupe, cap), or hit
 * a backend error.
 *
 * The reward result rides in via react-router state so this page
 * doesn't need to re-call the API.
 */

interface LocationState {
  reward?: RewardResponse;
}

export default function Thanks() {
  const loc = useLocation();
  const reward = (loc.state as LocationState | null)?.reward;

  const block = renderRewardBlock(reward);

  return (
    <div className="min-h-screen bg-rollo-paper flex flex-col items-center justify-center px-5 text-center">
      <div className="font-brand text-4xl text-rollo-pink leading-none">
        yolo rollo
      </div>
      <div className="text-6xl mt-8" aria-hidden>
        🍓
      </div>
      <h1 className="font-display text-3xl font-bold mt-6 text-rollo-ink">
        Thanks for the feedback!
      </h1>
      <p className="text-rollo-ink-soft mt-3 max-w-sm">
        We read every submission. Your notes go straight to the team
        working on the menu.
      </p>

      {block && <div className="mt-8 w-full max-w-sm">{block}</div>}

      <Link to="/" className="rollo-btn-secondary mt-8">
        Leave another response
      </Link>
    </div>
  );
}

function renderRewardBlock(reward?: RewardResponse) {
  if (!reward) return null;
  if (reward.status === "emailed") {
    return (
      <RewardCard tone="success" emoji="🎁">
        <div className="font-bold text-rollo-pink-deep">
          Check your email — your $1 gift card is on the way.
        </div>
        {reward.cardLast4 && (
          <div className="text-rollo-ink-soft text-sm mt-1">
            Card ending in <span className="font-mono">{reward.cardLast4}</span>
          </div>
        )}
        <div className="text-rollo-ink-muted text-xs mt-2">
          If you don't see it in 5 min, check spam.
        </div>
      </RewardCard>
    );
  }
  if (reward.status === "email-failed") {
    return (
      <RewardCard tone="warn" emoji="⚠️">
        <div className="font-bold text-rollo-ink">
          Your $1 card is ready but the email didn't go through.
        </div>
        <div className="text-rollo-ink-soft text-sm mt-1">
          Show this to staff and we'll look it up:
          {reward.cardLast4 && (
            <> card ending in <span className="font-mono">{reward.cardLast4}</span></>
          )}
        </div>
      </RewardCard>
    );
  }
  if (reward.status === "already-rewarded") {
    return (
      <RewardCard tone="info" emoji="💜">
        <div className="font-bold">You've already claimed your $1 thank-you.</div>
        <div className="text-rollo-ink-soft text-sm mt-1">
          One per customer every 30 days. Thanks for coming back!
        </div>
      </RewardCard>
    );
  }
  if (reward.status === "daily-cap-reached") {
    return (
      <RewardCard tone="info" emoji="🙏">
        <div className="font-bold">We've maxed out today's giveaways.</div>
        <div className="text-rollo-ink-soft text-sm mt-1">
          Your feedback still made it through — thank you!
        </div>
      </RewardCard>
    );
  }
  if (reward.status === "no-email") {
    return (
      <RewardCard tone="info" emoji="📧">
        <div className="font-bold text-rollo-ink">
          Want a $1 gift card next time?
        </div>
        <div className="text-rollo-ink-soft text-sm mt-1">
          Drop your email on your next submission and we'll send one over.
        </div>
      </RewardCard>
    );
  }
  // service-unavailable / error / disabled — keep the message generic
  return null;
}

function RewardCard({
  tone,
  emoji,
  children,
}: {
  tone: "success" | "warn" | "info";
  emoji: string;
  children: React.ReactNode;
}) {
  const bg =
    tone === "success"
      ? "bg-white"
      : tone === "warn"
        ? "bg-rollo-butter/40"
        : "bg-white";
  return (
    <div
      className={`${bg} rounded-rollo-card p-5 shadow-rollo-card text-left flex items-start gap-3`}
    >
      <div className="text-2xl shrink-0" aria-hidden>
        {emoji}
      </div>
      <div className="flex-1 text-rollo-ink">{children}</div>
    </div>
  );
}
