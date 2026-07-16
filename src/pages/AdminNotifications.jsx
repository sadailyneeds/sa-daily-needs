// src/pages/AdminNotifications.jsx
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/admin.css";

export default function AdminNotifications() {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    const q = query(collection(db, "notifications"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      setNotifications(snap.docs.map((d) => ({ id: d.id, ...d.data() })));

      // 🔊 Optional: play a sound whenever a NEW unread order notification arrives
      const hasUnread = snap.docChanges().some(
        (change) => change.type === "added" && !change.doc.data().read
      );
      if (hasUnread) {
        new Audio("/notification.mp3").play().catch(() => {});
        if (navigator.vibrate) navigator.vibrate([300, 150, 300]);
      }
    });
    return unsub;
  }, []);

  // Opening this page is treated as "the admin has seen the alert" - mark
  // every notification as read so the repeating ring/vibrate on the
  // dashboard stops immediately.
  useEffect(() => {
    if (notifications.length === 0) return;
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;
    (async () => {
      try {
        const batch = writeBatch(db);
        unread.forEach((n) => batch.update(doc(db, "notifications", n.id), { read: true }));
        await batch.commit();
      } catch (err) {
        console.error("Failed to mark notifications read:", err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications.length]);

  const markAsRead = async (id) => {
    await updateDoc(doc(db, "notifications", id), { read: true });
  };

  return (
    <div className="admin-page">
      <h1>🔔 Order Notifications</h1>
      <div className="notif-list">
        {notifications.length === 0 && <p className="no-results">Notifications ஒண்ணும் இல்ல</p>}
        {notifications.map((n) => (
          <div
            key={n.id}
            className={`notif-card ${n.read ? "" : "unread"}`}
            onClick={() => markAsRead(n.id)}
          >
            <span className="notif-dot" />
            <div>
              <p className="notif-message">{n.message}</p>
              {n.address && <p className="notif-address">📍 {n.address}</p>}
              {n.paymentMethod && (
                <p className="notif-payment">
                  {n.paymentMethod === "cod" ? "💵 Cash on Delivery" : "💳 Paid Online"}
                </p>
              )}
              <span className="notif-time">
                {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
