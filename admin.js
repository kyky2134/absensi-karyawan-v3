
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

  if (message) {
    message.textContent = "Selamat datang, " + profile.nama;
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}

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
      const { error } = await supabaseClient.rpc(
        "set_office_location",
        {
          p_latitude: position.coords.latitude,
          p_longitude: position.coords.longitude,
          p_radius: 100
        }
      );

      if (error) {
        message.textContent = "Gagal menyimpan lokasi: " + error.message;
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

    const nama = document.getElementById("namaKaryawan").value.trim();
    const email = document.getElementById("emailKaryawan").value.trim();

    if (!nama || !email) {
      tambahMessage.textContent = "Nama dan email wajib diisi.";
      return;
    }

    tambahMessage.textContent = "Sedang mendaftarkan...";

    try {
      const { data, error } = await supabaseClient.functions.invoke(
        "dynamic-function",
        {
          body: { nama, email }
        }
      );

      if (error) {
        let detail = error.message;

        if (error.context) {
          try {
            const response = await error.context.clone().json();
            detail = response.detail || response.error || response.message || detail;
          } catch (_) {}
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

// ==============================
// DATA KARYAWAN
// ==============================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, function(char) {
    return {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char];
  });
}

async function lihatDataKaryawan() {
  const container = document.getElementById("dataKaryawanContainer");

  if (!container) {
    alert("Bagian Data Karyawan belum tersedia di admin.html");
    return;
  }

  container.innerHTML = "Memuat data karyawan...";

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("id, nama, nomor_paspor, role, status_verifikasi, created_at")
    .eq("role", "karyawan")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Gagal mengambil data: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Belum ada data karyawan.</p>";
    return;
  }

  let html = `
    <h2>Data Karyawan</h2>
    <p>Total karyawan: ${data.length}</p>
    <div style="overflow-x:auto">
      <table border="1" cellpadding="10" cellspacing="0"
        style="width:100%; border-collapse:collapse;">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama</th>
            <th>Nomor Paspor</th>
            <th>Verifikasi</th>
            <th>Tanggal Daftar</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((karyawan, index) => {
    const tanggal = karyawan.created_at
      ? new Date(karyawan.created_at).toLocaleDateString("id-ID")
      : "-";

    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(karyawan.nama)}</td>
        <td>${escapeHTML(karyawan.nomor_paspor)}</td>
        <td>${karyawan.status_verifikasi ? "Terverifikasi" : "Belum diverifikasi"}</td>
        <td>${escapeHTML(tanggal)}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    <button onclick="lihatDataKaryawan()">Muat Ulang</button>
  `;

  container.innerHTML = html;
}

checkAdmin();
