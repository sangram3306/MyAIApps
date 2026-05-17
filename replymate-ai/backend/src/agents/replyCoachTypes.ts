export type CoachDraftInput = {
  message: string;
  relationshipContext: string;
  intent: string;
  emotion: string;
  riskLevel: "low" | "medium" | "high";
  styleRules: string[];
  avoidRules: string[];
  recommendedHandling: string;
};

