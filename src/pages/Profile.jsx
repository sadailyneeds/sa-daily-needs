// src/pages/Profile.jsx
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import "../styles/profile.css";

const STATUS_LABELS = {
  placed: "📦 Order வைக்கப்பட்டது",
  confirmed: "✅ உறுதி செய்யப்பட்டது",
  out_for_delivery: "🚴 டெலிவரிக்கு புறப்பட்டது",
  delivered: "🎉 டெலிவரி முடிந்தது",
  cancelled: "❌ ரத்து செய்யப்பட்டது",
};

export default function Profile() {
  const { user, profile, logout } = useAuth();
  const [orders, setOrders] = useState([]);

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

      <h2 className="orders-heading">My Orders</h2>

      {orders.length === 0 ? (
        <div className="empty-state">
          <p>📦 இன்னும் order பண்ணல</p>
          <span>Home page-ல products பாருங்க</span>
        </div>
      ) : (
        <div className="orders-list">
          {orders.map((order) => (
            <div key={order.id} className="order-card">
              <div className="order-card-header">
                <span className="order-status">{STATUS_LABELS[order.status] || order.status}</span>
                <span className="order-amount">₹{order.totalAmount}</span>
              </div>
              <p className="order-items">
                {order.items?.map((i) => `${i.name} x${i.qty}`).join(", ")}
              </p>
              <p className="order-meta">
                {order.paymentMethod === "cod" ? "💵 Cash on Delivery" : "💳 Paid Online"} ·{" "}
                {order.createdAt?.toDate
                  ? order.createdAt.toDate().toLocaleDateString("en-IN")
                  : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
