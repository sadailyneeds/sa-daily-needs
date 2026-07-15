// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
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

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Fetch user orders
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "orders"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
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
        <div className="profile-avatar">👤</div>
        <div>
          <p className="profile-name">{profile?.name || "Customer"}</p>
          <p className="profile-phone">{user?.phoneNumber}</p>
        </div>
        <button className="logout-btn" onClick={logout}>Logout</button>
      </div>

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

            return (
              <div key={order.id} className="order-card" style={{ boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div className="order-card-header">
                  <span className="order-status" style={{ color: order.status === "cancelled" ? "#d32f2f" : "#3f7d32" }}>
                    {STATUS_LABELS[order.status] || order.status}
                  </span>
                  <span className="order-amount">₹{order.totalAmount}</span>
                </div>
                <p className="order-items">
                  {order.items?.map((i) => `${i.name} x${i.qty}`).join(", ")}
                </p>
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
    </div>
  );
}
