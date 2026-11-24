
const profileForm = document.getElementById("profileForm");
const employeeMessage = document.getElementById("employeeMessage");

let currentUser = null;

async function checkEmployee() {
  const { data: { user }, error: authError } =
    await supabaseClient.auth.getUser();

  if (authError || !user) {
    window.location.href = "index.html";
    return;
  }

  currentUser = user;

  const { data: profile, error } = await supabaseClient
    .from("profiles")
    .select("nama, nomor_paspor, role")
    .eq("id", user.id)
    .single();

  if (error || !profile || profile.role !== "karyawan") {
    alert("Akses khusus Karyawan!");
    await supabaseClient.auth.signOut();
    window.location.href = "index.html";
    return;
  }

  document.getElementById("employeeName").textContent =
    "Selamat datang, " + (profile.nama || "Karyawan");

  document.getElementById("nama").value = profile.nama || "";
  document.getElementById("nomorPaspor").value =
    profile.nomor_paspor || "";
}

profileForm.addEventListener("submit", async function(e) {
  e.preventDefault();

  if (!currentUser) return;

  const nama = document.getElementById("nama").value.trim();
  const nomorPaspor =
    document.getElementById("nomorPaspor").value.trim();

  employeeMessage.textContent = "Menyimpan profil...";

  const { error } = await supabaseClient
    .from("profiles")
    .update({
      nama,
      nomor_paspor: nomorPaspor
    })
    .eq("id", currentUser.id);

  if (error) {
    employeeMessage.textContent = error.message;
    return;
  }

  employeeMessage.textContent = "Profil berhasil disimpan!";
  document.getElementById("employeeName").textContent =
    "Selamat datang, " + nama;
});

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

checkEmployee();
