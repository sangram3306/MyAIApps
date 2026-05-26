export type Tone =
  | "none"
  | "clearer"
  | "shorter"
  | "polite"
  | "professional"
  | "friendly"
  | "casual"
  | "funny"
  | "snarky"
  | "confident"
  | "apologetic"
  | "romantic"
  | "sarcastic"
  | "excited"
  | "calm"
  | "formal"
  | "persuasive"
  | "simple_english"
  | "more_human"
  | "short"
  | "short_sweet"
  | "detailed";

export const replyTones: Array<{ label: string; value: Tone }> = [
  { label: "None", value: "none" },
  { label: "Polite", value: "polite" },
  { label: "Professional", value: "professional" },
  { label: "Friendly", value: "friendly" },
  { label: "Funny", value: "funny" },
  { label: "Snarky", value: "snarky" },
  { label: "Romantic", value: "romantic" },
  { label: "Apologetic", value: "apologetic" },
  { label: "Sarcastic", value: "sarcastic" },
  { label: "Confident", value: "confident" },
  { label: "Short", value: "short" },
];

export const rewriteStyles: Array<{ label: string; value: Tone }> = [
  { label: "Clearer", value: "clearer" },
  { label: "Shorter", value: "shorter" },
  { label: "Professional", value: "professional" },
  { label: "Friendly", value: "friendly" },
  { label: "Casual", value: "casual" },
  { label: "Snarky", value: "snarky" },
  { label: "Formal", value: "formal" },
  { label: "Confident", value: "confident" },
  { label: "Persuasive", value: "persuasive" },
  { label: "Simple English", value: "simple_english" },
  { label: "More Human", value: "more_human" },
];

export const tones = replyTones;
