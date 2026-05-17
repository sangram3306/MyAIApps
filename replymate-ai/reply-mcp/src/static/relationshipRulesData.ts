export const relationshipRulesData: Record<
  "Friend" | "Wife" | "Boss" | "Client" | "Customer" | "Parent" | "Sibling",
  {
    styleRules: string[];
    avoid: string[];
    recommendedFormality: "casual" | "balanced" | "formal";
  }
> = {
  Friend: {
    styleRules: ["Be warm and natural", "Use a relaxed tone", "Keep it conversational"],
    avoid: ["Sound robotic", "Over-polish the reply", "Be overly formal"],
    recommendedFormality: "casual",
  },
  Wife: {
    styleRules: ["Be affectionate and calm", "Show care and attention", "Keep the response sincere"],
    avoid: ["Sound cold", "Dismiss feelings", "Use harsh wording"],
    recommendedFormality: "balanced",
  },
  Boss: {
    styleRules: ["Be clear and professional", "Respect hierarchy", "Offer a direct next step"],
    avoid: ["Use slang", "Sound defensive", "Be overly casual"],
    recommendedFormality: "formal",
  },
  Client: {
    styleRules: ["Be polished and reassuring", "Stay solution-focused", "Keep the tone confident"],
    avoid: ["Sound too casual", "Overpromise", "Use emotional language"],
    recommendedFormality: "formal",
  },
  Customer: {
    styleRules: ["Be polite and helpful", "Acknowledge concerns", "Offer a clear resolution"],
    avoid: ["Argue", "Blame the customer", "Be impatient"],
    recommendedFormality: "formal",
  },
  Parent: {
    styleRules: ["Be respectful and caring", "Keep the tone gentle", "Show appreciation"],
    avoid: ["Sound dismissive", "Be abrupt", "Use sarcasm"],
    recommendedFormality: "balanced",
  },
  Sibling: {
    styleRules: ["Be relaxed and familiar", "Keep it honest", "Allow a playful tone if appropriate"],
    avoid: ["Sound cold", "Be overly formal", "Make it feel stiff"],
    recommendedFormality: "casual",
  },
};

