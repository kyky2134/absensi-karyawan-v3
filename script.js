
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");

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
    message.textContent = "Profil pengguna tidak ditemukan";
    return;
  }

  if (profile.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "karyawan.html";
  }
});
