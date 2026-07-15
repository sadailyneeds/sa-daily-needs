// src/App.jsx
import { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
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

// Guards admin-only routes; redirects non-admins away
function AdminRoute({ children }) {
  const { isAdmin, loading } = useAuth();
  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  return isAdmin ? children : <Navigate to="/" replace />;
}

// Guards routes that need a logged-in user (checkout, profile)
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <p style={{ padding: 20 }}>Loading...</p>;
  return user ? children : <Navigate to="/login" replace />;
}

function AppRoutes() {
  const [cart, setCart] = useState([]);

  const addToCart = (product) =>
    setCart((prev) => [...prev, { ...product, qty: 1 }]);

  const increaseQty = (product) =>
    setCart((prev) => prev.map((c) => (c.id === product.id ? { ...c, qty: c.qty + 1 } : c)));

  const decreaseQty = (product) =>
    setCart((prev) =>
      prev
        .map((c) => (c.id === product.id ? { ...c, qty: c.qty - 1 } : c))
        .filter((c) => c.qty > 0)
    );

  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((sum, c) => sum + c.qty, 0);

  return (
    <BrowserRouter>
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
      </Routes>
    </BrowserRouter>
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
