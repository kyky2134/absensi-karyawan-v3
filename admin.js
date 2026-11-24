
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


async function ambilLokasiKantor() {
  const message = document.getElementById("lokasiMessage");

  if (!navigator.geolocation) {
    message.textContent = "GPS tidak didukung perangkat ini.";
    return;
  }

  message.textContent = "Mengambil lokasi GPS...";

  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const latitude = position.coords.latitude;
      const longitude = position.coords.longitude;

      const { error } = await supabaseClient.rpc(
        "set_office_location",
        {
          p_latitude: latitude,
          p_longitude: longitude,
          p_radius: 100
        }
      );

      if (error) {
        message.textContent = "Gagal menyimpan: " + error.message;
        return;
      }

      message.textContent =
        "Lokasi kantor berhasil disimpan. Radius 100 meter.";
    },
    (error) => {
      message.textContent =
        "GPS gagal: " + error.message;
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}

