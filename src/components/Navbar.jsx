// src/components/Navbar.jsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import { LANGUAGES } from "../i18n/translations";
import logo from "../assets/logo.png";
import "../styles/navbar.css";

export default function Navbar({ cartCount = 0 }) {
  const { user, profile, isAdmin } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [desktopSearch, setDesktopSearch] = useState("");
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  const currentLangLabel = LANGUAGES.find((l) => l.code === lang)?.label;

  // Realtime badge on the Admin link so a store owner sees new orders
  // instantly no matter which page they're on.
  useEffect(() => {
    if (!isAdmin) return;
    const unsub = onSnapshot(collection(db, "notifications"), (snap) => {
      setUnreadNotifCount(snap.docs.filter((d) => !d.data().read).length);
    });
    return unsub;
  }, [isAdmin]);

  const handleDesktopSearch = (e) => {
    e.preventDefault();
    navigate(`/?q=${encodeURIComponent(desktopSearch.trim())}`);
  };

  const scrollToCategories = (e) => {
    if (window.location.pathname !== "/") return; // let the Link navigate normally
    e.preventDefault();
    document.getElementById("categories")?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="SA Store Daily Needs" className="navbar-logo" />
        <div className="navbar-brand-text">
          <span className="navbar-title">{t("appName")}</span>
          <span className="navbar-tagline">{t("tagline")}</span>
        </div>
      </Link>

      {/* Desktop-only: search + quick categories link (hidden on mobile via CSS) */}
      <form className="navbar-search-desktop" onSubmit={handleDesktopSearch}>
        <input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={desktopSearch}
          onChange={(e) => setDesktopSearch(e.target.value)}
        />
        <button type="submit" aria-label="Search">🔍</button>
      </form>
      <a href="/#categories" className="navbar-link navbar-categories-link" onClick={scrollToCategories}>
        {t("categories")}
      </a>

      <div className="navbar-actions">
        <Link to="/cart" className="navbar-cart">
          🛒
          {cartCount > 0 && <span className="cart-badge">{cartCount}</span>}
        </Link>

        {user ? (
          <button className="navbar-profile" onClick={() => navigate("/profile")}>
            👤 {profile?.name?.split(" ")[0] || t("profile")}
          </button>
        ) : (
          <button className="navbar-login" onClick={() => navigate("/login")}>
            {t("login")}
          </button>
        )}

        {isAdmin && (
          <Link to="/admin" className="navbar-link admin-link" style={{ position: "relative" }}>
            {t("admin")}
            {unreadNotifCount > 0 && <span className="cart-badge">{unreadNotifCount}</span>}
          </Link>
        )}

        {/* Language switcher - Tamil is default, more languages can be added */}
        <div className="lang-switcher">
          <button className="lang-btn" onClick={() => setShowLangMenu((v) => !v)}>
            🌐 {currentLangLabel}
          </button>
          {showLangMenu && (
            <div className="lang-dropdown">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  className={`lang-option ${lang === l.code ? "active" : ""}`}
                  onClick={() => {
                    setLang(l.code);
                    setShowLangMenu(false);
                  }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
