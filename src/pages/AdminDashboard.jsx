// src/pages/AdminDashboard.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, onSnapshot, deleteDoc, doc, query } from "firebase/firestore";
import { db } from "../firebase/config";
import "../styles/admin.css";

export default function AdminDashboard() {
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  useEffect(() => {
    const unsubP = onSnapshot(query(collection(db, "products")), (snap) =>
      setProducts(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubO = onSnapshot(query(collection(db, "orders")), (snap) =>
      setOrders(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    const unsubU = onSnapshot(query(collection(db, "users")), (snap) =>
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    );
    return () => {
      unsubP();
      unsubO();
      unsubU();
    };
  }, []);

  const revenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  const categories = ["all", ...new Set(products.map((p) => p.category).filter(Boolean))];

  const filteredProducts = products.filter((p) => {
    const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === "all" || p.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const handleDelete = async (id) => {
    if (window.confirm("இந்த product-ஐ delete பண்ணணுமா?")) {
      await deleteDoc(doc(db, "products", id));
    }
  };

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Store Owner Dashboard</h1>
        <div className="admin-header-actions">
          <Link to="/admin/notifications" className="btn-outline">🔔 Orders</Link>
          <Link to="/admin/add-product" className="btn-primary-admin">+ Add Product</Link>
        </div>
      </div>

      {/* Stats cards */}
      <div className="stats-grid">
        <div className="stat-card gold">
          <span className="stat-label">Products</span>
          <span className="stat-value">{products.length}</span>
        </div>
        <div className="stat-card green">
          <span className="stat-label">Orders</span>
          <span className="stat-value">{orders.length}</span>
        </div>
        <div className="stat-card black">
          <span className="stat-label">Users</span>
          <span className="stat-value">{users.length}</span>
        </div>
        <div className="stat-card revenue">
          <span className="stat-label">Revenue</span>
          <span className="stat-value">₹{revenue.toLocaleString("en-IN")}</span>
        </div>
      </div>

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
                <td><img src={p.imageUrl} alt={p.name} className="admin-thumb" /></td>
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
  );
}
