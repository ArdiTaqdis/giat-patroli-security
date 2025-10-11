function loginAdmin() {
  const user = document.getElementById("username").value.trim();
  const pass = document.getElementById("password").value.trim();

  // Ganti sesuai kebutuhan
  const credentials = {
    admin: "12345",
    admingiat: "patroli2025",
  };

  if (credentials[user] && credentials[user] === pass) {
    localStorage.setItem("adminLogin", "true");
    window.location.href = "../pages/admin.html";
  } else {
    document.getElementById("status").innerText =
      "❌ Username atau Password salah.";
  }
}
