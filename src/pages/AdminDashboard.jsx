// src/pages/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, deleteDoc, doc, query, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { handleImgError } from "../utils/imagePlaceholder";
import "../styles/admin.css";

const STATUS_ORDER = {
  pending: 1,
  placed: 1,
  confirmed: 2,
  picked_up: 3,
  out_for_delivery: 4,
  delivered: 5,
  cancelled: 6,
};

const STATUS_LABELS = {
  pending: "⏳ Pending / காத்திருக்கிறது",
  placed: "⏳ Placed / ஆர்டர் செய்யப்பட்டது",
  confirmed: "✅ Confirmed / உறுதி செய்யப்பட்டது",
  picked_up: "📦 Picked Up / சேகரிக்கப்பட்டது",
  out_for_delivery: "🚴 Out for Delivery / டெலிவரிக்கு புறப்பட்டது",
  delivered: "🎉 Delivered / டெலிவரி முடிந்தது",
  cancelled: "❌ Cancelled / ரத்து செய்யப்பட்டது",
};

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  
  // Search & Filter states
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  
  // Dashboard Tabs: "overview" | "orders" | "products" | "analytics"
  const [activeTab, setActiveTab] = useState("overview");

  // Unread order-notification count, used for the navbar/tab badge and to
  // keep the alert ringing until the admin actually opens the Notifications page.
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Analytics range: "daily" | "weekly" | "monthly" | "yearly"
  const [analyticsRange, setAnalyticsRange] = useState("daily");

  // Synthesize notification beep (no external file needed)
  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      console.error("Audio Context beep error:", e);
    }
  };

  const vibrateDevice = () => {
    try {
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    } catch (e) {
      // Vibration API not supported on this device/browser - safe to ignore.
    }
  };

  const showBrowserNotification = (orderId, customerName) => {
    if (Notification.permission === "granted") {
      new Notification("New Order Placed! 🛒", {
        body: `Order #${orderId} received from ${customerName}.`,
        icon: "/favicon.ico",
      });
    }
  };

  useEffect(() => {
    // Request permission for browser notification
    if (Notification.permission === "default") {
      Notification.requestPermission();
    }

    const unsubP = onSnapshot(query(collection(db, "products")), (snap) =>
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    let isInitial = true;
    const unsubO = onSnapshot(query(collection(db, "orders")), (snap) => {
      const fetchedOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(fetchedOrders);

      // Play alert sound and display notification on a new order arrival
      if (!isInitial) {
        const hasNewOrder = snap.docChanges().some(
          (change) => change.type === "added"
        );
        if (hasNewOrder) {
          playBeep();
          vibrateDevice();
          const docChanges = snap.docChanges().filter(c => c.type === "added");
          if (docChanges.length > 0) {
            const newOrder = docChanges[0].doc.data();
            showBrowserNotification(docChanges[0].doc.id, newOrder.customerName || "Customer");
          }
        }
      }
      isInitial = false;
    });

    const unsubU = onSnapshot(query(collection(db, "users")), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    return () => {
      unsubP();
      unsubO();
      unsubU();
    };
  }, []);

  // Live badge count of unread order notifications - updates instantly via
  // Firebase realtime listener (no polling / refresh needed).
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "notifications"), (snap) => {
      const unread = snap.docs.filter((d) => !d.data().read).length;
      setUnreadNotifCount(unread);
    });
    return unsub;
  }, []);

  // Keep the alert sound + vibration repeating on mobile/desktop while there
  // are unread notifications, so an admin can't miss a new order. Stops the
  // instant the admin opens the Notifications page (they get marked read there).
  useEffect(() => {
    if (unreadNotifCount === 0) return;
    const ringInterval = setInterval(() => {
      playBeep();
      vibrateDevice();
    }, 6000);
    return () => clearInterval(ringInterval);
  }, [unreadNotifCount]);

  // Update order status in workflow
  const handleUpdateStatus = async (order, nextStatus) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      const updates = { status: nextStatus };

      // If marked as delivered, also update paymentStatus to paid
      if (nextStatus === "delivered") {
        updates.paymentStatus = "paid";
      }

      await updateDoc(orderRef, updates);

      // Send customer an in-app notification
      const statusMessages = {
        confirmed: "✅ Your order has been confirmed by the store!",
        picked_up: "📦 Your order has been picked up and is ready for delivery!",
        out_for_delivery: "🚴 Out for Delivery! Our delivery partner is on the way.",
        delivered: "🎉 Delivered! Thank you for shopping with SA Store.",
        cancelled: "❌ Your order has been cancelled by the store.",
      };

      await addDoc(collection(db, "customer_notifications"), {
        userId: order.userId,
        orderId: order.id,
        type: "status_change",
        status: nextStatus,
        message: statusMessages[nextStatus] || `Order status updated to ${nextStatus}`,
        read: false,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.error(err);
      alert("Order status update failed. Please try again.");
    }
  };

  // Delete product
  const handleDelete = async (id) => {
    if (window.confirm("இந்த product-ஐ delete பண்ணணுமா?")) {
      await deleteDoc(doc(db, "products", id));
    }
  };

  // Metrics calculations
  const totalOrdersCount = orders.filter((o) => o.status !== "cancelled").length;
  const completedOrdersCount = orders.filter((o) => o.status === "delivered").length;
  const cancelledOrdersCount = orders.filter((o) => o.status === "cancelled").length;

  const countPending = orders.filter((o) => o.status === "pending" || o.status === "placed").length;
  const countConfirmed = orders.filter((o) => o.status === "confirmed").length;
  const countPickedUp = orders.filter((o) => o.status === "picked_up").length;
  const countOutForDelivery = orders.filter((o) => o.status === "out_for_delivery").length;

  const getTodayRevenue = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders
      .filter((o) => {
        if (o.status === "cancelled") return false;
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return orderDate >= today;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  };

  const getTodayOrders = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.filter((o) => {
      const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      return orderDate >= today;
    });
  };

  const getTodayCustomersCount = () => {
    const todayOrders = getTodayOrders();
    const uniqueCustomers = new Set(todayOrders.map((o) => o.userId || o.customerPhone));
    return uniqueCustomers.size;
  };

  const getMonthlyRevenue = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return orders
      .filter((o) => {
        if (o.status === "cancelled") return false;
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return orderDate >= startOfMonth;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  };

  // Low stock products filter (<= 5 left)
  const lowStockProducts = products.filter((p) => p.stock !== undefined && p.stock <= 5);

  // Sorting products
  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];
  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  // Sorting and filtering orders
  const filteredOrders = orders
    .filter((o) => {
      if (orderStatusFilter === "all") return true;
      if (orderStatusFilter === "pending") return o.status === "pending" || o.status === "placed";
      return o.status === orderStatusFilter;
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA; // Recent first
    });

  // Orders inside the selected Analytics range (Daily/Weekly/Monthly/Yearly)
  const getAnalyticsOrders = () => {
    const now = new Date();
    const rangeStart = new Date();
    if (analyticsRange === "daily") {
      rangeStart.setHours(0, 0, 0, 0);
    } else if (analyticsRange === "weekly") {
      rangeStart.setDate(now.getDate() - 7);
    } else if (analyticsRange === "monthly") {
      rangeStart.setDate(1);
      rangeStart.setHours(0, 0, 0, 0);
    } else if (analyticsRange === "yearly") {
      rangeStart.setMonth(0, 1);
      rangeStart.setHours(0, 0, 0, 0);
    }
    return orders
      .filter((o) => {
        const orderDate = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return orderDate >= rangeStart;
      })
      .sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });
  };
  const analyticsOrders = getAnalyticsOrders();
  const analyticsTotalRevenue = analyticsOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const tabStyle = (tab) => ({
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    background: activeTab === tab ? "linear-gradient(135deg, var(--gold), var(--gold-dark))" : "#e0e0e0",
    color: activeTab === tab ? "#141414" : "#555",
    transition: "0.2s",
  });

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Store Owner Dashboard</h1>
        <div className="admin-header-actions">
          <Link to="/admin/notifications" className="btn-outline" style={{ position: "relative" }}>
            🔔 Notifications
            {unreadNotifCount > 0 && (
              <span className="admin-notif-badge">{unreadNotifCount}</span>
            )}
          </Link>
          <Link to="/admin/add-product" className="btn-primary-admin">+ Add Product</Link>
        </div>
      </div>

      {/* Admin navigation tabs */}
      <div className="admin-tabs" style={{ display: "flex", gap: "10px", marginBottom: "22px" }}>
        <button style={tabStyle("overview")} onClick={() => setActiveTab("overview")}>📊 Overview</button>
        <button style={tabStyle("orders")} onClick={() => setActiveTab("orders")}>🛒 Orders Manager ({orders.length})</button>
        <button style={tabStyle("products")} onClick={() => setActiveTab("products")}>📦 Products Manager ({products.length})</button>
        <button style={tabStyle("analytics")} onClick={() => setActiveTab("analytics")}>📈 Analytics</button>
      </div>

      {/* Tab Content 1: Overview */}
      {activeTab === "overview" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Key Metric cards */}
          <div className="stats-grid">
            <div className="stat-card gold">
              <span className="stat-label">Total Orders</span>
              <span className="stat-value">{totalOrdersCount}</span>
            </div>
            <div className="stat-card green">
              <span className="stat-label">Completed Orders</span>
              <span className="stat-value">{completedOrdersCount}</span>
            </div>
            <div className="stat-card black">
              <span className="stat-label">Cancelled Orders</span>
              <span className="stat-value">{cancelledOrdersCount}</span>
            </div>
            <div className="stat-card revenue">
              <span className="stat-label">Today's Revenue</span>
              <span className="stat-value">₹{getTodayRevenue().toLocaleString("en-IN")}</span>
            </div>
            <div className="stat-card gold">
              <span className="stat-label">Today's Orders</span>
              <span className="stat-value">{getTodayOrders().length}</span>
            </div>
            <div className="stat-card green">
              <span className="stat-label">Today's Customers</span>
              <span className="stat-value">{getTodayCustomersCount()}</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "20px" }}>
            <div style={{ background: "#fff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ margin: "0 0 14px", borderBottom: "1px solid #f0f0f0", paddingBottom: "8px" }}>📅 Monthly Revenue</h3>
              <div style={{ fontSize: "28px", fontWeight: "800", color: "var(--gold-dark)" }}>
                ₹{getMonthlyRevenue().toLocaleString("en-IN")}
              </div>
              <p style={{ fontSize: "12px", color: "#888", margin: "6px 0 0" }}>Total revenue generated this month (excluding cancelled orders).</p>
            </div>
          </div>

          {/* Workflow order counts grid */}
          <div style={{ background: "#fff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <h3 style={{ margin: "0 0 14px", borderBottom: "1px solid #f0f0f0", paddingBottom: "8px" }}>⚙️ Active Workflow Orders</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "12px" }}>
              <div style={{ padding: "10px", background: "#fdf8ec", borderLeft: "4px solid #c9a227", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Pending</div>
                <div style={{ fontSize: "20px", fontWeight: "700" }}>{countPending}</div>
              </div>
              <div style={{ padding: "10px", background: "#f3f8f1", borderLeft: "4px solid #3f7d32", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Confirmed</div>
                <div style={{ fontSize: "20px", fontWeight: "700" }}>{countConfirmed}</div>
              </div>
              <div style={{ padding: "10px", background: "#e8f4fd", borderLeft: "4px solid #1e88e5", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Picked Up</div>
                <div style={{ fontSize: "20px", fontWeight: "700" }}>{countPickedUp}</div>
              </div>
              <div style={{ padding: "10px", background: "#f3e5f5", borderLeft: "4px solid #ab47bc", borderRadius: "6px" }}>
                <div style={{ fontSize: "11px", color: "#666" }}>Out for Delivery</div>
                <div style={{ fontSize: "20px", fontWeight: "700" }}>{countOutForDelivery}</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", flexWrap: "wrap" }} className="form-grid">
            {/* Low stock products */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ margin: "0 0 14px", borderBottom: "1px solid #f0f0f0", paddingBottom: "8px", color: "#d32f2f" }}>⚠️ Low Stock Warning (5 or less)</h3>
              {lowStockProducts.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#888" }}>All products have sufficient stock! ✅</p>
              ) : (
                <div style={{ maxHeight: "250px", overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #f0f0f0", color: "#666" }}>
                        <th style={{ padding: "6px 0", textAlign: "left" }}>Product</th>
                        <th style={{ padding: "6px 0", textAlign: "right" }}>Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockProducts.map((p) => (
                        <tr key={p.id} style={{ borderBottom: "1px solid #fafafa" }}>
                          <td style={{ padding: "8px 0" }}>{p.name} ({p.unit})</td>
                          <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "700", color: "#d32f2f" }}>{p.stock} left</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recent orders */}
            <div style={{ background: "#fff", borderRadius: "12px", padding: "18px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <h3 style={{ margin: "0 0 14px", borderBottom: "1px solid #f0f0f0", paddingBottom: "8px" }}>📦 Recent Orders</h3>
              {orders.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#888" }}>No orders placed yet.</p>
              ) : (
                <div style={{ maxHeight: "250px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", borderBottom: "1px solid #fafafa", paddingBottom: "6px" }}>
                      <div>
                        <span style={{ fontWeight: "600" }}>{o.customerName}</span>
                        <div style={{ color: "#777", fontSize: "11px" }}>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Just now"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: "700" }}>₹{o.totalAmount}</span>
                        <div style={{ fontSize: "10px", color: "#3f7d32", fontWeight: "600" }}>{o.status.toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab Content 2: Orders Manager */}
      {activeTab === "orders" && (
        <div>
          {/* Order status filters */}
          <div style={{ display: "flex", gap: "8px", overflowX: "auto", paddingBottom: "12px", marginBottom: "16px" }}>
            {["all", "pending", "confirmed", "picked_up", "out_for_delivery", "delivered", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setOrderStatusFilter(status)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "20px",
                  border: orderStatusFilter === status ? "none" : "1px solid #ddd",
                  background: orderStatusFilter === status ? "var(--green)" : "#fff",
                  color: orderStatusFilter === status ? "#fff" : "#555",
                  fontWeight: "600",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {status.replace("_", " ").toUpperCase()}
              </button>
            ))}
          </div>

          {/* Orders cards rendering */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredOrders.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", padding: "40px 0" }}>No orders found under this status.</p>
            ) : (
              filteredOrders.map((o) => {
                const isPending = o.status === "pending" || o.status === "placed";
                const isConfirmed = o.status === "confirmed";
                const isPickedUp = o.status === "picked_up";
                const isOutForDelivery = o.status === "out_for_delivery";

                return (
                  <div
                    key={o.id}
                    style={{
                      background: "#fff",
                      borderRadius: "12px",
                      padding: "20px",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                      borderLeft: `5px solid ${
                        o.status === "cancelled"
                          ? "#d32f2f"
                          : o.status === "delivered"
                          ? "#2e7d32"
                          : "var(--gold-dark)"
                      }`,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", borderBottom: "1px solid #f0f0f0", paddingBottom: "10px", marginBottom: "12px", gap: "10px" }}>
                      <div>
                        <span style={{ fontSize: "11px", color: "#888" }}>ORDER ID: #{o.id}</span>
                        <h3 style={{ margin: "2px 0 0", fontSize: "16px" }}>👤 {o.customerName}</h3>
                        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--green)" }}>📞 {o.customerPhone}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", background: "#f5f5f5", padding: "4px 8px", borderRadius: "6px" }}>
                          {STATUS_LABELS[o.status] || o.status}
                        </span>
                        <div style={{ fontSize: "11px", color: "#888", marginTop: "6px" }}>
                          📅 {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                        </div>
                      </div>
                    </div>

                    {/* Customer Details & Address */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: "14px", fontSize: "13px", marginBottom: "14px" }} className="form-grid">
                      <div>
                        <h4 style={{ margin: "0 0 6px", color: "#555" }}>📍 Shipping Address</h4>
                        {o.address && typeof o.address === "object" ? (
                          <div style={{ color: "#333", lineHeight: "1.4" }}>
                            <strong>Door / House No:</strong> {o.address.houseNumber} <br />
                            <strong>Street:</strong> {o.address.street} <br />
                            <strong>Village / City:</strong> {o.address.village} <br />
                            <strong>District:</strong> {o.address.district} <br />
                            <strong>Pincode:</strong> {o.address.pincode}
                          </div>
                        ) : (
                          <div style={{ color: "#333" }}>{o.address || o.rawAddressString}</div>
                        )}
                      </div>

                      {/* Payment & Geolocation */}
                      <div>
                        <h4 style={{ margin: "0 0 6px", color: "#555" }}>💵 Payment & Location</h4>
                        <div>
                          <strong>Method:</strong> {o.paymentMethod === "online" ? "💳 Online Payment" : "💵 Cash on Delivery (COD)"}
                        </div>
                        <div style={{ marginTop: "4px" }}>
                          <strong>Payment Status:</strong>{" "}
                          <span style={{ fontWeight: "700", color: o.paymentStatus === "paid" ? "#2e7d32" : "#a5821a" }}>
                            {o.paymentStatus === "paid" ? "PAID" : "PENDING"}
                          </span>
                        </div>

                        {/* Customer Live Geolocation */}
                        <div style={{ marginTop: "10px" }}>
                          {o.latitude && o.longitude ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <span style={{ fontSize: "12px", color: "#555" }}>📍 Coordinates: {o.latitude.toFixed(5)}, {o.longitude.toFixed(5)}</span>
                              <a
                                href={`https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  background: "#3f7d32",
                                  color: "#fff",
                                  border: "none",
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  textDecoration: "none",
                                  display: "inline-block",
                                }}
                              >
                                🗺️ Open in Google Maps
                              </a>
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#888" }}>📍 Live location not shared for this order.</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Order Items */}
                    <div style={{ background: "#fafafa", padding: "12px 16px", borderRadius: "8px", marginBottom: "14px" }}>
                      <h4 style={{ margin: "0 0 8px", fontSize: "12.5px", color: "#666" }}>Items List</h4>
                      {o.items?.map((item, idx) => (
                        <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", padding: "4px 0", borderBottom: idx < o.items.length - 1 ? "1px solid #eee" : "none" }}>
                          <span>{item.name} <strong style={{ color: "#666" }}>x{item.qty}</strong></span>
                          <span>₹{item.price * item.qty}</span>
                        </div>
                      ))}
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "10px", borderTop: "1px dashed #ddd", paddingTop: "8px", fontSize: "13px", fontWeight: "700" }}>
                        <span>Delivery Charge:</span>
                        <span>₹{o.deliveryCharge || 0}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "14px", fontWeight: "800", color: "#111" }}>
                        <span>Total Paid/Payable:</span>
                        <span>₹{o.totalAmount}</span>
                      </div>
                    </div>

                    {/* Actions Workflow transitions */}
                    <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                      {isPending && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(o, "confirmed")}
                            style={{ background: "#e8f4fd", color: "#1e88e5", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                          >
                            ✅ Confirm Order
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(o, "cancelled")}
                            style={{ background: "#fdeaea", color: "#d32f2f", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                          >
                            ❌ Cancel Order
                          </button>
                        </>
                      )}

                      {isConfirmed && (
                        <>
                          <button
                            onClick={() => handleUpdateStatus(o, "picked_up")}
                            style={{ background: "#f3f8f1", color: "#2e7d32", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                          >
                            📦 Mark as Picked Up
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(o, "cancelled")}
                            style={{ background: "#fdeaea", color: "#d32f2f", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                          >
                            ❌ Cancel Order
                          </button>
                        </>
                      )}

                      {isPickedUp && (
                        <button
                          onClick={() => handleUpdateStatus(o, "out_for_delivery")}
                          style={{ background: "#f3e5f5", color: "#ab47bc", border: "none", padding: "8px 14px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                        >
                          🚴 Set Out for Delivery
                        </button>
                      )}

                      {isOutForDelivery && (
                        <button
                          onClick={() => handleUpdateStatus(o, "delivered")}
                          style={{ background: "linear-gradient(135deg, #4c9a3f, #2e5c25)", color: "#fff", border: "none", padding: "8px 16px", borderRadius: "6px", fontWeight: "700", fontSize: "13px", cursor: "pointer" }}
                        >
                          🎉 Mark as Delivered
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab Content 3: Products Manager */}
      {activeTab === "products" && (
        <div>
          {/* Search + filter */}
          <div className="admin-toolbar">
            <input
              type="text"
              placeholder="🔍 Search product..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              {categories.map((c) => (
                <option key={c} value={c}>{c === "all" ? "All Categories" : c}</option>
              ))}
            </select>
          </div>

          {/* Product table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Image</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>MRP</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((p) => (
                  <tr key={p.id}>
                    <td><img src={p.imageUrl} alt={p.name} className="admin-thumb" loading="lazy" onError={handleImgError} /></td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>₹{p.price}</td>
                    <td>₹{p.mrp}</td>
                    <td className={p.stock > 0 ? "in-stock" : "out-stock"}>
                      {p.stock > 0 ? `${p.stock} left` : "Out of stock"}
                    </td>
                    <td className="action-cell">
                      <Link to={`/admin/edit-product/${p.id}`} className="edit-btn">Edit</Link>
                      <button className="delete-btn" onClick={() => handleDelete(p.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredProducts.length === 0 && <p className="no-results">No products found</p>}
          </div>
        </div>
      )}

      {/* Tab Content 4: Analytics */}
      {activeTab === "analytics" && (
        <div>
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            {["daily", "weekly", "monthly", "yearly"].map((range) => (
              <button
                key={range}
                onClick={() => setAnalyticsRange(range)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "20px",
                  border: analyticsRange === range ? "none" : "1px solid #ddd",
                  background: analyticsRange === range ? "var(--green)" : "#fff",
                  color: analyticsRange === range ? "#fff" : "#555",
                  fontWeight: "700",
                  fontSize: "13px",
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {range}
              </button>
            ))}
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)", marginBottom: "18px" }}>
            <div className="stat-card gold">
              <span className="stat-label">Orders ({analyticsRange})</span>
              <span className="stat-value">{analyticsOrders.length}</span>
            </div>
            <div className="stat-card revenue">
              <span className="stat-label">Revenue ({analyticsRange})</span>
              <span className="stat-value">₹{analyticsTotalRevenue.toLocaleString("en-IN")}</span>
            </div>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Items</th>
                  <th>Price</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {analyticsOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "-"}</td>
                    <td>{o.customerName}</td>
                    <td>{o.customerPhone}</td>
                    <td>{o.items?.map((i) => `${i.name} x${i.qty}`).join(", ")}</td>
                    <td>₹{o.totalAmount}</td>
                    <td>{o.paymentMethod === "cod" ? "COD" : "Online"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {analyticsOrders.length === 0 && <p className="no-results">No orders in this range</p>}
          </div>
        </div>
      )}
    </div>
  );
}
