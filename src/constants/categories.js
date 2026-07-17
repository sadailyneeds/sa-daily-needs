// src/constants/categories.js
// Complete store category list with all common Indian grocery categories.
// Products in Firestore use a matching `category` string field.
export const STORE_CATEGORIES = [
  { key: "Rice",              icon: "🍚" },
  { key: "Dal",               icon: "🫘" },
  { key: "Atta",              icon: "🌾" },
  { key: "Oil",               icon: "🛢️" },
  { key: "Sugar",             icon: "🍬" },
  { key: "Salt",              icon: "🧂" },
  { key: "Spices",            icon: "🌶️" },
  { key: "Vegetables",        icon: "🥦" },
  { key: "Fruits",            icon: "🍎" },
  { key: "Dairy",             icon: "🥛" },
  { key: "Bakery",            icon: "🍞" },
  { key: "Snacks",            icon: "🍿" },
  { key: "Chocolates",        icon: "🍫" },
  { key: "Biscuits",          icon: "🍪" },
  { key: "Tea",               icon: "🍵" },
  { key: "Coffee",            icon: "☕" },
  { key: "Soft Drinks",       icon: "🥤" },
  { key: "Juices",            icon: "🧃" },
  { key: "Frozen Foods",      icon: "🧊" },
  { key: "Instant Foods",     icon: "🍜" },
  { key: "Baby Care",         icon: "👶" },
  { key: "Personal Care",     icon: "🧴" },
  { key: "Cleaning",          icon: "🧼" },
  { key: "Household",         icon: "🏠" },
  { key: "Pet Care",          icon: "🐾" },
  { key: "Dry Fruits",        icon: "🥜" },
  { key: "Pickles",           icon: "🫙" },
  { key: "Noodles",           icon: "🍝" },
  { key: "Ready-to-Cook",     icon: "👨‍🍳" },
  { key: "Masala",            icon: "🫚" },
];

export const CATEGORY_ICON_MAP = STORE_CATEGORIES.reduce((map, c) => {
  map[c.key.toLowerCase()] = c.icon;
  return map;
}, {});

export const getCategoryIcon = (name) =>
  CATEGORY_ICON_MAP[(name || "").toLowerCase()] || "🛒";
