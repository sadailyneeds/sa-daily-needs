// src/pages/Checkout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { addDoc, collection, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "../styles/checkout.css";

const RAZORPAY_KEY = "rzp_test_TDkLU1fQtiUItg"; // 🔑 replace with your Razorpay key

export default function Checkout({ cart, clearCart }) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // Single product checkout check
  const buyNowProduct = routerLocation.state?.buyNowProduct;
  const checkoutItems = buyNowProduct ? [buyNowProduct] : cart;

  // Structured address states
  const [houseNumber, setHouseNumber] = useState("");
  const [street, setStreet] = useState("");
  const [village, setVillage] = useState("");
  const [district, setDistrict] = useState("");
  const [pincode, setPincode] = useState("");
  const [mobileNumber, setMobileNumber] = useState(
    profile?.phone?.replace("+91", "") || user?.phoneNumber?.replace("+91", "") || ""
  );

  const [paymentMethod, setPaymentMethod] = useState("cod"); // "cod" | "online"
  const [placing, setPlacing] = useState(false);
  const [onlineOrderCount, setOnlineOrderCount] = useState(0);

  // Live Location states
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Checking location permission...");

  // Geolocation trigger on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setLocationStatus("📍 Location shared successfully");
        },
        (err) => {
          console.error("Location error:", err);
          setLocationStatus("⚠️ Location access denied. Order can still be placed.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus("❌ Geolocation not supported by browser.");
    }
  }, []);

  // Fetch count of previous successful online orders (not cancelled)
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const userOrders = snap.docs.map((doc) => doc.data());
      const count = userOrders.filter(
        (o) => o.paymentMethod === "online" && o.status !== "cancelled"
      ).length;
      setOnlineOrderCount(count);
    });
    return unsub;
  }, [user]);

  const itemsTotal = checkoutItems.reduce((sum, c) => sum + c.price * c.qty, 0);

  // Free delivery logic: first 5 successful online orders are free delivery.
  const isFreeDelivery = paymentMethod === "online" && onlineOrderCount < 5;
  const deliveryCharge = itemsTotal > 0 ? (isFreeDelivery ? 0 : 20) : 0;
  const totalAmount = itemsTotal + deliveryCharge;

  // Address validation
  const validateAddress = () => {
    if (!houseNumber.trim()) return "House Number / Door No is required.";
    if (!street.trim()) return "Street name is required.";
    if (!village.trim()) return "Village / City is required.";
    if (!district.trim()) return "District is required.";
    if (!pincode.trim()) return "Pincode is required.";
    if (!/^\d{6}$/.test(pincode.trim())) return "Please enter a valid 6-digit Pincode.";
    if (!mobileNumber.trim()) return "Mobile Number is required.";
    if (!/^\d{10}$/.test(mobileNumber.trim().replace(/\D/g, ""))) {
      return "Please enter a valid 10-digit Mobile Number.";
    }
    return null;
  };

  const createOrder = async (paymentStatus) => {
    const formattedAddress = `${houseNumber.trim()}, ${street.trim()}, ${village.trim()}, ${district.trim()} - ${pincode.trim()}`;

    const orderRef = await addDoc(collection(db, "orders"), {
      userId: user.uid,
      customerName: profile?.name || "Customer",
      customerPhone: `+91${mobileNumber.trim().replace(/\D/g, "")}`,
      items: checkoutItems.map((c) => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
      itemsTotal,
      deliveryCharge,
      totalAmount,
      address: {
        houseNumber: houseNumber.trim(),
        street: street.trim(),
        village: village.trim(),
        district: district.trim(),
        pincode: pincode.trim(),
      },
      rawAddressString: formattedAddress,
      paymentMethod,
      paymentStatus, // "pending" (COD) | "paid" (online)
      status: "pending", // pending -> confirmed -> picked_up -> out_for_delivery -> delivered
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
      createdAt: serverTimestamp(),
    });

    // 🔔 Store Owner Notification doc
    const itemsSummary = checkoutItems.map((c) => `${c.name} x${c.qty}`).join(", ");
    await addDoc(collection(db, "notifications"), {
      type: "new_order",
      orderId: orderRef.id,
      message: `🛒 ${profile?.name || "Customer"} (${mobileNumber}) ஆர்டர் பண்ணிருக்காங்க: ${itemsSummary} — மொத்தம் ₹${totalAmount}`,
      address: formattedAddress,
      paymentMethod,
      read: false,
      createdAt: serverTimestamp(),
    });

    // 🔔 Customer In-App Notification doc
    await addDoc(collection(db, "customer_notifications"), {
      userId: user.uid,
      orderId: orderRef.id,
      type: "status_change",
      status: "pending",
      message: `🎉 Your order has been placed successfully! Order ID: ${orderRef.id}`,
      read: false,
      createdAt: serverTimestamp(),
    });

    return orderRef.id;
  };

  const handleCodOrder = async () => {
    const validationError = validateAddress();
    if (validationError) return alert(validationError);

    setPlacing(true);
    try {
      await createOrder("pending");
      if (!buyNowProduct) clearCart();
      navigate("/profile");
    } catch (err) {
      console.error(err);
      alert(t("orderFailed"));
    } finally {
      setPlacing(false);
    }
  };

  const handleOnlinePayment = () => {
    const validationError = validateAddress();
    if (validationError) return alert(validationError);
    if (!window.Razorpay) return alert("Razorpay SDK load ஆகல. Internet check பண்ணுங்க.");

    const options = {
      key: RAZORPAY_KEY,
      amount: totalAmount * 100, // in paise
      currency: "INR",
      name: "SA Store Daily Needs",
      description: "Order Payment",
      method: { upi: true, card: true, netbanking: true, wallet: true },
      handler: async function () {
        setPlacing(true);
        try {
          await createOrder("paid");
          if (!buyNowProduct) clearCart();
          navigate("/profile");
        } catch (err) {
          console.error(err);
          alert("Payment succeeded but order creation failed. Please contact support.");
        } finally {
          setPlacing(false);
        }
      },
      prefill: {
        name: profile?.name || "",
        contact: mobileNumber || user?.phoneNumber || "",
      },
      theme: { color: "#c9a227" },
    };

    const rzp = new window.Razorpay(options);
    rzp.open();
  };

  return (
    <div className="checkout-page">
      <h1>{t("checkout")}</h1>

      {/* Geolocation Status Banner */}
      <div className="checkout-section" style={{ fontSize: "13px", background: "#f5f6fa", padding: "10px 16px" }}>
        <span>{locationStatus}</span>
      </div>

      <div className="checkout-section">
        <h3>🏠 {t("deliveryAddress")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>House / Door Number *</label>
            <input
              type="text"
              placeholder="e.g. 10-A, Ground Floor"
              value={houseNumber}
              onChange={(e) => setHouseNumber(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Street Name *</label>
            <input
              type="text"
              placeholder="e.g. Gandhi Street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Village / City / Area *</label>
            <input
              type="text"
              placeholder="e.g. Periyar Nagar"
              value={village}
              onChange={(e) => setVillage(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>District *</label>
            <input
              type="text"
              placeholder="e.g. Madurai"
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Pincode (6 digits) *</label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. 625001"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Mobile Number (10 digits) *</label>
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={mobileNumber}
              onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ""))}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
        </div>
      </div>

      <div className="checkout-section">
        <h3>🛒 {t("orderSummary")}</h3>
        {checkoutItems.map((c) => (
          <div key={c.id} className="summary-row">
            <span>{c.name} x{c.qty}</span>
            <span>₹{c.price * c.qty}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>{t("deliveryCharge")}</span>
          <span>
            {isFreeDelivery ? (
              <strong style={{ color: "#2e7d32" }}>FREE Delivery (First 5 orders)</strong>
            ) : (
              `₹${deliveryCharge}`
            )}
          </span>
        </div>
        {onlineOrderCount < 5 && paymentMethod === "cod" && (
          <div style={{ fontSize: "11px", color: "#a5821a", fontWeight: "600", marginTop: "4px" }}>
            💡 Select "Online Payment" to get FREE delivery (Offer active: {onlineOrderCount}/5 orders used)
          </div>
        )}
        <div className="summary-row total">
          <span>{t("total")}</span>
          <span>₹{totalAmount}</span>
        </div>
      </div>

      <div className="checkout-section">
        <h3>💳 {t("paymentMethod")}</h3>
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
        disabled={placing || checkoutItems.length === 0}
        onClick={paymentMethod === "cod" ? handleCodOrder : handleOnlinePayment}
      >
        {placing ? t("placingOrder") : `${t("placeOrder")} · ₹${totalAmount}`}
      </button>
    </div>
  );
}
