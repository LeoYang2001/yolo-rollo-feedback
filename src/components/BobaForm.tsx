import type { BobaFeedback } from "../lib/types";
import StarRating from "./StarRating";

// Bubble tea / smoothie question set.

export default function BobaForm({
  value,
  onChange,
}: {
  value: BobaFeedback;
  onChange: (v: BobaFeedback) => void;
}) {
  function patch(p: Partial<BobaFeedback>) {
    onChange({ ...value, ...p });
  }
  return (
    <section className="rollo-card space-y-5">
      <header className="flex items-center gap-3">
        <div className="text-2xl">🧋</div>
        <h2 className="font-display text-xl font-bold text-rollo-ink">
          Bubble tea / smoothie
        </h2>
      </header>

      <div>
        <label className="rollo-label">How was the flavor? *</label>
        <StarRating
          value={value.flavorRating}
          onChange={(n) => patch({ flavorRating: n })}
        />
      </div>

      <div>
        <label className="rollo-label">Sweetness</label>
        <SegmentedControl
          options={[
            { value: "too-sweet", label: "Too sweet" },
            { value: "right", label: "Just right" },
            { value: "not-sweet", label: "Not sweet enough" },
          ]}
          value={value.sweetness}
          onChange={(v) =>
            patch({ sweetness: v as BobaFeedback["sweetness"] })
          }
        />
      </div>

      <div>
        <label className="rollo-label">Boba / popping pearls</label>
        <SegmentedControl
          options={[
            { value: "chewy", label: "Chewy" },
            { value: "firm", label: "Firm" },
            { value: "mushy", label: "Mushy" },
            { value: "no-boba", label: "Didn't have any" },
          ]}
          value={value.bobaTexture}
          onChange={(v) =>
            patch({ bobaTexture: v as BobaFeedback["bobaTexture"] })
          }
        />
      </div>

      <div>
        <label className="rollo-label">Which drink(s) did you try?</label>
        <input
          className="rollo-input"
          placeholder="e.g. Strawberry Bubble Tea, Mango Smoothie…"
          value={value.drinksTried ?? ""}
          onChange={(e) => patch({ drinksTried: e.target.value })}
        />
      </div>

      <div>
        <label className="rollo-label">Anything to tell us?</label>
        <textarea
          className="rollo-input min-h-[90px] resize-none"
          placeholder="What you loved, what we could do better…"
          value={value.comment ?? ""}
          onChange={(e) => patch({ comment: e.target.value })}
        />
      </div>
    </section>
  );
}

function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={`rounded-2xl py-2.5 text-sm font-semibold transition ${
              on
                ? "bg-rollo-pink text-white shadow-rollo-pink"
                : "bg-white text-rollo-ink border border-rollo-ink-line shadow-rollo-soft"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
