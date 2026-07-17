// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDg-9qTAx6vpGGuioH6vRN6nRbB0IN2GaI",
  authDomain: "sa-daily-needs-4c8f0.firebaseapp.com",
  projectId: "sa-daily-needs-4c8f0",
  storageBucket: "sa-daily-needs-4c8f0.firebasestorage.app",
  messagingSenderId: "1035116134433",
  appId: "1:1035116134433:web:8344efb8d3e24739072360"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
