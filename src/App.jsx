// src/App.jsx
import { useState } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { LanguageProvider } from "./context/LanguageContext";
import Navbar from "./components/Navbar";
import Home from "./pages/Home";
import AuthOtp from "./pages/AuthOtp";
import Cart from "./pages/Cart";
import Profile from "./pages/Profile";
import Checkout from "./pages/Checkout";
import AdminDashboard from "./pages/AdminDashboard";
import AddEditProduct from "./pages/AddEditProduct";
import AdminNotifications from "./pages/AdminNotifications";
import "./styles/theme.css";

// Full-screen loading spinner shown while Firebase resolves auth state
function LoadingScreen() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      height: "100vh",
      background: "var(--bg)",
      flexDirection: "column",
      gap: "16px",
    }}>
      <div style={{
        width: "40px",
        height: "40px",
        border: "4px solid #f0f0f0",
        borderTop: "4px solid var(--gold)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }} />
      <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: 0 }}>Loading...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// Guards admin-only routes; redirects non-admins away
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return isAdmin ? children : <Navigate to="/" replace />;
}

// Guards routes that need a logged-in user (checkout, profile)
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const [cart, setCart] = useState([]);

  // For loose (weight-based) products, the same product can sit in the cart
  // as separate lines per selected weight (e.g. 250g and 500g of Basmati
  // Rice). Packaged products never carry a `weight`, so this matches by id
  // alone for them — identical to the previous behavior.
  const isSameCartLine = (c, product) => c.id === product.id && (c.weight || null) === (product.weight || null);

  const addToCart = (product) =>
    setCart((prev) => {
      const existing = prev.find((c) => isSameCartLine(c, product));
      if (existing) return prev.map((c) => isSameCartLine(c, product) ? { ...c, qty: c.qty + 1 } : c);
      return [...prev, { ...product, qty: 1 }];
    });

  const increaseQty = (product) =>
    setCart((prev) => prev.map((c) => (isSameCartLine(c, product) ? { ...c, qty: c.qty + 1 } : c)));

  const decreaseQty = (product) =>
    setCart((prev) =>
      prev
        .map((c) => (isSameCartLine(c, product) ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0)
    );

  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  return (
    // HashRouter uses URL hashes (#/route) — works in Capacitor's file:// WebView
    // AND in standard browser. BrowserRouter fails in APK because there's no
    // web server to handle history-based navigation.
    <HashRouter>
      <Navbar cartCount={cartCount} />
      <Routes>
        <Route
          path="/"
          element={
            <Home cart={cart} addToCart={addToCart} increaseQty={increaseQty} decreaseQty={decreaseQty} />
          }
        />
        <Route path="/login" element={<AuthOtp />} />

        <Route
          path="/cart"
          element={<Cart cart={cart} increaseQty={increaseQty} decreaseQty={decreaseQty} />}
        />

        <Route
          path="/profile"
          element={
            <PrivateRoute>
              <Profile />
            </PrivateRoute>
          }
        />

        <Route
          path="/checkout"
          element={
            <PrivateRoute>
              <Checkout cart={cart} clearCart={clearCart} />
            </PrivateRoute>
          }
        />

        <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
        <Route path="/admin/add-product" element={<AdminRoute><AddEditProduct /></AdminRoute>} />
        <Route path="/admin/edit-product/:id" element={<AdminRoute><AddEditProduct /></AdminRoute>} />
        <Route path="/admin/notifications" element={<AdminRoute><AdminNotifications /></AdminRoute>} />

        {/* Catch-all: redirect unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </LanguageProvider>
  );
}
