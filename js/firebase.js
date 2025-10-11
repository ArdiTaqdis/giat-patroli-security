// js/firebase.js
// =======================================================
// Modul Firebase versi modular - satu-satunya entry point
// =======================================================

// 1️⃣ Import SDK utama
import {
  initializeApp,
  getApps,
  getApp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";

// 2️⃣ Import layanan Firebase yang kamu pakai
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getMessaging } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// ⚙️ Konfigurasi Firebase project kamu
const firebaseConfig = {
  apiKey: "AIzaSyBty3q_OQ2S9qiySVzvhmzZ0s-4a9apkeA",
  authDomain: "giat-scurity.firebaseapp.com",
  projectId: "giat-scurity",
  storageBucket: "giat-scurity.appspot.com", // ✅ FIXED
  messagingSenderId: "232009137941",
  appId: "1:232009137941:web:57b823041667d069c9731c",
  measurementId: "G-Y46J2KLERE",
};

// 🔥 Inisialisasi Firebase hanya sekali
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// 💾 Inisialisasi service yang dipakai
const db = getFirestore(app);
const storage = getStorage(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// 🚀 Export supaya bisa dipakai di file lain
export { db, storage, auth, messaging };
