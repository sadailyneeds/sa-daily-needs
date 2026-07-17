// src/pages/AddEditProduct.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
import { STORE_CATEGORIES } from "../constants/categories";
import "../styles/admin.css";

const emptyForm = {
  name: "",
  category: "",
  unit: "",
  price: "",
  mrp: "",
  stock: "",
  description: "",
  imageUrl: "",
  // Flexible Weight Selection (loose grocery products only)
  isLoose: false,
  pricePerKg: "",
  mrpPerKg: "",
};

export default function AddEditProduct() {
  const { id } = useParams(); // present only when editing
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (isEdit) {
      (async () => {
        const snap = await getDoc(doc(db, "products", id));
        if (snap.exists()) {
          const data = snap.data();
          setForm({
            name: data.name || "",
            category: data.category || "",
            unit: data.unit || "",
            price: data.price || "",
            mrp: data.mrp || "",
            stock: data.stock || "",
            description: data.description || "",
            imageUrl: data.imageUrl || "",
            isLoose: Boolean(data.isLoose),
            pricePerKg: data.pricePerKg || "",
            mrpPerKg: data.mrpPerKg || "",
          });
        }
      })();
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    const { name, type, value, checked } = e.target;
    setForm({ ...form, [name]: type === "checkbox" ? checked : value });
    if (name === "imageUrl") setImgError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const isLoose = Boolean(form.isLoose);
      // For loose products, the customer's final price is computed at cart-time
      // from Base Price Per Kg × selected weight. We still keep `price`/`mrp`
      // populated (mirrored from the per-kg values) so existing card/discount/
      // sorting logic elsewhere in the app keeps working unchanged.
      const payload = {
        ...form,
        isLoose,
        pricePerKg: isLoose ? Number(form.pricePerKg || 0) : "",
        mrpPerKg: isLoose ? Number(form.mrpPerKg || form.pricePerKg || 0) : "",
        unit: isLoose ? "Sold by weight (per kg)" : form.unit,
        price: isLoose ? Number(form.pricePerKg || 0) : Number(form.price),
        mrp: isLoose ? Number(form.mrpPerKg || form.pricePerKg || 0) : Number(form.mrp || form.price),
        stock: Number(form.stock || 0),
        updatedAt: serverTimestamp(),
      };

      if (isEdit) {
        await updateDoc(doc(db, "products", id), payload);
      } else {
        await addDoc(collection(db, "products"), { ...payload, createdAt: serverTimestamp() });
      }

      navigate("/admin");
    } catch (err) {
      console.error(err);
      alert("Save பண்ண முடியல. மறுபடியும் try பண்ணுங்க.");
    } finally {
      setSaving(false);
    }
  };

  const effectivePrice = form.isLoose ? form.pricePerKg : form.price;
  const effectiveMrp = form.isLoose ? form.mrpPerKg : form.mrp;
  const discountPct =
    effectiveMrp && effectivePrice
      ? Math.round(100 - (Number(effectivePrice) / Number(effectiveMrp)) * 100)
      : 0;

  return (
    <div className="admin-page">
      <h1 style={{ fontSize: "18px", fontWeight: "800", margin: "0 0 16px" }}>
        {isEdit ? "✏️ Edit Product" : "➕ Add New Product"}
      </h1>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          {/* Left column: all text fields */}
          <div className="form-left">
            <label>Product Name *</label>
            <input
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Toor Dal"
              required
            />

            <label>Category *</label>
            {/* Dropdown with all store categories for consistency */}
            <select name="category" value={form.category} onChange={handleChange} required>
              <option value="">-- Select Category --</option>
              {STORE_CATEGORIES.map((cat) => (
                <option key={cat.key} value={cat.key}>
                  {cat.icon} {cat.key}
                </option>
              ))}
            </select>

            {/* Loose vs Packaged toggle — drives whether customers get a
                weight selector (e.g. Rice, Dal, Sugar) or a fixed pack size
                (e.g. Biscuits, Oil Bottles, Soap). */}
            <label style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "14px" }}>
              <input
                type="checkbox"
                name="isLoose"
                checked={form.isLoose}
                onChange={handleChange}
                style={{ width: "auto" }}
              />
              ⚖️ Loose Product (sold by weight — customer picks 100g to 50kg)
            </label>

            {!form.isLoose && (
              <>
                <label>Unit</label>
                <input
                  name="unit"
                  placeholder="e.g. 1 kg, 500 g, 1 pc, 6 pcs"
                  value={form.unit}
                  onChange={handleChange}
                />
              </>
            )}

            {form.isLoose ? (
              // Loose product pricing — everything the customer pays is
              // computed from this Base Price Per Kg × selected weight.
              <div className="price-fields">
                <div>
                  <label>Base Price Per Kg (₹) *</label>
                  <input
                    type="number"
                    name="pricePerKg"
                    value={form.pricePerKg}
                    onChange={handleChange}
                    placeholder="e.g. 200"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label>MRP Per Kg (₹)</label>
                  <input
                    type="number"
                    name="mrpPerKg"
                    value={form.mrpPerKg}
                    onChange={handleChange}
                    placeholder="e.g. 220"
                    min="0"
                  />
                </div>
                <div>
                  <label>Stock Qty (kg)</label>
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            ) : (
              /* Price / MRP / Stock — stacked on mobile, 3-col on wider screens */
              <div className="price-fields">
                <div>
                  <label>Selling Price (₹) *</label>
                  <input
                    type="number"
                    name="price"
                    value={form.price}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                    required
                  />
                </div>
                <div>
                  <label>MRP (₹)</label>
                  <input
                    type="number"
                    name="mrp"
                    value={form.mrp}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
                <div>
                  <label>Stock Qty</label>
                  <input
                    type="number"
                    name="stock"
                    value={form.stock}
                    onChange={handleChange}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>
            )}
            {discountPct > 0 && (
              <p className="discount-hint">🏷️ Customer sees: {discountPct}% OFF</p>
            )}

            <label>Description</label>
            <textarea
              name="description"
              rows={3}
              value={form.description}
              onChange={handleChange}
              placeholder="Short product description..."
            />
          </div>

          {/* Right column: image */}
          <div className="form-right">
            <label>Product Image URL *</label>
            <div className="image-upload-box">
              {form.imageUrl && !imgError ? (
                <img
                  src={form.imageUrl}
                  alt="preview"
                  className="image-preview"
                  onError={() => setImgError(true)}
                />
              ) : (
                <span className="upload-placeholder">
                  {imgError ? "⚠️ Image load failed" : "📷 Image preview here"}
                </span>
              )}
            </div>
            <input
              type="url"
              name="imageUrl"
              placeholder="https://example.com/product.jpg"
              value={form.imageUrl}
              onChange={handleChange}
              required
            />
            <p className="upload-hint">
              💡 Google Images → Right-click → "Copy image address" → paste here.
              Any size image auto-fits the square box.
            </p>
          </div>
        </div>

        <button
          type="submit"
          className="btn-primary-admin"
          disabled={saving}
          style={{ marginTop: "20px", width: "100%", padding: "14px", fontSize: "15px" }}
        >
          {saving ? "Saving..." : isEdit ? "✅ Update Product" : "✅ Add Product"}
        </button>
      </form>
    </div>
  );
}
