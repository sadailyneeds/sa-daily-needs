// src/pages/Checkout.jsx
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { doc, updateDoc, addDoc, collection, serverTimestamp, query, where, onSnapshot } from "firebase/firestore";
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

  // Address states
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNo, setHouseNo] = useState("");
  const [street, setStreet] = useState("");
  const [area, setArea] = useState("");
  const [landmark, setLandmark] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");

  const [paymentMethod, setPaymentMethod] = useState("online"); // Default to online payment
  const [placing, setPlacing] = useState(false);
  const [completedOrderCount, setCompletedOrderCount] = useState(0);

  // Live Location states
  const [location, setLocation] = useState(null);
  const [locationStatus, setLocationStatus] = useState("Checking location permission...");
  const [showLocationPopup, setShowLocationPopup] = useState(false);

  // Fetch location on mount
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
          setLocationStatus("⚠️ Location access is disabled. Enable location to place your order.");
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      setLocationStatus("❌ Geolocation not supported by browser.");
    }
  }, []);

  // Fetch count of previous completed orders (status === "delivered")
  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "orders"), where("userId", "==", user.uid));
    const unsub = onSnapshot(q, (snap) => {
      const userOrders = snap.docs.map((doc) => doc.data());
      const count = userOrders.filter((o) => o.status === "delivered").length;
      setCompletedOrderCount(count);
      // Auto switch payment method if they have completed 5 orders and want COD
      if (count < 5) {
        setPaymentMethod("online");
      }
    });
    return unsub;
  }, [user]);

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

  const itemsTotal = checkoutItems.reduce((sum, c) => sum + c.price * c.qty, 0);

  // Free delivery logic: first 5 successful online orders are free delivery.
  const isFreeDelivery = paymentMethod === "online" && completedOrderCount < 5;
  const deliveryCharge = itemsTotal > 0 ? (isFreeDelivery ? 0 : 10) : 0;
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

  // Helper to trigger GPS check and save/submit order
  const verifyLocationAndSubmit = (submitCallback) => {
    if (!location) {
      setLocationStatus("Checking location...");
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
        (err) => {
          console.error("Location error:", err);
          setLocationStatus("⚠️ Location access denied.");
          setShowLocationPopup(true);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    } else {
      submitCallback(location);
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

    const formattedAddress = `${name.trim()}, ${phone.trim()}, ${houseNo.trim()}, ${street.trim()}, ${area.trim()}, ${landmark.trim() ? "Near " + landmark.trim() + ", " : ""}${city.trim()} - ${pincode.trim()}`;

    // 2. Add document to orders collection
    const orderRef = await addDoc(collection(db, "orders"), {
      userId: user.uid,
      customerName: name.trim(),
      customerPhone: `+91${phone.trim().replace(/\D/g, "")}`,
      items: checkoutItems.map((c) => ({ id: c.id, name: c.name, price: c.price, qty: c.qty })),
      itemsTotal,
      deliveryCharge,
      totalAmount,
      address: addressObj,
      rawAddressString: formattedAddress,
      paymentMethod,
      paymentStatus, // "pending" (COD) | "paid" (online)
      status: "pending", // pending -> confirmed -> picked_up -> out_for_delivery -> delivered
      latitude: verifiedLoc?.latitude || null,
      longitude: verifiedLoc?.longitude || null,
      createdAt: serverTimestamp(),
    });

    // 3. Store Owner Notification doc
    const itemsSummary = checkoutItems.map((c) => `${c.name} x${c.qty}`).join(", ");
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
    // COD policy check: first 5 orders online payment only
    if (completedOrderCount < 5) {
      alert("Your first 5 orders must be paid online. Cash on Delivery will be available after completing 5 successful online orders.");
      return;
    }

    const validationError = validateAddress();
    if (validationError) return alert(validationError);

    verifyLocationAndSubmit(async (verifiedLoc) => {
      setPlacing(true);
      try {
        await createOrder("pending", verifiedLoc);
        if (!buyNowProduct) clearCart();
        navigate("/profile");
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
    if (!window.Razorpay) return alert("Razorpay SDK load ஆகல. Internet check பண்ணுங்க.");

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
            navigate("/profile");
          } catch (err) {
            console.error(err);
            alert("Payment succeeded but order creation failed. Please contact support.");
          } finally {
            setPlacing(false);
          }
        },
        prefill: {
          name: name.trim() || profile?.name || "",
          contact: phone.trim() || user?.phoneNumber || "",
        },
        theme: { color: "#c9a227" },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    });
  };

  const handlePaymentMethodSelection = (method) => {
    if (method === "cod" && completedOrderCount < 5) {
      alert("Your first 5 orders must be paid online.\nCash on Delivery will be available after completing 5 successful online orders.");
      return;
    }
    setPaymentMethod(method);
  };

  return (
    <div className="checkout-page">
      <h1>{t("checkout")}</h1>

      {/* Geolocation Status Banner */}
      <div className="checkout-section" style={{ fontSize: "13px", background: "#f5f6fa", padding: "10px 16px", borderRadius: "8px" }}>
        <span>{locationStatus}</span>
      </div>

      <div className="checkout-section">
        <h3>🏠 {t("deliveryAddress")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Name *</label>
            <input
              type="text"
              placeholder="e.g. Rajesh Kumar"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Phone Number (10 digits) *</label>
            <input
              type="text"
              maxLength={10}
              placeholder="e.g. 9876543210"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>House / Door Number *</label>
            <input
              type="text"
              placeholder="e.g. 10-A, Ground Floor"
              value={houseNo}
              onChange={(e) => setHouseNo(e.target.value)}
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
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Area / Neighborhood *</label>
            <input
              type="text"
              placeholder="e.g. Anna Nagar"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>Landmark (Optional)</label>
            <input
              type="text"
              placeholder="e.g. Near Vinayagar Temple"
              value={landmark}
              onChange={(e) => setLandmark(e.target.value)}
              style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #ddd", fontSize: "14px", marginTop: "4px" }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", color: "#666", fontWeight: "600" }}>City / Village *</label>
            <input
              type="text"
              placeholder="e.g. Madurai"
              value={city}
              onChange={(e) => setCity(e.target.value)}
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
        {completedOrderCount < 5 && paymentMethod === "online" && (
          <div style={{ fontSize: "11.5px", color: "#2e7d32", fontWeight: "600", marginTop: "4px" }}>
            💡 Free delivery active for your first 5 online orders!
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
          <label
            className={`payment-option ${paymentMethod === "online" ? "selected" : ""}`}
            onClick={() => handlePaymentMethodSelection("online")}
          >
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "online"}
              readOnly
            />
            {t("onlinePayment")}
          </label>
          <label
            className={`payment-option ${paymentMethod === "cod" ? "selected" : ""} ${completedOrderCount < 5 ? "disabled-option" : ""}`}
            onClick={() => handlePaymentMethodSelection("cod")}
            style={completedOrderCount < 5 ? { opacity: 0.6, cursor: "not-allowed" } : {}}
          >
            <input
              type="radio"
              name="payment"
              checked={paymentMethod === "cod"}
              disabled={completedOrderCount < 5}
              readOnly
            />
            {t("cod")}
            {completedOrderCount < 5 && (
              <span style={{ fontSize: "10px", background: "#fdeaea", color: "#d32f2f", padding: "2px 6px", borderRadius: "4px", marginLeft: "auto" }}>
                COD Locked
              </span>
            )}
          </label>
        </div>
        {completedOrderCount < 5 && (
          <p style={{ fontSize: "11px", color: "#d32f2f", margin: "8px 0 0", fontWeight: "600" }}>
            ⚠️ Cash on Delivery (COD) will unlock after you complete 5 successful online orders. (Current: {completedOrderCount}/5)
          </p>
        )}
      </div>

      <button
        className="place-order-btn"
        disabled={placing || checkoutItems.length === 0}
        onClick={paymentMethod === "cod" ? handleCodOrder : handleOnlinePayment}
      >
        {placing ? t("placingOrder") : `${t("placeOrder")} · ₹${totalAmount}`}
      </button>

      {/* 📍 Custom Location Check Alert Modal Popup */}
      {showLocationPopup && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <span style={{ fontSize: "40px" }}>📍</span>
            <h2>Location Required</h2>
            <p>Please enable Location to continue placing your order.</p>
            <button
              className="place-order-btn"
              onClick={() => {
                setShowLocationPopup(false);
                setLocationStatus("Checking location...");
                navigator.geolocation.getCurrentPosition(
                  (pos) => {
                    setLocation({
                      latitude: pos.coords.latitude,
                      longitude: pos.coords.longitude,
                    });
                    setLocationStatus("📍 Location shared successfully");
                  },
                  (err) => {
                    console.error(err);
                    setLocationStatus("⚠️ Location access denied.");
                    setShowLocationPopup(true); // reopen
                  },
                  { enableHighAccuracy: true, timeout: 10000 }
                );
              }}
            >
              Try Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
