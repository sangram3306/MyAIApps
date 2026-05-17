export const intentRules = {
  apology: ["sorry", "apologize", "my bad", "pardon me"],
  complaint: ["disappointed", "not happy", "why didn't", "ignored", "unhappy", "frustrated"],
  request: ["can you", "could you", "please", "would you"],
  follow_up: ["following up", "any update", "status", "checking in", "just circling back"],
  romantic: ["love", "miss you", "baby", "dear", "sweetheart"],
  professional: ["meeting", "deadline", "project", "client", "report", "invoice"],
  sales: ["pricing", "demo", "proposal", "trial", "purchase"],
  emotional_support: ["upset", "rough day", "here for you", "i'm here", "support"],
  casual: ["lol", "haha", "what's up", "hey", "cool"],
} as const;

export const intentOrder = [
  "apology",
  "complaint",
  "request",
  "follow_up",
  "romantic",
  "professional",
  "sales",
  "emotional_support",
  "casual",
] as const;

