/**
 * ================================================================
 * 🔧 UNIVERSAL MODAL UTILITIES (Hybrid Bootstrap 4 & 5 Compatible)
 * ================================================================
 * ✅ Bisa jalan di:
 *    - AdminLTE 3.x (Bootstrap 4.6)
 *    - AdminLTE 4.x (Bootstrap 5.x)
 *    - Tanpa Bootstrap (fallback manual)
 * ================================================================
 */

/**
 * 🧠 Deteksi versi Bootstrap aktif
 * @returns {"bs5"|"bs4"|"none"}
 */
export function detectBootstrapVersion() {
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) return "bs5";
  if (window.$ && typeof $().modal === "function") return "bs4";
  return "none";
}

/**
 * ✅ Tampilkan modal secara universal (fade-in animasi lembut)
 * @param {HTMLElement|string} modal - elemen modal atau ID-nya
 */
export function showModalSmart(modal) {
  try {
    const modalEl =
      typeof modal === "string" ? document.getElementById(modal) : modal;
    if (!modalEl) throw new Error("Modal tidak ditemukan.");

    const version = detectBootstrapVersion();
    modalEl.style.opacity = "0";
    modalEl.style.transition = "opacity 0.4s ease";

    if (version === "bs5") {
      const instance = new bootstrap.Modal(modalEl);
      instance.show();
      setTimeout(() => (modalEl.style.opacity = "1"), 100);
      console.log("🟢 Modal tampil via Bootstrap 5");
    } else if (version === "bs4") {
      $(modalEl)
        .modal("show")
        .on("shown.bs.modal", () => (modalEl.style.opacity = "1"));
      console.log("🟣 Modal tampil via Bootstrap 4");
    } else {
      // Fallback manual tanpa Bootstrap
      modalEl.style.display = "block";
      modalEl.style.position = "fixed";
      modalEl.style.zIndex = "9999";
      modalEl.style.top = "50%";
      modalEl.style.left = "50%";
      modalEl.style.transform = "translate(-50%, -50%)";
      modalEl.style.background = "#fff";
      modalEl.style.padding = "20px";
      modalEl.style.borderRadius = "10px";
      modalEl.style.boxShadow = "0 4px 10px rgba(0,0,0,0.3)";
      setTimeout(() => (modalEl.style.opacity = "1"), 100);
      console.warn("⚠️ Modal tampil manual tanpa Bootstrap");
    }
  } catch (err) {
    console.error("❌ Gagal menampilkan modal:", err);
  }
}

/**
 * ✅ Tutup modal secara universal (tanpa error getInstance)
 * @param {HTMLElement|string} modal - elemen modal atau ID-nya
 */
export function closeModalSmart(modal) {
  try {
    const modalEl =
      typeof modal === "string" ? document.getElementById(modal) : modal;
    if (!modalEl) return;

    const version = detectBootstrapVersion();

    // --- Bootstrap 5 ---
    if (version === "bs5") {
      try {
        let instance = null;
        if (typeof bootstrap.Modal.getInstance === "function") {
          instance = bootstrap.Modal.getInstance(modalEl);
        }
        if (!instance) {
          instance = new bootstrap.Modal(modalEl);
        }

        if (instance && typeof instance.hide === "function") {
          instance.hide();
          console.log("✅ Modal ditutup via Bootstrap 5");
          return;
        }
      } catch (err) {
        console.warn("⚠️ Bootstrap 5 close fallback:", err);
      }
    }

    // --- Bootstrap 4 ---
    if (version === "bs4") {
      if (window.$ && typeof $().modal === "function") {
        $("#petugasModal").modal("hide");
        console.log("✅ Modal ditutup via Bootstrap 4");
        return;
      }
    }

    // --- Fallback Manual ---
    modalEl.style.display = "none";
    modalEl.remove();
    console.warn("⚠️ Modal ditutup manual (tanpa Bootstrap)");
  } catch (err) {
    console.error("❌ Gagal menutup modal:", err);
    if (modal) modal.remove();
  }
}

/**
 * 🔍 Log versi Bootstrap aktif di console
 */
export function logBootstrapVersion() {
  const version = detectBootstrapVersion();
  const label =
    version === "bs5"
      ? "Bootstrap 5.x"
      : version === "bs4"
      ? "Bootstrap 4.x"
      : "Tidak ada Bootstrap";
  console.log(`🧩 Deteksi Bootstrap aktif: ${label}`);
}
