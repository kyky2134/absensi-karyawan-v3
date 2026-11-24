
async function checkAdmin() {
  const message = document.getElementById("adminMessage");

  const { data: { user }, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !user) {
    window.location.href = "index.html";
    return;
  }

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("nama, role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "admin") {
    alert("Akses khusus Administrator!");
    window.location.href = "index.html";
    return;
  }

  message.textContent = "Selamat datang, " + profile.nama;
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

checkAdmin();
