// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../context/LanguageContext";
import "../styles/home.css";

export default function Home({ cart, addToCart, increaseQty, decreaseQty }) {
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, "products"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setProducts(items);
      const cats = ["all", ...new Set(items.map((p) => p.category).filter(Boolean))];
      setCategories(cats);
      setLoading(false);
    });
    return unsub;
  }, []);

  const filtered = products.filter((p) => {
    const matchCategory = activeCategory === "all" || p.category === activeCategory;
    const matchSearch = p.name?.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  return (
    <div className="home-page">
      {/* Search bar */}
      <div className="search-bar">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Category chips */}
      <div className="category-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-chip ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? t("all") : cat}
          </button>
        ))}
      </div>

      {/* Product grid */}
      {loading ? (
        <div className="product-grid">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton-card">
              <div className="skeleton-img" />
              <div className="skeleton-line" />
              <div className="skeleton-line short" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>{t("noProductsFound")}</p>
          <span>{t("tryDifferentCategory")}</span>
        </div>
      ) : (
        <div className="product-grid">
          {filtered.map((product) => {
            const cartItem = cart.find((c) => c.id === product.id);
            return (
              <ProductCard
                key={product.id}
                product={product}
                cartQty={cartItem?.qty || 0}
                onAdd={addToCart}
                onIncrease={increaseQty}
                onDecrease={decreaseQty}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
