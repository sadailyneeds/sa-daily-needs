// src/utils/imagePlaceholder.js
// A tiny inline SVG grocery-bag placeholder used whenever a product's
// imageUrl is missing or fails to load (broken Cloudinary / Firebase /
// ibb link etc.). No network request needed - it's a data URI.
export const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
  <rect width="200" height="200" fill="#f5f5f0" rx="16"/>
  <g fill="none" stroke="#c9a227" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
    <path d="M60 80 L70 50 a10 10 0 0 1 20 0 M110 50 a10 10 0 0 1 20 0 L140 80"/>
    <rect x="55" y="80" width="90" height="80" rx="8"/>
  </g>
  <text x="100" y="178" font-family="Segoe UI, sans-serif" font-size="12" fill="#a5821a" text-anchor="middle">No Image</text>
</svg>`);

// onError handler you can spread onto any <img>: onError={handleImgError}
export const handleImgError = (e) => {
  if (e.target.src !== PLACEHOLDER_IMAGE) {
    e.target.onerror = null;
    e.target.src = PLACEHOLDER_IMAGE;
  }
};

// Basic sanity check for supported image URL sources before saving in Admin.
export const isLikelyValidImageUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  try {
    const u = new URL(url.trim());
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
};
