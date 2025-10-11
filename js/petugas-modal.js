import {
  fileToBase64,
  fetchWithTimeout,
  showOverlay,
  hideOverlay,
  showSuccessOverlay,
} from "./petugas-utils.js";
import { savePetugas } from "./petugas-sync.js";
import { db } from "./firebase.js";
import {
  getDocs,
  collection,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const scriptURL =
  "https://script.google.com/macros/s/AKfycbyNfD1Jyd26-PA0hpF-blLLwr0brWqpRNuWi7tYVXYRvVZC09aBqGY6GTV7xYon8NDC/exec";

export async function openPetugasModal(isEdit = false, petugas = null) {
  const old = document.getElementById("petugasModal");
  if (old) old.remove();

  const modal = document.createElement("div");
  modal.classList.add("modal", "fade");
  modal.id = "petugasModal";
  modal.innerHTML = `
    <div class="modal-dialog"><div class="modal-content">
      <div class="modal-header bg-primary text-white">
        <h5 class="modal-title">${isEdit ? "Edit" : "Tambah"} Petugas</h5>
        <button type="button" class="close text-white" data-dismiss="modal">&times;</button>
      </div>
      <div class="modal-body">
        <input type="hidden" id="petugasId" value="${petugas?.id || ""}">
        <div class="form-group"><label>NIP</label>
          <input type="text" id="nip" class="form-control" value="${
            petugas?.nip || ""
          }" ${isEdit ? "disabled" : ""}>
        </div>
        <div class="form-group"><label>Nama</label>
          <input type="text" id="nama" class="form-control" value="${
            petugas?.nama || ""
          }">
        </div>
        <div class="form-group"><label>Perusahaan</label>
          <select id="perusahaanSelect" class="form-control"><option>Memuat...</option></select>
        </div>
        <div class="form-group"><label>Foto Petugas</label>
          <input type="file" id="fotoFile" class="form-control" accept="image/*">
          <img id="previewFoto" src="${
            petugas?.fotoUrl || ""
          }" style="width:60px;height:60px;border-radius:50%;margin-top:8px;${
    petugas?.fotoUrl ? "display:block" : "display:none"
  };">
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" data-dismiss="modal">Batal</button>
        <button class="btn btn-primary" id="btnSavePetugas">${
          isEdit ? "Simpan Perubahan" : "Tambah Petugas"
        }</button>
      </div>
    </div></div>
  `;
  document.body.appendChild(modal);

  await loadPerusahaanDropdown(petugas?.perusahaanId || "");
  const fotoFile = modal.querySelector("#fotoFile");
  const preview = modal.querySelector("#previewFoto");
  fotoFile.onchange = () => {
    const f = fotoFile.files[0];
    if (f) {
      const r = new FileReader();
      r.onload = (e) => {
        preview.src = e.target.result;
        preview.style.display = "block";
      };
      r.readAsDataURL(f);
    }
  };

  modal.querySelector("#btnSavePetugas").onclick = async () => {
    const nip = document.getElementById("nip").value.trim();
    const nama = document.getElementById("nama").value.trim();
    const select = document.getElementById("perusahaanSelect");
    const perusahaanId = select.value;
    const perusahaanNama = select.options[select.selectedIndex]?.text || "";
    const file = document.getElementById("fotoFile");

    if (!nip || !nama || !perusahaanId) return alert("⚠️ Lengkapi semua data!");

    showOverlay("Menyimpan data...");
    let fotoUrl = petugas?.fotoUrl || "";
    try {
      if (file.files.length > 0) {
        const base64 = await fileToBase64(file.files[0]);
        const res = await fetchWithTimeout(scriptURL, {
          method: "POST",
          body: new URLSearchParams({
            action: "uploadFotoPetugas",
            file: base64,
            namaFile: `${nip}_${Date.now()}.jpg`,
          }),
        });
        const result = await res.json();
        if (result.status === "success") fotoUrl = result.url;
      }

      await savePetugas({
        id: nip,
        nip,
        nama,
        perusahaanId,
        perusahaanNama,
        fotoUrl,
        role: "petugas",
      });

      // ✅ Tutup modal & reset form
      hideOverlay();
      showSuccessOverlay("✅ Petugas disimpan!");
      setTimeout(() => {
        const modalEl = document.getElementById("petugasModal");
        if (window.$) $("#petugasModal").modal("hide");
        else if (modalEl) modalEl.remove();

        // Reset field supaya bersih kalau buka lagi
        document.getElementById("nip").value = "";
        document.getElementById("nama").value = "";
        document.getElementById("perusahaanSelect").value = "";
        const preview = document.getElementById("previewFoto");
        if (preview) preview.style.display = "none";

        // 🔥 Refresh tabel tanpa reload
        import("./admin-petugas.js").then((m) => m.loadPetugas());
      }, 800);

      hideOverlay();
      showSuccessOverlay("✅ Petugas disimpan!");
    } catch (err) {
      hideOverlay();
      alert("❌ Gagal: " + err.message);
    }
  };

  if (typeof bootstrap !== "undefined") new bootstrap.Modal(modal).show();
  else if (window.$)
    $(modal)
      .modal("show")
      .on("hidden.bs.modal", () => modal.remove());
  else modal.style.display = "block";
}

async function loadPerusahaanDropdown(selectedId = "") {
  const select = document.getElementById("perusahaanSelect");
  const snap = await getDocs(collection(db, "perusahaan"));
  select.innerHTML = `<option value="">-- Pilih Perusahaan --</option>`;
  snap.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.data().nama;
    if (d.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}
