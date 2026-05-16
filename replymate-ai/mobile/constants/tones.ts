export type Tone =
  | "none"
  | "polite"
  | "professional"
  | "funny"
  | "romantic"
  | "short"
  | "Hinglish"
  | "Hindi"
  | "English";

export const tones: Array<{ label: string; value: Tone }> = [
  { label: "None", value: "none" },
  { label: "Polite", value: "polite" },
  { label: "Professional", value: "professional" },
  { label: "Funny", value: "funny" },
  { label: "Romantic", value: "romantic" },
  { label: "Short", value: "short" },
  { label: "Hinglish", value: "Hinglish" },
  { label: "Hindi", value: "Hindi" },
  { label: "English", value: "English" },
];
