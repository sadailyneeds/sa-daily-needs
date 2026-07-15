// src/firebase/config.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDIq6mdyVWs_cBMg3io2i389vI_-G_edT0",
  authDomain: "sa-daily-needs.firebaseapp.com",
  projectId: "sa-daily-needs",
  storageBucket: "sa-daily-needs.firebasestorage.app",
  messagingSenderId: "154728616426",
  appId: "1:154728616426:web:488ccd00fbcfc6535ca293",
  measurementId: "G-JV6WHNN055",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export default app;
