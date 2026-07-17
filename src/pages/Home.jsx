// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase/config";
import ProductCard from "../components/ProductCard";
import { useLanguage } from "../context/LanguageContext";
import { STORE_CATEGORIES, getCategoryIcon } from "../constants/categories";
import logo from "../assets/logo.png";
import "../styles/home.css";

export default function Home({ cart, addToCart, increaseQty, decreaseQty }) {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState(searchParams.get("q") || "");
  const [loading, setLoading] = useState(true);

  // Desktop navbar search (?q=) can be triggered from any page - sync it in.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q !== null) setSearchTerm(q);
  }, [searchParams]);

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

  // Promo rows only show on the default (no search / all categories) view,
  // so they don't clutter filtered/search results.
  const showPromoRows = activeCategory === "all" && !searchTerm.trim();

  const offerProducts = useMemo(
    () => products.filter((p) => p.mrp > p.price).slice(0, 10),
    [products]
  );
  const newArrivals = useMemo(() => products.slice(0, 10), [products]);
  const popularPicks = useMemo(
    () =>
      [...products]
        .sort((a, b) => {
          const discA = a.mrp && a.price ? (1 - a.price / a.mrp) : 0;
          const discB = b.mrp && b.price ? (1 - b.price / b.mrp) : 0;
          return discB - discA;
        })
        .slice(0, 10),
    [products]
  );

  const renderCard = (product) => {
    const cartItem = cart.find((c) => c.id === product.id);
    return (
      <ProductCard
        key={product.id}
        product={product}
        cart={cart}
        cartQty={cartItem?.qty || 0}
        onAdd={addToCart}
        onIncrease={increaseQty}
        onDecrease={decreaseQty}
      />
    );
  };

  const scrollToProducts = () => {
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <div className="home-page">
      {/* Desktop hero banner - hidden on mobile via CSS */}
      <div className="hero-banner">
        <div className="hero-banner-inner">
          <img src={logo} alt="SA Store Daily Needs" className="hero-logo" />
          <h1 className="hero-title">{t("appName")}</h1>
          <p className="hero-tagline">{t("tagline")}</p>
          <button className="hero-shop-btn" onClick={scrollToProducts}>
            {t("shopNow")} ↓
          </button>
        </div>
      </div>

      {/* Search bar (also used on mobile; desktop has one in the Navbar too) */}
      <div className="search-bar">
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {/* Fixed store category grid with icons */}
      <div id="categories" className="category-icon-grid">
        {STORE_CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            className={`category-icon-chip ${activeCategory === cat.key ? "active" : ""}`}
            onClick={() => setActiveCategory(activeCategory === cat.key ? "all" : cat.key)}
          >
            <span className="category-icon-emoji">{cat.icon}</span>
            <span className="category-icon-label">{cat.key}</span>
          </button>
        ))}
      </div>

      {/* Category chips (all categories actually present in Firestore, incl. custom ones) */}
      <div className="category-bar">
        {categories.map((cat) => (
          <button
            key={cat}
            className={`category-chip ${activeCategory === cat ? "active" : ""}`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat === "all" ? t("all") : `${getCategoryIcon(cat)} ${cat}`}
          </button>
        ))}
      </div>

      {!loading && showPromoRows && offerProducts.length > 0 && (
        <section className="promo-row">
          <h2 className="promo-row-title">🔥 {t("specialOffers")}</h2>
          <div className="promo-row-scroll">
            {offerProducts.map((p) => (
              <div className="promo-row-item" key={p.id}>{renderCard(p)}</div>
            ))}
          </div>
        </section>
      )}

      {!loading && showPromoRows && popularPicks.length > 0 && (
        <section className="promo-row">
          <h2 className="promo-row-title">⭐ {t("popularBestSellers")}</h2>
          <div className="promo-row-scroll">
            {popularPicks.map((p) => (
              <div className="promo-row-item" key={p.id}>{renderCard(p)}</div>
            ))}
          </div>
        </section>
      )}

      {!loading && showPromoRows && newArrivals.length > 0 && (
        <section className="promo-row">
          <h2 className="promo-row-title">🆕 {t("newProducts")}</h2>
          <div className="promo-row-scroll">
            {newArrivals.map((p) => (
              <div className="promo-row-item" key={p.id}>{renderCard(p)}</div>
            ))}
          </div>
        </section>
      )}

      {/* Main product grid */}
      <h2 id="products" className="promo-row-title" style={{ marginTop: showPromoRows ? "10px" : "0" }}>
        🛒 {activeCategory === "all" ? t("allProducts") : activeCategory}
      </h2>
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
        <div className="product-grid">{filtered.map(renderCard)}</div>
      )}
    </div>
  );
}
