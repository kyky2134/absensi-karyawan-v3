
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

const loginSection = document.getElementById("loginSection");
const recoveryForm = document.getElementById("recoveryForm");

const forgotPassword = document.getElementById("forgotPassword");
const newPasswordForm = document.getElementById("newPasswordForm");

// URL website AttendPro
const SITE_URL =
  "https://kyky2134.github.io/absensi-karyawan-v3/";

// ==================================
// TAMPILKAN PESAN
// ==================================

function showMessage(text, color = "#2863bd") {
  message.textContent = text;
  message.style.color = color;
}

// ==================================
// PROSES LINK UNDANGAN / RECOVERY
// ==================================

async function cekLinkAuth() {
  const hash = window.location.hash;
  const params = new URLSearchParams(window.location.search);

  const hashParams = new URLSearchParams(
    hash.startsWith("#") ? hash.substring(1) : hash
  );

  const authError = hashParams.get("error");
  const errorDescription = hashParams.get("error_description");

  if (authError) {
    showMessage(
      errorDescription
        ? decodeURIComponent(errorDescription.replace(/\+/g, " "))
        : "Link tidak valid atau sudah kedaluwarsa.",
      "#d93025"
    );
    return;
  }

  let isAuthLink = false;

  // Link PKCE
  if (params.has("code")) {
    showMessage("Memeriksa link akun...");

    const { error } =
      await supabaseClient.auth.exchangeCodeForSession(
        params.get("code")
      );

    if (error) {
      showMessage("Link tidak valid atau kedaluwarsa: " + error.message, "#d93025");
      return;
    }

    isAuthLink = true;
  }

  // Link OTP / undangan lama
  else if (hashParams.get("access_token")) {
    const accessToken = hashParams.get("access_token");
    const refreshToken = hashParams.get("refresh_token");

    const { error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    if (error) {
      showMessage("Gagal memeriksa link: " + error.message, "#d93025");
      return;
    }

    isAuthLink = true;
  }

  if (!isAuthLink) {
    const { data } = await supabaseClient.auth.getSession();

    if (data.session && hashParams.get("type")) {
      isAuthLink = true;
    }
  }

  if (!isAuthLink) return;

  loginSection.style.display = "none";
  recoveryForm.style.display = "block";

  const type = hashParams.get("type");

  if (type === "recovery") {
    showMessage("Silakan buat password baru.");
  } else {
    showMessage("Undangan berhasil diperiksa. Buat password akun kamu.");
  }
}

// ==================================
// LUPA PASSWORD
// ==================================

if (forgotPassword) {
  forgotPassword.addEventListener("click", async function(e) {
    e.preventDefault();

    const email = document.getElementById("email").value.trim();

    if (!email) {
      showMessage("Masukkan email terlebih dahulu.", "#d93025");
      document.getElementById("email").focus();
      return;
    }

    showMessage("Sedang mengirim email pemulihan...");

    const { error } =
      await supabaseClient.auth.resetPasswordForEmail(email, {
        redirectTo: SITE_URL
      });

    if (error) {
      showMessage("Gagal mengirim email: " + error.message, "#d93025");
      return;
    }

    showMessage(
      "Email pemulihan berhasil dikirim. Periksa kotak masuk atau spam."
    );
  });
}

// ==================================
// SIMPAN PASSWORD BARU
// ==================================

if (newPasswordForm) {
  newPasswordForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const password =
      document.getElementById("newPassword").value;

    const confirmPassword =
      document.getElementById("confirmPassword").value;

    if (password.length < 8) {
      showMessage("Password minimal 8 karakter.", "#d93025");
      return;
    }

    if (password !== confirmPassword) {
      showMessage("Password tidak sama.", "#d93025");
      return;
    }

    showMessage("Sedang menyimpan password...");

    const { data: sessionData, error: sessionError } =
      await supabaseClient.auth.getSession();

    if (sessionError || !sessionData.session) {
      showMessage(
        "Sesi pemulihan tidak ditemukan. Silakan minta link baru.",
        "#d93025"
      );
      return;
    }

    const { error } = await supabaseClient.auth.updateUser({
      password: password
    });

    if (error) {
      showMessage("Gagal menyimpan password: " + error.message, "#d93025");
      return;
    }

    showMessage("Password berhasil dibuat! Mengarahkan ke dashboard.");

    const user = sessionData.session.user;

    const { data: profile, error: profileError } =
      await supabaseClient
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

    if (profileError || !profile) {
      showMessage(
        "Password berhasil dibuat. Silakan login kembali.",
        "#2863bd"
      );

      await supabaseClient.auth.signOut();
      setTimeout(() => {
        window.location.href = SITE_URL;
      }, 2000);
      return;
    }

    setTimeout(() => {
      if (profile.role === "admin") {
        window.location.href = "admin.html";
      } else {
        window.location.href = "karyawan.html";
      }
    }, 1500);
  });
}

// ==================================
// LOGIN ADMIN DAN KARYAWAN
// ==================================

loginForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  showMessage("Sedang login...");

  const { data, error } =
    await supabaseClient.auth.signInWithPassword({
      email,
      password
    });

  if (error) {
    showMessage("Email atau password salah.", "#d93025");
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
    showMessage("Gagal mengambil profil pengguna.", "#d93025");
    return;
  }

  if (profile.role === "admin") {
    window.location.href = "admin.html";
  } else if (profile.role === "karyawan") {
    window.location.href = "karyawan.html";
  } else {
    await supabaseClient.auth.signOut();
    showMessage("Role akun tidak dikenali.", "#d93025");
  }
});

// ==================================
// JALANKAN PEMERIKSAAN LINK
// ==================================

cekLinkAuth();
