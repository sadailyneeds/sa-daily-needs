// src/utils/weightPricing.js
// Helpers for "Flexible Weight Selection" on loose grocery products
// (Rice, Dal, Atta, Sugar, Salt, Spices, Dry Fruits, Vegetables, Fruits, etc.)
// A loose product stores a Base Price Per Kg; every selling price, MRP,
// discount, cart/checkout/invoice amount is derived from the selected weight.

// Preset weight options shown in the selector, in grams.
export const WEIGHT_PRESETS_G = [
  100, 150, 200, 250, 300, 500, 750, 1000, 1250, 1500, 2000, 2500, 5000,
];

export const MIN_WEIGHT_G = 50; // smallest allowed custom weight
export const MAX_WEIGHT_G = 50000; // "Up to 50 kg"

// Round money to 2 decimals, then drop a trailing ".00" for clean display.
function roundMoney(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

// price/mrp per kg -> amount for the given weight in grams.
export function calcAmountForWeight(pricePerKg, grams) {
  const amount = (Number(pricePerKg) || 0) * (Number(grams) || 0) / 1000;
  return roundMoney(amount);
}

// 750 -> "750 g", 1000 -> "1 kg", 1250 -> "1.25 kg", 2000 -> "2 kg"
export function formatWeight(grams) {
  const g = Number(grams) || 0;
  if (g < 1000) return `${g} g`;
  const kg = g / 1000;
  const kgStr = Number.isInteger(kg) ? String(kg) : String(roundMoney(kg));
  return `${kgStr} kg`;
}

// Clean money display: whole rupees show without decimals, else 2 decimals.
export function formatMoney(value) {
  const v = roundMoney(value);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
}

export function isValidCustomWeight(grams) {
  const g = Number(grams);
  return Number.isFinite(g) && g >= MIN_WEIGHT_G && g <= MAX_WEIGHT_G;
}
