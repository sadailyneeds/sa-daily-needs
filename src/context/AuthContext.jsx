// src/context/AuthContext.jsx
// Uses phone number as the login identifier, but under the hood it's
// Firebase Email/Password auth (free on Spark plan - no SMS/Blaze needed).
// The customer NEVER sees or types an email; we generate one from their phone.
import { createContext, useContext, useEffect, useState } from "react";
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase/config";

const AuthContext = createContext();
export const useAuth = () => useContext(AuthContext);

// Converts "9876543210" -> "9876543210@sastore.app" (internal use only)
const phoneToPseudoEmail = (phone) => `${phone.replace(/\D/g, "")}@sastore.app`;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null); // Firestore user doc (name, role, etc.)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const snap = await getDoc(doc(db, "users", firebaseUser.uid));
        setProfile(snap.exists() ? snap.data() : null);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  // Register a new customer: Name + Phone Number + Password
  const registerWithPhone = async (phone, password, name) => {
    const pseudoEmail = phoneToPseudoEmail(phone);
    const result = await createUserWithEmailAndPassword(auth, pseudoEmail, password);
    const firebaseUser = result.user;

    const userRef = doc(db, "users", firebaseUser.uid);
    await setDoc(userRef, {
      uid: firebaseUser.uid,
      phone: `+91${phone.replace(/\D/g, "")}`,
      name: name || "",
      role: "customer", // change manually in Firestore to "admin" for store owner
      createdAt: serverTimestamp(),
    });

    const snap = await getDoc(userRef);
    const profileData = snap.data();
    setProfile(profileData);
    return { user: firebaseUser, profile: profileData };
  };

  // Login an existing customer: Phone Number + Password
  const loginWithPhone = async (phone, password) => {
    const pseudoEmail = phoneToPseudoEmail(phone);
    const result = await signInWithEmailAndPassword(auth, pseudoEmail, password);
    const firebaseUser = result.user;

    const userRef = doc(db, "users", firebaseUser.uid);
    const snap = await getDoc(userRef);
    const profileData = snap.data();
    setProfile(profileData);
    return { user: firebaseUser, profile: profileData };
  };

  const logout = () => auth.signOut();

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        registerWithPhone,
        loginWithPhone,
        logout,
        isAdmin: profile?.role === "admin",
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
