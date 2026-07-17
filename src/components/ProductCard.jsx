// src/components/ProductCard.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { handleImgError } from "../utils/imagePlaceholder";
import {
  WEIGHT_PRESETS_G,
  MIN_WEIGHT_G,
  MAX_WEIGHT_G,
  calcAmountForWeight,
  formatWeight,
  formatMoney,
  isValidCustomWeight,
} from "../utils/weightPricing";
import "../styles/productCard.css";

const DEFAULT_WEIGHT_G = 250;

export default function ProductCard({ product, cart = [], cartQty = 0, onAdd, onIncrease, onDecrease }) {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [imgLoaded, setImgLoaded] = useState(false);

  // ── Loose product weight selection state ──────────────────────────────
  const isLoose = Boolean(product.isLoose);
  const [selectedWeight, setSelectedWeight] = useState(DEFAULT_WEIGHT_G);
  const [customMode, setCustomMode] = useState(false);
  const [customValue, setCustomValue] = useState("");

  const pricePerKg = Number(product.pricePerKg || product.price || 0);
  const mrpPerKg = Number(product.mrpPerKg || product.mrp || pricePerKg);
  const weightPrice = isLoose ? calcAmountForWeight(pricePerKg, selectedWeight) : product.price;
  const weightMrp = isLoose ? calcAmountForWeight(mrpPerKg, selectedWeight) : product.mrp;

  const discount =
    weightMrp && weightPrice ? Math.round(100 - (weightPrice / weightMrp) * 100) : 0;

  // For loose products, the cart line for the *currently selected weight*
  // (a customer can hold e.g. 250g and 500g of the same item as separate lines).
  const looseLineItem = isLoose
    ? cart.find((c) => c.id === product.id && c.weight === selectedWeight)
    : null;
  const looseQty = looseLineItem?.qty || 0;

  const handleWeightSelect = (e) => {
    const val = e.target.value;
    if (val === "custom") {
      setCustomMode(true);
      return;
    }
    setCustomMode(false);
    setSelectedWeight(Number(val));
  };

  const applyCustomWeight = () => {
    if (isValidCustomWeight(customValue)) {
      setSelectedWeight(Math.round(Number(customValue)));
    }
  };

  const buildLooseCartProduct = () => ({
    ...product,
    weight: selectedWeight,
    price: weightPrice,
    mrp: weightMrp,
  });

  const handleAdd = () => {
    if (isLoose) onAdd(buildLooseCartProduct());
    else onAdd(product);
  };

  const handleBuyNow = () => {
    const buyNowProduct = isLoose ? { ...buildLooseCartProduct(), qty: 1 } : { ...product, qty: 1 };
    navigate("/checkout", { state: { buyNowProduct } });
  };

  return (
    <div className="product-card">
      <div className="product-image-wrap">
        {!imgLoaded && <div className="img-skeleton" />}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-image"
          loading="lazy"
          decoding="async"
          style={{ display: imgLoaded ? "block" : "none" }}
          onLoad={() => setImgLoaded(true)}
          onError={(e) => {
            handleImgError(e);
            setImgLoaded(true);
          }}
        />
        {discount > 0 && <span className="discount-badge">{discount}% {t("off")}</span>}
      </div>

      <div className="product-info">
        <p className="product-name" title={product.name}>{product.name}</p>
        <p className="product-unit">
          {isLoose ? "⚖️ Sold by weight (per kg)" : (product.unit || "1 pc")}
        </p>

        {isLoose && (
          <div className="weight-selector">
            <select value={customMode ? "custom" : selectedWeight} onChange={handleWeightSelect}>
              {WEIGHT_PRESETS_G.map((g) => (
                <option key={g} value={g}>{formatWeight(g)}</option>
              ))}
              <option value="custom">Custom weight...</option>
            </select>
            {customMode && (
              <div className="custom-weight-row">
                <input
                  type="number"
                  min={MIN_WEIGHT_G}
                  max={MAX_WEIGHT_G}
                  step="1"
                  placeholder={`${MIN_WEIGHT_G}-${MAX_WEIGHT_G} g`}
                  value={customValue}
                  onChange={(e) => setCustomValue(e.target.value)}
                  onBlur={applyCustomWeight}
                />
                <span className="custom-weight-hint">g</span>
              </div>
            )}
            <p className="weight-selected-label">Weight: {formatWeight(selectedWeight)}</p>
          </div>
        )}

        <div className="price-row">
          <span className="price">₹{formatMoney(weightPrice)}</span>
          {weightMrp > weightPrice && <span className="mrp">₹{formatMoney(weightMrp)}</span>}
        </div>

        <div className="product-actions" style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "auto" }}>
          {isLoose ? (
            looseQty === 0 ? (
              <button className="add-btn" onClick={handleAdd} style={{ marginTop: 0 }}>
                {t("add")}
              </button>
            ) : (
              <div className="qty-control" style={{ marginTop: 0 }}>
                <button onClick={() => onDecrease(buildLooseCartProduct())}>−</button>
                <span>{looseQty}</span>
                <button onClick={() => onIncrease(buildLooseCartProduct())}>+</button>
              </div>
            )
          ) : cartQty === 0 ? (
            <button className="add-btn" onClick={handleAdd} style={{ marginTop: 0 }}>
              {t("add")}
            </button>
          ) : (
            <div className="qty-control" style={{ marginTop: 0 }}>
              <button onClick={() => onDecrease(product)}>−</button>
              <span>{cartQty}</span>
              <button onClick={() => onIncrease(product)}>+</button>
            </div>
          )}
          <button className="buy-now-btn" onClick={handleBuyNow}>
            ⚡ {t("buyNow")}
          </button>
        </div>
      </div>
    </div>
  );
}
