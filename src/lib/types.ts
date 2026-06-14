// Shared types between client and serverless API. Kept tiny on purpose —
// the wire shape is the contract; everything else is private.

export type Category = "rolled" | "boba";

/** Customer-submitted payload. POST /api/feedback accepts this. */
export interface FeedbackPayload {
  /** Which categories they're rating in this submission. */
  categories: Category[];

  /** Per-category answers. Only the categories listed above are read. */
  rolled?: RolledFeedback;
  boba?: BobaFeedback;

  /** Free-form "what flavor would you like us to add?" */
  flavorWish?: string;

  /** Optional contact for follow-up. */
  name?: string;
  email?: string;
}

export interface RolledFeedback {
  /** 1–5 star overall flavor rating. */
  flavorRating: number;
  /** Texture: "soft" | "just-right" | "hard". */
  texture: "soft" | "just-right" | "hard";
  /** Portion size: "small" | "right" | "large". */
  portion: "small" | "right" | "large";
  /** Optional list of flavors they tried (free text or pre-filled). */
  flavorsTried?: string;
  /** Optional mix-in/topping satisfaction (1–5). */
  mixinsRating?: number;
  /** Optional comment. */
  comment?: string;
}

export interface BobaFeedback {
  /** 1–5 star drink flavor rating. */
  flavorRating: number;
  /** Sweetness: "too-sweet" | "right" | "not-sweet". */
  sweetness: "too-sweet" | "right" | "not-sweet";
  /** Boba texture: "chewy" | "firm" | "mushy" | "no-boba". */
  bobaTexture: "chewy" | "firm" | "mushy" | "no-boba";
  /** Optional list of drinks they tried. */
  drinksTried?: string;
  /** Optional comment. */
  comment?: string;
}

/** Server response from POST /api/feedback. */
export interface SubmitResponse {
  ok: true;
  id: string;
  reward: RewardResponse;
}

/** Reward outcome — drives /thanks UI. */
export interface RewardResponse {
  issued: boolean;
  status:
    | "emailed"
    | "no-email"
    | "already-rewarded"
    | "daily-cap-reached"
    | "disabled"
    | "service-unavailable"
    | "email-failed"
    | "error";
  /** Masked card identifier (last 4) when issued. */
  cardLast4?: string;
  /**
   * Full reward code, shown on /thanks so the customer can redeem it
   * on screen (it's their own reward — same value we email them). For
   * a real Clover card this is the gift-card number; for the fallback
   * it's the `YR-XXXX-XXXX` code.
   */
  code?: string;
  /** QR PNG (data: URL) encoding `code`, for on-screen display. */
  qrDataUrl?: string;
  /** Gift-card security code — only set for real Clover cards. */
  securityCode?: string;
  /** How it was minted — drives the on-screen redemption copy. */
  source?: "clover" | "custom";
}
