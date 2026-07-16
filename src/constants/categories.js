// src/constants/categories.js
// Fixed store category list (shown in category bar / category page).
// Product docs in Firestore just need a matching `category` string field —
// nothing else changes in the database.
export const STORE_CATEGORIES = [
  { key: "Rice", icon: "🍚" },
  { key: "Oil", icon: "🛢️" },
  { key: "Dal", icon: "🫘" },
  { key: "Atta", icon: "🌾" },
  { key: "Masala", icon: "🌶️" },
  { key: "Snacks", icon: "🍿" },
  { key: "Vegetables", icon: "🥦" },
  { key: "Fruits", icon: "🍎" },
  { key: "Cleaning", icon: "🧼" },
  { key: "Personal Care", icon: "🧴" },
  { key: "Bakery", icon: "🍞" },
  { key: "Frozen Foods", icon: "🧊" },
  { key: "Instant Foods", icon: "🍜" },
  { key: "Milk", icon: "🥛" },
  { key: "Beverages", icon: "🥤" },
];

export const CATEGORY_ICON_MAP = STORE_CATEGORIES.reduce((map, c) => {
  map[c.key.toLowerCase()] = c.icon;
  return map;
}, {});

export const getCategoryIcon = (name) =>
  CATEGORY_ICON_MAP[(name || "").toLowerCase()] || "🛒";
