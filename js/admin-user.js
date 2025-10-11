import { db } from "./firebase.js";
import {
  doc,
  setDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const URL_SCRIPT =
  "https://script.google.com/macros/s/AKfycby8U89tcuR-MI-t4VNUb2w5GuD9ic3Fgl99PYVwdC7jQN2mPMGRTGxauYfGs6VEY2sL/exec"; // Apps Script WebApp URL

document
  .getElementById("formUser")
  .addEventListener("submit", async function (e) {
    e.preventDefault();

    const nip = document.getElementById("nip").value.trim();
    const nama = document.getElementById("nama").value.trim();
    const perusahaan = document.getElementById("perusahaan").value.trim();
    const fotoBase64 = localStorage.getItem("fotoUser");

    if (!nip || !nama || !perusahaan || !fotoBase64) {
      document.getElementById("statusUser").innerText =
        "❌ Semua data wajib diisi termasuk foto.";
      return;
    }

    document.getElementById("statusUser").innerText =
      "⏳ Upload foto ke Google Drive...";

    try {
      // Upload foto ke Google Drive lewat Apps Script
      const res = await fetch(URL_SCRIPT, {
        method: "POST",
        body: new URLSearchParams({
          action: "uploadFoto",
          file: fotoBase64,
          nama: nip + ".jpg",
        }),
      });
      const result = await res.json();

      if (result.status !== "success") throw new Error(result.message);

      const fotoUrl = result.url; // link foto di Drive

      // Simpan data user ke Firestore
      await setDoc(doc(db, "dataUser", nip), {
        nama,
        perusahaan,
        fotoUrl,
        timestamp: new Date(),
      });

      document.getElementById("statusUser").innerText =
        "✅ User berhasil disimpan!";
      document.getElementById("formUser").reset();
      localStorage.removeItem("fotoUser");
      document.getElementById("fotoUserPreview").style.display = "none";
      document.getElementById("infoPreview").style.display = "block";
    } catch (err) {
      console.error("❌ Error:", err);
      document.getElementById("statusUser").innerText =
        "❌ Gagal menyimpan user: " + err.message;
    }
  });

document
  .getElementById("btnUploadFoto")
  .addEventListener("click", uploadFotoUser);

function uploadFotoUser() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment";

  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function (e) {
      const base64 = e.target.result;
      localStorage.setItem("fotoUser", base64);

      const img = document.getElementById("fotoUserPreview");
      img.src = base64;
      img.style.display = "block";
      document.getElementById("infoPreview").style.display = "none";
    };
    reader.readAsDataURL(file);
  };

  input.click();
}
