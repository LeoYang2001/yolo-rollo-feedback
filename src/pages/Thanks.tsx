import { Link, useLocation } from "react-router-dom";
import type { RewardResponse } from "../lib/types";

/**
 * Thanks page — shows the customer's $1 reward on screen (code + QR)
 * when one was issued, or the right fallback copy (no email, dedupe,
 * cap, error). The reward result rides in via react-router state so
 * this page doesn't need to re-call the API.
 */

interface LocationState {
  reward?: RewardResponse;
}

export default function Thanks() {
  const loc = useLocation();
  const reward = (loc.state as LocationState | null)?.reward;

  const block = renderRewardBlock(reward);

  return (
    <div className="min-h-screen bg-rollo-paper flex flex-col items-center justify-center px-5 py-12 text-center">
      <div className="font-brand text-4xl text-rollo-pink leading-none">
        yolo rollo
      </div>
      <div className="text-6xl mt-8" aria-hidden>
        🍓
      </div>
      <h1 className="font-display text-3xl font-bold mt-6 text-rollo-ink">
        Thanks for the review!
      </h1>
      <p className="text-rollo-ink-soft mt-3 max-w-sm">
        We read every submission. Your notes go straight to the team working on
        the menu.
      </p>

      {block && <div className="mt-8 w-full max-w-sm">{block}</div>}

      <Link to="/" className="rollo-btn-secondary mt-8">
        Leave another review
      </Link>
    </div>
  );
}

function renderRewardBlock(reward?: RewardResponse) {
  if (!reward) return null;

  // Card was minted — show it on screen so they can redeem right away.
  if (
    (reward.status === "emailed" || reward.status === "email-failed") &&
    reward.code
  ) {
    return <IssuedCard reward={reward} emailed={reward.status === "emailed"} />;
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
          Your review still made it through — thank you!
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
          Add your email on your next review and we'll send one over.
        </div>
      </RewardCard>
    );
  }
  // service-unavailable / error / disabled / issued-without-code — keep
  // the message generic.
  return null;
}

/** On-screen gift card: QR + code + redemption copy. */
function IssuedCard({
  reward,
  emailed,
}: {
  reward: RewardResponse;
  emailed: boolean;
}) {
  const isClover = reward.source === "clover";
  return (
    <div className="bg-white rounded-rollo-card p-5 shadow-rollo-card text-center">
      <div className="text-rollo-pink-deep font-display font-bold text-lg">
        🎁 Your $1-off reward
      </div>

      {reward.qrDataUrl && (
        <img
          src={reward.qrDataUrl}
          alt="$1 reward QR code"
          className="w-44 h-44 mx-auto mt-4"
        />
      )}

      {reward.code && (
        <div className="mt-3 font-mono text-lg tracking-widest text-rollo-ink font-semibold">
          {reward.code}
        </div>
      )}

      {isClover && reward.securityCode && (
        <div className="mt-2 text-sm text-rollo-ink-soft">
          Security code:{" "}
          <span className="font-mono">{reward.securityCode}</span>
        </div>
      )}

      <div className="mt-4 text-sm text-rollo-ink-soft">
        {isClover
          ? "Show this QR at the counter on your next visit — staff scan it like any gift card."
          : "Show this QR (or read the code) to staff for $1 off your next visit."}
      </div>

      <div
        className={`mt-3 text-xs ${
          emailed ? "text-rollo-ink-muted" : "text-rollo-pink-deep font-semibold"
        }`}
      >
        {emailed
          ? "We also emailed you a copy."
          : "Heads up — we couldn't email a copy, so screenshot this so you don't lose it."}
      </div>
    </div>
  );
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
