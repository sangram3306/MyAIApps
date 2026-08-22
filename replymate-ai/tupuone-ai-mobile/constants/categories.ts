import Ionicons from "@expo/vector-icons/Ionicons";

export const baseCategories: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  accent: string;
}[] = [
  { label: "Food", icon: "restaurant-outline", accent: "#FFD166" },
  { label: "Groceries", icon: "basket-outline", accent: "#45F5C6" },
  { label: "Transport", icon: "car-outline", accent: "#7DD3FC" },
  { label: "Shopping", icon: "bag-outline", accent: "#F0ABFC" },
  { label: "Bills", icon: "receipt-outline", accent: "#FCA5A5" },
  { label: "Rent", icon: "home-outline", accent: "#C4B5FD" },
  { label: "Health", icon: "medkit-outline", accent: "#86EFAC" },
  { label: "Entertainment", icon: "game-controller-outline", accent: "#FDBA74" },
  { label: "Travel", icon: "airplane-outline", accent: "#93C5FD" },
  { label: "Education", icon: "school-outline", accent: "#A7F3D0" },
  { label: "Other", icon: "apps-outline", accent: "#CBD5E1" },
];
