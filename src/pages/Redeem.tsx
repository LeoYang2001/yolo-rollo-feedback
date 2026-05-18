import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

/**
 * Staff-side QR scanner.
 *
 * Lifecycle:
 *   1. PIN gate (reuses /admin session token from localStorage).
 *   2. Tap "Start scanning" → request camera permission → start the
 *      html5-qrcode loop on the rear camera.
 *   3. On successful decode, POST /api/redeem/lookup with the card
 *      number. Show the result (issued-to, amount, repeat-scan warning).
 *   4. Tap "Scan another" to reset and continue the queue.
 *
 * We DON'T redeem the card here — Clover tracks gift card balance.
 * This page just verifies the QR is legit and shows the number for
 * staff to enter at the Clover POS.
 */

const TOKEN_KEY = "yolo-rollo-feedback-admin-token";
const SCANNER_ELEMENT_ID = "redeem-scanner";

interface LookupResult {
  cardNumber: string;
  amountCents: number;
  email?: string;
  issuedAtMs?: number;
  scanCount: number;
  previouslyScanned: boolean;
}

export default function Redeem() {
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
    <Scanner
      token={token}
      onAuthExpired={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }}
    />
  );
}

/* ─── Scanner UI ─────────────────────────────────────────────────── */

function Scanner({
  token,
  onAuthExpired,
}: {
  token: string;
  onAuthExpired: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<LookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Look up the decoded card number via the API. Runs after a
  // successful camera decode OR if the user types a code manually.
  const lookup = useCallback(
    async (cardNumber: string) => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/redeem/lookup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cardNumber }),
        });
        if (r.status === 401) {
          onAuthExpired();
          return;
        }
        if (r.status === 404) {
          setResult(null);
          setError("No reward record found for this code. Don't honor it.");
          return;
        }
        if (!r.ok) {
          const t = (await r.json().catch(() => ({}))) as { error?: string };
          throw new Error(t.error || `HTTP ${r.status}`);
        }
        const data = (await r.json()) as LookupResult;
        setResult(data);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [token, onAuthExpired],
  );

  // Bootstrap the camera scanner. Tries the back camera first; falls
  // back to whatever the browser picks.
  const startScanning = useCallback(async () => {
    setError(null);
    setResult(null);
    if (scannerRef.current) {
      // re-entrant — stop the existing instance first
      try {
        await scannerRef.current.stop();
      } catch {
        /* ignore */
      }
      scannerRef.current = null;
    }
    const html5 = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
    scannerRef.current = html5;
    try {
      await html5.start(
        { facingMode: "environment" },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 },
          aspectRatio: 1,
        },
        async (decodedText) => {
          // Stop the camera immediately so we don't double-scan the
          // same QR while the lookup is in flight.
          try {
            await html5.stop();
          } catch {
            /* ignore */
          }
          setScanning(false);
          await lookup(decodedText.trim());
        },
        () => {
          // per-frame "no QR yet" callback — intentionally noop
        },
      );
      setScanning(true);
    } catch (e) {
      setError(
        `Camera unavailable: ${(e as Error).message}. Use the manual entry below.`,
      );
    }
  }, [lookup]);

  // Clean up the camera stream when the component unmounts.
  useEffect(() => {
    return () => {
      scannerRef.current?.stop().catch(() => undefined);
      scannerRef.current = null;
    };
  }, []);

  const reset = () => {
    setResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-rollo-paper">
      <header className="px-5 pt-6 pb-3 bg-white/60 border-b border-rollo-ink-line">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <div>
            <div className="font-brand text-2xl text-rollo-pink leading-none">
              yolo rollo
            </div>
            <div className="text-rollo-ink-soft text-xs">
              Gift card redemption
            </div>
          </div>
          <button
            onClick={onAuthExpired}
            className="text-xs text-rollo-ink-soft hover:text-rollo-pink"
          >
            Log out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-5 py-5 space-y-4">
        {/* Scanner viewport — html5-qrcode injects video here */}
        <div className="rollo-card overflow-hidden">
          <div
            id={SCANNER_ELEMENT_ID}
            className={`w-full bg-black rounded-2xl ${
              scanning ? "aspect-square" : "h-0"
            }`}
          />
          {!scanning && !result && (
            <div className="text-center py-8">
              <div className="text-5xl mb-3" aria-hidden>
                📷
              </div>
              <p className="text-rollo-ink-soft text-sm mb-4">
                Point the camera at the customer's gift-card QR.
              </p>
              <button
                onClick={startScanning}
                className="rollo-btn-primary w-full"
                disabled={busy}
              >
                Start scanning
              </button>
            </div>
          )}
        </div>

        {/* Manual entry — useful when the QR won't scan (bright sun,
            cracked screen, low brightness). */}
        {!scanning && (
          <ManualEntry busy={busy} onSubmit={lookup} />
        )}

        {/* Result panel */}
        {error && (
          <div className="rounded-2xl bg-rollo-pink-soft text-rollo-pink-deep px-4 py-3 text-sm">
            {error}
          </div>
        )}
        {result && <ResultCard result={result} onScanAnother={() => {
          reset();
          startScanning();
        }} />}
      </main>
    </div>
  );
}

function ManualEntry({
  busy,
  onSubmit,
}: {
  busy: boolean;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");
  return (
    <details className="rollo-card">
      <summary className="cursor-pointer font-semibold text-rollo-ink-soft text-sm select-none">
        Type the card number instead
      </summary>
      <div className="mt-4 flex gap-2">
        <input
          className="rollo-input flex-1 font-mono"
          placeholder="e.g. 6394 2138 5901 2345"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />
        <button
          className="rollo-btn-primary"
          disabled={busy || !code.trim()}
          onClick={() => onSubmit(code.trim())}
        >
          {busy ? "…" : "Check"}
        </button>
      </div>
    </details>
  );
}

function ResultCard({
  result,
  onScanAnother,
}: {
  result: LookupResult;
  onScanAnother: () => void;
}) {
  const amount = (result.amountCents / 100).toFixed(2);
  const issued = result.issuedAtMs
    ? new Date(result.issuedAtMs).toLocaleString()
    : "—";
  return (
    <div className="rounded-rollo-card bg-white shadow-rollo-card p-5 space-y-4">
      {result.previouslyScanned ? (
        <div className="rounded-2xl bg-rollo-butter/50 px-3 py-2 text-sm text-rollo-rose-deep">
          ⚠️ Already scanned {result.scanCount - 1} time
          {result.scanCount - 1 === 1 ? "" : "s"}. Verify it hasn't been
          redeemed before applying.
        </div>
      ) : (
        <div className="rounded-2xl bg-rollo-pink-soft px-3 py-2 text-sm text-rollo-pink-deep font-semibold">
          ✓ Valid reward — first scan
        </div>
      )}
      <div>
        <div className="text-xs uppercase tracking-wide text-rollo-ink-muted">
          Enter this card number at the Clover POS
        </div>
        <div className="font-mono text-2xl font-bold text-rollo-ink mt-2 tracking-wider break-all">
          {result.cardNumber}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-rollo-ink-muted text-xs">Value</div>
          <div className="font-semibold text-rollo-pink-deep">${amount}</div>
        </div>
        <div>
          <div className="text-rollo-ink-muted text-xs">Issued</div>
          <div className="text-rollo-ink-soft">{issued}</div>
        </div>
      </div>
      {result.email && (
        <div className="text-xs text-rollo-ink-muted">
          Issued to <span className="font-mono">{result.email}</span>
        </div>
      )}
      <button
        onClick={onScanAnother}
        className="rollo-btn-secondary w-full mt-2"
      >
        Scan another
      </button>
    </div>
  );
}

/* ─── PIN entry (mirror of /admin) ───────────────────────────────── */

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
        const t = (await r.json().catch(() => ({}))) as { error?: string };
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
            Gift card redemption
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
