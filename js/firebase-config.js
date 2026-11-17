/**
 * =====================================================
 * طوابير (Tawabeer) — Firebase Configuration
 * Project: tawabeer-e1923
 * =====================================================
 */

const firebaseConfig = {
  apiKey: "AIzaSyANQ2byxVArn9hvDI-4UveOSmRubtDMHtw",
  authDomain: "tawabeer-e1923.firebaseapp.com",
  projectId: "tawabeer-e1923",
  storageBucket: "tawabeer-e1923.firebasestorage.app",
  messagingSenderId: "66806509776",
  appId: "1:66806509776:web:6f2f185c0e7a21b1e4eed5"
};

export const isFirebaseConfigured = true;

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("%c[طوابير] Firebase متصل — tawabeer-e1923", "color:#0d9488;font-weight:bold");

export { app, auth, db, firebaseConfig };
