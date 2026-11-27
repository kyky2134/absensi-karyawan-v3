
async function checkAdmin() {
  const message = document.getElementById("adminMessage");

  const {
    data: { user },
    error: authError
  } = await supabaseClient.auth.getUser();

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


// ==============================
// LOKASI KANTOR
// ==============================

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
        message.textContent =
          "Gagal menyimpan lokasi: " + error.message;
        return;
      }

      message.textContent =
        "Lokasi kantor berhasil disimpan. Radius 100 meter.";
    },
    (error) => {
      message.textContent = "GPS gagal: " + error.message;
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0
    }
  );
}


// ==============================
// DAFTARKAN KARYAWAN BARU
// ==============================

const tambahForm = document.getElementById("tambahKaryawanForm");
const tambahMessage = document.getElementById("tambahKaryawanMessage");

if (tambahForm) {
  tambahForm.addEventListener("submit", async function(e) {
    e.preventDefault();

    const nama = document
      .getElementById("namaKaryawan")
      .value.trim();

    const email = document
      .getElementById("emailKaryawan")
      .value.trim();

    if (!nama || !email) {
      tambahMessage.textContent = "Nama dan email wajib diisi.";
      return;
    }

    tambahMessage.textContent = "Sedang mendaftarkan...";

    try {
      const { data, error } =
        await supabaseClient.functions.invoke(
          "dynamic-function",
          {
            body: {
              nama: nama,
              email: email
            }
          }
        );

      if (error) {
        let detail = error.message;

        if (error.context) {
          try {
            const response = await error.context.clone().json();

            detail =
              response.detail ||
              response.error ||
              response.message ||
              detail;
          } catch (_) {
            // Gunakan pesan error awal jika respons bukan JSON.
          }
        }

        tambahMessage.textContent = "Gagal: " + detail;
        return;
      }

      if (data?.error) {
        tambahMessage.textContent =
          "Gagal: " + (data.detail || data.error);
        return;
      }

      tambahMessage.textContent =
        "Undangan berhasil dikirim ke email karyawan!";

      tambahForm.reset();

    } catch (err) {
      tambahMessage.textContent =
        "Terjadi kesalahan: " + err.message;
    }
  });
}
