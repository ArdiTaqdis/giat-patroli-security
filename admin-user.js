const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbw28RQGidShXhsAQ4xrdqK5FEqoY1KyokIRVKofSmmM5WkeZNm-_awBYm965c3YlhiXRg/exec";

document.getElementById("formUser").addEventListener("submit", async function (e) {
  e.preventDefault();

  const nip = document.getElementById("nip").value.trim();
  const nama = document.getElementById("nama").value.trim();
  const perusahaan = document.getElementById("perusahaan").value.trim();
  const fotoBase64 = localStorage.getItem("fotoUser");

  if (!fotoBase64) {
    document.getElementById("statusUser").innerText = "❌ Upload foto terlebih dahulu.";
    return;
  }

  try {
    const res = await fetch(URL_SCRIPT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        nip,
        nama,
        perusahaan,
        foto: fotoBase64
      }),
    });

    const text = await res.text();
    document.getElementById("statusUser").innerText = text;
    document.getElementById("formUser").reset();
    document.getElementById("previewFotoUser").innerText = "Belum ada foto";
    localStorage.removeItem("fotoUser");
  } catch (err) {
    console.error("❌ Gagal kirim:", err);
    document.getElementById("statusUser").innerText = "❌ Gagal mengirim data.";
  }
});

function uploadFotoUser() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  input.capture = "environment"; // kamera belakang (untuk mobile)

  input.onchange = function () {
    const file = input.files[0];
    if (!file) return;

    if (!validateSizeBeforeCompress(file, 6)) return;

    compressAndSaveImage(file, "previewFotoUser", "fotoUser");
  };

  input.click();
}
