
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
// FUNGSI BANTUAN
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

// ==============================
// DATA KARYAWAN
// ==============================

async function lihatDataKaryawan() {
  const container = document.getElementById("dataKaryawanContainer");

  if (!container) return;

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
        style="width:100%;border-collapse:collapse;">
        <tr>
          <th>No</th>
          <th>Nama</th>
          <th>Nomor Paspor</th>
          <th>Verifikasi</th>
          <th>Tanggal Daftar</th>
        </tr>
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

  html += "</table></div>";
  container.innerHTML = html;
}

// ==============================
// DATA ABSENSI
// ==============================

async function lihatDataAbsensi() {
  const container = document.getElementById("dataAbsensiContainer");

  if (!container) return;

  container.innerHTML = "Memuat data absensi...";

  const { data, error } = await supabaseClient
    .from("absensi")
    .select(`
      id,
      user_id,
      tanggal,
      jam_masuk,
      jam_pulang,
      status,
      latitude,
      longitude
    `)
    .order("tanggal", { ascending: false });

  if (error) {
    container.textContent = "Gagal mengambil data: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Belum ada data absensi.</p>";
    return;
  }

  const userIds = [...new Set(data.map(item => item.user_id))];

  const { data: profiles, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, nama")
    .in("id", userIds);

  if (profileError) {
    container.textContent =
      "Gagal memuat nama karyawan: " + profileError.message;
    return;
  }

  const namaMap = {};

  (profiles || []).forEach(profile => {
    namaMap[profile.id] = profile.nama;
  });

  function formatWaktu(value) {
    if (!value) return "-";

    return new Date(value).toLocaleString("id-ID", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Jakarta"
    });
  }

  let html = `
    <h2>Data Absensi</h2>
    <p>Total catatan absensi: ${data.length}</p>
    <div style="overflow-x:auto">
      <table border="1" cellpadding="10" cellspacing="0"
        style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th>No</th>
            <th>Nama Karyawan</th>
            <th>Tanggal</th>
            <th>Jam Masuk</th>
            <th>Jam Pulang</th>
            <th>Status</th>
            <th>Lokasi GPS</th>
          </tr>
        </thead>
        <tbody>
  `;

  data.forEach((item, index) => {
    const tanggal = item.tanggal
      ? new Date(item.tanggal + "T00:00:00").toLocaleDateString("id-ID")
      : "-";

    const lokasi =
      item.latitude != null && item.longitude != null
        ? `${escapeHTML(item.latitude)}, ${escapeHTML(item.longitude)}`
        : "-";

    html += `
      <tr>
        <td>${index + 1}</td>
        <td>${escapeHTML(namaMap[item.user_id] || "Tidak diketahui")}</td>
        <td>${escapeHTML(tanggal)}</td>
        <td>${escapeHTML(formatWaktu(item.jam_masuk))}</td>
        <td>${escapeHTML(formatWaktu(item.jam_pulang))}</td>
        <td>${escapeHTML(item.status || "-")}</td>
        <td>${lokasi}</td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
    <button onclick="lihatDataAbsensi()">Muat Ulang</button>
  `;

  container.innerHTML = html;
}

// ==============================
// VERIFIKASI WAJAH KARYAWAN
// ==============================

async function lihatVerifikasiWajah() {
  const container = document.getElementById("faceVerificationContainer");

  if (!container) return;

  container.innerHTML = "Memuat pengajuan verifikasi...";

  const { data, error } = await supabaseClient
    .from("verifikasi_wajah")
    .select("id, user_id, storage_path, status, catatan, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    container.textContent = "Gagal memuat verifikasi: " + error.message;
    return;
  }

  if (!data || data.length === 0) {
    container.innerHTML = "<p>Belum ada pengajuan verifikasi.</p>";
    return;
  }

  const userIds = [...new Set(data.map(item => item.user_id))];

  const { data: profiles, error: profileError } = await supabaseClient
    .from("profiles")
    .select("id, nama")
    .in("id", userIds);

  if (profileError) {
    container.textContent = "Gagal memuat nama: " + profileError.message;
    return;
  }

  const namaMap = {};

  (profiles || []).forEach(profile => {
    namaMap[profile.id] = profile.nama;
  });

  container.innerHTML = "<h2>Daftar Verifikasi Wajah</h2>";

  for (const item of data) {
    const { data: signedData, error: signedError } =
      await supabaseClient.storage
        .from("verifikasi-wajah")
        .createSignedUrl(item.storage_path, 300);

    const card = document.createElement("div");

    card.style.cssText =
      "border:1px solid #ccc;padding:15px;margin:12px 0;border-radius:10px;";

    const title = document.createElement("h3");
    title.textContent = namaMap[item.user_id] || "Karyawan";

    const status = document.createElement("p");
    status.textContent = "Status: " + item.status;

    const date = document.createElement("p");
    date.textContent = item.created_at
      ? "Tanggal: " + new Date(item.created_at).toLocaleString("id-ID")
      : "";

    card.append(title, status, date);

    if (signedError) {
      const errorText = document.createElement("p");
      errorText.textContent = "Foto gagal dimuat: " + signedError.message;
      card.appendChild(errorText);
    } else {
      const photo = document.createElement("img");
      photo.src = signedData.signedUrl;
      photo.alt = "Foto verifikasi karyawan";
      photo.style.cssText =
        "width:100%;max-width:300px;border-radius:10px;";
      card.appendChild(photo);
    }

    if (item.status === "menunggu") {
      const note = document.createElement("textarea");
      note.placeholder = "Catatan Admin (opsional)";
      note.style.cssText = "display:block;width:100%;margin:10px 0;padding:8px;";

      const approve = document.createElement("button");
      approve.textContent = "Setujui";

      approve.addEventListener("click", () => {
        prosesVerifikasi(item.id, "disetujui", note.value);
      });

      const reject = document.createElement("button");
      reject.textContent = "Tolak";
      reject.style.marginLeft = "8px";

      reject.addEventListener("click", () => {
        if (!note.value.trim()) {
          alert("Isi alasan penolakan terlebih dahulu.");
          return;
        }

        prosesVerifikasi(item.id, "ditolak", note.value);
      });

      card.append(note, approve, reject);
    }

    container.appendChild(card);
  }

  const reload = document.createElement("button");
  reload.textContent = "Muat Ulang Verifikasi";
  reload.addEventListener("click", lihatVerifikasiWajah);
  container.appendChild(reload);
}

async function prosesVerifikasi(id, status, catatan) {
  const konfirmasi = status === "disetujui"
    ? "Setujui verifikasi karyawan ini?"
    : "Tolak verifikasi karyawan ini?";

  if (!confirm(konfirmasi)) return;

  const { data, error } = await supabaseClient.rpc(
    "review_face_verification",
    {
      p_id: id,
      p_status: status,
      p_catatan: catatan.trim() || null
    }
  );

  if (error) {
    alert("Gagal memproses: " + error.message);
    return;
  }

  alert(data || "Verifikasi berhasil diperbarui.");

  await lihatVerifikasiWajah();
  await lihatDataKaryawan();
}

checkAdmin();
