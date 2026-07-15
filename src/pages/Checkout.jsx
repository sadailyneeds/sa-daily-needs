// src/pages/Checkout.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "../styles/checkout.css";

const DELIVERY_CHARGE = 20;
const RAZORPAY_KEY = "rzp_test_xxxxxxxxxxxx"; // 🔑 replace with your Razorpay key

export default function Checkout({ cart, clearCart }) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [address, setAddress] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod"); // "cod" | "online"
  const [placing, setPlacing] = useState(false);

  const itemsTotal = cart.reduce((sum, c) => sum + c.price * c.qty, 0);
  const totalAmount = itemsTotal + (itemsTotal > 0 ? DELIVERY_CHARGE : 0);

  // Writes the order AND a notification doc the admin dashboard listens to in realtime
  const createOrder = async (paymentStatus) => {
    const orderRef = await addDoc(collection(db, "orders"), {
      userId: user.uid,
      customerName: profile?.name || "Customer",
      customerPhone: user.phoneNumber,
      items: cart.map((c) => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
      itemsTotal,
      deliveryCharge: DELIVERY_CHARGE,
      totalAmount,
      address,
      paymentMethod,
      paymentStatus, // "pending" (COD) | "paid" (online)
      status: "placed", // placed -> confirmed -> out_for_delivery -> delivered
      createdAt: serverTimestamp(),
    });

    // 🔔 Notification for store owner (AdminNotifications page listens to this collection)
    const itemsSummary = cart.map((c) => `${c.name} x${c.qty}`).join(", ");
    await addDoc(collection(db, "notifications"), {
      type: "new_order",
      orderId: orderRef.id,
      message: `🛒 ${profile?.name || "Customer"} (${user.phoneNumber}) ஆர்டர் பண்ணிருக்காங்க: ${itemsSummary} — மொத்தம் ₹${totalAmount}`,
      address,
      paymentMethod,
      read: false,
      createdAt: serverTimestamp(),
    });

    return orderRef.id;
  };

  const handleCodOrder = async () => {
    if (!address.trim()) return alert(t("addressRequired"));
    setPlacing(true);
    try {
      await createOrder("pending");
      clearCart();
      navigate("/profile"); // order history is shown on profile page
    } catch (err) {
      console.error(err);
      alert(t("orderFailed"));
    } finally {
      setPlacing(false);
    }
  };

  // Razorpay Checkout flow (client-side).
  // ⚠️ For production, create the Razorpay order on a backend/Cloud Function
  // using your Key Secret, then verify payment signature server-side before
  // confirming the order. This client-only flow is for getting started fast.
  const handleOnlinePayment = () => {
    if (!address.trim()) return alert(t("addressRequired"));
    if (!window.Razorpay) return alert("Razorpay SDK load ஆகல. Internet check பண்ணுங்க.");

    const options = {
      key: RAZORPAY_KEY,
      amount: totalAmount * 100, // in paise
      currency: "INR",
      name: "SA Store Daily Needs",
      description: "Order Payment",
      // Shows GPay, PhonePe, Paytm, other UPI apps, and Cards inside
      // Razorpay's own checkout screen - no separate integration needed.
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: async function () {
        setPlacing(true);
        try {
          await createOrder("paid");
          clearCart();
          navigate("/profile");
        } finally {
          setPlacing(false);
        }
      },
      prefill: {
        name: profile?.name || "",
        contact: user?.phoneNumber || "",
      },
      theme: { color: "#c9a227" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <div className="checkout-page">
      <h1>{t("checkout")}</h1>

      <div className="checkout-section">
        <h3>{t("deliveryAddress")}</h3>
        <textarea
          rows={3}
          placeholder={t("addressPlaceholder")}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      <div className="checkout-section">
        <h3>{t("orderSummary")}</h3>
        {cart.map((c) => (
          <div key={c.id} className="summary-row">
            <span>{c.name} x{c.qty}</span>
            <span>₹{c.price * c.qty}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>{t("deliveryCharge")}</span>
          <span>₹{DELIVERY_CHARGE}</span>
        </div>
        <div className="summary-row total">
          <span>{t("total")}</span>
          <span>₹{totalAmount}</span>
        </div>
      </div>

      <div className="checkout-section">
        <h3>{t("paymentMethod")}</h3>
        <div className="payment-options">
          <label className={`payment-option ${paymentMethod === "cod" ? "selected" : ""}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            {t("cod")}
          </label>
          <label className={`payment-option ${paymentMethod === "online" ? "selected" : ""}`}>
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "online"}
              onChange={() => setPaymentMethod("online")}
            />
            {t("onlinePayment")}
          </label>
        </div>
      </div>

      <button
        className="place-order-btn"
        disabled={placing || cart.length === 0}
        onClick={paymentMethod === "cod" ? handleCodOrder : handleOnlinePayment}
      >
        {placing ? t("placingOrder") : `${t("placeOrder")} · ₹${totalAmount}`}
      </button>
    </div>
  );
}
