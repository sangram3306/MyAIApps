export type Role =
  | "none"
  | "comedian"
  | "thief"
  | "kid"
  | "engineer"
  | "cowboy"
  | "superhero"
  | "police"
  | "teacher";

export const roles: Array<{ label: string; value: Role }> = [
  { label: "None", value: "none" },
  { label: "Comedian", value: "comedian" },
  { label: "Thief", value: "thief" },
  { label: "Kid", value: "kid" },
  { label: "Engineer", value: "engineer" },
  { label: "Cowboy", value: "cowboy" },
  { label: "Superhero", value: "superhero" },
  { label: "Police", value: "police" },
  { label: "Teacher", value: "teacher" },
];
