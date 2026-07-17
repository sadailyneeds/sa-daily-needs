// src/pages/Cart.jsx
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { handleImgError } from "../utils/imagePlaceholder";
import { formatWeight, formatMoney } from "../utils/weightPricing";
import "../styles/profile.css";

const DELIVERY_CHARGE = 10;

export default function Cart({ cart, increaseQty, decreaseQty }) {
  const { t } = useLanguage();
  const navigate = useNavigate();

  const itemsTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const totalAmount = itemsTotal + (itemsTotal > 0 ? DELIVERY_CHARGE : 0);

  if (cart.length === 0) {
    return (
      <div className="cart-page">
        <div className="empty-state">
          <p>🛒 உங்க Cart காலியா இருக்கு</p>
          <span>Products சேர்க்க Home page-க்கு போங்க</span>
        </div>
        <button className="continue-shopping-btn" onClick={() => navigate("/")}>
          🏠 Shopping தொடருங்க
        </button>
      </div>
    );
  }

  return (
    <div className="cart-page">
      <h1>🛒 My Cart</h1>

      <div className="cart-items">
        {cart.map((item) => (
          <div key={item.weight ? `${item.id}-${item.weight}` : item.id} className="cart-item">
            <img
              src={item.imageUrl}
              alt={item.name}
              className="cart-item-img"
              loading="lazy"
              decoding="async"
              onError={handleImgError}
            />
            <div className="cart-item-info">
              <p className="cart-item-name">{item.name}</p>
              {item.weight ? (
                <p className="cart-item-unit">Weight: {formatWeight(item.weight)}</p>
              ) : (
                <p className="cart-item-unit">{item.unit}</p>
              )}
              <p className="cart-item-price">₹{formatMoney(item.price)} x {item.qty} = ₹{formatMoney(item.price * item.qty)}</p>
            </div>
            <div className="qty-control">
              <button onClick={() => decreaseQty(item)}>−</button>
              <span>{item.qty}</span>
              <button onClick={() => increaseQty(item)}>+</button>
            </div>
          </div>
        ))}
      </div>

      <div className="cart-summary">
        <div className="summary-row">
          <span>Items Total</span>
          <span>₹{formatMoney(itemsTotal)}</span>
        </div>
        <div className="summary-row">
          <span>{t("deliveryCharge")}</span>
          <span>₹{DELIVERY_CHARGE}</span>
        </div>
        <div className="summary-row total">
          <span>{t("total")}</span>
          <span>₹{formatMoney(totalAmount)}</span>
        </div>
      </div>

      <button className="checkout-btn" onClick={() => navigate("/checkout")}>
        {t("checkout")} · ₹{formatMoney(totalAmount)}
      </button>
    </div>
  );
}
