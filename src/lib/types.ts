// Shared types between client and serverless API. Kept tiny on purpose —
// the wire shape is the contract; everything else is private.

export type Category = "rolled" | "boba";

/** Customer-submitted payload. POST /api/feedback accepts this. */
export interface FeedbackPayload {
  /** Clover order id if they came from the confirmation page. */
  orderId?: string;
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
}

/** Server response from GET /api/order/[orderId]/categories. */
export interface OrderCategoriesResponse {
  orderId: string;
  /** Categories detected in the order's line items. */
  categories: Category[];
  /** Customer display name from the Clover order, if available. */
  customerName?: string;
  /** Raw item names — used to pre-fill `flavorsTried` / `drinksTried`. */
  rolledItems: string[];
  bobaItems: string[];
}
