import { useCallback, useEffect, useMemo, useState } from "react";
import type { Category } from "../lib/types";

/**
 * PIN-gated staff dashboard for browsing feedback.
 *
 * Lifecycle:
 *   1. /admin loads → if a token is in localStorage, jump straight to list.
 *   2. Otherwise show PIN entry → POST /api/admin/auth → store token.
 *   3. List view pulls /api/feedback with the current filters every 30s.
 *
 * Filters are local-state only (no URL sync — keep it simple).
 */

const TOKEN_KEY = "yolo-rollo-feedback-admin-token";

type CategoryFilter = "all" | Category;
type RatingFilter = "all" | "1-2" | "3" | "4-5";
type RangeFilter = "today" | "7d" | "30d" | "all";

interface Summary {
  total: number;
  rolled: { count: number; avg: number };
  boba: { count: number; avg: number };
}

interface RolledChunk {
  flavorRating: number;
  texture: "soft" | "just-right" | "hard";
  portion: "small" | "right" | "large";
  flavorsTried?: string;
  mixinsRating?: number;
  comment?: string;
}
interface BobaChunk {
  flavorRating: number;
  sweetness: "too-sweet" | "right" | "not-sweet";
  bobaTexture: "chewy" | "firm" | "mushy" | "no-boba";
  drinksTried?: string;
  comment?: string;
}
interface FeedbackRow {
  id: string;
  categories: Category[];
  rolled?: RolledChunk;
  boba?: BobaChunk;
  flavorWish?: string;
  name?: string;
  email?: string;
  createdAtMs: number;
}

export default function Admin() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );

  if (!token) {
    return (
      <PinGate
        onAuthed={(t) => {
          localStorage.setItem(TOKEN_KEY, t);
          setToken(t);
        }}
      />
    );
  }
  return (
    <Dashboard
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

/* ─── PIN entry ──────────────────────────────────────────────────── */

function PinGate({ onAuthed }: { onAuthed: (token: string) => void }) {
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!pin || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (!r.ok) {
        const t = await r.json().catch(() => ({}));
        throw new Error(t.error || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as { token: string };
      onAuthed(data.token);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-rollo-paper flex items-center justify-center px-5">
      <div className="rollo-card w-full max-w-sm space-y-5">
        <div>
          <div className="font-brand text-3xl text-rollo-pink leading-none">
            yolo rollo
          </div>
          <div className="text-rollo-ink-soft text-sm mt-1">
            Feedback dashboard
          </div>
        </div>
        <div>
          <label className="rollo-label">Staff PIN</label>
          <input
            className="rollo-input tracking-widest text-center text-xl"
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
          />
        </div>
        {err && (
          <div className="text-rollo-pink-deep text-sm bg-rollo-pink-soft rounded-xl px-3 py-2">
            {err}
          </div>
        )}
        <button
          className="rollo-btn-primary w-full"
          onClick={submit}
          disabled={!pin || busy}
        >
          {busy ? "Checking…" : "Enter"}
        </button>
      </div>
    </div>
  );
}

/* ─── Dashboard ──────────────────────────────────────────────────── */

function Dashboard({
  token,
  onLogout,
}: {
  token: string;
  onLogout: () => void;
}) {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [category, setCategory] = useState<CategoryFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [range, setRange] = useState<RangeFilter>("7d");

  const sinceMs = useMemo(() => {
    const now = Date.now();
    if (range === "today") return now - 24 * 3600 * 1000;
    if (range === "7d") return now - 7 * 24 * 3600 * 1000;
    if (range === "30d") return now - 30 * 24 * 3600 * 1000;
    return 0;
  }, [range]);

  const ratingBand = useMemo(() => {
    if (rating === "1-2") return { min: 1, max: 2 };
    if (rating === "3") return { min: 3, max: 3 };
    if (rating === "4-5") return { min: 4, max: 5 };
    return { min: 0, max: 5 };
  }, [rating]);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (category !== "all") params.set("category", category);
      if (sinceMs) params.set("since", String(sinceMs));
      params.set("minRating", String(ratingBand.min));
      params.set("maxRating", String(ratingBand.max));
      params.set("limit", "500");
      const r = await fetch(`/api/feedback/list?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 401) {
        onLogout();
        return;
      }
      if (!r.ok) {
        const t = await r.text();
        throw new Error(t || `HTTP ${r.status}`);
      }
      const data = (await r.json()) as {
        feedback: FeedbackRow[];
        summary: Summary;
      };
      setRows(data.feedback);
      setSummary(data.summary);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token, category, sinceMs, ratingBand, onLogout]);

  // Initial load + auto-refresh every 30s.
  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <div className="min-h-screen bg-rollo-paper">
      <header className="px-5 pt-6 pb-3 border-b border-rollo-ink-line bg-white/60">
        <div className="mx-auto max-w-5xl flex items-center justify-between gap-4">
          <div>
            <div className="font-brand text-2xl text-rollo-pink leading-none">
              yolo rollo
            </div>
            <div className="text-rollo-ink-soft text-xs">
              Feedback dashboard
            </div>
          </div>
          <button
            onClick={onLogout}
            className="text-sm text-rollo-ink-soft hover:text-rollo-pink"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-6 space-y-5">
        {summary && <SummaryRow summary={summary} />}
        <FilterRow
          category={category}
          onCategory={setCategory}
          rating={rating}
          onRating={setRating}
          range={range}
          onRange={setRange}
          refreshing={loading}
          onRefresh={load}
        />
        {err && (
          <div className="rounded-2xl bg-rollo-pink-soft text-rollo-pink-deep px-4 py-3 text-sm">
            {err}
          </div>
        )}
        {rows.length === 0 && !loading && (
          <div className="rollo-card text-center text-rollo-ink-soft py-12">
            No feedback matches these filters yet.
          </div>
        )}
        <div className="space-y-3">
          {rows.map((r) => (
            <FeedbackCard key={r.id} row={r} />
          ))}
        </div>
      </main>
    </div>
  );
}

/* ─── Sub-components ─────────────────────────────────────────────── */

function SummaryRow({ summary }: { summary: Summary }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      <StatCard label="Total responses" value={summary.total} />
      <StatCard
        label="Rolled avg"
        value={summary.rolled.avg ? `${summary.rolled.avg} ★` : "—"}
        sub={`${summary.rolled.count} rated`}
      />
      <StatCard
        label="Boba avg"
        value={summary.boba.avg ? `${summary.boba.avg} ★` : "—"}
        sub={`${summary.boba.count} rated`}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rollo-card">
      <div className="text-rollo-ink-soft text-xs uppercase tracking-wide">
        {label}
      </div>
      <div className="font-display text-3xl font-bold mt-1">{value}</div>
      {sub && <div className="text-rollo-ink-muted text-xs mt-1">{sub}</div>}
    </div>
  );
}

function FilterRow({
  category,
  onCategory,
  rating,
  onRating,
  range,
  onRange,
  refreshing,
  onRefresh,
}: {
  category: CategoryFilter;
  onCategory: (c: CategoryFilter) => void;
  rating: RatingFilter;
  onRating: (r: RatingFilter) => void;
  range: RangeFilter;
  onRange: (r: RangeFilter) => void;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Pills
        label="Category"
        value={category}
        onChange={(v) => onCategory(v as CategoryFilter)}
        options={[
          { value: "all", label: "All" },
          { value: "rolled", label: "Rolled" },
          { value: "boba", label: "Boba" },
        ]}
      />
      <Pills
        label="Rating"
        value={rating}
        onChange={(v) => onRating(v as RatingFilter)}
        options={[
          { value: "all", label: "Any" },
          { value: "1-2", label: "1–2 ★" },
          { value: "3", label: "3 ★" },
          { value: "4-5", label: "4–5 ★" },
        ]}
      />
      <Pills
        label="Range"
        value={range}
        onChange={(v) => onRange(v as RangeFilter)}
        options={[
          { value: "today", label: "Today" },
          { value: "7d", label: "7d" },
          { value: "30d", label: "30d" },
          { value: "all", label: "All" },
        ]}
      />
      <button
        onClick={onRefresh}
        className="ml-auto text-sm rounded-full bg-white border border-rollo-ink-line px-4 py-2 shadow-rollo-soft hover:border-rollo-pink"
      >
        {refreshing ? "Refreshing…" : "Refresh"}
      </button>
    </div>
  );
}

function Pills({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs uppercase tracking-wide text-rollo-ink-muted">
        {label}
      </span>
      <div className="flex items-center gap-1 bg-white rounded-full p-1 shadow-rollo-soft">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              onClick={() => onChange(o.value)}
              className={`px-3 py-1.5 text-sm rounded-full transition ${
                on
                  ? "bg-rollo-pink text-white"
                  : "text-rollo-ink-soft hover:text-rollo-ink"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FeedbackCard({ row }: { row: FeedbackRow }) {
  const ts = new Date(row.createdAtMs);
  return (
    <article className="rollo-card">
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="font-display font-bold text-rollo-ink">
            {row.name || "Anonymous"}
          </div>
          <div className="text-xs text-rollo-ink-muted">
            {ts.toLocaleString()}
            {row.email && ` · ${row.email}`}
          </div>
        </div>
        <div className="flex gap-1.5">
          {row.categories.map((c) => (
            <span
              key={c}
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                c === "rolled"
                  ? "bg-rollo-pink-soft text-rollo-pink-deep"
                  : "bg-rollo-butter text-rollo-rose-deep"
              }`}
            >
              {c === "rolled" ? "🍨 Rolled" : "🧋 Boba"}
            </span>
          ))}
        </div>
      </header>

      {row.rolled && (
        <Subsection title="Rolled ice cream">
          <Stars n={row.rolled.flavorRating} /> · {row.rolled.texture} ·{" "}
          {row.rolled.portion} portion
          {row.rolled.flavorsTried && (
            <div className="text-rollo-ink-soft mt-1">
              <span className="font-semibold">Flavors:</span>{" "}
              {row.rolled.flavorsTried}
            </div>
          )}
          {row.rolled.comment && (
            <Quote>{row.rolled.comment}</Quote>
          )}
        </Subsection>
      )}
      {row.boba && (
        <Subsection title="Boba / smoothie">
          <Stars n={row.boba.flavorRating} /> · {row.boba.sweetness} ·{" "}
          {row.boba.bobaTexture}
          {row.boba.drinksTried && (
            <div className="text-rollo-ink-soft mt-1">
              <span className="font-semibold">Drinks:</span>{" "}
              {row.boba.drinksTried}
            </div>
          )}
          {row.boba.comment && <Quote>{row.boba.comment}</Quote>}
        </Subsection>
      )}
      {row.flavorWish && (
        <Subsection title="Flavor wish">
          <span className="text-rollo-ink">{row.flavorWish}</span>
        </Subsection>
      )}
    </article>
  );
}

function Subsection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 pt-3 border-t border-rollo-ink-line first:mt-0 first:pt-0 first:border-0">
      <div className="text-xs font-semibold uppercase tracking-wide text-rollo-ink-muted mb-1.5">
        {title}
      </div>
      <div className="text-sm text-rollo-ink">{children}</div>
    </div>
  );
}

function Quote({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="mt-2 pl-3 border-l-2 border-rollo-pink-rose text-rollo-ink-soft italic">
      {children}
    </blockquote>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="text-rollo-pink font-semibold">
      {"★".repeat(n)}
      <span className="text-rollo-ink-line">{"★".repeat(5 - n)}</span>
    </span>
  );
}
