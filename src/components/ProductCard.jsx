// src/components/ProductCard.jsx
import { useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import "../styles/productCard.css";

export default function ProductCard({ product, cartQty = 0, onAdd, onIncrease, onDecrease }) {
  const { t } = useLanguage();
  const [imgLoaded, setImgLoaded] = useState(false);
  const discount =
    product.mrp && product.price ? Math.round(100 - (product.price / product.mrp) * 100) : 0;

  return (
    <div className="product-card">
      <div className="product-image-wrap">
        {!imgLoaded && <div className="img-skeleton" />}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="product-image"
          style={{ display: imgLoaded ? "block" : "none" }}
          onLoad={() => setImgLoaded(true)}
        />
        {discount > 0 && <span className="discount-badge">{discount}% {t("off")}</span>}
      </div>

      <div className="product-info">
        <p className="product-name" title={product.name}>{product.name}</p>
        <p className="product-unit">{product.unit || "1 pc"}</p>

        <div className="price-row">
          <span className="price">₹{product.price}</span>
          {product.mrp > product.price && <span className="mrp">₹{product.mrp}</span>}
        </div>

        {cartQty === 0 ? (
          <button className="add-btn" onClick={() => onAdd(product)}>
            {t("add")}
          </button>
        ) : (
          <div className="qty-control">
            <button onClick={() => onDecrease(product)}>−</button>
            <span>{cartQty}</span>
            <button onClick={() => onIncrease(product)}>+</button>
          </div>
        )}
      </div>
    </div>
  );
}
