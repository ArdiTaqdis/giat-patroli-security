const URL_SCRIPT = "https://script.google.com/macros/s/AKfycbxo_sSPR947diVTmBCpMUOtIPAyCZMu24VN9qsecOqm33QakQ2Tg6JwjExovx64UaOwMA/exec";

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
        action: "registerUser", // ✅ tambahkan ini agar dikenali di Code.gs
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
