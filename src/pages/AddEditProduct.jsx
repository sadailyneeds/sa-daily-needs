// src/pages/AddEditProduct.jsx
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../firebase/config";
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
          });
        }
      })();
    }
  }, [id, isEdit]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (e.target.name === "imageUrl") setImgError(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        mrp: Number(form.mrp || form.price),
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

  const discountPct =
    form.mrp && form.price ? Math.round(100 - (Number(form.price) / Number(form.mrp)) * 100) : 0;

  return (
    <div className="admin-page">
      <h1>{isEdit ? "Edit Product" : "Add New Product"}</h1>

      <form className="product-form" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="form-left">
            <label>Product Name</label>
            <input name="name" value={form.name} onChange={handleChange} required />

            <label>Category</label>
            <input
              name="category"
              placeholder="e.g. Vegetables, Dairy, Snacks"
              value={form.category}
              onChange={handleChange}
              required
            />

            <label>Unit</label>
            <input
              name="unit"
              placeholder="e.g. 1 kg, 500 g, 1 pc"
              value={form.unit}
              onChange={handleChange}
            />

            <div className="price-fields">
              <div>
                <label>Selling Price (₹)</label>
                <input type="number" name="price" value={form.price} onChange={handleChange} required />
              </div>
              <div>
                <label>MRP (₹)</label>
                <input type="number" name="mrp" value={form.mrp} onChange={handleChange} />
              </div>
              <div>
                <label>Stock Qty</label>
                <input type="number" name="stock" value={form.stock} onChange={handleChange} />
              </div>
            </div>
            {discountPct > 0 && <p className="discount-hint">Customer sees: {discountPct}% OFF</p>}

            <label>Description</label>
            <textarea name="description" rows={3} value={form.description} onChange={handleChange} />
          </div>

          <div className="form-right">
            <label>Product Image URL</label>
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
                  {imgError ? "⚠️ இந்த URL-ல image காட்டல" : "இங்க preview தெரியும்"}
                </span>
              )}
            </div>
            <input
              type="url"
              name="imageUrl"
              placeholder="https://example.com/image.jpg"
              value={form.imageUrl}
              onChange={handleChange}
              required
            />
            <p className="upload-hint">
              💡 Google Images-ல product photo தேடுங்க → Right-click → "Copy image address" →
              இங்க paste பண்ணுங்க. எந்த size image-ஆ இருந்தாலும் square box-ல auto fit ஆகி காட்டும்.
            </p>
          </div>
        </div>

        <button type="submit" className="btn-primary-admin" disabled={saving}>
          {saving ? "Saving..." : isEdit ? "Update Product" : "Add Product"}
        </button>
      </form>
    </div>
  );
}
