// src/components/Navbar.jsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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

  const currentLangLabel = LANGUAGES.find((l) => l.code === lang)?.label;

  return (
    <header className="navbar">
      <Link to="/" className="navbar-brand">
        <img src={logo} alt="SA Store Daily Needs" className="navbar-logo" />
        <div className="navbar-brand-text">
          <span className="navbar-title">{t("appName")}</span>
          <span className="navbar-tagline">{t("tagline")}</span>
        </div>
      </Link>

      <div className="navbar-actions">
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

        {isAdmin && (
          <Link to="/admin" className="navbar-link admin-link">
            {t("admin")}
          </Link>
        )}

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
      </div>
    </header>
  );
}
