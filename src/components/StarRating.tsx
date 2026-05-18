// 1–5 tap-to-rate star control. Big targets, accessible, no third-party
// dep. Used by both Rolled and Boba forms.

export default function StarRating({
  value,
  onChange,
  size = "lg",
}: {
  value: number;
  onChange: (n: number) => void;
  size?: "md" | "lg";
}) {
  const dim = size === "lg" ? "w-10 h-10" : "w-7 h-7";
  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= value;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className={`${dim} rounded-xl flex items-center justify-center transition active:scale-90`}
          >
            <svg
              viewBox="0 0 24 24"
              className={`w-full h-full ${
                filled ? "text-rollo-pink" : "text-rollo-ink-line"
              }`}
              fill="currentColor"
            >
              <path d="M12 2.5l2.95 6 6.6.96-4.78 4.66 1.13 6.57L12 17.77 6.1 20.69l1.13-6.57L2.45 9.46l6.6-.96L12 2.5z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
