const scriptURL =
  "https://script.google.com/macros/s/AKfycbwtaAZo5vpN1ouMBGkWq7b673O5-wTCfcCf-ANtcBQ2IW3BMu6lDQORMIzP7527hG5wiQ/exec";

document.addEventListener("DOMContentLoaded", () => {
  renderPending();
});

// 🔑 Ambil semua data patroliArea* dari localStorage
function getPending() {
  const arr = [];
  for (let i = 1; i <= 5; i++) {
    const raw = localStorage.getItem(`patroliArea${i}`);
    if (raw) {
      const obj = JSON.parse(raw);
      arr.push({ ...obj, area: i });
    }
  }
  return arr;
}

// 🔑 Tampilkan data ke tabel
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
      </tr>`;
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
        <button class="btn btn-kirim" onclick="kirimData(${i}, this)">Kirim</button>

      </td>`;
    tbody.appendChild(tr);
  });
}

// 🔎 Lihat foto
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

// 🚀 Kirim data ke Apps Script
async function kirimData(index, el) {
  const data = getPending();
  const item = data[index];
  if (!item) return;

  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet. Coba lagi saat online.");
    return;
  }

  if (!confirm(`Kirim data patroli Area ${item.area}?`)) return;

  try {
    // 👉 el adalah tombol yang ditekan, bukan semua tombol
    el.disabled = true;
    el.textContent = "Mengirim...";
    showLoading();

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
    hideLoading();

    if (result.status === "success") {
      localStorage.removeItem(`patroliArea${item.area}`);
      alert(`✅ Data Area ${item.area} berhasil dikirim!`);
      renderPending();
      if (getPending().length === 0) showSuccessOverlay();
    } else {
      alert("❌ Gagal mengirim data ke server.");
      el.disabled = false;
      el.textContent = "Kirim";
    }
  } catch (err) {
    console.error(err);
    alert("❌ Terjadi kesalahan koneksi: " + err.message);
    el.disabled = false;
    el.textContent = "Kirim";
  }
}

function showSuccessOverlay() {
  document.getElementById("successOverlay").style.display = "flex";
}
function closeOverlay() {
  document.getElementById("successOverlay").style.display = "none";
}

// 🚀 Kirim Semua Data Sekaligus
async function kirimSemua() {
  const data = getPending();
  if (data.length === 0) {
    alert("✅ Tidak ada data pending.");
    return;
  }

  if (!navigator.onLine) {
    alert("⚠️ Tidak ada koneksi internet.");
    return;
  }

  if (!confirm(`Kirim semua (${data.length}) data patroli ke server?`)) return;

  try {
    showLoading();
    for (let i = 0; i < data.length; i++) {
      const item = data[i];

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

      if (result.status !== "success") {
        hideLoading();
        alert(`❌ Gagal kirim Area ${item.area}. Pengiriman dihentikan.`);
        return;
      }
    }

    // ✅ Semua sukses → hapus semua key
    for (let i = 1; i <= 5; i++) {
      localStorage.removeItem(`patroliArea${i}`);
    }

    renderPending();
    hideLoading(); // ✅ Tutup overlay setelah semua selesai
    showSuccessOverlay(); // ✅ Tampilkan notifikasi sukses
  } catch (err) {
    hideLoading();
    console.error(err);
    alert("❌ Terjadi kesalahan koneksi: " + err.message);
  }
}

function showLoading() {
  document.getElementById("loadingOverlay").style.display = "flex";
}
function hideLoading() {
  document.getElementById("loadingOverlay").style.display = "none";
}
