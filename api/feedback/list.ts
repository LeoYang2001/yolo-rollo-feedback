import type { VercelRequest, VercelResponse } from "@vercel/node";
import { firestore, type FeedbackDoc } from "../_firebase.js";
import { tokenFromRequest, verifyToken } from "../_session.js";

/**
 * GET /api/feedback?category=rolled&since=<unix-ms>&minRating=4&limit=200
 *
 * Admin-only — returns recent submissions newest-first, with optional
 * filters. All filters are applied client-side after a small Firestore
 * query so we never need a composite index (and the dataset is tiny —
 * a busy shop submits maybe 50/day).
 */

interface ResponseFeedback extends Omit<FeedbackDoc, "createdAt"> {
  id: string;
  createdAtMs: number;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (!verifyToken(tokenFromRequest(req))) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  res.setHeader("Cache-Control", "no-store");
  try {
    const limit = Math.min(
      500,
      Math.max(1, Number(req.query.limit ?? 200) || 200),
    );
    const category = String(req.query.category ?? "");
    const since = Number(req.query.since ?? 0) || 0;
    const minRating = Number(req.query.minRating ?? 0) || 0;
    const maxRating = Number(req.query.maxRating ?? 5) || 5;

    // newest-first read, capped. We sort/filter the small result set
    // in JS to avoid needing composite indexes on every filter combo.
    const snap = await firestore()
      .collection("feedback")
      .orderBy("createdAt", "desc")
      .limit(limit)
      .get();

    const tsToMs = (v: unknown): number => {
      if (
        v &&
        typeof v === "object" &&
        typeof (v as { toMillis?: () => number }).toMillis === "function"
      ) {
        return (v as { toMillis: () => number }).toMillis();
      }
      return 0;
    };

    const feedback: ResponseFeedback[] = snap.docs
      .map((d) => {
        const data = d.data() as FeedbackDoc;
        const createdAtMs = tsToMs(data.createdAt);
        return {
          id: d.id,
          ...data,
          createdAtMs,
        } as ResponseFeedback;
      })
      .filter((f) => {
        if (since && f.createdAtMs < since) return false;
        if (category === "rolled" && !f.categories?.includes("rolled"))
          return false;
        if (category === "boba" && !f.categories?.includes("boba"))
          return false;
        if (minRating > 0 || maxRating < 5) {
          // Use the best (max) rating across the categories present.
          const ratings: number[] = [];
          if (f.rolled?.flavorRating) ratings.push(f.rolled.flavorRating);
          if (f.boba?.flavorRating) ratings.push(f.boba.flavorRating);
          const best = ratings.length ? Math.max(...ratings) : 0;
          if (best < minRating || best > maxRating) return false;
        }
        return true;
      });

    // Quick aggregate stats for the dashboard header — computed across
    // the FILTERED set so the numbers match the visible list.
    const summary = summarize(feedback);

    return res.status(200).json({ feedback, summary });
  } catch (err) {
    console.error("[feedback/list]", err);
    return res.status(500).json({ error: (err as Error).message });
  }
}

function summarize(items: ResponseFeedback[]) {
  let rolledCount = 0;
  let rolledSum = 0;
  let bobaCount = 0;
  let bobaSum = 0;
  for (const f of items) {
    if (f.rolled?.flavorRating) {
      rolledCount++;
      rolledSum += f.rolled.flavorRating;
    }
    if (f.boba?.flavorRating) {
      bobaCount++;
      bobaSum += f.boba.flavorRating;
    }
  }
  return {
    total: items.length,
    rolled: {
      count: rolledCount,
      avg: rolledCount ? +(rolledSum / rolledCount).toFixed(2) : 0,
    },
    boba: {
      count: bobaCount,
      avg: bobaCount ? +(bobaSum / bobaCount).toFixed(2) : 0,
    },
  };
}
