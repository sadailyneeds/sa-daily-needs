// src/pages/Checkout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, updateDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { formatWeight, formatMoney } from "../utils/weightPricing";
import "../styles/checkout.css";

// Razorpay key — replace with your live key in production
// ⚠️ For production, order creation + verification MUST happen on a backend/Cloud Function
const RAZORPAY_KEY = "rzp_test_TDkLU1fQtiUItg";

// Flat delivery charge on every order — no free delivery exceptions
const DELIVERY_CHARGE = 10;

export default function Checkout({ cart, clearCart }) {
  const { user, profile } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const routerLocation = useLocation();

  // Single product checkout check
  const buyNowProduct = routerLocation.state?.buyNowProduct;
  const checkoutItems = buyNowProduct ? [buyNowProduct] : cart;

  // Address states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [street, setStreet] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("online");
  const [placing, setPlacing] = useState(false);

  // Live Location states
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Checking location...");
  const [showLocationPopup, setShowLocationPopup] = useState(false);

  // Fetch GPS location on mount
  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationStatus("❌ Geolocation not supported.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocationStatus("📍 Location shared successfully");
      },
      (err) => {
        // Location is optional — order can still be placed without it
        setLocationStatus("⚠️ Location not shared. (Optional — address is used for delivery)");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, []);

  // Pre-fill profile & saved address if available
  useEffect(() => {
    if (profile) {
      setName(profile.name || "");
      setPhone(profile.phone?.replace("+91", "") || "");
      if (profile.savedAddress) {
        setHouseNo(profile.savedAddress.houseNo || "");
        setStreet(profile.savedAddress.street || "");
        setArea(profile.savedAddress.area || "");
        setLandmark(profile.savedAddress.landmark || "");
        setCity(profile.savedAddress.city || "");
        setPincode(profile.savedAddress.pincode || "");
      }
    }
  }, [profile]);

  // Always ₹10 delivery charge when cart has items
  const itemsTotal = checkoutItems.reduce((sum, c) => sum + c.price * c.qty, 0);
  const deliveryCharge = itemsTotal > 0 ? DELIVERY_CHARGE : 0;
  const totalAmount = itemsTotal + deliveryCharge;

  // Validate address input fields
  const validateAddress = () => {
    if (!name.trim()) return "Name is required.";
    if (!phone.trim()) return "Phone number is required.";
    if (!/^\d{10}$/.test(phone.trim().replace(/\D/g, ""))) {
      return "Please enter a valid 10-digit Phone Number.";
    }
    if (!houseNo.trim()) return "House Number / Door No is required.";
    if (!street.trim()) return "Street name is required.";
    if (!area.trim()) return "Area is required.";
    if (!city.trim()) return "City is required.";
    if (!pincode.trim()) return "Pincode is required.";
    if (!/^\d{6}$/.test(pincode.trim())) return "Please enter a valid 6-digit Pincode.";
    return null;
  };

  // Helper: try to get GPS, then run the submit callback
  const verifyLocationAndSubmit = (submitCallback) => {
    if (location) {
      submitCallback(location);
      return;
    }
    // Try one more time to get location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setLocation(loc);
          setLocationStatus("📍 Location shared successfully");
          submitCallback(loc);
        },
        () => {
          // Location optional — proceed without it
          submitCallback(null);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    } else {
      submitCallback(null);
    }
  };

  const createOrder = async (paymentStatus, verifiedLoc) => {
    // 1. Save / Update User Profile Address permanently in Firestore
    const userRef = doc(db, "users", user.uid);
    const addressObj = {
      name: name.trim(),
      phone: `+91${phone.trim().replace(/\D/g, "")}`,
      houseNo: houseNo.trim(),
      street: street.trim(),
      area: area.trim(),
      landmark: landmark.trim(),
      city: city.trim(),
      pincode: pincode.trim(),
    };
    await updateDoc(userRef, {
      name: name.trim(),
      phone: `+91${phone.trim().replace(/\D/g, "")}`,
      savedAddress: addressObj,
      location: verifiedLoc || null,
    });

    const formattedAddress = `${name.trim()}, ${phone.trim()}, ${houseNo.trim()}, ${street.trim()}, ${area.trim()}${landmark.trim() ? ", Near " + landmark.trim() : ""}, ${city.trim()} - ${pincode.trim()}`;

    // 2. Add order document to Firestore
    const orderRef = await addDoc(collection(db, "orders"), {
      userId: user.uid,
      customerName: name.trim(),
      customerPhone: `+91${phone.trim().replace(/\D/g, "")}`,
      items: checkoutItems.map((c) => ({
        id: c.id,
        name: c.name,
        price: c.price,
        qty: c.qty,
        weight: c.weight || null,
      })),
      itemsTotal,
      deliveryCharge,
      totalAmount,
      address: addressObj,
      rawAddressString: formattedAddress,
      paymentMethod,
      paymentStatus, // "pending" (COD) | "paid" (online)
      status: "pending",
      latitude: verifiedLoc?.latitude || null,
      longitude: verifiedLoc?.longitude || null,
      createdAt: serverTimestamp(),
    });

    // 3. Store Owner Notification doc
    const itemsSummary = checkoutItems
      .map((c) => `${c.name}${c.weight ? ` (${formatWeight(c.weight)})` : ""} x${c.qty}`)
      .join(", ");
    await addDoc(collection(db, "notifications"), {
      type: "new_order",
      orderId: orderRef.id,
      message: `🛒 ${name.trim()} (${phone.trim()}) ஆர்டர் பண்ணிருக்காங்க: ${itemsSummary} — மொத்தம் ₹${totalAmount}`,
      address: formattedAddress,
      paymentMethod,
      read: false,
      createdAt: serverTimestamp(),
    });

    // 4. Customer In-App Notification doc
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

  const handleCodOrder = () => {
    const validationError = validateAddress();
    if (validationError) return alert(validationError);

    verifyLocationAndSubmit(async (verifiedLoc) => {
      setPlacing(true);
      try {
        await createOrder("pending", verifiedLoc);
        if (!buyNowProduct) clearCart();
        navigate("/profile", { replace: true });
      } catch (err) {
        console.error(err);
        alert(t("orderFailed"));
      } finally {
        setPlacing(false);
      }
    });
  };

  const handleOnlinePayment = () => {
    const validationError = validateAddress();
    if (validationError) return alert(validationError);

    // Guard: Razorpay SDK may not load in offline APK context
    if (!window.Razorpay) {
      alert("Payment gateway is loading. Please wait a moment and try again, or choose Cash on Delivery.");
      return;
    }

    verifyLocationAndSubmit((verifiedLoc) => {
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
            await createOrder("paid", verifiedLoc);
            if (!buyNowProduct) clearCart();
            navigate("/profile", { replace: true });
          } catch (err) {
            console.error(err);
            alert("Payment succeeded but order creation failed. Please contact support.");
          } finally {
            setPlacing(false);
          }
        },
        prefill: {
          name: name.trim() || profile?.name || "",
          contact: phone.trim() || "",
        },
        theme: { color: "#c9a227" },
        modal: {
          ondismiss: () => {
            setPlacing(false);
          },
        },
      };

      try {
        const rzp = new window.Razorpay(options);
        rzp.on("payment.failed", (response) => {
          console.error("Razorpay payment failed:", response.error);
          alert("Payment failed: " + (response.error?.description || "Please try again."));
          setPlacing(false);
        });
        rzp.open();
      } catch (err) {
        console.error("Razorpay init error:", err);
        alert("Could not open payment gateway. Please try COD or check your internet connection.");
        setPlacing(false);
      }
    });
  };

  return (
    <div className="checkout-page">
      <h1>{t("checkout")}</h1>

      {/* Geolocation Status Banner */}
      <div className="checkout-section location-status-bar">
        <span>{locationStatus}</span>
      </div>

      {/* Delivery Address */}
      <div className="checkout-section">
        <h3>🏠 {t("deliveryAddress")}</h3>
        <div className="checkout-form-fields">
          <div className="checkout-field">
            <label>Name *</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>
          <div className="checkout-field">
            <label>Phone Number (10 digits) *</label>
            <input
              type="tel"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              autoComplete="tel"
            />
          </div>
          <div className="checkout-field">
            <label>House / Door Number *</label>
            <input
              type="text"
              placeholder="e.g. 10-A, Ground Floor"
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
            />
          </div>
          <div className="checkout-field">
            <label>Street Name *</label>
            <input
              type="text"
              placeholder="e.g. Gandhi Street"
              value={street}
              onChange={(e) => setStreet(e.target.value)}
            />
          </div>
          <div className="checkout-field">
            <label>Area / Neighborhood *</label>
            <input
              type="text"
              placeholder="e.g. Anna Nagar"
              value={area}
              onChange={(e) => setArea(e.target.value)}
            />
          </div>
          <div className="checkout-field">
            <label>Landmark (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Near Vinayagar Temple"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
            />
          </div>
          <div className="checkout-field">
            <label>City / Village *</label>
            <input
              type="text"
              placeholder="e.g. Madurai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="checkout-field">
            <label>Pincode (6 digits) *</label>
            <input
              type="text"
              maxLength={6}
              placeholder="e.g. 625001"
              value={pincode}
              onChange={(e) => setPincode(e.target.value.replace(/\D/g, ""))}
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      {/* Order Summary */}
      <div className="checkout-section">
        <h3>🛒 {t("orderSummary")}</h3>
        {checkoutItems.map((c) => (
          <div key={c.weight ? `${c.id}-${c.weight}` : c.id} className="summary-row">
            <span>
              {c.name}{c.weight ? ` (Weight: ${formatWeight(c.weight)})` : ""} x{c.qty}
            </span>
            <span>₹{formatMoney(c.price * c.qty)}</span>
          </div>
        ))}
        <div className="summary-row">
          <span>{t("deliveryCharge")}</span>
          <span style={{ fontWeight: "700" }}>₹{deliveryCharge}</span>
        </div>
        <div className="summary-row total">
          <span>{t("total")}</span>
          <span>₹{formatMoney(totalAmount)}</span>
        </div>
      </div>

      {/* Payment Method */}
      <div className="checkout-section">
        <h3>💳 {t("paymentMethod")}</h3>
        <div className="payment-options">
          <label
            className={`payment-option ${paymentMethod === "online" ? "selected" : ""}`}
            onClick={() => setPaymentMethod("online")}
          >
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "online"}
              onChange={() => setPaymentMethod("online")}
            />
            {t("onlinePayment")}
          </label>
          <label
            className={`payment-option ${paymentMethod === "cod" ? "selected" : ""}`}
            onClick={() => setPaymentMethod("cod")}
          >
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "cod"}
              onChange={() => setPaymentMethod("cod")}
            />
            {t("cod")}
          </label>
        </div>
      </div>

      <button
        className="place-order-btn"
        disabled={placing || checkoutItems.length === 0}
        onClick={paymentMethod === "cod" ? handleCodOrder : handleOnlinePayment}
      >
        {placing ? t("placingOrder") : `${t("placeOrder")} · ₹${formatMoney(totalAmount)}`}
      </button>

      {/* Location popup — shown only if GPS was required and denied */}
      {showLocationPopup && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <span style={{ fontSize: "40px" }}>📍</span>
            <h2>Location Access</h2>
            <p>Location is optional but helps with accurate delivery. You can still proceed without it.</p>
            <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
              <button
                className="place-order-btn"
                style={{ maxWidth: "160px" }}
                onClick={() => {
                  setShowLocationPopup(false);
                  navigator.geolocation?.getCurrentPosition(
                    (pos) => {
                      setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
                      setLocationStatus("📍 Location shared successfully");
                    },
                    () => setLocationStatus("⚠️ Location not shared."),
                    { enableHighAccuracy: true, timeout: 10000 }
                  );
                }}
              >
                Enable Location
              </button>
              <button
                style={{ background: "#f5f5f5", color: "#333", border: "none", padding: "12px 20px", borderRadius: "8px", fontWeight: "700", cursor: "pointer" }}
                onClick={() => setShowLocationPopup(false)}
              >
                Continue Without
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
