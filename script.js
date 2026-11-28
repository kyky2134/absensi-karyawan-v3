
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

// ==================================
// PROSES AKTIVASI AKUN DARI UNDANGAN
// ==================================

async function cekUndangan() {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);

  const isInvite =
    hash.includes("type=invite") ||
    hash.includes("type=recovery") ||
    params.has("code");

  if (!isInvite) return;

  loginForm.style.display = "none";

  message.textContent = "Memeriksa link undangan...";

  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.getSession();

  if (sessionError || !sessionData.session) {
    message.textContent =
      "Link undangan tidak valid atau sudah kedaluwarsa. Minta Admin mengirim undangan baru.";
    return;
  }

  message.textContent = "";

  const activationForm = document.createElement("form");

  activationForm.innerHTML = `
    <h2>Buat Password Akun</h2>

    <p>Silakan buat password untuk akun AttendPro kamu.</p>

    <input
      type="password"
      id="newPassword"
      placeholder="Password baru"
      minlength="8"
      required
    >

    <input
      type="password"
      id="confirmPassword"
      placeholder="Ulangi password"
      minlength="8"
      required
    >

    <button type="submit">Aktifkan Akun</button>
  `;

  loginForm.parentElement.appendChild(activationForm);

  activationForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const password = document.getElementById("newPassword").value;
    const confirmPassword =
      document.getElementById("confirmPassword").value;

    if (password.length < 8) {
      message.textContent = "Password minimal 8 karakter.";
      return;
    }

    if (password !== confirmPassword) {
      message.textContent = "Password tidak sama.";
      return;
    }

    message.textContent = "Sedang mengaktifkan akun...";

    const { error } = await supabaseClient.auth.updateUser({
      password: password
    });

    if (error) {
      message.textContent = "Gagal mengaktifkan akun: " + error.message;
      return;
    }

    const {
      data: { user },
      error: userError
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      message.textContent = "Akun berhasil diperbarui, silakan login.";
      await supabaseClient.auth.signOut();
      return;
    }

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      message.textContent =
        "Password berhasil dibuat, tetapi profil belum ditemukan.";
      return;
    }

    message.textContent = "Akun berhasil diaktifkan!";

    if (profile.role === "admin") {
      window.location.href = "admin.html";
    } else {
      window.location.href = "karyawan.html";
    }
  });
}

// ==================================
// LOGIN ADMIN DAN KARYAWAN
// ==================================

loginForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  message.textContent = "Sedang login...";

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    message.textContent = "Email atau password salah";
    return;
  }

  const { data: profile, error: profileError } =
    await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

  if (profileError || !profile) {
    await supabaseClient.auth.signOut();
    message.textContent = "Gagal mengambil profil pengguna.";
    return;
  }

  if (profile.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "karyawan.html";
  }
});

// Jalankan pemeriksaan undangan
cekUndangan();
