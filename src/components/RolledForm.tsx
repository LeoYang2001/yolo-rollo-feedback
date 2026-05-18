import type { RolledFeedback } from "../lib/types";
import StarRating from "./StarRating";

// Rolled ice cream question set. Compact, mobile-first. Defaults are
// "neutral" so an indifferent customer with thumb fatigue still leaves
// useful data without tapping every option.

export default function RolledForm({
  value,
  onChange,
}: {
  value: RolledFeedback;
  onChange: (v: RolledFeedback) => void;
}) {
  function patch(p: Partial<RolledFeedback>) {
    onChange({ ...value, ...p });
  }
  return (
    <section className="rollo-card space-y-5">
      <header className="flex items-center gap-3">
        <div className="text-2xl">🍨</div>
        <h2 className="font-display text-xl font-bold text-rollo-ink">
          Rolled ice cream
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
        <label className="rollo-label">Texture</label>
        <SegmentedControl
          options={[
            { value: "soft", label: "Too soft" },
            { value: "just-right", label: "Just right" },
            { value: "hard", label: "Too hard" },
          ]}
          value={value.texture}
          onChange={(v) => patch({ texture: v as RolledFeedback["texture"] })}
        />
      </div>

      <div>
        <label className="rollo-label">Portion size</label>
        <SegmentedControl
          options={[
            { value: "small", label: "Small" },
            { value: "right", label: "Right" },
            { value: "large", label: "Generous" },
          ]}
          value={value.portion}
          onChange={(v) => patch({ portion: v as RolledFeedback["portion"] })}
        />
      </div>

      <div>
        <label className="rollo-label">Mix-ins / toppings</label>
        <StarRating
          size="md"
          value={value.mixinsRating ?? 0}
          onChange={(n) => patch({ mixinsRating: n })}
        />
        <p className="text-xs text-rollo-ink-muted mt-2">
          Skip if you didn't add any.
        </p>
      </div>

      <div>
        <label className="rollo-label">Which flavor(s) did you try?</label>
        <input
          className="rollo-input"
          placeholder="e.g. Strawberry, Vanilla, Mango…"
          value={value.flavorsTried ?? ""}
          onChange={(e) => patch({ flavorsTried: e.target.value })}
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
    <div className="grid grid-cols-3 gap-2">
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
