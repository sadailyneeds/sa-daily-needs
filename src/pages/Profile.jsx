// src/pages/Profile.jsx
import { useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../i18n/translations";
import { formatWeight } from "../utils/weightPricing";
import "../styles/profile.css";

const STATUS_LABELS = {
  pending: "⏳ Pending / காத்திருக்கிறது",
  placed: "⏳ Placed / ஆர்டர் செய்யப்பட்டது", // Fallback for old orders
  confirmed: "✅ Confirmed / உறுதி செய்யப்பட்டது",
  picked_up: "📦 Picked Up / சேகரிக்கப்பட்டது",
  out_for_delivery: "🚴 Out for Delivery / டெலிவரிக்கு புறப்பட்டது",
  delivered: "🎉 Delivered / டெலிவரி முடிந்தது",
  cancelled: "❌ Cancelled / ரத்து செய்யப்பட்டது",
};

// Order timeline steps (cancelled orders get their own separate row)
const TIMELINE_STEPS = [
  { key: "pending", label: "Pending", icon: "⏳" },
  { key: "confirmed", label: "Confirmed", icon: "✅" },
  { key: "picked_up", label: "Picked Up", icon: "📦" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "🚴" },
  { key: "delivered", label: "Delivered", icon: "🎉" },
];

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const fileInputRef = useRef(null);

  // Edit Profile modal state
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState("");
  const [editHouseNo, setEditHouseNo] = useState("");
  const [editStreet, setEditStreet] = useState("");
  const [editArea, setEditArea] = useState("");
  const [editLandmark, setEditLandmark] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPincode, setEditPincode] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  // Fetch user orders
  useEffect(() => {
    if (!user) return;
    const q = query(
  collection(db, "orders"),
  where("userId", "==", user.uid)
);

const unsub = onSnapshot(
  q,
  (snap) => {
    console.log("Orders:", snap.docs.length);
    setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  },
  (err) => {
    console.error("Firestore Error:", err);
  }
);
    return unsub;
  }, [user]);

  // Fetch in-app customer notifications
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "customer_notifications"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [user]);

  const openEditModal = () => {
    setEditName(profile?.name || "");
    const addr = profile?.savedAddress || {};
    setEditHouseNo(addr.houseNo || "");
    setEditStreet(addr.street || "");
    setEditArea(addr.area || "");
    setEditLandmark(addr.landmark || "");
    setEditCity(addr.city || "");
    setEditPincode(addr.pincode || "");
    setShowEdit(true);
  };

  const handleSaveProfile = async () => {
    if (!editName.trim()) return alert("Name தேவை / Name is required.");
    setSavingProfile(true);
    try {
      const userRef = doc(db, "users", user.uid);
      const updates = { name: editName.trim() };
      // Only overwrite saved address if there was already one on file,
      // or the customer has started filling it in here - keeps first-order
      // flow (Checkout page) as the primary place a fresh address gets created.
      if (profile?.savedAddress || editHouseNo || editStreet || editArea || editCity || editPincode) {
        updates.savedAddress = {
          ...(profile?.savedAddress || {}),
          name: editName.trim(),
          phone: profile?.phone || "",
          houseNo: editHouseNo.trim(),
          street: editStreet.trim(),
          area: editArea.trim(),
          landmark: editLandmark.trim(),
          city: editCity.trim(),
          pincode: editPincode.trim(),
        };
      }
      await updateDoc(userRef, updates);
      setShowEdit(false);
    } catch (err) {
      console.error(err);
      alert("Profile update பண்ண முடியல. மறுபடியும் try பண்ணுங்க.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handlePhotoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) return alert("Please choose an image file.");
    if (file.size > 5 * 1024 * 1024) return alert("Image should be under 5MB.");

    setUploadingPhoto(true);
    try {
      const photoRef = ref(storage, `users/${user.uid}/avatar_${Date.now()}`);
      await uploadBytes(photoRef, file);
      const url = await getDownloadURL(photoRef);
      await updateDoc(doc(db, "users", user.uid), { photoURL: url });
    } catch (err) {
      console.error(err);
      alert("Photo upload பண்ண முடியல. மறுபடியும் try பண்ணுங்க.");
    } finally {
      setUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCancelOrder = async (order) => {
    if (window.confirm("இந்த ஆர்டரை ரத்து செய்ய விரும்புகிறீர்களா?\nAre you sure you want to cancel this order?")) {
      try {
        // Update Firestore order status
        await updateDoc(doc(db, "orders", order.id), {
          status: "cancelled",
        });

        // Add Customer In-App Notification
        await addDoc(collection(db, "customer_notifications"), {
          userId: user.uid,
          orderId: order.id,
          type: "status_change",
          status: "cancelled",
          message: `❌ You cancelled your order (ID: ${order.id})`,
          read: false,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error(err);
        alert("ஆர்டரை ரத்து செய்ய முடியவில்லை. மீண்டும் முயற்சிக்கவும். / Unable to cancel order. Please try again.");
      }
    }
  };

  return (
    <div className="profile-page">
      <div className="profile-card">
        <div className="profile-avatar-wrap">
          {profile?.photoURL ? (
            <img src={profile.photoURL} alt="Profile" className="profile-avatar-img" />
          ) : (
            <div className="profile-avatar">👤</div>
          )}
          <button
            className="profile-photo-edit-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            title={t("changePhoto")}
          >
            {uploadingPhoto ? "…" : "📷"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            onChange={handlePhotoChange}
          />
        </div>
        <div style={{ flex: 1 }}>
          <p className="profile-name">{profile?.name || "Customer"}</p>
          <p className="profile-phone">{profile?.phone || user?.phoneNumber}</p>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button className="edit-profile-btn" onClick={openEditModal}>✏️ {t("editProfile")}</button>
          <button className="logout-btn" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Language switcher - lives inside Profile per app requirements */}
      <div className="profile-lang-section">
        <span className="profile-lang-label">🌐 {t("language")}</span>
        <div className="profile-lang-options">
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              className={`profile-lang-btn ${lang === l.code ? "active" : ""}`}
              onClick={() => setLang(l.code)}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Saved address quick view */}
      {profile?.savedAddress && (
        <div className="profile-address-card">
          <h3 style={{ margin: "0 0 6px", fontSize: "13.5px", color: "#555" }}>📍 {t("myAddress")}</h3>
          <p style={{ margin: 0, fontSize: "13px", color: "#333", lineHeight: 1.5 }}>
            {[
              profile.savedAddress.houseNo,
              profile.savedAddress.street,
              profile.savedAddress.area,
              profile.savedAddress.landmark ? `Near ${profile.savedAddress.landmark}` : "",
              profile.savedAddress.city,
              profile.savedAddress.pincode,
            ].filter(Boolean).join(", ")}
          </p>
        </div>
      )}

      {/* Customer In-App Notifications Panel */}
      {notifications.length > 0 && (
        <div className="notifications-section" style={{ marginBottom: "20px" }}>
          <h2 className="orders-heading" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            🔔 In-App Alerts
          </h2>
          <div className="notifications-list" style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "200px", overflowY: "auto", padding: "4px" }}>
            {notifications.map((n) => (
              <div
                key={n.id}
                style={{
                  background: n.status === "cancelled" ? "#fdeaea" : "#f3f8f1",
                  borderLeft: `4px solid ${n.status === "cancelled" ? "#d32f2f" : "#3f7d32"}`,
                  padding: "10px 12px",
                  borderRadius: "6px",
                  fontSize: "13px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                }}
              >
                <div style={{ fontWeight: "600", color: "#222" }}>{n.message}</div>
                <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                  {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="orders-heading">My Orders</h2>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>📦 இன்னும் order பண்ணல</p>
          <span>Home page-ல products பாருங்க</span>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => {
            const canCancel = order.status === "pending" || order.status === "placed" || order.status === "confirmed";
            const isCancelled = order.status === "cancelled";
            const normalizedStatus = order.status === "placed" ? "pending" : order.status;
            const currentStepIndex = TIMELINE_STEPS.findIndex((s) => s.key === normalizedStatus);

            return (
              <div key={order.id} className="order-card" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div className="order-card-header">
                  <span className="order-status" style={{ color: order.status === "cancelled" ? "#d32f2f" : "#3f7d32" }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <span className="order-amount">₹{order.totalAmount}</span>
                </div>
                <p className="order-items">
                  {order.items?.map((i) => `${i.name}${i.weight ? ` (${formatWeight(i.weight)})` : ""} x${i.qty}`).join(", ")}
                </p>

                {/* Order status timeline */}
                {!isCancelled && currentStepIndex >= 0 && (
                  <div className="order-timeline">
                    {TIMELINE_STEPS.map((step, idx) => (
                      <div
                        key={step.key}
                        className={`order-timeline-step ${idx <= currentStepIndex ? "done" : ""} ${idx === currentStepIndex ? "current" : ""}`}
                      >
                        <span className="order-timeline-dot">{idx <= currentStepIndex ? step.icon : ""}</span>
                        <span className="order-timeline-label">{step.label}</span>
                        {idx < TIMELINE_STEPS.length - 1 && <span className="order-timeline-line" />}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: "10px" }}>
                  <p className="order-meta">
                    {order.paymentMethod === "cod" ? "💵 Cash on Delivery" : "💳 Paid Online"} ·{" "}
                    {order.createdAt?.toDate
                      ? order.createdAt.toDate().toLocaleDateString("en-IN")
                      : ""}
                  </p>

                  {/* Customer Cancel Order Button */}
                  {canCancel && (
                    <button
                      onClick={() => handleCancelOrder(order)}
                      style={{
                        background: "#fdeaea",
                        color: "#d32f2f",
                        border: "none",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        fontWeight: "700",
                        fontSize: "12px",
                        cursor: "pointer",
                        transition: "0.15s",
                      }}
                      onMouseOver={(e) => {
                        e.target.style.background = "#d32f2f";
                        e.target.style.color = "#fff";
                      }}
                      onMouseOut={(e) => {
                        e.target.style.background = "#fdeaea";
                        e.target.style.color = "#d32f2f";
                      }}
                    >
                      ❌ Cancel Order
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEdit && (
        <div className="modal-backdrop" onClick={() => !savingProfile && setShowEdit(false)}>
          <div className="modal-content profile-edit-modal" onClick={(e) => e.stopPropagation()}>
            <h2 style={{ marginTop: 0 }}>✏️ {t("editProfile")}</h2>

            <label className="edit-field-label">Name *</label>
            <input className="edit-field-input" value={editName} onChange={(e) => setEditName(e.target.value)} />

            <label className="edit-field-label">House / Door Number</label>
            <input className="edit-field-input" value={editHouseNo} onChange={(e) => setEditHouseNo(e.target.value)} />

            <label className="edit-field-label">Street</label>
            <input className="edit-field-input" value={editStreet} onChange={(e) => setEditStreet(e.target.value)} />

            <label className="edit-field-label">Area</label>
            <input className="edit-field-input" value={editArea} onChange={(e) => setEditArea(e.target.value)} />

            <label className="edit-field-label">Landmark</label>
            <input className="edit-field-input" value={editLandmark} onChange={(e) => setEditLandmark(e.target.value)} />

            <label className="edit-field-label">City</label>
            <input className="edit-field-input" value={editCity} onChange={(e) => setEditCity(e.target.value)} />

            <label className="edit-field-label">Pincode</label>
            <input className="edit-field-input" maxLength={6} value={editPincode} onChange={(e) => setEditPincode(e.target.value.replace(/\D/g, ""))} />

            <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
              <button className="modal-cancel-btn" onClick={() => setShowEdit(false)} disabled={savingProfile}>
                {t("cancel")}
              </button>
              <button className="place-order-btn" onClick={handleSaveProfile} disabled={savingProfile} style={{ flex: 1 }}>
                {savingProfile ? "Saving..." : t("save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
