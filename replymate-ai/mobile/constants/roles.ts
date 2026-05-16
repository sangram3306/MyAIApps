export type Role =
  | "none"
  | "friend"
  | "best_friend"
  | "partner"
  | "customer_support"
  | "manager"
  | "professional_writer"
  | "sales_expert"
  | "marketing_expert"
  | "influencer"
  | "startup_founder"
  | "comedian"
  | "savage_friend"
  | "poet"
  | "teacher";

export const replyRoles: Array<{ label: string; value: Role }> = [
  { label: "None", value: "none" },
  { label: "Friend", value: "friend" },
  { label: "Best Friend", value: "best_friend" },
  { label: "Partner", value: "partner" },
  { label: "Customer Support", value: "customer_support" },
  { label: "Manager", value: "manager" },
  { label: "Teacher", value: "teacher" },
  { label: "Comedian", value: "comedian" },
  { label: "Savage Friend", value: "savage_friend" },
  { label: "Poet", value: "poet" },
];

export const rewriteRoles: Array<{ label: string; value: Role }> = [
  { label: "None", value: "none" },
  { label: "Professional Writer", value: "professional_writer" },
  { label: "Manager", value: "manager" },
  { label: "Customer Support", value: "customer_support" },
  { label: "Teacher", value: "teacher" },
  { label: "Sales Expert", value: "sales_expert" },
  { label: "Marketing Expert", value: "marketing_expert" },
  { label: "Influencer", value: "influencer" },
  { label: "Poet", value: "poet" },
  { label: "Startup Founder", value: "startup_founder" },
];

export const roles = replyRoles;
