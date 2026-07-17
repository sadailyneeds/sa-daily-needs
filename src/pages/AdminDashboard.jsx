// src/pages/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, deleteDoc, doc, query, updateDoc, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/config";
import { handleImgError } from "../utils/imagePlaceholder";
import { GROCERY_PRODUCTS } from "../utils/seedProducts";
import { formatWeight, formatMoney } from "../utils/weightPricing";
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
  pending: "⏳ Pending",
  placed: "⏳ Placed",
  confirmed: "✅ Confirmed",
  picked_up: "📦 Picked Up",
  out_for_delivery: "🚴 Out for Delivery",
  delivered: "🎉 Delivered",
  cancelled: "❌ Cancelled",
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

  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [analyticsRange, setAnalyticsRange] = useState("daily");

  // Seed state
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [seedProgress, setSeedProgress] = useState({ done: 0, total: 0 });

  // Synthesize notification beep — guarded for Android WebView
  const playBeep = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
      gainNode.gain.setValueAtTime(0.3, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.4);
    } catch (e) {
      // Audio not supported — safe to ignore
    }
  };

  const vibrateDevice = () => {
    try {
      if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 300]);
    } catch (e) {
      // Vibration API not supported — safe to ignore
    }
  };

  const showBrowserNotification = (orderId, customerName) => {
    // Web Notifications API not available in Android WebView — guard required
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        new Notification("New Order Placed! 🛒", {
          body: `Order #${orderId} received from ${customerName}.`,
          icon: "./favicon.png",
        });
      }
    } catch (e) {
      // Notification API not available — safe to ignore
    }
  };

  useEffect(() => {
    // Request browser notification permission — guarded for Android WebView
    try {
      if (typeof Notification !== "undefined" && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
      }
    } catch (e) {
      // Not supported — safe to ignore
    }

    const unsubP = onSnapshot(query(collection(db, "products")), (snap) =>
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );

    let isInitial = true;
    const unsubO = onSnapshot(query(collection(db, "orders")), (snap) => {
      const fetchedOrders = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setOrders(fetchedOrders);

      if (!isInitial) {
        const hasNewOrder = snap.docChanges().some((change) => change.type === "added");
        if (hasNewOrder) {
          playBeep();
          vibrateDevice();
          const newOrderChanges = snap.docChanges().filter((c) => c.type === "added");
          if (newOrderChanges.length > 0) {
            const newOrder = newOrderChanges[0].doc.data();
            showBrowserNotification(newOrderChanges[0].doc.id, newOrder.customerName || "Customer");
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

  useEffect(() => {
    const unsub = onSnapshot(collection(db, "notifications"), (snap) => {
      const unread = snap.docs.filter((d) => !d.data().read).length;
      setUnreadNotifCount(unread);
    });
    return unsub;
  }, []);

  // Repeat alert sound while there are unread notifications
  useEffect(() => {
    if (unreadNotifCount === 0) return;
    const ringInterval = setInterval(() => {
      playBeep();
      vibrateDevice();
    }, 6000);
    return () => clearInterval(ringInterval);
  }, [unreadNotifCount]);

  // Seed grocery catalog into Firestore
  const handleSeedProducts = async () => {
    if (!window.confirm(`This will add ${GROCERY_PRODUCTS.length} grocery products to your store. Continue?`)) return;
    setSeeding(true);
    setSeedProgress({ done: 0, total: GROCERY_PRODUCTS.length });
    try {
      for (let i = 0; i < GROCERY_PRODUCTS.length; i++) {
        await addDoc(collection(db, "products"), {
          ...GROCERY_PRODUCTS[i],
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setSeedProgress({ done: i + 1, total: GROCERY_PRODUCTS.length });
      }
      setSeedDone(true);
      alert(`✅ ${GROCERY_PRODUCTS.length} products added successfully!`);
    } catch (err) {
      console.error("Seed error:", err);
      alert("Error seeding products: " + err.message);
    } finally {
      setSeeding(false);
    }
  };

  // Update order status
  const handleUpdateStatus = async (order, nextStatus) => {
    try {
      const orderRef = doc(db, "orders", order.id);
      const updates = { status: nextStatus };
      if (nextStatus === "delivered") updates.paymentStatus = "paid";
      await updateDoc(orderRef, updates);

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

  // Metrics
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
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return d >= today;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  };

  const getTodayOrders = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return orders.filter((o) => {
      const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
      return d >= today;
    });
  };

  const getTodayCustomersCount = () => {
    const todayOrders = getTodayOrders();
    return new Set(todayOrders.map((o) => o.userId || o.customerPhone)).size;
  };

  const getMonthlyRevenue = () => {
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    return orders
      .filter((o) => {
        if (o.status === "cancelled") return false;
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return d >= startOfMonth;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  };

  const lowStockProducts = products.filter((p) => p.stock !== undefined && p.stock <= 5);

  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];
  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const filteredOrders = orders
    .filter((o) => {
      if (orderStatusFilter === "all") return true;
      if (orderStatusFilter === "pending") return o.status === "pending" || o.status === "placed";
      return o.status === orderStatusFilter;
    })
    .sort((a, b) => {
      const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return timeB - timeA;
    });

  const getAnalyticsOrders = () => {
    const now = new Date();
    const rangeStart = new Date();
    if (analyticsRange === "daily") rangeStart.setHours(0, 0, 0, 0);
    else if (analyticsRange === "weekly") rangeStart.setDate(now.getDate() - 7);
    else if (analyticsRange === "monthly") { rangeStart.setDate(1); rangeStart.setHours(0, 0, 0, 0); }
    else if (analyticsRange === "yearly") { rangeStart.setMonth(0, 1); rangeStart.setHours(0, 0, 0, 0); }
    return orders
      .filter((o) => {
        const d = o.createdAt?.toDate ? o.createdAt.toDate() : new Date();
        return d >= rangeStart;
      })
      .sort((a, b) => {
        const tA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const tB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return tB - tA;
      });
  };

  const analyticsOrders = getAnalyticsOrders();
  const analyticsTotalRevenue = analyticsOrders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Store Dashboard</h1>
        <div className="admin-header-actions">
          <Link to="/admin/notifications" className="btn-outline" style={{ position: "relative" }}>
            🔔 Alerts
            {unreadNotifCount > 0 && (
              <span className="admin-notif-badge">{unreadNotifCount}</span>
            )}
          </Link>
          <Link to="/admin/add-product" className="btn-primary-admin">+ Add Product</Link>
        </div>
      </div>

      {/* Admin navigation tabs — scrollable on mobile */}
      <div className="admin-tabs">
        {[
          { key: "overview", label: "📊 Overview" },
          { key: "orders", label: `🛒 Orders (${orders.length})` },
          { key: "products", label: `📦 Products (${products.length})` },
          { key: "analytics", label: "📈 Analytics" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`admin-tab-btn ${activeTab === tab.key ? "active" : ""}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ===== Tab 1: Overview ===== */}
      {activeTab === "overview" && (
        <div className="tab-content">
          {/* Key Metric cards */}
          <div className="stats-grid">
            <div className="stat-card gold">
              <span className="stat-label">Total Orders</span>
              <span className="stat-value">{totalOrdersCount}</span>
            </div>
            <div className="stat-card green">
              <span className="stat-label">Completed</span>
              <span className="stat-value">{completedOrdersCount}</span>
            </div>
            <div className="stat-card black">
              <span className="stat-label">Cancelled</span>
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

          {/* Monthly Revenue */}
          <div className="info-card">
            <h3>📅 Monthly Revenue</h3>
            <div className="big-revenue">₹{getMonthlyRevenue().toLocaleString("en-IN")}</div>
            <p className="muted-text">Total revenue this month (excluding cancelled orders)</p>
          </div>

          {/* Workflow order counts */}
          <div className="info-card">
            <h3>⚙️ Active Workflow</h3>
            <div className="workflow-grid">
              <div className="workflow-item gold-border">
                <div className="workflow-label">Pending</div>
                <div className="workflow-value">{countPending}</div>
              </div>
              <div className="workflow-item green-border">
                <div className="workflow-label">Confirmed</div>
                <div className="workflow-value">{countConfirmed}</div>
              </div>
              <div className="workflow-item blue-border">
                <div className="workflow-label">Picked Up</div>
                <div className="workflow-value">{countPickedUp}</div>
              </div>
              <div className="workflow-item purple-border">
                <div className="workflow-label">Out for Delivery</div>
                <div className="workflow-value">{countOutForDelivery}</div>
              </div>
            </div>
          </div>

          <div className="overview-grid">
            {/* Low Stock Warning */}
            <div className="info-card">
              <h3 className="danger-text">⚠️ Low Stock (≤5)</h3>
              {lowStockProducts.length === 0 ? (
                <p className="muted-text">All products have sufficient stock! ✅</p>
              ) : (
                <div className="scrollable-list">
                  {lowStockProducts.map((p) => (
                    <div key={p.id} className="list-row">
                      <span>{p.name} ({p.unit})</span>
                      <span className="danger-text bold-text">{p.stock} left</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Orders */}
            <div className="info-card">
              <h3>📦 Recent Orders</h3>
              {orders.length === 0 ? (
                <p className="muted-text">No orders placed yet.</p>
              ) : (
                <div className="scrollable-list">
                  {orders.slice(0, 5).map((o) => (
                    <div key={o.id} className="list-row">
                      <div>
                        <div className="bold-text">{o.customerName}</div>
                        <div className="muted-text small-text">
                          {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="bold-text">₹{o.totalAmount}</div>
                        <div className="status-text">{(o.status || "").toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Grocery Catalog Seed — Admin Only, One-Time */}
          {!seedDone && (
            <div className="info-card seed-card">
              <h3>🌱 Seed Grocery Catalog</h3>
              <p className="muted-text">
                Add {GROCERY_PRODUCTS.length} pre-built grocery products across all categories to your store in one click.
                Only use this once on a fresh store.
              </p>
              {seeding && (
                <div className="seed-progress">
                  <div
                    className="seed-bar"
                    style={{ width: `${(seedProgress.done / seedProgress.total) * 100}%` }}
                  />
                  <span className="seed-progress-text">{seedProgress.done} / {seedProgress.total} products added</span>
                </div>
              )}
              <button
                className="btn-primary-admin"
                onClick={handleSeedProducts}
                disabled={seeding}
                style={{ marginTop: "12px" }}
              >
                {seeding ? `Adding products... (${seedProgress.done}/${seedProgress.total})` : `🌱 Add ${GROCERY_PRODUCTS.length} Products`}
              </button>
            </div>
          )}
          {seedDone && (
            <div className="info-card" style={{ borderLeft: "4px solid #3f7d32" }}>
              <p style={{ color: "#2e7d32", fontWeight: "700", margin: 0 }}>
                ✅ Grocery catalog seeded successfully! Refresh Products tab to see them.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== Tab 2: Orders Manager ===== */}
      {activeTab === "orders" && (
        <div className="tab-content">
          {/* Status filter chips — horizontal scroll on mobile */}
          <div className="filter-chips">
            {["all", "pending", "confirmed", "picked_up", "out_for_delivery", "delivered", "cancelled"].map((status) => (
              <button
                key={status}
                onClick={() => setOrderStatusFilter(status)}
                className={`filter-chip ${orderStatusFilter === status ? "active" : ""}`}
              >
                {status.replace(/_/g, " ").toUpperCase()}
              </button>
            ))}
          </div>

          <div className="orders-list">
            {filteredOrders.length === 0 ? (
              <p className="no-results">No orders found under this status.</p>
            ) : (
              filteredOrders.map((o) => {
                const isPending = o.status === "pending" || o.status === "placed";
                const isConfirmed = o.status === "confirmed";
                const isPickedUp = o.status === "picked_up";
                const isOutForDelivery = o.status === "out_for_delivery";

                return (
                  <div
                    key={o.id}
                    className={`order-card ${o.status === "cancelled" ? "order-cancelled" : o.status === "delivered" ? "order-delivered" : "order-pending"}`}
                  >
                    {/* Order Header */}
                    <div className="order-header">
                      <div>
                        <span className="order-id">ORDER #{o.id.slice(-6).toUpperCase()}</span>
                        <h3 className="order-customer">👤 {o.customerName}</h3>
                        <span className="order-phone">📞 {o.customerPhone}</span>
                      </div>
                      <div className="order-status-block">
                        <span className="order-status-badge">{STATUS_LABELS[o.status] || o.status}</span>
                        <div className="order-time">
                          📅 {o.createdAt?.toDate ? o.createdAt.toDate().toLocaleString("en-IN") : "Just now"}
                        </div>
                      </div>
                    </div>

                    {/* Address */}
                    <div className="order-address">
                      <strong>📍 </strong>
                      {o.address && typeof o.address === "object"
                        ? `${o.address.houseNo}, ${o.address.street}, ${o.address.area}, ${o.address.city} - ${o.address.pincode}`
                        : o.rawAddressString || o.address}
                    </div>

                    {/* Payment */}
                    <div className="order-payment-row">
                      <span>💵 {o.paymentMethod === "online" ? "Online Payment" : "Cash on Delivery"}</span>
                      <span className={`payment-status ${o.paymentStatus === "paid" ? "paid" : "pending"}`}>
                        {o.paymentStatus === "paid" ? "✅ PAID" : "⏳ PENDING"}
                      </span>
                    </div>

                    {/* Map link */}
                    {o.latitude && o.longitude && (
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${o.latitude},${o.longitude}`}
                        target="_blank"
                        rel="noreferrer"
                        className="map-link"
                      >
                        🗺️ Open in Google Maps
                      </a>
                    )}

                    {/* Items */}
                    <div className="order-items-box">
                      <div className="order-items-title">Items</div>
                      {o.items?.map((item, idx) => (
                        <div key={idx} className="order-item-row">
                          <span>
                            {item.name}{item.weight ? ` (Weight: ${formatWeight(item.weight)})` : ""} <strong>x{item.qty}</strong>
                          </span>
                          <span>₹{formatMoney(item.price * item.qty)}</span>
                        </div>
                      ))}
                      <div className="order-item-row delivery-row">
                        <span>Delivery Charge</span>
                        <span>₹{o.deliveryCharge || 10}</span>
                      </div>
                      <div className="order-total-row">
                        <span>Total</span>
                        <span>₹{formatMoney(o.totalAmount)}</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="order-actions">
                      {isPending && (
                        <>
                          <button className="action-btn confirm" onClick={() => handleUpdateStatus(o, "confirmed")}>✅ Confirm</button>
                          <button className="action-btn cancel" onClick={() => handleUpdateStatus(o, "cancelled")}>❌ Cancel</button>
                        </>
                      )}
                      {isConfirmed && (
                        <>
                          <button className="action-btn pickup" onClick={() => handleUpdateStatus(o, "picked_up")}>📦 Picked Up</button>
                          <button className="action-btn cancel" onClick={() => handleUpdateStatus(o, "cancelled")}>❌ Cancel</button>
                        </>
                      )}
                      {isPickedUp && (
                        <button className="action-btn delivery" onClick={() => handleUpdateStatus(o, "out_for_delivery")}>🚴 Out for Delivery</button>
                      )}
                      {isOutForDelivery && (
                        <button className="action-btn delivered" onClick={() => handleUpdateStatus(o, "delivered")}>🎉 Mark Delivered</button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ===== Tab 3: Products Manager ===== */}
      {activeTab === "products" && (
        <div className="tab-content">
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

          {/* Responsive product cards for mobile — table for desktop */}
          <div className="product-cards-grid">
            {filteredProducts.map((p) => (
              <div key={p.id} className="product-admin-card">
                <img src={p.imageUrl} alt={p.name} className="product-admin-thumb" loading="lazy" onError={handleImgError} />
                <div className="product-admin-info">
                  <div className="product-admin-name">{p.name}</div>
                  <div className="product-admin-cat">
                    {p.category}{p.isLoose && " · ⚖️ Loose"}
                  </div>
                  <div className="product-admin-prices">
                    <span className="price-sell">₹{p.price}{p.isLoose && "/kg"}</span>
                    {p.mrp > p.price && <span className="price-mrp">₹{p.mrp}{p.isLoose && "/kg"}</span>}
                    <span className={p.stock > 0 ? "in-stock" : "out-stock"}>
                      {p.stock > 0 ? `${p.stock} left` : "Out"}
                    </span>
                  </div>
                </div>
                <div className="product-admin-actions">
                  <Link to={`/admin/edit-product/${p.id}`} className="edit-btn">Edit</Link>
                  <button className="delete-btn" onClick={() => handleDelete(p.id)}>Del</button>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && <p className="no-results">No products found</p>}
          </div>
        </div>
      )}

      {/* ===== Tab 4: Analytics ===== */}
      {activeTab === "analytics" && (
        <div className="tab-content">
          <div className="filter-chips">
            {["daily", "weekly", "monthly", "yearly"].map((range) => (
              <button
                key={range}
                onClick={() => setAnalyticsRange(range)}
                className={`filter-chip ${analyticsRange === range ? "active" : ""}`}
                style={{ textTransform: "capitalize" }}
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

          {/* Scrollable analytics table */}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {analyticsOrders.map((o) => (
                  <tr key={o.id}>
                    <td>{o.createdAt?.toDate ? o.createdAt.toDate().toLocaleDateString("en-IN") : "-"}</td>
                    <td>{o.customerName}</td>
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
