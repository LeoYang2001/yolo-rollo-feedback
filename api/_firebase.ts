/**
 * Firebase Admin singleton — same pattern as the ordering app, points
 * at the SAME project (so the `feedback` collection lives next to the
 * `tickets` collection from the KDS).
 *
 * Required env vars in Vercel (same values as ordering app):
 *   FIREBASE_PROJECT_ID
 *   FIREBASE_CLIENT_EMAIL
 *   FIREBASE_PRIVATE_KEY    (Vercel preserves the literal `\n` escapes
 *                            from the service-account JSON; we decode
 *                            them below.)
 */
import {
  cert,
  getApp,
  getApps,
  initializeApp,
  type App,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

function init(): App {
  if (getApps().length) return getApp();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  if (!projectId || !clientEmail || !rawKey) {
    throw new Error(
      "Firebase Admin env vars missing — need FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY",
    );
  }
  const privateKey = rawKey.replace(/\\n/g, "\n");
  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

let _db: Firestore | null = null;
export function firestore(): Firestore {
  if (_db) return _db;
  _db = getFirestore(init());
  // Strip undefined fields rather than crashing on optional values.
  _db.settings({ ignoreUndefinedProperties: true });
  return _db;
}

/** Shape we store under feedback/{autoId}. */
export interface FeedbackDoc {
  orderId?: string;
  categories: ("rolled" | "boba")[];
  rolled?: {
    flavorRating: number;
    texture: "soft" | "just-right" | "hard";
    portion: "small" | "right" | "large";
    flavorsTried?: string;
    mixinsRating?: number;
    comment?: string;
  };
  boba?: {
    flavorRating: number;
    sweetness: "too-sweet" | "right" | "not-sweet";
    bobaTexture: "chewy" | "firm" | "mushy" | "no-boba";
    drinksTried?: string;
    comment?: string;
  };
  flavorWish?: string;
  name?: string;
  email?: string;
  /** ServerTimestamp on write; Timestamp on read. */
  createdAt: unknown;
  /** Useful diagnostics for spam triage. */
  userAgent?: string;
  ip?: string;
}
