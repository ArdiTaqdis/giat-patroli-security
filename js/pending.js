const scriptURL =
  "https://script.google.com/macros/s/AKfycbxy9J8w86sn_5mctVRQNpGX7BK-XRhXMoid7PgsYDdOPOx1z3QVn2iyfc5oal4sOS9dyA/exec";

document.addEventListener("DOMContentLoaded", () => {
  renderPending();
});

// Ambil array data pending dari localStorage
function getPending() {
  const raw = localStorage.getItem("pendingPatroli");
  return raw ? JSON.parse(raw) : [];
}

// Simpan ulang ke localStorage setelah perubahan
function savePending(data) {
  localStorage.setItem("pendingPatroli", JSON.stringify(data));
}

// Tampilkan tabel
function renderPending() {
  const tbody = document.querySelector("#pendingTable tbody");
  tbody.innerHTML = "";

  const data = getPending();

  if (data.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; color:#777; padding:20px;">
          ✅ Tidak ada data pending
        </td>
      </tr>
    `;
    return;
  }

  data.forEach((item, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.area}</td>
      <td>${item.tanggal}</td>
      <td>${item.jam}</td>
      <td>${item.nama}</td>
      <td><span class="badge badge-pending">Pending</span></td>
      <td>
        <button class="btn btn-detail" onclick="lihatFoto(${i})">Lihat Foto</button>
        <button class="btn btn-kirim" onclick="kirimData(${i})">Kirim</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// Lihat foto dalam popup
function lihatFoto(index) {
  const data = getPending();
  const item = data[index];
  if (!item) return;

  const w = window.open("", "_blank");
  w.document.write(`
    <html>
      <head><title>Foto Area ${item.area}</title></head>
      <body style="margin:0;display:flex;align-items:center;justify-content:center;background:#111;">
        <img src="${item.foto}" style="max-width:100%;max-height:100%;" />
      </body>
    </html>
  `);
}

// Kirim data ke Apps Script
async function kirimData(index) {
  const data = getPending();
  const item = data[index];
  if (!item) return;

  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet. Coba lagi saat online.");
    return;
  }

  if (!confirm(`Kirim data patroli Area ${item.area}?`)) return;

  try {
    const btn = document.querySelectorAll(".btn-kirim")[index];
    btn.disabled = true;
    btn.textContent = "Mengirim...";

    const res = await fetch(scriptURL, {
      method: "POST",
      body: new URLSearchParams({
        action: "patroliArea",
        nip: item.nip,
        nama: item.nama,
        perusahaan: item.perusahaan,
        tanggal: item.tanggal,
        jam: item.jam,
        lokasi: item.lokasi,
        area: item.area,
        foto: item.foto,
        keterangan: item.keterangan,
      }),
    });

    const result = await res.json();

    if (result.status === "success") {
      // Hapus item yang berhasil dikirim
      data.splice(index, 1);
      savePending(data);
      alert(`✅ Data Area ${item.area} berhasil dikirim!`);
      renderPending();
    } else {
      alert("❌ Gagal mengirim data ke server.");
      btn.disabled = false;
      btn.textContent = "Kirim";
    }
  } catch (err) {
    console.error(err);
    alert("❌ Terjadi kesalahan koneksi: " + err.message);
  }
}
