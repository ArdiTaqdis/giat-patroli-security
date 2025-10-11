import {
  showOverlay,
  hideOverlay,
  showSuccessOverlay,
} from "./petugas-utils.js";
import { db } from "./firebase.js";
import {
  collection,
  getDocs,
  setDoc,
  doc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CACHE_KEY = "cachePetugas";
const OFFLINE_KEY = "offlinePetugasBuffer";
export let cachedPetugas = [];

export async function fetchAndCache(silent = false, onUpdate = null) {
  const snap = await getDocs(collection(db, "dataUser"));
  cachedPetugas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  cachedPetugas.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return tb - ta; // terbaru di atas
  });
  localStorage.setItem(CACHE_KEY, JSON.stringify(cachedPetugas));

  // 🔥 panggil callback kalau dikasih dari admin-petugas.js
  if (typeof onUpdate === "function") onUpdate(cachedPetugas);

  if (!silent) showSuccessOverlay("✅ Data tersinkron dari server");
  return cachedPetugas;
}

export function loadCache() {
  const data = localStorage.getItem(CACHE_KEY);
  if (data) cachedPetugas = JSON.parse(data);
  return cachedPetugas;
}

export async function savePetugas(petugas) {
  await setDoc(doc(db, "dataUser", petugas.id), petugas);
  const idx = cachedPetugas.findIndex((p) => p.id === petugas.id);
  if (idx >= 0) cachedPetugas[idx] = petugas;
  else cachedPetugas.unshift(petugas);
  localStorage.setItem(CACHE_KEY, JSON.stringify(cachedPetugas));
}

export async function syncOfflineBuffer(scriptURL) {
  if (!navigator.onLine) return;
  const queue = JSON.parse(localStorage.getItem(OFFLINE_KEY) || "[]");
  if (queue.length === 0) return;

  showOverlay(`📡 Mengirim ${queue.length} data offline...`);
  for (const p of queue) {
    try {
      if (p.fotoBase64) {
        const res = await fetch(scriptURL, {
          method: "POST",
          body: new URLSearchParams({
            action: "uploadFotoPetugas",
            file: p.fotoBase64,
            namaFile: `${p.nip}_${Date.now()}.jpg`,
          }),
        });
        const result = await res.json();
        if (result.status === "success") p.fotoUrl = result.url;
      }
      await savePetugas(p);
    } catch (err) {
      console.error("❌ Gagal sync offline:", p.nip, err);
    }
  }
  localStorage.removeItem(OFFLINE_KEY);
  hideOverlay();
  showSuccessOverlay("✅ Semua data offline sudah terkirim!");
}
