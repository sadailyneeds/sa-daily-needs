// src/pages/AuthOtp.jsx
// Register / Login using Phone Number + Password (100% free, no SMS cost)
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useLanguage } from "../context/LanguageContext";
import "../styles/auth.css";

export default function AuthOtp() {
  const { registerWithPhone, loginWithPhone } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [mode, setMode] = useState("login"); // "login" | "register"
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (phone.trim().length !== 10) {
      setError(t("invalidPhone"));
      return;
    }
    if (password.length < 6) {
      setError("Password குறைந்தது 6 characters இருக்கணும்");
      return;
    }
    if (mode === "register" && password !== confirmPassword) {
      setError("Password மற்றும் Confirm Password match ஆகல");
      return;
    }

    setLoading(true);
    try {
      const result =
        mode === "register"
          ? await registerWithPhone(phone, password, name)
          : await loginWithPhone(phone, password);
      navigate(result.profile?.role === "admin" ? "/admin" : "/");
    } catch (err) {
      console.error(err);
      if (err.code === "auth/email-already-in-use") {
        setError("இந்த phone number-ஓட account already இருக்கு. Login பண்ணுங்க.");
      } else if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password") {
        setError("Phone number அல்லது password தவறு.");
      } else if (err.code === "auth/user-not-found") {
        setError("இந்த phone number-க்கு account இல்ல. Register பண்ணுங்க.");
      } else {
        setError("ஏதோ தவறு நடந்துச்சு. மறுபடியும் try பண்ணுங்க.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-logo">{t("authTitle")}</h1>
        <p className="auth-subtitle">{t("authSubtitle")}</p>

        {/* Login / Register tabs */}
        <div className="auth-tabs">
          <button
            className={`auth-tab ${mode === "login" ? "active" : ""}`}
            onClick={() => { setMode("login"); setError(""); setPassword(""); setConfirmPassword(""); }}
            type="button"
          >
            உள்நுழைய
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => { setMode("register"); setError(""); setPassword(""); setConfirmPassword(""); }}
            type="button"
          >
            புதிய Account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label>{t("name")}</label>
              <input
                type="text"
                placeholder={t("namePlaceholder")}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </>
          )}

          <label>{t("mobileNumber")}</label>
          <div className="phone-input">
            <span>+91</span>
            <input
              type="tel"
              placeholder="9876543210"
              value={phone}
              maxLength={10}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              required
            />
          </div>

          <label>Password</label>
          <input
            type="password"
            placeholder="குறைந்தது 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {mode === "register" && (
            <>
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Password-ஐ மறுபடியும் type பண்ணுங்க"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? "..."
              : mode === "register"
              ? "Account உருவாக்கு"
              : "உள்நுழைய"}
          </button>
        </form>
      </div>
    </div>
  );
}
