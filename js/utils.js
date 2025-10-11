/**
 * Fungsi untuk kompres gambar dari input file, preview hasilnya, dan simpan ke localStorage
 * 
 * @param {File} file - File gambar dari input
 * @param {string} targetPreviewId - ID elemen untuk menampilkan hasil preview (opsional)
 * @param {string} storageKey - Nama key untuk menyimpan hasil di localStorage
 * @param {function} callback - Fungsi yang dijalankan setelah selesai (opsional)
 */
function compressAndSaveImage(file, targetPreviewId, storageKey, callback) {
  const reader = new FileReader();

  reader.onload = function (e) {
    const img = new Image();

    img.onload = function () {
      const MAX_WIDTH = 800;
      const scale = MAX_WIDTH / img.width;
      const canvas = document.createElement("canvas");
      canvas.width = MAX_WIDTH;
      canvas.height = img.height * scale;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.7);

      // Tampilkan preview jika ada
      if (targetPreviewId) {
        document.getElementById(targetPreviewId).innerHTML =
          `<img src="${compressedDataUrl}" style="width:100%; border-radius:10px;">`;
      }

      // Simpan ke localStorage
      localStorage.setItem(storageKey, compressedDataUrl);

      // Callback jika ada
      if (callback && typeof callback === 'function') {
        callback(compressedDataUrl);
      }
    };

    img.src = e.target.result;
  };

  reader.readAsDataURL(file);
}

/**
 * Validasi ukuran file sebelum dikompres
 * 
 * @param {File} file - File dari input kamera
 * @param {number} maxSizeMB - Maksimal ukuran file dalam MB
 * @returns {boolean} - true jika valid, false jika terlalu besar
 */
function validateSizeBeforeCompress(file, maxSizeMB = 6) {
  const sizeMB = file.size / (1024 * 1024);
  if (sizeMB > maxSizeMB) {
    alert(`❌ Ukuran foto terlalu besar (${sizeMB.toFixed(2)} MB). Maksimal ${maxSizeMB} MB.`);
    return false;
  }
  return true;
}

