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

      // Use replace:true so the back button doesn't go back to login after auth
      navigate(result.profile?.role === "admin" ? "/admin" : "/", { replace: true });
    } catch (err) {
      // Map Firebase error codes to user-friendly Tamil/English messages
      const code = err.code || "";
      if (code === "auth/email-already-in-use") {
        setError("இந்த phone number-ஓட account already இருக்கு. Login பண்ணுங்க.");
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Phone number அல்லது password தவறு.");
      } else if (code === "auth/user-not-found") {
        setError("இந்த phone number-க்கு account இல்ல. Register பண்ணுங்க.");
      } else if (code === "auth/network-request-failed") {
        setError("Network error. Internet connection check பண்ணுங்க.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. சிறிது நேரம் கழித்து try பண்ணுங்க.");
      } else if (code === "auth/weak-password") {
        setError("Password மிகவும் weak. குறைந்தது 6 characters பயன்படுத்துங்க.");
      } else {
        setError("ஏதோ தவறு நடந்துச்சு. மறுபடியும் try பண்ணுங்க. (" + code + ")");
      }
    } finally {
      setLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError("");
    setPassword("");
    setConfirmPassword("");
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
            onClick={() => switchMode("login")}
            type="button"
          >
            உள்நுழைய
          </button>
          <button
            className={`auth-tab ${mode === "register" ? "active" : ""}`}
            onClick={() => switchMode("register")}
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
                autoComplete="name"
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
              autoComplete="tel"
              required
            />
          </div>

          <label>Password</label>
          <input
            type="password"
            placeholder="குறைந்தது 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "register" ? "new-password" : "current-password"}
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
                autoComplete="new-password"
                required
              />
            </>
          )}

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading
              ? "⏳ Please wait..."
              : mode === "register"
              ? "Account உருவாக்கு"
              : "உள்நுழைய"}
          </button>
        </form>
      </div>
    </div>
  );
}
