/* =========================
   UTILITAS UMUM (overlay, toast, konversi file)
========================= */
export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (err) => reject(err);
  });
}

export async function fetchWithTimeout(
  resource,
  options = {},
  timeout = 20000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  options.signal = controller.signal;

  try {
    const response = await fetch(resource, options);
    clearTimeout(id);
    return response;
  } catch {
    throw new Error("⏱️ Timeout: server tidak merespons dalam 20 detik.");
  }
}

export function showOverlay(message = "Memproses...") {
  let overlay = document.getElementById("loadingOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "loadingOverlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      background: "rgba(0,0,0,0.6)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999,
      fontSize: "1.1rem",
      textAlign: "center",
    });
    overlay.innerHTML = `
      <div class="spinner-border text-light mb-3" role="status"></div>
      <p>${message}</p>
    `;
    document.body.appendChild(overlay);
  } else {
    overlay.querySelector("p").textContent = message;
    overlay.style.display = "flex";
  }
}

export function hideOverlay() {
  const overlay = document.getElementById("loadingOverlay");
  if (overlay) overlay.style.display = "none";
}

export function showToast(msg, type = "info") {
  const colors = {
    success: "#28a745",
    warning: "#ffc107",
    info: "#17a2b8",
    danger: "#dc3545",
  };
  const el = document.createElement("div");
  el.textContent = msg;
  Object.assign(el.style, {
    position: "fixed",
    bottom: "20px",
    right: "20px",
    background: colors[type] || "#333",
    color: "#fff",
    padding: "10px 15px",
    borderRadius: "8px",
    zIndex: 9999,
    opacity: 0,
    transition: "all .3s",
  });
  document.body.appendChild(el);
  setTimeout(() => (el.style.opacity = 1), 50);
  setTimeout(() => {
    el.style.opacity = 0;
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export function showSuccessOverlay(message = "✅ Data tersimpan!") {
  let overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000,
  });
  overlay.innerHTML = `
    <div style="background:#e8f5e9;padding:30px;border-radius:15px;text-align:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);">
      <div style="font-size:50px;">✅</div>
      <h3 style="color:#2e7d32;">${message}</h3>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2000);
}
