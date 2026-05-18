import { useState } from "react";
import type { Category } from "../lib/types";

// First screen for anonymous QR users — "what did you have today?".
// Customer-context users skip this entirely.

const CHOICES: { key: Category; label: string; emoji: string; sub: string }[] =
  [
    {
      key: "rolled",
      label: "Rolled ice cream",
      emoji: "🍨",
      sub: "Strawberry, vanilla, coconut, signatures…",
    },
    {
      key: "boba",
      label: "Bubble tea / smoothie",
      emoji: "🧋",
      sub: "Milk tea, fruit tea, smoothies",
    },
  ];

export default function CategoryPicker({
  bootstrapErr,
  onContinue,
}: {
  bootstrapErr: string | null;
  onContinue: (categories: Category[]) => void;
}) {
  const [picked, setPicked] = useState<Set<Category>>(new Set());

  function toggle(k: Category) {
    const next = new Set(picked);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setPicked(next);
  }

  const canContinue = picked.size > 0;

  return (
    <div className="min-h-screen bg-rollo-paper flex flex-col">
      <header className="px-5 pt-12 pb-2">
        <div className="mx-auto max-w-xl">
          <div className="font-brand text-4xl text-rollo-pink leading-none">
            yolo rollo
          </div>
          <h1 className="font-display text-2xl font-bold mt-4">
            What did you have today?
          </h1>
          <p className="text-rollo-ink-soft mt-1">
            Pick everything you tried — we'll ask a few quick questions.
          </p>
          {bootstrapErr && (
            // Soft fallback note when the order lookup failed. Doesn't
            // block the form; we just lose the pre-fill convenience.
            <p className="mt-2 text-xs text-rollo-ink-muted">
              (We couldn't pre-fill from your order — no big deal.)
            </p>
          )}
        </div>
      </header>

      <main className="flex-1 px-5">
        <div className="mx-auto max-w-xl space-y-3 pt-4">
          {CHOICES.map((c) => {
            const on = picked.has(c.key);
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => toggle(c.key)}
                className={`w-full text-left rounded-rollo-card p-5 transition border-2 ${
                  on
                    ? "bg-white border-rollo-pink shadow-rollo-pink/30"
                    : "bg-white border-transparent shadow-rollo-card"
                }`}
              >
                <div className="flex items-start gap-4">
                  <div className="text-3xl">{c.emoji}</div>
                  <div className="flex-1">
                    <div className="font-display font-bold text-lg text-rollo-ink">
                      {c.label}
                    </div>
                    <div className="text-rollo-ink-soft text-sm">{c.sub}</div>
                  </div>
                  <Check on={on} />
                </div>
              </button>
            );
          })}
        </div>
      </main>

      <footer className="px-5 py-5 bg-rollo-paper/90 backdrop-blur border-t border-rollo-ink-line">
        <div className="mx-auto max-w-xl flex items-center justify-between">
          <span className="text-rollo-ink-muted text-sm">
            {picked.size === 0
              ? "Select at least one"
              : `${picked.size} selected`}
          </span>
          <button
            className="rollo-btn-primary"
            disabled={!canContinue}
            onClick={() => onContinue(Array.from(picked))}
          >
            Continue →
          </button>
        </div>
      </footer>
    </div>
  );
}

function Check({ on }: { on: boolean }) {
  return (
    <div
      className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition ${
        on
          ? "bg-rollo-pink border-rollo-pink text-white"
          : "bg-white border-rollo-ink-line text-transparent"
      }`}
    >
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
        <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
      </svg>
    </div>
  );
}
