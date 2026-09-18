// Question definitions and shared types. All text sent to Jev and the LLM is built from here (identical for both).

export const CATEGORIES = [
  "reschedule",
  "cancel",
  "refund",
  "location",
  "pricing",
  "group_size",
  "late_arrival",
  "weather",
  "other",
] as const;

export type Category = (typeof CATEGORIES)[number];
export type Lang = "en" | "zh" | "ko" | "ja";

export type Case = {
  id: string;
  lang: Lang;
  text: string;
  /** Whether the case was made intentionally hard */
  hard: boolean;
  expected: {
    category: Category;
    urgency: "low" | "high";
    needsHuman: boolean;
  };
  /** For cases spanning 2 categories, labels judged as partially correct (reference metric only; primary metric is category) */
  alsoAcceptable?: Category[];
};

// ---- Question text (shared by both models) ----

export const CONTEXT =
  "You are triaging customer inquiries sent to a photo-shoot service for international tourists visiting Japan. " +
  "The state is one message from a customer.";

export const CATEGORY_CRITERIA: Record<Category, string> = {
  reschedule: "Wants to change the date or time of a booked shoot.",
  cancel: "Wants to cancel a booked shoot.",
  refund: "Asks about getting money back, refund status, or a refund amount.",
  location: "Asks about the shooting location, meeting point, or which areas are available.",
  pricing: "Asks about prices, plans, or what is included.",
  group_size: "Wants to change the number of people in the shoot.",
  late_arrival: "Being late or delayed on the day of the shoot (either the customer or the photographer).",
  weather: "Asks about or consults on weather conditions affecting a shoot.",
  other: "Does not fit any of the categories above, or the intent cannot be determined.",
};

export const URGENCY_LEVELS = [
  "Low: can be answered within a day or two.",
  "High: needs a reply within a few hours (the shoot is today or tomorrow, someone is waiting on site, the customer is very upset, or the customer has been kept waiting too long for something already promised).",
] as const;

export const QUESTIONS = {
  category: {
    type: "choice",
    instructions: `${CONTEXT} Which single category best fits this message?`,
    criteria: CATEGORY_CRITERIA,
  },
  urgency: {
    type: "score",
    instructions: `${CONTEXT} How urgent is this message?`,
    criteria: [...URGENCY_LEVELS],
  },
  needs_human: {
    type: "boolean",
    instructions:
      `${CONTEXT} Should a human staff member handle this, instead of a standard automated flow? ` +
      "True if it involves money back, a complaint or strong emotion, unclear intent or missing information, " +
      "multiple requests at once, something outside the photo-shoot booking business, or an exception to normal policy.",
  },
} as const;
